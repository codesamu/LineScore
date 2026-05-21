const express = require('express');
const router = express.Router();
const db = require('../db');

// Helper to broadcast state update
const broadcastUpdate = (req) => {
  const io = req.app.get('io');
  if (io) {
    io.emit('state-update');
  }
};

// Login Judge or Admin
router.post('/login', (req, res) => {
  const { username, pin } = req.body;
  const adminPassword = req.app.get('ADMIN_PASSWORD');
  
  if (username && username.toLowerCase() === 'admin' && pin === adminPassword) {
    return res.json({ success: true, role: 'admin' });
  }

  const judge = db.getJudgeByLogin(username, pin);
  if (judge) {
    return res.json({ success: true, role: 'judge', id: judge.id, username: judge.username });
  }

  res.status(401).json({ error: 'Invalid username or PIN' });
});

// Get Current Athlete (Pending / Active)
router.get('/current-athlete', (req, res) => {
  const athletes = db.getAthletes();
  const active = athletes.find(a => a.completed === 0);
  
  if (!active) {
    return res.json({ message: 'No active athletes' });
  }

  // Get submitted judge IDs for this athlete
  const scores = db.getScoresForAthlete(active.id);
  const submittedJudgeIds = scores.map(s => s.judge_id);
  res.json({ ...active, submittedJudgeIds });
});

// Submit/Update Score
const handleScoreSubmit = (req, res) => {
  const { athleteId, judgeId, score } = req.body;
  
  if (score === undefined || score === null || isNaN(score)) {
    return res.status(400).json({ error: 'Invalid score' });
  }

  db.submitScore(athleteId, judgeId, score);
  broadcastUpdate(req);
  res.json({ success: true });
};

router.post('/submit-score', handleScoreSubmit);
router.put('/update-score', handleScoreSubmit);

// Get My Score for specific athlete
router.get('/scores/:athleteId/:judgeId', (req, res) => {
    const { athleteId, judgeId } = req.params;
    const scoreObj = db.getScore(athleteId, judgeId);
    res.json(scoreObj || { score: null });
});

// Get Leaderboard (calculated dynamically)
router.get('/leaderboard', (req, res) => {
  const leaderboard = db.getLeaderboard();
  res.json(leaderboard);
});

// Get all athletes (for admin and judge past athletes view)
router.get('/athletes', (req, res) => {
  const athletes = db.getAthletes();
  const sorted = [...athletes].sort((a,b) => a.order_index - b.order_index);
  res.json(sorted);
});

// Config Settings
router.get('/config', (req, res) => {
    const judges = db.getJudges();
    const config = db.getConfig();
    res.json({ 
        numJudges: judges.length,
        ...config
    });
});

module.exports = router;
