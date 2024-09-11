// ==UserScript==
// @name         antbyw下载
// @namespace    http://tampermonkey.net/
// @version      2024-09-10
// @description  下载单行本漫画
// @author       mccranky
// @match        https://www.antbyw.com/plugin.php?id=jameson_manhua&c=index&a=bofang&kuid=136952
// @icon         https://www.google.com/s2/favicons?sz=64&domain=antbyw.com
// @grant        none
// ==/UserScript==

"use strict";

window.addEventListener("load", () => {
  const script = document.createElement("script");
  script.src =
    "https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js";
  (document.head || document.documentElement).appendChild(script);
  script.onload = () => {
    class MangaDl {
      constructor() {
        this.manga_name = this.getChapterInfo().manga_name;
        this.chap_list = this.getChapterInfo().chap_list;
      }

      getChapterInfo() {
        const title = $("title").text();
        const manga_name_jp = title.match(/(?<=【)[^[【】]+(?=】)/g)[1];
        const manga_name_zh = title.split("【")[0];
        const manga_name = manga_name_zh + " / " + manga_name_jp;
        let chap_list = [];
        $(".uk-container ul.uk-switcher .muludiv a.zj-container").each(
          (_, cur) => {
            const url = [
              window.location.protocol,
              "//",
              window.location.host,
              $(cur).attr("href"),
            ].join("");
            chap_list.push({
              number: $(cur).text(),
              url,
            });
          },
        );
        return { chap_list, manga_name };
      }
    }

    const mangadl = new MangaDl();
    // Create menu
    (() => {
      let entry_chap = [],
        end_chap = [];
      mangadl.chap_list.forEach((cur, i) => {
        entry_chap.push(
          `<option value="${i}" ${i ? "" : "selected"}>
            <span>${cur.number}</span>
          </option>`,
        );
        end_chap.push(
          `<option value="${i}" ${i === mangadl.chap_list.length - 1 ? "selected" : ""}>
            <span>${cur.number}</span>
          </option>`,
        );
      });
      entry_chap.join("\n");
      end_chap.join("\n");
      const menu_html = `
        <div id="injected">
          <span>開始：</span>
          <select name="entry" class="uk-select">${entry_chap}</select>
          <span>結束：</span>
          <select name="end" class="uk-select">${end_chap}</select>
          <br />
          <div class="mtm">
            <a href="javascript:;" class="uk-button uk-button-danger" id="mangadl-all">
              <span>打包下載</span>
            </a>
            <a href="javascript:;" class="uk-button uk-button-primary" id="mangadl-retry">
              <span>重新下載</span>
            </a>
            <a href="javascript:;" class="uk-button uk-button-primary" id="mangadl-seperate">
              <span>分批下載</span>
            </a>
          </div>
        </div>
      `;
      $("div.uk-width-expand .uk-margin-left").append(menu_html);
      $("#mangadl-all").on("click", startDownload);

      // Add styles
      (() => {
        const css = `
        #injected span {
          padding: 2px 8px;
          display: inline;
        }

        #injected select {
          width: 60px;
          height: 30px;
          line-height: 30px;
          border-radius: 2px;
        }
      `;
        const style = $("<style>", { type: "text/css" }).html(css);
        $(document.head || document.documentElement).append(style);
      })();
    })();

    function startDownload() {
      if ($("#mangadl-all").hasClass("uk-dling")) {
        $("#mangadl-all").text("下載中稍等..");
        return;
      } else {
        $("#mangadl-all").addClass("uk-dling").text("下載中");
      }
    }
  };
});
