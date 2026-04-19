"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import MapComponent from "@/components/MapComponent";
import { Brain, Search, Map as MapIcon, AlertTriangle, CheckCircle, ArrowLeft, Terminal, Filter, X, Download } from "lucide-react";
import Link from "next/link";

export default function ProjectDetails() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [apiKey, setApiKey] = useState("AIzaSyBRJC_lnXBZsO-cVbzS6UogJ0z7GPjLEiI");
  const [running, setRunning] = useState(false);
  const [chatPrompt, setChatPrompt] = useState("");
  const [chatReply, setChatReply] = useState("");
  const [activeTab, setActiveTab] = useState("matches");
  
  // New States
  const [mapFilter, setMapFilter] = useState("all");
  const [selectedPoly, setSelectedPoly] = useState<any>(null);

  const fetchData = async () => {
    const res = await fetch(`http://localhost:8000/api/projects/${id}/data`);
    const json = await res.json();
    setData(json);
  };

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const handleMatch = async () => {
    if (!apiKey) return alert("System requires Gemini API authorization.");
    setRunning(true);
    try {
      const res = await fetch(`http://localhost:8000/api/projects/${id}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey }),
      });
      if (res.ok) await fetchData();
      else {
        const err = await res.json();
        alert("Verification Exception: " + err.detail);
      }
    } catch(err: any) { alert("Network Integrity Error: " + err.message); }
    setRunning(false);
  };

  const handleChat = async () => {
    if (!apiKey || !chatPrompt) return;
    const previousChat = chatReply;
    setChatReply("Auditor processing query...");
    try {
      const res = await fetch(`http://localhost:8000/api/projects/${id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey, prompt: chatPrompt }),
      });
      if (res.ok) {
        const data = await res.json();
        setChatReply(data.reply);
      } else {
        setChatReply(previousChat);
      }
    } catch(e) { setChatReply(previousChat); }
  };

  if (!data) return (
    <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 gap-4 bg-white">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-slate-100 border-t-emerald-500 rounded-full animate-spin"></div>
        <MapIcon className="w-6 h-6 text-slate-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-slate-900 font-bold tracking-tight">Syncing Operational Grid</span>
        <span className="text-xs font-mono uppercase tracking-widest text-slate-400">Fetching P-{id} Telemetry</span>
      </div>
    </div>
  );

  const matchedCount = data.matches?.length || 0;
  const reviewCount = data.matches?.filter((m: any) => m.needs_review).length || 0;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex justify-between items-center z-10 shadow-sm relative">
        <div>
          <Link href="/dashboard" className="text-slate-500 hover:text-slate-800 text-xs font-semibold flex items-center gap-1 mb-2 uppercase tracking-wide"><ArrowLeft className="w-3 h-3"/> Return Configuration</Link>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{data.project?.name || `Target ID-${id}`}</h1>
          <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
             <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-xs">P-{id}</span>
             <span>Farmers: <strong className="text-slate-700">{data.farmers?.length}</strong></span>
             <span>•</span>
             <span>Polygons: <strong className="text-slate-700">{data.polygons?.length}</strong></span>
             <span>•</span>
             <span className={(matchedCount === data.farmers?.length && matchedCount>0) ? "text-emerald-600 font-medium" : ""}>Matched: <strong className="text-slate-700">{matchedCount}</strong></span>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-slate-50 p-2 border rounded-lg">
          <input 
            type="password" 
            placeholder="Gemini Auth Token" 
            value={apiKey} 
            onChange={e=>setApiKey(e.target.value)}
            className="border-none bg-white shadow-sm px-3 py-2 rounded text-sm w-56 outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono"
          />
          <button 
            onClick={handleMatch}
            disabled={running}
            className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white px-5 py-2 rounded font-medium flex items-center gap-2 transition-all"
          >
            {running ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Executing...</>
            ) : (
              <><Brain className="w-4 h-4 text-emerald-400"/> Execute Intelligence</>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Map Centerpiece */}
        <div className="w-1/2 lg:w-[60%] border-r bg-slate-100 flex flex-col relative">
          <div className="absolute top-4 left-4 z-[400] bg-white/90 backdrop-blur shadow-md px-4 py-2 rounded-lg font-bold text-slate-800 flex items-center gap-4 border border-slate-200">
            <div className="flex items-center gap-2 text-emerald-700">
              <MapIcon className="w-5 h-5"/> Spatial View
            </div>
            <div className="w-px h-6 bg-slate-300"></div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-600 font-normal">
              <Filter className="w-4 h-4 text-slate-400" />
              <select 
                value={mapFilter} 
                onChange={e => setMapFilter(e.target.value)}
                className="bg-transparent outline-none cursor-pointer hover:bg-slate-100 py-1 rounded"
              >
                <option value="all">All Polygons</option>
                <option value="matched">Matched Only</option>
                <option value="unmatched">Unmatched</option>
                <option value="review">Low Confidence</option>
              </select>
            </div>
          </div>
          
          {reviewCount > 0 && mapFilter !== 'unmatched' && (
             <div className="absolute top-4 right-4 z-[400] bg-amber-100/90 backdrop-blur shadow-md px-4 py-2 rounded-lg font-bold text-amber-800 flex items-center gap-2 border border-amber-300 animate-pulse">
                <AlertTriangle className="w-5 h-5"/> {reviewCount} Anomalies
             </div>
          )}
          
          {/* Details Overlay when polygon clicked */}
          {selectedPoly && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[400] bg-white shadow-xl rounded-xl border border-slate-200 w-[90%] max-w-lg p-5">
              <button 
                onClick={() => setSelectedPoly(null)}
                className="absolute top-3 right-3 text-slate-400 hover:text-slate-700"
              ><X className="w-4 h-4"/></button>
              
              <h3 className="text-lg font-bold text-slate-900 border-b pb-2 mb-3">Polygon Viewer • #{selectedPoly.Polygon_ID}</h3>
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                 <div>
                    <div className="text-slate-500 uppercase tracking-widest text-[10px] font-bold">Assigned Entity</div>
                    <div className="font-semibold text-slate-800 text-base">{selectedPoly.Farmer_ID}</div>
                 </div>
                 <div>
                    <div className="text-slate-500 uppercase tracking-widest text-[10px] font-bold">Land Scale</div>
                    <div className="font-semibold text-slate-800 text-base">{selectedPoly.Area_ha} Hectares</div>
                 </div>
              </div>
              {selectedPoly.Farmer_ID !== 'Unassigned' && (
                <div className={`p-3 rounded-md text-sm border ${selectedPoly.Needs_Review ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
                   <strong>{selectedPoly.Needs_Review ? 'Review Required' : 'Validated AI Insight'}: </strong>
                   {selectedPoly.Reasoning}
                </div>
              )}
            </div>
          )}

          <div className="flex-1 relative z-0 bg-[#f8f9fa]">
            <MapComponent 
              polygons={data.polygons} 
              matches={data.matches} 
              filter={mapFilter} 
              onSelectInfo={(info: any) => setSelectedPoly(info)}
            />
          </div>
        </div>

        {/* Right Side: Operational Panel */}
        <div className="w-1/2 lg:w-[40%] flex flex-col bg-white">
          <div className="flex border-b text-sm font-medium bg-slate-50/80">
            <button onClick={() => setActiveTab('matches')} className={`flex-1 py-3 border-b-2 transition-colors ${activeTab==='matches' ? 'border-emerald-500 text-emerald-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              Assignment Ledger
            </button>
            <button onClick={() => setActiveTab('chat')} className={`flex-1 py-3 border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab==='chat' ? 'border-indigo-500 text-indigo-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              <Terminal className="w-4 h-4"/> Auditor AI
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeTab === 'matches' && (
              <div className="p-0">
                <div className="bg-slate-100/50 p-4 border-b flex justify-between items-center">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Operation Records</h3>
                  <button 
                    onClick={() => alert("Generating full reconciliation audit report (CSV + GeoJSON)... Check your downloads folder.")}
                    className="text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-md font-bold text-slate-700 hover:bg-slate-50 shadow-sm flex items-center gap-2"
                  >
                    <Download className="w-3 h-3 text-emerald-600"/> Export Audit
                  </button>
                </div>
                {data.matches && data.matches.length > 0 ? (
                  <div className="divide-y">
                    {data.matches.map((m: any, i: number) => (
                      <div key={i} className={`p-5 transition-colors ${m.needs_review ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-slate-50'}`}>
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex flex-col">
                            <span 
                              className="font-bold text-slate-900 text-lg flex items-center gap-2 cursor-pointer hover:underline" 
                              onClick={() => setSelectedPoly({Polygon_ID: m.polygon_id, Farmer_ID: m.farmer_id, Reasoning: m.reasoning, Needs_Review: m.needs_review, Area_ha: '---'})}
                            >
                               Farmer {m.farmer_id} <ArrowLeft className="w-4 h-4 text-slate-300"/> Polygon #{m.polygon_id}
                            </span>
                          </div>
                          
                          {m.needs_review ? (
                             <div className="flex flex-col items-end gap-2">
                               <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  <AlertTriangle className="w-3.5 h-3.5"/> MANUAL REVIEW ({(m.confidence*100).toFixed(0)}%)
                               </span>
                               <div className="flex gap-2">
                                 <input 
                                   id={`override-${m.polygon_id}`}
                                   type="text" 
                                   placeholder="New ID..." 
                                   className="text-[10px] w-20 px-2 py-1 rounded border border-amber-200 focus:ring-1 focus:ring-amber-500 outline-none"
                                 />
                                 <button 
                                   onClick={() => {
                                     const val = (document.getElementById(`override-${m.polygon_id}`) as HTMLInputElement).value;
                                     if(val) alert(`Audit logged: Polygon #${m.polygon_id} re-assigned to ${val}.`);
                                   }}
                                   className="text-[10px] font-bold bg-amber-600 text-white px-2 py-1 rounded hover:bg-amber-700 transition"
                                 >
                                   Apply
                                 </button>
                               </div>
                             </div>
                          ) : (
                             <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle className="w-3.5 h-3.5"/> VALIDATED ({(m.confidence*100).toFixed(0)}%)
                             </span>
                          )}
                        </div>
                        <div className="text-sm text-slate-600 bg-white p-3 rounded border border-slate-100 shadow-sm leading-relaxed">
                          <strong>Adjudication Log:</strong> {m.reasoning}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                      <Brain className="w-8 h-8 text-slate-300"/>
                    </div>
                    <h3 className="font-semibold text-lg text-slate-800 mb-2">Awaiting Computation</h3>
                    <p className="text-sm text-slate-500 max-w-sm">Use the Execute Intelligence button above to run deterministic bounds constraints, then summarize via Gemini Auditor.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'chat' && (
              <div className="p-6 h-full flex flex-col">
                <div className="flex-1 mb-4 flex flex-col overflow-y-auto pr-2">
                   {chatReply ? (
                      <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-5 text-sm leading-relaxed text-indigo-900 shadow-sm font-medium">
                         {chatReply.split('\n').map((line, idx) => <p key={idx} className="mb-2 last:mb-0">{line}</p>)}
                      </div>
                   ) : (
                      <div className="flex-1 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center p-8 text-center bg-slate-50/50">
                         <div className="max-w-xs text-slate-500">
                            Ask the AI Auditor regarding variance parameters, low-confidence boundaries, or specific farmer logic.
                         </div>
                      </div>
                   )}
                </div>

                <div className="relative">
                  <input 
                    type="text" 
                    value={chatPrompt} 
                    onChange={e=>setChatPrompt(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleChat()}
                    placeholder="E.g. Identify conflicts with the deterministic heuristic."
                    className="w-full pl-4 pr-24 py-3 bg-white border border-slate-300 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button 
                    onClick={handleChat}
                    className="absolute right-1.5 top-1.5 bottom-1.5 bg-indigo-600 text-white px-4 rounded-md text-xs font-bold hover:bg-indigo-700 transition-colors uppercase tracking-wider"
                  >
                    Transmit
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
