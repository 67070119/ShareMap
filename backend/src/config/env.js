import 'dotenv/config';

export const env = {
  port: Number(process.env.BACKEND_PORT || 4000),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || '',
  nodeEnv: process.env.NODE_ENV || 'development',
  routingBaseUrl: process.env.ROUTING_BASE_URL || 'https://router.project-osrm.org',
};

if (!env.databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

if (!env.jwtSecret) {
  throw new Error('JWT_SECRET is required');
}

if (env.nodeEnv === 'production' && env.jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production');
}

try {
  new URL(env.frontendUrl);
  new URL(env.routingBaseUrl);
} catch {
  throw new Error('FRONTEND_URL and ROUTING_BASE_URL must be valid URLs');
}
