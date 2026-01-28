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
// @grant        GM_xmlhttpRequest
// @connect      zerobywz.com
// @connect      antbyw.com
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
            if (!$("#mangadl-retry").attr("class").includes("none")) {
              $("#mangadl-retry").addClass("none");
            }
            $("#dl-bar").show();
            $("#dl-progress").show();
            this.entry_chap = 0;
            this.end_chap = 0;
            this.max_chap_par = 0;
            this.max_img_par = 0;
            this.chap_dllist = [];
            this.zip = new JSZip();
            console.clear();
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
        initPB();

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
              z-index: 1000;
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
              <div class="range-container">
                <span>開始：</span>
                <select name="entry" class="uk-select">${entry}</select>
              </div>
              <div class="range-container">
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
              <div class="mtm grid-container">
                <a href="javascript:;" class="uk-button uk-button-danger" id="mangadl-all">
                  <span>打包下載</span>
                </a>
                <a href="javascript:;" class="uk-button uk-button-primary none" style="background-color: black;" id="mangadl-retry">
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
          $("#mangadl-retry").on("click", dlRetry);

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
              .grid-container {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 2%;
              }
              .grid-container .uk-button {
                display: flex;
                justify-content: center;
                align-items: center;
                height: 5vh;
                text-align: center;
                padding: 2%;
                box-sizing: border-box;
              }
              .range-container,
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
                  z-index: 1500;
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
            <div id="cursor-pointer"></div>
            <div id="vertical-line"></div>
            <div id="horizontal-line"></div>
          `;
          const css = `
            #cursor-pointer,
            #vertical-line,
            #horizontal-line {
              position: fixed;
              z-index: 2000;
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
            #vertical-line,
            #horizontal-line {
              background-color: blue;
              opacity: 0.5;
            }
            #vertical-line {
              width: 1px;
              top: 0;
              bottom: 0;
              left: 50%;
              transform: translateX(-50%);
              background: linear-gradient(blue 50%, transparent 50%);
              background-size: 100% 20px;
              animation: moveDown 1s linear infinite;
            }
            #horizontal-line {
              height: 1px;
              left: 0;
              right: 0;
              top: 50%;
              transform: translateY(-50%);
              background: linear-gradient(to right, blue 50%, transparent 50%);
              background-size: 20px 100%;
              animation: moveRight 1s linear infinite;
            }
            @keyframes moveDown {
              0% {
                background-position: 0 0;
              }
              100% {
                background-position: 0 20px;
              }
            }
            @keyframes moveRight {
              0% {
                background-position: 0 0;
              }
              100% {
                background-position: 20px 0;
              }
            }
          `;
          $(document.body).append(html);
          $("<style>", { type: "text/css" }).html(css).appendTo(document.head);

          const $button = $("#manual-select");
          const $cursor = $("#cursor-pointer");
          const $vline = $("#vertical-line");
          const $hline = $("#horizontal-line");
          let f = false;

          $button.on("click", (e) => {
            !f ? showCursor(e) : hideCursor();
          });
          $(document).on("mousemove", ({ clientX, clientY }) => {
            if (f) {
              $cursor.css({
                left: clientX - 10 + "px",
                top: clientY - 10 + "px",
              });
              $vline.css({ left: clientX + "px" });
              $hline.css({ top: clientY + "px" });
            }
          });
          $(document).on("keydown", ({ key }) => {
            key === "Escape" && hideCursor();
          });
          $("#mangadl-all").on("click", hideCursor);
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
            $vline.show();
            $hline.show();
            $cursor.css({
              left: clientX - 10 + "px",
              top: clientY - 10 + "px",
            });
            $vline.css({ left: clientX + "px" });
            $hline.css({ top: clientY + "px" });
          }

          function hideCursor() {
            f = false;
            $cursor.hide();
            $vline.hide();
            $hline.hide();
          }
        }

        function initPB() {
          const css = `
            #dl-bar {
              border: 1px solid black;
              height: 20px;
              width: 400px;
              display: none;
              position: relative;
              background-color: #f3f3f3;
              overflow: hidden;
            }
            #dl-progress-failed {
              height: 100%;
              width: 0%;
              background-color: red;
              position: absolute;
              transition: width 0.5s ease;
            }
            #dl-progress {
              height: 100%;
              width: 0%;
              background-color: green;
              position: absolute;
              transition: width 0.5s ease;
            }
            #dl-info {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              font-size: 12px;
              z-index: 999999;
              color: black;
            }
          `;
          $("<div>", { id: "dl-bar" })
            .html(
              `</div><div id="dl-progress"></div><span id="dl-info"></span><div id="dl-progress-failed">`,
            )
            .appendTo(".uk-width-expand .uk-margin-left");
          $("<span>", { id: "dl-percentage" })
            .text(`0/${mangadl.chap_dllist.length}`)
            .insertAfter("#dl-bar");
          $("<style>", { type: "text/css" }).html(css).appendTo(document.head);
        }

        async function dlAll() {
          if ($("#mangadl-all").attr("dling") || mangadl.dling) {
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

          await dl();
        }

        async function dlRetry() {
          if ($("#mangadl-retry").attr("dling") || mangadl.dling) {
            $("#mangadl-retry").text("下載中稍等..");
            return;
          } else {
            mangadl.dling = true;
            $("#mangadl-retry").attr("dling", mangadl.dling).text("下載中");
          }
          await dl();
        }

        async function dl() {
          const toplv_dir = mangadl.zip.folder(mangadl.manga_name);
          const c_chap = createCounter();
          const m_chap = missingContent();
          const h = {
            get(tar, key) {
              const val = Reflect.get(tar, key);
              if (typeof val === "object") return new Proxy(val, h);
              return val;
            },
            set(tar, key, val) {
              tar[key] = val;
              if (key === "success" || key === "failed" || key === "net") {
                const parent = tar.name;
                if (parent === "page") {
                  const percentage =
                    ((tar.success + tar.failed) / tar.net) * 100;
                  const f_percentage = (tar.failed / tar.net) * 100;
                  $("#dl-progress").css("width", `${percentage}%`);
                  $("#dl-progress-failed").css("width", `${f_percentage}%`);
                  $("#dl-info").text(`${tar.success + tar.failed}/${tar.net}`);
                } else if (parent === "chap") {
                  $("#dl-percentage").text(
                    `${tar.success + tar.failed}/${tar.net}`,
                  );
                }
              }
              return true;
            },
          };
          const tr = new Proxy(
            {
              page: {
                name: "page",
                net: 0,
                success: 0,
                failed: 0,
              },
              chap: {
                name: "chap",
                net: mangadl.chap_dllist.length,
                success: 0,
                failed: 0,
              },
            },
            h,
          );
          await limitParDl(
            mangadl.chap_dllist,
            getImgList,
            [toplv_dir, c_chap, m_chap, tr],
            mangadl.max_chap_par,
          )
            .then(() => {
              try {
                if (!c_chap(true))
                  console.log(`${mangadl.manga_name}: all clear!`);
                else
                  throw new Error(
                    `${mangadl.manga_name}缺失章節：${c_chap(true)}/${mangadl.chap_dllist.length}`,
                  );
              } catch (e) {
                console.error(e.message);
                const filename = "不完整下載.txt";
                toplv_dir.file(filename, fmtLogs(`${e.message}\n${m_chap()}`));
              }
            })
            .then(() => {
              mangadl.zip
                .generateAsync({
                  type: "blob",
                  compression: "STORE",
                })
                .then((zipFile) => {
                  saveAs(zipFile, `${mangadl.manga_name}.zip`);
                  $("#mangadl-all").removeAttr("dling").text("打包下載");
                  $("#mangadl-retry").removeAttr("dling").text("重新下載");
                  $("#mangadl-seperate").removeAttr("dling").text("分批下載");
                  $("#mangadl-retry").removeClass("none");
                });
            })
            .finally(() => {
              $(".muludiv").css("background-color", "");
              $("#dl-bar").hide();
              $("#dl-progress").hide();
              $("#dl-percentage").text("");
              mangadl.dling = false;
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
            if (this.waitlist.length > 0) {
              this.counter--;
              this.waitlist.shift()();
            }

            /*
             * Placed at the end of the method
             * Prevents new acquisitions from bypassing the waitlist
             */

            this.counter++;
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

        async function getImgList(chap, toplv_dir, c_chap, m_chap, tr) {
          const chap_zip = new JSZip();
          const chap_dirname = chap.number;
          const chap_dir = chap_zip.folder(chap_dirname);
          await fetchT(chap.url, { method: "GET" }, 30_000)
            .then((res) => {
              if (!res.ok)
                throw new Error(`${chap_dirname}: chapter request failed...`);
              else
                console.log(`${chap_dirname}: chapter request successful...`);
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
                tr.page.failed++;
                genMsgFile(filename);
                await zipChap();
              } else if (!$nodes.find(".uk-zjimg img").length) {
                const filename = "VIP專屬.txt";
                chap_dir.file(filename, "請使用VIP帳戶下載！\n");
                tr.page.failed++;
                genMsgFile(filename);
                await zipChap();
              } else {
                const imgs = $nodes.find(".uk-zjimg img").toArray();
                const img_num = imgs.length;
                tr.page.net += img_num;
                const m = missingContent();
                const c = new Proxy(
                  { sc: 0, fc: 0 },
                  {
                    get(tar, key) {
                      return Reflect.get(...arguments);
                    },
                    set(tar, key, val) {
                      return Reflect.set(...arguments);
                    },
                  },
                );
                await limitParDl(
                  imgs,
                  dlImg,
                  [chap_dirname, chap_dir, c, m, tr],
                  mangadl.max_img_par,
                );
                try {
                  if (!c.fc) {
                    tr.chap.success++;
                    console.log(`${chap_dirname}: all clear!`);
                  } else
                    throw new Error(
                      `${chap_dirname}缺失頁：${c.fc}/${img_num}`,
                    );
                } catch (e) {
                  console.error(e.message);
                  const filename = "不完整下載.txt";
                  chap_dir.file(filename, fmtLogs(`${e.message}\n${m()}`));
                  tr.chap.failed++;
                  c_chap();
                  m_chap(chap_dirname);
                }
                await zipChap();
                return;
              }
            })
            .catch((e) => {
              console.error(e.message);
            });

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
        }

        async function dlImg(img, chap_dirname, chap_dir, c, m, tr) {
          const attr = location.hostname.includes("ant") ? "data-src" : "src";
          const url = $(img).attr(attr);
          const filename = url.split("/").reverse()[0];
          const timeout = 60_000;
          const wait = 5_000;
          const retry = 3;
          const hide_retry_logs = true; // Pending feature
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
                  console.log(
                    `${chap_dirname}的${filename}: Failed to download...`,
                  );
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

        function createCounter() {
          let count = 0;
          return (flag) => {
            !flag && ++count;
            return count;
          };
        }

        function missingContent() {
          let missing = "";
          return (str) => {
            missing = [missing, str].join("\n");
            return missing.trim();
          };
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
