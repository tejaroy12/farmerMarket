import type { Farmer, Product } from './types'

type Query = {
  query?: string
  crop?: string
  lat?: number
  lng?: number
  maxDistance?: number
  sort?: 'latest' | 'nearest'
}

type ApiFetchOptions = RequestInit & {
  timeoutMs?: number
  retries?: number
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isNetworkError(err: unknown) {
  return (
    err instanceof TypeError ||
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error &&
      /failed to fetch|network|load failed|aborted|timed out/i.test(err.message))
  )
}

function networkErrorMessage() {
  return 'Could not reach server. On free hosting the site may take up to 60 seconds to wake up. Please wait and try again.'
}

async function apiFetch(path: string, options: ApiFetchOptions = {}) {
  const { timeoutMs, retries = 2, ...init } = options
  const isUpload = init.body instanceof FormData
  const waitMs = timeoutMs ?? (isUpload ? 120_000 : 60_000)

  let lastError: unknown = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), waitMs)
    try {
      const res = await fetch(path, {
        ...init,
        signal: controller.signal,
      })
      window.clearTimeout(timer)
      return res
    } catch (err) {
      window.clearTimeout(timer)
      lastError = err
      if (attempt < retries && isNetworkError(err)) {
        await sleep(2000 * (attempt + 1))
        continue
      }
      break
    }
  }

  if (isNetworkError(lastError)) {
    throw new Error(networkErrorMessage())
  }
  throw lastError instanceof Error ? lastError : new Error('Request failed')
}

async function parse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || 'Request failed')
  }
  return data as T
}

export async function wakeServer() {
  const res = await apiFetch('/api/health', { retries: 4, timeoutMs: 90_000 })
  return parse<{ ok: boolean }>(res)
}

export async function registerFarmer(input: { name: string; phone: string; password: string }) {
  const res = await apiFetch('/api/farmers/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parse<Farmer>(res)
}

export async function loginFarmer(input: { phone: string; password: string }) {
  const res = await apiFetch('/api/farmers/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parse<Farmer>(res)
}

export async function getFarmer(farmerId: string) {
  const res = await apiFetch(`/api/farmers/${farmerId}`)
  return parse<Farmer>(res)
}

export async function listProducts(query: Query) {
  const q = new URLSearchParams()
  if (query.query) q.set('query', query.query)
  if (query.crop) q.set('crop', query.crop)
  if (Number.isFinite(query.lat)) q.set('lat', String(query.lat))
  if (Number.isFinite(query.lng)) q.set('lng', String(query.lng))
  if (Number.isFinite(query.maxDistance)) q.set('maxDistance', String(query.maxDistance))
  q.set('sort', query.sort || 'latest')

  const res = await apiFetch(`/api/products?${q.toString()}`)
  return parse<Product[]>(res)
}

export async function getProductDetails(productId: string, location?: { lat?: number; lng?: number }) {
  const q = new URLSearchParams()
  if (Number.isFinite(location?.lat)) q.set('lat', String(location?.lat))
  if (Number.isFinite(location?.lng)) q.set('lng', String(location?.lng))
  const queryString = q.toString()
  const res = await apiFetch(`/api/products/${productId}${queryString ? `?${queryString}` : ''}`)
  return parse<{ product: Product; related: Product[]; nearby: Product[] }>(res)
}

export async function listMyProducts(farmerId: string) {
  const res = await apiFetch(`/api/farmers/${farmerId}/products`)
  return parse<Product[]>(res)
}

export async function addProduct(input: {
  farmerId: string
  cropName: string
  quantity: string
  unit: string
  pricePerUnit?: string
  location?: string
  latitude?: number
  longitude?: number
  photos: File[]
}) {
  const form = new FormData()
  form.set('farmerId', input.farmerId)
  form.set('cropName', input.cropName)
  form.set('quantity', input.quantity)
  form.set('unit', input.unit)
  if (input.pricePerUnit) form.set('pricePerUnit', input.pricePerUnit)
  if (input.location) form.set('location', input.location)
  if (Number.isFinite(input.latitude)) form.set('latitude', String(input.latitude))
  if (Number.isFinite(input.longitude)) form.set('longitude', String(input.longitude))
  for (const file of input.photos) form.append('photos', file)

  const res = await apiFetch('/api/products', { method: 'POST', body: form, retries: 1 })
  return parse<Product>(res)
}

export async function deleteProduct(productId: string, farmerId: string) {
  const res = await apiFetch(`/api/products/${productId}?farmerId=${encodeURIComponent(farmerId)}`, {
    method: 'DELETE',
  })
  return parse<{ ok: boolean }>(res)
}

export async function updateProduct(input: {
  productId: string
  farmerId: string
  cropName: string
  quantity: string
  unit: string
  pricePerUnit?: string
  location?: string
}) {
  const res = await apiFetch(`/api/products/${input.productId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      farmerId: input.farmerId,
      cropName: input.cropName,
      quantity: input.quantity,
      unit: input.unit,
      pricePerUnit: input.pricePerUnit,
      location: input.location,
    }),
  })
  return parse<Product>(res)
}

export async function registerCall(productId: string) {
  const res = await apiFetch(`/api/products/${productId}/call`, { method: 'POST' })
  return parse<{ tel: string }>(res)
}
