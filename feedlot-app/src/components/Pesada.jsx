import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Card, Btn, Badge, Loader } from './Tablero'

const RANGOS = [
  { key: 'A', label: 'Rango A', rango: '200-230 kg', color: '#E8F4EB', border: '#7BC67A', text: '#1E5C2E' },
  { key: 'B', label: 'Rango B', rango: '231-260 kg', color: '#E8EFF8', border: '#378ADD', text: '#1A3D6B' },
  { key: 'C', label: 'Rango C', rango: '261-290 kg', color: '#F0EAFB', border: '#9F8ED4', text: '#3D1A6B' },
  { key: 'D', label: 'Rango D', rango: '291+ kg',    color: '#FDF0E0', border: '#EF9F27', text: '#7A4500' },
]

export default function Pesada({ usuario }) {
  const [corrales, setCorrales] = useState([])
  const [pesadas, setPesadas] = useState([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState('lista')
  const [corralSel, setCorralSel] = useState('')
  const [form, setForm] = useState({ A: '', B: '', C: '', D: '', menores: '', observaciones: '' })
  const [guardando, setGuardando] = useState(false)
  const [proximaFecha, setProximaFecha] = useState('')
  const [editandoFecha, setEditandoFecha] = useState(false)
  const [nuevaFecha, setNuevaFecha] = useState('')
  const esDueno = ['dueno', 'secretaria'].includes(usuario?.rol)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    const [{ data: c }, { data: p }, { data: cfg }] = await Promise.all([
      supabase.from('corrales').select('*').not('rol', 'eq', 'libre').not('rol', 'eq', 'deshabilitado').order('id'),
      supabase.from('pesadas').select('*, corrales(numero), pesada_animales(*)').order('creado_en', { ascending: false }).limit(20),
      supabase.from('configuracion').select('valor').eq('clave', 'proxima_pesada').single(),
    ])
    setCorrales(c || [])
    setPesadas(p || [])
    if (cfg?.valor) setProximaFecha(cfg.valor)
    setLoading(false)
  }

  async function guardarFecha() {
    if (!nuevaFecha) return
    await supabase.from('configuracion').update({ valor: nuevaFecha, actualizado_en: new Date().toISOString() }).eq('clave', 'proxima_pesada')
    setProximaFecha(nuevaFecha)
    setEditandoFecha(false)
    setNuevaFecha('')
  }

  async function guardarPesada() {
    if (!corralSel) { alert('Selecciona un corral'); return }
    const rangoA = parseInt(form.A) || 0
    const rangoB = parseInt(form.B) || 0
    const rangoC = parseInt(form.C) || 0
    const rangoD = parseInt(form.D) || 0
    const menores = parseInt(form.menores) || 0
    const total = rangoA + rangoB + rangoC + rangoD + menores
    if (total === 0) { alert('Ingresa al menos un animal'); return }
    setGuardando(true)

    const corralId = parseInt(corralSel)

    const { data: pesada, error } = await supabase.from('pesadas').insert({
      corral_id: corralId,
      tipo: 'clasificacion',
      registrado_por: usuario?.id || null,
      observaciones: form.observaciones || null,
    }).select().single()

    if (!error && pesada) {
      const animales = []
      if (rangoA > 0) animales.push({ pesada_id: pesada.id, rango: 'A', cantidad: rangoA })
      if (rangoB > 0) animales.push({ pesada_id: pesada.id, rango: 'B', cantidad: rangoB })
      if (rangoC > 0) animales.push({ pesada_id: pesada.id, rango: 'C', cantidad: rangoC })
      if (rangoD > 0) animales.push({ pesada_id: pesada.id, rango: 'D', cantidad: rangoD })
      if (menores > 0) animales.push({ pesada_id: pesada.id, rango: 'menores', cantidad: menores })
      await supabase.from('pesada_animales').insert(animales)

      const { data: origen } = await supabase.from('corrales').select('animales').eq('id', corralId).single()
      await supabase.from('corrales').update({ animales: Math.max(0, (origen?.animales || 0) - total) }).eq('id', corralId)

      const destinos = [
        { numero: '2', cantidad: rangoA },
        { numero: '4', cantidad: rangoB },
        { numero: '7', cantidad: rangoC },
        { numero: '5', cantidad: rangoD },
      ]
      for (const d of destinos) {
        if (d.cantidad > 0) {
          const { data: dc } = await supabase.from('corrales').select('animales').eq('numero', d.numero).single()
          await supabase.from('corrales').update({ animales: (dc?.animales || 0) + d.cantidad }).eq('numero', d.numero)
        }
      }

      if (menores > 0) {
        const { data: ac } = await supabase.from('corrales').select('animales').eq('numero', '13').single()
        await supabase.from('corrales').update({ animales: (ac?.animales || 0) + menores }).eq('numero', '13')
      }

      // Actualizar proxima pesada automaticamente +40 dias
      const nuevaProxima = new Date(pesada.creado_en)
      nuevaProxima.setDate(nuevaProxima.getDate() + 40)
      const nuevaProximaStr = nuevaProxima.toISOString().split('T')[0]
      await supabase.from('configuracion').update({ valor: nuevaProximaStr, actualizado_en: new Date().toISOString() }).eq('clave', 'proxima_pesada')
      setProximaFecha(nuevaProximaStr)

      await cargarDatos()
      setVista('lista')
      setForm({ A: '', B: '', C: '', D: '', menores: '', observaciones: '' })
      setCorralSel('')
    } else {
      alert('Error al guardar. Intenta de nuevo.')
    }
    setGuardando(false)
  }

  async function eliminarPesada(id) {
    if (!confirm('Eliminar esta pesada?')) return
    await supabase.from('pesada_animales').delete().eq('pesada_id', id)
    await supabase.from('pesadas').delete().eq('id', id)
    await cargarDatos()
  }

  if (loading) return <Loader />

  const proximaDate = proximaFecha ? new Date(proximaFecha + 'T12:00:00') : null
  const diasRestantes = proximaDate ? Math.ceil((proximaDate - new Date()) / (1000 * 60 * 60 * 24)) : null
  const alertaProxima = diasRestantes !== null && diasRestantes <= 7

  if (vista === 'nueva') {
    const totalIngresado = ['A','B','C','D'].reduce((s,k) => s + (parseInt(form[k])||0), 0)
    const corral = corrales.find(c => c.id === parseInt(corralSel))

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>
          <Btn ghost sm onClick={() => setVista('lista')}>Volver</Btn>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600 }}>Nueva pesada</h1>
            <div style={{ fontSize: 12, color: '#6B6760' }}>Clasificacion por rangos de peso</div>
          </div>
        </div>

        <Card titulo="Corral a pesar">
          <select style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2DDD6', borderRadius: 8, fontSize: 13, background: '#fff' }}
            value={corralSel} onChange={e => setCorralSel(e.target.value)}>
            <option value="">Selecciona un corral</option>
            {corrales.map(c => (
              <option key={c.id} value={String(c.id)}>Corral {c.numero} - {c.rol} - {c.animales || 0} animales</option>
            ))}
          </select>
          {corral && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: '#F7F5F0', borderRadius: 8, fontSize: 12, color: '#6B6760' }}>
              Total animales en corral: <strong>{corral.animales || 0}</strong>
            </div>
          )}
        </Card>

        <Card titulo="Distribucion por rangos">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {RANGOS.map(r => (
              <div key={r.key} style={{ background: r.color, border: `1px solid ${r.border}`, borderRadius: 8, padding: '1rem' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: r.text, textTransform: 'uppercase', marginBottom: 4 }}>
                  {r.label} - {r.rango}
                </div>
                <input type="number" min="0" placeholder="0" value={form[r.key]}
                  onChange={e => setForm({...form, [r.key]: e.target.value})}
                  style={{ width: '100%', padding: '8px 10px', border: `1px solid ${r.border}`, borderRadius: 6, fontSize: 16, fontWeight: 600, background: '#fff', boxSizing: 'border-box' }}
                />
              </div>
            ))}
          </div>

          <div style={{ background: '#FDF0F0', border: '1px solid #F09595', borderRadius: 8, padding: '1rem', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#7A1A1A', textTransform: 'uppercase', marginBottom: 4 }}>
              Menores de 200 kg - vuelven a acumulacion
            </div>
            <input type="number" min="0" placeholder="0" value={form.menores}
              onChange={e => setForm({...form, menores: e.target.value})}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #F09595', borderRadius: 6, fontSize: 16, fontWeight: 600, background: '#fff', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ padding: '10px 12px', background: '#F7F5F0', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
            <span style={{ color: '#6B6760' }}>Total clasificado: </span>
            <span style={{ fontWeight: 600 }}>{totalIngresado} animales</span>
          </div>

          <textarea placeholder="Observaciones (opcional)" value={form.observaciones}
            onChange={e => setForm({...form, observaciones: e.target.value})}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2DDD6', borderRadius: 8, fontSize: 13, minHeight: 80, resize: 'vertical', boxSizing: 'border-box' }}
          />
        </Card>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn ghost onClick={() => setVista('lista')}>Cancelar</Btn>
          <Btn onClick={guardarPesada} disabled={guardando}>
            {guardando ? 'Guardando...' : 'Registrar pesada'}
          </Btn>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Pesada y clasificacion</h1>
          <div style={{ fontSize: 12, color: '#6B6760' }}>Rangos: A=200-230 - B=231-260 - C=261-290 - D=291+ - Objetivo: 400 kg</div>
        </div>
        <Btn onClick={() => setVista('nueva')}>+ Nueva pesada</Btn>
      </div>

      {/* Alerta proxima pesada */}
      <div style={{
        background: alertaProxima ? '#FDF0E0' : '#E8F4EB',
        border: `1px solid ${alertaProxima ? '#EF9F27' : '#7BC67A'}`,
        borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '1.25rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600, color: alertaProxima ? '#7A4500' : '#1E5C2E', fontSize: 13, marginBottom: 3 }}>
              {alertaProxima ? 'Pesada proxima' : 'Proxima pesada fija'}
            </div>
            {!editandoFecha && (
              <div style={{ color: alertaProxima ? '#7A4500' : '#1E5C2E', fontSize: 12 }}>
                {proximaDate ? proximaDate.toLocaleDateString('es-AR') : 'No configurada'}
                {diasRestantes !== null && (
                  <span style={{ marginLeft: 8, fontWeight: 600 }}>
                    {diasRestantes <= 0 ? '- Realizar hoy' : `- en ${diasRestantes} dias`}
                  </span>
                )}
              </div>
            )}
            {editandoFecha && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                <input type="date" value={nuevaFecha} onChange={e => setNuevaFecha(e.target.value)}
                  style={{ padding: '6px 10px', border: '1px solid #E2DDD6', borderRadius: 6, fontSize: 13 }} />
                <button onClick={guardarFecha}
                  style={{ background: '#1E5C2E', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, color: '#fff', cursor: 'pointer' }}>
                  Guardar
                </button>
                <button onClick={() => setEditandoFecha(false)}
                  style={{ background: 'transparent', border: '1px solid #E2DDD6', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#6B6760', cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            )}
          </div>
          {esDueno && !editandoFecha && (
            <button onClick={() => { setEditandoFecha(true); setNuevaFecha(proximaFecha) }}
              style={{ background: 'transparent', border: '1px solid #E2DDD6', borderRadius: 6, padding: '5px 10px', fontSize: 11, color: '#6B6760', cursor: 'pointer' }}>
              Modificar fecha
            </button>
          )}
        </div>
      </div>

      <Card titulo="Historial de pesadas">
        {pesadas.length === 0
          ? <p style={{ fontSize: 13, color: '#9E9A94', padding: '.5rem 0' }}>No hay pesadas registradas.</p>
          : pesadas.map(p => (
            <div key={p.id} style={{ padding: '.75rem 0', borderBottom: '1px solid #E2DDD6' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>
                  Corral {p.corrales?.numero} - {new Date(p.creado_en).toLocaleDateString('es-AR')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Badge info>{p.tipo}</Badge>
                  {esDueno && <button onClick={() => eliminarPesada(p.id)} style={{ background: '#FDF0F0', border: '1px solid #F09595', borderRadius: 6, color: '#7A1A1A', fontSize: 11, padding: '3px 8px', cursor: 'pointer' }}>Borrar</button>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(p.pesada_animales || []).map(a => {
                  const r = RANGOS.find(x => x.key === a.rango)
                  return r ? (
                    <span key={a.id} style={{ background: r.color, color: r.text, border: `1px solid ${r.border}`, borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                      {r.label}: {a.cantidad}
                    </span>
                  ) : (
                    <span key={a.id} style={{ background: '#FDF0F0', color: '#7A1A1A', border: '1px solid #F09595', borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                      menos200kg: {a.cantidad}
                    </span>
                  )
                })}
              </div>
              {p.observaciones && <div style={{ fontSize: 12, color: '#9E9A94', marginTop: 4 }}>{p.observaciones}</div>}
            </div>
          ))
        }
      </Card>
    </div>
  )
}
