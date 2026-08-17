import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kalinga — Teachers’ Assistant",
  description: "A simpler way to plan, teach, and share in multigrade classrooms.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
