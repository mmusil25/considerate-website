import Link from 'next/link'

export const navItems = [
  {
    label: 'Schedule a free intro call',
    href: 'https://meet.consideratesystems.com/mark',
    shortcut: ['Ctrl', 'Alt', 'S'],
    key: 's',
    active: true,
    external: true,
  },
  {
    label: 'Portfolio/Past Projects',
    href: '/projects',
    shortcut: ['Ctrl', 'Alt', 'P'],
    key: 'p',
    active: false,
    external: false,
  },
  {
    label: 'Contact form',
    href: '/contact',
    shortcut: ['Ctrl', 'Alt', 'C'],
    key: 'c',
    active: false,
    external: false,
  },
  {
    label: 'Home',
    href: '/',
    shortcut: ['Ctrl', 'Alt', 'H'],
    key: 'h',
    active: false,
    external: false,
  },
] as const

const Shortcut = ({ keys }: { keys: readonly string[] }) => (
  <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
    {keys.map((k) => (
      <kbd
        key={k}
        style={{
          fontFamily: "'Work Sans', sans-serif",
          fontSize: '10px',
          padding: '1px 4px',
          border: '1px solid rgba(255,255,255,0.35)',
          borderRadius: '2px',
          lineHeight: 1.3,
          color: '#ffffff',
          backgroundColor: 'transparent',
        }}
      >
        {k}
      </kbd>
    ))}
  </div>
)

export function NavMenu({ variant = 'horizontal' }: { variant?: 'horizontal' | 'stacked' }) {
  if (variant === 'stacked') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '200px' }}>
        {navItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            target={item.external ? '_blank' : undefined}
            rel={item.external ? 'noopener noreferrer' : undefined}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '5px',
              padding: '7px 10px',
              backgroundColor: item.active ? '#185FA5' : '#2C2C2A',
              color: '#ffffff',
              textDecoration: 'none',
            }}
          >
            <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '12px', lineHeight: 1 }}>
              {item.label}
            </span>
            <Shortcut keys={item.shortcut} />
          </Link>
        ))}
      </div>
    )
  }

  // horizontal: label left, shortcuts right — matches Penpot design
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '276px' }}>
      {navItems.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          target={item.external ? '_blank' : undefined}
          rel={item.external ? 'noopener noreferrer' : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 8px',
            height: '32px',
            backgroundColor: item.active ? '#185FA5' : '#2C2C2A',
            color: '#ffffff',
            fontFamily: "'Work Sans', sans-serif",
            fontSize: '12px',
            textDecoration: 'none',
          }}
        >
          <span>{item.label}</span>
          <Shortcut keys={item.shortcut} />
        </Link>
      ))}
    </div>
  )
}
