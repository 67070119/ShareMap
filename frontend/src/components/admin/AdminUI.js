'use client';

import Link from 'next/link';
import NavIcon from '../common/NavIcon';
import { Modal } from '../ui';

/** Shared admin presentation; access control and API calls remain inside pages. */
export function AdminPageHeading({ section, title, description, icon = 'dashboard', count, countLabel, back }) {
  return <header className="pageTitle adminModernHeading">
    <div className="adminModernHeadingMain">
      <span className="adminModernEyebrow"><NavIcon name={icon} size={15}/>{section || 'OGTB ADMIN / MANAGEMENT'}</span>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
    <div className="adminModernHeadingAside">
      {count != null && <span className="adminModernCount"><strong>{count}</strong><small>{countLabel}</small></span>}
      {back && <Link className="button adminBackLink" href={back.href}><NavIcon name="arrow" size={16}/>{back.label}</Link>}
    </div>
  </header>;
}

export function AdminStatus({ value, tone, label }) {
  const status = String(value ?? 'UNKNOWN').toUpperCase();
  const statusTone = tone || ({
    AVAILABLE: 'success', VISIBLE: 'success', ACTIVE: 'success', RESOLVED: 'success',
    PENDING: 'warning', OUT_OF_STOCK: 'warning',
    HIDDEN: 'danger', SUSPENDED: 'danger', EXPIRED: 'neutral',
    USER: 'neutral', ADMIN: 'info',
  }[status] || 'neutral');
  return <span className={`adminStatusChip adminStatusChip--${statusTone}`}><span className="adminStatusDot" aria-hidden="true"/>{label || status}</span>;
}

export function AdminSectionHeading({ eyebrow, title, icon = 'dashboard', extra }) {
  return <div className="adminModernSectionHeading">
    <div><span className="adminSectionEyebrow">{eyebrow}</span><h2>{title}</h2></div>
    {extra || <span className="adminSectionIcon"><NavIcon name={icon} size={19}/></span>}
  </div>;
}

export function AdminSearchBar({ value, onChange, placeholder = 'ค้นหา...', filters, count, total }) {
  return <div className="adminToolbar">
    <label className="adminSearchField">
      <NavIcon name="search" size={18}/>
      <span className="adminVisuallyHidden">ค้นหาในรายการ</span>
      <input type="search" value={value} onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder} aria-label="ค้นหาในรายการ"/>
    </label>
    {filters}
    {count != null && <span className="adminToolbarCount">แสดง <strong>{count}</strong> จาก {total}</span>}
  </div>;
}

export function AdminFilterSelect({ value, onChange, options, label }) {
  return <label className="adminFilterSelect">
    <span className="adminVisuallyHidden">{label}</span>
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map(({ value: key, label: text }) => <option key={key} value={key}>{text}</option>)}
    </select>
  </label>;
}

export function AdminConfirmDialog({ intent, title, message, actionLabel, busy, onCancel, onConfirm, destructive = false }) {
  return <Modal open={Boolean(intent)} onClose={busy ? undefined : onCancel}
    className="adminConfirmDialog" title={title}
    actions={<>
      <button type="button" className="button" disabled={busy} onClick={onCancel}>ยกเลิก</button>
      <button type="button" className={`button ${destructive ? 'danger' : 'primary'}`}
        disabled={busy} onClick={onConfirm}>{busy ? 'กำลังดำเนินการ...' : actionLabel}</button>
    </>}>
    <div className="adminConfirmMessage">
      <span className={`adminConfirmIcon${destructive ? ' isDanger' : ''}`}>
        <NavIcon name={destructive ? 'reports' : 'check'} size={21}/>
      </span>
      <p>{message}</p>
    </div>
  </Modal>;
}

export function AdminEmptyResult({ message = 'ไม่พบรายการที่ตรงกับตัวกรอง', onReset }) {
  return <div className="adminModernEmpty" role="status">
    <NavIcon name="search" size={27}/>
    <strong>{message}</strong>
    {onReset && <button type="button" className="button" onClick={onReset}>ล้างตัวกรอง</button>}
  </div>;
}
