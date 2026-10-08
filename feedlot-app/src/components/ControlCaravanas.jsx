import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import { parsearReporteCaravanas, guardarLecturasCaravana } from '../shared/caravanasLogic'

// ─────────────────────────────────────────────────────────────────────────────
// Control de peso por caravana (Pesada → 📡 Control por caravana)
//
// Se pesan algunos animales (no hace falta el corral entero) leyendo la
// caravana en la balanza. Al pegar el reporte del lector, cada caravana que ya
// tiene lectura de ingreso aparece con toda su historia: de qué lote y
// procedencia vino, peso y fecha de ingreso, días, kg ganados, GDP desde el
// ingreso y desde el control anterior, y cuándo llegaría al peso de venta.
// Se guarda como lectura tipo "control".
// ─────────────────────────────────────────────────────────────────────────────

const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const dias = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000)
const fmt = (x, d = 0) => (x == null || !isFinite(x)) ? '—' : Number(x).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d })
const fmtF = f => f ? new Date(f + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

// Desbaste: al ingreso el ternero se pesa desbastado; en los controles
// internos se pesa lleno. Al peso del control se le descuenta un % según el
// peso (tabla configurable, guardada en configuracion.desbaste_control).
// Se guarda el peso LLENO tal cual se leyó y el desbaste se aplica al mostrar,
// así si se cambia la tabla, se recalculan todos los controles.
const DESBASTE_DEFECTO = [{ hasta: 200, pct: 4 }, { hasta: 250, pct: 5 }, { hasta: 300, pct: 6 }, { hasta: 350, pct: 7 }, { hasta: null, pct: 8 }]
const pctDesbaste = (peso, tabla) => { const t = (tabla || DESBASTE_DEFECTO).find(r => r.hasta == null || peso <= r.hasta); return t ? parseFloat(t.pct) || 0 : 0 }
const desbastar = (peso, tabla) => peso * (1 - pctDesbaste(peso, tabla) / 100)

export default function ControlCaravanas({ S, corrales = [], usuario }) {
  const [historial, setHistorial] = useState([])   // lecturas de ingreso y control (todas)
  const [cargando, setCargando] = useState(true)
  const [texto, setTexto] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [corralId, setCorralId] = useState('')
  const [objetivo, setObjetivo] = useState('420')
  const [gdpAlerta, setGdpAlerta] = useState('0.8')
  const [guardando, setGuardando] = useState(false)
  const [viendoFecha, setViendoFecha] = useState(null) // ver un control ya guardado
  const [tablaDesb, setTablaDesb] = useState(DESBASTE_DEFECTO)
  const [editandoDesb, setEditandoDesb] = useState(null)
  useEffect(() => {
    supabase.from('configuracion').select('valor').eq('clave', 'desbaste_control').maybeSingle().then(({ data }) => {
      try { const t = JSON.parse(data?.valor || 'null'); if (Array.isArray(t) && t.length) setTablaDesb(t) } catch (e) { /* queda la de defecto */ }
    })
  }, [])
  async function guardarDesbaste() {
    const t = editandoDesb.map((r, i, arr) => ({ hasta: i === arr.length - 1 ? null : (parseFloat(r.hasta) || null), pct: parseFloat(r.pct) || 0 }))
    const { error } = await supabase.from('configuracion').upsert({ clave: 'desbaste_control', valor: JSON.stringify(t) }, { onConflict: 'clave' })
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    setTablaDesb(t); setEditandoDesb(null)
  }

  async function cargar() {
    const { data } = await supabase.from('caravanas_lecturas').select('*, lotes(codigo, procedencia), corrales(numero)').in('tipo', ['ingreso', 'control']).order('fecha')
    setHistorial(data || []); setCargando(false)
  }
  useEffect(() => { cargar() }, [])

  const porCaravana = useMemo(() => {
    const m = {}
    historial.forEach(l => { (m[l.numero_caravana] ||= []).push(l) })
    return m
  }, [historial])

  // Lecturas a analizar: las pegadas ahora, o las de un control guardado
  const lecturas = useMemo(() => {
    if (viendoFecha) return historial.filter(l => l.tipo === 'control' && l.fecha === viendoFecha).map(l => ({ numero_caravana: l.numero_caravana, peso: parseFloat(l.peso), hora: l.hora, _guardada: true }))
    return parsearReporteCaravanas(texto)
  }, [texto, viendoFecha, historial])
  const fechaAnalisis = viendoFecha || fecha

  const filas = useMemo(() => lecturas.map(l => {
    const hist = (porCaravana[l.numero_caravana] || []).filter(h => !(h.tipo === 'control' && h.fecha === fechaAnalisis))
    const ingreso = hist.filter(h => h.tipo === 'ingreso').sort((a, b) => a.fecha.localeCompare(b.fecha))[0] || null
    const controlesPrev = hist.filter(h => h.tipo === 'control' && h.fecha < fechaAnalisis).sort((a, b) => a.fecha.localeCompare(b.fecha))
    const ultimo = controlesPrev[controlesPrev.length - 1] || null
    // Peso del control (lleno) → desbastado, para compararlo con el de ingreso
    const pesoD = desbastar(l.peso, tablaDesb)
    const pctD = pctDesbaste(l.peso, tablaDesb)
    const d = ingreso ? dias(ingreso.fecha, fechaAnalisis) : null
    const kg = ingreso ? pesoD - parseFloat(ingreso.peso) : null
    const gdp = ingreso && d > 0 ? kg / d : null
    const dU = ultimo ? dias(ultimo.fecha, fechaAnalisis) : null
    const ultimoD = ultimo ? desbastar(parseFloat(ultimo.peso), tablaDesb) : null
    const gdpU = ultimo && dU > 0 ? (pesoD - ultimoD) / dU : null
    const ritmo = gdpU ?? gdp
    const faltan = parseFloat(objetivo) - pesoD
    const diasObj = ritmo > 0 && faltan > 0 ? Math.ceil(faltan / ritmo) : (faltan <= 0 ? 0 : null)
    let fechaObj = null
    if (diasObj != null) { const f = new Date(fechaAnalisis + 'T12:00:00'); f.setDate(f.getDate() + diasObj); fechaObj = f.toISOString().slice(0, 10) }
    return { ...l, pesoD, pctD, ingreso, ultimo, ultimoD, controlesPrev, d, kg, gdp, dU, gdpU, diasObj, fechaObj }
  }), [lecturas, porCaravana, fechaAnalisis, objetivo, tablaDesb])

  const conIngreso = filas.filter(f => f.ingreso)
  const sinIngreso = filas.filter(f => !f.ingreso)
  const prom = arr => arr.length ? arr.reduce((t, x) => t + x, 0) / arr.length : null
  const gdpProm = prom(conIngreso.map(f => f.gdp).filter(x => x != null))
  const alerta = parseFloat(gdpAlerta) || 0
  const atrasados = conIngreso.filter(f => f.gdp != null && f.gdp < alerta)
  // Resumen por lote / procedencia
  const porLote = {}
  conIngreso.forEach(f => { const k = f.ingreso.lote_id || 0; (porLote[k] ||= { lote: f.ingreso.lotes, filas: [] }).filas.push(f) })

  async function guardar() {
    if (!lecturas.length) { alert('Pegá el reporte del lector'); return }
    if (historial.some(l => l.tipo === 'control' && l.fecha === fecha) && !confirm(`Ya hay un control guardado el ${fmtF(fecha)}. ¿Agregar estas lecturas a ese mismo día?`)) return
    setGuardando(true)
    const { error, cantidad } = await guardarLecturasCaravana(supabase, { lecturas, tipo: 'control', fecha, corralId: parseInt(corralId) || null, usuario })
    setGuardando(false)
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    alert(`✓ Control guardado: ${cantidad} animales`)
    setTexto(''); await cargar(); setViendoFecha(fecha)
  }
  async function borrarControl(f) {
    if (!confirm(`¿Borrar el control del ${fmtF(f)}?`)) return
    await supabase.from('caravanas_lecturas').delete().eq('tipo', 'control').eq('fecha', f)
    setViendoFecha(null); await cargar()
  }

  const controlesGuardados = [...new Set(historial.filter(l => l.tipo === 'control').map(l => l.fecha))].sort().reverse()
  const card = { background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1rem 1.1rem', marginBottom: '1rem' }
  const lbl = { fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }
  const inp = { padding: '8px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box' }
  const colorGdp = g => g == null ? S.hint : g < alerta ? S.red : g >= 1.2 ? S.green : S.text

  if (cargando) return <div style={{ padding: '2rem', color: S.hint }}>Cargando lecturas…</div>

  return (
    <div>
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>📡 Control de peso por caravana</div>
        <div style={{ fontSize: 12, color: S.muted, marginBottom: 12 }}>Pesá los animales que quieras (no hace falta el corral entero) y pegá el reporte del lector. Cada caravana que tenga lectura de ingreso aparece con toda su historia.</div>
        {controlesGuardados.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12, fontSize: 12 }}>
            <span style={{ color: S.muted }}>Controles guardados:</span>
            <button onClick={() => setViendoFecha(null)} style={{ padding: '3px 10px', fontSize: 12, borderRadius: 5, border: `1px solid ${!viendoFecha ? S.accent : S.border}`, background: !viendoFecha ? S.accentLight : S.surface, color: !viendoFecha ? S.accent : S.muted, cursor: 'pointer' }}>+ Nuevo</button>
            {controlesGuardados.map(f => (
              <button key={f} onClick={() => setViendoFecha(f)} style={{ padding: '3px 10px', fontSize: 12, borderRadius: 5, border: `1px solid ${viendoFecha === f ? S.accent : S.border}`, background: viendoFecha === f ? S.accentLight : S.surface, color: viendoFecha === f ? S.accent : S.muted, cursor: 'pointer' }}>
                {fmtF(f)} · {historial.filter(l => l.tipo === 'control' && l.fecha === f).length}
              </button>
            ))}
          </div>
        )}
        {!viendoFecha ? (
          <>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              <div><div style={lbl}>Fecha del control</div><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inp} /></div>
              <div><div style={lbl}>Corral (opcional)</div>
                <select value={corralId} onChange={e => setCorralId(e.target.value)} style={{ ...inp, minWidth: 140 }}>
                  <option value="">—</option>{corrales.map(c => <option key={c.id} value={c.id}>Corral {c.numero}</option>)}
                </select>
              </div>
            </div>
            <div style={lbl}>Reporte del lector (caravana · peso · hora)</div>
            <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={6} placeholder={'032010031451655 412 08:41\n032010031451658 398 08:42'} style={{ ...inp, width: '100%', fontFamily: 'monospace' }} />
          </>
        ) : (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
            Control del <b>{fmtF(viendoFecha)}</b> · {lecturas.length} animales
            <button onClick={() => borrarControl(viendoFecha)} style={{ padding: '3px 10px', fontSize: 12, borderRadius: 5, border: '1px solid #F09595', background: S.redLight, color: S.red, cursor: 'pointer' }}>Borrar este control</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10, alignItems: 'flex-end' }}>
          <div><div style={lbl}>Peso de venta objetivo (kg)</div><input type="number" value={objetivo} onChange={e => setObjetivo(e.target.value)} style={{ ...inp, width: 110 }} /></div>
          <div>
            <div style={lbl}>Desbaste del control</div>
            <button onClick={() => setEditandoDesb(editandoDesb ? null : tablaDesb.map(r => ({ ...r })))} style={{ ...inp, cursor: 'pointer', color: S.accent }}>
              {tablaDesb.map(r => `${r.pct}%`).join(' · ')} ✏️
            </button>
          </div>
          <div><div style={lbl}>Avisar si el GDP es menor a</div><input type="number" step="0.1" value={gdpAlerta} onChange={e => setGdpAlerta(e.target.value)} style={{ ...inp, width: 110 }} /></div>
          {!viendoFecha && lecturas.length > 0 && <button onClick={guardar} disabled={guardando} style={{ padding: '9px 16px', fontSize: 13, fontWeight: 600, background: S.green, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando…' : `💾 Guardar control (${lecturas.length})`}</button>}
        </div>
      </div>

      {editandoDesb && (
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Desbaste a aplicar en los controles (peso lleno → desbastado)</div>
          <div style={{ fontSize: 12, color: S.muted, marginBottom: 10 }}>Al ingreso el ternero se pesa desbastado y en los controles, lleno. Se descuenta este % según el peso leído. Si lo cambiás, se recalculan todos los controles.</div>
          {editandoDesb.map((r, i) => {
            const desde = i === 0 ? 0 : (parseFloat(editandoDesb[i - 1].hasta) || 0) + 1
            const ultimo = i === editandoDesb.length - 1
            return (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 6 }}>
                <span style={{ width: 70, color: S.muted }}>{i === 0 ? 'Hasta' : `De ${desde}`}</span>
                {ultimo ? <span style={{ width: 90 }}>kg o más</span> : <><span>a</span><input type="number" value={r.hasta ?? ''} onChange={e => setEditandoDesb(editandoDesb.map((x, k) => k === i ? { ...x, hasta: e.target.value } : x))} style={{ ...inp, width: 80 }} /><span>kg</span></>}
                <input type="number" step="0.5" value={r.pct} onChange={e => setEditandoDesb(editandoDesb.map((x, k) => k === i ? { ...x, pct: e.target.value } : x))} style={{ ...inp, width: 70 }} /><span>%</span>
                {!ultimo && editandoDesb.length > 2 && <button onClick={() => setEditandoDesb(editandoDesb.filter((_, k) => k !== i))} style={{ background: 'none', border: 'none', color: S.red, cursor: 'pointer' }}>✕</button>}
              </div>
            )
          })}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => { const n = [...editandoDesb]; n.splice(n.length - 1, 0, { hasta: '', pct: '' }); setEditandoDesb(n) }} style={{ padding: '5px 10px', fontSize: 12, borderRadius: 5, border: `1px solid ${S.border}`, background: S.surface, cursor: 'pointer' }}>+ Rango</button>
            <button onClick={guardarDesbaste} style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 5, border: 'none', background: S.green, color: '#fff', cursor: 'pointer' }}>Guardar</button>
            <button onClick={() => setEditandoDesb(null)} style={{ padding: '5px 10px', fontSize: 12, borderRadius: 5, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}

      {lecturas.length > 0 && (
        <>
          {/* Aviso de coincidencias */}
          <div style={{ ...card, borderLeft: `4px solid ${conIngreso.length ? S.green : S.amber}` }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {conIngreso.length ? `✓ ${conIngreso.length} de ${lecturas.length} caravanas coinciden con una lectura de ingreso` : `Ninguna de las ${lecturas.length} caravanas tiene lectura de ingreso`}
            </div>
            {conIngreso.length > 0 && (
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 8, fontSize: 13 }}>
                <span>GDP promedio desde el ingreso: <b style={{ color: colorGdp(gdpProm) }}>{fmt(gdpProm, 2)} kg/día</b></span>
                <span>Peso promedio hoy: <b>{fmt(prom(conIngreso.map(f => f.pesoD)))} kg</b> <span style={{ color: S.hint }}>desbastado ({fmt(prom(conIngreso.map(f => f.peso)))} lleno)</span></span>
                <span>Días promedio en el feedlot: <b>{fmt(prom(conIngreso.map(f => f.d)))}</b></span>
                {atrasados.length > 0 && <span style={{ color: S.red, fontWeight: 700 }}>⚠ {atrasados.length} atrasado{atrasados.length !== 1 ? 's' : ''} (menos de {fmt(alerta, 1)} kg/día)</span>}
              </div>
            )}
            {sinIngreso.length > 0 && <div style={{ fontSize: 12, color: S.muted, marginTop: 6 }}>Sin lectura de ingreso: {sinIngreso.map(f => f.numero_caravana).join(', ')}</div>}
          </div>

          {/* Por lote / procedencia */}
          {Object.keys(porLote).length > 1 && (
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Por lote de compra</div>
              {Object.values(porLote).map((g, i) => (
                <div key={i} style={{ display: 'flex', gap: 14, fontSize: 13, padding: '4px 0', borderTop: i ? `1px solid ${S.border}` : 'none', flexWrap: 'wrap' }}>
                  <b style={{ minWidth: 220 }}>{g.lote?.procedencia || '—'} <span style={{ color: S.hint, fontWeight: 400 }}>{g.lote?.codigo || ''}</span></b>
                  <span>{g.filas.length} animales</span>
                  <span>GDP <b style={{ color: colorGdp(prom(g.filas.map(f => f.gdp).filter(x => x != null))) }}>{fmt(prom(g.filas.map(f => f.gdp).filter(x => x != null)), 2)}</b></span>
                  <span>Peso hoy {fmt(prom(g.filas.map(f => f.pesoD)))} kg desbastado</span>
                </div>
              ))}
            </div>
          )}

          {/* Animal por animal */}
          <div style={{ ...card, padding: 0, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: S.bg }}>
                  {['Caravana', 'Lote / procedencia', 'Ingreso', 'Peso ingreso', 'Días', 'Peso lleno', 'Desbastado', 'Kg ganados', 'GDP desde ingreso', 'Último control', 'GDP desde último', `Llega a ${objetivo} kg`].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Caravana' || h === 'Lote / procedencia' ? 'left' : 'right', fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', whiteSpace: 'nowrap', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...filas].sort((a, b) => (a.gdp ?? 99) - (b.gdp ?? 99)).map(f => (
                  <tr key={f.numero_caravana} style={{ borderBottom: `1px solid ${S.border}`, background: f.gdp != null && f.gdp < alerta ? S.redLight : 'transparent' }}>
                    <td style={{ padding: '6px 10px', fontFamily: 'monospace', userSelect: 'all' }}>{f.numero_caravana}</td>
                    <td style={{ padding: '6px 10px' }}>{f.ingreso ? `${f.ingreso.lotes?.procedencia || '—'}` : <span style={{ color: S.hint }}>sin lectura de ingreso</span>}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>{fmtF(f.ingreso?.fecha)}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{f.ingreso ? `${fmt(parseFloat(f.ingreso.peso))} kg` : '—'}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(f.d)}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', color: S.muted }}>{fmt(f.peso)} kg</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }} title={`−${f.pctD}% de desbaste`}>{fmt(f.pesoD)} kg <span style={{ fontSize: 10, color: S.hint, fontWeight: 400 }}>−{f.pctD}%</span></td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{f.kg != null ? `${f.kg > 0 ? '+' : ''}${fmt(f.kg)}` : '—'}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: colorGdp(f.gdp) }}>{fmt(f.gdp, 2)}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>{f.ultimo ? `${fmtF(f.ultimo.fecha)} · ${fmt(f.ultimoD)} kg` : '—'}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', color: colorGdp(f.gdpU) }}>{fmt(f.gdpU, 2)}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>{f.diasObj === 0 ? <b style={{ color: S.green }}>ya llegó</b> : f.fechaObj ? `${fmtF(f.fechaObj)} (${f.diasObj} d)` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
