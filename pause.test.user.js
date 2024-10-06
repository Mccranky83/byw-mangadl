// ==UserScript==
// @name         Pause
// @namespace    http://tampermonkey.net/
// @version      2024-10-06
// @description  Pause
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @author       Mccranky
// @match        http://localhost/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.com
// @grant        GM_xmlhttpRequest
// @connect      google.com
// ==/UserScript==

(async () => {
  "use strict";

  class Semaphore {
    constructor(count) {
      this.count = count;
      this.waitlist = [];
      this.paused = false;
    }
    async acquire() {
      await this.checkStat();
      if (this.count > 0) this.count--;
      else
        await new Promise((res) => {
          this.waitlist.push(res);
        });
    }
    async release() {
      await this.checkStat();
      if (this.waitlist.length > 0) {
        this.count--;
        this.waitlist.shift()();
      }
      this.count++;
    }
    async checkStat() {
      while (this.paused)
        await new Promise((res) => {
          setTimeout(res, 100);
        });
    }
    toggle() {
      this.paused = !this.paused;
    }
  }

  const NUMBER = 10_000;
  const count = 3;
  const s = new Semaphore(count);
  const c = (() => {
    let count = 0;
    return (f) => {
      !f && count++;
      return count;
    };
  })();
  const queries = [...Array(NUMBER)].map((_, i) => i);
  $("<button>", { class: "query" }).text("Toggle").insertAfter("h1");
  $(".query").on("click", () => {
    s.toggle();
    $(".query").text(s.paused ? "Resume" : "Pause");
  });

  await limitPar(queries, GM_query, s);

  async function GM_query(query, r = 0) {
    await new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        url: `https://www.google.com/search?q=${query}`,
        method: "GET",
        timeout: 10_000,
        onload: (res) => {
          const title = new DOMParser().parseFromString(
            res.response,
            "text/html",
          ).title;
          console.log(title);
          resolve();
        },
        onerror: () => {
          reject(new Error("request error"));
        },
        ontimeout: () => {
          reject(new Error("request timeout"));
        },
      });
    }).catch(async (e) => {
      if (r < 3) {
        await new Promise((res) => {
          setTimeout(res, 5_000);
          console.error(`${query}: ${e.message}`);
          console.log(`${query}: retrying ${r + 1} time(s)...`);
        });
        await GM_bingSearch(query, ++r);
      } else {
        c();
        console.log(`${query}: failed`);
      }
    });
  }

  async function limitPar(items, fn, sema) {
    await Promise.all(
      items.map(async (cur) => {
        await sema.acquire();
        await fn(cur).finally(s.release.bind(s));
      }),
    );
  }
})();
