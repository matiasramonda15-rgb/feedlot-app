import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Card, Btn, Badge, Loader } from './Tablero'

const PRODUCTOS = ['Alliance+Feedlot', 'Ivermectina', 'Vitamina ADE', 'Antiparasitario', 'Antibiótico', 'Otro']
const TIPOS = [
  { key: 'ingreso', label: 'Protocolo ingreso', color: '#E8EFF8', border: '#378ADD', text: '#1A3D6B' },
  { key: 'segunda_dosis', label: 'Segunda dosis', color: '#FDF0E0', border: '#EF9F27', text: '#7A4500' },
  { key: 'revision', label: 'Revisión bisemanal', color: '#E8F4EB', border: '#7BC67A', text: '#1E5C2E' },
  { key: 'tratamiento', label: 'Tratamiento', color: '#FDF0F0', border: '#F09595', text: '#7A1A1A' },
]

export default function Sanidad({ usuario }) {
  const [eventos, setEventos] = useState([])
  const [corrales, setCorrales] = useState([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState('lista')
  const [form, setForm] = useState({ tipo: 'ingreso', corral_id: '', producto: 'Alliance+Feedlot', cantidad_animales: '', dosis: '', observaciones: '' })
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    const [{ data: e }, { data: c }] = await Promise.all([
      supabase.from('eventos_sanitarios').select('*, corrales(numero)').order('creado_en', { ascending: false }).limit(30),
      supabase.from('corrales').select('*').not('rol', 'eq', 'libre').not('rol', 'eq', 'deshabilitado').order('numero'),
    ])
    setEventos(e || [])
    setCorrales(c || [])
    setLoading(false)
  }

  async function guardarEvento() {
    if (!form.corral_id) { alert('Seleccioná un corral'); return }
    if (!form.cantidad_animales) { alert('Ingresá la cantidad de animales'); return }
    setGuardando(true)

    const { error } = await supabase.from('eventos_sanitarios').insert({
      tipo: form.tipo,
      corral_id: parseInt(form.corral_id),
      producto: form.producto,
      cantidad_animales: parseInt(form.cantidad_animales),
      dosis: form.dosis || null,
      observaciones: form.observaciones || null,
      registrado_por: usuario?.id,
    })

    if (!error) {
      await cargarDatos()
      setVista('lista')
      setForm({ tipo: 'ingreso', corral_id: '', producto: 'Alliance+Feedlot', cantidad_animales: '', dosis: '', observaciones: '' })
    }
    setGuardando(false)
  }

  if (loading) return <Loader />

  if (vista === 'nuevo') {
    const tipoInfo = TIPOS.find(t => t.key === form.tipo)
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>
          <Btn ghost sm onClick={() => setVista('lista')}>← Volver</Btn>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600 }}>Nuevo evento sanitario</h1>
            <div style={{ fontSize: 12, color: '#6B6760', fontFamily: "'IBM Plex Mono', monospace" }}>Registro de sanidad · feedlot</div>
          </div>
        </div>

        <Card titulo="Tipo de evento">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {TIPOS.map(t => (
              <div key={t.key} onClick={() => setForm({...form, tipo: t.key})}
                style={{ padding: '10px 14px', borderRadius: 8, border: `2px solid ${form.tipo === t.key ? t.border : '#E2DDD6'}`, background: form.tipo === t.key ? t.color : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: form.tipo === t.key ? 600 : 400, color: form.tipo === t.key ? t.text : '#6B6760' }}>
                {t.label}
              </div>
            ))}
          </div>
        </Card>

        <Card titulo="Datos del evento">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B6760', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>Corral</label>
              <select style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2DDD6', borderRadius: 8, fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif", background: '#fff' }}
                value={form.corral_id} onChange={e => setForm({...form, corral_id: e.target.value})}>
                <option value="">— Seleccioná —</option>
                {corrales.map(c => <option key={c.id} value={c.id}>Corral {c.numero} · {c.animales || 0} anim.</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B6760', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>Cantidad animales</label>
              <input type="number" min="0" placeholder="0"
                value={form.cantidad_animales} onChange={e => setForm({...form, cantidad_animales: e.target.value})}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2DDD6', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B6760', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>Producto</label>
              <select style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2DDD6', borderRadius: 8, fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif", background: '#fff' }}
                value={form.producto} onChange={e => setForm({...form, producto: e.target.value})}>
                {PRODUCTOS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B6760', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>Dosis</label>
              <input type="text" placeholder="ej. 1 ml/kg"
                value={form.dosis} onChange={e => setForm({...form, dosis: e.target.value})}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2DDD6', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
          </div>
          <textarea placeholder="Observaciones (opcional)"
            value={form.observaciones} onChange={e => setForm({...form, observaciones: e.target.value})}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2DDD6', borderRadius: 8, fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif", minHeight: 80, resize: 'vertical', boxSizing: 'border-box' }} />
        </Card>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn ghost onClick={() => setVista('lista')}>Cancelar</Btn>
          <Btn onClick={guardarEvento} disabled={guardando}>{guardando ? 'Guardando...' : '✓ Registrar evento'}</Btn>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Sanidad</h1>
          <div style={{ fontSize: 12, color: '#6B6760', fontFamily: "'IBM Plex Mono', monospace" }}>Protocolo: Alliance+Feedlot al ingreso · 2da dosis si &lt;180 kg a los 20 días · Revisión lunes y jueves</div>
        </div>
        <Btn onClick={() => setVista('nuevo')}>+ Nuevo evento</Btn>
      </div>

      <Card titulo="Historial sanitario">
        {eventos.length === 0
          ? <p style={{ fontSize: 13, color: '#9E9A94', padding: '.5rem 0' }}>No hay eventos registrados aún.</p>
          : eventos.map(e => {
            const t = TIPOS.find(x => x.key === e.tipo) || TIPOS[0]
            return (
              <div key={e.id} style={{ padding: '.75rem 0', borderBottom: '1px solid #E2DDD6', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.border, flexShrink: 0, marginTop: 5 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>Corral {e.corrales?.numero}</span>
                    <span style={{ background: t.color, color: t.text, border: `1px solid ${t.border}`, borderRadius: 5, padding: '1px 7px', fontSize: 11, fontWeight: 600 }}>{t.label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6B6760' }}>
                    {e.producto} · {e.cantidad_animales} animales {e.dosis ? `· ${e.dosis}` : ''}
                  </div>
                  {e.observaciones && <div style={{ fontSize: 12, color: '#9E9A94', marginTop: 2 }}>{e.observaciones}</div>}
                  <div style={{ fontSize: 11, color: '#9E9A94', marginTop: 2, fontFamily: "'IBM Plex Mono', monospace" }}>
                    {new Date(e.creado_en).toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                </div>
              </div>
            )
          })
        }
      </Card>
    </div>
  )
}
