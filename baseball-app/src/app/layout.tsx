import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Orbitron, Oswald } from "next/font/google";
import "./globals.css";
import { AuthHeaderBar } from "@/components/auth/AuthHeaderBar";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-ibm-plex-sans",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-ibm-plex-mono",
});

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--font-oswald",
});

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--font-orbitron",
});

export const metadata: Metadata = {
  title: "Baseball Analytics",
  description: "Internal semi-pro baseball analytics — analyst & coach modes",
  icons: { icon: "/favicon.svg" },
  appleWebApp: {
    capable: true,
    title: "Baseball Analytics",
    statusBarStyle: "black-translucent",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0a0e12",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} ${oswald.variable} ${orbitron.variable}`}>
      <body className={`${ibmPlexSans.className} min-h-screen bg-[var(--bg-base)] text-[var(--text)] antialiased`}>
        <div className="flex min-h-screen flex-col">
          <AuthHeaderBar />
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </div>
      </body>
    </html>
  );
}
