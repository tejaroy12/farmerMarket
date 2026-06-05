import { Link, NavLink } from 'react-router-dom'
import { clearSession, getSessionFarmerId } from '../lib/storage'

export function Layout({ children }: { children: React.ReactNode }) {
  const farmerId = getSessionFarmerId()

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">
          FarmerMarket
        </Link>

        <nav className="nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            Marketplace
          </NavLink>
          <NavLink
            to={farmerId ? '/farmer/dashboard' : '/farmer'}
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            Farmer
          </NavLink>
        </nav>

        <div className="topbar-actions">
          {farmerId ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                clearSession()
                window.location.href = '/'
              }}
            >
              Logout
            </button>
          ) : (
            <Link className="btn btn-ghost" to="/farmer">
              Login
            </Link>
          )}
        </div>
      </header>

      <main className="container">{children}</main>

      <footer className="footer" />
    </div>
  )
}

