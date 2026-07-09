const url = process.argv[2] || 'https://www.reride.co.in/';
fetch(url, { signal: AbortSignal.timeout(20000) })
  .then((r) => r.text())
  .then((html) => {
    const m = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
    if (!m) {
      console.log('No entry script found');
      process.exit(1);
    }
    const entry = m[1];
    console.log('Entry:', entry);
    return fetch(new URL(entry, url).href, { signal: AbortSignal.timeout(20000) }).then((r) =>
      r.text().then((js) => ({ entry, js })),
    );
  })
  .then(({ entry, js }) => {
    console.log('vendor-i18n in entry:', js.includes('vendor-i18n'));
    console.log('vendor-react in entry:', /vendor-react-/.test(js));
    const idx = js.indexOf('vendor-i18n');
    if (idx >= 0) console.log('context:', js.slice(idx - 60, idx + 100));
    process.exit(js.includes('vendor-i18n') ? 1 : 0);
  })
  .catch((e) => {
    console.error(e.message);
    process.exit(2);
  });
