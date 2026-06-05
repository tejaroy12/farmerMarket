import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Product, Unit } from '../lib/types'
import { clearSession, getFarmers, getSessionFarmerId } from '../lib/storage'
import { Carousel } from '../components/Carousel'
import { addProduct, deleteProduct, listMyProducts, updateProduct } from '../lib/api'

const UNITS: Unit[] = ['kg', 'quintal', 'ton', 'bags', 'pcs']
const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'te', name: 'తెలుగు (Telugu)' },
  { code: 'hi', name: 'हिंदी (Hindi)' },
  { code: 'ta', name: 'தமிழ் (Tamil)' },
  { code: 'kn', name: 'ಕನ್ನಡ (Kannada)' },
  { code: 'ml', name: 'മലയാളം (Malayalam)' },
  { code: 'mr', name: 'मराठी (Marathi)' },
  { code: 'bn', name: 'বাংলা (Bengali)' },
  { code: 'gu', name: 'ગુજરાતી (Gujarati)' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ (Punjabi)' },
]

const LABELS = {
  en: {
    addProduct: 'Add a product',
    cropName: 'Crop name',
    quantity: 'Quantity',
    unit: 'Unit',
    price: 'Price / unit (optional)',
    location: 'Location (optional)',
    photos: 'Photos (1 mandatory + up to 4 optional, each under 2MB)',
    preview: 'Preview',
    addListing: 'Add listing',
  },
  te: {
    addProduct: 'ఉత్పత్తి చేర్చండి',
    cropName: 'పంట పేరు',
    quantity: 'పరిమాణం',
    unit: 'యూనిట్',
    price: 'ధర / యూనిట్ (ఐచ్ఛికం)',
    location: 'ప్రదేశం (ఐచ్ఛికం)',
    photos: 'ఫోటోలు (1 తప్పనిసరి + 4 ఐచ్ఛికం, ఒక్కోటి 2MB లోపు)',
    preview: 'ప్రివ్యూ',
    addListing: 'లిస్టింగ్ చేర్చండి',
  },
  hi: {
    addProduct: 'उत्पाद जोड़ें',
    cropName: 'फसल का नाम',
    quantity: 'मात्रा',
    unit: 'इकाई',
    price: 'कीमत / इकाई (वैकल्पिक)',
    location: 'स्थान (वैकल्पिक)',
    photos: 'फोटो (1 अनिवार्य + 4 वैकल्पिक, प्रत्येक 2MB से कम)',
    preview: 'पूर्वावलोकन',
    addListing: 'लिस्टिंग जोड़ें',
  },
} as const

export default function FarmerDashboard() {
  const nav = useNavigate()
  const filesRef = useRef<HTMLInputElement | null>(null)

  const farmerId = getSessionFarmerId()
  const farmer = useMemo(() => {
    if (!farmerId) return null
    return getFarmers().find((f) => f.id === farmerId) ?? null
  }, [farmerId])

  const [cropName, setCropName] = useState('')
  const [quantity, setQuantity] = useState<string>('')
  const [unit, setUnit] = useState<Unit>('kg')
  const [pricePerUnit, setPricePerUnit] = useState<string>('')
  const [location, setLocation] = useState('')
  const [latitude, setLatitude] = useState<number | undefined>(undefined)
  const [longitude, setLongitude] = useState<number | undefined>(undefined)
  const [photos, setPhotos] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [myProducts, setMyProducts] = useState<Product[]>([])
  const [busy, setBusy] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [language, setLanguage] = useState('en')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCropName, setEditCropName] = useState('')
  const [editQuantity, setEditQuantity] = useState('')
  const [editUnit, setEditUnit] = useState<Unit>('kg')
  const [editPrice, setEditPrice] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const t = LABELS[language as keyof typeof LABELS] || LABELS.en

  if (!farmerId || !farmer) {
    return (
      <div className="empty">
        <h2>You are not logged in</h2>
        <p className="muted">Please login as a farmer to add products.</p>
        <Link className="btn btn-primary" to="/farmer">
          Go to login
        </Link>
      </div>
    )
  }

  async function onPickPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? [])
    if (list.length === 0) return
    if (photos.length + list.length > 5) {
      setError('Please select maximum 5 photos.')
      return
    }

    for (const f of list) {
      if (!f.type.startsWith('image/')) {
        setError('Please select only image files.')
        return
      }
      if (f.size > 2 * 1024 * 1024) {
        setError('Each image must be under 2MB.')
        return
      }
    }

    setError(null)
    setPhotos((prev) => [...prev, ...list])
    setPreviewUrls((prev) => [...prev, ...list.map((f) => URL.createObjectURL(f))])
  }

  function resetForm() {
    setCropName('')
    setQuantity('')
    setUnit('kg')
    setPricePerUnit('')
    setLocation('')
    setLatitude(undefined)
    setLongitude(undefined)
    setPhotos([])
    setPreviewUrls([])
    if (filesRef.current) filesRef.current.value = ''
  }

  function clearSelectedPhotos() {
    setPhotos([])
    setPreviewUrls([])
    if (filesRef.current) filesRef.current.value = ''
  }

  async function refreshMine() {
    if (!farmerId) return
    setLoadingProducts(true)
    try {
      setMyProducts(await listMyProducts(farmerId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products')
    } finally {
      setLoadingProducts(false)
    }
  }

  useEffect(() => {
    refreshMine()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmerId])

  useEffect(() => {
    return () => {
      for (const url of previewUrls) URL.revokeObjectURL(url)
    }
  }, [previewUrls])

  function onUseCurrentLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported in this browser.')
      return
    }
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude)
        setLongitude(pos.coords.longitude)
      },
      () => setError('Could not read location. Please allow location permission.'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!farmer) {
      setError('Please login again.')
      return
    }

    const cn = cropName.trim()
    if (!cn) {
      setError('Enter crop name.')
      return
    }
    const qty = Number(quantity)
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Enter valid quantity (> 0).')
      return
    }
    const price = pricePerUnit.trim() ? Number(pricePerUnit) : undefined
    if (pricePerUnit.trim() && (!Number.isFinite(price) || (price ?? 0) < 0)) {
      setError('Enter valid price or leave it empty.')
      return
    }

    if (photos.length < 1) {
      setError('Please add at least 1 photo (mandatory).')
      return
    }

    setBusy(true)
    try {
      await addProduct({
        farmerId: farmer.id,
        cropName: cn,
        quantity: String(qty),
        unit,
        pricePerUnit: pricePerUnit.trim() ? pricePerUnit : undefined,
        location: location.trim() || undefined,
        latitude,
        longitude,
        photos,
      })
      resetForm()
      await refreshMine()
    } finally {
      setBusy(false)
    }
  }

  async function removeProduct(id: string) {
    if (!farmerId) return
    await deleteProduct(id, farmerId)
    await refreshMine()
  }

  function startEdit(p: Product) {
    setEditingId(p.id)
    setEditCropName(p.cropName)
    setEditQuantity(String(p.quantity))
    setEditUnit(p.unit)
    setEditPrice(typeof p.pricePerUnit === 'number' ? String(p.pricePerUnit) : '')
    setEditLocation(p.location || '')
  }

  async function saveEdit() {
    if (!editingId || !farmerId) return
    await updateProduct({
      productId: editingId,
      farmerId,
      cropName: editCropName.trim(),
      quantity: editQuantity.trim(),
      unit: editUnit,
      pricePerUnit: editPrice.trim() || undefined,
      location: editLocation.trim() || undefined,
    })
    setEditingId(null)
    await refreshMine()
  }

  return (
    <div className="stack">
      <section className="dashboard-head">
        <div>
          <h1 className="h1">Hello, {farmer.name}</h1>
          <p className="muted">Add your crop listings. Buyers will call you when they click Buy.</p>
        </div>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => {
            clearSession()
            nav('/')
          }}
        >
          Logout
        </button>
      </section>

      <section className="panel">
        <div className="panel-title-row">
          <h2 className="h2">My listings</h2>
          <div className="card-actions">
            <button type="button" className="btn btn-primary" onClick={() => setShowAddForm((x) => !x)}>
              {showAddForm ? 'Hide Add Crop' : 'Add Crop'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={refreshMine}>
              Refresh
            </button>
          </div>
        </div>
      </section>

      {showAddForm ? (
        <section className="panel">
        <h2 className="h2">{t.addProduct}</h2>
        <form className="grid-form" onSubmit={onAdd}>
          <label className="field">
            <span className="label">{t.cropName}</span>
            <input className="input" value={cropName} onChange={(e) => setCropName(e.target.value)} />
          </label>

          <label className="field">
            <span className="label">{t.quantity}</span>
            <input
              className="input"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 50"
            />
          </label>

          <label className="field">
            <span className="label">{t.unit}</span>
            <select className="input" value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="label">{t.price}</span>
            <input
              className="input"
              inputMode="decimal"
              value={pricePerUnit}
              onChange={(e) => setPricePerUnit(e.target.value)}
              placeholder="e.g. 40"
            />
          </label>

          <label className="field">
            <span className="label">{t.location}</span>
            <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
          </label>

          <label className="field">
            <span className="label">{t.photos}</span>
            <input
              ref={filesRef}
              className="input"
              type="file"
              accept="image/*"
              multiple
              onChange={onPickPhotos}
            />
          </label>
          <div className="field">
            <span className="label">Language</span>
            <select className="input" value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
            <span className="muted small">
              Dashboard language preference: {LANGUAGES.find((x) => x.code === language)?.name || 'English'}
            </span>
          </div>
          <div className="field">
            <span className="label">Location matching</span>
            <button type="button" className="btn btn-ghost" onClick={onUseCurrentLocation}>
              Use my current location
            </button>
            <span className="muted small">
              {Number.isFinite(latitude) && Number.isFinite(longitude)
                ? `Location saved (${latitude?.toFixed(4)}, ${longitude?.toFixed(4)})`
                : 'Optional: helps customers find nearest farmers'}
            </span>
          </div>

          <div className="field">
            <span className="label">Preview</span>
            <div className="photo-preview">
              {previewUrls.length > 0 ? (
                <Carousel images={previewUrls} alt="Selected photos preview" />
              ) : (
                <span className="muted">No photo</span>
              )}
            </div>
            {previewUrls.length > 0 ? (
              <div className="thumb-row">
                {previewUrls.slice(0, 5).map((url, i) => (
                  <img key={`${url}_${i}`} src={url} alt={`preview-${i + 1}`} />
                ))}
              </div>
            ) : null}
            {previewUrls.length > 0 ? (
              <button type="button" className="btn btn-ghost" onClick={clearSelectedPhotos}>
                Clear selected photos
              </button>
            ) : null}
          </div>

          {error ? (
            <div className="error form-wide" role="alert">
              {error}
            </div>
          ) : null}

          <div className="form-wide actions-row">
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Posting...' : t.addListing}
            </button>
            <Link className="btn btn-ghost" to="/">
              View marketplace
            </Link>
          </div>
        </form>
      </section>
      ) : null}

      <section className="panel">
        <div className="panel-title-row">
          <h2 className="h2">My listings</h2>
        </div>

        {loadingProducts ? (
          <div className="stack">
            <div className="loader" />
            <p className="muted">Loading products...</p>
          </div>
        ) : myProducts.length === 0 ? (
          <p className="muted">No listings yet.</p>
        ) : (
          <div className="list">
            {myProducts.map((p) => (
              <div key={p.id} className="list-row">
                <div className="list-main">
                  <div className="list-title">
                    <b>{p.cropName}</b> — {p.quantity} {p.unit}
                  </div>
                  <div className="muted small">
                    {p.location ? `${p.location} • ` : ''}
                    {typeof p.pricePerUnit === 'number' ? ` • ₹${p.pricePerUnit}/${p.unit}` : ''}
                    {' • '}
                    Calls: {p.callCount}
                  </div>
                </div>
                <button type="button" className="btn btn-danger" onClick={() => removeProduct(p.id)}>
                  Delete
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => startEdit(p)}>
                  Edit
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {editingId ? (
        <section className="panel">
          <h2 className="h2">Edit listing</h2>
          <div className="grid-form">
            <label className="field">
              <span className="label">Crop name</span>
              <input className="input" value={editCropName} onChange={(e) => setEditCropName(e.target.value)} />
            </label>
            <label className="field">
              <span className="label">Quantity</span>
              <input className="input" value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)} />
            </label>
            <label className="field">
              <span className="label">Unit</span>
              <select className="input" value={editUnit} onChange={(e) => setEditUnit(e.target.value as Unit)}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">Price</span>
              <input className="input" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
            </label>
            <label className="field form-wide">
              <span className="label">Location</span>
              <input className="input" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} />
            </label>
            <div className="form-wide actions-row">
              <button type="button" className="btn btn-primary" onClick={saveEdit}>
                Save changes
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setEditingId(null)}>
                Cancel
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}

