const express = require('express');
const Candidate = require('../models/Candidate');
const Log = require('../models/Log');
const router = express.Router();

// POST /api/candidates - Create a new candidate
router.post('/', async (req, res) => {
  try {
    const { candidateId, name, email, settings } = req.body;

    if (!candidateId || !name || !email) {
      return res.status(400).json({ error: 'candidateId, name, and email are required' });
    }

    const candidate = new Candidate({
      candidateId,
      name,
      email,
      settings
    });

    await candidate.save();

    // Log interview start
    const startLog = new Log({
      candidateId,
      eventType: 'interview_started',
      severity: 'low'
    });
    await startLog.save();

    res.status(201).json(candidate);
  } catch (error) {
    console.error('Error creating candidate:', error);
    if (error.code === 11000) {
      res.status(400).json({ error: 'Candidate ID already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create candidate' });
    }
  }
});

// GET /api/candidates/:candidateId - Get candidate details
router.get('/:candidateId', async (req, res) => {
  try {
    const candidate = await Candidate.findOne({ candidateId: req.params.candidateId });
    
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    res.json(candidate);
  } catch (error) {
    console.error('Error fetching candidate:', error);
    res.status(500).json({ error: 'Failed to fetch candidate' });
  }
});

// PUT /api/candidates/:candidateId - Update candidate
router.put('/:candidateId', async (req, res) => {
  try {
    const { candidateId } = req.params;
    const updates = req.body;

    const candidate = await Candidate.findOneAndUpdate(
      { candidateId },
      updates,
      { new: true, runValidators: true }
    );

    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    res.json(candidate);
  } catch (error) {
    console.error('Error updating candidate:', error);
    res.status(500).json({ error: 'Failed to update candidate' });
  }
});

// POST /api/candidates/:candidateId/end - End interview
router.post('/:candidateId/end', async (req, res) => {
  try {
    const { candidateId } = req.params;
    const candidate = await Candidate.findOne({ candidateId });

    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    candidate.interviewEndTime = new Date();
    candidate.status = 'completed';
    candidate.totalDuration = Math.floor((candidate.interviewEndTime - candidate.interviewStartTime) / 1000);
    
    // Recalculate integrity score
    candidate.calculateIntegrityScore();
    
    await candidate.save();

    // Log interview end
    const endLog = new Log({
      candidateId,
      eventType: 'interview_ended',
      severity: 'low'
    });
    await endLog.save();

    res.json(candidate);
  } catch (error) {
    console.error('Error ending interview:', error);
    res.status(500).json({ error: 'Failed to end interview' });
  }
});

// GET /api/candidates - Get all candidates
router.get('/', async (req, res) => {
  try {
    const { status, limit = 50, skip = 0 } = req.query;
    
    const query = {};
    if (status) query.status = status;

    const candidates = await Candidate.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    res.json(candidates);
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({ error: 'Failed to fetch candidates' });
  }
});

module.exports = router;
