'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '../../lib/useAuth';
import Brand from './Brand';
import Breadcrumbs from './Breadcrumbs';
import MobileNavigation from './MobileNavigation';
import NavIcon from './NavIcon';

const ITEMS = [
  { href: '/admin', label: 'ภาพรวม', icon: 'dashboard', exact: true },
  { href: '/admin/users', label: 'ผู้ใช้', icon: 'users' },
  { href: '/admin/donations', label: 'ของบริจาค', icon: 'gift' },
  { href: '/admin/reports', label: 'รายงาน', icon: 'reports' },
];

function activeFor(pathname, item) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && (!user || user.role !== 'ADMIN')) router.replace('/');
  }, [loading, user, router]);

  async function handleLogout() {
    await logout();
    window.location.replace('/');
  }

  const currentItem = ITEMS.find((item) => activeFor(pathname, item)) || ITEMS[0];
  const detail = pathname !== currentItem.href;
  const breadcrumbs = [
    { label: 'Admin', href: pathname === '/admin' ? undefined : '/admin' },
    ...(pathname === '/admin' ? [] : [{ label: currentItem.label, href: detail ? currentItem.href : undefined }]),
    ...(detail ? [{ label: 'รายละเอียด' }] : []),
  ];
  const mobileItems = ITEMS.map(({ href, label, icon, exact }) => ({ href, label, icon, matchChildren: !exact }));

  return (
    <>
      <header className="topbar adminPortTopbar appAdminHeader">
        <Brand admin href="/admin"/>
        <div className="appAdminContext"><Breadcrumbs items={breadcrumbs}/><strong>{currentItem.label}</strong></div>
        <nav className="appAdminHeaderActions navDesktopActions" aria-label="เมนู Admin">
          <Link href="/" className="appHeaderAction appHeaderAction--subtle"><NavIcon name="map"/>กลับไปแผนที่</Link>
          {!loading && user?.role === 'ADMIN' && <button type="button" className="appHeaderAction appHeaderAction--subtle" onClick={handleLogout}><NavIcon name="logout"/>ออกจากระบบ</button>}
        </nav>
        <MobileNavigation id="admin-mobile-actions" label="เมนู Admin บนมือถือ" items={[...mobileItems, { href: '/', label: 'กลับไปแผนที่', icon: 'map' }]} footer={!loading && user?.role === 'ADMIN' ? <button type="button" className="appNavLogout" onClick={handleLogout}><NavIcon name="logout"/>ออกจากระบบ</button> : null}/>
      </header>

      <aside className="appAdminSidebar" aria-label="แถบเมนูผู้ดูแล">
        <div className="appAdminSidebarHeading"><span className="appAdminSidebarEyebrow">ADMIN CONSOLE</span><strong>จัดการระบบบริจาค</strong></div>
        <nav className="appAdminSidebarLinks" aria-label="ส่วนจัดการระบบ">
          {ITEMS.map((item) => {
            const active = activeFor(pathname, item);
            return <Link key={item.href} href={item.href} className={`appAdminSidebarLink${active ? ' isActive' : ''}`} aria-current={active ? 'page' : undefined}><NavIcon name={item.icon}/><span>{item.label}</span>{active && <span className="appAdminSidebarActiveDot" aria-hidden="true"/>}</Link>;
          })}
        </nav>
        <div className="appAdminSidebarFooter">
          <span className="appAdminRoleMark"><NavIcon name="users" size={16}/></span>
          <span><strong>Administrator</strong><small>OGTB Donation Map</small></span>
        </div>
      </aside>
    </>
  );
}
