# CODE//ESCAPE: Code Noir 🕵️‍♂️💻

Welcome to the **CODE NOIR** event repository! This project is an interactive, browser-based, tech-themed escape room experience designed for hackathons, technical symposiums, and coding events.

Participants take on the role of cyber-detectives, solving a series of Python debugging challenges and SQL queries to hunt down suspects, decode intercepted messages, and ultimately break out of a compromised system.

---

## 🌟 Key Features

* **Dual-Round Gameplay:**
  * **Round 1 (Boot Sequence):** 5 stages of Python debugging + SQL investigation.
  * **Round 2 (System Breach):** 6 stages of Python cryptographic decoding + 1 final escape password.
* **Serverless Real-Time Backend:** Built entirely on Client-Side technologies (`localStorage` and `BroadcastChannel` API). This allows the game to sync state seamlessly across tabs without needing a dedicated backend database.
* **Admin Control Center:** A beautiful, glassmorphism-styled dashboard for event organizers to:
  * View live statistics (active teams, completed stages, etc.).
  * Whitelist allowed teams.
  * Start and stop rounds dynamically.
  * Monitor individual team progress in real-time.
  * Download the Official Answer Key PDF.
* **Dynamic PDF Answer Key Generation:** A standalone Node.js script automatically parses the puzzle database and generates a printable, formatted PDF Answer Key for organizers.

---

## 🚀 Setup & Installation

You don't need a heavy backend to run this event. It runs completely locally or on any static hosting provider (like GitHub Pages, Vercel, or Netlify).

### ⚡ One-Click Deployment
Since this is a fully static site, you can deploy it instantly for free:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FTamil-webdev%2FEscape.exe)  
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/Tamil-webdev/Escape.exe)

### 1. Running the Game Locally
Since the game uses modern browser APIs like ES Modules and `BroadcastChannel`, it must be served over a local web server (not just by double-clicking the HTML file).

```bash
# Using npx (Node.js)
npx serve . 

# OR using Python 3
python -m http.server 3000
```
Then, open `http://localhost:3000` in your browser.

### 2. Generating the Answer Key PDF
If you modify the puzzles and need to regenerate the Official Answer Key for your organizers:

```bash
# Navigate to the generator folder
cd pdf-gen

# Install dependencies (only required once)
npm install

# Generate the PDF
node generate.js
```
This will read the live `puzzles.js` data and generate `CODE_NOIR_Official_Answer_Key.pdf` in the root directory.

---

## 🎮 Event Flow & Routing

1. **Login (`index.html`):** Participants log in using their Team Name and an Access Code provided by the organizers.
2. **Round 1 (`round1.html`):** Teams debug Python scripts to uncover clues, which they then use to write SQL queries to find suspects.
3. **Round 2 (`round2.html`):** Once organizers activate Round 2 from the Admin Dashboard, eligible teams who have completed Round 1 are granted access. Teams debug cryptographic ciphers to retrieve key fragments and assemble a final escape password.

---

## 🛡️ Admin Guide

To access the Organizer Dashboard:
1. Navigate to `/admin.html`
2. **Default Login:** `admin` / `password` *(Note: Change this in `admin.js` for production).*

**Admin Capabilities:**
* **Create Rooms:** Generate access codes for participants.
* **Start Round 2:** The Round 2 URL is locked by default. Clicking "Start Round 2" sends a live broadcast signal to all eligible participant screens, unlocking the final stages.
* **Reset Data:** Clear the local database to restart the event for a new batch of participants.

---

## 🛠️ Modifying the Puzzles

All puzzles and answers are centralized in **`puzzles.js`**. 
To change a puzzle, simply edit the `ROUND1_PUZZLES` or `ROUND2_STAGES` arrays. 

> **Important:** If you change the puzzles, remember to regenerate the PDF Answer Key using the instructions above so your organizers have the correct answers!

---

## 🎨 Technology Stack
* **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES6)
* **Design:** Custom Glassmorphism UI, CSS Variables, SVG Icons
* **Data Storage:** `localStorage` (Simulated Database)
* **Real-time Sync:** `BroadcastChannel` API
* **PDF Generation:** Node.js, PDFKit

---
*Developed for CODE//ESCAPE.*
