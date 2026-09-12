'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AdminNav from '../../components/common/AdminNav';
import { api } from '../../lib/api';

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api('/api/admin/users'),
      api('/api/admin/donations'),
      api('/api/admin/reports'),
    ])
      .then(([users, donations, reports]) => {
        setSummary({
          users: users.length,
          donations: donations.length,
          reports: reports.length,
          pendingReports: reports.filter((report) => report.status === 'PENDING').length,
        });
      })
      .catch((requestError) => setError(requestError.message || 'โหลด Dashboard ไม่สำเร็จ'));
  }, []);

  return (
    <main className="adminPage">
      <AdminNav />
      <section className="adminContent">
        <div className="adminHeading">
          <div>
            <span>ADMIN</span>
            <h1>Dashboard</h1>
          </div>
          <p>จัดการผู้ใช้ โพสต์บริจาค และรายงานในระบบ</p>
        </div>

        {error && <div className="adminError">{error}</div>}

        {!error && !summary && <p>กำลังโหลด...</p>}

        {summary && (
          <div className="adminStatGrid">
            <Link href="/admin/users" className="adminStatCard">
              <span>Users</span>
              <strong>{summary.users}</strong>
            </Link>
            <Link href="/admin/donations" className="adminStatCard">
              <span>Donations</span>
              <strong>{summary.donations}</strong>
            </Link>
            <Link href="/admin/reports" className="adminStatCard">
              <span>Reports</span>
              <strong>{summary.reports}</strong>
              <small>{summary.pendingReports} รอตรวจสอบ</small>
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
