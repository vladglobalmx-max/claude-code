/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  // THÖREN — fix bug "PDF falla en Vercel: Cannot find module
  // '.../pdfkit/js/standard-fonts/Helvetica.cjs'". @react-pdf/renderer usa
  // pdfkit, que carga sus fuentes estándar (Helvetica/Courier/Symbol/...)
  // por require() dinámico en tiempo de ejecución, no por import estático
  // — el output file tracing de Next (que arma el bundle de cada función
  // serverless a partir de lo que detecta estáticamente) no los detecta y
  // los deja fuera del deployment. `outputFileTracingIncludes` es
  // EXPERIMENTAL en Next 14.2 (pasó a top-level/estable hasta Next 15) —
  // por eso vive bajo `experimental` aquí, no en la raíz del config.
  experimental: {
    outputFileTracingIncludes: {
      "/api/pdf/**": ["node_modules/pdfkit/js/standard-fonts/**"],
    },
  },
};

module.exports = nextConfig;
