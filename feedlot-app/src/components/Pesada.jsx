import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Loader } from './Tablero'

const S = {
  bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6', borderStrong: '#C8C2B8',
  text: '#1A1916', muted: '#6B6760', hint: '#9E9A94',
  accent: '#1A3D6B', accentLight: '#E8EFF8',
  green: '#1E5C2E', greenLight: '#E8F4EB',
  amber: '#7A4500', amberLight: '#FDF0E0',
  red: '#7A1A1A', redLight: '#FDF0F0',
  purple: '#3D1A6B', purpleLight: '#F0EAFB',
}

const RANGOS = [
  { min: 200, max: 230, letra: 'A', label: '200–230 kg', color: S.green,   bg: S.greenLight },
  { min: 231, max: 260, letra: 'B', label: '231–260 kg', color: S.accent,  bg: S.accentLight },
  { min: 261, max: 290, letra: 'C', label: '261–290 kg', color: S.purple,  bg: S.purpleLight },
  { min: 291, max: 320, letra: 'D', label: '291–320 kg', color: S.amber,   bg: S.amberLight },
  { min: 321, max: 350, letra: 'E', label: '321–350 kg', color: '#5A2A00', bg: '#FDE8D0' },
  { min: 351, max: 380, letra: 'F', label: '351–380 kg', color: S.red,     bg: S.redLight },
  { min: 381, max: 999, letra: 'G', label: '381+ kg',    color: '#2C2C2A', bg: '#E8E8E4' },
]

const ORDEN_RANGOS = ['A','B','C','D','E','F','G']

const RANGO_COLORS = {
  A: { color: S.green,   bg: S.greenLight },
  B: { color: S.accent,  bg: S.accentLight },
  C: { color: S.purple,  bg: S.purpleLight },
  D: { color: S.amber,   bg: S.amberLight },
  E: { color: '#5A2A00', bg: '#FDE8D0' },
  F: { color: S.red,     bg: S.redLight },
  G: { color: '#2C2C2A', bg: '#E8E8E4' },
}

function getRango(kg) {
  for (const r of RANGOS) if (kg >= r.min && kg <= r.max) return r
  return null
}

function subirRango(letra, n = 2) {
  const idx = ORDEN_RANGOS.indexOf(letra)
  if (idx === -1) return letra
  return ORDEN_RANGOS[Math.min(idx + n, ORDEN_RANGOS.length - 1)]
}

function bajarRango(letra, n = 2) {
  const idx = ORDEN_RANGOS.indexOf(letra)
  if (idx === -1) return letra
  return ORDEN_RANGOS[Math.max(idx - n, 0)]
}

function calcDiasParaVenta(pesoActual, gdp = 1.2) {
  if (pesoActual >= 400) return 0
  return Math.ceil((400 - pesoActual) / gdp)
}

export default function Pesada({ usuario }) {
  const [vista, setVista] = useState('historial')
  const [paso, setPaso] = useState(1)
  const [loading, setLoading] = useState(true)
  const [corrales, setCorrales] = useState([])
  const [pesadasHist, setPesadasHist] = useState([])
  const [proximaPesada, setProximaPesada] = useState(null)
  const [pesos, setPesos] = useState(Array(20).fill(''))
  const [filasExtra, setFilasExtra] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [pesadaConfirmada, setPesadaConfirmada] = useState(null)
  const [corralLibre1, setCorralLibre1] = useState('')
  const [corralLibre2, setCorralLibre2] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: c }, { data: p }, { data: cfg }] = await Promise.all([
      supabase.from('corrales').select('*').order('numero'),
      supabase.from('pesadas').select('*, corrales(numero), pesada_animales(rango, cantidad, peso_promedio)').order('creado_en', { ascending: false }).limit(20),
      supabase.from('configuracion').select('valor').eq('clave', 'proxima_pesada').single(),
    ])
    setCorrales(c || [])
    setPesadasHist(p || [])
    setProximaPesada(cfg?.valor || null)
    setLoading(false)
  }

  const totalFilas = 20 + filasExtra
  const pesosValidos = pesos.filter(p => p && parseInt(p) >= 100 && parseInt(p) <= 700).map(p => parseInt(p))
  const menores = pesosValidos.filter(p => p < 200)
  const clasificables = pesosValidos.filter(p => p >= 200)

  const conteoRangos = {}
  RANGOS.forEach(r => { conteoRangos[r.letra] = [] })
  clasificables.forEach(p => { const r = getRango(p); if (r) conteoRangos[r.letra].push(p) })

  const promClasif = clasificables.length ? Math.round(clasificables.reduce((a, b) => a + b, 0) / clasificables.length) : 0

  const corralAcum = corrales.find(c => c.rol === 'acumulacion')
  const corralesLibres = corrales.filter(c => c.rol === 'libre')
  const corralesClasificados = corrales.filter(c => c.rol === 'clasificado')

  const proximaDate = proximaPesada ? new Date(proximaPesada + 'T12:00:00') : null
  const diasRestantes = proximaDate ? Math.ceil((proximaDate - new Date()) / (1000 * 60 * 60 * 24)) : null

  async function confirmarPesada() {
    if (!corralLibre1 || !corralLibre2) { alert('Seleccioná dos corrales libres para los nuevos rangos A y B.'); return }
    if (corralLibre1 === corralLibre2) { alert('Los corrales para A y B deben ser diferentes.'); return }
    if (clasificables.length === 0) { alert('No hay animales pesados.'); return }
    setGuardando(true)

    // 1. Registrar pesada
    const { data: pesada, error } = await supabase.from('pesadas').insert({
      corral_id: corralAcum?.id || null,
      tipo: 'clasificacion',
      registrado_por: usuario?.id,
    }).select().single()
    if (error || !pesada) { alert('Error al guardar la pesada.'); setGuardando(false); return }

    // 2. Insertar pesada_animales
    const animalesInsert = []
    Object.entries(conteoRangos).forEach(([rango, arr]) => {
      if (arr.length > 0) animalesInsert.push({
        pesada_id: pesada.id, rango, cantidad: arr.length,
        peso_promedio: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length),
      })
    })
    if (menores.length > 0) animalesInsert.push({
      pesada_id: pesada.id, rango: 'menores', cantidad: menores.length,
      peso_promedio: Math.round(menores.reduce((a, b) => a + b, 0) / menores.length),
    })
    if (animalesInsert.length > 0) await supabase.from('pesada_animales').insert(animalesInsert)

    // 3. Snapshot ANTES de modificar nada — mapa rangoActual → corral completo
    // Normalizar sub a solo la letra (A, B, C...)
    const mapaRangoCorral = {}
    corralesClasificados.forEach(c => {
      const letra = c.sub && c.sub.length === 1 ? c.sub : c.sub?.charAt(0)
      if (letra) mapaRangoCorral[letra] = { ...c, sub: letra }
    })

    // 4. Registrar movimientos para poder revertir
    const movimientos = []

    // Origen: acumulación pierde animales clasificables
    if (corralAcum) {
      movimientos.push({
        pesada_id: pesada.id,
        corral_id: corralAcum.id,
        tipo: 'origen_acum',
        animales: clasificables.length,
        rango_antes: null,
        rango_despues: null,
      })
    }

    // Corrales existentes suben de rango — guardamos solo la letra
    corralesClasificados.forEach(c => {
      const letraAntes = (c.sub || 'A').length === 1 ? c.sub : c.sub?.charAt(0) || 'A'
      movimientos.push({
        pesada_id: pesada.id,
        corral_id: c.id,
        tipo: 'subida_rango',
        animales: c.animales || 0,
        rango_antes: letraAntes,
        rango_despues: subirRango(letraAntes, 2),
      })
    })

    // Nuevos corrales A y B
    const cantA = conteoRangos['A'].length
    const cantB = conteoRangos['B'].length
    if (cantA > 0) movimientos.push({ pesada_id: pesada.id, corral_id: parseInt(corralLibre1), tipo: 'nuevo_clasificado', animales: cantA, rango_antes: 'libre', rango_despues: 'A' })
    if (cantB > 0) movimientos.push({ pesada_id: pesada.id, corral_id: parseInt(corralLibre2), tipo: 'nuevo_clasificado', animales: cantB, rango_antes: 'libre', rango_despues: 'B' })

    // Animales C-G que se suman a corrales existentes
    const mapeoDestino = { C: 'A', D: 'B', E: 'C', F: 'D', G: 'E' }
    Object.entries(mapeoDestino).forEach(([letraNueva, letraAnterior]) => {
      const cant = conteoRangos[letraNueva].length
      if (cant === 0) return
      const corralDest = mapaRangoCorral[letraAnterior]
      if (corralDest) movimientos.push({
        pesada_id: pesada.id,
        corral_id: corralDest.id,
        tipo: 'suma_existente',
        animales: cant,
        rango_antes: letraAnterior,
        rango_despues: letraNueva,
      })
      else console.warn(`No se encontró corral para rango anterior ${letraAnterior} (nuevo ${letraNueva}). Mapa:`, mapaRangoCorral)
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

    // 7. Sumar animales C-G a corrales que ERAN A-E (usando snapshot previo)
    // Lee siempre fresco desde la BD para evitar valores stale
    for (const [letraNueva, letraAnterior] of Object.entries(mapeoDestino)) {
      const cant = conteoRangos[letraNueva].length
      if (cant === 0) continue
      const corralDest = mapaRangoCorral[letraAnterior]
      if (!corralDest) continue
      const { data: corralFresh } = await supabase.from('corrales').select('animales').eq('id', corralDest.id).single()
      await supabase.from('corrales').update({ animales: (corralFresh?.animales || 0) + cant }).eq('id', corralDest.id)
    }

    // 8. Descontar animales de acumulación
    if (corralAcum) {
      const { data: acumActual } = await supabase.from('corrales').select('animales').eq('id', corralAcum.id).single()
      await supabase.from('corrales').update({
        animales: Math.max(0, (acumActual?.animales || 0) - clasificables.length),
      }).eq('id', corralAcum.id)
    }

    // 9. Actualizar próxima pesada +40 días
    const nuevaProxima = new Date()
    nuevaProxima.setDate(nuevaProxima.getDate() + 40)
    await supabase.from('configuracion').update({ valor: nuevaProxima.toISOString().split('T')[0] }).eq('clave', 'proxima_pesada')

    setPesadaConfirmada({
      clasificables: clasificables.length,
      menores: menores.length,
      promClasif,
      conteoRangos,
      corralA: corralesLibres.find(c => String(c.id) === String(corralLibre1)),
      corralB: corralesLibres.find(c => String(c.id) === String(corralLibre2)),
    })
    await cargar()
    setPaso(4)
    setGuardando(false)
  }

  async function eliminarPesada(pesadaId) {
    if (!confirm('¿Eliminar esta pesada y revertir todos los movimientos? Esta acción no se puede deshacer.')) return

    // 1. Cargar movimientos registrados
    const { data: movs } = await supabase.from('pesada_movimientos').select('*').eq('pesada_id', pesadaId)
    if (!movs || movs.length === 0) {
      // Si no hay movimientos registrados, solo borrar el registro
      await supabase.from('pesadas').delete().eq('id', pesadaId)
      await cargar()
      return
    }

    // 2. Revertir en orden inverso
    // a) Revertir sumas en corrales existentes (suma_existente)
    const sumas = movs.filter(m => m.tipo === 'suma_existente')
    for (const m of sumas) {
      const { data: c } = await supabase.from('corrales').select('animales').eq('id', m.corral_id).single()
      await supabase.from('corrales').update({ animales: Math.max(0, (c?.animales || 0) - m.animales) }).eq('id', m.corral_id)
    }

    // b) Revertir corrales nuevos A y B → vuelven a libre
    const nuevos = movs.filter(m => m.tipo === 'nuevo_clasificado')
    for (const m of nuevos) {
      await supabase.from('corrales').update({ rol: 'libre', sub: null, animales: 0 }).eq('id', m.corral_id)
    }

    // c) Bajar 2 rangos a corrales que subieron
    const subidas = movs.filter(m => m.tipo === 'subida_rango')
    for (const m of subidas) {
      await supabase.from('corrales').update({ sub: m.rango_antes }).eq('id', m.corral_id)
    }

    // d) Devolver animales a acumulación
    const origen = movs.find(m => m.tipo === 'origen_acum')
    if (origen) {
      const { data: acum } = await supabase.from('corrales').select('animales').eq('id', origen.corral_id).single()
      await supabase.from('corrales').update({ animales: (acum?.animales || 0) + origen.animales }).eq('id', origen.corral_id)
    }

    // e) Borrar la pesada (cascade borra pesada_animales y pesada_movimientos)
    await supabase.from('pesadas').delete().eq('id', pesadaId)
    await cargar()
    alert('Pesada eliminada y movimientos revertidos.')
  }

  function iniciarNuevaPesada() {
    setPesos(Array(20).fill(''))
    setFilasExtra(0)
    setCorralLibre1('')
    setCorralLibre2('')
    setPaso(1)
    setPesadaConfirmada(null)
    setVista('pesada-activa')
  }

  if (loading) return <Loader />

  // ── HISTORIAL ──
  if (vista === 'historial') {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Pesada y clasificación</div>
            <div style={{ fontSize: 13, color: S.muted, fontFamily: 'monospace' }}>
              Próxima pesada fija · {proximaDate ? proximaDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'no configurada'}
            </div>
          </div>
        </div>

        {diasRestantes !== null && (
          <div style={{ background: S.accent, borderRadius: 10, padding: '1.25rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div>
                <div style={{ fontFamily: 'monospace', fontSize: 40, fontWeight: 500, color: '#fff', lineHeight: 1 }}>{diasRestantes}</div>
                <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>días para pesada</div>
              </div>
              <div style={{ width: 1, height: 48, background: 'rgba(255,255,255,.15)' }} />
              <div style={{ color: 'rgba(255,255,255,.8)', fontSize: 13 }}>
                <strong style={{ color: '#fff' }}>Corral de acumulación</strong><br />
                <span>{corralAcum ? `${corralAcum.animales || 0} animales · C-${corralAcum.numero}` : 'Sin corral de acumulación'}</span>
              </div>
              <div style={{ width: 1, height: 48, background: 'rgba(255,255,255,.15)' }} />
              <div style={{ color: 'rgba(255,255,255,.8)', fontSize: 13 }}>
                <strong style={{ color: '#fff' }}>Corrales clasificados</strong><br />
                <span>{corralesClasificados.length} corrales · {corralesClasificados.reduce((s, c) => s + (c.animales || 0), 0)} animales</span>
              </div>
              <div style={{ width: 1, height: 48, background: 'rgba(255,255,255,.15)' }} />
              <div style={{ color: 'rgba(255,255,255,.8)', fontSize: 13 }}>
                <strong style={{ color: '#fff' }}>Corrales libres</strong><br />
                <span>{corralesLibres.length} disponibles</span>
              </div>
            </div>
            <button onClick={iniciarNuevaPesada}
              style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, background: '#fff', border: '1px solid #fff', color: S.accent, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
              Iniciar pesada ahora ↗
            </button>
          </div>
        )}

        {/* Estado corrales clasificados */}
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '1rem' }}>Estado actual de corrales</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {corralesClasificados.sort((a, b) => (a.sub || 'A').localeCompare(b.sub || 'A')).map(c => {
              const rc = RANGO_COLORS[c.sub] || RANGO_COLORS['A']
              return (
                <div key={c.id} style={{ border: `1px solid ${rc.color}`, borderRadius: 8, padding: '.75rem', background: rc.bg }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: rc.color }}>Rango {c.sub || '—'}</span>
                    <span style={{ fontSize: 11, color: rc.color, fontFamily: 'monospace' }}>C-{c.numero}</span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: S.text }}>{c.animales || 0}</div>
                  <div style={{ fontSize: 11, color: S.muted }}>animales</div>
                </div>
              )
            })}
            {corralesClasificados.length === 0 && (
              <div style={{ gridColumn: '1/-1', padding: '1rem', color: S.hint, fontSize: 13 }}>No hay corrales clasificados.</div>
            )}
          </div>
        </div>

        {/* Métricas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
          {[
            { label: 'En acumulación', val: corralAcum?.animales || 0, sub: corralAcum ? `C-${corralAcum.numero}` : '—' },
            { label: 'Próxima pesada', val: diasRestantes !== null ? `${diasRestantes}d` : '—', sub: proximaDate?.toLocaleDateString('es-AR') || '—', color: diasRestantes !== null && diasRestantes <= 7 ? S.amber : S.green },
            { label: 'Pesadas realizadas', val: pesadasHist.length, sub: 'historial total' },
            { label: 'Corrales libres', val: corralesLibres.length, sub: 'disponibles para A y B', color: corralesLibres.length >= 2 ? S.green : S.red },
          ].map((m, i) => (
            <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem' }}>
              <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{m.label}</div>
              <div style={{ fontSize: 24, fontWeight: 600, fontFamily: 'monospace', lineHeight: 1, color: m.color || S.text }}>{m.val}</div>
              <div style={{ fontSize: 11, color: S.hint, marginTop: 4 }}>{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Historial */}
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Pesadas anteriores</div>
            <button onClick={iniciarNuevaPesada}
              style={{ padding: '5px 10px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
              + Registrar pesada ↗
            </button>
          </div>
          <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: S.bg }}>
                  {['Fecha', 'Corral', 'Pesados', 'Prom.', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'Menores', ''].map(h => (
                    <th key={h} style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pesadasHist.length === 0 && (
                  <tr><td colSpan={13} style={{ padding: '2rem', textAlign: 'center', color: S.hint, fontSize: 13 }}>No hay pesadas registradas.</td></tr>
                )}
                {pesadasHist.map(p => {
                  const totalAnim = p.pesada_animales?.filter(pa => pa.rango !== 'menores').reduce((s, pa) => s + (pa.cantidad || 0), 0) || 0
                  const promPeso = (() => {
                    const con = p.pesada_animales?.filter(pa => pa.rango !== 'menores' && pa.peso_promedio) || []
                    const tot = con.reduce((s, pa) => s + (pa.cantidad || 0), 0)
                    if (!tot) return null
                    return Math.round(con.reduce((s, pa) => s + pa.peso_promedio * (pa.cantidad || 0), 0) / tot)
                  })()
                  const rangoBadge = (letra) => {
                    const pa = p.pesada_animales?.find(x => x.rango === letra)
                    if (!pa || !pa.cantidad) return <span style={{ color: S.hint, fontSize: 11 }}>—</span>
                    const rc = RANGO_COLORS[letra] || {}
                    return <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: rc.bg, color: rc.color }}>{pa.cantidad}</span>
                  }
                  const menoresPa = p.pesada_animales?.find(x => x.rango === 'menores')
                  return (
                    <tr key={p.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(p.creado_en).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                      <td style={{ padding: '10px' }}>C-{p.corrales?.numero || '—'}</td>
                      <td style={{ padding: '10px', fontFamily: 'monospace' }}>{totalAnim}</td>
                      <td style={{ padding: '10px', fontFamily: 'monospace' }}>{promPeso ? promPeso + ' kg' : '—'}</td>
                      {['A','B','C','D','E','F','G'].map(l => <td key={l} style={{ padding: '10px' }}>{rangoBadge(l)}</td>)}
                      <td style={{ padding: '10px' }}>
                        {menoresPa?.cantidad
                          ? <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: S.amberLight, color: S.amber }}>{menoresPa.cantidad}</span>
                          : <span style={{ color: S.hint, fontSize: 11 }}>—</span>}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <button onClick={() => eliminarPesada(p.id)}
                          style={{ padding: '3px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // ── PESADA ACTIVA ──
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '.5rem' }}>
        <button onClick={() => setVista('historial')}
          style={{ padding: '5px 10px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          ← Volver
        </button>
        <div style={{ fontSize: 22, fontWeight: 600 }}>
          Pesada acumulación — {new Date().toLocaleDateString('es-AR')}
        </div>
      </div>
      <div style={{ fontSize: 13, color: S.muted, fontFamily: 'monospace', marginBottom: '1.5rem' }}>
        Se pesan los animales de {corralAcum ? `C-${corralAcum.numero}` : 'acumulación'}. El sistema clasifica y mueve automáticamente.
      </div>

      {/* Stepper */}
      <div style={{ display: 'flex', border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: '1.5rem' }}>
        {[{ n: 1, label: 'Registrar pesos' }, { n: 2, label: 'Revisar clasificación' }, { n: 3, label: 'Confirmar corrales' }].map((s, i) => {
          const done = paso > s.n
          const active = paso === s.n
          return (
            <div key={s.n} style={{ flex: 1, padding: '10px 14px', borderRight: i < 2 ? `1px solid ${S.border}` : 'none', display: 'flex', alignItems: 'center', gap: 10, background: active ? S.accentLight : done ? S.greenLight : 'transparent' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, background: active ? S.accent : done ? S.green : S.bg, color: (active || done) ? '#fff' : S.muted }}>
                {done ? '✓' : s.n}
              </div>
              <div style={{ fontSize: 12, fontWeight: 500, color: active ? S.accent : done ? S.green : S.muted }}>{s.label}</div>
            </div>
          )
        })}
      </div>

      {/* PASO 1 */}
      {paso === 1 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1rem' }}>
            <div style={{ flex: 1 }}>
              <div style={{ height: 8, background: S.bg, borderRadius: 4, overflow: 'hidden', border: `1px solid ${S.border}` }}>
                <div style={{ width: `${corralAcum ? Math.round(pesosValidos.length / Math.max(corralAcum.animales, 1) * 100) : 0}%`, height: '100%', borderRadius: 4, background: S.accent, transition: 'width .4s ease' }} />
              </div>
              <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>{pesosValidos.length} de {corralAcum?.animales || '—'} animales pesados</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => {
                const ejemplo = [214,218,225,228,222,219,205,210,227,230,235,240,248,252,259,256,243,238,250,255,265,270,278,282,268,274,285,290,263,271,295,302,310,298,315,305,288,275,268,292,224,217,208,232,245,258,271,284,297]
                const newP = Array(Math.max(totalFilas, ejemplo.length)).fill('')
                ejemplo.forEach((v, i) => { newP[i] = String(v) })
                setPesos(newP)
                if (ejemplo.length > totalFilas) setFilasExtra(ejemplo.length - 20)
              }} style={{ padding: '8px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                Cargar ejemplo
              </button>
              <button onClick={() => setPaso(2)} disabled={pesosValidos.length < 3}
                style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: pesosValidos.length >= 3 ? S.accent : S.border, border: 'none', color: pesosValidos.length >= 3 ? '#fff' : S.muted, borderRadius: 6, cursor: pesosValidos.length >= 3 ? 'pointer' : 'not-allowed', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                Ver clasificación →
              </button>
            </div>
          </div>

          <div style={{ background: S.accentLight, border: '1px solid #85B7EB', borderRadius: 8, padding: '.85rem 1rem', fontSize: 13, color: S.accent, marginBottom: '1rem', lineHeight: 1.6 }}>
            Ingresá el peso de cada animal. Rangos: A 200–230 · B 231–260 · C 261–290 · D 291–320 · E 321–350 · F 351–380 · G 381+
          </div>

          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '1rem' }}>Ingreso individual por animal</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: '1rem' }}>
              {Array(totalFilas).fill(0).map((_, i) => {
                const val = pesos[i] || ''
                const num = parseInt(val)
                const rango = num >= 200 ? getRango(num) : null
                const esMenor = num > 0 && num < 200
                const rc = rango ? (RANGO_COLORS[rango.letra] || {}) : {}
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: `1px solid ${val ? (esMenor ? '#EF9F27' : rango ? rc.color : S.border) : S.border}`, borderRadius: 6, background: S.surface }}>
                    <label style={{ fontSize: 11, color: S.muted, minWidth: 70, fontFamily: 'monospace' }}>Animal {String(i + 1).padStart(3, '0')}</label>
                    <input type="number" min="100" max="700" placeholder="kg" value={val}
                      onChange={e => {
                        const newP = [...pesos]
                        while (newP.length <= i) newP.push('')
                        newP[i] = e.target.value
                        setPesos(newP)
                      }}
                      style={{ border: 'none', outline: 'none', fontFamily: 'monospace', fontSize: 14, fontWeight: 500, width: 70, color: S.text, background: 'transparent' }}
                    />
                    <span style={{ fontSize: 11, color: S.hint }}>kg</span>
                    {rango && <div style={{ width: 24, height: 24, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, background: rc.bg, color: rc.color, flexShrink: 0 }}>{rango.letra}</div>}
                    {esMenor && <div style={{ width: 24, height: 24, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, background: S.amberLight, color: S.amber, flexShrink: 0 }}>!</div>}
                  </div>
                )
              })}
            </div>
            <button onClick={() => setFilasExtra(f => f + 10)}
              style={{ padding: '8px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
              + Agregar 10 filas
            </button>
          </div>

          {/* Resumen rangos */}
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '1rem' }}>Resumen en tiempo real</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
              {RANGOS.map(r => {
                const rc = RANGO_COLORS[r.letra] || {}
                return (
                  <div key={r.letra} style={{ border: `2px solid ${rc.color}`, borderRadius: 8, padding: '.75rem', textAlign: 'center', background: rc.bg }}>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: rc.color }}>Rango {r.letra}</div>
                    <div style={{ fontSize: 11, color: rc.color, marginBottom: 4 }}>{r.label}</div>
                    <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'monospace', color: S.text }}>{conteoRangos[r.letra].length}</div>
                    <div style={{ fontSize: 10, color: S.muted }}>animales</div>
                  </div>
                )
              })}
            </div>
            {menores.length > 0 && (
              <div style={{ marginTop: 10, background: S.amberLight, border: '1px solid #EF9F27', borderRadius: 8, padding: '.75rem 1rem', fontSize: 13, color: S.amber, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span><strong>{menores.length} animales</strong> menores de 200 kg — se quedan en acumulación</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 20 }}>{menores.length}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PASO 2 */}
      {paso === 2 && (
        <div>
          <div style={{ background: S.greenLight, border: '1px solid #97C459', borderRadius: 8, padding: '.85rem 1rem', fontSize: 13, color: S.green, marginBottom: '1rem', lineHeight: 1.6 }}>
            <strong>{clasificables.length} animales clasificados.</strong> Peso promedio: <strong>{promClasif} kg</strong>.
            {menores.length > 0 && <span style={{ color: S.amber }}> · ⚠ {menores.length} menor{menores.length !== 1 ? 'es' : ''} de 200 kg — se quedan en acumulación.</span>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: '1rem' }}>
            {RANGOS.map(r => {
              const arr = conteoRangos[r.letra]
              const prom = arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0
              const rc = RANGO_COLORS[r.letra] || {}
              return (
                <div key={r.letra} style={{ border: `2px solid ${rc.color}`, borderRadius: 8, padding: '.85rem', textAlign: 'center', background: rc.bg }}>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: rc.color }}>Rango {r.letra}</div>
                  <div style={{ fontSize: 11, color: rc.color, marginBottom: 4 }}>{r.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'monospace', color: S.text }}>{arr.length}</div>
                  <div style={{ fontSize: 10, color: S.muted }}>{prom ? `prom. ${prom} kg` : 'sin animales'}</div>
                </div>
              )
            })}
          </div>

          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '1rem' }}>Detalle por animal</div>
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden', maxHeight: 300, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: S.bg }}>
                    {['N°', 'Peso', 'Rango', 'Días para 400 kg'].map(h => (
                      <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, position: 'sticky', top: 0, background: S.bg }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...clasificables.map(p => ({ p, esMenor: false })), ...menores.map(p => ({ p, esMenor: true }))]
                    .sort((a, b) => a.p - b.p)
                    .map(({ p, esMenor }, i) => {
                      const r = esMenor ? null : getRango(p)
                      const rc = r ? (RANGO_COLORS[r.letra] || {}) : {}
                      const dias = esMenor ? '—' : calcDiasParaVenta(p)
                      return (
                        <tr key={i} style={{ borderBottom: `1px solid ${S.border}`, background: esMenor ? '#FFFBF0' : 'transparent' }}>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{String(i + 1).padStart(3, '0')}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{p} kg</td>
                          <td style={{ padding: '10px 14px' }}>
                            {esMenor
                              ? <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: S.amberLight, color: S.amber }}>Se queda en AC</span>
                              : r ? <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: rc.bg, color: rc.color }}>Rango {r.letra}</span> : '—'
                            }
                          </td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: dias === 0 ? S.green : S.text }}>
                            {esMenor ? '—' : dias === 0 ? 'Listo' : dias + ' días'}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setPaso(1)} style={{ padding: '8px 16px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>← Revisar pesos</button>
            <button onClick={() => setPaso(3)} style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>Confirmar y armar corrales →</button>
          </div>
        </div>
      )}

      {/* PASO 3 */}
      {paso === 3 && (
        <div>
          <div style={{ background: S.greenLight, border: '1px solid #97C459', borderRadius: 8, padding: '.85rem 1rem', fontSize: 13, color: S.green, marginBottom: '1rem', lineHeight: 1.6 }}>
            Elegí dos corrales libres para los nuevos rangos A y B. Los corrales existentes subirán 2 rangos automáticamente.
          </div>

          {/* Subida de rangos */}
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '1rem' }}>Cambios en corrales existentes</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {corralesClasificados.sort((a, b) => (a.sub || '').localeCompare(b.sub || '')).map(c => {
                const rangoActual = c.sub || 'A'
                const rangoNuevo = subirRango(rangoActual, 2)
                const rcActual = RANGO_COLORS[rangoActual] || {}
                const rcNuevo = RANGO_COLORS[rangoNuevo] || {}
                // Cuántos animales nuevos llegarán de acumulación
                const mapeoDestino = { C: 'A', D: 'B', E: 'C', F: 'D', G: 'E' }
                const letraNueva = Object.keys(mapeoDestino).find(k => mapeoDestino[k] === rangoActual)
                const nuevosAnimales = letraNueva ? conteoRangos[letraNueva].length : 0
                return (
                  <div key={c.id} style={{ border: `1px solid ${S.border}`, borderRadius: 8, padding: '.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: rcActual.bg, color: rcActual.color }}>Rango {rangoActual}</span>
                      <span style={{ fontSize: 14, color: S.muted }}>→</span>
                      <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: rcNuevo.bg, color: rcNuevo.color }}>Rango {rangoNuevo}</span>
                    </div>
                    <div style={{ fontSize: 11, color: S.muted, fontFamily: 'monospace' }}>
                      C-{c.numero} · {c.animales || 0} anim.{nuevosAnimales > 0 ? ` + ${nuevosAnimales} nuevos` : ''}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Selección corrales libres */}
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '1rem' }}>Asignar corrales para nuevos A y B</div>
            {corralesLibres.length < 2 && (
              <div style={{ background: S.redLight, border: '1px solid #F09595', borderRadius: 8, padding: '.85rem 1rem', fontSize: 13, color: S.red, marginBottom: '1rem' }}>
                ⚠ No hay suficientes corrales libres. Necesitás al menos 2.
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: S.green, marginBottom: 6 }}>Nuevo Rango A — {conteoRangos['A'].length} animales (200–230 kg)</div>
                <select value={corralLibre1} onChange={e => setCorralLibre1(e.target.value)}
                  style={{ width: '100%', border: `1px solid ${S.green}`, borderRadius: 6, padding: '9px 12px', fontSize: 14, background: S.surface, fontFamily: "'IBM Plex Sans', sans-serif" }}>
                  <option value="">— Seleccioná —</option>
                  {corralesLibres.filter(c => String(c.id) !== String(corralLibre2)).map(c => (
                    <option key={c.id} value={c.id}>Corral {c.numero} · cap. {c.capacidad || '—'}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: S.accent, marginBottom: 6 }}>Nuevo Rango B — {conteoRangos['B'].length} animales (231–260 kg)</div>
                <select value={corralLibre2} onChange={e => setCorralLibre2(e.target.value)}
                  style={{ width: '100%', border: `1px solid ${S.accent}`, borderRadius: 6, padding: '9px 12px', fontSize: 14, background: S.surface, fontFamily: "'IBM Plex Sans', sans-serif" }}>
                  <option value="">— Seleccioná —</option>
                  {corralesLibres.filter(c => String(c.id) !== String(corralLibre1)).map(c => (
                    <option key={c.id} value={c.id}>Corral {c.numero} · cap. {c.capacidad || '—'}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {menores.length > 0 && (
            <div style={{ background: S.amberLight, border: '1px solid #EF9F27', borderRadius: 8, padding: '.85rem 1rem', fontSize: 13, color: S.amber, marginBottom: '1rem' }}>
              <strong>{menores.length} animales</strong> menores de 200 kg se quedan en {corralAcum ? `C-${corralAcum.numero}` : 'acumulación'}.
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setPaso(2)} style={{ padding: '8px 16px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>← Atrás</button>
            <button onClick={confirmarPesada} disabled={guardando || !corralLibre1 || !corralLibre2}
              style={{ padding: '11px 22px', fontSize: 14, fontWeight: 600, background: corralLibre1 && corralLibre2 ? S.green : S.border, border: 'none', color: corralLibre1 && corralLibre2 ? '#fff' : S.muted, borderRadius: 6, cursor: corralLibre1 && corralLibre2 ? 'pointer' : 'not-allowed', fontFamily: "'IBM Plex Sans', sans-serif" }}>
              {guardando ? 'Guardando...' : '✓ Confirmar pesada y mover animales'}
            </button>
          </div>
        </div>
      )}

      {/* PASO 4: CONFIRMADO */}
      {paso === 4 && pesadaConfirmada && (
        <div>
          <div style={{ background: S.greenLight, border: '1px solid #97C459', borderRadius: 8, padding: '1.25rem', fontSize: 15, marginBottom: '1.25rem', color: S.green }}>
            <strong>Pesada confirmada.</strong> Los corrales fueron actualizados y los rangos subieron 2 posiciones. Próxima pesada programada en 40 días.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.25rem' }}>
            {[
              { label: 'Clasificados', val: pesadaConfirmada.clasificables, sub: `${pesadaConfirmada.menores} se quedan en acumulación`, color: S.green },
              { label: 'Peso prom.', val: pesadaConfirmada.promClasif + ' kg', sub: 'promedio de los pesados' },
              { label: 'Nuevo Rango A', val: pesadaConfirmada.conteoRangos['A'].length, sub: pesadaConfirmada.corralA ? `→ C-${pesadaConfirmada.corralA.numero}` : '—', color: S.green },
              { label: 'Nuevo Rango B', val: pesadaConfirmada.conteoRangos['B'].length, sub: pesadaConfirmada.corralB ? `→ C-${pesadaConfirmada.corralB.numero}` : '—', color: S.accent },
            ].map((m, i) => (
              <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem' }}>
                <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{m.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', lineHeight: 1, color: m.color || S.text }}>{m.val}</div>
                <div style={{ fontSize: 11, color: S.hint, marginTop: 4 }}>{m.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setVista('historial')}
              style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
              Volver al módulo de pesadas
            </button>
            <button onClick={iniciarNuevaPesada}
              style={{ padding: '8px 16px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
              Nueva pesada
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
