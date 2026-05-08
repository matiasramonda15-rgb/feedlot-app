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
  const [tab, setTab] = useState('gdp')
  const [loading, setLoading] = useState(true)
  const [corrales, setCorrales] = useState([])
  const [pesadas, setPesadas] = useState([])
  const [raciones, setRaciones] = useState([])
  const [stock, setStock] = useState([])
  const [lotes, setLotes] = useState([])
  const [ventas, setVentas] = useState([])

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
    } else if (sorted.length === 1) {
      const pp = calcPesoProm(sorted[0].pesada_animales)
      if (pp) gdpPorCorral[num] = {
        gdp: null, pesoIngreso: pp, pesoActual: pp,
        diasEngorde: 0, fechaInicio: sorted[0].creado_en, fechaUltima: sorted[0].creado_en,
      }
    }
  })

  // ── Costo alimentación por corral/día ──
  const hace30 = new Date(); hace30.setDate(hace30.getDate() - 30)
  const raciones30 = raciones.filter(r => new Date(r.creado_en) >= hace30)

  const costoAlimPorCorral = {}
  raciones30.forEach(r => {
    const num = r.corrales?.numero
    if (!num) return
    if (!costoAlimPorCorral[num]) costoAlimPorCorral[num] = { totalCosto: 0, totalKg: 0, dias: new Set() }
    costoAlimPorCorral[num].totalCosto += r.costo_estimado || 0
    costoAlimPorCorral[num].totalKg += r.kg_total || 0
    costoAlimPorCorral[num].dias.add(new Date(r.creado_en).toDateString())
  })

  // ── Rentabilidad por venta ──
  const rentabilidadVentas = ventas.map(v => {
    const lote = lotes.find(l => l.corral_cuarentena_id === v.corral_id) || lotes[0]
    const costoCompra = lote?.precio_compra && v.kg_vivo_total ? v.kg_vivo_total * lote.precio_compra : null
    const ingreso = v.total || null
    const margen = costoCompra && ingreso ? ingreso - costoCompra : null
    const margenPct = costoCompra && margen ? (margen / costoCompra * 100) : null
    return { ...v, costoCompra, ingreso, margen, margenPct }
  })

  if (loading) return <Loader />

  const corralesActivos = corrales.filter(c => c.rol !== 'libre')
  const totalAnimales = corralesActivos.reduce((s, c) => s + (c.animales || 0), 0)
  const corralesConGDP = corralesActivos.filter(c => gdpPorCorral[c.numero]?.gdp)
  const gdpGlobal = corralesConGDP.length
    ? corralesConGDP.reduce((s, c) => s + gdpPorCorral[c.numero].gdp * (c.animales || 0), 0) /
      corralesConGDP.reduce((s, c) => s + (c.animales || 0), 0)
    : null

  const TABS = [
    { key: 'gdp', label: 'GDP y conversión' },
    { key: 'costos', label: 'Costos' },
    { key: 'rentabilidad', label: 'Rentabilidad' },
  ]

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 3 }}>Reportes</div>
      <div style={{ fontSize: 12, color: S.muted, fontFamily: 'monospace', marginBottom: '1.5rem' }}>
        Análisis de performance · feedlot {new Date().getFullYear()}
      </div>

      <div style={{ display: 'flex', borderBottom: `1px solid ${S.border}`, marginBottom: '1.5rem' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '10px 20px', fontSize: 13, fontWeight: tab === t.key ? 600 : 500, cursor: 'pointer', color: tab === t.key ? S.accent : S.muted, background: 'transparent', border: 'none', borderBottom: tab === t.key ? `2px solid ${S.accent}` : '2px solid transparent', marginBottom: -1, fontFamily: "'IBM Plex Sans', sans-serif" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── GDP Y CONVERSIÓN ── */}
      {tab === 'gdp' && (
        <div>
          <SectionHeader title="GDP y conversión" sub="Ganancia diaria de peso por corral · basado en pesadas registradas" />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
            <Stat label="GDP global ponderado" val={gdpGlobal ? gdpGlobal.toFixed(2) + ' kg/d' : '—'} sub={`${corralesConGDP.length} corrales con datos`} color={gdpGlobal ? (gdpGlobal >= 1.1 ? S.green : gdpGlobal >= 0.9 ? S.amber : S.red) : S.hint} />
            <Stat label="Animales activos" val={totalAnimales} sub={`${corralesActivos.length} corrales activos`} />
            <Stat label="Animales ≥ 400 kg" val={corralesActivos.filter(c => gdpPorCorral[c.numero]?.pesoActual >= 400).reduce((s, c) => s + (c.animales || 0), 0)} sub="listos para venta" color={S.green} />
            <Stat label="Pesadas registradas" val={pesadas.length} sub="en el historial" />
          </div>

          {corralesConGDP.length === 0 ? (
            <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '3rem', textAlign: 'center', color: S.hint, fontSize: 13 }}>
              No hay suficientes pesadas para calcular GDP.<br />
              <span style={{ fontSize: 11 }}>Se necesitan al menos 2 pesadas por corral.</span>
            </div>
          ) : (
            <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>Detalle por corral</div>
              <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: S.bg }}>
                      {['Corral', 'Rol', 'Animales', 'Peso ingreso', 'Peso actual', 'GDP kg/d', 'Días engorde', 'Días para 400kg', 'Estado'].map(h => (
                        <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {corralesActivos.filter(c => gdpPorCorral[c.numero]).map(c => {
                      const g = gdpPorCorral[c.numero]
                      const gdpColor = g.gdp ? (g.gdp >= 1.1 ? S.green : g.gdp >= 0.9 ? S.amber : S.red) : S.hint
                      const diasVenta = g.gdp && g.pesoActual < 400 ? Math.ceil((400 - g.pesoActual) / g.gdp) : g.pesoActual >= 400 ? 0 : null
                      let estado, estadoColor, estadoBg
                      if (g.pesoActual >= 400) { estado = 'Listo ★'; estadoColor = S.green; estadoBg = S.greenLight }
                      else if (diasVenta !== null && diasVenta <= 30) { estado = 'Pronto'; estadoColor = S.green; estadoBg = S.greenLight }
                      else if (diasVenta !== null && diasVenta <= 60) { estado = 'En curso'; estadoColor = S.accent; estadoBg = S.accentLight }
                      else { estado = 'Largo plazo'; estadoColor = S.muted; estadoBg = S.bg }
                      return (
                        <tr key={c.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600, fontFamily: 'monospace' }}>C-{c.numero}</td>
                          <td style={{ padding: '10px 12px', fontSize: 12, color: S.muted }}>{c.rol === 'clasificado' && c.sub ? `Rango ${c.sub}` : c.rol}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{c.animales || 0}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: S.muted }}>{Math.round(g.pesoIngreso)} kg</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{Math.round(g.pesoActual)} kg</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600, color: gdpColor }}>{g.gdp ? g.gdp.toFixed(2) : '—'}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: S.muted }}>{g.diasEngorde > 0 ? g.diasEngorde + ' días' : '—'}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: diasVenta === 0 ? S.green : S.text }}>{diasVenta === 0 ? 'Listo' : diasVenta !== null ? diasVenta + ' días' : '—'}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: estadoBg, color: estadoColor }}>{estado}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Barra visual de GDP */}
              <div style={{ marginTop: '1.5rem' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem' }}>GDP comparativo por corral</div>
                {corralesActivos.filter(c => gdpPorCorral[c.numero]?.gdp).sort((a, b) => (gdpPorCorral[b.numero]?.gdp || 0) - (gdpPorCorral[a.numero]?.gdp || 0)).map(c => {
                  const g = gdpPorCorral[c.numero]
                  const maxGDP = Math.max(...corralesActivos.filter(x => gdpPorCorral[x.numero]?.gdp).map(x => gdpPorCorral[x.numero].gdp), 1.5)
                  const pct = Math.round(g.gdp / maxGDP * 100)
                  const color = g.gdp >= 1.1 ? S.green : g.gdp >= 0.9 ? S.amber : S.red
                  return (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <div style={{ fontSize: 12, color: S.muted, minWidth: 60, textAlign: 'right', fontFamily: 'monospace' }}>C-{c.numero}</div>
                      <div style={{ flex: 1, height: 10, background: S.bg, borderRadius: 5, overflow: 'hidden', border: `1px solid ${S.border}` }}>
                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: color, transition: 'width .5s ease' }} />
                      </div>
                      <div style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color, minWidth: 60 }}>{g.gdp.toFixed(2)} kg/d</div>
                      <div style={{ fontSize: 11, color: S.hint, minWidth: 80 }}>{c.animales || 0} animales</div>
                    </div>
                  )
                })}
                <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: S.muted }}>
                  <span><span style={{ display: 'inline-block', width: 10, height: 4, background: S.green, borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} />GDP ≥ 1,1 kg/d</span>
                  <span><span style={{ display: 'inline-block', width: 10, height: 4, background: S.amber, borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} />0,9 – 1,1 kg/d</span>
                  <span><span style={{ display: 'inline-block', width: 10, height: 4, background: S.red, borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} />menor a 0,9 kg/d</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── COSTOS ── */}
      {tab === 'costos' && (
        <div>
          <SectionHeader title="Costos de producción" sub="Alimentación · últimos 30 días con precios de referencia cargados" />

          {/* Resumen global */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
            {(() => {
              const totalCostoAlim = Object.values(costoAlimPorCorral).reduce((s, c) => s + c.totalCosto, 0)
              const totalKgAlim = Object.values(costoAlimPorCorral).reduce((s, c) => s + c.totalKg, 0)
              const diasMedidos = Object.values(costoAlimPorCorral).reduce((s, c) => s + c.dias.size, 0)
              const costoPorAnimal = totalAnimales > 0 && totalCostoAlim > 0 ? totalCostoAlim / totalAnimales : null
              const costoPorKgProd = gdpGlobal && costoPorAnimal ? costoPorAnimal / gdpGlobal : null
              return [
                { label: 'Costo alim. total (30d)', val: totalCostoAlim > 0 ? `$${Math.round(totalCostoAlim).toLocaleString('es-AR')}` : '—', sub: 'suma de todos los corrales' },
                { label: 'Costo por animal/día', val: costoPorAnimal ? `$${Math.round(costoPorAnimal / 30).toLocaleString('es-AR')}` : '—', sub: 'promedio últimos 30 días' },
                { label: 'Kg alimento total', val: totalKgAlim > 0 ? totalKgAlim.toLocaleString('es-AR') + ' kg' : '—', sub: 'últimos 30 días' },
                { label: 'Costo por kg producido', val: costoPorKgProd ? `$${Math.round(costoPorKgProd).toLocaleString('es-AR')}` : '—', sub: 'costo alim. / GDP promedio' },
              ]
            })().map((m, i) => <Stat key={i} {...m} />)}
          </div>

          {/* Detalle por corral */}
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>Costo por corral — últimos 30 días</div>
            {Object.keys(costoAlimPorCorral).length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: S.hint, fontSize: 13 }}>
                No hay raciones confirmadas con precios de referencia en los últimos 30 días.
              </div>
            ) : (
              <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: S.bg }}>
                      {['Corral', 'Animales', 'Días con datos', 'Costo total', 'Costo/día', 'Costo/animal/día', 'Kg consumidos', 'Costo/kg prod.'].map(h => (
                        <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(costoAlimPorCorral).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([num, datos]) => {
                      const corral = corrales.find(c => c.numero === num)
                      const animales = corral?.animales || 0
                      const diasCount = datos.dias.size
                      const costoDia = diasCount > 0 ? datos.totalCosto / diasCount : 0
                      const costoAnimalDia = animales > 0 && costoDia > 0 ? costoDia / animales : null
                      const gdp = gdpPorCorral[num]?.gdp
                      const costoKgProd = costoAnimalDia && gdp ? costoAnimalDia / gdp : null
                      return (
                        <tr key={num} style={{ borderBottom: `1px solid ${S.border}` }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600, fontFamily: 'monospace' }}>C-{num}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{animales}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: S.muted }}>{diasCount}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>${Math.round(datos.totalCosto).toLocaleString('es-AR')}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>${Math.round(costoDia).toLocaleString('es-AR')}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: S.accent }}>{costoAnimalDia ? `$${Math.round(costoAnimalDia).toLocaleString('es-AR')}` : '—'}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: S.muted }}>{Math.round(datos.totalKg).toLocaleString('es-AR')} kg</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: costoKgProd ? S.purple : S.hint, fontWeight: costoKgProd ? 600 : 400 }}>
                            {costoKgProd ? `$${Math.round(costoKgProd).toLocaleString('es-AR')}` : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Precios de referencia de insumos */}
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>Precios de referencia de insumos</div>
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: S.bg }}>
                    {['Insumo', 'Stock actual', 'Precio ref. $/kg', 'Última actualización'].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stock.map(s => (
                    <tr key={s.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{s.insumo}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{s.cantidad_kg?.toLocaleString('es-AR')} kg</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600, color: s.precio_referencia ? S.green : S.hint }}>
                        {s.precio_referencia ? `$${s.precio_referencia.toLocaleString('es-AR')}` : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: S.muted }}>
                        {s.precio_referencia_actualizado_en ? new Date(s.precio_referencia_actualizado_en).toLocaleDateString('es-AR') : '—'}
                      </td>
                    </tr>
                  ))}
                  {stock.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: S.hint, fontSize: 13 }}>No hay insumos registrados.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── RENTABILIDAD ── */}
      {tab === 'rentabilidad' && (
        <div>
          <SectionHeader title="Rentabilidad" sub="Análisis económico de ventas realizadas" />

          {/* Resumen */}
          {(() => {
            const ventasConDatos = rentabilidadVentas.filter(v => v.total && v.costoCompra)
            const totalIngreso = ventas.reduce((s, v) => s + (v.total || 0), 0)
            const totalCostoComp = lotes.reduce((s, l) => s + ((l.kg_bascula || 0) * (l.precio_compra || 0)), 0)
            const margenBruto = totalIngreso - totalCostoComp
            const margenPct = totalCostoComp > 0 ? (margenBruto / totalCostoComp * 100) : null
            const totalAnimVendidos = ventas.reduce((s, v) => s + (v.cantidad || 0), 0)
            const precioPromVenta = ventas.filter(v => v.precio_kg).length > 0
              ? ventas.filter(v => v.precio_kg).reduce((s, v) => s + v.precio_kg, 0) / ventas.filter(v => v.precio_kg).length
              : null
            const precioPromCompra = lotes.filter(l => l.precio_compra).length > 0
              ? lotes.filter(l => l.precio_compra).reduce((s, l) => s + l.precio_compra, 0) / lotes.filter(l => l.precio_compra).length
              : null
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
                <Stat label="Ingreso total ventas" val={totalIngreso > 0 ? `$${(totalIngreso / 1000000).toFixed(1)}M` : '—'} sub={`${ventas.length} ventas · ${totalAnimVendidos} animales`} color={S.green} />
                <Stat label="Costo total compras" val={totalCostoComp > 0 ? `$${(totalCostoComp / 1000000).toFixed(1)}M` : '—'} sub={`${lotes.length} lotes ingresados`} />
                <Stat label="Margen bruto" val={totalIngreso > 0 && totalCostoComp > 0 ? `$${(margenBruto / 1000000).toFixed(1)}M` : '—'} sub={margenPct ? `${margenPct.toFixed(1)}% sobre costo` : 'sin datos suficientes'} color={margenBruto > 0 ? S.green : S.red} />
                <Stat label="Spread precio" val={precioPromVenta && precioPromCompra ? `$${Math.round(precioPromVenta - precioPromCompra).toLocaleString('es-AR')}/kg` : '—'} sub={`compra $${Math.round(precioPromCompra || 0).toLocaleString('es-AR')} · venta $${Math.round(precioPromVenta || 0).toLocaleString('es-AR')}`} color={S.accent} />
              </div>
            )
          })()}

          {/* Historial de ventas con rentabilidad */}
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>Detalle por venta</div>
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: S.bg }}>
                    {['Fecha', 'Corral', 'Animales', 'Kg netos', 'Precio venta', 'Total venta', 'Costo compra est.', 'Margen bruto', '%'].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ventas.length === 0 && (
                    <tr><td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: S.hint, fontSize: 13 }}>No hay ventas registradas.</td></tr>
                  )}
                  {rentabilidadVentas.map(v => (
                    <tr key={v.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(v.creado_en).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                      <td style={{ padding: '10px 12px' }}>C-{v.corrales?.numero || v.corral_id}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{v.cantidad}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{v.kg_neto?.toLocaleString('es-AR')} kg</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{v.precio_kg ? `$${v.precio_kg.toLocaleString('es-AR')}` : <span style={{ color: S.amber, fontSize: 11 }}>Pendiente</span>}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600, color: v.total ? S.green : S.hint }}>{v.total ? `$${(v.total / 1000000).toFixed(2)}M` : '—'}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: S.muted }}>{v.costoCompra ? `$${(v.costoCompra / 1000000).toFixed(2)}M` : '—'}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600, color: v.margen !== null ? (v.margen > 0 ? S.green : S.red) : S.hint }}>
                        {v.margen !== null ? `$${(v.margen / 1000000).toFixed(2)}M` : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: v.margenPct !== null ? (v.margenPct > 0 ? S.green : S.red) : S.hint }}>
                        {v.margenPct !== null ? `${v.margenPct.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Historial de compras */}
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>Historial de compras</div>
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: S.bg }}>
                    {['Fecha', 'Lote', 'Animales', 'Procedencia', 'Kg báscula', 'Precio $/kg', 'Total compra', 'Peso prom.'].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lotes.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: S.hint, fontSize: 13 }}>No hay compras registradas.</td></tr>
                  )}
                  {lotes.map(l => {
                    const total = (l.kg_bascula || 0) * (l.precio_compra || 0)
                    return (
                      <tr key={l.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(l.fecha_ingreso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{l.codigo}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{l.cantidad}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12 }}>{l.procedencia || '—'}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{l.kg_bascula?.toLocaleString('es-AR')} kg</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{l.precio_compra ? `$${l.precio_compra.toLocaleString('es-AR')}` : <span style={{ color: S.amber, fontSize: 11 }}>Pendiente</span>}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{total > 0 ? `$${(total / 1000000).toFixed(2)}M` : '—'}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: S.muted }}>{l.peso_prom_ingreso ? `${l.peso_prom_ingreso} kg` : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function calcPesoProm(pa) {
  if (!pa || pa.length === 0) return null
  const conPeso = pa.filter(p => p.peso_promedio && p.rango !== 'menores')
  if (!conPeso.length) return null
  const tot = conPeso.reduce((s, p) => s + (p.cantidad || 0), 0)
  if (!tot) return null
  return conPeso.reduce((s, p) => s + p.peso_promedio * (p.cantidad || 0), 0) / tot
}
