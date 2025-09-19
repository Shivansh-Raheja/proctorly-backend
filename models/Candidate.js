const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
  candidateId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  interviewStartTime: {
    type: Date,
    default: Date.now
  },
  interviewEndTime: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'terminated'],
    default: 'active'
  },
  totalDuration: {
    type: Number, // in seconds
    default: 0
  },
  focusLostCount: {
    type: Number,
    default: 0
  },
  suspiciousEventsCount: {
    type: Number,
    default: 0
  },
  integrityScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 100
  },
  videoRecordingPath: {
    type: String
  },
  settings: {
    focusDetectionEnabled: {
      type: Boolean,
      default: true
    },
    objectDetectionEnabled: {
      type: Boolean,
      default: true
    },
    audioDetectionEnabled: {
      type: Boolean,
      default: true
    },
    eyeClosureDetectionEnabled: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// Calculate integrity score based on events
candidateSchema.methods.calculateIntegrityScore = function() {
  let score = 100;
  
  // Deduct points for focus lost events
  score -= this.focusLostCount * 2; // 2 points per focus lost event
  
  // Deduct points for suspicious events
  score -= this.suspiciousEventsCount * 5; // 5 points per suspicious event
  
  this.integrityScore = Math.max(score, 0); // Minimum 0
  return this.integrityScore;
};

module.exports = mongoose.model('Candidate', candidateSchema);
