'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/dashboard', icon: 'home', label: 'Home' },
  { href: '/deals', icon: 'local_offer', label: 'Deals' },
  { href: '/opportunities', icon: 'work', label: 'Careers' },
  { href: '/wallet', icon: 'account_balance_wallet', label: 'Wallet' },
  { href: '/profile', icon: 'person', label: 'Profile' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-end px-2 bg-surface-container-lowest shadow-[0_-4px_20px_rgba(26,26,24,0.10)] border-t border-outline-variant/40">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/');
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center pb-3 pt-2 flex-1 min-w-[48px] max-w-[72px] snappy ${
              active ? 'text-ink border-b-4 border-amber' : 'text-muted hover:text-ink'
            }`}
          >
            <span className="material-symbols-outlined mb-1 text-[22px]">{item.icon}</span>
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
