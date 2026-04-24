import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Card, Btn, Loader } from './Tablero'

const MIXERS = ['Mixer 1', 'Mixer 2', 'Mixer 3']
const FORMULAS = ['Engorde inicial', 'Engorde medio', 'Terminación', 'Mantenimiento']

export default function Alimentacion({ usuario }) {
  const [raciones, setRaciones] = useState([])
  const [corrales, setCorrales] = useState([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState('lista')
  const [form, setForm] = useState({ mixer: 'Mixer 1', corral_id: '', formula: 'Engorde inicial', kg_total: '', observaciones: '' })
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    const [{ data: r }, { data: c }] = await Promise.all([
      supabase.from('raciones_diarias').select('*, corrales(numero)').order('creado_en', { ascending: false }).limit(30),
      supabase.from('corrales').select('*').not('rol', 'eq', 'libre').not('rol', 'eq', 'deshabilitado').order('numero'),
    ])
    setRaciones(r || [])
    setCorrales(c || [])
    setLoading(false)
  }

  async function guardarRacion() {
    if (!form.corral_id) { alert('Seleccioná un corral'); return }
    if (!form.kg_total) { alert('Ingresá los kg totales'); return }
    setGuardando(true)

    const { error } = await supabase.from('raciones_diarias').insert({
      mixer: form.mixer,
      corral_id: parseInt(form.corral_id),
      formula: form.formula,
      kg_total: parseFloat(form.kg_total),
      observaciones: form.observaciones || null,
      registrado_por: usuario?.id,
    })

    if (!error) {
      await cargarDatos()
      setVista('lista')
      setForm({ mixer: 'Mixer 1', corral_id: '', formula: 'Engorde inicial', kg_total: '', observaciones: '' })
    }
    setGuardando(false)
  }

  if (loading) return <Loader />

  if (vista === 'nueva') {
    const corral = corrales.find(c => c.id === parseInt(form.corral_id))
    const kgPorAnimal = corral && form.kg_total ? (parseFloat(form.kg_total) / (corral.animales || 1)).toFixed(1) : null

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>
          <Btn ghost sm onClick={() => setVista('lista')}>← Volver</Btn>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600 }}>Registrar ración</h1>
            <div style={{ fontSize: 12, color: '#6B6760', fontFamily: "'IBM Plex Mono', monospace" }}>Registro diario de mixers</div>
          </div>
        </div>

        <Card titulo="Datos de la ración">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B6760', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>Mixer</label>
              <select style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2DDD6', borderRadius: 8, fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif", background: '#fff' }}
                value={form.mixer} onChange={e => setForm({...form, mixer: e.target.value})}>
                {MIXERS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B6760', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>Corral</label>
              <select style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2DDD6', borderRadius: 8, fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif", background: '#fff' }}
                value={form.corral_id} onChange={e => setForm({...form, corral_id: e.target.value})}>
                <option value="">— Seleccioná —</option>
                {corrales.map(c => <option key={c.id} value={c.id}>Corral {c.numero} · {c.animales || 0} anim.</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B6760', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>Fórmula</label>
              <select style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2DDD6', borderRadius: 8, fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif", background: '#fff' }}
                value={form.formula} onChange={e => setForm({...form, formula: e.target.value})}>
                {FORMULAS.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B6760', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>KG totales</label>
              <input type="number" min="0" placeholder="0"
                value={form.kg_total} onChange={e => setForm({...form, kg_total: e.target.value})}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2DDD6', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
          </div>

          {kgPorAnimal && (
            <div style={{ padding: '10px 12px', background: '#F7F5F0', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
              <span style={{ color: '#6B6760' }}>KG por animal estimado: </span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>{kgPorAnimal} kg</span>
            </div>
          )}

          <textarea placeholder="Observaciones (opcional)"
            value={form.observaciones} onChange={e => setForm({...form, observaciones: e.target.value})}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2DDD6', borderRadius: 8, fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif", minHeight: 80, resize: 'vertical', boxSizing: 'border-box' }} />
        </Card>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn ghost onClick={() => setVista('lista')}>Cancelar</Btn>
          <Btn onClick={guardarRacion} disabled={guardando}>{guardando ? 'Guardando...' : '✓ Registrar ración'}</Btn>
        </div>
      </div>
    )
  }

  const hoy = new Date().toLocaleDateString('es-AR')
  const racionesHoy = raciones.filter(r => new Date(r.creado_en).toLocaleDateString('es-AR') === hoy)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Alimentación</h1>
          <div style={{ fontSize: 12, color: '#6B6760', fontFamily: "'IBM Plex Mono', monospace" }}>Registro diario de mixers y raciones</div>
        </div>
        <Btn onClick={() => setVista('nueva')}>+ Registrar ración</Btn>
      </div>

      {racionesHoy.length > 0 && (
        <div style={{ background: '#E8F4EB', border: '1px solid #7BC67A', borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '1.25rem', fontSize: 13, color: '#1E5C2E' }}>
          <strong>Hoy:</strong> {racionesHoy.length} raciones registradas · {racionesHoy.reduce((s, r) => s + (r.kg_total || 0), 0).toFixed(0)} kg totales
        </div>
      )}

      <Card titulo="Historial de raciones">
        {raciones.length === 0
          ? <p style={{ fontSize: 13, color: '#9E9A94', padding: '.5rem 0' }}>No hay raciones registradas aún.</p>
          : raciones.map(r => (
            <div key={r.id} style={{ padding: '.75rem 0', borderBottom: '1px solid #E2DDD6', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#639922', flexShrink: 0, marginTop: 5 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{r.mixer} · Corral {r.corrales?.numero}</span>
                  <span style={{ background: '#E8F4EB', color: '#1E5C2E', border: '1px solid #7BC67A', borderRadius: 5, padding: '1px 7px', fontSize: 11, fontWeight: 600 }}>{r.kg_total} kg</span>
                </div>
                <div style={{ fontSize: 12, color: '#6B6760' }}>{r.formula}</div>
                {r.observaciones && <div style={{ fontSize: 12, color: '#9E9A94', marginTop: 2 }}>{r.observaciones}</div>}
                <div style={{ fontSize: 11, color: '#9E9A94', marginTop: 2, fontFamily: "'IBM Plex Mono', monospace" }}>
                  {new Date(r.creado_en).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
              </div>
            </div>
          ))
        }
      </Card>
    </div>
  )
}
