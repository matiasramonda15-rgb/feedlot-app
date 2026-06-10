import React from 'react'
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
  const [todasVentasSinPrecio, setTodasVentasSinPrecio] = useState([])
  const [editandoVenta, setEditandoVenta] = useState(null)
  const [pagosVenta, setPagosVenta] = useState({})
  const [registrandoPago, setRegistrandoPago] = useState(null)
  const [filtroCuentas, setFiltroCuentas] = useState('')
  const [showDetalleMeses, setShowDetalleMeses] = useState(false)
  const [showDetalleKg, setShowDetalleKg] = useState(false)
  const [showDetallePrecio, setShowDetallePrecio] = useState(false)
  const [editandoComercial, setEditandoComercial] = useState(null)
  const [formComercial, setFormComercial] = useState({})
  const [formPagoVto, setFormPagoVto] = useState('')
  const [formPago, setFormPago] = useState({ monto: '', forma_pago: 'transferencia', fecha: new Date().toISOString().split('T')[0], numero_cheque: '', banco: '', fecha_cobro_cheque: '', fecha_vencimiento_cheque: '', es_paralela: false, observaciones: '' })
  const [chequesParalelos, setChequesParalelos] = useState([])
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

  useEffect(() => { cargar(); cargarChequesParalelos() }, [])

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
    const todasSinPrecio = (v || []).filter(x => !x.precio_kg && !x.monto_total_con_iva && !x.total)
    const gruposVistos = new Set()
    const sinPrecioDedup = todasSinPrecio.filter(x => {
      if (x.grupo_venta_id) {
        if (gruposVistos.has(x.grupo_venta_id)) return false
        gruposVistos.add(x.grupo_venta_id)
      }
      return true
    })
    setVentasSinPrecio(sinPrecioDedup)
    setTodasVentasSinPrecio(todasSinPrecio)
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
  const totalKgVendidos = ventas.reduce((s, v) => s + (v.kg_vivo_total || 0), 0)
  const kgPromAnimal = totalAnimVendidos > 0 && totalKgVendidos > 0 ? Math.round(totalKgVendidos / totalAnimVendidos) : null
  const precioPromedio = ventas.filter(v => v.precio_kg).length > 0
    ? Math.round(ventas.filter(v => v.precio_kg).reduce((s, v) => s + v.precio_kg, 0) / ventas.filter(v => v.precio_kg).length)
    : null

  // Detalle por mes
  const ventasPorMes = {}
  ventas.forEach(v => {
    const fecha = new Date(v.creado_en)
    const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
    if (!ventasPorMes[key]) ventasPorMes[key] = { total: 0, cantidad: 0, ops: 0 }
    ventasPorMes[key].total += v.total || 0
    ventasPorMes[key].cantidad += v.cantidad || 0
    ventasPorMes[key].ops += 1
  })
  const mesesOrdenados = Object.entries(ventasPorMes).sort((a, b) => b[0].localeCompare(a[0]))

  // Detalle kg prom y precio prom por mes
  const kgPreciosPorMes = {}
  ventas.forEach(v => {
    const fecha = new Date(v.creado_en)
    const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
    if (!kgPreciosPorMes[key]) kgPreciosPorMes[key] = { totalKg: 0, cantidad: 0, precioSum: 0, precioCount: 0 }
    kgPreciosPorMes[key].totalKg += v.kg_vivo_total || 0
    kgPreciosPorMes[key].cantidad += v.cantidad || 0
    if (v.precio_kg) { kgPreciosPorMes[key].precioSum += v.precio_kg; kgPreciosPorMes[key].precioCount += 1 }
  })
  const kgPreciosMeses = Object.entries(kgPreciosPorMes).sort((a, b) => b[0].localeCompare(a[0]))

  // Métricas compras (lotes)
  const totalGastado = lotes.reduce((s, l) => s + ((l.kg_bascula || 0) * (l.precio_compra || 0)), 0)
  const totalAnimComprados = lotes.reduce((s, l) => s + (l.cantidad || 0), 0)

  async function guardarDatosVenta(venta) {
    const ep = editandoVenta
    if (!ep?.precio_kg && !ep?.monto_total_con_iva) { alert('Ingresá el precio por kg o el monto total de la operación'); return }
    const precioKg = ep.precio_kg ? parseFloat(ep.precio_kg) : null
    const desbastePct = ep.desbaste ? parseFloat(ep.desbaste) : (venta.desbaste_pct || 8)
    // Para multicorral sumar kg de todos los corrales del grupo
    const kgBrutoTotal = venta.grupo_venta_id
      ? todasVentasSinPrecio.filter(vv => vv.grupo_venta_id === venta.grupo_venta_id).reduce((s, vv) => s + (vv.kg_vivo_total || 0), 0)
      : (venta.kg_vivo_total || 0)
    const kgNeto = Math.round(kgBrutoTotal * (1 - desbastePct / 100))
    const montoTotal = ep.monto_total_con_iva ? Math.round(parseFloat(ep.monto_total_con_iva)) : (precioKg ? Math.round(kgNeto * precioKg) : null)
    const plazo = parseInt(ep.plazo_dias || 0)
    const fechaBase = new Date(venta.creado_en)
    const fechaVto = plazo > 0 ? new Date(fechaBase.getTime() + plazo * 86400000).toISOString().split('T')[0] : null
    const compradorFinal = ep.comprador === 'Otro' ? (ep.compradorNuevo || null) : (ep.comprador || venta.comprador || null)

    // Si es comprador nuevo, guardarlo como contacto
    if (compradorFinal && !compradores.includes(compradorFinal)) {
      await supabase.from('contactos').insert({ nombre: compradorFinal, tipo: 'comprador_hacienda', activo: true })
    }

    const updateData = {
      precio_kg: precioKg,
      desbaste_pct: desbastePct,
      kg_neto: kgNeto,
      total: montoTotal,
      monto_total_con_iva: montoTotal,
      plazo_dias: plazo || null,
      fecha_vencimiento_cobro: fechaVto,
      estado_comercial: 'pendiente_factura',
      comprador: compradorFinal,
      observaciones: ep.observaciones || venta.observaciones || null,
    }

    const grupoId = venta.grupo_venta_id
    if (grupoId) {
      // Para multicorral: guardar el total exacto en todos los registros del grupo
      // sin dividir — todos tienen el mismo total y kg_neto proporcional
      const { data: grupo } = await supabase.from('ventas').select('*').eq('grupo_venta_id', grupoId)
      const totalKgNetoGrupo = (grupo || []).reduce((s, v) => s + (v.kg_vivo_total ? Math.round(v.kg_vivo_total * (1 - desbastePct / 100)) : (v.kg_neto || 0)), 0)
      for (const gv of (grupo || [])) {
        const kgNetoV = gv.kg_vivo_total ? Math.round(gv.kg_vivo_total * (1 - desbastePct / 100)) : (gv.kg_neto || 0)
        // Asignar monto proporcional pero guardar también el total exacto en cada registro
        const montoV = montoTotal && totalKgNetoGrupo > 0 ? Math.round(montoTotal * kgNetoV / totalKgNetoGrupo) : (precioKg ? Math.round(kgNetoV * precioKg) : null)
        await supabase.from('ventas').update({
          ...updateData,
          kg_neto: kgNetoV,
          total: montoV,
          monto_total_grupo: montoTotal, // total exacto del grupo
        }).eq('id', gv.id)
      }
    } else {
      await supabase.from('ventas').update(updateData).eq('id', venta.id)
    }
    setEditandoVenta(null)
    await cargar()
  }

  async function cargarChequesParalelos() {
    const { data } = await supabase.from('cheques').select('*').eq('tipo', 'recibido').eq('estado', 'en_cartera').order('fecha_vencimiento')
    setChequesParalelos(data || [])
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1rem' }}>
            {/* Vendido este año con detalle por mes */}
            <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '.9rem 1rem' }}>
              <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Vendido este año</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', lineHeight: 1, color: S.green }}>{totalVentasAnio > 0 ? `$${totalVentasAnio.toLocaleString('es-AR')}` : '$0'}</div>
              <div style={{ fontSize: 11, color: S.hint, marginTop: 3, marginBottom: 6 }}>{ventas.length} operaciones · {totalAnimVendidos} animales</div>
              <button onClick={() => setShowDetalleMeses(!showDetalleMeses)}
                style={{ fontSize: 11, color: S.accent, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                {showDetalleMeses ? '▴ Ocultar detalle' : '▾ Ver por mes'}
              </button>
            </div>
            {[
              { label: 'Listos para vender', val: corralesListos.reduce((s, c) => s + (c.animales || 0), 0), sub: corralesListos.length > 0 ? `animales ≥ 400 kg · ${corralesListos.map(c => `C-${c.numero}`).join(', ')}` : 'ningún corral llegó a 400 kg', ok: corralesListos.length > 0 },
            ].map((m, i) => (
              <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '.9rem 1rem' }}>
                <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>{m.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', lineHeight: 1, color: m.ok ? S.green : S.text }}>{m.val}</div>
                <div style={{ fontSize: 11, color: S.hint, marginTop: 3 }}>{m.sub}</div>
              </div>
            ))}
            {/* Kg prom por animal — expandible */}
            <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '.9rem 1rem' }}>
              <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Kg prom. por animal</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', lineHeight: 1, color: S.text }}>{kgPromAnimal ? `${kgPromAnimal.toLocaleString('es-AR')} kg` : '—'}</div>
              <div style={{ fontSize: 11, color: S.hint, marginTop: 3, marginBottom: 6 }}>{totalKgVendidos > 0 ? `${(totalKgVendidos/1000).toFixed(1)} tn totales vendidas` : ''}</div>
              <button onClick={() => setShowDetalleKg(!showDetalleKg)}
                style={{ fontSize: 11, color: S.accent, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                {showDetalleKg ? '▴ Ocultar detalle' : '▾ Ver por mes'}
              </button>
            </div>
            {/* Precio prom — expandible */}
            <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '.9rem 1rem' }}>
              <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Precio prom. obtenido</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', lineHeight: 1, color: S.text }}>{precioPromedio ? `$${precioPromedio.toLocaleString('es-AR')}` : '—'}</div>
              <div style={{ fontSize: 11, color: S.hint, marginTop: 3, marginBottom: 6 }}>$/kg vivo neto (con desbaste)</div>
              <button onClick={() => setShowDetallePrecio(!showDetallePrecio)}
                style={{ fontSize: 11, color: S.accent, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                {showDetallePrecio ? '▴ Ocultar detalle' : '▾ Ver por mes'}
              </button>
            </div>
          </div>

          {/* Detalle por mes */}
          {showDetalleMeses && mesesOrdenados.length > 0 && (
            <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, marginBottom: '1.5rem', overflow: 'hidden' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', padding: '10px 14px', borderBottom: `1px solid ${S.border}` }}>Detalle de ventas por mes</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: S.bg }}>
                  {['Mes', 'Operaciones', 'Animales', 'Total'].map(h => (
                    <th key={h} style={{ padding: '8px 14px', textAlign: h === 'Total' ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {mesesOrdenados.map(([key, data]) => {
                    const [anio, mes] = key.split('-')
                    const nombreMes = new Date(parseInt(anio), parseInt(mes) - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
                    return (
                      <tr key={key} style={{ borderBottom: `1px solid ${S.border}` }}>
                        <td style={{ padding: '9px 14px', fontWeight: 600, textTransform: 'capitalize' }}>{nombreMes}</td>
                        <td style={{ padding: '9px 14px', color: S.muted }}>{data.ops} venta{data.ops !== 1 ? 's' : ''}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace' }}>{data.cantidad.toLocaleString('es-AR')}</td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: S.green }}>${data.total.toLocaleString('es-AR')}</td>
                      </tr>
                    )
                  })}
                  <tr style={{ background: S.bg, borderTop: `2px solid ${S.border}` }}>
                    <td style={{ padding: '9px 14px', fontWeight: 700 }}>Total</td>
                    <td style={{ padding: '9px 14px', color: S.muted }}>{ventas.length} ventas</td>
                    <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontWeight: 700 }}>{totalAnimVendidos.toLocaleString('es-AR')}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: S.green }}>${totalVentasAnio.toLocaleString('es-AR')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

                    {/* Detalle kg por mes */}
          {showDetalleKg && kgPreciosMeses.length > 0 && (
            <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, marginBottom: '1.5rem', overflow: 'hidden' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', padding: '10px 14px', borderBottom: `1px solid ${S.border}` }}>Kg promedio por animal — por mes</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: S.bg }}>
                  {['Mes', 'Animales', 'Kg totales', 'Kg prom./animal'].map(h => (
                    <th key={h} style={{ padding: '8px 14px', textAlign: h === 'Kg prom./animal' ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {kgPreciosMeses.map(([key, data]) => {
                    const [anio, mes] = key.split('-')
                    const nombreMes = new Date(parseInt(anio), parseInt(mes) - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
                    const kgProm = data.cantidad > 0 ? Math.round(data.totalKg / data.cantidad) : null
                    return (
                      <tr key={key} style={{ borderBottom: `1px solid ${S.border}` }}>
                        <td style={{ padding: '9px 14px', fontWeight: 600, textTransform: 'capitalize' }}>{nombreMes}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace' }}>{data.cantidad.toLocaleString('es-AR')}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: S.muted }}>{(data.totalKg/1000).toFixed(1)} tn</td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{kgProm ? `${kgProm.toLocaleString('es-AR')} kg` : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Detalle precio por mes */}
          {showDetallePrecio && kgPreciosMeses.length > 0 && (
            <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, marginBottom: '1.5rem', overflow: 'hidden' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', padding: '10px 14px', borderBottom: `1px solid ${S.border}` }}>Precio promedio obtenido — por mes</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: S.bg }}>
                  {['Mes', 'Operaciones con precio', 'Precio prom. $/kg'].map(h => (
                    <th key={h} style={{ padding: '8px 14px', textAlign: h === 'Precio prom. $/kg' ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {kgPreciosMeses.map(([key, data]) => {
                    const [anio, mes] = key.split('-')
                    const nombreMes = new Date(parseInt(anio), parseInt(mes) - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
                    const precioProm = data.precioCount > 0 ? Math.round(data.precioSum / data.precioCount) : null
                    return (
                      <tr key={key} style={{ borderBottom: `1px solid ${S.border}` }}>
                        <td style={{ padding: '9px 14px', fontWeight: 600, textTransform: 'capitalize' }}>{nombreMes}</td>
                        <td style={{ padding: '9px 14px', color: S.muted }}>{data.precioCount} venta{data.precioCount !== 1 ? 's' : ''}</td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: precioProm ? S.green : S.hint }}>{precioProm ? `$${precioProm.toLocaleString('es-AR')}` : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

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

          {/* Banner edición desde historial */}
          {editandoVenta && !ventasSinPrecio.find(v => v.id === editandoVenta.id) && (
            <div style={{ background: S.accentLight, border: `1px solid ${S.accent}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: S.accent }}>✏ Editando venta</div>
                <button onClick={() => setEditandoVenta(null)} style={{ fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Cancelar</button>
              </div>
              {(() => {
                const v = [...ventasSinPrecio, ...ventas].find(vv => vv.id === editandoVenta.id)
                if (!v) return null
                return (
                  <div>
                    <div style={{ fontSize: 12, color: S.muted, marginBottom: 12 }}>
                      {v.grupo_venta_id ? 'Venta multi-corral' : `C-${v.corrales?.numero || v.corral_id}`} · {v.grupo_venta_id ? todasVentasSinPrecio.filter(vv => vv.grupo_venta_id === v.grupo_venta_id).reduce((s, vv) => s + (vv.cantidad || 0), 0) : v.cantidad} animales · {(() => {
                        if (v.grupo_venta_id) {
                          const grupo = todasVentasSinPrecio.filter(vv => vv.grupo_venta_id === v.grupo_venta_id)
                          const kgBrutoTotal = grupo.reduce((s, vv) => s + (vv.kg_vivo_total || 0), 0)
                          const desb = parseFloat(editandoVenta.desbaste || 8) / 100
                          const kgNetoTotal = Math.round(kgBrutoTotal * (1 - desb))
                          return kgBrutoTotal > 0 ? `${kgBrutoTotal.toLocaleString('es-AR')} kg brutos · ${kgNetoTotal.toLocaleString('es-AR')} kg netos · ` : ''
                        }
                        const desb = parseFloat(editandoVenta.desbaste || 8) / 100
                        const kgN = v.kg_vivo_total ? Math.round(v.kg_vivo_total * (1 - desb)) : (v.kg_neto || 0)
                        return v.kg_vivo_total ? `${v.kg_vivo_total.toLocaleString('es-AR')} kg brutos · ${kgN.toLocaleString('es-AR')} kg netos · ` : ''
                      })()} {new Date((v.fecha || v.creado_en?.split('T')[0] || v.creado_en) + (v.fecha ? 'T12:00:00' : '')).toLocaleDateString('es-AR')} · {v.usuarios?.nombre || ''}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Precio $/kg <span style={{ color: S.accent }}>*</span></label>
                        <input type="number" placeholder="ej. 4800" value={editandoVenta.precio_kg}
                          onChange={e => {
                          const precio = e.target.value
                          // Solo autocompleta monto si NO es multi-corral
                          if (!v.grupo_venta_id) {
                            const kg = v.kg_vivo_total ? Math.round(v.kg_vivo_total * (1 - (parseFloat(editandoVenta.desbaste||8)/100))) : (v.kg_neto || 0)
                            const mt = precio && kg ? Math.round(parseFloat(precio) * kg) : ''
                            setEditandoVenta({ ...editandoVenta, precio_kg: precio, monto_total_con_iva: String(mt) })
                          } else {
                            setEditandoVenta({ ...editandoVenta, precio_kg: precio })
                          }
                        }}
                          style={{ width: '100%', border: `1px solid ${S.accent}`, borderRadius: 6, padding: '8px 10px', fontSize: 14, background: S.surface, boxSizing: 'border-box', fontWeight: 600, fontFamily: 'monospace' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>
                          Monto total operación $ <span style={{ color: S.accent }}>(IVA incluido)</span>
                          {v.grupo_venta_id && <span style={{ color: S.red, marginLeft: 4 }}>ingresá el real</span>}
                        </label>
                        <input type="number" placeholder="Total que paga el frigorífico" value={editandoVenta.monto_total_con_iva || ''}
                          onChange={e => {
                          const mt = e.target.value
                          // Solo autocompleta precio si NO es multi-corral
                          if (!v.grupo_venta_id) {
                            const kg = v.kg_vivo_total ? Math.round(v.kg_vivo_total * (1 - (parseFloat(editandoVenta.desbaste||8)/100))) : (v.kg_neto || 0)
                            const precio = mt && kg ? Math.round(parseFloat(mt) / kg) : ''
                            setEditandoVenta({ ...editandoVenta, monto_total_con_iva: mt, precio_kg: String(precio) })
                          } else {
                            setEditandoVenta({ ...editandoVenta, monto_total_con_iva: mt })
                          }
                        }}
                          style={{ width: '100%', border: `1px solid ${S.accent}`, borderRadius: 6, padding: '8px 10px', fontSize: 14, background: S.surface, boxSizing: 'border-box', fontWeight: 600, fontFamily: 'monospace' }} />
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
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Neto facturado $ <span style={{ color: S.hint }}>(sin IVA)</span></label>
                        <input type="number" value={editandoVenta.monto_facturado || ''}
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
                        <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Plazo (días)</label>
                        <input type="number" placeholder="0 = contado" value={editandoVenta.plazo_dias || ''}
                          onChange={e => setEditandoVenta({ ...editandoVenta, plazo_dias: e.target.value })}
                          style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: 'monospace' }} />
                      </div>
                      {editandoVenta.comprador === 'Otro' && (
                        <div style={{ gridColumn: '1/-1' }}>
                          <input type="text" placeholder="Nombre del nuevo comprador" value={editandoVenta.compradorNuevo || ''}
                            onChange={e => setEditandoVenta({ ...editandoVenta, compradorNuevo: e.target.value })}
                            style={{ width: '100%', border: `1px solid ${S.accent}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.surface, boxSizing: 'border-box' }} />
                        </div>
                      )}
                    </div>
                    {(editandoVenta.precio_kg || editandoVenta.monto_total_con_iva) && (() => {
                      const desbPct = parseFloat(editandoVenta.desbaste) || (v.desbaste_pct || 8)
                      const kgNetoCalc = v.kg_vivo_total ? Math.round(v.kg_vivo_total * (1 - desbPct / 100)) : (v.kg_neto || 0)
                      const montoTotalCalc = editandoVenta.monto_total_con_iva ? Math.round(parseFloat(editandoVenta.monto_total_con_iva)) : (editandoVenta.precio_kg ? Math.round(kgNetoCalc * parseFloat(editandoVenta.precio_kg)) : 0)
                      const montoFactCalc = editandoVenta.monto_facturado !== '' && editandoVenta.monto_facturado !== undefined ? parseFloat(editandoVenta.monto_facturado) : montoTotalCalc
                      const ivaPct2 = parseFloat(editandoVenta.iva_pct || 10.5)
                      const ivaMCalc = Math.round(montoFactCalc * ivaPct2 / 100)
                      const totalFacturaCalc = montoFactCalc + ivaMCalc
                      const montoNegroCalc = Math.max(0, montoTotalCalc - totalFacturaCalc)
                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                          <div style={{ background: S.greenLight, border: '1px solid #97C459', borderRadius: 6, padding: '8px 12px' }}>
                            <div style={{ fontSize: 10, color: S.green, fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Total factura (neto + IVA)</div>
                            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: S.green }}>${totalFacturaCalc.toLocaleString('es-AR')}</div>
                            <div style={{ fontSize: 11, color: S.green, marginTop: 2 }}>Neto: ${montoFactCalc.toLocaleString('es-AR')} + IVA: ${ivaMCalc.toLocaleString('es-AR')}</div>
                          </div>
                          <div style={{ background: montoNegroCalc > 0 ? '#F0EAFB' : S.bg, border: `1px solid ${montoNegroCalc > 0 ? '#9F8ED4' : S.border}`, borderRadius: 6, padding: '8px 12px' }}>
                            <div style={{ fontSize: 10, color: montoNegroCalc > 0 ? '#3D1A6B' : S.hint, fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Cuenta paralela</div>
                            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: montoNegroCalc > 0 ? '#3D1A6B' : S.hint }}>${montoNegroCalc.toLocaleString('es-AR')}</div>
                          </div>
                        </div>
                      )
                    })()}
                    {/* Comisión y retención */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Comisión %</label>
                        <input type="number" value={editandoVenta.comision_pct || ''} onChange={e => {
                          const pct = e.target.value
                          const mt = editandoVenta.monto_total_con_iva ? parseFloat(editandoVenta.monto_total_con_iva) : 0
                          const monto = pct && mt ? Math.round(mt * parseFloat(pct) / 100) : ''
                          setEditandoVenta({...editandoVenta, comision_pct: pct, comision_monto_input: String(monto)})
                        }} placeholder="0"
                          style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: 'monospace' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Comisión $</label>
                        <input type="number" value={editandoVenta.comision_monto_input || ''} onChange={e => {
                          const monto = e.target.value
                          const mt = editandoVenta.monto_total_con_iva ? parseFloat(editandoVenta.monto_total_con_iva) : 0
                          const pct = monto && mt ? ((parseFloat(monto) / mt) * 100).toFixed(2) : ''
                          setEditandoVenta({...editandoVenta, comision_monto_input: monto, comision_pct: pct})
                        }} placeholder="0"
                          style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: 'monospace' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'flex-end' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#3D1A6B', cursor: 'pointer' }}>
                          <input type="checkbox" checked={editandoVenta.comision_es_paralela || false} onChange={e => setEditandoVenta({...editandoVenta, comision_es_paralela: e.target.checked})} />
                          Comisión paralela (se paga aparte)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: S.red, cursor: 'pointer' }}>
                          <input type="checkbox" checked={editandoVenta.tiene_retencion || false} onChange={e => setEditandoVenta({...editandoVenta, tiene_retencion: e.target.checked})} />
                          Retención de ganancias
                        </label>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Observaciones</label>
                        <input type="text" value={editandoVenta.observaciones || ''} onChange={e => setEditandoVenta({...editandoVenta, observaciones: e.target.value})}
                          style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.surface, boxSizing: 'border-box' }} />
                      </div>
                    </div>
                    {/* Resumen neto a cobrar */}
                    {(editandoVenta.monto_total_con_iva || editandoVenta.precio_kg) && (() => {
                      const desbPctR = parseFloat(editandoVenta.desbaste) || (v.desbaste_pct || 8)
                      const kgNetoR = v.kg_vivo_total ? Math.round(v.kg_vivo_total * (1 - desbPctR / 100)) : (v.kg_neto || 0)
                      const montoTotalR = editandoVenta.monto_total_con_iva ? Math.round(parseFloat(editandoVenta.monto_total_con_iva)) : Math.round(kgNetoR * parseFloat(editandoVenta.precio_kg || 0))
                      const montoFactR = editandoVenta.monto_facturado ? parseFloat(editandoVenta.monto_facturado) : montoTotalR
                      const comPctR = parseFloat(editandoVenta.comision_pct || 0)
                      const comMontoR = editandoVenta.comision_monto_input ? parseFloat(editandoVenta.comision_monto_input) : (comPctR > 0 ? Math.round(montoTotalR * comPctR / 100) : 0)
                      const retMontoR = editandoVenta.tiene_retencion ? Math.max(0, Math.round((montoFactR - 224000) * 0.02)) : 0
                      const descontarCom = !editandoVenta.comision_es_paralela ? comMontoR : 0
                      const netoACobrar = montoTotalR - descontarCom - retMontoR
                      if (comMontoR === 0 && retMontoR === 0) return null
                      return (
                        <div style={{ background: S.redLight, border: '1px solid #F09595', borderRadius: 6, padding: '10px 12px', marginBottom: 10 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: S.red, textTransform: 'uppercase', marginBottom: 6 }}>Resumen deducciones</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, fontSize: 12 }}>
                            <div>
                              <div style={{ color: S.muted, fontSize: 10 }}>Total operación</div>
                              <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>${montoTotalR.toLocaleString('es-AR')}</div>
                            </div>
                            {comMontoR > 0 && (
                              <div>
                                <div style={{ color: S.muted, fontSize: 10 }}>{editandoVenta.comision_es_paralela ? 'Comisión (paralela)' : 'Comisión'}</div>
                                <div style={{ fontFamily: 'monospace', color: editandoVenta.comision_es_paralela ? '#3D1A6B' : S.red }}>-${comMontoR.toLocaleString('es-AR')}</div>
                              </div>
                            )}
                            {retMontoR > 0 && (
                              <div>
                                <div style={{ color: S.muted, fontSize: 10 }}>Retención</div>
                                <div style={{ fontFamily: 'monospace', color: S.red }}>-${retMontoR.toLocaleString('es-AR')}</div>
                              </div>
                            )}
                          </div>
                          <div style={{ borderTop: `1px solid #F09595`, marginTop: 8, paddingTop: 8 }}>
                            <div style={{ fontSize: 11, color: S.muted }}>Neto a cobrar</div>
                            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: S.red }}>${netoACobrar.toLocaleString('es-AR')}</div>
                          </div>
                        </div>
                      )
                    })()}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => guardarDatosVenta(v)}
                        style={{ flex: 1, padding: '8px', fontSize: 13, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                        Guardar cambios
                      </button>
                      <button onClick={() => setEditandoVenta(null)}
                        style={{ padding: '8px 14px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

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
                          {v.grupo_venta_id ? 'Venta multi-corral' : `C-${v.corrales?.numero || v.corral_id}`} · {v.grupo_venta_id ? [...ventasSinPrecio, ...ventas].filter(vv => vv.grupo_venta_id === v.grupo_venta_id).reduce((s, vv) => s + (vv.cantidad || 0), 0) : v.cantidad} animales
                          {v.grupo_venta_id && <span style={{ fontSize: 11, color: S.amber, marginLeft: 6 }}>· Se actualizarán todos los corrales del grupo</span>}
                        </div>
                        <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>
                          {v.kg_vivo_total ? `${v.kg_vivo_total.toLocaleString('es-AR')} kg brutos` : v.kg_neto ? `${v.kg_neto.toLocaleString('es-AR')} kg` : ''} · {new Date((v.fecha || v.creado_en?.split('T')[0] || v.creado_en) + (v.fecha ? 'T12:00:00' : '')).toLocaleDateString('es-AR')}
                          {v.comprador && ` · ${v.comprador}`}
                        </div>
                      </div>
                      {!isEdit && (
                        <button onClick={() => setEditandoVenta({ id: v.id, precio_kg: v.precio_kg || '', comprador: v.comprador || '', compradorNuevo: '', observaciones: v.observaciones || '', desbaste: String(v.desbaste_pct || 8), monto_facturado: v.monto_facturado !== null && v.monto_facturado !== undefined ? String(v.monto_facturado) : '', iva_pct: v.iva_pct || '10.5', plazo_dias: v.plazo_dias || '', comision_pct: v.comision_pct || '', comision_monto_input: v.comision_monto ? String(v.comision_monto) : '', comision_es_paralela: v.comision_es_paralela || false, tiene_retencion: v.tiene_retencion || false, monto_total_con_iva: v.monto_total_con_iva || '' })}
                          style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif", flexShrink: 0, marginLeft: 12 }}>
                          Completar datos
                        </button>
                      )}
                    </div>
                    {isEdit && (
                      <div>
                        {/* ── FORMULARIO VENTA ── */}
                        <div style={{ background: S.bg, borderRadius: 8, padding: '12px', marginBottom: 10 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: S.accent, textTransform: 'uppercase', marginBottom: 10 }}>Datos de la venta</div>
                          {/* Fila 1: Kg Brutos / Desbaste / Precio $/kg */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Kg Brutos</label>
                              <div style={{ padding: '8px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 14, fontFamily: 'monospace', fontWeight: 700, background: S.bg, color: S.text }}>
                                {(() => {
                                  const kgB = v.grupo_venta_id
                                    ? todasVentasSinPrecio.filter(vv => vv.grupo_venta_id === v.grupo_venta_id).reduce((s, vv) => s + (vv.kg_vivo_total || 0), 0)
                                    : (v.kg_vivo_total || 0)
                                  return kgB > 0 ? `${kgB.toLocaleString('es-AR')} kg` : '—'
                                })()}
                              </div>
                            </div>
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Desbaste %</label>
                              <input type="number" placeholder="8" value={editandoVenta.desbaste}
                                onChange={e => {
                              const desb = e.target.value
                              const kgB = v.grupo_venta_id
                                ? todasVentasSinPrecio.filter(vv => vv.grupo_venta_id === v.grupo_venta_id).reduce((s, vv) => s + (vv.kg_vivo_total || 0), 0)
                                : (v.kg_vivo_total || 0)
                              const kgN = Math.round(kgB * (1 - parseFloat(desb || 8) / 100))
                              const precio = parseFloat(editandoVenta.precio_kg) || 0
                              const mt = precio && kgN ? String(Math.round(precio * kgN)) : editandoVenta.monto_total_con_iva
                              setEditandoVenta({ ...editandoVenta, desbaste: desb, monto_total_con_iva: mt })
                            }}
                                style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 14, background: S.surface, boxSizing: 'border-box', fontFamily: 'monospace' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Precio $/kg final</label>
                              <input type="number" placeholder="ej. 3100" value={editandoVenta.precio_kg}
                                onChange={e => {
                                  const precio = e.target.value
                                  const kgB = v.grupo_venta_id
                                    ? todasVentasSinPrecio.filter(vv => vv.grupo_venta_id === v.grupo_venta_id).reduce((s, vv) => s + (vv.kg_vivo_total || 0), 0)
                                    : (v.kg_vivo_total || 0)
                                  const desbPct = parseFloat(editandoVenta.desbaste || 8) / 100
                                  const kgN = Math.round(kgB * (1 - desbPct))
                                  const mt = precio && kgN ? String(Math.round(parseFloat(precio) * kgN)) : ''
                                  setEditandoVenta({ ...editandoVenta, precio_kg: precio, monto_total_con_iva: mt })
                                }}
                                style={{ width: '100%', border: `1px solid ${S.accent}`, borderRadius: 6, padding: '8px 10px', fontSize: 14, background: S.surface, boxSizing: 'border-box', fontFamily: 'monospace', fontWeight: 600 }} />
                            </div>
                          </div>
                          {/* Fila 2: Monto Total / Comprador / Plazo */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 600, color: S.accent, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Monto Total Operación $ (IVA incluido)</label>
                              <input type="number" placeholder="Total que paga el frigorífico" value={editandoVenta.monto_total_con_iva || ''}
                                onChange={e => setEditandoVenta({ ...editandoVenta, monto_total_con_iva: e.target.value })}
                                style={{ width: '100%', border: `1px solid ${S.accent}`, borderRadius: 6, padding: '8px 10px', fontSize: 14, background: S.surface, boxSizing: 'border-box', fontWeight: 700, fontFamily: 'monospace' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Comprador</label>
                              <select value={editandoVenta.comprador} onChange={e => setEditandoVenta({ ...editandoVenta, comprador: e.target.value, compradorNuevo: '' })}
                                style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.surface }}>
                                <option value="">— Sin comprador —</option>
                                {compradores.map(c => <option key={c} value={c}>{c}</option>)}
                                <option value="Otro">+ Nuevo...</option>
                              </select>
                              {editandoVenta.comprador === 'Otro' && (
                                <input type="text" placeholder="Nombre del comprador" value={editandoVenta.compradorNuevo || ''}
                                  onChange={e => setEditandoVenta({ ...editandoVenta, compradorNuevo: e.target.value })}
                                  style={{ width: '100%', border: `1px solid ${S.accent}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.surface, boxSizing: 'border-box', marginTop: 6 }} />
                              )}
                            </div>
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Plazo (días)</label>
                              <input type="number" placeholder="0 = contado" value={editandoVenta.plazo_dias || ''}
                                onChange={e => setEditandoVenta({ ...editandoVenta, plazo_dias: e.target.value })}
                                style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 14, background: S.surface, boxSizing: 'border-box', fontFamily: 'monospace' }} />
                            </div>
                          </div>
                          {/* Observación */}
                          <div style={{ marginBottom: 8 }}>
                            <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Observación</label>
                            <input type="text" placeholder="remito, condiciones, etc." value={editandoVenta.observaciones}
                              onChange={e => setEditandoVenta({ ...editandoVenta, observaciones: e.target.value })}
                              style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.surface, boxSizing: 'border-box' }} />
                          </div>
                          {/* Resumen */}
                          {editandoVenta.monto_total_con_iva && (() => {
                            const kgB = v.grupo_venta_id
                              ? todasVentasSinPrecio.filter(vv => vv.grupo_venta_id === v.grupo_venta_id).reduce((s, vv) => s + (vv.kg_vivo_total || 0), 0)
                              : (v.kg_vivo_total || 0)
                            const desbPct = parseFloat(editandoVenta.desbaste || 8) / 100
                            const kgN = Math.round(kgB * (1 - desbPct))
                            const total = parseFloat(editandoVenta.monto_total_con_iva) || 0
                            return (
                              <div style={{ background: S.greenLight, border: '1px solid #97C459', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: S.green, display: 'flex', gap: 24 }}>
                                <span>Kg brutos = <strong>{kgB.toLocaleString('es-AR')} kg</strong></span>
                                <span>Kg netos = <strong>{kgN.toLocaleString('es-AR')} kg</strong></span>
                                <span>Total = <strong>${total.toLocaleString('es-AR')}</strong></span>
                              </div>
                            )
                          })()}
                        </div>

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

          {/* Historial */}}
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
                    {['Fecha', 'Corral', 'Anim.', 'Comprador', 'Kg brutos', 'Kg prom.', 'Desbaste', 'Kg netos', '$/kg', 'Total', ''].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ventas.length === 0 && (
                    <tr><td colSpan={11} style={{ padding: '2rem', textAlign: 'center', color: S.hint, fontSize: 13 }}>No hay ventas registradas.</td></tr>
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
                          <React.Fragment key={v.id}>
                          <tr style={{ borderBottom: `1px solid ${S.border}` }}>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date((v.fecha || v.creado_en?.split('T')[0] || v.creado_en) + (v.fecha ? 'T12:00:00' : '')).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                            <td style={{ padding: '9px 12px' }}>C-{v.corrales?.numero || v.corral_id}</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{v.cantidad}</td>
                            <td style={{ padding: '9px 12px', fontSize: 12 }}>{v.comprador || '—'}</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{v.kg_vivo_total?.toLocaleString('es-AR')}</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: S.muted }}>{v.kg_vivo_total && v.cantidad ? Math.round(v.kg_vivo_total / v.cantidad).toLocaleString('es-AR') : '—'}</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{v.desbaste_pct}%</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{v.kg_neto?.toLocaleString('es-AR')}</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{v.precio_kg ? `$${v.precio_kg.toLocaleString('es-AR')}` : <span style={{ color: S.amber, fontSize: 11, fontWeight: 600 }}>Pendiente</span>}</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600, color: v.total ? S.green : S.hint }}>{(() => {
                              if (!v.total) return '—'
                              const com = (!v.comision_es_paralela && v.comision_monto) ? v.comision_monto : 0
                              const ret = v.retencion_monto || 0
                              const neto = v.total - com - ret
                              return `$${neto.toLocaleString('es-AR')}`
                            })()}</td>
                            <td style={{ padding: '9px 12px', display: 'flex', gap: 6 }}>
                              <button onClick={() => setEditandoVenta({ id: v.id, precio_kg: v.precio_kg || '', monto_total_con_iva: v.monto_total_con_iva || '', comprador: v.comprador || '', compradorNuevo: '', observaciones: v.observaciones || '', desbaste: String(v.desbaste_pct || 8), monto_facturado: v.monto_facturado !== null && v.monto_facturado !== undefined ? String(v.monto_facturado) : '', iva_pct: v.iva_pct || '10.5', plazo_dias: v.plazo_dias || '', comision_pct: v.comision_pct || '', comision_es_paralela: v.comision_es_paralela || false, tiene_retencion: v.tiene_retencion || false })}
                                style={{ padding: '3px 8px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>
                                Editar
                              </button>
                              <button onClick={async () => {
                                if (!confirm('¿Eliminar esta venta? Se devuelven los animales al corral.')) return
                                const { data: corral } = await supabase.from('corrales').select('animales, rol').eq('id', v.corral_id).single()
                                const updateCorral = { animales: (corral?.animales || 0) + v.cantidad }
                                if (corral?.rol === 'libre') updateCorral.rol = 'clasificado'
                                await supabase.from('corrales').update(updateCorral).eq('id', v.corral_id)
                                await supabase.from('ventas').delete().eq('id', v.id)
                                cargar()
                              }} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>
                                Eliminar
                              </button>
                            </td>
                          </tr>
                          {editandoComercial === v.id && (() => {
                            const gcId = v.id
                            const isGroup = false
                            const montoTotalGC = v.monto_total_con_iva || v.total || 0
                            return (
                            <tr style={{ background: S.accentLight }}>
                              <td colSpan={11} style={{ padding: '1.25rem' }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: S.accent, textTransform: 'uppercase', marginBottom: 12 }}>G. Comercial — C-{v.corrales?.numero}</div>
                                {/* Fila 1: Neto Facturado / IVA % / IVA $ */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Neto Facturado $ (sin IVA)</div>
                                    <input type="number" value={formComercial.monto_facturado} onChange={e => setFormComercial({...formComercial, monto_facturado: e.target.value})}
                                      placeholder={montoTotalGC > 0 ? String(Math.round(montoTotalGC / (1 + parseFloat(formComercial.iva_pct || 10.5)/100))) : ''}
                                      style={{ width: '100%', border: `1px solid ${S.accent}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: 'monospace', fontWeight: 600 }} />
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>IVA %</div>
                                    <select value={formComercial.iva_pct} onChange={e => setFormComercial({...formComercial, iva_pct: e.target.value})}
                                      style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.surface }}>
                                      <option value="0">Sin IVA</option>
                                      <option value="10.5">10.5%</option>
                                      <option value="21">21%</option>
                                    </select>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>IVA $</div>
                                    <div style={{ padding: '8px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, fontFamily: 'monospace', background: S.bg, color: S.green, fontWeight: 700 }}>
                                      {formComercial.monto_facturado ? `$${Math.round(parseFloat(formComercial.monto_facturado) * parseFloat(formComercial.iva_pct || 10.5) / 100).toLocaleString('es-AR')}` : '—'}
                                    </div>
                                  </div>
                                </div>
                                {formComercial.monto_facturado && (() => {
                                  const neto = parseFloat(formComercial.monto_facturado) || 0
                                  const iva = parseFloat(formComercial.iva_pct || 10.5)
                                  const ivaMonto = Math.round(neto * iva / 100)
                                  const totalFact = neto + ivaMonto
                                  const paralelo = montoTotalGC > 0 ? Math.max(0, montoTotalGC - totalFact) : 0
                                  return (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                                      <div style={{ background: S.greenLight, border: '1px solid #97C459', borderRadius: 6, padding: '10px 12px' }}>
                                        <div style={{ fontSize: 10, color: S.green, fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Total Facturado (Neto + IVA)</div>
                                        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: S.green }}>${totalFact.toLocaleString('es-AR')}</div>
                                        <div style={{ fontSize: 11, color: S.green, marginTop: 2 }}>Neto: ${neto.toLocaleString('es-AR')} + IVA: ${ivaMonto.toLocaleString('es-AR')}</div>
                                      </div>
                                      <div style={{ background: paralelo > 0 ? '#F0EAFB' : S.bg, border: `1px solid ${paralelo > 0 ? '#9F8ED4' : S.border}`, borderRadius: 6, padding: '10px 12px' }}>
                                        <div style={{ fontSize: 10, color: paralelo > 0 ? '#3D1A6B' : S.hint, fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Cuenta Paralela</div>
                                        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: paralelo > 0 ? '#3D1A6B' : S.hint }}>${paralelo.toLocaleString('es-AR')}</div>
                                        {montoTotalGC > 0 && <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>Total Op: ${montoTotalGC.toLocaleString('es-AR')}</div>}
                                      </div>
                                    </div>
                                  )
                                })()}
                                <div style={{ border: `1px solid ${S.border}`, borderRadius: 6, padding: '10px 12px', marginBottom: 10 }}>
                                  <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 8 }}>Descuentos varios</div>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
                                    <div>
                                      <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Comisión %</div>
                                      <input type="number" value={formComercial.comision_pct || ''} onChange={e => setFormComercial({...formComercial, comision_pct: e.target.value})} placeholder="0"
                                        style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 5, padding: '7px 10px', fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: 'monospace' }} />
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Comisión $</div>
                                      <div style={{ padding: '7px 10px', border: `1px solid ${S.border}`, borderRadius: 5, fontSize: 13, fontFamily: 'monospace', background: S.bg }}>
                                        {formComercial.comision_pct && montoTotalGC ? `$${Math.round(montoTotalGC * parseFloat(formComercial.comision_pct) / 100).toLocaleString('es-AR')}` : '—'}
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#3D1A6B', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={formComercial.comision_es_paralela || false} onChange={e => setFormComercial({...formComercial, comision_es_paralela: e.target.checked})} />
                                        Paralela
                                      </label>
                                    </div>
                                  </div>
                                </div>
                                <div style={{ border: `1px solid ${S.border}`, borderRadius: 6, padding: '10px 12px', marginBottom: 10 }}>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                                    <input type="checkbox" checked={formComercial.tiene_retencion || false} onChange={e => setFormComercial({...formComercial, tiene_retencion: e.target.checked})} />
                                    Retención de Ganancias
                                  </label>
                                  {formComercial.tiene_retencion && formComercial.monto_facturado && (() => {
                                    const neto = parseFloat(formComercial.monto_facturado) || 0
                                    const iva = parseFloat(formComercial.iva_pct || 10.5)
                                    const ivaMonto = Math.round(neto * iva / 100)
                                    const totalFact = neto + ivaMonto
                                    const paralelo = montoTotalGC > 0 ? Math.max(0, montoTotalGC - totalFact) : 0
                                    const retMonto = Math.max(0, Math.round((neto - 224000) * 0.02))
                                    const comMonto = formComercial.comision_pct && montoTotalGC ? Math.round(montoTotalGC * parseFloat(formComercial.comision_pct) / 100) : 0
                                    return (
                                      <div style={{ marginTop: 10, background: S.redLight, border: '1px solid #F09595', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
                                        <div style={{ marginBottom: 4 }}>Retención: <strong style={{ fontFamily: 'monospace', color: S.red }}>-${retMonto.toLocaleString('es-AR')}</strong></div>
                                        <div style={{ fontWeight: 700, color: S.red, fontSize: 14 }}>
                                          Neto a cobrar: ${(totalFact - retMonto - (formComercial.comision_es_paralela ? 0 : comMonto)).toLocaleString('es-AR')}
                                          {paralelo > 0 && <span style={{ color: '#3D1A6B', marginLeft: 12 }}>+ Paralelo: ${paralelo.toLocaleString('es-AR')}</span>}
                                        </div>
                                      </div>
                                    )
                                  })()}
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button onClick={async () => {
                                    const neto = parseFloat(formComercial.monto_facturado) || null
                                    const ivaPct = parseFloat(formComercial.iva_pct || 10.5)
                                    const ivaMonto = neto ? Math.round(neto * ivaPct / 100) : 0
                                    const totalFact = neto ? neto + ivaMonto : null
                                    const paralelo = montoTotalGC && totalFact ? Math.max(0, montoTotalGC - totalFact) : 0
                                    const comPct = parseFloat(formComercial.comision_pct || 0)
                                    const comMonto = comPct > 0 && montoTotalGC ? Math.round(montoTotalGC * comPct / 100) : 0
                                    const retMonto = formComercial.tiene_retencion && neto ? Math.max(0, Math.round((neto - 224000) * 0.02)) : 0
                                    await supabase.from('ventas').update({
                                      monto_facturado: neto, monto_negro: paralelo,
                                      iva_pct: ivaPct, iva_monto: ivaMonto,
                                      estado_comercial: neto ? 'facturado' : 'precio_cargado',
                                      comision_pct: comPct || null, comision_monto: comMonto || null,
                                      comision_es_paralela: formComercial.comision_es_paralela || false,
                                      tiene_retencion: formComercial.tiene_retencion || false,
                                      retencion_monto: retMonto || null,
                                    }).eq('id', gcId)
                                    setEditandoComercial(null)
                                    await cargar()
                                  }} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                                    Guardar
                                  </button>
                                  <button onClick={() => setEditandoComercial(null)}
                                    style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>
                                    Cancelar
                                  </button>
                                </div>
                              </td>
                            </tr>
                            )
                          })()}
                        </React.Fragment>
                        )
                      } else {
                        // Grupo de ventas multi-corral
                        const g = f.grupo
                        const totalKgVivo = g.reduce((s, v) => s + (v.kg_vivo_total || 0), 0)
                        const totalKgNeto = g.reduce((s, v) => s + (v.kg_neto || 0), 0)
                        const totalAnim = g.reduce((s, v) => s + (v.cantidad || 0), 0)
                        const totalMonto = g.reduce((s, v) => s + (v.total || 0), 0)
                        const corralesNums = g.map(v => `C-${v.corrales?.numero || v.corral_id}`).join(', ')
                        const sinPrecio = g.some(v => !v.precio_kg && !v.monto_total_con_iva && !v.total)
                        const v0 = g[0]
                        return (
                          <React.Fragment key={v0.grupo_venta_id}>
                          <tr style={{ borderBottom: `1px solid ${S.border}`, background: S.accentLight }}>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date((v0.fecha || v0.creado_en?.split('T')[0] || v0.creado_en) + (v0.fecha ? 'T12:00:00' : '')).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                            <td style={{ padding: '9px 12px', fontSize: 12 }}>
                              <div style={{ fontWeight: 600 }}>{corralesNums}</div>
                              <div style={{ fontSize: 10, color: S.accent }}>Venta multi-corral</div>
                            </td>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{totalAnim}</td>
                            <td style={{ padding: '9px 12px', fontSize: 12 }}>{v0.comprador || '—'}</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{totalKgVivo.toLocaleString('es-AR')}</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: S.muted }}>{totalKgVivo && totalAnim ? Math.round(totalKgVivo / totalAnim).toLocaleString('es-AR') : '—'}</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{v0.desbaste_pct}%</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{totalKgNeto.toLocaleString('es-AR')}</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{v0.precio_kg ? `$${v0.precio_kg.toLocaleString('es-AR')}` : <span style={{ color: S.amber, fontSize: 11, fontWeight: 600 }}>Pendiente</span>}</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600, color: totalMonto > 0 ? S.green : S.hint }}>{totalMonto > 0 ? `$${totalMonto.toLocaleString('es-AR')}` : '—'}</td>
                            <td style={{ padding: '9px 12px' }}>
                              <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => setEditandoVenta({ id: v0.id, grupo_venta_id: v0.grupo_venta_id, precio_kg: v0.precio_kg !== null && v0.precio_kg !== undefined ? String(v0.precio_kg) : '', monto_total_con_iva: v0.monto_total_grupo ? String(v0.monto_total_grupo) : (v0.monto_total_con_iva || ''), comprador: v0.comprador || '', compradorNuevo: '', observaciones: v0.observaciones || '', desbaste: String(v0.desbaste_pct || 8), monto_facturado: v0.monto_facturado_grupo ? String(v0.monto_facturado_grupo) : (v0.monto_facturado ? String(v0.monto_facturado) : ''), iva_pct: v0.iva_pct || '10.5', plazo_dias: v0.plazo_dias || '', comision_pct: v0.comision_pct || '', comision_monto_input: v0.comision_monto ? String(v0.comision_monto) : '', comision_es_paralela: v0.comision_es_paralela || false, tiene_retencion: v0.tiene_retencion || false })}
                                style={{ padding: '3px 8px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>
                                Editar
                              </button>
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
                              </div>
                            </td>
                          </tr>
                          {editandoComercial === v0.grupo_venta_id && (() => {
                            const gcId = v0.grupo_venta_id
                            const isGroup = true
                            const montoTotalGC = v0.monto_total_grupo || g.reduce((s, gv) => s + (gv.monto_total_con_iva || gv.total || 0), 0) || 0
                            return (
                            <tr style={{ background: S.accentLight }}>
                              <td colSpan={11} style={{ padding: '1.25rem' }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: S.accent, textTransform: 'uppercase', marginBottom: 12 }}>G. Comercial — Venta multi-corral · {corralesNums}</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Neto Facturado $ (sin IVA)</div>
                                    <input type="number" value={formComercial.monto_facturado} onChange={e => setFormComercial({...formComercial, monto_facturado: e.target.value})}
                                      placeholder={montoTotalGC > 0 ? String(Math.round(montoTotalGC / (1 + parseFloat(formComercial.iva_pct || 10.5)/100))) : ''}
                                      style={{ width: '100%', border: `1px solid ${S.accent}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: 'monospace', fontWeight: 600 }} />
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>IVA %</div>
                                    <select value={formComercial.iva_pct} onChange={e => setFormComercial({...formComercial, iva_pct: e.target.value})}
                                      style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.surface }}>
                                      <option value="0">Sin IVA</option>
                                      <option value="10.5">10.5%</option>
                                      <option value="21">21%</option>
                                    </select>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>IVA $</div>
                                    <div style={{ padding: '8px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, fontFamily: 'monospace', background: S.bg, color: S.green, fontWeight: 700 }}>
                                      {formComercial.monto_facturado ? `$${Math.round(parseFloat(formComercial.monto_facturado) * parseFloat(formComercial.iva_pct || 10.5) / 100).toLocaleString('es-AR')}` : '—'}
                                    </div>
                                  </div>
                                </div>
                                {formComercial.monto_facturado && (() => {
                                  const neto = parseFloat(formComercial.monto_facturado) || 0
                                  const iva = parseFloat(formComercial.iva_pct || 10.5)
                                  const ivaMonto = Math.round(neto * iva / 100)
                                  const totalFact = neto + ivaMonto
                                  const paralelo = montoTotalGC > 0 ? Math.max(0, montoTotalGC - totalFact) : 0
                                  return (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                                      <div style={{ background: S.greenLight, border: '1px solid #97C459', borderRadius: 6, padding: '10px 12px' }}>
                                        <div style={{ fontSize: 10, color: S.green, fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Total Facturado (Neto + IVA)</div>
                                        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: S.green }}>${totalFact.toLocaleString('es-AR')}</div>
                                        <div style={{ fontSize: 11, color: S.green, marginTop: 2 }}>Neto: ${neto.toLocaleString('es-AR')} + IVA: ${ivaMonto.toLocaleString('es-AR')}</div>
                                      </div>
                                      <div style={{ background: paralelo > 0 ? '#F0EAFB' : S.bg, border: `1px solid ${paralelo > 0 ? '#9F8ED4' : S.border}`, borderRadius: 6, padding: '10px 12px' }}>
                                        <div style={{ fontSize: 10, color: paralelo > 0 ? '#3D1A6B' : S.hint, fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Cuenta Paralela</div>
                                        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: paralelo > 0 ? '#3D1A6B' : S.hint }}>${paralelo.toLocaleString('es-AR')}</div>
                                        {montoTotalGC > 0 && <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>Total Op: ${montoTotalGC.toLocaleString('es-AR')}</div>}
                                      </div>
                                    </div>
                                  )
                                })()}
                                <div style={{ border: `1px solid ${S.border}`, borderRadius: 6, padding: '10px 12px', marginBottom: 10 }}>
                                  <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 8 }}>Descuentos varios</div>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
                                    <div>
                                      <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Comisión %</div>
                                      <input type="number" value={formComercial.comision_pct || ''} onChange={e => setFormComercial({...formComercial, comision_pct: e.target.value})} placeholder="0"
                                        style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 5, padding: '7px 10px', fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: 'monospace' }} />
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Comisión $</div>
                                      <div style={{ padding: '7px 10px', border: `1px solid ${S.border}`, borderRadius: 5, fontSize: 13, fontFamily: 'monospace', background: S.bg }}>
                                        {formComercial.comision_pct && montoTotalGC ? `$${Math.round(montoTotalGC * parseFloat(formComercial.comision_pct) / 100).toLocaleString('es-AR')}` : '—'}
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#3D1A6B', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={formComercial.comision_es_paralela || false} onChange={e => setFormComercial({...formComercial, comision_es_paralela: e.target.checked})} />
                                        Paralela
                                      </label>
                                    </div>
                                  </div>
                                </div>
                                <div style={{ border: `1px solid ${S.border}`, borderRadius: 6, padding: '10px 12px', marginBottom: 10 }}>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                                    <input type="checkbox" checked={formComercial.tiene_retencion || false} onChange={e => setFormComercial({...formComercial, tiene_retencion: e.target.checked})} />
                                    Retención de Ganancias
                                  </label>
                                  {formComercial.tiene_retencion && formComercial.monto_facturado && (() => {
                                    const neto = parseFloat(formComercial.monto_facturado) || 0
                                    const iva = parseFloat(formComercial.iva_pct || 10.5)
                                    const totalFact = neto + Math.round(neto * iva / 100)
                                    const paralelo = montoTotalGC > 0 ? Math.max(0, montoTotalGC - totalFact) : 0
                                    const retMonto = Math.max(0, Math.round((neto - 224000) * 0.02))
                                    const comMonto = formComercial.comision_pct && montoTotalGC ? Math.round(montoTotalGC * parseFloat(formComercial.comision_pct) / 100) : 0
                                    return (
                                      <div style={{ marginTop: 10, background: S.redLight, border: '1px solid #F09595', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
                                        <div style={{ marginBottom: 4 }}>Retención: <strong style={{ fontFamily: 'monospace', color: S.red }}>-${retMonto.toLocaleString('es-AR')}</strong></div>
                                        <div style={{ fontWeight: 700, color: S.red, fontSize: 14 }}>
                                          Neto a cobrar: ${(totalFact - retMonto - (formComercial.comision_es_paralela ? 0 : comMonto)).toLocaleString('es-AR')}
                                          {paralelo > 0 && <span style={{ color: '#3D1A6B', marginLeft: 12 }}>+ Paralelo: ${paralelo.toLocaleString('es-AR')}</span>}
                                        </div>
                                      </div>
                                    )
                                  })()}
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button onClick={async () => {
                                    const neto = parseFloat(formComercial.monto_facturado) || null
                                    const ivaPct = parseFloat(formComercial.iva_pct || 10.5)
                                    const ivaMonto = neto ? Math.round(neto * ivaPct / 100) : 0
                                    const totalFact = neto ? neto + ivaMonto : null
                                    const paralelo = montoTotalGC && totalFact ? Math.max(0, montoTotalGC - totalFact) : 0
                                    const comPct = parseFloat(formComercial.comision_pct || 0)
                                    const comMonto = comPct > 0 && montoTotalGC ? Math.round(montoTotalGC * comPct / 100) : 0
                                    const retMonto = formComercial.tiene_retencion && neto ? Math.max(0, Math.round((neto - 224000) * 0.02)) : 0
                                    const { data: grupoData } = await supabase.from('ventas').select('*').eq('grupo_venta_id', gcId)
                                    const totalKgNetGrupo = (grupoData || []).reduce((s, gv) => s + (gv.kg_neto || 0), 0)
                                    for (const gv of (grupoData || [])) {
                                      const prop = totalKgNetGrupo > 0 ? gv.kg_neto / totalKgNetGrupo : 1 / grupoData.length
                                      const netoV = neto ? Math.round(neto * prop) : null
                                      const ivaMV = netoV ? Math.round(netoV * ivaPct / 100) : 0
                                      const paraleloV = montoTotalGC ? Math.max(0, Math.round(montoTotalGC * prop) - (netoV ? netoV + ivaMV : 0)) : 0
                                      await supabase.from('ventas').update({
                                        monto_facturado: netoV, monto_negro: paraleloV,
                                        iva_pct: ivaPct, iva_monto: ivaMV,
                                        estado_comercial: neto ? 'facturado' : 'precio_cargado',
                                        comision_pct: comPct || null, comision_monto: comMonto || null,
                                        comision_es_paralela: formComercial.comision_es_paralela || false,
                                        tiene_retencion: formComercial.tiene_retencion || false,
                                        retencion_monto: retMonto || null,
                                      }).eq('id', gv.id)
                                    }
                                    setEditandoComercial(null)
                                    await cargar()
                                  }} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                                    Guardar
                                  </button>
                                  <button onClick={() => setEditandoComercial(null)}
                                    style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>
                                    Cancelar
                                  </button>
                                </div>
                              </td>
                            </tr>
                            )
                          })()}
                          </React.Fragment>
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
              { label: 'Gastado este año', val: totalGastado > 0 ? `$${totalGastado.toLocaleString('es-AR')}` : '$0', sub: `${lotes.length} compras · ${totalAnimComprados} animales` },
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
                    <tr><td colSpan={11} style={{ padding: '2rem', textAlign: 'center', color: S.hint, fontSize: 13 }}>No hay ingresos registrados.</td></tr>
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
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{total > 0 ? `${total.toLocaleString('es-AR')}` : '—'}</td>
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
                  { label: 'Total operación', val: ventaConfirmada.totalVenta ? `$${ventaConfirmada.totalVenta.toLocaleString('es-AR')}` : '—', sub: `${ventaConfirmada.kgNeto?.toLocaleString('es-AR')} kg netos · ${ventaConfirmada.desbastePct}% desb.` },
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
                {['Fecha','Corral/es','Comprador','Total','Facturado','Negro','IVA','Vence','Estado','Factura','Retencion','Cobro'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#6B6760', fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid #E2DDD6', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {ventas.length === 0 && <tr><td colSpan={12} style={{ padding: '2rem', textAlign: 'center', color: '#9E9A94' }}>No hay ventas.</td></tr>}
                {(() => {
                  const vistos = new Set()
                  return ventas.filter(v => {
                    if (v.grupo_venta_id) {
                      if (vistos.has(v.grupo_venta_id)) return false
                      vistos.add(v.grupo_venta_id)
                    }
                    return true
                  }).map(v => {
                    const esGrupo = !!v.grupo_venta_id
                    const grupo = esGrupo ? ventas.filter(vv => vv.grupo_venta_id === v.grupo_venta_id) : [v]
                    const totalGrupo = grupo.reduce((s, vv) => s + (vv.total || 0), 0)
                    const totalFact = grupo.reduce((s, vv) => s + (vv.monto_facturado || 0), 0)
                    const totalNegro = grupo.reduce((s, vv) => s + (vv.monto_negro || 0), 0)
                    const totalIva = grupo.reduce((s, vv) => s + (vv.iva_monto || 0), 0)
                    const totalCom = grupo.reduce((s, vv) => s + ((!vv.comision_es_paralela && vv.comision_monto) ? vv.comision_monto : 0), 0)
                    const totalRet = grupo.reduce((s, vv) => s + (vv.retencion_monto || 0), 0)
                    const netoACobrarGrupo = totalGrupo - totalCom - totalRet
                    const corralesStr = esGrupo ? grupo.map(vv => `C-${vv.corrales?.numero}`).join(', ') : `C-${v.corrales?.numero}`
                    const pagosList = grupo.flatMap(vv => pagosVenta[vv.id] || [])
                    const totalPagado = pagosList.reduce((s, p) => s + (p.monto || 0), 0)
                    const saldo = totalGrupo - totalPagado
                    const rowKey = esGrupo ? v.grupo_venta_id : v.id
                    const isReg = registrandoPago === rowKey
                    const ec = { pendiente: { bg: '#FDF0E0', color: '#7A4500' }, precio_cargado: { bg: '#E8EFF8', color: '#1A3D6B' }, facturado: { bg: '#F0EAFB', color: '#3D1A6B' }, cobrado: { bg: '#E8F4EB', color: '#1E5C2E' } }[v.estado_comercial] || { bg: '#F7F5F0', color: '#6B6760' }
                    const venceProx = v.fecha_vencimiento_cobro && v.estado_comercial !== 'cobrado' && new Date(v.fecha_vencimiento_cobro) <= new Date(Date.now() + 7 * 86400000)
                    return (
                      <tr key={rowKey} style={{ borderBottom: '1px solid #E2DDD6', background: esGrupo ? S.accentLight : venceProx ? '#FFF5F5' : 'transparent' }}>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 11 }}>{new Date((v.fecha || v.creado_en?.split('T')[0] || v.creado_en) + (v.fecha ? 'T12:00:00' : '')).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                        <td style={{ padding: '7px 10px', fontWeight: 600 }}>
                          {corralesStr}
                          {esGrupo && <div style={{ fontSize: 10, color: S.accent }}>Multi-corral</div>}
                        </td>
                        <td style={{ padding: '7px 10px' }}>{v.comprador || '—'}</td>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontWeight: 600, color: '#1E5C2E' }}>{netoACobrarGrupo > 0 ? '$' + netoACobrarGrupo.toLocaleString('es-AR') : '—'}</td>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: '#1E5C2E' }}>{totalFact ? '$' + totalFact.toLocaleString('es-AR') : '—'}</td>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: '#3D1A6B' }}>{totalNegro > 0 ? '$' + totalNegro.toLocaleString('es-AR') : '—'}</td>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 11 }}>{totalIva ? '$' + totalIva.toLocaleString('es-AR') : '—'}</td>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 11, fontWeight: venceProx ? 700 : 400, color: venceProx ? '#7A1A1A' : '#1A1916' }}>
                          {v.fecha_vencimiento_cobro ? new Date(v.fecha_vencimiento_cobro + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '—'}
                        </td>
                        <td style={{ padding: '7px 10px' }}>
                          <select value={v.estado_comercial || 'pendiente'} onChange={async e => {
                            const nuevoEstado = e.target.value
                            for (const vv of grupo) await supabase.from('ventas').update({ estado_comercial: nuevoEstado }).eq('id', vv.id)
                            if (nuevoEstado === 'pendiente') for (const vv of grupo) await supabase.from('ventas').update({ forma_cobro: null, fecha_cobro: null }).eq('id', vv.id)
                            await cargar()
                          }} style={{ padding: '3px 6px', fontSize: 11, fontWeight: 600, border: '1px solid ' + ec.color, borderRadius: 5, background: ec.bg, color: ec.color, cursor: 'pointer' }}>
                            <option value="pendiente">Pendiente</option>
                            <option value="precio_cargado">Precio cargado</option>
                            <option value="facturado">Facturado</option>
                            <option value="cobrado">Cobrado</option>
                          </select>
                        </td>
                        <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                          <input type="checkbox" checked={v.factura_enviada || false} title="Factura enviada" onChange={async e => { for (const vv of grupo) await supabase.from('ventas').update({ factura_enviada: e.target.checked }).eq('id', vv.id); await cargar() }} />
                        </td>
                        <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                          <input type="checkbox" checked={v.retencion_enviada || false} title="Retencion enviada" onChange={async e => { for (const vv of grupo) await supabase.from('ventas').update({ retencion_enviada: e.target.checked }).eq('id', vv.id); await cargar() }} />
                        </td>
                        <td style={{ padding: '7px 10px', minWidth: 200 }}>
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
                                {saldo <= 0 ? '✓ Cobrado completo' : 'Saldo: $' + saldo.toLocaleString('es-AR')}
                              </div>
                            )}
                            {!isReg ? (
                              <button onClick={() => { setRegistrandoPago(rowKey); setFormPago({ monto: saldo > 0 ? String(Math.round(saldo)) : '', forma_pago: 'transferencia', fecha: new Date().toISOString().split('T')[0], numero_cheque: '', banco: '', fecha_cobro_cheque: '', fecha_vencimiento_cheque: '', es_paralela: false, observaciones: '' }) }}
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
                                  {/* Checkbox paralela */}
                                  <div style={{ gridColumn: '1/-1' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#3D1A6B', cursor: 'pointer' }}>
                                      <input type="checkbox" checked={formPago.es_paralela || false} onChange={e => setFormPago({...formPago, es_paralela: e.target.checked})} />
                                      Cobro en cuenta paralela
                                    </label>
                                  </div>
                                  {/* Selector cheque en cartera */}
                                  {['cheque','e-cheq'].includes(formPago.forma_pago) && (() => {
                                    const chFiltrados = formPago.es_paralela
                                      ? chequesParalelos.filter(c => c.es_paralelo)
                                      : chequesParalelos.filter(c => !c.es_paralelo)
                                    if (chFiltrados.length === 0) return null
                                    return (
                                      <div style={{ gridColumn: '1/-1' }}>
                                        <div style={{ fontSize: 9, color: formPago.es_paralela ? '#3D1A6B' : '#1A3D6B', textTransform: 'uppercase', marginBottom: 2 }}>
                                          {formPago.es_paralela ? 'Cheque en cartera paralela' : 'Cheque en cartera oficial'}
                                        </div>
                                        <select onChange={e => {
                                          const ch = chequesParalelos.find(c => String(c.id) === e.target.value)
                                          if (ch) setFormPago({...formPago, numero_cheque: ch.numero || '', banco: ch.banco || '', monto: String(ch.monto || ''), fecha_cobro_cheque: ch.fecha_cobro || '', fecha_vencimiento_cheque: ch.fecha_vencimiento || ''})
                                        }} style={{ width: '100%', border: `1px solid ${formPago.es_paralela ? '#9F8ED4' : '#1A3D6B'}`, borderRadius: 4, padding: '4px 6px', fontSize: 11, background: formPago.es_paralela ? '#F0EAFB' : '#E8EFF8' }}>
                                          <option value="">— Seleccioná un cheque en cartera —</option>
                                          {chFiltrados.map(ch => (
                                            <option key={ch.id} value={ch.id}>#{ch.numero} · {ch.banco} · ${(ch.monto || 0).toLocaleString('es-AR')} · vto {ch.fecha_vencimiento}</option>
                                          ))}
                                        </select>
                                      </div>
                                    )
                                  })()}
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
                                      <div>
                                        <div style={{ fontSize: 9, color: '#6B6760', textTransform: 'uppercase', marginBottom: 2 }}>Fecha de cobro</div>
                                        <input type="date" value={formPago.fecha_cobro_cheque} onChange={e => {
                                          const fechaCobro = e.target.value
                                          const fechaVto = fechaCobro ? new Date(new Date(fechaCobro + 'T12:00:00').getTime() + 30 * 86400000).toISOString().split('T')[0] : ''
                                          setFormPago({...formPago, fecha_cobro_cheque: fechaCobro, fecha_vencimiento_cheque: fechaVto})
                                        }}
                                          style={{ width: '100%', border: '1px solid #E2DDD6', borderRadius: 4, padding: '4px 6px', fontSize: 11, boxSizing: 'border-box' }} />
                                      </div>
                                      <div>
                                        <div style={{ fontSize: 9, color: '#6B6760', textTransform: 'uppercase', marginBottom: 2 }}>Vencimiento (auto +30d)</div>
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
                                    const { data: pagoInsertado } = await supabase.from('pagos_ventas').insert({ venta_id: v.id, grupo_venta_id: v.grupo_venta_id || null, fecha: formPago.fecha, monto, forma_pago: formPago.forma_pago, numero_cheque: formPago.numero_cheque || null, banco: formPago.banco || null, fecha_vencimiento_cheque: formPago.fecha_vencimiento_cheque || null, es_paralelo: formPago.es_paralela || false }).select().single()
                                    const pagoId = pagoInsertado?.id || null
                                    const esParalela = formPago.es_paralela || (totalNegro > 0 && formPago.forma_pago === 'efectivo')
                                    if (esParalela) await supabase.from('caja_paralela').insert({ fecha: formPago.fecha, tipo: 'ingreso', descripcion: 'Venta hacienda ' + corralesStr + ' ' + (v.comprador || ''), monto, pago_venta_id: pagoId })
                                    else await supabase.from('caja_oficial').insert({ fecha: formPago.fecha, tipo: 'ingreso', categoria: 'Cobro venta hacienda', descripcion: 'Venta ' + corralesStr + ' ' + (v.comprador || ''), monto, forma_pago: formPago.forma_pago, pago_venta_id: pagoId })
                                    if (['cheque','e-cheq'].includes(formPago.forma_pago) && formPago.fecha_vencimiento_cheque) await supabase.from('cheques').insert({ tipo: 'recibido', numero: formPago.numero_cheque || null, banco: formPago.banco || null, monto, fecha_emision: formPago.fecha, fecha_cobro: formPago.fecha_cobro_cheque || null, fecha_vencimiento: formPago.fecha_vencimiento_cheque, librador: v.comprador || null, estado: 'en_cartera', es_paralelo: esParalela, pago_venta_id: pagoId })
                                    const { data: todosPageos } = await supabase.from('pagos_ventas').select('monto').eq('venta_id', v.id)
                                    const totalPag = (todosPageos || []).reduce((s, p) => s + (p.monto || 0), 0) + monto
                                    if (totalPag >= totalGrupo * 0.99) for (const vv of grupo) await supabase.from('ventas').update({ estado_comercial: 'cobrado' }).eq('id', vv.id)
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
                        </td>
                      </tr>
                    )
                  })
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}


    </div>
  )
} 