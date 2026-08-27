import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { CsrfBootstrap } from "@/shared/ui/csrf-bootstrap";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SIGAF | Sistema Integral de Gestión de Archivos",
  description:
    "Sistema Integral de Gestión de Archivos Físicos y Documentales",
  appleWebApp: {
    capable: true,
    title: "SIGAF",
    statusBarStyle: "default",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <CsrfBootstrap />
        {children}
        <Toaster richColors position="top-center" closeButton />
      </body>
    </html>
  );
}
