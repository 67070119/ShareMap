'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AdminNav from '../../../components/common/AdminNav';
import { api } from '../../../lib/api';

export default function AdminDonationsPage() {
  const [donations, setDonations] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    api('/api/admin/donations')
      .then(setDonations)
      .catch((requestError) => setError(requestError.message || 'โหลด Donations ไม่สำเร็จ'));
  }, []);

  async function toggleVisibility(donation) {
    setBusyId(donation.id);
    setError('');
    try {
      const updated = await api(`/api/admin/donations/${donation.id}/visibility`, {
        method: 'PATCH',
        body: JSON.stringify({ isHidden: !donation.isHidden }),
      });
      setDonations((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (requestError) {
      setError(requestError.message || 'อัปเดตโพสต์ไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  }

  async function removeDonation(donation) {
    if (!window.confirm(`ลบโพสต์ “${donation.title}” ใช่หรือไม่`)) return;
    setBusyId(donation.id);
    setError('');
    try {
      await api(`/api/admin/donations/${donation.id}`, { method: 'DELETE' });
      setDonations((current) => current.filter((item) => item.id !== donation.id));
    } catch (requestError) {
      setError(requestError.message || 'ลบโพสต์ไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="adminPage">
      <AdminNav />
      <section className="adminContent">
        <div className="adminHeading">
          <div>
            <span>ADMIN</span>
            <h1>Donations</h1>
          </div>
          <p>ดู ซ่อน หรือถอนโพสต์ที่มีปัญหา</p>
        </div>

        {error && <div className="adminError">{error}</div>}

        <div className="adminTableWrap">
          <table className="adminTable">
            <thead>
              <tr>
                <th>โพสต์</th>
                <th>เจ้าของ</th>
                <th>สถานะ</th>
                <th>Reports</th>
                <th>Visibility</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {donations.map((donation) => (
                <tr key={donation.id}>
                  <td>
                    <Link href={`/admin/donations/${donation.id}`} className="adminRowLink">{donation.title}</Link>
                    <small>{donation.category}</small>
                  </td>
                  <td>
                    <strong>{donation.owner?.name || '-'}</strong>
                    <small>{donation.owner?.email || ''}</small>
                  </td>
                  <td>{donation.status}</td>
                  <td>{donation._count?.reports ?? 0}</td>
                  <td>
                    <span className={`statusPill ${donation.isHidden ? 'isSuspended' : 'isActive'}`}>
                      {donation.isHidden ? 'HIDDEN' : 'VISIBLE'}
                    </span>
                  </td>
                  <td>
                    <div className="adminActionGroup">
                      <button
                        type="button"
                        className="adminSecondaryButton"
                        onClick={() => toggleVisibility(donation)}
                        disabled={busyId === donation.id}
                      >
                        {donation.isHidden ? 'แสดง' : 'ซ่อน'}
                      </button>
                      <button
                        type="button"
                        className="adminDangerButton"
                        onClick={() => removeDonation(donation)}
                        disabled={busyId === donation.id}
                      >
                        ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {donations.length === 0 && (
                <tr><td colSpan="6">ไม่พบโพสต์บริจาค</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
