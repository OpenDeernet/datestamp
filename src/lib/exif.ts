// Keeping a photo's metadata through the export. Drawing on a canvas and
// encoding a JPEG drops every EXIF field (date taken, camera, lens, GPS),
// so the original's EXIF segment is copied into the new file, with the few
// fields that no longer hold put right:
// - Orientation → 1: the pixels were already turned upright on decoding;
// - the pixel dimensions → the exported size (big photos are scaled down);
// - the date → the one stamped on the photo, when the user changed it;
// - the embedded thumbnail (IFD1) → dropped: it shows the photo without the
//   date, and Finder or a gallery may show the thumbnail instead.
// A photo without EXIF (a screenshot, a PNG, a HEIC) gets a minimal one
// with the date it was stamped with.
//
// The "change the date" page (redateJpeg) does not encode the photo again:
// it rewrites only the date in the original JPEG's EXIF.
//
// No library: a JPEG is a list of segments, and EXIF is a small TIFF
// structure in the APP1 segment.

const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00] // "Exif\0\0"
/** Where the TIFF structure starts inside an APP1 segment: marker (2), length (2), "Exif\0\0" (6). */
const TIFF_START = 10

const TAG = {
  orientation: 0x0112,
  dateTime: 0x0132,
  exifIfd: 0x8769,
  dateTimeOriginal: 0x9003,
  dateTimeDigitized: 0x9004,
  pixelWidth: 0xa002,
  pixelHeight: 0xa003,
}

/** Where the EXIF APP1 segment of a JPEG is (marker included), or null. */
function findExif(jpeg: Uint8Array): { start: number; end: number } | null {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return null
  let at = 2
  while (at + 4 <= jpeg.length && jpeg[at] === 0xff) {
    const marker = jpeg[at + 1]
    if (marker === 0xda || marker === 0xd9) break // image data starts: no more metadata
    const length = (jpeg[at + 2] << 8) | jpeg[at + 3]
    if (marker === 0xe1 && EXIF_HEADER.every((byte, index) => jpeg[at + 4 + index] === byte)) {
      return { start: at, end: at + 2 + length }
    }
    at += 2 + length
  }
  return null
}

/** The EXIF APP1 segment of a JPEG (marker included), or null. */
export function exifSegment(jpeg: Uint8Array): Uint8Array | null {
  const found = findExif(jpeg)
  return found && jpeg.slice(found.start, found.end)
}

/**
 * Reads and writes the TIFF structure inside an EXIF segment, in its own
 * byte order. Throws when a read would fall outside the segment.
 */
function tiffOf(out: Uint8Array) {
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength)
  const order = view.getUint16(TIFF_START)
  if (order !== 0x4949 && order !== 0x4d4d) throw new Error("not a TIFF structure")
  const little = order === 0x4949
  const inside = (offset: number, size: number) => offset >= 0 && offset + size <= out.length - TIFF_START
  const u16 = (offset: number) => view.getUint16(TIFF_START + offset, little)
  const u32 = (offset: number) => view.getUint32(TIFF_START + offset, little)
  const set16 = (offset: number, value: number) => view.setUint16(TIFF_START + offset, value, little)
  const set32 = (offset: number, value: number) => view.setUint32(TIFF_START + offset, value, little)
  /** Calls back for every entry of an IFD; returns where its "next IFD" pointer is. */
  const walk = (ifd: number, visit: (tag: number, entry: number) => void) => {
    if (!inside(ifd, 2)) throw new Error("IFD outside the segment")
    const count = u16(ifd)
    if (!inside(ifd + 2, count * 12 + 4)) throw new Error("IFD outside the segment")
    for (let index = 0; index < count; index++) visit(u16(ifd + 2 + index * 12), ifd + 2 + index * 12)
    return ifd + 2 + count * 12
  }
  /** Writes an EXIF date into an ASCII entry with room for it; false when it has none. */
  const setDate = (entry: number, text: string) => {
    if (u16(entry + 2) !== 2 || u32(entry + 4) < 20) return false // ASCII, room for 19 chars + NUL
    const offset = u32(entry + 8)
    if (!inside(offset, 20)) return false
    for (let index = 0; index < 19; index++) out[TIFF_START + offset + index] = text.charCodeAt(index)
    out[TIFF_START + offset + 19] = 0
    return true
  }
  return { little, inside, u16, u32, set16, set32, walk, setDate }
}

/** "2026:07:14 18:30:00", the EXIF date format (local time, like the camera's). */
export function exifDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}:${pad(date.getMonth() + 1)}:${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/**
 * A copy of an EXIF segment fitted to the exported file (see the top of the
 * file). Returns null when the segment cannot be read safely; the caller
 * then builds a fresh one.
 */
export function fitExif(segment: Uint8Array, { width, height, date }: { width: number; height: number; date?: Date }): Uint8Array | null {
  try {
    const out = segment.slice()
    const { u16, u32, set16, set32, walk, setDate: writeDate } = tiffOf(out)
    const setNumber = (entry: number, value: number) => {
      const type = u16(entry + 2)
      if (type === 3) set16(entry + 8, value) // SHORT
      else if (type === 4) set32(entry + 8, value) // LONG
    }
    const text = date ? exifDate(date) : null
    const setDate = (entry: number) => text && writeDate(entry, text)

    let exifIfd = 0
    const next = walk(u32(4), (tag, entry) => {
      if (tag === TAG.orientation) set16(entry + 8, 1)
      else if (tag === TAG.exifIfd) exifIfd = u32(entry + 8)
      else if (tag === TAG.dateTime) setDate(entry)
    })
    set32(next, 0) // no IFD1: the old thumbnail goes
    if (exifIfd) {
      walk(exifIfd, (tag, entry) => {
        if (tag === TAG.pixelWidth) setNumber(entry, width)
        else if (tag === TAG.pixelHeight) setNumber(entry, height)
        else if (tag === TAG.dateTimeOriginal || tag === TAG.dateTimeDigitized) setDate(entry)
      })
    }
    return out
  } catch {
    return null
  }
}

/** A minimal EXIF segment: upright, and the date taken (as DateTimeOriginal and DateTimeDigitized). */
export function buildExif(date: Date): Uint8Array {
  // Little-endian TIFF: header (8), IFD0 with 2 entries (30), the Exif IFD
  // with 2 entries (30), then the 20-byte date both entries point to.
  const tiff = new Uint8Array(88)
  const view = new DataView(tiff.buffer)
  const entry = (at: number, tag: number, type: number, count: number, value: number) => {
    view.setUint16(at, tag, true)
    view.setUint16(at + 2, type, true)
    view.setUint32(at + 4, count, true)
    view.setUint32(at + 8, value, true)
  }
  tiff.set([0x49, 0x49, 0x2a, 0x00])
  view.setUint32(4, 8, true) // IFD0 at 8
  view.setUint16(8, 2, true)
  entry(10, TAG.orientation, 3, 1, 1)
  entry(22, TAG.exifIfd, 4, 1, 38)
  view.setUint32(34, 0, true)
  view.setUint16(38, 2, true)
  entry(40, TAG.dateTimeOriginal, 2, 20, 68)
  entry(52, TAG.dateTimeDigitized, 2, 20, 68)
  view.setUint32(64, 0, true)
  const text = exifDate(date)
  for (let index = 0; index < 19; index++) tiff[68 + index] = text.charCodeAt(index)

  const length = 2 + EXIF_HEADER.length + tiff.length
  const segment = new Uint8Array(2 + length)
  segment.set([0xff, 0xe1, length >> 8, length & 0xff, ...EXIF_HEADER])
  segment.set(tiff, TIFF_START)
  return segment
}

/**
 * The JPEG with the EXIF segment right after its start marker, where EXIF
 * belongs (the JFIF segment a canvas writes there is dropped: EXIF replaces it).
 */
export function insertExif(jpeg: Uint8Array, segment: Uint8Array): Uint8Array {
  let rest = 2
  if (jpeg[2] === 0xff && jpeg[3] === 0xe0) rest = 4 + ((jpeg[4] << 8) | jpeg[5])
  const out = new Uint8Array(2 + segment.length + jpeg.length - rest)
  out.set([0xff, 0xd8])
  out.set(segment, 2)
  out.set(jpeg.subarray(rest), 2 + segment.length)
  return out
}

/**
 * A copy of an EXIF segment with a new date taken, everything else as it
 * was (camera, GPS, orientation, the thumbnail: the pixels do not change).
 * The date goes into DateTimeOriginal and DateTimeDigitized (what galleries
 * sort by) and DateTime, written in place. An EXIF without those fields
 * gets them in a new Exif IFD appended to the segment: the old values stay
 * where they are, because every offset counts from the TIFF header.
 * OffsetTime* is kept: the date is the camera's local time, and the user
 * changes that clock time, not the time zone. Null when the segment cannot
 * be read safely.
 */
export function redateExif(segment: Uint8Array, date: Date): Uint8Array | null {
  try {
    const text = exifDate(date)
    const out = segment.slice()
    const { little, u32, walk, setDate } = tiffOf(out)

    const ifd0 = u32(4)
    let exifIfd = 0
    const ifd0Entries: Uint8Array[] = []
    const ifd0Next = walk(ifd0, (tag, entry) => {
      ifd0Entries.push(out.slice(TIFF_START + entry, TIFF_START + entry + 12))
      if (tag === TAG.exifIfd) exifIfd = u32(entry + 8)
      else if (tag === TAG.dateTime) setDate(entry, text)
    })
    // Kept as raw entries, minus the dates that could not be written in place.
    const exifEntries: Uint8Array[] = []
    const written = new Set<number>()
    if (exifIfd) {
      walk(exifIfd, (tag, entry) => {
        const isDate = tag === TAG.dateTimeOriginal || tag === TAG.dateTimeDigitized
        if (isDate && setDate(entry, text)) written.add(tag)
        if (!isDate || written.has(tag)) exifEntries.push(out.slice(TIFF_START + entry, TIFF_START + entry + 12))
      })
    }
    const missing = [TAG.dateTimeOriginal, TAG.dateTimeDigitized].filter((tag) => !written.has(tag))
    if (!missing.length) return out

    // Appended after the old data (at an even offset, as TIFF wants): the
    // date text, a new Exif IFD and, if IFD0 had no pointer to one, a new IFD0.
    const tiffLength = out.length - TIFF_START
    const dateAt = tiffLength + (tiffLength % 2)
    const exifAt = dateAt + 20
    const entry = (tag: number, type: number, count: number, value: number) => {
      const bytes = new Uint8Array(12)
      const view = new DataView(bytes.buffer)
      view.setUint16(0, tag, little)
      view.setUint16(2, type, little)
      view.setUint32(4, count, little)
      view.setUint32(8, value, little)
      return bytes
    }
    const tagOf = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset).getUint16(0, little)
    const ifd = (entries: Uint8Array[], next: number) => {
      entries.sort((a, b) => tagOf(a) - tagOf(b)) // TIFF wants the tags in order
      const bytes = new Uint8Array(2 + entries.length * 12 + 4)
      const view = new DataView(bytes.buffer)
      view.setUint16(0, entries.length, little)
      entries.forEach((item, index) => bytes.set(item, 2 + index * 12))
      view.setUint32(2 + entries.length * 12, next, little)
      return bytes
    }
    const newExif = ifd([...exifEntries, ...missing.map((tag) => entry(tag, 2, 20, dateAt))], 0)
    const parts = [newExif]
    let newIfd0At = 0
    if (!exifIfd) {
      newIfd0At = exifAt + newExif.length
      parts.push(ifd([...ifd0Entries, entry(TAG.exifIfd, 4, 1, exifAt)], u32(ifd0Next)))
    } else {
      // Point IFD0 at the new Exif IFD.
      walk(ifd0, (tag, at) => {
        if (tag === TAG.exifIfd) new DataView(out.buffer).setUint32(TIFF_START + at + 8, exifAt, little)
      })
    }

    const size = TIFF_START + exifAt + parts.reduce((sum, part) => sum + part.length, 0)
    if (size - 2 > 0xffff) return null // a segment's length must fit in two bytes
    const result = new Uint8Array(size)
    result.set(out)
    for (let index = 0; index < 19; index++) result[TIFF_START + dateAt + index] = text.charCodeAt(index)
    let at = TIFF_START + exifAt
    for (const part of parts) {
      result.set(part, at)
      at += part.length
    }
    const view = new DataView(result.buffer)
    view.setUint16(2, size - 2)
    if (newIfd0At) view.setUint32(TIFF_START + 4, newIfd0At, little)
    return result
  } catch {
    return null
  }
}

/**
 * The same JPEG with a new date taken, without encoding the image again:
 * only the EXIF segment changes, every byte of the picture stays as it was.
 * A JPEG without EXIF gets a minimal one (after its JFIF segment, which is
 * kept), and one whose EXIF cannot be read has it replaced by a minimal one.
 * Null when the file is not a JPEG.
 */
export function redateJpeg(jpeg: Uint8Array, date: Date): Uint8Array | null {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8 || jpeg[2] !== 0xff) return null
  const found = findExif(jpeg)
  let start: number
  let end: number
  let segment: Uint8Array
  if (found) {
    ;({ start, end } = found)
    segment = redateExif(jpeg.subarray(start, end), date) ?? buildExif(date)
  } else {
    start = end = jpeg[3] === 0xe0 ? 4 + ((jpeg[4] << 8) | jpeg[5]) : 2
    segment = buildExif(date)
  }
  const out = new Uint8Array(jpeg.length - (end - start) + segment.length)
  out.set(jpeg.subarray(0, start))
  out.set(segment, start)
  out.set(jpeg.subarray(end), start + segment.length)
  return out
}
