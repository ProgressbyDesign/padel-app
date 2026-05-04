/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#003C3C",
        accent: "#E6FA50",
        secondary: "#2ED8AB",
        surface: "#F0F1F7",
        dark: "#02053C",
      },
    },
  },
};
