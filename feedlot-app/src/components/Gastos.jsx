import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Loader } from './Tablero'

const S = {
  bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6',
  text: '#1A1916', muted: '#6B6760', hint: '#9E9A94',
  accent: '#1A3D6B', accentLight: '#E8EFF8',
  green: '#1E5C2E', greenLight: '#E8F4EB',
  amber: '#7A4500', amberLight: '#FDF0E0',
  red: '#7A1A1A', redLight: '#FDF0F0',
  purple: '#3D1A6B', purpleLight: '#F0EAFB',
}

const inputStyle = { width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: "'IBM Plex Sans', sans-serif", color: S.text }

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{children}</div>
}

function Card({ children, style = {} }) {
  return <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1rem', ...style }}>{children}</div>
}

const CATEGORIAS_GASTO = {
  Feedlot:     ['Combustible', 'Ferretería', 'Taller / Reparaciones', 'Veterinario', 'Flete', 'Electricidad', 'Agua', 'Rodados', 'Otro feedlot'],
  Agricultura: ['Combustible', 'Agroquímicos', 'Semillas', 'Fertilizantes', 'Flete granos', 'Reparaciones', 'Laboreo', 'Otro agricultura'],
  Servicios:   ['Contratista siembra', 'Contratista cosecha', 'Laboreo', 'Pulverización', 'Otro servicio'],
  General:     ['Contabilidad', 'Impuestos', 'Monotributo', 'Seguros', 'Honorarios', 'Comunicaciones', 'Servicios públicos', 'Otro general'],
}

const ACTIVIDAD_COLORS = {
  Feedlot:     { bg: '#E8EFF8', color: '#1A3D6B' },
  Agricultura: { bg: '#E8F4EB', color: '#1E5C2E' },
  Servicios:   { bg: '#FDF0E0', color: '#7A4500' },
  General:     { bg: '#F0EAFB', color: '#3D1A6B' },
}

const PAGO_INIT = { tipo: 'transferencia', monto: '', es_paralelo: false, subtipo_cheque: '', cheque_propio: { numero: '', banco: '', fecha_vencimiento: '' }, cheque_tercero_id: '' }

const FORM_INIT = {
  actividad: 'Feedlot', categoria: 'Combustible', descripcion: '', monto: '',
  fecha: new Date().toISOString().split('T')[0],
  proveedor: '', comprobante: '',
  // Datos proveedor para recibo
  domicilio: '', localidad: '', cuit: '', iva: '', cbu: '',
  pagos: [{ ...PAGO_INIT }],
}

// Convierte número a letras (pesos argentinos)
function numeroALetras(num) {
  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
    'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE']
  const decenas = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
  const centenas = ['', 'CIEN', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']

  if (num === 0) return 'CERO'
  if (num < 0) return 'MENOS ' + numeroALetras(-num)

  let resultado = ''
  if (num >= 1000000) {
    const mill = Math.floor(num / 1000000)
    resultado += (mill === 1 ? 'UN MILLÓN ' : numeroALetras(mill) + ' MILLONES ')
    num %= 1000000
  }
  if (num >= 1000) {
    const miles = Math.floor(num / 1000)
    resultado += (miles === 1 ? 'MIL ' : numeroALetras(miles) + ' MIL ')
    num %= 1000
  }
  if (num >= 100) {
    if (num === 100) resultado += 'CIEN '
    else resultado += centenas[Math.floor(num / 100)] + ' '
    num %= 100
  }
  if (num >= 20) {
    resultado += decenas[Math.floor(num / 10)]
    if (num % 10 > 0) resultado += ' Y ' + unidades[num % 10]
    resultado += ' '
  } else if (num > 0) {
    resultado += unidades[num] + ' '
  }
  return resultado.trim()
}

function montoEnLetras(monto) {
  const entero = Math.floor(monto)
  const centavos = Math.round((monto - entero) * 100)
  let texto = numeroALetras(entero) + ' PESOS'
  if (centavos > 0) texto += ' CON ' + numeroALetras(centavos) + ' CENTAVOS'
  return texto + '.-'
}

function generarRecibo(gasto, pagos) {
  const fecha = new Date(gasto.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const totalMonto = pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)

  const filasPago = pagos.map(p => {
    let desc = p.tipo === 'transferencia' ? 'TRANSFERENCIA' :
               p.tipo === 'efectivo' ? 'EFECTIVO' :
               p.tipo === 'cuenta_corriente' ? 'CUENTA CORRIENTE' :
               p.subtipo_cheque === 'propio' ? `E-CHEQ PROPIO` :
               `E-CHEQ TERCERO`
    let nro = p.subtipo_cheque === 'propio' ? (p.cheque_propio?.numero || '') : ''
    let fechaCobro = p.subtipo_cheque === 'propio' ? (p.cheque_propio?.fecha_vencimiento ? new Date(p.cheque_propio.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR') : '') : ''
    if (p.es_paralelo) desc += ' (PARALELO)'
    return `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #ddd;">${desc}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:center;">${nro}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:center;">${fechaCobro}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:right;font-weight:600;">$ ${parseFloat(p.monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
    </tr>`
  }).join('')

  const bloqueRecibo = `
    <div style="border:1px solid #333;padding:20px;font-family:Arial,sans-serif;font-size:12px;width:100%;box-sizing:border-box;">
      <!-- Header -->
      <table style="width:100%;margin-bottom:10px;">
        <tr>
          <td style="width:33%;vertical-align:top;">
            <div style="font-weight:bold;">Pedro Barciocco 1221</div>
            <div>TEL: 3574-442656</div>
            <div style="margin-top:8px;border:1px solid #333;display:inline-block;padding:2px 6px;font-weight:bold;">X &nbsp; NO VALIDO COMO FACTURA</div>
            <div style="font-size:11px;margin-top:2px;">Orden de pago</div>
          </td>
          <td style="width:34%;text-align:center;vertical-align:middle;">
            <div style="font-size:22px;font-weight:900;letter-spacing:1px;">RAMONDA</div>
            <div style="font-size:14px;font-weight:600;">HNOS S.A.</div>
          </td>
          <td style="width:33%;text-align:right;vertical-align:top;">
            <div>CUIT: &nbsp;30-71682182-6</div>
            <div>I.V.A. &nbsp;Responsable inscripto</div>
          </td>
        </tr>
      </table>
      <hr style="border:1px solid #333;margin:8px 0;">
      <!-- Datos proveedor -->
      <table style="width:100%;border:1px solid #333;margin-bottom:0;">
        <tr><td colspan="2" style="padding:4px 8px;font-weight:bold;background:#f5f5f5;">Entrego a:</td></tr>
        <tr>
          <td style="padding:4px 8px;width:50%;">Nombre: <strong>${gasto.proveedor || ''}</strong></td>
          <td style="padding:4px 8px;">I.V.A.: ${gasto.iva || ''}</td>
        </tr>
        <tr>
          <td style="padding:4px 8px;">Domicilio: ${gasto.domicilio || ''}</td>
          <td style="padding:4px 8px;">CUIT/DNI: ${gasto.cuit || ''}</td>
        </tr>
        <tr>
          <td style="padding:4px 8px;">Localidad: ${gasto.localidad || ''}</td>
          <td style="padding:4px 8px;"></td>
        </tr>
        <tr>
          <td style="padding:4px 8px;">C.B.U: ${gasto.cbu || ''}</td>
          <td style="padding:4px 8px;">FECHA &nbsp;<strong>${fecha}</strong></td>
        </tr>
      </table>
      <!-- Medios de pago -->
      <table style="width:100%;border:1px solid #333;border-top:none;border-collapse:collapse;">
        <tr><td colspan="4" style="padding:4px 8px;font-weight:bold;background:#f5f5f5;border-bottom:1px solid #333;">Medio de pago</td></tr>
        <tr style="background:#eee;">
          <th style="padding:6px 8px;text-align:left;border-bottom:1px solid #333;font-size:11px;">DESCRIPCIÓN</th>
          <th style="padding:6px 8px;text-align:center;border-bottom:1px solid #333;font-size:11px;">NRO/CHEQUE</th>
          <th style="padding:6px 8px;text-align:center;border-bottom:1px solid #333;font-size:11px;">FECHA DE COBRO</th>
          <th style="padding:6px 8px;text-align:right;border-bottom:1px solid #333;font-size:11px;">IMPORTE</th>
        </tr>
        ${filasPago}
        <tr style="height:30px;"><td colspan="4"></td></tr>
        <tr style="border-top:1px solid #333;">
          <td colspan="3" style="padding:8px;text-align:right;font-weight:bold;">IMPORTE TOTAL A COBRAR &nbsp; $</td>
          <td style="padding:8px;text-align:right;font-weight:bold;">${totalMonto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
        </tr>
      </table>
      <!-- Concepto -->
      <table style="width:100%;border:1px solid #333;border-top:none;border-collapse:collapse;">
        <tr><td style="padding:4px 8px;font-weight:bold;border-bottom:1px solid #ddd;background:#f5f5f5;">Concepto:</td></tr>
        <tr><td style="padding:6px 8px;">
          ${gasto.descripcion ? `<strong>${gasto.descripcion}</strong><br>` : ''}
          Observación: RAMONDA HNOS S.A. no se responsabiliza por el vencimiento de cheques/e-cheq de terceros.<br>
          Cantidad de pesos: &nbsp;${montoEnLetras(totalMonto)}
        </td></tr>
        <tr><td style="padding:20px 8px 30px 8px;">&nbsp;</td></tr>
        <tr>
          <td style="padding:8px;">
            <table style="width:100%;"><tr>
              <td style="width:40%;text-align:center;border-top:1px solid #333;">Firma</td>
              <td style="width:20%;"></td>
              <td style="width:40%;text-align:center;border-top:1px solid #333;">DNI</td>
            </tr></table>
          </td>
        </tr>
      </table>
    </div>`

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Recibo - ${gasto.proveedor || 'Proveedor'}</title>
  <style>
    @media print {
      body { margin: 0; padding: 10px; }
      .no-print { display: none; }
      .recibo { page-break-inside: avoid; }
    }
    body { font-family: Arial, sans-serif; background: #fff; }
    .recibo { margin-bottom: 20px; }
    .corte { border-top: 2px dashed #999; margin: 16px 0; text-align: center; font-size: 11px; color: #999; padding: 4px 0; }
  </style>
</head>
<body>
  <div style="text-align:right;margin-bottom:10px;" class="no-print">
    <button onclick="window.print()" style="padding:8px 20px;font-size:14px;cursor:pointer;background:#1A3D6B;color:#fff;border:none;border-radius:6px;">🖨️ Imprimir / Guardar PDF</button>
  </div>
  <div class="recibo">${bloqueRecibo}</div>
  <div class="corte">✂ &nbsp;&nbsp; CORTAR AQUÍ &nbsp;&nbsp; ✂</div>
  <div class="recibo">${bloqueRecibo}</div>
</body>
</html>`

  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
}

export default function Gastos({ usuario }) {
  const [loading, setLoading] = useState(true)
  const [gastos, setGastos] = useState([])
  const [chequesCartera, setChequesCartera] = useState([])
  const [contactos, setContactos] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [filtroActividad, setFiltroActividad] = useState('')
  const [filtroAnio, setFiltroAnio] = useState(String(new Date().getFullYear()))
  const [form, setForm] = useState(FORM_INIT)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: g }, { data: ch }, { data: ct }] = await Promise.all([
      supabase.from('gastos_generales').select('*').order('fecha', { ascending: false }),
      supabase.from('cheques').select('*').eq('tipo', 'recibido').eq('estado', 'en_cartera').order('fecha_vencimiento', { ascending: true }),
      supabase.from('contactos').select('*').order('nombre'),
    ])
    setGastos(g || [])
    setChequesCartera(ch || [])
    setContactos(ct || [])
    setLoading(false)
  }

  function setPago(idx, campo, valor) {
    const nuevos = form.pagos.map((p, i) => i === idx ? { ...p, [campo]: valor } : p)
    setForm({ ...form, pagos: nuevos })
  }

  function setPagoMulti(idx, updates) {
    const nuevos = form.pagos.map((p, i) => i === idx ? { ...p, ...updates } : p)
    setForm({ ...form, pagos: nuevos })
  }

  function setPagoChequePropio(idx, campo, valor) {
    const nuevos = form.pagos.map((p, i) => i === idx ? { ...p, cheque_propio: { ...p.cheque_propio, [campo]: valor } } : p)
    setForm({ ...form, pagos: nuevos })
  }

  function agregarPago() {
    setForm({ ...form, pagos: [...form.pagos, { ...PAGO_INIT }] })
  }

  function quitarPago(idx) {
    if (form.pagos.length === 1) return
    setForm({ ...form, pagos: form.pagos.filter((_, i) => i !== idx) })
  }

  const totalPagos = form.pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
  const montoTotal = parseFloat(form.monto) || 0
  const diferencia = montoTotal - totalPagos

  async function guardar() {
    if (!form.categoria || !form.monto) { alert('Completá categoría y monto'); return }
    if (Math.abs(diferencia) > 0.5) { alert(`El total de pagos ($${totalPagos.toLocaleString('es-AR')}) no coincide con el monto ($${montoTotal.toLocaleString('es-AR')})`); return }
    setGuardando(true)

    let caja_oficial_id = null
    let caja_paralela_id = null

    for (const pago of form.pagos) {
      const monto = parseFloat(pago.monto) || 0
      if (!monto) continue
      const formaPago = pago.subtipo_cheque ? 'e-cheq' : pago.tipo
      const desc = `${form.actividad} — ${form.categoria}${form.descripcion ? ': ' + form.descripcion : ''}${form.proveedor ? ' (' + form.proveedor + ')' : ''}`

      if (pago.es_paralelo) {
        const { data: cp } = await supabase.from('caja_paralela').insert({
          fecha: form.fecha, tipo: 'egreso', descripcion: desc, monto,
        }).select().single()
        if (!caja_paralela_id) caja_paralela_id = cp?.id || null
      } else {
        const { data: co } = await supabase.from('caja_oficial').insert({
          fecha: form.fecha, tipo: 'egreso',
          categoria: `Gastos ${form.actividad}`,
          descripcion: desc, monto, forma_pago: formaPago,
        }).select().single()
        if (!caja_oficial_id) caja_oficial_id = co?.id || null
      }

      // Cheques
      if (!pago.es_paralelo && pago.subtipo_cheque === 'propio') {
        await supabase.from('cheques').insert({
          tipo: 'emitido', numero: pago.cheque_propio.numero || null,
          banco: pago.cheque_propio.banco || null,
          fecha_cobro: form.fecha,
          fecha_vencimiento: pago.cheque_propio.fecha_vencimiento,
          monto, beneficiario: form.proveedor || null,
          estado: 'en_cartera', caja_oficial_id,
          registrado_por: usuario?.id,
        })
      } else if (pago.subtipo_cheque === 'tercero' && pago.cheque_tercero_id) {
        await supabase.from('cheques').update({ estado: 'depositado' }).eq('id', parseInt(pago.cheque_tercero_id))
      }
    }

    await supabase.from('gastos_generales').insert({
      actividad: form.actividad,
      categoria: form.categoria,
      descripcion: form.descripcion || null,
      monto: montoTotal,
      fecha: form.fecha,
      proveedor: form.proveedor || null,
      comprobante: form.comprobante || null,
      domicilio: form.domicilio || null,
      localidad: form.localidad || null,
      cuit: form.cuit || null,
      iva: form.iva || null,
      cbu: form.cbu || null,
      pagos_detalle: form.pagos,
      forma_pago: form.pagos.map(p => p.subtipo_cheque || p.tipo).join('+'),
      es_paralelo: form.pagos.some(p => p.es_paralelo),
      caja_oficial_id,
      caja_paralela_id,
      registrado_por: usuario?.id,
    })

    await cargar()
    setShowForm(false)
    setForm(FORM_INIT)
    setGuardando(false)
  }

  async function eliminar(g) {
    if (!confirm('¿Eliminar este gasto? Se eliminará también de la caja.')) return
    if (g.caja_oficial_id) await supabase.from('caja_oficial').delete().eq('id', g.caja_oficial_id)
    if (g.caja_paralela_id) await supabase.from('caja_paralela').delete().eq('id', g.caja_paralela_id)
    await supabase.from('gastos_generales').delete().eq('id', g.id)
    await cargar()
  }

  if (loading) return <Loader />

  const anio = parseInt(filtroAnio) || new Date().getFullYear()
  const gastosFiltrados = gastos.filter(g => {
    const matchAnio = new Date(g.fecha).getFullYear() === anio
    const matchAct = !filtroActividad || g.actividad === filtroActividad
    return matchAnio && matchAct
  })
  const totalAnio = gastosFiltrados.reduce((s, g) => s + (g.monto || 0), 0)
  const aniosDisponibles = [...new Set(gastos.map(g => new Date(g.fecha).getFullYear()))].sort((a, b) => b - a)
  if (!aniosDisponibles.includes(new Date().getFullYear())) aniosDisponibles.unshift(new Date().getFullYear())

  const porActividad = {}
  Object.keys(CATEGORIAS_GASTO).forEach(a => {
    porActividad[a] = gastosFiltrados.filter(g => g.actividad === a).reduce((s, g) => s + (g.monto || 0), 0)
  })

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 3 }}>Gastos generales</div>
      <div style={{ fontSize: 12, color: S.muted, marginBottom: '1.5rem' }}>Feedlot · Agricultura · Servicios · General</div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: '1.25rem', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={filtroAnio} onChange={e => setFiltroAnio(e.target.value)}
            style={{ padding: '7px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface }}>
            {aniosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={filtroActividad} onChange={e => setFiltroActividad(e.target.value)}
            style={{ padding: '7px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface }}>
            <option value="">Todas las actividades</option>
            {Object.keys(CATEGORIAS_GASTO).map(a => <option key={a}>{a}</option>)}
          </select>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          + Registrar gasto
        </button>
      </div>

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
        {Object.entries(porActividad).map(([act, total]) => {
          const cs = ACTIVIDAD_COLORS[act] || { bg: S.bg, color: S.muted }
          return (
            <div key={act} onClick={() => setFiltroActividad(filtroActividad === act ? '' : act)}
              style={{ background: filtroActividad === act ? cs.bg : S.surface, border: `1px solid ${filtroActividad === act ? cs.color : S.border}`, borderRadius: 8, padding: '1rem', cursor: 'pointer' }}>
              <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', marginBottom: 5 }}>{act}</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: total > 0 ? S.red : S.hint }}>{total > 0 ? `$${total.toLocaleString('es-AR')}` : '—'}</div>
            </div>
          )
        })}
      </div>

      {/* Formulario */}
      {showForm && (
        <Card>
          <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: '1rem' }}>Nuevo gasto</div>

          {/* Datos del gasto */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <Label>Actividad</Label>
              <select value={form.actividad} onChange={e => setForm({...form, actividad: e.target.value, categoria: CATEGORIAS_GASTO[e.target.value][0]})} style={inputStyle}>
                {Object.keys(CATEGORIAS_GASTO).map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <Label>Categoría</Label>
              <select value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} style={inputStyle}>
                {(CATEGORIAS_GASTO[form.actividad] || []).map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label>Monto total $</Label>
              <input type="number" value={form.monto} onChange={e => setForm({...form, monto: e.target.value})} style={inputStyle} />
            </div>
            <div>
              <Label>Fecha</Label>
              <input type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} style={inputStyle} />
            </div>
            <div>
              <Label>Descripción</Label>
              <input type="text" value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} style={inputStyle} />
            </div>
            <div>
              <Label>N° comprobante</Label>
              <input type="text" value={form.comprobante} onChange={e => setForm({...form, comprobante: e.target.value})} style={inputStyle} />
            </div>
          </div>

          {/* Datos proveedor para recibo */}
          <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '12px', marginBottom: '1rem' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 10 }}>Datos del proveedor (para el recibo)</div>
            <div style={{ marginBottom: 10 }}>
              <Label>Seleccionar de contactos</Label>
              <select onChange={e => {
                const ct = contactos.find(c => String(c.id) === e.target.value)
                if (ct) setForm({...form, proveedor: ct.nombre, domicilio: ct.banco || '', localidad: ct.localidad || '', cuit: ct.cuit || '', iva: ct.iva || '', cbu: ct.cbu || ''})
              }} style={inputStyle} defaultValue="">
                <option value="">— Seleccionar contacto —</option>
                {contactos.map(c => <option key={c.id} value={c.id}>{c.nombre}{c.cuit ? ` · ${c.cuit}` : ''}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div><Label>Nombre / Razón social</Label><input type="text" value={form.proveedor} onChange={e => setForm({...form, proveedor: e.target.value})} style={inputStyle} /></div>
              <div><Label>Domicilio</Label><input type="text" value={form.domicilio} onChange={e => setForm({...form, domicilio: e.target.value})} style={inputStyle} /></div>
              <div><Label>Localidad</Label><input type="text" value={form.localidad} onChange={e => setForm({...form, localidad: e.target.value})} style={inputStyle} /></div>
              <div><Label>CUIT / DNI</Label><input type="text" value={form.cuit} onChange={e => setForm({...form, cuit: e.target.value})} style={inputStyle} /></div>
              <div><Label>Condición IVA</Label><input type="text" value={form.iva} onChange={e => setForm({...form, iva: e.target.value})} style={inputStyle} placeholder="ej. Monotributista" /></div>
              <div><Label>CBU</Label><input type="text" value={form.cbu} onChange={e => setForm({...form, cbu: e.target.value})} style={inputStyle} /></div>
            </div>
          </div>

          {/* Formas de pago */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase' }}>Formas de pago</div>
              <button onClick={agregarPago}
                style={{ padding: '4px 12px', fontSize: 12, background: 'transparent', border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 6, cursor: 'pointer' }}>
                + Agregar forma de pago
              </button>
            </div>

            {form.pagos.map((pago, idx) => (
              <div key={idx} style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '12px', marginBottom: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 8, alignItems: 'flex-end', marginBottom: pago.tipo === 'e-cheq' ? 10 : 0 }}>
                  <div>
                    <Label>Forma de pago</Label>
                    <select value={pago.tipo} onChange={e => setPago(idx, 'tipo', e.target.value)}
                      style={inputStyle}>
                      <option value="transferencia">Transferencia</option>
                      <option value="efectivo">Efectivo</option>
                      <option value="e-cheq">E-cheq</option>
                      <option value="cuenta_corriente">Cuenta corriente</option>
                    </select>
                  </div>
                  <div>
                    <Label>Monto $</Label>
                    <input type="number" value={pago.monto} onChange={e => setPago(idx, 'monto', e.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: S.purple, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <input type="checkbox" checked={pago.es_paralelo} onChange={e => setPago(idx, 'es_paralelo', e.target.checked)} />
                      Paralelo
                    </label>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                    {form.pagos.length > 1 && (
                      <button onClick={() => quitarPago(idx)}
                        style={{ padding: '6px 10px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>✕</button>
                    )}
                  </div>
                </div>

                {/* E-cheq */}
                {pago.tipo === 'e-cheq' && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: pago.subtipo_cheque ? 10 : 0 }}>
                      {(pago.es_paralelo ? ['tercero'] : ['propio', 'tercero']).map(t => (
                        <button key={t} onClick={() => setPago(idx, 'subtipo_cheque', pago.subtipo_cheque === t ? '' : t)}
                          style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer', border: `1px solid ${pago.subtipo_cheque === t ? S.accent : S.border}`, background: pago.subtipo_cheque === t ? S.accentLight : 'transparent', color: pago.subtipo_cheque === t ? S.accent : S.muted }}>
                          {t === 'propio' ? '📤 Propio' : '📥 Tercero'}
                        </button>
                      ))}
                    </div>
                    {pago.subtipo_cheque === 'propio' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
                        <div><Label>N° cheque</Label><input type="text" value={pago.cheque_propio.numero} onChange={e => setPagoChequePropio(idx, 'numero', e.target.value)} style={inputStyle} /></div>
                        <div><Label>Banco</Label><input type="text" value={pago.cheque_propio.banco} onChange={e => setPagoChequePropio(idx, 'banco', e.target.value)} style={inputStyle} /></div>
                        <div><Label>Vencimiento *</Label><input type="date" value={pago.cheque_propio.fecha_vencimiento} onChange={e => setPagoChequePropio(idx, 'fecha_vencimiento', e.target.value)} style={{ ...inputStyle, borderColor: S.amber }} /></div>
                      </div>
                    )}
                    {pago.subtipo_cheque === 'tercero' && (
                      <div style={{ marginTop: 8 }}>
                        {(() => {
                          const lista = chequesCartera.filter(ch => pago.es_paralelo ? ch.es_paralelo : !ch.es_paralelo)
                          return lista.length === 0
                            ? <div style={{ fontSize: 13, color: S.hint }}>No hay cheques en cartera {pago.es_paralelo ? '(paralelo)' : '(oficial)'}.</div>
                            : lista.map(ch => (
                              <label key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', border: `1px solid ${pago.cheque_tercero_id === String(ch.id) ? S.accent : S.border}`, borderRadius: 6, background: pago.cheque_tercero_id === String(ch.id) ? S.accentLight : S.surface, cursor: 'pointer', marginBottom: 5 }}>
                                <input type="radio" name={`cheque_pago_${idx}`} value={ch.id} checked={pago.cheque_tercero_id === String(ch.id)} onChange={() => setPagoMulti(idx, { cheque_tercero_id: String(ch.id), monto: String(ch.monto || '') })} />
                                <div style={{ fontSize: 13 }}>
                                  <strong>${ch.monto?.toLocaleString('es-AR')}</strong>
                                  <span style={{ color: S.muted, marginLeft: 8 }}>#{ch.numero || 'sin nro'} · {ch.banco || '—'} · vence {ch.fecha_vencimiento ? new Date(ch.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR') : '—'}{ch.librador ? ` · ${ch.librador}` : ''}</span>
                                </div>
                              </label>
                            ))
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Resumen pagos */}
            {montoTotal > 0 && (
              <div style={{ background: Math.abs(diferencia) < 0.5 ? S.greenLight : S.amberLight, border: `1px solid ${Math.abs(diferencia) < 0.5 ? '#97C459' : '#EF9F27'}`, borderRadius: 6, padding: '8px 12px', fontSize: 13 }}>
                <span style={{ color: S.muted }}>Total gasto: <strong>${montoTotal.toLocaleString('es-AR')}</strong></span>
                <span style={{ margin: '0 12px', color: S.muted }}>|</span>
                <span style={{ color: S.muted }}>Total pagos: <strong>${totalPagos.toLocaleString('es-AR')}</strong></span>
                {Math.abs(diferencia) >= 0.5 && (
                  <span style={{ marginLeft: 12, color: S.amber, fontWeight: 600 }}>Diferencia: ${diferencia.toLocaleString('es-AR')}</span>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
            <button onClick={guardar} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
              {guardando ? 'Guardando...' : '💾 Guardar'}
            </button>
          </div>
        </Card>
      )}

      {/* Historial */}
      <Card>
        <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>
          Historial {filtroActividad ? `— ${filtroActividad}` : ''}
        </div>
        <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 700 }}>
            <thead>
              <tr style={{ background: S.bg }}>
                {['Fecha', 'Actividad', 'Categoría', 'Descripción', 'Proveedor', 'Pago', 'Monto', ''].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gastosFiltrados.length === 0 && <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay gastos en este período.</td></tr>}
              {gastosFiltrados.map(g => {
                const cs = ACTIVIDAD_COLORS[g.actividad] || { bg: S.bg, color: S.muted }
                return (
                  <tr key={g.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(g.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                    <td style={{ padding: '9px 12px' }}><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: cs.bg, color: cs.color }}>{g.actividad || '—'}</span></td>
                    <td style={{ padding: '9px 12px' }}><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: S.amberLight, color: S.amber }}>{g.categoria}</span></td>
                    <td style={{ padding: '9px 12px', color: S.muted }}>{g.descripcion || '—'}</td>
                    <td style={{ padding: '9px 12px', color: S.muted }}>{g.proveedor || '—'}</td>
                    <td style={{ padding: '9px 12px', fontSize: 11 }}>{g.es_paralelo ? <span style={{ color: S.purple, fontWeight: 600 }}>Paralelo</span> : g.forma_pago || '—'}</td>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600, color: S.red }}>${g.monto?.toLocaleString('es-AR')}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => generarRecibo(g, g.pagos_detalle || [])}
                          style={{ padding: '3px 8px', fontSize: 11, background: S.accentLight, border: `1px solid #85B7EB`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>
                          🖨️ Recibo
                        </button>
                        <button onClick={() => eliminar(g)} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
