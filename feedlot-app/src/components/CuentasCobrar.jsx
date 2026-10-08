import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Loader } from './UI'

// ─────────────────────────────────────────────────────────────────────────────
// Cuentas a cobrar (Comercial)
//
// Todo lo que la empresa tiene por cobrar, junto y separable por actividad:
//  - Hacienda: las ventas con saldo de la Gestión Comercial (mismo cálculo:
//    neto a cobrar + paralelo − lo ya cobrado), agrupadas como allá.
//  - Granos: liquidaciones a terceros con saldo sin cobrar.
//  - Servicios: trabajos a terceros sin cobrar.
//  - Activos: bienes vendidos sin cobrar.
//  - Cheques de terceros en cartera (ya cobrados en cheque: entran a la
//    cuenta en su fecha de cobro).
// Abajo, el flujo de fondos por mes: lo que entra contra lo que sale (lo
// pendiente de pago de Cuentas a pagar + cheques propios por debitar).
// ─────────────────────────────────────────────────────────────────────────────

const S = {
  bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6', text: '#1A1916', muted: '#6B6760', hint: '#9E9A94',
  accent: '#1A3D6B', accentLight: '#E8EFF8', green: '#1E5C2E', greenLight: '#E8F4EB',
  red: '#7A1A1A', redLight: '#FDF0F0', amber: '#7A4500', amberLight: '#FDF0E0',
}
const ACT = {
  hacienda: { label: 'Hacienda', color: '#7A4500', bg: '#FDF0E0', modulo: 'ventas' },
  granos: { label: 'Granos', color: '#1E5C2E', bg: '#E8F4EB', modulo: 'agricultura' },
  servicios: { label: 'Servicios', color: '#1A3D6B', bg: '#E8EFF8', modulo: 'servicios' },
  activos: { label: 'Activos', color: '#3D1A6B', bg: '#F0EAFB', modulo: 'activos' },
}
const fmt = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-AR')
const fmtF = f => f ? new Date(f + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const sumaPagos = arr => (Array.isArray(arr) ? arr : []).reduce((t, p) => t + (parseFloat(p?.monto) || 0), 0)
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export default function CuentasCobrar({ setModulo }) {
  const [cobrar, setCobrar] = useState([])
  const [chequesCartera, setChequesCartera] = useState([])
  const [pagar, setPagar] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [texto, setTexto] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: ve }, { data: sv }, { data: vg }, { data: va }, { data: ch },
      { data: ci }, { data: gg }, { data: pc }, { data: fl }, { data: lo }, { data: ot }] = await Promise.all([
      supabase.from('ventas').select('*, corrales(numero)').neq('estado_comercial', 'cobrado'),
      supabase.from('servicios_terceros').select('*'),
      supabase.from('ventas_granos').select('*'),
      supabase.from('ventas_activos').select('*').neq('estado_cobro', 'cobrado'),
      supabase.from('cheques').select('*'),
      supabase.from('compras_insumos').select('id, fecha, total, proveedor, pagos_detalle').in('estado_pago', ['pendiente', 'parcial']).eq('marcado_resuelto', false),
      supabase.from('gastos_generales').select('id, fecha, monto, proveedor').eq('estado_pago', 'pendiente').eq('marcado_resuelto', false),
      supabase.from('pagos_creditos').select('id, fecha, monto, creditos(es_dolares)').eq('estado', 'pendiente').eq('marcado_resuelto', false),
      supabase.from('fletes').select('id, fecha, monto').eq('estado_pago', 'pendiente').eq('marcado_resuelto', false),
      supabase.from('lotes').select('*').neq('estado_pago', 'pagado').eq('marcado_resuelto', false),
      supabase.from('ordenes_trabajo').select('id, fecha, costo_total, estado').eq('estado_pago', 'pendiente').eq('marcado_resuelto', false).eq('es_propia', false),
    ])
    const filas = []

    // ── Hacienda: igual que la Gestión Comercial (por grupo de venta) ──
    const ventas = (ve || []).filter(v => !v.es_prueba)
    const idsV = ventas.map(v => v.id)
    const pagosV = {}
    if (idsV.length) {
      const { data: pv } = await supabase.from('pagos_ventas').select('venta_id, monto').in('venta_id', idsV)
      ;(pv || []).forEach(p => { pagosV[p.venta_id] = (pagosV[p.venta_id] || 0) + (parseFloat(p.monto) || 0) })
    }
    const vistos = new Set()
    ventas.forEach(v => {
      if (v.grupo_venta_id) { if (vistos.has(v.grupo_venta_id)) return; vistos.add(v.grupo_venta_id) }
      const grupo = v.grupo_venta_id ? ventas.filter(x => x.grupo_venta_id === v.grupo_venta_id) : [v]
      const s = k => grupo.reduce((t, x) => t + (parseFloat(x[k]) || 0), 0)
      const totalFact = s('monto_facturado'), totalNegro = s('monto_negro'), totalIva = s('iva_monto'), totalRet = s('retencion_monto')
      const totalCom = grupo.reduce((t, x) => t + ((!x.comision_es_paralela && x.comision_monto) ? parseFloat(x.comision_monto) : 0), 0)
      const totalReal = (totalFact + totalIva > 0 || totalNegro > 0) ? (totalFact + totalIva - totalCom - totalRet + totalNegro) : s('total')
      const pagado = grupo.reduce((t, x) => t + (pagosV[x.id] || 0), 0)
      const saldo = totalReal - pagado
      if (saldo <= 1000) return
      const fechaVenta = (v.creado_en || '').slice(0, 10)
      const venceGrupo = grupo.map(x => x.fecha_vencimiento_cobro).filter(Boolean).sort()[0]
      let vence = venceGrupo
      if (!vence && fechaVenta) { const d = new Date(fechaVenta + 'T12:00:00'); d.setDate(d.getDate() + (parseInt(v.plazo_dias) || 0)); vence = iso(d) }
      const cab = grupo.reduce((t, x) => t + (x.cantidad || 0), 0)
      filas.push({
        id: `ve-${v.grupo_venta_id || v.id}`, act: 'hacienda', cliente: v.comprador || '—', fecha: fechaVenta, vence,
        detalle: `${cab} animales · ${grupo.map(x => `C-${x.corrales?.numero ?? '?'}`).join(', ')}`,
        estado: v.estado_comercial === 'facturado' ? 'facturado' : 'falta facturar', saldo, cobrado: pagado,
      })
    })

    // ── Servicios a terceros ──
    ;(sv || []).filter(s => !s.es_prueba && !['cobrado', 'pagado'].includes(s.estado_pago) && !/ramonda hnos/i.test(s.cliente || '')).forEach(s => {
      const total = (parseFloat(s.total) || 0) + (parseFloat(s.monto_negro) || 0)
      const saldo = total - sumaPagos(s.pagos_detalle)
      if (saldo <= 1000) return
      let vence = s.fecha_cobro
      if (!vence && s.fecha) { const d = new Date(s.fecha + 'T12:00:00'); d.setDate(d.getDate() + (parseInt(s.plazo_pago) || 0)); vence = iso(d) }
      filas.push({ id: `sv-${s.id}`, act: 'servicios', cliente: s.cliente || '—', fecha: s.fecha, vence,
        detalle: `${s.labor || 'Servicio'}${s.hectareas ? ` · ${s.hectareas} ha` : ''}${s.campo ? ` · ${s.campo}` : ''}`,
        estado: s.facturado ? 'facturado' : 'sin facturar', saldo })
    })

    // ── Granos (ventas a terceros con saldo) ──
    ;(vg || []).filter(v => !/ramonda hnos/i.test(v.comprador || '') && !/traspaso interno/i.test(v.observaciones || '')).forEach(v => {
      const saldo = (parseFloat(v.total) || 0) - sumaPagos(v.pagos_detalle)
      if (saldo <= 1000) return
      filas.push({ id: `vg-${v.id}`, act: 'granos', cliente: v.comprador || '—', fecha: v.fecha, vence: v.fecha,
        detalle: `${v.cultivo || 'Grano'} · ${((parseFloat(v.kg) || 0) / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} tn`,
        estado: v.estado === 'confirmado' ? 'liquidada' : 'sin liquidar', saldo })
    })

    // ── Activos vendidos ──
    ;(va || []).forEach(a => {
      const saldo = (parseFloat(a.monto) || 0) - sumaPagos(a.pagos_detalle)
      if (saldo <= 1000) return
      filas.push({ id: `va-${a.id}`, act: 'activos', cliente: a.comprador || '—', fecha: a.fecha, vence: a.fecha, detalle: a.activo_nombre || 'Activo', estado: 'pendiente', saldo })
    })

    filas.sort((a, b) => (a.vence || '').localeCompare(b.vence || ''))
    setCobrar(filas)

    // Cheques: de terceros en cartera (entran) y propios por debitar (salen)
    const hoyS = iso(new Date())
    setChequesCartera((ch || []).filter(c => c.tipo === 'recibido' && c.estado === 'en_cartera').map(c => ({ fecha: c.fecha_cobro, monto: parseFloat(c.monto) || 0, detalle: `Cheque ${c.numero || ''} · ${c.banco || ''}`, de: c.librador || c.recibido_de || '' })))

    // ── Lo que sale (para el flujo) ──
    const salidas = []
    ;(ci || []).forEach(c => salidas.push({ fecha: c.fecha, monto: (parseFloat(c.total) || 0) - sumaPagos(c.pagos_detalle) }))
    ;(gg || []).forEach(g => salidas.push({ fecha: g.fecha, monto: parseFloat(g.monto) || 0 }))
    ;(pc || []).filter(p => !p.creditos?.es_dolares).forEach(p => salidas.push({ fecha: p.fecha, monto: parseFloat(p.monto) || 0 }))
    ;(fl || []).forEach(f => salidas.push({ fecha: f.fecha, monto: parseFloat(f.monto) || 0 }))
    ;(ot || []).filter(o => o.estado !== 'emitida').forEach(o => salidas.push({ fecha: o.fecha, monto: parseFloat(o.costo_total) || 0 }))
    const lotesPend = lo || []
    if (lotesPend.length) {
      const { data: pagosL } = await supabase.from('pagos_compras').select('lote_id, monto').in('lote_id', lotesPend.map(l => l.id))
      const pag = {}; (pagosL || []).forEach(p => { pag[p.lote_id] = (pag[p.lote_id] || 0) + (parseFloat(p.monto) || 0) })
      lotesPend.forEach(l => {
        const totalFacturasReal = (l.facturas_feria || []).reduce((s, f) => s + (parseFloat(f.total_factura_manual) || f.total_factura || 0), 0)
        const ivaMontoCalc = l.monto_facturado != null ? Math.round(l.monto_facturado * (l.iva_pct || 10.5) / 100) : (l.iva_monto || 0)
        const totalGC = (l.monto_facturado != null || l.monto_negro != null) ? (l.monto_facturado || 0) + ivaMontoCalc + (l.monto_negro || 0) : null
        const total = totalFacturasReal > 0 ? totalFacturasReal : (totalGC || l.monto_total_con_iva || 0)
        const saldo = total - (pag[l.id] || 0)
        if (saldo > 0.5) salidas.push({ fecha: l.fecha_ingreso, monto: saldo })
      })
    }
    ;(ch || []).filter(c => c.tipo === 'emitido' && c.estado === 'entregado' && c.fecha_cobro && c.fecha_cobro >= hoyS)
      .forEach(c => salidas.push({ fecha: c.fecha_cobro, monto: parseFloat(c.monto) || 0, cheque: true }))
    setPagar(salidas)
    setLoading(false)
  }

  if (loading) return <Loader />

  // ── Períodos: vencido · este mes · los dos siguientes · más adelante ──
  const hoy = new Date(); const hoyS = iso(hoy)
  const mesKey = d => d.slice(0, 7)
  const m0 = iso(hoy).slice(0, 7)
  const sig = n => { const d = new Date(hoy.getFullYear(), hoy.getMonth() + n, 1); return iso(d).slice(0, 7) }
  const m1 = sig(1), m2 = sig(2)
  const periodo = f => !f ? 'vencido' : f < hoyS ? 'vencido' : mesKey(f) === m0 ? m0 : mesKey(f) === m1 ? m1 : mesKey(f) === m2 ? m2 : 'despues'
  const nombreMes = k => { const [y, m] = k.split('-'); return `${MESES[parseInt(m) - 1]}${y !== String(hoy.getFullYear()) ? ' ' + y : ''}` }
  const PER = [
    { k: 'vencido', label: '⚠ Vencido', color: S.red, bg: S.redLight },
    { k: m0, label: `Resto de ${nombreMes(m0)}`, color: S.accent, bg: S.accentLight },
    { k: m1, label: nombreMes(m1)[0].toUpperCase() + nombreMes(m1).slice(1), color: S.text, bg: S.surface },
    { k: m2, label: nombreMes(m2)[0].toUpperCase() + nombreMes(m2).slice(1), color: S.text, bg: S.surface },
    { k: 'despues', label: 'Más adelante', color: S.muted, bg: S.surface },
  ]

  const filtradas = cobrar.filter(f => (!filtro || f.act === filtro) && (!texto || `${f.cliente} ${f.detalle}`.toLowerCase().includes(texto.toLowerCase())))
  const totalPer = k => filtradas.filter(f => periodo(f.vence) === k).reduce((t, f) => t + f.saldo, 0)
  const total = filtradas.reduce((t, f) => t + f.saldo, 0)
  const porAct = Object.keys(ACT).map(a => ({ a, t: cobrar.filter(f => f.act === a).reduce((s, f) => s + f.saldo, 0), n: cobrar.filter(f => f.act === a).length })).filter(x => x.n > 0)
  const totalCheques = chequesCartera.reduce((t, c) => t + c.monto, 0)

  // Flujo por período: entra (a cobrar + cheques en cartera) vs sale (a pagar + cheques propios)
  const flujo = PER.map(p => {
    const entraCobrar = cobrar.filter(f => periodo(f.vence) === p.k).reduce((t, f) => t + f.saldo, 0)
    const entraCheques = chequesCartera.filter(c => (c.fecha && c.fecha < hoyS ? 'vencido' : periodo(c.fecha)) === p.k).reduce((t, c) => t + c.monto, 0)
    const sale = pagar.filter(x => periodo(x.fecha) === p.k).reduce((t, x) => t + x.monto, 0)
    const saleCheques = pagar.filter(x => x.cheque && periodo(x.fecha) === p.k).reduce((t, x) => t + x.monto, 0)
    return { ...p, entraCobrar, entraCheques, sale, saleCheques, neto: entraCobrar + entraCheques - sale }
  })

  const card = { background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1rem 1.1rem', marginBottom: '1rem' }
  const th = { padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: S.text, margin: 0 }}>Cuentas a cobrar</h1>
        <div style={{ fontSize: 13, color: S.muted, marginTop: 4 }}>Todo lo pendiente de cobro, junto: ventas de hacienda (las mismas de la Gestión Comercial), granos, servicios y activos. Abajo, lo que entra contra lo que sale por mes.</div>
      </div>

      {/* Totales por período */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: '1rem' }}>
        {PER.map(p => (
          <div key={p.k} style={{ background: p.bg, border: `1px solid ${S.border}`, borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: p.k === 'vencido' ? S.red : S.muted, textTransform: 'uppercase' }}>{p.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: p.color, fontFamily: 'monospace', marginTop: 4 }}>{fmt(totalPer(p.k))}</div>
            <div style={{ fontSize: 11, color: S.hint }}>{filtradas.filter(f => periodo(f.vence) === p.k).length} pendientes</div>
          </div>
        ))}
        <div style={{ background: S.greenLight, border: `1px solid ${S.border}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: S.green, textTransform: 'uppercase' }}>Total a cobrar</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: S.green, fontFamily: 'monospace', marginTop: 4 }}>{fmt(total)}</div>
          <div style={{ fontSize: 11, color: S.hint }}>+ {fmt(totalCheques)} en cheques en cartera</div>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <button onClick={() => setFiltro('')} style={{ padding: '5px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer', border: `1px solid ${!filtro ? S.accent : S.border}`, background: !filtro ? S.accentLight : S.surface, color: !filtro ? S.accent : S.muted, fontWeight: !filtro ? 600 : 400 }}>Todo · {fmt(cobrar.reduce((t, f) => t + f.saldo, 0))}</button>
        {porAct.map(({ a, t, n }) => (
          <button key={a} onClick={() => setFiltro(filtro === a ? '' : a)} style={{ padding: '5px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer', border: `1px solid ${filtro === a ? ACT[a].color : S.border}`, background: filtro === a ? ACT[a].bg : S.surface, color: filtro === a ? ACT[a].color : S.muted, fontWeight: filtro === a ? 600 : 400 }}>
            {ACT[a].label} · {fmt(t)} ({n})
          </button>
        ))}
        <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Buscar cliente…" style={{ marginLeft: 'auto', padding: '6px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 12, minWidth: 180 }} />
      </div>

      {/* Detalle */}
      <div style={{ ...card, padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 860 }}>
          <thead><tr style={{ background: S.bg }}>{['Vence', 'Atraso', 'Cliente', 'Actividad', 'Detalle', 'Fecha venta', 'Estado', 'Saldo', ''].map(h => <th key={h} style={{ ...th, textAlign: h === 'Saldo' ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
          <tbody>
            {filtradas.length === 0 && <tr><td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay nada pendiente de cobro.</td></tr>}
            {filtradas.map(f => {
              const atraso = f.vence && f.vence < hoyS ? Math.round((new Date(hoyS) - new Date(f.vence)) / 86400000) : 0
              return (
                <tr key={f.id} style={{ borderBottom: `1px solid ${S.border}`, background: atraso > 0 ? '#FFF8F8' : 'transparent' }}>
                  <td style={{ padding: '7px 10px', fontWeight: 600 }}>{fmtF(f.vence)}</td>
                  <td style={{ padding: '7px 10px', color: atraso > 0 ? S.red : S.hint, fontWeight: atraso > 0 ? 700 : 400 }}>{atraso > 0 ? `${atraso} d` : '—'}</td>
                  <td style={{ padding: '7px 10px', fontWeight: 600 }}>{f.cliente}</td>
                  <td style={{ padding: '7px 10px' }}><span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: ACT[f.act].bg, color: ACT[f.act].color }}>{ACT[f.act].label}</span></td>
                  <td style={{ padding: '7px 10px', color: S.muted }}>{f.detalle}</td>
                  <td style={{ padding: '7px 10px', color: S.muted }}>{fmtF(f.fecha)}</td>
                  <td style={{ padding: '7px 10px', color: S.muted }}>{f.estado}{f.cobrado > 0 ? ` · cobrado ${fmt(f.cobrado)}` : ''}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(f.saldo)}</td>
                  <td style={{ padding: '7px 10px' }}>{setModulo && <button onClick={() => setModulo(ACT[f.act].modulo)} style={{ padding: '3px 8px', fontSize: 11, borderRadius: 5, border: `1px solid ${S.accent}`, background: S.surface, color: S.accent, cursor: 'pointer', whiteSpace: 'nowrap' }}>Ir a cobrar →</button>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Cheques en cartera */}
      {chequesCartera.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>🧾 Cheques de terceros en cartera <span style={{ fontWeight: 400, color: S.muted, fontSize: 12 }}>· ya cobrados en cheque, entran a la cuenta en su fecha</span></div>
          {[...chequesCartera].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '')).map((c, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, padding: '4px 0', borderTop: i ? `1px solid ${S.border}` : 'none' }}>
              <span>{fmtF(c.fecha)} · {c.detalle} {c.de && <span style={{ color: S.hint }}>· {c.de}</span>}</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{fmt(c.monto)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Flujo de fondos */}
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>💵 Flujo de fondos: lo que entra contra lo que sale</div>
        <div style={{ fontSize: 12, color: S.muted, marginBottom: 10 }}>Entra: lo pendiente de cobro y los cheques en cartera. Sale: lo pendiente de pago (Cuentas a pagar, por la fecha de la compra o gasto) y los cheques propios por debitar.</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr>{['Período', 'Entra (a cobrar)', 'Entra (cheques)', 'Sale (a pagar)', 'de eso, cheques propios', 'Queda'].map(h => <th key={h} style={{ ...th, textAlign: h === 'Período' ? 'left' : 'right' }}>{h}</th>)}</tr></thead>
          <tbody>
            {flujo.map(p => (
              <tr key={p.k} style={{ borderBottom: `1px solid ${S.border}` }}>
                <td style={{ padding: '8px 10px', fontWeight: 600, color: p.k === 'vencido' ? S.red : S.text }}>{p.label}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: S.green }}>{fmt(p.entraCobrar)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: S.green }}>{fmt(p.entraCheques)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: S.red }}>{fmt(p.sale)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: S.hint }}>{fmt(p.saleCheques)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: p.neto >= 0 ? S.green : S.red }}>{fmt(p.neto)}</td>
              </tr>
            ))}
            <tr style={{ background: S.bg }}>
              <td style={{ padding: '8px 10px', fontWeight: 700 }}>Total</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(flujo.reduce((t, p) => t + p.entraCobrar, 0))}</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(flujo.reduce((t, p) => t + p.entraCheques, 0))}</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(flujo.reduce((t, p) => t + p.sale, 0))}</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: S.hint }}>{fmt(flujo.reduce((t, p) => t + p.saleCheques, 0))}</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(flujo.reduce((t, p) => t + p.neto, 0))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
