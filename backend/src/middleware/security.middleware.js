import { rateLimit } from 'express-rate-limit';

function rateLimitResponse(_req, res) {
  res.status(429).json({
    error: 'TOO_MANY_REQUESTS',
    message: 'มีการเรียกใช้งานมากเกินไป กรุณาลองใหม่ภายหลัง',
  });
}

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: rateLimitResponse,
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: rateLimitResponse,
});

export const reportRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: rateLimitResponse,
});
