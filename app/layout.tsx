import type { Metadata } from "next";
import { Nunito, PT_Sans } from "next/font/google";
import "./globals.css";

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
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${nunito.variable} ${ptSans.variable}`}><body>{children}</body></html>;
}
