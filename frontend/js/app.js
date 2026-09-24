// ── Globals ───────────────────────────────────────────────────────────────────
let pyodide   = null;
let sqlDb     = null;
let pyEditor  = null;
let sqlEditor = null;

// ── State ─────────────────────────────────────────────────────────────────────
function getState() {
    try {
        return JSON.parse(localStorage.getItem('codenoir_v2') || JSON.stringify({
            round:    null,
            r1: { current: 0, solved: [] },
            r2: { current: 0, solved: [] }
        }));
    } catch { return { round: null, r1: { current: 0, solved: [] }, r2: { current: 0, solved: [] } }; }
}
function saveState(s) {
    try { localStorage.setItem('codenoir_v2', JSON.stringify(s)); } catch {}
}
function getRoomSession() {
    try {
        const data = localStorage.getItem('codenoir_room_session');
        return data ? JSON.parse(data) : null;
    } catch { return null; }
}
function saveRoomSession(s) {
    try { localStorage.setItem('codenoir_room_session', JSON.stringify(s)); } catch {}
}
function clearRoomSession() {
    try { localStorage.removeItem('codenoir_room_session'); } catch {}
}
function resetAll() {
    try { localStorage.removeItem('codenoir_v2'); clearRoomSession(); } catch {}
    location.reload();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function normalizeOutput(s) {
    return s.split('\n').map(l => l.trimEnd()).join('\n').trim();
}
function containsAnswer(results, answer) {
    if (!results || !results.length) return false;
    // Require exactly one row — prevents "SELECT name FROM suspects" (all rows) from passing
    const tbl = results[0];
    if (!tbl || tbl.values.length !== 1) return false;
    const t = answer.toLowerCase().trim();
    for (const cell of tbl.values[0])
        if (cell !== null && String(cell).toLowerCase().trim() === t) return true;
    return false;
}
function renderTable(results) {
    if (!results || !results.length) return '<p class="no-results">No results.</p>';
    const tbl = results[0];
    let h = '<table class="results-table"><thead><tr>';
    h += tbl.columns.map(c => `<th>${escHtml(c)}</th>`).join('');
    h += '</tr></thead><tbody>';
    for (const row of tbl.values)
        h += '<tr>' + row.map(v => `<td>${v !== null ? escHtml(String(v)) : '<span class="null">NULL</span>'}</td>`).join('') + '</tr>';
    return h + '</tbody></table>';
}
function setStatus(id, text, type) {
    const el = document.getElementById(id);
    el.textContent = text;
    el.className = 'status-badge' + (type ? ' ' + type : '');
}

// ── Monaco ────────────────────────────────────────────────────────────────────
function loadMonaco() {
    if (window.monaco) return Promise.resolve(window.monaco);
    if (window.__MONACO_LOADING__) return window.__MONACO_LOADING__;

    const monacoLoaderUrl = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs/loader.js';
    const loaderPromise = new Promise((resolve, reject) => {
        const bootstrap = () => {
            try {
                if (!window.require || !window.require.config) {
                    throw new Error('Monaco AMD loader is unavailable.');
                }

                window.require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs' } });
                window.require(['vs/editor/editor.main'], () => {
                    if (window.monaco) return resolve(window.monaco);
                    reject(new Error('Monaco failed to initialize.'));
                });
            } catch (error) {
                reject(error);
            }
        };

        const existingLoader = document.querySelector('script[data-monaco-loader="true"]');
        if (window.require && window.require.config) {
            bootstrap();
            return;
        }

        if (existingLoader) {
            existingLoader.addEventListener('load', bootstrap, { once: true });
            existingLoader.addEventListener('error', () => reject(new Error('Failed to load Monaco editor.')), { once: true });
            return;
        }

        const loader = document.createElement('script');
        loader.src = monacoLoaderUrl;
        loader.async = true;
        loader.setAttribute('data-monaco-loader', 'true');
        loader.addEventListener('load', bootstrap, { once: true });
        loader.addEventListener('error', () => reject(new Error('Failed to load Monaco editor.')), { once: true });
        document.head.appendChild(loader);
    });

    window.__MONACO_LOADING__ = loaderPromise;
    return loaderPromise;
}

// ── Pyodide stdout capture ────────────────────────────────────────────────────
async function runPython(code) {
    pyodide.runPython(`
import sys
from io import StringIO
_cn = StringIO()
sys.stdout = _cn
`);
    try { await pyodide.runPythonAsync(code); }
    catch (e) {
        try { pyodide.runPython('sys.stdout = sys.__stdout__'); } catch {}
        return { error: e.message };
    }
    const out = pyodide.runPython('_cn.getvalue()');
    try { pyodide.runPython('sys.stdout = sys.__stdout__'); } catch {}
    return { output: out };
}

// ── Screen routing ────────────────────────────────────────────────────────────
function showLanding() {
    // Landing only exists on index.html — round pages redirect back to it
    const page = window.__ROUND_PAGE;
    if (page) {
        // On round pages: if no session, redirect to login
        const session = getRoomSession();
        if (!session) {
            window.location.href = 'index.html';
            return;
        }
        return; // stay on round page
    }
    document.getElementById('landing-screen').style.display = 'flex';
    document.getElementById('game-screen').classList.remove('visible');

    const session = getRoomSession();
    if (session) {
        document.getElementById('join-card').style.display = 'none';
        document.getElementById('resume-card').style.display = 'block';
        document.getElementById('resume-team-val').textContent = session.teamName;
        document.getElementById('resume-room-val').textContent = session.roomCode;
    } else {
        document.getElementById('join-card').style.display = 'block';
        document.getElementById('resume-card').style.display = 'none';
    }
}

async function routeUser() {
    const page = window.__ROUND_PAGE; // 1, 2, or undefined (index.html)
    const session = getRoomSession();
    const s = getState();

    // ── On round1.html ────────────────────────────────────────────────────────
    if (page === 1) {
        if (!session) { window.location.href = 'index.html'; return; }
        document.getElementById('game-screen').classList.add('visible');
        await enterRound(1);
        return;
    }

    // ── On round2.html ────────────────────────────────────────────────────────
    if (page === 2) {
        if (!session) {
            showRound2Auth();
            return;
        }

        // Step 1: Check Round 2 activation from BACKEND — the only authoritative source.
        // Do NOT use localStorage here; it may be empty on a fresh tab or different device.
        const res = await window.BackendAPI.checkRoomStatus(session.roomId);
        if (!res || res.round2Status !== 'ACTIVE') {
            // R2 not opened by admin yet — show locked overlay and poll. Never redirect.
            const lockEl = document.getElementById('r2-locked-overlay');
            if (lockEl) lockEl.style.display = 'flex';
            const backBtn = document.getElementById('r2-back-btn');
            if (backBtn) backBtn.addEventListener('click', () => window.location.href = 'round1.html');
            if (window._r2LockPoller) clearInterval(window._r2LockPoller);
            window._r2LockPoller = setInterval(async () => {
                const status = await window.BackendAPI.checkRoomStatus(session.roomId);
                if (status && status.round2Status === 'ACTIVE') {
                    clearInterval(window._r2LockPoller);
                    if (lockEl) lockEl.style.display = 'none';
                    document.getElementById('game-screen').classList.add('visible');
                    await enterRound(2);
                }
            }, 3000);
            return;
        }

        // Step 2: Round 2 is ACTIVE. Check R1 completion from BACKEND team record,
        // not from localStorage which may be stale/missing on a different browser session.
        const teamDetails = await window.BackendAPI.getTeamDetails(session.teamId);
        const r1BackendComplete = teamDetails?.progress?.[1]?.stageStatus === 'COMPLETED';
        // Also accept if same-browser localStorage shows R1 fully solved (consistent UX)
        const r1LocalComplete  = s.r1.solved.length >= ROUND1_PUZZLES.length;
        if (!r1BackendComplete && !r1LocalComplete) {
            // R1 genuinely not done — show informational locked overlay. Do NOT redirect.
            const lockEl = document.getElementById('r2-locked-overlay');
            if (lockEl) {
                lockEl.style.display = 'flex';
                const h2 = lockEl.querySelector('h2');
                const p  = lockEl.querySelector('p');
                if (h2) h2.textContent = 'ROUND 1 NOT COMPLETE';
                if (p)  p.textContent  = 'You must complete all Round 1 stages before entering Round 2.';
            }
            return;
        }

        // All checks pass — load Round 2 game.
        document.getElementById('game-screen').classList.add('visible');
        await enterRound(2);
        return;
    }

    // ── On index.html (login page) ─────────────────────────────────────────────
    if (!session) {
        showLanding();
        return;
    }
    // Already logged in — redirect to correct round
    if (s.r1.solved.length < ROUND1_PUZZLES.length) {
        window.location.href = 'round1.html';
    } else {
        const res = await window.BackendAPI.checkRoomStatus(session.roomId);
        if (res && res.round2Status === 'ACTIVE') {
            window.location.href = 'round2.html';
        } else {
            window.location.href = 'round1.html';
        }
    }
}

function showR1CompleteLock() {
    document.getElementById('game-screen').classList.add('visible');
    setGameMode('python-sql');
    document.getElementById('r1-complete-overlay').style.display = 'flex';

    // Polling — when R2 becomes ACTIVE, navigate to round2.html
    if (window._r2Poller) clearInterval(window._r2Poller);
    window._r2Poller = setInterval(async () => {
        const session = getRoomSession();
        if (!session) return;
        const status = await window.BackendAPI.checkRoomStatus(session.roomId);
        if (status && status.round2Status === 'ACTIVE') {
            clearInterval(window._r2Poller);
            window.location.href = 'round2.html';
        }
    }, 3000);
}

function showRound2Auth() {
    const authOverlay = document.getElementById('round2-auth-overlay');
    const gameScreen = document.getElementById('game-screen');
    if (authOverlay) authOverlay.style.display = 'flex';
    if (gameScreen) gameScreen.style.display = 'none';
}

function hideRound2Auth() {
    const authOverlay = document.getElementById('round2-auth-overlay');
    const gameScreen = document.getElementById('game-screen');
    if (authOverlay) authOverlay.style.display = 'none';
    if (gameScreen) gameScreen.style.display = 'block';
}

// ── Landing Logic ─────────────────────────────────────────────────────────────

function handleJoinSubmit(e) {
    e.preventDefault();
    
    const teamInput = document.getElementById('team-name');
    const roomInput = document.getElementById('room-code');
    const teamName = teamInput.value.trim();
    const roomCode = roomInput.value.trim().toUpperCase();
    
    const teamGroup = teamInput.closest('.input-group');
    const roomGroup = roomInput.closest('.input-group');
    const globalError = document.getElementById('join-global-error');
    
    // Reset errors
    teamGroup.classList.remove('has-error');
    roomGroup.classList.remove('has-error');
    globalError.textContent = '';
    
    let valid = true;
    if (!teamName) {
        document.getElementById('team-name-error').textContent = 'Enter your Team Name';
        teamGroup.classList.add('has-error');
        valid = false;
    }
    if (!roomCode) {
        document.getElementById('room-error').textContent = 'Enter Room Code';
        roomGroup.classList.add('has-error');
        valid = false;
    }
    
    if (!valid) return;
    
    const btn = document.getElementById('join-btn');
    btn.disabled = true;
    btn.textContent = 'CONNECTING TO ROOM...';
    
    window.BackendAPI.participantLogin(teamName, roomCode)
        .then(res => {
            saveRoomSession({ teamName: res.teamName, teamId: res.teamId, roomId: res.roomId, roomCode, participantId: res.participantId, joinedAt: Date.now() });
            window.location.href = 'round1.html';
        })
        .catch(err => {
            globalError.textContent = err.message;
            btn.disabled = false;
            btn.textContent = 'TRY AGAIN';
        });
}

async function handleRound2JoinSubmit(e) {
    e.preventDefault();

    const teamInput = document.getElementById('r2-team-name');
    const roomInput = document.getElementById('r2-room-code');
    const teamName = teamInput.value.trim();
    const roomCode = roomInput.value.trim().toUpperCase();

    const teamGroup = teamInput.closest('.input-group');
    const roomGroup = roomInput.closest('.input-group');
    const globalError = document.getElementById('r2-global-error');

    teamGroup.classList.remove('has-error');
    roomGroup.classList.remove('has-error');
    globalError.textContent = '';

    let valid = true;
    if (!teamName) {
        document.getElementById('r2-team-name-error').textContent = 'Enter your Team Name';
        teamGroup.classList.add('has-error');
        valid = false;
    }
    if (!roomCode) {
        document.getElementById('r2-room-error').textContent = 'Enter Room Code';
        roomGroup.classList.add('has-error');
        valid = false;
    }

    if (!valid) return;

    const btn = document.getElementById('r2-join-btn');
    btn.disabled = true;
    btn.textContent = 'VERIFYING TEAM...';

    try {
        const res = await window.BackendAPI.participantLogin(teamName, roomCode);
        saveRoomSession({ teamName: res.teamName, teamId: res.teamId, roomId: res.roomId, roomCode, participantId: res.participantId, joinedAt: Date.now() });
        hideRound2Auth();
        await routeUser();
    } catch (err) {
        globalError.textContent = err.message || 'Unable to verify team.';
        btn.disabled = false;
        btn.textContent = 'ENTER ROUND 2';
    }
}

function handleResumeRoom() {
    const session = getRoomSession();
    if (!session) return;
    const s = getState();
    if (s.r1.solved.length < ROUND1_PUZZLES.length) {
        window.location.href = 'round1.html';
    } else {
        window.BackendAPI.checkRoomStatus(session.roomId).then(res => {
            if (res && res.round2Status === 'ACTIVE') {
                window.location.href = 'round2.html';
            } else {
                window.location.href = 'round1.html';
            }
        });
    }
}

function handleLeaveRoom() {
    const session = getRoomSession();
    if (session) {
        window.BackendAPI.leaveRoom(session.teamId);
    }
    clearRoomSession();
    showLanding();
}

// ── Timer Component ───────────────────────────────────────────────────────────
let timerInterval = null;
let currentRemainingSeconds = 0;

async function syncRoundTimer(round) {
    const session = getRoomSession();
    if (!session || !session.teamId) return;

    try {
        const res = await window.BackendAPI.getRoundSession(session.teamId, round);
        const timerBadge = document.getElementById('participant-timer-badge');
        const timerDisplay = document.getElementById('participant-timer-val');

        if (res.status === 'EXPIRED') {
            triggerTimeoutOverlay(round);
            return;
        }

        if (res.status === 'COMPLETED') {
            stopRoundTimer();
            if (timerDisplay) timerDisplay.textContent = 'ESCAPED ✓';
            if (timerBadge) timerBadge.className = 'timer-badge';
            return;
        }

        currentRemainingSeconds = Math.max(0, res.remainingSeconds || 0);
        updateTimerDisplayUI(currentRemainingSeconds);

        if (res.active && currentRemainingSeconds > 0) {
            startLocalTimerLoop(round);
        }
    } catch (e) {
        console.error('Failed to sync round timer:', e);
    }
}

function startLocalTimerLoop(round) {
    if (timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        if (currentRemainingSeconds <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            // Re-verify with backend to confirm authoritative expiration
            const session = getRoomSession();
            if (session) {
                window.BackendAPI.getRoundSession(session.teamId, round).then(res => {
                    if (res.status === 'EXPIRED' || res.remainingSeconds <= 0) {
                        triggerTimeoutOverlay(round);
                    }
                });
            }
            return;
        }
        currentRemainingSeconds--;
        updateTimerDisplayUI(currentRemainingSeconds);
    }, 1000);
}

function stopRoundTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function updateTimerDisplayUI(seconds) {
    const timerBadge = document.getElementById('participant-timer-badge');
    const timerDisplay = document.getElementById('participant-timer-val');
    if (!timerDisplay) return;

    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const formatted = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    
    timerDisplay.textContent = formatted;

    if (!timerBadge) return;
    if (seconds <= 60) {
        timerBadge.className = 'timer-badge urgent';
    } else if (seconds <= 900) { // 15 mins
        timerBadge.className = 'timer-badge warning';
    } else {
        timerBadge.className = 'timer-badge';
    }
}

function triggerTimeoutOverlay(round) {
    stopRoundTimer();
    const overlay = document.getElementById('timeout-overlay');
    const title = document.getElementById('timeout-round-title');
    const timerVal = document.getElementById('timeout-timer-val');

    if (title) title.textContent = `ROUND ${round} ENDED`;
    if (timerVal) timerVal.textContent = '00:00:00';

    // Lock editors and controls
    if (pyEditor) pyEditor.updateOptions({ readOnly: true });
    if (sqlEditor) sqlEditor.updateOptions({ readOnly: true });

    const pyBtn = document.getElementById('run-py-btn');
    const sqlBtn = document.getElementById('run-sql-btn');
    if (pyBtn) pyBtn.disabled = true;
    if (sqlBtn) sqlBtn.disabled = true;

    if (overlay) overlay.style.display = 'flex';
}

async function enterRound(r) {
    const s = getState();
    s.round = r;
    saveState(s);
    saveState(s);
    document.getElementById('game-screen').classList.add('visible');
    
    // Set Team Name in UI
    const session = getRoomSession();
    if (session) {
        document.getElementById('game-team-name-display').textContent = `[ ${session.teamName} ]`;
        
        // Start/Ensure round session in backend
        try {
            await window.BackendAPI.startRoundSession(session.teamId, r);
            await syncRoundTimer(r);
        } catch (err) {
            if (err.message && err.message.includes('SESSION_EXPIRED')) {
                triggerTimeoutOverlay(r);
                return;
            }
        }
    }

    // Force Monaco layout
    requestAnimationFrame(() => {
        if (pyEditor)  pyEditor.layout();
        if (sqlEditor) sqlEditor.layout();
        if (r === 1) loadR1Puzzle(s.r1.current);
        else          loadR2Stage(s.r2.current);
    });
}

// ── ROUND 1 ───────────────────────────────────────────────────────────────────
let r1PythonPassed = false;

function loadR1Puzzle(index) {
    r1PythonPassed = false;
    const puzzle  = ROUND1_PUZZLES[index];
    const s       = getState();

    // Notify backend stage entry
    const session = getRoomSession();
    if (session) {
        window.BackendAPI.updateStageEntry(session.teamId, 1, index + 1, 'python-sql', 7);
    }

    // Header
    setRoundHeader(1, index, ROUND1_PUZZLES.length, s.r1.solved);
    document.getElementById('puzzle-title').className = 'puzzle-title r1-title';
    document.getElementById('puzzle-title').textContent = puzzle.title;
    document.getElementById('story-text').textContent  = puzzle.story;

    // Set game area to python+sql mode
    setGameMode('python-sql');

    // Python panel
    pyEditor.setValue(puzzle.buggy_code);
    pyEditor.setScrollPosition({ scrollTop: 0 });
    document.getElementById('py-output').textContent = '';
    setStatus('py-status', '');
    document.getElementById('hint-box').style.display = 'none';

    // SQL panel
    document.getElementById('riddle-text').textContent = '';
    document.getElementById('sql-output').innerHTML    = '';
    setStatus('sql-status', '');
    document.getElementById('lock-overlay').style.display = 'flex';
    sqlEditor.setValue('-- Tables: suspects, locations, sightings, witnesses\n-- Write your query below:\n\n');

    // Boot panel
    const bootPanel = document.getElementById('boot-panel');
    bootPanel.classList.remove('visible');

    // Nav
    document.getElementById('prev-btn').disabled = index === 0;
    updateNextBtn(1, index, s.r1.solved);

    // Re-apply solved state if returning
    if (s.r1.solved.includes(index)) {
        r1ShowPythonSuccess(puzzle.expected_output, false);
        r1ShowSQLSuccess(puzzle.correct_answer, false);
    }
    // Show boot panel if all R1 solved
    if (s.r1.solved.length === ROUND1_PUZZLES.length) showBootPanel();
}

function r1ShowPythonSuccess(output, logAttempt = true) {
    r1PythonPassed = true;
    document.getElementById('py-output').textContent = output;
    setStatus('py-status', '✓ Correct', 'success');
    document.getElementById('lock-overlay').style.display = 'none';
    document.getElementById('riddle-text').textContent = ROUND1_PUZZLES[getState().r1.current].expected_output;
    
    // Notify backend of attempt/progress
    const session = getRoomSession();
    if (session && logAttempt) {
        window.BackendAPI.recordAttempt(session.teamId, 1, getState().r1.current + 1, true, 'Python Bug Fixed');
    }
}

function r1ShowSQLSuccess(answer, persist = true) {
    setStatus('sql-status', `✓ Found: ${answer}`, 'success');
    if (persist) {
        const s = getState();
        const idx = s.r1.current;
        const wasAlreadyComplete = s.r1.solved.length === ROUND1_PUZZLES.length;
        if (!s.r1.solved.includes(idx)) s.r1.solved.push(idx);
        saveState(s);
        updateDots(s.r1.solved, idx, ROUND1_PUZZLES.length, 'r1');
        updateNextBtn(1, idx, s.r1.solved);
        
        // Round 1 progress — scoped exclusively to R1 stages
        const totalSolved  = s.r1.solved.length;
        const percent      = Math.round((totalSolved / ROUND1_PUZZLES.length) * 100);
        const isCompleted  = s.r1.solved.length === ROUND1_PUZZLES.length;

        // Notify backend of stage completion (round=1 is explicit, not derived from stage index)
        const session = getRoomSession();
        if (session) {
            window.BackendAPI.recordAttempt(session.teamId, 1, idx + 1, true, `SQL Suspect Identified: ${answer}`);
            window.BackendAPI.updateParticipantProgress(
                session.teamId, 1, idx + 1, percent, totalSolved, '00:00', isCompleted, 'python-sql'
            );
        }

        if (s.r1.solved.length === ROUND1_PUZZLES.length) {
            showBootPanel();
            if (!wasAlreadyComplete) {
                setTimeout(showR1CompleteLock, 700);
            }
        }
    }
}

function showBootPanel() {
    document.getElementById('boot-panel').classList.add('visible');
}



async function handleR1Python() {
    if (!pyodide) return;
    const btn = document.getElementById('run-py-btn');
    btn.disabled = true; btn.textContent = 'Running…';
    const res = await runPython(pyEditor.getValue());
    btn.disabled = false; btn.textContent = 'Run Code ▶';

    const session = getRoomSession();

    if (res.error) {
        document.getElementById('py-output').textContent = res.error;
        setStatus('py-status', '✗ Error', 'error');
        if (session) window.BackendAPI.recordAttempt(session.teamId, 1, getState().r1.current + 1, false, 'Python Error');
        return;
    }
    document.getElementById('py-output').textContent = res.output;
    const puzzle = ROUND1_PUZZLES[getState().r1.current];
    if (normalizeOutput(res.output) === normalizeOutput(puzzle.expected_output)) {
        r1ShowPythonSuccess(res.output);
    } else {
        setStatus('py-status', '✗ Wrong output', 'error');
        if (session) window.BackendAPI.recordAttempt(session.teamId, 1, getState().r1.current + 1, false, 'Wrong Output');
    }
}

function handleR1SQL() {
    if (!sqlDb || !r1PythonPassed) return;
    const btn = document.getElementById('run-sql-btn');
    btn.disabled = true; btn.textContent = 'Running…';
    let results;
    const session = getRoomSession();
    try { results = sqlDb.exec(sqlEditor.getValue()); }
    catch (e) {
        document.getElementById('sql-output').innerHTML = `<p class="error-msg">${escHtml(e.message)}</p>`;
        setStatus('sql-status', '✗ SQL Error', 'error');
        btn.disabled = false; btn.textContent = 'Run Query ▶';
        if (session) window.BackendAPI.recordAttempt(session.teamId, 1, getState().r1.current + 1, false, 'SQL Syntax Error');
        return;
    }
    btn.disabled = false; btn.textContent = 'Run Query ▶';
    document.getElementById('sql-output').innerHTML = renderTable(results);
    const puzzle = ROUND1_PUZZLES[getState().r1.current];
    if (containsAnswer(results, puzzle.correct_answer)) {
        r1ShowSQLSuccess(puzzle.correct_answer);
    } else {
        setStatus('sql-status', '✗ Not found yet', 'error');
        if (session) window.BackendAPI.recordAttempt(session.teamId, 1, getState().r1.current + 1, false, 'SQL Result Incorrect');
    }
}

// ── ROUND 2 ───────────────────────────────────────────────────────────────────
let r2PyPassed = false;

function loadR2Stage(index) {
    r2PyPassed = false;
    const stage = ROUND2_STAGES[index];
    const s     = getState();

    // Notify backend stage entry
    const session = getRoomSession();
    if (session) {
        window.BackendAPI.updateStageEntry(session.teamId, 2, index + 1, stage.type || 'python', 7);
    }

    setRoundHeader(2, index, ROUND2_STAGES.length, s.r2.solved);
    document.getElementById('puzzle-title').className = 'puzzle-title r2-title';
    document.getElementById('puzzle-title').textContent = stage.title;
    document.getElementById('story-text').textContent  = stage.story;
    document.getElementById('hint-box').style.display = 'none';
    document.getElementById('boot-panel').classList.remove('visible');

    // Nav
    document.getElementById('prev-btn').disabled = index === 0;
    updateNextBtn(2, index, s.r2.solved);

    if (stage.type === 'python') {
        setGameMode('python-sql');
        document.getElementById('right-panel-title').textContent = '🔑 Fragment Collector';
        showNodeDisplay(false, stage.result_label, '');
        document.getElementById('lock-overlay').style.display = 'flex';
        pyEditor.setValue(stage.buggy_code);
        pyEditor.setScrollPosition({ scrollTop: 0 });
        document.getElementById('py-output').textContent = '';
        setStatus('py-status', '');
        setStatus('sql-status', '');

        if (s.r2.solved.includes(index)) {
            r2ShowPythonSuccess(stage.expected_output, stage.result_value, stage.result_label, false);
        }
    }
    else if (stage.type === 'sql') {
        setGameMode('sql');
        document.getElementById('clue-content').innerHTML =
            `<strong>STAGE 3 DIRECTIVE</strong>\n\n${stage.clue}`;
        document.getElementById('lock-overlay').style.display = 'none';
        document.getElementById('riddle-text').textContent = stage.clue;
        document.getElementById('sql-output').innerHTML    = '';
        setStatus('py-status', '');
        setStatus('sql-status', '');
        sqlEditor.setValue('-- Tables: suspects, locations, sightings, witnesses\n-- Use the SQL Directive from Stage 2:\n\n');
        if (s.r2.solved.includes(index)) {
            setStatus('sql-status', `✓ Found: ${stage.correct_answer}`, 'success');
        }
    }
    else if (stage.type === 'password') {
        setGameMode('password');
        document.getElementById('right-panel-title').textContent = '🔐 Cipher Entry';
        renderPasswordPanel(stage);
        if (s.r2.solved.includes(index)) {
            document.getElementById('code-status').textContent = '✓ ESCAPE CODE ACCEPTED';
            document.getElementById('code-status').className = 'success';
        }
    }
}

function r2ShowPythonSuccess(output, nodeValue, nodeLabel, persist = true) {
    r2PyPassed = true;
    document.getElementById('py-output').textContent = output;
    setStatus('py-status', '✓ Correct', 'success');
    document.getElementById('lock-overlay').style.display = 'none';
    showNodeDisplay(true, nodeLabel, nodeValue);
    if (persist) {
        const s = getState();
        const idx = s.r2.current;
        if (!s.r2.solved.includes(idx)) s.r2.solved.push(idx);
        saveState(s);
        updateDots(s.r2.solved, idx, ROUND2_STAGES.length, 'r2');
        updateNextBtn(2, idx, s.r2.solved);
        
        // Notify backend
        const session = getRoomSession();
        if (session) {
            // R2 progress: scoped to R2 stages only, never mixed with R1 count
            const totalSolved = s.r2.solved.length;
            const percent     = Math.round((totalSolved / ROUND2_STAGES.length) * 100);
            window.BackendAPI.recordAttempt(session.teamId, 2, idx + 1, true, `Fragment Recovered: ${nodeValue}`);
            window.BackendAPI.updateParticipantProgress(
                session.teamId, 2, idx + 1, percent, totalSolved, '00:00', false, 'python'
            );
        }
    }
}

function showNodeDisplay(show, label, value) {
    const nd = document.getElementById('node-display');
    const se = document.getElementById('sql-editor-wrap');
    if (!show) {
        nd.style.display  = 'none';
        se.style.display  = '';
        se.style.display  = 'none';
        nd.style.display  = 'none';
        return;
    }
    nd.style.display = 'flex';
    se.style.display = 'none';
    document.getElementById('node-label').textContent = label;
    document.getElementById('node-value').textContent = value;
}

async function handleR2Python() {
    if (!pyodide) return;
    const btn = document.getElementById('run-py-btn');
    btn.disabled = true; btn.textContent = 'Running…';
    const res = await runPython(pyEditor.getValue());
    btn.disabled = false; btn.textContent = 'Run Code ▶';
    const session = getRoomSession();

    if (res.error) {
        document.getElementById('py-output').textContent = res.error;
        setStatus('py-status', '✗ Error', 'error');
        if (session) window.BackendAPI.recordAttempt(session.teamId, 2, getState().r2.current + 1, false, 'R2 Python Error');
        return;
    }
    document.getElementById('py-output').textContent = res.output;
    const s     = getState();
    const stage = ROUND2_STAGES[s.r2.current];
    if (normalizeOutput(res.output) === normalizeOutput(stage.expected_output)) {
        r2ShowPythonSuccess(res.output, stage.result_value, stage.result_label);
    } else {
        setStatus('py-status', '✗ Wrong output', 'error');
        if (session) window.BackendAPI.recordAttempt(session.teamId, 2, s.r2.current + 1, false, 'R2 Wrong Output');
    }
}

function handleR2SQL() {
    if (!sqlDb) return;
    const btn = document.getElementById('run-sql-btn');
    btn.disabled = true; btn.textContent = 'Running…';
    let results;
    const session = getRoomSession();
    try { results = sqlDb.exec(sqlEditor.getValue()); }
    catch (e) {
        document.getElementById('sql-output').innerHTML = `<p class="error-msg">${escHtml(e.message)}</p>`;
        setStatus('sql-status', '✗ SQL Error', 'error');
        btn.disabled = false; btn.textContent = 'Run Query ▶';
        if (session) window.BackendAPI.recordAttempt(session.teamId, 2, getState().r2.current + 1, false, 'R2 SQL Syntax Error');
        return;
    }
    btn.disabled = false; btn.textContent = 'Run Query ▶';
    document.getElementById('sql-output').innerHTML = renderTable(results);
    const stage = ROUND2_STAGES[getState().r2.current];
    if (containsAnswer(results, stage.correct_answer)) {
        setStatus('sql-status', `✓ Found: ${stage.correct_answer}`, 'success');
        const s = getState();
        if (!s.r2.solved.includes(s.r2.current)) s.r2.solved.push(s.r2.current);
        saveState(s);
        updateDots(s.r2.solved, s.r2.current, ROUND2_STAGES.length, 'r2');
        updateNextBtn(2, s.r2.current, s.r2.solved);
        
        // Notify backend
        if (session) {
            // R2 progress: scoped to R2 stages only
            const totalSolved = s.r2.solved.length;
            const percent     = Math.round((totalSolved / ROUND2_STAGES.length) * 100);
            window.BackendAPI.recordAttempt(session.teamId, 2, s.r2.current + 1, true, `SQL Answer Found: ${stage.correct_answer}`);
            window.BackendAPI.updateParticipantProgress(
                session.teamId, 2, s.r2.current + 1, percent, totalSolved, '00:00', false, 'sql'
            );
        }
    } else {
        setStatus('sql-status', '✗ Not found yet', 'error');
        if (session) window.BackendAPI.recordAttempt(session.teamId, 2, getState().r2.current + 1, false, 'R2 SQL Result Incorrect');
    }
}

function handleEscapeCode() {
    const input = document.getElementById('escape-input').value.trim().toUpperCase();
    const stage = ROUND2_STAGES[getState().r2.current];
    const el    = document.getElementById('code-status');
    const session = getRoomSession();
    if (input === stage.escape_code.toUpperCase()) {
        el.textContent = '✓ ESCAPE CODE ACCEPTED — SYSTEM BREACHED';
        el.className   = 'success';
        const s = getState();
        if (!s.r2.solved.includes(s.r2.current)) s.r2.solved.push(s.r2.current);
        saveState(s);
        updateDots(s.r2.solved, s.r2.current, ROUND2_STAGES.length, 'r2');
        
        // Notify backend game finished
        if (session) {
            window.BackendAPI.recordAttempt(session.teamId, 2, s.r2.current + 1, true, 'Escape Code Accepted — System Breached');
            window.BackendAPI.updateParticipantProgress(
                session.teamId, 2, s.r2.current + 1, 100, 7, '00:00', true, 'password'
            );
        }
        
        setTimeout(() => {
            document.getElementById('win-overlay').style.display = 'flex';
        }, 600);
    } else {
        el.textContent = '✗ Incorrect code. Keep trying.';
        el.className   = 'error';
        if (session) window.BackendAPI.recordAttempt(session.teamId, 2, getState().r2.current + 1, false, 'Incorrect Escape Code');
    }
}

function renderPasswordPanel(stage) {
    const frags = stage.fragments.map(f =>
        `<div class="fragment-row">
           <span class="fragment-key">${escHtml(f.label)}</span>
           <span class="fragment-val">${escHtml(f.value)}</span>
         </div>`
    ).join('');
    document.getElementById('password-panel').innerHTML = `
      <div class="fragment-list">${frags}</div>
      <div class="escape-form">
        <div class="escape-label">Enter ESCAPE CODE</div>
        <div class="escape-input-row">
          <input type="text" id="escape-input" placeholder="???????????" autocomplete="off" spellcheck="false">
          <button class="btn btn-blue" id="submit-code-btn">SUBMIT</button>
        </div>
        <div id="code-status"></div>
      </div>`;
    document.getElementById('submit-code-btn').addEventListener('click', handleEscapeCode);
    document.getElementById('escape-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') handleEscapeCode();
    });
}

// ── Layout mode switching ─────────────────────────────────────────────────────
function setGameMode(mode) {
    const ga = document.querySelector('.game-area');
    ga.className = 'game-area';

    const pyWrap   = document.getElementById('py-editor-wrap');
    const clueWrap = document.getElementById('clue-wrap');
    const sqlWrap  = document.getElementById('sql-editor-wrap');
    const nodeDisp = document.getElementById('node-display');
    const pasPanel = document.getElementById('password-panel');
    const ridBox   = document.getElementById('riddle-box');

    // Reset all
    pyWrap.style.display    = '';
    clueWrap.style.display  = 'none';
    sqlWrap.style.display   = '';
    nodeDisp.style.display  = 'none';
    pasPanel.style.display  = 'none';
    ridBox.style.display    = '';

    if (mode === 'python-sql') {
        // Standard Code Noir layout — nothing extra
    } else if (mode === 'sql') {
        // R2 Stage 3: left = clue text, right = SQL editor
        pyWrap.style.display   = 'none';
        clueWrap.style.display = 'flex';
        ridBox.style.display   = '';
    } else if (mode === 'password') {
        // R2 Stage 4: single column password form
        ga.classList.add('password-mode');
        pyWrap.style.display   = 'none';
        sqlWrap.style.display  = 'none';
        nodeDisp.style.display = 'none';
        pasPanel.style.display = 'flex';
        ridBox.style.display   = 'none';
    }
}

// ── Progress dots & nav ───────────────────────────────────────────────────────
function setRoundHeader(round, current, total, solved) {
    const badge = document.getElementById('round-badge');
    badge.textContent = round === 1 ? 'ROUND 1 — BOOT SEQUENCE' : 'ROUND 2 — SYSTEM BREACH';
    badge.className   = 'round-badge ' + (round === 1 ? 'r1' : 'r2');
    document.getElementById('case-num').textContent = `Stage ${current + 1} / ${total}`;
    updateDots(solved, current, total, round === 1 ? 'r1' : 'r2');
}

function updateDots(solved, current, total, cls) {
    const c = document.getElementById('progress-dots');
    c.innerHTML = Array.from({ length: total }, (_, i) => {
        let d = 'dot';
        if (solved.includes(i)) d += ' solved';
        else if (i === current) d += ' active ' + cls;
        return `<span class="${d}" onclick="dotClick(${i})"></span>`;
    }).join('');
}

function dotClick(i) {
    const s = getState();
    if (s.round === 1 && i <= s.r1.solved.length) {
        s.r1.current = i; saveState(s); loadR1Puzzle(i);
    } else if (s.round === 2 && i <= s.r2.solved.length) {
        s.r2.current = i; saveState(s); loadR2Stage(i);
    }
}

function updateNextBtn(round, current, solved) {
    const btn     = document.getElementById('next-btn');
    const total   = round === 1 ? ROUND1_PUZZLES.length : ROUND2_STAGES.length;
    btn.disabled  = current >= total - 1 || !solved.includes(current);
    btn.textContent = current >= total - 1 ? (round === 1 ? '✓ Round 1 Complete' : '🏁 Breach Complete') : 'Next →';
}

// ── Run button dispatch (reads current round) ─────────────────────────────────
function handleRunPy() {
    const s = getState();
    if (s.round === 1) handleR1Python();
    else               handleR2Python();
}

function handleRunSQL() {
    const s = getState();
    if (s.round === 1) handleR1SQL();
    else               handleR2SQL();
}

function handlePrev() {
    const s = getState();
    if (s.round === 1 && s.r1.current > 0) { s.r1.current--; saveState(s); loadR1Puzzle(s.r1.current); }
    if (s.round === 2 && s.r2.current > 0) { s.r2.current--; saveState(s); loadR2Stage(s.r2.current); }
}

function handleNext() {
    const s     = getState();
    const total = s.round === 1 ? ROUND1_PUZZLES.length : ROUND2_STAGES.length;
    const cur   = s.round === 1 ? s.r1.current : s.r2.current;
    const solved = s.round === 1 ? s.r1.solved : s.r2.solved;
    if (cur < total - 1 && solved.includes(cur)) {
        if (s.round === 1) { s.r1.current++; saveState(s); loadR1Puzzle(s.r1.current); }
        else               { s.r2.current++; saveState(s); loadR2Stage(s.r2.current); }
    }
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
    const loadMsg = document.getElementById('load-msg');
    loadMsg.textContent = 'Loading Python runtime (may take ~30s)…';

    try {
        const [pyInst, , dbInst] = await Promise.all([
            loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.3/full/' }),
            loadMonaco(),
            initDB()
        ]);
        pyodide = pyInst;
        sqlDb   = dbInst;
    } catch (e) {
        loadMsg.textContent = '⚠ Load error: ' + e.message;
        return;
    }

    const editorOpts = {
        theme: 'vs-dark', automaticLayout: true,
        minimap: { enabled: false }, fontSize: 13,
        lineNumbers: 'on', scrollBeyondLastLine: false, padding: { top: 10 }
    };
    pyEditor  = monaco.editor.create(document.getElementById('py-editor'),  { ...editorOpts, language: 'python', value: '' });
    sqlEditor = monaco.editor.create(document.getElementById('sql-editor'), { ...editorOpts, language: 'sql',    value: '' });

    document.getElementById('schema-box').textContent = DB_SCHEMA;

    // Wire buttons (only if they exist on this page)
    document.getElementById('run-py-btn') ?.addEventListener('click', handleRunPy);
    document.getElementById('run-sql-btn')?.addEventListener('click', handleRunSQL);
    document.getElementById('prev-btn')   ?.addEventListener('click', handlePrev);
    document.getElementById('next-btn')   ?.addEventListener('click', handleNext);
    document.getElementById('reset-btn')  ?.addEventListener('click', () => { if (confirm('Reset all progress?')) resetAll(); });
    document.getElementById('schema-btn') ?.addEventListener('click', () => {
        const el = document.getElementById('schema-box');
        el.style.display = el.style.display === 'none' ? 'block' : 'none';
    });
    const homeBtn = document.getElementById('home-btn');
    if (homeBtn) homeBtn.addEventListener('click', routeUser);
    document.getElementById('close-win')  ?.addEventListener('click', () => { document.getElementById('win-overlay').style.display = 'none'; });
    document.getElementById('close-boot') ?.addEventListener('click', () => { document.getElementById('boot-panel').classList.remove('visible'); });

    // Landing buttons (index.html only)
    document.getElementById('join-form')       ?.addEventListener('submit', handleJoinSubmit);
    document.getElementById('resume-btn')      ?.addEventListener('click', handleResumeRoom);
    document.getElementById('leave-room-btn')  ?.addEventListener('click', handleLeaveRoom);
    document.getElementById('round2-join-form')?.addEventListener('submit', handleRound2JoinSubmit);
    document.getElementById('timeout-home-btn')?.addEventListener('click', () => {
        document.getElementById('timeout-overlay').style.display = 'none';
        window.location.href = 'index.html';
    });

    // Show app
    document.getElementById('load-overlay').style.display = 'none';
    document.getElementById('app')?.classList.add('visible');

    routeUser();
}

window.addEventListener('load', init);
