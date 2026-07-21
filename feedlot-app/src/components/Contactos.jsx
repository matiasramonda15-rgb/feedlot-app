import React, { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const S = {
  bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6',
  text: '#1A1916', muted: '#6B6760', hint: '#9E9A94',
  accent: '#1A3D6B', accentLight: '#E8EFF8',
  green: '#1E5C2E', greenLight: '#E8F4EB',
  amber: '#7A4500', amberLight: '#FDF0E0',
  red: '#7A1A1A', redLight: '#FDF0F0',
}

function Loader() {
  return <div style={{ padding: '3rem', textAlign: 'center', color: S.muted }}>Cargando...</div>
}

export default function Contactos({ usuario }) {
  const [loading, setLoading] = useState(true)
  const [contactos, setContactos] = useState([])
  const [ventas, setVentas] = useState([])
  const [lotes, setLotes] = useState([])
  const [comprasInsumos, setComprasInsumos] = useState([])
  const [gastosGenerales, setGastosGenerales] = useState([])
  const [serviciosTerceros, setServiciosTerceros] = useState([])
  const [ordenesTrabajo, setOrdenesTrabajo] = useState([])
  const [fletes, setFletes] = useState([])
  const [creditos, setCreditos] = useState([])
  const [cosechas, setCosechas] = useState([])
  const [ventasGranos, setVentasGranos] = useState([])
  const [ventasActivos, setVentasActivos] = useState([])
  const [pagosVenta, setPagosVenta] = useState({})
  const [pagosCompra, setPagosCompra] = useState({})
  const [vencimientosCompra, setVencimientosCompra] = useState({})
  const [filtro, setFiltro] = useState('')
  const [contactoSeleccionado, setContactoSeleccionado] = useState(null)
  const [mostrarNegro, setMostrarNegro] = useState(false)
  const [tabFicha, setTabFicha] = useState('oficial')
  const puedeVerParalelo = usuario?.rol === 'dueno' || usuario?.rol === 'secretaria'
  const [showForm, setShowForm] = useState(false)
  const [formContacto, setFormContacto] = useState({ nombre: '', tipo: 'otro', telefono: '', email: '', cuit: '', banco: '', localidad: '', iva: '', cbu: '', observaciones: '' })
  const [guardando, setGuardando] = useState(false)

  const TIPOS = ['comprador_hacienda', 'vendedor_hacienda', 'ambos', 'servicio', 'otro']

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [
      { data: c },
      { data: v },
      { data: l },
      { data: pv },
      { data: pc },
      { data: vc },
      { data: ci },
      { data: va },
      { data: cos },
      { data: vgr },
      { data: gg },
      { data: st },
      { data: ot },
      { data: fl },
      { data: cr },
      { data: pcr },
    ] = await Promise.all([
      supabase.from('contactos').select('*').order('nombre'),
      supabase.from('ventas').select('*, corrales(numero)').order('creado_en', { ascending: false }),
      supabase.from('lotes').select('*').order('created_at', { ascending: false }),
      supabase.from('pagos_ventas').select('*'),
      supabase.from('pagos_compras').select('*'),
      supabase.from('vencimientos_compra').select('*').order('fecha_vencimiento'),
      // Insumos de Alimentación, Sanidad Y Agricultura (insumo_tipo='agro') —
      // las tres comparten esta misma tabla.
      supabase.from('compras_insumos').select('*').order('creado_en', { ascending: false }),
      supabase.from('ventas_activos').select('*').order('creado_en', { ascending: false }),
      supabase.from('cosechas').select('*'),
      supabase.from('ventas_granos').select('*'),
      supabase.from('gastos_generales').select('*').order('fecha', { ascending: false }),
      supabase.from('servicios_terceros').select('*').eq('tipo_servicio', 'tercero').order('fecha', { ascending: false }),
      supabase.from('ordenes_trabajo').select('*').eq('es_propia', false).order('fecha', { ascending: false }),
      supabase.from('fletes').select('*').order('fecha', { ascending: false }),
      supabase.from('creditos').select('*').order('fecha_inicio', { ascending: false }),
      supabase.from('pagos_creditos').select('*').order('fecha'),
    ])

    setContactos(c || [])
    setVentas(v || [])
    setLotes(l || [])
    setComprasInsumos(ci || [])
    setVentasActivos(va || [])
    setCosechas(cos || [])
    setVentasGranos(vgr || [])
    setGastosGenerales(gg || [])
    setServiciosTerceros(st || [])
    setOrdenesTrabajo(ot || [])
    setFletes(fl || [])
    // Agrupar las cuotas de cada crédito por credito_id, para poder mostrar
    // el detalle dentro de la ficha del banco.
    const cuotasPorCredito = {}
    ;(pcr || []).forEach(p => { if (!cuotasPorCredito[p.credito_id]) cuotasPorCredito[p.credito_id] = []; cuotasPorCredito[p.credito_id].push(p) })
    setCreditos((cr || []).map(c => ({ ...c, cuotas: cuotasPorCredito[c.id] || [] })))

    const pvMap = {}
    ;(pv || []).forEach(p => {
      if (!pvMap[p.venta_id]) pvMap[p.venta_id] = []
      pvMap[p.venta_id].push(p)
    })
    setPagosVenta(pvMap)

    const pcMap = {}
    ;(pc || []).forEach(p => {
      if (!pcMap[p.lote_id]) pcMap[p.lote_id] = []
      pcMap[p.lote_id].push(p)
    })
    setPagosCompra(pcMap)

    const vcMap = {}
    ;(vc || []).forEach(v => {
      if (!vcMap[v.lote_id]) vcMap[v.lote_id] = []
      vcMap[v.lote_id].push(v)
    })
    setVencimientosCompra(vcMap)

    setLoading(false)
  }

  async function guardarContacto() {
    if (!formContacto.nombre) { alert('Ingresá el nombre'); return }
    setGuardando(true)
    const datos = {
      nombre: formContacto.nombre,
      tipo: formContacto.tipo || 'otro',
      telefono: formContacto.telefono || null,
      email: formContacto.email || null,
      cuit: formContacto.cuit || null,
      localidad: formContacto.localidad || null,
      iva: formContacto.iva || null,
      cbu: formContacto.cbu || null,
      banco: formContacto.banco || null,
      observaciones: formContacto.observaciones || null,
      actividades: (formContacto.actividades && formContacto.actividades.length > 0) ? formContacto.actividades : null,
    }
    if (formContacto.id) {
      // Si se está renombrando (no solo editando otro dato), hay que
      // actualizar también el nombre "congelado" en cada transacción vieja
      // que lo tenía guardado como texto — si no, el historial de ese
      // contacto queda huérfano bajo el nombre anterior, como si fuera
      // un contacto distinto y nuevo.
      const contactoOriginal = contactos.find(c => c.id === formContacto.id)
      const nombreViejo = contactoOriginal?.nombre
      const nombreNuevo = formContacto.nombre
      const seRenombro = nombreViejo && nombreNuevo && nombreViejo !== nombreNuevo

      const { error } = await supabase.from('contactos').update(datos).eq('id', formContacto.id)
      if (error) { alert('Error al guardar: ' + error.message); setGuardando(false); return }

      if (seRenombro) {
        const actualizaciones = [
          supabase.from('ventas').update({ comprador: nombreNuevo }).eq('comprador', nombreViejo),
          supabase.from('lotes').update({ procedencia: nombreNuevo }).eq('procedencia', nombreViejo),
          supabase.from('compras_insumos').update({ proveedor: nombreNuevo }).eq('proveedor', nombreViejo),
          supabase.from('ventas_activos').update({ comprador: nombreNuevo }).eq('comprador', nombreViejo),
          supabase.from('ventas_granos').update({ comprador: nombreNuevo }).eq('comprador', nombreViejo),
          supabase.from('servicios_terceros').update({ cliente: nombreNuevo }).eq('cliente', nombreViejo),
          supabase.from('gastos_generales').update({ proveedor: nombreNuevo }).eq('proveedor', nombreViejo),
          supabase.from('ordenes_trabajo').update({ proveedor: nombreNuevo }).eq('proveedor', nombreViejo),
          supabase.from('cheques').update({ beneficiario: nombreNuevo }).eq('beneficiario', nombreViejo),
          supabase.from('cheques').update({ librador: nombreNuevo }).eq('librador', nombreViejo),
          supabase.from('creditos').update({ entidad: nombreNuevo }).eq('entidad', nombreViejo),
          supabase.from('fletes').update({ transportista: nombreNuevo }).eq('transportista', nombreViejo),
        ]
        const resultados = await Promise.all(actualizaciones)
        const conError = resultados.filter(r => r.error)
        if (conError.length > 0) {
          alert(`El contacto se renombró, pero algunas transacciones viejas no se pudieron actualizar (quedaron con el nombre anterior). Puede que necesites usar "Fusionar" para juntarlas: ${conError.map(r => r.error.message).join(', ')}`)
        }
      }
    } else {
      const { error } = await supabase.from('contactos').insert({ ...datos, activo: true })
      if (error) { alert('Error al guardar: ' + error.message); setGuardando(false); return }
    }
    await cargar()
    setShowForm(false)
    setFormContacto({ nombre: '', tipo: 'otro', telefono: '', email: '', cuit: '', banco: '', localidad: '', iva: '', cbu: '', observaciones: '' })
    setGuardando(false)
  }

  async function eliminarContacto(id) {
    if (!confirm('¿Eliminar este contacto?')) return
    const { error } = await supabase.from('contactos').delete().eq('id', id)
    if (error) { alert('Error al eliminar: ' + error.message); return }
    await cargar()
    if (contactoSeleccionado?.id === id) setContactoSeleccionado(null)
  }

  // Arma la lista de movimientos de una cuenta (oficial o paralela) para un
  // contacto — misma lógica/fórmulas que la tabla de la ficha, para que el
  // resumen impreso coincida con lo que se ve en pantalla.
  function construirMovimientosParaImpresion(nombre, esParalela) {
    const data = calcularSaldo(nombre)
    const movs = []
    const vistos = new Set()
    ;(data.ventas || []).forEach(v => {
      if (v.grupo_venta_id) { if (vistos.has(v.grupo_venta_id)) return; vistos.add(v.grupo_venta_id) }
      const grupo = v.grupo_venta_id ? data.ventas.filter(vv => vv.grupo_venta_id === v.grupo_venta_id) : [v]
      const tieneFacturado = grupo.some(vv => vv.monto_facturado != null)
      const sumFact = grupo.reduce((s, vv) => s + (vv.monto_facturado || 0), 0)
      const sumIva = grupo.reduce((s, vv) => s + (vv.iva_monto || 0), 0)
      const sumCom = grupo.reduce((s, vv) => s + ((!vv.comision_es_paralela && vv.comision_monto) ? vv.comision_monto : 0), 0)
      const sumRet = grupo.reduce((s, vv) => s + (vv.retencion_monto || 0), 0)
      const sumNegro = grupo.reduce((s, vv) => s + (vv.monto_negro || 0), 0)
      const montoFact = tieneFacturado ? (sumFact + sumIva - sumCom - sumRet) : grupo.reduce((s, vv) => s + (vv.total || 0), 0)
      const fecha = v.fecha || v.creado_en?.split('T')[0]
      if (esParalela) { if (sumNegro > 0) movs.push({ fecha, tipo: 'Venta (Caja 2)', credito: sumNegro, debito: 0 }) }
      else { if (montoFact > 0) movs.push({ fecha, tipo: 'Venta hacienda', credito: montoFact, debito: 0 }) }
      // Cobros ya registrados contra esta venta — bajan lo que nos deben
      grupo.forEach(vv => {
        (pagosVenta[vv.id] || []).forEach(p => {
          const esPagoParalelo = p.es_paralelo || false
          if (esParalela !== esPagoParalelo) return
          if (p.monto > 0) movs.push({ fecha: p.fecha, tipo: 'Cobro', credito: 0, debito: p.monto })
        })
      })
    })
    ;(data.lotes || []).forEach(l => {
      const ivaMontoCalc = l.monto_facturado != null ? Math.round(l.monto_facturado * (l.iva_pct || 10.5) / 100) : (l.iva_monto || 0)
      const total = l.precio_compra && l.kg_bascula ? Math.round(l.kg_bascula * (1 - (l.desbaste_pct || 0) / 100) * l.precio_compra) : 0
      const montoFact = l.monto_facturado != null ? l.monto_facturado + ivaMontoCalc : total
      const montoParalelo = l.monto_negro || 0
      const fecha = l.created_at?.split('T')[0]
      if (esParalela) { if (montoParalelo > 0) movs.push({ fecha, tipo: 'Compra hacienda (Caja 2)', credito: 0, debito: montoParalelo }) }
      else { if (montoFact > 0) movs.push({ fecha, tipo: 'Compra hacienda', credito: 0, debito: montoFact }) }
      // Pagos ya realizados de esta compra — bajan lo que le debemos
      ;(pagosCompra[l.id] || []).forEach(p => {
        const esPagoParalelo = p.es_paralelo || p.es_negro || false
        if (esParalela !== esPagoParalelo) return
        if (p.monto > 0) movs.push({ fecha: p.fecha, tipo: 'Pago', credito: p.monto, debito: 0 })
      })
    })
    ;(data.comprasInsumos || []).forEach(ci => {
      const esParaleloCi = ci.es_paralelo || false
      if (esParalela !== esParaleloCi) return
      if (ci.total > 0) movs.push({ fecha: ci.fecha, tipo: ci.insumo_nombre || 'Insumo', credito: 0, debito: ci.total })
      ;(ci.pagos_detalle || []).filter(p => p.tipo !== 'canje' && parseFloat(p.monto) > 0).forEach(p => {
        movs.push({ fecha: p.fecha, tipo: 'Pago', credito: p.monto, debito: 0 })
      })
    })
    // Gastos generales (silobolsa, flete, taller, etc.) — le debemos al proveedor.
    ;(data.gastosGenerales || []).forEach(g => {
      const esParaleloGg = g.es_paralelo || false
      if (esParalela !== esParaleloGg) return
      if (g.monto > 0) movs.push({ fecha: g.fecha, tipo: g.descripcion || g.categoria || 'Gasto', credito: 0, debito: g.monto })
      ;(g.pagos_detalle || []).filter(p => p.tipo !== 'canje' && parseFloat(p.monto) > 0).forEach(p => {
        movs.push({ fecha: g.fecha, tipo: 'Pago', credito: parseFloat(p.monto) || 0, debito: 0 })
      })
    })
    // Órdenes de trabajo con contratista — le debemos al proveedor.
    ;(data.ordenesTrabajo || []).forEach(ot => {
      const esParaleloOt = ot.es_paralelo || false
      if (esParalela !== esParaleloOt) return
      if (ot.costo_total > 0) movs.push({ fecha: ot.fecha, tipo: `${ot.tipo || 'Orden'}${ot.descripcion ? ' · ' + ot.descripcion : ''}`, credito: 0, debito: ot.costo_total })
      ;(ot.pagos_detalle || []).filter(p => p.tipo !== 'canje' && parseFloat(p.monto) > 0).forEach(p => {
        movs.push({ fecha: ot.fecha, tipo: 'Pago', credito: parseFloat(p.monto) || 0, debito: 0 })
      })
    })
    // Ventas de granos — el comprador nos debe (no hay desglose de pagos parciales).
    ;(data.ventasGranos || []).forEach(vg => {
      if (vg.estado === 'pactada') return
      if (esParalela) { if (vg.monto_negro > 0) movs.push({ fecha: vg.fecha, tipo: `Venta ${vg.cultivo || 'grano'} (Caja 2)`, credito: vg.monto_negro, debito: 0 }) }
      else { if (vg.total > 0) movs.push({ fecha: vg.fecha, tipo: `Venta ${vg.cultivo || 'grano'}`, credito: vg.total, debito: 0 }) }
      ;(vg.pagos_detalle || []).filter(p => p.tipo !== 'canje' && parseFloat(p.monto) > 0).forEach(p => {
        const esPagoParalelo = p.es_paralelo || false
        if (esParalela !== esPagoParalelo) return
        movs.push({ fecha: vg.fecha, tipo: 'Cobro', credito: 0, debito: parseFloat(p.monto) || 0 })
      })
    })
    // Fletes — le debemos al transportista. Se pagan de una sola vez (sin
    // desglose parcial): si ya está pagado, se muestra la obligación y el
    // pago que la cancela; si no, solo la obligación (en Caja 1 por defecto,
    // hasta que se pague y se sepa con cuál caja se cubrió).
    ;(data.fletes || []).forEach(f => {
      if (!f.monto) return
      const esParaleloF = !!f.caja_paralela_id
      if (f.estado_pago === 'pagado') {
        if (esParalela !== esParaleloF) return
        movs.push({ fecha: f.fecha, tipo: `Flete · ${f.transportista || ''}`, credito: 0, debito: f.monto })
        movs.push({ fecha: f.fecha, tipo: 'Pago', credito: f.monto, debito: 0 })
      } else if (!esParalela) {
        movs.push({ fecha: f.fecha, tipo: `Flete · ${f.transportista || ''}`, credito: 0, debito: f.monto })
      }
    })
    // Créditos (bancos/financieras) — cada cuota pagada es un pago; las
    // pendientes en pesos se muestran como obligación (las en dólares no,
    // porque el monto en pesos recién se sabe al pagarlas).
    if (!esParalela) {
      ;(data.creditos || []).forEach(c => {
        ;(c.cuotas || []).forEach(cuota => {
          if (cuota.estado === 'pagado' && cuota.monto > 0) movs.push({ fecha: cuota.fecha_pago || cuota.fecha, tipo: `Pago cuota ${cuota.nro_cuota} — ${c.descripcion || 'Crédito'}`, credito: cuota.monto, debito: 0 })
          else if (cuota.estado !== 'pagado' && !c.es_dolares && cuota.monto > 0) movs.push({ fecha: cuota.fecha, tipo: `Cuota ${cuota.nro_cuota} — ${c.descripcion || 'Crédito'}`, credito: 0, debito: cuota.monto })
        })
      })
    }
    if (!esParalela) {
      ;(data.ventasActivos || []).forEach(va => {
        if (va.monto > 0) movs.push({ fecha: va.fecha, tipo: `Venta ${va.activo_nombre || 'activo'}`, credito: va.monto, debito: 0 })
      })
    } else {
      ;(data.ventasActivos || []).forEach(va => {
        if (va.es_paralelo && va.monto > 0) movs.push({ fecha: va.fecha, tipo: `Venta ${va.activo_nombre || 'activo'} (Caja 2)`, credito: va.monto, debito: 0 })
      })
    }
    // Servicios a terceros — el cliente nos debe hasta que se cobre.
    ;(data.serviciosTerceros || []).forEach(st => {
      const fecha = st.fecha || st.creado_en?.split('T')[0]
      if (esParalela) { if (st.monto_negro > 0) movs.push({ fecha, tipo: `Servicio ${st.labor || ''} (Caja 2)`, credito: st.monto_negro, debito: 0 }) }
      else { if (st.total > 0) movs.push({ fecha, tipo: `Servicio ${st.labor || ''}`, credito: st.total, debito: 0 }) }
      ;(st.pagos_detalle || []).filter(p => p.tipo !== 'canje' && parseFloat(p.monto) > 0).forEach(p => {
        const esPagoParalelo = p.es_paralelo || false
        if (esParalela !== esPagoParalelo) return
        movs.push({ fecha, tipo: 'Cobro', credito: 0, debito: parseFloat(p.monto) || 0 })
      })
    })
    movs.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
    let saldoAcum = 0
    return movs.map(m => { saldoAcum += (m.credito || 0) - (m.debito || 0); return { ...m, saldoAcum } })
  }

  function generarResumenCuenta(nombre) {
    const contactoData = contactos.find(c => c.nombre === nombre)
    const movOficial = construirMovimientosParaImpresion(nombre, false)
    const movParalela = puedeVerParalelo ? construirMovimientosParaImpresion(nombre, true) : []
    const fmt = n => `$ ${Math.round(n || 0).toLocaleString('es-AR')}`
    const fmtFecha = f => f ? new Date(f + 'T12:00:00').toLocaleDateString('es-AR') : '—'

    const tabla = (movs, titulo) => movs.length === 0 ? '' : `
      <div class="titulo-cuenta">${titulo}</div>
      <table>
        <thead><tr><th>Fecha</th><th>Concepto</th><th class="num">Débito</th><th class="num">Crédito</th><th class="num">Saldo</th></tr></thead>
        <tbody>
          ${movs.map(m => `<tr>
            <td>${fmtFecha(m.fecha)}</td>
            <td>${m.tipo}</td>
            <td class="num">${m.debito ? fmt(m.debito) : ''}</td>
            <td class="num">${m.credito ? fmt(m.credito) : ''}</td>
            <td class="num saldo">${fmt(m.saldoAcum)}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr><td colspan="4">Saldo final</td><td class="num saldo">${fmt(movs[movs.length - 1]?.saldoAcum || 0)}</td></tr></tfoot>
      </table>
    `

    const html = `
      <html><head><title>Resumen de cuenta — ${nombre}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #1A1916; }
        .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #1A1916; padding-bottom: 14px; }
        .empresa { font-size: 20px; font-weight: 700; }
        .sub { font-size: 12px; color: #6B6760; margin-top: 4px; }
        .contacto { font-size: 16px; font-weight: 700; margin: 20px 0 4px; }
        .datos { font-size: 12px; color: #6B6760; margin-bottom: 20px; }
        .titulo-cuenta { font-size: 13px; font-weight: 700; margin: 24px 0 8px; text-transform: uppercase; letter-spacing: .04em; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 10px; }
        th { text-align: left; background: #F7F5F0; padding: 8px 10px; border-bottom: 2px solid #1A1916; }
        td { padding: 7px 10px; border-bottom: 1px solid #E2DDD6; }
        .num { text-align: right; font-family: monospace; }
        .saldo { font-weight: 700; }
        tfoot td { font-weight: 700; background: #F7F5F0; border-top: 2px solid #1A1916; }
        .fecha-emision { text-align: right; font-size: 11px; color: #6B6760; margin-top: 30px; }
        button { margin-top: 24px; padding: 10px 20px; font-size: 14px; cursor: pointer; }
        @media print { button { display: none; } }
      </style></head>
      <body>
        <div class="header">
          <div class="empresa">RAMONDA HNOS S.A.</div>
          <div class="sub">Resumen de cuenta</div>
        </div>
        <div class="contacto">${nombre}</div>
        <div class="datos">
          ${contactoData?.cuit ? `CUIT: ${contactoData.cuit} · ` : ''}${contactoData?.localidad ? `${contactoData.localidad} · ` : ''}${contactoData?.telefono || ''}
        </div>
        ${tabla(movOficial, 'Caja 1')}
        ${movOficial.length === 0 ? '<p style="color:#9E9A94;font-size:13px;">Sin movimientos en la cuenta oficial.</p>' : ''}
        ${tabla(movParalela, 'Caja 2')}
        <div class="fecha-emision">Emitido el ${new Date().toLocaleDateString('es-AR')}</div>
        <div style="text-align:center;"><button onclick="window.print()">🖨️ Imprimir / Guardar PDF</button></div>
      </body></html>
    `
    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
  }

  function calcularSaldo(nombre) {
    const data = transaccionesPorNombre[nombre] || { ventas: [], lotes: [], comprasInsumos: [], ventasActivos: [], gastosGenerales: [], serviciosTerceros: [], ordenesTrabajo: [], ventasGranos: [], fletes: [], creditos: [] }
    // Agrupar ventas multi-corral para no contar de más
    const gruposVistos = new Set()
    const ventasAgrupadas = data.ventas.filter(v => {
      if (!v.grupo_venta_id) return true
      if (gruposVistos.has(v.grupo_venta_id)) return false
      gruposVistos.add(v.grupo_venta_id)
      return true
    })
    const totalVentasHacienda = ventasAgrupadas.reduce((s, v) => {
      const grupo = v.grupo_venta_id ? data.ventas.filter(vv => vv.grupo_venta_id === v.grupo_venta_id) : [v]
      const tieneFacturado = grupo.some(vv => vv.monto_facturado !== null && vv.monto_facturado !== undefined)
      if (!tieneFacturado) return s + grupo.reduce((ss, vv) => ss + (vv.total || 0), 0)
      const sumFact = grupo.reduce((ss, vv) => ss + (vv.monto_facturado || 0), 0)
      const sumIva = grupo.reduce((ss, vv) => ss + (vv.iva_monto || 0), 0)
      const sumCom = grupo.reduce((ss, vv) => ss + ((!vv.comision_es_paralela && vv.comision_monto) ? vv.comision_monto : 0), 0)
      const sumRet = grupo.reduce((ss, vv) => ss + (vv.retencion_monto || 0), 0)
      const sumNegro = grupo.reduce((ss, vv) => ss + (vv.monto_negro || 0), 0)
      // El total de la venta = neto a cobrar (facturado + iva - comisión - retención) + paralelo
      return s + (sumFact + sumIva - sumCom - sumRet) + sumNegro
    }, 0)
    const cobradoVentasHacienda = data.ventas.reduce((s, v) => s + (pagosVenta[v.id] || []).reduce((ss, p) => ss + (p.monto || 0), 0), 0)
    // Ventas de activos (maquinaria, equipos) — el comprador nos debe, igual que una venta de hacienda
    const totalVentasActivos = (data.ventasActivos || []).reduce((s, va) => s + (va.monto || 0), 0)
    const cobradoVentasActivos = (data.ventasActivos || []).reduce((s, va) => s + (va.pagos_detalle || []).reduce((ss, p) => ss + (p.monto || 0), 0), 0)
    // Servicios a terceros (trabajos facturados a un cliente) — el cliente
    // nos debe hasta que se cobre, mismo criterio que una venta de hacienda.
    const totalServicios = (data.serviciosTerceros || []).reduce((s, st) => s + (st.total || 0) + (st.monto_negro || 0), 0)
    const cobradoServicios = (data.serviciosTerceros || []).reduce((s, st) => s + (st.pagos_detalle || []).reduce((ss, p) => ss + (parseFloat(p.monto) || 0), 0), 0)
    // Ventas de granos (soja, maíz, trigo) — no tienen desglose de pagos
    // parciales (pagos_detalle), así que se toman como pendientes hasta que
    // se marquen "confirmado" con su monto real cargado.
    const totalVentasGranos = (data.ventasGranos || []).reduce((s, vg) => s + (vg.estado !== 'pactada' ? ((vg.total || 0) + (vg.monto_negro || 0)) : 0), 0)
    const cobradoVentasGranos = (data.ventasGranos || []).reduce((s, vg) => s + (vg.pagos_detalle || []).filter(p => p.tipo !== 'canje').reduce((ss, p) => ss + (parseFloat(p.monto) || 0), 0), 0)
    const totalVentas = totalVentasHacienda + totalVentasActivos + totalServicios + totalVentasGranos
    const cobradoVentas = cobradoVentasHacienda + cobradoVentasActivos + cobradoServicios + cobradoVentasGranos
    const pendienteVentas = totalVentas - cobradoVentas
    const totalComprasHacienda = data.lotes.reduce((s, l) => {
      const totalFacturasReal = (l.facturas_feria || []).reduce((ss, f) => ss + (parseFloat(f.total_factura_manual) || f.total_factura || 0), 0)
      if (totalFacturasReal > 0) return s + totalFacturasReal
      const ivaMontoCalc = l.monto_facturado != null ? Math.round(l.monto_facturado * (l.iva_pct || 10.5) / 100) : (l.iva_monto || 0)
      const totalGC = (l.monto_facturado != null || l.monto_negro != null) ? (l.monto_facturado || 0) + ivaMontoCalc + (l.monto_negro || 0) : null
      const totalLote = totalGC || l.monto_total_con_iva || (l.precio_compra && l.kg_bascula ? Math.round(l.kg_bascula * (1 - (l.desbaste_pct || 0) / 100) * l.precio_compra) : 0)
      return s + (totalLote || 0)
    }, 0)
    const pagadoComprasHacienda = data.lotes.reduce((s, l) => s + (pagosCompra[l.id] || []).reduce((ss, p) => ss + (p.monto || 0), 0), 0)
    // Compras de insumos (rollo, maíz, remedios, agroquímicos, etc.) — nosotros
    // le debemos al proveedor. Incluye Alimentación, Sanidad y Agricultura, que
    // comparten la misma tabla.
    const totalComprasInsumos = (data.comprasInsumos || []).reduce((s, ci) => s + (ci.total || 0), 0)
    const pagadoComprasInsumos = (data.comprasInsumos || []).reduce((s, ci) => s + (ci.pagos_detalle || []).reduce((ss, p) => ss + (p.monto || 0), 0), 0)
    // Gastos generales (silobolsa, flete, taller, etc.) — mismo criterio: le
    // debemos al proveedor hasta que se paguen.
    const totalGastosGenerales = (data.gastosGenerales || []).reduce((s, g) => s + (g.monto || 0), 0)
    const pagadoGastosGenerales = (data.gastosGenerales || []).reduce((s, g) => s + (g.pagos_detalle || []).reduce((ss, p) => ss + (parseFloat(p.monto) || 0), 0), 0)
    // Órdenes de trabajo con contratista (siembra, pulverización, etc.) — le
    // debemos al proveedor, mismo criterio que un gasto general.
    const totalOrdenes = (data.ordenesTrabajo || []).reduce((s, ot) => s + (ot.costo_total || 0), 0)
    const pagadoOrdenes = (data.ordenesTrabajo || []).reduce((s, ot) => s + (ot.pagos_detalle || []).reduce((ss, p) => ss + (parseFloat(p.monto) || 0), 0), 0)
    // Fletes — le debemos al transportista. No tienen desglose de pagos
    // parciales: se pagan de una sola vez, así que "pagado" es todo o nada.
    const totalFletes = (data.fletes || []).reduce((s, f) => s + (f.monto || 0), 0)
    const pagadoFletes = (data.fletes || []).reduce((s, f) => s + (f.estado_pago === 'pagado' ? (f.monto || 0) : 0), 0)
    // Créditos (bancos/financieras) — usa el saldo pendiente ya calculado en
    // Activos. Para créditos en dólares, el saldo en pesos recién se sabe
    // cuota por cuota (a medida que se pagan), así que puede no reflejar
    // todavía la deuda total en dólares que falta pagar.
    const totalCreditos = (data.creditos || []).reduce((s, c) => s + (c.monto_total || 0), 0)
    const pagadoCreditos = (data.creditos || []).reduce((s, c) => s + (c.monto_total || 0) - (c.saldo_pendiente || 0), 0)
    const totalCompras = totalComprasHacienda + totalComprasInsumos + totalGastosGenerales + totalOrdenes + totalFletes + totalCreditos
    const pagadoCompras = pagadoComprasHacienda + pagadoComprasInsumos + pagadoGastosGenerales + pagadoOrdenes + pagadoFletes + pagadoCreditos
    const pendienteCompras = totalCompras - pagadoCompras
    return { pendienteVentas, pendienteCompras, saldoNeto: pendienteVentas - pendienteCompras, totalVentas, cobradoVentas, totalCompras, pagadoCompras, ...data }
  }

  if (loading) return <Loader />

  // Construir mapa de transacciones por nombre
  const transaccionesPorNombre = {}
  ventas.forEach(v => {
    const nombre = v.comprador
    if (!nombre) return
    if (!transaccionesPorNombre[nombre]) transaccionesPorNombre[nombre] = { ventas: [], lotes: [], comprasInsumos: [], ventasActivos: [], gastosGenerales: [], serviciosTerceros: [], ordenesTrabajo: [], ventasGranos: [], fletes: [], creditos: [] }
    transaccionesPorNombre[nombre].ventas.push(v)
  })
  lotes.forEach(l => {
    const nombre = l.procedencia
    if (!nombre) return
    if (!transaccionesPorNombre[nombre]) transaccionesPorNombre[nombre] = { ventas: [], lotes: [], comprasInsumos: [], ventasActivos: [], gastosGenerales: [], serviciosTerceros: [], ordenesTrabajo: [], ventasGranos: [], fletes: [], creditos: [] }
    transaccionesPorNombre[nombre].lotes.push(l)
  })
  // Compras de insumos (rollo, maíz, remedios, etc.) — funcionan igual que una
  // compra de hacienda: nosotros le debemos al proveedor.
  comprasInsumos.forEach(ci => {
    const nombre = ci.proveedor
    if (!nombre) return
    if (!transaccionesPorNombre[nombre]) transaccionesPorNombre[nombre] = { ventas: [], lotes: [], comprasInsumos: [], ventasActivos: [], gastosGenerales: [], serviciosTerceros: [], ordenesTrabajo: [], ventasGranos: [], fletes: [], creditos: [] }
    transaccionesPorNombre[nombre].comprasInsumos.push(ci)
  })
  // Gastos generales (ej. un silobolsa, un flete, un service de taller) —
  // funcionan igual que una compra: nosotros le debemos al proveedor.
  gastosGenerales.forEach(g => {
    const nombre = g.proveedor
    if (!nombre) return
    if (!transaccionesPorNombre[nombre]) transaccionesPorNombre[nombre] = { ventas: [], lotes: [], comprasInsumos: [], ventasActivos: [], gastosGenerales: [], serviciosTerceros: [], ordenesTrabajo: [], ventasGranos: [], fletes: [], creditos: [] }
    transaccionesPorNombre[nombre].gastosGenerales.push(g)
  })
  // Servicios a terceros (trabajos de Servicios facturados a un cliente real)
  // — funcionan al revés que un gasto: el cliente nos debe a nosotros.
  serviciosTerceros.forEach(st => {
    const nombre = st.cliente
    if (!nombre) return
    if (!transaccionesPorNombre[nombre]) transaccionesPorNombre[nombre] = { ventas: [], lotes: [], comprasInsumos: [], ventasActivos: [], gastosGenerales: [], serviciosTerceros: [], ordenesTrabajo: [], ventasGranos: [], fletes: [], creditos: [] }
    transaccionesPorNombre[nombre].serviciosTerceros.push(st)
  })
  // Órdenes de trabajo de Agricultura con contratista (siembra, pulverización,
  // etc.) — le debemos al proveedor, mismo criterio que un gasto general.
  ordenesTrabajo.forEach(ot => {
    const nombre = ot.proveedor
    if (!nombre) return
    if (!transaccionesPorNombre[nombre]) transaccionesPorNombre[nombre] = { ventas: [], lotes: [], comprasInsumos: [], ventasActivos: [], gastosGenerales: [], serviciosTerceros: [], ordenesTrabajo: [], ventasGranos: [], fletes: [], creditos: [] }
    transaccionesPorNombre[nombre].ordenesTrabajo.push(ot)
  })
  // Ventas de granos (soja, maíz, trigo) — el comprador/acopio nos debe.
  ventasGranos.forEach(vg => {
    const nombre = vg.comprador
    if (!nombre) return
    if (!transaccionesPorNombre[nombre]) transaccionesPorNombre[nombre] = { ventas: [], lotes: [], comprasInsumos: [], ventasActivos: [], gastosGenerales: [], serviciosTerceros: [], ordenesTrabajo: [], ventasGranos: [], fletes: [], creditos: [] }
    transaccionesPorNombre[nombre].ventasGranos.push(vg)
  })
  // Fletes — le debemos al transportista.
  fletes.forEach(f => {
    const nombre = f.transportista
    if (!nombre) return
    if (!transaccionesPorNombre[nombre]) transaccionesPorNombre[nombre] = { ventas: [], lotes: [], comprasInsumos: [], ventasActivos: [], gastosGenerales: [], serviciosTerceros: [], ordenesTrabajo: [], ventasGranos: [], fletes: [], creditos: [] }
    transaccionesPorNombre[nombre].fletes.push(f)
  })
  // Créditos (bancos/financieras) — le debemos a la entidad.
  creditos.forEach(c => {
    const nombre = c.entidad
    if (!nombre) return
    if (!transaccionesPorNombre[nombre]) transaccionesPorNombre[nombre] = { ventas: [], lotes: [], comprasInsumos: [], ventasActivos: [], gastosGenerales: [], serviciosTerceros: [], ordenesTrabajo: [], ventasGranos: [], fletes: [], creditos: [] }
    transaccionesPorNombre[nombre].creditos.push(c)
  })
  // Ventas de activos (maquinaria, equipos) — funcionan igual que una venta de
  // hacienda: el comprador nos debe.
  ventasActivos.forEach(va => {
    const nombre = va.comprador
    if (!nombre) return
    if (!transaccionesPorNombre[nombre]) transaccionesPorNombre[nombre] = { ventas: [], lotes: [], comprasInsumos: [], ventasActivos: [], gastosGenerales: [], serviciosTerceros: [], ordenesTrabajo: [], ventasGranos: [], fletes: [], creditos: [] }
    transaccionesPorNombre[nombre].ventasActivos.push(va)
  })

  // Lista unificada de contactos (de tabla + de transacciones)
  const nombresContactos = new Set(contactos.map(c => c.nombre))
  const todosLosNombres = new Set([...Object.keys(transaccionesPorNombre), ...contactos.map(c => c.nombre)])
  const listaFiltrada = [...todosLosNombres]
    .filter(n => !filtro || n.toLowerCase().includes(filtro.toLowerCase()))
    .sort()

  // Calcular saldo para un nombre


  // Vista ficha de contacto
  if (contactoSeleccionado) {
    const nombre = contactoSeleccionado
    const { ventas: ventasCto, lotes: lotesCto, comprasInsumos: comprasInsumosCto, ventasActivos: ventasActivosCto, gastosGenerales: gastosGeneralesCto, serviciosTerceros: serviciosTercerosCto, ordenesTrabajo: ordenesTrabajoCto, ventasGranos: ventasGranosCto, fletes: fletesCto, creditos: creditosCto, pendienteVentas, pendienteCompras, saldoNeto, totalVentas, cobradoVentas, totalCompras, pagadoCompras } = calcularSaldo(nombre)
    // Remitos sin precio todavía — se muestran en su propia pestaña, sin sumar al saldo
    const remitosSinPrecio = (comprasInsumosCto || []).filter(ci => !ci.total).map(ci => ({ desc: ci.insumo_nombre || 'Insumo', cant: ci.cantidad, unidad: ci.unidad, fecha: ci.fecha }))
    // Insumos ya cargados/pagados pero todavía no retirados físicamente
    const insumosPendRetiro = (comprasInsumosCto || []).filter(ci => ci.retirado === false).map(ci => ({ id: ci.id, tabla: 'compras_insumos', insumoId: ci.insumo_id, tipo: ci.insumo_tipo, desc: ci.insumo_nombre || 'Insumo', cant: ci.cantidad, unidad: ci.unidad, fecha: ci.fecha, total: ci.total }))
    // Gastos generales pendientes de pago (ej. un silobolsa retirado, esperando
    // la factura para saber el monto y pagarlo/compensarlo)
    const gastosPendientes = (gastosGeneralesCto || []).filter(g => g.estado_pago === 'pendiente').map(g => ({ desc: g.descripcion || g.categoria || 'Gasto', fecha: g.fecha, monto: g.monto, actividad: g.actividad }))
    // Mercadería entregada a este contacto (acopio) desde una cosecha, y
    // todavía sin vender — sale de comparar lo cosechado contra lo ya vendido
    // de esa misma cosecha.
    const mercaderiaEntregada = cosechas
      .filter(co => co.acopio === nombre)
      .map(co => {
        const kgVendido = ventasGranos.filter(vg => vg.cosecha_id === co.id).reduce((s, vg) => s + (vg.kg || 0), 0)
        const kgPendiente = (co.kg_totales || 0) - kgVendido
        return { id: co.id, cultivo: co.cultivo, kgTotales: co.kg_totales, kgVendido, kgPendiente, fecha: co.fecha }
      })
      .filter(m => m.kgPendiente > 0)
    const contactoData = contactos.find(c => c.nombre === nombre)

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>
          <button onClick={() => setContactoSeleccionado(null)}
            style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>
            ← Volver
          </button>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{nombre}</div>
            {contactoData?.tipo && <div style={{ fontSize: 12, color: S.muted, textTransform: 'capitalize' }}>{contactoData.tipo.replace('_', ' ')}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button onClick={() => generarResumenCuenta(nombre)}
              style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.text, borderRadius: 6, cursor: 'pointer' }}>
              🖨️ Imprimir / Enviar resumen
            </button>
            {contactoData && (
              <>
                <button onClick={() => { setFormContacto({...contactoData}); setContactoSeleccionado(null); setShowForm(true) }}
                  style={{ padding: '7px 14px', fontSize: 12, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 6, cursor: 'pointer' }}>
                  Editar contacto
                </button>
                <button onClick={async () => { await eliminarContacto(contactoData.id); setContactoSeleccionado(null) }}
                  style={{ padding: '7px 14px', fontSize: 12, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 6, cursor: 'pointer' }}>
                  Eliminar
                </button>
              </>
            )}
          </div>
        </div>

        {/* Datos del contacto */}
        {contactoData && (
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', fontSize: 13 }}>
              {contactoData.telefono && <div><div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Teléfono</div><div>{contactoData.telefono}</div></div>}
              {contactoData.email && <div><div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Email</div><div>{contactoData.email}</div></div>}
              {contactoData.cuit && <div><div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>CUIT</div><div style={{ fontFamily: 'monospace' }}>{contactoData.cuit}</div></div>}
              {contactoData.banco && <div><div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Banco</div><div>{contactoData.banco}</div></div>}
              {contactoData.localidad && <div><div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Localidad</div><div>{contactoData.localidad}</div></div>}
              {contactoData.iva && <div><div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Condición IVA</div><div>{contactoData.iva}</div></div>}
              {contactoData.cbu && <div><div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>CBU</div><div style={{ fontFamily: 'monospace' }}>{contactoData.cbu}</div></div>}
            </div>
          </div>
        )}

        {/* Saldo neto */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
          <div style={{ background: S.greenLight, border: '1px solid #97C459', borderRadius: 8, padding: '1rem' }}>
            <div style={{ fontSize: 11, color: S.green, textTransform: 'uppercase', marginBottom: 5, fontWeight: 600 }}>Ventas (te pagan)</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: S.green }}>${(totalVentas/1000000).toFixed(2)}M</div>
            <div style={{ fontSize: 12, color: S.green, marginTop: 3 }}>Cobrado: ${(cobradoVentas/1000000).toFixed(2)}M</div>
            {pendienteVentas > 0 && <div style={{ fontSize: 12, color: S.amber, marginTop: 2 }}>Pendiente: ${(pendienteVentas/1000000).toFixed(2)}M</div>}
          </div>
          <div style={{ background: S.redLight, border: '1px solid #F09595', borderRadius: 8, padding: '1rem' }}>
            <div style={{ fontSize: 11, color: S.red, textTransform: 'uppercase', marginBottom: 5, fontWeight: 600 }}>Compras (les pagás)</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: S.red }}>-${(totalCompras/1000000).toFixed(2)}M</div>
            <div style={{ fontSize: 12, color: S.green, marginTop: 3 }}>Pagado: ${(pagadoCompras/1000000).toFixed(2)}M</div>
            {pendienteCompras > 0 && <div style={{ fontSize: 12, color: S.red, marginTop: 2 }}>Pendiente: -${(pendienteCompras/1000000).toFixed(2)}M</div>}
          </div>
          <div style={{ background: saldoNeto >= 0 ? S.accentLight : S.redLight, border: `1px solid ${saldoNeto >= 0 ? S.accent : '#F09595'}`, borderRadius: 8, padding: '1rem' }}>
            <div style={{ fontSize: 11, color: saldoNeto >= 0 ? S.accent : S.red, textTransform: 'uppercase', marginBottom: 5, fontWeight: 600 }}>Saldo neto</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', color: saldoNeto >= 0 ? S.accent : S.red }}>
              {saldoNeto >= 0 ? '+' : ''}{(saldoNeto/1000000).toFixed(2)}M
            </div>
            <div style={{ fontSize: 12, color: S.muted, marginTop: 3 }}>{saldoNeto >= 0 ? 'te deben' : 'les debés'}</div>
          </div>
        </div>

        {/* Tabs ficha */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${S.border}`, marginBottom: '1.25rem' }}>
          {[
            { key: 'oficial', label: 'Cuenta corriente' },
            ...(puedeVerParalelo ? [{ key: 'paralela', label: 'Caja 2' }] : []),
            { key: 'pendientes', label: `Remitos pendientes${(remitosSinPrecio.length + gastosPendientes.length) > 0 ? ` (${remitosSinPrecio.length + gastosPendientes.length})` : ''}` },
            { key: 'retiro', label: `Pendiente de retiro${insumosPendRetiro.length > 0 ? ` (${insumosPendRetiro.length})` : ''}` },
            { key: 'mercaderia', label: `Mercadería entregada${mercaderiaEntregada.length > 0 ? ` (${mercaderiaEntregada.length})` : ''}` },
          ].map(t => (
            <button key={t.key} onClick={() => setTabFicha(t.key)}
              style={{ padding: '9px 20px', fontSize: 13, fontWeight: tabFicha === t.key ? 600 : 500, cursor: 'pointer',
                color: tabFicha === t.key ? (t.key === 'paralela' ? '#3D1A6B' : t.key === 'pendientes' ? S.amber : t.key === 'retiro' ? '#1E5C8A' : t.key === 'mercaderia' ? S.green : S.accent) : S.muted,
                background: 'transparent', border: 'none',
                borderBottom: tabFicha === t.key ? `2px solid ${t.key === 'paralela' ? '#9F8ED4' : t.key === 'pendientes' ? '#EF9F27' : t.key === 'retiro' ? '#5DA9D6' : t.key === 'mercaderia' ? '#97C459' : S.accent}` : '2px solid transparent',
                marginBottom: -1, fontFamily: "'IBM Plex Sans', sans-serif" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Pestaña: remitos pendientes de precio */}
        {tabFicha === 'pendientes' && (
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
            {remitosSinPrecio.length === 0 && gastosPendientes.length === 0 ? (
              <div style={{ fontSize: 13, color: S.hint, textAlign: 'center', padding: '1.5rem' }}>No hay remitos pendientes de precio con este contacto.</div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: S.muted, marginBottom: 10 }}>
                  Todavía no tienen precio cargado o no están pagados — no suman al saldo hasta que se completen.
                </div>
                {remitosSinPrecio.map((r, i) => (
                  <div key={'ci' + i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: S.amberLight, border: '1px solid #EF9F27', borderRadius: 6, marginBottom: 6, fontSize: 13, color: S.amber }}>
                    <span><strong>{r.desc}</strong> · {r.cant?.toLocaleString('es-AR')}{r.unidad ? ' ' + r.unidad : ''}</span>
                    <span>{r.fecha ? new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-AR') : '—'}</span>
                  </div>
                ))}
                {gastosPendientes.map((g, i) => (
                  <div key={'gg' + i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: S.amberLight, border: '1px solid #EF9F27', borderRadius: 6, marginBottom: 6, fontSize: 13, color: S.amber }}>
                    <span><strong>{g.desc}</strong> · {g.actividad || 'Gasto general'} · {g.monto != null ? `$${g.monto.toLocaleString('es-AR')}` : 'monto a definir'}</span>
                    <span>{g.fecha ? new Date(g.fecha + 'T12:00:00').toLocaleDateString('es-AR') : '—'}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Pestaña: insumos pagados/cargados pero no retirados todavía */}
        {tabFicha === 'retiro' && (
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
            {insumosPendRetiro.length === 0 ? (
              <div style={{ fontSize: 13, color: S.hint, textAlign: 'center', padding: '1.5rem' }}>No hay insumos pendientes de retiro con este contacto.</div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: S.muted, marginBottom: 10 }}>
                  Ya están cargados (y puede que ya pagados), pero todavía no se retiraron físicamente — por eso no suman al stock hasta que los marques como retirados.
                </div>
                {insumosPendRetiro.map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#F0EAFB', border: '1px solid #9F8ED4', borderRadius: 6, marginBottom: 6, fontSize: 13 }}>
                    <div>
                      <div style={{ color: '#3D1A6B', fontWeight: 600 }}>{r.desc} · {r.cant?.toLocaleString('es-AR')}{r.unidad ? ' ' + r.unidad : ''}</div>
                      <div style={{ color: S.muted, fontSize: 11, marginTop: 2 }}>
                        {r.fecha ? new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-AR') : '—'}{r.total ? ` · $${r.total.toLocaleString('es-AR')}` : ' · sin precio todavía'}
                      </div>
                    </div>
                    <button onClick={async () => {
                      const rpc = r.tipo === 'sanitario' ? 'incrementar_stock_sanitario' : r.tipo === 'agro' ? 'incrementar_stock_agro' : 'incrementar_stock_insumo'
                      const { error: errRpc } = await supabase.rpc(rpc, { p_id: r.insumoId, p_delta: r.cant })
                      if (errRpc) { alert('Error al sumar al stock: ' + errRpc.message); return }
                      const { error: errCi } = await supabase.from('compras_insumos').update({ retirado: true }).eq('id', r.id)
                      if (errCi) { alert('El stock se actualizó, pero no se pudo marcar como retirado: ' + errCi.message); return }
                      await cargar()
                    }} style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, background: '#3D1A6B', border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      📦 Marcar retirado
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Pestaña: mercadería entregada (cosechas en depósito con este contacto, sin vender) */}
        {tabFicha === 'mercaderia' && (
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem' }}>
            {mercaderiaEntregada.length === 0 ? (
              <div style={{ fontSize: 13, color: S.hint, textAlign: 'center', padding: '1.5rem' }}>No hay mercadería entregada a este contacto sin vender todavía.</div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: S.muted, marginBottom: 10 }}>
                  Cosechas que se entregaron acá (en depósito/acopio) y todavía no se vendieron — no es una deuda, es stock tuyo guardado en otro lado.
                </div>
                {mercaderiaEntregada.map((m, i) => (
                  <div key={i} style={{ padding: '10px 12px', background: S.greenLight, border: '1px solid #97C459', borderRadius: 6, marginBottom: 6, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: S.green, fontWeight: 700 }}>{m.cultivo}</span>
                      <span style={{ color: S.muted }}>{m.fecha ? new Date(m.fecha + 'T12:00:00').toLocaleDateString('es-AR') : '—'}</span>
                    </div>
                    <div style={{ color: S.green, marginTop: 3 }}>
                      Pendiente de vender: <strong>{(m.kgPendiente / 1000).toLocaleString('es-AR')} tn</strong>
                      {m.kgVendido > 0 && <span style={{ color: S.muted }}> (de {(m.kgTotales / 1000).toLocaleString('es-AR')} tn — ya vendiste {(m.kgVendido / 1000).toLocaleString('es-AR')} tn)</span>}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Cuenta corriente unificada */}
        {tabFicha !== 'pendientes' && tabFicha !== 'retiro' && tabFicha !== 'mercaderia' && (() => {
          const esParalela = tabFicha === 'paralela' && puedeVerParalelo
          const movimientos = []

          // Ventas — agrupar multi-corral
          const ventasVistasCtaCte = new Set()
          ventasCto.forEach(v => {
            if (v.grupo_venta_id) {
              if (ventasVistasCtaCte.has(v.grupo_venta_id)) return
              ventasVistasCtaCte.add(v.grupo_venta_id)
            }
            const grupo = v.grupo_venta_id ? ventasCto.filter(vv => vv.grupo_venta_id === v.grupo_venta_id) : [v]
            const fechaOp = v.fecha || v.creado_en?.split('T')[0]
            const fechaVto = v.fecha_vencimiento_cobro
            const montoFact = (() => {
              // Tiene que coincidir exactamente con "Neto a cobrar" de Gestión Comercial
              // en Ventas (facturado + IVA - comisión - retención) — antes acá solo se
              // usaba monto_facturado, sin sumar el IVA ni restar la retención, y por
              // eso la cuenta corriente oficial no coincidía con Gestión Comercial.
              const tieneFacturado = grupo.some(vv => vv.monto_facturado !== null && vv.monto_facturado !== undefined)
              if (!tieneFacturado) return grupo.reduce((s, vv) => s + (vv.total || 0), 0)
              const sumFact = grupo.reduce((s, vv) => s + (vv.monto_facturado || 0), 0)
              const sumIva = grupo.reduce((s, vv) => s + (vv.iva_monto || 0), 0)
              const sumCom = grupo.reduce((s, vv) => s + ((!vv.comision_es_paralela && vv.comision_monto) ? vv.comision_monto : 0), 0)
              const sumRet = grupo.reduce((s, vv) => s + (vv.retencion_monto || 0), 0)
              return sumFact + sumIva - sumCom - sumRet
            })()
            const montoParalelo = grupo.reduce((s, vv) => s + (vv.monto_negro || 0), 0)
            const corralesStr = grupo.length > 1 ? grupo.map(vv => `C-${vv.corrales?.numero}`).join(', ') : `C-${v.corrales?.numero}`
            const cantidadTotal = grupo.reduce((s, vv) => s + (vv.cantidad || 0), 0)
            const ventaId = v.grupo_venta_id || v.id

            if (!esParalela && montoFact > 0) {
              movimientos.push({
                fecha: fechaOp, fechaVto, tipo: 'e-CVA', nro: ventaId,
                descripcion: `Venta hacienda ${corralesStr} · ${cantidadTotal} cab`,
                credito: montoFact, debito: 0,
              })
            }
            if (esParalela && montoParalelo > 0) {
              movimientos.push({
                fecha: fechaOp, fechaVto: null, tipo: 'PAR', nro: ventaId,
                descripcion: `Venta hacienda ${corralesStr} · ${cantidadTotal} cab`,
                credito: montoParalelo, debito: 0,
              })
            }
            // Cobros del grupo
            const todosLosPagos = grupo.flatMap(vv => pagosVenta[vv.id] || [])
            todosLosPagos.forEach(p => {
              const esParaleloP = p.es_paralelo || false
              if (esParalela && !esParaleloP) return
              if (!esParalela && esParaleloP) return
              movimientos.push({
                fecha: p.fecha, fechaVto: null, tipo: 'COBRO', nro: p.id,
                descripcion: `Cobro venta ${corralesStr} · ${p.forma_pago}${p.numero_cheque ? ' #' + p.numero_cheque : ''}`,
                credito: 0, debito: p.monto, esPago: true,
              })
            })
          })

          // Compras
          lotesCto.forEach(l => {
            const totalFacturasRealL = (l.facturas_feria || []).reduce((ss, f) => ss + (parseFloat(f.total_factura_manual) || f.total_factura || 0), 0)
            const ivaMontoCalc = l.monto_facturado != null ? Math.round(l.monto_facturado * (l.iva_pct || 10.5) / 100) : (l.iva_monto || 0)
            const total = l.precio_compra && l.kg_bascula ? Math.round(l.kg_bascula * (1 - (l.desbaste_pct || 0) / 100) * l.precio_compra) : 0
            const montoFact = totalFacturasRealL > 0 ? totalFacturasRealL : (l.monto_facturado != null ? l.monto_facturado + ivaMontoCalc : total)
            const montoParalelo = l.monto_negro || 0
            const venc = vencimientosCompra[l.id] || []

            if (!esParalela && montoFact > 0) {
              movimientos.push({
                fecha: l.fecha_ingreso || l.created_at?.split('T')[0],
                fechaVto: venc.length > 0 ? venc[0].fecha_vencimiento : l.fecha_vencimiento_pago,
                tipo: 'e-LCA', nro: l.codigo,
                descripcion: `Compra ${l.codigo} · ${l.cantidad} cab · ${l.kg_bascula?.toLocaleString('es-AR')} kg`,
                credito: 0, debito: montoFact, factura: l.numero_factura,
              })
            }
            if (esParalela && montoParalelo > 0) {
              movimientos.push({
                fecha: l.fecha_ingreso || l.created_at?.split('T')[0],
                fechaVto: null, tipo: 'PAR', nro: l.codigo,
                descripcion: `Compra ${l.codigo} · ${l.cantidad} cab`,
                credito: 0, debito: montoParalelo,
              })
            }
            // Pagos
            ;(pagosCompra[l.id] || []).forEach(p => {
              const esParaleloP = p.es_paralelo || p.es_negro || false
              if (esParalela && !esParaleloP) return
              if (!esParalela && esParaleloP) return
              movimientos.push({
                fecha: p.fecha, fechaVto: null, tipo: 'PAGO', nro: p.id,
                descripcion: `Pago compra ${l.codigo} · ${p.forma_pago}${p.numero_cheque ? ' #' + p.numero_cheque : ''}`,
                credito: p.monto, debito: 0, esPago: true,
              })
            })
          })

          // Compras de insumos (rollo, maíz, remedios, agroquímicos, etc.) — le
          // debemos al proveedor, sea de Alimentación, Sanidad o Agricultura.
          ;(comprasInsumosCto || []).forEach(ci => {
            const esParaleloCi = ci.es_paralelo || false
            if (esParalela && !esParaleloCi) return
            if (!esParalela && esParaleloCi) return
            if (ci.total > 0) {
              movimientos.push({
                fecha: ci.fecha || ci.creado_en?.split('T')[0],
                fechaVto: null, tipo: esParaleloCi ? 'PAR' : (ci.insumo_tipo === 'agro' ? 'AGRO' : 'INSUMO'), nro: ci.id,
                descripcion: `${ci.insumo_nombre || 'Insumo'} · ${ci.cantidad || ''}${ci.unidad ? ' ' + ci.unidad : ''}`,
                credito: 0, debito: ci.total, factura: ci.numero_factura,
              })
            }
            // Pagos reales en plata (si están cargados en pagos_detalle) — los pagos
            // tipo "canje" NO generan esta fila aparte: el débito de la compra de
            // arriba ya representa el movimiento completo, y agregar un crédito acá
            // encima cancelaría ese débito sin sentido (no hubo plata real de por medio).
            ;(ci.pagos_detalle || []).filter(p => p.tipo !== 'canje' && parseFloat(p.monto) > 0).forEach((p, pi) => {
              movimientos.push({
                fecha: p.fecha, fechaVto: null, tipo: 'PAGO', nro: `${ci.id}-${pi}`,
                descripcion: `Pago ${ci.insumo_nombre || 'insumo'} · ${p.forma_pago || ''}`,
                credito: p.monto, debito: 0, esPago: true,
              })
            })
          })

          // Gastos generales (silobolsa, flete, taller, etc.) — le debemos al proveedor.
          ;(gastosGeneralesCto || []).forEach(g => {
            const esParaleloGg = g.es_paralelo || false
            if (esParalela && !esParaleloGg) return
            if (!esParalela && esParaleloGg) return
            if (g.monto > 0) {
              movimientos.push({
                fecha: g.fecha, fechaVto: null, tipo: esParaleloGg ? 'PAR' : 'GASTO', nro: g.id,
                descripcion: `${g.descripcion || g.categoria || 'Gasto'} · ${g.actividad || ''}`,
                credito: 0, debito: g.monto, factura: g.comprobante,
              })
            }
            ;(g.pagos_detalle || []).filter(p => p.tipo !== 'canje' && parseFloat(p.monto) > 0).forEach((p, pi) => {
              movimientos.push({
                fecha: g.fecha, fechaVto: null, tipo: 'PAGO', nro: `gg${g.id}-${pi}`,
                descripcion: `Pago ${g.descripcion || g.categoria || 'gasto'} · ${p.tipo || ''}`,
                credito: parseFloat(p.monto) || 0, debito: 0, esPago: true,
              })
            })
          })

          // Órdenes de trabajo con contratista (Agricultura) — le debemos al proveedor.
          ;(ordenesTrabajoCto || []).forEach(ot => {
            const esParaleloOt = ot.es_paralelo || false
            if (esParalela && !esParaleloOt) return
            if (!esParalela && esParaleloOt) return
            if (ot.costo_total > 0) {
              movimientos.push({
                fecha: ot.fecha, fechaVto: null, tipo: esParaleloOt ? 'PAR' : 'ORDEN', nro: ot.id,
                descripcion: `${ot.tipo || 'Orden'}${ot.descripcion ? ' · ' + ot.descripcion : ''}`,
                credito: 0, debito: ot.costo_total,
              })
            }
            ;(ot.pagos_detalle || []).filter(p => p.tipo !== 'canje' && parseFloat(p.monto) > 0).forEach((p, pi) => {
              movimientos.push({
                fecha: ot.fecha, fechaVto: null, tipo: 'PAGO', nro: `ot${ot.id}-${pi}`,
                descripcion: `Pago ${ot.tipo || 'orden'} · ${p.tipo || ''}`,
                credito: parseFloat(p.monto) || 0, debito: 0, esPago: true,
              })
            })
          })

          // Ventas de granos — el comprador nos debe (sin desglose de pagos parciales).
          ;(ventasGranosCto || []).forEach(vg => {
            if (vg.estado === 'pactada') return
            if (!esParalela && vg.total > 0) {
              movimientos.push({
                fecha: vg.fecha, fechaVto: null, tipo: 'GRANOS', nro: vg.id,
                descripcion: `Venta ${vg.cultivo || 'grano'}`,
                credito: vg.total, debito: 0,
              })
            }
            if (esParalela && vg.monto_negro > 0) {
              movimientos.push({
                fecha: vg.fecha, fechaVto: null, tipo: 'PAR', nro: vg.id,
                descripcion: `Venta ${vg.cultivo || 'grano'} (Caja 2)`,
                credito: vg.monto_negro, debito: 0,
              })
            }
            ;(vg.pagos_detalle || []).filter(p => p.tipo !== 'canje' && parseFloat(p.monto) > 0).forEach((p, pi) => {
              const esPagoParalelo = p.es_paralelo || false
              if (esParalela !== esPagoParalelo) return
              movimientos.push({
                fecha: vg.fecha, fechaVto: null, tipo: 'COBRO', nro: `vg${vg.id}-${pi}`,
                descripcion: `Cobro venta ${vg.cultivo || 'grano'} · ${p.tipo || ''}`,
                credito: 0, debito: parseFloat(p.monto) || 0, esPago: true,
              })
            })
          })

          // Fletes — le debemos al transportista (se pagan de una sola vez).
          ;(fletesCto || []).forEach(f => {
            if (!f.monto) return
            const esParaleloF = !!f.caja_paralela_id
            if (f.estado_pago === 'pagado') {
              if (esParalela !== esParaleloF) return
              movimientos.push({ fecha: f.fecha, fechaVto: null, tipo: esParaleloF ? 'PAR' : 'FLETE', nro: f.id, descripcion: `Flete · ${f.transportista || ''}`, credito: 0, debito: f.monto })
              movimientos.push({ fecha: f.fecha, fechaVto: null, tipo: 'PAGO', nro: `f${f.id}`, descripcion: `Pago flete`, credito: f.monto, debito: 0, esPago: true })
            } else if (!esParalela) {
              movimientos.push({ fecha: f.fecha, fechaVto: null, tipo: 'FLETE', nro: f.id, descripcion: `Flete · ${f.transportista || ''}`, credito: 0, debito: f.monto })
            }
          })

          // Créditos (bancos/financieras) — cada cuota pagada es un pago; las
          // pendientes en pesos se muestran como obligación (en dólares no,
          // porque el peso recién se sabe al pagarlas).
          if (!esParalela) {
            ;(creditosCto || []).forEach(c => {
              ;(c.cuotas || []).forEach(cuota => {
                if (cuota.estado === 'pagado' && cuota.monto > 0) {
                  movimientos.push({ fecha: cuota.fecha_pago || cuota.fecha, fechaVto: null, tipo: 'PAGO', nro: `cr${c.id}-${cuota.id}`, descripcion: `Pago cuota ${cuota.nro_cuota} — ${c.descripcion || 'Crédito'}`, credito: cuota.monto, debito: 0, esPago: true })
                } else if (cuota.estado !== 'pagado' && !c.es_dolares && cuota.monto > 0) {
                  movimientos.push({ fecha: cuota.fecha, fechaVto: cuota.fecha, tipo: 'CUOTA', nro: `cr${c.id}-${cuota.id}`, descripcion: `Cuota ${cuota.nro_cuota} — ${c.descripcion || 'Crédito'}`, credito: 0, debito: cuota.monto })
                }
              })
            })
          }

          // Ventas de activos (maquinaria, equipos) — el comprador nos debe
          ;(ventasActivosCto || []).forEach(va => {
            const esParaleloVA = va.es_paralelo || false
            if (esParalela && !esParaleloVA) return
            if (!esParalela && esParaleloVA) return
            if (va.monto > 0) {
              movimientos.push({
                fecha: va.fecha || va.creado_en?.split('T')[0],
                fechaVto: null, tipo: esParaleloVA ? 'PAR' : 'ACTIVO', nro: va.id,
                descripcion: `Venta ${va.activo_nombre || 'activo'}${va.observaciones ? ' · ' + va.observaciones : ''}`,
                credito: va.monto, debito: 0,
              })
            }
            ;(va.pagos_detalle || []).filter(p => parseFloat(p.monto) > 0).forEach((p, pi) => {
              movimientos.push({
                fecha: p.fecha, fechaVto: null, tipo: 'COBRO', nro: `${va.id}-${pi}`,
                descripcion: `Cobro venta ${va.activo_nombre || 'activo'} · ${p.forma_pago || ''}`,
                credito: 0, debito: p.monto, esPago: true,
              })
            })
          })

          // Servicios a terceros — el cliente nos debe hasta que se cobre.
          ;(serviciosTercerosCto || []).forEach(st => {
            const fecha = st.fecha || st.creado_en?.split('T')[0]
            if (!esParalela && st.total > 0) {
              movimientos.push({
                fecha, fechaVto: null, tipo: 'SERVICIO', nro: st.id,
                descripcion: `${st.labor || 'Servicio'}${st.cultivo ? ' · ' + st.cultivo : ''}${st.campo ? ' · ' + st.campo : ''}`,
                credito: st.total, debito: 0,
              })
            }
            if (esParalela && st.monto_negro > 0) {
              movimientos.push({
                fecha, fechaVto: null, tipo: 'PAR', nro: st.id,
                descripcion: `${st.labor || 'Servicio'} (Caja 2)`,
                credito: st.monto_negro, debito: 0,
              })
            }
            ;(st.pagos_detalle || []).filter(p => p.tipo !== 'canje' && parseFloat(p.monto) > 0).forEach((p, pi) => {
              const esPagoParalelo = p.es_paralelo || false
              if (esParalela !== esPagoParalelo) return
              movimientos.push({
                fecha, fechaVto: null, tipo: 'COBRO', nro: `st${st.id}-${pi}`,
                descripcion: `Cobro ${st.labor || 'servicio'} · ${p.tipo || ''}`,
                credito: 0, debito: parseFloat(p.monto) || 0, esPago: true,
              })
            })
          })

          // Ordenar por fecha
          movimientos.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))

          // Calcular saldo acumulado
          let saldoAcum = 0
          const movConSaldo = movimientos.map(m => {
            saldoAcum += (Number(m.credito) || 0) - (Number(m.debito) || 0)
            return { ...m, saldoAcum }
          })

          const colNegro = '#3D1A6B'
          const bgNegro = '#F0EAFB'

          return (
            <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, overflow: 'auto' }}>
              {/* Encabezado estilo estado de cuenta */}
              <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{esParalela ? 'Caja 2' : 'Caja 1'}</div>
                  {contactoData?.cuit && <div style={{ fontSize: 11, color: S.muted, fontFamily: 'monospace' }}>CUIT: {contactoData.cuit}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: S.muted }}>Saldo final</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: saldoAcum >= 0 ? S.green : S.red }}>
                    {saldoAcum >= 0 ? '+' : ''}{saldoAcum.toLocaleString('es-AR')}
                  </div>
                  <div style={{ fontSize: 11, color: S.muted }}>{saldoAcum >= 0 ? 'te deben' : 'les debés'}</div>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 800 }}>
                <thead>
                  <tr style={{ background: S.accent }}>
                    {['Fecha op.', 'Tipo', 'N° Doc.', 'Fecha vto.', 'Descripción', 'Débito', 'Crédito', 'Saldo'].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: h === 'Débito' || h === 'Crédito' || h === 'Saldo' ? 'right' : 'left', fontWeight: 600, color: '#fff', fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {movConSaldo.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay movimientos registrados.</td></tr>
                  )}
                  {movConSaldo.map((m, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${S.border}`, background: m.tipo === 'PAR' ? '#F0EAFB' : m.esPago ? '#F0FFF4' : i % 2 === 0 ? S.surface : S.bg }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11 }}>
                        {m.fecha ? new Date(m.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                          background: m.esPago ? S.greenLight : m.tipo === 'PAR' ? '#F0EAFB' : m.tipo === 'e-CVA' || m.tipo === 'COBRO' || m.tipo === 'ACTIVO' ? '#E8F8EF' : S.accentLight,
                          color: m.esPago ? S.green : m.tipo === 'PAR' ? '#3D1A6B' : m.tipo === 'e-CVA' || m.tipo === 'COBRO' || m.tipo === 'ACTIVO' ? '#0D6E3B' : S.accent,
                          border: `1px solid ${m.esPago ? '#97C459' : m.tipo === 'PAR' ? '#9F8ED4' : m.tipo === 'e-CVA' || m.tipo === 'COBRO' || m.tipo === 'ACTIVO' ? '#5DBF8C' : '#85B7EB'}` }}>
                          {m.tipo}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, color: S.muted }}>{m.factura || (typeof m.nro === 'string' ? m.nro : `#${m.nro}`)}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, color: m.fechaVto && new Date(m.fechaVto) < new Date() ? S.red : S.muted }}>
                        {m.fechaVto ? new Date(m.fechaVto + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', color: m.esNegro ? colNegro : S.text }}>{m.descripcion}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: m.debito > 0 ? S.red : S.hint }}>
                        {m.debito > 0 ? m.debito.toLocaleString('es-AR') : ''}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: m.credito > 0 ? S.green : S.hint }}>
                        {m.credito > 0 ? m.credito.toLocaleString('es-AR') : ''}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: m.saldoAcum >= 0 ? S.green : S.red }}>
                        {m.saldoAcum.toLocaleString('es-AR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: S.accent }}>
                    <td colSpan={5} style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700, color: '#fff' }}>SALDO FINAL</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#fff' }}>
                      {movConSaldo.reduce((s, m) => s + (Number(m.debito) || 0), 0).toLocaleString('es-AR')}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#fff' }}>
                      {movConSaldo.reduce((s, m) => s + (Number(m.credito) || 0), 0).toLocaleString('es-AR')}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: saldoAcum >= 0 ? '#7EE8A2' : '#F09595' }}>
                      {saldoAcum.toLocaleString('es-AR')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        })()}
      </div>
    )
  }

  // Vista lista de contactos
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 3 }}>Contactos</div>
      <div style={{ fontSize: 12, color: S.muted, marginBottom: '1.5rem' }}>Compradores, vendedores y cuenta corriente</div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <input type="text" placeholder="Buscar contacto..." value={filtro} onChange={e => setFiltro(e.target.value)}
          style={{ width: 280, padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface, fontFamily: "'IBM Plex Sans', sans-serif" }} />
        <button onClick={() => { setFormContacto({ nombre: '', tipo: 'otro', telefono: '', email: '', cuit: '', banco: '', localidad: '', iva: '', cbu: '', observaciones: '' }); setShowForm(!showForm) }}
          style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          + Nuevo contacto
        </button>
      </div>

      {showForm && (
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: '1rem' }}>{formContacto.id ? 'Editar contacto' : 'Nuevo contacto'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '.75rem' }}>
            {[
              { label: 'Nombre', key: 'nombre', type: 'text', required: true },
              { label: 'Teléfono', key: 'telefono', type: 'text' },
              { label: 'Email', key: 'email', type: 'email' },
              { label: 'CUIT', key: 'cuit', type: 'text' },
              { label: 'Banco', key: 'banco', type: 'text' },
              { label: 'Localidad', key: 'localidad', type: 'text' },
              { label: 'Condición IVA', key: 'iva', type: 'text' },
              { label: 'CBU', key: 'cbu', type: 'text' },
            ].map(f => (
              <div key={f.key}>
                <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>{f.label}{f.required ? ' *' : ''}</div>
                <input type={f.type} value={formContacto[f.key] || ''} onChange={e => setFormContacto({...formContacto, [f.key]: e.target.value})}
                  style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '9px 12px', fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: "'IBM Plex Sans', sans-serif" }} />
              </div>
            ))}
            <div>
              <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Tipo</div>
              <select value={formContacto.tipo || 'otro'} onChange={e => setFormContacto({...formContacto, tipo: e.target.value})}
                style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '9px 12px', fontSize: 13, background: S.surface }}>
                {TIPOS.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 5 }}>Asociado a (para que aparezca solo en las listas relevantes — si no marcás nada, aparece en todas)</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {['Feedlot', 'Agricultura', 'Servicios', 'General'].map(act => {
                  const activo = (formContacto.actividades || []).includes(act)
                  return (
                    <label key={act} onClick={() => {
                      const actuales = formContacto.actividades || []
                      const nuevas = activo ? actuales.filter(a => a !== act) : [...actuales, act]
                      setFormContacto({...formContacto, actividades: nuevas})
                    }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', border: `1px solid ${activo ? S.accent : S.border}`, borderRadius: 6, background: activo ? S.accentLight : S.surface, color: activo ? S.accent : S.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      <input type="checkbox" checked={activo} readOnly style={{ margin: 0 }} />
                      {act}
                    </label>
                  )
                })}
              </div>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Observaciones</div>
              <input type="text" value={formContacto.observaciones || ''} onChange={e => setFormContacto({...formContacto, observaciones: e.target.value})}
                style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '9px 12px', fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: "'IBM Plex Sans', sans-serif" }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={guardarContacto} disabled={guardando}
              style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
            <button onClick={() => setShowForm(false)}
              style={{ padding: '8px 16px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {listaFiltrada.map(nombre => {
          const { pendienteVentas, pendienteCompras, saldoNeto, ventas: v, lotes: l } = calcularSaldo(nombre)
          const contactoData = contactos.find(c => c.nombre === nombre)
          const tieneTransacciones = v.length > 0 || l.length > 0
          return (
            <div key={nombre} onClick={() => setContactoSeleccionado(nombre)}
              style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1rem', cursor: 'pointer', transition: 'border-color .15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = S.accent}
              onMouseLeave={e => e.currentTarget.style.borderColor = S.border}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{nombre}</div>
                  {contactoData?.tipo && <div style={{ fontSize: 11, color: S.muted, textTransform: 'capitalize', marginTop: 2 }}>{contactoData.tipo.replace(/_/g, ' ')}</div>}
                </div>
                {tieneTransacciones && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: saldoNeto >= 0 ? S.green : S.red }}>
                      {saldoNeto >= 0 ? '+' : ''}{(saldoNeto/1000000).toFixed(1)}M
                    </div>
                    <div style={{ fontSize: 10, color: S.muted }}>{saldoNeto >= 0 ? 'te deben' : 'les debés'}</div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {v.length > 0 && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: S.greenLight, color: S.green, fontWeight: 600 }}>{v.length} ventas</span>}
                {l.length > 0 && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: S.redLight, color: S.red, fontWeight: 600 }}>{l.length} compras</span>}
                {contactoData?.telefono && <span style={{ fontSize: 11, color: S.muted }}>📞 {contactoData.telefono}</span>}
              </div>
              {!contactoData && (
                <button onClick={e => { e.stopPropagation(); setFormContacto({ nombre, tipo: 'otro', telefono: '', email: '', cuit: '', direccion: '', observaciones: '' }); setShowForm(true) }}
                  style={{ marginTop: 8, width: '100%', padding: '4px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 4, cursor: 'pointer' }}>
                  + Agregar datos
                </button>
              )}
            </div>
          )
        })}
        {listaFiltrada.length === 0 && (
          <div style={{ gridColumn: '1/-1', padding: '3rem', textAlign: 'center', color: S.hint }}>No hay contactos.</div>
        )}
      </div>
    </div>
  )
}
