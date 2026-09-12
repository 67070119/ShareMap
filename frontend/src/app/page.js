'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import RadiusFilter from '../components/map/RadiusFilter';
import { api } from '../lib/api';
import { useAuth } from '../lib/useAuth';

const DonationMap = dynamic(() => import('../components/map/DonationMap'), { ssr: false });
const DEFAULT_RADIUS_KM = 5;
const SEARCH_DEBOUNCE_MS = 300;

export default function HomePage() {
  const { user, loading: authLoading, logout } = useAuth();
  const [userPosition, setUserPosition] = useState(null);
  const [donations, setDonations] = useState([]);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [category, setCategory] = useState('');
  const [locating, setLocating] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setLocating(false);
      setError('Browser นี้ไม่รองรับการอ่านตำแหน่ง');
      return;
    }

    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUserPosition([coords.latitude, coords.longitude]);
        setLocating(false);
      },
      () => {
        setLocating(false);
        setError('ไม่สามารถอ่านตำแหน่งได้ กรุณาอนุญาต Location แล้วลองอีกครั้ง');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
    );
  }, []);

  useEffect(() => {
    const timer = setTimeout(locate, 0);
    return () => clearTimeout(timer);
  }, [locate]);

  useEffect(() => {
    if (!userPosition) return undefined;
    const timer = setTimeout(async () => {
      const query = new URLSearchParams({
        lat: String(userPosition[0]),
        lng: String(userPosition[1]),
        radius: String(radiusKm),
      });
      if (category.trim()) query.set('category', category.trim());

      setLoading(true);
      setError('');
      try {
        setDonations(await api(`/api/donations/nearby?${query}`));
      } catch (requestError) {
        setError(requestError.message || 'โหลดจุดบริจาคไม่สำเร็จ');
      } finally {
        setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [userPosition, radiusKm, category]);

  async function handleLogout() {
    await logout();
  }

  return (
    <main className="mapPage">
      <DonationMap donations={donations} userPosition={userPosition} radiusKm={radiusKm} />

      <header className="mapTopBar">
        <div>
          <span className="mapBrandEyebrow">OGTB</span>
          <strong>Donation Map</strong>
        </div>
        <div className="mapTopActions">
          {!authLoading && user ? (
            <>
              <Link href="/donations/new" className="mapActionButton">+ บริจาค</Link>
              {user.role === 'ADMIN' && <Link href="/admin" className="dashboardButton">Dashboard</Link>}
              <button type="button" className="mapGhostButton" onClick={handleLogout}>ออกจากระบบ</button>
            </>
          ) : !authLoading ? (
            <>
              <Link href="/login" className="mapGhostLink">เข้าสู่ระบบ</Link>
              <Link href="/register" className="mapActionButton">สมัครสมาชิก</Link>
            </>
          ) : null}
          <div className="mapCountBadge">{donations.length} จุด</div>
        </div>
      </header>

      <RadiusFilter radiusKm={radiusKm} onRadiusChange={setRadiusKm} category={category} onCategoryChange={setCategory} disabled={!userPosition} />

      <button className="locateButton" type="button" onClick={locate} disabled={locating} aria-label="ค้นหาตำแหน่งปัจจุบัน">
        {locating ? '…' : '◎'}
      </button>

      {(loading || error) && <div className={`mapStatus ${error ? 'isError' : ''}`} role="status">{error || 'กำลังค้นหาจุดบริจาค...'}</div>}
    </main>
  );
}
