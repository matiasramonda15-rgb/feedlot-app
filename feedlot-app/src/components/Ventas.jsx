import React from 'react'
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Loader } from './UI'

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

// Carga jsPDF desde CDN y genera PDF descargable
async function generarPdfVenta(titulo, filas, info) {
  if (!window.jspdf) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })
  }
  const { jsPDF } = window.jspdf
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // Header
  doc.setFillColor(26, 61, 107)
  doc.rect(0, 0, 210, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('RAMONDA HNOS. S.A.', 14, 10)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Resumen de Venta', 14, 17)
  doc.text(`Generado: ${new Date().toLocaleDateString('es-AR')}`, 196, 17, { align: 'right' })

  // Título
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(titulo, 14, 32)

  // Info general
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  let y = 40
  info.forEach(([label, val]) => {
    doc.setFont('helvetica', 'bold')
    doc.text(label + ':', 14, y)
    doc.setFont('helvetica', 'normal')
    doc.text(String(val || '—'), 55, y)
    y += 6
  })

  // Tabla
  y += 4
  doc.setFillColor(240, 240, 240)
  doc.rect(14, y - 4, 182, 7, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(60, 60, 60)
  const cols = filas[0]
  const colW = Math.floor(182 / cols.length)
  cols.forEach((h, i) => doc.text(h, 14 + i * colW, y))
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)
  filas.slice(1).forEach((row, ri) => {
    if (ri % 2 === 0) { doc.setFillColor(250, 250, 250); doc.rect(14, y - 4, 182, 6, 'F') }
    row.forEach((cell, i) => doc.text(String(cell || '—'), 14 + i * colW, y))
    y += 6
    if (y > 270) { doc.addPage(); y = 20 }
  })

  // Footer
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.text('Ramonda Hnos. S.A. — Sistema de gestión', 14, 285)

  const nombreArchivo = titulo.replace(/[^a-zA-Z0-9]/g, '_') + '_' + new Date().toISOString().split('T')[0] + '.pdf'
  doc.save(nombreArchivo)
}

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
  const [editandoBanner, setEditandoBanner] = useState(null)
  const [pagosVenta, setPagosVenta] = useState({})
  const [registrandoPago, setRegistrandoPago] = useState(null)
  const [pagosExpandidos, setPagosExpandidos] = useState({})
  const [mostrarArchivadas, setMostrarArchivadas] = useState(false)
  const [filtroArchivadas, setFiltroArchivadas] = useState({ comprador: '', desde: '', hasta: '' })
  const [filtroVentas, setFiltroVentas] = useState('')
  const [filtroGestion, setFiltroGestion] = useState('')
  const [filtroCuentas, setFiltroCuentas] = useState('')
  const [showDetalleMeses, setShowDetalleMeses] = useState(false)
  const [showDetalleKg, setShowDetalleKg] = useState(false)
  const [showDetallePrecio, setShowDetallePrecio] = useState(false)
  const [editandoComercial, setEditandoComercial] = useState(null)
  const [gcVersion, setGcVersion] = useState(0)
  const [formComercial, setFormComercial] = useState({ monto_facturado: '', iva_pct: '10.5', descuento_monto: '', descuento_descripcion: '', tiene_retencion: false, plazo_dias: '', fecha_vencimiento: '' })
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
    try {
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
    } catch(e) { console.error('CARGAR ERROR:', e.message, e.stack) }
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
  const kgDescuento = Math.round(kgBruto * desbastePct / 100 * 10) / 10
  const kgNeto = Math.round((kgBruto - kgDescuento) * 10) / 10
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
    const kgNeto = Math.round(kgBrutoTotal * (1 - desbastePct / 100) * 10) / 10
    const montoTotal = ep.monto_total_con_iva ? parseFloat(ep.monto_total_con_iva) : (precioKg ? Math.round(kgNeto * precioKg * 100) / 100 : null)
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
      const totalKgNetoGrupo = (grupo || []).reduce((s, v) => s + (v.kg_vivo_total ? Math.round(v.kg_vivo_total * (1 - desbastePct / 100) * 10) / 10 : (v.kg_neto || 0)), 0)
      for (const gv of (grupo || [])) {
        const kgNetoV = gv.kg_vivo_total ? Math.round(gv.kg_vivo_total * (1 - desbastePct / 100) * 10) / 10 : (gv.kg_neto || 0)
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
    setEditandoBanner(null)
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
    const montoTotal = precio ? Math.round(totalKgNeto * precio * 100) / 100 : null
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
      const kgNetoCv = Math.round(parseFloat(cv.kg_vivo) * (1 - desbPct / 100) * 10) / 10
      const montoTotalCv = precio ? Math.round(kgNetoCv * precio * 100) / 100 : null
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

  function renderFormVenta(v) {
    const kgBruto = v.grupo_venta_id
      ? [...new Map([...ventasSinPrecio, ...ventas].map(vv => [vv.id, vv])).values()].filter(vv => vv.grupo_venta_id === v.grupo_venta_id).reduce((s, vv) => s + (vv.kg_vivo_total || 0), 0)
      : (v.kg_vivo_total || 0)
    const desbPct = parseFloat(editandoVenta?.desbaste || 8) / 100
    const kgNeto = kgBruto ? Math.round(kgBruto * (1 - desbPct) * 10) / 10 : 0
    const montoCalc = editandoVenta?.precio_kg && kgNeto ? Math.round(parseFloat(editandoVenta.precio_kg) * kgNeto) : null
    const montoTotal = editandoVenta?.monto_total_con_iva ? parseFloat(editandoVenta.monto_total_con_iva) : montoCalc
    const inp = { width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: 'monospace' }
    const Lbl = ({ children }) => <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>{children}</label>
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div>
            <Lbl>Kg Brutos</Lbl>
            <div style={{ padding: '8px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 14, fontFamily: 'monospace', fontWeight: 700, background: S.bg }}>{kgBruto > 0 ? `${kgBruto.toLocaleString('es-AR')} kg` : '—'}</div>
          </div>
          <div>
            <Lbl>Desbaste %</Lbl>
            <input type="number" placeholder="8" value={editandoVenta?.desbaste || ''} onChange={e => {
              const desb = e.target.value
              const kgN = Math.round(kgBruto * (1 - parseFloat(desb || 8) / 100))
              const precio = parseFloat(editandoVenta?.precio_kg) || 0
              const mt = precio && kgN ? String(Math.round(precio * kgN)) : editandoVenta?.monto_total_con_iva
              setEditandoVenta({...editandoVenta, desbaste: desb, monto_total_con_iva: mt})
            }} style={inp} />
          </div>
          <div>
            <Lbl>Precio $/kg final</Lbl>
            <input type="number" placeholder="ej. 3100" value={editandoVenta?.precio_kg || ''} onChange={e => {
              const precio = e.target.value
              const kgN = Math.round(kgBruto * (1 - parseFloat(editandoVenta?.desbaste || 8) / 100) * 10) / 10
              const mt = precio && kgN ? String(Math.round(parseFloat(precio) * kgN)) : ''
              setEditandoVenta({...editandoVenta, precio_kg: precio, monto_total_con_iva: mt})
            }} style={{ ...inp, border: `1px solid ${S.accent}`, fontWeight: 600 }} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div>
            <Lbl>Monto Total Operación $ (IVA incluido)</Lbl>
            <input type="number" value={editandoVenta?.monto_total_con_iva || ''} onChange={e => setEditandoVenta({...editandoVenta, monto_total_con_iva: e.target.value})}
              style={{ ...inp, border: `1px solid ${S.accent}`, fontWeight: 700 }} placeholder="Total que paga el frigorífico" />
          </div>
          <div>
            <Lbl>Comprador</Lbl>
            <select value={editandoVenta?.comprador || ''} onChange={e => setEditandoVenta({...editandoVenta, comprador: e.target.value, compradorNuevo: ''})}
              style={{ ...inp, fontFamily: 'inherit' }}>
              <option value="">— Sin comprador —</option>
              {compradores.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="Otro">+ Nuevo...</option>
            </select>
            {editandoVenta?.comprador === 'Otro' && (
              <input type="text" placeholder="Nombre del comprador" value={editandoVenta?.compradorNuevo || ''}
                onChange={e => setEditandoVenta({...editandoVenta, compradorNuevo: e.target.value})}
                style={{ ...inp, border: `1px solid ${S.accent}`, marginTop: 6, fontFamily: 'inherit' }} />
            )}
          </div>
          <div>
            <Lbl>Plazo (días)</Lbl>
            <input type="number" placeholder="0 = contado" value={editandoVenta?.plazo_dias || ''} onChange={e => setEditandoVenta({...editandoVenta, plazo_dias: e.target.value})} style={inp} />
          </div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <Lbl>Observación</Lbl>
          <input type="text" placeholder="remito, condiciones, etc." value={editandoVenta?.observaciones || ''} onChange={e => setEditandoVenta({...editandoVenta, observaciones: e.target.value})}
            style={{ ...inp, fontFamily: 'inherit' }} />
        </div>
        {montoTotal > 0 && (
          <div style={{ background: S.greenLight, border: '1px solid #97C459', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: S.green, display: 'flex', gap: 24, marginBottom: 10 }}>
            <span>Kg brutos = <strong>{kgBruto.toLocaleString('es-AR')} kg</strong></span>
            <span>Kg netos = <strong>{kgNeto.toLocaleString('es-AR')} kg</strong></span>
            <span>Total = <strong>${montoTotal.toLocaleString('es-AR')}</strong></span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => guardarDatosVenta(v)} style={{ flex: 1, padding: '8px', fontSize: 13, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>Guardar</button>
          <button onClick={() => setEditandoVenta(null)} style={{ padding: '8px 14px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
        </div>
      </div>
    )
  }

  function renderFormGC(v, isGroup, grupo, gcKey, montoTotal, _cargar, _supabase) {
    const neto = parseFloat(formComercial.monto_facturado) || 0
    const iva = parseFloat(formComercial.iva_pct || 10.5)
    const ivaMonto = neto ? Math.round(neto * iva / 100) : 0
    const totalFact = neto + ivaMonto
    const descuento = parseFloat(formComercial.descuento_monto) || 0
    const netoFinal = totalFact - descuento
    const paralelo = montoTotal > 0 ? Math.max(0, montoTotal - totalFact) : 0
    const retMonto = formComercial.tiene_retencion && neto ? Math.max(0, Math.round((neto - 224000) * 0.02)) : 0
    const Lbl = ({ c }) => null
    const inp = { width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.surface, boxSizing: 'border-box' }

    async function guardarGC() {
      const updateData = {
        monto_facturado: neto || null, monto_negro: paralelo,
        iva_pct: iva, iva_monto: ivaMonto,
        descuento_monto: descuento || null,
        descuento_descripcion: formComercial.descuento_descripcion || null,
        estado_comercial: 'facturado',
        tiene_retencion: formComercial.tiene_retencion || false,
        retencion_monto: retMonto || null,
        plazo_dias: formComercial.plazo_dias ? parseInt(formComercial.plazo_dias) : null,
        fecha_vencimiento_cobro: formComercial.fecha_vencimiento || null,
      }
      if (isGroup) {
        const totalKgNet = (grupo || []).reduce((s, gv) => s + (gv.kg_neto || 0), 0)
        for (const gv of grupo) {
          const prop = totalKgNet > 0 ? gv.kg_neto / totalKgNet : 1 / (grupo || []).length
          const netoV = neto ? Math.round(neto * prop) : null
          const ivaMV = netoV ? Math.round(netoV * iva / 100) : 0
          const descV = descuento ? Math.round(descuento * prop) : 0
          const totalFactV = (netoV || 0) + ivaMV - descV
          const montoTotalV = montoTotal ? Math.round(montoTotal * prop) : 0
          const paraleloV = Math.max(0, montoTotalV - totalFactV)
          await _supabase.from('ventas').update({ ...updateData, monto_facturado: netoV, iva_monto: ivaMV, monto_negro: paraleloV, descuento_monto: descV || null }).eq('id', gv.id)
        }
      } else {
        await _supabase.from('ventas').update(updateData).eq('id', gcKey)
      }
      setEditandoComercial(null)
      setFormComercial({ monto_facturado: '', iva_pct: '10.5', descuento_monto: '', descuento_descripcion: '', tiene_retencion: false, plazo_dias: '', fecha_vencimiento: '' })
      await _cargar()
      setGcVersion(v => v + 1)
    }

    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Neto Facturado $ (sin IVA)</div>
            <input type="number" value={formComercial.monto_facturado} onChange={e => setFormComercial({...formComercial, monto_facturado: e.target.value})}
              style={{ ...inp, border: `1px solid ${S.accent}`, fontFamily: 'monospace', fontWeight: 600 }} />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>IVA %</div>
            <select value={formComercial.iva_pct} onChange={e => setFormComercial({...formComercial, iva_pct: e.target.value})} style={inp}>
              <option value="0">Sin IVA</option>
              <option value="10.5">10.5%</option>
              <option value="21">21%</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>IVA $</div>
            <div style={{ padding: '8px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, fontFamily: 'monospace', background: S.bg, fontWeight: 700, color: S.green }}>
              {neto ? `$${ivaMonto.toLocaleString('es-AR')}` : '—'}
            </div>
          </div>
        </div>
        {(neto >= 0 && formComercial.monto_facturado !== '') && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div style={{ background: S.greenLight, border: '1px solid #97C459', borderRadius: 6, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: S.green, fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Total Facturado (Neto + IVA)</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: S.green }}>${totalFact.toLocaleString('es-AR')}</div>
              <div style={{ fontSize: 11, color: S.green, marginTop: 2 }}>Neto: ${neto.toLocaleString('es-AR')} + IVA: ${ivaMonto.toLocaleString('es-AR')}</div>
            </div>
            <div style={{ background: paralelo > 0 ? '#F0EAFB' : S.bg, border: `1px solid ${paralelo > 0 ? '#9F8ED4' : S.border}`, borderRadius: 6, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: paralelo > 0 ? '#3D1A6B' : S.hint, fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Cuenta Paralela</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: paralelo > 0 ? '#3D1A6B' : S.hint }}>${paralelo.toLocaleString('es-AR')}</div>
              {montoTotal > 0 && <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>Total op: ${montoTotal.toLocaleString('es-AR')}</div>}
            </div>
          </div>
        )}
        <div style={{ border: `1px solid ${S.border}`, borderRadius: 6, padding: '10px 12px', marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 8 }}>Descuentos varios (opcional)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, color: S.muted, marginBottom: 3 }}>Monto $</div>
              <input type="number" value={formComercial.descuento_monto || ''} onChange={e => setFormComercial({...formComercial, descuento_monto: e.target.value})} placeholder="0" style={{ ...inp, fontFamily: 'monospace' }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: S.muted, marginBottom: 3 }}>Descripción</div>
              <input type="text" value={formComercial.descuento_descripcion || ''} onChange={e => setFormComercial({...formComercial, descuento_descripcion: e.target.value})} placeholder="ej. flete, merma, comisión, etc." style={inp} />
            </div>
          </div>
          {descuento > 0 && <div style={{ fontSize: 12, color: S.red, marginTop: 6, fontFamily: 'monospace' }}>Neto final: ${(totalFact - descuento).toLocaleString('es-AR')} (descuento: -${descuento.toLocaleString('es-AR')})</div>}
        </div>
        <div style={{ border: `1px solid ${S.border}`, borderRadius: 6, padding: '10px 12px', marginBottom: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
            <input type="checkbox" checked={formComercial.tiene_retencion || false} onChange={e => setFormComercial({...formComercial, tiene_retencion: e.target.checked})} />
            Retención de Ganancias
          </label>
          {formComercial.tiene_retencion && neto > 0 && (
            <div style={{ marginTop: 8, background: S.redLight, border: '1px solid #F09595', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
              <div>Retención: <strong style={{ fontFamily: 'monospace', color: S.red }}>-${retMonto.toLocaleString('es-AR')}</strong></div>
              <div style={{ fontWeight: 700, color: S.red, fontSize: 14, marginTop: 4 }}>
                Neto a cobrar: ${(totalFact - descuento - retMonto).toLocaleString('es-AR')}
                {paralelo > 0 && <span style={{ color: '#3D1A6B', marginLeft: 12 }}>+ Paralelo: ${paralelo.toLocaleString('es-AR')}</span>}
              </div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={async () => {
            const netoVal = parseFloat(formComercial.monto_facturado) || 0
            const ivaVal = parseFloat(formComercial.iva_pct || 10.5)
            const ivaMVal = netoVal ? Math.round(netoVal * ivaVal / 100) : 0
            const descuentoVal = parseFloat(formComercial.descuento_monto) || 0
            const netoFinalVal = netoVal + ivaMVal
            const paraleloVal = montoTotal > 0 ? Math.max(0, montoTotal - netoFinalVal) : 0
            const retMontoVal = formComercial.tiene_retencion && netoVal ? Math.max(0, Math.round((netoVal - 224000) * 0.02)) : 0
            const updateData = {
              monto_facturado: netoVal || null, monto_negro: paraleloVal,
              iva_pct: ivaVal, iva_monto: ivaMVal,
              descuento_monto: descuentoVal || null,
              descuento_descripcion: formComercial.descuento_descripcion || null,
              estado_comercial: 'facturado',
              tiene_retencion: formComercial.tiene_retencion || false,
              retencion_monto: retMontoVal || null,
              plazo_dias: formComercial.plazo_dias ? parseInt(formComercial.plazo_dias) : null,
              fecha_vencimiento_cobro: formComercial.fecha_vencimiento || null,
            }
            if (isGroup) {
              const totalKgNet = (grupo || []).reduce((s, gv) => s + (gv.kg_neto || 0), 0)
              for (const gv of grupo) {
                const prop = totalKgNet > 0 ? gv.kg_neto / totalKgNet : 1 / (grupo || []).length
                const netoV = netoVal ? Math.round(netoVal * prop) : null
                const ivaMV = netoV ? Math.round(netoV * ivaVal / 100) : 0
                const descV = descuentoVal ? Math.round(descuentoVal * prop) : 0
                const paraleloV = montoTotal ? Math.max(0, Math.round(montoTotal * prop) - ((netoV || 0) + ivaMV - descV)) : 0
                await _supabase.from('ventas').update({ ...updateData, monto_facturado: netoV, iva_monto: ivaMV, monto_negro: paraleloV, descuento_monto: descV || null }).eq('id', gv.id)
              }
            } else {
              await _supabase.from('ventas').update(updateData).eq('id', gcKey)
            }
            setEditandoComercial(null)
            setFormComercial({ monto_facturado: '', iva_pct: '10.5', descuento_monto: '', descuento_descripcion: '', tiene_retencion: false, plazo_dias: '', fecha_vencimiento: '' })
            await _cargar()
            setGcVersion(v => v + 1)
          }} style={{ flex: 1, padding: '8px', fontSize: 13, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>Guardar</button>
          <button onClick={() => setEditandoComercial(null)} style={{ padding: '8px 14px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
        </div>
      </div>
    )
  }

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



          {/* Ventas sin precio cargado - Jesús cargó pero falta completar */}
          {ventasSinPrecio.length > 0 && (
            <div style={{ background: S.amberLight, border: '1px solid #EF9F27', borderRadius: 10, padding: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: S.amber, marginBottom: '1rem' }}>
                ⚠ {ventasSinPrecio.length} venta{ventasSinPrecio.length !== 1 ? 's' : ''} sin precio cargado
              </div>
              {ventasSinPrecio.map(v => {
                const vKey = v.grupo_venta_id || v.id
                const grupo = v.grupo_venta_id ? (todasVentasSinPrecio.filter(vv => vv.grupo_venta_id === v.grupo_venta_id) || [v]) : [v]
                if (!grupo || (grupo || []).length === 0) return null
                const kgBrutoTotal = (grupo || []).reduce((s, gv) => s + (gv.kg_vivo_total || 0), 0)
                const animTotal = (grupo || []).reduce((s, gv) => s + (gv.cantidad || 0), 0)
                const corralesNumsP = (grupo || []).map(gv => `C-${gv.corrales?.numero || gv.corral_id}`).join(', ')
                const isEditing = editandoBanner === vKey
                if (editandoBanner && editandoBanner !== vKey) return null
                return (
                  <div key={vKey} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem', marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: isEditing ? 12 : 0 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{corralesNumsP}{v.grupo_venta_id ? ` · Multi-corral` : ''} · {animTotal} animales</div>
                        <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>{kgBrutoTotal.toLocaleString('es-AR')} kg brutos · {new Date((v.fecha || v.creado_en?.split('T')[0] || v.creado_en)+'T12:00:00').toLocaleDateString('es-AR')}</div>
                      </div>
                      {!isEditing && (
                        <button onClick={() => { setEditandoBanner(vKey); setEditandoVenta({ id: v.id, grupo_venta_id: v.grupo_venta_id, precio_kg: '', monto_total_con_iva: '', comprador: v.comprador || '', compradorNuevo: '', observaciones: v.observaciones || '', desbaste: '8', plazo_dias: '' }) }}
                          style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                          Completar datos
                        </button>
                      )}
                      {isEditing && (
                        <button onClick={() => { setEditandoBanner(null); setEditandoVenta(null) }}
                          style={{ padding: '6px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>
                          Cancelar
                        </button>
                      )}
                    </div>
                    {isEditing && renderFormVenta(v)}
                  </div>
                )
              })}
            </div>
          )}


          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em' }}>Historial de ventas</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select value={filtroVentas} onChange={e => setFiltroVentas(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: 12, border: `1px solid ${S.border}`, borderRadius: 6, background: S.surface, color: filtroVentas ? S.accent : S.muted, fontWeight: filtroVentas ? 600 : 400 }}>
                  <option value="">Todos los compradores</option>
                  {compradores.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {filtroVentas && <button onClick={() => setFiltroVentas('')} style={{ padding: '6px 8px', fontSize: 11, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>✕</button>}
                <button onClick={() => { setTab('nueva-venta'); setPaso(1); setVentaConfirmada(null) }}
                  style={{ padding: '5px 10px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                  + Nueva venta
                </button>
              </div>
            </div>
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: S.bg }}>
                    {['Fecha', 'Corral', 'Anim.', 'Comprador', 'Kg brutos', 'Kg prom.', 'Desbaste', 'Kg netos', '$/kg', '$/kg real', 'Total', ''].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ventas.length === 0 && (
                    <tr><td colSpan={11} style={{ padding: '2rem', textAlign: 'center', color: S.hint, fontSize: 13 }}>No hay ventas registradas.</td></tr>
                  )}
                  {(() => {
                    const hoy40v = new Date(Date.now() - 40 * 86400000)
                    // Agrupar por grupo_venta_id — solo ventas recientes
                    const grupos = {}
                    const ventasOrden = []
                    ventas.filter(v => new Date(v.creado_en) >= hoy40v).filter(v => !filtroVentas || v.comprador === filtroVentas).forEach(v => {
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
                    // Deduplicar grupos — solo ventas recientes
                    const vistos = new Set()
                    const filas = []
                    ventas.filter(v => new Date(v.creado_en) >= hoy40v).filter(v => !filtroVentas || v.comprador === filtroVentas).forEach(v => {
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
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date((v.fecha || v.creado_en?.split('T')[0] || v.creado_en) + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                            <td style={{ padding: '9px 12px' }}>C-{v.corrales?.numero || v.corral_id}</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{v.cantidad}</td>
                            <td style={{ padding: '9px 12px', fontSize: 12 }}>{v.comprador || '—'}</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{v.kg_vivo_total?.toLocaleString('es-AR')}</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: S.muted }}>{v.kg_vivo_total && v.cantidad ? Math.round(v.kg_vivo_total / v.cantidad).toLocaleString('es-AR') : '—'}</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{v.desbaste_pct}%</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{v.kg_neto?.toLocaleString('es-AR')}</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: S.muted }}>{v.precio_kg ? `$${v.precio_kg.toLocaleString('es-AR')}` : '—'}</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{(() => {
                              if (v.kg_neto && (v.monto_facturado != null || v.monto_negro != null)) {
                                const montoTotalV = (v.monto_facturado || 0) + (v.monto_negro || 0)
                                const precioReal = Math.round((montoTotalV - (v.descuento_monto || 0)) / parseFloat(v.kg_neto))
                                return `$${precioReal.toLocaleString('es-AR')}`
                              }
                              return <span style={{ color: S.hint, fontSize: 11 }}>—</span>
                            })()}</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600, color: v.total ? S.green : S.hint }}>{(() => {
                              if (!v.total) return '—'
                              const com = (!v.comision_es_paralela && v.comision_monto) ? v.comision_monto : 0
                              const ret = v.retencion_monto || 0
                              const neto = v.total - com - ret
                              return `$${neto.toLocaleString('es-AR')}`
                            })()}</td>
                            <td style={{ padding: '9px 12px', display: 'flex', gap: 6 }}>
                              <button onClick={async () => {
                                const fecha = new Date((v.fecha || v.creado_en?.split('T')[0] || v.creado_en) + 'T12:00:00').toLocaleDateString('es-AR')
                                const total = v.monto_total_con_iva || v.total || 0
                                await generarPdfVenta(
                                  `Venta C-${v.corrales?.numero || v.corral_id}`,
                                  [
                                    ['Campo', 'Dato'],
                                    ['Fecha', fecha],
                                    ['Corral', `C-${v.corrales?.numero || v.corral_id}`],
                                    ['Comprador', v.comprador || '—'],
                                    ['Cantidad', `${v.cantidad} animales`],
                                    ['Kg vivos', `${(v.kg_vivo_total || 0).toLocaleString('es-AR')} kg`],
                                    ['Desbaste', `${v.desbaste_pct || 8}%`],
                                    ['Kg netos', `${(v.kg_neto || 0).toLocaleString('es-AR')} kg`],
                                    ['$/kg', v.precio_kg ? `$${v.precio_kg.toLocaleString('es-AR')}` : '—'],
                                    ['Total', `$${total.toLocaleString('es-AR')}`],
                                    ...(v.observaciones ? [['Observaciones', v.observaciones]] : []),
                                  ],
                                  [
                                    ['Comprador', v.comprador],
                                    ['Fecha', fecha],
                                    ['Corral', `C-${v.corrales?.numero || v.corral_id}`],
                                  ]
                                )
                              }} style={{ padding: '3px 8px', fontSize: 11, background: '#F0F0F0', border: '1px solid #CCC', color: '#333', borderRadius: 5, cursor: 'pointer' }}>
                                📄 PDF
                              </button>
                              <button onClick={() => { setEditandoComercial(null); setEditandoVenta({ id: v.id, precio_kg: v.precio_kg ? String(v.precio_kg) : '', monto_total_con_iva: v.monto_total_con_iva ? String(v.monto_total_con_iva) : (v.total ? String(v.total) : ''), comprador: v.comprador || '', compradorNuevo: '', observaciones: v.observaciones || '', desbaste: String(v.desbaste_pct || 8), plazo_dias: v.plazo_dias ? String(v.plazo_dias) : '' }) }}
                                style={{ padding: '3px 8px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>
                                ✏️ Editar
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
                          {editandoVenta?.id === v.id && (
                            <tr style={{ background: '#FDF8F0' }}>
                              <td colSpan={11} style={{ padding: '1.25rem' }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: S.amber, textTransform: 'uppercase', marginBottom: 12 }}>✏️ Editar venta — C-{v.corrales?.numero}</div>
                                {renderFormVenta(v)}
                              </td>
                            </tr>
                          )}
                          {editandoComercial === v.id && !editandoVenta?.id && (() => {
                            const gcId = v.id
                            const isGroup = false
                            const montoTotalGC = v.monto_total_con_iva || v.total || 0
                            return (
                            <tr style={{ background: S.accentLight }}>
                              <td colSpan={11} style={{ padding: '1.25rem' }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: S.accent, textTransform: 'uppercase', marginBottom: 12 }}>G. Comercial — C-{v.corrales?.numero}</div>
                                {renderFormGC(v, false, [v], gcId, montoTotalGC, cargar, supabase)}
                              </td>
                            </tr>
                            )
                          })()}
                        </React.Fragment>
                        )
                      } else {
                        // Grupo de ventas multi-corral
                        const g = f.grupo
                        const totalKgVivo = (g || []).reduce((s, v) => s + (v.kg_vivo_total || 0), 0)
                        const totalKgNeto = (g || []).reduce((s, v) => s + (v.kg_neto || 0), 0)
                        const totalAnim = (g || []).reduce((s, v) => s + (v.cantidad || 0), 0)
                        const totalMonto = (g || []).reduce((s, v) => s + (v.total || 0), 0)
                        const corralesNums = (g || []).map(v => `C-${v.corrales?.numero || v.corral_id}`).join(', ')
                        const sinPrecio = (g || []).some(v => !v.precio_kg && !v.monto_total_con_iva && !v.total)
                        const v0 = (g || [])[0]
                        if (!v0) return null
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
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: S.muted }}>{v0.precio_kg ? `$${v0.precio_kg.toLocaleString('es-AR')}` : '—'}</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{(() => {
                              const totalNetoFact = (g || []).reduce((s, gv) => s + (gv.monto_facturado || 0), 0)
                              const totalNegro = (g || []).reduce((s, gv) => s + (gv.monto_negro || 0), 0)
                              const totalDescuento = (g || []).reduce((s, gv) => s + (gv.descuento_monto || 0), 0)
                              const totalKgNetoG = (g || []).reduce((s, gv) => s + (gv.kg_neto || 0), 0)
                              if (totalKgNetoG && (totalNetoFact || totalNegro)) {
                                return `$${Math.round((totalNetoFact + totalNegro - totalDescuento) / totalKgNetoG).toLocaleString('es-AR')}`
                              }
                              return <span style={{ color: S.hint, fontSize: 11 }}>—</span>
                            })()}</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600, color: totalMonto > 0 ? S.green : S.hint }}>{totalMonto > 0 ? `$${totalMonto.toLocaleString('es-AR')}` : '—'}</td>
                            <td style={{ padding: '9px 12px' }}>
                              <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={async () => {
                                const fecha = new Date((v0.fecha || v0.creado_en?.split('T')[0] || v0.creado_en) + 'T12:00:00').toLocaleDateString('es-AR')
                                const corralesStr = (g || []).map(gv => `C-${gv.corrales?.numero || gv.corral_id}`).join(', ')
                                await generarPdfVenta(
                                  `Venta ${corralesStr}`,
                                  [
                                    ['Campo', 'Dato'],
                                    ['Fecha', fecha],
                                    ['Corrales', corralesStr],
                                    ['Comprador', v0.comprador || '—'],
                                    ['Cantidad', `${totalAnim} animales`],
                                    ['Kg vivos', `${totalKgVivo.toLocaleString('es-AR')} kg`],
                                    ['Desbaste', `${v0.desbaste_pct || 8}%`],
                                    ['Kg netos', `${totalKgNeto.toLocaleString('es-AR')} kg`],
                                    ['$/kg', v0.precio_kg ? `$${v0.precio_kg.toLocaleString('es-AR')}` : '—'],
                                    ['Total', `$${totalMonto.toLocaleString('es-AR')}`],
                                    ...(v0.observaciones ? [['Observaciones', v0.observaciones]] : []),
                                  ],
                                  [
                                    ['Comprador', v0.comprador],
                                    ['Fecha', fecha],
                                    ['Corrales', corralesStr],
                                  ]
                                )
                              }} style={{ padding: '3px 8px', fontSize: 11, background: '#F0F0F0', border: '1px solid #CCC', color: '#333', borderRadius: 5, cursor: 'pointer' }}>
                                📄 PDF
                              </button>
                              <button onClick={() => { setEditandoComercial(null); const mt = v0.monto_total_grupo || (g || []).reduce((s,gv)=>s+(gv.monto_total_con_iva||gv.total||0),0)||0; setEditandoVenta({ id: v0.id, grupo_venta_id: v0.grupo_venta_id, precio_kg: v0.precio_kg ? String(v0.precio_kg) : '', monto_total_con_iva: String(mt), comprador: v0.comprador || '', compradorNuevo: '', observaciones: v0.observaciones || '', desbaste: String(v0.desbaste_pct || 8), plazo_dias: v0.plazo_dias ? String(v0.plazo_dias) : '' }) }}
                                style={{ padding: '3px 8px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>
                                ✏️ Editar
                              </button>
                              <button onClick={async () => {
                                if (!confirm(`¿Eliminar esta venta? Se devuelven los animales a ${(g || []).length} corrales.`)) return
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
                          {editandoVenta?.grupo_venta_id === v0.grupo_venta_id && (
                            <tr style={{ background: S.accentLight }}>
                              <td colSpan={11} style={{ padding: '1.25rem' }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: S.accent, textTransform: 'uppercase', marginBottom: 12 }}>Editar venta — Multi-corral · {corralesNums}</div>
                                {renderFormVenta(v0)}
                              </td>
                            </tr>
                          )}
                          {editandoComercial === v0.grupo_venta_id && !editandoVenta?.id && (() => {
                            const montoTotalGCM = v0.monto_total_grupo || (g || []).reduce((s, gv) => s + (gv.monto_total_con_iva || gv.total || 0), 0) || 0
                            return (
                            <tr style={{ background: S.accentLight }}>
                              <td colSpan={11} style={{ padding: '1.25rem' }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: S.accent, textTransform: 'uppercase', marginBottom: 12 }}>G. Comercial — Multi-corral · {corralesNums}</div>
                                {renderFormGC(v0, true, g, v0.grupo_venta_id, montoTotalGCM, cargar, supabase)}
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
            {/* Archivadas ventas */}
            {(() => {
              const hoy40v = new Date(Date.now() - 40 * 86400000)
              const archivadasV = ventas.filter(v => new Date(v.creado_en) < hoy40v)
                .filter((v, i, arr) => !v.grupo_venta_id || arr.findIndex(x => x.grupo_venta_id === v.grupo_venta_id) === i)
              if (archivadasV.length === 0) return null
              return (
                <div style={{ marginTop: '1rem' }}>
                  <button onClick={() => setMostrarArchivadas(m => !m)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', fontSize: 12, fontWeight: 600, background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, cursor: 'pointer', color: S.muted, width: '100%' }}>
                    <span>📁</span>
                    <span>Archivadas ({archivadasV.length})</span>
                    <span style={{ marginLeft: 'auto' }}>{mostrarArchivadas ? '▲' : '▼'}</span>
                  </button>
                  {mostrarArchivadas && (
                    <div style={{ marginTop: 10, border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: S.bg }}>
                            {['Fecha', 'Corral', 'Anim.', 'Comprador', 'Kg netos', '$/kg', 'Total', ''].map(h => (
                              <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 10, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {archivadasV.map(v => {
                            const g = v.grupo_venta_id ? ventas.filter(vv => vv.grupo_venta_id === v.grupo_venta_id) : [v]
                            const totalA = v.grupo_venta_id ? (v.monto_total_grupo || (g || []).reduce((s,gv)=>s+(gv.monto_total_con_iva||gv.total||0),0)) : (v.monto_total_con_iva||v.total||0)
                            const corrStr = v.grupo_venta_id ? (g || []).map(gv=>`C-${gv.corrales?.numero||gv.corral_id}`).join(', ') : `C-${v.corrales?.numero||v.corral_id}`
                            const kgNeto = (g || []).reduce((s,gv)=>s+(gv.kg_neto||0),0)
                            const precioReal = kgNeto && (v.monto_facturado||v.monto_negro) ? Math.round(((v.monto_facturado||0)+(v.monto_negro||0))/kgNeto) : v.precio_kg
                            return (
                              <tr key={v.grupo_venta_id||v.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                                <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 11 }}>{new Date((v.fecha||v.creado_en?.split('T')[0]||v.creado_en)+'T12:00:00').toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'2-digit' })}</td>
                                <td style={{ padding: '7px 10px', fontWeight: 600 }}>{corrStr}{v.grupo_venta_id && <div style={{ fontSize: 10, color: S.muted }}>Multi-corral</div>}</td>
                                <td style={{ padding: '7px 10px' }}>{(g || []).reduce((s,gv)=>s+(gv.cantidad||0),0)}</td>
                                <td style={{ padding: '7px 10px' }}>{v.comprador||'—'}</td>
                                <td style={{ padding: '7px 10px', fontFamily: 'monospace' }}>{kgNeto > 0 ? kgNeto.toLocaleString('es-AR') : '—'}</td>
                                <td style={{ padding: '7px 10px', fontFamily: 'monospace' }}>{precioReal ? `$${precioReal.toLocaleString('es-AR')}` : '—'}</td>
                                <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontWeight: 600, color: totalA > 0 ? S.green : S.hint }}>{totalA > 0 ? `$${totalA.toLocaleString('es-AR')}` : '—'}</td>
                                <td style={{ padding: '7px 10px' }}>
                                  <button onClick={() => setEditandoVenta({ id: v.id, precio_kg: v.precio_kg ? String(v.precio_kg) : '', monto_total_con_iva: totalA ? String(totalA) : '', comprador: v.comprador||'', compradorNuevo: '', observaciones: v.observaciones||'', desbaste: String(v.desbaste_pct||8), plazo_dias: v.plazo_dias ? String(v.plazo_dias) : '' })}
                                    style={{ padding: '3px 8px', fontSize: 10, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 4, cursor: 'pointer' }}>✏️ Editar</button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })()}
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
                const kgNetoP3 = Math.round(corralesVenta.reduce((s, c) => s + (parseFloat(c.kg_vivo) || 0), 0) * (1 - (parseFloat(form.desbaste) || 8) / 100) * 10) / 10
                const montoTotal = Math.round(parseFloat(form.precio_kg || 0) * kgNetoP3 * 100) / 100
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

          {/* Banner completar datos G. Comercial */}
          {ventas.filter(v => (v.estado_comercial === 'pendiente_factura' || v.estado_comercial === 'precio_cargado' || v.estado_comercial === 'pendiente') && v.estado_comercial !== 'facturado').filter((v, i, arr) => !v.grupo_venta_id || arr.findIndex(x => x.grupo_venta_id === v.grupo_venta_id) === i).filter(v => !editandoComercial || editandoComercial === (v.grupo_venta_id || v.id)).length > 0 && (
            <div key={gcVersion} style={{ background: S.amberLight, border: '1px solid #EF9F27', borderRadius: 10, padding: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: S.amber, marginBottom: '1rem' }}>
                📋 Ventas pendientes de completar en G. Comercial
              </div>
              {ventas.filter(v => (v.estado_comercial === 'pendiente_factura' || v.estado_comercial === 'precio_cargado' || v.estado_comercial === 'pendiente') && v.estado_comercial !== 'facturado').filter((v, i, arr) => !v.grupo_venta_id || arr.findIndex(x => x.grupo_venta_id === v.grupo_venta_id) === i).filter(v => {
                const gcKey = v.grupo_venta_id || v.id
                return !editandoComercial || editandoComercial === gcKey
              }).map(v => {
                const isGroup = !!v.grupo_venta_id
                const grupo = isGroup ? ventas.filter(vv => vv.grupo_venta_id === v.grupo_venta_id) : [v]
                const totalAnimales = (grupo || []).reduce((s, gv) => s + (gv.cantidad || 0), 0)
                const montoTotal = isGroup ? (v.monto_total_grupo || (grupo || []).reduce((s, gv) => s + (gv.monto_total_con_iva || gv.total || 0), 0)) : (v.monto_total_con_iva || v.total || 0)
                const corralesStr = isGroup ? (grupo || []).map(gv => `C-${gv.corrales?.numero || gv.corral_id}`).join(', ') : `C-${v.corrales?.numero || v.corral_id}`
                const gcKey = isGroup ? v.grupo_venta_id : v.id
                const isEditGC = editandoComercial === gcKey
                return (
                  <div key={gcKey} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem', marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isEditGC ? '1rem' : 0 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{isGroup ? 'Venta multi-corral' : corralesStr} · {totalAnimales} animales</div>
                        <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>
                          {new Date((v.fecha || v.creado_en?.split('T')[0]) + 'T12:00:00').toLocaleDateString('es-AR')} · {v.comprador || '—'}
                          {montoTotal > 0 && ` · $${montoTotal.toLocaleString('es-AR')}`}
                        </div>
                      </div>
                      {!isEditGC && (
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12 }}>
                          <button onClick={() => { setEditandoComercial(gcKey); setFormComercial({ monto_facturado: montoTotal ? String(montoTotal) : '', iva_pct: '10.5', descuento_monto: '', descuento_descripcion: '', tiene_retencion: false, plazo_dias: v.plazo_dias ? String(v.plazo_dias) : '', fecha_vencimiento: v.fecha_vencimiento_cobro || '' }) }}
                            style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 6, cursor: 'pointer' }}>
                            ✏️ G. Comercial
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditGC && renderFormGC(v, isGroup, grupo, gcKey, montoTotal, cargar, supabase)}
                  </div>
                )
              })}
            </div>
          )}

          {ventas.filter(v => v.fecha_vencimiento_cobro && v.estado_comercial !== 'cobrado' && new Date(v.fecha_vencimiento_cobro) <= new Date(Date.now() + 7 * 86400000)).length > 0 && (
            <div style={{ background: S.redLight, border: '1px solid #F09595', borderRadius: 8, padding: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: S.red, marginBottom: 6 }}>Vencimientos proximos - 7 dias</div>
              {ventas.filter(v => v.fecha_vencimiento_cobro && v.estado_comercial !== 'cobrado' && new Date(v.fecha_vencimiento_cobro) <= new Date(Date.now() + 7 * 86400000)).map(v => (
                <div key={v.id} style={{ fontSize: 12, color: S.red, marginBottom: 2 }}>C-{v.corrales?.numero} - {v.comprador || 'Sin comprador'} - vence {new Date(v.fecha_vencimiento_cobro + 'T12:00:00').toLocaleDateString('es-AR')}</div>
              ))}
            </div>
          )}

          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <select value={filtroGestion} onChange={e => setFiltroGestion(e.target.value)}
              style={{ padding: '7px 12px', fontSize: 12, border: '1px solid #E2DDD6', borderRadius: 6, background: '#fff', color: filtroGestion ? '#1A3D6B' : '#6B6760', fontWeight: filtroGestion ? 600 : 400 }}>
              <option value="">Todos los compradores</option>
              {compradores.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {filtroGestion && <button onClick={() => setFiltroGestion('')} style={{ padding: '6px 8px', fontSize: 11, background: 'transparent', border: '1px solid #E2DDD6', color: '#6B6760', borderRadius: 6, cursor: 'pointer' }}>✕</button>}
          </div>
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
                  const hoy40g = new Date(Date.now() - 40 * 86400000)
                  const vistos = new Set()
                  return ventas.filter(v => {
                    // Excluir archivadas (cobradas y más de 40 días)
                    if (v.estado_comercial === 'cobrado' && new Date(v.creado_en) < hoy40g) return false
                    if (filtroGestion && v.comprador !== filtroGestion) return false
                    if (v.grupo_venta_id) {
                      if (vistos.has(v.grupo_venta_id)) return false
                      vistos.add(v.grupo_venta_id)
                    }
                    return true
                  }).map(v => {
                    const esGrupo = !!v.grupo_venta_id
                    const grupo = esGrupo ? ventas.filter(vv => vv.grupo_venta_id === v.grupo_venta_id) : [v]
                    const totalGrupo = (grupo || []).reduce((s, vv) => s + (vv.total || 0), 0)
                    const totalFact = (grupo || []).reduce((s, vv) => s + (vv.monto_facturado || 0), 0)
                    const totalNegro = (grupo || []).reduce((s, vv) => s + (vv.monto_negro || 0), 0)
                    const totalIva = (grupo || []).reduce((s, vv) => s + (vv.iva_monto || 0), 0)
                    const totalCom = (grupo || []).reduce((s, vv) => s + ((!vv.comision_es_paralela && vv.comision_monto) ? vv.comision_monto : 0), 0)
                    const totalRet = (grupo || []).reduce((s, vv) => s + (vv.retencion_monto || 0), 0)
                    const netoACobrarGrupo = totalGrupo - totalCom - totalRet
                    const corralesStr = esGrupo ? (grupo || []).map(vv => `C-${vv.corrales?.numero}`).join(', ') : `C-${v.corrales?.numero}`
                    const pagosList = (grupo || []).flatMap(vv => (pagosVenta && pagosVenta[vv.id]) || [])
                    const totalPagado = pagosList.reduce((s, p) => s + (p.monto || 0), 0)
                    const saldo = totalGrupo - totalPagado
                    const rowKey = esGrupo ? v.grupo_venta_id : v.id
                    const isReg = registrandoPago === rowKey
                    const ec = { pendiente: { bg: '#FDF0E0', color: '#7A4500' }, precio_cargado: { bg: '#E8EFF8', color: '#1A3D6B' }, facturado: { bg: '#F0EAFB', color: '#3D1A6B' }, cobrado: { bg: '#E8F4EB', color: '#1E5C2E' } }[v.estado_comercial] || { bg: '#F7F5F0', color: '#6B6760' }
                    const venceProx = v.fecha_vencimiento_cobro && v.estado_comercial !== 'cobrado' && new Date(v.fecha_vencimiento_cobro) <= new Date(Date.now() + 7 * 86400000)
                    return (
                      <React.Fragment key={rowKey}>
                      <tr style={{ borderBottom: '1px solid #E2DDD6', background: esGrupo ? S.accentLight : venceProx ? '#FFF5F5' : 'transparent' }}>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 11 }}>{new Date((v.fecha || v.creado_en?.split('T')[0] || v.creado_en) + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
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
                        <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                          <button onClick={() => { const mt = v.monto_total_con_iva || v.total || 0; setEditandoComercial(rowKey); setFormComercial({ monto_facturado: v.monto_facturado ? String(v.monto_facturado) : String(mt), iva_pct: v.iva_pct || '10.5', descuento_monto: v.descuento_monto ? String(v.descuento_monto) : '', descuento_descripcion: v.descuento_descripcion || '', tiene_retencion: v.tiene_retencion || false, plazo_dias: v.plazo_dias ? String(v.plazo_dias) : '', fecha_vencimiento: v.fecha_vencimiento_cobro || '' }) }}
                            style={{ padding: '3px 8px', fontSize: 10, fontWeight: 600, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            ✏️ Editar
                          </button>
                        </td>
                        <td style={{ padding: '7px 10px', minWidth: 160 }}>
                          <button onClick={() => setPagosExpandidos(prev => ({...prev, [rowKey]: !prev[rowKey]}))}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '6px 10px', fontSize: 11, fontWeight: 600, borderRadius: 5, cursor: 'pointer', border: `1px solid ${saldo > 0 ? '#F09595' : '#1E5C2E'}`, background: saldo > 0 ? '#FDF0F0' : '#E8F4EB', color: saldo > 0 ? '#7A1A1A' : '#1E5C2E' }}>
                            {saldo > 0 ? `Saldo $${Math.round(saldo).toLocaleString('es-AR')}` : pagosList.length > 0 ? '✓ Cobrado' : '— Sin pagos —'}
                            <span style={{ fontSize: 9 }}>{pagosExpandidos[rowKey] ? '▲' : '▼'}</span>
                          </button>
                        </td>
                      </tr>

                      {pagosExpandidos[rowKey] && (
                        <tr style={{ background: S.bg }}>
                          <td colSpan={20} style={{ padding: 0, borderBottom: `1px solid ${S.border}` }}>
                            <div style={{ padding: '1.25rem' }}>
                              <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>Pagos realizados</div>
                              {pagosList.length === 0 && <div style={{ fontSize: 13, color: S.hint, marginBottom: 12 }}>Sin pagos registrados.</div>}
                              {pagosList.length > 0 && (
                                <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 6, overflow: 'hidden', marginBottom: 12, maxWidth: 480 }}>
                                  {pagosList.map((p, pi) => (
                                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderBottom: pi < pagosList.length - 1 ? `1px solid ${S.border}` : 'none' }}>
                                      <span style={{ fontSize: 13 }}>{p.forma_pago}{p.numero_cheque ? ` #${p.numero_cheque}` : ''}{p.es_paralela ? ' · paralelo' : ''}</span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ fontSize: 13, fontFamily: 'monospace' }}>${p.monto?.toLocaleString('es-AR')}</span>
                                        <button onClick={async () => { await supabase.from('pagos_ventas').delete().eq('id', p.id); await cargar() }} style={{ background: 'none', border: 'none', color: '#7A1A1A', cursor: 'pointer', fontSize: 14 }}>✕</button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {!isReg ? (
                              <button onClick={() => { setRegistrandoPago(rowKey); setFormPago({ monto: saldo > 0 ? String(Math.round(saldo)) : '', forma_pago: 'transferencia', fecha: new Date().toISOString().split('T')[0], numero_cheque: '', banco: '', fecha_cobro_cheque: '', fecha_vencimiento_cheque: '', es_paralela: false, observaciones: '' }) }}
                                style={{ fontSize: 10, padding: '3px 8px', background: '#E8EFF8', border: '1px solid #1A3D6B', color: '#1A3D6B', borderRadius: 4, cursor: 'pointer', width: '100%' }}>
                                + Registrar pago
                              </button>
                            ) : null}
                            {isReg && (
                              <div style={{ marginTop: 12 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
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
                                  {/* Cheque recibido - datos del cheque que nos entregan */}
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
                      )}
                      {editandoComercial === rowKey && (
                        <tr style={{ background: S.accentLight }}>
                          <td colSpan={20} style={{ padding: '1.25rem' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: S.accent, textTransform: 'uppercase', marginBottom: 12 }}>G. Comercial — {corralesStr}</div>
                            {renderFormGC(v, v.grupo_venta_id ? true : false, grupo, rowKey, v.monto_total_con_iva || v.total || 0, cargar, supabase)}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                    )
                  })
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ARCHIVADAS */}
      {tab === 'gestion' && (() => {
        const hoy40 = new Date(Date.now() - 40 * 86400000)
        const archivadas = ventas.filter(v => {
          if (v.estado_comercial !== 'cobrado') return false
          const fecha = new Date(v.creado_en)
          return fecha < hoy40
        }).filter((v, i, arr) => !v.grupo_venta_id || arr.findIndex(x => x.grupo_venta_id === v.grupo_venta_id) === i)
        if (archivadas.length === 0) return null
        const archFiltradas = archivadas.filter(v => {
          if (filtroArchivadas.comprador && !((v.comprador || '').toLowerCase().includes(filtroArchivadas.comprador.toLowerCase()))) return false
          if (filtroArchivadas.desde && v.creado_en < filtroArchivadas.desde) return false
          if (filtroArchivadas.hasta && v.creado_en > filtroArchivadas.hasta + 'T23:59:59') return false
          return true
        })
        return (
          <div style={{ marginTop: '1.5rem' }}>
            <button onClick={() => setMostrarArchivadas(m => !m)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, cursor: 'pointer', color: S.muted, width: '100%' }}>
              <span>📁</span>
              <span>Archivadas ({archivadas.length})</span>
              <span style={{ marginLeft: 'auto' }}>{mostrarArchivadas ? '▲' : '▼'}</span>
            </button>
            {mostrarArchivadas && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <input type="text" placeholder="Filtrar por comprador..." value={filtroArchivadas.comprador}
                    onChange={e => setFiltroArchivadas(f => ({...f, comprador: e.target.value}))}
                    style={{ flex: 1, padding: '7px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 12, background: S.surface }} />
                  <input type="date" value={filtroArchivadas.desde} onChange={e => setFiltroArchivadas(f => ({...f, desde: e.target.value}))}
                    style={{ padding: '7px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 12, background: S.surface }} />
                  <input type="date" value={filtroArchivadas.hasta} onChange={e => setFiltroArchivadas(f => ({...f, hasta: e.target.value}))}
                    style={{ padding: '7px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 12, background: S.surface }} />
                  {(filtroArchivadas.comprador || filtroArchivadas.desde || filtroArchivadas.hasta) && (
                    <button onClick={() => setFiltroArchivadas({ comprador: '', desde: '', hasta: '' })}
                      style={{ padding: '7px 12px', fontSize: 12, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 6, cursor: 'pointer' }}>✕ Limpiar</button>
                  )}
                </div>
                <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
                  {archFiltradas.length === 0
                    ? <div style={{ padding: '2rem', textAlign: 'center', color: S.hint, fontSize: 13 }}>Sin resultados</div>
                    : archFiltradas.map(v => {
                      const grupo = v.grupo_venta_id ? ventas.filter(vv => vv.grupo_venta_id === v.grupo_venta_id) : [v]
                      const totalArch = v.grupo_venta_id ? (v.monto_total_grupo || (grupo || []).reduce((s,gv)=>s+(gv.monto_total_con_iva||gv.total||0),0)) : (v.monto_total_con_iva||v.total||0)
                      const corrStr = v.grupo_venta_id ? (grupo || []).map(gv=>`C-${gv.corrales?.numero||gv.corral_id}`).join(', ') : `C-${v.corrales?.numero||v.corral_id}`
                      return (
                        <div key={v.grupo_venta_id || v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: `1px solid ${S.border}` }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{corrStr} · {v.comprador || '—'}</div>
                            <div style={{ fontSize: 11, color: S.muted }}>{new Date((v.fecha||v.creado_en?.split('T')[0]||v.creado_en)+'T12:00:00').toLocaleDateString('es-AR')} · {(grupo || []).reduce((s,gv)=>s+(gv.cantidad||0),0)} animales</div>
                          </div>
                          <div style={{ fontFamily: 'monospace', fontWeight: 700, color: S.green, fontSize: 14 }}>
                            {totalArch > 0 ? `$${totalArch.toLocaleString('es-AR')}` : '—'}
                          </div>
                        </div>
                      )
                    })
                  }
                </div>
              </div>
            )}
          </div>
        )
      })()}


    </div>
  )
}  