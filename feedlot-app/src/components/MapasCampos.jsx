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

// ── Pestaña de administración ──
export default function MapasCampos({ campos, S, Label, inputStyle, usuario }) {
  const mapas = useMapas()
  const [miniaturas, setMiniaturas] = useState({})
  const [form, setForm] = useState(null) // { id?, nombre, campo_ids, archivo }
  const [guardando, setGuardando] = useState(false)
  const [viendo, setViendo] = useState(null)

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
    </div>
  )
}
