import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Carousel } from '../components/Carousel'
import { getProductDetails, registerCall } from '../lib/api'
import { openPhoneDialer } from '../lib/util'
import type { Product } from '../lib/types'

function ProductMiniCard({ p }: { p: Product }) {
  return (
    <Link className="mini-card" to={`/product/${p.id}`}>
      <div className="mini-thumb">
        {p.photos?.[0] ? <img src={p.photos[0]} alt={p.cropName} /> : <div className="img-placeholder">No photo</div>}
      </div>
      <div className="mini-body">
        <b>{p.cropName}</b>
        <span className="muted small">
          {p.quantity} {p.unit}
          {p.location ? ` • ${p.location}` : ''}
        </span>
      </div>
    </Link>
  )
}

export default function ProductDetails() {
  const { id } = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [related, setRelated] = useState<Product[]>([])
  const [nearby, setNearby] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const lat = sessionStorage.getItem('buyer_lat')
    const lng = sessionStorage.getItem('buyer_lng')
    setLoading(true)
    setError(null)
    getProductDetails(id, {
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined,
    })
      .then((res) => {
        setProduct(res.product)
        setRelated(res.related)
        setNearby(res.nearby)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load product'))
      .finally(() => setLoading(false))
  }, [id])

  async function onBuy() {
    if (!product) return
    try {
      const r = await registerCall(product.id)
      openPhoneDialer(r.tel)
    } catch {
      alert('Could not start call right now.')
    }
  }

  if (loading) {
    return (
      <div className="empty">
        <div className="loader" />
        <h2>Loading details...</h2>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="empty">
        <h2>Could not open product</h2>
        <p className="muted">{error || 'Not found'}</p>
        <Link className="btn btn-ghost" to="/">
          Back to marketplace
        </Link>
      </div>
    )
  }

  const suggestions = related.length > 0 ? related : nearby

  return (
    <div className="stack">
      <section className="product-detail">
        <div className="product-media">
          <Carousel images={product.photos || []} alt={product.cropName} />
          <div className="thumb-row">
            {(product.photos || []).slice(0, 5).map((photo, i) => (
              <img key={`${product.id}_${i}`} src={photo} alt={`${product.cropName}-${i + 1}`} />
            ))}
          </div>
        </div>

        <div className="product-info">
          <h1 className="h1">{product.cropName}</h1>
          <p className="muted">
            Seller: <b>{product.farmerName}</b>
          </p>
          <p className="muted">
            Quantity: {product.quantity} {product.unit}
          </p>
          {typeof product.pricePerUnit === 'number' ? (
            <p className="muted">
              Price: ₹{product.pricePerUnit}/{product.unit}
            </p>
          ) : null}
          {product.location ? <p className="muted">Location: {product.location}</p> : null}
          {Number.isFinite(product.distanceKm) ? <p className="muted">Distance: {product.distanceKm?.toFixed(1)} km</p> : null}
          <p className="muted">Calls made: {product.callCount}</p>
          <div className="card-actions">
            <button className="btn btn-primary" type="button" onClick={onBuy}>
              Buy (Call)
            </button>
            <Link className="btn btn-ghost" to="/">
              Back
            </Link>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2 className="h2">
          {related.length > 0
            ? `Available same crop (${product.cropName})`
            : nearby.length > 0
              ? 'Similar or nearby crops'
              : 'More crops'}
        </h2>
        {suggestions.length === 0 ? (
          <p className="muted">No suggestions found yet.</p>
        ) : (
          <div className="mini-grid">
            {suggestions.map((p) => (
              <ProductMiniCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

