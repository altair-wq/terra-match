"use client";

import { useState } from "react";
import { Users, Search, Download, Filter } from "lucide-react";

export default function GlobalRegistry() {
  const [searchTerm, setSearchTerm] = useState("");
  
  // Dummy data representing global scaling
  const registry = [
    { id: "A102", name: "John N.", group: "Q4 Base", area: 3.2, project: "P-1", status: "Verified" },
    { id: "A105", name: "Samuel R.", group: "East Woodlands", area: 1.5, project: "P-1", status: "Pending" },
    { id: "A109", name: "Mary O.", group: "East Woodlands", area: 4.1, project: "P-1", status: "Verified" },
    { id: "B201", name: "Peter T.", group: "Highlands", area: 5.6, project: "P-2", status: "Verified" },
    { id: "B204", name: "David M.", group: "Highlands", area: 2.3, project: "P-2", status: "Review" },
    { id: "C303", name: "Sarah L.", group: "River Valley", area: 8.4, project: "P-3", status: "Verified" },
    { id: "C308", name: "Emma H.", group: "River Valley", area: 1.1, project: "P-3", status: "Pending" },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
             <Users className="w-8 h-8 text-emerald-600"/> Global Farmer Registry
          </h1>
          <p className="text-slate-500 mt-1">Cross-project consolidated database of all ingested agricultural entities.</p>
        </div>
        <button className="bg-white border border-slate-300 text-slate-700 font-medium py-2 px-4 rounded-md flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm">
          <Download className="w-4 h-4"/> Extract to CSV
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex gap-4 bg-slate-50">
           <div className="relative flex-1">
             <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
             <input type="text" placeholder="Query Farmer ID or Group..." className="w-full pl-9 pr-4 py-2 text-sm border rounded-md outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
           </div>
           <button className="px-4 py-2 text-sm font-medium border rounded-md bg-white text-slate-600 flex items-center gap-2 hover:bg-slate-50">
             <Filter className="w-4 h-4"/> Filters
           </button>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white border-b border-slate-200 text-sm text-slate-500">
              <th className="py-4 px-6 font-medium">Farmer ID</th>
              <th className="py-4 px-6 font-medium">Identity</th>
              <th className="py-4 px-6 font-medium">Cohort / Group</th>
              <th className="py-4 px-6 font-medium text-right">Reported Extent</th>
              <th className="py-4 px-6 font-medium">Origin Project</th>
              <th className="py-4 px-6 font-medium">Audit Status</th>
              <th className="py-4 px-6 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {registry.filter(r => r.id.toLowerCase().includes(searchTerm.toLowerCase()) || r.group.toLowerCase().includes(searchTerm.toLowerCase())).map((r, i) => (
              <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="py-4 px-6 font-bold text-slate-900">{r.id}</td>
                <td className="py-4 px-6 text-slate-600">{r.name}</td>
                <td className="py-4 px-6 text-slate-600 font-mono text-sm">{r.group}</td>
                <td className="py-4 px-6 text-right font-medium text-slate-700">{r.area} ha</td>
                <td className="py-4 px-6"><span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md text-xs font-semibold">{r.project}</span></td>
                <td className="py-4 px-6">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold
                    ${r.status === 'Verified' ? 'bg-emerald-100 text-emerald-800' : r.status === 'Review' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}
                  `}>
                    {r.status}
                  </span>
                </td>
                <td className="py-4 px-6 text-right">
                  <button onClick={() => alert(`Contextualizing map view for ${r.id}... Accessing historical spatial artifacts.`)} className="text-emerald-600 hover:text-emerald-700 font-bold text-xs uppercase tracking-tighter">
                    Map Link
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
