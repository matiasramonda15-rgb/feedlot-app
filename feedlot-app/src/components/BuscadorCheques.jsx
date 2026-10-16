import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'

// Buscador de cheques (Comercial → Caja). Pensado para cuando vuelve un
// cheque (rechazado, devuelto, reclamado): ponés el número y aparece toda su
// historia — de quién vino, en qué caja entró, a quién se le entregó y con qué
// pago — buscando en las dos cajas y en todos los estados, archivados incluidos.
//
// La trazabilidad sale de:
//  - la propia fila del cheque (recibido_de / librador / beneficiario),
//  - la vista v_cheques_movimientos (pagos que usaron el cheque: compras,
//    gastos, fletes, órdenes, sueldos, arriendos, hacienda; y la venta de
//    donde vino),
//  - el movimiento de caja vinculado y los movimientos de caja cuya
//    descripción nombra el cheque ("#número"), para los cargados a mano.

const ESTADOS = {
  en_cartera: { bg: '#FDF0E0', color: '#7A4500', label: 'En cartera' },
  entregado: { bg: '#F0EAFB', color: '#3D1A6B', label: 'Entregado' },
  depositado: { bg: '#E8EFF8', color: '#1A3D6B', label: 'Depositado' },
  cobrado: { bg: '#E8F4EB', color: '#1E5C2E', label: 'Cobrado' },
  rechazado: { bg: '#FDF0F0', color: '#7A1A1A', label: 'Rechazado' },
  anulado: { bg: '#F7F5F0', color: '#6B6760', label: 'Anulado' },
}

const soloDigitos = s => String(s || '').replace(/\D/g, '')
const sinCeros = s => soloDigitos(s).replace(/^0+/, '')
const fmtFecha = iso => iso ? new Date(String(iso).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'
const fmtPesos = n => '$' + (parseFloat(n) || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })
const sumarDias = (iso, d) => { const f = new Date(iso + 'T12:00:00'); f.setDate(f.getDate() + d); return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}` }
// Igual que en Comercial: en los emitidos la fecha de cobro quedó en
// fecha_vencimiento; en los recibidos, en fecha_cobro.
const fechaCobro = c => c.tipo === 'emitido' ? (c.fecha_vencimiento || c.fecha_cobro) : (c.fecha_cobro || (c.fecha_vencimiento ? sumarDias(c.fecha_vencimiento, -30) : null))
const fechaVto = c => c.tipo === 'emitido' ? (c.fecha_vencimiento ? sumarDias(c.fecha_vencimiento, 30) : null) : (c.fecha_vencimiento || (c.fecha_cobro ? sumarDias(c.fecha_cobro, 30) : null))

// ¿La descripción de un movimiento de caja nombra este cheque? Se exige el
// "#" delante y que no siga otro dígito, para que el cheque 384 no coincida
// con el #39277384.
function descripcionNombraCheque(desc, numero) {
  const n = sinCeros(numero)
  if (!desc || !n) return false
  return new RegExp(`#0*${n}(?!\\d)`).test(desc)
}

export function filtrarCheques(cheques, texto) {
  const t = String(texto || '').trim()
  if (!t) return []
  const dig = sinCeros(t)
  const esNumero = /^[\d\s.\-#]+$/.test(t)
  if (esNumero) {
    if (!dig) return []
    // Con 1–3 dígitos, solo coincidencia exacta (si no, aparecen cientos).
    return cheques.filter(c => {
      const n = sinCeros(c.numero)
      if (!n) return false
      return dig.length <= 3 ? n === dig : n.includes(dig)
    })
  }
  // Texto: busca por librador, de quién lo recibimos o a quién se entregó.
  if (t.length < 3) return []
  const q = t.toLowerCase()
  return cheques.filter(c => [c.librador, c.recibido_de, c.beneficiario, c.banco].some(v => (v || '').toLowerCase().includes(q)))
}

export default function BuscadorCheques({ cheques, cajaOficial, cajaParalela, cambiarEstadoCheque, S }) {
  const [texto, setTexto] = useState('')
  const [movs, setMovs] = useState({})
  const [cargandoMovs, setCargandoMovs] = useState(false)

  const resultados = useMemo(() => {
    const r = filtrarCheques(cheques, texto)
    // Primero la coincidencia exacta de número, después lo más reciente.
    const dig = sinCeros(texto)
    return [...r].sort((a, b) => {
      const ea = sinCeros(a.numero) === dig ? 0 : 1, eb = sinCeros(b.numero) === dig ? 0 : 1
      if (ea !== eb) return ea - eb
      return (fechaCobro(b) || '').localeCompare(fechaCobro(a) || '')
    }).slice(0, 30)
  }, [cheques, texto])

  const idsClave = resultados.map(c => c.id).join(',')
  useEffect(() => {
    const ids = idsClave ? idsClave.split(',').map(Number) : []
    if (ids.length === 0) { setMovs({}); return }
    let vivo = true
    setCargandoMovs(true)
    supabase.from('v_cheques_movimientos').select('*').in('cheque_id', ids).then(({ data, error }) => {
      if (!vivo) return
      if (error) console.error('v_cheques_movimientos:', error.message)
      const porCheque = {}
      for (const m of (data || [])) (porCheque[m.cheque_id] = porCheque[m.cheque_id] || []).push(m)
      setMovs(porCheque)
      setCargandoMovs(false)
    })
    return () => { vivo = false }
  }, [idsClave])

  const coPorId = useMemo(() => Object.fromEntries((cajaOficial || []).map(x => [x.id, x])), [cajaOficial])
  const cpPorId = useMemo(() => Object.fromEntries((cajaParalela || []).map(x => [x.id, x])), [cajaParalela])

  const hayTexto = texto.trim().length > 0

  const Fila = ({ icono, titulo, children, color }) => (
    <div style={{ display: 'flex', gap: 8, padding: '5px 0', fontSize: 12, alignItems: 'baseline' }}>
      <div style={{ width: 18, flexShrink: 0 }}>{icono}</div>
      <div style={{ width: 120, flexShrink: 0, color: S.muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.03em' }}>{titulo}</div>
      <div style={{ flex: 1, color: color || S.text, minWidth: 0 }}>{children}</div>
    </div>
  )

  const MovCaja = ({ m, caja }) => (
    <div style={{ marginBottom: 2 }}>
      <span style={{ fontFamily: 'monospace', color: S.muted }}>{fmtFecha(m.fecha)}</span>
      {' · '}<span style={{ fontWeight: 600 }}>{caja}</span>
      {' · '}<span style={{ color: m.tipo === 'ingreso' ? S.green : S.red }}>{m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} {fmtPesos(m.monto)}</span>
      {m.descripcion && <div style={{ color: S.muted, fontSize: 11, marginTop: 1 }}>{m.descripcion}</div>}
    </div>
  )

  return (
    <div style={{ background: S.surface, border: `1px solid ${hayTexto ? S.accent : S.border}`, borderRadius: 10, padding: '0.9rem 1.1rem', marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: S.accent, whiteSpace: 'nowrap' }}>🔎 Buscar cheque</div>
        <input type="text" value={texto} onChange={e => setTexto(e.target.value)} placeholder="Número de cheque (o librador / a quién se entregó)"
          style={{ flex: '1 1 260px', padding: '8px 12px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif", color: S.text, background: S.surface, minWidth: 0 }} />
        {hayTexto && <button onClick={() => setTexto('')} style={{ padding: '7px 12px', fontSize: 12, background: 'transparent', border: `1px solid ${S.border}`, borderRadius: 6, color: S.muted, cursor: 'pointer' }}>✕ Limpiar</button>}
      </div>

      {hayTexto && (
        <div style={{ marginTop: 12 }}>
          {resultados.length === 0 && (
            <div style={{ fontSize: 12, color: S.hint, padding: '8px 0' }}>
              No hay cheques que coincidan{/^\d{1,3}$/.test(sinCeros(texto)) ? ' (con 1 a 3 dígitos se busca el número exacto; probá con más dígitos)' : ''}.
            </div>
          )}
          {resultados.length > 0 && <div style={{ fontSize: 11, color: S.hint, marginBottom: 8 }}>{resultados.length === 30 ? 'Primeros 30 resultados — escribí más dígitos para afinar.' : `${resultados.length} cheque${resultados.length !== 1 ? 's' : ''}`} · se busca en Caja 1 y Caja 2, en todos los estados.</div>}

          {resultados.map(c => {
            const est = ESTADOS[c.estado] || ESTADOS.en_cartera
            const lista = movs[c.id] || []
            const origenes = lista.filter(m => m.rol === 'origen')
            const destinos = lista.filter(m => m.rol === 'entregado')
            const cajaVinc = c.caja_oficial_id && coPorId[c.caja_oficial_id] ? { m: coPorId[c.caja_oficial_id], caja: 'Caja 1' }
              : c.caja_paralela_id && cpPorId[c.caja_paralela_id] ? { m: cpPorId[c.caja_paralela_id], caja: 'Caja 2' } : null
            // Movimientos de caja que nombran el cheque (pagos cargados con el
            // detalle "Entregado a …: cheque(s) #…").
            const mencionados = [
              ...(cajaOficial || []).filter(x => x.id !== c.caja_oficial_id && descripcionNombraCheque(x.descripcion, c.numero)).map(m => ({ m, caja: 'Caja 1' })),
              ...(cajaParalela || []).filter(x => x.id !== c.caja_paralela_id && descripcionNombraCheque(x.descripcion, c.numero)).map(m => ({ m, caja: 'Caja 2' })),
            ]
            const esRecibido = c.tipo === 'recibido'
            const sinRastroDestino = !c.beneficiario && destinos.length === 0 && mencionados.filter(x => x.m.tipo === 'egreso').length === 0
            return (
              <div key={c.id} style={{ border: `1px solid ${c.estado === 'rechazado' ? '#F09595' : S.border}`, borderRadius: 8, padding: '0.8rem 1rem', marginBottom: 10, background: c.estado === 'rechazado' ? '#FFF8F8' : S.bg }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                  <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: esRecibido ? S.greenLight : S.amberLight, color: esRecibido ? S.green : S.amber }}>{esRecibido ? '📥 De tercero (recibido)' : '📤 Propio (emitido)'}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700 }}>N° {c.numero || 's/n'}</span>
                  <span style={{ fontSize: 12, color: S.muted }}>{c.banco || 'Banco sin dato'}</span>
                  <span style={{ fontSize: 11, color: S.muted }}>{c.es_electronico === true ? '💻 E-cheq' : c.es_electronico === false ? '📄 Físico' : ''}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: S.surface, border: `1px solid ${S.border}`, color: S.muted }}>{c.es_paralelo ? 'Caja 2' : 'Caja 1'}</span>
                  <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: 15, fontWeight: 700 }}>{fmtPesos(c.monto)}</span>
                  <select value={c.estado} onChange={e => cambiarEstadoCheque(c.id, e.target.value)} title="Cambiar estado"
                    style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, border: `1px solid ${est.color}`, borderRadius: 5, background: est.bg, color: est.color, cursor: 'pointer' }}>
                    {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>

                <Fila icono="📅" titulo="Fechas">
                  {c.fecha_emision && <>Emisión {fmtFecha(c.fecha_emision)} · </>}
                  Cobro {fmtFecha(fechaCobro(c))} · Vence {fmtFecha(fechaVto(c))}
                </Fila>

                {esRecibido && (
                  <Fila icono="✍️" titulo="Librador">{c.librador || '—'}</Fila>
                )}

                {esRecibido && (
                  <Fila icono="📥" titulo="Vino de" color={S.green}>
                    <div style={{ fontWeight: 600 }}>{c.recibido_de || c.librador || '—'}</div>
                    {origenes.map((o, i) => (
                      <div key={i} style={{ color: S.text }}>{o.modulo}{o.contraparte ? ` · ${o.contraparte}` : ''} · <span style={{ fontFamily: 'monospace', color: S.muted }}>{fmtFecha(o.fecha)}</span>{o.detalle ? <span style={{ color: S.muted }}> · {o.detalle}</span> : null}</div>
                    ))}
                    {cajaVinc && <MovCaja m={cajaVinc.m} caja={cajaVinc.caja} />}
                  </Fila>
                )}

                <Fila icono="📤" titulo={esRecibido ? 'Se entregó a' : 'Se le dio a'} color={S.purple}>
                  {c.beneficiario && <div style={{ fontWeight: 600 }}>{c.beneficiario}</div>}
                  {destinos.map((d, i) => (
                    <div key={i} style={{ color: S.text }}>
                      {d.modulo}{d.contraparte && d.contraparte !== c.beneficiario ? ` · ${d.contraparte}` : ''} · <span style={{ fontFamily: 'monospace', color: S.muted }}>{fmtFecha(d.fecha)}</span>{d.detalle ? <span style={{ color: S.muted }}> · {d.detalle}</span> : null}
                    </div>
                  ))}
                  {!esRecibido && cajaVinc && <MovCaja m={cajaVinc.m} caja={cajaVinc.caja} />}
                  {mencionados.map((x, i) => <MovCaja key={i} m={x.m} caja={x.caja} />)}
                  {cargandoMovs && lista.length === 0 && <span style={{ color: S.hint }}>Buscando…</span>}
                  {!cargandoMovs && esRecibido && sinRastroDestino && (
                    <span style={{ color: S.hint }}>
                      {c.estado === 'en_cartera' ? 'Todavía está en cartera (no se usó).'
                        : c.estado === 'depositado' || c.estado === 'cobrado' ? 'Se depositó en nuestra cuenta.'
                          : 'No quedó registrado a quién se entregó (se marcó a mano o se cargó antes de que el sistema lo guardara).'}
                    </span>
                  )}
                  {!cargandoMovs && !esRecibido && !c.beneficiario && destinos.length === 0 && !cajaVinc && <span style={{ color: S.hint }}>Sin dato de a quién se dio.</span>}
                </Fila>

                {c.observaciones && <Fila icono="📝" titulo="Observaciones">{c.observaciones}</Fila>}

                {c.estado === 'rechazado' && (
                  <div style={{ marginTop: 6, fontSize: 11, color: S.red }}>
                    Marcado como rechazado. Ojo: cambiar el estado no mueve la caja — si hay que reclamar o devolver plata, cargalo como movimiento.
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
