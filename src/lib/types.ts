export type Farmer = {
  id: string
  name: string
  phone: string
}

export type Unit = 'kg' | 'quintal' | 'ton' | 'bags' | 'pcs'

export type Product = {
  id: string
  farmerId: string
  farmerName: string
  cropName: string
  quantity: number
  unit: Unit
  pricePerUnit?: number
  location?: string
  latitude?: number
  longitude?: number
  distanceKm?: number
  callCount: number
  photos: string[]
  createdAt: number
}

