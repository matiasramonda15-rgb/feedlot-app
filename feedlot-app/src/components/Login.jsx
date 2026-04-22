import { useState } from 'react'
import { supabase } from '../supabase'

const S = {
  wrap: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F5F0', fontFamily: "'IBM Plex Sans', sans-serif" },
  card: { background: '#fff', border: '1px solid #E2DDD6', borderRadius: 12, padding: '2rem', width: '100%', maxWidth: 380 },
  logo: { fontSize: 13, fontWeight: 600, color: '#1A3D6B', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 4 },
  sub: { fontSize: 12, color: '#9E9A94', fontFamily: "'IBM Plex Mono', monospace", marginBottom: '2rem' },
  label: { fontSize: 11, fontWeight: 600, color: '#6B6760', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 4 },
  input: { width: '100%', border: '1px solid #E2DDD6', borderRadius: 6, padding: '10px 12px', fontSize: 14, fontFamily: "'IBM Plex Sans', sans-serif", color: '#1A1916', background: '#fff', marginBottom: '1rem', boxSizing: 'border-box' },
  btn: { width: '100%', background: '#1A3D6B', border: 'none', borderRadius: 6, padding: '11px', fontSize: 14, fontWeight: 500, color: '#fff', cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" },
  error: { background: '#FDF0F0', border: '1px solid #F09595', borderRadius: 6, padding: '10px 12px', fontSize: 13, color: '#7A1A1A', marginBottom: '1rem' },
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Email o contraseña incorrectos')
    setLoading(false)
  }

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <div style={S.logo}>Feedlot</div>
        <div style={S.sub}>Sistema de gestión agropecuaria</div>
        {error && <div style={S.error}>{error}</div>}
        <form onSubmit={handleLogin}>
          <label style={S.label}>Email</label>
          <input style={S.input} type="email" value={email}
            onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" required />
          <label style={S.label}>Contraseña</label>
          <input style={S.input} type="password" value={password}
            onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          <button style={S.btn} type="submit" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
