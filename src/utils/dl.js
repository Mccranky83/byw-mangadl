import mangadl from "../MangaDl.js";
import Semaphore from "./Semaphore.js";
import getImgList from "./getImgList.js";
import { limitParDl } from "./req.js";
import FileSaver from "file-saver";
const { saveAs } = FileSaver;
import { createCounter, missingContent, fmtLogs } from "./logging.js";

export default async function () {
  /**
   * All dlImg instances share the same semaphore
   * s_img is passed as an option to limitParDl
   */
  const s_chap = new Semaphore(mangadl.max_chap_par);
  const s_img = new Semaphore(mangadl.max_img_par);
  mangadl.net_chap = mangadl.chap_dllist.length;
  $("#manual-pause").on("click", () => {
    s_img.togglePause();
    $("#manual-pause").text(s_img.paused ? "繼續下載" : "暫停下載");
  });
  $(".abort-dialog").on("click", () => {
    s_chap.terminate();
    s_img.terminate();
  });
  $(".animate-click").on("click", () => {
    s_chap.terminate();
    s_img.terminate();
  });
  $("#dl-bar").show();
  $("#dl-progress").show();
  $("#dl-percentage-container").show();
  const sc_chap = createCounter();
  const fc_chap = createCounter();
  const m_chap = missingContent();
  const h = {
    get(tar, key) {
      const val = Reflect.get(tar, key);
      if (typeof val === "object") return new Proxy(val, h);
      return val;
    },
    set(tar, key, val) {
      tar[key] = val;
      if (key === "success" || key === "failed" || key === "net") {
        const parent = tar.name;
        if (parent === "page") {
          const percentage = ((tar.success + tar.failed) / tar.net) * 100;
          const f_percentage = (tar.failed / tar.net) * 100;
          $("#dl-progress").css("width", `${percentage}%`);
          $("#dl-progress-failed").css("width", `${f_percentage}%`);
          $("#dl-info").text(`${tar.success + tar.failed}/${tar.net}`);
        } else if (parent === "chap") {
          $("#dl-percentage").text(
            `${tar.success + tar.failed}/${mangadl.net_chap}`,
          );
        }
      }
      return true;
    },
  };
  const tr = new Proxy(
    {
      page: {
        name: "page",
        net: 0,
        success: 0,
        failed: 0,
      },
      chap: {
        name: "chap",
        net: mangadl.chap_dllist.length,
        success: 0,
        failed: 0,
      },
    },
    h,
  );
  $("#dl-percentage").text(`0/${mangadl.net_chap}`);
  const id = setInterval(async () => {
    if (mangadl.zip.length > 1) {
      const zipFile = mangadl.zip.shift();
      saveAs(
        await zipFile.generateAsync({
          type: "blob",
          compression: "STORE",
        }),
        `${mangadl.manga_name}.zip`,
      );
    }
  }, 500);
  await limitParDl(
    mangadl.chap_dllist,
    getImgList,
    [sc_chap, fc_chap, m_chap, tr, s_img],
    s_chap,
  )
    .then(() => {
      try {
        if (!fc_chap(true)) console.log(`${mangadl.manga_name}: all clear!`);
        else {
          s_chap.terminated &&
            console.error(`${mangadl.manga_name}: terminated!`);
          throw new Error(
            `缺失章節：${fc_chap(true)}/${sc_chap(true)} (Total: ${tr.chap.net})`,
          );
        }
      } catch (e) {
        console.error(e.message);
        const filename = "不完整下載.txt";
        mangadl.zip[mangadl.zip.length - 1].file(
          filename,
          fmtLogs(`${e.message}\n${m_chap()}`),
        );
      }
    })
    .then(async () => {
      clearInterval(id);
      await Promise.all(
        mangadl.zip.map(async (cur) => {
          const zipFile = await cur.generateAsync({
            type: "blob",
            compression: "STORE",
          });
          saveAs(zipFile, `${mangadl.manga_name}.zip`);
        }),
      );
    })
    .finally(() => {
      $("#mangadl-all").removeAttr("dling").text("打包下載");
      $("#mangadl-retry").removeAttr("dling").text("重新下載");
      $("#mangadl-retry").removeClass("none");
      $(".muludiv").css("background-color", "");
      // Reset progress bar
      $("#dl-bar").hide();
      $("#dl-progress").hide();
      $("#dl-progress").css({ width: 0 });
      $("#dl-progress-failed").css({ width: 0 });
      $("#dl-info").text("");

      // Reset chap/net ratio display
      $("#dl-percentage-container").hide();
      $("#dl-percentage").text("");

      $("#manual-pause").text("手動暫停");
      $("#manual-select").show();
      $("#clear-selection").show();
      mangadl.net_chap = 0;
      mangadl.dling = false;
    });
}
