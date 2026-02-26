import { useState, useEffect, useCallback } from 'react'

// ─── Toast Context & Hook ──────────────────────────────────────────────────────
import { createContext, useContext } from 'react'

const ToastContext = createContext(null)

export function useToast() {
  return useContext(ToastContext)
}

// ─── Toast Provider ───────────────────────────────────────────────────────────
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const toast = useCallback(({ message, type = 'info', duration = 4000, action }) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type, duration, action }])
    if (duration > 0) {
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
    }
    return id
  }, [])

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Convenience methods
  toast.success = (msg, opts) => toast({ message: msg, type: 'success', ...opts })
  toast.error   = (msg, opts) => toast({ message: msg, type: 'error', duration: 8000, ...opts })
  toast.warn    = (msg, opts) => toast({ message: msg, type: 'warn', ...opts })
  toast.info    = (msg, opts) => toast({ message: msg, type: 'info', ...opts })

  const COLORS = {
    success: { bg: 'rgba(0,229,160,0.12)', border: 'rgba(0,229,160,0.4)', text: '#00E5A0', icon: '✓' },
    error:   { bg: 'rgba(255,80,80,0.12)',  border: 'rgba(255,80,80,0.4)',  text: '#FF5050', icon: '✕' },
    warn:    { bg: 'rgba(245,166,35,0.12)', border: 'rgba(245,166,35,0.4)', text: '#F5A623', icon: '⚠' },
    info:    { bg: 'rgba(0,212,255,0.10)',  border: 'rgba(0,212,255,0.3)',  text: '#00D4FF', icon: 'ℹ' },
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* Toast container */}
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        display: 'flex', flexDirection: 'column-reverse', gap: 8,
        pointerEvents: 'none',
        maxWidth: 340,
      }}>
        {toasts.map(t => {
          const c = COLORS[t.type] || COLORS.info
          return (
            <div key={t.id} style={{
              background: c.bg,
              border: `1px solid ${c.border}`,
              borderRadius: 6,
              padding: '10px 14px',
              display: 'flex', alignItems: 'flex-start', gap: 10,
              pointerEvents: 'all',
              animation: 'toast-in 0.2s ease',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            }}>
              <span style={{ color: c.text, fontSize: 13, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>
                {c.icon}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 12,
                  color: '#C8D8E8', lineHeight: 1.4,
                }}>
                  {t.message}
                </div>
                {t.action && (
                  <button
                    onClick={() => { t.action.fn(); dismiss(t.id) }}
                    style={{
                      marginTop: 6, background: 'transparent', border: `1px solid ${c.border}`,
                      color: c.text, borderRadius: 3, padding: '3px 10px', cursor: 'pointer',
                      fontFamily: "'Share Tech Mono', monospace", fontSize: 9, letterSpacing: 1,
                    }}
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                style={{
                  background: 'transparent', border: 'none', color: '#3D6080',
                  cursor: 'pointer', fontSize: 14, padding: 0, flexShrink: 0, lineHeight: 1,
                }}
              >×</button>
            </div>
          )
        })}
      </div>

      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </ToastContext.Provider>
  )
}
