const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir);
}
const dbPath = path.join(dbDir, 'database.sqlite');
const db = new Database(dbPath);
const managedTables = ['judges', 'athletes', 'scores', 'run_times', 'config'];

// Initialize tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS judges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    pin TEXT
  );
  CREATE TABLE IF NOT EXISTS athletes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    order_index INTEGER,
    completed BOOLEAN DEFAULT 0,
    round TEXT DEFAULT 'qualification',
    source_athlete_id INTEGER,
    country TEXT DEFAULT '',
    image_url TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    athlete_id INTEGER,
    judge_id INTEGER,
    score INTEGER,
    UNIQUE(athlete_id, judge_id)
  );
  CREATE TABLE IF NOT EXISTS run_times (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    athlete_id INTEGER,
    judge_id INTEGER,
    time_seconds REAL,
    UNIQUE(athlete_id, judge_id)
  );
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Insert default config if empty
const configCount = db.prepare('SELECT COUNT(*) as count FROM config').get();
if (configCount.count === 0) {
  db.prepare('INSERT INTO config (key, value) VALUES (?, ?)').run('tvScrollMode', 'continuous');
  db.prepare('INSERT INTO config (key, value) VALUES (?, ?)').run('scoringFormula', 'sum');
  db.prepare('INSERT INTO config (key, value) VALUES (?, ?)').run('appName', 'LineScore');
  db.prepare('INSERT INTO config (key, value) VALUES (?, ?)').run('appIconUrl', '/favicon.ico');
  db.prepare('INSERT INTO config (key, value) VALUES (?, ?)').run('timeJudgeId', '');
  db.prepare('INSERT INTO config (key, value) VALUES (?, ?)').run('timeMinSeconds', '15');
  db.prepare('INSERT INTO config (key, value) VALUES (?, ?)').run('timeMaxSeconds', '45');
  db.prepare('INSERT INTO config (key, value) VALUES (?, ?)').run('timeDeductionPoints', '0');
}
// Ensure scoringFormula config exists (migration for existing databases)
const hasScoringFormula = db.prepare("SELECT COUNT(*) as count FROM config WHERE key = 'scoringFormula'").get();
if (hasScoringFormula.count === 0) {
  db.prepare('INSERT INTO config (key, value) VALUES (?, ?)').run('scoringFormula', 'sum');
}
// Ensure appName config exists (migration for existing databases)
const hasAppName = db.prepare("SELECT COUNT(*) as count FROM config WHERE key = 'appName'").get();
if (hasAppName.count === 0) {
  db.prepare('INSERT INTO config (key, value) VALUES (?, ?)').run('appName', 'LineScore');
}
// Ensure appIconUrl config exists (migration for existing databases)
const hasAppIconUrl = db.prepare("SELECT COUNT(*) as count FROM config WHERE key = 'appIconUrl'").get();
if (hasAppIconUrl.count === 0) {
  db.prepare('INSERT INTO config (key, value) VALUES (?, ?)').run('appIconUrl', '/favicon.ico');
}
// Ensure round config exists (migration for existing databases)
const hasCurrentRound = db.prepare("SELECT COUNT(*) as count FROM config WHERE key = 'currentRound'").get();
if (hasCurrentRound.count === 0) {
  db.prepare('INSERT INTO config (key, value) VALUES (?, ?)').run('currentRound', 'qualification');
}
const hasFinalistsCount = db.prepare("SELECT COUNT(*) as count FROM config WHERE key = 'finalistsCount'").get();
if (hasFinalistsCount.count === 0) {
  db.prepare('INSERT INTO config (key, value) VALUES (?, ?)').run('finalistsCount', '5');
}
for (const [key, value] of [
  ['timeJudgeId', ''],
  ['timeMinSeconds', '15'],
  ['timeMaxSeconds', '45'],
  ['timeDeductionPoints', '0']
]) {
  const exists = db.prepare('SELECT COUNT(*) as count FROM config WHERE key = ?').get(key);
  if (exists.count === 0) {
    db.prepare('INSERT INTO config (key, value) VALUES (?, ?)').run(key, value);
  }
}

const athleteColumns = db.prepare('PRAGMA table_info(athletes)').all().map(col => col.name);
if (!athleteColumns.includes('round')) {
  db.prepare("ALTER TABLE athletes ADD COLUMN round TEXT DEFAULT 'qualification'").run();
  db.prepare("UPDATE athletes SET round = 'qualification' WHERE round IS NULL OR round = ''").run();
}
if (!athleteColumns.includes('source_athlete_id')) {
  db.prepare('ALTER TABLE athletes ADD COLUMN source_athlete_id INTEGER').run();
}
if (!athleteColumns.includes('country')) {
  db.prepare("ALTER TABLE athletes ADD COLUMN country TEXT DEFAULT ''").run();
}
if (!athleteColumns.includes('image_url')) {
  db.prepare("ALTER TABLE athletes ADD COLUMN image_url TEXT DEFAULT ''").run();
}

const normalizeRound = (round) => round === 'finals' ? 'finals' : 'qualification';

const quoteSqlString = (value) => `'${String(value).replace(/'/g, "''")}'`;

const getTableColumns = (database, tableName) => {
  return database.prepare(`PRAGMA table_info(${tableName})`).all().map(col => col.name);
};

const tableExists = (database, tableName) => {
  const row = database.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName);
  return row.count > 0;
};

const validateUploadedDatabase = (filePath) => {
  const uploaded = new Database(filePath, { readonly: true });
  try {
    const integrity = uploaded.prepare('PRAGMA integrity_check').get();
    if (!integrity || integrity.integrity_check !== 'ok') {
      throw new Error('Uploaded database failed SQLite integrity check');
    }

    for (const tableName of ['judges', 'athletes', 'scores', 'config']) {
      if (!tableExists(uploaded, tableName)) {
        throw new Error(`Uploaded database is missing required table: ${tableName}`);
      }
    }
  } finally {
    uploaded.close();
  }
};

const copyUploadedTable = (tableName, columns) => {
  const currentColumns = getTableColumns(db, tableName);
  const sourceColumns = db.prepare(`PRAGMA uploaded.table_info(${tableName})`).all().map(col => col.name);
  const sharedColumns = columns.filter(column => currentColumns.includes(column) && sourceColumns.includes(column));

  db.prepare(`DELETE FROM ${tableName}`).run();
  if (sharedColumns.length === 0 || sourceColumns.length === 0) return;

  const selectColumns = sharedColumns.map(column => {
    if (column === 'round') return `COALESCE(${column}, 'qualification')`;
    return column;
  }).join(', ');
  db.prepare(`
    INSERT INTO ${tableName} (${sharedColumns.join(', ')})
    SELECT ${selectColumns} FROM uploaded.${tableName}
  `).run();
};

// Migrate data from database.json if sqlite is empty and json exists
const jsonPath = path.join(dbDir, 'database.json');
if (fs.existsSync(jsonPath)) {
  const judgesCount = db.prepare('SELECT COUNT(*) as count FROM judges').get().count;
  const athletesCount = db.prepare('SELECT COUNT(*) as count FROM athletes').get().count;
  
  if (judgesCount === 0 && athletesCount === 0) {
    console.log('Migrating data from database.json to database.sqlite...');
    try {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      db.transaction(() => {
        if (data.judges) {
          const insertJudge = db.prepare('INSERT INTO judges (id, username, pin) VALUES (?, ?, ?)');
          data.judges.forEach(j => insertJudge.run(j.id, j.username, j.pin));
        }
        if (data.athletes) {
          const insertAthlete = db.prepare('INSERT INTO athletes (id, name, order_index, completed, round, source_athlete_id, country, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
          data.athletes.forEach(a => insertAthlete.run(a.id, a.name, a.order_index, a.completed || 0, normalizeRound(a.round), a.source_athlete_id || null, a.country || '', a.image_url || ''));
        }
        if (data.scores) {
          const insertScore = db.prepare('INSERT INTO scores (id, athlete_id, judge_id, score) VALUES (?, ?, ?, ?)');
          data.scores.forEach(s => insertScore.run(s.id, s.athlete_id, s.judge_id, s.score));
        }
        if (data.config) {
          const insertConfig = db.prepare('INSERT INTO config (key, value) VALUES (?, ?)');
          for (const [key, value] of Object.entries(data.config)) {
            insertConfig.run(key, value);
          }
        }
      })();
      console.log('Migration complete. You can now delete database.json if you wish.');
    } catch (e) {
      console.error('Failed to migrate database.json', e);
    }
  }
}

module.exports = {
  getJudges: () => db.prepare('SELECT * FROM judges').all(),

  getJudge: (id) => db.prepare('SELECT * FROM judges WHERE id = ?').get(parseInt(id, 10)),

  getJudgeByLogin: (username, pin) => db.prepare('SELECT * FROM judges WHERE LOWER(username) = LOWER(?) AND pin = ?').get(username, pin),

  addJudge: (username, pin) => {
    const info = db.prepare('INSERT INTO judges (username, pin) VALUES (?, ?)').run(username, pin);
    return info.lastInsertRowid;
  },

  removeJudge: (id) => {
    const judgeId = parseInt(id, 10);
    db.prepare('DELETE FROM judges WHERE id = ?').run(judgeId);
    db.prepare('DELETE FROM scores WHERE judge_id = ?').run(judgeId);
    db.prepare('DELETE FROM run_times WHERE judge_id = ?').run(judgeId);
    db.prepare("UPDATE config SET value = '' WHERE key = 'timeJudgeId' AND value = ?").run(String(judgeId));
  },

  updateJudge: (id, username, pin) => {
    db.prepare('UPDATE judges SET username = ?, pin = ? WHERE id = ?').run(username, pin, parseInt(id, 10));
  },

  getCurrentRound: () => {
    const row = db.prepare("SELECT value FROM config WHERE key = 'currentRound'").get();
    return normalizeRound(row && row.value);
  },

  getFinalistsCount: () => {
    const row = db.prepare("SELECT value FROM config WHERE key = 'finalistsCount'").get();
    const count = parseInt(row && row.value, 10);
    return Number.isInteger(count) && count > 0 ? count : 5;
  },

  getAthletes: (round) => {
    const activeRound = normalizeRound(round || module.exports.getCurrentRound());
    const athletes = db.prepare('SELECT * FROM athletes WHERE round = ? ORDER BY order_index ASC').all(activeRound);
    const updateOrder = db.prepare('UPDATE athletes SET order_index = ? WHERE id = ?');
    db.transaction(() => {
      athletes.forEach((athlete, index) => {
        const newOrder = index + 1;
        if (athlete.order_index !== newOrder) {
          updateOrder.run(newOrder, athlete.id);
          athlete.order_index = newOrder;
        }
      });
    })();
    return athletes;
  },

  getAthlete: (id) => db.prepare('SELECT * FROM athletes WHERE id = ?').get(parseInt(id, 10)),

  addAthlete: (name, round, country = '') => {
    const activeRound = normalizeRound(round || module.exports.getCurrentRound());
    const maxOrderRow = db.prepare('SELECT MAX(order_index) as maxOrder FROM athletes WHERE round = ?').get(activeRound);
    const nextOrder = (maxOrderRow.maxOrder || 0) + 1;
    const info = db.prepare('INSERT INTO athletes (name, order_index, completed, round, source_athlete_id, country, image_url) VALUES (?, ?, 0, ?, NULL, ?, ?)').run(name, nextOrder, activeRound, String(country || '').trim(), '');
    return info.lastInsertRowid;
  },

  removeAthlete: (id) => {
    const athleteId = parseInt(id, 10);
    const athlete = db.prepare('SELECT round FROM athletes WHERE id = ?').get(athleteId);
    const athleteRound = normalizeRound(athlete && athlete.round);
    db.transaction(() => {
      db.prepare('DELETE FROM athletes WHERE id = ?').run(athleteId);
      db.prepare('DELETE FROM scores WHERE athlete_id = ?').run(athleteId);
      db.prepare('DELETE FROM run_times WHERE athlete_id = ?').run(athleteId);
      
      const athletes = db.prepare('SELECT id FROM athletes WHERE round = ? ORDER BY order_index ASC').all(athleteRound);
      const updateOrder = db.prepare('UPDATE athletes SET order_index = ? WHERE id = ?');
      athletes.forEach((a, idx) => {
        updateOrder.run(idx + 1, a.id);
      });
    })();
  },

  updateAthlete: (id, name, order_index, country = '') => {
    db.prepare('UPDATE athletes SET name = ?, order_index = ?, country = ? WHERE id = ?').run(name, parseInt(order_index, 10), String(country || '').trim(), parseInt(id, 10));
  },

  updateAthleteImage: (id, imageUrl) => {
    db.prepare('UPDATE athletes SET image_url = ? WHERE id = ?').run(String(imageUrl || '').trim(), parseInt(id, 10));
  },

  reorderAthletes: (orders, round) => {
    const activeRound = normalizeRound(round || module.exports.getCurrentRound());
    db.transaction(() => {
      const updateOrder = db.prepare('UPDATE athletes SET order_index = ? WHERE id = ?');
      orders.forEach(item => {
        updateOrder.run(parseInt(item.order_index, 10), parseInt(item.id, 10));
      });
      
      const athletes = db.prepare('SELECT id FROM athletes WHERE round = ? ORDER BY order_index ASC').all(activeRound);
      athletes.forEach((a, idx) => {
        updateOrder.run(idx + 1, a.id);
      });
    })();
  },

  submitScore: (athleteId, judgeId, score, timeSeconds = null) => {
    const aId = parseInt(athleteId, 10);
    const jId = parseInt(judgeId, 10);
    const sVal = Number(score);
    const config = module.exports.getConfig();
    const timeJudgeId = parseInt(config.timeJudgeId, 10);
    const isTimeJudge = Number.isInteger(timeJudgeId) && timeJudgeId === jId;
    const hasTimeSeconds = timeSeconds !== null && timeSeconds !== undefined && timeSeconds !== '';
    const tVal = hasTimeSeconds ? Number(timeSeconds) : null;

    if (isNaN(aId) || isNaN(jId) || !Number.isFinite(sVal)) {
      throw new Error(`Invalid score submission: athleteId=${athleteId}, judgeId=${judgeId}, score=${score}`);
    }
    if (isTimeJudge && (!hasTimeSeconds || !Number.isFinite(tVal) || tVal < 0)) {
      throw new Error('The time judge must submit a valid time in seconds');
    }

    db.transaction(() => {
      db.prepare(`
        INSERT INTO scores (athlete_id, judge_id, score) 
        VALUES (?, ?, ?) 
        ON CONFLICT(athlete_id, judge_id) 
        DO UPDATE SET score = excluded.score
      `).run(aId, jId, sVal);

      if (isTimeJudge) {
        db.prepare(`
          INSERT INTO run_times (athlete_id, judge_id, time_seconds)
          VALUES (?, ?, ?)
          ON CONFLICT(athlete_id, judge_id)
          DO UPDATE SET time_seconds = excluded.time_seconds
        `).run(aId, jId, tVal);
      }

      // Check completion
      const athleteScoresCount = db.prepare('SELECT COUNT(*) as count FROM scores WHERE athlete_id = ?').get(aId).count;
      const judgeCount = db.prepare('SELECT COUNT(*) as count FROM judges').get().count;

      if (athleteScoresCount >= judgeCount && judgeCount > 0) {
        db.prepare('UPDATE athletes SET completed = 1 WHERE id = ?').run(aId);
      }
    })();
  },

  getScore: (athleteId, judgeId) => {
    const score = db.prepare('SELECT * FROM scores WHERE athlete_id = ? AND judge_id = ?').get(parseInt(athleteId, 10), parseInt(judgeId, 10));
    const time = db.prepare('SELECT time_seconds FROM run_times WHERE athlete_id = ? AND judge_id = ?').get(parseInt(athleteId, 10), parseInt(judgeId, 10));
    return score ? { ...score, time_seconds: time ? time.time_seconds : null } : null;
  },

  getScoresForAthlete: (athleteId) => {
    return db.prepare('SELECT * FROM scores WHERE athlete_id = ?').all(parseInt(athleteId, 10));
  },

  getDatabaseSnapshot: (round) => {
    const activeRound = round ? normalizeRound(round) : null;
    const athleteWhere = activeRound ? 'WHERE round = ?' : '';
    const params = activeRound ? [activeRound] : [];
    const athletes = db.prepare(`SELECT * FROM athletes ${athleteWhere} ORDER BY round ASC, order_index ASC, id ASC`).all(...params);
    const judges = db.prepare('SELECT * FROM judges ORDER BY id ASC').all();
    const scores = db.prepare(`
      SELECT
        scores.id,
        scores.athlete_id,
        athletes.name AS athlete_name,
        scores.judge_id,
        judges.username AS judge_name,
        scores.score
      FROM scores
      LEFT JOIN athletes ON athletes.id = scores.athlete_id
      LEFT JOIN judges ON judges.id = scores.judge_id
      ${activeRound ? 'WHERE athletes.round = ?' : ''}
      ORDER BY athletes.order_index ASC, athletes.id ASC, judges.id ASC
    `).all(...params);
    const times = db.prepare(`
      SELECT
        run_times.id,
        run_times.athlete_id,
        athletes.name AS athlete_name,
        run_times.judge_id,
        judges.username AS judge_name,
        run_times.time_seconds
      FROM run_times
      LEFT JOIN athletes ON athletes.id = run_times.athlete_id
      LEFT JOIN judges ON judges.id = run_times.judge_id
      ${activeRound ? 'WHERE athletes.round = ?' : ''}
      ORDER BY athletes.order_index ASC, athletes.id ASC, judges.id ASC
    `).all(...params);

    const scoreLookup = new Map(scores.map(score => [`${score.athlete_id}:${score.judge_id}`, score.score]));
    const timeLookup = new Map(times.map(time => [`${time.athlete_id}:${time.judge_id}`, time.time_seconds]));
    const matrix = athletes.map(athlete => ({
      athlete_id: athlete.id,
      athlete_name: athlete.name,
      country: athlete.country || '',
      image_url: athlete.image_url || '',
      order_index: athlete.order_index,
      completed: athlete.completed,
      scores: judges.map(judge => ({
        judge_id: judge.id,
        judge_name: judge.username,
        score: scoreLookup.has(`${athlete.id}:${judge.id}`) ? scoreLookup.get(`${athlete.id}:${judge.id}`) : null,
        time_seconds: timeLookup.has(`${athlete.id}:${judge.id}`) ? timeLookup.get(`${athlete.id}:${judge.id}`) : null
      }))
    }));

    return { athletes, judges, scores, times, matrix };
  },

  getLeaderboard: (round) => {
    const config = module.exports.getConfig();
    const formula = config.scoringFormula || 'sum';
    const activeRound = normalizeRound(round || config.currentRound);
    const timeJudgeId = parseInt(config.timeJudgeId, 10);
    const hasTimeJudge = Number.isInteger(timeJudgeId) && timeJudgeId > 0;
    const timeMinSeconds = Number(config.timeMinSeconds ?? config.timeThresholdSeconds ?? 15);
    const timeMaxSeconds = Number(config.timeMaxSeconds ?? 45);
    const timeDeductionPoints = Number(config.timeDeductionPoints || 0);

    // Get raw data: all athletes with their individual scores
    const athletes = db.prepare('SELECT * FROM athletes WHERE round = ? ORDER BY order_index ASC').all(activeRound);
    const allScores = db.prepare('SELECT * FROM scores').all();
    const allTimes = db.prepare('SELECT * FROM run_times').all();

    const result = athletes.map(athlete => {
      const athleteScores = allScores.filter(s => s.athlete_id === athlete.id);
      const timeEntry = hasTimeJudge ? allTimes.find(t => t.athlete_id === athlete.id && t.judge_id === timeJudgeId) : null;
      const timeSeconds = timeEntry ? Number(timeEntry.time_seconds) : null;
      const scores = athleteScores.map(s => Number(s.score));
      let total_score = 0;

      if (scores.length > 0) {
        switch (formula) {
          case 'average': {
            const sum = scores.reduce((a, b) => a + b, 0);
            total_score = Math.round(sum / scores.length);
            break;
          }
          case 'drop-lowest': {
            if (scores.length > 1) {
              const sorted = [...scores].sort((a, b) => a - b);
              sorted.shift(); // remove lowest
              total_score = sorted.reduce((a, b) => a + b, 0);
            } else {
              total_score = scores[0];
            }
            break;
          }
          case 'drop-highest': {
            if (scores.length > 1) {
              const sorted = [...scores].sort((a, b) => a - b);
              sorted.pop(); // remove highest
              total_score = sorted.reduce((a, b) => a + b, 0);
            } else {
              total_score = scores[0];
            }
            break;
          }
          case 'sum':
          default: {
            total_score = scores.reduce((a, b) => a + b, 0);
            break;
          }
        }
      }

      const timeDeduction = (
        timeEntry &&
        Number.isFinite(timeSeconds) &&
        Number.isFinite(timeMinSeconds) &&
        Number.isFinite(timeMaxSeconds) &&
        Number.isFinite(timeDeductionPoints) &&
        timeMinSeconds >= 0 &&
        timeMaxSeconds >= timeMinSeconds &&
        timeDeductionPoints > 0 &&
        (timeSeconds < timeMinSeconds || timeSeconds > timeMaxSeconds)
      ) ? timeDeductionPoints : 0;

      total_score -= timeDeduction;

      return {
        id: athlete.id,
        name: athlete.name,
        order_index: athlete.order_index,
        completed: athlete.completed,
        round: athlete.round,
        country: athlete.country || '',
        image_url: athlete.image_url || '',
        total_score,
        score_count: scores.length,
        time_seconds: timeEntry ? timeSeconds : null,
        time_deduction: timeDeduction
      };
    });

    // Sort by total_score descending, then by id ascending
    result.sort((a, b) => b.total_score - a.total_score || a.id - b.id);
    return result;
  },

  resetCompetition: (dummyAthletesList) => {
    db.transaction(() => {
      db.prepare('DELETE FROM athletes').run();
      db.prepare('DELETE FROM scores').run();
      db.prepare('DELETE FROM run_times').run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('athletes', 'scores', 'run_times')").run();
      db.prepare("INSERT INTO config (key, value) VALUES ('currentRound', 'qualification') ON CONFLICT(key) DO UPDATE SET value = 'qualification'").run();

      if (dummyAthletesList && dummyAthletesList.length > 0) {
        const insertAthlete = db.prepare('INSERT INTO athletes (name, order_index, completed, round, source_athlete_id, country, image_url) VALUES (?, ?, ?, ?, NULL, ?, ?)');
        const insertScore = db.prepare('INSERT INTO scores (athlete_id, judge_id, score) VALUES (?, ?, ?)');
        const insertTime = db.prepare('INSERT INTO run_times (athlete_id, judge_id, time_seconds) VALUES (?, ?, ?)');
        const judges = db.prepare('SELECT id FROM judges').all();
        const config = module.exports.getConfig();
        const configuredTimeJudgeId = parseInt(config.timeJudgeId, 10);
        const hasConfiguredTimeJudge = judges.some(judge => judge.id === configuredTimeJudgeId);
        const demoTimeJudgeId = hasConfiguredTimeJudge ? configuredTimeJudgeId : (judges[0] ? judges[0].id : null);

        if (!hasConfiguredTimeJudge && demoTimeJudgeId) {
          db.prepare(`
            INSERT INTO config (key, value)
            VALUES ('timeJudgeId', ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
          `).run(String(demoTimeJudgeId));
        }
        
        dummyAthletesList.forEach(athlete => {
          const info = insertAthlete.run(athlete.name, athlete.order, athlete.completed, normalizeRound(athlete.round), athlete.country || '', athlete.image_url || '');
          const aId = info.lastInsertRowid;
          
          if (athlete.completed && athlete.scores && athlete.scores.length > 0) {
            judges.forEach((judge, idx) => {
              const score = athlete.scores[idx % athlete.scores.length];
              insertScore.run(aId, judge.id, parseInt(score, 10));
            });
          }
          if (athlete.completed && demoTimeJudgeId && Number.isFinite(Number(athlete.timeSeconds))) {
            insertTime.run(aId, demoTimeJudgeId, Number(athlete.timeSeconds));
          }
        });
      }
    })();
  },

  loadPreset: () => {
    const dummyAthletes = [
      { name: 'Sarah Maier', country: 'Austria', order: 1, completed: 1, scores: [95, 92, 94, 96, 93, 95], timeSeconds: 32.45 },
      { name: 'Johannes Brandl', country: 'Germany', order: 2, completed: 1, scores: [85, 90, 88, 92, 89, 87], timeSeconds: 48.12 },
      { name: 'Maximilian Fuchs', country: 'Switzerland', order: 3, completed: 1, scores: [78, 82, 80, 85, 79, 81], timeSeconds: 14.87 },
      { name: 'Elena Wagner', country: 'Austria', order: 4, completed: 1, scores: [88, 86, 89, 90, 87, 85], timeSeconds: 27.63 },
      { name: 'Lukas Pichler', country: 'Italy', order: 5, completed: 1, scores: [72, 75, 74, 76, 73, 71], timeSeconds: 44.2 },
      { name: 'Anna Steiner', country: 'Slovenia', order: 6, completed: 1, scores: [91, 89, 93, 92, 90, 94], timeSeconds: 36.08 },
      { name: 'David Hofer', country: 'Austria', order: 7, completed: 0, scores: [] },
      { name: 'Julia Gruber', country: 'Germany', order: 8, completed: 0, scores: [] },
      { name: 'Felix Berger', country: 'Switzerland', order: 9, completed: 0, scores: [] },
      { name: 'Lisa Moser', country: 'Italy', order: 10, completed: 0, scores: [] }
    ];
    module.exports.resetCompetition(dummyAthletes);
  },

  syncFinalists: (count) => {
    const finalistCount = parseInt(count, 10);
    if (!Number.isInteger(finalistCount) || finalistCount < 1 || finalistCount > 100) {
      throw new Error('Finalists count must be between 1 and 100');
    }

    db.transaction(() => {
      db.prepare(`
        INSERT INTO config (key, value)
        VALUES ('finalistsCount', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(String(finalistCount));

      const qualifiers = module.exports.getLeaderboard('qualification')
        .filter(athlete => athlete.completed === 1)
        .slice(0, finalistCount);

      const existingFinalists = db.prepare('SELECT * FROM athletes WHERE round = ? ORDER BY order_index ASC').all('finals');
      const existingBySource = new Map(existingFinalists.filter(finalist => finalist.source_athlete_id).map(finalist => [finalist.source_athlete_id, finalist]));
      const keepIds = new Set();
      const insertFinalist = db.prepare('INSERT INTO athletes (name, order_index, completed, round, source_athlete_id, country, image_url) VALUES (?, ?, 0, ?, ?, ?, ?)');
      const updateFinalist = db.prepare('UPDATE athletes SET name = ?, order_index = ?, country = ?, image_url = ? WHERE id = ?');
      const deleteFinalist = db.prepare('DELETE FROM athletes WHERE id = ?');
      const deleteScores = db.prepare('DELETE FROM scores WHERE athlete_id = ?');

      qualifiers.forEach((qualifier, index) => {
        const finalsOrder = qualifiers.length - index;
        const existing = existingBySource.get(qualifier.id) || existingFinalists.find(finalist => !finalist.source_athlete_id && finalist.name === qualifier.name);
        if (existing) {
          updateFinalist.run(qualifier.name, finalsOrder, qualifier.country || '', qualifier.image_url || '', existing.id);
          db.prepare('UPDATE athletes SET source_athlete_id = ? WHERE id = ?').run(qualifier.id, existing.id);
          keepIds.add(existing.id);
        } else {
          const info = insertFinalist.run(qualifier.name, finalsOrder, 'finals', qualifier.id, qualifier.country || '', qualifier.image_url || '');
          keepIds.add(info.lastInsertRowid);
        }
      });

      existingFinalists.forEach(finalist => {
        if (!keepIds.has(finalist.id)) {
          deleteScores.run(finalist.id);
          db.prepare('DELETE FROM run_times WHERE athlete_id = ?').run(finalist.id);
          deleteFinalist.run(finalist.id);
        }
      });
    })();
  },

  setCurrentRound: (round) => {
    const activeRound = normalizeRound(round);
    if (activeRound === 'finals') {
      module.exports.syncFinalists(module.exports.getFinalistsCount());
    }
    module.exports.updateConfig({ currentRound: activeRound });
  },

  getConfig: () => {
    const rows = db.prepare('SELECT key, value FROM config').all();
    const config = {};
    rows.forEach(r => { config[r.key] = r.value; });
    return Object.keys(config).length > 0 ? config : {
      tvScrollMode: 'continuous',
      scoringFormula: 'sum',
      appName: 'LineScore',
      appIconUrl: '/favicon.ico',
      currentRound: 'qualification',
      finalistsCount: '5',
      timeJudgeId: '',
      timeMinSeconds: '15',
      timeMaxSeconds: '45',
      timeDeductionPoints: '0'
    };
  },

  updateConfig: (newConfig) => {
    db.transaction(() => {
      const updateStmt = db.prepare('INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
      for (const [key, value] of Object.entries(newConfig)) {
        updateStmt.run(key, value);
      }
    })();
  },

  getDatabasePath: () => dbPath,

  restoreDatabaseFromBuffer: (buffer) => {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new Error('No database file uploaded');
    }

    const uploadPath = path.join(dbDir, `database-upload-${Date.now()}.sqlite`);
    fs.writeFileSync(uploadPath, buffer);

    try {
      validateUploadedDatabase(uploadPath);
      const escapedPath = quoteSqlString(uploadPath);

      db.exec(`ATTACH DATABASE ${escapedPath} AS uploaded`);
      try {
        db.transaction(() => {
          const uploadedTables = db.prepare("SELECT name FROM uploaded.sqlite_master WHERE type = 'table'").all().map(row => row.name);

          copyUploadedTable('judges', ['id', 'username', 'pin']);
          copyUploadedTable('athletes', ['id', 'name', 'order_index', 'completed', 'round', 'source_athlete_id', 'country', 'image_url']);
          copyUploadedTable('scores', ['id', 'athlete_id', 'judge_id', 'score']);
          if (uploadedTables.includes('run_times')) {
            copyUploadedTable('run_times', ['id', 'athlete_id', 'judge_id', 'time_seconds']);
          } else {
            db.prepare('DELETE FROM run_times').run();
          }
          copyUploadedTable('config', ['key', 'value']);
          db.prepare(`DELETE FROM sqlite_sequence WHERE name IN (${managedTables.map(quoteSqlString).join(', ')})`).run();
        })();
      } finally {
        db.exec('DETACH DATABASE uploaded');
      }

      for (const [key, value] of [
        ['tvScrollMode', 'continuous'],
        ['scoringFormula', 'sum'],
        ['appName', 'LineScore'],
        ['appIconUrl', '/favicon.ico'],
        ['currentRound', 'qualification'],
        ['finalistsCount', '5'],
        ['timeJudgeId', ''],
        ['timeMinSeconds', '15'],
        ['timeMaxSeconds', '45'],
        ['timeDeductionPoints', '0']
      ]) {
        const exists = db.prepare('SELECT COUNT(*) as count FROM config WHERE key = ?').get(key);
        if (exists.count === 0) {
          db.prepare('INSERT INTO config (key, value) VALUES (?, ?)').run(key, value);
        }
      }
    } finally {
      if (fs.existsSync(uploadPath)) {
        fs.unlinkSync(uploadPath);
      }
    }
  }
};
