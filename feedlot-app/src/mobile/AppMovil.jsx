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
    home:        <Home usuario={usuario} nav={nav} />,
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

function home: <Home usuario={usuario} nav={nav} />,
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
        <div style={{ background: '#0F2040', border: `1px solid ${C.blue}`, borderRadius: 10, padding: '.85rem', marginBottom: '1rem', fontSize: 12, color: C.blue, lineHeight: 1.6 }}>
          Registrás datos y kg báscula. El precio lo completan en oficina.
        </div>
        {[
         <div style={{ marginBottom: '.85rem' }}>
  <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>Procedencia</div>
  <select value={form.procedencia} onChange={e => setForm({...form, procedencia: e.target.value, otraProcedencia: ''})}
    style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: C.text, fontFamily: C.sans }}>
    {['Remate ROSGAN','Remate Canuelas','Campo propio','Invernada Sanchez','Otro'].map(o => <option key={o}>{o}</option>)}
  </select>
procedencia: form.procedencia === 'Otro' ? (form.otraProcedencia || 'Otro') : form.procedencia,
    <input type="text" placeholder="Escribi la procedencia..." value={form.otraProcedencia || ''}
      onChange={e => setForm({...form, otraProcedencia: e.target.value})}
      style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: C.text, fontFamily: C.sans, boxSizing: 'border-box', marginTop: 6 }} />
  )}
</div>
<div style={{ marginBottom: '.85rem' }}>
  <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>Categoria</div>
  <select value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})}
    style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: C.text, fontFamily: C.sans }}>
    {['Novillos 2-3 anos','Novillos 3-4 anos','Vaquillonas','Terneros'].map(o => <option key={o}>{o}</option>)}
  </select>
</div>

function AlimentacionMovil({ nav, usuario }) {
  const corralesAlim = [
    { num: 3, rol: 'Cuarentena', etapa: 'acostumbramiento', anim: 82, kgAyer: 800 },
    { num: 13, rol: 'Acumulación', etapa: 'acostumbramiento', anim: 247, kgAyer: 2400 },
    { num: 2, rol: 'Clasif. A', etapa: 'recria', anim: 88, kgAyer: 840 },
    { num: 4, rol: 'Clasif. B', etapa: 'recria', anim: 95, kgAyer: 900 },
    { num: 7, rol: 'Clasif. C', etapa: 'terminacion', anim: 93, kgAyer: 1160 },
    { num: 5, rol: 'Clasif. D', etapa: 'terminacion', anim: 98, kgAyer: 1225 },
  ]
  const FRML = {
    acostumbramiento: [{n:'Rollo',kg:38,c:'#639922'},{n:'Maíz seco',kg:39,c:'#E8A020'},{n:'Vitaminas',kg:2,c:'#5090E0'},{n:'Urea',kg:0.5,c:'#9060C0'},{n:'Soja',kg:3,c:'#20A060'},{n:'Agua',kg:17,c:'#60A0E0'}],
    recria:           [{n:'Rollo',kg:26,c:'#639922'},{n:'Maíz seco',kg:55,c:'#E8A020'},{n:'Vitaminas',kg:2,c:'#5090E0'},{n:'Urea',kg:1,c:'#9060C0'},{n:'Agua',kg:17,c:'#60A0E0'}],
    terminacion:      [{n:'Rollo',kg:13,c:'#639922'},{n:'Maíz seco',kg:68,c:'#E8A020'},{n:'Vitaminas',kg:1,c:'#5090E0'},{n:'Urea',kg:1,c:'#9060C0'},{n:'Agua',kg:17,c:'#60A0E0'}],
  }
  const [kgs, setKgs] = useState(corralesAlim.map(c => c.kgAyer))
  const [pils, setPils] = useState(corralesAlim.map(() => null))
  const [tab, setTab] = useState('piletas')
  const [mostrarMixer, setMostrarMixer] = useState(false)

  function setPileta(i, tipo) {
    const a = corralesAlim[i].kgAyer
    const newKgs = [...kgs]
    newKgs[i] = tipo === 'bajo' ? Math.max(0, a - 100) : tipo === 'normal' ? a : a + 100
    setKgs(newKgs)
    const newPils = [...pils]; newPils[i] = tipo; setPils(newPils)
  }

  const total = kgs.reduce((a, b) => a + b, 0)

  // Agrupar por etapa para los mixers
  const MIXERS = [
    { nombre: 'Mixer 1 · Acostumbramiento', etapa: 'acostumbramiento', idx: [0, 1], cap: 4000 },
    { nombre: 'Mixer 2 · Recría', etapa: 'recria', idx: [2, 3], cap: 4000 },
    { nombre: 'Mixer 3 · Terminación', etapa: 'terminacion', idx: [4, 5], cap: 4000 },
  ]

  async function confirmar() {
    const registros = corralesAlim.map((c, i) => ({
      fecha: new Date().toISOString().split('T')[0],
      corral_id: null, // se resolvería con ID real
      kg_ayer: c.kgAyer, kg_hoy: kgs[i], pileta: pils[i],
      confirmado: true, registrado_por: usuario?.id,
    }))
    // En producción: await supabase.from('raciones_diarias').insert(registros)
    alert(`Raciones confirmadas. ${total.toLocaleString('es-AR')} kg totales.`)
    nav('home')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Topbar titulo="Alimentación" sub="Ración diaria" onBack={() => nav('home')} />
      {/* Tabs */}
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
            {corralesAlim.map((c, i) => {
              const d = kgs[i] - c.kgAyer
              return (
                <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '.9rem', marginBottom: '.65rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.5rem' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Corral {c.num}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{c.rol} · ayer: {c.kgAyer.toLocaleString('es-AR')} kg</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: C.mono }}>{kgs[i].toLocaleString('es-AR')}</div>
                      <div style={{ fontSize: 11, fontFamily: C.mono, color: d > 0 ? C.amber : d < 0 ? C.green : C.muted }}>{(d >= 0 ? '+' : '') + d} kg</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 5, marginBottom: '.5rem' }}>
                    {[['bajo', 'Sobró −100', C.green, '#1A3D26'], ['normal', 'Poco =', C.blue, '#0F2040'], ['vacio', 'Vacío +100', C.amber, '#3D2A00']].map(([tipo, label, color, bg]) => (
                      <button key={tipo} onClick={() => setPileta(i, tipo)}
                        style={{ flex: 1, padding: '7px 4px', fontSize: 10, fontWeight: 600, borderRadius: 6, cursor: 'pointer', fontFamily: C.sans, border: `1px solid ${pils[i] === tipo ? color : C.border}`, background: pils[i] === tipo ? bg : 'transparent', color: pils[i] === tipo ? color : C.muted }}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <input type="number" inputMode="numeric" value={kgs[i]}
                    onChange={e => { const n = [...kgs]; n[i] = parseInt(e.target.value) || 0; setKgs(n) }}
                    style={{ width: '100%', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 12px', fontSize: 15, fontFamily: C.mono, fontWeight: 600, color: C.green, textAlign: 'right', boxSizing: 'border-box' }} />
                </div>
              )
            })}

            {/* Total y mixer */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '1rem', marginBottom: '.65rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Total mixer hoy</div>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: C.mono, color: C.green }}>{total.toLocaleString('es-AR')} kg</div>
              </div>
              <button onClick={() => setMostrarMixer(!mostrarMixer)}
                style={{ width: '100%', background: C.green, border: 'none', borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 600, color: '#0A1A0A', cursor: 'pointer', fontFamily: C.sans }}>
                {mostrarMixer ? 'Ocultar ingredientes' : 'Ver ingredientes del mixer →'}
              </button>
            </div>

            {mostrarMixer && MIXERS.map((mx, mi) => {
              const totalMx = mx.idx.reduce((a, ci) => a + kgs[ci], 0)
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

            <button onClick={confirmar}
              style={{ width: '100%', background: C.green, border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 600, color: '#0A1A0A', cursor: 'pointer', fontFamily: C.sans, marginBottom: 8 }}>
              ✓ Confirmar raciones
            </button>
          </>
        )}

        {tab === 'stock' && (
          <>
            {[
              { n: 'Rollo (heno)', kg: 45000, min: 5000, c: '#639922' },
              { n: 'Maíz grano seco', kg: 4200, min: 5000, c: '#E8A020' },
              { n: 'Vitaminas', kg: 420, min: 200, c: '#5090E0' },
              { n: 'Urea', kg: 180, min: 100, c: '#9060C0' },
              { n: 'Soja (expeller)', kg: 3200, min: 500, c: '#20A060' },
            ].map((s, i) => {
              const bajo = s.kg <= s.min
              const color = bajo ? C.amber : C.green
              return (
                <div key={i} style={{ padding: '.75rem 0', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.c }} />{s.n}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: C.mono, color }}>{bajo ? '⚠ ' : ''}{s.kg.toLocaleString('es-AR')} kg</div>
                  </div>
                  <div style={{ height: 4, background: C.surface2, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 2, background: color, width: `${Math.min(100, Math.round(s.kg / Math.max(s.min * 3, s.kg) * 100))}%` }} />
                  </div>
                  {bajo && <div style={{ fontSize: 11, color: C.amber, marginTop: 3 }}>Bajo mínimo · reponer</div>}
                </div>
              )
            })}
          </>
        )}
      </Scroll>
    </div>
  )
}

function SanidadMovil({ nav }) {
  const [pantSan, setPantSan] = useState('alertas')
  const [revState, setRevState] = useState([
    { num: 2, rol: 'Clasif. A', anim: 88 }, { num: 3, rol: 'Cuarentena', anim: 82 },
    { num: 4, rol: 'Clasif. B', anim: 95 }, { num: 5, rol: 'Clasif. D', anim: 98 },
    { num: 7, rol: 'Clasif. C', anim: 93 }, { num: 13, rol: 'Acumulación', anim: 247 },
  ].map(c => ({ ...c, ok: null, desc: '', diag: 'Conjuntivitis', prod: '' })))
  const [dosisOk, setDosisOk] = useState(false)

  function setCorralRev(i, ok) {
    const n = [...revState]; n[i] = { ...n[i], ok }; setRevState(n)
  }

  function confirmarRevision() {
    const sin = revState.filter(r => r.ok === null).length
    if (sin > 0) { alert(`Falta revisar ${sin} corral${sin !== 1 ? 'es' : ''}.`); return }
    alert('Revisión del ' + new Date().toLocaleDateString('es-AR') + ' confirmada.')
    setPantSan('alertas')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Topbar titulo="Sanidad" sub={pantSan === 'revision' ? 'Revisión bisemanal' : 'Alertas y eventos'} onBack={pantSan === 'revision' ? () => setPantSan('alertas') : () => nav('home')} />
      <Scroll>
        {pantSan === 'alertas' && (
          <>
            {/* Alerta segunda dosis */}
            <div style={{ background: dosisOk ? '#1A3D26' : '#3D2A00', border: `1px solid ${dosisOk ? C.green : C.amber}`, borderRadius: 12, padding: '1rem', marginBottom: '.65rem' }}>
              {dosisOk ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 22 }}>✅</div>
                  <div><div style={{ fontSize: 13, fontWeight: 600, color: C.green }}>Segunda dosis registrada</div><div style={{ fontSize: 12, color: C.muted }}>Alliance + Feedlot · L-2026-07 · 82 animales</div></div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.amber, marginBottom: 3 }}>💉 Repetir Alliance + Feedlot</div>
                  <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, marginBottom: '.65rem' }}>L-2026-07 · 82 animales · ingresaron con 171 kg (&lt;180 kg). Vence: <strong style={{ color: C.amber }}>04/05/2026</strong></div>
                  <button onClick={() => setDosisOk(true)}
                    style={{ width: '100%', padding: 10, background: '#2A1A00', border: `1px solid ${C.amber}`, borderRadius: 8, color: C.amber, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: C.sans }}>
                    ✓ Confirmar que se aplicó hoy
                  </button>
                </>
              )}
            </div>

            {/* Alerta revisión */}
            <div style={{ background: '#0F2040', border: `1px solid ${C.blue}`, borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.blue, marginBottom: 3 }}>📋 Revisión bisemanal</div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, marginBottom: '.65rem' }}>Hoy corresponde recorrer todos los corrales. Última: jueves 16/04.</div>
              <button onClick={() => setPantSan('revision')}
                style={{ width: '100%', padding: 10, background: '#0A1A30', border: `1px solid ${C.blue}`, borderRadius: 8, color: C.blue, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: C.sans }}>
                Iniciar revisión →
              </button>
            </div>
          </>
        )}

        {pantSan === 'revision' && (
          <>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: '1rem', lineHeight: 1.6 }}>
              Marcá cada corral. Si no hay novedades, tocá <strong style={{ color: C.green }}>Sin novedades</strong>. Si hay problema, tocá <strong style={{ color: C.amber }}>Hay novedad</strong>.
            </div>
            {revState.map((c, i) => (
              <div key={i} style={{ background: c.ok === true ? '#1A3D26' : c.ok === false ? '#3D2A00' : C.surface, border: `1px solid ${c.ok === true ? C.green : c.ok === false ? C.amber : C.border}`, borderRadius: 12, padding: '1rem', marginBottom: '.65rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: c.ok === null ? '.65rem' : 0 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Corral {c.num}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{c.rol} · {c.anim} animales</div>
                  </div>
                  {c.ok === true && <div style={{ fontSize: 12, fontWeight: 600, color: C.green }}>Sin novedades ✓</div>}
                  {c.ok === false && <div style={{ fontSize: 12, fontWeight: 600, color: C.amber }}>Con novedad</div>}
                </div>
                {c.ok === null && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setCorralRev(i, true)}
                      style={{ flex: 1, padding: '9px', background: '#1A3D26', border: `1px solid ${C.green}`, borderRadius: 8, color: C.green, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: C.sans }}>
                      Sin novedades ✓
                    </button>
                    <button onClick={() => setCorralRev(i, false)}
                      style={{ flex: 1, padding: '9px', background: '#3D2A00', border: `1px solid ${C.amber}`, borderRadius: 8, color: C.amber, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: C.sans }}>
                      Hay novedad
                    </button>
                  </div>
                )}
                {c.ok === false && (
                  <div style={{ marginTop: '.65rem', paddingTop: '.65rem', borderTop: `1px solid ${C.border}` }}>
                    <input type="text" placeholder="Descripción del animal" value={c.desc}
                      onChange={e => { const n = [...revState]; n[i].desc = e.target.value; setRevState(n) }}
                      style={{ width: '100%', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, color: C.text, fontFamily: C.sans, boxSizing: 'border-box', marginBottom: 6 }} />
                    <select onChange={e => { const n = [...revState]; n[i].prod = e.target.value; setRevState(n) }}
                      style={{ width: '100%', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, color: C.text, fontFamily: C.sans }}>
                      <option value="">— Producto aplicado —</option>
                      {['Alliance','Feedlot','Ivermectina 1%','Oxitetraciclina','Oxitetraciclina oftálmica','Enrofloxacina','Meloxicam'].map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                )}
                {c.ok !== null && (
                  <button onClick={() => setCorralRev(i, null)}
                    style={{ marginTop: 8, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 12px', fontSize: 11, color: C.muted, cursor: 'pointer', fontFamily: C.sans }}>
                    Cambiar
                  </button>
                )}
              </div>
            ))}
            <button onClick={confirmarRevision}
              style={{ width: '100%', background: C.green, border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 600, color: '#0A1A0A', cursor: 'pointer', fontFamily: C.sans, marginBottom: 8 }}>
              ✓ Confirmar revisión completa
            </button>
          </>
        )}
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
