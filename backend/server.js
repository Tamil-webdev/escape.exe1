const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3001);
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'app-data.json');
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const FRONTEND_DIR = path.resolve(__dirname, '../frontend');
const ALLOWED_ORIGINS = new Set(
  [
    'https://escape-exe1-2.onrender.com',
    CLIENT_URL,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    process.env.API_URL,
    ...String(process.env.ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean)
  ].filter(Boolean)
);

const app = express();
const subscribers = new Set();

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;

  try {
    const hostname = new URL(origin).hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.vercel.app') || hostname.endsWith('.netlify.app') || hostname.endsWith('.onrender.com');
  } catch (error) {
    return false;
  }
}

function defaultDb() {
  return {
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
}

function ensureDataFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultDb(), null, 2));
  }
}

function readDb() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const db = ensureDefaultState(parsed);
    writeDb(db);
    return db;
  } catch (error) {
    const db = defaultDb();
    writeDb(db);
    return db;
  }
}

function writeDb(db) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

function normalizeTeamName(name) {
  return String(name || '').trim().toLowerCase();
}

function ensureDefaultState(db) {
  if (!Array.isArray(db.allowedTeams)) db.allowedTeams = [];
  if (!Array.isArray(db.teams)) db.teams = [];
  if (!Array.isArray(db.roundSessions)) db.roundSessions = [];
  if (!Array.isArray(db.auditLog)) db.auditLog = [];
  if (!Array.isArray(db.events) || db.events.length === 0) db.events = defaultDb().events;
  if (!Array.isArray(db.rooms) || db.rooms.length === 0) db.rooms = defaultDb().rooms;

  let event = db.events.find((item) => item.id === 'E_DEFAULT');
  if (!event) {
    db.events.unshift(defaultDb().events[0]);
  }

  let room = db.rooms.find((item) => item.id === 'R_DEFAULT');
  if (!room) {
    db.rooms.unshift(defaultDb().rooms[0]);
  } else {
    room.code = 'NOIR26';
    if (!room.round2Status) room.round2Status = 'STOPPED';
  }

  if (!db.admins || db.admins.length === 0) {
    db.admins = [{ username: 'admin', password: 'password' }];
  }

  return db;
}

function notifySubscribers(type, payload) {
  const message = { type, payload, timestamp: Date.now() };
  for (const subscriber of subscribers) {
    try {
      subscriber(message);
    } catch (error) {
      subscribers.delete(subscriber);
    }
  }
}

function logAudit(db, type, payload) {
  db.auditLog.push({ type, payload, timestamp: Date.now() });
  if (db.auditLog.length > 200) db.auditLog = db.auditLog.slice(-200);
}

function getDashboardStats(db) {
  let totalSolvedStages = 0;
  let totalSubmissions = 0;

  db.teams.forEach((team) => {
    totalSolvedStages += (team.progress?.[1]?.solved || 0) + (team.progress?.[2]?.solved || 0);
    totalSubmissions += (team.progress?.[1]?.attempts || 0) + (team.progress?.[2]?.attempts || 0);
  });

  const waitingTeams = db.teams.filter((team) => team.status === 'JOINED' || team.status === 'IDLE').length;
  const activeTeams = db.teams.filter((team) => team.status === 'PLAYING').length;
  const completedTeams = db.teams.filter((team) => team.progress?.[1]?.stageStatus === 'COMPLETED' && team.progress?.[2]?.stageStatus === 'COMPLETED').length;

  return {
    activeEvents: db.events.filter((event) => event.status === 'LIVE').length,
    totalRooms: db.rooms.length,
    activeRooms: db.rooms.filter((room) => ['OPEN', 'LIVE'].includes(room.status)).length,
    totalTeams: db.teams.length,
    teamsConnected: db.teams.filter((team) => ['JOINED', 'PLAYING', 'IDLE'].includes(team.status)).length,
    playingNow: activeTeams,
    waitingTeams,
    completed: completedTeams,
    totalParticipants: db.teams.filter((team) => team.status !== 'DISCONNECTED').length,
    solvedStages: totalSolvedStages,
    submissions: totalSubmissions
  };
}

const ROUND_DURATION_MS = 60 * 60 * 1000;

app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));

if (fs.existsSync(FRONTEND_DIR)) {
  app.use(express.static(FRONTEND_DIR));
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, status: 'healthy', timestamp: Date.now() });
});

app.get('/api/events/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (message) => {
    res.write(`data: ${JSON.stringify(message)}\n\n`);
  };

  subscribers.add(send);
  send({ type: 'connected', payload: { time: Date.now() } });

  req.on('close', () => {
    subscribers.delete(send);
  });
});

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  const db = readDb();
  const admin = db.admins.find((item) => item.username === username && item.password === password);
  if (!admin) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  return res.json({ success: true, token: 'admin_token_12345' });
});

app.get('/api/events', (req, res) => {
  const db = readDb();
  res.json({ events: db.events });
});

app.get('/api/rooms', (req, res) => {
  const db = readDb();
  res.json({ rooms: db.rooms });
});

app.get('/api/teams', (req, res) => {
  const db = readDb();
  const roomId = req.query.roomId;
  const teams = roomId ? db.teams.filter((team) => team.roomId === roomId) : db.teams;
  res.json({ teams });
});

app.get('/api/rooms/:roomId/status', (req, res) => {
  const db = readDb();
  const room = db.rooms.find((item) => item.id === req.params.roomId) || db.rooms[0];
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({ success: true, status: room.status, round2Status: room.round2Status });
});

app.post('/api/admin/rooms', (req, res) => {
  const { eventId, name, maxTeams } = req.body || {};
  const db = readDb();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let roomCode;
  do {
    roomCode = '';
    for (let i = 0; i < 6; i++) roomCode += chars[Math.floor(Math.random() * chars.length)];
  } while (db.rooms.some((room) => room.code === roomCode));

  const room = {
    id: 'R_' + Date.now().toString(36),
    eventId: eventId || 'E_DEFAULT',
    name: name || 'New Room',
    code: roomCode,
    maxTeams: Number(maxTeams) || 15,
    status: 'DRAFT',
    round2Status: 'STOPPED',
    createdAt: Date.now()
  };
  db.rooms.push(room);
  writeDb(db);
  notifySubscribers('ROOM_CREATED', { room });
  res.json({ room });
});

app.post('/api/admin/rooms/:roomId/status', (req, res) => {
  const db = readDb();
  const room = db.rooms.find((item) => item.id === req.params.roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  room.status = req.body?.status || room.status;
  writeDb(db);
  notifySubscribers('ROOM_STATUS_CHANGED', { roomId: room.id, status: room.status });
  res.json({ room });
});

app.post('/api/admin/rooms/:roomId/round2/start', (req, res) => {
  const db = readDb();
  const room = db.rooms.find((item) => item.id === req.params.roomId) || db.rooms[0];
  room.round2Status = 'ACTIVE';
  writeDb(db);
  notifySubscribers('ROUND2_STARTED', { roomId: room.id, round2Status: room.round2Status });
  res.json({ success: true, room });
});

app.get('/api/admin/stats', (req, res) => {
  const db = readDb();
  res.json({ stats: getDashboardStats(db) });
});

app.get('/api/audit-log', (req, res) => {
  const db = readDb();
  res.json({ auditLog: [...db.auditLog].reverse().slice(0, 100) });
});

app.post('/api/admin/teams', (req, res) => {
  const db = readDb();
  const rawName = String(req.body?.name || '').trim();
  if (!rawName) return res.status(400).json({ error: 'Team name cannot be empty.' });
  const normalizedName = normalizeTeamName(rawName);
  if (db.allowedTeams.some((team) => team.normalizedName === normalizedName)) {
    return res.status(409).json({ error: 'Team is already in the allowed list.' });
  }
  const team = {
    id: 'AT_' + Date.now().toString(36),
    name: rawName,
    displayName: rawName,
    normalizedName,
    createdAt: Date.now()
  };
  db.allowedTeams.push(team);
  logAudit(db, 'ALLOWED_TEAM_ADDED', { team });
  writeDb(db);
  notifySubscribers('ALLOWED_TEAM_ADDED', { team });
  res.json({ team });
});

app.delete('/api/admin/teams/:id', (req, res) => {
  const db = readDb();
  const before = db.allowedTeams.length;
  db.allowedTeams = db.allowedTeams.filter((team) => team.id !== req.params.id);
  if (db.allowedTeams.length !== before) {
    logAudit(db, 'ALLOWED_TEAM_REMOVED', { id: req.params.id });
    writeDb(db);
    notifySubscribers('ALLOWED_TEAM_REMOVED', { id: req.params.id });
  }
  res.json({ success: true });
});

app.get('/api/admin/allowed-teams', (req, res) => {
  const db = readDb();
  res.json({ allowedTeams: db.allowedTeams || [] });
});

app.post('/api/auth/team-login', (req, res) => {
  const { teamName, roomCode } = req.body || {};
  const db = readDb();
  const cleanRoomCode = String(roomCode || '').trim().toUpperCase();
  if (cleanRoomCode !== 'NOIR26') {
    return res.status(401).json({ error: 'Invalid Room Code. Entering Code Noir requires Room Code NOIR26.' });
  }

  const room = db.rooms.find((item) => item.code === 'NOIR26') || db.rooms[0];
  if (!room) return res.status(404).json({ error: 'Code Noir room not available.' });
  if (room.status === 'DRAFT') return res.status(403).json({ error: 'This room is not open yet. Please wait for the admin to open the room.' });
  if (['LOCKED', 'CLOSED'].includes(room.status)) return res.status(403).json({ error: 'Room is no longer accepting participants.' });

  const normalizedName = normalizeTeamName(teamName);
  if (!normalizedName) return res.status(400).json({ error: 'Team Name cannot be empty.' });

  const approvedTeam = (db.allowedTeams || []).find((team) => team.normalizedName === normalizedName);
  if (!approvedTeam) {
    return res.status(401).json({ error: 'LOGIN DENIED: TEAM NOT REGISTERED. Please contact event admin to add your team.' });
  }

  const existingTeam = db.teams.find((team) => team.roomId === room.id && normalizeTeamName(team.name) === normalizedName);
  const now = Date.now();

  const targetTeam = existingTeam || {
    id: 'T_' + Date.now().toString(36),
    eventId: room.eventId,
    roomId: room.id,
    name: String(teamName).trim(),
    status: 'JOINED',
    joinedAt: now,
    progress: {
      1: {
        round: 1,
        stage: 0,
        currentStage: 0,
        currentStageType: 'python',
        stageStatus: 'WAITING',
        percent: 0,
        solved: 0,
        totalStages: 5,
        attempts: 0,
        successfulSubmissions: 0,
        failedSubmissions: 0,
        timeElapsed: '00:00',
        joinedAt: now,
        stageStartedAt: null,
        completedAt: null,
        lastActivity: now
      },
      2: {
        round: 2,
        stage: 0,
        currentStage: 0,
        currentStageType: 'python',
        stageStatus: 'WAITING',
        percent: 0,
        solved: 0,
        totalStages: 7,
        attempts: 0,
        successfulSubmissions: 0,
        failedSubmissions: 0,
        timeElapsed: '00:00',
        joinedAt: now,
        stageStartedAt: null,
        completedAt: null,
        lastActivity: now
      }
    },
    history: [{ type: 'TEAM_JOINED', teamName: String(teamName).trim(), roomCode: room.code, timestamp: now }]
  };

  if (!existingTeam) {
    db.teams.push(targetTeam);
  } else if (['JOINED', 'PLAYING', 'IDLE'].includes(existingTeam.status)) {
    return res.status(409).json({ error: 'Team already connected. Only one participant per team is allowed.' });
  } else {
    existingTeam.status = 'JOINED';
    existingTeam.progress.lastActivity = now;
  }

  let session = db.roundSessions.find((item) => item.teamId === targetTeam.id && item.round === 1);
  if (!session) {
    session = {
      id: 'S_1_' + Date.now().toString(36),
      eventId: room.eventId,
      roomId: room.id,
      teamId: targetTeam.id,
      round: 1,
      status: 'ACTIVE',
      startedAt: now,
      expiresAt: now + ROUND_DURATION_MS,
      pausedAt: null,
      endedAt: null,
      lastActivityAt: now
    };
    db.roundSessions.push(session);
  }

  targetTeam.status = 'JOINED';
  logAudit(db, 'TEAM_JOINED', { teamId: targetTeam.id, teamName: targetTeam.name, roomId: room.id, roomCode: room.code });
  writeDb(db);
  notifySubscribers('TEAM_JOINED', { teamId: targetTeam.id, teamName: targetTeam.name, roomId: room.id, roomCode: room.code });

  res.json({
    success: true,
    participantId: 'p_' + Math.random().toString(36).slice(2, 11),
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
});

app.get('/api/teams/:teamId/details', (req, res) => {
  const db = readDb();
  const team = db.teams.find((item) => item.id === req.params.teamId);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  const room = db.rooms.find((item) => item.id === team.roomId);
  const event = db.events.find((item) => item.id === team.eventId);
  res.json({
    ...team,
    roomName: room ? room.name : 'Unknown Room',
    roomCode: room ? room.code : '----',
    eventName: event ? event.name : 'Unknown Event'
  });
});

app.get('/api/teams/:teamId/progress/:round', (req, res) => {
  const db = readDb();
  const team = db.teams.find((item) => item.id === req.params.teamId);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  const round = Number(req.params.round);
  res.json({ progress: team.progress?.[round] || { round, stageStatus: 'WAITING', percent: 0, solved: 0 } });
});

app.get('/api/teams/:teamId/sessions/:round', (req, res) => {
  const db = readDb();
  const round = Number(req.params.round);
  const session = (db.roundSessions || []).find((item) => item.teamId === req.params.teamId && item.round === round);
  const now = Date.now();
  if (!session) {
    return res.json({ active: false, round, status: 'WAITING', serverNow: now, remainingSeconds: 0 });
  }

  let currentStatus = session.status;
  let remainingMs = 0;
  if (currentStatus === 'ACTIVE') {
    remainingMs = Math.max(0, session.expiresAt - now);
    if (remainingMs <= 0) {
      currentStatus = 'EXPIRED';
      session.status = 'EXPIRED';
      session.endedAt = session.expiresAt;
      writeDb(db);
      notifySubscribers('SESSION_EXPIRED', { teamId: req.params.teamId, round });
    }
  }

  res.json({
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

app.post('/api/teams/:teamId/sessions/:round/start', (req, res) => {
  const db = readDb();
  const round = Number(req.params.round);
  const team = db.teams.find((item) => item.id === req.params.teamId);
  if (!team) return res.status(404).json({ error: 'Team not found' });

  let session = (db.roundSessions || []).find((item) => item.teamId === req.params.teamId && item.round === round);
  const now = Date.now();
  if (!session) {
    session = {
      id: 'S_' + round + '_' + Date.now().toString(36),
      eventId: team.eventId,
      roomId: team.roomId,
      teamId: team.id,
      round,
      status: 'ACTIVE',
      startedAt: now,
      expiresAt: now + ROUND_DURATION_MS,
      pausedAt: null,
      endedAt: null,
      lastActivityAt: now
    };
    db.roundSessions.push(session);
  }

  team.status = 'PLAYING';
  writeDb(db);
  notifySubscribers('SESSION_STARTED', { teamId: team.id, round, expiresAt: session.expiresAt });
  res.json({
    id: session.id,
    active: true,
    round,
    status: session.status,
    serverNow: now,
    startedAt: session.startedAt,
    expiresAt: session.expiresAt,
    remainingSeconds: Math.floor((session.expiresAt - now) / 1000)
  });
});

app.post('/api/teams/:teamId/leave', (req, res) => {
  const db = readDb();
  const team = db.teams.find((item) => item.id === req.params.teamId);
  if (team) {
    team.status = 'DISCONNECTED';
    team.history.push({ type: 'TEAM_LEFT', timestamp: Date.now() });
    writeDb(db);
    notifySubscribers('TEAM_LEFT', { teamId: team.id });
  }
  res.json({ success: true });
});

app.post('/api/teams/:teamId/attempts', (req, res) => {
  const db = readDb();
  const team = db.teams.find((item) => item.id === req.params.teamId);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  const { round = 1, stageNumber = 0, isSuccess = false, resultMsg = '' } = req.body || {};

  if (!team.progress[round]) team.progress[round] = {};
  team.progress[round].attempts = (team.progress[round].attempts || 0) + 1;
  if (isSuccess) {
    team.progress[round].successfulSubmissions = (team.progress[round].successfulSubmissions || 0) + 1;
  } else {
    team.progress[round].failedSubmissions = (team.progress[round].failedSubmissions || 0) + 1;
  }
  team.progress[round].lastActivity = Date.now();
  team.history.push({
    type: 'SUBMISSION',
    round,
    stage: stageNumber || team.progress[round].currentStage || 1,
    isSuccess,
    resultMsg,
    timestamp: Date.now()
  });
  writeDb(db);
  notifySubscribers('TEAM_ATTEMPT', { teamId: team.id, isSuccess, stageNumber });
  res.json({ success: true, team });
});

app.post('/api/teams/:teamId/stage-entry', (req, res) => {
  const db = readDb();
  const team = db.teams.find((item) => item.id === req.params.teamId);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  const { round, stageNumber, stageType = 'python', totalStages = 7 } = req.body || {};
  const r = Number(round || 1);
  team.status = 'PLAYING';
  if (!team.progress[r]) team.progress[r] = {};
  team.progress[r].round = r;
  team.progress[r].currentStage = Number(stageNumber || 0);
  team.progress[r].currentStageType = stageType;
  team.progress[r].stageStatus = 'ATTEMPTING';
  team.progress[r].totalStages = Number(totalStages || 7);
  team.progress[r].lastActivity = Date.now();
  team.history.push({ type: 'STAGE_STARTED', round: r, stage: Number(stageNumber || 0), stageType, timestamp: Date.now() });
  writeDb(db);
  notifySubscribers('STAGE_STARTED', { teamId: team.id, round: r, stageNumber: Number(stageNumber || 0), stageType });
  res.json({ success: true, progress: team.progress[r] });
});

app.post('/api/teams/:teamId/progress', (req, res) => {
  const db = readDb();
  const team = db.teams.find((item) => item.id === req.params.teamId);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  const { round, stage, percent, solved, timeElapsed, isCompleted, stageType } = req.body || {};
  const r = Number(round || 1);
  if (!team.progress[r]) team.progress[r] = {};
  team.status = isCompleted ? 'COMPLETED' : 'PLAYING';
  team.progress[r].round = r;
  team.progress[r].stage = Number(stage || team.progress[r].stage || 0);
  team.progress[r].currentStage = isCompleted ? Number(stage || team.progress[r].stage || 0) : (Number(stage || team.progress[r].stage || 0) + 1);
  team.progress[r].stageStatus = isCompleted ? 'COMPLETED' : 'ATTEMPTING';
  team.progress[r].percent = Number(percent || 0);
  team.progress[r].solved = Number(solved || 0);
  team.progress[r].timeElapsed = timeElapsed || team.progress[r].timeElapsed || '00:00';
  team.progress[r].lastActivity = Date.now();
  if (isCompleted) team.progress[r].completedAt = Date.now();

  const session = (db.roundSessions || []).find((item) => item.teamId === team.id && item.round === r);
  if (session && isCompleted) {
    session.status = 'COMPLETED';
    session.endedAt = Date.now();
  }

  team.history.push({ type: isCompleted ? 'ROUND_COMPLETED' : 'STAGE_SOLVED', round: r, stage: Number(stage || team.progress[r].stage || 0), percent: Number(percent || 0), timestamp: Date.now() });
  writeDb(db);
  notifySubscribers(isCompleted ? 'GAME_COMPLETED' : 'STAGE_SOLVED', { teamId: team.id, round: r, stage: Number(stage || team.progress[r].stage || 0), percent: Number(percent || 0) });
  res.json({ success: true, progress: team.progress[r] });
});

app.get('/api/admin/live/:round', (req, res) => {
  const db = readDb();
  res.json({ teams: db.teams.filter((team) => team.progress?.[Number(req.params.round)]), round: Number(req.params.round) });
});

app.post('/api/admin/reset', (req, res) => {
  const db = readDb();
  db.teams = [];
  db.roundSessions = [];
  db.auditLog = [];
  db.rooms.forEach((room) => {
    room.status = 'OPEN';
    room.round2Status = 'STOPPED';
  });
  const event = db.events.find((item) => item.id === 'E_DEFAULT');
  if (event) event.status = 'LIVE';
  writeDb(db);
  notifySubscribers('EVENT_DATA_RESET', { timestamp: Date.now() });
  res.json({ success: true, message: 'Code Noir Event Data successfully reset to clean state.' });
});

app.post('/api/admin/rounds/:round/reset', (req, res) => {
  const db = readDb();
  const round = Number(req.params.round);
  db.roundSessions = (db.roundSessions || []).filter((session) => session.round !== round);
  db.teams.forEach((team) => {
    if (team.progress && team.progress[round]) {
      team.progress[round] = {
        round,
        stage: 0,
        currentStage: 0,
        currentStageType: 'python',
        stageStatus: 'WAITING',
        percent: 0,
        solved: 0,
        totalStages: round === 1 ? 5 : 7,
        attempts: 0,
        successfulSubmissions: 0,
        failedSubmissions: 0,
        timeElapsed: '00:00',
        joinedAt: Date.now(),
        stageStartedAt: null,
        completedAt: null,
        lastActivity: Date.now()
      };
    }
  });

  if (round === 2) {
    db.rooms.forEach((room) => {
      room.round2Status = 'STOPPED';
    });
  }

  logAudit(db, round === 1 ? 'ROUND1_RESET' : 'ROUND2_RESET', { round });
  writeDb(db);
  notifySubscribers(round === 1 ? 'ROUND1_RESET' : 'ROUND2_RESET', { round });
  res.json({ success: true, message: round === 1 ? 'Round 1 data successfully reset.' : 'Round 2 data successfully reset. Round 2 is now STOPPED.' });
});

app.post('/api/admin/rounds/:round/start', (req, res) => {
  const db = readDb();
  const round = Number(req.params.round);
  if (round === 2) {
    db.rooms.forEach((room) => {
      room.round2Status = 'ACTIVE';
    });
    logAudit(db, 'ROUND2_STARTED', { round });
    writeDb(db);
    notifySubscribers('ROUND2_STARTED', { roomId: 'R_DEFAULT', round2Status: 'ACTIVE' });
    return res.json({ success: true, round2Status: 'ACTIVE' });
  }
  res.json({ success: true, roundState: 'ACTIVE' });
});

app.get('/api/admin/leaderboard/:round', (req, res) => {
  const db = readDb();
  const round = Number(req.params.round);
  const leaderboard = db.teams
    .map((team) => ({ teamId: team.id, teamName: team.name, solved: team.progress?.[round]?.solved || 0, status: team.status }))
    .sort((a, b) => b.solved - a.solved)
    .slice(0, 20);
  res.json({ leaderboard });
});

app.get('*', (req, res, next) => {
  const indexFile = path.join(FRONTEND_DIR, 'index.html');
  if (req.path.startsWith('/api/') || !fs.existsSync(indexFile)) {
    return next();
  }
  res.sendFile(indexFile);
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`CODE//ESCAPE backend running at http://localhost:${PORT}`);
  console.log(`Client URL: ${CLIENT_URL}`);
});
