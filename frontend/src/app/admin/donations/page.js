'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AdminNav from '../../../components/common/AdminNav';
import NavIcon from '../../../components/common/NavIcon';
import {
  AdminPageHeading, AdminSectionHeading, AdminStatus, AdminSearchBar,
  AdminFilterSelect, AdminEmptyResult, AdminConfirmDialog,
} from '../../../components/admin/AdminUI';
import { api } from '../../../lib/api';

export default function AdminDonationsPage() {
  const [donations, setDonations] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [visibility, setVisibility] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    let active = true;
    api('/api/admin/donations').then((items) => { if (active) setDonations(items); })
      .catch((e) => { if (active) setError(e.message || 'โหลด Donations ไม่สำเร็จ'); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => donations.filter((d) => {
    const q = search.trim().toLocaleLowerCase();
    return (!q || [d.title, d.category, d.owner?.name].some((v) => String(v || '').toLocaleLowerCase().includes(q)))
      && (visibility === 'ALL' || (visibility === 'HIDDEN' ? d.isHidden : !d.isHidden))
      && (status === 'ALL' || d.status === status);
  }), [donations, search, visibility, status]);

  async function toggleVisibility(donation) {
    if (busyId) return;
    setBusyId(donation.id);
    setError('');
    try {
      const updated = await api(`/api/admin/donations/${donation.id}/visibility`, {
        method: 'PATCH', body: JSON.stringify({ isHidden: !donation.isHidden }),
      });
      setDonations((items) => items.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
    } catch (e) {
      setError(e.message || 'อัปเดตโพสต์ไม่สำเร็จ');
    } finally { setBusyId(null); }
  }

  async function removeDonation(donation) {
    if (busyId) return;
    setBusyId(donation.id);
    setError('');
    try {
      await api(`/api/admin/donations/${donation.id}`, { method:'DELETE' });
      setDonations((items) => items.filter((item) => item.id !== donation.id));
      setDeleteTarget(null);
    } catch(e) {
      setError(e.message || 'ลบโพสต์ไม่สำเร็จ');
      setDeleteTarget(null);
    } finally { setBusyId(null); }
  }

  return <div className="adminPortShell adminModernShell">
    <AdminNav/>
    <main className="page adminPortPage adminModernPage">
      <AdminPageHeading title="จัดการของบริจาค" section="ADMIN CONSOLE / DONATIONS" icon="gift"
        description="ตรวจสอบโพสต์ทั้งหมดและควบคุมการแสดงผลบนแผนที่" count={donations.length} countLabel="โพสต์"/>
      {error && <div className="errorBox adminModernAlert" role="alert">{error}</div>}
      {!loaded && !error && <div className="centerState adminPortLoading">กำลังโหลดโพสต์บริจาค...</div>}
      {loaded && <section className="card adminModernPanel adminPortListCard">
        <AdminSectionHeading eyebrow="DONATION MODERATION" title="โพสต์ในระบบ" icon="gift"/>
        <AdminSearchBar value={search} onChange={setSearch} placeholder="ค้นหาชื่อสิ่งของ ประเภท หรือเจ้าของ..."
          count={filtered.length} total={donations.length}
          filters={<>
            <AdminFilterSelect label="กรองการแสดงโพสต์" value={visibility} onChange={setVisibility}
              options={[{value:'ALL',label:'ทั้งหมด'},{value:'VISIBLE',label:'แสดงอยู่'},{value:'HIDDEN',label:'ถูกซ่อน'}]}/>
            <AdminFilterSelect label="กรองสถานะโพสต์" value={status} onChange={setStatus}
              options={[{value:'ALL',label:'ทุกสถานะ'},{value:'AVAILABLE',label:'พร้อมรับ'},{value:'OUT_OF_STOCK',label:'ของหมด'},{value:'EXPIRED',label:'หมดช่วงบริจาค'}]}/>
          </>}/>
        <div className="adminListColumnLabels" aria-hidden="true"><span>รายละเอียดโพสต์</span><span>การจัดการ</span></div>
        <div className="adminPortList adminModernList">
          {filtered.map((donation) => <article className="listRow adminPortListRow adminModernRow" key={donation.id}>
            <span className="listIcon adminPortDonationIcon" aria-hidden="true"><NavIcon name="gift" size={24}/></span>
            <div className="adminPortListCopy">
              <Link href={`/admin/donations/${donation.id}`} className="adminPortTitleLink">{donation.title}</Link>
              <small className="muted">{donation.category} · โดย {donation.owner?.name || '-'}</small>
              <div className="adminPortChips">
                <AdminStatus value={donation.status}/>
                <AdminStatus value={donation.isHidden ? 'HIDDEN' : 'VISIBLE'}/>
                {(donation._count?.reports ?? 0) > 0 && <AdminStatus value="REPORTS" tone="warning" label={`รายงาน ${donation._count.reports}`}/>}
              </div>
            </div>
            <div className="sectionActions adminPortRowActions">
              <button type="button" className="button" disabled={Boolean(busyId)}
                onClick={() => toggleVisibility(donation)}><NavIcon name={donation.isHidden ? 'check' : 'reports'} size={16}/>
                {busyId === donation.id ? 'กำลังบันทึก...' : donation.isHidden ? 'แสดง' : 'ซ่อน'}</button>
              <button type="button" className="button danger" disabled={Boolean(busyId)}
                onClick={() => setDeleteTarget(donation)}><NavIcon name="close" size={15}/>ลบ</button>
            </div>
          </article>)}
          {filtered.length === 0 && <AdminEmptyResult message={donations.length ? 'ไม่พบโพสต์ตามคำค้นหา' : 'ยังไม่มีโพสต์บริจาค'}
            onReset={donations.length ? () => {setSearch('');setVisibility('ALL');setStatus('ALL');} : undefined}/>}
        </div>
      </section>}
      <AdminConfirmDialog intent={deleteTarget} busy={Boolean(busyId)}
        title="ยืนยันลบโพสต์ถาวร?" message={deleteTarget ? `ลบโพสต์ “${deleteTarget.title}” ออกจากระบบอย่างถาวร ไม่สามารถกู้คืนได้` : ''}
        actionLabel="ยืนยันลบโพสต์" destructive onCancel={() => setDeleteTarget(null)}
        onConfirm={() => { if(deleteTarget) removeDonation(deleteTarget); }}/>
    </main>
  </div>;
}
