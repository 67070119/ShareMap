'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import AdminNav from '../../../../components/common/AdminNav';
import { api, assetUrl } from '../../../../lib/api';
import { formatBangkokDate } from '../../../../lib/date';

export default function AdminDonationDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [donation, setDonation] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

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
    if (!donation || !window.confirm(`ลบโพสต์ “${donation.title}” ออกจากระบบใช่หรือไม่`)) return;
    setBusy('delete');
    setError('');
    try {
      await api(`/api/admin/donations/${id}`, { method: 'DELETE' });
      router.replace('/admin/donations');
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
            <h1>Donation Detail</h1>
          </div>
          <Link href="/admin/donations" className="adminRowLink">← กลับ Donations</Link>
        </div>

        {error && <div className="adminError">{error}</div>}
        {!donation && !error && <p>กำลังโหลด...</p>}

        {donation && (
          <div className="adminReportDetail">
            <section>
              <div className="adminDetailTitleRow">
                <div>
                  <span className={`statusPill ${donation.isHidden ? 'isSuspended' : 'isActive'}`}>
                    {donation.isHidden ? 'HIDDEN' : 'VISIBLE'}
                  </span>
                  <h2>{donation.title}</h2>
                </div>
                <span className="donationStatus">{donation.status}</span>
              </div>

              {donation.images?.length > 0 && (
                <div className="adminDonationGallery">
                  {donation.images.map((image) => (
                    <img key={image.id} src={assetUrl(image.imageUrl)} alt={donation.title} />
                  ))}
                </div>
              )}

              <p>{donation.description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
              <dl className="adminDetailGrid">
                <div><dt>ประเภท</dt><dd>{donation.category}</dd></div>
                <div><dt>จำนวน</dt><dd>{donation.quantity}</dd></div>
                <div><dt>วันที่เริ่ม</dt><dd>{formatBangkokDate(donation.startDate)}</dd></div>
                <div><dt>วันที่สิ้นสุด</dt><dd>{formatBangkokDate(donation.endDate)}</dd></div>
                <div><dt>จุดรับของ</dt><dd>{donation.address || '-'}</dd></div>
                <div><dt>พิกัด</dt><dd>{donation.latitude}, {donation.longitude}</dd></div>
              </dl>
            </section>

            <section>
              <h2>เจ้าของโพสต์</h2>
              <dl className="adminDetailGrid">
                <div><dt>ชื่อ</dt><dd>{donation.owner?.name || '-'}</dd></div>
                <div><dt>Email</dt><dd>{donation.owner?.email || '-'}</dd></div>
                <div><dt>สถานะบัญชี</dt><dd>{donation.owner?.isActive ? 'ACTIVE' : 'SUSPENDED'}</dd></div>
                <div><dt>Reports</dt><dd>{donation._count?.reports ?? 0}</dd></div>
              </dl>
            </section>

            <section>
              <h2>Reports ของ Donation นี้</h2>
              {donation.reports?.length ? (
                <div className="adminDonationReports">
                  {donation.reports.map((report) => (
                    <Link key={report.id} href={`/admin/reports/${report.id}`} className="adminDonationReportItem">
                      <div>
                        <strong>{report.reason}</strong>
                        <span>{report.reporter?.name || '-'} · {report.status}</span>
                      </div>
                      <span>ดูรายละเอียด →</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p>ยังไม่มี Report สำหรับโพสต์นี้</p>
              )}
            </section>

            <div className="adminReportActions">
              <button type="button" className="adminSecondaryButton" onClick={toggleVisibility} disabled={Boolean(busy)}>
                {donation.isHidden ? 'แสดง Donation' : 'ซ่อน Donation'}
              </button>
              <button type="button" className="adminDangerButton" onClick={removeDonation} disabled={Boolean(busy)}>
                ลบ Donation
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
