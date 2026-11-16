'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AdminNav from '../../components/common/AdminNav';
import NavIcon from '../../components/common/NavIcon';
import { AdminPageHeading, AdminSectionHeading } from '../../components/admin/AdminUI';
import { api } from '../../lib/api';

const SECTIONS = [
  { href: '/admin/users', icon: 'users', label: 'บัญชีผู้ใช้', description: 'ดูผู้ใช้ บทบาท และเปิดหรือระงับบัญชี' },
  { href: '/admin/donations', icon: 'gift', label: 'โพสต์บริจาค', description: 'ดูรายการทั้งหมด รวมถึงโพสต์ที่ถูกซ่อน' },
  { href: '/admin/reports', icon: 'reports', label: 'รายงานปัญหา', description: 'ตรวจสอบรายงานและดำเนินการกับโพสต์' },
];

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([api('/api/admin/users'), api('/api/admin/donations'), api('/api/admin/reports')])
      .then(([users, donations, reports]) => {
        if (!active) return;
        setSummary({
          users: users.length, donations: donations.length, reports: reports.length,
          pendingReports: reports.filter((report) => report.status === 'PENDING').length,
        });
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'โหลด Dashboard ไม่สำเร็จ');
      });
    return () => { active = false; };
  }, []);

  const kpis = summary ? [
    { label: 'ผู้ใช้ทั้งหมด', value: summary.users, icon: 'users', href: '/admin/users', note: 'บัญชีที่ลงทะเบียน', tone: 'cyan' },
    { label: 'โพสต์ของบริจาค', value: summary.donations, icon: 'gift', href: '/admin/donations', note: 'โพสต์ในระบบ', tone: 'blue' },
    { label: 'รายงานทั้งหมด', value: summary.reports, icon: 'reports', href: '/admin/reports', note: 'รายงานจากชุมชน', tone: 'violet' },
    { label: 'รอตรวจสอบ', value: summary.pendingReports, icon: 'reports', href: '/admin/reports', note: 'รายการที่ยังไม่ปิด', tone: 'amber' },
  ] : [];

  return <div className="adminPortShell adminModernShell">
    <AdminNav/>
    <main className="page adminPortPage adminModernPage adminDashboardPage">
      <AdminPageHeading title="ภาพรวมระบบ" section="ADMIN CONSOLE / OVERVIEW" icon="dashboard"
        description="ติดตามการทำงานของชุมชนและเข้าถึงเครื่องมือดูแลระบบได้จากที่เดียว"/>
      {error && <div className="errorBox adminModernAlert" role="alert">{error}</div>}
      {!error && !summary && <div className="adminDashboardKpis" role="status" aria-label="กำลังโหลด Dashboard">
        {Array.from({length:4},(_,i)=><div className="adminKpiCard adminKpiSkeleton" key={i}><span>กำลังโหลดข้อมูล...</span><div className="ui-skeleton"/></div>)}
      </div>}

      {summary && <>
        <section className="adminDashboardSection" aria-labelledby="admin-summary-heading">
          <AdminSectionHeading eyebrow="LIVE SYSTEM SNAPSHOT" title="ภาพรวมข้อมูล" icon="dashboard"/>
          <div className="adminDashboardKpis" id="admin-summary-heading">
            {kpis.map((kpi) => <Link key={kpi.label} href={kpi.href} className={`adminKpiCard adminKpiCard--${kpi.tone}`}>
              <div className="adminKpiCardTop"><span>{kpi.label}</span><span className="adminKpiIcon"><NavIcon name={kpi.icon} size={20}/></span></div>
              <strong>{kpi.value}</strong>
              <div className="adminKpiBottom"><small>{kpi.note}</small><NavIcon name="arrow" size={17}/></div>
            </Link>)}
          </div>
        </section>
        <div className="adminDashboardLower">
          <section className="card adminModernPanel adminQuickActions">
            <AdminSectionHeading eyebrow="QUICK ACCESS" title="ทางลัดการจัดการ" icon="dashboard"/>
            <div className="adminQuickActionList">
              {SECTIONS.map((section) => <Link key={section.href} href={section.href} className="adminQuickAction">
                <span className="adminQuickActionIcon"><NavIcon name={section.icon} size={21}/></span>
                <span><strong>{section.label}</strong><small>{section.description}</small></span>
                <NavIcon name="arrow" size={18}/>
              </Link>)}
            </div>
          </section>
          <aside className="adminDashboardFocus">
            <span className="adminDashboardFocusIcon"><NavIcon name="reports" size={24}/></span>
            <small>MODERATION QUEUE</small>
            <strong>{summary.pendingReports} รายการ</strong>
            <p>{summary.pendingReports ? 'มีรายงานที่รอตรวจสอบจากผู้ใช้ในระบบ' : 'ไม่มีรายงานค้างตรวจสอบในขณะนี้'}</p>
            <Link href="/admin/reports" className="button"><NavIcon name="arrow" size={17}/>ไปหน้ารายงาน</Link>
          </aside>
        </div>
      </>}
    </main>
  </div>;
}
