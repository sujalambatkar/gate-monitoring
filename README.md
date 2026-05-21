# Site Operations Intelligence Platform

Real-time factory gate monitoring: YOLOv8 object detection over WebSocket + Google Gemini AI for shift reports and anomaly alerts.

```
┌─────────────────────────────────────────────────────────────────┐
│                       Architecture Overview                      │
│                                                                  │
│  Browser (Next.js 15)                                            │
│  ┌─────────────┐  JPEG frames / WS   ┌────────────────────────┐ │
│  │  LiveFeed   │ ──────────────────► │  FastAPI /ws/stream    │ │
│  │  (canvas)   │ ◄── detections ──── │                        │ │
│  └─────────────┘                     └──────────┬─────────────┘ │
│                                                 │               │
│  ┌─────────────┐   REST / JSON        ┌─────────▼─────────────┐ │
│  │  Reports    │ ◄──────────────────► │  YOLOv8 (3 models)    │ │
│  │  Alerts     │                      │  Google Gemini Flash   │ │
│  │  Dashboard  │                      │  Motor (MongoDB)       │ │
│  └─────────────┘                      └───────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Features

| Feature | Detail |
|---------|--------|
| Live detection | Three YOLOv8 models over WebSocket, ~5 fps |
| Cumulative counting | Tracker-ID deduplication — count never decrements when objects leave frame |
| Object classes | Workers (person), vehicles, boxes/FRP sheets, chemical drums/barrels |
| Multi-camera | Camera selector dropdown with iPhone Continuity Camera auto-detection |
| Anomaly detection | Gemini analysis every 5 min — severity-tagged alert feed |
| Shift reports | AI-generated JSON + auto PDF via ReportLab, efficiency score 0–100 |
| Input modes | Live webcam **or** local MP4 video file |
| Auth | JWT single-admin (username/password configurable in `.env`) |
| Charts | Recharts area chart — 30-point rolling activity timeline |

## Model Architecture

Three separate YOLOv8 models run per frame, each with tuned confidence thresholds:

| Env var | Default path | Classes | Confidence |
|---------|-------------|---------|------------|
| `MODEL_BASE` | `~/gate-monitor/yolov8n.pt` | person, truck, car, bus, motorcycle | 0.50 |
| `MODEL_BOX` | `~/gate-monitor/runs/detect/gate1_box/weights/best.pt` | box, frp, frp_sheet, carton, crate | 0.50 |
| `MODEL_BARREL` | `~/gate-monitor/runs/detect/gate3_barrel4/weights/best.pt` | drum, chemical_drum, barrel, container | 0.65 |

The barrel model uses a higher threshold (0.65) to suppress false positives on square/rectangular objects.

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 20+
- MongoDB running locally or on Atlas
- Trained YOLOv8 `.pt` weights (falls back to `yolov8n.pt` from PyPI if paths not found)
- Google Gemini API key — free tier available at [aistudio.google.com](https://aistudio.google.com)

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Copy and fill in your values
cp .env.example .env
```

Edit `.env`:

```env
GEMINI_API_KEY=your_key_here
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=site_ops_intel
JWT_SECRET=change-me-in-production
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
MODEL_BASE=~/gate-monitor/yolov8n.pt
MODEL_BOX=~/gate-monitor/runs/detect/gate1_box/weights/best.pt
MODEL_BARREL=~/gate-monitor/runs/detect/gate3_barrel4/weights/best.pt
```

```bash
uvicorn main:app --reload --port 8000
```

API available at `http://localhost:8000` · Interactive docs: `http://localhost:8000/docs`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:3000` — sign in with **admin / admin123** (or your `.env` values).

## Input Modes

### Live Camera

Click **Start Stream** on the Dashboard. The browser enumerates all video input devices and shows a dropdown — on macOS with an iPhone nearby, Continuity Camera appears automatically and is pre-selected. Frames are captured at ~5 fps and streamed over WebSocket.

### Video File

Click **Video File** in the feed panel and choose an MP4 (up to 100 MB). The video plays in the browser and frames are piped through the same WebSocket pipeline. No camera needed — useful for demos or replaying recorded gate footage.

A server-side batch endpoint also exists for large files: `POST /analyze/upload-video` (multipart, `file` field).

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/login` | Get JWT token |
| `GET` | `/health` | Liveness check |
| `WS` | `/ws/stream` | Real-time frame inference |
| `POST` | `/analyze/frame` | Single base64 frame |
| `POST` | `/analyze/reset-counts` | Clear cumulative session counts |
| `POST` | `/analyze/upload-video` | Batch video processing |
| `POST` | `/analyze/shift` | Generate AI shift report |
| `GET` | `/reports` | List reports |
| `GET` | `/reports/{id}` | Report detail |
| `GET` | `/reports/{id}/pdf` | Download PDF |
| `GET` | `/alerts` | List alerts (filterable) |
| `PATCH` | `/alerts/{id}/resolve` | Mark alert resolved |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | _(required for AI)_ | Google Gemini API key |
| `MONGODB_URI` | `mongodb://localhost:27017` | MongoDB connection string |
| `MONGODB_DB` | `site_ops_intel` | Database name |
| `JWT_SECRET` | `change-me-in-production` | JWT signing secret |
| `ADMIN_USERNAME` | `admin` | Login username |
| `ADMIN_PASSWORD` | `admin123` | Login password |
| `MODEL_BASE` | `~/gate-monitor/yolov8n.pt` | Person + vehicle model weights |
| `MODEL_BOX` | _(see above)_ | Box/FRP model weights |
| `MODEL_BARREL` | _(see above)_ | Drum/barrel model weights |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend URL (set in frontend `.env.local`) |

The backend gracefully degrades when `GEMINI_API_KEY` is absent — inference still runs, reports return placeholder summaries.

## Project Structure

```
site-ops-intel/
├── backend/
│   ├── main.py                  # FastAPI app, JWT auth, lifespan, anomaly loop
│   ├── requirements.txt
│   ├── .env.example
│   ├── models/
│   │   └── schemas.py           # Pydantic v2 request/response models
│   ├── routes/
│   │   ├── stream.py            # WebSocket /ws/stream
│   │   ├── analyze.py           # /analyze/* endpoints
│   │   ├── reports.py           # Report CRUD + PDF download
│   │   └── alerts.py            # Alert CRUD + resolve
│   └── services/
│       ├── yolo_service.py      # Three-model YOLOv8 wrapper, tracker-based dedup
│       ├── gemini_service.py    # Google Gemini AI (shift reports + anomaly detection)
│       ├── event_service.py     # Frame detections → semantic events
│       └── report_service.py   # ReportLab PDF generation
└── frontend/
    └── src/app/
        ├── page.tsx             # Login page
        ├── dashboard/           # Live feed, stat cards, timeline chart
        ├── reports/             # Report list and detail pages
        ├── alerts/              # Anomaly alert feed with filters
        ├── components/
        │   ├── LiveFeed.tsx     # WebSocket video + canvas overlay + camera selector
        │   ├── StatCards.tsx    # Cumulative counts (workers / vehicles / boxes / drums)
        │   ├── TimelineChart.tsx
        │   ├── Sidebar.tsx
        │   ├── ReportCard.tsx
        │   └── AlertBadge.tsx
        ├── lib/api.ts           # Typed fetch/WebSocket helpers
        └── instrumentation.ts  # Next.js SSR localStorage polyfill
```

## MongoDB Collections

| Collection | Key fields |
|------------|------------|
| `events` | `type`, `timestamp`, `confidence`, `metadata`, `shift_id` |
| `alerts` | `type`, `severity`, `title`, `description`, `recommended_action`, `resolved` |
| `reports` | `shift_start`, `shift_end`, `result` (JSON), `pdf_path`, `efficiency_score` |

## Cumulative Counting

Each YOLOv8 model runs with `track(persist=True)` which assigns a consistent numeric ID to each object across frames. The backend maintains a `_seen_ids` set per session — an object is only added to the cumulative count the first time its tracker ID appears. Counts are exposed via two separate fields in every WebSocket message:

- `counts` — objects visible in the current frame
- `cumulative` — session total (monotonically increasing until manual reset)

The **Reset Counts** button on the dashboard calls `POST /analyze/reset-counts`, which clears both the seen-IDs set and the tracker state.

---

Built with FastAPI · Next.js 15 · YOLOv8 (ultralytics) · Google Gemini · MongoDB · Recharts
