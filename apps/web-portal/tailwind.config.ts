import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#eef6ff",
          100: "#d9ebff",
          500: "#1f5f99",
          700: "#123f67",
          900: "#08233d"
        },
        success: "#16a34a"
      },
      boxShadow: {
        soft: "0 18px 45px rgba(8, 35, 61, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
