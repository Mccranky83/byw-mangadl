// ==UserScript==
// @name         cursor
// @namespace    http://tampermonkey.net/
// @version      2024-09-24
// @description  prominent cursor
// @author       Mccranky
// @match        http://localhost/
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=undefined.localhost
// @grant        none
// ==/UserScript==

"use strict";

(function () {
  const anchors = `
    <div>
      <a href="">hello there</a>
    </div>
  `;
  const html = `
    <button>Manual Selection</button>
    <div id="cursor-pointer"> </div>
    <div id="vertical-line"></div>
    <div id="horizontal-line"></div>
    ${anchors.repeat(50)}
  `;
  const css = `
    #cursor-pointer,
    #vertical-line,
    #horizontal-line {
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

  const $button = $("button");
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
  $(document).on("click", "a", function (e) {
    if (f) {
      e.preventDefault();
      $(e.currentTarget)[0].style.backgroundColor
        ? $(this).css("background-color", "")
        : $(this).css("background-color", "yellow");
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
})();
