import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Card, Btn, Badge, Loader } from './Tablero'

export default function Ventas({ usuario }) {
  const [ventas, setVentas] = useState([])
  const [corrales, setCorrales] = useState([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState('lista')
  const [form, setForm] = useState({ corral_id: '', cantidad: '', kg_vivo: '', precio_kg: '', comprador: '', observaciones: '' })
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    const [{ data: v }, { data: c }] = await Promise.all([
      supabase.from('ventas').select('*, corrales(numero)').order('creado_en', { ascending: false }).limit(30),
      supabase.from('corrales').select('*').in('rol', ['clasificado','acumulacion','cuarentena']).order('numero'),
    ])
    setVentas(v || [])
    setCorrales(c || [])
    setLoading(false)
  }

  async function guardarVenta() {
    if (!form.corral_id) { alert('Seleccioná un corral'); return }
    if (!form.cantidad || !form.kg_vivo || !form.precio_kg) { alert('Completá cantidad, kg vivo y precio'); return }
    setGuardando(true)

    const kg_vivo = parseFloat(form.kg_vivo)
    const desbaste = kg_vivo * 0.08
    const kg_neto = kg_vivo - desbaste
    const total = kg_neto * parseFloat(form.precio_kg)

    const { error } = await supabase.from('ventas').insert({
      corral_id: parseInt(form.corral_id),
      cantidad: parseInt(form.cantidad),
      kg_vivo_total: kg_vivo,
      desbaste_pct: 8,
      kg_neto: Math.round(kg_neto * 100) / 100,
      precio_kg: parseFloat(form.precio_kg),
      total: Math.round(total),
      comprador: form.comprador || null,
      observaciones: form.observaciones || null,
      registrado_por: usuario?.id,
    })

   if (!error) {
      // Actualizar animales en corral
      if (form.corral_id) {
        const { data: corral } = await supabase.from('corrales').select('animales').eq('id', form.corral_id).single()
        const nuevosAnimales = Math.max(0, (corral?.animales || 0) - parseInt(form.cantidad))
        await supabase.from('corrales').update({ animales: nuevosAnimales }).eq('id', form.corral_id)
      }
      await cargarDatos()
      setVista('lista')
      setForm({ corral_id: '', cantidad: '', kg_vivo: '', precio_kg: '', comprador: '', observaciones: '' })
    }
    setGuardando(false)
  }

  if (loading) return <Loader />

  if (vista === 'nueva') {
    const kg_vivo = parseFloat(form.kg_vivo) || 0
    const desbaste = kg_vivo * 0.08
    const kg_neto = kg_vivo - desbaste
    const total = kg_neto * (parseFloat(form.precio_kg) || 0)

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>
          <Btn ghost sm onClick={() => setVista('lista')}>← Volver</Btn>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600 }}>Nueva venta</h1>
            <div style={{ fontSize: 12, color: '#6B6760', fontFamily: "'IBM Plex Mono', monospace" }}>Venta kg vivo en campo · desbaste 8%</div>
          </div>
        </div>

        <Card titulo="Datos de la venta">
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
                value={form.cantidad} onChange={e => setForm({...form, cantidad: e.target.value})}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2DDD6', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B6760', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>KG vivo total (báscula)</label>
              <input type="number" min="0" placeholder="0"
                value={form.kg_vivo} onChange={e => setForm({...form, kg_vivo: e.target.value})}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2DDD6', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B6760', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>Precio $/kg</label>
              <input type="number" min="0" placeholder="0"
                value={form.precio_kg} onChange={e => setForm({...form, precio_kg: e.target.value})}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2DDD6', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B6760', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>Comprador</label>
              <input type="text" placeholder="Nombre del comprador"
                value={form.comprador} onChange={e => setForm({...form, comprador: e.target.value})}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2DDD6', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
          </div>

          {kg_vivo > 0 && (
            <div style={{ background: '#1A3D6B', borderRadius: 10, padding: '1rem 1.25rem', marginBottom: 12, color: '#fff' }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', opacity: .6, marginBottom: 10 }}>Resumen liquidación</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
                {[
                  { label: 'KG vivo', value: kg_vivo.toLocaleString('es-AR') + ' kg' },
                  { label: 'Desbaste 8%', value: desbaste.toLocaleString('es-AR', {maximumFractionDigits:0}) + ' kg' },
                  { label: 'KG neto', value: kg_neto.toLocaleString('es-AR', {maximumFractionDigits:0}) + ' kg' },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize: 10, opacity: .55, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{s.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>{s.value}</div>
                  </div>
                ))}
              </div>
              {total > 0 && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.15)' }}>
                  <div style={{ fontSize: 10, opacity: .55, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>Total estimado</div>
                  <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: '#7EE8A2' }}>
                    ${total.toLocaleString('es-AR', {maximumFractionDigits:0})}
                  </div>
                </div>
              )}
            </div>
          )}

          <textarea placeholder="Observaciones (opcional)"
            value={form.observaciones} onChange={e => setForm({...form, observaciones: e.target.value})}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2DDD6', borderRadius: 8, fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif", minHeight: 70, resize: 'vertical', boxSizing: 'border-box' }} />
        </Card>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn ghost onClick={() => setVista('lista')}>Cancelar</Btn>
          <Btn onClick={guardarVenta} disabled={guardando}>{guardando ? 'Guardando...' : '✓ Registrar venta'}</Btn>
        </div>
      </div>
    )
  }

  const totalVendido = ventas.reduce((s, v) => s + (v.total || 0), 0)
  const totalAnimales = ventas.reduce((s, v) => s + (v.cantidad || 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Compra / Venta</h1>
          <div style={{ fontSize: 12, color: '#6B6760', fontFamily: "'IBM Plex Mono', monospace" }}>Objetivo: 400 kg · Desbaste: 8%</div>
        </div>
        <Btn onClick={() => setVista('nueva')}>+ Nueva venta</Btn>
      </div>

      {ventas.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: '1.25rem' }}>
          <div style={{ background: '#fff', border: '1px solid #E2DDD6', borderRadius: 8, padding: '1rem' }}>
            <div style={{ fontSize: 11, color: '#6B6760', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Total vendido</div>
            <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace" }}>{totalAnimales} animales</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #E2DDD6', borderRadius: 8, padding: '1rem' }}>
            <div style={{ fontSize: 11, color: '#6B6760', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Facturación total</div>
            <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", color: '#1E5C2E' }}>${totalVendido.toLocaleString('es-AR', {maximumFractionDigits:0})}</div>
          </div>
        </div>
      )}

      <Card titulo="Historial de ventas">
        {ventas.length === 0
          ? <p style={{ fontSize: 13, color: '#9E9A94', padding: '.5rem 0' }}>No hay ventas registradas aún.</p>
          : ventas.map(v => (
            <div key={v.id} style={{ padding: '.75rem 0', borderBottom: '1px solid #E2DDD6' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>
                  Corral {v.corrales?.numero} · {v.cantidad} animales
                </div>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: '#1E5C2E', fontSize: 14 }}>
                  ${(v.total || 0).toLocaleString('es-AR', {maximumFractionDigits:0})}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#6B6760' }}>
                {v.kg_vivo_total} kg vivo → {v.kg_neto} kg neto · ${v.precio_kg}/kg
                {v.comprador ? ` · ${v.comprador}` : ''}
              </div>
              <div style={{ fontSize: 11, color: '#9E9A94', marginTop: 2, fontFamily: "'IBM Plex Mono', monospace" }}>
                {new Date(v.creado_en).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
            </div>
          ))
        }
      </Card>
    </div>
  )
}
