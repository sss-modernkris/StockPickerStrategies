# Strategic Alpha Stock Picker Dashboard — Build & Run Documentation

**Workspace Directory:** `C:\Users\moder\AntiGravity\StockPickerStrategies-Krishna-ST - 20260927`  
**Execution Environment:** Windows PowerShell / CMD (Local Development Mode)  
**Date:** September 27, 2026  

---

## 📋 Overview

This document provides a complete technical record of setting up, building, and running the **Strategic Alpha Stock Picker Dashboard** in **Local Mode** (without Docker containers). It details step-by-step procedures for both the **Python FastAPI Backend** and **Next.js 16 Frontend**, along with all encountered issues, diagnostic steps, and resolutions.

---

## 🛠️ Step-by-Step Setup & Build Process

### 1. Backend Setup (FastAPI)

1. **Navigate to Backend Directory:**
   ```powershell
   cd "C:\Users\moder\AntiGravity\StockPickerStrategies-Krishna-ST - 20260927\backend"
   ```

2. **Launch Backend Service:**
   ```powershell
   python -m uvicorn main:app --host 127.0.0.1 --port 8080
   ```
   *Runs FastAPI on `http://127.0.0.1:8080`.*

---

### 2. Frontend Setup (Next.js 16 Webpack Mode)

1. **Navigate to Frontend Directory:**
   ```powershell
   cd "C:\Users\moder\AntiGravity\StockPickerStrategies-Krishna-ST - 20260927\frontend"
   ```

2. **Directory Junction for Node Modules:**
   ```cmd
   cmd /c mklink /J "node_modules" "C:\Users\moder\AntiGravity\StockPickerStrategies-Krishna-ST-20260906\frontend\node_modules"
   ```

3. **Launch Frontend Dev Server:**
   ```powershell
   npx next dev -H 127.0.0.1 -p 3000 --webpack
   ```
   *Runs Next.js 16.1.6 on `http://127.0.0.1:3000`.*

---

## 🚨 Issues Found & Resolutions

### Issue 1: Turbopack Symlink/Junction Root Boundary Panic (`Turbopack Error: Symlink node_modules is invalid`)

- **Symptom:**
  When `node_modules` was linked via Windows directory junction (`mklink /J`), Next.js 16 Turbopack default bundler threw a panic:
  ```text
  FATAL: An unexpected Turbopack error occurred.
  Turbopack Error: Symlink node_modules is invalid, it points out of the filesystem root
  ```
- **Root Cause:**
  Next.js 16 Turbopack bundler enforces strict filesystem root boundaries and rejects symlinks / directory junctions that point outside the project workspace root.
- **Resolution:**
  Switched Next.js development mode from Turbopack to Webpack using the `--webpack` flag:
  ```powershell
  npx next dev -H 127.0.0.1 -p 3000 --webpack
  ```
  Webpack resolves directory junctions cleanly and compiles the app in 3.7 seconds.

---

### Issue 2: Backend FastAPI Route `404 Not Found` on Dynamic Code Updates

- **Symptom:**
  Frontend API calls to newly added endpoints (such as POST `/api/save-raw-tech-option`) returned `404 Not Found`.
- **Root Cause:**
  FastAPI backend server was running in non-reload background mode (`uvicorn main:app --host 127.0.0.1 --port 8080` without `--reload`), so code additions made to `main.py` were not loaded into the active process memory.
- **Resolution:**
  Identified and terminated the stale uvicorn process, then launched a fresh background server:
  ```powershell
  python -m uvicorn main:app --host 127.0.0.1 --port 8080
  ```
  Endpoint `/api/save-raw-tech-option` responded with `200 OK` and saved JSON files directly into the project directory.

---

### Issue 3: `localhost` IPv6 vs IPv4 Bind Conflict (`WinError 10061 ConnectionRefusedError`)

- **Symptom:**
  HTTP requests to `http://localhost:3000` failed with `WinError 10061 ConnectionRefusedError: No connection could be made because the target machine actively refused it`.
- **Root Cause:**
  Windows DNS resolved `localhost` to IPv6 loopback (`::1`), while Next.js default listener bound exclusively to IPv4 (`127.0.0.1`).
- **Resolution:**
  Explicitly bound Next.js server to IPv4 host `127.0.0.1`:
  ```powershell
  npx next dev -H 127.0.0.1 -p 3000 --webpack
  ```

---

### Issue 4: Port 8080 Address Conflict (`Errno 10048`)

- **Symptom:**
  Starting backend server on port 8080 threw socket bind error:
  ```text
  ERROR: [Errno 10048] error while attempting to bind on address ('127.0.0.1', 8080)
  ```
- **Root Cause:**
  A background python uvicorn process was occupying port 8080.
- **Resolution:**
  Terminated running process bound to port 8080 before starting the updated backend server.

---

## ✅ System Verification & Status

| Service | Port | Host / Endpoint | Status | Verification Result |
| :--- | :---: | :--- | :---: | :--- |
| **Backend (FastAPI)** | `8080` | `http://127.0.0.1:8080/health` | 🟢 Active | **`{"status":"ok"}` (HTTP 200)** |
| **Frontend (Next.js)** | `3000` | `http://127.0.0.1:3000` | 🟢 Active | **Compiled & Ready in 3.7s (HTTP 200)** |

---

## 📌 Local Mode Execution Commands

- **Start Backend:**
  ```powershell
  cd "C:\Users\moder\AntiGravity\StockPickerStrategies-Krishna-ST - 20260927\backend"
  python -m uvicorn main:app --host 127.0.0.1 --port 8080
  ```
- **Start Frontend:**
  ```powershell
  cd "C:\Users\moder\AntiGravity\StockPickerStrategies-Krishna-ST - 20260927\frontend"
  npx next dev -H 127.0.0.1 -p 3000 --webpack
  ```

