'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../lib/useAuth';
import AppShellLink from './Brand';
import MobileNavigation from './MobileNavigation';
import NavIcon from './NavIcon';

export default function SiteHeader() {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();

  const mapHome = pathname === '/';
  const isAdminPage = pathname.startsWith('/admin');
  const isNavigationPage = /^\/donations\/[^/]+\/navigate$/.test(pathname);
  if (isAdminPage || isNavigationPage) return null;

  const items = [
    { href: '/', label: 'แผนที่', icon: 'map' },
    ...(!loading && user ? [{ href: '/donations/new', label: '+ เพิ่มของบริจาค', icon: 'plus' }] : []),
    ...(!loading && user?.role === 'ADMIN' ? [{ href: '/admin', label: 'Dashboard', icon: 'dashboard' }] : []),
    ...(!loading && !user ? [{ href: '/login', label: 'เข้าสู่ระบบ', icon: 'users' }] : []),
  ];

  async function handleLogout() {
    await logout();
    window.location.replace('/');
  }

  return (
    <header className={`topbar appHeader${mapHome ? ' mapTopbar' : ''}`}>
      <AppShellLink />
      <nav className="appHeaderLinks navDesktopActions" aria-label="เมนูหลัก">
        <Link href="/" className={`appHeaderLink${mapHome ? ' isActive' : ''}`} aria-current={mapHome ? 'page' : undefined}><NavIcon name="map"/>แผนที่</Link>
        {!loading && user?.role === 'ADMIN' && <Link href="/admin" className="appHeaderLink"><NavIcon name="dashboard"/>Dashboard</Link>}
      </nav>
      <div className="appHeaderActions navDesktopActions">
        {!loading && user && <Link href="/donations/new" className="appHeaderAction appHeaderAction--primary"><NavIcon name="plus"/>เพิ่มของบริจาค</Link>}
        {!loading && !user && <Link href="/login" className="appHeaderAction appHeaderAction--primary">เข้าสู่ระบบ<NavIcon name="arrow" size={17}/></Link>}
        {!loading && user && <button type="button" className="appHeaderAction appHeaderAction--subtle" onClick={handleLogout}><NavIcon name="logout" size={17}/>ออกจากระบบ</button>}
        {loading && <span className="appHeaderAuthLoading" aria-label="กำลังโหลดข้อมูลผู้ใช้"/>}
      </div>
      <MobileNavigation id="ogtb-mobile-menu" label="เมนูหลักบนมือถือ" items={items} footer={!loading && user ? <button type="button" className="appNavLogout" onClick={handleLogout}><NavIcon name="logout"/>ออกจากระบบ</button> : null}/>
    </header>
  );
}
