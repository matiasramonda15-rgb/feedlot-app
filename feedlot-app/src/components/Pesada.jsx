import { useState, useEffect, useRef } from 'react'
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
  { min: 200, max: 230, letra: 'A', label: '200–230 kg', color: S.green, bg: S.greenLight, corralNum: '2' },
  { min: 231, max: 260, letra: 'B', label: '231–260 kg', color: S.accent, bg: S.accentLight, corralNum: '4' },
  { min: 261, max: 290, letra: 'C', label: '261–290 kg', color: S.purple, bg: S.purpleLight, corralNum: '7' },
  { min: 291, max: 999, letra: 'D', label: '291+ kg',    color: S.amber, bg: S.amberLight, corralNum: '5' },
]

function getRango(kg) {
  for (const r of RANGOS) if (kg >= r.min && kg <= r.max) return r
  return null
}

function calcDiasParaVenta(pesoActual, gdp = 1.2) {
  if (pesoActual >= 400) return 0
  return Math.ceil((400 - pesoActual) / gdp)
}

export default function Pesada({ usuario }) {
  const [vista, setVista] = useState('historial') // 'historial' | 'pesada-activa'
  const [paso, setPaso] = useState(1)
  const [loading, setLoading] = useState(true)
  const [corrales, setCorrales] = useState([])
  const [pesadasHist, setPesadasHist] = useState([])
  const [proximaPesada, setProximaPesada] = useState(null)
  const [corralSelId, setCorralSelId] = useState('')
  const [pesos, setPesos] = useState(Array(20).fill(''))
  const [filasExtra, setFilasExtra] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [pesadaConfirmada, setPesadaConfirmada] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: c }, { data: p }, { data: cfg }] = await Promise.all([
      supabase.from('corrales').select('*').not('rol', 'eq', 'deshabilitado').order('numero'),
      supabase.from('pesadas').select('*, corrales(numero), pesada_animales(rango, cantidad, peso_promedio)').order('creado_en', { ascending: false }).limit(20),
      supabase.from('configuracion').select('valor').eq('clave', 'proxima_pesada').single(),
    ])
    setCorrales(c || [])
    setPesadasHist(p || [])
    setProximaPesada(cfg?.valor || null)
    setLoading(false)
  }

  // Cálculos en tiempo real
  const totalFilas = 20 + filasExtra
  const pesosValidos = pesos.filter(p => p && parseInt(p) >= 100 && parseInt(p) <= 600).map(p => parseInt(p))
  const menores = pesosValidos.filter(p => p < 200)
  const clasificables = pesosValidos.filter(p => p >= 200)
  const conteoRangos = { A: [], B: [], C: [], D: [] }
  clasificables.forEach(p => { const r = getRango(p); if (r) conteoRangos[r.letra].push(p) })
  const promClasif = clasificables.length ? Math.round(clasificables.reduce((a, b) => a + b, 0) / clasificables.length) : 0

  const corralSel = corrales.find(c => String(c.id) === String(corralSelId))

  // Para GDP e indicadores del ciclo — usando datos de la pesada anterior del corral
  const pesadaAnteriorCorral = pesadasHist.find(p => p.corrales?.numero === corralSel?.numero)
  const pesoIngreso = pesadaAnteriorCorral
    ? (pesadaAnteriorCorral.pesada_animales?.reduce((s, pa) => s + (pa.peso_promedio || 0) * (pa.cantidad || 0), 0) /
       Math.max(pesadaAnteriorCorral.pesada_animales?.reduce((s, pa) => s + (pa.cantidad || 0), 0), 1))
    : null

  // Fechas
  const proximaDate = proximaPesada ? new Date(proximaPesada + 'T12:00:00') : null
  const diasRestantes = proximaDate ? Math.ceil((proximaDate - new Date()) / (1000 * 60 * 60 * 24)) : null

  // Corral de acumulación para pesada
  const corralAcumulacion = corrales.find(c => c.rol === 'acumulacion')

  async function confirmarPesada() {
    if (!corralSelId) { alert('Seleccioná un corral'); return }
    if (clasificables.length === 0) { alert('No hay animales pesados'); return }
    setGuardando(true)

    const { data: pesada, error } = await supabase.from('pesadas').insert({
      corral_id: parseInt(corralSelId),
      tipo: 'clasificacion',
      registrado_por: usuario?.id,
    }).select().single()

    if (!error && pesada) {
      // Insertar pesada_animales con rangos
      const animalesInsert = []
      Object.entries(conteoRangos).forEach(([rango, arr]) => {
        if (arr.length > 0) {
          animalesInsert.push({
            pesada_id: pesada.id,
            rango,
            cantidad: arr.length,
            peso_promedio: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length),
          })
        }
      })
      if (menores.length > 0) {
        animalesInsert.push({
          pesada_id: pesada.id,
          rango: 'menores',
          cantidad: menores.length,
          peso_promedio: Math.round(menores.reduce((a, b) => a + b, 0) / menores.length),
        })
      }
      await supabase.from('pesada_animales').insert(animalesInsert)

      // Mover animales a corrales según rangos
      const { data: origen } = await supabase.from('corrales').select('animales').eq('id', corralSelId).single()
      const totalPesados = clasificables.length + menores.length
      await supabase.from('corrales').update({ animales: Math.max(0, (origen?.animales || 0) - totalPesados) }).eq('id', corralSelId)

      for (const r of RANGOS) {
        const cant = conteoRangos[r.letra].length
        if (cant > 0) {
          const { data: dc } = await supabase.from('corrales').select('animales').eq('numero', r.corralNum).single()
          if (dc) await supabase.from('corrales').update({ animales: (dc.animales || 0) + cant }).eq('numero', r.corralNum)
        }
      }
      if (menores.length > 0 && corralAcumulacion) {
        const { data: ac } = await supabase.from('corrales').select('animales').eq('id', corralAcumulacion.id).single()
        await supabase.from('corrales').update({ animales: (ac?.animales || 0) + menores.length }).eq('id', corralAcumulacion.id)
      }

      // Actualizar próxima pesada +40 días
      const nuevaProxima = new Date()
      nuevaProxima.setDate(nuevaProxima.getDate() + 40)
      await supabase.from('configuracion').update({ valor: nuevaProxima.toISOString().split('T')[0] }).eq('clave', 'proxima_pesada')

      // GDP del ciclo
      let gdpEstimado = null
      if (pesoIngreso && pesadaAnteriorCorral) {
        const diasCiclo = Math.max(1, Math.ceil((new Date() - new Date(pesadaAnteriorCorral.creado_en)) / (1000 * 60 * 60 * 24)))
        gdpEstimado = ((promClasif - pesoIngreso) / diasCiclo).toFixed(2)
      }

      setPesadaConfirmada({ clasificables: clasificables.length, menores: menores.length, promClasif, gdpEstimado, conteoRangos })
      await cargar()
      setPaso(4)
    } else {
      alert('Error al guardar la pesada.')
    }
    setGuardando(false)
  }

  function iniciarNuevaPesada() {
    setPesos(Array(20).fill(''))
    setFilasExtra(0)
    setCorralSelId('')
    setPaso(1)
    setPesadaConfirmada(null)
    setVista('pesada-activa')
  }

  if (loading) return <Loader />

  // ── HISTORIAL ──
  if (vista === 'historial') {
    return (
      <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Pesada y clasificación</div>
            <div style={{ fontSize: 13, color: S.muted, fontFamily: 'monospace' }}>
              Próxima pesada fija · {proximaDate ? proximaDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'no configurada'}
            </div>
          </div>
        </div>

        {/* Countdown bar */}
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
                <span>{corralAcumulacion ? `${corralAcumulacion.animales || 0} animales · C-${corralAcumulacion.numero}` : 'Sin corral de acumulación'}</span>
              </div>
              <div style={{ width: 1, height: 48, background: 'rgba(255,255,255,.15)' }} />
              <div style={{ color: 'rgba(255,255,255,.8)', fontSize: 13 }}>
                <strong style={{ color: '#fff' }}>Corrales en cuarentena</strong><br />
                <span>{corrales.filter(c => c.rol === 'cuarentena' && (c.animales || 0) > 0).map(c => `C-${c.numero} (${c.animales})`).join(', ') || 'Ninguno'}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={iniciarNuevaPesada}
                style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, background: '#fff', border: '1px solid #fff', color: S.accent, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                Iniciar pesada ahora ↗
              </button>
            </div>
          </div>
        )}

        {/* Métricas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
          {[
            { label: 'Animales en acumulación', val: corralAcumulacion?.animales || 0, sub: corralAcumulacion ? `C-${corralAcumulacion.numero}` : '—' },
            { label: 'Próxima pesada', val: diasRestantes !== null ? `${diasRestantes}d` : '—', sub: proximaDate?.toLocaleDateString('es-AR') || '—', color: diasRestantes !== null && diasRestantes <= 7 ? S.amber : S.green },
            { label: 'Pesadas realizadas', val: pesadasHist.length, sub: 'historial total' },
            { label: 'Última pesada', val: pesadasHist[0] ? new Date(pesadasHist[0].creado_en).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '—', sub: pesadasHist[0] ? `C-${pesadasHist[0].corrales?.numero}` : '—' },
          ].map((m, i) => (
            <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem' }}>
              <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{m.label}</div>
              <div style={{ fontSize: 24, fontWeight: 600, fontFamily: 'monospace', lineHeight: 1, color: m.color || S.text }}>{m.val}</div>
              <div style={{ fontSize: 11, color: S.hint, marginTop: 4 }}>{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Historial de pesadas */}
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Pesadas anteriores</div>
            <button onClick={iniciarNuevaPesada}
              style={{ padding: '5px 10px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
              + Registrar pesada de hoy ↗
            </button>
          </div>
          <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: S.bg }}>
                  {['Fecha', 'Corral', 'Animales', 'Peso prom.', 'Rango A', 'Rango B', 'Rango C', 'Rango D', 'Menores', 'Resultado'].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pesadasHist.length === 0 && (
                  <tr><td colSpan={10} style={{ padding: '2rem', textAlign: 'center', color: S.hint, fontSize: 13 }}>No hay pesadas registradas.</td></tr>
                )}
                {pesadasHist.map(p => {
                  const totalAnim = p.pesada_animales?.reduce((s, pa) => s + (pa.cantidad || 0), 0) || 0
                  const promPeso = p.pesada_animales?.filter(pa => pa.rango !== 'menores' && pa.peso_promedio)
                    .reduce((s, pa) => s + (pa.peso_promedio || 0) * (pa.cantidad || 0), 0) /
                    Math.max(p.pesada_animales?.filter(pa => pa.rango !== 'menores').reduce((s, pa) => s + (pa.cantidad || 0), 0) || 1, 1)
                  const rangoBadge = (letra, bg, color) => {
                    const pa = p.pesada_animales?.find(x => x.rango === letra)
                    if (!pa || !pa.cantidad) return <span style={{ color: S.hint }}>—</span>
                    return <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: bg, color }}>{pa.cantidad} anim.</span>
                  }
                  const menoresPa = p.pesada_animales?.find(x => x.rango === 'menores')
                  return (
                    <tr key={p.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{new Date(p.creado_en).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                      <td style={{ padding: '10px 14px' }}>C-{p.corrales?.numero || '—'}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{totalAnim}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{promPeso ? Math.round(promPeso) + ' kg' : '—'}</td>
                      <td style={{ padding: '10px 14px' }}>{rangoBadge('A', S.greenLight, S.green)}</td>
                      <td style={{ padding: '10px 14px' }}>{rangoBadge('B', S.accentLight, S.accent)}</td>
                      <td style={{ padding: '10px 14px' }}>{rangoBadge('C', S.purpleLight, S.purple)}</td>
                      <td style={{ padding: '10px 14px' }}>{rangoBadge('D', S.amberLight, S.amber)}</td>
                      <td style={{ padding: '10px 14px' }}>
                        {menoresPa?.cantidad ? <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: S.amberLight, color: S.amber }}>{menoresPa.cantidad} anim.</span> : <span style={{ color: S.hint }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: S.greenLight, color: S.green }}>Clasificado</span>
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
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '.5rem' }}>
        <button onClick={() => setVista('historial')}
          style={{ padding: '5px 10px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          ← Volver
        </button>
        <div style={{ fontSize: 22, fontWeight: 600 }}>
          Pesada {corralSel ? `C-${corralSel.numero}` : ''} — {new Date().toLocaleDateString('es-AR')}
        </div>
      </div>
      <div style={{ fontSize: 13, color: S.muted, fontFamily: 'monospace', marginBottom: '1.5rem' }}>
        Ingresá el peso individual de cada animal. El sistema clasifica en tiempo real.
      </div>

      {/* Stepper */}
      <div style={{ display: 'flex', border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: '1.5rem' }}>
        {[
          { n: 1, label: 'Registrar pesos' },
          { n: 2, label: 'Revisar clasificación' },
          { n: 3, label: 'Confirmar corrales' },
        ].map((s, i) => {
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

      {/* PASO 1: INGRESO DE PESOS */}
      {paso === 1 && (
        <div>
          {/* Selector de corral */}
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem' }}>Corral a pesar</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <select value={corralSelId} onChange={e => setCorralSelId(e.target.value)}
                style={{ border: `1px solid ${S.border}`, borderRadius: 6, padding: '9px 12px', fontSize: 14, background: S.surface, fontFamily: "'IBM Plex Sans', sans-serif" }}>
                <option value="">— Seleccioná un corral —</option>
                {corrales.filter(c => (c.animales || 0) > 0 && c.rol !== 'libre').map(c => (
                  <option key={c.id} value={c.id}>Corral {c.numero} · {c.rol} · {c.animales} animales</option>
                ))}
              </select>
              {corralSel && (
                <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 6, padding: '9px 12px', fontSize: 13, fontFamily: 'monospace' }}>
                  {corralSel.animales} animales disponibles
                </div>
              )}
            </div>
          </div>

          {/* Progress */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1rem' }}>
            <div style={{ flex: 1 }}>
              <div style={{ height: 8, background: S.bg, borderRadius: 4, overflow: 'hidden', border: `1px solid ${S.border}` }}>
                <div style={{ width: `${corralSel ? Math.round(pesosValidos.length / Math.max(corralSel.animales, 1) * 100) : 0}%`, height: '100%', borderRadius: 4, background: S.accent, transition: 'width .4s ease' }} />
              </div>
              <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>{pesosValidos.length} de {corralSel?.animales || '—'} animales pesados</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => {
                const ejemplo = [214,218,225,228,222,219,205,210,227,230,235,240,248,252,259,256,243,238,250,255,265,270,278,282,268,274,285,290,263,271,295,302,310,298,315,305,288,275,268,292,224,217,208,232,245,258,271,284,297]
                const newPesos = Array(Math.max(totalFilas, ejemplo.length)).fill('')
                ejemplo.forEach((v, i) => { newPesos[i] = String(v) })
                setPesos(newPesos)
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
            Ingresá el peso de cada animal en kg. El sistema clasifica automáticamente en los rangos: 200–230 · 231–260 · 261–290 · 291+.
          </div>

          {/* Grilla de inputs */}
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '1rem' }}>Ingreso individual por animal</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: '1rem' }}>
              {Array(totalFilas).fill(0).map((_, i) => {
                const val = pesos[i] || ''
                const num = parseInt(val)
                const rango = num >= 200 ? getRango(num) : null
                const esMenor = num > 0 && num < 200
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: `1px solid ${val ? (esMenor ? '#EF9F27' : rango ? rango.color : S.border) : S.border}`, borderRadius: 6, background: S.surface }}>
                    <label style={{ fontSize: 11, color: S.muted, minWidth: 70, fontFamily: 'monospace' }}>Animal {String(i + 1).padStart(3, '0')}</label>
                    <input
                      type="number" min="100" max="600" placeholder="kg" value={val}
                      onChange={e => {
                        const newP = [...pesos]
                        while (newP.length <= i) newP.push('')
                        newP[i] = e.target.value
                        setPesos(newP)
                      }}
                      style={{ border: 'none', outline: 'none', fontFamily: 'monospace', fontSize: 14, fontWeight: 500, width: 70, color: S.text, background: 'transparent' }}
                    />
                    <span style={{ fontSize: 11, color: S.hint }}>kg</span>
                    {rango && <div style={{ width: 24, height: 24, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, background: rango.bg, color: rango.color, flexShrink: 0 }}>{rango.letra}</div>}
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

          {/* Resumen en tiempo real */}
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '1rem' }}>Resumen en tiempo real</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {RANGOS.map(r => (
                <div key={r.letra} style={{ border: `2px solid ${r.color}`, borderRadius: 10, padding: '1rem', textAlign: 'center', background: r.bg }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: r.color, marginBottom: 4 }}>Rango {r.letra}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: r.color, marginBottom: 2 }}>{r.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'monospace', color: S.text, margin: '6px 0 2px' }}>{conteoRangos[r.letra].length}</div>
                  <div style={{ fontSize: 11, color: S.muted }}>animales</div>
                  <div style={{ marginTop: 8, fontSize: 11, color: r.color }}>→ C-{r.corralNum}</div>
                </div>
              ))}
            </div>
            {menores.length > 0 && (
              <div style={{ marginTop: 10, background: S.amberLight, border: '1px solid #EF9F27', borderRadius: 8, padding: '.75rem 1rem', fontSize: 13, color: S.amber, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span><strong>{menores.length} animales</strong> con menos de 200 kg — vuelven a acumulación</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 20 }}>{menores.length}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PASO 2: CLASIFICACIÓN */}
      {paso === 2 && (
        <div>
          <div style={{ background: S.greenLight, border: '1px solid #97C459', borderRadius: 8, padding: '.85rem 1rem', fontSize: 13, color: S.green, marginBottom: '1rem', lineHeight: 1.6 }}>
            <strong>{clasificables.length} animales clasificados.</strong> Peso promedio: <strong>{promClasif} kg</strong>.
            {menores.length > 0 && <span style={{ color: S.amber }}> · ⚠ {menores.length} animal{menores.length !== 1 ? 'es' : ''} con menos de 200 kg — vuelven a acumulación.</span>}
          </div>

          {/* Indicadores del ciclo */}
          <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem' }}>Indicadores del ciclo</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '.75rem' }}>
              {[
                { label: 'Peso prom. ingreso', val: pesoIngreso ? Math.round(pesoIngreso) + ' kg' : '—', sub: 'pesada anterior' },
                { label: 'Peso clasificación', val: promClasif + ' kg', sub: 'primer peso real', color: S.green },
                { label: 'Ganancia', val: pesoIngreso ? (promClasif - Math.round(pesoIngreso)) + ' kg/animal' : '—', sub: 'desde ingreso' },
                { label: 'Días para 400 kg', val: promClasif > 0 ? calcDiasParaVenta(promClasif) + ' días' : '—', sub: 'al GDP actual (1,2 kg/d)' },
              ].map((m, i) => (
                <div key={i}>
                  <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{m.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: m.color || S.text }}>{m.val}</div>
                  <div style={{ fontSize: 10, color: S.hint, marginTop: 1 }}>{m.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Rangos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1rem' }}>
            {RANGOS.map(r => {
              const arr = conteoRangos[r.letra]
              const prom = arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0
              return (
                <div key={r.letra} style={{ border: `2px solid ${r.color}`, borderRadius: 10, padding: '1rem', textAlign: 'center', background: r.bg }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: r.color }}>Rango {r.letra} · {r.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'monospace', color: S.text, margin: '6px 0 2px' }}>{arr.length}</div>
                  <div style={{ fontSize: 11, color: S.muted }}>animales · prom. {prom || '—'} kg</div>
                  <div style={{ marginTop: 8, fontSize: 11, color: r.color }}>→ C-{r.corralNum}</div>
                </div>
              )
            })}
          </div>

          {menores.length > 0 && (
            <div style={{ background: S.amberLight, border: '1px solid #EF9F27', borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: S.amber }}>Menores de 200 kg — vuelven a acumulación</div>
                <div style={{ fontSize: 12, color: S.amber, marginTop: 2 }}>{menores.length} animal{menores.length !== 1 ? 'es' : ''} · prom. {Math.round(menores.reduce((a, b) => a + b, 0) / menores.length)} kg</div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'monospace', color: S.amber }}>{menores.length}</div>
            </div>
          )}

          {/* Tabla detalle */}
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '1rem' }}>Detalle por animal</div>
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden', maxHeight: 350, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: S.bg }}>
                    {['N°', 'Peso', 'Rango', 'Corral destino', 'Días para 400 kg'].map(h => (
                      <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap', position: 'sticky', top: 0, background: S.bg }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...clasificables.map(p => ({ p, esMenor: false })), ...menores.map(p => ({ p, esMenor: true }))]
                    .sort((a, b) => a.p - b.p)
                    .map(({ p, esMenor }, i) => {
                      const r = esMenor ? null : getRango(p)
                      const dias = esMenor ? '—' : calcDiasParaVenta(p)
                      return (
                        <tr key={i} style={{ borderBottom: `1px solid ${S.border}`, background: esMenor ? '#FFFBF0' : 'transparent' }}>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{String(i + 1).padStart(3, '0')}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{p} kg</td>
                          <td style={{ padding: '10px 14px' }}>
                            {esMenor
                              ? <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: S.amberLight, color: S.amber, border: '1px solid #EF9F27' }}>Vuelve a AC</span>
                              : r ? <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: r.bg, color: r.color }}>Rango {r.letra}</span> : '—'
                            }
                          </td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: esMenor ? S.amber : S.text }}>
                            {esMenor ? 'Acumulación' : r ? `C-${r.corralNum}` : '—'}
                          </td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: esMenor ? S.amber : dias === 0 ? S.green : dias <= 30 ? S.green : dias <= 60 ? S.amber : S.text }}>
                            {esMenor ? 'Próx. ciclo' : dias === 0 ? 'Listo' : dias + ' días'}
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

      {/* PASO 3: CONFIRMACIÓN */}
      {paso === 3 && (
        <div>
          <div style={{ background: S.greenLight, border: '1px solid #97C459', borderRadius: 8, padding: '.85rem 1rem', fontSize: 13, color: S.green, marginBottom: '1rem', lineHeight: 1.6 }}>
            Revisá los corrales propuestos. Al confirmar, los animales se moverán automáticamente.
          </div>

          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '1rem' }}>Corrales propuestos</div>
            {RANGOS.map(r => {
              const cant = conteoRangos[r.letra].length
              if (!cant) return null
              const prom = Math.round(conteoRangos[r.letra].reduce((a, b) => a + b, 0) / cant)
              const corralDest = corrales.find(c => String(c.numero) === r.corralNum)
              return (
                <div key={r.letra} style={{ border: `1px solid ${S.border}`, borderRadius: 8, padding: '.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: r.bg, color: r.color }}>Rango {r.letra}</span>
                      C-{r.corralNum} {corralDest ? `· ${corralDest.rol}` : ''}
                    </div>
                    <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>
                      {cant} animales · promedio {prom} kg · se suman al corral existente
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace' }}>{cant}</div>
                    <div style={{ fontSize: 11, color: S.muted }}>animales</div>
                  </div>
                </div>
              )
            })}
            {menores.length > 0 && (
              <div style={{ border: `1px solid #EF9F27`, borderRadius: 8, padding: '.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: S.amberLight }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: S.amber }}>Menores de 200 kg → Acumulación</div>
                  <div style={{ fontSize: 11, color: S.amber, marginTop: 2 }}>
                    {menores.length} animal{menores.length !== 1 ? 'es' : ''} · prom. {Math.round(menores.reduce((a, b) => a + b, 0) / menores.length)} kg · vuelven a {corralAcumulacion ? `C-${corralAcumulacion.numero}` : 'acumulación'}
                  </div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: S.amber }}>{menores.length}</div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setPaso(2)} style={{ padding: '8px 16px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>← Atrás</button>
            <button onClick={confirmarPesada} disabled={guardando}
              style={{ padding: '11px 22px', fontSize: 14, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
              {guardando ? 'Guardando...' : '✓ Confirmar pesada y mover animales'}
            </button>
          </div>
        </div>
      )}

      {/* PASO 4: CONFIRMADO */}
      {paso === 4 && pesadaConfirmada && (
        <div>
          <div style={{ background: S.greenLight, border: '1px solid #97C459', borderRadius: 8, padding: '1.25rem', fontSize: 15, marginBottom: '1.25rem', color: S.green }}>
            <strong>Pesada confirmada.</strong> Los corrales fueron actualizados. La próxima pesada quedó programada en 40 días.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.25rem' }}>
            {[
              { label: 'Clasificados', val: pesadaConfirmada.clasificables, sub: pesadaConfirmada.menores > 0 ? `${pesadaConfirmada.menores} vuelven a acum.` : 'todos ≥ 200 kg', color: S.green },
              { label: 'Peso prom. clasificación', val: pesadaConfirmada.promClasif + ' kg', sub: 'primer peso real', color: S.green },
              { label: 'GDP estimado', val: pesadaConfirmada.gdpEstimado ? pesadaConfirmada.gdpEstimado + ' kg/d' : '—', sub: 'ganancia diaria de peso' },
              { label: 'Menores de 200 kg', val: pesadaConfirmada.menores, sub: 'vuelven a acumulación', color: pesadaConfirmada.menores > 0 ? S.amber : S.green },
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
