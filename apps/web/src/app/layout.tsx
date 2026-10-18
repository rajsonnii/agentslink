import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Agent Slink | Autonomous Self-Healing Control Plane',
  description: 'Self-healing platform watching applications, diagnosing root causes, and restoring service.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#090d16] text-gray-100 antialiased selection:bg-emerald-500/30">
        <header className="sticky top-0 z-50 border-b border-gray-800/80 bg-[#090d16]/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-2xl ring-1 ring-emerald-500/30">
                🦎
              </span>
              <div>
                <span className="text-lg font-bold tracking-tight text-white">
                  Agent Slink
                </span>
                <span className="ml-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
                  Coolify Cloud
                </span>
              </div>
            </div>

            <nav className="flex items-center gap-6 text-sm font-medium text-gray-400">
              <a href="/" className="text-white transition-colors hover:text-emerald-400">
                Incidents
              </a>
              <a href="#logs" className="transition-colors hover:text-white">
                Live Stream
              </a>
              <a href="#settings" className="transition-colors hover:text-white">
                Projects
              </a>
              <div className="flex items-center gap-2 rounded-full border border-gray-800 bg-gray-900/60 px-3 py-1.5 text-xs text-gray-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400"></span>
                <span>Agent Online</span>
              </div>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
