'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AdminNav from '../../../components/common/AdminNav';
import { api } from '../../../lib/api';

export default function AdminReportsPage() {
  const [reports, setReports] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/admin/reports')
      .then(setReports)
      .catch((requestError) => setError(requestError.message || 'โหลด Reports ไม่สำเร็จ'));
  }, []);

  return (
    <main className="adminPage">
      <AdminNav />
      <section className="adminContent">
        <div className="adminHeading">
          <div>
            <span>ADMIN</span>
            <h1>Reports</h1>
          </div>
          <p>ตรวจสอบรายงานจากผู้ใช้และจัดการโพสต์ที่มีปัญหา</p>
        </div>

        {error && <div className="adminError">{error}</div>}

        <div className="adminTableWrap">
          <table className="adminTable">
            <thead>
              <tr>
                <th>เหตุผล</th>
                <th>Donation</th>
                <th>Reporter</th>
                <th>สถานะ</th>
                <th>วันที่</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td>{report.reason}</td>
                  <td>
                    <strong>{report.donation?.title || '-'}</strong>
                    <small>{report.donation?.owner?.name || ''}</small>
                  </td>
                  <td>{report.reporter?.name || '-'}</td>
                  <td>
                    <span className={`statusPill ${report.status === 'PENDING' ? 'isPending' : 'isActive'}`}>
                      {report.status}
                    </span>
                  </td>
                  <td>{new Date(report.createdAt).toLocaleDateString('th-TH')}</td>
                  <td><Link className="adminRowLink" href={`/admin/reports/${report.id}`}>ดูรายละเอียด →</Link></td>
                </tr>
              ))}
              {reports.length === 0 && (
                <tr><td colSpan="6">ไม่พบ Report</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
