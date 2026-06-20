// v3 - reescrito desde cero
import React, { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Loader } from './Tablero'

const S = {
  bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6', borderStrong: '#C8C2B8',
  text: '#1A1916', muted: '#6B6760', hint: '#9E9A94',
  accent: '#1A3D6B', accentLight: '#E8EFF8',
  green: '#1E5C2E', greenLight: '#E8F4EB',
  amber: '#7A4500', amberLight: '#FDF0E0',
  red: '#7A1A1A', redLight: '#FDF0F0',
  purple: '#3D1A6B', purpleLight: '#F0EAFB',
}
const inp = { width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: "'IBM Plex Sans', sans-serif", color: S.text }
const inpMono = { ...inp, fontFamily: 'monospace' }
const Lbl = ({ c, children }) => <div style={{ fontSize: 10, fontWeight: 600, color: c || S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{children}</div>
const Btn = ({ onClick, disabled, ghost, red, children, style = {} }) => (
  <button onClick={onClick} disabled={disabled}
    style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1, border: `1px solid ${red ? S.red : ghost ? S.border : S.accent}`, background: red ? S.red : ghost ? 'transparent' : S.accent, color: red ? '#fff' : ghost ? S.muted : '#fff', borderRadius: 6, fontFamily: "'IBM Plex Sans', sans-serif", ...style }}>
    {children}
  </button>
)

const CATEGORIAS = ['Novillos 2-3 años', 'Novillos 3-4 años', 'Novillitos', 'Terneros', 'Vaquillonas', 'Vacas', 'Toros']
const PROCEDENCIAS_DEFAULT = ['La Pampa', 'Córdoba', 'Buenos Aires', 'Santa Fe', 'Entre Ríos']

export default function Ingresos({ usuario }) {
  const [tab, setTab] = useState('lista')
  const [showDetalleMeses, setShowDetalleMeses] = useState(false)
  const [showDetallePrecio, setShowDetallePrecio] = useState(false)
  const [showDetalleKg, setShowDetalleKg] = useState(false)
  const [lotes, setLotes] = useState([])
  const [corrales, setCorrales] = useState([])
  const [contactos, setContactos] = useState([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState('lista') // 'lista' | 'nuevo' | 'editar'
  const [editandoLote, setEditandoLote] = useState(null)
  const [guardando, setGuardando] = useState(false)

  // Nuevo ingreso form
  const [form, setForm] = useState({
    procedencia: '', otraProcedencia: '', categoria: 'Novillos 2-3 años',
    cantidad: '', kg_bascula: '', observaciones: '', corral_cuarentena_id: '',
  })

  // Completar datos (precio, kg factura, comercial)
  const [editandoPrecio, setEditandoPrecio] = useState(null)
  // { id, kg_factura, precio_compra, monto_total, plazo_dias, comision_monto, comision_a_quien, comision_es_paralela }

  // Estado pagos
  const [formPagoCompra, setFormPagoCompra] = useState({ monto: '', forma_pago: 'transferencia', fecha: new Date().toISOString().split('T')[0], numero_cheque: '', banco: '', fecha_vencimiento_cheque: '', es_negro: false })

  // Calculadora
  const [calc, setCalc] = useState({ precio_venta: '', kg_venta: '', desbaste_venta: '8', kg_compra: '', conversion_mf: '6.8', aumento_diario: '1.25', costo_dieta: '220', sanidad_animal: '9500', gastos_fijos_mes: '20000', flete_compra: '', flete_venta: '', comision_compra_pct: '', comision_venta_pct: '', margen_deseado: '15' })

  const esDueno = usuario?.rol === 'dueno'

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    const [{ data: lotesDB }, { data: corralesDB }, { data: ctDB }] = await Promise.all([
      supabase.from('lotes').select('*').order('created_at', { ascending: false }),
      supabase.from('corrales').select('id, numero, rol, sub, animales').order('numero'),
      supabase.from('contactos').select('id, nombre, cuit').eq('activo', true).order('nombre'),
    ])
    setLotes(lotesDB || [])
    setCorrales(corralesDB || [])
    setContactos(ctDB || [])
    setLoading(false)
  }

  async function guardarIngreso() {
    if (!form.cantidad || !form.kg_bascula) { alert('Completá cantidad y kg báscula'); return }
    setGuardando(true)
    // Resolver procedencia — si es nuevo, crear contacto
    let procFinal = null
    if (form.procedencia === 'Nuevo') {
      const nombre = form.otraProcedencia?.trim()
      if (nombre) {
        const existente = contactos.find(c => c.nombre.toLowerCase() === nombre.toLowerCase())
        if (!existente) {
          await supabase.from('contactos').insert({ nombre, tipo: 'proveedor_hacienda', activo: true })
          await cargarDatos()
        }
        procFinal = nombre
      }
    } else {
      procFinal = form.procedencia || null
    }
    const { data: nuevoLote } = await supabase.from('lotes').insert({
      procedencia: procFinal, categoria: form.categoria,
      cantidad: parseInt(form.cantidad), kg_bascula: parseFloat(form.kg_bascula),
      observaciones: form.observaciones || null,
      corral_cuarentena_id: form.corral_cuarentena_id ? parseInt(form.corral_cuarentena_id) : null,
      estado: 'activo', fecha_ingreso: new Date().toISOString().split('T')[0],
      peso_prom_ingreso: form.cantidad && form.kg_bascula ? Math.round(parseFloat(form.kg_bascula) / parseInt(form.cantidad)) : null,
    }).select().single()
    if (form.corral_cuarentena_id && nuevoLote) {
      const corral = corrales.find(c => c.id === parseInt(form.corral_cuarentena_id))
      const nuevosAnim = (corral?.animales || 0) + parseInt(form.cantidad)
      await supabase.from('corrales').update({ animales: nuevosAnim, rol: 'cuarentena' }).eq('id', parseInt(form.corral_cuarentena_id))
    }
    await cargarDatos()
    setVista('lista')
    setForm({ procedencia: '', otraProcedencia: '', categoria: 'Novillos 2-3 años', cantidad: '', kg_bascula: '', observaciones: '', corral_cuarentena_id: '' })
    setGuardando(false)
  }

  async function guardarEdicion() {
    if (!editandoLote) return
    setGuardando(true)
    const procFinal = form.procedencia === 'Otro' ? (form.otraProcedencia?.trim() || null) : (form.procedencia || null)
    await supabase.from('lotes').update({
      procedencia: procFinal || null, categoria: form.categoria,
      cantidad: parseInt(form.cantidad) || null, kg_bascula: parseFloat(form.kg_bascula) || null,
      observaciones: form.observaciones || null,
      corral_cuarentena_id: form.corral_cuarentena_id ? parseInt(form.corral_cuarentena_id) : null,
    }).eq('id', editandoLote.id)
    await cargarDatos()
    setVista('lista')
    setEditandoLote(null)
    setGuardando(false)
  }

  async function guardarPrecio(lote) {
    if (!editandoPrecio?.monto_total && !editandoPrecio?.precio_compra) { alert('Ingresá el monto total o el precio'); return }
    const kgFac = editandoPrecio.kg_factura ? parseFloat(editandoPrecio.kg_factura) : null
    const precio = editandoPrecio.precio_compra ? parseFloat(editandoPrecio.precio_compra) : null
    const montoTotal = editandoPrecio.monto_total ? parseFloat(editandoPrecio.monto_total) : (kgFac && precio ? Math.round(kgFac * precio) : null)
    const plazoStr = editandoPrecio.plazo_dias || null
    const plazosArr = plazoStr ? plazoStr.split(',').filter(Boolean).map(p => parseInt(p)) : []
    const plazoMax = plazosArr.length > 0 ? Math.max(...plazosArr) : null
    const fechaVto = plazoMax ? new Date(new Date(lote.fecha_ingreso + 'T12:00:00').getTime() + plazoMax * 86400000).toISOString().split('T')[0] : null
    const comMonto = editandoPrecio.comision_monto ? parseFloat(editandoPrecio.comision_monto) : 0

    // Resolver procedencia
    let procFinal = editandoPrecio.procedencia !== 'Nuevo' ? (editandoPrecio.procedencia || lote.procedencia) : lote.procedencia
    if (editandoPrecio.procedencia === 'Nuevo' && editandoPrecio.nuevaProcedencia?.trim()) {
      const nombre = editandoPrecio.nuevaProcedencia.trim()
      const existente = contactos.find(c => c.nombre.toLowerCase() === nombre.toLowerCase())
      if (!existente) await supabase.from('contactos').insert({ nombre, tipo: 'proveedor_hacienda', activo: true })
      procFinal = nombre
    }

    await supabase.from('lotes').update({
      kg_factura: kgFac,
      precio_compra: precio || (montoTotal && kgFac ? Math.round(montoTotal / kgFac) : null),
      monto_total_con_iva: montoTotal,
      plazo_dias: plazoStr,
      fecha_vencimiento_pago: fechaVto,
      comision_monto: comMonto || null,
      comision_a_quien: editandoPrecio.comision_a_quien || null,
      comision_es_paralela: editandoPrecio.comision_es_paralela || false,
      procedencia: procFinal,
    }).eq('id', lote.id)
    setEditandoPrecio(null)
    await cargarDatos()
  }

  async function eliminarLote(id) {
    if (!confirm('¿Eliminar este ingreso?')) return
    const lote = lotes.find(l => l.id === id)
    if (lote?.corral_cuarentena_id && lote?.cantidad) {
      const corral = corrales.find(c => c.id === lote.corral_cuarentena_id)
      const nuevosAnim = Math.max(0, (corral?.animales || 0) - lote.cantidad)
      const upd = { animales: nuevosAnim }
      if (nuevosAnim === 0) { upd.rol = 'libre'; upd.sub = null }
      await supabase.from('corrales').update(upd).eq('id', lote.corral_cuarentena_id)
    }
    await supabase.from('lotes').delete().eq('id', id)
    await cargarDatos()
  }

  if (loading) return <Loader />

  const lotesSinPrecio = esDueno ? lotes.filter(l => !l.precio_compra && !l.monto_total_con_iva) : []
  const loteEditandoExtra = (esDueno && editandoPrecio?.id && !lotesSinPrecio.find(l => l.id === editandoPrecio.id))
    ? lotes.find(l => l.id === editandoPrecio.id)
    : null
  const lotesParaCompletar = loteEditandoExtra ? [loteEditandoExtra, ...lotesSinPrecio] : lotesSinPrecio
  const compradores = [...new Set(lotes.map(l => l.procedencia).filter(Boolean))]

  // Métricas encabezado
  const ahora = new Date()
  const anioActual = ahora.getFullYear()
  const mesActual = ahora.getMonth()
  const lotesAnio = lotes.filter(l => l.created_at && new Date(l.created_at).getFullYear() === anioActual)
  const lotesMes = lotes.filter(l => l.created_at && new Date(l.created_at).getFullYear() === anioActual && new Date(l.created_at).getMonth() === mesActual)
  const totalAnimAnio = lotesAnio.reduce((s, l) => s + (l.cantidad || 0), 0)
  const totalAnimMes = lotesMes.reduce((s, l) => s + (l.cantidad || 0), 0)
  const lotesConPrecio = lotes.filter(l => l.precio_compra)
  const precioPromedio = lotesConPrecio.length > 0
    ? Math.round(lotesConPrecio.reduce((s, l) => s + l.precio_compra, 0) / lotesConPrecio.length)
    : null
  const lotesConKg = lotes.filter(l => l.cantidad && l.kg_bascula)
  const totalKgIngresados = lotesConKg.reduce((s, l) => s + l.kg_bascula, 0)
  const totalAnimIngresados = lotesConKg.reduce((s, l) => s + l.cantidad, 0)
  const kgPromedio = totalAnimIngresados > 0 ? Math.round(totalKgIngresados / totalAnimIngresados) : null

  // Kg promedio del mes actual
  const lotesMesConKg = lotesMes.filter(l => l.cantidad && l.kg_bascula)
  const kgPromedioMes = lotesMesConKg.length > 0
    ? Math.round(lotesMesConKg.reduce((s, l) => s + l.kg_bascula, 0) / lotesMesConKg.reduce((s, l) => s + l.cantidad, 0))
    : null

  // Detalle por mes
  const ingresosPorMes = {}
  lotes.forEach(l => {
    const fecha = new Date(l.created_at || l.fecha_ingreso)
    const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
    if (!ingresosPorMes[key]) ingresosPorMes[key] = { cantidad: 0, ingresos: 0, kgTotal: 0, precioSum: 0, precioCount: 0 }
    ingresosPorMes[key].cantidad += l.cantidad || 0
    ingresosPorMes[key].ingresos += 1
    ingresosPorMes[key].kgTotal += l.kg_bascula || 0
    if (l.precio_compra) { ingresosPorMes[key].precioSum += l.precio_compra; ingresosPorMes[key].precioCount += 1 }
  })
  const mesesOrdenados = Object.entries(ingresosPorMes).sort((a, b) => b[0].localeCompare(a[0]))

  const TABS = [
    { key: 'lista', label: 'Ingresos' },
    { key: 'gestion', label: 'Gestión comercial' },
    { key: 'calculadora', label: '🧮 Calculadora precio máximo' },
  ]

  // ── VISTA NUEVO / EDITAR ──
  if (vista === 'nuevo' || vista === 'editar') {
    const corralesLibres = corrales.filter(c => c.rol === 'libre' || c.rol === 'cuarentena' || (vista === 'editar' && c.id === editandoLote?.corral_cuarentena_id))
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>
          <button onClick={() => { setVista('lista'); setEditandoLote(null) }} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer', fontSize: 13 }}>← Volver</button>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{vista === 'nuevo' ? 'Nuevo ingreso' : `Editar ingreso · C-${editandoLote?.corrales?.numero || ''}`}</div>
        </div>
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.5rem', maxWidth: 700 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <Lbl>Procedencia / Vendedor</Lbl>
              <select value={form.procedencia} onChange={e => setForm({...form, procedencia: e.target.value, otraProcedencia: ''})} style={inp}>
                <option value="">— Seleccioná —</option>
                {contactos.map(c => <option key={c.id} value={c.nombre}>{c.nombre}{c.cuit ? ` · ${c.cuit}` : ''}</option>)}
                <option value="Nuevo">+ Nuevo contacto...</option>
              </select>
            </div>
            {form.procedencia === 'Nuevo' && (
              <div>
                <Lbl>Nombre del vendedor *</Lbl>
                <input type="text" value={form.otraProcedencia} onChange={e => setForm({...form, otraProcedencia: e.target.value})} style={inp} placeholder="Se guardará como contacto" />
              </div>
            )}
            <div>
              <Lbl>Categoría</Lbl>
              <select value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} style={inp}>
                {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Lbl>Cantidad de animales</Lbl>
              <input type="number" value={form.cantidad} onChange={e => setForm({...form, cantidad: e.target.value})} style={inpMono} />
            </div>
            <div>
              <Lbl>Kg báscula (control)</Lbl>
              <input type="number" value={form.kg_bascula} onChange={e => setForm({...form, kg_bascula: e.target.value})} style={inpMono} />
            </div>
            <div>
              <Lbl>Corral cuarentena</Lbl>
              <select value={form.corral_cuarentena_id} onChange={e => setForm({...form, corral_cuarentena_id: e.target.value})} style={inp}>
                <option value="">— Sin asignar —</option>
                {corralesLibres.map(c => <option key={c.id} value={c.id}>C-{c.numero} ({c.rol})</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <Lbl>Observaciones</Lbl>
              <input type="text" value={form.observaciones} onChange={e => setForm({...form, observaciones: e.target.value})} style={inp} />
            </div>
          </div>
          {form.cantidad && form.kg_bascula && (
            <div style={{ background: S.accentLight, borderRadius: 6, padding: '8px 12px', marginBottom: '1rem', fontSize: 12, color: S.accent }}>
              Peso promedio: <strong>{Math.round(parseFloat(form.kg_bascula) / parseInt(form.cantidad))} kg/animal</strong>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={vista === 'nuevo' ? guardarIngreso : guardarEdicion} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</Btn>
            <Btn ghost onClick={() => { setVista('lista'); setEditandoLote(null) }}>Cancelar</Btn>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: 20, fontWeight: 600 }}>Ingresos de hacienda</div>
        {esDueno && (
          <Btn onClick={() => {
            setVista('nuevo')
            setForm({ procedencia: '', otraProcedencia: '', categoria: 'Novillos 2-3 años', cantidad: '', kg_bascula: '', observaciones: '', corral_cuarentena_id: '' })
          }}>+ Nuevo ingreso</Btn>
        )}
      </div>

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1rem' }}>
        {/* Comprados este año — expandible */}
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '.9rem 1rem' }}>
          <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Comprado este año</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', lineHeight: 1, color: totalAnimAnio > 0 ? S.green : S.text }}>{totalAnimAnio.toLocaleString('es-AR')}</div>
          <div style={{ fontSize: 11, color: S.hint, marginTop: 3, marginBottom: 6 }}>{lotesAnio.length} ingreso{lotesAnio.length !== 1 ? 's' : ''} · este año</div>
          <button onClick={() => setShowDetalleMeses(!showDetalleMeses)}
            style={{ fontSize: 11, color: S.accent, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
            {showDetalleMeses ? '▴ Ocultar detalle' : '▾ Ver por mes'}
          </button>
        </div>
        {/* Comprados este mes */}
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '.9rem 1rem' }}>
          <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Comprado este mes</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', lineHeight: 1, color: totalAnimMes > 0 ? S.green : S.text }}>{totalAnimMes.toLocaleString('es-AR')}</div>
          <div style={{ fontSize: 11, color: S.hint, marginTop: 3 }}>{lotesMes.length} ingreso{lotesMes.length !== 1 ? 's' : ''}</div>
        </div>
        {/* Precio prom — expandible */}
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '.9rem 1rem' }}>
          <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Precio prom. compra</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', lineHeight: 1, color: S.text }}>{precioPromedio ? `$${precioPromedio.toLocaleString('es-AR')}` : '—'}</div>
          <div style={{ fontSize: 11, color: S.hint, marginTop: 3, marginBottom: 6 }}>$/kg · promedio histórico</div>
          <button onClick={() => setShowDetallePrecio(!showDetallePrecio)}
            style={{ fontSize: 11, color: S.accent, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
            {showDetallePrecio ? '▴ Ocultar detalle' : '▾ Ver por mes'}
          </button>
        </div>
        {/* Kg prom — expandible */}
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '.9rem 1rem' }}>
          <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Kg prom. por animal</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', lineHeight: 1, color: S.text }}>{kgPromedio ? `${kgPromedio.toLocaleString('es-AR')} kg` : '—'}</div>
          <div style={{ fontSize: 11, color: S.hint, marginTop: 3, marginBottom: kgPromedioMes ? 4 : 6 }}>histórico ponderado</div>
          {kgPromedioMes && <div style={{ fontSize: 12, color: S.accent, fontFamily: 'monospace', fontWeight: 600 }}>{kgPromedioMes.toLocaleString('es-AR')} kg <span style={{ fontSize: 10, fontWeight: 400, color: S.muted }}>este mes</span></div>}
          <button onClick={() => setShowDetalleKg(!showDetalleKg)}
            style={{ fontSize: 11, color: S.accent, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', marginTop: 4 }}>
            {showDetalleKg ? '▴ Ocultar detalle' : '▾ Ver por mes'}
          </button>
        </div>
      </div>

      {/* Detalle comprados por mes */}
      {showDetalleMeses && mesesOrdenados.length > 0 && (
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, marginBottom: '1rem', overflow: 'hidden' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', padding: '10px 14px', borderBottom: `1px solid ${S.border}` }}>Compras por mes</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: S.bg }}>
              {['Mes', 'Ingresos', 'Animales'].map(h => (
                <th key={h} style={{ padding: '8px 14px', textAlign: h === 'Animales' ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {mesesOrdenados.map(([key, data]) => {
                const [anio, mes] = key.split('-')
                const nombreMes = new Date(parseInt(anio), parseInt(mes) - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
                return (
                  <tr key={key} style={{ borderBottom: `1px solid ${S.border}` }}>
                    <td style={{ padding: '9px 14px', fontWeight: 600, textTransform: 'capitalize' }}>{nombreMes}</td>
                    <td style={{ padding: '9px 14px', color: S.muted }}>{data.ingresos} ingreso{data.ingresos !== 1 ? 's' : ''}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: S.green }}>{data.cantidad.toLocaleString('es-AR')}</td>
                  </tr>
                )
              })}
              <tr style={{ background: S.bg, borderTop: `2px solid ${S.border}` }}>
                <td style={{ padding: '9px 14px', fontWeight: 700 }}>Total</td>
                <td style={{ padding: '9px 14px', color: S.muted }}>{lotes.length} ingresos</td>
                <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: S.green }}>{lotes.reduce((s,l)=>s+(l.cantidad||0),0).toLocaleString('es-AR')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Detalle precio por mes */}
      {showDetallePrecio && mesesOrdenados.length > 0 && (
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, marginBottom: '1rem', overflow: 'hidden' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', padding: '10px 14px', borderBottom: `1px solid ${S.border}` }}>Precio promedio de compra por mes</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: S.bg }}>
              {['Mes', 'Ingresos con precio', 'Precio prom. $/kg'].map(h => (
                <th key={h} style={{ padding: '8px 14px', textAlign: h === 'Precio prom. $/kg' ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {mesesOrdenados.map(([key, data]) => {
                const [anio, mes] = key.split('-')
                const nombreMes = new Date(parseInt(anio), parseInt(mes) - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
                const precioProm = data.precioCount > 0 ? Math.round(data.precioSum / data.precioCount) : null
                return (
                  <tr key={key} style={{ borderBottom: `1px solid ${S.border}` }}>
                    <td style={{ padding: '9px 14px', fontWeight: 600, textTransform: 'capitalize' }}>{nombreMes}</td>
                    <td style={{ padding: '9px 14px', color: S.muted }}>{data.precioCount} ingreso{data.precioCount !== 1 ? 's' : ''}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: precioProm ? S.green : S.hint }}>{precioProm ? `$${precioProm.toLocaleString('es-AR')}` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detalle kg por mes */}
      {showDetalleKg && mesesOrdenados.length > 0 && (
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, marginBottom: '1rem', overflow: 'hidden' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', padding: '10px 14px', borderBottom: `1px solid ${S.border}` }}>Kg promedio por animal — por mes</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: S.bg }}>
              {['Mes', 'Animales', 'Kg totales', 'Kg prom./animal'].map(h => (
                <th key={h} style={{ padding: '8px 14px', textAlign: h === 'Kg prom./animal' ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {mesesOrdenados.map(([key, data]) => {
                const [anio, mes] = key.split('-')
                const nombreMes = new Date(parseInt(anio), parseInt(mes) - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
                const kgProm = data.cantidad > 0 && data.kgTotal > 0 ? Math.round(data.kgTotal / data.cantidad) : null
                return (
                  <tr key={key} style={{ borderBottom: `1px solid ${S.border}` }}>
                    <td style={{ padding: '9px 14px', fontWeight: 600, textTransform: 'capitalize' }}>{nombreMes}</td>
                    <td style={{ padding: '9px 14px', fontFamily: 'monospace' }}>{data.cantidad.toLocaleString('es-AR')}</td>
                    <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: S.muted }}>{(data.kgTotal/1000).toFixed(1)} tn</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{kgProm ? `${kgProm.toLocaleString('es-AR')} kg` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Banner lotes sin precio */}
      {lotesParaCompletar.length > 0 && (
        <div style={{ background: S.amberLight, border: `1px solid #EF9F27`, borderRadius: 10, padding: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: S.amber, marginBottom: '1rem' }}>
            {lotesSinPrecio.length > 0 ? `⚠ ${lotesSinPrecio.length} ingreso${lotesSinPrecio.length !== 1 ? 's' : ''} sin precio de compra` : '✏️ Editando datos comerciales'}
          </div>
          {lotesParaCompletar.map(l => {
            const isEdit = editandoPrecio?.id === l.id
            const kgBas = l.kg_bascula || 0
            const kgFac = parseFloat(editandoPrecio?.kg_factura || l.kg_factura || 0)
            const diffKg = kgBas && kgFac ? kgBas - kgFac : null
            const diffPct = diffKg !== null && kgFac > 0 ? (diffKg / kgFac * 100) : null
            const alertaDiff = diffPct !== null && Math.abs(diffPct) > 3
            // Total usa kg factura
            const kgPrecio = isEdit ? (parseFloat(editandoPrecio.kg_factura) || 0) : (l.kg_factura || 0)
            const precioCalc = isEdit ? parseFloat(editandoPrecio.precio_compra || 0) : 0
            const montoCalc = isEdit ? parseFloat(editandoPrecio.monto_total || 0) : 0
            // Bidireccional
            return (
              <div key={l.id} style={{ background: S.surface, borderRadius: 8, padding: '1rem', marginBottom: 8, border: `1px solid ${isEdit ? S.accent : S.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isEdit ? '1rem' : 0 }}>
                  <div style={{ fontSize: 13 }}>
                    <strong>C-{corrales.find(c => c.id === l.corral_cuarentena_id)?.numero || l.corral_cuarentena_id}</strong>
                    {' · '}{l.cantidad} animales
                    {' · '}{(l.kg_vivo_total || l.kg_bascula || 0).toLocaleString('es-AR')} kg brutos
                    {l.categoria && ` · ${l.categoria}`}
                    {' · '}{l.fecha_ingreso ? new Date(l.fecha_ingreso + 'T12:00:00').toLocaleDateString('es-AR') : ''}
                  </div>
                  {!isEdit && (
                    <Btn onClick={() => setEditandoPrecio({
                      id: l.id,
                      kg_factura: l.kg_factura ? String(l.kg_factura) : '',
                      precio_compra: l.precio_compra ? String(l.precio_compra) : '',
                      monto_total: l.monto_total_con_iva ? String(l.monto_total_con_iva) : '',
                      monto_facturado: l.monto_facturado ? String(l.monto_facturado) : '',
                      paralelo: (l.monto_total_con_iva && l.monto_facturado) ? String(Math.max(0, l.monto_total_con_iva - l.monto_facturado)) : '',
                      plazo_dias: l.plazo_dias ? String(l.plazo_dias) : '',
                      comision_monto: l.comision_monto ? String(l.comision_monto) : '',
                      comision_a_quien: l.comision_a_quien || '',
                      comision_es_paralela: l.comision_es_paralela || false,
                      procedencia: l.procedencia || '',
                      nuevaProcedencia: '',
                      cuotas_pago: (l.cuotas_pago || []).map(c => ({ fecha: c.fecha, monto: String(c.monto) })),
                    })} style={{ fontSize: 12, padding: '5px 12px' }}>
                      Completar datos
                    </Btn>
                  )}
                  {isEdit && (
                    <button onClick={() => setEditandoPrecio(null)} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer', fontSize: 13 }}>✕</button>
                  )}
                </div>

                {isEdit && (
                  <div>
                    {/* Fila 1: Procedencia/Vendedor */}
                    <div style={{ marginBottom: 12 }}>
                      <Lbl>Procedencia / Vendedor</Lbl>
                      <select value={editandoPrecio.procedencia || ''} onChange={e => setEditandoPrecio({...editandoPrecio, procedencia: e.target.value, nuevaProcedencia: ''})}
                        style={{ ...inp, marginBottom: editandoPrecio.procedencia === 'Nuevo' ? 6 : 0 }}>
                        <option value="">— Seleccioná —</option>
                        {contactos.map(c => <option key={c.id} value={c.nombre}>{c.nombre}{c.cuit ? ` · ${c.cuit}` : ''}</option>)}
                        <option value="Nuevo">+ Nuevo contacto...</option>
                      </select>
                      {editandoPrecio.procedencia === 'Nuevo' && (
                        <input type="text" placeholder="Nombre del vendedor (se guardará como contacto)" value={editandoPrecio.nuevaProcedencia || ''}
                          onChange={e => setEditandoPrecio({...editandoPrecio, nuevaProcedencia: e.target.value})} style={inp} />
                      )}
                    </div>

                    {/* Fila 2: Kg Factura / Kg Campo / % dif */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                      <div>
                        <Lbl c={S.accent}>Kg Factura</Lbl>
                        <input type="number" value={editandoPrecio.kg_factura} onChange={e => {
                          const kgF = e.target.value
                          const monto = editandoPrecio.monto_total
                          const precio = monto && kgF ? String(Math.round(parseFloat(monto) / parseFloat(kgF))) : editandoPrecio.precio_compra
                          setEditandoPrecio({...editandoPrecio, kg_factura: kgF, precio_compra: precio})
                        }} placeholder="Kg según factura" style={{...inpMono, border: `1px solid ${S.accent}`, fontWeight: 600}} />
                      </div>
                      <div>
                        <Lbl>Kg Campo (báscula)</Lbl>
                        <div style={{ padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, fontFamily: 'monospace', background: S.bg, color: S.muted, fontWeight: 600 }}>
                          {kgBas ? kgBas.toLocaleString('es-AR') : '—'}
                        </div>
                      </div>
                      <div>
                        <Lbl>% Diferencia</Lbl>
                        <div style={{ padding: '9px 12px', border: `1px solid ${alertaDiff ? '#F09595' : (diffPct !== null ? '#97C459' : S.border)}`, borderRadius: 6, fontSize: 13, fontFamily: 'monospace', background: alertaDiff ? S.redLight : (diffPct !== null ? S.greenLight : S.bg), fontWeight: 700, color: alertaDiff ? S.red : (diffPct !== null ? S.green : S.hint) }}>
                          {diffPct !== null ? `${diffPct > 0 ? '+' : ''}${diffPct.toFixed(1)}%${alertaDiff ? ' ⚠' : ' ✓'}` : '—'}
                        </div>
                        {alertaDiff && <div style={{ fontSize: 10, color: S.red, marginTop: 2 }}>Diferencia mayor al 3% — verificar</div>}
                      </div>
                    </div>

                    {/* Fila 3: Monto Total */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginBottom: 10 }}>
                      <div>
                        <Lbl c={S.accent}>Monto Total Compra $</Lbl>
                        <input type="number" value={editandoPrecio.monto_total} onChange={e => {
                          const monto = e.target.value
                          const kgF = parseFloat(editandoPrecio.kg_factura) || 0
                          const precio = monto && kgF ? String(Math.round(parseFloat(monto) / kgF)) : editandoPrecio.precio_compra
                          setEditandoPrecio({...editandoPrecio, monto_total: monto, precio_compra: precio})
                        }} placeholder="Total a pagar" style={{...inpMono, border: `1px solid ${S.accent}`, fontWeight: 600, maxWidth: 280}} />
                      </div>
                    </div>

                    {/* Fila 4: Plazo */}
                    <div style={{ marginBottom: 12 }}>
                      <Lbl>Plazo de pago (días)</Lbl>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {[30, 60, 90, 120].map(d => {
                          const plazosArr = (editandoPrecio.plazo_dias || '').split(',').filter(Boolean)
                          const activo = plazosArr.includes(String(d))
                          return (
                            <button key={d} onClick={() => {
                              const nuevos = activo ? plazosArr.filter(p => p !== String(d)) : [...plazosArr, String(d)].sort((a,b) => parseInt(a) - parseInt(b))
                              setEditandoPrecio({...editandoPrecio, plazo_dias: nuevos.join(',')})
                            }}
                              style={{ padding: '6px 14px', fontSize: 12, fontWeight: activo ? 700 : 400, borderRadius: 6, cursor: 'pointer', border: `1px solid ${activo ? S.accent : S.border}`, background: activo ? S.accentLight : 'transparent', color: activo ? S.accent : S.muted }}>
                              {d}d
                            </button>
                          )
                        })}
                        <input type="text" value={editandoPrecio.plazo_dias} onChange={e => setEditandoPrecio({...editandoPrecio, plazo_dias: e.target.value})}
                          placeholder="otro, ej. 45,75" style={{...inpMono, maxWidth: 130, fontSize: 12}} />
                      </div>
                      {editandoPrecio.plazo_dias && (
                        <div style={{ fontSize: 11, color: S.muted, marginTop: 6 }}>
                          Plazos acordados: {editandoPrecio.plazo_dias.split(',').filter(Boolean).map(d => `${d} días`).join(' · ')}
                          {l.fecha_ingreso && ' — Vencimientos: '}
                          {l.fecha_ingreso && editandoPrecio.plazo_dias.split(',').filter(Boolean).map(d =>
                            new Date(new Date(l.fecha_ingreso + 'T12:00:00').getTime() + parseInt(d) * 86400000).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
                          ).join(' · ')}
                        </div>
                      )}
                    </div>

                                        <div style={{ display: 'flex', gap: 8 }}>
                      <Btn onClick={() => guardarPrecio(l)} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</Btn>
                      <Btn ghost onClick={() => setEditandoPrecio(null)}>Cancelar</Btn>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${S.border}`, marginBottom: '1.5rem' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '10px 20px', fontSize: 13, fontWeight: tab === t.key ? 600 : 500, cursor: 'pointer', color: tab === t.key ? S.accent : S.muted, background: 'transparent', border: 'none', borderBottom: tab === t.key ? `2px solid ${S.accent}` : '2px solid transparent', marginBottom: -1, fontFamily: "'IBM Plex Sans', sans-serif" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB INGRESOS ── */}
      {tab === 'lista' && (
        <div>
          <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 800 }}>
              <thead>
                <tr style={{ background: S.bg }}>
                  {['Fecha', 'Corral', 'Procedencia', 'Categoría', 'Cantidad', 'Kg báscula', 'Kg factura', 'Diferencia', 'Precio/kg', 'Precio real $/kg', 'Total', 'Vto pago', ''].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 10, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lotes.length === 0 && (
                  <tr><td colSpan={12} style={{ padding: '3rem', textAlign: 'center', color: S.hint }}>No hay ingresos registrados.</td></tr>
                )}
                {lotes.map(l => {
                  const kgBas = l.kg_bascula || 0
                  const kgFac = l.kg_factura || 0
                  const diffKg = kgBas && kgFac ? kgBas - kgFac : null
                  const diffPct = diffKg !== null && kgFac > 0 ? (diffKg / kgFac * 100) : null
                  const alertaDiff = diffPct !== null && Math.abs(diffPct) > 3
                  const kgParaTotal = kgFac > 0 ? kgFac : kgBas
                  const ivaMontoCalc = l.monto_facturado != null ? Math.round(l.monto_facturado * (l.iva_pct || 10.5) / 100) : (l.iva_monto || 0)
                  const totalGC = (l.monto_facturado != null || l.monto_negro != null)
                    ? (l.monto_facturado || 0) + ivaMontoCalc + (l.monto_negro || 0)
                    : null
                  const total = totalGC || l.monto_total_con_iva || (kgParaTotal && l.precio_compra ? Math.round(kgParaTotal * l.precio_compra) : null)
                  const vtoColor = l.fecha_vencimiento_pago && new Date(l.fecha_vencimiento_pago) < new Date() ? S.red : S.muted
                  return (
                    <tr key={l.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, color: S.muted, whiteSpace: 'nowrap' }}>
                        {l.fecha_ingreso ? new Date(l.fecha_ingreso + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>C-{corrales.find(c => c.id === l.corral_cuarentena_id)?.numero || l.corral_cuarentena_id || '—'}</td>
                      <td style={{ padding: '8px 12px', color: S.muted }}>{l.procedencia || '—'}</td>
                      <td style={{ padding: '8px 12px', fontSize: 11, color: S.muted }}>{l.categoria || '—'}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', textAlign: 'right' }}>{l.cantidad?.toLocaleString('es-AR') || '—'}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', textAlign: 'right', color: S.muted }}>{kgBas ? kgBas.toLocaleString('es-AR') : '—'}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', textAlign: 'right', fontWeight: kgFac ? 600 : 400, color: kgFac ? S.text : S.hint }}>{kgFac ? kgFac.toLocaleString('es-AR') : '—'}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', textAlign: 'right' }}>
                        {diffPct !== null ? (
                          <span style={{ color: alertaDiff ? S.red : S.green, fontWeight: alertaDiff ? 700 : 400 }}>
                            {diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}%{alertaDiff ? ' ⚠' : ''}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', textAlign: 'right', color: l.precio_compra ? S.text : S.hint }}>
                        {l.precio_compra ? `$${l.precio_compra.toLocaleString('es-AR')}` : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', textAlign: 'right' }}>
                        {(() => {
                          if (!kgParaTotal || (l.monto_facturado == null && l.monto_negro == null)) return <span style={{ color: S.hint }}>—</span>
                          const real = Math.round(((l.monto_facturado || 0) + (l.monto_negro || 0) - (l.comision_monto || 0)) / kgParaTotal)
                          return `$${real.toLocaleString('es-AR')}`
                        })()}
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', textAlign: 'right', fontWeight: 600, color: total ? S.red : S.hint }}>
                        {total ? `-$${total.toLocaleString('es-AR')}` : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, color: vtoColor, whiteSpace: 'nowrap' }}>
                        {l.fecha_vencimiento_pago ? new Date(l.fecha_vencimiento_pago + 'T12:00:00').toLocaleDateString('es-AR') : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        {esDueno && (
                          <>
                            <button onClick={() => { setEditandoPrecio({
                              id: l.id,
                              kg_factura: l.kg_factura ? String(l.kg_factura) : '',
                              precio_compra: l.precio_compra ? String(l.precio_compra) : '',
                              monto_total: l.monto_total_con_iva ? String(l.monto_total_con_iva) : '',
                              monto_facturado: l.monto_facturado ? String(l.monto_facturado) : '',
                              paralelo: (l.monto_total_con_iva && l.monto_facturado) ? String(Math.max(0, l.monto_total_con_iva - l.monto_facturado)) : '',
                              plazo_dias: l.plazo_dias ? String(l.plazo_dias) : '',
                              comision_monto: l.comision_monto ? String(l.comision_monto) : '',
                              comision_a_quien: l.comision_a_quien || '',
                              comision_es_paralela: l.comision_es_paralela || false,
                              procedencia: l.procedencia || '',
                              nuevaProcedencia: '',
                              cuotas_pago: (l.cuotas_pago || []).map(c => ({ fecha: c.fecha, monto: String(c.monto) })),
                            }) }}
                              style={{ padding: '3px 8px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer', marginRight: 4 }}>Editar</button>
                            <button onClick={() => eliminarLote(l.id)}
                              style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB GESTIÓN COMERCIAL ── */}
      {tab === 'gestion' && (
        <GestionComercial lotes={lotes} corrales={corrales} esDueno={esDueno} cargarDatos={cargarDatos} contactos={contactos} />
      )}

      {/* ── TAB CALCULADORA ── */}
      {tab === 'calculadora' && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Calculadora de precio máximo de compra</div>
          <div style={{ fontSize: 12, color: S.muted, marginBottom: '1.5rem' }}>Ingresá los parámetros estimados y el sistema calcula el precio máximo a pagar por kg en la compra</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: S.green, textTransform: 'uppercase', marginBottom: '1rem' }}>Venta estimada</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Precio venta $/kg vivo', key: 'precio_venta', placeholder: '4250' },
                    { label: 'Kg venta por animal', key: 'kg_venta', placeholder: '380' },
                    { label: 'Desbaste venta %', key: 'desbaste_venta', placeholder: '8' },
                    { label: 'Flete venta $/animal', key: 'flete_venta', placeholder: '0' },
                    { label: 'Comisión venta %', key: 'comision_venta_pct', placeholder: '0' },
                  ].map(f => (
                    <div key={f.key}>
                      <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>{f.label}</div>
                      <input type="number" value={calc[f.key]} onChange={e => setCalc({...calc, [f.key]: e.target.value})} placeholder={f.placeholder}
                        style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.bg, boxSizing: 'border-box', fontFamily: 'monospace' }} />
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: S.accent, textTransform: 'uppercase', marginBottom: '1rem' }}>Parámetros feedlot</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Kg compra por animal', key: 'kg_compra', placeholder: '267' },
                    { label: 'Aumento diario kg', key: 'aumento_diario', placeholder: '1.25' },
                    { label: 'Conversión MF/kg carne', key: 'conversion_mf', placeholder: '6.8' },
                    { label: 'Costo dieta $/kg comida', key: 'costo_dieta', placeholder: '220' },
                  ].map(f => (
                    <div key={f.key}>
                      <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>{f.label}</div>
                      <input type="number" value={calc[f.key]} onChange={e => setCalc({...calc, [f.key]: e.target.value})} placeholder={f.placeholder}
                        style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.bg, boxSizing: 'border-box', fontFamily: 'monospace' }} />
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: S.red, textTransform: 'uppercase', marginBottom: '1rem' }}>Gastos por animal</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Sanidad $/animal', key: 'sanidad_animal', placeholder: '9500' },
                    { label: 'Gastos fijos $/animal/mes', key: 'gastos_fijos_mes', placeholder: '20000' },
                    { label: 'Flete compra $/animal', key: 'flete_compra', placeholder: '12000' },
                    { label: 'Comisión compra %', key: 'comision_compra_pct', placeholder: '0' },
                  ].map(f => (
                    <div key={f.key}>
                      <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>{f.label}</div>
                      <input type="number" value={calc[f.key]} onChange={e => setCalc({...calc, [f.key]: e.target.value})} placeholder={f.placeholder}
                        style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.bg, boxSizing: 'border-box', fontFamily: 'monospace' }} />
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: S.amber, textTransform: 'uppercase', marginBottom: 8 }}>Rentabilidad anual deseada %</div>
                <input type="number" value={calc.margen_deseado} onChange={e => setCalc({...calc, margen_deseado: e.target.value})} placeholder="15"
                  style={{ width: '100%', border: `1px solid ${S.amber}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.bg, boxSizing: 'border-box', fontFamily: 'monospace', fontWeight: 600 }} />
              </div>
            </div>
            <div>
              {(() => {
                const pV=parseFloat(calc.precio_venta)||0, kgV=parseFloat(calc.kg_venta)||0
                const desbaste=parseFloat(calc.desbaste_venta)/100||0.08
                const kgC=parseFloat(calc.kg_compra)||0
                const aumDia=parseFloat(calc.aumento_diario)||1.25
                const convMF=parseFloat(calc.conversion_mf)||6.8
                const costDieta=parseFloat(calc.costo_dieta)||220
                const sanidad=parseFloat(calc.sanidad_animal)||9500
                const gfMes=parseFloat(calc.gastos_fijos_mes)||20000
                const flC=parseFloat(calc.flete_compra)||0
                const flV=parseFloat(calc.flete_venta)||0
                const comV=parseFloat(calc.comision_venta_pct)/100||0
                const comC=parseFloat(calc.comision_compra_pct)/100||0
                const margen=parseFloat(calc.margen_deseado)/100||0.15
                if (!pV||!kgV||!kgC) return (
                  <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '2rem', textAlign: 'center', color: S.hint }}>
                    Completá precio de venta, kg venta y kg compra para ver el cálculo.
                  </div>
                )
                const kgNetoV=kgV*(1-desbaste)
                const aumento=kgV-kgC
                const dias=aumDia>0?Math.round(aumento/aumDia):0
                const meses=dias/30
                const kgComida=aumento*convMF
                const costComida=kgComida*costDieta
                const gfTotal=gfMes*meses
                const comVMonto=kgNetoV*pV*comV
                const comCMonto=kgC*comC
                const ingresoNeto=kgNetoV*pV-flV-comVMonto
                const costosSinCompra=costComida+sanidad+gfTotal+flC+comCMonto
                const precioMaxEq=(ingresoNeto-costosSinCompra)/kgC
                const factorM=1+(margen*meses/12)
                const precioMaxConM=(ingresoNeto-costosSinCompra*factorM)/(kgC*factorM)
                const costos=[
                  {label:'Alimentación', val:Math.round(costComida)},
                  {label:'Sanidad', val:Math.round(sanidad)},
                  {label:'Gastos fijos', val:Math.round(gfTotal)},
                  {label:'Flete compra', val:Math.round(flC)},
                  {label:'Flete venta', val:Math.round(flV)},
                  {label:'Comisión venta', val:Math.round(comVMonto)},
                ].filter(c=>c.val>0)
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                      {[
                        {label:'Días feedlot', val:`${dias} días`, sub:`${meses.toFixed(1)} meses`},
                        {label:'Aumento total', val:`${aumento} kg`, sub:`${kgC} a ${kgV} kg`},
                        {label:'Kg comida total', val:`${Math.round(kgComida).toLocaleString('es-AR')} kg`, sub:`Conv. ${convMF}`},
                      ].map((c,i)=>(
                        <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem' }}>
                          <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>{c.label}</div>
                          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'monospace', color: S.accent }}>{c.val}</div>
                          <div style={{ fontSize: 11, color: S.hint }}>{c.sub}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: S.red, textTransform: 'uppercase', marginBottom: '1rem' }}>Costos sin compra</div>
                      {costos.map((c,i)=>(
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0', borderBottom: `1px solid ${S.border}` }}>
                          <span style={{ color: S.muted }}>{c.label}</span>
                          <span style={{ fontFamily: 'monospace', color: S.red }}>-${c.val.toLocaleString('es-AR')}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 0', fontWeight: 700 }}>
                        <span>Total costos sin compra</span>
                        <span style={{ fontFamily: 'monospace', color: S.red }}>-${Math.round(costosSinCompra).toLocaleString('es-AR')}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0', borderTop: `1px solid ${S.border}` }}>
                        <span style={{ color: S.green }}>Ingreso neto venta</span>
                        <span style={{ fontFamily: 'monospace', color: S.green }}>+${Math.round(ingresoNeto).toLocaleString('es-AR')}</span>
                      </div>
                    </div>
                    <div style={{ background: S.accent, borderRadius: 10, padding: '1.5rem', color: '#fff' }}>
                      <div style={{ fontSize: 12, textTransform: 'uppercase', opacity: 0.7, marginBottom: 8 }}>Precio máximo de compra — Punto de equilibrio</div>
                      <div style={{ fontSize: 36, fontWeight: 800, fontFamily: 'monospace' }}>${Math.max(0,Math.round(precioMaxEq)).toLocaleString('es-AR')}</div>
                      <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>por kg vivo</div>
                      <div style={{ height: 1, background: 'rgba(255,255,255,0.2)', margin: '12px 0' }} />
                      <div style={{ fontSize: 12, textTransform: 'uppercase', opacity: 0.7, marginBottom: 6 }}>Con rentabilidad del {calc.margen_deseado}% anual</div>
                      <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'monospace' }}>${Math.max(0,Math.round(precioMaxConM)).toLocaleString('es-AR')}</div>
                      <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>por kg vivo</div>
                    </div>
                    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: S.muted, textTransform: 'uppercase', marginBottom: '1rem' }}>Sensibilidad — precio compra vs rentabilidad</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead><tr style={{ background: S.bg }}>
                          {['Precio compra $/kg','Costo total','Ingreso neto','Ganancia','Rent. anual'].map(h=>(
                            <th key={h} style={{ padding:'6px 10px', textAlign:'right', fontWeight:600, color:S.muted, fontSize:10, textTransform:'uppercase', borderBottom:`1px solid ${S.border}` }}>{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {[0.85,0.90,0.95,1.0,1.05,1.10].map(factor=>{
                            const pC=Math.round(precioMaxEq*factor)
                            const cTotal=pC*kgC+costosSinCompra
                            const gan=ingresoNeto-cTotal
                            const rentA=meses>0?((gan/cTotal)*(12/meses)*100):0
                            const esRef=factor===1.0
                            return (
                              <tr key={factor} style={{ borderBottom:`1px solid ${S.border}`, background:esRef?S.accentLight:'transparent' }}>
                                <td style={{ padding:'6px 10px', textAlign:'right', fontFamily:'monospace', fontWeight:esRef?700:400 }}>${pC.toLocaleString('es-AR')}</td>
                                <td style={{ padding:'6px 10px', textAlign:'right', fontFamily:'monospace', color:S.red }}>-${cTotal.toLocaleString('es-AR')}</td>
                                <td style={{ padding:'6px 10px', textAlign:'right', fontFamily:'monospace', color:S.green }}>+${Math.round(ingresoNeto).toLocaleString('es-AR')}</td>
                                <td style={{ padding:'6px 10px', textAlign:'right', fontFamily:'monospace', fontWeight:600, color:gan>=0?S.green:S.red }}>{gan>=0?'+':''}{Math.round(gan).toLocaleString('es-AR')}</td>
                                <td style={{ padding:'6px 10px', textAlign:'right', fontFamily:'monospace', fontWeight:600, color:rentA>=0?S.green:S.red }}>{rentA.toFixed(1)}%</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ── GESTIÓN COMERCIAL (componente separado) ──

function generarReciboCompra(lote, pagos, corrales) {
  const fecha = pagos[0]?.fecha ? new Date(pagos[0].fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : new Date().toLocaleDateString('es-AR')
  const proveedor = lote.procedencia || ''
  const totalMonto = pagos.reduce((s, p) => s + (p.monto || 0), 0)
  const entero = Math.floor(totalMonto)
  const unidades = ['','UN','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE','DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISÉIS','DIECISIETE','DIECIOCHO','DIECINUEVE']
  const decenas = ['','','VEINTE','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA']
  const centenas = ['','CIEN','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS','SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS']
  function nAL(n) {
    if (n === 0) return 'CERO'; let r = ''
    if (n >= 1000000) { const m = Math.floor(n/1000000); r += (m===1?'UN MILLÓN ':nAL(m)+' MILLONES '); n %= 1000000 }
    if (n >= 1000) { const m = Math.floor(n/1000); r += (m===1?'MIL ':nAL(m)+' MIL '); n %= 1000 }
    if (n >= 100) { r += (n===100?'CIEN ':centenas[Math.floor(n/100)]+' '); n %= 100 }
    if (n >= 20) { r += decenas[Math.floor(n/10)]; if (n%10>0) r += ' Y '+unidades[n%10]; r += ' ' }
    else if (n > 0) r += unidades[n]+' '
    return r.trim()
  }
  const centavos = Math.round((totalMonto - entero) * 100)
  const enLetras = nAL(entero) + ' PESOS' + (centavos > 0 ? ' CON ' + nAL(centavos) + ' CENTAVOS' : '') + '.-'
  const corralNum = corrales.find(c => c.id === lote.corral_cuarentena_id)?.numero || ''
  const concepto = `Compra hacienda — ${lote.procedencia || ''} ${lote.categoria || ''} · ${lote.cantidad || ''} cabezas · C-${corralNum}`

  const filasPago = pagos.map(p => {
    let desc = p.forma_pago === 'transferencia' ? 'TRANSFERENCIA' : p.forma_pago === 'efectivo' ? 'EFECTIVO' : p.forma_pago === 'cuenta_corriente' ? 'CUENTA CORRIENTE' : p.forma_pago === 'e-cheq' ? 'E-CHEQ' : (p.forma_pago || '').toUpperCase()
    if (p.es_negro) desc += ' (PARALELO)'
    return `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${desc}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${p.numero_cheque || ''}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${p.fecha_vencimiento_cheque ? new Date(p.fecha_vencimiento_cheque+'T12:00:00').toLocaleDateString('es-AR') : ''}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">$${(p.monto||0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
    </tr>`
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
      <tr><td style="padding:4px 8px;width:50%;">Nombre: <strong>${proveedor}</strong></td><td style="padding:4px 8px;">I.V.A.: ${lote.proveedor_iva || ''}</td></tr>
      <tr><td style="padding:4px 8px;">Localidad: ${lote.proveedor_localidad || ''}</td><td style="padding:4px 8px;">CUIT/DNI: ${lote.proveedor_cuit || ''}</td></tr>
      <tr><td style="padding:4px 8px;">C.B.U: ${lote.proveedor_cbu || ''}</td><td style="padding:4px 8px;">FECHA &nbsp;<strong>${fecha}</strong></td></tr>
    </table>
    <table style="width:100%;border:1px solid #333;border-top:none;border-collapse:collapse;">
      <tr><td colspan="2" style="padding:4px 8px;font-weight:bold;background:#f5f5f5;border-bottom:1px solid #333;">Concepto</td></tr>
      <tr><td colspan="2" style="padding:6px 8px;">${concepto}</td></tr>
    </table>
    <table style="width:100%;border:1px solid #333;border-top:none;border-collapse:collapse;">
      <tr><td colspan="4" style="padding:4px 8px;font-weight:bold;background:#f5f5f5;border-bottom:1px solid #333;">Medio de pago</td></tr>
      <tr style="background:#eee;">
        <th style="padding:6px 8px;text-align:left;border-bottom:1px solid #333;font-size:11px;">DESCRIPCIÓN</th>
        <th style="padding:6px 8px;text-align:center;border-bottom:1px solid #333;font-size:11px;">NRO/CHEQUE</th>
        <th style="padding:6px 8px;text-align:center;border-bottom:1px solid #333;font-size:11px;">FECHA COBRO</th>
        <th style="padding:6px 8px;text-align:right;border-bottom:1px solid #333;font-size:11px;">IMPORTE</th>
      </tr>
      ${filasPago}
      <tr style="border-top:1px solid #333;"><td colspan="3" style="padding:8px;text-align:right;font-weight:bold;">IMPORTE TOTAL &nbsp; $</td><td style="padding:8px;text-align:right;font-weight:bold;">${totalMonto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td></tr>
    </table>
    <table style="width:100%;border:1px solid #333;border-top:none;border-collapse:collapse;">
      <tr><td style="padding:6px 8px;">Cantidad de pesos: &nbsp;${enLetras}</td></tr>
      <tr><td style="padding:20px 8px 30px 8px;">&nbsp;</td></tr>
      <tr><td style="padding:8px;"><table style="width:100%;"><tr><td style="width:40%;text-align:center;border-top:1px solid #333;">Firma</td><td style="width:20%;"></td><td style="width:40%;text-align:center;border-top:1px solid #333;">DNI</td></tr></table></td></tr>
    </table>
  </div>`

  const win = window.open('', '_blank')
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Recibo pago hacienda</title><style>@media print{.no-print{display:none;}}body{font-family:Arial,sans-serif;background:#fff;padding:10px;}</style></head><body>
    <div style="text-align:right;margin-bottom:10px;" class="no-print"><button onclick="window.print()" style="padding:8px 20px;font-size:14px;cursor:pointer;background:#1A3D6B;color:#fff;border:none;border-radius:6px;">🖨️ Imprimir / Guardar PDF</button></div>
    ${bloque}<div style="border-top:2px dashed #999;margin:16px 0;text-align:center;font-size:11px;color:#999;padding:4px 0;">✂ &nbsp;&nbsp; CORTAR AQUÍ &nbsp;&nbsp; ✂</div>${bloque}
  </body></html>`)
  win.document.close()
}

function GestionComercial({ lotes, corrales, esDueno, cargarDatos, contactos }) {
  const S = {
    bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6', muted: '#6B6760', hint: '#9E9A94', text: '#1A1916',
    accent: '#378ADD', accentLight: '#E8EFF8', green: '#1E5C2E', greenLight: '#E8F4EB',
    red: '#7A1A1A', redLight: '#FDF0F0', amber: '#7A4500', amberLight: '#FDF0E0', purple: '#3D1A6B', purpleLight: '#F0EAFB',
  }
  const inp = { width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.surface, boxSizing: 'border-box' }
  const Lbl = ({ children, c }) => <label style={{ fontSize: 11, fontWeight: 600, color: c || S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>{children}</label>

  const [editandoFactura, setEditandoFactura] = useState(null)
  const [formFactura, setFormFactura] = useState({ numero_factura: '', fecha_factura: '', monto_facturado: '', iva_pct: '10.5', observaciones_pago: '', proveedor: '', localidad: '', cuit: '', iva: '', cbu: '', cuotas_pago: [] })
  const [pagosMap, setPagosMap] = useState({})
  const [chequesCartera, setChequesCartera] = useState([])
  const PAGO_INIT = { tipo: 'transferencia', monto: '', es_paralela: false, subtipo_cheque: '', cheque_propio: { numero: '', banco: '', fecha_vencimiento: '' }, cheque_tercero_ids: [] }
  const [registrandoPago, setRegistrandoPago] = useState(null)
  const [formPago, setFormPago] = useState({ fecha: new Date().toISOString().split('T')[0], pagos: [{...PAGO_INIT}] })
  const [pagosExpandidos, setPagosExpandidos] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [mostrarArchivadas, setMostrarArchivadas] = useState(false)
  const [filtroArchivadas, setFiltroArchivadas] = useState({ proveedor: '', desde: '', hasta: '' })

  useEffect(() => { cargarPagos() }, [lotes])

  async function cargarPagos() {
    if (!lotes.length) return
    const ids = lotes.map(l => l.id)
    const [{ data }, { data: ch }] = await Promise.all([
      supabase.from('pagos_compras').select('*').in('lote_id', ids).order('fecha'),
      supabase.from('cheques').select('*').eq('tipo', 'recibido').eq('estado', 'en_cartera').order('fecha_vencimiento', { ascending: true }),
    ])
    const map = {}
    ;(data || []).forEach(p => {
      if (!map[p.lote_id]) map[p.lote_id] = []
      map[p.lote_id].push(p)
    })
    setPagosMap(map)
    setChequesCartera(ch || [])
  }

  function totalLoteCalc(l) {
    const ivaMontoCalc = l.monto_facturado != null ? Math.round(l.monto_facturado * (l.iva_pct || 10.5) / 100) : (l.iva_monto || 0)
    const totalGC = (l.monto_facturado != null || l.monto_negro != null) ? (l.monto_facturado || 0) + ivaMontoCalc + (l.monto_negro || 0) : null
    const kgBase = l.kg_factura > 0 ? l.kg_factura : l.kg_bascula
    return totalGC || l.monto_total_con_iva || (l.precio_compra && kgBase ? Math.round(kgBase * l.precio_compra) : 0)
  }

  async function guardarFactura(lote) {
    const montoFact = formFactura.monto_facturado !== '' ? parseFloat(formFactura.monto_facturado) : null
    const ivaPct = parseFloat(formFactura.iva_pct || 10.5)
    const ivaMonto = montoFact != null ? Math.round(montoFact * ivaPct / 100) : 0
    const totalFactura = montoFact != null ? montoFact + ivaMonto : null
    const montoTotal = lote.monto_total_con_iva || null
    const montoNegro = montoTotal != null && totalFactura != null ? Math.max(0, montoTotal - totalFactura) : null
    await supabase.from('lotes').update({
      numero_factura: formFactura.numero_factura || null,
      fecha_factura: formFactura.fecha_factura || null,
      monto_facturado: montoFact,
      iva_pct: ivaPct,
      iva_monto: ivaMonto,
      monto_negro: montoNegro,
      observaciones_pago: formFactura.observaciones_pago || null,
      procedencia: formFactura.proveedor || lote.procedencia || null,
      proveedor_localidad: formFactura.localidad || null,
      proveedor_cuit: formFactura.cuit || null,
      proveedor_iva: formFactura.iva || null,
      proveedor_cbu: formFactura.cbu || null,
      cuotas_pago: (formFactura.cuotas_pago || []).filter(c => c.fecha && c.monto).map(c => ({ fecha: c.fecha, monto: parseFloat(c.monto) })),
    }).eq('id', lote.id)
    setEditandoFactura(null)
    await cargarDatos()
  }

  function renderFormFactura(l) {
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div><Lbl>N° Factura</Lbl><input type="text" value={formFactura.numero_factura} onChange={e => setFormFactura({...formFactura, numero_factura: e.target.value})} style={inp} /></div>
          <div><Lbl>Fecha Factura</Lbl><input type="date" value={formFactura.fecha_factura} onChange={e => setFormFactura({...formFactura, fecha_factura: e.target.value})} style={inp} /></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <Lbl>Neto Facturado $</Lbl>
            <input type="number" value={formFactura.monto_facturado} onChange={e => setFormFactura({...formFactura, monto_facturado: e.target.value})}
              style={{ ...inp, fontFamily: 'monospace' }} placeholder="Monto sin IVA" />
          </div>
          <div>
            <Lbl>IVA %</Lbl>
            <select value={formFactura.iva_pct} onChange={e => setFormFactura({...formFactura, iva_pct: e.target.value})} style={inp}>
              <option value="0">Sin IVA</option>
              <option value="10.5">10.5%</option>
              <option value="21">21%</option>
            </select>
          </div>
          <div>
            <Lbl>Cuenta paralela (calculada)</Lbl>
            {(() => {
              const montoFact = formFactura.monto_facturado !== '' ? (parseFloat(formFactura.monto_facturado) || 0) : null
              const ivaPct = parseFloat(formFactura.iva_pct || 10.5)
              const ivaMonto = montoFact != null ? Math.round(montoFact * ivaPct / 100) : 0
              const totalFact = montoFact != null ? montoFact + ivaMonto : null
              const montoTotalOp = l.monto_total_con_iva || 0
              const paralelo = totalFact != null ? Math.max(0, montoTotalOp - totalFact) : 0
              return (
                <div style={{ padding: '9px 12px', border: `1px solid ${paralelo > 0 ? '#9B59B6' : S.border}`, borderRadius: 6, fontSize: 13, fontFamily: 'monospace', background: paralelo > 0 ? '#F3E8FF' : S.bg, fontWeight: 700, color: paralelo > 0 ? S.purple : S.hint }}>
                  {paralelo > 0 ? `$${paralelo.toLocaleString('es-AR')}` : (totalFact != null ? '$0' : '—')}
                </div>
              )
            })()}
          </div>
        </div>

        <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 7, padding: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 8 }}>Seleccionar de contactos</div>
          <select onChange={e => {
            const ct = (contactos || []).find(c => String(c.id) === e.target.value)
            if (ct) setFormFactura({...formFactura, proveedor: ct.nombre, cuit: ct.cuit || '', localidad: ct.localidad || '', iva: ct.iva || '', cbu: ct.cbu || ''})
          }} style={inp} defaultValue="">
            <option value="">— Seleccionar contacto —</option>
            {(contactos || []).map(c => <option key={c.id} value={c.id}>{c.nombre}{c.cuit ? ` · ${c.cuit}` : ''}</option>)}
          </select>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
            <div><Lbl>Nombre</Lbl><input type="text" value={formFactura.proveedor || ''} onChange={e => setFormFactura({...formFactura, proveedor: e.target.value})} style={inp} /></div>
            <div><Lbl>Localidad</Lbl><input type="text" value={formFactura.localidad || ''} onChange={e => setFormFactura({...formFactura, localidad: e.target.value})} style={inp} /></div>
            <div><Lbl>CUIT</Lbl><input type="text" value={formFactura.cuit || ''} onChange={e => setFormFactura({...formFactura, cuit: e.target.value})} style={inp} /></div>
            <div><Lbl>IVA</Lbl><input type="text" value={formFactura.iva || ''} onChange={e => setFormFactura({...formFactura, iva: e.target.value})} style={inp} /></div>
            <div><Lbl>CBU</Lbl><input type="text" value={formFactura.cbu || ''} onChange={e => setFormFactura({...formFactura, cbu: e.target.value})} style={inp} /></div>
          </div>
        </div>

        <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 7, padding: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 8 }}>Cuotas de pago (según factura)</div>
          {(formFactura.cuotas_pago || []).map((cuota, ci) => (
            <div key={ci} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <input type="date" value={cuota.fecha || ''} onChange={e => {
                const nuevas = [...formFactura.cuotas_pago]
                nuevas[ci] = { ...nuevas[ci], fecha: e.target.value }
                setFormFactura({...formFactura, cuotas_pago: nuevas})
              }} style={{...inp, maxWidth: 160}} />
              <input type="number" value={cuota.monto || ''} onChange={e => {
                const nuevas = [...formFactura.cuotas_pago]
                nuevas[ci] = { ...nuevas[ci], monto: e.target.value }
                setFormFactura({...formFactura, cuotas_pago: nuevas})
              }} placeholder="Monto $" style={{...inp, maxWidth: 160}} />
              <button onClick={() => setFormFactura({...formFactura, cuotas_pago: formFactura.cuotas_pago.filter((_, i) => i !== ci)})}
                style={{ padding: '7px 10px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>✕</button>
            </div>
          ))}
          <button onClick={() => setFormFactura({...formFactura, cuotas_pago: [...(formFactura.cuotas_pago || []), { fecha: '', monto: '' }]})}
            style={{ padding: '5px 12px', fontSize: 12, background: 'transparent', border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 6, cursor: 'pointer' }}>
            + Agregar cuota
          </button>
          {(formFactura.cuotas_pago || []).length > 0 && (
            <div style={{ fontSize: 11, color: S.muted, marginTop: 6 }}>
              Total cuotas: ${(formFactura.cuotas_pago || []).reduce((s, c) => s + (parseFloat(c.monto) || 0), 0).toLocaleString('es-AR')}
            </div>
          )}
        </div>

        <div>
          <Lbl>Observaciones</Lbl>
          <input type="text" value={formFactura.observaciones_pago || ''} onChange={e => setFormFactura({...formFactura, observaciones_pago: e.target.value})} style={{...inp, marginBottom: 10}} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => guardarFactura(l)} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>Guardar</button>
          <button onClick={() => setEditandoFactura(null)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
        </div>
      </div>
    )
  }

  async function registrarPago(lote) {
    const totalPagos = formPago.pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
    if (!totalPagos) { alert('Ingresá el monto'); return }
    setGuardando(true)

    const totalLote = totalLoteCalc(lote)
    const pagosActuales = pagosMap[lote.id] || []

    for (const pago of formPago.pagos) {
      const monto = parseFloat(pago.monto) || 0
      if (!monto) continue
      const formaPago = pago.subtipo_cheque ? 'e-cheq' : pago.tipo
      let desc = `Pago compra ${lote.procedencia || ''} C-${corrales.find(c => c.id === lote.corral_cuarentena_id)?.numero || lote.corral_cuarentena_id}`
      if (pago.subtipo_cheque === 'tercero' && pago.cheque_tercero_ids?.length > 0) {
        const detalleCheques = pago.cheque_tercero_ids.map(chId => {
          const ch = chequesCartera.find(c => String(c.id) === chId)
          return ch ? `#${ch.numero || 's/n'} ${ch.banco || ''} vto.${ch.fecha_vencimiento ? new Date(ch.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR') : '—'}` : null
        }).filter(Boolean).join(', ')
        desc += ` — Entregado a ${lote.procedencia || 'proveedor'}: cheque(s) ${detalleCheques}`
      }

      const { data: pagoInsertado } = await supabase.from('pagos_compras').insert({
        lote_id: lote.id, fecha: formPago.fecha, monto,
        forma_pago: formaPago,
        cuota_idx: formPago.cuota_idx ?? null,
        numero_cheque: pago.subtipo_cheque === 'propio' ? pago.cheque_propio.numero || null : null,
        banco: pago.subtipo_cheque === 'propio' ? pago.cheque_propio.banco || null : null,
        fecha_vencimiento_cheque: pago.subtipo_cheque === 'propio' ? pago.cheque_propio.fecha_vencimiento || null : null,
        es_negro: pago.es_paralela || false,
        descripcion: desc,
      }).select().single()

      let pagoCajaId = null
      if (pago.es_paralela) {
        const { data: cp } = await supabase.from('caja_paralela').insert({ fecha: formPago.fecha, tipo: 'egreso', descripcion: desc, monto, pago_compra_id: pagoInsertado?.id }).select().single()
        pagoCajaId = cp?.id || null
      } else {
        const { data: co } = await supabase.from('caja_oficial').insert({ fecha: formPago.fecha, tipo: 'egreso', categoria: 'Pago compra hacienda', descripcion: desc, monto, forma_pago: formaPago, pago_compra_id: pagoInsertado?.id }).select().single()
        pagoCajaId = co?.id || null
      }

      if (pago.subtipo_cheque === 'propio' && pago.cheque_propio.fecha_vencimiento) {
        await supabase.from('cheques').insert({ tipo: 'emitido', numero: pago.cheque_propio.numero || null, banco: pago.cheque_propio.banco || null, monto, fecha_cobro: formPago.fecha, fecha_vencimiento: pago.cheque_propio.fecha_vencimiento, beneficiario: lote.procedencia || null, estado: 'en_cartera', es_paralelo: pago.es_paralela || false, caja_oficial_id: pagoCajaId, pago_compra_id: pagoInsertado?.id })
      } else if (pago.subtipo_cheque === 'tercero' && pago.cheque_tercero_ids?.length > 0) {
        for (const chId of pago.cheque_tercero_ids) {
          await supabase.from('cheques').update({ estado: 'entregado', beneficiario: lote.procedencia || null }).eq('id', parseInt(chId))
        }
      }
    }

    const totalPagado = pagosActuales.reduce((s, p) => s + (p.monto || 0), 0) + totalPagos
    const nuevoEstado = totalLote && totalPagado > 0 && totalPagado >= totalLote * 0.99 ? 'pagado' : 'pendiente'
    await supabase.from('lotes').update({ estado_pago: nuevoEstado }).eq('id', lote.id)

    setRegistrandoPago(null)
    setFormPago({ fecha: new Date().toISOString().split('T')[0], pagos: [{...PAGO_INIT}] })
    setGuardando(false)
    await cargarDatos()
    await cargarPagos()
  }

  async function eliminarPago(p, l, pagos, total) {
    if (!confirm('¿Eliminar este pago? Se eliminará de la caja y se revertirán los cheques usados.')) return
    const { data: chAsoc } = await supabase.from('cheques').select('id').eq('pago_compra_id', p.id).eq('tipo', 'emitido').maybeSingle()
    if (chAsoc) await supabase.from('cheques').delete().eq('id', chAsoc.id)
    if (p.descripcion && p.descripcion.includes('Entregado a')) {
      const matchNums = [...p.descripcion.matchAll(/#(\S+)/g)].map(m => m[1]).filter(n => n !== 's/n')
      for (const num of matchNums) {
        await supabase.from('cheques').update({ estado: 'en_cartera', beneficiario: null }).eq('numero', num).eq('estado', 'entregado')
      }
    }
    await supabase.from('caja_oficial').delete().eq('pago_compra_id', p.id)
    await supabase.from('caja_paralela').delete().eq('pago_compra_id', p.id)
    await supabase.from('pagos_compras').delete().eq('id', p.id)
    const pagosRest = pagos.filter(pp => pp.id !== p.id)
    const totalPagadoRest = pagosRest.reduce((s, pp) => s + (pp.monto || 0), 0)
    const nuevoEstado = total && totalPagadoRest > 0 && totalPagadoRest >= total * 0.99 ? 'pagado' : 'pendiente'
    await supabase.from('lotes').update({ estado_pago: nuevoEstado }).eq('id', l.id)
    await cargarDatos()
    await cargarPagos()
  }

  const hoy40 = new Date(Date.now() - 40 * 86400000)
  const lotesActivos = lotes.filter(l => !(l.estado_pago === 'pagado' && l.created_at && new Date(l.created_at) < hoy40))
  const lotesArchivados = lotes.filter(l => l.estado_pago === 'pagado' && l.created_at && new Date(l.created_at) < hoy40)
  const archFiltrados = lotesArchivados.filter(l => {
    if (filtroArchivadas.proveedor && !((l.procedencia || '').toLowerCase().includes(filtroArchivadas.proveedor.toLowerCase()))) return false
    if (filtroArchivadas.desde && (l.fecha_ingreso || '') < filtroArchivadas.desde) return false
    if (filtroArchivadas.hasta && (l.fecha_ingreso || '') > filtroArchivadas.hasta) return false
    return true
  })

  const ESTADOS = { pendiente: { bg: S.amberLight, color: S.amber, label: 'Pendiente' }, precio_cargado: { bg: S.accentLight, color: S.accent, label: 'Precio cargado' }, facturado: { bg: S.purpleLight, color: S.purple, label: 'Facturado' }, pagado: { bg: S.greenLight, color: S.green, label: 'Pagado' } }

  function estadoDeLote(l, total, totalPagado) {
    if (l.estado_pago === 'pagado') return 'pagado'
    if (l.numero_factura || l.monto_facturado != null) return 'facturado'
    if (l.precio_compra || l.monto_total_con_iva) return 'precio_cargado'
    return 'pendiente'
  }

  return (
    <div>
      {/* Vencimientos próximos */}
      {lotesActivos.filter(l => l.fecha_vencimiento_pago && l.estado_pago !== 'pagado' && new Date(l.fecha_vencimiento_pago) <= new Date(Date.now() + 7 * 86400000)).length > 0 && (
        <div style={{ background: S.redLight, border: '1px solid #F09595', borderRadius: 8, padding: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: S.red, marginBottom: 6 }}>Vencimientos próximos - 7 días</div>
          {lotesActivos.filter(l => l.fecha_vencimiento_pago && l.estado_pago !== 'pagado' && new Date(l.fecha_vencimiento_pago) <= new Date(Date.now() + 7 * 86400000)).map(l => (
            <div key={l.id} style={{ fontSize: 12, color: S.red, marginBottom: 2 }}>C-{corrales.find(c => c.id === l.corral_cuarentena_id)?.numero || l.corral_cuarentena_id} - {l.procedencia || 'Sin proveedor'} - vence {new Date(l.fecha_vencimiento_pago + 'T12:00:00').toLocaleDateString('es-AR')}</div>
          ))}
        </div>
      )}

      <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 900 }}>
          <thead><tr style={{ background: S.bg }}>
            {['Fecha','Corral','Proveedor','Total','Facturado','Negro','IVA','Vence','Estado','Editar','Pago'].map(h => (
              <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 10, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {lotesActivos.length === 0 && <tr><td colSpan={11} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay ingresos.</td></tr>}
            {lotesActivos.map(l => {
              const pagos = pagosMap[l.id] || []
              const total = totalLoteCalc(l)
              const totalPagado = pagos.reduce((s, p) => s + (p.monto || 0), 0)
              const saldo = total ? total - totalPagado : null
              const isReg = registrandoPago === l.id
              const isEditFactura = editandoFactura === l.id
              const estKey = estadoDeLote(l, total, totalPagado)
              const ec = ESTADOS[estKey]
              const venceProx = l.fecha_vencimiento_pago && l.estado_pago !== 'pagado' && new Date(l.fecha_vencimiento_pago) <= new Date(Date.now() + 7 * 86400000)
              const corralNum = corrales.find(c => c.id === l.corral_cuarentena_id)?.numero || l.corral_cuarentena_id

              return (
                <React.Fragment key={l.id}>
                  <tr style={{ borderBottom: `1px solid ${S.border}`, background: venceProx ? '#FFF5F5' : 'transparent' }}>
                    <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 11 }}>{l.fecha_ingreso ? new Date(l.fecha_ingreso + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}</td>
                    <td style={{ padding: '7px 10px', fontWeight: 600 }}>C-{corralNum}</td>
                    <td style={{ padding: '7px 10px' }}>{l.procedencia || '—'}</td>
                    <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontWeight: 600, color: S.red }}>{total > 0 ? '-$' + total.toLocaleString('es-AR') : '—'}</td>
                    <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: S.green }}>{l.monto_facturado != null ? '$' + l.monto_facturado.toLocaleString('es-AR') : '—'}</td>
                    <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: S.purple }}>{l.monto_negro > 0 ? '$' + l.monto_negro.toLocaleString('es-AR') : '—'}</td>
                    <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 11 }}>{l.iva_monto ? '$' + l.iva_monto.toLocaleString('es-AR') : '—'}</td>
                    <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 11, fontWeight: venceProx ? 700 : 400, color: venceProx ? S.red : S.text }}>
                      {l.fecha_vencimiento_pago ? new Date(l.fecha_vencimiento_pago + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '—'}
                    </td>
                    <td style={{ padding: '7px 10px' }}>
                      <span style={{ padding: '3px 8px', fontSize: 10, fontWeight: 600, border: `1px solid ${ec.color}`, borderRadius: 5, background: ec.bg, color: ec.color }}>{ec.label}</span>
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                      <button onClick={() => { setEditandoFactura(l.id); setFormFactura({ numero_factura: l.numero_factura || '', fecha_factura: l.fecha_factura || '', monto_facturado: l.monto_facturado != null ? String(l.monto_facturado) : '', iva_pct: String(l.iva_pct || '10.5'), observaciones_pago: l.observaciones_pago || '', proveedor: l.procedencia || '', localidad: l.proveedor_localidad || '', cuit: l.proveedor_cuit || '', iva: l.proveedor_iva || '', cbu: l.proveedor_cbu || '', cuotas_pago: (l.cuotas_pago || []).map(c => ({ fecha: c.fecha, monto: String(c.monto) })) }) }}
                        style={{ padding: '3px 8px', fontSize: 10, fontWeight: 600, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        ✏️ Editar
                      </button>
                    </td>
                    <td style={{ padding: '7px 10px', minWidth: 220 }}>
                      <div>
                        {l.cuotas_pago?.length > 0 && (() => {
                          const pagosPorCuota = {}
                          pagos.forEach(p => { if (p.cuota_idx != null) pagosPorCuota[p.cuota_idx] = (pagosPorCuota[p.cuota_idx] || 0) + (p.monto || 0) })
                          return (
                            <div style={{ marginBottom: 6, paddingBottom: 6, borderBottom: `1px dashed ${S.border}` }}>
                              <div style={{ fontSize: 9, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Cuotas factura</div>
                              {l.cuotas_pago.map((c, ci) => {
                                const pagadoCuota = pagosPorCuota[ci] || 0
                                const saldoCuota = (c.monto || 0) - pagadoCuota
                                const vencida = c.fecha && new Date(c.fecha + 'T12:00:00') < new Date() && saldoCuota > 0
                                return (
                                  <div key={ci} style={{ fontSize: 10, marginBottom: 2, color: saldoCuota <= 0 ? S.green : vencida ? S.red : S.muted }}>
                                    {c.fecha ? new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '—'}: ${(c.monto || 0).toLocaleString('es-AR')}
                                    {saldoCuota <= 0 ? ' ✓' : pagadoCuota > 0 ? ` (pag. $${pagadoCuota.toLocaleString('es-AR')})` : ''}
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })()}
                        {saldo <= 0 && pagos.length > 0 ? (
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: S.green, marginBottom: 3 }}>
                              ✓ Pagado completo · ${totalPagado.toLocaleString('es-AR')}
                            </div>
                            {pagosExpandidos[l.id] ? (
                              <div>
                                {pagos.map(p => (
                                  <div key={p.id} style={{ fontSize: 10, color: S.green, marginBottom: 2, display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                                    <span>${p.monto.toLocaleString('es-AR')} · {p.forma_pago}{p.numero_cheque ? ` #${p.numero_cheque}` : ''}</span>
                                    <button onClick={() => eliminarPago(p, l, pagos, total)} style={{ background: 'none', border: 'none', color: S.red, cursor: 'pointer', fontSize: 10 }}>✕</button>
                                  </div>
                                ))}
                                <button onClick={() => setPagosExpandidos(prev => ({...prev, [l.id]: false}))}
                                  style={{ fontSize: 9, color: S.muted, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>▲ Ocultar</button>
                              </div>
                            ) : (
                              <button onClick={() => setPagosExpandidos(prev => ({...prev, [l.id]: true}))}
                                style={{ fontSize: 9, color: S.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>▼ Ver pagos</button>
                            )}
                          </div>
                        ) : (
                          <div>
                            {pagos.map(p => (
                              <div key={p.id} style={{ fontSize: 10, color: S.green, marginBottom: 2, display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                                <span>${p.monto.toLocaleString('es-AR')} · {p.forma_pago}{p.numero_cheque ? ` #${p.numero_cheque}` : ''}</span>
                                <button onClick={() => eliminarPago(p, l, pagos, total)} style={{ background: 'none', border: 'none', color: S.red, cursor: 'pointer', fontSize: 10 }}>✕</button>
                              </div>
                            ))}
                            {totalPagado > 0 && (
                              <div style={{ fontSize: 10, fontWeight: 700, color: S.amber, marginBottom: 4 }}>
                                Saldo: ${saldo?.toLocaleString('es-AR')}
                              </div>
                            )}
                          </div>
                        )}
                        {pagos.length > 0 && (
                          <button onClick={() => generarReciboCompra(l, pagos, corrales)}
                            style={{ fontSize: 9, padding: '2px 6px', background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 4, cursor: 'pointer', marginBottom: 4 }}>🖨️ Recibo</button>
                        )}
                        {!isReg && l.precio_compra ? (
                          <button onClick={() => { setRegistrandoPago(l.id); setFormPago({ fecha: new Date().toISOString().split('T')[0], cuota_idx: null, pagos: [{...PAGO_INIT, monto: saldo > 0 ? String(Math.round(saldo)) : ''}] }) }}
                            style={{ fontSize: 10, padding: '3px 8px', background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 4, cursor: 'pointer', width: '100%' }}>
                            + Registrar pago
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>

                  {isEditFactura && (
                    <tr style={{ background: S.accentLight }}>
                      <td colSpan={11} style={{ padding: '1.25rem' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: S.accent, textTransform: 'uppercase', marginBottom: 12 }}>Gestión comercial — C-{corralNum}</div>
                        {renderFormFactura(l)}
                      </td>
                    </tr>
                  )}

                  {isReg && (
                    <tr style={{ background: S.bg }}>
                      <td colSpan={11} style={{ padding: '12px 16px', borderBottom: `1px solid ${S.border}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: S.green }}>Nuevo pago</div>
                          <button onClick={() => setFormPago({...formPago, pagos: [...formPago.pagos, {...PAGO_INIT}]})}
                            style={{ padding: '4px 10px', fontSize: 11, background: 'transparent', border: `1px solid ${S.green}`, color: S.green, borderRadius: 5, cursor: 'pointer' }}>+ Agregar forma de pago</button>
                        </div>
                        <div style={{ marginBottom: 10 }}>
                          <Lbl>Fecha</Lbl>
                          <input type="date" value={formPago.fecha} onChange={e => setFormPago({...formPago, fecha: e.target.value})} style={{ ...inp, maxWidth: 180 }} />
                        </div>
                        {l.cuotas_pago?.length > 0 && (() => {
                          const pagosPorCuota = {}
                          pagos.forEach(p => { if (p.cuota_idx != null) pagosPorCuota[p.cuota_idx] = (pagosPorCuota[p.cuota_idx] || 0) + (p.monto || 0) })
                          return (
                            <div style={{ marginBottom: 10 }}>
                              <Lbl>Corresponde a la cuota</Lbl>
                              <select value={formPago.cuota_idx ?? ''} onChange={e => {
                                const idx = e.target.value === '' ? null : parseInt(e.target.value)
                                const saldoCuota = idx != null ? (l.cuotas_pago[idx].monto || 0) - (pagosPorCuota[idx] || 0) : null
                                const nuevosPagos = formPago.pagos.map((p, i) => i === 0 ? {...p, monto: saldoCuota != null ? String(Math.round(saldoCuota)) : p.monto} : p)
                                setFormPago({...formPago, cuota_idx: idx, pagos: nuevosPagos})
                              }} style={inp}>
                                <option value="">— Sin asociar a cuota —</option>
                                {l.cuotas_pago.map((c, ci) => {
                                  const saldoCuota = (c.monto || 0) - (pagosPorCuota[ci] || 0)
                                  return (
                                    <option key={ci} value={ci} disabled={saldoCuota <= 0}>
                                      {c.fecha ? new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR') : '—'} — ${c.monto?.toLocaleString('es-AR')} {saldoCuota <= 0 ? '(pagada)' : `(saldo $${saldoCuota.toLocaleString('es-AR')})`}
                                    </option>
                                  )
                                })}
                              </select>
                            </div>
                          )
                        })()}
                        {formPago.pagos.map((pago, idx) => (
                          <div key={idx} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 7, padding: '10px', marginBottom: 8 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 8, alignItems: 'flex-end', marginBottom: pago.tipo === 'e-cheq' ? 8 : 0 }}>
                              <div><Lbl>Forma de pago</Lbl>
                                <select value={pago.tipo} onChange={e => { const n = formPago.pagos.map((p,i) => i===idx ? {...p, tipo: e.target.value, subtipo_cheque: ''} : p); setFormPago({...formPago, pagos: n}) }} style={inp}>
                                  <option value="transferencia">Transferencia</option>
                                  <option value="efectivo">Efectivo</option>
                                  <option value="e-cheq">E-cheq</option>
                                  <option value="cuenta_corriente">Cuenta corriente</option>
                                </select>
                              </div>
                              <div><Lbl>Monto $</Lbl>
                                <input type="number" value={pago.monto} onChange={e => { const n = formPago.pagos.map((p,i) => i===idx ? {...p, monto: e.target.value} : p); setFormPago({...formPago, pagos: n}) }} style={{...inp, fontFamily: 'monospace'}} />
                              </div>
                              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: S.purple, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                  <input type="checkbox" checked={pago.es_paralela} onChange={e => { const n = formPago.pagos.map((p,i) => i===idx ? {...p, es_paralela: e.target.checked} : p); setFormPago({...formPago, pagos: n}) }} />
                                  Paralelo
                                </label>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                                {formPago.pagos.length > 1 && <button onClick={() => setFormPago({...formPago, pagos: formPago.pagos.filter((_,i) => i!==idx)})} style={{ padding: '5px 8px', fontSize: 10, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 4, cursor: 'pointer' }}>✕</button>}
                              </div>
                            </div>
                            {pago.tipo === 'e-cheq' && (
                              <div style={{ marginTop: 8 }}>
                                <div style={{ display: 'flex', gap: 8, marginBottom: pago.subtipo_cheque ? 8 : 0 }}>
                                  {(pago.es_paralela ? ['tercero'] : ['propio', 'tercero']).map(t => (
                                    <button key={t} onClick={() => { const n = formPago.pagos.map((p,i) => i===idx ? {...p, subtipo_cheque: p.subtipo_cheque===t?'':t} : p); setFormPago({...formPago, pagos: n}) }}
                                      style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer', border: `1px solid ${pago.subtipo_cheque===t ? S.accent : S.border}`, background: pago.subtipo_cheque===t ? S.accentLight : 'transparent', color: pago.subtipo_cheque===t ? S.accent : S.muted }}>
                                      {t === 'propio' ? '📤 Propio' : '📥 Tercero'}
                                    </button>
                                  ))}
                                </div>
                                {pago.subtipo_cheque === 'propio' && (
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
                                    <div><Lbl>N° cheque</Lbl><input type="text" value={pago.cheque_propio.numero} onChange={e => { const n = formPago.pagos.map((p,i) => i===idx ? {...p, cheque_propio: {...p.cheque_propio, numero: e.target.value}} : p); setFormPago({...formPago, pagos: n}) }} style={inp} /></div>
                                    <div><Lbl>Banco</Lbl><input type="text" value={pago.cheque_propio.banco} onChange={e => { const n = formPago.pagos.map((p,i) => i===idx ? {...p, cheque_propio: {...p.cheque_propio, banco: e.target.value}} : p); setFormPago({...formPago, pagos: n}) }} style={inp} /></div>
                                    <div><Lbl>Vencimiento *</Lbl><input type="date" value={pago.cheque_propio.fecha_vencimiento} onChange={e => { const n = formPago.pagos.map((p,i) => i===idx ? {...p, cheque_propio: {...p.cheque_propio, fecha_vencimiento: e.target.value}} : p); setFormPago({...formPago, pagos: n}) }} style={{ ...inp, borderColor: S.amber }} /></div>
                                  </div>
                                )}
                                {pago.subtipo_cheque === 'tercero' && (
                                  <div style={{ marginTop: 8 }}>
                                    {(() => {
                                      const lista = chequesCartera.filter(ch => pago.es_paralela ? ch.es_paralelo : !ch.es_paralelo)
                                      return lista.length === 0
                                        ? <div style={{ fontSize: 13, color: S.hint }}>No hay cheques en cartera.</div>
                                        : lista.map(ch => (
                                          <label key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', border: `1px solid ${pago.cheque_tercero_ids?.includes(String(ch.id)) ? S.accent : S.border}`, borderRadius: 6, background: pago.cheque_tercero_ids?.includes(String(ch.id)) ? S.accentLight : S.surface, cursor: 'pointer', marginBottom: 5 }}>
                                            <input type="checkbox" checked={pago.cheque_tercero_ids?.includes(String(ch.id)) || false} onChange={() => {
                                              const actuales = pago.cheque_tercero_ids || []
                                              const yaEsta = actuales.includes(String(ch.id))
                                              const nuevosIds = yaEsta ? actuales.filter(id => id !== String(ch.id)) : [...actuales, String(ch.id)]
                                              const nuevoMonto = nuevosIds.reduce((s, id) => s + (chequesCartera.find(c => String(c.id) === id)?.monto || 0), 0)
                                              const n = formPago.pagos.map((p,i) => i===idx ? {...p, cheque_tercero_ids: nuevosIds, monto: String(nuevoMonto || '')} : p)
                                              setFormPago({...formPago, pagos: n})
                                            }} />
                                            <div style={{ fontSize: 13 }}><strong>${ch.monto?.toLocaleString('es-AR')}</strong><span style={{ color: S.muted, marginLeft: 8 }}>#{ch.numero||'sin nro'} · {ch.banco||'—'} · vence {ch.fecha_vencimiento ? new Date(ch.fecha_vencimiento+'T12:00:00').toLocaleDateString('es-AR') : '—'}</span></div>
                                          </label>
                                        ))
                                    })()}
                                    {pago.cheque_tercero_ids?.length > 0 && (
                                      <div style={{ fontSize: 12, fontWeight: 700, color: S.accent, marginTop: 6, padding: '6px 10px', background: S.accentLight, borderRadius: 6 }}>
                                        {pago.cheque_tercero_ids.length} cheque{pago.cheque_tercero_ids.length !== 1 ? 's' : ''} seleccionado{pago.cheque_tercero_ids.length !== 1 ? 's' : ''} · Total: ${parseFloat(pago.monto || 0).toLocaleString('es-AR')}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                        {saldo > 0 && (() => {
                          const tp = formPago.pagos.reduce((s,p) => s+(parseFloat(p.monto)||0), 0)
                          return (
                            <div style={{ background: Math.abs(saldo-tp) < 0.5 ? S.greenLight : S.amberLight, border: `1px solid ${Math.abs(saldo-tp) < 0.5 ? '#97C459' : '#EF9F27'}`, borderRadius: 6, padding: '8px 12px', fontSize: 13, marginBottom: 10 }}>
                              Saldo: <strong>${Math.round(saldo).toLocaleString('es-AR')}</strong> · Pagos: <strong>${tp.toLocaleString('es-AR')}</strong>
                              {Math.abs(saldo-tp) >= 0.5 && <span style={{ marginLeft: 12, color: S.amber, fontWeight: 600 }}>Diferencia: ${Math.round(saldo-tp).toLocaleString('es-AR')}</span>}
                            </div>
                          )
                        })()}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => registrarPago(l)} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Registrar pago'}</button>
                          <button onClick={() => setRegistrandoPago(null)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ARCHIVADAS */}
      {lotesArchivados.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <button onClick={() => setMostrarArchivadas(m => !m)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, cursor: 'pointer', color: S.muted, width: '100%' }}>
            <span>📁</span>
            <span>Archivadas ({lotesArchivados.length})</span>
            <span style={{ marginLeft: 'auto' }}>{mostrarArchivadas ? '▲' : '▼'}</span>
          </button>
          {mostrarArchivadas && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <input type="text" placeholder="Filtrar por proveedor..." value={filtroArchivadas.proveedor}
                  onChange={e => setFiltroArchivadas(f => ({...f, proveedor: e.target.value}))}
                  style={{ flex: 1, padding: '7px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 12, background: S.surface }} />
                <input type="date" value={filtroArchivadas.desde} onChange={e => setFiltroArchivadas(f => ({...f, desde: e.target.value}))}
                  style={{ padding: '7px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 12, background: S.surface }} />
                <input type="date" value={filtroArchivadas.hasta} onChange={e => setFiltroArchivadas(f => ({...f, hasta: e.target.value}))}
                  style={{ padding: '7px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 12, background: S.surface }} />
                {(filtroArchivadas.proveedor || filtroArchivadas.desde || filtroArchivadas.hasta) && (
                  <button onClick={() => setFiltroArchivadas({ proveedor: '', desde: '', hasta: '' })}
                    style={{ padding: '7px 12px', fontSize: 12, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 6, cursor: 'pointer' }}>✕ Limpiar</button>
                )}
              </div>
              <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
                {archFiltrados.length === 0
                  ? <div style={{ padding: '2rem', textAlign: 'center', color: S.hint, fontSize: 13 }}>Sin resultados</div>
                  : archFiltrados.map(l => {
                    const totalArch = totalLoteCalc(l)
                    return (
                      <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: `1px solid ${S.border}` }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>C-{corrales.find(c => c.id === l.corral_cuarentena_id)?.numero || l.corral_cuarentena_id} · {l.procedencia || '—'}</div>
                          <div style={{ fontSize: 11, color: S.muted }}>{l.fecha_ingreso ? new Date(l.fecha_ingreso + 'T12:00:00').toLocaleDateString('es-AR') : ''} · {l.cantidad} animales</div>
                        </div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 700, color: S.red, fontSize: 14 }}>
                          {totalArch > 0 ? `-$${totalArch.toLocaleString('es-AR')}` : '—'}
                        </div>
                      </div>
                    )
                  })
                }
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
