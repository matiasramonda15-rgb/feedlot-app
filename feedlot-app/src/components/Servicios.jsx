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

const LABORES = ['Siembra', 'Cosecha', 'Pulverización', 'Fertilización', 'Roturación', 'Rastreo', 'Flete', 'Otro']

export default function Servicios({ usuario }) {
  const [loading, setLoading] = useState(true)
  const [servicios, setServicios] = useState([])
  const [maquinaria, setMaquinaria] = useState([])
  const [clientes, setClientes] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({
    cliente: '', labor: 'Siembra', fecha: new Date().toISOString().split('T')[0],
    hectareas: '', maquina_id: '', precio_ha: '', observaciones: ''
  })

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: s }, { data: m }] = await Promise.all([
      supabase.from('servicios_terceros').select('*, maquinaria(nombre)').order('fecha', { ascending: false }),
      supabase.from('maquinaria').select('*').eq('activo', true).order('nombre'),
    ])
    setServicios(s || [])
    setMaquinaria(m || [])
    const cls = [...new Set((s || []).map(x => x.cliente).filter(Boolean))].sort()
    setClientes(cls)
    setLoading(false)
  }

  async function guardar() {
    if (!form.cliente || !form.labor || !form.hectareas) { alert('Completá cliente, labor y hectáreas'); return }
    setGuardando(true)
    const ha = parseFloat(form.hectareas)
    const precio = form.precio_ha ? parseFloat(form.precio_ha) : null
    const total = ha && precio ? ha * precio : null
    await supabase.from('servicios_terceros').insert({
      cliente: form.cliente,
      labor: form.labor,
      fecha: form.fecha,
      hectareas: ha,
      maquina_id: form.maquina_id ? parseInt(form.maquina_id) : null,
      precio_ha: precio,
      total,
      observaciones: form.observaciones || null,
      registrado_por: usuario?.id,
    })
    await cargar()
    setShowForm(false)
    setForm({ cliente: '', labor: 'Siembra', fecha: new Date().toISOString().split('T')[0], hectareas: '', maquina_id: '', precio_ha: '', observaciones: '' })
    setGuardando(false)
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este servicio?')) return
    await supabase.from('servicios_terceros').delete().eq('id', id)
    await cargar()
  }

  if (loading) return <Loader />

  const totalFacturado = servicios.reduce((s, x) => s + (x.total || 0), 0)
  const totalHa = servicios.reduce((s, x) => s + (x.hectareas || 0), 0)
  const totalAnio = servicios.filter(x => new Date(x.fecha).getFullYear() === new Date().getFullYear()).reduce((s, x) => s + (x.total || 0), 0)

  // Agrupar por labor
  const porLabor = {}
  servicios.forEach(s => {
    if (!porLabor[s.labor]) porLabor[s.labor] = { total: 0, ha: 0 }
    porLabor[s.labor].total += s.total || 0
    porLabor[s.labor].ha += s.hectareas || 0
  })

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 3 }}>Servicios</div>
      <div style={{ fontSize: 12, color: S.muted, fontFamily: 'monospace', marginBottom: '1.5rem' }}>
        Trabajos de maquinaria para terceros · siembra y cosecha
      </div>

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
        {[
          { label: 'Facturado este año', val: `$${totalAnio.toLocaleString('es-AR')}`, color: S.green },
          { label: 'Total facturado', val: `$${totalFacturado.toLocaleString('es-AR')}`, color: S.green },
          { label: 'Hectáreas trabajadas', val: `${totalHa.toLocaleString('es-AR')} ha`, color: S.accent },
          { label: 'Trabajos registrados', val: servicios.length },
        ].map((m, i) => (
          <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem' }}>
            <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>{m.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: m.color || S.text }}>{m.val}</div>
          </div>
        ))}
      </div>

      {/* Por labor */}
      {Object.keys(porLabor).length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.25rem' }}>
          {Object.entries(porLabor).map(([labor, datos]) => (
            <div key={labor} style={{ background: S.accentLight, border: `1px solid #85B7EB`, borderRadius: 8, padding: '.85rem' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: S.accent, marginBottom: 4 }}>{labor}</div>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: S.green }}>${datos.total.toLocaleString('es-AR')}</div>
              <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>{datos.ha.toLocaleString('es-AR')} ha</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Historial de servicios</div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          + Registrar trabajo
        </button>
      </div>

      {showForm && (
        <Card>
          <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>Nuevo trabajo para tercero</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '.75rem' }}>
            <div>
              <Label>Cliente</Label>
              <select value={form.cliente} onChange={e => setForm({...form, cliente: e.target.value})} style={inputStyle}>
                <option value="">— Seleccioná o escribí nuevo —</option>
                {clientes.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="__nuevo__">+ Nuevo cliente...</option>
              </select>
              {form.cliente === '__nuevo__' && (
                <input type="text" placeholder="Nombre del cliente" onChange={e => setForm({...form, cliente: e.target.value})}
                  style={{ ...inputStyle, marginTop: 6, border: `1px solid ${S.accent}` }} />
              )}
            </div>
            <div>
              <Label>Labor</Label>
              <select value={form.labor} onChange={e => setForm({...form, labor: e.target.value})} style={inputStyle}>
                {LABORES.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <Label>Fecha</Label>
              <input type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} style={inputStyle} />
            </div>
            <div>
              <Label>Hectáreas</Label>
              <input type="number" value={form.hectareas} onChange={e => setForm({...form, hectareas: e.target.value})} style={inputStyle} placeholder="ej. 50" />
            </div>
            <div>
              <Label>Precio $/ha</Label>
              <input type="number" value={form.precio_ha} onChange={e => setForm({...form, precio_ha: e.target.value})} style={inputStyle} placeholder="ej. 15000" />
            </div>
            <div>
              <Label>Máquina utilizada</Label>
              <select value={form.maquina_id} onChange={e => setForm({...form, maquina_id: e.target.value})} style={inputStyle}>
                <option value="">— Sin especificar —</option>
                {maquinaria.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <Label>Observaciones</Label>
              <input type="text" value={form.observaciones} onChange={e => setForm({...form, observaciones: e.target.value})} style={inputStyle} />
            </div>
          </div>
          {form.hectareas && form.precio_ha && (
            <div style={{ background: S.greenLight, border: '1px solid #97C459', borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: 13, color: S.green }}>
              Total: <strong>${(parseFloat(form.hectareas) * parseFloat(form.precio_ha)).toLocaleString('es-AR')}</strong>
              {' '}({form.hectareas} ha × ${parseFloat(form.precio_ha).toLocaleString('es-AR')}/ha)
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
            <button onClick={guardar} disabled={guardando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </Card>
      )}

      <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
        <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: S.bg }}>
                {['Fecha', 'Cliente', 'Labor', 'Máquina', 'Ha', '$/ha', 'Total', ''].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {servicios.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay servicios registrados.</td></tr>
              )}
              {servicios.map(s => (
                <tr key={s.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                  <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(s.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                  <td style={{ padding: '9px 12px', fontWeight: 600 }}>{s.cliente}</td>
                  <td style={{ padding: '9px 12px' }}>{s.labor}</td>
                  <td style={{ padding: '9px 12px', color: S.muted, fontSize: 12 }}>{s.maquinaria?.nombre || '—'}</td>
                  <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{s.hectareas?.toLocaleString('es-AR')} ha</td>
                  <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: S.muted }}>{s.precio_ha ? `$${s.precio_ha.toLocaleString('es-AR')}` : '—'}</td>
                  <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600, color: S.green }}>{s.total ? `$${s.total.toLocaleString('es-AR')}` : '—'}</td>
                  <td style={{ padding: '9px 12px' }}>
                    <button onClick={() => eliminar(s.id)} style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
