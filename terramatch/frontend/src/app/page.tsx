import Link from "next/link";
import { ArrowRight, Map, ShieldCheck, Leaf, Database, BarChart3, LockKeyhole } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-50 font-sans selection:bg-emerald-500/30">
      <header className="px-8 py-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2 font-bold text-2xl tracking-tight text-white">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.5)]">
            <Map className="w-5 h-5 text-slate-950" />
          </div>
          TerraMatch
        </div>
        <nav className="flex items-center gap-4">
          <Link href="/login" className="px-4 py-2 hover:bg-slate-800 rounded-md font-medium text-slate-300 transition-colors text-sm">Sign In</Link>
          <Link href="/dashboard" className="px-5 py-2 bg-emerald-500 text-slate-950 rounded-md font-semibold hover:bg-emerald-400 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] text-sm">Go to Dashboard</Link>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-32 relative overflow-hidden">
        {/* Abstract Background Element */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/10 rounded-full blur-[120px] -z-10 animate-pulse"></div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold mb-8 border border-emerald-500/20">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          System Online
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight max-w-4xl leading-[1.1]">
          Scalable Land Verification for <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Carbon Workflows</span>
        </h1>
        
        <p className="mt-8 text-xl text-slate-400 max-w-2xl leading-relaxed">
          The enterprise geospatial intelligence layer determining verifiable land-to-farmer ownership through heuristic ML workflows and auditing chains.
        </p>
        
        <div className="mt-12 flex gap-4">
          <Link href="/dashboard" className="px-8 py-4 bg-white hover:bg-slate-200 text-slate-900 rounded-lg text-lg font-bold flex items-center gap-2 transition-all">
            Launch Platform <ArrowRight className="w-5 h-5" />
          </Link>
          <Link href="#features" className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-lg text-lg font-medium flex items-center gap-2 transition-all">
            View Protocol
          </Link>
        </div>

        <div id="features" className="mt-40 grid md:grid-cols-3 gap-8 max-w-6xl mx-auto text-left relative z-10">
          <div className="bg-slate-900/60 backdrop-blur-sm p-8 rounded-2xl border border-slate-800 hover:border-emerald-500/50 transition-colors group">
            <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Database className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">Automated Ingestion</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Robust pipeline processing KML/KMZ schemas and disparate tabular bounds to resolve precise area polygons autonomously.
            </p>
          </div>
          <div className="bg-slate-900/60 backdrop-blur-sm p-8 rounded-2xl border border-slate-800 hover:border-cyan-500/50 transition-colors group">
            <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <BarChart3 className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">Algorithmic Adjudication</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Applying Gemini reasoning alongside deterministic intersection checks parsing dimensional and geographic relative clues with deep conviction reporting.
            </p>
          </div>
          <div className="bg-slate-900/60 backdrop-blur-sm p-8 rounded-2xl border border-slate-800 hover:border-amber-500/50 transition-colors group">
            <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <LockKeyhole className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">Auditable Chains</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Manual review flags protect registry standards. Export fully transparent reconciliation graphs and explainability logs explicitly formatted for VVB auditors.
            </p>
          </div>
        </div>
      </main>
      
      <footer className="py-8 text-center text-sm text-slate-600 border-t border-slate-800 bg-slate-950">
        © 2026 TerraMatch. Track B • Smart Farming / Green Carbon
      </footer>
    </div>
  );
}
