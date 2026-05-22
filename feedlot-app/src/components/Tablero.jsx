import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const S = {
  bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6', borderStrong: '#C8C2B8',
  text: '#1A1916', muted: '#6B6760', hint: '#9E9A94',
  accent: '#1A3D6B', accentLight: '#E8EFF8',
  green: '#1E5C2E', greenLight: '#E8F4EB',
  amber: '#7A4500', amberLight: '#FDF0E0',
  red: '#7A1A1A', redLight: '#FDF0F0',
  purple: '#3D1A6B', purpleLight: '#F0EAFB',
}

export function Loader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem', color: S.muted, fontSize: 13 }}>
      Cargando...
    </div>
  )
}

export function Btn({ children, onClick, variant = 'ghost', size = 'md', disabled }) {
  const base = { borderRadius: 6, fontFamily: "'IBM Plex Sans', sans-serif", cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 500, border: '1px solid', transition: 'all .15s', opacity: disabled ? 0.6 : 1 }
  const variants = {
    ghost: { background: 'transparent', borderColor: S.border, color: S.text },
    primary: { background: S.accent, borderColor: S.accent, color: '#fff' },
    danger: { background: S.red, borderColor: S.red, color: '#fff' }
  }
  const sizes = {
    sm: { padding: '4px 10px', fontSize: 12 },
    md: { padding: '8px 16px', fontSize: 13 }
  }
  return (
    <button disabled={disabled} onClick={onClick} style={{ ...base, ...variants[variant], ...sizes[size] }}>
      {children}
    </button>
  )
}

export function Card({ children, style = {} }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E2DDD6', borderRadius: 10, padding: '1.25rem', marginBottom: '1rem', ...style }}>
      {children}
    </div>
  )
}

export function Badge({ children, type = 'neutral', style = {} }) {
  const BADGE_STYLES = {
    ok:      { background: '#E8F4EB', color: '#1E5C2E' },
    warn:    { background: '#FDF0E0', color: '#7A4500' },
    red:     { background: '#FDF0F0', color: '#7A1A1A' },
    info:    { background: '#E8EFF8', color: '#1A3D6B' },
    neutral: { background: '#F7F5F0', color: '#6B6760' }
  }
  const current = BADGE_STYLES[type] || BADGE_STYLES.neutral
  return (
    <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, ...current, ...style }}>
      {children}
    </span>
  )
}

export default function Tablero({ usuario }) {
  const [loading, setLoading] = useState(true)
  const [metricas, setMetricas] = useState([])

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    try {
      // Tu lógica de carga de datos para el dashboard principal va acá
      setLoading(false)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  if (loading) return <Loader />

  return (
    <div style={{ padding: '1.5rem', background: S.bg, minHeight: '100vh', fontFamily: "'IBM Plex Sans', sans-serif", color: S.text }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Tablero de Control</h1>
        <p style={{ margin: '4px 0 0 0', fontSize: 13, color: S.muted }}>Estado general del feedlot en tiempo real</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
        {metricas.map((m, i) => (
          <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem' }}>
            <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>{m.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', lineHeight: 1, color: m.color || S.text }}>{m.val}</div>
            <div style={{ fontSize: 11, fontFamily: 'monospace', color: S.muted, marginTop: 2 }}>{m.sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function calcPesoProm(pesadaAnimales) {
  if (!pesadaAnimales || pesadaAnimales.length === 0) return null
  const conPeso = pesadaAnimales.filter(p => p.peso_promedio)
  if (conPeso.length === 0) return null
  const totalAnim = conPeso.reduce((s, p) => s + (p.cantidad || 0), 0)
  if (totalAnim === 0) return null
  return conPeso.reduce((s, p) => s + p.peso_promedio * (p.cantidad || 0), 0) / totalAnim
}