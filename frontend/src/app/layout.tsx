import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Site Ops Intel",
  description: "Factory Gate Operations Intelligence Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-bg text-white antialiased">{children}</body>
    </html>
  );
}
