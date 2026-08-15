import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "hsl(var(--gso-bg) / <alpha-value>)",
        surface: "hsl(var(--gso-surface) / <alpha-value>)",
        "surface-2": "hsl(var(--gso-surface-2) / <alpha-value>)",
        border: "hsl(var(--gso-border) / <alpha-value>)",
        ink: "hsl(var(--gso-ink) / <alpha-value>)",
        "ink-soft": "hsl(var(--gso-ink-soft) / <alpha-value>)",
        "ink-faint": "hsl(var(--gso-ink-faint) / <alpha-value>)",
        accent: "hsl(var(--gso-accent) / <alpha-value>)",
        "accent-ink": "hsl(var(--gso-accent-ink) / <alpha-value>)",
        success: "hsl(var(--gso-success) / <alpha-value>)",
        warning: "hsl(var(--gso-warning) / <alpha-value>)",
        danger: "hsl(var(--gso-danger) / <alpha-value>)",
        "sidebar-bg": "hsl(var(--gso-sidebar-bg) / <alpha-value>)",
        "sidebar-ink": "hsl(var(--gso-sidebar-ink) / <alpha-value>)",
        "sidebar-ink-soft": "hsl(var(--gso-sidebar-ink-soft) / <alpha-value>)",
        "sidebar-border": "hsl(var(--gso-sidebar-border) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
      },
      borderRadius: {
        lg: "10px",
        xl: "14px",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 6px -2px rgb(0 0 0 / 0.06)",
        popover: "0 8px 24px -4px rgb(0 0 0 / 0.12), 0 2px 8px -2px rgb(0 0 0 / 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
