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
        light: {
          bg: '#f8f9fa', // 高级灰背景
          surface: '#ffffff', // white
          card: '#ffffff', // white
          border: '#f3f4f6', // gray-100 极细边框
          text: '#1e293b', // slate-800 深色文字
          'text-muted': '#6b7280', // gray-500 铂金灰
          accent: '#2563eb', // blue-600 科技深蓝
          'accent-dark': '#1e40af', // indigo-700
          success: '#059669', // emerald-600
          warning: '#d97706', // amber-600
          error: '#dc2626', // red-600
        },
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'soft': '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
      },
    },
  },
  plugins: [],
  darkMode: false,
}

