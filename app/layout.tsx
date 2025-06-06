import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegistration } from "./_components/service-worker-registration";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Flashify",
  title: "Flashify",
  description: "Mobile-first PWA for learning with flashcards.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Flashify",
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8f5" },
    { media: "(prefers-color-scheme: dark)", color: "#10130f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
