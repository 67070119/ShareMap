'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import AdminNav from '../../../../components/common/AdminNav';
import { api } from '../../../../lib/api';

export default function AdminReportDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    let active = true;
    api(`/api/admin/reports/${id}`)
      .then((result) => { if (active) setReport(result); })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'โหลด Report ไม่สำเร็จ');
      });
    return () => { active = false; };
  }, [id]);

  async function resolveReport() {
    setBusy('report');
    setError('');
    try {
      setReport(await api(`/api/admin/reports/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'RESOLVED' }),
      }));
    } catch (requestError) {
      setError(requestError.message || 'อัปเดต Report ไม่สำเร็จ');
    } finally {
      setBusy('');
    }
  }

  async function hideDonation() {
    if (!report?.donation) return;
    setBusy('donation');
    setError('');
    try {
      const updated = await api(`/api/admin/donations/${report.donation.id}/visibility`, {
        method: 'PATCH',
        body: JSON.stringify({ isHidden: true }),
      });
      setReport((current) => ({ ...current, donation: { ...current.donation, ...updated } }));
    } catch (requestError) {
      setError(requestError.message || 'ซ่อน Donation ไม่สำเร็จ');
    } finally {
      setBusy('');
    }
  }

  async function suspendOwner() {
    const owner = report?.donation?.owner;
    if (!owner) return;
    setBusy('owner');
    setError('');
    try {
      const updated = await api(`/api/admin/users/${owner.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: false }),
      });
      setReport((current) => ({
        ...current,
        donation: {
          ...current.donation,
          owner: { ...current.donation.owner, isActive: updated.isActive },
        },
      }));
    } catch (requestError) {
      setError(requestError.message || 'ระงับบัญชีไม่สำเร็จ');
    } finally {
      setBusy('');
    }
  }

  async function deleteDonation() {
    if (!report?.donation || !window.confirm('ลบ Donation นี้ออกจากระบบใช่หรือไม่')) return;
    setBusy('delete');
    setError('');
    try {
      await api(`/api/admin/donations/${report.donation.id}`, { method: 'DELETE' });
      router.replace('/admin/reports');
    } catch (requestError) {
      setError(requestError.message || 'ลบ Donation ไม่สำเร็จ');
      setBusy('');
    }
  }

  return (
    <main className="adminPage">
      <AdminNav />
      <section className="adminContent">
        <div className="adminHeading">
          <div>
            <span>ADMIN</span>
            <h1>Report Detail</h1>
          </div>
          <Link href="/admin/reports" className="adminRowLink">← กลับ Reports</Link>
        </div>

        {error && <div className="adminError">{error}</div>}
        {!report && !error && <p>กำลังโหลด...</p>}

        {report && (
          <div className="adminReportDetail">
            <section>
              <h2>ข้อมูล Report</h2>
              <dl className="adminDetailGrid">
                <div><dt>เหตุผล</dt><dd>{report.reason}</dd></div>
                <div><dt>สถานะ</dt><dd>{report.status}</dd></div>
                <div><dt>ผู้รายงาน</dt><dd>{report.reporter?.name || '-'}</dd></div>
                <div><dt>Email</dt><dd>{report.reporter?.email || '-'}</dd></div>
              </dl>
              <p>{report.description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
            </section>

            <section>
              <h2>Donation ที่ถูกรายงาน</h2>
              <dl className="adminDetailGrid">
                <div><dt>ชื่อ</dt><dd>{report.donation?.title || '-'}</dd></div>
                <div><dt>ประเภท</dt><dd>{report.donation?.category || '-'}</dd></div>
                <div><dt>เจ้าของ</dt><dd>{report.donation?.owner?.name || '-'}</dd></div>
                <div><dt>สถานะเจ้าของ</dt><dd>{report.donation?.owner?.isActive ? 'ACTIVE' : 'SUSPENDED'}</dd></div>
              </dl>
              {report.donation && (
                <Link href={`/donations/${report.donation.id}`} className="adminRowLink">เปิด Donation →</Link>
              )}
            </section>

            <div className="adminReportActions">
              <button type="button" className="adminSecondaryButton" onClick={hideDonation} disabled={busy || report.donation?.isHidden}>
                {report.donation?.isHidden ? 'ซ่อนอยู่แล้ว' : 'ซ่อน Donation'}
              </button>
              <button type="button" className="adminDangerButton" onClick={suspendOwner} disabled={busy || !report.donation?.owner?.isActive}>
                {report.donation?.owner?.isActive ? 'ระงับเจ้าของโพสต์' : 'เจ้าของถูกระงับแล้ว'}
              </button>
              <button type="button" className="adminDangerButton" onClick={deleteDonation} disabled={busy}>ลบ Donation</button>
              <button type="button" className="adminPrimaryButton" onClick={resolveReport} disabled={busy || report.status === 'RESOLVED'}>
                {report.status === 'RESOLVED' ? 'ตรวจสอบแล้ว' : 'ปิด Report'}
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
