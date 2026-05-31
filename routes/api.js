const express = require('express');
const router = express.Router();
const db = require('../db');
const { validate, asyncHandler } = require('../middlewares/validation');
const { validateLicenseKey } = require('../utils/license');

// Helper to broadcast state update
const broadcastUpdate = (req) => {
  const io = req.app.get('io');
  if (io) {
    io.emit('state-update');
  }
};

// Global license lockdown middleware for api endpoints
const requireLicense = (req, res, next) => {
  // Always allow config and login endpoints (login is checked inside for admin/judge distinction)
  if (req.path === '/config' || req.path === '/login') {
    return next();
  }

  const config = db.getConfig();
  const licenseInfo = validateLicenseKey(config.licenseKey);
  if (!licenseInfo.isLicensed) {
    return res.status(402).json({ error: 'License Required. Please activate in the Admin Panel.' });
  }
  next();
};

router.use(requireLicense);

// Login Judge or Admin
router.post('/login', validate({
  body: {
    username: { required: true },
    pin: { required: true }
  }
}), asyncHandler((req, res) => {
  const { username, pin } = req.body;
  const adminPassword = req.app.get('ADMIN_PASSWORD');
  
  if (username && username.toLowerCase() === 'admin' && pin === adminPassword) {
    return res.json({ success: true, role: 'admin' });
  }

  // Block judge logins if the application is not licensed
  const config = db.getConfig();
  const licenseInfo = validateLicenseKey(config.licenseKey);
  if (!licenseInfo.isLicensed) {
    return res.status(402).json({ error: 'License Required. Judge logins are currently disabled.' });
  }

  const judge = db.getJudgeByLogin(username, pin);
  if (judge) {
    return res.json({ success: true, role: 'judge', id: judge.id, username: judge.username });
  }

  res.status(401).json({ error: 'Invalid username or PIN' });
}));

// Get Current Athlete (Pending / Active)
router.get('/current-athlete', asyncHandler((req, res) => {
  const athletes = db.getAthletes();
  const active = athletes.find(a => a.completed === 0);
  
  if (!active) {
    return res.json({ message: 'No active athletes' });
  }

  // Get submitted judge IDs for this athlete
  const scores = db.getScoresForAthlete(active.id);
  const submittedJudgeIds = scores.map(s => s.judge_id);
  res.json({ ...active, submittedJudgeIds });
}));

// Submit/Update Score
const handleScoreSubmit = asyncHandler((req, res) => {
  const { athleteId, judgeId, score } = req.body;
  db.submitScore(athleteId, judgeId, score);
  broadcastUpdate(req);
  res.json({ success: true });
});

router.post('/submit-score', validate({
  body: {
    athleteId: { required: true, type: 'number' },
    judgeId: { required: true, type: 'number' },
    score: { required: true, type: 'number' }
  }
}), handleScoreSubmit);

router.put('/update-score', validate({
  body: {
    athleteId: { required: true, type: 'number' },
    judgeId: { required: true, type: 'number' },
    score: { required: true, type: 'number' }
  }
}), handleScoreSubmit);

// Get My Score for specific athlete
router.get('/scores/:athleteId/:judgeId', validate({
  params: {
    athleteId: { required: true, type: 'number' },
    judgeId: { required: true, type: 'number' }
  }
}), asyncHandler((req, res) => {
    const { athleteId, judgeId } = req.params;
    const scoreObj = db.getScore(athleteId, judgeId);
    res.json(scoreObj || { score: null });
}));

// Get Leaderboard (calculated dynamically)
router.get('/leaderboard', asyncHandler((req, res) => {
  const leaderboard = db.getLeaderboard(req.query.round);
  res.json(leaderboard);
}));

// Get all athletes (for admin and judge past athletes view)
router.get('/athletes', asyncHandler((req, res) => {
  const athletes = db.getAthletes(req.query.round);
  const sorted = [...athletes].sort((a,b) => a.order_index - b.order_index);
  res.json(sorted);
}));

// Config Settings
router.get('/config', asyncHandler((req, res) => {
    const judges = db.getJudges();
    const config = db.getConfig();
    
    const licenseInfo = validateLicenseKey(config.licenseKey);

    res.json({ 
        numJudges: judges.length,
        ...config,
        isLicensed: licenseInfo.isLicensed,
        licensee: licenseInfo.companyName || null,
        expiresAt: licenseInfo.expiresAt || null,
        licenseError: licenseInfo.error || null
    });
}));

module.exports = router;
