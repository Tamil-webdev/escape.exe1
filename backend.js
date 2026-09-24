/**
 * backend.js — Simulated Backend Service for CODE//ESCAPE
 * Uses localStorage as a database and BroadcastChannel for cross-tab real-time events.
 */

const DB_KEY = 'codenoir_backend_db';
const CHANNEL_NAME = 'codenoir_realtime_events';

// Central Configuration
const ROUND_DURATION_MINUTES = 60;
const ROUND_DURATION_MS = ROUND_DURATION_MINUTES * 60 * 1000;

// Initialize Database if empty
function getDB() {
    try {
        let db = localStorage.getItem(DB_KEY);
        if (db) {
            db = JSON.parse(db);
            // Ensure permanent Code Noir event exists
            let codeNoirEvent = db.events.find(e => e.id === 'E_DEFAULT');
            if (!codeNoirEvent) {
                codeNoirEvent = {
                    id: 'E_DEFAULT', name: 'Code Noir', rounds: 2, maxTeams: 50, 
                    date: new Date().toISOString().split('T')[0], startTime: '10:00', 
                    status: 'LIVE', createdAt: Date.now()
                };
                db.events.unshift(codeNoirEvent);
            }
            // Ensure permanent NOIR26 room exists
            let mainRoom = db.rooms.find(r => r.id === 'R_DEFAULT');
            if (!mainRoom) {
                mainRoom = {
                    id: 'R_DEFAULT', eventId: 'E_DEFAULT', name: 'Main Room', 
                    code: 'NOIR26', maxTeams: 50, status: 'OPEN', round2Status: 'STOPPED', createdAt: Date.now()
                };
                db.rooms.unshift(mainRoom);
            } else {
                mainRoom.code = 'NOIR26';
                if (!mainRoom.round2Status) mainRoom.round2Status = 'STOPPED';
            }
            if (!db.allowedTeams) db.allowedTeams = [];
            if (!db.roundSessions) db.roundSessions = [];
            saveDB(db);
            return db;
        }
    } catch (e) { console.error('Failed to parse DB', e); }
    
    // Default schema
    const initialDb = {
        admins: [{ username: 'admin', password: 'password' }],
        events: [{
            id: 'E_DEFAULT',
            name: 'Code Noir',
            rounds: 2,
            maxTeams: 50,
            date: new Date().toISOString().split('T')[0],
            startTime: '10:00',
            status: 'LIVE',
            createdAt: Date.now()
        }],
        rooms: [{
            id: 'R_DEFAULT',
            eventId: 'E_DEFAULT',
            name: 'Main Room',
            code: 'NOIR26',
            maxTeams: 50,
            status: 'OPEN',
            round2Status: 'STOPPED',
            createdAt: Date.now()
        }],
        allowedTeams: [],
        teams: [],
        roundSessions: [],
        auditLog: []
    };
    saveDB(initialDb);
    return initialDb;
}

function saveDB(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
}

// Real-time Event Bus
const channel = new BroadcastChannel(CHANNEL_NAME);

function emitEvent(type, payload) {
    channel.postMessage({ type, payload, timestamp: Date.now() });
    
    // Log important events to audit log
    if (['TEAM_JOINED', 'ROUND_STARTED', 'STAGE_COMPLETED', 'ROOM_STATUS_CHANGED', 'TEAM_GENERATED'].includes(type)) {
        const db = getDB();
        db.auditLog.push({ type, payload, timestamp: Date.now() });
        saveDB(db);
    }
}

// ── Admin API ───────────────────────────────────────────────────────────────

const BackendAPI = {
    
    // -- Auth --
    adminLogin: async (username, password) => {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                const db = getDB();
                const admin = db.admins.find(a => a.username === username && a.password === password);
                if (admin) {
                    resolve({ success: true, token: 'admin_token_12345' });
                } else {
                    reject(new Error('Invalid credentials'));
                }
            }, 600); // Network delay simulation
        });
    },

    // -- Events --
    getEvents: async () => {
        return new Promise(resolve => setTimeout(() => resolve(getDB().events), 300));
    },

    createEvent: async (data) => {
        return new Promise(resolve => {
            setTimeout(() => {
                const db = getDB();
                const newEvent = {
                    id: 'E_' + Date.now().toString(36),
                    name: data.name,
                    rounds: data.rounds,
                    maxTeams: data.maxTeams,
                    date: data.date,
                    startTime: data.startTime,
                    status: 'DRAFT', // DRAFT, LIVE, CLOSED
                    createdAt: Date.now()
                };
                db.events.push(newEvent);
                saveDB(db);
                resolve(newEvent);
            }, 500);
        });
    },

    // -- Rooms --
    getRooms: async () => {
        return new Promise(resolve => setTimeout(() => resolve(getDB().rooms), 300));
    },

    createRoom: async (eventId, roomName, maxTeams) => {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                const db = getDB();
                // Auto-generate a readable room code (6 chars, no ambiguous chars)
                const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                let roomCode;
                do {
                    roomCode = '';
                    for (let i = 0; i < 6; i++) roomCode += chars[Math.floor(Math.random() * chars.length)];
                } while (db.rooms.some(r => r.code === roomCode));
                
                const newRoom = {
                    id: 'R_' + Date.now().toString(36),
                    eventId: eventId,
                    name: roomName,
                    code: roomCode,
                    maxTeams: maxTeams || 15,
                    status: 'DRAFT', // DRAFT, OPEN, WAITING, LIVE, PAUSED, COMPLETED, LOCKED, CLOSED
                    round2Status: 'STOPPED',
                    createdAt: Date.now()
                };
                db.rooms.push(newRoom);
                saveDB(db);
                resolve(newRoom);
            }, 400);
        });
    },

    setRoomStatus: async (roomId, status) => {
        return new Promise(resolve => {
            const db = getDB();
            const room = db.rooms.find(r => r.id === roomId);
            if (room) {
                room.status = status;
                saveDB(db);
                emitEvent('ROOM_STATUS_CHANGED', { roomId, status });
            }
            resolve(room);
        });
    },

    startRound2: async (roomId) => {
        return new Promise(resolve => {
            const db = getDB();
            const room = db.rooms.find(r => r.id === roomId);
            if (room) {
                room.round2Status = 'ACTIVE';
                saveDB(db);
                emitEvent('ROUND2_STARTED', { roomId });
            }
            resolve(room);
        });
    },

    // -- Teams & Credentials --
    getTeams: async (roomId = null) => {
        return new Promise(resolve => {
            setTimeout(() => {
                const db = getDB();
                if (roomId) {
                    resolve(db.teams.filter(t => t.roomId === roomId));
                } else {
                    resolve(db.teams);
                }
            }, 300);
        });
    },

    getAllowedTeams: async () => {
        return new Promise(resolve => {
            setTimeout(() => {
                const db = getDB();
                resolve(db.allowedTeams || []);
            }, 200);
        });
    },

    addAllowedTeam: async (name) => {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                const db = getDB();
                if (!db.allowedTeams) db.allowedTeams = [];
                const normalized = name.trim().toLowerCase();
                if (db.allowedTeams.some(at => at.normalizedName === normalized)) {
                    return reject(new Error('Team is already in the allowed list.'));
                }
                const newTeam = {
                    id: 'AT_' + Date.now().toString(36),
                    name: name.trim(),
                    normalizedName: normalized,
                    createdAt: Date.now()
                };
                db.allowedTeams.push(newTeam);
                saveDB(db);
                resolve(newTeam);
            }, 400);
        });
    },

    removeAllowedTeam: async (id) => {
        return new Promise(resolve => {
            const db = getDB();
            if (db.allowedTeams) {
                db.allowedTeams = db.allowedTeams.filter(at => at.id !== id);
                saveDB(db);
            }
            resolve({ success: true });
        });
    },

    // -- Audit & Leaderboard --
    getAuditLog: async () => {
        return new Promise(resolve => resolve(getDB().auditLog.reverse().slice(0, 100)));
    },

    setEventStatus: async (eventId, status) => {
        return new Promise(resolve => {
            const db = getDB();
            const event = db.events.find(e => e.id === eventId);
            if (event) {
                event.status = status;
                saveDB(db);
                emitEvent('EVENT_STATUS_CHANGED', { eventId, status });
            }
            resolve(event);
        });
    },

    getTeamDetails: async (teamId) => {
        return new Promise(resolve => {
            const db = getDB();
            const team = db.teams.find(t => t.id === teamId);
            if (!team) return resolve(null);
            const room = db.rooms.find(r => r.id === team.roomId);
            const event = db.events.find(e => e.id === team.eventId);
            resolve({
                ...team,
                roomName: room ? room.name : 'Unknown Room',
                roomCode: room ? room.code : '----',
                eventName: event ? event.name : 'Unknown Event'
            });
        });
    },

    getDashboardStats: async () => {
        return new Promise(resolve => {
            const db = getDB();
            let totalSolvedStages = 0;
            let totalSubmissions = 0;
            
            db.teams.forEach(t => {
                totalSolvedStages += (t.progress?.[1]?.solved || 0) + (t.progress?.[2]?.solved || 0);
                totalSubmissions += (t.progress?.[1]?.attempts || 0) + (t.progress?.[2]?.attempts || 0);
            });

            const waitingTeams = db.teams.filter(t => t.status === 'JOINED' || t.status === 'IDLE').length;
            const activeTeams = db.teams.filter(t => t.status === 'PLAYING').length;
            const completedTeams = db.teams.filter(t => t.progress?.[1]?.stageStatus === 'COMPLETED' && t.progress?.[2]?.stageStatus === 'COMPLETED').length;
            const totalTeams = db.teams.length;

            resolve({
                activeEvents: db.events.filter(e => e.status === 'LIVE').length,
                totalRooms: db.rooms.length,
                activeRooms: db.rooms.filter(r => ['OPEN', 'LIVE'].includes(r.status)).length,
                totalTeams: totalTeams,
                teamsConnected: db.teams.filter(t => ['JOINED', 'PLAYING', 'IDLE'].includes(t.status)).length,
                playingNow: activeTeams,
                waitingTeams: waitingTeams,
                completed: completedTeams,
                totalParticipants: db.teams.filter(t => t.status !== 'DISCONNECTED').length,
                solvedStages: totalSolvedStages,
                submissions: totalSubmissions
            });
        });
    },

    // Subscribe to live events
    subscribeToEvents: (callback) => {
        channel.onmessage = (event) => {
            callback(event.data);
        };
    },

    // ── Participant API ────────────────────────────────────────────────────────

    participantLogin: async (teamName, roomCode) => {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                const db = getDB();

                // 1. Enforce Room Code NOIR26
                const cleanRoomCode = (roomCode || '').trim().toUpperCase();
                if (cleanRoomCode !== 'NOIR26') {
                    return reject(new Error('Invalid Room Code. Entering Code Noir requires Room Code NOIR26.'));
                }

                const room = db.rooms.find(r => r.code === 'NOIR26') || db.rooms[0];
                if (!room) return reject(new Error('Code Noir room not available.'));
                if (room.status === 'DRAFT') {
                    return reject(new Error('This room is not open yet. Please wait for the admin to open the room.'));
                }
                if (room.status === 'LOCKED' || room.status === 'CLOSED') {
                    return reject(new Error('Room is no longer accepting participants.'));
                }

                // 2. Normalize team name (trim & lowercase, preserve internal spaces)
                const normalizedName = teamName.trim().toLowerCase();
                if (!normalizedName) return reject(new Error('Team Name cannot be empty.'));

                // 3. Team Whitelist / Pre-registered team check
                const allowedList = db.allowedTeams || [];
                const isApproved = allowedList.some(at => at.normalizedName === normalizedName);
                if (!isApproved) {
                    return reject(new Error('LOGIN DENIED: TEAM NOT REGISTERED. Please contact event admin to add your team.'));
                }

                // Check if this team name already exists in this room
                const existingTeam = db.teams.find(t => t.roomId === room.id && t.name.trim().toLowerCase() === normalizedName);
                
                if (existingTeam) {
                    // Team exists — check if already connected
                    if (['JOINED', 'PLAYING', 'IDLE'].includes(existingTeam.status)) {
                        return reject(new Error('Team already connected. Only one participant per team is allowed.'));
                    }
                    // Team exists but disconnected — allow resume
                    existingTeam.status = 'JOINED';
                    existingTeam.progress.lastActivity = Date.now();
                }

                // Check max teams capacity if creating new team
                if (!existingTeam) {
                    const teamsInRoom = db.teams.filter(t => t.roomId === room.id).length;
                    if (room.maxTeams && teamsInRoom >= room.maxTeams) {
                        return reject(new Error('Room is full. Maximum teams reached.'));
                    }
                }

                const now = Date.now();
                const targetTeam = existingTeam || {
                    id: 'T_' + Date.now().toString(36),
                    eventId: room.eventId,
                    roomId: room.id,
                    name: teamName.trim(),
                    status: 'JOINED',
                    joinedAt: now,
                    progress: {
                        1: {
                            round: 1, stage: 0, currentStage: 0, currentStageType: 'python',
                            stageStatus: 'WAITING', percent: 0, solved: 0, totalStages: 5,
                            attempts: 0, successfulSubmissions: 0, failedSubmissions: 0,
                            timeElapsed: '00:00', joinedAt: now, stageStartedAt: null, completedAt: null, lastActivity: now
                        },
                        2: {
                            round: 2, stage: 0, currentStage: 0, currentStageType: 'python',
                            stageStatus: 'WAITING', percent: 0, solved: 0, totalStages: 7,
                            attempts: 0, successfulSubmissions: 0, failedSubmissions: 0,
                            timeElapsed: '00:00', joinedAt: now, stageStartedAt: null, completedAt: null, lastActivity: now
                        }
                    },
                    history: [
                        { type: 'TEAM_JOINED', teamName: teamName.trim(), roomCode: room.code, timestamp: now }
                    ]
                };

                if (!existingTeam) {
                    db.teams.push(targetTeam);
                }

                // Create Round 1 session ONCE right upon successful login
                if (!db.roundSessions) db.roundSessions = [];
                const rNum = 1;
                let session = db.roundSessions.find(s => s.teamId === targetTeam.id && s.round === rNum);
                
                if (!session) {
                    const durationMs = ROUND_DURATION_MINUTES * 60 * 1000;
                    session = {
                        id: 'S_' + rNum + '_' + Date.now().toString(36),
                        eventId: room.eventId,
                        roomId: room.id,
                        teamId: targetTeam.id,
                        round: rNum,
                        status: 'ACTIVE',
                        startedAt: now,
                        expiresAt: now + durationMs,
                        pausedAt: null,
                        endedAt: null,
                        lastActivityAt: now
                    };
                    db.roundSessions.push(session);
                    emitEvent('SESSION_STARTED', { teamId: session.teamId, round: rNum, expiresAt: session.expiresAt });
                }

                saveDB(db);
                emitEvent('TEAM_JOINED', { teamId: targetTeam.id, teamName: targetTeam.name, roomId: room.id, roomCode: room.code });

                resolve({
                    success: true,
                    participantId: 'p_' + Math.random().toString(36).substr(2, 9),
                    teamId: targetTeam.id,
                    teamName: targetTeam.name,
                    roomId: room.id,
                    round2Status: room.round2Status,
                    session: {
                        round: session.round,
                        status: session.status,
                        startedAt: session.startedAt,
                        expiresAt: session.expiresAt,
                        serverNow: Date.now()
                    }
                });
            }, 800);
        });
    },
    
    // Check room status primarily for R2 transitioning
    checkRoomStatus: async (roomId) => {
        return new Promise(resolve => {
            const db = getDB();
            const room = db.rooms.find(r => r.id === roomId);
            if (!room) return resolve({ success: false });
            resolve({
                success: true,
                status: room.status,
                round2Status: room.round2Status
            });
        });
    },

    // ── Session & Timer API ───────────────────────────────────────────────────

    getRoundSession: async (teamId, round) => {
        return new Promise(resolve => {
            const db = getDB();
            const now = Date.now();
            let session = (db.roundSessions || []).find(s => s.teamId === teamId && s.round === Number(round));
            
            if (!session) {
                return resolve({
                    active: false,
                    round: Number(round),
                    status: 'WAITING',
                    serverNow: now,
                    remainingSeconds: 0
                });
            }

            let currentStatus = session.status;
            let remainingMs = 0;

            if (currentStatus === 'ACTIVE') {
                remainingMs = Math.max(0, session.expiresAt - now);
                if (remainingMs <= 0) {
                    currentStatus = 'EXPIRED';
                    session.status = 'EXPIRED';
                    session.endedAt = session.expiresAt;
                    saveDB(db);
                    emitEvent('SESSION_EXPIRED', { teamId, round });
                }
            } else if (currentStatus === 'PAUSED') {
                remainingMs = Math.max(0, session.expiresAt - (session.pausedAt || now));
            } else if (currentStatus === 'COMPLETED') {
                remainingMs = 0;
            }

            resolve({
                id: session.id,
                active: currentStatus === 'ACTIVE',
                round: session.round,
                status: currentStatus,
                serverNow: now,
                startedAt: session.startedAt,
                expiresAt: session.expiresAt,
                pausedAt: session.pausedAt,
                endedAt: session.endedAt,
                remainingSeconds: Math.floor(remainingMs / 1000)
            });
        });
    },

    startRoundSession: async (teamId, round, durationMinutes = ROUND_DURATION_MINUTES) => {
        return new Promise((resolve, reject) => {
            const db = getDB();
            const team = db.teams.find(t => t.id === teamId);
            if (!team) return reject(new Error('Team not found'));

            const rNum = Number(round);
            const now = Date.now();
            const durationMs = durationMinutes * 60 * 1000;

            if (!db.roundSessions) db.roundSessions = [];
            let session = db.roundSessions.find(s => s.teamId === teamId && s.round === rNum);

            if (!session) {
                // If starting Round 2 or a round without a session yet
                session = {
                    id: 'S_' + rNum + '_' + Date.now().toString(36),
                    eventId: team.eventId,
                    roomId: team.roomId,
                    teamId: team.id,
                    round: rNum,
                    status: 'ACTIVE',
                    startedAt: now,
                    expiresAt: now + durationMs,
                    pausedAt: null,
                    endedAt: null,
                    lastActivityAt: now
                };
                db.roundSessions.push(session);
                emitEvent('SESSION_STARTED', { teamId, round: rNum, expiresAt: session.expiresAt });
            } else if (session.status === 'PAUSED') {
                const pausedDuration = now - (session.pausedAt || now);
                session.expiresAt += pausedDuration;
                session.status = 'ACTIVE';
                session.pausedAt = null;
            } else if (session.status === 'EXPIRED') {
                // Keep EXPIRED status
            }

            team.status = 'PLAYING';
            if (!team.progress) team.progress = { 1: {}, 2: {} };
            if (!team.progress[rNum]) team.progress[rNum] = {};
            team.progress[rNum].round = rNum;
            team.progress[rNum].lastActivity = now;

            saveDB(db);

            const remainingMs = Math.max(0, session.expiresAt - now);

            resolve({
                id: session.id,
                active: session.status === 'ACTIVE',
                round: rNum,
                status: session.status,
                serverNow: now,
                startedAt: session.startedAt,
                expiresAt: session.expiresAt,
                remainingSeconds: Math.floor(remainingMs / 1000)
            });
        });
    },

    pauseRoundSession: async (teamId, round) => {
        return new Promise(resolve => {
            const db = getDB();
            const session = (db.roundSessions || []).find(s => s.teamId === teamId && s.round === Number(round));
            if (session && session.status === 'ACTIVE') {
                const now = Date.now();
                session.status = 'PAUSED';
                session.pausedAt = now;
                saveDB(db);
                emitEvent('SESSION_PAUSED', { teamId, round });
            }
            resolve(session);
        });
    },

    resumeRoundSession: async (teamId, round) => {
        return new Promise(resolve => {
            const db = getDB();
            const session = (db.roundSessions || []).find(s => s.teamId === teamId && s.round === Number(round));
            if (session && session.status === 'PAUSED') {
                const now = Date.now();
                const pausedDuration = now - (session.pausedAt || now);
                session.expiresAt += pausedDuration;
                session.status = 'ACTIVE';
                session.pausedAt = null;
                saveDB(db);
                emitEvent('SESSION_RESUMED', { teamId, round, expiresAt: session.expiresAt });
            }
            resolve(session);
        });
    },

    endRoundSession: async (teamId, round, reason = 'ENDED') => {
        return new Promise(resolve => {
            const db = getDB();
            const session = (db.roundSessions || []).find(s => s.teamId === teamId && s.round === Number(round));
            if (session) {
                const now = Date.now();
                session.status = reason;
                session.endedAt = now;
                saveDB(db);
                emitEvent('SESSION_ENDED', { teamId, round, reason });
            }
            resolve(session);
        });
    },

    validateActiveSession: async (teamId, round) => {
        const db = getDB();
        const now = Date.now();
        const session = (db.roundSessions || []).find(s => s.teamId === teamId && s.round === Number(round));
        if (!session) return { valid: true }; // allow initial entry before formal timer start if room open
        if (session.status === 'COMPLETED') return { valid: true, isCompleted: true };
        if (session.status === 'PAUSED') return { valid: false, error: 'SESSION_PAUSED', message: 'Round is currently paused by admin.' };
        if (session.status === 'EXPIRED' || now >= session.expiresAt) {
            session.status = 'EXPIRED';
            session.endedAt = session.endedAt || session.expiresAt;
            saveDB(db);
            return { valid: false, error: 'SESSION_EXPIRED', message: 'Your 60-minute round timer has expired.' };
        }
        return { valid: true, remainingSeconds: Math.floor((session.expiresAt - now) / 1000) };
    },

    updateStageEntry: async (teamId, round, stageNumber, stageType = 'python', totalStages = 7) => {
        return new Promise(async (resolve, reject) => {
            const db = getDB();
            const team = db.teams.find(t => t.id === teamId);
            if (!team) return resolve(false);

            // Auto-start session for round if not present
            let session = (db.roundSessions || []).find(s => s.teamId === teamId && s.round === Number(round));
            if (!session) {
                await BackendAPI.startRoundSession(teamId, round);
            } else {
                const validation = await BackendAPI.validateActiveSession(teamId, round);
                if (!validation.valid) {
                    return reject(new Error(validation.message || 'SESSION_EXPIRED'));
                }
            }

            const now = Date.now();
            team.status = 'PLAYING';
            if (!team.progress[round]) team.progress[round] = {};
            team.progress[round].round = round;
            team.progress[round].currentStage = stageNumber;
            team.progress[round].currentStageType = stageType;
            team.progress[round].stageStatus = 'ATTEMPTING';
            team.progress[round].totalStages = totalStages;
            team.progress[round].stageStartedAt = team.progress[round].stageStartedAt || now;
            team.progress[round].lastActivity = now;

            team.history.push({
                type: 'STAGE_STARTED',
                round,
                stage: stageNumber,
                stageType,
                timestamp: now
            });

            saveDB(db);
            emitEvent('STAGE_STARTED', { teamId, round, stageNumber, stageType });
            resolve(true);
        });
    },

    updateParticipantProgress: async (teamId, round, stage, percent, solved, timeStr, isCompleted, stageType = 'python') => {
        return new Promise(async (resolve, reject) => {
            const db = getDB();
            const team = db.teams.find(t => t.id === teamId);
            if (!team) return resolve(false);

            const validation = await BackendAPI.validateActiveSession(teamId, round);
            if (!validation.valid && !isCompleted) {
                return reject(new Error(validation.message || 'SESSION_EXPIRED'));
            }

            const now = Date.now();
            team.status = isCompleted ? 'COMPLETED' : 'PLAYING';
            if (!team.progress[round]) team.progress[round] = {};
            team.progress[round].round = round;
            team.progress[round].stage = stage;
            team.progress[round].currentStage = isCompleted ? stage : stage + 1;
            team.progress[round].stageStatus = isCompleted ? 'COMPLETED' : 'ATTEMPTING';
            team.progress[round].percent = percent;
            team.progress[round].solved = solved;
            team.progress[round].successfulSubmissions = (team.progress[round].successfulSubmissions || 0) + 1;
            team.progress[round].timeElapsed = timeStr;
            team.progress[round].lastActivity = now;
            if (isCompleted) team.progress[round].completedAt = now;

            let session = (db.roundSessions || []).find(s => s.teamId === teamId && s.round === Number(round));
            if (session && isCompleted) {
                session.status = 'COMPLETED';
                session.endedAt = now;
            }

            team.history.push({
                type: isCompleted ? 'ROUND_COMPLETED' : 'STAGE_SOLVED',
                round,
                stage,
                percent,
                timestamp: now
            });

            saveDB(db);
            emitEvent(isCompleted ? 'GAME_COMPLETED' : 'STAGE_SOLVED', { teamId, round, stage, percent });
            resolve(true);
        });
    },
    
    recordAttempt: async (teamId, round = 1, stageNumber = 0, isSuccess = false, resultMsg = '') => {
        const db = getDB();
        const team = db.teams.find(t => t.id === teamId);
        if (team) {
            const now = Date.now();
            if (!team.progress[round]) team.progress[round] = {};
            team.progress[round].attempts = (team.progress[round].attempts || 0) + 1;
            if (isSuccess) {
                team.progress[round].successfulSubmissions = (team.progress[round].successfulSubmissions || 0) + 1;
            } else {
                team.progress[round].failedSubmissions = (team.progress[round].failedSubmissions || 0) + 1;
            }
            team.progress[round].lastActivity = now;

            team.history.push({
                type: 'SUBMISSION',
                round,
                stage: stageNumber || team.progress[round].currentStage || 1,
                isSuccess,
                resultMsg,
                timestamp: now
            });

            saveDB(db);
            emitEvent('TEAM_ATTEMPT', { teamId, isSuccess, stageNumber });
        }
    },

    leaveRoom: async (teamId) => {
        return new Promise(resolve => {
            const db = getDB();
            const team = db.teams.find(t => t.id === teamId);
            if (team) {
                const now = Date.now();
                team.status = 'DISCONNECTED';
                if (team.progress[1]) team.progress[1].lastActivity = now;
                if (team.progress[2]) team.progress[2].lastActivity = now;
                team.history.push({ type: 'TEAM_LEFT', timestamp: now });
                saveDB(db);
                emitEvent('TEAM_LEFT', { teamId });
            }
            resolve();
        });
    },

    // ── Allowed Teams Whitelist Management ─────────────────────────────────────
    getAllowedTeams: async () => {
        return new Promise(resolve => {
            const db = getDB();
            resolve(db.allowedTeams || []);
        });
    },

    addAllowedTeam: async (teamName) => {
        return new Promise((resolve, reject) => {
            const db = getDB();
            const rawName = (teamName || '').trim();
            if (!rawName) return reject(new Error('Team Name cannot be empty'));
            const normalized = rawName.toLowerCase(); // preserves internal spaces

            if (!db.allowedTeams) db.allowedTeams = [];

            // Duplicate prevention via normalized team name
            const exists = db.allowedTeams.some(t => t.normalizedName === normalized);
            if (exists) {
                return reject(new Error(`Team "${rawName}" is already registered.`));
            }

            const newAllowedTeam = {
                id: 'AT_' + Date.now().toString(36),
                name: normalized, // Stored normalized in lowercase
                displayName: rawName,
                normalizedName: normalized,
                createdAt: Date.now()
            };

            db.allowedTeams.push(newAllowedTeam);
            saveDB(db);
            emitEvent('ALLOWED_TEAM_ADDED', { team: newAllowedTeam });
            resolve(newAllowedTeam);
        });
    },

    removeAllowedTeam: async (id) => {
        return new Promise((resolve, reject) => {
            const db = getDB();
            if (!db.allowedTeams) db.allowedTeams = [];
            db.allowedTeams = db.allowedTeams.filter(t => t.id !== id);
            saveDB(db);
            emitEvent('ALLOWED_TEAM_REMOVED', { id });
            resolve(true);
        });
    },

    // ── Resets: Event Data vs Room State ─────────────────────────────────────

    // 1. EVENT PAGE RESET: Erase test teams, sessions, logs, stats. Keep Code Noir event & rooms.
    resetEventData: async () => {
        return new Promise(resolve => {
            const db = getDB();
            
            // Clear all operational participant/session data
            db.teams = [];
            db.roundSessions = [];
            db.auditLog = [];

            // Reset room status to OPEN
            if (db.rooms) {
                db.rooms.forEach(r => {
                    r.status = 'OPEN';
                    r.round2Status = 'STOPPED';
                });
            }

            // Reset Code Noir event status to LIVE
            let codeNoir = db.events.find(e => e.id === 'E_DEFAULT');
            if (codeNoir) {
                codeNoir.status = 'LIVE';
            }

            saveDB(db);
            emitEvent('EVENT_DATA_RESET', { timestamp: Date.now() });
            resolve({ success: true, message: 'Code Noir Event Data successfully reset to clean state.' });
        });
    },

    // 2. ROOM STATE RESET: Reset room question/game state to normal default. Does NOT touch teams/allowedTeams/event.
    resetRoomState: async (roomId) => {
        return new Promise(resolve => {
            const db = getDB();
            const room = db.rooms.find(r => r.id === roomId) || db.rooms[0];
            if (room) {
                room.status = 'OPEN';
                room.round2Status = 'STOPPED';
                saveDB(db);
                emitEvent('ROOM_STATE_RESET', { roomId: room.id, timestamp: Date.now() });
            }
            resolve({ success: true, message: 'Room question state restored to default normal state.' });
        });
    },

    // 3. RESET ROUND 1 DATA ONLY
    resetRound1: async (roomId) => {
        return new Promise(resolve => {
            const db = getDB();
            
            // Remove R1 sessions
            db.roundSessions = db.roundSessions.filter(s => s.round !== 1);
            
            // Wipe R1 progress from teams
            db.teams.forEach(t => {
                if (t.roomId === roomId) {
                    t.progress[1] = {
                        round: 1, stage: 0, currentStage: 0, currentStageType: 'python',
                        stageStatus: 'WAITING', percent: 0, solved: 0, totalStages: 5,
                        attempts: 0, successfulSubmissions: 0, failedSubmissions: 0,
                        timeElapsed: '00:00', joinedAt: Date.now(), stageStartedAt: null, completedAt: null, lastActivity: Date.now()
                    };
                    t.status = 'JOINED'; // reset overall status
                }
            });

            db.auditLog.push({ type: 'ROUND1_RESET', timestamp: Date.now() });
            saveDB(db);
            emitEvent('ROUND1_RESET', { roomId });
            resolve({ success: true, message: 'Round 1 data successfully reset.' });
        });
    },

    // 4. RESET ROUND 2 DATA ONLY
    resetRound2: async (roomId) => {
        return new Promise(resolve => {
            const db = getDB();
            
            // Remove R2 sessions
            db.roundSessions = db.roundSessions.filter(s => s.round !== 2);
            
            // Wipe R2 progress from teams
            db.teams.forEach(t => {
                if (t.roomId === roomId) {
                    t.progress[2] = {
                        round: 2, stage: 0, currentStage: 0, currentStageType: 'python',
                        stageStatus: 'WAITING', percent: 0, solved: 0, totalStages: 7,
                        attempts: 0, successfulSubmissions: 0, failedSubmissions: 0,
                        timeElapsed: '00:00', joinedAt: Date.now(), stageStartedAt: null, completedAt: null, lastActivity: Date.now()
                    };
                    // Keep R1 status, so if they completed R1, they remain COMPLETED overall (but haven't done R2).
                }
            });

            const room = db.rooms.find(r => r.id === roomId);
            if (room) room.round2Status = 'STOPPED';

            db.auditLog.push({ type: 'ROUND2_RESET', timestamp: Date.now() });
            saveDB(db);
            emitEvent('ROUND2_RESET', { roomId });
            resolve({ success: true, message: 'Round 2 data successfully reset. Round 2 is now STOPPED.' });
        });
    }
};

window.ROUND_DURATION_MINUTES = ROUND_DURATION_MINUTES;
window.BackendAPI = BackendAPI;
