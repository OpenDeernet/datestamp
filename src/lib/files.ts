// Pure helpers for the files the editor takes and writes, kept apart from
// the DOM code so the unit tests can reach them.

// Files dropped onto the page that may be photos. Some sources (the macOS
// Photos app, HEIC in Chrome) give no MIME type, so an empty type or a photo
// extension is enough; a file the browser then cannot decode gets the
// "cannot open" message rather than silently vanishing.
export const PHOTO_EXTENSION = /\.(jpe?g|png|webp|avif|gif|bmp|tiff?|hei[cf])$/i

export function droppedPhotos(transfer: DataTransfer): File[] {
  const files = transfer.files.length
    ? [...transfer.files]
    : [...transfer.items].map((item) => item.getAsFile()).filter((file): file is File => file !== null)
  return files.filter((file) => file.type.startsWith("image/") || file.type === "" || PHOTO_EXTENSION.test(file.name))
}

// Two photos named IMG_0001.jpg (from different folders), or a file already
// in the chosen folder, must not be overwritten: IMG_0001-date-2.jpg.
export function uniqueName(taken: (name: string) => boolean, name: string) {
  let candidate = name
  for (let n = 2; taken(candidate); n++) {
    // A name without an extension (macOS Photos sometimes drops one) would
    // otherwise keep the same candidate forever and hang the save.
    candidate = /(\.[^.]+)$/.test(name) ? name.replace(/(\.[^.]+)$/, `-${n}$1`) : `${name}-${n}`
  }
  return candidate
}
