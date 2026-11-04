import { describe, expect, it } from "vitest"
import { redatedFileName, stampedFileName } from "../../src/lib/photo"

describe("file names", () => {
  it("marks a stamped photo", () => {
    expect(stampedFileName("IMG_1234.HEIC")).toBe("IMG_1234-date.jpg")
  })

  it("keeps a redated JPEG's name and gives anything else .jpg", () => {
    expect(redatedFileName("IMG_1234.JPG", true)).toBe("IMG_1234.JPG")
    expect(redatedFileName("IMG_1234.HEIC", false)).toBe("IMG_1234.jpg")
    expect(redatedFileName("scan.png", false)).toBe("scan.jpg")
  })
})
