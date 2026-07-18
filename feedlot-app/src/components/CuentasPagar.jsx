import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Loader } from './UI'

const S = {
  bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6',
  text: '#1A1916', muted: '#6B6760', hint: '#9E9A94',
  accent: '#1A3D6B', accentLight: '#E8EFF8',
  green: '#1E5C2E', greenLight: '#E8F4EB',
  amber: '#7A4500', amberLight: '#FDF0E0',
  red: '#7A1A1A', redLight: '#FDF0F0',
  purple: '#3D1A6B', purpleLight: '#F0EAFB',
}

function Card({ children, style = {} }) {
  return <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1rem', ...style }}>{children}</div>
}

const ORIGEN_INFO = {
  insumos_alimentacion: { label: '🌾 Alimentación', modulo: 'insumos', color: S.green },
  insumos_sanidad:       { label: '💉 Sanidad', modulo: 'insumos', color: S.red },
  insumos_agro:          { label: '🌱 Agricultura — Insumos', modulo: 'agricultura', color: S.green },
  gastos:                { label: '📋 Gastos generales', modulo: 'gastos', color: S.amber },
  creditos:              { label: '🏦 Crédito', modulo: 'activos', color: S.purple },
  fletes:                { label: '🚚 Flete', modulo: 'fletes', color: S.accent },
  hacienda:              { label: '🐄 Compra hacienda', modulo: 'ingresos', color: S.accent },
}

export default function CuentasPagar({ usuario, setModulo }) {
  const [loading, setLoading] = useState(true)
  const [pendientes, setPendientes] = useState([])
  const [filtroOrigen, setFiltroOrigen] = useState('')
  const [filtroTexto, setFiltroTexto] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [
      { data: ci },
      { data: gg },
      { data: pc },
      { data: fl },
      { data: lo },
    ] = await Promise.all([
      // Compras de insumos: Alimentación, Sanidad y Agricultura comparten esta tabla
      supabase.from('compras_insumos').select('*').eq('estado_pago', 'pendiente').order('fecha', { ascending: true }),
      supabase.from('gastos_generales').select('*').eq('estado_pago', 'pendiente').order('fecha', { ascending: true }),
      // Cuotas de créditos pendientes, con los datos del crédito
      supabase.from('pagos_creditos').select('*, creditos(descripcion, entidad, es_dolares, activo_id, activos(nombre))').eq('estado', 'pendiente').order('fecha', { ascending: true }),
      supabase.from('fletes').select('*, lotes(codigo, procedencia)').eq('estado_pago', 'pendiente').order('fecha', { ascending: true }),
      // Compras de hacienda con saldo pendiente (no pagadas del todo)
      supabase.from('lotes').select('*').neq('estado_pago', 'pagado').order('fecha_ingreso', { ascending: true }),
    ])

    const filas = []

    // Insumos (Alimentación / Sanidad / Agricultura)
    ;(ci || []).forEach(c => {
      const origen = c.insumo_tipo === 'agro' ? 'insumos_agro' : c.insumo_tipo === 'sanitario' ? 'insumos_sanidad' : 'insumos_alimentacion'
      filas.push({
        id: `ci-${c.id}`, origen, fecha: c.fecha, proveedor: c.proveedor || '—',
        descripcion: `${c.insumo_nombre || 'Insumo'} · ${c.cantidad?.toLocaleString('es-AR') || ''}${c.unidad ? ' ' + c.unidad : ''}`,
        monto: c.total,
      })
    })

    // Gastos generales
    ;(gg || []).forEach(g => {
      filas.push({
        id: `gg-${g.id}`, origen: 'gastos', fecha: g.fecha, proveedor: g.proveedor || '—',
        descripcion: `${g.descripcion || g.categoria || 'Gasto'} · ${g.actividad || ''}`,
        monto: g.monto,
      })
    })

    // Cuotas de créditos
    ;(pc || []).forEach(p => {
      const cred = p.creditos
      filas.push({
        id: `pc-${p.id}`, origen: 'creditos', fecha: p.fecha,
        proveedor: cred?.entidad || '—',
        descripcion: `Cuota ${p.nro_cuota} — ${cred?.activos?.nombre || cred?.descripcion || 'Crédito'}`,
        monto: cred?.es_dolares ? null : p.monto,
        montoUsd: cred?.es_dolares ? p.monto_usd : null,
      })
    })

    // Fletes
    ;(fl || []).forEach(f => {
      filas.push({
        id: `fl-${f.id}`, origen: 'fletes', fecha: f.fecha, proveedor: f.transportista || '—',
        descripcion: `Flete${f.lotes?.codigo ? ' — ' + f.lotes.codigo : ''}${f.lotes?.procedencia ? ' (' + f.lotes.procedencia + ')' : ''}`,
        monto: f.monto,
      })
    })

    // Compras de hacienda con saldo pendiente — se calcula el saldo real
    // (total menos lo ya pagado), no solo si está "pendiente" a secas.
    for (const l of (lo || [])) {
      const { data: pagosLote } = await supabase.from('pagos_compras').select('monto').eq('lote_id', l.id)
      const totalPagado = (pagosLote || []).reduce((s, p) => s + (p.monto || 0), 0)
      const totalFacturasReal = (l.facturas_feria || []).reduce((s, f) => s + (parseFloat(f.total_factura_manual) || f.total_factura || 0), 0)
      const ivaMontoCalc = l.monto_facturado != null ? Math.round(l.monto_facturado * (l.iva_pct || 10.5) / 100) : (l.iva_monto || 0)
      const totalGC = (l.monto_facturado != null || l.monto_negro != null) ? (l.monto_facturado || 0) + ivaMontoCalc + (l.monto_negro || 0) : null
      const total = totalFacturasReal > 0 ? totalFacturasReal : (totalGC || l.monto_total_con_iva || 0)
      const saldo = total - totalPagado
      if (saldo > 0.5) {
        filas.push({
          id: `lo-${l.id}`, origen: 'hacienda', fecha: l.fecha_ingreso, proveedor: l.procedencia || '—',
          descripcion: `${l.cantidad || ''} animales · ${l.codigo || ''}`,
          monto: saldo,
        })
      }
    }

    filas.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
    setPendientes(filas)
    setLoading(false)
  }

  if (loading) return <Loader />

  const filtradas = pendientes.filter(p => {
    if (filtroOrigen && p.origen !== filtroOrigen) return false
    if (filtroTexto && !`${p.proveedor} ${p.descripcion}`.toLowerCase().includes(filtroTexto.toLowerCase())) return false
    return true
  })

  const hoy = new Date()
  const en7dias = new Date(hoy.getTime() + 7 * 86400000)
  const totalGeneral = filtradas.reduce((s, p) => s + (p.monto || 0), 0)
  const totalSinDefinir = filtradas.filter(p => p.monto == null).length
  const proximos7 = filtradas.filter(p => p.fecha && new Date(p.fecha + 'T12:00:00') <= en7dias)
  const totalProximos7 = proximos7.reduce((s, p) => s + (p.monto || 0), 0)

  const origenesConDatos = [...new Set(pendientes.map(p => p.origen))]

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: S.text, margin: 0 }}>Cuentas a pagar</h1>
        <div style={{ fontSize: 13, color: S.muted, marginTop: 4 }}>Todo lo pendiente de pago de la empresa, junto — insumos, gastos generales, créditos, fletes y compras de hacienda.</div>
      </div>

      {/* Resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
        <Card style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 6 }}>Total pendiente</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: S.red, fontFamily: 'monospace' }}>${totalGeneral.toLocaleString('es-AR')}</div>
          <div style={{ fontSize: 11, color: S.hint, marginTop: 4 }}>{filtradas.length} pendiente{filtradas.length !== 1 ? 's' : ''}{totalSinDefinir > 0 ? ` · ${totalSinDefinir} sin monto todavía` : ''}</div>
        </Card>
        <Card style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 6 }}>Vence en los próximos 7 días</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: S.amber, fontFamily: 'monospace' }}>${totalProximos7.toLocaleString('es-AR')}</div>
          <div style={{ fontSize: 11, color: S.hint, marginTop: 4 }}>{proximos7.length} pendiente{proximos7.length !== 1 ? 's' : ''}</div>
        </Card>
        <Card style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 6 }}>Por origen</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {origenesConDatos.map(o => {
              const info = ORIGEN_INFO[o]
              const cant = pendientes.filter(p => p.origen === o).length
              return <span key={o} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: S.bg, color: info?.color || S.muted, border: `1px solid ${S.border}` }}>{info?.label || o} ({cant})</span>
            })}
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <select value={filtroOrigen} onChange={e => setFiltroOrigen(e.target.value)}
          style={{ padding: '7px 12px', fontSize: 13, border: `1px solid ${S.border}`, borderRadius: 6, background: S.surface }}>
          <option value="">Todos los orígenes</option>
          {origenesConDatos.map(o => <option key={o} value={o}>{ORIGEN_INFO[o]?.label || o}</option>)}
        </select>
        <input type="text" value={filtroTexto} onChange={e => setFiltroTexto(e.target.value)} placeholder="Buscar proveedor o descripción..."
          style={{ flex: 1, minWidth: 200, padding: '7px 12px', fontSize: 13, border: `1px solid ${S.border}`, borderRadius: 6, background: S.surface }} />
      </div>

      {/* Listado */}
      <Card>
        <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 800 }}>
            <thead>
              <tr style={{ background: S.bg }}>
                {['Fecha', 'Origen', 'Proveedor / Entidad', 'Descripción', 'Monto', ''].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 && <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay cuentas pendientes{filtroOrigen || filtroTexto ? ' con este filtro' : ''}.</td></tr>}
              {filtradas.map(p => {
                const info = ORIGEN_INFO[p.origen] || {}
                const vencido = p.fecha && new Date(p.fecha + 'T12:00:00') < hoy
                return (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12, color: vencido ? S.red : S.text, whiteSpace: 'nowrap' }}>
                      {p.fecha ? new Date(p.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: S.bg, color: info.color || S.muted, border: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{info.label || p.origen}</span>
                    </td>
                    <td style={{ padding: '9px 12px', fontWeight: 600 }}>{p.proveedor}</td>
                    <td style={{ padding: '9px 12px', color: S.muted }}>{p.descripcion}</td>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600, color: S.red, whiteSpace: 'nowrap' }}>
                      {p.montoUsd ? `US$ ${p.montoUsd.toLocaleString('es-AR')}` : p.monto != null ? `$${p.monto.toLocaleString('es-AR')}` : <span style={{ color: S.hint, fontWeight: 400, fontStyle: 'italic' }}>a definir</span>}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      {setModulo && info.modulo && (
                        <button onClick={() => setModulo(info.modulo)}
                          style={{ padding: '3px 10px', fontSize: 11, fontWeight: 600, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          Ir a resolver →
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
