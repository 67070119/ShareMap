'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import AdminNav from '../../../../components/common/AdminNav';
import { api } from '../../../../lib/api';
import { formatBangkokDate } from '../../../../lib/date';
import DonationGallery from '../../../../components/donation/DonationGallery';
import { AdminPageHeading, AdminStatus, AdminConfirmDialog } from '../../../../components/admin/AdminUI';

export default function AdminDonationDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [donation, setDonation] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [deletePending, setDeletePending] = useState(false);

  useEffect(() => {
    let active = true;
    api(`/api/admin/donations/${id}`)
      .then((result) => {
        if (active) {
          setDonation(result);
          setError('');
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'โหลด Donation ไม่สำเร็จ');
      });
    return () => { active = false; };
  }, [id]);

  async function toggleVisibility() {
    if (!donation) return;
    setBusy('visibility');
    setError('');
    try {
      const updated = await api(`/api/admin/donations/${id}/visibility`, {
        method: 'PATCH',
        body: JSON.stringify({ isHidden: !donation.isHidden }),
      });
      setDonation((current) => ({ ...current, ...updated }));
    } catch (requestError) {
      setError(requestError.message || 'อัปเดตการมองเห็นโพสต์ไม่สำเร็จ');
    } finally {
      setBusy('');
    }
  }

  async function removeDonation() {
    if (!donation || busy) return;
    setBusy('delete');
    setError('');
    try {
      await api(`/api/admin/donations/${id}`, { method: 'DELETE' });
      setDeletePending(false);
      router.replace('/admin/donations');
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
        <AdminPageHeading title={donation?.title || 'รายละเอียดโพสต์'} section="ADMIN / DONATION DETAIL"
          icon="gift" description={donation ? `${donation.category} · เจ้าของ ${donation.owner?.name || '-'}` : 'ข้อมูลโพสต์บริจาค'}
          back={{ href: '/admin/donations', label: 'กลับรายการโพสต์' }}/>

        {error && <div className="errorBox adminModernAlert" role="alert">{error}</div>}
        {!donation && !error && <div className="centerState adminPortLoading">กำลังโหลด Donation...</div>}

        {donation && (
          <div className="adminModernDetailLayout">
            <section className="card adminModernPanel adminDetailPrimary">
              <div className="pointSectionHeading">
                <div><span>ข้อมูลโพสต์</span><h3>{donation.title}</h3></div>
                <div className="adminPortChips">
                  <AdminStatus value={donation.isHidden ? 'HIDDEN' : 'VISIBLE'}/>
                  <AdminStatus value={donation.status}/>
                </div>
              </div>

              <div className="adminModernGallery">
                <DonationGallery images={donation.images || []} title={donation.title}/>
              </div>

              <p className="adminPortDescription">{donation.description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
              <div className="metaGrid adminPortMetaGrid">
                <div className="metaItem"><span>ประเภท</span><strong>{donation.category}</strong></div>
                <div className="metaItem"><span>จำนวน</span><strong>{donation.quantity}</strong></div>
                <div className="metaItem"><span>วันที่เริ่ม</span><strong>{formatBangkokDate(donation.startDate)}</strong></div>
                <div className="metaItem"><span>วันที่สิ้นสุด</span><strong>{formatBangkokDate(donation.endDate)}</strong></div>
                <div className="metaItem adminPortMetaWide"><span>จุดรับของ</span><strong>{donation.address || '-'}</strong></div>
              </div>
            </section>

            <section className="card adminModernPanel adminDetailSecondary">
              <div className="pointSectionHeading"><div><span>เจ้าของโพสต์</span><h3>{donation.owner?.name || '-'}</h3></div></div>
              <div className="metaGrid adminPortMetaGrid">
                <div className="metaItem"><span>Email</span><strong>{donation.owner?.email || '-'}</strong></div>
                <div className="metaItem"><span>สถานะบัญชี</span><strong>{donation.owner?.isActive ? 'ACTIVE' : 'SUSPENDED'}</strong></div>
                <div className="metaItem"><span>Reports</span><strong>{donation._count?.reports ?? 0}</strong></div>
              </div>
            </section>

            <section className="card adminModernPanel adminDetailSecondary">
              <div className="pointSectionHeading"><div><span>การรายงาน</span><h3>Reports ของ Donation นี้</h3></div></div>
              <div className="adminPortList">
                {donation.reports?.length ? donation.reports.map((report) => (
                  <Link key={report.id} href={`/admin/reports/${report.id}`} className="historyItem adminPortHistoryLink">
                    <strong>{report.reason}</strong>
                    <small>{report.reporter?.name || '-'} · {report.status}</small>
                    <span>ดูรายละเอียด →</span>
                  </Link>
                )) : <div className="empty">ยังไม่มี Report สำหรับโพสต์นี้</div>}
              </div>
            </section>

            <section className="card adminModernPanel adminDetailSecondary">
              <div className="pointSectionHeading"><div><span>การจัดการ</span><h3>จัดการ Donation</h3></div></div>
              <div className="sectionActions">
                <button type="button" className="button" onClick={toggleVisibility} disabled={Boolean(busy)}>
                  {busy === 'visibility' ? 'กำลังบันทึก...' : donation.isHidden ? 'แสดง Donation' : 'ซ่อน Donation'}
                </button>
                <button type="button" className="button danger" onClick={() => setDeletePending(true)} disabled={Boolean(busy)}>
                  {busy === 'delete' ? 'กำลังลบ...' : 'ลบ Donation'}
                </button>
              </div>
            </section>
          </div>
        )}
        <AdminConfirmDialog intent={deletePending} busy={Boolean(busy)} destructive
          title="ยืนยันลบโพสต์?" message={donation ? `โพสต์ “${donation.title}” จะถูกลบถาวรและไม่สามารถกู้คืนได้` : ''}
          actionLabel="ยืนยันลบโพสต์" onCancel={() => setDeletePending(false)} onConfirm={removeDonation}/>
      </main>
    </div>
  );
}
