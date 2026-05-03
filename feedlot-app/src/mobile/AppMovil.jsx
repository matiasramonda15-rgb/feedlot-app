import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
const C = {
  bg: '#1A2E1A', surface: '#243324', surface2: '#2E3F2E',
  border: '#3A4F3A', text: '#E8F0E8', muted: '#8FA88F',
  green: '#7EC87E', amber: '#F5C97A', red: '#F09595',
  blue: '#7EB8F7', mono: "'IBM Plex Mono', monospace", sans: "'IBM Plex Sans', sans-serif",
}
export default function AppMovil({ usuario, onLogout }) {
  const [pantalla, setPantalla] = useState('home')
  const [datos, setDatos] = useState({ corrales: [], proximaPesada: null, alertas: [] })
  const nav = (p) => setPantalla(p)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    const [{ data: corrales }, { data: cfg }, { data: alertas }] = await Promise.all([
      supabase.from('corrales').select('*').not('rol', 'eq', 'libre').not('rol', 'eq', 'deshabilitado').order('id'),
      supabase.from('configuracion').select('valor').eq('clave', 'proxima_pesada').single(),
      supabase.from('alertas').select('*').eq('resuelta', false).order('fecha_vence'),
    ])
    setDatos({
      corrales: corrales || [],
      proximaPesada: cfg?.valor || null,
      alertas: alertas || [],
    })
  }

  const pantallas = {
    home:        <Home usuario={usuario} nav={nav} onLogout={onLogout} datos={datos} />,
    corrales:    <Corrales nav={nav} corrales={datos.corrales} />,
    ingreso:     <Ingreso nav={nav} usuario={usuario} corrales={datos.corrales} onDone={cargarDatos} />,
    pesada:      <PlaceholderMovil titulo="Pesada" nav={nav} />,
    alimentacion:<PlaceholderMovil titulo="Alimentacion" nav={nav} />,
    sanidad:     <SanidadMovil nav={nav} alertas={datos.alertas} proximaPesada={datos.proximaPesada} onDone={cargarDatos} />,
    venta:       <PlaceholderMovil titulo="Carga para venta" nav={nav} />,
    novedad:     <PlaceholderMovil titulo="Novedad / Movimiento" nav={nav} />,
  }
  return (
    <div style={{ maxWidth: 420, margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: C.sans, color: C.text, position: 'relative', overflow: 'hidden' }}>
      {pantallas[pantalla] || pantallas.home}
    </div>
  )
}
function Topbar({ titulo, sub, onBack, onLogout }) {
  return (
    <div style={{ background: C.surface, padding: '1rem', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, borderBottom: `1px solid ${C.border}` }}>
      {onBack && <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.green, fontSize: 22, cursor: 'pointer', padding: 0, lineHeight: 1 }}>‹</button>}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{titulo}</div>
        {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{sub}</div>}
      </div>
      {onLogout && <button onClick={onLogout} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, color: C.muted, fontSize: 11, padding: '4px 10px', cursor: 'pointer', fontFamily: C.sans }}>Salir</button>}
    </div>
  )
}
function Scroll({ children }) {
  return <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>{children}</div>
}
function Home({ usuario, nav, onLogout, datos }) {
  const { proximaPesada, alertas, corrales } = datos
  const proximaDate = proximaPesada ? new Date(proximaPesada + 'T12:00:00') : null
  const diasPesada = proximaDate ? Math.ceil((proximaDate - new Date()) / (1000 * 60 * 60 * 24)) : null
  const totalAnimales = corrales.reduce((s, c) => s + (c.animales || 0), 0)

  const tareas = []
  if (diasPesada !== null && diasPesada <= 7) {
    tareas.push({ icon: '⚖️', titulo: 'Pesada proxima', sub: `${proximaDate.toLocaleDateString('es-AR')} - en ${diasPesada} dias`, pantalla: 'pesada', urgente: true })
  }
  alertas.slice(0, 3).forEach(a => {
    tareas.push({ icon: '💉', titulo: a.titulo, sub: a.descripcion, pantalla: 'sanidad', urgente: true })
  })
  if (tareas.length === 0) {
    tareas.push({ icon: '✅', titulo: 'Sin tareas urgentes', sub: 'Todo en orden', pantalla: 'sanidad', urgente: false })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Topbar titulo="Feedlot" sub={`Hola, ${usuario?.nombre || 'Empleado'} - ${totalAnimales} animales`} onLogout={onLogout} />
      <Scroll>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '.65rem' }}>Tareas del dia</div>
        {tareas.map((t, i) => (
          <div key={i} onClick={() => nav(t.pantalla)}
            style={{ background: C.surface, border: `1px solid ${t.urgente ? C.green : C.border}`, borderRadius: 12, padding: '.9rem', marginBottom: '.65rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 24 }}>{t.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{t.titulo}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{t.sub}</div>
            </div>
            <div style={{ fontSize: 18, color: C.muted }}>›</div>
          </div>
        ))}
        <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '.07em', margin: '1rem 0 .65rem' }}>Acciones rapidas</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { icon: '📍', label: 'Corrales', p: 'corrales' },
            { icon: '🐄', label: 'Nuevo ingreso', p: 'ingreso' },
            { icon: '⚖️', label: 'Pesada', p: 'pesada' },
            { icon: '🔀', label: 'Movimiento', p: 'novedad' },
            { icon: '💊', label: 'Sanidad', p: 'sanidad' },
            { icon: '💰', label: 'Carga venta', p: 'venta' },
          ].map((a, i) => (
            <div key={i} onClick={() => nav(a.p)}
              style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '.85rem', cursor: 'pointer', textAlign: 'center' }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{a.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{a.label}</div>
            </div>
          ))}
        </div>
      </Scroll>
    </div>
  )
}
function Corrales({ nav, corrales }) {
  const colors = { cuarentena: C.amber, acumulacion: C.blue, enfermeria: C.red }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Topbar titulo="Corrales" sub="Estado actual" onBack={() => nav('home')} />
      <Scroll>
        {corrales.length === 0 && <div style={{ textAlign: 'center', padding: '2rem', color: C.muted, fontSize: 13 }}>No hay corrales activos.</div>}
        {corrales.map(c => {
          const pct = Math.round((c.animales || 0) / (c.capacidad || 100) * 100)
          const color = colors[c.rol] || C.green
          return (
            <div key={c.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '1rem', marginBottom: '.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Corral {c.numero}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{c.rol}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: C.mono, color }}>{c.animales || 0}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>de {c.capacidad || 100}</div>
                </div>
              </div>
              <div style={{ height: 4, background: C.surface2, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: pct > 90 ? C.red : color, borderRadius: 2 }} />
              </div>
            </div>
          )
        })}
      </Scroll>
    </div>
  )
}
function Ingreso({ nav, usuario, corrales, onDone }) {
  const [form, setForm] = useState({ procedencia: 'Remate ROSGAN', categoria: 'Novillos 2-3 anos', cantidad: '', kg_bascula: '', observaciones: '', corral_id: '' })
  const [guardando, setGuardando] = useState(false)
  const prom = form.cantidad && form.kg_bascula ? Math.round(parseFloat(form.kg_bascula) / parseInt(form.cantidad)) : null
  const corralesCuarentena = corrales.filter(c => c.rol === 'cuarentena' || c.rol === 'libre')

  async function guardar() {
    if (!form.cantidad || !form.kg_bascula) { alert('Completa cantidad y kg bascula.'); return }
    setGuardando(true)
    const codigo = `L-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`
    const { error } = await supabase.from('lotes').insert({
      codigo, fecha_ingreso: new Date().toISOString().split('T')[0],
      procedencia: form.procedencia, categoria: form.categoria,
      cantidad: parseInt(form.cantidad), kg_bascula: parseFloat(form.kg_bascula),
      peso_prom_ingreso: Math.round(parseFloat(form.kg_bascula) / parseInt(form.cantidad) * 100) / 100,
      observaciones: form.observaciones || null, registrado_por: usuario?.id,
      corral_cuarentena_id: form.corral_id || null,
    })
    if (!error) {
      if (form.corral_id) {
        const { data: corral } = await supabase.from('corrales').select('animales').eq('id', form.corral_id).single()
        await supabase.from('corrales').update({ animales: (corral?.animales || 0) + parseInt(form.cantidad), rol: 'cuarentena' }).eq('id', form.corral_id)
      }
      onDone()
      alert(`Lote ${codigo} registrado.`)
      nav('home')
    } else {
      alert('Error al guardar. Intenta de nuevo.')
    }
    setGuardando(false)
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Topbar titulo="Nuevo ingreso" sub="Llegada de lote" onBack={() => nav('home')} />
      <Scroll>
        {[
          { label: 'Procedencia', key: 'procedencia', opts: ['Remate ROSGAN','Remate Canuelas','Campo propio','Otro'] },
          { label: 'Categoria', key: 'categoria', opts: ['Novillos 2-3 anos','Novillos 3-4 anos','Vaquillonas','Terneros'] },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: '.85rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>{f.label}</div>
            <select value={form[f.key]} onChange={e => setForm({...form, [f.key]: e.target.value})}
              style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: C.text, fontFamily: C.sans }}>
              {f.opts.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        ))}
        {[
          { label: 'Cantidad de animales', key: 'cantidad', placeholder: 'ej. 85' },
          { label: 'Kg en bascula', key: 'kg_bascula', placeholder: 'ej. 20380' },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: '.85rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>{f.label}</div>
            <input type="number" inputMode="numeric" placeholder={f.placeholder} value={form[f.key]}
              onChange={e => setForm({...form, [f.key]: e.target.value})}
              style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 16, fontFamily: C.mono, fontWeight: 600, color: C.green, boxSizing: 'border-box' }} />
          </div>
        ))}
        {corralesCuarentena.length > 0 && (
          <div style={{ marginBottom: '.85rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>Corral de cuarentena</div>
            <select value={form.corral_id} onChange={e => setForm({...form, corral_id: e.target.value})}
              style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: C.text, fontFamily: C.sans }}>
              <option value="">Sin asignar</option>
              {corralesCuarentena.map(c => <option key={c.id} value={c.id}>Corral {c.numero} - {c.animales || 0} anim.</option>)}
            </select>
          </div>
        )}
        {prom && <div style={{ background: C.surface2, borderRadius: 8, padding: '.75rem', marginBottom: '.85rem', fontSize: 13, color: C.green, fontFamily: C.mono }}>Peso prom: <strong>{prom} kg/animal</strong></div>}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>Observaciones</div>
          <input type="text" placeholder="condicion, sanidad previa, etc." value={form.observaciones}
            onChange={e => setForm({...form, observaciones: e.target.value})}
            style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: C.text, fontFamily: C.sans, boxSizing: 'border-box' }} />
        </div>
        <button onClick={guardar} disabled={guardando}
          style={{ width: '100%', background: C.green, border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 600, color: '#0A1A0A', cursor: 'pointer', fontFamily: C.sans, marginBottom: 8 }}>
          {guardando ? 'Guardando...' : 'Registrar ingreso'}
        </button>
        <button onClick={() => nav('home')}
          style={{ width: '100%', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, fontSize: 14, color: C.muted, cursor: 'pointer', fontFamily: C.sans }}>
          Cancelar
        </button>
      </Scroll>
    </div>
  )
}
function SanidadMovil({ nav, alertas, proximaPesada, onDone }) {
  const proximaDate = proximaPesada ? new Date(proximaPesada + 'T12:00:00') : null
  const diasPesada = proximaDate ? Math.ceil((proximaDate - new Date()) / (1000 * 60 * 60 * 24)) : null
  const [confirmados, setConfirmados] = useState({})

  async function confirmarAlerta(id) {
    await supabase.from('alertas').update({ resuelta: true, resuelta_en: new Date().toISOString() }).eq('id', id)
    setConfirmados(prev => ({...prev, [id]: true}))
    onDone()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Topbar titulo="Sanidad" onBack={() => nav('home')} />
      <Scroll>
        {proximaDate && (
          <div style={{ background: diasPesada <= 7 ? '#3D2A00' : '#1A3D26', border: `1px solid ${diasPesada <= 7 ? C.amber : C.green}`, borderRadius: 12, padding: '1rem', marginBottom: '.65rem' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: diasPesada <= 7 ? C.amber : C.green, marginBottom: 3 }}>
              ⚖️ Proxima pesada fija
            </div>
            <div style={{ fontSize: 12, color: C.muted }}>
              {proximaDate.toLocaleDateString('es-AR')}
              {diasPesada !== null && <span style={{ marginLeft: 8, fontWeight: 600, color: diasPesada <= 7 ? C.amber : C.green }}>
                {diasPesada <= 0 ? '- Realizar hoy' : `- en ${diasPesada} dias`}
              </span>}
            </div>
          </div>
        )}

        {alertas.length === 0 && !proximaDate && (
          <div style={{ textAlign: 'center', padding: '2rem', color: C.muted, fontSize: 13 }}>Sin alertas pendientes.</div>
        )}

        {alertas.map(a => (
          <div key={a.id} style={{ background: confirmados[a.id] ? '#1A3D26' : '#3D2A00', border: `1px solid ${confirmados[a.id] ? C.green : C.amber}`, borderRadius: 12, padding: '1rem', marginBottom: '.65rem' }}>
            {confirmados[a.id] ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 20 }}>✅</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.green }}>Confirmado</div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.amber, marginBottom: 3 }}>{a.titulo}</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: '.65rem' }}>{a.descripcion}</div>
                {a.fecha_vence && <div style={{ fontSize: 11, color: C.amber, marginBottom: '.65rem' }}>Vence: {new Date(a.fecha_vence).toLocaleDateString('es-AR')}</div>}
                <button onClick={() => confirmarAlerta(a.id)}
                  style={{ width: '100%', padding: 10, background: '#2A1A00', border: `1px solid ${C.amber}`, borderRadius: 8, color: C.amber, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: C.sans }}>
                  Confirmar resolucion
                </button>
              </>
            )}
          </div>
        ))}
      </Scroll>
    </div>
  )
}
function PlaceholderMovil({ titulo, nav }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Topbar titulo={titulo} onBack={() => nav('home')} />
      <Scroll>
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: C.muted, fontSize: 13 }}>
          Modulo en integracion.<br />Disponible en la proxima sesion.
        </div>
      </Scroll>
    </div>
  )
}
