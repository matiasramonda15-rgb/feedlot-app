import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Loader } from './UI'
import { hoyLocal } from '../shared/dateUtils'

const S = {
  bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6',
  text: '#1A1916', muted: '#6B6760', hint: '#9E9A94',
  accent: '#1A3D6B', accentLight: '#E8EFF8',
  green: '#1E5C2E', greenLight: '#E8F4EB',
}

const MODULOS_COLOR = {
  'Sanidad': '#7A1A1A', 'Agricultura': '#1E5C2E', 'Feedlot': '#1A3D6B',
  'Contactos': '#3D1A6B', 'Cheques': '#7A4500', 'General': '#6B6760',
}

export default function Novedades({ usuario }) {
  const [loading, setLoading] = useState(true)
  const [novedades, setNovedades] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ fecha: hoyLocal(), modulo: 'General', titulo: '', descripcion: '' })
  const [guardando, setGuardando] = useState(false)
  const esDueno = usuario?.rol === 'dueno'

  async function cargar() {
    const { data } = await supabase.from('novedades').select('*').order('fecha', { ascending: false }).order('id', { ascending: false })
    setNovedades(data || [])
    setLoading(false)
  }
  useEffect(() => { cargar() }, [])

  async function guardar() {
    if (!form.titulo) { alert('Completá el título'); return }
    setGuardando(true)
    const { error } = await supabase.from('novedades').insert(form)
    if (error) { alert('Error al guardar: ' + error.message); setGuardando(false); return }
    await cargar()
    setForm({ fecha: hoyLocal(), modulo: 'General', titulo: '', descripcion: '' })
    setShowForm(false)
    setGuardando(false)
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar esta novedad?')) return
    await supabase.from('novedades').delete().eq('id', id)
    cargar()
  }

  if (loading) return <Loader />

  // Agrupar por mes para que sea más fácil de recorrer
  const porMes = {}
  novedades.forEach(n => {
    const mes = new Date(n.fecha + 'T12:00:00').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    if (!porMes[mes]) porMes[mes] = []
    porMes[mes].push(n)
  })

  const inputStyle = { width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 3 }}>📋 Novedades</div>
          <div style={{ fontSize: 12, color: S.muted, fontFamily: 'monospace' }}>Qué se agregó o cambió en el sistema, con fecha</div>
        </div>
        {esDueno && (
          <button onClick={() => setShowForm(!showForm)}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.accent, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
            {showForm ? 'Cancelar' : '+ Agregar novedad'}
          </button>
        )}
      </div>

      {showForm && (
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Fecha</div>
              <input type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Módulo</div>
              <select value={form.modulo} onChange={e => setForm({...form, modulo: e.target.value})} style={inputStyle}>
                {['General', 'Feedlot', 'Sanidad', 'Agricultura', 'Cheques', 'Contactos'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Título</div>
            <input type="text" value={form.titulo} onChange={e => setForm({...form, titulo: e.target.value})} style={inputStyle} placeholder="ej. Retiro parcial de insumos" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Descripción (opcional)</div>
            <textarea value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <button onClick={guardar} disabled={guardando} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.green, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
            {guardando ? 'Guardando...' : '💾 Guardar'}
          </button>
        </div>
      )}

      {novedades.length === 0 && (
        <div style={{ padding: '2rem', textAlign: 'center', color: S.hint, fontSize: 13 }}>Todavía no hay novedades cargadas.</div>
      )}

      {Object.entries(porMes).map(([mes, items]) => (
        <div key={mes} style={{ marginBottom: '1.75rem' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: S.muted, textTransform: 'capitalize', marginBottom: 10 }}>{mes}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map(n => (
              <div key={n.id} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: MODULOS_COLOR[n.modulo] || S.muted, padding: '2px 8px', borderRadius: 4 }}>{n.modulo || 'General'}</span>
                      <span style={{ fontSize: 11, color: S.hint, fontFamily: 'monospace' }}>{new Date(n.fecha + 'T12:00:00').toLocaleDateString('es-AR')}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: n.descripcion ? 4 : 0 }}>{n.titulo}</div>
                    {n.descripcion && <div style={{ fontSize: 13, color: S.muted, lineHeight: 1.5 }}>{n.descripcion}</div>}
                  </div>
                  {esDueno && (
                    <button onClick={() => eliminar(n.id)} style={{ background: 'none', border: 'none', color: S.hint, cursor: 'pointer', fontSize: 13 }}>✕</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
} 
