import type { Metadata, Viewport } from "next";
import { BootSplashDismissal } from "./_components/boot-splash-dismissal";
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
    { media: "(prefers-color-scheme: light)", color: "#f8f9ff" },
    { media: "(prefers-color-scheme: dark)", color: "#10131f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ backgroundColor: "#eef3fb", margin: 0 }}>
        <style
          dangerouslySetInnerHTML={{
            __html: `
html,body{background:#eef3fb;}
#flashify-boot-splash{position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;background:#eef3fb;color:#111827;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
#flashify-boot-splash>div{display:grid;gap:14px;place-items:center;}
#flashify-boot-splash span{display:grid;width:52px;height:52px;place-items:center;border-radius:18px;background:#3f5bf6;color:white;font-size:24px;font-weight:900;box-shadow:0 16px 42px rgb(63 91 246 / 22%);}
#flashify-boot-splash p{margin:0;font-size:14px;font-weight:800;color:#5f6d83;}
#flashify-boot-splash i{display:block;width:112px;height:4px;overflow:hidden;border-radius:999px;background:rgb(63 91 246 / 16%);}
#flashify-boot-splash i::before{content:"";display:block;width:42%;height:100%;border-radius:inherit;background:#3f5bf6;animation:flashifyBootLoading 1.05s ease-in-out infinite;}
html.flashify-hydrated #flashify-boot-splash{opacity:0;pointer-events:none;transition:opacity 180ms ease;}
@keyframes flashifyBootLoading{0%{transform:translateX(-120%);}100%{transform:translateX(260%);}}
@media (prefers-color-scheme:dark){html,body{background:#0d1020;}#flashify-boot-splash{background:#0d1020;color:#f8fbff;}#flashify-boot-splash p{color:#c8d1e3;}#flashify-boot-splash span{background:#b2c1ff;color:#11172b;}}
            `,
          }}
        />
        <div id="flashify-boot-splash" aria-hidden="true">
          <div>
            <span>F</span>
            <p>Loading Flashify</p>
            <i />
          </div>
        </div>
        <BootSplashDismissal />
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
