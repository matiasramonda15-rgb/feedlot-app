import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Presupuesto de campaña (Agricultura → 📋 Presupuesto)
//
// 1. Modelos por cultivo (ej. "Soja 1ra"): rinde y precio esperados y costos
//    por rubro en USD/ha. Se arman una vez por campaña.
// 2. Cada lote del plan de la campaña usa un modelo (por defecto, el primero
//    de su cultivo); en el lote se puede ajustar solo el rinde o el precio.
// 3. Presupuesto vs. real por lote y total de la campaña, en USD:
//    - Real: órdenes (insumos por tipo + labores), alquiler pagado y gastos,
//      cada uno con el dólar de su operación; ingreso con lo cosechado.
//    - Proyectado: mientras no se cosecha, cada rubro cuenta lo mayor entre
//      lo gastado y lo presupuestado (lo que falta gastar), y el ingreso es el
//      esperado. Así se ve a tiempo si un lote se está yendo de presupuesto.
// ─────────────────────────────────────────────────────────────────────────────

const RUBROS = [
  { k: 'semilla', campo: 'semilla_ha', label: 'Semilla' },
  { k: 'fertilizantes', campo: 'fertilizantes_ha', label: 'Fertilizantes' },
  { k: 'agroquimicos', campo: 'agroquimicos_ha', label: 'Agroquímicos' },
  { k: 'labores', campo: 'labores_ha', label: 'Labores' },
  { k: 'cosecha', campo: 'cosecha_ha', label: 'Cosecha' },
  { k: 'alquiler', campo: null, label: 'Alquiler' },
  { k: 'otros', campo: 'otros_ha', label: 'Otros gastos' },
]
// Tipo de insumo (Stock agro) → rubro
const rubroDeInsumo = tipo => {
  const t = (tipo || '').toLowerCase()
  if (t.includes('semilla')) return 'semilla'
  if (t.includes('fertiliz')) return 'fertilizantes'
  if (t.includes('silobolsa')) return 'cosecha'
  return 'agroquimicos' // herbicida, insecticida, fungicida, coadyuvante…
}
const haTrab = x => x ? (parseFloat(x.superficie_trabajable_ha) || parseFloat(x.superficie_ha) || 0) : 0
const n = v => parseFloat(v) || 0
const usd = (v, dec = 0) => (v == null || !isFinite(v)) ? '—' : `USD ${v.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`
const num = (v, dec = 1) => (v == null || !isFinite(v)) ? '—' : v.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })

const MODELO_INIT = { nombre: '', cultivo: '', rinde_tn_ha: '', precio_usd_tn: '', semilla_ha: '', fertilizantes_ha: '', agroquimicos_ha: '', labores_ha: '', cosecha_ha: '', otros_ha: '', comercializacion_pct: '', observaciones: '' }

export default function PresupuestoCampana({ S, Label, inputStyle, CULTIVOS, campos, campanas, campanaActiva, ordenes, cosechas, ventasGranos, stockAgro, planes, gastos, cotizacionDolar, cargar }) {
  const [campanaId, setCampanaId] = useState(campanaActiva?.id ? String(campanaActiva.id) : '')
  const [modelos, setModelos] = useState([])
  const [vencimientos, setVencimientos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [formModelo, setFormModelo] = useState(MODELO_INIT)
  const [editandoModelo, setEditandoModelo] = useState(null)
  const [showFormModelo, setShowFormModelo] = useState(false)
  const [abierto, setAbierto] = useState(null)

  async function cargarModelos() {
    const [{ data: m }, { data: v }] = await Promise.all([
      supabase.from('presupuestos_cultivo').select('*').order('cultivo').order('nombre'),
      supabase.from('vencimientos_arriendo').select('*').eq('estado', 'pagado'),
    ])
    setModelos(m || []); setVencimientos(v || []); setCargando(false)
  }
  useEffect(() => { cargarModelos() }, [])

  const campana = campanas.find(c => String(c.id) === String(campanaId))
  const modelosCampana = modelos.filter(m => String(m.campana_id) === String(campanaId))
  const planesCampana = (planes || []).filter(p => String(p.campana_id) === String(campanaId))

  // ── Dólar de cada operación (o el más cercano anterior, o el de Stock) ──
  const serie = [
    ...ventasGranos.map(v => [v.fecha, v.cotizacion_usd]), ...ordenes.map(o => [o.fecha, o.cotizacion_usd]),
    ...(gastos || []).map(g => [g.fecha, g.cotizacion_usd]), ...vencimientos.map(v => [v.fecha_vencimiento, v.cotizacion_usd]),
  ].filter(([f, c]) => f && n(c) > 0).map(([f, c]) => [f, n(c)]).sort((a, b) => a[0].localeCompare(b[0]))
  const dolar = (fecha, propio) => {
    if (n(propio) > 0) return n(propio)
    const antes = serie.filter(([f]) => fecha && f <= fecha)
    return antes.length ? antes[antes.length - 1][1] : (serie[0]?.[1] || cotizacionDolar || 1)
  }

  // Precio real de venta (USD/tn) del cultivo en la campaña: ventas confirmadas
  const precioRealUsd = cultivo => {
    const pool = ventasGranos.filter(v => v.cultivo === cultivo && v.estado !== 'pactada' && String(v.campana_id) === String(campanaId) && n(v.kg) && n(v.total))
    const tn = pool.reduce((s, v) => s + n(v.kg) / 1000, 0)
    // Sin IVA: precio pactado × kg (si no hay precio, total − IVA 10,5%)
    const neto = v => {
      if (n(v.neto) > 0) return n(v.neto)
      if (/ramonda hnos/i.test(v.comprador || '') || /traspaso interno/i.test(v.observaciones || '')) return n(v.total)
      const pactado = n(v.precio_tn) * n(v.kg) / 1000
      if (pactado > 0 && n(v.total) > 0 && Math.abs(pactado - n(v.total)) / n(v.total) > 0.01) return pactado
      return n(v.total) / (1 + (n(v.iva_pct) || 10.5) / 100)
    }
    const u = pool.reduce((s, v) => s + neto(v) / dolar(v.fecha, v.cotizacion_usd), 0)
    return tn ? u / tn : null
  }

  // ── Cálculo por lote del plan ──
  const filas = planesCampana.map(p => {
    const campo = campos.find(c => c.id === p.campo_id)
    const lote = p.lote_id ? campo?.lotes_agricolas?.find(l => l.id === p.lote_id) : null
    const ha = n(p.superficie_ha) || haTrab(lote) || haTrab(campo)
    const modelo = modelos.find(m => m.id === p.presupuesto_id) || modelosCampana.find(m => m.cultivo === p.cultivo) || null
    const rinde = n(p.rinde_esperado) || n(modelo?.rinde_tn_ha)
    const precio = n(p.precio_esperado_usd) || n(modelo?.precio_usd_tn)
    const comPct = n(modelo?.comercializacion_pct)
    // Alquiler presupuestado: tn/ha del contrato × pizarra soja del campo, en USD
    const alquilerPresHa = n(campo?.arrendamiento_tn_ha) && n(campo?.precio_pizarra_soja) ? n(campo.arrendamiento_tn_ha) * n(campo.precio_pizarra_soja) / (cotizacionDolar || 1) : 0
    const pres = {}
    RUBROS.forEach(r => { pres[r.k] = r.k === 'alquiler' ? alquilerPresHa * ha : n(modelo?.[r.campo]) * ha })

    // Real
    const real = { semilla: 0, fertilizantes: 0, agroquimicos: 0, labores: 0, cosecha: 0, alquiler: 0, otros: 0 }
    ordenes.filter(o => o.estado !== 'emitida' && String(o.campana_id) === String(campanaId) && o.campo_id === p.campo_id && (o.lote_id ? o.lote_id === p.lote_id : true)).forEach(o => {
      const factor = o.lote_id ? 1 : (haTrab(campo) ? ha / haTrab(campo) : 1)
      const d = dolar(o.fecha, o.cotizacion_usd)
      ;(o.productos || []).filter(pr => !pr.aporta_contratista).forEach(pr => {
        const item = stockAgro.find(s => s.id === parseInt(pr.id))
        const qty = n(pr.total) * factor
        // Precio guardado en la orden (el del momento); si no lo tiene, el del stock
        const precioU = n(pr.precio_usd) || n(item?.precio_referencia_usd) || (n(item?.precio_referencia) / d)
        real[rubroDeInsumo(item?.tipo)] += qty * precioU
      })
      real[/cosecha/i.test(o.tipo || '') ? 'cosecha' : 'labores'] += n(o.costo_total) * factor / d
    })
    const partAlq = lote ? n(lote.superficie_ha) / (n(campo?.superficie_ha) || 1) : 1
    vencimientos.filter(v => v.campo_id === p.campo_id && (!campana || (new Date(v.fecha_vencimiento).getFullYear() >= (campana.año_inicio || 0) && new Date(v.fecha_vencimiento).getFullYear() <= (campana.año_fin || 9999))))
      .forEach(v => { real.alquiler += n(v.monto_total) * partAlq / dolar(v.fecha_vencimiento, v.cotizacion_usd) })
    ;(gastos || []).filter(g => g.campo_id === p.campo_id && String(g.campana_id) === String(campanaId))
      .forEach(g => { real.otros += n(g.monto) * (haTrab(campo) ? ha / haTrab(campo) : 1) / dolar(g.fecha, g.cotizacion_usd) })

    const kg = cosechas.filter(c => String(c.campana_id) === String(campanaId) && c.campo_id === p.campo_id && (p.lote_id ? c.lote_id === p.lote_id : !c.lote_id) && c.cultivo === p.cultivo).reduce((s, c) => s + n(c.kg_totales), 0)
    const cosechado = kg > 0
    const precioReal = precioRealUsd(p.cultivo)
    const totPres = RUBROS.reduce((s, r) => s + pres[r.k], 0)
    const totReal = RUBROS.reduce((s, r) => s + real[r.k], 0)
    // Proyectado: si no se cosechó, cada rubro = lo mayor entre gastado y presupuestado
    const proy = {}
    RUBROS.forEach(r => { proy[r.k] = cosechado ? real[r.k] : Math.max(real[r.k], pres[r.k]) })
    const totProy = RUBROS.reduce((s, r) => s + proy[r.k], 0)
    const ingresoPres = rinde * ha * precio * (1 - comPct / 100)
    const ingresoProy = cosechado ? (kg / 1000) * (precioReal || precio) * (precioReal ? 1 : (1 - comPct / 100)) : ingresoPres
    const mbPres = modelo ? ingresoPres - totPres : null
    const mbProy = modelo || cosechado ? ingresoProy - totProy : null
    const rindeIndif = precio ? (totPres / ha) / (precio * (1 - comPct / 100)) : null
    return {
      id: p.id, plan: p, campo, lote, nombre: `${campo?.nombre || '—'}${lote ? ` · Lote ${lote.numero}` : ''}`, cultivo: p.cultivo, ha, modelo, rinde, precio,
      pres, real, proy, totPres, totReal, totProy, ingresoPres, ingresoProy, mbPres, mbProy, rindeIndif, cosechado, kg, precioReal,
      rindeReal: cosechado && ha ? (kg / 1000) / ha : null,
    }
  })
  const tot = k => filas.reduce((s, f) => s + (f[k] || 0), 0)
  const haTot = tot('ha')

  async function guardarModelo() {
    const f = formModelo
    if (!campanaId) { alert('Elegí la campaña'); return }
    if (!f.nombre || !f.cultivo) { alert('Poné un nombre y el cultivo'); return }
    const datos = { campana_id: parseInt(campanaId), nombre: f.nombre, cultivo: f.cultivo, observaciones: f.observaciones || null }
    ;['rinde_tn_ha', 'precio_usd_tn', 'semilla_ha', 'fertilizantes_ha', 'agroquimicos_ha', 'labores_ha', 'cosecha_ha', 'otros_ha', 'comercializacion_pct'].forEach(k => { datos[k] = parseFloat(f[k]) || 0 })
    const { error } = editandoModelo
      ? await supabase.from('presupuestos_cultivo').update(datos).eq('id', editandoModelo)
      : await supabase.from('presupuestos_cultivo').insert(datos)
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    setShowFormModelo(false); setEditandoModelo(null); setFormModelo(MODELO_INIT)
    await cargarModelos()
  }
  async function actualizarPlan(p, cambios) {
    const { error } = await supabase.from('plan_cultivos').update(cambios).eq('id', p.id)
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    await cargar()
  }

  if (cargando) return <div style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>Cargando…</div>

  const tarjeta = { background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1rem 1.1rem', marginBottom: '1.25rem' }
  const th = { padding: '7px 10px', fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', textAlign: 'right', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }
  const td = { padding: '7px 10px', fontSize: 12, textAlign: 'right', fontFamily: 'monospace', borderBottom: `1px solid ${S.border}` }
  const colorDif = (realV, presV) => !presV ? S.text : realV > presV * 1.05 ? S.red : realV < presV * 0.95 ? S.green : S.text
  const totalPresCostoHa = haTot ? tot('totPres') / haTot : null

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Presupuesto de campaña</div>
          <div style={{ fontSize: 12, color: S.muted }}>Todo en USD. Lo real usa el dólar de cada operación; el alquiler presupuestado sale del contrato (tn/ha × pizarra soja) con la cotización de Stock.</div>
        </div>
        <div style={{ minWidth: 200 }}>
          <Label>Campaña</Label>
          <select value={campanaId} onChange={e => setCampanaId(e.target.value)} style={inputStyle}>
            <option value="">— Elegí —</option>
            {campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      </div>

      {/* ── Resumen de la campaña ── */}
      {filas.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: '1.25rem' }}>
          {[
            { l: 'Superficie', v: `${num(haTot, 1)} ha`, s: `${filas.length} lote${filas.length !== 1 ? 's' : ''}` },
            { l: 'Costos presupuestados', v: usd(tot('totPres')), s: totalPresCostoHa ? `${usd(totalPresCostoHa)}/ha` : '' },
            { l: 'Gastado hasta hoy', v: usd(tot('totReal')), s: tot('totPres') ? `${num(tot('totReal') / tot('totPres') * 100, 0)}% del presupuesto` : '' },
            { l: 'Margen bruto presupuestado', v: usd(tot('mbPres')), s: haTot ? `${usd(tot('mbPres') / haTot)}/ha` : '', c: tot('mbPres') >= 0 ? S.green : S.red },
            { l: 'Margen bruto proyectado', v: usd(tot('mbProy')), s: haTot ? `${usd(tot('mbProy') / haTot)}/ha` : '', c: tot('mbProy') >= 0 ? S.green : S.red },
          ].map(k => (
            <div key={k.l} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '.8rem 1rem' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase' }}>{k.l}</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: k.c || S.text }}>{k.v}</div>
              <div style={{ fontSize: 11, color: S.hint }}>{k.s}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── 1. Modelos por cultivo ── */}
      <div style={tarjeta}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>1 · Modelos por cultivo</div>
            <div style={{ fontSize: 12, color: S.muted }}>Rinde, precio y costos por hectárea de cada cultivo. Cada lote toma el modelo de su cultivo.</div>
          </div>
          <button onClick={() => { setShowFormModelo(!showFormModelo); setEditandoModelo(null); setFormModelo(MODELO_INIT) }} disabled={!campanaId}
            style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, background: campanaId ? S.accent : S.bg, border: 'none', color: campanaId ? '#fff' : S.hint, borderRadius: 6, cursor: campanaId ? 'pointer' : 'default' }}>+ Nuevo modelo</button>
        </div>
        {showFormModelo && (
          <div style={{ background: S.bg, borderRadius: 8, padding: 12, marginBottom: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              <div><Label>Nombre *</Label><input value={formModelo.nombre} onChange={e => setFormModelo({ ...formModelo, nombre: e.target.value })} placeholder="ej. Soja 1ra" style={inputStyle} /></div>
              <div><Label>Cultivo *</Label><select value={formModelo.cultivo} onChange={e => setFormModelo({ ...formModelo, cultivo: e.target.value, nombre: formModelo.nombre || e.target.value })} style={inputStyle}><option value="">—</option>{CULTIVOS.map(c => <option key={c}>{c}</option>)}</select></div>
              <div><Label>Rinde esperado tn/ha</Label><input type="number" step="0.1" value={formModelo.rinde_tn_ha} onChange={e => setFormModelo({ ...formModelo, rinde_tn_ha: e.target.value })} style={inputStyle} /></div>
              <div><Label>Precio esperado USD/tn</Label><input type="number" value={formModelo.precio_usd_tn} onChange={e => setFormModelo({ ...formModelo, precio_usd_tn: e.target.value })} style={inputStyle} /></div>
              {RUBROS.filter(r => r.campo).map(r => (
                <div key={r.k}><Label>{r.label} USD/ha</Label><input type="number" value={formModelo[r.campo]} onChange={e => setFormModelo({ ...formModelo, [r.campo]: e.target.value })} style={inputStyle} /></div>
              ))}
              <div><Label>Gastos de comercialización %</Label><input type="number" step="0.1" value={formModelo.comercializacion_pct} onChange={e => setFormModelo({ ...formModelo, comercializacion_pct: e.target.value })} placeholder="flete, comisión, secada" style={inputStyle} /></div>
            </div>
            <div style={{ fontSize: 11, color: S.hint, marginTop: 6 }}>El alquiler no va acá: se calcula solo para cada campo con su contrato.</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={guardarModelo} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.green, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{editandoModelo ? 'Guardar cambios' : 'Guardar modelo'}</button>
              <button onClick={() => { setShowFormModelo(false); setEditandoModelo(null); setFormModelo(MODELO_INIT) }} style={{ padding: '8px 16px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        )}
        {modelosCampana.length === 0 && !showFormModelo && <div style={{ fontSize: 12, color: S.hint }}>{campanaId ? 'Todavía no hay modelos para esta campaña.' : 'Elegí una campaña.'}</div>}
        {modelosCampana.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={{ ...th, textAlign: 'left' }}>Modelo</th><th style={th}>Rinde</th><th style={th}>Precio</th>
                {RUBROS.filter(r => r.campo).map(r => <th key={r.k} style={th}>{r.label}</th>)}
                <th style={th}>Costo/ha</th><th style={th}>Rinde indif.</th><th style={th}></th>
              </tr></thead>
              <tbody>
                {modelosCampana.map(m => {
                  const costo = RUBROS.filter(r => r.campo).reduce((s, r) => s + n(m[r.campo]), 0)
                  return (
                    <tr key={m.id}>
                      <td style={{ ...td, textAlign: 'left', fontFamily: 'inherit', fontWeight: 600 }}>{m.nombre} <span style={{ color: S.hint, fontWeight: 400 }}>· {m.cultivo}</span></td>
                      <td style={td}>{num(n(m.rinde_tn_ha))} tn</td><td style={td}>{usd(n(m.precio_usd_tn))}</td>
                      {RUBROS.filter(r => r.campo).map(r => <td key={r.k} style={td}>{n(m[r.campo]) ? num(n(m[r.campo]), 0) : '—'}</td>)}
                      <td style={{ ...td, fontWeight: 700 }}>{usd(costo)}</td>
                      <td style={td} title="Sin contar alquiler">{n(m.precio_usd_tn) ? `${num(costo / (n(m.precio_usd_tn) * (1 - n(m.comercializacion_pct) / 100)), 2)} tn` : '—'}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        <button onClick={() => { setEditandoModelo(m.id); setShowFormModelo(true); setFormModelo(Object.fromEntries(Object.keys(MODELO_INIT).map(k => [k, m[k] != null ? String(m[k]) : '']))) }} style={{ padding: '2px 8px', fontSize: 11, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 5, cursor: 'pointer' }}>Editar</button>
                        <button onClick={async () => { if (!confirm(`¿Eliminar el modelo "${m.nombre}"? Los lotes que lo usan quedan sin presupuesto.`)) return; await supabase.from('presupuestos_cultivo').delete().eq('id', m.id); cargarModelos(); cargar() }} style={{ padding: '2px 8px', fontSize: 11, marginLeft: 4, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>✕</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 2 y 3. Lotes: presupuesto vs real ── */}
      <div style={tarjeta}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>2 · Lotes de la campaña: presupuesto vs. real</div>
        <div style={{ fontSize: 12, color: S.muted, marginBottom: 10 }}>
          Salen del plan de la campaña (pestaña Campaña). En rojo, los rubros que van más de un 5% arriba de lo presupuestado. "Proyectado": mientras no se cosecha, cada rubro cuenta lo gastado o lo que falta gastar según el presupuesto, lo que sea mayor.
        </div>
        {filas.length === 0 && <div style={{ fontSize: 12, color: S.hint }}>{campanaId ? 'No hay lotes en el plan de esta campaña. Cargalos en la pestaña Campaña (cultivo y hectáreas sembradas) y aparecen acá.' : 'Elegí una campaña.'}</div>}
        {filas.map(f => {
          const ab = abierto === f.id
          return (
            <div key={f.id} style={{ border: `1px solid ${S.border}`, borderRadius: 8, marginBottom: 10, overflow: 'hidden' }}>
              <div onClick={() => setAbierto(ab ? null : f.id)} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 2fr) repeat(4, minmax(110px, 1fr))', gap: 10, padding: '10px 12px', cursor: 'pointer', alignItems: 'center', background: ab ? S.bg : 'transparent' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{ab ? '▾' : '▸'} {f.nombre}</div>
                  <div style={{ fontSize: 11, color: S.muted }}>{f.cultivo} · {num(f.ha, 1)} ha · {f.modelo ? f.modelo.nombre : <span style={{ color: S.amber }}>sin modelo</span>}{f.cosechado ? ` · cosechado ${num(f.rindeReal, 2)} tn/ha` : ''}</div>
                </div>
                <div><div style={{ fontSize: 10, color: S.hint, textTransform: 'uppercase' }}>Costo presup.</div><div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{usd(f.ha ? f.totPres / f.ha : null)}/ha</div></div>
                <div><div style={{ fontSize: 10, color: S.hint, textTransform: 'uppercase' }}>Gastado</div><div style={{ fontFamily: 'monospace', fontWeight: 600, color: colorDif(f.totReal, f.totPres) }}>{usd(f.ha ? f.totReal / f.ha : null)}/ha</div></div>
                <div><div style={{ fontSize: 10, color: S.hint, textTransform: 'uppercase' }}>MB presup.</div><div style={{ fontFamily: 'monospace', fontWeight: 600, color: f.mbPres >= 0 ? S.green : S.red }}>{f.mbPres != null ? `${usd(f.mbPres / f.ha)}/ha` : '—'}</div></div>
                <div><div style={{ fontSize: 10, color: S.hint, textTransform: 'uppercase' }}>{f.cosechado ? 'MB real' : 'MB proyectado'}</div><div style={{ fontFamily: 'monospace', fontWeight: 700, color: f.mbProy >= 0 ? S.green : S.red }}>{f.mbProy != null ? `${usd(f.mbProy / f.ha)}/ha` : '—'}</div></div>
              </div>
              {ab && (
                <div style={{ padding: '10px 12px', borderTop: `1px solid ${S.border}` }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10 }}>
                    <div style={{ minWidth: 180 }}><Label>Modelo</Label>
                      <select value={f.plan.presupuesto_id || ''} onChange={e => actualizarPlan(f.plan, { presupuesto_id: e.target.value ? parseInt(e.target.value) : null })} style={inputStyle}>
                        <option value="">{f.modelo && !f.plan.presupuesto_id ? `Automático (${f.modelo.nombre})` : '— Ninguno —'}</option>
                        {modelosCampana.filter(m => m.cultivo === f.cultivo).map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                      </select>
                    </div>
                    <div style={{ width: 140 }}><Label>Rinde de este lote</Label>
                      <input type="number" step="0.1" defaultValue={f.plan.rinde_esperado || ''} placeholder={f.modelo ? `${num(n(f.modelo.rinde_tn_ha))} (modelo)` : ''} onBlur={e => { const v = parseFloat(e.target.value) || null; if (v !== (n(f.plan.rinde_esperado) || null)) actualizarPlan(f.plan, { rinde_esperado: v }) }} style={inputStyle} />
                    </div>
                    <div style={{ width: 140 }}><Label>Precio USD/tn</Label>
                      <input type="number" defaultValue={f.plan.precio_esperado_usd || ''} placeholder={f.modelo ? `${num(n(f.modelo.precio_usd_tn), 0)} (modelo)` : ''} onBlur={e => { const v = parseFloat(e.target.value) || null; if (v !== (n(f.plan.precio_esperado_usd) || null)) actualizarPlan(f.plan, { precio_esperado_usd: v }) }} style={inputStyle} />
                    </div>
                    <div style={{ fontSize: 12, color: S.muted }}>
                      Rinde de indiferencia: <b>{f.rindeIndif != null ? `${num(f.rindeIndif, 2)} tn/ha` : '—'}</b>{f.precioReal ? ` · precio real de venta ${usd(f.precioReal)}/tn` : ''}
                    </div>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr><th style={{ ...th, textAlign: 'left' }}>Rubro</th><th style={th}>Presupuesto</th><th style={th}>Gastado</th><th style={th}>Diferencia</th><th style={th}>Presup. /ha</th><th style={th}>Gastado /ha</th></tr></thead>
                      <tbody>
                        {RUBROS.map(r => (
                          <tr key={r.k}>
                            <td style={{ ...td, textAlign: 'left', fontFamily: 'inherit' }}>{r.label}</td>
                            <td style={td}>{usd(f.pres[r.k])}</td>
                            <td style={{ ...td, color: colorDif(f.real[r.k], f.pres[r.k]), fontWeight: 600 }}>{usd(f.real[r.k])}</td>
                            <td style={{ ...td, color: colorDif(f.real[r.k], f.pres[r.k]) }}>{f.pres[r.k] ? `${f.real[r.k] - f.pres[r.k] > 0 ? '+' : ''}${usd(f.real[r.k] - f.pres[r.k])}` : '—'}</td>
                            <td style={td}>{usd(f.ha ? f.pres[r.k] / f.ha : null)}</td>
                            <td style={td}>{usd(f.ha ? f.real[r.k] / f.ha : null)}</td>
                          </tr>
                        ))}
                        <tr style={{ background: S.bg }}>
                          <td style={{ ...td, textAlign: 'left', fontFamily: 'inherit', fontWeight: 700 }}>Total costos</td>
                          <td style={{ ...td, fontWeight: 700 }}>{usd(f.totPres)}</td>
                          <td style={{ ...td, fontWeight: 700, color: colorDif(f.totReal, f.totPres) }}>{usd(f.totReal)}</td>
                          <td style={td}>{f.totPres ? `${f.totReal - f.totPres > 0 ? '+' : ''}${usd(f.totReal - f.totPres)}` : '—'}</td>
                          <td style={{ ...td, fontWeight: 700 }}>{usd(f.ha ? f.totPres / f.ha : null)}</td>
                          <td style={{ ...td, fontWeight: 700 }}>{usd(f.ha ? f.totReal / f.ha : null)}</td>
                        </tr>
                        <tr>
                          <td style={{ ...td, textAlign: 'left', fontFamily: 'inherit' }}>Ingreso {f.cosechado ? '(real)' : '(esperado)'}</td>
                          <td style={td}>{usd(f.ingresoPres)}</td>
                          <td style={td}>{f.cosechado ? usd(f.ingresoProy) : '—'}</td>
                          <td style={td}></td><td style={td}>{usd(f.ha ? f.ingresoPres / f.ha : null)}</td><td style={td}>{f.cosechado ? usd(f.ingresoProy / f.ha) : '—'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
