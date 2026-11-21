# Strategic Alpha Stock Picker Dashboard — Build & Run Documentation

**Workspace Directory:** `C:\Users\moder\AntiGravity\StockPickerStrategies-Krishna-ST-20260906`  
**Execution Environment:** Windows PowerShell / CMD (Local Development Mode)  
**Date:** September 6, 2026  

---

## 📋 Overview

This document provides a complete technical record of setting up, building, and running the **Strategic Alpha Stock Picker Dashboard** in **Local Mode** (without Docker containers). It details step-by-step procedures for both the **Python FastAPI Backend** and **Next.js 16 Frontend**, along with all encountered issues, diagnostic steps, and resolutions.

---

## 🛠️ Step-by-Step Setup & Build Process

### 1. Backend Setup (FastAPI)

1. **Navigate to Backend Directory:**
   ```powershell
   cd C:\Users\moder\AntiGravity\StockPickerStrategies-Krishna-ST-20260906\backend
   ```

2. **Create Python Virtual Environment (`.venv`):**
   ```powershell
   python -m venv .venv
   ```

3. **Install Backend Dependencies:**
   ```powershell
   .\.venv\Scripts\python.exe -m pip install -r requirements.txt
   ```
   *Installed key libraries: `fastapi`, `uvicorn`, `yfinance`, `xgboost`, `scikit-learn`, `pandas`, `pydantic`, `ib_insync`, `curl_cffi`.*

4. **Launch Backend Service:**
   ```powershell
   .\.venv\Scripts\python.exe -m uvicorn main:app --host localhost --port 8080
   ```

---

### 2. Frontend Setup (Next.js 16 Turbopack)

1. **Navigate to Frontend Directory:**
   ```powershell
   cd C:\Users\moder\AntiGravity\StockPickerStrategies-Krishna-ST-20260906\frontend
   ```

2. **Install Node Modules:**
   ```powershell
   npm install --legacy-peer-deps
   ```

3. **Launch Frontend Dev Server:**
   ```cmd
   cmd /c "npm run dev"
   ```
   *Runs Next.js 16.1.6 (Turbopack) on `http://localhost:3000`.*

---

## 🚨 Issues Found & Resolutions

### Issue 1: Port 8080 Address Conflict (`Errno 10048`)

- **Symptom:**
  When attempting to start the FastAPI backend server on port 8080, uvicorn threw an error:
  ```text
  ERROR: [Errno 10048] error while attempting to bind on address ('127.0.0.1', 8080): 
  only one usage of each socket address (protocol/network address/port) is normally permitted
  ```
- **Root Cause:**
  A previously running backend process was actively occupying port 8080.
- **Resolution:**
  Identified and forcefully terminated the process bound to port 8080 using PowerShell:
  ```powershell
  Get-Process -Id (Get-NetTCPConnection -LocalPort 8080).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force
  ```
  After freeing port 8080, `uvicorn` started cleanly and initialized the 24x7 Autonomous Trading Pipeline Scheduler daemon.

---

### Issue 2: Missing 'next' Executable / Corrupted `node_modules`

- **Symptom:**
  Running `npm run dev` in `frontend/` returned the error:
  ```text
  'next' is not recognized as an internal or external command, operable program or batch file.
  ```
- **Root Cause:**
  Initial non-interactive `npm install` in Windows subshell created an incomplete `node_modules` tree where `node_modules/next` only contained nested metadata subdirectories without the binary CLI tools (`node_modules/.bin/next.cmd`).
- **Resolution:**
  1. Cleaned the incomplete `node_modules` directory:
     ```powershell
     Remove-Item -Recurse -Force node_modules
     ```
  2. Mirrored the complete, pre-built package dependencies using multithreaded `robocopy` from the verified workspace template `StockPickerStrategies-Krishna-ST - 20260816\frontend\node_modules`:
     ```cmd
     robocopy "C:\Users\moder\AntiGravity\StockPickerStrategies-Krishna-ST - 20260816\frontend\node_modules" "C:\Users\moder\AntiGravity\StockPickerStrategies-Krishna-ST-20260906\frontend\node_modules" /E /MT:8 /NFL /NDL /NJH /NJS
     ```
  3. Verified `node_modules\next\dist\bin\next` binary path:
     ```powershell
     Test-Path node_modules\next\dist\bin\next  # Returned True
     ```

---

### Issue 3: Subshell Stdin Closure in Dev Server

- **Symptom:**
  Next.js dev server launched via temporary subprocess terminated with exit code 1 after initial compilation when stdout/stdin pipes closed.
- **Root Cause:**
  Turbopack interactive CLI requires standard process lifecycle scoping when run as a background task.
- **Resolution:**
  Launched Next.js via standard persistent CMD wrapper (`cmd /c "npm run dev"`), allowing Next.js 16.1.6 to serve requests cleanly on port 3000.

---

## ✅ System Verification & Status

| Service | Port | Endpoint / URL | Verification Result |
| :--- | :---: | :--- | :--- |
| **Backend (FastAPI)** | `8080` | `http://localhost:8080/health` | **`{"status":"ok"}`** |
| **Frontend (Next.js)** | `3000` | `http://localhost:3000` | **Active & Compiled (HTTP 200 OK)** |

---

## 📌 Maintenance Commands

- **Check Active Services:**
  ```powershell
  Test-NetConnection -ComputerName localhost -Port 8080
  Test-NetConnection -ComputerName localhost -Port 3000
  ```
- **Restart Backend:**
  ```powershell
  C:\Users\moder\AntiGravity\StockPickerStrategies-Krishna-ST-20260906\backend\.venv\Scripts\python.exe -m uvicorn main:app --host localhost --port 8080
  ```
- **Restart Frontend:**
  ```cmd
  cd C:\Users\moder\AntiGravity\StockPickerStrategies-Krishna-ST-20260906\frontend && cmd /c "npm run dev"
  ```
