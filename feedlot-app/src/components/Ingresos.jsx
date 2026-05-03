import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Card, Btn, Badge, Loader } from './Tablero'

export default function Ingresos({ usuario }) {
  const [lotes, setLotes] = useState([])
  const [corrales, setCorrales] = useState([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState('lista')
  const [form, setForm] = useState({
    procedencia: 'Remate ROSGAN', categoria: 'Novillos 2-3 anos',
    cantidad: '', kg_bascula: '', observaciones: '', corral_cuarentena_id: ''
  })
  const [guardando, setGuardando] = useState(false)
  const esDueno = ['dueno', 'secretaria'].includes(usuario?.rol)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    const [{ data: l }, { data: c }] = await Promise.all([
      supabase.from('lotes').select('*, corrales:corral_cuarentena_id(numero)').order('created_at', { ascending: false }),
      supabase.from('corrales').select('*').eq('rol', 'cuarentena').order('numero'),
    ])
    setLotes(l || [])
    setCorrales(c || [])
    setLoading(false)
  }

  async function guardarIngreso() {
    if (!form.cantidad || !form.kg_bascula) { alert('Completa cantidad y kg bascula'); return }
    setGuardando(true)
    const codigo = `L-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`
    const peso_prom = parseFloat(form.kg_bascula) / parseInt(form.cantidad)

    const { error } = await supabase.from('lotes').insert({
      codigo,
      fecha_ingreso: new Date().toISOString().split('T')[0],
      procedencia: form.procedencia,
      categoria: form.categoria,
      cantidad: parseInt(form.cantidad),
      kg_bascula: parseFloat(form.kg_bascula),
      peso_prom_ingreso: Math.round(peso_prom * 100) / 100,
      corral_cuarentena_id: form.corral_cuarentena_id || null,
      observaciones: form.observaciones || null,
      registrado_por: usuario?.id,
    })

    if (!error) {
      const fechaFin = new Date(); fechaFin.setDate(fechaFin.getDate() + 10)
      await supabase.from('alertas').insert({
        tipo: 'cuarentena_vence',
        titulo: `Pase a acumulacion - ${codigo}`,
        descripcion: `${form.cantidad} animales terminan cuarentena`,
        fecha_vence: fechaFin.toISOString().split('T')[0],
      })

      if (peso_prom < 180) {
        const fecha2da = new Date(); fecha2da.setDate(fecha2da.getDate() + 20)
        await supabase.from('alertas').insert({
          tipo: 'segunda_dosis',
          titulo: `Segunda dosis Alliance+Feedlot - ${codigo}`,
          descripcion: `${form.cantidad} animales ingresaron con ${Math.round(peso_prom)} kg prom.`,
          fecha_vence: fecha2da.toISOString().split('T')[0],
        })
      }

      if (form.corral_cuarentena_id) {
        const { data: corral } = await supabase.from('corrales').select('animales').eq('id', form.corral_cuarentena_id).single()
        await supabase.from('corrales').update({
          animales: (corral?.animales || 0) + parseInt(form.cantidad),
          rol: 'cuarentena'
        }).eq('id', form.corral_cuarentena_id)
      }

      await cargarDatos()
      setVista('lista')
      setForm({ procedencia: 'Remate ROSGAN', categoria: 'Novillos 2-3 anos', cantidad: '', kg_bascula: '', observaciones: '', corral_cuarentena_id: '' })
    }
    setGuardando(false)
  }

  async function eliminarLote(id) {
    if (!confirm('Eliminar este ingreso?')) return
    const { data: lote } = await supabase.from('lotes').select('cantidad, corral_cuarentena_id').eq('id', id).single()
    if (lote?.corral_cuarentena_id && lote?.cantidad) {
      const { data: corral } = await supabase.from('corrales').select('animales').eq('id', lote.corral_cuarentena_id).single()
      await supabase.from('corrales').update({ animales: Math.max(0, (corral?.animales || 0) - lote.cantidad) }).eq('id', lote.corral_cuarentena_id)
    }
    await supabase.from('lotes').delete().eq('id', id)
    await cargarDatos()
  }

  if (loading) return <Loader />

  if (vista === 'nuevo') {
    const promEst = form.cantidad && form.kg_bascula ? Math.round(parseFloat(form.kg_bascula) / parseInt(form.cantidad)) : null

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>
          <Btn ghost sm onClick={() => setVista('lista')}>Volver</Btn>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600 }}>Nuevo ingreso</h1>
            <div style={{ fontSize: 12, color: '#6B6760' }}>Llegada de lote al campo</div>
          </div>
        </div>

        <Card titulo="Datos del lote">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B6760', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Procedencia</label>
              <select style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2DDD6', borderRadius: 6, fontSize: 14, background: '#fff' }}
                value={form.procedencia} onChange={e => setForm({...form, procedencia: e.target.value})}>
                {['Remate ROSGAN','Remate Canuelas','Campo propio','Invernada Sanchez','Otro'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B6760', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Categoria</label>
              <select style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2DDD6', borderRadius: 6, fontSize: 14, background: '#fff' }}
                value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})}>
                {['Novillos 2-3 anos','Novillos 3-4 anos','Vaquillonas','Terneros'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B6760', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Cantidad de animales</label>
              <input type="number" placeholder="ej. 85" value={form.cantidad} onChange={e => setForm({...form, cantidad: e.target.value})}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2DDD6', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B6760', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Kg en bascula</label>
              <input type="number" placeholder="ej. 20380" value={form.kg_bascula} onChange={e => setForm({...form, kg_bascula: e.target.value})}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2DDD6', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
          </div>
          {promEst && (
            <div style={{ padding: '10px 12px', background: '#F7F5F0', borderRadius: 8, fontSize: 13, marginBottom: '1rem' }}>
              Peso prom. estimado: <strong>{promEst} kg/animal</strong>
              {promEst < 180 && <span style={{ color: '#7A4500', marginLeft: 8 }}>⚠ Menor a 180 kg - se generara alerta 2da dosis</span>}
            </div>
          )}
        </Card>

        <Card titulo="Pesaje en bascula">
          <div style={{ background: '#E8EFF8', border: '1px solid #378ADD', borderRadius: 8, padding: '10px 12px', marginBottom: '1rem', fontSize: 12, color: '#1A3D6B' }}>
            Solo registras los kg de bascula. Los kg de factura y el precio los completan en oficina.
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#6B6760', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Corral de cuarentena</label>
            <select style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2DDD6', borderRadius: 6, fontSize: 14, background: '#fff' }}
              value={form.corral_cuarentena_id} onChange={e => setForm({...form, corral_cuarentena_id: e.target.value})}>
              <option value="">Selecciona un corral</option>
              {corrales.map(c => <option key={c.id} value={c.id}>Corral {c.numero} (cap. {c.capacidad})</option>)}
            </select>
          </div>
        </Card>

        <Card titulo="Observaciones">
          <textarea placeholder="condicion corporal, sanidad previa, etc." value={form.observaciones}
            onChange={e => setForm({...form, observaciones: e.target.value})}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2DDD6', borderRadius: 8, fontSize: 13, minHeight: 80, resize: 'vertical', boxSizing: 'border-box' }} />
        </Card>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn ghost onClick={() => setVista('lista')}>Cancelar</Btn>
          <Btn onClick={guardarIngreso} disabled={guardando}>{guardando ? 'Guardando...' : 'Registrar ingreso'}</Btn>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Ingresos</h1>
          <div style={{ fontSize: 12, color: '#6B6760' }}>Registro de compras - feedlot</div>
        </div>
        <Btn onClick={() => setVista('nuevo')}>+ Nuevo ingreso</Btn>
      </div>

      <Card titulo={`Historial - ${lotes.length} lotes`}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Fecha','Lote','Animales','Procedencia','Kg bascula','Peso prom.','Corral'].map(h => (
                  <th key={h} style={{ background: '#F7F5F0', padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#6B6760', fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid #E2DDD6', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
                {esDueno && <th style={{ background: '#F7F5F0', padding: '8px 12px', fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid #E2DDD6' }}>Precio</th>}
                {esDueno && <th style={{ background: '#F7F5F0', padding: '8px 12px', borderBottom: '1px solid #E2DDD6' }}></th>}
              </tr>
            </thead>
            <tbody>
              {lotes.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid #E2DDD6' }}>
                  <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{new Date(l.fecha_ingreso).toLocaleDateString('es-AR')}</td>
                  <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{l.codigo}</td>
                  <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{l.cantidad}</td>
                  <td style={{ padding: '9px 12px' }}>{l.procedencia}</td>
                  <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{l.kg_bascula?.toLocaleString('es-AR')} kg</td>
                  <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{l.peso_prom_ingreso ? `${l.peso_prom_ingreso} kg` : '-'}</td>
                  <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{l.corrales?.numero ? `C-${l.corrales.numero}` : '-'}</td>
                  {esDueno && <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: '#6B6760' }}>{l.precio_compra ? `$${l.precio_compra.toLocaleString('es-AR')}/kg` : <span style={{ color: '#9E9A94' }}>Pendiente</span>}</td>}
                  {esDueno && <td style={{ padding: '9px 12px' }}>
                    <button onClick={() => eliminarLote(l.id)} style={{ background: '#FDF0F0', border: '1px solid #F09595', borderRadius: 6, color: '#7A1A1A', fontSize: 11, padding: '3px 8px', cursor: 'pointer' }}>
                      Borrar
                    </button>
                  </td>}
                </tr>
              ))}
              {lotes.length === 0 && (
                <tr><td colSpan={esDueno ? 9 : 7} style={{ padding: '2rem', textAlign: 'center', color: '#9E9A94', fontSize: 13 }}>No hay ingresos registrados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
