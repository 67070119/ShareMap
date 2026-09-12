'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, assetUrl } from '../../../lib/api';
import { formatBangkokDate } from '../../../lib/date';
import { canNavigateToDonation } from '../../../lib/donationAvailability';
import { useAuth } from '../../../lib/useAuth';

export default function DonationDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [donation, setDonation] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    let active = true;
    api(`/api/donations/${id}`)
      .then((result) => {
        if (active) {
          setDonation(result);
          setError('');
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'โหลดข้อมูลไม่สำเร็จ');
      });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setReported(new URLSearchParams(window.location.search).get('reported') === '1');
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  async function markOutOfStock() {
    if (!window.confirm('ยืนยันว่าของหมดแล้ว? จุดนี้จะไม่แสดงบน Map')) return;
    setBusy(true);
    try {
      setDonation(await api(`/api/donations/${id}/out-of-stock`, { method: 'PATCH' }));
    } catch (requestError) {
      setError(requestError.message || 'เปลี่ยนสถานะไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  async function removeDonation() {
    if (!window.confirm('ลบโพสต์บริจาคนี้ถาวรหรือไม่?')) return;
    setBusy(true);
    try {
      await api(`/api/donations/${id}`, { method: 'DELETE' });
      router.replace('/');
    } catch (requestError) {
      setError(requestError.message || 'ลบโพสต์ไม่สำเร็จ');
      setBusy(false);
    }
  }

  if (error && !donation) return <main className="detailPage"><div className="detailCard"><p>{error}</p><Link href="/">กลับไปหน้า Map</Link></div></main>;
  if (!donation) return <main className="detailPage"><div className="detailCard"><p>กำลังโหลด...</p></div></main>;

  const canNavigate = canNavigateToDonation(donation);
  const isOwner = user?.id === donation.ownerId;
  const reportHref = user ? `/donations/${id}/report` : `/login?next=/donations/${id}/report`;

  return (
    <main className="detailPage">
      <article className="detailCard">
        <Link href="/" className="backLink">← กลับไปหน้า Map</Link>
        {reported && <div className="reportSuccess">ส่งรายงานให้ Admin ตรวจสอบแล้ว</div>}
        {error && <div className="formError">{error}</div>}

        {donation.images?.length > 0 && (
          <div className="donationGallery">
            {donation.images.map((image) => <img key={image.id} src={assetUrl(image.imageUrl)} alt={donation.title} />)}
          </div>
        )}

        <div className="detailStatusRow">
          <span className="detailCategory">{donation.category}</span>
          <span className={`donationStatus ${donation.status.toLowerCase()}`}>{donation.status}</span>
        </div>
        <h1>{donation.title}</h1>
        {donation.description && <p>{donation.description}</p>}
        <dl className="detailGrid">
          <div><dt>จำนวน</dt><dd>{donation.quantity}</dd></div>
          <div><dt>ผู้บริจาค</dt><dd>{donation.owner?.name || '-'}</dd></div>
          <div><dt>จุดรับของ</dt><dd>{donation.address || `${donation.latitude}, ${donation.longitude}`}</dd></div>
          <div><dt>บริจาคถึง</dt><dd>{formatBangkokDate(donation.endDate)}</dd></div>
        </dl>

        <div className="detailActions">
          {canNavigate && <Link href={`/donations/${id}/navigate`} className="navigateAction">นำทางไปจุดบริจาค</Link>}
          {isOwner ? (
            <>
              <Link href={`/donations/${id}/edit`} className="reportAction">แก้ไขโพสต์</Link>
              {donation.status === 'AVAILABLE' && <button type="button" className="ownerStockButton" disabled={busy} onClick={markOutOfStock}>ของหมดแล้ว</button>}
              <button type="button" className="ownerDeleteButton" disabled={busy} onClick={removeDonation}>ลบโพสต์</button>
            </>
          ) : (
            <Link href={reportHref} className="reportAction">รายงานโพสต์</Link>
          )}
        </div>
      </article>
    </main>
  );
}
