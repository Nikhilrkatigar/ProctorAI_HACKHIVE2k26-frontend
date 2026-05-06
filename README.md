# 🔒 ProctorAI — Real-Time Exam Integrity System

> **HACKHIVE-2k26 · AI/ML Track** — Award-winning AI-powered online proctoring with live risk scoring, WebRTC webcam streaming, and automated PDF reporting.

---

## ✨ Features

| Feature | Tech |
|---|---|
| 👁️ Face Recognition & Identity Verification | `face_recognition` (dlib) / OpenCV Haar fallback |
| 👀 Iris-based Eye Tracking | MediaPipe FaceMesh (468 landmarks) |
| 🧭 Head Pose Estimation (yaw/pitch/roll) | OpenCV `solvePnP` |
| 👥 Multi-Person Detection | YOLOv8n (auto-download) / HOG fallback |
| 🔁 Tab Switch Detection | `visibilitychange` + `blur` events |
| 📋 Clipboard Blocking | `copy/paste/cut` event capture |
| 📊 Live Risk Scoring (0–100) | Rolling score with decay |
| 🔴 Real-Time Alerts | WebSocket push to proctor dashboard |
| 📄 Automated PDF Reports | ReportLab with snapshots & timeline |
| 📸 Violation Snapshots | JPEG captures on HIGH severity alerts |
| 📈 Live Chart Dashboard | Recharts `LineChart` per candidate |
| 🌙 Dark Mode | Tailwind `dark:` class strategy |

---

## 🗂️ Project Structure

```
proctorAI/
├── backend/
│   ├── main.py                   # FastAPI app + WebSocket endpoint
│   ├── websocket_handler.py      # Frame processing + alert dispatch
│   ├── detectors/
│   │   ├── face_detector.py      # Identity verification
│   │   ├── eye_tracker.py        # Gaze direction (MediaPipe)
│   │   ├── head_pose.py          # Yaw/pitch/roll (solvePnP)
│   │   ├── person_counter.py     # YOLOv8n / HOG person count
│   │   └── alert_engine.py       # Risk score + alert deduplication
│   ├── models/
│   │   ├── schemas.py            # Pydantic request/response models
│   │   └── database.py           # SQLAlchemy ORM (SQLite)
│   ├── routes/
│   │   ├── auth.py               # Login for student / proctor
│   │   ├── exam.py               # Start / end / status endpoints
│   │   └── report.py             # JSON + PDF report endpoints
│   ├── utils/
│   │   ├── pdf_report.py         # ReportLab PDF generator
│   │   └── snapshot.py           # JPEG frame capture
│   ├── requirements.txt
│   └── .env
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── Login.jsx           # Role-based login page
    │   │   ├── StudentExam.jsx     # Exam interface + webcam
    │   │   └── ProctorDashboard.jsx# Live monitoring + charts
    │   ├── components/
    │   │   ├── VideoFeed.jsx       # WebRTC stream display
    │   │   ├── AlertFeed.jsx       # Scrolling alert list
    │   │   ├── CandidateCard.jsx   # Per-student status card
    │   │   ├── RiskMeter.jsx       # SVG circular gauge
    │   │   └── ReportModal.jsx     # Exam report viewer
    │   ├── hooks/
    │   │   ├── useWebSocket.js     # WS connection + message hook
    │   │   └── useWebcam.js        # getUserMedia + frame capture
    │   └── App.jsx                 # Router
    ├── package.json
    ├── vite.config.js
    └── tailwind.config.js
```

---

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- (Optional) Redis for enhanced session state
- (Optional) CMake + dlib for `face_recognition` (falls back to OpenCV if absent)

### 1 — Backend

```bash
cd proctorAI/backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Optional: full face recognition (requires cmake)
# pip install face-recognition

# Copy env
cp .env .env.local   # edit if needed

# Start API server
uvicorn main:app --reload --port 8000
```

The backend will be available at **http://localhost:8000**  
API docs: **http://localhost:8000/docs**

### 2 — Frontend

```bash
cd proctorAI/frontend

npm install
npm run dev
```

Open **http://localhost:5173**

### 3 — (Optional) Redis

```bash
redis-server   # or: docker run -p 6379:6379 redis
```

---

## 🔐 Demo Credentials

| Role | Email | Password |
|---|---|---|
| Proctor | `proctor@hackhive.ai` | `proctor123` |
| Student | `alice@hackhive.ai` | `student123` |

> Any new email + password will auto-register as a student for demo ease.

---

## 🎬 Demo Script (for Judges)

1. **Login** as Proctor → open Proctor Dashboard in Tab A  
2. **Login** as Student → open Student Exam in Tab B (or another browser)  
3. Student clicks **"Start Exam"** → face reference captured automatically  
4. **Look away** from camera → `GAZE_LEFT/RIGHT` alert appears on proctor dashboard in ≤3s  
5. **Switch tab** in student browser → `TAB_SWITCH` alert fires instantly  
6. **Hold phone in frame** → `MULTIPLE_PERSONS` HIGH alert fires; risk score spikes  
7. Watch the **live LineChart** on proctor dashboard update in real time  
8. Click **"Terminate"** on proctor card → student sees termination message  
9. Click student **"Submit Exam"** → submission confirmation appears  
10. Open **Report Modal** on dashboard → see violation timeline + snapshots  

---

## 🌐 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/login` | Login (returns token) |
| `POST` | `/exam/start` | Start exam session |
| `POST` | `/exam/end` | End exam, trigger report |
| `GET`  | `/exam/{id}/status` | Live exam status |
| `GET`  | `/exam/list` | List recent exams |
| `WS`   | `/ws/{candidate_id}?role=student` | Student frame stream |
| `WS`   | `/ws/proctor?role=proctor` | Proctor alert stream |
| `GET`  | `/report/{id}/json` | JSON exam report |
| `GET`  | `/report/{id}/pdf` | Download PDF report |

---

## 📡 WebSocket Protocol

**Student → Server** (every 1 second):
```json
{ "type": "FRAME", "frame": "data:image/jpeg;base64,..." }
```

**Reference capture** (once on exam start):
```json
{ "type": "REFERENCE_FACE", "frame": "data:image/jpeg;base64,..." }
```

**Tab switch**:
```json
{ "type": "TAB_SWITCH" }
```

**Server → Client** (alert):
```json
{
  "type": "ALERT",
  "candidate_id": "alice",
  "type": "GAZE_LEFT",
  "severity": "MEDIUM",
  "score": 45,
  "timestamp": "2026-01-01T10:00:00Z",
  "snapshot_url": "/static/snapshots/alice_1234567.jpg"
}
```

---

## 🎨 Risk Score UI

| Score | Color  | Status     |
|-------|--------|------------|
| 0–30  | 🟢 Green  | CLEAN      |
| 31–60 | 🟡 Yellow | SUSPICIOUS |
| 61–90 | 🟠 Orange | HIGH RISK  |
| 91+   | 🔴 Red    | CRITICAL   |

---

## 🧠 Detection Logic

### Alert Scoring
- `LOW` alert   → +5 pts
- `MEDIUM` alert → +15 pts  
- `HIGH` alert  → +30 pts
- Decay: −2 pts/second of clean behavior
- Same alert type debounced for 2 seconds to prevent spam

### Thresholds
| Detector | Threshold | Severity |
|---|---|---|
| No face detected | immediate | HIGH |
| Face mismatch | immediate | HIGH |
| Multiple persons | immediate | HIGH |
| Gaze off-center | 3s sustained | LOW → MEDIUM at 5s |
| Head yaw > 30° | immediate | MEDIUM |
| Head pitch > 20° | immediate | MEDIUM |
| Tab switch 1–2 | immediate | MEDIUM |
| Tab switch 3+ | immediate | HIGH |
| Clipboard event | immediate | LOW |

---

## 🏗️ Architecture

```
┌─────────────┐   WebRTC    ┌──────────────────────────────────────────┐
│  Student    │ ──────────► │           FastAPI Backend                │
│  Browser   │             │                                          │
│  (React)    │   WS frames │  WebSocketHandler                        │
└─────────────┘ ──────────► │  ├── FaceDetector (face_recognition)    │
                             │  ├── EyeTracker   (MediaPipe FaceMesh)  │
┌─────────────┐             │  ├── HeadPose      (solvePnP)            │
│  Proctor    │◄─ WS alerts─│  ├── PersonCounter (YOLOv8n)            │
│  Dashboard  │             │  └── AlertEngine   (rolling score)       │
│  (React)    │             │                                          │
└─────────────┘             │  SQLite ─ Violations ─ Reports           │
                             │  ReportLab ─ PDF Generator               │
                             └──────────────────────────────────────────┘
```

---

## 📦 Environment Variables

```env
DATABASE_URL=sqlite:///./proctorAI.db
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your-secret-key-here
CORS_ORIGINS=http://localhost:5173
```

---

## 🛠️ Troubleshooting

**`face_recognition` install fails**  
→ Install cmake first: `brew install cmake` / `apt install cmake`  
→ Or skip it — the system falls back to OpenCV Haar cascades automatically.

**YOLOv8 first run is slow**  
→ `yolov8n.pt` (~6 MB) auto-downloads on first frame. Subsequent runs are instant.

**Webcam not working**  
→ Browser requires HTTPS for `getUserMedia` on non-localhost. Use localhost for dev.

**Redis connection refused**  
→ Redis is optional. The system works without it in development mode.

---

## 👥 Team

Built for **HACKHIVE-2k26 · AI/ML Track**

> ProctorAI — Because academic integrity shouldn't be optional.
