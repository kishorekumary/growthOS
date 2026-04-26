export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <div className="text-center px-6">
        <div className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-purple-600/20 border border-purple-500/30">
          <span className="text-4xl">🌱</span>
        </div>
        <h1 className="text-6xl font-bold text-white mb-4 tracking-tight">
          Growth<span className="text-purple-400">OS</span>
        </h1>
        <p className="text-xl text-slate-400 mb-8 max-w-md mx-auto">
          Your personal AI-powered operating system for growth — fitness, finance, books, and beyond.
        </p>
        <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-5 py-2.5">
          <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
          <span className="text-purple-300 text-sm font-medium">Coming Soon</span>
        </div>
        <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-lg mx-auto">
          {['Fitness', 'Finance', 'Books', 'Personality'].map((module) => (
            <div
              key={module}
              className="bg-white/5 border border-white/10 rounded-xl p-4 text-slate-400 text-sm font-medium hover:bg-white/10 transition-colors"
            >
              {module}
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
