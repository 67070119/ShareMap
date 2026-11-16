'use client';

import { useEffect, useMemo, useState } from 'react';
import AdminNav from '../../../components/common/AdminNav';
import NavIcon from '../../../components/common/NavIcon';
import {
  AdminPageHeading, AdminSectionHeading, AdminStatus, AdminSearchBar,
  AdminFilterSelect, AdminEmptyResult, AdminConfirmDialog,
} from '../../../components/admin/AdminUI';
import { api } from '../../../lib/api';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [confirmUser, setConfirmUser] = useState(null);

  useEffect(() => {
    let active = true;
    api('/api/admin/users').then((items) => { if (active) setUsers(items); })
      .catch((requestError) => { if (active) setError(requestError.message || 'โหลด Users ไม่สำเร็จ'); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  const filteredUsers = useMemo(() => users.filter((user) => {
    const query = search.trim().toLocaleLowerCase();
    const textMatches = !query || [user.name, user.email].some((text) => String(text || '').toLocaleLowerCase().includes(query));
    return textMatches && (roleFilter === 'ALL' || user.role === roleFilter)
      && (statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? user.isActive : !user.isActive));
  }), [users, search, roleFilter, statusFilter]);

  async function toggleUser(user) {
    if (busyId) return;
    setBusyId(user.id);
    setError('');
    try {
      const updated = await api(`/api/admin/users/${user.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      setUsers((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      setConfirmUser(null);
    } catch (requestError) {
      setError(requestError.message || 'อัปเดตผู้ใช้ไม่สำเร็จ');
      setConfirmUser(null);
    } finally {
      setBusyId(null);
    }
  }

  return <div className="adminPortShell adminModernShell">
    <AdminNav/>
    <main className="page adminPortPage adminModernPage">
      <AdminPageHeading title="จัดการผู้ใช้" section="ADMIN CONSOLE / USERS" icon="users"
        description="ตรวจสอบบัญชีผู้ใช้ บทบาท และสถานะการเข้าใช้งาน" count={users.length} countLabel="บัญชี"/>
      {error && <div className="errorBox adminModernAlert" role="alert">{error}</div>}
      {!loaded && !error && <div className="centerState adminPortLoading">กำลังโหลดข้อมูลผู้ใช้...</div>}
      {loaded && <section className="card adminModernPanel adminPortListCard">
        <AdminSectionHeading eyebrow="ACCOUNT DIRECTORY" title="บัญชีทั้งหมด" icon="users"/>
        <AdminSearchBar value={search} onChange={setSearch} placeholder="ค้นหาชื่อหรืออีเมล..."
          count={filteredUsers.length} total={users.length}
          filters={<>
            <AdminFilterSelect label="กรองบทบาท" value={roleFilter} onChange={setRoleFilter}
              options={[{value:'ALL',label:'ทุกบทบาท'},{value:'USER',label:'USER'},{value:'ADMIN',label:'ADMIN'}]}/>
            <AdminFilterSelect label="กรองสถานะบัญชี" value={statusFilter} onChange={setStatusFilter}
              options={[{value:'ALL',label:'ทุกสถานะ'},{value:'ACTIVE',label:'ใช้งานอยู่'},{value:'SUSPENDED',label:'ระงับแล้ว'}]}/>
          </>}/>
        <div className="adminListColumnLabels" aria-hidden="true"><span>ผู้ใช้ / รายละเอียดบัญชี</span><span>การจัดการ</span></div>
        <div className="adminPortList adminModernList">
          {filteredUsers.map((user) => <article className="listRow adminPortListRow adminModernRow" key={user.id}>
            <div className="listIcon adminPortAvatar" aria-hidden="true">{user.name?.trim()?.[0]?.toUpperCase() || 'U'}</div>
            <div className="adminPortListCopy">
              <strong>{user.name}</strong>
              <small className="muted">{user.email}</small>
              <div className="adminPortChips">
                <AdminStatus value={user.role}/>
                <AdminStatus value={user.isActive ? 'ACTIVE' : 'SUSPENDED'}/>
              </div>
              <small className="adminRowMeta">บริจาค {user._count?.donations ?? 0} · รายงาน {user._count?.reports ?? 0}</small>
            </div>
            <button type="button" className={`button adminRowAction${user.isActive ? ' danger' : ''}`}
              onClick={() => setConfirmUser(user)} disabled={Boolean(busyId)}>
              <NavIcon name={user.isActive ? 'reports' : 'check'} size={16}/>
              {busyId === user.id ? 'กำลังบันทึก...' : user.isActive ? 'ระงับบัญชี' : 'เปิดใช้งาน'}
            </button>
          </article>)}
          {filteredUsers.length === 0 && <AdminEmptyResult message={users.length ? 'ไม่พบบัญชีตามคำค้นหา' : 'ยังไม่มีบัญชีผู้ใช้'}
            onReset={users.length ? () => {setSearch('');setRoleFilter('ALL');setStatusFilter('ALL');} : undefined}/>}
        </div>
      </section>}
      <AdminConfirmDialog intent={confirmUser} busy={Boolean(busyId)}
        title={confirmUser?.isActive ? 'ยืนยันระงับบัญชี?' : 'ยืนยันเปิดใช้งานบัญชี?'}
        message={confirmUser ? `คุณกำลัง${confirmUser.isActive ? 'ระงับ' : 'เปิดใช้งาน'}บัญชี “${confirmUser.name}” การดำเนินการนี้จะเปลี่ยนสถานะการเข้าใช้งานของบัญชี` : ''}
        actionLabel={confirmUser?.isActive ? 'ยืนยันระงับบัญชี' : 'ยืนยันเปิดใช้งาน'}
        destructive={confirmUser?.isActive} onCancel={() => setConfirmUser(null)}
        onConfirm={() => { if (confirmUser) toggleUser(confirmUser); }}/>
    </main>
  </div>;
}
