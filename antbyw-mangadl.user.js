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
    const getChapterInfo = () => {
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
            name: $(cur).text(),
            url,
          });
        },
      );
      return { chap_list, manga_name };
    };
  };
});
