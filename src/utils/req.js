export async function limitParDl(items, fn, args, s) {
  await Promise.all(
    items.map(async (cur) => {
      await s.acquire();
      if (s.terminated) return;
      await fn(cur, ...args).finally(s.release.bind(s));
    }),
  );
}

export function fetchT(url, options, timeout) {
  const c = new AbortController();
  const signal = c.signal;
  const fetch_p = fetch(url, { ...options, signal }).catch(() => {});
  const timeout_p = new Promise((_, rej) => {
    setTimeout(() => {
      c.abort();
      rej(new Error("request timeout..."));
    }, timeout);
  });
  return Promise.race([fetch_p, timeout_p]);
}
