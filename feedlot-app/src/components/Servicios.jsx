import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

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
const PAGO_INIT = { tipo: 'transferencia', monto: '', es_paralelo: false, cheque_propio: { numero: '', banco: '', fecha_vencimiento: '' } }

export default function Servicios({ usuario }) {
  const [tab, setTab] = useState('servicios')
  const [loading, setLoading] = useState(true)
  const [campanas, setCampanas] = useState([])
  const [showNuevaCampana, setShowNuevaCampana] = useState(false)
  const [nuevaCampana, setNuevaCampana] = useState('')
  const [servicios, setServicios] = useState([])
  const [manoObra, setManoObra] = useState({})
  const [contactos, setContactos] = useState([])
  const [chequesCartera, setChequesCartera] = useState([])
  const [registros, setRegistros] = useState([])
  const [descargasReg, setDescargasReg] = useState({})

  // Filtros
  const [filtros, setFiltros] = useState({ campania: '', cliente: '', labor: '', cultivo: '', tipo: '', estado: '', empleado: '' })

  // Form nuevo servicio
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ campania: campanas[0]?.nombre || '2025/26', cliente: '', clienteNuevo: '', labor: 'Siembra', cultivo: 'Maíz', tipo_servicio: 'tercero', campo: '', nro_lote: '', fecha: new Date().toISOString().split('T')[0], hectareas: '', empleado1: '', empleado2: '', observaciones: '' })
  const [guardando, setGuardando] = useState(false)

  // Mano de obra
  const [configMO, setConfigMO] = useState([]) // config_mano_obra
  const [manoObraOpen, setManoObraOpen] = useState(null)
  const [guardandoConfigMO, setGuardandoConfigMO] = useState(false)
  const [filtrosMO, setFiltrosMO] = useState({ campania: '', labor: '', cultivo: '', tipo: '', estado: '', empleado: '' })
  const [seleccionadasMO, setSeleccionadasMO] = useState([])
  const [showPagoMO, setShowPagoMO] = useState(false)
  const [formPagoMO, setFormPagoMO] = useState({ fecha: new Date().toISOString().split('T')[0], iva_pct: '10.5', pagos: [{ ...PAGO_INIT }] })
  const [guardandoPagoMO, setGuardandoPagoMO] = useState(false)
  const [pctPagoMO, setPctPagoMO] = useState({}) // { [servicio_id]: pct } editable en el banner
  const [formMO, setFormMO] = useState({ trabajador: '', rol: 'Maquinista', porcentaje: '' })
  const [guardandoMO, setGuardandoMO] = useState(false)
  const [subTabMO, setSubTabMO] = useState('')
  const [filtroEmpleadoMO, setFiltroEmpleadoMO] = useState('')

  // Pago
  const [seleccionadas, setSeleccionadas] = useState([])
  const [showPago, setShowPago] = useState(false)
  const [formPago, setFormPago] = useState({ fecha: new Date().toISOString().split('T')[0], iva_pct: '10.5', precio_ha: '', sin_factura: '', pagos: [{ ...PAGO_INIT }] })
  const [guardandoPago, setGuardandoPago] = useState(false)
  const reciboRef = useRef(null)

  // Editar
  const [editandoId, setEditandoId] = useState(null)
  const [formEdit, setFormEdit] = useState({})

  // Descargas mercadería
  const [registroActivo, setRegistroActivo] = useState(null)
  const [showFormReg, setShowFormReg] = useState(false)
  const [formReg, setFormReg] = useState({ campo: '', cliente: '', nro_lote: '', cultivo: 'Maíz', fecha: new Date().toISOString().split('T')[0] })
  const [formDescargaReg, setFormDescargaReg] = useState({ tipo: 'camion', patente: '', kg: '', observaciones: '', fecha: new Date().toISOString().split('T')[0] })
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

  async function cargar() {
    const { data: camps } = await supabase.from('campanas').select('*').eq('activa', true).order('nombre', { ascending: false })
    setCampanas(camps || [])
    const [{ data: s }, { data: ct }, { data: ch }, { data: regs }] = await Promise.all([
      supabase.from('servicios_terceros').select('*').order('fecha', { ascending: false }),
      supabase.from('contactos').select('id, nombre').order('nombre'),
      supabase.from('cheques').select('*').eq('tipo', 'recibido').eq('estado', 'en_cartera'),
      supabase.from('registros_mercaderia').select('*').order('created_at', { ascending: false }),
    ])
    setServicios(s || [])
    setContactos(ct || [])
    setChequesCartera(ch || [])
    setRegistros(regs || [])
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

  async function cargarDescargasReg(regId) {
    const { data } = await supabase.from('descargas_mercaderia').select('*').eq('registro_id', regId).order('creado_en')
    setDescargasReg(prev => ({ ...prev, [regId]: data || [] }))
  }

  async function guardar() {
    if (!form.labor || !form.hectareas) { alert('Completá labor y hectáreas'); return }
    if (form.tipo_servicio === 'tercero' && !form.cliente && !form.clienteNuevo) { alert('Ingresá el cliente'); return }
    setGuardando(true)
    let clienteNombre = form.tipo_servicio === 'propio' ? 'Ramonda Hnos SA' : (form.cliente === '__nuevo__' ? form.clienteNuevo?.trim() : form.cliente)
    if (form.cliente === '__nuevo__' && form.clienteNuevo?.trim()) {
      const existe = contactos.find(c => c.nombre.toLowerCase() === form.clienteNuevo.trim().toLowerCase())
      if (!existe) await supabase.from('contactos').insert({ nombre: form.clienteNuevo.trim(), activo: true })
    }
    await supabase.from('servicios_terceros').insert({
      campania: form.campania,
      cliente: clienteNombre,
      labor: form.labor,
      cultivo: form.cultivo,
      tipo_servicio: form.tipo_servicio,
      campo: form.campo || null,
      nro_lote: form.nro_lote || null,
      fecha: form.fecha,
      hectareas: parseFloat(form.hectareas),
      empleado1: form.empleado1 || null,
      empleado2: form.empleado2 || null,
      estado: 'pendiente',
    })
    setShowForm(false)
    setForm({ campania: campanas[0]?.nombre || '2025/26', cliente: '', clienteNuevo: '', labor: 'Siembra', cultivo: 'Maíz', tipo_servicio: 'tercero', campo: '', nro_lote: '', fecha: new Date().toISOString().split('T')[0], hectareas: '', empleado1: '', empleado2: '', observaciones: '' })
    setGuardando(false)
    await cargar()
  }

  async function guardarEdit() {
    await supabase.from('servicios_terceros').update({
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
    setEditandoId(null)
    await cargar()
  }

  async function guardarMO(servicioId, s) {
    if (!formMO.trabajador || !formMO.porcentaje) { alert('Completá trabajador y %'); return }
    setGuardandoMO(true)
    const pct = parseFloat(formMO.porcentaje)
    const monto = s.precio_ha && s.hectareas ? Math.round(s.precio_ha * s.hectareas * pct / 100) : null
    await supabase.from('mano_obra_servicios').insert({ servicio_id: servicioId, trabajador: formMO.trabajador, rol: formMO.rol, porcentaje: pct, monto_calculado: monto })
    setFormMO({ trabajador: '', rol: 'Maquinista', porcentaje: '' })
    setGuardandoMO(false)
    await cargar()
  }

  async function registrarPago() {
    if (seleccionadas.length === 0) { alert('Seleccioná al menos un servicio'); return }
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
          if (p.es_paralelo) {
            const { data: cp, error: ep } = await supabase.from('caja_paralela').insert({ fecha: formPago.fecha, tipo: 'ingreso', descripcion: desc, monto }).select().single()
            if (ep) { alert('Error al registrar caja paralela: ' + ep.message); setGuardandoPago(false); return }
            caja_paralela_id = cp?.id
          } else {
            const { data: co, error: eo } = await supabase.from('caja_oficial').insert({ fecha: formPago.fecha, tipo: 'ingreso', categoria: 'Servicios a terceros', descripcion: desc, monto, forma_pago: p.tipo }).select().single()
            if (eo) { alert('Error al registrar caja oficial: ' + eo.message); setGuardandoPago(false); return }
            caja_oficial_id = co?.id
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
        }
        if (precioHa) updateData.precio_ha = precioHa
        if (totalConIva > 0) updateData.total = totalConIva
        const { error: eu } = await supabase.from('servicios_terceros').update(updateData).eq('id', id)
        if (eu) { alert('Error al actualizar servicio: ' + eu.message); setGuardandoPago(false); return }
      }
      setSeleccionadas([])
      setShowPago(false)
      setFormPago({ fecha: new Date().toISOString().split('T')[0], iva_pct: '10.5', precio_ha: '', sin_factura: '', pagos: [{ ...PAGO_INIT }] })
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
      <table><thead><tr><th>Fecha</th><th>Campo/Lote</th><th>Servicio/Cultivo</th><th>Ha</th><th>$/Ha</th><th>Neto</th><th>Total c/IVA</th><th>Paralelo</th></tr></thead>
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

  const todosEmpleados = [...new Set([
    ...servicios.map(s => s.empleado1).filter(Boolean),
    ...servicios.map(s => s.empleado2).filter(Boolean),
    ...Object.values(manoObra).flat().map(mo => mo.trabajador).filter(Boolean),
  ])].sort()

  const totalSeleccionadas = seleccionadas.reduce((a, id) => {
    const s = servicios.find(x => x.id === id)
    const precioHa = formPago.precio_ha ? parseFloat(formPago.precio_ha) : s?.precio_ha
    return a + (precioHa && s?.hectareas ? Math.round(precioHa * s.hectareas) : (s?.total || 0))
  }, 0)
  const totalConIva = Math.round(totalSeleccionadas * (1 + (parseFloat(formPago.iva_pct) || 0) / 100))

  if (loading) return <div style={{ padding: '2rem', color: S.muted }}>Cargando...</div>

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
                        await supabase.from('campanas').update({ activa: false }).eq('id', c.id)
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
                        await supabase.from('campanas').insert({ nombre: nuevaCampana.trim(), activa: true })
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
                  <select value={form.tipo_servicio} onChange={e => setForm({ ...form, tipo_servicio: e.target.value })} style={inp}>
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
                      {contactos.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                      <option value="__nuevo__">+ Nuevo cliente...</option>
                    </select>
                    {form.cliente === '__nuevo__' && (
                      <input type="text" placeholder="Nombre del cliente" value={form.clienteNuevo}
                        onChange={e => setForm({ ...form, clienteNuevo: e.target.value })}
                        style={{ ...inp, marginTop: 6 }} />
                    )}
                  </div>
                )}
                <div>
                  <Lbl>Fecha</Lbl>
                  <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} style={inp} />
                </div>
                <div>
                  <Lbl>Campo</Lbl>
                  <input type="text" value={form.campo} onChange={e => setForm({ ...form, campo: e.target.value })} placeholder="ej. La Esperanza" style={inp} />
                </div>
                <div>
                  <Lbl>N° Lote</Lbl>
                  <input type="text" value={form.nro_lote} onChange={e => setForm({ ...form, nro_lote: e.target.value })} placeholder="ej. Lote 5" style={inp} />
                </div>
                <div>
                  <Lbl>Hectáreas *</Lbl>
                  <input type="number" value={form.hectareas} onChange={e => setForm({ ...form, hectareas: e.target.value })} placeholder="ej. 120" style={inpMono} />
                </div>
                <div>
                  <Lbl>Empleado 1</Lbl>
                  <input type="text" value={form.empleado1} onChange={e => setForm({ ...form, empleado1: e.target.value })} placeholder="ej. Martín" style={inp} />
                </div>
                <div>
                  <Lbl>Empleado 2</Lbl>
                  <input type="text" value={form.empleado2} onChange={e => setForm({ ...form, empleado2: e.target.value })} placeholder="ej. Brian" style={inp} />
                </div>
              </div>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
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
                          <div><Lbl>Cliente</Lbl><input type="text" value={formEdit.cliente} onChange={e => setFormEdit({ ...formEdit, cliente: e.target.value })} style={{ ...inp, padding: '6px 8px' }} /></div>
                          <div><Lbl>Campo</Lbl><input type="text" value={formEdit.campo || ''} onChange={e => setFormEdit({ ...formEdit, campo: e.target.value })} style={{ ...inp, padding: '6px 8px' }} /></div>
                          <div><Lbl>N° Lote</Lbl><input type="text" value={formEdit.nro_lote || ''} onChange={e => setFormEdit({ ...formEdit, nro_lote: e.target.value })} style={{ ...inp, padding: '6px 8px' }} /></div>
                          <div><Lbl>Hectáreas</Lbl><input type="number" value={formEdit.hectareas} onChange={e => setFormEdit({ ...formEdit, hectareas: e.target.value })} style={{ ...inpMono, padding: '6px 8px' }} /></div>
                          <div><Lbl>Empleado 1</Lbl><input type="text" value={formEdit.empleado1 || ''} onChange={e => setFormEdit({ ...formEdit, empleado1: e.target.value })} style={{ ...inp, padding: '6px 8px' }} /></div>
                          <div><Lbl>Empleado 2</Lbl><input type="text" value={formEdit.empleado2 || ''} onChange={e => setFormEdit({ ...formEdit, empleado2: e.target.value })} style={{ ...inp, padding: '6px 8px' }} /></div>
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
                            {['transferencia', 'efectivo', 'cheque_propio', 'cheque_tercero'].map(t => (
                              <option key={t} value={t}>{t === 'cheque_propio' ? 'E-cheq propio' : t === 'cheque_tercero' ? 'Cheque tercero' : t.charAt(0).toUpperCase() + t.slice(1)}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Lbl>Monto $</Lbl>
                          <input type="number" value={p.monto} onChange={e => { const pagos = formPago.pagos.map((x, i) => i === pi ? { ...x, monto: e.target.value } : x); setFormPago({ ...formPago, pagos }) }} style={inpMono} />
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer', marginBottom: 2 }}>
                          <input type="checkbox" checked={p.es_paralelo} onChange={e => { const pagos = formPago.pagos.map((x, i) => i === pi ? { ...x, es_paralelo: e.target.checked } : x); setFormPago({ ...formPago, pagos }) }} />
                          Paralelo
                        </label>
                      </div>
                      {p.tipo === 'cheque_propio' && (
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
                    const mo1 = moList[0] || (s.empleado1 ? { trabajador: s.empleado1, porcentaje: null, monto_calculado: null, estado_pago: 'pendiente' } : null)
                    const mo2 = moList[1] || (s.empleado2 ? { trabajador: s.empleado2, porcentaje: null, monto_calculado: null, estado_pago: 'pendiente' } : null)
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
                          <td style={{ ...td_, whiteSpace: 'nowrap' }}>
                            <button onClick={async () => {
                              if (manoObraOpen === s.id) { setManoObraOpen(null); return }
                              setManoObraOpen(s.id)
                            }} style={{ padding: '3px 8px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 4, cursor: 'pointer' }}>
                              👷
                            </button>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={15} style={{ padding: 0 }}>
                              <div style={{ padding: '1rem', background: S.bg, borderBottom: `1px solid ${S.border}` }}>
                                {moList.length > 0 && (
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: '1rem' }}>
                                    <thead><tr>{['Empleado', 'Rol', '%', '$/Ha', '$Total', 'Estado', ''].map(h => (
                                      <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                                    ))}</tr></thead>
                                    <tbody>
                                      {moList.map(mo => {
                                        const pct = mo.porcentaje || 0
                                        const precioHaEmp = s.precio_ha ? Math.round(s.precio_ha * pct / 100) : null
                                        const montoCalc = mo.monto_calculado || (s.precio_ha && s.hectareas ? Math.round(s.precio_ha * s.hectareas * pct / 100) : null)
                                        return (
                                          <tr key={mo.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                                            <td style={{ padding: '7px 10px', fontWeight: 600 }}>{mo.trabajador}</td>
                                            <td style={{ padding: '7px 10px', color: S.muted }}>{mo.rol}</td>
                                            <td style={{ padding: '7px 10px', fontFamily: 'monospace' }}>{pct}%</td>
                                            <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: S.muted }}>{precioHaEmp ? `$${precioHaEmp.toLocaleString('es-AR')}` : '—'}</td>
                                            <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontWeight: 600, color: S.green }}>{montoCalc ? `$${montoCalc.toLocaleString('es-AR')}` : '—'}</td>
                                            <td style={{ padding: '7px 10px' }}>
                                              <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: mo.estado_pago === 'pagado' ? S.greenLight : S.amberLight, color: mo.estado_pago === 'pagado' ? S.green : S.amber }}>
                                                {mo.estado_pago === 'pagado' ? '✓ Pagado' : '⏳ Pendiente'}
                                              </span>
                                            </td>
                                            <td style={{ padding: '7px 10px' }}>
                                              <div style={{ display: 'flex', gap: 4 }}>
                                                <button onClick={async () => {
                                                  const nuevoPct = prompt(`Nuevo % para ${mo.trabajador}:`, pct)
                                                  if (!nuevoPct) return
                                                  const nuevoMonto = s.precio_ha && s.hectareas ? Math.round(s.precio_ha * s.hectareas * parseFloat(nuevoPct) / 100) : null
                                                  await supabase.from('mano_obra_servicios').update({ porcentaje: parseFloat(nuevoPct), monto_calculado: nuevoMonto }).eq('id', mo.id)
                                                  await cargar()
                                                }} style={{ padding: '3px 7px', fontSize: 11, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 4, cursor: 'pointer' }}>✏</button>
                                                <button onClick={async () => {
                                                  if (!confirm(`¿Eliminar a ${mo.trabajador}?`)) return
                                                  await supabase.from('mano_obra_servicios').delete().eq('id', mo.id)
                                                  await cargar()
                                                }} style={{ padding: '3px 7px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 4, cursor: 'pointer' }}>🗑</button>
                                              </div>
                                            </td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                )}
                                <div style={{ fontSize: 12, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 8 }}>+ Asignar empleado</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, alignItems: 'flex-end' }}>
                                  <div><Lbl>Nombre</Lbl><input type="text" value={formMO.trabajador} onChange={e => setFormMO({ ...formMO, trabajador: e.target.value })} placeholder="ej. Martín" style={inp} /></div>
                                  <div><Lbl>Rol</Lbl><select value={formMO.rol} onChange={e => setFormMO({ ...formMO, rol: e.target.value })} style={inp}>{rolesActuales.map(r => <option key={r}>{r}</option>)}</select></div>
                                  <div><Lbl>%</Lbl><input type="number" value={formMO.porcentaje} onChange={e => setFormMO({ ...formMO, porcentaje: e.target.value })} style={inpMono} /></div>
                                  <button onClick={() => guardarMO(s.id, s)} disabled={guardandoMO} style={{ padding: '9px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>+ Agregar</button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Lbl>Formas de pago</Lbl>
                      <button onClick={() => setFormPagoMO({ ...formPagoMO, pagos: [...formPagoMO.pagos, { ...PAGO_INIT }] })}
                        style={{ padding: '4px 10px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>+ Agregar</button>
                    </div>
                    {formPagoMO.pagos.map((p, pi) => (
                      <div key={pi} style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '.75rem', marginBottom: 6 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8, alignItems: 'flex-end' }}>
                          <div><Lbl>Forma</Lbl>
                            <select value={p.tipo} onChange={e => { const pagos = formPagoMO.pagos.map((x, i) => i === pi ? { ...x, tipo: e.target.value } : x); setFormPagoMO({ ...formPagoMO, pagos }) }} style={inp}>
                              <option value="transferencia">Transferencia</option>
                              <option value="efectivo">Efectivo</option>
                              <option value="cheque_propio">E-cheq propio</option>
                            </select>
                          </div>
                          <div><Lbl>Monto $</Lbl>
                            <input type="number" value={p.monto} onChange={e => { const pagos = formPagoMO.pagos.map((x, i) => i === pi ? { ...x, monto: e.target.value } : x); setFormPagoMO({ ...formPagoMO, pagos }) }} style={inpMono} />
                          </div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer', marginBottom: 2 }}>
                            <input type="checkbox" checked={p.es_paralelo} onChange={e => { const pagos = formPagoMO.pagos.map((x, i) => i === pi ? { ...x, es_paralelo: e.target.checked } : x); setFormPagoMO({ ...formPagoMO, pagos }) }} />Paralelo
                          </label>
                        </div>
                      </div>
                    ))}
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
                            if (p.es_paralelo) {
                              await supabase.from('caja_paralela').insert({ fecha: formPagoMO.fecha, tipo: 'egreso', descripcion: desc, monto })
                            } else {
                              await supabase.from('caja_oficial').insert({ fecha: formPagoMO.fecha, tipo: 'egreso', categoria: 'Mano de obra', descripcion: desc, monto, forma_pago: p.tipo })
                            }
                          }
                          // Marcar como pagado — crear entrada si no existe
                          for (const id of seleccionadasMO) {
                            const s = servicios.find(x => x.id === id)
                            const moList = manoObra[id] || []
                            const mo = moList.find(m => m.trabajador === empleadoSeleccionado)
                            if (mo) {
                              await supabase.from('mano_obra_servicios').update({ estado_pago: 'pagado' }).eq('id', mo.id)
                            } else {
                              // Crear entrada con % de config
                              const cfg = configMO.find(c => s?.labor === 'Cosecha' ? ['Maquinista','Tolvero','Ayudante'].includes(c.rol) : ['Sembrador 1','Sembrador 2','Sembrador 3'].includes(c.rol))
                              const pctCfg = s?.tipo_servicio === 'propio' ? (cfg?.pct_propio || 0) : (cfg?.pct_tercero || 0)
                              const pct = pctPagoMO[id] !== undefined ? pctPagoMO[id] : pctCfg
                              const monto = s?.precio_ha && s?.hectareas && pct ? Math.round(s.precio_ha * s.hectareas * pct / 100) : null
                              await supabase.from('mano_obra_servicios').insert({
                                servicio_id: id,
                                trabajador: empleadoSeleccionado,
                                rol: cfg?.rol || 'Otro',
                                porcentaje: pct,
                                monto_calculado: monto,
                                estado_pago: 'pagado',
                              })
                            }
                          }
                          setSeleccionadasMO([])
                          setShowPagoMO(false)
                          setPctPagoMO({})
                          setFormPagoMO({ fecha: new Date().toISOString().split('T')[0], iva_pct: '10.5', pagos: [{ ...PAGO_INIT }] })
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
              const pagados = serviciosMO.filter(s => {
                const moList = manoObra[s.id] || []
                const mo = empleadoSeleccionado
                  ? moList.find(m => m.trabajador === empleadoSeleccionado && m.estado_pago === 'pagado')
                  : moList.find(m => m.estado_pago === 'pagado')
                return !!mo
              })
              if (pagados.length === 0) return null
              return (
                <div style={{ marginTop: '1.5rem' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: '.75rem' }}>Pagos registrados</div>
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
                    {contactos.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
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
                  setFormReg({ campo: '', cliente: '', nro_lote: '', cultivo: 'Maíz', fecha: new Date().toISOString().split('T')[0] })
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
                        setFormDescargaReg({ tipo: 'camion', patente: '', kg: '', observaciones: '', fecha: new Date().toISOString().split('T')[0] })
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
