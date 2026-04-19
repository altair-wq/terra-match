"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FolderPlus, UploadCloud, ChevronRight, Activity, Plus } from "lucide-react";

export default function DashboardOverview() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [kmzFile, setKmzFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch("http://localhost:8000/api/projects")
      .then(res => res.json())
      .then(data => {
        setProjects(data.projects || []);
        setLoading(false);
      });
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !csvFile || !kmzFile) return alert("Please fill all fields");
    setUploading(true);
    const fd = new FormData();
    fd.append("name", name);
    fd.append("csv_file", csvFile);
    fd.append("kmz_file", kmzFile);
    
    try {
      const res = await fetch("http://localhost:8000/api/projects/upload", {
        method: "POST",
        body: fd
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const error = await res.json();
        alert("Error: " + error.detail);
      }
    } catch(err: any) {
      alert("Network error: " + err.message);
    }
    setUploading(false);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Active Registries</h1>
          <p className="text-slate-500 mt-1">Manage spatial datasets destined for carbon credentialing.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-slate-900 hover:bg-slate-800 text-white font-medium py-2 px-5 rounded-md flex justify-center items-center gap-2 transition-all shadow-sm"
        >
          <Plus className="w-4 h-4"/> New Project Target
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-slate-400 items-center gap-3">
           <Activity className="w-5 h-5 animate-spin" /> Loading geospatial entries...
        </div>
      ) : projects.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <FolderPlus className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-1">No Projects Found</h3>
          <p className="text-slate-500 max-w-sm mx-auto mb-6">Upload KML/KMZ schemas and your farmer CSV administrative documents to initialize the review pipelines.</p>
          <button onClick={() => setShowModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-5 rounded-md inline-flex items-center gap-2 transition-all shadow-sm">
             Initiate First Target
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-sm text-slate-500">
                <th className="py-4 px-6 font-medium">Project Target</th>
                <th className="py-4 px-6 font-medium">Pipeline Status</th>
                <th className="py-4 px-6 font-medium text-right">Farmer Registry</th>
                <th className="py-4 px-6 font-medium text-right">Target Polygons</th>
                <th className="py-4 px-6 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p: any) => (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                  <td className="py-4 px-6">
                    <div className="font-bold text-slate-900">{p.name}</div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">ID-{p.id.toString().padStart(6, '0')}</div>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold
                      ${p.status === 'Audit Ready' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}
                    `}>
                      {p.status === 'Audit Ready' ? '✓ Audit Ready' : '• Pending Matching'}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right font-medium text-slate-700">{p.farmer_count} Records</td>
                  <td className="py-4 px-6 text-right font-medium text-slate-700">{p.polygon_count} Shapes</td>
                  <td className="py-4 px-6 text-right">
                    <Link href={`/dashboard/projects/${p.id}`} className="inline-flex items-center text-emerald-600 font-medium hover:text-emerald-700 hover:underline">
                      Open Workspace <ChevronRight className="w-4 h-4 ml-1" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload Modal Drawer */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border w-full max-w-lg p-6 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2"><FolderPlus className="w-5 h-5 text-slate-400"/> New Registry Target</h2>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Target Nomenclature</label>
                <input type="text" value={name} onChange={e=>setName(e.target.value)} className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all" required placeholder="e.g. Q4 Eastern Woodlands Base" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Administrative Farmers (CSV)</label>
                <input type="file" accept=".csv" onChange={e=>setCsvFile(e.target.files?.[0]||null)} className="w-full text-sm border rounded-md p-2 file:bg-slate-100 file:border-0 file:py-1 file:px-3 file:rounded file:text-slate-700 hover:file:bg-slate-200 file:cursor-pointer" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Spatial Perimeter Maps (KMZ/KML)</label>
                <input type="file" accept=".kmz,.kml" onChange={e=>setKmzFile(e.target.files?.[0]||null)} className="w-full text-sm border rounded-md p-2 file:bg-slate-100 file:border-0 file:py-1 file:px-3 file:rounded file:text-slate-700 hover:file:bg-slate-200 file:cursor-pointer" required />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-white border border-slate-300 text-slate-700 font-medium py-2 rounded-md hover:bg-slate-50 transition-all">Cancel</button>
                <button disabled={uploading} type="submit" className="flex-1 bg-emerald-600 text-white font-medium py-2 rounded-md hover:bg-emerald-700 flex justify-center items-center gap-2 disabled:opacity-50 transition-all">
                  {uploading ? <Activity className="w-5 h-5 animate-spin" /> : <><UploadCloud className="w-4 h-4"/> Commit Target</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
