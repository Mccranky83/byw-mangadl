// ==UserScript==
// @name         Progress bar
// @namespace    http://tampermonkey.net/
// @version      2024-10-02
// @description  try to take over the world!
// @author       mccranky
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @match        http://localhost/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=undefined.localhost
// @grant        none
// ==/UserScript==

"use strict";

(() => {
  const handler = {
    get(target, key) {
      const value = Reflect.get(target, key);
      if (typeof value === "object" && value !== null) {
        return new Proxy(value, handler);
      }
      return value;
    },
    set(target, key, value) {
      target[key] = value;
      if (key === "cur" && target.SUM !== undefined) {
        const percentage = (target.cur / target.SUM) * 100;
        const f_percentage = (target.fail / target.SUM) * 100;
        $progress.css("width", `${percentage}%`);
        $failed.css("width", `${f_percentage}%`);
        $barInfo.text(`${target.cur}/${target.SUM}`);
      }
      return true;
    },
  };

  const c = new Proxy(
    {
      page: {
        SUM: 100,
        cur: 0,
        fail: 0,
      },
    },
    handler,
  );

  const css = `
    #bar {
      border: 1px solid black;
      height: 20px;
      width: 400px;
      position: relative;
      background-color: #f3f3f3;
      overflow: hidden;
    }
    #progress {
      height: 100%;
      width: 0%;
      background-color: green;
      transition: width 0.5s ease;
      position: absolute;
      top: 0;
      left: 0;
      z-index: 1;
    }
    #failed {
      height: 100%;
      width: 0%;
      background-color: red;
      transition: width 0.5s ease;
      position: absolute;
      top: 0;
      left: 0;
      z-index: 2;
    }
    #bar-info {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 12px;
      color: black;
      z-index: 3;
    }
  `;

  $("<div>", { id: "bar" })
    .html(
      '<div id="progress"></div><div id="failed"></div><span id="bar-info"></span>',
    )
    .appendTo("body");
  $("<style>").html(css).appendTo("head");

  const $progress = $("#progress");
  const $failed = $("#failed");
  const $barInfo = $("#bar-info");

  const id = setInterval(() => {
    if (c.page.cur >= c.page.SUM) {
      clearInterval(id);
      return;
    }
    c.page.cur++;
  }, 1000);

  const fid = setInterval(() => {
    if (c.page.cur >= c.page.SUM) {
      clearInterval(fid);
      return;
    }
    c.page.fail++;
    c.page.cur++;
  }, 3000);
})();
