import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { hoyLocal, fechaLocal } from '../shared/dateUtils'
import { Loader } from './UI'
import { buscarOrigenesDeCaja, validarDeshacerOrigen, deshacerPagosDeOrigen, mensajeDeshacerPago, mensajeCajaBloqueada, mensajeErrorDeshacer } from '../shared/pagosLogic'

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

const CATEGORIAS_INGRESO = ['Cobro venta hacienda', 'Cobro venta grano', 'Cobro servicio', 'Crédito', 'Subsidio', 'Otro ingreso']
const CATEGORIAS_EGRESO = ['Compra hacienda', 'Insumos alimentación', 'Agroquímicos', 'Combustible', 'Sueldos y jornales', 'Alquileres', 'Reparaciones', 'Construcciones', 'Impuestos', 'Servicios', 'Honorarios', 'Veterinario', 'Flete', 'Otro egreso']
const FORMAS_PAGO = ['transferencia', 'cheque', 'e-cheq', 'efectivo', 'depósito']
const TIPOS_CONTACTO = ['comprador_hacienda', 'vendedor_hacienda', 'comprador_grano', 'servicio', 'otro']
const TIPO_LABEL = { comprador_hacienda: 'Comprador hacienda', vendedor_hacienda: 'Vendedor hacienda', comprador_grano: 'Comprador grano', servicio: 'Servicio', otro: 'Otro' }
const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const ESTADOS_CHEQUE = { en_cartera: { bg: '#FDF0E0', color: '#7A4500' }, entregado: { bg: '#F0EAFB', color: '#3D1A6B' }, depositado: { bg: '#E8EFF8', color: '#1A3D6B' }, cobrado: { bg: '#E8F4EB', color: '#1E5C2E' }, rechazado: { bg: '#FDF0F0', color: '#7A1A1A' }, anulado: { bg: '#F7F5F0', color: '#6B6760' } }
// Un cheque deja de ser relevante para avisos de vencimiento solo cuando
// llega a un estado FINAL — "entregado"/"depositado" todavía representan
// plata que va a entrar o salir en esa fecha.
const ESTADOS_FINALES_CHEQUE = ['cobrado', 'rechazado', 'anulado']

// Fechas de un cheque, iguales para recibidos y emitidos:
//  - Fecha de cobro: desde cuándo se puede cobrar/depositar.
//  - Vencimiento: 30 días después de la fecha de cobro (ya no se muestra en la
//    lista, pero se usa para archivar).
// Ojo: en los cheques EMITIDOS (propios) la fecha de cobro quedó guardada en
// el campo fecha_vencimiento (el formulario de pago la pide como "Fecha de
// pago (cuándo se cobra)"), y fecha_cobro guarda el día que se registró el
// pago. En los RECIBIDOS, fecha_cobro es la de cobro y fecha_vencimiento la de
// vencimiento. Estas dos funciones lo unifican.
const sumarDias = (iso, d) => { const f = new Date(iso + 'T12:00:00'); f.setDate(f.getDate() + d); return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}` }
const fechaCobroCheque = c => c.tipo === 'emitido'
  ? (c.fecha_vencimiento || c.fecha_cobro || null)
  : (c.fecha_cobro || (c.fecha_vencimiento ? sumarDias(c.fecha_vencimiento, -30) : null))
const fechaVtoCheque = c => {
  if (c.tipo === 'emitido') return c.fecha_vencimiento ? sumarDias(c.fecha_vencimiento, 30) : null
  return c.fecha_vencimiento || (c.fecha_cobro ? sumarDias(c.fecha_cobro, 30) : null)
}
const hoyISO = () => { const f = new Date(); return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}` }
const diasHasta = iso => Math.round((new Date(iso + 'T12:00:00') - new Date(hoyISO() + 'T12:00:00')) / 86400000)
// Un cheque que ya salió de la cartera (entregado, depositado, cobrado…) o
// uno propio, queda en la lista hasta su vencimiento; después se archiva.
// Los que siguen EN CARTERA nunca se archivan solos (si vencen ahí, hay que
// verlos).
const chequeArchivado = c => c.estado !== 'en_cartera' && !!fechaVtoCheque(c) && fechaVtoCheque(c) < hoyISO()
// Cheques propios (emitidos) que se van a cobrar de nuestra cuenta entre hoy y
// dentro de `dias` días.
const propioSeCobraEn = (c, dias) => c.tipo === 'emitido' && !ESTADOS_FINALES_CHEQUE.includes(c.estado) && !!fechaCobroCheque(c)
  && fechaCobroCheque(c) >= hoyISO() && fechaCobroCheque(c) <= sumarDias(hoyISO(), dias)

function TablaCheques({ items, filtro, setFiltro, filtroEstado, setFiltroEstado, cambiarEstadoCheque, eliminar }) {
    return (
      <div>
        <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['todos', 'recibidos', 'emitidos'].map(f => (
              <button key={f} onClick={() => setFiltro(f)}
                style={{ padding: '6px 14px', fontSize: 12, fontWeight: filtro === f ? 600 : 400, background: filtro === f ? S.accent : 'transparent', border: `1px solid ${filtro === f ? S.accent : S.border}`, color: filtro === f ? '#fff' : S.muted, borderRadius: 6, cursor: 'pointer' }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
            <div style={{ width: 1, background: S.border, margin: '0 4px' }} />
            {[['vigentes', 'Vigentes'], ['en_cartera', '📥 En cartera'], ['entregado', '📤 Entregados'], ['depositado', '🏦 Depositados'], ['cobrado', '✅ Cobrados'], ['archivados', '🗄 Archivados'], ['todos', 'Ver todos']].map(([f, l]) => (
              <button key={f} onClick={() => setFiltroEstado(f)}
                style={{ padding: '6px 12px', fontSize: 12, fontWeight: filtroEstado === f ? 600 : 400, background: filtroEstado === f ? S.purple : 'transparent', border: `1px solid ${filtroEstado === f ? S.purple : S.border}`, color: filtroEstado === f ? '#fff' : S.muted, borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {l}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: S.muted }}>{items.length} cheques</div>
        </div>
        {filtroEstado !== 'todos' && filtroEstado !== 'en_cartera' && (
          <div style={{ fontSize: 11, color: S.hint, marginTop: -8, marginBottom: 12 }}>
            {filtroEstado === 'archivados'
              ? 'Cheques que ya salieron de la cartera y pasaron su vencimiento (30 días después de la fecha de cobro).'
              : 'Los cheques que ya salieron de la cartera (entregados, depositados, cobrados) y los propios se archivan cuando vencen — tocá "🗄 Archivados" para verlos.'}
          </div>
        )}

        <Card>
          <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: S.bg }}>
                {['Tipo', 'Medio', 'N° Cheque', 'Banco', 'Monto', 'Emisión', 'Fecha cobro', 'Librador/Beneficiario', 'Estado', ''].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {items.length === 0 && <tr><td colSpan={10} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay cheques.</td></tr>}
                {items.map(c => {
                  const ec = ESTADOS_CHEQUE[c.estado] || ESTADOS_CHEQUE.en_cartera
                  const fCobro = fechaCobroCheque(c)
                  const fVto = fechaVtoCheque(c)
                  const dCobro = fCobro ? diasHasta(fCobro) : null
                  // Aviso: cheque propio que se cobra de nuestra cuenta en los próximos 7 días.
                  const urgente = propioSeCobraEn(c, 7)
                  // Recibido todavía en cartera: ya se puede depositar / ya venció.
                  const vencidoEnCartera = c.tipo === 'recibido' && c.estado === 'en_cartera' && fVto && fVto < hoyISO()
                  const alCobro = c.tipo === 'recibido' && c.estado === 'en_cartera' && fCobro && fCobro <= hoyISO() && !vencidoEnCartera
                  return (
                    <tr key={c.id} style={{ borderBottom: `1px solid ${S.border}`, background: urgente ? '#FFF5F5' : 'transparent' }}>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: c.tipo === 'recibido' ? S.greenLight : S.amberLight, color: c.tipo === 'recibido' ? S.green : S.amber }}>
                          {c.tipo === 'recibido' ? '📥 Recibido' : '📤 Emitido'}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: c.es_electronico ? S.purpleLight : S.bg, color: c.es_electronico ? S.purple : S.muted, border: c.es_electronico ? 'none' : `1px solid ${S.border}` }}>
                          {c.es_electronico === true ? '💻 E-cheq' : c.es_electronico === false ? '📄 Físico' : '— Sin dato'}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{c.numero || '—'}</td>
                      <td style={{ padding: '9px 12px', fontSize: 12, color: S.muted }}>{c.banco || '—'}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600 }}>${c.monto?.toLocaleString('es-AR')}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12, color: S.muted }}>{c.fecha_emision ? new Date(c.fecha_emision + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}</td>
                      <td title={fVto ? `Vence el ${new Date(fVto + 'T12:00:00').toLocaleDateString('es-AR')}` : ''}
                        style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12, fontWeight: (urgente || vencidoEnCartera) ? 700 : 400, color: (urgente || vencidoEnCartera) ? S.red : S.text, whiteSpace: 'nowrap' }}>
                        {fCobro ? new Date(fCobro + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
                        {urgente && <span style={{ fontSize: 10, marginLeft: 4 }}>({dCobro === 0 ? 'hoy' : `${dCobro}d`}) ⚠</span>}
                        {alCobro && <span style={{ fontSize: 10, marginLeft: 4, color: S.green, fontWeight: 600 }}>al cobro</span>}
                        {vencidoEnCartera && <span style={{ fontSize: 10, marginLeft: 4 }}>vencido</span>}
                      </td>
                      <td style={{ padding: '9px 12px', fontSize: 12 }}>
                        {c.librador && c.beneficiario ? `${c.librador} / ${c.beneficiario}` : (c.librador || c.beneficiario || '—')}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <select value={c.estado} onChange={e => cambiarEstadoCheque(c.id, e.target.value)}
                          style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, border: `1px solid ${ec.color}`, borderRadius: 5, background: ec.bg, color: ec.color, cursor: 'pointer' }}>
                          {Object.keys(ESTADOS_CHEQUE).map(e => <option key={e} value={e}>{e.replace('_', ' ')}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '9px 12px' }}><button onClick={() => eliminar('cheques', c.id)} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button></td>
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

export default function Comercial({ usuario }) {
  const [tab, setTab] = useState('caja_oficial')
  const [dolares, setDolares] = useState([])
  const [showFormDolar, setShowFormDolar] = useState(false)
  const [formDolar, setFormDolar] = useState({ fecha: hoyLocal(), tipo: 'ingreso', categoria: 'Compra de dólares', descripcion: '', monto_usd: '', tipo_cambio: '', monto_ars: '' })
  const [guardandoDolar, setGuardandoDolar] = useState(false)
  const [tcActual, setTcActual] = useState('')
  const [loading, setLoading] = useState(true)
  // Retenciones practicadas a proveedores (Ganancias, IIBB…): quedan "a
  // depositar" hasta que se paga el VEP; ahí salen de Caja 1 en un solo
  // movimiento (categoría "Retenciones depositadas", no es un gasto: la
  // retención ya forma parte del costo de la compra).
  const [retenciones, setRetenciones] = useState([])
  const [retSel, setRetSel] = useState([])
  const [fechaDepositoRet, setFechaDepositoRet] = useState(hoyLocal())
  const [verRetDepositadas, setVerRetDepositadas] = useState(false)
  const [guardandoRet, setGuardandoRet] = useState(false)
  const [cajaOficial, setCajaOficial] = useState([])
  const [cajaParalela, setCajaParalela] = useState([])
  const [cheques, setCheques] = useState([])
  const [ventasCta, setVentasCta] = useState([])
  const [lotesCta, setLotesCta] = useState([])
  const [filtroCuenta, setFiltroCuenta] = useState('')
  const [contactos, setContactos] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [filtroAnio, setFiltroAnio] = useState(String(new Date().getFullYear()))
  const [filtroMes, setFiltroMes] = useState('')
  // Por defecto solo se ven los movimientos de los últimos 30 días — el
  // resto queda "archivado" y se puede desplegar con su propio filtro por
  // año/mes para buscar algo más viejo, sin que la lista de todos los días
  // quede siempre larguísima.
  const [verArchivo, setVerArchivo] = useState(false)
  const [filtroCheque, setFiltroCheque] = useState('todos')
  const [filtroChequePar, setFiltroChequePar] = useState('todos')
  // Por defecto solo se ven los cheques "en cartera" — los ya entregados o
  // depositados quedan archivados, para no mezclarlos en la lista del día a
  // día. Se puede desplegar "Ver todos" para buscar uno viejo.
  const [filtroEstadoCheque, setFiltroEstadoCheque] = useState('vigentes')
  const [diasProyeccion, setDiasProyeccion] = useState(7)
  const [filtroEstadoChequePar, setFiltroEstadoChequePar] = useState('vigentes')
  const [showFormOf, setShowFormOf] = useState(false)
  const [showFormPar, setShowFormPar] = useState(false)
  const [showFormContacto, setShowFormContacto] = useState(false)

  const [formOf, setFormOf] = useState({ fecha: hoyLocal(), tipo: 'ingreso', categoria: 'Cobro venta hacienda', descripcion: '', monto: '', forma_pago: 'transferencia', comprobante: '', contacto_id: '', numero_cheque: '', fecha_vencimiento_cheque: '', banco_cheque: '', librador: '', beneficiario: '' })
  const [formPar, setFormPar] = useState({ fecha: hoyLocal(), tipo: 'ingreso', descripcion: '', monto: '', observaciones: '' })
  const [formContacto, setFormContacto] = useState({ nombre: '', tipo: 'comprador_hacienda', cuit: '', telefono: '', email: '', banco: '', cbu: '', observaciones: '' })

  useEffect(() => { cargar() }, [])

  async function cargar() {
    try {
    const [{ data: co }, { data: cp }, { data: ch }, { data: vt }, { data: lt }, { data: ct }, { data: dol }, { data: ret }] = await Promise.all([
      supabase.from('caja_oficial').select('*, contactos(nombre)').order('fecha', { ascending: false }),
      supabase.from('caja_paralela').select('*').order('fecha', { ascending: false }),
      supabase.from('cheques').select('*').order('fecha_vencimiento', { ascending: true }),
      supabase.from('ventas').select('*, corrales(numero), pagos_ventas(monto)').order('creado_en', { ascending: false }),
      supabase.from('lotes').select('*, pagos_compras(monto)').order('created_at', { ascending: false }),
      supabase.from('contactos').select('*').eq('activo', true).order('nombre'),
      supabase.from('caja_dolares').select('*').order('fecha', { ascending: false }),
      supabase.from('retenciones').select('*').order('fecha', { ascending: true }),
    ])
    setCajaOficial(co || [])
    setCajaParalela(cp || [])
    setCheques(ch || [])
    setVentasCta(vt || [])
    setLotesCta(lt || [])
    setContactos(ct || [])
    setDolares(dol || [])
    setRetenciones(ret || [])
    } catch(e) { console.error('CARGAR ERROR:', e.message, e.stack) }
    setLoading(false)
  }

  async function depositarRetenciones() {
    const sel = retenciones.filter(r => retSel.includes(r.id) && r.estado === 'a_depositar')
    if (sel.length === 0) { alert('Tildá las retenciones que pagaste con el VEP'); return }
    const total = Math.round(sel.reduce((s, r) => s + (parseFloat(r.monto) || 0), 0) * 100) / 100
    const impuestos = [...new Set(sel.map(r => r.impuesto))].join(' + ')
    const certs = sel.map(r => r.certificado || 's/n').join(', ')
    if (!confirm(`¿Registrar el depósito de ${sel.length} retención(es) de ${impuestos} por $${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}?\n\nSale de Caja 1 el ${new Date(fechaDepositoRet + 'T12:00:00').toLocaleDateString('es-AR')}.`)) return
    setGuardandoRet(true)
    const { data: mov, error } = await supabase.from('caja_oficial').insert({
      fecha: fechaDepositoRet, tipo: 'egreso', categoria: 'Retenciones depositadas',
      descripcion: `Depósito retenciones ${impuestos} — Cert. ${certs}`,
      monto: total, forma_pago: 'transferencia',
    }).select().single()
    if (error) { alert('No se pudo registrar el depósito en Caja 1: ' + error.message); setGuardandoRet(false); return }
    const { error: errUpd } = await supabase.from('retenciones')
      .update({ estado: 'depositada', fecha_deposito: fechaDepositoRet, caja_oficial_id: mov.id })
      .in('id', sel.map(r => r.id)).eq('estado', 'a_depositar')
    if (errUpd) {
      await supabase.from('caja_oficial').delete().eq('id', mov.id)
      alert('No se pudieron marcar las retenciones como depositadas: ' + errUpd.message + '\n\nNo se registró nada.')
      setGuardandoRet(false); return
    }
    setRetSel([]); setGuardandoRet(false)
    await cargar()
  }

  async function deshacerDepositoRetenciones(cajaId) {
    const grupo = retenciones.filter(r => r.caja_oficial_id === cajaId)
    if (!confirm(`¿Deshacer este depósito? Se elimina el egreso de Caja 1 y ${grupo.length} retención(es) vuelven a quedar "a depositar".`)) return
    setGuardandoRet(true)
    const { error } = await supabase.from('retenciones').update({ estado: 'a_depositar', fecha_deposito: null, caja_oficial_id: null }).eq('caja_oficial_id', cajaId)
    if (error) { alert('No se pudo deshacer: ' + error.message); setGuardandoRet(false); return }
    const { error: errCaja } = await supabase.from('caja_oficial').delete().eq('id', cajaId)
    if (errCaja) alert('Las retenciones volvieron a "a depositar", pero no se pudo borrar el egreso de Caja 1: ' + errCaja.message + '\n\nBorralo a mano desde Caja 1.')
    setGuardandoRet(false)
    await cargar()
  }

  async function guardarDolar() {
    if (!formDolar.monto_usd) { alert('Ingresá el monto en USD'); return }
    setGuardandoDolar(true)
    const tc = parseFloat(formDolar.tipo_cambio) || null
    const monto_ars = tc ? Math.round(parseFloat(formDolar.monto_usd) * tc) : (formDolar.monto_ars ? parseFloat(formDolar.monto_ars) : null)
    const desc = `${formDolar.categoria} · U$S ${parseFloat(formDolar.monto_usd).toLocaleString('es-AR')}${formDolar.descripcion ? ' · ' + formDolar.descripcion : ''}`

    // Registrar en Caja 2 para compras y ventas de USD
    let caja_paralela_id = null
    // Compra USD → egreso de pesos (sale plata para comprar dólares)
    // Venta USD → ingreso de pesos (entra plata al vender dólares)
    const CAJA_TIPO = {
      'Compra de dólares': 'egreso',
      'Venta de dólares': 'ingreso',
    }
    const tipoCaja = CAJA_TIPO[formDolar.categoria] || null
    if (tipoCaja && monto_ars) {
      const { data: cp } = await supabase.from('caja_paralela').insert({
        fecha: formDolar.fecha,
        tipo: tipoCaja,
        descripcion: desc,
        monto: monto_ars,
      }).select().single()
      caja_paralela_id = cp?.id
    } else if (tipoCaja && !monto_ars) {
      alert('⚠ Atención: no se ingresó tipo de cambio, por lo que no se registró movimiento en Caja 2. Podés registrarlo manualmente.')
    }

    const { error } = await supabase.from('caja_dolares').insert({
      fecha: formDolar.fecha,
      tipo: formDolar.tipo,
      categoria: formDolar.categoria,
      descripcion: formDolar.descripcion || null,
      monto_usd: parseFloat(formDolar.monto_usd),
      tipo_cambio: tc,
      monto_ars,
      caja_paralela_id,
      registrado_por: usuario?.id,
    })
    if (error) { alert('Error: ' + error.message); setGuardandoDolar(false); return }
    setShowFormDolar(false)
    setFormDolar({ fecha: hoyLocal(), tipo: 'ingreso', categoria: 'Compra de dólares', descripcion: '', monto_usd: '', tipo_cambio: '', monto_ars: '' })
    setGuardandoDolar(false)
    await cargar()
  }

  async function guardarCajaOf() {
    if (!formOf.monto) { alert('Ingresá el monto'); return }
    setGuardando(true)
    const { data: mov, error: errMov } = await supabase.from('caja_oficial').insert({
      fecha: formOf.fecha, tipo: formOf.tipo, categoria: formOf.categoria,
      descripcion: formOf.descripcion, monto: parseFloat(formOf.monto),
      forma_pago: formOf.forma_pago, comprobante: formOf.comprobante || null,
      contacto_id: formOf.contacto_id ? parseInt(formOf.contacto_id) : null,
      registrado_por: usuario?.id,
    }).select().single()
    if (errMov) { alert('Error al guardar el movimiento: ' + errMov.message); setGuardando(false); return }

    if (['cheque', 'e-cheq'].includes(formOf.forma_pago) && formOf.fecha_vencimiento_cheque) {
      const { error: errCheq } = await supabase.from('cheques').insert({
        tipo: formOf.tipo === 'ingreso' ? 'recibido' : 'emitido',
        numero: formOf.numero_cheque || null, banco: formOf.banco_cheque || null,
        monto: parseFloat(formOf.monto), fecha_emision: formOf.fecha,
        fecha_vencimiento: formOf.fecha_vencimiento_cheque,
        librador: formOf.tipo === 'ingreso' ? (formOf.librador || null) : null,
        beneficiario: formOf.tipo === 'egreso' ? (formOf.beneficiario || null) : null,
        estado: 'en_cartera', caja_oficial_id: mov?.id || null, registrado_por: usuario?.id,
        es_electronico: formOf.forma_pago === 'e-cheq',
      })
      if (errCheq) alert('El movimiento se guardó, pero no se pudo guardar el cheque: ' + errCheq.message)
    }
    await cargar()
    setShowFormOf(false)
    setFormOf({ fecha: hoyLocal(), tipo: 'ingreso', categoria: 'Cobro venta hacienda', descripcion: '', monto: '', forma_pago: 'transferencia', comprobante: '', contacto_id: '', numero_cheque: '', fecha_vencimiento_cheque: '', banco_cheque: '', librador: '', beneficiario: '' })
    setGuardando(false)
  }

  async function guardarCajaPar() {
    if (!formPar.monto || !formPar.descripcion) { alert('Completá descripción y monto'); return }
    setGuardando(true)
    const { error } = await supabase.from('caja_paralela').insert({ ...formPar, monto: parseFloat(formPar.monto), registrado_por: usuario?.id })
    if (error) { alert('Error al guardar: ' + error.message); setGuardando(false); return }
    await cargar()
    setShowFormPar(false)
    setFormPar({ fecha: hoyLocal(), tipo: 'ingreso', descripcion: '', monto: '', observaciones: '' })
    setGuardando(false)
  }

  async function guardarContacto() {
    if (!formContacto.nombre) { alert('Ingresá el nombre'); return }
    setGuardando(true)
    const { error } = await supabase.from('contactos').insert({ ...formContacto, activo: true })
    if (error) { alert('Error al guardar: ' + error.message); setGuardando(false); return }
    await cargar()
    setShowFormContacto(false)
    setFormContacto({ nombre: '', tipo: 'comprador_hacienda', cuit: '', telefono: '', email: '', banco: '', cbu: '', observaciones: '' })
    setGuardando(false)
  }

  async function cambiarEstadoCheque(id, estado) {
    const { error } = await supabase.from('cheques').update({ estado }).eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    await cargar()
  }

  async function eliminar(tabla, id) {
    let error = null
    if (tabla === 'caja_oficial' || tabla === 'caja_paralela') {
      // Una sola regla: al eliminar un movimiento de caja, el pago se deshace
      // completo y el registro de origen vuelve a quedar PENDIENTE. Si ese
      // módulo todavía no sabe deshacerse solo, no se elimina y se avisa.
      // (Antes se borraba a secas y el flete/gasto de origen seguía "pagado".)
      const orig = await buscarOrigenesDeCaja(supabase, tabla, id)
      if (orig.error) { alert('No se pudo verificar si este movimiento pertenece a otro registro: ' + orig.error.message); return }
      if (orig.otros.length > 0) { alert(mensajeCajaBloqueada(orig.otros)); return }
      if (orig.fletes.length + orig.gastos.length + (orig.personal || []).length > 0) {
        // Primero se verifica que se pueda deshacer, y recién después se pregunta.
        const val = await validarDeshacerOrigen(supabase, orig)
        if (!val.ok) { alert(val.motivo + '\n\nNo se cambió nada.'); return }
        if (!confirm(mensajeDeshacerPago(orig))) return
        const rev = await deshacerPagosDeOrigen(supabase, orig)
        if (rev.error) { alert(mensajeErrorDeshacer(rev)); await cargar(); return }
      } else if (!confirm('Eliminar este registro?')) return
    } else if (!confirm('Eliminar este registro?')) return
    if (tabla === 'cheques') {
      // Si tiene pago_venta_id, borrar el pago (cascade borra cheque y caja)
      const cheque = cheques.find(c => c.id === id)
      if (cheque?.pago_venta_id) {
        ;({ error } = await supabase.from('pagos_ventas').delete().eq('id', cheque.pago_venta_id))
      } else if (cheque?.pago_compra_id) {
        ;({ error } = await supabase.from('pagos_compras').delete().eq('id', cheque.pago_compra_id))
      } else {
        ;({ error } = await supabase.from('cheques').delete().eq('id', id))
      }
    } else {
      ;({ error } = await supabase.from(tabla).delete().eq('id', id))
    }
    if (error) { alert('Error al eliminar: ' + error.message); return }
    await cargar()
  }

  if (loading) return <Loader />

  const hace30dias = new Date(); hace30dias.setDate(hace30dias.getDate() - 30)
  const filtrar = arr => arr.filter(x => {
    const fecha = x.fecha || x.creado_en?.split('T')[0]
    if (!fecha) return true
    const d = new Date(fecha + 'T12:00:00')
    if (!verArchivo) return d >= hace30dias
    return d.getFullYear() === parseInt(filtroAnio) && (!filtroMes || d.getMonth() + 1 === parseInt(filtroMes))
  })

  const coF = filtrar(cajaOficial)
  const cpF = filtrar(cajaParalela)
  // El saldo real de cada caja tiene que ser SIEMPRE con el histórico
  // completo, sin importar el filtro de 30 días / archivo que se esté
  // usando para la tabla de movimientos — si no, "Saldo Caja 1" mostraría
  // solo el neto de los últimos 30 días, no la plata real que hay.
  const coIng = cajaOficial.filter(x => x.tipo === 'ingreso').reduce((s, x) => s + (x.monto || 0), 0)
  const coEg = cajaOficial.filter(x => x.tipo === 'egreso').reduce((s, x) => s + (x.monto || 0), 0)
  const cpIng = cajaParalela.filter(x => x.tipo === 'ingreso').reduce((s, x) => s + (x.monto || 0), 0)
  const cpEg = cajaParalela.filter(x => x.tipo === 'egreso').reduce((s, x) => s + (x.monto || 0), 0)

  const anios = [...new Set([...cajaOficial, ...cajaParalela].map(x => new Date(x.fecha + 'T12:00:00').getFullYear()))].sort((a, b) => b - a)
  if (!anios.includes(new Date().getFullYear())) anios.unshift(new Date().getFullYear())

  const chOficial = cheques.filter(c => !c.es_paralelo)
  const chParalelo = cheques.filter(c => c.es_paralelo)
  const chOficialRec = chOficial.filter(c => c.tipo === 'recibido')
  const chOficialEm = chOficial.filter(c => c.tipo === 'emitido')
  const chParaleloRec = chParalelo.filter(c => c.tipo === 'recibido')
  const chParaleloEm = chParalelo.filter(c => c.tipo === 'emitido')
  // Aviso: cheques PROPIOS que se cobran de nuestra cuenta en los próximos 7
  // días (por fecha de cobro). Es el número que aparece en las pestañas.
  const chCobro7Of = chOficialEm.filter(c => propioSeCobraEn(c, 7))
  const chCobro7Par = chParaleloEm.filter(c => propioSeCobraEn(c, 7))
  // Lista: "Vigentes" = todo lo que no está archivado; cada estado muestra
  // sus cheques no archivados; "Archivados" los que ya salieron de la
  // cartera y pasaron su vencimiento; "Ver todos" sin filtro.
  const pasaFiltroEstado = (c, f) => {
    if (f === 'todos') return true
    if (f === 'archivados') return chequeArchivado(c)
    if (chequeArchivado(c)) return false
    return f === 'vigentes' || c.estado === f
  }
  const ordenarPorCobro = arr => [...arr].sort((a, b) => (fechaCobroCheque(a) || '9999').localeCompare(fechaCobroCheque(b) || '9999'))
  const chFiltradosOf = ordenarPorCobro((filtroCheque === 'todos' ? chOficial : filtroCheque === 'recibidos' ? chOficialRec : chOficialEm)
    .filter(c => pasaFiltroEstado(c, filtroEstadoCheque)))
  const chFiltradosPar = ordenarPorCobro((filtroChequePar === 'todos' ? chParalelo : filtroChequePar === 'recibidos' ? chParaleloRec : chParaleloEm)
    .filter(c => pasaFiltroEstado(c, filtroEstadoChequePar)))

  const isChecque = ['cheque', 'e-cheq'].includes(formOf.forma_pago)

  const TABS = [
    { key: 'caja_oficial', label: 'Caja 1' },
    { key: 'caja_paralela', label: 'Caja 2' },
    { key: 'cheques_oficial', label: `Cheques Caja 1${chCobro7Of.length > 0 ? ` ⚠${chCobro7Of.length}` : ''}` },
    { key: 'cheques_paralelo', label: `Cheques Caja 2${chCobro7Par.length > 0 ? ` ⚠${chCobro7Par.length}` : ''}` },
    { key: 'dolares', label: '💵 Dólares' },
  ]

  const FiltrosPeriodo = () => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <button onClick={() => setVerArchivo(!verArchivo)}
        style={{ padding: '7px 12px', border: `1px solid ${verArchivo ? S.accent : S.border}`, borderRadius: 6, fontSize: 12, fontWeight: 600, background: verArchivo ? S.accentLight : S.surface, color: verArchivo ? S.accent : S.muted, cursor: 'pointer' }}>
        {verArchivo ? '📁 Viendo archivo — volver a últimos 30 días' : '📁 Ver archivo (movimientos más viejos)'}
      </button>
      {verArchivo && (
        <>
          <select value={filtroAnio} onChange={e => setFiltroAnio(e.target.value)} style={{ padding: '7px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface }}>
            {anios.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} style={{ padding: '7px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface }}>
            <option value="">Todos los meses</option>
            {MESES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </>
      )}
    </div>
  )

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 3 }}>Comercial</div>
      <div style={{ fontSize: 12, color: S.muted, fontFamily: 'monospace', marginBottom: '1.5rem' }}>Caja 1 · Caja 2 · cheques · contactos</div>

      {/* Tarjetas de arriba: saldo de cada caja y cheques en cartera (recibidos
          que todavía no se depositaron ni se entregaron) de cada caja y total.
          La tarjeta "Vencen en 7 días" se sacó: los vencimientos se van a
          reorganizar aparte. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: '1.25rem' }}>
        {(() => {
          const suma = arr => arr.reduce((s, c) => s + (parseFloat(c.monto) || 0), 0)
          const carteraOf = chOficialRec.filter(c => c.estado === 'en_cartera')
          const carteraPar = chParaleloRec.filter(c => c.estado === 'en_cartera')
          const fmtCant = n => `${n} cheque${n !== 1 ? 's' : ''}`
          return [
          { label: 'Saldo Caja 1', val: `$${((coIng - coEg) / 1000000).toFixed(1)}M`, sub: `+${(coIng/1000000).toFixed(1)}M / -${(coEg/1000000).toFixed(1)}M`, color: coIng - coEg >= 0 ? S.green : S.red },
          { label: 'Saldo Caja 2', val: `$${((cpIng - cpEg) / 1000000).toFixed(1)}M`, sub: `+${(cpIng/1000000).toFixed(1)}M / -${(cpEg/1000000).toFixed(1)}M`, color: cpIng - cpEg >= 0 ? S.green : S.red, purple: true },
          { label: 'Cheques Caja 1', val: `$${(suma(carteraOf) / 1000000).toFixed(1)}M`, sub: `${fmtCant(carteraOf.length)} en cartera · $${suma(carteraOf).toLocaleString('es-AR')}`, color: S.amber },
          { label: 'Cheques Caja 2', val: `$${(suma(carteraPar) / 1000000).toFixed(1)}M`, sub: `${fmtCant(carteraPar.length)} en cartera · $${suma(carteraPar).toLocaleString('es-AR')}`, color: S.amber, purple: true },
          { label: 'Cheques en cartera (total)', val: carteraOf.length + carteraPar.length, sub: `$${(suma(carteraOf) + suma(carteraPar)).toLocaleString('es-AR')}`, color: S.amber },
          // Disponibilidad: todo lo que hay, Caja 1 + Caja 2. Los cheques en
          // cartera YA están dentro del saldo de cada caja (cuando se recibe un
          // cheque se registra el ingreso en la caja), así que no se vuelven a
          // sumar: el detalle muestra cuánto es plata y cuánto es cheques.
          { label: 'Disponibilidad', val: `$${((coIng - coEg + cpIng - cpEg) / 1000000).toFixed(1)}M`, sub: `Plata $${((coIng - coEg + cpIng - cpEg - suma(carteraOf) - suma(carteraPar)) / 1000000).toFixed(1)}M · Cheques $${((suma(carteraOf) + suma(carteraPar)) / 1000000).toFixed(1)}M`, color: (coIng - coEg + cpIng - cpEg) >= 0 ? S.green : S.red, destacada: true },
          ]
        })().map((m, i) => (
          <div key={i} style={{ background: m.destacada ? S.greenLight : m.purple ? S.purpleLight : S.surface, border: `${m.destacada ? 2 : 1}px solid ${m.destacada ? S.green : m.purple ? '#9F8ED4' : S.border}`, borderRadius: 8, padding: '1rem' }}>
            <div style={{ fontSize: 11, color: m.purple ? S.purple : S.muted, textTransform: 'uppercase', marginBottom: 5, fontWeight: 600 }}>{m.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: m.color }}>{m.val}</div>
            <div style={{ fontSize: 11, color: m.purple ? S.purple : S.hint, marginTop: 3 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Proyección de fondos necesarios — cuánto tiene que haber en el banco
          para cubrir los cheques EMITIDOS (los que van a salir de la cuenta)
          que vencen dentro de la ventana de días elegida. */}
      {(() => {
        // Cheques propios que se cobran de nuestra cuenta en la ventana elegida
        // (por fecha de cobro, no por vencimiento).
        const enVentana = c => propioSeCobraEn(c, diasProyeccion)
        const emOfVentana = chOficialEm.filter(enVentana)
        const emParVentana = chParaleloEm.filter(enVentana)
        const totalOf = emOfVentana.reduce((s, c) => s + (parseFloat(c.monto) || 0), 0)
        const totalPar = emParVentana.reduce((s, c) => s + (parseFloat(c.monto) || 0), 0)
        return (
          <div style={{ background: (totalOf + totalPar) > 0 ? S.redLight : S.surface, border: `1px solid ${(totalOf + totalPar) > 0 ? '#F09595' : S.border}`, borderRadius: 8, padding: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: (totalOf + totalPar) > 0 ? S.red : S.text }}>{(totalOf + totalPar) > 0 ? '⚠' : '✓'} Cheques propios que se cobran — próximos {diasProyeccion} días</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {[7, 15, 30].map(d => (
                  <button key={d} onClick={() => setDiasProyeccion(d)}
                    style={{ padding: '5px 12px', fontSize: 12, fontWeight: diasProyeccion === d ? 600 : 400, background: diasProyeccion === d ? S.accent : 'transparent', border: `1px solid ${diasProyeccion === d ? S.accent : S.border}`, color: diasProyeccion === d ? '#fff' : S.muted, borderRadius: 6, cursor: 'pointer' }}>
                    {d} días
                  </button>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
                  <input type="number" min="1" value={diasProyeccion} onChange={e => setDiasProyeccion(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ width: 60, padding: '5px 8px', fontSize: 12, border: `1px solid ${S.border}`, borderRadius: 6, textAlign: 'center' }} />
                  <span style={{ fontSize: 12, color: S.muted }}>días</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase' }}>Caja 1</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: totalOf > 0 ? S.red : S.green }}>${totalOf.toLocaleString('es-AR')}</div>
                <div style={{ fontSize: 11, color: S.hint }}>{emOfVentana.length} cheque{emOfVentana.length !== 1 ? 's' : ''}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: S.purple, textTransform: 'uppercase' }}>Caja 2</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: totalPar > 0 ? S.red : S.green }}>${totalPar.toLocaleString('es-AR')}</div>
                <div style={{ fontSize: 11, color: S.hint }}>{emParVentana.length} cheque{emParVentana.length !== 1 ? 's' : ''}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase' }}>Total que sale de la cuenta</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: (totalOf + totalPar) > 0 ? S.red : S.green }}>${(totalOf + totalPar).toLocaleString('es-AR')}</div>
                <div style={{ fontSize: 11, color: S.hint }}>en los próximos {diasProyeccion} días</div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Retenciones a depositar — lo retenido a proveedores (ARCA/Rentas)
          que todavía no se pagó con el VEP. */}
      {(() => {
        const aDepositar = retenciones.filter(r => r.estado === 'a_depositar')
        const depositadas = retenciones.filter(r => r.estado === 'depositada')
        if (aDepositar.length === 0 && depositadas.length === 0) return null
        const totalPend = aDepositar.reduce((s, r) => s + (parseFloat(r.monto) || 0), 0)
        const totalSel = aDepositar.filter(r => retSel.includes(r.id)).reduce((s, r) => s + (parseFloat(r.monto) || 0), 0)
        const fmt = n => '$' + (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        const fmtF = f => f ? new Date(f + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'
        const th = { padding: '7px 10px', fontSize: 11, fontWeight: 600, color: S.muted, textAlign: 'left', textTransform: 'uppercase' }
        const td = { padding: '8px 10px', fontSize: 12, borderTop: `1px solid ${S.border}` }
        const depositos = [...new Set(depositadas.map(r => r.caja_oficial_id))].map(cid => {
          const rs = depositadas.filter(r => r.caja_oficial_id === cid)
          return { cid, fecha: rs[0]?.fecha_deposito, rs, total: rs.reduce((s, r) => s + (parseFloat(r.monto) || 0), 0) }
        }).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
        return (
          <div style={{ background: S.surface, border: `1px solid ${aDepositar.length ? S.amber : S.border}`, borderRadius: 8, padding: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: aDepositar.length ? 10 : 0 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>🧾 Retenciones a depositar</div>
                <div style={{ fontSize: 12, color: S.muted }}>
                  {aDepositar.length > 0 ? <>{aDepositar.length} pendiente{aDepositar.length !== 1 ? 's' : ''} · <b style={{ color: S.amber, fontFamily: 'monospace' }}>{fmt(totalPend)}</b></> : 'No hay retenciones pendientes'}
                </div>
              </div>
              {depositadas.length > 0 && (
                <button onClick={() => setVerRetDepositadas(!verRetDepositadas)}
                  style={{ padding: '5px 12px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>
                  {verRetDepositadas ? 'Ocultar depositadas' : `Ver depositadas (${depositos.length})`}
                </button>
              )}
            </div>
            {aDepositar.length > 0 && (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr>
                      <th style={th}><input type="checkbox" checked={aDepositar.every(r => retSel.includes(r.id))} onChange={e => setRetSel(e.target.checked ? aDepositar.map(r => r.id) : [])} /></th>
                      <th style={th}>Fecha</th><th style={th}>Proveedor</th><th style={th}>Impuesto</th><th style={th}>Certificado</th><th style={{ ...th, textAlign: 'right' }}>Monto</th>
                    </tr></thead>
                    <tbody>
                      {aDepositar.map(r => (
                        <tr key={r.id}>
                          <td style={td}><input type="checkbox" checked={retSel.includes(r.id)} onChange={e => setRetSel(e.target.checked ? [...retSel, r.id] : retSel.filter(x => x !== r.id))} /></td>
                          <td style={{ ...td, fontFamily: 'monospace' }}>{fmtF(r.fecha)}</td>
                          <td style={td}>{r.proveedor || '—'}</td>
                          <td style={td}>{r.impuesto}</td>
                          <td style={{ ...td, fontFamily: 'monospace' }}>{r.certificado || <span style={{ color: S.amber }}>sin N°</span>}</td>
                          <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{fmt(r.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                  <span style={{ fontSize: 12, color: S.muted }}>Fecha del VEP</span>
                  <input type="date" value={fechaDepositoRet} onChange={e => setFechaDepositoRet(e.target.value)}
                    style={{ padding: '5px 8px', fontSize: 12, border: `1px solid ${S.border}`, borderRadius: 6 }} />
                  <button onClick={depositarRetenciones} disabled={guardandoRet || retSel.length === 0}
                    style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: retSel.length ? S.accent : S.bg, border: 'none', color: retSel.length ? '#fff' : S.hint, borderRadius: 6, cursor: retSel.length ? 'pointer' : 'default' }}>
                    {guardandoRet ? 'Guardando...' : `Registrar depósito${totalSel ? ' · ' + fmt(totalSel) : ''} (sale de Caja 1)`}
                  </button>
                </div>
              </>
            )}
            {verRetDepositadas && depositos.length > 0 && (
              <div style={{ marginTop: 12, borderTop: `1px solid ${S.border}`, paddingTop: 10 }}>
                {depositos.map(d => (
                  <div key={d.cid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 12 }}>
                    <span>
                      <b style={{ fontFamily: 'monospace' }}>{fmtF(d.fecha)}</b> · {d.rs.map(r => `${r.proveedor || '—'} (${r.certificado || 's/n'})`).join(', ')}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <b style={{ fontFamily: 'monospace' }}>{fmt(d.total)}</b>
                      <button onClick={() => deshacerDepositoRetenciones(d.cid)} disabled={guardandoRet}
                        style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Deshacer</button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      <div style={{ display: 'flex', borderBottom: `1px solid ${S.border}`, marginBottom: '1.5rem' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '10px 20px', fontSize: 13, fontWeight: tab === t.key ? 600 : 500, cursor: 'pointer', color: tab === t.key ? S.accent : S.muted, background: 'transparent', border: 'none', borderBottom: tab === t.key ? `2px solid ${S.accent}` : '2px solid transparent', marginBottom: -1, fontFamily: "'IBM Plex Sans', sans-serif" }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'caja_oficial' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <FiltrosPeriodo />
            <button onClick={() => setShowFormOf(!showFormOf)} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>+ Movimiento</button>
          </div>

          {showFormOf && (
            <Card>
              <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: '1rem' }}>Nuevo movimiento</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div><Label>Tipo</Label>
                  <select value={formOf.tipo} onChange={e => setFormOf({...formOf, tipo: e.target.value, categoria: e.target.value === 'ingreso' ? 'Cobro venta hacienda' : 'Compra hacienda'})} style={inputStyle}>
                    <option value="ingreso">Ingreso</option>
                    <option value="egreso">Egreso</option>
                  </select>
                </div>
                <div><Label>Categoría</Label>
                  <select value={formOf.categoria} onChange={e => setFormOf({...formOf, categoria: e.target.value})} style={inputStyle}>
                    {(formOf.tipo === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO).map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div><Label>Fecha</Label><input type="date" value={formOf.fecha} onChange={e => setFormOf({...formOf, fecha: e.target.value})} style={inputStyle} /></div>
                <div><Label>Monto $</Label><input type="number" value={formOf.monto} onChange={e => setFormOf({...formOf, monto: e.target.value})} style={inputStyle} /></div>
                <div><Label>Forma de pago</Label>
                  <select value={formOf.forma_pago} onChange={e => setFormOf({...formOf, forma_pago: e.target.value})} style={inputStyle}>
                    {FORMAS_PAGO.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div><Label>Contacto</Label>
                  <select value={formOf.contacto_id} onChange={e => setFormOf({...formOf, contacto_id: e.target.value})} style={inputStyle}>
                    <option value="">— Sin contacto —</option>
                    {contactos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1/3' }}><Label>Descripción</Label><input type="text" value={formOf.descripcion} onChange={e => setFormOf({...formOf, descripcion: e.target.value})} style={inputStyle} /></div>
                <div><Label>Comprobante</Label><input type="text" value={formOf.comprobante} onChange={e => setFormOf({...formOf, comprobante: e.target.value})} style={inputStyle} placeholder="N° factura..." /></div>
                {isChecque && (
                  <div style={{ gridColumn: '1/-1', background: S.amberLight, border: `1px solid #EF9F27`, borderRadius: 8, padding: '1rem' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: S.amber, textTransform: 'uppercase', marginBottom: 10 }}>
                      {formOf.forma_pago === 'e-cheq' ? 'E-Cheque' : 'Cheque'} — se agenda automáticamente
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                      <div><Label>N° cheque</Label><input type="text" value={formOf.numero_cheque} onChange={e => setFormOf({...formOf, numero_cheque: e.target.value})} style={inputStyle} /></div>
                      <div><Label>Banco</Label><input type="text" value={formOf.banco_cheque} onChange={e => setFormOf({...formOf, banco_cheque: e.target.value})} style={inputStyle} /></div>
                      <div><Label>Fecha vencimiento *</Label><input type="date" value={formOf.fecha_vencimiento_cheque} onChange={e => setFormOf({...formOf, fecha_vencimiento_cheque: e.target.value})} style={{ ...inputStyle, borderColor: S.amber }} /></div>
                      {formOf.tipo === 'ingreso' && <div><Label>Librador</Label><input type="text" value={formOf.librador} onChange={e => setFormOf({...formOf, librador: e.target.value})} style={inputStyle} /></div>}
                      {formOf.tipo === 'egreso' && <div><Label>Beneficiario</Label><input type="text" value={formOf.beneficiario} onChange={e => setFormOf({...formOf, beneficiario: e.target.value})} style={inputStyle} /></div>}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowFormOf(false)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={guardarCajaOf} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </Card>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            {['ingreso', 'egreso'].map(tipo => {
              const items = coF.filter(x => x.tipo === tipo)
              const porCat = {}
              items.forEach(x => { porCat[x.categoria] = (porCat[x.categoria] || 0) + (x.monto || 0) })
              const cats = Object.entries(porCat).sort((a, b) => b[1] - a[1])
              const total = cats.reduce((s, [, v]) => s + v, 0)
              return (
                <Card key={tipo} style={{ margin: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: tipo === 'ingreso' ? S.green : S.red, textTransform: 'uppercase', marginBottom: '1rem' }}>
                    {tipo === 'ingreso' ? 'Ingresos' : 'Egresos'} — ${(total / 1000000).toFixed(2)}M
                  </div>
                  {cats.map(([cat, monto]) => (
                    <div key={cat} style={{ display: 'flex', gap: 8, marginBottom: 5 }}>
                      <div style={{ fontSize: 12, color: S.muted, flex: 1 }}>{cat}</div>
                      <div style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: tipo === 'ingreso' ? S.green : S.red }}>${monto.toLocaleString('es-AR')}</div>
                      <div style={{ fontSize: 11, color: S.hint, minWidth: 30, textAlign: 'right' }}>{Math.round(monto / total * 100)}%</div>
                    </div>
                  ))}
                  {cats.length === 0 && <div style={{ fontSize: 13, color: S.hint }}>Sin movimientos.</div>}
                </Card>
              )
            })}
          </div>

          <Card>
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: S.bg }}>
                  {['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Contacto', 'Forma', 'Comprobante', 'Monto', ''].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {coF.length === 0 && <tr><td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay movimientos.</td></tr>}
                  {coF.map(m => (
                    <tr key={m.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(m.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                      <td style={{ padding: '9px 12px' }}><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: m.tipo === 'ingreso' ? S.greenLight : S.redLight, color: m.tipo === 'ingreso' ? S.green : S.red }}>{m.tipo}</span></td>
                      <td style={{ padding: '9px 12px', fontSize: 12, color: S.muted }}>{m.categoria}</td>
                      <td style={{ padding: '9px 12px', fontSize: 12 }}>{m.descripcion || '—'}</td>
                      <td style={{ padding: '9px 12px', fontSize: 12 }}>{m.contactos?.nombre || '—'}</td>
                      <td style={{ padding: '9px 12px', fontSize: 12, color: S.muted }}>{m.forma_pago}</td>
                      <td style={{ padding: '9px 12px', fontSize: 12, color: S.hint }}>{m.comprobante || '—'}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600, color: m.tipo === 'ingreso' ? S.green : S.red }}>{m.tipo === 'ingreso' ? '+' : '-'}${m.monto?.toLocaleString('es-AR')}</td>
                      <td style={{ padding: '9px 12px' }}><button onClick={() => eliminar('caja_oficial', m.id)} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === 'caja_paralela' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <FiltrosPeriodo />
            <button onClick={() => setShowFormPar(!showFormPar)} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.purple, border: `1px solid ${S.purple}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>+ Movimiento</button>
          </div>

          {showFormPar && (
            <Card style={{ border: '1px solid #9F8ED4' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: S.purple, textTransform: 'uppercase', marginBottom: '1rem' }}>Nuevo movimiento Caja 2</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '.75rem' }}>
                <div><Label>Tipo</Label>
                  <select value={formPar.tipo} onChange={e => setFormPar({...formPar, tipo: e.target.value})} style={inputStyle}>
                    <option value="ingreso">Ingreso</option>
                    <option value="egreso">Egreso</option>
                  </select>
                </div>
                <div><Label>Monto $</Label><input type="number" value={formPar.monto} onChange={e => setFormPar({...formPar, monto: e.target.value})} style={inputStyle} /></div>
                <div><Label>Fecha</Label><input type="date" value={formPar.fecha} onChange={e => setFormPar({...formPar, fecha: e.target.value})} style={inputStyle} /></div>
                <div style={{ gridColumn: '1/3' }}><Label>Descripción *</Label><input type="text" value={formPar.descripcion} onChange={e => setFormPar({...formPar, descripcion: e.target.value})} style={inputStyle} /></div>
                <div><Label>Observaciones</Label><input type="text" value={formPar.observaciones} onChange={e => setFormPar({...formPar, observaciones: e.target.value})} style={inputStyle} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowFormPar(false)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={guardarCajaPar} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.purple, border: `1px solid ${S.purple}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </Card>
          )}

          {!filtroMes && (() => {
            const porMes = {}
            cajaParalela.filter(x => new Date(x.fecha + 'T12:00:00').getFullYear() === parseInt(filtroAnio)).forEach(m => {
              const mes = new Date(m.fecha + 'T12:00:00').getMonth() + 1
              if (!porMes[mes]) porMes[mes] = { ing: 0, eg: 0 }
              if (m.tipo === 'ingreso') porMes[mes].ing += m.monto || 0
              else porMes[mes].eg += m.monto || 0
            })
            const entradas = Object.entries(porMes).sort((a, b) => parseInt(b[0]) - parseInt(a[0])).slice(0, 8)
            if (!entradas.length) return null
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.25rem' }}>
                {entradas.map(([mes, d]) => (
                  <div key={mes} style={{ background: S.purpleLight, border: '1px solid #9F8ED4', borderRadius: 8, padding: '.85rem', cursor: 'pointer' }} onClick={() => setFiltroMes(mes)}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: S.purple, marginBottom: 6 }}>{MESES[parseInt(mes)]}</div>
                    <div style={{ fontSize: 13, fontFamily: 'monospace', color: S.green }}>+${d.ing.toLocaleString('es-AR')}</div>
                    <div style={{ fontSize: 13, fontFamily: 'monospace', color: S.red }}>-${d.eg.toLocaleString('es-AR')}</div>
                    <div style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: d.ing - d.eg >= 0 ? S.green : S.red, marginTop: 4 }}>${(d.ing - d.eg).toLocaleString('es-AR')}</div>
                  </div>
                ))}
              </div>
            )
          })()}

          <Card>
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: S.bg }}>
                  {['Fecha', 'Tipo', 'Descripción', 'Observaciones', 'Monto', ''].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {cpF.length === 0 && <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay movimientos.</td></tr>}
                  {cpF.map(m => (
                    <tr key={m.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(m.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                      <td style={{ padding: '9px 12px' }}><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: m.tipo === 'ingreso' ? S.greenLight : S.redLight, color: m.tipo === 'ingreso' ? S.green : S.red }}>{m.tipo}</span></td>
                      <td style={{ padding: '9px 12px', fontWeight: 600 }}>{m.descripcion}</td>
                      <td style={{ padding: '9px 12px', color: S.muted, fontSize: 12 }}>{m.observaciones || '—'}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600, color: m.tipo === 'ingreso' ? S.green : S.red }}>{m.tipo === 'ingreso' ? '+' : '-'}${m.monto?.toLocaleString('es-AR')}</td>
                      <td style={{ padding: '9px 12px' }}><button onClick={() => eliminar('caja_paralela', m.id)} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === 'cheques_oficial' && (
        <TablaCheques items={chFiltradosOf} filtro={filtroCheque} setFiltro={setFiltroCheque} filtroEstado={filtroEstadoCheque} setFiltroEstado={setFiltroEstadoCheque} cambiarEstadoCheque={cambiarEstadoCheque} eliminar={eliminar} />
      )}

      {tab === 'cheques_paralelo' && (
        <TablaCheques items={chFiltradosPar} filtro={filtroChequePar} setFiltro={setFiltroChequePar} filtroEstado={filtroEstadoChequePar} setFiltroEstado={setFiltroEstadoChequePar} cambiarEstadoCheque={cambiarEstadoCheque} eliminar={eliminar} />
      )}


      {tab === 'dolares' && (() => {
        const saldoUSD = dolares.reduce((a, d) => a + (d.tipo === 'ingreso' ? (d.monto_usd || 0) : -(d.monto_usd || 0)), 0)
        const CATS = ['Compra de dólares', 'Venta de dólares', 'Inversión', 'Rendimiento', 'Retiro socios', 'Otro']
        const inp = { padding: '8px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface, width: '100%', boxSizing: 'border-box', fontFamily: "'IBM Plex Sans', sans-serif" }
        const Lbl = ({ children }) => <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>{children}</div>
        return (
          <div>
            {/* Saldo */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>Saldo USD</div>
                <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'monospace', color: saldoUSD >= 0 ? S.green : S.red }}>
                  {saldoUSD >= 0 ? '' : '-'}U$S {Math.abs(saldoUSD).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>TC referencia</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, color: S.muted }}>$</span>
                  <input type="number" value={tcActual} onChange={e => setTcActual(e.target.value)} placeholder="ej. 1250" style={{ ...inp, width: 120, fontSize: 18, fontWeight: 700, fontFamily: 'monospace' }} />
                </div>
              </div>
              <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>Equivalente ARS</div>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', color: S.accent }}>
                  {tcActual ? `$${Math.round(saldoUSD * parseFloat(tcActual)).toLocaleString('es-AR')}` : '—'}
                </div>
              </div>
            </div>

            {/* Botón nuevo */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
              <button onClick={() => setShowFormDolar(!showFormDolar)}
                style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.green, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                + Movimiento
              </button>
            </div>

            {/* Formulario */}
            {showFormDolar && (
              <div style={{ background: S.surface, border: `1px solid ${S.accent}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: '1rem' }}>Nuevo movimiento</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ gridColumn: '1/2' }}>
                    <Lbl>Categoría</Lbl>
                    <select value={formDolar.categoria} onChange={e => {
                      const cat = e.target.value
                      const TIPO_MAP = { 'Compra de dólares': 'ingreso', 'Venta de dólares': 'egreso', 'Inversión': 'egreso', 'Rendimiento': 'ingreso', 'Retiro socios': 'egreso', 'Otro': 'ingreso' }
                      setFormDolar({...formDolar, categoria: cat, tipo: TIPO_MAP[cat] || 'ingreso'})
                    }} style={inp}>
                      {CATS.map(c => <option key={c}>{c}</option>)}
                    </select>
                    <div style={{ fontSize: 11, color: formDolar.tipo === 'ingreso' ? '#1E5C2E' : '#7A1A1A', marginTop: 4, fontWeight: 600 }}>
                      {formDolar.tipo === 'ingreso' ? '↑ Ingreso USD' : '↓ Egreso USD'}
                      {formDolar.categoria === 'Compra de dólares' && ' · Egreso de pesos'}
                      {formDolar.categoria === 'Venta de dólares' && ' · Ingreso de pesos'}
                    </div>
                  </div>
                  <div>
                    <Lbl>Fecha</Lbl>
                    <input type="date" value={formDolar.fecha} onChange={e => setFormDolar({...formDolar, fecha: e.target.value})} style={inp} />
                  </div>
                  <div>
                    <Lbl>Monto U$S</Lbl>
                    <input type="number" value={formDolar.monto_usd} onChange={e => setFormDolar({...formDolar, monto_usd: e.target.value})} style={{ ...inp, fontFamily: 'monospace', fontWeight: 600 }} placeholder="ej. 5000" />
                  </div>
                  <div>
                    <Lbl>Tipo de cambio $</Lbl>
                    <input type="number" value={formDolar.tipo_cambio} onChange={e => setFormDolar({...formDolar, tipo_cambio: e.target.value, monto_ars: e.target.value && formDolar.monto_usd ? String(Math.round(parseFloat(formDolar.monto_usd) * parseFloat(e.target.value))) : ''})} style={{ ...inp, fontFamily: 'monospace' }} placeholder="ej. 1250" />
                  </div>
                  <div>
                    <Lbl>Equivalente ARS</Lbl>
                    <input type="number" value={formDolar.monto_ars} onChange={e => setFormDolar({...formDolar, monto_ars: e.target.value})} style={{ ...inp, fontFamily: 'monospace', background: '#F7F5F0' }} placeholder="calculado automático" />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <Lbl>Descripción</Lbl>
                    <input type="text" value={formDolar.descripcion} onChange={e => setFormDolar({...formDolar, descripcion: e.target.value})} style={inp} placeholder="ej. Compra dólares blue, Plazo fijo USD..." />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowFormDolar(false)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={guardarDolar} disabled={guardandoDolar} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardandoDolar ? 'Guardando...' : 'Guardar'}</button>
                </div>
              </div>
            )}

            {/* Tabla movimientos */}
            <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: S.bg }}>
                    {['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto U$S', 'TC $', 'Equiv. ARS', ''].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dolares.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>Sin movimientos registrados</td></tr>
                  )}
                  {dolares.map(d => (
                    <tr key={d.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(d.fecha+'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: d.tipo === 'ingreso' ? S.greenLight : S.redLight, color: d.tipo === 'ingreso' ? S.green : S.red }}>
                          {d.tipo === 'ingreso' ? '↑ Ingreso' : '↓ Egreso'}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', color: S.muted, fontSize: 12 }}>{d.categoria}</td>
                      <td style={{ padding: '9px 12px' }}>{d.descripcion || '—'}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 700, textAlign: 'right', color: d.tipo === 'ingreso' ? S.green : S.red }}>
                        {d.tipo === 'ingreso' ? '+' : '-'}U$S {(d.monto_usd || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', textAlign: 'right', color: S.muted }}>{d.tipo_cambio ? `$${d.tipo_cambio.toLocaleString('es-AR')}` : '—'}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', textAlign: 'right', color: S.muted }}>{d.monto_ars ? `$${d.monto_ars.toLocaleString('es-AR')}` : '—'}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <button onClick={async () => {
                          if (!confirm('¿Eliminar este movimiento?')) return
                          await supabase.from('caja_dolares').delete().eq('id', d.id)
                          await cargar()
                        }} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {dolares.length > 0 && (
                  <tfoot>
                    <tr style={{ background: S.accentLight }}>
                      <td colSpan={4} style={{ padding: '9px 12px', fontWeight: 700 }}>SALDO</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 700, textAlign: 'right', color: saldoUSD >= 0 ? S.green : S.red }}>
                        {saldoUSD >= 0 ? '+' : ''}U$S {saldoUSD.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      <td></td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 700, textAlign: 'right', color: S.accent }}>
                        {tcActual ? `$${Math.round(saldoUSD * parseFloat(tcActual)).toLocaleString('es-AR')}` : '—'}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )
      })()}

    </div>
  )
} 