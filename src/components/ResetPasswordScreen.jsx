import { useState } from 'react'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#050C14', panel: '#0C1C2E', border: '#1A3550',
  pri: '#E8F4F8', sec: '#7BACC8', dim: '#3D6080',
  gold: '#F5A623', cyan: '#00D4FF', green: '#00E5A0', red: '#FF5050',
}
const mono  = "'Share Tech Mono', monospace"
const sans  = "'DM Sans', sans-serif"
const bebas = "'Bebas Neue', 'Rajdhani', sans-serif"

export default function ResetPasswordScreen({ onDone }) {
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [success, setSuccess]     = useState(false)

  async function handleReset() {
    if (!password || !confirm) { setError('Both fields required'); return }
    if (password.length < 6)   { setError('Password must be at least 6 characters'); return }
    if (password !== confirm)   { setError('Passwords do not match'); return }

    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    // Give user a moment to read the success message, then hand off to app
    setTimeout(() => onDone?.(), 2500)
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
      backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(0,212,255,0.04) 0%, transparent 60%)',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontFamily: bebas, fontSize: 42, color: C.gold, letterSpacing: 5, lineHeight: 1 }}>PITCH</div>
          <div style={{ fontFamily: bebas, fontSize: 42, color: C.pri, letterSpacing: 5, lineHeight: 1, marginTop: -4 }}>INTELLIGENCE</div>
          <div style={{ fontFamily: mono, fontSize: 8, color: C.dim, letterSpacing: 4, marginTop: 6 }}>COMMAND CENTER</div>
        </div>

        {/* Card */}
        <div style={{
          background: C.panel, border: `1px solid ${C.border}`,
          borderRadius: 10, padding: 28,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}>
          <div style={{ fontFamily: mono, fontSize: 9, color: C.cyan, letterSpacing: 3, marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${C.border}` }}>
            SET NEW PASSWORD
          </div>

          {success ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontFamily: bebas, fontSize: 32, color: C.green, letterSpacing: 3, marginBottom: 8 }}>
                PASSWORD UPDATED
              </div>
              <div style={{ fontFamily: sans, fontSize: 13, color: C.sec }}>
                Signing you in…
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontFamily: sans, fontSize: 13, color: C.sec, marginBottom: 16, lineHeight: 1.5 }}>
                Choose a new password for your account.
              </div>

              {/* New password */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: mono, fontSize: 8, color: C.dim, letterSpacing: 2, marginBottom: 5 }}>NEW PASSWORD</div>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="6+ characters"
                  autoComplete="new-password"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'rgba(0,0,0,0.3)', border: `1px solid ${C.border}`,
                    borderRadius: 6, padding: '11px 14px',
                    color: C.pri, fontFamily: sans, fontSize: 14, outline: 'none',
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(0,212,255,0.5)'}
                  onBlur={e => e.target.style.borderColor = C.border}
                />
              </div>

              {/* Confirm */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: mono, fontSize: 8, color: C.dim, letterSpacing: 2, marginBottom: 5 }}>CONFIRM PASSWORD</div>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Same password again"
                  autoComplete="new-password"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'rgba(0,0,0,0.3)', border: `1px solid ${C.border}`,
                    borderRadius: 6, padding: '11px 14px',
                    color: C.pri, fontFamily: sans, fontSize: 14, outline: 'none',
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(0,212,255,0.5)'}
                  onBlur={e => e.target.style.borderColor = C.border}
                />
              </div>

              {error && (
                <div style={{
                  fontFamily: sans, fontSize: 12, color: C.red, marginBottom: 12,
                  padding: '8px 12px', background: 'rgba(255,80,80,0.08)',
                  border: '1px solid rgba(255,80,80,0.2)', borderRadius: 4,
                }}>
                  {error}
                </div>
              )}

              <button
                onClick={handleReset}
                disabled={loading}
                style={{
                  width: '100%', padding: '13px', borderRadius: 6,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  background: loading ? 'rgba(245,166,35,0.1)' : 'rgba(245,166,35,0.15)',
                  border: `1px solid ${loading ? 'rgba(245,166,35,0.2)' : 'rgba(245,166,35,0.5)'}`,
                  color: loading ? C.dim : C.gold,
                  fontFamily: mono, fontSize: 10, letterSpacing: 2,
                }}
              >
                {loading ? 'UPDATING…' : 'SET NEW PASSWORD →'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
