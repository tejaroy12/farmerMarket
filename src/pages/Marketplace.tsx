import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Product } from '../lib/types'
import { Carousel } from '../components/Carousel'
import { listProducts, registerCall } from '../lib/api'
import { io } from 'socket.io-client'

function ProductCard({ p }: { p: Product }) {
  const nav = useNavigate()
  const photos = p.photos ?? []

  async function onBuy() {
    try {
      const r = await registerCall(p.id)
      window.location.href = r.tel
    } catch {
      alert('Could not start call right now.')
    }
  }

  return (
    <article className="card">
      <div className="card-media">
        {photos.length > 0 ? (
          <Carousel
            images={photos}
            alt={`${p.cropName} photo`}
            onImageClick={() => nav(`/product/${p.id}`)}
          />
        ) : (
          <div className="img-placeholder">No photo</div>
        )}
      </div>

      <div className="card-body">
        <div className="card-title-row">
          <Link to={`/product/${p.id}`} className="card-title-link">
            <h3 className="card-title">{p.cropName}</h3>
          </Link>
          <span className="pill">
            {p.quantity} {p.unit}
          </span>
        </div>

        <div className="muted">
          Seller: <b>{p.farmerName}</b>
        </div>
        {p.location ? <div className="muted">Location: {p.location}</div> : null}
        {typeof p.pricePerUnit === 'number' ? (
          <div className="muted">
            Price: ₹{p.pricePerUnit} / {p.unit}
          </div>
        ) : null}
        {Number.isFinite(p.distanceKm) ? <div className="muted">Distance: {p.distanceKm?.toFixed(1)} km</div> : null}
        <div className="muted">Calls made: {p.callCount}</div>

        <div className="card-actions">
          <button className="btn btn-primary" type="button" onClick={onBuy}>
            Buy (Call)
          </button>
        </div>
      </div>
    </article>
  )
}

export default function Marketplace() {
  const [q, setQ] = useState('')
  const [cropFilter, setCropFilter] = useState('')
  const [maxDistance, setMaxDistance] = useState('')
  const [sort, setSort] = useState<'latest' | 'nearest'>('latest')
  const [lat, setLat] = useState<number | undefined>(undefined)
  const [lng, setLng] = useState<number | undefined>(undefined)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [liveViewers, setLiveViewers] = useState(1)
  const [locationStatus, setLocationStatus] = useState('')

  useEffect(() => {
    const slat = sessionStorage.getItem('buyer_lat')
    const slng = sessionStorage.getItem('buyer_lng')
    if (slat && slng) {
      const plat = Number(slat)
      const plng = Number(slng)
      if (Number.isFinite(plat) && Number.isFinite(plng)) {
        setLat(plat)
        setLng(plng)
        setLocationStatus('Using saved location')
      }
    }
  }, [])

  async function refreshProducts() {
    setLoading(true)
    try {
      const data = await listProducts({
        query: q.trim() || undefined,
        crop: cropFilter.trim() || undefined,
        maxDistance: maxDistance && Number.isFinite(lat) && Number.isFinite(lng) ? Number(maxDistance) : undefined,
        lat,
        lng,
        sort,
      })
      setProducts(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, cropFilter, maxDistance, sort, lat, lng])

  useEffect(() => {
    const socket = io()
    socket.on('viewers', (count: number) => setLiveViewers(count))
    socket.on('products:updated', () => refreshProducts())
    return () => {
      socket.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function detectLocation() {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation not supported on this device')
      return
    }
    setLocationStatus('Fetching your location...')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const clat = pos.coords.latitude
        const clng = pos.coords.longitude
        setLat(clat)
        setLng(clng)
        sessionStorage.setItem('buyer_lat', String(clat))
        sessionStorage.setItem('buyer_lng', String(clng))
        if (sort === 'latest') setSort('nearest')
        setLocationStatus('Location added')
      },
      (err) => {
        setLocationStatus(
          err.code === 1
            ? 'Location permission denied. Please allow location.'
            : 'Could not fetch location now.',
        )
      },
      { enableHighAccuracy: true, timeout: 12000 },
    )
  }

  const cropOptions = useMemo(() => {
    const uniq = new Set<string>()
    for (const p of products) uniq.add(p.cropName)
    return Array.from(uniq).sort((a, b) => a.localeCompare(b))
  }, [products])

  return (
    <div className="stack">
      <section className="hero2">
        <div>
          <h1 className="h1">Buy fresh crops directly from farmers</h1>
          <p className="sub">
            Click <b>Buy</b> to call the farmer instantly.
          </p>
          <p className="muted small">Live viewers: {liveViewers}</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={refreshProducts}>
          Refresh
        </button>
      </section>

      <section className="toolbar">
        <input
          className="input"
          placeholder="Search crop / farmer / location..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input" value={cropFilter} onChange={(e) => setCropFilter(e.target.value)}>
          <option value="">All crops</option>
          {cropOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          className="input"
          placeholder="Max distance in km"
          inputMode="decimal"
          value={maxDistance}
          onChange={(e) => {
            setMaxDistance(e.target.value)
            if (Number.isFinite(lat) && Number.isFinite(lng)) setSort('nearest')
          }}
          disabled={!Number.isFinite(lat) || !Number.isFinite(lng)}
        />
        <select className="input" value={sort} onChange={(e) => setSort(e.target.value as 'latest' | 'nearest')}>
          <option value="latest">Latest</option>
          <option value="nearest">Nearest</option>
        </select>
        <button className="btn btn-ghost" type="button" onClick={detectLocation}>
          Use my location
        </button>
      </section>
      {locationStatus ? <p className="muted small">{locationStatus}</p> : null}
      {maxDistance && (!Number.isFinite(lat) || !Number.isFinite(lng)) ? (
        <p className="muted small">Enable location to use max distance filter.</p>
      ) : null}

      {loading ? (
        <div className="empty">
          <div className="loader" />
          <h2>Loading products...</h2>
        </div>
      ) : products.length === 0 ? (
        <div className="empty">
          <h2>No products yet</h2>
          <p className="muted">Farmers can login and add crops.</p>
        </div>
      ) : (
        <section className="grid">
          {products.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </section>
      )}
    </div>
  )
}

