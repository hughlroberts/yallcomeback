const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const url =
  process.argv[2] ||
  "https://www.airbnb.com/rooms/1498159256776624358";

async function main() {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
  });
  const html = await res.text();
  console.log("status", res.status, "len", html.length);
  console.log(
    "blocked?",
    /captcha|just a moment|cf-browser/i.test(html.slice(0, 8000)),
  );

  const decode = (s: string) =>
    s
      .replace(/\\u002F/g, "/")
      .replace(/\\\//g, "/")
      .replace(/\\u0026/g, "&");

  const patterns: [string, RegExp][] = [
    [
      "uuid pictures",
      /https:\/\/a0\.muscache\.com\/im\/pictures\/(?:miso\/Hosting-\d+\/original\/)?[a-f0-9-]{36}\.(?:jpg|jpeg|png)/gi,
    ],
    [
      "broad pictures",
      /https:\/\/a0\.muscache\.com\/im\/pictures\/[^"'\\s?]+\.(?:jpg|jpeg|png)/gi,
    ],
    ["baseUrl", /"baseUrl"\s*:\s*"(https:\/\/a0\.muscache\.com\/im\/pictures\/[^"]+)"/gi],
    [
      "escaped pictures",
      /https:\\u002Fa0\.muscache\.com\\u002Fim\\u002Fpictures\\u002F[^"\\]+/gi,
    ],
    [
      "picture",
      /"(?:picture|pictureUrl|previewImageSrc|originalPicture)"\s*:\s*"(https:[^"]+)"/gi,
    ],
    ["og", /property="og:image"\s+content="([^"]+)"/gi],
    ["jpg any", /https:[^"'\\s]+\.jpe?g[^"'\\s]*/gi],
  ];

  for (const [name, re] of patterns) {
    const hits: string[] = [];
    for (const m of html.matchAll(re)) {
      const raw = m[1] || m[0];
      hits.push(decode(raw).split("?")[0]!);
    }
    console.log(name, "count", new Set(hits).size);
    console.log("  sample", [...new Set(hits)].slice(0, 4));
  }

  // import real extractor
  const { extractListingFromHtml } = await import(
    "../src/lib/listing-import/extract"
  );
  const draft = extractListingFromHtml({
    html,
    source: "airbnb",
    sourceUrl: url,
    sourceId: "1498159256776624358",
  });
  console.log("title", draft.title);
  console.log("imageUrls", draft.imageUrls.length, draft.imageUrls.slice(0, 6));
  console.log("notes", draft.rawNotes);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
