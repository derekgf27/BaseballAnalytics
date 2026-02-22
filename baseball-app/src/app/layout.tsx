import type { Metadata } from "next";
import { IBM_Plex_Sans, Oswald } from "next/font/google";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-ibm-plex-sans",
});

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--font-oswald",
});

export const metadata: Metadata = {
  title: "Baseball Analytics",
  description: "Internal semi-pro baseball analytics — analyst & coach modes",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${ibmPlexSans.variable} ${oswald.variable}`}>
      <body className={`${ibmPlexSans.className} min-h-screen bg-[var(--bg-base)] text-[var(--text)] antialiased`}>
        {children}
      </body>
    </html>
  );
}
