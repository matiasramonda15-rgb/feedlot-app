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
  const [lotes, setLotes] = useState([])
  const [corrales, setCorrales] = useState([])
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
    const [{ data: lotesDB }, { data: corralesDB }] = await Promise.all([
      supabase.from('lotes').select('*').order('created_at', { ascending: false }),
      supabase.from('corrales').select('id, numero, rol, sub, animales').order('numero'),
    ])
    setLotes(lotesDB || [])
    setCorrales(corralesDB || [])
    setLoading(false)
  }

  async function guardarIngreso() {
    if (!form.cantidad || !form.kg_bascula) { alert('Completá cantidad y kg báscula'); return }
    setGuardando(true)
    const procFinal = form.procedencia === 'Otro' ? (form.otraProcedencia?.trim() || null) : (form.procedencia || null)
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
    if (!editandoPrecio?.precio_compra && !editandoPrecio?.monto_total) { alert('Ingresá el precio o el monto total'); return }
    const kgFac = editandoPrecio.kg_factura ? parseFloat(editandoPrecio.kg_factura) : null
    const precio = editandoPrecio.precio_compra ? parseFloat(editandoPrecio.precio_compra) : null
    const montoTotal = editandoPrecio.monto_total ? parseFloat(editandoPrecio.monto_total) : (kgFac && precio ? Math.round(kgFac * precio) : null)
    const plazo = editandoPrecio.plazo_dias ? parseInt(editandoPrecio.plazo_dias) : null
    const fechaVto = plazo ? new Date(new Date(lote.fecha_ingreso + 'T12:00:00').getTime() + plazo * 86400000).toISOString().split('T')[0] : null
    const comMonto = editandoPrecio.comision_monto ? parseFloat(editandoPrecio.comision_monto) : 0
    await supabase.from('lotes').update({
      kg_factura: kgFac,
      precio_compra: precio || (montoTotal && kgFac ? Math.round(montoTotal / kgFac) : null),
      monto_total_con_iva: montoTotal,
      plazo_dias: plazo,
      fecha_vencimiento_pago: fechaVto,
      comision_monto: comMonto || null,
      comision_a_quien: editandoPrecio.comision_a_quien || null,
      comision_es_paralela: editandoPrecio.comision_es_paralela || false,
      procedencia: editandoPrecio.procedencia && editandoPrecio.procedencia !== lote.procedencia ? editandoPrecio.procedencia : lote.procedencia,
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
  const compradores = [...new Set(lotes.map(l => l.procedencia).filter(Boolean))]

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
              <Lbl>Procedencia</Lbl>
              <select value={form.procedencia} onChange={e => setForm({...form, procedencia: e.target.value, otraProcedencia: ''})} style={inp}>
                <option value="">— Seleccioná —</option>
                {PROCEDENCIAS_DEFAULT.map(p => <option key={p}>{p}</option>)}
                {compradores.filter(c => !PROCEDENCIAS_DEFAULT.includes(c)).map(c => <option key={c}>{c}</option>)}
                <option value="Otro">+ Otro...</option>
              </select>
            </div>
            {form.procedencia === 'Otro' && (
              <div>
                <Lbl>Especificá procedencia</Lbl>
                <input type="text" value={form.otraProcedencia} onChange={e => setForm({...form, otraProcedencia: e.target.value})} style={inp} />
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

      {/* Banner lotes sin precio */}
      {lotesSinPrecio.length > 0 && (
        <div style={{ background: S.amberLight, border: `1px solid #EF9F27`, borderRadius: 10, padding: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: S.amber, marginBottom: '1rem' }}>
            ⚠ {lotesSinPrecio.length} ingreso{lotesSinPrecio.length !== 1 ? 's' : ''} sin precio de compra
          </div>
          {lotesSinPrecio.map(l => {
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
                      plazo_dias: l.plazo_dias ? String(l.plazo_dias) : '',
                      comision_monto: l.comision_monto ? String(l.comision_monto) : '',
                      comision_a_quien: l.comision_a_quien || '',
                      comision_es_paralela: l.comision_es_paralela || false,
                      procedencia: l.procedencia || '',
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
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                      {/* Kg factura */}
                      <div>
                        <Lbl c={S.accent}>Kg factura</Lbl>
                        <input type="number" value={editandoPrecio.kg_factura} onChange={e => setEditandoPrecio({...editandoPrecio, kg_factura: e.target.value})}
                          placeholder="Kg según factura" style={{...inpMono, border: `1px solid ${S.accent}`, fontWeight: 600}} />
                      </div>
                      {/* Precio $/kg */}
                      <div>
                        <Lbl>Precio $/kg</Lbl>
                        <input type="number" value={editandoPrecio.precio_compra} onChange={e => {
                          const precio = e.target.value
                          const kgF = parseFloat(editandoPrecio.kg_factura) || 0
                          const monto = precio && kgF ? String(Math.round(kgF * parseFloat(precio))) : ''
                          setEditandoPrecio({...editandoPrecio, precio_compra: precio, monto_total: monto})
                        }} placeholder="ej. 2800" style={inpMono} />
                      </div>
                      {/* Monto total */}
                      <div>
                        <Lbl>Monto total operación $</Lbl>
                        <input type="number" value={editandoPrecio.monto_total} onChange={e => {
                          const monto = e.target.value
                          const kgF = parseFloat(editandoPrecio.kg_factura) || 0
                          const precio = monto && kgF ? String(Math.round(parseFloat(monto) / kgF)) : ''
                          setEditandoPrecio({...editandoPrecio, monto_total: monto, precio_compra: precio})
                        }} placeholder="Total a pagar" style={{...inpMono, border: `1px solid ${S.accent}`, fontWeight: 600}} />
                      </div>
                    </div>

                    {/* Alerta diferencia kg */}
                    {diffKg !== null && (
                      <div style={{ background: alertaDiff ? S.redLight : S.greenLight, border: `1px solid ${alertaDiff ? '#F09595' : '#97C459'}`, borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: 12 }}>
                        {alertaDiff ? '⚠ ' : '✓ '}
                        Báscula: {kgBas.toLocaleString('es-AR')} kg · Factura: {kgFac.toLocaleString('es-AR')} kg · Diferencia: {diffKg > 0 ? '+' : ''}{diffKg.toLocaleString('es-AR')} kg ({diffPct > 0 ? '+' : ''}{diffPct?.toFixed(1)}%)
                        {alertaDiff && ' — más del 3%, verificar'}
                      </div>
                    )}

                    {/* Resumen total */}
                    {editandoPrecio.monto_total && (
                      <div style={{ background: S.accentLight, border: `1px solid ${S.accent}`, borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: 13 }}>
                        Total a pagar: <strong style={{ fontFamily: 'monospace' }}>${parseFloat(editandoPrecio.monto_total).toLocaleString('es-AR')}</strong>
                        {editandoPrecio.kg_factura && editandoPrecio.precio_compra && (
                          <span style={{ fontSize: 11, color: S.muted, marginLeft: 8 }}>
                            ({parseFloat(editandoPrecio.kg_factura).toLocaleString('es-AR')} kg × ${parseFloat(editandoPrecio.precio_compra).toLocaleString('es-AR')}/kg)
                          </span>
                        )}
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                      {/* Plazo */}
                      <div>
                        <Lbl>Plazo (días corridos)</Lbl>
                        <input type="number" value={editandoPrecio.plazo_dias} onChange={e => setEditandoPrecio({...editandoPrecio, plazo_dias: e.target.value})}
                          placeholder="ej. 30" style={inpMono} />
                        {editandoPrecio.plazo_dias && l.fecha_ingreso && (
                          <div style={{ fontSize: 10, color: S.muted, marginTop: 2 }}>
                            Vence: {new Date(new Date(l.fecha_ingreso + 'T12:00:00').getTime() + parseInt(editandoPrecio.plazo_dias) * 86400000).toLocaleDateString('es-AR')}
                          </div>
                        )}
                      </div>
                      {/* Comisión monto */}
                      <div>
                        <Lbl>Comisión $</Lbl>
                        <input type="number" value={editandoPrecio.comision_monto} onChange={e => setEditandoPrecio({...editandoPrecio, comision_monto: e.target.value})}
                          placeholder="0" style={inpMono} />
                      </div>
                      {/* Comisión a quién */}
                      <div>
                        <Lbl>Comisión a quién</Lbl>
                        <input type="text" value={editandoPrecio.comision_a_quien} onChange={e => setEditandoPrecio({...editandoPrecio, comision_a_quien: e.target.value})}
                          placeholder="Nombre" style={inp} />
                      </div>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: S.purple, cursor: 'pointer' }}>
                        <input type="checkbox" checked={editandoPrecio.comision_es_paralela || false} onChange={e => setEditandoPrecio({...editandoPrecio, comision_es_paralela: e.target.checked})} />
                        Comisión se paga por cuenta paralela
                      </label>
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
                  {['Fecha', 'Corral', 'Procedencia', 'Categoría', 'Cantidad', 'Kg báscula', 'Kg factura', 'Diferencia', 'Precio/kg', 'Total', 'Vto pago', ''].map(h => (
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
                  const total = l.monto_total_con_iva || (kgParaTotal && l.precio_compra ? Math.round(kgParaTotal * l.precio_compra) : null)
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
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', textAlign: 'right', fontWeight: 600, color: total ? S.red : S.hint }}>
                        {total ? `-$${total.toLocaleString('es-AR')}` : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, color: vtoColor, whiteSpace: 'nowrap' }}>
                        {l.fecha_vencimiento_pago ? new Date(l.fecha_vencimiento_pago + 'T12:00:00').toLocaleDateString('es-AR') : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        {esDueno && (
                          <>
                            <button onClick={() => { setEditandoLote(l); setForm({ procedencia: l.procedencia || '', otraProcedencia: '', categoria: l.categoria || 'Novillos 2-3 años', cantidad: String(l.cantidad || ''), kg_bascula: String(l.kg_bascula || ''), observaciones: l.observaciones || '', corral_cuarentena_id: String(l.corral_cuarentena_id || '') }); setVista('editar') }}
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
        <GestionComercial lotes={lotes} corrales={corrales} esDueno={esDueno} cargarDatos={cargarDatos} />
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
function GestionComercial({ lotes, corrales, esDueno, cargarDatos }) {
  const [editandoFactura, setEditandoFactura] = useState(null)
  const [formFactura, setFormFactura] = useState({ numero_factura: '', fecha_factura: '', monto_facturado: '', iva_pct: '10.5', observaciones_pago: '' })
  const [pagosMap, setPagosMap] = useState({})
  const [formPago, setFormPago] = useState({ monto: '', forma_pago: 'transferencia', fecha: new Date().toISOString().split('T')[0], numero_cheque: '', banco: '', fecha_cobro_cheque: '', fecha_vencimiento_cheque: '', es_paralela: false })
  const [pagoAbierto, setPagoAbierto] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { cargarPagos() }, [lotes])

  async function cargarPagos() {
    if (!lotes.length) return
    const ids = lotes.map(l => l.id)
    const { data } = await supabase.from('pagos_compras').select('*').in('lote_id', ids).order('fecha')
    const map = {}
    ;(data || []).forEach(p => {
      if (!map[p.lote_id]) map[p.lote_id] = []
      map[p.lote_id].push(p)
    })
    setPagosMap(map)
  }

  async function guardarFactura(lote) {
    const montoFact = formFactura.monto_facturado ? parseFloat(formFactura.monto_facturado) : null
    const ivaPct = parseFloat(formFactura.iva_pct || 10.5)
    const ivaMonto = montoFact ? Math.round(montoFact * ivaPct / 100) : 0
    const totalFactura = montoFact ? montoFact + ivaMonto : null
    const montoTotal = lote.monto_total_con_iva || null
    const montoNegro = montoTotal && totalFactura ? Math.max(0, montoTotal - totalFactura) : null
    await supabase.from('lotes').update({
      numero_factura: formFactura.numero_factura || null,
      fecha_factura: formFactura.fecha_factura || null,
      monto_facturado: montoFact,
      iva_pct: ivaPct,
      iva_monto: ivaMonto,
      monto_negro: montoNegro,
      observaciones_pago: formFactura.observaciones_pago || null,
    }).eq('id', lote.id)
    setEditandoFactura(null)
    await cargarDatos()
  }

  async function registrarPago(lote) {
    const monto = parseFloat(formPago.monto)
    if (!monto) { alert('Ingresá el monto'); return }
    setGuardando(true)
    const { data: pagoInsertado } = await supabase.from('pagos_compras').insert({
      lote_id: lote.id, fecha: formPago.fecha, monto,
      forma_pago: formPago.forma_pago,
      numero_cheque: formPago.numero_cheque || null,
      banco: formPago.banco || null,
      fecha_vencimiento_cheque: formPago.fecha_vencimiento_cheque || null,
      es_negro: formPago.es_paralela || false,
    }).select().single()

    const kgBase = lote.kg_factura > 0 ? lote.kg_factura : lote.kg_bascula
    const totalLote = lote.monto_total_con_iva || (lote.precio_compra && kgBase ? Math.round(kgBase * lote.precio_compra) : null)
    const pagosActuales = pagosMap[lote.id] || []
    const totalPagado = pagosActuales.reduce((s, p) => s + (p.monto || 0), 0) + monto
    const nuevoEstado = totalLote && totalPagado >= totalLote * 0.99 ? 'pagado' : 'pendiente'
    await supabase.from('lotes').update({ estado_pago: nuevoEstado }).eq('id', lote.id)

    if (formPago.es_paralela) {
      await supabase.from('caja_paralela').insert({ fecha: formPago.fecha, tipo: 'egreso', descripcion: `Pago compra ${lote.procedencia || ''} C-${corrales.find(c => c.id === lote.corral_cuarentena_id)?.numero || lote.corral_cuarentena_id}`, monto, pago_compra_id: pagoInsertado?.id })
    } else {
      await supabase.from('caja_oficial').insert({ fecha: formPago.fecha, tipo: 'egreso', categoria: 'Pago compra hacienda', descripcion: `Pago ${lote.procedencia || ''} C-${corrales.find(c => c.id === lote.corral_cuarentena_id)?.numero || lote.corral_cuarentena_id}`, monto, forma_pago: formPago.forma_pago, pago_compra_id: pagoInsertado?.id })
    }
    if (['cheque', 'e-cheq'].includes(formPago.forma_pago) && formPago.fecha_vencimiento_cheque) {
      await supabase.from('cheques').insert({ tipo: 'emitido', numero: formPago.numero_cheque || null, banco: formPago.banco || null, monto, fecha_emision: formPago.fecha, fecha_cobro: formPago.fecha_cobro_cheque || null, fecha_vencimiento: formPago.fecha_vencimiento_cheque, beneficiario: lote.procedencia || null, estado: 'emitido', es_paralelo: formPago.es_paralela || false, pago_compra_id: pagoInsertado?.id })
    }

    setPagoAbierto(null)
    setFormPago({ monto: '', forma_pago: 'transferencia', fecha: new Date().toISOString().split('T')[0], numero_cheque: '', banco: '', fecha_cobro_cheque: '', fecha_vencimiento_cheque: '', es_paralela: false })
    setGuardando(false)
    await cargarDatos()
    await cargarPagos()
  }

  return (
    <div>
      {lotes.map(l => {
        const pagos = pagosMap[l.id] || []
        const kgBase = l.kg_factura > 0 ? l.kg_factura : l.kg_bascula
        const total = l.monto_total_con_iva || (l.precio_compra && kgBase ? Math.round(kgBase * l.precio_compra) : null)
        const totalPagado = pagos.reduce((s, p) => s + (p.monto || 0), 0)
        const saldo = total ? total - totalPagado : null
        const ivaMonto = l.iva_monto || (l.monto_facturado ? Math.round(l.monto_facturado * (l.iva_pct || 10.5) / 100) : null)
        const totalFactura = l.monto_facturado && ivaMonto ? l.monto_facturado + ivaMonto : null
        const montoNegro = total && totalFactura ? Math.max(0, total - totalFactura) : (l.monto_negro || null)
        const isEditFactura = editandoFactura === l.id
        const isPagoAbierto = pagoAbierto === l.id
        const estadoBadge = l.estado_pago === 'pagado'
          ? { label: 'Pagado', bg: S.greenLight, color: S.green }
          : saldo > 0 ? { label: 'Pendiente', bg: S.amberLight, color: S.amber }
          : total ? { label: 'Sin pagar', bg: S.redLight, color: S.red }
          : { label: 'Sin precio', bg: S.bg, color: S.hint }

        return (
          <div key={l.id} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, marginBottom: '1.25rem', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>C-{corrales.find(c => c.id === l.corral_cuarentena_id)?.numero || l.corral_cuarentena_id} · {l.procedencia || '—'}</div>
                <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>
                  {l.cantidad} animales · {l.fecha_ingreso ? new Date(l.fecha_ingreso + 'T12:00:00').toLocaleDateString('es-AR') : ''}
                  {l.kg_factura > 0 && ` · ${l.kg_factura.toLocaleString('es-AR')} kg fac`}
                  {l.precio_compra && ` · $${l.precio_compra.toLocaleString('es-AR')}/kg`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: estadoBadge.bg, color: estadoBadge.color }}>{estadoBadge.label}</span>
                {total && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: S.muted }}>Total operación</div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 700, color: S.red }}>-${total.toLocaleString('es-AR')}</div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: '1rem 1.25rem' }}>
              {/* Datos factura */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: '1rem', fontSize: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 2 }}>N° Factura</div>
                  <div style={{ fontFamily: 'monospace' }}>{l.numero_factura || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 2 }}>Neto facturado</div>
                  <div style={{ fontFamily: 'monospace' }}>{l.monto_facturado ? `$${l.monto_facturado.toLocaleString('es-AR')}` : '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 2 }}>IVA {l.iva_pct || 10.5}%</div>
                  <div style={{ fontFamily: 'monospace' }}>{ivaMonto ? `$${ivaMonto.toLocaleString('es-AR')}` : '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 2 }}>Cuenta paralela</div>
                  <div style={{ fontFamily: 'monospace', color: montoNegro > 0 ? S.purple : S.hint, fontWeight: montoNegro > 0 ? 600 : 400 }}>{montoNegro > 0 ? `$${montoNegro.toLocaleString('es-AR')}` : '—'}</div>
                </div>
                {l.comision_monto > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 2 }}>Comisión</div>
                    <div style={{ fontFamily: 'monospace', color: l.comision_es_paralela ? S.purple : S.red }}>
                      ${l.comision_monto.toLocaleString('es-AR')}{l.comision_a_quien ? ` · ${l.comision_a_quien}` : ''}{l.comision_es_paralela ? ' (paralela)' : ''}
                    </div>
                  </div>
                )}
                {l.plazo_dias > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 2 }}>Plazo / Vencimiento</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 11, color: l.fecha_vencimiento_pago && new Date(l.fecha_vencimiento_pago) < new Date() ? S.red : S.muted }}>
                      {l.plazo_dias}d · {l.fecha_vencimiento_pago ? new Date(l.fecha_vencimiento_pago + 'T12:00:00').toLocaleDateString('es-AR') : '—'}
                    </div>
                  </div>
                )}
              </div>

              {/* Botón editar factura */}
              {!isEditFactura && (
                <button onClick={() => { setEditandoFactura(l.id); setFormFactura({ numero_factura: l.numero_factura || '', fecha_factura: l.fecha_factura || '', monto_facturado: l.monto_facturado ? String(l.monto_facturado) : '', iva_pct: String(l.iva_pct || '10.5'), observaciones_pago: l.observaciones_pago || '' }) }}
                  style={{ padding: '5px 12px', fontSize: 12, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer', marginBottom: '1rem' }}>
                  ✏ Completar factura
                </button>
              )}

              {/* Form factura */}
              {isEditFactura && (
                <div style={{ background: S.accentLight, borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: S.accent, marginBottom: '0.75rem' }}>Datos de factura</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 10 }}>
                    <div><Lbl>N° Factura</Lbl><input type="text" value={formFactura.numero_factura} onChange={e => setFormFactura({...formFactura, numero_factura: e.target.value})} style={inp} /></div>
                    <div><Lbl>Fecha factura</Lbl><input type="date" value={formFactura.fecha_factura} onChange={e => setFormFactura({...formFactura, fecha_factura: e.target.value})} style={inp} /></div>
                    <div><Lbl>% IVA</Lbl>
                      <select value={formFactura.iva_pct} onChange={e => setFormFactura({...formFactura, iva_pct: e.target.value})} style={inp}>
                        <option value="0">Sin IVA</option>
                        <option value="10.5">10.5%</option>
                        <option value="21">21%</option>
                      </select>
                    </div>
                    <div><Lbl>Neto facturado $</Lbl><input type="number" value={formFactura.monto_facturado} onChange={e => setFormFactura({...formFactura, monto_facturado: e.target.value})} style={inpMono} /></div>
                    {formFactura.monto_facturado && (
                      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                        <div style={{ fontSize: 11, color: S.muted }}>
                          IVA: ${Math.round(parseFloat(formFactura.monto_facturado) * parseFloat(formFactura.iva_pct || 10.5) / 100).toLocaleString('es-AR')}
                          {' · '}Total factura: ${(parseFloat(formFactura.monto_facturado) + Math.round(parseFloat(formFactura.monto_facturado) * parseFloat(formFactura.iva_pct || 10.5) / 100)).toLocaleString('es-AR')}
                        </div>
                        {total && (
                          <div style={{ fontSize: 11, color: S.purple, fontWeight: 600 }}>
                            Paralelo: ${Math.max(0, total - parseFloat(formFactura.monto_facturado) - Math.round(parseFloat(formFactura.monto_facturado) * parseFloat(formFactura.iva_pct || 10.5) / 100)).toLocaleString('es-AR')}
                          </div>
                        )}
                      </div>
                    )}
                    <div><Lbl>Observaciones</Lbl><input type="text" value={formFactura.observaciones_pago} onChange={e => setFormFactura({...formFactura, observaciones_pago: e.target.value})} style={inp} /></div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => guardarFactura(l)} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>Guardar</button>
                    <button onClick={() => setEditandoFactura(null)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                  </div>
                </div>
              )}

              {/* Pagos */}
              {pagos.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 6 }}>Pagos registrados</div>
                  {pagos.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: p.es_negro ? S.purpleLight : S.bg, borderRadius: 5, marginBottom: 4, fontSize: 12 }}>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <span style={{ fontFamily: 'monospace', color: S.muted }}>{p.fecha ? new Date(p.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>${p.monto?.toLocaleString('es-AR')}</span>
                        <span style={{ color: S.muted }}>{p.forma_pago}</span>
                        {p.numero_cheque && <span style={{ color: S.muted }}>#{p.numero_cheque}</span>}
                        {p.es_negro && <span style={{ color: S.purple, fontWeight: 600 }}>PARALELO</span>}
                      </div>
                      <button onClick={async () => {
                        const { data: chAsoc } = await supabase.from('cheques').select('id').eq('pago_compra_id', p.id).single().catch(() => ({ data: null }))
                        if (chAsoc) await supabase.from('cheques').delete().eq('id', chAsoc.id)
                        await supabase.from('pagos_compras').delete().eq('id', p.id)
                        const pagosRest = pagos.filter(pp => pp.id !== p.id)
                        const totalPagadoRest = pagosRest.reduce((s, pp) => s + (pp.monto || 0), 0)
                        const nuevoEstado = total && totalPagadoRest >= total * 0.99 ? 'pagado' : 'pendiente'
                        await supabase.from('lotes').update({ estado_pago: nuevoEstado }).eq('id', l.id)
                        await cargarDatos()
                        await cargarPagos()
                      }} style={{ padding: '2px 8px', fontSize: 10, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 4, cursor: 'pointer' }}>Eliminar</button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', fontSize: 12, fontWeight: 600 }}>
                    <span>Total pagado</span>
                    <span style={{ fontFamily: 'monospace' }}>${totalPagado.toLocaleString('es-AR')}</span>
                  </div>
                  {saldo > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', fontSize: 12, fontWeight: 700, color: S.red }}>
                      <span>Saldo pendiente</span>
                      <span style={{ fontFamily: 'monospace' }}>-${saldo.toLocaleString('es-AR')}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Botón + pago */}
              {!isPagoAbierto && l.precio_compra && (
                <button onClick={() => { setPagoAbierto(l.id); setFormPago({ monto: saldo > 0 ? String(Math.round(saldo)) : '', forma_pago: 'transferencia', fecha: new Date().toISOString().split('T')[0], numero_cheque: '', banco: '', fecha_cobro_cheque: '', fecha_vencimiento_cheque: '', es_paralela: false }) }}
                  style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, background: S.greenLight, border: `1px solid ${S.green}`, color: S.green, borderRadius: 6, cursor: 'pointer' }}>
                  + Registrar pago
                </button>
              )}

              {/* Form pago */}
              {isPagoAbierto && (
                <div style={{ background: S.greenLight, border: `1px solid ${S.green}`, borderRadius: 8, padding: '1rem', marginTop: '0.75rem' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: S.green, marginBottom: '0.75rem' }}>Nuevo pago</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 10 }}>
                    <div><Lbl>Monto $</Lbl><input type="number" value={formPago.monto} onChange={e => setFormPago({...formPago, monto: e.target.value})} style={inpMono} /></div>
                    <div><Lbl>Forma de pago</Lbl>
                      <select value={formPago.forma_pago} onChange={e => setFormPago({...formPago, forma_pago: e.target.value})} style={inp}>
                        <option value="transferencia">Transferencia</option>
                        <option value="efectivo">Efectivo</option>
                        <option value="cheque">Cheque</option>
                        <option value="e-cheq">E-cheq</option>
                      </select>
                    </div>
                    <div><Lbl>Fecha</Lbl><input type="date" value={formPago.fecha} onChange={e => setFormPago({...formPago, fecha: e.target.value})} style={inp} /></div>
                    {['cheque','e-cheq'].includes(formPago.forma_pago) && (
                      <>
                        <div><Lbl>N° Cheque</Lbl><input type="text" value={formPago.numero_cheque} onChange={e => setFormPago({...formPago, numero_cheque: e.target.value})} style={inp} /></div>
                        <div><Lbl>Banco</Lbl><input type="text" value={formPago.banco} onChange={e => setFormPago({...formPago, banco: e.target.value})} style={inp} /></div>
                        <div><Lbl>Fecha cobro</Lbl><input type="date" value={formPago.fecha_cobro_cheque} onChange={e => {
                          const fc = e.target.value
                          const fv = fc ? new Date(new Date(fc + 'T12:00:00').getTime() + 30 * 86400000).toISOString().split('T')[0] : ''
                          setFormPago({...formPago, fecha_cobro_cheque: fc, fecha_vencimiento_cheque: fv})
                        }} style={inp} /></div>
                        <div><Lbl>Vencimiento (auto +30d)</Lbl><input type="date" value={formPago.fecha_vencimiento_cheque} onChange={e => setFormPago({...formPago, fecha_vencimiento_cheque: e.target.value})} style={inp} /></div>
                      </>
                    )}
                    <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: S.purple, cursor: 'pointer' }}>
                        <input type="checkbox" checked={formPago.es_paralela} onChange={e => setFormPago({...formPago, es_paralela: e.target.checked})} />
                        Pago en cuenta paralela
                      </label>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => registrarPago(l)} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Registrar'}</button>
                    <button onClick={() => setPagoAbierto(null)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
} 
