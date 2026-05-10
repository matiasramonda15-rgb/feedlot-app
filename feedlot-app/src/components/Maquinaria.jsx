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

const LABORES = ['Siembra', 'Cosecha', 'Pulverización', 'Fertilización', 'Roturación', 'Rastreo', 'Transporte', 'Otro']
const TIPOS = ['Tractor', 'Cosechadora', 'Pulverizadora', 'Sembradora', 'Acoplado', 'Camión', 'Otro']

export default function Maquinaria({ usuario }) {
  const [loading, setLoading] = useState(true)
  const [maquinaria, setMaquinaria] = useState([])
  const [trabajos, setTrabajos] = useState([])
  const [potreros, setPotreros] = useState([])
  const [maquinaSelId, setMaquinaSelId] = useState('')
  const [showFormMaq, setShowFormMaq] = useState(false)
  const [showFormTrabajo, setShowFormTrabajo] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const [formMaq, setFormMaq] = useState({ nombre: '', tipo: 'Tractor', anio: '', observaciones: '' })
  const [formTrabajo, setFormTrabajo] = useState({
    maquina_id: '', potrero_id: '', labor: 'Siembra',
    fecha: new Date().toISOString().split('T')[0],
    horas: '', litros_combustible: '', costo_combustible: '',
    contratista: false, costo_contratista: '', observaciones: ''
  })

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: m }, { data: t }, { data: p }] = await Promise.all([
      supabase.from('maquinaria').select('*').order('nombre'),
      supabase.from('trabajos_maquinaria').select('*, maquinaria(nombre), potreros(nombre)').order('fecha', { ascending: false }).limit(100),
      supabase.from('potreros').select('*').eq('activo', true).order('nombre'),
    ])
    setMaquinaria(m || [])
    setTrabajos(t || [])
    setPotreros(p || [])
    setLoading(false)
  }

  async function guardarMaquina() {
    if (!formMaq.nombre) { alert('Ingresá el nombre'); return }
    setGuardando(true)
    await supabase.from('maquinaria').insert({ ...formMaq, anio: formMaq.anio ? parseInt(formMaq.anio) : null, activo: true })
    await cargar()
    setShowFormMaq(false)
    setFormMaq({ nombre: '', tipo: 'Tractor', anio: '', observaciones: '' })
    setGuardando(false)
  }

  async function guardarTrabajo() {
    if (!formTrabajo.maquina_id || !formTrabajo.labor) { alert('Completá máquina y labor'); return }
    setGuardando(true)
    await supabase.from('trabajos_maquinaria').insert({
      maquina_id: parseInt(formTrabajo.maquina_id),
      potrero_id: formTrabajo.potrero_id ? parseInt(formTrabajo.potrero_id) : null,
      labor: formTrabajo.labor,
      fecha: formTrabajo.fecha,
      horas: formTrabajo.horas ? parseFloat(formTrabajo.horas) : null,
      litros_combustible: formTrabajo.litros_combustible ? parseFloat(formTrabajo.litros_combustible) : null,
      costo_combustible: formTrabajo.costo_combustible ? parseFloat(formTrabajo.costo_combustible) : null,
      contratista: formTrabajo.contratista,
      costo_contratista: formTrabajo.costo_contratista ? parseFloat(formTrabajo.costo_contratista) : null,
      observaciones: formTrabajo.observaciones || null,
      registrado_por: usuario?.id,
    })
    await cargar()
    setShowFormTrabajo(false)
    setFormTrabajo({ maquina_id: '', potrero_id: '', labor: 'Siembra', fecha: new Date().toISOString().split('T')[0], horas: '', litros_combustible: '', costo_combustible: '', contratista: false, costo_contratista: '', observaciones: '' })
    setGuardando(false)
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este trabajo?')) return
    await supabase.from('trabajos_maquinaria').delete().eq('id', id)
    await cargar()
  }

  async function toggleActivo(id, activo) {
    await supabase.from('maquinaria').update({ activo: !activo }).eq('id', id)
    await cargar()
  }

  if (loading) return <Loader />

  const maquinaSel = maquinaria.find(m => String(m.id) === String(maquinaSelId))
  const trabajosSel = maquinaSelId ? trabajos.filter(t => String(t.maquina_id) === String(maquinaSelId)) : trabajos
  const totalHoras = trabajosSel.reduce((s, t) => s + (t.horas || 0), 0)
  const totalCosto = trabajosSel.reduce((s, t) => s + (t.costo_combustible || 0) + (t.costo_contratista || 0), 0)
  const totalLitros = trabajosSel.reduce((s, t) => s + (t.litros_combustible || 0), 0)

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 3 }}>Maquinaria</div>
      <div style={{ fontSize: 12, color: S.muted, fontFamily: 'monospace', marginBottom: '1.5rem' }}>
        Flota propia · trabajos y uso de combustible
      </div>

      {/* Métricas globales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
        {[
          { label: 'Máquinas activas', val: maquinaria.filter(m => m.activo).length },
          { label: 'Horas totales', val: `${trabajos.reduce((s, t) => s + (t.horas || 0), 0).toFixed(1)} hs` },
          { label: 'Litros consumidos', val: `${trabajos.reduce((s, t) => s + (t.litros_combustible || 0), 0).toLocaleString('es-AR')} L` },
          { label: 'Costo total', val: `$${trabajos.reduce((s, t) => s + (t.costo_combustible || 0) + (t.costo_contratista || 0), 0).toLocaleString('es-AR')}`, color: S.red },
        ].map((m, i) => (
          <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem' }}>
            <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>{m.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: m.color || S.text }}>{m.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '1rem' }}>
        {/* Lista máquinas */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Flota</div>
            <button onClick={() => setShowFormMaq(!showFormMaq)}
              style={{ padding: '5px 10px', fontSize: 11, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 5, cursor: 'pointer' }}>
              + Máquina
            </button>
          </div>

          {showFormMaq && (
            <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'grid', gap: '1rem', marginBottom: '.75rem' }}>
                <div><Label>Nombre</Label><input type="text" value={formMaq.nombre} onChange={e => setFormMaq({...formMaq, nombre: e.target.value})} style={inputStyle} /></div>
                <div><Label>Tipo</Label>
                  <select value={formMaq.tipo} onChange={e => setFormMaq({...formMaq, tipo: e.target.value})} style={inputStyle}>
                    {TIPOS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div><Label>Año</Label><input type="number" value={formMaq.anio} onChange={e => setFormMaq({...formMaq, anio: e.target.value})} style={inputStyle} /></div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setShowFormMaq(false)} style={{ flex: 1, padding: '7px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={guardarMaquina} disabled={guardando} style={{ flex: 1, padding: '7px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? '...' : 'Agregar'}</button>
              </div>
            </div>
          )}

          <div onClick={() => setMaquinaSelId('')}
            style={{ border: `1px solid ${!maquinaSelId ? S.accent : S.border}`, borderRadius: 8, padding: '.75rem', marginBottom: 6, cursor: 'pointer', background: !maquinaSelId ? S.accentLight : S.surface }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Todas las máquinas</div>
            <div style={{ fontSize: 11, color: S.muted }}>{trabajos.length} trabajos registrados</div>
          </div>

          {maquinaria.map(m => {
            const trabsMaq = trabajos.filter(t => t.maquina_id === m.id)
            const isSel = String(m.id) === String(maquinaSelId)
            return (
              <div key={m.id} onClick={() => setMaquinaSelId(String(m.id))}
                style={{ border: `1px solid ${isSel ? S.accent : S.border}`, borderRadius: 8, padding: '.75rem', marginBottom: 6, cursor: 'pointer', background: isSel ? S.accentLight : m.activo ? S.surface : S.bg, opacity: m.activo ? 1 : 0.6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{m.nombre}</div>
                  <span style={{ fontSize: 10, color: m.activo ? S.green : S.hint }}>{m.activo ? 'Activa' : 'Inactiva'}</span>
                </div>
                <div style={{ fontSize: 11, color: S.muted }}>{m.tipo} · {m.anio || '—'}</div>
                <div style={{ fontSize: 11, fontFamily: 'monospace', marginTop: 4, color: S.muted }}>
                  {trabsMaq.length} trabajos · {trabsMaq.reduce((s, t) => s + (t.horas || 0), 0).toFixed(1)} hs
                </div>
              </div>
            )
          })}
        </div>

        {/* Detalle y trabajos */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {maquinaSel ? maquinaSel.nombre : 'Todos los trabajos'}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {maquinaSel && (
                <button onClick={() => toggleActivo(maquinaSel.id, maquinaSel.activo)}
                  style={{ padding: '6px 12px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>
                  {maquinaSel.activo ? 'Dar de baja' : 'Reactivar'}
                </button>
              )}
              <button onClick={() => { setFormTrabajo({...formTrabajo, maquina_id: maquinaSelId}); setShowFormTrabajo(true) }}
                style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                + Registrar trabajo
              </button>
            </div>
          </div>

          {/* Métricas filtradas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: '1rem' }}>
            {[
              { label: 'Horas', val: `${totalHoras.toFixed(1)} hs` },
              { label: 'Litros', val: `${totalLitros.toLocaleString('es-AR')} L` },
              { label: 'Costo', val: `$${totalCosto.toLocaleString('es-AR')}`, color: S.red },
            ].map((m, i) => (
              <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '.85rem' }}>
                <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: m.color || S.text }}>{m.val}</div>
              </div>
            ))}
          </div>

          {showFormTrabajo && (
            <Card>
              <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: '1rem' }}>Nuevo trabajo</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '.75rem' }}>
                <div><Label>Máquina</Label>
                  <select value={formTrabajo.maquina_id} onChange={e => setFormTrabajo({...formTrabajo, maquina_id: e.target.value})} style={inputStyle}>
                    <option value="">— Seleccioná —</option>
                    {maquinaria.filter(m => m.activo).map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </select>
                </div>
                <div><Label>Labor</Label>
                  <select value={formTrabajo.labor} onChange={e => setFormTrabajo({...formTrabajo, labor: e.target.value})} style={inputStyle}>
                    {LABORES.map(l => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div><Label>Fecha</Label><input type="date" value={formTrabajo.fecha} onChange={e => setFormTrabajo({...formTrabajo, fecha: e.target.value})} style={inputStyle} /></div>
                <div><Label>Potrero</Label>
                  <select value={formTrabajo.potrero_id} onChange={e => setFormTrabajo({...formTrabajo, potrero_id: e.target.value})} style={inputStyle}>
                    <option value="">— Opcional —</option>
                    {potreros.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div><Label>Horas trabajadas</Label><input type="number" value={formTrabajo.horas} onChange={e => setFormTrabajo({...formTrabajo, horas: e.target.value})} style={inputStyle} /></div>
                <div><Label>Litros combustible</Label><input type="number" value={formTrabajo.litros_combustible} onChange={e => setFormTrabajo({...formTrabajo, litros_combustible: e.target.value})} style={inputStyle} /></div>
                <div><Label>Costo combustible $</Label><input type="number" value={formTrabajo.costo_combustible} onChange={e => setFormTrabajo({...formTrabajo, costo_combustible: e.target.value})} style={inputStyle} /></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
                  <input type="checkbox" id="contratista" checked={formTrabajo.contratista} onChange={e => setFormTrabajo({...formTrabajo, contratista: e.target.checked})} />
                  <label htmlFor="contratista" style={{ fontSize: 13, cursor: 'pointer' }}>Contratista externo</label>
                </div>
                {formTrabajo.contratista && (
                  <div><Label>Costo contratista $</Label><input type="number" value={formTrabajo.costo_contratista} onChange={e => setFormTrabajo({...formTrabajo, costo_contratista: e.target.value})} style={inputStyle} /></div>
                )}
                <div style={{ gridColumn: '1/-1' }}><Label>Observaciones</Label><input type="text" value={formTrabajo.observaciones} onChange={e => setFormTrabajo({...formTrabajo, observaciones: e.target.value})} style={inputStyle} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowFormTrabajo(false)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={guardarTrabajo} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </Card>
          )}

          <Card>
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: S.bg }}>
                  {['Fecha','Máquina','Labor','Potrero','Horas','Litros','Costo',''].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {trabajosSel.length === 0 && <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay trabajos registrados.</td></tr>}
                  {trabajosSel.map(t => (
                    <tr key={t.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(t.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 600 }}>{t.maquinaria?.nombre}</td>
                      <td style={{ padding: '9px 12px' }}>{t.labor}{t.contratista ? ' 🔧' : ''}</td>
                      <td style={{ padding: '9px 12px', color: S.muted }}>{t.potreros?.nombre || '—'}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{t.horas ? `${t.horas}h` : '—'}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{t.litros_combustible ? `${t.litros_combustible}L` : '—'}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: S.red }}>
                        {(t.costo_combustible || t.costo_contratista) ? `$${((t.costo_combustible || 0) + (t.costo_contratista || 0)).toLocaleString('es-AR')}` : '—'}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <button onClick={() => eliminar(t.id)} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
