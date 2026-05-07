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
}

function Badge({ children, type = 'neutral' }) {
  const styles = {
    ok:      { background: S.greenLight, color: S.green },
    warn:    { background: S.amberLight, color: S.amber },
    red:     { background: S.redLight, color: S.red },
    info:    { background: S.accentLight, color: S.accent },
    neutral: { background: S.bg, color: S.muted, border: `1px solid ${S.border}` },
  }
  return <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600, fontFamily: 'monospace', ...styles[type] }}>{children}</span>
}

function Campo({ label, children, hint }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</label>
      {children}
      {hint && <span style={{ fontSize: 10, color: S.hint }}>{hint}</span>}
    </div>
  )
}

const inputStyle = { border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 11px', fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif", color: S.text, background: S.surface, width: '100%', boxSizing: 'border-box' }
const inputReadonly = { ...inputStyle, background: S.bg, fontFamily: 'monospace', fontWeight: 500, cursor: 'default' }

export default function Ventas({ usuario }) {
  const [tab, setTab] = useState('ventas')
  const [loading, setLoading] = useState(true)
  const [ventas, setVentas] = useState([])
  const [lotes, setLotes] = useState([])
  const [corrales, setCorrales] = useState([])
  const [gdpPorCorral, setGdpPorCorral] = useState({})

  // Nueva venta - pasos
  const [paso, setPaso] = useState(1)
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    corral_id: '', cantidad: '', kg_vivo: '', desbaste: '8',
    precio_kg: '', comprador: '', remito: '', forma_pago: 'Contado', observaciones: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [ventaConfirmada, setVentaConfirmada] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: v }, { data: l }, { data: c }, { data: ps }] = await Promise.all([
      supabase.from('ventas').select('*, corrales(numero)').order('creado_en', { ascending: false }),
      supabase.from('lotes').select('*').order('created_at', { ascending: false }),
      supabase.from('corrales').select('*').not('rol', 'eq', 'libre').not('rol', 'eq', 'deshabilitado').order('numero'),
      supabase.from('pesadas').select('*, corrales(numero), pesada_animales(rango, cantidad, peso_promedio)').order('creado_en', { ascending: false }).limit(50),
    ])
    setVentas(v || [])
    setLotes(l || [])
    setCorrales(c || [])

    // Calcular GDP y peso actual por corral desde pesadas
    const gdp = {}
    if (ps) {
      const porCorral = {}
      ps.forEach(p => {
        const num = p.corrales?.numero
        if (!num) return
        if (!porCorral[num]) porCorral[num] = []
        porCorral[num].push(p)
      })
      Object.entries(porCorral).forEach(([num, pesadasCorral]) => {
        const sorted = pesadasCorral.sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en))
        if (sorted.length >= 2) {
          const primera = sorted[0]
          const ultima = sorted[sorted.length - 1]
          const dias = Math.max(1, (new Date(ultima.creado_en) - new Date(primera.creado_en)) / (1000 * 60 * 60 * 24))
          const pp1 = calcPesoProm(primera.pesada_animales)
          const pp2 = calcPesoProm(ultima.pesada_animales)
          if (pp1 && pp2) {
            gdp[num] = { gdp: (pp2 - pp1) / dias, pesoActual: pp2, ultimaPesada: ultima.creado_en }
          }
        } else if (sorted.length === 1) {
          const pp = calcPesoProm(sorted[0].pesada_animales)
          if (pp) gdp[num] = { gdp: null, pesoActual: pp, ultimaPesada: sorted[0].creado_en }
        }
      })
    }
    setGdpPorCorral(gdp)
    setLoading(false)
  }

  function calcPesoProm(pa) {
    if (!pa || pa.length === 0) return null
    const conPeso = pa.filter(p => p.peso_promedio)
    if (!conPeso.length) return null
    const tot = conPeso.reduce((s, p) => s + (p.cantidad || 0), 0)
    if (!tot) return null
    return conPeso.reduce((s, p) => s + p.peso_promedio * (p.cantidad || 0), 0) / tot
  }

  // Cálculos de la operación
  const kgBruto = parseFloat(form.kg_vivo) || 0
  const desbastePct = parseFloat(form.desbaste) || 8
  const kgDescuento = Math.round(kgBruto * desbastePct / 100)
  const kgNeto = Math.round(kgBruto - kgDescuento)
  const precioKg = parseFloat(form.precio_kg) || 0
  const totalVenta = Math.round(kgNeto * precioKg)
  const cantVender = parseInt(form.cantidad) || 0

  // Corral seleccionado
  const corralSel = corrales.find(c => String(c.id) === String(form.corral_id))
  const gdpCorral = corralSel ? gdpPorCorral[corralSel.numero] : null
  const animalesListos = gdpCorral?.pesoActual >= 400 ? corralSel.animales : 0
  const diasParaVenta = gdpCorral?.gdp && gdpCorral?.pesoActual < 400
    ? Math.ceil((400 - gdpCorral.pesoActual) / gdpCorral.gdp)
    : null

  // Corrales con animales ≥400 kg (para alerta)
  const corralesListos = corrales.filter(c => {
    const g = gdpPorCorral[c.numero]
    return g && g.pesoActual >= 400 && (c.animales || 0) > 0
  })

  // Métricas ventas
  const totalVentasAnio = ventas.reduce((s, v) => s + (v.total || 0), 0)
  const totalAnimVendidos = ventas.reduce((s, v) => s + (v.cantidad || 0), 0)
  const precioPromedio = ventas.filter(v => v.precio_kg).length > 0
    ? Math.round(ventas.filter(v => v.precio_kg).reduce((s, v) => s + v.precio_kg, 0) / ventas.filter(v => v.precio_kg).length)
    : null

  // Métricas compras (lotes)
  const totalGastado = lotes.reduce((s, l) => s + ((l.kg_bascula || 0) * (l.precio_compra || 0)), 0)
  const totalAnimComprados = lotes.reduce((s, l) => s + (l.cantidad || 0), 0)

  async function confirmarVenta() {
    if (!form.corral_id || !form.cantidad || !form.kg_vivo) { alert('Completá todos los campos requeridos.'); return }
    setGuardando(true)
    const { error } = await supabase.from('ventas').insert({
      corral_id: parseInt(form.corral_id),
      cantidad: cantVender,
      kg_vivo_total: kgBruto,
      desbaste_pct: desbastePct,
      kg_neto: kgNeto,
      precio_kg: precioKg || null,
      total: totalVenta || null,
      comprador: form.comprador || null,
      observaciones: form.observaciones || null,
      registrado_por: usuario?.id,
    })
    if (!error) {
      const { data: corral } = await supabase.from('corrales').select('animales').eq('id', form.corral_id).single()
      await supabase.from('corrales').update({ animales: Math.max(0, (corral?.animales || 0) - cantVender) }).eq('id', form.corral_id)
      setVentaConfirmada({ ...form, kgNeto, totalVenta, kgDescuento, desbastePct, corralNumero: corralSel?.numero })
      await cargar()
    } else {
      alert('Error al guardar la venta.')
    }
    setGuardando(false)
  }

  function resetNuevaVenta() {
    setForm({ fecha: new Date().toISOString().split('T')[0], corral_id: '', cantidad: '', kg_vivo: '', desbaste: '8', precio_kg: '', comprador: '', remito: '', forma_pago: 'Contado', observaciones: '' })
    setPaso(1)
    setVentaConfirmada(null)
    setTab('ventas')
  }

  if (loading) return <Loader />

  const TABS = [
    { key: 'ventas', label: 'Ventas' },
    { key: 'nueva-venta', label: '+ Nueva venta' },
  ]

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 3 }}>Compra y venta</div>
      <div style={{ fontSize: 12, color: S.muted, fontFamily: 'monospace', marginBottom: '1.5rem' }}>
        Registro de operaciones · feedlot {new Date().getFullYear()}
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: '1.5rem', width: 'fit-content' }}>
        {TABS.map((t, i) => (
          <button key={t.key} onClick={() => { setTab(t.key); if (t.key === 'nueva-venta') { setPaso(1); setVentaConfirmada(null) } }}
            style={{ padding: '8px 20px', fontSize: 13, cursor: 'pointer', color: tab === t.key ? '#fff' : S.muted, background: tab === t.key ? S.accent : S.surface, borderRight: i < TABS.length - 1 ? `1px solid ${S.border}` : 'none', fontWeight: 500, border: 'none', fontFamily: "'IBM Plex Sans', sans-serif" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── VENTAS ── */}
      {tab === 'ventas' && (
        <div>
          {/* Métricas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
            {[
              { label: 'Vendido este año', val: totalVentasAnio > 0 ? `$${(totalVentasAnio / 1000000).toFixed(1)}M` : '$0', sub: `${ventas.length} operaciones · ${totalAnimVendidos} animales`, ok: true },
              { label: 'Precio prom. obtenido', val: precioPromedio ? `$${precioPromedio.toLocaleString('es-AR')}` : '—', sub: '$/kg vivo neto (con desbaste)', ok: false },
              { label: 'Margen prom. bruto', val: '—', sub: 'sin costo de alimentación aún', ok: false },
              { label: 'Listos para vender', val: corralesListos.reduce((s, c) => s + (c.animales || 0), 0), sub: corralesListos.length > 0 ? `animales ≥ 400 kg · ${corralesListos.map(c => `C-${c.numero}`).join(', ')}` : 'ningún corral llegó a 400 kg', ok: corralesListos.length > 0 },
            ].map((m, i) => (
              <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '.9rem 1rem' }}>
                <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>{m.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', lineHeight: 1, color: m.ok ? S.green : S.text }}>{m.val}</div>
                <div style={{ fontSize: 11, color: S.hint, marginTop: 3 }}>{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Alerta animales listos */}
          {corralesListos.map(c => {
            const g = gdpPorCorral[c.numero]
            return (
              <div key={c.id} style={{ background: S.accentLight, border: '1px solid #85B7EB', borderRadius: 8, padding: '.85rem 1rem', fontSize: 13, color: S.accent, marginBottom: '1rem', lineHeight: 1.6 }}>
                <strong>{c.animales} animales en corral {c.numero} superaron los 400 kg.</strong>{' '}
                Peso promedio actual: {Math.round(g.pesoActual)} kg{g.gdp ? ` · GDP: ${g.gdp.toFixed(2)} kg/día` : ''}.
                <span style={{ display: 'block', marginTop: 8 }}>
                  <button onClick={() => { setTab('nueva-venta'); setForm(f => ({ ...f, corral_id: String(c.id) })); setPaso(1) }}
                    style={{ padding: '6px 14px', fontSize: 12, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600 }}>
                    Registrar venta →
                  </button>
                </span>
              </div>
            )
          })}

          {/* Historial */}
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em' }}>Historial de ventas</div>
              <button onClick={() => { setTab('nueva-venta'); setPaso(1); setVentaConfirmada(null) }}
                style={{ padding: '5px 10px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                + Nueva venta
              </button>
            </div>
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: S.bg }}>
                    {['Fecha', 'Corral', 'Anim.', 'Comprador', 'Kg brutos', 'Desbaste', 'Kg netos', '$/kg', 'Total', ''].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ventas.length === 0 && (
                    <tr><td colSpan={10} style={{ padding: '2rem', textAlign: 'center', color: S.hint, fontSize: 13 }}>No hay ventas registradas.</td></tr>
                  )}
                  {ventas.map(v => (
                    <tr key={v.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(v.creado_en).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                      <td style={{ padding: '9px 12px' }}>C-{v.corrales?.numero || v.corral_id}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{v.cantidad}</td>
                      <td style={{ padding: '9px 12px', fontSize: 12 }}>{v.comprador || '—'}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{v.kg_vivo_total?.toLocaleString('es-AR')}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{v.desbaste_pct}%</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{v.kg_neto?.toLocaleString('es-AR')}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{v.precio_kg ? `$${v.precio_kg.toLocaleString('es-AR')}` : <span style={{ color: S.amber, fontSize: 11, fontWeight: 600 }}>Pendiente</span>}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600, color: v.total ? S.green : S.hint }}>{v.total ? `$${(v.total / 1000000).toFixed(1)}M` : '—'}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <button onClick={async () => {
                          if (!confirm('¿Eliminar esta venta? Se devuelven los animales al corral.')) return
                          const { data: corral } = await supabase.from('corrales').select('animales').eq('id', v.corral_id).single()
                          await supabase.from('corrales').update({ animales: (corral?.animales || 0) + v.cantidad }).eq('id', v.corral_id)
                          await supabase.from('ventas').delete().eq('id', v.id)
                          cargar()
                        }} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── COMPRAS ── */}
      {tab === 'compras' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
            {[
              { label: 'Gastado este año', val: totalGastado > 0 ? `$${(totalGastado / 1000000).toFixed(1)}M` : '$0', sub: `${lotes.length} compras · ${totalAnimComprados} animales` },
              { label: 'Precio prom. pagado', val: lotes.filter(l => l.precio_compra).length > 0 ? `$${Math.round(lotes.filter(l => l.precio_compra).reduce((s, l) => s + l.precio_compra, 0) / lotes.filter(l => l.precio_compra).length).toLocaleString('es-AR')}` : '—', sub: '$/kg vivo promedio' },
              { label: 'Dif. báscula promedio', val: '—', sub: 'vs factura del vendedor' },
              { label: 'Último ingreso', val: lotes[0]?.cantidad || '—', sub: lotes[0] ? `animales · ${lotes[0].codigo} · ${new Date(lotes[0].fecha_ingreso).toLocaleDateString('es-AR')}` : 'sin ingresos' },
            ].map((m, i) => (
              <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '.9rem 1rem' }}>
                <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>{m.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', lineHeight: 1 }}>{m.val}</div>
                <div style={{ fontSize: 11, color: S.hint, marginTop: 3 }}>{m.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>Historial de compras</div>
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: S.bg }}>
                    {['Fecha', 'Lote', 'Anim.', 'Procedencia', 'Kg factura', 'Kg báscula', 'Diferencia', '$/kg', 'Total', 'Estado'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lotes.length === 0 && (
                    <tr><td colSpan={10} style={{ padding: '2rem', textAlign: 'center', color: S.hint, fontSize: 13 }}>No hay ingresos registrados.</td></tr>
                  )}
                  {lotes.map(l => {
                    const diff = (l.kg_bascula || 0) - (l.kg_factura || l.kg_bascula || 0)
                    const total = (l.kg_bascula || 0) * (l.precio_compra || 0)
                    return (
                      <tr key={l.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(l.fecha_ingreso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{l.codigo}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{l.cantidad}</td>
                        <td style={{ padding: '9px 12px', fontSize: 12 }}>{l.procedencia}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{l.kg_factura?.toLocaleString('es-AR') || '—'}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{l.kg_bascula?.toLocaleString('es-AR') || '—'}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: diff > 0 ? S.green : diff < 0 ? S.amber : S.muted }}>
                          {l.kg_factura ? (diff > 0 ? '+' : '') + diff.toLocaleString('es-AR') + ' kg' : '—'}
                        </td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{l.precio_compra ? `$${l.precio_compra.toLocaleString('es-AR')}` : <span style={{ color: S.hint }}>—</span>}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{total > 0 ? `$${(total / 1000000).toFixed(1)}M` : '—'}</td>
                        <td style={{ padding: '9px 12px' }}>
                          <Badge type={l.corral_cuarentena_id ? 'warn' : 'ok'}>{l.corral_cuarentena_id ? 'Cuarentena' : 'Activo'}</Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ background: S.accentLight, border: '1px solid #85B7EB', borderRadius: 8, padding: '.85rem 1rem', fontSize: 13, color: S.accent, lineHeight: 1.6 }}>
            El registro de compras se hace desde el módulo de <strong>Ingresos</strong>, donde se carga el lote, se verifica el pesaje y se asigna cuarentena. Todo queda vinculado acá automáticamente.
          </div>
        </div>
      )}

      {/* ── NUEVA VENTA ── */}
      {tab === 'nueva-venta' && (
        <div>
          {ventaConfirmada ? (
            // CONFIRMADO
            <div>
              <div style={{ background: S.greenLight, border: '1px solid #97C459', borderRadius: 8, padding: '1.1rem', fontSize: 14, marginBottom: '1.25rem', color: S.green }}>
                <strong>Venta registrada.</strong> Los animales fueron dados de baja del corral y el registro quedó guardado.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.25rem' }}>
                {[
                  { label: 'Animales vendidos', val: ventaConfirmada.cantidad, sub: `dados de baja · corral ${ventaConfirmada.corralNumero}` },
                  { label: 'Total operación', val: ventaConfirmada.totalVenta ? `$${(ventaConfirmada.totalVenta / 1000000).toFixed(1)}M` : '—', sub: `${ventaConfirmada.kgNeto?.toLocaleString('es-AR')} kg netos · ${ventaConfirmada.desbastePct}% desb.` },
                  { label: 'Kg netos', val: ventaConfirmada.kgNeto?.toLocaleString('es-AR'), sub: `desbaste: ${ventaConfirmada.kgDescuento?.toLocaleString('es-AR')} kg` },
                  { label: 'Precio $/kg', val: ventaConfirmada.precio_kg ? `$${parseFloat(ventaConfirmada.precio_kg).toLocaleString('es-AR')}` : '—', sub: 'kg vivo neto' },
                ].map((m, i) => (
                  <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '.9rem 1rem' }}>
                    <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>{m.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', lineHeight: 1, color: S.green }}>{m.val}</div>
                    <div style={{ fontSize: 11, color: S.hint, marginTop: 3 }}>{m.sub}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={resetNuevaVenta} style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                  Ver historial de ventas
                </button>
                <button onClick={() => { setVentaConfirmada(null); setPaso(1); setForm({ fecha: new Date().toISOString().split('T')[0], corral_id: '', cantidad: '', kg_vivo: '', desbaste: '8', precio_kg: '', comprador: '', remito: '', forma_pago: 'Contado', observaciones: '' }) }}
                  style={{ padding: '8px 16px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                  Nueva venta
                </button>
              </div>
            </div>
          ) : (
            // WIZARD
            <div>
              {/* STEPPER */}
              <div style={{ display: 'flex', border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: '1.5rem' }}>
                {[
                  { n: 1, label: 'Seleccionar animales' },
                  { n: 2, label: 'Pesaje y desbaste' },
                  { n: 3, label: 'Precio y comprador' },
                  { n: 4, label: 'Confirmación' },
                ].map((s, i) => {
                  const done = paso > s.n
                  const active = paso === s.n
                  return (
                    <div key={s.n} style={{ flex: 1, padding: '9px 14px', borderRight: i < 3 ? `1px solid ${S.border}` : 'none', display: 'flex', alignItems: 'center', gap: 8, background: active ? S.accentLight : done ? S.greenLight : 'transparent' }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0, background: active ? S.accent : done ? S.green : S.bg, color: (active || done) ? '#fff' : S.muted }}>
                        {done ? '✓' : s.n}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 500, color: active ? S.accent : done ? S.green : S.muted }}>{s.label}</div>
                    </div>
                  )
                })}
              </div>

              {/* PASO 1 */}
              {paso === 1 && (
                <div>
                  <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1rem' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>¿Qué animales vas a vender?</div>
                    <div style={{ background: S.accentLight, border: '1px solid #85B7EB', borderRadius: 8, padding: '.85rem 1rem', fontSize: 13, color: S.accent, marginBottom: '1rem', lineHeight: 1.6 }}>
                      Seleccioná el corral. El sistema muestra los animales que superaron los 400 kg según la última pesada.
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <Campo label="Fecha de venta">
                        <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} style={inputStyle} />
                      </Campo>
                      <Campo label="Corral de origen">
                        <select value={form.corral_id} onChange={e => setForm({ ...form, corral_id: e.target.value })} style={inputStyle}>
                          <option value="">— Seleccioná —</option>
                          {corrales.filter(c => (c.animales || 0) > 0).map(c => {
                            const g = gdpPorCorral[c.numero]
                            const listo = g && g.pesoActual >= 400
                            return (
                              <option key={c.id} value={c.id}>
                                Corral {c.numero} · {c.rol} · {c.animales} animales{g ? ` · ${Math.round(g.pesoActual)} kg prom.` : ''}{listo ? ' ★ listos' : ''}
                              </option>
                            )
                          })}
                        </select>
                      </Campo>
                    </div>

                    {corralSel && (
                      <div>
                        <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem 1.25rem', marginBottom: '1rem' }}>
                          {[
                            ['Animales en corral', corralSel.animales],
                            ['Peso promedio actual', gdpCorral ? Math.round(gdpCorral.pesoActual) + ' kg' : '— (sin pesadas)'],
                            ['Animales ≥ 400 kg', animalesListos > 0 ? <span style={{ color: S.green, fontWeight: 600 }}>{animalesListos} animales</span> : <span style={{ color: S.muted }}>0 animales — no llegaron a 400 kg</span>],
                            ['Última pesada', gdpCorral ? new Date(gdpCorral.ultimaPesada).toLocaleDateString('es-AR') : '—'],
                            ['GDP del corral', gdpCorral?.gdp ? `${gdpCorral.gdp.toFixed(2)} kg/día` : '—'],
                            diasParaVenta !== null && ['Días estimados para 400 kg', `${diasParaVenta} días`],
                          ].filter(Boolean).map(([label, val], i, arr) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0', borderBottom: i < arr.length - 1 ? `1px solid ${S.border}` : 'none', fontSize: 13 }}>
                              <span style={{ color: S.muted }}>{label}</span>
                              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{val}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <Campo label="Animales a vender" hint={animalesListos > 0 ? `Máx. ${animalesListos} que superaron 400 kg` : `Máx. ${corralSel.animales} animales`}>
                            <input type="number" value={form.cantidad} onChange={e => setForm({ ...form, cantidad: e.target.value })}
                              min="1" max={corralSel.animales} placeholder="ej. 48" style={inputStyle} />
                          </Campo>
                          <Campo label="Categoría">
                            <input type="text" value={`${corralSel.categoria || corralSel.rol}${corralSel.sub ? ' · Rango ' + corralSel.sub : ''}`} readOnly style={inputReadonly} />
                          </Campo>
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button onClick={() => setTab('ventas')} style={{ padding: '8px 16px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>Cancelar</button>
                    <button onClick={() => { if (!form.corral_id || !form.cantidad) { alert('Seleccioná un corral e ingresá la cantidad.'); return } setPaso(2) }}
                      style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                      Continuar →
                    </button>
                  </div>
                </div>
              )}

              {/* PASO 2 */}
              {paso === 2 && (
                <div>
                  <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1rem' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>Pesaje en báscula y desbaste</div>
                    <div style={{ background: S.accentLight, border: '1px solid #85B7EB', borderRadius: 8, padding: '.85rem 1rem', fontSize: 13, color: S.accent, marginBottom: '1rem', lineHeight: 1.6 }}>
                      Ingresá los kg totales medidos hoy en báscula y el % de desbaste acordado con el comprador.
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <Campo label="Kg totales en báscula">
                        <input type="number" value={form.kg_vivo} onChange={e => setForm({ ...form, kg_vivo: e.target.value })} placeholder="ej. 19.800" style={inputStyle} />
                      </Campo>
                      <Campo label="% Desbaste" hint="8% por defecto · modificable">
                        <input type="number" value={form.desbaste} onChange={e => setForm({ ...form, desbaste: e.target.value })} step="0.5" min="0" max="20" style={inputStyle} />
                      </Campo>
                      <Campo label="Kg netos">
                        <input type="text" value={kgBruto > 0 ? kgNeto.toLocaleString('es-AR') + ' kg' : ''} readOnly placeholder="— kg" style={inputReadonly} />
                      </Campo>
                    </div>

                    {kgBruto > 0 && (
                      <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem 1.25rem' }}>
                        {[
                          ['Kg brutos báscula', kgBruto.toLocaleString('es-AR') + ' kg'],
                          ['Desbaste', `−${kgDescuento.toLocaleString('es-AR')} kg (${desbastePct}%)`],
                          ['Kg netos a facturar', kgNeto.toLocaleString('es-AR') + ' kg'],
                          ['Prom. neto por animal', cantVender > 0 ? Math.round(kgNeto / cantVender) + ' kg/animal' : '—'],
                        ].map(([label, val], i, arr) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < arr.length - 1 ? `1px solid ${S.border}` : 'none', fontSize: 13 }}>
                            <span style={{ color: S.muted }}>{label}</span>
                            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: i === 2 ? S.accent : S.text }}>{val}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button onClick={() => setPaso(1)} style={{ padding: '8px 16px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>← Atrás</button>
                    <button onClick={() => { if (!form.kg_vivo) { alert('Ingresá los kg en báscula.'); return } setPaso(3) }}
                      style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                      Continuar →
                    </button>
                  </div>
                </div>
              )}

              {/* PASO 3 */}
              {paso === 3 && (
                <div>
                  <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1rem' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>Precio y comprador</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <Campo label="Comprador">
                        <select value={form.comprador} onChange={e => setForm({ ...form, comprador: e.target.value })} style={inputStyle}>
                          <option value="">— Seleccioná —</option>
                          {['Frigorífico Rioplatense', 'Frigorífico San Jorge', 'Consig. Los Álamos', 'Otro'].map(o => <option key={o}>{o}</option>)}
                        </select>
                      </Campo>
                      {form.comprador === 'Otro' && (
                        <Campo label="Nombre del comprador">
                          <input type="text" value={form.comprador_otro || ''} onChange={e => setForm({ ...form, comprador_otro: e.target.value })} placeholder="Nombre del frigorífico o consignatario" style={inputStyle} />
                        </Campo>
                      )}
                      <Campo label="Precio $/kg vivo neto">
                        <input type="number" value={form.precio_kg} onChange={e => setForm({ ...form, precio_kg: e.target.value })} placeholder="ej. 3.100" style={inputStyle} />
                      </Campo>
                      <Campo label="N° remito / liquidación">
                        <input type="text" value={form.remito} onChange={e => setForm({ ...form, remito: e.target.value })} placeholder="ej. 0001-00005678" style={inputStyle} />
                      </Campo>
                      <Campo label="Forma de pago">
                        <select value={form.forma_pago} onChange={e => setForm({ ...form, forma_pago: e.target.value })} style={inputStyle}>
                          {['Contado', 'A 7 días', 'A 15 días', 'A 30 días'].map(o => <option key={o}>{o}</option>)}
                        </select>
                      </Campo>
                      <Campo label="Observaciones">
                        <input type="text" value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} placeholder="condición de animales, acuerdos, etc." style={inputStyle} />
                      </Campo>
                    </div>

                    {kgNeto > 0 && precioKg > 0 && (
                      <div>
                        <div style={{ height: 1, background: S.border, margin: '1rem 0' }} />
                        <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem' }}>Resultado de la operación</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem 1.25rem' }}>
                            {[
                              ['Kg netos', kgNeto.toLocaleString('es-AR') + ' kg'],
                              ['Precio $/kg', '$' + precioKg.toLocaleString('es-AR')],
                              ['Total venta', '$' + totalVenta.toLocaleString('es-AR')],
                            ].map(([l, v], i, arr) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < arr.length - 1 ? `1px solid ${S.border}` : 'none', fontSize: 13, fontWeight: i === arr.length - 1 ? 700 : 400 }}>
                                <span style={{ color: S.muted }}>{l}</span>
                                <span style={{ fontFamily: 'monospace', color: i === arr.length - 1 ? S.green : S.text }}>{v}</span>
                              </div>
                            ))}
                          </div>
                          <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem 1.25rem' }}>
                            <div style={{ fontSize: 12, color: S.muted, lineHeight: 1.6 }}>
                              El margen bruto se calcula en el módulo de <strong>Rentabilidad</strong>, una vez completados los costos de alimentación y sanidad.
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button onClick={() => setPaso(2)} style={{ padding: '8px 16px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>← Atrás</button>
                    <button onClick={() => setPaso(4)}
                      style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                      Ver resumen →
                    </button>
                  </div>
                </div>
              )}

              {/* PASO 4 - RESUMEN */}
              {paso === 4 && (
                <div>
                  <div style={{ background: S.greenLight, border: '1px solid #97C459', borderRadius: 8, padding: '.85rem 1rem', fontSize: 13, color: S.green, marginBottom: '1rem', lineHeight: 1.6 }}>
                    Revisá el resumen antes de confirmar. Al confirmar, los animales se dan de baja del corral.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>Detalle de la operación</div>
                      <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem 1.25rem' }}>
                        {[
                          ['Fecha', new Date(form.fecha).toLocaleDateString('es-AR')],
                          ['Corral', `Corral ${corralSel?.numero} · ${corralSel?.rol}`],
                          ['Animales', form.cantidad],
                          ['Kg brutos', (kgBruto).toLocaleString('es-AR') + ' kg'],
                          ['Desbaste', `${desbastePct}%`],
                          ['Kg netos', kgNeto.toLocaleString('es-AR') + ' kg'],
                          ['Comprador', form.comprador || '—'],
                          ['Forma de pago', form.forma_pago],
                          ['Remito', form.remito || '—'],
                        ].map(([l, v], i, arr) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < arr.length - 1 ? `1px solid ${S.border}` : 'none', fontSize: 13 }}>
                            <span style={{ color: S.muted }}>{l}</span>
                            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>Resultado económico</div>
                      <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem 1.25rem' }}>
                        {[
                          ['Precio $/kg', precioKg > 0 ? '$' + precioKg.toLocaleString('es-AR') : '—'],
                          ['Kg netos', kgNeto.toLocaleString('es-AR') + ' kg'],
                          ['Total venta', totalVenta > 0 ? '$' + totalVenta.toLocaleString('es-AR') : '—'],
                        ].map(([l, v], i, arr) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < arr.length - 1 ? `1px solid ${S.border}` : 'none', fontSize: 13, fontWeight: i === arr.length - 1 ? 700 : 400 }}>
                            <span style={{ color: S.muted }}>{l}</span>
                            <span style={{ fontFamily: 'monospace', color: i === arr.length - 1 && totalVenta > 0 ? S.green : S.text }}>{v}</span>
                          </div>
                        ))}
                      </div>
                      {!precioKg && (
                        <div style={{ fontSize: 12, color: S.muted, marginTop: '.75rem', lineHeight: 1.6 }}>
                          Podés confirmar sin precio ahora y cargarlo después desde el historial.
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button onClick={() => setPaso(3)} style={{ padding: '8px 16px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>← Revisar</button>
                    <button onClick={confirmarVenta} disabled={guardando}
                      style={{ padding: '10px 22px', fontSize: 14, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                      {guardando ? 'Guardando...' : '✓ Confirmar venta'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
