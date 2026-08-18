# VeriFact — AI Fake News & Forensic Deepfake Guardian

A state-of-the-art forensic AI platform for detecting AI-generated content, fake news, deepfake images/videos, cloned voices, forged documents, and deceptive URLs.

---

## 📂 Project Architecture

The codebase is strictly separated into **Frontend** and **Backend** directories for easy access, modular development, and clean deployment:

```
veri-truth-guardian/
├── 📁 frontend/                   # React 18 + Vite + TailwindCSS Frontend Application
│   ├── 📁 src/                    # UI Components, Contexts, Hooks, Pages & Logic
│   │   ├── 📁 components/         # Verification modules & floating UI controls
│   │   ├── 📁 contexts/           # Analysis & Auth State Providers
│   │   ├── 📁 hooks/              # Custom Hooks & Data Sync
│   │   ├── 📁 lib/                # Forensic signal extractors & PDF generators
│   │   └── 📁 pages/              # Main Dashboard, Index & Auth views
│   ├── 📁 public/                 # Static web assets & icons
│   ├── index.html                 # Main HTML Entry point
│   ├── package.json               # Frontend dependencies & scripts
│   ├── vite.config.ts             # Vite configuration
│   └── .env                       # Frontend environment variables
│
├── 📁 backend/                    # Express + MongoDB API Server & Supabase Edge Functions
│   ├── server.js                  # Express API Server (MongoDB Compass connection)
│   ├── package.json               # Backend Node.js dependencies
│   ├── .env                       # Database & API configuration
│   └── 📁 supabase/               # Multi-layer Forensic Edge Functions
│       ├── 📁 functions/          # AI Analysis APIs (verify-text, verify-image, etc.)
│       └── config.toml            # Supabase config
│
├── package.json                   # Master workspace runner scripts
└── README.md                      # Complete Project Documentation
```

---

## 🚀 Quick Start Guide

### 1. Run the Backend API Server (MongoDB)

Navigate to `backend` and start the server:

```bash
cd backend
npm install
npm start
```
*The backend API server will run on `http://localhost:5000` connected to your local MongoDB Compass database (`verifact`).*

### 2. Run the Frontend Web Application

In a separate terminal, navigate to `frontend` and start the dev server:

```bash
cd frontend
npm install
npm run dev
```
*Open `http://localhost:8080` or `http://localhost:5173` in your browser.*

---

## 🛠 Features & Verification Modules

1. 📄 **Text Fake-News Detection**: Real-time claim extraction & web evidence verification.
2. 🖼 **Image Deepfake Analysis**: FFT spectral radial spectrum, PRNU noise residual & EXIF signals.
3. 🎥 **Video Deepfake Check**: Temporal frame sampling, facial blink/expression analysis & lip-sync audit.
4. 🎙 **Audio Forensic Analysis**: Voice clone detection, spectral discontinuity check & speech synthesis scoring.
5. 📜 **Document Verification**: OCR text extraction, font consistency, PDF metadata & digital stamp verification.
6. 🌐 **URL Fact-Checking**: Domain WHOIS age, SSL certificate trust & Safe Browsing threat assessment.
