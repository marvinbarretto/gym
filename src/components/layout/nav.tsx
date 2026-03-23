'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './nav.module.scss'

const NAV_ITEMS = [
  { href: '/chat', label: 'Chat' },
  { href: '/sessions', label: 'Sessions' },
  { href: '/settings', label: 'Settings' },
]

export default function Nav() {
  const pathname = usePathname()

  return (
    <nav className={styles.nav}>
      {NAV_ITEMS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={`${styles.item} ${pathname.startsWith(href) ? styles.active : ''}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
