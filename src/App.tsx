import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import Marketplace from './pages/Marketplace'
import FarmerAuth from './pages/FarmerAuth'
import FarmerDashboard from './pages/FarmerDashboard'
import ProductDetails from './pages/ProductDetails'
import { getSessionFarmerId } from './lib/storage'

export default function App() {
  const farmerId = getSessionFarmerId()

  return (
    <Layout>
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
