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
  const esEncargado = ['dueno', 'encargado'].includes(usuario?.rol)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    const [{ data: corrales }, { data: cfg }, { data: alertas }] = await Promise.all([
      supabase.from('corrales').select('*').not('rol', 'eq', 'deshabilitado').order('id'),
      supabase.from('configuracion').select('valor').eq('clave', 'proxima_pesada').single(),
      supabase.from('alertas').select('*').eq('resuelta', false).order('fecha_vence'),
    ])
    setDatos({ corrales: corrales || [], proximaPesada: cfg?.valor || null, alertas: alertas || [] })
  }

  const pantallas = {
    home:        <Home usuario={usuario} nav={nav} onLogout={onLogout} datos={datos} />,
    corrales:    <Corrales nav={nav} corrales={datos.corrales} usuario={usuario} esEncargado={esEncargado} onDone={cargarDatos} />,
    ingreso:     <Ingreso nav={nav} usuario={usuario} corrales={datos.corrales} onDone={cargarDatos} />,
    pesada:      <PesadaMovil nav={nav} usuario={usuario} corrales={datos.corrales} onDone={cargarDatos} />,
    alimentacion:<AlimentacionMovil nav={nav} usuario={usuario} corrales={datos.corrales} onDone={cargarDatos} />,
    sanidad:     <SanidadMovil nav={nav} alertas={datos.alertas} proximaPesada={datos.proximaPesada} onDone={cargarDatos} />,
    venta:       <VentaMovil nav={nav} usuario={usuario} corrales={datos.corrales} onDone={cargarDatos} />,
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
            style={{ background: C.surface, border: `1px solid ${t.urgente ? C.amber : C.border}`, borderRadius: 12, padding: '.9rem', marginBottom: '.65rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
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
            { icon: '🌾', label: 'Alimentacion', p: 'alimentacion' },
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
function Corrales({ nav, corrales, usuario, esEncargado, onDone }) {
  const [seleccionado, setSeleccionado] = useState(null)
  const [vista, setVista] = useState('lista')
  const [movForm, setMovForm] = useState({ destino_id: '', cantidad: '', motivo: '' })
  const [guardando, setGuardando] = useState(false)
  const corralesActivos = corrales.filter(c => c.rol !== 'libre' && c.rol !== 'deshabilitado')
  const colors = { cuarentena: C.amber, acumulacion: C.blue, enfermeria: C.red, clasificado: '#B09ED4' }

  async function cambiarRol(corralId, nuevoRol) {
    await supabase.from('corrales').update({ rol: nuevoRol }).eq('id', corralId)
    onDone(); setVista('lista'); setSeleccionado(null)
  }

  async function moverAnimales() {
    if (!movForm.destino_id || !movForm.cantidad) { alert('Completa destino y cantidad'); return }
    const cantidad = parseInt(movForm.cantidad)
    if (cantidad > (seleccionado?.animales || 0)) { alert(`Max: ${seleccionado?.animales} animales`); return }
    setGuardando(true)
    const destinoId = parseInt(movForm.destino_id)
    await supabase.from('movimientos').insert({ tipo: 'traslado', corral_origen_id: seleccionado.id, corral_destino_id: destinoId, cantidad, motivo: movForm.motivo || null, registrado_por: usuario?.id })
    await supabase.from('corrales').update({ animales: (seleccionado.animales || 0) - cantidad }).eq('id', seleccionado.id)
    const { data: dest } = await supabase.from('corrales').select('animales').eq('id', destinoId).single()
    await supabase.from('corrales').update({ animales: (dest?.animales || 0) + cantidad }).eq('id', destinoId)
    onDone(); setMovForm({ destino_id: '', cantidad: '', motivo: '' }); setVista('lista'); setSeleccionado(null); setGuardando(false)
    alert(`${cantidad} animales movidos.`)
  }

  if (vista === 'detalle' && seleccionado) {
    const pct = Math.round((seleccionado.animales || 0) / (seleccionado.capacidad || 100) * 100)
    const color = colors[seleccionado.rol] || C.green
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Topbar titulo={`Corral ${seleccionado.numero}`} sub={seleccionado.rol} onBack={() => { setVista('lista'); setSeleccionado(null) }} />
        <Scroll>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '1rem', marginBottom: '.65rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: C.muted, fontSize: 13 }}>Animales</span>
              <span style={{ fontFamily: C.mono, fontWeight: 700, fontSize: 18, color }}>{seleccionado.animales || 0} / {seleccionado.capacidad || 100}</span>
            </div>
            <div style={{ height: 6, background: C.surface2, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: pct > 90 ? C.red : color, borderRadius: 3 }} />
            </div>
          </div>
          {(seleccionado.animales || 0) > 0 && (
            <button onClick={() => setVista('mover')}
              style={{ width: '100%', background: C.surface, border: `1px solid ${C.blue}`, borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 600, color: C.blue, cursor: 'pointer', fontFamily: C.sans, marginBottom: 8 }}>
              Mover animales a otro corral
            </button>
          )}
          {esEncargado && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, textTransform: 'uppercase' }}>Cambiar rol</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {['libre','cuarentena','acumulacion','clasificado','enfermeria','transitorio','deshabilitado'].filter(r => r !== seleccionado.rol).map(r => (
                  <button key={r} onClick={() => cambiarRol(seleccionado.id, r)}
                    style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px', fontSize: 12, color: C.text, cursor: 'pointer', fontFamily: C.sans }}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Scroll>
      </div>
    )
  }

  if (vista === 'mover' && seleccionado) {
    const destinosDisponibles = corrales.filter(c => c.id !== seleccionado.id && c.rol !== 'deshabilitado')
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Topbar titulo="Mover animales" sub={`Desde Corral ${seleccionado.numero} - ${seleccionado.animales || 0} disp.`} onBack={() => setVista('detalle')} />
        <Scroll>
          <div style={{ marginBottom: '.85rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>Corral destino</div>
            <select value={movForm.destino_id} onChange={e => setMovForm({...movForm, destino_id: e.target.value})}
              style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: C.text, fontFamily: C.sans }}>
              <option value="">Selecciona destino</option>
              {destinosDisponibles.map(c => <option key={c.id} value={c.id}>Corral {c.numero} - {c.rol} - {c.animales || 0} anim.</option>)}
            </select>
          </div>
          <div style={{ marginBottom: '.85rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>Cantidad (max {seleccionado.animales || 0})</div>
            <input type="number" inputMode="numeric" placeholder="0" value={movForm.cantidad}
              onChange={e => setMovForm({...movForm, cantidad: e.target.value})}
              style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 16, fontFamily: C.mono, fontWeight: 600, color: C.green, boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>Motivo (opcional)</div>
            <input type="text" placeholder="ej. clasificacion, enfermedad..." value={movForm.motivo}
              onChange={e => setMovForm({...movForm, motivo: e.target.value})}
              style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: C.text, fontFamily: C.sans, boxSizing: 'border-box' }} />
          </div>
          <button onClick={moverAnimales} disabled={guardando}
            style={{ width: '100%', background: C.green, border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 600, color: '#0A1A0A', cursor: 'pointer', fontFamily: C.sans, marginBottom: 8 }}>
            {guardando ? 'Moviendo...' : 'Confirmar movimiento'}
          </button>
          <button onClick={() => setVista('detalle')}
            style={{ width: '100%', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, fontSize: 14, color: C.muted, cursor: 'pointer', fontFamily: C.sans }}>
            Cancelar
          </button>
        </Scroll>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Topbar titulo="Corrales" sub={`${corralesActivos.length} activos`} onBack={() => nav('home')} />
      <Scroll>
        {corralesActivos.length === 0 && <div style={{ textAlign: 'center', padding: '2rem', color: C.muted, fontSize: 13 }}>No hay corrales activos.</div>}
        {corralesActivos.map(c => {
          const pct = Math.round((c.animales || 0) / (c.capacidad || 100) * 100)
          const color = colors[c.rol] || C.green
          return (
            <div key={c.id} onClick={() => { setSeleccionado(c); setVista('detalle') }}
              style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '1rem', marginBottom: '.65rem', cursor: 'pointer' }}>
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
  const [form, setForm] = useState({ procedencia: 'Remate ROSGAN', otraProcedencia: '', categoria: 'Novillos 2-3 anos', cantidad: '', kg_bascula: '', observaciones: '', corral_id: '' })
  const [guardando, setGuardando] = useState(false)
  const prom = form.cantidad && form.kg_bascula ? Math.round(parseFloat(form.kg_bascula) / parseInt(form.cantidad)) : null
  const corralesCuarentena = corrales.filter(c => c.rol === 'cuarentena' || c.rol === 'libre')

  async function guardar() {
    if (!form.cantidad || !form.kg_bascula) { alert('Completa cantidad y kg bascula.'); return }
    const procFinal = form.procedencia === 'Otro' ? (form.otraProcedencia || 'Otro') : form.procedencia
    setGuardando(true)
    const codigo = `L-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`
    const { error } = await supabase.from('lotes').insert({
      codigo, fecha_ingreso: new Date().toISOString().split('T')[0],
      procedencia: procFinal, categoria: form.categoria,
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
      onDone(); alert(`Lote ${codigo} registrado.`); nav('home')
    } else { alert('Error al guardar.') }
    setGuardando(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Topbar titulo="Nuevo ingreso" sub="Llegada de lote" onBack={() => nav('home')} />
      <Scroll>
        <div style={{ marginBottom: '.85rem' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>Procedencia</div>
          <select value={form.procedencia} onChange={e => setForm({...form, procedencia: e.target.value, otraProcedencia: ''})}
            style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: C.text, fontFamily: C.sans }}>
            {['Remate ROSGAN','Remate Canuelas','Campo propio','Invernada Sanchez','Otro'].map(o => <option key={o}>{o}</option>)}
          </select>
          {form.procedencia === 'Otro' && (
            <input type="text" placeholder="Escribi la procedencia..." value={form.otraProcedencia}
              onChange={e => setForm({...form, otraProcedencia: e.target.value})}
              style={{ width: '100%', background: C.surface, border: `1px solid ${C.green}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: C.text, fontFamily: C.sans, boxSizing: 'border-box', marginTop: 6 }} />
          )}
        </div>
        <div style={{ marginBottom: '.85rem' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>Categoria</div>
          <select value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})}
            style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: C.text, fontFamily: C.sans }}>
            {['Novillos 2-3 anos','Novillos 3-4 anos','Vaquillonas','Terneros'].map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
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
function AlimentacionMovil({ nav, usuario, corrales, onDone }) {
  const corralesAlim = corrales.filter(c => c.rol !== 'libre' && c.rol !== 'deshabilitado')
  const ETAPAS = { cuarentena: 'acostumbramiento', acumulacion: 'acostumbramiento', clasificado: 'recria', enfermeria: 'recria' }
  const FRML = {
    acostumbramiento: [{n:'Rollo',kg:38,c:'#639922'},{n:'Maiz seco',kg:39,c:'#E8A020'},{n:'Vitaminas',kg:2,c:'#5090E0'},{n:'Urea',kg:0.5,c:'#9060C0'},{n:'Soja',kg:3,c:'#20A060'},{n:'Agua',kg:17,c:'#60A0E0'}],
    recria:           [{n:'Rollo',kg:26,c:'#639922'},{n:'Maiz seco',kg:55,c:'#E8A020'},{n:'Vitaminas',kg:2,c:'#5090E0'},{n:'Urea',kg:1,c:'#9060C0'},{n:'Agua',kg:17,c:'#60A0E0'}],
    terminacion:      [{n:'Rollo',kg:13,c:'#639922'},{n:'Maiz seco',kg:68,c:'#E8A020'},{n:'Vitaminas',kg:1,c:'#5090E0'},{n:'Urea',kg:1,c:'#9060C0'},{n:'Agua',kg:17,c:'#60A0E0'}],
  }
  const [kgs, setKgs] = useState({})
  const [pils, setPils] = useState({})
  const [tab, setTab] = useState('piletas')
  const [mostrarMixer, setMostrarMixer] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    const inicial = {}
    corralesAlim.forEach(c => { inicial[c.id] = Math.round((c.animales || 0) * 10) })
    setKgs(inicial)
  }, [corrales])

  function setPileta(id, tipo) {
    const base = kgs[id] || 0
    const newKgs = {...kgs}
    newKgs[id] = tipo === 'bajo' ? Math.max(0, base - 100) : tipo === 'normal' ? base : base + 100
    setKgs(newKgs)
    setPils({...pils, [id]: tipo})
  }

  const total = Object.values(kgs).reduce((a, b) => a + b, 0)

  const MIXERS = [
    { nombre: 'Mixer 1 - Acostumbramiento', etapa: 'acostumbramiento', corralesIds: corralesAlim.filter(c => ETAPAS[c.rol] === 'acostumbramiento').map(c => c.id), cap: 4000 },
    { nombre: 'Mixer 2 - Recria', etapa: 'recria', corralesIds: corralesAlim.filter(c => ETAPAS[c.rol] === 'recria').map(c => c.id), cap: 4000 },
    { nombre: 'Mixer 3 - Terminacion', etapa: 'terminacion', corralesIds: corralesAlim.filter(c => ETAPAS[c.rol] === 'terminacion').map(c => c.id), cap: 4000 },
  ].filter(m => m.corralesIds.length > 0)

  async function confirmar() {
    setGuardando(true)
    const registros = corralesAlim.map(c => ({
      mixer: 'Mixer 1', corral_id: c.id, formula: 'Engorde',
      kg_total: kgs[c.id] || 0, registrado_por: usuario?.id,
    }))
    await supabase.from('raciones_diarias').insert(registros)
    onDone()
    alert(`Raciones confirmadas. ${total.toLocaleString('es-AR')} kg totales.`)
    nav('home')
    setGuardando(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Topbar titulo="Alimentacion" sub="Racion diaria" onBack={() => nav('home')} />
      <div style={{ display: 'flex', background: C.surface, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        {[['piletas','Piletas y mixer'],['stock','Stock']].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ flex: 1, padding: '10px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: C.sans, background: tab === t ? C.green : 'transparent', color: tab === t ? '#0A1A0A' : C.muted, borderBottom: tab === t ? `2px solid ${C.green}` : '2px solid transparent' }}>
            {l}
          </button>
        ))}
      </div>
      <Scroll>
        {tab === 'piletas' && (
          <>
            {corralesAlim.map(c => {
              const kgHoy = kgs[c.id] || 0
              return (
                <div key={c.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '.9rem', marginBottom: '.65rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.5rem' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Corral {c.numero}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{c.rol} - {c.animales || 0} animales</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: C.mono }}>{kgHoy.toLocaleString('es-AR')}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>kg hoy</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 5, marginBottom: '.5rem' }}>
                    {[['bajo','Sobro -100',C.green,'#1A3D26'],['normal','Normal',C.blue,'#0F2040'],['vacio','Vacio +100',C.amber,'#3D2A00']].map(([tipo,label,color,bg]) => (
                      <button key={tipo} onClick={() => setPileta(c.id, tipo)}
                        style={{ flex: 1, padding: '7px 4px', fontSize: 10, fontWeight: 600, borderRadius: 6, cursor: 'pointer', fontFamily: C.sans, border: `1px solid ${pils[c.id] === tipo ? color : C.border}`, background: pils[c.id] === tipo ? bg : 'transparent', color: pils[c.id] === tipo ? color : C.muted }}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <input type="number" inputMode="numeric" value={kgHoy}
                    onChange={e => setKgs({...kgs, [c.id]: parseInt(e.target.value) || 0})}
                    style={{ width: '100%', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 12px', fontSize: 15, fontFamily: C.mono, fontWeight: 600, color: C.green, textAlign: 'right', boxSizing: 'border-box' }} />
                </div>
              )
            })}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '1rem', marginBottom: '.65rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Total mixer hoy</div>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: C.mono, color: C.green }}>{total.toLocaleString('es-AR')} kg</div>
              </div>
              <button onClick={() => setMostrarMixer(!mostrarMixer)}
                style={{ width: '100%', background: C.green, border: 'none', borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 600, color: '#0A1A0A', cursor: 'pointer', fontFamily: C.sans }}>
                {mostrarMixer ? 'Ocultar ingredientes' : 'Ver ingredientes del mixer'}
              </button>
            </div>
            {mostrarMixer && MIXERS.map((mx, mi) => {
              const totalMx = mx.corralesIds.reduce((a, id) => a + (kgs[id] || 0), 0)
              const f = FRML[mx.etapa]
              const factor = totalMx / 100
              let acum = 0
              return (
                <div key={mi} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, marginBottom: '.65rem', overflow: 'hidden' }}>
                  <div style={{ padding: '.75rem 1rem', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.green }}>{mx.nombre}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: C.mono, color: totalMx > mx.cap ? C.amber : C.green }}>{totalMx.toLocaleString('es-AR')} kg</div>
                  </div>
                  {f.map((ing, ii) => {
                    const kg = Math.round(ing.kg * factor)
                    acum += kg
                    return (
                      <div key={ii} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 1rem', borderBottom: `1px solid ${C.border}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: ing.c }} />{ing.n}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: C.mono, color: C.green }}>{kg.toLocaleString('es-AR')} kg</div>
                          <div style={{ fontSize: 10, fontFamily: C.mono, color: C.muted }}>acum. {acum.toLocaleString('es-AR')}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
            <button onClick={confirmar} disabled={guardando}
              style={{ width: '100%', background: C.green, border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 600, color: '#0A1A0A', cursor: 'pointer', fontFamily: C.sans, marginBottom: 8 }}>
              {guardando ? 'Guardando...' : 'Confirmar raciones'}
            </button>
          </>
        )}
        {tab === 'stock' && (
          <StockTab usuario={usuario} onDone={onDone} />
        )}
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
              Proxima pesada fija
            </div>
            <div style={{ fontSize: 12, color: C.muted }}>
              {proximaDate.toLocaleDateString('es-AR')}
              <span style={{ marginLeft: 8, fontWeight: 600, color: diasPesada <= 7 ? C.amber : C.green }}>
                {diasPesada <= 0 ? '- Realizar hoy' : `- en ${diasPesada} dias`}
              </span>
            </div>
          </div>
        )}
        {alertas.length === 0 && <div style={{ textAlign: 'center', padding: '1rem', color: C.muted, fontSize: 13 }}>Sin alertas pendientes.</div>}
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
          Modulo en integracion.<br />Disponible pronto.
        </div>
      </Scroll>
    </div>
  )
}

function StockTab({ usuario, onDone }) {
  const [stock, setStock] = useState([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(null)
  const [cantidad, setCantidad] = useState('')
  const [guardando, setGuardando] = useState(false)
  const COLORES = { 'Rollo (heno)': '#639922', 'Maiz grano seco': '#E8A020', 'Vitaminas': '#5090E0', 'Urea': '#9060C0', 'Soja (expeller)': '#20A060' }

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const { data } = await supabase.from('stock_insumos').select('*').order('insumo')
    setStock(data || [])
    setLoading(false)
  }

  async function actualizar(id, tipo) {
    if (!cantidad || isNaN(parseFloat(cantidad))) { alert('Ingresa una cantidad valida'); return }
    setGuardando(true)
    const item = stock.find(s => s.id === id)
    const nuevaCantidad = tipo === 'agregar'
      ? (item.cantidad_kg || 0) + parseFloat(cantidad)
      : Math.max(0, (item.cantidad_kg || 0) - parseFloat(cantidad))
    await supabase.from('stock_insumos').update({ cantidad_kg: nuevaCantidad, actualizado_en: new Date().toISOString() }).eq('id', id)
    await cargar()
    setEditando(null)
    setCantidad('')
    setGuardando(false)
  }

  if (loading) return <div style={{ padding: '1rem', color: C.muted, fontSize: 13 }}>Cargando...</div>

  return (
    <>
      {stock.map(s => {
        const bajo = s.cantidad_kg <= s.minimo_kg
        const color = bajo ? C.amber : C.green
        const c = COLORES[s.insumo] || C.green
        const pct = Math.min(100, Math.round(s.cantidad_kg / Math.max(s.minimo_kg * 3, s.cantidad_kg) * 100))
        return (
          <div key={s.id} style={{ padding: '.75rem 0', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />{s.insumo}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: C.mono, color }}>{bajo ? '⚠ ' : ''}{s.cantidad_kg.toLocaleString('es-AR')} kg</div>
            </div>
            <div style={{ height: 4, background: C.surface2, borderRadius: 2, overflow: 'hidden', marginBottom: 5 }}>
              <div style={{ height: '100%', borderRadius: 2, background: color, width: `${pct}%` }} />
            </div>
            {bajo && <div style={{ fontSize: 11, color: C.amber, marginBottom: 5 }}>Bajo minimo ({s.minimo_kg.toLocaleString('es-AR')} kg) - reponer</div>}
            {editando === s.id ? (
              <div style={{ marginTop: 6 }}>
                <input type="number" inputMode="numeric" placeholder="Cantidad en kg" value={cantidad}
                  onChange={e => setCantidad(e.target.value)}
                  style={{ width: '100%', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 12px', fontSize: 14, fontFamily: C.mono, color: C.green, boxSizing: 'border-box', marginBottom: 6 }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => actualizar(s.id, 'agregar')} disabled={guardando}
                    style={{ flex: 1, padding: '8px', background: '#1A3D26', border: `1px solid ${C.green}`, borderRadius: 8, color: C.green, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: C.sans }}>
                    + Agregar
                  </button>
                  <button onClick={() => actualizar(s.id, 'descontar')} disabled={guardando}
                    style={{ flex: 1, padding: '8px', background: '#3D2A00', border: `1px solid ${C.amber}`, borderRadius: 8, color: C.amber, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: C.sans }}>
                    - Descontar
                  </button>
                  <button onClick={() => { setEditando(null); setCantidad('') }}
                    style={{ padding: '8px 12px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, fontSize: 12, cursor: 'pointer', fontFamily: C.sans }}>
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => { setEditando(s.id); setCantidad('') }}
                style={{ width: '100%', padding: '6px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 6, color: C.muted, fontSize: 11, cursor: 'pointer', fontFamily: C.sans, marginTop: 4 }}>
                Actualizar stock
              </button>
            )}
          </div>
        )
      })}
    </>
  )
}

function PesadaMovil({ nav, usuario, corrales, onDone }) {
  const [form, setForm] = useState({ A: '', B: '', C: '', D: '', menores: '', observaciones: '' })
  const [corralSel, setCorralSel] = useState('')
  const [guardando, setGuardando] = useState(false)

  const corralesActivos = corrales.filter(c => c.rol !== 'libre' && c.rol !== 'deshabilitado')
  const RANGOS = [
    { key: 'A', label: 'Rango A', rango: '200-230 kg', color: '#1A3D26', border: '#7BC67A', text: '#7EC87E' },
    { key: 'B', label: 'Rango B', rango: '231-260 kg', color: '#0F2040', border: '#7EB8F7', text: '#7EB8F7' },
    { key: 'C', label: 'Rango C', rango: '261-290 kg', color: '#2A1A40', border: '#B09ED4', text: '#B09ED4' },
    { key: 'D', label: 'Rango D', rango: '291+ kg',    color: '#3D2A00', border: '#F5C97A', text: '#F5C97A' },
  ]

  const totalIngresado = ['A','B','C','D'].reduce((s,k) => s + (parseInt(form[k])||0), 0)
  const corral = corralesActivos.find(c => String(c.id) === corralSel)

  async function guardar() {
    if (!corralSel) { alert('Selecciona un corral'); return }
    if (totalIngresado === 0) { alert('Ingresa al menos un animal'); return }
    setGuardando(true)

    const corralId = parseInt(corralSel)
    const rangoA = parseInt(form.A) || 0
    const rangoB = parseInt(form.B) || 0
    const rangoC = parseInt(form.C) || 0
    const rangoD = parseInt(form.D) || 0
    const menores = parseInt(form.menores) || 0
    const total = rangoA + rangoB + rangoC + rangoD + menores

    const { data: pesada, error } = await supabase.from('pesadas').insert({
      corral_id: corralId, tipo: 'clasificacion',
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

      const nuevaProxima = new Date(pesada.creado_en)
      nuevaProxima.setDate(nuevaProxima.getDate() + 40)
      await supabase.from('configuracion').update({ valor: nuevaProxima.toISOString().split('T')[0] }).eq('clave', 'proxima_pesada')

      onDone()
      alert('Pesada registrada correctamente.')
      nav('home')
    } else {
      alert('Error al guardar. Intenta de nuevo.')
    }
    setGuardando(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Topbar titulo="Nueva pesada" sub="Clasificacion por rangos" onBack={() => nav('home')} />
      <Scroll>
        <div style={{ marginBottom: '.85rem' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>Corral a pesar</div>
          <select value={corralSel} onChange={e => setCorralSel(e.target.value)}
            style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: C.text, fontFamily: C.sans }}>
            <option value="">Selecciona un corral</option>
            {corralesActivos.map(c => <option key={c.id} value={String(c.id)}>Corral {c.numero} - {c.rol} - {c.animales || 0} anim.</option>)}
          </select>
          {corral && (
            <div style={{ background: C.surface2, borderRadius: 6, padding: '8px 12px', marginTop: 6, fontSize: 12, color: C.muted, fontFamily: C.mono }}>
              Total animales: <strong style={{ color: C.green }}>{corral.animales || 0}</strong>
            </div>
          )}
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 8 }}>Distribucion por rangos</div>
        {RANGOS.map(r => (
          <div key={r.key} style={{ background: r.color, border: `1px solid ${r.border}`, borderRadius: 10, padding: '.85rem', marginBottom: '.65rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: r.text, textTransform: 'uppercase', marginBottom: 6 }}>
              {r.label} - {r.rango}
            </div>
            <input type="number" inputMode="numeric" placeholder="0" value={form[r.key]}
              onChange={e => setForm({...form, [r.key]: e.target.value})}
              style={{ width: '100%', background: 'rgba(0,0,0,.2)', border: `1px solid ${r.border}`, borderRadius: 6, padding: '10px 12px', fontSize: 18, fontFamily: C.mono, fontWeight: 700, color: r.text, boxSizing: 'border-box' }} />
          </div>
        ))}

        <div style={{ background: '#3D0A0A', border: `1px solid ${C.red}`, borderRadius: 10, padding: '.85rem', marginBottom: '.65rem' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.red, textTransform: 'uppercase', marginBottom: 6 }}>
            Menores de 200 kg - vuelven a acumulacion
          </div>
          <input type="number" inputMode="numeric" placeholder="0" value={form.menores}
            onChange={e => setForm({...form, menores: e.target.value})}
            style={{ width: '100%', background: 'rgba(0,0,0,.2)', border: `1px solid ${C.red}`, borderRadius: 6, padding: '10px 12px', fontSize: 18, fontFamily: C.mono, fontWeight: 700, color: C.red, boxSizing: 'border-box' }} />
        </div>

        {totalIngresado > 0 && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', marginBottom: '.85rem', fontSize: 13, fontFamily: C.mono }}>
            Total clasificado: <strong style={{ color: C.green }}>{totalIngresado} animales</strong>
          </div>
        )}

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>Observaciones</div>
          <input type="text" placeholder="observaciones opcionales..." value={form.observaciones}
            onChange={e => setForm({...form, observaciones: e.target.value})}
            style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: C.text, fontFamily: C.sans, boxSizing: 'border-box' }} />
        </div>

        <button onClick={guardar} disabled={guardando}
          style={{ width: '100%', background: C.green, border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 600, color: '#0A1A0A', cursor: 'pointer', fontFamily: C.sans, marginBottom: 8 }}>
          {guardando ? 'Guardando...' : 'Registrar pesada'}
        </button>
        <button onClick={() => nav('home')}
          style={{ width: '100%', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, fontSize: 14, color: C.muted, cursor: 'pointer', fontFamily: C.sans }}>
          Cancelar
        </button>
      </Scroll>
    </div>
  )
}

function VentaMovil({ nav, usuario, corrales, onDone }) {
  const [form, setForm] = useState({ corral_id: '', cantidad: '', kg_vivo: '', precio_kg: '', comprador: '', observaciones: '' })
  const [guardando, setGuardando] = useState(false)

  const corralesConAnimales = corrales.filter(c => (c.animales || 0) > 0 && c.rol !== 'deshabilitado')
  const kg_vivo = parseFloat(form.kg_vivo) || 0
  const desbaste = kg_vivo * 0.08
  const kg_neto = kg_vivo - desbaste
  const total = kg_neto * (parseFloat(form.precio_kg) || 0)

  async function guardar() {
    if (!form.corral_id) { alert('Selecciona un corral'); return }
    if (!form.cantidad || !form.kg_vivo || !form.precio_kg) { alert('Completa cantidad, kg vivo y precio'); return }
    setGuardando(true)

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
      const { data: corral } = await supabase.from('corrales').select('animales').eq('id', form.corral_id).single()
      const nuevosAnimales = Math.max(0, (corral?.animales || 0) - parseInt(form.cantidad))
      await supabase.from('corrales').update({ animales: nuevosAnimales }).eq('id', form.corral_id)
      onDone()
      alert('Venta registrada correctamente.')
      nav('home')
    } else {
      alert('Error al guardar. Intenta de nuevo.')
    }
    setGuardando(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Topbar titulo="Carga venta" sub="Venta kg vivo - desbaste 8%" onBack={() => nav('home')} />
      <Scroll>
        <div style={{ marginBottom: '.85rem' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>Corral</div>
          <select value={form.corral_id} onChange={e => setForm({...form, corral_id: e.target.value})}
            style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: C.text, fontFamily: C.sans }}>
            <option value="">Selecciona un corral</option>
            {corralesConAnimales.map(c => <option key={c.id} value={c.id}>Corral {c.numero} - {c.rol} - {c.animales || 0} anim.</option>)}
          </select>
        </div>

        {[
          { label: 'Cantidad animales', key: 'cantidad', placeholder: 'ej. 20' },
          { label: 'Kg vivo total (bascula)', key: 'kg_vivo', placeholder: 'ej. 8000' },
          { label: 'Precio $/kg', key: 'precio_kg', placeholder: 'ej. 2500' },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: '.85rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>{f.label}</div>
            <input type="number" inputMode="numeric" placeholder={f.placeholder} value={form[f.key]}
              onChange={e => setForm({...form, [f.key]: e.target.value})}
              style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 16, fontFamily: C.mono, fontWeight: 600, color: C.green, boxSizing: 'border-box' }} />
          </div>
        ))}

        {kg_vivo > 0 && (
          <div style={{ background: '#0F2040', border: `1px solid ${C.blue}`, borderRadius: 12, padding: '1rem', marginBottom: '.85rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.blue, textTransform: 'uppercase', marginBottom: 10 }}>Resumen liquidacion</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: total > 0 ? 12 : 0 }}>
              {[
                { label: 'KG vivo', value: kg_vivo.toLocaleString('es-AR') + ' kg' },
                { label: 'Desbaste 8%', value: Math.round(desbaste).toLocaleString('es-AR') + ' kg' },
                { label: 'KG neto', value: Math.round(kg_neto).toLocaleString('es-AR') + ' kg' },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: C.mono, color: C.blue }}>{s.value}</div>
                </div>
              ))}
            </div>
            {total > 0 && (
              <div style={{ paddingTop: 10, borderTop: '1px solid rgba(126,184,247,.2)' }}>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>Total estimado</div>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: C.mono, color: C.green }}>
                  ${total.toLocaleString('es-AR', {maximumFractionDigits:0})}
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ marginBottom: '.85rem' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>Comprador</div>
          <input type="text" placeholder="Nombre del comprador" value={form.comprador}
            onChange={e => setForm({...form, comprador: e.target.value})}
            style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: C.text, fontFamily: C.sans, boxSizing: 'border-box' }} />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>Observaciones</div>
          <input type="text" placeholder="observaciones opcionales..." value={form.observaciones}
            onChange={e => setForm({...form, observaciones: e.target.value})}
            style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: C.text, fontFamily: C.sans, boxSizing: 'border-box' }} />
        </div>

        <button onClick={guardar} disabled={guardando}
          style={{ width: '100%', background: C.green, border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 600, color: '#0A1A0A', cursor: 'pointer', fontFamily: C.sans, marginBottom: 8 }}>
          {guardando ? 'Guardando...' : 'Registrar venta'}
        </button>
        <button onClick={() => nav('home')}
          style={{ width: '100%', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, fontSize: 14, color: C.muted, cursor: 'pointer', fontFamily: C.sans }}>
          Cancelar
        </button>
      </Scroll>
    </div>
  )
}
