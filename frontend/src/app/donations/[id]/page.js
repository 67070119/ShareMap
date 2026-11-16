'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { canNavigateToDonation } from '../../../lib/donationAvailability';
import { formatBangkokDate } from '../../../lib/date';
import { useAuth } from '../../../lib/useAuth';
import NavIcon from '../../../components/common/NavIcon';
import DonationGallery from '../../../components/donation/DonationGallery';
import DonationConfirmDialog from '../../../components/donation/DonationConfirmDialog';

const STATUS_LABELS = {
  AVAILABLE: 'พร้อมรับ',
  OUT_OF_STOCK: 'ของหมดแล้ว',
  EXPIRED: 'หมดช่วงบริจาค',
};

export default function DonationDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedReturnTo = searchParams.get('returnTo');
  const mapBackHref = requestedReturnTo?.startsWith('/') && !requestedReturnTo.startsWith('//')
    ? requestedReturnTo
    : '/';
  const { user } = useAuth();
  const [donation, setDonation] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmIntent, setConfirmIntent] = useState(null);
  const reported = searchParams.get('reported') === '1';

  useEffect(() => {
    let active = true;
    api(`/api/donations/${id}`)
      .then((result) => {
        if (!active) return;
        setDonation(result);
        setError('');
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'โหลดข้อมูลไม่สำเร็จ');
      });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (!reported) return;
    const cleaned = new URLSearchParams(searchParams.toString());
    cleaned.delete('reported');
    const query = cleaned.toString();
    window.history.replaceState(
      window.history.state, '',
      query ? `/donations/${id}?${query}` : `/donations/${id}`,
    );
  }, [id, reported, searchParams]);

  async function confirmOwnerAction() {
    if (busy || !confirmIntent) return;
    const intent = confirmIntent;
    setBusy(true);
    setError('');
    try {
      if (intent === 'out-of-stock') {
        setDonation(await api(`/api/donations/${id}/out-of-stock`, { method: 'PATCH' }));
        setConfirmIntent(null);
      } else if (intent === 'delete') {
        await api(`/api/donations/${id}`, { method: 'DELETE' });
        setConfirmIntent(null);
        router.replace('/');
      }
    } catch (requestError) {
      setError(requestError.message || (intent === 'delete' ? 'ลบโพสต์ไม่สำเร็จ' : 'เปลี่ยนสถานะไม่สำเร็จ'));
      setConfirmIntent(null);
    } finally {
      setBusy(false);
    }
  }

  if (error && !donation) {
    return <main className="page narrow pointDetailPage donationDetailExperience">
      <div className="errorBox" role="alert">{error}</div>
      <Link href={mapBackHref} className="button"><NavIcon name="arrow" size={16}/>กลับแผนที่</Link>
    </main>;
  }

  if (!donation) return <main className="centerState" role="status">กำลังโหลดรายละเอียด...</main>;

  const canNavigate = canNavigateToDonation(donation);
  const isOwner = user?.id === donation.ownerId;
  const reportHref = user ? `/donations/${id}/report` : `/login?next=/donations/${id}/report`;
  const statusLabel = STATUS_LABELS[donation.status] || donation.status;

  return (
    <main className="page pointDetailPage donationDetailExperience">
      <nav className="pointBreadcrumbs" aria-label="เส้นทางหน้าเว็บ">
        <Link href={mapBackHref}>สำรวจแผนที่</Link><NavIcon name="chevron" size={15}/>
        <span aria-current="page">รายละเอียดของบริจาค</span>
      </nav>
      <header className="pointDetailHeader">
        <div className="pointDetailTitle">
          <span className="eyebrow">OGTB DONATION / รายละเอียดของบริจาค</span>
          <h1>{donation.title}</h1>
          <p><NavIcon name="users" size={16}/> บริจาคโดย {donation.owner?.name || 'ผู้ใช้ OGTB'} · เปิดถึง {formatBangkokDate(donation.endDate)}</p>
        </div>
        <Link href={mapBackHref} className="button pointBackButton"><NavIcon name="map" size={17}/>กลับแผนที่</Link>
      </header>

      {error && <div className="errorBox pointDetailNotice" role="alert">{error}</div>}
      {reported && <div className="successBox pointDetailNotice" role="status">
        <NavIcon name="check" size={19}/> ส่งรายงานให้ Admin ตรวจสอบแล้ว
      </div>}

      <section className="card pointHeroCard">
        <DonationGallery images={donation.images || []} title={donation.title}/>

        <div className="pointHeroContent">
          <div className="pointHeroTopline">
            <span className="pointSeenBadge"><NavIcon name="gift" size={14}/>{donation.category}</span>
            <span className={`pointStatusBadge pointStatusBadge--${donation.status?.toLowerCase()}`}>
              <span className="pointStatusDot" aria-hidden="true"/>{statusLabel}
            </span>
          </div>

          <span className="pointInfoEyebrow">AVAILABLE ITEMS / ข้อมูลสิ่งของ</span>
          <h2><span className="pointQuantityNumber">{donation.quantity}</span> ชิ้น</h2>
          <p className="pointDescription">{donation.description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>

          <div className="pointMetaGrid">
            <div className="pointMetaItem"><NavIcon name="map" size={17}/><span>จุดรับของ</span><strong>{donation.address || 'ตำแหน่งบนแผนที่'}</strong></div>
            <div className="pointMetaItem"><NavIcon name="calendar" size={17}/><span>เริ่มบริจาค</span><strong>{formatBangkokDate(donation.startDate)}</strong></div>
            <div className="pointMetaItem"><NavIcon name="calendar" size={17}/><span>สิ้นสุด</span><strong>{formatBangkokDate(donation.endDate)}</strong></div>
          </div>

          {canNavigate ? (
            <Link href={`/donations/${id}/navigate`} className="button primary block pointNavigateButton">
              <NavIcon name="map" size={19}/>นำทางไปจุดนี้<NavIcon name="arrow" size={18}/>
            </Link>
          ) : (
            <div className="pointAvailabilityHint" role="status">
              <NavIcon name="reports" size={17}/> ยังไม่สามารถนำทางไปจุดนี้ได้ในสถานะปัจจุบัน
            </div>
          )}
        </div>
      </section>

      <div className="pointActionGrid">
        <section className="card pointInfoCard">
          <div className="pointSectionHeading"><div>
            <span>POST INFORMATION</span><h3>รายละเอียดการรับของ</h3>
          </div><NavIcon name="gift" size={21}/></div>
          <div className="pointDetailList">
            <div><span>ผู้บริจาค</span><strong>{donation.owner?.name || '-'}</strong></div>
            <div><span>ประเภท</span><strong>{donation.category}</strong></div>
            <div><span>สถานะ</span><strong>{statusLabel}</strong></div>
          </div>
        </section>

        <section className="card pointManageCard">
          <div className="pointSectionHeading"><div>
            <span>{isOwner ? 'YOUR DONATION' : 'COMMUNITY SAFETY'}</span>
            <h3>{isOwner ? 'การจัดการของบริจาค' : 'พบข้อมูลมีปัญหา?'}</h3>
          </div><NavIcon name={isOwner ? 'gift' : 'reports'} size={21}/></div>
          {isOwner ? (
            <div className="pointManageActions">
              <Link href={`/donations/${id}/edit`} className="button soft"><NavIcon name="edit" size={17}/>แก้ไขโพสต์</Link>
              {donation.status === 'AVAILABLE' && (
                <button type="button" className="button soft" disabled={busy} onClick={() => setConfirmIntent('out-of-stock')}>
                  <NavIcon name="check" size={17}/>ของหมดแล้ว
                </button>
              )}
              <button type="button" className="button danger" disabled={busy} onClick={() => setConfirmIntent('delete')}>
                <NavIcon name="reports" size={17}/>ลบโพสต์
              </button>
            </div>
          ) : (
            <>
              <p className="pointManageCopy">หากโพสต์มีข้อมูลหลอกลวง สิ่งของอันตราย หรือเนื้อหาไม่เหมาะสม สามารถส่งให้ Admin ตรวจสอบได้</p>
              <Link href={reportHref} className="button pointReportButton"><NavIcon name="reports" size={17}/>รายงานโพสต์</Link>
            </>
          )}
        </section>
      </div>
      <DonationConfirmDialog intent={confirmIntent} busy={busy}
        onCancel={() => { if (!busy) setConfirmIntent(null); }}
        onConfirm={confirmOwnerAction}/>
    </main>
  );
}
