import "./globals.css";

export const metadata = {
  title: "Transworld Client Engagement",
  description: "Greetings and document signing for Transworld clients",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
