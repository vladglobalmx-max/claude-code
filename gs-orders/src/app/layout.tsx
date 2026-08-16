import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

/**
 * UI font provisional; official THÖREN wordmark font pending
 * identification (ver THOREN_Manual_de_Marca.pdf sección 06 y
 * docs/THOREN_BRAND_SYSTEM.md). Inter se usa aquí solo como tipografía de
 * interfaz — nunca se declara como "la fuente oficial de THÖREN".
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "THÖREN",
  description: "Pedidos internos — Global Supplier MTY",
};

/** #23282B = Basalt (THÖREN_Manual_de_Marca.pdf, paleta oficial). */
export const viewport: Viewport = {
  themeColor: "#23282B",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
