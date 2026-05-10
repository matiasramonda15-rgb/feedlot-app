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

function SecTitle({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>{children}</div>
}

const CULTIVOS = ['Soja', 'Maiz', 'Trigo', 'Alfalfa', 'Girasol', 'Sorgo', 'Otro']
const TIPOS_AGRO = ['Herbicida', 'Fungicida', 'Insecticida', 'Fertilizante', 'Coadyuvante', 'Otro']
const CATEGORIAS_GASTO = ['Semilla', 'Fertilizante', 'Herbicida', 'Fungicida', 'Insecticida', 'Laboreo', 'Siembra', 'Cosecha', 'Flete', 'Seguro', 'Arriendo', 'Otro']
const LABORES = ['Pulverización', 'Fertilización', 'Siembra', 'Cosecha', 'Roturación', 'Rastreo', 'Otro']

export default function Agricultura({ usuario }) {
  const [tab, setTab] = useState('campanas')
  const [loading, setLoading] = useState(true)

  const [potreros, setPotreros] = useState([])
  const [campanas, setCampanas] = useState([])
  const [gastosCampana, setGastosCampana] = useState([])
  const [ventasGrano, setVentasGrano] = useState([])
  const [agroquimicos, setAgroquimicos] = useState([])
  const [ingresosAgro, setIngresosAgro] = useState([])
  const [ordenes, setOrdenes] = useState([])
  const [maquinaria, setMaquinaria] = useState([])

  const [campanaSelId, setCampanaSelId] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Forms
  const [showFormCampana, setShowFormCampana] = useState(false)
  const [showFormGasto, setShowFormGasto] = useState(false)
  const [showFormVenta, setShowFormVenta] = useState(false)
  const [showFormAgro, setShowFormAgro] = useState(false)
  const [showFormIngresoAgro, setShowFormIngresoAgro] = useState(false)
  const [showFormOrden, setShowFormOrden] = useState(false)

  const [formCampana, setFormCampana] = useState({ potrero_id: '', cultivo: 'Soja', anio: new Date().getFullYear(), fecha_siembra: '', observaciones: '' })
  const [formGasto, setFormGasto] = useState({ campana_id: '', categoria: 'Semilla', descripcion: '', monto: '', fecha: new Date().toISOString().split('T')[0], proveedor: '' })
  const [formVenta, setFormVenta] = useState({ campana_id: '', cultivo: '', kg: '', precio_kg: '', comprador: '', fecha: new Date().toISOString().split('T')[0], destino: 'venta', observaciones: '' })
  const [formAgro, setFormAgro] = useState({ nombre: '', tipo: 'Herbicida', unidad: 'litros', stock_minimo: '' })
  const [formIngresoAgro, setFormIngresoAgro] = useState({ agroquimico_id: '', cantidad: '', precio_unitario: '', proveedor: '', fecha: new Date().toISOString().split('T')[0] })
  const [formOrden, setFormOrden] = useState({ potrero_id: '', campana_id: '', labor: 'Pulverización', fecha: new Date().toISOString().split('T')[0], hectareas: '', maquina_id: '', observaciones: '', agroquimicos: [] })
  const [ordenAgro, setOrdenAgro] = useState([{ agroquimico_id: '', cantidad: '', dosis_por_ha: '' }])

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: pot }, { data: cam }, { data: gc }, { data: vg }, { data: agro }, { data: ia }, { data: ord }, { data: maq }] = await Promise.all([
      supabase.from('potreros').select('*').eq('activo', true).order('nombre'),
      supabase.from('campanas').select('*, potreros(nombre, hectareas)').order('anio', { ascending: false }),
      supabase.from('gastos_campana').select('*').order('fecha', { ascending: false }),
      supabase.from('ventas_grano').select('*').order('fecha', { ascending: false }),
      supabase.from('agroquimicos').select('*').order('nombre'),
      supabase.from('ingresos_agroquimicos').select('*, agroquimicos(nombre, unidad)').order('fecha', { ascending: false }).limit(50),
      supabase.from('ordenes_trabajo').select('*, potreros(nombre), campanas(cultivo, anio), maquinaria(nombre), ordenes_agroquimicos(*, agroquimicos(nombre, unidad))').order('fecha', { ascending: false }).limit(50),
      supabase.from('maquinaria').select('*').eq('activo', true).order('nombre'),
    ])
    setPotreros(pot || [])
    setCampanas(cam || [])
    setGastosCampana(gc || [])
    setVentasGrano(vg || [])
    setAgroquimicos(agro || [])
    setIngresosAgro(ia || [])
    setOrdenes(ord || [])
    setMaquinaria(maq || [])
    setLoading(false)
  }

  async function guardarCampana() {
    if (!formCampana.potrero_id || !formCampana.cultivo) { alert('Completá potrero y cultivo'); return }
    setGuardando(true)
    await supabase.from('campanas').insert({ ...formCampana, potrero_id: parseInt(formCampana.potrero_id) })
    await cargar()
    setShowFormCampana(false)
    setFormCampana({ potrero_id: '', cultivo: 'Soja', anio: new Date().getFullYear(), fecha_siembra: '', observaciones: '' })
    setGuardando(false)
  }

  async function guardarGasto() {
    if (!formGasto.campana_id || !formGasto.monto) { alert('Completá campaña y monto'); return }
    setGuardando(true)
    await supabase.from('gastos_campana').insert({ ...formGasto, campana_id: parseInt(formGasto.campana_id), monto: parseFloat(formGasto.monto), registrado_por: usuario?.id })
    await cargar()
    setShowFormGasto(false)
    setGuardando(false)
  }

  async function guardarVenta() {
    if (!formVenta.campana_id || !formVenta.kg) { alert('Completá campaña y kg'); return }
    setGuardando(true)
    const total = formVenta.kg && formVenta.precio_kg ? parseFloat(formVenta.kg) * parseFloat(formVenta.precio_kg) : null
    await supabase.from('ventas_grano').insert({ ...formVenta, campana_id: parseInt(formVenta.campana_id), kg: parseFloat(formVenta.kg), precio_kg: formVenta.precio_kg ? parseFloat(formVenta.precio_kg) : null, total, registrado_por: usuario?.id })
    await cargar()
    setShowFormVenta(false)
    setGuardando(false)
  }

  async function guardarAgroquimico() {
    if (!formAgro.nombre) { alert('Ingresá el nombre'); return }
    setGuardando(true)
    await supabase.from('agroquimicos').insert({ ...formAgro, stock_minimo: parseFloat(formAgro.stock_minimo) || 0 })
    await cargar()
    setShowFormAgro(false)
    setFormAgro({ nombre: '', tipo: 'Herbicida', unidad: 'litros', stock_minimo: '' })
    setGuardando(false)
  }

  async function guardarIngresoAgro() {
    if (!formIngresoAgro.agroquimico_id || !formIngresoAgro.cantidad) { alert('Completá producto y cantidad'); return }
    setGuardando(true)
    const agro = agroquimicos.find(a => String(a.id) === String(formIngresoAgro.agroquimico_id))
    const cant = parseFloat(formIngresoAgro.cantidad)
    const total = formIngresoAgro.precio_unitario ? cant * parseFloat(formIngresoAgro.precio_unitario) : null
    await supabase.from('ingresos_agroquimicos').insert({ ...formIngresoAgro, agroquimico_id: parseInt(formIngresoAgro.agroquimico_id), cantidad: cant, precio_unitario: formIngresoAgro.precio_unitario ? parseFloat(formIngresoAgro.precio_unitario) : null, total, registrado_por: usuario?.id })
    await supabase.from('agroquimicos').update({ stock_actual: (agro?.stock_actual || 0) + cant }).eq('id', agro.id)
    await cargar()
    setShowFormIngresoAgro(false)
    setFormIngresoAgro({ agroquimico_id: '', cantidad: '', precio_unitario: '', proveedor: '', fecha: new Date().toISOString().split('T')[0] })
    setGuardando(false)
  }

  async function guardarOrden() {
    if (!formOrden.potrero_id || !formOrden.labor) { alert('Completá potrero y labor'); return }
    setGuardando(true)
    const { data: orden } = await supabase.from('ordenes_trabajo').insert({
      potrero_id: parseInt(formOrden.potrero_id),
      campana_id: formOrden.campana_id ? parseInt(formOrden.campana_id) : null,
      labor: formOrden.labor,
      fecha: formOrden.fecha,
      hectareas: formOrden.hectareas ? parseFloat(formOrden.hectareas) : null,
      maquina_id: formOrden.maquina_id ? parseInt(formOrden.maquina_id) : null,
      observaciones: formOrden.observaciones || null,
      registrado_por: usuario?.id,
    }).select().single()

    if (orden) {
      // Insertar agroquímicos de la orden y descontar stock
      for (const oa of ordenAgro) {
        if (!oa.agroquimico_id || !oa.cantidad) continue
        const cant = parseFloat(oa.cantidad)
        await supabase.from('ordenes_agroquimicos').insert({ orden_id: orden.id, agroquimico_id: parseInt(oa.agroquimico_id), cantidad: cant, dosis_por_ha: oa.dosis_por_ha ? parseFloat(oa.dosis_por_ha) : null })
        const agro = agroquimicos.find(a => String(a.id) === String(oa.agroquimico_id))
        if (agro) await supabase.from('agroquimicos').update({ stock_actual: Math.max(0, (agro.stock_actual || 0) - cant) }).eq('id', agro.id)
      }
    }
    await cargar()
    setShowFormOrden(false)
    setFormOrden({ potrero_id: '', campana_id: '', labor: 'Pulverización', fecha: new Date().toISOString().split('T')[0], hectareas: '', maquina_id: '', observaciones: '' })
    setOrdenAgro([{ agroquimico_id: '', cantidad: '', dosis_por_ha: '' }])
    setGuardando(false)
  }

  async function eliminar(tabla, id) {
    if (!confirm('¿Eliminar este registro?')) return
    await supabase.from(tabla).delete().eq('id', id)
    await cargar()
  }

  async function cerrarCampana(id) {
    const kg = prompt('¿Cuántos kg se cosecharon?')
    if (kg === null) return
    await supabase.from('campanas').update({ estado: 'cerrada', fecha_cosecha: new Date().toISOString().split('T')[0], kg_cosechados: parseFloat(kg) || null }).eq('id', id)
    await cargar()
  }

  if (loading) return <Loader />

  const campanaSel = campanas.find(c => String(c.id) === String(campanaSelId))
  const gastosSel = gastosCampana.filter(g => String(g.campana_id) === String(campanaSelId))
  const ventasSel = ventasGrano.filter(v => String(v.campana_id) === String(campanaSelId))
  const totalGastosSel = gastosSel.reduce((s, g) => s + (g.monto || 0), 0)
  const totalVentasSel = ventasSel.reduce((s, v) => s + (v.total || 0), 0)

  const TABS = [
    { key: 'campanas', label: 'Campañas' },
    { key: 'stock', label: 'Stock agroquímicos' },
    { key: 'ordenes', label: 'Órdenes de trabajo' },
  ]

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 3 }}>Agricultura</div>
      <div style={{ fontSize: 12, color: S.muted, fontFamily: 'monospace', marginBottom: '1.5rem' }}>
        Campañas · Agroquímicos · Órdenes de trabajo
      </div>

      <div style={{ display: 'flex', borderBottom: `1px solid ${S.border}`, marginBottom: '1.5rem' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '10px 20px', fontSize: 13, fontWeight: tab === t.key ? 600 : 500, cursor: 'pointer', color: tab === t.key ? S.accent : S.muted, background: 'transparent', border: 'none', borderBottom: tab === t.key ? `2px solid ${S.accent}` : '2px solid transparent', marginBottom: -1, fontFamily: "'IBM Plex Sans', sans-serif" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── CAMPAÑAS ── */}
      {tab === 'campanas' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Campañas</div>
            <button onClick={() => setShowFormCampana(!showFormCampana)}
              style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
              + Nueva campaña
            </button>
          </div>

          {showFormCampana && (
            <Card>
              <SecTitle>Nueva campaña</SecTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '.75rem' }}>
                <div><Label>Potrero</Label>
                  <select value={formCampana.potrero_id} onChange={e => setFormCampana({...formCampana, potrero_id: e.target.value})} style={inputStyle}>
                    <option value="">— Seleccioná —</option>
                    {potreros.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.hectareas} ha)</option>)}
                  </select>
                </div>
                <div><Label>Cultivo</Label>
                  <select value={formCampana.cultivo} onChange={e => setFormCampana({...formCampana, cultivo: e.target.value})} style={inputStyle}>
                    {CULTIVOS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div><Label>Año</Label>
                  <input type="number" value={formCampana.anio} onChange={e => setFormCampana({...formCampana, anio: e.target.value})} style={inputStyle} />
                </div>
                <div><Label>Fecha siembra</Label>
                  <input type="date" value={formCampana.fecha_siembra} onChange={e => setFormCampana({...formCampana, fecha_siembra: e.target.value})} style={inputStyle} />
                </div>
                <div style={{ gridColumn: '2/-1' }}><Label>Observaciones</Label>
                  <input type="text" value={formCampana.observaciones} onChange={e => setFormCampana({...formCampana, observaciones: e.target.value})} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowFormCampana(false)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={guardarCampana} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                  {guardando ? 'Guardando...' : 'Crear campaña'}
                </button>
              </div>
            </Card>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1rem' }}>
            {/* Lista campañas */}
            <div>
              {campanas.length === 0 && <div style={{ fontSize: 13, color: S.hint }}>No hay campañas.</div>}
              {campanas.map(c => {
                const gTot = gastosCampana.filter(g => g.campana_id === c.id).reduce((s, g) => s + (g.monto || 0), 0)
                const vTot = ventasGrano.filter(v => v.campana_id === c.id).reduce((s, v) => s + (v.total || 0), 0)
                const isSel = String(c.id) === String(campanaSelId)
                return (
                  <div key={c.id} onClick={() => setCampanaSelId(String(c.id))}
                    style={{ border: `1px solid ${isSel ? S.accent : S.border}`, borderRadius: 8, padding: '.85rem', marginBottom: 8, cursor: 'pointer', background: isSel ? S.accentLight : S.surface }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{c.cultivo} {c.anio}</div>
                      <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: c.estado === 'cerrada' ? S.greenLight : S.amberLight, color: c.estado === 'cerrada' ? S.green : S.amber }}>{c.estado}</span>
                    </div>
                    <div style={{ fontSize: 12, color: S.muted }}>{c.potreros?.nombre} · {c.potreros?.hectareas} ha</div>
                    <div style={{ fontSize: 11, fontFamily: 'monospace', marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: S.red }}>-${gTot.toLocaleString('es-AR')}</span>
                      <span style={{ color: S.green }}>+${vTot.toLocaleString('es-AR')}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Detalle campaña */}
            {!campanaSel ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: S.hint, fontSize: 13 }}>Seleccioná una campaña.</div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{campanaSel.cultivo} {campanaSel.anio} · {campanaSel.potreros?.nombre}</div>
                    <div style={{ fontSize: 12, color: S.muted }}>{campanaSel.kg_cosechados ? `${campanaSel.kg_cosechados.toLocaleString('es-AR')} kg cosechados` : 'Sin cosecha registrada'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {campanaSel.estado !== 'cerrada' && (
                      <button onClick={() => cerrarCampana(campanaSel.id)} style={{ padding: '6px 12px', fontSize: 12, background: S.greenLight, border: `1px solid #97C459`, color: S.green, borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Cerrar campaña</button>
                    )}
                    <button onClick={() => { setFormGasto({...formGasto, campana_id: campanaSelId}); setShowFormGasto(true) }}
                      style={{ padding: '6px 12px', fontSize: 12, background: S.amberLight, border: `1px solid #EF9F27`, color: S.amber, borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>+ Gasto</button>
                    <button onClick={() => { setFormVenta({...formVenta, campana_id: campanaSelId, cultivo: campanaSel.cultivo}); setShowFormVenta(true) }}
                      style={{ padding: '6px 12px', fontSize: 12, background: S.greenLight, border: `1px solid #97C459`, color: S.green, borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>+ Venta grano</button>
                  </div>
                </div>

                {/* Resumen */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: '1rem' }}>
                  {[
                    { label: 'Total gastos', val: `$${totalGastosSel.toLocaleString('es-AR')}`, color: S.red },
                    { label: 'Total ventas', val: `$${totalVentasSel.toLocaleString('es-AR')}`, color: S.green },
                    { label: 'Margen', val: `$${(totalVentasSel - totalGastosSel).toLocaleString('es-AR')}`, color: totalVentasSel >= totalGastosSel ? S.green : S.red },
                  ].map((m, i) => (
                    <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '.85rem' }}>
                      <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>{m.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: m.color }}>{m.val}</div>
                    </div>
                  ))}
                </div>

                {/* Form gasto */}
                {showFormGasto && (
                  <Card>
                    <SecTitle>Nuevo gasto</SecTitle>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '.75rem' }}>
                      <div><Label>Categoría</Label>
                        <select value={formGasto.categoria} onChange={e => setFormGasto({...formGasto, categoria: e.target.value})} style={inputStyle}>
                          {CATEGORIAS_GASTO.map(c => <option key={c}>{c}</option>)}
                        </select>
                      </div>
                      <div><Label>Monto $</Label><input type="number" value={formGasto.monto} onChange={e => setFormGasto({...formGasto, monto: e.target.value})} style={inputStyle} /></div>
                      <div><Label>Fecha</Label><input type="date" value={formGasto.fecha} onChange={e => setFormGasto({...formGasto, fecha: e.target.value})} style={inputStyle} /></div>
                      <div><Label>Descripción</Label><input type="text" value={formGasto.descripcion} onChange={e => setFormGasto({...formGasto, descripcion: e.target.value})} style={inputStyle} /></div>
                      <div><Label>Proveedor</Label><input type="text" value={formGasto.proveedor} onChange={e => setFormGasto({...formGasto, proveedor: e.target.value})} style={inputStyle} /></div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button onClick={() => setShowFormGasto(false)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                      <button onClick={guardarGasto} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
                    </div>
                  </Card>
                )}

                {/* Form venta */}
                {showFormVenta && (
                  <Card>
                    <SecTitle>Nueva venta de grano</SecTitle>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '.75rem' }}>
                      <div><Label>Kg</Label><input type="number" value={formVenta.kg} onChange={e => setFormVenta({...formVenta, kg: e.target.value})} style={inputStyle} /></div>
                      <div><Label>Precio $/kg</Label><input type="number" value={formVenta.precio_kg} onChange={e => setFormVenta({...formVenta, precio_kg: e.target.value})} style={inputStyle} /></div>
                      <div><Label>Fecha</Label><input type="date" value={formVenta.fecha} onChange={e => setFormVenta({...formVenta, fecha: e.target.value})} style={inputStyle} /></div>
                      <div><Label>Destino</Label>
                        <select value={formVenta.destino} onChange={e => setFormVenta({...formVenta, destino: e.target.value})} style={inputStyle}>
                          <option value="venta">Venta</option>
                          <option value="feedlot">Uso feedlot</option>
                          <option value="acopio">Acopio</option>
                        </select>
                      </div>
                      <div><Label>Comprador</Label><input type="text" value={formVenta.comprador} onChange={e => setFormVenta({...formVenta, comprador: e.target.value})} style={inputStyle} /></div>
                      <div><Label>Observaciones</Label><input type="text" value={formVenta.observaciones} onChange={e => setFormVenta({...formVenta, observaciones: e.target.value})} style={inputStyle} /></div>
                    </div>
                    {formVenta.kg && formVenta.precio_kg && (
                      <div style={{ background: S.greenLight, border: '1px solid #97C459', borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: 13, color: S.green }}>
                        Total: <strong>${(parseFloat(formVenta.kg) * parseFloat(formVenta.precio_kg)).toLocaleString('es-AR')}</strong>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button onClick={() => setShowFormVenta(false)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                      <button onClick={guardarVenta} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
                    </div>
                  </Card>
                )}

                {/* Tabla gastos */}
                <Card>
                  <SecTitle>Gastos</SecTitle>
                  <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead><tr style={{ background: S.bg }}>
                        {['Fecha','Categoría','Descripción','Proveedor','Monto',''].map(h => <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {gastosSel.length === 0 && <tr><td colSpan={6} style={{ padding: '1.5rem', textAlign: 'center', color: S.hint }}>Sin gastos.</td></tr>}
                        {gastosSel.map(g => (
                          <tr key={g.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(g.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}</td>
                            <td style={{ padding: '9px 12px' }}><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: S.amberLight, color: S.amber }}>{g.categoria}</span></td>
                            <td style={{ padding: '9px 12px', color: S.muted }}>{g.descripcion || '—'}</td>
                            <td style={{ padding: '9px 12px', color: S.muted }}>{g.proveedor || '—'}</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600, color: S.red }}>${g.monto?.toLocaleString('es-AR')}</td>
                            <td style={{ padding: '9px 12px' }}><button onClick={() => eliminar('gastos_campana', g.id)} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Tabla ventas grano */}
                <Card>
                  <SecTitle>Ventas / destino de grano</SecTitle>
                  <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead><tr style={{ background: S.bg }}>
                        {['Fecha','Destino','Kg','Precio/kg','Total','Comprador',''].map(h => <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {ventasSel.length === 0 && <tr><td colSpan={7} style={{ padding: '1.5rem', textAlign: 'center', color: S.hint }}>Sin ventas.</td></tr>}
                        {ventasSel.map(v => (
                          <tr key={v.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(v.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}</td>
                            <td style={{ padding: '9px 12px' }}><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: v.destino === 'feedlot' ? S.accentLight : S.greenLight, color: v.destino === 'feedlot' ? S.accent : S.green }}>{v.destino}</span></td>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{v.kg?.toLocaleString('es-AR')} kg</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{v.precio_kg ? `$${v.precio_kg.toLocaleString('es-AR')}` : '—'}</td>
                            <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600, color: S.green }}>{v.total ? `$${v.total.toLocaleString('es-AR')}` : '—'}</td>
                            <td style={{ padding: '9px 12px', color: S.muted }}>{v.comprador || '—'}</td>
                            <td style={{ padding: '9px 12px' }}><button onClick={() => eliminar('ventas_grano', v.id)} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── STOCK AGROQUÍMICOS ── */}
      {tab === 'stock' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Stock de agroquímicos</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowFormIngresoAgro(!showFormIngresoAgro)}
                style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                + Ingreso
              </button>
              <button onClick={() => setShowFormAgro(!showFormAgro)}
                style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                + Nuevo producto
              </button>
            </div>
          </div>

          {showFormAgro && (
            <Card>
              <SecTitle>Nuevo producto</SecTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '.75rem' }}>
                <div style={{ gridColumn: '1/3' }}><Label>Nombre</Label><input type="text" value={formAgro.nombre} onChange={e => setFormAgro({...formAgro, nombre: e.target.value})} style={inputStyle} /></div>
                <div><Label>Tipo</Label>
                  <select value={formAgro.tipo} onChange={e => setFormAgro({...formAgro, tipo: e.target.value})} style={inputStyle}>
                    {TIPOS_AGRO.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div><Label>Unidad</Label>
                  <select value={formAgro.unidad} onChange={e => setFormAgro({...formAgro, unidad: e.target.value})} style={inputStyle}>
                    {['litros', 'kg', 'unidades', 'bolsas'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div><Label>Stock mínimo</Label><input type="number" value={formAgro.stock_minimo} onChange={e => setFormAgro({...formAgro, stock_minimo: e.target.value})} style={inputStyle} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowFormAgro(false)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={guardarAgroquimico} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Agregar'}</button>
              </div>
            </Card>
          )}

          {showFormIngresoAgro && (
            <Card>
              <SecTitle>Registrar ingreso</SecTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '.75rem' }}>
                <div><Label>Producto</Label>
                  <select value={formIngresoAgro.agroquimico_id} onChange={e => setFormIngresoAgro({...formIngresoAgro, agroquimico_id: e.target.value})} style={inputStyle}>
                    <option value="">— Seleccioná —</option>
                    {agroquimicos.map(a => <option key={a.id} value={a.id}>{a.nombre} ({a.unidad})</option>)}
                  </select>
                </div>
                <div><Label>Cantidad</Label><input type="number" value={formIngresoAgro.cantidad} onChange={e => setFormIngresoAgro({...formIngresoAgro, cantidad: e.target.value})} style={inputStyle} /></div>
                <div><Label>Precio unitario $</Label><input type="number" value={formIngresoAgro.precio_unitario} onChange={e => setFormIngresoAgro({...formIngresoAgro, precio_unitario: e.target.value})} style={inputStyle} /></div>
                <div><Label>Proveedor</Label><input type="text" value={formIngresoAgro.proveedor} onChange={e => setFormIngresoAgro({...formIngresoAgro, proveedor: e.target.value})} style={inputStyle} /></div>
                <div><Label>Fecha</Label><input type="date" value={formIngresoAgro.fecha} onChange={e => setFormIngresoAgro({...formIngresoAgro, fecha: e.target.value})} style={inputStyle} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowFormIngresoAgro(false)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={guardarIngresoAgro} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </Card>
          )}

          {/* Estado del stock */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: '1.25rem' }}>
            {agroquimicos.map(a => {
              const bajo = a.stock_actual <= a.stock_minimo
              const pct = a.stock_minimo > 0 ? Math.min(100, Math.round(a.stock_actual / (a.stock_minimo * 3) * 100)) : 50
              const barColor = bajo ? S.red : pct < 40 ? S.amber : S.green
              return (
                <div key={a.id} style={{ background: S.surface, border: `1px solid ${bajo ? '#F09595' : S.border}`, borderRadius: 8, padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{a.nombre}</div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: bajo ? S.red : S.muted }}>{bajo ? '⚠ Bajo' : 'OK'}</span>
                  </div>
                  <div style={{ fontSize: 12, color: S.muted, marginBottom: 6 }}>{a.tipo} · {a.unidad}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: barColor, marginBottom: 6 }}>
                    {a.stock_actual?.toLocaleString('es-AR')} {a.unidad}
                  </div>
                  <div style={{ height: 4, background: S.bg, borderRadius: 2, overflow: 'hidden', border: `1px solid ${S.border}` }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: barColor }} />
                  </div>
                  <div style={{ fontSize: 11, color: S.hint, marginTop: 4 }}>Mínimo: {a.stock_minimo?.toLocaleString('es-AR')} {a.unidad}</div>
                </div>
              )
            })}
          </div>

          {/* Historial ingresos */}
          <Card>
            <SecTitle>Historial de ingresos</SecTitle>
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: S.bg }}>
                  {['Fecha','Producto','Cantidad','Precio unit.','Total','Proveedor'].map(h => <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {ingresosAgro.length === 0 && <tr><td colSpan={6} style={{ padding: '1.5rem', textAlign: 'center', color: S.hint }}>Sin ingresos registrados.</td></tr>}
                  {ingresosAgro.map(i => (
                    <tr key={i.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(i.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 600 }}>{i.agroquimicos?.nombre}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{i.cantidad?.toLocaleString('es-AR')} {i.agroquimicos?.unidad}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{i.precio_unitario ? `$${i.precio_unitario.toLocaleString('es-AR')}` : '—'}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{i.total ? `$${i.total.toLocaleString('es-AR')}` : '—'}</td>
                      <td style={{ padding: '9px 12px', color: S.muted }}>{i.proveedor || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── ÓRDENES DE TRABAJO ── */}
      {tab === 'ordenes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Órdenes de trabajo</div>
            <button onClick={() => setShowFormOrden(!showFormOrden)}
              style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
              + Nueva orden
            </button>
          </div>

          {showFormOrden && (
            <Card>
              <SecTitle>Nueva orden de trabajo</SecTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div><Label>Potrero</Label>
                  <select value={formOrden.potrero_id} onChange={e => setFormOrden({...formOrden, potrero_id: e.target.value})} style={inputStyle}>
                    <option value="">— Seleccioná —</option>
                    {potreros.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div><Label>Labor</Label>
                  <select value={formOrden.labor} onChange={e => setFormOrden({...formOrden, labor: e.target.value})} style={inputStyle}>
                    {LABORES.map(l => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div><Label>Fecha</Label><input type="date" value={formOrden.fecha} onChange={e => setFormOrden({...formOrden, fecha: e.target.value})} style={inputStyle} /></div>
                <div><Label>Campaña (opcional)</Label>
                  <select value={formOrden.campana_id} onChange={e => setFormOrden({...formOrden, campana_id: e.target.value})} style={inputStyle}>
                    <option value="">— Sin campaña —</option>
                    {campanas.filter(c => c.estado !== 'cerrada').map(c => <option key={c.id} value={c.id}>{c.cultivo} {c.anio} · {c.potreros?.nombre}</option>)}
                  </select>
                </div>
                <div><Label>Máquina</Label>
                  <select value={formOrden.maquina_id} onChange={e => setFormOrden({...formOrden, maquina_id: e.target.value})} style={inputStyle}>
                    <option value="">— Sin máquina —</option>
                    {maquinaria.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </select>
                </div>
                <div><Label>Hectáreas</Label><input type="number" value={formOrden.hectareas} onChange={e => setFormOrden({...formOrden, hectareas: e.target.value})} style={inputStyle} /></div>
                <div style={{ gridColumn: '1/-1' }}><Label>Observaciones</Label><input type="text" value={formOrden.observaciones} onChange={e => setFormOrden({...formOrden, observaciones: e.target.value})} style={inputStyle} /></div>
              </div>

              {/* Agroquímicos de la orden */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 8 }}>Agroquímicos aplicados</div>
                {ordenAgro.map((oa, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
                    <div><Label>Producto</Label>
                      <select value={oa.agroquimico_id} onChange={e => { const n = [...ordenAgro]; n[i].agroquimico_id = e.target.value; setOrdenAgro(n) }} style={inputStyle}>
                        <option value="">— Seleccioná —</option>
                        {agroquimicos.map(a => <option key={a.id} value={a.id}>{a.nombre} (stock: {a.stock_actual} {a.unidad})</option>)}
                      </select>
                    </div>
                    <div><Label>Cantidad total</Label><input type="number" value={oa.cantidad} onChange={e => { const n = [...ordenAgro]; n[i].cantidad = e.target.value; setOrdenAgro(n) }} style={inputStyle} /></div>
                    <div><Label>Dosis/ha (opcional)</Label><input type="number" value={oa.dosis_por_ha} onChange={e => { const n = [...ordenAgro]; n[i].dosis_por_ha = e.target.value; setOrdenAgro(n) }} style={inputStyle} /></div>
                    <button onClick={() => setOrdenAgro(ordenAgro.filter((_, j) => j !== i))} style={{ padding: '9px 12px', background: S.redLight, border: `1px solid #F09595`, color: S.red, borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>✕</button>
                  </div>
                ))}
                <button onClick={() => setOrdenAgro([...ordenAgro, { agroquimico_id: '', cantidad: '', dosis_por_ha: '' }])}
                  style={{ padding: '6px 12px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>
                  + Agregar producto
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowFormOrden(false)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={guardarOrden} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Confirmar orden'}</button>
              </div>
            </Card>
          )}

          <Card>
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: S.bg }}>
                  {['Fecha','Potrero','Labor','Campaña','Máquina','Ha','Productos aplicados',''].map(h => <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {ordenes.length === 0 && <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay órdenes registradas.</td></tr>}
                  {ordenes.map(o => (
                    <tr key={o.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(o.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 600 }}>{o.potreros?.nombre}</td>
                      <td style={{ padding: '9px 12px' }}>{o.labor}</td>
                      <td style={{ padding: '9px 12px', color: S.muted, fontSize: 12 }}>{o.campanas ? `${o.campanas.cultivo} ${o.campanas.anio}` : '—'}</td>
                      <td style={{ padding: '9px 12px', color: S.muted }}>{o.maquinaria?.nombre || '—'}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{o.hectareas ? `${o.hectareas} ha` : '—'}</td>
                      <td style={{ padding: '9px 12px', fontSize: 12 }}>
                        {o.ordenes_agroquimicos?.length > 0
                          ? o.ordenes_agroquimicos.map(oa => `${oa.agroquimicos?.nombre}: ${oa.cantidad} ${oa.agroquimicos?.unidad}`).join(' · ')
                          : <span style={{ color: S.hint }}>—</span>
                        }
                      </td>
                      <td style={{ padding: '9px 12px' }}><button onClick={() => eliminar('ordenes_trabajo', o.id)} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button></td>
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
