# BoxSpaceOptimiser — Prototype

A self-contained browser prototype for the ACE-IT Live Business Challenge. Built with plain HTML, CSS and JavaScript; no build step, package installation, API key or backend is required.

## Run it

1. Extract `BoxSpaceOptimiser.zip`.
2. Open `index.html` in a modern browser (Chrome/Edge recommended).
3. Click **Generate plan**.
4. Select a vehicle, edit the item master, test a late order, and export the generated loading plan as JSON.

## Included

- Vehicle screening by volume and payload.
- Editable SKU item master and CSV import/export.
- Heuristic 3D placement using extreme-point candidates, orientation options, collision checks, support checks, and stackability/fragility rules.
- Top-down loading projection with load sequence labels.
- Late-order stress test and configurable planning buffer.
- Constraint-check summary and local run history.

## Important limitations

- The supplied challenge brief provides aggregate shipment numbers, not the full source item master. The default SKU dimensions and per-item weights are illustrative demo data, scaled to approximate the brief's 144 units, 24.6 m³ and 2,495 kg. Do not represent the generated SKU geometry as the original business-case data.
- Vehicle dimensions/capacities are prototype assumptions aligned approximately to the brief's capacity ratios. Replace them with measured internal dimensions, payload limits, door clearances and axle limits before operational use.
- The packer is a greedy heuristic, not a globally optimal solver. A partial layout is a valid outcome and is shown transparently. Support calculations are simplified; the result is not a certified safety or load-restraint plan.
- No cloud persistence, authentication, backend API or ML model is included. The core is constraint-aware optimization, not a trained AI model.

## CSV columns

`sku,name,qty,length_cm,width_cm,height_cm,weight_kg_each,orientation,fragile,stackable,late`

Accepted orientation values: `Any`, `Upright only`, `Flat only`. Boolean values accept `true/false`, `yes/no`, or `1/0`.

## Visual loading views (updated)

- **Orbit camera:** drag directly on the 3D canvas to rotate the view horizontally and vertically.
- **350° orbit slider:** set the horizontal camera angle from 0° to 350°; elevation slider changes the viewing tilt.
- **Mouse wheel:** zoom the 3D view in and out. **Reset camera** returns to the default angle and zoom.
- **Click a visible box face** to inspect its unit ID, SKU, name, oriented dimensions, weight, X/Y/Z coordinates, orientation restriction, fragility, stackability, and late-order status.
- **Top** switches back to the original top-down floor plan. Camera rotation affects visualization only; it never changes the packing coordinates or algorithm.
- The 3D renderer is a lightweight interactive canvas projection and has no external library dependency. It is not a CAD model or certified stability/safety simulation.

For a demo: open `index.html` in Chrome/Edge → click **Generate plan** → drag the 3D model or set **Orbit** to 210° → click a box face → read the **Box Inspector** below the canvas.


## Product polish update

- Custom BoxSpace favicon and matching app icon (SVG).
- Browser theme colour, app metadata, and a lightweight web manifest.
- Visual-only UI polish: refined spacing, hover/focus states, rounded surfaces, clearer canvas grid, responsive touch details, and reduced-motion support.
- Core JavaScript planner, packing heuristic, CSV flow, vehicle screening, and late-order logic are unchanged.


Brand navigation: clicking the BoxSpaceOptimiser brand in the sidebar returns to the planner view. Both icon files are stored in the `assets/` directory.
