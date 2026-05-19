import React, { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Card, Btn, Badge, Loader } from './Tablero'

const S = {
  bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6',
  text: '#1A1916', muted: '#6B6760', hint: '#9E9A94',
  accent: '#1A3D6B', accentLight: '#E8EFF8',
  green: '#1E5C2E', greenLight: '#E8F4EB',
  amber: '#7A4500', amberLight: '#FDF0E0',
  red: '#7A1A1A', redLight: '#FDF0F0',
}

export default function Ingresos({ usuario }) {
  const [lotes, setLotes] = useState([])
  const [corrales, setCorrales] = useState([])
  const [procedencias, setProcedencias] = useState([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState('lista')
  const [tab, setTab] = useState('lista')
  const [pagosCompras, setPagosCompras] = useState({})
  const [registrandoPagoCompra, setRegistrandoPagoCompra] = useState(null)
  const [formPagoCompra, setFormPagoCompra] = useState({ monto: '', forma_pago: 'transferencia', fecha: new Date().toISOString().split('T')[0], numero_cheque: '', banco: '', fecha_vencimiento_cheque: '' })
  const [editandoFactura, setEditandoFactura] = useState(null)
  const [formFactura, setFormFactura] = useState({ numero_factura: '', fecha_factura: '', forma_pago: 'contado', plazo_dias: '', fecha_vencimiento_pago: '', observaciones_pago: '', monto_facturado: '', monto_negro: '' })
  const [editandoLote, setEditandoLote] = useState(null)
  const [vencimientosLote, setVencimientosLote] = useState({})
  const [formVencimientos, setFormVencimientos] = useState([])
  const [editandoPrecio, setEditandoPrecio] = useState(null)
  const [form, setForm] = useState({
    procedencia: '', otraProcedencia: '', categoria: 'Novillos 2-3 anos',
    cantidad: '', kg_bascula: '', kg_factura: '', precio_compra: '',
    observaciones: '', corral_cuarentena_id: ''
  })
  const [guardando, setGuardando] = useState(false)
  const esDueno = ['dueno', 'secretaria'].includes(usuario?.rol)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    const [{ data: l }, { data: c }] = await Promise.all([
      supabase.from('lotes').select('*, corrales:corral_cuarentena_id(numero)').order('created_at', { ascending: false }),
      supabase.from('corrales').select('*').in('rol', ['cuarentena', 'libre']).order('numero'),
    ])
    setLotes(l || [])
    const { data: pagos } = await supabase.from('pagos_compras').select('*').order('fecha', { ascending: false })
    const pagosPorLote = {}
    ;(pagos || []).forEach(p => {
      if (!pagosPorLote[p.lote_id]) pagosPorLote[p.lote_id] = []
      pagosPorLote[p.lote_id].push(p)
    })
    setPagosCompras(pagosPorLote)
    setCorrales(c || [])
    const procs = [...new Set((l || []).map(x => x.procedencia).filter(Boolean))].sort()
    setProcedencias(procs)
    const { data: venc } = await supabase.from('vencimientos_compra').select('*').order('fecha_vencimiento')
    const vencPorLote = {}
    ;(venc || []).forEach(v => {
      if (!vencPorLote[v.lote_id]) vencPorLote[v.lote_id] = []
      vencPorLote[v.lote_id].push(v)
    })
    setVencimientosLote(vencPorLote)
    setLoading(false)
  }

  async function editarLote(lote) {
    setEditandoLote(lote)
    setForm({
      procedencia: lote.procedencia || '',
      otraProcedencia: '',
      categoria: lote.categoria || 'Novillos 2-3 anos',
      cantidad: String(lote.cantidad || ''),
      kg_bascula: String(lote.kg_bascula || ''),
      kg_factura: String(lote.kg_factura || ''),
      precio_compra: String(lote.precio_compra || ''),
      observaciones: lote.observaciones || '',
      corral_cuarentena_id: String(lote.corral_cuarentena_id || ''),
    })
    setVista('editar')
  }

  async function guardarEdicion() {
    if (!form.cantidad || !form.kg_bascula) { alert('Completa cantidad y kg'); return }
    setGuardando(true)
    const procFinal = form.procedencia === 'Otro' ? (form.otraProcedencia?.trim() || 'Otro') : form.procedencia
    await supabase.from('lotes').update({
      procedencia: procFinal,
      categoria: form.categoria,
      cantidad: parseInt(form.cantidad),
      kg_bascula: parseFloat(form.kg_bascula),
      kg_factura: form.kg_factura ? parseFloat(form.kg_factura) : null,
      precio_compra: form.precio_compra ? parseFloat(form.precio_compra) : null,
      observaciones: form.observaciones || null,
      peso_prom_ingreso: form.cantidad && form.kg_bascula ? Math.round(parseFloat(form.kg_bascula) / parseInt(form.cantidad)) : null,
    }).eq('id', editandoLote.id)
    setGuardando(false)
    setEditandoLote(null)
    setVista('lista')
    await cargarDatos()
  }

  async function guardarIngreso() {
    if (!form.cantidad || !form.kg_bascula) { alert('Completa cantidad y kg báscula'); return }
    const procFinal = form.procedencia === 'Otro' ? (form.otraProcedencia?.trim() || 'Otro') : form.procedencia
    if (!procFinal) { alert('Ingresa la procedencia'); return }
    setGuardando(true)
    const codigo = `L-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`
    const peso_prom = parseFloat(form.kg_bascula) / parseInt(form.cantidad)

    const { error } = await supabase.from('lotes').insert({
      codigo,
      fecha_ingreso: new Date().toISOString().split('T')[0],
      procedencia: procFinal,
      categoria: form.categoria,
      cantidad: parseInt(form.cantidad),
      kg_bascula: parseFloat(form.kg_bascula),
      kg_factura: form.kg_factura ? parseFloat(form.kg_factura) : null,
      precio_compra: form.precio_compra ? parseFloat(form.precio_compra) : null,
      peso_prom_ingreso: Math.round(peso_prom * 100) / 100,
      corral_cuarentena_id: form.corral_cuarentena_id || null,
      observaciones: form.observaciones || null,
      registrado_por: usuario?.id,
    })

    if (!error) {
      const fechaFin = new Date(); fechaFin.setDate(fechaFin.getDate() + 10)
      await supabase.from('alertas').insert({
        tipo: 'cuarentena_vence',
        titulo: `Pase a acumulacion - ${codigo}`,
        descripcion: `${form.cantidad} animales terminan cuarentena`,
        fecha_vence: fechaFin.toISOString().split('T')[0],
      })
      if (peso_prom < 180) {
        const fecha2da = new Date(); fecha2da.setDate(fecha2da.getDate() + 20)
        await supabase.from('alertas').insert({
          tipo: 'segunda_dosis',
          titulo: `Segunda dosis Alliance+Feedlot - ${codigo}`,
          descripcion: `${form.cantidad} animales ingresaron con ${Math.round(peso_prom)} kg prom.`,
          fecha_vence: fecha2da.toISOString().split('T')[0],
        })
      }
      if (form.corral_cuarentena_id) {
        const { data: corral } = await supabase.from('corrales').select('animales').eq('id', form.corral_cuarentena_id).single()
        await supabase.from('corrales').update({
          animales: (corral?.animales || 0) + parseInt(form.cantidad),
          rol: 'cuarentena'
        }).eq('id', form.corral_cuarentena_id)
      }
      await cargarDatos()
      setVista('lista')
      setForm({ procedencia: '', otraProcedencia: '', categoria: 'Novillos 2-3 anos', cantidad: '', kg_bascula: '', kg_factura: '', precio_compra: '', observaciones: '', corral_cuarentena_id: '' })
    }
    setGuardando(false)
  }

  async function guardarPrecio(lote) {
    if (!editandoPrecio?.precio_compra) { alert('Ingresa el precio'); return }
    const procFinal = editandoPrecio.procedencia === 'Otro'
      ? (editandoPrecio.otraProcedencia?.trim() || null)
      : (editandoPrecio.procedencia || null)
    await supabase.from('lotes').update({
      precio_compra: parseFloat(editandoPrecio.precio_compra),
      kg_factura: editandoPrecio.kg_factura ? parseFloat(editandoPrecio.kg_factura) : null,
      procedencia: procFinal || lote.procedencia || null,
    }).eq('id', lote.id)
    setEditandoPrecio(null)
    await cargarDatos()
  }

  async function eliminarLote(id) {
    if (!confirm('Eliminar este ingreso?')) return
    const { data: lote } = await supabase.from('lotes').select('cantidad, corral_cuarentena_id').eq('id', id).single()
    if (lote?.corral_cuarentena_id && lote?.cantidad) {
      const { data: corral } = await supabase.from('corrales').select('animales').eq('id', lote.corral_cuarentena_id).single()
      const nuevosAnim = Math.max(0, (corral?.animales || 0) - lote.cantidad)
const updateCorral = { animales: nuevosAnim }
if (nuevosAnim === 0) { updateCorral.rol = 'libre'; updateCorral.sub = null }
await supabase.from('corrales').update(updateCorral).eq('id', lote.corral_cuarentena_id)
    }
    await supabase.from('lotes').delete().eq('id', id)
    await cargarDatos()
  }

  if (loading) return <Loader />

  const lotesSinPrecio = esDueno ? lotes.filter(l => !l.precio_compra || !l.procedencia) : []

  if (vista === 'editar' && editandoLote) {
    const promEst = form.cantidad && form.kg_bascula ? Math.round(parseFloat(form.kg_bascula) / parseInt(form.cantidad)) : null
    const kgBas = parseFloat(form.kg_bascula) || 0
    const kgFac = parseFloat(form.kg_factura) || 0
    const diffKg = kgBas && kgFac ? kgBas - kgFac : null
    const diffPct = diffKg !== null && kgFac > 0 ? (diffKg / kgFac * 100) : null
    const alertaDiff = diffPct !== null && Math.abs(diffPct) > 3
    const totalCompra = kgBas && form.precio_compra ? Math.round(kgBas * parseFloat(form.precio_compra)) : null

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>
          <Btn ghost sm onClick={() => { setVista('lista'); setEditandoLote(null) }}>Volver</Btn>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600 }}>Editar ingreso · {editandoLote.codigo}</h1>
            <div style={{ fontSize: 12, color: S.muted }}>Corregir datos del lote</div>
          </div>
        </div>

        <Card titulo="Datos del lote">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Procedencia</label>
              <select style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 14, background: S.surface }}
                value={form.procedencia} onChange={e => setForm({...form, procedencia: e.target.value, otraProcedencia: ''})}>
                <option value="">— Seleccioná —</option>
                {procedencias.map(p => <option key={p} value={p}>{p}</option>)}
                <option value="Otro">+ Nueva procedencia...</option>
              </select>
              {form.procedencia === 'Otro' && (
                <input type="text" placeholder="Ej: Remate Gral. Villegas" value={form.otraProcedencia}
                  onChange={e => setForm({...form, otraProcedencia: e.target.value})}
                  style={{ marginTop: 8, width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 14, background: S.surface, boxSizing: 'border-box' }} />
              )}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Categoría</label>
              <select style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 14, background: S.surface }}
                value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})}>
                {['Novillos 2-3 anos','Novillos 3-4 anos','Novillitos','Terneros','Vaquillonas','Vacas','Toros'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Cantidad</label>
              <input type="number" value={form.cantidad} onChange={e => setForm({...form, cantidad: e.target.value})}
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 14, background: S.surface, boxSizing: 'border-box', fontFamily: 'monospace' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Kg báscula</label>
              <input type="number" value={form.kg_bascula} onChange={e => setForm({...form, kg_bascula: e.target.value})}
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 14, background: S.surface, boxSizing: 'border-box', fontFamily: 'monospace' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Kg factura</label>
              <input type="number" value={form.kg_factura} onChange={e => setForm({...form, kg_factura: e.target.value})}
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 14, background: S.surface, boxSizing: 'border-box', fontFamily: 'monospace' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Precio $/kg neto</label>
              <input type="number" value={form.precio_compra} onChange={e => setForm({...form, precio_compra: e.target.value})}
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 14, background: S.surface, boxSizing: 'border-box', fontFamily: 'monospace' }} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Observaciones</label>
              <input type="text" value={form.observaciones} onChange={e => setForm({...form, observaciones: e.target.value})}
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 14, background: S.surface, boxSizing: 'border-box' }} />
            </div>
          </div>
          {totalCompra && (
            <div style={{ background: S.greenLight, border: '1px solid #97C459', borderRadius: 8, padding: '1rem', marginBottom: '1rem', fontSize: 13, color: S.green }}>
              Total compra: <strong>${totalCompra.toLocaleString('es-AR')}</strong> · Peso promedio: <strong>{promEst} kg</strong>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={guardarEdicion} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar cambios'}</Btn>
            <Btn ghost onClick={() => { setVista('lista'); setEditandoLote(null) }}>Cancelar</Btn>
          </div>
        </Card>
      </div>
    )
  }

  if (vista === 'nuevo') {
    const promEst = form.cantidad && form.kg_bascula ? Math.round(parseFloat(form.kg_bascula) / parseInt(form.cantidad)) : null
    const kgBas = parseFloat(form.kg_bascula) || 0
    const kgFac = parseFloat(form.kg_factura) || 0
    const diffKg = kgBas && kgFac ? kgBas - kgFac : null
    const diffPct = diffKg !== null && kgFac > 0 ? (diffKg / kgFac * 100) : null
    const alertaDiff = diffPct !== null && Math.abs(diffPct) > 3
    const totalCompra = kgBas && form.precio_compra ? Math.round(kgBas * parseFloat(form.precio_compra)) : null

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>
          <Btn ghost sm onClick={() => setVista('lista')}>Volver</Btn>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600 }}>Nuevo ingreso</h1>
            <div style={{ fontSize: 12, color: S.muted }}>Llegada de lote al campo</div>
          </div>
        </div>

        <Card titulo="Datos del lote">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Procedencia</label>
              <select style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 14, background: S.surface }}
                value={form.procedencia} onChange={e => setForm({...form, procedencia: e.target.value, otraProcedencia: ''})}>
                <option value="">— Seleccioná o agregá nueva —</option>
                {procedencias.map(p => <option key={p} value={p}>{p}</option>)}
                <option value="Otro">+ Nueva procedencia...</option>
              </select>
              {form.procedencia === 'Otro' && (
                <input type="text" placeholder="Ej: Remate Gral. Villegas" value={form.otraProcedencia}
                  onChange={e => setForm({...form, otraProcedencia: e.target.value})}
                  style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.accent}`, borderRadius: 6, fontSize: 14, boxSizing: 'border-box', marginTop: 6 }} />
              )}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Categoria</label>
              <select style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 14, background: S.surface }}
                value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})}>
                {['Novillos 2-3 anos','Novillos 3-4 anos','Vaquillonas','Terneros'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Cantidad de animales</label>
              <input type="number" placeholder="ej. 85" value={form.cantidad} onChange={e => setForm({...form, cantidad: e.target.value})}
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
          </div>
        </Card>

        <Card titulo="Pesaje y precio">
          <div style={{ background: S.accentLight, border: `1px solid #85B7EB`, borderRadius: 8, padding: '10px 12px', marginBottom: '1rem', fontSize: 12, color: S.accent }}>
            Compará los kg de tu báscula con los que dice la factura del vendedor. El precio es opcional — podés cargarlo después.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Kg báscula (tu medición)</label>
              <input type="number" placeholder="ej. 20380" value={form.kg_bascula}
                onChange={e => setForm({...form, kg_bascula: e.target.value})}
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 14, boxSizing: 'border-box', fontFamily: 'monospace', fontWeight: 600 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Kg factura (vendedor)</label>
              <input type="number" placeholder="ej. 20500" value={form.kg_factura}
                onChange={e => setForm({...form, kg_factura: e.target.value})}
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 14, boxSizing: 'border-box', fontFamily: 'monospace' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Precio $/kg (opcional)</label>
              <input type="number" placeholder="ej. 2800" value={form.precio_compra}
                onChange={e => setForm({...form, precio_compra: e.target.value})}
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 14, boxSizing: 'border-box', fontFamily: 'monospace' }} />
            </div>
          </div>

          {(diffKg !== null || totalCompra || promEst) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {diffKg !== null && (
                <div style={{ background: alertaDiff ? S.amberLight : (diffKg >= 0 ? S.greenLight : S.redLight), border: `1px solid ${alertaDiff ? '#EF9F27' : (diffKg >= 0 ? '#97C459' : '#F09595')}`, borderRadius: 8, padding: '.75rem 1rem' }}>
                  <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>Diferencia báscula vs factura</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: alertaDiff ? S.amber : (diffKg >= 0 ? S.green : S.red) }}>
                    {diffKg >= 0 ? '+' : ''}{diffKg.toLocaleString('es-AR')} kg
                  </div>
                  <div style={{ fontSize: 12, fontFamily: 'monospace', color: alertaDiff ? S.amber : S.muted, marginTop: 2, fontWeight: alertaDiff ? 600 : 400 }}>
                    {diffPct !== null ? `${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(1)}%` : ''}
                    {alertaDiff ? ' ⚠ Supera el 3%' : (diffKg >= 0 ? ' · a tu favor' : ' · a favor del vendedor')}
                  </div>
                </div>
              )}
              {totalCompra && (
                <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '.75rem 1rem' }}>
                  <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>Total de la compra</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace' }}>${totalCompra.toLocaleString('es-AR')}</div>
                  <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>{kgBas.toLocaleString('es-AR')} kg × ${parseFloat(form.precio_compra).toLocaleString('es-AR')}/kg</div>
                </div>
              )}
              {promEst && (
                <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '.75rem 1rem' }}>
                  <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>Peso prom. báscula</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace' }}>{promEst} kg/anim.</div>
                  {promEst < 180 && <div style={{ fontSize: 11, color: S.amber, marginTop: 2 }}>⚠ Alerta 2da dosis</div>}
                </div>
              )}
            </div>
          )}
        </Card>

        <Card titulo="Asignacion de corral">
          <div style={{ background: S.accentLight, border: `1px solid #85B7EB`, borderRadius: 8, padding: '10px 12px', marginBottom: '1rem', fontSize: 12, color: S.accent }}>
            Podés asignar un corral libre o uno de cuarentena existente si los animales entran con pocos días de diferencia.
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Corral de cuarentena</label>
            <select style={{ width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 14, background: S.surface }}
              value={form.corral_cuarentena_id} onChange={e => setForm({...form, corral_cuarentena_id: e.target.value})}>
              <option value="">Sin asignar por ahora</option>
              {corrales.map(c => (
                <option key={c.id} value={c.id}>
                  Corral {c.numero} · {c.rol === 'cuarentena' ? 'en cuarentena' : 'libre'} · {c.animales || 0} anim. · cap. {c.capacidad}
                </option>
              ))}
            </select>
          </div>
        </Card>

        <Card titulo="Observaciones">
          <textarea placeholder="condicion corporal, sanidad previa, etc." value={form.observaciones}
            onChange={e => setForm({...form, observaciones: e.target.value})}
            style={{ width: '100%', padding: '10px 12px', border: `1px solid ${S.border}`, borderRadius: 8, fontSize: 13, minHeight: 80, resize: 'vertical', boxSizing: 'border-box' }} />
        </Card>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn ghost onClick={() => setVista('lista')}>Cancelar</Btn>
          <Btn onClick={guardarIngreso} disabled={guardando}>{guardando ? 'Guardando...' : 'Registrar ingreso'}</Btn>
        </div>
      </div>
    )
  }

  // Métricas
  const anio = new Date().getFullYear()
  const mes = new Date().getMonth()
  const lotesAnio = lotes.filter(l => new Date(l.created_at).getFullYear() === anio)
  const lotesMes = lotes.filter(l => { const d = new Date(l.created_at); return d.getFullYear() === anio && d.getMonth() === mes })
  const totalAnimAnio = lotesAnio.reduce((s, l) => s + (l.cantidad || 0), 0)
  const totalAnimMes = lotesMes.reduce((s, l) => s + (l.cantidad || 0), 0)
  const lotesConPrecio = lotes.filter(l => l.precio_compra)
  const precioPromedio = lotesConPrecio.length > 0 ? Math.round(lotesConPrecio.reduce((s, l) => s + l.precio_compra, 0) / lotesConPrecio.length) : null
  const lotesConKg = lotes.filter(l => l.kg_bascula && l.cantidad)
  const kgPromedio = lotesConKg.length > 0 ? Math.round(lotesConKg.reduce((s, l) => s + (l.kg_bascula / l.cantidad), 0) / lotesConKg.length) : null
  const totalGastadoAnio = lotesAnio.filter(l => l.precio_compra && l.kg_bascula).reduce((s, l) => s + Math.round(l.kg_bascula * (1 - (l.desbaste_pct || 0) / 100) * l.precio_compra), 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Ingresos</h1>
          <div style={{ fontSize: 12, color: S.muted }}>Registro de compras · feedlot</div>
        </div>
        <Btn onClick={() => setVista('nuevo')}>+ Nuevo ingreso</Btn>
      </div>

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
        {[
          { label: `Comprados ${anio}`, val: totalAnimAnio.toLocaleString('es-AR'), sub: 'animales' },
          { label: 'Comprados este mes', val: totalAnimMes.toLocaleString('es-AR'), sub: 'animales', color: S.accent },
          { label: 'Precio promedio', val: precioPromedio ? `$${precioPromedio.toLocaleString('es-AR')}` : '—', sub: '$/kg neto', color: S.green },
          { label: 'Kg promedio', val: kgPromedio ? `${kgPromedio} kg` : '—', sub: 'por animal' },
          { label: `Gastado ${anio}`, val: totalGastadoAnio > 0 ? `$${(totalGastadoAnio/1000000).toFixed(1)}M` : '—', sub: 'en compras', color: S.red },
        ].map((m, i) => (
          <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem' }}>
            <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5, fontWeight: 600 }}>{m.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: m.color || S.text }}>{m.val}</div>
            <div style={{ fontSize: 11, color: S.hint, marginTop: 3 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${S.border}`, marginBottom: '1.25rem' }}>
        {[
          { key: 'lista', label: 'Ingresos' },
          { key: 'gestion', label: 'Gestión comercial' },
          { key: 'cuentas', label: 'Cuentas por proveedor' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '10px 20px', fontSize: 13, fontWeight: tab === t.key ? 600 : 500, cursor: 'pointer', color: tab === t.key ? S.accent : S.muted, background: 'transparent', border: 'none', borderBottom: tab === t.key ? `2px solid ${S.accent}` : '2px solid transparent', marginBottom: -1, fontFamily: "'IBM Plex Sans', sans-serif" }}>
            {t.label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          <Btn onClick={() => setVista('nuevo')}>+ Nuevo ingreso</Btn>
        </div>
      </div>

      {tab === 'lista' && (<>

      {/* Pendientes de precio */}
      {lotesSinPrecio.length > 0 && (
        <div style={{ background: S.amberLight, border: '1px solid #EF9F27', borderRadius: 10, padding: '1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: S.amber, marginBottom: '.85rem' }}>
            ⚠ {lotesSinPrecio.length} ingreso{lotesSinPrecio.length !== 1 ? 's' : ''} sin precio de compra
          </div>
          {lotesSinPrecio.map(l => {
            const isEdit = editandoPrecio?.id === l.id
            const kgFacEdit = parseFloat(editandoPrecio?.kg_factura) || 0
            const kgFacBase = parseFloat(l.kg_factura) || 0
            const diffKg = isEdit && kgFacEdit && l.kg_bascula
              ? l.kg_bascula - kgFacEdit
              : kgFacBase ? l.kg_bascula - kgFacBase : null
            const kgFacUsada = isEdit ? kgFacEdit : kgFacBase
            const diffPct = diffKg !== null && kgFacUsada > 0 ? (diffKg / kgFacUsada * 100) : null
            const alertaDiff = diffPct !== null && Math.abs(diffPct) > 3
            return (
              <div key={l.id} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem', marginBottom: '.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: isEdit ? 12 : 0 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{l.codigo} · {l.procedencia || <span style={{ color: S.amber }}>sin procedencia</span>}</div>
                    <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>
                      {l.cantidad} animales · {l.kg_bascula?.toLocaleString('es-AR')} kg báscula · {new Date(l.fecha_ingreso).toLocaleDateString('es-AR')}
                    </div>
                  </div>
                  {!isEdit && (
                    <button onClick={() => setEditandoPrecio({ id: l.id, precio_compra: '', kg_factura: l.kg_factura ? String(l.kg_factura) : '', procedencia: l.procedencia || '', otraProcedencia: '' })}
                      style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif", flexShrink: 0, marginLeft: 12 }}>
                      Completar datos
                    </button>
                  )}
                </div>
                {isEdit && (
                  <div>
                    {!l.procedencia && (
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Procedencia</label>
                        <select value={editandoPrecio.procedencia || ''}
                          onChange={e => setEditandoPrecio({ ...editandoPrecio, procedencia: e.target.value, otraProcedencia: '' })}
                          style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.surface }}>
                          <option value="">— Sin procedencia —</option>
                          {procedencias.map(p => <option key={p} value={p}>{p}</option>)}
                          <option value="Otro">+ Nueva...</option>
                        </select>
                        {editandoPrecio.procedencia === 'Otro' && (
                          <input type="text" placeholder="Escribí la procedencia" value={editandoPrecio.otraProcedencia || ''}
                            onChange={e => setEditandoPrecio({ ...editandoPrecio, otraProcedencia: e.target.value })}
                            style={{ width: '100%', border: `1px solid ${S.accent}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, background: S.surface, boxSizing: 'border-box', marginTop: 6 }} />
                        )}
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Precio $/kg *</label>
                        <input type="number" placeholder="ej. 2800" value={editandoPrecio.precio_compra}
                          onChange={e => setEditandoPrecio({ ...editandoPrecio, precio_compra: e.target.value })}
                          style={{ width: '100%', border: `1px solid ${S.accent}`, borderRadius: 6, padding: '8px 10px', fontSize: 14, background: S.surface, boxSizing: 'border-box', fontWeight: 600, fontFamily: 'monospace' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Kg factura</label>
                        <input type="number" placeholder="ej. 20500" value={editandoPrecio.kg_factura}
                          onChange={e => setEditandoPrecio({ ...editandoPrecio, kg_factura: e.target.value })}
                          style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 14, background: S.surface, boxSizing: 'border-box', fontFamily: 'monospace' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Diferencia</label>
                        <div style={{ padding: '8px 10px', border: `1px solid ${alertaDiff ? '#EF9F27' : S.border}`, borderRadius: 6, fontSize: 13, background: alertaDiff ? S.amberLight : S.bg, fontFamily: 'monospace', color: diffKg !== null ? (alertaDiff ? S.amber : diffKg >= 0 ? S.green : S.red) : S.hint, fontWeight: alertaDiff ? 600 : 400 }}>
                          {diffKg !== null ? `${diffKg >= 0 ? '+' : ''}${diffKg.toLocaleString('es-AR')} kg` : '—'}
                          {diffPct !== null && <span style={{ fontSize: 11, marginLeft: 4 }}>({diffPct >= 0 ? '+' : ''}{diffPct.toFixed(1)}%{alertaDiff ? ' ⚠' : ''})</span>}
                        </div>
                      </div>
                    </div>
                    {editandoPrecio.precio_compra && (
                      <div style={{ background: S.greenLight, border: '1px solid #97C459', borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: 13, color: S.green }}>
                        Total: <strong>${(l.kg_bascula * parseFloat(editandoPrecio.precio_compra)).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</strong>
                        {' '}({l.kg_bascula?.toLocaleString('es-AR')} kg × ${parseFloat(editandoPrecio.precio_compra).toLocaleString('es-AR')}/kg)
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => guardarPrecio(l)}
                        style={{ flex: 1, padding: '8px', fontSize: 13, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                        Guardar precio
                      </button>
                      <button onClick={() => setEditandoPrecio(null)}
                        style={{ padding: '8px 14px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Card titulo={`Historial · ${lotes.length} lotes`}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Fecha','Lote','Anim.','Procedencia','Kg báscula','Kg factura','Dif.','Peso prom.','Corral','Precio','Total',''].map(h => (
                  <th key={h} style={{ background: S.bg, padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 11, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lotes.map(l => {
                const diff = l.kg_bascula && l.kg_factura ? l.kg_bascula - l.kg_factura : null
                const total = l.kg_bascula && l.precio_compra ? Math.round(l.kg_bascula * l.precio_compra) : null
                return (
                  <tr key={l.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(l.fecha_ingreso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{l.codigo}</td>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{l.cantidad}</td>
                    <td style={{ padding: '9px 12px' }}>{l.procedencia}</td>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{l.kg_bascula?.toLocaleString('es-AR')} kg</td>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: S.muted }}>{l.kg_factura ? `${l.kg_factura.toLocaleString('es-AR')} kg` : '—'}</td>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600, color: diff !== null ? (diff >= 0 ? S.green : S.red) : S.hint }}>
                      {diff !== null ? `${diff >= 0 ? '+' : ''}${diff.toLocaleString('es-AR')}` : '—'}
                    </td>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{l.peso_prom_ingreso ? `${l.peso_prom_ingreso} kg` : '-'}</td>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{l.corrales?.numero ? `C-${l.corrales.numero}` : '-'}</td>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>
                      {l.precio_compra ? `$${l.precio_compra.toLocaleString('es-AR')}/kg` : <span style={{ color: S.amber, fontSize: 11, fontWeight: 600 }}>Pendiente</span>}
                    </td>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600, color: total ? S.green : S.hint }}>
                      {total ? `$${(total / 1000000).toFixed(1)}M` : '—'}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => editarLote(l)} style={{ background: S.accentLight, border: `1px solid ${S.accent}`, borderRadius: 6, color: S.accent, fontSize: 11, padding: '3px 8px', cursor: 'pointer' }}>
                          Editar
                        </button>
                        <button onClick={() => eliminarLote(l.id)} style={{ background: S.redLight, border: `1px solid #F09595`, borderRadius: 6, color: S.red, fontSize: 11, padding: '3px 8px', cursor: 'pointer' }}>
                          Borrar
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {lotes.length === 0 && (
                <tr><td colSpan={12} style={{ padding: '2rem', textAlign: 'center', color: S.hint, fontSize: 13 }}>No hay ingresos registrados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      </>)}

      {tab === 'gestion' && (
        <div>
          {/* Alertas vencimiento */}
          {(() => {
            const hoy = new Date()
            const en7dias = new Date(Date.now() + 7 * 86400000)
            const vencProximos = Object.entries(vencimientosLote).flatMap(([loteId, venc]) => 
              venc.filter(v => v.estado !== 'pagado' && new Date(v.fecha_vencimiento) <= en7dias)
                  .map(v => ({ ...v, lote: lotes.find(l => l.id === parseInt(loteId)) }))
            ).filter(v => v.lote)
            if (vencProximos.length === 0) return null
            return (
              <div style={{ background: S.redLight, border: '1px solid #F09595', borderRadius: 8, padding: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: S.red, marginBottom: 6 }}>⚠ Pagos por vencer — próximos 7 días</div>
                {vencProximos.map(v => (
                  <div key={v.id} style={{ fontSize: 12, color: S.red, marginBottom: 2 }}>
                    {v.lote.codigo} · {v.lote.procedencia || 'Sin procedencia'} · ${v.monto.toLocaleString('es-AR')} · vence {new Date(v.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR')}
                  </div>
                ))}
              </div>
            )
          })()}

          <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 900 }}>
              <thead><tr style={{ background: S.bg }}>
                {['Fecha','Lote','Proveedor','Total compra','Factura','Forma pago','Vencimiento','Estado','Pagado','Acciones'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 10, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {lotes.length === 0 && <tr><td colSpan={10} style={{ padding: '2rem', textAlign: 'center', color: S.hint }}>No hay ingresos registrados.</td></tr>}
                {lotes.map(l => {
                  const total = l.precio_compra && l.kg_bascula ? Math.round(l.kg_bascula * (1 - (l.desbaste_pct || 0) / 100) * l.precio_compra) : null
                  const pagosList = pagosCompras[l.id] || []
                  const totalPagado = pagosList.reduce((s, p) => s + (p.monto || 0), 0)
                  const saldo = total ? total - totalPagado : null
                  const venceProx = l.fecha_vencimiento_pago && l.estado_pago !== 'pagado' && new Date(l.fecha_vencimiento_pago) <= new Date(Date.now() + 7 * 86400000)
                  const isEdit = editandoFactura === l.id
                  const isReg = registrandoPagoCompra === l.id
                  const estadoColor = { pendiente: { bg: S.amberLight, color: S.amber }, pagado: { bg: S.greenLight, color: S.green }, vencido: { bg: S.redLight, color: S.red } }[l.estado_pago || 'pendiente'] || { bg: S.bg, color: S.muted }
                  return (
                    <React.Fragment key={l.id}>
                    <tr style={{ borderBottom: `1px solid ${S.border}`, background: venceProx ? '#FFF5F5' : 'transparent' }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11 }}>{new Date(l.fecha_ingreso + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{l.codigo}</td>
                      <td style={{ padding: '8px 12px' }}>{l.procedencia || '—'}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600, color: S.red }}>{total ? `-$${(total/1000000).toFixed(2)}M` : '—'}</td>
                      <td style={{ padding: '8px 12px', fontSize: 11, color: S.muted }}>
                        {l.numero_factura || '—'}
                        {l.monto_negro > 0 && <div style={{ fontSize: 10, color: '#3D1A6B', fontWeight: 600 }}>Negro: ${l.monto_negro.toLocaleString('es-AR')}</div>}
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: 11 }}>{l.forma_pago || '—'}{l.plazo_dias ? ` ${l.plazo_dias}d` : ''}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11 }}>
                        {(() => {
                          const venc = vencimientosLote[l.id] || []
                          if (venc.length === 0) return l.fecha_vencimiento_pago ? new Date(l.fecha_vencimiento_pago + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '—'
                          return venc.map(v => (
                            <div key={v.id} style={{ color: v.estado === 'pagado' ? S.green : new Date(v.fecha_vencimiento) < new Date() ? S.red : S.text, marginBottom: 2 }}>
                              {new Date(v.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} · ${v.monto.toLocaleString('es-AR')}
                            </div>
                          ))
                        })()}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: estadoColor.bg, color: estadoColor.color }}>
                          {l.estado_pago || 'pendiente'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: totalPagado > 0 ? S.green : S.hint }}>
                        {totalPagado > 0 ? `$${totalPagado.toLocaleString('es-AR')}` : '—'}
                        {saldo !== null && saldo > 0 && <div style={{ fontSize: 10, color: S.red }}>Saldo: ${saldo.toLocaleString('es-AR')}</div>}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => { setEditandoFactura(isEdit ? null : l.id); setFormFactura({ numero_factura: l.numero_factura || '', fecha_factura: l.fecha_factura || '', forma_pago: l.forma_pago || 'contado', plazo_dias: l.plazo_dias || '', fecha_vencimiento_pago: l.fecha_vencimiento_pago || '', observaciones_pago: l.observaciones_pago || '', monto_facturado: l.monto_facturado !== null && l.monto_facturado !== undefined ? String(l.monto_facturado) : '', monto_negro: l.monto_negro !== null && l.monto_negro !== undefined ? String(l.monto_negro) : '' }) }}
                            style={{ padding: '3px 8px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 4, cursor: 'pointer' }}>
                            {isEdit ? 'Cerrar' : 'Factura'}
                          </button>
                          <button onClick={() => { setRegistrandoPagoCompra(isReg ? null : l.id); setFormPagoCompra({ monto: saldo && saldo > 0 ? String(Math.round(saldo)) : '', forma_pago: 'transferencia', fecha: new Date().toISOString().split('T')[0], numero_cheque: '', banco: '', fecha_vencimiento_cheque: '' }) }}
                            style={{ padding: '3px 8px', fontSize: 11, background: S.greenLight, border: `1px solid ${S.green}`, color: S.green, borderRadius: 4, cursor: 'pointer' }}>
                            + Pago
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isEdit && (
                      <tr style={{ background: S.accentLight }}>
                        <td colSpan={10} style={{ padding: '1rem' }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: S.accent, textTransform: 'uppercase', marginBottom: '1rem' }}>Datos comerciales de la compra</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                            <div>
                              <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>N° Factura</div>
                              <input type="text" value={formFactura.numero_factura} onChange={e => setFormFactura({...formFactura, numero_factura: e.target.value})}
                                style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 5, padding: '7px 10px', fontSize: 13, background: S.surface, boxSizing: 'border-box' }} />
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Fecha factura</div>
                              <input type="date" value={formFactura.fecha_factura} onChange={e => setFormFactura({...formFactura, fecha_factura: e.target.value})}
                                style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 5, padding: '7px 10px', fontSize: 13, background: S.surface, boxSizing: 'border-box' }} />
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Observaciones</div>
                              <input type="text" value={formFactura.observaciones_pago} onChange={e => setFormFactura({...formFactura, observaciones_pago: e.target.value})}
                                style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 5, padding: '7px 10px', fontSize: 13, background: S.surface, boxSizing: 'border-box' }} />
                            </div>
                          </div>

                          {/* Vencimientos múltiples */}
                          <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 8 }}>Vencimientos de pago</div>
                          {(vencimientosLote[l.id] || []).map(v => (
                            <div key={v.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, fontSize: 12 }}>
                              <span style={{ fontFamily: 'monospace', color: S.accent }}>{new Date(v.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR')}</span>
                              <span style={{ fontFamily: 'monospace', fontWeight: 600, color: S.red }}>-${v.monto.toLocaleString('es-AR')}</span>
                              <span style={{ fontSize: 11, color: v.estado === 'pagado' ? S.green : S.amber }}>{v.estado}</span>
                              <button onClick={async () => { await supabase.from('vencimientos_compra').delete().eq('id', v.id); await cargarDatos() }}
                                style={{ background: 'none', border: 'none', color: S.red, cursor: 'pointer', fontSize: 11 }}>✕</button>
                            </div>
                          ))}
                          {formVencimientos.map((fv, idx) => (
                            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 6 }}>
                              <div>
                                <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 2 }}>Fecha vencimiento</div>
                                <input type="date" value={fv.fecha} onChange={e => { const nv = [...formVencimientos]; nv[idx].fecha = e.target.value; setFormVencimientos(nv) }}
                                  style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 5, padding: '6px 10px', fontSize: 12, background: S.surface, boxSizing: 'border-box' }} />
                              </div>
                              <div>
                                <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 2 }}>Monto $</div>
                                <input type="number" value={fv.monto} onChange={e => { const nv = [...formVencimientos]; nv[idx].monto = e.target.value; setFormVencimientos(nv) }}
                                  style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 5, padding: '6px 10px', fontSize: 12, background: S.surface, boxSizing: 'border-box', fontFamily: 'monospace' }} />
                              </div>
                              <button onClick={() => setFormVencimientos(formVencimientos.filter((_, i) => i !== idx))}
                                style={{ alignSelf: 'flex-end', padding: '6px 10px', background: S.redLight, border: `1px solid #F09595`, color: S.red, borderRadius: 5, cursor: 'pointer', fontSize: 12 }}>✕</button>
                            </div>
                          ))}
                          <button onClick={() => setFormVencimientos([...formVencimientos, { fecha: '', monto: '' }])}
                            style={{ padding: '6px 12px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer', marginBottom: '1rem' }}>
                            + Agregar vencimiento
                          </button>

                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={async () => {
                              const montoFact = formFactura.monto_facturado !== '' && formFactura.monto_facturado !== null ? parseFloat(formFactura.monto_facturado) : null
                              const montoNegro = formFactura.monto_negro !== '' && formFactura.monto_negro !== null ? parseFloat(formFactura.monto_negro) : 0
                              await supabase.from('lotes').update({ 
                                numero_factura: formFactura.numero_factura || null, 
                                fecha_factura: formFactura.fecha_factura || null,
                                forma_pago: formFactura.forma_pago || null,
                                observaciones_pago: formFactura.observaciones_pago || null, 
                                monto_facturado: montoFact, 
                                monto_negro: montoNegro 
                              }).eq('id', l.id)
                              for (const fv of formVencimientos) {
                                if (fv.fecha && fv.monto) {
                                  await supabase.from('vencimientos_compra').insert({ lote_id: l.id, fecha_vencimiento: fv.fecha, monto: parseFloat(fv.monto), estado: 'pendiente' })
                                }
                              }
                              setFormVencimientos([])
                              setEditandoFactura(null)
                              await cargarDatos()
                            }} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                              Guardar
                            </button>
                            <button onClick={() => { setEditandoFactura(null); setFormVencimientos([]) }} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                          </div>
                        </td>
                      </tr>
                    )}
                    {isReg && (
                      <tr style={{ background: S.greenLight }}>
                        <td colSpan={10} style={{ padding: '1rem' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '.75rem' }}>
                            <div>
                              <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Monto $</div>
                              <input type="number" value={formPagoCompra.monto} onChange={e => setFormPagoCompra({...formPagoCompra, monto: e.target.value})}
                                style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 5, padding: '7px 10px', fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: 'monospace' }} />
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Forma</div>
                              <select value={formPagoCompra.forma_pago} onChange={e => setFormPagoCompra({...formPagoCompra, forma_pago: e.target.value})}
                                style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 5, padding: '7px 10px', fontSize: 13, background: S.surface }}>
                                <option value="transferencia">Transferencia</option>
                                <option value="cheque">Cheque</option>
                                <option value="e-cheq">E-Cheq</option>
                                <option value="efectivo">Efectivo</option>
                              </select>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Fecha</div>
                              <input type="date" value={formPagoCompra.fecha} onChange={e => setFormPagoCompra({...formPagoCompra, fecha: e.target.value})}
                                style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 5, padding: '7px 10px', fontSize: 13, background: S.surface, boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#3D1A6B', fontWeight: 600, cursor: 'pointer', padding: '7px 0' }}>
                                <input type="checkbox" checked={formPagoCompra.es_negro || false} onChange={e => setFormPagoCompra({...formPagoCompra, es_negro: e.target.checked})} />
                                Pago en negro
                              </label>
                            </div>
                            {['cheque','e-cheq'].includes(formPagoCompra.forma_pago) && (<>
                              <div>
                                <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>N° cheque</div>
                                <input type="text" value={formPagoCompra.numero_cheque} onChange={e => setFormPagoCompra({...formPagoCompra, numero_cheque: e.target.value})}
                                  style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 5, padding: '7px 10px', fontSize: 13, background: S.surface, boxSizing: 'border-box' }} />
                              </div>
                              <div>
                                <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Banco</div>
                                <input type="text" value={formPagoCompra.banco} onChange={e => setFormPagoCompra({...formPagoCompra, banco: e.target.value})}
                                  style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 5, padding: '7px 10px', fontSize: 13, background: S.surface, boxSizing: 'border-box' }} />
                              </div>
                              <div>
                                <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 3 }}>Vencimiento cheque</div>
                                <input type="date" value={formPagoCompra.fecha_vencimiento_cheque} onChange={e => setFormPagoCompra({...formPagoCompra, fecha_vencimiento_cheque: e.target.value})}
                                  style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 5, padding: '7px 10px', fontSize: 13, background: S.surface, boxSizing: 'border-box' }} />
                              </div>
                            </>)}
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={async () => {
                              if (!formPagoCompra.monto) return
                              const monto = parseFloat(formPagoCompra.monto)
                              const { data: pagoCompraInsert } = await supabase.from('pagos_compras').insert({ lote_id: l.id, fecha: formPagoCompra.fecha, monto, forma_pago: formPagoCompra.forma_pago, numero_cheque: formPagoCompra.numero_cheque || null, banco: formPagoCompra.banco || null, fecha_vencimiento_cheque: formPagoCompra.fecha_vencimiento_cheque || null }).select().single()
                              const esNegro = formPagoCompra.es_negro || false
                              if (esNegro) {
                                await supabase.from('caja_paralela').insert({ fecha: formPagoCompra.fecha, tipo: 'egreso', descripcion: `Compra hacienda ${l.codigo} · ${l.procedencia || ''}`, monto, pago_compra_id: pagoCompraInsert?.id || null })
                              } else {
                                await supabase.from('caja_oficial').insert({ fecha: formPagoCompra.fecha, tipo: 'egreso', categoria: 'Pago compra hacienda', descripcion: `Compra ${l.codigo} · ${l.procedencia || ''}`, monto, forma_pago: formPagoCompra.forma_pago, pago_compra_id: pagoCompraInsert?.id || null })
                              }
                              if (['cheque','e-cheq'].includes(formPagoCompra.forma_pago) && formPagoCompra.fecha_vencimiento_cheque) {
                                await supabase.from('cheques').insert({ tipo: 'emitido', numero: formPagoCompra.numero_cheque || null, banco: formPagoCompra.banco || null, monto, fecha_emision: formPagoCompra.fecha, fecha_vencimiento: formPagoCompra.fecha_vencimiento_cheque, beneficiario: l.procedencia || null, estado: 'emitido' })
                              }
                              // Verificar si quedó totalmente pagado
                              const { data: todosPageos } = await supabase.from('pagos_compras').select('monto').eq('lote_id', l.id)
                              const totalPag = (todosPageos || []).reduce((s, p) => s + (p.monto || 0), 0) + monto
                              const totalLote = l.precio_compra && l.kg_bascula ? Math.round(l.kg_bascula * (1 - (l.desbaste_pct || 0) / 100) * l.precio_compra) : null
                              if (totalLote && totalPag >= totalLote * 0.99) await supabase.from('lotes').update({ estado_pago: 'pagado', fecha_pago: formPagoCompra.fecha }).eq('id', l.id)
                              setRegistrandoPagoCompra(null)
                              await cargarDatos()
                            }} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: `1px solid ${S.green}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                              Guardar pago
                            </button>
                            <button onClick={() => setRegistrandoPagoCompra(null)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                          </div>
                          {pagosList.length > 0 && (
                            <div style={{ marginTop: '1rem', borderTop: `1px solid ${S.border}`, paddingTop: '.75rem' }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, marginBottom: 6 }}>PAGOS REGISTRADOS</div>
                              {pagosList.map(p => (
                                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                                  <span>{new Date(p.fecha + 'T12:00:00').toLocaleDateString('es-AR')} · {p.forma_pago}{p.numero_cheque ? ` #${p.numero_cheque}` : ''}</span>
                                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <span style={{ fontFamily: 'monospace', color: S.red }}>-${p.monto.toLocaleString('es-AR')}</span>
                                    <button onClick={async () => { await supabase.from('pagos_compras').delete().eq('id', p.id); await cargarDatos() }}
                                      style={{ background: 'none', border: 'none', color: S.red, cursor: 'pointer', fontSize: 11 }}>✕</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'cuentas' && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Cuentas por proveedor</div>
          <div style={{ fontSize: 12, color: S.muted, marginBottom: '1.25rem' }}>Resumen de compras y pagos por procedencia</div>

          {(() => {
            const porProveedor = {}
            lotes.forEach(l => {
              const prov = l.procedencia || 'Sin procedencia'
              if (!porProveedor[prov]) porProveedor[prov] = { lotes: [], totalComprado: 0, totalPagado: 0, totalAnimales: 0 }
              porProveedor[prov].lotes.push(l)
              const total = l.precio_compra && l.kg_bascula ? Math.round(l.kg_bascula * (1 - (l.desbaste_pct || 0) / 100) * l.precio_compra) : 0
              porProveedor[prov].totalComprado += total
              porProveedor[prov].totalAnimales += l.cantidad || 0
              const pagosList = pagosCompras[l.id] || []
              porProveedor[prov].totalPagado += pagosList.reduce((s, p) => s + (p.monto || 0), 0)
            })

            return Object.entries(porProveedor).sort((a, b) => b[1].totalComprado - a[1].totalComprado).map(([prov, data]) => {
              const saldo = data.totalComprado - data.totalPagado
              const pctPagado = data.totalComprado > 0 ? Math.round(data.totalPagado / data.totalComprado * 100) : 0
              return (
                <div key={prov} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, marginBottom: '1rem', overflow: 'hidden' }}>
                  <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{prov}</div>
                      <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>{data.lotes.length} compras · {data.totalAnimales.toLocaleString('es-AR')} animales</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: S.muted, marginBottom: 2 }}>Saldo pendiente</div>
                      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: saldo > 0 ? S.red : S.green }}>
                        {saldo > 0 ? `-$${saldo.toLocaleString('es-AR')}` : '✓ Pagado'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, borderBottom: `1px solid ${S.border}` }}>
                    {[
                      { label: 'Total comprado', val: `$${(data.totalComprado/1000000).toFixed(2)}M`, color: S.red },
                      { label: 'Total pagado', val: `$${(data.totalPagado/1000000).toFixed(2)}M · ${pctPagado}%`, color: pctPagado >= 100 ? S.green : S.amber },
                      { label: 'Saldo', val: saldo > 0 ? `-$${(saldo/1000000).toFixed(2)}M` : 'Sin deuda', color: saldo > 0 ? S.red : S.green },
                    ].map((m, i) => (
                      <div key={i} style={{ padding: '.85rem 1rem', borderRight: i < 2 ? `1px solid ${S.border}` : 'none' }}>
                        <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>{m.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace', color: m.color }}>{m.val}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ height: 6, background: S.bg }}>
                    <div style={{ width: `${Math.min(pctPagado, 100)}%`, height: '100%', background: pctPagado >= 100 ? S.green : S.amber }} />
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead><tr style={{ background: S.bg }}>
                      {['Fecha','Lote','Animales','Total','Factura','Vencimientos','Pagado'].map(h => (
                        <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, color: S.muted, fontSize: 10, textTransform: 'uppercase', borderBottom: `1px solid ${S.border}` }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {data.lotes.map(l => {
                        const total = l.precio_compra && l.kg_bascula ? Math.round(l.kg_bascula * (1 - (l.desbaste_pct || 0) / 100) * l.precio_compra) : null
                        const pagosList = pagosCompras[l.id] || []
                        const pagado = pagosList.reduce((s, p) => s + (p.monto || 0), 0)
                        const venc = vencimientosLote[l.id] || []
                        return (
                          <tr key={l.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                            <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontSize: 11 }}>{new Date(l.fecha_ingreso + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                            <td style={{ padding: '7px 12px', fontWeight: 600 }}>{l.codigo}</td>
                            <td style={{ padding: '7px 12px', fontFamily: 'monospace' }}>{l.cantidad}</td>
                            <td style={{ padding: '7px 12px', fontFamily: 'monospace', color: S.red }}>{total ? `-$${(total/1000000).toFixed(2)}M` : '—'}</td>
                            <td style={{ padding: '7px 12px', fontSize: 11, color: S.muted }}>{l.numero_factura || '—'}</td>
                            <td style={{ padding: '7px 12px', fontSize: 11 }}>
                              {venc.length === 0 ? '—' : venc.map(v => (
                                <div key={v.id} style={{ color: v.estado === 'pagado' ? S.green : new Date(v.fecha_vencimiento) < new Date() ? S.red : S.text }}>
                                  {new Date(v.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} · ${v.monto.toLocaleString('es-AR')}
                                </div>
                              ))}
                            </td>
                            <td style={{ padding: '7px 12px', fontFamily: 'monospace', color: pagado > 0 ? S.green : S.hint }}>
                              {pagado > 0 ? `$${pagado.toLocaleString('es-AR')}` : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })
          })()}
        </div>
      )}
    </div>
  )
} 
