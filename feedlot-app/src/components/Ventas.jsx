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

const inputStyle = { width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: "'IBM Plex Sans', sans-serif", color: S.text }
const inputReadonly = { ...inputStyle, background: S.bg, color: S.muted, cursor: 'default' }

export default function Ventas({ usuario }) {
  const [tab, setTab] = useState('ventas')
  const [loading, setLoading] = useState(true)
  const [ventas, setVentas] = useState([])
  const [lotes, setLotes] = useState([])
  const [corrales, setCorrales] = useState([])
  const [gdpPorCorral, setGdpPorCorral] = useState({})
  const [compradores, setCompradores] = useState([])

  const [ventasSinPrecio, setVentasSinPrecio] = useState([])
  const [editandoVenta, setEditandoVenta] = useState(null)
  const [pagosVenta, setPagosVenta] = useState({})
  const [registrandoPago, setRegistrandoPago] = useState(null)
  const [formPago, setFormPago] = useState({ monto: '', forma_pago: 'transferencia', fecha: new Date().toISOString().split('T')[0], numero_cheque: '', banco: '', fecha_vencimiento_cheque: '', observaciones: '' })
  // Nueva venta - pasos
  const [paso, setPaso] = useState(1)
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    corral_id: '', cantidad: '', kg_vivo: '', desbaste: '8',
    precio_kg: '', comprador: '', remito: '', forma_pago: 'Contado', observaciones: '',
    monto_facturado: '', iva_pct: '10.5', plazo_dias: '',
  })
  // Multi-corral
  const [corralesVenta, setCorralesVenta] = useState([{ corral_id: '', cantidad: '', kg_vivo: '' }])
  const [guardando, setGuardando] = useState(false)
  const [ventaConfirmada, setVentaConfirmada] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: v }, { data: l }, { data: c }, { data: ps }] = await Promise.all([
      supabase.from('ventas').select('*, corrales(numero), grupo_venta_id').order('creado_en', { ascending: false }),
      supabase.from('lotes').select('*').order('created_at', { ascending: false }),
      supabase.from('corrales').select('*').not('rol', 'eq', 'libre').not('rol', 'eq', 'deshabilitado').order('numero'),
      supabase.from('pesadas').select('*, corrales(numero), pesada_animales(rango, cantidad, peso_promedio)').order('creado_en', { ascending: false }).limit(50),
    ])
    setVentas(v || [])
    setLotes(l || [])
    setCorrales(c || [])
    // Cargar compradores desde contactos + ventas anteriores
    const { data: contactosData } = await supabase.from('contactos').select('nombre').eq('activo', true).in('tipo', ['comprador_hacienda', 'otro'])
    const nombresContactos = (contactosData || []).map(c => c.nombre)
    const nombresVentas = [...new Set((v || []).map(x => x.comprador).filter(Boolean))]
    const comps = [...new Set([...nombresContactos, ...nombresVentas])].sort()
    setCompradores(comps)
    // Deduplicar por grupo_venta_id - mostrar solo una por grupo
    const todasSinPrecio = (v || []).filter(x => !x.precio_kg)
    const gruposVistos = new Set()
    const sinPrecioDedup = todasSinPrecio.filter(x => {
      if (x.grupo_venta_id) {
        if (gruposVistos.has(x.grupo_venta_id)) return false
        gruposVistos.add(x.grupo_venta_id)
      }
      return true
    })
    setVentasSinPrecio(sinPrecioDedup)
    // Cargar pagos de ventas
    const { data: pagos } = await supabase.from('pagos_ventas').select('*').order('fecha', { ascending: false })
    const pagosPorVenta = {}
    ;(pagos || []).forEach(p => {
      if (!pagosPorVenta[p.venta_id]) pagosPorVenta[p.venta_id] = []
      pagosPorVenta[p.venta_id].push(p)
    })
    setPagosVenta(pagosPorVenta)

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
  const kgBruto = corralesVenta.reduce((s, c) => s + (parseFloat(c.kg_vivo) || 0), 0)
  const cantVender = corralesVenta.reduce((s, c) => s + (parseInt(c.cantidad) || 0), 0)
  const desbastePct = parseFloat(form.desbaste) || 8
  const kgDescuento = Math.round(kgBruto * desbastePct / 100)
  const kgNeto = Math.round(kgBruto - kgDescuento)
  const precioKg = parseFloat(form.precio_kg) || 0
  const totalVenta = Math.round(kgNeto * precioKg)

  // Corral seleccionado (para compatibilidad)
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

  async function guardarDatosVenta(venta) {
    const ep = editandoVenta
    if (!ep?.precio_kg) { alert('Ingresa el precio'); return }
    const precioKg = parseFloat(ep.precio_kg)
    const desbastePct = ep.desbaste ? parseFloat(ep.desbaste) : (venta.desbaste_pct || 8)
    const kgNeto = venta.kg_vivo_total ? Math.round(venta.kg_vivo_total * (1 - desbastePct / 100) * 100) / 100 : (venta.kg_neto || 0)
    const montoTotal = Math.round(kgNeto * precioKg)
    const montoFacturado = ep.monto_facturado ? parseFloat(ep.monto_facturado) : montoTotal
    const montoNegro = Math.max(0, montoTotal - montoFacturado)
    const ivaPct = parseFloat(ep.iva_pct || 10.5)
    const ivaMonto = Math.round(montoFacturado * ivaPct / 100)
    const plazo = parseInt(ep.plazo_dias || 0)
    const fechaVto = plazo > 0 ? new Date(Date.now() + plazo * 86400000).toISOString().split('T')[0] : null
    const compradorFinal = ep.comprador === 'Otro' ? (ep.compradorNuevo || null) : (ep.comprador || venta.comprador || null)

    // Si es comprador nuevo, guardarlo como contacto
    if (compradorFinal && !compradores.includes(compradorFinal)) {
      await supabase.from('contactos').insert({ nombre: compradorFinal, tipo: 'comprador_hacienda', activo: true })
    }

    const updateData = {
      precio_kg: precioKg, desbaste_pct: desbastePct, kg_neto: kgNeto,
      total: montoTotal, monto_facturado: montoFacturado, monto_negro: montoNegro,
      iva_pct: ivaPct, iva_monto: ivaMonto,
      plazo_dias: plazo || null, fecha_vencimiento_cobro: fechaVto,
      estado_comercial: 'precio_cargado',
      comprador: compradorFinal,
      observaciones: ep.observaciones || venta.observaciones || null,
    }

    if (venta.grupo_venta_id) {
      const { data: grupo } = await supabase.from('ventas').select('*').eq('grupo_venta_id', venta.grupo_venta_id)
      for (const v of (grupo || [])) {
        const kgNetoV = v.kg_vivo_total ? Math.round(v.kg_vivo_total * (1 - desbastePct / 100) * 100) / 100 : (v.kg_neto || 0)
        const montoTotalV = Math.round(kgNetoV * precioKg)
        const montoFactV = ep.monto_facturado ? Math.round(parseFloat(ep.monto_facturado) * kgNetoV / kgNeto) : montoTotalV
        const montoNegroV = Math.max(0, montoTotalV - montoFactV)
        await supabase.from('ventas').update({ ...updateData, kg_neto: kgNetoV, total: montoTotalV, monto_facturado: montoFactV, monto_negro: montoNegroV, iva_monto: Math.round(montoFactV * ivaPct / 100) }).eq('id', v.id)
      }
    } else {
      await supabase.from('ventas').update(updateData).eq('id', venta.id)
    }
    setEditandoVenta(null)
    await cargar()
  }

  async function confirmarVenta() {
    const corralesValidos = corralesVenta.filter(c => c.corral_id && c.cantidad && c.kg_vivo)
    if (corralesValidos.length === 0) { alert('Completá al menos un corral con cantidad y kg.'); return }
    setGuardando(true)

    const desbPct = parseFloat(form.desbaste) || 8
    const totalKgBruto = corralesValidos.reduce((s, c) => s + (parseFloat(c.kg_vivo) || 0), 0)
    const totalKgNeto = Math.round(totalKgBruto * (1 - desbPct / 100))
    const precio = parseFloat(form.precio_kg) || 0
    const montoTotal = precio ? Math.round(totalKgNeto * precio) : null
    const montoFacturado = form.monto_facturado ? parseFloat(form.monto_facturado) : montoTotal
    const montoNegro = montoTotal && montoFacturado ? Math.max(0, montoTotal - montoFacturado) : 0
    const ivaPct = parseFloat(form.iva_pct || 10.5)
    const ivaMonto = montoFacturado ? Math.round(montoFacturado * ivaPct / 100) : 0
    const plazo = parseInt(form.plazo_dias || 0)
    const fechaVto = plazo > 0 ? new Date(Date.now() + plazo * 86400000).toISOString().split('T')[0] : null
    const compradorFinal = form.comprador === 'Otro' ? (form.comprador_otro || null) : (form.comprador || null)
    const grupoId = corralesValidos.length > 1 ? crypto.randomUUID() : null

    // Auto-guardar comprador nuevo como contacto
    if (compradorFinal && !compradores.includes(compradorFinal)) {
      await supabase.from('contactos').insert({ nombre: compradorFinal, tipo: 'comprador_hacienda', activo: true })
    }

    let hasError = false
    for (const cv of corralesValidos) {
      const kgNetoCv = Math.round(parseFloat(cv.kg_vivo) * (1 - desbPct / 100))
      const montoTotalCv = precio ? Math.round(kgNetoCv * precio) : null
      const montoFactCv = montoFacturado && montoTotal ? Math.round(montoFacturado * kgNetoCv / totalKgNeto) : montoTotalCv
      const montoNegroCv = montoTotalCv && montoFactCv ? Math.max(0, montoTotalCv - montoFactCv) : 0
      const { error } = await supabase.from('ventas').insert({
        corral_id: parseInt(cv.corral_id),
        cantidad: parseInt(cv.cantidad),
        kg_vivo_total: parseFloat(cv.kg_vivo),
        desbaste_pct: desbPct,
        kg_neto: kgNetoCv,
        precio_kg: precio || null,
        total: montoTotalCv,
        monto_facturado: montoFactCv,
        monto_negro: montoNegroCv,
        iva_pct: ivaPct,
        iva_monto: montoFactCv ? Math.round(montoFactCv * ivaPct / 100) : null,
        plazo_dias: plazo || null,
        fecha_vencimiento_cobro: fechaVto,
        estado_comercial: precio ? 'precio_cargado' : 'pendiente',
        comprador: compradorFinal,
        observaciones: form.observaciones || null,
        registrado_por: usuario?.id,
        grupo_venta_id: grupoId,
      })
      if (error) { hasError = true; continue }
      const { data: corral } = await supabase.from('corrales').select('animales').eq('id', cv.corral_id).single()
      const nuevosAnimales = Math.max(0, (corral?.animales || 0) - parseInt(cv.cantidad))
      const updateCorral = { animales: nuevosAnimales }
      if (nuevosAnimales === 0) { updateCorral.rol = 'libre'; updateCorral.sub = null }
      await supabase.from('corrales').update(updateCorral).eq('id', parseInt(cv.corral_id))
    }

    if (!hasError) {
      const primCorral = corrales.find(c => String(c.id) === String(corralesValidos[0].corral_id))
      setVentaConfirmada({
        ...form, kgNeto: totalKgNeto, totalVenta: montoTotal,
        kgDescuento: Math.round(totalKgBruto * desbPct / 100),
        desbastePct: desbPct,
        corralNumero: corralesValidos.length > 1 ? `${corralesValidos.length} corrales` : primCorral?.numero,
        cantidad: corralesValidos.reduce((s, c) => s + (parseInt(c.cantidad) || 0), 0)
      })
      await cargar()
    } else {
      alert('Error al guardar alguna venta.')
    }
    setGuardando(false)
  }

  function resetNuevaVenta() {
    setForm({ fecha: new Date().toISOString().split('T')[0], corral_id: '', cantidad: '', kg_vivo: '', desbaste: '8', precio_kg: '', comprador: '', remito: '', forma_pago: 'Contado', observaciones: '', monto_facturado: '', iva_pct: '10.5', plazo_dias: '' })
    setCorralesVenta([{ corral_id: '', cantidad: '', kg_vivo: '' }])
    setPaso(1)
    setVentaConfirmada(null)
    setTab('ventas')
  }

  if (loading) return <Loader />

  const TABS = [
    { key: 'ventas', label: 'Ventas' },
    { key: 'gestion', label: 'Gestión comercial' },
    { key: 'cuentas', label: 'Cuentas por comprador' },
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

          {/* Banner ventas sin precio */}
          {ventasSinPrecio.length > 0 && (
            <div style={{ background: S.amberLight, border: '1px solid #EF9F27', borderRadius: 10, padding: '1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: S.amber, marginBottom: '.85rem' }}>
                ⚠ {ventasSinPrecio.length} venta{ventasSinPrecio.length !== 1 ? 's' : ''} sin precio cargado
              </div>
              {ventasSinPrecio.map(v => {
                const isEdit = editandoVenta?.id === v.id
                return (
                  <div key={v.id} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem', marginBottom: '.65rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: isEdit ? 12 : 0 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                          {v.grupo_venta_id ? 'Venta multi-corral' : `C-${v.corrales?.numero || v.corral_id}`} · {v.cantidad} animales
                          {v.grupo_venta_id && <span style={{ fontSize: 11, color: S.amber, marginLeft: 6 }}>· Se actualizarán todos los corrales del grupo</span>}
                        </div>
                        <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>
                          {v.kg_neto?.toLocaleString('es-AR')} kg netos · {new Date(v.creado_en).toLocaleDateString('es-AR')}
                          {v.comprador && ` · ${v.comprador}`}
                        </div>
                      </div>
                      {!isEdit && (
                        <button onClick={() => setEditandoVenta({ id: v.id, precio_kg: '', comprador: v.comprador || '', compradorNuevo: '', observaciones: v.observaciones || '', desbaste: String(v.desbaste_pct || 8) })}
                          style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif", flexShrink: 0, marginLeft: 12 }}>
                          Completar datos
                        </button>
                      )}
                    </div>
                    {isEdit && (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Precio $/kg *</label>
                            <input type="number" placeholder="ej. 3100" value={editandoVenta.precio_kg}
                              onChange={e => setEditandoVenta({ ...editandoVenta, precio_kg: e.target.value })}
                              style={{ width: '100%', border: `1px solid ${S.accent}`, borderRadius: 6, padding: '8px 10px', fontSize: 14, background: S.surface, boxSizing: 'border-box', fontWeight: 600, fontFamily: 'monospace' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Desbaste %</label>
                            <input type="number" placeholder="8" value={editandoVenta.desbaste}
                              onChange={e => setEditandoVenta({ ...editandoVenta, desbaste: e.target.value })}
                              style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 14, background: S.surface, boxSizing: 'border-box', fontFamily: 'monospace' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Plazo (días)</label>
                            <input type="number" placeholder="0 = contado" value={editandoVenta.plazo_dias || ''}
                              onChange={e => setEditandoVenta({ ...editandoVenta, plazo_dias: e.target.value })}
                              style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 14, background: S.surface, boxSizing: 'border-box', fontFamily: 'monospace' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Comprador</label>
                            <select value={editandoVenta.comprador} onChange={e => setEditandoVenta({ ...editandoVenta, comprador: e.target.value, compradorNuevo: '' })}
                              style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.surface }}>
                              <option value="">— Sin comprador —</option>
                              {compradores.map(c => <option key={c} value={c}>{c}</option>)}
                              <option value="Otro">+ Nuevo...</option>
                            </select>
                          </div>
                          {editandoVenta.comprador === 'Otro' && (
                            <div style={{ gridColumn: '2/-1' }}>
                              <input type="text" placeholder="Nombre del comprador" value={editandoVenta.compradorNuevo || ''}
                                onChange={e => setEditandoVenta({ ...editandoVenta, compradorNuevo: e.target.value })}
                                style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.surface, boxSizing: 'border-box' }} />
                            </div>
                          )}
                          <div style={{ gridColumn: '1/-1' }}>
                            <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Observaciones</label>
                            <input type="text" placeholder="remito, condiciones, etc." value={editandoVenta.observaciones}
                              onChange={e => setEditandoVenta({ ...editandoVenta, observaciones: e.target.value })}
                              style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.surface, boxSizing: 'border-box' }} />
                          </div>
                        </div>

                        {editandoVenta.precio_kg && (() => {
                          const desbPct = parseFloat(editandoVenta.desbaste) || (v.desbaste_pct || 8)
                          const kgNetoCalc = v.kg_vivo_total ? Math.round(v.kg_vivo_total * (1 - desbPct / 100)) : (v.kg_neto || 0)
                          const montoTotalCalc = Math.round(kgNetoCalc * parseFloat(editandoVenta.precio_kg))
                          const montoFactCalc = editandoVenta.monto_facturado ? parseFloat(editandoVenta.monto_facturado) : montoTotalCalc
                          const montoNegroCalc = Math.max(0, montoTotalCalc - montoFactCalc)
                          const ivaPct = parseFloat(editandoVenta.iva_pct || 10.5)
                          const ivaMCalc = Math.round(montoFactCalc * ivaPct / 100)
                          return (
                            <div style={{ marginBottom: 10 }}>
                              <div style={{ background: S.greenLight, border: '1px solid #97C459', borderRadius: 6, padding: '8px 12px', marginBottom: 8, fontSize: 13, color: S.green }}>
                                KG neto: <strong>{kgNetoCalc.toLocaleString('es-AR')} kg</strong> · Total: <strong>${montoTotalCalc.toLocaleString('es-AR')}</strong>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                <div>
                                  <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Monto facturado $</label>
                                  <input type="number" placeholder={montoTotalCalc} value={editandoVenta.monto_facturado || ''}
                                    onChange={e => setEditandoVenta({ ...editandoVenta, monto_facturado: e.target.value })}
                                    style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: 'monospace' }} />
                                </div>
                                <div>
                                  <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>% IVA</label>
                                  <select value={editandoVenta.iva_pct || '10.5'} onChange={e => setEditandoVenta({ ...editandoVenta, iva_pct: e.target.value })}
                                    style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.surface }}>
                                    <option value="0">Sin IVA</option>
                                    <option value="10.5">10.5%</option>
                                    <option value="21">21%</option>
                                  </select>
                                </div>
                                <div>
                                  <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>IVA $</label>
                                  <input type="text" value={`$${ivaMCalc.toLocaleString('es-AR')}`} readOnly
                                    style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.bg, boxSizing: 'border-box', fontFamily: 'monospace' }} />
                                </div>
                              </div>
                              {montoNegroCalc > 0 && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                                  <div style={{ background: S.greenLight, border: '1px solid #97C459', borderRadius: 6, padding: '8px 12px' }}>
                                    <div style={{ fontSize: 10, color: S.green, fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Parte facturada</div>
                                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: S.green }}>${montoFactCalc.toLocaleString('es-AR')}</div>
                                  </div>
                                  <div style={{ background: '#F0EAFB', border: '1px solid #9F8ED4', borderRadius: 6, padding: '8px 12px' }}>
                                    <div style={{ fontSize: 10, color: '#3D1A6B', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Parte en negro</div>
                                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: '#3D1A6B' }}>${montoNegroCalc.toLocaleString('es-AR')}</div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })()}

                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => guardarDatosVenta(v)}
                            style={{ flex: 1, padding: '8px', fontSize: 13, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                            Guardar
                          </button>
                          <button onClick={() => setEditandoVenta(null)}
                            style={{ padding: '8px 14px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

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
                  {(() => {
                    // Agrupar por grupo_venta_id
                    const grupos = {}
                    const ventasOrden = []
                    ventas.forEach(v => {
                      if (v.grupo_venta_id) {
                        if (!grupos[v.grupo_venta_id]) {
                          grupos[v.grupo_venta_id] = []
                          ventasOrden.push({ tipo: 'grupo', id: v.grupo_venta_id })
                        }
                        grupos[v.grupo_venta_id].push(v)
                      } else {
                        ventasOrden.push({ tipo: 'simple', venta: v })
                      }
                    })
                    // Deduplicar grupos
                    const vistos = new Set()
                    const filas = []
                    ventas.forEach(v => {
                      if (v.grupo_venta_id) {
                        if (!vistos.has(v.grupo_venta_id)) {
                          vistos.add(v.grupo_venta_id)
                          filas.push({ tipo: 'grupo', grupo: grupos[v.grupo_venta_id] })
                        }
                      } else {
                        filas.push({ tipo: 'simple', venta: v })
                      }
                    })
                    return filas.map((f, fi) => {
                      if (f.tipo === 'simple') {
                        const v = f.venta
                        return (
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
                                const { data: corral } = await supabase.from('corrales').select('animales, rol').eq('id', v.corral_id).single()
                                const updateCorral = { animales: (corral?.animales || 0) + v.cantidad }
                                if (corral?.rol === 'libre') updateCorral.rol = 'clasificado'
                                await supabase.from('corrales').update(updateCorral).eq('id', v.corral_id)
                                await supabase.from('ventas').delete().eq('id', v.id)
                                cargar()
                              }} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        )
                      } else {
                        // Grupo de ventas multi-corral
                        const g = f.grupo
                        const totalKgVivo = g.reduce((s, v) => s + (v.kg_vivo_total || 0), 0)
                        const totalKgNeto = g.reduce((s, v) => s + (v.kg_neto || 0), 0)
                        const totalAnim = g.reduce((s, v) => s + (v.cantidad || 0), 0)
                        const totalMonto = g.reduce((s, v) => s + (v.total || 0), 0)
                        const corralesNums = g.map(v => `C-${v.corrales?.numero || v.corral_id}`).join(', ')
                        const sinPrecio = g.some(v => !v.precio_kg)
                        const v0 = g[0]
                        return (
                          <tr key={v0.grupo_venta_id} style={{ borderBottom: `1px solid ${S.border}`, background: S.accentLight }}>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(v0.creado_en).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                            <td style={{ padding: '9px 12px', fontSize: 12 }}>
                              <div style={{ fontWeight: 600 }}>{corralesNums}</div>
                              <div style={{ fontSize: 10, color: S.accent }}>Venta multi-corral</div>
                            </td>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{totalAnim}</td>
                            <td style={{ padding: '9px 12px', fontSize: 12 }}>{v0.comprador || '—'}</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{totalKgVivo.toLocaleString('es-AR')}</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{v0.desbaste_pct}%</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{totalKgNeto.toLocaleString('es-AR')}</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{v0.precio_kg ? `$${v0.precio_kg.toLocaleString('es-AR')}` : <span style={{ color: S.amber, fontSize: 11, fontWeight: 600 }}>Pendiente</span>}</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600, color: totalMonto > 0 ? S.green : S.hint }}>{totalMonto > 0 ? `$${(totalMonto / 1000000).toFixed(1)}M` : '—'}</td>
                            <td style={{ padding: '9px 12px' }}>
                              <button onClick={async () => {
                                if (!confirm(`¿Eliminar esta venta? Se devuelven los animales a ${g.length} corrales.`)) return
                                for (const v of g) {
                                  const { data: corral } = await supabase.from('corrales').select('animales, rol').eq('id', v.corral_id).single()
                                  const updateCorral = { animales: (corral?.animales || 0) + v.cantidad }
                                  if (corral?.rol === 'libre') updateCorral.rol = 'clasificado'
                                  await supabase.from('corrales').update(updateCorral).eq('id', v.corral_id)
                                  await supabase.from('ventas').delete().eq('id', v.id)
                                }
                                cargar()
                              }} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        )
                      }
                    })
                  })()}
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
                      Podés seleccionar uno o más corrales para venderle a un mismo comprador.
                    </div>

                    <Campo label="Fecha de venta" style={{ marginBottom: '1rem' }}>
                      <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} style={{ ...inputStyle, maxWidth: 220 }} />
                    </Campo>

                    {/* Corrales */}
                    {corralesVenta.map((cv, i) => {
                      const cSel = corrales.find(c => String(c.id) === String(cv.corral_id))
                      const g = cSel ? gdpPorCorral[cSel.numero] : null
                      return (
                        <div key={i} style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem', marginBottom: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: S.muted }}>Corral {i + 1}</div>
                            {corralesVenta.length > 1 && (
                              <button onClick={() => setCorralesVenta(corralesVenta.filter((_, j) => j !== i))}
                                style={{ background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>Quitar</button>
                            )}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                            <div>
                              <label style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 4 }}>Corral</label>
                              <select value={cv.corral_id} onChange={e => { const n = [...corralesVenta]; n[i].corral_id = e.target.value; setCorralesVenta(n) }} style={inputStyle}>
                                <option value="">— Seleccioná —</option>
                                {corrales.filter(c => (c.animales || 0) > 0).map(c => {
                                  const g = gdpPorCorral[c.numero]
                                  const listo = g && g.pesoActual >= 400
                                  return <option key={c.id} value={c.id}>C-{c.numero} · {c.animales} anim.{g ? ` · ${Math.round(g.pesoActual)}kg` : ''}{listo ? ' ★' : ''}</option>
                                })}
                              </select>
                            </div>
                            <div>
                              <label style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 4 }}>Animales a vender</label>
                              <input type="number" value={cv.cantidad} placeholder={cSel ? `Máx. ${cSel.animales}` : 'ej. 48'}
                                onChange={e => { const n = [...corralesVenta]; n[i].cantidad = e.target.value; setCorralesVenta(n) }} style={inputStyle} />
                            </div>
                            <div>
                              <label style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 4 }}>Kg báscula</label>
                              <input type="number" value={cv.kg_vivo} placeholder="ej. 19800"
                                onChange={e => { const n = [...corralesVenta]; n[i].kg_vivo = e.target.value; setCorralesVenta(n) }} style={inputStyle} />
                            </div>
                          </div>
                          {cSel && g && (
                            <div style={{ fontSize: 12, color: S.muted, marginTop: 8 }}>
                              Peso prom.: <strong>{Math.round(g.pesoActual)} kg</strong>
                              {g.gdp ? ` · GDP: ${g.gdp.toFixed(2)} kg/día` : ''}
                              {g.pesoActual >= 400 ? <span style={{ color: S.green, marginLeft: 6 }}>★ Listos para venta</span> : ''}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    <button onClick={() => setCorralesVenta([...corralesVenta, { corral_id: '', cantidad: '', kg_vivo: '' }])}
                      style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', marginTop: 4, fontFamily: "'IBM Plex Sans', sans-serif" }}>
                      + Agregar otro corral
                    </button>

                    {/* Resumen */}
                    {corralesVenta.some(c => c.cantidad && c.kg_vivo) && (
                      <div style={{ background: S.accentLight, border: '1px solid #85B7EB', borderRadius: 8, padding: '1rem', marginTop: '1rem' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: S.accent, textTransform: 'uppercase', marginBottom: 8 }}>Resumen de la operación</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, fontSize: 13 }}>
                          <div><div style={{ color: S.muted, fontSize: 11 }}>Total animales</div><div style={{ fontFamily: 'monospace', fontWeight: 700 }}>{corralesVenta.reduce((s, c) => s + (parseInt(c.cantidad) || 0), 0)}</div></div>
                          <div><div style={{ color: S.muted, fontSize: 11 }}>Kg brutos totales</div><div style={{ fontFamily: 'monospace', fontWeight: 700 }}>{corralesVenta.reduce((s, c) => s + (parseFloat(c.kg_vivo) || 0), 0).toLocaleString('es-AR')} kg</div></div>
                          <div><div style={{ color: S.muted, fontSize: 11 }}>Corrales incluidos</div><div style={{ fontFamily: 'monospace', fontWeight: 700 }}>{corralesVenta.filter(c => c.corral_id).length}</div></div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button onClick={() => setTab('ventas')} style={{ padding: '8px 16px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>Cancelar</button>
                    <button onClick={() => {
                      const validos = corralesVenta.filter(c => c.corral_id && c.cantidad)
                      if (validos.length === 0) { alert('Agregá al menos un corral con cantidad.'); return }
                      setPaso(2)
                    }}
                      style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                      Continuar →
                    </button>
                  </div>
                </div>
              )}

              {/* PASO 2 */}
              {paso === 2 && (() => {
                const totalKgBruto = corralesVenta.reduce((s, c) => s + (parseFloat(c.kg_vivo) || 0), 0)
                const totalCant = corralesVenta.reduce((s, c) => s + (parseInt(c.cantidad) || 0), 0)
                const desbPct = parseFloat(form.desbaste) || 8
                const totalKgNeto = Math.round(totalKgBruto * (1 - desbPct / 100))
                const totalKgDesc = Math.round(totalKgBruto - totalKgNeto)
                return (
                  <div>
                    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1rem' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>Desbaste</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <Campo label="% Desbaste" hint="8% por defecto · modificable">
                          <input type="number" value={form.desbaste} onChange={e => setForm({ ...form, desbaste: e.target.value })} step="0.5" min="0" max="20" style={inputStyle} />
                        </Campo>
                        <Campo label="Kg brutos totales">
                          <input type="text" value={totalKgBruto > 0 ? totalKgBruto.toLocaleString('es-AR') + ' kg' : ''} readOnly style={inputReadonly} />
                        </Campo>
                        <Campo label="Kg netos totales">
                          <input type="text" value={totalKgNeto > 0 ? totalKgNeto.toLocaleString('es-AR') + ' kg' : ''} readOnly style={inputReadonly} />
                        </Campo>
                      </div>
                      {totalKgBruto > 0 && (
                        <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem 1.25rem' }}>
                          {[
                            ['Kg brutos báscula', totalKgBruto.toLocaleString('es-AR') + ' kg'],
                            ['Desbaste', `−${totalKgDesc.toLocaleString('es-AR')} kg (${desbPct}%)`],
                            ['Kg netos a facturar', totalKgNeto.toLocaleString('es-AR') + ' kg'],
                            ['Animales totales', totalCant],
                            ['Prom. neto por animal', totalCant > 0 ? Math.round(totalKgNeto / totalCant) + ' kg/animal' : '—'],
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
                      <button onClick={() => setPaso(3)}
                        style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                        Continuar →
                      </button>
                    </div>
                  </div>
                )
              })()}

              {/* PASO 3 */}
              {paso === 3 && (() => {
                const kgNetoP3 = Math.round(corralesVenta.reduce((s, c) => s + (parseFloat(c.kg_vivo) || 0), 0) * (1 - (parseFloat(form.desbaste) || 8) / 100))
                const montoTotal = parseFloat(form.precio_kg || 0) * kgNetoP3
                const montoFacturado = form.monto_facturado ? parseFloat(form.monto_facturado) : montoTotal
                const montoNegro = montoTotal > 0 ? Math.max(0, montoTotal - montoFacturado) : 0
                const ivaMonto = montoFacturado * ((parseFloat(form.iva_pct || 10.5)) / 100)
                return (
                  <div>
                    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1rem' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>Precio y condiciones comerciales</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <Campo label="Comprador">
                          <select value={form.comprador} onChange={e => setForm({ ...form, comprador: e.target.value, comprador_otro: '' })} style={inputStyle}>
                            <option value="">— Seleccioná —</option>
                            {compradores.map(o => <option key={o} value={o}>{o}</option>)}
                            <option value="Otro">+ Nuevo...</option>
                          </select>
                        </Campo>
                        {form.comprador === 'Otro' && (
                          <Campo label="Nombre del comprador">
                            <input type="text" value={form.comprador_otro || ''} onChange={e => setForm({ ...form, comprador_otro: e.target.value })} style={inputStyle} />
                          </Campo>
                        )}
                        <Campo label="Precio $/kg neto">
                          <input type="number" value={form.precio_kg} onChange={e => setForm({ ...form, precio_kg: e.target.value })} placeholder="ej. 3100" style={inputStyle} />
                        </Campo>
                        <Campo label="Plazo (días)">
                          <input type="number" value={form.plazo_dias || ''} onChange={e => setForm({ ...form, plazo_dias: e.target.value })} placeholder="0 = contado" style={inputStyle} />
                        </Campo>
                      </div>

                      {parseFloat(form.precio_kg) > 0 && kgNetoP3 > 0 && (
                        <>
                          <div style={{ height: 1, background: S.border, margin: '1rem 0' }} />
                          <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: '1rem' }}>Distribución de la operación</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                            <Campo label="Monto total de la operación $">
                              <input type="text" value={kgNetoP3 > 0 && parseFloat(form.precio_kg) > 0 ? `$${Math.round(montoTotal).toLocaleString('es-AR')}` : '—'} readOnly style={{ ...inputStyle, background: S.bg, fontWeight: 600, fontFamily: 'monospace' }} />
                            </Campo>
                            <Campo label="Monto facturado $" hint="Dejá vacío para facturar el total">
                              <input type="number" value={form.monto_facturado || ''} onChange={e => setForm({ ...form, monto_facturado: e.target.value })} placeholder={Math.round(montoTotal).toString()} style={inputStyle} />
                            </Campo>
                            <Campo label="% IVA">
                              <select value={form.iva_pct || '10.5'} onChange={e => setForm({ ...form, iva_pct: e.target.value })} style={inputStyle}>
                                <option value="0">Sin IVA</option>
                                <option value="10.5">10.5%</option>
                                <option value="21">21%</option>
                              </select>
                            </Campo>
                            <Campo label="IVA $ (calculado)">
                              <input type="text" value={montoFacturado > 0 ? `$${Math.round(ivaMonto).toLocaleString('es-AR')}` : '—'} readOnly style={{ ...inputStyle, background: S.bg, fontFamily: 'monospace' }} />
                            </Campo>
                          </div>

                          {/* Resumen facturado vs negro */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div style={{ background: S.greenLight, border: '1px solid #97C459', borderRadius: 8, padding: '1rem' }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: S.green, textTransform: 'uppercase', marginBottom: 6 }}>Parte facturada</div>
                              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: S.green }}>${Math.round(montoFacturado).toLocaleString('es-AR')}</div>
                              {parseFloat(form.iva_pct) > 0 && <div style={{ fontSize: 12, color: S.green, marginTop: 3 }}>+ IVA ${Math.round(ivaMonto).toLocaleString('es-AR')}</div>}
                            </div>
                            <div style={{ background: montoNegro > 0 ? '#F0EAFB' : S.bg, border: `1px solid ${montoNegro > 0 ? '#9F8ED4' : S.border}`, borderRadius: 8, padding: '1rem' }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: montoNegro > 0 ? '#3D1A6B' : S.hint, textTransform: 'uppercase', marginBottom: 6 }}>Parte en negro</div>
                              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: montoNegro > 0 ? '#3D1A6B' : S.hint }}>${Math.round(montoNegro).toLocaleString('es-AR')}</div>
                              {montoNegro === 0 && <div style={{ fontSize: 12, color: S.hint, marginTop: 3 }}>Operación 100% facturada</div>}
                            </div>
                          </div>
                        </>
                      )}

                      <div style={{ marginTop: '1rem' }}>
                        <Campo label="Observaciones">
                          <input type="text" value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} placeholder="condición de animales, acuerdos, etc." style={inputStyle} />
                        </Campo>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button onClick={() => setPaso(2)} style={{ padding: '8px 16px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>← Atrás</button>
                      <button onClick={() => setPaso(4)} style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                        Ver resumen →
                      </button>
                    </div>
                  </div>
                )
              })()}

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

      {/* GESTIÓN COMERCIAL */}
      {tab === 'gestion' && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Gestión comercial</div>
          <div style={{ fontSize: 12, color: S.muted, marginBottom: '1.25rem' }}>Seguimiento de cobros, facturas, retenciones y cheques</div>
          {ventas.filter(v => v.fecha_vencimiento_cobro && v.estado_comercial !== 'cobrado' && new Date(v.fecha_vencimiento_cobro) <= new Date(Date.now() + 7 * 86400000)).length > 0 && (
            <div style={{ background: S.redLight, border: '1px solid #F09595', borderRadius: 8, padding: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: S.red, marginBottom: 6 }}>Vencimientos proximos - 7 dias</div>
              {ventas.filter(v => v.fecha_vencimiento_cobro && v.estado_comercial !== 'cobrado' && new Date(v.fecha_vencimiento_cobro) <= new Date(Date.now() + 7 * 86400000)).map(v => (
                <div key={v.id} style={{ fontSize: 12, color: S.red, marginBottom: 2 }}>C-{v.corrales?.numero} - {v.comprador || 'Sin comprador'} - vence {new Date(v.fecha_vencimiento_cobro + 'T12:00:00').toLocaleDateString('es-AR')}</div>
              ))}
            </div>
          )}
          <div style={{ border: '1px solid #E2DDD6', borderRadius: 8, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 900 }}>
              <thead><tr style={{ background: '#F7F5F0' }}>
                {['Fecha','Corral','Comprador','Total','Facturado','Negro','IVA','Vence','Estado','Factura','Retencion','Cobro'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#6B6760', fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid #E2DDD6', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {ventas.length === 0 && <tr><td colSpan={12} style={{ padding: '2rem', textAlign: 'center', color: '#9E9A94' }}>No hay ventas.</td></tr>}
                {ventas.map(v => {
                  const ec = { pendiente: { bg: '#FDF0E0', color: '#7A4500' }, precio_cargado: { bg: '#E8EFF8', color: '#1A3D6B' }, facturado: { bg: '#F0EAFB', color: '#3D1A6B' }, cobrado: { bg: '#E8F4EB', color: '#1E5C2E' } }[v.estado_comercial] || { bg: '#F7F5F0', color: '#6B6760' }
                  const venceProx = v.fecha_vencimiento_cobro && v.estado_comercial !== 'cobrado' && new Date(v.fecha_vencimiento_cobro) <= new Date(Date.now() + 7 * 86400000)
                  return (
                    <tr key={v.id} style={{ borderBottom: '1px solid #E2DDD6', background: venceProx ? '#FFF5F5' : 'transparent' }}>
                      <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 11 }}>{new Date(v.creado_en).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                      <td style={{ padding: '7px 10px', fontWeight: 600 }}>C-{v.corrales?.numero}</td>
                      <td style={{ padding: '7px 10px' }}>{v.comprador || '—'}</td>
                      <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontWeight: 600, color: '#1E5C2E' }}>{v.total ? '$' + (v.total/1000000).toFixed(2) + 'M' : '—'}</td>
                      <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: '#1E5C2E' }}>{v.monto_facturado ? '$' + (v.monto_facturado/1000000).toFixed(2) + 'M' : '—'}</td>
                      <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: '#3D1A6B' }}>{v.monto_negro > 0 ? '$' + (v.monto_negro/1000000).toFixed(2) + 'M' : '—'}</td>
                      <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 11 }}>{v.iva_monto ? '$' + v.iva_monto.toLocaleString('es-AR') : '—'}</td>
                      <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 11, fontWeight: venceProx ? 700 : 400, color: venceProx ? '#7A1A1A' : '#1A1916' }}>
                        {v.fecha_vencimiento_cobro ? new Date(v.fecha_vencimiento_cobro + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '—'}
                      </td>
                      <td style={{ padding: '7px 10px' }}>
                        <select value={v.estado_comercial || 'pendiente'} onChange={async e => {
                          const nuevoEstado = e.target.value
                          await supabase.from('ventas').update({ estado_comercial: nuevoEstado }).eq('id', v.id)
                          if (v.grupo_venta_id) await supabase.from('ventas').update({ estado_comercial: nuevoEstado }).eq('grupo_venta_id', v.grupo_venta_id)
                          // Si vuelve a pendiente, limpiar forma_cobro
                          if (nuevoEstado === 'pendiente') await supabase.from('ventas').update({ forma_cobro: null, fecha_cobro: null }).eq('id', v.id)
                          await cargar()
                        }} style={{ padding: '3px 6px', fontSize: 11, fontWeight: 600, border: '1px solid ' + ec.color, borderRadius: 5, background: ec.bg, color: ec.color, cursor: 'pointer' }}>
                          <option value="pendiente">Pendiente</option>
                          <option value="precio_cargado">Precio cargado</option>
                          <option value="facturado">Facturado</option>
                          <option value="cobrado">Cobrado</option>
                        </select>
                      </td>
                      <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                        <input type="checkbox" checked={v.factura_enviada || false} title="Factura enviada" onChange={async e => { await supabase.from('ventas').update({ factura_enviada: e.target.checked }).eq('id', v.id); await cargar() }} />
                      </td>
                      <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                        <input type="checkbox" checked={v.retencion_enviada || false} title="Retencion enviada" onChange={async e => { await supabase.from('ventas').update({ retencion_enviada: e.target.checked }).eq('id', v.id); await cargar() }} />
                      </td>
                      <td style={{ padding: '7px 10px', minWidth: 200 }}>
                        {(() => {
                          const pagosList = pagosVenta[v.id] || []
                          const totalPagado = pagosList.reduce((s, p) => s + (p.monto || 0), 0)
                          const totalVenta = (v.monto_facturado || 0) + (v.monto_negro || 0) || v.total || 0
                          const saldo = totalVenta - totalPagado
                          const isReg = registrandoPago === v.id
                          return (
                            <div>
                              {pagosList.map(p => (
                                <div key={p.id} style={{ fontSize: 10, color: '#1E5C2E', marginBottom: 2, display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                                  <span>${p.monto.toLocaleString('es-AR')} · {p.forma_pago}{p.numero_cheque ? ` #${p.numero_cheque}` : ''}</span>
                                  <button onClick={async () => { await supabase.from('pagos_ventas').delete().eq('id', p.id); await cargar() }}
                                    style={{ background: 'none', border: 'none', color: '#7A1A1A', cursor: 'pointer', fontSize: 10 }}>✕</button>
                                </div>
                              ))}
                              {totalPagado > 0 && (
                                <div style={{ fontSize: 10, fontWeight: 700, color: saldo <= 0 ? '#1E5C2E' : '#7A4500', marginBottom: 4 }}>
                                  {saldo <= 0 ? '✓ Cobrado completo' : `Saldo: $${saldo.toLocaleString('es-AR')}`}
                                </div>
                              )}
                              {!isReg ? (
                                <button onClick={() => { setRegistrandoPago(v.id); setFormPago({ monto: saldo > 0 ? String(Math.round(saldo)) : '', forma_pago: 'transferencia', fecha: new Date().toISOString().split('T')[0], numero_cheque: '', banco: '', fecha_vencimiento_cheque: '', observaciones: '' }) }}
                                  style={{ fontSize: 10, padding: '3px 8px', background: '#E8EFF8', border: '1px solid #1A3D6B', color: '#1A3D6B', borderRadius: 4, cursor: 'pointer', width: '100%' }}>
                                  + Registrar pago
                                </button>
                              ) : (
                                <div style={{ background: '#F7F5F0', border: '1px solid #E2DDD6', borderRadius: 6, padding: '8px', marginTop: 4 }}>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
                                    <div>
                                      <div style={{ fontSize: 9, color: '#6B6760', textTransform: 'uppercase', marginBottom: 2 }}>Monto $</div>
                                      <input type="number" value={formPago.monto} onChange={e => setFormPago({...formPago, monto: e.target.value})}
                                        style={{ width: '100%', border: '1px solid #E2DDD6', borderRadius: 4, padding: '4px 6px', fontSize: 12, fontFamily: 'monospace', boxSizing: 'border-box' }} />
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 9, color: '#6B6760', textTransform: 'uppercase', marginBottom: 2 }}>Forma</div>
                                      <select value={formPago.forma_pago} onChange={e => setFormPago({...formPago, forma_pago: e.target.value})}
                                        style={{ width: '100%', border: '1px solid #E2DDD6', borderRadius: 4, padding: '4px 6px', fontSize: 11 }}>
                                        <option value="transferencia">Transferencia</option>
                                        <option value="cheque">Cheque</option>
                                        <option value="e-cheq">E-Cheq</option>
                                        <option value="efectivo">Efectivo</option>
                                      </select>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 9, color: '#6B6760', textTransform: 'uppercase', marginBottom: 2 }}>Fecha</div>
                                      <input type="date" value={formPago.fecha} onChange={e => setFormPago({...formPago, fecha: e.target.value})}
                                        style={{ width: '100%', border: '1px solid #E2DDD6', borderRadius: 4, padding: '4px 6px', fontSize: 11, boxSizing: 'border-box' }} />
                                    </div>
                                    {['cheque','e-cheq'].includes(formPago.forma_pago) && (
                                      <>
                                        <div>
                                          <div style={{ fontSize: 9, color: '#6B6760', textTransform: 'uppercase', marginBottom: 2 }}>N° cheque</div>
                                          <input type="text" value={formPago.numero_cheque} onChange={e => setFormPago({...formPago, numero_cheque: e.target.value})}
                                            style={{ width: '100%', border: '1px solid #E2DDD6', borderRadius: 4, padding: '4px 6px', fontSize: 11, boxSizing: 'border-box' }} />
                                        </div>
                                        <div>
                                          <div style={{ fontSize: 9, color: '#6B6760', textTransform: 'uppercase', marginBottom: 2 }}>Banco</div>
                                          <input type="text" value={formPago.banco} onChange={e => setFormPago({...formPago, banco: e.target.value})}
                                            style={{ width: '100%', border: '1px solid #E2DDD6', borderRadius: 4, padding: '4px 6px', fontSize: 11, boxSizing: 'border-box' }} />
                                        </div>
                                        <div style={{ gridColumn: '1/-1' }}>
                                          <div style={{ fontSize: 9, color: '#6B6760', textTransform: 'uppercase', marginBottom: 2 }}>Vencimiento cheque</div>
                                          <input type="date" value={formPago.fecha_vencimiento_cheque} onChange={e => setFormPago({...formPago, fecha_vencimiento_cheque: e.target.value})}
                                            style={{ width: '100%', border: '1px solid #E2DDD6', borderRadius: 4, padding: '4px 6px', fontSize: 11, boxSizing: 'border-box' }} />
                                        </div>
                                      </>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', gap: 4 }}>
                                    <button onClick={async () => {
                                      if (!formPago.monto) return
                                      const monto = parseFloat(formPago.monto)
                                      await supabase.from('pagos_ventas').insert({
                                        venta_id: v.id, grupo_venta_id: v.grupo_venta_id || null,
                                        fecha: formPago.fecha, monto,
                                        forma_pago: formPago.forma_pago,
                                        numero_cheque: formPago.numero_cheque || null,
                                        banco: formPago.banco || null,
                                        fecha_vencimiento_cheque: formPago.fecha_vencimiento_cheque || null,
                                      })
                                      // Registrar en caja
                                      const esNegro = v.monto_negro > 0 && formPago.forma_pago === 'efectivo'
                                      if (esNegro) {
                                        await supabase.from('caja_paralela').insert({ fecha: formPago.fecha, tipo: 'ingreso', descripcion: 'Venta hacienda C-' + v.corrales?.numero + ' ' + (v.comprador || ''), monto })
                                      } else {
                                        await supabase.from('caja_oficial').insert({ fecha: formPago.fecha, tipo: 'ingreso', categoria: 'Cobro venta hacienda', descripcion: 'Venta C-' + v.corrales?.numero + ' ' + (v.comprador || ''), monto, forma_pago: formPago.forma_pago })
                                      }
                                      // Si es cheque, registrar en tabla cheques
                                      if (['cheque','e-cheq'].includes(formPago.forma_pago) && formPago.fecha_vencimiento_cheque) {
                                        await supabase.from('cheques').insert({ tipo: 'recibido', numero: formPago.numero_cheque || null, banco: formPago.banco || null, monto, fecha_emision: formPago.fecha, fecha_vencimiento: formPago.fecha_vencimiento_cheque, librador: v.comprador || null, estado: 'en_cartera' })
                                      }
                                      // Actualizar estado si está completo
                                      const { data: todosPageos } = await supabase.from('pagos_ventas').select('monto').eq('venta_id', v.id)
                                      const totalPag = (todosPageos || []).reduce((s, p) => s + (p.monto || 0), 0) + monto
                                      const totalVentaLocal = (v.monto_facturado || 0) + (v.monto_negro || 0) || v.total || 0
                                      if (totalPag >= totalVentaLocal * 0.99) {
                                        await supabase.from('ventas').update({ estado_comercial: 'cobrado', forma_cobro: formPago.forma_pago }).eq('id', v.id)
                                      }
                                      setRegistrandoPago(null)
                                      await cargar()
                                    }} style={{ flex: 1, padding: '4px', fontSize: 11, fontWeight: 600, background: '#1E5C2E', border: '1px solid #1E5C2E', color: '#fff', borderRadius: 4, cursor: 'pointer' }}>
                                      Guardar
                                    </button>
                                    <button onClick={() => setRegistrandoPago(null)}
                                      style={{ padding: '4px 8px', fontSize: 11, background: 'transparent', border: '1px solid #E2DDD6', color: '#6B6760', borderRadius: 4, cursor: 'pointer' }}>
                                      ✕
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CUENTAS POR COMPRADOR ── */}
      {tab === 'cuentas' && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Cuentas por comprador</div>
          <div style={{ fontSize: 12, color: S.muted, marginBottom: '1.25rem' }}>Resumen de operaciones y saldos por contacto</div>

          {(() => {
            // Agrupar ventas por comprador
            const porComprador = {}
            ventas.forEach(v => {
              const comp = v.comprador || 'Sin comprador'
              if (!porComprador[comp]) porComprador[comp] = { ventas: [], totalVendido: 0, totalFacturado: 0, totalNegro: 0, totalPagado: 0, totalKgNeto: 0 }
              porComprador[comp].ventas.push(v)
              porComprador[comp].totalVendido += v.total || 0
              porComprador[comp].totalFacturado += v.monto_facturado || 0
              porComprador[comp].totalNegro += v.monto_negro || 0
              porComprador[comp].totalKgNeto += v.kg_neto || 0
              // Pagos registrados
              const pagosCv = pagosVenta[v.id] || []
              porComprador[comp].totalPagado += pagosCv.reduce((s, p) => s + (p.monto || 0), 0)
            })

            return Object.entries(porComprador).sort((a, b) => b[1].totalVendido - a[1].totalVendido).map(([comp, data]) => {
              const saldo = data.totalVendido - data.totalPagado
              const pctCobrado = data.totalVendido > 0 ? Math.round(data.totalPagado / data.totalVendido * 100) : 0
              return (
                <div key={comp} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, marginBottom: '1rem', overflow: 'hidden' }}>
                  {/* Header comprador */}
                  <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{comp}</div>
                      <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>{data.ventas.length} operaciones · {data.totalKgNeto.toLocaleString('es-AR')} kg netos</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: S.muted, marginBottom: 2 }}>Saldo pendiente</div>
                      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: saldo > 0 ? S.red : S.green }}>
                        {saldo > 0 ? `-$${saldo.toLocaleString('es-AR')}` : '✓ Al día'}
                      </div>
                    </div>
                  </div>

                  {/* Métricas */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderBottom: `1px solid ${S.border}` }}>
                    {[
                      { label: 'Total operado', val: `$${(data.totalVendido/1000000).toFixed(2)}M`, color: S.text },
                      { label: 'Facturado', val: `$${(data.totalFacturado/1000000).toFixed(2)}M`, color: S.accent },
                      { label: 'En negro', val: data.totalNegro > 0 ? `$${(data.totalNegro/1000000).toFixed(2)}M` : '—', color: '#3D1A6B' },
                      { label: 'Cobrado', val: `$${(data.totalPagado/1000000).toFixed(2)}M · ${pctCobrado}%`, color: pctCobrado >= 100 ? S.green : S.amber },
                    ].map((m, i) => (
                      <div key={i} style={{ padding: '.85rem 1rem', borderRight: i < 3 ? `1px solid ${S.border}` : 'none' }}>
                        <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>{m.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace', color: m.color }}>{m.val}</div>
                      </div>
                    ))}
                  </div>

                  {/* Barra de progreso cobro */}
                  <div style={{ padding: '8px 1.25rem', borderBottom: `1px solid ${S.border}` }}>
                    <div style={{ height: 6, background: S.bg, borderRadius: 3, overflow: 'hidden', border: `1px solid ${S.border}` }}>
                      <div style={{ width: `${Math.min(pctCobrado, 100)}%`, height: '100%', background: pctCobrado >= 100 ? S.green : S.amber, borderRadius: 3 }} />
                    </div>
                  </div>

                  {/* Detalle de ventas */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead><tr style={{ background: S.bg }}>
                      {['Fecha','Corral','Kg neto','Total','Facturado','Negro','Estado','Cobrado'].map(h => (
                        <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 10, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {data.ventas.map(v => {
                        const pagosCv = pagosVenta[v.id] || []
                        const pagadoCv = pagosCv.reduce((s, p) => s + (p.monto || 0), 0)
                        const ec = { pendiente: { bg: S.amberLight, color: S.amber }, precio_cargado: { bg: S.accentLight, color: S.accent }, facturado: { bg: '#F0EAFB', color: '#3D1A6B' }, cobrado: { bg: S.greenLight, color: S.green } }[v.estado_comercial] || { bg: S.bg, color: S.muted }
                        return (
                          <tr key={v.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                            <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontSize: 11 }}>{new Date(v.creado_en).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                            <td style={{ padding: '7px 12px', fontWeight: 600 }}>C-{v.corrales?.numero}</td>
                            <td style={{ padding: '7px 12px', fontFamily: 'monospace' }}>{v.kg_neto?.toLocaleString('es-AR')} kg</td>
                            <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{v.total ? `$${(v.total/1000000).toFixed(2)}M` : '—'}</td>
                            <td style={{ padding: '7px 12px', fontFamily: 'monospace', color: S.accent }}>{v.monto_facturado ? `$${(v.monto_facturado/1000000).toFixed(2)}M` : '—'}</td>
                            <td style={{ padding: '7px 12px', fontFamily: 'monospace', color: '#3D1A6B' }}>{v.monto_negro > 0 ? `$${(v.monto_negro/1000000).toFixed(2)}M` : '—'}</td>
                            <td style={{ padding: '7px 12px' }}>
                              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: ec.bg, color: ec.color }}>{v.estado_comercial || 'pendiente'}</span>
                            </td>
                            <td style={{ padding: '7px 12px', fontFamily: 'monospace', color: pagadoCv > 0 ? S.green : S.hint }}>
                              {pagadoCv > 0 ? `$${pagadoCv.toLocaleString('es-AR')}` : '—'}
                              {pagosCv.length > 0 && <span style={{ fontSize: 10, color: S.muted, marginLeft: 4 }}>({pagosCv.map(p => p.forma_pago).join(', ')})</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })
          })()}
        </div>
      )}
    </div>
  )
}