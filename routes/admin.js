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

// Admin Add Athlete
router.post('/add-athlete', (req, res) => {
  const { name } = req.body;
  if (!name || name.trim() === '') return res.status(400).json({ error: 'Name required' });

  const id = db.addAthlete(name);
  broadcastUpdate(req);
  res.json({ success: true, id });
});

// Admin Remove Athlete
router.delete('/remove-athlete/:id', (req, res) => {
  const { id } = req.params;
  db.removeAthlete(id);
  broadcastUpdate(req);
  res.json({ success: true });
});

// Admin Reorder Athletes Bulk
router.put('/reorder-athletes', (req, res) => {
  const { orders } = req.body;
  if (!orders || !Array.isArray(orders)) {
    return res.status(400).json({ error: 'orders array required' });
  }
  db.reorderAthletes(orders);
  broadcastUpdate(req);
  res.json({ success: true });
});

// Admin Reset Competition
router.post('/reset', (req, res) => {
  db.resetCompetition(); // Clears completely
  broadcastUpdate(req);
  res.json({ success: true });
});

// Admin Load Preset
router.post('/load-preset', (req, res) => {
  db.loadPreset();
  broadcastUpdate(req);
  res.json({ success: true });
});

// Admin Update Config
router.put('/config', (req, res) => {
    const { tvScrollMode } = req.body;
    if (tvScrollMode && ['continuous', 'active'].includes(tvScrollMode)) {
        db.updateConfig({ tvScrollMode });
        broadcastUpdate(req);
        return res.json({ success: true });
    }
    res.status(400).json({ error: 'Invalid config settings' });
});

// Admin Manage Judges Endpoints
router.get('/judges', (req, res) => {
  res.json(db.getJudges());
});

router.post('/add-judge', (req, res) => {
  const { username, pin } = req.body;
  if (!username || !pin) return res.status(400).json({ error: 'Username and PIN required' });
  const id = db.addJudge(username, pin);
  broadcastUpdate(req);
  res.json({ success: true, id });
});

router.delete('/remove-judge/:id', (req, res) => {
  const { id } = req.params;
  db.removeJudge(id);
  broadcastUpdate(req);
  res.json({ success: true });
});

// Admin Update Athlete Endpoint (Update name and/or order_index)
router.put('/update-athlete/:id', (req, res) => {
  const { id } = req.params;
  const { name, order_index } = req.body;
  db.updateAthlete(id, name, order_index);
  broadcastUpdate(req);
  res.json({ success: true });
});

// Admin Update Judge Endpoint (Update name and pin)
router.put('/update-judge/:id', (req, res) => {
  const { id } = req.params;
  const { username, pin } = req.body;
  db.updateJudge(id, username, pin);
  broadcastUpdate(req);
  res.json({ success: true });
});

module.exports = router;
