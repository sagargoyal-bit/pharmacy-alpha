import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store/providers/StoreProvider";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { NotificationToast } from "@/components/ui/NotificationToast";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pharmacy Manager",
  description: "A comprehensive pharmacy inventory management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geist.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <StoreProvider>
            {children}
            <NotificationToast />
          </StoreProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
