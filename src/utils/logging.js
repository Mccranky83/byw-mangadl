export function createCounter() {
  let count = 0;
  return (flag) => {
    !flag && ++count;
    return count;
  };
}

export function missingContent() {
  let missing = "";
  return (str) => {
    missing = [missing, str].join("\n");
    return missing.trim();
  };
}

export function fmtLogs(msg) {
  const lines = msg.trim().split("\n");
  const gist = lines.slice(0, 1);
  const content = lines
    .slice(1)
    .sort()
    .reduce((acc, cur, i) => {
      !(i % 5) && acc.push([]);
      acc[acc.length - 1].push(cur.padStart(15, " "));
      return acc;
    }, [])
    .map((cur) => cur.join(""));
  return [...gist, ...content].join("\n");
}
