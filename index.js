// ==UserScript==
// @name         zero漫画下载
// @namespace    http://tampermonkey.net/
// @version      3.2
// @description  在漫画目录页面下载!
// @author       zero
// @match        http://*/plugin.php?id=jameson_manhua*a=bofang*kuid*
// @match        http://*/plugin.php?id=jameson_manhua*kuid*a=bofang*
// @match        https://*/plugin.php?id=jameson_manhua*a=bofang*kuid*
// @match        https://*/plugin.php?id=jameson_manhua*kuid*a=bofang*
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/2.2.0/jquery.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.1.5/jszip.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/1.3.3/FileSaver.min.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=zerobyw1060.com
// @grant        GM_xmlhttpRequest
// @grant        GM.setValue
// @grant        GM.getValue
// @connect      zerobyw8.com
// @license MIT
// @downloadURL https://update.greasyfork.org/scripts/459982/zero%E6%BC%AB%E7%94%BB%E4%B8%8B%E8%BD%BD.user.js
// @updateURL https://update.greasyfork.org/scripts/459982/zero%E6%BC%AB%E7%94%BB%E4%B8%8B%E8%BD%BD.meta.js
// ==/UserScript==

(function () {
  "use strict";
  var zip,
    imgzip,
    allnums,
    haddown,
    process,
    host,
    firstzj,
    endzj,
    downing,
    ingnum,
    errorobj;
  var zjlist = [];
  var manhuaname = "";
  var lastname = "";
  var ziplist = {};
  var ziplist_ing = {};
  var ziplist_end = 0;
  var ziplist_order = [];
  var allzjinfo = [];
  var httpname = location.protocol;

  // 初始化，重复下载
  var init = function () {
    errorobj = {};
    ingnum = 0;
    zip = new JSZip();
    // 全部图片数量
    allnums = 0;
    // 已下载数量
    haddown = 0;
    // 进度
    process = 0;
    host = location.host;
    // 首个下载index
    firstzj = 0;
    // 最后一个下载index
    endzj = 0;
    // 下载中
    downing = false;
  };

  // 下载图片
  var getimglist = async function (zjinfo) {
    zip.folder(zjinfo.name);
    $.ajax({
      url: zjinfo.url,
      type: "GET",
      timeout: 10000,
      success: function (res) {
        res = res ? $.parseHTML(res) : null;
        if (!res || $(res).find(".wp").length < 1) {
          console.log("get read page error,refresh after 5s");
          // 失败了，重试
          setTimeout(function () {
            getimglist(zjinfo);
          }, 5000);
          return;
        } else if ($(res).find(".jameson_manhua").length < 1) {
          console.log("可能未登录或权限不足，请登录或使用VIP账号下载");
          zip.file(
            zjinfo.name + "/可能未登录或权限不足，请登录或使用VIP账号下载.txt",
            "可能未登录或权限不足，请登录或使用VIP账号下载\n",
          );
          allnums++;
          haddown++;
        } else if ($(res).find(".uk-zjimg img").length < 1) {
          console.log("请使用VIP账号下载");
          allnums++;
          haddown++;
          zip.file(
            zjinfo.name + "/请使用VIP账号下载.txt",
            "请使用VIP账号下载\n",
          );
        } else {
          allnums += $(res).find(".uk-zjimg img").length;
          lastname += zjinfo.name;
          $(res)
            .find(".uk-zjimg img")
            .each(function (i, it) {
              downloadimg($(it).attr("src"), zjinfo.name);
            });
        }
      },
    });
  };
  // 获取章节信息
  var getzjlist = function () {
    $(".uk-grid-collapse .muludiv a").each(function (i, it) {
      zjlist.push({
        name: $(it).text(),
        url: httpname + "//" + host + "/" + $(it).attr("href"),
      });
    });
    endzj = zjlist.length - 1;
    manhuaname = $("title")
      .text()
      .replace(/[ \s]+/g, "");
  };

  // 下载图片
  var downloadimg = function (src, zjname) {
    ingnum++;
    var name = src.split("/");
    var filename = name[name.length - 1];
    try {
      GM_xmlhttpRequest({
        method: "GET",
        url: src,
        responseType: "arraybuffer",
        onload: function (data) {
          ingnum--;
          haddown++;
          console.log("byteLength=", data.response.byteLength);
          if (!data.response || data.response.byteLength < 10) {
          } else {
            zip.file(zjname + "/" + filename, data.response, {
              binary: true,
            });
          }
        },
        onerror: function (data) {},
      });
    } catch (e) {}
  };

  var download2 = function (el) {
    // 初始化，不重新获取章节信息
    if ($("#monkey_downbtn").hasClass("uk-disabled")) {
      return;
    }
    $("#monkey_downbtn").addClass("uk-disabled").text("下载中");

    init();
    downing = true;

    firstzj = parseInt($(el).attr("data-first"));
    endzj = parseInt($(el).attr("data-first"));

    zjlist.forEach((it, i) => {
      if (i >= firstzj && i <= endzj) {
        getimglist(it);
      }
    });
  };

  // 开始下载
  var startdownload = function () {
    // 初始化，不重新获取章节信息
    if ($("#monkey_downbtn").hasClass("uk-disabled")) {
      return;
    }
    $("#monkey_downbtn").addClass("uk-disabled").text("下载中");

    init();
    downing = true;
    firstzj = parseInt($('#monkey_div [name="start"]').val());
    endzj = parseInt($('#monkey_div [name="end"]').val());

    if (firstzj > endzj) {
      var tmp = endzj;
      endzj = firstzj;
      firstzj = tmp;
    }

    $("#monkey_downbtn").after(
      `<a onclick="download2(this)" data-first="${firstzj}" data-end="${endzj}" href="javascript:;" class="uk-margin-left none uk-button uk-button-danger uk-button-small" id="chongshixiazai">重试下载</a>`,
    );
    zjlist.forEach((it, i) => {
      if (i >= firstzj && i <= endzj) {
        getimglist(it);
      }
    });
  };

  function download_zj(zjinfo) {
    console.log(zjinfo);
    var zipdir = zjinfo.name;
    ziplist_order.push(zjinfo.name);
    // start
    ziplist[zjinfo.name].zip.folder(zipdir);
    $.ajax({
      url: zjinfo.url,
      type: "GET",
      timeout: 10000,
      success: function (res) {
        res = res ? $.parseHTML(res) : null;
        if (!res || $(res).find(".wp").length < 1) {
          console.log("get read page error,refresh after 5s");
          ziplist[zjinfo.name].total = ziplist[zjinfo.name].nums;
          // 失败了，重试
          ziplist[zjinfo.name].zip.file(zipdir + "/下载失败.txt", "下载失败\n");
          return;
        } else if ($(res).find(".jameson_manhua").length < 1) {
          console.log("可能未登录或权限不足，请登录或使用VIP账号下载");
          ziplist[zjinfo.name].zip.file(
            zipdir + "/可能未登录或权限不足，请登录或使用VIP账号下载.txt",
            "可能未登录或权限不足，请登录或使用VIP账号下载\n",
          );
          ziplist[zjinfo.name].total = ziplist[zjinfo.name].nums;
        } else if ($(res).find(".uk-zjimg img").length < 1) {
          console.log("请使用VIP账号下载");
          ziplist[zjinfo.name].zip.file(
            zipdir + "/请使用VIP账号下载.txt",
            "请使用VIP账号下载\n",
          );
          ziplist[zjinfo.name].total = ziplist[zjinfo.name].nums;
        } else {
          // 该章节总图片
          ziplist[zjinfo.name].total = $(res).find(".uk-zjimg img").length;

          $(res)
            .find(".uk-zjimg img")
            .each(function (i, it) {
              //await downloadimg($(it).attr('src'),zjinfo.name);
              console.log(`第${i}图，共${ziplist[zjinfo.name].total}张图`);
              var src = $(it).attr("src");
              var name = src.split("/");
              var filename = name[name.length - 1];
              GM_xmlhttpRequest({
                method: "GET",
                url: src,
                responseType: "arraybuffer",
                onload: function (data) {
                  ziplist[zjinfo.name].nums++;
                  if (!data.response || data.response.byteLength < 10) {
                    ziplist[zjinfo.name].zip.file(
                      zipdir + "/" + `${filename}下载失败.txt`,
                      "下载失败",
                    );
                  } else {
                    ziplist[zjinfo.name].zip.file(
                      zipdir + "/" + filename,
                      data.response,
                      {
                        binary: true,
                      },
                    );
                  }
                },
                onerror: function (data) {
                  ziplist[zjinfo.name].nums++;
                },
              });
              // e
            });
        }
      },
      error: function (e) {
        console.log(e);
        console.log("下载失败" + zjinfo.name);
        ziplist[zjinfo.name].total = ziplist[zjinfo.name].nums;
        // 失败了，重试
        ziplist[zjinfo.name].zip.file(zipdir + "/下载失败.txt", "下载失败\n");
      },
    });

    // end
  }

  // 按照章节下载
  var startdownload_zj = function () {
    // 初始化，不重新获取章节信息
    if ($("#monkey_downbtn_zj").hasClass("uk-disabled")) {
      $("#monkey_downbtn_zj").text("还在下载中请稍等..");
      return;
    }
    $("#monkey_downbtn_zj").addClass("uk-disabled").text("下载中");

    ziplist = {};
    ziplist_ing = {};
    var firstzj = parseInt($('#monkey_div [name="start"]').val());
    var endzj = parseInt($('#monkey_div [name="end"]').val());

    if (firstzj > endzj) {
      var tmp = endzj;
      endzj = firstzj;
      firstzj = tmp;
    }

    // 遍历所有章节
    $("#monkey_process").css("width", "1%");
    zjlist.forEach((zjinfo, i) => {
      if (i >= firstzj && i <= endzj) {
        allzjinfo.push(zjinfo);
        ziplist[zjinfo.name] = { nums: 0, total: 1, zip: new JSZip() };
      }
    });
    ziplist_end = allzjinfo.length;
    if (allzjinfo.length > 0) {
      download_zj(allzjinfo.shift());
    }
  };

  // 设置 进度
  var setprocess = function (num) {
    if (haddown == 0 || allnums == 0 || num === -1) {
      $("#monkey_process").css("width", "0").text("");
    } else {
      var percent = Math.round((haddown * 100) / allnums, 2);
      percent = percent < 5 ? 5 : percent;
      var text =
        allnums > 500
          ? `${allnums}张图,打包时间较长,完成后自动弹出,请稍等`
          : "打包中,完成后将自动弹出,请稍等";
      $("#monkey_process")
        .css("width", percent + "%")
        .text(percent >= 100 ? text : `${percent}%`);
    }
  };

  // 生成按钮
  var createbtn = function () {
    init();
    getzjlist();
    var start = [];
    var end = [];
    zjlist.forEach((it, i) => {
      start.push(
        `<option value="${i}" ${i === 0 ? "selected" : ""}>${it.name}</option>`,
      );
      end.push(
        `<option value="${i}" ${i === zjlist.length - 1 ? "selected" : ""}>${it.name}</option>`,
      );
    });
    start = start.join("\n");
    end = end.join("\n");
    var html = `<div id="monkey_div" style="display:inline-block;font-size:12px;padding:3px 8px">
            开始：<select name="start" style="width:80px;height:35px;line-height:35px" class="uk-select">
                ${start}
            </select>
            结束：<select name="end" style="width:80px;height:35px;line-height:35px" class="uk-select">
                ${end}
            </select>
            <a href="javascript:;"  class="uk-button uk-button-danger uk-button-small" id="monkey_downbtn">打包下载</a>
			<a href="javascript:;"  class="uk-button uk-button-secondary uk-button-small none" id="chongshixiazai">重试下载</a>
 
			<a href="javascript:;"  class="uk-button uk-button-primary uk-button-small" id="monkey_downbtn_zj"  >按话下载</a>
			
			<a href="https://www.bilibili.com/read/cv13585336/" class="uk-button uk-text-primary" target="_blank">第一次下载点击查看</a>
 
            <div class="uk-position-relative uk-width uk-background-muted" style="height:5px;bottom:-5px;">
                <div id="monkey_process" class="uk-position-absolute uk-background-primary uk-flex uk-flex-center"  style="height:5px;width:0;align-items:center"></div>
            </div>
        </div>`;
    $("h3.uk-heading-divider").append(html);
    $("#monkey_downbtn").on("click", () => {
      startdownload();
    });
    $("#monkey_downbtn_zj").on("click", () => {
      startdownload_zj();
    });
  };
  createbtn();

  var total_time = 0;
  window.mytimeid = setInterval(function () {
    total_time += 0.5;
    if (downing && total_time > 300) {
      $("#chongshixiazai").removeClass("none");
    }
    if (downing && allnums > 0 && allnums == haddown) {
      downing = false;
      setprocess();
      zip
        .generateAsync({
          type: "blob",
          compression: "DEFLATE",
        })
        .then((zipFile) => {
          console.log("11total_time=" + total_time);
          saveAs(zipFile, manhuaname + ".zip");
          total_time = 0;
          console.log("22total_time=" + total_time);
          console.log("100%");
          setTimeout(function () {
            $("#monkey_downbtn").removeClass("uk-disabled").text("下载");
            $("#monkey_process").css("width", "0").text("");
            init();
          }, 3000);
        });
    } else {
      downing && setprocess();
    }

    //
    var len = ziplist_end;
    if (ziplist_order.length > 0 && len > 0) {
      var k = ziplist_order.shift();
      var percent = Math.round(((len - allzjinfo.length) * 100) / len, 2);
      $("#monkey_process").css("width", (percent < 1 ? 1 : percent) + "%");
      console.log(k, percent, len);
      console.log(ziplist[k].nums, "===", ziplist[k].total);
      if (ziplist[k].nums >= ziplist[k].total) {
        ziplist[k].zip
          .generateAsync({
            type: "blob",
            compression: "DEFLATE",
          })
          .then((zipFile) => {
            // 开始下一个
            saveAs(zipFile, k + ".zip");
            if (allzjinfo.length > 0) {
              download_zj(allzjinfo.shift());
            } else {
              $("#monkey_downbtn_zj")
                .removeClass("uk-disabled")
                .text("下载完毕打包中");
              ziplist = {};
              ziplist_end = 0;
              ziplist_ing = {};
              $("#monkey_downbtn_zj")
                .removeClass("uk-disabled")
                .text("下载完毕");
            }
          });
      } else {
        ziplist_order.unshift(k);
      }
    }
  }, 500);
})();
