'use client';

import { useEffect, useState } from 'react';
import AdminNav from '../../../components/common/AdminNav';
import { api } from '../../../lib/api';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    api('/api/admin/users')
      .then(setUsers)
      .catch((requestError) => setError(requestError.message || 'โหลด Users ไม่สำเร็จ'));
  }, []);

  async function toggleUser(user) {
    setBusyId(user.id);
    setError('');
    try {
      const updated = await api(`/api/admin/users/${user.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (requestError) {
      setError(requestError.message || 'อัปเดตผู้ใช้ไม่สำเร็จ');
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
            <h1>Users</h1>
          </div>
          <p>ดูและจัดการสถานะบัญชีผู้ใช้</p>
        </div>

        {error && <div className="adminError">{error}</div>}

        <div className="adminTableWrap">
          <table className="adminTable">
            <thead>
              <tr>
                <th>ผู้ใช้</th>
                <th>Role</th>
                <th>Donation</th>
                <th>Report</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.name}</strong>
                    <small>{user.email}</small>
                  </td>
                  <td>{user.role}</td>
                  <td>{user._count?.donations ?? 0}</td>
                  <td>{user._count?.reports ?? 0}</td>
                  <td>
                    <span className={`statusPill ${user.isActive ? 'isActive' : 'isSuspended'}`}>
                      {user.isActive ? 'ACTIVE' : 'SUSPENDED'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={user.isActive ? 'adminDangerButton' : 'adminSecondaryButton'}
                      onClick={() => toggleUser(user)}
                      disabled={busyId === user.id}
                    >
                      {busyId === user.id ? '...' : user.isActive ? 'ระงับบัญชี' : 'เปิดใช้งาน'}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan="6">ไม่พบข้อมูลผู้ใช้</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
