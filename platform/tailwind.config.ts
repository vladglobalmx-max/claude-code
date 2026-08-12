import type { Config } from "tailwindcss";

// Design tokens per Instrucción Maestra sección 19: empresarial, tecnológico,
// oscuro pero legible, sin exceso de efectos. El acento (accent) es azul eléctrico;
// el modo claro invierte las superficies conservando el mismo acento.
const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "hsl(var(--gaios-bg) / <alpha-value>)",
        surface: "hsl(var(--gaios-surface) / <alpha-value>)",
        "surface-2": "hsl(var(--gaios-surface-2) / <alpha-value>)",
        border: "hsl(var(--gaios-border) / <alpha-value>)",
        ink: "hsl(var(--gaios-ink) / <alpha-value>)",
        "ink-soft": "hsl(var(--gaios-ink-soft) / <alpha-value>)",
        "ink-faint": "hsl(var(--gaios-ink-faint) / <alpha-value>)",
        accent: "hsl(var(--gaios-accent) / <alpha-value>)",
        "accent-ink": "hsl(var(--gaios-accent-ink) / <alpha-value>)",
        success: "hsl(var(--gaios-success) / <alpha-value>)",
        warning: "hsl(var(--gaios-warning) / <alpha-value>)",
        danger: "hsl(var(--gaios-danger) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "12px",
      },
    },
  },
  plugins: [],
};

export default config;
