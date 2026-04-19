"use client";

import { Layers, Download, Lock } from "lucide-react";

export default function MasterPolygons() {
  return (
    <div className="p-8 max-w-7xl mx-auto w-full h-full flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
             <Layers className="w-8 h-8 text-emerald-600"/> Master Polygons Core
          </h1>
          <p className="text-slate-500 mt-1">Aggregated geospatial shapes spanning all historical registries securely locked in the vault.</p>
        </div>
        <button className="bg-slate-900 text-white font-medium py-2 px-4 rounded-md flex items-center gap-2 hover:bg-slate-800 transition-all shadow-sm">
          <Download className="w-4 h-4"/> Export Master Shapefile
        </button>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        <div className="flex-1 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 flex flex-col items-center justify-center text-center p-12">
           <div className="w-20 h-20 bg-emerald-100 rounded-full flex flex-col items-center justify-center mb-4 relative shadow-inner animate-pulse">
              <Lock className="w-8 h-8 text-emerald-600"/>
           </div>
           <h2 className="text-2xl font-bold text-slate-800 mb-2">Vault Access Restricted</h2>
           <p className="text-slate-500 max-w-md leading-relaxed mb-6">
              The Master Polygons dataset contains sensitive immutable geometric artifacts mapped to all validated projects. 
              Modifying or directly viewing the raw multi-tenant grid requires Level-3 Analyst permissions.
           </p>
           <button className="bg-white border border-slate-300 text-slate-700 font-semibold py-2 px-6 rounded-md hover:bg-slate-50 shadow-sm transition-all focus:scale-95">
              Request Analyst Access
           </button>
        </div>

        <div className="w-80 bg-white rounded-xl border border-slate-200 p-6 shadow-sm overflow-y-auto">
           <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-4">Metadata Stream</h3>
           <div className="space-y-4">
              {[
                { label: "Total Asset Count", value: "4,902 Shapes" },
                { label: "Aggregate Area", value: "12,450.2 ha" },
                { label: "Conflict Rate", value: "0.24%" },
                { label: "Verification Gap", value: "112 ha" },
              ].map((stat, idx) => (
                <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                   <div className="text-[10px] text-slate-400 font-bold uppercase">{stat.label}</div>
                   <div className="text-lg font-black text-slate-800">{stat.value}</div>
                </div>
              ))}
           </div>
           <div className="mt-8 pt-6 border-t border-slate-100">
              <div className="text-[10px] text-slate-400 font-bold uppercase mb-2">Security Hash</div>
              <div className="text-[10px] font-mono text-slate-300 break-all leading-tight">
                0x71cA...B9e4...293D...F2a1
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
