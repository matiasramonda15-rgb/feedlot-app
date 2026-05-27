import React, { useState, useEffect } from 'react'
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

export default function Agricultura({ usuario }) {
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
      { data: co }, { data: vg }, { data: ga }, { data: sa }
    ] = await Promise.all([
      supabase.from('campos').select('*, lotes_agricolas(*)').order('nombre'),
      supabase.from('campanas').select('*').order('año_inicio', { ascending: false }),
      supabase.from('plan_cultivos').select('*, campos(nombre), lotes_agricolas(numero), campanas(nombre)').order('creado_en', { ascending: false }),
      supabase.from('ordenes_trabajo').select('*, campos(nombre), campanas(nombre)').order('fecha', { ascending: false }),
      supabase.from('cosechas').select('*, campos(nombre), campanas(nombre)').order('fecha', { ascending: false }),
      supabase.from('ventas_granos').select('*').order('fecha', { ascending: false }),
      supabase.from('gastos_agro').select('*, campos(nombre), campanas(nombre)').order('fecha', { ascending: false }),
      supabase.from('stock_agro').select('*').order('insumo'),
    ])
    setCampos(c || [])
    setCampanas(ca || [])
    setPlanes(pl || [])
    setOrdenes(or || [])
    setCosechas(co || [])
    setVentasGranos(vg || [])
    setGastosAgro(ga || [])
    setStockAgro(sa || [])
    const activa = (ca || []).find(c => c.activa)
    if (activa) setCampanaActiva(activa)
    setLoading(false)
  }

  if (loading) return <Loader />

  const TABS = [
    { key: 'campos', label: 'Campos' },
    { key: 'campanas', label: 'Campaña' },
    { key: 'ordenes', label: 'Órdenes de trabajo' },
    { key: 'cosechas', label: 'Cosechas' },
    { key: 'ventas', label: 'Ventas de granos' },
    { key: 'gastos', label: 'Gastos' },
    { key: 'stock', label: 'Stock agroquímicos' },
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
      {tab === 'campanas' && <TabCampanas campanas={campanas} campos={campos} setCampanaActiva={setCampanaActiva} campanaActiva={campanaActiva} cargar={cargar} />}
      {tab === 'ordenes' && <TabOrdenes ordenes={ordenes} campos={campos} campanas={campanas} campanaActiva={campanaActiva} stockAgro={stockAgro} cargar={cargar} />}
      {tab === 'cosechas' && <TabCosechas cosechas={cosechas} campos={campos} campanas={campanas} campanaActiva={campanaActiva} planes={planes} cargar={cargar} />}
      {tab === 'ventas' && <TabVentasGranos ventas={ventasGranos} campos={campos} campanas={campanas} campanaActiva={campanaActiva} cosechas={cosechas} cargar={cargar} />}
      {tab === 'gastos' && <TabGastos gastos={gastosAgro} campos={campos} campanas={campanas} campanaActiva={campanaActiva} cargar={cargar} />}
      {tab === 'stock' && <TabStockAgro stock={stockAgro} cargar={cargar} />}
    </div>
  )
}

// ── TAB CAMPOS ──
function TabCampos({ campos, campanas, planes, campanaActiva, cargar }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nombre: '', superficie_ha: '', propietario: '', arrendamiento_ha: '', ubicacion: '' })
  const [editando, setEditando] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [selectedCampo, setSelectedCampo] = useState(null)
  const [showLoteForm, setShowLoteForm] = useState(false)
  const [formLote, setFormLote] = useState({ numero: '', superficie_ha: '' })

  async function guardar() {
    if (!form.nombre) { alert('Ingresá el nombre del campo'); return }
    setGuardando(true)
    if (editando) {
      await supabase.from('campos').update({ ...form, superficie_ha: parseFloat(form.superficie_ha) || null, arrendamiento_ha: parseFloat(form.arrendamiento_ha) || null }).eq('id', editando)
    } else {
      await supabase.from('campos').insert({ ...form, superficie_ha: parseFloat(form.superficie_ha) || null, arrendamiento_ha: parseFloat(form.arrendamiento_ha) || null, activo: true })
    }
    await cargar()
    setShowForm(false)
    setEditando(null)
    setForm({ nombre: '', superficie_ha: '', propietario: '', arrendamiento_ha: '', ubicacion: '' })
    setGuardando(false)
  }

  async function guardarLote() {
    if (!formLote.numero) { alert('Ingresá el número de lote'); return }
    await supabase.from('lotes_agricolas').insert({ campo_id: selectedCampo.id, numero: formLote.numero, superficie_ha: parseFloat(formLote.superficie_ha) || null })
    await cargar()
    setShowLoteForm(false)
    setFormLote({ numero: '', superficie_ha: '' })
  }

  async function eliminarLote(id) {
    if (!confirm('¿Eliminar este lote?')) return
    await supabase.from('lotes_agricolas').delete().eq('id', id)
    await cargar()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Campos arrendados</div>
        <button onClick={() => { setShowForm(!showForm); setEditando(null); setForm({ nombre: '', superficie_ha: '', propietario: '', arrendamiento_ha: '', ubicacion: '' }) }}
          style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          + Nuevo campo
        </button>
      </div>

      {showForm && (
        <Card titulo={editando ? 'Editar campo' : 'Nuevo campo'}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            {[
              { label: 'Nombre del campo *', key: 'nombre', type: 'text' },
              { label: 'Superficie total (ha)', key: 'superficie_ha', type: 'number' },
              { label: 'Propietario', key: 'propietario', type: 'text' },
              { label: 'Arrendamiento $/ha', key: 'arrendamiento_ha', type: 'number' },
              { label: 'Ubicación', key: 'ubicacion', type: 'text' },
            ].map(f => (
              <div key={f.key}>
                <Label>{f.label}</Label>
                <input type={f.type} value={form[f.key]} onChange={e => setForm({...form, [f.key]: e.target.value})}
                  style={inputStyle} />
              </div>
            ))}
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
        const arrendamientoAnual = c.arrendamiento_ha && c.superficie_ha ? c.arrendamiento_ha * c.superficie_ha : null
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
                {arrendamientoAnual && (
                  <div style={{ textAlign: 'right', marginRight: 8 }}>
                    <div style={{ fontSize: 10, color: S.muted }}>Arrendamiento anual</div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 700, color: S.red }}>-${arrendamientoAnual.toLocaleString('es-AR')}</div>
                  </div>
                )}
                <button onClick={() => { setEditando(c.id); setForm({ nombre: c.nombre, superficie_ha: c.superficie_ha || '', propietario: c.propietario || '', arrendamiento_ha: c.arrendamiento_ha || '', ubicacion: c.ubicacion || '' }); setShowForm(true); setSelectedCampo(null) }}
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
                      <button onClick={() => eliminarLote(l.id)} style={{ background: 'none', border: 'none', color: S.red, cursor: 'pointer', fontSize: 12 }}>✕</button>
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
    await supabase.from('campanas').insert({ ...form, año_inicio: parseInt(form.año_inicio), año_fin: parseInt(form.año_fin), activa: true })
    await supabase.from('campanas').update({ activa: false }).neq('nombre', form.nombre)
    await cargar()
    setShowForm(false)
    setGuardando(false)
  }

  async function activar(c) {
    await supabase.from('campanas').update({ activa: false }).neq('id', c.id)
    await supabase.from('campanas').update({ activa: true }).eq('id', c.id)
    setCampanaActiva(c)
    await cargar()
  }

  async function guardarPlan() {
    if (!formPlan.campo_id || !formPlan.cultivo) { alert('Seleccioná campo y cultivo'); return }
    await supabase.from('plan_cultivos').insert({
      campo_id: parseInt(formPlan.campo_id),
      lote_id: formPlan.lote_id ? parseInt(formPlan.lote_id) : null,
      campana_id: campanaVista,
      cultivo: formPlan.cultivo,
      superficie_ha: parseFloat(formPlan.superficie_ha) || null,
      fecha_siembra: formPlan.fecha_siembra || null,
      variedad: formPlan.variedad || null,
    })
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
              {!campanaSeleccionada.activa && (
                <button onClick={() => activar(campanaSeleccionada)} style={{ padding: '6px 12px', fontSize: 12, background: S.greenLight, border: `1px solid ${S.green}`, color: S.green, borderRadius: 6, cursor: 'pointer' }}>
                  Activar campaña
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
                      <button onClick={async () => { if (!confirm('¿Eliminar?')) return; await supabase.from('plan_cultivos').delete().eq('id', p.id); cargarPlanes(campanaVista) }}
                        style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button>
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

// ── TAB ÓRDENES DE TRABAJO ──
function TabOrdenes({ ordenes, campos, campanas, campanaActiva, stockAgro, cargar }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ campo_id: '', campana_id: campanaActiva?.id || '', tipo: '', fecha: new Date().toISOString().split('T')[0], descripcion: '', proveedor: '', costo_total: '', costo_ha: '', observaciones: '' })
  const [guardando, setGuardando] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroCampo, setFiltroCampo] = useState('')

  async function guardar() {
    if (!form.campo_id || !form.tipo) { alert('Seleccioná campo y tipo de trabajo'); return }
    setGuardando(true)
    const campo = campos.find(c => c.id === parseInt(form.campo_id))
    const costoHa = form.costo_total && campo?.superficie_ha ? Math.round(parseFloat(form.costo_total) / campo.superficie_ha) : (parseFloat(form.costo_ha) || null)
    await supabase.from('ordenes_trabajo').insert({
      campo_id: parseInt(form.campo_id),
      campana_id: parseInt(form.campana_id) || null,
      tipo: form.tipo,
      fecha: form.fecha,
      descripcion: form.descripcion || null,
      proveedor: form.proveedor || null,
      costo_total: parseFloat(form.costo_total) || null,
      costo_ha: costoHa,
      estado: 'completado',
      observaciones: form.observaciones || null,
    })
    await cargar()
    setShowForm(false)
    setForm({ campo_id: '', campana_id: campanaActiva?.id || '', tipo: '', fecha: new Date().toISOString().split('T')[0], descripcion: '', proveedor: '', costo_total: '', costo_ha: '', observaciones: '' })
    setGuardando(false)
  }

  const ordenesFiltradas = ordenes.filter(o => {
    if (filtroTipo && o.tipo !== filtroTipo) return false
    if (filtroCampo && o.campo_id !== parseInt(filtroCampo)) return false
    return true
  })

  const costoTotal = ordenesFiltradas.reduce((s, o) => s + (o.costo_total || 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Órdenes de trabajo</div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          + Nueva orden
        </button>
      </div>

      {showForm && (
        <Card titulo="Nueva orden de trabajo">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <Label>Campo *</Label>
              <select value={form.campo_id} onChange={e => setForm({...form, campo_id: e.target.value})} style={inputStyle}>
                <option value="">— Seleccioná —</option>
                {campos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
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
              <Label>Tipo de trabajo *</Label>
              <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} style={inputStyle}>
                <option value="">— Seleccioná —</option>
                {TIPOS_ORDEN.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <Label>Fecha</Label>
              <input type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} style={inputStyle} />
            </div>
            <div>
              <Label>Proveedor / Contratista</Label>
              <input type="text" value={form.proveedor} onChange={e => setForm({...form, proveedor: e.target.value})} style={inputStyle} />
            </div>
            <div>
              <Label>Descripción</Label>
              <input type="text" value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} style={inputStyle} />
            </div>
            <div>
              <Label>Costo total $</Label>
              <input type="number" value={form.costo_total} onChange={e => setForm({...form, costo_total: e.target.value})} style={inputStyle} />
            </div>
            <div>
              <Label>Costo $/ha (auto si hay total)</Label>
              <input type="number" value={form.costo_ha} onChange={e => setForm({...form, costo_ha: e.target.value})}
                placeholder={form.costo_total && campos.find(c => c.id === parseInt(form.campo_id))?.superficie_ha ? Math.round(parseFloat(form.costo_total) / campos.find(c => c.id === parseInt(form.campo_id))?.superficie_ha) : ''} style={inputStyle} />
            </div>
            <div>
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

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: '1rem' }}>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={{ padding: '7px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface }}>
          <option value="">Todos los tipos</option>
          {TIPOS_ORDEN.map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={filtroCampo} onChange={e => setFiltroCampo(e.target.value)} style={{ padding: '7px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface }}>
          <option value="">Todos los campos</option>
          {campos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', fontSize: 13, color: S.muted, alignSelf: 'center' }}>
          Total: <strong style={{ fontFamily: 'monospace', color: S.red }}>${costoTotal.toLocaleString('es-AR')}</strong>
        </div>
      </div>

      <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: S.bg }}>
            {['Fecha', 'Campo', 'Tipo', 'Descripción', 'Proveedor', 'Costo total', '$/ha', ''].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 10, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {ordenesFiltradas.length === 0 && <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay órdenes registradas.</td></tr>}
            {ordenesFiltradas.map(o => (
              <tr key={o.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12 }}>{o.fecha ? new Date(o.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}</td>
                <td style={{ padding: '8px 12px', fontWeight: 600 }}>{o.campos?.nombre}</td>
                <td style={{ padding: '8px 12px' }}><span style={{ padding: '2px 8px', borderRadius: 4, background: S.accentLight, color: S.accent, fontSize: 11, fontWeight: 600 }}>{o.tipo}</span></td>
                <td style={{ padding: '8px 12px', color: S.muted }}>{o.descripcion || '—'}</td>
                <td style={{ padding: '8px 12px', color: S.muted }}>{o.proveedor || '—'}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: S.red }}>{o.costo_total ? `-$${o.costo_total.toLocaleString('es-AR')}` : '—'}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, color: S.muted }}>{o.costo_ha ? `$${o.costo_ha.toLocaleString('es-AR')}` : '—'}</td>
                <td style={{ padding: '8px 12px' }}>
                  <button onClick={async () => { if (!confirm('¿Eliminar?')) return; await supabase.from('ordenes_trabajo').delete().eq('id', o.id); cargar() }}
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

// ── TAB COSECHAS ──
function TabCosechas({ cosechas, campos, campanas, campanaActiva, planes, cargar }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ campo_id: '', campana_id: campanaActiva?.id || '', cultivo: '', fecha: new Date().toISOString().split('T')[0], kg_totales: '', rendimiento_qq_ha: '', humedad_pct: '', observaciones: '' })
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    if (!form.campo_id || !form.cultivo || !form.kg_totales) { alert('Completá campo, cultivo y kg totales'); return }
    setGuardando(true)
    const campo = campos.find(c => c.id === parseInt(form.campo_id))
    const rendimiento = form.rendimiento_qq_ha || (form.kg_totales && campo?.superficie_ha ? ((parseFloat(form.kg_totales) / 1000) / campo.superficie_ha * 100).toFixed(1) : null)
    await supabase.from('cosechas').insert({
      campo_id: parseInt(form.campo_id),
      campana_id: parseInt(form.campana_id) || null,
      cultivo: form.cultivo,
      fecha: form.fecha,
      kg_totales: parseFloat(form.kg_totales),
      rendimiento_qq_ha: parseFloat(rendimiento) || null,
      humedad_pct: parseFloat(form.humedad_pct) || null,
      observaciones: form.observaciones || null,
    })
    await cargar()
    setShowForm(false)
    setForm({ campo_id: '', campana_id: campanaActiva?.id || '', cultivo: '', fecha: new Date().toISOString().split('T')[0], kg_totales: '', rendimiento_qq_ha: '', humedad_pct: '', observaciones: '' })
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
              <select value={form.campo_id} onChange={e => { setForm({...form, campo_id: e.target.value, cultivo: ''}) }} style={inputStyle}>
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
              <Label>Rendimiento qq/ha (auto si hay kg)</Label>
              <input type="number" value={form.rendimiento_qq_ha} onChange={e => setForm({...form, rendimiento_qq_ha: e.target.value})}
                placeholder={form.kg_totales && campos.find(c => c.id === parseInt(form.campo_id))?.superficie_ha ? ((parseFloat(form.kg_totales) / 1000) / campos.find(c => c.id === parseInt(form.campo_id))?.superficie_ha * 100).toFixed(1) : ''} style={inputStyle} />
            </div>
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
            {['Fecha', 'Campo', 'Campaña', 'Cultivo', 'Kg totales', 'Tn', 'Rend. qq/ha', 'Humedad', 'Obs.', ''].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 10, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {cosechas.length === 0 && <tr><td colSpan={10} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay cosechas registradas.</td></tr>}
            {cosechas.map(c => (
              <tr key={c.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12 }}>{c.fecha ? new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}</td>
                <td style={{ padding: '8px 12px', fontWeight: 600 }}>{c.campos?.nombre}</td>
                <td style={{ padding: '8px 12px', fontSize: 12, color: S.muted }}>{c.campanas?.nombre}</td>
                <td style={{ padding: '8px 12px' }}><span style={{ padding: '2px 8px', borderRadius: 4, background: S.greenLight, color: S.green, fontSize: 11, fontWeight: 600 }}>{c.cultivo}</span></td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{c.kg_totales ? c.kg_totales.toLocaleString('es-AR') : '—'}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: S.muted }}>{c.kg_totales ? (c.kg_totales / 1000).toLocaleString('es-AR') : '—'}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600, color: S.green }}>{c.rendimiento_qq_ha ? `${c.rendimiento_qq_ha} qq/ha` : '—'}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: S.muted }}>{c.humedad_pct ? `${c.humedad_pct}%` : '—'}</td>
                <td style={{ padding: '8px 12px', fontSize: 12, color: S.muted }}>{c.observaciones || '—'}</td>
                <td style={{ padding: '8px 12px' }}>
                  <button onClick={async () => { if (!confirm('¿Eliminar?')) return; await supabase.from('cosechas').delete().eq('id', c.id); cargar() }}
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

// ── TAB VENTAS DE GRANOS ──
function TabVentasGranos({ ventas, campos, campanas, campanaActiva, cosechas, cargar }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ campo_id: '', campana_id: campanaActiva?.id || '', cultivo: '', fecha: new Date().toISOString().split('T')[0], kg: '', precio_tn: '', monto_facturado: '', monto_negro: '', iva_pct: '10.5', comprador: '', numero_contrato: '', observaciones: '' })
  const [guardando, setGuardando] = useState(false)
  const [editando, setEditando] = useState(null)

  const totalVendido = ventas.reduce((s, v) => s + (v.kg || 0), 0)
  const totalIngresos = ventas.reduce((s, v) => s + (v.total || 0), 0)

  async function guardar() {
    if (!form.cultivo || !form.kg) { alert('Completá cultivo y kg'); return }
    setGuardando(true)
    const kg = parseFloat(form.kg)
    const precioTn = parseFloat(form.precio_tn) || 0
    const total = precioTn ? Math.round(kg * precioTn / 1000) : null
    const montoFact = form.monto_facturado ? parseFloat(form.monto_facturado) : total
    const montoNegro = total && montoFact ? Math.max(0, total - montoFact) : 0
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
      comprador: form.comprador || null,
      numero_contrato: form.numero_contrato || null,
      observaciones: form.observaciones || null,
      estado: 'confirmado',
    }
    if (editando) {
      await supabase.from('ventas_granos').update(data).eq('id', editando)
    } else {
      await supabase.from('ventas_granos').insert(data)
    }
    await cargar()
    setShowForm(false)
    setEditando(null)
    setForm({ campo_id: '', campana_id: campanaActiva?.id || '', cultivo: '', fecha: new Date().toISOString().split('T')[0], kg: '', precio_tn: '', monto_facturado: '', monto_negro: '', iva_pct: '10.5', comprador: '', numero_contrato: '', observaciones: '' })
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
            {['Fecha', 'Campo', 'Cultivo', 'Kg', 'Tn', '$/tn', 'Total', 'Facturado', 'Paralelo', 'Comprador', ''].map(h => (
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
  const [form, setForm] = useState({ campo_id: '', campana_id: campanaActiva?.id || '', concepto: '', monto: '', fecha: new Date().toISOString().split('T')[0], proveedor: '', observaciones: '' })
  const [guardando, setGuardando] = useState(false)
  const [editando, setEditando] = useState(null)

  const totalGastos = gastos.reduce((s, g) => s + (g.monto || 0), 0)

  async function guardar() {
    if (!form.concepto || !form.monto) { alert('Completá concepto y monto'); return }
    setGuardando(true)
    const data = { campo_id: parseInt(form.campo_id) || null, campana_id: parseInt(form.campana_id) || null, concepto: form.concepto, monto: parseFloat(form.monto), fecha: form.fecha, proveedor: form.proveedor || null, observaciones: form.observaciones || null }
    if (editando) {
      await supabase.from('gastos_agro').update(data).eq('id', editando)
    } else {
      await supabase.from('gastos_agro').insert(data)
    }
    await cargar()
    setShowForm(false)
    setEditando(null)
    setForm({ campo_id: '', campana_id: campanaActiva?.id || '', concepto: '', monto: '', fecha: new Date().toISOString().split('T')[0], proveedor: '', observaciones: '' })
    setGuardando(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Gastos agrícolas</div>
          <div style={{ fontSize: 12, color: S.red, marginTop: 2 }}>Total: <strong>-${totalGastos.toLocaleString('es-AR')}</strong></div>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditando(null) }}
          style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          + Registrar gasto
        </button>
      </div>

      {showForm && (
        <Card titulo={editando ? 'Editar gasto' : 'Nuevo gasto'}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <div><Label>Campo</Label><select value={form.campo_id} onChange={e => setForm({...form, campo_id: e.target.value})} style={inputStyle}><option value="">— Todos —</option>{campos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
            <div><Label>Campaña</Label><select value={form.campana_id} onChange={e => setForm({...form, campana_id: e.target.value})} style={inputStyle}><option value="">— Seleccioná —</option>{campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
            <div><Label>Concepto *</Label><input type="text" value={form.concepto} onChange={e => setForm({...form, concepto: e.target.value})} placeholder="ej. Arrendamiento, Seguro, etc." style={inputStyle} /></div>
            <div><Label>Monto $ *</Label><input type="number" value={form.monto} onChange={e => setForm({...form, monto: e.target.value})} style={inputStyle} /></div>
            <div><Label>Fecha</Label><input type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} style={inputStyle} /></div>
            <div><Label>Proveedor</Label><input type="text" value={form.proveedor} onChange={e => setForm({...form, proveedor: e.target.value})} style={inputStyle} /></div>
            <div style={{ gridColumn: '1/-1' }}><Label>Observaciones</Label><input type="text" value={form.observaciones} onChange={e => setForm({...form, observaciones: e.target.value})} style={inputStyle} /></div>
          </div>
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
                <td style={{ padding: '8px 12px', fontWeight: 600, fontSize: 12 }}>{g.campos?.nombre || '—'}</td>
                <td style={{ padding: '8px 12px', fontSize: 12, color: S.muted }}>{g.campanas?.nombre || '—'}</td>
                <td style={{ padding: '8px 12px' }}>{g.concepto}</td>
                <td style={{ padding: '8px 12px', color: S.muted }}>{g.proveedor || '—'}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600, color: S.red }}>-${g.monto ? g.monto.toLocaleString('es-AR') : '—'}</td>
                <td style={{ padding: '8px 12px', display: 'flex', gap: 4 }}>
                  <button onClick={() => { setEditando(g.id); setForm({ campo_id: g.campo_id || '', campana_id: g.campana_id || '', concepto: g.concepto, monto: g.monto || '', fecha: g.fecha || '', proveedor: g.proveedor || '', observaciones: g.observaciones || '' }); setShowForm(true) }}
                    style={{ padding: '3px 8px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>Editar</button>
                  <button onClick={async () => { if (!confirm('¿Eliminar?')) return; await supabase.from('gastos_agro').delete().eq('id', g.id); cargar() }}
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

// ── TAB STOCK AGROQUÍMICOS ──
function TabStockAgro({ stock, cargar }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ insumo: '', tipo: '', cantidad: '', unidad: 'litros', precio_referencia: '', minimo_stock: '' })
  const [editando, setEditando] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const TIPOS = ['Herbicida', 'Fungicida', 'Insecticida', 'Fertilizante', 'Coadyuvante', 'Semilla', 'Otro']
  const UNIDADES = ['litros', 'kg', 'bolsas', 'unidades']

  async function guardar() {
    if (!form.insumo) { alert('Ingresá el nombre del insumo'); return }
    setGuardando(true)
    const data = { insumo: form.insumo, tipo: form.tipo || null, cantidad: parseFloat(form.cantidad) || 0, unidad: form.unidad, precio_referencia: parseFloat(form.precio_referencia) || null, minimo_stock: parseFloat(form.minimo_stock) || 0, actualizado_en: new Date().toISOString() }
    if (editando) {
      await supabase.from('stock_agro').update(data).eq('id', editando)
    } else {
      await supabase.from('stock_agro').insert(data)
    }
    await cargar()
    setShowForm(false)
    setEditando(null)
    setForm({ insumo: '', tipo: '', cantidad: '', unidad: 'litros', precio_referencia: '', minimo_stock: '' })
    setGuardando(false)
  }

  const stockBajo = stock.filter(s => s.minimo_stock > 0 && s.cantidad <= s.minimo_stock)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Stock agroquímicos e insumos</div>
        <button onClick={() => { setShowForm(!showForm); setEditando(null); setForm({ insumo: '', tipo: '', cantidad: '', unidad: 'litros', precio_referencia: '', minimo_stock: '' }) }}
          style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          + Agregar insumo
        </button>
      </div>

      {stockBajo.length > 0 && (
        <div style={{ background: S.redLight, border: '1px solid #F09595', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: S.red, marginBottom: 4 }}>⚠ Stock bajo</div>
          {stockBajo.map(s => <div key={s.id} style={{ fontSize: 12, color: S.red }}>{s.insumo}: {s.cantidad} {s.unidad} (mínimo: {s.minimo_stock})</div>)}
        </div>
      )}

      {showForm && (
        <Card titulo={editando ? 'Editar insumo' : 'Nuevo insumo'}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <div><Label>Nombre *</Label><input type="text" value={form.insumo} onChange={e => setForm({...form, insumo: e.target.value})} style={inputStyle} /></div>
            <div><Label>Tipo</Label><select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} style={inputStyle}><option value="">— Seleccioná —</option>{TIPOS.map(t => <option key={t}>{t}</option>)}</select></div>
            <div><Label>Unidad</Label><select value={form.unidad} onChange={e => setForm({...form, unidad: e.target.value})} style={inputStyle}>{UNIDADES.map(u => <option key={u}>{u}</option>)}</select></div>
            <div><Label>Cantidad en stock</Label><input type="number" value={form.cantidad} onChange={e => setForm({...form, cantidad: e.target.value})} style={inputStyle} /></div>
            <div><Label>Precio referencia</Label><input type="number" value={form.precio_referencia} onChange={e => setForm({...form, precio_referencia: e.target.value})} style={inputStyle} /></div>
            <div><Label>Stock mínimo alerta</Label><input type="number" value={form.minimo_stock} onChange={e => setForm({...form, minimo_stock: e.target.value})} style={inputStyle} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={guardar} disabled={guardando} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
            <button onClick={() => { setShowForm(false); setEditando(null) }} style={{ padding: '8px 16px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </Card>
      )}

      <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: S.bg }}>
            {['Insumo', 'Tipo', 'Stock', 'Unidad', 'Precio ref.', 'Mínimo', ''].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 10, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {stock.length === 0 && <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay insumos cargados.</td></tr>}
            {stock.map(s => {
              const bajo = s.minimo_stock > 0 && s.cantidad <= s.minimo_stock
              return (
                <tr key={s.id} style={{ borderBottom: `1px solid ${S.border}`, background: bajo ? '#FFF5F5' : 'transparent' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>{s.insumo}</td>
                  <td style={{ padding: '8px 12px' }}>{s.tipo ? <span style={{ padding: '2px 8px', borderRadius: 4, background: S.accentLight, color: S.accent, fontSize: 11 }}>{s.tipo}</span> : '—'}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600, color: bajo ? S.red : S.text }}>{s.cantidad?.toLocaleString('es-AR')}</td>
                  <td style={{ padding: '8px 12px', color: S.muted }}>{s.unidad}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: S.muted }}>{s.precio_referencia ? `$${s.precio_referencia.toLocaleString('es-AR')}` : '—'}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, color: S.muted }}>{s.minimo_stock || '—'}</td>
                  <td style={{ padding: '8px 12px', display: 'flex', gap: 4 }}>
                    <button onClick={() => { setEditando(s.id); setForm({ insumo: s.insumo, tipo: s.tipo || '', cantidad: s.cantidad || '', unidad: s.unidad || 'litros', precio_referencia: s.precio_referencia || '', minimo_stock: s.minimo_stock || '' }); setShowForm(true) }}
                      style={{ padding: '3px 8px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>Editar</button>
                    <button onClick={async () => { if (!confirm('¿Eliminar?')) return; await supabase.from('stock_agro').delete().eq('id', s.id); cargar() }}
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
