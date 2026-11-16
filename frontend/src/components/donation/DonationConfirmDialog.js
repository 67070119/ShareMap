'use client';

import { Modal } from '../ui';
import NavIcon from '../common/NavIcon';

/** Replaces native confirm with an accessible dialog; does not call APIs. */
export default function DonationConfirmDialog({ intent, onCancel, onConfirm, busy }) {
  const isDelete = intent === 'delete';
  const open = intent === 'out-of-stock' || isDelete;
  return (
    <Modal open={open} onClose={busy ? undefined : onCancel}
      className="pointConfirmModal"
      title={isDelete ? 'ลบโพสต์นี้ถาวร?' : 'ยืนยันว่าของหมดแล้ว?'}
      actions={
        <>
          <button type="button" className="button pointConfirmCancel" onClick={onCancel} disabled={busy}>ยกเลิก</button>
          <button type="button" className={`button ${isDelete ? 'danger' : 'primary'} pointConfirmProceed`}
            onClick={onConfirm} disabled={busy} autoFocus>
            {busy ? 'กำลังดำเนินการ...' : (isDelete ? 'ยืนยันลบโพสต์' : 'ยืนยันว่าของหมด')}
          </button>
        </>
      }>
      <div className="pointConfirmBody">
        <span className={`pointConfirmIcon${isDelete ? ' isDanger' : ''}`}>
          <NavIcon name={isDelete ? 'reports' : 'gift'} size={23}/>
        </span>
        <p>{isDelete
          ? 'โพสต์นี้จะถูกลบอย่างถาวรและไม่สามารถกู้คืนได้'
          : 'โพสต์นี้จะไม่แสดงบนแผนที่ในรายการของที่พร้อมรับอีกต่อไป'}</p>
      </div>
    </Modal>
  );
}
