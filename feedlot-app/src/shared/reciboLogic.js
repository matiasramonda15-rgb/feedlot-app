// Genera un recibo imprimible con DOS copias en una sola hoja A4 (una para
// quien recibe/entrega la plata, otra para la empresa) — mismo formato en
// todos los módulos que emiten recibos (Activos, Personal, etc.), para no
// tener el mismo HTML repetido y ligeramente distinto en cada archivo.
//
// Uso:
//   abrirReciboDoble({
//     titulo: 'Comprobante de Retiro',
//     numero: '000123',
//     filas: [['Socio', 'Jesus'], ['Fecha', '10/07/2026'], ...],
//     montoLabel: 'MONTO RETIRADO',
//     monto: '-$1.500.000',
//     colorMonto: '#7A1A1A',
//     firmaIzq: 'Firma socio',
//     firmaDer: 'Firma responsable',
//     etiquetaCopia1: 'Copia — Jesus',
//     etiquetaCopia2: 'Copia — Ramonda Hnos S.A.',
//   })

function copiaHTML({ titulo, numero, fecha, filas, montoLabel, monto, colorMonto, notaPie, firmaIzq, firmaDer, etiqueta }) {
  const filasHtml = filas
    .filter(([, val]) => val !== null && val !== undefined && val !== '')
    .map(([label, val]) => `<div class="row"><span class="label">${label}</span><span class="val">${val}</span></div>`)
    .join('')
  return `
    <div class="copia">
      <div class="etiqueta">${etiqueta}</div>
      <h2>${titulo} — Ramonda Hnos S.A.</h2>
      <p>Recibo N° ${numero}${fecha ? ' · ' + fecha : ''} · Emitido el ${new Date().toLocaleDateString('es-AR')}</p>
      <div class="box">${filasHtml}</div>
      <div class="montobox" style="border-color:${colorMonto || '#1A1916'}">
        ${montoLabel ? `<div style="color:#6B6760;font-size:11px;margin-bottom:3px">${montoLabel}</div>` : ''}
        <div class="monto" style="color:${colorMonto || '#1A1916'}">${monto}</div>
      </div>
      ${notaPie ? `<div class="notapie">${notaPie}</div>` : ''}
      <div class="firma">
        <div class="firma-line">${firmaIzq}</div>
        <div class="firma-line">${firmaDer}</div>
      </div>
    </div>`
}

export function generarReciboDobleHTML(params) {
  const {
    titulo, numero, fecha, filas, montoLabel, monto, colorMonto, notaPie,
    firmaIzq = 'Recibí conforme', firmaDer = 'Ramonda Hnos S.A.',
    etiquetaCopia1, etiquetaCopia2,
  } = params
  const copia1 = copiaHTML({ titulo, numero, fecha, filas, montoLabel, monto, colorMonto, notaPie, firmaIzq, firmaDer, etiqueta: etiquetaCopia1 })
  const copia2 = copiaHTML({ titulo, numero, fecha, filas, montoLabel, monto, colorMonto, notaPie, firmaIzq, firmaDer, etiqueta: etiquetaCopia2 })
  return `<!DOCTYPE html><html><head><title>${titulo}</title><style>
    @page{size:A4;margin:10mm} body{font-family:'IBM Plex Sans',Arial,sans-serif;margin:0;font-size:12px;color:#1A1916}
    .hoja{display:flex;flex-direction:column;height:277mm}
    .copia{flex:1;padding:14px 28px;box-sizing:border-box;position:relative}
    .copia:first-child{border-bottom:2px dashed #999}
    .etiqueta{position:absolute;top:8px;right:20px;font-size:10px;color:#6B6760;text-transform:uppercase;letter-spacing:.05em;border:1px solid #999;border-radius:4px;padding:2px 8px}
    h2{margin:0 0 2px;font-size:15px} p{color:#6B6760;font-size:11px;margin-bottom:10px}
    .box{border:1px solid #E2DDD6;border-radius:8px;padding:10px;margin-bottom:10px}
    .row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f0f0f0;font-size:12px}
    .row:last-child{border-bottom:none} .label{color:#6B6760} .val{font-weight:600}
    .montobox{text-align:center;padding:10px;border:2px solid;border-radius:8px;margin-bottom:14px}
    .monto{font-size:18px;font-weight:700;font-family:monospace}
    .notapie{font-size:10px;color:#6B6760;text-align:center;margin-bottom:10px}
    .firma{display:flex;gap:40px;margin-top:14px}
    .firma-line{flex:1;border-top:1px solid #ccc;padding-top:6px;font-size:10px;color:#9E9A94}
    .no-print{text-align:center;margin-top:12px} @media print{.no-print{display:none}}
  </style></head><body>
    <div class="hoja">${copia1}${copia2}</div>
    <div class="no-print"><button onclick="window.print()" style="padding:8px 16px;background:#1A3D6B;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">🖨 Imprimir</button></div>
  </body></html>`
}

export function abrirReciboDoble(params) {
  const html = generarReciboDobleHTML(params)
  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
}
