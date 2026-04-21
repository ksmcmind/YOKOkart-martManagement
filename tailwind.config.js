/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,jsx}'],
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#E1F5EE',
                    100: '#9FE1CB',
                    200: '#5DCAA5',
                    500: '#1D9E75',
                    600: '#0F6E56',
                    700: '#085041',
                },
                accent: {
                    50: '#FFFBEB',
                    100: '#FEF3C7',
                    400: '#FBBF24',
                    500: '#F59E0B',
                    600: '#D97706',
                },
            },
        },
    },
    plugins: [],
}