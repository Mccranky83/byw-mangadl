import menu_html from "./static/menu.html";
import "./styles/menu.css";
import mangadl from "../MangaDl.js";
import { dlAll, dlRetry } from "../utils/dlOptions.js";

export default function () {
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
  $("div#uk-sidebar .uk-container").append(menu_html);
  $("#injected [name=entry]").html(entry.join("\n"));
  $("#injected [name=end]").html(end.join("\n"));
  $("#injected [name=retry]").html(retry.join("\n"));
  $("#injected [name=chap-par]").html(chap_par.join("\n"));
  $("#injected [name=img-par]").html(img_par.join("\n"));
  $("#mangadl-all").on("click", dlAll);
  $("#mangadl-retry").on("click", dlRetry);
}
