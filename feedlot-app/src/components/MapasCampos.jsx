import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Mapas de los campos (Agricultura → 🗺 Mapas)
//
// Hojas dibujadas (Paint, foto, PDF pasado a imagen…) con los campos y el
// nombre de cada lote. Cada mapa dice qué campos aparecen en él, y desde una
// orden, el plan de tanques o el celular se abre el de ese campo.
// Las imágenes van a un depósito PRIVADO (Storage "mapas"): solo los
// usuarios de la app las ven.
// ─────────────────────────────────────────────────────────────────────────────

// Lista compartida entre pantallas (se carga una vez)
let cache = null
let escuchas = []
export async function cargarMapas(forzar = false) {
  if (cache && !forzar) return cache
  const { data } = await supabase.from('mapas_campos').select('*').order('nombre')
  cache = data || []
  escuchas.forEach(f => f(cache))
  return cache
}
export function useMapas() {
  const [mapas, setMapas] = useState(cache || [])
  useEffect(() => {
    escuchas.push(setMapas)
    cargarMapas()
    return () => { escuchas = escuchas.filter(f => f !== setMapas) }
  }, [])
  return mapas
}
export const mapasDeCampo = (mapas, campoId) => mapas.filter(m => (m.campo_ids || []).map(Number).includes(Number(campoId)))

async function urlFirmada(path) {
  const { data } = await supabase.storage.from('mapas').createSignedUrl(path, 3600)
  return data?.signedUrl || null
}
// Archivo del mapa (para compartir por WhatsApp junto con otra cosa)
export async function archivoDeMapa(m) {
  const url = await urlFirmada(m.path)
  if (!url) return null
  const blob = await (await fetch(url)).blob()
  const ext = (m.path.split('.').pop() || 'png').toLowerCase()
  return new File([blob], `mapa-${m.nombre.replace(/[^\w-]+/g, '_')}.${ext}`, { type: blob.type || 'image/png' })
}

// ── Visor (pantalla completa, con zoom) ──
export function VisorMapa({ mapa, onCerrar, resaltar }) {
  const [url, setUrl] = useState(null)
  const [zoom, setZoom] = useState(1)
  useEffect(() => { let ok = true; urlFirmada(mapa.path).then(u => ok && setUrl(u)); return () => { ok = false } }, [mapa.path])
  async function compartir() {
    const f = await archivoDeMapa(mapa)
    if (!f) return
    if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], title: mapa.nombre }) } catch (e) { /* canceló */ } }
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); a.remove() }
  }
  const b = { padding: '8px 14px', fontSize: 15, fontWeight: 700, borderRadius: 8, border: '1px solid #555', background: '#222', color: '#fff', cursor: 'pointer' }
  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,.85)', display: 'flex', flexDirection: 'column' }}>
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', color: '#fff', flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700, fontSize: 15, flex: 1, minWidth: 140 }}>🗺 {mapa.nombre}{resaltar ? <span style={{ fontWeight: 400, color: '#bbb' }}> · {resaltar}</span> : null}</div>
        <button style={b} onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}>−</button>
        <span style={{ fontSize: 13, minWidth: 44, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        <button style={b} onClick={() => setZoom(z => Math.min(5, z + 0.25))}>+</button>
        <button style={b} onClick={() => setZoom(1)}>Ajustar</button>
        <button style={b} onClick={compartir}>📤</button>
        <button style={b} onClick={onCerrar}>✕</button>
      </div>
      <div onClick={e => e.stopPropagation()} style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: zoom <= 1 ? 'center' : 'flex-start', justifyContent: zoom <= 1 ? 'center' : 'flex-start', padding: 8 }}>
        {!url ? <div style={{ color: '#ccc', margin: 'auto' }}>Cargando…</div>
          : <img src={url} alt={mapa.nombre} style={zoom <= 1 ? { maxWidth: `${zoom * 100}%`, maxHeight: `${zoom * 100}%`, objectFit: 'contain', background: '#fff' } : { width: `${zoom * 100}%`, maxWidth: 'none', background: '#fff' }} />}
      </div>
    </div>
  )
}

// ── Botón "🗺" para cualquier pantalla: abre el/los mapas de un campo ──
export function BotonMapa({ campoId, etiqueta = '🗺', titulo, estilo }) {
  const mapas = useMapas()
  const [abierto, setAbierto] = useState(null)
  const [elegir, setElegir] = useState(false)
  const delCampo = mapasDeCampo(mapas, campoId)
  if (!delCampo.length) return null
  return (
    <>
      <button type="button" title={`Ver mapa${delCampo.length > 1 ? 's' : ''} de ${titulo || 'este campo'}`}
        onClick={e => { e.stopPropagation(); delCampo.length === 1 ? setAbierto(delCampo[0]) : setElegir(!elegir) }}
        style={{ padding: '1px 6px', fontSize: 12, borderRadius: 5, border: '1px solid #9bb5d6', background: '#EEF3FA', color: '#1A3D6B', cursor: 'pointer', lineHeight: 1.4, ...estilo }}>{etiqueta}</button>
      {elegir && (
        <span style={{ display: 'inline-flex', gap: 4, marginLeft: 4 }}>
          {delCampo.map(m => <button key={m.id} type="button" onClick={() => { setAbierto(m); setElegir(false) }} style={{ padding: '1px 6px', fontSize: 11, borderRadius: 5, border: '1px solid #9bb5d6', background: '#fff', color: '#1A3D6B', cursor: 'pointer' }}>{m.nombre}</button>)}
        </span>
      )}
      {abierto && <VisorMapa mapa={abierto} resaltar={titulo} onCerrar={() => setAbierto(null)} />}
    </>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// Contornos de lotes sobre el mapa (tabla mapas_lotes). Coordenadas de 0 a 1.
// ─────────────────────────────────────────────────────────────────────────────
let cachePol = null
export async function cargarPoligonos(forzar = false) {
  if (cachePol && !forzar) return cachePol
  const { data } = await supabase.from('mapas_lotes').select('*')
  cachePol = data || []
  return cachePol
}

// Opciones para marcar en un mapa: cada lote de sus campos; si el campo no
// tiene lotes cargados, el campo entero.
function opcionesDeMapa(mapa, campos) {
  const ops = []
  ;(mapa.campo_ids || []).forEach(cid => {
    const c = campos.find(x => x.id === Number(cid)); if (!c) return
    const lotes = (c.lotes_agricolas || []).slice().sort((a, b) => String(a.numero).localeCompare(String(b.numero), undefined, { numeric: true }))
    if (!lotes.length) ops.push({ key: `${c.id}-0`, campo_id: c.id, lote_id: null, nombre: c.nombre })
    else lotes.forEach(l => ops.push({ key: `${c.id}-${l.id}`, campo_id: c.id, lote_id: l.id, nombre: `${c.nombre} · Lote ${l.numero}` }))
  })
  return ops
}

export function MarcadorLotes({ mapa, campos, onCerrar }) {
  const [url, setUrl] = useState(null)
  const [pols, setPols] = useState([])
  const [sel, setSel] = useState(null)
  const [partes, setPartes] = useState([[]])   // partes del lote que se está marcando
  const [zoom, setZoom] = useState(1)
  const [guardando, setGuardando] = useState(false)
  const ops = opcionesDeMapa(mapa, campos)
  useEffect(() => { urlFirmada(mapa.path).then(setUrl); cargarPoligonos(true).then(t => setPols(t.filter(p => p.mapa_id === mapa.id))) }, [mapa.id, mapa.path])
  const polDe = o => pols.find(p => p.campo_id === o.campo_id && (p.lote_id || null) === (o.lote_id || null))
  function elegir(o) { setSel(o); const ex = polDe(o); setPartes(ex ? ex.partes.map(pt => pt.slice()) : [[]]) }
  function tocar(e) {
    if (!sel) { alert('Primero elegí arriba qué lote vas a marcar'); return }
    const r = e.currentTarget.getBoundingClientRect()
    const x = Math.round((e.clientX - r.left) / r.width * 10000) / 10000, y = Math.round((e.clientY - r.top) / r.height * 10000) / 10000
    setPartes(prev => { const n = prev.map(p => p.slice()); n[n.length - 1].push([x, y]); return n })
  }
  async function guardar() {
    const limpias = partes.filter(p => p.length >= 3)
    if (!limpias.length) { alert('Marcá al menos 3 esquinas'); return }
    setGuardando(true)
    const ex = polDe(sel)
    const { error } = ex
      ? await supabase.from('mapas_lotes').update({ partes: limpias }).eq('id', ex.id)
      : await supabase.from('mapas_lotes').insert({ mapa_id: mapa.id, campo_id: sel.campo_id, lote_id: sel.lote_id, partes: limpias })
    setGuardando(false)
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    const t = await cargarPoligonos(true); setPols(t.filter(p => p.mapa_id === mapa.id))
    const i = ops.findIndex(o => o.key === sel.key); const sig = ops.slice(i + 1).find(o => !polDe(o))
    if (sig) elegir(sig); else { setSel(null); setPartes([[]]) }
  }
  async function borrar() {
    const ex = polDe(sel); if (!ex || !confirm(`¿Borrar el contorno de ${sel.nombre}?`)) return
    await supabase.from('mapas_lotes').delete().eq('id', ex.id)
    const t = await cargarPoligonos(true); setPols(t.filter(p => p.mapa_id === mapa.id)); setPartes([[]])
  }
  const b = (activo) => ({ padding: '7px 12px', fontSize: 13, borderRadius: 7, border: `1px solid ${activo ? '#F2B400' : '#555'}`, background: activo ? '#F2B400' : '#222', color: activo ? '#111' : '#fff', cursor: 'pointer', fontWeight: activo ? 700 : 400 })
  const puntos = pt => pt.map(([x, y]) => `${x * 1000},${y * 1000}`).join(' ')
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,.9)', display: 'flex', flexDirection: 'column', color: '#fff' }}>
      <div style={{ padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700, marginRight: 8 }}>✏️ Marcar lotes · {mapa.nombre}</div>
        {ops.map(o => <button key={o.key} onClick={() => elegir(o)} style={b(sel?.key === o.key)}>{polDe(o) ? '✓ ' : ''}{o.nombre}</button>)}
        <div style={{ flex: 1 }} />
        <button style={b(false)} onClick={() => setZoom(z => Math.max(1, z - 0.5))}>−</button>
        <button style={b(false)} onClick={() => setZoom(z => Math.min(4, z + 0.5))}>+</button>
        <button style={b(false)} onClick={onCerrar}>Cerrar</button>
      </div>
      <div style={{ padding: '0 12px 8px', fontSize: 13, color: '#ddd', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {sel ? <>Marcando <b style={{ color: '#F2B400' }}>{sel.nombre}</b>: tocá las esquinas del lote en orden, siguiendo el borde.
          <button style={b(false)} onClick={() => setPartes(prev => { const n = prev.map(p => p.slice()); n[n.length - 1].pop(); return n })}>↶ Deshacer punto</button>
          <button style={b(false)} onClick={() => setPartes(prev => [...prev, []])} title="Si el lote tiene otra parte separada">+ Otra parte</button>
          <button style={b(false)} onClick={() => setPartes([[]])}>Empezar de nuevo</button>
          {polDe(sel) && <button style={b(false)} onClick={borrar}>Borrar contorno</button>}
          <button style={{ ...b(true), background: '#2E7D32', borderColor: '#2E7D32', color: '#fff' }} onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : '✓ Guardar lote'}</button>
        </> : 'Elegí arriba el lote que vas a marcar. Los que tienen ✓ ya están marcados.'}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {!url ? <div style={{ margin: 'auto', color: '#ccc' }}>Cargando…</div> : (
          <div style={{ position: 'relative', width: `${zoom * 100}%`, maxWidth: zoom === 1 ? 1200 : 'none', margin: zoom === 1 ? '0 auto' : 0 }}>
            <img src={url} alt="" style={{ width: '100%', display: 'block', background: '#fff', userSelect: 'none' }} draggable={false} />
            <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" onClick={tocar} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: sel ? 'crosshair' : 'default' }}>
              {pols.filter(p => !(sel && p.campo_id === sel.campo_id && (p.lote_id || null) === (sel.lote_id || null))).map(p => p.partes.map((pt, k) => (
                <polygon key={`${p.id}-${k}`} points={puntos(pt)} fill="rgba(46,125,50,.28)" stroke="#2E7D32" strokeWidth="3" vectorEffect="non-scaling-stroke" />
              )))}
              {partes.map((pt, k) => pt.length >= 2 && (
                <polygon key={`n${k}`} points={puntos(pt)} fill="rgba(242,180,0,.35)" stroke="#F2B400" strokeWidth="3" vectorEffect="non-scaling-stroke" />
              ))}
              {partes.flatMap((pt, k) => pt.map(([x, y], i) => <circle key={`c${k}-${i}`} cx={x * 1000} cy={y * 1000} r="5" fill="#F2B400" stroke="#111" strokeWidth="1" vectorEffect="non-scaling-stroke" />))}
            </svg>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Hoja con mapa: los mapas de los campos de una mezcla, con los lotes que se
// aplican pintados, y el recuadro con hectáreas y receta (como las hojas que
// se armaban a mano en Paint). Devuelve un archivo PNG.
//   destinos: [{ campo_id, lote_id }]   ·   receta: [{ nombre, dosis, total, unidad }]
// ─────────────────────────────────────────────────────────────────────────────
function cargarImagen(url) {
  return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = rej; im.src = url })
}
const fmtN = (x, d = 3) => (x == null || !isFinite(x)) ? '—' : Number(x).toLocaleString('es-AR', { maximumFractionDigits: d })
export async function generarHojaConMapa({ titulo, subtitulo, operario, lotes = [], destinos, ha, receta, color = '#FFC800', fecha = new Date() }) {
  const mapas = await cargarMapas()
  const pols = await cargarPoligonos(true)
  const camposIds = [...new Set(destinos.map(d => Number(d.campo_id)))]
  const mapasUsados = mapas.filter(m => (m.campo_ids || []).some(id => camposIds.includes(Number(id))))
  if (!mapasUsados.length) throw new Error('Esos campos no tienen mapa cargado')
  const imagenes = []
  for (const m of mapasUsados) {
    const u = await urlFirmada(m.path); const im = await cargarImagen(u)
    // Recortar el blanco de los bordes del dibujo (Paint deja mucho lienzo vacío)
    const t = document.createElement('canvas'); t.width = im.naturalWidth; t.height = im.naturalHeight
    const tc = t.getContext('2d'); tc.drawImage(im, 0, 0)
    let x1 = im.naturalWidth, y1 = im.naturalHeight, x2 = 0, y2 = 0
    try {
      const px = tc.getImageData(0, 0, im.naturalWidth, im.naturalHeight).data
      for (let yy = 0; yy < im.naturalHeight; yy += 2) for (let xx = 0; xx < im.naturalWidth; xx += 2) {
        const k = (yy * im.naturalWidth + xx) * 4
        if (px[k + 3] > 0 && (px[k] < 200 || px[k + 1] < 200 || px[k + 2] < 200)) { if (xx < x1) x1 = xx; if (xx > x2) x2 = xx; if (yy < y1) y1 = yy; if (yy > y2) y2 = yy }
      }
    } catch (e) { x1 = 0; y1 = 0; x2 = im.naturalWidth; y2 = im.naturalHeight }
    if (x2 <= x1 || y2 <= y1) { x1 = 0; y1 = 0; x2 = im.naturalWidth; y2 = im.naturalHeight }
    const mg = 20
    const rc = { x: Math.max(0, x1 - mg), y: Math.max(0, y1 - mg) }
    rc.w = Math.min(im.naturalWidth, x2 + mg) - rc.x; rc.h = Math.min(im.naturalHeight, y2 + mg) - rc.y
    imagenes.push({ m, im, rc })
  }
  const W = Math.max(...imagenes.map(x => x.rc.w), 1100)
  const M = 44                              // margen
  const ENC = 150                           // encabezado verde
  const filaProd = r => r.envases ? 82 : 58
  const altoTabla = 60 + 46 + receta.reduce((t, r) => t + filaProd(r), 0) + 20
  const altoLotes = lotes.length ? 44 + Math.ceil(lotes.length / 2) * 34 : 0
  let H = ENC + 20
  imagenes.forEach(x => { H += x.rc.h * (W / x.rc.w) + 16 })
  H += 30 + (operario ? 50 : 0) + altoLotes + altoTabla + M
  const cv = document.createElement('canvas'); cv.width = W; cv.height = Math.ceil(H)
  const ctx = cv.getContext('2d')
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.textBaseline = 'alphabetic'

  // ── Encabezado verde (igual que la orden de trabajo que se imprime por campo) ──
  const g = ctx.createLinearGradient(0, 0, W, ENC); g.addColorStop(0, '#1F4D35'); g.addColorStop(1, '#2E6B4F')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, ENC)
  ctx.fillStyle = '#fff'; ctx.font = 'bold 44px Arial'
  ctx.fillText(`ORDEN DE TRABAJO — ${(titulo || 'Pulverización').toUpperCase()}`, M, 72)
  ctx.font = '28px Arial'; ctx.fillStyle = 'rgba(255,255,255,.92)'
  ctx.fillText(`${subtitulo ? subtitulo + ' · ' : ''}${fmtN(ha, 2)} ha · ${fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`, M, 116)

  // ── Mapas con los lotes pintados ──
  let y = ENC + 20
  const sinMarcar = []
  for (const { m, im, rc } of imagenes) {
    const esc = W / rc.w, h = rc.h * esc
    ctx.drawImage(im, rc.x, rc.y, rc.w, rc.h, 0, y, W, h)
    const aX = px => (px * im.naturalWidth - rc.x) * esc, aY = py => y + (py * im.naturalHeight - rc.y) * esc
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = color
    destinos.filter(d => (m.campo_ids || []).map(Number).includes(Number(d.campo_id))).forEach(d => {
      let ps = pols.filter(p => p.mapa_id === m.id && p.campo_id === Number(d.campo_id) && (p.lote_id || null) === (d.lote_id ? Number(d.lote_id) : null))
      if (!ps.length && !d.lote_id) ps = pols.filter(p => p.mapa_id === m.id && p.campo_id === Number(d.campo_id))
      if (!ps.length) sinMarcar.push(d)
      ps.forEach(p => p.partes.forEach(pt => {
        ctx.beginPath(); pt.forEach(([px, py], i) => { const X = aX(px), Y = aY(py); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y) }); ctx.closePath(); ctx.fill()
      }))
    })
    ctx.restore()
    y += h + 16
  }
  y += 14
  ctx.strokeStyle = '#DDD'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(W - M, y); ctx.stroke()
  y += 44

  // ── Operario / Equipo ──
  if (operario) {
    ctx.font = '28px Arial'; ctx.fillStyle = '#777'; const et = 'Operario / Equipo: '; ctx.fillText(et, M, y)
    ctx.font = 'bold 28px Arial'; ctx.fillStyle = '#222'; ctx.fillText(operario, M + ctx.measureText(et).width + 4, y)
    y += 50
  }

  // ── Lotes a aplicar (con el color del mapa) ──
  if (lotes.length) {
    ctx.font = 'bold 22px Arial'; ctx.fillStyle = '#555'; ctx.fillText('LOTES A APLICAR', M, y)
    ctx.fillStyle = color; ctx.fillRect(M + 240, y - 20, 34, 22); ctx.strokeStyle = '#B08A00'; ctx.lineWidth = 1.5; ctx.strokeRect(M + 240, y - 20, 34, 22)
    y += 40
    ctx.font = '26px Arial'; ctx.fillStyle = '#222'
    lotes.forEach((l, i) => { const col = i % 2, fila = Math.floor(i / 2); ctx.fillText(`• ${l}`, M + col * (W - 2 * M) / 2, y + fila * 34) })
    y += Math.ceil(lotes.length / 2) * 34 + 10
  }

  // ── Insumos aplicados (tabla como la orden por campo) ──
  ctx.font = 'bold 24px Arial'; ctx.fillStyle = '#555'
  ctx.fillText('I N S U M O S   A P L I C A D O S', M, y); y += 46
  const cols = [M + 20, M + (W - 2 * M) * 0.36, M + (W - 2 * M) * 0.58, W - M - 20]
  ctx.font = 'bold 24px Arial'; ctx.fillStyle = '#1F4D35'
  ctx.fillText('PRODUCTO', cols[0], y); ctx.fillText('TIPO', cols[1], y); ctx.fillText('DOSIS/HA', cols[2], y)
  const tt = `TOTAL (${fmtN(ha, 2)} HA)`; ctx.fillText(tt, cols[3] - ctx.measureText(tt).width, y)
  y += 16; ctx.strokeStyle = '#1F4D35'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(W - M, y); ctx.stroke()
  receta.forEach(r => {
    const alto = filaProd(r)
    y += 40
    ctx.font = '28px Arial'; ctx.fillStyle = '#222'; ctx.fillText(r.nombre, cols[0], y)
    ctx.fillStyle = '#555'; ctx.fillText(r.tipo || '—', cols[1], y)
    ctx.font = 'bold 28px Arial'; ctx.fillStyle = '#222'
    ctx.fillText(`${fmtN(r.dosis, r.dosis < 0.01 ? 4 : 3)} ${r.unidad === 'kg' ? 'kg' : 'litros'}/ha`, cols[2], y)
    ctx.fillStyle = '#1F4D35'; const tv = `${fmtN(r.total, 2)} ${r.unidad === 'kg' ? 'kg' : 'litros'}`; ctx.fillText(tv, cols[3] - ctx.measureText(tv).width, y)
    if (r.envases) { ctx.font = '22px Arial'; ctx.fillStyle = '#888'; ctx.fillText(`≈ ${r.envases}`, cols[0], y + 26) }
    y += alto - 40
    ctx.strokeStyle = '#E5E5E5'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(W - M, y); ctx.stroke()
  })

  const blob = await new Promise(r => cv.toBlob(r, 'image/png'))
  return { archivo: new File([blob], `orden-mapa-${fecha.toLocaleDateString('es-AR').replace(/\//g, '-')}.png`, { type: 'image/png' }), sinMarcar }
}
export async function compartirArchivos(archivos, titulo) {
  if (navigator.canShare && navigator.canShare({ files: archivos })) { try { await navigator.share({ files: archivos, title: titulo }) } catch (e) { /* canceló */ } return }
  archivos.forEach(f => { const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); a.remove() })
}

// ── Pestaña de administración ──
export default function MapasCampos({ campos, S, Label, inputStyle, usuario }) {
  const mapas = useMapas()
  const [miniaturas, setMiniaturas] = useState({})
  const [form, setForm] = useState(null) // { id?, nombre, campo_ids, archivo }
  const [guardando, setGuardando] = useState(false)
  const [viendo, setViendo] = useState(null)
  const [marcando, setMarcando] = useState(null)

  useEffect(() => {
    mapas.forEach(async m => {
      if (miniaturas[m.id]) return
      const u = await urlFirmada(m.path)
      if (u) setMiniaturas(prev => ({ ...prev, [m.id]: u }))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapas])

  async function guardar() {
    if (!form.nombre) { alert('Ponele un nombre al mapa'); return }
    if (!form.id && !form.archivo) { alert('Elegí la imagen'); return }
    setGuardando(true)
    try {
      let path = form.path
      if (form.archivo) {
        const ext = (form.archivo.name.split('.').pop() || 'png').toLowerCase()
        path = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`
        const { error } = await supabase.storage.from('mapas').upload(path, form.archivo, { contentType: form.archivo.type || 'image/png' })
        if (error) { alert('No se pudo subir la imagen: ' + error.message); return }
        if (form.id && form.path) await supabase.storage.from('mapas').remove([form.path])
      }
      const datos = { nombre: form.nombre, campo_ids: form.campo_ids.map(Number), path }
      const { error } = form.id
        ? await supabase.from('mapas_campos').update(datos).eq('id', form.id)
        : await supabase.from('mapas_campos').insert({ ...datos, registrado_por: usuario?.id || null })
      if (error) { alert('No se pudo guardar: ' + error.message); return }
      if (form.archivo && form.id) setMiniaturas(prev => { const n = { ...prev }; delete n[form.id]; return n })
      setForm(null)
      await cargarMapas(true)
    } finally { setGuardando(false) }
  }
  async function eliminar(m) {
    if (!confirm(`¿Eliminar el mapa "${m.nombre}"?`)) return
    await supabase.storage.from('mapas').remove([m.path])
    await supabase.from('mapas_campos').delete().eq('id', m.id)
    await cargarMapas(true)
  }

  const camposSinMapa = campos.filter(c => !mapasDeCampo(mapas, c.id).length)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>🗺 Mapas de los campos</div>
          <div style={{ fontSize: 12, color: S.muted }}>Planos con los lotes dibujados. Se abren desde las órdenes, el plan de tanques y el celular, y se pueden mandar al pulverizador.</div>
        </div>
        <button onClick={() => setForm({ nombre: '', campo_ids: [], archivo: null })} style={{ padding: '8px 14px', fontSize: 13, fontWeight: 600, background: S.accent, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>+ Subir mapa</button>
      </div>

      {form && (
        <div style={{ background: S.surface, border: `1px solid ${S.accent}`, borderRadius: 10, padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div><Label>Nombre</Label><input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="ej. Zona Bobo" style={inputStyle} /></div>
            <div><Label>{form.id ? 'Reemplazar imagen (opcional)' : 'Imagen'}</Label><input type="file" accept="image/*" onChange={e => setForm({ ...form, archivo: e.target.files?.[0] || null, nombre: form.nombre || (e.target.files?.[0]?.name || '').replace(/\.[^.]+$/, '') })} style={{ fontSize: 13 }} /></div>
          </div>
          <div style={{ marginTop: 10 }}>
            <Label>¿Qué campos aparecen en este mapa?</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {campos.map(c => {
                const sel = form.campo_ids.map(Number).includes(c.id)
                return (
                  <label key={c.id} style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 12, padding: '4px 8px', borderRadius: 6, border: `1px solid ${sel ? S.accent : S.border}`, background: sel ? S.accentLight : S.surface, cursor: 'pointer' }}>
                    <input type="checkbox" checked={sel} onChange={() => setForm({ ...form, campo_ids: sel ? form.campo_ids.filter(x => Number(x) !== c.id) : [...form.campo_ids, c.id] })} /> {c.nombre}
                  </label>
                )
              })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={guardar} disabled={guardando} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.green, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Subiendo…' : 'Guardar'}</button>
            <button onClick={() => setForm(null)} style={{ padding: '8px 16px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}

      {mapas.length === 0 && !form && <div style={{ fontSize: 13, color: S.hint, padding: '1rem 0' }}>Todavía no hay mapas. Tocá <b>+ Subir mapa</b> y elegí la imagen de Paint.</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {mapas.map(m => (
          <div key={m.id} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, overflow: 'hidden' }}>
            <div onClick={() => setViendo(m)} style={{ height: 170, background: '#f3f3f3', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-in' }}>
              {miniaturas[m.id] ? <img src={miniaturas[m.id]} alt={m.nombre} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <span style={{ color: S.hint, fontSize: 12 }}>Cargando…</span>}
            </div>
            <div style={{ padding: '8px 10px' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{m.nombre}</div>
              <div style={{ fontSize: 11, color: S.muted, margin: '2px 0 6px' }}>{(m.campo_ids || []).map(id => campos.find(c => c.id === Number(id))?.nombre).filter(Boolean).join(' · ') || 'sin campos asignados'}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setViendo(m)} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 5, border: `1px solid ${S.accent}`, background: S.surface, color: S.accent, cursor: 'pointer' }}>Ver</button>
                <button onClick={() => setMarcando(m)} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 5, border: `1px solid ${S.accent}`, background: S.accentLight, color: S.accent, cursor: 'pointer', fontWeight: 600 }}>✏️ Marcar lotes</button>
                <button onClick={() => setForm({ id: m.id, nombre: m.nombre, campo_ids: m.campo_ids || [], path: m.path, archivo: null })} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 5, border: `1px solid ${S.border}`, background: S.surface, color: S.muted, cursor: 'pointer' }}>Editar</button>
                <button onClick={() => eliminar(m)} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 5, border: '1px solid #F09595', background: S.redLight, color: S.red, cursor: 'pointer' }}>Eliminar</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {mapas.length > 0 && camposSinMapa.length > 0 && (
        <div style={{ fontSize: 12, color: S.muted, marginTop: 12 }}>Campos sin mapa: {camposSinMapa.map(c => c.nombre).join(', ')}</div>
      )}
      {viendo && <VisorMapa mapa={viendo} onCerrar={() => setViendo(null)} />}
      {marcando && <MarcadorLotes mapa={marcando} campos={campos} onCerrar={() => setMarcando(null)} />}
    </div>
  )
}
