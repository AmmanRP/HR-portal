import type { Metadata } from "next";
import "./globals.css";
import "./auth.css";
import "./court.css";

export const metadata: Metadata = {
  title: "PatrolDesk | Public Safety & Roleplay Court",
  description: "Department operations and fictional roleplay courthouse",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}