import {
  AdminBootstrapError,
  validateBootstrapCredentials,
} from '../services/admin-bootstrap.service.js';
import { AppError } from '../utils/response.js';

const FIELDS = new Set(['name', 'email', 'password']);

export function validateAdditionalAdmin(req, _res, next) {
  const body = req.body;
  const errors = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    next(new AppError(400, 'VALIDATION_ERROR', 'ข้อมูลไม่ถูกต้อง',
      { body: 'ต้องส่ง JSON object' }));
    return;
  }
  for (const key of Object.keys(body)) {
    if (!FIELDS.has(key)) errors[key] = 'ไม่อนุญาตให้กำหนดฟิลด์นี้';
  }
  if (Object.keys(errors).length) {
    next(new AppError(400, 'VALIDATION_ERROR', 'ข้อมูลไม่ถูกต้อง', errors));
    return;
  }

  try {
    req.validatedBody = validateBootstrapCredentials(body);
    next();
  } catch (error) {
    if (!(error instanceof AdminBootstrapError)) return next(error);
    const field = {
      INVALID_NAME: 'name', INVALID_EMAIL: 'email', INVALID_PASSWORD: 'password',
    }[error.code] || 'body';
    next(new AppError(400, 'VALIDATION_ERROR', 'ข้อมูลไม่ถูกต้อง',
      { [field]: error.message }));
  }
}
