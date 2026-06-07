// ==UserScript==
// @name         zerobywai 漫畫下載
// @version      1.2.0
// @namespace    https://github.com/YOUR_USERNAME/zerobywai-mangadl
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
// @downloadURL  https://raw.githubusercontent.com/YOUR_USERNAME/zerobywai-mangadl/main/zerobywai-mangadl.user.js
// @updateURL    https://raw.githubusercontent.com/YOUR_USERNAME/zerobywai-mangadl/main/zerobywai-mangadl.user.js
// ==/UserScript==

/*
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

  // ── State ─────────────────────────────────────────────────────────────────────
  let isDownloading = false;
  let abortFlag     = false;
  let outputMode    = 'jpg'; // 'jpg' | 'pdf'
  let globalDone    = 0;
  let globalTotal   = 0;

  // ── Utilities ─────────────────────────────────────────────────────────────────

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function safeFilename(s) {
    return (s || 'manga').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
  }

  function getMangaTitle() {
    return safeFilename(
      document.title.replace(/\s*[-–]\s*zero搬运网.*$/i, '').trim()
    ) || 'manga';
  }

  // Concurrency pool — runs tasks[] with at most `concurrency` in flight
  async function pool(tasks, concurrency) {
    let idx = 0;
    async function worker() {
      while (idx < tasks.length) {
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

  // ArrayBuffer → base64 string (needed by jsPDF)
  function bufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
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
      return new Promise((resolve, reject) => {
        GM_download({
          url, name: filename,
          headers: { 'Referer': 'https://www.zerobywai.com/' },
          onload()    { resolve(); },
          onerror(e)  { reject(new Error(`GM_download: ${JSON.stringify(e)}`)); },
          ontimeout() { reject(new Error('Timeout')); }
        });
      });
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
      if (abortFlag) throw new Error('Aborted');

      const buf    = imageBuffers[i];
      const b64    = bufferToBase64(buf);
      const imgSrc = 'data:image/jpeg;base64,' + b64;

      // Get image dimensions via a temporary Image element
      const { w, h } = await new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => resolve({ w: 800, h: 1200 }); // fallback
        img.src = imgSrc;
      });

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

      doc.addImage(imgSrc, 'JPEG', 0, 0, mmW, mmH, '', 'FAST');

      if (onProgress) onProgress(i + 1, imageBuffers.length);
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

  function getImagesFromViewerDOM() {
    return [...document.querySelectorAll('img[src*="tupa.zerobywai.com/manhua/"]')]
      .map(img => img.src).filter(Boolean);
  }

  function fetchChapterImageUrls(zjid) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: `https://www.zerobywai.com/pc/view/index.php?zjid=${zjid}`,
        timeout: 20000,
        headers: { 'Referer': 'https://www.zerobywai.com/' },
        onload(r) {
          const doc  = new DOMParser().parseFromString(r.responseText, 'text/html');
          const urls = [...doc.querySelectorAll('img[src*="tupa.zerobywai.com/manhua/"]')]
            .map(img => img.getAttribute('src')).filter(Boolean);
          resolve(urls);
        },
        onerror()   { reject(new Error(`Network error fetching chapter ${zjid}`)); },
        ontimeout() { reject(new Error(`Timeout fetching chapter ${zjid}`)); }
      });
    });
  }

  // ── Core chapter download ─────────────────────────────────────────────────────
  // mode: 'jpg' | 'pdf'
  // onProgress(done, total, failed)
  async function downloadChapter(zjid, label, imageUrls, mode, onProgress) {
    if (!imageUrls || imageUrls.length === 0) {
      imageUrls = await fetchChapterImageUrls(zjid);
    }
    if (imageUrls.length === 0) throw new Error('No images found');

    const title   = getMangaTitle();
    const chLabel = label.replace(/\s+/g, '_');

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
      const ext      = (url.split('.').pop().split('?')[0] || 'jpg').toLowerCase();
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
      // Phase 2 maps to the second half of the progress bar
      const total = imageUrls.length * 2;
      if (onProgress) onProgress(imageUrls.length + pdfDone, total, failed);
    });

    const filename = `${title}_ch${chLabel}.pdf`;
    triggerBlobSave(pdfBlob, filename);

    return { done: validBuffers.length, total: imageUrls.length, failed };
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

  // ── Format toggle (JPG / PDF) ─────────────────────────────────────────────────

  function buildFormatToggle(container) {
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
        outputMode = mode;
        updateToggle();
        // update the main download button label
        const dlSelBtn = document.getElementById('zbw-dl-sel-btn');
        if (dlSelBtn) {
          const n = parseInt(dlSelBtn.dataset.count || '0', 10);
          refreshDlBtnLabel(dlSelBtn, n);
        }
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
    buildFormatToggle(controls);

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
    dlSelBtn.dataset.count = '0';
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

    controls.appendChild(makeBtn('⛔ 中止 Abort', '#dc3545', () => { abortFlag = true; }));

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
      dlSelBtn.dataset.count = String(n);
      countLbl.textContent = n === 0
        ? '未選擇任何章節 No chapters selected'
        : `已選 ${n} 章 / ${n} chapter${n > 1 ? 's' : ''} selected`;
      refreshDlBtnLabel(dlSelBtn, n);
    }

    function applyRange() {
      const raw = rangeInput.value.trim();
      if (!raw) return;
      const targets = new Set();
      raw.split(',').forEach(part => {
        part = part.trim();
        const m = part.match(/^(\d+)\s*[-–]\s*(\d+)$/);
        if (m) {
          for (let i = parseInt(m[1], 10); i <= parseInt(m[2], 10); i++) targets.add(String(i));
        } else if (/^\d+$/.test(part)) {
          targets.add(part);
        }
      });
      if (!targets.size) return;
      chapters.forEach(ch => { chapterRows.get(ch.zjid).cb.checked = targets.has(ch.label); });
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

      // Pre-fetch all image lists in parallel
      setStatus(`📡 正在獲取 ${selected.length} 個章節的頁面列表… / Fetching page lists…`);
      const imageMap = new Map();
      await Promise.all(selected.map(async ch => {
        try {
          imageMap.set(ch.zjid, await fetchChapterImageUrls(ch.zjid));
        } catch (err) {
          imageMap.set(ch.zjid, []);
        }
      }));

      // PDF progress doubles (fetch + build); JPG is single phase
      globalTotal = selected.reduce((s, ch) => {
        const n = imageMap.get(ch.zjid)?.length || 0;
        return s + (mode === 'pdf' ? n * 2 : n);
      }, 0);
      globalDone = 0;
      setProgress(0, globalTotal);

      for (const ch of selected) {
        if (abortFlag) { setStatus('⛔ 已中止 Aborted.'); break; }

        const { row, badge } = chapterRows.get(ch.zjid);
        const imageUrls = imageMap.get(ch.zjid) || [];

        if (!imageUrls.length) {
          badge.textContent = '❌'; badge.title = 'No images';
          continue;
        }

        badge.textContent = '⏳';
        row.style.background = row._baseColor = '#fff8e1';

        try {
          const result = await downloadChapter(ch.zjid, ch.label, imageUrls, mode,
            (done, total, failed) => {
              globalDone++;
              setProgress(globalDone, globalTotal);
              setStatus(
                `第${ch.label}章 Ch.${ch.label}: ${done}/${total}` +
                (failed ? ` (${failed} ❌)` : '') +
                ` — 合計 total ${globalDone}/${globalTotal}`
              );
            }
          );
          const ok = result.failed === 0;
          badge.textContent = ok ? '✅' : `⚠️${result.failed}`;
          badge.title = `${result.done - result.failed}/${result.total} 頁 pages`;
          row.style.background = row._baseColor = ok ? '#f0fff4' : '#fff3cd';
        } catch (err) {
          badge.textContent = '❌'; badge.title = err.message;
          row.style.background = row._baseColor = '#fff0f0';
        }

        await sleep(CHAPTER_GAP_MS);
      }

      setStatus(`✅ 完成 Done — 檔案已儲存至 Files saved to ~/Downloads`);
      hideProgress();
      isDownloading     = false;
      dlSelBtn.disabled = false;
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
    buildFormatToggle(controls);

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

    // Re-label whenever format toggle changes
    const origBuildFormatToggle = buildFormatToggle;
    const modeObserver = new MutationObserver(updateViewerBtn);
    modeObserver.observe(controls, { childList: true, subtree: true });

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
        setStatus(`✅ 第${label}章: ${result.done - result.failed}/${result.total} 頁已儲存 pages saved`);
      } catch (err) {
        setStatus(`❌ ${err.message}`);
      }

      hideProgress();
      isDownloading    = false;
      dlBtn.disabled   = false;
      updateViewerBtn();
    };

    controls.appendChild(dlBtn);
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
