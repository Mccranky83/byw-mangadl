// ==UserScript==
// @name         sidebar
// @namespace    http://tampermonkey.net/
// @version      2024-09-21
// @description  slide-in sidebar
// @author       mccranky
// @match        http://localhost:3000/
// @require     https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js
// @grant        none
// ==/UserScript==

function createSidebar() {
  const html = `
    <button id="sidebar-open-btn">菜單</button>
    <div id="uk-sidebar">
      <button id="sidebar-close-btn">&times;</button>
      <h2>菜單</h2>
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
  $sidebar = $("#uk-sidebar");
  $sidebarBtn = $("#sidebar-open-btn");
  $closeBtn = $("#sidebar-close-btn");

  $sidebarBtn.on("mousedown", ({ clientX, clientY }) => {
    // Calculate offset between mouse and element border
    const btn_rect = $sidebarBtn[0].getBoundingClientRect();
    const shiftX = clientX - btn_rect.left;
    const shiftY = clientY - btn_rect.top;

    $(document).on("mousemove", onMouseMove);
    $(document).on("keydown", ({ key }) => {
      if (key === "Escape") {
        $sidebar.removeClass("active");
        $sidebarBtn.removeClass("hidden");
      }
    });
    $sidebarBtn.on("mouseup", () => {
      if (!dragging) {
        $sidebar.addClass("active");
        $sidebarBtn.addClass("hidden");
      } else dragging = false;
      $(document).off("mousemove", onMouseMove);
      $sidebarBtn.off("mouseup");
    });

    $closeBtn.on("click", () => {
      $sidebar.removeClass("active");
      $sidebarBtn.removeClass("hidden");
    });
    // Use pageX/Y to get absolute position
    function onMouseMove({ pageX, pageY }) {
      dragging = true;
      $sidebarBtn.css({
        left: pageX - shiftX + "px",
        top: pageY - shiftY + "px",
      });
    }
  });
}
createSidebar();
