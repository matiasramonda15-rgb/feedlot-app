import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { hoyLocal } from '../shared/dateUtils'
import { Loader } from './UI'

const S = {
  bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6',
  text: '#1A1916', muted: '#6B6760', hint: '#9E9A94',
  accent: '#1A3D6B', accentLight: '#E8EFF8',
  green: '#1E5C2E', greenLight: '#E8F4EB',
  amber: '#7A4500', amberLight: '#FDF0E0',
  red: '#7A1A1A', redLight: '#FDF0F0',
}

const inputStyle = { width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface, boxSizing: 'border-box', fontFamily: "'IBM Plex Sans', sans-serif", color: S.text }

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{children}</div>
}

function Card({ children, style = {} }) {
  return <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1.25rem', marginBottom: '1rem', ...style }}>{children}</div>
}

export default function Creditos({ usuario }) {
  const [loading, setLoading] = useState(true)
  const [activos, setActivos] = useState([])
  const [creditos, setCreditos] = useState([])
  const [pagosCreditos, setPagosCreditos] = useState({})
  const [showFormCredito, setShowFormCredito] = useState(false)
  const [formCredito, setFormCredito] = useState({ activo_id: '', descripcion: '', entidad: '', observaciones: '', es_dolares: false })
  const [cuotasForm, setCuotasForm] = useState([{ fecha: '', monto: '' }])
  const [guardandoCredito, setGuardandoCredito] = useState(false)
  const [creditoSelId, setCreditoSelId] = useState(null)
  const [formPagoCredito, setFormPagoCredito] = useState({ fecha: hoyLocal(), monto: '', nro_cuota: '', es_paralelo: false, observaciones: '' })
  const [guardandoPagoCredito, setGuardandoPagoCredito] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: a }, { data: cred }, { data: pc }] = await Promise.all([
      supabase.from('activos').select('id, nombre').order('nombre'),
      supabase.from('creditos').select('*, activos(nombre)').order('created_at', { ascending: false }),
      supabase.from('pagos_creditos').select('*').order('nro_cuota'),
    ])
    setActivos(a || [])
    setCreditos(cred || [])
    // Agrupar las cuotas por crédito, para poder mostrarlas dentro de cada tarjeta
    const porCredito = {}
    ;(pc || []).forEach(p => { if (!porCredito[p.credito_id]) porCredito[p.credito_id] = []; porCredito[p.credito_id].push(p) })
    setPagosCreditos(porCredito)
    setLoading(false)
  }

  async function guardarCredito() {
    const cuotasValidas = cuotasForm.filter(c => c.fecha && c.monto)
    if (cuotasValidas.length === 0) { alert('Agregá al menos una cuota con fecha y monto'); return }
    setGuardandoCredito(true)
    const montoTotalCargado = cuotasValidas.reduce((a, c) => a + parseFloat(c.monto), 0)
    const { data: cred, error } = await supabase.from('creditos').insert({
      activo_id: formCredito.activo_id ? parseInt(formCredito.activo_id) : null,
      descripcion: formCredito.descripcion || null,
      entidad: formCredito.entidad || null,
      es_dolares: formCredito.es_dolares,
      // Si es en dólares, el monto en pesos todavía no se sabe — se define
      // recién al pagar cada cuota, con la cotización de ese día. Mientras
      // tanto, monto_total/saldo_pendiente en pesos quedan en 0.
      monto_total: formCredito.es_dolares ? 0 : montoTotalCargado,
      monto_total_usd: formCredito.es_dolares ? montoTotalCargado : null,
      cant_cuotas: cuotasValidas.length,
      saldo_pendiente: formCredito.es_dolares ? 0 : montoTotalCargado,
      observaciones: formCredito.observaciones || null,
      registrado_por: usuario?.id,
    }).select().single()
    if (error) { alert('Error: ' + error.message); setGuardandoCredito(false); return }
    // Insertar cuotas en pagos_creditos como pendientes
    const { error: errCuotas } = await supabase.from('pagos_creditos').insert(
      cuotasValidas.map((c, i) => ({
        credito_id: cred.id,
        fecha: c.fecha,
        monto: formCredito.es_dolares ? null : parseFloat(c.monto),
        monto_usd: formCredito.es_dolares ? parseFloat(c.monto) : null,
        nro_cuota: i + 1,
        estado: 'pendiente',
      }))
    )
    if (errCuotas) { alert('El crédito se guardó, pero hubo un error al cargar las cuotas: ' + errCuotas.message); setGuardandoCredito(false); return }
    setShowFormCredito(false)
    setFormCredito({ activo_id: '', descripcion: '', entidad: '', observaciones: '', es_dolares: false })
    setCuotasForm([{ fecha: '', monto: '' }])
    setGuardandoCredito(false)
    await cargar()
  }

  async function pagarCuota(credito, cuota) {
    setGuardandoPagoCredito(true)
    let monto = cuota.monto
    // Si el crédito es en dólares, el monto en pesos recién se define ahora,
    // con la cotización del día del pago — no antes.
    if (credito.es_dolares) {
      const cotiz = parseFloat(formPagoCredito.cotizacion)
      if (!cotiz) { alert('Ingresá la cotización del dólar de hoy para calcular el monto en pesos'); setGuardandoPagoCredito(false); return }
      monto = Math.round((cuota.monto_usd || 0) * cotiz)
    } else if (formPagoCredito.montoReal) {
      // Para créditos en pesos con cuota variable (ej. tarjeta con interés
      // que cambia mes a mes), se puede cargar el monto real del resumen en
      // vez de quedarse con la estimación que se cargó al crear el crédito.
      monto = parseFloat(formPagoCredito.montoReal)
    }
    if (!monto) { alert('No se pudo calcular el monto a pagar'); setGuardandoPagoCredito(false); return }
    const desc = `Cuota ${cuota.nro_cuota} — ${credito.activos?.nombre || credito.descripcion || ''}${credito.es_dolares ? ` (US$${cuota.monto_usd} a $${formPagoCredito.cotizacion})` : ''}`
    let caja_oficial_id = null, caja_paralela_id = null
    if (formPagoCredito.es_paralelo) {
      const { data: cp, error: errCp } = await supabase.from('caja_paralela').insert({ fecha: formPagoCredito.fecha || cuota.fecha, tipo: 'egreso', descripcion: desc, monto }).select().single()
      if (errCp) { alert('Error al registrar en caja: ' + errCp.message); setGuardandoPagoCredito(false); return }
      caja_paralela_id = cp?.id
    } else {
      const { data: co, error: errCo } = await supabase.from('caja_oficial').insert({ fecha: formPagoCredito.fecha || cuota.fecha, tipo: 'egreso', categoria: 'Cuota crédito', descripcion: desc, monto, forma_pago: 'transferencia' }).select().single()
      if (errCo) { alert('Error al registrar en caja: ' + errCo.message); setGuardandoPagoCredito(false); return }
      caja_oficial_id = co?.id
    }
    const { error: errCuota } = await supabase.from('pagos_creditos').update({ estado: 'pagado', monto, fecha_pago: formPagoCredito.fecha || cuota.fecha, caja_oficial_id, caja_paralela_id }).eq('id', cuota.id)
    if (errCuota) { alert('El pago se registró en caja, pero no se pudo marcar la cuota como pagada: ' + errCuota.message); setGuardandoPagoCredito(false); return }
    const pagos = pagosCreditos[credito.id] || []
    const totalPagado = pagos.filter(p => p.estado === 'pagado').reduce((a, p) => a + (p.monto || 0), 0) + monto
    const cuotasPagadas = pagos.filter(p => p.estado === 'pagado').length + 1
    // Si es en dólares, el "monto_total" en pesos se va armando a medida que
    // se pagan las cuotas (recién ahí se sabe cuánto salió cada una) — no
    // hay un total fijo de antemano como en un crédito en pesos.
    const nuevoMontoTotal = credito.es_dolares ? (credito.monto_total || 0) + monto : credito.monto_total
    const totalCuotas = credito.cant_cuotas || pagos.length || 1
    const yaTerminado = credito.es_dolares ? cuotasPagadas >= totalCuotas : totalPagado >= credito.monto_total
    const { error: errCredito } = await supabase.from('creditos').update({
      monto_total: nuevoMontoTotal,
      saldo_pendiente: credito.es_dolares ? 0 : Math.max(0, credito.monto_total - totalPagado),
      cuotas_pagadas: cuotasPagadas,
      estado: yaTerminado ? 'cancelado' : 'activo',
    }).eq('id', credito.id)
    if (errCredito) alert('La cuota se marcó como pagada, pero no se pudo actualizar el saldo del crédito: ' + errCredito.message)
    setFormPagoCredito({ fecha: hoyLocal(), monto: '', es_paralelo: false, cotizacion: '' })
    setGuardandoPagoCredito(false)
    await cargar()
  }

  async function eliminarCredito(id) {
    if (!confirm('¿Eliminar este crédito?')) return
    // Un crédito con cuotas ya cargadas no se puede borrar directo — la base
    // lo bloquea porque las cuotas (pagos_creditos) todavía lo referencian.
    // Hay que borrar esas cuotas primero.
    const cuotas = pagosCreditos[id] || []
    const pagadas = cuotas.filter(c => c.estado === 'pagado')
    if (pagadas.length > 0) {
      if (!confirm(`Este crédito ya tiene ${pagadas.length} cuota${pagadas.length !== 1 ? 's' : ''} pagada${pagadas.length !== 1 ? 's' : ''} — el movimiento de caja de esos pagos NO se va a borrar, solo el registro del crédito y las cuotas. ¿Confirmás igual?`)) return
    }
    const { error: errCuotas } = await supabase.from('pagos_creditos').delete().eq('credito_id', id)
    if (errCuotas) { alert('Error al borrar las cuotas del crédito: ' + errCuotas.message); return }
    const { error } = await supabase.from('creditos').delete().eq('id', id)
    if (error) { alert('Error al eliminar: ' + error.message); return }
    await cargar()
  }

  if (loading) return <Loader />

  const inp = { padding: '8px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, background: S.surface, width: '100%', boxSizing: 'border-box', fontFamily: "'IBM Plex Sans', sans-serif" }
  const creditosActivos = creditos.filter(c => c.estado === 'activo')
  const creditosCancelados = creditos.filter(c => c.estado === 'cancelado')
  const totalDeuda = creditosActivos.reduce((a, c) => a + (c.saldo_pendiente || 0), 0)

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 3 }}>Créditos</div>
      <div style={{ fontSize: 12, color: S.muted, fontFamily: 'monospace', marginBottom: '1.5rem' }}>Créditos y cuotas pendientes</div>

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
        {[
          { label: 'Créditos activos', val: creditosActivos.length, color: S.amber },
          { label: 'Deuda total', val: `$${(totalDeuda / 1000000).toFixed(1)}M`, color: S.red },
          { label: 'Cancelados', val: creditosCancelados.length, color: S.green },
        ].map((m, i) => (
          <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem' }}>
            <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', marginBottom: 5, fontWeight: 600 }}>{m.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: m.color || S.text }}>{m.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button onClick={() => setShowFormCredito(!showFormCredito)}
          style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
          + Nuevo crédito
        </button>
      </div>

      {/* Formulario nuevo crédito */}
      {showFormCredito && (
        <Card>
          <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: '1rem' }}>Nuevo crédito</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ gridColumn: '1/-1' }}>
              <Label>Activo relacionado</Label>
              <select value={formCredito.activo_id} onChange={e => setFormCredito({...formCredito, activo_id: e.target.value})} style={inputStyle}>
                <option value="">— Sin activo específico —</option>
                {activos.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
            <div><Label>Descripción</Label><input type="text" value={formCredito.descripcion} onChange={e => setFormCredito({...formCredito, descripcion: e.target.value})} style={inputStyle} placeholder="ej. Crédito tractor" /></div>
            <div><Label>Entidad / Banco</Label><input type="text" value={formCredito.entidad} onChange={e => setFormCredito({...formCredito, entidad: e.target.value})} style={inputStyle} placeholder="ej. Banco Nación" /></div>
            <div style={{ gridColumn: '1/-1' }}><Label>Observaciones</Label><input type="text" value={formCredito.observaciones} onChange={e => setFormCredito({...formCredito, observaciones: e.target.value})} style={inputStyle} /></div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={formCredito.es_dolares} onChange={e => setFormCredito({...formCredito, es_dolares: e.target.checked})} />
                <span style={{ fontSize: 13 }}>💵 Es en dólares — las cuotas se pactan en USD, el monto en pesos se define recién al pagar cada una, con la cotización de ese día</span>
              </label>
            </div>
          </div>
          {/* Cuotas */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Label>Cuotas</Label>
              <button onClick={() => setCuotasForm([...cuotasForm, { fecha: '', monto: '' }])}
                style={{ padding: '4px 10px', fontSize: 11, background: S.accentLight, border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 5, cursor: 'pointer' }}>+ Agregar cuota</button>
            </div>
            <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: S.bg }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: S.muted, fontWeight: 600 }}>N°</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: S.muted, fontWeight: 600 }}>Fecha vencimiento</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, color: S.muted, fontWeight: 600 }}>Monto {formCredito.es_dolares ? 'US$' : '$'}</th>
                    <th style={{ width: 32 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {cuotasForm.map((c, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${S.border}` }}>
                      <td style={{ padding: '6px 12px', color: S.muted, fontSize: 12 }}>{i + 1}</td>
                      <td style={{ padding: '4px 8px' }}>
                        <input type="date" value={c.fecha} onChange={e => { const nc = [...cuotasForm]; nc[i] = {...nc[i], fecha: e.target.value}; setCuotasForm(nc) }} style={{ ...inputStyle, marginBottom: 0, padding: '6px 8px' }} />
                      </td>
                      <td style={{ padding: '4px 8px' }}>
                        <input type="number" value={c.monto} onChange={e => { const nc = [...cuotasForm]; nc[i] = {...nc[i], monto: e.target.value}; setCuotasForm(nc) }} style={{ ...inputStyle, marginBottom: 0, padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }} placeholder="0" />
                      </td>
                      <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                        {cuotasForm.length > 1 && <button onClick={() => setCuotasForm(cuotasForm.filter((_, j) => j !== i))} style={{ fontSize: 12, background: 'none', border: 'none', color: S.red, cursor: 'pointer' }}>✕</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: S.accentLight }}>
                    <td colSpan={2} style={{ padding: '8px 12px', fontWeight: 600, fontSize: 12 }}>Total</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                      {formCredito.es_dolares ? 'US$' : '$'}{cuotasForm.filter(c => c.monto).reduce((a, c) => a + (parseFloat(c.monto) || 0), 0).toLocaleString('es-AR')}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowFormCredito(false)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
            <button onClick={guardarCredito} disabled={guardandoCredito} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: S.green, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>{guardandoCredito ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </Card>
      )}

      {/* Lista créditos */}
      {creditos.map(c => {
        const pagos = pagosCreditos[c.id] || []
        const totalPagado = pagos.filter(p => p.estado === 'pagado').reduce((a, p) => a + (p.monto || 0), 0)
        const pct = c.es_dolares
          ? (c.cant_cuotas ? Math.round((c.cuotas_pagadas || 0) / c.cant_cuotas * 100) : 0)
          : (c.monto_total ? Math.round(totalPagado / c.monto_total * 100) : 0)
        const isOpen = creditoSelId === c.id
        return (
          <Card key={c.id} style={{ opacity: c.estado === 'cancelado' ? 0.7 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{c.activos?.nombre || c.descripcion || 'Crédito'}</span>
                  <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, fontWeight: 600, background: c.estado === 'cancelado' ? S.greenLight : S.amberLight, color: c.estado === 'cancelado' ? S.green : S.amber }}>
                    {c.estado === 'cancelado' ? '✓ Cancelado' : 'Activo'}
                  </span>
                </div>
                {c.entidad && <div style={{ fontSize: 12, color: S.muted }}>{c.entidad}</div>}
                <div style={{ display: 'flex', gap: 16, fontSize: 12, marginTop: 6, flexWrap: 'wrap' }}>
                  {c.es_dolares
                    ? <span>Total: <strong>US$ {(c.monto_total_usd || 0).toLocaleString('es-AR')}</strong> <span style={{ color: S.muted }}>(se va a saber el pesos a medida que se paguen las cuotas)</span></span>
                    : <span>Total: <strong>${(c.monto_total || 0).toLocaleString('es-AR')}</strong></span>}
                  {c.cant_cuotas && <span>{c.cuotas_pagadas || 0}/{c.cant_cuotas} cuotas</span>}
                  {c.monto_cuota && <span>Cuota: <strong>${(c.monto_cuota || 0).toLocaleString('es-AR')}</strong></span>}
                  {!c.es_dolares && <span style={{ color: S.red }}>Saldo: <strong>${(c.saldo_pendiente || 0).toLocaleString('es-AR')}</strong></span>}
                </div>
                {/* Barra progreso */}
                <div style={{ marginTop: 8, background: S.border, borderRadius: 4, height: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? S.green : S.accent, borderRadius: 4, transition: 'width .3s' }} />
                </div>
                <div style={{ fontSize: 11, color: S.muted, marginTop: 3 }}>
                  {c.es_dolares
                    ? `${c.cuotas_pagadas || 0}/${c.cant_cuotas || pagos.length} cuotas pagadas · ya pagado en pesos: $${totalPagado.toLocaleString('es-AR')}`
                    : `${pct}% pagado · $${totalPagado.toLocaleString('es-AR')} de $${(c.monto_total||0).toLocaleString('es-AR')}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginLeft: 12 }}>
                <button onClick={() => eliminarCredito(c.id)} style={{ padding: '5px 8px', fontSize: 11, background: S.redLight, border: '1px solid #F09595', color: S.red, borderRadius: 5, cursor: 'pointer' }}>🗑</button>
              </div>
            </div>

            {/* Tabla de cuotas */}
            {pagos.length > 0 && (
              <div style={{ borderTop: `1px solid ${S.border}`, marginTop: 12, paddingTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: S.muted, textTransform: 'uppercase', marginBottom: 8 }}>Cuotas</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: S.bg }}>
                      {['N°', 'Vencimiento', 'Monto', 'Estado', ''].map(h => (
                        <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 11, color: S.muted, fontWeight: 600, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagos.map(p => {
                      const vencido = p.estado !== 'pagado' && p.fecha && new Date(p.fecha) < new Date()
                      return (
                        <tr key={p.id} style={{ borderBottom: `1px solid ${S.border}`, background: isOpen && creditoSelId === p.id ? S.accentLight : 'transparent' }}>
                          <td style={{ padding: '7px 10px', color: S.muted }}>{p.nro_cuota}</td>
                          <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: vencido ? S.red : S.text }}>
                            {p.fecha ? new Date(p.fecha+'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
                            {vencido && <span style={{ fontSize: 10, color: S.red, marginLeft: 4 }}>⚠ Vencida</span>}
                          </td>
                          <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontWeight: 600 }}>
                            {c.es_dolares && p.estado !== 'pagado' ? `US$ ${(p.monto_usd||0).toLocaleString('es-AR')}` : `$${(p.monto||0).toLocaleString('es-AR')}`}
                          </td>
                          <td style={{ padding: '7px 10px' }}>
                            <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: p.estado === 'pagado' ? S.greenLight : vencido ? S.redLight : S.amberLight, color: p.estado === 'pagado' ? S.green : vencido ? S.red : S.amber }}>
                              {p.estado === 'pagado' ? '✓ Pagada' : vencido ? '⚠ Vencida' : '⏳ Pendiente'}
                            </span>
                          </td>
                          <td style={{ padding: '7px 10px' }}>
                            {p.estado !== 'pagado' && c.estado === 'activo' && (
                              <button onClick={() => { const cuotaSel = pagos.find(pp => pp.id === p.id); setCreditoSelId(creditoSelId === p.id ? null : p.id); setFormPagoCredito({ fecha: hoyLocal(), es_paralelo: false, cotizacion: '', montoReal: cuotaSel?.monto ? String(cuotaSel.monto) : '' }) }}
                                style={{ padding: '3px 8px', fontSize: 11, fontWeight: 600, background: S.green, border: 'none', color: '#fff', borderRadius: 5, cursor: 'pointer' }}>
                                💳 Pagar
                              </button>
                            )}
                            {p.estado === 'pagado' && p.fecha_pago && <span style={{ fontSize: 11, color: S.muted }}>Pagada {new Date(p.fecha_pago+'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {/* Form pago cuota seleccionada */}
                {creditoSelId && pagos.find(p => p.id === creditoSelId) && (
                  <div style={{ background: S.greenLight, border: `1px solid ${S.green}`, borderRadius: 8, padding: '1rem', marginTop: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: S.green, marginBottom: 8 }}>
                      Pagar cuota {pagos.find(p => p.id === creditoSelId)?.nro_cuota}
                      {c.es_dolares
                        ? ` — US$ ${(pagos.find(p => p.id === creditoSelId)?.monto_usd || 0).toLocaleString('es-AR')}`
                        : ` — $${(pagos.find(p => p.id === creditoSelId)?.monto || 0).toLocaleString('es-AR')}`}
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div><Label>Fecha pago</Label><input type="date" value={formPagoCredito.fecha} onChange={e => setFormPagoCredito({...formPagoCredito, fecha: e.target.value})} style={{ ...inp, width: 140 }} /></div>
                      {!c.es_dolares && (
                        <div>
                          <Label>Monto real de esta cuota</Label>
                          <input type="number" value={formPagoCredito.montoReal || ''} onChange={e => setFormPagoCredito({...formPagoCredito, montoReal: e.target.value})} style={{ ...inp, width: 140 }} placeholder="ej. 32500" />
                          <div style={{ fontSize: 10, color: S.muted, marginTop: 2 }}>Por si la cuota varía con intereses (ej. tarjeta) — se precarga con la estimación</div>
                        </div>
                      )}
                      {c.es_dolares && (
                        <div>
                          <Label>Cotización del dólar hoy</Label>
                          <input type="number" value={formPagoCredito.cotizacion || ''} onChange={e => setFormPagoCredito({...formPagoCredito, cotizacion: e.target.value})} style={{ ...inp, width: 120 }} placeholder="ej. 1200" />
                        </div>
                      )}
                      {c.es_dolares && formPagoCredito.cotizacion && (
                        <div style={{ fontSize: 12, color: S.green, fontWeight: 600, paddingBottom: 8 }}>
                          = ${Math.round((pagos.find(p => p.id === creditoSelId)?.monto_usd || 0) * parseFloat(formPagoCredito.cotizacion)).toLocaleString('es-AR')}
                        </div>
                      )}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer', marginBottom: 2 }}>
                        <input type="checkbox" checked={formPagoCredito.es_paralelo} onChange={e => setFormPagoCredito({...formPagoCredito, es_paralelo: e.target.checked})} />
                        Caja 2
                      </label>
                      <button onClick={() => pagarCuota(c, pagos.find(p => p.id === creditoSelId))} disabled={guardandoPagoCredito}
                        style={{ padding: '7px 16px', fontSize: 12, fontWeight: 600, background: S.green, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                        {guardandoPagoCredito ? 'Guardando...' : '✓ Confirmar'}
                      </button>
                      <button onClick={() => setCreditoSelId(null)} style={{ padding: '7px 12px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        )
      })}
      {creditos.length === 0 && <div style={{ textAlign: 'center', color: S.hint, padding: '2rem' }}>No hay créditos registrados.</div>}
    </div>
  )
}
