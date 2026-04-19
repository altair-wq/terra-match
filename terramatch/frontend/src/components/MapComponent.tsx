"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// Client-side execution wrapper
const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-slate-100 animate-pulse flex items-center justify-center">Loading Map...</div>
});

export default function MapComponent(props: any) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <LeafletMap {...props} />;
}
