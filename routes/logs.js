const express = require('express');
const Log = require('../models/Log');
const Candidate = require('../models/Candidate');
const router = express.Router();

// POST /api/logs - Create a new log entry
router.post('/', async (req, res) => {
  try {
    const { candidateId, eventType, confidence, boundingBox, metadata, severity } = req.body;

    if (!candidateId || !eventType) {
      return res.status(400).json({ error: 'candidateId and eventType are required' });
    }

    const log = new Log({
      candidateId,
      eventType,
      confidence,
      boundingBox,
      metadata,
      severity
    });

    await log.save();

    // Update candidate statistics
    await updateCandidateStats(candidateId, eventType);

    res.status(201).json(log);
  } catch (error) {
    console.error('Error creating log:', error);
    res.status(500).json({ error: 'Failed to create log entry' });
  }
});

// GET /api/logs/:candidateId - Get logs for a specific candidate
router.get('/:candidateId', async (req, res) => {
  try {
    const { candidateId } = req.params;
    const { eventType, startTime, endTime, limit = 100 } = req.query;

    const query = { candidateId };
    
    if (eventType) {
      query.eventType = eventType;
    }
    
    if (startTime || endTime) {
      query.timestamp = {};
      if (startTime) query.timestamp.$gte = new Date(startTime);
      if (endTime) query.timestamp.$lte = new Date(endTime);
    }

    const logs = await Log.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.json(logs);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// GET /api/logs/stats/:candidateId - Get statistics for a candidate
router.get('/stats/:candidateId', async (req, res) => {
  try {
    const { candidateId } = req.params;
    const { startTime, endTime } = req.query;

    const matchQuery = { candidateId };
    if (startTime || endTime) {
      matchQuery.timestamp = {};
      if (startTime) matchQuery.timestamp.$gte = new Date(startTime);
      if (endTime) matchQuery.timestamp.$lte = new Date(endTime);
    }

    const stats = await Log.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 },
          avgConfidence: { $avg: '$confidence' },
          lastOccurrence: { $max: '$timestamp' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Helper function to update candidate statistics
async function updateCandidateStats(candidateId, eventType) {
  try {
    const candidate = await Candidate.findOne({ candidateId });
    if (!candidate) return;

    // Update focus lost count
    if (eventType === 'focus_lost') {
      candidate.focusLostCount += 1;
    }

    // Update suspicious events count
    const suspiciousEvents = [
      'phone_detected',
      'book_detected',
      'device_detected',
      'multiple_faces_detected',
      'eye_closure_detected',
      'audio_noise_detected'
    ];

    if (suspiciousEvents.includes(eventType)) {
      candidate.suspiciousEventsCount += 1;
    }

    // Recalculate integrity score
    candidate.calculateIntegrityScore();
    
    await candidate.save();
  } catch (error) {
    console.error('Error updating candidate stats:', error);
  }
}

module.exports = router;
