import cors from 'cors'
import Database from 'better-sqlite3'
import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { createServer } from 'node:http'
import multer from 'multer'
import { Server as SocketServer } from 'socket.io'

const app = express()
const httpServer = createServer(app)
const io = new SocketServer(httpServer, {
  cors: { origin: '*' },
})

const PORT = Number(process.env.PORT || 4000)
const rootDir = process.cwd()
const dataDir = path.join(rootDir, 'server', 'data')
const uploadDir = path.join(rootDir, 'server', 'uploads')
fs.mkdirSync(dataDir, { recursive: true })
fs.mkdirSync(uploadDir, { recursive: true })

const db = new Database(path.join(dataDir, 'market.db'))
db.pragma('journal_mode = WAL')
db.exec(`
CREATE TABLE IF NOT EXISTS farmers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL,
  farmer_name TEXT NOT NULL,
  farmer_phone TEXT NOT NULL,
  crop_name TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  price_per_unit REAL,
  location_text TEXT,
  latitude REAL,
  longitude REAL,
  call_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS product_photos (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  photo_url TEXT NOT NULL
);
`)

app.use(cors())
app.use(express.json({ limit: '2mb' }))
app.use('/uploads', express.static(uploadDir))

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const safe = `${Date.now()}_${Math.round(Math.random() * 1e9)}_${file.originalname.replace(/\s+/g, '_')}`
    cb(null, safe)
  },
})
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024, files: 5 },
})

function uid(prefix) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`
}

function normalizePhone(phone) {
  const trimmed = String(phone || '').trim()
  const keepPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/[^\d]/g, '')
  return keepPlus ? `+${digits}` : digits
}

function mapProductRow(row) {
  const photos = db
    .prepare('SELECT photo_url FROM product_photos WHERE product_id = ? ORDER BY id')
    .all(row.id)
    .map((x) => x.photo_url)
  return {
    id: row.id,
    farmerId: row.farmer_id,
    farmerName: row.farmer_name,
    cropName: row.crop_name,
    quantity: row.quantity,
    unit: row.unit,
    pricePerUnit: row.price_per_unit ?? undefined,
    location: row.location_text ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    callCount: row.call_count ?? 0,
    photos,
    createdAt: row.created_at,
  }
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

app.post('/api/farmers/register', (req, res) => {
  const name = String(req.body?.name || '').trim()
  const password = String(req.body?.password || '').trim()
  const phone = normalizePhone(req.body?.phone)

  if (!name) return res.status(400).json({ error: 'Name is required.' })
  if (phone.length < 10) return res.status(400).json({ error: 'Valid phone is required.' })
  if (password.length < 4) return res.status(400).json({ error: 'Password must be 4+ chars.' })

  const existing = db.prepare('SELECT id FROM farmers WHERE phone = ?').get(phone)
  if (existing) return res.status(409).json({ error: 'Phone already registered.' })

  const id = uid('farmer')
  db.prepare('INSERT INTO farmers (id, name, phone, password, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, name, phone, password, Date.now())
  res.json({ id, name, phone })
})

app.post('/api/farmers/login', (req, res) => {
  const phone = normalizePhone(req.body?.phone)
  const password = String(req.body?.password || '').trim()
  const farmer = db.prepare('SELECT id, name, phone, password FROM farmers WHERE phone = ?').get(phone)
  if (!farmer || farmer.password !== password) {
    return res.status(401).json({ error: 'Invalid phone or password.' })
  }
  res.json({ id: farmer.id, name: farmer.name, phone: farmer.phone })
})

app.get('/api/farmers/:id', (req, res) => {
  const farmer = db.prepare('SELECT id, name, phone FROM farmers WHERE id = ?').get(req.params.id)
  if (!farmer) return res.status(404).json({ error: 'Farmer not found.' })
  res.json(farmer)
})

app.get('/api/farmers/:id/products', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM products WHERE farmer_id = ? ORDER BY created_at DESC')
    .all(req.params.id)
  res.json(rows.map(mapProductRow))
})

app.post('/api/products', upload.array('photos', 5), (req, res) => {
  const farmerId = String(req.body?.farmerId || '')
  const cropName = String(req.body?.cropName || '').trim()
  const unit = String(req.body?.unit || '').trim()
  const location = String(req.body?.location || '').trim()
  const quantity = Number(req.body?.quantity || 0)
  const pricePerUnit = req.body?.pricePerUnit ? Number(req.body.pricePerUnit) : null
  const latitude = req.body?.latitude ? Number(req.body.latitude) : null
  const longitude = req.body?.longitude ? Number(req.body.longitude) : null

  const farmer = db.prepare('SELECT id, name, phone FROM farmers WHERE id = ?').get(farmerId)
  if (!farmer) return res.status(400).json({ error: 'Farmer not found.' })
  if (!cropName) return res.status(400).json({ error: 'Crop name is required.' })
  if (!(quantity > 0)) return res.status(400).json({ error: 'Quantity must be > 0.' })
  if (!unit) return res.status(400).json({ error: 'Unit is required.' })

  const files = req.files || []
  if (files.length < 1) return res.status(400).json({ error: 'At least 1 photo is required.' })

  const id = uid('prod')
  db.prepare(
    'INSERT INTO products (id, farmer_id, farmer_name, farmer_phone, crop_name, quantity, unit, price_per_unit, location_text, latitude, longitude, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(
    id,
    farmer.id,
    farmer.name,
    farmer.phone,
    cropName,
    quantity,
    unit,
    Number.isFinite(pricePerUnit) ? pricePerUnit : null,
    location || null,
    Number.isFinite(latitude) ? latitude : null,
    Number.isFinite(longitude) ? longitude : null,
    Date.now(),
  )

  const insertPhoto = db.prepare('INSERT INTO product_photos (id, product_id, photo_url) VALUES (?, ?, ?)')
  for (const file of files) {
    insertPhoto.run(uid('photo'), id, `/uploads/${file.filename}`)
  }

  io.emit('products:updated')
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id)
  res.json(mapProductRow(row))
})

app.delete('/api/products/:id', (req, res) => {
  const farmerId = String(req.query.farmerId || '')
  const id = req.params.id
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id)
  if (!row) return res.status(404).json({ error: 'Product not found.' })
  if (!farmerId || row.farmer_id !== farmerId) return res.status(403).json({ error: 'Forbidden.' })

  const photos = db.prepare('SELECT photo_url FROM product_photos WHERE product_id = ?').all(id)
  for (const photo of photos) {
    const p = path.join(rootDir, photo.photo_url.replace(/^\//, ''))
    if (fs.existsSync(p)) fs.unlinkSync(p)
  }
  db.prepare('DELETE FROM product_photos WHERE product_id = ?').run(id)
  db.prepare('DELETE FROM products WHERE id = ?').run(id)
  io.emit('products:updated')
  res.json({ ok: true })
})

app.put('/api/products/:id', (req, res) => {
  const farmerId = String(req.body?.farmerId || '')
  const id = req.params.id
  const cropName = String(req.body?.cropName || '').trim()
  const quantity = Number(req.body?.quantity || 0)
  const unit = String(req.body?.unit || '').trim()
  const location = String(req.body?.location || '').trim()
  const pricePerUnit = req.body?.pricePerUnit !== undefined ? Number(req.body.pricePerUnit) : null

  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id)
  if (!row) return res.status(404).json({ error: 'Product not found.' })
  if (!farmerId || row.farmer_id !== farmerId) return res.status(403).json({ error: 'Forbidden.' })
  if (!cropName) return res.status(400).json({ error: 'Crop name is required.' })
  if (!(quantity > 0)) return res.status(400).json({ error: 'Quantity must be > 0.' })
  if (!unit) return res.status(400).json({ error: 'Unit is required.' })
  if (req.body?.pricePerUnit !== undefined && (!Number.isFinite(pricePerUnit) || pricePerUnit < 0)) {
    return res.status(400).json({ error: 'Invalid price.' })
  }

  db.prepare(
    'UPDATE products SET crop_name = ?, quantity = ?, unit = ?, price_per_unit = ?, location_text = ? WHERE id = ?',
  ).run(cropName, quantity, unit, Number.isFinite(pricePerUnit) ? pricePerUnit : null, location || null, id)

  io.emit('products:updated')
  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id)
  res.json(mapProductRow(updated))
})

app.get('/api/products', (req, res) => {
  const query = String(req.query.query || '').trim().toLowerCase()
  const crop = String(req.query.crop || '').trim().toLowerCase()
  const lat = req.query.lat ? Number(req.query.lat) : null
  const lng = req.query.lng ? Number(req.query.lng) : null
  const maxDistance = req.query.maxDistance ? Number(req.query.maxDistance) : null
  const sort = String(req.query.sort || 'latest')

  const rows = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all()
  let products = rows.map((r) => {
    const p = mapProductRow(r)
    let distanceKm
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Number.isFinite(p.latitude) &&
      Number.isFinite(p.longitude)
    ) {
      distanceKm = haversineKm(lat, lng, p.latitude, p.longitude)
    }
    return { ...p, distanceKm }
  })

  if (query) {
    products = products.filter((p) => {
      return (
        p.cropName.toLowerCase().includes(query) ||
        p.farmerName.toLowerCase().includes(query) ||
        (p.location || '').toLowerCase().includes(query)
      )
    })
  }
  if (crop) products = products.filter((p) => p.cropName.toLowerCase().includes(crop))
  if (Number.isFinite(maxDistance)) {
    products = products.filter((p) => Number.isFinite(p.distanceKm) && p.distanceKm <= maxDistance)
  }
  if (sort === 'nearest') {
    products.sort((a, b) => {
      const ad = Number.isFinite(a.distanceKm) ? a.distanceKm : Number.POSITIVE_INFINITY
      const bd = Number.isFinite(b.distanceKm) ? b.distanceKm : Number.POSITIVE_INFINITY
      return ad - bd
    })
  } else {
    products.sort((a, b) => b.createdAt - a.createdAt)
  }
  res.json(products)
})

app.get('/api/products/:id', (req, res) => {
  const id = req.params.id
  const lat = req.query.lat ? Number(req.query.lat) : null
  const lng = req.query.lng ? Number(req.query.lng) : null
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id)
  if (!row) return res.status(404).json({ error: 'Product not found.' })

  const product = mapProductRow(row)
  if (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Number.isFinite(product.latitude) &&
    Number.isFinite(product.longitude)
  ) {
    product.distanceKm = haversineKm(lat, lng, product.latitude, product.longitude)
  }

  const allRows = db
    .prepare('SELECT * FROM products WHERE id <> ? ORDER BY created_at DESC LIMIT 120')
    .all(id)
    .map(mapProductRow)

  let related = allRows.filter((p) => p.cropName.toLowerCase() === product.cropName.toLowerCase())
  if (related.length === 0) {
    related = allRows.filter((p) =>
      p.cropName.toLowerCase().includes(product.cropName.toLowerCase().slice(0, 3)),
    )
  }

  let nearby = allRows
  if (
    Number.isFinite(product.latitude) &&
    Number.isFinite(product.longitude)
  ) {
    nearby = allRows
      .map((p) => {
        if (Number.isFinite(p.latitude) && Number.isFinite(p.longitude)) {
          return {
            ...p,
            distanceKm: haversineKm(product.latitude, product.longitude, p.latitude, p.longitude),
          }
        }
        return p
      })
      .sort((a, b) => {
        const ad = Number.isFinite(a.distanceKm) ? a.distanceKm : Number.POSITIVE_INFINITY
        const bd = Number.isFinite(b.distanceKm) ? b.distanceKm : Number.POSITIVE_INFINITY
        return ad - bd
      })
  }

  res.json({
    product,
    related: related.slice(0, 8),
    nearby: nearby.slice(0, 8),
  })
})

app.post('/api/products/:id/call', (req, res) => {
  const id = req.params.id
  const row = db.prepare('SELECT farmer_phone FROM products WHERE id = ?').get(id)
  if (!row) return res.status(404).json({ error: 'Product not found.' })
  db.prepare('UPDATE products SET call_count = call_count + 1 WHERE id = ?').run(id)
  io.emit('products:updated')
  res.json({ tel: `tel:${row.farmer_phone}` })
})

let activeViewers = 0
io.on('connection', (socket) => {
  activeViewers += 1
  io.emit('viewers', activeViewers)

  socket.on('disconnect', () => {
    activeViewers = Math.max(0, activeViewers - 1)
    io.emit('viewers', activeViewers)
  })
})

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Each image must be under 2MB.' })
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Please upload at most 5 photos.' })
    }
    return res.status(400).json({ error: err.message })
  }
  if (err) {
    console.error(err)
    return res.status(500).json({ error: 'Upload failed. Please try again.' })
  }
  next()
})

const distDir = path.join(rootDir, 'dist')
if (fs.existsSync(path.join(distDir, 'index.html'))) {
  app.use(express.static(distDir))
  app.use((req, res, next) => {
    if (
      req.method !== 'GET' ||
      req.path.startsWith('/api') ||
      req.path.startsWith('/uploads') ||
      req.path.startsWith('/socket.io')
    ) {
      return next()
    }
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})

