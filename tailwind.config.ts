import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'
import colors from 'tailwindcss/colors'
import animate from 'tailwindcss-animate'

// ── Light / dark theming ────────────────────────────────────────────
// The app's classes were written for a dark background (text-white,
// bg-white/5, text-slate-400, text-emerald-300 …). Rather than adding a
// light variant to every class, white, the slate scale and the light
// shades of each accent palette are CSS variables that the `.light` class
// on <html> swaps: white turns to near-black ink, slate inverts, and pale
// accent text gets darker shades so it stays readable on white. `snow` is
// a white that never flips — for text on solid accent buttons.

type Shade = '50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900' | '950'
const SHADES: Shade[] = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']
const ACCENTS = [
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal',
  'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
] as const

function rgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}

// Which shade each shade becomes in light mode.
const SLATE_LIGHT: Record<Shade, string> = {
  '50': '#020617', '100': '#0f172a', '200': '#1e293b', '300': '#334155', '400': '#475569',
  '500': '#64748b', '600': '#94a3b8', '700': '#cbd5e1', '800': '#e2e8f0', '900': '#ffffff', '950': '#f8fafc',
}
const ACCENT_LIGHT: Partial<Record<Shade, Shade>> = { '50': '900', '100': '800', '200': '800', '300': '700', '400': '600' }

const themeVar = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`
const palette = (name: string) => Object.fromEntries(SHADES.map(s => [s, themeVar(`${name}-${s}`)]))

const themeColors = plugin(({ addBase, addVariant }) => {
  // `light:` for the few spots the palette swap can't handle on its own.
  // Note shades 50–400 of accents flip dark in light mode; for a pale tint
  // use a 500+ shade with opacity (e.g. light:bg-violet-500/20).
  addVariant('light', ':root.light &')
  const dark: Record<string, string>  = {
    '--c-white': '255 255 255', '--c-surface': '13 13 26', '--c-surface-deep': '6 6 15',
  }
  const light: Record<string, string> = {
    '--c-white': '15 23 42', '--c-surface': '255 255 255', '--c-surface-deep': '250 250 253',
  }
  for (const s of SHADES) {
    dark[`--c-slate-${s}`]  = rgb(colors.slate[s])
    light[`--c-slate-${s}`] = rgb(SLATE_LIGHT[s])
    for (const a of ACCENTS) {
      dark[`--c-${a}-${s}`] = rgb(colors[a][s])
      const swap = ACCENT_LIGHT[s]
      if (swap) light[`--c-${a}-${s}`] = rgb(colors[a][swap])
    }
  }
  addBase({ ':root': dark, ':root.light': light })
})

const config: Config = {
  darkMode: ['class'],
  // Scope hover: styles to devices that actually hover. Without this, iOS
  // Safari treats the first tap on an element whose hover state changes
  // visibility (e.g. the habit undo icon swap) as a hover only, so the
  // click needs a second tap.
  future: { hoverOnlyWhenSupported: true },
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      colors: {
        white: themeVar('white'),
        snow: '#ffffff',
        surface: { DEFAULT: themeVar('surface'), deep: themeVar('surface-deep') },
        slate: palette('slate'),
        ...Object.fromEntries(ACCENTS.map(a => [a, palette(a)])),
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        pop:        { '0%': { transform: 'scale(0.8)' }, '60%': { transform: 'scale(1.15)' }, '100%': { transform: 'scale(1)' } },
        'float-up': { '0%': { opacity: '0', transform: 'translateY(4px)' }, '20%': { opacity: '1' }, '100%': { opacity: '0', transform: 'translateY(-14px)' } },
        'page-in':  { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        float:      { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-4px)' } },
        flicker:    { '0%, 100%': { transform: 'scale(1) rotate(0deg)' }, '25%': { transform: 'scale(1.08, 1.14) rotate(-3deg)' }, '50%': { transform: 'scale(0.96, 1.02) rotate(2deg)' }, '75%': { transform: 'scale(1.04, 1.1) rotate(-1deg)' } },
        breathe:    { '0%, 100%': { transform: 'scale(0.9)', opacity: '0.55' }, '50%': { transform: 'scale(1.08)', opacity: '0.95' } },
      },
      animation: {
        pop:        'pop 250ms ease-out',
        'float-up': 'float-up 900ms ease-out forwards',
        'page-in':  'page-in 220ms cubic-bezier(0.22, 1, 0.36, 1)',
        float:      'float 3.2s ease-in-out infinite',
        flicker:    'flicker 1.8s ease-in-out infinite',
        breathe:    'breathe 6s ease-in-out infinite',
      },
    },
  },
  plugins: [themeColors, animate],
}

export default config
