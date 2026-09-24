(function () {
    const getConfiguredApiBase = () => {
        const candidates = [
            window.__CODE_NOIR_API_URL,
            window.API_URL,
            window.API_BASE_URL,
            window.CODE_NOIR_API_URL,
            window.__APP_API_URL
        ];

        for (const candidate of candidates) {
            if (typeof candidate === 'string' && candidate.trim()) {
                return candidate.trim().replace(/\/$/, '');
            }
        }

        return '';
    };

    const DEFAULT_API_BASE = (() => {
        const configured = getConfiguredApiBase();
        if (configured) return configured;

        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:3001';
        }

        if (window.location.hostname.endsWith('.github.io') || window.location.hostname === 'github.io') {
            return '';
        }

        if (window.location.hostname.endsWith('.onrender.com')) {
            return '';
        }

        return `${window.location.protocol}//${window.location.hostname}${window.location.port ? ':' + window.location.port : ''}`;
    })();

    const ROUND_DURATION_MINUTES = 60;

    async function request(path, options = {}) {
        const url = DEFAULT_API_BASE
            ? `${DEFAULT_API_BASE}${path.startsWith('/') ? '' : '/'}${path}`
            : `${path.startsWith('/') ? '' : '/'}${path}`;

        const response = await fetch(url, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
            ...options
        });

        const contentType = response.headers.get('content-type') || '';
        const body = contentType.includes('application/json') ? await response.json() : await response.text();

        if (!response.ok) {
            const message = typeof body === 'string' ? body : (body?.error || body?.message || 'Request failed');
            throw new Error(message);
        }

        return body;
    }

    const BackendAPI = {
        adminLogin: async (username, password) => request('/api/admin/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        }),

        getEvents: async () => request('/api/events').then((res) => res.events),
        createEvent: async (data) => request('/api/events', {
            method: 'POST',
            body: JSON.stringify(data)
        }),

        getRooms: async () => request('/api/rooms').then((res) => res.rooms),
        createRoom: async (eventId, roomName, maxTeams) => request('/api/admin/rooms', {
            method: 'POST',
            body: JSON.stringify({ eventId, name: roomName, maxTeams })
        }).then((res) => res.room),
        setRoomStatus: async (roomId, status) => request(`/api/admin/rooms/${roomId}/status`, {
            method: 'POST',
            body: JSON.stringify({ status })
        }).then((res) => res.room),
        startRound2: async (roomId) => request(`/api/admin/rooms/${roomId}/round2/start`, { method: 'POST' }),

        getTeams: async (roomId = null) => {
            const url = roomId ? `/api/teams?roomId=${encodeURIComponent(roomId)}` : '/api/teams';
            return request(url).then((res) => res.teams);
        },

        getAllowedTeams: async () => request('/api/admin/allowed-teams').then((res) => res.allowedTeams),
        addAllowedTeam: async (name) => request('/api/admin/teams', {
            method: 'POST',
            body: JSON.stringify({ name })
        }).then((res) => res.team),
        removeAllowedTeam: async (id) => request(`/api/admin/teams/${encodeURIComponent(id)}`, { method: 'DELETE' }),

        getAuditLog: async () => request('/api/audit-log').then((res) => res.auditLog || []),
        setEventStatus: async (eventId, status) => request(`/api/events/${eventId}/status`, {
            method: 'POST',
            body: JSON.stringify({ status })
        }),

        getTeamDetails: async (teamId) => request(`/api/teams/${encodeURIComponent(teamId)}/details`),
        getDashboardStats: async () => request('/api/admin/stats').then((res) => res.stats),

        subscribeToEvents: (callback) => {
            const source = new EventSource(`${DEFAULT_API_BASE}/api/events/stream`);
            source.onmessage = (event) => callback(JSON.parse(event.data));
            return source;
        },

        participantLogin: async (teamName, roomCode) => request('/api/auth/team-login', {
            method: 'POST',
            body: JSON.stringify({ teamName, roomCode })
        }),

        checkRoomStatus: async (roomId) => request(`/api/rooms/${encodeURIComponent(roomId)}/status`),
        getRoundSession: async (teamId, round) => request(`/api/teams/${encodeURIComponent(teamId)}/sessions/${round}`),
        startRoundSession: async (teamId, round) => request(`/api/teams/${encodeURIComponent(teamId)}/sessions/${round}/start`, { method: 'POST' }),
        leaveRoom: async (teamId) => request(`/api/teams/${encodeURIComponent(teamId)}/leave`, { method: 'POST' }),
        recordAttempt: async (teamId, round = 1, stageNumber = 0, isSuccess = false, resultMsg = '') => request(`/api/teams/${encodeURIComponent(teamId)}/attempts`, {
            method: 'POST',
            body: JSON.stringify({ round, stageNumber, isSuccess, resultMsg })
        }),
        updateStageEntry: async (teamId, round, stageNumber, stageType = 'python', totalStages = 7) => request(`/api/teams/${encodeURIComponent(teamId)}/stage-entry`, {
            method: 'POST',
            body: JSON.stringify({ round, stageNumber, stageType, totalStages })
        }),
        updateParticipantProgress: async (teamId, round, stage, percent, solved, timeElapsed, isCompleted, stageType = 'python') => request(`/api/teams/${encodeURIComponent(teamId)}/progress`, {
            method: 'POST',
            body: JSON.stringify({ round, stage, percent, solved, timeElapsed, isCompleted, stageType })
        }),

        validateActiveSession: async (teamId, round) => request(`/api/teams/${encodeURIComponent(teamId)}/sessions/${round}`),

        resetEventData: async () => request('/api/admin/reset', { method: 'POST' }),
        resetRoomState: async (roomId) => request(`/api/admin/rooms/${encodeURIComponent(roomId)}/reset`, { method: 'POST' }),
        resetRound1: async (roomId) => request(`/api/admin/rounds/1/reset`, { method: 'POST' }),
        resetRound2: async (roomId) => request(`/api/admin/rounds/2/reset`, { method: 'POST' }),
        startRoundSession: async (teamId, round) => request(`/api/teams/${encodeURIComponent(teamId)}/sessions/${round}/start`, { method: 'POST' })
    };

    window.ROUND_DURATION_MINUTES = ROUND_DURATION_MINUTES;
    window.BackendAPI = BackendAPI;
    window.CODE_NOIR_API_URL = DEFAULT_API_BASE;
})();

