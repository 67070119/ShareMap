/** @type {import('next').NextConfig} */
const nextConfig = {
  // HTTPS quick tunnels proxy the development server through a *.trycloudflare.com
  // hostname. Allow that origin so Next.js HMR/WebSocket requests are not blocked.
  allowedDevOrigins: ['**.trycloudflare.com'],
};

export default nextConfig;
