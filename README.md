# zerobywai 漫畫下載

A Tampermonkey userscript that downloads manga chapters from [zerobywai.com](https://www.zerobywai.com) as individual JPG files or as one PDF per chapter, ready for use with [Kindle Comic Converter (KCC)](https://github.com/ciromattia/kcc).

> **Fork note:** This is a community patch of [Mccranky83/byw-mangadl](https://github.com/Mccranky83/byw-mangadl), rewritten to support the site's new PC frontend (`/pc/details/` and `/pc/view/`), and fixed for Firefox + Tampermonkey compatibility.

> **📌 Merging upstream:** After the site's redesign broke the original script, I still wanted to download manga to read on my Kindle, so I asked Claude (an AI assistant) to fix it for the new site. I'm now trying to merge this work back into [Mccranky83/byw-mangadl](https://github.com/Mccranky83/byw-mangadl) so it lives in one place. Once it's merged, please install from there; this repository will then be retired.
>
> 網站改版後原腳本失效，而我仍想下載漫畫推送到 Kindle 閱讀，於是請 Claude（AI 助手）協助修正。現正嘗試把這些改動合併回原作者的 [Mccranky83/byw-mangadl](https://github.com/Mccranky83/byw-mangadl)，合併後請改從該項目安裝，本倉庫屆時將停止維護。

---

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) for your browser
   - [Firefox](https://addons.mozilla.org/firefox/addon/tampermonkey/)
   - [Chrome / Edge / Brave](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)

2. Click the link below to install the script directly:

   **[⬇ Install zerobywai-mangadl.user.js](zerobywai-mangadl.user.js)**

3. Tampermonkey will open an install confirmation page — click **Install**.

---

## Usage

### From the details page (recommended)
Navigate to any manga details page, e.g.:
```
https://www.zerobywai.com/pc/details/?kuid=20119
```

A **📥 button** appears on the right edge of the screen. Click it (or press **Ctrl/Cmd + O**) to open the download panel.

1. Choose the output format: **🖼 JPG** (one file per page) or **📄 PDF** (one file per chapter). Your choice is remembered.
2. Tick the chapters you want, or use the toolbar:
   - **☑ All** / **☐ None** — select or clear every chapter
   - **Range box** — type e.g. `1-5, 8, 10-12` and press **Go** or Enter. Ranges match the chapter *number*, so `1-3` selects `01`, `02` and `第3話`; reversed ranges such as `12-10` also work.
3. Click **⬇ Download Selected**. Chapters are processed one after another, with several pages fetched in parallel.
4. **⏸ Pause** holds new requests until you press **▶ Resume**; **⛔ Abort** stops the run. In both cases, requests already in flight finish first.

Each chapter row shows its result: ✅ complete, ⚠️*n* with *n* missing pages, ❌ failed. Hover over a badge for details. Failed requests are retried up to three times with back-off before a page is counted as missing.

### From the viewer/reader page
Navigate to any chapter viewer, e.g.:
```
https://www.zerobywai.com/pc/view/index.php?zjid=620389
```
Open the panel, choose JPG or PDF, and click **Download This Chapter**.

### Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl` / `Cmd` + `O` | Open panel |
| `Ctrl` + `Q` | Close panel |

> **Mac note:** Avoid `Cmd+Q` — that quits your browser. Use `Ctrl+Q` to close the panel.

---

## Output

**JPG mode** — files are saved directly to your **`~/Downloads`** folder by Tampermonkey's `GM_download` API, with no save dialogue per file.

**PDF mode** — each chapter is assembled in the browser with [jsPDF](https://github.com/parallax/jsPDF) and saved through the browser's normal download mechanism. Every PDF page is sized to its image.

Naming convention:
```
MangaTitle_ch001_001.jpg
MangaTitle_ch001_002.jpg
MangaTitle_ch002_001.jpg
MangaTitle_ch002.pdf
...
```

Numeric chapter labels are zero-padded to three digits so that files sort correctly. Non-numeric labels (e.g. `番外`) are kept as they are.

---

## Converting for Kindle

Use [Kindle Comic Converter (KCC)](https://github.com/ciromattia/kcc):

1. Download and install KCC
2. Drag the downloaded folder of JPGs into KCC
3. Select your Kindle model
4. Click **Convert** — KCC outputs a `.mobi` or `.epub` file
5. Transfer to your Kindle via USB or Send-to-Kindle

---

## Why JPG/PDF instead of ZIP?

The original script packed chapters into ZIP archives with JSZip. In the Tampermonkey sandbox on Firefox, ZIP generation could hang indefinitely and never complete. Rather than fight the sandbox, this script uses Tampermonkey's native `GM_download` API for individual pages (the most reliable cross-browser way to save binary files from a userscript) and jsPDF, which runs on the main thread, for PDFs.

---

## Firefox: allow downloads

The first time the script runs, Firefox may show a permission bar asking whether to allow Tampermonkey to download files. Click **Allow**. Subsequent downloads are silent.

---

## Compatibility

| Browser | Status |
|---------|--------|
| Firefox + Tampermonkey | ✅ Tested |
| Chrome + Tampermonkey | ✅ Should work |
| Edge + Tampermonkey | ✅ Should work |
| Violentmonkey | ⚠️ Untested — `GM_download` behaviour may differ |
| Greasemonkey | ❌ Not supported (`GM_download` unavailable) |

---

## Development

The script is a single file with no build step: edit `zerobywai-mangadl.user.js` and reinstall it in Tampermonkey.

Automated tests load the script into Chromium against a mocked copy of the site (no real network traffic):

```sh
npm install
npx playwright install chromium   # once
npm test
```

To reuse a Chromium you already have, set `CHROMIUM_PATH=/path/to/chrome`. Tests also run on every push and pull request through GitHub Actions.

## Contributing

This work is being proposed for merging into [Mccranky83/byw-mangadl](https://github.com/Mccranky83/byw-mangadl). Once that happens, please contribute there instead. Until then, pull requests here are welcome. If the site updates and the script breaks, please [open an issue](../../issues) with:
- The URL that is no longer working
- What you see vs. what you expect
- Browser and Tampermonkey version

---

## Credits

- Original script: [Mccranky83/byw-mangadl](https://github.com/Mccranky83/byw-mangadl)
- Site structure patch and Firefox fixes: this repository

---

## License

[MIT](LICENSE)
