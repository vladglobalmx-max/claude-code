import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "GAIOS — Global AI Operating System",
  description: "Plataforma empresarial de agentes de IA, CRM y base de conocimiento de Global Supplier MTY.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="antialiased">
        {children}
        <Toaster theme="dark" position="top-right" richColors />
      </body>
    </html>
  );
}
