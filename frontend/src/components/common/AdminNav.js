'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '../../lib/useAuth';

const items = [
  ['Dashboard', '/admin'],
  ['Users', '/admin/users'],
  ['Donations', '/admin/donations'],
  ['Reports', '/admin/reports'],
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && (!user || user.role !== 'ADMIN')) router.replace('/');
  }, [loading, user, router]);

  async function handleLogout() {
    await logout();
    router.replace('/');
  }

  return (
    <nav className="adminNav" aria-label="Admin navigation">
      <Link href="/" className="adminBackLink">← Map</Link>
      {items.map(([label, href]) => (
        <Link key={href} href={href} className={pathname === href ? 'isActive' : ''}>{label}</Link>
      ))}
      {!loading && user?.role === 'ADMIN' && <button type="button" className="adminLogoutButton" onClick={handleLogout}>ออกจากระบบ</button>}
    </nav>
  );
}
