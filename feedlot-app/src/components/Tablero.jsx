import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const S = {
  bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6', borderStrong: '#C8C2B8',
  text: '#1A1916', muted: '#6B6760', hint: '#9E9A94',
  accent: '#1A3D6B', accentLight: '#E8EFF8',
  green: '#1E5C2E', greenLight: '#E8F4EB',
  amber: '#7A4500', amberLight: '#FDF0E0',
  red: '#7A1A1A', redLight: '#FDF0F0',
  purple: '#3D1A6B', purpleLight: '#F0EAFB',
}

export function Loader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem', color: S.muted, fontSize: 13 }}>
      Cargando...
    </div>
  )
}

export function Btn({ children, onClick, variant = 'ghost', size = 'md', disabled }) {
  const base = { borderRadius: 6, fontFamily: "'IBM Plex Sans', sans-serif", cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 500, border: '1px solid', transition: 'all .15s', opacity: disabled ? 0.6 : 1 }
  const variants = {
    ghost: { background: 'transparent', borderColor: S.border, color: S.muted, padding: size === 'sm' ? '5px 10px' : '8px 16px', fontSize: size === 'sm' ? 12 : 13 },
    primary: { background: S.accent, borderColor: S.accent, color: '#fff', padding: size === 'sm' ? '5px 10px' : '8px 16px', fontSize: size === 'sm' ? 12 : 13 },
    green: { background: S.green, borderColor: S.green, color: '#fff', padding: size === 'sm' ? '5px 10px' : '8px 16px', fontSize: size === 'sm' ? 12 : 13 },
    red: { background: S.redLight, borderColor: '#F09595', color: S.red, padding: size === 'sm' ? '5px 10px' : '8px 16px', fontSize: size === 'sm' ? 12 : 13 },
  }
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant] }}>{children}</button>
}

const BADGE_STYLES = {
  ok:      { background: '#E8F4EB', color: '#1E5C2E' },
  warn:    { background: '#FDF0E0', color: '#7A4500' },
  red:     { background: '#FDF0F0', color: '#7A1A1A' },
  info:    { background: '#E8EFF8', color: '#1A3D6B' },
  purple:  { background: '#F0EAFB', color: '#3D1A6B' },
  neutral: { background: '#F7F5F0', color: '#6B6760', border: '1px solid #E2DDD6' },
}

function Badge({ children, type = 'neutral', style = {} }) {
  return (
    <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600, ...BADGE_STYLES[type], ...style }}>
      {children}
    </span>
  )
}

const ROL_BADGE = {
  'cuarentena': 'warn', 'acumulacion': 'info', 'enfermeria': 'red',
  'clasificado': 'ok', 'libre': 'neutral', 'deshabilitado': 'neutral',
}

function rolLabel(c) {
  if (c.rol === 'clasificado' && c.sub) return `Rango ${c.sub}`
  const labels = { cuarentena: 'Cuarentena', acumulacion: 'Acumulación', enfermeria: 'Enfermería', clasificado: 'Clasificado', libre: 'Libre' }
  return labels[c.rol] || c.rol
}

export default function Tablero({ usuario }) {
  const [datos, setDatos] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const hoy = new Date()
    const hace30 = new Date(); hace30.setDate(hace30.getDate() - 30)

    const [
      { data: corrales },
      { data: alertas },
      { data: pesadas },
      { data: ventas },
      { data: ingresos },
      { data: movimientos },
      { data: mortalidad },
      { data: cfg },
      { data: stockBajo },
    ] = await Promise.all([
      supabase.from('corrales').select('*').not('rol', 'eq', 'deshabilitado').order('numero'),
      supabase.from('alertas').select('*').eq('resuelta', false).order('fecha_vence'),
      supabase.from('pesadas').select('*, corrales(numero), pesada_animales(rango, cantidad, peso_promedio)').order('creado_en', { ascending: false }).limit(20),
      supabase.from('ventas').select('*').gte('creado_en', hace30.toISOString()).order('creado_en', { ascending: false }),
      supabase.from('lotes').select('*').order('created_at', { ascending: false }).limit(10),
      supabase.from('movimientos').select('*, corrales_origen:corral_origen_id(numero), corrales_destino:corral_destino_id(numero)').order('fecha', { ascending: false }).limit(8),
      supabase.from('mortalidad').select('*').order('fecha', { ascending: false }).limit(5),
      supabase.from('configuracion').select('valor').eq('clave', 'proxima_pesada').single(),
      supabase.from('stock_insumos').select('*').filter('cantidad_kg', 'lte', 'minimo_kg'),
    ])

    // Calcular GDP por corral desde pesadas
    const gdpPorCorral = {}
    if (pesadas) {
      const porCorral = {}
      pesadas.forEach(p => {
        const num = p.corrales?.numero
        if (!num) return
        if (!porCorral[num]) porCorral[num] = []
        porCorral[num].push(p)
      })
      Object.entries(porCorral).forEach(([num, ps]) => {
        if (ps.length >= 2) {
          const sorted = ps.sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en))
          const primera = sorted[0]
          const ultima = sorted[sorted.length - 1]
          const diasDiff = Math.max(1, (new Date(ultima.creado_en) - new Date(primera.creado_en)) / (1000 * 60 * 60 * 24))
          // Peso promedio de pesada_animales
          const pesoPromPrimera = calcPesoProm(primera.pesada_animales)
          const pesoPromUltima = calcPesoProm(ultima.pesada_animales)
          if (pesoPromPrimera && pesoPromUltima) {
            gdpPorCorral[num] = {
              gdp: (pesoPromUltima - pesoPromPrimera) / diasDiff,
              pesoActual: pesoPromUltima,
              diasEngorde: Math.round(diasDiff),
            }
          }
        }
      })
    }

    // Construir movimientos recientes combinados
    const movRecientes = []
    if (ingresos) ingresos.slice(0, 3).forEach(i => movRecientes.push({ tipo: 'ingreso', texto: `Ingreso ${i.codigo} · ${i.cantidad} animales`, sub: `${new Date(i.fecha_ingreso).toLocaleDateString('es-AR')} · ${i.procedencia} · ${Math.round(i.peso_prom_ingreso || 0)} kg prom.`, color: S.green, fecha: i.fecha_ingreso }))
    if (ventas) ventas.slice(0, 2).forEach(v => movRecientes.push({ tipo: 'venta', texto: `Venta · ${v.cantidad} animales · C-${v.corral_id}`, sub: `${new Date(v.creado_en).toLocaleDateString('es-AR')} · ${v.comprador || 'sin comprador'} · ${v.precio_kg ? '$' + v.precio_kg.toLocaleString('es-AR') + '/kg' : 'sin precio'}`, color: S.accent, fecha: v.creado_en }))
    if (mortalidad) mortalidad.slice(0, 2).forEach(m => movRecientes.push({ tipo: 'mortalidad', texto: `Mortandad · ${m.cantidad} animal${m.cantidad !== 1 ? 'es' : ''}`, sub: `${new Date(m.fecha).toLocaleDateString('es-AR')} · ${m.causa || 'sin causa'}`, color: S.amber, fecha: m.fecha }))
    movRecientes.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

    setDatos({ corrales: corrales || [], alertas: alertas || [], gdpPorCorral, ventas: ventas || [], movRecientes: movRecientes.slice(0, 6), proximaPesada: cfg?.valor || null, stockBajo: stockBajo || [] })
    setLoading(false)
  }

  if (loading) return <Loader />

  const { corrales, alertas, gdpPorCorral, ventas, movRecientes, proximaPesada, stockBajo } = datos

  const corralesActivos = corrales.filter(c => c.rol !== 'libre')
  const totalAnimales = corralesActivos.reduce((s, c) => s + (c.animales || 0), 0)

  // GDP global ponderado
  const corralesConGDP = corralesActivos.filter(c => gdpPorCorral[c.numero])
  const totalAnimGDP = corralesConGDP.reduce((s, c) => s + (c.animales || 0), 0)
  const gdpGlobal = totalAnimGDP > 0
    ? corralesConGDP.reduce((s, c) => s + (gdpPorCorral[c.numero].gdp * (c.animales || 0)), 0) / totalAnimGDP
    : null

  // Días prom para 400 kg
  const corralesConPeso = corralesActivos.filter(c => gdpPorCorral[c.numero]?.pesoActual && gdpPorCorral[c.numero]?.gdp > 0)
  const diasProm = corralesConPeso.length
    ? Math.round(corralesConPeso.reduce((s, c) => s + Math.max(0, (400 - gdpPorCorral[c.numero].pesoActual) / gdpPorCorral[c.numero].gdp), 0) / corralesConPeso.length)
    : null

  // Ventas este mes
  const ventasTotal = ventas.reduce((s, v) => s + (v.total || 0), 0)
  const ventasAnimales = ventas.reduce((s, v) => s + (v.cantidad || 0), 0)

  // Próxima pesada
  const proximaDate = proximaPesada ? new Date(proximaPesada + 'T12:00:00') : null
  const diasPesada = proximaDate ? Math.ceil((proximaDate - new Date()) / (1000 * 60 * 60 * 24)) : null

  // Alertas
  const totalAlertas = alertas.length + (diasPesada !== null && diasPesada <= 14 ? 1 : 0) + stockBajo.length

  // Animales listos para vender (≥400 kg estimado)
  const animalesListos = corralesActivos.filter(c => {
    const g = gdpPorCorral[c.numero]
    return g && g.pesoActual >= 400
  }).reduce((s, c) => s + (c.animales || 0), 0)

  const gdpColor = gdpGlobal ? (gdpGlobal >= 1.1 ? S.green : gdpGlobal >= 0.9 ? S.amber : S.red) : S.hint
  const gdpCls = gdpGlobal ? (gdpGlobal >= 1.1 ? 'ok' : gdpGlobal >= 0.9 ? 'warn' : 'bad') : ''

  return (
    <div>
      {/* TOPBAR */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Tablero</div>
          <div style={{ fontSize: 12, color: S.muted, fontFamily: 'monospace' }}>
            {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · feedlot activo
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn size="sm">Ver reportes</Btn>
          <Btn size="sm" variant="primary">+ Registrar novedad</Btn>
        </div>
      </div>

      {/* HERO - INDICADORES GLOBALES */}
      <div style={{ background: S.accent, borderRadius: 12, padding: '1.5rem', marginBottom: '1.25rem', color: '#fff' }}>
        <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', opacity: 0.6, marginBottom: '1rem' }}>
          Indicadores globales del feedlot · ciclo activo
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: 'rgba(255,255,255,.1)', borderRadius: 8, overflow: 'hidden' }}>
          {[
            {
              label: 'Animales activos',
              val: totalAnimales,
              valStyle: {},
              sub: `${corralesActivos.length} corrales activos`,
            },
            {
              label: 'GDP global',
              val: gdpGlobal ? gdpGlobal.toFixed(2) : '—',
              valSuffix: gdpGlobal ? ' kg/d' : '',
              valStyle: { color: gdpGlobal ? (gdpGlobal >= 1.1 ? '#7EE8A2' : gdpGlobal >= 0.9 ? '#F5C97A' : '#F09595') : 'rgba(255,255,255,.4)' },
              sub: totalAnimGDP > 0 ? `prom. ponderado · ${totalAnimGDP} anim.` : 'sin pesadas registradas',
            },
            {
              label: 'Conv. MF global',
              val: '—',
              valSuffix: '',
              valStyle: { color: 'rgba(255,255,255,.4)' },
              sub: 'kg alimento / kg carne',
            },
            {
              label: 'Conv. MS global',
              val: '—',
              valSuffix: '',
              valStyle: { color: 'rgba(255,255,255,.4)' },
              sub: 'materia seca estimada',
            },
            {
              label: 'Días prom. para 400 kg',
              val: diasProm !== null ? diasProm : '—',
              valStyle: { color: diasProm !== null ? '#7EE8A2' : 'rgba(255,255,255,.4)' },
              sub: 'al ritmo de GDP actual',
            },
          ].map((s, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,.06)', padding: '1rem 1.1rem' }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', opacity: 0.55, marginBottom: 5 }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'monospace', lineHeight: 1, ...s.valStyle }}>
                {s.val}{s.valSuffix && <span style={{ fontSize: 14, fontWeight: 400 }}>{s.valSuffix}</span>}
              </div>
              <div style={{ fontSize: 11, opacity: 0.55, marginTop: 3 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ALERTAS BANNER */}
      {(diasPesada !== null && diasPesada <= 14) && (
        <div style={{ background: S.amberLight, border: '1px solid #EF9F27', borderRadius: 8, padding: '.9rem 1rem', fontSize: 13, color: S.amber, marginBottom: '1.25rem', lineHeight: 1.6 }}>
          <strong>Próxima pesada en {diasPesada} días</strong> · {proximaDate?.toLocaleDateString('es-AR')}
          {alertas.length > 0 && ` · ${alertas.length} alerta${alertas.length !== 1 ? 's' : ''} sanitaria${alertas.length !== 1 ? 's' : ''} pendiente${alertas.length !== 1 ? 's' : ''}.`}
        </div>
      )}

      {/* MÉTRICAS OPERATIVAS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.25rem' }}>
        {[
          { label: 'Total animales', val: totalAnimales, sub: `${corralesActivos.filter(c=>c.rol!=='libre').length} corrales activos`, color: S.text },
          { label: 'Próxima pesada', val: proximaDate ? proximaDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '—', valSize: 15, sub: diasPesada !== null ? `en ${diasPesada} días` : 'no configurada', color: diasPesada !== null && diasPesada <= 7 ? S.amber : S.text },
          { label: 'Alertas activas', val: totalAlertas, sub: `${alertas.length} sanidad · ${stockBajo.length} stock`, color: totalAlertas > 0 ? S.amber : S.green },
          { label: 'Vendidos este mes', val: ventasAnimales, sub: ventasTotal > 0 ? `$${(ventasTotal / 1000000).toFixed(1)}M` : 'sin ventas', color: S.green },
        ].map((m, i) => (
          <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem' }}>
            <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>{m.label}</div>
            <div style={{ fontSize: m.valSize || 20, fontWeight: 600, fontFamily: 'monospace', lineHeight: 1, color: m.color }}>{m.val}</div>
            <div style={{ fontSize: 11, color: S.hint, marginTop: 3 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* ALERTA ANIMALES LISTOS */}
      {animalesListos > 0 && (
        <div style={{ background: S.accentLight, border: '1px solid #85B7EB', borderRadius: 8, padding: '.9rem 1rem', fontSize: 13, color: S.accent, marginBottom: '1.25rem', lineHeight: 1.6 }}>
          <strong>{animalesListos} animales superaron los 400 kg.</strong> Están listos para vender.
        </div>
      )}

      {/* CORRALES + GDP */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>

        {/* TABLA CORRALES */}
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em' }}>Estado de corrales</div>
            <span style={{ fontSize: 11, color: S.muted }}>hacé clic para ver detalle</span>
          </div>
          <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: S.bg }}>
                  {['Corral', 'Rol', 'Anim.', 'Peso', 'GDP', 'Estado'].map(h => (
                    <th key={h} style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {corralesActivos.filter(c => c.rol !== 'libre').map(c => {
                  const g = gdpPorCorral[c.numero]
                  const gdpColor = g ? (g.gdp >= 1.1 ? S.green : g.gdp >= 0.9 ? S.amber : S.red) : S.hint
                  const diasVenta = g ? Math.max(0, Math.ceil((400 - g.pesoActual) / g.gdp)) : null
                  let estadoBadge, estadoTipo
                  if (diasVenta !== null) {
                    if (diasVenta <= 0) { estadoBadge = 'Listo ★'; estadoTipo = 'ok' }
                    else if (diasVenta <= 15) { estadoBadge = 'Pronto'; estadoTipo = 'ok' }
                    else if (diasVenta <= 40) { estadoBadge = 'En curso'; estadoTipo = 'info' }
                    else { estadoBadge = 'Largo plazo'; estadoTipo = 'neutral' }
                  } else if (c.rol === 'cuarentena') {
                    estadoBadge = 'Cuarentena'; estadoTipo = 'warn'
                  } else {
                    estadoBadge = c.rol === 'acumulacion' ? 'Acumulando' : '—'; estadoTipo = 'neutral'
                  }
                  return (
                    <tr key={c.id} style={{ borderBottom: `1px solid ${S.border}`, cursor: 'pointer' }}>
                      <td style={{ padding: '9px 10px', fontWeight: 600, fontFamily: 'monospace' }}>{c.numero}</td>
                      <td style={{ padding: '9px 10px' }}><Badge type={ROL_BADGE[c.rol] || 'neutral'} style={{ fontSize: 10 }}>{rolLabel(c)}</Badge></td>
                      <td style={{ padding: '9px 10px', fontFamily: 'monospace' }}>{c.animales || 0}</td>
                      <td style={{ padding: '9px 10px', fontFamily: 'monospace', color: S.muted }}>{g ? Math.round(g.pesoActual) + ' kg' : '—'}</td>
                      <td style={{ padding: '9px 10px', fontFamily: 'monospace', fontWeight: 600, color: gdpColor }}>{g ? g.gdp.toFixed(2) : '—'}</td>
                      <td style={{ padding: '9px 10px' }}><Badge type={estadoTipo}>{estadoBadge}</Badge></td>
                    </tr>
                  )
                })}
                {corralesActivos.filter(c => c.rol !== 'libre').length === 0 && (
                  <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: S.hint, fontSize: 13 }}>No hay corrales activos.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* GDP Y CONVERSIÓN POR CORRAL */}
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em' }}>GDP y conversión por corral</div>
            <span style={{ fontSize: 11, color: S.muted }}>materia seca estimada</span>
          </div>

          {corralesConGDP.length === 0 ? (
            <div style={{ padding: '2rem 0', textAlign: 'center', color: S.hint, fontSize: 13 }}>
              Sin pesadas registradas aún.<br />
              <span style={{ fontSize: 11 }}>El GDP se calcula automáticamente con las pesadas.</span>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '.5rem' }}>
                Ganancia diaria de peso (kg/día)
              </div>
              {corralesConGDP.map(c => {
                const g = gdpPorCorral[c.numero]
                const maxGDP = Math.max(...corralesConGDP.map(x => gdpPorCorral[x.numero].gdp), 1.5)
                const pct = Math.round(g.gdp / maxGDP * 100)
                const color = g.gdp >= 1.1 ? S.green : g.gdp >= 0.9 ? S.amber : S.red
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: S.muted, minWidth: 70, textAlign: 'right' }}>C-{c.numero}</div>
                    <div style={{ flex: 1, height: 6, background: S.bg, borderRadius: 3, overflow: 'hidden', border: `1px solid ${S.border}` }}>
                      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: color }} />
                    </div>
                    <div style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 600, color, minWidth: 50 }}>{g.gdp.toFixed(2)}</div>
                  </div>
                )
              })}
            </>
          )}

          <div style={{ height: 1, background: S.border, margin: '.75rem 0' }} />
          <div style={{ fontSize: 11, color: S.muted, lineHeight: 1.6 }}>
            <span style={{ display: 'inline-block', width: 10, height: 4, background: S.green, borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} />GDP ≥1,1 kg/d ·{' '}
            <span style={{ display: 'inline-block', width: 10, height: 4, background: S.amber, borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} />0,9–1,1 ·{' '}
            <span style={{ display: 'inline-block', width: 10, height: 4, background: S.red, borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} />&lt;0,9 kg/d
          </div>
        </div>
      </div>

      {/* ALERTAS + MOVIMIENTOS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

        {/* ALERTAS */}
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em' }}>Alertas del día</div>
            {totalAlertas > 0 && <Badge type="warn">{totalAlertas} pendientes</Badge>}
          </div>

          {diasPesada !== null && diasPesada <= 14 && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '.75rem', padding: '.75rem 0', borderBottom: `1px solid ${S.border}` }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: S.amber, marginTop: 5, flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 13 }}>
                <strong>Pesada de clasificación</strong>
                <div style={{ fontSize: 11, fontFamily: 'monospace', color: S.muted, marginTop: 2 }}>
                  En {diasPesada} días · {proximaDate?.toLocaleDateString('es-AR')}
                </div>
              </div>
            </div>
          )}

          {stockBajo.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '.75rem', padding: '.75rem 0', borderBottom: `1px solid ${S.border}` }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: S.amber, marginTop: 5, flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 13 }}>
                <strong>Stock bajo: {s.insumo}</strong>
                <div style={{ fontSize: 11, fontFamily: 'monospace', color: S.muted, marginTop: 2 }}>
                  {s.cantidad_kg?.toLocaleString('es-AR')} kg · mínimo {s.minimo_kg?.toLocaleString('es-AR')} kg
                </div>
              </div>
            </div>
          ))}

          {alertas.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '.75rem', padding: '.75rem 0', borderBottom: `1px solid ${S.border}` }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: S.red, marginTop: 5, flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 13 }}>
                <strong>{a.titulo}</strong>
                <div style={{ fontSize: 11, fontFamily: 'monospace', color: S.muted, marginTop: 2 }}>
                  {a.descripcion}{a.fecha_vence ? ` · Vence ${new Date(a.fecha_vence).toLocaleDateString('es-AR')}` : ''}
                </div>
              </div>
            </div>
          ))}

          {totalAlertas === 0 && (
            <div style={{ padding: '1.5rem 0', textAlign: 'center', color: S.hint, fontSize: 13 }}>
              ✅ Sin alertas pendientes
            </div>
          )}
        </div>

        {/* ÚLTIMOS MOVIMIENTOS */}
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>
            Últimos movimientos
          </div>

          {movRecientes.length === 0 && (
            <div style={{ padding: '1.5rem 0', textAlign: 'center', color: S.hint, fontSize: 13 }}>Sin movimientos recientes.</div>
          )}

          {movRecientes.map((m, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '.75rem', padding: '.75rem 0', borderBottom: i < movRecientes.length - 1 ? `1px solid ${S.border}` : 'none' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, marginTop: 5, flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 13 }}>
                {m.texto}
                <div style={{ fontSize: 11, fontFamily: 'monospace', color: S.muted, marginTop: 2 }}>{m.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function calcPesoProm(pesadaAnimales) {
  if (!pesadaAnimales || pesadaAnimales.length === 0) return null
  const conPeso = pesadaAnimales.filter(p => p.peso_promedio)
  if (conPeso.length === 0) return null
  const totalAnim = conPeso.reduce((s, p) => s + (p.cantidad || 0), 0)
  if (totalAnim === 0) return null
  return conPeso.reduce((s, p) => s + p.peso_promedio * (p.cantidad || 0), 0) / totalAnim
}

export function Card({ children, style = {} }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E2DDD6', borderRadius: 10, padding: '1.25rem', marginBottom: '1rem', ...style }}>
      {children}
    </div>
  )
}

export function Badge({ children, type = 'neutral', style = {} }) {
  const styles = {
    ok:      { background: '#E8F4EB', color: '#1E5C2E' },
    warn:    { background: '#FDF0E0', color: '#7A4500' },
    red:     { background: '#FDF0F0', color: '#7A1A1A' },
    info:    { background: '#E8EFF8', color: '#1A3D6B' },
    neutral: { background: '#F7F5F0', color: '#6B6760', border: '1px solid #E2DDD6' },
  }
  return (
    <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600, ...styles[type], ...style }}>
      {children}
    </span>
  )
}
