// Componentes UI compartidos — sin imports de otros módulos del proyecto

var S_UI = {
  bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6',
  text: '#1A1916', muted: '#6B6760', hint: '#9E9A94',
  accent: '#1A3D6B', accentLight: '#E8EFF8',
  green: '#1E5C2E', greenLight: '#E8F4EB',
  amber: '#7A4500', amberLight: '#FDF0E0',
  red: '#7A1A1A', redLight: '#FDF0F0',
  purple: '#3D1A6B', purpleLight: '#F0EAFB',
}

export function Loader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem', color: S_UI.muted, fontSize: 13 }}>
      Cargando...
    </div>
  )
}

export function Btn({ children, onClick, variant = 'ghost', size = 'md', disabled }) {
  const base = { borderRadius: 6, fontFamily: "'IBM Plex Sans', sans-serif", cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 500, border: '1px solid', transition: 'all .15s', opacity: disabled ? 0.6 : 1 }
  const variants = {
    ghost:   { background: 'transparent', borderColor: S_UI.border, color: S_UI.muted, padding: size === 'sm' ? '5px 10px' : '8px 16px', fontSize: size === 'sm' ? 12 : 13 },
    primary: { background: S_UI.accent, borderColor: S_UI.accent, color: '#fff', padding: size === 'sm' ? '5px 10px' : '8px 16px', fontSize: size === 'sm' ? 12 : 13 },
    green:   { background: S_UI.green, borderColor: S_UI.green, color: '#fff', padding: size === 'sm' ? '5px 10px' : '8px 16px', fontSize: size === 'sm' ? 12 : 13 },
    red:     { background: S_UI.redLight, borderColor: '#F09595', color: S_UI.red, padding: size === 'sm' ? '5px 10px' : '8px 16px', fontSize: size === 'sm' ? 12 : 13 },
  }
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant] }}>{children}</button>
}

export function Card({ children, style = {} }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E2DDD6', borderRadius: 10, padding: '1.25rem', marginBottom: '1rem', ...style }}>
      {children}
    </div>
  )
}

const BADGE_STYLES = {
  ok:      { background: '#E8F4EB', color: '#1E5C2E' },
  warn:    { background: '#FDF0E0', color: '#7A4500' },
  red:     { background: '#FDF0F0', color: '#7A1A1A' },
  info:    { background: '#E8EFF8', color: '#1A3D6B' },
  purple:  { background: '#F0EAFB', color: '#3D1A6B' },
  neutral: { background: '#F7F5F0', color: '#6B6760', border: '1px solid #E2DDD6' },
}

export function Badge({ children, type = 'neutral', style = {} }) {
  return (
    <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600, ...BADGE_STYLES[type], ...style }}>
      {children}
    </span>
  )
}
