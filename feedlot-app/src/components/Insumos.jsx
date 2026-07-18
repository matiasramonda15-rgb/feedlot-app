import React, { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { hoyLocal, fechaLocal } from '../shared/dateUtils'
import { Loader } from './UI'
import { PAGO_INIT, ListaPagos } from './PagoFormulario'
import { ChecklistComprasPendientes, pagarComprasPendientes } from './comprasPendientesLogic'

const S = {
  bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6',
  text: '#1A1916', muted: '#6B6760', hint: '#9E9A94',
  accent: '#1A3D6B', accentLight: '#E8EFF8',
  green: '#1E5C2E', greenLight: '#E8F4EB',
  amber: '#7A4500', amberLight: '#FDF0E0',
  red: '#7A1A1A', redLight: '#FDF0F0',
  purple: '#3D1A6B', purpleLight: '#F0EAFB',
}
const inp = { width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: "'IBM Plex Sans', sans-serif", color: S.text }
const inpMono = { ...inp, fontFamily: 'monospace' }
const Lbl = ({ children }) => <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{children}</div>


function numeroALetras(num) {
  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
    'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE']
  const decenas = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
  const centenas = ['', 'CIEN', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']
  if (num === 0) return 'CERO'
  let resultado = ''
  if (num >= 1000000) { const m = Math.floor(num / 1000000); resultado += (m === 1 ? 'UN MILLÓN ' : numeroALetras(m) + ' MILLONES '); num %= 1000000 }
  if (num >= 1000) { const m = Math.floor(num / 1000); resultado += (m === 1 ? 'MIL ' : numeroALetras(m) + ' MIL '); num %= 1000 }
  if (num >= 100) { resultado += (num === 100 ? 'CIEN ' : centenas[Math.floor(num / 100)] + ' '); num %= 100 }
  if (num >= 20) { resultado += decenas[Math.floor(num / 10)]; if (num % 10 > 0) resultado += ' Y ' + unidades[num % 10]; resultado += ' ' }
  else if (num > 0) resultado += unidades[num] + ' '
  return resultado.trim()
}

function generarRecibo(datos, pagos) {
  const fecha = new Date(datos.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const totalMonto = pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
  const entero = Math.floor(totalMonto)
  const centavos = Math.round((totalMonto - entero) * 100)
  const enLetras = numeroALetras(entero) + ' PESOS' + (centavos > 0 ? ' CON ' + numeroALetras(centavos) + ' CENTAVOS' : '') + '.-'

  const filasPago = pagos.map(p => {
    let desc = p.tipo === 'transferencia' ? 'TRANSFERENCIA' : p.tipo === 'efectivo' ? 'EFECTIVO' : p.tipo === 'cuenta_corriente' ? 'CUENTA CORRIENTE' : p.subtipo_cheque === 'propio' ? 'E-CHEQ PROPIO' : 'E-CHEQ TERCERO'
    if (p.es_paralelo) desc += ' (CAJA 2)'
    const nro = p.subtipo_cheque === 'propio' ? (p.cheque_propio?.numero || '') : ''
    const fechaCobro = p.subtipo_cheque === 'propio' && p.cheque_propio?.fecha_vencimiento ? new Date(p.cheque_propio.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR') : ''
    return `<tr><td style="padding:6px 8px;border-bottom:1px solid #ddd;">${desc}</td><td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:center;">${nro}</td><td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:center;">${fechaCobro}</td><td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:right;font-weight:600;">$ ${parseFloat(p.monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td></tr>`
  }).join('')

  const bloque = `<div style="border:1px solid #333;padding:20px;font-family:Arial,sans-serif;font-size:12px;width:100%;box-sizing:border-box;">
    <table style="width:100%;margin-bottom:10px;"><tr>
      <td style="width:33%;vertical-align:top;"><div style="font-weight:bold;">Pedro Barciocco 1221</div><div>TEL: 3574-442656</div><div style="margin-top:8px;border:1px solid #333;display:inline-block;padding:2px 6px;font-weight:bold;">X &nbsp; NO VALIDO COMO FACTURA</div><div style="font-size:11px;margin-top:2px;">Orden de pago</div></td>
      <td style="width:34%;text-align:center;vertical-align:middle;"><div style="font-size:22px;font-weight:900;">RAMONDA</div><div style="font-size:14px;font-weight:600;">HNOS S.A.</div></td>
      <td style="width:33%;text-align:right;vertical-align:top;"><div>CUIT: &nbsp;30-71682182-6</div><div>I.V.A. &nbsp;Responsable inscripto</div></td>
    </tr></table>
    <hr style="border:1px solid #333;margin:8px 0;">
    <table style="width:100%;border:1px solid #333;border-collapse:collapse;">
      <tr><td colspan="2" style="padding:4px 8px;font-weight:bold;background:#f5f5f5;">Entrego a:</td></tr>
      <tr><td style="padding:4px 8px;width:50%;">Nombre: <strong>${datos.proveedor || ''}</strong></td><td style="padding:4px 8px;">I.V.A.: ${datos.iva || ''}</td></tr>
      <tr><td style="padding:4px 8px;">Domicilio: ${datos.domicilio || ''}</td><td style="padding:4px 8px;">CUIT/DNI: ${datos.cuit || ''}</td></tr>
      <tr><td style="padding:4px 8px;">Localidad: ${datos.localidad || ''}</td><td style="padding:4px 8px;"></td></tr>
      <tr><td style="padding:4px 8px;">C.B.U: ${datos.cbu || ''}</td><td style="padding:4px 8px;">FECHA &nbsp;<strong>${fecha}</strong></td></tr>
    </table>
    <table style="width:100%;border:1px solid #333;border-top:none;border-collapse:collapse;">
      <tr><td colspan="4" style="padding:4px 8px;font-weight:bold;background:#f5f5f5;border-bottom:1px solid #333;">Medio de pago</td></tr>
      <tr style="background:#eee;"><th style="padding:6px 8px;text-align:left;border-bottom:1px solid #333;font-size:11px;">DESCRIPCIÓN</th><th style="padding:6px 8px;text-align:center;border-bottom:1px solid #333;font-size:11px;">NRO/CHEQUE</th><th style="padding:6px 8px;text-align:center;border-bottom:1px solid #333;font-size:11px;">FECHA DE COBRO</th><th style="padding:6px 8px;text-align:right;border-bottom:1px solid #333;font-size:11px;">IMPORTE</th></tr>
      ${filasPago}
      <tr style="height:30px;"><td colspan="4"></td></tr>
      <tr style="border-top:1px solid #333;"><td colspan="3" style="padding:8px;text-align:right;font-weight:bold;">IMPORTE TOTAL A COBRAR &nbsp; $</td><td style="padding:8px;text-align:right;font-weight:bold;">${totalMonto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td></tr>
    </table>
    <table style="width:100%;border:1px solid #333;border-top:none;border-collapse:collapse;">
      <tr><td style="padding:4px 8px;font-weight:bold;border-bottom:1px solid #ddd;background:#f5f5f5;">Concepto:</td></tr>
      <tr><td style="padding:6px 8px;"><strong>Compra ${[datos.insumo_nombre, datos.insumo_tipo === 'sanitario' ? '(Sanitario)' : '(Alimentación)', datos.proveedor].filter(Boolean).join(' · ')}</strong><br>Observación: RAMONDA HNOS S.A. no se responsabiliza por el vencimiento de cheques/e-cheq de terceros.<br>Cantidad de pesos: &nbsp;${enLetras}</td></tr>
      <tr><td style="padding:20px 8px 30px 8px;">&nbsp;</td></tr>
      <tr><td style="padding:8px;"><table style="width:100%;"><tr><td style="width:40%;text-align:center;border-top:1px solid #333;">Firma</td><td style="width:20%;"></td><td style="width:40%;text-align:center;border-top:1px solid #333;">DNI</td></tr></table></td></tr>
    </table>
  </div>`

  const win = window.open('', '_blank')
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Recibo - ${datos.proveedor || 'Proveedor'}</title><style>@media print{body{margin:0;padding:10px;}.no-print{display:none;}.recibo{page-break-inside:avoid;}}body{font-family:Arial,sans-serif;background:#fff;}.recibo{margin-bottom:20px;}.corte{border-top:2px dashed #999;margin:16px 0;text-align:center;font-size:11px;color:#999;padding:4px 0;}</style></head><body><div style="text-align:right;margin-bottom:10px;" class="no-print"><button onclick="window.print()" style="padding:8px 20px;font-size:14px;cursor:pointer;background:#1A3D6B;color:#fff;border:none;border-radius:6px;">🖨️ Imprimir / Guardar PDF</button></div><div class="recibo">${bloque}</div><div class="corte">✂ &nbsp;&nbsp; CORTAR AQUÍ &nbsp;&nbsp; ✂</div><div class="recibo">${bloque}</div></body></html>`)
  win.document.close()
}

export default function Insumos({ usuario }) {
  const [tab, setTab] = useState('compras')
  const [compras, setCompras] = useState([])
  const [stockAlim, setStockAlim] = useState([])
  const [stockSan, setStockSan] = useState([])
  const [historialIngresosSan, setHistorialIngresosSan] = useState([])
  const [historialUsoSan, setHistorialUsoSan] = useState([])
  const [sinPrecio, setSinPrecio] = useState([])
  const [ingresosStock, setIngresosStock] = useState([])
  const [chequesCartera, setChequesCartera] = useState([])
  const [contactos, setContactos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [pagarAhora, setPagarAhora] = useState(true)
  const [pagarInline, setPagarInline] = useState(null)
  const [formPagoInline, setFormPagoInline] = useState({ fecha: hoyLocal(), tipo: 'transferencia', monto: '', precio_unitario: '', es_paralelo: false, pagos: [{ ...PAGO_INIT }], contacto_id: '' })
  const [seleccionadas, setSeleccionadas] = useState([])
  const [preciosGrupal, setPreciosGrupal] = useState({})
  const [modosGrupal, setModosGrupal] = useState({})
  const [facturasGrupal, setFacturasGrupal] = useState({})
  const [showPagosPend, setShowPagosPend] = useState(false)
  const [formPagoGrupal, setFormPagoGrupal] = useState({ fecha: hoyLocal(), pagos: [{ ...PAGO_INIT }], contacto_id: '' })
  const [guardandoPago, setGuardandoPago] = useState(false)
  const [form, setForm] = useState({
    fecha: hoyLocal(),
    tipo: 'alimentacion',
    insumo_id: '',
    insumo_nombre: '',
    cantidad: '',
    unidad: 'kg',
    precio_unitario: '',
    total: '',
    proveedor: '',
    domicilio: '', localidad: '', cuit: '', iva: '', cbu: '',
    numero_factura: '',
    observaciones: '',
    pagos: [{ ...PAGO_INIT }],
  })

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: c }, { data: sa }, { data: ss }, { data: hiSan }, { data: huSan }, { data: ip }, { data: is_ }, { data: ch }, { data: ct }, { data: cp }] = await Promise.all([
      // Esta pantalla es solo Alimentación + Sanidad — Agricultura (insumo_tipo
      // 'agro') tiene su propio flujo en Agricultura, aunque comparta la tabla.
      supabase.from('compras_insumos').select('*').neq('insumo_tipo', 'agro').order('fecha', { ascending: false }),
      supabase.from('stock_insumos').select('*').order('insumo'),
      supabase.from('stock_sanitario').select('*').order('producto'),
      supabase.from('compras_insumos').select('*').eq('insumo_tipo', 'sanitario').order('fecha', { ascending: false }).limit(10),
      supabase.from('eventos_sanitarios').select('*, corrales(numero)').order('creado_en', { ascending: false }).limit(10),
      supabase.from('ingresos_stock').select('*').is('precio_por_kg', null).is('estado_pago', null).is('proveedor', null).order('creado_en', { ascending: false }),
      supabase.from('ingresos_stock').select('*').order('creado_en', { ascending: false }).limit(200),
      supabase.from('cheques').select('*').eq('tipo', 'recibido').eq('estado', 'en_cartera').order('fecha_vencimiento', { ascending: true }),
      supabase.from('contactos').select('*').order('nombre'),
      supabase.from('compras_insumos').select('*').eq('estado_pago', 'pendiente').is('precio_unitario', null).neq('insumo_tipo', 'agro').order('fecha', { ascending: false }),
    ])
    setCompras(c || [])
    setStockAlim(sa || [])
    setStockSan(ss || [])
    setHistorialIngresosSan(hiSan || [])
    setHistorialUsoSan(huSan || [])
    setIngresosStock(is_ || [])
    setChequesCartera(ch || [])
    setContactos(ct || [])
    // Unificar pendientes: ingresos_stock sin precio + compras_insumos sin precio
    const comprasPend = (cp || []).map(x => ({
      id: `ci_${x.id}`,
      _compra_id: x.id,
      _source: 'compras_insumos',
      insumo_id: x.insumo_id,
      insumo_nombre: x.insumo_nombre,
      tipo: x.insumo_tipo,
      cantidad_kg: x.cantidad,
      unidad: x.unidad,
      proveedor: x.proveedor,
      localidad: x.localidad,
      cuit: x.cuit,
      iva: x.iva,
      cbu: x.cbu,
      numero_factura: x.numero_factura,
      creado_en: x.fecha,
    }))
    setSinPrecio([...(ip || []), ...comprasPend])
    setLoading(false)
  }


  const stockActual = form.tipo === 'alimentacion' ? stockAlim : stockSan

  async function guardar() {
    if (!form.insumo_id || !form.cantidad) {
      alert('Completá insumo y cantidad')
      return
    }
    // Si quiere pagar ahora, precio es obligatorio
    if (pagarAhora && !form.precio_unitario) {
      alert('Para pagar ahora necesitás ingresar el precio. Si no tenés la factura todavía, elegí "Dejar pendiente".')
      return
    }
    const cantidad = parseFloat(form.cantidad)
    const precioUnit = form.precio_unitario ? parseFloat(form.precio_unitario) : null
    const total = precioUnit ? (form.total ? parseFloat(form.total) : Math.round(cantidad * precioUnit)) : null
    const totalPagos = form.pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
    if (pagarAhora && total && Math.abs(total - totalPagos) > 0.5) {
      alert(`El total de pagos ($${totalPagos.toLocaleString('es-AR')}) no coincide con el monto ($${total.toLocaleString('es-AR')})`)
      return
    }
    setGuardando(true)

    let caja_oficial_id = null
    let caja_paralela_id = null
    const desc = `Compra ${form.insumo_nombre}${form.proveedor ? ` — ${form.proveedor}` : ''}`

    if (pagarAhora && total) for (const pago of form.pagos) {
      const monto = parseFloat(pago.monto) || 0
      if (!monto) continue
      if (pago.tipo === 'canje') continue  // canje: no toca caja, pero ya cuenta como pagado
      const formaPago = pago.subtipo_cheque ? 'e-cheq' : pago.tipo
      if (pago.es_paralelo) {
        const { data: cp, error: errCp } = await supabase.from('caja_paralela').insert({ fecha: form.fecha, tipo: 'egreso', descripcion: desc, monto }).select().single()
        if (errCp) { alert('Error al registrar en Caja 2: ' + errCp.message); setGuardando(false); return }
        if (!caja_paralela_id) caja_paralela_id = cp?.id || null
      } else {
        const { data: co, error: errCo } = await supabase.from('caja_oficial').insert({ fecha: form.fecha, tipo: 'egreso', categoria: 'Compra insumos', descripcion: desc, monto, forma_pago: formaPago }).select().single()
        if (errCo) { alert('Error al registrar en caja oficial: ' + errCo.message); setGuardando(false); return }
        if (!caja_oficial_id) caja_oficial_id = co?.id || null
      }
      if (!pago.es_paralelo && pago.subtipo_cheque === 'propio') {
        const { error: errCheq } = await supabase.from('cheques').insert({ tipo: 'emitido', numero: pago.cheque_propio.numero || null, banco: pago.cheque_propio.banco || null, fecha_cobro: form.fecha, fecha_vencimiento: pago.cheque_propio.fecha_vencimiento, monto, beneficiario: form.proveedor || null, estado: 'en_cartera', caja_oficial_id, registrado_por: usuario?.id })
        if (errCheq) { alert('Error al registrar el cheque: ' + errCheq.message); setGuardando(false); return }
      } else if (pago.subtipo_cheque === 'tercero' && pago.cheque_tercero_id) {
        const { error: errCheqT } = await supabase.from('cheques').update({ estado: 'depositado' }).eq('id', parseInt(pago.cheque_tercero_id))
        if (errCheqT) { alert('Error al actualizar el cheque: ' + errCheqT.message); setGuardando(false); return }
      }
    }

    const { error: errCompra } = await supabase.from('compras_insumos').insert({
      fecha: form.fecha, insumo_id: parseInt(form.insumo_id), insumo_tipo: form.tipo, insumo_nombre: form.insumo_nombre,
      cantidad, unidad: form.unidad, precio_unitario: precioUnit, total,
      proveedor: form.proveedor || null, domicilio: form.domicilio || null, localidad: form.localidad || null,
      cuit: form.cuit || null, iva: form.iva || null, cbu: form.cbu || null,
      numero_factura: form.numero_factura || null,
      forma_pago: pagarAhora && total ? form.pagos.map(p => p.subtipo_cheque || p.tipo).join('+') : null,
      es_paralelo: form.pagos.some(p => p.es_paralelo),
      pagos_detalle: pagarAhora && total ? form.pagos : null,
      observaciones: form.observaciones || null,
      registrado_por: usuario?.id, caja_oficial_id, caja_paralela_id,
      estado_pago: pagarAhora && total ? 'pagado' : 'pendiente',
    })
    if (errCompra) { alert((caja_oficial_id || caja_paralela_id ? 'El pago ya se registró en caja, pero hubo ' : 'Hubo ') + 'un error al guardar la compra: ' + errCompra.message); setGuardando(false); return }

    // Actualizar stock (siempre, tenga o no precio)
    if (form.tipo === 'alimentacion') {
      const item = stockAlim.find(s => s.id === parseInt(form.insumo_id))
      if (item) {
        const { error: errStock } = await supabase.from('stock_insumos').update({ cantidad_kg: (item.cantidad_kg || 0) + cantidad, ...(precioUnit ? { precio_referencia: precioUnit, precio_referencia_actualizado_en: new Date().toISOString() } : {}), actualizado_en: new Date().toISOString() }).eq('id', item.id)
        if (errStock) alert('La compra se guardó, pero no se pudo actualizar el stock: ' + errStock.message)
      }
    } else {
      const item = stockSan.find(s => s.id === parseInt(form.insumo_id))
      if (item) {
        const { error: errStock } = await supabase.from('stock_sanitario').update({ cantidad_ml: (item.cantidad_ml || 0) + cantidad, ...(precioUnit ? { precio_referencia: precioUnit, precio_referencia_actualizado_en: new Date().toISOString() } : {}), actualizado_en: new Date().toISOString() }).eq('id', item.id)
        if (errStock) alert('La compra se guardó, pero no se pudo actualizar el stock: ' + errStock.message)
      }
    }

    setShowForm(false)
    setPagarAhora(true)
    setForm({ fecha: hoyLocal(), tipo: 'alimentacion', insumo_id: '', insumo_nombre: '', cantidad: '', unidad: 'kg', precio_unitario: '', total: '', proveedor: '', domicilio: '', localidad: '', cuit: '', iva: '', cbu: '', numero_factura: '', observaciones: '', pagos: [{ ...PAGO_INIT }] })
    setGuardando(false)
    await cargar()
  }

  if (loading) return <Loader />

  const totalCompras = compras.reduce((s, c) => s + (c.total || 0), 0)

  const TABS = [
    { key: 'compras', label: 'Historial de compras' },
  ]

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: 20, fontWeight: 600 }}>Insumos</div>
      </div>


      {/* Nota: la sección de "completar remito" individual se unificó con la de
          "compras pendientes" de abajo — ahí ya se puede poner precio (y factura)
          por separado a cada ítem, y pagar varios juntos con un solo pago. */}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${S.border}`, marginBottom: '1.5rem' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '10px 20px', fontSize: 13, fontWeight: tab === t.key ? 600 : 500, cursor: 'pointer', color: tab === t.key ? S.accent : S.muted, background: 'transparent', border: 'none', borderBottom: tab === t.key ? `2px solid ${S.accent}` : '2px solid transparent', marginBottom: -1, fontFamily: "'IBM Plex Sans', sans-serif" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB HISTORIAL */}
      {tab === 'compras' && (
        <div>
          {/* Banner compras pendientes */}
          {(() => {
            const pendientes = compras.filter(c => c.estado_pago === 'pendiente')
            if (pendientes.length === 0) return null
            const totalSel = seleccionadas.reduce((s, id) => { const c = pendientes.find(x => x.id === id); return s + (c?.total || 0) }, 0)

            return (
              <div style={{ background: S.amberLight, border: '1px solid #EF9F27', borderRadius: 10, padding: '1.25rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: S.amber }}>
                    ⏳ {pendientes.length} compra{pendientes.length !== 1 ? 's' : ''} pendiente{pendientes.length !== 1 ? 's' : ''} · ${pendientes.reduce((s,c)=>s+(c.total||0),0).toLocaleString('es-AR')}
                  </div>
                  {seleccionadas.length > 0 && (
                    <button onClick={() => setShowPagosPend(!showPagosPend)}
                      style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                      💳 Pagar {seleccionadas.length} seleccionada{seleccionadas.length !== 1 ? 's' : ''} · ${totalSel.toLocaleString('es-AR')}
                    </button>
                  )}
                </div>
                <ChecklistComprasPendientes pendientes={pendientes} seleccionadas={seleccionadas} setSeleccionadas={setSeleccionadas}
                  precios={preciosGrupal} setPrecios={setPreciosGrupal} facturas={facturasGrupal} setFacturas={setFacturasGrupal} S={S} modos={modosGrupal} setModos={setModosGrupal} />
              </div>
            )
          })()}

          <div style={{ fontSize: 12, color: S.red, marginBottom: '1rem' }}>
            Total gastado: <strong style={{ fontFamily: 'monospace' }}>${totalCompras.toLocaleString('es-AR')}</strong>
          </div>

          {/* Formulario pago grupal */}
          {showPagosPend && seleccionadas.length > 0 && (() => {
            const montoItem = c => {
              if (c.total) return c.total
              if (!preciosGrupal[c.id]) return 0
              const valor = parseFloat(preciosGrupal[c.id])
              if (modosGrupal[c.id] === 'total') return Math.round(valor)
              if (!c.cantidad) return 0
              return Math.round(c.cantidad * valor)
            }
            const totalSel2 = seleccionadas.reduce((s, id) => { const c = compras.find(x => x.id === id); return s + (c ? montoItem(c) : 0) }, 0)
            const totalPagGrupal2 = formPagoGrupal.pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
            const inp = { width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: "'IBM Plex Sans', sans-serif", color: S.text }
            return (
              <div style={{ background: S.greenLight, border: `1px solid ${S.green}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: S.green, marginBottom: '1.25rem' }}>
                  💳 Pagar {seleccionadas.length} compra{seleccionadas.length !== 1 ? 's' : ''} · Total: ${totalSel2.toLocaleString('es-AR')}
                </div>

                {/* Contacto y Fecha */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 12, marginBottom: '1rem' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Contacto / Proveedor</div>
                    <select value={formPagoGrupal.contacto_id} onChange={e => setFormPagoGrupal({...formPagoGrupal, contacto_id: e.target.value})}
                      style={{ ...inp, border: `1px solid ${S.accent}` }}>
                      <option value="">— Sin contacto —</option>
                      {contactos.map(ct => <option key={ct.id} value={ct.id}>{ct.nombre}{ct.localidad ? ` (${ct.localidad})` : ''}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Fecha de pago</div>
                    <input type="date" value={formPagoGrupal.fecha} onChange={e => setFormPagoGrupal({...formPagoGrupal, fecha: e.target.value})} style={inp} />
                  </div>
                </div>

                {/* Formas de pago */}
                <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 8 }}>Formas de pago</div>
                <ListaPagos pagos={formPagoGrupal.pagos} onChangePagos={n => setFormPagoGrupal({...formPagoGrupal, pagos: n})} chequesCartera={chequesCartera} S={S} opcionesExtra={[{ value: 'credito', label: '🏦 Crédito (financiera/banco)' }]} />
                {formPagoGrupal.pagos.some(p => p.tipo === 'credito') && (
                  <div style={{ background: '#F0EAFB', border: '1px solid #9F8ED4', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                    <div style={{ fontSize: 12, color: '#3D1A6B', marginBottom: 8 }}>
                      El proveedor ya cobró (se lo pagó la financiera) — la deuda queda registrada en Créditos, y esta compra queda marcada como pagada.
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      <div><Label>Entidad (banco/financiera)</Label><input type="text" value={formPagoGrupal.credito_entidad || ''} onChange={e => setFormPagoGrupal({...formPagoGrupal, credito_entidad: e.target.value})} style={inputStyle} placeholder="ej. Banco Macro" /></div>
                      <div><Label>Cant. de cuotas</Label><input type="number" value={formPagoGrupal.credito_cuotas || '1'} onChange={e => setFormPagoGrupal({...formPagoGrupal, credito_cuotas: e.target.value})} style={inputStyle} /></div>
                      <div><Label>Vencimiento (1ra cuota)</Label><input type="date" value={formPagoGrupal.credito_vencimiento || ''} onChange={e => setFormPagoGrupal({...formPagoGrupal, credito_vencimiento: e.target.value})} style={inputStyle} /></div>
                    </div>
                  </div>
                )}

                {/* Resumen */}
                <div style={{ background: Math.abs(totalSel2 - totalPagGrupal2) < 0.5 || totalSel2 === 0 ? S.accentLight : S.amberLight, border: `1px solid ${Math.abs(totalSel2 - totalPagGrupal2) < 0.5 || totalSel2 === 0 ? S.accent : S.amber}`, borderRadius: 6, padding: '8px 12px', fontSize: 13, margin: '1rem 0' }}>
                  <span>Total seleccionado: <strong>${totalSel2.toLocaleString('es-AR')}</strong></span>
                  <span style={{ margin: '0 12px', color: S.muted }}>|</span>
                  <span>Total pagos: <strong>${totalPagGrupal2.toLocaleString('es-AR')}</strong></span>
                  {Math.abs(totalSel2 - totalPagGrupal2) >= 0.5 && totalSel2 > 0 && <span style={{ marginLeft: 12, color: S.amber, fontWeight: 600 }}>Diferencia: ${Math.abs(totalSel2 - totalPagGrupal2).toLocaleString('es-AR')}</span>}
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => { setShowPagosPend(false); setSeleccionadas([]) }}
                    style={{ padding: '8px 16px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={async () => {
                    if (seleccionadas.length === 0) { alert('Seleccioná al menos una compra'); return }
                    if (totalPagGrupal2 === 0) { alert('Ingresá el monto a pagar'); return }
                    if (totalSel2 > 0 && Math.abs(totalSel2 - totalPagGrupal2) > 0.5) { alert('El total de pagos no coincide con el total de las compras'); return }
                    setGuardandoPago(true)
                    const contactoNombre = contactos.find(x => String(x.id) === formPagoGrupal.contacto_id)?.nombre
                    const desc = `Pago insumos${contactoNombre ? ' — ' + contactoNombre : ''}`
                    const { error } = await pagarComprasPendientes(supabase, {
                      seleccionadas, pendientes: compras, precios: preciosGrupal, facturas: facturasGrupal, modos: modosGrupal,
                      pagos: formPagoGrupal.pagos, fecha: formPagoGrupal.fecha, descripcion: desc,
                      contactoId: formPagoGrupal.contacto_id, contactoNombre, registradoPor: usuario?.id,
                      creditoEntidad: formPagoGrupal.credito_entidad, creditoCuotas: formPagoGrupal.credito_cuotas, creditoVencimiento: formPagoGrupal.credito_vencimiento,
                      actualizarPrecioReferencia: async (c, precioFinal) => {
                        if (!c.insumo_id) return
                        const tabla = c.insumo_tipo === 'alimentacion' ? 'stock_insumos' : 'stock_sanitario'
                        await supabase.from(tabla).update({ precio_referencia: precioFinal, precio_referencia_actualizado_en: new Date().toISOString() }).eq('id', c.insumo_id)
                      },
                    })
                    if (error) { alert('Error al registrar el pago: ' + error.message); setGuardandoPago(false); return }
                    setSeleccionadas([])
                    setPreciosGrupal({})
                    setModosGrupal({})
                    setFacturasGrupal({})
                    setShowPagosPend(false)
                    setFormPagoGrupal({ fecha: hoyLocal(), pagos: [{ ...PAGO_INIT }], contacto_id: '', credito_entidad: '', credito_cuotas: '', credito_vencimiento: '' })
                    setGuardandoPago(false)
                    await cargar()
                  }} disabled={guardandoPago}
                    style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, background: S.green, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                    {guardandoPago ? 'Guardando...' : '✓ Confirmar pago'}
                  </button>
                </div>
              </div>
            )
          })()}

          <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 800 }}>
              <thead>
                <tr style={{ background: S.bg }}>
                  {['Fecha', 'Tipo', 'Insumo', 'Cantidad', '$/unidad', 'Total', 'Proveedor', 'Factura', 'Pago', 'Estado', ''].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 10, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compras.length === 0 && (
                  <tr><td colSpan={10} style={{ padding: '3rem', textAlign: 'center', color: S.hint }}>No hay compras registradas.</td></tr>
                )}
                {compras.map(c => (
                  <React.Fragment key={c.id}>
                  <tr style={{ borderBottom: `1px solid ${S.border}`, background: c.es_paralelo ? S.purpleLight : 'transparent' }}>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {c.fecha ? new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: c.insumo_tipo === 'alimentacion' ? S.greenLight : S.accentLight, color: c.insumo_tipo === 'alimentacion' ? S.green : S.accent }}>
                        {c.insumo_tipo === 'alimentacion' ? 'Alim.' : 'Sanit.'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{c.insumo_nombre}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{c.cantidad?.toLocaleString('es-AR')} {c.unidad}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: S.muted }}>${c.precio_unitario?.toLocaleString('es-AR')}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600, color: S.red }}>-${c.total?.toLocaleString('es-AR')}</td>
                    <td style={{ padding: '8px 12px', color: S.muted }}>{c.proveedor || '—'}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, color: S.muted }}>{c.numero_factura || '—'}</td>
                    <td style={{ padding: '8px 12px', fontSize: 11 }}>
                      {c.es_paralelo ? <span style={{ color: S.purple, fontWeight: 600 }}>Caja 2</span> : c.forma_pago}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      {c.estado_pago === 'pagado'
                        ? <span style={{ padding: '2px 8px', borderRadius: 4, background: S.greenLight, color: S.green, fontSize: 11, fontWeight: 600 }}>✓ Pagado</span>
                        : <span style={{ padding: '2px 8px', borderRadius: 4, background: S.amberLight, color: S.amber, fontSize: 11, fontWeight: 600 }}>⏳ Pendiente</span>}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {c.estado_pago === 'pagado'
                          ? <button onClick={() => generarRecibo({ ...c, fecha: c.fecha }, c.pagos_detalle || [{ tipo: c.forma_pago || 'transferencia', monto: c.total, es_paralelo: c.es_paralelo, subtipo_cheque: '', cheque_propio: { numero: '', banco: '', fecha_vencimiento: '' }, cheque_tercero_id: '' }])}
                              style={{ padding: '3px 8px', fontSize: 11, background: S.accentLight, border: `1px solid #85B7EB`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>
                              🖨️ Recibo
                            </button>
                          : <button onClick={() => { setPagarInline(pagarInline === c.id ? null : c.id); setFormPagoInline({ fecha: hoyLocal(), tipo: 'transferencia', monto: c.total ? String(c.total) : '', precio_unitario: c.precio_unitario ? String(c.precio_unitario) : '', numero_factura: c.numero_factura || '', proveedor: c.proveedor || '', cuit: c.cuit || '', iva: c.iva || '', cbu: c.cbu || '', es_paralelo: false, pagos: [{ ...PAGO_INIT, monto: c.total ? String(c.total) : '' }] }) }}
                              style={{ padding: '3px 8px', fontSize: 11, background: S.greenLight, border: `1px solid ${S.green}`, color: S.green, borderRadius: 5, cursor: 'pointer', fontWeight: 600 }}>
                              💳 Pagar
                            </button>
                        }
                        <button onClick={async () => {
                          if (!confirm('¿Eliminar esta compra? Se eliminará también de la caja.')) return
                          if (c.caja_oficial_id) await supabase.from('caja_oficial').delete().eq('id', c.caja_oficial_id)
                          if (c.caja_paralela_id) await supabase.from('caja_paralela').delete().eq('id', c.caja_paralela_id)
                          const tabla = c.insumo_tipo === 'alimentacion' ? 'stock_insumos' : 'stock_sanitario'
                          const cantCol = c.insumo_tipo === 'alimentacion' ? 'cantidad_kg' : 'cantidad_ml'
                          const { data: item } = await supabase.from(tabla).select('*').eq('id', c.insumo_id).single()
                          if (item) await supabase.from(tabla).update({ [cantCol]: Math.max(0, (item[cantCol] || 0) - (c.cantidad || 0)) }).eq('id', c.insumo_id)
                          await supabase.from('compras_insumos').delete().eq('id', c.id)
                          await cargar()
                        }} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                  {pagarInline === c.id && (
                    <tr>
                      <td colSpan={10} style={{ padding: '1.25rem', background: S.bg, borderBottom: `1px solid ${S.border}` }}>
                        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
                          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                            Pagar — {c.insumo_nombre}{c.proveedor ? ` · ${c.proveedor}` : ''}
                          </div>
                          <div style={{ fontSize: 12, color: S.muted, marginBottom: '1.25rem' }}>
                            {c.cantidad?.toLocaleString('es-AR')} {c.unidad || 'kg'} · Total: {c.total ? `$${c.total.toLocaleString('es-AR')}` : '—'}
                          </div>

                          {/* Contacto y Fecha */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 12, marginBottom: '1rem' }}>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Contacto / Proveedor</div>
                              <select value={formPagoInline.contacto_id} onChange={e => {
                                const ct = contactos.find(x => String(x.id) === e.target.value)
                                setFormPagoInline({...formPagoInline, contacto_id: e.target.value,
                                  proveedor: ct?.nombre || formPagoInline.proveedor,
                                  cuit: ct?.cuit || formPagoInline.cuit,
                                  cbu: ct?.cbu || formPagoInline.cbu,
                                  iva: ct?.iva || formPagoInline.iva,
                                })
                              }} style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.accent}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: "'IBM Plex Sans', sans-serif", color: S.text }}>
                                <option value="">— Sin contacto / ingresar manual —</option>
                                {contactos.map(ct => <option key={ct.id} value={ct.id}>{ct.nombre}{ct.localidad ? ` (${ct.localidad})` : ''}</option>)}
                              </select>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Fecha</div>
                              <input type="date" value={formPagoInline.fecha} onChange={e => setFormPagoInline({...formPagoInline, fecha: e.target.value})}
                                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: "'IBM Plex Sans', sans-serif", color: S.text }} />
                            </div>
                          </div>

                        {/* Datos de factura */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: '1rem' }}>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Precio $/{c.unidad || 'kg'} *</div>
                            <input type="number" value={formPagoInline.precio_unitario}
                              onChange={e => {
                                const precio = e.target.value
                                const total = precio && c.cantidad ? String(Math.round(parseFloat(precio) * c.cantidad)) : ''
                                const pagos = formPagoInline.pagos.map((p, i) => i === 0 ? {...p, monto: total || p.monto} : p)
                                setFormPagoInline({...formPagoInline, precio_unitario: precio, pagos})
                              }}
                              placeholder="ej. 1500"
                              style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.accent}`, borderRadius: 6, fontSize: 13, fontFamily: 'monospace', background: S.surface, boxSizing: 'border-box', color: S.text }} />
                            {formPagoInline.precio_unitario && c.cantidad && (
                              <div style={{ fontSize: 11, color: S.green, marginTop: 3 }}>
                                Total: ${Math.round(parseFloat(formPagoInline.precio_unitario) * c.cantidad).toLocaleString('es-AR')}
                              </div>
                            )}
                          </div>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>N° Factura</div>
                            <input type="text" value={formPagoInline.numero_factura}
                              onChange={e => setFormPagoInline({...formPagoInline, numero_factura: e.target.value})}
                              placeholder="0001-00012345"
                              style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, fontFamily: 'monospace', background: S.surface, boxSizing: 'border-box', color: S.text }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Proveedor</div>
                            <input type="text" value={formPagoInline.proveedor}
                              onChange={e => setFormPagoInline({...formPagoInline, proveedor: e.target.value})}
                              placeholder="ej. Cerealera Ramonda"
                              style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box', color: S.text }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>CUIT</div>
                            <input type="text" value={formPagoInline.cuit}
                              onChange={e => setFormPagoInline({...formPagoInline, cuit: e.target.value})}
                              placeholder="20-12345678-9"
                              style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box', color: S.text }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>IVA</div>
                            <input type="text" value={formPagoInline.iva}
                              onChange={e => setFormPagoInline({...formPagoInline, iva: e.target.value})}
                              placeholder="ej. Responsable Inscripto"
                              style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box', color: S.text }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>CBU</div>
                            <input type="text" value={formPagoInline.cbu}
                              onChange={e => setFormPagoInline({...formPagoInline, cbu: e.target.value})}
                              placeholder="ej. 0720..."
                              style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box', color: S.text }} />
                          </div>
                        </div>

                        {/* Formas de pago — igual a Gastos generales */}
                        <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 8 }}>Formas de pago</div>
                        <ListaPagos pagos={formPagoInline.pagos} onChangePagos={n => setFormPagoInline({...formPagoInline, pagos: n})} chequesCartera={chequesCartera} S={S} />


                          {/* Resumen — igual a Gastos */}
                          {(() => {
                            const totalPagos = formPagoInline.pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
                            const montoTotal = c.total || 0
                            const diferencia = montoTotal - totalPagos
                            return montoTotal > 0 ? (
                              <div style={{ background: Math.abs(diferencia) < 0.5 ? S.greenLight : S.amberLight, border: `1px solid ${Math.abs(diferencia) < 0.5 ? '#97C459' : '#EF9F27'}`, borderRadius: 6, padding: '8px 12px', fontSize: 13, marginBottom: '1rem' }}>
                                <span style={{ color: S.muted }}>Total gasto: <strong>${montoTotal.toLocaleString('es-AR')}</strong></span>
                                <span style={{ margin: '0 12px', color: S.muted }}>|</span>
                                <span style={{ color: S.muted }}>Total pagos: <strong>${totalPagos.toLocaleString('es-AR')}</strong></span>
                                {Math.abs(diferencia) >= 0.5 && <span style={{ marginLeft: 12, color: S.amber, fontWeight: 600 }}>Diferencia: ${Math.abs(diferencia).toLocaleString('es-AR')}</span>}
                              </div>
                            ) : null
                          })()}

                                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '1rem' }}>
                            <button onClick={() => setPagarInline(null)}
                              style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>
                              Cancelar
                            </button>
                            <button onClick={async () => {
                              const pagos = formPagoInline.pagos
                              const totalPagos = pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
                              if (!totalPagos) { alert('Ingresá el monto'); return }
                              const desc = `Pago compra ${c.insumo_nombre}${c.proveedor ? ` — ${c.proveedor}` : ''}`
                              let caja_oficial_id = null, caja_paralela_id = null
                              for (const pago of pagos) {
                                const monto = parseFloat(pago.monto) || 0
                                if (!monto) continue
                                if (pago.tipo === 'canje') continue  // canje: no toca caja, pero ya cuenta como pagado
                                const fp = pago.subtipo_cheque ? 'e-cheq' : pago.tipo
                                if (pago.es_paralelo) {
                                  const { data: cp } = await supabase.from('caja_paralela').insert({ fecha: formPagoInline.fecha, tipo: 'egreso', descripcion: desc, monto }).select().single()
                                  if (!caja_paralela_id) caja_paralela_id = cp?.id
                                } else {
                                  const { data: co } = await supabase.from('caja_oficial').insert({ fecha: formPagoInline.fecha, tipo: 'egreso', categoria: 'Compra insumos', descripcion: desc, monto, forma_pago: fp, contacto_id: formPagoInline.contacto_id ? parseInt(formPagoInline.contacto_id) : null }).select().single()
                                  if (!caja_oficial_id) caja_oficial_id = co?.id
                                }
                                if (pago.tipo === 'e-cheq' && pago.subtipo_cheque === 'tercero' && pago.cheque_tercero_ids?.length > 0) {
                                  for (const chId of pago.cheque_tercero_ids) {
                                    await supabase.from('cheques').update({ estado: 'depositado' }).eq('id', parseInt(chId))
                                  }
                                }
                                if (pago.subtipo_cheque === 'propio' && pago.cheque_propio?.fecha_vencimiento) {
                                  await supabase.from('cheques').insert({ tipo: 'emitido', numero: pago.cheque_propio.numero || null, banco: pago.cheque_propio.banco || null, fecha_cobro: formPagoInline.fecha, fecha_vencimiento: pago.cheque_propio.fecha_vencimiento, monto, estado: 'en_cartera', caja_oficial_id, registrado_por: usuario?.id })
                                }
                              }
                              const precioUnit = formPagoInline.precio_unitario ? parseFloat(formPagoInline.precio_unitario) : c.precio_unitario || (c.cantidad ? Math.round(totalPagos / c.cantidad * 100) / 100 : null)
                              const formaDesc = pagos.map(p => p.subtipo_cheque ? `e-cheq ${p.subtipo_cheque}` : p.tipo).join('+')
                              await supabase.from('compras_insumos').update({ estado_pago: 'pagado', total: totalPagos, precio_unitario: precioUnit, numero_factura: formPagoInline.numero_factura || null, proveedor: formPagoInline.proveedor || c.proveedor || null, cuit: formPagoInline.cuit || null, iva: formPagoInline.iva || null, cbu: formPagoInline.cbu || null, forma_pago: formaDesc, es_paralelo: pagos.some(p => p.es_paralelo), caja_oficial_id, caja_paralela_id, pagos_detalle: pagos, contacto_id: formPagoInline.contacto_id ? parseInt(formPagoInline.contacto_id) : null }).eq('id', c.id)
                              if (precioUnit) {
                                const tabla = c.insumo_tipo === 'sanitario' ? 'stock_sanitario' : 'stock_insumos'
                                await supabase.from(tabla).update({ precio_referencia: precioUnit, precio_referencia_actualizado_en: new Date().toISOString() }).eq('id', c.insumo_id)
                              }
                              setPagarInline(null)
                              await cargar()
                              generarRecibo({ ...c, fecha: formPagoInline.fecha, precio_unitario: precioUnit, total: totalPagos }, pagos)
                            }} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                              💾 Confirmar y emitir recibo
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB STOCK ALIMENTACION */}
      {tab === 'stock_alim' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Stock de alimentos</div>
            <button onClick={() => { setForm({...form, tipo: 'alimentacion', insumo_id: '', insumo_nombre: '', unidad: 'kg', precio_unitario: '', cantidad: '', proveedor: '', numero_factura: ''}); setShowForm(!showForm && form.tipo !== 'alimentacion' ? true : !showForm) }}
              style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
              + Registrar ingreso
            </button>
          </div>
        {showForm && form.tipo === 'alimentacion' && (
          <div style={{ background: S.surface, border: `1px solid ${S.accent}`, borderRadius: 10, padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: S.accent, marginBottom: '1rem' }}>Nuevo ingreso — Alimentación</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <Lbl>Insumo *</Lbl>
                <select value={form.insumo_id} onChange={e => {
                  const item = stockAlim.find(s => String(s.id) === e.target.value)
                  setForm({...form, insumo_id: e.target.value, insumo_nombre: item?.insumo || '', unidad: item?.unidad || 'kg'})
                }} style={inp}>
                  <option value="">— Seleccioná —</option>
                  {stockAlim.map(s => <option key={s.id} value={s.id}>{s.insumo}</option>)}
                </select>
              </div>
              <div>
                <Lbl>Cantidad *</Lbl>
                <input type="number" value={form.cantidad} onChange={e => setForm({...form, cantidad: e.target.value})} style={inpMono} />
              </div>
              <div>
                <Lbl>Proveedor</Lbl>
                <input type="text" value={form.proveedor} onChange={e => setForm({...form, proveedor: e.target.value})} style={inp} />
              </div>
              <div>
                <Lbl>N° Remito</Lbl>
                <input type="text" value={form.numero_factura} onChange={e => setForm({...form, numero_factura: e.target.value})} style={inp} />
              </div>
              <div>
                <Lbl>Fecha</Lbl>
                <input type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} style={inp} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => { setPagarAhora(false); guardar() }} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                {guardando ? 'Guardando...' : '💾 Registrar ingreso'}
              </button>
            </div>
          </div>
        )}
        <StockTable items={stockAlim} tipo="alimentacion" onCargar={cargar} ingresosStock={ingresosStock} />
        </div>
      )}

      {/* TAB STOCK SANITARIO */}
      {tab === 'stock_san' && (
        <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Stock sanitario</div>
          <button onClick={() => { setForm({...form, tipo: 'sanitario', insumo_id: '', insumo_nombre: '', unidad: 'ml'}); setShowForm(!showForm) }}
            style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
            + Registrar ingreso
          </button>
        </div>
        {showForm && form.tipo === 'sanitario' && (
          <div style={{ background: S.surface, border: `1px solid ${S.accent}`, borderRadius: 10, padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: S.accent, marginBottom: '1rem' }}>Nuevo ingreso — Sanitario</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <Lbl>Producto *</Lbl>
                <select value={form.insumo_id} onChange={e => {
                  const item = stockSan.find(s => String(s.id) === e.target.value)
                  setForm({...form, insumo_id: e.target.value, insumo_nombre: item?.producto || '', unidad: item?.unidad || 'ml'})
                }} style={inp}>
                  <option value="">— Seleccioná —</option>
                  {stockSan.map(s => <option key={s.id} value={s.id}>{s.producto} ({s.tipo})</option>)}
                </select>
              </div>
              <div>
                <Lbl>Cantidad *</Lbl>
                <input type="number" value={form.cantidad} onChange={e => setForm({...form, cantidad: e.target.value})} style={inpMono} />
              </div>
              <div>
                <Lbl>Unidad</Lbl>
                <select value={form.unidad} onChange={e => setForm({...form, unidad: e.target.value})} style={inp}>
                  {['ml', 'dosis', 'kg', 'comprimido', 'unidad'].map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <Lbl>Proveedor</Lbl>
                <input type="text" value={form.proveedor} onChange={e => setForm({...form, proveedor: e.target.value})} style={inp} />
              </div>
              <div>
                <Lbl>N° Remito</Lbl>
                <input type="text" value={form.numero_factura} onChange={e => setForm({...form, numero_factura: e.target.value})} style={inp} />
              </div>
              <div>
                <Lbl>Fecha</Lbl>
                <input type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} style={inp} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => { setPagarAhora(false); guardar() }} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                {guardando ? 'Guardando...' : '💾 Registrar ingreso'}
              </button>
            </div>
          </div>
        )}
        <StockTable items={stockSan} tipo="sanitario" onCargar={cargar} historialIngresos={historialIngresosSan} historialUso={historialUsoSan} />
        </div>
      )}
    </div>
  )
}

function StockTable({ items, tipo, onCargar, ingresosStock = [], historialIngresos = [], historialUso = [] }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nombre: '', tipo: 'Vacuna', lab: '', car: '', unidad: tipo === 'alimentacion' ? 'kg' : 'ml', minimo: '' })
  const [guardando, setGuardando] = useState(false)
  const [editandoIng, setEditandoIng] = useState(null) // id del ingreso en edición
  const [formIng, setFormIng] = useState({ cantidad_kg: '', precio_por_kg: '', proveedor: '' })

  async function guardarInsumo() {
    if (!form.nombre) { alert('Ingresá el nombre'); return }
    setGuardando(true)
    const { error } = tipo === 'alimentacion'
      ? await supabase.from('stock_insumos').insert({ insumo: form.nombre, unidad: form.unidad, cantidad_kg: 0, minimo_kg: parseFloat(form.minimo) || 0 })
      : await supabase.from('stock_sanitario').insert({ producto: form.nombre, tipo: form.tipo || 'Vacuna', laboratorio: form.lab || null, carencia_dias: parseInt(form.car) || 0, unidad: form.unidad, cantidad_ml: 0, minimo_stock: parseFloat(form.minimo) || 0, activo: true })
    if (error) { alert('Error al guardar el insumo: ' + error.message); setGuardando(false); return }
    setShowForm(false)
    setForm({ nombre: '', tipo: 'Vacuna', lab: '', car: '', unidad: tipo === 'alimentacion' ? 'kg' : 'ml', minimo: '' })
    setGuardando(false)
    await onCargar()
  }

  const cantCol = tipo === 'alimentacion' ? 'cantidad_kg' : 'cantidad_ml'
  const minCol = tipo === 'alimentacion' ? 'minimo_kg' : 'minimo_stock'
  const nombreCol = tipo === 'alimentacion' ? 'insumo' : 'producto'

  const S_local = typeof S !== 'undefined' ? S : {}

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Stock {tipo === 'alimentacion' ? 'alimentación' : 'sanitario'}</div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          + Agregar insumo
        </button>
      </div>

      {showForm && (
        <div style={{ background: S.accentLight, border: `1px solid ${S.accent}`, borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: tipo === 'alimentacion' ? '2fr 1fr 1fr' : '2fr 1fr 1fr 1fr', gap: '1rem', marginBottom: tipo === 'alimentacion' ? 0 : '1rem' }}>
            <div>
              <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Nombre *</div>
              <input type="text" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})}
                placeholder={tipo === 'alimentacion' ? 'ej. Pellet de soja' : 'ej. Ivermectina 1%, RE-8...'} style={inp} />
            </div>
            {tipo !== 'alimentacion' && (
              <div>
                <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Tipo *</div>
                <select value={form.tipo || 'Vacuna'} onChange={e => setForm({...form, tipo: e.target.value})} style={inp}>
                  {['Vacuna', 'Antibiotico', 'Antiparasitario', 'Vitamina', 'Antiinflamatorio', 'Otro'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            )}
            <div>
              <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Unidad</div>
              <select value={form.unidad} onChange={e => setForm({...form, unidad: e.target.value})} style={inp}>
                {tipo === 'alimentacion'
                  ? ['kg', 'tn', 'litros', 'unidades'].map(u => <option key={u}>{u}</option>)
                  : ['ml', 'dosis', 'kg', 'comprimido', 'unidad'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Stock mínimo</div>
              <input type="number" value={form.minimo} onChange={e => setForm({...form, minimo: e.target.value})} style={inp} placeholder="0" />
            </div>
          </div>
          {tipo !== 'alimentacion' && (
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: 0 }}>
              <div>
                <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Laboratorio</div>
                <input type="text" value={form.lab || ''} onChange={e => setForm({...form, lab: e.target.value})}
                  placeholder="ej. MSD Animal Health, Holliday-Scott..." style={inp} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Carencia (días)</div>
                <input type="number" value={form.car || ''} onChange={e => setForm({...form, car: e.target.value})}
                  placeholder="0 = sin carencia" min="0" style={inp} />
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button onClick={() => setShowForm(false)}
              style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={guardarInsumo} disabled={guardando}
              style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: S.bg }}>
              {['Insumo', 'Stock actual', 'Unidad', 'Precio ref.', 'Mínimo', 'Estado', ''].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 10, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>Sin insumos cargados.</td></tr>}
            {items.map(s => {
              const cant = s[cantCol] || 0
              const min = s[minCol] || 0
              const bajo = min > 0 && cant <= min
              const esEdit = editandoIng === s.id
              return (
                <>
                  <tr key={s.id} style={{ borderBottom: esEdit ? 'none' : `1px solid ${S.border}`, background: esEdit ? S.accentLight : bajo ? S.redLight : 'transparent' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{s[nombreCol]}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color: bajo ? S.red : S.green }}>{cant.toLocaleString('es-AR')}</td>
                    <td style={{ padding: '8px 12px', color: S.muted }}>{s.unidad || (tipo === 'alimentacion' ? 'kg' : 'ml')}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: S.muted }}>{s.precio_referencia ? `$${s.precio_referencia.toLocaleString('es-AR')}` : '—'}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, color: S.muted }}>{min > 0 ? min.toLocaleString('es-AR') : '—'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      {bajo ? <span style={{ padding: '2px 8px', borderRadius: 4, background: S.redLight, color: S.red, fontSize: 11, fontWeight: 600 }}>⚠ Stock bajo</span>
                        : <span style={{ padding: '2px 8px', borderRadius: 4, background: S.greenLight, color: S.green, fontSize: 11 }}>OK</span>}
                    </td>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => {
                          setEditandoIng(s.id)
                          setFormIng({ cantidad_kg: String(cant), precio_por_kg: String(s.precio_referencia || ''), proveedor: String(min) })
                        }} style={{ padding: '3px 8px', fontSize: 11, background: S.accentLight, border: `1px solid #85B7EB`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>
                          Editar
                        </button>
                        <button onClick={async () => {
                          if (!confirm(`¿Eliminar "${s[nombreCol]}"?`)) return
                          const tabla = tipo === 'alimentacion' ? 'stock_insumos' : 'stock_sanitario'
                          await supabase.from(tabla).delete().eq('id', s.id)
                          await onCargar()
                        }} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                  {esEdit && (
                    <tr key={`edit-${s.id}`} style={{ borderBottom: `1px solid ${S.border}`, background: S.accentLight }}>
                      <td colSpan={7} style={{ padding: '12px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto auto', gap: 8, alignItems: 'flex-end' }}>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Stock actual ({tipo === 'alimentacion' ? 'kg' : 'ml'})</div>
                            <input type="number" value={formIng.cantidad_kg} onChange={e => setFormIng({ ...formIng, cantidad_kg: e.target.value })}
                              style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 13, fontFamily: 'monospace', boxSizing: 'border-box' }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Precio ref. $/{tipo === 'alimentacion' ? 'kg' : 'ml'}</div>
                            <input type="number" value={formIng.precio_por_kg} onChange={e => setFormIng({ ...formIng, precio_por_kg: e.target.value })}
                              style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 13, fontFamily: 'monospace', boxSizing: 'border-box' }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Stock mínimo</div>
                            <input type="number" value={formIng.proveedor} onChange={e => setFormIng({ ...formIng, proveedor: e.target.value })}
                              style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 13, fontFamily: 'monospace', boxSizing: 'border-box' }} />
                          </div>
                          <button onClick={async () => {
                            const tabla = tipo === 'alimentacion' ? 'stock_insumos' : 'stock_sanitario'
                            const cantCol2 = tipo === 'alimentacion' ? 'cantidad_kg' : 'cantidad_ml'
                            const minCol2 = tipo === 'alimentacion' ? 'minimo_kg' : 'minimo_stock'
                            await supabase.from(tabla).update({
                              [cantCol2]: parseFloat(formIng.cantidad_kg) || 0,
                              precio_referencia: formIng.precio_por_kg ? parseFloat(formIng.precio_por_kg) : null,
                              precio_referencia_actualizado_en: formIng.precio_por_kg ? new Date().toISOString() : undefined,
                              [minCol2]: parseFloat(formIng.proveedor) || 0,
                              actualizado_en: new Date().toISOString(),
                            }).eq('id', s.id)
                            setEditandoIng(null)
                            await onCargar()
                          }} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            Guardar
                          </button>
                          <button onClick={() => setEditandoIng(null)}
                            style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            Cancelar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Historial de ingresos (solo alimentación) */}
      {tipo === 'alimentacion' && (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>
            Historial de ingresos de stock
          </div>
          {ingresosStock.length === 0
            ? <div style={{ fontSize: 13, color: S.hint }}>No hay ingresos registrados.</div>
            : (
              <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 650 }}>
                  <thead>
                    <tr style={{ background: S.bg }}>
                      {['Fecha', 'Insumo', 'Cantidad', 'Precio/kg', 'Total', 'Proveedor', 'Registrado por', ''].map((h, i) => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: i > 1 && i < 7 ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ingresosStock.map(ing => {
                      const esEditando = editandoIng === ing.id
                      return (
                        <>
                          <tr key={ing.id} style={{ borderBottom: esEditando ? 'none' : `1px solid ${S.border}`, background: esEditando ? S.accentLight : 'transparent' }}>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12, color: S.muted, whiteSpace: 'nowrap' }}>
                              {new Date(ing.creado_en).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                            </td>
                            <td style={{ padding: '9px 12px', fontWeight: 600 }}>{ing.insumo_nombre}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{ing.cantidad_kg?.toLocaleString('es-AR')} kg</td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                              {ing.precio_por_kg
                                ? `$${ing.precio_por_kg.toLocaleString('es-AR')}`
                                : <span style={{ color: S.amber, fontSize: 11, fontWeight: 600 }}>Pendiente</span>}
                            </td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                              {ing.total ? `$${ing.total.toLocaleString('es-AR', { maximumFractionDigits: 0 })}` : '—'}
                            </td>
                            <td style={{ padding: '9px 12px', fontSize: 12, color: S.muted }}>{ing.proveedor || '—'}</td>
                            <td style={{ padding: '9px 12px', fontSize: 12, color: S.muted }}>{ing.registrado_por || '—'}</td>
                            <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => {
                                  setEditandoIng(ing.id)
                                  setFormIng({ cantidad_kg: String(ing.cantidad_kg || ''), precio_por_kg: String(ing.precio_por_kg || ''), proveedor: ing.proveedor || '' })
                                }} style={{ padding: '3px 8px', fontSize: 11, background: S.accentLight, border: `1px solid #85B7EB`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>
                                  Editar
                                </button>
                                <button onClick={async () => {
                                  if (!confirm('¿Eliminar este ingreso? Se restará del stock.')) return
                                  // Restar del stock
                                  const item = items.find(s => s.id === ing.insumo_id)
                                  if (item && ing.cantidad_kg) {
                                    await supabase.from('stock_insumos').update({
                                      cantidad_kg: Math.max(0, (item.cantidad_kg || 0) - ing.cantidad_kg),
                                      actualizado_en: new Date().toISOString(),
                                    }).eq('id', item.id)
                                  }
                                  await supabase.from('ingresos_stock').delete().eq('id', ing.id)
                                  await onCargar()
                                }} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>
                                  Eliminar
                                </button>
                              </div>
                            </td>
                          </tr>
                          {esEditando && (
                            <tr key={`edit-${ing.id}`} style={{ borderBottom: `1px solid ${S.border}`, background: S.accentLight }}>
                              <td colSpan={8} style={{ padding: '12px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto auto', gap: 8, alignItems: 'flex-end' }}>
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Cantidad (kg)</div>
                                    <input type="number" value={formIng.cantidad_kg} onChange={e => setFormIng({ ...formIng, cantidad_kg: e.target.value })}
                                      style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 13, fontFamily: 'monospace', boxSizing: 'border-box' }} />
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Precio/kg ($)</div>
                                    <input type="number" value={formIng.precio_por_kg} onChange={e => setFormIng({ ...formIng, precio_por_kg: e.target.value })}
                                      style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 13, fontFamily: 'monospace', boxSizing: 'border-box' }} />
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Proveedor</div>
                                    <input type="text" value={formIng.proveedor} onChange={e => setFormIng({ ...formIng, proveedor: e.target.value })}
                                      style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 13, boxSizing: 'border-box' }} />
                                  </div>
                                  <button onClick={async () => {
                                    const nuevaCant = parseFloat(formIng.cantidad_kg) || ing.cantidad_kg
                                    const nuevoPrecio = formIng.precio_por_kg ? parseFloat(formIng.precio_por_kg) : ing.precio_por_kg
                                    const diffKg = nuevaCant - (ing.cantidad_kg || 0)
                                    // Actualizar ingresos_stock
                                    await supabase.from('ingresos_stock').update({
                                      cantidad_kg: nuevaCant,
                                      precio_por_kg: nuevoPrecio || null,
                                      total: nuevoPrecio ? Math.round(nuevaCant * nuevoPrecio) : null,
                                      proveedor: formIng.proveedor || null,
                                    }).eq('id', ing.id)
                                    // Ajustar stock si cambió la cantidad
                                    if (diffKg !== 0) {
                                      const item = items.find(s => s.id === ing.insumo_id)
                                      if (item) {
                                        await supabase.from('stock_insumos').update({
                                          cantidad_kg: Math.max(0, (item.cantidad_kg || 0) + diffKg),
                                          actualizado_en: new Date().toISOString(),
                                        }).eq('id', item.id)
                                      }
                                    }
                                    setEditandoIng(null)
                                    await onCargar()
                                  }} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                    Guardar
                                  </button>
                                  <button onClick={() => setEditandoIng(null)}
                                    style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                    Cancelar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          }
        </div>
      )}

      {/* Historiales — solo para sanitario */}
      {tipo === 'sanitario' && (
        <div style={{ marginTop: '2rem' }}>
          {historialIngresos.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: '.75rem' }}>Últimos ingresos</div>
              <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: S.bg }}>
                      {['Fecha', 'Producto', 'Cantidad', 'Precio', 'Total', 'Proveedor', 'Estado'].map(h => (
                        <th key={h} style={{ padding: '7px 12px', fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, textAlign: 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historialIngresos.map(ing => (
                      <tr key={ing.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: S.muted, whiteSpace: 'nowrap' }}>{ing.fecha ? new Date(ing.fecha+'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{ing.insumo_nombre}</td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{ing.cantidad?.toLocaleString('es-AR')} {ing.unidad || 'ml'}</td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{ing.precio_unitario ? `$${ing.precio_unitario.toLocaleString('es-AR')}` : <span style={{ color: S.amber, fontSize: 11 }}>Pendiente</span>}</td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{ing.total ? `$${ing.total.toLocaleString('es-AR', { maximumFractionDigits: 0 })}` : '—'}</td>
                        <td style={{ padding: '8px 12px', color: S.muted }}>{ing.proveedor || '—'}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: ing.estado_pago === 'pagado' ? S.greenLight : S.amberLight, color: ing.estado_pago === 'pagado' ? S.green : S.amber }}>
                            {ing.estado_pago === 'pagado' ? '✓ Pagado' : '⏳ Pendiente'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {historialUso.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: '.75rem' }}>Últimos usos</div>
              <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: S.bg }}>
                      {['Fecha', 'Producto', 'Cantidad', 'Animales', 'Corral', 'Tipo', 'Observación'].map(h => (
                        <th key={h} style={{ padding: '7px 12px', fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, textAlign: 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historialUso.map(ev => (
                      <tr key={ev.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: S.muted, whiteSpace: 'nowrap' }}>{ev.creado_en ? new Date(ev.creado_en).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{ev.producto || '—'}</td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{ev.cantidad_ml?.toLocaleString('es-AR')} ml</td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{ev.cantidad_animales?.toLocaleString('es-AR') || '—'}</td>
                        <td style={{ padding: '8px 12px' }}>{ev.corrales?.numero ? `C-${ev.corrales.numero}` : '—'}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: S.accentLight, color: S.accent }}>
                            {ev.tipo === 'vacunacion' ? '💉 Vacunación' : ev.tipo === 'tratamiento' ? '🩺 Tratamiento' : ev.tipo || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', color: S.muted, fontSize: 11 }}>{ev.observaciones || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

