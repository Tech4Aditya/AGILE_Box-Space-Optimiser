# BoxSpace Optimiser

**Fit it right — not just fit it.**

BoxSpace Optimiser is a full-stack logistics decision-support prototype for planning carton placement inside a truck, visualising the loading sequence in 3D, estimating cargo-handling risk, and comparing road-route operating costs.

> **Project status:** Prototype / showcase build. It is designed to demonstrate a connected frontend, Python API, constraint-based packing engine, trainable ML workflow and public road-routing integrations. It is **not** a certified vehicle-loading, fleet-dispatch or safety system.

---

## Contents

- [What it does](#what-it-does)
- [Feature walkthrough](#feature-walkthrough)
- [Technology stack](#technology-stack)
- [Architecture and data flow](#architecture-and-data-flow)
- [Getting started](#getting-started)
- [Using the application](#using-the-application)
- [Backend API reference](#backend-api-reference)
- [AI/ML workflow](#aiml-workflow)
- [Packing logic and validation](#packing-logic-and-validation)
- [Route optimisation and map](#route-optimisation-and-map)
- [Project structure](#project-structure)
- [Configuration and data](#configuration-and-data)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Known limitations and responsible use](#known-limitations-and-responsible-use)
- [Future improvements](#future-improvements)
- [Credits](#credits)

## What it does

The application brings four connected workflows into one dashboard:

1. **Load planning:** submit carton and vehicle details to the backend and generate a 3D placement plan.
2. **3D loading showcase:** inspect the truck and cargo arrangement, orbit/zoom the scene and play the sequential loading animation.
3. **Cargo-risk ML:** score placed cartons, record damage/no-damage outcomes and retrain a logistic-regression model when enough labelled outcomes have been collected.
4. **Transport routing:** choose pickup and delivery cities, request road-route geometry from public routing services, view the route on an interactive map and compare estimated operating costs.

The frontend is served by FastAPI. This means the browser UI and API share the same local origin when launched using the provided scripts.

## Feature walkthrough

### 1. Dashboard and inventory

- View the carton inventory and item-level attributes.
- Load the included sample inventory from `data/sample_inventory.csv`.
- Review carton dimensions, weight, quantity, fragility and stacking constraints.
- Use the planner controls to select a vehicle and packing strategy.

### 2. 3D truck and sequential loading

- Three-dimensional truck/trailer showcase rendered with Three.js.
- Orbit, zoom and inspect the cargo bay from different angles.
- Play the loading sequence or step through cartons one at a time.
- The viewer uses the placement coordinates returned by the packing plan; it is not an independent packing solver.

The 3D library is loaded from a CDN, so the first 3D view requires internet access unless the library is separately vendored.

### 3. 3D carton placement

The backend packing endpoint generates carton positions within the selected vehicle/container dimensions. The implementation checks:

- Container boundaries.
- 3D intersection/overlap between cartons.
- Allowed carton orientations.
- Vehicle payload limit.
- Stackability and support eligibility.
- Cumulative supported weight through the support chain.

The response includes placed and unplaced items plus a geometry/constraint audit. Unplaced items should be reviewed rather than silently treated as loaded.

### 4. Benchmarking and exports

- Run the included reference packing cases to catch regressions in placement constraints.
- Export the generated placement plan as CSV for inspection or downstream analysis.
- The benchmark cases are software sanity checks, not independent proof of optimality or real-world loading safety.

### 5. AI cargo-risk scoring

- The backend exposes model training and prediction endpoints.
- The model is logistic regression implemented with NumPy.
- Carton features include fragility, weight, shape/height proportion and stackability.
- The dashboard can record a damage or no-damage outcome for the currently highlighted high-risk carton.
- Labelled outcomes are persisted locally in `backend/cargo_outcomes.jsonl` (created when feedback is recorded).
- Once at least 20 labelled outcomes are available, the training endpoint can fit the model using those labelled records; before that, the model uses synthetic bootstrap training examples.

**Important:** A risk score is a model estimate, not a guarantee that a carton will or will not be damaged. The model needs a representative, sufficiently large and independently validated dataset before operational use.

### 6. City-based road routing and live map

- Select pickup and delivery from the cities configured in the frontend.
- City selections resolve to coordinates; advanced coordinate inputs may also be used where exposed by the UI.
- The route workflow requests driving-route geometry from public routing services and displays route lines and endpoint markers on a Leaflet map.
- OpenStreetMap tiles provide the visible basemap, with attribution shown in the UI.
- Route options are ranked using estimated fuel, maintenance and toll costs calculated by the backend cost endpoint.

Public routing and map services require internet connectivity and may be unavailable, rate-limited or restricted. The application does not guarantee traffic-aware ETAs, truck-specific restrictions, authoritative toll charges or live road closures.

---

## Technology stack

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | HTML5, CSS3, JavaScript | Dashboard, inventory, controls and API requests |
| 3D visualisation | Three.js | Truck/cargo scene and loading animation |
| Interactive map | Leaflet + OpenStreetMap | Map tiles, markers and route display |
| Routing data | Public OSRM / OpenStreetMap services | Driving route geometry and road data, subject to provider availability |
| Backend | Python, FastAPI, Uvicorn | REST API and static frontend serving |
| Packing engine | Python | 3D placement and constraint validation |
| ML | NumPy, logistic regression | Cargo-risk training and inference |
| Data storage | JSON / JSONL files | Persisted model parameters and labelled feedback |

## Architecture and data flow

```text
                ┌──────────────────────────────┐
                │       Browser dashboard      │
                │ HTML · CSS · JavaScript      │
                └──────────────┬───────────────┘
                               │ HTTP / JSON
                               ▼
                ┌──────────────────────────────┐
                │        FastAPI backend       │
                │       127.0.0.1:8000         │
                └──────┬──────────┬────────────┘
                       │          │
             ┌─────────▼───┐  ┌───▼────────────────┐
             │ Packing     │  │ AI/ML risk service │
             │ engine      │  │ train · predict    │
             └─────────────┘  │ feedback · model   │
                              └────────────────────┘
                       │
                       ▼
                ┌──────────────────┐
                │ Route cost API   │◄──── Browser requests public road
                │ fuel · upkeep    │      geometry / map tiles separately
                │ · toll estimate  │
                └──────────────────┘
```

**Typical load-planning flow:** inventory → `POST /api/plan` → validated placements/unplaced items → 3D viewer → `POST /api/ai/risk` → risk indicators.

**Typical routing flow:** pickup/delivery city → coordinates → public route provider → route geometry on Leaflet → `POST /api/route/cost` for each candidate → compare estimated costs.

## Getting started

### Requirements

- Windows 10/11, macOS or Linux.
- Python 3.10 or newer.
- Internet connection for first-time dependency installation, CDN-loaded 3D library, public map tiles and public routing services.
- A modern browser (Chrome or Edge recommended).

### Windows

1. Download and extract the complete project ZIP. Do not run `index.html` from inside the ZIP archive.
2. Open the extracted `BoxSpaceOptimiser_Upgrade` folder.
3. Double-click `run_backend.bat`.
4. Wait for the terminal to finish installing dependencies and report that the server is running.
5. Keep the terminal open while using the app.
6. Open **http://127.0.0.1:8000** in Chrome or Edge.
7. Open **http://127.0.0.1:8000/docs** to inspect and call the API.

If the `py` command is not recognised, install Python 3.10+ and enable **Add Python to PATH** during installation.

### macOS / Linux

From the project root:

```bash
chmod +x run_backend.sh
./run_backend.sh
```

Then open **http://127.0.0.1:8000**.

### Manual setup

If the launcher fails, run these commands from the project root.

**Windows PowerShell:**

```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
py -m pip install --upgrade pip
py -m pip install -r backend\requirements.txt
py -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

**macOS / Linux:**

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Do not close the terminal while the application is running.

## Using the application

1. Open the dashboard at `http://127.0.0.1:8000`.
2. Review or load the sample inventory.
3. Select the truck/container and packing options.
4. Generate a packing plan and inspect the placed/unplaced counts and validation output.
5. Use the 3D controls to orbit, zoom and play/step through the loading sequence.
6. Review the AI risk summary. Record an outcome only when you have a genuine observed damage/no-damage result.
7. Use the AI training control to retrain the backend model when enough genuine labels have accumulated.
8. Open Route Optimiser, choose pickup and delivery cities, configure vehicle mileage and cost assumptions, and request routes.
9. Compare route distance, duration and estimated cost. Verify the route independently before any real dispatch.
10. Export the placement plan CSV when needed.

## Backend API reference

Interactive API documentation is available at **`http://127.0.0.1:8000/docs`** while the backend is running.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Backend/model health and labelled-outcome count |
| `POST` | `/api/plan` | Generate a 3D carton placement plan and constraint audit |
| `POST` | `/api/ai/train` | Train and persist the cargo-risk model |
| `POST` | `/api/ai/risk` | Return risk predictions for submitted cartons |
| `POST` | `/api/ai/feedback` | Persist a labelled damage/no-damage outcome |
| `POST` | `/api/route/cost` | Calculate estimated fuel, maintenance, toll and total cost |

### Example: health check

```bash
curl http://127.0.0.1:8000/api/health
```

### Example: route cost

```bash
curl -X POST http://127.0.0.1:8000/api/route/cost \
  -H "Content-Type: application/json" \
  -d '{"distance_km": 100, "mileage_kmpl": 5, "diesel_price": 92, "maintenance_per_km": 4, "toll_estimate": 150}'
```

The route-cost endpoint calculates estimates from the supplied distance and assumptions. It does not itself fetch a road route; route geometry is obtained by the frontend from the public routing service.

## AI/ML workflow

### Model

The backend uses logistic regression with NumPy for binary cargo-risk scoring. The feature vector is derived from carton attributes such as:

- Fragility flag.
- Carton weight.
- Height/shape proportion.
- Stackability flag.

The backend returns a risk score and a categorical risk level. The exact score should be interpreted as a relative model output, not a calibrated probability unless calibration has been established with validation data.

### Training lifecycle

1. On initial setup, the model can be bootstrapped with generated synthetic examples.
2. The dashboard requests predictions for cartons in a generated plan.
3. A user can submit an observed damage or no-damage outcome for the selected carton.
4. Feedback is appended to the local JSONL outcome store.
5. After 20 or more labelled outcomes, the training endpoint can use those records to train the model on the collected labels.
6. The trained model parameters are saved locally and reused by later predictions.

Do not fabricate labels to reach the threshold. Poor labels create a poor model. For a meaningful model, collect consistent outcomes with enough examples across carton types, weights, handling conditions and transport contexts; separate training and evaluation data; and measure precision, recall, F1 and calibration on held-out data.

## Packing logic and validation

The packing engine is a heuristic 3D placement solver. It considers allowed orientations and candidate positions, then checks whether each carton can be placed without violating the configured constraints.

The core geometric checks include:

- **Bounds:** the carton must remain inside the container dimensions.
- **Collision:** its 3D volume must not intersect an already placed carton.
- **Orientation:** only permitted rotations are considered.
- **Payload:** total loaded mass must not exceed the vehicle payload limit.
- **Support:** a carton placed above the floor must have an eligible supporting carton/surface according to the solver's support rule.
- **Stack load:** supported weight is checked against stack-load constraints through the support chain.

A feasible result means the configured software checks passed. It does not prove the load is safe under acceleration, braking, vibration, cornering or impact.

## Route optimisation and map

The route screen uses city coordinates to request driving-route geometry from public routing services. The route line and pickup/delivery markers are drawn on a Leaflet map using OpenStreetMap tiles. Candidate routes are compared using backend estimates for:

- Fuel = distance ÷ mileage × diesel price.
- Maintenance = distance × maintenance cost per kilometre.
- Toll = supplied/estimated toll allowance.
- Total estimated operating cost = fuel + maintenance + toll.

The cheapest displayed route is the cheapest under the entered assumptions—not necessarily the fastest, safest or best route. Public routing services may not account for truck height/weight restrictions, hazardous-goods restrictions, private roads, current traffic, temporary closures or exact toll rates.

## Project structure

```text
BoxSpaceOptimiser_Upgrade/
├── backend/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app, packing, ML and cost APIs
│   └── requirements.txt        # Python dependencies
├── frontend/
│   ├── index.html              # Dashboard structure
│   ├── styles.css              # UI styling and responsive layout
│   ├── app.js                  # UI state, API calls, planner and routes
│   └── viewer.js               # Three.js truck and cargo visualisation
├── data/
│   ├── sample_inventory.csv    # Demonstration carton inventory
│   └── packing_benchmark_cases.csv
├── backend_smoke_test.py       # Backend/API smoke tests
├── run_backend.bat             # Windows launcher
├── run_backend.sh              # macOS/Linux launcher
└── README.md
```

Runtime files such as the saved model parameters and `backend/cargo_outcomes.jsonl` may be generated after the first training/feedback operation; they are not necessarily present in a fresh source archive.

## Configuration and data

### Sample inventory

`data/sample_inventory.csv` contains demonstration carton records. Use it to explore the application, or prepare your own inventory using the field names expected by the frontend/backend.

Typical carton attributes include an item/SKU identifier, display name, length, width, height, weight, quantity, fragility, stackability, allowed orientation and maximum stack load. Confirm the exact field names and units in the sample CSV and API schema before importing a custom file.

**Units:** Keep dimensions consistent throughout the inventory and vehicle/container configuration. The application expects the same unit system for carton and vehicle dimensions; weight and payload must also use consistent units. Do not mix centimetres with millimetres or kilograms with pounds.

### Route assumptions

The route cost calculation depends on the entered vehicle mileage, diesel price, maintenance-per-kilometre and toll estimate. These are user-supplied assumptions and should be updated for the vehicle and journey being evaluated.

## Testing

With the backend running, open a second terminal in the project root and execute:

```bash
python backend_smoke_test.py
```

The smoke test checks the health, packing, AI training, AI prediction, route costing and frontend-serving paths. A passing smoke test confirms those API flows respond in the local test environment; it does not validate external map-provider availability or physical loading safety.

## Troubleshooting

### Dashboard does not open

- Confirm the launcher terminal is still running.
- Open `http://127.0.0.1:8000` rather than double-clicking `frontend/index.html`.
- Check whether another process is already using port 8000.

### `py` or `python` is not recognised

Install Python 3.10+ and enable **Add Python to PATH**. Reopen PowerShell/Command Prompt after installation.

### Dependency installation fails

- Check internet connectivity.
- Activate the project's virtual environment if setting up manually.
- Run `python -m pip install -r backend/requirements.txt` again.
- Read the first error in the terminal; later errors may be consequences of the first failure.

### Port 8000 is already in use

Stop the other process using that port, or start Uvicorn on another port. If changing the port, update the frontend API base/origin configuration consistently as well.

### API shows offline

- Check that the backend terminal is running without a traceback.
- Open `http://127.0.0.1:8000/api/health`.
- Open `/docs` to confirm FastAPI is reachable.
- If health works but route search fails, the local backend is online and the external routing provider may be unavailable or blocked.

### Map is blank or route does not appear

- Check internet access and browser developer-console/network errors.
- Confirm OpenStreetMap tile requests and the public routing request are not blocked by a firewall, proxy, extension or network policy.
- Public services can rate-limit or temporarily fail; retry later.
- A successful backend health check does not guarantee that external map tiles or OSRM are reachable.

### 3D truck is missing

- Use a current Chrome/Edge browser.
- Check internet access because Three.js is loaded from a CDN.
- Check the browser console for WebGL or CDN errors.

### AI model reports insufficient labelled outcomes

This is expected until at least 20 labelled feedback records have been collected. Use genuine observed outcomes; do not create fake labels. Synthetic bootstrap training is only for demonstration and initial operation.

## Known limitations and responsible use

- The packing solver is heuristic and does not guarantee a globally optimal packing arrangement.
- No full rigid-body physics, centre-of-gravity, axle-load, pallet, strap/restraint, crush-strength, vibration or braking simulation is implemented.
- A geometric placement audit is not a cargo-securing or roadworthiness certification.
- The ML model starts with synthetic bootstrap data and must be validated on real, representative, labelled operational data before decision-making use.
- The public routing/map integrations depend on third-party availability and policies. They are not a substitute for a commercial truck navigation provider.
- Route cost estimates depend on entered mileage, diesel price, maintenance and toll assumptions; they are not invoices or guaranteed costs.
- The app is a local prototype. It does not include production authentication, role-based access control, cloud deployment, a managed database, fleet telematics or multi-user concurrency controls.

**Never use this prototype as the sole basis for loading, securing or dispatching a real truck.** A qualified logistics/load-planning professional must validate any real loading plan and route.

## Future improvements

- Physics-informed load stability, centre-of-gravity and axle-load calculations.
- Truck-specific height, width, gross-weight and road restriction support.
- More advanced packing optimisation (multi-start search, metaheuristics and benchmark comparisons).
- A properly curated damage dataset with reproducible train/validation/test splits and model metrics.
- Persistent relational storage, authentication, audit trails and multi-user support.
- Commercial routing integration with truck profiles, traffic, toll and restriction data.
- Automated UI tests and browser-level end-to-end testing.

## Credits

Built by **Team Agile** as the **BoxSpace Optimiser** prototype.

- Map data © OpenStreetMap contributors. See the [OpenStreetMap copyright and attribution page](https://www.openstreetmap.org/copyright).
- Routing geometry is requested from public OSRM-compatible routing services; service availability and usage policies apply.
- Three.js and Leaflet are open-source libraries loaded by the frontend.

---

**BoxSpace Optimiser · Team Agile · Prototype decision support**
