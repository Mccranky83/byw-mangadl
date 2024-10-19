import mangadl from "../MangaDl.js";
import dl from "./dl.js";

export async function dlAll() {
  if ($("#mangadl-all").attr("dling") || mangadl.dling) {
    $("#mangadl-all").text("下載中稍等..");
    return;
  } else {
    mangadl.init();
    mangadl.dling = true;
    $("#mangadl-all").attr("dling", mangadl.dling).text("下載中");
    $("#manual-select").hide();
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

export async function dlRetry() {
  if ($("#mangadl-retry").attr("dling") || mangadl.dling) {
    $("#mangadl-retry").text("下載中稍等..");
    return;
  } else {
    mangadl.dling = true;
    $("#mangadl-retry").attr("dling", mangadl.dling).text("下載中");
  }
  await dl();
}
