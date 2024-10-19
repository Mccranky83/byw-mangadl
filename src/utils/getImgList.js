import mangadl from "../MangaDl.js";
import dlImg from "./dlImg.js";
import { limitParDl, fetchT } from "./req.js";
import { missingContent, fmtLogs } from "./logging.js";

export default async function (chap, sc_chap, fc_chap, m_chap, tr, s) {
  const chap_zip = new JSZip();
  const chap_dirname = chap.number;
  const chap_dir = chap_zip.folder(chap_dirname);
  await fetchT(chap.url, { method: "GET" }, 30_000)
    .then((res) => {
      if (!res.ok)
        throw new Error(`${chap_dirname}: chapter request failed...`);
      else console.log(`${chap_dirname}: chapter request successful...`);
      return res.text();
    })
    .then(async (res) => {
      const $nodes = $(new DOMParser().parseFromString(res, "text/html").body);
      if (!$nodes.find(".wp").length) {
        console.error("failed to load chapter...");
        setTimeout(() => {
          getImgList(chap);
          return;
        });
      } else if (!$nodes.find(".jameson_manhua").length) {
        const filename = "權限不足.txt";
        chap_dir.file(filename, "權限不足，請登錄賬戶或使用VIP帳戶！\n");
        tr.page.failed++;
        genMsgFile(filename);
        updateDledChap();
        await zipChap();
      } else if (!$nodes.find(".uk-zjimg img").length) {
        const filename = "VIP專屬.txt";
        chap_dir.file(filename, "請使用VIP帳戶下載！\n");
        tr.page.failed++;
        genMsgFile(filename);
        updateDledChap();
        await zipChap();
      } else {
        const imgs = $nodes.find(".uk-zjimg img").toArray();
        const img_num = imgs.length;
        tr.page.net += img_num;
        const m = missingContent();
        const c = new Proxy(
          { sc: 0, fc: 0 },
          {
            get(tar, key) {
              return Reflect.get(...arguments);
            },
            set(tar, key, val) {
              return Reflect.set(...arguments);
            },
          },
        );
        await limitParDl(imgs, dlImg, [chap_dirname, chap_dir, c, m, tr], s);
        try {
          if (!c.fc && c.sc === imgs.length) {
            tr.chap.success++;
            sc_chap();
            console.log(`${chap_dirname}: all clear!`);
          } else
            throw new Error(
              `${chap_dirname}缺失頁：${c.fc || imgs.length - c.sc}/${img_num}`,
            );
        } catch (e) {
          console.error(e.message);
          const filename = "不完整下載.txt";
          chap_dir.file(filename, fmtLogs(`${e.message}\n${m()}`));
          tr.chap.failed++;
          sc_chap();
          fc_chap();
          m_chap(chap_dirname);
        }
        await zipChap();
        return;
      }
    })
    .catch((e) => {
      console.error(e.message);
    });

  async function zipChap() {
    const chap_blob = await chap_zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: {
        level: 6,
      },
    });
    let toplv_dir = {};
    // Pending feature
    const payload = 512 * Math.pow(1024, 2); // 0.5 GB
    const createZip = () => {
      const zip = new JSZip();
      mangadl.zip.push(zip);
      return zip;
    };
    await mangadl.storing.lock();
    if (mangadl.zip.length) {
      const size = (
        await mangadl.zip[mangadl.zip.length - 1].generateAsync({
          type: "uint8array",
          compression: "STORE",
        })
      ).length;
      if (size > payload) toplv_dir = createZip();
      else toplv_dir = mangadl.zip[mangadl.zip.length - 1];
    } else toplv_dir = createZip();
    mangadl.storing.unlock();
    toplv_dir.file(`${chap_dirname}.zip`, chap_blob, {
      binary: true,
    });
  }

  async function updateDledChap() {
    await mangadl.updating.lock();
    mangadl.net_chap--;
    const finished_chap = Number($("#dl-percentage").text().split("/")[0]);
    $("#dl-percentage").text(`${finished_chap}/${mangadl.net_chap}`);
    mangadl.updating.unlock();
  }

  function genMsgFile(filename) {
    chap_zip
      .file(`${chap_dirname}/${filename}`)
      .async("string")
      .then((data) => console.error(data));
  }
}
