import 'leaflet/dist/leaflet.css';
import './globals.css';
import './ux-foundation.css';
import './navigation.css';
import './map-ux.css';
import './auth-form-ux.css';
import './detail-navigation-ux.css';
import './admin-ux.css';
import './design-system-dark.css';
import './app-shell.css';
import './map-redesign.css';
import './auth-redesign.css';
import './donation-editor.css';
import './donation-detail-report.css';
import './admin-redesign.css';
import AppShell from '../components/common/AppShell';
import { AuthProvider } from '../lib/useAuth';

export const metadata = {
  title: 'OGTB Donation Map',
  description: 'Location-based donation map project',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0b1120',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
