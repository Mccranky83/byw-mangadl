import mangadl from "../MangaDl.js";
import { fetchT } from "./req.js";

export default async function (img, chap_dirname, chap_dir, c, m, tr) {
  const attr = location.hostname.includes("ant") ? "data-src" : "src";
  const url = $(img).attr(attr);
  const filename = url.split("/").reverse()[0];
  const timeout = 60_000;
  const wait = 5_000;
  const retry = mangadl.retry;
  const hide_retry_logs = true;
  if (location.href.includes("ant")) await ant_f();
  else await zero_f();

  async function ant_f(r = 0) {
    await fetchT(url, { method: "GET" }, timeout)
      .then((res) => {
        if (!res.ok) throw new Error();
        else return res.arrayBuffer();
      })
      .then((res) => {
        if (res.byteLength > 10) {
          chap_dir.file(filename, res, { binary: true });
          c.sc++;
          tr.page.success++;
        } else throw new Error();
      })
      .catch(async () => {
        if (r < retry) {
          await new Promise((res) => {
            setTimeout(res, wait);
            hide_retry_logs &&
              console.log(
                `${chap_dirname}的${filename}重試次數: ${r + 1}/${retry}次`,
              );
          });
          await ant_f(++r);
        } else {
          console.log(`${chap_dirname}的${filename}: Failed to download...`);
          c.fc++;
          tr.page.failed++;
          m(filename);
        }
      });
  }

  async function zero_f(r = 0) {
    await new Promise(async (resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url,
        responseType: "arraybuffer",
        timeout,
        onload: (res) => {
          if (res.response.byteLength > 10) {
            chap_dir.file(filename, res.response, { binary: true });
            c.sc++;
            tr.page.success++;
            resolve();
          } else reject();
        },
        onerror: reject,
        ontimeout: reject,
      });
    }).catch(async () => {
      if (r < retry) {
        await new Promise((res) => {
          setTimeout(res, wait);
        });
        await zero_f(++r);
      } else {
        c.fc++;
        tr.page.failed++;
        m(filename);
      }
    });
  }
}
