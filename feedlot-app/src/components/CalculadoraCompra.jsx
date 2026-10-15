import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Calculadora de compra (Ingresos → 🧮)
//
// Parte de los MISMOS promedios que el cuadro "Ganancia esperada por lote de
// compra" de Reportes (que los guarda en configuracion → parametros_feedlot):
// precio y peso de venta, GDP, costo diario de alimento+sanidad y de
// estructura (mano de obra + gastos), flete y peso/precio promedio de compra.
// Se cambia el peso y el precio de compra (o cualquier parámetro) y muestra
// días de engorde, ganancia por animal, rentabilidad y rentabilidad anual,
// el precio máximo a pagar y una tabla peso × precio con la rentabilidad.
// ─────────────────────────────────────────────────────────────────────────────

const S = {
  bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6', text: '#1A1916', muted: '#6B6760', hint: '#9E9A94',
  accent: '#1A3D6B', accentLight: '#E8EFF8', green: '#1E5C2E', greenLight: '#E8F4EB',
  red: '#7A1A1A', redLight: '#FDF0F0', amber: '#7A4500', amberLight: '#FDF0E0',
}
const n = v => { const x = parseFloat(String(v ?? '').replace(',', '.')); return isNaN(x) ? 0 : x }
const $ = v => (v < 0 ? '−$' : '$') + Math.abs(Math.round(v)).toLocaleString('es-AR')
const pct = (v, d = 1) => v == null || !isFinite(v) ? '—' : `${(v * 100).toFixed(d)}%`

const CAMPOS = [
  { grupo: 'Compra', color: S.accent, items: [
    { k: 'pesoCompra', label: 'Peso de compra', unidad: 'kg', paso: 5 },
    { k: 'precioCompraKg', label: 'Precio de compra', unidad: '$/kg', paso: 50, ayuda: 'por kg de ingreso (balanza), sin IVA, con gastos de feria' },
    { k: 'fleteAnimal', label: 'Flete de compra', unidad: '$/animal' },
    { k: 'comisionCompra', label: 'Comisión de compra', unidad: '%', ayuda: 'solo si no está ya en el precio' },
  ] },
  { grupo: 'Venta', color: S.green, items: [
    { k: 'pesoVenta', label: 'Peso de venta', unidad: 'kg desbastado' },
    { k: 'precioVentaKg', label: 'Precio de venta neto', unidad: '$/kg desbastado', ayuda: 'sin IVA ni comisión' },
  ] },
  { grupo: 'Engorde', color: S.amber, items: [
    { k: 'gdp', label: 'Aumento diario (GDP)', unidad: 'kg/día', paso: 0.05 },
    { k: 'conversion', label: 'Conversión', unidad: 'kg MS / kg carne', paso: 0.1, ayuda: 'kg de materia seca por kg ganado' },
    { k: 'precioMS', label: 'Costo del alimento', unidad: '$/kg MS', ayuda: 'promedio de la dieta, en materia seca' },
    { k: 'costoSanidadDia', label: 'Sanidad', unidad: '$/animal/día' },
    { k: 'costoFijoDia', label: 'Estructura (sueldos + gastos)', unidad: '$/animal/día' },
  ] },
]

function calcular(p, pesoCompra, precioCompraKg) {
  const com = n(p.comisionCompra) / 100
  const compra = pesoCompra * precioCompraKg * (1 + com)
  const flete = n(p.fleteAnimal)
  const gdp = n(p.gdp)
  const dias = gdp > 0 ? Math.max(0, (n(p.pesoVenta) - pesoCompra) / gdp) : 0
  // Alimento: consumo diario = conversión × GDP (kg MS), por su costo. Si
  // mejora la conversión, baja el consumo y el costo de engordar cada kilo.
  const usaConversion = n(p.conversion) > 0 && n(p.precioMS) > 0
  const consumoMS = usaConversion ? n(p.conversion) * gdp : null
  const alimentoDia = usaConversion ? consumoMS * n(p.precioMS) : n(p.costoAlimDia)
  const engorde = dias * (alimentoDia + n(p.costoSanidadDia) + n(p.costoFijoDia))
  const ingreso = n(p.pesoVenta) * n(p.precioVentaKg)
  const inversion = compra + flete + engorde
  const ganancia = ingreso - inversion
  const rentab = inversion > 0 ? ganancia / inversion : null
  const anual = rentab != null && dias >= 1 ? rentab * 365 / dias : null
  const divisor = pesoCompra * (1 + com)
  const precioEquilibrio = divisor > 0 ? (ingreso - flete - engorde) / divisor : null
  const objetivo = n(p.objetivo) / 100
  const invObjetivo = ingreso / (1 + objetivo * dias / 365)
  const precioObjetivo = divisor > 0 ? (invObjetivo - flete - engorde) / divisor : null
  return { compra, flete, dias, engorde, ingreso, inversion, ganancia, rentab, anual, precioEquilibrio, precioObjetivo, consumoMS, alimentoDia, usaConversion }
}

// Color de la celda según la rentabilidad anual
function colorAnual(a) {
  if (a == null) return { bg: S.surface, fg: S.hint }
  if (a < 0) return { bg: '#F6D5D5', fg: S.red }
  if (a < 0.10) return { bg: '#FBEBD2', fg: S.amber }
  if (a < 0.25) return { bg: '#E3F1E6', fg: S.green }
  return { bg: '#C9E6CF', fg: S.green }
}

export default function CalculadoraCompra() {
  const [base, setBase] = useState(null)       // promedios guardados por Reportes
  const [p, setP] = useState(null)             // parámetros en edición (strings)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    supabase.from('configuracion').select('valor').eq('clave', 'parametros_feedlot').maybeSingle().then(({ data }) => {
      let b = null
      try { b = data?.valor ? JSON.parse(data.valor) : null } catch { b = null }
      setBase(b)
      if (b) setP(desdeBase(b))
      setCargando(false)
    })
  }, [])

  function desdeBase(b) {
    return {
      pesoCompra: String(b.pesoCompra || 180), precioCompraKg: String(b.precioCompraKg || ''),
      fleteAnimal: String(b.fleteAnimal || 0), comisionCompra: '0',
      pesoVenta: String(b.pesoVenta || ''), precioVentaKg: String(b.precioVentaKg || ''),
      gdp: String(b.gdp || ''), costoFijoDia: String(b.costoFijoDia || ''),
      // Conversión y costo del kg de MS: el costo se calibra para que, con la
      // conversión y el GDP promedio, dé exactamente el costo diario real de
      // alimento. (Si los promedios guardados son viejos y no traen la
      // conversión, se usa el costo diario directo.)
      ...(b.conversion && b.costoAlimentoDia != null && b.gdp
        ? { conversion: String(b.conversion), precioMS: String(Math.round(b.costoAlimentoDia / (b.conversion * b.gdp))), costoSanidadDia: String(b.costoSanidadDia || 0), costoAlimDia: '' }
        : { conversion: '', precioMS: '', costoSanidadDia: '0', costoAlimDia: String(b.costoAlimDia || '') }),
      objetivo: '25',
    }
  }

  if (cargando) return <div style={{ padding: 20, color: S.hint }}>Cargando promedios…</div>
  if (!base || !p) return (
    <div style={{ background: S.amberLight, border: `1px solid ${S.amber}`, borderRadius: 10, padding: 16, color: S.amber, fontSize: 13 }}>
      Todavía no hay promedios calculados. Abrí <b>Reportes</b> una vez (pestaña Feedlot) y volvé: la calculadora toma de ahí los mismos números del cuadro "Ganancia esperada por lote de compra".
    </div>
  )

  const r = calcular(p, n(p.pesoCompra), n(p.precioCompraKg))
  const cambiado = JSON.stringify(p) !== JSON.stringify(desdeBase(base))
  const actualizado = base.actualizado ? new Date(base.actualizado).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

  // Tabla peso × precio
  const pesoBase = Math.round(n(p.pesoCompra) / 10) * 10
  const pesos = [-60, -40, -20, 0, 20, 40, 60].map(d => pesoBase + d).filter(x => x >= 100 && x < n(p.pesoVenta) - 30)
  const precioBase = n(p.precioCompraKg)
  const factores = [0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.15]
  const precios = factores.map(f => Math.round(precioBase * f / 50) * 50)

  const input = (c) => (
    <label key={c.k} style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: S.muted }}>
      <span>{c.label} <span style={{ color: S.hint }}>({c.unidad})</span></span>
      <input type="number" step={c.paso || 'any'} value={p[c.k]} onChange={e => setP({ ...p, [c.k]: e.target.value })}
        style={{ padding: '7px 9px', fontSize: 14, fontFamily: 'monospace', fontWeight: 600, border: `1px solid ${String(p[c.k]) !== String(desdeBase(base)[c.k]) ? S.amber : S.border}`, borderRadius: 6, background: S.surface, width: '100%', boxSizing: 'border-box' }} />
      {c.ayuda && <span style={{ fontSize: 10, color: S.hint }}>{c.ayuda}</span>}
    </label>
  )

  const tarjeta = (titulo, valor, sub, color = S.text, bg = S.surface) => (
    <div style={{ background: bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', fontWeight: 600 }}>{titulo}</div>
      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color }}>{valor}</div>
      {sub && <div style={{ fontSize: 11, color: S.hint }}>{sub}</div>}
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Calculadora de compra</div>
          <div style={{ fontSize: 12, color: S.muted, maxWidth: 760 }}>
            Arranca con los promedios reales del feedlot (los mismos del cuadro "Ganancia esperada por lote" de Reportes, al {actualizado}: {base.cabVentas} animales vendidos y {base.cabCompras} comprados en los últimos 60 días). Cambiá el peso y el precio de compra, o cualquier otro valor, y mirá cuánto se gana. Los campos que cambiaste quedan marcados en naranja.
          </div>
        </div>
        {cambiado && <button onClick={() => setP(desdeBase(base))} style={{ padding: '7px 12px', fontSize: 12, border: `1px solid ${S.border}`, borderRadius: 6, background: S.surface, color: S.muted, cursor: 'pointer' }}>↺ Volver a los promedios</button>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12, marginBottom: 14 }}>
        {CAMPOS.map(g => (
          <div key={g.grupo} style={{ background: S.surface, border: `1px solid ${S.border}`, borderTop: `3px solid ${g.color}`, borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: g.color, textTransform: 'uppercase', marginBottom: 8 }}>{g.grupo}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{g.items.map(input)}</div>
          </div>
        ))}
      </div>

      {/* Resultado */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 10 }}>
        {tarjeta('Días de engorde', `${Math.round(r.dias)} días`, `${n(p.pesoCompra)} → ${n(p.pesoVenta)} kg a ${n(p.gdp)} kg/día`)}
        {tarjeta('Alimento por día', $(r.alimentoDia), r.usaConversion ? `${r.consumoMS.toFixed(1)} kg MS/día · ${$(r.alimentoDia * n(p.conversion) / (r.consumoMS || 1))} por kg ganado` : 'costo diario promedio')}
        {tarjeta('Pongo por animal', $(r.inversion), `compra ${$(r.compra)} · flete ${$(r.flete)} · engorde ${$(r.engorde)}`)}
        {tarjeta('Vendo por animal', $(r.ingreso), `${n(p.pesoVenta)} kg × ${$(n(p.precioVentaKg))}`)}
        {tarjeta('Ganancia por animal', $(r.ganancia), `rentabilidad ${pct(r.rentab)}`, r.ganancia >= 0 ? S.green : S.red)}
        {tarjeta('Rentabilidad anual', pct(r.anual, 0), `${pct(r.rentab)} en ${Math.round(r.dias)} días`, (r.anual || 0) >= 0 ? S.green : S.red, (r.anual || 0) >= 0 ? S.greenLight : S.redLight)}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'stretch', marginBottom: 16 }}>
        <div style={{ flex: '1 1 260px', background: S.accent, color: '#fff', borderRadius: 10, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, opacity: .75, textTransform: 'uppercase' }}>Precio máximo — sin ganar ni perder</div>
          <div style={{ fontSize: 26, fontWeight: 800, fontFamily: 'monospace' }}>{r.precioEquilibrio != null ? $(r.precioEquilibrio) : '—'}<span style={{ fontSize: 13, fontWeight: 400 }}> /kg</span></div>
        </div>
        <div style={{ flex: '1 1 320px', background: S.surface, border: `2px solid ${S.accent}`, borderRadius: 10, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            Precio máximo para ganar
            <input type="number" value={p.objetivo} onChange={e => setP({ ...p, objetivo: e.target.value })} style={{ width: 54, padding: '2px 5px', fontSize: 13, fontFamily: 'monospace', fontWeight: 700, border: `1px solid ${S.border}`, borderRadius: 4 }} />
            % anual
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, fontFamily: 'monospace', color: S.accent }}>{r.precioObjetivo != null ? $(r.precioObjetivo) : '—'}<span style={{ fontSize: 13, fontWeight: 400, color: S.muted }}> /kg</span></div>
        </div>
      </div>

      {/* Tabla peso × precio */}
      <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, overflow: 'auto' }}>
        <div style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, background: S.bg }}>
          Rentabilidad anual según peso y precio de compra <span style={{ fontWeight: 400, fontSize: 11, color: S.muted }}>· el resto de los parámetros como están arriba · pasá el mouse por una celda para ver la ganancia por animal</span>
        </div>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, color: S.muted, borderBottom: `1px solid ${S.border}` }}>Peso compra</th>
              <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: 10, color: S.muted, borderBottom: `1px solid ${S.border}` }}>Días</th>
              {precios.map((pr, i) => (
                <th key={i} style={{ padding: '6px 10px', textAlign: 'right', fontSize: 11, fontFamily: 'monospace', color: factores[i] === 1 ? S.accent : S.muted, borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{$(pr)}/kg</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pesos.map(pe => {
              const dias = n(p.gdp) > 0 ? (n(p.pesoVenta) - pe) / n(p.gdp) : 0
              return (
                <tr key={pe} style={{ borderBottom: `1px solid ${S.border}` }}>
                  <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontWeight: pe === pesoBase ? 700 : 400 }}>{pe} kg</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', color: S.muted }}>{Math.round(dias)}</td>
                  {precios.map((pr, i) => {
                    const c = calcular(p, pe, pr)
                    const col = colorAnual(c.anual)
                    const marcada = pe === pesoBase && factores[i] === 1
                    return (
                      <td key={i} title={`Ganancia ${$(c.ganancia)} por animal · ${pct(c.rentab)} en ${Math.round(c.dias)} días`}
                        style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, background: col.bg, color: col.fg, outline: marcada ? `2px solid ${S.accent}` : 'none', outlineOffset: -2 }}>
                        {pct(c.anual, 0)}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
        <div style={{ padding: '8px 14px', fontSize: 11, color: S.muted }}>
          Rentabilidad = ganancia ÷ lo que se pone por animal (compra + flete + alimento y estructura de todos los días de engorde). Anual = esa rentabilidad llevada a 365 días (simple, sin capitalizar). El ternero más liviano tarda más días; la tabla usa el mismo peso de venta y el mismo costo diario para todos. Sin IVA, costo financiero, impuestos ni amortizaciones — igual que en Reportes.
        </div>
      </div>
    </div>
  )
}
