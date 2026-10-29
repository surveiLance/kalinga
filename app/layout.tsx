import type { Metadata } from "next";
import { Nunito, PT_Sans } from "next/font/google";
import "./globals.css";
import { OfflineAvailability } from "@/components/offline-availability";
import { AppInstall } from "@/components/app-install";
import { AppUpdates } from "@/components/app-updates";

const nunito = Nunito({
  weight: "variable",
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

const ptSans = PT_Sans({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-pt-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kalinga — Teachers’ Assistant",
  description: "A simpler way to plan, teach, and share in multigrade classrooms.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
    apple: [{ url: "/offline/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: "Kalinga", statusBarStyle: "default" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${nunito.variable} ${ptSans.variable}`}><body><OfflineAvailability /><AppInstall /><AppUpdates />{children}</body></html>;
}
