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
  const { data: lotes } = await supabase.from('lotes').select('id, procedencia, monto_total_con_iva, monto_negro, facturas_feria, estado_pago, marcado_resuelto')
  const { data: pagosCompras } = await supabase.from('pagos_compras').select('lote_id, monto')
  const pagadoPorLote = {}
  for (const p of (pagosCompras || [])) pagadoPorLote[p.lote_id] = (pagadoPorLote[p.lote_id] || 0) + (parseFloat(p.monto) || 0)
  const fmt = n => Math.round(n).toLocaleString('es-AR')
  for (const l of (lotes || [])) {
    const pagado = pagadoPorLote[l.id] || 0
    const total = totalRealLote(l)
    if (!total) continue
    if (pagado - total > TOLERANCIA) {
      problemas.push({ categoria: 'Pagado de más', severidad: 'media', tabla: 'lotes', id: l.id, mensaje: `Compra de hacienda a ${l.procedencia || 'sin procedencia'} — se pagó $${fmt(pagado)} pero el total (facturas con IVA y gastos${parseFloat(l.monto_negro) > 0 ? ' + parte en negro' : ''}) es $${fmt(total)} ($${fmt(pagado - total)} de más). Revisar si hay un pago cargado dos veces.` })
    } else if (l.estado_pago === 'pagado' && !l.marcado_resuelto && total - pagado > TOLERANCIA) {
      // Marcada como pagada pero los pagos cargados no llegan al total —
      // falta registrar un pago o quedó un saldo sin pagar. Si se marcó
      // "resuelto" en Cuentas a pagar, se respeta esa decisión.
      problemas.push({ categoria: 'Pagado con saldo pendiente', severidad: 'media', tabla: 'lotes', id: l.id, mensaje: `Compra de hacienda a ${l.procedencia || 'sin procedencia'} — está marcada como pagada pero los pagos cargados suman $${fmt(pagado)} y el total es $${fmt(total)} (faltan $${fmt(total - pagado)}).` })
    }
  }
  return problemas
}

// Total que realmente hay que pagar por un ingreso de hacienda. El campo
// monto_total_con_iva, pese al nombre, guarda solo neto + negro (sin IVA ni
// gastos de feria/comisión), así que comparar contra él hacía saltar como
// "pagado de más" toda compra pagada completa. Cuando el ingreso tiene
// facturas cargadas, se usa la suma de sus totales (que ya incluyen IVA y
// gastos) más la parte en negro; si no tiene, se cae al campo viejo.
function totalRealLote(l) {
  const facturas = Array.isArray(l.facturas_feria) ? l.facturas_feria : []
  const totFacturas = facturas.reduce((s, f) => s + (parseFloat(f.total_factura_manual ?? f.total_factura) || 0), 0)
  if (totFacturas > 0) return totFacturas + (parseFloat(l.monto_negro) || 0)
  return parseFloat(l.monto_total_con_iva) || 0
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

// ── RESPALDO ────────────────────────────────────────────────────────────
// Baja todas las tablas importantes a un archivo JSON. Si algún día pasa
// algo con la base (se borra algo, se rompe, se pierde el acceso), con este
// archivo están todos los datos para recuperar. Se registra la fecha del
// último respaldo en configuración y el Inicio avisa si pasaron 14 días.
const TABLAS_RESPALDO = [
  'corrales', 'lotes', 'ingresos_stock', 'pesadas', 'pesada_animales', 'pesada_movimientos',
  'ventas', 'movimientos', 'mortalidad', 'eventos_sanitarios', 'alertas_sanitarias', 'animales_enfermeria',
  'compras_insumos', 'stock_insumos', 'retiros_insumos_log', 'formulas_mixer', 'raciones_diarias',
  'caja_oficial', 'caja_paralela', 'caja_dolares', 'cheques', 'cierres_caja', 'conciliaciones_caja',
  'gastos_generales', 'contactos', 'empleados', 'pagos_empleados', 'creditos', 'pagos_creditos',
  'activos', 'ventas_activos', 'retiros_socios', 'anticipos_contactos',
  'campos', 'campanas', 'plan_cultivos', 'lotes_agricolas', 'ordenes_trabajo', 'cosechas',
  'ventas_granos', 'contratos_granos', 'ubicaciones_grano', 'camiones_granos',
  'stock_agro', 'ajustes_stock_agro', 'uso_insumos_agro', 'gastos_campana', 'vencimientos_arriendo', 'vencimientos_compra',
  'servicios_terceros', 'registros_mercaderia', 'descargas_mercaderia', 'fletes', 'liquidaciones', 'pagos_liquidaciones',
  'lluvias', 'presupuesto_lineas', 'presupuestos_cultivo', 'maquinaria', 'trabajos_maquinaria', 'configuracion',
]

async function bajarTablaCompleta(tabla) {
  // Supabase devuelve de a 1000 filas como mucho — se pagina hasta el final
  const filas = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase.from(tabla).select('*').range(desde, desde + 999)
    if (error) throw new Error(`${tabla}: ${error.message}`)
    filas.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return filas
}

function RespaldoCard() {
  const [bajando, setBajando] = useState(false)
  const [progresoResp, setProgresoResp] = useState('')
  const [ultimoResp, setUltimoResp] = useState(null)

  useEffect(() => {
    supabase.from('configuracion').select('valor').eq('clave', 'ultimo_respaldo').maybeSingle()
      .then(({ data }) => { if (data?.valor) setUltimoResp(data.valor) })
  }, [])

  async function bajarRespaldo() {
    if (bajando) return
    setBajando(true)
    try {
      const respaldo = { generado: new Date().toISOString(), tablas: {} }
      let total = 0
      for (const tabla of TABLAS_RESPALDO) {
        setProgresoResp(tabla)
        try {
          respaldo.tablas[tabla] = await bajarTablaCompleta(tabla)
          total += respaldo.tablas[tabla].length
        } catch (e) {
          respaldo.tablas[tabla] = { error: e.message }
        }
      }
      const hoyStr = new Date().toISOString().split('T')[0]
      const blob = new Blob([JSON.stringify(respaldo)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `respaldo-ramonda-${hoyStr}.json`
      a.click()
      URL.revokeObjectURL(a.href)
      await supabase.from('configuracion').upsert({ clave: 'ultimo_respaldo', valor: hoyStr }, { onConflict: 'clave' })
      setUltimoResp(hoyStr)
      alert(`Respaldo descargado: ${total.toLocaleString('es-AR')} registros de ${TABLAS_RESPALDO.length} tablas.\n\nGuardá el archivo en un lugar seguro (Drive, pendrive) — con eso se puede recuperar todo si algún día pasa algo.`)
    } finally {
      setProgresoResp('')
      setBajando(false)
    }
  }

  const diasDesde = ultimoResp ? Math.floor((new Date() - new Date(ultimoResp + 'T12:00:00')) / 86400000) : null
  const vencido = diasDesde === null || diasDesde > 14
  return (
    <div style={{ background: S.surface, border: `1px solid ${vencido ? S.amber : S.border}`, borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>💾 Respaldo de los datos</div>
        <div style={{ fontSize: 12, color: vencido ? S.amber : S.muted, marginTop: 3 }}>
          {ultimoResp
            ? `Último respaldo: ${new Date(ultimoResp + 'T12:00:00').toLocaleDateString('es-AR')} (hace ${diasDesde} día${diasDesde !== 1 ? 's' : ''})`
            : 'Nunca se descargó un respaldo'}
          {vencido && ' — conviene bajar uno ahora'}
        </div>
      </div>
      <button onClick={bajarRespaldo} disabled={bajando}
        style={{ padding: '9px 16px', fontSize: 13, fontWeight: 600, background: S.green, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer', opacity: bajando ? 0.7 : 1 }}>
        {bajando ? `Bajando ${progresoResp}...` : '⬇ Descargar respaldo completo'}
      </button>
    </div>
  )
}

export default function Diagnostico({ usuario }) {
  const [loading, setLoading] = useState(true)
  const [progreso, setProgreso] = useState('')
  const [problemas, setProblemas] = useState([])
  const [filtroSeveridad, setFiltroSeveridad] = useState('todas')
  const [ultimaCorrida, setUltimaCorrida] = useState(null)
  const [descartados, setDescartados] = useState(new Set())
  const [verDescartados, setVerDescartados] = useState(false)

  // Clave estable para identificar la MISMA alerta entre una corrida y la
  // siguiente — por tabla+id cuando el chequeo apunta a una fila concreta,
  // y por el mensaje completo cuando no (ej. errores de chequeo).
  function claveDe(p) {
    return p.tabla && p.id != null ? `${p.categoria}|${p.tabla}|${p.id}` : `${p.categoria}|${p.mensaje}`
  }

  async function cargarDescartados() {
    const { data } = await supabase.from('diagnostico_descartados').select('clave')
    setDescartados(new Set((data || []).map(d => d.clave)))
  }

  async function descartar(p) {
    const clave = claveDe(p)
    setDescartados(prev => new Set([...prev, clave]))
    const { error } = await supabase.from('diagnostico_descartados').insert({ clave, categoria: p.categoria, mensaje: p.mensaje, registrado_por: usuario?.id || null })
    if (error && !error.message.includes('duplicate')) alert('No se pudo guardar el descarte: ' + error.message)
  }

  async function restaurar(clave) {
    setDescartados(prev => { const n = new Set(prev); n.delete(clave); return n })
    await supabase.from('diagnostico_descartados').delete().eq('clave', clave)
  }

  useEffect(() => { cargarDescartados() }, [])

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
  // Las descartadas no se muestran en la lista normal — solo cuando se
  // activa "Ver descartadas", para poder recuperar alguna por error.
  const problemasVisibles = verDescartados ? problemas.filter(p => descartados.has(claveDe(p))) : problemas.filter(p => !descartados.has(claveDe(p)))
  const problemasFiltrados = filtroSeveridad === 'todas' ? problemasVisibles : problemasVisibles.filter(p => p.severidad === filtroSeveridad)
  const porCategoriaFiltrado = {}
  problemasFiltrados.forEach(p => { if (!porCategoriaFiltrado[p.categoria]) porCategoriaFiltrado[p.categoria] = []; porCategoriaFiltrado[p.categoria].push(p) })

  const problemasActivos = problemas.filter(p => !descartados.has(claveDe(p)))
  const conteoAlta = problemasActivos.filter(p => p.severidad === 'alta').length
  const conteoMedia = problemasActivos.filter(p => p.severidad === 'media').length
  const conteoBaja = problemasActivos.filter(p => p.severidad === 'baja').length
  const conteoDescartadas = problemas.filter(p => descartados.has(claveDe(p))).length

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

      <RespaldoCard />

      {loading && problemas.length === 0 ? (
        <Loader />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: '1.5rem' }}>
            {[
              { label: 'Total encontrado', val: problemasActivos.length, key: 'todas', color: S.text },
              { label: '🔴 Alta', val: conteoAlta, key: 'alta', color: S.red },
              { label: '🟡 Media', val: conteoMedia, key: 'media', color: S.amber },
              { label: '⚪ Baja', val: conteoBaja, key: 'baja', color: S.muted },
            ].map(c => (
              <button key={c.key} onClick={() => { setFiltroSeveridad(c.key); setVerDescartados(false) }}
                style={{ textAlign: 'left', background: !verDescartados && filtroSeveridad === c.key ? S.accentLight : S.surface, border: `1px solid ${!verDescartados && filtroSeveridad === c.key ? S.accent : S.border}`, borderRadius: 10, padding: '1rem', cursor: 'pointer' }}>
                <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>{c.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: c.color }}>{c.val}</div>
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            {ultimaCorrida ? (
              <div style={{ fontSize: 11, color: S.hint }}>Última revisión: {ultimaCorrida.toLocaleString('es-AR')}</div>
            ) : <div />}
            {conteoDescartadas > 0 && (
              <button onClick={() => setVerDescartados(v => !v)}
                style={{ padding: '5px 10px', fontSize: 11, background: verDescartados ? S.accentLight : 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>
                {verDescartados ? '← Volver a las activas' : `👁 Ver descartadas (${conteoDescartadas})`}
              </button>
            )}
          </div>

          {problemasFiltrados.length === 0 && (
            <div style={{ background: S.greenLight, border: `1px solid #97C459`, borderRadius: 10, padding: '2rem', textAlign: 'center', color: S.green, fontSize: 14, fontWeight: 600 }}>
              ✓ {verDescartados ? 'No hay alertas descartadas.' : filtroSeveridad === 'todas' ? 'No se encontró ningún problema — todo consistente.' : 'No hay problemas de esta severidad.'}
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
                    {verDescartados ? (
                      <button onClick={() => restaurar(claveDe(p))}
                        style={{ padding: '3px 9px', fontSize: 11, fontWeight: 600, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        ↺ Restaurar
                      </button>
                    ) : (
                      <button onClick={() => descartar(p)}
                        style={{ padding: '3px 9px', fontSize: 11, fontWeight: 600, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 5, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        ✓ Descartar
                      </button>
                    )}
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
