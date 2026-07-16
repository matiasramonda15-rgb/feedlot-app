import React, { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { hoyLocal, fechaLocal } from '../shared/dateUtils'
import { Loader } from './UI'
import { abrirReciboDoble } from '../shared/reciboLogic'
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

const inputStyle = { width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: "'IBM Plex Sans', sans-serif", color: S.text }

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{children}</div>
}

function Card({ children, titulo, style = {} }) {
  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, marginBottom: '1rem', overflow: 'hidden', ...style }}>
      {titulo && <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${S.border}`, fontSize: 13, fontWeight: 600 }}>{titulo}</div>}
      <div style={{ padding: '1.25rem' }}>{children}</div>
    </div>
  )
}

const CULTIVOS = ['Soja', 'Maiz', 'Trigo', 'Alfalfa', 'Girasol', 'Sorgo', 'Otro']
const TIPOS_ORDEN = ['Siembra', 'Pulverizacion', 'Fertilizacion', 'Cosecha', 'Labranza', 'Otro']

export default function Agricultura({ usuario, mobile, nav }) {
  const [pantAgroM, setPantAgroM] = useState('home')
  const [ordenExpandidaM, setOrdenExpandidaM] = useState(null)
  const [tab, setTab] = useState('campos')
  const [loading, setLoading] = useState(true)

  // Data
  const [campos, setCampos] = useState([])
  const [campanas, setCampanas] = useState([])
  const [planes, setPlanes] = useState([])
  const [ordenes, setOrdenes] = useState([])
  const [cosechas, setCosechas] = useState([])
  const [ventasGranos, setVentasGranos] = useState([])
  const [gastosAgro, setGastosAgro] = useState([])
  const [stockAgro, setStockAgro] = useState([])
  const [ingresosAgro, setIngresosAgro] = useState([])
  const [contactos, setContactos] = useState([])
  const [cotizacionDolar, setCotizacionDolar] = useState(1000)
  const [stockInsumosAlim, setStockInsumosAlim] = useState([])

  // UI states
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [campanaActiva, setCampanaActiva] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [
      { data: c }, { data: ca }, { data: pl }, { data: or },
      { data: co }, { data: vg }, { data: ga }, { data: sa },
      { data: ia }, { data: ct }, { data: cfg }, { data: stIns }
    ] = await Promise.all([
      supabase.from('campos').select('*, lotes_agricolas(*)').order('nombre'),
      supabase.from('campanas').select('*').order('año_inicio', { ascending: false }),
      supabase.from('plan_cultivos').select('*, campos(nombre), lotes_agricolas(numero), campanas(nombre)').order('creado_en', { ascending: false }),
      supabase.from('ordenes_trabajo').select('*, campos(nombre, superficie_ha, imagen_url, lotes_agricolas(id, numero, superficie_ha, imagen_url)), campanas(nombre)').order('fecha', { ascending: false }),
      supabase.from('cosechas').select('*, campos(nombre), campanas(nombre)').order('fecha', { ascending: false }),
      supabase.from('ventas_granos').select('*').order('fecha', { ascending: false }),
      supabase.from('gastos_generales').select('*, campos(nombre), campanas(nombre)').eq('actividad', 'Agricultura').order('fecha', { ascending: false }),
      supabase.from('stock_agro').select('*').order('insumo'),
      supabase.from('compras_insumos').select('*').eq('insumo_tipo', 'agro').order('fecha', { ascending: false }).limit(200),
      supabase.from('contactos').select('id, nombre, cuit').eq('activo', true).order('nombre'),
      supabase.from('configuracion').select('clave, valor').eq('clave', 'cotizacion_dolar_agro'),
      supabase.from('stock_insumos').select('id, insumo, unidad, precio_referencia').order('insumo'),
    ])
    setCampos(c || [])
    setCampanas(ca || [])
    setPlanes(pl || [])
    setOrdenes(or || [])
    setCosechas(co || [])
    setVentasGranos(vg || [])
    setGastosAgro(ga || [])
    setStockAgro(sa || [])
    setIngresosAgro(ia || [])
    setContactos(ct || [])
    setCotizacionDolar(parseFloat(cfg?.[0]?.valor) || 1000)
    setStockInsumosAlim(stIns || [])
    // Si hay más de una campaña activa a la vez (algo normal, por ejemplo trigo
    // sin cosechar de la anterior + algo recién sembrado de la nueva), se usa
    // la más nueva como "la" campaña activa por defecto para cargar datos —
    // las demás siguen accesibles igual desde la lista de campañas.
    const activas = (ca || []).filter(c => c.activa).sort((a, b) => (b.año_inicio || 0) - (a.año_inicio || 0))
    if (activas.length > 0) setCampanaActiva(activas[0])
    setLoading(false)
  }

  if (loading) return <Loader />

  // ── MODO CELULAR ──
  if (mobile) {
    if (pantAgroM === 'orden') {
      return <TabOrdenes ordenes={ordenes} campos={campos} campanas={campanas} campanaActiva={campanaActiva} stockAgro={stockAgro} cargar={cargar} contactos={contactos} usuario={usuario} mobile={true} nav={() => setPantAgroM('home')} />
    }
    if (pantAgroM === 'stock') {
      return <TabStockAgro stock={stockAgro} ingresos={ingresosAgro} contactos={contactos} cargar={cargar} usuario={usuario} mobile={true} nav={() => setPantAgroM('home')} cotizacionDolar={cotizacionDolar} />
    }
    const CM = { bg: '#1A2E1A', surface: '#243324', border: '#3A4F3A', text: '#E8F0E8', muted: '#8FA88F', green: '#7EC87E', sans: "'IBM Plex Sans', sans-serif" }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: CM.bg, color: CM.text, fontFamily: CM.sans }}>
        <div style={{ background: CM.surface, padding: '1rem', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, borderBottom: `1px solid ${CM.border}` }}>
          <button onClick={() => nav && nav('home')} style={{ background: 'none', border: 'none', color: CM.green, fontSize: 22, cursor: 'pointer', padding: 0, lineHeight: 1 }}>‹</button>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Agricultura</div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          <button onClick={() => setPantAgroM('orden')}
            style={{ width: '100%', background: CM.surface, border: `1px solid ${CM.border}`, borderRadius: 12, padding: '1.1rem', marginBottom: '.85rem', textAlign: 'left', cursor: 'pointer' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: CM.text, marginBottom: 4 }}>📋 Nueva orden de trabajo</div>
            <div style={{ fontSize: 12, color: CM.muted }}>Siembra, pulverización, cosecha, etc. — con insumos por hectárea</div>
          </button>
          <button onClick={() => setPantAgroM('stock')}
            style={{ width: '100%', background: CM.surface, border: `1px solid ${CM.border}`, borderRadius: 12, padding: '1.1rem', textAlign: 'left', cursor: 'pointer' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: CM.text, marginBottom: 4 }}>📦 Stock de insumos</div>
            <div style={{ fontSize: 12, color: CM.muted }}>Ver cantidades disponibles (solo lectura)</div>
          </button>

          <div style={{ fontSize: 11, fontWeight: 600, color: CM.muted, textTransform: 'uppercase', letterSpacing: '.05em', margin: '1.25rem 0 .65rem' }}>Últimas órdenes de trabajo</div>
          {ordenes.length === 0 && <div style={{ fontSize: 13, color: CM.muted, textAlign: 'center', padding: '1rem' }}>Todavía no hay órdenes cargadas.</div>}
          {ordenes.slice(0, 6).map(o => {
            const loteO = o.campos?.lotes_agricolas?.find(l => l.id === o.lote_id)
            const expandida = ordenExpandidaM === o.id
            return (
              <div key={o.id} style={{ background: CM.surface, border: `1px solid ${expandida ? CM.green : CM.border}`, borderRadius: 10, padding: '.8rem', marginBottom: 8, cursor: 'pointer' }}
                onClick={() => setOrdenExpandidaM(expandida ? null : o.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{o.tipo} — {o.campos?.nombre || '—'}{loteO ? ` · Lote ${loteO.numero}` : ''}</div>
                    <div style={{ fontSize: 11, color: CM.muted, marginTop: 2 }}>
                      {o.fecha ? new Date(o.fecha + 'T12:00:00').toLocaleDateString('es-AR') : '—'}
                      {o.superficie_ha_real ? ` · ${o.superficie_ha_real} ha` : ''}
                      {!o.es_propia && o.proveedor ? ` · ${o.proveedor}` : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: o.estado_pago === 'pagado' ? '#1A3D26' : '#3D2A00', color: o.estado_pago === 'pagado' ? CM.green : '#F5C97A' }}>
                    {o.estado_pago === 'pagado' ? 'Pagado' : 'Pendiente'}
                  </span>
                </div>
                {expandida && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${CM.border}` }} onClick={e => e.stopPropagation()}>
                    {o.observaciones && <div style={{ fontSize: 12, color: CM.muted, marginBottom: 8 }}>Obs: {o.observaciones}</div>}
                    <div style={{ fontSize: 10, fontWeight: 600, color: CM.muted, textTransform: 'uppercase', marginBottom: 6 }}>Insumos aplicados</div>
                    {(!o.productos || o.productos.length === 0) ? (
                      <div style={{ fontSize: 12, color: CM.muted }}>Sin insumos cargados en esta orden.</div>
                    ) : o.productos.map((p, pi) => {
                      const item = stockAgro.find(s => s.id === parseInt(p.id))
                      const total = p.total || (o.superficie_ha_real && p.dosis ? Math.round(parseFloat(p.dosis) * o.superficie_ha_real * 100) / 100 : null)
                      return (
                        <div key={pi} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0' }}>
                          <span>{item?.insumo || '— insumo no encontrado —'}</span>
                          <span style={{ fontFamily: 'monospace', color: CM.green }}>{p.dosis} {item?.unidad || p.unidad}/ha{total ? ` · ${total.toLocaleString('es-AR')} ${item?.unidad || p.unidad} total` : ''}</span>
                        </div>
                      )
                    })}
                    {o.costo_total && <div style={{ fontSize: 12, color: CM.muted, marginTop: 8 }}>Costo: ${(o.costo_total).toLocaleString('es-AR')}</div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const TABS = [
    { key: 'campos', label: 'Campos' },
    { key: 'arriendos', label: 'Arriendos' },
    { key: 'campanas', label: 'Campaña' },
    { key: 'ordenes', label: 'Órdenes de trabajo' },
    { key: 'cosechas', label: 'Cosechas' },
    { key: 'ventas', label: 'Ventas de granos' },
    { key: 'gastos', label: 'Gastos' },
    { key: 'stock', label: 'Stock general' },
    { key: 'rentabilidad', label: '📊 Rentabilidad por lote' },
    { key: 'lluvias', label: '🌧️ Lluvias' },
  ]

  // ── Métricas generales ──
  const hasTotales = campos.reduce((s, c) => s + (c.superficie_ha || 0), 0)
  const cosechaActiva = cosechas.filter(c => c.campana_id === campanaActiva?.id)
  const kgTotales = cosechaActiva.reduce((s, c) => s + (c.kg_totales || 0), 0)
  const ventasActivas = ventasGranos.filter(v => v.campana_id === campanaActiva?.id)
  const ingresosGranos = ventasActivas.reduce((s, v) => s + (v.total || 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 3 }}>Agricultura</div>
          <div style={{ fontSize: 12, color: S.muted }}>
            Campaña activa: <strong>{campanaActiva?.nombre || 'Sin campaña activa'}</strong>
            {campanaActiva && ` · ${campanaActiva.año_inicio}/${campanaActiva.año_fin}`}
          </div>
        </div>
      </div>

      {/* Métricas rápidas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: '1.5rem' }}>
        {[
          { label: 'Hectáreas totales', val: `${hasTotales.toLocaleString('es-AR')} ha`, color: S.accent },
          { label: 'Campos activos', val: campos.length, color: S.accent },
          { label: `Cosecha ${campanaActiva?.nombre || ''}`, val: kgTotales > 0 ? `${(kgTotales / 1000).toLocaleString('es-AR')} tn` : '—', color: S.green },
          { label: 'Ingresos granos', val: ingresosGranos > 0 ? `$${ingresosGranos.toLocaleString('es-AR')}` : '—', color: S.green },
        ].map((m, i) => (
          <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem' }}>
            <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: m.color }}>{m.val}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${S.border}`, marginBottom: '1.5rem', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '10px 18px', fontSize: 13, fontWeight: tab === t.key ? 600 : 500, cursor: 'pointer', color: tab === t.key ? S.accent : S.muted, background: 'transparent', border: 'none', borderBottom: tab === t.key ? `2px solid ${S.accent}` : '2px solid transparent', marginBottom: -1, fontFamily: "'IBM Plex Sans', sans-serif", whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── CAMPOS ── */}
      {tab === 'campos' && <TabCampos campos={campos} campanas={campanas} planes={planes} campanaActiva={campanaActiva} cargar={cargar} />}
      {tab === 'arriendos' && <TabArriendos campos={campos} cargar={cargar} contactos={contactos} usuario={usuario} />}
      {tab === 'campanas' && <TabCampanas campanas={campanas} campos={campos} setCampanaActiva={setCampanaActiva} campanaActiva={campanaActiva} cargar={cargar} />}
      {tab === 'ordenes' && <TabOrdenes ordenes={ordenes} campos={campos} campanas={campanas} campanaActiva={campanaActiva} stockAgro={stockAgro} cargar={cargar} contactos={contactos} usuario={usuario} />}
      {tab === 'cosechas' && <TabCosechas cosechas={cosechas} campos={campos} campanas={campanas} campanaActiva={campanaActiva} planes={planes} cargar={cargar} contactos={contactos} />}
      {tab === 'ventas' && <TabVentasGranos ventas={ventasGranos} campos={campos} campanas={campanas} campanaActiva={campanaActiva} cosechas={cosechas} cargar={cargar} stockInsumosAlim={stockInsumosAlim} usuario={usuario} />}
      {tab === 'gastos' && <TabGastos gastos={gastosAgro} campos={campos} campanas={campanas} campanaActiva={campanaActiva} cargar={cargar} />}
      {tab === 'stock' && <TabStockAgro stock={stockAgro} ingresos={ingresosAgro} contactos={contactos} cargar={cargar} usuario={usuario} cotizacionDolar={cotizacionDolar} />}
      {tab === 'rentabilidad' && <TabRentabilidad campos={campos} campanas={campanas} campanaActiva={campanaActiva} ordenes={ordenes} cosechas={cosechas} ventasGranos={ventasGranos} stockAgro={stockAgro} planes={planes} gastos={gastosAgro} />}
      {tab === 'lluvias' && <TabLluvias usuario={usuario} />}
    </div>
  )
}

// ── TAB CAMPOS ──
function TabCampos({ campos, campanas, planes, campanaActiva, cargar }) {
  const [showForm, setShowForm] = useState(false)
  const [pagarAhora, setPagarAhora] = useState(true)
  const [showPagos, setShowPagos] = useState(false)
  const [seleccionadas, setSeleccionadas] = useState([])
  const [formPagoGrupal, setFormPagoGrupal] = useState({ fecha: hoyLocal(), pagos: [{ ...PAGO_INIT_ORDEN }] })
  const [guardandoPago, setGuardandoPago] = useState(false)
  const [form, setForm] = useState({ nombre: '', superficie_ha: '', propietario: '', arrendamiento_tn_ha: '', forma_pago_arriendo: 'semestral', dia_vencimiento_arriendo: '', ubicacion: '', imagen_url: '' })
  const [editando, setEditando] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [selectedCampo, setSelectedCampo] = useState(null)
  const [showLoteForm, setShowLoteForm] = useState(false)
  const [formLote, setFormLote] = useState({ numero: '', superficie_ha: '', imagen_url: '' })

  async function guardar() {
    if (!form.nombre) { alert('Ingresá el nombre del campo'); return }
    setGuardando(true)
    const campoData = { nombre: form.nombre, superficie_ha: parseFloat(form.superficie_ha) || null, propietario: form.propietario || null, arrendamiento_tn_ha: parseFloat(form.arrendamiento_tn_ha) || null, forma_pago_arriendo: form.forma_pago_arriendo || 'semestral', dia_vencimiento_arriendo: parseInt(form.dia_vencimiento_arriendo) || null, ubicacion: form.ubicacion || null, imagen_url: form.imagen_url || null }
    const { error } = editando
      ? await supabase.from('campos').update(campoData).eq('id', editando)
      : await supabase.from('campos').insert({ ...campoData, activo: true })
    if (error) { alert('Error al guardar el campo: ' + error.message); setGuardando(false); return }
    await cargar()
    setShowForm(false)
    setEditando(null)
    setForm({ nombre: '', superficie_ha: '', propietario: '', arrendamiento_tn_ha: '', forma_pago_arriendo: 'semestral', dia_vencimiento_arriendo: '', ubicacion: '', imagen_url: '' })
    setGuardando(false)
  }

  async function guardarLote() {
    if (!formLote.numero) { alert('Ingresá el número de lote'); return }
    const { error } = await supabase.from('lotes_agricolas').insert({ campo_id: selectedCampo.id, numero: formLote.numero, superficie_ha: parseFloat(formLote.superficie_ha) || null, imagen_url: formLote.imagen_url || null })
    if (error) { alert('Error al guardar el lote: ' + error.message); return }
    await cargar()
    setShowLoteForm(false)
    setFormLote({ numero: '', superficie_ha: '', imagen_url: '' })
  }

  async function eliminarLote(id) {
    if (!confirm('¿Eliminar este lote?')) return
    const { error } = await supabase.from('lotes_agricolas').delete().eq('id', id)
    if (error) { alert('Error al eliminar: ' + error.message); return }
    await cargar()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Campos arrendados</div>
        <button onClick={() => { setShowForm(!showForm); setEditando(null); setForm({ nombre: '', superficie_ha: '', propietario: '', arrendamiento_tn_ha: '', forma_pago_arriendo: 'semestral', dia_vencimiento_arriendo: '', ubicacion: '', imagen_url: '' }) }}
          style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          + Nuevo campo
        </button>
      </div>

      {showForm && (
        <Card titulo={editando ? 'Editar campo' : 'Nuevo campo'}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div><Label>Nombre del campo *</Label><input type="text" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} style={inputStyle} /></div>
            <div><Label>Superficie total (ha)</Label><input type="number" value={form.superficie_ha} onChange={e => setForm({...form, superficie_ha: e.target.value})} style={inputStyle} /></div>
            <div><Label>Propietario</Label><input type="text" value={form.propietario} onChange={e => setForm({...form, propietario: e.target.value})} style={inputStyle} /></div>
            <div><Label>Arrendamiento tn soja/ha/año</Label><input type="number" value={form.arrendamiento_tn_ha} onChange={e => setForm({...form, arrendamiento_tn_ha: e.target.value})} placeholder="ej. 9" style={inputStyle} /></div>
            <div>
              <Label>Forma de pago arriendo</Label>
              <select value={form.forma_pago_arriendo} onChange={e => setForm({...form, forma_pago_arriendo: e.target.value})} style={inputStyle}>
                <option value="mensual">Mensual</option>
                <option value="cuatrimestral">Cuatrimestral</option>
                <option value="semestral">Semestral</option>
                <option value="anual">Anual</option>
              </select>
            </div>
            <div><Label>Ubicación</Label><input type="text" value={form.ubicacion} onChange={e => setForm({...form, ubicacion: e.target.value})} style={inputStyle} /></div>
            <div style={{ gridColumn: '1/-1' }}><Label>Link del mapa (URL de imagen)</Label><input type="url" value={form.imagen_url} onChange={e => setForm({...form, imagen_url: e.target.value})} style={inputStyle} placeholder="https://..." /></div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={guardar} disabled={guardando}
              style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
            <button onClick={() => { setShowForm(false); setEditando(null) }}
              style={{ padding: '8px 16px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </Card>
      )}

      {campos.length === 0 && !showForm && (
        <div style={{ padding: '3rem', textAlign: 'center', color: S.hint, background: S.surface, borderRadius: 10, border: `1px solid ${S.border}` }}>
          No hay campos registrados. Agregá el primero.
        </div>
      )}

      {campos.map(c => {
        const planesDelCampo = planes.filter(p => p.campo_id === c.id && p.campana_id === campanaActiva?.id)
        const arrendamientoAnual = c.arrendamiento_tn_ha && c.superficie_ha ? c.arrendamiento_tn_ha * c.superficie_ha : null
        return (
          <div key={c.id} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, marginBottom: '1rem', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{c.nombre}</div>
                <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>
                  {c.superficie_ha ? `${c.superficie_ha.toLocaleString('es-AR')} ha` : '—'}
                  {c.propietario && ` · ${c.propietario}`}
                  {c.ubicacion && ` · ${c.ubicacion}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {c.imagen_url && (
                  <a href={c.imagen_url} target="_blank" rel="noopener noreferrer"
                    style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, background: '#E8EFF8', border: '1px solid #378ADD', color: '#1A3D6B', borderRadius: 6, textDecoration: 'none' }}>
                    🗺 Ver mapa
                  </a>
                )}
                {c.arrendamiento_tn_ha && (
                  <div style={{ textAlign: 'right', marginRight: 8 }}>
                    <div style={{ fontSize: 10, color: S.muted }}>Arrendamiento</div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 700, color: S.red }}>{c.arrendamiento_tn_ha} tn/ha · {arrendamientoAnual?.toLocaleString('es-AR')} tn/año</div>
                    <div style={{ fontSize: 10, color: S.muted }}>{c.forma_pago_arriendo}</div>
                  </div>
                )}
                <button onClick={() => { setEditando(c.id); setForm({ nombre: c.nombre, superficie_ha: c.superficie_ha || '', propietario: c.propietario || '', arrendamiento_tn_ha: c.arrendamiento_tn_ha || '', forma_pago_arriendo: c.forma_pago_arriendo || 'semestral', dia_vencimiento_arriendo: c.dia_vencimiento_arriendo || '', ubicacion: c.ubicacion || '', imagen_url: c.imagen_url || '' }); setShowForm(true); setSelectedCampo(null) }}
                  style={{ padding: '5px 10px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>
                  Editar
                </button>
                <button onClick={() => setSelectedCampo(selectedCampo?.id === c.id ? null : c)}
                  style={{ padding: '5px 10px', fontSize: 11, background: S.bg, border: `1px solid ${S.border}`, color: S.muted, borderRadius: 5, cursor: 'pointer' }}>
                  {selectedCampo?.id === c.id ? 'Ocultar lotes' : `Lotes (${(c.lotes_agricolas || []).length})`}
                </button>
              </div>
            </div>

            {/* Cultivos de campaña activa */}
            {planesDelCampo.length > 0 && (
              <div style={{ padding: '8px 1.25rem', background: S.accentLight, borderBottom: `1px solid ${S.border}`, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: S.accent, fontWeight: 600 }}>Campaña actual:</span>
                {planesDelCampo.map(p => (
                  <span key={p.id} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: S.greenLight, color: S.green, fontWeight: 600 }}>
                    {p.cultivo} · {p.superficie_ha ? `${p.superficie_ha} ha` : ''}
                  </span>
                ))}
              </div>
            )}

            {/* Lotes */}
            {selectedCampo?.id === c.id && (
              <div style={{ padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: S.muted }}>Lotes</div>
                  <button onClick={() => setShowLoteForm(!showLoteForm)}
                    style={{ padding: '4px 10px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>
                    + Agregar lote
                  </button>
                </div>
                {showLoteForm && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <Label>N° Lote</Label>
                      <input type="text" value={formLote.numero} onChange={e => setFormLote({...formLote, numero: e.target.value})} placeholder="ej. 1, 2A" style={{...inputStyle, fontSize: 12}} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <Label>Superficie (ha)</Label>
                      <input type="number" value={formLote.superficie_ha} onChange={e => setFormLote({...formLote, superficie_ha: e.target.value})} style={{...inputStyle, fontSize: 12}} />
                    </div>
                    <div style={{ flex: 2 }}>
                      <Label>Link del mapa (URL)</Label>
                      <input type="url" value={formLote.imagen_url} onChange={e => setFormLote({...formLote, imagen_url: e.target.value})} placeholder="https://..." style={{...inputStyle, fontSize: 12}} />
                    </div>
                    <button onClick={guardarLote} style={{ padding: '9px 14px', fontSize: 12, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>Guardar</button>
                    <button onClick={() => setShowLoteForm(false)} style={{ padding: '9px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                  {(c.lotes_agricolas || []).map(l => (
                    <div key={l.id} style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>Lote {l.numero}</div>
                        {l.superficie_ha && <div style={{ fontSize: 11, color: S.muted }}>{l.superficie_ha} ha</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        {l.imagen_url && (
                          <a href={l.imagen_url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 11, color: '#1A3D6B', textDecoration: 'none' }}>🗺</a>
                        )}
                        <button onClick={() => eliminarLote(l.id)} style={{ background: 'none', border: 'none', color: S.red, cursor: 'pointer', fontSize: 12 }}>✕</button>
                      </div>
                    </div>
                  ))}
                  {(c.lotes_agricolas || []).length === 0 && <div style={{ fontSize: 12, color: S.hint, gridColumn: '1/-1' }}>Sin lotes registrados</div>}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── TAB CAMPAÑAS ──
function TabCampanas({ campanas, campos, setCampanaActiva, campanaActiva, cargar }) {
  const [showForm, setShowForm] = useState(false)
  const [pagarAhora, setPagarAhora] = useState(true)
  const [showPagos, setShowPagos] = useState(false)
  const [seleccionadas, setSeleccionadas] = useState([])
  const [formPagoGrupal, setFormPagoGrupal] = useState({ fecha: hoyLocal(), pagos: [{ ...PAGO_INIT_ORDEN }] })
  const [guardandoPago, setGuardandoPago] = useState(false)
  const [form, setForm] = useState({ nombre: '', año_inicio: new Date().getFullYear(), año_fin: new Date().getFullYear() + 1 })
  const [guardando, setGuardando] = useState(false)
  const [showPlanForm, setShowPlanForm] = useState(false)
  const [formPlan, setFormPlan] = useState({ campo_id: '', lote_id: '', cultivo: '', superficie_ha: '', fecha_siembra: '', variedad: '' })
  const [planes, setPlanes] = useState([])
  const [campanaVista, setCampanaVista] = useState(null)
  const [lotesDeCampo, setLotesDeCampo] = useState([])

  useEffect(() => {
    if (campanaActiva) { setCampanaVista(campanaActiva.id); cargarPlanes(campanaActiva.id) }
  }, [campanaActiva])

  async function cargarPlanes(campanaId) {
    const { data } = await supabase.from('plan_cultivos').select('*, campos(nombre), lotes_agricolas(numero)').eq('campana_id', campanaId)
    setPlanes(data || [])
  }

  async function guardar() {
    if (!form.nombre) { alert('Ingresá el nombre'); return }
    setGuardando(true)
    const { error } = await supabase.from('campanas').insert({ ...form, año_inicio: parseInt(form.año_inicio), año_fin: parseInt(form.año_fin), activa: false })
    if (error) { alert('Error al guardar la campaña: ' + error.message); setGuardando(false); return }
    await cargar()
    setShowForm(false)
    setGuardando(false)
  }

  async function activar(c) {
    // No se desactivan las demás — es normal tener más de una campaña activa
    // a la vez (ej. trigo sin cosechar de la campaña anterior conviviendo con
    // maíz recién sembrado de la nueva).
    const { error } = await supabase.from('campanas').update({ activa: true }).eq('id', c.id)
    if (error) { alert('Error al activar la campaña: ' + error.message); return }
    setCampanaActiva(c)
    await cargar()
  }

  async function desactivar(c) {
    if (!confirm(`¿Desactivar la campaña ${c.nombre}? (por ejemplo, porque ya se terminó de cosechar todo)`)) return
    const { error } = await supabase.from('campanas').update({ activa: false }).eq('id', c.id)
    if (error) { alert('Error al desactivar la campaña: ' + error.message); return }
    await cargar()
  }

  async function guardarPlan() {
    if (!formPlan.campo_id || !formPlan.cultivo) { alert('Seleccioná campo y cultivo'); return }
    const { error } = await supabase.from('plan_cultivos').insert({
      campo_id: parseInt(formPlan.campo_id),
      lote_id: formPlan.lote_id ? parseInt(formPlan.lote_id) : null,
      campana_id: campanaVista,
      cultivo: formPlan.cultivo,
      superficie_ha: parseFloat(formPlan.superficie_ha) || null,
      fecha_siembra: formPlan.fecha_siembra || null,
      variedad: formPlan.variedad || null,
    })
    if (error) { alert('Error al guardar el plan: ' + error.message); return }
    // Si este plan ya tiene fecha de siembra (no es solo una intención, ya se
    // sembró de verdad) y la campaña todavía no estaba activa, se activa sola
    // — sin desactivar las demás, porque es normal tener más de una campaña
    // activa a la vez (por ejemplo, trigo sin cosechar de la campaña anterior
    // conviviendo con maíz recién sembrado de la nueva).
    const campanaDeEsteItem = campanas.find(c => c.id === campanaVista)
    if (formPlan.fecha_siembra && campanaDeEsteItem && !campanaDeEsteItem.activa) {
      await supabase.from('campanas').update({ activa: true }).eq('id', campanaVista)
      await cargar()  // refresca campanaActiva a nivel de todo el módulo
    }
    await cargarPlanes(campanaVista)
    setShowPlanForm(false)
    setFormPlan({ campo_id: '', lote_id: '', cultivo: '', superficie_ha: '', fecha_siembra: '', variedad: '' })
  }

  const campanaSeleccionada = campanas.find(c => c.id === campanaVista)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Campañas</div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          + Nueva campaña
        </button>
      </div>

      {showForm && (
        <Card titulo="Nueva campaña">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div><Label>Nombre *</Label><input type="text" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} placeholder="ej. Campaña 2025/26" style={inputStyle} /></div>
            <div><Label>Año inicio</Label><input type="number" value={form.año_inicio} onChange={e => setForm({...form, año_inicio: e.target.value})} style={inputStyle} /></div>
            <div><Label>Año fin</Label><input type="number" value={form.año_fin} onChange={e => setForm({...form, año_fin: e.target.value})} style={inputStyle} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={guardar} disabled={guardando} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
            <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </Card>
      )}

      {/* Lista de campañas */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {campanas.map(c => (
          <button key={c.id} onClick={() => { setCampanaVista(c.id); cargarPlanes(c.id) }}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: campanaVista === c.id ? 700 : 400, background: campanaVista === c.id ? S.accent : S.surface, border: `1px solid ${campanaVista === c.id ? S.accent : S.border}`, color: campanaVista === c.id ? '#fff' : S.text, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            {c.nombre}
            {c.activa && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: S.greenLight, color: S.green }}>Activa</span>}
          </button>
        ))}
      </div>

      {campanaSeleccionada && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{campanaSeleccionada.nombre} — Plan de cultivos</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {!campanaSeleccionada.activa ? (
                <button onClick={() => activar(campanaSeleccionada)} style={{ padding: '6px 12px', fontSize: 12, background: S.greenLight, border: `1px solid ${S.green}`, color: S.green, borderRadius: 6, cursor: 'pointer' }}>
                  Activar campaña
                </button>
              ) : (
                <button onClick={() => desactivar(campanaSeleccionada)} style={{ padding: '6px 12px', fontSize: 12, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 6, cursor: 'pointer' }}>
                  Desactivar campaña
                </button>
              )}
              <button onClick={() => setShowPlanForm(!showPlanForm)} style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                + Agregar cultivo
              </button>
            </div>
          </div>

          {showPlanForm && (
            <Card>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <Label>Campo *</Label>
                  <select value={formPlan.campo_id} onChange={e => {
                    const campo = campos.find(c => c.id === parseInt(e.target.value))
                    setLotesDeCampo(campo?.lotes_agricolas || [])
                    setFormPlan({...formPlan, campo_id: e.target.value, lote_id: ''})
                  }} style={inputStyle}>
                    <option value="">— Seleccioná —</option>
                    {campos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Lote (opcional)</Label>
                  <select value={formPlan.lote_id} onChange={e => setFormPlan({...formPlan, lote_id: e.target.value})} style={inputStyle}>
                    <option value="">Todo el campo</option>
                    {lotesDeCampo.map(l => <option key={l.id} value={l.id}>Lote {l.numero} — {l.superficie_ha} ha</option>)}
                  </select>
                </div>
                <div>
                  <Label>Cultivo *</Label>
                  <select value={formPlan.cultivo} onChange={e => setFormPlan({...formPlan, cultivo: e.target.value})} style={inputStyle}>
                    <option value="">— Seleccioná —</option>
                    {CULTIVOS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Superficie (ha)</Label>
                  <input type="number" value={formPlan.superficie_ha} onChange={e => setFormPlan({...formPlan, superficie_ha: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <Label>Fecha siembra</Label>
                  <input type="date" value={formPlan.fecha_siembra} onChange={e => setFormPlan({...formPlan, fecha_siembra: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <Label>Variedad</Label>
                  <input type="text" value={formPlan.variedad} onChange={e => setFormPlan({...formPlan, variedad: e.target.value})} placeholder="ej. DM 5.1i" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={guardarPlan} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>Guardar</button>
                <button onClick={() => setShowPlanForm(false)} style={{ padding: '8px 16px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
              </div>
            </Card>
          )}

          <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: S.bg }}>
                {['Campo', 'Lote', 'Cultivo', 'Superficie', 'Fecha siembra', 'Variedad', ''].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 10, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {planes.length === 0 && <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay cultivos planificados para esta campaña.</td></tr>}
                {planes.map(p => (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{p.campos?.nombre}</td>
                    <td style={{ padding: '8px 12px', color: S.muted }}>{p.lotes_agricolas ? `Lote ${p.lotes_agricolas.numero}` : 'Todo el campo'}</td>
                    <td style={{ padding: '8px 12px' }}><span style={{ padding: '2px 8px', borderRadius: 4, background: S.greenLight, color: S.green, fontSize: 11, fontWeight: 600 }}>{p.cultivo}</span></td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{p.superficie_ha ? `${p.superficie_ha} ha` : '—'}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, color: S.muted }}>{p.fecha_siembra ? new Date(p.fecha_siembra + 'T12:00:00').toLocaleDateString('es-AR') : '—'}</td>
                    <td style={{ padding: '8px 12px', color: S.muted }}>{p.variedad || '—'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={async () => { if (!confirm('¿Eliminar?')) return; await supabase.from('plan_cultivos').delete().eq('id', p.id); cargarPlanes(campanaVista) }}
                        style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// (PAGO_INIT_ORDEN, PAGO_INIT_AGRO, PAGO_INIT_ARR ahora vienen unificadas del
// módulo compartido ./PagoFormulario, como PAGO_INIT)
const PAGO_INIT_ORDEN = PAGO_INIT
const PAGO_INIT_AGRO = PAGO_INIT
const PAGO_INIT_ARR = PAGO_INIT

function generarOrdenTrabajo(orden, campo, lote, stockAgro) {
  const fecha = orden.fecha ? new Date(orden.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
  const superficie = orden.superficie_ha_real || lote?.superficie_ha || campo?.superficie_ha || '—'
  const productos = orden.productos || []

  const filasProductos = productos.map(p => {
    const item = stockAgro.find(s => String(s.id) === String(p.id))
    const totalUso = p.dosis && superficie !== '—' ? parseFloat(p.dosis) * parseFloat(superficie) : null
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #ddd;font-weight:500;">${item?.insumo || p.nombre || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #ddd;text-align:center;">${item?.tipo || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #ddd;text-align:center;font-weight:600;">${p.dosis || '—'} ${p.unidad || item?.unidad || ''}/ha</td>
      <td style="padding:8px 12px;border-bottom:1px solid #ddd;text-align:right;font-weight:700;color:#1E5C2E;">${totalUso ? totalUso.toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' ' + (item?.unidad || '') : '—'}</td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Orden de trabajo — ${orden.tipo}</title>
  <style>
    @media print { .no-print { display: none; } body { margin: 0; } }
    body { font-family: Arial, sans-serif; background: #fff; margin: 0; padding: 0; }
    * { box-sizing: border-box; }
  </style>
</head>
<body>
  <div class="no-print" style="position:fixed;top:10px;right:10px;z-index:999;">
    <button onclick="window.print()" style="padding:8px 20px;font-size:14px;cursor:pointer;background:#1A3D6B;color:#fff;border:none;border-radius:6px;margin-right:8px;">🖨️ Imprimir / Guardar PDF</button>
    <button onclick="window.close()" style="padding:8px 14px;font-size:13px;cursor:pointer;background:#fff;border:1px solid #ccc;border-radius:6px;">Cerrar</button>
  </div>
  <div style="max-width:680px;margin:0 auto;padding:24px;">
    <!-- Header verde -->
    <div style="background:#1E5C2E;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;">
      <div style="font-size:18px;font-weight:900;letter-spacing:1px;margin-bottom:4px;">ORDEN DE TRABAJO — ${orden.tipo.toUpperCase()}</div>
      <div style="font-size:13px;opacity:0.9;">${campo?.nombre || '—'} ${lote ? `· Lote ${lote.numero}` : ''} · ${superficie} ha · ${fecha}</div>
    </div>
    <!-- Cuerpo -->
    <div style="border:2px solid #1E5C2E;border-top:none;border-radius:0 0 8px 8px;padding:20px;">
      ${orden.proveedor ? `<div style="margin-bottom:16px;font-size:13px;"><span style="color:#666;">Operario / Equipo:</span> <strong>${orden.proveedor}</strong></div>` : ''}
      ${orden.descripcion ? `<div style="margin-bottom:16px;font-size:13px;"><span style="color:#666;">Descripción:</span> ${orden.descripcion}</div>` : ''}
      ${productos.length > 0 ? `
      <div style="font-size:11px;font-weight:700;color:#1E5C2E;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;">Insumos aplicados</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f0f7f1;">
            <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #1E5C2E;font-size:11px;text-transform:uppercase;color:#1E5C2E;">Producto</th>
            <th style="padding:8px 12px;text-align:center;border-bottom:2px solid #1E5C2E;font-size:11px;text-transform:uppercase;color:#1E5C2E;">Tipo</th>
            <th style="padding:8px 12px;text-align:center;border-bottom:2px solid #1E5C2E;font-size:11px;text-transform:uppercase;color:#1E5C2E;">Dosis/ha</th>
            <th style="padding:8px 12px;text-align:right;border-bottom:2px solid #1E5C2E;font-size:11px;text-transform:uppercase;color:#1E5C2E;">Total (${superficie} ha)</th>
          </tr>
        </thead>
        <tbody>${filasProductos}</tbody>
      </table>` : '<div style="color:#999;font-size:13px;">Sin productos asignados.</div>'}
      ${orden.observaciones ? `<div style="margin-top:16px;padding:10px 14px;background:#f9f9f9;border-radius:6px;font-size:13px;color:#555;">${orden.observaciones}</div>` : ''}
    </div>
    <!-- Footer -->
    <div style="text-align:right;font-size:10px;color:#aaa;margin-top:8px;">RAMONDA HNOS S.A. · Pedro Barciocco 1221 · TEL: 3574-442656</div>
  </div>
</body>
</html>`

  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
}

function generarReciboOrden(ordenOrdenes, camposLista, campanas, stockAgro) {
  // Acepta una sola orden (uso normal desde la fila individual) o un array de
  // varias (cuando se pagan juntas, aunque sean de campos distintos) — en ese
  // caso arma UN SOLO comprobante con el detalle de cada campo, no uno por cada.
  const ordenes = Array.isArray(ordenOrdenes) ? ordenOrdenes : [ordenOrdenes]
  const primera = ordenes[0]
  const fecha = primera.fecha ? new Date(primera.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
  const pagos = primera.pagos_detalle || []
  const totalMonto = ordenes.reduce((s, o) => s + (o.costo_total || 0), 0)

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
  const entero = Math.floor(totalMonto)
  const centavos = Math.round((totalMonto - entero) * 100)
  const enLetras = nAL(entero) + ' PESOS' + (centavos > 0 ? ' CON ' + nAL(centavos) + ' CENTAVOS' : '') + '.-'

  const filasConcepto = ordenes.map(o => {
    const campo = camposLista.find(c => c.id === o.campo_id)
    const lote = campo?.lotes_agricolas?.find(l => l.id === o.lote_id)
    const campana = campanas.find(c => c.id === o.campana_id)
    const superficie = lote?.superficie_ha || campo?.superficie_ha || '—'
    return `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${o.tipo} — ${campo?.nombre || ''}${lote ? ` Lote ${lote.numero}` : ''} · ${superficie} ha${campana ? ` · ${campana.nombre}` : ''}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">$${(o.costo_total || 0).toLocaleString('es-AR')}</td>
    </tr>`
  }).join('')

  const filasPago = pagos.flatMap(p => {
    let desc = p.tipo === 'transferencia' ? 'TRANSFERENCIA' : p.tipo === 'efectivo' ? 'EFECTIVO' : p.tipo === 'cuenta_corriente' ? 'CUENTA CORRIENTE' : p.subtipo_cheque === 'propio' ? 'E-CHEQ PROPIO' : p.subtipo_cheque === 'tercero' ? 'E-CHEQ TERCERO' : (p.tipo || '').toUpperCase()
    if (p.es_paralelo) desc += ' (CAJA 2)'
    if (p.subtipo_cheque === 'propio' && p.cheque_propio?.fecha_vencimiento) {
      return [`<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${desc}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${p.cheque_propio.numero || ''} · ${p.cheque_propio.banco || ''}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${new Date(p.cheque_propio.fecha_vencimiento+'T12:00:00').toLocaleDateString('es-AR')}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">$${parseFloat(p.monto||0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
      </tr>`]
    }
    if (p.subtipo_cheque === 'tercero' && p.cheque_tercero_detalle?.length > 0) {
      return p.cheque_tercero_detalle.map(ch => `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${desc}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">#${ch.numero || '—'} · ${ch.banco || '—'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${ch.fecha_vencimiento ? new Date(ch.fecha_vencimiento+'T12:00:00').toLocaleDateString('es-AR') : '—'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">$${(ch.monto||0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
      </tr>`)
    }
    return [`<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${desc}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;"></td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;"></td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">$${parseFloat(p.monto||0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
    </tr>`]
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
      <tr><td style="padding:4px 8px;width:50%;">Nombre: <strong>${primera.proveedor || ''}</strong></td><td style="padding:4px 8px;">I.V.A.: ${primera.iva || ''}</td></tr>
      <tr><td style="padding:4px 8px;">Localidad: ${primera.localidad || ''}</td><td style="padding:4px 8px;">CUIT/DNI: ${primera.cuit || ''}</td></tr>
      <tr><td style="padding:4px 8px;">C.B.U: ${primera.cbu || ''}</td><td style="padding:4px 8px;">FECHA &nbsp;<strong>${fecha}</strong></td></tr>
    </table>
    <table style="width:100%;border:1px solid #333;border-top:none;border-collapse:collapse;">
      <tr><td colspan="2" style="padding:4px 8px;font-weight:bold;background:#f5f5f5;border-bottom:1px solid #333;">Concepto${ordenes.length > 1 ? ` (${ordenes.length} trabajos)` : ''}</td></tr>
      ${filasConcepto}
    </table>
    ${pagos.length > 0 ? `
    <table style="width:100%;border:1px solid #333;border-top:none;border-collapse:collapse;">
      <tr><td colspan="4" style="padding:4px 8px;font-weight:bold;background:#f5f5f5;border-bottom:1px solid #333;">Medio de pago</td></tr>
      <tr style="background:#eee;">
        <th style="padding:6px 8px;text-align:left;border-bottom:1px solid #333;font-size:11px;">DESCRIPCIÓN</th>
        <th style="padding:6px 8px;text-align:center;border-bottom:1px solid #333;font-size:11px;">NRO/CHEQUE</th>
        <th style="padding:6px 8px;text-align:center;border-bottom:1px solid #333;font-size:11px;">FECHA DE COBRO</th>
        <th style="padding:6px 8px;text-align:right;border-bottom:1px solid #333;font-size:11px;">IMPORTE</th>
      </tr>
      ${filasPago}
      <tr style="border-top:1px solid #333;"><td colspan="3" style="padding:8px;text-align:right;font-weight:bold;">IMPORTE TOTAL &nbsp; $</td><td style="padding:8px;text-align:right;font-weight:bold;">${totalMonto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td></tr>
    </table>` : `
    <table style="width:100%;border:1px solid #333;border-top:none;border-collapse:collapse;">
      <tr><td style="padding:7px 10px;text-align:right;font-weight:bold;">COSTO TOTAL: $${totalMonto.toLocaleString('es-AR')}</td></tr>
    </table>`}
    <table style="width:100%;border:1px solid #333;border-top:none;border-collapse:collapse;">
      <tr><td style="padding:6px 8px;">Cantidad de pesos: &nbsp;${enLetras}</td></tr>
      <tr><td style="padding:20px 8px 30px 8px;">&nbsp;</td></tr>
      <tr><td style="padding:8px;"><table style="width:100%;"><tr><td style="width:40%;text-align:center;border-top:1px solid #333;">Firma</td><td style="width:20%;"></td><td style="width:40%;text-align:center;border-top:1px solid #333;">DNI</td></tr></table></td></tr>
    </table>
  </div>`

  const win = window.open('', '_blank')
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Recibo — ${primera.tipo}</title><style>@media print{.no-print{display:none;}}body{font-family:Arial,sans-serif;background:#fff;padding:10px;}</style></head><body>
    <div style="text-align:right;margin-bottom:10px;" class="no-print"><button onclick="window.print()" style="padding:8px 20px;font-size:14px;cursor:pointer;background:#1A3D6B;color:#fff;border:none;border-radius:6px;">🖨️ Imprimir / Guardar PDF</button></div>
    ${bloque}<div style="border-top:2px dashed #999;margin:16px 0;text-align:center;font-size:11px;color:#999;padding:4px 0;">✂ &nbsp;&nbsp; CORTAR AQUÍ &nbsp;&nbsp; ✂</div>${bloque}
  </body></html>`)
  win.document.close()
}


function generarRemitoOrden(orden, campo, campana, stockAgro) {
  const fecha = orden.fecha ? new Date(orden.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
  const superficie = campo?.superficie_ha || '—'
  const productos = orden.productos || []
  const pagos = orden.pagos_detalle || []

  const filasProductos = productos.map(p => {
    const item = stockAgro.find(s => String(s.id) === String(p.id) || s.insumo === p.nombre)
    const totalKg = p.dosis && superficie !== '—' ? (parseFloat(p.dosis) * parseFloat(superficie)).toLocaleString('es-AR', { maximumFractionDigits: 1 }) : '—'
    return `<tr>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;">${item?.insumo || p.nombre || '—'}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:center;">${item?.tipo || '—'}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:center;">${p.dosis || '—'} ${p.unidad || item?.unidad || ''}/ha</td>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${totalKg} ${item?.unidad || ''}</td>
    </tr>`
  }).join('')

  const gastosFilas = (orden.gastos_propios || []).map(g =>
    `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;">${g.descripcion}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">$${parseFloat(g.monto||0).toLocaleString('es-AR')}</td></tr>`
  ).join('')

  const filasPago = pagos.flatMap(p => {
    let desc = p.tipo === 'transferencia' ? 'TRANSFERENCIA' : p.tipo === 'efectivo' ? 'EFECTIVO' : p.tipo === 'cuenta_corriente' ? 'CUENTA CORRIENTE' : p.subtipo_cheque === 'propio' ? 'E-CHEQ PROPIO' : p.subtipo_cheque === 'tercero' ? 'E-CHEQ TERCERO' : (p.tipo || '').toUpperCase()
    if (p.es_paralelo) desc += ' (CAJA 2)'
    if (p.subtipo_cheque === 'propio' && p.cheque_propio?.fecha_vencimiento) {
      return [`<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${desc}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${p.cheque_propio.numero || ''} · ${p.cheque_propio.banco || ''}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${new Date(p.cheque_propio.fecha_vencimiento+'T12:00:00').toLocaleDateString('es-AR')}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">$${parseFloat(p.monto||0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
      </tr>`]
    }
    if (p.subtipo_cheque === 'tercero' && p.cheque_tercero_detalle?.length > 0) {
      return p.cheque_tercero_detalle.map(ch => `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${desc}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">#${ch.numero || '—'} · ${ch.banco || '—'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${ch.fecha_vencimiento ? new Date(ch.fecha_vencimiento+'T12:00:00').toLocaleDateString('es-AR') : '—'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">$${(ch.monto||0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
      </tr>`)
    }
    return [`<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${desc}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;"></td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;"></td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">$${parseFloat(p.monto||0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
    </tr>`]
  }).join('')

  const totalMonto = orden.costo_total || 0
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
  const entero = Math.floor(totalMonto)
  const centavos = Math.round((totalMonto - entero) * 100)
  const enLetras = nAL(entero) + ' PESOS' + (centavos > 0 ? ' CON ' + nAL(centavos) + ' CENTAVOS' : '') + '.-'

  const bloque = `<div style="border:1px solid #333;padding:20px;font-family:Arial,sans-serif;font-size:12px;width:100%;box-sizing:border-box;">
    <table style="width:100%;margin-bottom:12px;"><tr>
      <td style="width:33%;vertical-align:top;"><div style="font-weight:bold;">Pedro Barciocco 1221</div><div>TEL: 3574-442656</div><div style="margin-top:6px;font-weight:bold;font-size:13px;">ORDEN DE TRABAJO</div></td>
      <td style="width:34%;text-align:center;vertical-align:middle;"><div style="font-size:22px;font-weight:900;">RAMONDA</div><div style="font-size:14px;font-weight:600;">HNOS S.A.</div></td>
      <td style="width:33%;text-align:right;vertical-align:top;"><div>CUIT: 30-71682182-6</div><div>FECHA: <strong>${fecha}</strong></div></td>
    </tr></table>
    <hr style="border:1px solid #333;margin:8px 0;">
    <table style="width:100%;border:1px solid #333;border-collapse:collapse;margin-bottom:0;">
      <tr><td style="padding:5px 10px;width:50%;"><strong>Campo:</strong> ${campo?.nombre || '—'}</td><td style="padding:5px 10px;"><strong>Campaña:</strong> ${campana?.nombre || '—'}</td></tr>
      <tr><td style="padding:5px 10px;"><strong>Tipo de trabajo:</strong> ${orden.tipo}</td><td style="padding:5px 10px;"><strong>Superficie:</strong> ${superficie} ha</td></tr>
      ${orden.proveedor ? `<tr><td colspan="2" style="padding:5px 10px;"><strong>Contratista:</strong> ${orden.proveedor}${orden.cuit ? ` · CUIT: ${orden.cuit}` : ''}</td></tr>` : ''}
      ${orden.descripcion ? `<tr><td colspan="2" style="padding:5px 10px;"><strong>Descripción:</strong> ${orden.descripcion}</td></tr>` : ''}
    </table>
    ${productos.length > 0 ? `
    <table style="width:100%;border:1px solid #333;border-top:none;border-collapse:collapse;">
      <tr style="background:#f5f5f5;"><td colspan="4" style="padding:5px 10px;font-weight:bold;border-bottom:1px solid #333;">Productos a aplicar</td></tr>
      <tr style="background:#eee;">
        <th style="padding:7px 10px;text-align:left;border-bottom:1px solid #333;font-size:11px;">PRODUCTO</th>
        <th style="padding:7px 10px;text-align:center;border-bottom:1px solid #333;font-size:11px;">TIPO</th>
        <th style="padding:7px 10px;text-align:center;border-bottom:1px solid #333;font-size:11px;">DOSIS/HA</th>
        <th style="padding:7px 10px;text-align:right;border-bottom:1px solid #333;font-size:11px;">TOTAL</th>
      </tr>
      ${filasProductos}
    </table>` : ''}
    ${gastosFilas ? `
    <table style="width:100%;border:1px solid #333;border-top:none;border-collapse:collapse;">
      <tr style="background:#f5f5f5;"><td colspan="2" style="padding:5px 10px;font-weight:bold;border-bottom:1px solid #333;">Gastos propios</td></tr>
      ${gastosFilas}
      <tr><td style="padding:7px 10px;text-align:right;font-weight:bold;">TOTAL:</td><td style="padding:7px 10px;text-align:right;font-weight:bold;">$${(orden.gastos_propios||[]).reduce((s,g)=>s+(parseFloat(g.monto)||0),0).toLocaleString('es-AR')}</td></tr>
    </table>` : ''}
    ${pagos.length > 0 ? `
    <table style="width:100%;border:1px solid #333;border-top:none;border-collapse:collapse;">
      <tr style="background:#f5f5f5;"><td colspan="4" style="padding:5px 10px;font-weight:bold;border-bottom:1px solid #333;">Medio de pago</td></tr>
      <tr style="background:#eee;">
        <th style="padding:6px 8px;text-align:left;border-bottom:1px solid #333;font-size:11px;">DESCRIPCIÓN</th>
        <th style="padding:6px 8px;text-align:center;border-bottom:1px solid #333;font-size:11px;">NRO/CHEQUE</th>
        <th style="padding:6px 8px;text-align:center;border-bottom:1px solid #333;font-size:11px;">FECHA DE COBRO</th>
        <th style="padding:6px 8px;text-align:right;border-bottom:1px solid #333;font-size:11px;">IMPORTE</th>
      </tr>
      ${filasPago}
      <tr style="border-top:1px solid #333;"><td colspan="3" style="padding:8px;text-align:right;font-weight:bold;">IMPORTE TOTAL &nbsp; $</td><td style="padding:8px;text-align:right;font-weight:bold;">${totalMonto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td></tr>
    </table>
    <table style="width:100%;border:1px solid #333;border-top:none;border-collapse:collapse;">
      <tr><td style="padding:6px 8px;">Cantidad de pesos: &nbsp;${enLetras}</td></tr>
    </table>` : `
    <table style="width:100%;border:1px solid #333;border-top:none;border-collapse:collapse;">
      <tr><td style="padding:7px 10px;text-align:right;font-weight:bold;font-size:13px;">COSTO TOTAL: $${totalMonto.toLocaleString('es-AR')}</td></tr>
    </table>`}
    <table style="width:100%;margin-top:30px;"><tr>
      <td style="width:40%;text-align:center;border-top:1px solid #333;">Firma contratista</td>
      <td style="width:20%;"></td>
      <td style="width:40%;text-align:center;border-top:1px solid #333;">Firma Ramonda</td>
    </tr></table>
  </div>`

  const win = window.open('', '_blank')
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Orden de trabajo — ${orden.tipo}</title><style>@media print{.no-print{display:none;}}body{font-family:Arial,sans-serif;background:#fff;padding:10px;}</style></head><body>
    <div style="text-align:right;margin-bottom:10px;" class="no-print"><button onclick="window.print()" style="padding:8px 20px;font-size:14px;cursor:pointer;background:#1A3D6B;color:#fff;border:none;border-radius:6px;">🖨️ Imprimir / Guardar PDF</button></div>
    ${bloque}</body></html>`)
  win.document.close()
}

// ── TAB ÓRDENES DE TRABAJO ──
function TabOrdenes({ ordenes, campos, campanas, campanaActiva, stockAgro, cargar, contactos, usuario, mobile, nav }) {
  const [tabInner, setTabInner] = useState('ordenes')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    campo_id: '', campana_id: campanaActiva?.id || '', tipo: '', fecha: hoyLocal(),
    descripcion: '', proveedor: '', es_propia: false, lote_id: '', superficie_ha: '',
    productos: [], gastos_propios: [],
    costo_total: '', costo_ha: '', observaciones: '', usa_maquinaria_servicios: false,
  })
  const [guardando, setGuardando] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroCampo, setFiltroCampo] = useState('')

  // Pagos
  const [showPagos, setShowPagos] = useState(false)
  const [seleccionadas, setSeleccionadas] = useState([])
  const [formPagoGrupal, setFormPagoGrupal] = useState({ fecha: hoyLocal(), pagos: [{ ...PAGO_INIT_ORDEN }], domicilio: '', localidad: '', cuit: '', iva: '', cbu: '' })
  const [guardandoPago, setGuardandoPago] = useState(false)
  const [chequesCartera, setChequesCartera] = useState([])
  const [costosPend, setCostosPend] = useState({})
  const [ordenGuardadaM, setOrdenGuardadaM] = useState(null)
  const [modoProductoM, setModoProductoM] = useState({})

  useEffect(() => {
    supabase.from('cheques').select('*').eq('tipo', 'recibido').eq('estado', 'en_cartera').order('fecha_vencimiento', { ascending: true })
      .then(({ data }) => setChequesCartera(data || []))
  }, [])

  const campo = campos.find(c => c.id === parseInt(form.campo_id))
  const loteSeleccionado = campo?.lotes_agricolas?.find(l => l.id === parseInt(form.lote_id))
  const superficieBase = loteSeleccionado?.superficie_ha || campo?.superficie_ha || 0
  const superficie = parseFloat(form.superficie_ha) || superficieBase || 0

  function addProducto() { setForm(prev => ({...prev, productos: [...prev.productos, { id: '', dosis: '', unidad: '', total: '' }]})) }
  function updProducto(idx, updates) { setForm(prev => ({...prev, productos: prev.productos.map((p, i) => i === idx ? {...p, ...updates} : p)})) }
  function removeProducto(idx) { setForm({...form, productos: form.productos.filter((_, i) => i !== idx)}) }
  function addGasto() { setForm({...form, gastos_propios: [...form.gastos_propios, { descripcion: '', monto: '' }]}) }
  function updGasto(idx, key, val) { setForm({...form, gastos_propios: form.gastos_propios.map((g, i) => i === idx ? {...g, [key]: val} : g)}) }

  const totalGastosPropios = form.gastos_propios.reduce((s, g) => s + (parseFloat(g.monto) || 0), 0)

  async function guardar() {
    if (!form.campo_id || !form.tipo) { alert('Seleccioná campo y tipo'); return }
    setGuardando(true)
    const costoNum = parseFloat(form.costo_total) || totalGastosPropios || null
    const costoHa = costoNum && superficie ? Math.round(costoNum / superficie) : (parseFloat(form.costo_ha) || null)

    // Gastos propios → caja como egreso interno
    let caja_oficial_id = null
    if (form.es_propia && totalGastosPropios > 0) {
      const desc = `${form.tipo} — ${campo?.nombre || ''}`
      const { data: co, error: errCaja } = await supabase.from('caja_oficial').insert({ fecha: form.fecha, tipo: 'egreso', categoria: 'Gasto propio agricultura', descripcion: desc, monto: totalGastosPropios, forma_pago: 'interno' }).select().single()
      if (errCaja) { alert('Error al registrar el gasto propio: ' + errCaja.message); setGuardando(false); return }
      caja_oficial_id = co?.id || null
    }

    // Descontar stock de productos usados — de forma atómica en la base
    for (const p of form.productos) {
      if (!p.id || !p.dosis || !superficie) continue
      const usado = parseFloat(p.dosis) * superficie
      const { error: errStock } = await supabase.rpc('incrementar_stock_agro', { p_id: parseInt(p.id), p_delta: -usado })
      if (errStock) { alert('Error al descontar stock: ' + errStock.message); setGuardando(false); return }
    }

    const { data: ordenInsertada, error: errOrden } = await supabase.from('ordenes_trabajo').insert({
      campo_id: parseInt(form.campo_id), campana_id: parseInt(form.campana_id) || null,
      lote_id: form.lote_id ? parseInt(form.lote_id) : null,
      superficie_ha_real: superficie || null,
      tipo: form.tipo, fecha: form.fecha, descripcion: form.descripcion || null,
      proveedor: form.proveedor || null, es_propia: form.es_propia,
      productos: form.productos.length ? form.productos : null,
      gastos_propios: form.gastos_propios.length ? form.gastos_propios : null,
      costo_total: costoNum, costo_ha: costoHa, estado: 'completado',
      observaciones: form.observaciones || null,
      estado_pago: form.es_propia ? 'pagado' : 'pendiente',
      caja_oficial_id, registrado_por: usuario?.id,
    }).select().single()
    if (errOrden) { alert('Error al guardar la orden: ' + errOrden.message); setGuardando(false); return }

    // Si el trabajo propio se hizo con maquinaria/personal de Servicios, se
    // refleja como un "servicio interno" — mismo monto, sin caja de por medio
    // (no sale ni entra plata real, es la misma empresa). Así Agricultura ve
    // el costo real de la labor, y Servicios recibe el crédito por el uso de
    // su maquinaria, sin inflar el resultado consolidado de la empresa (se
    // cancelan solos al sumar todas las actividades).
    if (form.es_propia && form.usa_maquinaria_servicios && costoNum > 0) {
      const campoNombre = campos.find(c => c.id === parseInt(form.campo_id))?.nombre || ''
      const campanaNombre = campanas.find(c => c.id === parseInt(form.campana_id))?.nombre || ''
      const { error: errServ } = await supabase.from('servicios_terceros').insert({
        cliente: 'Agricultura (interno)', labor: form.tipo, fecha: form.fecha,
        hectareas: superficie || null, precio_ha: costoHa, total: costoNum,
        campo: campoNombre, nro_lote: form.lote_id ? String(form.lote_id) : null,
        cultivo: null, campania: campanaNombre, tipo_servicio: 'tercero',
        estado_pago: 'pagado', estado: 'completado',
        observaciones: `Trabajo propio para Agricultura — orden #${ordenInsertada?.id}`,
        registrado_por: usuario?.id,
      })
      if (errServ) alert('La orden se guardó, pero no se pudo reflejar el ingreso en Servicios: ' + errServ.message)
    }

    if (!mobile) await cargar() // en el celular, la recarga se hace recién al volver al inicio (ver más abajo), para no remontar el formulario y perder la confirmación
    setShowForm(false)
    if (mobile) setOrdenGuardadaM(ordenInsertada)
    setForm({ campo_id: '', campana_id: campanaActiva?.id || '', tipo: '', fecha: hoyLocal(), descripcion: '', proveedor: '', es_propia: false, lote_id: '', superficie_ha: '', productos: [], gastos_propios: [], costo_total: '', costo_ha: '', observaciones: '', usa_maquinaria_servicios: false })
    setGuardando(false)
  }

  async function pagarSeleccionadas() {
    if (seleccionadas.length === 0) { alert('Seleccioná al menos una orden'); return }
    const pendientes = ordenes.filter(o => !o.es_propia && o.estado_pago === 'pendiente')
    const montoOrden = o => o.costo_total || (costosPend[o.id] ? parseFloat(costosPend[o.id]) : 0)
    const faltante = seleccionadas.some(id => { const o = pendientes.find(x => x.id === id); return o && !o.costo_total && !costosPend[id] })
    if (faltante) { alert('Falta cargar el costo de alguna de las órdenes seleccionadas.'); return }
    const totalSel = seleccionadas.reduce((s, id) => { const o = pendientes.find(x => x.id === id); return s + (o ? montoOrden(o) : 0) }, 0)
    const totalPagGrupal = formPagoGrupal.pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
    if (Math.abs(totalSel - totalPagGrupal) > 0.5) { alert(`El total de pagos ($${totalPagGrupal.toLocaleString('es-AR')}) no coincide con el total seleccionado ($${totalSel.toLocaleString('es-AR')})`); return }
    setGuardandoPago(true)

    let caja_oficial_id = null, caja_paralela_id = null
    const provs = [...new Set(seleccionadas.map(id => pendientes.find(o => o.id === id)?.proveedor).filter(Boolean))].join(', ')
    const desc = `Pago órdenes agricultura — ${provs || 'varios'}`

    for (const pago of formPagoGrupal.pagos) {
      const monto = parseFloat(pago.monto) || 0
      if (!monto) continue
      const fp = pago.subtipo_cheque ? 'e-cheq' : pago.tipo
      if (pago.es_paralelo) {
        const { data: cp } = await supabase.from('caja_paralela').insert({ fecha: formPagoGrupal.fecha, tipo: 'egreso', descripcion: desc, monto }).select().single()
        if (!caja_paralela_id) caja_paralela_id = cp?.id || null
      } else {
        const { data: co } = await supabase.from('caja_oficial').insert({ fecha: formPagoGrupal.fecha, tipo: 'egreso', categoria: 'Orden de trabajo agricultura', descripcion: desc, monto, forma_pago: fp }).select().single()
        if (!caja_oficial_id) caja_oficial_id = co?.id || null
      }
      if (!pago.es_paralelo && pago.subtipo_cheque === 'propio') {
        await supabase.from('cheques').insert({ tipo: 'emitido', numero: pago.cheque_propio.numero || null, banco: pago.cheque_propio.banco || null, fecha_cobro: formPagoGrupal.fecha, fecha_vencimiento: pago.cheque_propio.fecha_vencimiento, monto, estado: 'en_cartera', caja_oficial_id, registrado_por: usuario?.id })
      } else if (pago.subtipo_cheque === 'tercero' && pago.cheque_tercero_ids?.length > 0) {
        for (const chId of pago.cheque_tercero_ids) await supabase.from('cheques').update({ estado: 'depositado' }).eq('id', parseInt(chId))
      }
    }

    for (const id of seleccionadas) {
      const o = pendientes.find(x => x.id === id)
      const upd = { estado_pago: 'pagado', caja_oficial_id, caja_paralela_id, pagos_detalle: formPagoGrupal.pagos, domicilio: formPagoGrupal.domicilio || null, localidad: formPagoGrupal.localidad || null, cuit: formPagoGrupal.cuit || null, iva: formPagoGrupal.iva || null, cbu: formPagoGrupal.cbu || null }
      // Si la orden no tenía costo cargado, se define recién ahora al pagar
      if (o && !o.costo_total && costosPend[id]) {
        const costoFinal = parseFloat(costosPend[id])
        upd.costo_total = costoFinal
        upd.costo_ha = o.superficie_ha_real ? Math.round(costoFinal / o.superficie_ha_real) : null
      }
      await supabase.from('ordenes_trabajo').update(upd).eq('id', id)
    }

    const ordenesPagadas = seleccionadas.map(id => {
      const o = pendientes.find(x => x.id === id)
      if (!o) return null
      // Si la orden no tenía costo cargado, usar el que se acaba de definir
      // ahora al pagar — si no, el recibo sale con $0 en cada renglón.
      const costoFinal = o.costo_total || (costosPend[id] ? parseFloat(costosPend[id]) : 0)
      return { ...o, costo_total: costoFinal }
    }).filter(Boolean)
    const pagosFinal = [...formPagoGrupal.pagos]
    setSeleccionadas([])
    setShowPagos(false)
    setFormPagoGrupal({ fecha: hoyLocal(), pagos: [{ ...PAGO_INIT_ORDEN }], domicilio: '', localidad: '', cuit: '', iva: '', cbu: '' })
    setCostosPend({})
    setGuardandoPago(false)
    await cargar()
    // Un solo comprobante por proveedor, con el detalle de todos los campos
    // que se pagaron juntos — no uno por cada orden, aunque sean de campos
    // distintos, si se le está pagando a la misma persona de una vez.
    const porProveedor = {}
    ordenesPagadas.forEach(o => {
      const key = o.proveedor || 'sin proveedor'
      if (!porProveedor[key]) porProveedor[key] = []
      porProveedor[key].push({ ...o, fecha: formPagoGrupal.fecha, pagos_detalle: pagosFinal, ...formPagoGrupal })
    })
    Object.values(porProveedor).forEach(grupo => {
      generarReciboOrden(grupo, campos, campanas, stockAgro)
    })
  }

  // ── MODO CELULAR: solo el formulario de nueva orden (con insumos por ha) ──
  if (mobile) {
    const CM = { bg: '#1A2E1A', surface: '#243324', surface2: '#2E3F2E', border: '#3A4F3A', text: '#E8F0E8', muted: '#8FA88F', green: '#7EC87E', amber: '#F5C97A', red: '#F09595', blue: '#7EB8F7', mono: "'IBM Plex Mono', monospace", sans: "'IBM Plex Sans', sans-serif" }
    const lotesDelCampo = campo?.lotes_agricolas || []

    // ── Confirmación después de guardar: ver / descargar / enviar por WhatsApp ──
    if (ordenGuardadaM) {
      const o = ordenGuardadaM
      const loteG = campo?.lotes_agricolas?.find(l => l.id === o.lote_id)
      const campanaG = campanas.find(c => c.id === o.campana_id)
      const textoResumen = [
        `📋 *Orden de trabajo*`,
        `Campo: ${campo?.nombre || '—'}`,
        loteG ? `Lote: ${loteG.numero}` : null,
        `Tipo: ${o.tipo}`,
        `Fecha: ${new Date(o.fecha + 'T12:00:00').toLocaleDateString('es-AR')}`,
        o.superficie_ha_real ? `Superficie: ${o.superficie_ha_real} ha` : null,
        !o.es_propia && o.proveedor ? `Contratista: ${o.proveedor}` : null,
        (o.productos || []).length > 0 ? '\nInsumos aplicados:' : null,
        ...(o.productos || []).map(p => {
          const item = stockAgro.find(s => s.id === parseInt(p.id))
          const total = o.superficie_ha_real ? Math.round(parseFloat(p.dosis) * o.superficie_ha_real * 100) / 100 : ''
          return `• ${item?.insumo || '—'}: ${p.dosis} ${item?.unidad || ''}/ha (${total} ${item?.unidad || ''} total)`
        }),
        o.observaciones ? `\nObs: ${o.observaciones}` : null,
      ].filter(Boolean).join('\n')

      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: CM.bg, color: CM.text, fontFamily: CM.sans }}>
          <div style={{ background: CM.surface, padding: '1rem', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, borderBottom: `1px solid ${CM.border}` }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>✓ Orden registrada</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
            <div style={{ background: CM.surface, border: `1px solid ${CM.border}`, borderRadius: 10, padding: '1rem', marginBottom: '1rem', whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6 }}>
              {textoResumen}
            </div>
            <a href={`https://wa.me/?text=${encodeURIComponent(textoResumen)}`} target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', textAlign: 'center', width: '100%', background: '#25D366', border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 600, color: '#0A1A0A', textDecoration: 'none', boxSizing: 'border-box', marginBottom: 10 }}>
              📲 Enviar por WhatsApp
            </a>
            <button onClick={() => generarReciboOrden(o, campos, campanas, stockAgro)}
              style={{ width: '100%', background: CM.surface, border: `1px solid ${CM.blue}`, borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 600, color: CM.blue, cursor: 'pointer', fontFamily: CM.sans, marginBottom: 10 }}>
              🖨️ Ver / Descargar PDF
            </button>
            <button onClick={async () => { setOrdenGuardadaM(null); await cargar(); nav && nav('home') }}
              style={{ width: '100%', background: 'transparent', border: `1px solid ${CM.border}`, borderRadius: 10, padding: 12, fontSize: 14, color: CM.muted, cursor: 'pointer', fontFamily: CM.sans }}>
              Volver al inicio
            </button>
          </div>
        </div>
      )
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: CM.bg, color: CM.text, fontFamily: CM.sans }}>
        <div style={{ background: CM.surface, padding: '1rem', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, borderBottom: `1px solid ${CM.border}` }}>
          <button onClick={() => nav && nav('home')} style={{ background: 'none', border: 'none', color: CM.green, fontSize: 22, cursor: 'pointer', padding: 0, lineHeight: 1 }}>‹</button>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Nueva orden de trabajo</div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: CM.muted, textTransform: 'uppercase', marginBottom: 4 }}>Campo *</div>
            <select value={form.campo_id} onChange={e => setForm({...form, campo_id: e.target.value, lote_id: '', superficie_ha: ''})}
              style={{ width: '100%', background: CM.surface, border: `1px solid ${CM.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: CM.text, fontFamily: CM.sans }}>
              <option value="">— Seleccioná —</option>
              {campos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          {lotesDelCampo.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: CM.muted, textTransform: 'uppercase', marginBottom: 4 }}>Lote</div>
              <select value={form.lote_id} onChange={e => setForm({...form, lote_id: e.target.value})}
                style={{ width: '100%', background: CM.surface, border: `1px solid ${CM.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: CM.text, fontFamily: CM.sans }}>
                <option value="">— Todo el campo —</option>
                {lotesDelCampo.map(l => <option key={l.id} value={l.id}>Lote {l.numero} ({l.superficie_ha} ha)</option>)}
              </select>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: CM.muted, textTransform: 'uppercase', marginBottom: 4 }}>Tipo de trabajo *</div>
              <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}
                style={{ width: '100%', background: CM.surface, border: `1px solid ${CM.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: CM.text, fontFamily: CM.sans }}>
                <option value="">— Seleccioná —</option>
                {TIPOS_ORDEN.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: CM.muted, textTransform: 'uppercase', marginBottom: 4 }}>Fecha</div>
              <input type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})}
                style={{ width: '100%', background: CM.surface, border: `1px solid ${CM.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: CM.text, fontFamily: CM.sans, boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: CM.muted, textTransform: 'uppercase', marginBottom: 4 }}>Superficie trabajada (ha)</div>
            <input type="number" value={form.superficie_ha} onChange={e => setForm({...form, superficie_ha: e.target.value})}
              placeholder={superficieBase ? String(superficieBase) : 'ej. 45'}
              style={{ width: '100%', background: CM.surface, border: `1px solid ${CM.green}`, borderRadius: 8, padding: '11px 12px', fontSize: 16, fontFamily: CM.mono, fontWeight: 600, color: CM.green, boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {[{v:false,l:'Contratista'},{v:true,l:'Trabajo propio'}].map(o => (
                <button key={String(o.v)} onClick={() => setForm({...form, es_propia: o.v})}
                  style={{ flex: 1, padding: '9px', fontSize: 13, fontWeight: 600, borderRadius: 8, cursor: 'pointer', border: `1px solid ${form.es_propia === o.v ? CM.green : CM.border}`, background: form.es_propia === o.v ? '#1A3D26' : 'transparent', color: form.es_propia === o.v ? CM.green : CM.muted }}>
                  {o.l}
                </button>
              ))}
            </div>
            {!form.es_propia && (
              <input type="text" value={form.proveedor} onChange={e => setForm({...form, proveedor: e.target.value})}
                placeholder="Nombre del contratista"
                style={{ width: '100%', marginTop: 8, background: CM.surface, border: `1px solid ${CM.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: CM.text, fontFamily: CM.sans, boxSizing: 'border-box' }} />
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: CM.muted, textTransform: 'uppercase' }}>Insumos aplicados</div>
            <button onClick={addProducto} style={{ padding: '4px 10px', fontSize: 12, background: 'transparent', border: `1px solid ${CM.green}`, color: CM.green, borderRadius: 6, cursor: 'pointer' }}>+ Agregar</button>
          </div>
          {form.productos.map((p, idx) => {
            const item = stockAgro.find(s => s.id === parseInt(p.id))
            const modo = modoProductoM[idx] || 'dosis'
            const dosis = parseFloat(p.dosis) || 0
            const totalUsado = modo === 'dosis'
              ? (superficie ? Math.round(dosis * superficie * 100) / 100 : 0)
              : (parseFloat(p.total) || 0)
            const dosisCalculada = modo === 'total' && superficie ? Math.round((totalUsado / superficie) * 100) / 100 : dosis
            const alcanza = item ? (item.cantidad || 0) >= totalUsado : true
            return (
              <div key={idx} style={{ background: CM.surface, border: `1px solid ${CM.border}`, borderRadius: 10, padding: '.85rem', marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <select value={p.id} onChange={e => {
                    const it = stockAgro.find(s => String(s.id) === e.target.value)
                    updProducto(idx, { id: e.target.value, unidad: it?.unidad || '' })
                  }}
                    style={{ flex: 1, background: CM.surface2, border: `1px solid ${CM.border}`, borderRadius: 6, padding: '9px 10px', fontSize: 13, color: CM.text, fontFamily: CM.sans }}>
                    <option value="">— Insumo —</option>
                    {stockAgro.map(s => <option key={s.id} value={s.id}>{s.insumo} ({(s.cantidad||0).toLocaleString('es-AR')} {s.unidad} en stock)</option>)}
                  </select>
                  <button onClick={() => removeProducto(idx)} style={{ background: 'none', border: 'none', color: CM.red, fontSize: 16, cursor: 'pointer', padding: '0 6px' }}>✕</button>
                </div>

                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  {[{ v: 'dosis', l: 'Cargar por dosis/ha' }, { v: 'total', l: 'Cargar por cantidad total' }].map(o => (
                    <button key={o.v} onClick={() => setModoProductoM({...modoProductoM, [idx]: o.v})}
                      style={{ flex: 1, padding: '6px 4px', fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: 'pointer', border: `1px solid ${modo === o.v ? CM.green : CM.border}`, background: modo === o.v ? '#1A3D26' : 'transparent', color: modo === o.v ? CM.green : CM.muted }}>
                      {o.l}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: CM.muted, marginBottom: 3 }}>Dosis / ha{modo === 'total' ? ' (calculada)' : ''}</div>
                    {modo === 'dosis' ? (
                      <input type="number" value={p.dosis} onChange={e => updProducto(idx, { dosis: e.target.value })}
                        placeholder="ej. 1.5" style={{ width: '100%', background: CM.surface2, border: `1px solid ${CM.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 14, fontFamily: CM.mono, fontWeight: 600, color: CM.green, boxSizing: 'border-box' }} />
                    ) : (
                      <div style={{ padding: '8px 10px', fontSize: 14, fontFamily: CM.mono, fontWeight: 600, color: CM.muted, background: CM.surface2, borderRadius: 6, border: `1px solid ${CM.border}` }}>
                        {superficie ? dosisCalculada.toLocaleString('es-AR') : '— sin superficie —'}
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: CM.muted, marginBottom: 3 }}>Total a usar{modo === 'dosis' ? ' (calculado)' : ''}</div>
                    {modo === 'total' ? (
                      <input type="number" value={p.total} onChange={e => updProducto(idx, { total: e.target.value, dosis: superficie ? String(Math.round((parseFloat(e.target.value)||0) / superficie * 100) / 100) : p.dosis })}
                        placeholder={`ej. 30 ${p.unidad || item?.unidad || ''}`}
                        style={{ width: '100%', background: CM.surface2, border: `1px solid ${alcanza ? CM.green : CM.red}`, borderRadius: 6, padding: '8px 10px', fontSize: 14, fontFamily: CM.mono, fontWeight: 600, color: alcanza ? CM.green : CM.red, boxSizing: 'border-box' }} />
                    ) : (
                      <div style={{ padding: '8px 10px', fontSize: 14, fontFamily: CM.mono, fontWeight: 600, color: alcanza ? CM.text : CM.red, background: CM.surface2, borderRadius: 6, border: `1px solid ${alcanza ? CM.border : CM.red}` }}>
                        {totalUsado.toLocaleString('es-AR')} {p.unidad || item?.unidad || ''}
                      </div>
                    )}
                  </div>
                </div>
                {!alcanza && <div style={{ fontSize: 11, color: CM.red, marginTop: 6 }}>⚠ Stock insuficiente (hay {(item?.cantidad||0).toLocaleString('es-AR')} {item?.unidad})</div>}
              </div>
            )
          })}

          <div style={{ marginTop: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: CM.muted, textTransform: 'uppercase', marginBottom: 4 }}>Observaciones</div>
            <input type="text" value={form.observaciones} onChange={e => setForm({...form, observaciones: e.target.value})}
              style={{ width: '100%', background: CM.surface, border: `1px solid ${CM.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: CM.text, fontFamily: CM.sans, boxSizing: 'border-box' }} />
          </div>

          {form.es_propia ? (
            <div style={{ marginTop: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: CM.muted, textTransform: 'uppercase', marginBottom: 4 }}>Costo total $ (valor del trabajo propio)</div>
              <input type="number" value={form.costo_total} onChange={e => setForm({...form, costo_total: e.target.value})}
                placeholder="ej. combustible + hs de trabajo"
                style={{ width: '100%', background: CM.surface, border: `1px solid ${CM.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: CM.text, fontFamily: CM.sans, boxSizing: 'border-box' }} />
              <div style={{ fontSize: 11, color: CM.muted, marginTop: 4 }}>Aunque sea con maquinaria propia, tiene un costo real — cargarlo hace más precisa la rentabilidad del lote.</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.usa_maquinaria_servicios} onChange={e => setForm({...form, usa_maquinaria_servicios: e.target.checked})} />
                <span style={{ fontSize: 13, color: CM.text }}>Se usó maquinaria/personal de Servicios</span>
              </label>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: CM.muted, marginBottom: 12 }}>
              El costo del contratista se carga después (cuando se paga), en la pestaña Órdenes de la PC.
            </div>
          )}

          <button onClick={guardar} disabled={guardando}
            style={{ width: '100%', background: CM.green, border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 600, color: '#0A1A0A', cursor: 'pointer', fontFamily: CM.sans, marginBottom: 8 }}>
            {guardando ? 'Guardando...' : 'Registrar orden'}
          </button>
          <button onClick={() => nav && nav('home')}
            style={{ width: '100%', background: 'transparent', border: `1px solid ${CM.border}`, borderRadius: 10, padding: 12, fontSize: 14, color: CM.muted, cursor: 'pointer', fontFamily: CM.sans }}>
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  const ordenesFiltradas = ordenes.filter(o => {
    if (filtroTipo && o.tipo !== filtroTipo) return false
    if (filtroCampo && o.campo_id !== parseInt(filtroCampo)) return false
    return true
  })
  const pendientes = ordenes.filter(o => !o.es_propia && o.estado_pago === 'pendiente')
  const montoOrden = o => o.costo_total || (costosPend[o.id] ? parseFloat(costosPend[o.id]) : 0)
  const totalSelec = seleccionadas.reduce((s, id) => { const o = pendientes.find(x => x.id === id); return s + (o ? montoOrden(o) : 0) }, 0)
  const totalPagoGrupal = formPagoGrupal.pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
  const faltaCosto = seleccionadas.some(id => { const o = pendientes.find(x => x.id === id); return o && !o.costo_total && !costosPend[id] })

  return (
    <div>
      {/* Tabs internos */}
      <div style={{ display: 'flex', gap: 4, marginBottom: '1.5rem' }}>
        {[
          { key: 'ordenes', label: '📋 Órdenes de trabajo' },
          { key: 'pagos', label: `💳 Pagos${pendientes.length > 0 ? ` (${pendientes.length} pend.)` : ''}` },
        ].map(t => (
          <button key={t.key} onClick={() => setTabInner(t.key)}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: tabInner === t.key ? 600 : 400, cursor: 'pointer', color: tabInner === t.key ? S.accent : S.muted, background: tabInner === t.key ? S.accentLight : 'transparent', border: `1px solid ${tabInner === t.key ? S.accent : S.border}`, borderRadius: 6 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB ÓRDENES ── */}
      {tabInner === 'ordenes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={{ padding: '7px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface }}>
                <option value="">Todos los tipos</option>
                {TIPOS_ORDEN.map(t => <option key={t}>{t}</option>)}
              </select>
              <select value={filtroCampo} onChange={e => setFiltroCampo(e.target.value)} style={{ padding: '7px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface }}>
                <option value="">Todos los campos</option>
                {campos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <button onClick={() => setShowForm(!showForm)}
              style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
              + Nueva orden
            </button>
          </div>

          {showForm && (
            <Card titulo="Nueva orden de trabajo">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginBottom: '1rem' }}>
                <div><Label>Campo *</Label><select value={form.campo_id} onChange={e => { const c = campos.find(x => x.id === parseInt(e.target.value)); setForm({...form, campo_id: e.target.value, lote_id: '', superficie_ha: c?.superficie_ha ? String(c.superficie_ha) : ''}) }} style={inputStyle}><option value="">— Seleccioná —</option>{campos.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.superficie_ha} ha)</option>)}</select></div>
                <div><Label>Lote</Label>
                  <select value={form.lote_id} onChange={e => { const l = campo?.lotes_agricolas?.find(x => x.id === parseInt(e.target.value)); setForm({...form, lote_id: e.target.value, superficie_ha: l?.superficie_ha ? String(l.superficie_ha) : (campo?.superficie_ha ? String(campo.superficie_ha) : '')}) }} style={inputStyle}>
                    <option value="">— Todo el campo —</option>
                    {(campo?.lotes_agricolas || []).map(l => <option key={l.id} value={l.id}>Lote {l.numero} ({l.superficie_ha} ha)</option>)}
                  </select>
                </div>
                <div>
                  <Label>Hectáreas a trabajar</Label>
                  <input type="number" value={form.superficie_ha} onChange={e => setForm({...form, superficie_ha: e.target.value})} style={inputStyle} placeholder={String(superficieBase || '')} />
                </div>
                <div><Label>Campaña</Label><select value={form.campana_id} onChange={e => setForm({...form, campana_id: e.target.value})} style={inputStyle}><option value="">— Seleccioná —</option>{campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
                <div><Label>Tipo de trabajo *</Label><select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} style={inputStyle}><option value="">— Seleccioná —</option>{TIPOS_ORDEN.map(t => <option key={t}>{t}</option>)}</select></div>
                <div><Label>Fecha</Label><input type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} style={inputStyle} /></div>
                <div><Label>Operario / Equipo</Label><input type="text" value={form.proveedor} onChange={e => setForm({...form, proveedor: e.target.value})} style={inputStyle} placeholder="Nombre del contratista u operario" /></div>
                <div><Label>Descripción</Label><input type="text" value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} style={inputStyle} /></div>
                <div><Label>Observaciones</Label><input type="text" value={form.observaciones} onChange={e => setForm({...form, observaciones: e.target.value})} style={inputStyle} /></div>
              </div>

              {/* Tipo ejecución */}
              <div style={{ display: 'flex', gap: 10, marginBottom: '1rem' }}>
                {[{ v: false, l: '🤝 Contratista externo' }, { v: true, l: '🚜 Trabajo propio' }].map(opt => (
                  <button key={String(opt.v)} onClick={() => setForm({...form, es_propia: opt.v})}
                    style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 6, cursor: 'pointer', border: `1px solid ${form.es_propia === opt.v ? S.accent : S.border}`, background: form.es_propia === opt.v ? S.accentLight : 'transparent', color: form.es_propia === opt.v ? S.accent : S.muted }}>
                    {opt.l}
                  </button>
                ))}
              </div>

              {/* Productos */}
              <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '12px', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase' }}>Productos a usar{superficie ? ` · ${superficie} ha` : ''}</div>
                  <button onClick={addProducto} style={{ padding: '4px 12px', fontSize: 12, background: 'transparent', border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 6, cursor: 'pointer' }}>+ Agregar producto</button>
                </div>
                {form.productos.length === 0 && <div style={{ fontSize: 13, color: S.hint }}>Sin productos asignados.</div>}
                {form.productos.map((p, idx) => {
                  const item = stockAgro.find(s => s.id === parseInt(p.id))
                  const totalUso = p.total ? parseFloat(p.total) : (p.dosis && superficie ? parseFloat(p.dosis) * superficie : null)
                  return (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'flex-end', marginBottom: 8 }}>
                      <div><Label>Producto</Label>
                        <select value={p.id} onChange={e => { const s = stockAgro.find(x => x.id === parseInt(e.target.value)); updProducto(idx, { id: e.target.value, unidad: s?.unidad || '' }) }} style={inputStyle}>
                          <option value="">— Seleccioná —</option>
                          {stockAgro.map(s => <option key={s.id} value={s.id}>{s.insumo} ({s.cantidad?.toLocaleString('es-AR')} {s.unidad})</option>)}
                        </select>
                      </div>
                      <div><Label>Dosis/ha</Label><input type="number" value={p.dosis} onChange={e => {
                        const dosis = e.target.value
                        const total = dosis && superficie ? String((parseFloat(dosis) * superficie).toFixed(2)) : ''
                        updProducto(idx, { dosis, total })
                      }} style={inputStyle} placeholder="ej. 1.5" /></div>
                      <div><Label>Unidad</Label><input type="text" value={p.unidad || item?.unidad || ''} onChange={e => updProducto(idx, { unidad: e.target.value })} style={inputStyle} /></div>
                      <div><Label>Total {p.unidad || item?.unidad || ''}</Label>
                        <input type="number" value={p.total || (p.dosis && superficie ? (parseFloat(p.dosis) * superficie).toFixed(2) : '')}
                          onChange={e => {
                            const total = e.target.value
                            const dosis = total && superficie ? String((parseFloat(total) / superficie).toFixed(4)) : ''
                            updProducto(idx, { total, dosis })
                          }}
                          style={{ ...inputStyle, fontFamily: 'monospace', fontWeight: 600, color: S.green }}
                          placeholder={superficie ? `ej. ${superficie}` : '—'} />
                      </div>
                      <button onClick={() => removeProducto(idx)} style={{ padding: '7px 10px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer', marginBottom: 2 }}>✕</button>
                    </div>
                  )
                })}
              </div>

              {/* Costo */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div><Label>Costo total $ {form.es_propia ? '(valor del trabajo propio)' : '(opcional)'}</Label><input type="number" value={form.costo_total} onChange={e => setForm({...form, costo_total: e.target.value})} style={inputStyle} placeholder={form.es_propia ? 'ej. costo de combustible + hs de trabajo' : 'Se puede cargar al pagar'} /></div>
                <div><Label>Costo $/ha</Label><input type="number" value={form.costo_ha} onChange={e => setForm({...form, costo_ha: e.target.value})} style={inputStyle} /></div>
              </div>
              {form.es_propia && (
                <>
                  <div style={{ fontSize: 11, color: S.hint, marginTop: -8, marginBottom: '.6rem' }}>
                    Aunque sea trabajo con maquinaria propia, tiene un costo real (combustible, desgaste, hs de trabajo) — ponerle un valor acá hace que la rentabilidad del lote sea más precisa.
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.usa_maquinaria_servicios} onChange={e => setForm({...form, usa_maquinaria_servicios: e.target.checked})} />
                    <span style={{ fontSize: 13 }}>Se usó maquinaria/personal de <strong>Servicios</strong> — reflejar este monto como ingreso de Servicios (sin mover caja)</span>
                  </label>
                </>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={guardar} disabled={guardando} style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando...' : '💾 Guardar orden'}</button>
                <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
              </div>
            </Card>
          )}

          {/* Historial */}
          <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 700 }}>
              <thead><tr style={{ background: S.bg }}>
                {['Fecha', 'Campo', 'Lote', 'Tipo', 'Ejecución', 'Operario', 'Productos', 'Costo', 'Estado pago', ''].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 10, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {ordenesFiltradas.length === 0 && <tr><td colSpan={10} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay órdenes registradas.</td></tr>}
                {ordenesFiltradas.map(o => {
                  const campoO = campos.find(c => c.id === o.campo_id)
                  const loteO = (o.campos?.lotes_agricolas || campoO?.lotes_agricolas || []).find(l => l.id === o.lote_id)
                  return (
                    <tr key={o.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{o.fecha ? new Date(o.fecha+'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{campoO?.nombre || '—'}</td>
                      <td style={{ padding: '8px 12px', color: S.muted }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{loteO ? `Lote ${loteO.numero}` : '—'}</span>
                          {(loteO?.imagen_url || campoO?.imagen_url) && (
                            <a href={loteO?.imagen_url || campoO?.imagen_url} target="_blank" rel="noopener noreferrer"
                              style={{ fontSize: 11, color: '#1A3D6B', background: '#E8EFF8', border: '1px solid #378ADD', borderRadius: 4, padding: '1px 6px', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                              🗺 Ver mapa
                            </a>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '8px 12px' }}><span style={{ padding: '2px 8px', borderRadius: 4, background: S.accentLight, color: S.accent, fontSize: 11, fontWeight: 600 }}>{o.tipo}</span></td>
                      <td style={{ padding: '8px 12px' }}>{o.es_propia ? <span style={{ fontSize: 11, color: S.green }}>🚜 Propio</span> : <span style={{ fontSize: 11, color: S.muted }}>🤝 Contratista</span>}</td>
                      <td style={{ padding: '8px 12px', color: S.muted, fontSize: 12 }}>{o.proveedor || '—'}</td>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: S.muted }}>{o.productos?.length ? `${o.productos.length} prod.` : '—'}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: S.red }}>{o.costo_total ? `$${o.costo_total.toLocaleString('es-AR')}` : '—'}</td>
                      <td style={{ padding: '8px 12px' }}>
                        {o.es_propia ? <span style={{ fontSize: 11, color: S.muted }}>Interno</span>
                          : o.estado_pago === 'pagado' ? <span style={{ padding: '2px 8px', borderRadius: 4, background: S.greenLight, color: S.green, fontSize: 11, fontWeight: 600 }}>✓ Pagado</span>
                          : <span style={{ padding: '2px 8px', borderRadius: 4, background: S.amberLight, color: S.amber, fontSize: 11, fontWeight: 600 }}>⏳ Pendiente</span>}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => generarOrdenTrabajo(o, campoO, loteO, stockAgro)}
                            style={{ padding: '3px 8px', fontSize: 11, background: S.greenLight, border: `1px solid ${S.green}`, color: S.green, borderRadius: 5, cursor: 'pointer' }}>📋 Orden</button>
                          <button onClick={async () => {
                            const superficie = o.superficie_ha_real || loteO?.superficie_ha || campoO?.superficie_ha || '—'
                            const fecha = o.fecha ? new Date(o.fecha + 'T12:00:00').toLocaleDateString('es-AR') : '—'
                            const productos = (o.productos || []).map(p => {
                              const item = stockAgro.find(s => String(s.id) === String(p.id))
                              const total = p.total || (p.dosis && superficie !== '—' ? (parseFloat(p.dosis) * parseFloat(superficie)).toFixed(1) : '—')
                              return `• ${item?.insumo || p.nombre || '—'}: ${p.dosis || '—'} ${p.unidad || ''}/ha = ${total} ${p.unidad || ''} total`
                            })
                            const lineas = [
                              `ORDEN DE TRABAJO — ${o.tipo?.toUpperCase() || ''}`,
                              `Campo: ${campoO?.nombre || '—'}${loteO ? ` · Lote ${loteO.numero}` : ''}`,
                              `Superficie: ${superficie} ha  ·  Fecha: ${fecha}`,
                              o.proveedor ? `Operario: ${o.proveedor}` : null,
                              o.descripcion ? `Descripción: ${o.descripcion}` : null,
                              productos.length > 0 ? '' : null,
                              productos.length > 0 ? 'PRODUCTOS:' : null,
                              ...productos,
                              o.observaciones ? '' : null,
                              o.observaciones ? `Obs: ${o.observaciones}` : null,
                            ].filter(l => l !== null)
                            const canvas = document.createElement('canvas')
                            const fontSize = 18
                            const padding = 24
                            const lineHeight = 28
                            canvas.width = 600
                            canvas.height = padding * 2 + lineas.length * lineHeight + 20
                            const ctx = canvas.getContext('2d')
                            ctx.fillStyle = '#ffffff'
                            ctx.fillRect(0, 0, canvas.width, canvas.height)
                            ctx.fillStyle = '#1E5C2E'
                            ctx.fillRect(0, 0, canvas.width, lineHeight + padding)
                            ctx.fillStyle = '#ffffff'
                            ctx.font = `bold ${fontSize}px Arial`
                            ctx.fillText(lineas[0], padding, padding + fontSize - 4)
                            ctx.fillStyle = '#1a1a1a'
                            ctx.font = `${fontSize - 2}px Arial`
                            lineas.slice(1).forEach((l, i) => {
                              if (l === 'PRODUCTOS:') {
                                ctx.font = `bold ${fontSize - 2}px Arial`
                                ctx.fillStyle = '#1E5C2E'
                              } else if (l.startsWith('•')) {
                                ctx.font = `${fontSize - 2}px Arial`
                                ctx.fillStyle = '#1a1a1a'
                              } else if (l === '') {
                                return
                              } else {
                                ctx.font = `${fontSize - 2}px Arial`
                                ctx.fillStyle = '#444444'
                              }
                              ctx.fillText(l, padding, padding + lineHeight + (i + 1) * lineHeight - 6)
                            })
                            canvas.toBlob(async blob => {
                              try {
                                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
                                alert('✓ Imagen copiada — pegala en Paint con Ctrl+V')
                              } catch {
                                const url = URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = url; a.download = 'orden.png'; a.click()
                              }
                            })
                          }} style={{ padding: '3px 8px', fontSize: 11, background: '#F0EAFB', border: '1px solid #9F8ED4', color: '#3D1A6B', borderRadius: 5, cursor: 'pointer' }}>📎 Copiar imagen</button>
                          {o.estado_pago === 'pagado' && o.costo_total && <button onClick={() => {
                            generarReciboOrden(o, campos, campanas, stockAgro)
                          }} style={{ padding: '3px 8px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>🖨️ Recibo</button>}
                          <button onClick={async () => {
                            if (!confirm('¿Eliminar esta orden? Se repondrá el stock de los insumos que se habían descontado.')) return
                            if (o.caja_oficial_id) await supabase.from('caja_oficial').delete().eq('id', o.caja_oficial_id)
                            if (o.caja_paralela_id) await supabase.from('caja_paralela').delete().eq('id', o.caja_paralela_id)
                            // Reponer stock de los insumos que se habían descontado al crear esta orden
                            for (const p of (o.productos || [])) {
                              if (!p.id || !p.dosis || !o.superficie_ha_real) continue
                              const usado = parseFloat(p.dosis) * o.superficie_ha_real
                              await supabase.rpc('incrementar_stock_agro', { p_id: parseInt(p.id), p_delta: usado })
                            }
                            await supabase.from('ordenes_trabajo').delete().eq('id', o.id)
                            await cargar()
                          }} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB PAGOS ── */}
      {tabInner === 'pagos' && (
        <div>
          {pendientes.length === 0 ? (
            <div style={{ fontSize: 13, color: S.hint, padding: '3rem', textAlign: 'center' }}>No hay órdenes pendientes de pago.</div>
          ) : (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: '1rem' }}>
                {pendientes.length} orden{pendientes.length !== 1 ? 'es' : ''} pendiente{pendientes.length !== 1 ? 's' : ''} · Total: <span style={{ fontFamily: 'monospace', color: S.red }}>${pendientes.reduce((s,o)=>s+(o.costo_total||0),0).toLocaleString('es-AR')}</span>
              </div>

              {/* Lista con checkboxes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: '1.5rem' }}>
                {pendientes.map(o => {
                  const campoO = campos.find(c => c.id === o.campo_id)
                  const loteO = (o.campos?.lotes_agricolas || campoO?.lotes_agricolas || []).find(l => l.id === o.lote_id)
                  return (
                    <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: `1px solid ${seleccionadas.includes(o.id) ? S.accent : S.border}`, borderRadius: 8, background: seleccionadas.includes(o.id) ? S.accentLight : S.surface, cursor: 'pointer' }}>
                      <input type="checkbox" checked={seleccionadas.includes(o.id)} onChange={e => setSeleccionadas(e.target.checked ? [...seleccionadas, o.id] : seleccionadas.filter(id => id !== o.id))} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{o.tipo} — {campoO?.nombre}{loteO ? ` Lote ${loteO.numero}` : ''}</div>
                        <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>
                          {o.fecha ? new Date(o.fecha+'T12:00:00').toLocaleDateString('es-AR') : '—'}
                          {o.proveedor ? ` · ${o.proveedor}` : ''}
                          {o.productos?.length ? ` · ${o.productos.length} productos` : ''}
                        </div>
                      </div>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: S.red }}>
                        {o.costo_total
                          ? `$${o.costo_total.toLocaleString('es-AR')}`
                          : (
                            <div onClick={e => e.preventDefault()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 11, color: S.amber, fontWeight: 400 }}>Costo $:</span>
                              <input type="number" value={costosPend[o.id] || ''} onChange={e => setCostosPend({...costosPend, [o.id]: e.target.value})}
                                placeholder="ej. 45000" style={{ width: 100, padding: '4px 8px', border: `1px solid ${S.amber}`, borderRadius: 5, fontSize: 12, fontFamily: 'monospace' }} />
                            </div>
                          )}
                      </span>
                    </label>
                  )
                })}
              </div>

              {seleccionadas.length > 0 && (
                <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: '1rem' }}>
                    Pagar {seleccionadas.length} orden{seleccionadas.length !== 1 ? 'es' : ''} · <span style={{ fontFamily: 'monospace', color: S.red }}>${totalSelec.toLocaleString('es-AR')}</span>
                  </div>

                  {/* Datos contratista para recibo */}
                  <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '12px', marginBottom: '1rem' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 10 }}>Datos del contratista (para el recibo)</div>
                    <div style={{ marginBottom: 10 }}>
                      <Label>Seleccionar de contactos</Label>
                      <select onChange={e => { const ct = contactos.find(c => String(c.id) === e.target.value); if (ct) setFormPagoGrupal({...formPagoGrupal, domicilio: ct.banco||'', localidad: ct.localidad||'', cuit: ct.cuit||'', iva: ct.iva||'', cbu: ct.cbu||''}) }} style={inputStyle} defaultValue="">
                        <option value="">— Seleccionar contacto —</option>
                        {contactos.map(c => <option key={c.id} value={c.id}>{c.nombre}{c.cuit ? ` · ${c.cuit}` : ''}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      <div><Label>Localidad</Label><input type="text" value={formPagoGrupal.localidad} onChange={e => setFormPagoGrupal({...formPagoGrupal, localidad: e.target.value})} style={inputStyle} /></div>
                      <div><Label>CUIT</Label><input type="text" value={formPagoGrupal.cuit} onChange={e => setFormPagoGrupal({...formPagoGrupal, cuit: e.target.value})} style={inputStyle} /></div>
                      <div><Label>IVA</Label><input type="text" value={formPagoGrupal.iva} onChange={e => setFormPagoGrupal({...formPagoGrupal, iva: e.target.value})} style={inputStyle} /></div>
                      <div><Label>CBU</Label><input type="text" value={formPagoGrupal.cbu} onChange={e => setFormPagoGrupal({...formPagoGrupal, cbu: e.target.value})} style={inputStyle} /></div>
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <Label>Fecha de pago</Label>
                    <input type="date" value={formPagoGrupal.fecha} onChange={e => setFormPagoGrupal({...formPagoGrupal, fecha: e.target.value})} style={{ ...inputStyle, maxWidth: 200 }} />
                  </div>

                  <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 8 }}>Formas de pago</div>
                  <ListaPagos pagos={formPagoGrupal.pagos} onChangePagos={n => setFormPagoGrupal({...formPagoGrupal, pagos: n})} chequesCartera={chequesCartera} S={S} soloTerceroSiParalelo opcionesExtra={[{ value: 'cuenta_corriente', label: 'Cuenta corriente' }]} />


                  <div style={{ background: Math.abs(totalSelec-totalPagoGrupal) < 0.5 ? S.greenLight : S.amberLight, border: `1px solid ${Math.abs(totalSelec-totalPagoGrupal) < 0.5 ? '#97C459' : '#EF9F27'}`, borderRadius: 6, padding: '8px 12px', fontSize: 13, marginBottom: '1rem' }}>
                    Total órdenes: <strong>${totalSelec.toLocaleString('es-AR')}</strong> · Pagos: <strong>${totalPagoGrupal.toLocaleString('es-AR')}</strong>
                    {Math.abs(totalSelec-totalPagoGrupal) >= 0.5 && <span style={{ marginLeft: 12, color: S.amber, fontWeight: 600 }}>Diferencia: ${(totalSelec-totalPagoGrupal).toLocaleString('es-AR')}</span>}
                  </div>

                  {faltaCosto && <div style={{ fontSize: 12, color: S.amber, marginBottom: 10 }}>⚠ Cargá el costo de las órdenes marcadas en amarillo antes de pagar</div>}
                  <button onClick={pagarSeleccionadas} disabled={guardandoPago || faltaCosto}
                    style={{ padding: '9px 24px', fontSize: 13, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: (guardandoPago || faltaCosto) ? 'default' : 'pointer', opacity: faltaCosto ? 0.6 : 1 }}>
                    {guardandoPago ? 'Registrando...' : `💾 Pagar ${seleccionadas.length} orden${seleccionadas.length !== 1 ? 'es' : ''} y generar recibos`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}


function TabCosechas({ cosechas, campos, campanas, campanaActiva, planes, cargar, contactos }) {
  const [showForm, setShowForm] = useState(false)
  const [pagarAhora, setPagarAhora] = useState(true)
  const [showPagos, setShowPagos] = useState(false)
  const [seleccionadas, setSeleccionadas] = useState([])
  const [formPagoGrupal, setFormPagoGrupal] = useState({ fecha: hoyLocal(), pagos: [{ ...PAGO_INIT_ORDEN }] })
  const [guardandoPago, setGuardandoPago] = useState(false)
  const [form, setForm] = useState({ campo_id: '', campana_id: campanaActiva?.id || '', lote_id: '', cultivo: '', fecha: hoyLocal(), kg_totales: '', rendimiento_tn_ha: '', humedad_pct: '', destino: '', acopio: '', observaciones: '' })
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    if (!form.campo_id || !form.cultivo || !form.kg_totales) { alert('Completá campo, cultivo y kg totales'); return }
    setGuardando(true)
    const campo = campos.find(c => c.id === parseInt(form.campo_id))
    const lote = campo?.lotes_agricolas?.find(l => l.id === parseInt(form.lote_id))
    const supRef = lote?.superficie_ha || campo?.superficie_ha
    // 1 tonelada = 1000 kg, así que tn/ha = kg / 1000 / hectáreas.
    const rendimiento = form.rendimiento_tn_ha || (form.kg_totales && supRef ? (parseFloat(form.kg_totales) / 1000 / supRef).toFixed(2) : null)
    const { error } = await supabase.from('cosechas').insert({
      campo_id: parseInt(form.campo_id),
      campana_id: parseInt(form.campana_id) || null,
      lote_id: form.lote_id ? parseInt(form.lote_id) : null,
      cultivo: form.cultivo,
      fecha: form.fecha,
      kg_totales: parseFloat(form.kg_totales),
      rendimiento_tn_ha: parseFloat(rendimiento) || null,
      humedad_pct: parseFloat(form.humedad_pct) || null,
      destino: form.destino || null,
      acopio: form.destino === 'acopio' ? (form.acopio || null) : null,
      observaciones: form.observaciones || null,
    })
    if (error) { alert('Error al guardar la cosecha: ' + error.message); setGuardando(false); return }
    await cargar()
    setShowForm(false)
    setForm({ campo_id: '', campana_id: campanaActiva?.id || '', lote_id: '', cultivo: '', fecha: hoyLocal(), kg_totales: '', rendimiento_tn_ha: '', humedad_pct: '', destino: '', acopio: '', observaciones: '' })
    setGuardando(false)
  }

  const kgTotal = cosechas.filter(c => c.campana_id === campanaActiva?.id).reduce((s, c) => s + (c.kg_totales || 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Cosechas</div>
          {kgTotal > 0 && <div style={{ fontSize: 12, color: S.green, marginTop: 2 }}>Campaña activa: {(kgTotal / 1000).toLocaleString('es-AR')} tn cosechadas</div>}
        </div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          + Registrar cosecha
        </button>
      </div>

      {showForm && (
        <Card titulo="Registrar cosecha">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <Label>Campo *</Label>
              <select value={form.campo_id} onChange={e => { setForm({...form, campo_id: e.target.value, lote_id: '', cultivo: ''}) }} style={inputStyle}>
                <option value="">— Seleccioná —</option>
                {campos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            {(campos.find(c => c.id === parseInt(form.campo_id))?.lotes_agricolas || []).length > 0 && (
              <div>
                <Label>Lote</Label>
                <select value={form.lote_id} onChange={e => setForm({...form, lote_id: e.target.value})} style={inputStyle}>
                  <option value="">— Todo el campo —</option>
                  {(campos.find(c => c.id === parseInt(form.campo_id))?.lotes_agricolas || []).map(l => <option key={l.id} value={l.id}>Lote {l.numero} ({l.superficie_ha} ha)</option>)}
                </select>
              </div>
            )}
            <div>
              <Label>Cultivo *</Label>
              <select value={form.cultivo} onChange={e => setForm({...form, cultivo: e.target.value})} style={inputStyle}>
                <option value="">— Seleccioná —</option>
                {CULTIVOS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label>Campaña</Label>
              <select value={form.campana_id} onChange={e => setForm({...form, campana_id: e.target.value})} style={inputStyle}>
                <option value="">— Seleccioná —</option>
                {campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <Label>Fecha cosecha</Label>
              <input type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} style={inputStyle} />
            </div>
            <div>
              <Label>Kg totales *</Label>
              <input type="number" value={form.kg_totales} onChange={e => setForm({...form, kg_totales: e.target.value})} style={inputStyle} />
            </div>
            <div>
              <Label>Humedad %</Label>
              <input type="number" value={form.humedad_pct} onChange={e => setForm({...form, humedad_pct: e.target.value})} placeholder="ej. 13.5" style={inputStyle} />
            </div>
            <div>
              <Label>Rendimiento tn/ha (auto si hay kg)</Label>
              <input type="number" value={form.rendimiento_tn_ha} onChange={e => setForm({...form, rendimiento_tn_ha: e.target.value})}
                placeholder={(() => {
                  const campoSel = campos.find(c => c.id === parseInt(form.campo_id))
                  const loteSel = campoSel?.lotes_agricolas?.find(l => l.id === parseInt(form.lote_id))
                  const sup = loteSel?.superficie_ha || campoSel?.superficie_ha
                  // 1 tonelada = 1000 kg, así que tn/ha = kg / 1000 / hectáreas.
                  return (form.kg_totales && sup) ? (parseFloat(form.kg_totales) / 1000 / sup).toFixed(2) : ''
                })()} style={inputStyle} />
            </div>
            <div style={{ gridColumn: form.destino === 'acopio' ? '1/2' : '1/-1' }}>
              <Label>Destino</Label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ v: 'bolsa', l: '🎒 Bolsa (en el campo)' }, { v: 'acopio', l: '🏭 Entregado a acopio' }].map(opt => (
                  <button key={opt.v} type="button" onClick={() => setForm({...form, destino: form.destino === opt.v ? '' : opt.v})}
                    style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer', border: `1px solid ${form.destino === opt.v ? S.accent : S.border}`, background: form.destino === opt.v ? S.accentLight : 'transparent', color: form.destino === opt.v ? S.accent : S.muted }}>
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
            {form.destino === 'acopio' && (
              <div>
                <Label>Acopio / Comprador</Label>
                <select value={form.acopio} onChange={e => setForm({...form, acopio: e.target.value})} style={inputStyle}>
                  <option value="">— Seleccioná —</option>
                  {(contactos || []).map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                </select>
                <div style={{ fontSize: 10, color: S.hint, marginTop: 3 }}>¿No aparece? Cargalo primero en Contactos.</div>
              </div>
            )}
            <div style={{ gridColumn: '1/-1' }}>
              <Label>Observaciones</Label>
              <input type="text" value={form.observaciones} onChange={e => setForm({...form, observaciones: e.target.value})} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={guardar} disabled={guardando} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
            <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </Card>
      )}

      <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: S.bg }}>
            {['Fecha', 'Campo', 'Lote', 'Campaña', 'Cultivo', 'Kg totales', 'Tn', 'Rend. tn/ha', 'Humedad', 'Destino', 'Obs.', ''].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 10, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {cosechas.length === 0 && <tr><td colSpan={12} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay cosechas registradas.</td></tr>}
            {cosechas.map(c => {
              const loteC = campos.find(x => x.id === c.campo_id)?.lotes_agricolas?.find(l => l.id === c.lote_id)
              return (
              <tr key={c.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12 }}>{c.fecha ? new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}</td>
                <td style={{ padding: '8px 12px', fontWeight: 600 }}>{c.campos?.nombre}</td>
                <td style={{ padding: '8px 12px', fontSize: 12, color: S.muted }}>{c.lote_id ? `Lote ${loteC?.numero || c.lote_id}` : 'Todo el campo'}</td>
                <td style={{ padding: '8px 12px', fontSize: 12, color: S.muted }}>{c.campanas?.nombre}</td>
                <td style={{ padding: '8px 12px' }}><span style={{ padding: '2px 8px', borderRadius: 4, background: S.greenLight, color: S.green, fontSize: 11, fontWeight: 600 }}>{c.cultivo}</span></td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{c.kg_totales ? c.kg_totales.toLocaleString('es-AR') : '—'}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: S.muted }}>{c.kg_totales ? (c.kg_totales / 1000).toLocaleString('es-AR') : '—'}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600, color: S.green }}>{c.rendimiento_tn_ha ? `${c.rendimiento_tn_ha} tn/ha` : '—'}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: S.muted }}>{c.humedad_pct ? `${c.humedad_pct}%` : '—'}</td>
                <td style={{ padding: '8px 12px', fontSize: 12 }}>
                  {c.destino === 'bolsa' && <span style={{ padding: '2px 8px', borderRadius: 4, background: S.amberLight, color: S.amber, fontWeight: 600 }}>🎒 Bolsa</span>}
                  {c.destino === 'acopio' && <span style={{ padding: '2px 8px', borderRadius: 4, background: S.accentLight, color: S.accent, fontWeight: 600 }}>🏭 {c.acopio || 'Acopio'}</span>}
                  {!c.destino && '—'}
                </td>
                <td style={{ padding: '8px 12px', fontSize: 12, color: S.muted }}>{c.observaciones || '—'}</td>
                <td style={{ padding: '8px 12px' }}>
                  <button onClick={async () => { if (!confirm('¿Eliminar?')) return; await supabase.from('cosechas').delete().eq('id', c.id); cargar() }}
                    style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── TAB VENTAS DE GRANOS ──
function TabVentasGranos({ ventas, campos, campanas, campanaActiva, cosechas, cargar, stockInsumosAlim, usuario }) {
  const [showForm, setShowForm] = useState(false)
  const [pagarAhora, setPagarAhora] = useState(true)
  const [showPagos, setShowPagos] = useState(false)
  const [seleccionadas, setSeleccionadas] = useState([])
  const [formPagoGrupal, setFormPagoGrupal] = useState({ fecha: hoyLocal(), pagos: [{ ...PAGO_INIT_ORDEN }] })
  const [guardandoPago, setGuardandoPago] = useState(false)
  const [form, setForm] = useState({ campo_id: '', campana_id: campanaActiva?.id || '', cultivo: '', fecha: hoyLocal(), kg: '', precio_tn: '', monto_facturado: '', monto_negro: '', iva_pct: '10.5', comprador: '', numero_contrato: '', observaciones: '', esVentaInternaFeedlot: false, stock_insumo_id: '' })
  const [guardando, setGuardando] = useState(false)
  const [editando, setEditando] = useState(null)

  const totalVendido = ventas.reduce((s, v) => s + (v.kg || 0), 0)
  const totalIngresos = ventas.reduce((s, v) => s + (v.total || 0), 0)

  async function guardar() {
    if (!form.cultivo || !form.kg) { alert('Completá cultivo y kg'); return }
    if (form.esVentaInternaFeedlot && !form.stock_insumo_id) { alert('Elegí a qué insumo del stock de Alimentación va este grano (ej. Maíz grano seco)'); return }
    setGuardando(true)
    const kg = parseFloat(form.kg)
    const precioTn = parseFloat(form.precio_tn) || 0
    const total = precioTn ? Math.round(kg * precioTn / 1000) : null
    // Venta interna a Feedlot: no hay factura ni negro, es un traspaso entre
    // actividades de la misma empresa — el total entero se trata como "cobrado"
    // sin generar ningún movimiento de caja real.
    const montoFact = form.esVentaInternaFeedlot ? total : (form.monto_facturado ? parseFloat(form.monto_facturado) : total)
    const montoNegro = form.esVentaInternaFeedlot ? 0 : (total && montoFact ? Math.max(0, total - montoFact) : 0)
    const data = {
      campo_id: parseInt(form.campo_id) || null,
      campana_id: parseInt(form.campana_id) || null,
      cultivo: form.cultivo,
      fecha: form.fecha,
      kg,
      precio_tn: precioTn || null,
      total,
      monto_facturado: montoFact,
      monto_negro: montoNegro,
      iva_pct: parseFloat(form.iva_pct) || 10.5,
      comprador: form.esVentaInternaFeedlot ? 'Feedlot (interno)' : (form.comprador || null),
      numero_contrato: form.numero_contrato || null,
      observaciones: form.observaciones || null,
      estado: 'confirmado',
    }
    if (editando) {
      const { error } = await supabase.from('ventas_granos').update(data).eq('id', editando)
      if (error) { alert('Error al guardar: ' + error.message); setGuardando(false); return }
    } else {
      const { data: vg, error: errVg } = await supabase.from('ventas_granos').insert(data).select().single()
      if (errVg) { alert('Error al guardar la venta: ' + errVg.message); setGuardando(false); return }
      if (form.esVentaInternaFeedlot) {
        // No se mueve ninguna caja — es la misma empresa. Del lado de
        // Alimentación, se refleja como una compra de insumo ya "pagada"
        // (sin caja tampoco), y el grano se suma directo a su stock para
        // poder usarlo en las dietas.
        const stockItem = stockInsumosAlim.find(s => s.id === parseInt(form.stock_insumo_id))
        const { error: errCompra } = await supabase.from('compras_insumos').insert({
          insumo_id: parseInt(form.stock_insumo_id), insumo_tipo: 'alimentacion',
          insumo_nombre: stockItem?.insumo || form.cultivo, unidad: 'kg',
          cantidad: kg, precio_unitario: precioTn ? Math.round(precioTn / 1000 * 100) / 100 : null, total,
          proveedor: 'Agricultura (interno)', fecha: form.fecha,
          estado_pago: 'pagado', retirado: true, registrado_por: usuario?.id,
          observaciones: `Traspaso interno — venta de granos #${vg?.id}`,
        })
        if (errCompra) {
          alert('La venta se guardó, pero no se pudo reflejar en Alimentación: ' + errCompra.message)
        } else {
          const { error: errRpc } = await supabase.rpc('incrementar_stock_insumo', { p_id: parseInt(form.stock_insumo_id), p_delta: kg })
          if (errRpc) alert('La venta y la compra se guardaron, pero no se pudo sumar al stock de Alimentación: ' + errRpc.message)
        }
      } else if (total && total > 0) {
        const desc = `Venta ${form.cultivo} — ${form.comprador || 'sin comprador'} · ${kg?.toLocaleString('es-AR')} kg`
        if (montoFact && montoFact > 0) {
          const { error: e1 } = await supabase.from('caja_oficial').insert({ fecha: form.fecha, tipo: 'ingreso', categoria: 'Venta cereales', descripcion: desc, monto: montoFact, forma_pago: 'transferencia' })
          if (e1) alert('La venta se guardó, pero no se pudo cargar en caja oficial: ' + e1.message)
        }
        if (montoNegro && montoNegro > 0) {
          const { error: e2 } = await supabase.from('caja_paralela').insert({ fecha: form.fecha, tipo: 'ingreso', descripcion: desc, monto: montoNegro })
          if (e2) alert('La venta se guardó, pero no se pudo cargar en Caja 2: ' + e2.message)
        }
      }
    }
    await cargar()
    setShowForm(false)
    setEditando(null)
    setForm({ campo_id: '', campana_id: campanaActiva?.id || '', cultivo: '', fecha: hoyLocal(), kg: '', precio_tn: '', monto_facturado: '', monto_negro: '', iva_pct: '10.5', comprador: '', numero_contrato: '', observaciones: '', esVentaInternaFeedlot: false, stock_insumo_id: '' })
    setGuardando(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Ventas de granos</div>
          <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>
            Total vendido: <strong>{(totalVendido / 1000).toLocaleString('es-AR')} tn</strong>
            {totalIngresos > 0 && <> · Ingresos: <strong style={{ color: S.green }}>${totalIngresos.toLocaleString('es-AR')}</strong></>}
          </div>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditando(null) }}
          style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          + Registrar venta
        </button>
      </div>

      {showForm && (
        <Card titulo={editando ? 'Editar venta' : 'Nueva venta de granos'}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <Label>Campo</Label>
              <select value={form.campo_id} onChange={e => setForm({...form, campo_id: e.target.value})} style={inputStyle}>
                <option value="">— Seleccioná —</option>
                {campos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <Label>Cultivo *</Label>
              <select value={form.cultivo} onChange={e => setForm({...form, cultivo: e.target.value})} style={inputStyle}>
                <option value="">— Seleccioná —</option>
                {CULTIVOS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label>Campaña</Label>
              <select value={form.campana_id} onChange={e => setForm({...form, campana_id: e.target.value})} style={inputStyle}>
                <option value="">— Seleccioná —</option>
                {campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <Label>Fecha</Label>
              <input type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} style={inputStyle} />
            </div>
            <div>
              <Label>Kg vendidos *</Label>
              <input type="number" value={form.kg} onChange={e => setForm({...form, kg: e.target.value})} style={inputStyle} />
            </div>
            <div>
              <Label>Precio $/tn</Label>
              <input type="number" value={form.precio_tn} onChange={e => setForm({...form, precio_tn: e.target.value})} style={inputStyle} />
            </div>
            {form.precio_tn && form.kg && (
              <div style={{ gridColumn: '1/-1', background: S.greenLight, border: '1px solid #97C459', borderRadius: 6, padding: '10px 12px', fontSize: 13, color: S.green }}>
                Total operación: <strong>${Math.round(parseFloat(form.kg) * parseFloat(form.precio_tn) / 1000).toLocaleString('es-AR')}</strong>
                {' '}· ({(parseFloat(form.kg) / 1000).toLocaleString('es-AR')} tn × ${parseFloat(form.precio_tn).toLocaleString('es-AR')}/tn)
              </div>
            )}
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.esVentaInternaFeedlot} onChange={e => setForm({...form, esVentaInternaFeedlot: e.target.checked, comprador: '', monto_facturado: ''})} />
                <span style={{ fontSize: 13 }}>🐄 Es venta interna al Feedlot (para alimentación) — sin caja, va directo al stock</span>
              </label>
            </div>
            {form.esVentaInternaFeedlot ? (
              <div style={{ gridColumn: '1/-1' }}>
                <Label>¿A qué insumo del stock de Alimentación va? *</Label>
                <select value={form.stock_insumo_id} onChange={e => setForm({...form, stock_insumo_id: e.target.value})} style={inputStyle}>
                  <option value="">— Seleccioná —</option>
                  {stockInsumosAlim.map(s => <option key={s.id} value={s.id}>{s.insumo}</option>)}
                </select>
                <div style={{ fontSize: 11, color: S.hint, marginTop: 4 }}>El kg cargado arriba se suma directo a ese insumo del stock de Alimentación, listo para usar en las dietas.</div>
              </div>
            ) : (
              <>
                <div>
                  <Label>Neto facturado $</Label>
                  <input type="number" value={form.monto_facturado} onChange={e => setForm({...form, monto_facturado: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <Label>% IVA</Label>
                  <select value={form.iva_pct} onChange={e => setForm({...form, iva_pct: e.target.value})} style={inputStyle}>
                    <option value="0">Sin IVA</option>
                    <option value="10.5">10.5%</option>
                    <option value="21">21%</option>
                  </select>
                </div>
                <div>
                  <Label>Comprador / Acopio</Label>
                  <input type="text" value={form.comprador} onChange={e => setForm({...form, comprador: e.target.value})} style={inputStyle} />
                </div>
              </>
            )}
            <div>
              <Label>N° Contrato</Label>
              <input type="text" value={form.numero_contrato} onChange={e => setForm({...form, numero_contrato: e.target.value})} style={inputStyle} />
            </div>
            <div>
              <Label>Observaciones</Label>
              <input type="text" value={form.observaciones} onChange={e => setForm({...form, observaciones: e.target.value})} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={guardar} disabled={guardando} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
            <button onClick={() => { setShowForm(false); setEditando(null) }} style={{ padding: '8px 16px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </Card>
      )}

      <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 900 }}>
          <thead><tr style={{ background: S.bg }}>
            {['Fecha', 'Campo', 'Cultivo', 'Kg', 'Tn', '$/tn', 'Total', 'Facturado', 'Caja 2', 'Comprador', ''].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 10, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {ventas.length === 0 && <tr><td colSpan={11} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay ventas registradas.</td></tr>}
            {ventas.map(v => (
              <tr key={v.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12 }}>{v.fecha ? new Date(v.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}</td>
                <td style={{ padding: '8px 12px', fontWeight: 600, fontSize: 12 }}>{campos.find(c => c.id === v.campo_id)?.nombre || '—'}</td>
                <td style={{ padding: '8px 12px' }}><span style={{ padding: '2px 8px', borderRadius: 4, background: S.greenLight, color: S.green, fontSize: 11, fontWeight: 600 }}>{v.cultivo}</span></td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{v.kg ? v.kg.toLocaleString('es-AR') : '—'}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: S.muted }}>{v.kg ? (v.kg / 1000).toLocaleString('es-AR') : '—'}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: S.muted }}>{v.precio_tn ? `$${v.precio_tn.toLocaleString('es-AR')}` : '—'}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600, color: S.green }}>{v.total ? `$${v.total.toLocaleString('es-AR')}` : '—'}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: S.accent }}>{v.monto_facturado ? `$${v.monto_facturado.toLocaleString('es-AR')}` : '—'}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: S.purple }}>{v.monto_negro > 0 ? `$${v.monto_negro.toLocaleString('es-AR')}` : '—'}</td>
                <td style={{ padding: '8px 12px', fontSize: 12, color: S.muted }}>{v.comprador || '—'}</td>
                <td style={{ padding: '8px 12px', display: 'flex', gap: 4 }}>
                  <button onClick={() => { setEditando(v.id); setForm({ campo_id: v.campo_id || '', campana_id: v.campana_id || '', cultivo: v.cultivo || '', fecha: v.fecha || '', kg: v.kg || '', precio_tn: v.precio_tn || '', monto_facturado: v.monto_facturado || '', monto_negro: v.monto_negro || '', iva_pct: v.iva_pct || '10.5', comprador: v.comprador || '', numero_contrato: v.numero_contrato || '', observaciones: v.observaciones || '' }); setShowForm(true) }}
                    style={{ padding: '3px 8px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>Editar</button>
                  <button onClick={async () => { if (!confirm('¿Eliminar?')) return; await supabase.from('ventas_granos').delete().eq('id', v.id); cargar() }}
                    style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── TAB GASTOS ──
function TabGastos({ gastos, campos, campanas, campanaActiva, cargar }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ campo_id: '', campana_id: campanaActiva?.id || '', concepto: '', monto: '', fecha: hoyLocal(), proveedor: '', observaciones: '', pagos: [{ ...PAGO_INIT }] })
  const [guardando, setGuardando] = useState(false)
  const [editando, setEditando] = useState(null)
  const [chequesCartera, setChequesCartera] = useState([])

  useEffect(() => {
    supabase.from('cheques').select('*').eq('tipo', 'recibido').eq('estado', 'en_cartera').order('fecha_vencimiento').then(({ data }) => setChequesCartera(data || []))
  }, [])

  const totalGastos = gastos.reduce((s, g) => s + (g.monto || 0), 0)
  const totalPagos = form.pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)

  async function guardar() {
    if (!form.concepto || !form.monto) { alert('Completá concepto y monto'); return }
    setGuardando(true)
    const monto = parseFloat(form.monto)

    let caja_oficial_id = null, caja_paralela_id = null
    if (!editando) {
      // El pago solo se registra al crear el gasto (no se vuelve a cobrar caja al editar)
      for (const pago of form.pagos.filter(p => p.monto)) {
        const m = parseFloat(pago.monto) || 0
        if (!m) continue
        if (pago.tipo === 'canje') continue
        const desc = `${form.concepto} — Agricultura${form.proveedor ? ' — ' + form.proveedor : ''}`
        if (pago.es_paralelo) {
          const { data: cp, error: ep } = await supabase.from('caja_paralela').insert({ fecha: form.fecha, tipo: 'egreso', descripcion: desc, monto: m }).select().single()
          if (ep) { alert('Error al registrar en Caja 2: ' + ep.message); setGuardando(false); return }
          if (!caja_paralela_id) caja_paralela_id = cp?.id
        } else {
          const { data: co, error: eo } = await supabase.from('caja_oficial').insert({ fecha: form.fecha, tipo: 'egreso', categoria: 'Gastos Agricultura', descripcion: desc, monto: m, forma_pago: pago.subtipo_cheque || pago.tipo }).select().single()
          if (eo) { alert('Error al registrar en caja oficial: ' + eo.message); setGuardando(false); return }
          if (!caja_oficial_id) caja_oficial_id = co?.id
          if (pago.subtipo_cheque === 'propio' && pago.cheque_propio?.fecha_vencimiento) {
            const { error: ec } = await supabase.from('cheques').insert({ tipo: 'emitido', numero: pago.cheque_propio.numero || null, banco: pago.cheque_propio.banco || null, fecha_cobro: form.fecha, fecha_vencimiento: pago.cheque_propio.fecha_vencimiento, monto: m, beneficiario: form.proveedor || null, estado: 'en_cartera', caja_oficial_id, es_electronico: pago.tipo === 'e-cheq' })
            if (ec) { alert('Error al registrar el cheque: ' + ec.message); setGuardando(false); return }
          } else if (pago.subtipo_cheque === 'tercero' && pago.cheque_tercero_ids?.length > 0) {
            for (const chId of pago.cheque_tercero_ids) await supabase.from('cheques').update({ estado: 'depositado' }).eq('id', parseInt(chId))
          }
        }
      }
    }

    const data = {
      campo_id: parseInt(form.campo_id) || null, campana_id: parseInt(form.campana_id) || null,
      categoria: form.concepto, descripcion: form.concepto, monto, fecha: form.fecha,
      proveedor: form.proveedor || null, actividad: 'Agricultura',
    }
    if (!editando) {
      data.forma_pago = form.pagos.map(p => p.subtipo_cheque || p.tipo).join('+')
      data.es_paralelo = form.pagos.some(p => p.es_paralelo)
      data.pagos_detalle = form.pagos
      data.caja_oficial_id = caja_oficial_id
      data.caja_paralela_id = caja_paralela_id
    }
    const { error } = editando
      ? await supabase.from('gastos_generales').update(data).eq('id', editando)
      : await supabase.from('gastos_generales').insert(data)
    if (error) { alert('Error al guardar el gasto: ' + error.message); setGuardando(false); return }
    await cargar()
    setShowForm(false)
    setEditando(null)
    setForm({ campo_id: '', campana_id: campanaActiva?.id || '', concepto: '', monto: '', fecha: hoyLocal(), proveedor: '', observaciones: '', pagos: [{ ...PAGO_INIT }] })
    setGuardando(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Gastos de Agricultura</div>
          <div style={{ fontSize: 12, color: S.red, marginTop: 2 }}>Total: <strong>-${totalGastos.toLocaleString('es-AR')}</strong></div>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditando(null) }}
          style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          + Registrar gasto
        </button>
      </div>
      <div style={{ fontSize: 11, color: S.hint, marginBottom: '1rem', marginTop: -8 }}>
        Si elegís un campo, el gasto también se va a sumar a la rentabilidad de ese lote — dejalo vacío para un gasto general de Agricultura (seguro, administración, etc.).
      </div>

      {showForm && (
        <Card titulo={editando ? 'Editar gasto' : 'Nuevo gasto'}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <div><Label>Campo (opcional)</Label><select value={form.campo_id} onChange={e => setForm({...form, campo_id: e.target.value})} style={inputStyle}><option value="">— Gasto general —</option>{campos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
            <div><Label>Campaña</Label><select value={form.campana_id} onChange={e => setForm({...form, campana_id: e.target.value})} style={inputStyle}><option value="">— Seleccioná —</option>{campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
            <div><Label>Concepto *</Label><input type="text" value={form.concepto} onChange={e => setForm({...form, concepto: e.target.value})} placeholder="ej. Seguro, Análisis de suelo, etc." style={inputStyle} /></div>
            <div><Label>Monto $ *</Label><input type="number" value={form.monto} onChange={e => setForm({...form, monto: e.target.value})} style={inputStyle} /></div>
            <div><Label>Fecha</Label><input type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} style={inputStyle} /></div>
            <div><Label>Proveedor</Label><input type="text" value={form.proveedor} onChange={e => setForm({...form, proveedor: e.target.value})} style={inputStyle} /></div>
          </div>
          {!editando && (
            <div style={{ marginBottom: '1rem' }}>
              <Label>Formas de pago</Label>
              <div style={{ marginTop: 4 }}>
                <ListaPagos pagos={form.pagos} onChangePagos={n => setForm({...form, pagos: n})} chequesCartera={chequesCartera} S={S} />
              </div>
              <div style={{ fontSize: 12, color: Math.abs(totalPagos - (parseFloat(form.monto) || 0)) < 0.5 ? S.green : S.amber, marginTop: 4 }}>
                Total pagos: ${totalPagos.toLocaleString('es-AR')} {form.monto ? `de $${parseFloat(form.monto).toLocaleString('es-AR')}` : ''}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={guardar} disabled={guardando} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
            <button onClick={() => { setShowForm(false); setEditando(null) }} style={{ padding: '8px 16px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </Card>
      )}

      <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: S.bg }}>
            {['Fecha', 'Campo', 'Campaña', 'Concepto', 'Proveedor', 'Monto', ''].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 10, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {gastos.length === 0 && <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay gastos registrados.</td></tr>}
            {gastos.map(g => (
              <tr key={g.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12 }}>{g.fecha ? new Date(g.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}</td>
                <td style={{ padding: '8px 12px', fontWeight: 600, fontSize: 12 }}>{g.campos?.nombre || '— general —'}</td>
                <td style={{ padding: '8px 12px', fontSize: 12, color: S.muted }}>{g.campanas?.nombre || '—'}</td>
                <td style={{ padding: '8px 12px' }}>{g.categoria || g.descripcion}</td>
                <td style={{ padding: '8px 12px', color: S.muted }}>{g.proveedor || '—'}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600, color: S.red }}>-${g.monto ? g.monto.toLocaleString('es-AR') : '—'}</td>
                <td style={{ padding: '8px 12px', display: 'flex', gap: 4 }}>
                  <button onClick={() => { setEditando(g.id); setForm({ campo_id: g.campo_id || '', campana_id: g.campana_id || '', concepto: g.categoria || g.descripcion || '', monto: g.monto || '', fecha: g.fecha || '', proveedor: g.proveedor || '', observaciones: '', pagos: [{ ...PAGO_INIT }] }); setShowForm(true) }}
                    style={{ padding: '3px 8px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>Editar</button>
                  <button onClick={async () => {
                    if (!confirm('¿Eliminar? Esto también va a sacar el movimiento de caja asociado.')) return
                    if (g.caja_oficial_id) await supabase.from('caja_oficial').delete().eq('id', g.caja_oficial_id)
                    if (g.caja_paralela_id) await supabase.from('caja_paralela').delete().eq('id', g.caja_paralela_id)
                    const { error } = await supabase.from('gastos_generales').delete().eq('id', g.id)
                    if (error) { alert('Error al eliminar: ' + error.message); return }
                    cargar()
                  }} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── TAB ARRIENDOS ──

function generarReciboArriendo(v, campo, pagos) {
  const fecha = v.pagado_en ? new Date(v.pagado_en + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : new Date().toLocaleDateString('es-AR')
  const totalMonto = pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
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
  const fechaVenc = v.fecha_vencimiento ? new Date(v.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'
  const concepto = `Arriendo — ${campo?.nombre || ''} · ${v.tn_ha || ''} tn/ha · ${campo?.superficie_ha || ''} ha · Venc. ${fechaVenc}${v.precio_pizarra ? ` · $${v.precio_pizarra.toLocaleString('es-AR')}/tn` : ''}`
  const filasPago = pagos.flatMap(p => {
    let desc = p.tipo === 'transferencia' ? 'TRANSFERENCIA' : p.tipo === 'efectivo' ? 'EFECTIVO' : p.tipo === 'cuenta_corriente' ? 'CUENTA CORRIENTE' : p.subtipo_cheque === 'propio' ? 'E-CHEQ PROPIO' : p.subtipo_cheque === 'tercero' ? 'E-CHEQ TERCERO' : (p.tipo || '').toUpperCase()
    if (p.es_paralelo) desc += ' (CAJA 2)'
    if (p.subtipo_cheque === 'propio' && p.cheque_propio?.fecha_vencimiento) {
      return [`<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;">${desc}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${p.cheque_propio.numero || ''} · ${p.cheque_propio.banco || ''}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${new Date(p.cheque_propio.fecha_vencimiento+'T12:00:00').toLocaleDateString('es-AR')}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">$${parseFloat(p.monto||0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td></tr>`]
    }
    if (p.subtipo_cheque === 'tercero' && p.cheque_tercero_detalle?.length > 0) {
      return p.cheque_tercero_detalle.map(ch => `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;">${desc}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">#${ch.numero || '—'} · ${ch.banco || '—'}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${ch.fecha_vencimiento ? new Date(ch.fecha_vencimiento+'T12:00:00').toLocaleDateString('es-AR') : '—'}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">$${(ch.monto||0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td></tr>`)
    }
    return [`<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;">${desc}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;"></td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;"></td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">$${parseFloat(p.monto||0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td></tr>`]
  }).join('')
  const bloque = `<div style="border:1px solid #333;padding:20px;font-family:Arial,sans-serif;font-size:12px;width:100%;box-sizing:border-box;">
    <table style="width:100%;margin-bottom:10px;"><tr>
      <td style="width:33%;vertical-align:top;"><div style="font-weight:bold;">Pedro Barciocco 1221</div><div>TEL: 3574-442656</div><div style="margin-top:8px;border:1px solid #333;display:inline-block;padding:2px 6px;font-weight:bold;">X NO VALIDO COMO FACTURA</div></td>
      <td style="width:34%;text-align:center;vertical-align:middle;"><div style="font-size:22px;font-weight:900;">RAMONDA</div><div style="font-size:14px;font-weight:600;">HNOS S.A.</div></td>
      <td style="width:33%;text-align:right;vertical-align:top;"><div>CUIT: 30-71682182-6</div><div>FECHA <strong>${fecha}</strong></div></td>
    </tr></table>
    <hr style="border:1px solid #333;margin:8px 0;">
    <table style="width:100%;border:1px solid #333;border-collapse:collapse;">
      <tr><td colspan="2" style="padding:4px 8px;font-weight:bold;background:#f5f5f5;">Entrego a:</td></tr>
      <tr><td colspan="2" style="padding:4px 8px;">Nombre: <strong>${campo?.propietario || ''}</strong></td></tr>
    </table>
    <table style="width:100%;border:1px solid #333;border-top:none;border-collapse:collapse;">
      <tr><td colspan="2" style="padding:4px 8px;font-weight:bold;background:#f5f5f5;border-bottom:1px solid #333;">Concepto</td></tr>
      <tr><td colspan="2" style="padding:6px 8px;">${concepto}</td></tr>
    </table>
    <table style="width:100%;border:1px solid #333;border-top:none;border-collapse:collapse;">
      <tr><td colspan="4" style="padding:4px 8px;font-weight:bold;background:#f5f5f5;border-bottom:1px solid #333;">Medio de pago</td></tr>
      <tr style="background:#eee;"><th style="padding:6px 8px;text-align:left;border-bottom:1px solid #333;font-size:11px;">DESCRIPCIÓN</th><th style="padding:6px 8px;text-align:center;border-bottom:1px solid #333;font-size:11px;">NRO/CHEQUE</th><th style="padding:6px 8px;text-align:center;border-bottom:1px solid #333;font-size:11px;">FECHA COBRO</th><th style="padding:6px 8px;text-align:right;border-bottom:1px solid #333;font-size:11px;">IMPORTE</th></tr>
      ${filasPago}
      <tr style="border-top:1px solid #333;"><td colspan="3" style="padding:8px;text-align:right;font-weight:bold;">IMPORTE TOTAL $</td><td style="padding:8px;text-align:right;font-weight:bold;">${totalMonto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td></tr>
    </table>
    <table style="width:100%;border:1px solid #333;border-top:none;border-collapse:collapse;">
      <tr><td style="padding:6px 8px;">Cantidad de pesos: ${enLetras}</td></tr>
      <tr><td style="padding:20px 8px 30px 8px;">&nbsp;</td></tr>
      <tr><td style="padding:8px;"><table style="width:100%;"><tr><td style="width:40%;text-align:center;border-top:1px solid #333;">Firma</td><td style="width:20%;"></td><td style="width:40%;text-align:center;border-top:1px solid #333;">DNI</td></tr></table></td></tr>
    </table>
  </div>`
  const win = window.open('', '_blank')
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Recibo arriendo</title><style>@media print{.no-print{display:none;}}body{font-family:Arial,sans-serif;background:#fff;padding:10px;}</style></head><body>
    <div style="text-align:right;margin-bottom:10px;" class="no-print"><button onclick="window.print()" style="padding:8px 20px;font-size:14px;cursor:pointer;background:#1A3D6B;color:#fff;border:none;border-radius:6px;">🖨️ Imprimir</button></div>
    ${bloque}<div style="border-top:2px dashed #999;margin:16px 0;text-align:center;font-size:11px;color:#999;padding:4px 0;">✂ CORTAR AQUÍ ✂</div>${bloque}
  </body></html>`)
  win.document.close()
}


function TabArriendos({ campos, cargar, contactos, usuario }) {
  const [vencimientos, setVencimientos] = useState([])
  const [showForm, setShowForm] = useState(null)
  const [formVenc, setFormVenc] = useState({ fecha_vencimiento: '', tn_ha: '', precio_pizarra: '', observaciones: '' })
  const [guardando, setGuardando] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pagoAbierto, setPagoAbierto] = useState(null) // id del vencimiento
  const [formPago, setFormPago] = useState({ fecha: hoyLocal(), precio_pizarra: '', meses: 1, pagos: [{ ...PAGO_INIT_ARR }] })
  const [guardandoPago, setGuardandoPago] = useState(false)
  const [chequesCartera, setChequesCartera] = useState([])

  useEffect(() => { cargarVencimientos() }, [])

  async function cargarVencimientos() {
    const [{ data }, { data: ch }] = await Promise.all([
      supabase.from('vencimientos_arriendo').select('*, campos(nombre, superficie_ha, arrendamiento_tn_ha)').order('fecha_vencimiento'),
      supabase.from('cheques').select('*').eq('tipo', 'recibido').eq('estado', 'en_cartera').order('fecha_vencimiento', { ascending: true }),
    ])
    setVencimientos(data || [])
    setChequesCartera(ch || [])
    setLoading(false)
  }

  async function guardarVencimiento(campo_id) {
    if (!formVenc.fecha_vencimiento) { alert('Ingresá la fecha de vencimiento'); return }
    setGuardando(true)
    const tn = parseFloat(formVenc.tn_ha) || 0
    const precio = parseFloat(formVenc.precio_pizarra) || 0
    const campo = campos.find(c => c.id === campo_id)
    const sup = campo?.superficie_ha || 0
    const monto = tn && precio && sup ? Math.round(tn * precio * sup) : null
    await supabase.from('vencimientos_arriendo').insert({
      campo_id, fecha_vencimiento: formVenc.fecha_vencimiento,
      tn_ha: tn || null, precio_pizarra: precio || null,
      monto_total: monto, estado: 'pendiente',
      observaciones: formVenc.observaciones || null,
    })
    await cargarVencimientos()
    setShowForm(null)
    setFormVenc({ fecha_vencimiento: '', tn_ha: '', precio_pizarra: '', observaciones: '' })
    setGuardando(false)
  }

  async function pagarArriendo(v) {
    const totalPagos = formPago.pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
    if (!totalPagos) { alert('Ingresá el monto del pago'); return }
    setGuardandoPago(true)
    const precio = parseFloat(formPago.precio_pizarra) || null
    const meses = formPago.meses || 1
    const tnMes = (campo?.arrendamiento_tn_ha || 0) / 12
    const sup = campo?.superficie_ha || null
    const montoCalc = precio && tnMes && sup ? Math.round(precio * tnMes * meses * sup) : null
    const tnPagado = tnMes * meses

    const desc = `Arriendo ${v.campos?.nombre || ''} — ${v.fecha_vencimiento ? new Date(v.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR') : ''}`
    let caja_oficial_id = null, caja_paralela_id = null

    for (const pago of formPago.pagos) {
      const m = parseFloat(pago.monto) || 0
      if (!m) continue
      const fp = pago.subtipo_cheque ? 'e-cheq' : pago.tipo
      if (pago.es_paralelo) {
        const { data: cp } = await supabase.from('caja_paralela').insert({ fecha: formPago.fecha, tipo: 'egreso', descripcion: desc, monto: m }).select().single()
        if (!caja_paralela_id) caja_paralela_id = cp?.id || null
      } else {
        const { data: co } = await supabase.from('caja_oficial').insert({ fecha: formPago.fecha, tipo: 'egreso', categoria: 'Arriendo agricultura', descripcion: desc, monto: m, forma_pago: fp }).select().single()
        if (!caja_oficial_id) caja_oficial_id = co?.id || null
      }
      if (!pago.es_paralelo && pago.subtipo_cheque === 'propio') {
        await supabase.from('cheques').insert({ tipo: 'emitido', numero: pago.cheque_propio.numero || null, banco: pago.cheque_propio.banco || null, fecha_cobro: formPago.fecha, fecha_vencimiento: pago.cheque_propio.fecha_vencimiento, monto: m, beneficiario: v.campos?.propietario || null, estado: 'en_cartera', caja_oficial_id, registrado_por: usuario?.id })
      } else if (pago.subtipo_cheque === 'tercero' && pago.cheque_tercero_ids?.length > 0) {
        for (const chId of pago.cheque_tercero_ids) await supabase.from('cheques').update({ estado: 'depositado' }).eq('id', parseInt(chId))
      }
    }

    await supabase.from('vencimientos_arriendo').update({
      estado: 'pagado', pagado_en: formPago.fecha,
      precio_pizarra: precio || null,
      tn_ha: tnPagado || null,
      monto_total: montoCalc || totalPagos,
      caja_oficial_id, caja_paralela_id,
      pagos_detalle: formPago.pagos,
      forma_pago: formPago.pagos.map(p => p.subtipo_cheque || p.tipo).join('+'),
    }).eq('id', v.id)

    const pagosFinal = [...formPago.pagos]
    const fechaPago = formPago.fecha
    setPagoAbierto(null)
    setFormPago({ fecha: hoyLocal(), precio_pizarra: '', meses: 1, pagos: [{ ...PAGO_INIT_ARR }] })
    setGuardandoPago(false)
    await cargarVencimientos()
    await cargar()
    generarReciboArriendo({ ...v, pagado_en: fechaPago, pagos_detalle: pagosFinal }, campo, pagosFinal)
  }

  if (loading) return <div style={{ padding: '2rem', color: S.hint }}>Cargando...</div>

  const hoy = new Date()
  const en7dias = new Date(hoy.getTime() + 7 * 86400000)

  // Calcular próximos vencimientos automáticos por campo
  const proximosAutomaticos = campos.filter(c => c.arrendamiento_tn_ha && c.dia_vencimiento_arriendo).map(c => {
    const dia = c.dia_vencimiento_arriendo
    const freq = c.forma_pago_arriendo || 'mensual'
    const proximas = []

    if (freq === 'mensual') {
      // Próximos 2 meses
      for (let i = 0; i <= 1; i++) {
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth() + i, dia)
        if (fecha >= hoy) proximas.push(fecha)
      }
    } else if (freq === 'semestral') {
      for (let i = 0; i <= 6; i++) {
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth() + i, dia)
        if (fecha >= hoy) { proximas.push(fecha); break }
      }
    } else if (freq === 'anual') {
      const fecha = new Date(hoy.getFullYear(), hoy.getMonth(), dia)
      if (fecha < hoy) fecha.setFullYear(fecha.getFullYear() + 1)
      proximas.push(fecha)
    }

    return proximas.map(fecha => ({
      campo: c,
      fecha,
      diasHasta: Math.round((fecha - hoy) / 86400000),
      yaRegistrado: vencimientos.some(v => v.campo_id === c.id && v.fecha_vencimiento === fechaLocal(fecha))
    }))
  }).flat().filter(v => v.diasHasta <= 30 && !v.yaRegistrado).sort((a, b) => a.diasHasta - b.diasHasta)

  const proximosManual = vencimientos.filter(v => v.estado === 'pendiente' && new Date(v.fecha_vencimiento) <= en7dias)

  return (
    <div>
      {/* Banner vencimientos automáticos próximos */}
      {proximosAutomaticos.length > 0 && (
        <div style={{ background: S.amberLight, border: '1px solid #EF9F27', borderRadius: 8, padding: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: S.amber, marginBottom: 8 }}>
            🔔 {proximosAutomaticos.length} vencimiento{proximosAutomaticos.length !== 1 ? 's' : ''} próximo{proximosAutomaticos.length !== 1 ? 's' : ''} (próximos 30 días)
          </div>
          {proximosAutomaticos.map((v, i) => (
            <div key={i} style={{ fontSize: 12, color: S.amber, marginBottom: 3 }}>
              <strong>{v.campo.nombre}</strong> — {v.fecha.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
              {v.diasHasta === 0 ? ' · ¡Hoy!' : v.diasHasta === 1 ? ' · Mañana' : ` · en ${v.diasHasta} días`}
              {' · '}<span style={{ opacity: 0.8 }}>{v.campo.forma_pago_arriendo}</span>
            </div>
          ))}
        </div>
      )}

      {/* Banner vencimientos manuales próximos */}
      {proximosManual.length > 0 && (
        <div style={{ background: S.amberLight, border: '1px solid #EF9F27', borderRadius: 8, padding: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: S.amber, marginBottom: 6 }}>
            ⚠ {proximosManual.length} arriendo{proximosManual.length !== 1 ? 's' : ''} vence{proximosManual.length === 1 ? '' : 'n'} en los próximos 7 días
          </div>
          {proximosManual.map(v => (
            <div key={v.id} style={{ fontSize: 12, color: S.amber }}>
              {v.campos?.nombre} — {new Date(v.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR')}
              {v.monto_total ? ` · $${v.monto_total.toLocaleString('es-AR')}` : ''}
            </div>
          ))}
        </div>
      )}

      {campos.filter(c => c.arrendamiento_tn_ha).map(campo => {
        const vencsCampo = vencimientos.filter(v => v.campo_id === campo.id)
        return (
          <div key={campo.id} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{campo.nombre}</div>
                <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>
                  {campo.propietario} · {campo.superficie_ha} ha · {campo.arrendamiento_tn_ha} tn soja/ha/año
                  {campo.dia_vencimiento_arriendo ? ` · vence día ${campo.dia_vencimiento_arriendo} · ${campo.forma_pago_arriendo}` : ` · ${campo.forma_pago_arriendo}`}
                </div>
              </div>
              <button onClick={() => setShowForm(showForm === campo.id ? null : campo.id)}
                style={{ padding: '6px 12px', fontSize: 12, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 6, cursor: 'pointer' }}>
                + Vencimiento
              </button>
            </div>

            {showForm === campo.id && (
              <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div><Label>Fecha vencimiento *</Label><input type="date" value={formVenc.fecha_vencimiento} onChange={e => setFormVenc({...formVenc, fecha_vencimiento: e.target.value})} style={inputStyle} /></div>
                  <div><Label>tn/ha</Label><input type="number" value={formVenc.tn_ha} onChange={e => setFormVenc({...formVenc, tn_ha: e.target.value})} style={inputStyle} placeholder={String(campo.arrendamiento_tn_ha || '')} /></div>
                  <div><Label>Observaciones</Label><input type="text" value={formVenc.observaciones} onChange={e => setFormVenc({...formVenc, observaciones: e.target.value})} style={inputStyle} /></div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => guardarVencimiento(campo.id)} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
                  <button onClick={() => setShowForm(null)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                </div>
              </div>
            )}

            {vencsCampo.length === 0
              ? <div style={{ fontSize: 13, color: S.hint }}>Sin vencimientos cargados.</div>
              : vencsCampo.map(v => {
                const isPagoAbierto = pagoAbierto === v.id
                const totalPagos = formPago.pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
                return (
                  <div key={v.id} style={{ borderTop: `1px solid ${S.border}`, paddingTop: '1rem', marginTop: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                          {new Date(v.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </div>
                        <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>
                          {v.tn_ha} tn/ha · ${v.precio_pizarra?.toLocaleString('es-AR')}/tn
                          {v.monto_total ? ` · Total: $${v.monto_total.toLocaleString('es-AR')}` : ''}
                          {v.observaciones ? ` · ${v.observaciones}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {v.estado === 'pagado'
                          ? <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <span style={{ padding: '3px 10px', borderRadius: 4, background: S.greenLight, color: S.green, fontSize: 12, fontWeight: 600 }}>✓ Pagado {v.pagado_en ? new Date(v.pagado_en + 'T12:00:00').toLocaleDateString('es-AR') : ''}</span>
                              {v.pagos_detalle && <button onClick={() => generarReciboArriendo(v, campo, v.pagos_detalle)}
                                style={{ padding: '3px 10px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer', fontWeight: 600 }}>🖨️ Recibo</button>}
                            </div>
                          : <button onClick={() => { setPagoAbierto(isPagoAbierto ? null : v.id); setFormPago({ fecha: hoyLocal(), precio_pizarra: '', meses: 1, pagos: [{ ...PAGO_INIT_ARR, monto: '' }] }) }}
                              style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                              💳 Registrar pago
                            </button>
                        }
                        <button onClick={async () => { if (!confirm('¿Eliminar?')) return; await supabase.from('vencimientos_arriendo').delete().eq('id', v.id); cargarVencimientos() }}
                          style={{ padding: '4px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button>
                      </div>
                    </div>

                    {/* Formulario de pago */}
                    {isPagoAbierto && (
                      <div style={{ background: S.greenLight, border: `1px solid ${S.green}`, borderRadius: 8, padding: '1rem', marginTop: '1rem' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: S.green, marginBottom: '1rem' }}>
                          Pago arriendo — {campo.nombre} · {campo.arrendamiento_tn_ha} tn/ha/año · {campo.superficie_ha} ha
                        </div>
                        {/* Meses + Precio pizarra */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                          <div>
                            <Label>Meses a pagar</Label>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                              {[1,2,3,6,12].map(m => (
                                <button key={m} onClick={() => {
                                  const pp = parseFloat(formPago.precio_pizarra) || 0
                                  const tnMes = (campo.arrendamiento_tn_ha || 0) / 12
                                  const sup = campo.superficie_ha || 0
                                  const monto = pp && tnMes && sup ? String(Math.round(pp * tnMes * m * sup)) : ''
                                  setFormPago({...formPago, meses: m, pagos: formPago.pagos.map((p, i) => i === 0 ? {...p, monto} : p)})
                                }}
                                  style={{ padding: '5px 10px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer', border: `1px solid ${formPago.meses === m ? S.accent : S.border}`, background: formPago.meses === m ? S.accentLight : S.surface, color: formPago.meses === m ? S.accent : S.muted }}>
                                  {m === 1 ? '1 mes' : m === 12 ? '1 año' : `${m} meses`}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <Label>Precio pizarra Rosario $/tn</Label>
                            <input type="number" value={formPago.precio_pizarra} onChange={e => {
                              const pp = e.target.value
                              const meses = formPago.meses || 1
                              const tnMes = (campo.arrendamiento_tn_ha || 0) / 12
                              const sup = campo.superficie_ha || 0
                              const monto = pp && tnMes && sup ? String(Math.round(parseFloat(pp) * tnMes * meses * sup)) : ''
                              setFormPago({...formPago, precio_pizarra: pp, pagos: formPago.pagos.map((p, i) => i === 0 ? {...p, monto} : p)})
                            }} style={inputStyle} placeholder="ej. 380000" />
                          </div>
                          <div>
                            <Label>Monto calculado</Label>
                            <div style={{ padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 14, fontFamily: 'monospace', fontWeight: 700, background: S.surface, color: S.green }}>
                              {formPago.precio_pizarra && formPago.meses && campo.arrendamiento_tn_ha && campo.superficie_ha
                                ? `$${Math.round(parseFloat(formPago.precio_pizarra) * (campo.arrendamiento_tn_ha / 12) * formPago.meses * campo.superficie_ha).toLocaleString('es-AR')}`
                                : '—'}
                            </div>
                            {formPago.meses && campo.arrendamiento_tn_ha && (
                              <div style={{ fontSize: 10, color: S.muted, marginTop: 3 }}>
                                {(campo.arrendamiento_tn_ha / 12 * formPago.meses).toFixed(2)} tn/ha × {campo.superficie_ha} ha
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ marginBottom: 10 }}>
                          <Label>Fecha de pago</Label>
                          <input type="date" value={formPago.fecha} onChange={e => setFormPago({...formPago, fecha: e.target.value})} style={{ ...inputStyle, maxWidth: 200 }} />
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 8 }}>Formas de pago</div>
                        <ListaPagos pagos={formPago.pagos} onChangePagos={n => setFormPago({...formPago, pagos: n})} chequesCartera={chequesCartera} S={S} soloTerceroSiParalelo opcionesExtra={[{ value: 'cuenta_corriente', label: 'Cuenta corriente' }]} />

                        {v.monto_total && (
                          <div style={{ background: Math.abs(v.monto_total - totalPagos) < 0.5 ? S.greenLight : S.amberLight, border: `1px solid ${Math.abs(v.monto_total - totalPagos) < 0.5 ? '#97C459' : '#EF9F27'}`, borderRadius: 6, padding: '8px 12px', fontSize: 13, marginBottom: 10 }}>
                            Total arriendo: <strong>${v.monto_total.toLocaleString('es-AR')}</strong> · Pagos: <strong>${totalPagos.toLocaleString('es-AR')}</strong>
                            {Math.abs(v.monto_total - totalPagos) >= 0.5 && <span style={{ marginLeft: 12, color: S.amber, fontWeight: 600 }}>Diferencia: ${(v.monto_total - totalPagos).toLocaleString('es-AR')}</span>}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => pagarArriendo(v)} disabled={guardandoPago}
                            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                            {guardandoPago ? 'Registrando...' : '💾 Confirmar pago'}
                          </button>
                          <button onClick={() => setPagoAbierto(null)} style={{ padding: '8px 14px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        )
      })}
      {campos.filter(c => c.arrendamiento_tn_ha).length === 0 && (
        <div style={{ fontSize: 13, color: S.hint, padding: '2rem', textAlign: 'center' }}>No hay campos con arrendamiento configurado. Cargá el tn/ha en la sección Campos.</div>
      )}
    </div>
  )
}


function TabStockAgro({ stock, ingresos, contactos, cargar, usuario, mobile, nav, cotizacionDolar }) {
  const [editandoCotiz, setEditandoCotiz] = useState(false)
  const [nuevaCotiz, setNuevaCotiz] = useState(cotizacionDolar)
  const [filtroTipoStock, setFiltroTipoStock] = useState('')

  async function guardarCotizacion() {
    const valor = parseFloat(nuevaCotiz)
    if (!valor || valor <= 0) { alert('Ingresá un valor válido'); return }
    const { error } = await supabase.from('configuracion').update({ valor: String(valor) }).eq('clave', 'cotizacion_dolar_agro')
    if (error) { alert('Error al guardar: ' + error.message); return }
    setEditandoCotiz(false)
    await cargar()
  }

  // Recibo imprimible de pago de agroquímicos — acepta una compra sola o varias
  // juntas (pago agrupado), y arma un recibo doble (proveedor + empresa).
  function generarReciboAgro(compraOCompras, pagos, stockRef) {
    const compras = Array.isArray(compraOCompras) ? compraOCompras : [compraOCompras]
    const totalMonto = compras.reduce((s, c) => s + (c.total || 0), 0)
    const proveedor = compras[0]?.proveedor || '—'
    const fecha = compras[0]?.fecha ? new Date(compras[0].fecha + 'T12:00:00').toLocaleDateString('es-AR') : new Date().toLocaleDateString('es-AR')
    const detalle = compras.map(c => `${c.insumo_nombre || 'Agroquímico'} · ${(c.cantidad || 0).toLocaleString('es-AR')} ${c.unidad || ''}`).join(' + ')
    const formaPago = (pagos || []).map(p => p.subtipo_cheque || p.tipo).filter(Boolean).join(' + ') || '—'
    abrirReciboDoble({
      titulo: 'Recibo de pago',
      numero: Date.now().toString().slice(-6),
      fecha,
      filas: [
        ['Proveedor', proveedor],
        ['Insumo(s)', detalle],
        ['Forma de pago', formaPago],
      ],
      monto: `$ ${totalMonto.toLocaleString('es-AR')}`,
      colorMonto: '#1E5C2E',
      firmaIzq: 'Recibí conforme',
      firmaDer: 'Ramonda Hnos S.A.',
      etiquetaCopia1: 'Copia — ' + proveedor,
      etiquetaCopia2: 'Copia — Ramonda Hnos S.A.',
    })
  }

  const [tab, setTab] = useState('stock')
  const [showForm, setShowForm] = useState(false)
  const [editandoStock, setEditandoStock] = useState(null)
  const [formStock, setFormStock] = useState({ insumo: '', tipo: '', cantidad: '', unidad: 'litros', minimo_stock: '', precio_referencia: '', precio_referencia_usd: '' })
  const [showFormCompra, setShowFormCompra] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [pagarAhora, setPagarAhora] = useState(true)
  const [showPagosPend, setShowPagosPend] = useState(false)
  const [seleccionadas, setSeleccionadas] = useState([])
  const [formPagoGrupal, setFormPagoGrupal] = useState({ fecha: hoyLocal(), pagos: [{ ...PAGO_INIT_AGRO }] })
  const [guardandoPago, setGuardandoPago] = useState(false)
  const [chequesCartera, setChequesCartera] = useState([])
  const [preciosPend, setPreciosPend] = useState({})
  const [formCompra, setFormCompra] = useState({
    agroquimico_id: '', insumo_nombre: '', cantidad: '', precio_unitario: '', precio_unitario_usd: '', total: '',
    fecha: hoyLocal(), proveedor: '',
    domicilio: '', localidad: '', cuit: '', iva: '', cbu: '',
    numero_factura: '', observaciones: '', pagos: [{ ...PAGO_INIT_AGRO }], retirado: true,
  })

  const TIPOS = ['Herbicida', 'Fungicida', 'Insecticida', 'Fertilizante', 'Coadyuvante', 'Semilla', 'Silobolsa', 'Otro']
  const UNIDADES = ['litros', 'kg', 'bolsas', 'unidades']

  // ── MODO CELULAR: solo lectura ──
  if (mobile) {
    const CM = { bg: '#1A2E1A', surface: '#243324', surface2: '#2E3F2E', border: '#3A4F3A', text: '#E8F0E8', muted: '#8FA88F', green: '#7EC87E', amber: '#F5C97A', red: '#F09595', mono: "'IBM Plex Mono', monospace", sans: "'IBM Plex Sans', sans-serif" }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: CM.bg, color: CM.text, fontFamily: CM.sans }}>
        <div style={{ background: CM.surface, padding: '1rem', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, borderBottom: `1px solid ${CM.border}` }}>
          <button onClick={() => nav && nav('home')} style={{ background: 'none', border: 'none', color: CM.green, fontSize: 22, cursor: 'pointer', padding: 0, lineHeight: 1 }}>‹</button>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Stock de insumos</div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          <div style={{ fontSize: 12, color: CM.muted, marginBottom: '1rem', padding: '8px 12px', background: CM.surface, borderRadius: 8, border: `1px solid ${CM.border}` }}>
            📋 Solo lectura — los remitos y compras se cargan desde la PC.
          </div>
          {stock.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: CM.muted, fontSize: 13 }}>No hay insumos cargados.</div>}
          {stock.map(s => {
            const bajo = (s.cantidad || 0) <= (s.minimo_stock || 0)
            return (
              <div key={s.id} style={{ background: CM.surface, border: `1px solid ${bajo ? CM.red : CM.border}`, borderRadius: 10, padding: '1rem', marginBottom: '.65rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{s.insumo}</div>
                    <div style={{ fontSize: 11, color: CM.muted, marginTop: 2 }}>{s.tipo || '—'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, fontFamily: CM.mono, color: bajo ? CM.red : CM.green }}>{(s.cantidad || 0).toLocaleString('es-AR')}</div>
                    <div style={{ fontSize: 11, color: CM.muted }}>{s.unidad}</div>
                    {bajo && <div style={{ fontSize: 11, color: CM.red, fontWeight: 600 }}>⚠ Bajo mínimo</div>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }


  useEffect(() => {
    supabase.from('cheques').select('*').eq('tipo', 'recibido').eq('estado', 'en_cartera').order('fecha_vencimiento', { ascending: true })
      .then(({ data }) => setChequesCartera(data || []))
  }, [])

  async function guardarStock() {
    if (!formStock.insumo) { alert('Ingresá el nombre'); return }
    setGuardando(true)
    const data = { insumo: formStock.insumo, tipo: formStock.tipo || null, cantidad: parseFloat(formStock.cantidad) || 0, unidad: formStock.unidad, minimo_stock: parseFloat(formStock.minimo_stock) || 0, actualizado_en: new Date().toISOString() }
    // Si se cargó precio en dólares, el precio en pesos se calcula solo con
    // la cotización del momento — si se cargó directo en pesos, se respeta eso.
    if (formStock.precio_referencia_usd) {
      data.precio_referencia_usd = parseFloat(formStock.precio_referencia_usd)
      data.precio_referencia = Math.round(parseFloat(formStock.precio_referencia_usd) * cotizacionDolar)
    } else if (formStock.precio_referencia) {
      data.precio_referencia = parseFloat(formStock.precio_referencia)
    }
    const { error } = editandoStock
      ? await supabase.from('stock_agro').update(data).eq('id', editandoStock)
      : await supabase.from('stock_agro').insert(data)
    if (error) { alert('Error al guardar: ' + error.message); setGuardando(false); return }
    await cargar()
    setShowForm(false); setEditandoStock(null)
    setFormStock({ insumo: '', tipo: '', cantidad: '', unidad: 'litros', minimo_stock: '', precio_referencia: '', precio_referencia_usd: '' })
    setGuardando(false)
  }

  async function guardarCompra() {
    if (!formCompra.agroquimico_id || !formCompra.cantidad) { alert('Completá insumo y cantidad'); return }
    // Si se cargó precio en dólares, el precio unitario en pesos se calcula
    // solo con la cotización de hoy — si se cargó directo en pesos, se respeta eso.
    const precioUnitUsd = formCompra.precio_unitario_usd ? parseFloat(formCompra.precio_unitario_usd) : null
    const precioUnitDesdeUsd = precioUnitUsd ? Math.round(precioUnitUsd * cotizacionDolar) : null
    if (pagarAhora && !formCompra.precio_unitario && !precioUnitDesdeUsd) { alert('Para pagar ahora necesitás ingresar el precio unitario (en pesos o en dólares). Si todavía no llegó la factura, desmarcá "Pagar ahora" y cargá el remito sin precio.'); return }
    const cantidad = parseFloat(formCompra.cantidad)
    const precioUnit = precioUnitDesdeUsd || (formCompra.precio_unitario ? parseFloat(formCompra.precio_unitario) : null)
    const total = precioUnit ? (formCompra.total ? parseFloat(formCompra.total) : Math.round(cantidad * precioUnit)) : null
    const totalPagos = formCompra.pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
    if (pagarAhora && Math.abs(total - totalPagos) > 0.5) { alert(`El total de pagos ($${totalPagos.toLocaleString('es-AR')}) no coincide con el monto ($${total.toLocaleString('es-AR')})`); return }
    setGuardando(true)

    let caja_oficial_id = null, caja_paralela_id = null
    const desc = `Compra ${formCompra.insumo_nombre}${formCompra.proveedor ? ` — ${formCompra.proveedor}` : ''}`

    if (pagarAhora) for (const pago of formCompra.pagos) {
      const monto = parseFloat(pago.monto) || 0
      if (!monto) continue
      if (pago.tipo === 'credito') continue  // no mueve caja — se registra en Créditos después de guardar la compra
      const formaPago = pago.subtipo_cheque ? 'e-cheq' : pago.tipo
      if (pago.es_paralelo) {
        const { data: cp } = await supabase.from('caja_paralela').insert({ fecha: formCompra.fecha, tipo: 'egreso', descripcion: desc, monto }).select().single()
        if (!caja_paralela_id) caja_paralela_id = cp?.id || null
      } else {
        const { data: co } = await supabase.from('caja_oficial').insert({ fecha: formCompra.fecha, tipo: 'egreso', categoria: 'Compra insumos Agricultura', descripcion: desc, monto, forma_pago: formaPago }).select().single()
        if (!caja_oficial_id) caja_oficial_id = co?.id || null
      }
      if (!pago.es_paralelo && pago.subtipo_cheque === 'propio') {
        await supabase.from('cheques').insert({ tipo: 'emitido', numero: pago.cheque_propio.numero || null, banco: pago.cheque_propio.banco || null, fecha_cobro: formCompra.fecha, fecha_vencimiento: pago.cheque_propio.fecha_vencimiento, monto, beneficiario: formCompra.proveedor || null, estado: 'en_cartera', caja_oficial_id, registrado_por: usuario?.id })
      } else if (pago.subtipo_cheque === 'tercero' && pago.cheque_tercero_ids?.length > 0) {
        for (const chId of pago.cheque_tercero_ids) await supabase.from('cheques').update({ estado: 'depositado' }).eq('id', parseInt(chId))
      }
    }

    const { data: compraInsertada, error: errIngresoAgro } = await supabase.from('compras_insumos').insert({
      insumo_id: parseInt(formCompra.agroquimico_id), insumo_tipo: 'agro', insumo_nombre: formCompra.insumo_nombre, unidad: formCompra.unidad || null,
      cantidad, precio_unitario: precioUnit, total,
      precio_unitario_usd: precioUnitUsd, cotizacion_dolar: precioUnitUsd ? cotizacionDolar : null,
      proveedor: formCompra.proveedor || null, domicilio: formCompra.domicilio || null, localidad: formCompra.localidad || null,
      cuit: formCompra.cuit || null, iva: formCompra.iva || null, cbu: formCompra.cbu || null,
      numero_factura: formCompra.numero_factura || null, observaciones: formCompra.observaciones || null,
      // Solo se guarda el detalle del pago si realmente se pagó ahora — si queda
      // pendiente, no hay que dejar un "pago" fantasma con el monto en blanco
      // (eso hacía aparecer una fila de $0 sin descripción en Contactos).
      forma_pago: pagarAhora ? formCompra.pagos.map(p => p.subtipo_cheque || p.tipo).join('+') : null,
      es_paralelo: pagarAhora ? formCompra.pagos.some(p => p.es_paralelo) : false,
      pagos_detalle: pagarAhora ? formCompra.pagos : null,
      fecha: formCompra.fecha,
      caja_oficial_id, caja_paralela_id, registrado_por: usuario?.id,
      estado_pago: pagarAhora ? 'pagado' : 'pendiente',
      retirado: formCompra.retirado,
    }).select().single()
    if (errIngresoAgro) { alert('Error al guardar la compra: ' + errIngresoAgro.message); setGuardando(false); return }

    // Si se pagó (parte) con crédito, el proveedor ya cobró (se lo pagó la
    // financiera) — se registra la deuda en Créditos, vinculada a esta compra.
    const pagoCredito = formCompra.pagos.find(p => p.tipo === 'credito' && parseFloat(p.monto) > 0)
    if (pagarAhora && pagoCredito) {
      const montoCredito = parseFloat(pagoCredito.monto)
      const cuotas = parseInt(formCompra.credito_cuotas) || 1
      const { error: errCredito } = await supabase.from('creditos').insert({
        compra_insumos_id: compraInsertada?.id,
        entidad: formCompra.credito_entidad || null,
        descripcion: `${formCompra.insumo_nombre} — ${formCompra.proveedor || ''}`,
        monto_total: montoCredito, cant_cuotas: cuotas, monto_cuota: Math.round(montoCredito / cuotas),
        fecha_inicio: formCompra.fecha, fecha_vencimiento: formCompra.credito_vencimiento || null,
        cuotas_pagadas: 0, saldo_pendiente: montoCredito, estado: 'activo',
        registrado_por: usuario?.id,
      })
      if (errCredito) alert('La compra se guardó, pero no se pudo registrar el crédito: ' + errCredito.message + ' — cargalo a mano en Créditos.')
    }

    // Actualizar stock: la cantidad se suma solo si ya se retiró físicamente.
    // Si se dejó marcado "todavía no lo retiramos", el stock queda igual hasta
    // que se marque como retirado más adelante.
    // El precio de referencia solo se actualiza si ya se conoce (remito con precio o pago realizado).
    const item = stock.find(s => s.id === parseInt(formCompra.agroquimico_id))
    if (item && formCompra.retirado) {
      const upd = { cantidad: (item.cantidad || 0) + cantidad, actualizado_en: new Date().toISOString() }
      if (precioUnit) upd.precio_referencia = precioUnit
      if (precioUnitUsd) upd.precio_referencia_usd = precioUnitUsd
      await supabase.from('stock_agro').update(upd).eq('id', item.id)
    } else if (item && precioUnit) {
      const upd = { precio_referencia: precioUnit, actualizado_en: new Date().toISOString() }
      if (precioUnitUsd) upd.precio_referencia_usd = precioUnitUsd
      await supabase.from('stock_agro').update(upd).eq('id', item.id)
    }

    setShowFormCompra(false)
    setFormCompra({ agroquimico_id: '', insumo_nombre: '', cantidad: '', precio_unitario: '', precio_unitario_usd: '', total: '', fecha: hoyLocal(), proveedor: '', domicilio: '', localidad: '', cuit: '', iva: '', cbu: '', numero_factura: '', observaciones: '', pagos: [{ ...PAGO_INIT_AGRO }], retirado: true, credito_entidad: '', credito_cuotas: '', credito_vencimiento: '' })
    setPagarAhora(true)
    setGuardando(false)
    await cargar()
    // Generar recibo si pagó ahora
    if (pagarAhora) {
      generarReciboAgro({ ...formCompra, fecha: formCompra.fecha }, formCompra.pagos, stock)
    }
  }

  const sinPrecio = ingresos.filter(i => !i.precio_unitario || i.precio_unitario === 0)
  const stockBajo = stock.filter(s => s.minimo_stock > 0 && s.cantidad <= s.minimo_stock)

  return (
    <div>
      {/* Banner compras pendientes de pago */}
      {(() => {
        const pendientes = ingresos.filter(i => i.estado_pago === 'pendiente')
        if (pendientes.length === 0) return null
        const montoItem = i => i.total || (preciosPend[i.id] && i.cantidad ? Math.round(i.cantidad * parseFloat(preciosPend[i.id])) : 0)
        const totalSel = seleccionadas.reduce((s, id) => { const i = pendientes.find(x => x.id === id); return s + (i ? montoItem(i) : 0) }, 0)
        const totalPagGrupal = formPagoGrupal.pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
        const faltaPrecio = seleccionadas.some(id => { const i = pendientes.find(x => x.id === id); return i && !i.precio_unitario && !preciosPend[id] })

        async function pagarSeleccionadas() {
          if (seleccionadas.length === 0) { alert('Seleccioná al menos una compra'); return }
          if (faltaPrecio) { alert('Falta cargar el precio de la factura en alguna de las compras seleccionadas.'); return }
          if (Math.abs(totalSel - totalPagGrupal) > 0.5) { alert(`El total de pagos no coincide`); return }
          setGuardandoPago(true)
          const comprasPagadas = seleccionadas.map(id => {
            const i = ingresos.find(x => x.id === id)
            if (!i) return null
            // Si la compra no tenía precio cargado, usar el que se acaba de
            // definir ahora al pagar — si no, el recibo sale con $0.
            return { ...i, total: montoItem(i) }
          }).filter(Boolean)
          const { error } = await pagarComprasPendientes(supabase, {
            seleccionadas, pendientes, precios: preciosPend, facturas: null,
            pagos: formPagoGrupal.pagos, fecha: formPagoGrupal.fecha,
            descripcion: 'Pago compras insumos Agricultura', registradoPor: usuario?.id,
            actualizarPrecioReferencia: async (i, precioFinal) => {
              if (!i.insumo_id) return
              await supabase.from('stock_agro').update({ precio_referencia: precioFinal, actualizado_en: new Date().toISOString() }).eq('id', i.insumo_id)
            },
          })
          if (error) { alert('Error al registrar el pago: ' + error.message); setGuardandoPago(false); return }
          setSeleccionadas([])
          setShowPagosPend(false)
          setFormPagoGrupal({ fecha: hoyLocal(), pagos: [{ ...PAGO_INIT_AGRO }] })
          setPreciosPend({})
          setGuardandoPago(false)
          await cargar()
          generarReciboAgro(comprasPagadas, formPagoGrupal.pagos, stock)
        }

        return (
          <div style={{ background: S.amberLight, border: '1px solid #EF9F27', borderRadius: 10, padding: '1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: S.amber }}>
                ⏳ {pendientes.length} compra{pendientes.length !== 1 ? 's' : ''} pendiente{pendientes.length !== 1 ? 's' : ''} de pago · ${pendientes.reduce((s,i)=>s+(i.total||0),0).toLocaleString('es-AR')}
                {pendientes.some(i => !i.precio_unitario) && <span style={{ color: S.amber, fontWeight: 400 }}> · {pendientes.filter(i=>!i.precio_unitario).length} sin precio todavía</span>}
              </div>
              <button onClick={() => setShowPagosPend(!showPagosPend)}
                style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, background: S.amber, border: `1px solid ${S.amber}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                {showPagosPend ? 'Cerrar' : 'Registrar pago'}
              </button>
            </div>
            <ChecklistComprasPendientes pendientes={pendientes} seleccionadas={seleccionadas} setSeleccionadas={setSeleccionadas}
              precios={preciosPend} setPrecios={setPreciosPend} S={S} />
            {showPagosPend && seleccionadas.length > 0 && (
              <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: '1rem' }}>
                  Pagar {seleccionadas.length} compra{seleccionadas.length !== 1 ? 's' : ''} · <span style={{ fontFamily: 'monospace', color: S.red }}>${totalSel.toLocaleString('es-AR')}</span>
                  {faltaPrecio && <span style={{ display: 'block', fontSize: 11, color: S.amber, fontWeight: 400, marginTop: 4 }}>⚠ Cargá el precio de las compras marcadas arriba antes de pagar</span>}
                </div>
                <div style={{ marginBottom: 10 }}>
                  <Label>Fecha de pago</Label>
                  <input type="date" value={formPagoGrupal.fecha} onChange={e => setFormPagoGrupal({...formPagoGrupal, fecha: e.target.value})} style={{ ...inputStyle, maxWidth: 200 }} />
                </div>
                <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 8 }}>Formas de pago</div>
                <ListaPagos pagos={formPagoGrupal.pagos} onChangePagos={n => setFormPagoGrupal({...formPagoGrupal, pagos: n})} chequesCartera={chequesCartera} S={S} soloTerceroSiParalelo opcionesExtra={[{ value: 'cuenta_corriente', label: 'Cuenta corriente' }]} />

                <div style={{ background: Math.abs(totalSel-totalPagGrupal) < 0.5 ? S.greenLight : S.amberLight, border: `1px solid ${Math.abs(totalSel-totalPagGrupal) < 0.5 ? '#97C459' : '#EF9F27'}`, borderRadius: 6, padding: '8px 12px', fontSize: 13, marginBottom: 10 }}>
                  Total: <strong>${totalSel.toLocaleString('es-AR')}</strong> · Pagos: <strong>${totalPagGrupal.toLocaleString('es-AR')}</strong>
                  {Math.abs(totalSel-totalPagGrupal) >= 0.5 && <span style={{ marginLeft: 12, color: S.amber, fontWeight: 600 }}>Diferencia: ${(totalSel-totalPagGrupal).toLocaleString('es-AR')}</span>}
                </div>
                <button onClick={pagarSeleccionadas} disabled={guardandoPago || faltaPrecio}
                  style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: (guardandoPago || faltaPrecio) ? 'default' : 'pointer', opacity: faltaPrecio ? 0.6 : 1 }}>
                  {guardandoPago ? 'Registrando...' : `💾 Pagar ${seleccionadas.length} compra${seleccionadas.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            )}
          </div>
        )
      })()}

      {/* Cotización del dólar — usada para traducir los precios en USD a pesos */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#EAF4EC', border: '1px solid #97C459', borderRadius: 8, padding: '8px 14px', marginBottom: '1rem' }}>
        <span style={{ fontSize: 13 }}>💵 Cotización del dólar (Agricultura):</span>
        {editandoCotiz ? (
          <>
            <input type="number" value={nuevaCotiz} onChange={e => setNuevaCotiz(e.target.value)}
              style={{ width: 100, padding: '4px 8px', border: '1px solid #97C459', borderRadius: 5, fontSize: 13, fontFamily: 'monospace' }} autoFocus />
            <button onClick={guardarCotizacion} style={{ padding: '4px 10px', fontSize: 12, fontWeight: 600, background: S.green, border: 'none', color: '#fff', borderRadius: 5, cursor: 'pointer' }}>Guardar</button>
            <button onClick={() => { setEditandoCotiz(false); setNuevaCotiz(cotizacionDolar) }} style={{ padding: '4px 10px', fontSize: 12, background: 'transparent', border: '1px solid #97C459', color: S.green, borderRadius: 5, cursor: 'pointer' }}>Cancelar</button>
          </>
        ) : (
          <>
            <strong style={{ fontFamily: 'monospace', fontSize: 14 }}>${cotizacionDolar?.toLocaleString('es-AR')}</strong>
            <button onClick={() => { setNuevaCotiz(cotizacionDolar); setEditandoCotiz(true) }} style={{ padding: '3px 10px', fontSize: 11, background: 'transparent', border: '1px solid #97C459', color: S.green, borderRadius: 5, cursor: 'pointer' }}>Actualizar</button>
          </>
        )}
      </div>

      {/* Tabs internos */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {[{ key: 'stock', label: 'Stock' }, { key: 'historial', label: 'Historial de compras' }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding: '7px 14px', fontSize: 13, fontWeight: tab === t.key ? 600 : 400, cursor: 'pointer', color: tab === t.key ? S.accent : S.muted, background: tab === t.key ? S.accentLight : 'transparent', border: `1px solid ${tab === t.key ? S.accent : S.border}`, borderRadius: 6, fontFamily: "'IBM Plex Sans', sans-serif" }}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setShowFormCompra(!showFormCompra); setShowForm(false) }}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
            + Registrar compra
          </button>
          <button onClick={() => { setShowForm(!showForm); setShowFormCompra(false); setEditandoStock(null); setFormStock({ insumo: '', tipo: '', cantidad: '', unidad: 'litros', minimo_stock: '', precio_referencia: '', precio_referencia_usd: '' }) }}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
            + Nuevo insumo
          </button>
        </div>
      </div>

      {/* Banner sin precio */}
      {sinPrecio.length > 0 && (
        <div style={{ background: S.amberLight, border: '1px solid #EF9F27', borderRadius: 8, padding: '1rem', marginBottom: '1rem', fontSize: 13, color: S.amber }}>
          ⚠ {sinPrecio.length} remito{sinPrecio.length !== 1 ? 's' : ''} sin precio todavía — cargalo cuando llegue la factura, en "Registrar pago" más arriba
        </div>
      )}

      {/* Stock bajo */}
      {stockBajo.length > 0 && (
        <div style={{ background: S.redLight, border: '1px solid #F09595', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: S.red, marginBottom: 4 }}>⚠ Stock bajo</div>
          {stockBajo.map(s => <div key={s.id} style={{ fontSize: 12, color: S.red }}>{s.insumo}: {s.cantidad} {s.unidad} (mínimo: {s.minimo_stock})</div>)}
        </div>
      )}

      {/* Form nuevo insumo */}
      {showForm && (
        <Card titulo={editandoStock ? 'Editar insumo' : 'Nuevo insumo'}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <div><Label>Nombre *</Label><input type="text" value={formStock.insumo} onChange={e => setFormStock({...formStock, insumo: e.target.value})} style={inputStyle} /></div>
            <div><Label>Tipo</Label><select value={formStock.tipo} onChange={e => setFormStock({...formStock, tipo: e.target.value})} style={inputStyle}><option value="">— Seleccioná —</option>{TIPOS.map(t => <option key={t}>{t}</option>)}</select></div>
            <div><Label>Unidad</Label><select value={formStock.unidad} onChange={e => setFormStock({...formStock, unidad: e.target.value})} style={inputStyle}>{UNIDADES.map(u => <option key={u}>{u}</option>)}</select></div>
            <div><Label>Cantidad inicial</Label><input type="number" value={formStock.cantidad} onChange={e => setFormStock({...formStock, cantidad: e.target.value})} style={inputStyle} /></div>
            <div><Label>Precio en USD (si aplica)</Label><input type="number" value={formStock.precio_referencia_usd} onChange={e => setFormStock({...formStock, precio_referencia_usd: e.target.value})} placeholder="ej. 8.5" style={{...inputStyle, borderColor: '#97C459'}} /></div>
            <div><Label>Precio en $ {formStock.precio_referencia_usd ? '(calculado)' : ''}</Label><input type="number" value={formStock.precio_referencia_usd ? Math.round(parseFloat(formStock.precio_referencia_usd) * cotizacionDolar) : formStock.precio_referencia} onChange={e => setFormStock({...formStock, precio_referencia: e.target.value})} disabled={!!formStock.precio_referencia_usd} style={{...inputStyle, background: formStock.precio_referencia_usd ? S.bg : '#fff'}} /></div>
            <div><Label>Stock mínimo alerta</Label><input type="number" value={formStock.minimo_stock} onChange={e => setFormStock({...formStock, minimo_stock: e.target.value})} style={inputStyle} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={guardarStock} disabled={guardando} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
            <button onClick={() => { setShowForm(false); setEditandoStock(null) }} style={{ padding: '8px 16px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </Card>
      )}

      {/* Form registrar compra */}
      {showFormCompra && (
        <Card titulo="Registrar compra">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <Label>Insumo *</Label>
              <select value={formCompra.agroquimico_id} onChange={e => {
                const item = stock.find(s => s.id === parseInt(e.target.value))
                setFormCompra({...formCompra, agroquimico_id: e.target.value, insumo_nombre: item?.insumo || '', unidad: item?.unidad || ''})
              }} style={inputStyle}>
                <option value="">— Seleccioná —</option>
                {stock.map(s => <option key={s.id} value={s.id}>{s.insumo} ({s.unidad})</option>)}
              </select>
            </div>
            <div><Label>Cantidad</Label><input type="number" value={formCompra.cantidad} onChange={e => { const c = e.target.value; const t = c && formCompra.precio_unitario ? String(Math.round(parseFloat(c) * parseFloat(formCompra.precio_unitario))) : formCompra.total; setFormCompra({...formCompra, cantidad: c, total: t}) }} style={inputStyle} /></div>
            <div><Label>Precio en USD (opcional)</Label><input type="number" value={formCompra.precio_unitario_usd} onChange={e => {
              const pu = e.target.value
              const puArs = pu ? String(Math.round(parseFloat(pu) * cotizacionDolar)) : ''
              const t = puArs && formCompra.cantidad ? String(Math.round(parseFloat(formCompra.cantidad) * parseFloat(puArs))) : formCompra.total
              setFormCompra({...formCompra, precio_unitario_usd: pu, precio_unitario: puArs || formCompra.precio_unitario, total: t})
            }} placeholder="ej. 8.5" style={{...inputStyle, borderColor: '#97C459'}} /></div>
            <div><Label>Precio unitario $ {formCompra.precio_unitario_usd ? '(calculado)' : (!pagarAhora && <span style={{ fontWeight: 400, textTransform: 'none', color: S.hint }}>(opcional, si aún no llegó la factura)</span>)}</Label><input type="number" value={formCompra.precio_unitario} disabled={!!formCompra.precio_unitario_usd} onChange={e => { const p = e.target.value; const t = p && formCompra.cantidad ? String(Math.round(parseFloat(formCompra.cantidad) * parseFloat(p))) : formCompra.total; setFormCompra({...formCompra, precio_unitario: p, total: t}) }} style={{...inputStyle, background: formCompra.precio_unitario_usd ? S.bg : '#fff'}} placeholder={pagarAhora ? '' : 'se puede cargar después, al pagar'} /></div>
            <div><Label>Total $</Label><input type="number" value={formCompra.total} onChange={e => setFormCompra({...formCompra, total: e.target.value})} style={inputStyle} /></div>
            <div><Label>Fecha</Label><input type="date" value={formCompra.fecha} onChange={e => setFormCompra({...formCompra, fecha: e.target.value})} style={inputStyle} /></div>
            <div><Label>N° Factura</Label><input type="text" value={formCompra.numero_factura} onChange={e => setFormCompra({...formCompra, numero_factura: e.target.value})} style={inputStyle} /></div>
          </div>

          {/* Datos proveedor */}
          <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '12px', marginBottom: '1rem' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 10 }}>Proveedor (para el recibo)</div>
            <div style={{ marginBottom: 10 }}>
              <Label>Seleccionar de contactos</Label>
              <select onChange={e => { const ct = contactos.find(c => String(c.id) === e.target.value); if (ct) setFormCompra({...formCompra, proveedor: ct.nombre, cuit: ct.cuit || '', localidad: ct.localidad || '', iva: ct.iva || '', cbu: ct.cbu || ''}) }} style={inputStyle} defaultValue="">
                <option value="">— Seleccionar contacto —</option>
                {contactos.map(c => <option key={c.id} value={c.id}>{c.nombre}{c.cuit ? ` · ${c.cuit}` : ''}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div><Label>Nombre</Label><input type="text" value={formCompra.proveedor} onChange={e => setFormCompra({...formCompra, proveedor: e.target.value})} style={inputStyle} /></div>
              <div><Label>Localidad</Label><input type="text" value={formCompra.localidad} onChange={e => setFormCompra({...formCompra, localidad: e.target.value})} style={inputStyle} /></div>
              <div><Label>CUIT</Label><input type="text" value={formCompra.cuit} onChange={e => setFormCompra({...formCompra, cuit: e.target.value})} style={inputStyle} /></div>
              <div><Label>Condición IVA</Label><input type="text" value={formCompra.iva} onChange={e => setFormCompra({...formCompra, iva: e.target.value})} style={inputStyle} /></div>
              <div><Label>CBU</Label><input type="text" value={formCompra.cbu} onChange={e => setFormCompra({...formCompra, cbu: e.target.value})} style={inputStyle} /></div>
            </div>
          </div>

          {/* Toggle pagar ahora / pendiente */}
          <div style={{ display: 'flex', gap: 10, marginBottom: '1rem', alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: S.muted }}>Pago:</div>
            {[{ v: true, l: '💳 Pagar ahora' }, { v: false, l: '⏳ Dejar pendiente' }].map(opt => (
              <button key={String(opt.v)} onClick={() => setPagarAhora(opt.v)}
                style={{ padding: '7px 16px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer', border: `1px solid ${pagarAhora === opt.v ? S.accent : S.border}`, background: pagarAhora === opt.v ? S.accentLight : 'transparent', color: pagarAhora === opt.v ? S.accent : S.muted }}>
                {opt.l}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
            <input type="checkbox" id="agro_no_retirado" checked={!formCompra.retirado} onChange={e => setFormCompra({...formCompra, retirado: !e.target.checked})} />
            <label htmlFor="agro_no_retirado" style={{ fontSize: 13, cursor: 'pointer' }}>
              Todavía no lo retiramos (no suma al stock hasta que se marque como retirado)
            </label>
          </div>

          {/* Formas de pago */}
          {pagarAhora && <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 10 }}>Formas de pago</div>
            <ListaPagos pagos={formCompra.pagos} onChangePagos={n => setFormCompra({...formCompra, pagos: n})} chequesCartera={chequesCartera} S={S} soloTerceroSiParalelo opcionesExtra={[{ value: 'cuenta_corriente', label: 'Cuenta corriente' }, { value: 'credito', label: '🏦 Crédito (financiera/banco)' }]} />
            {formCompra.pagos.some(p => p.tipo === 'credito') && (
              <div style={{ background: '#F0EAFB', border: '1px solid #9F8ED4', borderRadius: 8, padding: 12, marginBottom: '1rem' }}>
                <div style={{ fontSize: 12, color: '#3D1A6B', marginBottom: 8 }}>
                  El proveedor ya cobró (se lo pagó la financiera) — la deuda queda registrada en Créditos, a nombre de esta entidad, y esta compra queda marcada como pagada.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div><Label>Entidad (banco/financiera)</Label><input type="text" value={formCompra.credito_entidad || ''} onChange={e => setFormCompra({...formCompra, credito_entidad: e.target.value})} style={inputStyle} placeholder="ej. Banco Galicia" /></div>
                  <div><Label>Cant. de cuotas</Label><input type="number" value={formCompra.credito_cuotas || '1'} onChange={e => setFormCompra({...formCompra, credito_cuotas: e.target.value})} style={inputStyle} /></div>
                  <div><Label>Vencimiento (1ra cuota)</Label><input type="date" value={formCompra.credito_vencimiento || ''} onChange={e => setFormCompra({...formCompra, credito_vencimiento: e.target.value})} style={inputStyle} /></div>
                </div>
              </div>
            )}

            {formCompra.total && (() => {
              const tp = formCompra.pagos.reduce((s,p) => s + (parseFloat(p.monto)||0), 0)
              const t = parseFloat(formCompra.total) || 0
              const dif = t - tp
              return (
                <div style={{ background: Math.abs(dif) < 0.5 ? S.greenLight : S.amberLight, border: `1px solid ${Math.abs(dif) < 0.5 ? '#97C459' : '#EF9F27'}`, borderRadius: 6, padding: '8px 12px', fontSize: 13 }}>
                  Total: <strong>${t.toLocaleString('es-AR')}</strong> · Pagos: <strong>${tp.toLocaleString('es-AR')}</strong>
                  {Math.abs(dif) >= 0.5 && <span style={{ marginLeft: 12, color: S.amber, fontWeight: 600 }}>Diferencia: ${dif.toLocaleString('es-AR')}</span>}
                </div>
              )
            })()}
          </div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={guardarCompra} disabled={guardando} style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando...' : '💾 Guardar compra'}</button>
            <button onClick={() => setShowFormCompra(false)} style={{ padding: '8px 16px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </Card>
      )}

      {/* TAB STOCK */}
      {tab === 'stock' && (
        <div>
          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <select value={filtroTipoStock} onChange={e => setFiltroTipoStock(e.target.value)}
              style={{ padding: '6px 10px', fontSize: 12, border: `1px solid ${S.border}`, borderRadius: 6, background: S.surface, color: filtroTipoStock ? S.accent : S.muted, fontWeight: filtroTipoStock ? 600 : 400 }}>
              <option value="">Todos los tipos</option>
              {[...new Set(stock.map(s => s.tipo).filter(Boolean))].sort().map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {filtroTipoStock && <button onClick={() => setFiltroTipoStock('')} style={{ padding: '6px 8px', fontSize: 11, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>✕</button>}
          </div>
        <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: S.bg }}>
              {['Insumo', 'Tipo', 'Stock', 'Unidad', 'Precio ref.', 'Mínimo', 'Estado', ''].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 10, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {stock.filter(s => !filtroTipoStock || s.tipo === filtroTipoStock).length === 0 && <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay insumos cargados.</td></tr>}
              {stock.filter(s => !filtroTipoStock || s.tipo === filtroTipoStock).map(s => {
                const bajo = s.minimo_stock > 0 && s.cantidad <= s.minimo_stock
                return (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${S.border}`, background: bajo ? S.redLight : 'transparent' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{s.insumo}</td>
                    <td style={{ padding: '8px 12px' }}>{s.tipo ? <span style={{ padding: '2px 8px', borderRadius: 4, background: S.accentLight, color: S.accent, fontSize: 11 }}>{s.tipo}</span> : '—'}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color: bajo ? S.red : S.green }}>{s.cantidad?.toLocaleString('es-AR')}</td>
                    <td style={{ padding: '8px 12px', color: S.muted }}>{s.unidad}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: S.muted }}>
                      {s.precio_referencia ? `$${s.precio_referencia.toLocaleString('es-AR')}` : '—'}
                      {s.precio_referencia_usd ? <div style={{ fontSize: 11, color: S.green }}>US$ {s.precio_referencia_usd.toLocaleString('es-AR')}</div> : null}
                    </td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, color: S.muted }}>{s.minimo_stock || '—'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      {bajo ? <span style={{ padding: '2px 8px', borderRadius: 4, background: S.redLight, color: S.red, fontSize: 11, fontWeight: 600 }}>⚠ Stock bajo</span>
                        : <span style={{ padding: '2px 8px', borderRadius: 4, background: S.greenLight, color: S.green, fontSize: 11 }}>OK</span>}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => { setEditandoStock(s.id); setFormStock({ insumo: s.insumo, tipo: s.tipo||'', cantidad: s.cantidad||'', unidad: s.unidad||'litros', minimo_stock: s.minimo_stock||'', precio_referencia: s.precio_referencia||'', precio_referencia_usd: s.precio_referencia_usd||'' }); setShowForm(true); setShowFormCompra(false) }}
                          style={{ padding: '3px 8px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>Editar</button>
                        <button onClick={async () => { if (!confirm('¿Eliminar?')) return; await supabase.from('stock_agro').delete().eq('id', s.id); cargar() }}
                          style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {/* TAB HISTORIAL */}
      {tab === 'historial' && (
        <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 700 }}>
            <thead><tr style={{ background: S.bg }}>
              {['Fecha', 'Insumo', 'Cantidad', 'Precio unit.', 'Total', 'Proveedor', 'Pago', 'Estado', ''].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 10, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {ingresos.length === 0 && <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay compras registradas.</td></tr>}
              {ingresos.map(i => (
                <tr key={i.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(i.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>{i.insumo_nombre || '—'}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{i.cantidad?.toLocaleString('es-AR')} {i.unidad || ''}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: S.muted }}>{i.precio_unitario ? `$${i.precio_unitario.toLocaleString('es-AR')}` : <span style={{ color: S.amber, fontSize: 11 }}>Pendiente</span>}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{i.total ? `$${i.total.toLocaleString('es-AR', { maximumFractionDigits: 0 })}` : '—'}</td>
                  <td style={{ padding: '8px 12px', color: S.muted }}>{i.proveedor || '—'}</td>
                  <td style={{ padding: '8px 12px', fontSize: 11 }}>{i.es_paralelo ? <span style={{ color: '#3D1A6B', fontWeight: 600 }}>Caja 2</span> : i.forma_pago || '—'}</td>
                  <td style={{ padding: '8px 12px' }}>
                    {i.estado_pago === 'pagado'
                      ? <span style={{ padding: '2px 8px', borderRadius: 4, background: S.greenLight, color: S.green, fontSize: 11, fontWeight: 600 }}>✓ Pagado</span>
                      : <span style={{ padding: '2px 8px', borderRadius: 4, background: S.amberLight, color: S.amber, fontSize: 11, fontWeight: 600 }}>⏳ Pendiente</span>}
                    {i.retirado === false && (
                      <span style={{ marginLeft: 4, padding: '2px 8px', borderRadius: 4, background: '#F0EAFB', color: '#3D1A6B', fontSize: 11, fontWeight: 600 }}>📦 No retirado</span>
                    )}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {i.retirado === false && (
                        <button onClick={async () => {
                          const item = stock.find(s => s.id === i.insumo_id)
                          if (item) await supabase.from('stock_agro').update({ cantidad: (item.cantidad || 0) + (i.cantidad || 0), actualizado_en: new Date().toISOString() }).eq('id', item.id)
                          await supabase.from('compras_insumos').update({ retirado: true }).eq('id', i.id)
                          await cargar()
                        }} style={{ padding: '3px 8px', fontSize: 11, background: '#F0EAFB', border: '1px solid #9F8ED4', color: '#3D1A6B', borderRadius: 5, cursor: 'pointer' }}>
                          📦 Marcar retirado
                        </button>
                      )}
                      {i.pagos_detalle && i.estado_pago === 'pagado' && (
                        <button onClick={() => generarReciboAgro(i, i.pagos_detalle, stock)}
                          style={{ padding: '3px 8px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>🖨️ Recibo</button>
                      )}
                      <button onClick={async () => {
                        if (!confirm('¿Eliminar esta compra? Se eliminará de la caja.')) return
                        if (i.caja_oficial_id) await supabase.from('caja_oficial').delete().eq('id', i.caja_oficial_id)
                        if (i.caja_paralela_id) await supabase.from('caja_paralela').delete().eq('id', i.caja_paralela_id)
                        // Si nunca se retiró, nunca se sumó al stock — no hay nada que restar
                        if (i.retirado !== false) {
                          const item = stock.find(s => s.id === i.insumo_id)
                          if (item) await supabase.from('stock_agro').update({ cantidad: Math.max(0, (item.cantidad || 0) - (i.cantidad || 0)), actualizado_en: new Date().toISOString() }).eq('id', item.id)
                        }
                        await supabase.from('compras_insumos').delete().eq('id', i.id)
                        await cargar()
                      }} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
} 

// ── TAB RENTABILIDAD POR LOTE ──
function TabRentabilidad({ campos, campanas, campanaActiva, ordenes, cosechas, ventasGranos, stockAgro, planes, gastos }) {
  const [vencimientos, setVencimientos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroCampana, setFiltroCampana] = useState(campanaActiva?.id ? String(campanaActiva.id) : '')
  const [filtroCampo, setFiltroCampo] = useState('')
  const [filtroLote, setFiltroLote] = useState('')
  const [filtroCultivo, setFiltroCultivo] = useState('')
  const [detalleAbierto, setDetalleAbierto] = useState(null)

  useEffect(() => {
    supabase.from('vencimientos_arriendo').select('*').eq('estado', 'pagado').order('fecha_vencimiento')
      .then(({ data }) => { setVencimientos(data || []); setLoading(false) })
  }, [])

  if (loading) return <Loader />

  const campana = campanas.find(c => String(c.id) === String(filtroCampana))
  const campoFiltro = campos.find(c => String(c.id) === String(filtroCampo))
  const numAR = (n, dec = 0) => (n || n === 0) ? n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : '—'

  // Precio de referencia $/tn: promedio de lo efectivamente vendido (de ese campo si hay, sino de todos los campos con ese cultivo/campaña)
  function precioReferencia(cultivo, campoId) {
    const base = ventasGranos.filter(v => v.cultivo === cultivo && (!filtroCampana || v.campana_id === parseInt(filtroCampana)) && v.kg && v.total)
    const deCampo = base.filter(v => v.campo_id === campoId)
    const pool = deCampo.length > 0 ? deCampo : base
    const kgTot = pool.reduce((s, v) => s + (v.kg || 0), 0)
    const monTot = pool.reduce((s, v) => s + (v.total || 0), 0)
    return kgTot > 0 ? (monTot / (kgTot / 1000)) : null
  }

  // Cosechas que entran en el filtro actual, agrupadas por Campo + Lote + Cultivo
  const cosechasFiltradas = cosechas.filter(c =>
    (!filtroCampana || c.campana_id === parseInt(filtroCampana)) &&
    (!filtroCultivo || c.cultivo === filtroCultivo) &&
    (!filtroCampo || c.campo_id === parseInt(filtroCampo))
  )
  // Lo sembrado (plan_cultivos con fecha de siembra) que entra en el mismo
  // filtro — así el lote ya aparece en el cuadro con sus costos apenas se
  // siembra, aunque todavía falten meses para la cosecha.
  const planesFiltrados = (planes || []).filter(p =>
    p.fecha_siembra &&
    (!filtroCampana || p.campana_id === parseInt(filtroCampana)) &&
    (!filtroCultivo || p.cultivo === filtroCultivo) &&
    (!filtroCampo || p.campo_id === parseInt(filtroCampo))
  )
  const grupos = {}
  planesFiltrados.forEach(p => {
    const key = `${p.campo_id}_${p.lote_id || 'campo'}_${p.cultivo}`
    if (!grupos[key]) grupos[key] = { campo_id: p.campo_id, lote_id: p.lote_id || null, cultivo: p.cultivo, kg: 0 }
  })
  cosechasFiltradas.forEach(c => {
    const key = `${c.campo_id}_${c.lote_id || 'campo'}_${c.cultivo}`
    if (!grupos[key]) grupos[key] = { campo_id: c.campo_id, lote_id: c.lote_id || null, cultivo: c.cultivo, kg: 0 }
    grupos[key].kg += c.kg_totales || 0
  })

  const filas = Object.values(grupos).map(g => {
    const campo = campos.find(c => c.id === g.campo_id)
    const lote = g.lote_id ? campo?.lotes_agricolas?.find(l => l.id === g.lote_id) : null
    const ha = lote?.superficie_ha || campo?.superficie_ha || 0
    if (!ha) return null
    if (filtroLote && String(g.lote_id || '') !== String(filtroLote)) return null

    const rtoQqHa = ha ? (g.kg / 1000) / ha : 0

    // Órdenes de trabajo del lote (o de "todo el campo" sin lote, prorateadas por ha)
    const ordenesRel = ordenes.filter(o =>
      o.campo_id === g.campo_id &&
      (!filtroCampana || o.campana_id === parseInt(filtroCampana)) &&
      (o.lote_id ? o.lote_id === g.lote_id : true)
    )
    let costoInsumos = 0, costoLabores = 0
    const detalleInsumos = []
    const detalleOrdenes = []
    ordenesRel.forEach(o => {
      const factor = o.lote_id ? 1 : (campo?.superficie_ha ? ha / campo.superficie_ha : 1)
      const insumosOrden = []
      ;(o.productos || []).forEach(p => {
        const item = stockAgro.find(s => s.id === parseInt(p.id))
        const qty = (parseFloat(p.total) || 0) * factor
        const precio = item?.precio_referencia || 0
        const subtotal = qty * precio
        costoInsumos += subtotal
        if (qty > 0) {
          const fila = { nombre: item?.insumo || '—', fecha: o.fecha, dosis: p.dosis, unidad: p.unidad || item?.unidad || '', cantHa: ha ? (qty / ha) : null, cantTotal: qty, precio, subtotal }
          detalleInsumos.push(fila)
          insumosOrden.push(fila)
        }
      })
      const costoLaboresOrden = (o.costo_total || 0) * factor
      costoLabores += costoLaboresOrden
      const totalInsumosOrden = insumosOrden.reduce((s, i) => s + i.subtotal, 0)
      detalleOrdenes.push({
        id: o.id, tipo: o.tipo, fecha: o.fecha, proveedor: o.proveedor, estadoPago: o.estado_pago,
        costoLabores: costoLaboresOrden, costoInsumos: totalInsumosOrden,
        costoTotal: costoLaboresOrden + totalInsumosOrden, insumos: insumosOrden,
      })
    })
    detalleOrdenes.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))

    // Arriendo del campo en el rango de años de la campaña, prorrateado por ha
    const arriendosCampo = vencimientos.filter(v => v.campo_id === g.campo_id && (!campana || (
      new Date(v.fecha_vencimiento).getFullYear() >= (campana.año_inicio || 0) &&
      new Date(v.fecha_vencimiento).getFullYear() <= (campana.año_fin || 9999)
    )))
    const totalArriendoCampo = arriendosCampo.reduce((s, v) => s + (v.monto_total || 0), 0)
    const costoAlquiler = campo?.superficie_ha ? totalArriendoCampo * (ha / campo.superficie_ha) : 0
    const detalleArriendo = arriendosCampo.map(v => ({
      fecha: v.fecha_vencimiento, montoTotal: v.monto_total || 0, estadoPago: v.estado,
      montoProrrateado: campo?.superficie_ha ? (v.monto_total || 0) * (ha / campo.superficie_ha) : (v.monto_total || 0),
    }))

    // Gastos puntuales de este campo (los que se cargaron con campo elegido en
    // "Gastos" — seguro de ese campo, análisis de suelo, etc.), prorrateados
    // por hectárea igual que el arriendo. Los gastos generales (sin campo) no
    // entran acá, solo cuentan para el total de la actividad en Reportes.
    const gastosCampo = (gastos || []).filter(gg => gg.campo_id === g.campo_id && (!filtroCampana || gg.campana_id === parseInt(filtroCampana)))
    const totalGastosCampo = gastosCampo.reduce((s, gg) => s + (gg.monto || 0), 0)
    const costoGastos = campo?.superficie_ha ? totalGastosCampo * (ha / campo.superficie_ha) : 0

    const costosDirectos = costoInsumos + costoLabores + costoAlquiler + costoGastos
    const sinCosechaAun = g.kg === 0
    const precioTn = precioReferencia(g.cultivo, g.campo_id)
    const ingresos = (!sinCosechaAun && precioTn) ? (g.kg / 1000) * precioTn : 0

    const mb = sinCosechaAun ? null : ingresos - costosDirectos
    const mbHa = (sinCosechaAun || !ha) ? null : mb / ha
    const mbCD = (!sinCosechaAun && costosDirectos) ? mb / costosDirectos : null
    const rentabilidadPct = mbCD !== null ? mbCD * 100 : null
    const rtoIndifTnHa = (precioTn && ha) ? ((costosDirectos / ha) / precioTn) : null

    return {
      key: `${g.campo_id}_${g.lote_id || 'campo'}_${g.cultivo}`,
      campoNombre: campo?.nombre || '—', loteNombre: lote ? `Lote ${lote.numero}` : 'Todo el campo',
      campo_id: g.campo_id, lote_id: g.lote_id, cultivo: g.cultivo, sinCosechaAun,
      ha, kg: g.kg, rtoQqHa, costoInsumos, costoLabores, costoAlquiler, costoGastos, costosDirectos,
      precioTn, ingresos, mb, mbHa, mbCD, rentabilidadPct, rtoIndifTnHa, detalleInsumos, detalleOrdenes, detalleArriendo,
    }
  }).filter(Boolean)

  const lotesDelCampoFiltro = campoFiltro?.lotes_agricolas || []

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Rentabilidad por lote</div>
      <div style={{ fontSize: 12, color: S.muted, marginBottom: '1.25rem' }}>
        Insumos desde las Órdenes de trabajo de cada lote · Alquiler prorrateado por hectárea · Precio de venta proyectado sobre lo efectivamente vendido
      </div>

      {/* Filtros */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '.75rem', marginBottom: '1.25rem' }}>
        <div><Label>Campaña</Label>
          <select value={filtroCampana} onChange={e => setFiltroCampana(e.target.value)} style={inputStyle}>
            <option value="">Todas</option>
            {campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div><Label>Campo</Label>
          <select value={filtroCampo} onChange={e => { setFiltroCampo(e.target.value); setFiltroLote('') }} style={inputStyle}>
            <option value="">Todos</option>
            {campos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div><Label>Lote</Label>
          <select value={filtroLote} onChange={e => setFiltroLote(e.target.value)} style={inputStyle} disabled={!filtroCampo}>
            <option value="">{filtroCampo ? 'Todos los lotes' : '— Elegí un campo —'}</option>
            {lotesDelCampoFiltro.map(l => <option key={l.id} value={l.id}>Lote {l.numero}</option>)}
          </select>
        </div>
        <div><Label>Cultivo</Label>
          <select value={filtroCultivo} onChange={e => setFiltroCultivo(e.target.value)} style={inputStyle}>
            <option value="">Todos</option>
            {CULTIVOS.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {filas.length === 0 && (
        <div style={{ padding: '2rem', textAlign: 'center', color: S.hint, background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8 }}>
          No hay cosechas cargadas que coincidan con estos filtros. Cargá la cosecha del lote en la pestaña "Cosechas" para que aparezca acá.
        </div>
      )}

      {filas.map(f => {
        const abierto = detalleAbierto === f.key
        return (
          <Card key={f.key} style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{f.campoNombre} · {f.loteNombre}</div>
                <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>{f.cultivo} · {numAR(f.ha, 1)} ha</div>
                {f.sinCosechaAun && (
                  <div style={{ fontSize: 11, color: S.amber, background: S.amberLight, display: 'inline-block', padding: '2px 8px', borderRadius: 4, marginTop: 4, fontWeight: 600 }}>
                    🌱 Sembrado, sin cosechar todavía — los costos ya se van acumulando
                  </div>
                )}
              </div>
              <button onClick={() => setDetalleAbierto(abierto ? null : f.key)}
                style={{ padding: '6px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 6, cursor: 'pointer' }}>
                {abierto ? 'Ocultar detalle de insumos' : 'Ver detalle de insumos'}
              </button>
            </div>

            {/* Indicadores */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: abierto ? '1.25rem' : 0 }}>
              {[
                { label: 'Rendimiento', val: f.sinCosechaAun ? 'Sin cosechar' : `${numAR(f.rtoQqHa, 1)} tn/ha`, sub: f.sinCosechaAun ? '—' : `${numAR(f.kg / 1000, 1)} tn totales` },
                { label: 'Ingresos (proy.)', val: f.sinCosechaAun ? '—' : (f.precioTn ? `$${numAR(f.ingresos)}` : 'Sin precio ref.'), sub: f.sinCosechaAun ? 'todavía no hay cosecha' : (f.precioTn ? `$${numAR(f.precioTn)}/tn` : 'cargá una venta de este cultivo'), color: S.green },
                { label: 'Costos directos', val: `$${numAR(f.costosDirectos)}`, sub: `Insumos $${numAR(f.costoInsumos)} · Labores $${numAR(f.costoLabores)} · Alquiler $${numAR(f.costoAlquiler)}${f.costoGastos ? ' · Gastos $' + numAR(f.costoGastos) : ''}`, color: S.red },
                { label: 'Margen Bruto', val: f.mb === null ? '—' : `$${numAR(f.mb)}`, sub: f.mb === null ? 'a definir con la cosecha' : `$${numAR(f.mbHa)}/ha`, color: f.mb === null ? S.muted : (f.mb >= 0 ? S.green : S.red) },
              ].map((m, i) => (
                <div key={i} style={{ background: S.bg, borderRadius: 8, padding: '.75rem .9rem' }}>
                  <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: m.color || S.text }}>{m.val}</div>
                  <div style={{ fontSize: 11, color: S.hint, marginTop: 2 }}>{m.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 10 }}>
              {[
                { label: 'MB / Costos Directos', val: f.mbCD !== null ? f.mbCD.toFixed(2) : '—' },
                { label: 'Rentabilidad', val: f.rentabilidadPct !== null ? `${numAR(f.rentabilidadPct, 1)}%` : '—' },
                { label: 'Rto. indiferencia', val: f.rtoIndifTnHa !== null ? `${numAR(f.rtoIndifTnHa, 2)} tn/ha` : '—', sub: 'necesario para cubrir costos' },
              ].map((m, i) => (
                <div key={i} style={{ background: S.accentLight, borderRadius: 8, padding: '.75rem .9rem' }}>
                  <div style={{ fontSize: 10, color: S.accent, textTransform: 'uppercase', marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: S.accent }}>{m.val}</div>
                  {m.sub && <div style={{ fontSize: 10, color: S.muted, marginTop: 2 }}>{m.sub}</div>}
                </div>
              ))}
            </div>

            {abierto && (
              <div style={{ marginTop: '1.25rem' }}>
                {f.detalleArriendo.length > 0 && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 8 }}>Alquiler del campo</div>
                    <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
                      {f.detalleArriendo.map((a, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 10px', fontSize: 12, borderBottom: i < f.detalleArriendo.length - 1 ? `1px solid ${S.border}` : 'none' }}>
                          <span>{a.fecha ? new Date(a.fecha + 'T12:00:00').toLocaleDateString('es-AR') : '—'} {a.estadoPago === 'pendiente' && <span style={{ color: S.amber, fontWeight: 600 }}> · pendiente de pago</span>}</span>
                          <span style={{ fontFamily: 'monospace' }}>${numAR(a.montoTotal)} total <strong style={{ marginLeft: 8 }}>${numAR(a.montoProrrateado)} en este lote</strong></span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 8 }}>Órdenes de trabajo de este lote</div>
                {f.detalleOrdenes.length === 0
                  ? <div style={{ fontSize: 13, color: S.hint }}>Sin órdenes de trabajo cargadas todavía para este lote.</div>
                  : f.detalleOrdenes.map((o, oi) => (
                    <div key={oi} style={{ border: `1px solid ${S.border}`, borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: S.bg }}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{o.tipo}</span>
                          <span style={{ color: S.muted, fontSize: 12, marginLeft: 8 }}>{o.fecha ? new Date(o.fecha + 'T12:00:00').toLocaleDateString('es-AR') : '—'}{o.proveedor ? ` · ${o.proveedor}` : ''}</span>
                          {o.estadoPago === 'pendiente' && <span style={{ color: S.amber, fontWeight: 600, fontSize: 11, marginLeft: 8 }}>⏳ pendiente de pago</span>}
                        </div>
                        <div style={{ textAlign: 'right', fontSize: 13 }}>
                          <strong style={{ fontFamily: 'monospace' }}>${numAR(o.costoTotal)}</strong>
                          <div style={{ fontSize: 10, color: S.muted }}>labor ${numAR(o.costoLabores)} + insumos ${numAR(o.costoInsumos)}</div>
                        </div>
                      </div>
                      {o.insumos.length > 0 && (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                          <tbody>
                            {o.insumos.map((d, di) => (
                              <tr key={di} style={{ borderTop: `1px solid ${S.border}` }}>
                                <td style={{ padding: '5px 12px', fontWeight: 600 }}>{d.nombre}</td>
                                <td style={{ padding: '5px 12px', textAlign: 'right', fontFamily: 'monospace', color: S.muted }}>{d.cantHa ? `${numAR(d.cantHa, 2)} ${d.unidad}/ha` : ''}</td>
                                <td style={{ padding: '5px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{numAR(d.cantTotal, 2)} {d.unidad}</td>
                                <td style={{ padding: '5px 12px', textAlign: 'right', fontFamily: 'monospace', color: S.muted }}>{d.precio ? `$${numAR(d.precio, 2)}` : <span style={{ color: S.amber }}>sin precio ref.</span>}</td>
                                <td style={{ padding: '5px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>${numAR(d.subtotal)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  ))
                }
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

// ── TAB LLUVIAS ──
const MESES_LLUVIA = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function TabLluvias({ usuario }) {
  const [lluvias, setLluvias] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ fecha: hoyLocal(), mm: '', observaciones: '' })
  const [guardando, setGuardando] = useState(false)
  const [filtroAnio, setFiltroAnio] = useState(new Date().getFullYear())

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('lluvias').select('*').order('fecha', { ascending: false })
    setLluvias(data || [])
    setLoading(false)
  }

  async function guardar() {
    if (!form.fecha || !form.mm) { alert('Completá la fecha y los milímetros'); return }
    const yaExiste = lluvias.find(l => l.fecha === form.fecha)
    if (yaExiste && !confirm(`Ya hay un registro para el ${new Date(form.fecha+'T12:00:00').toLocaleDateString('es-AR')} (${yaExiste.mm} mm). ¿Agregar otro de todas formas?`)) return
    setGuardando(true)
    await supabase.from('lluvias').insert({ fecha: form.fecha, mm: parseFloat(form.mm), observaciones: form.observaciones || null, registrado_por: usuario?.id })
    await cargar()
    setShowForm(false)
    setForm({ fecha: hoyLocal(), mm: '', observaciones: '' })
    setGuardando(false)
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este registro de lluvia?')) return
    await supabase.from('lluvias').delete().eq('id', id)
    await cargar()
  }

  if (loading) return <Loader />

  const anios = [...new Set(lluvias.map(l => new Date(l.fecha + 'T12:00:00').getFullYear()))].sort((a, b) => b - a)
  if (anios.length === 0) anios.push(new Date().getFullYear())

  const delAnio = lluvias.filter(l => new Date(l.fecha + 'T12:00:00').getFullYear() === filtroAnio)
  const totalAnio = delAnio.reduce((s, l) => s + (l.mm || 0), 0)
  const hoy = new Date()
  const totalMesActual = lluvias.filter(l => {
    const f = new Date(l.fecha + 'T12:00:00')
    return f.getFullYear() === hoy.getFullYear() && f.getMonth() === hoy.getMonth()
  }).reduce((s, l) => s + (l.mm || 0), 0)
  const ultimos30 = lluvias.filter(l => new Date(l.fecha + 'T12:00:00') >= new Date(Date.now() - 30 * 86400000)).reduce((s, l) => s + (l.mm || 0), 0)

  // Totales por mes del año filtrado, para la tabla y el gráfico
  const porMes = Array.from({ length: 12 }, (_, i) => ({
    mes: i,
    label: MESES_LLUVIA[i],
    mm: delAnio.filter(l => new Date(l.fecha + 'T12:00:00').getMonth() === i).reduce((s, l) => s + (l.mm || 0), 0),
  }))
  const maxMm = Math.max(...porMes.map(m => m.mm), 10)

  // Gráfico de barras simple, en SVG, sin librerías externas
  const chartW = 700, chartH = 220, padL = 40, padB = 30, padT = 10
  const barW = (chartW - padL - 10) / 12
  const escalaY = (chartH - padT - padB) / maxMm

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Registro de lluvias</div>
          <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>Registro general del establecimiento</div>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          + Registrar lluvia
        </button>
      </div>

      {showForm && (
        <Card titulo="Nuevo registro de lluvia">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <div><Label>Fecha *</Label><input type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} style={inputStyle} /></div>
            <div><Label>Milímetros *</Label><input type="number" value={form.mm} onChange={e => setForm({...form, mm: e.target.value})} placeholder="ej. 25" style={{ ...inputStyle, fontFamily: 'monospace', fontWeight: 600 }} /></div>
            <div><Label>Observaciones</Label><input type="text" value={form.observaciones} onChange={e => setForm({...form, observaciones: e.target.value})} placeholder="opcional" style={inputStyle} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={guardar} disabled={guardando} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
            <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </Card>
      )}

      {/* Métricas rápidas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: '1.25rem' }}>
        {[
          { label: 'Últimos 30 días', val: `${ultimos30.toLocaleString('es-AR')} mm` },
          { label: `Este mes (${MESES_LLUVIA[hoy.getMonth()]})`, val: `${totalMesActual.toLocaleString('es-AR')} mm` },
          { label: `Acumulado ${filtroAnio}`, val: `${totalAnio.toLocaleString('es-AR')} mm`, color: S.accent },
        ].map((m, i) => (
          <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem' }}>
            <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: m.color || S.text }}>{m.val}</div>
          </div>
        ))}
      </div>

      {/* Selector de año */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
        <Label>Año</Label>
        <select value={filtroAnio} onChange={e => setFiltroAnio(parseInt(e.target.value))} style={{ ...inputStyle, width: 120 }}>
          {anios.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Gráfico de barras por mes */}
      <Card titulo={`Lluvia por mes — ${filtroAnio}`}>
        <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {/* Líneas guía horizontales */}
          {[0.25, 0.5, 0.75, 1].map(f => (
            <line key={f} x1={padL} x2={chartW - 10} y1={chartH - padB - maxMm * f * escalaY} y2={chartH - padB - maxMm * f * escalaY} stroke={S.border} strokeWidth="1" />
          ))}
          {porMes.map((m, i) => {
            const h = m.mm * escalaY
            const x = padL + i * barW + barW * 0.15
            const w = barW * 0.7
            const y = chartH - padB - h
            return (
              <g key={i}>
                <rect x={x} y={y} width={w} height={h} rx={3} fill={m.mes === hoy.getMonth() && filtroAnio === hoy.getFullYear() ? S.accent : '#6FA8DC'} />
                {m.mm > 0 && <text x={x + w / 2} y={y - 4} textAnchor="middle" fontSize="10" fill={S.muted} fontFamily="monospace">{m.mm}</text>}
                <text x={x + w / 2} y={chartH - padB + 14} textAnchor="middle" fontSize="10" fill={S.muted}>{m.label}</text>
              </g>
            )
          })}
          <line x1={padL} x2={padL} y1={padT} y2={chartH - padB} stroke={S.border} strokeWidth="1" />
          <line x1={padL} x2={chartW - 10} y1={chartH - padB} y2={chartH - padB} stroke={S.border} strokeWidth="1" />
        </svg>
      </Card>

      {/* Tabla mensual */}
      <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: '1.5rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: S.bg }}>
            {['Mes', 'Mm acumulados'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Mm acumulados' ? 'right' : 'left', fontWeight: 600, color: S.muted, fontSize: 10, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {porMes.map(m => (
              <tr key={m.mes} style={{ borderBottom: `1px solid ${S.border}` }}>
                <td style={{ padding: '7px 12px' }}>{m.label}</td>
                <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: m.mm > 0 ? 700 : 400, color: m.mm > 0 ? S.accent : S.hint }}>{m.mm > 0 ? `${m.mm.toLocaleString('es-AR')} mm` : '—'}</td>
              </tr>
            ))}
            <tr style={{ background: S.bg, borderTop: `2px solid ${S.border}` }}>
              <td style={{ padding: '7px 12px', fontWeight: 700 }}>Total {filtroAnio}</td>
              <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: S.accent }}>{totalAnio.toLocaleString('es-AR')} mm</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Listado de registros individuales */}
      <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 8 }}>Registros individuales</div>
      <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: S.bg }}>
            {['Fecha', 'Mm', 'Observaciones', ''].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 10, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {lluvias.length === 0 && <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay lluvias registradas.</td></tr>}
            {lluvias.map(l => (
              <tr key={l.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(l.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontWeight: 700, color: S.accent }}>{l.mm} mm</td>
                <td style={{ padding: '7px 12px', color: S.muted, fontSize: 12 }}>{l.observaciones || '—'}</td>
                <td style={{ padding: '7px 12px' }}>
                  <button onClick={() => eliminar(l.id)} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
} 
