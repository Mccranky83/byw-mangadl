import Mutex from "./utils/Mutex.js";

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
    this.storing = new Mutex();
    this.retry = 0;
    this.updating = new Mutex();
    this.net_chap = 0;
  }

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
      manga_name_zh + (manga_name_jp ? "｜" + manga_name_jp : manga_name_jp);
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
        selector = ".uk-container ul.uk-switcher .muludiv a.uk-button-default";
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

export default new MangaDl();
