'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Field, Input, Modal } from '../ui';
import NavIcon from '../common/NavIcon';
import { EMPTY_ADMIN_FORM, validateAdminForm } from '../../lib/adminCreation';

/** Two-step Add Admin flow. No password in confirmation copy or logs. */
export default function AdminCreateDialog({ open, onCancel, onCreate }) {
  const [form, setForm] = useState(EMPTY_ADMIN_FORM);
  const [errors, setErrors] = useState({});
  const [requestError, setRequestError] = useState('');
  const [step, setStep] = useState('form');
  const [busy, setBusy] = useState(false);
  const nameRef = useRef(null);
  const confirmRef = useRef(null);
  const busyRef = useRef(false);

  const reset = useCallback(() => {
    setForm(EMPTY_ADMIN_FORM);
    setErrors({});
    setRequestError('');
    setStep('form');
  }, []);

  const close = useCallback(() => {
    if (busyRef.current) return;
    reset();
    onCancel();
  }, [onCancel, reset]);

  useEffect(() => {
    if (!open) return;
    if (step === 'form') nameRef.current?.focus();
    if (step === 'confirm') confirmRef.current?.focus();
  }, [open, step]);

  function update(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    setRequestError('');
  }

  function goConfirm(event) {
    event.preventDefault();
    if (busyRef.current) return;
    const result = validateAdminForm(form);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setRequestError('');
    setStep('confirm');
  }

  async function create() {
    if (busyRef.current) return;
    // Revalidate at the point of submission to avoid bypassing the form.
    const result = validateAdminForm(form);
    if (!result.valid) {
      setStep('form');
      setErrors(result.errors);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setRequestError('');
    try {
      await onCreate(result.payload);
      // Explicitly remove password/confirmation from React state after success.
      reset();
    } catch (error) {
      const code = error?.code;
      if (code === 'EMAIL_ALREADY_EXISTS') {
        setErrors({ email: 'อีเมลนี้มีบัญชีอยู่แล้ว กรุณาใช้อีเมลอื่น' });
        setStep('form');
      } else if (code === 'ADMIN_BOOTSTRAP_REQUIRED') {
        setRequestError('ยังไม่ได้สร้าง Admin คนแรกผ่าน CLI กรุณาตั้งค่าระบบก่อน');
      } else if (error?.status === 401 || error?.status === 403) {
        setRequestError('สิทธิ์ผู้ดูแลหมดอายุหรือถูกระงับ กรุณาเข้าสู่ระบบใหม่');
      } else if (code === 'VALIDATION_ERROR' && error?.details) {
        setErrors(error.details);
        setRequestError('โปรดตรวจสอบข้อมูลที่กรอก');
        setStep('form');
      } else {
        setRequestError(error?.message || 'ไม่สามารถสร้าง Admin ได้ กรุณาลองอีกครั้ง');
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const isConfirm = step === 'confirm';
  return <Modal open={open} onClose={busy ? undefined : close}
    className="adminCreateDialog" title={isConfirm ? 'ยืนยันการเพิ่ม Admin' : 'เพิ่มผู้ดูแลระบบ'}
    actions={isConfirm ? <>
      <button type="button" className="button" disabled={busy}
        onClick={() => { setRequestError(''); setStep('form'); }}>
        กลับไปแก้ไข
      </button>
      <button ref={confirmRef} type="button" className="button primary"
        onClick={create} disabled={busy} aria-busy={busy}>
        <NavIcon name="check" size={17}/>{busy ? 'กำลังสร้างบัญชี...' : 'ยืนยันสร้าง Admin'}
      </button>
    </> : <>
      <button type="button" className="button" disabled={busy} onClick={close}>ยกเลิก</button>
      <button type="submit" form="admin-create-form" className="button primary" disabled={busy}>
        ตรวจสอบข้อมูล <NavIcon name="arrow" size={16}/>
      </button>
    </>}>
    <p className="adminCreateIntro">
      {isConfirm
        ? 'ตรวจสอบข้อมูลให้ถูกต้องก่อนสร้าง ผู้ดูแลรายใหม่นี้จะมีสิทธิ์จัดการผู้ใช้และเนื้อหาในระบบ'
        : 'บัญชีนี้จะได้รับสิทธิ์ ADMIN ทันทีหลังสร้าง กรุณาใช้รหัสผ่านที่ปลอดภัย'}
    </p>
    {requestError && <div role="alert" className="adminCreateError">{requestError}</div>}
    {isConfirm ? <div className="adminCreateReview" role="group" aria-label="สรุปผู้ดูแลที่กำลังสร้าง">
      <span>ชื่อผู้ดูแล</span><strong>{form.name.trim()}</strong>
      <span>อีเมล</span><strong>{form.email.trim().toLowerCase()}</strong>
      <span>บทบาทที่จะได้รับ</span><strong>ADMIN</strong>
      <small>เพื่อความปลอดภัยจะไม่แสดงรหัสผ่านในหน้ายืนยัน</small>
    </div> : <form noValidate id="admin-create-form" onSubmit={goConfirm}
      className="adminCreateForm" aria-label="ฟอร์มเพิ่มผู้ดูแลระบบ">
      <Field label="ชื่อผู้ดูแล" htmlFor="admin-create-name" error={errors.name}>
        <Input ref={nameRef} id="admin-create-name" name="name" value={form.name}
          onChange={(e) => update('name', e.target.value)}
          placeholder="ชื่อผู้ดูแลระบบ" autoComplete="off" maxLength={80} required
          invalid={Boolean(errors.name)} disabled={busy}/>
      </Field>
      <Field label="อีเมล" htmlFor="admin-create-email" error={errors.email}>
        <Input id="admin-create-email" name="email" type="email" value={form.email}
          onChange={(e) => update('email', e.target.value)}
          placeholder="admin@example.com" autoComplete="off" maxLength={254} required
          invalid={Boolean(errors.email)} disabled={busy}/>
      </Field>
      <Field label="รหัสผ่าน" htmlFor="admin-create-password"
        hint="8–72 ตัวอักษร ไม่เกิน 72 ไบต์" error={errors.password}>
        <Input id="admin-create-password" name="password" type="password"
          value={form.password} onChange={(e) => update('password', e.target.value)}
          autoComplete="new-password" minLength={8} maxLength={72} required
          invalid={Boolean(errors.password)} disabled={busy}/>
      </Field>
      <Field label="ยืนยันรหัสผ่าน" htmlFor="admin-create-confirm"
        error={errors.confirmPassword}>
        <Input id="admin-create-confirm" name="confirmPassword" type="password"
          value={form.confirmPassword} onChange={(e) => update('confirmPassword', e.target.value)}
          autoComplete="new-password" minLength={8} maxLength={72} required
          invalid={Boolean(errors.confirmPassword)} disabled={busy}/>
      </Field>
      <p className="adminCreateWarning"><NavIcon name="reports" size={17}/>
        บัญชีที่สร้างจะมีสิทธิ์ระดับ ADMIN เท่ากับผู้ดูแลปัจจุบัน</p>
    </form>}
  </Modal>;
}
