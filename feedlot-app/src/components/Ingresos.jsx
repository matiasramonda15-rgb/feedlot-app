import { useState, useEffect } from 'react'
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
    setCorrales(c || [])
    const procs = [...new Set((l || []).map(x => x.procedencia).filter(Boolean))].sort()
    setProcedencias(procs)
    setLoading(false)
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
      await supabase.from('corrales').update({ animales: Math.max(0, (corral?.animales || 0) - lote.cantidad) }).eq('id', lote.corral_cuarentena_id)
    }
    await supabase.from('lotes').delete().eq('id', id)
    await cargarDatos()
  }

  if (loading) return <Loader />

  const lotesSinPrecio = esDueno ? lotes.filter(l => !l.precio_compra || !l.procedencia) : []

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

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Ingresos</h1>
          <div style={{ fontSize: 12, color: S.muted }}>Registro de compras · feedlot</div>
        </div>
        <Btn onClick={() => setVista('nuevo')}>+ Nuevo ingreso</Btn>
      </div>

      {/* Pendientes de precio */}
      {lotesSinPrecio.length > 0 && (
        <div style={{ background: S.amberLight, border: '1px solid #EF9F27', borderRadius: 10, padding: '1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: S.amber, marginBottom: '.85rem' }}>
            ⚠ {lotesSinPrecio.length} ingreso{lotesSinPrecio.length !== 1 ? 's' : ''} sin precio de compra
          </div>
          {lotesSinPrecio.map(l => {
            const isEdit = editandoPrecio?.id === l.id
            const kgFacEdit = parseFloat(editandoPrecio?.kg_factura) || 0
            const diffKg = isEdit && kgFacEdit && l.kg_bascula
              ? l.kg_bascula - kgFacEdit
              : l.kg_factura ? l.kg_bascula - l.kg_factura : null
            return (
              <div key={l.id} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem', marginBottom: '.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: isEdit ? 12 : 0 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{l.codigo} · {l.procedencia}</div>
                    <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>
                      {l.cantidad} animales · {l.kg_bascula?.toLocaleString('es-AR')} kg báscula · {new Date(l.fecha_ingreso).toLocaleDateString('es-AR')}
                    </div>
                  </div>
                  {!isEdit && (
                    <button onClick={() => setEditandoPrecio({ id: l.id, precio_compra: '', kg_factura: l.kg_factura ? String(l.kg_factura) : '' })}
                      style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, background: S.accent, border: `1px solid ${S.accent}`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif", flexShrink: 0, marginLeft: 12 }}>
                      Cargar precio
                    </button>
                  )}
                </div>
                {isEdit && (
                  <div>
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
                        <div style={{ padding: '8px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 14, background: S.bg, fontFamily: 'monospace', color: diffKg !== null ? (diffKg >= 0 ? S.green : S.red) : S.hint }}>
                          {diffKg !== null ? `${diffKg >= 0 ? '+' : ''}${diffKg.toLocaleString('es-AR')} kg` : '—'}
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
                      <button onClick={() => eliminarLote(l.id)} style={{ background: S.redLight, border: `1px solid #F09595`, borderRadius: 6, color: S.red, fontSize: 11, padding: '3px 8px', cursor: 'pointer' }}>
                        Borrar
                      </button>
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
    </div>
  )
} 
