import type { Farmer } from './types'

const KEY_FARMER = 'fm_farmer_v2'
const KEY_SESSION = 'fm_session_farmer_id_v1'

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function getFarmers(): Farmer[] {
  const farmer = safeParse<Farmer | null>(localStorage.getItem(KEY_FARMER), null)
  return farmer ? [farmer] : []
}

export function setFarmers(farmers: Farmer[]) {
  const farmer = farmers[0] ?? null
  try {
    if (farmer) localStorage.setItem(KEY_FARMER, JSON.stringify(farmer))
    else localStorage.removeItem(KEY_FARMER)
  } catch {
    // Mobile private mode can block storage writes.
  }
}

export function getSessionFarmerId(): string | null {
  try {
    return localStorage.getItem(KEY_SESSION)
  } catch {
    return null
  }
}

export function setSessionFarmerId(farmerId: string) {
  try {
    localStorage.setItem(KEY_SESSION, farmerId)
  } catch {
    // Mobile private mode can block storage writes.
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY_SESSION)
    localStorage.removeItem(KEY_FARMER)
  } catch {
    // Ignore storage errors on mobile browsers.
  }
}

