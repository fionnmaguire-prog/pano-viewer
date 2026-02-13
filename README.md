# Pano Viewer (Local Editing + Web Deploy)

This project uses Vite for local development and production builds.

## 1) Local setup

```bash
npm install
cp .env.example .env
```

Edit `.env` as needed:

- `VITE_TOUR_ID`: default tour id for local testing
- `VITE_API_BASE`: API base URL for tour/media data
- `VITE_BASE_PATH`: deployment subfolder (keep `/` for root hosting)

## 2) Run local editor server

```bash
npm run dev
```

Local URL:

- `http://127.0.0.1:5173/`

Optional LAN sharing:

```bash
npm run dev:lan
```

## 3) Useful URL overrides

You can override defaults per session with query params:

- `?tour=your_tour_id`
- `?api=http://127.0.0.1:8787`
- `?admin=1`

Example:

`http://127.0.0.1:5173/?tour=prod_demo_house_01&api=http://127.0.0.1:8787`

## 4) Production build

```bash
npm run build
```

Deploy the generated `dist/` folder to your web host.

Local production preview:

```bash
npm run preview
```
