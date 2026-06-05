import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import Marketplace from './pages/Marketplace'
import FarmerAuth from './pages/FarmerAuth'
import FarmerDashboard from './pages/FarmerDashboard'
import ProductDetails from './pages/ProductDetails'
import { wakeServer } from './lib/api'
import { getSessionFarmerId } from './lib/storage'

export default function App() {
  const farmerId = getSessionFarmerId()
  const [serverReady, setServerReady] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    wakeServer()
      .then(() => {
        if (!cancelled) {
          setServerReady(true)
          setServerError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setServerReady(true)
          setServerError(err instanceof Error ? err.message : 'Could not connect to server')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!serverReady) {
    return (
      <div className="empty">
        <div className="loader" />
        <h2>Connecting to server...</h2>
        <p className="muted">First load can take up to 60 seconds on free hosting.</p>
      </div>
    )
  }

  return (
    <Layout>
      {serverError ? (
        <div className="error banner-error" role="alert">
          {serverError}
        </div>
      ) : null}
      <Routes>
        <Route path="/" element={<Marketplace />} />
        <Route path="/product/:id" element={<ProductDetails />} />
        <Route path="/farmer" element={<FarmerAuth />} />
        <Route path="/farmer/dashboard" element={<FarmerDashboard />} />
        <Route path="*" element={<Navigate to={farmerId ? '/farmer/dashboard' : '/'} replace />} />
      </Routes>
    </Layout>
  )
}
