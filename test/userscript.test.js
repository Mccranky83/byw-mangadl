// End-to-end tests: loads the userscript into Chromium against a mocked zerobywai.com.
// Run with `npm test` (needs `npx playwright install chromium` once).
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const SCRIPT = fs.readFileSync(
  path.join(__dirname, "..", "byw-mangadl.user.js"),
  "utf8",
);
const JSPDF = fs.readFileSync(require.resolve("jspdf/dist/jspdf.umd.min.js"));
// 1×1 PNG served for every manga page image
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const DETAILS_HTML = `<html><head><meta charset="utf-8"><title>測試漫畫 - zero搬运网</title></head><body>
  <a href="/pc/view/index.php?zjid=11">01</a>
  <a href="/pc/view/index.php?zjid=12">02</a>
  <a href="/pc/view/index.php?zjid=13">第3話</a>
  <a href="/pc/view/index.php?zjid=11">01</a></body></html>`;
const chapterHtml = (zjid, title = "測試漫畫 - 01 - zero搬运网") =>
  `<html><head><meta charset="utf-8"><title>${title}</title></head><body>${[
    1, 2, 3,
  ]
    .map(
      (i) =>
        `<img src="//tupa.zerobywai.com/manhua/${zjid}/${String(i).padStart(3, "0")}.jpg">`,
    )
    .join("")}</body></html>`;

// Minimal Tampermonkey API backed by fetch(); records saved filenames in window.__saved
const GM_STUBS = `
  window.__saved = [];
  window.GM_xmlhttpRequest = o => {
    fetch(o.url).then(async r => o.onload({
      status: r.status, finalUrl: o.url,
      response: o.responseType === 'arraybuffer' ? await r.arrayBuffer() : null,
      responseText: o.responseType === 'arraybuffer' ? '' : await r.text(),
    })).catch(e => o.onerror && o.onerror(e));
  };
  window.GM_download = o => {
    fetch(o.url).then(r => {
      if (!r.ok) return o.onerror({ error: 'http ' + r.status });
      window.__saved.push(o.name); o.onload();
    }).catch(e => o.onerror(e));
  };
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.download) window.__saved.push(this.download); else click.call(this);
  };
`;

let browser;
// CHROMIUM_PATH lets you reuse an existing Chromium instead of Playwright's download
before(async () => {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
});
after(async () => {
  await browser.close();
});

// Opens `url` with the userscript installed; `failPaths` are image paths that return 404
async function openPage(url, { failPaths = [] } = {}) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e));
  await page.route("**/*", (route) => {
    const u = new URL(route.request().url());
    const html = (body) =>
      route.fulfill({ body, contentType: "text/html; charset=utf-8" });
    if (u.hostname === "tupa.zerobywai.com") {
      return failPaths.some((p) => u.pathname.endsWith(p))
        ? route.fulfill({ status: 404, body: "" })
        : route.fulfill({ body: PNG, contentType: "image/png" });
    }
    if (u.pathname.startsWith("/pc/details/")) return html(DETAILS_HTML);
    if (u.pathname.startsWith("/pc/view/"))
      return html(chapterHtml(u.searchParams.get("zjid")));
    return route.fulfill({ status: 404, body: "" });
  });
  await page.goto(url);
  await page.addScriptTag({ content: JSPDF.toString() });
  await page.evaluate(GM_STUBS);
  // A runaway script would never return here, so bound the wait
  await Promise.race([
    page.evaluate(SCRIPT),
    new Promise((_, rej) =>
      setTimeout(() => rej(new Error("userscript init hung")), 5000),
    ),
  ]);
  await page.click("#zbw-open-btn");
  await page.waitForFunction(
    () =>
      document.getElementById("zbw-panel").getBoundingClientRect().right <=
      innerWidth,
  );
  return { page, errors };
}

const DETAILS = "https://www.zerobywai.com/pc/details/?kuid=1";
const VIEWER = "https://www.zerobywai.com/pc/view/index.php?zjid=11";

const clickButton = (page, text) =>
  page.locator("#zbw-panel button", { hasText: text }).first().click();
const waitForIdle = (page) =>
  page.waitForFunction(
    () =>
      !document.getElementById("zbw-dl-sel-btn")?.disabled &&
      ![...document.querySelectorAll("#zbw-panel button")].some(
        (b) => b.disabled,
      ),
    null,
    { timeout: 30000 },
  );
const saved = (page) => page.evaluate(() => window.__saved.slice().sort());
const status = (page) => page.textContent("#zbw-status");
const badges = (page) =>
  page.$$eval("#zbw-controls label span:last-child", (els) =>
    els.map((e) => e.textContent),
  );

async function selectRange(page, range) {
  await page.fill("#zbw-controls input[type=text]", range);
  await clickButton(page, "Go");
}

test("details page lists each chapter once", async () => {
  const { page, errors } = await openPage(DETAILS);
  assert.equal(await page.locator("#zbw-controls label").count(), 3);
  assert.deepEqual(errors, []);
  await page.close();
});

test("range matches chapter numbers, including padded and reversed ranges", async () => {
  const { page } = await openPage(DETAILS);
  await selectRange(page, "3-2");
  const checked = await page.$$eval(
    "#zbw-controls input[type=checkbox]",
    (cbs) => cbs.map((c) => c.checked),
  );
  assert.deepEqual(checked, [false, true, true]);
  await page.close();
});

test("JPG mode saves zero-padded page files for selected chapters", async () => {
  const { page } = await openPage(DETAILS);
  await selectRange(page, "1");
  await clickButton(page, "Download Selected");
  await waitForIdle(page);
  assert.deepEqual(await saved(page), [
    "測試漫畫_ch001_001.jpg",
    "測試漫畫_ch001_002.jpg",
    "測試漫畫_ch001_003.jpg",
  ]);
  assert.match(await status(page), /Done/);
  await page.close();
});

test("PDF mode saves one PDF per chapter and the choice is remembered", async () => {
  const { page } = await openPage(DETAILS);
  await clickButton(page, "PDF");
  await selectRange(page, "1-3");
  await clickButton(page, "Download Selected");
  await waitForIdle(page);
  assert.deepEqual(await saved(page), [
    "測試漫畫_ch001.pdf",
    "測試漫畫_ch002.pdf",
    "測試漫畫_ch第3話.pdf",
  ]);
  assert.equal(
    await page.evaluate(() => localStorage.getItem("zbw-dl-format")),
    "pdf",
  );
  await page.close();
});

test(
  "a missing page is retried, then reported without failing the run",
  { timeout: 60000 },
  async () => {
    const { page } = await openPage(DETAILS, { failPaths: ["/12/002.jpg"] });
    await selectRange(page, "2");
    await clickButton(page, "Download Selected");
    await waitForIdle(page);
    assert.deepEqual(await saved(page), [
      "測試漫畫_ch002_001.jpg",
      "測試漫畫_ch002_003.jpg",
    ]);
    assert.deepEqual(await badges(page), ["", "⚠️1", ""]);
    assert.match(await status(page), /1 problem chapter/);
    await page.close();
  },
);

test("pause holds new requests until resumed", async () => {
  const { page } = await openPage(DETAILS);
  await selectRange(page, "1-3");
  await clickButton(page, "Download Selected");
  await clickButton(page, "Pause");
  const countWhilePaused = (await saved(page)).length;
  await page.waitForTimeout(1500);
  assert.equal(
    (await saved(page)).length,
    countWhilePaused,
    "downloads continued while paused",
  );
  await clickButton(page, "Resume");
  await waitForIdle(page);
  assert.equal((await saved(page)).length, 9);
  await page.close();
});

test("viewer page loads without hanging and downloads the open chapter", async () => {
  const { page, errors } = await openPage(VIEWER);
  await clickButton(page, "PDF");
  assert.match(
    await page
      .locator("#zbw-panel button", { hasText: "Download This Chapter" })
      .textContent(),
    /\[PDF\]/,
  );
  await clickButton(page, "Download This Chapter");
  await waitForIdle(page);
  assert.deepEqual(await saved(page), ["測試漫畫_ch001.pdf"]);
  assert.deepEqual(errors, []);
  await page.close();
});
