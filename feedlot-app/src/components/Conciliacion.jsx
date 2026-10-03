import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Conciliación de cajas: compara lo que dice el sistema a una fecha de corte
// contra lo real (extracto del banco, arqueo del efectivo, cheques que se
// tienen en la mano) y muestra la diferencia de cada caja.
//
// Cómo arma el saldo el sistema: cuando entra un cheque se registra el
// ingreso en la caja, y cuando se paga con un cheque propio se registra el
// egreso ese día (aunque el banco lo debite después). Por eso:
//    Caja 1 = banco + cheques en cartera − cheques propios que el banco
//             todavía no debitó (+ efectivo, si hubiera en Caja 1)
//    Caja 2 = efectivo + cheques en cartera − cheques propios sin cobrar
// y lo real se calcula con la misma fórmula.
//
// No escribe nada en la base: lo que se carga queda guardado en este
// navegador (por fecha de corte) para poder completarlo de a poco.
// ─────────────────────────────────────────────────────────────────────────────

const FINALES = ['cobrado', 'rechazado', 'anulado']
const hoyISO = () => { const f = new Date(); return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}` }
const sumarDias = (iso, d) => { const f = new Date(iso + 'T12:00:00'); f.setDate(f.getDate() + d); return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}` }
// En los cheques propios, la fecha de cobro quedó guardada en fecha_vencimiento
// (ver Comercial.jsx). En los recibidos, fecha_cobro es la de cobro.
const fechaCobro = c => c.tipo === 'emitido'
  ? (c.fecha_vencimiento || c.fecha_cobro || null)
  : (c.fecha_cobro || (c.fecha_vencimiento ? sumarDias(c.fecha_vencimiento, -30) : null))
const num = v => { const n = parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')); return isNaN(n) ? 0 : n }
const $ = n => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('es-AR')
const fmtF = f => f ? new Date(f + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'
const saldoAl = (movs, corte) => movs.filter(m => m.fecha && m.fecha <= corte)
  .reduce((s, m) => s + (m.tipo === 'ingreso' ? 1 : -1) * (parseFloat(m.monto) || 0), 0)

export default function Conciliacion({ cajaOficial, cajaParalela, cheques, S, onCambio, usuario }) {
  // ── Cierres de caja ─────────────────────────────────────────────────────
  // Al cerrar, se registra un movimiento de ajuste a la fecha de corte por la
  // diferencia (real − sistema) y el saldo de esa fecha queda FIJO: si
  // después se carga, corrige o borra un movimiento con fecha anterior al
  // cierre, la base recalcula sola ese ajuste (así no se vuelve a desfasar,
  // como pasó con la conciliación del 11/09).
  const [cierres, setCierres] = useState([])
  const [cerrando, setCerrando] = useState(false)
  async function cargarCierres() {
    const { data } = await supabase.from('cierres_caja').select('*').order('fecha', { ascending: false }).order('id', { ascending: false })
    setCierres(data || [])
  }
  useEffect(() => { cargarCierres() }, [])
  const ultimoCierre = caja => cierres.find(c => c.caja === caja)
  async function cerrarCaja(caja, saldoReal, saldoSistema) {
    const nombre = caja === 'oficial' ? 'Caja 1' : 'Caja 2'
    const previo = ultimoCierre(caja)
    if (previo && previo.fecha >= corte) { alert(`${nombre} ya tiene un cierre al ${fmtF(previo.fecha)}. El nuevo cierre tiene que ser posterior.`); return }
    const dif = Math.round((saldoReal - saldoSistema) * 100) / 100
    if (!confirm(`¿Cerrar ${nombre} al ${fmtF(corte)}?\n\nSaldo real: ${$(saldoReal)}\nSegún el sistema: ${$(saldoSistema)}\nAjuste: ${dif > 0 ? '+' : ''}${$(dif)}\n\nEl saldo a esa fecha queda fijo.`)) return
    setCerrando(true)
    const desc = `Ajuste de conciliación — cierre de ${nombre} al ${fmtF(corte)}. Saldo real: ${$(saldoReal)}`
    const fila = { fecha: corte, tipo: dif >= 0 ? 'ingreso' : 'egreso', descripcion: desc, monto: Math.abs(dif) }
    const { data: aj, error } = caja === 'oficial'
      ? await supabase.from('caja_oficial').insert({ ...fila, categoria: 'Ajuste', forma_pago: 'ajuste' }).select().single()
      : await supabase.from('caja_paralela').insert(fila).select().single()
    if (error) { alert('No se pudo registrar el ajuste: ' + error.message); setCerrando(false); return }
    const { error: e2 } = await supabase.from('cierres_caja').insert({ caja, fecha: corte, saldo_real: saldoReal, ajuste_id: aj.id, observaciones: real.notas || null, registrado_por: usuario?.id || null })
    if (e2) { await supabase.from(caja === 'oficial' ? 'caja_oficial' : 'caja_paralela').delete().eq('id', aj.id); alert('No se pudo registrar el cierre: ' + e2.message); setCerrando(false); return }
    await supabase.rpc('recalcular_cierre_caja', { p_caja: caja })
    setCerrando(false)
    await cargarCierres()
    onCambio && onCambio()
  }
  async function deshacerCierre(c) {
    const nombre = c.caja === 'oficial' ? 'Caja 1' : 'Caja 2'
    if (!confirm(`¿Deshacer el cierre de ${nombre} al ${fmtF(c.fecha)}? Se borra su movimiento de ajuste.`)) return
    await supabase.from('cierres_caja').delete().eq('id', c.id)
    if (c.ajuste_id) await supabase.from(c.caja === 'oficial' ? 'caja_oficial' : 'caja_paralela').delete().eq('id', c.ajuste_id)
    await cargarCierres()
    onCambio && onCambio()
  }

  const [corte, setCorte] = useState(hoyISO())
  const clave = `conciliacion:${corte}`
  const vacio = { banco: '', efectivo1: '', efectivo2: '', otrosCh1: '', otrosCh2: '', noTengo: [], yaDebitado: [], notas: '' }
  const [real, setReal] = useState(vacio)

  // Lo cargado se guarda en este navegador, por fecha de corte.
  useEffect(() => {
    try { const g = localStorage.getItem(clave); setReal(g ? { ...vacio, ...JSON.parse(g) } : vacio) } catch (e) { setReal(vacio) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])
  const guardar = (nuevo) => { setReal(nuevo); try { localStorage.setItem(clave, JSON.stringify(nuevo)) } catch (e) { /* sin almacenamiento: queda en pantalla */ } }
  const set = (campo, valor) => guardar({ ...real, [campo]: valor })
  const alternar = (campo, id) => guardar({ ...real, [campo]: real[campo].includes(id) ? real[campo].filter(x => x !== id) : [...real[campo], id] })

  const datos = useMemo(() => {
    const cartera = cheques.filter(c => c.tipo === 'recibido' && c.estado === 'en_cartera')
    // Propios que todavía pueden debitarse: no finales y dentro de su plazo
    // (fecha de cobro + 30 días) a la fecha de corte.
    const propios = cheques.filter(c => c.tipo === 'emitido' && !FINALES.includes(c.estado) && fechaCobro(c) && sumarDias(fechaCobro(c), 30) >= corte)
    const orden = (a, b) => (fechaCobro(a) || '').localeCompare(fechaCobro(b) || '')
    const armar = (esPar, movs) => {
      const cart = cartera.filter(c => !!c.es_paralelo === esPar).sort(orden)
      const prop = propios.filter(c => !!c.es_paralelo === esPar).sort(orden)
      const suma = arr => arr.reduce((s, c) => s + (parseFloat(c.monto) || 0), 0)
      return { saldo: saldoAl(movs, corte), cart, prop, sumCart: suma(cart), sumProp: suma(prop) }
    }
    return { c1: armar(false, cajaOficial), c2: armar(true, cajaParalela) }
  }, [cajaOficial, cajaParalela, cheques, corte])

  const calcReal = (d, esPar) => {
    const cartReal = d.cart.filter(c => !real.noTengo.includes(c.id)).reduce((s, c) => s + (parseFloat(c.monto) || 0), 0) + num(esPar ? real.otrosCh2 : real.otrosCh1)
    const propPend = d.prop.filter(c => !real.yaDebitado.includes(c.id)).reduce((s, c) => s + (parseFloat(c.monto) || 0), 0)
    const liquido = esPar ? num(real.efectivo2) : num(real.banco) + num(real.efectivo1)
    const cargado = esPar ? real.efectivo2 !== '' : real.banco !== ''
    return { cartReal, propPend, liquido, total: liquido + cartReal - propPend, cargado }
  }
  const r1 = calcReal(datos.c1, false)
  const r2 = calcReal(datos.c2, true)
  const esHoy = corte === hoyISO()

  const inp = { width: '100%', padding: '8px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 14, fontFamily: 'monospace', textAlign: 'right', background: S.surface, boxSizing: 'border-box' }
  const fila = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '6px 0', fontSize: 13 }

  const Diferencia = ({ sistema, r, color }) => {
    const dif = r.total - sistema
    const ok = Math.abs(dif) < 1
    return (
      <div style={{ marginTop: 14, borderTop: `2px solid ${color}`, paddingTop: 12 }}>
        <div style={fila}><span>Según el sistema</span><b style={{ fontFamily: 'monospace' }}>{$(sistema)}</b></div>
        <div style={fila}><span>Real</span><b style={{ fontFamily: 'monospace' }}>{r.cargado ? $(r.total) : '—'}</b></div>
        <div style={{ ...fila, marginTop: 6, padding: '10px 12px', borderRadius: 6, background: !r.cargado ? S.bg : ok ? S.greenLight : S.amberLight }}>
          <span style={{ fontWeight: 600 }}>{!r.cargado ? 'Cargá lo real para ver la diferencia' : ok ? 'Coincide' : dif > 0 ? 'Hay más de lo que dice el sistema' : 'Hay menos de lo que dice el sistema'}</span>
          {r.cargado && !ok && <b style={{ fontFamily: 'monospace', fontSize: 16, color: dif > 0 ? S.green : S.red }}>{dif > 0 ? '+' : ''}{$(dif)}</b>}
        </div>
      </div>
    )
  }

  const ListaCheques = ({ items, campo, textoCheck, vacioTxt }) => (
    items.length === 0
      ? <div style={{ fontSize: 12, color: S.hint, padding: '4px 0' }}>{vacioTxt}</div>
      : <div style={{ maxHeight: 260, overflowY: 'auto', border: `1px solid ${S.border}`, borderRadius: 6 }}>
          {items.map(c => {
            const marcado = real[campo].includes(c.id)
            return (
              <label key={c.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'center', padding: '7px 10px', borderBottom: `1px solid ${S.border}`, fontSize: 12, cursor: 'pointer', background: marcado ? S.bg : 'transparent', color: marcado ? S.hint : S.text }}>
                <input type="checkbox" checked={marcado} onChange={() => alternar(campo, c.id)} title={textoCheck} />
                <span style={{ textDecoration: marcado ? 'line-through' : 'none' }}>
                  #{c.numero || 's/n'} {c.banco ? `(${c.banco})` : ''} — {c.tipo === 'emitido' ? (c.beneficiario || 'sin beneficiario') : (c.librador || '—')}
                  <span style={{ color: S.hint }}> · cobro {fmtF(fechaCobro(c))}</span>
                </span>
                <b style={{ fontFamily: 'monospace' }}>{$(parseFloat(c.monto) || 0)}</b>
              </label>
            )
          })}
        </div>
  )

  const Bloque = ({ titulo, color, fondo, d, r, esPar }) => (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderTop: `4px solid ${color}`, borderRadius: 8, padding: '1.1rem 1.25rem' }}>
      <div style={{ fontSize: 17, fontWeight: 700, color, marginBottom: 2 }}>{titulo}</div>
      <div style={{ fontSize: 12, color: S.muted, marginBottom: 14 }}>
        El sistema dice {$(d.saldo)} al {fmtF(corte)}. De eso, {$(d.sumCart)} son cheques en cartera y ya tiene restados {$(d.sumProp)} de cheques propios sin debitar.
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{esPar ? 'Efectivo contado (arqueo)' : 'Saldo del banco según el extracto'}</div>
      <input style={inp} inputMode="decimal" placeholder="0" value={esPar ? real.efectivo2 : real.banco} onChange={e => set(esPar ? 'efectivo2' : 'banco', e.target.value)} />
      {!esPar && <div style={{ fontSize: 11, color: S.hint, marginTop: 4 }}>Si tenés más de una cuenta, sumalas. Referencia del sistema: {$(d.saldo - d.sumCart + d.sumProp)}</div>}
      {esPar && <div style={{ fontSize: 11, color: S.hint, marginTop: 4 }}>Referencia del sistema: {$(d.saldo - d.sumCart + d.sumProp)}</div>}
      {!esPar && (
        <>
          <div style={{ fontSize: 13, fontWeight: 600, margin: '12px 0 6px' }}>Efectivo en Caja 1 (si hay)</div>
          <input style={inp} inputMode="decimal" placeholder="0" value={real.efectivo1} onChange={e => set('efectivo1', e.target.value)} />
        </>
      )}

      <div style={{ fontSize: 13, fontWeight: 600, margin: '16px 0 4px' }}>Cheques en cartera ({d.cart.length})</div>
      <div style={{ fontSize: 11, color: S.hint, marginBottom: 6 }}>Tildá los que <b>no</b> tenés en la mano.</div>
      {ListaCheques({ items: d.cart, campo: 'noTengo', textoCheck: 'No lo tengo', vacioTxt: 'El sistema no tiene cheques en cartera en esta caja.' })}
      <div style={{ fontSize: 12, margin: '8px 0 4px' }}>Cheques que tenés y el sistema no tiene</div>
      <input style={inp} inputMode="decimal" placeholder="0" value={esPar ? real.otrosCh2 : real.otrosCh1} onChange={e => set(esPar ? 'otrosCh2' : 'otrosCh1', e.target.value)} />

      <div style={{ fontSize: 13, fontWeight: 600, margin: '16px 0 4px' }}>Cheques propios sin debitar ({d.prop.length})</div>
      <div style={{ fontSize: 11, color: S.hint, marginBottom: 6 }}>Tildá los que el {esPar ? 'tenedor ya cobró' : 'banco ya debitó (figuran en el extracto)'}.</div>
      {ListaCheques({ items: d.prop, campo: 'yaDebitado', textoCheck: 'Ya se debitó', vacioTxt: 'No hay cheques propios pendientes en esta caja.' })}

      <div style={{ marginTop: 14, fontSize: 12, color: S.muted }}>
        <div style={fila}><span>{esPar ? 'Efectivo' : 'Banco + efectivo'}</span><span style={{ fontFamily: 'monospace' }}>{$(r.liquido)}</span></div>
        <div style={fila}><span>+ Cheques en la mano</span><span style={{ fontFamily: 'monospace' }}>{$(r.cartReal)}</span></div>
        <div style={fila}><span>− Cheques propios que faltan debitar</span><span style={{ fontFamily: 'monospace' }}>{$(r.propPend)}</span></div>
      </div>
      {Diferencia({ sistema: d.saldo, r, color })}
    </div>
  )

  const totalSis = datos.c1.saldo + datos.c2.saldo
  const totalReal = r1.total + r2.total
  const ambos = r1.cargado && r2.cargado

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: '1.25rem' }}>
        <div style={{ maxWidth: 560 }}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Conciliación de cajas</div>
          <div style={{ fontSize: 13, color: S.muted, lineHeight: 1.5 }}>
            Cargá lo que tenés en la realidad a la fecha de corte y el sistema te muestra la diferencia de cada caja. No modifica nada: lo que cargás queda guardado en esta computadora.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <label style={{ fontSize: 12, color: S.muted }}>
            Fecha de corte
            <input type="date" value={corte} onChange={e => setCorte(e.target.value)} style={{ display: 'block', marginTop: 4, padding: '7px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13 }} />
          </label>
          <button onClick={() => window.print()} style={{ padding: '8px 14px', fontSize: 13, background: S.surface, border: `1px solid ${S.border}`, borderRadius: 6, cursor: 'pointer' }}>Imprimir</button>
          <button onClick={() => { if (confirm('¿Borrar todo lo cargado para esta fecha de corte?')) guardar(vacio) }} style={{ padding: '8px 14px', fontSize: 13, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 6, cursor: 'pointer' }}>Empezar de cero</button>
        </div>
      </div>

      {!esHoy && (
        <div style={{ fontSize: 12, background: S.amberLight, color: S.amber, borderRadius: 6, padding: '8px 12px', marginBottom: '1rem' }}>
          Los saldos se calculan al {fmtF(corte)}, pero los cheques se muestran como están hoy. Para que todo coincida, conviene hacer la conciliación el mismo día del corte.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, alignItems: 'start' }}>
        {Bloque({ titulo: 'Caja 1', color: S.accent, d: datos.c1, r: r1, esPar: false })}
        {Bloque({ titulo: 'Caja 2', color: S.purple, d: datos.c2, r: r2, esPar: true })}
      </div>

      <div style={{ marginTop: 16, background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem 1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'center' }}>
        <div><div style={{ fontSize: 12, color: S.muted }}>Disponibilidad según el sistema</div><div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace' }}>{$(totalSis)}</div></div>
        <div><div style={{ fontSize: 12, color: S.muted }}>Disponibilidad real</div><div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace' }}>{ambos ? $(totalReal) : '—'}</div></div>
        <div><div style={{ fontSize: 12, color: S.muted }}>Diferencia total</div><div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: !ambos ? S.hint : Math.abs(totalReal - totalSis) < 1 ? S.green : S.amber }}>{ambos ? `${totalReal - totalSis > 0 ? '+' : ''}${$(totalReal - totalSis)}` : 'Completá las dos cajas'}</div></div>
      </div>

      {/* ── Cerrar la caja ── */}
      <div style={{ marginTop: 16, background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '1rem 1.25rem' }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>🔒 Cerrar la caja al {fmtF(corte)}</div>
        <div style={{ fontSize: 12, color: S.muted, marginBottom: 10 }}>
          Registra un movimiento de ajuste por la diferencia y deja <b>fijo</b> el saldo a esa fecha: si después alguien carga o corrige algo con fecha anterior, el ajuste se recalcula solo y el saldo de hoy no se corre.
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[{ caja: 'oficial', nombre: 'Caja 1', r: r1, sis: datos.c1.saldo, color: S.accent }, { caja: 'paralela', nombre: 'Caja 2', r: r2, sis: datos.c2.saldo, color: S.purple }].map(x => {
            const prev = ultimoCierre(x.caja)
            const dif = x.r.total - x.sis
            return (
              <button key={x.caja} disabled={!x.r.cargado || cerrando} onClick={() => cerrarCaja(x.caja, x.r.total, x.sis)}
                style={{ padding: '9px 14px', borderRadius: 8, border: `2px solid ${x.r.cargado ? x.color : S.border}`, background: S.surface, cursor: x.r.cargado ? 'pointer' : 'default', textAlign: 'left', opacity: x.r.cargado ? 1 : 0.6 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: x.color }}>Cerrar {x.nombre}</div>
                <div style={{ fontSize: 11, color: S.muted }}>{x.r.cargado ? `ajuste ${dif > 0 ? '+' : ''}${$(dif)}` : 'cargá lo real primero'}{prev ? ` · último cierre ${fmtF(prev.fecha)}` : ''}</div>
              </button>
            )
          })}
        </div>
        {cierres.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Cierres hechos</div>
            {cierres.slice(0, 8).map((c, i) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '4px 0', borderTop: `1px solid ${S.border}` }}>
                <span>{c.caja === 'oficial' ? 'Caja 1' : 'Caja 2'} · {fmtF(c.fecha)} · saldo fijo <b>{$(parseFloat(c.saldo_real))}</b></span>
                {ultimoCierre(c.caja)?.id === c.id && <button onClick={() => deshacerCierre(c)} style={{ padding: '2px 8px', fontSize: 11, background: 'transparent', border: `1px solid ${S.border}`, color: S.muted, borderRadius: 5, cursor: 'pointer' }}>Deshacer</button>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Notas</div>
        <textarea value={real.notas} onChange={e => set('notas', e.target.value)} rows={3} placeholder="Ej.: el cheque de X lo tiene Martín; falta cargar el pago a Y del 25/09…"
          style={{ width: '100%', padding: '8px 10px', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }} />
      </div>
    </div>
  )
}
