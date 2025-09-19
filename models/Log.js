const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  candidateId: {
    type: String,
    required: true,
    index: true
  },
  eventType: {
    type: String,
    required: true,
    enum: [
      'focus_lost',
      'focus_regained',
      'no_face_detected',
      'multiple_faces_detected',
      'phone_detected',
      'book_detected',
      'device_detected',
      'eye_closure_detected',
      'audio_noise_detected',
      'interview_started',
      'interview_ended'
    ]
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1
  },
  boundingBox: {
    x: Number,
    y: Number,
    width: Number,
    height: Number
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  }
}, {
  timestamps: true
});

// Index for efficient querying
logSchema.index({ candidateId: 1, timestamp: -1 });
logSchema.index({ eventType: 1, timestamp: -1 });

module.exports = mongoose.model('Log', logSchema);
