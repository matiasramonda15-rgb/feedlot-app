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
  const [lotes, setLotes] = useState([])

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    try {
      // 1. Cargar lotes/tropas para la calculadora
      const { data: dataLotes } = await supabase
        .from('lotes')
        .select('*, pesada_animales(*), ventas(*)')
        .order('fecha_ingreso', { ascending: false })
      
      if (dataLotes) setLotes(dataLotes)

      // 2. Podés armar tus métricas del dashboard acá abajo si lo requerís
      setMetricas([
        { label: 'Total Tropas', val: dataLotes?.length || 0, sub: 'Lotes registrados', color: S.accent },
        { label: 'Animales Activos', val: dataLotes?.reduce((acc, l) => acc + (l.cantidad_inicial || 0), 0) || 0, sub: 'En corrales', color: S.green }
      ])

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

      {/* Grid de métricas superiores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {metricas.map((m, i) => (
          <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem' }}>
            <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>{m.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', lineHeight: 1, color: m.color || S.text }}>{m.val}</div>
            <div style={{ fontSize: 11, fontFamily: 'monospace', color: S.muted, marginTop: 2 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Sección de la Calculadora de Márgenes por Tropa */}
      <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
        <h2 style={{ margin: '0 0 4px 0', fontSize: 16, fontWeight: 600 }}>Márgenes por Tropa / Lotes</h2>
        <p style={{ margin: '0 0 1rem 0', fontSize: 13, color: S.muted }}>Análisis económico estimado por lote ingresado</p>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${S.borderStrong}`, color: S.muted, fontSize: 11, textTransform: 'uppercase' }}>
                <th style={{ padding: '8px 10px', textAlign: 'left' }}>Lote / Tropa</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Cabezas</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>P. Compra</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>P. Actual (Est)</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Inversión Inicial</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Costo Alimento</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Ingreso Estimado</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Margen ($)</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Rentabilidad</th>
              </tr>
            </thead>
            <tbody>
              {lotes.map(l => {
                const cant = l.cantidad_inicial || 0
                const pC = l.precio_compra_kg || 0
                const pK = l.peso_ingreso_promedio || 0
                const invInicial = cant * pK * pC

                // Cálculos de peso actual basados en pesadas
                const pAct = calcPesoProm(l.pesada_animales) || pK
                const dias = l.fecha_ingreso ? Math.max(0, Math.round((new Date() - new Date(l.fecha_ingreso)) / (1000 * 60 * 60 * 24))) : 0
                
                // Costo alimento estimado (ej. 12kg por animal/día a $150 el kg)
                const cTotal = cant * dias * 12 * 150 
                
                // Precio venta estimado (se toma el de venta real o uno de referencia de $2200)
                const precioVentaEst = l.ventas?.[0]?.precio_kg || 2200
                const ingresoNeto = cant * pAct * precioVentaEst

                const gan = ingresoNeto - (invInicial + cTotal)
                const rentA = invInicial > 0 ? (gan / (invInicial + cTotal)) * 100 : 0

                return (
                  <tr key={l.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                    <td style={{ padding: '10px', fontWeight: 600 }}>{l.nombre || `Lote ${l.id}`}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace' }}>{cant}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace' }}>{pK} kg</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace' }}>{Math.round(pAct)} kg</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', color: S.muted }}>${invInicial.toLocaleString('es-AR')}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', color: S.red }}>-${cTotal.toLocaleString('es-AR')}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', color: S.green }}>+${Math.round(ingresoNeto).toLocaleString('es-AR')}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: gan >= 0 ? S.green : S.red }}>
                      {gan >= 0 ? '+' : ''}{Math.round(gan).toLocaleString('es-AR')}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: rentA >= 0 ? S.green : S.red }}>
                      {rentA.toFixed(1)}%
                    </td>
                  </tr>
                )
              })}
              {lotes.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>
                    No hay lotes activos para calcular márgenes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function calcPesoProm(pa) {
  if (!pa || pa.length === 0) return null
  const conPeso = pa.filter(p => p.peso_promedio && p.rango !== 'menores')
  if (!conPeso.length) return null
  const tot = conPeso.reduce((s, p) => s + (p.cantidad || 0), 0)
  if (!tot) return null
  return conPeso.reduce((s, p) => s + p.peso_promedio * (