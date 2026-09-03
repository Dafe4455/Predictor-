import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Football Predictions — xG-Based Match Analytics",
  description: "AI-powered football predictions using expected goals, team form, and advanced statistical models",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
