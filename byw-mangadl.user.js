// ==UserScript==
// @name         byw漫畫下載
// @version      2024-10-17
// @namespace    mccranky83.github.io
// @description  下載搬運網單行本漫畫
// @author       mccranky
// @match        http://*/plugin.php?id=jameson_manhua*a=bofang*kuid*
// @match        http://*/plugin.php?id=jameson_manhua*kuid*a=bofang*
// @match        https://*/plugin.php?id=jameson_manhua*a=bofang*kuid*
// @match        https://*/plugin.php?id=jameson_manhua*kuid*a=bofang*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=antbyw.com
// @grant        GM_xmlhttpRequest
// @connect      zerobywz.com
// @updateURL    https://github.com/Mccranky83/byw-mangadl/raw/main/byw-mangadl.meta.js
// @downloadURL  https://github.com/Mccranky83/byw-mangadl/raw/main/byw-mangadl.user.js
// @license      MIT
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
            this.zip = [];
            this.storing = new this.Mutex();
            this.retry = 0;
            this.updating = new this.Mutex();
            this.net_chap = 0;
          }

          Mutex = class {
            constructor() {
              this.locked = false;
              this.queue = [];
            }
            async lock() {
              return new Promise((res) => {
                if (this.locked) this.queue.push(res);
                else {
                  this.locked = true;
                  res();
                }
              });
            }
            unlock() {
              if (this.queue.length) this.queue.shift()();
              else this.locked = false;
            }
          };

          init() {
            if (!$("#mangadl-retry").attr("class").includes("none")) {
              $("#mangadl-retry").addClass("none");
            }
            this.entry_chap = 0;
            this.end_chap = 0;
            this.max_chap_par = 0;
            this.max_img_par = 0;
            this.chap_dllist = [];
            this.zip = [];
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
              <div class="abort-dialog">Click <a href="javascript:;">here</a> to force save downloaded images&period;</div>
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
              bottom: 0;
              right: -100%;
              width: 30%;
              max-width: 50%;
              height: 60%;
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
            .abort-dialog a {
              color: #cc0000;
              cursor: pointer;
            }
            #uk-sidebar .abort-dialog {
              width: 100%;
              background: rgba(0, 0, 0, 0.75);
              color: white;
              padding: 10px;
              box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
              text-align: center;
              position: absolute;
              top: 0;
              left: 0;
              border: 1px solid black;
              opacity: 0;
              transition: opacity 0.5s ease, bottom 0.5s ease;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              display: inline-block;
              max-width: 100%;
            }
            #uk-sidebar:hover .abort-dialog {
              opacity: 1;
            }
            #uk-sidebar .titlebar {
              font-size: 25px;
              margin-bottom: auto;
              margin-top: 50px;
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
              top: 40px;
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
          const MAX_IMG_PAR_MULTI = 20;
          const chap_par = [...Array(MAX_CHAP_PAR)].map(
            (_, i) => `
              <option value=${i + 1} ${i === MAX_CHAP_PAR - 1 ? "selected" : ""}>${i + 1}</option>
            `,
          );
          const img_par = [...Array(MAX_CHAP_PAR)].map(
            (_, i) => `
              <option value=${i + 1} ${i === MAX_CHAP_PAR - 1 ? "selected" : ""}>${(i + 1) * MAX_IMG_PAR_MULTI}</option>
            `,
          );
          const retry = [...Array(10)].map(
            (_, i) => `
              <option value=${i + 1} ${i === 4 ? "selected" : ""}>${i + 1}</option>
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
                <span>重試：</span>
                <select name="retry" class="uk-select">${retry}</select>
                <button class="tooltip-button">?</button>
                <div class="tooltip-text">
                  <p>Number of retries after image download fails.</p>
                  <p>圖片下載失敗後重試次數。</p>
                </div>
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
                <a href="javascript:;" class="uk-button uk-button-primary" id="manual-pause">
                  <span>手動暫停</span>
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
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
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
                  bottom: 100%;
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
          $("<style>", { type: "text/css" }).html(css).appendTo(document.head);
          const dl_percentage = `
            <div id="dl-percentage-container">
              <a href="javascript:;" id="dl-percentage" class="animate-click" draggable="false"></a>
            </div>
          `;
          $("body").append(dl_percentage);
          const chap_css = `
            #dl-percentage-container {
              display: none;
              position: fixed !important;
              z-index: 999999 !important;
              right: 0 !important;
              bottom: 0 !important;
            }
            #dl-percentage-container > a {
              display: flex !important;
              position: relative !important;
              min-width: 1vh !important;
              min-height: 1vh !important;
              max-width: max-content !important;
              max-height: max-content !important;
              align-items: center !important;
              justify-content: center !important;
              border: 0.2vh solid black !important;
              border-radius: 0.4vh !important;
              padding: 0.6vh !important;
              margin: 1.2vh !important;
              margin-left: auto !important;
              font-weight: bold !important;
              font-size: 1.9vh !important;
              text-decoration: none !important;
              cursor: pointer !important;
              user-select: none !important;
              transition:
                top 0.05s ease-out,
                right 0.05s ease-out,
                bottom 0.05s ease-out,
                left 0.05s ease-out,
                box-shadow 0.05s ease-out !important;
              background-color: white;
              color: black;
            }
            #dl-percentage-container > a.disabled {
              pointer-events: none !important;
              opacity: 0.5 !important;
            }
            #dl-percentage-container > a:hover {
              filter: brightness(90%);
            }
            #dl-percentage-container > a:active {
              filter: brightness(75%);
            }
            #dl-percentage-container > a.animate-click {
              bottom: 0vh;
              right: 0vh;
              box-shadow:
                black 0.05vh 0.05vh,
                black 0.1vh 0.1vh,
                black 0.15vh 0.15vh,
                black 0.2vh 0.2vh,
                black 0.25vh 0.25vh,
                black 0.3vh 0.3vh,
                black 0.35vh 0.35vh,
                black 0.4vh 0.4vh;
            }
            #dl-percentage-container > a.animate-click:active {
              bottom: -0.4vh;
              right: -0.4vh;
              box-shadow: none;
            }
          `;
          $("<style>", { type: "text/css" }).html(chap_css).insertAfter("head");
        }

        class Semaphore {
          constructor(max_par) {
            this.counter = max_par;
            this.waitlist = [];
            this.paused = false;
            this.pauseRes = [];
            this.terminated = false;
          }
          async acquire() {
            await this.check();
            if (this.counter > 0) this.counter--;
            else
              await new Promise((res) => {
                this.waitlist.push(res);
              });
          }
          async release() {
            await this.check();
            if (this.waitlist.length > 0) {
              this.counter--;
              this.waitlist.shift()();
            }
            this.counter++;
          }
          async check() {
            this.paused &&
              (await new Promise((res) => {
                this.pauseRes.push(res);
              }));
          }
          togglePause() {
            this.paused = !this.paused;
            !this.paused && this.pauseRes.forEach((cur) => cur());
          }
          terminate() {
            this.terminated = true;
            // Requests sent must all resolve before continuing
            if (this.paused) this.togglePause();
            this.waitlist.forEach((cur) => {
              cur();
            });
          }
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
          mangadl.retry = Number($("#injected [name='retry']").val());

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
          /**
           * All dlImg instances share the same semaphore
           * s_img is passed as an option to limitParDl
           */
          const s_chap = new Semaphore(mangadl.max_chap_par);
          const s_img = new Semaphore(mangadl.max_img_par);
          mangadl.net_chap = mangadl.chap_dllist.length;
          $("#manual-pause").on("click", () => {
            s_img.togglePause();
            $("#manual-pause").text(s_img.paused ? "繼續下載" : "暫停下載");
          });
          $(".abort-dialog").click(() => {
            s_chap.terminate();
            s_img.terminate();
          });
          $(".animate-click").click(() => {
            s_chap.terminate();
            s_img.terminate();
          });
          $("#dl-bar").show();
          $("#dl-progress").show();
          $("#dl-percentage-container").show();
          const sc_chap = createCounter();
          const fc_chap = createCounter();
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
                    `${tar.success + tar.failed}/${mangadl.net_chap}`,
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
          $("#dl-percentage").text(`0/${mangadl.net_chap}`);
          const id = setInterval(async () => {
            if (mangadl.zip.length > 1) {
              const zipFile = mangadl.zip.shift();
              saveAs(
                await zipFile.generateAsync({
                  type: "blob",
                  compression: "STORE",
                }),
                `${mangadl.manga_name}.zip`,
              );
            }
          }, 500);
          await limitParDl(
            mangadl.chap_dllist,
            getImgList,
            [sc_chap, fc_chap, m_chap, tr, s_img],
            s_chap,
          )
            .then(() => {
              try {
                if (!fc_chap(true))
                  console.log(`${mangadl.manga_name}: all clear!`);
                else {
                  s_chap.terminated &&
                    console.error(`${mangadl.manga_name}: terminated!`);
                  throw new Error(
                    `缺失章節：${fc_chap(true)}/${sc_chap(true)} (Total: ${tr.chap.net})`,
                  );
                }
              } catch (e) {
                console.error(e.message);
                const filename = "不完整下載.txt";
                mangadl.zip[mangadl.zip.length - 1].file(
                  filename,
                  fmtLogs(`${e.message}\n${m_chap()}`),
                );
              }
            })
            .then(async () => {
              clearInterval(id);
              await Promise.all(
                mangadl.zip.map(async (cur) => {
                  const zipFile = await cur.generateAsync({
                    type: "blob",
                    compression: "STORE",
                  });
                  saveAs(zipFile, `${mangadl.manga_name}.zip`);
                }),
              );
            })
            .finally(() => {
              $("#mangadl-all").removeAttr("dling").text("打包下載");
              $("#mangadl-retry").removeAttr("dling").text("重新下載");
              $("#mangadl-retry").removeClass("none");
              $(".muludiv").css("background-color", "");
              // Reset progress bar
              $("#dl-bar").hide();
              $("#dl-progress").hide();
              $("#dl-progress").css({ width: 0 });
              $("#dl-progress-failed").css({ width: 0 });
              $("#dl-info").text("");

              // Reset chap/net ratio display
              $("#dl-percentage-container").hide();
              $("#dl-percentage").text("");

              $("#manual-pause").text("手動暫停");
              mangadl.net_chap = 0;
              mangadl.dling = false;
            });
        }

        async function getImgList(chap, sc_chap, fc_chap, m_chap, tr, s) {
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
                updateDledChap();
                await zipChap();
              } else if (!$nodes.find(".uk-zjimg img").length) {
                const filename = "VIP專屬.txt";
                chap_dir.file(filename, "請使用VIP帳戶下載！\n");
                tr.page.failed++;
                genMsgFile(filename);
                updateDledChap();
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
                  s,
                );
                try {
                  if (!c.fc && c.sc === imgs.length) {
                    tr.chap.success++;
                    sc_chap();
                    console.log(`${chap_dirname}: all clear!`);
                  } else
                    throw new Error(
                      `${chap_dirname}缺失頁：${c.fc || imgs.length - c.sc}/${img_num}`,
                    );
                } catch (e) {
                  console.error(e.message);
                  const filename = "不完整下載.txt";
                  chap_dir.file(filename, fmtLogs(`${e.message}\n${m()}`));
                  tr.chap.failed++;
                  sc_chap();
                  fc_chap();
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
            let toplv_dir = {};
            // Pending feature
            const payload = 512 * Math.pow(1024, 2); // 0.5 GB
            const createZip = () => {
              const zip = new JSZip();
              mangadl.zip.push(zip);
              return zip;
            };
            await mangadl.storing.lock();
            if (mangadl.zip.length) {
              const size = (
                await mangadl.zip[mangadl.zip.length - 1].generateAsync({
                  type: "uint8array",
                  compression: "STORE",
                })
              ).length;
              if (size > payload) toplv_dir = createZip();
              else toplv_dir = mangadl.zip[mangadl.zip.length - 1];
            } else toplv_dir = createZip();
            mangadl.storing.unlock();
            toplv_dir.file(`${chap_dirname}.zip`, chap_blob, {
              binary: true,
            });
          }

          async function updateDledChap() {
            await mangadl.updating.lock();
            mangadl.net_chap--;
            const finished_chap = Number(
              $("#dl-percentage").text().split("/")[0],
            );
            $("#dl-percentage").text(`${finished_chap}/${mangadl.net_chap}`);
            mangadl.updating.unlock();
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

        async function limitParDl(items, fn, args, s) {
          await Promise.all(
            items.map(async (cur) => {
              await s.acquire();
              if (s.terminated) return;
              await fn(cur, ...args).finally(s.release.bind(s));
            }),
          );
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
              acc[acc.length - 1].push(cur.padStart(15, " "));
              return acc;
            }, [])
            .map((cur) => cur.join(""));
          return [...gist, ...content].join("\n");
        }

        async function timeout(ms) {
          await new Promise((res) => {
            setTimeout(res, ms);
          });
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
