import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { KEY, builtFile, payload } from "../../scripts/indexnow.mjs"

describe("IndexNow", () => {
  it("publishes its key at the site's root", () => {
    expect(KEY).toMatch(/^[a-f0-9]{32}$/)
    const file = new URL(`../../public/${KEY}.txt`, import.meta.url)
    expect(existsSync(file)).toBe(true)
    expect(readFileSync(file, "utf8")).toBe(KEY)
  })

  it("finds the built file of a page", () => {
    expect(builtFile("dist", "https://datestamp.eu/")).toBe("dist/index.html")
    expect(builtFile("dist", "https://datestamp.eu/pl/poradniki/")).toBe("dist/pl/poradniki/index.html")
  })

  it("sends the host, the key and where to find it", () => {
    expect(payload("https://datestamp.eu", ["https://datestamp.eu/pl/"])).toEqual({
      host: "datestamp.eu",
      key: KEY,
      keyLocation: `https://datestamp.eu/${KEY}.txt`,
      urlList: ["https://datestamp.eu/pl/"],
    })
  })
})
