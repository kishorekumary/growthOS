import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Zenith — Peak Performance',
  description: 'Your AI-powered operating system for peak performance — habits, goals, fitness, and finance in one place.',
}

export const viewport: Viewport = {
  themeColor: '#07071a',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="font-sans" suppressHydrationWarning>{children}</body>
    </html>
  )
}
