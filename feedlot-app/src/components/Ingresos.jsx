import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Card, Btn, Badge, Loader } from './Tablero'

export default function Ingresos({ usuario }) {
  const [lotes, setLotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState('lista') // 'lista' | 'nuevo'
  const [corralesLibres, setCorralesLibres] = useState([])
  const [form, setForm] = useState({ procedencia:'Remate ROSGAN', categoria:'Novillos 2–3 años', cantidad:'', kg_bascula:'', remito:'', observaciones:'', corral_cuarentena_id:'' })
  const [guardando, setGuardando] = useState(false)
  const esDueno = ['dueno'].includes(usuario?.rol)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    const [{ data: l }, { data: c }] = await Promise.all([
      supabase.from('lotes').select('*, corrales:corral_cuarentena_id(numero)').order('created_at', { ascending: false }),
      supabase.from('corrales').select('*').eq('rol', 'libre').neq('numero', 'manga').order('numero'),
    ])
    setLotes(l || [])
    setCorralesLibres(c || [])
    setLoading(false)
  }

  async function guardarIngreso() {
    if (!form.cantidad || !form.kg_bascula) { alert('Completá cantidad y kg de báscula.'); return }
    setGuardando(true)
    const codigo = `L-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`
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
      observaciones: form.observaciones,
      registrado_por: usuario?.id,
    })

    if (!error) {
      // Crear alerta de cuarentena (10 días)
      const fechaFin = new Date(); fechaFin.setDate(fechaFin.getDate() + 10)
      await supabase.from('alertas').insert({
        tipo: 'cuarentena_vence',
        titulo: `Pase a acumulación · ${codigo}`,
        descripcion: `${form.cantidad} animales terminan cuarentena`,
        fecha_vence: fechaFin.toISOString().split('T')[0],// Actualizar animales en corral de cuarentena
if (form.corral_cuarentena_id) {
  const { data: corral } = await supabase
    .from('corrales')
    .select('animales')
    .eq('id', form.corral_cuarentena_id)
    .single()
  
  await supabase
    .from('corrales')
    .update({ 
      animales: (corral?.animales || 0) + parseInt(form.cantidad),
      rol: 'cuarentena'
    })
    .eq('id', form.corral_cuarentena_id)
}
      })
      // Si peso < 180 → alerta segunda dosis
      if (peso_prom < 180) {
        const fecha2da = new Date(); fecha2da.setDate(fecha2da.getDate() + 20)
        await supabase.from('alertas').insert({
          tipo: 'segunda_dosis',
          titulo: `Segunda dosis Alliance+Feedlot · ${codigo}`,
          descripcion: `${form.cantidad} animales ingresaron con ${Math.round(peso_prom)} kg prom. (< 180 kg)`,
          fecha_vence: fecha2da.toISOString().split('T')[0],
        })
      }
      await cargarDatos()
      setVista('lista')
      setForm({ procedencia:'Remate ROSGAN', categoria:'Novillos 2–3 años', cantidad:'', kg_bascula:'', remito:'', observaciones:'', corral_cuarentena_id:'' })
    }
    setGuardando(false)
  }

  if (loading) return <Loader />

  if (vista === 'nuevo') {
    const promEst = form.cantidad && form.kg_bascula ? Math.round(parseFloat(form.kg_bascula) / parseInt(form.cantidad)) : null
    const esMenor180 = promEst && promEst < 180

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>
          <Btn ghost sm onClick={() => setVista('lista')}>← Volver</Btn>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600 }}>Nuevo ingreso</h1>
            <div style={{ fontSize: 12, color: '#6B6760', fontFamily: "'IBM Plex Mono', monospace" }}>Llegada de lote al campo</div>
          </div>
        </div>

        <Card titulo="Datos del lote">
          <Grid2>
            <Campo label="Procedencia">
              <select style={SS.select} value={form.procedencia} onChange={e => setForm({...form, procedencia: e.target.value})}>
                {['Remate ROSGAN','Remate Cañuelas','Campo propio','Invernada Sánchez','Invernada López','Otro'].map(o => <option key={o}>{o}</option>)}
              </select>
            </Campo>
            <Campo label="Categoría">
              <select style={SS.select} value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})}>
                {['Novillos 2–3 años','Novillos 3–4 años','Vaquillonas','Terneros'].map(o => <option key={o}>{o}</option>)}
              </select>
            </Campo>
            <Campo label="Cantidad de animales">
              <input style={SS.input} type="number" placeholder="ej. 85" value={form.cantidad} onChange={e => setForm({...form, cantidad: e.target.value})} />
            </Campo>
            <Campo label="N° de remito / factura">
              <input style={SS.input} type="text" placeholder="ej. 0001-00012345" value={form.remito} onChange={e => setForm({...form, remito: e.target.value})} />
            </Campo>
          </Grid2>
        </Card>

        <Card titulo="Pesaje en báscula">
          <div style={{ background: '#E8EFF8', border: '1px solid #85B7EB', borderRadius: 8, padding: '.85rem 1rem', marginBottom: '1rem', fontSize: 13, color: '#1A3D6B' }}>
            Solo registrás los kg de báscula. Los kg de factura y el precio los completan en oficina.
          </div>
          <Grid2>
            <Campo label="Kg medidos en báscula">
              <input style={SS.input} type="number" placeholder="ej. 20.380" value={form.kg_bascula} onChange={e => setForm({...form, kg_bascula: e.target.value})} />
              {promEst && <div style={{ fontSize: 11, color: '#6B6760', marginTop: 4 }}>Peso prom. estimado: <strong>{promEst} kg/animal</strong></div>}
            </Campo>
            <Campo label="Corral de cuarentena">
              <select style={SS.select} value={form.corral_cuarentena_id} onChange={e => setForm({...form, corral_cuarentena_id: e.target.value})}>
                <option value="">— Seleccioná —</option>
                {corralesLibres.map(c => <option key={c.id} value={c.id}>Corral {c.numero} (cap. {c.capacidad})</option>)}
              </select>
            </Campo>
          </Grid2>
          <Campo label="Observaciones">
            <input style={SS.input} type="text" placeholder="condición corporal, sanidad previa, etc." value={form.observaciones} onChange={e => setForm({...form, observaciones: e.target.value})} />
          </Campo>
          {esMenor180 && (
            <div style={{ background: '#FDF0E0', border: '1px solid #EF9F27', borderRadius: 8, padding: '.85rem 1rem', marginTop: '1rem', fontSize: 13, color: '#7A4500' }}>
              <strong>⚠ Peso promedio {promEst} kg — menor a 180 kg.</strong> El sistema creará automáticamente una alerta para repetir Alliance + Feedlot a los 20 días.
            </div>
          )}
        </Card>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn ghost onClick={() => setVista('lista')}>Cancelar</Btn>
          <Btn onClick={guardarIngreso} disabled={guardando}>{guardando ? 'Guardando...' : '✓ Registrar ingreso'}</Btn>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Ingresos</h1>
          <div style={{ fontSize: 12, color: '#6B6760', fontFamily: "'IBM Plex Mono', monospace" }}>Registro de compras · feedlot</div>
        </div>
        <Btn onClick={() => setVista('nuevo')}>+ Nuevo ingreso</Btn>
      </div>

      <Card titulo={`Historial · ${lotes.length} lotes`}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Fecha','Lote','Animales','Procedencia','Kg báscula','Peso prom.','Corral','Estado'].map(h => (
                  <th key={h} style={{ background: '#F7F5F0', padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#6B6760', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid #E2DDD6', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
                {esDueno && <th style={{ background: '#F7F5F0', padding: '8px 12px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid #E2DDD6' }}>Precio</th>}
              </tr>
            </thead>
            <tbody>
              {lotes.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid #E2DDD6' }}>
                  <td style={{ padding: '9px 12px', fontFamily: "'IBM Plex Mono', monospace" }}>{new Date(l.fecha_ingreso).toLocaleDateString('es-AR')}</td>
                  <td style={{ padding: '9px 12px', fontFamily: "'IBM Plex Mono', monospace', fontWeight: 600" }}>{l.codigo}</td>
                  <td style={{ padding: '9px 12px', fontFamily: "'IBM Plex Mono', monospace" }}>{l.cantidad}</td>
                  <td style={{ padding: '9px 12px' }}>{l.procedencia}</td>
                  <td style={{ padding: '9px 12px', fontFamily: "'IBM Plex Mono', monospace" }}>{l.kg_bascula?.toLocaleString('es-AR')} kg</td>
                  <td style={{ padding: '9px 12px', fontFamily: "'IBM Plex Mono', monospace" }}>{l.peso_prom_ingreso ? `${l.peso_prom_ingreso} kg` : '—'}</td>
                  <td style={{ padding: '9px 12px', fontFamily: "'IBM Plex Mono', monospace" }}>{l.corrales?.numero ? `C-${l.corrales.numero}` : '—'}</td>
                  <td style={{ padding: '9px 12px' }}><Badge ok>Activo</Badge></td>
                  {esDueno && <td style={{ padding: '9px 12px', fontFamily: "'IBM Plex Mono', monospace", color: '#6B6760' }}>{l.precio_compra ? `$${l.precio_compra.toLocaleString('es-AR')}/kg` : <span style={{ color: '#9E9A94' }}>Pendiente</span>}</td>}
                </tr>
              ))}
              {lotes.length === 0 && (
                <tr><td colSpan={esDueno ? 9 : 8} style={{ padding: '2rem', textAlign: 'center', color: '#9E9A94', fontSize: 13 }}>No hay ingresos registrados aún.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function Grid2({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>{children}</div>
}

function Campo({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#6B6760', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</label>
      {children}
    </div>
  )
}

const SS = {
  input: { border: '1px solid #E2DDD6', borderRadius: 6, padding: '9px 12px', fontSize: 14, fontFamily: "'IBM Plex Sans', sans-serif", color: '#1A1916', background: '#fff', width: '100%', boxSizing: 'border-box' },
  select: { border: '1px solid #E2DDD6', borderRadius: 6, padding: '9px 12px', fontSize: 14, fontFamily: "'IBM Plex Sans', sans-serif", color: '#1A1916', background: '#fff', width: '100%' },
}             
 