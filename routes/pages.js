const express = require('express');
const path = require('path');
const router = express.Router();

// Default to index.html for root
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Serve frontend pages for nice URLs
router.get('/judge', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'judge.html'));
});

router.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

module.exports = router;
