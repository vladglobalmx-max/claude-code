import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GS Orders",
  description: "Pedidos internos — Global Supplier MTY",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
