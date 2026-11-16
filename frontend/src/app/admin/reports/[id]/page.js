'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import AdminNav from '../../../../components/common/AdminNav';
import { api } from '../../../../lib/api';
import { formatBangkokDate } from '../../../../lib/date';
import { AdminPageHeading, AdminStatus, AdminConfirmDialog } from '../../../../components/admin/AdminUI';

const REASON_LABELS = {
  ILLEGAL_ITEM: 'สิ่งของผิดกฎหมาย',
  DANGEROUS_ITEM: 'ของอันตราย',
  FRAUD: 'ข้อมูลหลอกลวง',
  INAPPROPRIATE_CONTENT: 'เนื้อหาไม่เหมาะสม',
  OTHER: 'เหตุผลอื่น',
};

export default function AdminReportDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [deletePending, setDeletePending] = useState(false);

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
      const updated = await api(`/api/admin/reports/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'RESOLVED' }),
      });
      setReport((current) => ({ ...current, ...updated, donation: updated.donation ?? current.donation }));
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
    if (!report?.donation || busy) return;
    setBusy('delete');
    setError('');
    try {
      await api(`/api/admin/donations/${report.donation.id}`, { method: 'DELETE' });
      setDeletePending(false);
      router.replace('/admin/reports');
    } catch (requestError) {
      setError(requestError.message || 'ลบ Donation ไม่สำเร็จ');
      setDeletePending(false);
      setBusy('');
    }
  }

  return (
    <div className="adminPortShell">
      <AdminNav />
      <main className="page adminPortPage adminModernPage">
        <AdminPageHeading title={report ? REASON_LABELS[report.reason] || report.reason : 'รายละเอียดรายงาน'}
          section="ADMIN / REPORT REVIEW" icon="reports"
          description={report ? `รายงานเมื่อ ${formatBangkokDate(report.createdAt)} · โดย ${report.reporter?.name || '-'}` : 'กำลังโหลดข้อมูลรายงาน'}
          back={{ href: '/admin/reports', label: 'กลับรายการรายงาน' }}/>

        {error && <div className="errorBox adminModernAlert" role="alert">{error}</div>}
        {!report && !error && <div className="centerState adminPortLoading">กำลังโหลด Report...</div>}

        {report && (
          <div className="adminModernDetailLayout adminReportDetailLayout">
            <section className="card adminModernPanel adminDetailPrimary">
              <div className="pointSectionHeading">
                <div><span>ข้อมูล Report</span><h3>{REASON_LABELS[report.reason] || report.reason}</h3></div>
                <AdminStatus value={report.status}/>
              </div>
              <div className="metaGrid adminPortMetaGrid">
                <div className="metaItem"><span>เหตุผล</span><strong>{report.reason}</strong></div>
                <div className="metaItem"><span>สถานะ</span><strong>{report.status}</strong></div>
                <div className="metaItem"><span>ผู้รายงาน</span><strong>{report.reporter?.name || '-'}</strong></div>
                <div className="metaItem"><span>Email</span><strong>{report.reporter?.email || '-'}</strong></div>
              </div>
              <p className="adminPortDescription">{report.description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
            </section>

            <section className="card adminModernPanel adminDetailSecondary">
              <div className="pointSectionHeading"><div><span>โพสต์ที่เกี่ยวข้อง</span><h3>{report.donation?.title || 'Donation'}</h3></div></div>
              <div className="metaGrid adminPortMetaGrid">
                <div className="metaItem"><span>ประเภท</span><strong>{report.donation?.category || '-'}</strong></div>
                <div className="metaItem"><span>เจ้าของ</span><strong>{report.donation?.owner?.name || '-'}</strong></div>
                <div className="metaItem"><span>สถานะเจ้าของ</span><strong>{report.donation?.owner?.isActive ? 'ACTIVE' : 'SUSPENDED'}</strong></div>
                <div className="metaItem"><span>Visibility</span><strong>{report.donation?.isHidden ? 'HIDDEN' : 'VISIBLE'}</strong></div>
              </div>
              {report.donation && <div className="formActions formActionsStart"><Link href={`/admin/donations/${report.donation.id}`} className="button">เปิด Donation Detail →</Link></div>}
            </section>

            <section className="card adminModernPanel adminDetailSecondary adminPortActionCard">
              <div className="pointSectionHeading"><div><span>การจัดการ</span><h3>ดำเนินการกับ Report</h3></div></div>
              <div className="sectionActions">
                <button type="button" className="button" onClick={hideDonation} disabled={Boolean(busy) || report.donation?.isHidden}>
                  {busy === 'donation' ? 'กำลังซ่อน...' : report.donation?.isHidden ? 'ซ่อนอยู่แล้ว' : 'ซ่อน Donation'}
                </button>
                <button type="button" className="button danger" onClick={suspendOwner} disabled={Boolean(busy) || !report.donation?.owner?.isActive}>
                  {busy === 'owner' ? 'กำลังระงับ...' : report.donation?.owner?.isActive ? 'ระงับเจ้าของโพสต์' : 'เจ้าของถูกระงับแล้ว'}
                </button>
                <button type="button" className="button danger" onClick={() => setDeletePending(true)} disabled={Boolean(busy)}>{busy === 'delete' ? 'กำลังลบ...' : 'ลบ Donation'}</button>
                <button type="button" className="button primary" onClick={resolveReport} disabled={Boolean(busy) || report.status === 'RESOLVED'}>
                  {busy === 'report' ? 'กำลังบันทึก...' : report.status === 'RESOLVED' ? 'ตรวจสอบแล้ว' : 'ปิด Report'}
                </button>
              </div>
            </section>
          </div>
        )}
        <AdminConfirmDialog intent={deletePending} destructive busy={Boolean(busy)}
          title="ยืนยันลบโพสต์ถาวร?" message={report?.donation ? `โพสต์ “${report.donation.title}” จะถูกลบอย่างถาวร` : ''}
          actionLabel="ยืนยันลบโพสต์" onCancel={() => setDeletePending(false)} onConfirm={deleteDonation}/>
      </main>
    </div>
  );
}
