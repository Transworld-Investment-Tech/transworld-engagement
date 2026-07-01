'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wordmark } from './Wordmark';

export function TopBar() {
  const pathname = usePathname();

  const isArchive = pathname?.startsWith('/research/archive') ?? false;
  const isThisWeek = !isArchive; // /research and /research/[slug] both read as This Week

  const links: Array<{
    href: '/research' | '/research/archive';
    label: string;
    active: boolean;
  }> = [
    { href: '/research', label: 'This Week', active: isThisWeek },
    { href: '/research/archive', label: 'Archive', active: isArchive },
  ];

  return (
    <header
      style={{
        background: '#FAF7F2',
        borderBottom: '1px solid #E8DFD0',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/research" style={{ textDecoration: 'none' }}>
          <Wordmark size="md" />
        </Link>
        <nav className="flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-4 py-2 rounded-full font-body text-sm transition"
              style={{
                background: link.active ? '#0A1F44' : 'transparent',
                color: link.active ? '#FAF7F2' : '#0A1F44',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
