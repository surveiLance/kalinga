import type { Metadata } from "next";
import { Chonburi, Domine } from "next/font/google";
import "./globals.css";

const chonburi = Chonburi({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-chonburi",
  display: "swap",
});

const domine = Domine({
  weight: "variable",
  subsets: ["latin"],
  variable: "--font-domine",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kalinga — Teachers’ Assistant",
  description: "A simpler way to plan, teach, and share in multigrade classrooms.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${chonburi.variable} ${domine.variable}`}><body>{children}</body></html>;
}
