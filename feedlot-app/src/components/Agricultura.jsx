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
  const [ingresosAgro, setIngresosAgro] = useState([])
  const [contactos, setContactos] = useState([])

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
      { data: ia }, { data: ct }
    ] = await Promise.all([
      supabase.from('campos').select('*, lotes_agricolas(*)').order('nombre'),
      supabase.from('campanas').select('*').order('año_inicio', { ascending: false }),
      supabase.from('plan_cultivos').select('*, campos(nombre), lotes_agricolas(numero), campanas(nombre)').order('creado_en', { ascending: false }),
      supabase.from('ordenes_trabajo').select('*, campos(nombre, superficie_ha, imagen_url, lotes_agricolas(id, numero, superficie_ha, imagen_url)), campanas(nombre)').order('fecha', { ascending: false }),
      supabase.from('cosechas').select('*, campos(nombre), campanas(nombre)').order('fecha', { ascending: false }),
      supabase.from('ventas_granos').select('*').order('fecha', { ascending: false }),
      supabase.from('gastos_agro').select('*, campos(nombre), campanas(nombre)').order('fecha', { ascending: false }),
      supabase.from('stock_agro').select('*').order('insumo'),
      supabase.from('ingresos_agroquimicos').select('*, stock_agro(insumo, unidad)').order('fecha', { ascending: false }).limit(200),
      supabase.from('contactos').select('id, nombre, cuit').eq('activo', true).order('nombre'),
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
    const activa = (ca || []).find(c => c.activa)
    if (activa) setCampanaActiva(activa)
    setLoading(false)
  }

  if (loading) return <Loader />

  const TABS = [
    { key: 'campos', label: 'Campos' },
    { key: 'arriendos', label: 'Arriendos' },
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
      {tab === 'arriendos' && <TabArriendos campos={campos} cargar={cargar} contactos={contactos} usuario={usuario} />}
      {tab === 'campanas' && <TabCampanas campanas={campanas} campos={campos} setCampanaActiva={setCampanaActiva} campanaActiva={campanaActiva} cargar={cargar} />}
      {tab === 'ordenes' && <TabOrdenes ordenes={ordenes} campos={campos} campanas={campanas} campanaActiva={campanaActiva} stockAgro={stockAgro} cargar={cargar} contactos={contactos} usuario={usuario} />}
      {tab === 'cosechas' && <TabCosechas cosechas={cosechas} campos={campos} campanas={campanas} campanaActiva={campanaActiva} planes={planes} cargar={cargar} />}
      {tab === 'ventas' && <TabVentasGranos ventas={ventasGranos} campos={campos} campanas={campanas} campanaActiva={campanaActiva} cosechas={cosechas} cargar={cargar} />}
      {tab === 'gastos' && <TabGastos gastos={gastosAgro} campos={campos} campanas={campanas} campanaActiva={campanaActiva} cargar={cargar} />}
      {tab === 'stock' && <TabStockAgro stock={stockAgro} ingresos={ingresosAgro} contactos={contactos} cargar={cargar} usuario={usuario} />}
    </div>
  )
}

// ── TAB CAMPOS ──
function TabCampos({ campos, campanas, planes, campanaActiva, cargar }) {
  const [showForm, setShowForm] = useState(false)
  const [pagarAhora, setPagarAhora] = useState(true)
  const [showPagos, setShowPagos] = useState(false)
  const [seleccionadas, setSeleccionadas] = useState([])
  const [formPagoGrupal, setFormPagoGrupal] = useState({ fecha: new Date().toISOString().split('T')[0], pagos: [{ ...PAGO_INIT_ORDEN }] })
  const [guardandoPago, setGuardandoPago] = useState(false)
  const [form, setForm] = useState({ nombre: '', superficie_ha: '', propietario: '', arrendamiento_qq_ha: '', forma_pago_arriendo: 'semestral', dia_vencimiento_arriendo: '', ubicacion: '', imagen_url: '' })
  const [editando, setEditando] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [selectedCampo, setSelectedCampo] = useState(null)
  const [showLoteForm, setShowLoteForm] = useState(false)
  const [formLote, setFormLote] = useState({ numero: '', superficie_ha: '', imagen_url: '' })

  async function guardar() {
    if (!form.nombre) { alert('Ingresá el nombre del campo'); return }
    setGuardando(true)
    const campoData = { nombre: form.nombre, superficie_ha: parseFloat(form.superficie_ha) || null, propietario: form.propietario || null, arrendamiento_qq_ha: parseFloat(form.arrendamiento_qq_ha) || null, forma_pago_arriendo: form.forma_pago_arriendo || 'semestral', dia_vencimiento_arriendo: parseInt(form.dia_vencimiento_arriendo) || null, ubicacion: form.ubicacion || null, imagen_url: form.imagen_url || null }
    if (editando) {
      await supabase.from('campos').update(campoData).eq('id', editando)
    } else {
      await supabase.from('campos').insert({ ...campoData, activo: true })
    }
    await cargar()
    setShowForm(false)
    setEditando(null)
    setForm({ nombre: '', superficie_ha: '', propietario: '', arrendamiento_qq_ha: '', forma_pago_arriendo: 'semestral', dia_vencimiento_arriendo: '', ubicacion: '', imagen_url: '' })
    setGuardando(false)
  }

  async function guardarLote() {
    if (!formLote.numero) { alert('Ingresá el número de lote'); return }
    await supabase.from('lotes_agricolas').insert({ campo_id: selectedCampo.id, numero: formLote.numero, superficie_ha: parseFloat(formLote.superficie_ha) || null, imagen_url: formLote.imagen_url || null })
    await cargar()
    setShowLoteForm(false)
    setFormLote({ numero: '', superficie_ha: '', imagen_url: '' })
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
            <div><Label>Nombre del campo *</Label><input type="text" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} style={inputStyle} /></div>
            <div><Label>Superficie total (ha)</Label><input type="number" value={form.superficie_ha} onChange={e => setForm({...form, superficie_ha: e.target.value})} style={inputStyle} /></div>
            <div><Label>Propietario</Label><input type="text" value={form.propietario} onChange={e => setForm({...form, propietario: e.target.value})} style={inputStyle} /></div>
            <div><Label>Arrendamiento qq soja/ha/año</Label><input type="number" value={form.arrendamiento_qq_ha} onChange={e => setForm({...form, arrendamiento_qq_ha: e.target.value})} placeholder="ej. 9" style={inputStyle} /></div>
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
                {c.imagen_url && (
                  <a href={c.imagen_url} target="_blank" rel="noopener noreferrer"
                    style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, background: '#E8EFF8', border: '1px solid #378ADD', color: '#1A3D6B', borderRadius: 6, textDecoration: 'none' }}>
                    🗺 Ver mapa
                  </a>
                )}
                {c.arrendamiento_qq_ha && (
                  <div style={{ textAlign: 'right', marginRight: 8 }}>
                    <div style={{ fontSize: 10, color: S.muted }}>Arrendamiento</div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 700, color: S.red }}>{c.arrendamiento_qq_ha} qq/ha · {arrendamientoAnual?.toLocaleString('es-AR')} qq/año</div>
                    <div style={{ fontSize: 10, color: S.muted }}>{c.forma_pago_arriendo}</div>
                  </div>
                )}
                <button onClick={() => { setEditando(c.id); setForm({ nombre: c.nombre, superficie_ha: c.superficie_ha || '', propietario: c.propietario || '', arrendamiento_qq_ha: c.arrendamiento_qq_ha || '', forma_pago_arriendo: c.forma_pago_arriendo || 'semestral', dia_vencimiento_arriendo: c.dia_vencimiento_arriendo || '', ubicacion: c.ubicacion || '', imagen_url: c.imagen_url || '' }); setShowForm(true); setSelectedCampo(null) }}
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
  const [formPagoGrupal, setFormPagoGrupal] = useState({ fecha: new Date().toISOString().split('T')[0], pagos: [{ ...PAGO_INIT_ORDEN }] })
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

const PAGO_INIT_ORDEN = { tipo: 'transferencia', monto: '', es_paralelo: false, subtipo_cheque: '', cheque_propio: { numero: '', banco: '', fecha_vencimiento: '' }, cheque_tercero_id: '' }
const PAGO_INIT_AGRO = { tipo: 'transferencia', monto: '', es_paralelo: false, subtipo_cheque: '', cheque_propio: { numero: '', banco: '', fecha_vencimiento: '' }, cheque_tercero_id: '' }
const PAGO_INIT_ARR = { tipo: 'transferencia', monto: '', es_paralelo: false, subtipo_cheque: '', cheque_propio: { numero: '', banco: '', fecha_vencimiento: '' }, cheque_tercero_id: '' }

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

function generarReciboOrden(orden, campo, lote, campana, stockAgro) {
  const fecha = orden.fecha ? new Date(orden.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
  const superficie = lote?.superficie_ha || campo?.superficie_ha || '—'
  const pagos = orden.pagos_detalle || []
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

  const filasPago = pagos.map(p => {
    let desc = p.tipo === 'transferencia' ? 'TRANSFERENCIA' : p.tipo === 'efectivo' ? 'EFECTIVO' : p.tipo === 'cuenta_corriente' ? 'CUENTA CORRIENTE' : p.subtipo_cheque === 'propio' ? 'E-CHEQ PROPIO' : 'E-CHEQ TERCERO'
    if (p.es_paralelo) desc += ' (PARALELO)'
    const nro = p.subtipo_cheque === 'propio' ? (p.cheque_propio?.numero || '') : ''
    const fechaCobro = p.subtipo_cheque === 'propio' && p.cheque_propio?.fecha_vencimiento ? new Date(p.cheque_propio.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR') : ''
    return `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${desc}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${nro}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${fechaCobro}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">$${parseFloat(p.monto||0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
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
      <tr><td style="padding:4px 8px;width:50%;">Nombre: <strong>${orden.proveedor || ''}</strong></td><td style="padding:4px 8px;">I.V.A.: ${orden.iva || ''}</td></tr>
      <tr><td style="padding:4px 8px;">Localidad: ${orden.localidad || ''}</td><td style="padding:4px 8px;">CUIT/DNI: ${orden.cuit || ''}</td></tr>
      <tr><td style="padding:4px 8px;">C.B.U: ${orden.cbu || ''}</td><td style="padding:4px 8px;">FECHA &nbsp;<strong>${fecha}</strong></td></tr>
    </table>
    <table style="width:100%;border:1px solid #333;border-top:none;border-collapse:collapse;">
      <tr><td colspan="2" style="padding:4px 8px;font-weight:bold;background:#f5f5f5;border-bottom:1px solid #333;">Concepto</td></tr>
      <tr><td colspan="2" style="padding:6px 8px;">${orden.tipo} — ${campo?.nombre || ''}${lote ? ` Lote ${lote.numero}` : ''} · ${superficie} ha${campana ? ` · ${campana.nombre}` : ''}</td></tr>
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
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Recibo — ${orden.tipo}</title><style>@media print{.no-print{display:none;}}body{font-family:Arial,sans-serif;background:#fff;padding:10px;}</style></head><body>
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

  const filasPago = pagos.map(p => {
    let desc = p.tipo === 'transferencia' ? 'TRANSFERENCIA' : p.tipo === 'efectivo' ? 'EFECTIVO' : p.tipo === 'cuenta_corriente' ? 'CUENTA CORRIENTE' : p.subtipo_cheque === 'propio' ? 'E-CHEQ PROPIO' : 'E-CHEQ TERCERO'
    if (p.es_paralelo) desc += ' (PARALELO)'
    const nro = p.subtipo_cheque === 'propio' ? (p.cheque_propio?.numero || '') : ''
    const fechaCobro = p.subtipo_cheque === 'propio' && p.cheque_propio?.fecha_vencimiento ? new Date(p.cheque_propio.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR') : ''
    return `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${desc}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${nro}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${fechaCobro}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">$${parseFloat(p.monto||0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
    </tr>`
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
function TabOrdenes({ ordenes, campos, campanas, campanaActiva, stockAgro, cargar, contactos, usuario }) {
  const [tabInner, setTabInner] = useState('ordenes')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    campo_id: '', campana_id: campanaActiva?.id || '', tipo: '', fecha: new Date().toISOString().split('T')[0],
    descripcion: '', proveedor: '', es_propia: false, lote_id: '', superficie_ha: '',
    productos: [], gastos_propios: [],
    costo_total: '', costo_ha: '', observaciones: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroCampo, setFiltroCampo] = useState('')

  // Pagos
  const [showPagos, setShowPagos] = useState(false)
  const [seleccionadas, setSeleccionadas] = useState([])
  const [formPagoGrupal, setFormPagoGrupal] = useState({ fecha: new Date().toISOString().split('T')[0], pagos: [{ ...PAGO_INIT_ORDEN }], domicilio: '', localidad: '', cuit: '', iva: '', cbu: '' })
  const [guardandoPago, setGuardandoPago] = useState(false)
  const [chequesCartera, setChequesCartera] = useState([])

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
      const { data: co } = await supabase.from('caja_oficial').insert({ fecha: form.fecha, tipo: 'egreso', categoria: 'Gasto propio agricultura', descripcion: desc, monto: totalGastosPropios, forma_pago: 'interno' }).select().single()
      caja_oficial_id = co?.id || null
    }

    // Descontar stock de productos usados — query fresco para tener cantidad actual
    for (const p of form.productos) {
      if (!p.id || !p.dosis || !superficie) continue
      const { data: itemFresh } = await supabase.from('stock_agro').select('id, cantidad').eq('id', parseInt(p.id)).single()
      if (itemFresh) {
        const usado = parseFloat(p.dosis) * superficie
        await supabase.from('stock_agro').update({ cantidad: Math.max(0, (itemFresh.cantidad || 0) - usado), actualizado_en: new Date().toISOString() }).eq('id', itemFresh.id)
      }
    }

    await supabase.from('ordenes_trabajo').insert({
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
    })

    await cargar()
    setShowForm(false)
    setForm({ campo_id: '', campana_id: campanaActiva?.id || '', tipo: '', fecha: new Date().toISOString().split('T')[0], descripcion: '', proveedor: '', es_propia: false, lote_id: '', superficie_ha: '', productos: [], gastos_propios: [], costo_total: '', costo_ha: '', observaciones: '' })
    setGuardando(false)
  }

  async function pagarSeleccionadas() {
    if (seleccionadas.length === 0) { alert('Seleccioná al menos una orden'); return }
    const pendientes = ordenes.filter(o => !o.es_propia && o.estado_pago === 'pendiente')
    const totalSel = seleccionadas.reduce((s, id) => { const o = pendientes.find(x => x.id === id); return s + (o?.costo_total || 0) }, 0)
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
      } else if (pago.subtipo_cheque === 'tercero' && pago.cheque_tercero_id) {
        await supabase.from('cheques').update({ estado: 'depositado' }).eq('id', parseInt(pago.cheque_tercero_id))
      }
    }

    for (const id of seleccionadas) {
      await supabase.from('ordenes_trabajo').update({ estado_pago: 'pagado', caja_oficial_id, caja_paralela_id, pagos_detalle: formPagoGrupal.pagos, domicilio: formPagoGrupal.domicilio || null, localidad: formPagoGrupal.localidad || null, cuit: formPagoGrupal.cuit || null, iva: formPagoGrupal.iva || null, cbu: formPagoGrupal.cbu || null }).eq('id', id)
    }

    const ordenesPagadas = seleccionadas.map(id => pendientes.find(o => o.id === id)).filter(Boolean)
    const pagosFinal = [...formPagoGrupal.pagos]
    setSeleccionadas([])
    setShowPagos(false)
    setFormPagoGrupal({ fecha: new Date().toISOString().split('T')[0], pagos: [{ ...PAGO_INIT_ORDEN }], domicilio: '', localidad: '', cuit: '', iva: '', cbu: '' })
    setGuardandoPago(false)
    await cargar()
    ordenesPagadas.forEach(o => {
      const campoO = campos.find(c => c.id === o.campo_id)
      const loteO = campoO?.lotes_agricolas?.find(l => l.id === o.lote_id)
      const campanaO = campanas.find(c => c.id === o.campana_id)
      generarReciboOrden({ ...o, fecha: formPagoGrupal.fecha, pagos_detalle: pagosFinal, ...formPagoGrupal }, campoO, loteO, campanaO, stockAgro)
    })
  }

  const ordenesFiltradas = ordenes.filter(o => {
    if (filtroTipo && o.tipo !== filtroTipo) return false
    if (filtroCampo && o.campo_id !== parseInt(filtroCampo)) return false
    return true
  })
  const pendientes = ordenes.filter(o => !o.es_propia && o.estado_pago === 'pendiente')
  const totalSelec = seleccionadas.reduce((s, id) => { const o = pendientes.find(x => x.id === id); return s + (o?.costo_total || 0) }, 0)
  const totalPagoGrupal = formPagoGrupal.pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)

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

              {/* Costo (contratista) */}
              {!form.es_propia && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div><Label>Costo total $ (opcional)</Label><input type="number" value={form.costo_total} onChange={e => setForm({...form, costo_total: e.target.value})} style={inputStyle} placeholder="Se puede cargar al pagar" /></div>
                  <div><Label>Costo $/ha</Label><input type="number" value={form.costo_ha} onChange={e => setForm({...form, costo_ha: e.target.value})} style={inputStyle} /></div>
                </div>
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
                          {o.estado_pago === 'pagado' && o.costo_total && <button onClick={() => {
                            const campanaO = campanas.find(c => c.id === o.campana_id)
                            generarReciboOrden(o, campoO, loteO, campanaO, stockAgro)
                          }} style={{ padding: '3px 8px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>🖨️ Recibo</button>}
                          <button onClick={async () => {
                            if (!confirm('¿Eliminar esta orden?')) return
                            if (o.caja_oficial_id) await supabase.from('caja_oficial').delete().eq('id', o.caja_oficial_id)
                            if (o.caja_paralela_id) await supabase.from('caja_paralela').delete().eq('id', o.caja_paralela_id)
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
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: S.red }}>${o.costo_total?.toLocaleString('es-AR')}</span>
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

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase' }}>Formas de pago</div>
                    <button onClick={() => setFormPagoGrupal({...formPagoGrupal, pagos: [...formPagoGrupal.pagos, { ...PAGO_INIT_ORDEN }]})} style={{ padding: '4px 10px', fontSize: 11, background: 'transparent', border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>+ Agregar</button>
                  </div>

                  {formPagoGrupal.pagos.map((pago, idx) => (
                    <div key={idx} style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 7, padding: '8px', marginBottom: 6 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 8, alignItems: 'flex-end', marginBottom: pago.tipo === 'e-cheq' ? 8 : 0 }}>
                        <div><Label>Forma</Label>
                          <select value={pago.tipo} onChange={e => { const n = formPagoGrupal.pagos.map((p,i) => i===idx ? {...p, tipo: e.target.value, subtipo_cheque: ''} : p); setFormPagoGrupal({...formPagoGrupal, pagos: n}) }} style={inputStyle}>
                            <option value="transferencia">Transferencia</option>
                            <option value="efectivo">Efectivo</option>
                            <option value="e-cheq">E-cheq</option>
                            <option value="cuenta_corriente">Cuenta corriente</option>
                          </select>
                        </div>
                        <div><Label>Monto $</Label>
                          <input type="number" value={pago.monto} onChange={e => { const n = formPagoGrupal.pagos.map((p,i) => i===idx ? {...p, monto: e.target.value} : p); setFormPagoGrupal({...formPagoGrupal, pagos: n}) }} style={inputStyle} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#3D1A6B', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            <input type="checkbox" checked={pago.es_paralelo} onChange={e => { const n = formPagoGrupal.pagos.map((p,i) => i===idx ? {...p, es_paralelo: e.target.checked} : p); setFormPagoGrupal({...formPagoGrupal, pagos: n}) }} />
                            Paralelo
                          </label>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                          {formPagoGrupal.pagos.length > 1 && <button onClick={() => setFormPagoGrupal({...formPagoGrupal, pagos: formPagoGrupal.pagos.filter((_,i)=>i!==idx)})} style={{ padding: '5px 8px', fontSize: 10, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 4, cursor: 'pointer' }}>✕</button>}
                        </div>
                      </div>
                      {pago.tipo === 'e-cheq' && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ display: 'flex', gap: 8, marginBottom: pago.subtipo_cheque ? 8 : 0 }}>
                            {(pago.es_paralelo ? ['tercero'] : ['propio', 'tercero']).map(t => (
                              <button key={t} onClick={() => { const n = formPagoGrupal.pagos.map((p,i) => i===idx ? {...p, subtipo_cheque: p.subtipo_cheque===t?'':t} : p); setFormPagoGrupal({...formPagoGrupal, pagos: n}) }}
                                style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 5, cursor: 'pointer', border: `1px solid ${pago.subtipo_cheque===t ? S.accent : S.border}`, background: pago.subtipo_cheque===t ? S.accentLight : 'transparent', color: pago.subtipo_cheque===t ? S.accent : S.muted }}>
                                {t === 'propio' ? '📤 Propio' : '📥 Tercero'}
                              </button>
                            ))}
                          </div>
                          {pago.subtipo_cheque === 'propio' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
                              <div><Label>N° cheque</Label><input type="text" value={pago.cheque_propio.numero} onChange={e => { const n = formPagoGrupal.pagos.map((p,i) => i===idx ? {...p, cheque_propio: {...p.cheque_propio, numero: e.target.value}} : p); setFormPagoGrupal({...formPagoGrupal, pagos: n}) }} style={inputStyle} /></div>
                              <div><Label>Banco</Label><input type="text" value={pago.cheque_propio.banco} onChange={e => { const n = formPagoGrupal.pagos.map((p,i) => i===idx ? {...p, cheque_propio: {...p.cheque_propio, banco: e.target.value}} : p); setFormPagoGrupal({...formPagoGrupal, pagos: n}) }} style={inputStyle} /></div>
                              <div><Label>Vencimiento</Label><input type="date" value={pago.cheque_propio.fecha_vencimiento} onChange={e => { const n = formPagoGrupal.pagos.map((p,i) => i===idx ? {...p, cheque_propio: {...p.cheque_propio, fecha_vencimiento: e.target.value}} : p); setFormPagoGrupal({...formPagoGrupal, pagos: n}) }} style={{ ...inputStyle, borderColor: S.amber }} /></div>
                            </div>
                          )}
                          {pago.subtipo_cheque === 'tercero' && (
                            <div style={{ marginTop: 8 }}>
                              {(() => {
                                const lista = chequesCartera.filter(ch => pago.es_paralelo ? ch.es_paralelo : !ch.es_paralelo)
                                return lista.length === 0
                                  ? <div style={{ fontSize: 12, color: S.hint }}>No hay cheques en cartera.</div>
                                  : lista.map(ch => (
                                    <label key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', border: `1px solid ${pago.cheque_tercero_id===String(ch.id) ? S.accent : S.border}`, borderRadius: 5, background: pago.cheque_tercero_id===String(ch.id) ? S.accentLight : S.surface, cursor: 'pointer', marginBottom: 4 }}>
                                      <input type="radio" name={`cheq_ord_${idx}`} value={ch.id} checked={pago.cheque_tercero_id===String(ch.id)} onChange={() => { const n = formPagoGrupal.pagos.map((p,i) => i===idx ? {...p, cheque_tercero_id: String(ch.id)} : p); setFormPagoGrupal({...formPagoGrupal, pagos: n}) }} />
                                      <span style={{ fontSize: 12 }}><strong>${ch.monto?.toLocaleString('es-AR')}</strong> · #{ch.numero||'sin nro'} · {ch.banco||'—'} · vence {ch.fecha_vencimiento ? new Date(ch.fecha_vencimiento+'T12:00:00').toLocaleDateString('es-AR') : '—'}</span>
                                    </label>
                                  ))
                              })()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  <div style={{ background: Math.abs(totalSelec-totalPagoGrupal) < 0.5 ? S.greenLight : S.amberLight, border: `1px solid ${Math.abs(totalSelec-totalPagoGrupal) < 0.5 ? '#97C459' : '#EF9F27'}`, borderRadius: 6, padding: '8px 12px', fontSize: 13, marginBottom: '1rem' }}>
                    Total órdenes: <strong>${totalSelec.toLocaleString('es-AR')}</strong> · Pagos: <strong>${totalPagoGrupal.toLocaleString('es-AR')}</strong>
                    {Math.abs(totalSelec-totalPagoGrupal) >= 0.5 && <span style={{ marginLeft: 12, color: S.amber, fontWeight: 600 }}>Diferencia: ${(totalSelec-totalPagoGrupal).toLocaleString('es-AR')}</span>}
                  </div>

                  <button onClick={pagarSeleccionadas} disabled={guardandoPago}
                    style={{ padding: '9px 24px', fontSize: 13, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
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


function TabCosechas({ cosechas, campos, campanas, campanaActiva, planes, cargar }) {
  const [showForm, setShowForm] = useState(false)
  const [pagarAhora, setPagarAhora] = useState(true)
  const [showPagos, setShowPagos] = useState(false)
  const [seleccionadas, setSeleccionadas] = useState([])
  const [formPagoGrupal, setFormPagoGrupal] = useState({ fecha: new Date().toISOString().split('T')[0], pagos: [{ ...PAGO_INIT_ORDEN }] })
  const [guardandoPago, setGuardandoPago] = useState(false)
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
  const [pagarAhora, setPagarAhora] = useState(true)
  const [showPagos, setShowPagos] = useState(false)
  const [seleccionadas, setSeleccionadas] = useState([])
  const [formPagoGrupal, setFormPagoGrupal] = useState({ fecha: new Date().toISOString().split('T')[0], pagos: [{ ...PAGO_INIT_ORDEN }] })
  const [guardandoPago, setGuardandoPago] = useState(false)
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
      const { data: vg } = await supabase.from('ventas_granos').insert(data).select().single()
      if (total && total > 0) {
        const desc = `Venta ${form.cultivo} — ${form.comprador || 'sin comprador'} · ${kg?.toLocaleString('es-AR')} kg`
        if (montoFact && montoFact > 0) {
          await supabase.from('caja_oficial').insert({ fecha: form.fecha, tipo: 'ingreso', categoria: 'Venta cereales', descripcion: desc, monto: montoFact, forma_pago: 'transferencia' })
        }
        if (montoNegro && montoNegro > 0) {
          await supabase.from('caja_paralela').insert({ fecha: form.fecha, tipo: 'ingreso', descripcion: desc, monto: montoNegro })
        }
      }
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
  const [pagarAhora, setPagarAhora] = useState(true)
  const [showPagos, setShowPagos] = useState(false)
  const [seleccionadas, setSeleccionadas] = useState([])
  const [formPagoGrupal, setFormPagoGrupal] = useState({ fecha: new Date().toISOString().split('T')[0], pagos: [{ ...PAGO_INIT_ORDEN }] })
  const [guardandoPago, setGuardandoPago] = useState(false)
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
  const concepto = `Arriendo — ${campo?.nombre || ''} · ${v.qq_ha || ''} qq/ha · ${campo?.superficie_ha || ''} ha · Venc. ${fechaVenc}${v.precio_pizarra ? ` · $${v.precio_pizarra.toLocaleString('es-AR')}/qq` : ''}`
  const filasPago = pagos.map(p => {
    let desc = p.tipo === 'transferencia' ? 'TRANSFERENCIA' : p.tipo === 'efectivo' ? 'EFECTIVO' : p.tipo === 'cuenta_corriente' ? 'CUENTA CORRIENTE' : p.subtipo_cheque === 'propio' ? 'E-CHEQ PROPIO' : 'E-CHEQ TERCERO'
    if (p.es_paralelo) desc += ' (PARALELO)'
    const nro = p.subtipo_cheque === 'propio' ? (p.cheque_propio?.numero || '') : ''
    const fechaCobro = p.subtipo_cheque === 'propio' && p.cheque_propio?.fecha_vencimiento ? new Date(p.cheque_propio.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR') : ''
    return `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;">${desc}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${nro}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${fechaCobro}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">$${parseFloat(p.monto||0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td></tr>`
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
  const [formVenc, setFormVenc] = useState({ fecha_vencimiento: '', qq_ha: '', precio_pizarra: '', observaciones: '' })
  const [guardando, setGuardando] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pagoAbierto, setPagoAbierto] = useState(null) // id del vencimiento
  const [formPago, setFormPago] = useState({ fecha: new Date().toISOString().split('T')[0], precio_pizarra: '', meses: 1, pagos: [{ ...PAGO_INIT_ARR }] })
  const [guardandoPago, setGuardandoPago] = useState(false)
  const [chequesCartera, setChequesCartera] = useState([])

  useEffect(() => { cargarVencimientos() }, [])

  async function cargarVencimientos() {
    const [{ data }, { data: ch }] = await Promise.all([
      supabase.from('vencimientos_arriendo').select('*, campos(nombre, superficie_ha, arrendamiento_qq_ha)').order('fecha_vencimiento'),
      supabase.from('cheques').select('*').eq('tipo', 'recibido').eq('estado', 'en_cartera').order('fecha_vencimiento', { ascending: true }),
    ])
    setVencimientos(data || [])
    setChequesCartera(ch || [])
    setLoading(false)
  }

  async function guardarVencimiento(campo_id) {
    if (!formVenc.fecha_vencimiento) { alert('Ingresá la fecha de vencimiento'); return }
    setGuardando(true)
    const qq = parseFloat(formVenc.qq_ha) || 0
    const precio = parseFloat(formVenc.precio_pizarra) || 0
    const campo = campos.find(c => c.id === campo_id)
    const sup = campo?.superficie_ha || 0
    const monto = qq && precio && sup ? Math.round(qq * precio * sup) : null
    await supabase.from('vencimientos_arriendo').insert({
      campo_id, fecha_vencimiento: formVenc.fecha_vencimiento,
      qq_ha: qq || null, precio_pizarra: precio || null,
      monto_total: monto, estado: 'pendiente',
      observaciones: formVenc.observaciones || null,
    })
    await cargarVencimientos()
    setShowForm(null)
    setFormVenc({ fecha_vencimiento: '', qq_ha: '', precio_pizarra: '', observaciones: '' })
    setGuardando(false)
  }

  async function pagarArriendo(v) {
    const totalPagos = formPago.pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
    if (!totalPagos) { alert('Ingresá el monto del pago'); return }
    setGuardandoPago(true)
    const precio = parseFloat(formPago.precio_pizarra) || null
    const meses = formPago.meses || 1
    const qqMes = (campo?.arrendamiento_qq_ha || 0) / 12
    const sup = campo?.superficie_ha || null
    const montoCalc = precio && qqMes && sup ? Math.round(precio * qqMes * meses * sup) : null
    const qqPagado = qqMes * meses

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
      } else if (pago.subtipo_cheque === 'tercero' && pago.cheque_tercero_id) {
        await supabase.from('cheques').update({ estado: 'depositado' }).eq('id', parseInt(pago.cheque_tercero_id))
      }
    }

    await supabase.from('vencimientos_arriendo').update({
      estado: 'pagado', pagado_en: formPago.fecha,
      precio_pizarra: precio || null,
      qq_ha: qqPagado || null,
      monto_total: montoCalc || totalPagos,
      caja_oficial_id, caja_paralela_id,
      pagos_detalle: formPago.pagos,
      forma_pago: formPago.pagos.map(p => p.subtipo_cheque || p.tipo).join('+'),
    }).eq('id', v.id)

    const pagosFinal = [...formPago.pagos]
    const fechaPago = formPago.fecha
    setPagoAbierto(null)
    setFormPago({ fecha: new Date().toISOString().split('T')[0], precio_pizarra: '', meses: 1, pagos: [{ ...PAGO_INIT_ARR }] })
    setGuardandoPago(false)
    await cargarVencimientos()
    await cargar()
    generarReciboArriendo({ ...v, pagado_en: fechaPago, pagos_detalle: pagosFinal }, campo, pagosFinal)
  }

  if (loading) return <div style={{ padding: '2rem', color: S.hint }}>Cargando...</div>

  const hoy = new Date()
  const en7dias = new Date(hoy.getTime() + 7 * 86400000)

  // Calcular próximos vencimientos automáticos por campo
  const proximosAutomaticos = campos.filter(c => c.arrendamiento_qq_ha && c.dia_vencimiento_arriendo).map(c => {
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
      yaRegistrado: vencimientos.some(v => v.campo_id === c.id && v.fecha_vencimiento === fecha.toISOString().split('T')[0])
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

      {campos.filter(c => c.arrendamiento_qq_ha).map(campo => {
        const vencsCampo = vencimientos.filter(v => v.campo_id === campo.id)
        return (
          <div key={campo.id} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{campo.nombre}</div>
                <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>
                  {campo.propietario} · {campo.superficie_ha} ha · {campo.arrendamiento_qq_ha} qq soja/ha/año
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
                  <div><Label>qq/ha</Label><input type="number" value={formVenc.qq_ha} onChange={e => setFormVenc({...formVenc, qq_ha: e.target.value})} style={inputStyle} placeholder={String(campo.arrendamiento_qq_ha || '')} /></div>
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
                          {v.qq_ha} qq/ha · ${v.precio_pizarra?.toLocaleString('es-AR')}/qq
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
                          : <button onClick={() => { setPagoAbierto(isPagoAbierto ? null : v.id); setFormPago({ fecha: new Date().toISOString().split('T')[0], precio_pizarra: '', meses: 1, pagos: [{ ...PAGO_INIT_ARR, monto: '' }] }) }}
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
                          Pago arriendo — {campo.nombre} · {campo.arrendamiento_qq_ha} qq/ha/año · {campo.superficie_ha} ha
                        </div>
                        {/* Meses + Precio pizarra */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                          <div>
                            <Label>Meses a pagar</Label>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                              {[1,2,3,6,12].map(m => (
                                <button key={m} onClick={() => {
                                  const pp = parseFloat(formPago.precio_pizarra) || 0
                                  const qqMes = (campo.arrendamiento_qq_ha || 0) / 12
                                  const sup = campo.superficie_ha || 0
                                  const monto = pp && qqMes && sup ? String(Math.round(pp * qqMes * m * sup)) : ''
                                  setFormPago({...formPago, meses: m, pagos: formPago.pagos.map((p, i) => i === 0 ? {...p, monto} : p)})
                                }}
                                  style={{ padding: '5px 10px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer', border: `1px solid ${formPago.meses === m ? S.accent : S.border}`, background: formPago.meses === m ? S.accentLight : S.surface, color: formPago.meses === m ? S.accent : S.muted }}>
                                  {m === 1 ? '1 mes' : m === 12 ? '1 año' : `${m} meses`}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <Label>Precio pizarra Rosario $/qq</Label>
                            <input type="number" value={formPago.precio_pizarra} onChange={e => {
                              const pp = e.target.value
                              const meses = formPago.meses || 1
                              const qqMes = (campo.arrendamiento_qq_ha || 0) / 12
                              const sup = campo.superficie_ha || 0
                              const monto = pp && qqMes && sup ? String(Math.round(parseFloat(pp) * qqMes * meses * sup)) : ''
                              setFormPago({...formPago, precio_pizarra: pp, pagos: formPago.pagos.map((p, i) => i === 0 ? {...p, monto} : p)})
                            }} style={inputStyle} placeholder="ej. 380000" />
                          </div>
                          <div>
                            <Label>Monto calculado</Label>
                            <div style={{ padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 14, fontFamily: 'monospace', fontWeight: 700, background: S.surface, color: S.green }}>
                              {formPago.precio_pizarra && formPago.meses && campo.arrendamiento_qq_ha && campo.superficie_ha
                                ? `$${Math.round(parseFloat(formPago.precio_pizarra) * (campo.arrendamiento_qq_ha / 12) * formPago.meses * campo.superficie_ha).toLocaleString('es-AR')}`
                                : '—'}
                            </div>
                            {formPago.meses && campo.arrendamiento_qq_ha && (
                              <div style={{ fontSize: 10, color: S.muted, marginTop: 3 }}>
                                {(campo.arrendamiento_qq_ha / 12 * formPago.meses).toFixed(2)} qq/ha × {campo.superficie_ha} ha
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ marginBottom: 10 }}>
                          <Label>Fecha de pago</Label>
                          <input type="date" value={formPago.fecha} onChange={e => setFormPago({...formPago, fecha: e.target.value})} style={{ ...inputStyle, maxWidth: 200 }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase' }}>Formas de pago</div>
                          <button onClick={() => setFormPago({...formPago, pagos: [...formPago.pagos, { ...PAGO_INIT_ARR }]})} style={{ padding: '4px 10px', fontSize: 11, background: 'transparent', border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>+ Agregar</button>
                        </div>
                        {formPago.pagos.map((pago, idx) => (
                          <div key={idx} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 7, padding: '8px', marginBottom: 6 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 8, alignItems: 'flex-end', marginBottom: pago.tipo === 'e-cheq' ? 8 : 0 }}>
                              <div><Label>Forma de pago</Label>
                                <select value={pago.tipo} onChange={e => { const n = formPago.pagos.map((p,i) => i===idx ? {...p, tipo: e.target.value, subtipo_cheque: ''} : p); setFormPago({...formPago, pagos: n}) }} style={inputStyle}>
                                  <option value="transferencia">Transferencia</option>
                                  <option value="efectivo">Efectivo</option>
                                  <option value="e-cheq">E-cheq</option>
                                  <option value="cuenta_corriente">Cuenta corriente</option>
                                </select>
                              </div>
                              <div><Label>Monto $</Label>
                                <input type="number" value={pago.monto} onChange={e => { const n = formPago.pagos.map((p,i) => i===idx ? {...p, monto: e.target.value} : p); setFormPago({...formPago, pagos: n}) }} style={inputStyle} />
                              </div>
                              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#3D1A6B', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                  <input type="checkbox" checked={pago.es_paralelo} onChange={e => { const n = formPago.pagos.map((p,i) => i===idx ? {...p, es_paralelo: e.target.checked} : p); setFormPago({...formPago, pagos: n}) }} />
                                  Paralelo
                                </label>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                                {formPago.pagos.length > 1 && <button onClick={() => setFormPago({...formPago, pagos: formPago.pagos.filter((_,i)=>i!==idx)})} style={{ padding: '5px 8px', fontSize: 10, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 4, cursor: 'pointer' }}>✕</button>}
                              </div>
                            </div>
                            {pago.tipo === 'e-cheq' && (
                              <div style={{ marginTop: 8 }}>
                                <div style={{ display: 'flex', gap: 8, marginBottom: pago.subtipo_cheque ? 8 : 0 }}>
                                  {(pago.es_paralelo ? ['tercero'] : ['propio', 'tercero']).map(t => (
                                    <button key={t} onClick={() => { const n = formPago.pagos.map((p,i) => i===idx ? {...p, subtipo_cheque: p.subtipo_cheque===t?'':t} : p); setFormPago({...formPago, pagos: n}) }}
                                      style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 5, cursor: 'pointer', border: `1px solid ${pago.subtipo_cheque===t ? S.accent : S.border}`, background: pago.subtipo_cheque===t ? S.accentLight : 'transparent', color: pago.subtipo_cheque===t ? S.accent : S.muted }}>
                                      {t === 'propio' ? '📤 Propio' : '📥 Tercero'}
                                    </button>
                                  ))}
                                </div>
                                {pago.subtipo_cheque === 'propio' && (
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
                                    <div><Label>N° cheque</Label><input type="text" value={pago.cheque_propio.numero} onChange={e => { const n = formPago.pagos.map((p,i) => i===idx ? {...p, cheque_propio: {...p.cheque_propio, numero: e.target.value}} : p); setFormPago({...formPago, pagos: n}) }} style={inputStyle} /></div>
                                    <div><Label>Banco</Label><input type="text" value={pago.cheque_propio.banco} onChange={e => { const n = formPago.pagos.map((p,i) => i===idx ? {...p, cheque_propio: {...p.cheque_propio, banco: e.target.value}} : p); setFormPago({...formPago, pagos: n}) }} style={inputStyle} /></div>
                                    <div><Label>Vencimiento *</Label><input type="date" value={pago.cheque_propio.fecha_vencimiento} onChange={e => { const n = formPago.pagos.map((p,i) => i===idx ? {...p, cheque_propio: {...p.cheque_propio, fecha_vencimiento: e.target.value}} : p); setFormPago({...formPago, pagos: n}) }} style={{ ...inputStyle, borderColor: S.amber }} /></div>
                                  </div>
                                )}
                                {pago.subtipo_cheque === 'tercero' && (
                                  <div style={{ marginTop: 8 }}>
                                    {(() => {
                                      const lista = chequesCartera.filter(ch => pago.es_paralelo ? ch.es_paralelo : !ch.es_paralelo)
                                      return lista.length === 0
                                        ? <div style={{ fontSize: 12, color: S.hint }}>No hay cheques en cartera.</div>
                                        : lista.map(ch => (
                                          <label key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', border: `1px solid ${pago.cheque_tercero_id===String(ch.id) ? S.accent : S.border}`, borderRadius: 5, background: pago.cheque_tercero_id===String(ch.id) ? S.accentLight : S.surface, cursor: 'pointer', marginBottom: 4 }}>
                                            <input type="radio" name={`cheq_arr_${idx}_${v.id}`} value={ch.id} checked={pago.cheque_tercero_id===String(ch.id)} onChange={() => { const n = formPago.pagos.map((p,i) => i===idx ? {...p, cheque_tercero_id: String(ch.id)} : p); setFormPago({...formPago, pagos: n}) }} />
                                            <span style={{ fontSize: 12 }}><strong>${ch.monto?.toLocaleString('es-AR')}</strong> · #{ch.numero||'sin nro'} · {ch.banco||'—'} · vence {ch.fecha_vencimiento ? new Date(ch.fecha_vencimiento+'T12:00:00').toLocaleDateString('es-AR') : '—'}</span>
                                          </label>
                                        ))
                                    })()}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
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
      {campos.filter(c => c.arrendamiento_qq_ha).length === 0 && (
        <div style={{ fontSize: 13, color: S.hint, padding: '2rem', textAlign: 'center' }}>No hay campos con arrendamiento configurado. Cargá el qq/ha en la sección Campos.</div>
      )}
    </div>
  )
}


function TabStockAgro({ stock, ingresos, contactos, cargar, usuario }) {
  const [tab, setTab] = useState('stock')
  const [showForm, setShowForm] = useState(false)
  const [editandoStock, setEditandoStock] = useState(null)
  const [formStock, setFormStock] = useState({ insumo: '', tipo: '', cantidad: '', unidad: 'litros', minimo_stock: '' })
  const [showFormCompra, setShowFormCompra] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [pagarAhora, setPagarAhora] = useState(true)
  const [showPagosPend, setShowPagosPend] = useState(false)
  const [seleccionadas, setSeleccionadas] = useState([])
  const [formPagoGrupal, setFormPagoGrupal] = useState({ fecha: new Date().toISOString().split('T')[0], pagos: [{ ...PAGO_INIT_AGRO }] })
  const [guardandoPago, setGuardandoPago] = useState(false)
  const [chequesCartera, setChequesCartera] = useState([])
  const [formCompra, setFormCompra] = useState({
    agroquimico_id: '', insumo_nombre: '', cantidad: '', precio_unitario: '', total: '',
    fecha: new Date().toISOString().split('T')[0], proveedor: '',
    domicilio: '', localidad: '', cuit: '', iva: '', cbu: '',
    numero_factura: '', observaciones: '', pagos: [{ ...PAGO_INIT_AGRO }],
  })

  const TIPOS = ['Herbicida', 'Fungicida', 'Insecticida', 'Fertilizante', 'Coadyuvante', 'Semilla', 'Otro']
  const UNIDADES = ['litros', 'kg', 'bolsas', 'unidades']

  useEffect(() => {
    supabase.from('cheques').select('*').eq('tipo', 'recibido').eq('estado', 'en_cartera').order('fecha_vencimiento', { ascending: true })
      .then(({ data }) => setChequesCartera(data || []))
  }, [])

  async function guardarStock() {
    if (!formStock.insumo) { alert('Ingresá el nombre'); return }
    setGuardando(true)
    const data = { insumo: formStock.insumo, tipo: formStock.tipo || null, cantidad: parseFloat(formStock.cantidad) || 0, unidad: formStock.unidad, minimo_stock: parseFloat(formStock.minimo_stock) || 0, actualizado_en: new Date().toISOString() }
    if (editandoStock) await supabase.from('stock_agro').update(data).eq('id', editandoStock)
    else await supabase.from('stock_agro').insert(data)
    await cargar()
    setShowForm(false); setEditandoStock(null)
    setFormStock({ insumo: '', tipo: '', cantidad: '', unidad: 'litros', minimo_stock: '' })
    setGuardando(false)
  }

  async function guardarCompra() {
    if (!formCompra.agroquimico_id || !formCompra.cantidad || !formCompra.precio_unitario) { alert('Completá insumo, cantidad y precio'); return }
    const cantidad = parseFloat(formCompra.cantidad)
    const precioUnit = parseFloat(formCompra.precio_unitario)
    const total = formCompra.total ? parseFloat(formCompra.total) : Math.round(cantidad * precioUnit)
    const totalPagos = formCompra.pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
    if (pagarAhora && Math.abs(total - totalPagos) > 0.5) { alert(`El total de pagos ($${totalPagos.toLocaleString('es-AR')}) no coincide con el monto ($${total.toLocaleString('es-AR')})`); return }
    setGuardando(true)

    let caja_oficial_id = null, caja_paralela_id = null
    const desc = `Compra ${formCompra.insumo_nombre}${formCompra.proveedor ? ` — ${formCompra.proveedor}` : ''}`

    if (pagarAhora) for (const pago of formCompra.pagos) {
      const monto = parseFloat(pago.monto) || 0
      if (!monto) continue
      const formaPago = pago.subtipo_cheque ? 'e-cheq' : pago.tipo
      if (pago.es_paralelo) {
        const { data: cp } = await supabase.from('caja_paralela').insert({ fecha: formCompra.fecha, tipo: 'egreso', descripcion: desc, monto }).select().single()
        if (!caja_paralela_id) caja_paralela_id = cp?.id || null
      } else {
        const { data: co } = await supabase.from('caja_oficial').insert({ fecha: formCompra.fecha, tipo: 'egreso', categoria: 'Compra agroquímicos', descripcion: desc, monto, forma_pago: formaPago }).select().single()
        if (!caja_oficial_id) caja_oficial_id = co?.id || null
      }
      if (!pago.es_paralelo && pago.subtipo_cheque === 'propio') {
        await supabase.from('cheques').insert({ tipo: 'emitido', numero: pago.cheque_propio.numero || null, banco: pago.cheque_propio.banco || null, fecha_cobro: formCompra.fecha, fecha_vencimiento: pago.cheque_propio.fecha_vencimiento, monto, beneficiario: formCompra.proveedor || null, estado: 'en_cartera', caja_oficial_id, registrado_por: usuario?.id })
      } else if (pago.subtipo_cheque === 'tercero' && pago.cheque_tercero_id) {
        await supabase.from('cheques').update({ estado: 'depositado' }).eq('id', parseInt(pago.cheque_tercero_id))
      }
    }

    await supabase.from('ingresos_agroquimicos').insert({
      agroquimico_id: parseInt(formCompra.agroquimico_id), cantidad, precio_unitario: precioUnit, total,
      proveedor: formCompra.proveedor || null, domicilio: formCompra.domicilio || null, localidad: formCompra.localidad || null,
      cuit: formCompra.cuit || null, iva: formCompra.iva || null, cbu: formCompra.cbu || null,
      numero_factura: formCompra.numero_factura || null, observaciones: formCompra.observaciones || null,
      forma_pago: formCompra.pagos.map(p => p.subtipo_cheque || p.tipo).join('+'),
      es_paralelo: formCompra.pagos.some(p => p.es_paralelo),
      pagos_detalle: formCompra.pagos, fecha: formCompra.fecha,
      caja_oficial_id, caja_paralela_id, registrado_por: usuario?.id,
      estado_pago: pagarAhora ? 'pagado' : 'pendiente',
    })

    // Actualizar stock
    const item = stock.find(s => s.id === parseInt(formCompra.agroquimico_id))
    if (item) {
      await supabase.from('stock_agro').update({ cantidad: (item.cantidad || 0) + cantidad, precio_referencia: precioUnit, actualizado_en: new Date().toISOString() }).eq('id', item.id)
    }

    setShowFormCompra(false)
    setFormCompra({ agroquimico_id: '', insumo_nombre: '', cantidad: '', precio_unitario: '', total: '', fecha: new Date().toISOString().split('T')[0], proveedor: '', domicilio: '', localidad: '', cuit: '', iva: '', cbu: '', numero_factura: '', observaciones: '', pagos: [{ ...PAGO_INIT_AGRO }] })
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
        const pendientes = ingresos.filter(i => i.estado_pago === 'pendiente' && i.total)
        if (pendientes.length === 0) return null
        const totalSel = seleccionadas.reduce((s, id) => { const i = pendientes.find(x => x.id === id); return s + (i?.total || 0) }, 0)
        const totalPagGrupal = formPagoGrupal.pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)

        async function pagarSeleccionadas() {
          if (seleccionadas.length === 0) { alert('Seleccioná al menos una compra'); return }
          if (Math.abs(totalSel - totalPagGrupal) > 0.5) { alert(`El total de pagos no coincide`); return }
          setGuardandoPago(true)
          let caja_oficial_id = null, caja_paralela_id = null
          const desc = `Pago compras agroquímicos`
          for (const pago of formPagoGrupal.pagos) {
            const monto = parseFloat(pago.monto) || 0
            if (!monto) continue
            const fp = pago.subtipo_cheque ? 'e-cheq' : pago.tipo
            if (pago.es_paralelo) {
              const { data: cp } = await supabase.from('caja_paralela').insert({ fecha: formPagoGrupal.fecha, tipo: 'egreso', descripcion: desc, monto }).select().single()
              if (!caja_paralela_id) caja_paralela_id = cp?.id || null
            } else {
              const { data: co } = await supabase.from('caja_oficial').insert({ fecha: formPagoGrupal.fecha, tipo: 'egreso', categoria: 'Compra agroquímicos', descripcion: desc, monto, forma_pago: fp }).select().single()
              if (!caja_oficial_id) caja_oficial_id = co?.id || null
            }
            if (!pago.es_paralelo && pago.subtipo_cheque === 'propio') {
              await supabase.from('cheques').insert({ tipo: 'emitido', numero: pago.cheque_propio.numero || null, banco: pago.cheque_propio.banco || null, fecha_cobro: formPagoGrupal.fecha, fecha_vencimiento: pago.cheque_propio.fecha_vencimiento, monto, estado: 'en_cartera', caja_oficial_id, registrado_por: usuario?.id })
            } else if (pago.subtipo_cheque === 'tercero' && pago.cheque_tercero_id) {
              await supabase.from('cheques').update({ estado: 'depositado' }).eq('id', parseInt(pago.cheque_tercero_id))
            }
          }
          for (const id of seleccionadas) {
            await supabase.from('ingresos_agroquimicos').update({ estado_pago: 'pagado', caja_oficial_id, caja_paralela_id }).eq('id', id)
          }
          setSeleccionadas([])
          setShowPagosPend(false)
          const comprasPagadas = seleccionadas.map(id => ingresos.find(i => i.id === id)).filter(Boolean)
          setFormPagoGrupal({ fecha: new Date().toISOString().split('T')[0], pagos: [{ ...PAGO_INIT_AGRO }] })
          setGuardandoPago(false)
          await cargar()
          generarReciboAgro(comprasPagadas, formPagoGrupal.pagos, stock)
        }

        return (
          <div style={{ background: S.amberLight, border: '1px solid #EF9F27', borderRadius: 10, padding: '1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: S.amber }}>
                ⏳ {pendientes.length} compra{pendientes.length !== 1 ? 's' : ''} pendiente{pendientes.length !== 1 ? 's' : ''} de pago · ${pendientes.reduce((s,i)=>s+(i.total||0),0).toLocaleString('es-AR')}
              </div>
              <button onClick={() => setShowPagosPend(!showPagosPend)}
                style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, background: S.amber, border: `1px solid ${S.amber}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                {showPagosPend ? 'Cerrar' : 'Registrar pago'}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: showPagosPend ? '1rem' : 0 }}>
              {pendientes.map(i => (
                <label key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: `1px solid ${seleccionadas.includes(i.id) ? '#EF9F27' : S.border}`, borderRadius: 6, background: seleccionadas.includes(i.id) ? '#FFF8EC' : S.surface, cursor: 'pointer' }}>
                  <input type="checkbox" checked={seleccionadas.includes(i.id)} onChange={e => setSeleccionadas(e.target.checked ? [...seleccionadas, i.id] : seleccionadas.filter(id => id !== i.id))} />
                  <div style={{ flex: 1, fontSize: 13 }}>
                    <strong>{i.stock_agro?.insumo || '—'}</strong>
                    <span style={{ color: S.muted, marginLeft: 8 }}>{i.cantidad?.toLocaleString('es-AR')} {i.stock_agro?.unidad} · {i.fecha ? new Date(i.fecha+'T12:00:00').toLocaleDateString('es-AR') : '—'}</span>
                    {i.proveedor && <span style={{ color: S.muted, marginLeft: 8 }}>· {i.proveedor}</span>}
                  </div>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: S.red }}>${i.total?.toLocaleString('es-AR')}</span>
                </label>
              ))}
            </div>
            {showPagosPend && seleccionadas.length > 0 && (
              <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: '1rem' }}>
                  Pagar {seleccionadas.length} compra{seleccionadas.length !== 1 ? 's' : ''} · <span style={{ fontFamily: 'monospace', color: S.red }}>${totalSel.toLocaleString('es-AR')}</span>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <Label>Fecha de pago</Label>
                  <input type="date" value={formPagoGrupal.fecha} onChange={e => setFormPagoGrupal({...formPagoGrupal, fecha: e.target.value})} style={{ ...inputStyle, maxWidth: 200 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase' }}>Formas de pago</div>
                  <button onClick={() => setFormPagoGrupal({...formPagoGrupal, pagos: [...formPagoGrupal.pagos, { ...PAGO_INIT_AGRO }]})} style={{ padding: '4px 10px', fontSize: 11, background: 'transparent', border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>+ Agregar</button>
                </div>
                {formPagoGrupal.pagos.map((pago, idx) => (
                  <div key={idx} style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 7, padding: '8px', marginBottom: 6 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 8, alignItems: 'flex-end' }}>
                      <div><Label>Forma</Label>
                        <select value={pago.tipo} onChange={e => { const n = formPagoGrupal.pagos.map((p,i) => i===idx ? {...p, tipo: e.target.value, subtipo_cheque: ''} : p); setFormPagoGrupal({...formPagoGrupal, pagos: n}) }} style={inputStyle}>
                          <option value="transferencia">Transferencia</option>
                          <option value="efectivo">Efectivo</option>
                          <option value="e-cheq">E-cheq</option>
                          <option value="cuenta_corriente">Cuenta corriente</option>
                        </select>
                      </div>
                      <div><Label>Monto $</Label>
                        <input type="number" value={pago.monto} onChange={e => { const n = formPagoGrupal.pagos.map((p,i) => i===idx ? {...p, monto: e.target.value} : p); setFormPagoGrupal({...formPagoGrupal, pagos: n}) }} style={inputStyle} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#3D1A6B', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <input type="checkbox" checked={pago.es_paralelo} onChange={e => { const n = formPagoGrupal.pagos.map((p,i) => i===idx ? {...p, es_paralelo: e.target.checked} : p); setFormPagoGrupal({...formPagoGrupal, pagos: n}) }} />
                          Paralelo
                        </label>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                        {formPagoGrupal.pagos.length > 1 && <button onClick={() => setFormPagoGrupal({...formPagoGrupal, pagos: formPagoGrupal.pagos.filter((_,i)=>i!==idx)})} style={{ padding: '5px 8px', fontSize: 10, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 4, cursor: 'pointer' }}>✕</button>}
                      </div>
                    </div>
                    {pago.tipo === 'e-cheq' && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ display: 'flex', gap: 8, marginBottom: pago.subtipo_cheque ? 8 : 0 }}>
                          {(pago.es_paralelo ? ['tercero'] : ['propio', 'tercero']).map(t => (
                            <button key={t} onClick={() => { const n = formPagoGrupal.pagos.map((p,i) => i===idx ? {...p, subtipo_cheque: p.subtipo_cheque===t?'':t} : p); setFormPagoGrupal({...formPagoGrupal, pagos: n}) }}
                              style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 5, cursor: 'pointer', border: `1px solid ${pago.subtipo_cheque===t ? S.accent : S.border}`, background: pago.subtipo_cheque===t ? S.accentLight : 'transparent', color: pago.subtipo_cheque===t ? S.accent : S.muted }}>
                              {t === 'propio' ? '📤 Propio' : '📥 Tercero'}
                            </button>
                          ))}
                        </div>
                        {pago.subtipo_cheque === 'propio' && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
                            <div><Label>N° cheque</Label><input type="text" value={pago.cheque_propio.numero} onChange={e => { const n = formPagoGrupal.pagos.map((p,i) => i===idx ? {...p, cheque_propio: {...p.cheque_propio, numero: e.target.value}} : p); setFormPagoGrupal({...formPagoGrupal, pagos: n}) }} style={inputStyle} /></div>
                            <div><Label>Banco</Label><input type="text" value={pago.cheque_propio.banco} onChange={e => { const n = formPagoGrupal.pagos.map((p,i) => i===idx ? {...p, cheque_propio: {...p.cheque_propio, banco: e.target.value}} : p); setFormPagoGrupal({...formPagoGrupal, pagos: n}) }} style={inputStyle} /></div>
                            <div><Label>Vencimiento</Label><input type="date" value={pago.cheque_propio.fecha_vencimiento} onChange={e => { const n = formPagoGrupal.pagos.map((p,i) => i===idx ? {...p, cheque_propio: {...p.cheque_propio, fecha_vencimiento: e.target.value}} : p); setFormPagoGrupal({...formPagoGrupal, pagos: n}) }} style={{ ...inputStyle, borderColor: S.amber }} /></div>
                          </div>
                        )}
                        {pago.subtipo_cheque === 'tercero' && (
                          <div style={{ marginTop: 8 }}>
                            {(() => {
                              const lista = chequesCartera.filter(ch => pago.es_paralelo ? ch.es_paralelo : !ch.es_paralelo)
                              return lista.length === 0
                                ? <div style={{ fontSize: 12, color: S.hint }}>No hay cheques en cartera.</div>
                                : lista.map(ch => (
                                  <label key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', border: `1px solid ${pago.cheque_tercero_id===String(ch.id) ? S.accent : S.border}`, borderRadius: 5, background: pago.cheque_tercero_id===String(ch.id) ? S.accentLight : S.surface, cursor: 'pointer', marginBottom: 4 }}>
                                    <input type="radio" name={`cheq_grp_agro_${idx}`} value={ch.id} checked={pago.cheque_tercero_id===String(ch.id)} onChange={() => { const n = formPagoGrupal.pagos.map((p,i) => i===idx ? {...p, cheque_tercero_id: String(ch.id)} : p); setFormPagoGrupal({...formPagoGrupal, pagos: n}) }} />
                                    <span style={{ fontSize: 12 }}><strong>${ch.monto?.toLocaleString('es-AR')}</strong> · #{ch.numero||'sin nro'} · {ch.banco||'—'} · vence {ch.fecha_vencimiento ? new Date(ch.fecha_vencimiento+'T12:00:00').toLocaleDateString('es-AR') : '—'}</span>
                                  </label>
                                ))
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <div style={{ background: Math.abs(totalSel-totalPagGrupal) < 0.5 ? S.greenLight : S.amberLight, border: `1px solid ${Math.abs(totalSel-totalPagGrupal) < 0.5 ? '#97C459' : '#EF9F27'}`, borderRadius: 6, padding: '8px 12px', fontSize: 13, marginBottom: 10 }}>
                  Total: <strong>${totalSel.toLocaleString('es-AR')}</strong> · Pagos: <strong>${totalPagGrupal.toLocaleString('es-AR')}</strong>
                  {Math.abs(totalSel-totalPagGrupal) >= 0.5 && <span style={{ marginLeft: 12, color: S.amber, fontWeight: 600 }}>Diferencia: ${(totalSel-totalPagGrupal).toLocaleString('es-AR')}</span>}
                </div>
                <button onClick={pagarSeleccionadas} disabled={guardandoPago}
                  style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                  {guardandoPago ? 'Registrando...' : `💾 Pagar ${seleccionadas.length} compra${seleccionadas.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            )}
          </div>
        )
      })()}

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
          <button onClick={() => { setShowForm(!showForm); setShowFormCompra(false); setEditandoStock(null); setFormStock({ insumo: '', tipo: '', cantidad: '', unidad: 'litros', minimo_stock: '' }) }}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
            + Nuevo insumo
          </button>
        </div>
      </div>

      {/* Banner sin precio */}
      {sinPrecio.length > 0 && (
        <div style={{ background: S.amberLight, border: '1px solid #EF9F27', borderRadius: 8, padding: '1rem', marginBottom: '1rem', fontSize: 13, color: S.amber }}>
          ⚠ {sinPrecio.length} ingreso{sinPrecio.length !== 1 ? 's' : ''} sin precio — registrá la compra para asignarlo
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
                setFormCompra({...formCompra, agroquimico_id: e.target.value, insumo_nombre: item?.insumo || ''})
              }} style={inputStyle}>
                <option value="">— Seleccioná —</option>
                {stock.map(s => <option key={s.id} value={s.id}>{s.insumo} ({s.unidad})</option>)}
              </select>
            </div>
            <div><Label>Cantidad</Label><input type="number" value={formCompra.cantidad} onChange={e => { const c = e.target.value; const t = c && formCompra.precio_unitario ? String(Math.round(parseFloat(c) * parseFloat(formCompra.precio_unitario))) : formCompra.total; setFormCompra({...formCompra, cantidad: c, total: t}) }} style={inputStyle} /></div>
            <div><Label>Precio unitario $</Label><input type="number" value={formCompra.precio_unitario} onChange={e => { const p = e.target.value; const t = p && formCompra.cantidad ? String(Math.round(parseFloat(formCompra.cantidad) * parseFloat(p))) : formCompra.total; setFormCompra({...formCompra, precio_unitario: p, total: t}) }} style={inputStyle} /></div>
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

          {/* Formas de pago */}
          {pagarAhora && <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase' }}>Formas de pago</div>
              <button onClick={() => setFormCompra({...formCompra, pagos: [...formCompra.pagos, { ...PAGO_INIT_AGRO }]})}
                style={{ padding: '4px 12px', fontSize: 12, background: 'transparent', border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 6, cursor: 'pointer' }}>+ Agregar</button>
            </div>
            {formCompra.pagos.map((pago, idx) => (
              <div key={idx} style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '10px', marginBottom: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 8, alignItems: 'flex-end', marginBottom: pago.tipo === 'e-cheq' ? 8 : 0 }}>
                  <div>
                    <Label>Forma de pago</Label>
                    <select value={pago.tipo} onChange={e => { const n = formCompra.pagos.map((p,i) => i===idx ? {...p, tipo: e.target.value, subtipo_cheque: ''} : p); setFormCompra({...formCompra, pagos: n}) }} style={inputStyle}>
                      <option value="transferencia">Transferencia</option>
                      <option value="efectivo">Efectivo</option>
                      <option value="e-cheq">E-cheq</option>
                      <option value="cuenta_corriente">Cuenta corriente</option>
                    </select>
                  </div>
                  <div>
                    <Label>Monto $</Label>
                    <input type="number" value={pago.monto} onChange={e => { const n = formCompra.pagos.map((p,i) => i===idx ? {...p, monto: e.target.value} : p); setFormCompra({...formCompra, pagos: n}) }} style={inputStyle} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#3D1A6B', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <input type="checkbox" checked={pago.es_paralelo} onChange={e => { const n = formCompra.pagos.map((p,i) => i===idx ? {...p, es_paralelo: e.target.checked} : p); setFormCompra({...formCompra, pagos: n}) }} />
                      Paralelo
                    </label>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                    {formCompra.pagos.length > 1 && (
                      <button onClick={() => setFormCompra({...formCompra, pagos: formCompra.pagos.filter((_,i) => i!==idx)})}
                        style={{ padding: '6px 10px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>✕</button>
                    )}
                  </div>
                </div>
                {pago.tipo === 'e-cheq' && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: pago.subtipo_cheque ? 8 : 0 }}>
                      {(pago.es_paralelo ? ['tercero'] : ['propio', 'tercero']).map(t => (
                        <button key={t} onClick={() => { const n = formCompra.pagos.map((p,i) => i===idx ? {...p, subtipo_cheque: p.subtipo_cheque===t ? '' : t} : p); setFormCompra({...formCompra, pagos: n}) }}
                          style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer', border: `1px solid ${pago.subtipo_cheque===t ? S.accent : S.border}`, background: pago.subtipo_cheque===t ? S.accentLight : 'transparent', color: pago.subtipo_cheque===t ? S.accent : S.muted }}>
                          {t === 'propio' ? '📤 Propio' : '📥 Tercero'}
                        </button>
                      ))}
                    </div>
                    {pago.subtipo_cheque === 'propio' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
                        <div><Label>N° cheque</Label><input type="text" value={pago.cheque_propio.numero} onChange={e => { const n = formCompra.pagos.map((p,i) => i===idx ? {...p, cheque_propio: {...p.cheque_propio, numero: e.target.value}} : p); setFormCompra({...formCompra, pagos: n}) }} style={inputStyle} /></div>
                        <div><Label>Banco</Label><input type="text" value={pago.cheque_propio.banco} onChange={e => { const n = formCompra.pagos.map((p,i) => i===idx ? {...p, cheque_propio: {...p.cheque_propio, banco: e.target.value}} : p); setFormCompra({...formCompra, pagos: n}) }} style={inputStyle} /></div>
                        <div><Label>Vencimiento *</Label><input type="date" value={pago.cheque_propio.fecha_vencimiento} onChange={e => { const n = formCompra.pagos.map((p,i) => i===idx ? {...p, cheque_propio: {...p.cheque_propio, fecha_vencimiento: e.target.value}} : p); setFormCompra({...formCompra, pagos: n}) }} style={{ ...inputStyle, borderColor: S.amber }} /></div>
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
                                <input type="radio" name={`cheq_agro_${idx}`} value={ch.id} checked={pago.cheque_tercero_id === String(ch.id)} onChange={() => { const n = formCompra.pagos.map((p,i) => i===idx ? {...p, cheque_tercero_id: String(ch.id)} : p); setFormCompra({...formCompra, pagos: n}) }} />
                                <div style={{ fontSize: 13 }}><strong>${ch.monto?.toLocaleString('es-AR')}</strong><span style={{ color: S.muted, marginLeft: 8 }}>#{ch.numero || 'sin nro'} · {ch.banco || '—'} · vence {ch.fecha_vencimiento ? new Date(ch.fecha_vencimiento+'T12:00:00').toLocaleDateString('es-AR') : '—'}</span></div>
                              </label>
                            ))
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
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
        <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: S.bg }}>
              {['Insumo', 'Tipo', 'Stock', 'Unidad', 'Precio ref.', 'Mínimo', 'Estado', ''].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 10, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {stock.length === 0 && <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay insumos cargados.</td></tr>}
              {stock.map(s => {
                const bajo = s.minimo_stock > 0 && s.cantidad <= s.minimo_stock
                return (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${S.border}`, background: bajo ? S.redLight : 'transparent' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{s.insumo}</td>
                    <td style={{ padding: '8px 12px' }}>{s.tipo ? <span style={{ padding: '2px 8px', borderRadius: 4, background: S.accentLight, color: S.accent, fontSize: 11 }}>{s.tipo}</span> : '—'}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color: bajo ? S.red : S.green }}>{s.cantidad?.toLocaleString('es-AR')}</td>
                    <td style={{ padding: '8px 12px', color: S.muted }}>{s.unidad}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: S.muted }}>{s.precio_referencia ? `$${s.precio_referencia.toLocaleString('es-AR')}` : '—'}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, color: S.muted }}>{s.minimo_stock || '—'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      {bajo ? <span style={{ padding: '2px 8px', borderRadius: 4, background: S.redLight, color: S.red, fontSize: 11, fontWeight: 600 }}>⚠ Stock bajo</span>
                        : <span style={{ padding: '2px 8px', borderRadius: 4, background: S.greenLight, color: S.green, fontSize: 11 }}>OK</span>}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => { setEditandoStock(s.id); setFormStock({ insumo: s.insumo, tipo: s.tipo||'', cantidad: s.cantidad||'', unidad: s.unidad||'litros', minimo_stock: s.minimo_stock||'' }); setShowForm(true); setShowFormCompra(false) }}
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
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>{i.stock_agro?.insumo || '—'}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{i.cantidad?.toLocaleString('es-AR')} {i.stock_agro?.unidad || ''}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: S.muted }}>{i.precio_unitario ? `$${i.precio_unitario.toLocaleString('es-AR')}` : <span style={{ color: S.amber, fontSize: 11 }}>Pendiente</span>}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{i.total ? `$${i.total.toLocaleString('es-AR', { maximumFractionDigits: 0 })}` : '—'}</td>
                  <td style={{ padding: '8px 12px', color: S.muted }}>{i.proveedor || '—'}</td>
                  <td style={{ padding: '8px 12px', fontSize: 11 }}>{i.es_paralelo ? <span style={{ color: '#3D1A6B', fontWeight: 600 }}>Paralelo</span> : i.forma_pago || '—'}</td>
                  <td style={{ padding: '8px 12px' }}>
                    {i.estado_pago === 'pagado'
                      ? <span style={{ padding: '2px 8px', borderRadius: 4, background: S.greenLight, color: S.green, fontSize: 11, fontWeight: 600 }}>✓ Pagado</span>
                      : <span style={{ padding: '2px 8px', borderRadius: 4, background: S.amberLight, color: S.amber, fontSize: 11, fontWeight: 600 }}>⏳ Pendiente</span>}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {i.pagos_detalle && i.estado_pago === 'pagado' && (
                        <button onClick={() => generarReciboAgro(i, i.pagos_detalle, stock)}
                          style={{ padding: '3px 8px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>🖨️ Recibo</button>
                      )}
                      <button onClick={async () => {
                        if (!confirm('¿Eliminar esta compra? Se eliminará de la caja.')) return
                        if (i.caja_oficial_id) await supabase.from('caja_oficial').delete().eq('id', i.caja_oficial_id)
                        if (i.caja_paralela_id) await supabase.from('caja_paralela').delete().eq('id', i.caja_paralela_id)
                        const item = stock.find(s => s.id === i.agroquimico_id)
                        if (item) await supabase.from('stock_agro').update({ cantidad: Math.max(0, (item.cantidad || 0) - (i.cantidad || 0)), actualizado_en: new Date().toISOString() }).eq('id', item.id)
                        await supabase.from('ingresos_agroquimicos').delete().eq('id', i.id)
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
