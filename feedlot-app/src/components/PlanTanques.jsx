import { useState, useMemo } from 'react'
import { supabase } from '../supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Plan de tanques (Agricultura → Órdenes → 🚜 Plan de tanques)
//
// Junta órdenes de pulverización/fertilización que llevan LA MISMA MEZCLA
// (mismos productos y dosis) en una sola hoja para el pulverizador, armada
// tanque por tanque. Las órdenes siguen siendo una por campo (costos, stock,
// rentabilidad no cambian): esto es solo la hoja de trabajo.
//
// Dos formas de repartir:
//  - "llenos": la máquina sale siempre llena y el último tanque lleva el resto.
//  - "iguales": misma cantidad de tanques, todos con la misma carga (una sola
//    receta para todos; la máquina sale un poco por debajo de su capacidad).
// ─────────────────────────────────────────────────────────────────────────────

// Cálculo puro (lo va a usar también la app del celular)
export function planTanques({ destinos, caldo, tanque, modo }) {
  const total = destinos.reduce((s, d) => s + (parseFloat(d.ha) || 0), 0)
  caldo = parseFloat(caldo) || 0; tanque = parseFloat(tanque) || 0
  if (!total || !caldo || !tanque) return { total, tanques: [], haLleno: 0 }
  const haLleno = tanque / caldo
  const n = Math.max(1, Math.ceil(total / haLleno - 1e-9))
  const haTanques = modo === 'iguales'
    ? Array(n).fill(total / n)
    : Array.from({ length: n }, (_, i) => i < n - 1 ? haLleno : total - haLleno * (n - 1))
  let li = 0, resto = parseFloat(destinos[0]?.ha) || 0
  const tanques = haTanques.map(h => {
    let falta = h; const partes = []
    while (falta > 1e-9 && li < destinos.length) {
      const t = Math.min(falta, resto)
      if (t > 1e-9) partes.push({ nombre: destinos[li].nombre, ha: t })
      falta -= t; resto -= t
      if (resto <= 1e-9) { li++; resto = parseFloat(destinos[li]?.ha) || 0 }
    }
    return { ha: h, litros: h * caldo, partes, parcial: modo !== 'iguales' && h < haLleno - 0.01 }
  })
  return { total, tanques, haLleno }
}

const fmt = (x, d = 1) => (x == null || !isFinite(x)) ? '—' : x.toLocaleString('es-AR', { maximumFractionDigits: d })
const fmtCant = x => { const r = Math.round(x * 100) / 100; return fmt(Math.abs(r - Math.round(r)) < 0.011 ? Math.round(r) : r, r < 1 ? 3 : (r < 10 ? 2 : 1)) }
function enEnvases(cant, item) {
  const p = parseFloat(item?.presentacion_cant), q = parseFloat(cant)
  if (!p || !q) return ''
  const n = Math.ceil(q / p - 1e-9)
  const nom = item.presentacion_nombre || 'envase'
  const plural = n === 1 ? nom : (/ón$/.test(nom) ? nom.replace(/ón$/, 'ones') : (/[aeiou]$/i.test(nom) ? nom + 's' : nom + 'es'))
  return `${n} ${plural} de ${fmt(p, 1)} ${item.unidad || ''}`.trim()
}

export default function PlanTanques({ ordenes, campos, stockAgro, S, Label, inputStyle, onCerrar, mobile = false, contactos = [], onCambio }) {
  // ── Pulverizador de cada campo ──
  // Cada orden tiene su contratista; acá se puede cambiar (queda guardado en
  // la orden) y armar un plan por pulverizador, cada uno con el tanque de su
  // máquina (que queda recordado en su contacto).
  const [provOverride, setProvOverride] = useState({})
  const [pulvSel, setPulvSel] = useState('todos')
  const SIN = '(sin asignar)'
  const provDe = o => provOverride[o.id] ?? (o.proveedor || SIN)
  async function cambiarPulverizador(o, nombre) {
    setProvOverride(prev => ({ ...prev, [o.id]: nombre || SIN }))
    const { error } = await supabase.from('ordenes_trabajo').update({ proveedor: nombre || null }).eq('id', o.id)
    if (error) alert('No se pudo cambiar el pulverizador: ' + error.message)
    else onCambio && onCambio()
  }
  function elegirPulverizador(nombre) {
    setPulvSel(nombre)
    const c = contactos.find(x => x.nombre === nombre)
    if (c && parseFloat(c.tanque_pulverizadora_l) > 0) setTanque(String(c.tanque_pulverizadora_l))
  }
  async function recordarTanque() {
    const c = contactos.find(x => x.nombre === pulvSel)
    const v = parseFloat(tanque)
    if (c && v > 0 && v !== parseFloat(c.tanque_pulverizadora_l)) {
      await supabase.from('contactos').update({ tanque_pulverizadora_l: v }).eq('id', c.id)
      c.tanque_pulverizadora_l = v
    }
  }
  // En el celular: se puede ir tildando cada tanque a medida que se hace
  const [hechos, setHechos] = useState({})
  const [caldo, setCaldo] = useState('80')
  const [tanque, setTanque] = useState('3000')
  const [modo, setModo] = useState('llenos')
  const [incluirRealizadas, setIncluirRealizadas] = useState(false)
  const [grupoSel, setGrupoSel] = useState(null)
  const [elegidas, setElegidas] = useState({})   // { [grupoKey]: [ordenIds en orden de recorrido] }

  const nombreDe = o => {
    const c = campos.find(x => x.id === o.campo_id)
    const l = o.lote_id ? c?.lotes_agricolas?.find(x => x.id === o.lote_id) : null
    return `${c?.nombre || '—'}${l ? ` · L${l.numero}` : ''}`
  }

  // Órdenes candidatas y agrupación por mezcla (productos + dosis)
  const grupos = useMemo(() => {
    const hace15 = new Date(); hace15.setDate(hace15.getDate() - 15)
    const desde = `${hace15.getFullYear()}-${String(hace15.getMonth() + 1).padStart(2, '0')}-${String(hace15.getDate()).padStart(2, '0')}`
    const cand = ordenes.filter(o => ['Pulverizacion', 'Fertilizacion'].includes(o.tipo) && (o.productos || []).length
      && (o.estado === 'emitida' || (incluirRealizadas && o.fecha >= desde)))
    const g = {}
    cand.forEach(o => {
      const prods = (o.productos || []).filter(p => p.id && parseFloat(p.dosis) > 0)
        .map(p => ({ id: String(p.id), dosis: Math.round(parseFloat(p.dosis) * 10000) / 10000, exacta: parseFloat(p.dosis_exacta) || parseFloat(p.dosis), contratista: !!p.aporta_contratista }))
        .sort((a, b) => a.id.localeCompare(b.id))
      if (!prods.length) return
      const key = `${o.tipo}|` + prods.map(p => `${p.id}:${p.dosis}`).join(',')
      // Para calcular cantidades se usa la dosis exacta (la que sale del total
      // cargado en la orden); la de 3 decimales es solo para mostrar.
      if (!g[key]) g[key] = { key, tipo: o.tipo, prods: prods.map(p => ({ ...p, dosisMostrar: p.dosis, dosis: p.exacta })), ordenes: [] }
      g[key].ordenes.push(o)
    })
    return Object.values(g).sort((a, b) => b.ordenes.length - a.ordenes.length)
  }, [ordenes, incluirRealizadas])

  const idsDe = gr => elegidas[gr.key] ?? gr.ordenes.map(o => o.id)
  const setIds = (gr, ids) => setElegidas({ ...elegidas, [gr.key]: ids })
  const grupo = grupos.find(g => g.key === grupoSel) || null
  const ordenesGrupoTodas = grupo ? idsDe(grupo).map(id => grupo.ordenes.find(o => o.id === id)).filter(Boolean) : []
  const pulverizadoresGrupo = [...new Set(ordenesGrupoTodas.map(provDe))]
  const pulvActivo = pulvSel !== 'todos' && pulverizadoresGrupo.includes(pulvSel) ? pulvSel : 'todos'
  const ordenesGrupo = pulvActivo === 'todos' ? ordenesGrupoTodas : ordenesGrupoTodas.filter(o => provDe(o) === pulvActivo)
  const destinos = ordenesGrupo.map(o => ({ nombre: nombreDe(o), ha: parseFloat(o.superficie_ha_real) || 0 }))
  const plan = planTanques({ destinos, caldo, tanque, modo })
  const item = id => stockAgro.find(s => String(s.id) === String(id))

  // ── Hoja como IMAGEN (PNG) para mandar por WhatsApp ─────────────────────
  // Se dibuja en un canvas (sin librerías) y se comparte con el menú del
  // celular (WhatsApp, mail…). Si el navegador no puede compartir archivos,
  // se descarga.
  const [enviando, setEnviando] = useState(false)
  async function enviarImagen() {
    if (!grupo || !plan.tanques.length) return
    setEnviando(true)
    try {
      const W = 1080, M = 56
      const filas = []
      const L = (texto, o = {}) => filas.push({ texto, size: 30, peso: 'normal', color: '#222', gap: 8, ...o })
      const unidad = p => item(p.id)?.unidad === 'kg' ? 'kg' : 'L'
      const haCarga = modo === 'iguales' ? plan.total / plan.tanques.length : plan.haLleno
      L(`Plan de tanques — ${grupo.tipo === 'Fertilizacion' ? 'Fertilización' : 'Pulverización'}`, { size: 46, peso: 'bold', color: '#1A3D6B', gap: 6 })
      if (pulvActivo !== 'todos') L(`Pulverizador: ${pulvActivo}`, { size: 32, peso: 'bold', gap: 6 })
      L(`${new Date().toLocaleDateString('es-AR')} · ${fmt(plan.total)} ha · caldo ${fmt(parseFloat(caldo), 0)} L/ha · tanque ${fmt(parseFloat(tanque), 0)} L`, { size: 28, color: '#555' })
      L(modo === 'iguales' ? `${plan.tanques.length} tanques iguales de ${fmt(haCarga)} ha (${fmt(haCarga * parseFloat(caldo), 0)} L)` : `${plan.tanques.length} tanques · ${fmt(plan.haLleno)} ha por tanque lleno`, { size: 30, peso: 'bold', gap: 26 })
      L('RECORRIDO', { size: 26, peso: 'bold', color: '#1A3D6B', gap: 6 })
      destinos.forEach((d, i) => L(`${i + 1}. ${d.nombre} — ${fmt(d.ha)} ha`, { gap: 4, check: true }))
      filas[filas.length - 1].gap = 26
      L(modo === 'iguales' ? 'CARGA DE CADA TANQUE (todos iguales)' : 'CARGA DE CADA TANQUE LLENO', { size: 26, peso: 'bold', color: '#1A3D6B', gap: 6 })
      grupo.prods.forEach(p => L(`${item(p.id)?.insumo || '—'}:  ${fmtCant(p.dosis * haCarga)} ${unidad(p)}${p.contratista ? ' (lo pone el contratista)' : ''}`, { size: 32, peso: 'bold', gap: 4 }))
      filas[filas.length - 1].gap = 26
      L('TANQUE POR TANQUE', { size: 26, peso: 'bold', color: '#1A3D6B', gap: 8 })
      plan.tanques.forEach((t, i) => {
        L(`Tanque ${i + 1}${t.parcial ? ' — PARCIAL (carga distinta)' : ''} · ${fmt(t.ha)} ha · ${fmt(t.litros, 0)} L`, { size: 30, peso: 'bold', color: t.parcial ? '#B26B00' : '#222', gap: 2, barra: t.parcial ? '#B26B00' : '#1A3D6B', check: true })
        L(t.partes.map(x => `${x.nombre} ${fmt(x.ha)} ha`).join(' → '), { size: 27, color: '#555', gap: t.parcial ? 2 : 14, barra: t.parcial ? '#B26B00' : '#1A3D6B' })
        if (t.parcial) { grupo.prods.forEach(p => L(`${item(p.id)?.insumo || '—'}: ${fmtCant(p.dosis * t.ha)} ${unidad(p)}`, { size: 27, color: '#B26B00', gap: 2, barra: '#B26B00' })); filas[filas.length - 1].gap = 14 }
      })
      filas[filas.length - 1].gap = 26
      L('PARA LLEVAR DEL GALPÓN', { size: 26, peso: 'bold', color: '#1A3D6B', gap: 6 })
      grupo.prods.filter(p => !p.contratista).forEach(p => { const it = item(p.id); const tot = p.dosis * plan.total; const env = enEnvases(tot, it); L(`${it?.insumo || '—'}: ${fmtCant(tot)} ${unidad(p)}${env ? `  →  ${env}` : ''}`, { gap: 4 }) })

      // Medir (con cortes de línea) y dibujar
      const cv = document.createElement('canvas'); const ctx = cv.getContext('2d')
      const partir = (f) => {
        ctx.font = `${f.peso} ${f.size}px Arial, sans-serif`
        const ancho = W - 2 * M - (f.barra ? 24 : 0) - (f.check ? f.size + 12 : 0)
        const palabras = String(f.texto).split(' '); const lineas = []; let act = ''
        palabras.forEach(w => { const prueba = act ? act + ' ' + w : w; if (ctx.measureText(prueba).width > ancho && act) { lineas.push(act); act = w } else act = prueba })
        if (act) lineas.push(act)
        return lineas
      }
      let H = M
      filas.forEach(f => { f.lineas = partir(f); H += f.lineas.length * f.size * 1.3 + f.gap })
      H += M
      cv.width = W; cv.height = Math.ceil(H)
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, cv.height)
      let y = M
      filas.forEach(f => {
        ctx.font = `${f.peso} ${f.size}px Arial, sans-serif`; ctx.fillStyle = f.color; ctx.textBaseline = 'top'
        const alto = f.lineas.length * f.size * 1.3
        if (f.barra) { ctx.fillStyle = f.barra; ctx.fillRect(M, y - 2, 8, alto + f.gap); ctx.fillStyle = f.color }
        const x0 = M + (f.barra ? 24 : 0)
        if (f.check) { ctx.strokeStyle = f.color; ctx.lineWidth = 3; ctx.strokeRect(x0, y + f.size * 0.08, f.size * 0.85, f.size * 0.85) }
        f.lineas.forEach((ln, k) => ctx.fillText(ln, x0 + (f.check ? f.size + 12 : 0), y + k * f.size * 1.3))
        y += alto + f.gap
      })
      const blob = await new Promise(r => cv.toBlob(r, 'image/png'))
      const hoy = new Date()
      const nombre = `plan-tanques-${String(hoy.getDate()).padStart(2, '0')}-${String(hoy.getMonth() + 1).padStart(2, '0')}.png`
      const archivo = new File([blob], nombre, { type: 'image/png' })
      if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
        try { await navigator.share({ files: [archivo], title: 'Plan de tanques', text: `Plan de tanques · ${fmt(plan.total)} ha` }) } catch (e) { /* canceló */ }
      } else {
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre; document.body.appendChild(a); a.click(); a.remove()
        setTimeout(() => URL.revokeObjectURL(a.href), 5000)
      }
    } finally { setEnviando(false) }
  }

  function imprimir() {
    if (!grupo || !plan.tanques.length) return
    const prods = grupo.prods
    const filaProd = (h) => prods.map(p => `<tr><td>${item(p.id)?.insumo || '—'}${p.contratista ? ' <i>(lo pone el contratista)</i>' : ''}</td><td class="n">${fmtCant(p.dosis * h)} ${item(p.id)?.unidad || ''}</td></tr>`).join('')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Plan de tanques</title>
<style>body{font-family:Arial,sans-serif;max-width:800px;margin:20px auto;color:#222;font-size:13px}h1{font-size:20px;margin:0}h2{font-size:14px;margin:18px 0 6px;color:#1A3D6B;text-transform:uppercase;letter-spacing:.05em}
table{width:100%;border-collapse:collapse}td,th{padding:5px 8px;border-bottom:1px solid #ddd;text-align:left}.n{text-align:right;font-family:monospace;font-weight:bold}
.tq{border:1.5px solid #1A3D6B;border-radius:6px;padding:8px 12px;margin-bottom:10px;page-break-inside:avoid}.tq.p{border-color:#B26B00}.chk{display:inline-block;width:14px;height:14px;border:1.5px solid #333;margin-right:6px;vertical-align:-2px}
@media print{button{display:none}}</style></head><body>
<button onclick="window.print()" style="float:right;padding:6px 14px">Imprimir</button>
<h1>Plan de tanques — ${grupo.tipo === 'Fertilizacion' ? 'Fertilización' : 'Pulverización'}</h1>${pulvActivo !== 'todos' ? `<div style="font-size:15px;font-weight:bold;margin:4px 0">Pulverizador: ${pulvActivo}</div>` : ''}
<div>${new Date().toLocaleDateString('es-AR')} · ${destinos.length} lotes · <b>${fmt(plan.total)} ha</b> · caldo <b>${fmt(parseFloat(caldo), 0)} L/ha</b> · tanque <b>${fmt(parseFloat(tanque), 0)} L</b> · ${modo === 'iguales' ? `<b>${plan.tanques.length} tanques iguales</b> de ${fmt(plan.total / plan.tanques.length)} ha` : `<b>${plan.tanques.length} tanques</b> (${fmt(plan.haLleno)} ha por tanque lleno)`}</div>
<h2>Recorrido</h2><table>${destinos.map((d, i) => `<tr><td><span class="chk"></span>${i + 1}. ${d.nombre}</td><td class="n">${fmt(d.ha)} ha</td></tr>`).join('')}</table>
<h2>${modo === 'iguales' ? 'Carga de cada tanque (todos iguales)' : 'Carga de cada tanque lleno'}</h2>
<table>${filaProd(modo === 'iguales' ? plan.total / plan.tanques.length : plan.haLleno)}</table>
<h2>Tanque por tanque</h2>
${plan.tanques.map((t, i) => `<div class="tq${t.parcial ? ' p' : ''}"><b><span class="chk"></span>Tanque ${i + 1}${t.parcial ? ' — PARCIAL (carga distinta)' : ''}</b> · ${fmt(t.ha)} ha · ${fmt(t.litros, 0)} L de agua<br>${t.partes.map(p => `${p.nombre}: ${fmt(p.ha)} ha`).join(' → ')}${t.parcial ? `<table style="margin-top:6px">${filaProd(t.ha)}</table>` : ''}</div>`).join('')}
<h2>Para llevar del galpón (total)</h2>
<table>${grupo.prods.filter(p => !p.contratista).map(p => { const it = item(p.id); const tot = p.dosis * plan.total; return `<tr><td>${it?.insumo || '—'}</td><td class="n">${fmtCant(tot)} ${it?.unidad || ''}</td><td>${enEnvases(tot, it)}</td></tr>` }).join('')}</table>
<p style="margin-top:20px;color:#666;font-size:11px">Las cantidades por tanque salen de la dosis por hectárea de las órdenes. Cada campo sigue registrado en su propia orden.</p>
</body></html>`
    const w = window.open('', '_blank'); if (!w) { alert('Habilitá las ventanas emergentes para imprimir'); return }
    w.document.write(html); w.document.close()
  }

  const btn = (activo) => ({ padding: '6px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer', border: `1px solid ${activo ? S.accent : S.border}`, background: activo ? S.accentLight : S.surface, color: activo ? S.accent : S.muted, fontWeight: activo ? 600 : 400 })

  return (
    <div style={{ background: S.surface, border: `1px solid ${S.accent}`, borderRadius: 10, padding: '1rem 1.1rem', marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>🚜 Plan de tanques</div>
          <div style={{ fontSize: 12, color: S.muted }}>Órdenes con la misma mezcla, agrupadas en una sola hoja para el pulverizador. Cada campo sigue con su propia orden.</div>
        </div>
        <button onClick={onCerrar} style={btn(false)}>Cerrar</button>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
        <div style={{ width: 140 }}><Label>Caldo (L/ha)</Label><input type="number" value={caldo} onChange={e => setCaldo(e.target.value)} style={inputStyle} /></div>
        <div style={{ width: 160 }}><Label>Tanque del equipo (L)</Label><input type="number" value={tanque} onChange={e => setTanque(e.target.value)} onBlur={recordarTanque} style={inputStyle} /></div>
        <div>
          <Label>Cómo repartir</Label>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setModo('llenos')} style={btn(modo === 'llenos')}>Tanques llenos + resto</button>
            <button onClick={() => setModo('iguales')} style={btn(modo === 'iguales')}>Todos iguales</button>
          </div>
        </div>
        <label style={{ fontSize: 12, color: S.muted, display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={incluirRealizadas} onChange={e => setIncluirRealizadas(e.target.checked)} /> Incluir órdenes ya hechas (últimos 15 días)
        </label>
      </div>

      {grupos.length === 0 && <div style={{ fontSize: 13, color: S.hint }}>No hay órdenes de pulverización emitidas (sin hacer). Emití las órdenes de cada campo y aparecen acá agrupadas por mezcla.</div>}

      {/* Grupos de órdenes con la misma mezcla */}
      {grupos.map((g, gi) => {
        const ids = idsDe(g)
        const ha = g.ordenes.filter(o => ids.includes(o.id)).reduce((s, o) => s + (parseFloat(o.superficie_ha_real) || 0), 0)
        const abierto = grupoSel === g.key
        return (
          <div key={g.key} style={{ border: `1px solid ${abierto ? S.accent : S.border}`, borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ fontSize: 13 }}>
                <b>Mezcla {gi + 1}</b> <span style={{ color: S.muted }}>· {g.tipo === 'Fertilizacion' ? 'fertilización' : 'pulverización'} · {g.ordenes.length} orden{g.ordenes.length !== 1 ? 'es' : ''}</span>
                <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>{g.prods.map(p => `${item(p.id)?.insumo || '?'} ${fmtCant(p.dosisMostrar)} ${item(p.id)?.unidad === 'kg' ? 'kg' : 'L'}/ha`).join(' · ')}</div>
              </div>
              <button onClick={() => setGrupoSel(abierto ? null : g.key)} style={btn(abierto)}>{abierto ? 'Ocultar plan' : `Armar plan · ${fmt(ha)} ha`}</button>
            </div>
            <div style={{ marginTop: 6 }}>
              {/* Campos del grupo: tildar los que se combinan y ordenar el recorrido */}
              {[...ids.map(id => g.ordenes.find(o => o.id === id)).filter(Boolean), ...g.ordenes.filter(o => !ids.includes(o.id))].map(o => {
                const sel = ids.includes(o.id); const pos = ids.indexOf(o.id)
                return (
                  <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '3px 0', color: sel ? S.text : S.hint }}>
                    <input type="checkbox" checked={sel} onChange={() => setIds(g, sel ? ids.filter(x => x !== o.id) : [...ids, o.id])} />
                    <span style={{ width: 22, color: S.muted }}>{sel ? `${pos + 1}.` : ''}</span>
                    <select value={provDe(o) === SIN ? '' : provDe(o)} onChange={e => cambiarPulverizador(o, e.target.value)} title="Pulverizador que hace este campo"
                      style={{ maxWidth: mobile ? 120 : 170, padding: '2px 4px', fontSize: 11, borderRadius: 5, border: `1px solid ${S.border}`, background: S.surface, color: S.text }}>
                      <option value="">— pulverizador —</option>
                      {[...new Set([...contactos.map(c => c.nombre), ...(o.proveedor ? [o.proveedor] : [])])].sort().map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <span style={{ flex: 1 }}>{nombreDe(o)} · {fmt(parseFloat(o.superficie_ha_real) || 0)} ha <span style={{ color: S.hint }}>· {o.estado === 'emitida' ? 'emitida' : 'hecha'} {o.fecha ? new Date(o.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : ''}</span></span>
                    {sel && <>
                      <button disabled={pos === 0} onClick={() => { const a = [...ids]; [a[pos - 1], a[pos]] = [a[pos], a[pos - 1]]; setIds(g, a) }} style={{ ...btn(false), padding: '1px 7px' }} title="Subir en el recorrido">↑</button>
                      <button disabled={pos === ids.length - 1} onClick={() => { const a = [...ids]; [a[pos + 1], a[pos]] = [a[pos], a[pos + 1]]; setIds(g, a) }} style={{ ...btn(false), padding: '1px 7px' }} title="Bajar en el recorrido">↓</button>
                    </>}
                  </div>
                )
              })}
            </div>

            {/* Plan */}
            {abierto && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${S.border}` }}>
                {pulverizadoresGrupo.length > 1 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8, fontSize: 12 }}>
                    <span style={{ color: S.muted }}>Plan de:</span>
                    {['todos', ...pulverizadoresGrupo].map(n => (
                      <button key={n} onClick={() => elegirPulverizador(n)} style={btn(pulvActivo === n)}>
                        {n === 'todos' ? 'Todos juntos' : `${n} · ${fmt(ordenesGrupoTodas.filter(o => provDe(o) === n).reduce((t, o) => t + (parseFloat(o.superficie_ha_real) || 0), 0))} ha`}
                      </button>
                    ))}
                  </div>
                )}
                {!plan.tanques.length ? <div style={{ fontSize: 12, color: S.hint }}>Tildá al menos un campo y cargá caldo y tanque.</div> : <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    <div style={{ fontSize: 13 }}>
                      <b>{fmt(plan.total)} ha</b> · {modo === 'iguales' ? <><b>{plan.tanques.length} tanques iguales</b> de {fmt(plan.total / plan.tanques.length)} ha ({fmt(plan.total / plan.tanques.length * parseFloat(caldo), 0)} L)</> : <><b>{plan.tanques.length} tanques</b> · {fmt(plan.haLleno)} ha por tanque lleno</>}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={enviarImagen} disabled={enviando} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.accent, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{enviando ? 'Armando…' : '📤 Enviar hoja (imagen)'}</button>
                      <button onClick={imprimir} style={{ padding: '7px 12px', fontSize: 12, background: 'transparent', border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 6, cursor: 'pointer' }}>🖨 Imprimir</button>
                    </div>
                  </div>
                  {mobile && plan.tanques.length > 0 && (
                    <div style={{ fontSize: 12, color: S.muted, marginBottom: 6 }}>Tanques hechos: <b style={{ color: S.accent }}>{plan.tanques.filter((_, i) => hechos[`${g.key}-${pulvActivo}-${i}`]).length} de {plan.tanques.length}</b> · tocá ✓ en cada uno cuando lo termines</div>
                  )}
                  {plan.tanques.map((t, i) => (
                    <div key={i} style={{ border: `1px solid ${t.parcial ? S.amber : S.border}`, borderRadius: 8, padding: mobile ? '10px 12px' : '6px 10px', marginBottom: 6, background: hechos[`${g.key}-${pulvActivo}-${i}`] ? S.bg : (t.parcial ? S.amberLight : 'transparent'), opacity: hechos[`${g.key}-${pulvActivo}-${i}`] ? 0.55 : 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontSize: mobile ? 15 : 13, fontWeight: 600 }}>Tanque {i + 1}{t.parcial ? ' · parcial' : ''} <span style={{ fontWeight: 400, color: S.muted }}>— {fmt(t.ha)} ha · {fmt(t.litros, 0)} L</span></div>
                        {mobile && <button onClick={() => setHechos({ ...hechos, [`${g.key}-${pulvActivo}-${i}`]: !hechos[`${g.key}-${pulvActivo}-${i}`] })} style={{ minWidth: 44, height: 36, borderRadius: 8, border: `1px solid ${S.accent}`, background: hechos[`${g.key}-${pulvActivo}-${i}`] ? S.accent : 'transparent', color: hechos[`${g.key}-${pulvActivo}-${i}`] ? '#fff' : S.accent, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>✓</button>}
                      </div>
                      <div style={{ fontSize: 12, color: S.muted }}>{t.partes.map(p => `${p.nombre} ${fmt(p.ha)} ha`).join(' → ')}</div>
                      {(mobile || i === 0 || t.parcial) && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '2px 14px', fontSize: 12, marginTop: 4 }}>
                          {g.prods.map(p => <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{item(p.id)?.insumo}</span><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{fmtCant(p.dosis * t.ha)} {item(p.id)?.unidad === 'kg' ? 'kg' : 'L'}</span></div>)}
                        </div>
                      )}
                      {!mobile && i === 0 && plan.tanques.length > 1 && <div style={{ fontSize: 11, color: S.hint, marginTop: 2 }}>{modo === 'iguales' ? 'Todos los tanques llevan esta misma carga.' : 'Los tanques llenos llevan esta carga; el parcial, la suya.'}</div>}
                    </div>
                  ))}
                </>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
