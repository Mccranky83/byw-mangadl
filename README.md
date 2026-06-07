# zerobywai 漫畫下載

A Tampermonkey userscript that downloads manga chapters from [zerobywai.com](https://www.zerobywai.com) as individual JPG files, ready for use with [Kindle Comic Converter (KCC)](https://github.com/ciromattia/kcc).

> **Fork note:** This is a community patch of [Mccranky83/byw-mangadl](https://github.com/Mccranky83/byw-mangadl), rewritten to support the site's new PC frontend (`/pc/details/` and `/pc/view/`), and fixed for Firefox + Tampermonkey compatibility.

---

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) for your browser
   - [Firefox](https://addons.mozilla.org/firefox/addon/tampermonkey/)
   - [Chrome / Edge / Brave](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)

2. Click the link below to install the script directly:

   **[⬇ Install zerobywai-mangadl.user.js](https://raw.githubusercontent.com/YOUR_USERNAME/zerobywai-mangadl/main/zerobywai-mangadl.user.js)**

3. Tampermonkey will open an install confirmation page — click **Install**.

---

## Usage

### From the details page (recommended)
Navigate to any manga details page, e.g.:
```
https://www.zerobywai.com/pc/details/?kuid=20119
```

A **📥 button** appears on the right edge of the screen. Click it (or press **Ctrl/Cmd + O**) to open the download panel.

- **Download All** — queues every chapter sequentially
- **Ch.1, Ch.2 …** — download a single chapter

### From the viewer/reader page
Navigate to any chapter viewer, e.g.:
```
https://www.zerobywai.com/pc/view/index.php?zjid=620389
```
Open the panel and click **Download This Chapter**.

### Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl` / `Cmd` + `O` | Open panel |
| `Ctrl` + `Q` | Close panel |

> **Mac note:** Avoid `Cmd+Q` — that quits your browser. Use `Ctrl+Q` to close the panel.

---

## Output

Files are saved directly to your **`~/Downloads`** folder by Tampermonkey's `GM_download` API — no browser save dialog per file.

Naming convention:
```
MangaTitle_ch001_001.jpg
MangaTitle_ch001_002.jpg
MangaTitle_ch002_001.jpg
...
```

---

## Converting for Kindle

Use [Kindle Comic Converter (KCC)](https://github.com/ciromattia/kcc):

1. Download and install KCC
2. Drag the downloaded folder of JPGs into KCC
3. Select your Kindle model
4. Click **Convert** — KCC outputs a `.mobi` or `.epub` file
5. Transfer to your Kindle via USB or Send-to-Kindle

---

## Why individual JPGs instead of ZIP?

`JSZip.generateAsync()` with `DEFLATE` compression internally spawns **Web Workers**, which are blocked inside the Tampermonkey sandbox on Firefox. The result is that ZIP generation hangs forever and never completes. Rather than use `STORE` (uncompressed ZIP) or fight the sandbox, this script uses Tampermonkey's native `GM_download` API, which is the most reliable cross-browser approach for downloading binary files from a userscript.

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

## Contributing

Pull requests are welcome. If the site updates and the script breaks, please [open an issue](../../issues) with:
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
