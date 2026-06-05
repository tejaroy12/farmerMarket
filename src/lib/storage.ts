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
  if (farmer) localStorage.setItem(KEY_FARMER, JSON.stringify(farmer))
  else localStorage.removeItem(KEY_FARMER)
}

export function getSessionFarmerId(): string | null {
  return localStorage.getItem(KEY_SESSION)
}

export function setSessionFarmerId(farmerId: string) {
  localStorage.setItem(KEY_SESSION, farmerId)
}

export function clearSession() {
  localStorage.removeItem(KEY_SESSION)
}

