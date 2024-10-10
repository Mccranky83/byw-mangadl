# byw-manga downloader

<img src="https://www.google.com/s2/favicons?sz=64&domain=zerobywz.com" height="80" align="right"/>

Download manga from the following sources as zip archives :package:

- [zerobyw](https://antbyw.github.io/)
- [antbyw](https://antbyw.github.io/)

## Preview

![Sidebar menu](https://raw.githubusercontent.com/Mccranky83/byw-mangadl/master/Preview.png)

## Installation

- [Download from GitHub](https://github.com/Mccranky83/byw-mangadl/raw/main/antbyw-mangadl.user.js)

## Usage

1. Search for the manga you want to download.
2. Press `打包下載`
3. Coffee break ~ :coffee:
4. Return to find your manga in the `~/Downloads` folder

## Development Environment

| Browser                                                                                                   | [Tampermonkey](http://tampermonkey.net/)                                            |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [Chromium](https://github.com/ungoogled-software/ungoogled-chromium-macos/releases/tag/129.0.6668.89-1.1) | [5.3.0](https://chrome.google.com/webstore/detail/dhdgffkkebhmkfjojejmpbldmpobfkfo) |

## How It Works

This script uses the Fetch API and `GM_xmlhttpRequest` to send HTTP requests and receive payloads as `ArrayBuffers`. It then packages these `ArrayBuffers` into a ZIP file using [JSZip](https://github.com/Stuk/jszip) and saves the file to your computer using [FileSaver.js](https://github.com/eligrey/FileSaver.js).

## Warning

Payloads of returned requests are presumably stored in the RAM, **NOT** on your hard disk. In order to prevent the script from creating an `ArrayBuffer` larger than the memory allocation the tab holds, the cap is hardcoded to `512 * 2^30`, roughly around 0.5 GB.

When that limit is exceeded, a new JSZip object is created and the previous ones are saved on the fly (interval being 500ms).
