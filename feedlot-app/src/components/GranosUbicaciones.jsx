import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import SelectBuscable from './SelectBuscable'

// ─────────────────────────────────────────────────────────────────────────────
// Granos (Agricultura → 🌾 Granos)
//
// Dónde está el grano y por dónde salió:
//  - Ubicaciones: cada silobolsa (por campo y cultivo) o acopio. Entra lo
//    cosechado (cada cosecha tiene su ubicación) y lo trasladado desde otra.
//  - Camiones: cada salida con sus datos (kg bruto/tara/neto, humedad, merma,
//    CPE, CTG, patente, transportista) y a dónde fue: una venta, el feedlot,
//    otra ubicación (traslado), u otro destino.
//  - Ajuste de saldo: cuando la bolsa se termina o se cuenta, se corrige el
//    saldo y queda registrado (para lo que salió antes de usar esto).
//  - Control por cultivo: cosechado vs. lo que salió en camiones + lo que
//    queda, y la diferencia sin explicar.
// ─────────────────────────────────────────────────────────────────────────────

const n = v => parseFloat(v) || 0
const tn = kg => (n(kg) / 1000).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtF = f => f ? new Date(f + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'
const hoy = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const TIPOS_UB = [['silobolsa', 'Silobolsa'], ['acopio', 'Acopio'], ['planta', 'Planta'], ['galpon', 'Galpón'], ['otro', 'Otro']]
const DESTINOS = [['venta', 'Venta'], ['feedlot', 'Feedlot (consumo propio)'], ['traslado', 'Traslado a otra ubicación'], ['otro', 'Otro']]
const CAMION_INIT = { fecha: hoy(), ubicacion_origen_id: '', destino_tipo: 'venta', venta_id: '', ubicacion_destino_id: '', destino_detalle: '', kg_bruto: '', kg_tara: '', kg_neto: '', humedad_pct: '', kg_merma: '', cpe: '', ctg: '', patente: '', transportista: '', chofer: '', observaciones: '' }

export default function GranosUbicaciones({ S, Label, inputStyle, CULTIVOS, campos, campanas, campanaActiva, cosechas, ventasGranos, contactos = [], usuario, cargar }) {
  const [campanaId, setCampanaId] = useState(campanaActiva?.id ? String(campanaActiva.id) : '')
  const [ubicaciones, setUbicaciones] = useState([])
  const [camiones, setCamiones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [verCerradas, setVerCerradas] = useState(false)
  const [formUb, setFormUb] = useState(null)        // null | { id?, nombre, tipo, cultivo, campo_id }
  const [formCamion, setFormCamion] = useState(null) // null | CAMION_INIT
  const [ajuste, setAjuste] = useState(null)        // { ub, saldoReal, obs }
  const [guardando, setGuardando] = useState(false)

  async function cargarTodo() {
    const [{ data: u }, { data: c }] = await Promise.all([
      supabase.from('ubicaciones_grano').select('*').order('activa', { ascending: false }).order('nombre'),
      supabase.from('camiones_granos').select('*').order('fecha', { ascending: false }).order('id', { ascending: false }),
    ])
    setUbicaciones(u || []); setCamiones(c || []); setCargando(false)
  }
  useEffect(() => { cargarTodo() }, [])

  const enCampana = x => !campanaId || String(x.campana_id) === String(campanaId)
  const ubsCampana = ubicaciones.filter(u => !u.campana_id || enCampana(u))
  const camionesCampana = camiones.filter(enCampana)

  // Saldo de cada ubicación: cosechas + traslados que entran − salidas (neto) + ajustes
  const movimientos = u => {
    const cosechado = cosechas.filter(c => c.ubicacion_id === u.id).reduce((s, c) => s + n(c.kg_totales), 0)
    const entradas = camiones.filter(c => c.destino_tipo === 'traslado' && c.ubicacion_destino_id === u.id).reduce((s, c) => s + n(c.kg_final || c.kg_neto), 0)
    const salidas = camiones.filter(c => c.ubicacion_origen_id === u.id && c.destino_tipo !== 'ajuste').reduce((s, c) => s + n(c.kg_neto), 0)
    const ajustes = camiones.filter(c => c.ubicacion_origen_id === u.id && c.destino_tipo === 'ajuste').reduce((s, c) => s + n(c.kg_neto), 0)
    return { cosechado, entradas, salidas, ajustes, saldo: cosechado + entradas - salidas + ajustes, camiones: camiones.filter(c => c.ubicacion_origen_id === u.id && c.destino_tipo !== 'ajuste').length }
  }

  async function guardarUbicacion() {
    const f = formUb
    if (!f.nombre) { alert('Poné un nombre'); return }
    const datos = { nombre: f.nombre, tipo: f.tipo || 'silobolsa', cultivo: f.cultivo || null, campo_id: parseInt(f.campo_id) || null, campana_id: parseInt(campanaId) || null, observaciones: f.observaciones || null }
    const { error } = f.id ? await supabase.from('ubicaciones_grano').update(datos).eq('id', f.id) : await supabase.from('ubicaciones_grano').insert(datos)
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    setFormUb(null); cargarTodo()
  }

  async function guardarAjuste() {
    const u = ajuste.ub
    const actual = movimientos(u).saldo
    const real = n(String(ajuste.saldoReal).replace(',', '.')) * 1000
    const dif = Math.round(real - actual)
    if (!dif) { setAjuste(null); return }
    if (!confirm(`${u.nombre}: el sistema tiene ${tn(actual)} tn y en realidad quedan ${tn(real)} tn.\n\nSe registra un ajuste de ${dif > 0 ? '+' : ''}${tn(dif)} tn.`)) return
    const { error } = await supabase.from('camiones_granos').insert({ fecha: hoy(), cultivo: u.cultivo, campana_id: u.campana_id, ubicacion_origen_id: u.id, destino_tipo: 'ajuste', kg_neto: dif, kg_final: dif, observaciones: ajuste.obs || 'Ajuste de saldo', registrado_por: usuario?.id || null })
    if (error) { alert('No se pudo registrar el ajuste: ' + error.message); return }
    if (real <= 0 && confirm('La ubicación quedó en cero. ¿Marcarla como vacía (deja de aparecer en la lista)?')) await supabase.from('ubicaciones_grano').update({ activa: false }).eq('id', u.id)
    setAjuste(null); cargarTodo()
  }

  async function guardarCamion() {
    const f = formCamion
    const origen = ubicaciones.find(u => String(u.id) === String(f.ubicacion_origen_id))
    if (!origen) { alert('Elegí de qué ubicación sale'); return }
    const bruto = n(f.kg_bruto), tara = n(f.kg_tara)
    const neto = n(f.kg_neto) || (bruto && tara ? bruto - tara : 0)
    if (!(neto > 0)) { alert('Cargá los kg netos (o bruto y tara)'); return }
    if (f.destino_tipo === 'traslado' && !f.ubicacion_destino_id) { alert('Elegí a qué ubicación va'); return }
    const merma = n(f.kg_merma)
    const venta = ventasGranos.find(v => String(v.id) === String(f.venta_id))
    setGuardando(true)
    const datos = {
      fecha: f.fecha || hoy(), cultivo: origen.cultivo, campana_id: origen.campana_id || (parseInt(campanaId) || null),
      ubicacion_origen_id: origen.id, destino_tipo: f.destino_tipo,
      venta_id: f.destino_tipo === 'venta' && f.venta_id ? parseInt(f.venta_id) : null,
      ubicacion_destino_id: f.destino_tipo === 'traslado' ? parseInt(f.ubicacion_destino_id) : null,
      destino_detalle: f.destino_detalle || (venta ? venta.comprador : null),
      kg_bruto: bruto || null, kg_tara: tara || null, kg_neto: neto, humedad_pct: n(f.humedad_pct) || null,
      kg_merma: merma || null, kg_final: neto - merma,
      cpe: f.cpe || null, ctg: f.ctg || null, patente: f.patente || null, transportista: f.transportista || null, chofer: f.chofer || null,
      observaciones: f.observaciones || null, registrado_por: usuario?.id || null,
    }
    const { error } = f.id ? await supabase.from('camiones_granos').update(datos).eq('id', f.id) : await supabase.from('camiones_granos').insert(datos)
    setGuardando(false)
    if (error) { alert('No se pudo guardar el camión: ' + error.message); return }
    const saldoQueda = movimientos(origen).saldo - neto + (f.id ? n(camiones.find(c => c.id === f.id)?.kg_neto) : 0)
    if (saldoQueda < 0) alert(`Ojo: con este camión, ${origen.nombre} queda en ${tn(saldoQueda)} tn (negativo). Si la bolsa tenía más de lo cosechado registrado, ajustá el saldo.`)
    setFormCamion(null); cargarTodo()
  }

  if (cargando) return <div style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>Cargando…</div>

  const ubsVisibles = ubsCampana.filter(u => verCerradas || u.activa)
  const ubsActivas = ubsCampana.filter(u => u.activa)
  const cerradas = ubsCampana.filter(u => !u.activa).length
  const tarjeta = { background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1rem 1.1rem', marginBottom: '1.25rem' }
  const btn = (bg, fg, bd) => ({ padding: '6px 12px', fontSize: 12, fontWeight: 600, background: bg, border: bd ? `1px solid ${bd}` : 'none', color: fg, borderRadius: 6, cursor: 'pointer' })
  const th = { padding: '7px 9px', fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', textAlign: 'left', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }
  const td = { padding: '7px 9px', fontSize: 12, borderBottom: `1px solid ${S.border}` }
  const cultivosCampana = [...new Set([...cosechas.filter(enCampana).map(c => c.cultivo), ...ubsCampana.map(u => u.cultivo)].filter(Boolean))]
  const fc = formCamion
  const origenSel = fc ? ubicaciones.find(u => String(u.id) === String(fc.ubicacion_origen_id)) : null
  const netoCalc = fc ? (n(fc.kg_neto) || (n(fc.kg_bruto) && n(fc.kg_tara) ? n(fc.kg_bruto) - n(fc.kg_tara) : 0)) : 0

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Granos: dónde están y por dónde salieron</div>
          <div style={{ fontSize: 12, color: S.muted }}>Cada cosecha entra a su silobolsa o acopio; cada camión que sale se registra con sus kilos, humedad, merma y carta de porte.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ minWidth: 170 }}><Label>Campaña</Label>
            <select value={campanaId} onChange={e => setCampanaId(e.target.value)} style={inputStyle}><option value="">Todas</option>{campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
          </div>
          <button onClick={() => setFormCamion(formCamion ? null : { ...CAMION_INIT })} style={{ ...btn(S.accent, '#fff'), padding: '9px 14px' }}>🚛 + Camión</button>
        </div>
      </div>

      {/* ── Formulario de camión ── */}
      {fc && (
        <div style={{ ...tarjeta, border: `2px solid ${S.accent}` }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{fc.id ? 'Editar camión' : 'Nuevo camión'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <div><Label>Fecha</Label><input type="date" value={fc.fecha} onChange={e => setFormCamion({ ...fc, fecha: e.target.value })} style={inputStyle} /></div>
            <div style={{ gridColumn: 'span 2' }}><Label>Sale de *</Label>
              <select value={fc.ubicacion_origen_id} onChange={e => setFormCamion({ ...fc, ubicacion_origen_id: e.target.value })} style={inputStyle}>
                <option value="">— Elegí —</option>
                {ubsActivas.map(u => <option key={u.id} value={u.id}>{u.nombre} · quedan {tn(movimientos(u).saldo)} tn</option>)}
              </select>
            </div>
            <div><Label>Va a</Label>
              <select value={fc.destino_tipo} onChange={e => setFormCamion({ ...fc, destino_tipo: e.target.value })} style={inputStyle}>{DESTINOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </div>
            {fc.destino_tipo === 'venta' && (
              <div style={{ gridColumn: 'span 2' }}><Label>Venta (opcional)</Label>
                <select value={fc.venta_id} onChange={e => setFormCamion({ ...fc, venta_id: e.target.value })} style={inputStyle}>
                  <option value="">— Sin vincular —</option>
                  {ventasGranos.filter(v => !origenSel || v.cultivo === origenSel.cultivo).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).slice(0, 40).map(v => (
                    <option key={v.id} value={v.id}>{fmtF(v.fecha)} · {v.comprador || '—'} · {tn(v.kg)} tn{v.estado === 'pactada' ? ' (pactada)' : ''}</option>
                  ))}
                </select>
              </div>
            )}
            {fc.destino_tipo === 'traslado' && (
              <div style={{ gridColumn: 'span 2' }}><Label>A qué ubicación *</Label>
                <select value={fc.ubicacion_destino_id} onChange={e => setFormCamion({ ...fc, ubicacion_destino_id: e.target.value })} style={inputStyle}>
                  <option value="">— Elegí —</option>
                  {ubsActivas.filter(u => String(u.id) !== String(fc.ubicacion_origen_id)).map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                </select>
              </div>
            )}
            {fc.destino_tipo === 'otro' && <div style={{ gridColumn: 'span 2' }}><Label>Destino</Label><input value={fc.destino_detalle} onChange={e => setFormCamion({ ...fc, destino_detalle: e.target.value })} style={inputStyle} /></div>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginTop: 10 }}>
            <div><Label>Kg bruto</Label><input type="number" value={fc.kg_bruto} onChange={e => setFormCamion({ ...fc, kg_bruto: e.target.value })} style={inputStyle} /></div>
            <div><Label>Kg tara</Label><input type="number" value={fc.kg_tara} onChange={e => setFormCamion({ ...fc, kg_tara: e.target.value })} style={inputStyle} /></div>
            <div><Label>Kg neto *</Label><input type="number" value={fc.kg_neto} placeholder={n(fc.kg_bruto) && n(fc.kg_tara) ? String(n(fc.kg_bruto) - n(fc.kg_tara)) : ''} onChange={e => setFormCamion({ ...fc, kg_neto: e.target.value })} style={inputStyle} /></div>
            <div><Label>Humedad %</Label><input type="number" step="0.1" value={fc.humedad_pct} onChange={e => setFormCamion({ ...fc, humedad_pct: e.target.value })} style={inputStyle} /></div>
            <div><Label>Merma kg</Label><input type="number" value={fc.kg_merma} onChange={e => setFormCamion({ ...fc, kg_merma: e.target.value })} placeholder="según liquidación" style={inputStyle} /></div>
            <div style={{ alignSelf: 'end', fontSize: 12, color: S.accent, paddingBottom: 8 }}>{netoCalc ? <>Neto <b>{tn(netoCalc)} tn</b>{n(fc.kg_merma) ? <> · final <b>{tn(netoCalc - n(fc.kg_merma))} tn</b></> : null}</> : null}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 10 }}>
            <div><Label>N° CPE (carta de porte)</Label><input value={fc.cpe} onChange={e => setFormCamion({ ...fc, cpe: e.target.value })} style={inputStyle} /></div>
            <div><Label>CTG</Label><input value={fc.ctg} onChange={e => setFormCamion({ ...fc, ctg: e.target.value })} style={inputStyle} /></div>
            <div><Label>Patente</Label><input value={fc.patente} onChange={e => setFormCamion({ ...fc, patente: e.target.value.toUpperCase() })} style={inputStyle} /></div>
            <div><Label>Transportista</Label>
              <SelectBuscable value={fc.transportista} onChange={e => setFormCamion({ ...fc, transportista: e.target.value })} style={inputStyle}>
                <option value="">—</option>{contactos.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
              </SelectBuscable>
            </div>
            <div><Label>Chofer</Label><input value={fc.chofer} onChange={e => setFormCamion({ ...fc, chofer: e.target.value })} style={inputStyle} /></div>
            <div style={{ gridColumn: 'span 2' }}><Label>Observaciones</Label><input value={fc.observaciones} onChange={e => setFormCamion({ ...fc, observaciones: e.target.value })} style={inputStyle} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={guardarCamion} disabled={guardando} style={{ ...btn(S.green, '#fff'), padding: '8px 16px', fontSize: 13 }}>{guardando ? 'Guardando…' : 'Guardar camión'}</button>
            <button onClick={() => setFormCamion(null)} style={{ ...btn('transparent', S.muted, S.border), padding: '8px 14px', fontSize: 13 }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* ── Ubicaciones ── */}
      <div style={tarjeta}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>📦 Ubicaciones</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {cerradas > 0 && <button onClick={() => setVerCerradas(!verCerradas)} style={btn('transparent', S.muted, S.border)}>{verCerradas ? 'Ocultar vacías' : `Ver vacías (${cerradas})`}</button>}
            <button onClick={() => setFormUb(formUb ? null : { nombre: '', tipo: 'silobolsa', cultivo: '', campo_id: '' })} style={btn(S.accentLight || '#E8EFF8', S.accent, S.accent)}>+ Ubicación</button>
          </div>
        </div>
        {formUb && (
          <div style={{ background: S.bg, borderRadius: 8, padding: 12, marginBottom: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, alignItems: 'end' }}>
            <div style={{ gridColumn: 'span 2' }}><Label>Nombre *</Label><input value={formUb.nombre} onChange={e => setFormUb({ ...formUb, nombre: e.target.value })} placeholder="ej. Silobolsa 2 Odetti · Soja" style={inputStyle} /></div>
            <div><Label>Tipo</Label><select value={formUb.tipo} onChange={e => setFormUb({ ...formUb, tipo: e.target.value })} style={inputStyle}>{TIPOS_UB.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div><Label>Cultivo</Label><select value={formUb.cultivo || ''} onChange={e => setFormUb({ ...formUb, cultivo: e.target.value })} style={inputStyle}><option value="">—</option>{CULTIVOS.map(c => <option key={c}>{c}</option>)}</select></div>
            <div><Label>Campo</Label><select value={formUb.campo_id || ''} onChange={e => setFormUb({ ...formUb, campo_id: e.target.value })} style={inputStyle}><option value="">—</option>{campos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={guardarUbicacion} style={btn(S.green, '#fff')}>Guardar</button>
              <button onClick={() => setFormUb(null)} style={btn('transparent', S.muted, S.border)}>Cancelar</button>
            </div>
          </div>
        )}
        {ubsVisibles.length === 0 && <div style={{ fontSize: 12, color: S.hint }}>No hay ubicaciones para esta campaña. Se crean solas al cargar una cosecha con destino silobolsa o acopio.</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
          {ubsVisibles.map(u => {
            const m = movimientos(u)
            const pct = m.cosechado + m.entradas > 0 ? Math.max(0, Math.min(100, m.saldo / (m.cosechado + m.entradas) * 100)) : 0
            return (
              <div key={u.id} style={{ border: `1px solid ${m.saldo < 0 ? S.red : S.border}`, borderRadius: 8, padding: '10px 12px', opacity: u.activa ? 1 : 0.6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{u.tipo === 'acopio' ? '🏭' : '🛍'} {u.nombre}</div>
                  <button onClick={() => setFormUb({ id: u.id, nombre: u.nombre, tipo: u.tipo, cultivo: u.cultivo || '', campo_id: u.campo_id || '' })} style={{ ...btn('transparent', S.hint), padding: '0 4px', fontSize: 11 }}>✎</button>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', color: m.saldo < 0 ? S.red : m.saldo > 0 ? S.green : S.hint, margin: '4px 0' }}>{tn(m.saldo)} tn</div>
                <div style={{ height: 5, background: S.bg, borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: S.green }} /></div>
                <div style={{ fontSize: 11, color: S.muted, marginTop: 5, lineHeight: 1.5 }}>
                  Cosechado {tn(m.cosechado)}{m.entradas ? ` · entró ${tn(m.entradas)}` : ''} · salió {tn(m.salidas)} tn ({m.camiones} {m.camiones === 1 ? 'camión' : 'camiones'}){m.ajustes ? ` · ajustes ${m.ajustes > 0 ? '+' : ''}${tn(m.ajustes)}` : ''}
                </div>
                {ajuste?.ub.id === u.id ? (
                  <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ width: 110 }}><Label>Quedan (tn)</Label><input type="number" step="0.01" autoFocus value={ajuste.saldoReal} onChange={e => setAjuste({ ...ajuste, saldoReal: e.target.value })} style={inputStyle} /></div>
                    <div style={{ flex: 1, minWidth: 110 }}><Label>Motivo</Label><input value={ajuste.obs} onChange={e => setAjuste({ ...ajuste, obs: e.target.value })} placeholder="ej. bolsa terminada" style={inputStyle} /></div>
                    <button onClick={guardarAjuste} style={btn(S.amber, '#fff')}>OK</button>
                    <button onClick={() => setAjuste(null)} style={btn('transparent', S.muted, S.border)}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {u.activa && <button onClick={() => setFormCamion({ ...CAMION_INIT, ubicacion_origen_id: String(u.id) })} style={btn('transparent', S.accent, S.accent)}>🚛 Camión</button>}
                    <button onClick={() => setAjuste({ ub: u, saldoReal: String(Math.round(m.saldo) / 1000), obs: '' })} style={btn('transparent', S.amber, S.amber)}>Ajustar saldo</button>
                    {!u.activa
                      ? <button onClick={async () => { await supabase.from('ubicaciones_grano').update({ activa: true }).eq('id', u.id); cargarTodo() }} style={btn('transparent', S.muted, S.border)}>Reabrir</button>
                      : Math.abs(m.saldo) < 1 && <button onClick={async () => { await supabase.from('ubicaciones_grano').update({ activa: false }).eq('id', u.id); cargarTodo() }} style={btn('transparent', S.muted, S.border)}>Marcar vacía</button>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Control por cultivo ── */}
      {cultivosCampana.length > 0 && (
        <div style={tarjeta}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>🔎 Control por cultivo</div>
          <div style={{ fontSize: 12, color: S.muted, marginBottom: 8 }}>Lo cosechado tiene que ser igual a lo que salió en camiones + lo que queda en las ubicaciones + los ajustes. La diferencia es grano sin explicar (o camiones sin cargar).</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Cultivo', 'Cosechado', 'Salió en camiones', 'Merma', 'Queda', 'Ajustes', 'Vendido (ventas)', 'Sin explicar'].map(h => <th key={h} style={{ ...th, textAlign: h === 'Cultivo' ? 'left' : 'right' }}>{h}</th>)}</tr></thead>
              <tbody>
                {cultivosCampana.map(cv => {
                  const ubs = ubsCampana.filter(u => u.cultivo === cv)
                  const cosechado = cosechas.filter(c => enCampana(c) && c.cultivo === cv).reduce((s, c) => s + n(c.kg_totales), 0)
                  const cams = camionesCampana.filter(c => c.cultivo === cv && c.destino_tipo !== 'ajuste' && c.destino_tipo !== 'traslado')
                  const salio = cams.reduce((s, c) => s + n(c.kg_neto), 0)
                  const merma = cams.reduce((s, c) => s + n(c.kg_merma), 0)
                  const queda = ubs.reduce((s, u) => s + movimientos(u).saldo, 0)
                  const ajustes = camionesCampana.filter(c => c.cultivo === cv && c.destino_tipo === 'ajuste').reduce((s, c) => s + n(c.kg_neto), 0)
                  const vendido = ventasGranos.filter(v => enCampana(v) && v.cultivo === cv).reduce((s, v) => s + n(v.kg), 0)
                  const sinExplicar = cosechado - salio - queda + ajustes
                  return (
                    <tr key={cv}>
                      <td style={{ ...td, fontWeight: 700 }}>{cv}</td>
                      {[cosechado, salio, merma, queda, ajustes, vendido].map((v, i) => <td key={i} style={{ ...td, textAlign: 'right', fontFamily: 'monospace' }}>{tn(v)}</td>)}
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: Math.abs(sinExplicar) < 500 ? S.green : S.amber }}>{Math.abs(sinExplicar) < 500 ? '✓ 0' : tn(sinExplicar)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: S.hint, marginTop: 6 }}>Todo en toneladas. Lo que salió antes de empezar a cargar camiones se corrige con "Ajustar saldo" en cada ubicación.</div>
        </div>
      )}

      {/* ── Camiones ── */}
      <div style={tarjeta}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>🚛 Camiones ({camionesCampana.filter(c => c.destino_tipo !== 'ajuste').length})</div>
        {camionesCampana.filter(c => c.destino_tipo !== 'ajuste').length === 0 ? <div style={{ fontSize: 12, color: S.hint }}>Todavía no hay camiones cargados.</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Fecha', 'Sale de', 'Destino', 'Neto', 'Hum.', 'Merma', 'Final', 'CPE / CTG', 'Patente', 'Transportista', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {camionesCampana.filter(c => c.destino_tipo !== 'ajuste').map(c => {
                  const o = ubicaciones.find(u => u.id === c.ubicacion_origen_id)
                  const d = c.destino_tipo === 'traslado' ? `→ ${ubicaciones.find(u => u.id === c.ubicacion_destino_id)?.nombre || '—'}` : c.destino_tipo === 'feedlot' ? 'Feedlot' : c.destino_tipo === 'venta' ? `Venta${c.destino_detalle ? ' · ' + c.destino_detalle : ''}${c.venta_id ? ' 🔗' : ''}` : (c.destino_detalle || 'Otro')
                  return (
                    <tr key={c.id}>
                      <td style={{ ...td, fontFamily: 'monospace' }}>{fmtF(c.fecha)}</td>
                      <td style={td}>{o?.nombre || '—'}</td>
                      <td style={td}>{d}</td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{tn(c.kg_neto)}</td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace' }}>{c.humedad_pct ? `${c.humedad_pct}%` : '—'}</td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace' }}>{c.kg_merma ? tn(c.kg_merma) : '—'}</td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace' }}>{tn(c.kg_final || c.kg_neto)}</td>
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>{[c.cpe, c.ctg].filter(Boolean).join(' / ') || '—'}</td>
                      <td style={{ ...td, fontFamily: 'monospace' }}>{c.patente || '—'}</td>
                      <td style={td}>{c.transportista || '—'}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        <button onClick={() => setFormCamion(Object.fromEntries(Object.keys(CAMION_INIT).map(k => [k, c[k] != null ? String(c[k]) : ''])).constructor === Object ? { ...Object.fromEntries(Object.keys(CAMION_INIT).map(k => [k, c[k] != null ? String(c[k]) : ''])), id: c.id } : null)} style={{ ...btn('transparent', S.muted, S.border), padding: '2px 8px', fontSize: 11 }}>Editar</button>
                        <button onClick={async () => { if (!confirm('¿Eliminar este camión?')) return; await supabase.from('camiones_granos').delete().eq('id', c.id); cargarTodo() }} style={{ ...btn(S.redLight, S.red, '#F09595'), padding: '2px 8px', fontSize: 11, marginLeft: 4 }}>✕</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
