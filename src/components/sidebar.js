import html from "./static/sidebar.html";
import "./styles/sidebar.css";

export default function () {
  $("body").css({
    "overflow-x": "hidden",
  });
  $("body:last-child").after(html);

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
