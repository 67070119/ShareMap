'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../../../lib/api';
import { canNavigateToDonation } from '../../../../lib/donationAvailability';

const NavigationMap = dynamic(() => import('../../../../components/map/NavigationMap'), { ssr: false });

function formatDistance(meters) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} กม.` : `${Math.round(meters)} ม.`;
}

function formatDuration(seconds) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} นาที`;
  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  return `${hours} ชม.${remain ? ` ${remain} นาที` : ''}`;
}

export default function NavigatePage() {
  const { id } = useParams();
  const [donation, setDonation] = useState(null);
  const [position, setPosition] = useState(null);
  const [route, setRoute] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api(`/api/donations/${id}`)
      .then((result) => {
        if (active) setDonation(result);
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.message || 'โหลดข้อมูลจุดบริจาคไม่สำเร็จ');
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, [id]);

  const navigable = canNavigateToDonation(donation);

  useEffect(() => {
    if (!donation || !navigable) return undefined;

    if (!navigator.geolocation) {
      const timer = setTimeout(() => {
        setLoading(false);
        setError('Browser นี้ไม่รองรับการอ่านตำแหน่ง');
      }, 0);
      return () => clearTimeout(timer);
    }

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const current = [coords.latitude, coords.longitude];
        setPosition(current);
        const query = new URLSearchParams({
          donationId: String(id),
          fromLat: String(coords.latitude),
          fromLng: String(coords.longitude),
        });
        try {
          setRoute(await api(`/api/routes?${query}`));
        } catch (requestError) {
          if (requestError.code === 'DONATION_NOT_AVAILABLE') {
            setError('จุดบริจาคนี้ไม่อยู่ในช่วงที่สามารถนำทางได้');
          } else {
            setError(requestError.message || 'คำนวณเส้นทางไม่สำเร็จ');
          }
        } finally {
          setLoading(false);
        }
      },
      () => {
        setLoading(false);
        setError('กรุณาอนุญาต Location เพื่อใช้งานการนำทาง');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
    );
    return undefined;
  }, [donation, id, navigable]);

  const destination = navigable ? [donation.latitude, donation.longitude] : null;
  const navigationMessage = donation && !navigable
    ? 'จุดบริจาคนี้ไม่อยู่ในช่วงที่สามารถนำทางได้'
    : (loading ? 'กำลังคำนวณเส้นทาง...' : error);

  return (
    <main className="navigationPage">
      {destination && <NavigationMap from={position} to={destination} geometry={route?.geometry || null} />}
      <header className="navigationHeader">
        <Link href={`/donations/${id}`}>← กลับ</Link>
        <strong>{donation?.title || 'กำลังโหลด...'}</strong>
      </header>
      <section className="navigationSummary">
        {route ? (
          <>
            <div><span>ระยะทาง</span><strong>{formatDistance(route.distanceMeters)}</strong></div>
            <div><span>เวลาโดยประมาณ</span><strong>{formatDuration(route.durationSeconds)}</strong></div>
            <p>{donation?.address || 'จุดรับของบริจาค'}</p>
          </>
        ) : (
          <p>{navigationMessage}</p>
        )}
      </section>
    </main>
  );
}
