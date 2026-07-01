/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    // .ts/.tsx added in v1.9 so the research module's TypeScript components are
    // scanned for utility classes (the existing .js/.jsx modules are unaffected).
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0B1F3A",
          deep: "#081428",
          700: "#143257",
          600: "#1E4374",
          200: "#C7D2E0",
          50: "#F3F6FA",
        },
        gold: {
          DEFAULT: "#C2A14D",
          600: "#A8883A",
          200: "#E8DCB8",
          50: "#FAF6EA",
        },
        paper: "#FBFAF7",
        ink: "#1A1D23",
        muted: "#5B6675",
        line: "#E4E2DB",
      },
      fontFamily: {
        serif: ["Georgia", "Cambria", "Times New Roman", "serif"],
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,31,58,0.04), 0 4px 16px rgba(11,31,58,0.06)",
      },
      borderRadius: {
        xl: "0.75rem",
      },
    },
  },
  plugins: [],
};
