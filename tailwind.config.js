/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#031322",
        accent: "#CDE736",
        "accent-soft": "#C5F758",
        secondary: "#AED4E8",
        surface: "#F4F4F5",
        dark: "#021010",
        card: "#171C1C",
        muted: "#C5C5C5",
        icon: "#60636E",
      },
      maxWidth: {
        content: "1680px",
      },
    },
  },
};