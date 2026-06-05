import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Farmer } from '../lib/types'
import { getFarmers, getSessionFarmerId, setFarmers, setSessionFarmerId } from '../lib/storage'
import { normalizePhone } from '../lib/util'
import { loginFarmer, registerFarmer } from '../lib/api'

function validatePhone(phone: string) {
  const normalized = normalizePhone(phone)
  if (normalized.length < 10) return null
  return normalized
}

export default function FarmerAuth() {
  const nav = useNavigate()

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const farmers = useMemo(() => getFarmers(), [])

  useEffect(() => {
    const id = getSessionFarmerId()
    if (id) nav('/farmer/dashboard', { replace: true })
  }, [nav])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const ph = validatePhone(phone)
    if (!ph) {
      setError('Enter a valid phone number (min 10 digits).')
      return
    }
    if (password.trim().length < 4) {
      setError('Password must be at least 4 characters.')
      return
    }

    setBusy(true)
    try {
      let farmer: Farmer
      if (mode === 'register') {
        if (!name.trim()) {
          setError('Enter your name.')
          return
        }
        farmer = await registerFarmer({ name: name.trim(), phone: ph, password: password.trim() })
      } else {
        farmer = await loginFarmer({ phone: ph, password: password.trim() })
      }
      setFarmers([farmer])
      setSessionFarmerId(farmer.id)
      nav('/farmer/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-head">
          <h1 className="h2">{mode === 'login' ? 'Farmer Login' : 'Farmer Registration'}</h1>
          <p className="muted">
            {mode === 'login'
              ? 'Login to add your crops.'
              : 'Register once, then add your crop listings with photos.'}
          </p>
        </div>

        <form className="stack" onSubmit={onSubmit}>
          {mode === 'register' ? (
            <label className="field">
              <span className="label">Name</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
          ) : null}

          <label className="field">
            <span className="label">Phone</span>
            <input
              className="input"
              inputMode="tel"
              placeholder="e.g. 9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>

          <label className="field">
            <span className="label">Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error ? <div className="error">{error}</div> : null}

          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create account'}
          </button>

          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => {
              setError(null)
              setMode((m) => (m === 'login' ? 'register' : 'login'))
            }}
          >
            {mode === 'login' ? 'New farmer? Register' : 'Already registered? Login'}
          </button>

          <div className="muted small">
            Buyer? Go to <Link to="/">Marketplace</Link>.
          </div>
          <div className="muted small">
            {farmers.length > 0 ? (
              <span>
                Tip: You already have {farmers.length} registered farmer(s) in this browser.
              </span>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  )
}

