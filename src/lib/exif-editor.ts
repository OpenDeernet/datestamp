// The "change the date" editor: rewrites the date taken in each photo's
// EXIF, so galleries sort it where it belongs. Nothing is drawn on the
// picture. A JPEG is not encoded again (redateJpeg changes only its EXIF
// segment, every byte of the image stays); a HEIC, PNG or WebP has no
// JPEG to keep, so it is saved as a full-size JPEG with the new date.
// Adding photos, their cards and saving are the workbench's.

import type { ExifEditorStrings } from "../i18n"
import { track } from "./analytics"
import { buildExif, insertExif, redateJpeg } from "./exif"
import { decodePhoto } from "./photo"
import { redatedFileName, shiftDate, type Shift } from "./shift"
import { SAFE_EXPORT_PIXELS, canvasToJpeg, fitPixels, formatDate, maxExportPixels, type DateFormat } from "./stamp"
import { mountWorkbench, type Photo } from "./workbench"

export function mountExifEditor(root: HTMLElement) {
  const strings: ExifEditorStrings = JSON.parse(root.dataset.strings!)
  const format = root.dataset.format as DateFormat
  const controls = root.querySelector<HTMLFieldSetElement>("[data-options]")!
  const allInput = controls.querySelector<HTMLInputElement>("input[name=all]")!
  const setAllButton = controls.querySelector<HTMLButtonElement>("[data-set-all]")!
  const shiftButton = controls.querySelector<HTMLButtonElement>("[data-shift]")!
  const unit = (name: keyof Shift) => controls.querySelector<HTMLInputElement>(`input[name=${name}]`)!

  // Whether each photo is a JPEG we can keep as it is (read from its first bytes).
  const jpegs = new WeakMap<File, boolean>()
  const isJpeg = (file: File) => jpegs.get(file) ?? /\.jpe?g$/i.test(file.name)

  // Assigned once mounted: the workbench calls onChange while it starts.
  let workbench: ReturnType<typeof mountWorkbench> | undefined
  const photos = () => workbench?.photos() ?? []
  workbench = mountWorkbench(root, {
    strings,
    controls,
    dateOpen: { before: strings.before },
    dateLabel: (date) => formatDate(date, format),
    draw(photo, canvas) {
      canvas.width = photo.preview!.width
      canvas.height = photo.preview!.height
      canvas.getContext("2d")!.drawImage(photo.preview!, 0, 0)
    },
    exportPhoto,
    fileName: (photo) => redatedFileName(photo.file.name, isJpeg(photo.file)),
    // Counts only: never a photo's date.
    onSaved: (count, method) => {
      const changed = photos().filter((photo) => photo.dateEdited).length
      track("dates_save", { count, method, changed })
    },
    onChange: refreshButtons,
  })

  function refreshButtons() {
    const any = photos().length > 0
    setAllButton.disabled = !any || !allInput.value
    shiftButton.disabled = !any || readShift() === null
  }
  allInput.addEventListener("input", refreshButtons)
  for (const name of ["days", "hours", "minutes"] as const) unit(name).addEventListener("input", refreshButtons)

  setAllButton.addEventListener("click", () => {
    const date = new Date(allInput.value)
    if (Number.isNaN(date.getTime())) return
    for (const photo of photos()) workbench!.changeDate(photo, date)
  })

  shiftButton.addEventListener("click", () => {
    const shift = readShift()
    if (!shift) return
    const direction = controls.querySelector<HTMLInputElement>("input[name=direction]:checked")?.value === "-1" ? -1 : 1
    for (const photo of photos()) workbench!.changeDate(photo, shiftDate(photo.date, shift, direction))
  })

  /** The shift typed in, or null when it moves nothing (or is not a number). */
  function readShift(): Shift | null {
    const value = (name: keyof Shift) => {
      const number = Number(unit(name).value || 0)
      return Number.isFinite(number) && number >= 0 ? Math.floor(number) : NaN
    }
    const shift = { days: value("days"), hours: value("hours"), minutes: value("minutes") }
    if (Object.values(shift).some(Number.isNaN)) return null
    return shift.days || shift.hours || shift.minutes ? shift : null
  }

  async function exportPhoto(photo: Photo): Promise<Blob> {
    const bytes = new Uint8Array(await photo.file.arrayBuffer())
    const redated = redateJpeg(bytes, photo.date)
    jpegs.set(photo.file, redated !== null)
    if (redated) return new Blob([redated as BlobPart], { type: "image/jpeg" })

    // Not a JPEG: drawn once at full size (capped per device, as in the
    // stamp editor) and saved as one, with a minimal EXIF carrying the date.
    const full = await decodePhoto(photo.file)
    let jpeg: Blob
    try {
      try {
        jpeg = await canvasToJpeg(drawn(full, fitPixels(full.width, full.height, maxExportPixels())))
      } catch {
        jpeg = await canvasToJpeg(drawn(full, fitPixels(full.width, full.height, SAFE_EXPORT_PIXELS)))
      }
    } finally {
      full.close()
    }
    return new Blob([insertExif(new Uint8Array(await jpeg.arrayBuffer()), buildExif(photo.date)) as BlobPart], { type: "image/jpeg" })
  }
}

function drawn(image: ImageBitmap, size: { width: number; height: number }) {
  const canvas = document.createElement("canvas")
  canvas.width = size.width
  canvas.height = size.height
  canvas.getContext("2d")!.drawImage(image, 0, 0, size.width, size.height)
  return canvas
}
