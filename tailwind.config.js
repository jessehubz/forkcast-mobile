/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // ── Diner side (D) — teal-green palette ───────────────────────────────
        // Usage: bg-d-bg, text-d-text, border-d-border, etc.
        d: {
          bg:               "#080F0D",
          "bg-warm":        "#0C1410",
          surface:          "#0F1C18",
          "surface-raised": "#162420",
          border:           "#1C3028",
          "border-light":   "#122018",
          text:             "#E4EFE8",
          "text-sub":       "#56887A",
          "text-dim":       "#2C4E44",
          accent:           "#8EAD13",
          "accent-mid":     "#26E4BC",
          "accent-light":   "#082620",
          success:          "#2ECC8A",
          "success-bg":     "#092018",
          warning:          "#D4A030",
          "warning-bg":     "#251E08",
          danger:           "#E05060",
          "danger-bg":      "#2A1015",
        },
        // ── Owner side (O) — amber palette ────────────────────────────────────
        // Usage: bg-o-bg, text-o-text, border-o-border, etc.
        o: {
          bg:               "#080F0D",
          "bg-surface":     "#0C1410",
          surface:          "#0F1C18",
          "surface-high":   "#162420",
          border:           "#1C3028",
          "border-light":   "#122018",
          text:             "#EDE8DC",
          "text-sub":       "#9E9280",
          "text-dim":       "#5E5448",
          accent:           "#C9922A",
          "accent-mid":     "#D9A840",
          "accent-warm":    "#201508",
          success:          "#2ECC8A",
          "success-bg":     "#092018",
          warning:          "#E8A030",
          "warning-bg":     "#2A1E08",
          danger:           "#E05060",
          "danger-bg":      "#2A1015",
        },
      },
    },
  },
  plugins: [],
};
