# BoxSpaceOptimiser — Root Assets Build

```text
BoxSpaceOptimiser/
├── assets/
│   ├── favicon.svg
│   └── app-icon.svg
└── frontend/
    ├── index.html
    ├── styles.css
    ├── app.js
    └── manifest.webmanifest
```

Open `frontend/index.html`. If icons or manifest are blocked under `file://`, run a static server from the project root: `python -m http.server 8000`, then open `http://localhost:8000/frontend/`.

Both the browser favicon and sidebar brandmark use `../assets/favicon.svg`. The manifest app icon uses `../assets/app-icon.svg`. The packing and business logic in `app.js` is unchanged.
