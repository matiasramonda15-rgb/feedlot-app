import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { hoyLocal, fechaLocal } from '../shared/dateUtils'
import { Loader } from './UI'
import { abrirReciboDoble, generarOrdenDePago } from '../shared/reciboLogic'

const S = {
  bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6',
  text: '#1A1916', muted: '#6B6760', hint: '#9E9A94',
  accent: '#1A3D6B', accentLight: '#E8EFF8',
  green: '#1E5C2E', greenLight: '#E8F4EB',
  amber: '#7A4500', amberLight: '#FDF0E0',
  red: '#7A1A1A', redLight: '#FDF0F0',
}

const inputStyle = { width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: "'IBM Plex Sans', sans-serif", color: S.text }

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{children}</div>
}

function Card({ children, style = {} }) {
  return <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1rem', ...style }}>{children}</div>
}

const TIPOS = ['tractor', 'maquinaria', 'herramienta', 'vehiculo', 'infraestructura', 'otro']
// Años de vida útil sugeridos por tipo, para calcular la amortización mensual —
// se puede ajustar por cada activo en particular.
const VIDA_UTIL_DEFAULT = { tractor: 10, maquinaria: 8, herramienta: 5, vehiculo: 5, infraestructura: 20, otro: 10 }
const ESTADOS = { activo: { bg: '#E8F4EB', color: '#1E5C2E' }, en_reparacion: { bg: '#FDF0E0', color: '#7A4500' }, dado_de_baja: { bg: '#FDF0F0', color: '#7A1A1A' }, vendido: { bg: '#EDE7F6', color: '#4A2E8A' } }
const SOCIOS = [
  { nombre: 'Oscar',   pct: 75.17 },
  { nombre: 'Matias',  pct: 23.46 },
  { nombre: 'Martin',  pct: 0.77  },
  { nombre: 'Cecilia', pct: 0.60  },
]
const SOCIOS_DEFAULT = SOCIOS.map(s => s.nombre)
const FORMAS_PAGO = ['transferencia', 'cheque', 'efectivo', 'depósito', 'canje']

export default function Activos({ usuario }) {
  const [tab, setTab] = useState('activos')
  const [loading, setLoading] = useState(true)
  const [activos, setActivos] = useState([])
  const [contactos, setContactos] = useState([])
  const [vendiendoActivo, setVendiendoActivo] = useState(null)
  const [formVentaActivo, setFormVentaActivo] = useState({ comprador: '', monto: '', fecha: hoyLocal(), observaciones: '', es_paralelo: false })
  const [retiros, setRetiros] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [showFormActivo, setShowFormActivo] = useState(false)
  const [editandoActivo, setEditandoActivo] = useState(null)
  const [showFormRetiro, setShowFormRetiro] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroAnio, setFiltroAnio] = useState(String(new Date().getFullYear()))

  const [formActivo, setFormActivo] = useState({ nombre: '', tipo: 'tractor', marca: '', modelo: '', anio: '', fecha_compra: '', valor_compra: '', valor_actual: '', estado: 'activo', observaciones: '', pct_feedlot: 0, pct_agricultura: 0, pct_servicios: 0, pct_alfalfa: 0, vida_util_anios: 10 })
  const [formRetiro, setFormRetiro] = useState({ socio: '', fecha: hoyLocal(), monto: '', concepto: '', forma_pago: 'transferencia', observaciones: '', es_paralelo: false, no_afecta_caja: false, es_adelanto: false, tercero: '' })

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: a }, { data: r }, { data: ct }] = await Promise.all([
      supabase.from('activos').select('*').order('fecha_compra', { ascending: false }),
      supabase.from('retiros_socios').select('*').order('fecha', { ascending: false }),
      supabase.from('contactos').select('id, nombre').order('nombre'),
    ])
    setActivos(a || [])
    setRetiros(r || [])
    setContactos(ct || [])
    setLoading(false)
  }

  async function guardarActivo() {
    if (!formActivo.nombre) { alert('Ingresá el nombre'); return }
    setGuardando(true)
    const { error } = await supabase.from('activos').insert({
      ...formActivo,
      anio: formActivo.anio ? parseInt(formActivo.anio) : null,
      fecha_compra: formActivo.fecha_compra || null,
      valor_compra: formActivo.valor_compra ? parseFloat(formActivo.valor_compra) : null,
      valor_actual: formActivo.valor_actual ? parseFloat(formActivo.valor_actual) : null,
      vida_util_anios: formActivo.vida_util_anios ? parseInt(formActivo.vida_util_anios) : null,
      registrado_por: usuario?.id,
    })
    if (error) { alert('Error al guardar: ' + error.message); setGuardando(false); return }
    await cargar()
    setShowFormActivo(false)
    setFormActivo({ nombre: '', tipo: 'tractor', marca: '', modelo: '', anio: '', fecha_compra: '', valor_compra: '', valor_actual: '', estado: 'activo', observaciones: '', pct_feedlot: 0, pct_agricultura: 0, pct_servicios: 0, pct_alfalfa: 0, vida_util_anios: 10 })
    setGuardando(false)
  }

  async function guardarVentaActivo(activo) {
    const nombreActivo = activo ? activo.nombre : (formVentaActivo.activoNombreManual || '').trim()
    if (!nombreActivo) { alert('Ingresá qué se vendió'); return }
    if (!formVentaActivo.comprador || !formVentaActivo.monto) { alert('Completá comprador y monto'); return }
    setGuardando(true)
    const { error: errV } = await supabase.from('ventas_activos').insert({
      activo_id: activo ? activo.id : null, activo_nombre: nombreActivo,
      comprador: formVentaActivo.comprador.trim(),
      monto: parseFloat(formVentaActivo.monto),
      fecha: formVentaActivo.fecha || null,
      observaciones: formVentaActivo.observaciones || null,
      es_paralelo: formVentaActivo.es_paralelo || false,
      registrado_por: usuario?.id,
    })
    if (errV) { alert('Error al guardar la venta: ' + errV.message); setGuardando(false); return }
    // Si era un activo ya registrado, pasa a estado "vendido" para que no siga contando como propio
    if (activo) await supabase.from('activos').update({ estado: 'vendido' }).eq('id', activo.id)
    await cargar()
    setVendiendoActivo(null)
    setFormVentaActivo({ comprador: '', monto: '', fecha: hoyLocal(), observaciones: '', activoNombreManual: '', es_paralelo: false })
    setGuardando(false)
    alert('Venta registrada. El monto ya figura como deuda del comprador en su cuenta corriente, en Contactos.')
  }

  async function guardarRetiro() {
    if (!formRetiro.socio || !formRetiro.monto) { alert('Completá socio y monto'); return }
    if (formRetiro.no_afecta_caja && !formRetiro.tercero) { alert('Ingresá a quién le pagó el socio'); return }
    setGuardando(true)
    const monto = parseFloat(formRetiro.monto)
    const desc = formRetiro.no_afecta_caja
      ? `Retiro socio — ${formRetiro.socio} · pagó a ${formRetiro.tercero}${formRetiro.concepto ? ' · ' + formRetiro.concepto : ''}`
      : formRetiro.es_adelanto
      ? `Retiro socio — ${formRetiro.socio} · adelanto para pagarle a ${formRetiro.tercero || 'un tercero'}${formRetiro.concepto ? ' · ' + formRetiro.concepto : ''}`
      : `Retiro socio — ${formRetiro.socio}${formRetiro.concepto ? ' · ' + formRetiro.concepto : ''}`
    let caja_oficial_id = null, caja_paralela_id = null
    // Si la plata la puso el socio directamente, o si el retiro se saldó con un
    // canje/trueque (no plata), no se toca ninguna caja — solo se descuenta del
    // retiro del socio.
    const esCanje = formRetiro.forma_pago === 'canje'
    if (!formRetiro.no_afecta_caja && !esCanje) {
      if (formRetiro.es_paralelo) {
        const { data: cp, error: errCp } = await supabase.from('caja_paralela').insert({ fecha: formRetiro.fecha, tipo: 'egreso', descripcion: desc, monto }).select().single()
        if (errCp) { alert('Error al registrar en caja: ' + errCp.message); setGuardando(false); return }
        caja_paralela_id = cp?.id
      } else {
        const { data: co, error: errCo } = await supabase.from('caja_oficial').insert({ fecha: formRetiro.fecha, tipo: 'egreso', categoria: 'Retiro socios', descripcion: desc, monto, forma_pago: formRetiro.forma_pago }).select().single()
        if (errCo) { alert('Error al registrar en caja: ' + errCo.message); setGuardando(false); return }
        caja_oficial_id = co?.id
        // Si el retiro se pagó con un cheque nuestro, se guarda en la cartera
        // para poder hacerle seguimiento (antes esto no se guardaba en ningún
        // lado, aunque el formulario ya ofrecía "cheque" como forma de pago).
        if (formRetiro.forma_pago === 'cheque' && formRetiro.cheque_vencimiento) {
          const { error: errCheq } = await supabase.from('cheques').insert({
            tipo: 'emitido', numero: formRetiro.cheque_numero || null, banco: formRetiro.cheque_banco || null,
            monto, fecha_cobro: formRetiro.fecha, fecha_vencimiento: formRetiro.cheque_vencimiento,
            beneficiario: formRetiro.socio || null, estado: 'entregado', caja_oficial_id,
          })
          if (errCheq) {
            alert(`El cheque N° ${formRetiro.cheque_numero || '(sin número)'} no se pudo guardar en la cartera (${errCheq.message}). El retiro NO se terminó de guardar — revisá e intentá de nuevo.`)
            setGuardando(false)
            return
          }
        }
      }
    }
    // Los campos de cheque (número, banco, vencimiento) son solo del
    // formulario, para guardarlos en la cartera de cheques (arriba) — la
    // tabla retiros_socios no tiene esas columnas, así que hay que sacarlos
    // antes de guardar el retiro en sí, o siempre falla (con cualquier
    // forma de pago, no solo con cheque).
    const { cheque_numero, cheque_banco, cheque_vencimiento, ...datosRetiro } = formRetiro
    const { error } = await supabase.from('retiros_socios').insert({ ...datosRetiro, monto, registrado_por: usuario?.id, caja_oficial_id, caja_paralela_id })
    if (error) { alert('Error al guardar el retiro: ' + error.message); setGuardando(false); return }
    await cargar()
    setShowFormRetiro(false)
    if (formRetiro.no_afecta_caja) {
      generarReciboRetiro({ ...formRetiro, monto, fecha: formRetiro.fecha })
    }
    setFormRetiro({ socio: '', fecha: hoyLocal(), monto: '', concepto: '', forma_pago: 'transferencia', observaciones: '', es_paralelo: false, no_afecta_caja: false, es_adelanto: false, tercero: '', cheque_numero: '', cheque_banco: '', cheque_vencimiento: '' })
    setGuardando(false)
  }

  // Recibo imprimible de un pago a tercero hecho con la plata del socio (factura a
  // nombre de la sociedad para descargar IVA, pero la plata no sale de la caja).
  async function generarReciboRetiro(r) {
    const pago = {
      tipo: r.forma_pago,
      monto: r.monto,
      es_paralelo: r.es_paralelo,
      subtipo_cheque: r.forma_pago === 'cheque' ? 'propio' : '',
      cheque_propio: r.forma_pago === 'cheque' ? { numero: r.cheque_numero, banco: r.cheque_banco, fecha_vencimiento: r.cheque_vencimiento } : null,
    }
    await generarOrdenDePago(supabase, {
      destinatario: r.tercero,
      fecha: r.fecha,
      concepto: `${r.concepto || 'Pago por cuenta y orden de Ramonda Hnos S.A.'} · ${r.tercero || ''}`,
      pagos: [pago],
      notaPie: `Pago realizado por cuenta y orden de Ramonda Hnos S.A., aportado directamente por el socio ${r.socio}.`,
    })
  }

  async function guardarEditActivo() {
    if (!editandoActivo?.nombre?.trim()) { alert('Ingresá el nombre'); return }
    const { error } = await supabase.from('activos').update({
      nombre: editandoActivo.nombre,
      tipo: editandoActivo.tipo,
      marca: editandoActivo.marca || null,
      modelo: editandoActivo.modelo || null,
      anio: editandoActivo.anio ? parseInt(editandoActivo.anio) : null,
      fecha_compra: editandoActivo.fecha_compra || null,
      valor_compra: editandoActivo.valor_compra ? parseFloat(editandoActivo.valor_compra) : null,
      valor_actual: editandoActivo.valor_actual ? parseFloat(editandoActivo.valor_actual) : null,
      observaciones: editandoActivo.observaciones || null,
      pct_feedlot: parseFloat(editandoActivo.pct_feedlot) || 0,
      pct_agricultura: parseFloat(editandoActivo.pct_agricultura) || 0,
      pct_servicios: parseFloat(editandoActivo.pct_servicios) || 0,
      pct_alfalfa: parseFloat(editandoActivo.pct_alfalfa) || 0,
      vida_util_anios: editandoActivo.vida_util_anios ? parseInt(editandoActivo.vida_util_anios) : null,
    }).eq('id', editandoActivo.id)
    if (error) { alert('Error al guardar los cambios: ' + error.message); return }
    setEditandoActivo(null)
    await cargar()
  }

  async function cambiarEstado(id, estado) {
    const { error } = await supabase.from('activos').update({ estado }).eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    await cargar()
  }

  async function eliminar(tabla, id) {
    if (!confirm('¿Eliminar este registro?')) return
    // Un retiro de socios deja un movimiento en Caja 1 o Caja 2 (y a veces un
    // cheque emitido) — antes esto quedaba huérfano al borrar el retiro, y
    // había que ir a borrarlo a mano por separado.
    if (tabla === 'retiros_socios') {
      const { data: retiro } = await supabase.from('retiros_socios').select('caja_oficial_id, caja_paralela_id').eq('id', id).single()
      if (retiro?.caja_oficial_id) {
        await supabase.from('cheques').delete().eq('caja_oficial_id', retiro.caja_oficial_id)
        await supabase.from('caja_oficial').delete().eq('id', retiro.caja_oficial_id)
      }
      if (retiro?.caja_paralela_id) {
        await supabase.from('caja_paralela').delete().eq('id', retiro.caja_paralela_id)
      }
    }
    const { error } = await supabase.from(tabla).delete().eq('id', id)
    if (error) { alert('Error al eliminar: ' + error.message); return }
    await cargar()
  }

  if (loading) return <Loader />

  const activosFiltrados = activos.filter(a => !filtroTipo || a.tipo === filtroTipo)
  const totalValorCompra = activosFiltrados.filter(a => a.estado === 'activo').reduce((s, a) => s + (a.valor_compra || 0), 0)
  const totalValorActual = activosFiltrados.filter(a => a.estado === 'activo').reduce((s, a) => s + (a.valor_actual || a.valor_compra || 0), 0)

  const anios = [...new Set(retiros.map(r => new Date(r.fecha + 'T12:00:00').getFullYear()))].sort((a, b) => b - a)
  if (!anios.includes(new Date().getFullYear())) anios.unshift(new Date().getFullYear())
  const retirosFiltrados = retiros.filter(r => new Date(r.fecha + 'T12:00:00').getFullYear() === parseInt(filtroAnio))

  // Resumen por socio
  const porSocio = {}
  retirosFiltrados.forEach(r => {
    if (!porSocio[r.socio]) porSocio[r.socio] = 0
    porSocio[r.socio] += r.monto || 0
  })
  const totalRetiros = retirosFiltrados.reduce((s, r) => s + (r.monto || 0), 0)

  const TABS = [
    { key: 'activos', label: 'Activos' },
    { key: 'socios', label: 'Socios y retiros' },
  ]

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 3 }}>Administración</div>
      <div style={{ fontSize: 12, color: S.muted, fontFamily: 'monospace', marginBottom: '1.5rem' }}>
        Activos de la empresa · socios y retiros
      </div>

      <div style={{ display: 'flex', borderBottom: `1px solid ${S.border}`, marginBottom: '1.5rem' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '10px 20px', fontSize: 13, fontWeight: tab === t.key ? 600 : 500, cursor: 'pointer', color: tab === t.key ? S.accent : S.muted, background: 'transparent', border: 'none', borderBottom: tab === t.key ? `2px solid ${S.accent}` : '2px solid transparent', marginBottom: -1, fontFamily: "'IBM Plex Sans', sans-serif" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── ACTIVOS ── */}
      {tab === 'activos' && (
        <div>
          {/* Métricas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
            {[
              { label: 'Activos totales', val: activos.filter(a => a.estado === 'activo').length },
              { label: 'En reparación', val: activos.filter(a => a.estado === 'en_reparacion').length, color: S.amber },
              { label: 'Valor de compra', val: `$${(totalValorCompra / 1000000).toFixed(1)}M` },
              { label: 'Valor actual', val: `$${(totalValorActual / 1000000).toFixed(1)}M`, color: S.green },
            ].map((m, i) => (
              <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem' }}>
                <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', marginBottom: 5, fontWeight: 600 }}>{m.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: m.color || S.text }}>{m.val}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
                style={{ padding: '7px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface }}>
                <option value="">Todos los tipos</option>
                {TIPOS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <button onClick={() => setShowFormActivo(!showFormActivo)}
              style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
              + Agregar activo
            </button>
            <button onClick={() => setVendiendoActivo(vendiendoActivo === 'nuevo' ? null : 'nuevo')}
              style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.greenLight, border: `1px solid #97C459`, color: S.green, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
              💰 Vender algo (no está en la lista)
            </button>
          </div>

          {vendiendoActivo === 'nuevo' && (
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: S.green, marginBottom: '1rem' }}>💰 Registrar venta de un bien no cargado en Activos</div>
              <div style={{ marginBottom: 8 }}>
                <Label>Qué se vendió</Label>
                <input type="text" value={formVentaActivo.activoNombreManual || ''} onChange={e => setFormVentaActivo({...formVentaActivo, activoNombreManual: e.target.value})}
                  placeholder="ej. Generador eléctrico" style={inputStyle} />
              </div>
              <div style={{ marginBottom: 8 }}>
                <Label>Comprador</Label>
                <select value={formVentaActivo.comprador} onChange={e => setFormVentaActivo({...formVentaActivo, comprador: e.target.value})} style={inputStyle}>
                  <option value="">— Seleccioná —</option>
                  {contactos.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                </select>
                <div style={{ fontSize: 10, color: S.hint, marginTop: 3 }}>¿No aparece? Cargalo primero en Contactos.</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <Label>Monto $</Label>
                  <input type="number" value={formVentaActivo.monto} onChange={e => setFormVentaActivo({...formVentaActivo, monto: e.target.value})} style={{ ...inputStyle, fontFamily: 'monospace' }} />
                </div>
                <div>
                  <Label>Fecha</Label>
                  <input type="date" value={formVentaActivo.fecha} onChange={e => setFormVentaActivo({...formVentaActivo, fecha: e.target.value})} style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <Label>Observaciones</Label>
                <input type="text" value={formVentaActivo.observaciones} onChange={e => setFormVentaActivo({...formVentaActivo, observaciones: e.target.value})}
                  placeholder="ej. cobra en rollos durante los próximos meses" style={inputStyle} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <input type="checkbox" id="venta_activo_paralela" checked={formVentaActivo.es_paralelo || false} onChange={e => setFormVentaActivo({...formVentaActivo, es_paralelo: e.target.checked})} />
                <label htmlFor="venta_activo_paralela" style={{ fontSize: 13, cursor: 'pointer' }}>Es una operación paralela (va a Caja 2, no a la cuenta corriente oficial)</label>
              </div>
              <div style={{ fontSize: 11, color: S.hint, marginBottom: 10 }}>
                El monto queda como deuda del comprador en su cuenta corriente (Contactos). Si te va a pagar en mercadería
                (ej. rollos) en vez de efectivo, cargá esas entregas como compra normal en Alimentación con el mismo nombre
                de comprador como proveedor — se van a descontar solas de esta deuda en el resumen de cuenta.
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => guardarVentaActivo(null)}
                  style={{ flex: 1, padding: '8px', fontSize: 13, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                  Guardar venta
                </button>
                <button onClick={() => { setVendiendoActivo(null); setFormVentaActivo({ comprador: '', monto: '', fecha: hoyLocal(), observaciones: '', activoNombreManual: '' }) }}
                  style={{ padding: '8px 14px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            </Card>
          )}

          {showFormActivo && (
            <Card>
              <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: '1rem' }}>Nuevo activo</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '.75rem' }}>
                <div style={{ gridColumn: '1/3' }}><Label>Nombre</Label><input type="text" value={formActivo.nombre} onChange={e => setFormActivo({...formActivo, nombre: e.target.value})} style={inputStyle} placeholder="ej. Tractor John Deere 5090" /></div>
                <div><Label>Tipo</Label>
                  <select value={formActivo.tipo} onChange={e => setFormActivo({...formActivo, tipo: e.target.value, vida_util_anios: VIDA_UTIL_DEFAULT[e.target.value] || 10})} style={inputStyle}>
                    {TIPOS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div><Label>Marca</Label><input type="text" value={formActivo.marca} onChange={e => setFormActivo({...formActivo, marca: e.target.value})} style={inputStyle} /></div>
                <div><Label>Modelo</Label><input type="text" value={formActivo.modelo} onChange={e => setFormActivo({...formActivo, modelo: e.target.value})} style={inputStyle} /></div>
                <div><Label>Año</Label><input type="number" value={formActivo.anio} onChange={e => setFormActivo({...formActivo, anio: e.target.value})} style={inputStyle} /></div>
                <div><Label>Fecha de compra</Label><input type="date" value={formActivo.fecha_compra} onChange={e => setFormActivo({...formActivo, fecha_compra: e.target.value})} style={inputStyle} /></div>
                <div><Label>Valor de compra $</Label><input type="number" value={formActivo.valor_compra} onChange={e => setFormActivo({...formActivo, valor_compra: e.target.value})} style={inputStyle} /></div>
                <div><Label>Valor actual $</Label><input type="number" value={formActivo.valor_actual} onChange={e => setFormActivo({...formActivo, valor_actual: e.target.value})} style={inputStyle} placeholder="Si difiere del de compra" /></div>
                <div><Label>Vida útil (años)</Label><input type="number" value={formActivo.vida_util_anios} onChange={e => setFormActivo({...formActivo, vida_util_anios: e.target.value})} style={inputStyle} placeholder="Años antes de vender/reponer" /></div>
                <div style={{ gridColumn: '1/-1' }}><Label>Observaciones</Label><input type="text" value={formActivo.observaciones} onChange={e => setFormActivo({...formActivo, observaciones: e.target.value})} style={inputStyle} /></div>
                <div style={{ gridColumn: '1/-1' }}>
                  <Label>Distribución por actividad (debe sumar 100%)</Label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {[{ key: 'pct_feedlot', label: 'Feed Lot' }, { key: 'pct_agricultura', label: 'Agricultura' }, { key: 'pct_servicios', label: 'Servicios' }, { key: 'pct_alfalfa', label: 'Alfalfa' }].map(act => {
                      const total = (parseFloat(formActivo.pct_feedlot)||0) + (parseFloat(formActivo.pct_agricultura)||0) + (parseFloat(formActivo.pct_servicios)||0) + (parseFloat(formActivo.pct_alfalfa)||0)
                      return (
                        <div key={act.key}>
                          <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>{act.label}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input type="number" min="0" max="100" value={formActivo[act.key]} onChange={e => setFormActivo({...formActivo, [act.key]: parseFloat(e.target.value) || 0})} style={{ ...inputStyle, textAlign: 'right', fontFamily: 'monospace' }} />
                            <span style={{ color: S.muted, fontSize: 12 }}>%</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {(() => {
                    const total = (parseFloat(formActivo.pct_feedlot)||0) + (parseFloat(formActivo.pct_agricultura)||0) + (parseFloat(formActivo.pct_servicios)||0) + (parseFloat(formActivo.pct_alfalfa)||0)
                    return total !== 100 && total > 0 ? <div style={{ fontSize: 12, color: S.amber, marginTop: 6 }}>⚠ Suma {total}% — debe ser 100%</div> : null
                  })()}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowFormActivo(false)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={guardarActivo} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </Card>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {activosFiltrados.length === 0 && (
              <div style={{ gridColumn: '1/-1', padding: '2rem', textAlign: 'center', color: S.hint }}>No hay activos registrados.</div>
            )}
            {activosFiltrados.map(a => {
              const ec = ESTADOS[a.estado] || ESTADOS.activo
              const depreciacion = a.valor_compra && a.valor_actual ? Math.round((1 - a.valor_actual / a.valor_compra) * 100) : null
              return (
                <div key={a.id} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{a.nombre}</div>
                      <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>
                        {a.tipo.charAt(0).toUpperCase() + a.tipo.slice(1)}
                        {a.marca ? ` · ${a.marca}` : ''}
                        {a.modelo ? ` ${a.modelo}` : ''}
                        {a.anio ? ` · ${a.anio}` : ''}
                      </div>
                    </div>
                    <select value={a.estado} onChange={e => cambiarEstado(a.id, e.target.value)}
                      style={{ padding: '3px 8px', fontSize: 11, fontWeight: 600, border: `1px solid ${ec.color}`, borderRadius: 5, background: ec.bg, color: ec.color, cursor: 'pointer' }}>
                      {Object.keys(ESTADOS).map(e => <option key={e} value={e}>{e.replace('_', ' ')}</option>)}
                    </select>
                  </div>

                  <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 8, marginTop: 4 }}>
                    {a.fecha_compra && <div style={{ fontSize: 12, color: S.muted }}>Compra: {new Date(a.fecha_compra + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>}
                    {a.valor_compra && <div style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 600, color: S.text, marginTop: 3 }}>Compra: ${a.valor_compra.toLocaleString('es-AR')}</div>}
                    {a.valor_actual && <div style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 600, color: S.green, marginTop: 2 }}>Actual: ${a.valor_actual.toLocaleString('es-AR')}</div>}
                    {depreciacion !== null && <div style={{ fontSize: 11, color: depreciacion > 30 ? S.red : S.amber, marginTop: 2 }}>Depreciación: {depreciacion}%</div>}
                    {/* Distribución por actividad */}
                    {(a.pct_feedlot > 0 || a.pct_agricultura > 0 || a.pct_servicios > 0 || a.pct_alfalfa > 0) && (
                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {[{ key: 'pct_feedlot', label: 'Feed Lot', color: S.accent }, { key: 'pct_agricultura', label: 'Agro', color: S.green }, { key: 'pct_servicios', label: 'Servicios', color: S.purple }, { key: 'pct_alfalfa', label: 'Alfalfa', color: S.amber }].filter(act => a[act.key] > 0).map(act => (
                          <span key={act.key} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600, background: act.color + '22', color: act.color }}>
                            {act.label} {a[act.key]}%
                          </span>
                        ))}
                      </div>
                    )}
                    {a.observaciones && <div style={{ fontSize: 11, color: S.hint, marginTop: 4 }}>{a.observaciones}</div>}
                  </div>

                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    <button onClick={() => setVendiendoActivo(vendiendoActivo === a.id ? null : a.id)}
                      style={{ flex: 1, padding: '5px', fontSize: 11, background: S.greenLight, border: `1px solid #97C459`, color: S.green, borderRadius: 5, cursor: 'pointer' }}>
                      💰 Vender
                    </button>
                    <button onClick={() => setEditandoActivo({
                      id: a.id, nombre: a.nombre, tipo: a.tipo, marca: a.marca || '', modelo: a.modelo || '',
                      anio: a.anio ? String(a.anio) : '', fecha_compra: a.fecha_compra || '',
                      valor_compra: a.valor_compra ? String(a.valor_compra) : '',
                      valor_actual: a.valor_actual ? String(a.valor_actual) : '',
                      observaciones: a.observaciones || '',
                      pct_feedlot: a.pct_feedlot || 0, pct_agricultura: a.pct_agricultura || 0,
                      pct_servicios: a.pct_servicios || 0, pct_alfalfa: a.pct_alfalfa || 0,
                      vida_util_anios: a.vida_util_anios || VIDA_UTIL_DEFAULT[a.tipo] || 10,
                    })}
                      style={{ flex: 1, padding: '5px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>
                      ✏ Editar
                    </button>
                    <button onClick={() => eliminar('activos', a.id)}
                      style={{ flex: 1, padding: '5px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>
                      Eliminar
                    </button>
                  </div>
                  {vendiendoActivo === a.id && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${S.border}` }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: S.green, marginBottom: 8 }}>💰 Registrar venta de {a.nombre}</div>
                      <div style={{ marginBottom: 8 }}>
                        <Label>Comprador</Label>
                        <select value={formVentaActivo.comprador} onChange={e => setFormVentaActivo({...formVentaActivo, comprador: e.target.value})} style={inputStyle}>
                          <option value="">— Seleccioná —</option>
                          {contactos.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                        </select>
                        <div style={{ fontSize: 10, color: S.hint, marginTop: 3 }}>¿No aparece? Cargalo primero en Contactos.</div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                        <div>
                          <Label>Monto $</Label>
                          <input type="number" value={formVentaActivo.monto} onChange={e => setFormVentaActivo({...formVentaActivo, monto: e.target.value})}
                            style={{ ...inputStyle, fontFamily: 'monospace' }} />
                        </div>
                        <div>
                          <Label>Fecha</Label>
                          <input type="date" value={formVentaActivo.fecha} onChange={e => setFormVentaActivo({...formVentaActivo, fecha: e.target.value})} style={inputStyle} />
                        </div>
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <Label>Observaciones</Label>
                        <input type="text" value={formVentaActivo.observaciones} onChange={e => setFormVentaActivo({...formVentaActivo, observaciones: e.target.value})}
                          placeholder="ej. cobra en rollos durante los próximos meses" style={inputStyle} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <input type="checkbox" id="venta_activo_paralela2" checked={formVentaActivo.es_paralelo || false} onChange={e => setFormVentaActivo({...formVentaActivo, es_paralelo: e.target.checked})} />
                        <label htmlFor="venta_activo_paralela2" style={{ fontSize: 13, cursor: 'pointer' }}>Es una operación paralela (va a Caja 2, no a la cuenta corriente oficial)</label>
                      </div>
                      <div style={{ fontSize: 11, color: S.hint, marginBottom: 10 }}>
                        El monto queda como deuda del comprador en su cuenta corriente (Contactos). Si te va a pagar en mercadería
                        (ej. rollos) en vez de efectivo, cargá esas entregas como compra normal en Alimentación con el mismo nombre
                        de comprador como proveedor — se van a descontar solas de esta deuda en el resumen de cuenta.
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => guardarVentaActivo(a)}
                          style={{ flex: 1, padding: '7px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                          Guardar venta
                        </button>
                        <button onClick={() => setVendiendoActivo(null)}
                          style={{ padding: '7px 12px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Modal editar activo */}
          {editandoActivo && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              <div style={{ background: S.surface, borderRadius: 12, padding: '1.5rem', width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: '1.25rem' }}>Editar activo</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ gridColumn: '1/3' }}><Label>Nombre</Label><input type="text" value={editandoActivo.nombre} onChange={e => setEditandoActivo({...editandoActivo, nombre: e.target.value})} style={inputStyle} /></div>
                  <div><Label>Tipo</Label>
                    <select value={editandoActivo.tipo} onChange={e => setEditandoActivo({...editandoActivo, tipo: e.target.value})} style={inputStyle}>
                      {TIPOS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                    </select>
                  </div>
                  <div><Label>Marca</Label><input type="text" value={editandoActivo.marca} onChange={e => setEditandoActivo({...editandoActivo, marca: e.target.value})} style={inputStyle} /></div>
                  <div><Label>Modelo</Label><input type="text" value={editandoActivo.modelo} onChange={e => setEditandoActivo({...editandoActivo, modelo: e.target.value})} style={inputStyle} /></div>
                  <div><Label>Año</Label><input type="number" value={editandoActivo.anio} onChange={e => setEditandoActivo({...editandoActivo, anio: e.target.value})} style={inputStyle} /></div>
                  <div><Label>Fecha de compra</Label><input type="date" value={editandoActivo.fecha_compra} onChange={e => setEditandoActivo({...editandoActivo, fecha_compra: e.target.value})} style={inputStyle} /></div>
                  <div><Label>Valor de compra $</Label><input type="number" value={editandoActivo.valor_compra} onChange={e => setEditandoActivo({...editandoActivo, valor_compra: e.target.value})} style={inputStyle} /></div>
                  <div><Label>Valor actual $</Label><input type="number" value={editandoActivo.valor_actual} onChange={e => setEditandoActivo({...editandoActivo, valor_actual: e.target.value})} style={inputStyle} /></div>
                  <div><Label>Vida útil (años)</Label><input type="number" value={editandoActivo.vida_util_anios} onChange={e => setEditandoActivo({...editandoActivo, vida_util_anios: e.target.value})} style={inputStyle} placeholder="Años antes de vender/reponer" /></div>
                  <div style={{ gridColumn: '1/-1' }}><Label>Observaciones</Label><input type="text" value={editandoActivo.observaciones} onChange={e => setEditandoActivo({...editandoActivo, observaciones: e.target.value})} style={inputStyle} /></div>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <Label>Distribución por actividad (debe sumar 100%)</Label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {[{ key: 'pct_feedlot', label: 'Feed Lot' }, { key: 'pct_agricultura', label: 'Agricultura' }, { key: 'pct_servicios', label: 'Servicios' }, { key: 'pct_alfalfa', label: 'Alfalfa' }].map(act => (
                      <div key={act.key}>
                        <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>{act.label}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input type="number" min="0" max="100" value={editandoActivo[act.key]} onChange={e => setEditandoActivo({...editandoActivo, [act.key]: parseFloat(e.target.value) || 0})} style={{ ...inputStyle, textAlign: 'right', fontFamily: 'monospace' }} />
                          <span style={{ color: S.muted, fontSize: 12 }}>%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {(() => {
                    const total = (editandoActivo.pct_feedlot||0) + (editandoActivo.pct_agricultura||0) + (editandoActivo.pct_servicios||0) + (editandoActivo.pct_alfalfa||0)
                    return total !== 100 && total > 0 ? <div style={{ fontSize: 12, color: S.amber, marginTop: 6 }}>⚠ Suma {total}% — debe ser 100%</div> : null
                  })()}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setEditandoActivo(null)} style={{ padding: '8px 16px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={guardarEditActivo} style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, background: S.green, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>Guardar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SOCIOS ── */}
      {tab === 'socios' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={filtroAnio} onChange={e => setFiltroAnio(e.target.value)}
                style={{ padding: '7px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface }}>
                {anios.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <button onClick={() => setShowFormRetiro(!showFormRetiro)}
              style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
              + Registrar retiro
            </button>
          </div>

          {/* Resumen por socio */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
            {SOCIOS.map(s => {
              const total = porSocio[s.nombre] || 0
              return (
                <div key={s.nombre} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{s.nombre}</div>
                    <div style={{ fontSize: 11, color: S.accent, fontWeight: 600 }}>{s.pct}%</div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: S.red }}>-${total.toLocaleString('es-AR')}</div>
                  <div style={{ fontSize: 11, color: S.hint, marginTop: 3 }}>{retirosFiltrados.filter(r => r.socio === s.nombre).length} retiros</div>
                </div>
              )
            })}
            <div style={{ background: S.accentLight, border: `1px solid #85B7EB`, borderRadius: 8, padding: '1rem' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: S.accent, marginBottom: 6 }}>Total retirado</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: S.red }}>-${totalRetiros.toLocaleString('es-AR')}</div>
              <div style={{ fontSize: 11, color: S.hint, marginTop: 3 }}>{retirosFiltrados.length} retiros en {filtroAnio}</div>
            </div>
          </div>

          {showFormRetiro && (
            <Card>
              <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: '1rem' }}>Nuevo retiro de socio</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '.75rem' }}>
                <div><Label>Socio</Label>
                  <select value={formRetiro.socio} onChange={e => setFormRetiro({...formRetiro, socio: e.target.value})} style={inputStyle}>
                    <option value="">— Seleccioná —</option>
                    {SOCIOS_DEFAULT.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div><Label>Monto $</Label><input type="number" value={formRetiro.monto} onChange={e => setFormRetiro({...formRetiro, monto: e.target.value})} style={inputStyle} /></div>
                <div><Label>Fecha</Label><input type="date" value={formRetiro.fecha} onChange={e => setFormRetiro({...formRetiro, fecha: e.target.value})} style={inputStyle} /></div>
                <div><Label>Concepto</Label><input type="text" value={formRetiro.concepto} onChange={e => setFormRetiro({...formRetiro, concepto: e.target.value})} style={inputStyle} placeholder="ej. Retiro mensual, anticipo..." /></div>
                <div><Label>Forma de pago</Label>
                  <select value={formRetiro.forma_pago} onChange={e => setFormRetiro({...formRetiro, forma_pago: e.target.value})} style={inputStyle}>
                    {FORMAS_PAGO.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div><Label>Observaciones</Label><input type="text" value={formRetiro.observaciones} onChange={e => setFormRetiro({...formRetiro, observaciones: e.target.value})} style={inputStyle} /></div>
                {formRetiro.forma_pago === 'canje' && (
                  <div><Label>A cambio de</Label><input type="text" value={formRetiro.canje_detalle || ''} onChange={e => setFormRetiro({...formRetiro, canje_detalle: e.target.value})} style={inputStyle} placeholder="ej. mercadería entregada el 3/7" /></div>
                )}
                {formRetiro.forma_pago === 'cheque' && (
                  <>
                    <div><Label>N° Cheque</Label><input type="text" value={formRetiro.cheque_numero || ''} onChange={e => setFormRetiro({...formRetiro, cheque_numero: e.target.value})} style={inputStyle} /></div>
                    <div><Label>Banco</Label><input type="text" value={formRetiro.cheque_banco || ''} onChange={e => setFormRetiro({...formRetiro, cheque_banco: e.target.value})} style={inputStyle} /></div>
                    <div>
                      <Label>Fecha de pago (cuándo se cobra)</Label>
                      <input type="date" value={formRetiro.cheque_vencimiento || ''} onChange={e => setFormRetiro({...formRetiro, cheque_vencimiento: e.target.value})} style={inputStyle} />
                      {formRetiro.cheque_vencimiento && (
                        <div style={{ fontSize: 10, color: S.hint, marginTop: 3 }}>
                          Vence (30 días después): {(() => { const d = new Date(formRetiro.cheque_vencimiento + 'T12:00:00'); d.setDate(d.getDate() + 30); return d.toLocaleDateString('es-AR') })()}
                        </div>
                      )}
                    </div>
                  </>
                )}
                {!formRetiro.no_afecta_caja && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" id="paralelo_retiro" checked={formRetiro.es_paralelo} onChange={e => setFormRetiro({...formRetiro, es_paralelo: e.target.checked})} />
                    <label htmlFor="paralelo_retiro" style={{ fontSize: 13, cursor: 'pointer' }}>Caja 2</label>
                  </div>
                )}
              </div>
              {!formRetiro.no_afecta_caja && (
                <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '.85rem', marginBottom: '.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: formRetiro.es_adelanto ? 10 : 0 }}>
                    <input type="checkbox" id="es_adelanto" checked={!!formRetiro.es_adelanto} onChange={e => setFormRetiro({...formRetiro, es_adelanto: e.target.checked, tercero: e.target.checked ? formRetiro.tercero : ''})} />
                    <label htmlFor="es_adelanto" style={{ fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      Es un adelanto — el socio saca la plata ahora para pagarle a un tercero después
                    </label>
                  </div>
                  {formRetiro.es_adelanto && (
                    <>
                      <div style={{ marginBottom: 10 }}>
                        <Label>¿A quién le va a pagar?</Label>
                        <select value={formRetiro.tercero} onChange={e => setFormRetiro({...formRetiro, tercero: e.target.value})} style={inputStyle}>
                          <option value="">— Seleccioná —</option>
                          {contactos.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                        </select>
                        <div style={{ fontSize: 10, color: S.hint, marginTop: 3 }}>¿No aparece? Cargalo primero en Contactos.</div>
                      </div>
                      <div style={{ fontSize: 11, color: S.hint }}>
                        A diferencia de la opción de arriba, esto SÍ descuenta la plata real de la caja — es solo una nota de para qué se está sacando, para no perder el rastro.
                      </div>
                    </>
                  )}
                </div>
              )}
              <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '.85rem', marginBottom: '.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: formRetiro.no_afecta_caja ? 10 : 0 }}>
                  <input type="checkbox" id="no_afecta_caja" checked={formRetiro.no_afecta_caja} onChange={e => setFormRetiro({...formRetiro, no_afecta_caja: e.target.checked, es_paralelo: false, es_adelanto: false})} />
                  <label htmlFor="no_afecta_caja" style={{ fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    El socio pagó directamente a un tercero (factura a nombre de la sociedad, pero la plata no salió de la caja)
                  </label>
                </div>
                {formRetiro.no_afecta_caja && (
                  <>
                    <div style={{ marginBottom: 10 }}>
                      <Label>A quién le pagó el socio</Label>
                      <select value={formRetiro.tercero} onChange={e => setFormRetiro({...formRetiro, tercero: e.target.value})} style={inputStyle}>
                        <option value="">— Seleccioná —</option>
                        {contactos.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                      </select>
                      <div style={{ fontSize: 10, color: S.hint, marginTop: 3 }}>¿No aparece? Cargalo primero en Contactos.</div>
                    </div>
                    <div style={{ fontSize: 11, color: S.hint }}>
                      Esto NO genera ningún movimiento de caja — solo descuenta del retiro de {formRetiro.socio || 'este socio'}.
                      Al guardar, se abre un recibo listo para imprimir o pasar en PDF.
                    </div>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowFormRetiro(false)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={guardarRetiro} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </Card>
          )}

          {/* Proyección proporcional */}
          {totalRetiros > 0 && (() => {
            // Encontrar el socio que más retiró en proporción a sus acciones
            // El "retiro base" es el mayor retiro/pct de todos los socios
            const ratios = SOCIOS.map(s => ({ ...s, retirado: porSocio[s.nombre] || 0, ratio: s.pct > 0 ? (porSocio[s.nombre] || 0) / s.pct : 0 }))
            const maxRatio = Math.max(...ratios.map(r => r.ratio))
            return (
              <Card>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: '1rem' }}>Proyección de retiros proporcionales — {filtroAnio}</div>
                <div style={{ fontSize: 12, color: S.muted, marginBottom: '1rem' }}>
                  Basado en el socio que más retiró en proporción a sus acciones. Total de referencia: ${(maxRatio * 100).toLocaleString('es-AR', { maximumFractionDigits: 0 })} por 1% de acciones.
                </div>
                <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: S.bg }}>
                        {['Socio', '% Acc.', 'Ya retiró', 'Debería retirar', 'Diferencia', 'Estado'].map(h => (
                          <th key={h} style={{ padding: '9px 12px', textAlign: h === 'Socio' || h === 'Estado' ? 'left' : 'right', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ratios.map(s => {
                        const deberiaRetirar = Math.round(maxRatio * s.pct)
                        const diferencia = s.retirado - deberiaRetirar
                        const ok = diferencia >= 0
                        return (
                          <tr key={s.nombre} style={{ borderBottom: `1px solid ${S.border}` }}>
                            <td style={{ padding: '9px 12px', fontWeight: 600 }}>{s.nombre}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', color: S.accent }}>{s.pct}%</td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', color: S.red }}>-${s.retirado.toLocaleString('es-AR')}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', color: S.muted }}>${deberiaRetirar.toLocaleString('es-AR')}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: ok ? S.green : S.amber }}>
                              {ok ? `+$${diferencia.toLocaleString('es-AR')}` : `-$${Math.abs(diferencia).toLocaleString('es-AR')}`}
                            </td>
                            <td style={{ padding: '9px 12px' }}>
                              {ok
                                ? <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: S.greenLight, color: S.green }}>✓ Al día</span>
                                : <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: S.amberLight, color: S.amber }}>⏳ Pendiente ${Math.abs(diferencia).toLocaleString('es-AR')}</span>
                              }
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: S.accentLight }}>
                        <td colSpan={2} style={{ padding: '9px 12px', fontWeight: 700 }}>TOTAL</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: S.red }}>-${totalRetiros.toLocaleString('es-AR')}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: S.muted }}>${Math.round(maxRatio * 100).toLocaleString('es-AR')}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>
            )
          })()}

          <Card>
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: S.bg }}>
                  {['Fecha', 'Socio', 'Tipo', 'Concepto', 'Forma pago', 'Monto', ''].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {retirosFiltrados.length === 0 && <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay retiros registrados.</td></tr>}
                  {retirosFiltrados.map(r => (
                    <tr key={r.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 600 }}>{r.socio}</td>
                      <td style={{ padding: '9px 12px' }}>
                        {r.no_afecta_caja
                          ? <span style={{ padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: S.purpleLight || '#F0EAFB', color: '#3D1A6B', whiteSpace: 'nowrap' }}>🧾 Pagó con plata propia</span>
                          : r.es_adelanto
                          ? <span style={{ padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: S.amberLight, color: S.amber, whiteSpace: 'nowrap' }}>📌 Adelanto p/ tercero</span>
                          : <span style={{ padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: S.redLight, color: S.red, whiteSpace: 'nowrap' }}>💵 Salió de la caja</span>
                        }
                      </td>
                      <td style={{ padding: '9px 12px', color: S.muted }}>{r.concepto || '—'}</td>
                      <td style={{ padding: '9px 12px', color: S.muted, fontSize: 12 }}>{r.forma_pago}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600, color: S.red }}>-${r.monto?.toLocaleString('es-AR')}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={async () => {
                            await abrirReciboDoble(supabase, {
                              titulo: 'Comprobante de Retiro',
                              fecha: new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-AR'),
                              filas: [
                                ['Socio', r.socio],
                                ['Fecha', new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-AR')],
                                ['Concepto', r.concepto || '—'],
                                ['Forma de pago', `${r.forma_pago}${r.caja_paralela_id ? ' (C2)' : ''}`],
                                ['Observaciones', r.observaciones || null],
                              ],
                              montoLabel: 'MONTO RETIRADO',
                              monto: `-$${r.monto?.toLocaleString('es-AR')}`,
                              colorMonto: '#7A1A1A',
                              firmaIzq: 'Firma socio',
                              firmaDer: 'Firma responsable',
                              etiquetaCopia1: 'Copia — ' + r.socio,
                              etiquetaCopia2: 'Copia — Ramonda Hnos S.A.',
                            })
                          }} style={{ padding: '3px 8px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>🖨 Recibo</button>
                          {r.tercero && (
                            <button onClick={() => generarReciboRetiro(r)}
                              style={{ padding: '3px 8px', fontSize: 11, background: S.greenLight, border: '1px solid #97C459', color: S.green, borderRadius: 5, cursor: 'pointer' }}>
                              🖨 Recibo a {r.tercero}
                            </button>
                          )}
                          <button onClick={() => eliminar('retiros_socios', r.id)} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

    </div>
  )
} 
