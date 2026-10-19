import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Privacy · Zenith' }

// Public page: Health Connect requires apps that read health data to link
// a privacy policy explaining what they read and why.
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-slate-300">
      <Link href="/" className="text-xs text-violet-400 hover:text-violet-300">← Zenith</Link>
      <h1 className="mt-4 text-2xl font-bold text-white">Privacy policy</h1>
      <p className="mt-1 text-xs text-slate-500">Last updated 19 October 2026</p>

      <section className="mt-8 space-y-3 text-sm leading-relaxed">
        <h2 className="text-base font-semibold text-white">What Zenith stores</h2>
        <p>
          Zenith stores what you enter yourself — habits, plans, goals, journal entries, workouts,
          sleep, finances and similar — in your own account so you can track your progress. Your data
          is only visible to you and to the app&apos;s administrators for support. It is never sold or
          shared with advertisers.
        </p>

        <h2 className="pt-4 text-base font-semibold text-white">Health Connect (Android)</h2>
        <p>
          If you choose to connect Samsung Health or another app through Android Health Connect,
          Zenith reads only two kinds of data, and only while the app is open:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li><b className="text-slate-200">Exercise sessions</b> — type, date, duration, distance and calories — saved as entries in Fitness.</li>
          <li><b className="text-slate-200">Sleep sessions</b> — bedtime, wake time and sleep stages — saved as entries in Sleep.</li>
        </ul>
        <p>
          Zenith never writes to Health Connect and does not read any other health data. Imported
          entries are used only to show your own progress inside the app. You can disconnect at any
          time in Settings → Health data, revoke access in Health Connect, and delete any imported
          entry like one you logged yourself.
        </p>

        <h2 className="pt-4 text-base font-semibold text-white">Deleting your data</h2>
        <p>
          You can delete entries in the app at any time. To delete your whole account and everything
          in it, contact the administrator of your Zenith workspace.
        </p>
      </section>
    </main>
  )
}
