import React, { useState, useEffect } from 'react'
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

const inp = { width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: "'IBM Plex Sans', sans-serif", color: S.text }
const inpMono = { ...inp, fontFamily: 'monospace' }

function Lbl({ children, c }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: c || S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{children}</div>
}

const LABORES = ['Siembra', 'Cosecha', 'Pulverización', 'Fertilización', 'Roturación', 'Rastreo', 'Flete', 'Otro']
const CULTIVOS = ['Maíz', 'Soja', 'Trigo', 'Sorgo', 'Girasol', 'Cebada', 'Otro']
const ROLES = ['Maquinista', 'Tolvero', 'Sembrador', 'Ayudante', 'Otro']
const PAGO_INIT = { tipo: 'transferencia', monto: '', es_paralelo: false, subtipo_cheque: '', cheque_propio: { numero: '', banco: '', fecha_vencimiento: '' }, cheque_tercero_ids: [] }

export default function Servicios({ usuario }) {
  const [tab, setTab] = useState('terceros')
  const [loading, setLoading] = useState(true)
  const [servicios, setServicios] = useState([])
  const [maquinaria, setMaquinaria] = useState([])
  const [contactos, setContactos] = useState([])
  const [chequesCartera, setChequesCartera] = useState([])

  // Form nuevo servicio
  const [showForm, setShowForm] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({
    tipo_servicio: 'tercero', cliente: '', clienteNuevo: '', labor: 'Siembra',
    cultivo: 'Maíz', campo: '', nro_lote: '', fecha: new Date().toISOString().split('T')[0],
    hectareas: '', maquina_id: '', precio_ha: '', observaciones: ''
  })

  // Descargas
  const [descargasOpen, setDescargasOpen] = useState(null) // servicio_id
  const [descargas, setDescargas] = useState({}) // { [servicio_id]: [...] }
  const [formDescarga, setFormDescarga] = useState({ tipo: 'camion', patente: '', kg: '', observaciones: '', fecha: new Date().toISOString().split('T')[0] })
  const [guardandoDescarga, setGuardandoDescarga] = useState(false)

  // Mano de obra
  const [manoObraOpen, setManoObraOpen] = useState(null)
  const [manoObra, setManoObra] = useState({}) // { [servicio_id]: [...] }
  const [formMO, setFormMO] = useState({ trabajador: '', rol: 'Maquinista', porcentaje: '' })
  const [guardandoMO, setGuardandoMO] = useState(false)

  // Mercadería independiente
  const [registros, setRegistros] = useState([]) // lista de registros de campo
  const [registroActivo, setRegistroActivo] = useState(null) // { id, campo, cliente, nro_lote, cultivo, fecha }
  const [descargasReg, setDescargasReg] = useState({}) // { [registro_id]: [...] }
  const [showFormReg, setShowFormReg] = useState(false)
  const [formReg, setFormReg] = useState({ campo: '', cliente: '', nro_lote: '', cultivo: 'Maíz', fecha: new Date().toISOString().split('T')[0] })
  const [formDescargaReg, setFormDescargaReg] = useState({ tipo: 'camion', patente: '', kg: '', observaciones: '', fecha: new Date().toISOString().split('T')[0] })
  const [guardandoReg, setGuardandoReg] = useState(false)
  const [guardandoDescargaReg, setGuardandoDescargaReg] = useState(false)

  // Cobro
  const [cobrandoId, setCobrandoId] = useState(null)
  const [formCobro, setFormCobro] = useState({ precio_ha: '', total: '', iva_pct: '0', fecha: new Date().toISOString().split('T')[0], pagos: [{ ...PAGO_INIT }] })
  const [guardandoCobro, setGuardandoCobro] = useState(false)

  // Editar precio
  const [editandoPrecio, setEditandoPrecio] = useState(null)
  // Editar servicio completo
  const [editandoServicio, setEditandoServicio] = useState(null)
  const [guardandoEdit, setGuardandoEdit] = useState(false)

  const esBrian = usuario?.nombre?.toLowerCase().includes('brian') || usuario?.email?.toLowerCase().includes('brian')
  const TABS = esBrian
    ? [{ key: 'mercaderia', label: '📦 Registro de mercadería' }]
    : [
        { key: 'terceros', label: 'Servicios a terceros' },
        { key: 'propios', label: 'Servicios propios' },
        { key: 'mano_obra', label: 'Mano de obra' },
        { key: 'mercaderia', label: '📦 Mercadería' },
      ]

  useEffect(() => {
    if (esBrian) setTab('mercaderia')
    cargar()
  }, [])

  async function cargar() {
    const [{ data: s }, { data: m }, { data: ct }, { data: ch }] = await Promise.all([
      supabase.from('servicios_terceros').select('*').order('fecha', { ascending: false }),
      supabase.from('maquinaria').select('*').eq('activo', true).order('nombre'),
      supabase.from('contactos').select('id, nombre, cuit').eq('activo', true).order('nombre'),
      supabase.from('cheques').select('*').eq('tipo', 'recibido').eq('estado', 'en_cartera'),
    ])
    setServicios(s || [])
    setMaquinaria(m || [])
    setContactos(ct || [])
    setChequesCartera(ch || [])
    // Cargar registros de mercadería
    const { data: regs } = await supabase.from('registros_mercaderia').select('*').order('created_at', { ascending: false })
    setRegistros(regs || [])
    setLoading(false)
  }

  async function cargarDescargas(servicioId) {
    const { data } = await supabase.from('descargas_cosecha').select('*').eq('servicio_id', servicioId).order('creado_en')
    setDescargas(prev => ({ ...prev, [servicioId]: data || [] }))
  }

  async function cargarManoObra(servicioId) {
    const { data } = await supabase.from('mano_obra_servicios').select('*').eq('servicio_id', servicioId).order('creado_en')
    setManoObra(prev => ({ ...prev, [servicioId]: data || [] }))
  }

  async function cargarDescargasReg(regId) {
    const { data } = await supabase.from('descargas_mercaderia').select('*').eq('registro_id', regId).order('creado_en')
    setDescargasReg(prev => ({ ...prev, [regId]: data || [] }))
  }

  async function guardarRegistro() {
    if (!formReg.campo) { alert('Ingresá el campo'); return }
    setGuardandoReg(true)
    const { data } = await supabase.from('registros_mercaderia').insert({
      campo: formReg.campo,
      cliente: formReg.cliente || null,
      nro_lote: formReg.nro_lote || null,
      cultivo: formReg.cultivo,
      fecha: formReg.fecha,
      registrado_por: usuario?.id,
    }).select().single()
    setRegistros(prev => [data, ...prev])
    setRegistroActivo(data)
    setShowFormReg(false)
    setFormReg({ campo: '', cliente: '', nro_lote: '', cultivo: 'Maíz', fecha: new Date().toISOString().split('T')[0] })
    setGuardandoReg(false)
    await cargarDescargasReg(data.id)
  }

  async function guardarDescargaReg(regId) {
    if (!formDescargaReg.kg) { alert('Ingresá los kg'); return }
    setGuardandoDescargaReg(true)
    await supabase.from('descargas_mercaderia').insert({
      registro_id: regId,
      fecha: formDescargaReg.fecha,
      tipo: formDescargaReg.tipo,
      patente: formDescargaReg.tipo === 'camion' ? (formDescargaReg.patente || null) : null,
      kg: parseFloat(formDescargaReg.kg),
      observaciones: formDescargaReg.tipo !== 'camion' ? (formDescargaReg.observaciones || null) : null,
      registrado_por: usuario?.id,
    })
    setFormDescargaReg({ tipo: 'camion', patente: '', kg: '', observaciones: '', fecha: new Date().toISOString().split('T')[0] })
    setGuardandoDescargaReg(false)
    await cargarDescargasReg(regId)
  }

  function exportarResumen(reg) {
    const desc = descargasReg[reg.id] || []
    const kgCamion = desc.filter(d => d.tipo === 'camion').reduce((a, d) => a + (d.kg || 0), 0)
    const kgBolsa = desc.filter(d => d.tipo === 'bolsa').reduce((a, d) => a + (d.kg || 0), 0)
    const kgOtro = desc.filter(d => d.tipo === 'otro').reduce((a, d) => a + (d.kg || 0), 0)
    const total = kgCamion + kgBolsa + kgOtro
    let csv = `REGISTRO DE MERCADERÍA\n`
    csv += `Campo: ${reg.campo}\n`
    csv += `Cliente: ${reg.cliente || '—'}\n`
    csv += `Lote: ${reg.nro_lote || '—'}\n`
    csv += `Cultivo: ${reg.cultivo || '—'}\n\n`
    csv += `Fecha,Tipo,Patente/Detalle,Kg\n`
    desc.forEach(d => {
      csv += `${d.fecha || ''},${d.tipo},${d.patente || d.observaciones || ''},${d.kg}\n`
    })
    csv += `\nRESUMEN\n`
    csv += `Camión,${kgCamion.toLocaleString('es-AR')} kg\n`
    csv += `Bolsa,${kgBolsa.toLocaleString('es-AR')} kg\n`
    if (kgOtro > 0) csv += `Otro,${kgOtro.toLocaleString('es-AR')} kg\n`
    csv += `TOTAL,${total.toLocaleString('es-AR')} kg\n`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mercaderia_${reg.campo.replace(/\s+/g, '_')}_${reg.fecha}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function guardarEditServicio() {
    if (!editandoServicio?.labor || !editandoServicio?.hectareas) { alert('Completá labor y hectáreas'); return }
    setGuardandoEdit(true)
    const ha = parseFloat(editandoServicio.hectareas)
    const precio = editandoServicio.precio_ha ? parseFloat(editandoServicio.precio_ha) : null
    const total = editandoServicio.total ? parseFloat(editandoServicio.total) : (ha && precio ? Math.round(ha * precio) : null)
    await supabase.from('servicios_terceros').update({
      cliente: editandoServicio.cliente,
      labor: editandoServicio.labor,
      cultivo: editandoServicio.cultivo,
      campo: editandoServicio.campo || null,
      nro_lote: editandoServicio.nro_lote || null,
      fecha: editandoServicio.fecha,
      hectareas: ha,
      maquina_id: editandoServicio.maquina_id ? parseInt(editandoServicio.maquina_id) : null,
      precio_ha: precio,
      total,
      observaciones: editandoServicio.observaciones || null,
    }).eq('id', editandoServicio.id)
    setEditandoServicio(null)
    setGuardandoEdit(false)
    await cargar()
  }

  async function guardar() {
    if (!form.labor || !form.hectareas) { alert('Completá labor y hectáreas'); return }
    if (form.tipo_servicio === 'tercero' && !form.cliente && !form.clienteNuevo) { alert('Ingresá el cliente'); return }
    setGuardando(true)
    const ha = parseFloat(form.hectareas)
    const precio = form.precio_ha ? parseFloat(form.precio_ha) : null
    const total = ha && precio ? Math.round(ha * precio) : null
    let nombreCliente = form.cliente === '__nuevo__' ? form.clienteNuevo?.trim() : form.cliente
    if (form.tipo_servicio === 'propio') nombreCliente = 'Ramonda Hnos SA'
    if (form.cliente === '__nuevo__' && form.clienteNuevo?.trim()) {
      const existe = contactos.find(c => c.nombre.toLowerCase() === form.clienteNuevo.trim().toLowerCase())
      if (!existe) await supabase.from('contactos').insert({ nombre: form.clienteNuevo.trim(), tipo: 'otro', activo: true })
    }
    await supabase.from('servicios_terceros').insert({
      cliente: nombreCliente,
      labor: form.labor,
      cultivo: form.cultivo,
      campo: form.campo || null,
      nro_lote: form.nro_lote || null,
      fecha: form.fecha,
      hectareas: ha,
      maquina_id: form.maquina_id ? parseInt(form.maquina_id) : null,
      precio_ha: precio,
      total,
      tipo_servicio: form.tipo_servicio,
      estado: precio ? 'precio_cargado' : 'pendiente',
    })
    setShowForm(false)
    setForm({ tipo_servicio: tab === 'propios' ? 'propio' : 'tercero', cliente: '', clienteNuevo: '', labor: 'Siembra', cultivo: 'Maíz', campo: '', nro_lote: '', fecha: new Date().toISOString().split('T')[0], hectareas: '', maquina_id: '', precio_ha: '', observaciones: '' })
    setGuardando(false)
    await cargar()
  }

  async function guardarDescarga(servicioId) {
    if (!formDescarga.kg) { alert('Ingresá los kg'); return }
    setGuardandoDescarga(true)
    await supabase.from('descargas_cosecha').insert({
      servicio_id: servicioId,
      fecha: formDescarga.fecha,
      tipo: formDescarga.tipo,
      patente: formDescarga.tipo === 'camion' ? (formDescarga.patente || null) : null,
      kg: parseFloat(formDescarga.kg),
      observaciones: formDescarga.observaciones || null,
      registrado_por: usuario?.id,
    })
    setFormDescarga({ tipo: 'camion', patente: '', kg: '', observaciones: '', fecha: new Date().toISOString().split('T')[0] })
    setGuardandoDescarga(false)
    await cargarDescargas(servicioId)
  }

  async function guardarManoObra(servicioId, s) {
    if (!formMO.trabajador || !formMO.porcentaje) { alert('Completá trabajador y porcentaje'); return }
    setGuardandoMO(true)
    const pct = parseFloat(formMO.porcentaje)
    const monto = s.total ? Math.round(s.total * pct / 100) : null
    await supabase.from('mano_obra_servicios').insert({
      servicio_id: servicioId,
      trabajador: formMO.trabajador,
      rol: formMO.rol,
      porcentaje: pct,
      monto_calculado: monto,
    })
    setFormMO({ trabajador: '', rol: 'Maquinista', porcentaje: '' })
    setGuardandoMO(false)
    await cargarManoObra(servicioId)
  }

  async function guardarCobro(s) {
    if (!formCobro.precio_ha && !formCobro.total) { alert('Ingresá el precio/ha o el total'); return }
    setGuardandoCobro(true)
    const precio = formCobro.precio_ha ? parseFloat(formCobro.precio_ha) : null
    const totalSinIva = formCobro.total ? parseFloat(formCobro.total) : (precio && s.hectareas ? Math.round(precio * s.hectareas) : null)
    const ivaPct = parseFloat(formCobro.iva_pct) || 0
    const totalConIva = totalSinIva ? Math.round(totalSinIva * (1 + ivaPct / 100)) : null
    const desc = `Servicio ${s.labor} ${s.cultivo ? `(${s.cultivo})` : ''} — ${s.cliente} · ${s.hectareas} ha`
    const pagos = formCobro.pagos.filter(p => p.monto)

    let caja_oficial_id = null, caja_paralela_id = null
    for (const p of pagos) {
      const monto = parseFloat(p.monto) || 0
      if (p.es_paralelo) {
        const { data: cp } = await supabase.from('caja_paralela').insert({ fecha: formCobro.fecha, tipo: 'ingreso', descripcion: desc, monto }).select().single()
        caja_paralela_id = cp?.id
      } else {
        const { data: co } = await supabase.from('caja_oficial').insert({ fecha: formCobro.fecha, tipo: 'ingreso', categoria: 'Servicios a terceros', descripcion: desc, monto, forma_pago: p.tipo }).select().single()
        caja_oficial_id = co?.id
        if (p.tipo === 'cheque_propio' && p.cheque_propio?.fecha_vencimiento) {
          await supabase.from('cheques').insert({ tipo: 'emitido', numero: p.cheque_propio.numero || null, banco: p.cheque_propio.banco || null, fecha_cobro: formCobro.fecha, fecha_vencimiento: p.cheque_propio.fecha_vencimiento, monto, librador: s.cliente || null, estado: 'emitido', caja_oficial_id })
        }
      }
    }

    await supabase.from('servicios_terceros').update({
      precio_ha: precio,
      total: totalConIva,
      iva_pct: ivaPct || null,
      estado_pago: 'cobrado',
      estado: 'cobrado',
      fecha_cobro: formCobro.fecha,
      caja_oficial_id,
      caja_paralela_id,
    }).eq('id', s.id)
    setCobrandoId(null)
    setFormCobro({ precio_ha: '', total: '', iva_pct: '0', fecha: new Date().toISOString().split('T')[0], pagos: [{ ...PAGO_INIT }] })
    setGuardandoCobro(false)
    await cargar()
  }

  async function guardarPrecio(s) {
    if (!editandoPrecio?.precio_ha && !editandoPrecio?.total_neto && !editandoPrecio?.total) { alert('Ingresá el precio/ha o el total'); return }
    const precio = editandoPrecio.precio_ha ? parseFloat(editandoPrecio.precio_ha) : null
    const totalNeto = editandoPrecio.total_neto ? parseFloat(editandoPrecio.total_neto) : (precio && s.hectareas ? Math.round(precio * s.hectareas) : null)
    const total = editandoPrecio.total ? parseFloat(editandoPrecio.total) : totalNeto
    await supabase.from('servicios_terceros').update({
      precio_ha: precio,
      total,
      iva_pct: editandoPrecio.iva_pct ? parseFloat(editandoPrecio.iva_pct) : null,
      facturado: editandoPrecio.factura !== 'no',
      nro_factura: editandoPrecio.nro_factura || null,
      plazo_pago: editandoPrecio.plazo || null,
      estado: 'precio_cargado',
    }).eq('id', s.id)
    setEditandoPrecio(null)
    await cargar()
  }

  const serviciosFiltrados = tab === 'terceros'
    ? servicios.filter(s => !s.tipo_servicio || s.tipo_servicio === 'tercero')
    : tab === 'propios'
    ? servicios.filter(s => s.tipo_servicio === 'propio')
    : servicios.filter(s => s.labor === 'Cosecha')

  if (loading) return <div style={{ padding: '2rem', color: S.muted }}>Cargando...</div>

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: S.text }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: 20, fontWeight: 600 }}>Servicios</div>
        {!esBrian && (
          <button onClick={() => { setShowForm(!showForm); setForm(f => ({ ...f, tipo_servicio: tab === 'propios' ? 'propio' : 'tercero' })) }}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.accent, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
            + Nuevo servicio
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: '1.5rem', borderBottom: `1px solid ${S.border}`, paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setShowForm(false) }}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: tab === t.key ? 600 : 400, border: 'none', background: 'transparent', borderBottom: tab === t.key ? `2px solid ${S.accent}` : '2px solid transparent', color: tab === t.key ? S.accent : S.muted, cursor: 'pointer', marginBottom: -1 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Form nuevo servicio */}
      {showForm && !esBrian && (
        <div style={{ background: S.surface, border: `1px solid ${S.accent}`, borderRadius: 10, padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: '1rem' }}>
            {form.tipo_servicio === 'propio' ? 'Nuevo servicio propio' : 'Nuevo servicio a tercero'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
            {form.tipo_servicio === 'tercero' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <Lbl>Cliente *</Lbl>
                <select value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value, clienteNuevo: '' })} style={inp}>
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
              <Lbl>Labor *</Lbl>
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
              <Lbl>Precio $/ha (opcional)</Lbl>
              <input type="number" value={form.precio_ha} onChange={e => setForm({ ...form, precio_ha: e.target.value })} placeholder="dejar vacío si no está acordado" style={inpMono} />
            </div>
            <div>
              <Lbl>Máquina</Lbl>
              <select value={form.maquina_id} onChange={e => setForm({ ...form, maquina_id: e.target.value })} style={inp}>
                <option value="">— Sin asignar —</option>
                {maquinaria.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
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

      {/* Tab mano de obra — resumen */}
      {tab === 'mano_obra' && (
        <div>
          <div style={{ fontSize: 13, color: S.muted, marginBottom: '1rem' }}>
            Seleccioná un trabajo de cosecha para asignar personal y calcular liquidación.
          </div>
          {servicios.filter(s => s.labor === 'Cosecha').map(s => (
            <div key={s.id} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, marginBottom: '1rem', overflow: 'hidden' }}>
              <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{s.cliente} — {s.cultivo || s.labor}</div>
                  <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>
                    {s.campo || '—'} · {s.hectareas} ha · {s.fecha ? new Date(s.fecha+'T12:00:00').toLocaleDateString('es-AR') : ''}
                    {s.total ? ` · Total: $${s.total.toLocaleString('es-AR')}` : ' · Sin precio'}
                  </div>
                </div>
                <button onClick={async () => {
                  if (manoObraOpen === s.id) { setManoObraOpen(null); return }
                  await cargarManoObra(s.id)
                  setManoObraOpen(s.id)
                }} style={{ padding: '6px 12px', fontSize: 12, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 6, cursor: 'pointer' }}>
                  {manoObraOpen === s.id ? 'Cerrar' : '👷 Personal'}
                </button>
              </div>
              {manoObraOpen === s.id && (
                <div style={{ borderTop: `1px solid ${S.border}`, padding: '1rem', background: S.bg }}>
                  {(manoObra[s.id] || []).length > 0 && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: '1rem' }}>
                      <thead>
                        <tr style={{ background: S.bg }}>
                          {['Trabajador', 'Rol', '%', 'Monto', 'Estado'].map(h => (
                            <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(manoObra[s.id] || []).map(mo => (
                          <tr key={mo.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                            <td style={{ padding: '8px 10px', fontWeight: 600 }}>{mo.trabajador}</td>
                            <td style={{ padding: '8px 10px', color: S.muted }}>{mo.rol}</td>
                            <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{mo.porcentaje}%</td>
                            <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 600, color: S.green }}>
                              {mo.monto_calculado ? `$${mo.monto_calculado.toLocaleString('es-AR')}` : '—'}
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: mo.estado_pago === 'pagado' ? S.greenLight : S.amberLight, color: mo.estado_pago === 'pagado' ? S.green : S.amber }}>
                                {mo.estado_pago === 'pagado' ? '✓ Pagado' : '⏳ Pendiente'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {(manoObra[s.id] || []).length > 0 && (
                        <tfoot>
                          <tr style={{ background: S.accentLight }}>
                            <td colSpan={2} style={{ padding: '8px 10px', fontWeight: 600, fontSize: 12 }}>Total asignado</td>
                            <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 700 }}>
                              {(manoObra[s.id] || []).reduce((a, m) => a + (m.porcentaje || 0), 0)}%
                            </td>
                            <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 700, color: S.accent }}>
                              ${(manoObra[s.id] || []).reduce((a, m) => a + (m.monto_calculado || 0), 0).toLocaleString('es-AR')}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, alignItems: 'flex-end' }}>
                    <div>
                      <Lbl>Trabajador</Lbl>
                      <input type="text" value={formMO.trabajador} onChange={e => setFormMO({ ...formMO, trabajador: e.target.value })}
                        placeholder="ej. Juan Pérez" style={inp} />
                    </div>
                    <div>
                      <Lbl>Rol</Lbl>
                      <select value={formMO.rol} onChange={e => setFormMO({ ...formMO, rol: e.target.value })} style={inp}>
                        {ROLES.map(r => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <Lbl>% del total</Lbl>
                      <input type="number" value={formMO.porcentaje} onChange={e => setFormMO({ ...formMO, porcentaje: e.target.value })}
                        placeholder="ej. 10" style={inpMono} />
                    </div>
                    <button onClick={() => guardarManoObra(s.id, s)} disabled={guardandoMO}
                      style={{ padding: '9px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      + Agregar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {servicios.filter(s => s.labor === 'Cosecha').length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay trabajos de cosecha registrados.</div>
          )}
        </div>
      )}

      {/* Tab descargas — Brian y todos */}
      {tab === 'descargas' && (
        <div>
          <div style={{ fontSize: 13, color: S.muted, marginBottom: '1rem' }}>
            Registrá las descargas de mercadería por trabajo de cosecha.
          </div>
          {servicios.filter(s => s.labor === 'Cosecha').map(s => {
            const desc = descargas[s.id] || []
            const kgCamion = desc.filter(d => d.tipo === 'camion').reduce((a, d) => a + (d.kg || 0), 0)
            const kgBolsa = desc.filter(d => d.tipo === 'bolsa').reduce((a, d) => a + (d.kg || 0), 0)
            const kgOtro = desc.filter(d => d.tipo === 'otro').reduce((a, d) => a + (d.kg || 0), 0)
            const kgTotal = kgCamion + kgBolsa + kgOtro
            return (
              <div key={s.id} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, marginBottom: '1rem', overflow: 'hidden' }}>
                <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{s.cliente} — {s.cultivo || 'Cosecha'}</div>
                    <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>
                      {s.campo || '—'} · {s.nro_lote || '—'} · {s.fecha ? new Date(s.fecha+'T12:00:00').toLocaleDateString('es-AR') : ''}
                    </div>
                    {descargasOpen === s.id && kgTotal > 0 && (
                      <div style={{ marginTop: 6, display: 'flex', gap: 12, fontSize: 12 }}>
                        {kgCamion > 0 && <span style={{ color: S.accent }}>🚛 {kgCamion.toLocaleString('es-AR')} kg</span>}
                        {kgBolsa > 0 && <span style={{ color: S.green }}>🌾 {kgBolsa.toLocaleString('es-AR')} kg</span>}
                        {kgOtro > 0 && <span style={{ color: S.muted }}>📦 {kgOtro.toLocaleString('es-AR')} kg</span>}
                        <strong>Total: {kgTotal.toLocaleString('es-AR')} kg</strong>
                      </div>
                    )}
                  </div>
                  <button onClick={async () => {
                    if (descargasOpen === s.id) { setDescargasOpen(null); return }
                    await cargarDescargas(s.id)
                    setDescargasOpen(s.id)
                  }} style={{ padding: '6px 12px', fontSize: 12, background: S.greenLight, border: `1px solid ${S.green}`, color: S.green, borderRadius: 6, cursor: 'pointer' }}>
                    {descargasOpen === s.id ? 'Cerrar' : '📦 Descargas'}
                  </button>
                </div>
                {descargasOpen === s.id && (
                  <div style={{ borderTop: `1px solid ${S.border}`, padding: '1rem', background: S.bg }}>
                    {desc.length > 0 && (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: '1rem' }}>
                        <thead>
                          <tr>
                            {['Fecha', 'Tipo', 'Patente/Detalle', 'Kg'].map(h => (
                              <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {desc.map(d => (
                            <tr key={d.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                              <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: S.muted, whiteSpace: 'nowrap' }}>
                                {d.fecha ? new Date(d.fecha+'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '—'}
                              </td>
                              <td style={{ padding: '7px 10px' }}>
                                <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: d.tipo === 'camion' ? S.accentLight : d.tipo === 'bolsa' ? S.greenLight : S.amberLight, color: d.tipo === 'camion' ? S.accent : d.tipo === 'bolsa' ? S.green : S.amber }}>
                                  {d.tipo === 'camion' ? '🚛 Camión' : d.tipo === 'bolsa' ? '🌾 Bolsa' : '📦 Otro'}
                                </span>
                              </td>
                              <td style={{ padding: '7px 10px', color: S.muted, fontFamily: 'monospace' }}>{d.patente || d.observaciones || '—'}</td>
                              <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontWeight: 700 }}>{(d.kg || 0).toLocaleString('es-AR')} kg</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: S.accentLight }}>
                            <td colSpan={3} style={{ padding: '8px 10px', fontWeight: 600, fontSize: 12 }}>Total</td>
                            <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 700, color: S.accent }}>{kgTotal.toLocaleString('es-AR')} kg</td>
                          </tr>
                        </tfoot>
                      </table>
                    )}
                    {/* Form nueva descarga */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'flex-end' }}>
                      <div>
                        <Lbl>Tipo</Lbl>
                        <select value={formDescarga.tipo} onChange={e => setFormDescarga({ ...formDescarga, tipo: e.target.value })} style={inp}>
                          <option value="camion">🚛 Camión</option>
                          <option value="bolsa">🌾 Bolsa</option>
                          <option value="otro">📦 Otro</option>
                        </select>
                      </div>
                      {formDescarga.tipo === 'camion' ? (
                        <div>
                          <Lbl>Patente</Lbl>
                          <input type="text" value={formDescarga.patente} onChange={e => setFormDescarga({ ...formDescarga, patente: e.target.value })}
                            placeholder="ej. ABC 123" style={{ ...inp, textTransform: 'uppercase' }} />
                        </div>
                      ) : (
                        <div>
                          <Lbl>Detalle</Lbl>
                          <input type="text" value={formDescarga.observaciones} onChange={e => setFormDescarga({ ...formDescarga, observaciones: e.target.value })}
                            placeholder="ej. Bolsa 8" style={inp} />
                        </div>
                      )}
                      <div>
                        <Lbl>Kg *</Lbl>
                        <input type="number" value={formDescarga.kg} onChange={e => setFormDescarga({ ...formDescarga, kg: e.target.value })}
                          placeholder="ej. 28500" style={inpMono} />
                      </div>
                      <div>
                        <Lbl>Fecha</Lbl>
                        <input type="date" value={formDescarga.fecha} onChange={e => setFormDescarga({ ...formDescarga, fecha: e.target.value })} style={inp} />
                      </div>
                      <button onClick={() => guardarDescarga(s.id)} disabled={guardandoDescarga}
                        style={{ padding: '9px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        + Registrar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {servicios.filter(s => s.labor === 'Cosecha').length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay trabajos de cosecha registrados.</div>
          )}
        </div>
      )}

      {/* Tab Mercadería independiente */}
      {tab === 'mercaderia' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ fontSize: 13, color: S.muted }}>Registrá descargas de camión o bolsa sin necesidad de crear un servicio previo.</div>
            <button onClick={() => setShowFormReg(!showFormReg)}
              style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.accent, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
              + Nuevo campo
            </button>
          </div>

          {/* Form nuevo registro */}
          {showFormReg && (
            <div style={{ background: S.surface, border: `1px solid ${S.accent}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: '1rem' }}>Nuevo registro de campo</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
                <div>
                  <Lbl>Campo *</Lbl>
                  <input type="text" value={formReg.campo} onChange={e => setFormReg({ ...formReg, campo: e.target.value })}
                    placeholder="ej. La Esperanza" style={inp} />
                </div>
                <div>
                  <Lbl>Cliente/Propietario</Lbl>
                  <select value={formReg.cliente} onChange={e => setFormReg({ ...formReg, cliente: e.target.value })} style={inp}>
                    <option value="">— Sin especificar —</option>
                    {contactos.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <Lbl>N° Lote</Lbl>
                  <input type="text" value={formReg.nro_lote} onChange={e => setFormReg({ ...formReg, nro_lote: e.target.value })}
                    placeholder="ej. Lote 3" style={inp} />
                </div>
                <div>
                  <Lbl>Cultivo</Lbl>
                  <select value={formReg.cultivo} onChange={e => setFormReg({ ...formReg, cultivo: e.target.value })} style={inp}>
                    {CULTIVOS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <Lbl>Fecha inicio</Lbl>
                  <input type="date" value={formReg.fecha} onChange={e => setFormReg({ ...formReg, fecha: e.target.value })} style={inp} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={guardarRegistro} disabled={guardandoReg}
                  style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, background: S.accent, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                  {guardandoReg ? 'Guardando...' : '💾 Crear registro'}
                </button>
                <button onClick={() => setShowFormReg(false)}
                  style={{ padding: '8px 18px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Lista de registros */}
          {registros.length === 0 && !showFormReg && (
            <div style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay registros. Creá uno con "+ Nuevo campo".</div>
          )}
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
                      <button onClick={() => exportarResumen(reg)}
                        style={{ padding: '6px 12px', fontSize: 12, background: S.greenLight, border: `1px solid ${S.green}`, color: S.green, borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                        ⬇ Exportar
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
                    {/* Tabla descargas */}
                    {desc.length > 0 && (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: '1rem' }}>
                        <thead>
                          <tr>
                            {['Fecha', 'Tipo', 'Patente/Detalle', 'Kg'].map(h => (
                              <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {desc.map(d => (
                            <tr key={d.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                              <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: S.muted, whiteSpace: 'nowrap' }}>
                                {d.fecha ? new Date(d.fecha+'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '—'}
                              </td>
                              <td style={{ padding: '7px 10px' }}>
                                <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: d.tipo === 'camion' ? S.accentLight : d.tipo === 'bolsa' ? S.greenLight : S.amberLight, color: d.tipo === 'camion' ? S.accent : d.tipo === 'bolsa' ? S.green : S.amber }}>
                                  {d.tipo === 'camion' ? '🚛 Camión' : d.tipo === 'bolsa' ? '🌾 Bolsa' : '📦 Otro'}
                                </span>
                              </td>
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
                            <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 700, color: S.accent }}>
                              {kgTotal.toLocaleString('es-AR')} kg
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    )}

                    {/* Form nueva descarga */}
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
                      <div>
                        <Lbl>Kg *</Lbl>
                        <input type="number" value={formDescargaReg.kg} onChange={e => setFormDescargaReg({ ...formDescargaReg, kg: e.target.value })}
                          placeholder="ej. 28500" style={inpMono} />
                      </div>
                      <div>
                        <Lbl>Fecha</Lbl>
                        <input type="date" value={formDescargaReg.fecha} onChange={e => setFormDescargaReg({ ...formDescargaReg, fecha: e.target.value })} style={inp} />
                      </div>
                      <button onClick={() => guardarDescargaReg(reg.id)} disabled={guardandoDescargaReg}
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

      {/* Lista servicios — terceros y propios */}
      {(tab === 'terceros' || tab === 'propios') && (
        <div>
          {serviciosFiltrados.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay servicios registrados.</div>
          )}
          {serviciosFiltrados.map(s => {
            const isCobrandoThis = cobrandoId === s.id
            const isEditandoPrecio = editandoPrecio?.id === s.id
            return (
              <div key={s.id} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, marginBottom: '1rem', overflow: 'hidden' }}>
                <div style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{s.cliente}</span>
                        <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: S.accentLight, color: S.accent }}>{s.labor}</span>
                        {s.cultivo && <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: S.greenLight, color: S.green }}>{s.cultivo}</span>}
                        {s.tipo_servicio === 'propio' && <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: S.purpleLight, color: S.purple }}>Propio</span>}
                      </div>
                      <div style={{ fontSize: 12, color: S.muted }}>
                        {s.fecha ? new Date(s.fecha+'T12:00:00').toLocaleDateString('es-AR') : '—'}
                        {s.campo ? ` · ${s.campo}` : ''}
                        {s.nro_lote ? ` · ${s.nro_lote}` : ''}
                        {` · ${s.hectareas} ha`}
                        {s.precio_ha ? ` · $${s.precio_ha.toLocaleString('es-AR')}/ha` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, marginLeft: 12 }}>
                      {s.total ? (
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, color: s.estado_pago === 'cobrado' ? S.green : S.text }}>
                          ${s.total.toLocaleString('es-AR')}
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: S.amber }}>Sin precio</span>
                      )}
                      <span style={{ padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: s.estado_pago === 'cobrado' ? S.greenLight : s.total ? S.amberLight : S.bg, color: s.estado_pago === 'cobrado' ? S.green : s.total ? S.amber : S.hint }}>
                        {s.estado_pago === 'cobrado' ? '✓ Cobrado' : s.total ? '⏳ Pendiente' : 'Sin precio'}
                      </span>
                    </div>
                  </div>

                  {/* Botones acción */}
                  {!esBrian && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                      <button onClick={() => setEditandoServicio(editandoServicio?.id === s.id ? null : { ...s, precio_ha: s.precio_ha ? String(s.precio_ha) : '', hectareas: String(s.hectareas), maquina_id: s.maquina_id ? String(s.maquina_id) : '' })}
                        style={{ padding: '5px 12px', fontSize: 12, background: S.bg, border: `1px solid ${S.border}`, color: S.muted, borderRadius: 5, cursor: 'pointer' }}>
                        ✏ Editar
                      </button>
                    </div>
                  )}
                  {s.estado_pago !== 'cobrado' && !esBrian && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      {!s.total && (
                        <button onClick={() => setEditandoPrecio(isEditandoPrecio ? null : { id: s.id, precio_ha: '', total: '' })}
                          style={{ padding: '5px 12px', fontSize: 12, background: S.amberLight, border: `1px solid #E8A020`, color: S.amber, borderRadius: 5, cursor: 'pointer', fontWeight: 600 }}>
                          {isEditandoPrecio ? 'Cancelar' : '$ Cargar precio'}
                        </button>
                      )}
                      {s.total && s.tipo_servicio !== 'propio' && (
                        <button onClick={() => {
                          setCobrandoId(isCobrandoThis ? null : s.id)
                          setFormCobro({ precio_ha: s.precio_ha ? String(s.precio_ha) : '', total: s.total ? String(s.total) : '', iva_pct: '0', fecha: new Date().toISOString().split('T')[0], pagos: [{ ...PAGO_INIT, monto: s.total ? String(s.total) : '' }] })
                        }}
                          style={{ padding: '5px 12px', fontSize: 12, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer', fontWeight: 600 }}>
                          {isCobrandoThis ? 'Cancelar' : '💳 Registrar cobro'}
                        </button>
                      )}
                      {s.labor === 'Cosecha' && (
                        <button onClick={async () => {
                          setTab('descargas')
                          await cargarDescargas(s.id)
                          setDescargasOpen(s.id)
                        }}
                          style={{ padding: '5px 12px', fontSize: 12, background: S.greenLight, border: `1px solid ${S.green}`, color: S.green, borderRadius: 5, cursor: 'pointer', fontWeight: 600 }}>
                          📦 Descargas
                        </button>
                      )}
                    </div>
                  )}

                  {/* Form cargar precio */}
                  {isEditandoPrecio && (
                    <div style={{ marginTop: 12, padding: '1rem', background: S.bg, borderRadius: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: '1rem', color: S.accent }}>Cargar precio y facturación</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
                        <div>
                          <Lbl>Precio $/ha</Lbl>
                          <input type="number" value={editandoPrecio.precio_ha} onChange={e => {
                            const p = e.target.value
                            const t = p && s.hectareas ? String(Math.round(parseFloat(p) * s.hectareas)) : editandoPrecio.total_neto
                            const iva = t && editandoPrecio.iva_pct ? String(Math.round(parseFloat(t) * parseFloat(editandoPrecio.iva_pct) / 100)) : ''
                            const totalCIva = t && iva ? String(Math.round(parseFloat(t) + parseFloat(iva))) : t
                            setEditandoPrecio({ ...editandoPrecio, precio_ha: p, total_neto: t, iva_monto: iva, total: totalCIva })
                          }} placeholder="ej. 45000" style={inpMono} />
                        </div>
                        <div>
                          <Lbl>Hectáreas</Lbl>
                          <div style={{ padding: '9px 12px', background: S.surface, border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, fontFamily: 'monospace', color: S.muted, fontWeight: 600 }}>
                            {s.hectareas} ha
                          </div>
                        </div>
                        <div>
                          <Lbl>Total neto $</Lbl>
                          <input type="number" value={editandoPrecio.total_neto} onChange={e => {
                            const t = e.target.value
                            const iva = t && editandoPrecio.iva_pct ? String(Math.round(parseFloat(t) * parseFloat(editandoPrecio.iva_pct) / 100)) : ''
                            const totalCIva = t && iva ? String(Math.round(parseFloat(t) + parseFloat(iva))) : t
                            setEditandoPrecio({ ...editandoPrecio, total_neto: t, iva_monto: iva, total: totalCIva })
                          }} placeholder="neto sin IVA" style={inpMono} />
                        </div>
                        <div>
                          <Lbl>¿Se factura?</Lbl>
                          <select value={editandoPrecio.factura || 'si'} onChange={e => setEditandoPrecio({ ...editandoPrecio, factura: e.target.value })} style={inp}>
                            <option value="si">Sí — con factura</option>
                            <option value="no">No — sin factura</option>
                          </select>
                        </div>
                        {editandoPrecio.factura !== 'no' && (
                          <>
                            <div>
                              <Lbl>IVA %</Lbl>
                              <select value={editandoPrecio.iva_pct || '21'} onChange={e => {
                                const pct = e.target.value
                                const iva = editandoPrecio.total_neto ? String(Math.round(parseFloat(editandoPrecio.total_neto) * parseFloat(pct) / 100)) : ''
                                const totalCIva = editandoPrecio.total_neto && iva ? String(Math.round(parseFloat(editandoPrecio.total_neto) + parseFloat(iva))) : editandoPrecio.total_neto
                                setEditandoPrecio({ ...editandoPrecio, iva_pct: pct, iva_monto: iva, total: totalCIva })
                              }} style={inp}>
                                <option value="0">0% (exento)</option>
                                <option value="10.5">10.5%</option>
                                <option value="21">21%</option>
                              </select>
                            </div>
                            <div>
                              <Lbl>IVA $</Lbl>
                              <div style={{ padding: '9px 12px', background: S.surface, border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, fontFamily: 'monospace', color: S.muted }}>
                                {editandoPrecio.iva_monto ? `$${parseFloat(editandoPrecio.iva_monto).toLocaleString('es-AR')}` : '—'}
                              </div>
                            </div>
                          </>
                        )}
                        <div>
                          <Lbl>Total con IVA $</Lbl>
                          <div style={{ padding: '9px 12px', background: S.greenLight, border: `1px solid ${S.green}`, borderRadius: 6, fontSize: 14, fontFamily: 'monospace', fontWeight: 700, color: S.green }}>
                            {editandoPrecio.total ? `$${parseFloat(editandoPrecio.total).toLocaleString('es-AR')}` : '—'}
                          </div>
                        </div>
                        <div>
                          <Lbl>Plazo de pago</Lbl>
                          <select value={editandoPrecio.plazo || ''} onChange={e => setEditandoPrecio({ ...editandoPrecio, plazo: e.target.value })} style={inp}>
                            <option value="">— Sin definir —</option>
                            <option value="contado">Contado</option>
                            <option value="30">30 días</option>
                            <option value="60">60 días</option>
                            <option value="90">90 días</option>
                          </select>
                        </div>
                        <div>
                          <Lbl>N° Factura (opcional)</Lbl>
                          <input type="text" value={editandoPrecio.nro_factura || ''} onChange={e => setEditandoPrecio({ ...editandoPrecio, nro_factura: e.target.value })}
                            placeholder="ej. 0001-00001234" style={{ ...inpMono }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => guardarPrecio(s)}
                          style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, background: S.accent, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                          💾 Guardar
                        </button>
                        <button onClick={() => setEditandoPrecio(null)}
                          style={{ padding: '8px 18px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Form editar servicio */}
                  {editandoServicio?.id === s.id && (
                    <div style={{ marginTop: 12, padding: '1rem', background: S.bg, borderRadius: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: '1rem' }}>Editar servicio</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
                        <div>
                          <Lbl>Cliente</Lbl>
                          <select value={editandoServicio.cliente} onChange={e => setEditandoServicio({ ...editandoServicio, cliente: e.target.value })} style={inp}>
                            {contactos.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                          </select>
                        </div>
                        <div>
                          <Lbl>Labor</Lbl>
                          <select value={editandoServicio.labor} onChange={e => setEditandoServicio({ ...editandoServicio, labor: e.target.value })} style={inp}>
                            {LABORES.map(l => <option key={l}>{l}</option>)}
                          </select>
                        </div>
                        <div>
                          <Lbl>Cultivo</Lbl>
                          <select value={editandoServicio.cultivo || ''} onChange={e => setEditandoServicio({ ...editandoServicio, cultivo: e.target.value })} style={inp}>
                            <option value="">— Sin especificar —</option>
                            {CULTIVOS.map(c => <option key={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <Lbl>Fecha</Lbl>
                          <input type="date" value={editandoServicio.fecha} onChange={e => setEditandoServicio({ ...editandoServicio, fecha: e.target.value })} style={inp} />
                        </div>
                        <div>
                          <Lbl>Campo</Lbl>
                          <input type="text" value={editandoServicio.campo || ''} onChange={e => setEditandoServicio({ ...editandoServicio, campo: e.target.value })} style={inp} />
                        </div>
                        <div>
                          <Lbl>N° Lote</Lbl>
                          <input type="text" value={editandoServicio.nro_lote || ''} onChange={e => setEditandoServicio({ ...editandoServicio, nro_lote: e.target.value })} style={inp} />
                        </div>
                        <div>
                          <Lbl>Hectáreas</Lbl>
                          <input type="number" value={editandoServicio.hectareas} onChange={e => setEditandoServicio({ ...editandoServicio, hectareas: e.target.value })} style={inpMono} />
                        </div>
                        <div>
                          <Lbl>Precio $/ha</Lbl>
                          <input type="number" value={editandoServicio.precio_ha} onChange={e => setEditandoServicio({ ...editandoServicio, precio_ha: e.target.value })} style={inpMono} />
                        </div>
                        <div>
                          <Lbl>Máquina</Lbl>
                          <select value={editandoServicio.maquina_id || ''} onChange={e => setEditandoServicio({ ...editandoServicio, maquina_id: e.target.value })} style={inp}>
                            <option value="">— Sin asignar —</option>
                            {maquinaria.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                          </select>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={guardarEditServicio} disabled={guardandoEdit}
                          style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, background: S.accent, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                          {guardandoEdit ? 'Guardando...' : '💾 Guardar cambios'}
                        </button>
                        <button onClick={() => setEditandoServicio(null)}
                          style={{ padding: '8px 18px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Form cobro con multipago */}
                  {isCobrandoThis && (
                    <div style={{ marginTop: 12, padding: '1rem', background: S.bg, borderRadius: 8 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: '1rem' }}>
                        <div>
                          <Lbl>Precio $/ha</Lbl>
                          <input type="number" value={formCobro.precio_ha} onChange={e => setFormCobro({ ...formCobro, precio_ha: e.target.value })} style={inpMono} />
                        </div>
                        <div>
                          <Lbl>Total $</Lbl>
                          <input type="number" value={formCobro.total} onChange={e => setFormCobro({ ...formCobro, total: e.target.value })} style={inpMono} />
                        </div>
                        <div>
                          <Lbl>IVA %</Lbl>
                          <input type="number" value={formCobro.iva_pct} onChange={e => setFormCobro({ ...formCobro, iva_pct: e.target.value })} placeholder="0, 10.5 o 21" style={inpMono} />
                        </div>
                        <div>
                          <Lbl>Fecha cobro</Lbl>
                          <input type="date" value={formCobro.fecha} onChange={e => setFormCobro({ ...formCobro, fecha: e.target.value })} style={inp} />
                        </div>
                      </div>
                      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: S.muted, textTransform: 'uppercase' }}>Formas de pago</div>
                        <button onClick={() => setFormCobro({ ...formCobro, pagos: [...formCobro.pagos, { ...PAGO_INIT }] })}
                          style={{ padding: '4px 10px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>
                          + Agregar
                        </button>
                      </div>
                      {formCobro.pagos.map((p, pi) => (
                        <div key={pi} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '.75rem', marginBottom: 6 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8, alignItems: 'flex-end' }}>
                            <div>
                              <Lbl>Forma de pago</Lbl>
                              <select value={p.tipo} onChange={e => {
                                const pagos = formCobro.pagos.map((x, i) => i === pi ? { ...x, tipo: e.target.value } : x)
                                setFormCobro({ ...formCobro, pagos })
                              }} style={inp}>
                                {['transferencia', 'efectivo', 'cheque_propio', 'cheque_tercero'].map(t => (
                                  <option key={t} value={t}>{t === 'cheque_propio' ? 'E-cheq propio' : t === 'cheque_tercero' ? 'Cheque tercero' : t.charAt(0).toUpperCase() + t.slice(1)}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <Lbl>Monto $</Lbl>
                              <input type="number" value={p.monto} onChange={e => {
                                const pagos = formCobro.pagos.map((x, i) => i === pi ? { ...x, monto: e.target.value } : x)
                                setFormCobro({ ...formCobro, pagos })
                              }} style={inpMono} />
                            </div>
                            <div>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer' }}>
                                <input type="checkbox" checked={p.es_paralelo} onChange={e => {
                                  const pagos = formCobro.pagos.map((x, i) => i === pi ? { ...x, es_paralelo: e.target.checked } : x)
                                  setFormCobro({ ...formCobro, pagos })
                                }} />
                                Paralelo
                              </label>
                            </div>
                          </div>
                          {p.tipo === 'cheque_propio' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
                              <div><Lbl>N° Cheque</Lbl><input type="text" value={p.cheque_propio?.numero || ''} onChange={e => { const pagos = formCobro.pagos.map((x, i) => i === pi ? { ...x, cheque_propio: { ...x.cheque_propio, numero: e.target.value } } : x); setFormCobro({ ...formCobro, pagos }) }} style={inpMono} /></div>
                              <div><Lbl>Banco</Lbl><input type="text" value={p.cheque_propio?.banco || ''} onChange={e => { const pagos = formCobro.pagos.map((x, i) => i === pi ? { ...x, cheque_propio: { ...x.cheque_propio, banco: e.target.value } } : x); setFormCobro({ ...formCobro, pagos }) }} style={inp} /></div>
                              <div><Lbl>Vencimiento</Lbl><input type="date" value={p.cheque_propio?.fecha_vencimiento || ''} onChange={e => { const pagos = formCobro.pagos.map((x, i) => i === pi ? { ...x, cheque_propio: { ...x.cheque_propio, fecha_vencimiento: e.target.value } } : x); setFormCobro({ ...formCobro, pagos }) }} style={inp} /></div>
                            </div>
                          )}
                        </div>
                      ))}
                      <div style={{ marginTop: 10, padding: '8px 12px', background: S.greenLight, borderRadius: 6, fontSize: 13, color: S.green, fontWeight: 600 }}>
                        Total pagos: ${formCobro.pagos.reduce((a, p) => a + (parseFloat(p.monto) || 0), 0).toLocaleString('es-AR')}
                        {formCobro.total && ` · Saldo: $${(parseFloat(formCobro.total) - formCobro.pagos.reduce((a, p) => a + (parseFloat(p.monto) || 0), 0)).toLocaleString('es-AR')}`}
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button onClick={() => guardarCobro(s)} disabled={guardandoCobro}
                          style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, background: S.green, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                          {guardandoCobro ? 'Guardando...' : '✓ Confirmar cobro'}
                        </button>
                        <button onClick={() => setCobrandoId(null)}
                          style={{ padding: '8px 18px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
