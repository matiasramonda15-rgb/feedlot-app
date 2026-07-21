import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { hoyLocal, fechaLocal } from '../shared/dateUtils'
import { registrarServicioTercero } from '../shared/serviciosLogic'
import { PAGO_INIT, ListaPagos } from './PagoFormulario'

const CM = { bg: '#0D1B2A', surface: '#1A2D3D', surface2: '#243447', border: '#2D4357', text: '#E8F0F8', muted: '#7A9AB8', accent: '#5BB8F5', green: '#4CAF82', greenLight: '#1A3D2E', amber: '#F5A623', amberLight: '#3D2E1A', red: '#F55B5B', mono: "'IBM Plex Mono', monospace", sans: "'IBM Plex Sans', sans-serif" }
function MobileTopbar({ titulo, sub, onBack }) {
  return (
    <div style={{ background: CM.surface, padding: '1rem', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, borderBottom: `1px solid ${CM.border}` }}>
      {onBack && <button onClick={onBack} style={{ background: 'none', border: 'none', color: CM.accent, fontSize: 22, cursor: 'pointer', padding: 0, lineHeight: 1 }}>‹</button>}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: CM.text }}>{titulo}</div>
        {sub && <div style={{ fontSize: 11, color: CM.muted, marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  )
}
function MobileScroll({ children }) {
  return <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', background: CM.bg, color: CM.text }}>{children}</div>
}

const S = {
  bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6',
  text: '#1A1916', muted: '#6B6760', hint: '#9E9A94',
  accent: '#1A3D6B', accentLight: '#E8EFF8',
  green: '#1E5C2E', greenLight: '#E8F4EB',
  amber: '#7A4500', amberLight: '#FDF0E0',
  red: '#7A1A1A', redLight: '#FDF0F0',
  purple: '#4A1A7A', purpleLight: '#F0E8F8',
}
const inp = { width: '100%', padding: '8px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: "'IBM Plex Sans', sans-serif", color: S.text }
const inpMono = { ...inp, fontFamily: 'monospace' }
const th = { padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap', background: S.bg }
const td_ = { padding: '8px 10px', fontSize: 13, borderBottom: `1px solid ${S.border}`, verticalAlign: 'middle' }

function Lbl({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{children}</div>
}

// campanas cargadas dinámicamente desde Supabase
const LABORES = ['Siembra', 'Cosecha', 'Pulverización', 'Fertilización', 'Roturación', 'Rastreo', 'Flete', 'Otro']
const CULTIVOS = ['Maíz', 'Soja', 'Trigo', 'Sorgo', 'Girasol', 'Cebada', 'Otro']

export default function Servicios({ usuario, mobile, nav }) {
  const [tab, setTab] = useState('servicios')
  const [loading, setLoading] = useState(true)
  const [campanas, setCampanas] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [showNuevaCampana, setShowNuevaCampana] = useState(false)
  const [nuevaCampana, setNuevaCampana] = useState('')
  const [servicios, setServicios] = useState([])
  const [manoObra, setManoObra] = useState({})
  const [contactos, setContactos] = useState([])
  const [chequesCartera, setChequesCartera] = useState([])
  const [registros, setRegistros] = useState([])
  const [campos, setCampos] = useState([])
  const [stockAgro, setStockAgro] = useState([])
  const [descargasReg, setDescargasReg] = useState({})
  // Estado propio del modo celular
  const [tabM, setTabM] = useState('servicio')
  const [formM, setFormM] = useState({ campania: '', tipo_servicio: 'tercero', cliente: '', clienteNuevo: '', labor: 'Siembra', cultivo: 'Maíz', campo: '', nro_lote: '', fecha: hoyLocal(), hectareas: '', empleado1: '', empleado2: '', observaciones: '', esParaAgricultura: false, campo_id: '', lote_id: '', campana_id: '', costo_total: '', productos: [] })
  const [guardandoM, setGuardandoM] = useState(false)
  const [okM, setOkM] = useState('')
  const [registroActivoM, setRegistroActivoM] = useState(null)
  const [showFormRegM, setShowFormRegM] = useState(false)
  const [formRegM, setFormRegM] = useState({ campo: '', cliente: '', nro_lote: '', cultivo: 'Maíz', fecha: hoyLocal() })
  const [formDescM, setFormDescM] = useState({ tipo: 'camion', patente: '', kg: '', observaciones: '', fecha: hoyLocal() })
  const [guardandoDescM, setGuardandoDescM] = useState(false)
  const [guardandoRegM, setGuardandoRegM] = useState(false)
  const [editandoDescIdM, setEditandoDescIdM] = useState(null)
  const [editDescKgM, setEditDescKgM] = useState('')
  const [editDescPatenteM, setEditDescPatenteM] = useState('')
  const [editandoSvcIdM, setEditandoSvcIdM] = useState(null)
  const [editSvcM, setEditSvcM] = useState({})

  // Filtros
  const [filtros, setFiltros] = useState({ campania: '', cliente: '', labor: '', cultivo: '', tipo: '', estado: '', empleado: '' })

  // Form nuevo servicio
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ campania: campanas[0]?.nombre || '2025/26', cliente: '', clienteNuevo: '', labor: 'Siembra', cultivo: 'Maíz', tipo_servicio: 'tercero', campo: '', nro_lote: '', fecha: hoyLocal(), hectareas: '', empleado1: '', empleado2: '', observaciones: '', esParaAgricultura: false, campo_id: '', lote_id: '', campana_id: '', costo_total: '', productos: [] })
  const [guardando, setGuardando] = useState(false)

  // Mano de obra
  const [configMO, setConfigMO] = useState([]) // config_mano_obra
  const [manoObraOpen, setManoObraOpen] = useState(null)
  const [guardandoConfigMO, setGuardandoConfigMO] = useState(false)
  const [filtrosMO, setFiltrosMO] = useState({ campania: '', labor: '', cultivo: '', tipo: '', estado: '', empleado: '' })
  const [seleccionadasMO, setSeleccionadasMO] = useState([])
  const [showPagoMO, setShowPagoMO] = useState(false)
  const [formPagoMO, setFormPagoMO] = useState({ fecha: hoyLocal(), iva_pct: '10.5', pagos: [{ ...PAGO_INIT }] })
  const [guardandoPagoMO, setGuardandoPagoMO] = useState(false)
  const [pctPagoMO, setPctPagoMO] = useState({}) // { [servicio_id]: pct } editable en el banner
  const [formMO, setFormMO] = useState({ trabajador: '', rol: 'Maquinista', porcentaje: '' })
  const [guardandoMO, setGuardandoMO] = useState(false)
  const [subTabMO, setSubTabMO] = useState('')
  const [filtroEmpleadoMO, setFiltroEmpleadoMO] = useState('')

  // Pago
  const [seleccionadas, setSeleccionadas] = useState([])
  const [showPago, setShowPago] = useState(false)
  const [formPago, setFormPago] = useState({ fecha: hoyLocal(), iva_pct: '10.5', precio_ha: '', sin_factura: '', pagos: [{ ...PAGO_INIT }] })
  const [guardandoPago, setGuardandoPago] = useState(false)
  const reciboRef = useRef(null)

  // Editar
  const [editandoId, setEditandoId] = useState(null)
  const [formEdit, setFormEdit] = useState({})

  // Descargas mercadería
  const [registroActivo, setRegistroActivo] = useState(null)
  const [showFormReg, setShowFormReg] = useState(false)
  const [formReg, setFormReg] = useState({ campo: '', cliente: '', nro_lote: '', cultivo: 'Maíz', fecha: hoyLocal() })
  const [formDescargaReg, setFormDescargaReg] = useState({ tipo: 'camion', patente: '', kg: '', observaciones: '', fecha: hoyLocal() })
  const [guardandoReg, setGuardandoReg] = useState(false)
  const [guardandoDescargaReg, setGuardandoDescargaReg] = useState(false)

  const esBrian = usuario?.nombre?.toLowerCase().includes('brian') || usuario?.email?.toLowerCase().includes('brian')

  const TABS = esBrian
    ? [{ key: 'mercaderia', label: '📦 Mercadería' }]
    : [
        { key: 'servicios', label: 'Servicios' },
        { key: 'mano_obra', label: 'Mano de obra' },
        { key: 'mercaderia', label: '📦 Mercadería' },
      ]

  useEffect(() => {
    if (esBrian) setTab('mercaderia')
    cargar()
  }, [])

  useEffect(() => {
    if (!mobile) return
    setTabM(esBrian ? 'mercaderia' : 'servicio')
  }, [mobile, esBrian])

  useEffect(() => {
    if (mobile && campanas.length > 0 && !formM.campania) setFormM(f => ({...f, campania: campanas[0].nombre}))
  }, [campanas, mobile])

  async function cargar() {
    const { data: camps } = await supabase.from('campanas').select('*').eq('activa', true).order('nombre', { ascending: false })
    setCampanas(camps || [])
    const { data: emps } = await supabase.from('empleados').select('*').eq('activo', true).order('nombre')
    setEmpleados(emps || [])
    const [{ data: s }, { data: ct }, { data: ch }, { data: regs }, { data: cps }, { data: sa }] = await Promise.all([
      supabase.from('servicios_terceros').select('*').order('fecha', { ascending: false }),
      supabase.from('contactos').select('id, nombre').order('nombre'),
      supabase.from('cheques').select('*').eq('tipo', 'recibido').eq('estado', 'en_cartera'),
      supabase.from('registros_mercaderia').select('*').order('created_at', { ascending: false }),
      supabase.from('campos').select('*, lotes_agricolas(id, numero, superficie_ha)').eq('activo', true).order('nombre'),
      supabase.from('stock_agro').select('*').order('insumo'),
    ])
    setServicios(s || [])
    setContactos(ct || [])
    setChequesCartera(ch || [])
    setRegistros(regs || [])
    setCampos(cps || [])
    setStockAgro(sa || [])
    // Cargar config mano de obra
    const { data: cmo } = await supabase.from('config_mano_obra').select('*').eq('activo', true).order('id')
    setConfigMO(cmo || [])
    // Cargar mano de obra de todos los servicios
    if (s && s.length > 0) {
      const { data: mo } = await supabase.from('mano_obra_servicios').select('*').in('servicio_id', s.map(x => x.id))
      const moMap = {}
      ;(mo || []).forEach(m => {
        if (!moMap[m.servicio_id]) moMap[m.servicio_id] = []
        moMap[m.servicio_id].push(m)
      })
      setManoObra(moMap)
    }
    setLoading(false)
  }

  // Carga jsPDF una sola vez (desde un CDN, no hace falta instalar nada) —
  // se usa para el botón "Descargar PDF" del registro de mercadería, así
  // se puede compartir el archivo por WhatsApp sin pasar por el diálogo
  // de imprimir del navegador (que en Edge no siempre deja guardar como PDF).
  async function cargarJsPDF() {
    if (window.jspdf) return window.jspdf.jsPDF
    await new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })
    return window.jspdf.jsPDF
  }

  async function descargarPDFMercaderia(reg, desc, kgCamion, kgBolsa, kgOtro, kgTotal) {
    const JsPDF = await cargarJsPDF()
    const doc = new JsPDF()
    doc.setFontSize(16); doc.text('Registro de Mercadería', 14, 18)
    doc.setFontSize(10); doc.setTextColor(107, 103, 96)
    doc.text(`Campo: ${reg.campo}  ·  Cliente: ${reg.cliente || '—'}  ·  Lote: ${reg.nro_lote || '—'}  ·  Cultivo: ${reg.cultivo || '—'}`, 14, 26)
    let y = 38
    doc.setFontSize(9); doc.setTextColor(26, 25, 22)
    doc.setFillColor(247, 245, 240)
    doc.rect(14, y - 5, 182, 8, 'F')
    doc.text('Fecha', 16, y); doc.text('Tipo', 55, y); doc.text('Patente / Detalle', 95, y); doc.text('Kg', 188, y, { align: 'right' })
    y += 8
    desc.forEach(d => {
      const fechaStr = d.fecha ? new Date(d.fecha + 'T12:00:00').toLocaleDateString('es-AR') : '—'
      const tipoStr = d.tipo === 'camion' ? 'Camión' : d.tipo === 'bolsa' ? 'Bolsa' : 'Otro'
      doc.text(fechaStr, 16, y); doc.text(tipoStr, 55, y); doc.text(String(d.patente || d.observaciones || '—'), 95, y)
      doc.text(`${(d.kg || 0).toLocaleString('es-AR')} kg`, 188, y, { align: 'right' })
      y += 7
      if (y > 270) { doc.addPage(); y = 20 }
    })
    y += 4
    doc.setDrawColor(226, 221, 214); doc.line(14, y, 196, y)
    y += 10
    doc.setFontSize(11); doc.setFont(undefined, 'bold')
    doc.text('Resumen', 14, y); y += 8
    doc.setFont(undefined, 'normal'); doc.setFontSize(10)
    if (kgCamion > 0) { doc.text(`Camión: ${kgCamion.toLocaleString('es-AR')} kg`, 14, y); y += 7 }
    if (kgBolsa > 0) { doc.text(`Bolsa: ${kgBolsa.toLocaleString('es-AR')} kg`, 14, y); y += 7 }
    if (kgOtro > 0) { doc.text(`Otro: ${kgOtro.toLocaleString('es-AR')} kg`, 14, y); y += 7 }
    doc.setFont(undefined, 'bold')
    doc.text(`Total: ${kgTotal.toLocaleString('es-AR')} kg`, 14, y + 3)
    doc.save(`Mercaderia_${reg.campo.replace(/\s+/g, '_')}.pdf`)
  }

  async function cargarDescargasReg(regId) {
    const { data } = await supabase.from('descargas_mercaderia').select('*').eq('registro_id', regId).order('creado_en')
    setDescargasReg(prev => ({ ...prev, [regId]: data || [] }))
  }

  async function guardar() {
    if (!form.labor || !form.hectareas) { alert('Completá labor y hectáreas'); return }
    if (form.tipo_servicio === 'tercero' && !form.cliente) { alert('Ingresá el cliente'); return }
    if (form.esParaAgricultura && !form.campo_id) { alert('Seleccioná el campo de Agricultura'); return }
    setGuardando(true)
    const clienteTexto = form.tipo_servicio === 'propio' ? null : form.cliente
    const costoNum = form.esParaAgricultura ? (parseFloat(form.costo_total) || null) : null
    const { data: servicioCreado, error } = await registrarServicioTercero(supabase, {
      campania: form.campania, tipoServicio: form.tipo_servicio, cliente: clienteTexto,
      labor: form.labor, cultivo: form.cultivo,
      campo: form.esParaAgricultura ? (campos.find(c => c.id === parseInt(form.campo_id))?.nombre || '') : form.campo,
      nroLote: form.esParaAgricultura ? (campos.find(c => c.id === parseInt(form.campo_id))?.lotes_agricolas?.find(l => l.id === parseInt(form.lote_id))?.numero || '') : form.nro_lote,
      fecha: form.fecha, hectareas: form.hectareas,
      empleado1: form.empleado1, empleado2: form.empleado2, observaciones: form.observaciones,
      total: costoNum, precioHa: (costoNum && form.hectareas) ? Math.round(costoNum / parseFloat(form.hectareas)) : null,
      // El precio no siempre lo carga quien registra el trabajo — si todavía
      // no se sabe, queda pendiente para completarlo después desde la oficina.
      estadoPago: (form.esParaAgricultura && costoNum) ? 'pagado' : 'pendiente',
    })
    if (error) { alert('Error: ' + error.message); setGuardando(false); return }

    // Si es para un lote de Agricultura, se refleja del otro lado como una
    // orden de trabajo — con el mismo costo (sin duplicar caja: acá no se
    // registró ningún movimiento) y descontando del stock los productos usados.
    // Si todavía no hay precio, los dos quedan "pendiente" hasta completarlo.
    if (form.esParaAgricultura) {
      const tipoOrdenMap = { 'Siembra': 'Siembra', 'Cosecha': 'Cosecha', 'Pulverización': 'Pulverizacion', 'Fertilización': 'Fertilizacion', 'Roturación': 'Labranza', 'Rastreo': 'Labranza', 'Flete': 'Otro', 'Otro': 'Otro' }
      const productosValidos = form.productos.filter(p => p.id && parseFloat(p.total) > 0)
      const { data: ordenCreada, error: errOrden } = await supabase.from('ordenes_trabajo').insert({
        campo_id: parseInt(form.campo_id), lote_id: form.lote_id ? parseInt(form.lote_id) : null,
        campana_id: form.campana_id ? parseInt(form.campana_id) : null,
        tipo: tipoOrdenMap[form.labor] || 'Otro', fecha: form.fecha,
        descripcion: `Cargado desde Servicios — ${form.labor}`,
        proveedor: null, es_propia: true,
        superficie_ha: parseFloat(form.hectareas) || null,
        productos: productosValidos.map(p => ({ id: p.id, total: p.total })),
        costo_total: costoNum, costo_ha: (costoNum && form.hectareas) ? Math.round(costoNum / parseFloat(form.hectareas)) : null,
        estado: 'completado', estado_pago: costoNum ? 'pagado' : 'pendiente',
        observaciones: `Servicio interno #${servicioCreado?.id} — usa maquinaria de Servicios`,
        registrado_por: usuario?.id,
      }).select().single()
      if (errOrden) {
        alert('El servicio se guardó, pero no se pudo reflejar en Agricultura: ' + errOrden.message)
      } else {
        // Vincular servicio ↔ orden para poder completar el precio después, en los dos a la vez
        await supabase.from('servicios_terceros').update({ orden_trabajo_id: ordenCreada?.id }).eq('id', servicioCreado?.id)
        // Descontar del stock de Agricultura cada producto usado (esto pasa
        // siempre, tenga precio o no — el insumo se usó físicamente igual)
        for (const p of productosValidos) {
          await supabase.rpc('incrementar_stock_agro', { p_id: parseInt(p.id), p_delta: -parseFloat(p.total) })
        }
      }
    }

    setShowForm(false)
    setForm({ campania: campanas[0]?.nombre || '2025/26', cliente: '', labor: 'Siembra', cultivo: 'Maíz', tipo_servicio: 'tercero', campo: '', nro_lote: '', fecha: hoyLocal(), hectareas: '', empleado1: '', empleado2: '', observaciones: '', esParaAgricultura: false, campo_id: '', lote_id: '', campana_id: '', costo_total: '', productos: [] })
    setGuardando(false)
    await cargar()
  }

  async function guardarEdit() {
    const { error } = await supabase.from('servicios_terceros').update({
      campania: formEdit.campania,
      cliente: formEdit.cliente,
      labor: formEdit.labor,
      cultivo: formEdit.cultivo,
      tipo_servicio: formEdit.tipo_servicio,
      campo: formEdit.campo || null,
      nro_lote: formEdit.nro_lote || null,
      fecha: formEdit.fecha,
      hectareas: parseFloat(formEdit.hectareas),
      empleado1: formEdit.empleado1 || null,
      empleado2: formEdit.empleado2 || null,
    }).eq('id', editandoId)
    if (error) { alert('Error al guardar los cambios: ' + error.message); return }
    setEditandoId(null)
    await cargar()
  }

  async function guardarMO(servicioId, s) {
    if (!formMO.trabajador || !formMO.porcentaje) { alert('Completá trabajador y %'); return }
    setGuardandoMO(true)
    const pct = parseFloat(formMO.porcentaje)
    const monto = s.precio_ha && s.hectareas ? Math.round(s.precio_ha * s.hectareas * pct / 100) : null
    const { error } = await supabase.from('mano_obra_servicios').insert({ servicio_id: servicioId, trabajador: formMO.trabajador, rol: formMO.rol, porcentaje: pct, monto_calculado: monto })
    if (error) { alert('Error al guardar la mano de obra: ' + error.message); setGuardandoMO(false); return }
    setFormMO({ trabajador: '', rol: 'Maquinista', porcentaje: '' })
    setGuardandoMO(false)
    await cargar()
  }

  async function registrarPago() {
    if (seleccionadas.length === 0) { alert('Seleccioná al menos un servicio'); return }
    // Si no se cargó ningún monto en "Formas de pago" (por ejemplo, si solo
    // se completó el precio/ha pensando que con eso alcanzaba), no hay que
    // dejar pasar el cobro — quedaría marcado como cobrado sin que entre
    // nada a ninguna caja.
    const hayAlgunPago = formPago.pagos.some(p => parseFloat(p.monto) > 0)
    if (!hayAlgunPago) { alert('No cargaste ningún monto en "Formas de pago" — completá al menos uno antes de confirmar, o el cobro va a quedar marcado sin que se registre nada en caja.'); return }
    setGuardandoPago(true)
    try {
      const ivaPct = parseFloat(formPago.iva_pct) || 0
      const sinFactura = parseFloat(formPago.sin_factura) || 0
      for (const id of seleccionadas) {
        const s = servicios.find(x => x.id === id)
        if (!s) continue
        const precioHa = formPago.precio_ha ? parseFloat(formPago.precio_ha) : s.precio_ha
        const totalNeto = precioHa && s.hectareas ? Math.round(precioHa * s.hectareas) : s.total || 0
        const totalConIva = Math.round(totalNeto * (1 + ivaPct / 100))
        const desc = `Servicio ${s.labor} ${s.cultivo ? `(${s.cultivo})` : ''} — ${s.cliente} · ${s.campo || ''} · ${s.hectareas} ha`
        let caja_oficial_id = null, caja_paralela_id = null
        for (const p of formPago.pagos.filter(p => p.monto)) {
          const monto = parseFloat(p.monto) || 0
          if (!monto) continue
          if (p.tipo === 'canje') continue  // canje: no toca caja, se compensa solo en Contactos
          let pagoCajaId = null
          if (p.es_paralelo) {
            const { data: cp, error: ep } = await supabase.from('caja_paralela').insert({ fecha: formPago.fecha, tipo: 'ingreso', descripcion: desc, monto }).select().single()
            if (ep) { alert('Error al registrar Caja 2: ' + ep.message); setGuardandoPago(false); return }
            caja_paralela_id = cp?.id
            pagoCajaId = cp?.id
          } else {
            const { data: co, error: eo } = await supabase.from('caja_oficial').insert({ fecha: formPago.fecha, tipo: 'ingreso', categoria: 'Servicios a terceros', descripcion: desc, monto, forma_pago: p.subtipo_cheque || p.tipo }).select().single()
            if (eo) { alert('Error al registrar caja oficial: ' + eo.message); setGuardandoPago(false); return }
            caja_oficial_id = co?.id
            pagoCajaId = co?.id
          }
          // En un cobro, cualquier cheque que se recibe es siempre "de otro"
          // (no tiene sentido "propio/tercero" cuando estamos cobrando) — se
          // registra directo en cartera con sus datos.
          if ((p.tipo === 'cheque' || p.tipo === 'e-cheq') && p.cheque_propio?.fecha_vencimiento) {
            const { error: eCheq } = await supabase.from('cheques').insert({
              tipo: 'recibido', numero: p.cheque_propio.numero || null, banco: p.cheque_propio.banco || null,
              monto, fecha_emision: formPago.fecha, fecha_vencimiento: p.cheque_propio.fecha_vencimiento,
              librador: s.cliente || null, estado: 'en_cartera', es_paralelo: p.es_paralelo || false,
              es_electronico: p.tipo === 'e-cheq', caja_oficial_id, caja_paralela_id,
            })
            if (eCheq) alert('El cobro se registró, pero no se pudo guardar el cheque en cartera: ' + eCheq.message)
          }
        }
        const updateData = {
          iva_pct: ivaPct || null,
          estado: 'cobrado',
          estado_pago: 'cobrado',
          fecha_cobro: formPago.fecha,
          caja_oficial_id,
          caja_paralela_id,
          monto_negro: sinFactura > 0 ? sinFactura : null,
          pagos_detalle: formPago.pagos,
        }
        if (precioHa) updateData.precio_ha = precioHa
        if (totalConIva > 0) updateData.total = totalConIva
        const { error: eu } = await supabase.from('servicios_terceros').update(updateData).eq('id', id)
        if (eu) { alert('Error al actualizar servicio: ' + eu.message); setGuardandoPago(false); return }
      }
      setSeleccionadas([])
      setShowPago(false)
      setFormPago({ fecha: hoyLocal(), iva_pct: '10.5', precio_ha: '', sin_factura: '', pagos: [{ ...PAGO_INIT }] })
      await cargar()
    } catch(e) {
      alert('Error inesperado: ' + e.message)
    } finally {
      setGuardandoPago(false)
    }
  }

  function imprimirRecibo() {
    const win = window.open('', '_blank')
    const ivaPct = parseFloat(formPago.iva_pct) || 0
    const rows = seleccionadas.map(id => {
      const s = servicios.find(x => x.id === id)
      const precioHa = formPago.precio_ha ? parseFloat(formPago.precio_ha) : s?.precio_ha
      const neto = precioHa && s?.hectareas ? Math.round(precioHa * s.hectareas) : (s?.total || 0)
      const conIva = Math.round(neto * (1 + ivaPct / 100))
      return `<tr><td>${s?.fecha || ''}</td><td>${s?.campo || ''}${s?.nro_lote ? ' · ' + s.nro_lote : ''}</td><td>${s?.labor} ${s?.cultivo || ''}</td><td>${s?.hectareas} ha</td><td>$${(precioHa || 0).toLocaleString('es-AR')}</td><td>$${neto.toLocaleString('es-AR')}</td><td>$${conIva.toLocaleString('es-AR')}</td><td>${s?.caja_paralela_id ? '✓ Paralelo' : ''}</td></tr>`
    }).join('')
    const totalNeto = seleccionadas.reduce((a, id) => { const s = servicios.find(x => x.id === id); const p = formPago.precio_ha ? parseFloat(formPago.precio_ha) : s?.precio_ha; return a + (p && s?.hectareas ? Math.round(p * s.hectareas) : (s?.total || 0)) }, 0)
    const totalConIva = Math.round(totalNeto * (1 + ivaPct / 100))
    win.document.write(`<!DOCTYPE html><html><head><title>Recibo Servicios</title><style>body{font-family:'IBM Plex Sans',sans-serif;padding:2rem;font-size:13px}h2{margin-bottom:1rem}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5;font-weight:600}tfoot td{font-weight:700;background:#e8f4eb}.total{font-size:16px;font-weight:700;margin-top:1rem}@media print{button{display:none}}</style></head><body>
      <h2>Recibo de Servicios — Ramonda Hnos S.A.</h2>
      <p>Fecha: ${formPago.fecha} | Cliente: ${servicios.find(x => x.id === seleccionadas[0])?.cliente || ''}</p>
      <table><thead><tr><th>Fecha</th><th>Campo/Lote</th><th>Servicio/Cultivo</th><th>Ha</th><th>$/Ha</th><th>Neto</th><th>Total c/IVA</th><th>Caja 2</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="5">TOTAL</td><td>$${totalNeto.toLocaleString('es-AR')}</td><td>$${totalConIva.toLocaleString('es-AR')}</td></tr></tfoot>
      </table>
      <div class="total">IVA ${ivaPct}% = $${(totalConIva - totalNeto).toLocaleString('es-AR')} | Total a cobrar: $${totalConIva.toLocaleString('es-AR')}</div>
      <br><button onclick="window.print()">🖨 Imprimir</button>
    </body></html>`)
    win.document.close()
  }

  // Filtrado
  const serviciosFiltrados = servicios.filter(s => {
    if (filtros.campania && s.campania !== filtros.campania) return false
    if (filtros.cliente && s.cliente !== filtros.cliente) return false
    if (filtros.labor && filtros.labor !== 'Todo' && s.labor !== filtros.labor) return false
    if (filtros.cultivo && filtros.cultivo !== 'Todo' && s.cultivo !== filtros.cultivo) return false
    if (filtros.tipo && s.tipo_servicio !== filtros.tipo) return false
    if (filtros.tipo && filtros.tipo !== 'Todo' && s.tipo_servicio !== filtros.tipo) return false
    if (filtros.estado && filtros.estado !== 'Todo') {
      if (filtros.estado === 'Pendiente' && s.estado_pago === 'cobrado') return false
      if (filtros.estado === 'Cobrado' && s.estado_pago !== 'cobrado') return false
    }
    if (filtros.empleado && filtros.empleado !== 'Todo') {
      const moList = manoObra[s.id] || []
      if (!moList.some(mo => mo.trabajador === filtros.empleado) && s.empleado1 !== filtros.empleado && s.empleado2 !== filtros.empleado) return false
    }
    return true
  })

  const todosEmpleados = empleados.map(e => e.nombre)

  const totalSeleccionadas = seleccionadas.reduce((a, id) => {
    const s = servicios.find(x => x.id === id)
    const precioHa = formPago.precio_ha ? parseFloat(formPago.precio_ha) : s?.precio_ha
    return a + (precioHa && s?.hectareas ? Math.round(precioHa * s.hectareas) : (s?.total || 0))
  }, 0)
  const totalConIva = Math.round(totalSeleccionadas * (1 + (parseFloat(formPago.iva_pct) || 0) / 100))

  if (loading) return <div style={{ padding: '2rem', color: S.muted }}>Cargando...</div>

  // ── MODO CELULAR ──
  if (mobile) {
    const inpM = { width: '100%', padding: '12px 14px', border: `1px solid ${CM.border}`, borderRadius: 10, fontSize: 15, background: CM.surface2, boxSizing: 'border-box', fontFamily: CM.sans, color: CM.text, marginBottom: 12 }
    const lblM = { fontSize: 11, fontWeight: 600, color: CM.muted, textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }
    const serviciosRecientesM = servicios.slice(0, 10)

    async function guardarServicioM() {
      const nombreCliente = formM.tipo_servicio === 'propio' ? 'Ramonda Hnos SA' : formM.cliente
      if (!nombreCliente || !formM.labor || !formM.hectareas) { alert('Completá cliente, labor y hectáreas'); return }
      if (formM.esParaAgricultura && !formM.campo_id) { alert('Seleccioná el campo de Agricultura'); return }
      setGuardandoM(true)
      const costoNum = formM.esParaAgricultura ? (parseFloat(formM.costo_total) || null) : null
      const { data: servicioCreado, error } = await registrarServicioTercero(supabase, {
        campania: formM.campania, tipoServicio: formM.tipo_servicio,
        cliente: formM.tipo_servicio === 'propio' ? null : nombreCliente,
        labor: formM.labor, cultivo: formM.cultivo,
        campo: formM.esParaAgricultura ? (campos.find(c => c.id === parseInt(formM.campo_id))?.nombre || '') : formM.campo,
        nroLote: formM.esParaAgricultura ? (campos.find(c => c.id === parseInt(formM.campo_id))?.lotes_agricolas?.find(l => l.id === parseInt(formM.lote_id))?.numero || '') : formM.nro_lote,
        fecha: formM.fecha, hectareas: formM.hectareas,
        empleado1: formM.empleado1, empleado2: formM.empleado2, observaciones: formM.observaciones,
        total: costoNum, precioHa: (costoNum && formM.hectareas) ? Math.round(costoNum / parseFloat(formM.hectareas)) : null,
        estadoPago: (formM.esParaAgricultura && costoNum) ? 'pagado' : 'pendiente',
      })
      if (error) { alert('Error: ' + error.message); setGuardandoM(false); return }

      // Si es para un lote de Agricultura, se refleja del otro lado como una
      // orden de trabajo — mismo criterio que en la versión de escritorio.
      if (formM.esParaAgricultura) {
        const tipoOrdenMap = { 'Siembra': 'Siembra', 'Cosecha': 'Cosecha', 'Pulverización': 'Pulverizacion', 'Fertilización': 'Fertilizacion', 'Roturación': 'Labranza', 'Rastreo': 'Labranza', 'Flete': 'Otro', 'Otro': 'Otro' }
        const productosValidos = formM.productos.filter(p => p.id && parseFloat(p.total) > 0)
        const { data: ordenCreada, error: errOrden } = await supabase.from('ordenes_trabajo').insert({
          campo_id: parseInt(formM.campo_id), lote_id: formM.lote_id ? parseInt(formM.lote_id) : null,
          campana_id: formM.campana_id ? parseInt(formM.campana_id) : null,
          tipo: tipoOrdenMap[formM.labor] || 'Otro', fecha: formM.fecha,
          descripcion: `Cargado desde Servicios (celular) — ${formM.labor}`,
          proveedor: null, es_propia: true,
          superficie_ha: parseFloat(formM.hectareas) || null,
          productos: productosValidos.map(p => ({ id: p.id, total: p.total })),
          costo_total: costoNum, costo_ha: (costoNum && formM.hectareas) ? Math.round(costoNum / parseFloat(formM.hectareas)) : null,
          estado: 'completado', estado_pago: costoNum ? 'pagado' : 'pendiente',
          observaciones: `Servicio interno #${servicioCreado?.id} — usa maquinaria de Servicios`,
          registrado_por: usuario?.id,
        }).select().single()
        if (errOrden) {
          alert('El servicio se guardó, pero no se pudo reflejar en Agricultura: ' + errOrden.message)
        } else {
          await supabase.from('servicios_terceros').update({ orden_trabajo_id: ordenCreada?.id }).eq('id', servicioCreado?.id)
          for (const p of productosValidos) {
            await supabase.rpc('incrementar_stock_agro', { p_id: parseInt(p.id), p_delta: -parseFloat(p.total) })
          }
        }
      }

      setGuardandoM(false)
      await cargar()
      setOkM('servicio')
      setTimeout(() => {
        setOkM('')
        setFormM(f => ({ ...f, cliente: '', campo: '', nro_lote: '', hectareas: '', empleado1: '', empleado2: '', observaciones: '', esParaAgricultura: false, campo_id: '', lote_id: '', campana_id: '', costo_total: '', productos: [] }))
      }, 2000)
    }

    async function guardarRegistroMercaderiaM() {
      if (!formRegM.campo) { alert('Ingresá el campo'); return }
      setGuardandoRegM(true)
      const { data, error } = await supabase.from('registros_mercaderia').insert({
        campo: formRegM.campo, cliente: formRegM.cliente || null,
        nro_lote: formRegM.nro_lote || null, cultivo: formRegM.cultivo || null,
        fecha: formRegM.fecha || null,
      }).select().single()
      if (error) { alert('Error: ' + error.message); setGuardandoRegM(false); return }
      setRegistros(prev => [data, ...prev])
      setRegistroActivoM(data)
      setDescargasReg(prev => ({ ...prev, [data.id]: [] }))
      setShowFormRegM(false)
      setFormRegM({ campo: '', cliente: '', nro_lote: '', cultivo: 'Maíz', fecha: hoyLocal() })
      setGuardandoRegM(false)
    }

    async function guardarDescargaM(regId) {
      if (!formDescM.kg) { alert('Ingresá los kg'); return }
      setGuardandoDescM(true)
      const { error } = await supabase.from('descargas_mercaderia').insert({
        registro_id: regId, fecha: formDescM.fecha, tipo: formDescM.tipo,
        patente: formDescM.tipo === 'camion' ? (formDescM.patente || null) : null,
        kg: parseFloat(formDescM.kg),
        observaciones: formDescM.tipo !== 'camion' ? (formDescM.observaciones || null) : null,
        registrado_por: usuario?.id,
      })
      if (error) { alert('Error al guardar la descarga: ' + error.message); setGuardandoDescM(false); return }
      setFormDescM({ tipo: 'camion', patente: '', kg: '', observaciones: '', fecha: hoyLocal() })
      setGuardandoDescM(false)
      await cargarDescargasReg(regId)
      setOkM('descarga')
      setTimeout(() => setOkM(''), 1500)
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: CM.bg, fontFamily: CM.sans, color: CM.text }}>
        <MobileTopbar titulo="Servicios" sub={tabM === 'mercaderia' ? 'Registro de mercadería' : 'Registrar trabajo'} onBack={() => nav && nav('home')} />
        {!esBrian && (
          <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${CM.border}`, background: CM.surface }}>
            {[{ key: 'servicio', label: '📋 Nuevo servicio' }, { key: 'mercaderia', label: '📦 Mercadería' }].map(t => (
              <button key={t.key} onClick={() => setTabM(t.key)}
                style={{ flex: 1, padding: '12px', fontSize: 13, fontWeight: tabM === t.key ? 600 : 400, border: 'none', background: 'transparent', borderBottom: tabM === t.key ? `2px solid ${CM.accent}` : '2px solid transparent', color: tabM === t.key ? CM.accent : CM.muted, cursor: 'pointer', fontFamily: CM.sans }}>
                {t.label}
              </button>
            ))}
          </div>
        )}
        <MobileScroll>
          {tabM === 'servicio' && (
            <div>
              {okM === 'servicio' && (
                <div style={{ background: CM.greenLight, border: `1px solid ${CM.green}`, borderRadius: 10, padding: '1rem', marginBottom: '1rem', textAlign: 'center', fontSize: 14, fontWeight: 600, color: CM.green }}>
                  ✓ Servicio registrado
                </div>
              )}
              <label style={lblM}>Campaña</label>
              <select value={formM.campania} onChange={e => setFormM({...formM, campania: e.target.value})} style={inpM}>
                <option value="">— Sin especificar —</option>
                {campanas.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
              </select>
              <label style={lblM}>Tipo</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                {[{ v: 'tercero', l: 'Tercero' }, { v: 'propio', l: 'Propio' }].map(t => (
                  <button key={t.v} onClick={() => setFormM({...formM, tipo_servicio: t.v, esParaAgricultura: t.v === 'propio'})}
                    style={{ padding: '11px', fontSize: 14, fontWeight: 600, border: `2px solid ${formM.tipo_servicio === t.v ? CM.accent : CM.border}`, background: formM.tipo_servicio === t.v ? CM.accent + '22' : 'transparent', color: formM.tipo_servicio === t.v ? CM.accent : CM.muted, borderRadius: 10, cursor: 'pointer', fontFamily: CM.sans }}>
                    {t.l}
                  </button>
                ))}
              </div>
              {formM.tipo_servicio === 'tercero' && (
                <>
                  <label style={lblM}>Cliente *</label>
                  <select value={formM.cliente} onChange={e => setFormM({...formM, cliente: e.target.value})} style={inpM}>
                    <option value="">— Seleccioná —</option>
                    {contactos.filter(c => !c.actividades || c.actividades.length === 0 || c.actividades.includes('Servicios')).map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                  </select>
                  <div style={{ fontSize: 10, color: CM.muted, marginTop: 3 }}>¿No aparece? Primero hay que cargarlo en Contactos, desde la PC.</div>
                </>
              )}
              <label style={lblM}>Servicio *</label>
              <select value={formM.labor} onChange={e => setFormM({...formM, labor: e.target.value})} style={inpM}>
                {LABORES.map(l => <option key={l}>{l}</option>)}
              </select>
              <label style={lblM}>Cultivo</label>
              <select value={formM.cultivo} onChange={e => setFormM({...formM, cultivo: e.target.value})} style={inpM}>
                {CULTIVOS.map(c => <option key={c}>{c}</option>)}
              </select>
              {formM.esParaAgricultura ? (
                <>
                  <label style={lblM}>Campo *</label>
                  <select value={formM.campo_id} onChange={e => setFormM({...formM, campo_id: e.target.value, lote_id: ''})} style={inpM}>
                    <option value="">— Seleccioná —</option>
                    {campos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                  <label style={lblM}>Lote</label>
                  <select value={formM.lote_id} onChange={e => setFormM({...formM, lote_id: e.target.value})} style={inpM}>
                    <option value="">— Todo el campo —</option>
                    {(campos.find(c => c.id === parseInt(formM.campo_id))?.lotes_agricolas || []).map(l => <option key={l.id} value={l.id}>Lote {l.numero}</option>)}
                  </select>
                  <label style={lblM}>Campaña</label>
                  <select value={formM.campana_id} onChange={e => setFormM({...formM, campana_id: e.target.value})} style={inpM}>
                    <option value="">— Seleccioná —</option>
                    {campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={lblM}>Campo</label>
                    <input type="text" value={formM.campo} onChange={e => setFormM({...formM, campo: e.target.value})} style={inpM} placeholder="ej. La Esperanza" />
                  </div>
                  <div>
                    <label style={lblM}>N° Lote</label>
                    <input type="text" value={formM.nro_lote} onChange={e => setFormM({...formM, nro_lote: e.target.value})} style={inpM} placeholder="ej. Lote 5" />
                  </div>
                </div>
              )}
              <label style={lblM}>Fecha</label>
              <input type="date" value={formM.fecha} onChange={e => setFormM({...formM, fecha: e.target.value})} style={inpM} />
              <label style={lblM}>Hectáreas *</label>
              <input type="number" value={formM.hectareas} onChange={e => setFormM({...formM, hectareas: e.target.value})} style={inpM} placeholder="ej. 120" inputMode="decimal" />
              {formM.esParaAgricultura && (
                <>
                  <label style={lblM}>Costo total $ (opcional — se puede completar después)</label>
                  <input type="number" value={formM.costo_total} onChange={e => setFormM({...formM, costo_total: e.target.value})} style={inpM} placeholder="Se puede dejar pendiente" inputMode="decimal" />
                  <label style={lblM}>{formM.labor === 'Siembra' ? 'Semilla usada' : formM.labor === 'Cosecha' ? 'Silobolsa usado' : 'Productos usados'}</label>
                  {formM.productos.map((p, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                      <select value={p.id} onChange={e => { const np = [...formM.productos]; np[i] = {...np[i], id: e.target.value}; setFormM({...formM, productos: np}) }} style={{ ...inpM, marginBottom: 0, flex: 2 }}>
                        <option value="">— Insumo —</option>
                        {stockAgro.filter(s => form.labor === 'Siembra' ? s.tipo === 'Semilla' : form.labor === 'Cosecha' ? s.tipo === 'Silobolsa' : true).map(s => <option key={s.id} value={s.id}>{s.insumo} ({s.unidad})</option>)}
                      </select>
                      <input type="number" value={p.total} onChange={e => { const np = [...formM.productos]; np[i] = {...np[i], total: e.target.value}; setFormM({...formM, productos: np}) }} style={{ ...inpM, marginBottom: 0, flex: 1 }} placeholder="Cant." inputMode="decimal" />
                      <button onClick={() => setFormM({...formM, productos: formM.productos.filter((_, ix) => ix !== i)})} style={{ padding: '10px 12px', background: CM.redLight || '#3D1A1A', border: `1px solid ${CM.red}`, color: CM.red, borderRadius: 8, cursor: 'pointer' }}>✕</button>
                    </div>
                  ))}
                  <button onClick={() => setFormM({...formM, productos: [...formM.productos, { id: '', total: '' }]})}
                    style={{ padding: '9px 14px', fontSize: 13, background: 'transparent', border: `1px dashed ${CM.border}`, color: CM.muted, borderRadius: 8, cursor: 'pointer', marginBottom: 12, width: '100%' }}>
                    + Agregar producto
                  </button>
                </>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={lblM}>Empleado 1</label>
                  <select value={formM.empleado1} onChange={e => setFormM({...formM, empleado1: e.target.value})} style={{ ...inpM, marginBottom: 0 }}>
                    <option value="">— Sin asignar —</option>
                    {empleados.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lblM}>Empleado 2</label>
                  <select value={formM.empleado2} onChange={e => setFormM({...formM, empleado2: e.target.value})} style={{ ...inpM, marginBottom: 0 }}>
                    <option value="">— Sin asignar —</option>
                    {empleados.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ height: 16 }} />
              <button onClick={guardarServicioM} disabled={guardandoM}
                style={{ width: '100%', padding: '14px', fontSize: 15, fontWeight: 600, background: CM.accent, border: 'none', color: '#fff', borderRadius: 10, cursor: 'pointer', fontFamily: CM.sans, marginBottom: 24 }}>
                {guardandoM ? 'Guardando...' : '💾 Guardar servicio'}
              </button>
              {serviciosRecientesM.length > 0 && (
                <div style={{ marginBottom: 32 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: CM.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>Últimos registros</div>
                  {serviciosRecientesM.map(s => (
                    <div key={s.id} style={{ background: CM.surface, border: `1px solid ${editandoSvcIdM === s.id ? CM.accent : CM.border}`, borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                      {editandoSvcIdM !== s.id ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>
                              {s.campo || s.cliente || '—'}
                              {s.nro_lote ? <span style={{ fontWeight: 400, color: CM.muted, fontSize: 12 }}> · {s.nro_lote}</span> : ''}
                            </div>
                            <div style={{ fontSize: 12, color: CM.muted, marginTop: 3 }}>
                              {s.labor} {s.cultivo ? `· ${s.cultivo}` : ''} · {s.hectareas} ha
                              {s.cliente && s.campo ? ` · ${s.cliente}` : ''}
                            </div>
                            {(s.empleado1 || s.empleado2) && (
                              <div style={{ fontSize: 11, color: CM.accent, marginTop: 3 }}>👷 {[s.empleado1, s.empleado2].filter(Boolean).join(', ')}</div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 8 }}>
                            <div style={{ fontSize: 11, color: CM.muted, whiteSpace: 'nowrap' }}>
                              {s.fecha ? new Date(s.fecha+'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : ''}
                            </div>
                            <button onClick={() => { setEditandoSvcIdM(s.id); setEditSvcM({ campo: s.campo || '', nro_lote: s.nro_lote || '', cliente: s.cliente || '', labor: s.labor || 'Siembra', cultivo: s.cultivo || 'Maíz', hectareas: String(s.hectareas || ''), empleado1: s.empleado1 || '', empleado2: s.empleado2 || '', fecha: s.fecha || '' }) }}
                              style={{ padding: '6px 12px', fontSize: 13, background: CM.surface2, border: `1px solid ${CM.accent}`, color: CM.accent, borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>✏ Editar</button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: CM.accent, marginBottom: 10 }}>Editar servicio</div>
                          <label style={lblM}>Campo</label>
                          <input type="text" value={editSvcM.campo} onChange={e => setEditSvcM({...editSvcM, campo: e.target.value})} style={inpM} />
                          <label style={lblM}>N° Lote</label>
                          <input type="text" value={editSvcM.nro_lote} onChange={e => setEditSvcM({...editSvcM, nro_lote: e.target.value})} style={inpM} />
                          <label style={lblM}>Cliente</label>
                          <select value={editSvcM.cliente} onChange={e => setEditSvcM({...editSvcM, cliente: e.target.value})} style={inpM}>
                            <option value="">— Sin especificar —</option>
                            {contactos.filter(c => !c.actividades || c.actividades.length === 0 || c.actividades.includes('Servicios')).map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                          </select>
                          <label style={lblM}>Servicio</label>
                          <select value={editSvcM.labor} onChange={e => setEditSvcM({...editSvcM, labor: e.target.value})} style={inpM}>
                            {LABORES.map(l => <option key={l}>{l}</option>)}
                          </select>
                          <label style={lblM}>Cultivo</label>
                          <select value={editSvcM.cultivo} onChange={e => setEditSvcM({...editSvcM, cultivo: e.target.value})} style={inpM}>
                            {CULTIVOS.map(c => <option key={c}>{c}</option>)}
                          </select>
                          <label style={lblM}>Hectáreas</label>
                          <input type="number" value={editSvcM.hectareas} onChange={e => setEditSvcM({...editSvcM, hectareas: e.target.value})} style={inpM} inputMode="decimal" />
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <div>
                              <label style={lblM}>Empleado 1</label>
                              <select value={editSvcM.empleado1} onChange={e => setEditSvcM({...editSvcM, empleado1: e.target.value})} style={{ ...inpM, marginBottom: 0 }}>
                                <option value="">— Sin asignar —</option>
                                {empleados.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
                              </select>
                            </div>
                            <div>
                              <label style={lblM}>Empleado 2</label>
                              <select value={editSvcM.empleado2} onChange={e => setEditSvcM({...editSvcM, empleado2: e.target.value})} style={{ ...inpM, marginBottom: 0 }}>
                                <option value="">— Sin asignar —</option>
                                {empleados.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
                              </select>
                            </div>
                          </div>
                          <div style={{ height: 12 }} />
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={async () => {
                              await supabase.from('servicios_terceros').update({
                                campo: editSvcM.campo || null, nro_lote: editSvcM.nro_lote || null, cliente: editSvcM.cliente || null,
                                labor: editSvcM.labor, cultivo: editSvcM.cultivo,
                                hectareas: parseFloat(editSvcM.hectareas) || s.hectareas,
                                empleado1: editSvcM.empleado1 || null, empleado2: editSvcM.empleado2 || null,
                              }).eq('id', s.id)
                              await cargar()
                              setEditandoSvcIdM(null)
                            }} style={{ flex: 1, padding: '11px', fontSize: 13, fontWeight: 600, background: CM.accent, border: 'none', color: '#fff', borderRadius: 8, cursor: 'pointer', fontFamily: CM.sans }}>
                              Guardar
                            </button>
                            <button onClick={() => setEditandoSvcIdM(null)}
                              style={{ padding: '11px 16px', fontSize: 13, background: 'transparent', border: `1px solid ${CM.border}`, color: CM.muted, borderRadius: 8, cursor: 'pointer', fontFamily: CM.sans }}>
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tabM === 'mercaderia' && (
            <div>
              {okM === 'descarga' && (
                <div style={{ background: CM.greenLight, border: `1px solid ${CM.green}`, borderRadius: 10, padding: '1rem', marginBottom: '1rem', textAlign: 'center', fontSize: 14, fontWeight: 600, color: CM.green }}>
                  ✓ Descarga registrada
                </div>
              )}
              <button onClick={() => setShowFormRegM(!showFormRegM)}
                style={{ width: '100%', padding: '12px', fontSize: 14, fontWeight: 600, background: showFormRegM ? CM.surface2 : CM.accent, border: `1px solid ${CM.accent}`, color: showFormRegM ? CM.accent : '#fff', borderRadius: 10, cursor: 'pointer', fontFamily: CM.sans, marginBottom: 16 }}>
                {showFormRegM ? 'Cancelar' : '+ Nuevo campo'}
              </button>
              {showFormRegM && (
                <div style={{ background: CM.surface, border: `1px solid ${CM.accent}`, borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
                  <label style={lblM}>Campo *</label>
                  <input type="text" value={formRegM.campo} onChange={e => setFormRegM({...formRegM, campo: e.target.value})} style={inpM} placeholder="ej. La Esperanza" />
                  <label style={lblM}>Cliente/Propietario</label>
                  <select value={formRegM.cliente} onChange={e => setFormRegM({...formRegM, cliente: e.target.value})} style={inpM}>
                    <option value="">— Sin especificar —</option>
                    {contactos.filter(c => !c.actividades || c.actividades.length === 0 || c.actividades.includes('Servicios')).map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                  </select>
                  <label style={lblM}>N° Lote</label>
                  <input type="text" value={formRegM.nro_lote} onChange={e => setFormRegM({...formRegM, nro_lote: e.target.value})} style={inpM} placeholder="ej. Lote 3" />
                  <label style={lblM}>Cultivo</label>
                  <select value={formRegM.cultivo} onChange={e => setFormRegM({...formRegM, cultivo: e.target.value})} style={inpM}>
                    {CULTIVOS.map(c => <option key={c}>{c}</option>)}
                  </select>
                  <label style={lblM}>Fecha inicio</label>
                  <input type="date" value={formRegM.fecha} onChange={e => setFormRegM({...formRegM, fecha: e.target.value})} style={inpM} />
                  <button onClick={guardarRegistroMercaderiaM} disabled={guardandoRegM}
                    style={{ width: '100%', padding: '12px', fontSize: 14, fontWeight: 600, background: CM.green, border: 'none', color: '#fff', borderRadius: 10, cursor: 'pointer', fontFamily: CM.sans, marginBottom: 16 }}>
                    {guardandoRegM ? 'Guardando...' : '💾 Crear registro'}
                  </button>
                </div>
              )}
              {registros.length === 0 && !showFormRegM && (
                <div style={{ textAlign: 'center', color: CM.muted, padding: '2rem', fontSize: 14 }}>No hay registros. Creá uno con "+ Nuevo campo".</div>
              )}
              {registros.map(reg => {
                const desc = descargasReg[reg.id] || []
                const kgCamion = desc.filter(d => d.tipo === 'camion').reduce((a, d) => a + (d.kg || 0), 0)
                const kgBolsa = desc.filter(d => d.tipo === 'bolsa').reduce((a, d) => a + (d.kg || 0), 0)
                const kgOtro = desc.filter(d => d.tipo === 'otro').reduce((a, d) => a + (d.kg || 0), 0)
                const kgTotal = kgCamion + kgBolsa + kgOtro
                const isActivo = registroActivoM?.id === reg.id
                return (
                  <div key={reg.id} style={{ background: CM.surface, border: `1px solid ${isActivo ? CM.accent : CM.border}`, borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
                    <div style={{ padding: '1rem' }} onClick={async () => {
                      if (isActivo) { setRegistroActivoM(null); return }
                      await cargarDescargasReg(reg.id)
                      setRegistroActivoM(reg)
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{reg.campo}</div>
                      <div style={{ fontSize: 12, color: CM.muted, marginTop: 2 }}>{reg.cliente || '—'} · {reg.nro_lote || 'Sin lote'} · {reg.cultivo}</div>
                      {kgTotal > 0 && (
                        <div style={{ marginTop: 8, display: 'flex', gap: 10, fontSize: 12, flexWrap: 'wrap' }}>
                          {kgCamion > 0 && <span style={{ color: CM.accent }}>🚛 {kgCamion.toLocaleString('es-AR')} kg</span>}
                          {kgBolsa > 0 && <span style={{ color: CM.green }}>🌾 {kgBolsa.toLocaleString('es-AR')} kg</span>}
                          {kgOtro > 0 && <span style={{ color: CM.muted }}>📦 {kgOtro.toLocaleString('es-AR')} kg</span>}
                          <span style={{ fontWeight: 700 }}>Total: {kgTotal.toLocaleString('es-AR')} kg</span>
                        </div>
                      )}
                      <div style={{ marginTop: 8, fontSize: 12, color: isActivo ? CM.accent : CM.muted }}>{isActivo ? '▲ Cerrar' : '📦 Ver / Registrar descarga'}</div>
                    </div>
                    {isActivo && (
                      <div style={{ borderTop: `1px solid ${CM.border}`, padding: '1rem', background: CM.surface2 }}>
                        {desc.length > 0 && (
                          <div style={{ marginBottom: 16 }}>
                            {desc.map(d => (
                              <div key={d.id} style={{ padding: '8px 0', borderBottom: `1px solid ${CM.border}` }}>
                                {editandoDescIdM !== d.id ? (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                      <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: d.tipo === 'camion' ? '#1A3D6B44' : d.tipo === 'bolsa' ? '#1E5C2E44' : '#7A450044', color: d.tipo === 'camion' ? CM.accent : d.tipo === 'bolsa' ? CM.green : CM.amber }}>
                                        {d.tipo === 'camion' ? '🚛' : d.tipo === 'bolsa' ? '🌾' : '📦'} {d.tipo}
                                      </span>
                                      {(d.patente || d.observaciones) && <span style={{ fontSize: 12, color: CM.muted, marginLeft: 8 }}>{d.patente || d.observaciones}</span>}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <span style={{ fontFamily: CM.mono, fontWeight: 700, fontSize: 14 }}>{(d.kg || 0).toLocaleString('es-AR')} kg</span>
                                      <button onClick={() => { setEditandoDescIdM(d.id); setEditDescKgM(String(d.kg || '')); setEditDescPatenteM(d.patente || d.observaciones || '') }}
                                        style={{ padding: '4px 8px', fontSize: 12, background: 'transparent', border: `1px solid ${CM.border}`, color: CM.muted, borderRadius: 6, cursor: 'pointer' }}>✏</button>
                                      <button onClick={async () => {
                                        if (!confirm('¿Eliminar esta descarga?')) return
                                        await supabase.from('descargas_mercaderia').delete().eq('id', d.id)
                                        await cargarDescargasReg(reg.id)
                                      }} style={{ padding: '4px 8px', fontSize: 12, background: '#3D1A1A', border: `1px solid ${CM.red}`, color: CM.red, borderRadius: 6, cursor: 'pointer' }}>🗑</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <div style={{ fontSize: 12, color: CM.muted, marginBottom: 6 }}>{d.tipo === 'camion' ? '🚛 Camión' : d.tipo === 'bolsa' ? '🌾 Bolsa' : '📦 Otro'}</div>
                                    <label style={{ ...lblM, marginBottom: 4 }}>{d.tipo === 'camion' ? 'Patente' : 'Detalle / N° bolsa'}</label>
                                    <input type="text" value={editDescPatenteM}
                                      onChange={e => setEditDescPatenteM(d.tipo === 'camion' ? e.target.value.toUpperCase() : e.target.value)}
                                      placeholder={d.tipo === 'camion' ? 'ej. ABC 123' : 'ej. Bolsa 8'}
                                      style={{ ...inpM, marginBottom: 8 }} />
                                    <label style={{ ...lblM, marginBottom: 4 }}>Kg</label>
                                    <input type="number" value={editDescKgM} onChange={e => setEditDescKgM(e.target.value)}
                                      placeholder="ej. 28500" inputMode="decimal" style={{ ...inpM, marginBottom: 8 }} />
                                    <div style={{ display: 'flex', gap: 8 }}>
                                      <button onClick={async () => {
                                        await supabase.from('descargas_mercaderia').update({
                                          kg: parseFloat(editDescKgM) || d.kg,
                                          patente: d.tipo === 'camion' ? (editDescPatenteM || null) : d.patente,
                                          observaciones: d.tipo !== 'camion' ? (editDescPatenteM || null) : d.observaciones,
                                        }).eq('id', d.id)
                                        setEditandoDescIdM(null)
                                        await cargarDescargasReg(reg.id)
                                      }} style={{ flex: 1, padding: '10px', fontSize: 13, fontWeight: 600, background: CM.green, border: 'none', color: '#fff', borderRadius: 8, cursor: 'pointer', fontFamily: CM.sans }}>
                                        Guardar
                                      </button>
                                      <button onClick={() => setEditandoDescIdM(null)}
                                        style={{ padding: '10px 16px', fontSize: 13, background: 'transparent', border: `1px solid ${CM.border}`, color: CM.muted, borderRadius: 8, cursor: 'pointer', fontFamily: CM.sans }}>
                                        Cancelar
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                            {kgTotal > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontWeight: 700, color: CM.accent, fontSize: 15 }}>
                                <span>TOTAL</span>
                                <span style={{ fontFamily: CM.mono }}>{kgTotal.toLocaleString('es-AR')} kg</span>
                              </div>
                            )}
                          </div>
                        )}
                        <label style={lblM}>Tipo</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
                          {[{ v: 'camion', l: '🚛 Camión' }, { v: 'bolsa', l: '🌾 Bolsa' }, { v: 'otro', l: '📦 Otro' }].map(t => (
                            <button key={t.v} onClick={() => setFormDescM({...formDescM, tipo: t.v})}
                              style={{ padding: '10px 6px', fontSize: 12, fontWeight: 600, border: `2px solid ${formDescM.tipo === t.v ? CM.accent : CM.border}`, background: formDescM.tipo === t.v ? CM.accent + '22' : 'transparent', color: formDescM.tipo === t.v ? CM.accent : CM.muted, borderRadius: 8, cursor: 'pointer', fontFamily: CM.sans }}>
                              {t.l}
                            </button>
                          ))}
                        </div>
                        {formDescM.tipo === 'camion' ? (
                          <>
                            <label style={lblM}>Patente</label>
                            <input type="text" value={formDescM.patente} onChange={e => setFormDescM({...formDescM, patente: e.target.value.toUpperCase()})}
                              style={inpM} placeholder="ej. ABC 123" />
                          </>
                        ) : (
                          <>
                            <label style={lblM}>Detalle</label>
                            <input type="text" value={formDescM.observaciones} onChange={e => setFormDescM({...formDescM, observaciones: e.target.value})}
                              style={inpM} placeholder="ej. Bolsa 8" />
                          </>
                        )}
                        <label style={lblM}>Kg *</label>
                        <input type="number" value={formDescM.kg} onChange={e => setFormDescM({...formDescM, kg: e.target.value})}
                          style={inpM} placeholder="ej. 28500" inputMode="decimal" />
                        <label style={lblM}>Fecha</label>
                        <input type="date" value={formDescM.fecha} onChange={e => setFormDescM({...formDescM, fecha: e.target.value})} style={inpM} />
                        <button onClick={() => guardarDescargaM(reg.id)} disabled={guardandoDescM}
                          style={{ width: '100%', padding: '13px', fontSize: 14, fontWeight: 600, background: CM.green, border: 'none', color: '#fff', borderRadius: 10, cursor: 'pointer', fontFamily: CM.sans, marginBottom: 32 }}>
                          {guardandoDescM ? 'Guardando...' : '+ Registrar descarga'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </MobileScroll>
      </div>
    )
  }
  // ── FIN MODO CELULAR — de acá para abajo sigue el modo PC, sin cambios ──

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: S.text }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: 20, fontWeight: 600 }}>Servicios</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!esBrian && (
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowNuevaCampana(!showNuevaCampana)}
                style={{ padding: '8px 14px', fontSize: 13, fontWeight: 500, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>
                📅 Campañas
              </button>
              {showNuevaCampana && (
                <div style={{ position: 'absolute', right: 0, top: '110%', background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem', minWidth: 220, zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,.1)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: S.muted, marginBottom: 8 }}>Campañas activas</div>
                  {campanas.map(c => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 13 }}>
                      <span>{c.nombre}</span>
                      <button onClick={async () => {
                        if (!confirm(`¿Desactivar campaña ${c.nombre}?`)) return
                        const { error } = await supabase.from('campanas').update({ activa: false }).eq('id', c.id)
                        if (error) { alert('Error: ' + error.message); return }
                        await cargar()
                      }} style={{ fontSize: 10, padding: '2px 6px', background: S.redLight, border: 'none', color: S.red, borderRadius: 3, cursor: 'pointer' }}>✕</button>
                    </div>
                  ))}
                  <div style={{ borderTop: `1px solid ${S.border}`, marginTop: 8, paddingTop: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, marginBottom: 4 }}>+ Nueva campaña</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input type="text" value={nuevaCampana} onChange={e => setNuevaCampana(e.target.value)}
                        placeholder="ej. 2027/28"
                        style={{ ...inp, padding: '5px 8px', fontSize: 12, flex: 1 }} />
                      <button onClick={async () => {
                        if (!nuevaCampana.trim()) return
                        const { error } = await supabase.from('campanas').insert({ nombre: nuevaCampana.trim(), activa: true })
                        if (error) { alert('Error al crear la campaña: ' + error.message); return }
                        setNuevaCampana('')
                        await cargar()
                      }} style={{ padding: '5px 10px', fontSize: 12, fontWeight: 600, background: S.accent, border: 'none', color: '#fff', borderRadius: 5, cursor: 'pointer' }}>
                        Agregar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {!esBrian && tab === 'servicios' && (
            <button onClick={() => setShowForm(!showForm)}
              style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.accent, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
              + Nuevo servicio
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: '1.5rem', borderBottom: `1px solid ${S.border}` }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setShowForm(false); setSeleccionadas([]) }}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: tab === t.key ? 600 : 400, border: 'none', background: 'transparent', borderBottom: tab === t.key ? `2px solid ${S.accent}` : '2px solid transparent', color: tab === t.key ? S.accent : S.muted, cursor: 'pointer', marginBottom: -1 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB SERVICIOS ── */}
      {tab === 'servicios' && (
        <div>
          {/* Form nuevo */}
          {showForm && (
            <div style={{ background: S.surface, border: `1px solid ${S.accent}`, borderRadius: 10, padding: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: '1rem' }}>Nuevo servicio</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <Lbl>Campaña *</Lbl>
                  <select value={form.campania} onChange={e => setForm({ ...form, campania: e.target.value })} style={inp}>
                    {campanas.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <Lbl>Tipo *</Lbl>
                  <select value={form.tipo_servicio} onChange={e => setForm({ ...form, tipo_servicio: e.target.value, esParaAgricultura: e.target.value === 'propio' })} style={inp}>
                    <option value="tercero">Tercero</option>
                    <option value="propio">Propio</option>
                  </select>
                </div>
                <div>
                  <Lbl>Servicio *</Lbl>
                  <select value={form.labor} onChange={e => setForm({ ...form, labor: e.target.value })} style={inp}>
                    {LABORES.map(l => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <Lbl>Cultivo</Lbl>
                  <select value={form.cultivo} onChange={e => setForm({ ...form, cultivo: e.target.value })} style={inp}>
                    {CULTIVOS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                {form.tipo_servicio === 'tercero' && (
                  <div style={{ gridColumn: '1 / 3' }}>
                    <Lbl>Cliente *</Lbl>
                    <select value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })} style={inp}>
                      <option value="">— Seleccioná —</option>
                      {contactos.filter(c => !c.actividades || c.actividades.length === 0 || c.actividades.includes('Servicios')).map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                    </select>
                    <div style={{ fontSize: 10, color: S.hint, marginTop: 3 }}>¿No aparece? Cargalo primero en Contactos.</div>
                  </div>
                )}
                <div>
                  <Lbl>Fecha</Lbl>
                  <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} style={inp} />
                </div>
                {form.esParaAgricultura ? (
                  <>
                    <div>
                      <Lbl>Campo *</Lbl>
                      <select value={form.campo_id} onChange={e => setForm({ ...form, campo_id: e.target.value, lote_id: '' })} style={inp}>
                        <option value="">— Seleccioná —</option>
                        {campos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                    </div>
                    <div>
                      <Lbl>Lote</Lbl>
                      <select value={form.lote_id} onChange={e => setForm({ ...form, lote_id: e.target.value })} style={inp}>
                        <option value="">— Todo el campo —</option>
                        {(campos.find(c => c.id === parseInt(form.campo_id))?.lotes_agricolas || []).map(l => <option key={l.id} value={l.id}>Lote {l.numero}</option>)}
                      </select>
                    </div>
                    <div>
                      <Lbl>Campaña</Lbl>
                      <select value={form.campana_id} onChange={e => setForm({ ...form, campana_id: e.target.value })} style={inp}>
                        <option value="">— Seleccioná —</option>
                        {campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Lbl>Campo</Lbl>
                      <input type="text" value={form.campo} onChange={e => setForm({ ...form, campo: e.target.value })} placeholder="ej. La Esperanza" style={inp} />
                    </div>
                    <div>
                      <Lbl>N° Lote</Lbl>
                      <input type="text" value={form.nro_lote} onChange={e => setForm({ ...form, nro_lote: e.target.value })} placeholder="ej. Lote 5" style={inp} />
                    </div>
                  </>
                )}
                <div>
                  <Lbl>Hectáreas *</Lbl>
                  <input type="number" value={form.hectareas} onChange={e => setForm({ ...form, hectareas: e.target.value })} placeholder="ej. 120" style={inpMono} />
                </div>
                <div>
                  <Lbl>Empleado 1</Lbl>
                  <select value={form.empleado1} onChange={e => setForm({ ...form, empleado1: e.target.value })} style={inp}>
                    <option value="">— Sin asignar —</option>
                    {empleados.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <Lbl>Empleado 2</Lbl>
                  <select value={form.empleado2} onChange={e => setForm({ ...form, empleado2: e.target.value })} style={inp}>
                    <option value="">— Sin asignar —</option>
                    {empleados.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
                  </select>
                </div>
              </div>

              {form.esParaAgricultura && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '.75rem' }}>
                    <div><Lbl>Costo total $ (valor del trabajo, para la rentabilidad del lote)</Lbl><input type="number" value={form.costo_total} onChange={e => setForm({ ...form, costo_total: e.target.value })} placeholder="ej. combustible + hs de trabajo" style={inpMono} /></div>
                  </div>
                  <Lbl>{form.labor === 'Siembra' ? 'Semilla usada' : form.labor === 'Cosecha' ? 'Silobolsa usado' : 'Productos usados en este lote'}</Lbl>
                  {form.productos.map((p, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                      <select value={p.id} onChange={e => { const np = [...form.productos]; np[i] = { ...np[i], id: e.target.value }; setForm({ ...form, productos: np }) }} style={inp}>
                        <option value="">— Seleccioná el insumo —</option>
                        {stockAgro.filter(s => formM.labor === 'Siembra' ? s.tipo === 'Semilla' : formM.labor === 'Cosecha' ? s.tipo === 'Silobolsa' : true).map(s => <option key={s.id} value={s.id}>{s.insumo} ({s.unidad}) — stock: {s.cantidad?.toLocaleString('es-AR')}</option>)}
                      </select>
                      <input type="number" value={p.total} onChange={e => { const np = [...form.productos]; np[i] = { ...np[i], total: e.target.value }; setForm({ ...form, productos: np }) }} placeholder="Cantidad total" style={inpMono} />
                      <button onClick={() => setForm({ ...form, productos: form.productos.filter((_, ix) => ix !== i) })} style={{ padding: '6px 10px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>✕</button>
                    </div>
                  ))}
                  <button onClick={() => setForm({ ...form, productos: [...form.productos, { id: '', total: '' }] })}
                    style={{ padding: '5px 12px', fontSize: 12, background: 'transparent', border: `1px dashed ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>
                    + Agregar producto
                  </button>
                  <div style={{ fontSize: 11, color: S.hint, marginTop: 8 }}>
                    Se descuentan del stock de Agricultura al guardar. Para siembra, cargá acá la semilla; para cosecha, el silobolsa.
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={guardar} disabled={guardando}
                  style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, background: S.accent, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                  {guardando ? 'Guardando...' : '💾 Guardar'}
                </button>
                <button onClick={() => setShowForm(false)}
                  style={{ padding: '8px 18px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Filtros */}
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              <div>
                <Lbl>Campaña</Lbl>
                <select value={filtros.campania} onChange={e => setFiltros({ ...filtros, campania: e.target.value })} style={{ ...inp, padding: '6px 8px' }}>
                  <option value="">Todas</option>
                  {campanas.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <Lbl>Cliente</Lbl>
                <select value={filtros.cliente} onChange={e => setFiltros({ ...filtros, cliente: e.target.value })} style={{ ...inp, padding: '6px 8px' }}>
                  <option value="">Todos</option>
                  {[...new Set(servicios.map(s => s.cliente).filter(Boolean))].sort().map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <Lbl>Servicio</Lbl>
                <select value={filtros.labor} onChange={e => setFiltros({ ...filtros, labor: e.target.value })} style={{ ...inp, padding: '6px 8px' }}>
                  <option value="">Todo</option>
                  {LABORES.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <Lbl>Cultivo</Lbl>
                <select value={filtros.cultivo} onChange={e => setFiltros({ ...filtros, cultivo: e.target.value })} style={{ ...inp, padding: '6px 8px' }}>
                  <option value="">Todo</option>
                  {CULTIVOS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <Lbl>Tipo</Lbl>
                <select value={filtros.tipo} onChange={e => setFiltros({ ...filtros, tipo: e.target.value })} style={{ ...inp, padding: '6px 8px' }}>
                  <option value="">Todo</option>
                  <option value="tercero">Tercero</option>
                  <option value="propio">Propio</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tabla */}
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, overflow: 'auto', marginBottom: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 1100 }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: 32 }}></th>
                  <th style={th}>Campaña</th>
                  <th style={th}>Fecha</th>
                  <th style={th}>Campo / Lote</th>
                  <th style={th}>Servicio</th>
                  <th style={th}>Cultivo</th>
                  <th style={th}>Tipo</th>
                  <th style={th}>Ha</th>
                  <th style={th}>$/Ha</th>
                  <th style={th}>$Total</th>
                  <th style={th}>Estado</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {serviciosFiltrados.length === 0 && (
                  <tr><td colSpan={14} style={{ ...td_, textAlign: 'center', color: S.hint, padding: '2rem' }}>No hay servicios registrados.</td></tr>
                )}
                {serviciosFiltrados.map(s => {
                  const moList = manoObra[s.id] || []
                  const mo1 = moList.find(m => m.trabajador === s.empleado1) || moList[0]
                  const mo2 = moList.find(m => m.trabajador === s.empleado2) || moList[1]
                  const isCobrado = s.estado_pago === 'cobrado'
                  const isSelected = seleccionadas.includes(s.id)
                  const isEditing = editandoId === s.id

                  if (isEditing) return (
                    <tr key={s.id} style={{ background: S.accentLight }}>
                      <td style={td_} colSpan={17}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 8 }}>
                          <div><Lbl>Campaña</Lbl><select value={formEdit.campania} onChange={e => setFormEdit({ ...formEdit, campania: e.target.value })} style={{ ...inp, padding: '6px 8px' }}>{campanas.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}</select></div>
                          <div><Lbl>Tipo</Lbl><select value={formEdit.tipo_servicio} onChange={e => setFormEdit({ ...formEdit, tipo_servicio: e.target.value })} style={{ ...inp, padding: '6px 8px' }}><option value="tercero">Tercero</option><option value="propio">Propio</option></select></div>
                          <div><Lbl>Servicio</Lbl><select value={formEdit.labor} onChange={e => setFormEdit({ ...formEdit, labor: e.target.value })} style={{ ...inp, padding: '6px 8px' }}>{LABORES.map(l => <option key={l}>{l}</option>)}</select></div>
                          <div><Lbl>Cultivo</Lbl><select value={formEdit.cultivo} onChange={e => setFormEdit({ ...formEdit, cultivo: e.target.value })} style={{ ...inp, padding: '6px 8px' }}>{CULTIVOS.map(c => <option key={c}>{c}</option>)}</select></div>
                          <div><Lbl>Fecha</Lbl><input type="date" value={formEdit.fecha} onChange={e => setFormEdit({ ...formEdit, fecha: e.target.value })} style={{ ...inp, padding: '6px 8px' }} /></div>
                          <div><Lbl>Cliente</Lbl><select value={formEdit.cliente} onChange={e => setFormEdit({ ...formEdit, cliente: e.target.value })} style={{ ...inp, padding: '6px 8px' }}><option value="">— Seleccioná —</option>{contactos.filter(c => !c.actividades || c.actividades.length === 0 || c.actividades.includes('Servicios')).map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}</select></div>
                          <div><Lbl>Campo</Lbl><input type="text" value={formEdit.campo || ''} onChange={e => setFormEdit({ ...formEdit, campo: e.target.value })} style={{ ...inp, padding: '6px 8px' }} /></div>
                          <div><Lbl>N° Lote</Lbl><input type="text" value={formEdit.nro_lote || ''} onChange={e => setFormEdit({ ...formEdit, nro_lote: e.target.value })} style={{ ...inp, padding: '6px 8px' }} /></div>
                          <div><Lbl>Hectáreas</Lbl><input type="number" value={formEdit.hectareas} onChange={e => setFormEdit({ ...formEdit, hectareas: e.target.value })} style={{ ...inpMono, padding: '6px 8px' }} /></div>
                          <div><Lbl>Empleado 1</Lbl><select value={formEdit.empleado1 || ''} onChange={e => setFormEdit({ ...formEdit, empleado1: e.target.value })} style={{ ...inp, padding: '6px 8px' }}><option value="">— Sin asignar —</option>{empleados.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}</select></div>
                          <div><Lbl>Empleado 2</Lbl><select value={formEdit.empleado2 || ''} onChange={e => setFormEdit({ ...formEdit, empleado2: e.target.value })} style={{ ...inp, padding: '6px 8px' }}><option value="">— Sin asignar —</option>{empleados.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}</select></div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={guardarEdit} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: 'none', color: '#fff', borderRadius: 5, cursor: 'pointer' }}>Guardar</button>
                          <button onClick={() => setEditandoId(null)} style={{ padding: '6px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 5, cursor: 'pointer' }}>Cancelar</button>
                        </div>
                      </td>
                    </tr>
                  )

                  return (
                    <tr key={s.id} style={{ background: isSelected ? S.accentLight : isCobrado ? S.greenLight : S.surface }}>
                      <td style={{ ...td_, textAlign: 'center' }}>
                        {!isCobrado && (
                          <input type="checkbox" checked={isSelected} onChange={() => setSeleccionadas(prev => isSelected ? prev.filter(x => x !== s.id) : [...prev, s.id])} />
                        )}
                      </td>
                      <td style={{ ...td_, fontFamily: 'monospace', fontSize: 12 }}>{s.campania || '—'}</td>
                      <td style={{ ...td_, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{s.fecha ? new Date(s.fecha+'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}</td>
                      <td style={{ ...td_ }}><div style={{ fontWeight: 600 }}>{s.campo || '—'}{s.nro_lote ? <span style={{ fontWeight: 400, color: S.muted }}> · {s.nro_lote}</span> : ''}</div><div style={{ fontSize: 11, color: S.muted }}>{s.cliente || '—'}</div></td>
                      <td style={td_}>
                        <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: S.accentLight, color: S.accent }}>{s.labor}</span>
                      </td>
                      <td style={{ ...td_, color: S.muted }}>{s.cultivo || '—'}</td>
                      <td style={td_}>
                        <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: s.tipo_servicio === 'propio' ? S.purpleLight : S.bg, color: s.tipo_servicio === 'propio' ? S.purple : S.muted }}>{s.tipo_servicio === 'propio' ? 'Propio' : 'Tercero'}</span>
                      </td>
                      <td style={{ ...td_, fontFamily: 'monospace', textAlign: 'right' }}>{s.hectareas}</td>
                      <td style={{ ...td_, fontFamily: 'monospace', textAlign: 'right', color: s.precio_ha ? S.text : S.amber }}>{s.precio_ha ? `$${s.precio_ha.toLocaleString('es-AR')}` : '—'}</td>
                      <td style={{ ...td_, fontFamily: 'monospace', textAlign: 'right', fontWeight: 700, color: isCobrado ? S.green : S.text }}>{s.total ? `$${s.total.toLocaleString('es-AR')}` : '—'}</td>
                      <td style={td_}>
                        <span style={{ padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: isCobrado ? S.greenLight : s.precio_ha ? S.amberLight : S.bg, color: isCobrado ? S.green : s.precio_ha ? S.amber : S.hint }}>
                          {isCobrado ? '✓ Cobrado' : s.precio_ha ? '⏳ Pendiente' : 'Sin precio'}
                        </span>
                      </td>
                      <td style={{ ...td_, whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {s.orden_trabajo_id && !s.total && (
                            <button onClick={async () => {
                              const val = prompt(`Precio del trabajo (${s.labor} — ${s.campo || 'Agricultura'}, ${s.hectareas} ha):`)
                              if (!val) return
                              const monto = parseFloat(val)
                              if (!monto || monto <= 0) { alert('Ingresá un número válido'); return }
                              const precioHa = s.hectareas ? Math.round(monto / s.hectareas) : null
                              const { error: e1 } = await supabase.from('servicios_terceros').update({ total: monto, precio_ha: precioHa, estado_pago: 'pagado' }).eq('id', s.id)
                              if (e1) { alert('Error al actualizar el servicio: ' + e1.message); return }
                              const { error: e2 } = await supabase.from('ordenes_trabajo').update({ costo_total: monto, costo_ha: precioHa, estado_pago: 'pagado' }).eq('id', s.orden_trabajo_id)
                              if (e2) alert('El servicio se actualizó, pero no se pudo actualizar la orden en Agricultura: ' + e2.message)
                              await cargar()
                            }} style={{ padding: '3px 8px', fontSize: 11, background: S.amberLight, border: `1px solid ${S.amber}`, color: S.amber, borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
                              💲 Completar precio
                            </button>
                          )}
                          <button onClick={() => { setEditandoId(s.id); setFormEdit({ ...s, hectareas: String(s.hectareas) }) }}
                            style={{ padding: '3px 8px', fontSize: 11, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 4, cursor: 'pointer' }}>
                            ✏
                          </button>
                          <button onClick={async () => {
                            if (!confirm(`¿Eliminar servicio de ${s.cliente} - ${s.labor}?`)) return
                            await supabase.from('servicios_terceros').delete().eq('id', s.id)
                            await cargar()
                          }} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: `1px solid #F09595`, color: S.red, borderRadius: 4, cursor: 'pointer' }}>
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {serviciosFiltrados.length > 0 && (
                <tfoot>
                  <tr style={{ background: S.accentLight }}>
                    <td colSpan={7} style={{ ...td_, fontWeight: 700 }}>TOTAL ({serviciosFiltrados.length} servicios)</td>
                    <td style={{ ...td_, fontFamily: 'monospace', textAlign: 'right', fontWeight: 700 }}>
                      {serviciosFiltrados.reduce((a, s) => a + (s.hectareas || 0), 0).toLocaleString('es-AR')} ha
                    </td>
                    <td></td>
                    <td style={{ ...td_, fontFamily: 'monospace', textAlign: 'right', fontWeight: 700, color: S.green }}>
                      ${serviciosFiltrados.reduce((a, s) => a + (s.total || 0), 0).toLocaleString('es-AR')}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Historial de cobros */}
          {serviciosFiltrados.filter(s => s.estado_pago === 'cobrado').length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem' }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Cobros registrados</div>
                <button onClick={() => {
                  const cobrados = serviciosFiltrados.filter(s => s.estado_pago === 'cobrado')
                  const win = window.open('', '_blank')
                  const rows = cobrados.map(s => {
                    const neto = s.precio_ha && s.hectareas ? Math.round(s.precio_ha * s.hectareas) : (s.total || 0)
                    const iva = s.iva_pct || 0
                    const total = s.total || 0
                    const negro = s.monto_negro || 0
                    return `<tr><td>${s.fecha_cobro ? new Date(s.fecha_cobro+'T12:00:00').toLocaleDateString('es-AR') : '—'}</td><td>${s.cliente || '—'}</td><td>${s.campo || '—'}${s.nro_lote ? ' · '+s.nro_lote : ''}</td><td>${s.labor}</td><td>${s.cultivo || '—'}</td><td>${s.hectareas}</td><td>${s.precio_ha ? '$'+s.precio_ha.toLocaleString('es-AR') : '—'}</td><td>$${neto.toLocaleString('es-AR')}</td><td>${iva ? iva+'%' : '—'}</td><td>$${total.toLocaleString('es-AR')}</td><td>${negro ? '$'+negro.toLocaleString('es-AR') : '—'}</td></tr>`
                  }).join('')
                  const totalHa = cobrados.reduce((a,s) => a+(s.hectareas||0), 0)
                  const totalNeto = cobrados.reduce((a,s) => { const n = s.precio_ha&&s.hectareas ? Math.round(s.precio_ha*s.hectareas) : (s.total||0); return a+n }, 0)
                  const totalTotal = cobrados.reduce((a,s) => a+(s.total||0), 0)
                  const totalNegro = cobrados.reduce((a,s) => a+(s.monto_negro||0), 0)
                  win.document.write(`<!DOCTYPE html><html><head><title>Resumen Cobros</title><style>body{font-family:'IBM Plex Sans',sans-serif;padding:2rem;font-size:12px}h2{margin-bottom:.5rem}p{color:#666;margin-bottom:1rem}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#f5f5f5;font-weight:600;font-size:11px;text-transform:uppercase}tfoot td{font-weight:700;background:#e8f4eb}.negro{color:#7A4500;font-weight:600}@media print{button{display:none}}</style></head><body>
                    <h2>Resumen de Cobros — Ramonda Hnos S.A.</h2>
                    <p>Generado el ${new Date().toLocaleDateString('es-AR')}</p>
                    <table><thead><tr><th>Fecha</th><th>Cliente</th><th>Campo/Lote</th><th>Servicio</th><th>Cultivo</th><th>Ha</th><th>$/Ha</th><th>Neto</th><th>IVA</th><th>Total</th><th>Sin factura</th></tr></thead>
                    <tbody>${rows}</tbody>
                    <tfoot><tr><td colspan="5">TOTAL</td><td>${totalHa} ha</td><td></td><td>$${totalNeto.toLocaleString('es-AR')}</td><td></td><td>$${totalTotal.toLocaleString('es-AR')}</td><td class="negro">${totalNegro ? '$'+totalNegro.toLocaleString('es-AR') : '—'}</td></tr></tfoot>
                    </table><br><button onclick="window.print()">🖨 Imprimir</button></body></html>`)
                  win.document.close()
                }} style={{ padding: '5px 12px', fontSize: 12, background: S.bg, border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>
                  🖨 Imprimir resumen
                </button>
              </div>
              <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      {['Fecha cobro', 'Cliente', 'Campo/Lote', 'Servicio', 'Cultivo', 'Ha', '$/Ha', 'Neto', 'IVA %', 'Total'].map(h => (
                        <th key={h} style={th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {serviciosFiltrados.filter(s => s.estado_pago === 'cobrado').map(s => {
                      const neto = s.precio_ha && s.hectareas ? Math.round(s.precio_ha * s.hectareas) : null
                      const ivaPct = s.iva_pct || 0
                      const totalConIva = s.total || (neto ? Math.round(neto * (1 + ivaPct / 100)) : null)
                      return (
                        <tr key={s.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                          <td style={{ ...td_, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>
                            {s.fecha_cobro ? new Date(s.fecha_cobro+'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
                          </td>
                          <td style={{ ...td_, fontWeight: 600 }}>{s.cliente || '—'}</td>
                          <td style={td_}>{s.campo || '—'}{s.nro_lote ? ` · ${s.nro_lote}` : ''}</td>
                          <td style={td_}><span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: S.accentLight, color: S.accent }}>{s.labor}</span></td>
                          <td style={{ ...td_, color: S.muted }}>{s.cultivo || '—'}</td>
                          <td style={{ ...td_, fontFamily: 'monospace', textAlign: 'right' }}>{s.hectareas}</td>
                          <td style={{ ...td_, fontFamily: 'monospace', textAlign: 'right' }}>{s.precio_ha ? `$${s.precio_ha.toLocaleString('es-AR')}` : '—'}</td>
                          <td style={{ ...td_, fontFamily: 'monospace', textAlign: 'right' }}>{neto ? `$${neto.toLocaleString('es-AR')}` : '—'}</td>
                          <td style={{ ...td_, fontFamily: 'monospace', textAlign: 'right', color: S.muted }}>{ivaPct ? `${ivaPct}%` : '—'}</td>
                          <td style={{ ...td_, fontFamily: 'monospace', textAlign: 'right', fontWeight: 700, color: S.green }}>{totalConIva ? `$${totalConIva.toLocaleString('es-AR')}` : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: S.greenLight }}>
                      <td colSpan={5} style={{ ...td_, fontWeight: 700, color: S.green }}>TOTAL COBRADO</td>
                      <td style={{ ...td_, fontFamily: 'monospace', textAlign: 'right', fontWeight: 700 }}>
                        {serviciosFiltrados.filter(s => s.estado_pago === 'cobrado').reduce((a, s) => a + (s.hectareas || 0), 0).toLocaleString('es-AR')} ha
                      </td>
                      <td></td>
                      <td style={{ ...td_, fontFamily: 'monospace', textAlign: 'right', fontWeight: 700 }}>
                        ${serviciosFiltrados.filter(s => s.estado_pago === 'cobrado').reduce((a, s) => {
                          const neto = s.precio_ha && s.hectareas ? Math.round(s.precio_ha * s.hectareas) : (s.total || 0)
                          return a + neto
                        }, 0).toLocaleString('es-AR')}
                      </td>
                      <td></td>
                      <td style={{ ...td_, fontFamily: 'monospace', textAlign: 'right', fontWeight: 700, color: S.green }}>
                        ${serviciosFiltrados.filter(s => s.estado_pago === 'cobrado').reduce((a, s) => a + (s.total || 0), 0).toLocaleString('es-AR')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Banner pago */}
          {seleccionadas.length > 0 && (
            <div style={{ background: S.surface, border: `2px solid ${S.accent}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showPago ? '1rem' : 0 }}>
                <div style={{ fontWeight: 600, color: S.accent }}>
                  {seleccionadas.length} servicio{seleccionadas.length > 1 ? 's' : ''} seleccionado{seleccionadas.length > 1 ? 's' : ''}
                  <span style={{ fontFamily: 'monospace', marginLeft: 12 }}>${totalSeleccionadas.toLocaleString('es-AR')} neto</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={imprimirRecibo}
                    style={{ padding: '6px 14px', fontSize: 12, background: S.bg, border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>
                    🖨 Ver recibo
                  </button>
                  <button onClick={() => setShowPago(!showPago)}
                    style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, background: S.accent, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                    💳 Registrar cobro
                  </button>
                  <button onClick={() => setSeleccionadas([])}
                    style={{ padding: '6px 10px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>
                    ✕
                  </button>
                </div>
              </div>
              {showPago && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: '1rem' }}>
                    <div>
                      <Lbl>$/Ha (neto sin IVA)</Lbl>
                      <input type="number" value={formPago.precio_ha} onChange={e => setFormPago({ ...formPago, precio_ha: e.target.value })}
                        placeholder="Si todos tienen el mismo precio" style={inpMono} />
                    </div>
                    <div>
                      <Lbl>IVA %</Lbl>
                      <select value={formPago.iva_pct} onChange={e => setFormPago({ ...formPago, iva_pct: e.target.value })} style={inp}>
                        <option value="0">0% (sin factura)</option>
                        <option value="10.5">10.5%</option>
                        <option value="21">21%</option>
                      </select>
                    </div>
                    <div>
                      <Lbl>Total neto</Lbl>
                      <div style={{ padding: '9px 12px', background: S.bg, border: `1px solid ${S.border}`, borderRadius: 6, fontFamily: 'monospace', fontWeight: 600 }}>
                        ${totalSeleccionadas.toLocaleString('es-AR')}
                      </div>
                    </div>
                    <div>
                      <Lbl>Total con IVA</Lbl>
                      <div style={{ padding: '9px 12px', background: S.greenLight, border: `1px solid ${S.green}`, borderRadius: 6, fontFamily: 'monospace', fontWeight: 700, color: S.green }}>
                        ${totalConIva.toLocaleString('es-AR')}
                      </div>
                    </div>
                    <div>
                      <Lbl>Sin factura $</Lbl>
                      <input type="number" value={formPago.sin_factura} onChange={e => setFormPago({ ...formPago, sin_factura: e.target.value })}
                        placeholder="Monto cobrado sin factura"
                        style={{ ...inpMono, background: '#FDF8E8', border: `1px solid ${S.amber}`, color: S.amber, fontWeight: 600 }} />
                    </div>
                    <div>
                      <Lbl>Fecha cobro</Lbl>
                      <input type="date" value={formPago.fecha} onChange={e => setFormPago({ ...formPago, fecha: e.target.value })} style={inp} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Lbl>Formas de pago</Lbl>
                    <button onClick={() => setFormPago({ ...formPago, pagos: [...formPago.pagos, { ...PAGO_INIT }] })}
                      style={{ padding: '4px 10px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>
                      + Agregar
                    </button>
                  </div>
                  {formPago.pagos.map((p, pi) => (
                    <div key={pi} style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '.75rem', marginBottom: 6 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8, alignItems: 'flex-end' }}>
                        <div>
                          <Lbl>Forma de pago</Lbl>
                          <select value={p.tipo} onChange={e => { const pagos = formPago.pagos.map((x, i) => i === pi ? { ...x, tipo: e.target.value } : x); setFormPago({ ...formPago, pagos }) }} style={inp}>
                            {['transferencia', 'efectivo', 'cheque', 'e-cheq', 'canje'].map(t => (
                              <option key={t} value={t}>{t === 'cheque' ? '📄 Cheque' : t === 'e-cheq' ? '💻 E-cheq' : t === 'canje' ? '🔄 Canje / Trueque' : t.charAt(0).toUpperCase() + t.slice(1)}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Lbl>Monto $</Lbl>
                          <input type="number" value={p.monto} onChange={e => { const pagos = formPago.pagos.map((x, i) => i === pi ? { ...x, monto: e.target.value } : x); setFormPago({ ...formPago, pagos }) }} style={inpMono} />
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer', marginBottom: 2 }}>
                          <input type="checkbox" checked={p.es_paralelo} onChange={e => { const pagos = formPago.pagos.map((x, i) => i === pi ? { ...x, es_paralelo: e.target.checked } : x); setFormPago({ ...formPago, pagos }) }} />
                          Caja 2
                        </label>
                      </div>
                      {p.tipo === 'canje' && (
                        <div style={{ marginTop: 8 }}>
                          <Lbl>A cambio de</Lbl>
                          <input type="text" value={p.canje_detalle || ''} placeholder="ej. compra de agroquímico del 3/7"
                            onChange={e => { const pagos = formPago.pagos.map((x, i) => i === pi ? { ...x, canje_detalle: e.target.value } : x); setFormPago({ ...formPago, pagos }) }} style={inp} />
                        </div>
                      )}
                      {(p.tipo === 'cheque' || p.tipo === 'e-cheq') && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
                          <div><Lbl>N° Cheque</Lbl><input type="text" value={p.cheque_propio?.numero || ''} onChange={e => { const pagos = formPago.pagos.map((x, i) => i === pi ? { ...x, cheque_propio: { ...x.cheque_propio, numero: e.target.value } } : x); setFormPago({ ...formPago, pagos }) }} style={inpMono} /></div>
                          <div><Lbl>Banco</Lbl><input type="text" value={p.cheque_propio?.banco || ''} onChange={e => { const pagos = formPago.pagos.map((x, i) => i === pi ? { ...x, cheque_propio: { ...x.cheque_propio, banco: e.target.value } } : x); setFormPago({ ...formPago, pagos }) }} style={inp} /></div>
                          <div><Lbl>Vencimiento</Lbl><input type="date" value={p.cheque_propio?.fecha_vencimiento || ''} onChange={e => { const pagos = formPago.pagos.map((x, i) => i === pi ? { ...x, cheque_propio: { ...x.cheque_propio, fecha_vencimiento: e.target.value } } : x); setFormPago({ ...formPago, pagos }) }} style={inp} /></div>
                        </div>
                      )}
                    </div>
                  ))}
                  {(() => {
                    const totalPagos = formPago.pagos.reduce((a, p) => a + (parseFloat(p.monto) || 0), 0)
                    const sinFactura = parseFloat(formPago.sin_factura) || 0
                    const totalACobrar = totalConIva + sinFactura
                    const saldo = totalACobrar - totalPagos
                    return (
                      <div style={{ padding: '8px 12px', background: S.greenLight, borderRadius: 6, fontSize: 13, color: S.green, fontWeight: 600, marginTop: 8, marginBottom: 10 }}>
                        Total pagos: ${totalPagos.toLocaleString('es-AR')}
                        {sinFactura > 0 && <span style={{ color: S.amber }}> · Sin factura: ${sinFactura.toLocaleString('es-AR')}</span>}
                        {' · '}Total a cobrar: ${totalACobrar.toLocaleString('es-AR')}
                        {' · '}Saldo: ${saldo.toLocaleString('es-AR')}
                      </div>
                    )
                  })()}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={registrarPago} disabled={guardandoPago}
                      style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, background: S.green, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                      {guardandoPago ? 'Guardando...' : '✓ Confirmar cobro'}
                    </button>
                    <button onClick={() => setShowPago(false)}
                      style={{ padding: '8px 18px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TAB MANO DE OBRA ── */}
      {tab === 'mano_obra' && (() => {
        const ROLES_COSECHA = ['Maquinista', 'Tolvero', 'Ayudante']
        const ROLES_SIEMBRA = ['Sembrador 1', 'Sembrador 2', 'Sembrador 3', 'Ayudante']
        const rolesActuales = subTabMO === 'Cosecha' ? ROLES_COSECHA : subTabMO === 'Siembra' ? ROLES_SIEMBRA : [...ROLES_COSECHA, ...ROLES_SIEMBRA]

        // Filtrar servicios
        const serviciosMO = servicios.filter(s => {
          if (subTabMO && s.labor !== subTabMO) return false
          if (filtrosMO.campania && s.campania !== filtrosMO.campania) return false
          if (filtrosMO.cultivo && s.cultivo !== filtrosMO.cultivo) return false
          if (filtrosMO.tipo && s.tipo_servicio !== filtrosMO.tipo) return false
          if (filtrosMO.empleado) {
            const moList = manoObra[s.id] || []
            const enMO = moList.some(mo => mo.trabajador === filtrosMO.empleado)
            const enServicio = s.empleado1 === filtrosMO.empleado || s.empleado2 === filtrosMO.empleado
            if (!enMO && !enServicio) return false
          }
          return true
        })

        // Total para pago de empleado seleccionado
        const empleadoSeleccionado = filtrosMO.empleado
        const totalPagoMO = seleccionadasMO.reduce((a, id) => {
          const s = servicios.find(x => x.id === id)
          const mo = (manoObra[s?.id] || []).find(m => m.trabajador === empleadoSeleccionado)
          const cfg = configMO.find(c => s?.labor === 'Cosecha' ? ['Maquinista','Tolvero','Ayudante'].includes(c.rol) : ['Sembrador 1','Sembrador 2','Sembrador 3'].includes(c.rol))
          const pctDefault = mo?.porcentaje || (s?.tipo_servicio === 'propio' ? (cfg?.pct_propio || 0) : (cfg?.pct_tercero || 0))
          const pct = pctPagoMO[id] !== undefined ? pctPagoMO[id] : pctDefault
          const monto = s?.precio_ha && s?.hectareas && pct ? Math.round(s.precio_ha * s.hectareas * pct / 100) : 0
          return a + monto
        }, 0)

        return (
          <div>
            {/* Filtros — igual que servicios + empleado */}
            <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                <div>
                  <Lbl>Campaña</Lbl>
                  <select value={filtrosMO.campania} onChange={e => setFiltrosMO({ ...filtrosMO, campania: e.target.value })} style={{ ...inp, padding: '6px 8px' }}>
                    <option value="">Todas</option>
                    {campanas.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <Lbl>Servicio</Lbl>
                  <select value={subTabMO} onChange={e => setSubTabMO(e.target.value)} style={{ ...inp, padding: '6px 8px' }}>
                    <option value="">Todo</option>
                    {LABORES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <Lbl>Cultivo</Lbl>
                  <select value={filtrosMO.cultivo} onChange={e => setFiltrosMO({ ...filtrosMO, cultivo: e.target.value })} style={{ ...inp, padding: '6px 8px' }}>
                    <option value="">Todo</option>
                    {CULTIVOS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <Lbl>Tipo</Lbl>
                  <select value={filtrosMO.tipo} onChange={e => setFiltrosMO({ ...filtrosMO, tipo: e.target.value })} style={{ ...inp, padding: '6px 8px' }}>
                    <option value="">Todo</option>
                    <option value="tercero">Tercero</option>
                    <option value="propio">Propio</option>
                  </select>
                </div>
                <div>
                  <Lbl>Empleado</Lbl>
                  <select value={filtrosMO.empleado} onChange={e => { setFiltrosMO({ ...filtrosMO, empleado: e.target.value }); setSeleccionadasMO([]) }} style={{ ...inp, padding: '6px 8px', border: filtrosMO.empleado ? `1px solid ${S.accent}` : `1px solid ${S.border}`, fontWeight: filtrosMO.empleado ? 600 : 400 }}>
                    <option value="">Todos</option>
                    {todosEmpleados.map(e => <option key={e}>{e}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Tabla igual a servicios */}
            <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, overflow: 'auto', marginBottom: '1rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 1000 }}>
                <thead>
                  <tr>
                    <th style={{ ...th, width: 32 }}></th>
                    <th style={th}>Campaña</th>
                    <th style={th}>Fecha</th>
                    <th style={th}>Campo / Lote</th>
                    <th style={th}>Servicio</th>
                    <th style={th}>Cultivo</th>
                    <th style={th}>Tipo</th>
                    <th style={th}>Ha</th>
                    <th style={th}>$/Ha</th>
                    <th style={th}>$Total</th>
                    <th style={th}>Empleado 1</th>
                    <th style={th}>Estado</th>
                    <th style={th}>Empleado 2</th>
                    <th style={th}>Estado</th>
                    <th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {serviciosMO.length === 0 && (
                    <tr><td colSpan={15} style={{ ...td_, textAlign: 'center', color: S.hint, padding: '2rem' }}>
                      {filtrosMO.empleado ? `No hay trabajos para ${filtrosMO.empleado}.` : 'No hay servicios que coincidan.'}
                    </td></tr>
                  )}
                  {serviciosMO.map(s => {
                    const moList = manoObra[s.id] || []
                    const mo1 = (s.empleado1 ? moList.find(m => m.trabajador === s.empleado1) : moList[0]) || (s.empleado1 ? { trabajador: s.empleado1, porcentaje: null, monto_calculado: null, estado_pago: 'pendiente' } : null)
                    const mo2 = (s.empleado2 ? moList.find(m => m.trabajador === s.empleado2) : moList[1]) || (s.empleado2 ? { trabajador: s.empleado2, porcentaje: null, monto_calculado: null, estado_pago: 'pendiente' } : null)
                    const isSelected = seleccionadasMO.includes(s.id)
                    const moEmp = empleadoSeleccionado ? moList.find(m => m.trabajador === empleadoSeleccionado) : null
        const esEmpleadoDelServicio = empleadoSeleccionado && (s.empleado1 === empleadoSeleccionado || s.empleado2 === empleadoSeleccionado)
                    const isOpen = manoObraOpen === s.id

                    return (
                      <React.Fragment key={s.id}>
                        <tr style={{ background: isSelected ? S.accentLight : S.surface }}>
                          <td style={{ ...td_, textAlign: 'center' }}>
                            {empleadoSeleccionado && esEmpleadoDelServicio && (!moEmp || moEmp.estado_pago !== 'pagado') && (
                              <input type="checkbox" checked={isSelected} onChange={() => setSeleccionadasMO(prev => isSelected ? prev.filter(x => x !== s.id) : [...prev, s.id])} />
                            )}
                          </td>
                          <td style={{ ...td_, fontFamily: 'monospace', fontSize: 12 }}>{s.campania || '—'}</td>
                          <td style={{ ...td_, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{s.fecha ? new Date(s.fecha+'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}</td>
                          <td style={{ ...td_ }}><div style={{ fontWeight: 600 }}>{s.campo || '—'}{s.nro_lote ? <span style={{ fontWeight: 400, color: S.muted }}> · {s.nro_lote}</span> : ''}</div><div style={{ fontSize: 11, color: S.muted }}>{s.cliente}</div></td>
                          <td style={td_}><span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: S.accentLight, color: S.accent }}>{s.labor}</span></td>
                          <td style={{ ...td_, color: S.muted }}>{s.cultivo || '—'}</td>
                          <td style={td_}><span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: s.tipo_servicio === 'propio' ? S.purpleLight : S.bg, color: s.tipo_servicio === 'propio' ? S.purple : S.muted }}>{s.tipo_servicio === 'propio' ? 'Propio' : 'Tercero'}</span></td>
                          <td style={{ ...td_, fontFamily: 'monospace', textAlign: 'right' }}>{s.hectareas}</td>
                          <td style={{ ...td_, fontFamily: 'monospace', textAlign: 'right', color: s.precio_ha ? S.text : S.amber }}>{s.precio_ha ? `$${s.precio_ha.toLocaleString('es-AR')}` : '—'}</td>
                          <td style={{ ...td_, fontFamily: 'monospace', textAlign: 'right', fontWeight: 700 }}>{s.total ? `$${s.total.toLocaleString('es-AR')}` : '—'}</td>
                          <td style={td_}><div style={{ fontWeight: 600, fontSize: 12 }}>{mo1?.trabajador || '—'}</div>{mo1 && <div style={{ fontSize: 11, color: S.muted }}>{mo1.porcentaje}% · {mo1.monto_calculado ? `$${mo1.monto_calculado.toLocaleString('es-AR')}` : '—'}</div>}</td>
                          <td style={td_}>{mo1 && <span style={{ padding: '2px 5px', borderRadius: 3, fontSize: 10, fontWeight: 600, background: mo1.estado_pago === 'pagado' ? S.greenLight : S.amberLight, color: mo1.estado_pago === 'pagado' ? S.green : S.amber }}>{mo1.estado_pago === 'pagado' ? '✓ Pagado' : '⏳ Pend.'}</span>}</td>
                          <td style={td_}><div style={{ fontWeight: 600, fontSize: 12 }}>{mo2?.trabajador || '—'}</div>{mo2 && <div style={{ fontSize: 11, color: S.muted }}>{mo2.porcentaje}% · {mo2.monto_calculado ? `$${mo2.monto_calculado.toLocaleString('es-AR')}` : '—'}</div>}</td>
                          <td style={td_}>{mo2 && <span style={{ padding: '2px 5px', borderRadius: 3, fontSize: 10, fontWeight: 600, background: mo2.estado_pago === 'pagado' ? S.greenLight : S.amberLight, color: mo2.estado_pago === 'pagado' ? S.green : S.amber }}>{mo2.estado_pago === 'pagado' ? '✓ Pagado' : '⏳ Pend.'}</span>}</td>
                        </tr>
                      </React.Fragment>
                    )
                  })}
                </tbody>
                {serviciosMO.length > 0 && (
                  <tfoot>
                    <tr style={{ background: S.accentLight }}>
                      <td colSpan={7} style={{ ...td_, fontWeight: 700 }}>TOTAL ({serviciosMO.length})</td>
                      <td style={{ ...td_, fontFamily: 'monospace', textAlign: 'right', fontWeight: 700 }}>{serviciosMO.reduce((a, s) => a + (s.hectareas || 0), 0)} ha</td>
                      <td></td>
                      <td style={{ ...td_, fontFamily: 'monospace', textAlign: 'right', fontWeight: 700, color: S.green }}>${serviciosMO.reduce((a, s) => a + (s.total || 0), 0).toLocaleString('es-AR')}</td>
                      <td colSpan={5}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Banner pago empleado */}
            {seleccionadasMO.length > 0 && empleadoSeleccionado && (
              <div style={{ background: S.surface, border: `2px solid ${S.green}`, borderRadius: 10, padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: showPagoMO ? '1rem' : 0 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: S.green }}>👷 {empleadoSeleccionado}</div>
                    <div style={{ fontSize: 13, color: S.muted, marginTop: 4 }}>
                      {seleccionadasMO.length} trabajo{seleccionadasMO.length > 1 ? 's' : ''} seleccionado{seleccionadasMO.length > 1 ? 's' : ''}
                    </div>
                    {/* Detalle por trabajo */}
                    <div style={{ marginTop: 8 }}>
                      {seleccionadasMO.map(id => {
                        const s = servicios.find(x => x.id === id)
                        const mo = (manoObra[s?.id] || []).find(m => m.trabajador === empleadoSeleccionado)
                        const cfg = configMO.find(c => s?.labor === 'Cosecha' ? ['Maquinista','Tolvero','Ayudante'].includes(c.rol) : ['Sembrador 1','Sembrador 2','Sembrador 3'].includes(c.rol))
                        const pctDefault = mo?.porcentaje || (s?.tipo_servicio === 'propio' ? (cfg?.pct_propio || 0) : (cfg?.pct_tercero || 0))
                        const pct = pctPagoMO[id] !== undefined ? pctPagoMO[id] : pctDefault
                        const monto = s?.precio_ha && s?.hectareas && pct ? Math.round(s.precio_ha * s.hectareas * pct / 100) : 0
                        return (
                          <div key={id} style={{ display: 'flex', gap: 10, marginBottom: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{s?.campo || s?.cliente}</span>
                            <span style={{ fontSize: 12, color: S.muted }}>{s?.hectareas} ha × {s?.precio_ha ? `$${s.precio_ha.toLocaleString('es-AR')}/ha` : 'sin precio'}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <input type="number" value={pct} min="0" max="100" step="0.5"
                                onChange={e => setPctPagoMO(prev => ({ ...prev, [id]: parseFloat(e.target.value) || 0 }))}
                                style={{ width: 60, padding: '4px 6px', border: `1px solid ${S.accent}`, borderRadius: 5, fontSize: 12, fontFamily: 'monospace', textAlign: 'center', background: S.surface }} />
                              <span style={{ fontSize: 12, color: S.muted }}>%</span>
                            </div>
                            <span style={{ fontWeight: 700, color: S.green, fontSize: 13 }}>{monto ? `$${monto.toLocaleString('es-AR')}` : '—'}</span>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 15, fontWeight: 700, color: S.green }}>
                      Total a pagar: ${totalPagoMO.toLocaleString('es-AR')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => {
                      const win = window.open('', '_blank')
                      const rows = seleccionadasMO.map(id => {
                        const s = servicios.find(x => x.id === id)
                        const mo = (manoObra[s?.id] || []).find(m => m.trabajador === empleadoSeleccionado)
                        const cfg = configMO.find(c => s?.labor === 'Cosecha' ? ['Maquinista','Tolvero','Ayudante'].includes(c.rol) : ['Sembrador 1','Sembrador 2','Sembrador 3'].includes(c.rol))
                        const pctDefault = mo?.porcentaje || (s?.tipo_servicio === 'propio' ? (cfg?.pct_propio || 0) : (cfg?.pct_tercero || 0))
                        const pct = pctPagoMO[id] !== undefined ? pctPagoMO[id] : pctDefault
                        const monto = s?.precio_ha && s?.hectareas && pct ? Math.round(s.precio_ha * s.hectareas * pct / 100) : 0
                        return `<tr><td>${s?.fecha ? new Date(s.fecha+'T12:00:00').toLocaleDateString('es-AR') : '—'}</td><td>${s?.campo || '—'}${s?.nro_lote ? ' · '+s.nro_lote : ''}</td><td>${s?.cliente || '—'}</td><td>${s?.labor} ${s?.cultivo || ''}</td><td style="text-align:right">${s?.hectareas}</td><td style="text-align:right">${s?.precio_ha ? '$'+s.precio_ha.toLocaleString('es-AR') : '—'}</td><td style="text-align:right">${pct}%</td><td style="text-align:right;font-weight:700">$${monto.toLocaleString('es-AR')}</td></tr>`
                      }).join('')
                      win.document.write(`<!DOCTYPE html><html><head><title>Liquidación — ${empleadoSeleccionado}</title><style>body{font-family:'IBM Plex Sans',sans-serif;padding:2rem;font-size:13px;color:#1A1916}h2{margin-bottom:.25rem}p{color:#6B6760;margin-bottom:1.5rem;font-size:12px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #E2DDD6;padding:8px 12px;text-align:left}th{background:#F7F5F0;font-weight:600;font-size:11px;text-transform:uppercase}tfoot td{background:#E8F4EB;font-weight:700}@media print{button{display:none}}</style></head><body>
                        <h2>Liquidación de Mano de Obra — Ramonda Hnos S.A.</h2>
                        <p>Empleado: <strong>${empleadoSeleccionado}</strong> · Fecha: ${new Date().toLocaleDateString('es-AR')}</p>
                        <table>
                          <thead><tr><th>Fecha</th><th>Campo/Lote</th><th>Cliente</th><th>Servicio</th><th style="text-align:right">Ha</th><th style="text-align:right">$/Ha</th><th style="text-align:right">%</th><th style="text-align:right">Total</th></tr></thead>
                          <tbody>${rows}</tbody>
                          <tfoot><tr>
                            <td colspan="4">TOTAL</td>
                            <td style="text-align:right">${seleccionadasMO.reduce((a,id) => { const s = servicios.find(x=>x.id===id); return a+(s?.hectareas||0) }, 0)} ha</td>
                            <td></td><td></td>
                            <td style="text-align:right">$${totalPagoMO.toLocaleString('es-AR')}</td>
                          </tr></tfoot>
                        </table>
                        <br><p style="font-size:11px;color:#9E9A94">Firma: ______________________________ · Aclaración: ______________________________</p>
                        <button onclick="window.print()" style="padding:8px 16px;background:#1E5C2E;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">🖨 Imprimir</button>
                      </body></html>`)
                      win.document.close()
                    }} style={{ padding: '8px 14px', fontSize: 12, background: S.bg, border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>
                      🖨 Ver liquidación
                    </button>
                    <button onClick={() => setShowPagoMO(!showPagoMO)}
                      style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.green, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                      💳 Registrar pago
                    </button>
                    <button onClick={() => setSeleccionadasMO([])}
                      style={{ padding: '8px 10px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>✕</button>
                  </div>
                </div>
                {showPagoMO && (
                  <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: '1rem' }}>
                      <div>
                        <Lbl>Fecha pago</Lbl>
                        <input type="date" value={formPagoMO.fecha} onChange={e => setFormPagoMO({ ...formPagoMO, fecha: e.target.value })} style={inp} />
                      </div>
                      <div>
                        <Lbl>Total a pagar</Lbl>
                        <div style={{ padding: '9px 12px', background: S.greenLight, border: `1px solid ${S.green}`, borderRadius: 6, fontFamily: 'monospace', fontWeight: 700, color: S.green }}>
                          ${totalPagoMO.toLocaleString('es-AR')}
                        </div>
                      </div>
                    </div>
                    <Lbl>Formas de pago</Lbl>
                    <div style={{ marginTop: 4 }}>
                      <ListaPagos pagos={formPagoMO.pagos} onChangePagos={n => setFormPagoMO({ ...formPagoMO, pagos: n })} chequesCartera={chequesCartera} S={S} soloTerceroSiParalelo />
                    </div>
                    <div style={{ padding: '8px 12px', background: S.greenLight, borderRadius: 6, fontSize: 13, color: S.green, fontWeight: 600, marginTop: 8, marginBottom: 10 }}>
                      Total pagos: ${formPagoMO.pagos.reduce((a, p) => a + (parseFloat(p.monto) || 0), 0).toLocaleString('es-AR')}
                      {' · '}Saldo: ${(totalPagoMO - formPagoMO.pagos.reduce((a, p) => a + (parseFloat(p.monto) || 0), 0)).toLocaleString('es-AR')}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={async () => {
                        setGuardandoPagoMO(true)
                        try {
                          const desc = `Mano de obra — ${empleadoSeleccionado} · ${seleccionadasMO.length} trabajo${seleccionadasMO.length > 1 ? 's' : ''}`
                          for (const p of formPagoMO.pagos.filter(p => p.monto)) {
                            const monto = parseFloat(p.monto) || 0
                            if (!monto) continue
                            if (p.tipo === 'canje') continue  // canje: no toca caja
                            let caja_oficial_id = null, caja_paralela_id = null
                            if (p.es_paralelo) {
                              const { data: cp, error: errCp } = await supabase.from('caja_paralela').insert({ fecha: formPagoMO.fecha, tipo: 'egreso', descripcion: desc, monto }).select().single()
                              if (errCp) { alert('Error al registrar en Caja 2: ' + errCp.message); return }
                              caja_paralela_id = cp?.id
                            } else {
                              const { data: co, error: errCo } = await supabase.from('caja_oficial').insert({ fecha: formPagoMO.fecha, tipo: 'egreso', categoria: 'Mano de obra', descripcion: desc, monto, forma_pago: p.subtipo_cheque || p.tipo }).select().single()
                              if (errCo) { alert('Error al registrar en caja oficial: ' + errCo.message); return }
                              caja_oficial_id = co?.id
                            }
                            if ((p.tipo === 'cheque' || p.tipo === 'e-cheq') && p.subtipo_cheque === 'propio' && p.cheque_propio?.fecha_vencimiento) {
                              const { error: errCheq } = await supabase.from('cheques').insert({ tipo: 'emitido', numero: p.cheque_propio.numero || null, banco: p.cheque_propio.banco || null, fecha_cobro: formPagoMO.fecha, fecha_vencimiento: p.cheque_propio.fecha_vencimiento, monto, beneficiario: empleadoSeleccionado || null, estado: 'en_cartera', caja_oficial_id, es_electronico: p.tipo === 'e-cheq' })
                              if (errCheq) { alert('Error al registrar el cheque: ' + errCheq.message); return }
                            } else if (p.subtipo_cheque === 'tercero' && p.cheque_tercero_ids?.length > 0) {
                              for (const chId of p.cheque_tercero_ids) await supabase.from('cheques').update({ estado: 'depositado' }).eq('id', parseInt(chId))
                            }
                          }
                          // Marcar como pagado — crear entrada si no existe
                          for (const id of seleccionadasMO) {
                            const s = servicios.find(x => x.id === id)
                            const moList = manoObra[id] || []
                            const mo = moList.find(m => m.trabajador === empleadoSeleccionado)
                            if (mo) {
                              const { error: eu } = await supabase.from('mano_obra_servicios').update({ estado_pago: 'pagado' }).eq('id', mo.id)
                              if (eu) { alert('Error al actualizar: ' + eu.message); return }
                            } else {
                              // Crear entrada con % ingresado en el banner
                              const cfg = configMO.find(c => s?.labor === 'Cosecha' ? ['Maquinista','Tolvero','Ayudante'].includes(c.rol) : ['Sembrador 1','Sembrador 2','Sembrador 3'].includes(c.rol))
                              const pctCfg = s?.tipo_servicio === 'propio' ? (cfg?.pct_propio || 0) : (cfg?.pct_tercero || 0)
                              const pct = pctPagoMO[id] !== undefined ? parseFloat(pctPagoMO[id]) : pctCfg
                              const montoCalc = s?.precio_ha && s?.hectareas && pct ? Math.round(s.precio_ha * s.hectareas * pct / 100) : null
                              const { error: ei } = await supabase.from('mano_obra_servicios').insert({
                                servicio_id: id,
                                trabajador: empleadoSeleccionado,
                                rol: cfg?.rol || 'Otro',
                                porcentaje: pct || null,
                                monto_calculado: montoCalc,
                                estado_pago: 'pagado',
                              })
                              if (ei) { alert('Error al crear registro: ' + ei.message); return }
                            }
                          }
                          setSeleccionadasMO([])
                          setShowPagoMO(false)
                          setPctPagoMO({})
                          setFormPagoMO({ fecha: hoyLocal(), iva_pct: '10.5', pagos: [{ ...PAGO_INIT }] })
                          await cargar()
                        } catch(e) {
                          alert('Error: ' + e.message)
                        } finally {
                          setGuardandoPagoMO(false)
                        }
                      }} disabled={guardandoPagoMO}
                        style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, background: S.green, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                        {guardandoPagoMO ? 'Guardando...' : '✓ Confirmar pago'}
                      </button>
                      <button onClick={() => setShowPagoMO(false)}
                        style={{ padding: '8px 18px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!empleadoSeleccionado && seleccionadasMO.length === 0 && (
              <div style={{ padding: '1rem', background: S.accentLight, borderRadius: 8, fontSize: 13, color: S.accent }}>
                💡 Filtrá por empleado para poder seleccionar trabajos y registrar el pago.
              </div>
            )}

            {/* Historial de pagos MO */}
            {(() => {
              const pagados = servicios.filter(s => {
                const moList = manoObra[s.id] || []
                const mo = empleadoSeleccionado
                  ? moList.find(m => m.trabajador === empleadoSeleccionado && m.estado_pago === 'pagado')
                  : moList.find(m => m.estado_pago === 'pagado')
                return !!mo
              })
              if (pagados.length === 0) return null
              return (
                <div style={{ marginTop: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem' }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Pagos registrados</div>
                  <button onClick={() => {
                    const win = window.open('', '_blank')
                    const allRows = pagados.map(s => {
                      const moList = manoObra[s.id] || []
                      const mosPagados = empleadoSeleccionado
                        ? moList.filter(m => m.trabajador === empleadoSeleccionado && m.estado_pago === 'pagado')
                        : moList.filter(m => m.estado_pago === 'pagado')
                      return mosPagados.map(mo => {
                        const montoCalc = mo.monto_calculado || (s.precio_ha && s.hectareas && mo.porcentaje ? Math.round(s.precio_ha * s.hectareas * mo.porcentaje / 100) : 0)
                        return `<tr><td>${s.campo || '—'}${s.nro_lote ? ' · '+s.nro_lote : ''}</td><td>${s.cliente || '—'}</td><td>${s.labor} ${s.cultivo || ''}</td><td style="text-align:right">${s.hectareas}</td><td style="text-align:right">${s.precio_ha ? '$'+s.precio_ha.toLocaleString('es-AR') : '—'}</td><td style="text-align:right">${mo.trabajador}</td><td style="text-align:right">${mo.porcentaje || '—'}%</td><td style="text-align:right;font-weight:700">$${montoCalc.toLocaleString('es-AR')}</td></tr>`
                      }).join('')
                    }).join('')
                    const totalPagado = pagados.reduce((a, s) => {
                      const moList = manoObra[s.id] || []
                      const mosPagados = empleadoSeleccionado ? moList.filter(m => m.trabajador === empleadoSeleccionado && m.estado_pago === 'pagado') : moList.filter(m => m.estado_pago === 'pagado')
                      return a + mosPagados.reduce((b, mo) => b + (mo.monto_calculado || 0), 0)
                    }, 0)
                    win.document.write(`<!DOCTYPE html><html><head><title>Liquidación Mano de Obra</title><style>body{font-family:'IBM Plex Sans',sans-serif;padding:2rem;font-size:13px}h2{margin-bottom:.25rem}p{color:#6B6760;font-size:12px;margin-bottom:1.5rem}table{width:100%;border-collapse:collapse}th,td{border:1px solid #E2DDD6;padding:8px 12px;text-align:left}th{background:#F7F5F0;font-weight:600;font-size:11px;text-transform:uppercase}tfoot td{background:#E8F4EB;font-weight:700}@media print{button{display:none}}</style></head><body>
                      <h2>Liquidación de Mano de Obra — Ramonda Hnos S.A.</h2>
                      <p>${empleadoSeleccionado ? 'Empleado: <strong>'+empleadoSeleccionado+'</strong> · ' : ''}Generado: ${new Date().toLocaleDateString('es-AR')}</p>
                      <table><thead><tr><th>Campo/Lote</th><th>Cliente</th><th>Servicio</th><th style="text-align:right">Ha</th><th style="text-align:right">$/Ha</th><th>Empleado</th><th style="text-align:right">%</th><th style="text-align:right">Total</th></tr></thead>
                      <tbody>${allRows}</tbody>
                      <tfoot><tr><td colspan="7">TOTAL PAGADO</td><td style="text-align:right">$${totalPagado.toLocaleString('es-AR')}</td></tr></tfoot>
                      </table>
                      <br><button onclick="window.print()" style="padding:8px 16px;background:#1E5C2E;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">🖨 Imprimir</button>
                    </body></html>`)
                    win.document.close()
                  }} style={{ padding: '5px 12px', fontSize: 12, background: S.bg, border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>
                    🖨 Imprimir liquidación
                  </button>
                </div>
                  <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr>{['Campo/Lote', 'Cliente', 'Servicio', 'Ha', '$/Ha', 'Empleado', '%', 'Total pagado'].map(h => (
                          <th key={h} style={th}>{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {pagados.map(s => {
                          const moList = manoObra[s.id] || []
                          const mosPagados = empleadoSeleccionado
                            ? moList.filter(m => m.trabajador === empleadoSeleccionado && m.estado_pago === 'pagado')
                            : moList.filter(m => m.estado_pago === 'pagado')
                          return mosPagados.map(mo => {
                            const montoCalc = mo.monto_calculado || (s.precio_ha && s.hectareas && mo.porcentaje ? Math.round(s.precio_ha * s.hectareas * mo.porcentaje / 100) : null)
                            return (
                              <tr key={mo.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                                <td style={{ ...td_, fontWeight: 600 }}>{s.campo || '—'}{s.nro_lote ? <span style={{ fontWeight: 400, color: S.muted }}> · {s.nro_lote}</span> : ''}</td>
                                <td style={{ ...td_, color: S.muted }}>{s.cliente || '—'}</td>
                                <td style={td_}><span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: S.accentLight, color: S.accent }}>{s.labor}</span></td>
                                <td style={{ ...td_, fontFamily: 'monospace', textAlign: 'right' }}>{s.hectareas}</td>
                                <td style={{ ...td_, fontFamily: 'monospace', textAlign: 'right', color: S.muted }}>{s.precio_ha ? `$${s.precio_ha.toLocaleString('es-AR')}` : '—'}</td>
                                <td style={{ ...td_, fontWeight: 600 }}>{mo.trabajador}</td>
                                <td style={{ ...td_, fontFamily: 'monospace', textAlign: 'right' }}>{mo.porcentaje}%</td>
                                <td style={{ ...td_, fontFamily: 'monospace', textAlign: 'right', fontWeight: 700, color: S.green }}>{montoCalc ? `$${montoCalc.toLocaleString('es-AR')}` : '—'}</td>
                              </tr>
                            )
                          })
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: S.greenLight }}>
                          <td colSpan={7} style={{ ...td_, fontWeight: 700, color: S.green }}>TOTAL PAGADO</td>
                          <td style={{ ...td_, fontFamily: 'monospace', textAlign: 'right', fontWeight: 700, color: S.green }}>
                            ${pagados.reduce((a, s) => {
                              const moList = manoObra[s.id] || []
                              const mosPagados = empleadoSeleccionado
                                ? moList.filter(m => m.trabajador === empleadoSeleccionado && m.estado_pago === 'pagado')
                                : moList.filter(m => m.estado_pago === 'pagado')
                              return a + mosPagados.reduce((b, mo) => b + (mo.monto_calculado || (s.precio_ha && s.hectareas && mo.porcentaje ? Math.round(s.precio_ha * s.hectareas * mo.porcentaje / 100) : 0)), 0)
                            }, 0).toLocaleString('es-AR')}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )
            })()}
          </div>
        )
      })()}

            {/* ── TAB MERCADERÍA ── */}
      {tab === 'mercaderia' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ fontSize: 13, color: S.muted }}>Registrá descargas de cosecha sin necesidad de crear un servicio previo.</div>
            <button onClick={() => setShowFormReg(!showFormReg)}
              style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.accent, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
              + Nuevo campo
            </button>
          </div>
          {showFormReg && (
            <div style={{ background: S.surface, border: `1px solid ${S.accent}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: '1rem' }}>Nuevo registro de campo</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
                <div><Lbl>Campo *</Lbl><input type="text" value={formReg.campo} onChange={e => setFormReg({ ...formReg, campo: e.target.value })} placeholder="ej. La Esperanza" style={inp} /></div>
                <div>
                  <Lbl>Cliente/Propietario</Lbl>
                  <select value={formReg.cliente} onChange={e => setFormReg({ ...formReg, cliente: e.target.value })} style={inp}>
                    <option value="">— Sin especificar —</option>
                    {contactos.filter(c => !c.actividades || c.actividades.length === 0 || c.actividades.includes('Servicios')).map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                  </select>
                </div>
                <div><Lbl>N° Lote</Lbl><input type="text" value={formReg.nro_lote} onChange={e => setFormReg({ ...formReg, nro_lote: e.target.value })} placeholder="ej. Lote 3" style={inp} /></div>
                <div><Lbl>Cultivo</Lbl><select value={formReg.cultivo} onChange={e => setFormReg({ ...formReg, cultivo: e.target.value })} style={inp}>{CULTIVOS.map(c => <option key={c}>{c}</option>)}</select></div>
                <div><Lbl>Fecha inicio</Lbl><input type="date" value={formReg.fecha} onChange={e => setFormReg({ ...formReg, fecha: e.target.value })} style={inp} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={async () => {
                  if (!formReg.campo) { alert('Ingresá el campo'); return }
                  setGuardandoReg(true)
                  const { data, error } = await supabase.from('registros_mercaderia').insert({
                    campo: formReg.campo,
                    cliente: formReg.cliente || null,
                    nro_lote: formReg.nro_lote || null,
                    cultivo: formReg.cultivo || null,
                    fecha: formReg.fecha || null,
                  }).select().single()
                  if (error) { alert('Error: ' + error.message); setGuardandoReg(false); return }
                  if (data) {
                    setRegistros(prev => [data, ...prev])
                    setRegistroActivo(data)
                    setDescargasReg(prev => ({ ...prev, [data.id]: [] }))
                  }
                  setShowFormReg(false)
                  setFormReg({ campo: '', cliente: '', nro_lote: '', cultivo: 'Maíz', fecha: hoyLocal() })
                  setGuardandoReg(false)
                }} disabled={guardandoReg}
                  style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, background: S.accent, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                  {guardandoReg ? 'Guardando...' : '💾 Crear registro'}
                </button>
                <button onClick={() => setShowFormReg(false)} style={{ padding: '8px 18px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
              </div>
            </div>
          )}
          {registros.length === 0 && !showFormReg && <div style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay registros. Creá uno con "+ Nuevo campo".</div>}
          {registros.map(reg => {
            const desc = descargasReg[reg.id] || []
            const kgCamion = desc.filter(d => d.tipo === 'camion').reduce((a, d) => a + (d.kg || 0), 0)
            const kgBolsa = desc.filter(d => d.tipo === 'bolsa').reduce((a, d) => a + (d.kg || 0), 0)
            const kgOtro = desc.filter(d => d.tipo === 'otro').reduce((a, d) => a + (d.kg || 0), 0)
            const kgTotal = kgCamion + kgBolsa + kgOtro
            const isActivo = registroActivo?.id === reg.id
            return (
              <div key={reg.id} style={{ background: S.surface, border: `1px solid ${isActivo ? S.accent : S.border}`, borderRadius: 10, marginBottom: '1rem', overflow: 'hidden' }}>
                <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{reg.campo}</div>
                    <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>
                      {reg.cliente || '—'} · {reg.nro_lote || 'Sin lote'} · {reg.cultivo}
                      {reg.fecha ? ` · ${new Date(reg.fecha+'T12:00:00').toLocaleDateString('es-AR')}` : ''}
                    </div>
                    {kgTotal > 0 && (
                      <div style={{ marginTop: 6, display: 'flex', gap: 12, fontSize: 12, flexWrap: 'wrap' }}>
                        {kgCamion > 0 && <span style={{ color: S.accent }}>🚛 {kgCamion.toLocaleString('es-AR')} kg</span>}
                        {kgBolsa > 0 && <span style={{ color: S.green }}>🌾 {kgBolsa.toLocaleString('es-AR')} kg</span>}
                        {kgOtro > 0 && <span style={{ color: S.muted }}>📦 {kgOtro.toLocaleString('es-AR')} kg</span>}
                        <strong>Total: {kgTotal.toLocaleString('es-AR')} kg</strong>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12 }}>
                    {isActivo && kgTotal > 0 && (
                      <button onClick={() => descargarPDFMercaderia(reg, desc, kgCamion, kgBolsa, kgOtro, kgTotal)}
                        style={{ padding: '6px 12px', fontSize: 12, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                        ⬇ Descargar PDF
                      </button>
                    )}
                    {isActivo && kgTotal > 0 && (
                      <button onClick={() => {
                        const win = window.open('', '_blank')
                        const rows = desc.map(d => `<tr><td>${d.fecha ? new Date(d.fecha+'T12:00:00').toLocaleDateString('es-AR') : '—'}</td><td>${d.tipo === 'camion' ? '🚛 Camión' : d.tipo === 'bolsa' ? '🌾 Bolsa' : '📦 Otro'}</td><td>${d.patente || d.observaciones || '—'}</td><td style="text-align:right;font-family:monospace;font-weight:600">${(d.kg||0).toLocaleString('es-AR')} kg</td></tr>`).join('')
                        win.document.write(`<!DOCTYPE html><html><head><title>Mercadería — ${reg.campo}</title><style>body{font-family:'IBM Plex Sans',sans-serif;padding:2rem;font-size:13px;color:#1A1916}h2{margin-bottom:.25rem}p{color:#6B6760;margin-bottom:1.5rem;font-size:12px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #E2DDD6;padding:8px 12px;text-align:left}th{background:#F7F5F0;font-weight:600;font-size:11px;text-transform:uppercase}tfoot tr{background:#E8F4EB;font-weight:700}.resumen{margin-top:1.5rem;padding:1rem;background:#F7F5F0;border-radius:8px}@media print{button{display:none}}</style></head><body>
                          <h2>Registro de Mercadería</h2>
                          <p>Campo: <strong>${reg.campo}</strong> · Cliente: ${reg.cliente || '—'} · Lote: ${reg.nro_lote || '—'} · Cultivo: ${reg.cultivo || '—'}</p>
                          <table>
                            <thead><tr><th>Fecha</th><th>Tipo</th><th>Patente / Detalle</th><th>Kg</th></tr></thead>
                            <tbody>${rows}</tbody>
                            <tfoot><tr><td colspan="3">TOTAL</td><td style="text-align:right;font-family:monospace">${kgTotal.toLocaleString('es-AR')} kg</td></tr></tfoot>
                          </table>
                          <div class="resumen">
                            <strong>Resumen:</strong><br>
                            ${kgCamion > 0 ? `🚛 Camión: <strong>${kgCamion.toLocaleString('es-AR')} kg</strong><br>` : ''}
                            ${kgBolsa > 0 ? `🌾 Bolsa: <strong>${kgBolsa.toLocaleString('es-AR')} kg</strong><br>` : ''}
                            ${kgOtro > 0 ? `📦 Otro: <strong>${kgOtro.toLocaleString('es-AR')} kg</strong><br>` : ''}
                            <br>Total: <strong>${kgTotal.toLocaleString('es-AR')} kg</strong>
                          </div>
                          <br><button onclick="window.print()" style="padding:8px 16px;background:#1A3D6B;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">🖨 Imprimir</button>
                        </body></html>`)
                        win.document.close()
                      }} style={{ padding: '6px 12px', fontSize: 12, background: S.greenLight, border: `1px solid ${S.green}`, color: S.green, borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                        🖨 Imprimir
                      </button>
                    )}
                    <button onClick={async () => {
                      if (isActivo) { setRegistroActivo(null); return }
                      await cargarDescargasReg(reg.id)
                      setRegistroActivo(reg)
                    }} style={{ padding: '6px 12px', fontSize: 12, background: isActivo ? S.accentLight : S.bg, border: `1px solid ${isActivo ? S.accent : S.border}`, color: isActivo ? S.accent : S.muted, borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                      {isActivo ? '▲ Cerrar' : '📦 Ver / Registrar'}
                    </button>
                    <button onClick={async () => {
                      if (!confirm(`¿Eliminar el registro de "${reg.campo}"? Se borrarán también todas las descargas.`)) return
                      await supabase.from('descargas_mercaderia').delete().eq('registro_id', reg.id)
                      await supabase.from('registros_mercaderia').delete().eq('id', reg.id)
                      setRegistros(prev => prev.filter(r => r.id !== reg.id))
                      if (registroActivo?.id === reg.id) setRegistroActivo(null)
                    }} style={{ padding: '6px 10px', fontSize: 12, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 6, cursor: 'pointer' }}>
                      🗑
                    </button>
                  </div>
                </div>
                {isActivo && (
                  <div style={{ borderTop: `1px solid ${S.border}`, padding: '1rem', background: S.bg }}>
                    {desc.length > 0 && (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: '1rem' }}>
                        <thead><tr>{['Fecha', 'Tipo', 'Patente/Detalle', 'Kg'].map(h => <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>)}</tr></thead>
                        <tbody>
                          {desc.map(d => (
                            <tr key={d.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                              <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: S.muted }}>{d.fecha ? new Date(d.fecha+'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '—'}</td>
                              <td style={{ padding: '7px 10px' }}><span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: d.tipo === 'camion' ? S.accentLight : d.tipo === 'bolsa' ? S.greenLight : S.amberLight, color: d.tipo === 'camion' ? S.accent : d.tipo === 'bolsa' ? S.green : S.amber }}>{d.tipo === 'camion' ? '🚛 Camión' : d.tipo === 'bolsa' ? '🌾 Bolsa' : '📦 Otro'}</span></td>
                              <td style={{ padding: '7px 10px', color: S.muted, fontFamily: 'monospace' }}>{d.patente || d.observaciones || '—'}</td>
                              <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontWeight: 700 }}>{(d.kg || 0).toLocaleString('es-AR')} kg</td>
                              <td style={{ padding: '7px 10px' }}>
                                <button onClick={async () => {
                                  if (!confirm('¿Eliminar esta descarga?')) return
                                  await supabase.from('descargas_mercaderia').delete().eq('id', d.id)
                                  await cargarDescargasReg(reg.id)
                                }} style={{ padding: '3px 7px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 4, cursor: 'pointer' }}>🗑</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: S.accentLight }}>
                            <td colSpan={3} style={{ padding: '8px 10px', fontWeight: 600, fontSize: 12 }}>
                              {kgCamion > 0 && `🚛 ${kgCamion.toLocaleString('es-AR')} kg`}
                              {kgCamion > 0 && kgBolsa > 0 && ' · '}
                              {kgBolsa > 0 && `🌾 ${kgBolsa.toLocaleString('es-AR')} kg`}
                              {kgOtro > 0 && ` · 📦 ${kgOtro.toLocaleString('es-AR')} kg`}
                            </td>
                            <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 700, color: S.accent }}>{kgTotal.toLocaleString('es-AR')} kg</td>
                          </tr>
                        </tfoot>
                      </table>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'flex-end' }}>
                      <div>
                        <Lbl>Tipo</Lbl>
                        <select value={formDescargaReg.tipo} onChange={e => setFormDescargaReg({ ...formDescargaReg, tipo: e.target.value })} style={inp}>
                          <option value="camion">🚛 Camión</option>
                          <option value="bolsa">🌾 Bolsa</option>
                          <option value="otro">📦 Otro</option>
                        </select>
                      </div>
                      <div>
                        <Lbl>{formDescargaReg.tipo === 'camion' ? 'Patente' : 'Detalle'}</Lbl>
                        <input type="text" value={formDescargaReg.tipo === 'camion' ? formDescargaReg.patente : formDescargaReg.observaciones}
                          onChange={e => setFormDescargaReg({ ...formDescargaReg, [formDescargaReg.tipo === 'camion' ? 'patente' : 'observaciones']: e.target.value })}
                          placeholder={formDescargaReg.tipo === 'camion' ? 'ej. ABC 123' : 'ej. Bolsa 8'}
                          style={{ ...inp, textTransform: formDescargaReg.tipo === 'camion' ? 'uppercase' : 'none' }} />
                      </div>
                      <div><Lbl>Kg *</Lbl><input type="number" value={formDescargaReg.kg} onChange={e => setFormDescargaReg({ ...formDescargaReg, kg: e.target.value })} placeholder="ej. 28500" style={inpMono} /></div>
                      <div><Lbl>Fecha</Lbl><input type="date" value={formDescargaReg.fecha} onChange={e => setFormDescargaReg({ ...formDescargaReg, fecha: e.target.value })} style={inp} /></div>
                      <button onClick={async () => {
                        if (!formDescargaReg.kg) { alert('Ingresá los kg'); return }
                        setGuardandoDescargaReg(true)
                        await supabase.from('descargas_mercaderia').insert({ registro_id: reg.id, fecha: formDescargaReg.fecha, tipo: formDescargaReg.tipo, patente: formDescargaReg.tipo === 'camion' ? (formDescargaReg.patente || null) : null, kg: parseFloat(formDescargaReg.kg), observaciones: formDescargaReg.tipo !== 'camion' ? (formDescargaReg.observaciones || null) : null, registrado_por: usuario?.id })
                        setFormDescargaReg({ tipo: 'camion', patente: '', kg: '', observaciones: '', fecha: hoyLocal() })
                        setGuardandoDescargaReg(false)
                        await cargarDescargasReg(reg.id)
                      }} disabled={guardandoDescargaReg}
                        style={{ padding: '9px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {guardandoDescargaReg ? '...' : '+ Registrar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
