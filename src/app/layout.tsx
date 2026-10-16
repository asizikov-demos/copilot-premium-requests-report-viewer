import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Copilot Billing Report Viewer",
  description: "Upload your CSV file to analyze AI Credit consumption and quota usage",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-color-mode="light" data-light-theme="light">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
