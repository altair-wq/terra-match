# app.py
# -----------------------------------------------------------------------------
# TerraMatch: AI Spatial Reconciliation
#
# Run:
#   pip install streamlit geopandas shapely fiona folium streamlit-folium pandas google-genai
#   streamlit run app.py
#
# Notes:
# - This app uses the current Google GenAI SDK (`google-genai`) rather than the
#   deprecated `google-generativeai` package.
# - KMZ parsing can be environment-sensitive because KML/KMZ support depends on
#   local GDAL/Fiona drivers. This script includes multiple fallbacks.
# -----------------------------------------------------------------------------

import json
import re
import zipfile
import hashlib
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
import geopandas as gpd
import streamlit as st
import folium
import fiona

from shapely.geometry import Polygon, MultiPolygon, GeometryCollection
from streamlit_folium import st_folium

# Optional import so the UI still loads even if the package is missing.
try:
    from google import genai
    from google.genai import types
    HAS_GOOGLE_GENAI = True
except Exception:
    HAS_GOOGLE_GENAI = False

# -----------------------------
# Streamlit page configuration
# -----------------------------
st.set_page_config(
    page_title="TerraMatch",
    page_icon="🗺️",
    layout="wide",
)

# Default Gemini model. Change this string if you want another supported model.
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"


# -----------------------------
# Helper functions
# -----------------------------
def string_to_color(value: str) -> str:
    """Generate a deterministic hex color from a string."""
    if not value:
        return "#9E9E9E"
    digest = hashlib.md5(value.encode("utf-8")).hexdigest()
    return f"#{digest[:6]}"


def normalize_id(value: Any) -> Optional[str]:
    """Normalize IDs to comparable strings."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    return str(value).strip()


def get_polygon_parts(geom) -> List[Polygon]:
    """
    Recursively extract polygonal components from a Shapely geometry.
    Returns a list of Polygon objects.
    """
    if geom is None or geom.is_empty:
        return []

    if isinstance(geom, Polygon):
        return [geom]

    if isinstance(geom, MultiPolygon):
        return list(geom.geoms)

    if isinstance(geom, GeometryCollection):
        parts: List[Polygon] = []
        for subgeom in geom.geoms:
            parts.extend(get_polygon_parts(subgeom))
        return parts

    return []


def safe_json_load(text: str) -> Dict[str, Any]:
    """
    Parse JSON safely, including common malformed-output fallbacks:
    - removes ```json fences
    - extracts the first {...} block
    - removes trailing commas before } or ]
    """
    if not text:
        raise ValueError("Empty model response; no JSON to parse.")

    candidates = []

    # Raw text
    candidates.append(text.strip())

    # Remove fenced code blocks
    no_fence = re.sub(r"^\s*```(?:json)?\s*|\s*```\s*$", "", text.strip(), flags=re.IGNORECASE | re.DOTALL)
    candidates.append(no_fence)

    # Extract first JSON object block
    match = re.search(r"\{.*\}", no_fence, flags=re.DOTALL)
    if match:
        candidates.append(match.group(0))

    tried = []
    for candidate in candidates:
        cleaned = re.sub(r",(\s*[}\]])", r"\1", candidate)  # remove trailing commas
        tried.append(cleaned)
        try:
            return json.loads(cleaned)
        except Exception:
            continue

    raise ValueError("Could not parse valid JSON from Gemini response.")


def read_farmer_csv(uploaded_file) -> pd.DataFrame:
    """Read and validate the farmer CSV."""
    df = pd.read_csv(uploaded_file)
    df.columns = [str(c).strip() for c in df.columns]

    required = {"Farmer_ID", "Reported_Area_ha"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"CSV is missing required columns: {sorted(missing)}")

    # Optional columns with defaults
    if "Group" not in df.columns:
        df["Group"] = ""
    if "Location_Clues" not in df.columns:
        df["Location_Clues"] = ""

    df["Farmer_ID"] = df["Farmer_ID"].astype(str).str.strip()
    df["Group"] = df["Group"].fillna("").astype(str).str.strip()
    df["Location_Clues"] = df["Location_Clues"].fillna("").astype(str).str.strip()
    df["Reported_Area_ha"] = pd.to_numeric(df["Reported_Area_ha"], errors="coerce")

    return df


def try_read_kml_layer(kml_path: Path, layer: Optional[str], driver: Optional[str]) -> Optional[gpd.GeoDataFrame]:
    """Try reading a single KML layer with an optional driver."""
    try:
        if layer is not None and driver is not None:
            return gpd.read_file(kml_path, layer=layer, driver=driver)
        if layer is not None:
            return gpd.read_file(kml_path, layer=layer)
        if driver is not None:
            return gpd.read_file(kml_path, driver=driver)
        return gpd.read_file(kml_path)
    except Exception:
        return None


def parse_kmz_to_geodataframe(uploaded_file) -> gpd.GeoDataFrame:
    """
    Extract a KMZ, read KML layers into a GeoDataFrame, keep polygonal geometries,
    calculate area in hectares, centroid lon/lat, and assign Polygon_ID.
    """
    # Fiona driver registration/fallbacks
    try:
        fiona.drvsupport.supported_drivers["KML"] = "rw"
    except Exception:
        pass
    try:
        fiona.drvsupport.supported_drivers["LIBKML"] = "rw"
    except Exception:
        pass

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)
        kmz_path = tmpdir_path / uploaded_file.name
        kmz_path.write_bytes(uploaded_file.getvalue())

        extract_dir = tmpdir_path / "extracted"
        extract_dir.mkdir(parents=True, exist_ok=True)

        try:
            with zipfile.ZipFile(kmz_path, "r") as zf:
                zf.extractall(extract_dir)
        except zipfile.BadZipFile as e:
            raise ValueError("Uploaded KMZ is not a valid ZIP/KMZ archive.") from e

        kml_files = list(extract_dir.rglob("*.kml"))
        if not kml_files:
            raise FileNotFoundError("No KML file was found inside the KMZ archive.")

        layer_frames: List[gpd.GeoDataFrame] = []

        for kml_file in kml_files:
            try:
                layers = fiona.listlayers(kml_file)
            except Exception:
                layers = [None]

            for layer in layers:
                gdf = None
                for driver in [None, "LIBKML", "KML"]:
                    gdf = try_read_kml_layer(kml_file, layer, driver)
                    if gdf is not None and not gdf.empty:
                        break

                if gdf is not None and not gdf.empty:
                    layer_frames.append(gdf)

        if not layer_frames:
            raise ValueError("Could not read any features from the KMZ/KML file.")

        combined = pd.concat(layer_frames, ignore_index=True)
        gdf = gpd.GeoDataFrame(combined, geometry="geometry", crs=layer_frames[0].crs)

        if gdf.crs is None:
            # KML is usually EPSG:4326, so this is a sensible default.
            gdf = gdf.set_crs(epsg=4326, allow_override=True)

        # Extract polygonal parts from possibly mixed geometries
        polygon_rows: List[Dict[str, Any]] = []
        non_geom_cols = [c for c in gdf.columns if c != "geometry"]

        for _, row in gdf.iterrows():
            parts = get_polygon_parts(row.geometry)
            for poly in parts:
                record = {col: row[col] for col in non_geom_cols}
                record["geometry"] = poly
                polygon_rows.append(record)

        if not polygon_rows:
            raise ValueError("No polygon features were found in the uploaded KMZ/KML.")

        poly_gdf = gpd.GeoDataFrame(polygon_rows, geometry="geometry", crs=gdf.crs)
        poly_gdf = poly_gdf[poly_gdf.geometry.notnull()].copy()
        poly_gdf = poly_gdf[~poly_gdf.geometry.is_empty].copy()
        poly_gdf = poly_gdf.reset_index(drop=True)

        # Assign a temporary polygon ID
        poly_gdf["Polygon_ID"] = range(1, len(poly_gdf) + 1)

        # Calculate area using a projected CRS
        metric_crs = poly_gdf.estimate_utm_crs()
        if metric_crs is None:
            metric_crs = "EPSG:3857"

        metric_gdf = poly_gdf.to_crs(metric_crs)
        poly_gdf["Area_ha"] = (metric_gdf.geometry.area / 10000.0).round(4)

        # Compute centroids in projected CRS, then convert back to WGS84
        centroid_metric = metric_gdf.geometry.centroid
        centroid_wgs84 = gpd.GeoSeries(centroid_metric, crs=metric_crs).to_crs(epsg=4326)
        poly_gdf["Centroid_Lon"] = centroid_wgs84.x.round(7)
        poly_gdf["Centroid_Lat"] = centroid_wgs84.y.round(7)

        return poly_gdf


def serialize_inputs_for_llm(polygons_gdf: gpd.GeoDataFrame, farmers_df: pd.DataFrame) -> str:
    """Convert polygon summary + farmer records into a structured JSON string."""
    polygons_payload = []
    for _, row in polygons_gdf.iterrows():
        polygons_payload.append(
            {
                "Polygon_ID": int(row["Polygon_ID"]),
                "Area_ha": None if pd.isna(row["Area_ha"]) else float(row["Area_ha"]),
                "Centroid": {
                    "lon": None if pd.isna(row["Centroid_Lon"]) else float(row["Centroid_Lon"]),
                    "lat": None if pd.isna(row["Centroid_Lat"]) else float(row["Centroid_Lat"]),
                },
            }
        )

    farmers_payload = []
    for _, row in farmers_df.iterrows():
        farmers_payload.append(
            {
                "Farmer_ID": normalize_id(row.get("Farmer_ID")),
                "Group": "" if pd.isna(row.get("Group")) else str(row.get("Group")),
                "Reported_Area_ha": None if pd.isna(row.get("Reported_Area_ha")) else float(row.get("Reported_Area_ha")),
                "Location_Clues": "" if pd.isna(row.get("Location_Clues")) else str(row.get("Location_Clues")),
            }
        )

    payload = {
        "polygons": polygons_payload,
        "farmers": farmers_payload,
    }
    return json.dumps(payload, indent=2, ensure_ascii=False)


def call_gemini_matchmaker(payload_json: str, api_key: str, model_name: str = DEFAULT_GEMINI_MODEL) -> Tuple[Dict[str, Any], str]:
    """
    Call Gemini to match farmers to polygons.

    Returns:
        parsed_json, raw_text_response
    """
    if not HAS_GOOGLE_GENAI:
        raise ImportError(
            "google-genai is not installed. Run: pip install google-genai"
        )

    system_prompt = """
You are a spatial reasoning AI.

I will provide:
1) a list of unassigned map polygons, each with:
   - Polygon_ID
   - Area_ha
   - centroid coordinates (lon, lat)
2) a list of farmers, each with:
   - Farmer_ID
   - Group
   - Reported_Area_ha
   - Location_Clues

Your task:
- Match each farmer to exactly one polygon whenever possible.
- Use area similarity, relative geography, centroid locations, and text-based directional clues.
- Respect one-to-one matching:
  - each farmer can appear at most once
  - each polygon can appear at most once
- If the data is imperfect, still make the best defensible assignment.
- Keep reasoning concise but specific.

Return STRICT JSON ONLY in this exact format:
{
  "matches": [
    {
      "Polygon_ID": 1,
      "Farmer_ID": "A102",
      "Reasoning": "Closest area match and consistent with the clue that this farmer is north of Farmer B."
    }
  ]
}

Do not include markdown. Do not include code fences. Do not include extra text.
""".strip()

    user_prompt = f"""
Match the following farmers to the following polygons.

Data:
{payload_json}
""".strip()

    client = genai.Client(api_key=api_key)

    response = client.models.generate_content(
        model=model_name,
        contents=user_prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.1,
            response_mime_type="application/json",
        ),
    )

    raw_text = getattr(response, "text", None)
    if not raw_text:
        raw_text = str(response)

    parsed = safe_json_load(raw_text)
    if "matches" not in parsed or not isinstance(parsed["matches"], list):
        raise ValueError("Gemini response JSON is missing a valid 'matches' list.")

    return parsed, raw_text


def merge_matches_into_gdf(
    polygons_gdf: gpd.GeoDataFrame,
    farmers_df: pd.DataFrame,
    llm_output: Dict[str, Any],
) -> gpd.GeoDataFrame:
    """Merge Gemini match results back into the polygon GeoDataFrame."""
    merged = polygons_gdf.copy()

    matches = llm_output.get("matches", [])
    if not matches:
        # No matches; keep the base polygon data
        merged["Farmer_ID"] = None
        merged["Reported_Area_ha"] = None
        merged["Group"] = None
        merged["Location_Clues"] = None
        merged["Reasoning"] = None
        merged["Display_Color"] = "#9E9E9E"
        return merged

    match_df = pd.DataFrame(matches).copy()

    if "Polygon_ID" not in match_df.columns or "Farmer_ID" not in match_df.columns:
        raise ValueError("Parsed match output is missing Polygon_ID or Farmer_ID.")

    match_df["Polygon_ID"] = pd.to_numeric(match_df["Polygon_ID"], errors="coerce")
    match_df = match_df.dropna(subset=["Polygon_ID"])
    match_df["Polygon_ID"] = match_df["Polygon_ID"].astype(int)
    match_df["Farmer_ID"] = match_df["Farmer_ID"].astype(str).str.strip()

    farmers_meta = farmers_df.copy()
    farmers_meta["Farmer_ID"] = farmers_meta["Farmer_ID"].astype(str).str.strip()

    # Keep only the first match per polygon / farmer if Gemini returns duplicates
    match_df = match_df.drop_duplicates(subset=["Polygon_ID"], keep="first")
    match_df = match_df.drop_duplicates(subset=["Farmer_ID"], keep="first")

    merged_match = match_df.merge(
        farmers_meta[["Farmer_ID", "Group", "Reported_Area_ha", "Location_Clues"]],
        on="Farmer_ID",
        how="left",
    )

    merged = merged.merge(merged_match, on="Polygon_ID", how="left")

    merged["Display_Color"] = merged["Farmer_ID"].apply(
        lambda x: string_to_color(str(x)) if pd.notna(x) else "#9E9E9E"
    )

    return merged


def build_folium_map(gdf: gpd.GeoDataFrame, matched: bool = False) -> folium.Map:
    """Render a Folium map from the GeoDataFrame."""
    if gdf.crs is None:
        gdf = gdf.set_crs(epsg=4326, allow_override=True)

    gdf_wgs84 = gdf.to_crs(epsg=4326).copy()

    minx, miny, maxx, maxy = gdf_wgs84.total_bounds
    center_lat = (miny + maxy) / 2
    center_lon = (minx + maxx) / 2

    fmap = folium.Map(
        location=[center_lat, center_lon],
        zoom_start=13,
        tiles="CartoDB positron",
        control_scale=True,
    )

    # Make sure display columns exist
    if "Display_Color" not in gdf_wgs84.columns:
        gdf_wgs84["Display_Color"] = "#9E9E9E"

    def style_function(feature):
        props = feature["properties"]
        has_farmer = props.get("Farmer_ID") not in [None, "", "nan"]
        fill = props.get("Display_Color", "#9E9E9E") if matched and has_farmer else "#BDBDBD"
        return {
            "fillColor": fill,
            "color": "#374151",
            "weight": 1.5,
            "fillOpacity": 0.7 if matched and has_farmer else 0.35,
        }

    def highlight_function(_feature):
        return {
            "weight": 3,
            "fillOpacity": 0.85,
        }

    tooltip_fields = ["Polygon_ID", "Area_ha"]
    tooltip_aliases = ["Polygon ID", "Polygon Area (ha)"]

    if matched:
        for field, alias in [
            ("Farmer_ID", "Farmer ID"),
            ("Reported_Area_ha", "Reported Area (ha)"),
            ("Group", "Group"),
            ("Reasoning", "AI Reasoning"),
        ]:
            if field in gdf_wgs84.columns:
                tooltip_fields.append(field)
                tooltip_aliases.append(alias)

    # Convert some columns to strings to avoid tooltip issues with NaN
    for col in tooltip_fields:
        if col in gdf_wgs84.columns:
            gdf_wgs84[col] = gdf_wgs84[col].where(gdf_wgs84[col].notna(), None)

    gj = folium.GeoJson(
        data=gdf_wgs84,
        style_function=style_function,
        highlight_function=highlight_function,
        tooltip=folium.GeoJsonTooltip(
            fields=tooltip_fields,
            aliases=tooltip_aliases,
            labels=True,
            sticky=True,
            localize=True,
        ),
        name="Polygons",
    )
    gj.add_to(fmap)

    folium.LayerControl().add_to(fmap)

    # Fit bounds to data
    try:
        fmap.fit_bounds([[miny, minx], [maxy, maxx]])
    except Exception:
        pass

    return fmap


def initialize_session_state():
    """Initialize all session state keys once."""
    defaults = {
        "upload_signature": None,
        "polygons_gdf": None,
        "farmers_df": None,
        "matched_gdf": None,
        "llm_output": None,
        "raw_llm_response": None,
        "last_error": None,
    }
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value


def clear_match_results():
    """Reset post-run artifacts."""
    st.session_state["matched_gdf"] = None
    st.session_state["llm_output"] = None
    st.session_state["raw_llm_response"] = None
    st.session_state["last_error"] = None


# -----------------------------
# App UI
# -----------------------------
initialize_session_state()

# Sidebar
with st.sidebar:
    st.title("TerraMatch Setup")
    st.caption("Upload a KMZ project area map and a farmer CSV to begin.")

    uploaded_kmz = st.file_uploader(
        "Upload project_area.kmz",
        type=["kmz"],
        help="KMZ file containing polygon boundaries for agricultural land.",
    )

    uploaded_csv = st.file_uploader(
        "Upload farmer_list.csv",
        type=["csv"],
        help="CSV containing Farmer_ID, Reported_Area_ha, and optional Group / Location_Clues.",
    )

    gemini_api_key = st.text_input(
        "GEMINI_API_KEY",
        type="password",
        help="Paste your Gemini API key here.",
    )

    st.markdown("---")
    st.markdown(
        "**Expected CSV columns**\n"
        "- `Farmer_ID` (required)\n"
        "- `Reported_Area_ha` (required)\n"
        "- `Group` (optional)\n"
        "- `Location_Clues` (optional)"
    )

# Main page
st.title("TerraMatch: AI Spatial Reconciliation")
st.write(
    "Match administrative farmer records to unassigned map polygons using "
    "geospatial features plus Gemini-based spatial reasoning."
)

# Parse uploads only when the upload signature changes
if uploaded_kmz is not None and uploaded_csv is not None:
    current_signature = (
        uploaded_kmz.name,
        uploaded_kmz.size,
        uploaded_csv.name,
        uploaded_csv.size,
    )

    if st.session_state["upload_signature"] != current_signature:
        try:
            with st.spinner("Parsing uploaded files..."):
                polygons_gdf = parse_kmz_to_geodataframe(uploaded_kmz)
                farmers_df = read_farmer_csv(uploaded_csv)

            st.session_state["upload_signature"] = current_signature
            st.session_state["polygons_gdf"] = polygons_gdf
            st.session_state["farmers_df"] = farmers_df
            clear_match_results()

        except Exception as e:
            st.session_state["last_error"] = str(e)
            st.error(f"Failed to parse uploaded files: {e}")

# Show error if parsing failed
if st.session_state["last_error"]:
    st.error(st.session_state["last_error"])

polygons_gdf = st.session_state.get("polygons_gdf")
farmers_df = st.session_state.get("farmers_df")
matched_gdf = st.session_state.get("matched_gdf")

# Pre-run / post-run UI
if polygons_gdf is not None and farmers_df is not None:
    # Summary row
    c1, c2, c3 = st.columns(3)
    c1.metric("Polygons Loaded", len(polygons_gdf))
    c2.metric("Farmers Loaded", len(farmers_df))
    c3.metric(
        "Matched Polygons",
        int(matched_gdf["Farmer_ID"].notna().sum()) if matched_gdf is not None and "Farmer_ID" in matched_gdf.columns else 0,
    )

    st.markdown("### Map View")

    # Choose which GeoDataFrame to render
    map_gdf = matched_gdf if matched_gdf is not None else polygons_gdf
    is_matched = matched_gdf is not None

    try:
        fmap = build_folium_map(map_gdf, matched=is_matched)
        st_folium(fmap, width=None, height=550, returned_objects=[])
    except Exception as e:
        st.error(f"Failed to render the map: {e}")

    st.markdown("### Run Matching")

    if not HAS_GOOGLE_GENAI:
        st.warning("`google-genai` is not installed. Install it before running the AI matcher.")

    run_clicked = st.button(
        "Run AI Matchmaker",
        type="primary",
        use_container_width=True,
    )

    if run_clicked:
        if not gemini_api_key:
            st.error("Please enter a GEMINI_API_KEY in the sidebar.")
        elif not HAS_GOOGLE_GENAI:
            st.error("Missing dependency: `google-genai`. Install it and rerun the app.")
        else:
            try:
                with st.spinner("Preparing data for Gemini..."):
                    payload_json = serialize_inputs_for_llm(polygons_gdf, farmers_df)

                with st.spinner("Asking Gemini to reconcile farmers with polygons..."):
                    llm_output, raw_response = call_gemini_matchmaker(
                        payload_json=payload_json,
                        api_key=gemini_api_key,
                        model_name=DEFAULT_GEMINI_MODEL,
                    )

                with st.spinner("Merging match results into map data..."):
                    updated_gdf = merge_matches_into_gdf(polygons_gdf, farmers_df, llm_output)

                st.session_state["matched_gdf"] = updated_gdf
                st.session_state["llm_output"] = llm_output
                st.session_state["raw_llm_response"] = raw_response
                st.session_state["last_error"] = None

                st.success("AI matching completed.")
                st.rerun()

            except Exception as e:
                st.session_state["last_error"] = str(e)
                st.error(f"AI matchmaker failed: {e}")

    # Post-run details
    if matched_gdf is not None:
        st.markdown("### Match Results")

        display_cols = ["Polygon_ID", "Area_ha"]
        for col in ["Farmer_ID", "Reported_Area_ha", "Group", "Reasoning"]:
            if col in matched_gdf.columns:
                display_cols.append(col)

        st.dataframe(
            matched_gdf[display_cols].sort_values("Polygon_ID"),
            use_container_width=True,
            hide_index=True,
        )

        with st.expander("AI Reasoning Log", expanded=False):
            st.write("**Raw Gemini JSON response**")
            st.code(
                st.session_state.get("raw_llm_response", "No raw response available."),
                language="json",
            )

            llm_output = st.session_state.get("llm_output", {})
            matches = llm_output.get("matches", []) if isinstance(llm_output, dict) else []

            if matches:
                st.write("**Parsed reasoning table**")
                reasoning_df = pd.DataFrame(matches)
                available_cols = [c for c in ["Polygon_ID", "Farmer_ID", "Reasoning"] if c in reasoning_df.columns]
                if available_cols:
                    st.dataframe(reasoning_df[available_cols], use_container_width=True, hide_index=True)
            else:
                st.info("No parsed match reasoning was available.")

else:
    st.info("Upload both a KMZ file and a farmer CSV in the sidebar to begin.")

    # Friendly placeholder section
    st.markdown(
        """
        #### What TerraMatch does
        - Reads a KMZ map of agricultural polygons
        - Reads farmer administrative records from CSV
        - Summarizes polygon geometry into areas and centroids
        - Sends both datasets to Gemini for spatial reconciliation
        - Returns a color-coded map plus reasoning log
        """
    )
