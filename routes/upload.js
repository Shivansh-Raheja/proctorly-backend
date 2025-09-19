const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/videos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const { candidateId } = req.body;
    const timestamp = Date.now();
    const filename = `recording_${candidateId}_${timestamp}.webm`;
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'), false);
    }
  }
});

// POST /api/upload - Upload video recording
router.post('/', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const { candidateId } = req.body;
    if (!candidateId) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Candidate ID is required' });
    }

    const filePath = req.file.path;
    const fileSize = req.file.size;
    const originalName = req.file.originalname;

    // Update candidate record with video path
    const Candidate = require('../models/Candidate');
    await Candidate.findOneAndUpdate(
      { candidateId },
      { videoRecordingPath: filePath }
    );

    res.json({
      success: true,
      filePath: filePath,
      fileName: req.file.filename,
      fileSize: fileSize,
      candidateId: candidateId
    });
  } catch (error) {
    console.error('Upload error:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error('Failed to clean up file:', cleanupError);
      }
    }
    
    res.status(500).json({ error: 'Failed to upload video' });
  }
});

// GET /api/upload/:candidateId - Get video recording for candidate
router.get('/:candidateId', async (req, res) => {
  try {
    const { candidateId } = req.params;
    const Candidate = require('../models/Candidate');
    
    const candidate = await Candidate.findOne({ candidateId });
    if (!candidate || !candidate.videoRecordingPath) {
      return res.status(404).json({ error: 'Video recording not found' });
    }

    const filePath = candidate.videoRecordingPath;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Video file not found on disk' });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      // Handle range requests for video streaming
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/webm',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      // Serve entire file
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/webm',
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error) {
    console.error('Error serving video:', error);
    res.status(500).json({ error: 'Failed to serve video' });
  }
});

module.exports = router;
