import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './client/app/**/*.{js,ts,jsx,tsx,mdx}',
    './client/components/**/*.{js,ts,jsx,tsx,mdx}',
    './client/pages/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brandNavy: "#284472",
        brandLightPink: "#fff2ee",
        brandPink: "#fdeeea",
        brandLightBrown: "#efe4e1",
        brandBrown: "#675a5e",
      },
    },
  },
  plugins: [],
}
export default config
