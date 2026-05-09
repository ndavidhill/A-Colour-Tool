export const metadata = {
  title: 'CMYK Grid Tester',
  description: 'Browser-based CMYK colour exploration tool for print design teams.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  );
}
