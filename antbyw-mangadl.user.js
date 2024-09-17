// ==UserScript==
// @name         antbyw下载
// @namespace    http://tampermonkey.net/
// @version      2024-09-10
// @description  下载单行本漫画
// @author       mccranky
// @match        http://*/plugin.php?id=jameson_manhua*a=bofang*kuid*
// @match        http://*/plugin.php?id=jameson_manhua*kuid*a=bofang*
// @match        https://*/plugin.php?id=jameson_manhua*a=bofang*kuid*
// @match        https://*/plugin.php?id=jameson_manhua*kuid*a=bofang*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=antbyw.com
// @grant        none
// ==/UserScript==

"use strict";

window.addEventListener("load", async () => {
  const scripts = [
    "https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.0/FileSaver.min.js",
  ];
  await Promise.all(
    scripts.map(
      (cur) =>
        new Promise((res, rej) => {
          const script = document.createElement("script");
          script.src = cur;
          script.onload = res;
          script.onerror = rej;
          (document.head || document.documentElement).appendChild(script);
        }),
    ),
  )
    .then(() => {
      console.log("scripts successfully loaded...");
      (() => {
        class MangaDl {
          constructor() {
            this.chap_info = this.getChapterInfo();
            this.manga_name = this.chap_info.manga_name;
            this.chap_list = this.chap_info.chap_list;
            this.chap_dllist = [];
            this.entry_chap = 0;
            this.end_chap = 0;
            this.dling = false;
            this.zip = {};
          }

          init() {
            this.dling = false;
            this.entry_chap = 0;
            this.end_chap = 0;
            this.zip = new JSZip();
          }
          getChapterInfo() {
            const title = $(".uk-switcher .uk-heading-line").text();
            let manga_name_jp = "";
            let manga_name_zh = "";
            if (title.includes("【")) {
              manga_name_jp = title.match(/(?<=【)[^[【】]+(?=】)/g)[1];
              manga_name_zh = title.split("【")[0];
            } else {
              manga_name_zh = title.split(" ")[0];
            }
            const manga_name =
              manga_name_zh +
              (manga_name_jp ? "｜" + manga_name_jp : manga_name_jp);
            let chap_list = [];
            const push_chap = (selector) => {
              $(selector).each((_, cur) => {
                const url = [
                  window.location.protocol,
                  "//",
                  window.location.host,
                  "/",
                  $(cur).attr("href"),
                ].join("");
                chap_list.push({
                  number: $(cur).text().padStart(2, "0"),
                  url,
                });
              });
            };
            let selector = "";
            switch (location.hostname.includes("ant")) {
              case true:
                selector =
                  ".uk-container ul.uk-switcher .muludiv a.uk-button-default";
                break;
              case false:
                selector = ".uk-grid-collapse .muludiv a";
                break;
              default:
                break;
            }
            push_chap(selector);
            return { chap_list, manga_name };
          }
        }

        const mangadl = new MangaDl();
        // Creating menu
        (() => {
          let entry = [],
            end = [];
          mangadl.chap_list.forEach((cur, i) => {
            entry.push(`
              <option value="${i}" ${i ? "" : "selected"}>
                ${cur.number}
              </option>`);
            end.push(`
              <option value="${i}" ${i === mangadl.chap_list.length - 1 ? "selected" : ""}>
                ${cur.number}
              </option>`);
          });
          entry.join("\n");
          end.join("\n");
          const menu_html = `
            <div id="injected">
              <span>開始：</span>
              <select name="entry" class="uk-select">${entry}</select>
              <span>結束：</span>
              <select name="end" class="uk-select">${end}</select>
              <br />
              <div class="mtm">
                <a href="javascript:;" class="uk-button uk-button-danger" id="mangadl-all">
                  <span>打包下載</span>
                </a>
                <a href="javascript:;" class="uk-button uk-button-primary none" id="mangadl-retry">
                  <span>重新下載</span>
                </a>
                <a href="javascript:;" class="uk-button uk-button-primary" id="mangadl-seperate">
                  <span>分批下載</span>
                </a>
              </div>
            </div>
      `;
          $("div.uk-width-expand .uk-margin-left").append(menu_html);
          $("#mangadl-all").on("click", dlAll);

          // Adding css styles
          (() => {
            const css = `
              #injected span {
                padding: 2px 8px;
                display: inline;
              }

              #injected select {
                width: 80px;
                height: 30px;
                line-height: 30px;
                border-radius: 2px;
              }
            `;
            const style = $("<style>", { type: "text/css" }).html(css);
            $(document.head || document.documentElement).append(style);
          })();
        })();

        function dlAll() {
          if ($("#mangadl-all").attr("dling")) {
            $("#mangadl-all").text("下載中稍等..");
            return;
          } else {
            mangadl.init();
            mangadl.dling = true;
            $("#mangadl-all").attr("dling", mangadl.dling).text("下載中");
          }

          mangadl.entry_chap = Number($("#injected [name='entry']").val());
          mangadl.end_chap = Number($("#injected [name='end']").val());

          if (mangadl.entry_chap > mangadl.end_chap) {
            [mangadl.entry_chap, mangadl.end_chap] = [
              mangadl.end_chap,
              mangadl.entry_chap,
            ];
          }

          mangadl.chap_dllist = mangadl.chap_list.slice(
            mangadl.entry_chap,
            mangadl.end_chap + 1,
          );
          limitParDl(mangadl.chap_dllist, getImgList, 2).then(() => {
            mangadl.zip
              .generateAsync({
                type: "blob",
                compression: "STORE",
              })
              .then((zipFile) => {
                saveAs(zipFile, `${mangadl.manga_name}.zip`);
                $("#mangadl-all").removeAttr("dling").text("打包下載");
              });
          });
        }

        async function limitParDl(items, fn, max_par) {
          let lock = false;
          let groups = items.reduce((acc, cur, i) => {
            !(i % max_par) && acc.push([]);
            acc[acc.length - 1].push(cur);
            return acc;
          }, []);
          await Promise.all(
            groups.map(async (cur) => {
              while (lock) {
                await new Promise((res) => {
                  setTimeout(res, 1000);
                });
              }
              lock = true;
              await Promise.all(
                cur.map(
                  (cur) =>
                    new Promise(async (res) => {
                      await fn(cur);
                      res();
                    }),
                ),
              );
              lock = false;
            }),
          );
        }

        async function getImgList(chap) {
          const toplv_dirname = mangadl.manga_name;
          const toplv_dir = mangadl.zip.folder(toplv_dirname);
          const chap_zip = new JSZip();
          const chap_dirname = chap.number;
          const chap_dir = chap_zip.folder(chap_dirname);
          await fetchT(chap.url, { method: "GET" }, 10_000)
            .then((res) => {
              if (!res.ok) throw new Error("chapter request failed...");
              else console.log("chapter request successful...");
              return res.text();
            })
            .then(async (res) => {
              const $nodes = $(
                new DOMParser().parseFromString(res, "text/html").body,
              );
              if (!$nodes.find(".wp").length) {
                console.error("failed to load chapter...");
                setTimeout(() => {
                  getImgList(chap);
                  return;
                });
              } else if (!$nodes.find(".jameson_manhua").length) {
                const filename = "權限不足.txt";
                chap_dir.file(
                  filename,
                  "權限不足，請登錄賬戶或使用VIP帳戶！\n",
                );
                genMsgFile(filename);
                await zipChap();
              } else if (!$nodes.find(".uk-zjimg img").length) {
                const filename = "VIP專屬.txt";
                chap_dir.file(filename, "請使用VIP帳戶下載！\n");
                genMsgFile(filename);
                await zipChap();
              } else {
                const attr = location.hostname.includes("ant")
                  ? "data-src"
                  : "src";
                let promises = [];
                $nodes.find(".uk-zjimg img").each((_, cur) => {
                  promises.push(
                    new Promise(async (res) => {
                      await dlImg($(cur).attr(attr), chap_dir);
                      res();
                    }),
                  );
                });
                await Promise.all(promises);
                await zipChap();
                return;
              }

              async function zipChap() {
                const chap_blob = await chap_zip.generateAsync({
                  type: "blob",
                  compression: "DEFLATE",
                  compressionOptions: {
                    level: 6,
                  },
                });
                toplv_dir.file(`${chap_dirname}.zip`, chap_blob, {
                  binary: true,
                });
              }
              function genMsgFile(filename) {
                chap_zip
                  .file(`${chap_dirname}/${filename}`)
                  .async("string")
                  .then((data) => console.error(data));
              }
            })
            .catch((e) => {
              console.error(e.message);
            });
        }

        async function dlImg(url, chap_dir) {
          const filename = url.split("/").reverse()[0];
          const f = async (retry = 0) => {
            await fetchT(url, { method: "GET" }, 10_000)
              .then((res) => {
                if (!res.ok) throw new Error();
                else return res.arrayBuffer();
              })
              .then((res) => {
                if (res.byteLength > 10)
                  chap_dir.file(filename, res, { binary: true });
                else throw new Error();
              })
              .catch(async () => {
                retry < 3 && (await f(++retry));
              });
          };
          await f();
        }

        function fetchT(url, options, timeout) {
          const c = new AbortController();
          const signal = c.signal;
          const fetch_p = fetch(url, { ...options, signal });
          const timeout_p = new Promise((_, rej) => {
            setTimeout(() => {
              c.abort();
              rej(new Error("request timeout..."));
            }, timeout);
          });
          return Promise.race([fetch_p, timeout_p]);
        }
      })();
    })
    .catch(() => console.error("scripts failed to load..."));
});
