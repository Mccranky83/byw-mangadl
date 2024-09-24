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
            this.chap_num = this.chap_list.length;
            this.chap_dllist = [];
            this.entry_chap = 0;
            this.end_chap = 0;
            this.max_chap_par = 0;
            this.max_img_par = 0;
            this.dling = false;
            this.zip = {};
          }

          init() {
            this.dling = false;
            this.entry_chap = 0;
            this.end_chap = 0;
            this.max_chap_par = 0;
            this.max_img_par = 0;
            this.chap_dllist = [];
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
        createSidebar();
        createMenu();
        manualSelect();

        function createSidebar() {
          const html = `
            <button id="sidebar-open-btn">菜單</button>
            <div id="uk-sidebar">
              <div class="titlebar">
                <button id="sidebar-close-btn">&times;</button>
                <h2>菜單</h2>
              </div>
              <div class="uk-container"></div>
            </div>
          `;
          const css = `
            #sidebar-open-btn {
              --sidebar-diameter: 50px;
              position: fixed;
              top: 50%;
              right: 0%;
              width: var(--sidebar-diameter);
              height: var(--sidebar-diameter);
              font-size: 16px;
              border-radius: 50%;
              background-color: #007bff;
              color: white;
              border: none;
              cursor: pointer;
              z-index: 1000;
              display: flex;
              align-items: center;
              justify-content: center;
              text-overflow: ellipsis;
              white-space: nowrap;
            } 
            #sidebar-open-btn.hidden {
              display: none;
            }
            #uk-sidebar {
              position: fixed;
              top: 0;
              right: -100%;
              width: 30%;
              max-width: 50%;
              height: 100%;
              background-color: white;
              color: black;
              padding: 20px;
              transition: right 0.3s ease;
              box-shadow: -2px 0 5px rgba(0, 0, 0, 0.5);
              z-index: 100;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
            }
            #uk-sidebar .titlebar {
              font-size: 25px;
              margin-bottom: auto;
            }
            #uk-sidebar .uk-container {
              margin-top: 10%;
              flex-grow: 1;
            }
            #uk-sidebar.active {
              right: 0%;
            }
            #sidebar-close-btn {
              position: absolute;
              top: 10px;
              right: 20px;
              font-size: 30px;
              background: none;
              border: none;
              color: black;
              cursor: pointer;
            }
          `;
          const styles = $("<style>", { tyle: "text/css" }).html(css);
          $("body").css({
            "overflow-x": "hidden",
          });
          $("body:last-child").after(html);
          $(document.head).append(styles);

          let dragging = false;
          const $sidebar = $("#uk-sidebar");
          const $sidebarBtn = $("#sidebar-open-btn");
          const $closeBtn = $("#sidebar-close-btn");

          $(document).on("keydown", ({ key, ctrlKey }) => {
            if (key === "o" && ctrlKey) {
              $sidebar.addClass("active");
              $sidebarBtn.addClass("hidden");
            }
          });

          $(document).on("keydown", ({ key, ctrlKey }) => {
            if (key === "q" && ctrlKey) {
              $sidebar.removeClass("active");
              $sidebarBtn.removeClass("hidden");
            }
          });

          $closeBtn.on("click", () => {
            $sidebar.removeClass("active");
            $sidebarBtn.removeClass("hidden");
          });

          $sidebarBtn.on("mousedown", ({ clientX, clientY }) => {
            // Calculate offset between mouse and element border
            const btn_rect = $sidebarBtn[0].getBoundingClientRect();
            const shiftX = clientX - btn_rect.left;
            const shiftY = clientY - btn_rect.top;

            $(document).on("mousemove", onMouseMove);
            $sidebarBtn.on("mouseup", () => {
              if (!dragging) {
                $sidebar.addClass("active");
                $sidebarBtn.addClass("hidden");
              } else dragging = false;
              $(document).off("mousemove", onMouseMove);
              $sidebarBtn.off("mouseup");
            });

            /**
             * pageX/Y returns the absolute position
             * However, $sidebarBtn's position is fixed
             * Using clientX/Y instead
             */
            function onMouseMove({ clientX, clientY }) {
              dragging = true;
              $sidebarBtn.css({
                left: clientX - shiftX + "px",
                top: clientY - shiftY + "px",
              });
            }
          });
        }

        function createMenu() {
          let entry = [],
            end = [];
          mangadl.chap_list.forEach((cur, i) => {
            entry.push(`
              <option value="${i}" ${i ? "" : "selected"}>
                ${cur.number}
              </option>`);
            end.push(`
              <option value="${i}" ${i === mangadl.chap_num - 1 ? "selected" : ""}>
                ${cur.number}
              </option>`);
          });
          const MAX_CHAP_PAR = 5;
          const MAX_IMG_PAR_MULTI = 4;
          const chap_par = [...Array(MAX_CHAP_PAR)].map(
            (_, i) => `
              <option value=${i + 1} ${i === MAX_CHAP_PAR - 1 ? "selected" : ""}>${i + 1}</option>
            `,
          );
          const img_par = [...Array(MAX_IMG_PAR_MULTI)].map(
            (_, i) => `
              <option value=${(i + 1) * 5} ${i === MAX_IMG_PAR_MULTI - 1 ? "selected" : ""}>${(i + 1) * 5}</option>
            `,
          );
          entry.join("\n");
          end.join("\n");
          const menu_html = `
            <div id="injected">
              <div>
                <span>開始：</span>
                <select name="entry" class="uk-select">${entry}</select>
                <span>結束：</span>
                <select name="end" class="uk-select">${end}</select>
              </div>
              <div class="tooltip-container">
                <span>併發章節數：</span>
                <select name="chap-par" class="uk-select">${chap_par}</select>
                <button class="tooltip-button">?</button>
                <div class="tooltip-text">
                  <p>Bigger the value, larger the number of concurrent chapter fetches. But because the browser can only handle a limited number of concurrent requests, it is recommended to use the options listed below.</p>
                  <p>數值越大，同時下載章節的數量就越多。但由於瀏覽器只能處理有限的並發請求，建議使用以下選項。</p>
                </div>
              </div>
              <div class="tooltip-container">
                <span>併發圖片數：</span>
                <select name="img-par" class="uk-select">${img_par}</select>
                <button class="tooltip-button">?</button>
                <div class="tooltip-text">
                  <p>Bigger the value, larger the number of concurrent image fetches. But because the browser can only handle a limited number of concurrent requests, it is recommended to use the options listed below.</p>
                  <p>數值越大，同時下載圖片的數量就越多。但由於瀏覽器只能處理有限的並發請求，建議使用以下選項。</p>
                </div>
              </div>
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
                <a href="javascript:;" class="uk-button uk-button-primary" id="manual-select">
                  <span>手動選擇</span>
                </a>
              </div>
            </div>
      `;
          $("div#uk-sidebar .uk-container").append(menu_html);
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
              .tooltip-container {
                  position: relative;
                  display: inline-block;
                  margin-top: 10px;
              }
              .tooltip-button {
                  width: 20px;
                  height: 20px;
                  border-radius: 50%;
                  background-color: #007bff;
                  color: white;
                  border: none;
                  font-size: 10px;
                  text-align: center;
                  line-height: 20px;
                  cursor: pointer;
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
              }
              .tooltip-text {
                  visibility: hidden;
                  width: 250px;
                  background-color: #555;
                  color: #fff;
                  text-align: left;
                  border-radius: 5px;
                  padding: 10px;
                  position: absolute;
                  z-index: 500;
                  right: 0%;
                  top: 100%;
                  white-space: normal;
              } 
              .tooltip-button:hover + .tooltip-text {
                  visibility: visible;
                  opacity: 1;
              }
              .tooltip-text p {
                  margin: 0 0 10px;
              } 
              .tooltip-text p:last-child {
                  margin-bottom: 0;
              }
            `;
            const style = $("<style>", { type: "text/css" }).html(css);
            $(document.head || document.documentElement).append(style);
          })();
        }

        function manualSelect() {
          const html = `
            <div id="cursor-pointer"> </div>
          `;
          const css = `
            #cursor-pointer {
              position: fixed;
              pointer-events: none;
              display: none;
            }
            #cursor-pointer {
              --cursor-diameter: 20px;
              width: var(--cursor-diameter);
              height: var(--cursor-diameter);
              border-radius: 50%;
              background-color: blue;
              opacity: 0.5;
            }
          `;
          $(document.body).append(html);
          $("<style>", { type: "text/css" }).html(css).appendTo(document.head);

          const $button = $("#manual-select");
          const $cursor = $("#cursor-pointer");
          let f = false;
          $button.on("click", (e) => {
            !f ? showCursor(e) : hideCursor();
          });
          $(document).on("mousemove", ({ clientX, clientY }) => {
            if (f) {
              $("#cursor-pointer").css({
                left: clientX - 10 + "px",
                top: clientY - 10 + "px",
              });
            }
          });
          $(document).on("keydown", ({ key }) => {
            key === "Escape" && hideCursor();
          });
          $(document).on("click", ".muludiv", function (e) {
            if (f) {
              e.preventDefault();
              $(e.currentTarget)[0].style.backgroundColor
                ? $(this).css("background-color", "")
                : $(this).css("background-color", "#7fbbb3");
            }
          });

          function showCursor({ clientX, clientY }) {
            f = true;
            $cursor.show();
            $cursor.css({
              left: clientX - 10 + "px",
              top: clientY - 10 + "px",
            });
          }

          function hideCursor() {
            f = false;
            $cursor.hide();
          }
        }

        function dlAll() {
          if ($("#mangadl-all").attr("dling")) {
            $("#mangadl-all").text("下載中稍等..");
            return;
          } else {
            mangadl.init();
            mangadl.dling = true;
            $("#mangadl-all").attr("dling", mangadl.dling).text("下載中");
          }

          // Fetch select values
          $(".muludiv").each((i, cur) => {
            $(cur).css("background-color") === "rgb(127, 187, 179)" &&
              mangadl.chap_dllist.push(mangadl.chap_list[i]);
          });

          if (!mangadl.chap_dllist.length) {
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
          }
          mangadl.max_chap_par = Number($("#injected [name='chap-par']").val());
          mangadl.max_img_par = Number($("#injected [name='img-par']").val());

          limitParDl(mangadl.chap_dllist, getImgList, [], mangadl.max_chap_par)
            .then(() => {
              mangadl.zip
                .generateAsync({
                  type: "blob",
                  compression: "STORE",
                })
                .then((zipFile) => {
                  saveAs(zipFile, `${mangadl.manga_name}.zip`);
                  $("#mangadl-all").removeAttr("dling").text("打包下載");
                });
            })
            .finally(() => {
              $(".muludiv").css("background-color", "");
            });
        }

        class Semaphore {
          constructor(max_par) {
            this.counter = max_par;
            this.waitlist = [];
          }
          async acquire() {
            if (this.counter > 0) {
              this.counter--;
              return;
            }
            await new Promise((res) => this.waitlist.push(res));
          }

          release() {
            this.counter++;
            if (this.waitlist.length > 0) {
              this.counter--;
              this.waitlist.shift()();
            }
          }
        }

        async function limitParDl(items, fn, args, max_par) {
          const s = new Semaphore(max_par);
          await Promise.all(
            items.map(async (cur) => {
              await s.acquire();
              await fn(cur, ...args).finally(s.release.bind(s));
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
                const imgs = $nodes.find(".uk-zjimg img").toArray();
                const img_num = imgs.length;
                const m = (() => {
                  let missing_pgs = "";
                  return (str) => {
                    missing_pgs = [missing_pgs, str].join("\n");
                    return missing_pgs.trim();
                  };
                })();
                const c = (() => {
                  let count = 0;
                  return (flag) => {
                    !flag && ++count;
                    return count;
                  };
                })();
                await limitParDl(
                  imgs,
                  dlImg,
                  [chap_dir, c, m],
                  mangadl.max_img_par,
                );
                try {
                  if (!c(true)) console.log(`${chap_dirname}: all clear!`);
                  else
                    throw new Error(
                      `${chap_dirname}缺失頁：${c(true)}/${img_num}`,
                    );
                } catch (e) {
                  console.error(e.message);
                  const filename = "不完整下載.txt";
                  chap_dir.file(filename, fmtLogs(`${e.message}\n${m()}`));
                }
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

        async function dlImg(img, chap_dir, c, m) {
          const attr = location.hostname.includes("ant") ? "data-src" : "src";
          const url = $(img).attr(attr);
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
                if (retry < 3) {
                  await new Promise((res) => {
                    setTimeout(res, 5_000);
                  });
                  await f(++retry);
                } else {
                  c();
                  m(filename);
                }
              });
          };
          await f();
        }

        function fmtLogs(msg) {
          const lines = msg.trim().split("\n");
          const gist = lines.slice(0, 1);
          const content = lines
            .slice(1)
            .sort()
            .reduce((acc, cur, i) => {
              !(i % 5) && acc.push([]);
              acc[acc.length - 1].push(cur.padStart(10, " "));
              return acc;
            }, [])
            .map((cur) => cur.join(""));
          return [...gist, ...content].join("\n");
        }

        function fetchT(url, options, timeout) {
          const c = new AbortController();
          const signal = c.signal;
          const fetch_p = fetch(url, { ...options, signal }).catch(() => {});
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
