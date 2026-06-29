import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        midnight: "#070b18",
        navy: {
          950: "#070b18", 900: "#0a0f24", 800: "#0f1830",
          700: "#162040", 600: "#1a2848", 500: "#203060",
        },
        gold: {
          950: "#3d2e0a", 900: "#5c4510", 800: "#8a6f2a",
          700: "#a88830", 600: "#c9a84c", 500: "#d4b85c",
          400: "#e8c96a", 300: "#f0d878", 200: "#f5e6a3", 100: "#f9f0cc",
        },
        parchment: { DEFAULT: "#e8dfc8", dim: "#b8a98a", dark: "#8a7a5a" },
        crimson: { DEFAULT: "#8b1a1a", dark: "#4a0a0a", light: "#b52222" },
        accent: "#c9a84c",
        "accent-light": "rgba(201,168,76,0.1)",
        "brand-800": "#0f1830",
      },
      fontFamily: {
        cinzel: ["var(--font-cinzel)", "Georgia", "serif"],
        garamond: ["var(--font-garamond)", "Georgia", "serif"],
        sans: ["var(--font-garamond)", "Georgia", "serif"],
      },
      backgroundImage: {
        "gold-shimmer": "linear-gradient(90deg,#8a6f2a 0%,#c9a84c 30%,#f5e6a3 50%,#c9a84c 70%,#8a6f2a 100%)",
      },
      boxShadow: {
        gold: "0 0 20px rgba(201,168,76,0.3)",
        "gold-lg": "0 0 50px rgba(201,168,76,0.4)",
        panel: "4px 0 40px rgba(0,0,0,0.5)",
        dark: "0 25px 60px rgba(0,0,0,0.6)",
      },
      animation: {
        float: "float 5s ease-in-out infinite",
        "float-slow": "float-slow 8s ease-in-out infinite",
        shimmer: "shimmer-gold 4s linear infinite",
        scales: "scales-swing 4s ease-in-out infinite",
        gavel: "gavel-strike 0.5s ease-out forwards",
        "slide-up": "slide-up-fade 0.6s ease-out both",
        "slide-right": "slide-right-fade 0.5s ease-out both",
        "scale-in": "scale-in 0.5s ease-out both",
        "fade-in": "fade-in 0.8s ease-out both",
        "pulse-gold": "pulse-glow 3s ease-in-out infinite",
        "ray-pulse": "light-ray-pulse 8s ease-in-out infinite",
        "particle-rise": "particle-rise 15s linear infinite",
        "spin-slow": "spin 30s linear infinite",
        "border-flow": "border-shimmer 3s ease-in-out infinite",
      },
      keyframes: {
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-12px)" } },
        "float-slow": {
          "0%,100%": { transform: "translateY(0) rotate(0deg)" },
          "33%": { transform: "translateY(-8px) rotate(0.5deg)" },
          "66%": { transform: "translateY(-3px) rotate(-0.5deg)" },
        },
        "shimmer-gold": { "0%": { backgroundPosition: "-200% center" }, "100%": { backgroundPosition: "200% center" } },
        "scales-swing": { "0%,100%": { transform: "rotate(-6deg)" }, "50%": { transform: "rotate(6deg)" } },
        "gavel-strike": {
          "0%": { transform: "rotate(-50deg) translateY(-10px)" },
          "50%": { transform: "rotate(12deg) translateY(4px)" },
          "75%": { transform: "rotate(-6deg) translateY(0)" },
          "100%": { transform: "rotate(0deg) translateY(0)" },
        },
        "particle-rise": {
          "0%": { transform: "translateY(0) translateX(0)", opacity: "0" },
          "5%": { opacity: "0.5" },
          "95%": { opacity: "0.2" },
          "100%": { transform: "translateY(-100vh) translateX(var(--drift,30px))", opacity: "0" },
        },
        "light-ray-pulse": { "0%,100%": { opacity: "0.04" }, "50%": { opacity: "0.1" } },
        "slide-up-fade": { "0%": { transform: "translateY(24px)", opacity: "0" }, "100%": { transform: "translateY(0)", opacity: "1" } },
        "slide-right-fade": { "0%": { transform: "translateX(-24px)", opacity: "0" }, "100%": { transform: "translateX(0)", opacity: "1" } },
        "scale-in": { "0%": { transform: "scale(0.9)", opacity: "0" }, "100%": { transform: "scale(1)", opacity: "1" } },
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        "pulse-glow": {
          "0%,100%": { boxShadow: "0 0 10px rgba(201,168,76,0.2)" },
          "50%": { boxShadow: "0 0 35px rgba(201,168,76,0.5),0 0 70px rgba(201,168,76,0.15)" },
        },
        "border-shimmer": {
          "0%,100%": { borderColor: "rgba(201,168,76,0.2)" },
          "50%": { borderColor: "rgba(201,168,76,0.55)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
