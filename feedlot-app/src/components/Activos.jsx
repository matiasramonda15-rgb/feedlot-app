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

const TIPOS = ['tractor', 'maquinaria', 'herramienta', 'vehiculo', 'infraestructura', 'otro']
const ESTADOS = { activo: { bg: '#E8F4EB', color: '#1E5C2E' }, en_reparacion: { bg: '#FDF0E0', color: '#7A4500' }, dado_de_baja: { bg: '#FDF0F0', color: '#7A1A1A' } }
const SOCIOS = [
  { nombre: 'Oscar',   pct: 75.17 },
  { nombre: 'Matias',  pct: 23.46 },
  { nombre: 'Martin',  pct: 0.77  },
  { nombre: 'Cecilia', pct: 0.60  },
]
const SOCIOS_DEFAULT = SOCIOS.map(s => s.nombre)
const FORMAS_PAGO = ['transferencia', 'cheque', 'efectivo', 'depósito']

export default function Activos({ usuario }) {
  const [tab, setTab] = useState('activos')
  const [loading, setLoading] = useState(true)
  const [activos, setActivos] = useState([])
  const [retiros, setRetiros] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [showFormActivo, setShowFormActivo] = useState(false)
  const [showFormRetiro, setShowFormRetiro] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroAnio, setFiltroAnio] = useState(String(new Date().getFullYear()))

  const [formActivo, setFormActivo] = useState({ nombre: '', tipo: 'tractor', marca: '', modelo: '', anio: '', fecha_compra: '', valor_compra: '', valor_actual: '', estado: 'activo', observaciones: '' })
  const [formRetiro, setFormRetiro] = useState({ socio: '', fecha: new Date().toISOString().split('T')[0], monto: '', concepto: '', forma_pago: 'transferencia', observaciones: '' })

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: a }, { data: r }] = await Promise.all([
      supabase.from('activos').select('*').order('fecha_compra', { ascending: false }),
      supabase.from('retiros_socios').select('*').order('fecha', { ascending: false }),
    ])
    setActivos(a || [])
    setRetiros(r || [])
    setLoading(false)
  }

  async function guardarActivo() {
    if (!formActivo.nombre) { alert('Ingresá el nombre'); return }
    setGuardando(true)
    await supabase.from('activos').insert({
      ...formActivo,
      anio: formActivo.anio ? parseInt(formActivo.anio) : null,
      valor_compra: formActivo.valor_compra ? parseFloat(formActivo.valor_compra) : null,
      valor_actual: formActivo.valor_actual ? parseFloat(formActivo.valor_actual) : null,
      registrado_por: usuario?.id,
    })
    await cargar()
    setShowFormActivo(false)
    setFormActivo({ nombre: '', tipo: 'tractor', marca: '', modelo: '', anio: '', fecha_compra: '', valor_compra: '', valor_actual: '', estado: 'activo', observaciones: '' })
    setGuardando(false)
  }

  async function guardarRetiro() {
    if (!formRetiro.socio || !formRetiro.monto) { alert('Completá socio y monto'); return }
    setGuardando(true)
    await supabase.from('retiros_socios').insert({ ...formRetiro, monto: parseFloat(formRetiro.monto), registrado_por: usuario?.id })
    await cargar()
    setShowFormRetiro(false)
    setFormRetiro({ socio: '', fecha: new Date().toISOString().split('T')[0], monto: '', concepto: '', forma_pago: 'transferencia', observaciones: '' })
    setGuardando(false)
  }

  async function cambiarEstado(id, estado) {
    await supabase.from('activos').update({ estado }).eq('id', id)
    await cargar()
  }

  async function eliminar(tabla, id) {
    if (!confirm('¿Eliminar este registro?')) return
    await supabase.from(tabla).delete().eq('id', id)
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
          </div>

          {showFormActivo && (
            <Card>
              <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: '1rem' }}>Nuevo activo</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '.75rem' }}>
                <div style={{ gridColumn: '1/3' }}><Label>Nombre</Label><input type="text" value={formActivo.nombre} onChange={e => setFormActivo({...formActivo, nombre: e.target.value})} style={inputStyle} placeholder="ej. Tractor John Deere 5090" /></div>
                <div><Label>Tipo</Label>
                  <select value={formActivo.tipo} onChange={e => setFormActivo({...formActivo, tipo: e.target.value})} style={inputStyle}>
                    {TIPOS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div><Label>Marca</Label><input type="text" value={formActivo.marca} onChange={e => setFormActivo({...formActivo, marca: e.target.value})} style={inputStyle} /></div>
                <div><Label>Modelo</Label><input type="text" value={formActivo.modelo} onChange={e => setFormActivo({...formActivo, modelo: e.target.value})} style={inputStyle} /></div>
                <div><Label>Año</Label><input type="number" value={formActivo.anio} onChange={e => setFormActivo({...formActivo, anio: e.target.value})} style={inputStyle} /></div>
                <div><Label>Fecha de compra</Label><input type="date" value={formActivo.fecha_compra} onChange={e => setFormActivo({...formActivo, fecha_compra: e.target.value})} style={inputStyle} /></div>
                <div><Label>Valor de compra $</Label><input type="number" value={formActivo.valor_compra} onChange={e => setFormActivo({...formActivo, valor_compra: e.target.value})} style={inputStyle} /></div>
                <div><Label>Valor actual $</Label><input type="number" value={formActivo.valor_actual} onChange={e => setFormActivo({...formActivo, valor_actual: e.target.value})} style={inputStyle} placeholder="Si difiere del de compra" /></div>
                <div style={{ gridColumn: '1/-1' }}><Label>Observaciones</Label><input type="text" value={formActivo.observaciones} onChange={e => setFormActivo({...formActivo, observaciones: e.target.value})} style={inputStyle} /></div>
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
                    {a.observaciones && <div style={{ fontSize: 11, color: S.hint, marginTop: 4 }}>{a.observaciones}</div>}
                  </div>

                  <button onClick={() => eliminar('activos', a.id)}
                    style={{ marginTop: 10, width: '100%', padding: '5px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>
                    Eliminar
                  </button>
                </div>
              )
            })}
          </div>
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
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowFormRetiro(false)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={guardarRetiro} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </Card>
          )}

          <Card>
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: S.bg }}>
                  {['Fecha', 'Socio', 'Concepto', 'Forma pago', 'Monto', ''].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {retirosFiltrados.length === 0 && <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay retiros registrados.</td></tr>}
                  {retirosFiltrados.map(r => (
                    <tr key={r.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 600 }}>{r.socio}</td>
                      <td style={{ padding: '9px 12px', color: S.muted }}>{r.concepto || '—'}</td>
                      <td style={{ padding: '9px 12px', color: S.muted, fontSize: 12 }}>{r.forma_pago}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600, color: S.red }}>-${r.monto?.toLocaleString('es-AR')}</td>
                      <td style={{ padding: '9px 12px' }}><button onClick={() => eliminar('retiros_socios', r.id)} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button></td>
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
