import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import { traerTodo } from '../shared/traerTodo'
import { construirLookupsMS, kgMSDeRacion } from '../shared/gdpLogic'

// ─────────────────────────────────────────────────────────────────────────────
// Análisis de consumo (Alimentación → 📈 Consumo)
//
// Con las raciones de los últimos 30 días muestra:
//  1. Alarmas: variaciones grandes de consumo en el feedlot y por corral.
//  2. Consumo por animal por día del feedlot (tal cual y materia seca), con
//     promedio móvil de 7 días.
//  3. Kilos entregados por día y animales comiendo.
//  4. Tabla por corral: consumo de ayer, promedio de 7 días, variación, mini
//     gráfico de los 30 días y aviso si cambió de mixer/dieta.
//
// Todo se calcula por ANIMAL (kg ÷ animales del corral ese día), así un
// ingreso o una venta no se confunden con una variación de consumo.
// ─────────────────────────────────────────────────────────────────────────────

const DIAS = 30
// Umbrales de las alarmas. Cada serie (el feedlot y cada corral) se compara
// contra SU PROPIA variación normal: con los datos reales, un corral varía
// en promedio ±15% de un día al otro (repartos entre corrales, movimientos
// de animales), así que un umbral fijo chico daba alarmas todos los días.
// Atención = 1,5 × su variación normal; alerta = 2,5 × (con estos mínimos):
const MIN_FEEDLOT_ATENCION = 6, MIN_FEEDLOT_ALERTA = 10   // %
const MIN_CORRAL_ATENCION = 15, MIN_CORRAL_ALERTA = 25    // %
// Variación "normal" de una serie: promedio de |valor ÷ promedio de los 7
// días previos − 1| en el período.
function variacionNormal(serie) {
  const desv = []
  serie.forEach((v, i) => {
    if (v == null) return
    const prev = prom(serie.slice(Math.max(0, i - 7), i))
    if (prev) desv.push(Math.abs(v / prev - 1) * 100)
  })
  return desv.length >= 5 ? prom(desv) : null
}
const umbrales = (normal, minAt, minAl) => ({ atencion: Math.max(minAt, 1.5 * (normal || 0)), alerta: Math.max(minAl, 2.5 * (normal || 0)) })
const nivelDe = (v, u) => v == null ? null : Math.abs(v) >= u.alerta ? 'alerta' : Math.abs(v) >= u.atencion ? 'atencion' : 'ok'

const isoLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const diaDe = r => r.fecha || (r.creado_en ? isoLocal(new Date(r.creado_en)) : null)
const fmtDia = iso => { const [, m, d] = iso.split('-'); return `${d}/${m}` }
const prom = arr => { const v = arr.filter(x => x != null && isFinite(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null }
const pct = (a, b) => (a != null && b) ? (a - b) / b * 100 : null
const f1 = n => n == null ? '—' : n.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

// ── Gráfico de líneas simple en SVG (sin librerías) ──────────────────────────
function GraficoLineas({ dias, series, alto = 220, unidad = '', S, barras = null }) {
  const [hover, setHover] = useState(null)
  const W = 760, H = alto, pad = { l: 46, r: 14, t: 14, b: 26 }
  const todos = series.flatMap(s => s.valores).concat(barras ? barras.valores : []).filter(v => v != null && isFinite(v))
  if (!dias.length || !todos.length) return <div style={{ padding: '2rem', textAlign: 'center', color: S.hint, fontSize: 13 }}>Sin datos</div>
  let min = Math.min(...series.flatMap(s => s.valores).filter(v => v != null)), max = Math.max(...todos)
  if (barras) min = 0
  const margen = (max - min) * 0.1 || max * 0.1 || 1
  min = Math.max(0, min - margen); max = max + margen
  const x = i => pad.l + (dias.length === 1 ? (W - pad.l - pad.r) / 2 : i * (W - pad.l - pad.r) / (dias.length - 1))
  const y = v => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => min + t * (max - min))
  const anchoBarra = Math.max(2, (W - pad.l - pad.r) / dias.length * 0.6)
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={e => {
          const r = e.currentTarget.getBoundingClientRect()
          const px = (e.clientX - r.left) / r.width * W
          const i = Math.round((px - pad.l) / ((W - pad.l - pad.r) / Math.max(1, dias.length - 1)))
          setHover(Math.max(0, Math.min(dias.length - 1, i)))
        }}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={S.border} strokeWidth="1" />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill={S.hint}>{t >= 100 ? Math.round(t).toLocaleString('es-AR') : t.toFixed(1)}</text>
          </g>
        ))}
        {dias.map((d, i) => (i % Math.ceil(dias.length / 10) === 0 || i === dias.length - 1) && (
          <text key={d} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill={S.hint}>{fmtDia(d)}</text>
        ))}
        {barras && barras.valores.map((v, i) => v != null && (
          <rect key={i} x={x(i) - anchoBarra / 2} y={y(v)} width={anchoBarra} height={Math.max(0, y(min) - y(v))} fill={barras.color} opacity="0.35" />
        ))}
        {series.map(s => {
          const pts = s.valores.map((v, i) => v != null ? `${x(i)},${y(v)}` : null)
          const tramos = []; let actual = []
          pts.forEach(p => { if (p) actual.push(p); else if (actual.length) { tramos.push(actual); actual = [] } })
          if (actual.length) tramos.push(actual)
          return (
            <g key={s.nombre}>
              {tramos.map((t, k) => <polyline key={k} points={t.join(' ')} fill="none" stroke={s.color} strokeWidth={s.grosor || 2} strokeDasharray={s.punteada ? '5 4' : undefined} />)}
              {!s.punteada && s.valores.map((v, i) => v != null && s.marcas?.[i] && <circle key={i} cx={x(i)} cy={y(v)} r="4.5" fill={s.marcas[i]} stroke="#fff" strokeWidth="1.5" />)}
            </g>
          )
        })}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke={S.muted} strokeDasharray="3 3" />}
      </svg>
      {hover != null && (
        <div style={{ position: 'absolute', top: 6, left: `${Math.min(70, Math.max(8, x(hover) / W * 100))}%`, background: '#fff', border: `1px solid ${S.border}`, borderRadius: 6, padding: '6px 9px', fontSize: 11, boxShadow: '0 3px 10px rgba(0,0,0,.1)', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{fmtDia(dias[hover])}</div>
          {barras && <div style={{ color: S.muted }}>{barras.nombre}: <b>{barras.valores[hover] != null ? Math.round(barras.valores[hover]).toLocaleString('es-AR') : '—'}</b></div>}
          {series.map(s => <div key={s.nombre} style={{ color: s.color }}>{s.nombre}: <b>{s.valores[hover] != null ? `${f1(s.valores[hover])}${unidad}` : '—'}</b></div>)}
        </div>
      )}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6, fontSize: 11, color: S.muted }}>
        {barras && <span><span style={{ display: 'inline-block', width: 10, height: 10, background: barras.color, opacity: 0.35, marginRight: 4 }} />{barras.nombre}</span>}
        {series.map(s => <span key={s.nombre}><span style={{ display: 'inline-block', width: 14, height: 0, borderTop: `2px ${s.punteada ? 'dashed' : 'solid'} ${s.color}`, marginRight: 4, verticalAlign: 'middle' }} />{s.nombre}</span>)}
      </div>
    </div>
  )
}

function MiniGrafico({ valores, color, S }) {
  const v = valores.filter(x => x != null)
  if (v.length < 2) return <span style={{ color: S.hint, fontSize: 11 }}>—</span>
  const W = 120, H = 28, min = Math.min(...v), max = Math.max(...v), rango = max - min || 1
  const pts = valores.map((x, i) => x != null ? `${i * W / (valores.length - 1)},${H - 3 - (x - min) / rango * (H - 6)}` : null).filter(Boolean)
  return <svg width={W} height={H}><polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5" /></svg>
}

export default function AnalisisConsumo({ S }) {
  const [cargando, setCargando] = useState(true)
  const [raciones, setRaciones] = useState([])
  const [corrales, setCorrales] = useState([])
  const [lookups, setLookups] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    (async () => {
      const desde = new Date(); desde.setDate(desde.getDate() - (DIAS + 10))
      const [r, { data: c }, { data: st }, { data: fm }] = await Promise.all([
        traerTodo(() => supabase.from('raciones_app').select('id, corral_id, kg_total, kg_rollo_extra, solo_rollo, mezclador, tipo_dieta, cantidad_animales, fecha, creado_en, corrales(numero, animales, rol)').gte('creado_en', desde.toISOString()).order('creado_en').order('id')),
        supabase.from('corrales').select('id, numero, animales, rol').order('numero'),
        supabase.from('stock_insumos').select('insumo, pct_ms'),
        supabase.from('formulas_mixer').select('dieta, etapa, ingrediente, kg'),
      ])
      if (r.error) setError(r.error.message)
      setRaciones(r.data || [])
      setCorrales(c || [])
      setLookups(construirLookupsMS(st || [], fm || []))
      setCargando(false)
    })()
  }, [])

  const datos = useMemo(() => {
    if (!lookups) return null
    // ── Por corral y por día ──
    const porCorralDia = {} // corral_id → dia → { kg, ms, animales, mezcladores:Set, dietas:Set }
    const numeroPorCorral = {}
    raciones.forEach(r => {
      if (r.corral_id && r.corrales?.numero != null) numeroPorCorral[r.corral_id] = r.corrales.numero
      const dia = diaDe(r)
      if (!dia || !r.corral_id) return
      const c = (porCorralDia[r.corral_id] ||= {})
      const d = (c[dia] ||= { kg: 0, ms: 0, animales: 0, mezcladores: new Set(), dietas: new Set() })
      d.kg += r.kg_total || 0
      d.ms += kgMSDeRacion(r, lookups)
      const anim = (r.cantidad_animales ?? r.corrales?.animales) || 0
      d.animales = Math.max(d.animales, anim) // varias raciones del mismo corral el mismo día = mismos animales
      if (r.mezclador) d.mezcladores.add(r.mezclador)
      d.dietas.add(r.tipo_dieta || 'seco')
    })
    // Días del período con datos
    const todosLosDias = [...new Set(Object.values(porCorralDia).flatMap(c => Object.keys(c)))].sort()
    const hoy = isoLocal(new Date())
    const limite = isoLocal(new Date(Date.now() - DIAS * 86400000))
    const dias = todosLosDias.filter(d => d > limite && d <= hoy)

    // ── Feedlot por día ──
    const feedlot = dias.map(dia => {
      let kg = 0, ms = 0, animales = 0, corralesN = 0
      Object.values(porCorralDia).forEach(c => { const d = c[dia]; if (d && d.animales > 0) { kg += d.kg; ms += d.ms; animales += d.animales; corralesN++ } })
      return { dia, kg, ms, animales, corrales: corralesN, kgAnim: animales ? kg / animales : null, msAnim: animales ? ms / animales : null }
    })
    // Un día "incompleto" (todavía no se cargaron todos los corrales, típico
    // de hoy a la mañana) no entra en las alarmas.
    const medianaCorrales = [...feedlot.map(f => f.corrales)].sort((a, b) => a - b)[Math.floor(feedlot.length / 2)] || 0
    feedlot.forEach(f => { f.completo = f.corrales >= medianaCorrales * 0.8 })
    const completos = feedlot.filter(f => f.completo)
    const movil7 = feedlot.map((f, i) => prom(feedlot.slice(Math.max(0, i - 6), i + 1).filter(x => x.completo).map(x => x.kgAnim)))
    const movil7MS = feedlot.map((f, i) => prom(feedlot.slice(Math.max(0, i - 6), i + 1).filter(x => x.completo).map(x => x.msAnim)))

    // Alarma del feedlot: último día completo vs promedio de los 7 días previos
    const ult = completos[completos.length - 1]
    const previos7 = completos.slice(-8, -1)
    const varFeedlot = ult ? pct(ult.kgAnim, prom(previos7.map(x => x.kgAnim))) : null
    const normalFeedlot = variacionNormal(feedlot.map(f => f.completo ? f.kgAnim : null))
    const umbralFeedlot = umbrales(normalFeedlot, MIN_FEEDLOT_ATENCION, MIN_FEEDLOT_ALERTA)
    const nivelFeedlot = nivelDe(varFeedlot, umbralFeedlot)
    const marcasFeedlot = feedlot.map((f, i) => {
      if (!f.completo) return null
      const prev = prom(feedlot.slice(Math.max(0, i - 7), i).filter(x => x.completo).map(x => x.kgAnim))
      const n = nivelDe(pct(f.kgAnim, prev), umbralFeedlot)
      return n === 'alerta' ? S.red : n === 'atencion' ? '#C27A1A' : null
    })

    // ── Corrales ──
    const diaRef = ult?.dia
    const filasCorrales = Object.entries(porCorralDia).map(([cid, porDia]) => {
      const info = corrales.find(c => String(c.id) === String(cid)) || {}
      const serie = dias.map(d => porDia[d] && porDia[d].animales > 0 ? porDia[d].kg / porDia[d].animales : null)
      const diasCorral = dias.filter(d => porDia[d]?.animales > 0)
      const ultimoDia = diaRef && porDia[diaRef]?.animales > 0 ? diaRef : null
      const idxRef = ultimoDia ? dias.indexOf(ultimoDia) : -1
      const actual = idxRef >= 0 ? serie[idxRef] : null
      const prev7 = idxRef >= 0 ? prom(serie.slice(Math.max(0, idxRef - 7), idxRef)) : null
      const ult3 = idxRef >= 0 ? prom(serie.slice(Math.max(0, idxRef - 2), idxRef + 1)) : null
      const prev7de3 = idxRef >= 0 ? prom(serie.slice(Math.max(0, idxRef - 9), Math.max(0, idxRef - 2))) : null
      const varDia = pct(actual, prev7)
      const varTend = pct(ult3, prev7de3)
      // ¿Cambió de mixer o de dieta en los últimos 7 días? (explica variaciones)
      const ult7 = diasCorral.slice(-7).map(d => porDia[d])
      const mezcladores = new Set(ult7.flatMap(d => [...d.mezcladores]))
      const dietas = new Set(ult7.flatMap(d => [...d.dietas]))
      const cambio = mezcladores.size > 1 ? 'cambió de mixer' : dietas.size > 1 ? 'cambió de dieta' : null
      const normal = variacionNormal(serie)
      const umbral = umbrales(normal, MIN_CORRAL_ATENCION, MIN_CORRAL_ALERTA)
      const peor = Math.max(Math.abs(varDia ?? 0), Math.abs(varTend ?? 0))
      // Corral con animales hoy, que venía comiendo la última semana y el
      // último día completo no tiene ración cargada.
      const sinRacion = !!diaRef && !porDia[diaRef] && (info.animales || 0) > 0 && info.rol !== 'libre' && diasCorral.length > 0 && diasCorral[diasCorral.length - 1] >= (dias[dias.length - 8] || '')
      const nivel = sinRacion ? 'alerta' : nivelDe(peor, umbral) || 'ok'
      return {
        cid, numero: info.numero ?? numeroPorCorral[cid], rol: info.rol,
        animales: ultimoDia ? porDia[ultimoDia].animales : (info.animales || 0),
        serie, actual, prev7, varDia, varTend, cambio, nivel, sinRacion, normal, umbral,
        mezclador: ultimoDia ? [...porDia[ultimoDia].mezcladores].join(', ') : '',
      }
    }).filter(f => f.serie.some(v => v != null))
      .sort((a, b) => ({ alerta: 0, atencion: 1, ok: 2 }[a.nivel] - { alerta: 0, atencion: 1, ok: 2 }[b.nivel]) || (a.numero || 0) - (b.numero || 0))

    return { dias, feedlot, movil7, movil7MS, marcasFeedlot, ult, varFeedlot, nivelFeedlot, umbralFeedlot, normalFeedlot, filasCorrales, diaRef }
  }, [raciones, corrales, lookups, S])

  if (cargando) return <div style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>Cargando consumo…</div>
  if (error) return <div style={{ padding: '1rem', color: S.red }}>No se pudieron cargar las raciones: {error}</div>
  if (!datos || !datos.dias.length) return <div style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay raciones cargadas en los últimos {DIAS} días.</div>

  const { dias, feedlot, movil7, movil7MS, marcasFeedlot, ult, varFeedlot, nivelFeedlot, umbralFeedlot, normalFeedlot, filasCorrales, diaRef } = datos
  const alertas = filasCorrales.filter(f => f.nivel !== 'ok')
  const colorNivel = n => n === 'alerta' ? S.red : n === 'atencion' ? '#C27A1A' : S.green
  const fondoNivel = n => n === 'alerta' ? S.redLight : n === 'atencion' ? S.amberLight : S.greenLight
  const tarjeta = { background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.1rem 1.25rem', marginBottom: '1.25rem' }
  const titulo = { fontSize: 14, fontWeight: 700, marginBottom: 2 }
  const sub = { fontSize: 12, color: S.muted, marginBottom: 12 }
  const signo = v => v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
  const colorVar = (v, u) => { const n = nivelDe(v, u); return n === 'alerta' ? S.red : n === 'atencion' ? '#C27A1A' : S.muted }

  return (
    <div>
      {/* ── 1. Alarmas ── */}
      <div style={{ ...tarjeta, borderLeft: `4px solid ${colorNivel(alertas.some(a => a.nivel === 'alerta') || nivelFeedlot === 'alerta' ? 'alerta' : alertas.length || nivelFeedlot === 'atencion' ? 'atencion' : 'ok')}` }}>
        <div style={titulo}>🔔 Alarmas de consumo {diaRef ? `· ${fmtDia(diaRef)}` : ''}</div>
        <div style={sub}>Consumo por animal del último día completo contra el promedio de los 7 días anteriores (y la tendencia de los últimos 3 días). Cada corral se compara con <b>su propia variación normal</b>: avisa cuando se mueve bastante más de lo que suele moverse. Feedlot: varía normalmente ±{f1(normalFeedlot)}% → atención desde ±{Math.round(umbralFeedlot.atencion)}%, alerta desde ±{Math.round(umbralFeedlot.alerta)}%.</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ padding: '10px 14px', borderRadius: 8, background: fondoNivel(nivelFeedlot), minWidth: 220 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase' }}>Feedlot</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: colorNivel(nivelFeedlot) }}>{signo(varFeedlot)}</div>
            <div style={{ fontSize: 11, color: S.muted }}>{ult ? `${f1(ult.kgAnim)} kg/animal · ${f1(ult.msAnim)} kg MS` : ''}</div>
          </div>
          {alertas.length === 0 && <div style={{ padding: '10px 14px', fontSize: 13, color: S.green, alignSelf: 'center' }}>✓ Ningún corral con variaciones fuera de lo normal.</div>}
          {alertas.map(a => (
            <div key={a.cid} style={{ padding: '10px 14px', borderRadius: 8, background: fondoNivel(a.nivel), minWidth: 190 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase' }}>Corral {a.numero} · {a.animales} anim.</div>
              {a.sinRacion
                ? <div style={{ fontSize: 14, fontWeight: 700, color: S.red }}>Sin ración cargada</div>
                : <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: colorNivel(a.nivel) }}>{signo(Math.abs(a.varDia ?? 0) >= Math.abs(a.varTend ?? 0) ? a.varDia : a.varTend)}</div>}
              <div style={{ fontSize: 11, color: S.muted }}>
                {a.sinRacion ? 'el último día no tiene ración' : `${f1(a.actual)} vs ${f1(a.prev7)} kg/animal`}{a.cambio ? ` · ${a.cambio}` : ''}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 2. Consumo por animal del feedlot ── */}
      <div style={tarjeta}>
        <div style={titulo}>Consumo por animal por día — feedlot</div>
        <div style={sub}>Kilos entregados ÷ animales comiendo, últimos {DIAS} días. Los puntos rojos/naranjas son días con variación grande. Pasá el mouse para ver cada día.</div>
        <GraficoLineas S={S} dias={dias} unidad=" kg" series={[
          { nombre: 'Tal cual (kg/animal)', color: S.accent, valores: feedlot.map(f => f.kgAnim), marcas: marcasFeedlot },
          { nombre: 'Promedio 7 días', color: S.accent, valores: movil7, punteada: true, grosor: 1.5 },
          { nombre: 'Materia seca (kg MS/animal)', color: S.green, valores: feedlot.map(f => f.msAnim) },
          { nombre: 'MS promedio 7 días', color: S.green, valores: movil7MS, punteada: true, grosor: 1.5 },
        ]} />
      </div>

      {/* ── 3. Kilos entregados y animales ── */}
      <div style={tarjeta}>
        <div style={titulo}>Kilos entregados por día y animales comiendo</div>
        <div style={sub}>Barras: kg totales entregados (tal cual). Línea: animales comiendo. Si los kilos bajan junto con los animales es por ventas o movimientos; si bajan solos, es consumo.</div>
        <GraficoLineas S={S} dias={dias} alto={200}
          barras={{ nombre: 'Kg entregados', color: S.accent, valores: feedlot.map(f => f.kg) }}
          series={[{ nombre: 'Animales comiendo ×10', color: '#B5651D', valores: feedlot.map(f => f.animales * 10) }]} />
        <div style={{ fontSize: 11, color: S.hint, marginTop: 4 }}>Los animales se muestran multiplicados por 10 para que entren en la misma escala que los kilos.</div>
      </div>

      {/* ── 4. Por corral ── */}
      <div style={tarjeta}>
        <div style={titulo}>Consumo por corral</div>
        <div style={sub}>Kg por animal del último día completo, promedio de los 7 días anteriores, variación y evolución de los últimos {DIAS} días. Primero los corrales con alarma.</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: S.bg }}>
                {['Corral', 'Animales', 'Mixer', 'Último día', 'Prom. 7 días', 'Variación', 'Tendencia 3d', 'Varía normal', '30 días', ''].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Corral' || h === 'Mixer' || h === '' || h === '30 días' ? 'left' : 'right', fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filasCorrales.map(f => (
                <tr key={f.cid} style={{ borderBottom: `1px solid ${S.border}`, background: f.nivel === 'ok' ? 'transparent' : fondoNivel(f.nivel) }}>
                  <td style={{ padding: '7px 10px', fontWeight: 700 }}>C-{f.numero}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{f.animales}</td>
                  <td style={{ padding: '7px 10px', color: S.muted }}>{f.mezclador || '—'}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{f.sinRacion ? <span style={{ color: S.red }}>sin ración</span> : f1(f.actual)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', color: S.muted }}>{f1(f.prev7)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: colorVar(f.varDia, f.umbral) }}>{signo(f.varDia)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', color: colorVar(f.varTend, f.umbral) }}>{signo(f.varTend)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', color: S.hint }}>{f.normal != null ? `±${Math.round(f.normal)}%` : '—'}</td>
                  <td style={{ padding: '4px 10px' }}><MiniGrafico S={S} valores={f.serie} color={colorNivel(f.nivel)} /></td>
                  <td style={{ padding: '7px 10px', fontSize: 11, color: S.muted, whiteSpace: 'nowrap' }}>{f.cambio || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
