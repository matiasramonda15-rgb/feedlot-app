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
    const [{ data: corrales }, { data: cfg }, { data: alertas }, { data: lotes }, { data: ventas }, { data: stockBajo }] = await Promise.all([
      supabase.from('corrales').select('*').not('rol', 'eq', 'deshabilitado').order('numero'),
      supabase.from('configuracion').select('valor').eq('clave', 'proxima_pesada').single(),
      supabase.from('alertas').select('*').eq('resuelta', false).order('fecha_vence'),
      supabase.from('lotes').select('procedencia').order('created_at', { ascending: false }),
      supabase.from('ventas').select('id, comprador, precio_kg, kg_vivo_total, kg_neto, cantidad, corral_id, creado_en, corrales(numero)').is('precio_kg', null).order('creado_en', { ascending: false }),
      supabase.from('stock_insumos').select('*').filter('cantidad_kg', 'lte', 'minimo_kg'),
    ])
    const [{ data: formulasDB }] = await Promise.all([
      supabase.from('formulas_mixer').select('*').order('orden'),
    ])
    // Construir formulas desde BD
    const formulasObj = { seco: { acostumbramiento: [], recria: [], terminacion: [] } }
    ;(formulasDB || []).forEach(row => {
      if (row.dieta === 'seco' && formulasObj.seco[row.etapa]) {
        formulasObj.seco[row.etapa].push({ n: row.ingrediente, kg: row.kg, c: row.color || '#888' })
      }
    })
    const procedencias = [...new Set((lotes || []).map(x => x.procedencia).filter(Boolean))].sort()
    const compradores = [...new Set((ventas || []).filter(v => v.comprador).map(v => v.comprador))].sort()
    const corralesOrdenados = (corrales || []).sort((a, b) => parseInt(a.numero) - parseInt(b.numero))
    setDatos({ corrales: corralesOrdenados, proximaPesada: cfg?.valor || null, alertas: alertas || [], procedencias, compradores, ventasSinPrecio: ventas || [], stockBajo: stockBajo || [], formulas: formulasObj })
  }

  const pantallas = {
    home:        <Home usuario={usuario} nav={nav} onLogout={onLogout} datos={datos} />,
    corrales:    <Corrales nav={nav} corrales={datos.corrales} usuario={usuario} esEncargado={esEncargado} onDone={cargarDatos} />,
    ingreso:     <Ingreso nav={nav} usuario={usuario} corrales={datos.corrales} procedencias={datos.procedencias || []} onDone={cargarDatos} />,
    pesada:      <PesadaMovil nav={nav} usuario={usuario} corrales={datos.corrales} onDone={cargarDatos} />,
    alimentacion:<AlimentacionMovil nav={nav} usuario={usuario} corrales={datos.corrales} formulas={datos.formulas} onDone={cargarDatos} />,
    sanidad:     <SanidadMovil nav={nav} alertas={datos.alertas} proximaPesada={datos.proximaPesada} onDone={cargarDatos} corrales={datos.corrales} usuario={usuario} />,
    venta:       <VentaMovil nav={nav} usuario={usuario} corrales={datos.corrales} compradores={datos.compradores || []} onDone={cargarDatos} />,
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
    tareas.push({ icon: '🐄', titulo: `Cuarentena C-${c.numero} por vencer`, sub: `${c.animales || 0} animales · verificar pase a acumulación`, pantalla: 'corrales', urgente: true })
  })

  // Revision bisemanal los lunes (1) y jueves (4)
  const diaSemana = new Date().getDay()
  if (diaSemana === 1 || diaSemana === 4) {
    tareas.unshift({ icon: '🔍', titulo: 'Revision bisemanal de corrales', sub: 'Hoy corresponde revisar todos los corrales', pantalla: 'sanidad', urgente: true })
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
  const [rolDestino, setRolDestino] = useState('')
  const [subDestino, setSubDestino] = useState('')
  const [guardando, setGuardando] = useState(false)
  const corralesActivos = corrales.filter(c => c.rol !== 'deshabilitado')
  const colors = { cuarentena: C.amber, acumulacion: C.blue, enfermeria: C.red, clasificado: '#B09ED4', libre: C.muted }

  // Corral destino seleccionado
  const corralDestino = corrales.find(c => String(c.id) === String(movForm.destino_id))
  const destinoEsLibre = corralDestino?.rol === 'libre'
  const rolDestinoRequerido = destinoEsLibre && !rolDestino

  async function cambiarRol(corralId, nuevoRol) {
    if (nuevoRol === 'clasificado') return // se maneja aparte con sub
    await supabase.from('corrales').update({ rol: nuevoRol, sub: null }).eq('id', corralId)
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
function AlimentacionMovil({ nav, usuario, corrales, formulas, onDone }) {
  const corralesAlim = corrales.filter(c => c.rol !== 'libre' && c.rol !== 'deshabilitado')
  const RANGOS_RECRIA = ['A','B','C']
  function getEtapa(c) {
    if (c.rol === 'cuarentena') return 'acostumbramiento'
    if (c.rol === 'acumulacion' || c.rol === 'enfermeria') return 'recria'
    if (c.rol === 'clasificado') return RANGOS_RECRIA.includes(c.sub) ? 'recria' : 'terminacion'
    return 'recria'
  }
  const FRML = (formulas?.seco) || {
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
    corralesAlim.forEach(c => { inicial[c.id] = Math.round(Math.round((c.animales || 0) * 10) / 100) * 100 })
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
    { nombre: 'Mixer 1 - Acostumbramiento', etapa: 'acostumbramiento', corralesIds: corralesAlim.filter(c => getEtapa(c) === 'acostumbramiento').map(c => c.id), cap: 4000 },
    { nombre: 'Mixer 2 - Recria', etapa: 'recria', corralesIds: corralesAlim.filter(c => getEtapa(c) === 'recria').map(c => c.id), cap: 4000 },
    { nombre: 'Mixer 3 - Terminacion', etapa: 'terminacion', corralesIds: corralesAlim.filter(c => getEtapa(c) === 'terminacion').map(c => c.id), cap: 4000 },
  ].filter(m => m.corralesIds.length > 0)

  async function confirmar() {
    setGuardando(true)
    const registros = corralesAlim.map(c => ({
      mixer: getEtapa(c) === 'acostumbramiento' ? 'Acostumbramiento' : getEtapa(c) === 'recria' ? 'Recria' : 'Terminacion',
      corral_id: c.id, formula: 'Engorde',
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
function SanidadMovil({ nav, alertas, proximaPesada, onDone, corrales, usuario }) {
  const [pantSan, setPantSan] = useState('alertas')
  const [confirmados, setConfirmados] = useState({})
  const [revState, setRevState] = useState([])
  const [formEvento, setFormEvento] = useState({ corral_id: '', producto: 'Alliance+Feedlot', cantidad: '', observaciones: '' })
  const [guardando, setGuardando] = useState(false)

  const corralesActivos = corrales.filter(c => c.rol !== 'libre' && c.rol !== 'deshabilitado')
  const proximaDate = proximaPesada ? new Date(proximaPesada + 'T12:00:00') : null
  const diasPesada = proximaDate ? Math.ceil((proximaDate - new Date()) / (1000 * 60 * 60 * 24)) : null

  const PRODUCTOS = ['Alliance+Feedlot','Ivermectina','Oxitetraciclina','Oxitetraciclina oftálmica','Enrofloxacina','Meloxicam','Vitamina AD3E']

  useEffect(() => {
    setRevState(corralesActivos.map(c => ({ id: c.id, numero: c.numero, rol: c.rol, animales: c.animales || 0, ok: null, enfermos: [] })))
  }, [corrales])

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
    if (!formEvento.cantidad) { alert('Ingresa la cantidad de animales'); return }
    setGuardando(true)
    await supabase.from('eventos_sanitarios').insert({
      tipo: 'tratamiento', corral_id: parseInt(formEvento.corral_id),
      producto: formEvento.producto, cantidad_animales: parseInt(formEvento.cantidad),
      observaciones: formEvento.observaciones || null, registrado_por: usuario?.id,
    })
    onDone()
    alert('Evento registrado.')
    setPantSan('alertas')
    setFormEvento({ corral_id: '', producto: 'Alliance+Feedlot', cantidad: '', observaciones: '' })
    setGuardando(false)
  }

  const TABS = [
    { key: 'alertas', label: 'Alertas' },
    { key: 'revision', label: 'Revision' },
    { key: 'evento', label: 'Evento' },
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
                        <button onClick={() => { const n = [...revState]; n[i] = {...n[i], ok: false, enfermos: [{desc:'',diag:'Conjuntivitis',prod:''}]}; setRevState(n) }}
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
                        <select value={enf.prod} onChange={e => { const n = [...revState]; n[i].enfermos[ei].prod = e.target.value; setRevState(n) }}
                          style={{ width: '100%', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, color: C.text, fontFamily: C.sans }}>
                          <option value="">— Producto aplicado —</option>
                          {PRODUCTOS.map(p => <option key={p}>{p}</option>)}
                        </select>
                      </div>
                    ))}
                    <button onClick={() => { const n = [...revState]; n[i].enfermos.push({desc:'',diag:'Conjuntivitis',prod:''}); setRevState(n) }}
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
              <select value={formEvento.producto} onChange={e => setFormEvento({...formEvento, producto: e.target.value})}
                style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 14, color: C.text, fontFamily: C.sans }}>
                {PRODUCTOS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '.85rem' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>Cantidad de animales</div>
              <input type="number" inputMode="numeric" placeholder="0" value={formEvento.cantidad}
                onChange={e => setFormEvento({...formEvento, cantidad: e.target.value})}
                style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 12px', fontSize: 16, fontFamily: C.mono, fontWeight: 600, color: C.green, boxSizing: 'border-box' }} />
            </div>
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
            <div style={{ background: '#0F2040', border: `1px solid ${C.blue}`, borderRadius: 10, padding: '.75rem', marginBottom: '.85rem', fontSize: 12, color: C.blue, lineHeight: 1.5 }}>
              Ingresá cuántos animales cayeron en cada rango. A y B van a corrales nuevos (libres). C en adelante se suman a los corrales existentes.
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
                  Neto: <strong>{kgNetoCv.toLocaleString('es-AR')} kg</strong> (desbaste {Math.round(kgVivoCv * 0.08).toLocaleString('es-AR')} kg)
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
                { label: 'Desbaste 8%', value: Math.round(desbaste).toLocaleString('es-AR') + ' kg' },
                { label: 'KG neto total', value: Math.round(kg_neto).toLocaleString('es-AR') + ' kg' },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: C.mono, color: C.blue }}>{s.value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: C.muted }}>{totalCant} animales · {corralesVenta.filter(c => c.corral_id).length} corrales</div>
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
