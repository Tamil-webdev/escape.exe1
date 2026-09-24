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

Create a `.env` file in the project root using the example below:

```env
PORT=3001
CLIENT_URL=http://localhost:3000
API_URL=http://localhost:3001
```

The same pattern is used in production, but the deployed frontend must point to the deployed backend URL instead of `localhost`.

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
