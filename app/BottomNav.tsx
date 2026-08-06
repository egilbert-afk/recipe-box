'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/recipes', label: 'My Recipes' },
  { href: '/discover', label: 'Discover' },
  { href: '/add', label: 'Add' },
  { href: '/archive', label: 'Archive' },
]

export default function BottomNav() {
  const pathname = usePathname()

  const show =
    pathname === '/recipes' ||
    (pathname.startsWith('/recipes/') && !pathname.endsWith('/cook')) ||
    pathname === '/discover' ||
    pathname === '/add' ||
    pathname === '/archive'

  if (!show) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200">
      <div className="flex max-w-lg mx-auto">
        {tabs.map(({ href, label }) => {
          const active =
            href === '/recipes'
              ? pathname === '/recipes' || pathname.startsWith('/recipes/')
              : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 flex items-center justify-center h-14 text-sm font-medium ${
                active ? 'text-black' : 'text-gray-400'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
