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
}

const inputStyle = { width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: "'IBM Plex Sans', sans-serif", color: S.text }

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{children}</div>
}

function Card({ children, style = {} }) {
  return <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1rem', ...style }}>{children}</div>
}

const CATEGORIAS = ['Combustible', 'Electricidad', 'Impuestos', 'Reparaciones', 'Seguros', 'Honorarios', 'Veterinario', 'Comunicaciones', 'Rodados', 'Arriendo', 'Otro']

const CAT_COLORS = {
  Combustible: { bg: '#FDF0E0', color: '#7A4500' },
  Electricidad: { bg: '#FDF0E0', color: '#7A4500' },
  Impuestos: { bg: '#FDF0F0', color: '#7A1A1A' },
  Reparaciones: { bg: '#F0EAFB', color: '#3D1A6B' },
  Seguros: { bg: '#E8EFF8', color: '#1A3D6B' },
  Honorarios: { bg: '#E8EFF8', color: '#1A3D6B' },
  Veterinario: { bg: '#E8F4EB', color: '#1E5C2E' },
  default: { bg: '#F7F5F0', color: '#6B6760' },
}

export default function Gastos({ usuario }) {
  const [loading, setLoading] = useState(true)
  const [gastos, setGastos] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroAnio, setFiltroAnio] = useState(String(new Date().getFullYear()))

  const [form, setForm] = useState({
    categoria: 'Combustible', descripcion: '', monto: '',
    fecha: new Date().toISOString().split('T')[0],
    proveedor: '', comprobante: ''
  })

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const { data } = await supabase.from('gastos_generales').select('*').order('fecha', { ascending: false })
    setGastos(data || [])
    setLoading(false)
  }

  async function guardar() {
    if (!form.categoria || !form.monto) { alert('Completá categoría y monto'); return }
    setGuardando(true)
    await supabase.from('gastos_generales').insert({ ...form, monto: parseFloat(form.monto), registrado_por: usuario?.id })
    await cargar()
    setShowForm(false)
    setForm({ categoria: 'Combustible', descripcion: '', monto: '', fecha: new Date().toISOString().split('T')[0], proveedor: '', comprobante: '' })
    setGuardando(false)
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este gasto?')) return
    await supabase.from('gastos_generales').delete().eq('id', id)
    await cargar()
  }

  if (loading) return <Loader />

  const anio = parseInt(filtroAnio) || new Date().getFullYear()
  const gastosFiltrados = gastos.filter(g => {
    const matchAnio = new Date(g.fecha).getFullYear() === anio
    const matchCat = !filtroCategoria || g.categoria === filtroCategoria
    return matchAnio && matchCat
  })

  const totalAnio = gastosFiltrados.reduce((s, g) => s + (g.monto || 0), 0)

  // Agrupar por categoría
  const porCategoria = {}
  gastosFiltrados.forEach(g => {
    if (!porCategoria[g.categoria]) porCategoria[g.categoria] = 0
    porCategoria[g.categoria] += g.monto || 0
  })
  const catOrdenadas = Object.entries(porCategoria).sort((a, b) => b[1] - a[1])
  const maxCat = catOrdenadas.length > 0 ? catOrdenadas[0][1] : 1

  // Años disponibles
  const aniosDisponibles = [...new Set(gastos.map(g => new Date(g.fecha).getFullYear()))].sort((a, b) => b - a)
  if (!aniosDisponibles.includes(new Date().getFullYear())) aniosDisponibles.unshift(new Date().getFullYear())

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 3 }}>Gastos generales</div>
      <div style={{ fontSize: 12, color: S.muted, fontFamily: 'monospace', marginBottom: '1.5rem' }}>
        Combustible · impuestos · reparaciones · seguros · honorarios
      </div>

      {/* Filtros y acción */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: '1.25rem', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={filtroAnio} onChange={e => setFiltroAnio(e.target.value)}
            style={{ padding: '7px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface }}>
            {aniosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}
            style={{ padding: '7px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface }}>
            <option value="">Todas las categorías</option>
            {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          + Registrar gasto
        </button>
      </div>

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
        {[
          { label: `Total ${anio}`, val: `$${totalAnio.toLocaleString('es-AR')}`, color: S.red },
          { label: 'Registros filtrados', val: gastosFiltrados.length },
          { label: 'Categoría mayor gasto', val: catOrdenadas[0]?.[0] || '—' },
          { label: 'Promedio por mes', val: `$${Math.round(totalAnio / 12).toLocaleString('es-AR')}` },
        ].map((m, i) => (
          <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem' }}>
            <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>{m.label}</div>
            <div style={{ fontSize: m.val?.length > 8 ? 15 : 20, fontWeight: 700, fontFamily: 'monospace', color: m.color || S.text }}>{m.val}</div>
          </div>
        ))}
      </div>

      {/* Distribución por categoría */}
      {catOrdenadas.length > 0 && (
        <Card style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>Distribución por categoría</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div>
              {catOrdenadas.map(([cat, total]) => {
                const pct = Math.round(total / maxCat * 100)
                const cs = CAT_COLORS[cat] || CAT_COLORS.default
                return (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, cursor: 'pointer' }}
                    onClick={() => setFiltroCategoria(filtroCategoria === cat ? '' : cat)}>
                    <div style={{ fontSize: 12, color: S.muted, minWidth: 100 }}>{cat}</div>
                    <div style={{ flex: 1, height: 8, background: S.bg, borderRadius: 4, overflow: 'hidden', border: `1px solid ${S.border}` }}>
                      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: S.red, opacity: 0.7 }} />
                    </div>
                    <div style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: S.red, minWidth: 80, textAlign: 'right' }}>${total.toLocaleString('es-AR')}</div>
                    <div style={{ fontSize: 11, color: S.hint, minWidth: 35 }}>{Math.round(total / totalAnio * 100)}%</div>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignContent: 'start' }}>
              {catOrdenadas.map(([cat, total]) => {
                const cs = CAT_COLORS[cat] || CAT_COLORS.default
                return (
                  <div key={cat} style={{ background: cs.bg, borderRadius: 7, padding: '.75rem', cursor: 'pointer' }}
                    onClick={() => setFiltroCategoria(filtroCategoria === cat ? '' : cat)}>
                    <div style={{ fontSize: 11, color: cs.color, fontWeight: 600, marginBottom: 3 }}>{cat}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'monospace', color: cs.color }}>${total.toLocaleString('es-AR')}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      )}

      {showForm && (
        <Card>
          <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: '1rem' }}>Nuevo gasto</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '.75rem' }}>
            <div><Label>Categoría</Label>
              <select value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} style={inputStyle}>
                {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><Label>Monto $</Label><input type="number" value={form.monto} onChange={e => setForm({...form, monto: e.target.value})} style={inputStyle} /></div>
            <div><Label>Fecha</Label><input type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} style={inputStyle} /></div>
            <div><Label>Descripción</Label><input type="text" value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} style={inputStyle} /></div>
            <div><Label>Proveedor</Label><input type="text" value={form.proveedor} onChange={e => setForm({...form, proveedor: e.target.value})} style={inputStyle} /></div>
            <div><Label>N° comprobante</Label><input type="text" value={form.comprobante} onChange={e => setForm({...form, comprobante: e.target.value})} style={inputStyle} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
            <button onClick={guardar} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </Card>
      )}

      <Card>
        <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>
          Historial {filtroCategoria ? `— ${filtroCategoria}` : ''}
        </div>
        <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: S.bg }}>
              {['Fecha','Categoría','Descripción','Proveedor','Comprobante','Monto',''].map(h => (
                <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {gastosFiltrados.length === 0 && <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay gastos en este período.</td></tr>}
              {gastosFiltrados.map(g => {
                const cs = CAT_COLORS[g.categoria] || CAT_COLORS.default
                return (
                  <tr key={g.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(g.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                    <td style={{ padding: '9px 12px' }}><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: cs.bg, color: cs.color }}>{g.categoria}</span></td>
                    <td style={{ padding: '9px 12px', color: S.muted }}>{g.descripcion || '—'}</td>
                    <td style={{ padding: '9px 12px', color: S.muted }}>{g.proveedor || '—'}</td>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12, color: S.hint }}>{g.comprobante || '—'}</td>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600, color: S.red }}>${g.monto?.toLocaleString('es-AR')}</td>
                    <td style={{ padding: '9px 12px' }}><button onClick={() => eliminar(g.id)} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button></td>
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
