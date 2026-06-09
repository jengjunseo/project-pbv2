import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PB",
  description: "Temporary 0-99 slot transfer for text and small files.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
