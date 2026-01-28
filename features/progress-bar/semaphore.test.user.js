// ==UserScript==
// @name         测试信号量
// @namespace    http://tampermonkey.net/
// @version      2024-09-19
// @description  Test out new semaphore class
// @author       mccranky
// @match        https://cn.bing.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bing.com
// @grant        GM_xmlhttpRequest
// @connect      bing.com
// ==/UserScript==

"use strict";

class Semaphore {
  constructor(max_par) {
    this.counter = max_par;
    this.waitlist = [];
  }
  async acquire() {
    if (this.counter > 0) {
      this.counter--;
      return;
    }
    await new Promise((res) => this.waitlist.push(res));
  }

  release() {
    this.counter++;
    if (this.waitlist.length > 0) {
      this.counter--;
      this.waitlist.shift()();
    }
  }
}

const NUMBER = 10;
const c = (() => {
  let count = 0;
  return (f) => {
    !f && count++;
    return count;
  };
})();

(async () => {
  const queries = [...Array(NUMBER)].map((_, i) => i);

  /**
   * (Abandoned) Method 1:
   ** Easy to exceed the limit of concurrent requests the browser can handle
   */
  // await Promise.all(queries.map((cur) => bingSearch(cur)));

  // Method 2:
  await limitParP(queries, GM_bingSearch, 30);
  console.log(c(true) + " queries missed");
})();

async function limitParP(items, fn, max_par) {
  const s = new Semaphore(max_par);
  await Promise.all(
    items.map(async (cur) => {
      await s.acquire();
      await fn(cur).finally(s.release.bind(s));
    }),
  );
}

async function bingSearch(query) {
  return fetch(`https://cn.bing.com/search?q=${query}`, { method: "GET" })
    .then((res) => res.text())
    .then((res) => {
      console.log(new DOMParser().parseFromString(res, "text/html").title);
    })
    .catch(() => {
      c();
    });
}

async function GM_bingSearch(query, r = 0) {
  await new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      url: `https://cn.bing.com/search?q=${query}`,
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
