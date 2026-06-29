import { useState, useEffect, Suspense, lazy } from 'react'
import { supabase } from '../supabase'
import Sidebar from './Sidebar'

var Tablero      = lazy(() => import('./Tablero'))
var Corrales     = lazy(() => import('./Corrales'))
var Ingresos     = lazy(() => import('./Ingresos'))
var Pesada       = lazy(() => import('./Pesada'))
var Ventas       = lazy(() => import('./Ventas'))
var Alimentacion = lazy(() => import('./Alimentacion'))
var Sanidad      = lazy(() => import('./Sanidad'))
var Reportes     = lazy(() => import('./Reportes'))
var Agricultura  = lazy(() => import('./Agricultura'))
var Servicios    = lazy(() => import('./Servicios'))
var Personal     = lazy(() => import('./Personal'))
var Gastos       = lazy(() => import('./Gastos'))
var Comercial    = lazy(() => import('./Comercial'))
var Contactos    = lazy(() => import('./Contactos'))
var Activos      = lazy(() => import('./Activos'))
var Insumos      = lazy(() => import('./Insumos'))

const MODULOS = {
  tablero: Tablero, corrales: Corrales, ingresos: Ingresos, pesada: Pesada,
  ventas: Ventas, alimentacion: Alimentacion, sanidad: Sanidad, reportes: Reportes,
  agricultura: Agricultura, servicios: Servicios, personal: Personal, gastos: Gastos,
  comercial: Comercial, contactos: Contactos, activos: Activos, socios: Activos, insumos: Insumos,
}

function LoadingModulo() {
  return <div style={{ padding: '3rem', textAlign: 'center', color: '#9E9A94', fontSize: 13 }}>Cargando...</div>
}

// ── PANTALLA DE INICIO ──────────────────────────────────────────────────────
function PantallaInicio({ usuario, setModulo }) {
  const [datos, setDatos] = useState(null)
  const rol = usuario?.rol || 'empleado'
  const esAdmin = rol === 'dueno' || rol === 'secretaria'

  useEffect(() => {
    async function cargar() {
      const hoy = new Date()
      const en7 = new Date(); en7.setDate(en7.getDate() + 7)
      const en7str = en7.toISOString().split('T')[0]

      const [
        { data: corrales },
        { data: alertasSan },
        { data: cheques },
        { data: cuotasPend },
        { data: lotesVenc },
        { data: cajaOf },
        { data: cajaPar },
        { data: serviciosPend },
      ] = await Promise.all([
        supabase.from('corrales').select('animales, rol').neq('rol', 'libre'),
        supabase.from('alertas').select('id').eq('resuelta', false),
        supabase.from('cheques').select('id, monto, fecha_vencimiento').eq('estado', 'en_cartera').lte('fecha_vencimiento', en7str),
        supabase.from('pagos_creditos').select('id, monto, fecha, creditos(descripcion, activos(nombre))').eq('estado', 'pendiente').lte('fecha', en7str),
        supabase.from('lotes').select('id, monto_total_con_iva, fecha_vencimiento_pago').eq('estado_pago', 'pendiente').not('fecha_vencimiento_pago', 'is', null).lte('fecha_vencimiento_pago', en7str),
        supabase.from('caja_oficial').select('tipo, monto').gte('fecha', new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0]),
        supabase.from('caja_paralela').select('tipo, monto').gte('fecha', new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0]),
        supabase.from('servicios_terceros').select('id, cliente, labor, hectareas').eq('estado_pago', 'pendiente'),
      ])

      const totalAnimales = (corrales || []).reduce((a, c) => a + (c.animales || 0), 0)
      const ingresosOf = (cajaOf || []).filter(m => m.tipo === 'ingreso').reduce((a, m) => a + (m.monto || 0), 0)
      const egresosOf = (cajaOf || []).filter(m => m.tipo === 'egreso').reduce((a, m) => a + (m.monto || 0), 0)
      const ingresosPar = (cajaPar || []).filter(m => m.tipo === 'ingreso').reduce((a, m) => a + (m.monto || 0), 0)
      const egresosPar = (cajaPar || []).filter(m => m.tipo === 'egreso').reduce((a, m) => a + (m.monto || 0), 0)

      setDatos({
        totalAnimales,
        corralesActivos: (corrales || []).filter(c => c.animales > 0).length,
        alertasSanitarias: (alertasSan || []).length,
        chequesPorVencer: cheques || [],
        cuotasPorVencer: cuotasPend || [],
        lotesVenc: lotesVenc || [],
        saldoOficial: ingresosOf - egresosOf,
        saldoParalelo: ingresosPar - egresosPar,
        serviciosPendientes: (serviciosPend || []).length,
      })
    }
    cargar()
  }, [])

  const S = {
    bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6',
    text: '#1A1916', muted: '#6B6760',
    accent: '#1A3D6B', accentLight: '#E8EFF8',
    green: '#1E5C2E', greenLight: '#E8F4EB',
    amber: '#7A4500', amberLight: '#FDF0E0',
    red: '#7A1A1A', redLight: '#FDF0F0',
  }

  const totalAlertas = datos ? (datos.chequesPorVencer.length + datos.cuotasPorVencer.length + datos.lotesVenc.length) : 0

  return (
    <div style={{ minHeight: '100vh', background: S.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: "'IBM Plex Sans', sans-serif" }}>

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <img src="/LOGO_SA.png" alt="Ramonda Hnos. S.A." style={{ maxWidth: 200, maxHeight: 100, marginBottom: 12 }}
          onError={e => { e.target.style.display = 'none' }} />
        <div style={{ fontSize: 13, color: S.muted, letterSpacing: '.08em', textTransform: 'uppercase' }}>
          Sistema de gestión · {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </div>

      {/* Dos paneles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', width: '100%', maxWidth: 1100 }}>

        {/* PANEL PRODUCTIVO */}
        <div
          onClick={() => setModulo('tablero')}
          style={{ background: S.surface, border: `2px solid ${S.accent}`, borderRadius: 16, padding: '2.5rem', cursor: 'pointer', transition: 'all .2s', position: 'relative', overflow: 'hidden' }}
          onMouseEnter={e => e.currentTarget.style.background = S.accentLight}
          onMouseLeave={e => e.currentTarget.style.background = S.surface}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: S.accent, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '1rem' }}>🐄 Área Productiva</div>
          <div style={{ fontSize: 36, fontWeight: 700, color: S.text, marginBottom: '.5rem', fontFamily: 'monospace' }}>
            {datos ? datos.totalAnimales.toLocaleString('es-AR') : '—'}
          </div>
          <div style={{ fontSize: 13, color: S.muted, marginBottom: '1.5rem' }}>
            animales en {datos?.corralesActivos || '—'} corrales activos
          </div>
          {datos && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {datos.alertasSanitarias > 0 && (
                <div style={{ padding: '8px 12px', background: S.amberLight, borderRadius: 8, fontSize: 12, color: S.amber, fontWeight: 600 }}>
                  ⚕ {datos.alertasSanitarias} alerta{datos.alertasSanitarias > 1 ? 's' : ''} sanitaria{datos.alertasSanitarias > 1 ? 's' : ''} pendiente{datos.alertasSanitarias > 1 ? 's' : ''}
                </div>
              )}
              {datos.serviciosPendientes > 0 && (
                <div style={{ padding: '8px 12px', background: S.accentLight, borderRadius: 8, fontSize: 12, color: S.accent }}>
                  📋 {datos.serviciosPendientes} servicio{datos.serviciosPendientes > 1 ? 's' : ''} por cobrar
                </div>
              )}
              {datos.alertasSanitarias === 0 && datos.serviciosPendientes === 0 && (
                <div style={{ padding: '8px 12px', background: S.greenLight, borderRadius: 8, fontSize: 12, color: S.green, fontWeight: 600 }}>
                  ✓ Todo en orden
                </div>
              )}
            </div>
          )}
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['corrales', 'ingresos', 'alimentacion', 'sanidad', 'ventas'].map(m => (
              <button key={m} onClick={e => { e.stopPropagation(); setModulo(m) }}
                style={{ padding: '5px 10px', fontSize: 11, background: 'transparent', border: `1px solid ${S.accent}`, color: S.accent, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize' }}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
          <div style={{ position: 'absolute', bottom: 12, right: 16, fontSize: 11, color: S.accent, fontWeight: 600 }}>
            Ver tablero →
          </div>
        </div>

        {/* PANEL ADMINISTRATIVO */}
        {esAdmin ? (
          <div
            onClick={() => setModulo('comercial')}
            style={{ background: S.surface, border: `2px solid ${totalAlertas > 0 ? S.red : S.green}`, borderRadius: 16, padding: '2.5rem', cursor: 'pointer', transition: 'all .2s', position: 'relative', overflow: 'hidden' }}
            onMouseEnter={e => e.currentTarget.style.background = totalAlertas > 0 ? S.redLight : S.greenLight}
            onMouseLeave={e => e.currentTarget.style.background = S.surface}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: totalAlertas > 0 ? S.red : S.green, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '1rem' }}>💼 Área Administrativa</div>

            {datos ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: '1rem' }}>
                  <div style={{ padding: '10px 12px', background: S.bg, borderRadius: 8 }}>
                    <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>Caja oficial</div>
                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: datos.saldoOficial >= 0 ? S.green : S.red }}>
                      {datos.saldoOficial >= 0 ? '+' : ''}${datos.saldoOficial.toLocaleString('es-AR')}
                    </div>
                    <div style={{ fontSize: 10, color: S.muted }}>este mes</div>
                  </div>
                  <div style={{ padding: '10px 12px', background: S.bg, borderRadius: 8 }}>
                    <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', marginBottom: 4 }}>Caja paralela</div>
                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: datos.saldoParalelo >= 0 ? S.green : S.red }}>
                      {datos.saldoParalelo >= 0 ? '+' : ''}${datos.saldoParalelo.toLocaleString('es-AR')}
                    </div>
                    <div style={{ fontSize: 10, color: S.muted }}>este mes</div>
                  </div>
                </div>

                {/* Alertas administrativas */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {datos.chequesPorVencer.length > 0 && (
                    <div style={{ padding: '8px 12px', background: S.redLight, borderRadius: 8, fontSize: 12, color: S.red, fontWeight: 600 }}>
                      🏦 {datos.chequesPorVencer.length} cheque{datos.chequesPorVencer.length > 1 ? 's' : ''} vence{datos.chequesPorVencer.length > 1 ? 'n' : ''} esta semana
                    </div>
                  )}
                  {datos.cuotasPorVencer.length > 0 && (
                    <div style={{ padding: '8px 12px', background: S.redLight, borderRadius: 8, fontSize: 12, color: S.red, fontWeight: 600 }}>
                      💳 {datos.cuotasPorVencer.length} cuota{datos.cuotasPorVencer.length > 1 ? 's' : ''} de crédito vence{datos.cuotasPorVencer.length > 1 ? 'n' : ''} esta semana
                    </div>
                  )}
                  {datos.lotesVenc.length > 0 && (
                    <div style={{ padding: '8px 12px', background: S.amberLight, borderRadius: 8, fontSize: 12, color: S.amber, fontWeight: 600 }}>
                      📦 {datos.lotesVenc.length} lote{datos.lotesVenc.length > 1 ? 's' : ''} con pago vencido
                    </div>
                  )}
                  {totalAlertas === 0 && (
                    <div style={{ padding: '8px 12px', background: S.greenLight, borderRadius: 8, fontSize: 12, color: S.green, fontWeight: 600 }}>
                      ✓ Sin vencimientos esta semana
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '1.5rem', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['comercial', 'personal', 'activos', 'gastos', 'contactos'].map(m => (
                    <button key={m} onClick={e => { e.stopPropagation(); setModulo(m) }}
                      style={{ padding: '5px 10px', fontSize: 11, background: 'transparent', border: `1px solid ${S.green}`, color: S.green, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {m === 'comercial' ? 'Caja' : m.charAt(0).toUpperCase() + m.slice(1)}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ color: S.muted, fontSize: 13 }}>Cargando...</div>
            )}
            <div style={{ position: 'absolute', bottom: 12, right: 16, fontSize: 11, color: S.green, fontWeight: 600 }}>
              Ver caja →
            </div>
          </div>
        ) : (
          // Para empleados sin acceso admin, panel simple
          <div style={{ background: S.surface, border: `2px solid ${S.border}`, borderRadius: 16, padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
            <div style={{ fontSize: 13, color: S.muted }}>Accesos rápidos</div>
            {['corrales', 'alimentacion', 'sanidad', 'pesada'].map(m => (
              <button key={m} onClick={() => setModulo(m)}
                style={{ width: '100%', padding: '10px', fontSize: 13, background: S.bg, border: `1px solid ${S.border}`, color: S.text, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bienvenida */}
      <div style={{ marginTop: '2rem', fontSize: 12, color: S.muted }}>
        Bienvenido/a, <strong>{usuario?.nombre || usuario?.email?.split('@')[0]}</strong>
      </div>
    </div>
  )
}

// ── APP PRINCIPAL ───────────────────────────────────────────────────────────
export default function AppEscritorio({ usuario, onLogout }) {
  const rol = usuario?.rol || 'empleado'
  const inicio = rol === 'dueno' || rol === 'secretaria' ? 'inicio' : 'tablero'
  const [modulo, setModulo] = useState(inicio)

  const Componente = MODULOS[modulo]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: '100vh', fontFamily: "'IBM Plex Sans', sans-serif", background: '#F7F5F0' }}>
      <Sidebar modulo={modulo} setModulo={setModulo} usuario={usuario} onLogout={onLogout} />
      <main style={{ padding: modulo === 'inicio' ? 0 : '1.75rem', overflowX: 'hidden' }}>
        {modulo === 'inicio' ? (
          <PantallaInicio usuario={usuario} setModulo={setModulo} />
        ) : Componente ? (
          <Suspense fallback={<div style={{ padding: '3rem', textAlign: 'center', color: '#9E9A94', fontSize: 13 }}>Cargando...</div>}>
            <Componente usuario={usuario} />
          </Suspense>
        ) : (
          <PantallaInicio usuario={usuario} setModulo={setModulo} />
        )}
      </main>
    </div>
  )
}
