# CODE//ESCAPE: Code Noir 🕵️‍♂️💻

Welcome to the **CODE NOIR** event repository! This project is an interactive, browser-based, tech-themed escape room experience designed for hackathons, technical symposiums, and coding events.

Participants take on the role of cyber-detectives, solving a series of Python debugging challenges and SQL queries to hunt down suspects, decode intercepted messages, and ultimately break out of a compromised system.

---

## 🌟 Key Features

* **Dual-Round Gameplay:**
  * **Round 1 (Boot Sequence):** 5 stages of Python debugging + SQL investigation.
  * **Round 2 (System Breach):** 6 stages of Python cryptographic decoding + 1 final escape password.
* **Centralized Backend Persistence:** The authoritative application state now lives in a Node.js API and JSON database, so teams can be registered and validated across different browsers, devices, and networks.
* **Admin Control Center:** A glassmorphism dashboard for event organizers to:
  * View live statistics (active teams, completed stages, etc.).
  * Whitelist allowed teams.
  * Start and stop rounds dynamically.
  * Monitor team progress in real time.
  * Download the Official Answer Key PDF.
* **Dynamic PDF Answer Key Generation:** A standalone Node.js script automatically parses the puzzle database and generates a printable, formatted PDF Answer Key for organizers.

---

## 🚀 Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Start the backend

```bash
npm start
```

This starts the API at `http://localhost:3001` and serves the frontend files from the project root.

### 3. Open the app

Open `http://localhost:3001` in a browser.

### 4. Generating the Answer Key PDF

```bash
cd pdf-gen
npm install
node generate.js
```

This reads the live `puzzles.js` data and generates `CODE_NOIR_Official_Answer_Key.pdf` in the root directory.

---

## 🏗️ Production Architecture

```text
Frontend (HTML + CSS + JS)
        ↓
Backend API (Express.js)
        ↓
Central database (JSON file in /data)
```

The browser no longer acts as the single source of truth for team registration, round state, or progress. The backend enforces the authorized team list, room validation, round activation, and timer state.

---

## 🔐 Environment Variables

Create a `.env` file in the backend folder for local development:

```env
PORT=3001
CLIENT_URL=http://localhost:3000
API_URL=http://localhost:3001
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

For production, use your deployed values instead of `localhost`:

```env
PORT=10000
CLIENT_URL=https://your-frontend-domain
API_URL=https://escape-exe1-2.onrender.com
ALLOWED_ORIGINS=https://your-frontend-domain
```

The frontend is a static site. When it is served from the Render app itself, it should use the same origin and relative `/api/...` paths. In local development, it must use `http://localhost:3001`.

```html
<script>
  window.API_URL = 'http://localhost:3001';
</script>
<script src="backend.js"></script>
```

This is the correct setup for local development and Render hosting.

## ☁️ Deploying Frontend to Vercel

1. Open the Vercel dashboard and import this repository.
2. Set the project root to `frontend`.
3. Use the framework preset `Other` or static site.
4. Do not point the frontend at `localhost`.
5. Add this runtime config to the page before `backend.js` loads:

```html
<script>
  window.API_URL = 'https://escape-exe1-2.onrender.com';
</script>
```

The static frontend can then call the backend normally through the Render API URL, or use the same origin with relative `/api/...` calls.

## 🚀 Deploying Backend to Render

1. Create a new Web Service on Render.
2. Connect the repository.
3. Set the root directory to `backend`.
4. Use these settings:
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Add environment variables:

```env
PORT=10000
CLIENT_URL=https://your-frontend-domain
API_URL=https://escape-exe1-2.onrender.com
ALLOWED_ORIGINS=https://your-frontend-domain
```

6. Use the Render service URL as the backend for the Vercel frontend.
7. Keep the existing JSON DB in `backend/data/app-data.json` as the canonical data source.

> Note: Render's filesystem is ephemeral between deploys, so if you need durable data beyond redeploys, attach a persistent disk or migrate the JSON store to a proper database. The project is structured to keep the current JSON file in place and continue using it during normal service operation.

---

## 🎮 Event Flow & Routing

1. **Login (`index.html`):** Participants log in using their Team Name and the shared room code `NOIR26`.
2. **Round 1 (`round1.html`):** Teams debug Python scripts and solve SQL clues.
3. **Round 2 (`round2.html`):** Once organizers activate Round 2 from the Admin Dashboard, eligible teams who complete Round 1 can enter the final stage.

---

## 🛡️ Admin Guide

To access the Organizer Dashboard:
1. Navigate to `/admin.html`
2. **Default Login:** `admin` / `password`

**Admin Capabilities:**
* Create rooms and manage event state.
* Add approved teams.
* Start and stop Round 2.
* Reset round data or the full event state.
* Monitor live progress and download the official answer key.

---

## 🛠️ Modifying the Puzzles

All puzzles and answers are centralized in **`puzzles.js`**.
To change a puzzle, simply edit the `ROUND1_PUZZLES` or `ROUND2_STAGES` arrays.

> If you change the puzzles, regenerate the PDF Answer Key so your organizers have the correct answers.

---

## 🎨 Technology Stack
* **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES6)
* **Design:** Custom Glassmorphism UI, CSS Variables, SVG Icons
* **Backend:** Node.js + Express
* **Data Storage:** Centralized JSON-backed database in the backend
* **PDF Generation:** Node.js, PDFKit

---
*Developed for CODE//ESCAPE.*
