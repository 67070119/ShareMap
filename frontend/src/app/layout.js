import 'leaflet/dist/leaflet.css';
import './globals.css';

export const metadata = {
  title: 'OGTB Donation Map',
  description: 'Location-based donation map project',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
