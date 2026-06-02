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

const CATEGORIAS_GASTO = {
  Feedlot:     ['Combustible', 'Ferretería', 'Taller / Reparaciones', 'Veterinario', 'Flete', 'Electricidad', 'Agua', 'Rodados', 'Otro feedlot'],
  Agricultura: ['Combustible', 'Agroquímicos', 'Semillas', 'Fertilizantes', 'Flete granos', 'Reparaciones', 'Laboreo', 'Otro agricultura'],
  Servicios:   ['Contratista siembra', 'Contratista cosecha', 'Laboreo', 'Pulverización', 'Otro servicio'],
  General:     ['Contabilidad', 'Impuestos', 'Monotributo', 'Seguros', 'Honorarios', 'Comunicaciones', 'Servicios públicos', 'Otro general'],
}

const ACTIVIDAD_COLORS = {
  Feedlot:     { bg: '#E8EFF8', color: '#1A3D6B' },
  Agricultura: { bg: '#E8F4EB', color: '#1E5C2E' },
  Servicios:   { bg: '#FDF0E0', color: '#7A4500' },
  General:     { bg: '#F0EAFB', color: '#3D1A6B' },
}

const FORM_INIT = {
  actividad: 'Feedlot', categoria: 'Combustible', descripcion: '', monto: '',
  fecha: new Date().toISOString().split('T')[0],
  proveedor: '', comprobante: '', forma_pago: 'transferencia',
  es_paralelo: false, subtipo_cheque: '',
  cheque_propio: { numero: '', banco: '', fecha_vencimiento: '' },
  cheque_tercero_id: '',
}

export default function Gastos({ usuario }) {
  const [loading, setLoading] = useState(true)
  const [gastos, setGastos] = useState([])
  const [chequesCartera, setChequesCartera] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [filtroActividad, setFiltroActividad] = useState('')
  const [filtroAnio, setFiltroAnio] = useState(String(new Date().getFullYear()))
  const [form, setForm] = useState(FORM_INIT)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: g }, { data: ch }] = await Promise.all([
      supabase.from('gastos_generales').select('*').order('fecha', { ascending: false }),
      supabase.from('cheques').select('*').eq('tipo', 'recibido').eq('estado', 'en_cartera').order('fecha_vencimiento', { ascending: true }),
    ])
    setGastos(g || [])
    setChequesCartera(ch || [])
    setLoading(false)
  }

  async function guardar() {
    if (!form.categoria || !form.monto) { alert('Completá categoría y monto'); return }
    setGuardando(true)
    const monto = parseFloat(form.monto)
    const desc = `${form.actividad} — ${form.categoria}${form.descripcion ? ': ' + form.descripcion : ''}${form.proveedor ? ' (' + form.proveedor + ')' : ''}`
    const formaPago = form.subtipo_cheque ? 'e-cheq' : (form.forma_pago || 'transferencia')

    // 1. Registrar en caja
    let caja_oficial_id = null
    let caja_paralela_id = null
    if (form.es_paralelo) {
      const { data: cp } = await supabase.from('caja_paralela').insert({
        fecha: form.fecha, tipo: 'egreso', descripcion: desc, monto,
      }).select().single()
      caja_paralela_id = cp?.id || null
    } else {
      const { data: co } = await supabase.from('caja_oficial').insert({
        fecha: form.fecha, tipo: 'egreso',
        categoria: `Gastos ${form.actividad}`,
        descripcion: desc, monto, forma_pago: formaPago,
      }).select().single()
      caja_oficial_id = co?.id || null
    }

    // 2. Cheques
    if (!form.es_paralelo && form.subtipo_cheque === 'propio') {
      await supabase.from('cheques').insert({
        tipo: 'emitido', numero: form.cheque_propio.numero || null,
        banco: form.cheque_propio.banco || null,
        fecha_cobro: form.fecha,
        fecha_vencimiento: form.cheque_propio.fecha_vencimiento,
        monto, beneficiario: form.proveedor || null,
        estado: 'en_cartera', caja_oficial_id,
        registrado_por: usuario?.id,
      })
    } else if (form.subtipo_cheque === 'tercero' && form.cheque_tercero_id) {
      await supabase.from('cheques').update({ estado: 'depositado' }).eq('id', parseInt(form.cheque_tercero_id))
    }

    // 3. Guardar gasto
    await supabase.from('gastos_generales').insert({
      actividad: form.actividad,
      categoria: form.categoria,
      descripcion: form.descripcion || null,
      monto,
      fecha: form.fecha,
      proveedor: form.proveedor || null,
      comprobante: form.comprobante || null,
      forma_pago: formaPago,
      es_paralelo: form.es_paralelo,
      caja_oficial_id,
      caja_paralela_id,
      registrado_por: usuario?.id,
    })

    await cargar()
    setShowForm(false)
    setForm(FORM_INIT)
    setGuardando(false)
  }

  async function eliminar(g) {
    if (!confirm('¿Eliminar este gasto? Se eliminará también de la caja.')) return
    if (g.caja_oficial_id) await supabase.from('caja_oficial').delete().eq('id', g.caja_oficial_id)
    if (g.caja_paralela_id) await supabase.from('caja_paralela').delete().eq('id', g.caja_paralela_id)
    await supabase.from('gastos_generales').delete().eq('id', g.id)
    await cargar()
  }

  if (loading) return <Loader />

  const anio = parseInt(filtroAnio) || new Date().getFullYear()
  const gastosFiltrados = gastos.filter(g => {
    const matchAnio = new Date(g.fecha).getFullYear() === anio
    const matchAct = !filtroActividad || g.actividad === filtroActividad
    return matchAnio && matchAct
  })
  const totalAnio = gastosFiltrados.reduce((s, g) => s + (g.monto || 0), 0)
  const aniosDisponibles = [...new Set(gastos.map(g => new Date(g.fecha).getFullYear()))].sort((a, b) => b - a)
  if (!aniosDisponibles.includes(new Date().getFullYear())) aniosDisponibles.unshift(new Date().getFullYear())

  // Totales por actividad
  const porActividad = {}
  Object.keys(CATEGORIAS_GASTO).forEach(a => {
    porActividad[a] = gastosFiltrados.filter(g => g.actividad === a).reduce((s, g) => s + (g.monto || 0), 0)
  })

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 3 }}>Gastos generales</div>
      <div style={{ fontSize: 12, color: S.muted, marginBottom: '1.5rem' }}>
        Feedlot · Agricultura · Servicios · General
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: '1.25rem', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={filtroAnio} onChange={e => setFiltroAnio(e.target.value)}
            style={{ padding: '7px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface }}>
            {aniosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={filtroActividad} onChange={e => setFiltroActividad(e.target.value)}
            style={{ padding: '7px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface }}>
            <option value="">Todas las actividades</option>
            {Object.keys(CATEGORIAS_GASTO).map(a => <option key={a}>{a}</option>)}
          </select>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          + Registrar gasto
        </button>
      </div>

      {/* Métricas por actividad */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
        {Object.entries(porActividad).map(([act, total]) => {
          const cs = ACTIVIDAD_COLORS[act] || { bg: S.bg, color: S.muted }
          return (
            <div key={act} onClick={() => setFiltroActividad(filtroActividad === act ? '' : act)}
              style={{ background: filtroActividad === act ? cs.bg : S.surface, border: `1px solid ${filtroActividad === act ? cs.color : S.border}`, borderRadius: 8, padding: '1rem', cursor: 'pointer' }}>
              <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', marginBottom: 5 }}>{act}</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: total > 0 ? S.red : S.hint }}>{total > 0 ? `$${total.toLocaleString('es-AR')}` : '—'}</div>
            </div>
          )
        })}
      </div>

      {/* Formulario */}
      {showForm && (
        <Card>
          <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: '1rem' }}>Nuevo gasto</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '.75rem' }}>
            <div>
              <Label>Actividad</Label>
              <select value={form.actividad} onChange={e => setForm({...form, actividad: e.target.value, categoria: CATEGORIAS_GASTO[e.target.value][0]})} style={inputStyle}>
                {Object.keys(CATEGORIAS_GASTO).map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <Label>Categoría</Label>
              <select value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} style={inputStyle}>
                {(CATEGORIAS_GASTO[form.actividad] || []).map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label>Monto $</Label>
              <input type="number" value={form.monto} onChange={e => setForm({...form, monto: e.target.value})} style={inputStyle} />
            </div>
            <div>
              <Label>Fecha</Label>
              <input type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} style={inputStyle} />
            </div>
            <div>
              <Label>Descripción</Label>
              <input type="text" value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} style={inputStyle} />
            </div>
            <div>
              <Label>Proveedor</Label>
              <input type="text" value={form.proveedor} onChange={e => setForm({...form, proveedor: e.target.value})} style={inputStyle} />
            </div>
            <div>
              <Label>N° comprobante</Label>
              <input type="text" value={form.comprobante} onChange={e => setForm({...form, comprobante: e.target.value})} style={inputStyle} />
            </div>
            <div>
              <Label>Forma de pago</Label>
              <select value={form.forma_pago} onChange={e => setForm({...form, forma_pago: e.target.value, subtipo_cheque: ''})} style={inputStyle}>
                <option value="transferencia">Transferencia</option>
                <option value="efectivo">Efectivo</option>
                <option value="e-cheq">E-cheq</option>
                <option value="cuenta_corriente">Cuenta corriente</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: S.purple, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.es_paralelo} onChange={e => setForm({...form, es_paralelo: e.target.checked, subtipo_cheque: ''})} />
                Pago paralelo
              </label>
            </div>
          </div>

          {/* E-cheq */}
          {form.forma_pago === 'e-cheq' && (
            <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '10px 12px', marginBottom: '1rem' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 8 }}>
                Tipo de e-cheq
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: form.subtipo_cheque ? 12 : 0 }}>
                {(form.es_paralelo ? ['tercero'] : ['propio', 'tercero']).map(t => (
                  <button key={t} onClick={() => setForm({...form, subtipo_cheque: form.subtipo_cheque === t ? '' : t})}
                    style={{ padding: '6px 16px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif", border: `1px solid ${form.subtipo_cheque === t ? S.accent : S.border}`, background: form.subtipo_cheque === t ? S.accentLight : 'transparent', color: form.subtipo_cheque === t ? S.accent : S.muted }}>
                    {t === 'propio' ? '📤 E-cheq propio' : '📥 E-cheq de tercero'}
                  </button>
                ))}
              </div>
              {form.subtipo_cheque === 'propio' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 10 }}>
                  <div>
                    <Label>N° cheque</Label>
                    <input type="text" value={form.cheque_propio.numero} onChange={e => setForm({...form, cheque_propio: {...form.cheque_propio, numero: e.target.value}})} style={inputStyle} />
                  </div>
                  <div>
                    <Label>Banco</Label>
                    <input type="text" value={form.cheque_propio.banco} onChange={e => setForm({...form, cheque_propio: {...form.cheque_propio, banco: e.target.value}})} style={inputStyle} />
                  </div>
                  <div>
                    <Label>Fecha vencimiento *</Label>
                    <input type="date" value={form.cheque_propio.fecha_vencimiento} onChange={e => setForm({...form, cheque_propio: {...form.cheque_propio, fecha_vencimiento: e.target.value}})} style={{ ...inputStyle, borderColor: S.amber }} />
                  </div>
                </div>
              )}
              {form.subtipo_cheque === 'tercero' && (
                <div style={{ marginTop: 10 }}>
                  {chequesCartera.length === 0
                    ? <div style={{ fontSize: 13, color: S.hint }}>No hay cheques de terceros en cartera.</div>
                    : chequesCartera.map(ch => (
                      <label key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: `1px solid ${form.cheque_tercero_id === String(ch.id) ? S.accent : S.border}`, borderRadius: 6, background: form.cheque_tercero_id === String(ch.id) ? S.accentLight : S.surface, cursor: 'pointer', marginBottom: 6 }}>
                        <input type="radio" name="cheque_gasto" value={ch.id} checked={form.cheque_tercero_id === String(ch.id)} onChange={() => setForm({...form, cheque_tercero_id: String(ch.id)})} />
                        <div style={{ fontSize: 13 }}>
                          <strong>${ch.monto?.toLocaleString('es-AR')}</strong>
                          <span style={{ color: S.muted, marginLeft: 8 }}>#{ch.numero || 'sin nro'} · {ch.banco || '—'} · vence {ch.fecha_vencimiento ? new Date(ch.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR') : '—'}{ch.librador ? ` · ${ch.librador}` : ''}</span>
                        </div>
                      </label>
                    ))
                  }
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
            <button onClick={guardar} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
              {guardando ? 'Guardando...' : 'Guardar y registrar en caja'}
            </button>
          </div>
        </Card>
      )}

      {/* Historial */}
      <Card>
        <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>
          Historial {filtroActividad ? `— ${filtroActividad}` : ''}
        </div>
        <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 700 }}>
            <thead>
              <tr style={{ background: S.bg }}>
                {['Fecha', 'Actividad', 'Categoría', 'Descripción', 'Proveedor', 'Pago', 'Monto', ''].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gastosFiltrados.length === 0 && <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay gastos en este período.</td></tr>}
              {gastosFiltrados.map(g => {
                const cs = ACTIVIDAD_COLORS[g.actividad] || { bg: S.bg, color: S.muted }
                return (
                  <tr key={g.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(g.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                    <td style={{ padding: '9px 12px' }}><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: cs.bg, color: cs.color }}>{g.actividad || '—'}</span></td>
                    <td style={{ padding: '9px 12px' }}><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: S.amberLight, color: S.amber }}>{g.categoria}</span></td>
                    <td style={{ padding: '9px 12px', color: S.muted }}>{g.descripcion || '—'}</td>
                    <td style={{ padding: '9px 12px', color: S.muted }}>{g.proveedor || '—'}</td>
                    <td style={{ padding: '9px 12px', fontSize: 11 }}>{g.es_paralelo ? <span style={{ color: S.purple, fontWeight: 600 }}>Paralelo</span> : g.forma_pago || '—'}</td>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600, color: S.red }}>${g.monto?.toLocaleString('es-AR')}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <button onClick={() => eliminar(g)} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>
                        Eliminar
                      </button>
                    </td>
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
