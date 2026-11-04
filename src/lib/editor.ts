// The date stamp editor (the home page and the guides): its settings
// (style, format, position, size), the stamped previews and the stamped
// export. Adding photos, their cards and saving are the workbench's
// (src/lib/workbench.ts), shared with the "change the date" page.

import type { EditorStrings } from "../i18n"
import { track } from "./analytics"
import { buildExif, exifSegment, fitExif, insertExif } from "./exif"
import { decodePhoto, stampedFileName } from "./photo"
import {
  DEFAULT_OPTIONS,
  SAFE_EXPORT_PIXELS,
  canvasToJpeg,
  fitPixels,
  formatDate,
  maxExportPixels,
  renderStamped,
  type DateFormat,
  type StampOptions,
} from "./stamp"
import { mountWorkbench, type Photo } from "./workbench"

const SETTINGS_KEY = "datestamp:options"

export function mountEditor(root: HTMLElement) {
  const strings: EditorStrings = JSON.parse(root.dataset.strings!)
  const controls = root.querySelector<HTMLFieldSetElement>("[data-options]")!
  const formatSelect = controls.querySelector<HTMLElement & { value: string }>("el-select[name=format]")!
  const sizeInput = controls.querySelector<HTMLInputElement>("input[name=size]")!
  const sample = new Date(root.dataset.sample!)

  // The default format is the page's language's own (its first in the list).
  const defaults = { ...DEFAULT_OPTIONS, format: (root.dataset.defaultFormat ?? DEFAULT_OPTIONS.format) as DateFormat }
  let options: StampOptions = { ...defaults, ...loadOptions() }
  // A format remembered on a page in another language may not be offered here.
  // (From the server, not from <el-select>'s options: Elements may have moved those by now.)
  const offered: string[] = JSON.parse(root.dataset.formats ?? "[]")
  if (!offered.includes(options.format)) options.format = defaults.format

  const workbench = mountWorkbench(root, {
    strings,
    controls,
    dateLabel: (date) => formatDate(date, options.format),
    draw(photo, canvas) {
      const stamped = renderStamped(photo.preview!, photo.preview!, formatDate(photo.date, options.format), options)
      canvas.width = stamped.width
      canvas.height = stamped.height
      canvas.getContext("2d")!.drawImage(stamped, 0, 0)
    },
    exportPhoto,
    fileName: (photo) => stampedFileName(photo.file.name),
    // What was saved and how, for the statistics (counts and options only).
    onSaved: (count, method) =>
      track("photos_save", { count, method, style: options.style, format: options.format, position: options.position, size: options.size }),
  })

  // The controls: radio tiles for the style and the position, <el-select>
  // for the format, a slider for the size. Show the remembered options...
  const radio = (name: string, value: string) => controls.querySelector<HTMLInputElement>(`input[name=${name}][value="${value}"]`)
  ;(radio("style", options.style) ?? radio("style", DEFAULT_OPTIONS.style))!.checked = true
  ;(radio("position", options.position) ?? radio("position", DEFAULT_OPTIONS.position))!.checked = true
  // The attribute too: <el-select> reads its value attribute when it
  // starts, which would undo a property set before that.
  formatSelect.setAttribute("value", options.format)
  formatSelect.value = options.format
  // <el-select> may have started already (Elements loads in the layout), and
  // it then does not redraw its button for a value set from code.
  const shown = formatSelect.querySelector("el-selectedcontent")
  if (shown) shown.textContent = formatDate(sample, options.format)
  sizeInput.value = String(options.size)
  refreshPreviews()

  // ...and follow every change. The radios bubble change up to the
  // fieldset; the slider fires input while dragging; <el-select> fires its own.
  const update = (patch: Partial<StampOptions>) => {
    const next = { ...options, ...patch }
    if (JSON.stringify(next) === JSON.stringify(options)) return
    options = next
    saveOptions(options)
    refreshPreviews()
    workbench.redrawAll()
  }
  controls.addEventListener("change", (event) => {
    const target = event.target as HTMLInputElement
    if (target.type === "radio" && target.checked) update({ [target.name]: target.value })
  })
  sizeInput.addEventListener("input", () => update({ size: Number(sizeInput.value) }))
  for (const type of ["input", "change"]) formatSelect.addEventListener(type, () => update({ format: formatSelect.value as DateFormat }))

  /** The sample dates in the tiles and the position picker follow the options. */
  function refreshPreviews() {
    const text = formatDate(sample, options.format)
    root.querySelectorAll<HTMLElement>("[data-stamp-sample]").forEach((stamp) => (stamp.textContent = text))
    // The position picker shows the date as it will look: this style, this size.
    root.querySelectorAll<HTMLElement>("[data-stamp-live]").forEach((stamp) => {
      stamp.dataset.style = options.style
      stamp.style.fontSize = `${Math.round(8 + options.size * 0.9)}px`
    })
    root.querySelector("[data-position-label]")!.textContent = strings.positions[options.position]
    root.querySelector("[data-size-label]")!.textContent =
      options.size <= 3 ? strings.sizes.small : options.size <= 6 ? strings.sizes.medium : strings.sizes.large
  }

  async function exportPhoto(photo: Photo): Promise<Blob> {
    const full = await decodePhoto(photo.file)
    let jpeg: Blob
    let size = fitPixels(full.width, full.height, maxExportPixels())
    try {
      const text = formatDate(photo.date, options.format)
      try {
        jpeg = await canvasToJpeg(renderStamped(full, size, text, options))
      } catch {
        // The browser could not hold the canvas at this size (memory, its own
        // limit): a smaller photo beats none.
        size = fitPixels(full.width, full.height, SAFE_EXPORT_PIXELS)
        jpeg = await canvasToJpeg(renderStamped(full, size, text, options))
      }
    } finally {
      full.close()
    }
    return withMetadata(photo, jpeg, size)
  }

  /**
   * The exported JPEG with the photo's EXIF back in (src/lib/exif.ts): the
   * original's, fitted to the new file, or a minimal one with the date.
   */
  async function withMetadata(photo: Photo, jpeg: Blob, size: { width: number; height: number }): Promise<Blob> {
    const isJpeg = photo.file.type === "image/jpeg" || /\.jpe?g$/i.test(photo.file.name)
    const original = isJpeg ? exifSegment(new Uint8Array(await photo.file.arrayBuffer())) : null
    const segment = (original && fitExif(original, { ...size, date: photo.dateEdited ? photo.date : undefined })) ?? buildExif(photo.date)
    return new Blob([insertExif(new Uint8Array(await jpeg.arrayBuffer()), segment) as BlobPart], { type: "image/jpeg" })
  }
}

// Remembered options are a convenience: storage can be missing or blocked
// (private mode), so every access is guarded.
function loadOptions(): Partial<StampOptions> {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}")
  } catch {
    return {}
  }
}

function saveOptions(options: StampOptions) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(options))
  } catch {
    // Not remembered this time.
  }
}
