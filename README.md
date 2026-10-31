# BoxSpace Optimiser — runnable full-stack showcase

**This ZIP contains the frontend AND a real local Python backend.** It is not a hosted cloud service. Start the backend first; it serves the UI and all API endpoints from the same address.

## Run on Windows
1. Extract the entire ZIP (do not open `index.html` directly inside the ZIP).
2. Open `BoxSpaceOptimiser_Upgrade`.
3. Double-click `run_backend.bat`.
4. Wait until the terminal says the server is running.
5. Open **http://127.0.0.1:8000** in Chrome/Edge. Keep the terminal open.
6. Open **http://127.0.0.1:8000/docs** to inspect and try the API endpoints.

Requires Python 3.10+. First launch needs internet to install dependencies. If `py` is not recognised, install Python from python.org and enable **Add Python to PATH**.

## Run on macOS / Linux
```bash
chmod +x run_backend.sh
./run_backend.sh
```
Then open http://127.0.0.1:8000.

## Verify the backend
With the server running, open a second terminal in this folder and run:
```bash
python backend_smoke_test.py
```
Expected output:
```text
PASS: health, packing, AI training, AI prediction, route costing, frontend serving
```

## API endpoints
| Method | Endpoint | What it does |
|---|---|---|
| GET | `/api/health` | Confirms server and model status |
| POST | `/api/plan` | Generates a 3D carton placement plan and geometry audit |
| POST | `/api/ai/train` | Trains and saves the logistic-regression risk model |
| POST | `/api/ai/risk` | Scores cartons for handling risk |
| POST | `/api/ai/feedback` | Saves a labelled damage / no-damage outcome for a scored carton; 20+ labels enable training on those operational labels |
| POST | `/api/route/cost` | Calculates fuel, maintenance and indicative toll cost |

Interactive Swagger API explorer: `/docs`.

## What the application does
- Three.js truck showcase with orbit/zoom controls, auto-rotation and sequential loading animation. The 3D library is loaded from a CDN, so the first 3D load needs internet.
- Backend 3D placement solver with allowed orientations, truck bounds, collision, payload, support and cumulative stack-load checks.
- AI risk scoring via a persisted NumPy logistic-regression model. Until 20 labelled outcomes are collected, training uses clearly disclosed synthetic bootstrap examples. Use **Log damage** / **Log no damage** on the latest highest-risk carton; after 20+ genuine outcomes, Train / refresh fits the model on those labelled records. Do not label synthetic guesses as real incidents. The model is only as good as the recorded outcomes and requires independent validation.
- Route alternatives are requested from the public OSRM driving service and rendered on an interactive Leaflet map with OpenStreetMap road tiles, route polyline, pickup/delivery markers and visible attribution. Cost ranking uses the backend cost API. If the public route provider is unavailable, the UI reports the failure; live truck restrictions, traffic and authoritative tolls are not guaranteed. OSM standard tiles are best-effort and must follow the published tile policy.

## Important engineering limits
Packing is a heuristic, not a globally optimal proof. The model does not simulate centre of gravity, axle loads, straps, pallets, braking or physical damage. The risk model must be retrained and validated on real labelled logistics data before operational use. Public routing services can rate-limit requests.

## Project layout
```text
BoxSpaceOptimiser_Upgrade/
├── backend/main.py
├── backend/requirements.txt
├── backend/cargo_risk_model.json
├── backend/cargo_outcomes.jsonl (created as users record outcomes)
├── frontend/index.html
├── frontend/styles.css
├── frontend/app.js
├── frontend/viewer.js
├── data/
├── run_backend.bat
├── run_backend.sh
└── backend_smoke_test.py
```
