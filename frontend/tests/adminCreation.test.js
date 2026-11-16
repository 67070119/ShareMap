import assert from 'node:assert/strict';
import test from 'node:test';
import { EMPTY_ADMIN_FORM, validateAdminForm } from '../src/lib/adminCreation.js';

const sample = { name: ' New Admin ', email: ' New@Example.COM ', password: 'strong-test-password',
  confirmPassword: 'strong-test-password' };

test('admin creation form allows valid details and normalizes name/email', () => {
  const result = validateAdminForm(sample);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, {});
  assert.deepEqual(result.payload, {
    name: 'New Admin',
    email: 'new@example.com',
    password: 'strong-test-password',
  });
  assert.equal(Object.hasOwn(result.payload, 'confirmPassword'), false);
  assert.equal(Object.hasOwn(result.payload, 'role'), false);
  assert.equal(Object.hasOwn(result.payload, 'isActive'), false);
});

test('admin form rejects empty and malformed fields', () => {
  for (const input of [
    EMPTY_ADMIN_FORM,
    { ...sample, name: 'A' },
    { ...sample, name: 'X'.repeat(81) },
    { ...sample, email: 'invalid' },
    { ...sample, email: 'x'.repeat(255) + '@demo.org' },
    { ...sample, password: 'short', confirmPassword: 'short' },
    { ...sample, password: 'ก'.repeat(30), confirmPassword: 'ก'.repeat(30) },
    { ...sample, password: 'strong-test-password\n', confirmPassword: 'strong-test-password\n' },
    { ...sample, confirmPassword: 'not-matching' },
  ]) {
    const result = validateAdminForm(input);
    assert.equal(result.valid, false);
    assert.ok(Object.keys(result.errors).length > 0);
  }
});

test('password and confirmation are never included in validation error messages or output payload keys', () => {
  const result = validateAdminForm({ ...sample, confirmPassword: 'unmatched' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.confirmPassword);
  assert.ok(!JSON.stringify(result.errors).includes(sample.password));
  assert.equal(Object.hasOwn(result.payload, 'confirmPassword'), false);
});
