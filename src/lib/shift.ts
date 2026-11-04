// Moving a photo's date, for a camera whose clock was set wrong: "2 hours
// earlier", "1 day later". The shift is in clock time (days, hours and
// minutes on the calendar), not a number of milliseconds, so "one day
// later" keeps the hour across a daylight-saving change.

export interface Shift {
  days: number
  hours: number
  minutes: number
}

export function shiftDate(date: Date, { days, hours, minutes }: Shift, direction: 1 | -1): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + direction * days,
    date.getHours() + direction * hours,
    date.getMinutes() + direction * minutes,
    date.getSeconds(),
  )
}

/** The name of a photo saved with a new date: the same name, ".jpg" for a photo that had to become a JPEG. */
export function redatedFileName(name: string, isJpeg: boolean): string {
  return isJpeg ? name : name.replace(/\.[^.]+$/, "") + ".jpg"
}
