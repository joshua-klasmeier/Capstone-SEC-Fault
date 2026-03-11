/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        'text-primary': '#1f2937',
        'text-secondary': '#6b7280',
        'surface': '#f9fafb',
        'border': '#e5e7eb',
        'accent': '#3b82f6',
      },
    },
  },
  plugins: [],
}
