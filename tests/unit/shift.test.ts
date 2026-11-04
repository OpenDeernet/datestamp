import { describe, expect, it } from "vitest"
import { redatedFileName, shiftDate } from "../../src/lib/shift"

describe("shiftDate", () => {
  const date = new Date(2026, 6, 14, 18, 30, 15)

  it("moves the date later or earlier, seconds kept", () => {
    expect(shiftDate(date, { days: 1, hours: 2, minutes: 5 }, 1)).toEqual(new Date(2026, 6, 15, 20, 35, 15))
    expect(shiftDate(date, { days: 1, hours: 2, minutes: 5 }, -1)).toEqual(new Date(2026, 6, 13, 16, 25, 15))
  })

  it("carries over months and years", () => {
    expect(shiftDate(new Date(2026, 11, 31, 23, 0), { days: 0, hours: 2, minutes: 0 }, 1)).toEqual(new Date(2027, 0, 1, 1, 0))
    expect(shiftDate(new Date(2026, 2, 1, 0, 10), { days: 0, hours: 0, minutes: 20 }, -1)).toEqual(new Date(2026, 1, 28, 23, 50))
  })

  it("keeps the clock time a whole number of days later", () => {
    // Across the end of summer time in most of Europe (25 October 2026).
    const shifted = shiftDate(new Date(2026, 9, 24, 12, 0), { days: 2, hours: 0, minutes: 0 }, 1)
    expect([shifted.getDate(), shifted.getHours()]).toEqual([26, 12])
  })
})

describe("redatedFileName", () => {
  it("keeps a JPEG's name and gives anything else .jpg", () => {
    expect(redatedFileName("IMG_1234.JPG", true)).toBe("IMG_1234.JPG")
    expect(redatedFileName("IMG_1234.HEIC", false)).toBe("IMG_1234.jpg")
    expect(redatedFileName("scan.png", false)).toBe("scan.jpg")
  })
})
