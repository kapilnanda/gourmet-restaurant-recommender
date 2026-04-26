import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "on-secondary": "#ffffff",
        "secondary-fixed-dim": "#66dd8b",
        "tertiary": "#5e5e5b",
        "surface-container-lowest": "#ffffff",
        "on-primary": "#ffffff",
        "on-error": "#ffffff",
        "primary-container": "#d4af37",
        "on-tertiary-container": "#454542",
        "on-primary-fixed-variant": "#574500",
        "surface-container-highest": "#e4e2e2",
        "surface-container": "#efeded",
        "background": "#fbf9f8",
        "on-secondary-container": "#00743a",
        "secondary": "#006d36",
        "tertiary-container": "#b4b3af",
        "on-surface-variant": "#4d4635",
        "surface": "#fbf9f8",
        "primary-fixed": "#ffe088",
        "tertiary-fixed": "#e4e2dd",
        "surface-variant": "#e4e2e2",
        "on-tertiary-fixed": "#1b1c19",
        "on-surface": "#1b1c1c",
        "surface-bright": "#fbf9f8",
        "on-tertiary-fixed-variant": "#474744",
        "surface-container-high": "#eae8e7",
        "secondary-fixed": "#83fba5",
        "on-secondary-fixed-variant": "#005227",
        "surface-container-low": "#f5f3f3",
        "outline": "#7f7663",
        "surface-dim": "#dbd9d9",
        "error": "#ba1a1a",
        "on-tertiary": "#ffffff",
        "inverse-primary": "#e9c349",
        "on-primary-fixed": "#241a00",
        "inverse-surface": "#303030",
        "surface-tint": "#735c00",
        "on-background": "#1b1c1c",
        "on-secondary-fixed": "#00210c",
        "outline-variant": "#d0c5af",
        "tertiary-fixed-dim": "#c8c6c2",
        "on-error-container": "#93000a",
        "inverse-on-surface": "#f2f0f0",
        "secondary-container": "#83fba5",
        "primary": "#735c00",
        "error-container": "#ffdad6",
        "primary-fixed-dim": "#e9c349",
        "on-primary-container": "#554300"
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px"
      },
      spacing: {
        "xl": "48px",
        "container-margin": "20px",
        "gutter": "16px",
        "sm": "8px",
        "xs": "4px",
        "md": "16px",
        "lg": "24px",
        "unit": "4px"
      },
      fontFamily: {
        "h2": ["var(--font-space-grotesk)", "sans-serif"],
        "label-sm": ["var(--font-inter)", "sans-serif"],
        "h1": ["var(--font-space-grotesk)", "sans-serif"],
        "h3": ["var(--font-space-grotesk)", "sans-serif"],
        "body-md": ["var(--font-inter)", "sans-serif"],
        "body-lg": ["var(--font-inter)", "sans-serif"]
      },
      fontSize: {
        "h2": ["32px", {"lineHeight": "1.2", "letterSpacing": "-0.01em", "fontWeight": "600"}],
        "label-sm": ["12px", {"lineHeight": "1.0", "letterSpacing": "0.05em", "fontWeight": "600"}],
        "h1": ["40px", {"lineHeight": "1.1", "letterSpacing": "-0.02em", "fontWeight": "700"}],
        "h3": ["24px", {"lineHeight": "1.3", "fontWeight": "600"}],
        "body-md": ["16px", {"lineHeight": "1.6", "fontWeight": "400"}],
        "body-lg": ["18px", {"lineHeight": "1.6", "fontWeight": "400"}]
      }
    },
  },
  plugins: [],
};
export default config;
