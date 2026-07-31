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
}

// Umbral de "sobra plata" — una diferencia chica es redondeo, más que esto
// es un problema real para revisar.
const TOLERANCIA = 1000

// Tablas con pagos que deberían tener caja (o cheque) si están marcadas
// como pagadas — y su columna de proveedor, si tienen.
const TABLAS_PAGO = [
  { tabla: 'compras_insumos', estado: 'estado_pago', valorPagado: 'pagado', proveedorCol: 'proveedor', label: 'Compra de insumo' },
  { tabla: 'gastos_generales', estado: 'estado_pago', valorPagado: 'pagado', proveedorCol: 'proveedor', label: 'Gasto general' },
  { tabla: 'ordenes_trabajo', estado: 'estado_pago', valorPagado: 'pagado', proveedorCol: 'proveedor', label: 'Orden de trabajo' },
  { tabla: 'fletes', estado: 'estado_pago', valorPagado: 'pagado', proveedorCol: 'transportista', label: 'Flete' },
  { tabla: 'retiros_socios', estado: null, valorPagado: null, proveedorCol: 'tercero', label: 'Retiro de socio' },
  { tabla: 'pagos_empleados', estado: null, valorPagado: null, proveedorCol: null, label: 'Pago de personal' },
]

async function chequearPagosSinCaja() {
  const problemas = []
  // Una compra pagada con crédito no tiene movimiento de caja directo — la
  // plata sale de a poco, con cada cuota — así que no es un error real.
  const { data: creditos } = await supabase.from('creditos').select('compra_insumos_id').not('compra_insumos_id', 'is', null)
  const idsCreditoDirectos = (creditos || []).map(c => c.compra_insumos_id)
  // Un crédito puede cubrir VARIAS compras juntas (una sola cuota para
  // todo), pero la base solo permite vincular una — así que las demás
  // "hermanas" (mismo proveedor y misma fecha que una que sí está
  // vinculada) también se dan por cubiertas por ese mismo crédito.
  const { data: comprasBase } = await supabase.from('compras_insumos').select('id, proveedor, fecha').in('id', idsCreditoDirectos.length ? idsCreditoDirectos : [-1])
  const clavesConCredito = new Set((comprasBase || []).map(c => `${c.proveedor}|${c.fecha}`))
  const { data: todasCompras } = await supabase.from('compras_insumos').select('id, proveedor, fecha')
  const idsConCredito = new Set([
    ...idsCreditoDirectos,
    ...(todasCompras || []).filter(c => clavesConCredito.has(`${c.proveedor}|${c.fecha}`)).map(c => c.id),
  ])
  for (const t of TABLAS_PAGO) {
    let query = supabase.from(t.tabla).select('*')
    if (t.estado) query = query.eq(t.estado, t.valorPagado)
    const { data, error } = await query
    if (error) continue
    for (const row of (data || [])) {
      if (t.tabla === 'compras_insumos' && idsConCredito.has(row.id)) continue
      const tieneCaja = row.caja_oficial_id || row.caja_paralela_id
      const esCanje = (row.pagos_detalle || []).some(p => p.tipo === 'canje') || row.pagos_detalle === null && row.forma_pago === 'canje'
      const noAfectaCaja = row.no_afecta_caja === true
      if (!tieneCaja && !esCanje && !noAfectaCaja) {
        problemas.push({
          categoria: 'Pagado sin caja ni cheque',
          severidad: 'alta',
          tabla: t.tabla,
          id: row.id,
          mensaje: `${t.label} #${row.id}${t.proveedorCol && row[t.proveedorCol] ? ' — ' + row[t.proveedorCol] : ''} — marcado como pagado pero no tiene ningún movimiento de caja ni cheque vinculado, y no es canje.`,
          monto: row.monto || row.total || row.costo_total || null,
        })
      }
    }
  }
  return problemas
}

async function chequearProveedoresSinContacto() {
  const { data: contactos } = await supabase.from('contactos').select('nombre')
  const nombres = new Set((contactos || []).map(c => c.nombre))
  const problemas = []
  const fuentes = [
    { tabla: 'compras_insumos', col: 'proveedor', label: 'Compra de insumo' },
    { tabla: 'gastos_generales', col: 'proveedor', label: 'Gasto general' },
    { tabla: 'ordenes_trabajo', col: 'proveedor', label: 'Orden de trabajo (contratista)', extraFiltro: q => q.eq('es_propia', false) },
    { tabla: 'ventas', col: 'comprador', label: 'Venta de hacienda' },
    { tabla: 'ventas_granos', col: 'comprador', label: 'Venta de granos' },
  ]
  for (const f of fuentes) {
    let query = supabase.from(f.tabla).select('id, ' + f.col).not(f.col, 'is', null)
    if (f.extraFiltro) query = f.extraFiltro(query)
    const { data, error } = await query
    if (error) continue
    const vistos = new Set()
    for (const row of (data || [])) {
      const nombre = row[f.col]
      if (!nombre || nombres.has(nombre) || vistos.has(nombre)) continue
      vistos.add(nombre)
      problemas.push({
        categoria: 'Nombre que no coincide con ningún contacto',
        severidad: 'media',
        tabla: f.tabla,
        mensaje: `"${nombre}" aparece en ${f.label} pero no existe ningún contacto con ese nombre exacto — puede ser una variante de escritura de un contacto ya cargado (revisar duplicados), o un contacto que falta crear.`,
      })
    }
  }
  return problemas
}

async function chequearChequesHuerfanos() {
  const problemas = []
  const { data: cheques } = await supabase.from('cheques').select('id, numero, monto, tipo, caja_oficial_id, caja_paralela_id, pago_venta_id, pago_compra_id')
  if (!cheques) return problemas
  const idsCajaOf = [...new Set(cheques.map(c => c.caja_oficial_id).filter(Boolean))]
  const idsCajaPar = [...new Set(cheques.map(c => c.caja_paralela_id).filter(Boolean))]
  const [{ data: cajaOf }, { data: cajaPar }] = await Promise.all([
    idsCajaOf.length ? supabase.from('caja_oficial').select('id').in('id', idsCajaOf) : { data: [] },
    idsCajaPar.length ? supabase.from('caja_paralela').select('id').in('id', idsCajaPar) : { data: [] },
  ])
  const setCajaOf = new Set((cajaOf || []).map(c => c.id))
  const setCajaPar = new Set((cajaPar || []).map(c => c.id))
  for (const ch of cheques) {
    if (ch.caja_oficial_id && !setCajaOf.has(ch.caja_oficial_id)) {
      problemas.push({ categoria: 'Cheque huérfano', severidad: 'alta', tabla: 'cheques', id: ch.id, mensaje: `Cheque #${ch.numero || ch.id} (${ch.tipo}, $${(ch.monto||0).toLocaleString('es-AR')}) apunta a un movimiento de Caja 1 que ya no existe.` })
    }
    if (ch.caja_paralela_id && !setCajaPar.has(ch.caja_paralela_id)) {
      problemas.push({ categoria: 'Cheque huérfano', severidad: 'alta', tabla: 'cheques', id: ch.id, mensaje: `Cheque #${ch.numero || ch.id} (${ch.tipo}, $${(ch.monto||0).toLocaleString('es-AR')}) apunta a un movimiento de Caja 2 que ya no existe.` })
    }
  }
  return problemas
}

async function chequearSobrepagos() {
  const problemas = []
  const { data: ventas } = await supabase.from('ventas_granos').select('id, cultivo, comprador, total, pagos_detalle')
  for (const v of (ventas || [])) {
    const pagado = (v.pagos_detalle || []).reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
    if (v.total && pagado - v.total > TOLERANCIA) {
      problemas.push({ categoria: 'Cobrado de más', severidad: 'media', tabla: 'ventas_granos', id: v.id, mensaje: `Venta de ${v.cultivo} a ${v.comprador || 'sin comprador'} — se cobró $${pagado.toLocaleString('es-AR')} pero el total es $${v.total.toLocaleString('es-AR')} (${(pagado-v.total).toLocaleString('es-AR')} de más).` })
    }
  }
  const { data: lotes } = await supabase.from('lotes').select('id, procedencia, monto_total_con_iva')
  const { data: pagosCompras } = await supabase.from('pagos_compras').select('lote_id, monto')
  const pagadoPorLote = {}
  for (const p of (pagosCompras || [])) pagadoPorLote[p.lote_id] = (pagadoPorLote[p.lote_id] || 0) + (parseFloat(p.monto) || 0)
  for (const l of (lotes || [])) {
    const pagado = pagadoPorLote[l.id] || 0
    if (l.monto_total_con_iva && pagado - l.monto_total_con_iva > TOLERANCIA) {
      problemas.push({ categoria: 'Pagado de más', severidad: 'media', tabla: 'lotes', id: l.id, mensaje: `Compra de hacienda a ${l.procedencia || 'sin procedencia'} — se pagó $${pagado.toLocaleString('es-AR')} pero el total es $${l.monto_total_con_iva.toLocaleString('es-AR')} (${(pagado-l.monto_total_con_iva).toLocaleString('es-AR')} de más).` })
    }
  }
  return problemas
}

// Umbrales pensados para un feedlot/campo de este tamaño — no son un límite
// duro, solo una señal de "revisá esto, puede ser un typo con ceros de más".
async function chequearCantidadesSospechosas() {
  const problemas = []
  const { data: compras } = await supabase.from('compras_insumos').select('id, insumo_nombre, cantidad, total, proveedor')
  for (const c of (compras || [])) {
    if ((c.cantidad || 0) > 1000000 || (c.total || 0) > 200000000) {
      problemas.push({ categoria: 'Cantidad o monto fuera de lo común', severidad: 'baja', tabla: 'compras_insumos', id: c.id, mensaje: `Compra de ${c.insumo_nombre || 'insumo'}${c.proveedor ? ' a ' + c.proveedor : ''} — ${(c.cantidad||0).toLocaleString('es-AR')} unidades${c.total ? `, $${c.total.toLocaleString('es-AR')}` : ''}. Revisar que no haya ceros de más.` })
    }
  }
  return problemas
}

const CHEQUEOS = [
  { fn: chequearPagosSinCaja, nombre: 'Pagos sin caja ni cheque' },
  { fn: chequearProveedoresSinContacto, nombre: 'Nombres sin contacto' },
  { fn: chequearChequesHuerfanos, nombre: 'Cheques huérfanos' },
  { fn: chequearSobrepagos, nombre: 'Sobrepagos' },
  { fn: chequearCantidadesSospechosas, nombre: 'Cantidades sospechosas' },
]

const SEVERIDAD_COLOR = { alta: S.red, media: S.amber, baja: S.muted }
const SEVERIDAD_BG = { alta: S.redLight, media: S.amberLight, baja: S.bg }
const SEVERIDAD_LABEL = { alta: '🔴 Alta', media: '🟡 Media', baja: '⚪ Baja' }

export default function Diagnostico({ usuario }) {
  const [loading, setLoading] = useState(true)
  const [progreso, setProgreso] = useState('')
  const [problemas, setProblemas] = useState([])
  const [filtroSeveridad, setFiltroSeveridad] = useState('todas')
  const [ultimaCorrida, setUltimaCorrida] = useState(null)

  async function correr() {
    setLoading(true)
    setProblemas([])
    const todos = []
    for (const chk of CHEQUEOS) {
      setProgreso(chk.nombre)
      try {
        const resultado = await chk.fn()
        todos.push(...resultado)
      } catch (e) {
        todos.push({ categoria: 'Error al revisar', severidad: 'alta', mensaje: `No se pudo completar el chequeo "${chk.nombre}": ${e.message}` })
      }
    }
    setProblemas(todos)
    setUltimaCorrida(new Date())
    setProgreso('')
    setLoading(false)
  }

  useEffect(() => { correr() }, [])

  const porCategoria = {}
  problemas.forEach(p => { if (!porCategoria[p.categoria]) porCategoria[p.categoria] = []; porCategoria[p.categoria].push(p) })
  const problemasFiltrados = filtroSeveridad === 'todas' ? problemas : problemas.filter(p => p.severidad === filtroSeveridad)
  const porCategoriaFiltrado = {}
  problemasFiltrados.forEach(p => { if (!porCategoriaFiltrado[p.categoria]) porCategoriaFiltrado[p.categoria] = []; porCategoriaFiltrado[p.categoria].push(p) })

  const conteoAlta = problemas.filter(p => p.severidad === 'alta').length
  const conteoMedia = problemas.filter(p => p.severidad === 'media').length
  const conteoBaja = problemas.filter(p => p.severidad === 'baja').length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 3 }}>Diagnóstico del sistema</div>
          <div style={{ fontSize: 12, color: S.muted, fontFamily: 'monospace' }}>
            Revisa automáticamente si hay datos inconsistentes — cheques sueltos, pagos sin caja, nombres mal escritos, etc.
          </div>
        </div>
        <button onClick={correr} disabled={loading}
          style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.accent, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
          {loading ? `Revisando: ${progreso}...` : '🔄 Volver a revisar'}
        </button>
      </div>

      {loading && problemas.length === 0 ? (
        <Loader />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: '1.5rem' }}>
            {[
              { label: 'Total encontrado', val: problemas.length, key: 'todas', color: S.text },
              { label: '🔴 Alta', val: conteoAlta, key: 'alta', color: S.red },
              { label: '🟡 Media', val: conteoMedia, key: 'media', color: S.amber },
              { label: '⚪ Baja', val: conteoBaja, key: 'baja', color: S.muted },
            ].map(c => (
              <button key={c.key} onClick={() => setFiltroSeveridad(c.key)}
                style={{ textAlign: 'left', background: filtroSeveridad === c.key ? S.accentLight : S.surface, border: `1px solid ${filtroSeveridad === c.key ? S.accent : S.border}`, borderRadius: 10, padding: '1rem', cursor: 'pointer' }}>
                <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>{c.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: c.color }}>{c.val}</div>
              </button>
            ))}
          </div>

          {ultimaCorrida && (
            <div style={{ fontSize: 11, color: S.hint, marginBottom: '1rem' }}>Última revisión: {ultimaCorrida.toLocaleString('es-AR')}</div>
          )}

          {problemasFiltrados.length === 0 && (
            <div style={{ background: S.greenLight, border: `1px solid #97C459`, borderRadius: 10, padding: '2rem', textAlign: 'center', color: S.green, fontSize: 14, fontWeight: 600 }}>
              ✓ {filtroSeveridad === 'todas' ? 'No se encontró ningún problema — todo consistente.' : 'No hay problemas de esta severidad.'}
            </div>
          )}

          {Object.entries(porCategoriaFiltrado).map(([categoria, items]) => (
            <div key={categoria} style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{categoria} ({items.length})</div>
              <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, overflow: 'hidden' }}>
                {items.map((p, i) => (
                  <div key={i} style={{ padding: '10px 14px', borderBottom: i < items.length - 1 ? `1px solid ${S.border}` : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, background: SEVERIDAD_BG[p.severidad] }}>
                    <div style={{ fontSize: 13, color: S.text, flex: 1 }}>{p.mensaje}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: SEVERIDAD_COLOR[p.severidad], whiteSpace: 'nowrap' }}>{SEVERIDAD_LABEL[p.severidad]}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
