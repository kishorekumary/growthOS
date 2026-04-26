export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-purple-600/20 border border-purple-500/30 mb-4">
            <span className="text-2xl">🌱</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Growth<span className="text-purple-400">OS</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">Your personal growth operating system</p>
        </div>
        {children}
      </div>
    </div>
  )
}
