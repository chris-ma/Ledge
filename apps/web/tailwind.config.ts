import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ocean: {
          50: "#eef7fb",
          100: "#d3ecf4",
          400: "#4fa9c9",
          600: "#1f6d8c",
          900: "#0e2f3d",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
