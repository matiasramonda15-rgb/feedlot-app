import React, { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { hoyLocal, fechaLocal } from '../shared/dateUtils'
import { Loader } from './UI'
import { PAGO_INIT, ListaPagos } from './PagoFormulario'
import { generarOrdenDePago } from '../shared/reciboLogic'
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


async function generarRecibo(datos, pagos) {
  await generarOrdenDePago(supabase, {
    destinatario: datos.proveedor,
    domicilio: datos.domicilio,
    localidad: datos.localidad,
    cuit: datos.cuit,
    iva: datos.iva,
    cbu: datos.cbu,
    fecha: datos.fecha,
    concepto: `${datos.insumo_nombre || 'Insumo'} · ${(datos.cantidad || 0).toLocaleString('es-AR')} ${datos.unidad || ''}${datos.proveedor ? ' · ' + datos.proveedor : ''}`,
    pagos,
  })
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
  const [guardandoPagoInline, setGuardandoPagoInline] = useState(false)
  const [retirandoId, setRetirandoId] = useState(null)
  const [cantidadRetiro, setCantidadRetiro] = useState('')
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
    es_paralelo: false,
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
    // Una cantidad muy grande de una sola vez suele ser un typo con algún
    // cero de más — no bloquea, solo pide confirmar antes de seguir.
    if (cantidad > 500000 && !confirm(`${cantidad.toLocaleString('es-AR')} ${form.unidad} es una cantidad muy grande para un solo ingreso — ¿es correcto, o se pasó algún cero de más?`)) return
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
      const formaPago = pago.tipo
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
        const { error: errCheq } = await supabase.from('cheques').insert({ tipo: 'emitido', numero: pago.cheque_propio.numero || null, banco: pago.cheque_propio.banco || null, fecha_cobro: form.fecha, fecha_vencimiento: pago.cheque_propio.fecha_vencimiento, monto, beneficiario: form.proveedor || null, estado: 'entregado', caja_oficial_id, registrado_por: usuario?.id })
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
      // Si se eligió "Caja 2" al cargar la compra (aunque todavía no se
      // pague), se respeta esa elección — antes esto solo se definía recién
      // al pagar, así que una compra pendiente siempre quedaba en Caja 1
      // por defecto, aunque en realidad correspondiera a la otra caja.
      es_paralelo: form.es_paralelo || form.pagos.some(p => p.es_paralelo),
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
          {/* Banner compras pendientes — separado en dos: las que todavía no
              tienen precio (hay que definirlo antes de poder pagarlas) y las
              que ya tienen precio pero siguen sin pagarse del todo. */}
          {(() => {
            const sinPrecioLista = compras.filter(c => c.estado_pago === 'pendiente' && !c.total && !c.precio_unitario)
            const conPrecioLista = compras.filter(c => c.estado_pago === 'pendiente' && (c.total || c.precio_unitario))
            const pendientes = [...sinPrecioLista, ...conPrecioLista]
            if (pendientes.length === 0) return null
            const totalSel = seleccionadas.reduce((s, id) => {
              const c = pendientes.find(x => x.id === id)
              if (!c) return s
              if (c.total) return s + c.total
              if (!preciosGrupal[id]) return s
              const valor = parseFloat(preciosGrupal[id])
              return s + (modosGrupal[id] === 'total' ? Math.round(valor) : Math.round((c.cantidad || 0) * valor))
            }, 0)

            return (<>
              {sinPrecioLista.length > 0 && (
                <div style={{ background: S.amberLight, border: '1px solid #EF9F27', borderRadius: 10, padding: '1.25rem', marginBottom: '1rem' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: S.amber, marginBottom: '1rem' }}>
                    🏷️ {sinPrecioLista.length} compra{sinPrecioLista.length !== 1 ? 's' : ''} sin precio todavía — hay que definirlo antes de poder pagarlas
                  </div>
                  <ChecklistComprasPendientes pendientes={sinPrecioLista} seleccionadas={seleccionadas} setSeleccionadas={setSeleccionadas}
                    precios={preciosGrupal} setPrecios={setPreciosGrupal} facturas={facturasGrupal} setFacturas={setFacturasGrupal} S={S} modos={modosGrupal} setModos={setModosGrupal} />
                </div>
              )}
              {conPrecioLista.length > 0 && (
                <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: S.text }}>
                      ⏳ {conPrecioLista.length} compra{conPrecioLista.length !== 1 ? 's' : ''} pendiente{conPrecioLista.length !== 1 ? 's' : ''} de pago · ${conPrecioLista.reduce((s,c)=>s+(c.total||0),0).toLocaleString('es-AR')}
                    </div>
                  </div>
                  <ChecklistComprasPendientes pendientes={conPrecioLista} seleccionadas={seleccionadas} setSeleccionadas={setSeleccionadas}
                    precios={preciosGrupal} setPrecios={setPreciosGrupal} facturas={facturasGrupal} setFacturas={setFacturasGrupal} S={S} modos={modosGrupal} setModos={setModosGrupal} />
                </div>
              )}
              {seleccionadas.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.25rem' }}>
                  <button onClick={() => {
                    const nuevoShow = !showPagosPend
                    if (nuevoShow && !formPagoGrupal.contacto_id) {
                      // Si todas las compras marcadas son del mismo proveedor, se
                      // precarga solo — no tiene sentido volver a preguntarlo si
                      // ya está clarísimo de quién es la deuda.
                      const proveedores = [...new Set(seleccionadas.map(id => pendientes.find(x => x.id === id)?.proveedor).filter(Boolean))]
                      if (proveedores.length === 1) {
                        const contacto = contactos.find(c => c.nombre === proveedores[0])
                        if (contacto) setFormPagoGrupal({...formPagoGrupal, contacto_id: String(contacto.id)})
                      }
                    }
                    setShowPagosPend(nuevoShow)
                  }}
                    style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                    💳 {showPagosPend ? 'Ocultar' : 'Continuar con'} {seleccionadas.length} seleccionada{seleccionadas.length !== 1 ? 's' : ''}{totalSel > 0 ? ` · $${totalSel.toLocaleString('es-AR')}` : ''}
                  </button>
                </div>
              )}
            </>)
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
                <div style={{ background: totalPagGrupal2 - totalSel2 > 0.5 || totalSel2 === 0 ? S.amberLight : S.accentLight, border: `1px solid ${totalPagGrupal2 - totalSel2 > 0.5 || totalSel2 === 0 ? S.amber : S.accent}`, borderRadius: 6, padding: '8px 12px', fontSize: 13, margin: '1rem 0' }}>
                  <span>Total seleccionado: <strong>${totalSel2.toLocaleString('es-AR')}</strong></span>
                  <span style={{ margin: '0 12px', color: S.muted }}>|</span>
                  <span>Total pagos: <strong>${totalPagGrupal2.toLocaleString('es-AR')}</strong></span>
                  {totalSel2 - totalPagGrupal2 > 0.5 && totalSel2 > 0 && <span style={{ marginLeft: 12, color: S.muted }}>Queda pendiente: ${(totalSel2 - totalPagGrupal2).toLocaleString('es-AR')}</span>}
                  {totalPagGrupal2 - totalSel2 > 0.5 && <span style={{ marginLeft: 12, color: S.amber, fontWeight: 600 }}>Excede el total por: ${(totalPagGrupal2 - totalSel2).toLocaleString('es-AR')}</span>}
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => { setShowPagosPend(false); setSeleccionadas([]); setFormPagoGrupal({...formPagoGrupal, contacto_id: ''}) }}
                    style={{ padding: '8px 16px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={async () => {
                    if (seleccionadas.length === 0) { alert('Seleccioná al menos una compra'); return }
                    // Se permite dejar el pago en $0 — sirve para fijar el precio de una
                    // compra sin sacar plata todavía (se paga después, de a poco). Se
                    // pide confirmar para que no sea sin querer.
                    if (totalPagGrupal2 === 0 && !confirm('No cargaste ningún pago — esto solo va a fijar el precio de la compra, dejándola pendiente por el total completo. ¿Es lo que querés?')) return
                    // Se permite pagar MENOS que el total (deja el resto pendiente, para
                    // pagar de a poco con el tiempo) — solo se bloquea si se carga de más.
                    if (totalSel2 > 0 && totalPagGrupal2 - totalSel2 > 0.5) { alert('El total de pagos es mayor que el total de las compras — revisá los montos.'); return }
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
                  {['Fecha', 'Tipo', 'Insumo', 'Cantidad', '$/unidad', 'Total', 'Proveedor', 'Factura', 'Pago', 'Estado', 'Retiro', ''].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 10, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compras.length === 0 && (
                  <tr><td colSpan={11} style={{ padding: '3rem', textAlign: 'center', color: S.hint }}>No hay compras registradas.</td></tr>
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
                    <td style={{ padding: '9px 12px' }}>
                      {c.retirado === false ? (
                        <button onClick={async () => {
                          const yaRetirado = c.cantidad_retirada || 0
                          const restante = (c.cantidad || 0) - yaRetirado
                          const respuesta = prompt(`¿Cuánto ${c.insumo_nombre || 'del insumo'} se retiró ahora?\n\nQueda pendiente: ${restante.toLocaleString('es-AR')} ${c.unidad || ''}\n\nEscribí la cantidad (podés retirar menos que el total, o todo):`, '')
                          if (respuesta === null) return // canceló el prompt
                          const cant = parseFloat(respuesta.replace(',', '.'))
                          if (!cant || cant <= 0) { alert('No se registró nada — hay que escribir un número mayor a 0.'); return }
                          if (cant > restante + 0.01) { alert(`Solo queda ${restante.toLocaleString('es-AR')} ${c.unidad || ''} por retirar — no se puede retirar más de eso.`); return }
                          if (!confirm(`Confirmá: se van a sumar ${cant.toLocaleString('es-AR')} ${c.unidad || ''} de ${c.insumo_nombre || 'insumo'} al stock.\n\n¿Es correcto?`)) return
                          const listaStock = c.insumo_tipo === 'alimentacion' ? stockAlim : stockSan
                          const item = listaStock.find(s => s.id === c.insumo_id)
                          const tablaStock = c.insumo_tipo === 'alimentacion' ? 'stock_insumos' : 'stock_sanitario'
                          const colStock = c.insumo_tipo === 'alimentacion' ? 'cantidad_kg' : 'cantidad_ml'
                          if (item) await supabase.from(tablaStock).update({ [colStock]: (item[colStock] || 0) + cant, actualizado_en: new Date().toISOString() }).eq('id', item.id)
                          const nuevaCantidadRetirada = yaRetirado + cant
                          const completo = nuevaCantidadRetirada >= (c.cantidad || 0) - 0.01
                          await supabase.from('compras_insumos').update({ cantidad_retirada: nuevaCantidadRetirada, retirado: completo }).eq('id', c.id)
                          const hoyRetiro2 = new Date()
                          await supabase.from('retiros_insumos_log').insert({ compra_insumo_id: c.id, fecha: `${hoyRetiro2.getFullYear()}-${String(hoyRetiro2.getMonth()+1).padStart(2,'0')}-${String(hoyRetiro2.getDate()).padStart(2,'0')}`, cantidad: cant, registrado_por: usuario?.id })
                          await cargar()
                        }} style={{ padding: '3px 8px', fontSize: 11, background: '#F0EAFB', border: '1px solid #9F8ED4', color: '#3D1A6B', borderRadius: 5, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          📦 {(c.cantidad_retirada || 0) > 0 ? `${(c.cantidad_retirada || 0).toLocaleString('es-AR')}/${(c.cantidad || 0).toLocaleString('es-AR')}` : 'Registrar retiro'}
                        </button>
                      ) : <span style={{ color: S.hint, fontSize: 11 }}>—</span>}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {c.estado_pago === 'pagado'
                          ? <button onClick={() => generarRecibo({ ...c, fecha: c.fecha }, c.pagos_detalle || [{ tipo: c.forma_pago || 'transferencia', monto: c.total, es_paralelo: c.es_paralelo, subtipo_cheque: '', cheque_propio: { numero: '', banco: '', fecha_vencimiento: '' }, cheque_tercero_id: '' }])}
                              style={{ padding: '3px 8px', fontSize: 11, background: S.accentLight, border: `1px solid #85B7EB`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>
                              🖨️ Recibo
                            </button>
                          : <button onClick={() => {
                              setPagarInline(pagarInline === c.id ? null : c.id)
                              // Si la compra ya tiene proveedor cargado, se busca el contacto
                              // que coincide por nombre y se precarga solo — no tiene sentido
                              // volver a preguntarlo si ya está clarísimo de quién es la deuda.
                              const contactoMatch = c.proveedor ? contactos.find(ct => ct.nombre === c.proveedor) : null
                              setFormPagoInline({ fecha: hoyLocal(), tipo: 'transferencia', monto: c.total ? String(c.total) : '', precio_unitario: c.precio_unitario ? String(c.precio_unitario) : '', numero_factura: c.numero_factura || '', proveedor: c.proveedor || '', cuit: contactoMatch?.cuit || c.cuit || '', iva: contactoMatch?.iva || c.iva || '', cbu: contactoMatch?.cbu || c.cbu || '', contacto_id: contactoMatch ? String(contactoMatch.id) : '', es_paralelo: false, pagos: [{ ...PAGO_INIT, monto: c.total ? String(c.total) : '' }] })
                            }}
                              style={{ padding: '3px 8px', fontSize: 11, background: S.greenLight, border: `1px solid ${S.green}`, color: S.green, borderRadius: 5, cursor: 'pointer', fontWeight: 600 }}>
                              💳 Pagar
                            </button>
                        }
                        <button onClick={async () => {
                          if (!confirm('¿Eliminar esta compra? Se eliminará también de la caja y se revertirán los cheques usados.')) return
                          if (c.caja_oficial_id) {
                            await supabase.from('cheques').delete().eq('caja_oficial_id', c.caja_oficial_id).eq('tipo', 'emitido')
                            await supabase.from('caja_oficial').delete().eq('id', c.caja_oficial_id)
                          }
                          if (c.caja_paralela_id) await supabase.from('caja_paralela').delete().eq('id', c.caja_paralela_id)
                          for (const p of (c.pagos_detalle || [])) {
                            if (p.subtipo_cheque === 'tercero' && p.cheque_tercero_ids?.length > 0) {
                              for (const chId of p.cheque_tercero_ids) await supabase.from('cheques').update({ estado: 'en_cartera', beneficiario: null }).eq('id', parseInt(chId))
                            }
                          }
                          // Si esto vino de una venta interna todavía sin retirar (o retirada
                          // solo en parte), no hay que restar la cantidad completa del stock —
                          // solo lo que efectivamente se llegó a sumar con algún retiro.
                          const cantidadASacar = c.retirado === false ? (c.cantidad_retirada || 0) : (c.cantidad || 0)
                          if (cantidadASacar > 0) {
                            const tabla = c.insumo_tipo === 'alimentacion' ? 'stock_insumos' : 'stock_sanitario'
                            const cantCol = c.insumo_tipo === 'alimentacion' ? 'cantidad_kg' : 'cantidad_ml'
                            const { data: item } = await supabase.from(tabla).select('*').eq('id', c.insumo_id).single()
                            if (item) await supabase.from(tabla).update({ [cantCol]: Math.max(0, (item[cantCol] || 0) - cantidadASacar) }).eq('id', c.insumo_id)
                          }
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
                                <option value="">— Sin contacto —</option>
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
                            <div style={{ padding: '9px 12px', fontSize: 13, color: formPagoInline.proveedor ? S.text : S.hint }}>
                              {formPagoInline.proveedor || 'Elegí un contacto arriba'}
                            </div>
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
                              // Sin esto, un doble clic dispara todo el guardado dos veces y
                              // duplica cheques y movimientos de caja (nos pasó con un pago real).
                              if (guardandoPagoInline) return
                              const pagos = formPagoInline.pagos
                              const totalPagos = pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
                              if (!totalPagos) { alert('Ingresá el monto'); return }
                              setGuardandoPagoInline(true)
                              const desc = `Pago compra ${c.insumo_nombre}${c.proveedor ? ` — ${c.proveedor}` : ''}`
                              let caja_oficial_id = null, caja_paralela_id = null
                              for (const pago of pagos) {
                                const monto = parseFloat(pago.monto) || 0
                                if (!monto) continue
                                if (pago.tipo === 'canje') continue  // canje: no toca caja, pero ya cuenta como pagado
                                const fp = pago.tipo
                                if (pago.es_paralelo) {
                                  const { data: cp } = await supabase.from('caja_paralela').insert({ fecha: formPagoInline.fecha, tipo: 'egreso', descripcion: desc, monto }).select().single()
                                  if (!caja_paralela_id) caja_paralela_id = cp?.id
                                } else {
                                  const { data: co } = await supabase.from('caja_oficial').insert({ fecha: formPagoInline.fecha, tipo: 'egreso', categoria: 'Compra insumos', descripcion: desc, monto, forma_pago: fp, contacto_id: formPagoInline.contacto_id ? parseInt(formPagoInline.contacto_id) : null }).select().single()
                                  if (!caja_oficial_id) caja_oficial_id = co?.id
                                }
                                if (pago.tipo === 'e-cheq' && pago.subtipo_cheque === 'tercero' && pago.cheque_tercero_ids?.length > 0) {
                                  for (const chId of pago.cheque_tercero_ids) {
                                    await supabase.from('cheques').update({ estado: 'entregado', beneficiario: formPagoInline.proveedor || c.proveedor || null }).eq('id', parseInt(chId))
                                  }
                                }
                                if (pago.subtipo_cheque === 'propio' && pago.cheque_propio?.fecha_vencimiento) {
                                  const { error: eCheqInline } = await supabase.from('cheques').insert({ tipo: 'emitido', numero: pago.cheque_propio.numero || null, banco: pago.cheque_propio.banco || null, fecha_cobro: formPagoInline.fecha, fecha_vencimiento: pago.cheque_propio.fecha_vencimiento, monto, estado: 'entregado', caja_oficial_id, registrado_por: usuario?.id })
                                  if (eCheqInline) { alert(`El cheque N° ${pago.cheque_propio.numero || '(sin número)'} no se pudo guardar en la cartera (${eCheqInline.message}). El pago NO se terminó de confirmar — revisá e intentá de nuevo.`); setGuardandoPagoInline(false); return }
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
                              setGuardandoPagoInline(false)
                              await cargar()
                              generarRecibo({ ...c, fecha: formPagoInline.fecha, precio_unitario: precioUnit, total: totalPagos }, pagos)
                            }} disabled={guardandoPagoInline} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer', opacity: guardandoPagoInline ? 0.6 : 1 }}>
                              {guardandoPagoInline ? 'Guardando...' : '💾 Confirmar y emitir recibo'}
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
                <select value={form.proveedor} onChange={e => setForm({...form, proveedor: e.target.value})} style={inp}>
                  <option value="">— Seleccioná —</option>
                  {contactos.map(c => <option key={c.id} value={c.nombre}>{c.nombre}{c.cuit ? ` · ${c.cuit}` : ''}</option>)}
                </select>
                <div style={{ fontSize: 11, color: S.hint, marginTop: 3 }}>¿No aparece? Primero hay que cargarlo en Contactos.</div>
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
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13, color: S.text, cursor: 'pointer', width: 'fit-content' }}>
              <input type="checkbox" checked={form.es_paralelo} onChange={e => setForm({...form, es_paralelo: e.target.checked})} />
              Es Caja 2 — se ve en el resumen de cuenta del proveedor en la caja correcta, aunque todavía no se pague
            </label>
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
                <select value={form.proveedor} onChange={e => setForm({...form, proveedor: e.target.value})} style={inp}>
                  <option value="">— Seleccioná —</option>
                  {contactos.map(c => <option key={c.id} value={c.nombre}>{c.nombre}{c.cuit ? ` · ${c.cuit}` : ''}</option>)}
                </select>
                <div style={{ fontSize: 11, color: S.hint, marginTop: 3 }}>¿No aparece? Primero hay que cargarlo en Contactos.</div>
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
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13, color: S.text, cursor: 'pointer', width: 'fit-content' }}>
              <input type="checkbox" checked={form.es_paralelo} onChange={e => setForm({...form, es_paralelo: e.target.checked})} />
              Es Caja 2 — se ve en el resumen de cuenta del proveedor en la caja correcta, aunque todavía no se pague
            </label>
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
                                    <select value={formIng.proveedor} onChange={e => setFormIng({ ...formIng, proveedor: e.target.value })}
                                      style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 13, boxSizing: 'border-box' }}>
                                      <option value="">— Sin proveedor —</option>
                                      {contactos.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                                    </select>
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

