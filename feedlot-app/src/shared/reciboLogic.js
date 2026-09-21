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

// Numeración correlativa — un solo contador para TODOS los recibos de la
// app, sin importar desde qué módulo se generen. Cada vez que se abre un
// recibo para imprimir, se pide el próximo número (nunca se repite, aunque
// se cierre sin imprimir — como una numeradora de facturero real).
export async function siguienteNumeroRecibo(supabase) {
  const { data, error } = await supabase.rpc('siguiente_numero_recibo')
  if (error) { console.error('Error al pedir el número de recibo:', error); return null }
  return data
}

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

// ─── Orden de pago (formato "rico", con sello de no válido como factura,
// tabla de medios de pago detallada, y monto en letras) — mismo diseño en
// todos los módulos que emiten este tipo de recibo (Gastos, Activos, etc.)

const UNIDADES_LETRAS = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE']
const DECENAS_LETRAS = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
const CENTENAS_LETRAS = ['', 'CIEN', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']

function numeroALetras(num) {
  if (num === 0) return 'CERO'
  if (num < 0) return 'MENOS ' + numeroALetras(-num)
  let resultado = ''
  if (num >= 1000000) {
    const mill = Math.floor(num / 1000000)
    resultado += (mill === 1 ? 'UN MILLÓN ' : numeroALetras(mill) + ' MILLONES ')
    num %= 1000000
  }
  if (num >= 1000) {
    const miles = Math.floor(num / 1000)
    resultado += (miles === 1 ? 'MIL ' : numeroALetras(miles) + ' MIL ')
    num %= 1000
  }
  if (num >= 100) {
    if (num === 100) resultado += 'CIEN '
    else resultado += CENTENAS_LETRAS[Math.floor(num / 100)] + ' '
    num %= 100
  }
  if (num >= 20) {
    resultado += DECENAS_LETRAS[Math.floor(num / 10)]
    if (num % 10 > 0) resultado += ' Y ' + UNIDADES_LETRAS[num % 10]
    resultado += ' '
  } else if (num > 0) {
    resultado += UNIDADES_LETRAS[num] + ' '
  }
  return resultado.trim()
}

export function montoEnLetras(monto) {
  const entero = Math.floor(monto)
  const centavos = Math.round((monto - entero) * 100)
  let texto = numeroALetras(entero) + ' PESOS'
  if (centavos > 0) texto += ' CON ' + numeroALetras(centavos) + ' CENTAVOS'
  return texto + '.-'
}

// pagos: array de { tipo, monto, subtipo_cheque, cheque_propio: {numero,banco,fecha_vencimiento}, cheque_tercero_detalle: [{numero,banco,fecha_vencimiento,monto}], es_paralelo }
export async function generarOrdenDePago(supabase, { destinatario, domicilio, localidad, cuit, iva, cbu, fecha, concepto, pagos, notaPie }) {
  const numero = await siguienteNumeroRecibo(supabase)
  const fechaStr = fecha ? new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : new Date().toLocaleDateString('es-AR')
  const totalMonto = (pagos || []).reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)

  const filasPago = (pagos || []).flatMap(p => {
    let descBase = p.tipo === 'transferencia' ? 'TRANSFERENCIA' :
               p.tipo === 'efectivo' ? 'EFECTIVO' :
               p.tipo === 'cuenta_corriente' ? 'CUENTA CORRIENTE' :
               p.subtipo_cheque === 'propio' ? 'E-CHEQ PROPIO' :
               'E-CHEQ TERCERO'
    if (p.es_paralelo) descBase += ' (C2)'
    if (p.subtipo_cheque === 'tercero' && p.cheque_tercero_detalle?.length > 0) {
      return p.cheque_tercero_detalle.map(c => `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #ddd;">${descBase}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:center;">#${c.numero || '—'} · ${c.banco || '—'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:center;">${c.fecha_vencimiento ? new Date(c.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR') : '—'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:right;font-weight:600;">$ ${parseFloat(c.monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
      </tr>`)
    }
    const nro = p.subtipo_cheque === 'propio' ? `${p.cheque_propio?.numero || ''} · ${p.cheque_propio?.banco || ''}`.trim().replace(/^·\s*/, '') : ''
    const fechaCobro = p.subtipo_cheque === 'propio' ? (p.cheque_propio?.fecha_vencimiento ? new Date(p.cheque_propio.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR') : '') : ''
    return [`<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #ddd;">${descBase}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:center;">${nro}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:center;">${fechaCobro}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:right;font-weight:600;">$ ${parseFloat(p.monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
    </tr>`]
  }).join('')

  const bloqueRecibo = `
    <div style="border:1px solid #333;padding:20px;font-family:Arial,sans-serif;font-size:12px;width:100%;box-sizing:border-box;">
      <table style="width:100%;margin-bottom:10px;">
        <tr>
          <td style="width:33%;vertical-align:top;">
            <div style="font-weight:bold;">Pedro Barciocco 1221</div>
            <div>TEL: 3574-442656</div>
            <div style="margin-top:8px;border:1px solid #333;display:inline-block;padding:2px 6px;font-weight:bold;">X &nbsp; NO VALIDO COMO FACTURA</div>
            <div style="font-size:11px;margin-top:2px;">Orden de pago</div>
          </td>
          <td style="width:34%;text-align:center;vertical-align:middle;">
            <div style="font-size:22px;font-weight:900;letter-spacing:1px;">RAMONDA</div>
            <div style="font-size:14px;font-weight:600;">HNOS S.A.</div>
          </td>
          <td style="width:33%;text-align:right;vertical-align:top;">
            <div>CUIT: &nbsp;30-71682182-6</div>
            <div>I.V.A. &nbsp;Responsable inscripto</div>
            <div style="margin-top:6px;font-weight:bold;">N° ${numero ? String(numero).padStart(6, '0') : '—'}</div>
          </td>
        </tr>
      </table>
      <hr style="border:1px solid #333;margin:8px 0;">
      <table style="width:100%;border:1px solid #333;margin-bottom:0;">
        <tr><td colspan="2" style="padding:4px 8px;font-weight:bold;background:#f5f5f5;">Entrego a:</td></tr>
        <tr>
          <td style="padding:4px 8px;width:50%;">Nombre: <strong>${destinatario || ''}</strong></td>
          <td style="padding:4px 8px;">I.V.A.: ${iva || ''}</td>
        </tr>
        <tr>
          <td style="padding:4px 8px;">Domicilio: ${domicilio || ''}</td>
          <td style="padding:4px 8px;">CUIT/DNI: ${cuit || ''}</td>
        </tr>
        <tr>
          <td style="padding:4px 8px;">Localidad: ${localidad || ''}</td>
          <td style="padding:4px 8px;"></td>
        </tr>
        <tr>
          <td style="padding:4px 8px;">C.B.U: ${cbu || ''}</td>
          <td style="padding:4px 8px;">FECHA &nbsp;<strong>${fechaStr}</strong></td>
        </tr>
      </table>
      <table style="width:100%;border:1px solid #333;border-top:none;border-collapse:collapse;">
        <tr><td colspan="4" style="padding:4px 8px;font-weight:bold;background:#f5f5f5;border-bottom:1px solid #333;">Medio de pago</td></tr>
        <tr style="background:#eee;">
          <th style="padding:6px 8px;text-align:left;border-bottom:1px solid #333;font-size:11px;">DESCRIPCIÓN</th>
          <th style="padding:6px 8px;text-align:center;border-bottom:1px solid #333;font-size:11px;">NRO/CHEQUE</th>
          <th style="padding:6px 8px;text-align:center;border-bottom:1px solid #333;font-size:11px;">FECHA DE COBRO</th>
          <th style="padding:6px 8px;text-align:right;border-bottom:1px solid #333;font-size:11px;">IMPORTE</th>
        </tr>
        ${filasPago}
        <tr style="height:30px;"><td colspan="4"></td></tr>
        <tr style="border-top:1px solid #333;">
          <td colspan="3" style="padding:8px;text-align:right;font-weight:bold;">IMPORTE TOTAL A COBRAR &nbsp; $</td>
          <td style="padding:8px;text-align:right;font-weight:bold;">${totalMonto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
        </tr>
      </table>
      <table style="width:100%;border:1px solid #333;border-top:none;border-collapse:collapse;">
        <tr><td style="padding:4px 8px;font-weight:bold;border-bottom:1px solid #ddd;background:#f5f5f5;">Concepto:</td></tr>
        <tr><td style="padding:6px 8px;">
          <strong>${concepto || ''}</strong><br>
          ${notaPie || 'Observación: RAMONDA HNOS S.A. no se responsabiliza por el vencimiento de cheques/e-cheq de terceros.'}<br>
          Cantidad de pesos: &nbsp;${montoEnLetras(totalMonto)}
        </td></tr>
        <tr><td style="padding:20px 8px 30px 8px;">&nbsp;</td></tr>
        <tr>
          <td style="padding:8px;">
            <table style="width:100%;"><tr>
              <td style="width:40%;text-align:center;border-top:1px solid #333;">Firma</td>
              <td style="width:20%;"></td>
              <td style="width:40%;text-align:center;border-top:1px solid #333;">DNI</td>
            </tr></table>
          </td>
        </tr>
      </table>
    </div>`

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Recibo - ${destinatario || ''}</title>
  <style>
    @page { size: A4; margin: 10mm; }
    @media print {
      html, body { margin: 0; padding: 0; height: auto; }
      .no-print { display: none; }
      .recibo { page-break-inside: avoid; break-inside: avoid; }
    }
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #fff; font-size: 12px; }
    table { font-size: 12px; }
    .recibo { margin-bottom: 14px; }
    .corte { border-top: 2px dashed #999; margin: 10px 0; text-align: center; font-size: 10px; color: #999; padding: 3px 0; }
  </style>
</head>
<body>
  <div style="text-align:right;margin-bottom:10px;" class="no-print">
    <button onclick="window.print()" style="padding:8px 20px;font-size:14px;cursor:pointer;background:#1A3D6B;color:#fff;border:none;border-radius:6px;margin-right:8px;">🖨️ Imprimir / Guardar PDF</button>
    <button id="btnDescargarPdf" style="padding:8px 20px;font-size:14px;cursor:pointer;background:#2E7D46;color:#fff;border:none;border-radius:6px;">⬇️ Descargar PDF (para WhatsApp)</button>
  </div>
  <div id="contenedor" style="transform-origin: top left;">
    <div class="recibo">${bloqueRecibo}</div>
    <div class="corte">✂ &nbsp;&nbsp; CORTAR AQUÍ &nbsp;&nbsp; ✂</div>
    <div class="recibo">${bloqueRecibo}</div>
  </div>
  <!-- Una sola copia, fuera de pantalla — es la que se captura para el PDF
       de WhatsApp (no tiene sentido mandar la doble copia pensada para
       cortar en papel). -->
  <div id="soloParaPdf" style="position:absolute;left:-9999px;top:0;width:190mm;">${bloqueRecibo}</div>
  <script>
    window.onload = function() {
      var el = document.getElementById('contenedor');
      var maxHeight = 277 * 3.7795;
      var actualHeight = el.scrollHeight;
      if (actualHeight > maxHeight) {
        var scale = maxHeight / actualHeight;
        el.style.zoom = scale;
      }
    };
    function cargarScript(src) {
      return new Promise(function(resolve, reject) {
        var s = document.createElement('script');
        s.src = src; s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    document.getElementById('btnDescargarPdf').onclick = async function() {
      var btn = this;
      var textoOriginal = btn.textContent;
      btn.textContent = 'Generando...'; btn.disabled = true;
      try {
        if (!window.html2canvas) await cargarScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
        if (!window.jspdf) await cargarScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        var nodo = document.getElementById('soloParaPdf');
        var canvas = await html2canvas(nodo, { scale: 2, backgroundColor: '#ffffff' });
        var { jsPDF } = window.jspdf;
        var pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        var imgWidth = 190;
        var imgHeight = canvas.height * imgWidth / canvas.width;
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, 10, imgWidth, imgHeight);
        pdf.save('Recibo${numero ? ' ' + String(numero).padStart(6, '0') : ''}.pdf');
      } catch (e) {
        alert('No se pudo generar el PDF: ' + e.message);
      }
      btn.textContent = textoOriginal; btn.disabled = false;
    };
  </script>
</body>
</html>`

  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
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
    .firma-line{flex:1;margin-top:50px;border-top:1px solid #999;padding-top:6px;font-size:10px;color:#9E9A94}
    .no-print{text-align:center;margin-top:12px} @media print{.no-print{display:none}}
  </style></head><body>
    <div class="hoja">${copia1}${copia2}</div>
    <div class="no-print"><button onclick="window.print()" style="padding:8px 16px;background:#1A3D6B;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">🖨 Imprimir</button></div>
  </body></html>`
}

export async function abrirReciboDoble(supabase, params) {
  const numero = await siguienteNumeroRecibo(supabase)
  const html = generarReciboDobleHTML({ ...params, numero: numero ? String(numero).padStart(6, '0') : params.numero })
  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
}
