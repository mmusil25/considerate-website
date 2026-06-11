import Link from 'next/link'

export const navItems = [
  {
    label: 'Schedule a call',
    href: 'https://meet.consideratesystems.com/mark',
    shortcut: ['Ctrl', 'Alt', 'S'],
    key: 's',
    active: true,
    external: true,
  },
  {
    label: 'Past Projects',
    href: '/projects',
    shortcut: ['Ctrl', 'Alt', 'P'],
    key: 'p',
    active: false,
    external: false,
  },
  {
    label: 'Services',
    href: '/services',
    shortcut: ['Ctrl', 'Alt', 'V'],
    key: 'v',
    active: false,
    external: false,
  },
  {
    label: 'About Mark',
    href: '/about',
    shortcut: ['Ctrl', 'Alt', 'A'],
    key: 'a',
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

const BORDER_RADIUS = '5px'

export function NavMenu({ variant = 'horizontal' }: { variant?: 'horizontal' | 'stacked' }) {
  if (variant === 'stacked') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '140px' }}>
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
              borderRadius: BORDER_RADIUS,
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '220px' }}>
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
            borderRadius: BORDER_RADIUS,
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
