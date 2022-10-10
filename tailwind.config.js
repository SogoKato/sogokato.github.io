/** @type {import("tailwindcss").Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        duchs: {
          100: "#FFEEE8",
          200: "#EBD6CF",
          500: "#D96236",
          800: "#732C1D",
          900: "#401A0D",
        },
      },
      fontFamily: {
        "display": ["rooney-sans", "sans-serif"]
      },
    },
  },
  plugins: [
    require("@tailwindcss/line-clamp"),
    require("@tailwindcss/typography"),
  ],
};
