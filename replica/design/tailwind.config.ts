import type { Config } from "tailwindcss";

// Les composants utilisent ces noms (bg-surface, text-muted), jamais d'hex brut.
// Les valeurs viennent de tokens.css, que replica-brand remplace.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        border: "var(--color-border)",
        "border-input": "var(--color-border-input)",
        text: "var(--color-text)",
        muted: "var(--color-text-muted)",
        accent: "var(--color-accent)",
        "on-accent": "var(--color-on-accent)",
        "accent-subtle": "var(--color-accent-subtle)",
        danger: "var(--color-danger)",
        "on-danger": "var(--color-on-danger)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
      },
      fontFamily: { sans: "var(--font-sans)", mono: "var(--font-mono)" },
      fontSize: {
        xs: ["var(--text-xs)", { lineHeight: "var(--text-xs-line)", fontWeight: "var(--text-xs-weight)" }],
        sm: ["var(--text-sm)", { lineHeight: "var(--text-sm-line)", fontWeight: "var(--text-sm-weight)" }],
        base: ["var(--text-base)", { lineHeight: "var(--text-base-line)", fontWeight: "var(--text-base-weight)" }],
        lg: ["var(--text-lg)", { lineHeight: "var(--text-lg-line)", fontWeight: "var(--text-lg-weight)" }],
        xl: ["var(--text-xl)", { lineHeight: "var(--text-xl-line)", fontWeight: "var(--text-xl-weight)" }],
        display: ["var(--text-display)", { lineHeight: "var(--text-display-line)", fontWeight: "var(--text-display-weight)" }],
      },
      borderRadius: {
        sm: "var(--radius-sm)", md: "var(--radius-md)", lg: "var(--radius-lg)", pill: "var(--radius-pill)",
      },
      boxShadow: { card: "var(--shadow-card)", pop: "var(--shadow-pop)" },
      transitionDuration: { fast: "var(--motion-fast)", base: "var(--motion-base)" },
      maxWidth: { content: "var(--content-max)", booking: "var(--booking-card-max)" },
    },
  },
};
export default config;
