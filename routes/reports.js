const express = require('express');
const PDFDocument = require('pdfkit');
const Candidate = require('../models/Candidate');
const Log = require('../models/Log');
const moment = require('moment');
const router = express.Router();

// GET /api/reports/:candidateId - Generate report for a candidate
router.get('/:candidateId', async (req, res) => {
  try {
    const { candidateId } = req.params;
    const { format = 'json' } = req.query;

    const candidate = await Candidate.findOne({ candidateId });
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    // Get all logs for the candidate
    const logs = await Log.find({ candidateId })
      .sort({ timestamp: 1 });

    // Calculate statistics
    const stats = calculateReportStats(logs, candidate);

    // Calculate current duration (either from stored value or current time)
    const currentTime = new Date();
    const endTime = candidate.interviewEndTime || currentTime;
    const duration = candidate.totalDuration || Math.floor((endTime - candidate.interviewStartTime) / 1000);

    const report = {
      candidate: {
        candidateId: candidate.candidateId,
        name: candidate.name,
        email: candidate.email,
        interviewStartTime: candidate.interviewStartTime,
        interviewEndTime: candidate.interviewEndTime || currentTime,
        totalDuration: duration,
        status: candidate.status
      },
      statistics: stats,
      events: logs.map(log => ({
        eventType: log.eventType,
        timestamp: log.timestamp,
        confidence: log.confidence,
        severity: log.severity,
        boundingBox: log.boundingBox,
        metadata: log.metadata
      })),
      generatedAt: new Date().toISOString()
    };

    if (format === 'pdf') {
      const pdfBuffer = await generatePDFReport(report);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="proctoring-report-${candidateId}.pdf"`);
      res.send(pdfBuffer);
    } else {
      res.json(report);
    }
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Helper function to calculate report statistics
function calculateReportStats(logs, candidate) {
  const stats = {
    totalEvents: logs.length,
    focusLostCount: 0,
    suspiciousEventsCount: 0,
    eventTypeBreakdown: {},
    timeBasedAnalysis: {
      firstHour: { events: 0, focusLost: 0, suspicious: 0 },
      secondHour: { events: 0, focusLost: 0, suspicious: 0 },
      thirdHour: { events: 0, focusLost: 0, suspicious: 0 },
      beyond: { events: 0, focusLost: 0, suspicious: 0 }
    },
    integrityScore: candidate.integrityScore,
    riskLevel: 'low'
  };

  logs.forEach(log => {
    // Count by event type
    stats.eventTypeBreakdown[log.eventType] = (stats.eventTypeBreakdown[log.eventType] || 0) + 1;

    // Count focus lost events
    if (log.eventType === 'focus_lost') {
      stats.focusLostCount++;
    }

    // Count suspicious events
    const suspiciousEvents = [
      'phone_detected', 'book_detected', 'device_detected',
      'multiple_faces_detected', 'eye_closure_detected', 'audio_noise_detected'
    ];
    if (suspiciousEvents.includes(log.eventType)) {
      stats.suspiciousEventsCount++;
    }

    // Time-based analysis
    const interviewDuration = candidate.totalDuration || 0;
    const eventTime = (new Date(log.timestamp) - new Date(candidate.interviewStartTime)) / 1000;
    
    if (eventTime <= 3600) { // First hour
      stats.timeBasedAnalysis.firstHour.events++;
      if (log.eventType === 'focus_lost') stats.timeBasedAnalysis.firstHour.focusLost++;
      if (suspiciousEvents.includes(log.eventType)) stats.timeBasedAnalysis.firstHour.suspicious++;
    } else if (eventTime <= 7200) { // Second hour
      stats.timeBasedAnalysis.secondHour.events++;
      if (log.eventType === 'focus_lost') stats.timeBasedAnalysis.secondHour.focusLost++;
      if (suspiciousEvents.includes(log.eventType)) stats.timeBasedAnalysis.secondHour.suspicious++;
    } else if (eventTime <= 10800) { // Third hour
      stats.timeBasedAnalysis.thirdHour.events++;
      if (log.eventType === 'focus_lost') stats.timeBasedAnalysis.thirdHour.focusLost++;
      if (suspiciousEvents.includes(log.eventType)) stats.timeBasedAnalysis.thirdHour.suspicious++;
    } else { // Beyond third hour
      stats.timeBasedAnalysis.beyond.events++;
      if (log.eventType === 'focus_lost') stats.timeBasedAnalysis.beyond.focusLost++;
      if (suspiciousEvents.includes(log.eventType)) stats.timeBasedAnalysis.beyond.suspicious++;
    }
  });

  // Determine risk level
  if (candidate.integrityScore >= 90) stats.riskLevel = 'low';
  else if (candidate.integrityScore >= 70) stats.riskLevel = 'medium';
  else if (candidate.integrityScore >= 50) stats.riskLevel = 'high';
  else stats.riskLevel = 'critical';

  return stats;
}

// Helper function to generate PDF report
async function generatePDFReport(report) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Header
      doc.fontSize(20).text('Proctoring Report', 50, 50);
      doc.fontSize(12).text(`Generated: ${moment().format('YYYY-MM-DD HH:mm:ss')}`, 50, 80);

      // Candidate Information
      doc.fontSize(16).text('Candidate Information', 50, 120);
      // Format duration
      const durationMinutes = Math.floor(report.candidate.totalDuration / 60);
      const durationSeconds = report.candidate.totalDuration % 60;
      const durationText = durationMinutes > 0 
        ? `${durationMinutes}m ${durationSeconds}s` 
        : `${durationSeconds}s`;

      doc.fontSize(10)
        .text(`Name: ${report.candidate.name}`, 50, 150)
        .text(`Email: ${report.candidate.email}`, 50, 170)
        .text(`Interview Duration: ${durationText}`, 50, 190)
        .text(`Status: ${report.candidate.status}`, 50, 210)
        .text(`Integrity Score: ${report.statistics.integrityScore}/100`, 50, 230)
        .text(`Risk Level: ${report.statistics.riskLevel.toUpperCase()}`, 50, 250);

      // Statistics
      doc.fontSize(16).text('Statistics', 50, 290);
      doc.fontSize(10)
        .text(`Total Events: ${report.statistics.totalEvents}`, 50, 320)
        .text(`Focus Lost Count: ${report.statistics.focusLostCount}`, 50, 340)
        .text(`Suspicious Events: ${report.statistics.suspiciousEventsCount}`, 50, 360);

      // Event Type Breakdown
      doc.fontSize(14).text('Event Type Breakdown', 50, 400);
      let yPos = 430;
      Object.entries(report.statistics.eventTypeBreakdown).forEach(([eventType, count]) => {
        doc.fontSize(10).text(`${eventType}: ${count}`, 50, yPos);
        yPos += 20;
      });

      // Time-based Analysis
      doc.fontSize(14).text('Time-based Analysis', 50, yPos + 20);
      yPos += 50;
      Object.entries(report.statistics.timeBasedAnalysis).forEach(([period, data]) => {
        doc.fontSize(10).text(`${period}: ${data.events} events (${data.focusLost} focus lost, ${data.suspicious} suspicious)`, 50, yPos);
        yPos += 20;
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = router;
