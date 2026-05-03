import { useState } from 'react'
import { supabase } from '../supabase'
const C = {
  bg: '#1A2E1A', surface: '#243324', surface2: '#2E3F2E',
  border: '#3A4F3A', text: '#E8F0E8', muted: '#8FA88F',
  green: '#7EC87E', amber: '#F5C97A', red: '#F09595',
  blue: '#7EB8F7', mono: "'IBM Plex Mono', monospace", sans: "'IBM Plex Sans', sans-serif",
}
export default function AppMovil({ usuario, onLogout }) {
  const [pantalla, setPantalla] = useState('home')
  const nav = (p) => setPantalla(p)
  const pantallas = {
    home:        <Home usuario={usuario} nav={nav} onLogout={onLogout} />,
    corrales:    <Corrales nav={nav} />,
    ingreso:     <Ingreso nav={nav} usuario={usuario} />,
    pesada:      <PlaceholderMovil titulo="Pesada" nav={nav} />,
    alimentacion:<AlimentacionMovil nav={nav} usuario={usuario} />,
    sanidad:     <SanidadMovil nav={nav} />,
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
function Home({ usuario, nav, onLogout }) {
  const tareas = [
    { icon: '🌾', titulo: 'Alimentación', sub: 'Lectura de piletas y mixer', pantalla: 'alimentacion', urgente: true },
    { icon: '🔍', titulo: 'Revisión bisemanal', sub: 'Hoy lunes · 6 corrales', pantalla: 'sanidad', urgente: true },
    { icon: '💉', titulo: 'Repetir Alliance+Feedlot', sub: 'L-2026-07 · vence 04/05', pantalla: 'sanidad', urgente: false },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Topbar titulo="Feedlot" sub={`Hola, ${usuario?.nombre || 'Empleado'}`} onLogout={onLogout} />
      <Scroll>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '.65rem' }}>Tareas del día</div>
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
        <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '.07em', margin: '1rem 0 .65rem' }}>Acciones rápidas</div>
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
function Corrales({ nav }) {
  const corralesData = [
    { num: 3, rol: 'Cuarentena', anim: 82, cap: 100 },
    { num: 13, rol: 'Acumulación', anim: 247, cap: 160 },
    { num: 2, rol: 'Clasif. A', anim: 88, cap: 100 },
    { num: 4, rol: 'Clasif. B', anim: 95, cap: 100 },
    { num: 7, rol: 'Clasif. C', anim: 93, cap: 100 },
    { num: 5, rol: 'Clasif. D', anim: 98, cap: 100 },
    { num: 15, rol: 'Enfermería', anim: 3, cap: 50 },
  ]
  const colors = { Cuarentena: C.amber, Acumulación: C.blue, Enfermería: C.red }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Topbar titulo="Corrales" sub="Estado actual" onBack={() => nav('home')} />
      <Scroll>
        {corralesData.map(c => {
          const pct = Math.round(c.anim / c.cap * 100)
          const color = colors[c.rol] || C.green
          return (
            <div key={c.num} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '1rem', marginBottom: '.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Corral {c.num}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{c.rol}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: C.mono, color }}>{c.anim}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>de {c.cap}</div>
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
function Ingreso({ nav, usuario }) {
  const [form, setForm] = useState({ procedencia: 'Remate ROSGAN', categoria: 'Novillos 2–3 años', cantidad: '', kg_bascula: '', observaciones: '' })
  const [guardando, setGuardando] = useState(false)
  const prom = form.cantidad && form.kg_bascula ? Math.round(parseFloat(form.kg_bascula) / parseInt(form.cantidad)) : null
  async function guardar() {
    if (!form.cantidad || !form.kg_bascula) { alert('Completá cantidad y kg báscula.'); return }
    setGuardando(true)
    const codigo = `L-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`
    const { error } = await supabase.from('lotes').insert({
      codigo, fecha_ingreso: new Date().toISOString().split('T')[0],
      procedencia: form.procedencia, categoria: form.categoria,
      cantidad: parseInt(form.cantidad), kg_bascula: parseFloat(form.kg_bascula),
      peso_prom_ingreso: Math.round(parseFloat(form.kg_bascula) / parseInt(form.cantidad) * 100) / 100,
      observaciones: form.observaciones, registrado_por: usuario?.id,
    })
    setGuardando(false)
    if (!error) { alert(`Lote ${codigo} registrado.`); nav('home') }
    else alert('Error al guardar. Intentá de nuevo.')
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Topbar titulo="Nuevo ingreso" sub="Llegada de lote" onBack={() => nav('home')} />
      <Scroll>
        {[
          { label: 'Procedencia', key: 'procedencia', opts: ['Remate ROSGAN','Remate Cañuelas','Campo propio','Invernada Sánchez','Otro'] },
          { label: 'Categoría', key: 'categoria', opts: ['Novillos 2–3 años','Novillos 3–4 años','Vaquillonas','Terneros'] },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: '.85rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{f.label}</div>
            <select value={form[f.key]} onChange={e => setForm({...form, [f.key]: e.target.value})}
              style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: C.text, fontFamily: C.sans }}>
              {f.opts.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        ))}
        {[
          { label: 'Cantidad de animales', key: 'cantidad', placeholder: 'ej. 85' },
          { label: 'Kg medidos en báscula', key: 'kg_bascula', placeholder: 'ej. 20380' },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: '.85rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{f.label}</div>
            <input type="number" inputMode="numeric" placeholder={f.placeholder} value={form[f.key]}
              onChange={e => setForm({...form, [f.key]: e.target.value})}
              style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 16, fontFamily: C.mono, fontWeight: 600, color: C.green, boxSizing: 'border-box' }} />
          </div>
        ))}
        {prom && <div style={{ background: C.surface2, borderRadius: 8, padding: '.75rem', marginBottom: '.85rem', fontSize: 13, color: C.green, fontFamily: C.mono }}>Peso prom. estimado: <strong>{prom} kg/animal</strong></div>}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Observaciones</div>
          <input type="text" placeholder="condición, sanidad previa, etc." value={form.observaciones}
            onChange={e => setForm({...form, observaciones: e.target.value})}
            style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: C.text, fontFamily: C.sans, boxSizing: 'border-box' }} />
        </div>
        <button onClick={guardar} disabled={guardando}
          style={{ width: '100%', background: C.green, border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 600, color: '#0A1A0A', cursor: 'pointer', fontFamily: C.sans, marginBottom: 8 }}>
          {guardando ? 'Guardando...' : '✓ Registrar ingreso'}
        </button>
        <button onClick={() => nav('home')}
          style={{ width: '100%', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, fontSize: 14, color: C.muted, cursor: 'pointer', fontFamily: C.sans }}>
          Cancelar
        </button>
      </Scroll>
    </div>
  )
}
function AlimentacionMovil({ nav }) {
  const [tab, setTab] = useState('piletas')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Topbar titulo="Alimentación" sub="Ración diaria" onBack={() => nav('home')} />
      <Scroll>
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: C.muted, fontSize: 13 }}>
          Módulo de alimentación disponible en escritorio.
        </div>
      </Scroll>
    </div>
  )
}
function SanidadMovil({ nav }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Topbar titulo="Sanidad" onBack={() => nav('home')} />
      <Scroll>
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: C.muted, fontSize: 13 }}>
          Módulo de sanidad disponible en escritorio.
        </div>
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
          Módulo en integración.<br />Disponible en la próxima sesión.
        </div>
      </Scroll>
    </div>
  )
}
