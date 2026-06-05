import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Farmer } from '../lib/types'
import { clearSession, getFarmers, getSessionFarmerId, setFarmers, setSessionFarmerId } from '../lib/storage'
import { normalizePhone } from '../lib/util'
import { getFarmer, loginFarmer, registerFarmer } from '../lib/api'

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
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const farmers = useMemo(() => getFarmers(), [])

  useEffect(() => {
    const id = getSessionFarmerId()
    if (!id) return

    let cancelled = false
    getFarmer(id)
      .then((farmer) => {
        if (cancelled) return
        setFarmers([farmer])
        nav('/farmer/dashboard', { replace: true })
      })
      .catch(() => {
        if (cancelled) return
        clearSession()
        setError('Your previous login expired. Please login or register again.')
      })

    return () => {
      cancelled = true
    }
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
            <div className="password-field">
              <input
                className="input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M12 6.5c3.86 0 7.22 2.46 8.38 6-1.16 3.54-4.52 6-8.38 6s-7.22-2.46-8.38-6C4.78 8.96 8.14 6.5 12 6.5m0-2C6.73 4.5 2.27 7.61 1 12c1.27 4.39 5.73 7.5 11 7.5s9.73-3.11 11-7.5C21.73 7.61 17.27 4.5 12 4.5m0 5a2.5 2.5 0 0 1 2.5 2.5A2.5 2.5 0 0 1 12 14.5 2.5 2.5 0 0 1 9.5 12 2.5 2.5 0 0 1 12 9.5m0 2A.5.5 0 0 0 11.5 12 .5.5 0 0 0 12 12.5.5.5 0 0 0 12.5 12 .5.5 0 0 0 12 11.5"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5m0 14a6.5 6.5 0 0 1-6.5-6.5A6.5 6.5 0 0 1 12 5.5 6.5 6.5 0 0 1 18.5 12 6.5 6.5 0 0 1 12 18.5M12 8a4 4 0 0 0-4 4 4 4 0 0 0 4 4 4 4 0 0 0 4-4 4 4 0 0 0-4-4"
                    />
                  </svg>
                )}
              </button>
            </div>
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

