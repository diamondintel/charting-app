import { useState } from 'react'
import { supabase } from '../lib/supabase'

const C = {
  bg:    '#050C14', panel: '#0C1C2E', border: '#1A3550',
  pri:   '#E8F4F8', sec:   '#7BACC8', dim:   '#3D6080',
  gold:  '#F5A623', cyan:  '#00D4FF', green: '#00E5A0', red: '#FF5050',
}
const mono  = "'Share Tech Mono', monospace"
const sans  = "'DM Sans', sans-serif"
const bebas = "'Bebas Neue', 'Rajdhani', sans-serif"

function Input({ label, type='text', value, onChange, placeholder, autoComplete }) {
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontFamily:mono, fontSize:8, color:C.dim, letterSpacing:2, marginBottom:5 }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        style={{
          width:'100%', boxSizing:'border-box',
          background:'rgba(0,0,0,0.3)', border:`1px solid ${C.border}`,
          borderRadius:6, padding:'11px 14px',
          color:C.pri, fontFamily:sans, fontSize:14,
          outline:'none',
        }}
        onFocus={e => e.target.style.borderColor = 'rgba(0,212,255,0.5)'}
        onBlur={e => e.target.style.borderColor = C.border}
      />
    </div>
  )
}

function PrimaryBtn({ children, onClick, loading, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      style={{
        width:'100%', padding:'13px', borderRadius:6, cursor: loading||disabled ? 'not-allowed' : 'pointer',
        background: loading||disabled ? 'rgba(245,166,35,0.1)' : 'rgba(245,166,35,0.15)',
        border:`1px solid ${loading||disabled ? 'rgba(245,166,35,0.2)' : 'rgba(245,166,35,0.5)'}`,
        color: loading||disabled ? C.dim : C.gold,
        fontFamily:mono, fontSize:10, letterSpacing:2, transition:'all 0.15s',
      }}
    >
      {loading ? 'LOADING…' : children}
    </button>
  )
}

// ─── Login View ───────────────────────────────────────────────────────────────
function LoginView({ onSwitch, onForgot }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  async function handleLogin() {
    if (!email || !password) { setError('Enter email and password'); return }
    setLoading(true); setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    // On success, App.jsx auth listener will handle redirect
  }

  return (
    <>
      <Input label="EMAIL" type="email" value={email} onChange={setEmail} placeholder="coach@team.com" autoComplete="email" />
      <Input label="PASSWORD" type="password" value={password} onChange={setPassword} placeholder="••••••••" autoComplete="current-password" />
      {error && <div style={{ fontFamily:sans, fontSize:12, color:C.red, marginBottom:12, padding:'8px 12px', background:'rgba(255,80,80,0.08)', border:'1px solid rgba(255,80,80,0.2)', borderRadius:4 }}>{error}</div>}
      <PrimaryBtn onClick={handleLogin} loading={loading}>SIGN IN →</PrimaryBtn>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:14 }}>
        <button onClick={() => onSwitch('signup')} style={{ background:'none', border:'none', color:C.cyan, fontFamily:mono, fontSize:9, cursor:'pointer', letterSpacing:1 }}>
          CREATE ACCOUNT
        </button>
        <button onClick={() => onSwitch('forgot')} style={{ background:'none', border:'none', color:C.dim, fontFamily:mono, fontSize:9, cursor:'pointer', letterSpacing:1 }}>
          FORGOT PASSWORD
        </button>
      </div>
    </>
  )
}

// ─── Signup View ──────────────────────────────────────────────────────────────
function SignupView({ onSwitch }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [teamName, setTeamName] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [done, setDone]         = useState(false)

  async function handleSignup() {
    if (!email || !password || !teamName) { setError('All fields required'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true); setError(null)
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { team_name: teamName } }
    })
    if (error) { setError(error.message); setLoading(false) }
    else setDone(true)
  }

  if (done) return (
    <div style={{ textAlign:'center', padding:'20px 0' }}>
      <div style={{ fontFamily:bebas, fontSize:28, color:C.green, letterSpacing:3, marginBottom:8 }}>CHECK YOUR EMAIL</div>
      <div style={{ fontFamily:sans, fontSize:13, color:C.sec, lineHeight:1.6, marginBottom:20 }}>
        We sent a confirmation link to <strong style={{ color:C.pri }}>{email}</strong>.<br/>
        Click it to activate your account, then sign in.
      </div>
      <button onClick={() => onSwitch('login')} style={{ background:'none', border:`1px solid ${C.border}`, color:C.sec, fontFamily:mono, fontSize:9, letterSpacing:2, padding:'8px 20px', borderRadius:4, cursor:'pointer' }}>
        BACK TO SIGN IN
      </button>
    </div>
  )

  return (
    <>
      <Input label="TEAM NAME" value={teamName} onChange={setTeamName} placeholder="Lady Hawks 14U" autoComplete="organization" />
      <Input label="EMAIL" type="email" value={email} onChange={setEmail} placeholder="coach@team.com" autoComplete="email" />
      <Input label="PASSWORD" type="password" value={password} onChange={setPassword} placeholder="6+ characters" autoComplete="new-password" />
      {error && <div style={{ fontFamily:sans, fontSize:12, color:C.red, marginBottom:12, padding:'8px 12px', background:'rgba(255,80,80,0.08)', border:'1px solid rgba(255,80,80,0.2)', borderRadius:4 }}>{error}</div>}
      <PrimaryBtn onClick={handleSignup} loading={loading}>CREATE ACCOUNT →</PrimaryBtn>
      <div style={{ marginTop:14, textAlign:'center' }}>
        <button onClick={() => onSwitch('login')} style={{ background:'none', border:'none', color:C.dim, fontFamily:mono, fontSize:9, cursor:'pointer', letterSpacing:1 }}>
          ALREADY HAVE AN ACCOUNT
        </button>
      </div>
    </>
  )
}

// ─── Forgot Password View ─────────────────────────────────────────────────────
function ForgotView({ onSwitch }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)

  async function handleReset() {
    if (!email) { setError('Enter your email'); return }
    setLoading(true); setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    if (error) { setError(error.message); setLoading(false) }
    else setDone(true)
  }

  if (done) return (
    <div style={{ textAlign:'center', padding:'20px 0' }}>
      <div style={{ fontFamily:bebas, fontSize:28, color:C.gold, letterSpacing:3, marginBottom:8 }}>EMAIL SENT</div>
      <div style={{ fontFamily:sans, fontSize:13, color:C.sec, marginBottom:20 }}>Check your inbox for a password reset link.</div>
      <button onClick={() => onSwitch('login')} style={{ background:'none', border:`1px solid ${C.border}`, color:C.sec, fontFamily:mono, fontSize:9, letterSpacing:2, padding:'8px 20px', borderRadius:4, cursor:'pointer' }}>
        BACK TO SIGN IN
      </button>
    </div>
  )

  return (
    <>
      <div style={{ fontFamily:sans, fontSize:13, color:C.sec, marginBottom:16, lineHeight:1.5 }}>
        Enter your email and we'll send a reset link.
      </div>
      <Input label="EMAIL" type="email" value={email} onChange={setEmail} placeholder="coach@team.com" autoComplete="email" />
      {error && <div style={{ fontFamily:sans, fontSize:12, color:C.red, marginBottom:12, padding:'8px 12px', background:'rgba(255,80,80,0.08)', border:'1px solid rgba(255,80,80,0.2)', borderRadius:4 }}>{error}</div>}
      <PrimaryBtn onClick={handleReset} loading={loading}>SEND RESET LINK →</PrimaryBtn>
      <div style={{ marginTop:14, textAlign:'center' }}>
        <button onClick={() => onSwitch('login')} style={{ background:'none', border:'none', color:C.dim, fontFamily:mono, fontSize:9, cursor:'pointer', letterSpacing:1 }}>
          BACK TO SIGN IN
        </button>
      </div>
    </>
  )
}

// ─── Main AuthScreen ──────────────────────────────────────────────────────────
export default function AuthScreen() {
  const [view, setView] = useState('login') // 'login' | 'signup' | 'forgot'

  const TITLES = { login:'SIGN IN', signup:'CREATE ACCOUNT', forgot:'RESET PASSWORD' }

  return (
    <div style={{
      minHeight:'100vh', background:C.bg,
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:16,
      backgroundImage:'radial-gradient(ellipse at 50% 0%, rgba(0,212,255,0.04) 0%, transparent 60%)',
    }}>
      <div style={{ width:'100%', maxWidth:400 }}>

        {/* Logo / brand */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontFamily:bebas, fontSize:42, color:C.gold, letterSpacing:5, lineHeight:1 }}>
            PITCH
          </div>
          <div style={{ fontFamily:bebas, fontSize:42, color:C.pri, letterSpacing:5, lineHeight:1, marginTop:-4 }}>
            INTELLIGENCE
          </div>
          <div style={{ fontFamily:mono, fontSize:8, color:C.dim, letterSpacing:4, marginTop:6 }}>
            COMMAND CENTER
          </div>
        </div>

        {/* Card */}
        <div style={{
          background:C.panel, border:`1px solid ${C.border}`,
          borderRadius:10, padding:28,
          boxShadow:'0 20px 60px rgba(0,0,0,0.5)',
        }}>
          <div style={{ fontFamily:mono, fontSize:9, color:C.cyan, letterSpacing:3, marginBottom:20, paddingBottom:14, borderBottom:`1px solid ${C.border}` }}>
            {TITLES[view]}
          </div>

          {view === 'login'  && <LoginView  onSwitch={setView} />}
          {view === 'signup' && <SignupView onSwitch={setView} />}
          {view === 'forgot' && <ForgotView onSwitch={setView} />}
        </div>

        <div style={{ textAlign:'center', marginTop:16, fontFamily:mono, fontSize:7, color:C.dim, letterSpacing:1 }}>
          YOUTH SOFTBALL PITCH INTELLIGENCE
        </div>
      </div>
    </div>
  )
}
