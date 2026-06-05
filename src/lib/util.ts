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

