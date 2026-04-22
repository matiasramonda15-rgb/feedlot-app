import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Tablero({ usuario }) {
  const [corrales, setCorrales] = useState([])
  const [alertas, setAlertas] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarDatos()
    // Suscripción en tiempo real para alertas
    const sub = supabase.channel('alertas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alertas' }, cargarDatos)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  async function cargarDatos() {
    const [{ data: c }, { data: a }, { data: m }] = await Promise.all([
      async function cargarDatos() {
  const [{ data: c }, { data: a }, { data: m }] = await Promise.all([
    supabase.from('corrales').select('*').order('id'),
    supabase.from('alertas').select('*').eq('resuelta', false).order('fecha_vence'),
    supabase.from('movimientos').select('*, corrales_origen:corral_origen_id(numero), corrales_destino:corral_destino_id(numero), lotes(codigo)').order('fecha', { ascending: false }).limit(5),
  ])
  const corralesNorm = (c || []).map(x => ({
    ...x,
    numero: x.numero || x['número'] || x.id,
    animales: x.animales || 0,
  }))
  setCorrales(corralesNorm)
  setAlertas(a || [])
  setMovimientos(m || [])
  setLoading(false)
}
      supabase.from('alertas').select('*').eq('resuelta', false).order('fecha_vence'),
      supabase.from('movimientos').select('*, corrales_origen:corral_origen_id(numero), corrales_destino:corral_destino_id(numero), lotes(codigo)').order('fecha', { ascending: false }).limit(5),
    ])
    setCorrales(c || [])
    setAlertas(a || [])
    setMovimientos(m || [])
    setLoading(false)
  }

  // Cálculos globales
  const totalAnimales = corrales.reduce((a, c) => a + (c.animales || 0), 0)
  const corralesActivos = corrales.filter(c => c.rol !== 'libre' && c.rol !== 'deshabilitado').length
  const esDueno = ['dueno'].includes(usuario?.rol)

  if (loading) return <Loader />

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Tablero</h1>
          <div style={{ fontSize: 12, color: '#6B6760', fontFamily: "'IBM Plex Mono', monospace" }}>
            {new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn ghost onClick={cargarDatos}>Actualizar</Btn>
        </div>
      </div>

      {/* HERO — solo dueños */}
      {esDueno && <HeroIndicadores corrales={corrales} />}

      {/* MÉTRICAS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: '1.25rem' }}>
        <Metric label="Total animales" value={totalAnimales} sub={`${corralesActivos} corrales activos`} />
        <Metric label="Próxima pesada" value="04/05" sub="en 14 días · AC-01" />
        <Metric label="Alertas activas" value={alertas.length} sub="pendientes de acción" warn={alertas.length > 0} />
        <Metric label="Corrales libres" value={corrales.filter(c => c.rol === 'libre').length} sub="disponibles" ok />
      </div>

      {/* DOS COLUMNAS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* ALERTAS */}
        <Card titulo="Alertas del día" badge={alertas.length > 0 ? `${alertas.length} pendientes` : null} badgeWarn>
          {alertas.length === 0
            ? <p style={{ fontSize: 13, color: '#9E9A94', padding: '.5rem 0' }}>No hay alertas pendientes.</p>
            : alertas.slice(0, 5).map(a => <AlertaRow key={a.id} alerta={a} onResolver={() => resolverAlerta(a.id)} />)
          }
        </Card>

        {/* ÚLTIMOS MOVIMIENTOS */}
        <Card titulo="Últimos movimientos">
          {movimientos.length === 0
            ? <p style={{ fontSize: 13, color: '#9E9A94', padding: '.5rem 0' }}>Sin movimientos recientes.</p>
            : movimientos.map(m => <MovRow key={m.id} mov={m} />)
          }
        </Card>
      </div>

      {/* CORRALES */}
      <Card titulo="Estado de corrales" style={{ marginTop: '1rem' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Corral','Rol','Animales','Ocupación','Estado'].map(h => (
                  <th key={h} style={{ background: '#F7F5F0', padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#6B6760', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid #E2DDD6' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {corrales.filter(c => c.rol !== 'deshabilitado').map(c => (
                <CorralRow key={c.id} corral={c} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )

  async function resolverAlerta(id) {
    await supabase.from('alertas').update({ resuelta: true, resuelta_en: new Date().toISOString(), resuelta_por: usuario?.id }).eq('id', id)
    cargarDatos()
  }
}

function HeroIndicadores({ corrales }) {
  const conGDP = corrales.filter(c => c.gdp)
  const totalAnimGDP = conGDP.reduce((a, c) => a + (c.animales || 0), 0)
  const gdpGlobal = totalAnimGDP > 0 ? (conGDP.reduce((a, c) => a + c.gdp * (c.animales || 0), 0) / totalAnimGDP).toFixed(2) : '—'
  const gdpColor = parseFloat(gdpGlobal) >= 1.1 ? '#7EE8A2' : parseFloat(gdpGlobal) >= 0.9 ? '#F5C97A' : '#F09595'

  return (
    <div style={{ background: '#1A3D6B', borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '1.25rem', color: '#fff' }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', opacity: .6, marginBottom: '1rem' }}>Indicadores globales</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: 'rgba(255,255,255,.1)', borderRadius: 8, overflow: 'hidden' }}>
        {[
          { label: 'GDP global', value: gdpGlobal + ' kg/d', color: gdpColor, sub: 'prom. ponderado' },
          { label: 'Conversión MF', value: '8,4:1', sub: 'kg alimento / kg carne' },
          { label: 'Conversión MS', value: '5,7:1', color: '#7EE8A2', sub: 'materia seca est.' },
          { label: 'Días para 400 kg', value: '28', sub: 'promedio corrales' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,.06)', padding: '1rem 1.1rem' }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', opacity: .55, marginBottom: 5 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: s.color || '#fff' }}>{s.value}</div>
            <div style={{ fontSize: 11, opacity: .55, marginTop: 3 }}>{s.sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AlertaRow({ alerta, onResolver }) {
  const colors = { segunda_dosis: '#E24B4A', revision_bisemanal: '#EF9F27', pesada_proxima: '#378ADD', stock_bajo: '#EF9F27' }
  const color = colors[alerta.tipo] || '#888'
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '.75rem', padding: '.75rem 0', borderBottom: '1px solid #E2DDD6' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 5 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{alerta.titulo}</div>
        <div style={{ fontSize: 11, color: '#9E9A94', marginTop: 2, fontFamily: "'IBM Plex Mono', monospace" }}>
          {alerta.fecha_vence ? `Vence: ${new Date(alerta.fecha_vence).toLocaleDateString('es-AR')}` : ''}
        </div>
      </div>
      <button onClick={onResolver} style={{ border: '1px solid #E2DDD6', background: 'transparent', borderRadius: 5, padding: '3px 9px', fontSize: 11, cursor: 'pointer', color: '#6B6760', fontFamily: "'IBM Plex Sans', sans-serif" }}>
        Resolver
      </button>
    </div>
  )
}

function MovRow({ mov }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '.75rem', padding: '.75rem 0', borderBottom: '1px solid #E2DDD6' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#639922', flexShrink: 0, marginTop: 5 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13 }}>{mov.lotes?.codigo || '—'} · {mov.tipo?.replace(/_/g,' ')}</div>
        <div style={{ fontSize: 11, color: '#9E9A94', marginTop: 2, fontFamily: "'IBM Plex Mono', monospace" }}>
          {mov.corrales_origen?.numero ? `C-${mov.corrales_origen.numero} → C-${mov.corrales_destino?.numero}` : ''} · {mov.cantidad} anim.
        </div>
      </div>
    </div>
  )
}

function CorralRow({ corral }) {
  const ROL_BADGE = { libre:'#E8F4EB|#1E5C2E', cuarentena:'#FDF0E0|#7A4500', acumulacion:'#E8EFF8|#1A3D6B', clasificado:'#F0EAFB|#3D1A6B', enfermeria:'#FDF0F0|#7A1A1A', transitorio:'#F5F0E8|#7A6520' }
  const [bg, color] = (ROL_BADGE[corral.rol] || '#F7F5F0|#6B6760').split('|')
  const pct = corral.capacidad > 0 ? Math.round((corral.animales || 0) / corral.capacidad * 100) : 0

  return (
    <tr style={{ borderBottom: '1px solid #E2DDD6' }}>
      <td style={{ padding: '9px 12px', fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace" }}>{corral.numero}</td>
      <td style={{ padding: '9px 12px' }}>
        <span style={{ background: bg, color, borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{corral.rol}</span>
      </td>
      <td style={{ padding: '9px 12px', fontFamily: "'IBM Plex Mono', monospace" }}>{corral.animales || 0}</td>
      <td style={{ padding: '9px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 4, background: '#F7F5F0', borderRadius: 2, overflow: 'hidden', border: '1px solid #E2DDD6' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: pct > 90 ? '#E24B4A' : '#639922', borderRadius: 2 }} />
          </div>
          <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", minWidth: 32 }}>{pct}%</span>
        </div>
      </td>
      <td style={{ padding: '9px 12px', fontSize: 11, color: '#9E9A94' }}>{corral.sub || '—'}</td>
    </tr>
  )
}

// ── COMPONENTES COMPARTIDOS ────────────────────────────
export function Card({ titulo, badge, badgeWarn, children, style }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E2DDD6', borderRadius: 10, padding: '1.25rem', marginBottom: '1rem', ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#6B6760', textTransform: 'uppercase', letterSpacing: '.07em' }}>{titulo}</div>
        {badge && <span style={{ background: badgeWarn ? '#FDF0E0' : '#E8F4EB', color: badgeWarn ? '#7A4500' : '#1E5C2E', borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{badge}</span>}
      </div>
      {children}
    </div>
  )
}

export function Metric({ label, value, sub, ok, warn }) {
  const color = ok ? '#1E5C2E' : warn ? '#7A4500' : '#1A1916'
  return (
    <div style={{ background: '#fff', border: '1px solid #E2DDD6', borderRadius: 8, padding: '1rem' }}>
      <div style={{ fontSize: 11, color: '#6B6760', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#9E9A94', marginTop: 3 }}>{sub}</div>
    </div>
  )
}

export function Btn({ children, onClick, ghost, danger, sm }) {
  return (
    <button onClick={onClick} style={{
      borderRadius: 6, padding: sm ? '5px 10px' : '8px 16px', fontSize: sm ? 12 : 13,
      fontFamily: "'IBM Plex Sans', sans-serif", cursor: 'pointer', fontWeight: 500, border: '1px solid',
      background: ghost ? 'transparent' : danger ? '#FDF0F0' : '#1A3D6B',
      borderColor: ghost ? '#E2DDD6' : danger ? '#F09595' : '#1A3D6B',
      color: ghost ? '#6B6760' : danger ? '#7A1A1A' : '#fff',
      transition: 'all .15s',
    }}>{children}</button>
  )
}

export function Badge({ children, ok, warn, red, info, purple }) {
  const styles = {
    ok:     '#E8F4EB|#1E5C2E', warn:  '#FDF0E0|#7A4500',
    red:    '#FDF0F0|#7A1A1A', info:  '#E8EFF8|#1A3D6B',
    purple: '#F0EAFB|#3D1A6B', default: '#F7F5F0|#6B6760',
  }
  const key = ok?'ok':warn?'warn':red?'red':info?'info':purple?'purple':'default'
  const [bg, color] = styles[key].split('|')
  return <span style={{ background: bg, color, borderRadius: 5, padding: '3px 8px', fontSize: 11, fontWeight: 600, display: 'inline-block' }}>{children}</span>
}

export function Loader() {
  return <div style={{ padding: '2rem', textAlign: 'center', color: '#9E9A94', fontSize: 13 }}>Cargando...</div>
}
