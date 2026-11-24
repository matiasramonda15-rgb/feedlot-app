// ─────────────────────────────────────────────────────────────────────────────
// Orden de carga de la pulverizadora
//
// En las órdenes de pulverización y en el plan de tanques los productos se
// listan de arriba para abajo en el orden en que se cargan a la máquina,
// según la formulación (la recomendación habitual, con la máquina por la
// mitad o 3/4 de agua y el agitador andando):
//
//   1. Correctores de agua (sulfato de amonio, secuestrantes, reguladores de pH, antiespumantes)
//   2. Sólidos: WG / WP / SG (granulados y polvos)
//   3. Suspensiones: SC / flow / ZC / OD
//   4. Emulsionables: EC / EW
//   5. Solubles: SL (glifosato líquido, paraquat, dicamba, imazapir…)
//   6. Aceites y tensioactivos (siliconados, adherentes, antideriva)
//   …y al final se completa con agua.
//
// La formulación se guarda en cada producto (stock_agro.formulacion) y se
// puede cambiar en Agricultura → Stock → editar. Si un producto no la tiene
// cargada, se adivina por el nombre, el tipo y la unidad (kg = sólido).
// ─────────────────────────────────────────────────────────────────────────────

export const FORMULACIONES = [
  { id: 'corrector', paso: 1, nombre: 'Corrector de agua / compatibilizador', corto: 'Corrector' },
  { id: 'solido',    paso: 2, nombre: 'Sólido (WG / WP / SG)', corto: 'WG/WP' },
  { id: 'sc',        paso: 3, nombre: 'Suspensión (SC / flow / OD)', corto: 'SC' },
  { id: 'ec',        paso: 4, nombre: 'Emulsionable (EC / EW)', corto: 'EC' },
  { id: 'sl',        paso: 5, nombre: 'Soluble (SL)', corto: 'SL' },
  { id: 'aceite',    paso: 6, nombre: 'Aceite / tensioactivo / adherente', corto: 'Coadyuvante' },
]
const POR_ID = Object.fromEntries(FORMULACIONES.map(f => [f.id, f]))

const sinAcentos = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Adivina la formulación cuando el producto no la tiene cargada
export function adivinarFormulacion(item) {
  if (!item) return null
  const n = sinAcentos(item.insumo), t = sinAcentos(item.tipo), u = sinAcentos(item.unidad)
  if (/sulfato de amonio|corrector|secuestr|acondicion|regulador|\bph\b|antiespum/.test(n)) return 'corrector'
  if (/\b(wg|wp|sg|df|wdg)\b|granulad|polvo|solido/.test(n) || u === 'kg') return 'solido'
  if (/\b(sc|fs|zc|od|cs)\b|flow|suspens/.test(n)) return 'sc'
  if (/\b(ec|ew|me)\b|ester|emulsion|aceite|oil/.test(n) && !/coadyuv/.test(t)) return 'ec'
  if (/\b(sl)\b|liquido|soluble|amina|sal\b/.test(n)) return 'sl'
  if (/coadyuv/.test(t)) return 'aceite'
  if (/insectic|fungic/.test(t)) return 'sc'   // la mayoría vienen en SC
  return 'sl'
}

export const formulacionDe = item => (item?.formulacion && POR_ID[item.formulacion]) ? item.formulacion : adivinarFormulacion(item)
export const infoFormulacion = item => POR_ID[formulacionDe(item)] || null

// Devuelve los productos de la orden ordenados para cargar (copia; no toca el
// orden guardado). Dentro del mismo paso respeta el orden en que se cargaron.
export function ordenarPorCarga(productos, stockAgro) {
  const item = p => (stockAgro || []).find(s => String(s.id) === String(p.id))
  return (productos || [])
    .map((p, i) => ({ p, i, paso: infoFormulacion(item(p))?.paso ?? 9 }))
    .sort((a, b) => a.paso - b.paso || a.i - b.i)
    .map(x => x.p)
}
