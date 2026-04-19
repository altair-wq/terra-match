"use client";

import Link from "next/link";
import { Layers, Map, Settings, Users, LogOut, MessageSquare, Briefcase } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col text-slate-300">
        <div className="p-6 flex items-center gap-3 font-extrabold text-xl text-white">
          <div className="w-8 h-8 flex justify-center items-center rounded-md bg-emerald-500">
            <Map className="w-5 h-5 text-slate-900" /> 
          </div>
          <span className="tracking-tight">TerraMatch</span>
        </div>
        
        <div className="px-6 mb-6">
          <div className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">Systems</div>
          <nav className="space-y-1">
            <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 shadow-sm relative focus:outline-none">
              <Briefcase className="w-4 h-4" /> Operations Hub
            </Link>
            <Link href="/dashboard/registry" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
              <Users className="w-4 h-4" /> Global Registry
            </Link>
            <Link href="/dashboard/polygons" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
              <Layers className="w-4 h-4" /> Master Polygons
            </Link>
          </nav>
        </div>

        <div className="flex-1"></div>

        <div className="p-4 bg-slate-950/40 border-t border-slate-800/50">
          <Link href="#" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-slate-400 hover:text-white transition-colors">
            <Settings className="w-4 h-4" /> Node Configuration
          </Link>
          <Link href="/" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-slate-400 hover:text-amber-400 transition-colors mt-1">
            <LogOut className="w-4 h-4" /> Disconnect
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#f8fafc]">
        {children}
      </main>
    </div>
  );
}
