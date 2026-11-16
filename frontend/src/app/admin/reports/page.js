'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AdminNav from '../../../components/common/AdminNav';
import NavIcon from '../../../components/common/NavIcon';
import {
  AdminPageHeading, AdminSectionHeading, AdminStatus, AdminSearchBar,
  AdminFilterSelect, AdminEmptyResult,
} from '../../../components/admin/AdminUI';
import { api } from '../../../lib/api';
import { formatBangkokDate } from '../../../lib/date';

const REASON_LABELS = {
  ILLEGAL_ITEM:'สิ่งของผิดกฎหมาย', DANGEROUS_ITEM:'ของอันตราย', FRAUD:'ข้อมูลหลอกลวง',
  INAPPROPRIATE_CONTENT:'เนื้อหาไม่เหมาะสม', OTHER:'เหตุผลอื่น',
};

export default function AdminReportsPage() {
  const [reports, setReports] = useState([]);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [reason, setReason] = useState('ALL');

  useEffect(() => {
    let active = true;
    api('/api/admin/reports').then((items) => { if (active) setReports(items); })
      .catch((e) => { if (active) setError(e.message || 'โหลด Reports ไม่สำเร็จ'); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => reports.filter((r) => {
    const q = search.trim().toLocaleLowerCase();
    return (!q || [REASON_LABELS[r.reason], r.reason, r.donation?.title, r.reporter?.name]
      .some((v) => String(v || '').toLocaleLowerCase().includes(q)))
      && (status === 'ALL' || r.status === status)
      && (reason === 'ALL' || r.reason === reason);
  }), [reports, search, status, reason]);
  const pending = reports.filter((r) => r.status === 'PENDING').length;

  return <div className="adminPortShell adminModernShell">
    <AdminNav/>
    <main className="page adminPortPage adminModernPage">
      <AdminPageHeading title="รายงานปัญหา" section="ADMIN CONSOLE / REPORTS" icon="reports"
        description="ตรวจสอบรายงานจากชุมชนและบริหารรายการรอพิจารณา" count={pending} countLabel="รอตรวจสอบ"/>
      {error && <div className="errorBox adminModernAlert" role="alert">{error}</div>}
      {!loaded && !error && <div className="centerState adminPortLoading">กำลังโหลด Reports...</div>}
      {loaded && <section className="card adminModernPanel adminPortListCard">
        <AdminSectionHeading eyebrow="MODERATION INBOX" title="รายการรายงาน" icon="reports"
          extra={<AdminStatus value="PENDING" label={`รอตรวจสอบ ${pending}`}/>}/>
        <AdminSearchBar value={search} onChange={setSearch} placeholder="ค้นหาเหตุผล โพสต์ หรือผู้รายงาน..."
          count={filtered.length} total={reports.length}
          filters={<>
            <AdminFilterSelect label="กรองสถานะรายงาน" value={status} onChange={setStatus}
              options={[{value:'ALL',label:'ทุกสถานะ'},{value:'PENDING',label:'รอตรวจสอบ'},{value:'RESOLVED',label:'ปิดแล้ว'}]}/>
            <AdminFilterSelect label="กรองประเภทปัญหา" value={reason} onChange={setReason}
              options={[{value:'ALL',label:'ทุกประเภท'},...Object.entries(REASON_LABELS).map(([value,label])=>({value,label}))]}/>
          </>}/>
        <div className="adminListColumnLabels" aria-hidden="true"><span>รายละเอียดรายงาน</span><span>ดำเนินการ</span></div>
        <div className="adminPortList adminModernList">
          {filtered.map((report) => <article className="listRow adminPortListRow adminModernRow" key={report.id}>
            <span className="listIcon adminPortReportIcon" aria-hidden="true"><NavIcon name="reports" size={24}/></span>
            <div className="adminPortListCopy">
              <Link className="adminPortTitleLink" href={`/admin/reports/${report.id}`}>
                {REASON_LABELS[report.reason] || report.reason}</Link>
              <small className="muted">{report.donation?.title || '-'} · ผู้รายงาน {report.reporter?.name || '-'}</small>
              <div className="adminPortChips">
                <AdminStatus value={report.status}/>
                <span className="adminRowMeta">{formatBangkokDate(report.createdAt)}</span>
              </div>
            </div>
            <Link className="button adminRowAction" href={`/admin/reports/${report.id}`}>
              ตรวจสอบ <NavIcon name="arrow" size={16}/></Link>
          </article>)}
          {filtered.length === 0 && <AdminEmptyResult message={reports.length ? 'ไม่พบรายงานตามเงื่อนไข' : 'ยังไม่มีรายงานจากชุมชน'}
            onReset={reports.length ? () => {setSearch('');setStatus('ALL');setReason('ALL');} : undefined}/>}
        </div>
      </section>}
    </main>
  </div>;
}
