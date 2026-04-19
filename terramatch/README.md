# TerraMatch -> AI Spatial Reconciliation for Carbon Workflows

TerraMatch is a Next.js (frontend) + FastAPI (backend) platform.

## 1. Setup Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt # (or manually install fastapi uvicorn pydantic sqlalchemy pandas geopandas fiona shapely psycopg2-binary google-genai)
python main.py
```

## 2. Setup Frontend
```bash
cd frontend
npm install
npm run dev
```

## 3. Usage
- Go to `http://localhost:3000`
- Click `Launch Platform` or `Login`.
- Use the Dashboard to `Create Project` (upload `.csv` and `.kmz`).
- Paste your `GEMINI_API_KEY` on top right and click `Run Matcher`.
