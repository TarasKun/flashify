import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flashify",
  description: "Mobile-first PWA for learning with flashcards.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
