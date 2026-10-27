// ==UserScript==
// @name         zerobywai 漫畫下載
// @version      1.4.0
// @namespace    https://github.com/jyltsang/zerobywai-downloader
// @description  Download manga chapters from zerobywai.com — JPG per page or PDF per chapter, bulk selection, parallel downloads
// @author       Mccranky83 (original); patched for new site structure
// @license      MIT
// @match        https://www.zerobywai.com/pc/details/*
// @match        https://www.zerobywai.com/pc/view/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=zerobywai.com
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @connect      tupa.zerobywai.com
// @connect      www.zerobywai.com
// @require      https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js
// @downloadURL  https://raw.githubusercontent.com/jyltsang/zerobywai-downloader/main/zerobywai-mangadl.user.js
// @updateURL    https://raw.githubusercontent.com/jyltsang/zerobywai-downloader/main/zerobywai-mangadl.user.js
// ==/UserScript==

/*
  v1.4.0 — Pause/resume and remembered format
  ─────────────────────────────────────────────
  • ⏸ Pause / ▶ Resume button next to Abort (in-flight requests finish first)
  • The JPG/PDF choice is remembered between visits

  v1.3.0 — Reliability fixes
  ────────────────────────────
  • Viewer page no longer freezes the tab (self-triggering MutationObserver removed)
  • Range selection matches zero-padded labels ("01" is chapter 1); reversed ranges work
  • Numeric chapter labels are zero-padded in filenames (ch001) so files sort correctly
  • Failed requests are retried with back-off; chapter pages are checked for HTTP errors
  • Image URLs are resolved to absolute URLs; extensions are read from the URL path
  • PDF images are passed to jsPDF as bytes (no base64 round trip, format auto-detected)
  • Abort is available on the viewer page and is reported correctly in bulk mode
  • Overall progress no longer stalls short of 100 % when pages fail in PDF mode

  v1.2.0 — JPG or PDF output choice
  ────────────────────────────────────
  • JPG mode  — each page saved as an individual file to ~/Downloads via GM_download
  • PDF mode  — all pages assembled into one PDF per chapter, then saved via <a download>
                Uses jsPDF (no Web Workers — safe in Tampermonkey sandbox)
                PDF pages are sized exactly to each image (portrait manga layout)

  v1.1.0 — Parallel downloads + bulk chapter selection
  v1.0.0 — Initial rewrite for new zerobywai.com PC frontend

  Keyboard shortcuts:
    Ctrl/Cmd+O  →  Open panel
    Ctrl+Q      →  Close panel
*/

(function () {
  'use strict';

  // ── Config ────────────────────────────────────────────────────────────────────
  const CONCURRENT_DOWNLOADS = 5;  // parallel image fetches per chapter
  const CHAPTER_GAP_MS       = 300; // ms pause between chapters in bulk mode
  const MAX_RETRIES          = 3;   // extra attempts per request after the first failure
  const RETRY_BASE_MS        = 1000; // back-off: 1 s, 2 s, 4 s …
  const IMG_HOST             = 'tupa.zerobywai.com';

  // ── State ─────────────────────────────────────────────────────────────────────
  let isDownloading = false;
  let abortFlag     = false;
  let isPaused      = false;
  let outputMode    = loadOutputMode(); // 'jpg' | 'pdf'

  // ── Utilities ─────────────────────────────────────────────────────────────────

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Storage can throw (private windows, blocked site data), so failures fall back
  // to the default rather than breaking the script
  const FORMAT_KEY = 'zbw-dl-format';
  function loadOutputMode() {
    try { return localStorage.getItem(FORMAT_KEY) === 'pdf' ? 'pdf' : 'jpg'; } catch { return 'jpg'; }
  }
  function saveOutputMode(mode) {
    try { localStorage.setItem(FORMAT_KEY, mode); } catch { /* not persisted */ }
  }

  // Resolves once the user resumes (or aborts); called before each new request
  async function waitWhilePaused() {
    while (isPaused && !abortFlag) await sleep(200);
  }

  function safeFilename(s) {
    return (s || 'manga').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
  }

  // Pure numeric labels ("1", "01", "12.5") are padded to three digits so files sort
  // naturally; anything else ("番外", "第3話") is kept as-is to avoid name collisions
  function chapterTag(label) {
    const m = String(label).trim().match(/^(\d+)(\.\d+)?$/);
    if (m) return m[1].padStart(3, '0') + (m[2] || '');
    return safeFilename(label).replace(/\s+/g, '_') || 'unknown';
  }

  // First number in a label, used for range selection ("01" → 1, "第3話" → 3)
  function chapterNumber(label) {
    const m = String(label).match(/\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : NaN;
  }

  function imageExtension(url) {
    try {
      const m = new URL(url).pathname.match(/\.([a-z0-9]{2,5})$/i);
      return m ? m[1].toLowerCase() : 'jpg';
    } catch {
      return 'jpg';
    }
  }

  // Retries an async operation with exponential back-off; aborting stops the retries
  async function withRetry(fn, what) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (abortFlag || attempt >= MAX_RETRIES) throw err;
        const delay = RETRY_BASE_MS * 2 ** attempt;
        console.warn(`[zbw-dl] ${what} failed (${err.message}), retry ${attempt + 1}/${MAX_RETRIES} in ${delay} ms`);
        await sleep(delay);
        await waitWhilePaused();
      }
    }
  }

  // Details page title: "<manga> - zero搬运网"; viewer: "<manga> - <chapter> - zero搬运网"
  function getMangaTitle() {
    let title = document.title.replace(/\s*[-–]\s*zero搬运网.*$/i, '').trim();
    if (isViewerPage()) title = title.replace(/\s*[-–]\s*[^-–]*$/, '');
    return safeFilename(title) || 'manga';
  }

  // Concurrency pool — runs tasks[] with at most `concurrency` in flight
  async function pool(tasks, concurrency) {
    let idx = 0;
    async function worker() {
      while (idx < tasks.length) {
        await waitWhilePaused();
        if (abortFlag) return;
        await tasks[idx++]();
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(concurrency, tasks.length) }, worker)
    );
  }

  // ── Binary fetch (returns ArrayBuffer) ───────────────────────────────────────
  // Used for both JPG saves and PDF image embedding
  function fetchArrayBuffer(url) {
    return withRetry(() => fetchArrayBufferOnce(url), `fetch ${url}`);
  }

  function fetchArrayBufferOnce(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET', url,
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: { 'Referer': 'https://www.zerobywai.com/' },
        onload(r) {
          if (r.status >= 200 && r.status < 300) resolve(r.response);
          else reject(new Error(`HTTP ${r.status}`));
        },
        onerror()   { reject(new Error('Network error')); },
        ontimeout() { reject(new Error('Timeout')); }
      });
    });
  }

  // Trigger a browser save-file dialog for a Blob — works in Firefox sandbox
  function triggerBlobSave(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a   = Object.assign(document.createElement('a'), {
      href: url, download: filename, style: 'display:none'
    });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 5000);
  }

  // ── Save a single JPG file ────────────────────────────────────────────────────
  function saveJpg(url, filename) {
    // Prefer GM_download (silent, no dialog) — fall back to blob trigger
    if (typeof GM_download === 'function') {
      return withRetry(() => new Promise((resolve, reject) => {
        GM_download({
          url, name: filename,
          headers: { 'Referer': 'https://www.zerobywai.com/' },
          onload()    { resolve(); },
          onerror(e)  { reject(new Error(`GM_download: ${JSON.stringify(e)}`)); },
          ontimeout() { reject(new Error('Timeout')); }
        });
      }), `save ${filename}`);
    }
    // Fallback
    return fetchArrayBuffer(url).then(buf => {
      const blob = new Blob([buf], { type: 'image/jpeg' });
      triggerBlobSave(blob, filename);
    });
  }

  // ── Build a PDF from an array of image ArrayBuffers ───────────────────────────
  // Uses jsPDF loaded via @require — pure JS, no Web Workers, safe in sandbox
  async function buildPdf(imageBuffers, onProgress) {
    // jsPDF is injected into unsafeWindow by Tampermonkey's @require
    const jsPDFCtor = (typeof jspdf !== 'undefined' && jspdf.jsPDF)
      || (typeof window.jspdf !== 'undefined' && window.jspdf.jsPDF)
      || (typeof unsafeWindow !== 'undefined' && unsafeWindow.jspdf && unsafeWindow.jspdf.jsPDF);

    if (!jsPDFCtor) throw new Error('jsPDF not loaded — check @require');

    // We'll create the doc with the first image's dimensions, then resize per page
    let doc = null;

    for (let i = 0; i < imageBuffers.length; i++) {
      await waitWhilePaused();
      if (abortFlag) throw new Error('Aborted');

      // jsPDF accepts raw bytes and detects JPEG/PNG/WebP from the file header,
      // which avoids a large base64 string per page and a decode via <img>
      const bytes = new Uint8Array(imageBuffers[i]);
      const props = jsPDFCtor.API.getImageProperties(bytes);
      const w = props.width, h = props.height;

      // Convert pixels → mm at 96 dpi  (1px = 0.2646mm)
      const mmW = w * 0.2646;
      const mmH = h * 0.2646;

      if (!doc) {
        // First page — create doc sized to this image
        doc = new jsPDFCtor({
          orientation: mmW > mmH ? 'landscape' : 'portrait',
          unit: 'mm',
          format: [mmW, mmH]
        });
      } else {
        // Subsequent pages — add a new page sized to this image
        doc.addPage([mmW, mmH], mmW > mmH ? 'landscape' : 'portrait');
      }

      doc.addImage(bytes, props.fileType, 0, 0, mmW, mmH, '', 'FAST');

      if (onProgress) onProgress(i + 1, imageBuffers.length);
      await sleep(0); // yield so the progress bar can repaint between pages
    }

    if (!doc) throw new Error('No pages added to PDF');
    return doc.output('blob');
  }

  // ── Page scraping ─────────────────────────────────────────────────────────────

  const isDetailsPage = () => location.href.includes('/pc/details/');
  const isViewerPage  = () => location.href.includes('/pc/view/');

  function getChaptersFromPage() {
    const seen = new Set();
    return [...document.querySelectorAll('a[href*="/pc/view/index.php?zjid="]')]
      .map(a => ({
        zjid:  new URL(a.href).searchParams.get('zjid'),
        label: a.textContent.trim()
      }))
      .filter(ch => ch.zjid && !seen.has(ch.zjid) && seen.add(ch.zjid));
  }

  // Image URLs in document order, made absolute against `baseUrl` (the parsed
  // chapter page may use protocol-relative or relative src attributes)
  function extractImageUrls(doc, baseUrl) {
    const seen = new Set();
    return [...doc.querySelectorAll(`img[src*="${IMG_HOST}/manhua/"]`)]
      .map(img => {
        try { return new URL(img.getAttribute('src'), baseUrl).href; } catch { return null; }
      })
      .filter(url => url && !seen.has(url) && seen.add(url));
  }

  function getImagesFromViewerDOM() {
    return extractImageUrls(document, location.href);
  }

  function fetchChapterImageUrls(zjid) {
    const url = `https://www.zerobywai.com/pc/view/index.php?zjid=${encodeURIComponent(zjid)}`;
    return withRetry(() => new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET', url,
        timeout: 20000,
        headers: { 'Referer': 'https://www.zerobywai.com/' },
        onload(r) {
          if (r.status < 200 || r.status >= 300) {
            reject(new Error(`HTTP ${r.status} fetching chapter ${zjid}`));
            return;
          }
          const doc = new DOMParser().parseFromString(r.responseText, 'text/html');
          resolve(extractImageUrls(doc, r.finalUrl || url));
        },
        onerror()   { reject(new Error(`Network error fetching chapter ${zjid}`)); },
        ontimeout() { reject(new Error(`Timeout fetching chapter ${zjid}`)); }
      });
    }), `chapter ${zjid}`);
  }

  // ── Core chapter download ─────────────────────────────────────────────────────
  // mode: 'jpg' | 'pdf'
  // onProgress(done, total, failed)
  async function downloadChapter(zjid, label, imageUrls, mode, onProgress) {
    if (!imageUrls || imageUrls.length === 0) {
      imageUrls = await fetchChapterImageUrls(zjid);
    }
    if (imageUrls.length === 0) throw new Error('找不到圖片 No images found (login/VIP required?)');

    const title   = getMangaTitle();
    const chLabel = chapterTag(label);

    if (mode === 'pdf') {
      return downloadChapterAsPdf(title, chLabel, label, imageUrls, onProgress);
    } else {
      return downloadChapterAsJpg(title, chLabel, imageUrls, onProgress);
    }
  }

  // JPG mode — parallel download via GM_download
  async function downloadChapterAsJpg(title, chLabel, imageUrls, onProgress) {
    let done = 0, failed = 0;

    const tasks = imageUrls.map((url, i) => async () => {
      const ext      = imageExtension(url);
      const pageNum  = String(i + 1).padStart(3, '0');
      const filename = `${title}_ch${chLabel}_${pageNum}.${ext}`;
      try {
        await saveJpg(url, filename);
      } catch (err) {
        console.warn('[zbw-dl] JPG failed:', url, err.message);
        failed++;
      }
      done++;
      if (onProgress) onProgress(done, imageUrls.length, failed);
    });

    await pool(tasks, CONCURRENT_DOWNLOADS);
    if (abortFlag) throw new Error('Aborted');
    return { done, total: imageUrls.length, failed };
  }

  // PDF mode — fetch all images in parallel, then assemble PDF sequentially
  async function downloadChapterAsPdf(title, chLabel, label, imageUrls, onProgress) {
    let done = 0, failed = 0;

    // Phase 1: fetch all images as ArrayBuffers in parallel
    // We need them all in memory before building the PDF
    const buffers = new Array(imageUrls.length).fill(null);

    const fetchTasks = imageUrls.map((url, i) => async () => {
      try {
        buffers[i] = await fetchArrayBuffer(url);
      } catch (err) {
        console.warn('[zbw-dl] PDF fetch failed:', url, err.message);
        failed++;
      }
      done++;
      if (onProgress) onProgress(done, imageUrls.length * 2, failed); // phase 1 = first half
    });

    setStatus(`📡 第${label}章：正在獲取圖片 / Ch.${label}: fetching images…`);
    await pool(fetchTasks, CONCURRENT_DOWNLOADS);

    if (abortFlag) throw new Error('Aborted');

    // Phase 2: build PDF (sequential — jsPDF is synchronous per page)
    const validBuffers = buffers.filter(Boolean);
    if (validBuffers.length === 0) throw new Error('All image fetches failed');

    setStatus(`🖨 第${label}章：正在生成 PDF… / Ch.${label}: building PDF…`);

    const pdfBlob = await buildPdf(validBuffers, (pdfDone, pdfTotal) => {
      // Phase 2 maps to the second half of the progress bar, scaled so it still
      // reaches 100 % when some pages failed to fetch in phase 1
      const n = imageUrls.length;
      if (onProgress) onProgress(n + Math.round(pdfDone * n / pdfTotal), n * 2, failed);
    });

    const filename = `${title}_ch${chLabel}.pdf`;
    triggerBlobSave(pdfBlob, filename);

    return { done: imageUrls.length, total: imageUrls.length, failed };
  }

  // ── UI helpers ────────────────────────────────────────────────────────────────

  function setStatus(msg) {
    const el = document.getElementById('zbw-status');
    if (el) el.textContent = msg;
    console.log('[zbw-dl]', msg);
  }

  function setProgress(done, total) {
    const wrap = document.getElementById('zbw-progress-wrap');
    const bar  = document.getElementById('zbw-bar');
    const lbl  = document.getElementById('zbw-bar-label');
    if (!wrap) return;
    wrap.style.display = 'block';
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    bar.style.width = pct + '%';
    lbl.textContent = `${done} / ${total}`;
  }

  function hideProgress() {
    const el = document.getElementById('zbw-progress-wrap');
    if (el) el.style.display = 'none';
  }

  function makeBtn(text, color, onClick) {
    const btn = document.createElement('button');
    btn.textContent = text;
    Object.assign(btn.style, {
      background: color, color: '#fff', border: 'none',
      borderRadius: '5px', padding: '7px 10px',
      cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap', flexShrink: '0'
    });
    btn.onmouseenter = () => btn.style.filter = 'brightness(85%)';
    btn.onmouseleave = () => btn.style.filter = '';
    btn.onclick = onClick;
    return btn;
  }

  // ── Run controls (Pause / Abort) ──────────────────────────────────────────────

  function setPaused(val) {
    isPaused = val;
    document.querySelectorAll('.zbw-pause-btn').forEach(btn => {
      btn.textContent = isPaused ? '▶ 繼續 Resume' : '⏸ 暫停 Pause';
      btn.style.background = isPaused ? '#28a745' : '#6c757d';
    });
    if (isPaused && isDownloading) setStatus('⏸ 已暫停 Paused — 進行中的請求會先完成 in-flight requests will finish first');
  }

  function buildRunControls(container) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:5px;';
    const pauseBtn = makeBtn('', '#6c757d', () => { if (isDownloading) setPaused(!isPaused); });
    pauseBtn.className = 'zbw-pause-btn';
    const abortBtn = makeBtn('⛔ 中止 Abort', '#dc3545', () => { abortFlag = true; setPaused(false); });
    pauseBtn.style.flex = abortBtn.style.flex = '1';
    row.append(pauseBtn, abortBtn);
    container.appendChild(row);
    setPaused(false);
  }

  // ── Format toggle (JPG / PDF) ─────────────────────────────────────────────────

  // onChange() is called after the user switches format, so callers can re-label buttons
  function buildFormatToggle(container, onChange) {
    const wrap = document.createElement('div');
    wrap.style.cssText = `
      display:flex; align-items:center; gap:0;
      background:#f0f0f0; border-radius:6px; padding:3px;
      margin-bottom:8px; width:fit-content;
    `;

    const label = document.createElement('span');
    label.textContent = '輸出格式 Format：';
    label.style.cssText = 'font-size:11px;color:#555;margin-right:6px;white-space:nowrap;';

    function makeToggleBtn(text, mode) {
      const btn = document.createElement('button');
      btn.textContent = text;
      btn.dataset.mode = mode;
      Object.assign(btn.style, {
        border: 'none', borderRadius: '4px', padding: '5px 14px',
        fontSize: '12px', fontWeight: '600', cursor: 'pointer',
        transition: 'background .15s, color .15s',
        background: 'transparent', color: '#555'
      });
      btn.onclick = () => {
        if (isDownloading) return; // the running job keeps the mode it started with
        outputMode = mode;
        saveOutputMode(mode);
        updateToggle();
        if (onChange) onChange();
      };
      return btn;
    }

    const jpgBtn = makeToggleBtn('🖼 JPG', 'jpg');
    const pdfBtn = makeToggleBtn('📄 PDF', 'pdf');

    function updateToggle() {
      [jpgBtn, pdfBtn].forEach(b => {
        const active = b.dataset.mode === outputMode;
        b.style.background = active ? '#007bff' : 'transparent';
        b.style.color       = active ? '#fff'    : '#555';
      });
    }
    updateToggle();

    wrap.append(label, jpgBtn, pdfBtn);
    container.appendChild(wrap);
  }

  function refreshDlBtnLabel(btn, n) {
    const modeLabel = outputMode === 'pdf' ? 'PDF' : 'JPG';
    btn.textContent = n === 0
      ? `⬇ 下載已選 Download Selected [${modeLabel}]`
      : `⬇ 下載已選 Download Selected (${n}) [${modeLabel}]`;
  }

  // ── Main UI scaffold ──────────────────────────────────────────────────────────

  function createUI() {
    const openBtn = document.createElement('button');
    openBtn.id = 'zbw-open-btn';
    openBtn.textContent = '📥';
    openBtn.title = '開啟下載面板 Open download panel (Ctrl/Cmd+O)';
    Object.assign(openBtn.style, {
      position: 'fixed', top: '50%', right: '0',
      transform: 'translateY(-50%)',
      width: '46px', height: '46px',
      borderRadius: '50% 0 0 50%',
      background: '#007bff', color: '#fff',
      border: 'none', cursor: 'pointer',
      fontSize: '20px', zIndex: '9999',
      boxShadow: '-2px 0 8px rgba(0,0,0,.5)'
    });

    const panel = document.createElement('div');
    panel.id = 'zbw-panel';
    Object.assign(panel.style, {
      position: 'fixed', bottom: '0', right: '-440px',
      width: '420px', maxHeight: '80vh',
      background: '#fff', color: '#000',
      border: '1px solid #bbb', borderRadius: '10px 0 0 0',
      boxShadow: '-4px -4px 16px rgba(0,0,0,.25)',
      zIndex: '10000', padding: '14px 14px 10px',
      transition: 'right .3s ease',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'system-ui, sans-serif', fontSize: '13px',
      boxSizing: 'border-box'
    });

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <strong style="font-size:14px">📦 漫畫下載 Manga Downloader</strong>
        <button id="zbw-close-btn" title="關閉 Close (Ctrl+Q)"
          style="background:none;border:none;font-size:22px;cursor:pointer;line-height:1;padding:0;color:#666">✕</button>
      </div>
      <div id="zbw-status"
        style="margin-bottom:6px;color:#555;min-height:16px;font-size:12px;word-break:break-all;line-height:1.4"></div>
      <div id="zbw-progress-wrap" style="display:none;margin-bottom:8px">
        <div style="background:#e9ecef;height:14px;border-radius:7px;overflow:hidden;position:relative">
          <div id="zbw-bar" style="background:#28a745;height:100%;width:0%;transition:width .15s"></div>
          <span id="zbw-bar-label"
            style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#000"></span>
        </div>
      </div>
      <div id="zbw-controls" style="display:flex;flex-direction:column;gap:0;overflow-y:auto;flex:1;min-height:0"></div>
    `;

    document.body.appendChild(openBtn);
    document.body.appendChild(panel);

    openBtn.onclick = () => { panel.style.right = '0'; openBtn.style.display = 'none'; };
    panel.querySelector('#zbw-close-btn').onclick = () => {
      panel.style.right = '-440px'; openBtn.style.display = '';
    };
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault(); panel.style.right = '0'; openBtn.style.display = 'none';
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'q') {
        e.preventDefault(); panel.style.right = '-440px'; openBtn.style.display = '';
      }
    });

    return panel;
  }

  // ── Details page ──────────────────────────────────────────────────────────────

  function buildDetailsControls(panel) {
    const controls = panel.querySelector('#zbw-controls');
    const chapters = getChaptersFromPage();

    if (!chapters.length) { setStatus('找不到章節 No chapters found.'); return; }

    // Format toggle
    buildFormatToggle(controls, () => updateCount());

    // ── Toolbar ───────────────────────────────────────────────────────────────
    const toolbar = document.createElement('div');
    toolbar.style.cssText = `
      display:flex; align-items:center; gap:5px; flex-wrap:wrap;
      padding:6px 0 8px; border-bottom:1px solid #e0e0e0; margin-bottom:6px;
    `;

    const btnAll  = makeBtn('☑ 全選 All',  '#6c757d', () => setAllChecked(true));
    const btnNone = makeBtn('☐ 清除 None', '#6c757d', () => setAllChecked(false));

    const rangeInput = document.createElement('input');
    rangeInput.type        = 'text';
    rangeInput.placeholder = '例 e.g. 1-5, 8, 10-12';
    rangeInput.title       = '按章節號碼選擇範圍 / Select by chapter range';
    Object.assign(rangeInput.style, {
      flex: '1', minWidth: '0', padding: '5px 7px',
      border: '1px solid #ccc', borderRadius: '4px',
      fontSize: '12px', boxSizing: 'border-box',
      background: '#fff', color: '#000'
    });
    rangeInput.addEventListener('keydown', e => { if (e.key === 'Enter') applyRange(); });

    const btnRange = makeBtn('套用 Go', '#6c757d', applyRange);

    toolbar.append(btnAll, btnNone, rangeInput, btnRange);
    controls.appendChild(toolbar);

    // Count label
    const countLbl = document.createElement('div');
    countLbl.style.cssText = 'font-size:11px;color:#888;padding:3px 0 4px;';
    controls.appendChild(countLbl);

    // Download Selected button
    const dlSelBtn = document.createElement('button');
    dlSelBtn.id = 'zbw-dl-sel-btn';
    Object.assign(dlSelBtn.style, {
      width: '100%', padding: '9px',
      background: '#007bff', color: '#fff',
      border: 'none', borderRadius: '5px',
      cursor: 'pointer', fontSize: '13px',
      fontWeight: '600', margin: '2px 0 4px'
    });
    dlSelBtn.onmouseenter = () => dlSelBtn.style.filter = 'brightness(85%)';
    dlSelBtn.onmouseleave = () => dlSelBtn.style.filter = '';
    refreshDlBtnLabel(dlSelBtn, 0);
    controls.appendChild(dlSelBtn);

    buildRunControls(controls);

    // Concurrency note
    const note = document.createElement('div');
    note.textContent = `⚡ ${CONCURRENT_DOWNLOADS} 個平行下載 parallel downloads per chapter`;
    note.style.cssText = 'font-size:11px;color:#888;margin:3px 0 6px;';
    controls.appendChild(note);

    // ── Chapter checklist ──────────────────────────────────────────────────────
    const listWrap = document.createElement('div');
    listWrap.style.cssText = 'display:flex;flex-direction:column;gap:2px;overflow-y:auto;flex:1;min-height:0;background:#fff;';
    controls.appendChild(listWrap);

    const chapterRows = new Map();

    chapters.forEach(ch => {
      const row = document.createElement('label');
      row.style.cssText = `
        display:flex; align-items:center; gap:7px;
        padding:5px 7px; border-radius:4px; cursor:pointer;
        border:1px solid transparent; user-select:none;
        background:#fff; color:#000;
      `;
      row._baseColor = '#fff';
      row.onmouseenter = () => { if (!isDownloading) row.style.background = '#f0f4ff'; };
      row.onmouseleave = () => row.style.background = row._baseColor;

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.style.cssText = 'width:14px;height:14px;cursor:pointer;flex-shrink:0;accent-color:#007bff';

      const lbl = document.createElement('span');
      lbl.textContent = `第 ${ch.label} 章  Ch.${ch.label}`;
      lbl.style.cssText = 'flex:1;font-size:12px;color:#000;';

      const badge = document.createElement('span');
      badge.style.cssText = 'font-size:11px;min-width:20px;text-align:right;flex-shrink:0;color:#000;';

      row.append(cb, lbl, badge);
      listWrap.appendChild(row);
      chapterRows.set(ch.zjid, { row, cb, badge });
    });

    listWrap.addEventListener('change', updateCount);

    // ── Helpers ────────────────────────────────────────────────────────────────

    function getChecked() {
      return chapters.filter(ch => chapterRows.get(ch.zjid).cb.checked);
    }

    function setAllChecked(val) {
      chapters.forEach(ch => { chapterRows.get(ch.zjid).cb.checked = val; });
      updateCount();
    }

    function updateCount() {
      const n = getChecked().length;
      countLbl.textContent = n === 0
        ? '未選擇任何章節 No chapters selected'
        : `已選 ${n} 章 / ${n} chapter${n > 1 ? 's' : ''} selected`;
      refreshDlBtnLabel(dlSelBtn, n);
    }

    // Matches on the chapter's number rather than its raw label, so "1-3" selects
    // "01", "02", "第3話"; ranges are inclusive and may be written backwards
    function applyRange() {
      const raw = rangeInput.value.trim();
      if (!raw) return;
      const ranges = [];
      raw.split(/[,，]/).forEach(part => {
        part = part.trim();
        const m = part.match(/^(\d+(?:\.\d+)?)\s*[-–~]\s*(\d+(?:\.\d+)?)$/);
        if (m) {
          const a = parseFloat(m[1]), b = parseFloat(m[2]);
          ranges.push([Math.min(a, b), Math.max(a, b)]);
        } else if (/^\d+(?:\.\d+)?$/.test(part)) {
          const n = parseFloat(part);
          ranges.push([n, n]);
        }
      });
      if (!ranges.length) { setStatus('⚠️ 範圍格式無效 Invalid range, e.g. 1-5, 8'); return; }
      chapters.forEach(ch => {
        const n = chapterNumber(ch.label);
        chapterRows.get(ch.zjid).cb.checked = ranges.some(([lo, hi]) => n >= lo && n <= hi);
      });
      updateCount();
    }

    // ── Download handler ───────────────────────────────────────────────────────

    dlSelBtn.onclick = async () => {
      if (isDownloading) return;
      const selected = getChecked();
      if (!selected.length) { setStatus('⚠️ 未選擇任何章節 No chapters selected.'); return; }

      isDownloading = true;
      abortFlag     = false;
      dlSelBtn.disabled = true;

      const mode = outputMode;
      let chaptersFailed = 0;

      try {
        // Pre-fetch image lists, a few chapters at a time to avoid flooding the site
        setStatus(`📡 正在獲取 ${selected.length} 個章節的頁面列表… / Fetching page lists…`);
        const imageMap = new Map();
        await pool(selected.map(ch => async () => {
          try {
            imageMap.set(ch.zjid, await fetchChapterImageUrls(ch.zjid));
          } catch (err) {
            console.warn('[zbw-dl] page list failed:', ch.zjid, err.message);
            imageMap.set(ch.zjid, []);
          }
        }), CONCURRENT_DOWNLOADS);

        // PDF progress doubles (fetch + build); JPG is single phase
        const unitsFor = ch => (imageMap.get(ch.zjid)?.length || 0) * (mode === 'pdf' ? 2 : 1);
        const grandTotal = selected.reduce((sum, ch) => sum + unitsFor(ch), 0);
        let finishedUnits = 0; // units of chapters already completed (or skipped)
        setProgress(0, grandTotal);

        for (const ch of selected) {
          await waitWhilePaused();
          if (abortFlag) break;

          const { row, badge } = chapterRows.get(ch.zjid);
          const imageUrls = imageMap.get(ch.zjid) || [];

          if (!imageUrls.length) {
            badge.textContent = '❌'; badge.title = '找不到圖片 No images (login/VIP required?)';
            row.style.background = row._baseColor = '#fff0f0';
            chaptersFailed++;
            continue;
          }

          badge.textContent = '⏳';
          row.style.background = row._baseColor = '#fff8e1';

          try {
            const result = await downloadChapter(ch.zjid, ch.label, imageUrls, mode,
              (done, total, failed) => {
                const overall = finishedUnits + done;
                setProgress(overall, grandTotal);
                setStatus(
                  `第${ch.label}章 Ch.${ch.label}: ${done}/${total}` +
                  (failed ? ` (${failed} ❌)` : '') +
                  ` — 合計 total ${overall}/${grandTotal}`
                );
              }
            );
            const ok = result.failed === 0;
            if (!ok) chaptersFailed++;
            badge.textContent = ok ? '✅' : `⚠️${result.failed}`;
            badge.title = `${result.done - result.failed}/${result.total} 頁 pages`;
            row.style.background = row._baseColor = ok ? '#f0fff4' : '#fff3cd';
          } catch (err) {
            chaptersFailed++;
            badge.textContent = abortFlag ? '⛔' : '❌'; badge.title = err.message;
            row.style.background = row._baseColor = '#fff0f0';
          }

          finishedUnits += unitsFor(ch);
          await sleep(CHAPTER_GAP_MS);
        }

        if (abortFlag) setStatus('⛔ 已中止 Aborted.');
        else if (chaptersFailed) setStatus(`⚠️ 完成，但有 ${chaptersFailed} 章出錯 Done with ${chaptersFailed} problem chapter(s) — hover the badges for details`);
        else setStatus(mode === 'pdf'
          ? '✅ 完成 Done — PDF 已儲存 PDFs saved'
          : '✅ 完成 Done — 檔案已儲存至 Files saved to ~/Downloads');
      } catch (err) {
        setStatus(`❌ ${err.message}`);
      } finally {
        hideProgress();
        setPaused(false);
        isDownloading     = false;
        dlSelBtn.disabled = false;
      }
    };

    setStatus(`找到 ${chapters.length} 個章節 / Found ${chapters.length} chapter(s). Select and download.`);
    updateCount();
  }

  // ── Viewer page ───────────────────────────────────────────────────────────────

  function buildViewerControls(panel) {
    const controls = panel.querySelector('#zbw-controls');
    const zjid     = new URL(location.href).searchParams.get('zjid');
    const parts    = (document.title || '').split('-').map(s => s.trim()).filter(Boolean);
    const label    = parts.length >= 2 ? parts[parts.length - 2] : zjid;

    setStatus(`閱讀頁面 — 第 "${label}" 章 / Viewer — chapter "${label}"`);

    // Format toggle
    buildFormatToggle(controls, () => updateViewerBtn());

    const note = document.createElement('div');
    note.textContent = `⚡ ${CONCURRENT_DOWNLOADS} 個平行下載 parallel downloads`;
    note.style.cssText = 'font-size:11px;color:#888;margin:2px 0 8px;';
    controls.appendChild(note);

    const dlBtn = document.createElement('button');
    Object.assign(dlBtn.style, {
      width: '100%', padding: '9px',
      background: '#007bff', color: '#fff',
      border: 'none', borderRadius: '5px',
      cursor: 'pointer', fontSize: '13px', fontWeight: '600'
    });
    dlBtn.onmouseenter = () => dlBtn.style.filter = 'brightness(85%)';
    dlBtn.onmouseleave = () => dlBtn.style.filter = '';

    function updateViewerBtn() {
      const modeLabel = outputMode === 'pdf' ? 'PDF' : 'JPG';
      dlBtn.textContent = `⬇ 下載本章 Download This Chapter [${modeLabel}]`;
    }
    updateViewerBtn();

    dlBtn.onclick = async () => {
      if (isDownloading) return;
      isDownloading  = true;
      abortFlag      = false;
      dlBtn.disabled = true;
      const mode = outputMode;
      dlBtn.textContent = mode === 'pdf'
        ? '⏳ 正在生成 PDF… Building PDF…'
        : '⏳ 下載中… Downloading…';

      const imgs = getImagesFromViewerDOM();
      try {
        const result = await downloadChapter(zjid, label, imgs.length ? imgs : null, mode,
          (done, total) => {
            setProgress(done, total);
            setStatus(`第${label}章 Ch.${label}: ${done}/${total}`);
          }
        );
        setStatus(abortFlag
          ? '⛔ 已中止 Aborted.'
          : `✅ 第${label}章: ${result.done - result.failed}/${result.total} 頁已儲存 pages saved`);
      } catch (err) {
        setStatus(abortFlag ? '⛔ 已中止 Aborted.' : `❌ ${err.message}`);
      } finally {
        hideProgress();
        setPaused(false);
        isDownloading    = false;
        dlBtn.disabled   = false;
        updateViewerBtn();
      }
    };

    controls.appendChild(dlBtn);
    buildRunControls(controls);
  }

  // ── Init ──────────────────────────────────────────────────────────────────────

  function init() {
    const panel = createUI();
    if (isDetailsPage())     buildDetailsControls(panel);
    else if (isViewerPage()) buildViewerControls(panel);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
