async function initDB() {
    const SQL = await initSqlJs({
        locateFile: file => `https://cdn.jsdelivr.net/npm/sql.js@1.12.0/dist/${file}`
    });
    const db = new SQL.Database();

    db.run(`
        CREATE TABLE suspects (
            id           INTEGER PRIMARY KEY,
            name         TEXT NOT NULL,
            occupation   TEXT,
            age          INTEGER,
            district     TEXT,
            shift        TEXT,
            eye_color    TEXT,
            badge_number TEXT
        );
        CREATE TABLE locations (
            id       INTEGER PRIMARY KEY,
            name     TEXT NOT NULL,
            district TEXT,
            category TEXT
        );
        CREATE TABLE sightings (
            id           INTEGER PRIMARY KEY,
            suspect_id   INTEGER REFERENCES suspects(id),
            location_id  INTEGER REFERENCES locations(id),
            sighting_date TEXT,
            time_of_day  TEXT
        );
        CREATE TABLE witnesses (
            id         INTEGER PRIMARY KEY,
            name       TEXT,
            statement  TEXT,
            suspect_id INTEGER REFERENCES suspects(id)
        );
    `);

    // 20 suspects
    // Puzzle answers:
    //   P1: Selene Voss  — only night+Harbor suspect
    //   P2: Marco Lind   — only Mechanic/M-occ with age in {25,36,49}
    //   P3: Iris Caldwell — most recent sighting date among Uptown suspects
    //   P4: Dex Harmon   — only suspect sighted at hotel in Eastside
    //   P5: Jane Harley  — name='Jane Harley' in 'The Pits'
    db.run(`INSERT INTO suspects VALUES
        (1,  'Selene Voss',   'Nurse',       28, 'Harbor',   'night', 'grey',   'H-001'),
        (2,  'Marco Lind',    'Mechanic',    36, 'Midtown',  'day',   'brown',  'M-002'),
        (3,  'Iris Caldwell', 'Accountant',  45, 'Uptown',   'day',   'green',  'U-003'),
        (4,  'Dex Harmon',    'Salesman',    31, 'Eastside', 'swing', 'blue',   'E-004'),
        (5,  'Jane Harley',   'Florist',     52, 'The Pits', 'night', 'hazel',  'P-005'),
        (6,  'Viktor Crane',  'Dockworker',  40, 'Harbor',   'day',   'blue',   'H-006'),
        (7,  'Nina Reyes',    'Bartender',   26, 'Midtown',  'night', 'brown',  'M-007'),
        (8,  'Owen Marsh',    'Engineer',    49, 'Eastside', 'day',   'grey',   'E-008'),
        (9,  'Petra Wolff',   'Teacher',     38, 'Uptown',   'day',   'green',  'U-009'),
        (10, 'Raul Devito',   'Cook',        33, 'Harbor',   'swing', 'brown',  'H-010'),
        (11, 'Tessa Kane',    'Jeweler',     25, 'Midtown',  'night', 'blue',   'M-011'),
        (12, 'Colton Ray',    'Mechanic',    41, 'The Pits', 'day',   'grey',   'P-012'),
        (13, 'Bette Simms',   'Manager',     34, 'Harbor',   'day',   'hazel',  'H-013'),
        (14, 'Gus Farrow',    'Writer',      29, 'Eastside', 'night', 'brown',  'E-014'),
        (15, 'Lena Cross',    'Model',       27, 'The Pits', 'swing', 'blue',   'P-015'),
        (16, 'Floyd Hart',    'Miner',       50, 'Uptown',   'night', 'grey',   'U-016'),
        (17, 'Cora Specter',  'Merchant',    42, 'Midtown',  'day',   'hazel',  'M-017'),
        (18, 'Sal Finney',    'Mechanic',    53, 'Harbor',   'swing', 'blue',   'H-018'),
        (19, 'Ada Nook',      'Librarian',   44, 'Uptown',   'day',   'green',  'U-019'),
        (20, 'Rex Pimm',      'Dockmaster',  55, 'Harbor',   'day',   'brown',  'H-020')
    `);

    // 15 locations
    db.run(`INSERT INTO locations VALUES
        (1,  'The Rusty Anchor',       'Harbor',   'bar'),
        (2,  'Harbor Warehouse 7',     'Harbor',   'warehouse'),
        (3,  'Harbor Docks',           'Harbor',   'dock'),
        (4,  'The Golden Spoon',       'Midtown',  'bar'),
        (5,  'Midtown Grand Hotel',    'Midtown',  'hotel'),
        (6,  'City Museum',            'Midtown',  'museum'),
        (7,  'Eastside Motor Inn',     'Eastside', 'hotel'),
        (8,  'Eastside Diner',         'Eastside', 'bar'),
        (9,  'Eastside Research Lab',  'Eastside', 'lab'),
        (10, 'Uptown Club',            'Uptown',   'bar'),
        (11, 'Uptown Boutique Hotel',  'Uptown',   'hotel'),
        (12, 'City Art Gallery',       'Uptown',   'museum'),
        (13, 'The Pit Stop Bar',       'The Pits', 'bar'),
        (14, 'Pits Warehouse',         'The Pits', 'warehouse'),
        (15, 'Harbor Hotel',           'Harbor',   'hotel')
    `);

    // 30 sightings
    // Key rows:
    //   Iris (3) most recent Uptown sighting: 2024-03-15
    //   Dex (4) only hotel+Eastside sighting: row 5, location 7
    db.run(`INSERT INTO sightings VALUES
        (1,  3,  10, '2024-03-15', 'evening'),
        (2,  9,  10, '2024-02-20', 'afternoon'),
        (3,  16, 10, '2024-01-10', 'night'),
        (4,  19, 11, '2024-03-01', 'morning'),
        (5,  4,  7,  '2024-02-28', 'midnight'),
        (6,  1,  3,  '2024-03-10', 'night'),
        (7,  1,  1,  '2024-02-15', 'midnight'),
        (8,  6,  2,  '2024-03-12', 'afternoon'),
        (9,  10, 1,  '2024-01-20', 'evening'),
        (10, 20, 3,  '2024-02-08', 'morning'),
        (11, 2,  4,  '2024-03-05', 'afternoon'),
        (12, 7,  4,  '2024-03-08', 'evening'),
        (13, 17, 6,  '2024-02-25', 'afternoon'),
        (14, 11, 5,  '2024-01-30', 'morning'),
        (15, 8,  9,  '2024-02-10', 'afternoon'),
        (16, 14, 8,  '2024-03-03', 'evening'),
        (17, 12, 14, '2024-01-25', 'morning'),
        (18, 15, 13, '2024-02-20', 'night'),
        (19, 5,  14, '2024-03-14', 'midnight'),
        (20, 5,  13, '2024-02-05', 'evening'),
        (21, 13, 15, '2024-01-15', 'morning'),
        (22, 18, 3,  '2024-03-07', 'morning'),
        (23, 4,  8,  '2024-01-22', 'afternoon'),
        (24, 3,  12, '2024-02-14', 'evening'),
        (25, 2,  4,  '2024-01-18', 'night'),
        (26, 7,  5,  '2024-03-09', 'night'),
        (27, 16, 11, '2023-12-28', 'evening'),
        (28, 8,  9,  '2023-12-15', 'morning'),
        (29, 6,  1,  '2024-02-22', 'night'),
        (30, 10, 2,  '2024-03-11', 'afternoon')
    `);

    // 10 witnesses
    db.run(`INSERT INTO witnesses VALUES
        (1,  'Tommy Briggs', 'I saw a woman working late at the docks, definitely on the night crew.',      1),
        (2,  'Clara Fox',    'The guy had grease on his hands — worked on engines for sure.',               2),
        (3,  'Pedro Santos', 'She was reviewing ledgers at the Uptown Club, very businesslike.',            3),
        (4,  'Dottie Ray',   'Checked in with a single bag, no luggage, seemed in a hurry.',               4),
        (5,  'Sal Moreno',   'She always had flowers on her, even at midnight.',                            5),
        (6,  'Yuki Tanaka',  'The dockworker was arguing with someone near Warehouse 7.',                   6),
        (7,  'Beth Arnold',  'The bartender served drinks without making eye contact — fierce look.',       7),
        (8,  'James Plum',   'Older fella, engineer badge, always at the research lab late.',               8),
        (9,  'Mae Cortez',   'She taught at the local school, very proper, always seen in Uptown.',        9),
        (10, 'Ed Wallis',    'The man said he was just passing through, but I saw him at three spots.',    10)
    `);

    return db;
}

const DB_SCHEMA = `suspects
  id, name, occupation, age, district, shift, eye_color, badge_number

locations
  id, name, district, category

sightings
  id, suspect_id, location_id, sighting_date, time_of_day

witnesses
  id, name, statement, suspect_id`;
