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
    const [{ data: corrales }, { data: cfg }, { data: alertas }, { data: lotes }, { data: ventas }, { data: stockBajo }, { data: movimientos }] = await Promise.all([
      supabase.from('corrales').select('*').not('rol', 'eq', 'deshabilitado').order('numero'),
      supabase.from('pesadas').select('fecha, creado_en').order('creado_en', { ascending: false }).limit(1).single(),
      supabase.from('alertas').select('*').eq('resuelta', false).order('fecha_vence'),
      supabase.from('lotes').select('id, codigo, procedencia, fecha_ingreso, corral_cuarentena_id, cantidad').order('created_at', { ascending: false }),
      supabase.from('ventas').select('id, comprador, precio_kg, kg_vivo_total, kg_neto, cantidad, corral_id, creado_en, corrales(numero)').is('precio_kg', null).order('creado_en', { ascending: false }),
      supabase.from('stock_insumos').select('*').filter('cantidad_kg', 'lte', 'minimo_kg'),
      supabase.from('movimientos').select('corral_destino_id, fecha').order('fecha', { ascending: false }),
    ])
    const ayer = new Date(); ayer.setDate(ayer.getDate() - 1)
    const ayerStr = ayer.toISOString().split('T')[0]
    const [{ data: formulasDB }, { data: cfgMixer }, { data: racionesAyer }] = await Promise.all([
      supabase.from('formulas_mixer').select('*').order('orden'),
      supabase.from('configuracion').select('clave, valor').in('clave', ['capacidad_mixer_terminacion', 'capacidad_mixer_recria', 'capacidad_mixer_acostumbramiento', 'fecha_term_c']),
      supabase.from('raciones_app').select('corral_id, kg_total, fecha, creado_en').order('creado_en', { ascending: false }).limit(500),
    ])
    // Construir formulas desde BD
    const formulasObj = {
      seco: { acostumbramiento: [], recria: [], terminacion: [] },
      humedo: { acostumbramiento: [], recria: [], terminacion: [] }
    }
    ;(formulasDB || []).forEach(row => {
      if (formulasObj[row.dieta] && formulasObj[row.dieta][row.etapa]) {
        formulasObj[row.dieta][row.etapa].push({ n: row.ingrediente, kg: row.kg, c: row.color || '#888' })
      }
    })
    const procedencias = [...new Set((lotes || []).map(x => x.procedencia).filter(Boolean))].sort()
    const compradores = [...new Set((ventas || []).filter(v => v.comprador).map(v => v.comprador))].sort()
    const corralesOrdenados = (corrales || []).sort((a, b) => parseInt(a.numero) - parseInt(b.numero))
    const capMixer = {
      acostumbramiento: parseInt((cfgMixer || []).find(c => c.clave === 'capacidad_mixer_acostumbramiento')?.valor || '2000'),
      recria: parseInt((cfgMixer || []).find(c => c.clave === 'capacidad_mixer_recria')?.valor || '2500'),
      terminacion: parseInt((cfgMixer || []).find(c => c.clave === 'capacidad_mixer_terminacion')?.valor || '4200'),
    }
    const fechaTermC = (cfgMixer || []).find(c => c.clave === 'fecha_term_c')?.valor || null
    // Usar el kg_total mas reciente por corral
    // Encontrar la fecha más reciente de raciones (puede ser hoy o ayer)
    const fechasRaciones = [...new Set((racionesAyer || []).map(r => r.fecha))].sort().reverse()
    const fechaUltimaRacion = fechasRaciones[0] || null
    const kgsAyer = {}
    ;(racionesAyer || []).filter(r => r.fecha === fechaUltimaRacion).forEach(r => {
      if (kgsAyer[r.corral_id] === undefined) kgsAyer[r.corral_id] = r.kg_total ?? 0
    })
    // Calcular próxima pesada: última pesada + 40 días
    const ultimaPesadaFecha = cfg?.fecha || cfg?.creado_en?.split('T')[0]
    let proximaPesadaCalc = null
    if (ultimaPesadaFecha) {
      const d = new Date(ultimaPesadaFecha + 'T12:00:00')
      d.setDate(d.getDate() + 40)
      proximaPesadaCalc = d.toISOString().split('T')[0]
    }
    setDatos({ corrales: corralesOrdenados, proximaPesada: proximaPesadaCalc, alertas: alertas || [], procedencias, compradores, ventasSinPrecio: ventas || [], stockBajo: stockBajo || [], formulas: formulasObj, capMixer, fechaTermC, kgsAyer, lotes: lotes || [], movimientos: movimientos || [] })
  }

  const pantallas = {
    home:        <Home usuario={usuario} nav={nav} onLogout={onLogout} datos={datos} />,
    corrales:    <Corrales nav={nav} corrales={datos.corrales} usuario={usuario} esEncargado={esEncargado} onDone={cargarDatos} />,
    ingreso:     <Ingreso nav={nav} usuario={usuario} corrales={datos.corrales} procedencias={datos.procedencias || []} onDone={cargarDatos} />,
    pesada:      <PesadaMovil nav={nav} usuario={usuario} corrales={datos.corrales} onDone={cargarDatos} />,
    alimentacion:<AlimentacionMovil nav={nav} usuario={usuario} corrales={datos.corrales} formulas={datos.formulas} capMixer={datos.capMixer} kgsAyer={datos.kgsAyer} fechaTermC={datos.fechaTermC} onDone={cargarDatos} />,
    sanidad:     <SanidadMovil nav={nav} alertas={datos.alertas} proximaPesada={datos.proximaPesada} onDone={cargarDatos} corrales={datos.corrales} lotes={datos.lotes} movimientos={datos.movimientos} usuario={usuario} />,
    venta:       <VentaMovil nav={nav} usuario={usuario} corrales={datos.corrales} compradores={datos.compradores || []} onDone={cargarDatos} />,
    novedad:     <PlaceholderMovil titulo="Novedad / Movimiento" nav={nav} />,
    servicios:   <ServiciosMovil nav={nav} usuario={usuario} />,
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
  const { proximaPesada, alertas, corrales, stockBajo } = datos
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
  // Stock bajo mínimo
  if (stockBajo && stockBajo.length > 0) {
    stockBajo.forEach(s => {
      tareas.push({ icon: '📦', titulo: `Stock bajo: ${s.insumo}`, sub: `${s.cantidad_kg?.toLocaleString('es-AR')} kg · mínimo ${s.minimo_kg?.toLocaleString('es-AR')} kg`, pantalla: 'alimentacion', urgente: true })
    })
  }

  // Corrales en cuarentena próximos a vencer (ingresados hace más de 8 días)
  const corralesCuarentena = corrales.filter(c => c.rol === 'cuarentena')
  corralesCuarentena.forEach(c => {
    // Buscar el último movimiento hacia este corral
    // Usar fecha del último lote en ese corral
    const ultimoLote = (datos.lotes || []).find(l => l.corral_cuarentena_id === c.id)
    const ultimaFecha = ultimoLote?.fecha_ingreso || ((datos.movimientos || []).find(m => m.corral_destino_id === c.id)?.fecha?.split('T')[0]) || null
      ? (() => {
          const hoy = new Date(); const inicio = new Date(ultimaFecha + 'T00:00:00')
          const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`
          const inicioStr = ultimaFecha
          const diff = new Date(hoyStr) - new Date(inicioStr)
          return Math.floor(diff / (1000 * 60 * 60 * 24))
        })()
      : null
    tareas.push({
      icon: '🐄',
      titulo: `Cuarentena C-${c.numero} — ${diasDesde !== null ? `${diasDesde} días` : 'fecha desconocida'}`,
      sub: `${c.animales || 0} animales · último ingreso ${ultimaFecha ? new Date(ultimaFecha + 'T12:00:00').toLocaleDateString('es-AR') : '?'}`,
      pantalla: 'sanidad',
      urgente: diasDesde === null || diasDesde >= 8
    })
  })

  // Revision bisemanal los lunes (1) y jueves (4)
  const diaSemana = new Date().getDay()
  if (diaSemana === 1 || diaSemana === 4) {
    tareas.unshift({ icon: '🔍', titulo: 'Revision bisemanal de corrales', sub: 'Hoy corresponde revisar todos los corrales', pantalla: 'sanidad', tabDestino: 'revision', urgente: true })
  }

  if (tareas.length === 0) {
    tareas.push({ icon: '✅', titulo: 'Sin tareas urgentes', sub: 'Todo en orden', pantalla: 'sanidad', urgente: false })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Topbar titulo="Feedlot" sub={`Hola, ${usuario?.nombre || 'Empleado'} - ${totalAnimales} animales`} onLogout={onLogout} />
      <Scroll>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '.65rem' }}>Tareas del dia</div>
        {tareas.map((t, i) => (
          <div key={i} onClick={() => { 
                  if (t.tabDestino) window.__sanidadTab = t.tabDestino
                  nav(t.pantalla) 
                }}
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
            ...(['matias_eu@hotmail.com','martin@campo.com'].includes(usuario?.email) ? [{ icon: '🚜', label: 'Servicios', p: 'servicios' }] : []),
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
  const [rolDestino, setRolDestino] = useState('')
  const [subDestino, setSubDestino] = useState('')
  const [guardando, setGuardando] = useState(false)
  const corralesActivos = corrales.filter(c => c.rol !== 'deshabilitado')
  const colors = { cuarentena: C.amber, acumulacion: C.blue, enfermeria: C.red, clasificado: '#B09ED4', libre: C.muted }

  // Corral destino seleccionado
  const corralDestino = corrales.find(c => String(c.id) === String(movForm.destino_id))
  const destinoEsLibre = corralDestino?.rol === 'libre'
  const rolDestinoRequerido = destinoEsLibre && !rolDestino

  async function cambiarRol(corralId, nuevoRol, sub = null) {
    await supabase.from('corrales').update({ rol: nuevoRol, sub: sub || null }).eq('id', corralId)
    onDone(); setVista('lista'); setSeleccionado(null)
  }

  async function moverAnimales() {
    if (!movForm.destino_id || !movForm.cantidad) { alert('Completa destino y cantidad'); return }
    const cantidad = parseInt(movForm.cantidad)
    if (cantidad > (seleccionado?.animales || 0)) { alert(`Max: ${seleccionado?.animales} animales`); return }
    if (destinoEsLibre && !rolDestino) { alert('Seleccioná el rol del corral destino'); return }
    if (destinoEsLibre && rolDestino === 'clasificado' && !subDestino) { alert('Seleccioná el rango del corral clasificado'); return }
    setGuardando(true)
    const destinoId = parseInt(movForm.destino_id)

    await supabase.from('movimientos').insert({
      tipo: 'traslado', corral_origen_id: seleccionado.id,
      corral_destino_id: destinoId, cantidad,
      motivo: movForm.motivo || null, registrado_por: usuario?.id
    })

    // Actualizar origen
    const nuevosOrigen = (seleccionado.animales || 0) - cantidad
    const updateOrigen = { animales: nuevosOrigen }
    if (nuevosOrigen === 0) updateOrigen.rol = 'libre' // auto-libre si quedó vacío
    await supabase.from('corrales').update(updateOrigen).eq('id', seleccionado.id)

    // Actualizar destino
    const { data: dest } = await supabase.from('corrales').select('animales').eq('id', destinoId).single()
    const updateDestino = { animales: (dest?.animales || 0) + cantidad }
    if (destinoEsLibre) {
      updateDestino.rol = rolDestino
      if (rolDestino === 'clasificado') updateDestino.sub = subDestino
    }
    await supabase.from('corrales').update(updateDestino).eq('id', destinoId)

    onDone()
    setMovForm({ destino_id: '', cantidad: '', motivo: '' })
    setRolDestino('')
    setSubDestino('')
    setVista('lista')
    setSeleccionado(null)
    setGuardando(false)
    alert(`${cantidad} animales movidos.${nuevosOrigen === 0 ? ' El corral origen quedó libre.' : ''}`)
  }

  if (vista === 'detalle' && seleccionado) {
    const pct = Math.round((seleccionado.animales || 0) / (seleccionado.capacidad || 100) * 100)
    const color = colors[seleccionado.rol] || C.green
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Topbar titulo={`Corral ${seleccionado.numero}`} sub={seleccionado.rol === 'clasificado' && seleccionado.sub ? `Clasificado · Rango ${seleccionado.sub}` : seleccionado.rol} onBack={() => { setVista('lista'); setSeleccionado(null) }} />
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
                  <button key={r} onClick={() => {
                    if (r === 'clasificado') {
                      const rango = prompt('Ingresá el rango (A, B, C, D, E, F o G):')
                      if (!rango || !['A','B','C','D','E','F','G'].includes(rango.toUpperCase())) { alert('Rango inválido'); return }
                      cambiarRol(seleccionado.id, 'clasificado', rango.toUpperCase())
                    } else {
                      cambiarRol(seleccionado.id, r)
                    }
                  }}
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
            <select value={movForm.destino_id} onChange={e => { setMovForm({...movForm, destino_id: e.target.value}); setRolDestino(''); setSubDestino('') }}
              style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: C.text, fontFamily: C.sans }}>
              <option value="">Selecciona destino</option>
              {destinosDisponibles.map(c => <option key={c.id} value={c.id}>Corral {c.numero} - {c.rol === 'libre' ? 'LIBRE' : c.rol === 'clasificado' && c.sub ? `Rango ${c.sub}` : c.rol} - {c.animales || 0} anim.</option>)}
            </select>
          </div>

          {/* Si el destino es libre, pedir el rol */}
          {destinoEsLibre && (
            <div style={{ background: '#0F2040', border: `1px solid ${C.blue}`, borderRadius: 10, padding: '1rem', marginBottom: '.85rem' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.blue, marginBottom: 8 }}>El corral destino está libre — ¿qué rol le asignás?</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: rolDestino === 'clasificado' ? 8 : 0 }}>
                {['cuarentena','acumulacion','clasificado','enfermeria'].map(r => (
                  <button key={r} onClick={() => { setRolDestino(r); if (r !== 'clasificado') setSubDestino('') }}
                    style={{ padding: '9px', background: rolDestino === r ? C.blue : 'transparent', border: `1px solid ${rolDestino === r ? C.blue : C.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: rolDestino === r ? '#0A1A0A' : C.muted, cursor: 'pointer', fontFamily: C.sans }}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
              </div>
              {rolDestino === 'clasificado' && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.blue, textTransform: 'uppercase', marginBottom: 6 }}>Rango</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                    {['A','B','C','D','E','F','G'].map(r => (
                      <button key={r} onClick={() => setSubDestino(r)}
                        style={{ padding: '8px', background: subDestino === r ? C.green : 'transparent', border: `1px solid ${subDestino === r ? C.green : C.border}`, borderRadius: 8, fontSize: 13, fontWeight: 700, color: subDestino === r ? '#0A1A0A' : C.muted, cursor: 'pointer', fontFamily: C.mono }}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
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
      <Topbar titulo="Corrales" sub={`${corralesActivos.filter(c=>c.rol!=='libre').length} activos · ${corralesActivos.filter(c=>c.rol==='libre').length} libres`} onBack={() => nav('home')} />
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
                  <div style={{ fontSize: 12, color: C.muted }}>{c.rol === 'clasificado' && c.sub ? `Clasificado · Rango ${c.sub}` : c.rol}</div>
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
function Ingreso({ nav, usuario, corrales, procedencias, onDone }) {
  const [form, setForm] = useState({ procedencia: '', otraProcedencia: '', categoria: 'Novillos 2-3 anos', cantidad: '', kg_bascula: '', observaciones: '', corral_id: '' })
  const [guardando, setGuardando] = useState(false)
  const prom = form.cantidad && form.kg_bascula ? Math.round(parseFloat(form.kg_bascula) / parseInt(form.cantidad)) : null
  const corralesCuarentena = corrales.filter(c => c.rol === 'cuarentena' || c.rol === 'libre')

  async function guardar() {
    if (!form.cantidad || !form.kg_bascula) { alert('Completa cantidad y kg bascula.'); return }
    const procFinal = form.procedencia === 'Otro' ? (form.otraProcedencia?.trim() || 'Otro') : (form.procedencia || null)
    setGuardando(true)
    const codigo = `L-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`
    const _hoy = new Date()
    const _fechaHoy = `${_hoy.getFullYear()}-${String(_hoy.getMonth()+1).padStart(2,'0')}-${String(_hoy.getDate()).padStart(2,'0')}`
    const { error } = await supabase.from('lotes').insert({
      codigo, fecha_ingreso: _fechaHoy,
      procedencia: procFinal, categoria: form.categoria,
      cantidad: parseInt(form.cantidad), kg_bascula: parseFloat(form.kg_bascula),
      peso_prom_ingreso: Math.round(parseFloat(form.kg_bascula) / parseInt(form.cantidad) * 100) / 100,
      observaciones: form.observaciones || null, registrado_por: usuario?.id,
      corral_cuarentena_id: form.corral_id || null,
    })
    if (!error) {
      if (form.corral_id) {
        const { data: corral } = await supabase.from('corrales').select('animales, numero').eq('id', form.corral_id).single()
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
            <option value="">— Seleccioná —</option>
            {(procedencias || []).map(o => <option key={o} value={o}>{o}</option>)}
            <option value="Otro">+ Nueva procedencia...</option>
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
function AlimentacionMovil({ nav, usuario, corrales, formulas, capMixer, kgsAyer, fechaTermC, onDone }) {
  const [dieta, setDieta] = useState('seco')
  const corralesAlim = corrales.filter(c => c.rol !== 'libre' && c.rol !== 'deshabilitado')
  const hoyStr = new Date().toISOString().split('T')[0]
  const cEnTerminacion = fechaTermC && hoyStr >= fechaTermC
  const RANGOS_RECRIA = cEnTerminacion ? ['A','B'] : ['A','B','C']
  const RANGOS_TERM_MOV = cEnTerminacion ? ['C','D','E','F','G','H'] : ['D','E','F','G','H']
  function getEtapa(c) {
    if (c.rol === 'cuarentena') return 'acostumbramiento'
    if (c.rol === 'acumulacion' || c.rol === 'enfermeria') return 'recria'
    if (c.rol === 'clasificado') return RANGOS_RECRIA.includes(c.sub) ? 'recria' : 'terminacion'
    return 'recria'
  }
  const FRML = (formulas?.[dieta]) || {
    acostumbramiento: [{n:'Rollo',kg:38,c:'#639922'},{n:'Maiz seco',kg:39,c:'#E8A020'},{n:'Vitaminas',kg:2,c:'#5090E0'},{n:'Urea',kg:0.5,c:'#9060C0'},{n:'Soja',kg:3,c:'#20A060'},{n:'Agua',kg:17,c:'#60A0E0'}],
    recria:           [{n:'Rollo',kg:26,c:'#639922'},{n:'Maiz seco',kg:55,c:'#E8A020'},{n:'Vitaminas',kg:2,c:'#5090E0'},{n:'Urea',kg:1,c:'#9060C0'},{n:'Agua',kg:17,c:'#60A0E0'}],
    terminacion:      [{n:'Rollo',kg:13,c:'#639922'},{n:'Maiz seco',kg:68,c:'#E8A020'},{n:'Vitaminas',kg:1,c:'#5090E0'},{n:'Urea',kg:1,c:'#9060C0'},{n:'Agua',kg:17,c:'#60A0E0'}],
  }
  const [kgs, setKgs] = useState({})
  const [pils, setPils] = useState({})
  const [tab, setTab] = useState('piletas')
  const [mostrarMixer, setMostrarMixer] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mostrarConfirmReemplazo, setMostrarConfirmReemplazo] = useState(false)
  const [mostrarAgregarRollo, setMostrarAgregarRollo] = useState(false)
  const [kgsRolloExtra, setKgsRolloExtra] = useState({}) // { [corral_id]: kg }
  const [guardandoRollo, setGuardandoRollo] = useState(false)

  useEffect(() => {
    const inicial = {}
    corralesAlim.forEach(c => {
      // Si hay datos de ayer, usarlos; sino calcular por defecto
      if (kgsAyer && kgsAyer[c.id] !== undefined) {
        inicial[c.id] = kgsAyer[c.id]
      } else {
        inicial[c.id] = Math.round(Math.round((c.animales || 0) * 10) / 100) * 100
      }
    })
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

  const capAcost = capMixer?.acostumbramiento || 2000
  const capRecria = capMixer?.recria || 2500
  const capTerm = capMixer?.terminacion || 4200
  const MIXERS = [
    { nombre: 'Mixer 1 - Acostumbramiento', etapa: 'acostumbramiento', corralesIds: corralesAlim.filter(c => getEtapa(c) === 'acostumbramiento').map(c => c.id), cap: capAcost },
    { nombre: 'Mixer 2 - Recria', etapa: 'recria', corralesIds: corralesAlim.filter(c => getEtapa(c) === 'recria').map(c => c.id), cap: capRecria },
    { nombre: 'Mixer 3 - Terminacion', etapa: 'terminacion', corralesIds: corralesAlim.filter(c => getEtapa(c) === 'terminacion').map(c => c.id), cap: capTerm },
  ].filter(m => m.corralesIds.length > 0)

  async function agregarRolloHoy() {
    setGuardandoRollo(true)
    const ahora = new Date()
    const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth()+1).padStart(2,'0')}-${String(ahora.getDate()).padStart(2,'0')}`
    const corralesRollo = corralesAlim.filter(c => (kgsRolloExtra[c.id] || 0) > 0)
    const { data: stockItemsFresh } = await supabase.from('stock_insumos').select('*')
    let kgRolloTotal = 0
    for (const c of corralesRollo) {
      const kg = parseInt(kgsRolloExtra[c.id]) || 0
      if (!kg) continue
      kgRolloTotal += kg
      // Actualizar o insertar ración de rollo extra para este corral
      const { data: racionExist } = await supabase.from('raciones_app').select('id, kg_total').eq('fecha', hoy).eq('corral_id', c.id).single()
      if (racionExist) {
        await supabase.from('raciones_app').update({ kg_total: (racionExist.kg_total || 0) + kg }).eq('id', racionExist.id)
      } else {
        await supabase.from('raciones_app').insert({ corral_id: c.id, fecha: hoy, kg_total: kg, mezclador: 'Acostumbramiento', solo_rollo: true, tipo_dieta: dieta })
      }
    }
    // Descontar rollo del stock
    if (kgRolloTotal > 0 && stockItemsFresh) {
      const rolloItem = stockItemsFresh.find(s => s.insumo === 'Rollo (heno)') || stockItemsFresh.find(s => s.insumo.toLowerCase().includes('rollo'))
      if (rolloItem) {
        const nuevaCant = Math.max(0, (rolloItem.cantidad_kg || 0) - kgRolloTotal)
        await supabase.from('stock_insumos').update({ cantidad_kg: nuevaCant, actualizado_en: new Date().toISOString() }).eq('id', rolloItem.id)
      }
    }
    setKgsRolloExtra({})
    setMostrarAgregarRollo(false)
    setGuardandoRollo(false)
    alert(`Rollo extra registrado: ${kgRolloTotal} kg`)
  }

  async function confirmar() {
    setGuardando(true)
    const ahora = new Date()
    const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth()+1).padStart(2,'0')}-${String(ahora.getDate()).padStart(2,'0')}`

    // Verificar si ya hay raciones confirmadas hoy
    const { data: yaConfirmadas } = await supabase.from('raciones_app').select('id').eq('fecha', hoy).limit(1)
    if (yaConfirmadas && yaConfirmadas.length > 0) {
      // Ya confirmadas hoy — mostrar cartel de reemplazo, mantener guardando=false
      setGuardando(false)
      setMostrarConfirmReemplazo(true)
      return
    }
    // No hay raciones hoy — confirmar directo
    await ejecutarConfirmar(hoy)
  }

  async function ejecutarConfirmar(hoy) {
    setMostrarConfirmReemplazo(false)
    setGuardando(true)
      // Eliminar raciones de hoy y recomponer stock
      const { data: racionesHoy } = await supabase.from('raciones_app').select('corral_id, kg_total, mezclador').eq('fecha', hoy)
      // Recomponer stock — sumar lo que se había descontado
      const { data: stockItems } = await supabase.from('stock_insumos').select('*')
      if (stockItems && racionesHoy) {
        const stockFreshRecomp = {}
        stockItems.forEach(s => { stockFreshRecomp[s.id] = s.cantidad_kg || 0 })
        const descPorEtapa = { acostumbramiento: 0, recria: 0, terminacion: 0 }
        racionesHoy.forEach(r => {
          const etapa = r.mezclador === 'Acostumbramiento' ? 'acostumbramiento' : r.mezclador === 'Recria' ? 'recria' : 'terminacion'
          descPorEtapa[etapa] = (descPorEtapa[etapa] || 0) + (r.kg_total || 0)
        })
        for (const etapa of Object.keys(descPorEtapa)) {
          const totalKg = descPorEtapa[etapa]
          if (totalKg === 0) continue
          const formula = (FRML?.seco?.[etapa] || FRML?.[etapa] || [])
          for (const ing of formula) {
            const kgIng = Math.round(ing.kg * totalKg / 100)
            if (kgIng === 0) continue
            const stockItem = stockItems.find(s => s.insumo === ing.n) || stockItems.find(s => s.insumo.toLowerCase().includes(ing.n.toLowerCase().split(' ')[0].toLowerCase()) || ing.n.toLowerCase().includes(s.insumo.toLowerCase().split(' ')[0].toLowerCase()))
            if (stockItem) {
              stockFreshRecomp[stockItem.id] = (stockFreshRecomp[stockItem.id] || 0) + kgIng
              await supabase.from('stock_insumos').update({ cantidad_kg: stockFreshRecomp[stockItem.id] }).eq('id', stockItem.id)
            }
          }
        }
      }
      // Eliminar raciones de hoy
      await supabase.from('raciones_app').delete().eq('fecha', hoy)
    const registros = corralesAlim.map(c => {
      const etapa = getEtapa(c)
      return {
        corral_id: c.id,
        fecha: hoy,
        kg_total: kgs[c.id] || 0,
        mezclador: etapa === 'acostumbramiento' ? 'Acostumbramiento' : etapa === 'recria' ? 'Recria' : 'Terminacion',
        tipo_dieta: dieta,
      }
    })
    for (const reg of registros) {
      if (!reg.corral_id) continue
      await supabase.from('raciones_app').insert(reg)
    }

    // Descontar del stock — separar corrales con solo rollo de los normales
    const descuentoPorEtapa = { acostumbramiento: 0, recria: 0, terminacion: 0 }
    let kgSoloRollo = 0
    corralesAlim.forEach(c => {
      const etapa = getEtapa(c)
      const kg = kgs[c.id] || 0
      if (soloRollo[c.id]) {
        kgSoloRollo += kg
      } else {
        descuentoPorEtapa[etapa] = (descuentoPorEtapa[etapa] || 0) + kg
      }
    })

    const { data: stockItemsFresh } = await supabase.from('stock_insumos').select('*')
    if (stockItemsFresh) {
      // Recargar stock fresco para evitar valores desactualizados
      const stockFresh = {}
      stockItemsFresh.forEach(s => { stockFresh[s.id] = s.cantidad_kg || 0 })

      for (const etapa of Object.keys(descuentoPorEtapa)) {
        const totalKgEtapa = descuentoPorEtapa[etapa]
        if (totalKgEtapa === 0) continue
        // FRML puede ser { seco: { acostumbramiento: [...] } } o { acostumbramiento: [...] }
        const formula = (FRML?.seco?.[etapa] || FRML?.[etapa] || [])
        for (const ing of formula) {
          const kgIng = Math.round(ing.kg * totalKgEtapa / 100)
          if (kgIng === 0) continue
          const stockItem = stockItemsFresh.find(s => s.insumo === ing.n) ||
            stockItemsFresh.find(s =>
              s.insumo.toLowerCase().includes(ing.n.toLowerCase().split(' ')[0].toLowerCase()) ||
              ing.n.toLowerCase().includes(s.insumo.toLowerCase().split(' ')[0].toLowerCase())
            )
          if (!stockItem) continue // skip si no matchea (ej. Agua)
          const nuevaCantidad = Math.max(0, stockFresh[stockItem.id] - kgIng)
          stockFresh[stockItem.id] = nuevaCantidad
          await supabase.from('stock_insumos').update({
            cantidad_kg: nuevaCantidad,
            actualizado_en: new Date().toISOString()
          }).eq('id', stockItem.id)
        }
      }
      // Descontar solo rollo para corrales marcados
      const kgRolloExtra = corralesAlim.filter(c => rolloYMixer[c.id]).reduce((s, c) => s + (kgsRollo[c.id] || 0), 0)
      const kgRolloTotal = kgSoloRollo + kgRolloExtra
      if (kgRolloTotal > 0) {
        const rolloItem = stockItemsFresh.find(s => s.insumo === 'Rollo (heno)') || stockItemsFresh.find(s => s.insumo.toLowerCase().includes('rollo'))
        if (rolloItem) {
          const nuevaCantidad = Math.max(0, stockFresh[rolloItem.id] - kgRolloTotal)
          await supabase.from('stock_insumos').update({ cantidad_kg: nuevaCantidad, actualizado_en: new Date().toISOString() }).eq('id', rolloItem.id)
        }
      }
    }

    onDone()
    alert(`Raciones confirmadas. ${total.toLocaleString('es-AR')} kg totales.`)
    nav('home')
    setGuardando(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Topbar titulo="Alimentacion" sub="Racion diaria" onBack={() => nav('home')} />
      <div style={{ display: 'flex', gap: 8, padding: '8px 12px', background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 11, color: C.muted, alignSelf: 'center' }}>Dieta:</div>
        {['seco', 'humedo'].map(d => (
          <button key={d} onClick={() => setDieta(d)}
            style={{ flex: 1, padding: '7px', fontSize: 13, fontWeight: dieta === d ? 700 : 400,
              background: dieta === d ? C.green : C.surface2,
              color: dieta === d ? '#0A1A0A' : C.muted,
              border: `1px solid ${dieta === d ? C.green : C.border}`,
              borderRadius: 8, cursor: 'pointer', fontFamily: C.sans }}>
            {d === 'seco' ? 'Maiz seco' : 'Maiz humedo'}
          </button>
        ))}
      </div>
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
                      <div style={{ fontSize: 11, color: C.muted }}>{c.rol === 'clasificado' && c.sub ? `Rango ${c.sub}` : c.rol} · {c.animales || 0} animales</div>
                      <div style={{ fontSize: 11, fontWeight: 600, marginTop: 2, color: getEtapa(c) === 'acostumbramiento' ? C.amber : getEtapa(c) === 'recria' ? C.blue : C.green }}>
                        {getEtapa(c) === 'acostumbramiento' ? '🌱 Acostumbramiento' : getEtapa(c) === 'recria' ? '🌾 Recría' : '🏁 Terminación'}
                      </div>

                      {kgsAyer && kgsAyer[c.id] > 0 && (
                        <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>
                          Ayer: {kgsAyer[c.id].toLocaleString('es-AR')} kg
                        </div>
                      )}
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
              {(() => {
                const kgMixer = total
                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.5rem' }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Total mixer hoy</div>
                      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: C.mono, color: C.green }}>{kgMixer.toLocaleString('es-AR')} kg</div>
                    </div>

                    <button onClick={() => setMostrarMixer(!mostrarMixer)}
                      style={{ width: '100%', background: C.green, border: 'none', borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 600, color: '#0A1A0A', cursor: 'pointer', fontFamily: C.sans }}>
                      {mostrarMixer ? 'Ocultar ingredientes' : 'Ver ingredientes del mixer'}
                    </button>
                  </>
                )
              })()}
            </div>
            {mostrarMixer && MIXERS.map((mx, mi) => {
              // Excluir corrales con solo rollo del mixer
              const totalMx = mx.corralesIds.reduce((a, id) => a + (soloRollo[id] ? 0 : (kgs[id] || 0)), 0)
              if (totalMx === 0) return null
              const f = FRML[mx.etapa]
              const factor = totalMx / 100
              const superaCap = totalMx > mx.cap
              const nCargas = superaCap ? Math.ceil(totalMx / mx.cap) : 1
              const kgPorCarga = superaCap ? Math.round(totalMx / nCargas) : totalMx
              const factorCarga = kgPorCarga / 100
              let acum = 0
              return (
                <div key={mi} style={{ background: C.surface, border: `1px solid ${superaCap ? C.amber : C.border}`, borderRadius: 12, marginBottom: '.65rem', overflow: 'hidden' }}>
                  <div style={{ padding: '.75rem 1rem', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.green }}>{mx.nombre}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: C.mono, color: superaCap ? C.amber : C.green }}>{totalMx.toLocaleString('es-AR')} kg</div>
                  </div>
                  {superaCap && (
                    <div style={{ background: '#3D2A00', padding: '.75rem 1rem', borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.amber }}>
                        ⚠ Supera la capacidad ({mx.cap.toLocaleString('es-AR')} kg)
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                        Preparar <strong style={{ color: C.amber }}>{nCargas} cargas iguales</strong> de ~{kgPorCarga.toLocaleString('es-AR')} kg cada una
                      </div>
                    </div>
                  )}
                  <div style={{ padding: '6px 1rem', background: C.surface2, borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: 'uppercase' }}>
                      {superaCap ? `Ingredientes por carga (~${kgPorCarga.toLocaleString('es-AR')} kg)` : 'Ingredientes'}
                    </div>
                  </div>
                  {f.map((ing, ii) => {
                    const kg = Math.round(ing.kg * (superaCap ? factorCarga : factor))
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
                  {superaCap && (
                    <div style={{ padding: '.75rem 1rem', background: '#1A3D26' }}>
                      <div style={{ fontSize: 12, color: C.green }}>
                        Total por carga: <strong>{kgPorCarga.toLocaleString('es-AR')} kg</strong> × {nCargas} cargas = <strong>{totalMx.toLocaleString('es-AR')} kg</strong>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {/* Modal confirmación reemplazo */}
            {mostrarConfirmReemplazo && (
              <div style={{ background: '#FFF3CD', border: '2px solid #FFC107', borderRadius: 12, padding: '1.25rem', marginBottom: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#7A4500', marginBottom: 8 }}>⚠ Ya se confirmaron raciones hoy</div>
                <div style={{ fontSize: 13, color: '#7A4500', marginBottom: 12 }}>¿Querés reemplazar las raciones de hoy con los valores actuales?</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => ejecutarConfirmar(new Date().toISOString().split('T')[0])}
                    style={{ flex: 1, background: C.green, border: 'none', borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 600, color: '#0A1A0A', cursor: 'pointer' }}>
                    Sí, reemplazar
                  </button>
                  <button onClick={() => setMostrarConfirmReemplazo(false)}
                    style={{ flex: 1, background: '#fff', border: '1px solid #CCC', borderRadius: 8, padding: 12, fontSize: 14, color: '#555', cursor: 'pointer' }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            <button onClick={confirmar} disabled={guardando || mostrarConfirmReemplazo}
              style={{ width: '100%', background: guardando || mostrarConfirmReemplazo ? '#4A6A4A' : C.green, border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 600, color: '#0A1A0A', cursor: guardando || mostrarConfirmReemplazo ? 'default' : 'pointer', fontFamily: C.sans, marginBottom: 8 }}>
              {guardando ? 'Guardando...' : mostrarConfirmReemplazo ? 'Respondé el cartel de arriba ↑' : 'Confirmar raciones'}
            </button>
            {/* Botón agregar rollo — siempre visible, cualquier corral */}
            {!mostrarAgregarRollo ? (
              <button onClick={() => setMostrarAgregarRollo(true)}
                style={{ width: '100%', background: 'transparent', border: `1px solid #639922`, borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 600, color: '#639922', cursor: 'pointer', fontFamily: C.sans, marginTop: 8 }}>
                🌿 Agregar rollo
              </button>
            ) : (
              <div style={{ background: '#F0F7E6', border: '1px solid #639922', borderRadius: 10, padding: '1rem', marginTop: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#639922', marginBottom: 12 }}>🌿 Agregar rollo</div>
                {corralesAlim.map(c => (
                  <div key={c.id} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, color: '#639922', fontWeight: 600, marginBottom: 4 }}>Corral {c.numero} ({c.animales} animales)</div>
                    <input type="number" inputMode="numeric" placeholder="0 kg" value={kgsRolloExtra[c.id] || ''}
                      onChange={e => setKgsRolloExtra({...kgsRolloExtra, [c.id]: parseInt(e.target.value) || 0})}
                      style={{ width: '100%', background: '#fff', border: '1px solid #639922', borderRadius: 8, padding: '10px 12px', fontSize: 16, fontFamily: C.mono, fontWeight: 600, color: '#639922', boxSizing: 'border-box' }} />
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={() => { setMostrarAgregarRollo(false); setKgsRolloExtra({}) }}
                    style={{ flex: 1, background: '#fff', border: '1px solid #CCC', borderRadius: 8, padding: 12, fontSize: 14, color: '#555', cursor: 'pointer' }}>
                    Cancelar
                  </button>
                  <button onClick={agregarRolloHoy} disabled={guardandoRollo || !Object.values(kgsRolloExtra).some(v => v > 0)}
                    style={{ flex: 1, background: '#639922', border: 'none', borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
                    {guardandoRollo ? 'Guardando...' : '💾 Confirmar rollo'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        {tab === 'stock' && (
          <StockTab usuario={usuario} onDone={onDone} />
        )}
      </Scroll>
    </div>
  )
}
function SanidadMovil({ nav, alertas, proximaPesada, onDone, corrales, lotes, movimientos, usuario }) {
  const [pantSan, setPantSan] = useState(() => {
    const t = window.__sanidadTab || 'alertas'
    window.__sanidadTab = null
    return t
  })
  const [confirmados, setConfirmados] = useState({})
  const [revState, setRevState] = useState([])
  const [formEvento, setFormEvento] = useState({ corral_id: '', prod_id: '', producto: '', dosis_ml: '5', cantidad: '', observaciones: '' })
  const [guardando, setGuardando] = useState(false)
  const [stockSanitario, setStockSanitario] = useState([])
  const [vacunacionMovil, setVacunacionMovil] = useState({})

  const corralesActivos = corrales.filter(c => c.rol !== 'libre' && c.rol !== 'deshabilitado')
  const proximaDate = proximaPesada ? new Date(proximaPesada + 'T12:00:00') : null
  const diasPesada = proximaDate ? Math.ceil((proximaDate - new Date()) / (1000 * 60 * 60 * 24)) : null

  const PRODUCTOS = ['Alliance+Feedlot','Ivermectina','Oxitetraciclina','Oxitetraciclina oftálmica','Enrofloxacina','Meloxicam','Vitamina AD3E']

  useEffect(() => {
    setRevState(corralesActivos.map(c => ({ id: c.id, numero: c.numero, rol: c.rol, animales: c.animales || 0, ok: null, enfermos: [] })))
  }, [corrales])

  useEffect(() => {
    supabase.from('stock_sanitario').select('*').order('producto').then(({ data }) => setStockSanitario(data || []))
  }, [])

  async function confirmarAlerta(id) {
    await supabase.from('alertas').update({ resuelta: true, resuelta_en: new Date().toISOString() }).eq('id', id)
    setConfirmados(prev => ({...prev, [id]: true}))
    onDone()
  }

  async function confirmarRevision() {
    const sin = revState.filter(s => s.ok === null).length
    if (sin > 0) { alert(`Falta revisar ${sin} corral${sin !== 1 ? 'es' : ''}.`); return }
    setGuardando(true)
    await supabase.from('revisiones').insert({ tipo: 'bisemanal', registrado_por: usuario?.id })
    for (const st of revState) {
      const novedades = st.enfermos || []
      await supabase.from('eventos_sanitarios').insert({
        tipo: 'revision', corral_id: st.id,
        producto: st.ok ? 'Sin novedad' : 'Varios',
        cantidad_animales: st.ok ? st.animales : novedades.length,
        observaciones: st.ok ? 'Sin novedades' : novedades.map(e => `${e.desc} - ${e.diag}`).join('; '),
        registrado_por: usuario?.id,
      })
      for (const enf of novedades) {
        if (enf.desc) {
          await supabase.from('animales_enfermeria').insert({
            corral_origen_id: st.id, descripcion: enf.desc, diagnostico: enf.diag,
            tratamiento: enf.prod, estado: 'en tratamiento', registrado_por: usuario?.id,
          })
        }
      }
    }
    onDone()
    alert('Revision confirmada.')
    setPantSan('alertas')
    setGuardando(false)
  }

  async function registrarEvento() {
    if (!formEvento.corral_id) { alert('Selecciona un corral'); return }
    if (!formEvento.prod_id) { alert('Selecciona un producto'); return }
    if (!formEvento.cantidad) { alert('Ingresa la cantidad de animales'); return }
    setGuardando(true)
    const cantAnimales = parseInt(formEvento.cantidad)
    const dosisMl = parseFloat(formEvento.dosis_ml) || 0
    const mlTotal = dosisMl > 0 ? Math.round(cantAnimales * dosisMl) : null
    // Descontar del stock sanitario
    if (mlTotal > 0) {
      const prod = stockSanitario.find(p => String(p.id) === String(formEvento.prod_id))
      if (prod) {
        const nuevaCant = Math.max(0, (prod.cantidad_ml || 0) - mlTotal)
        await supabase.from('stock_sanitario').update({ cantidad_ml: nuevaCant, actualizado_en: new Date().toISOString() }).eq('id', prod.id)
      }
    }
    await supabase.from('eventos_sanitarios').insert({
      tipo: 'tratamiento', corral_id: parseInt(formEvento.corral_id),
      producto: formEvento.producto, cantidad_animales: cantAnimales,
      cantidad_ml: mlTotal,
      observaciones: formEvento.observaciones || null, registrado_por: usuario?.id,
    })
    onDone()
    alert(`Evento registrado.${mlTotal ? ` Se descontaron ${mlTotal.toLocaleString('es-AR')} ml de ${formEvento.producto}.` : ''}`)
    setPantSan('alertas')
    setFormEvento({ corral_id: '', prod_id: '', producto: '', dosis_ml: '5', cantidad: '', observaciones: '' })
    setGuardando(false)
  }

  const TABS = [
    { key: 'alertas', label: 'Alertas' },
    { key: 'revision', label: 'Revision' },
    { key: 'evento', label: 'Evento' },
    { key: 'mortalidad', label: '💀 Muerte' },
    { key: 'stock', label: '📦 Stock' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Topbar titulo="Sanidad" onBack={() => nav('home')} />
      <div style={{ display: 'flex', background: C.surface, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setPantSan(t.key)}
            style={{ flex: 1, padding: '10px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: C.sans, background: pantSan === t.key ? C.green : 'transparent', color: pantSan === t.key ? '#0A1A0A' : C.muted, borderBottom: pantSan === t.key ? `2px solid ${C.green}` : '2px solid transparent' }}>
            {t.label}
          </button>
        ))}
      </div>
      <Scroll>
        {pantSan === 'alertas' && (
          <>
            {proximaDate && (
              <div style={{ background: diasPesada <= 7 ? '#3D2A00' : '#1A3D26', border: `1px solid ${diasPesada <= 7 ? C.amber : C.green}`, borderRadius: 12, padding: '1rem', marginBottom: '.65rem' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: diasPesada <= 7 ? C.amber : C.green, marginBottom: 3 }}>Proxima pesada fija</div>
                <div style={{ fontSize: 12, color: C.muted }}>
                  {proximaDate.toLocaleDateString('es-AR')}
                  <span style={{ marginLeft: 8, fontWeight: 600, color: diasPesada <= 7 ? C.amber : C.green }}>
                    {diasPesada <= 0 ? '- Realizar hoy' : `- en ${diasPesada} dias`}
                  </span>
                </div>
              </div>
            )}
            {alertas.length === 0 && corrales.filter(c => c.rol === 'cuarentena').length === 0 && <div style={{ textAlign: 'center', padding: '1rem', color: C.muted, fontSize: 13 }}>Sin alertas pendientes.</div>}
            {/* Cuarentenas */}
            {corrales.filter(c => c.rol === 'cuarentena').map(c => {
              // Usar fecha del último lote en ese corral
              const ultimoLote = (lotes || []).find(l => l.corral_cuarentena_id === c.id)
              const ultimaFecha = ultimoLote?.fecha_ingreso || (movimientos || []).find(m => m.corral_destino_id === c.id)?.fecha?.split('T')[0] || null
              const dias = ultimaFecha ? (() => {
                const hoy = new Date()
                const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`
                return Math.floor((new Date(hoyStr) - new Date(ultimaFecha)) / (1000 * 60 * 60 * 24))
              })() : null
              if (dias === null) return null
              return (
                <div key={c.id} style={{ background: '#3D2A00', border: `1px solid ${C.amber}`, borderRadius: 12, padding: '1rem', marginBottom: '.65rem' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.amber, marginBottom: 3 }}>🐄 Cuarentena C-{c.numero} — {dias} días</div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: '.65rem' }}>
                    {c.animales} animales · último ingreso {ultimaFecha ? new Date(ultimaFecha + 'T12:00:00').toLocaleDateString('es-AR') : '?'}
                  </div>
                  {/* Botón vacunar — al ingreso */}
                  {(() => {
                    const loteC = (lotes || []).find(l => l.corral_cuarentena_id === c.id)
                    const vacunas = stockSanitario.filter(p => p.tipo === 'Vacuna')
                    const vacKey = loteC?.id || c.id
                    const vac = vacunacionMovil[vacKey] || {}
                    const vacSeleccionadas = vac.vacunas || [{ prod_id: '', dosis: '5' }]
                    const expandido = vacunacionMovil[`exp_vac_${c.id}`]
                    if (vac.confirmada) {
                      return (
                        <div style={{ background: '#1A3D26', border: `1px solid ${C.green}`, borderRadius: 8, padding: '8px 12px', marginBottom: 8, fontSize: 12, color: C.green }}>
                          ✓ Vacunado — {(vac.resumen || []).map(r => `${r.nombre} ${r.dosis}ml/animal`).join(' · ')}
                        </div>
                      )
                    }
                    return (
                      <div style={{ marginBottom: 8 }}>
                        {!expandido ? (
                          <button onClick={() => setVacunacionMovil(prev => ({...prev, [`exp_vac_${c.id}`]: true}))}
                            style={{ width: '100%', padding: 10, background: '#2A1A00', border: `1px solid ${C.amber}`, borderRadius: 8, color: C.amber, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: C.sans }}>
                            💉 Vacunar al ingreso
                          </button>
                        ) : (
                          <div style={{ background: '#1A1A1A', border: `1px solid ${C.amber}`, borderRadius: 8, padding: '1rem' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: C.amber, marginBottom: 10 }}>💉 Vacunación — C-{c.numero}</div>
                            {vacunas.length === 0 ? (
                              <div style={{ fontSize: 12, color: C.amber }}>⚠ No hay vacunas en stock.</div>
                            ) : (
                              <>
                                {vacSeleccionadas.map((vs, vi) => {
                                  const prodSel = vacunas.find(p => String(p.id) === String(vs.prod_id))
                                  const mlTotal = vs.prod_id && vs.dosis && loteC ? Math.round(loteC.cantidad * parseFloat(vs.dosis || 5)) : null
                                  return (
                                    <div key={vi} style={{ marginBottom: 10 }}>
                                      <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>
                                        {vi === 0 ? 'Vacuna' : `Vacuna ${vi + 1}`}
                                      </div>
                                      <select value={vs.prod_id || ''}
                                        onChange={e => {
                                          const nuevas = vacSeleccionadas.map((x, i) => i === vi ? {...x, prod_id: e.target.value} : x)
                                          setVacunacionMovil(prev => ({...prev, [vacKey]: {...(prev[vacKey]||{}), vacunas: nuevas}}))
                                        }}
                                        style={{ width: '100%', background: C.surface, border: `1px solid ${C.amber}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: C.text, fontFamily: C.sans, marginBottom: 6 }}>
                                        <option value="">— Seleccioná —</option>
                                        {vacunas.map(p => (
                                          <option key={p.id} value={p.id}>{p.producto} · {(p.cantidad_ml || 0).toLocaleString('es-AR')} {p.unidad || 'ml'}</option>
                                        ))}
                                      </select>
                                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <div style={{ flex: 1 }}>
                                          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>ml/animal</div>
                                          <input type="number" inputMode="decimal" value={vs.dosis || '5'} step="0.5" min="0"
                                            onChange={e => {
                                              const nuevas = vacSeleccionadas.map((x, i) => i === vi ? {...x, dosis: e.target.value} : x)
                                              setVacunacionMovil(prev => ({...prev, [vacKey]: {...(prev[vacKey]||{}), vacunas: nuevas}}))
                                            }}
                                            style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 16, fontFamily: C.mono, fontWeight: 600, color: C.amber, boxSizing: 'border-box' }} />
                                        </div>
                                        {vacSeleccionadas.length > 1 && (
                                          <button onClick={() => {
                                            const nuevas = vacSeleccionadas.filter((_, i) => i !== vi)
                                            setVacunacionMovil(prev => ({...prev, [vacKey]: {...(prev[vacKey]||{}), vacunas: nuevas}}))
                                          }} style={{ padding: '10px 12px', fontSize: 13, background: '#2E1A1A', border: `1px solid ${C.red}`, color: C.red, borderRadius: 8, cursor: 'pointer', marginTop: 20 }}>✕</button>
                                        )}
                                      </div>
                                      {mlTotal && <div style={{ fontSize: 12, color: C.green, marginTop: 4 }}>→ {mlTotal.toLocaleString('es-AR')} ml ({loteC?.cantidad} × {vs.dosis} ml)</div>}
                                    </div>
                                  )
                                })}
                                <button onClick={() => {
                                  const nuevas = [...vacSeleccionadas, { prod_id: '', dosis: '5' }]
                                  setVacunacionMovil(prev => ({...prev, [vacKey]: {...(prev[vacKey]||{}), vacunas: nuevas}}))
                                }} style={{ width: '100%', background: 'transparent', border: `1px solid ${C.green}`, borderRadius: 8, padding: '10px', fontSize: 13, color: C.green, fontWeight: 600, marginBottom: 10, cursor: 'pointer' }}>
                                  + Agregar otra vacuna
                                </button>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button onClick={() => setVacunacionMovil(prev => ({...prev, [`exp_vac_${c.id}`]: false}))}
                                    style={{ flex: 1, background: '#1A1A1A', border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, fontSize: 13, color: C.muted, cursor: 'pointer' }}>
                                    Cancelar
                                  </button>
                                  <button disabled={!vacSeleccionadas.some(vs => vs.prod_id) || vac.guardando}
                                    onClick={async () => {
                                      const validas = vacSeleccionadas.filter(vs => vs.prod_id)
                                      if (!loteC || validas.length === 0) return
                                      setVacunacionMovil(prev => ({...prev, [vacKey]: {...prev[vacKey], guardando: true}}))
                                      const resumen = []
                                      for (const vs of validas) {
                                        const dosis = parseFloat(vs.dosis || 5)
                                        const mlDesc = Math.round(loteC.cantidad * dosis)
                                        const prod = vacunas.find(p => String(p.id) === String(vs.prod_id))
                                        if (!prod) continue
                                        const nuevaCant = Math.max(0, (prod.cantidad_ml || 0) - mlDesc)
                                        await supabase.from('stock_sanitario').update({ cantidad_ml: nuevaCant, actualizado_en: new Date().toISOString() }).eq('id', prod.id)
                                        await supabase.from('eventos_sanitarios').insert({
                                          tipo: 'vacunacion', corral_id: c.id,
                                          producto: prod.producto, cantidad_ml: mlDesc,
                                          cantidad_animales: loteC.cantidad,
                                          observaciones: `Ingreso ${loteC.codigo} — ${dosis} ml/animal`,
                                          registrado_por: usuario?.id,
                                        })
                                        resumen.push({ nombre: prod.producto, dosis, mlTotal: mlDesc })
                                      }
                                      await onDone()
                                      setVacunacionMovil(prev => ({...prev, [vacKey]: {...prev[vacKey], guardando: false, confirmada: true, resumen}, [`exp_vac_${c.id}`]: false}))
                                    }}
                                    style={{ flex: 2, background: vacSeleccionadas.some(vs => vs.prod_id) ? C.green : '#1A1A1A', border: 'none', borderRadius: 8, padding: 10, fontSize: 13, fontWeight: 600, color: vacSeleccionadas.some(vs => vs.prod_id) ? '#0A1A0A' : C.muted, cursor: 'pointer', fontFamily: C.sans }}>
                                    {vac.guardando ? 'Guardando...' : '✓ Confirmar vacunación'}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {dias >= 10 && (
                    <button onClick={async () => {
                      await supabase.from('corrales').update({ rol: 'acumulacion' }).eq('id', c.id)
                      await supabase.from('movimientos').insert({ fecha: new Date().toISOString(), tipo: 'cambio_rol', corral_destino_id: c.id, cantidad: c.animales, motivo: 'Fin cuarentena — pase a acumulacion', registrado_por: usuario?.id })
                      onDone()
                    }} style={{ width: '100%', padding: 10, background: '#1A3D26', border: `1px solid ${C.green}`, borderRadius: 8, color: C.green, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: C.sans }}>
                      ✓ Confirmar pasaje a acumulacion
                    </button>
                  )}
                </div>
              )
            })}
            {alertas.map(a => {
              const isProtocolo = a.tipo === 'protocolo_ingreso'
              const loteAlerta = isProtocolo ? (lotes || []).find(l => l.corral_cuarentena_id === a.corral_id) : null
              const vac = loteAlerta ? (vacunacionMovil[loteAlerta.id] || {}) : {}
              const vacunas = stockSanitario.filter(p => p.tipo === 'Vacuna')
              const vacSeleccionadas = vac.vacunas || [{ prod_id: '', dosis: '5' }]
              const expandido = vacunacionMovil[`exp_${a.id}`]
              return (
                <div key={a.id} style={{ background: confirmados[a.id] ? '#1A3D26' : isProtocolo ? '#3D2A00' : '#3D2A00', border: `1px solid ${confirmados[a.id] ? C.green : C.amber}`, borderRadius: 12, padding: '1rem', marginBottom: '.65rem' }}>
                  {confirmados[a.id] ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontSize: 20 }}>✅</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.green }}>Confirmado</div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '.65rem' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.amber, marginBottom: 3 }}>{a.titulo}</div>
                          <div style={{ fontSize: 12, color: C.muted }}>{a.descripcion}</div>
                          {a.fecha_vence && <div style={{ fontSize: 11, color: C.amber, marginTop: 3 }}>Vence: {new Date(a.fecha_vence).toLocaleDateString('es-AR')}</div>}
                        </div>
                        {isProtocolo && (
                          <button onClick={() => setVacunacionMovil(prev => ({...prev, [`exp_${a.id}`]: !prev[`exp_${a.id}`]}))}
                            style={{ marginLeft: 10, padding: '6px 12px', fontSize: 12, background: expandido ? '#2A1A00' : C.amber, border: `1px solid ${C.amber}`, borderRadius: 7, color: expandido ? C.amber : '#0A1A0A', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                            {expandido ? '▲ Cerrar' : '💉 Vacunar'}
                          </button>
                        )}
                      </div>

                      {isProtocolo && expandido && loteAlerta && (
                        <div style={{ borderTop: `1px solid ${C.amber}`, paddingTop: '1rem' }}>
                          {vacunas.length === 0 ? (
                            <div style={{ fontSize: 12, color: C.amber }}>⚠ No hay vacunas en stock.</div>
                          ) : (
                            <>
                              {vacSeleccionadas.map((vs, vi) => {
                                const mlTotal = vs.prod_id && vs.dosis ? Math.round(loteAlerta.cantidad * parseFloat(vs.dosis || 5)) : null
                                const prodSel = vacunas.find(p => String(p.id) === String(vs.prod_id))
                                return (
                                  <div key={vi} style={{ marginBottom: 10 }}>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>
                                      {vi === 0 ? 'Vacuna' : `Vacuna ${vi + 1}`}
                                    </div>
                                    <select value={vs.prod_id || ''}
                                      onChange={e => {
                                        const nuevas = vacSeleccionadas.map((x, i) => i === vi ? {...x, prod_id: e.target.value} : x)
                                        setVacunacionMovil(prev => ({...prev, [loteAlerta.id]: {...(prev[loteAlerta.id]||{}), vacunas: nuevas}}))
                                      }}
                                      style={{ width: '100%', background: C.surface, border: `1px solid ${C.amber}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: C.text, fontFamily: C.sans, marginBottom: 6 }}>
                                      <option value="">— Seleccioná —</option>
                                      {vacunas.map(p => (
                                        <option key={p.id} value={p.id}>{p.producto} · {(p.cantidad_ml || 0).toLocaleString('es-AR')} {p.unidad || 'ml'}</option>
                                      ))}
                                    </select>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                      <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>ml/animal</div>
                                        <input type="number" inputMode="decimal" value={vs.dosis || '5'} step="0.5" min="0"
                                          onChange={e => {
                                            const nuevas = vacSeleccionadas.map((x, i) => i === vi ? {...x, dosis: e.target.value} : x)
                                            setVacunacionMovil(prev => ({...prev, [loteAlerta.id]: {...(prev[loteAlerta.id]||{}), vacunas: nuevas}}))
                                          }}
                                          style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 16, fontFamily: C.mono, fontWeight: 600, color: C.amber, boxSizing: 'border-box' }} />
                                      </div>
                                      {vacSeleccionadas.length > 1 && (
                                        <button onClick={() => {
                                          const nuevas = vacSeleccionadas.filter((_, i) => i !== vi)
                                          setVacunacionMovil(prev => ({...prev, [loteAlerta.id]: {...(prev[loteAlerta.id]||{}), vacunas: nuevas}}))
                                        }} style={{ padding: '10px 12px', fontSize: 13, background: '#2E1A1A', border: `1px solid ${C.red}`, color: C.red, borderRadius: 8, cursor: 'pointer', marginTop: 20 }}>✕</button>
                                      )}
                                    </div>
                                    {mlTotal && <div style={{ fontSize: 12, color: C.green, marginTop: 4 }}>→ {mlTotal.toLocaleString('es-AR')} ml de {prodSel?.producto}</div>}
                                  </div>
                                )
                              })}
                              <button onClick={() => {
                                const nuevas = [...vacSeleccionadas, { prod_id: '', dosis: '5' }]
                                setVacunacionMovil(prev => ({...prev, [loteAlerta.id]: {...(prev[loteAlerta.id]||{}), vacunas: nuevas}}))
                              }} style={{ width: '100%', background: 'transparent', border: `1px solid ${C.green}`, borderRadius: 8, padding: '10px', fontSize: 13, color: C.green, fontWeight: 600, marginBottom: 10, cursor: 'pointer' }}>
                                + Agregar otra vacuna
                              </button>
                              <button disabled={!vacSeleccionadas.some(vs => vs.prod_id) || vac.guardando}
                                onClick={async () => {
                                  const validas = vacSeleccionadas.filter(vs => vs.prod_id)
                                  if (validas.length === 0) return
                                  setVacunacionMovil(prev => ({...prev, [loteAlerta.id]: {...prev[loteAlerta.id], guardando: true}}))
                                  for (const vs of validas) {
                                    const dosis = parseFloat(vs.dosis || 5)
                                    const mlDesc = Math.round(loteAlerta.cantidad * dosis)
                                    const prod = vacunas.find(p => String(p.id) === String(vs.prod_id))
                                    if (!prod) continue
                                    const nuevaCant = Math.max(0, (prod.cantidad_ml || 0) - mlDesc)
                                    await supabase.from('stock_sanitario').update({ cantidad_ml: nuevaCant, actualizado_en: new Date().toISOString() }).eq('id', prod.id)
                                    await supabase.from('eventos_sanitarios').insert({
                                      tipo: 'vacunacion', corral_id: loteAlerta.corral_cuarentena_id,
                                      producto: prod.producto, cantidad_ml: mlDesc,
                                      cantidad_animales: loteAlerta.cantidad,
                                      observaciones: `Ingreso ${loteAlerta.codigo} — ${dosis} ml/animal`,
                                      registrado_por: usuario?.id,
                                    })
                                  }
                                  await supabase.from('alertas').update({ resuelta: true, resuelta_en: new Date().toISOString() }).eq('id', a.id)
                                  setVacunacionMovil(prev => ({...prev, [loteAlerta.id]: {...prev[loteAlerta.id], guardando: false}}))
                                  await onDone()
                                }}
                                style={{ width: '100%', background: vacSeleccionadas.some(vs => vs.prod_id) ? C.green : '#1A1A1A', border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 600, color: vacSeleccionadas.some(vs => vs.prod_id) ? '#0A1A0A' : C.muted, cursor: 'pointer', fontFamily: C.sans }}>
                                {vac.guardando ? 'Guardando...' : '✓ Confirmar vacunación'}
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      {!isProtocolo && (
                        <button onClick={() => confirmarAlerta(a.id)}
                          style={{ width: '100%', padding: 10, background: '#2A1A00', border: `1px solid ${C.amber}`, borderRadius: 8, color: C.amber, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: C.sans }}>
                          Confirmar resolucion
                        </button>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </>
        )}


        {pantSan === 'revision' && (
          <>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: '1rem', lineHeight: 1.6 }}>
              Recorre cada corral. Sin novedades si esta todo bien. Hay novedad si encontras algun animal con problema.
            </div>
            {revState.map((c, i) => (
              <div key={c.id} style={{ border: `1px solid ${c.ok === true ? C.green : c.ok === false ? C.amber : C.border}`, borderRadius: 12, marginBottom: '.65rem', overflow: 'hidden' }}>
                <div style={{ padding: '1rem', background: c.ok === true ? '#1A3D26' : c.ok === false ? '#3D2A00' : C.surface, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Corral {c.numero}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{c.rol} - {c.animales} animales</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {c.ok === true && <span style={{ fontSize: 12, fontWeight: 600, color: C.green }}>Sin novedades ✓</span>}
                    {c.ok === false && <span style={{ fontSize: 12, fontWeight: 600, color: C.amber }}>{c.enfermos.length} con novedad</span>}
                    {c.ok === null && (
                      <>
                        <button onClick={() => { const n = [...revState]; n[i] = {...n[i], ok: true, enfermos: []}; setRevState(n) }}
                          style={{ padding: '7px 10px', background: '#1A3D26', border: `1px solid ${C.green}`, borderRadius: 7, color: C.green, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: C.sans }}>Sin novedades ✓</button>
                        <button onClick={() => { const n = [...revState]; n[i] = {...n[i], ok: false, enfermos: [{desc:'',diag:'Conjuntivitis',prod:'',prod_id:null,ml:'',mover_enfermeria:false}]}; setRevState(n) }}
                          style={{ padding: '7px 10px', background: '#3D2A00', border: `1px solid ${C.amber}`, borderRadius: 7, color: C.amber, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: C.sans }}>Hay novedad</button>
                      </>
                    )}
                    {c.ok !== null && (
                      <button onClick={() => { const n = [...revState]; n[i] = {...n[i], ok: null, enfermos: []}; setRevState(n) }}
                        style={{ padding: '5px 8px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 6, color: C.muted, fontSize: 11, cursor: 'pointer', fontFamily: C.sans }}>Cambiar</button>
                    )}
                  </div>
                </div>
                {c.ok === false && (
                  <div style={{ padding: '1rem', borderTop: `1px solid ${C.border}`, background: C.surface2 }}>
                    {c.enfermos.map((enf, ei) => (
                      <div key={ei} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '.75rem', marginBottom: '.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: C.amber }}>Animal {ei + 1}</span>
                          <button onClick={() => {
                            const n = [...revState]; n[i].enfermos.splice(ei, 1)
                            if (!n[i].enfermos.length) n[i].ok = null
                            setRevState(n)
                          }} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 16 }}>✕</button>
                        </div>
                        <input type="text" placeholder="Descripcion del animal" value={enf.desc}
                          onChange={e => { const n = [...revState]; n[i].enfermos[ei].desc = e.target.value; setRevState(n) }}
                          style={{ width: '100%', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, color: C.text, fontFamily: C.sans, boxSizing: 'border-box', marginBottom: 6 }} />
                        <select value={enf.diag} onChange={e => { const n = [...revState]; n[i].enfermos[ei].diag = e.target.value; setRevState(n) }}
                          style={{ width: '100%', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, color: C.text, fontFamily: C.sans, marginBottom: 6 }}>
                          {['Conjuntivitis','Pietin','Neumonia','Timpanismo','Diarrea','Artritis','Otro'].map(d => <option key={d}>{d}</option>)}
                        </select>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <select value={enf.prod} onChange={e => { 
                          const prod = stockSanitario.find(p => p.producto === e.target.value)
                          const n = [...revState]
                          n[i].enfermos[ei].prod = e.target.value
                          n[i].enfermos[ei].prod_id = prod?.id || null
                          setRevState(n) 
                        }}
                          style={{ width: '100%', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, color: C.text, fontFamily: C.sans }}>
                          <option value="">— Producto aplicado —</option>
                          {stockSanitario.map(p => <option key={p.id} value={p.producto}>{p.producto} ({(p.cantidad_ml||0).toLocaleString('es-AR')} {p.unidad||'ml'})</option>)}
                        </select>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input type="number" value={enf.ml || ''} placeholder="ml" onChange={e => { const n=[...revState]; n[i].enfermos[ei].ml=e.target.value; setRevState(n) }}
                            style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 8px', fontSize: 12, background: C.surface, color: C.text }} />
                          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#EF4444', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                            <input type="checkbox" checked={enf.mover_enfermeria || false} onChange={e => { const n=[...revState]; n[i].enfermos[ei].mover_enfermeria=e.target.checked; setRevState(n) }} />
                            → Enf.
                          </label>
                        </div>
                        </div>
                      </div>
                    ))}
                    <button onClick={() => { const n = [...revState]; n[i].enfermos.push({desc:'',diag:'Conjuntivitis',prod:'',prod_id:null,ml:'',mover_enfermeria:false}); setRevState(n) }}
                      style={{ width: '100%', padding: '8px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, fontSize: 12, cursor: 'pointer', fontFamily: C.sans, marginTop: 4 }}>
                      + Agregar otro animal
                    </button>
                  </div>
                )}
              </div>
            ))}
            <button onClick={confirmarRevision} disabled={guardando}
              style={{ width: '100%', background: C.green, border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 600, color: '#0A1A0A', cursor: 'pointer', fontFamily: C.sans, marginBottom: 8 }}>
              {guardando ? 'Guardando...' : 'Confirmar revision completa'}
            </button>
          </>
        )}
        {pantSan === 'evento' && (
          <>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: '1rem', lineHeight: 1.6 }}>
              Registra un evento sanitario puntual — vacunacion, tratamiento, etc.
            </div>
            <div style={{ marginBottom: '.85rem' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>Corral</div>
              <select value={formEvento.corral_id} onChange={e => setFormEvento({...formEvento, corral_id: e.target.value})}
                style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: C.text, fontFamily: C.sans }}>
                <option value="">Selecciona un corral</option>
                {corralesActivos.map(c => <option key={c.id} value={c.id}>Corral {c.numero} - {c.rol} - {c.animales || 0} anim.</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '.85rem' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>Producto</div>
              {stockSanitario.length === 0
                ? <div style={{ padding: '11px 12px', background: C.surface2, borderRadius: 8, fontSize: 13, color: C.muted }}>No hay productos en stock sanitario.</div>
                : <select value={formEvento.prod_id}
                    onChange={e => {
                      const prod = stockSanitario.find(p => String(p.id) === e.target.value)
                      setFormEvento({...formEvento, prod_id: e.target.value, producto: prod?.producto || ''})
                    }}
                    style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: C.text, fontFamily: C.sans }}>
                    <option value="">— Seleccioná un producto —</option>
                    {stockSanitario.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.producto} · {(p.cantidad_ml || 0).toLocaleString('es-AR')} {p.unidad || 'ml'} en stock
                      </option>
                    ))}
                  </select>
              }
            </div>
            <div style={{ marginBottom: '.85rem' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>Dosis ml/animal</div>
              <input type="number" inputMode="decimal" placeholder="5" value={formEvento.dosis_ml}
                onChange={e => setFormEvento({...formEvento, dosis_ml: e.target.value})}
                style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 16, fontFamily: C.mono, fontWeight: 600, color: C.amber, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '.85rem' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>Cantidad de animales</div>
              <input type="number" inputMode="numeric" placeholder="0" value={formEvento.cantidad}
                onChange={e => setFormEvento({...formEvento, cantidad: e.target.value})}
                style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 16, fontFamily: C.mono, fontWeight: 600, color: C.green, boxSizing: 'border-box' }} />
            </div>
            {/* Preview ml totales */}
            {formEvento.prod_id && formEvento.dosis_ml && formEvento.cantidad && (() => {
              const mlTotal = Math.round(parseInt(formEvento.cantidad) * parseFloat(formEvento.dosis_ml))
              const prod = stockSanitario.find(p => String(p.id) === String(formEvento.prod_id))
              const stockActual = prod?.cantidad_ml || 0
              const alcanza = stockActual >= mlTotal
              return (
                <div style={{ background: alcanza ? '#1A2E1A' : '#2E1A1A', border: `1px solid ${alcanza ? C.green : C.red}`, borderRadius: 8, padding: '10px 12px', marginBottom: '.85rem' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: alcanza ? C.green : C.red }}>
                    {mlTotal.toLocaleString('es-AR')} ml totales ({formEvento.cantidad} animales × {formEvento.dosis_ml} ml)
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                    Stock actual: {stockActual.toLocaleString('es-AR')} ml · {alcanza ? `Quedan ${(stockActual - mlTotal).toLocaleString('es-AR')} ml` : `⚠ Faltan ${(mlTotal - stockActual).toLocaleString('es-AR')} ml`}
                  </div>
                </div>
              )
            })()}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>Observaciones</div>
              <input type="text" placeholder="descripcion, diagnostico, etc." value={formEvento.observaciones}
                onChange={e => setFormEvento({...formEvento, observaciones: e.target.value})}
                style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: C.text, fontFamily: C.sans, boxSizing: 'border-box' }} />
            </div>
            <button onClick={registrarEvento} disabled={guardando}
              style={{ width: '100%', background: C.green, border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 600, color: '#0A1A0A', cursor: 'pointer', fontFamily: C.sans, marginBottom: 8 }}>
              {guardando ? 'Guardando...' : 'Registrar evento'}
            </button>
            <button onClick={() => setPantSan('alertas')}
              style={{ width: '100%', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, fontSize: 14, color: C.muted, cursor: 'pointer', fontFamily: C.sans }}>
              Cancelar
            </button>
          </>
        )}

        {pantSan === 'mortalidad' && (
          <MortalidadMovil corrales={corrales} usuario={usuario} onDone={onDone} nav={nav} />
        )}

        {pantSan === 'stock' && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Stock sanitario</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: '1rem' }}>Solo lectura — los ingresos se registran desde la PC en Insumos.</div>
            {stockSanitario.length === 0 && (
              <div style={{ padding: '2rem', textAlign: 'center', color: C.muted, fontSize: 13 }}>No hay productos cargados.</div>
            )}
            {stockSanitario.map(p => {
              const cant = p.cantidad_ml || p.cantidad_kg || 0
              const bajo = cant < 50
              return (
                <div key={p.id} style={{ background: C.surface, border: `1px solid ${bajo ? C.red : C.border}`, borderRadius: 10, padding: '1rem', marginBottom: '.65rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{p.producto}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{p.tipo || '—'}{p.laboratorio ? ` · ${p.laboratorio}` : ''}</div>
                      {p.carencia_dias > 0 && <div style={{ fontSize: 11, color: C.amber, marginTop: 2 }}>⚠ Carencia: {p.carencia_dias} días</div>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: C.mono, color: bajo ? C.red : C.green }}>
                        {cant.toLocaleString('es-AR')}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted }}>{p.unidad || 'ml'}</div>
                      {bajo && <div style={{ fontSize: 11, color: C.red, fontWeight: 600 }}>⚠ Stock bajo</div>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Scroll>
    </div>
  )
}

function MortalidadMovil({ corrales, usuario, onDone, nav }) {
  const [form, setForm] = useState({ fecha: new Date().toISOString().split('T')[0], corral_id: '', cantidad: '1', causa: '' })
  const [guardando, setGuardando] = useState(false)
  const CAUSAS = ['Neumonia', 'Enterotoxemia', 'Accidente', 'Timpanismo', 'Diarrea', 'Causa desconocida', 'Otro']
  const corralesConAnim = corrales.filter(c => (c.animales || 0) > 0 && c.rol !== 'deshabilitado')

  async function guardar() {
    if (!form.corral_id) { alert('Selecciona un corral'); return }
    setGuardando(true)
    const cant = parseInt(form.cantidad) || 1
    await supabase.from('mortalidad').insert({ fecha: form.fecha, corral_id: parseInt(form.corral_id), cantidad: cant, causa: form.causa || null, registrado_por: usuario?.id })
    const { data: corral } = await supabase.from('corrales').select('animales').eq('id', form.corral_id).single()
    const nuevos = Math.max(0, (corral?.animales || 0) - cant)
    const update = { animales: nuevos }
    if (nuevos === 0) { update.rol = 'libre'; update.sub = null }
    await supabase.from('corrales').update(update).eq('id', parseInt(form.corral_id))
    onDone()
    alert('Muerte registrada.')
    nav('home')
    setGuardando(false)
  }

  return (
    <>
      <div style={{ background: '#3D1A1A', border: '1px solid #F09595', borderRadius: 12, padding: '1rem', marginBottom: '.85rem', fontSize: 12, color: '#F09595', lineHeight: 1.6 }}>
        Registra la muerte de un animal. Se descuenta del corral automaticamente.
      </div>
      <div style={{ marginBottom: '.85rem' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>Fecha</div>
        <input type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})}
          style={{ width: '100%', background: C.surface, border: '1px solid ' + C.border, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: C.text, fontFamily: C.sans, boxSizing: 'border-box' }} />
      </div>
      <div style={{ marginBottom: '.85rem' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>Corral</div>
        <select value={form.corral_id} onChange={e => setForm({...form, corral_id: e.target.value})}
          style={{ width: '100%', background: C.surface, border: '1px solid ' + C.border, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: C.text, fontFamily: C.sans }}>
          <option value="">Selecciona un corral</option>
          {corralesConAnim.map(c => <option key={c.id} value={c.id}>C-{c.numero} - {c.animales} anim.</option>)}
        </select>
      </div>
      <div style={{ marginBottom: '.85rem' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>Cantidad</div>
        <input type="number" inputMode="numeric" value={form.cantidad} onChange={e => setForm({...form, cantidad: e.target.value})} min="1"
          style={{ width: '100%', background: C.surface, border: '1px solid ' + C.border, borderRadius: 8, padding: '11px 12px', fontSize: 16, fontFamily: C.mono, fontWeight: 600, color: '#F09595', boxSizing: 'border-box' }} />
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>Causa</div>
        <select value={form.causa} onChange={e => setForm({...form, causa: e.target.value})}
          style={{ width: '100%', background: C.surface, border: '1px solid ' + C.border, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: C.text, fontFamily: C.sans }}>
          <option value="">Sin especificar</option>
          {CAUSAS.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      <button onClick={guardar} disabled={guardando}
        style={{ width: '100%', background: '#7A1A1A', border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: C.sans, marginBottom: 8 }}>
        {guardando ? 'Registrando...' : 'Registrar muerte'}
      </button>
      <button onClick={() => nav('home')}
        style={{ width: '100%', background: 'transparent', border: '1px solid ' + C.border, borderRadius: 10, padding: 12, fontSize: 14, color: C.muted, cursor: 'pointer', fontFamily: C.sans }}>
        Cancelar
      </button>
    </>
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

    // Si es ingreso, registrar en ingresos_stock sin precio para que secretaria/dueño completen después
    if (tipo === 'agregar') {
      await supabase.from('ingresos_stock').insert({
        insumo_id: id,
        insumo_nombre: item.insumo,
        cantidad_kg: parseFloat(cantidad),
        registrado_por: usuario?.nombre || usuario?.email || 'empleado',
      })
    }

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
  const [paso, setPaso] = useState(1)
  const [form, setForm] = useState({ A: '', B: '', C: '', D: '', E: '', F: '', G: '', menores: '' })
  const [corralLibre1, setCorralLibre1] = useState('')
  const [corralLibre2, setCorralLibre2] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [fechaPesada, setFechaPesada] = useState(new Date().toISOString().split('T')[0])

  const ORDEN_RANGOS = ['A','B','C','D','E','F','G']

  function subirRango(letra, n = 2) {
    const idx = ORDEN_RANGOS.indexOf(letra)
    if (idx === -1) return letra
    return ORDEN_RANGOS[Math.min(idx + n, ORDEN_RANGOS.length - 1)]
  }

  const RANGOS_CONFIG = [
    { key: 'A', label: 'Rango A', rango: '200–230 kg', color: '#1A3D26', border: '#7BC67A', text: '#7EC87E' },
    { key: 'B', label: 'Rango B', rango: '231–260 kg', color: '#0F2040', border: '#7EB8F7', text: '#7EB8F7' },
    { key: 'C', label: 'Rango C', rango: '261–290 kg', color: '#2A1A40', border: '#B09ED4', text: '#B09ED4' },
    { key: 'D', label: 'Rango D', rango: '291–320 kg', color: '#3D2A00', border: '#F5C97A', text: '#F5C97A' },
    { key: 'E', label: 'Rango E', rango: '321–350 kg', color: '#3D1500', border: '#F5A55A', text: '#F5A55A' },
    { key: 'F', label: 'Rango F', rango: '351–380 kg', color: '#3D0A0A', border: '#F09595', text: '#F09595' },
    { key: 'G', label: 'Rango G', rango: '381+ kg',    color: '#2A2A2A', border: '#A0A0A0', text: '#C0C0C0' },
  ]

  const corralAcum = corrales.find(c => c.rol === 'acumulacion')
  const corralesLibres = corrales.filter(c => c.rol === 'libre')
  const corralesClasificados = corrales.filter(c => c.rol === 'clasificado')

  const totalClasif = ORDEN_RANGOS.reduce((s, k) => s + (parseInt(form[k]) || 0), 0)
  const menores = parseInt(form.menores) || 0
  const totalPesados = totalClasif + menores

  async function agregarRolloHoy() {
    setGuardandoRollo(true)
    const ahora = new Date()
    const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth()+1).padStart(2,'0')}-${String(ahora.getDate()).padStart(2,'0')}`
    const corralesRollo = corralesAlim.filter(c => (kgsRolloExtra[c.id] || 0) > 0)
    const { data: stockItemsFresh } = await supabase.from('stock_insumos').select('*')
    let kgRolloTotal = 0
    for (const c of corralesRollo) {
      const kg = parseInt(kgsRolloExtra[c.id]) || 0
      if (!kg) continue
      kgRolloTotal += kg
      // Actualizar o insertar ración de rollo extra para este corral
      const { data: racionExist } = await supabase.from('raciones_app').select('id, kg_total').eq('fecha', hoy).eq('corral_id', c.id).single()
      if (racionExist) {
        await supabase.from('raciones_app').update({ kg_total: (racionExist.kg_total || 0) + kg }).eq('id', racionExist.id)
      } else {
        await supabase.from('raciones_app').insert({ corral_id: c.id, fecha: hoy, kg_total: kg, mezclador: 'Acostumbramiento', solo_rollo: true, tipo_dieta: dieta })
      }
    }
    // Descontar rollo del stock
    if (kgRolloTotal > 0 && stockItemsFresh) {
      const rolloItem = stockItemsFresh.find(s => s.insumo === 'Rollo (heno)') || stockItemsFresh.find(s => s.insumo.toLowerCase().includes('rollo'))
      if (rolloItem) {
        const nuevaCant = Math.max(0, (rolloItem.cantidad_kg || 0) - kgRolloTotal)
        await supabase.from('stock_insumos').update({ cantidad_kg: nuevaCant, actualizado_en: new Date().toISOString() }).eq('id', rolloItem.id)
      }
    }
    setKgsRolloExtra({})
    setMostrarAgregarRollo(false)
    setGuardandoRollo(false)
    alert(`Rollo extra registrado: ${kgRolloTotal} kg`)
  }

  async function confirmar() {
    if (!corralLibre1 || !corralLibre2) { alert('Seleccioná dos corrales libres para A y B'); return }
    if (corralLibre1 === corralLibre2) { alert('Los corrales para A y B deben ser diferentes'); return }
    if (totalClasif === 0) { alert('Ingresá al menos un animal clasificado'); return }
    setGuardando(true)

    // 1. Registrar pesada
    const { data: pesada, error } = await supabase.from('pesadas').insert({
      corral_id: corralAcum?.id || null,
      tipo: 'clasificacion',
      registrado_por: usuario?.id,
      fecha: fechaPesada,
    }).select().single()

    if (error || !pesada) { alert('Error al guardar.'); setGuardando(false); return }

    // 2. Insertar pesada_animales
    const animalesInsert = []
    ORDEN_RANGOS.forEach(rango => {
      const cant = parseInt(form[rango]) || 0
      if (cant > 0) animalesInsert.push({ pesada_id: pesada.id, rango, cantidad: cant })
    })
    if (menores > 0) animalesInsert.push({ pesada_id: pesada.id, rango: 'menores', cantidad: menores })
    if (animalesInsert.length > 0) await supabase.from('pesada_animales').insert(animalesInsert)

    // 3. Snapshot rangos actuales ANTES de modificar
    const mapaRangoCorral = {}
    corralesClasificados.forEach(c => {
      const letra = c.sub && c.sub.length === 1 ? c.sub : c.sub?.charAt(0)
      if (letra) mapaRangoCorral[letra] = { ...c, sub: letra }
    })

    // 4. Registrar movimientos
    const movimientos = []
    if (corralAcum) movimientos.push({ pesada_id: pesada.id, corral_id: corralAcum.id, tipo: 'origen_acum', animales: totalClasif, rango_antes: null, rango_despues: null })
    corralesClasificados.forEach(c => {
      const letraAntes = c.sub && c.sub.length === 1 ? c.sub : c.sub?.charAt(0) || 'A'
      movimientos.push({ pesada_id: pesada.id, corral_id: c.id, tipo: 'subida_rango', animales: c.animales || 0, rango_antes: letraAntes, rango_despues: subirRango(letraAntes, 2) })
    })
    const cantA = parseInt(form.A) || 0
    const cantB = parseInt(form.B) || 0
    if (cantA > 0) movimientos.push({ pesada_id: pesada.id, corral_id: parseInt(corralLibre1), tipo: 'nuevo_clasificado', animales: cantA, rango_antes: 'libre', rango_despues: 'A' })
    if (cantB > 0) movimientos.push({ pesada_id: pesada.id, corral_id: parseInt(corralLibre2), tipo: 'nuevo_clasificado', animales: cantB, rango_antes: 'libre', rango_despues: 'B' })
    const mapeoDestino = { C: 'A', D: 'B', E: 'C', F: 'D', G: 'E' }
    Object.entries(mapeoDestino).forEach(([letraNueva, letraAnterior]) => {
      const cant = parseInt(form[letraNueva]) || 0
      if (cant === 0) return
      const corralDest = mapaRangoCorral[letraAnterior]
      if (corralDest) movimientos.push({ pesada_id: pesada.id, corral_id: corralDest.id, tipo: 'suma_existente', animales: cant, rango_antes: letraAnterior, rango_despues: letraNueva })
    })
    if (movimientos.length > 0) await supabase.from('pesada_movimientos').insert(movimientos)

    // 5. Subir 2 rangos a corrales clasificados
    for (const c of corralesClasificados) {
      const letraActual = c.sub && c.sub.length === 1 ? c.sub : c.sub?.charAt(0) || 'A'
      await supabase.from('corrales').update({ sub: subirRango(letraActual, 2) }).eq('id', c.id)
    }

    // 6. Asignar corrales libres para A y B
    if (cantA > 0) await supabase.from('corrales').update({ rol: 'clasificado', sub: 'A', animales: cantA }).eq('id', parseInt(corralLibre1))
    if (cantB > 0) await supabase.from('corrales').update({ rol: 'clasificado', sub: 'B', animales: cantB }).eq('id', parseInt(corralLibre2))

    // 7. Sumar C-G a corrales existentes
    for (const [letraNueva, letraAnterior] of Object.entries(mapeoDestino)) {
      const cant = parseInt(form[letraNueva]) || 0
      if (cant === 0) continue
      const corralDest = mapaRangoCorral[letraAnterior]
      if (!corralDest) continue
      const { data: corralFresh } = await supabase.from('corrales').select('animales').eq('id', corralDest.id).single()
      await supabase.from('corrales').update({ animales: (corralFresh?.animales || 0) + cant }).eq('id', corralDest.id)
    }

    // 8. Descontar de acumulación
    if (corralAcum) {
      const { data: acumActual } = await supabase.from('corrales').select('animales').eq('id', corralAcum.id).single()
      await supabase.from('corrales').update({ animales: Math.max(0, (acumActual?.animales || 0) - totalClasif) }).eq('id', corralAcum.id)
    }

    // 9. Actualizar próxima pesada +40 días
    const nuevaProxima = new Date()
    nuevaProxima.setDate(nuevaProxima.getDate() + 40)
    await supabase.from('configuracion').update({ valor: nuevaProxima.toISOString().split('T')[0] }).eq('clave', 'proxima_pesada')

    onDone()
    alert(`Pesada confirmada. ${totalPesados} animales procesados.`)
    nav('home')
    setGuardando(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Topbar titulo="Pesada" sub={`Acumulación · ${corralAcum ? corralAcum.animales + ' animales' : '—'}`} onBack={() => nav('home')} />

      {/* Stepper */}
      <div style={{ display: 'flex', background: C.surface, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        {[['1','Rangos'],['2','Corrales']].map(([n, l]) => (
          <button key={n} onClick={() => { if (n === '2' && totalClasif === 0) return; setPaso(parseInt(n)) }}
            style={{ flex: 1, padding: '10px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: C.sans, background: paso === parseInt(n) ? C.green : 'transparent', color: paso === parseInt(n) ? '#0A1A0A' : C.muted, borderBottom: paso === parseInt(n) ? `2px solid ${C.green}` : '2px solid transparent' }}>
            {n}. {l}
          </button>
        ))}
      </div>

      <Scroll>
        {/* PASO 1: RANGOS */}
        {paso === 1 && (
          <>
            <div style={{ background: '#0F2040', border: `1px solid ${C.blue}`, borderRadius: 10, padding: '.75rem', marginBottom: '.65rem', fontSize: 12, color: C.blue, lineHeight: 1.5 }}>
              Ingresá cuántos animales cayeron en cada rango. A y B van a corrales nuevos (libres). C en adelante se suman a los corrales existentes.
            </div>

            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '.85rem', marginBottom: '.65rem' }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', marginBottom: 6 }}>Fecha de la pesada</div>
              <input type="date" value={fechaPesada} onChange={e => setFechaPesada(e.target.value)}
                style={{ width: '100%', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', fontSize: 14, color: C.text, fontFamily: C.sans, boxSizing: 'border-box' }} />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Podés atrasar la fecha si la pesada correspondía a un día anterior.</div>
            </div>

            {RANGOS_CONFIG.map(r => (
              <div key={r.key} style={{ background: r.color, border: `1px solid ${r.border}`, borderRadius: 10, padding: '.85rem', marginBottom: '.65rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: r.text, textTransform: 'uppercase' }}>{r.label}</div>
                    <div style={{ fontSize: 11, color: r.text, opacity: 0.7 }}>{r.rango}</div>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: C.mono, color: r.text }}>{parseInt(form[r.key]) || 0}</div>
                </div>
                <input type="number" inputMode="numeric" placeholder="0" value={form[r.key]}
                  onChange={e => setForm({...form, [r.key]: e.target.value})}
                  style={{ width: '100%', background: 'rgba(0,0,0,.2)', border: `1px solid ${r.border}`, borderRadius: 6, padding: '10px 12px', fontSize: 18, fontFamily: C.mono, fontWeight: 700, color: r.text, boxSizing: 'border-box' }} />
              </div>
            ))}

            <div style={{ background: '#3D0A0A', border: `1px solid ${C.red}`, borderRadius: 10, padding: '.85rem', marginBottom: '.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.red, textTransform: 'uppercase' }}>Menores de 200 kg</div>
                  <div style={{ fontSize: 11, color: C.red, opacity: 0.7 }}>Vuelven a acumulación</div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: C.mono, color: C.red }}>{menores}</div>
              </div>
              <input type="number" inputMode="numeric" placeholder="0" value={form.menores}
                onChange={e => setForm({...form, menores: e.target.value})}
                style={{ width: '100%', background: 'rgba(0,0,0,.2)', border: `1px solid ${C.red}`, borderRadius: 6, padding: '10px 12px', fontSize: 18, fontFamily: C.mono, fontWeight: 700, color: C.red, boxSizing: 'border-box' }} />
            </div>

            {totalPesados > 0 && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', marginBottom: '.85rem', fontSize: 13, fontFamily: C.mono }}>
                Total: <strong style={{ color: C.green }}>{totalPesados} animales</strong>
                {menores > 0 && <span style={{ color: C.red }}> · {menores} vuelven a acum.</span>}
              </div>
            )}

            <button onClick={() => { if (totalClasif === 0) { alert('Ingresá al menos un animal clasificado'); return } setPaso(2) }}
              style={{ width: '100%', background: C.green, border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 600, color: '#0A1A0A', cursor: 'pointer', fontFamily: C.sans, marginBottom: 8 }}>
              Siguiente → Asignar corrales
            </button>
            <button onClick={() => nav('home')}
              style={{ width: '100%', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, fontSize: 14, color: C.muted, cursor: 'pointer', fontFamily: C.sans }}>
              Cancelar
            </button>
          </>
        )}

        {/* PASO 2: CORRALES */}
        {paso === 2 && (
          <>
            <div style={{ background: '#1A3D26', border: `1px solid ${C.green}`, borderRadius: 10, padding: '.75rem', marginBottom: '.85rem', fontSize: 12, color: C.green, lineHeight: 1.5 }}>
              Elegí dos corrales libres para los nuevos rangos A y B. Los corrales existentes suben 2 rangos automáticamente.
            </div>

            {/* Resumen de lo que va a pasar */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '1rem', marginBottom: '.85rem' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 8 }}>Cambios en corrales existentes</div>
              {corralesClasificados.sort((a, b) => (a.sub || '').localeCompare(b.sub || '')).map(c => {
                const letraActual = c.sub && c.sub.length === 1 ? c.sub : c.sub?.charAt(0) || 'A'
                const letraNueva = subirRango(letraActual, 2)
                const mapeoDestino = { C: 'A', D: 'B', E: 'C', F: 'D', G: 'E' }
                const letraQueRecibe = Object.keys(mapeoDestino).find(k => mapeoDestino[k] === letraActual)
                const nuevosAnimales = letraQueRecibe ? (parseInt(form[letraQueRecibe]) || 0) : 0
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 6, marginBottom: 6, borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 13 }}>C-{c.numero} · Rango {letraActual} → <strong style={{ color: C.green }}>Rango {letraNueva}</strong></div>
                    <div style={{ fontSize: 12, fontFamily: C.mono, color: C.muted }}>
                      {c.animales || 0}{nuevosAnimales > 0 ? <span style={{ color: C.green }}> +{nuevosAnimales}</span> : ''} anim.
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Selección corrales libres */}
            {corralesLibres.length < 2 && (
              <div style={{ background: '#3D0A0A', border: `1px solid ${C.red}`, borderRadius: 10, padding: '.75rem', marginBottom: '.85rem', fontSize: 12, color: C.red }}>
                ⚠ No hay suficientes corrales libres. Se necesitan al menos 2.
              </div>
            )}

            <div style={{ marginBottom: '.85rem' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#7EC87E', textTransform: 'uppercase', marginBottom: 4 }}>
                Nuevo Rango A — {parseInt(form.A) || 0} animales (200–230 kg)
              </div>
              <select value={corralLibre1} onChange={e => setCorralLibre1(e.target.value)}
                style={{ width: '100%', background: '#1A3D26', border: `1px solid ${C.green}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: C.green, fontFamily: C.sans }}>
                <option value="">— Seleccioná un corral libre —</option>
                {corralesLibres.filter(c => String(c.id) !== String(corralLibre2)).map(c => (
                  <option key={c.id} value={c.id}>Corral {c.numero}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.blue, textTransform: 'uppercase', marginBottom: 4 }}>
                Nuevo Rango B — {parseInt(form.B) || 0} animales (231–260 kg)
              </div>
              <select value={corralLibre2} onChange={e => setCorralLibre2(e.target.value)}
                style={{ width: '100%', background: '#0F2040', border: `1px solid ${C.blue}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: C.blue, fontFamily: C.sans }}>
                <option value="">— Seleccioná un corral libre —</option>
                {corralesLibres.filter(c => String(c.id) !== String(corralLibre1)).map(c => (
                  <option key={c.id} value={c.id}>Corral {c.numero}</option>
                ))}
              </select>
            </div>

            {menores > 0 && (
              <div style={{ background: '#3D0A0A', border: `1px solid ${C.red}`, borderRadius: 8, padding: '10px 12px', marginBottom: '.85rem', fontSize: 13, color: C.red }}>
                {menores} animales menores de 200 kg vuelven a {corralAcum ? `C-${corralAcum.numero}` : 'acumulación'}.
              </div>
            )}

            <button onClick={confirmar} disabled={guardando || !corralLibre1 || !corralLibre2}
              style={{ width: '100%', background: corralLibre1 && corralLibre2 ? C.green : '#2A3D2A', border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 600, color: corralLibre1 && corralLibre2 ? '#0A1A0A' : C.muted, cursor: corralLibre1 && corralLibre2 ? 'pointer' : 'not-allowed', fontFamily: C.sans, marginBottom: 8 }}>
              {guardando ? 'Guardando...' : '✓ Confirmar pesada'}
            </button>
            <button onClick={() => setPaso(1)}
              style={{ width: '100%', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, fontSize: 14, color: C.muted, cursor: 'pointer', fontFamily: C.sans }}>
              ← Volver a rangos
            </button>
          </>
        )}
      </Scroll>
    </div>
  )
}

function VentaMovil({ nav, usuario, corrales, compradores, onDone }) {
  const [corralesVenta, setCorralesVenta] = useState([{ corral_id: '', cantidad: '', kg_vivo: '' }])
  const [comprador, setComprador] = useState('')
  const [compradorNuevo, setCompradorNuevo] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [guardando, setGuardando] = useState(false)

  const corralesConAnimales = corrales.filter(c => (c.animales || 0) > 0 && c.rol !== 'deshabilitado')

  const totalKgVivo = corralesVenta.reduce((s, c) => s + (parseFloat(c.kg_vivo) || 0), 0)
  const totalCant = corralesVenta.reduce((s, c) => s + (parseInt(c.cantidad) || 0), 0)
  const desbaste = totalKgVivo * 0.08
  const kg_neto = totalKgVivo - desbaste

  async function guardar() {
    const validos = corralesVenta.filter(c => c.corral_id && c.cantidad && c.kg_vivo)
    if (validos.length === 0) { alert('Completá al menos un corral con cantidad y kg'); return }
    setGuardando(true)

    const compradorFinal = comprador === 'Otro' ? (compradorNuevo || null) : (comprador || null)
    const grupoId = validos.length > 1 ? crypto.randomUUID() : null

    for (const cv of validos) {
      const kgVivoCv = parseFloat(cv.kg_vivo)
      const kgNetoCv = Math.round(kgVivoCv * 0.92 * 100) / 100
      const { error } = await supabase.from('ventas').insert({
        corral_id: parseInt(cv.corral_id),
        cantidad: parseInt(cv.cantidad),
        kg_vivo_total: kgVivoCv,
        desbaste_pct: 8,
        kg_neto: kgNetoCv,
        precio_kg: null,
        total: null,
        comprador: compradorFinal,
        observaciones: observaciones || null,
        registrado_por: usuario?.id,
        grupo_venta_id: grupoId,
      })
      if (!error) {
        const { data: corral } = await supabase.from('corrales').select('animales').eq('id', cv.corral_id).single()
        const nuevosAnimales = Math.max(0, (corral?.animales || 0) - parseInt(cv.cantidad))
        const updateCorral = { animales: nuevosAnimales }
        if (nuevosAnimales === 0) updateCorral.rol = 'libre'
        await supabase.from('corrales').update(updateCorral).eq('id', parseInt(cv.corral_id))
      }
    }
    onDone()
    alert(`${validos.length > 1 ? `${validos.length} ventas registradas` : 'Venta registrada'} correctamente.`)
    nav('home')
    setGuardando(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Topbar titulo="Carga venta" sub="Desbaste 8% · podés agregar varios corrales" onBack={() => nav('home')} />
      <Scroll>

        {/* Corrales */}
        {corralesVenta.map((cv, i) => {
          const kgVivoCv = parseFloat(cv.kg_vivo) || 0
          const kgNetoCv = Math.round(kgVivoCv * 0.92)
          return (
            <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '1rem', marginBottom: '.65rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.65rem' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.green }}>Corral {i + 1}</div>
                {corralesVenta.length > 1 && (
                  <button onClick={() => setCorralesVenta(corralesVenta.filter((_, j) => j !== i))}
                    style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 6, color: C.muted, fontSize: 11, padding: '3px 8px', cursor: 'pointer', fontFamily: C.sans }}>
                    Quitar
                  </button>
                )}
              </div>
              <div style={{ marginBottom: '.65rem' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>Corral</div>
                <select value={cv.corral_id} onChange={e => { const n = [...corralesVenta]; n[i].corral_id = e.target.value; setCorralesVenta(n) }}
                  style={{ width: '100%', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: C.text, fontFamily: C.sans }}>
                  <option value="">Seleccioná un corral</option>
                  {corralesConAnimales.map(c => <option key={c.id} value={c.id}>C-{c.numero} · {c.rol === 'clasificado' && c.sub ? `Rango ${c.sub}` : c.rol} · {c.animales} anim.</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: kgVivoCv > 0 ? '.65rem' : 0 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>Cantidad</div>
                  <input type="number" inputMode="numeric" placeholder="ej. 20" value={cv.cantidad}
                    onChange={e => { const n = [...corralesVenta]; n[i].cantidad = e.target.value; setCorralesVenta(n) }}
                    style={{ width: '100%', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 16, fontFamily: C.mono, fontWeight: 600, color: C.green, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>Kg vivo (báscula)</div>
                  <input type="number" inputMode="numeric" placeholder="ej. 8000" value={cv.kg_vivo}
                    onChange={e => { const n = [...corralesVenta]; n[i].kg_vivo = e.target.value; setCorralesVenta(n) }}
                    style={{ width: '100%', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 16, fontFamily: C.mono, fontWeight: 600, color: C.green, boxSizing: 'border-box' }} />
                </div>
              </div>
              {kgVivoCv > 0 && (
                <div style={{ fontSize: 12, fontFamily: C.mono, color: C.blue }}>
                  Peso prom: <strong>{Math.round(kgVivoCv / (parseInt(cv.cantidad) || 1)).toLocaleString('es-AR')} kg/cabeza</strong>
                </div>
              )}
            </div>
          )
        })}

        <button onClick={() => setCorralesVenta([...corralesVenta, { corral_id: '', cantidad: '', kg_vivo: '' }])}
          style={{ width: '100%', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, fontSize: 13, color: C.muted, cursor: 'pointer', fontFamily: C.sans, marginBottom: '.85rem' }}>
          + Agregar otro corral
        </button>

        {/* Resumen total */}
        {totalKgVivo > 0 && (
          <div style={{ background: '#0F2040', border: `1px solid ${C.blue}`, borderRadius: 12, padding: '1rem', marginBottom: '.85rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.blue, textTransform: 'uppercase', marginBottom: 10 }}>Resumen total</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              {[
                { label: 'KG vivo total', value: totalKgVivo.toLocaleString('es-AR') + ' kg' },
                { label: 'Total animales', value: totalCant + ' cab.' },
                { label: 'Peso prom. bruto', value: totalCant > 0 ? Math.round(totalKgVivo / totalCant).toLocaleString('es-AR') + ' kg' : '—' },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: C.mono, color: C.blue }}>{s.value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: C.muted }}>{corralesVenta.filter(c => c.corral_id).length} corrales</div>
          </div>
        )}

        {/* Comprador */}
        <div style={{ marginBottom: '.85rem' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>Comprador</div>
          <select value={comprador} onChange={e => { setComprador(e.target.value); setCompradorNuevo('') }}
            style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: C.text, fontFamily: C.sans }}>
            <option value="">— Seleccioná o agregá nuevo —</option>
            {(compradores || []).map(o => <option key={o} value={o}>{o}</option>)}
            <option value="Otro">+ Nuevo comprador...</option>
          </select>
          {comprador === 'Otro' && (
            <input type="text" placeholder="Nombre del comprador" value={compradorNuevo}
              onChange={e => setCompradorNuevo(e.target.value)}
              style={{ width: '100%', background: C.surface, border: `1px solid ${C.green}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: C.text, fontFamily: C.sans, boxSizing: 'border-box', marginTop: 6 }} />
          )}
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>Observaciones</div>
          <input type="text" placeholder="observaciones opcionales..." value={observaciones}
            onChange={e => setObservaciones(e.target.value)}
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

const LABORES = ['Siembra', 'Cosecha', 'Pulverización', 'Fertilización', 'Roturación', 'Rastreo', 'Flete', 'Otro']

function ServiciosMovil({ nav, usuario }) {
  const [guardando, setGuardando] = useState(false)
  const [contactos, setContactos] = useState([])
  const [maquinaria, setMaquinaria] = useState([])
  const [form, setForm] = useState({
    cliente: '', clienteNuevo: '', labor: 'Siembra',
    fecha: new Date().toISOString().split('T')[0],
    hectareas: '', maquina_id: '', precio_ha: '', observaciones: ''
  })
  const [ok, setOk] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('contactos').select('id, nombre').eq('activo', true).order('nombre'),
      supabase.from('maquinaria').select('*').eq('activo', true).order('nombre'),
    ]).then(([{ data: ct }, { data: m }]) => {
      setContactos(ct || [])
      setMaquinaria(m || [])
    })
  }, [])

  async function guardar() {
    const nombreCliente = form.cliente === '__nuevo__' ? form.clienteNuevo.trim() : form.cliente
    if (!nombreCliente || !form.labor || !form.hectareas) {
      alert('Completá cliente, labor y hectáreas')
      return
    }
    setGuardando(true)
    if (form.cliente === '__nuevo__' && form.clienteNuevo.trim()) {
      const existe = contactos.find(c => c.nombre.toLowerCase() === form.clienteNuevo.trim().toLowerCase())
      if (!existe) await supabase.from('contactos').insert({ nombre: form.clienteNuevo.trim(), tipo: 'otro', activo: true })
    }
    const ha = parseFloat(form.hectareas)
    const precio = form.precio_ha ? parseFloat(form.precio_ha) : null
    const total = ha && precio ? ha * precio : null
    await supabase.from('servicios_terceros').insert({
      cliente: nombreCliente, labor: form.labor, fecha: form.fecha,
      hectareas: ha, maquina_id: form.maquina_id ? parseInt(form.maquina_id) : null,
      precio_ha: precio, total,
      observaciones: form.observaciones || null,
      registrado_por: usuario?.id,
      estado_pago: 'pendiente',
    })
    setGuardando(false)
    setOk(true)
    setTimeout(() => {
      setOk(false)
      setForm({ cliente: '', clienteNuevo: '', labor: 'Siembra', fecha: new Date().toISOString().split('T')[0], hectareas: '', maquina_id: '', precio_ha: '', observaciones: '' })
    }, 2000)
  }

  const C = { bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6', text: '#1A1916', muted: '#6B6760', accent: '#1A3D6B', green: '#1E5C2E', greenLight: '#E8F4EB', amber: '#7A4500' }
  const inp = { width: '100%', padding: '11px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 15, background: C.surface, boxSizing: 'border-box', fontFamily: 'inherit', color: C.text, marginBottom: 12 }
  const lbl = { fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 4 }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <Topbar titulo="Servicios" sub="Registrar trabajo" onBack={() => nav('home')} />
      <Scroll>
        {ok && (
          <div style={{ background: C.greenLight, border: '1px solid #97C459', borderRadius: 10, padding: '1rem', marginBottom: '1rem', textAlign: 'center', fontSize: 14, fontWeight: 600, color: C.green }}>
            ✓ Servicio registrado
          </div>
        )}
        <label style={lbl}>Cliente</label>
        <select value={form.cliente} onChange={e => setForm({...form, cliente: e.target.value, clienteNuevo: ''})} style={inp}>
          <option value="">— Seleccioná —</option>
          {contactos.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
          <option value="__nuevo__">+ Nuevo cliente...</option>
        </select>
        {form.cliente === '__nuevo__' && (
          <input type="text" placeholder="Nombre del cliente" value={form.clienteNuevo}
            onChange={e => setForm({...form, clienteNuevo: e.target.value})}
            style={{ ...inp, borderColor: C.accent }} autoFocus />
        )}
        <label style={lbl}>Labor</label>
        <select value={form.labor} onChange={e => setForm({...form, labor: e.target.value})} style={inp}>
          {LABORES.map(l => <option key={l}>{l}</option>)}
        </select>
        <label style={lbl}>Fecha</label>
        <input type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} style={inp} />
        <label style={lbl}>Hectáreas</label>
        <input type="number" value={form.hectareas} onChange={e => setForm({...form, hectareas: e.target.value})} style={inp} placeholder="ej. 50" inputMode="decimal" />
        <label style={lbl}>Precio $/ha (opcional)</label>
        <input type="number" value={form.precio_ha} onChange={e => setForm({...form, precio_ha: e.target.value})} style={inp} placeholder="se puede completar después" inputMode="decimal" />
        <label style={lbl}>Máquina</label>
        <select value={form.maquina_id} onChange={e => setForm({...form, maquina_id: e.target.value})} style={inp}>
          <option value="">— Sin especificar —</option>
          {maquinaria.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
        <label style={lbl}>Observaciones</label>
        <input type="text" value={form.observaciones} onChange={e => setForm({...form, observaciones: e.target.value})} style={inp} />
        {form.hectareas && form.precio_ha && (
          <div style={{ background: C.greenLight, border: '1px solid #97C459', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 14, color: C.green, fontWeight: 600 }}>
            Total: ${(parseFloat(form.hectareas) * parseFloat(form.precio_ha)).toLocaleString('es-AR')}
          </div>
        )}
        <button onClick={guardar} disabled={guardando}
          style={{ width: '100%', padding: '14px', fontSize: 15, fontWeight: 600, background: C.green, border: 'none', color: '#fff', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit' }}>
          {guardando ? 'Guardando...' : '💾 Guardar servicio'}
        </button>
      </Scroll>
    </div>
  )
}
