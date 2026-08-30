'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Board, Box, Cart } from '@/components/icons';

const LINKS = [
  { href: '/', label: 'Week Board', icon: Board, match: (p) => p === '/' },
  { href: '/recipes', label: 'Recipe Box', icon: Box, match: (p) => p.startsWith('/recipes'), countKey: 'recipes' },
  { href: '/market', label: 'Market List', icon: Cart, match: (p) => p.startsWith('/market'), countKey: 'market' },
];

export default function NavLinks({ counts }) {
  const pathname = usePathname();
  return (
    <nav className="nav">
      {LINKS.map(({ href, label, icon: Icon, match, countKey }) => (
        <Link key={href} href={href} className={`nav-item${match(pathname) ? ' active' : ''}`}>
          <Icon size={16} />
          <span className="nav-label">{label}</span>
          {countKey && counts[countKey] > 0 ? <span className="nav-count">{counts[countKey]}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
