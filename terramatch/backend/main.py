import os
import json
import zipfile
import tempfile
from typing import List, Optional, Any, Dict
from pathlib import Path
import re
import math

from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey, Text, Boolean
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.orm import relationship

import pandas as pd
import geopandas as gpd
import fiona
from shapely.geometry import Polygon, MultiPolygon, GeometryCollection
try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None

# Database Setup
DATABASE_URL = "sqlite:///./terramatch.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    status = Column(String, default="draft")

class FarmerRecord(Base):
    __tablename__ = "farmers"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    farmer_id = Column(String, index=True)
    group_name = Column(String)
    reported_area_ha = Column(Float)
    location_clues = Column(Text)

class PolygonFeature(Base):
    __tablename__ = "polygons"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    polygon_id = Column(Integer)
    area_ha = Column(Float)
    centroid_lon = Column(Float)
    centroid_lat = Column(Float)
    geometry_wkt = Column(Text)
    geojson = Column(Text)

class MatchAssignment(Base):
    __tablename__ = "matches"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    polygon_id = Column(Integer)
    farmer_id = Column(String)
    confidence = Column(Float)
    reasoning = Column(Text)
    needs_review = Column(Boolean, default=False)
    alternatives = Column(Text) # JSON mapping

Base.metadata.create_all(bind=engine)

app = FastAPI(title="TerraMatch System API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_polygon_parts(geom) -> List[Polygon]:
    if geom is None or geom.is_empty: return []
    if isinstance(geom, Polygon): return [geom]
    if isinstance(geom, MultiPolygon): return list(geom.geoms)
    if isinstance(geom, GeometryCollection):
        parts = []
        for subgeom in geom.geoms: parts.extend(get_polygon_parts(subgeom))
        return parts
    return []

def safe_json_load(text: str) -> Dict[str, Any]:
    if not text: raise ValueError("Empty response")
    no_fence = re.sub(r"^\s*```(?:json)?\s*|\s*```\s*$", "", text.strip(), flags=re.IGNORECASE | re.DOTALL)
    match = re.search(r"\{.*\}", no_fence, flags=re.DOTALL)
    candidate = match.group(0) if match else no_fence
    cleaned = re.sub(r",(\s*[}\]])", r"\1", candidate)
    return json.loads(cleaned)

@app.get("/api/projects")
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).all()
    out = []
    for p in projects:
        f_count = db.query(FarmerRecord).filter(FarmerRecord.project_id == p.id).count()
        p_count = db.query(PolygonFeature).filter(PolygonFeature.project_id == p.id).count()
        out.append({"id": p.id, "name": p.name, "status": p.status, "farmer_count": f_count, "polygon_count": p_count})
    return {"projects": out}

@app.post("/api/projects/upload")
async def upload_files(
    name: str = Form(...),
    csv_file: UploadFile = File(...),
    kmz_file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    project = Project(name=name)
    db.add(project)
    db.commit()
    db.refresh(project)

    try:
        df = pd.read_csv(csv_file.file)
        for _, row in df.iterrows():
            f = FarmerRecord(
                project_id=project.id,
                farmer_id=str(row.get('Farmer_ID', '')).strip(),
                group_name=str(row.get('Group', '')),
                reported_area_ha=float(row.get('Reported_Area_ha', 0)),
                location_clues=str(row.get('Location_Clues', ''))
            )
            db.add(f)
        
        fiona.drvsupport.supported_drivers["KML"] = "rw"
        fiona.drvsupport.supported_drivers["LIBKML"] = "rw"
        
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)
            kmz_path = tmpdir_path / kmz_file.filename
            content = await kmz_file.read()
            kmz_path.write_bytes(content)

            extract_dir = tmpdir_path / "extracted"
            extract_dir.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(kmz_path, "r") as zf:
                zf.extractall(extract_dir)

            kml_files = list(extract_dir.rglob("*.kml"))
            if not kml_files:
                raise Exception("No KML inside KMZ")

            layer_frames = []
            for kml_file in kml_files:
                try: layers = fiona.listlayers(kml_file)
                except: layers = [None]
                for layer in layers:
                    gdf = gpd.read_file(kml_file, layer=layer, driver="KML")
                    if not gdf.empty: layer_frames.append(gdf)

            if not layer_frames: raise Exception("No KML features")
            
            combined = pd.concat(layer_frames, ignore_index=True)
            gdf = gpd.GeoDataFrame(combined, geometry="geometry", crs=layer_frames[0].crs)
            if gdf.crs is None: gdf.set_crs(epsg=4326, allow_override=True, inplace=True)
            
            polygon_rows = []
            for _, row in gdf.iterrows():
                for poly in get_polygon_parts(row.geometry):
                    polygon_rows.append({"geometry": poly})
            
            poly_gdf = gpd.GeoDataFrame(polygon_rows, geometry="geometry", crs=gdf.crs)
            poly_gdf["Polygon_ID"] = range(1, len(poly_gdf) + 1)
            
            metric_crs = poly_gdf.estimate_utm_crs() or "EPSG:3857"
            metric_gdf = poly_gdf.to_crs(metric_crs)
            poly_gdf["Area_ha"] = metric_gdf.geometry.area / 10000.0
            centroid_wgs84 = gpd.GeoSeries(metric_gdf.geometry.centroid, crs=metric_crs).to_crs(epsg=4326)
            poly_gdf["Centroid_Lon"] = centroid_wgs84.x
            poly_gdf["Centroid_Lat"] = centroid_wgs84.y

            for _, row in poly_gdf.iterrows():
                p = PolygonFeature(
                    project_id=project.id,
                    polygon_id=row["Polygon_ID"],
                    area_ha=row["Area_ha"],
                    centroid_lon=row["Centroid_Lon"],
                    centroid_lat=row["Centroid_Lat"],
                    geometry_wkt=row.geometry.wkt,
                    geojson=gpd.GeoSeries([row.geometry]).to_json()
                )
                db.add(p)

        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

    return {"project_id": project.id, "message": "Uploaded successfully"}

@app.get("/api/projects/{project_id}/data")
def get_project_data(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    farmers = db.query(FarmerRecord).filter(FarmerRecord.project_id == project_id).all()
    polygons = db.query(PolygonFeature).filter(PolygonFeature.project_id == project_id).all()
    matches = db.query(MatchAssignment).filter(MatchAssignment.project_id == project_id).all()

    return {
        "project": project,
        "farmers": farmers,
        "polygons": polygons,
        "matches": matches
    }

class MatchRequest(BaseModel):
    api_key: str

@app.post("/api/projects/{project_id}/match")
def run_matching(project_id: int, req: MatchRequest, db: Session = Depends(get_db)):
    farmers = db.query(FarmerRecord).filter(FarmerRecord.project_id == project_id).all()
    polygons = db.query(PolygonFeature).filter(PolygonFeature.project_id == project_id).all()

    if not farmers or not polygons:
        raise HTTPException(status_code=400, detail="Missing data.")
    if not genai:
        raise HTTPException(status_code=500, detail="google-genai SDK not installed.")

    # 1. Deterministic Scoring Logic
    # We greedily assign polygons to farmers based purely on Area Difference
    unassigned_polys = list(polygons)
    deterministic_draft = []
    
    # Sort farmers descending by area (assign large ones first)
    sorted_farmers = sorted(farmers, key=lambda x: x.reported_area_ha, reverse=True)
    
    for f in sorted_farmers:
        best_poly = None
        best_diff = float('inf')
        for p in unassigned_polys:
            diff = abs(p.area_ha - f.reported_area_ha)
            if diff < best_diff:
                best_diff = diff
                best_poly = p
                
        if best_poly:
            confidence = max(0.0, 1.0 - (best_diff / f.reported_area_ha)) if f.reported_area_ha > 0 else 0
            deterministic_draft.append({
                "Farmer_ID": f.farmer_id,
                "Reported_Area_ha": f.reported_area_ha,
                "Location_Clues": f.location_clues,
                "Polygon_ID": best_poly.polygon_id,
                "Polygon_Area_ha": best_poly.area_ha,
                "Centroid": {"lon": best_poly.centroid_lon, "lat": best_poly.centroid_lat},
                "Base_Confidence": confidence
            })
            unassigned_polys.remove(best_poly)

    # 2. Use Gemini to interpret clues, explain assignment, & summarize uncertainty
    client = genai.Client(api_key=req.api_key)
    system_prompt = """
You are a spatial auditing AI assisting a carbon registry.
A custom deterministic backend algorithm has greedily matched farmers to land polygons based primarily on area capacity comparisons.
Your tasks:
1. Interpret the natural language "Location_Clues".
2. Explain the assignment logic, noting whether the deterministic assignment aligns with the location clues.
3. Summarize uncertainty and set "Needs_Review" to true if clues conflict significantly with the match or area confidence is below 0.70.
4. "Confidence" should be factored up or down based on your clue interpretations.

Return strictly JSON format:
{
  "matches": [
    {
      "Polygon_ID": 1,
      "Farmer_ID": "A102",
      "Confidence": 0.85,
      "Reasoning": "Area diff is 2%. Clue 'North of river' perfectly corroborates finding.",
      "Needs_Review": false,
      "Alternatives": []
    }
  ]
}
"""
    payload = json.dumps({"deterministic_draft": deterministic_draft})
    
    try:
        res = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=payload,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.1,
                response_mime_type="application/json",
            ),
        )
        parsed = safe_json_load(res.text)
        
        # 3. Save resulting interpreted matches + any unassigned overrides back to DB
        db.query(MatchAssignment).filter(MatchAssignment.project_id == project_id).delete()
        for m in parsed.get("matches", []):
            assignment = MatchAssignment(
                project_id=project_id,
                polygon_id=m.get("Polygon_ID"),
                farmer_id=m.get("Farmer_ID"),
                confidence=m.get("Confidence", 0.0),
                reasoning=m.get("Reasoning", ""),
                needs_review=m.get("Needs_Review", False),
                alternatives=json.dumps(m.get("Alternatives", []))
            )
            db.add(assignment)
        
        project = db.query(Project).filter(Project.id == project_id).first()
        project.status = "Audit Ready"
        db.commit()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"message": "Matched successfully."}

class ChatRequest(BaseModel):
    prompt: str
    api_key: str

@app.post("/api/projects/{project_id}/chat")
def chat_with_data(project_id: int, req: ChatRequest, db: Session = Depends(get_db)):
    matches = db.query(MatchAssignment).filter(MatchAssignment.project_id == project_id).all()
    matches_text = json.dumps([{"farmer": m.farmer_id, "polygon": m.polygon_id, "reasoning": m.reasoning, "confidence": m.confidence} for m in matches])
    
    if not genai:
        raise HTTPException(status_code=500, detail="google-genai SDK not installed.")

    client = genai.Client(api_key=req.api_key)
    system_prompt = """
You are an enterprise auditing assistant for a green carbon project.
A field operator is asking about the results of an automated spatial matching process. 
Respond in a highly professional, operational, and specific tone. Highlight any auditability, certainty, or manual review required. Provide concise metric-driven logic. Do not invent details outside the provided data.
"""
    full_prompt = f"Data:\n{matches_text}\n\nField Operator Question:\n{req.prompt}"
    
    res = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=full_prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.3
        )
    )
    return {"reply": res.text}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
