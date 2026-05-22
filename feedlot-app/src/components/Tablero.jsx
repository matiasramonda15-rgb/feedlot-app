import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Loader } from './Tablero'

const S = {
  bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6', borderStrong: '#C8C2B8',
  text: '#1A1916', muted: '#6B6760', hint: '#9E9A94',
  accent: '#1A3D6B', accentLight: '#E8EFF8',
  green: '#1E5C2E', greenLight: '#E8F4EB',
  amber: '#7A4500', amberLight: '#FDF0E0',
  red: '#7A1A1A', redLight: '#FDF0F0',
  purple: '#3D1A6B', purpleLight: '#F0EAFB',
}

function Stat({ label, val, sub, color, size = 22 }) {
  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem' }}>
      <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: size, fontWeight: 700, fontFamily: 'monospace', lineHeight: 1, color: color || S.text }}>{val}</div>
      {sub && <div style={{ fontSize: 11, color: S.hint, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function SectionHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export default function Reportes({ usuario }) {
  // Se añade 'calculadora' a las pestañas disponibles
  const [tab, setTab] = useState('gdp')
  const [loading, setLoading] = useState(true)
  const [corrales, setCorrales] = useState([])
  const [pesadas, setPesadas] = useState([])
  const [raciones, setRaciones] = useState([])
  const [stock, setStock] = useState([])
  const [lotes, setLotes] = useState([])
  const [ventas, setVentas] = useState([])

  // Estados propios para la calculadora de compra simulada
  const [calcCantidad, setCalcCantidad] = useState(50)
  const [calcPeso, setCalcPeso] = useState(180)
  const [calcPrecioKilo, setCalcPrecioKilo] = useState(2400)
  const [calcFlete, setCalcFlete] = useState(120000)
  const [calcGastosVarios, setCalcGastosVarios] = useState(40000)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: c }, { data: p }, { data: r }, { data: s }, { data: l }, { data: v }] = await Promise.all([
      supabase.from('corrales').select('*').not('rol', 'eq', 'deshabilitado').order('numero'),
      supabase.from('pesadas').select('*, corrales(numero), pesada_animales(rango, cantidad, peso_promedio)').order('creado_en', { ascending: false }).limit(100),
      supabase.from('raciones_diarias').select('*, corrales(numero)').order('creado_en', { ascending: false }).limit(500),
      supabase.from('stock_insumos').select('*'),
      supabase.from('lotes').select('*').order('created_at', { ascending: false }),
      supabase.from('ventas').select('*, corrales(numero)').order('creado_en', { ascending: false }),
    ])
    setCorrales((c || []).sort((a, b) => parseInt(a.numero) - parseInt(b.numero)))
    setPesadas(p || [])
    setRaciones(r || [])
    setStock(s || [])
    setLotes(l || [])
    setVentas(v || [])
    setLoading(false)
  }

  // ── GDP por corral ──
  const gdpPorCorral = {}
  const porCorral = {}
  pesadas.forEach(p => {
    const num = p.corrales?.numero
    if (!num) return
    if (!porCorral[num]) porCorral[num] = []
    porCorral[num].push(p)
  })
  Object.entries(porCorral).forEach(([num, ps]) => {
    const sorted = ps.sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en))
    if (sorted.length >= 2) {
      const primera = sorted[0]
      const ultima = sorted[sorted.length - 1]
      const dias = Math.max(1, (new Date(ultima.creado_en) - new Date(primera.creado_en)) / (1000 * 60 * 60 * 24))
      const pp1 = calcPesoProm(primera.pesada_animales)
      const pp2 = calcPesoProm(ultima.pesada_animales)
      if (pp1 && pp2) {
        gdpPorCorral[num] = {
          gdp: (pp2 - pp1) / dias,
          pesoIngreso: pp1,
          pesoActual: pp2,
          diasEngorde: Math.round(dias),
          fechaInicio: primera.creado_en,
          fechaUltima: ultima.creado_en,
        }
      }
    }
  })

  // Lógica y variables de cálculo en tiempo real de la calculadora
  const costoHaciendaCabeza = calcPeso * calcPrecioKilo
  const costoHaciendaTotal = costoHaciendaCabeza * calcCantidad
  const costoTotalOperacion = costoHaciendaTotal + Number(calcFlete) + Number(calcGastosVarios)
  const costoFinalPorCabeza = calcCantidad > 0 ? costoTotalOperacion / calcCantidad : 0
  const precioKiloPuesto = calcPeso > 0 ? costoFinalPorCabeza / calcPeso : 0

  if (loading) return <Loader />

  return (
    <div style={{ padding: '1.5rem', background: S.bg, minHeight: '100vh', fontFamily: "'IBM Plex Sans', sans-serif", color: S.text }}>
      
      {/* Encabezado principal */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Informes y Reportes Estadísticos</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: S.muted }}>Auditoría de ganancias diarias, stock y herramientas financieras</p>
        </div>
      </div>

      {/* Navegación por pestañas con la nueva pestaña agregada */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${S.border}`, gap: '4px', marginBottom: '1.5rem' }}>
        {[
          { id: 'gdp', label: 'Ganancia Diaria (GDP)' },
          { id: 'stock', label: 'Consumos y Stock' },
          { id: 'lotes', label: 'Márgenes por Tropa' },
          { id: 'calculadora', label: '🧮 Calculadora de Compra' }
        ].map(t => {
          const activo = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 500,
                background: activo ? S.surface : 'transparent',
                border: '1px solid transparent',
                borderTopLeftRadius: 6,
                borderTopRightRadius: 6,
                borderBottom: activo ? `2px solid ${S.accent}` : '1px solid transparent',
                color: activo ? S.accent : S.muted,
                cursor: 'pointer',
                marginBottom: '-1px'
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* ── CONTENIDO PESTAÑA: GDP ── */}
      {tab === 'gdp' && (
        <div>
          <SectionHeader title="Monitoreo de Evolución de Peso por Corral" sub="Cálculo automático de ganancia diaria en base a las últimas pesadas oficiales." />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {corrales.map(c => {
              const info = gdpPorCorral[c.numero]
              return (
                <div key={c.id} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>Corral #{c.numero}</span>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: S.accentLight, color: S.accent, fontWeight: 600, textTransform: 'uppercase' }}>{c.rol}</span>
                  </div>
                  {info ? (
                    <div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: info.gdp >= 1 ? S.green : S.amber, fontFamily: 'monospace', marginBottom: 2 }}>
                        {info.gdp.toFixed(3)} <span style={{ fontSize: 12, fontWeight: 400, color: S.muted }}>kg/día</span>
                      </div>
                      <div style={{ fontSize: 11, color: S.muted, marginBottom: 12 }}>Evolución en {info.diasEngorde} días de ciclo</div>
                      <div style={{ fontSize: 12, borderTop: `1px solid ${S.border}`, paddingTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', color: S.muted }}>
                        <div>Peso Ingreso: <strong style={{ color: S.text }}>{Math.round(info.pesoIngreso)} kg</strong></div>
                        <div>Peso Actual: <strong style={{ color: S.text }}>{Math.round(info.pesoActual)} kg</strong></div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: S.hint, fontStyle: 'italic', padding: '10px 0' }}>Datos insuficientes para trazar la ganancia diaria. Se requieren al menos dos pesadas consecutivas.</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── CONTENIDO PESTAÑA: STOCK ── */}
      {tab === 'stock' && (
        <div>
          <SectionHeader title="Insumos Alimenticios en Depósito" sub="Cálculo estimado del stock restante actual en base a las raciones diarias suministradas." />
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: S.bg, borderBottom: `1px solid ${S.border}`, color: S.muted, textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px' }}>Insumo</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Stock Disponible</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Alerta Mínima</th>
                </tr>
              </thead>
              <tbody>
                {stock.length === 0 && <tr><td colSpan={3} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay registros de stock de insumos.</td></tr>}
                {stock.map(s => (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                    <td style={{ padding: '10px 14px', fontWeight: 500 }}>{s.insumo}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: s.cantidad_kg <= s.minimo_kg ? S.red : S.text }}>
                      {s.cantidad_kg?.toLocaleString('es-AR')} kg
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', color: S.hint }}>{s.minimo_kg?.toLocaleString('es-AR')} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CONTENIDO PESTAÑA: MARGENES POR TROPA ── */}
      {tab === 'lotes' && (
        <div>
          <SectionHeader title="Rentabilidad y Cierre Económico por Tropa" sub="Relación directa entre los costos totales de compra frente a la facturación de ventas concretadas." />
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: S.bg, borderBottom: `1px solid ${S.border}`, color: S.muted, textAlign: 'right' }}>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Identificación Tropa</th>
                    <th style={{ padding: '10px' }}>Cabezas</th>
                    <th style={{ padding: '10px' }}>Inversión Compra</th>
                    <th style={{ padding: '10px' }}>Ingreso Ventas</th>
                    <th style={{ padding: '10px' }}>Margen Bruto</th>
                    <th style={{ padding: '10px' }}>Rendimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {lotes.length === 0 && <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay tropas o lotes registrados para analizar.</td></tr>}
                  {lotes.map(l => {
                    const vAsoc = ventas.filter(v => v.lote_id === l.id)
                    const cTotal = l.precio_total || (l.cantidad * (l.peso_ingreso || 0) * (l.precio_kilo || 0))
                    const pC = l.cantidad || 0
                    const ingresoNeto = vAsoc.reduce((sum, item) => sum + (item.monto_total || 0), 0)
                    const gan = ingresoNeto - cTotal
                    const rentA = cTotal > 0 ? (gan / cTotal) * 100 : 0
                    return (
                      <tr key={l.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                        <td style={{ padding: '10px', fontWeight: 500, textAlign: 'left' }}>
                          Lote #{l.id} - <span style={{ color: S.muted }}>{l.proveedor || 'S/D'}</span>
                        </td>
                        <td style={{ padding: '10px', fontFamily: 'monospace' }}>{pC} cab.</td>
                        <td style={{ padding: '10px', fontFamily: 'monospace', color: S.red }}>-${Math.round(cTotal).toLocaleString('es-AR')}</td>
                        <td style={{ padding: '10px', fontFamily: 'monospace', color: S.green }}>+${Math.round(ingresoNeto).toLocaleString('es-AR')}</td>
                        <td style={{ padding: '10px', fontFamily: 'monospace', fontWeight: 600, color: gan >= 0 ? S.green : S.red }}>
                          {gan >= 0 ? '+' : ''}{Math.round(gan).toLocaleString('es-AR')}
                        </td>
                        <td style={{ padding: '10px', fontFamily: 'monospace', fontWeight: 600, color: rentA >= 0 ?