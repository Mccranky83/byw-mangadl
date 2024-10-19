import cursor_html from "./static/cursor.html";
import "./styles/cursor.css";

export default function () {
  $(document.body).append(cursor_html);

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
