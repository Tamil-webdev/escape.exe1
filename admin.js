/**
 * admin.js - Code Noir / CODE//ESCAPE Admin Control Center Logic
 */

let refreshInterval = null;
let currentEventData = null;
let currentAdminRound = 1;

document.addEventListener('DOMContentLoaded', () => {
    
    // Auth Check
    if (sessionStorage.getItem('admin_token')) {
        showDashboard();
    }

    // Tab Listeners
    const tab1 = document.getElementById('tab-round-1');
    const tab2 = document.getElementById('tab-round-2');
    const btnStartR2 = document.getElementById('btn-start-round-2');
    const btnResetR1 = document.getElementById('btn-reset-round-1');
    const btnResetR2 = document.getElementById('btn-reset-round-2');

    if (tab1) {
        tab1.addEventListener('click', () => {
            currentAdminRound = 1;
            tab1.className = 'btn btn-primary';
            tab2.className = 'btn btn-outline';
            btnStartR2.style.display = 'none';
            btnResetR1.style.display = 'inline-block';
            btnResetR2.style.display = 'none';
            refreshDashboardData();
        });
    }

    if (tab2) {
        tab2.addEventListener('click', () => {
            currentAdminRound = 2;
            tab1.className = 'btn btn-outline';
            tab2.className = 'btn btn-primary';
            btnResetR1.style.display = 'none';
            btnResetR2.style.display = 'inline-block';
            refreshDashboardData();
        });
    }

    if (btnStartR2) {
        btnStartR2.addEventListener('click', async () => {
            if (confirm("Start Round 2 for all teams?")) {
                await window.BackendAPI.startRound2('R_DEFAULT');
                refreshDashboardData();
            }
        });
    }

    // Reset Round Modals
    document.getElementById('btn-reset-round-1')?.addEventListener('click', () => {
        document.getElementById('modal-reset-round-1').style.display = 'flex';
    });
    document.getElementById('btn-reset-round-2')?.addEventListener('click', () => {
        document.getElementById('modal-reset-round-2').style.display = 'flex';
    });
    document.querySelectorAll('.modal-close-reset-r1').forEach(btn => btn.addEventListener('click', () => {
        document.getElementById('modal-reset-round-1').style.display = 'none';
    }));
    document.querySelectorAll('.modal-close-reset-r2').forEach(btn => btn.addEventListener('click', () => {
        document.getElementById('modal-reset-round-2').style.display = 'none';
    }));
    document.getElementById('btn-confirm-reset-r1')?.addEventListener('click', async () => {
        await window.BackendAPI.resetRound1('R_DEFAULT');
        document.getElementById('modal-reset-round-1').style.display = 'none';
        refreshDashboardData();
        showAdminToast('✓ Round 1 data reset.', 'success');
    });
    document.getElementById('btn-confirm-reset-r2')?.addEventListener('click', async () => {
        await window.BackendAPI.resetRound2('R_DEFAULT');
        document.getElementById('modal-reset-round-2').style.display = 'none';
        refreshDashboardData();
        showAdminToast('✓ Round 2 data reset.', 'success');
    });

    // Login Submission
    const loginForm = document.getElementById('admin-login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const user = document.getElementById('admin-username').value;
            const pass = document.getElementById('admin-password').value;
            const btn = document.getElementById('admin-login-btn');
            const err = document.getElementById('admin-login-error');
            
            btn.disabled = true; btn.textContent = 'AUTHENTICATING...';
            err.textContent = '';
            
            window.BackendAPI.adminLogin(user, pass)
                .then(res => {
                    sessionStorage.setItem('admin_token', res.token);
                    showDashboard();
                })
                .catch(e => {
                    err.textContent = e.message;
                })
                .finally(() => {
                    btn.disabled = false; btn.textContent = 'SIGN IN →';
                });
        });
    }

    // Logout
    document.getElementById('admin-logout-btn').addEventListener('click', () => {
        sessionStorage.removeItem('admin_token');
        if (refreshInterval) clearInterval(refreshInterval);
        document.getElementById('admin-dashboard-screen').style.display = 'none';
        document.getElementById('admin-login-screen').style.display = 'flex';
    });

    // Subscriptions to Realtime Events
    window.BackendAPI.subscribeToEvents(() => {
        refreshDashboardData();
    });

    // Filters and Search listeners
    const searchInput = document.getElementById('monitor-search-input');
    if (searchInput) searchInput.addEventListener('input', () => renderMonitorTable());

    const statusFilter = document.getElementById('monitor-status-filter');
    if (statusFilter) statusFilter.addEventListener('change', () => renderMonitorTable());

    const roomFilter = document.getElementById('monitor-room-filter');
    if (roomFilter) roomFilter.addEventListener('change', () => renderMonitorTable());

    // Modal Close handlers
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('modal-create-room').style.display = 'none';
        });
    });

    document.querySelectorAll('.modal-close-team').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('modal-team-details').style.display = 'none';
        });
    });

    document.querySelectorAll('.modal-close-room').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('modal-room-details').style.display = 'none';
        });
    });

    // ── ADD ALLOWED TEAM MODAL ──────────────────────────────────────────────────
    const btnShowAddTeam = document.getElementById('btn-show-add-team');
    if (btnShowAddTeam) {
        btnShowAddTeam.addEventListener('click', () => {
            document.getElementById('at-team-name').value = '';
            document.getElementById('at-error').textContent = '';
            document.getElementById('modal-add-team').style.display = 'flex';
        });
    }

    document.querySelectorAll('.modal-close-add-team').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('modal-add-team').style.display = 'none';
        });
    });

    const formAddTeam = document.getElementById('form-add-team');
    if (formAddTeam) {
        formAddTeam.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('at-team-name');
            const errEl = document.getElementById('at-error');
            const submitBtn = document.getElementById('btn-submit-add-team');
            const name = nameInput.value.trim();
            errEl.textContent = '';
            if (!name) { errEl.textContent = 'Team name cannot be empty.'; return; }
            submitBtn.disabled = true;
            submitBtn.textContent = 'Registering...';
            try {
                await window.BackendAPI.addAllowedTeam(name);
                document.getElementById('modal-add-team').style.display = 'none';
                nameInput.value = '';
                refreshAllowedTeams();
            } catch (err) {
                errEl.textContent = err.message;
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Register Team';
            }
        });
    }

    // ── EVENT RESET BUTTON & CONFIRMATION MODAL ────────────────────────────────
    const btnResetEventData = document.getElementById('btn-reset-event-data');
    if (btnResetEventData) {
        btnResetEventData.addEventListener('click', () => {
            document.getElementById('modal-reset-event-confirm').style.display = 'flex';
        });
    }

    document.querySelectorAll('.modal-close-reset-event').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('modal-reset-event-confirm').style.display = 'none';
        });
    });

    const btnConfirmReset = document.getElementById('btn-confirm-reset-event');
    if (btnConfirmReset) {
        btnConfirmReset.addEventListener('click', async () => {
            btnConfirmReset.disabled = true;
            btnConfirmReset.textContent = 'Resetting...';
            try {
                await window.BackendAPI.resetEventData();
                document.getElementById('modal-reset-event-confirm').style.display = 'none';
                refreshDashboardData();
                refreshAllowedTeams();
                showAdminToast('✓ Event data reset. Code Noir is in a clean state.', 'success');
            } catch (err) {
                alert('Reset failed: ' + err.message);
            } finally {
                btnConfirmReset.disabled = false;
                btnConfirmReset.textContent = 'RESET EVENT DATA';
            }
        });
    }

    // Create Room Modal Trigger & Submit
    document.getElementById('btn-show-create-room').addEventListener('click', async () => {
        const events = await window.BackendAPI.getEvents();
        const sel = document.getElementById('cr-event-id');
        sel.innerHTML = events.map(ev => `<option value="${ev.id}">${ev.name}</option>`).join('');
        document.getElementById('cr-result').style.display = 'none';
        document.getElementById('form-create-room').reset();
        document.getElementById('modal-create-room').style.display = 'flex';
    });

    document.getElementById('form-create-room').addEventListener('submit', (e) => {
        e.preventDefault();
        const eventId = document.getElementById('cr-event-id').value;
        const roomName = document.getElementById('cr-room-name').value.trim();
        const maxTeams = parseInt(document.getElementById('cr-max-teams').value) || 15;
        
        window.BackendAPI.createRoom(eventId, roomName, maxTeams).then((room) => {
            document.getElementById('cr-generated-code').textContent = room.code;
            document.getElementById('cr-result').style.display = 'block';
            refreshDashboardData();
        }).catch(err => alert(err.message));
    });

});

// ── ADMIN TOAST NOTIFICATION ──────────────────────────────────────────────────
function showAdminToast(message, type = 'info') {
    let toast = document.getElementById('admin-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'admin-toast';
        toast.style.cssText = `
            position: fixed; bottom: 2rem; right: 2rem; z-index: 9999;
            padding: 1rem 1.5rem; border-radius: 10px; font-family: var(--font-mono);
            font-size: 0.95rem; font-weight: 600; max-width: 400px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.6);
            transition: opacity 0.4s ease, transform 0.4s ease;
            transform: translateY(0); opacity: 1;
        `;
        document.body.appendChild(toast);
    }
    const colors = {
        success: { bg: 'rgba(0,255,170,0.18)', border: '#00ffaa', color: '#00ffaa' },
        error:   { bg: 'rgba(230,57,70,0.18)',  border: '#e63946', color: '#e63946' },
        info:    { bg: 'rgba(0,240,255,0.14)',  border: 'var(--primary)', color: 'var(--primary)' }
    };
    const c = colors[type] || colors.info;
    toast.style.background = c.bg;
    toast.style.border = `1px solid ${c.border}`;
    toast.style.color = c.color;
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
    }, 3500);
}

// ── SHOW DASHBOARD ────────────────────────────────────────────────────────────
function showDashboard() {
    document.getElementById('admin-login-screen').style.display = 'none';
    document.getElementById('admin-dashboard-screen').style.display = 'block';
    
    // Initial load
    refreshDashboardData();
    refreshAllowedTeams();

    // Auto polling every 3 seconds
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
        refreshDashboardData();
    }, 3000);
}

// ── REFRESH ALL DASHBOARD DATA ────────────────────────────────────────────────
async function refreshDashboardData() {
    try {
        const stats = await window.BackendAPI.getDashboardStats();
        const events = await window.BackendAPI.getEvents();
        const rooms = await window.BackendAPI.getRooms();
        const teams = await window.BackendAPI.getTeams();
        const logs = await window.BackendAPI.getAuditLog();

        // Find primary event (Code Noir / LIVE or default)
        let activeEvent = events.find(e => e.id === 'E_DEFAULT') || events.find(e => e.status === 'LIVE') || events[0];
        currentEventData = activeEvent;

        // 1. Top Bar & Header
        renderHeader(activeEvent);

        // 2. Top Statistics Cards
        renderTopStats(stats);

        // 3. Event Overview & Controls
        renderEventOverview(activeEvent, rooms, teams);

        // 4. Room Management Section
        renderRoomsSection(rooms, teams);

        // 5. Populate Monitor Room Filter Options if needed
        populateRoomFilterOptions(rooms);

        // 6. Live Team Monitor Table
        renderMonitorTable(teams, rooms);

        // 7. Activity Feed
        renderActivityFeed(logs);

        // 8. Leaderboard
        renderLeaderboard(teams, rooms);

        // Update live indicator timestamp
        const liveInd = document.getElementById('hdr-live-indicator');
        if (liveInd) {
            const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            liveInd.textContent = `Updated ${timeStr}`;
        }
        
        const mainRoom = rooms.find(r => r.id === 'R_DEFAULT');
        const btnStartR2 = document.getElementById('btn-start-round-2');
        if (mainRoom && btnStartR2) {
            if (currentAdminRound === 2) {
                btnStartR2.style.display = mainRoom.round2Status === 'STOPPED' ? 'inline-block' : 'none';
            } else {
                btnStartR2.style.display = 'none';
            }
        }
    } catch (e) {
        console.error('Error refreshing admin dashboard data:', e);
    }
}

// ── 1. HEADER ──────────────────────────────────────────────────────────────────
function renderHeader(event) {
    if (!event) return;
    document.getElementById('hdr-event-name').textContent = event.name;
    document.getElementById('hdr-event-status').textContent = event.status;
    document.getElementById('hdr-event-time').textContent = event.startTime || '10:00 AM';

    const pill = document.getElementById('event-live-status-pill');
    const pillText = document.getElementById('header-event-status-text');
    const dot = document.getElementById('live-dot-indicator');

    if (event.status === 'LIVE') {
        pillText.textContent = `${event.name.toUpperCase()} • LIVE`;
        dot.style.background = '#00ffaa';
        dot.style.boxShadow = '0 0 10px #00ffaa';
    } else {
        pillText.textContent = `${event.name.toUpperCase()} • ${event.status}`;
        dot.style.background = 'var(--text-dim)';
        dot.style.boxShadow = 'none';
    }
}

// ── 2. TOP STATS ──────────────────────────────────────────────────────────────
function renderTopStats(stats) {
    document.getElementById('stat-rooms').textContent = stats.totalRooms || 0;
    document.getElementById('stat-rooms-sub').textContent = `${stats.activeRooms || 0} Active Rooms`;

    document.getElementById('stat-teams').textContent = stats.totalTeams || 0;
    document.getElementById('stat-teams-sub').textContent = `${stats.totalParticipants || 0} Connected`;

    document.getElementById('stat-active').textContent = stats.playingNow || 0;
    document.getElementById('stat-waiting').textContent = stats.waitingTeams || 0;
    document.getElementById('stat-completed').textContent = stats.completed || 0;

    document.getElementById('stat-solved').textContent = stats.solvedStages || 0;
    document.getElementById('stat-attempts-sub').textContent = `${stats.submissions || 0} Submissions`;
}

// ── 3. EVENT OVERVIEW & CONTROLS ──────────────────────────────────────────────
function renderEventOverview(event, rooms, teams) {
    const container = document.getElementById('event-overview-container');
    const controlsContainer = document.getElementById('event-action-controls');
    if (!event || !container) return;

    const eventRooms = rooms.filter(r => r.eventId === event.id);
    const eventTeams = teams.filter(t => t.eventId === event.id);
    const activeTeams = eventTeams.filter(t => t.status === 'PLAYING').length;
    const completedTeams = eventTeams.filter(t => t.status === 'COMPLETED').length;

    const formattedDate = event.date || new Date().toISOString().split('T')[0];

    container.innerHTML = `
        <div class="overview-list">
            <div class="overview-item">
                <div class="lbl">EVENT NAME</div>
                <div class="val cyan">${event.name}</div>
            </div>
            <div class="overview-item">
                <div class="lbl">EVENT STATUS</div>
                <div class="val"><span class="status-badge ${event.status}">${event.status}</span></div>
            </div>
            <div class="overview-item">
                <div class="lbl">EVENT ID</div>
                <div class="val">${event.id}</div>
            </div>
            <div class="overview-item">
                <div class="lbl">DATE & START TIME</div>
                <div class="val">${formattedDate} @ ${event.startTime || '10:00'}</div>
            </div>
            <div class="overview-item">
                <div class="lbl">TOTAL ROOMS</div>
                <div class="val">${eventRooms.length}</div>
            </div>
            <div class="overview-item">
                <div class="lbl">TOTAL TEAMS JOINED</div>
                <div class="val">${eventTeams.length}</div>
            </div>
            <div class="overview-item">
                <div class="lbl">ACTIVE PLAYING TEAMS</div>
                <div class="val green">${activeTeams}</div>
            </div>
            <div class="overview-item">
                <div class="lbl">COMPLETED TEAMS</div>
                <div class="val cyan">${completedTeams}</div>
            </div>
        </div>
    `;

    // Event control buttons
    if (controlsContainer) {
        if (event.status === 'LIVE') {
            controlsContainer.innerHTML = `
                <button class="btn btn-sm btn-outline amber" onclick="confirmEventStatus('${event.id}', 'PAUSED')">PAUSE EVENT</button>
                <button class="btn btn-sm btn-outline red" onclick="confirmEventStatus('${event.id}', 'CLOSED')">END EVENT</button>
            `;
        } else if (event.status === 'PAUSED' || event.status === 'DRAFT') {
            controlsContainer.innerHTML = `
                <button class="btn btn-sm btn-primary" onclick="confirmEventStatus('${event.id}', 'LIVE')">MAKE EVENT LIVE</button>
            `;
        } else {
            controlsContainer.innerHTML = `
                <button class="btn btn-sm btn-outline" onclick="confirmEventStatus('${event.id}', 'LIVE')">RE-OPEN EVENT</button>
            `;
        }
    }
}

window.confirmEventStatus = async function(eventId, status) {
    if (status === 'CLOSED' || status === 'PAUSED') {
        if (!confirm(`Are you sure you want to change Code Noir event status to ${status}?`)) return;
    }
    await window.BackendAPI.setEventStatus(eventId, status);
    refreshDashboardData();
};

// ── 4. ROOM MANAGEMENT ────────────────────────────────────────────────────────
function renderRoomsSection(rooms, teams) {
    const container = document.getElementById('rooms-grid-container');
    if (!container) return;

    if (!rooms || rooms.length === 0) {
        container.innerHTML = `
            <div class="highlight-box">
                <div class="dim">NO ROOMS CREATED YET</div>
                <p class="dim" style="font-size:0.8rem; margin-top:0.4rem;">Create your first Code Noir room to generate a Room Code for participants.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="rooms-grid">
            ${rooms.map(r => {
                const roomTeams = teams.filter(t => t.roomId === r.id);
                const active = roomTeams.filter(t => t.status === 'PLAYING').length;
                const completed = roomTeams.filter(t => t.status === 'COMPLETED').length;

                return `
                    <div class="room-mini-card">
                        <div class="room-card-header">
                            <div>
                                <div class="room-card-name">${r.name || 'Room'}</div>
                                <span class="status-badge ${r.status}" style="margin-top:0.3rem;">${r.status}</span>
                            </div>
                            <div class="room-card-code">${r.code}</div>
                        </div>
                        <div class="dim" style="font-size:0.8rem; font-family:var(--font-mono);">
                            Teams Joined: <strong class="text-main">${roomTeams.length}</strong> / ${r.maxTeams || 15}<br>
                            Active: <strong class="green">${active}</strong> | Completed: <strong class="cyan">${completed}</strong>
                        </div>
                        <div class="flex-row gap-2 mt-2">
                            <button class="btn btn-sm btn-outline" onclick="viewRoomDetails('${r.id}')">VIEW</button>
                            ${r.status === 'DRAFT' ? `<button class="btn btn-sm btn-primary" onclick="setRoomStatus('${r.id}', 'OPEN')">OPEN</button>` : ''}
                            ${r.status === 'OPEN' ? `<button class="btn btn-sm btn-primary" onclick="setRoomStatus('${r.id}', 'LIVE')">START</button>` : ''}
                            ${r.status === 'LIVE' ? `<button class="btn btn-sm btn-outline amber" onclick="setRoomStatus('${r.id}', 'PAUSED')">PAUSE</button>` : ''}
                            ${r.status === 'PAUSED' ? `<button class="btn btn-sm btn-primary" onclick="setRoomStatus('${r.id}', 'LIVE')">RESUME</button>` : ''}
                            ${['OPEN', 'LIVE', 'PAUSED'].includes(r.status) ? `<button class="btn btn-sm btn-outline" onclick="setRoomStatus('${r.id}', 'LOCKED')">LOCK</button>` : ''}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

window.setRoomStatus = async function(id, status) {
    await window.BackendAPI.setRoomStatus(id, status);
    refreshDashboardData();
};

window.viewRoomDetails = async function(roomId) {
    const rooms = await window.BackendAPI.getRooms();
    const teams = await window.BackendAPI.getTeams(roomId);
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;

    document.getElementById('rd-modal-room-name').textContent = room.name || 'Room Details';
    document.getElementById('rd-modal-room-code').textContent = room.code;

    const modalContent = document.getElementById('rd-modal-content');
    modalContent.innerHTML = `
        <div class="overview-list mb-3">
            <div class="overview-item"><div class="lbl">STATUS</div><div class="val"><span class="status-badge ${room.status}">${room.status}</span></div></div>
            <div class="overview-item"><div class="lbl">ROOM CODE</div><div class="val cyan">${room.code}</div></div>
            <div class="overview-item"><div class="lbl">MAX TEAMS</div><div class="val">${room.maxTeams || 15}</div></div>
            <div class="overview-item"><div class="lbl">TEAMS JOINED</div><div class="val">${teams.length}</div></div>
        </div>

        <h4 style="color:var(--primary); font-family:var(--font-mono); margin-bottom:0.8rem;">TEAMS IN ROOM (${teams.length})</h4>
        <div class="table-container">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Team Name</th>
                        <th>Status</th>
                        <th>Stage</th>
                        <th>Progress</th>
                        <th>Timer Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${teams.length ? teams.map(t => {
                        const curRound = currentAdminRound;
                        const prg = t.progress?.[curRound] || {};
                        let timerDisplay = 'Not Started';
                        let sessionStatus = 'NONE';

                        if (t.sessionId) {
                            sessionStatus = 'ACTIVE';
                        }

                        return `
                        <tr>
                            <td><strong>${t.name}</strong></td>
                            <td><span class="status-badge ${t.status}">${t.status}</span></td>
                            <td>Stage ${prg.stage || prg.currentStage || 1} (R${curRound})</td>
                            <td>${prg.solved || 0} / ${prg.totalStages || (curRound === 1 ? 5 : 7)} Solved (${prg.percent || 0}%)</td>
                            <td><span class="status-badge ${t.status === 'COMPLETED' ? 'COMPLETED' : 'PLAYING'}">R${curRound} Timer 60m</span></td>
                            <td><button class="btn btn-sm btn-outline" onclick="viewTeamDetails('${t.id}')">DETAILS</button></td>
                        </tr>
                    `}).join('') : `<tr><td colspan="6" class="text-center dim">No teams have joined this room yet.</td></tr>`}
                </tbody>
            </table>
        </div>
    `;

    document.getElementById('modal-room-details').style.display = 'flex';
};

// ── 5. POPULATE MONITOR ROOM FILTER OPTIONS ──────────────────────────────────
function populateRoomFilterOptions(rooms) {
    const sel = document.getElementById('monitor-room-filter');
    if (!sel) return;
    const currentVal = sel.value;

    let html = '<option value="ALL">All Rooms</option>';
    rooms.forEach(r => {
        html += `<option value="${r.id}">${r.name || r.code} (${r.code})</option>`;
    });
    sel.innerHTML = html;
    if (currentVal) sel.value = currentVal;
}

// ── 6. LIVE TEAM MONITOR ─────────────────────────────────────────────────────
let cachedTeams = [];
let cachedRooms = [];

async function renderMonitorTable(teamsData = null, roomsData = null) {
    if (teamsData) cachedTeams = teamsData;
    if (roomsData) cachedRooms = roomsData;

    const tbody = document.getElementById('monitor-table-body');
    if (!tbody) return;

    let teams = cachedTeams;
    let rooms = cachedRooms;

    const searchTerm = (document.getElementById('monitor-search-input')?.value || '').toLowerCase().trim();
    const statusVal = document.getElementById('monitor-status-filter')?.value || 'ALL';
    const roomVal = document.getElementById('monitor-room-filter')?.value || 'ALL';

    // Filters
    if (roomVal !== 'ALL') {
        teams = teams.filter(t => t.roomId === roomVal);
    }
    if (statusVal !== 'ALL') {
        if (statusVal === 'JOINED') {
            teams = teams.filter(t => t.status === 'JOINED' || t.status === 'IDLE');
        } else {
            teams = teams.filter(t => t.status === statusVal);
        }
    }
    if (searchTerm) {
        teams = teams.filter(t => {
            const room = rooms.find(r => r.id === t.roomId);
            const rCode = room ? room.code.toLowerCase() : '';
            const rName = room ? room.name.toLowerCase() : '';
            return t.name.toLowerCase().includes(searchTerm) || rCode.includes(searchTerm) || rName.includes(searchTerm);
        });
    }

    if (!teams || teams.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="text-center dim" style="padding: 2rem;">
                    NO TEAMS YET<br>
                    <span style="font-size: 0.8rem;">Waiting for participants to join Code Noir using their Room Code.</span>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = teams.map(t => {
        const room = rooms.find(r => r.id === t.roomId);
        const roomCode = room ? room.code : '----';
        const roomName = room ? room.name : 'Unknown';

        const prg = t.progress?.[currentAdminRound] || {};

        const joinedTimeStr = t.joinedAt ? new Date(t.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Just now';
        const lastActAgo = prg.lastActivity ? Math.max(0, Math.floor((Date.now() - prg.lastActivity) / 1000)) + 's ago' : 'Recent';

        const currentStageDisplay = t.status === 'COMPLETED' ? 'Completed 🏁' : (prg.currentStage ? `Stage ${prg.currentStage}` : (prg.stage ? `Stage ${prg.stage}` : '—'));
        const solvedCount = prg.solved || 0;
        const totalStages = prg.totalStages || (currentAdminRound === 1 ? 5 : 7);
        const percent = prg.percent || Math.round((solvedCount / totalStages) * 100);

        return `
            <tr class="clickable-row" onclick="viewTeamDetails('${t.id}')">
                <td><strong class="cyan">${t.name}</strong></td>
                <td>${roomName}</td>
                <td><span class="code-badge" style="font-size:0.8rem; padding:0.1rem 0.4rem;">${roomCode}</span></td>
                <td>${joinedTimeStr}</td>
                <td><span class="status-badge ${t.status}">${t.status}</span></td>
                <td><strong style="color:var(--primary);">${currentStageDisplay}</strong></td>
                <td>
                    <div style="font-size:0.78rem;">${solvedCount} / ${totalStages} (${percent}%)</div>
                    <div class="progress-bar-container"><div class="progress-bar-fill" style="width:${percent}%"></div></div>
                </td>
                <td>${prg.timeElapsed || '00:00'}</td>
                <td>${lastActAgo}</td>
                <td><button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); viewTeamDetails('${t.id}')">DETAILS</button></td>
            </tr>
        `;
    }).join('');
}

// ── 7. TEAM DETAILS MODAL ─────────────────────────────────────────────────────
window.viewTeamDetails = async function(teamId) {
    const details = await window.BackendAPI.getTeamDetails(teamId);
    if (!details) return;

    document.getElementById('td-modal-team-name').textContent = details.name.toUpperCase();
    document.getElementById('td-modal-event-name').textContent = `${details.eventName} • Room Code: ${details.roomCode}`;

    const content = document.getElementById('td-modal-content');
    const prg = details.progress?.[currentAdminRound] || {};
    const solvedCount = prg.solved || 0;
    const currentStage = prg.currentStage || prg.stage || 1;
    const totalStages = prg.totalStages || (currentAdminRound === 1 ? 5 : 7);
    const percent = prg.percent || Math.round((solvedCount / totalStages) * 100);

    const joinedStr = details.joinedAt ? new Date(details.joinedAt).toLocaleTimeString() : '—';
    const stageStartedStr = prg.stageStartedAt ? new Date(prg.stageStartedAt).toLocaleTimeString() : '—';
    const lastActStr = prg.lastActivity ? new Date(prg.lastActivity).toLocaleTimeString() : '—';

    let stageBoxes = '';
    for (let i = 1; i <= totalStages; i++) {
        let cls = '';
        let label = `Stage ${i}`;
        if (i <= solvedCount) {
            cls = 'solved';
            label += ' ✓ SOLVED';
        } else if (i === currentStage && details.status !== 'COMPLETED') {
            cls = 'current';
            label += ' → ATTEMPTING';
        } else {
            label += ' 🔒 LOCKED';
        }
        stageBoxes += `<div class="stage-box ${cls}">${label}</div>`;
    }

    const historyItems = (details.history || []).slice().reverse().map(h => {
        let text = '';
        if (h.type === 'TEAM_JOINED') text = `Joined room ${h.roomCode || details.roomCode}`;
        else if (h.type === 'STAGE_STARTED') text = `Opened & started Stage ${h.stage}`;
        else if (h.type === 'SUBMISSION') text = `Submitted Stage ${h.stage} — ${h.isSuccess ? '✓ Success' : '✗ Failed (' + (h.resultMsg || 'Incorrect') + ')'}`;
        else if (h.type === 'STAGE_SOLVED') text = `Solved Stage ${h.stage} (${h.percent}% overall progress)`;
        else if (h.type === 'ROUND_COMPLETED' || h.type === 'GAME_COMPLETED') text = `🏆 Game Completed — All Stages Breached!`;
        else if (h.type === 'TEAM_LEFT') text = `Disconnected from room`;
        else text = `${h.type} event`;

        const timeStr = new Date(h.timestamp).toLocaleTimeString();
        return `<div class="activity-item" style="padding:0.5rem 0.8rem; font-size:0.8rem;">
            <div class="activity-content">
                <div>${text}</div>
                <div class="activity-time">${timeStr}</div>
            </div>
        </div>`;
    }).join('') || '<div class="dim">No activity timeline recorded yet.</div>';

    content.innerHTML = `
        <div class="overview-list mb-3">
            <div class="overview-item"><div class="lbl">TEAM NAME</div><div class="val cyan">${details.name}</div></div>
            <div class="overview-item"><div class="lbl">GAME STATUS</div><div class="val"><span class="status-badge ${details.status}">${details.status}</span></div></div>
            <div class="overview-item"><div class="lbl">ROOM NAME / CODE</div><div class="val">${details.roomName} (<span class="cyan">${details.roomCode}</span>)</div></div>
            <div class="overview-item"><div class="lbl">CURRENT ATTEMPTING STAGE</div><div class="val cyan">${details.status === 'COMPLETED' ? 'Completed 🏁' : 'Stage ' + currentStage + ' (' + (prg.currentStageType || 'python').toUpperCase() + ')'}</div></div>
            <div class="overview-item"><div class="lbl">SOLVED STAGES</div><div class="val green">${solvedCount} / ${totalStages} Solved</div></div>
            <div class="overview-item"><div class="lbl">COMPLETION PERCENTAGE</div><div class="val">${percent}%</div></div>
            <div class="overview-item"><div class="lbl">TOTAL SUBMISSIONS / ATTEMPTS</div><div class="val">${prg.attempts || 0} Total</div></div>
            <div class="overview-item"><div class="lbl">SUCCESS / FAILED SUBMISSIONS</div><div class="val"><span class="green">${prg.successfulSubmissions || 0} Successful</span> / <span class="amber">${prg.failedSubmissions || 0} Failed</span></div></div>
            <div class="overview-item"><div class="lbl">JOINED ROOM AT</div><div class="val">${joinedStr}</div></div>
            <div class="overview-item"><div class="lbl">CURRENT STAGE STARTED</div><div class="val">${stageStartedStr}</div></div>
            <div class="overview-item"><div class="lbl">LAST ACTIVITY AT</div><div class="val">${lastActStr}</div></div>
            <div class="overview-item"><div class="lbl">TOTAL TIME ELAPSED</div><div class="val">${prg.timeElapsed || '00:00'}</div></div>
        </div>

        <h4 style="color:var(--primary); font-family:var(--font-mono); margin-bottom:0.5rem;">STAGE PROGRESS BREAKDOWN (${solvedCount} / ${totalStages} Solved — ${percent}%)</h4>
        <div class="progress-bar-container" style="height:10px; margin-bottom:1rem;"><div class="progress-bar-fill" style="width:${percent}%"></div></div>
        <div class="stage-grid mb-3">
            ${stageBoxes}
        </div>

        <h4 style="color:var(--primary); font-family:var(--font-mono); margin-bottom:0.5rem;">REAL-TIME TEAM ACTIVITY TIMELINE</h4>
        <div class="activity-feed-container" style="max-height:200px;">
            ${historyItems}
        </div>
    `;

    document.getElementById('modal-team-details').style.display = 'flex';
};

// ── 8. ACTIVITY FEED ──────────────────────────────────────────────────────────
function renderActivityFeed(logs) {
    const box = document.getElementById('activity-feed-box');
    if (!box) return;

    if (!logs || logs.length === 0) {
        box.innerHTML = `
            <div class="highlight-box">
                <div class="dim">NO ACTIVITY YET</div>
                <p class="dim" style="font-size:0.8rem; margin-top:0.4rem;">Participant logins, stage entries, and completions stream live here.</p>
            </div>
        `;
        return;
    }

    box.innerHTML = logs.map(l => {
        let icon = '📌';
        let msg = '';
        if (l.type === 'TEAM_JOINED') {
            icon = '👥';
            msg = `Team <strong>${l.payload.teamName || 'A team'}</strong> joined room (Code: ${l.payload.roomCode || l.payload.roomId}).`;
        } else if (l.type === 'STAGE_STARTED') {
            icon = '🎯';
            msg = `Team started <strong>Stage ${l.payload.stageNumber || 1}</strong> (${(l.payload.stageType || 'challenge').toUpperCase()}).`;
        } else if (l.type === 'STAGE_SOLVED' || l.type === 'STAGE_COMPLETED') {
            icon = '🧩';
            msg = `Team completed <strong>Stage ${l.payload.stage || 0}</strong> (${l.payload.percent || 0}% overall).`;
        } else if (l.type === 'GAME_COMPLETED') {
            icon = '🏆';
            msg = `Team completed the entire Code Noir event!`;
        } else if (l.type === 'TEAM_ATTEMPT') {
            icon = l.payload.isSuccess ? '✓' : '⚡';
            msg = `Team submitted Stage ${l.payload.stageNumber || 1} — ${l.payload.isSuccess ? 'Success!' : 'Attempt logged.'}`;
        } else if (l.type === 'ROOM_STATUS_CHANGED') {
            icon = '🚪';
            msg = `Room status changed to <strong>${l.payload.status}</strong>.`;
        } else {
            msg = `${l.type} event recorded.`;
        }

        const timeAgo = Math.max(0, Math.floor((Date.now() - l.timestamp) / 1000));
        const timeStr = timeAgo < 60 ? `${timeAgo}s ago` : `${Math.floor(timeAgo / 60)}m ago`;

        return `
            <div class="activity-item ${l.type}">
                <div class="activity-icon">${icon}</div>
                <div class="activity-content">
                    <div class="activity-msg">${msg}</div>
                    <div class="activity-time">${timeStr} &bull; ${new Date(l.timestamp).toLocaleTimeString()}</div>
                </div>
            </div>
        `;
    }).join('');
}

// ── 9. LEADERBOARD ────────────────────────────────────────────────────────────
function renderLeaderboard(teams, rooms) {
    const tbody = document.getElementById('leaderboard-table-body');
    if (!tbody) return;

    if (!teams || teams.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center dim">No leaderboard entries yet. Teams will rank as they complete stages.</td></tr>`;
        return;
    }

    // Sort Teams: Solved count desc, Percent desc, Attempts asc
    const sorted = [...teams].sort((a, b) => {
        const prgA = a.progress?.[currentAdminRound] || {};
        const prgB = b.progress?.[currentAdminRound] || {};
        const solvedA = prgA.solved || 0;
        const solvedB = prgB.solved || 0;
        if (solvedB !== solvedA) return solvedB - solvedA;

        const attemptsA = prgA.attempts || 0;
        const attemptsB = prgB.attempts || 0;
        return attemptsA - attemptsB;
    });

    tbody.innerHTML = sorted.map((t, idx) => {
        const room = rooms.find(r => r.id === t.roomId);
        const roomCode = room ? room.code : '----';
        const prg = t.progress?.[currentAdminRound] || {};
        const currentStageDisplay = t.status === 'COMPLETED' ? 'Completed 🏁' : (prg.currentStage ? `Stage ${prg.currentStage}` : 'Stage 1');

        return `
            <tr class="clickable-row" onclick="viewTeamDetails('${t.id}')">
                <td><strong>#${idx + 1}</strong></td>
                <td><strong class="cyan">${t.name}</strong></td>
                <td><span class="code-badge" style="font-size:0.75rem; padding:0.1rem 0.3rem;">${roomCode}</span></td>
                <td><strong style="color:var(--primary);">${currentStageDisplay}</strong> (${prg.solved || 0} Solved)</td>
                <td>
                    <div style="font-size:0.78rem;">${prg.percent || 0}%</div>
                    <div class="progress-bar-container"><div class="progress-bar-fill" style="width:${prg.percent || 0}%"></div></div>
                </td>
                <td>${prg.attempts || 0}</td>
                <td><span class="status-badge ${t.status}">${t.status}</span></td>
            </tr>
        `;
    }).join('');
}

// ── 10. ALLOWED TEAMS WHITELIST ───────────────────────────────────────────────
async function refreshAllowedTeams() {
    try {
        const teams = await window.BackendAPI.getAllowedTeams();
        const joinedTeams = await window.BackendAPI.getTeams();
        renderAllowedTeamsTable(teams, joinedTeams);
    } catch (e) {
        console.error('Error loading allowed teams:', e);
    }
}

function renderAllowedTeamsTable(allowedTeams, joinedTeams = []) {
    const tbody = document.getElementById('allowed-teams-tbody');
    if (!tbody) return;

    if (!allowedTeams || allowedTeams.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center" style="padding: 2rem; color: var(--text-mid); font-size: 1rem;">
                    NO TEAMS REGISTERED YET<br>
                    <span style="font-size: 0.85rem; color: var(--text-dim);">Use the + ADD ALLOWED TEAM button to register official teams.</span>
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = allowedTeams.map(at => {
        const hasJoined = joinedTeams.some(jt => jt.name.trim().toLowerCase() === at.normalizedName);
        const joinedTeam = joinedTeams.find(jt => jt.name.trim().toLowerCase() === at.normalizedName);
        const registeredDate = at.createdAt ? new Date(at.createdAt).toLocaleString() : '—';
        const statusLabel = hasJoined
            ? `<span class="status-badge ${joinedTeam.status}">${joinedTeam.status}</span>`
            : `<span class="status-badge" style="color:var(--text-dim); border-color:rgba(255,255,255,0.15); background:rgba(255,255,255,0.05);">NOT JOINED</span>`;

        return `
            <tr>
                <td>
                    <div style="font-size: 1rem; font-weight: 700; color: var(--text-main); letter-spacing: 0.5px;">${at.displayName || at.name}</div>
                    <div style="font-size: 0.8rem; color: var(--text-dim); font-family: var(--font-mono); margin-top: 2px;">normalized: ${at.normalizedName}</div>
                </td>
                <td>${statusLabel}</td>
                <td style="font-size: 0.85rem; color: var(--text-mid);">${registeredDate}</td>
                <td>
                    <button class="btn btn-sm" style="background: rgba(230,57,70,0.15); border: 1px solid rgba(230,57,70,0.4); color: #e63946; font-size: 0.82rem; padding: 0.3rem 0.7rem;"
                        onclick="removeAllowedTeam('${at.id}', '${(at.displayName || at.name).replace(/'/g, '')}')">REMOVE</button>
                </td>
            </tr>`;
    }).join('');
}

window.removeAllowedTeam = async function(id, name) {
    if (!confirm(`Remove "${name}" from the allowed team list?\n\nIf this team has already joined, they will not be disconnected, but will not be able to reconnect.`)) return;
    try {
        await window.BackendAPI.removeAllowedTeam(id);
        refreshAllowedTeams();
        showAdminToast(`✓ Team "${name}" removed from allowed list.`, 'info');
    } catch (err) {
        alert('Failed to remove team: ' + err.message);
    }
};
