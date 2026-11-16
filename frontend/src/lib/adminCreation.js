/** Client-side guidance only. Backend validateAdditionalAdmin remains authoritative. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const EMPTY_ADMIN_FORM = Object.freeze({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
});

export function validateAdminForm(form) {
  const errors = {};
  const name = typeof form.name === 'string' ? form.name.trim() : '';
  const email = typeof form.email === 'string' ? form.email.trim().toLowerCase() : '';
  const password = typeof form.password === 'string' ? form.password : '';
  const confirmPassword = typeof form.confirmPassword === 'string' ? form.confirmPassword : '';

  if (name.length < 2 || name.length > 80) {
    errors.name = 'กรุณากรอกชื่อ 2–80 ตัวอักษร';
  }
  if (email.length > 254 || !EMAIL.test(email)) {
    errors.email = 'กรุณากรอกอีเมลที่ถูกต้อง (ไม่เกิน 254 ตัวอักษร)';
  }
  if (password.length < 8 || password.length > 72 ||
      new TextEncoder().encode(password).length > 72 ||
      /[\u0000-\u001f\u007f]/.test(password)) {
    errors.password = 'รหัสผ่านต้องมี 8–72 ตัวอักษร และไม่เกิน 72 ไบต์';
  }
  if (confirmPassword !== password) {
    errors.confirmPassword = 'รหัสผ่านทั้งสองช่องไม่ตรงกัน';
  }
  // Only these fields may be submitted. Role and isActive are server-owned.
  return {
    errors,
    valid: Object.keys(errors).length === 0,
    payload: { name, email, password },
  };
}
