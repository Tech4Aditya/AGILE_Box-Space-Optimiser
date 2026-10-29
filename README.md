# BoxSpaceOptimiser
### Fit it right, not just fit it.

BoxSpaceOptimiser is a logistics-planning prototype for vehicle screening, 3D loading visualization, and late-order feasibility testing.

**SCREEN → PLAN → ADAPT**

> **Prototype notice:** This is a decision-support demo, not a certified loading or safety system. Validate sample data, constraints, and generated plans before real-world use.

## What it does

- **Vehicle screening:** compares shipment volume and weight with available vehicle capacity.
- **3D loading view:** visualizes a generated arrangement and, where supported, lets users orbit/zoom and inspect boxes.
- **Item master:** review and edit SKU information.
- **CSV import/export:** import inventory and export the item master.
- **Loading-plan export:** export plan data where supported by the current UI.
- **Late-order simulator:** test additional units against the current arrangement.
- **Run history and constraint status:** review demo runs and inspect key checks.

Feature availability depends on the implementation in the supplied frontend files.

## Workflow

### 1. Screen
Calculate total shipment volume and weight, then compare them with vehicle limits. A vehicle that passes this screen is only a candidate; capacity calculations alone do not prove that every item can be packed into a valid 3D arrangement.

### 2. Plan
The prototype uses a heuristic packing approach to try to place items in the container. Candidate positions are evaluated against the geometric constraints implemented in the current version. The result is a candidate loading plan, not a guarantee of globally optimal packing.

### 3. Adapt
Use the late-order simulator to test incoming items. The system evaluates whether they can be accommodated under the checks implemented in the current version. If they cannot, the plan or vehicle may need to change.

## Core algorithm

The packing approach is a **greedy, extreme-point-based 3D bin-packing heuristic**.

At a high level:

1. Read SKU data and expand quantities into individual units.
2. Calculate total volume and weight.
3. Screen candidate vehicles against capacity limits.
4. Order items using the prototype's packing priorities.
5. Generate candidate positions around already placed items.
6. Try permitted orientations and validate candidate placements.
7. Record placed and unplaced items.
8. Display the layout and allow late-order tests.

### Important distinction

- A heuristic finds a candidate arrangement; it does not prove global optimality.
- Passing volume/payload screening does not guarantee a collision-free 3D arrangement.
- A visual plan does not prove physical stability, load restraint, axle balance, or safe handling.
- Describe any future C++ solver or advanced optimization as planned until it is implemented and tested.

## Project structure

Expected structure for the root-assets setup:

```text
BoxSpaceOptimiser/
├── assets/
│   ├── favicon.svg
│   └── app-icon.svg
└── frontend/
    ├── index.html
    ├── styles.css
    ├── app.js
    ├── manifest.webmanifest
    └── README.md
```

The README may instead live at the repository root. Keep `assets/` at the project root if files in `frontend/` reference assets with `../assets/...`.

### Brand and favicon paths

For an HTML file in `frontend/` and assets in the sibling root-level `assets/` directory:

```html
<link rel="icon" type="image/svg+xml" href="../assets/favicon.svg">
<link rel="apple-touch-icon" href="../assets/app-icon.svg">
```

To display the same icon inside the sidebar brandmark, use an image—not a `<link>` element:

```html
<a class="brand brand-home" href="#plannerView" aria-label="BoxSpaceOptimiser home">
  <div class="brand-mark" aria-hidden="true">
    <img src="../assets/favicon.svg" alt="" class="brand-icon">
  </div>
  <div>
    <strong>BOXSPACE</strong>
    <small>OPTIMISER / 01</small>
  </div>
</a>
```

```css
.brand-icon {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
}
```

Paths are resolved relative to the page URL. If deploying under a subpath or through a frontend framework, configure the public asset path accordingly.

## Run locally

### Option A: Open the HTML file

1. Extract the project ZIP.
2. Open `frontend/index.html` in a modern browser.
3. Generate a plan and test the available views and tools.

Some browser features and relative asset paths can behave differently with `file://`. If assets or downloads fail, use a local server.

### Option B: Run a static server

From the project root:

```bash
python -m http.server 8000
```

Open:

```text
http://localhost:8000/frontend/
```

Stop the server with `Ctrl+C`.

No backend is required for the static demo. Framework-based deployments may need different build and asset-path configuration.

## Using the prototype

1. Open **Load Planner**.
2. Review the candidate vehicle.
3. Click **Generate Plan**.
4. Switch between Top and 3D views, if available.
5. Select a visible box to inspect its details.
6. Open **Item Master** to review or import inventory.
7. Use the **Late-order simulator** to test an incoming SKU and quantity.
8. Export the plan or inventory where supported.
9. Review constraint-check status and run history.

**Recommended demo sequence:** vehicle screening → generated layout → box inspection → late-order test.

## CSV inventory format

Use the file generated by **Item Master → Download CSV** as the source of truth for exact column names and accepted values. The names below are typical examples only; confirm them against the current CSV parser in `app.js`.

| Field | Meaning |
|---|---|
| `sku` | Unique SKU identifier |
| `name` | Human-readable item name |
| `qty` | Number of units |
| `length_cm` | Length in centimetres |
| `width_cm` | Width in centimetres |
| `height_cm` | Height in centimetres |
| `weight_kg_each` | Weight per unit in kilograms |
| `orientation` | Allowed orientation rule |
| `fragile` | Whether the item is fragile |
| `stackable` | Whether another item may be stacked on it |
| `late` | Whether it belongs to a late-arriving group |

Do not assume these example fields or values are accepted until checked against the exported template and parser. Use consistent units, positive dimensions, non-negative weights, and valid quantities. Test imports using a copy of the demo data first.

## Validation and limitations

Before using the prototype for a real shipment, validate:

- Actual item dimensions, weights, quantities, and handling instructions.
- Vehicle internal dimensions, door opening, payload, and relevant load limits.
- Item boundaries and collision-free placements.
- Orientation and stacking restrictions.
- Support area, centre of gravity, axle loads, load restraint, and physical stability.
- Access and loading/unloading sequence requirements.
- Late-order behaviour across representative shipments.

Do not claim optimal packing, guaranteed damage prevention, certified safety, or quantified cost savings without implementation evidence and real-world testing.

## Suggested next steps

1. Confirm the CSV schema against the parser and add clear import errors.
2. Build repeatable shipment tests and track placed/unplaced units and planning time.
3. Improve candidate scoring and compare multiple layouts instead of accepting only the first valid placement.
4. Add robust support, stability, weight-distribution, and load-restraint validation.
5. Benchmark larger shipments before considering a dedicated optimized solver.
6. Pilot against historical loads and compare vehicle count, utilization, planning time, damage claims, and late-order acceptance.

---

**BoxSpaceOptimiser · ACE-IT Live Business Challenge · JIIT Noida**

A prototype demonstrating rule-aware vehicle screening, 3D packing, and late-order adaptation.
