export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`
}

export async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(file)
  })
}

export function normalizePhone(input: string) {
  const trimmed = input.trim()
  const keepPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/[^\d]/g, '')
  return keepPlus ? `+${digits}` : digits
}

export function isImageFile(file: File) {
  if (file.type.startsWith('image/')) return true
  return /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(file.name)
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read image'))
    img.src = src
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Could not compress image'))
    }, type, quality)
  })
}

export async function compressImageForUpload(file: File, maxBytes = 900_000) {
  if (file.size <= maxBytes && /^image\/(jpe?g|png|webp)$/i.test(file.type)) {
    return file
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await loadImage(objectUrl)
    const canvas = document.createElement('canvas')
    let width = img.naturalWidth || img.width
    let height = img.naturalHeight || img.height
    const maxDim = 1280
    if (width > maxDim || height > maxDim) {
      const scale = maxDim / Math.max(width, height)
      width = Math.round(width * scale)
      height = Math.round(height * scale)
    }

    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not process image')

    ctx.drawImage(img, 0, 0, width, height)

    let quality = 0.88
    let blob: Blob | null = null
    while (quality >= 0.45) {
      blob = await canvasToBlob(canvas, 'image/jpeg', quality)
      if (blob.size <= maxBytes) break
      quality -= 0.08
    }

    if (!blob || blob.size > maxBytes) {
      throw new Error('Photo is too large. Please choose a smaller image.')
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo'
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export function openPhoneDialer(tel: string) {
  const link = document.createElement('a')
  link.href = tel
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

