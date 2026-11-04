// IndexNow (https://www.indexnow.org): tells Bing, Yandex, Seznam and the
// other IndexNow search engines which pages changed, right after a deploy.
// ChatGPT searches the web largely through Bing, so a new or changed page
// reaches it in hours instead of whenever Bing's crawler comes by.
//
// IndexNow asks for changed URLs only, so the deploy workflow runs this
// twice:
//   node scripts/indexnow.mjs changed dist https://datestamp.eu changed.txt
//     (the site is only for symmetry: the URLs come from the sitemap)
//     before the deploy: every page in the sitemap whose built HTML differs
//     from what the live site serves now (or that it does not have yet);
//   node scripts/indexnow.mjs submit https://datestamp.eu changed.txt
//     after the deploy: sends that list. It never fails the deploy: a
//     search engine being down is not a reason to stop.
//
// The key is public by design: it is the file public/<KEY>.txt, served at
// the site's root, which proves to the search engines that we own the host.
import { readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"

export const KEY = "1e73535da30310824bcf4b4c5dcf9c2f"
const ENDPOINT = "https://api.indexnow.org/indexnow"

/** Every <loc> of the sitemaps Astro wrote (sitemap-0.xml...), not the index. */
export async function sitemapUrls(dist) {
  const files = (await readdir(dist)).filter((name) => /^sitemap-\d+\.xml$/.test(name))
  const urls = []
  for (const file of files) {
    const xml = await readFile(path.join(dist, file), "utf8")
    for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.push(match[1])
  }
  return urls
}

/** The built file a page's URL is served from: /pl/poradniki/ → dist/pl/poradniki/index.html. */
export function builtFile(dist, url) {
  const pathname = decodeURIComponent(new URL(url).pathname)
  return path.join(dist, pathname.endsWith("/") ? `${pathname}index.html` : pathname)
}

/** The request body IndexNow expects, at most 10 000 URLs per request. */
export function payload(site, urls) {
  const host = new URL(site).host
  return { host, key: KEY, keyLocation: new URL(`/${KEY}.txt`, site).href, urlList: urls.slice(0, 10_000) }
}

async function changed(dist, out) {
  const urls = await sitemapUrls(dist)
  const result = []
  // A few at a time: GitHub Pages is quick, but there are some 200 pages.
  for (let index = 0; index < urls.length; index += 8) {
    await Promise.all(
      urls.slice(index, index + 8).map(async (url) => {
        const built = await readFile(builtFile(dist, url), "utf8")
        // A query the CDN has not cached, so the answer is what is live now.
        const live = await fetch(`${url}?indexnow=${Date.now()}`).then((response) => (response.ok ? response.text() : null), () => null)
        if (live !== built) result.push(url)
      }),
    )
  }
  result.sort()
  await writeFile(out, result.join("\n") + (result.length ? "\n" : ""))
  console.log(`IndexNow: ${result.length} of ${urls.length} pages changed`)
  for (const url of result) console.log(`  ${url}`)
}

async function submit(site, file) {
  const urls = (await readFile(file, "utf8")).split("\n").filter(Boolean)
  if (!urls.length) return console.log("IndexNow: nothing changed, nothing sent")
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload(site, urls)),
    })
    // 200 and 202 both mean accepted (202: the key is still being checked).
    console.log(`IndexNow: sent ${urls.length} URLs, answer ${response.status} ${response.statusText}`)
    if (!response.ok) console.log(await response.text())
  } catch (error) {
    console.log(`IndexNow: not sent (${error.message})`)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [command, ...args] = process.argv.slice(2)
  if (command === "changed") {
    // A failure here (the live site unreachable...) must not stop the deploy:
    // then nothing is sent this time.
    await changed(args[0], args[2]).catch(async (error) => {
      console.log(`IndexNow: could not compare with the live site (${error.message}), nothing will be sent`)
      await writeFile(args[2], "")
    })
  }
  else if (command === "submit") await submit(args[0], args[1])
  else {
    console.error("usage: indexnow.mjs changed <dist> <site> <out> | submit <site> <file>")
    process.exit(1)
  }
}
