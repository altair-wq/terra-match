"use client";

import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";

function stringToColor(str: string) {
  if (!str) return "#94a3b8";
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  return "#" + "00000".substring(0, 6 - c.length) + c;
}

export default function LeafletMap({ polygons = [], matches = [], filter = "all", onSelectInfo = (msg: any)=>{} }: any) {
  if (!polygons || polygons.length === 0) {
    return <div className="h-full w-full bg-slate-50 border border-dashed rounded flex justify-center items-center text-slate-400">Map will appear here when polygons are loaded</div>;
  }

  // Generate feature collection
  const features = polygons.map(p => {
    const geo = JSON.parse(p.geojson);
    const match = matches.find((m: any) => m.polygon_id === p.polygon_id);
    const farmer_id = match ? match.farmer_id : null;
    const isUnmatched = !farmer_id;
    
    return {
      type: "Feature",
      geometry: geo.features ? geo.features[0].geometry : geo.geometry || geo,
      properties: {
        Polygon_ID: p.polygon_id,
        Area_ha: p.area_ha?.toFixed(2),
        Farmer_ID: farmer_id || "Unassigned",
        Confidence: match ? match.confidence : null,
        Needs_Review: match ? match.needs_review : false,
        Reasoning: match ? match.reasoning : "None",
        fillColor: isUnmatched ? "#94a3b8" : stringToColor(farmer_id),
        color: "#1e293b",
        weight: isUnmatched ? 1 : 2,
        fillOpacity: isUnmatched ? 0.3 : 0.7
      }
    };
  }).filter(f => {
     if (filter === 'matched') return f.properties.Farmer_ID !== 'Unassigned';
     if (filter === 'unmatched') return f.properties.Farmer_ID === 'Unassigned';
     if (filter === 'review') return f.properties.Needs_Review === true;
     return true;
  });

  const geoJsonData = {
    type: "FeatureCollection",
    features: features
  };

  const centerLat = polygons.length > 0 ? polygons[0].centroid_lat : 0;
  const centerLon = polygons.length > 0 ? polygons[0].centroid_lon : 0;

  return (
    <div className="h-full w-full relative z-0">
      <MapContainer 
        center={[centerLat, centerLon]} 
        zoom={13} 
        style={{ height: "100%", width: "100%", borderRadius: "0.5rem" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <GeoJSON 
          key={filter} // Forces redraw on filter change
          data={geoJsonData as any}
          style={(feature: any) => ({
             fillColor: feature.properties.fillColor,
             weight: feature.properties.weight,
             opacity: 1,
             color: feature.properties.color,
             fillOpacity: feature.properties.fillOpacity
          })}
          onEachFeature={(feature, layer) => {
            // Setup simple tooltip
            layer.bindTooltip(`<b>Polygon:</b> ${feature.properties.Polygon_ID}<br><b>Farmer:</b> ${feature.properties.Farmer_ID}`);
            
            // Setup click panel pass up
            layer.on({
               click: () => onSelectInfo(feature.properties)
            });
          }}
        />
      </MapContainer>
    </div>
  );
}
