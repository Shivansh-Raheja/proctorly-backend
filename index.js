const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://localhost:3000',
    // Add your frontend domain here after deployment
    // 'https://your-frontend-domain.vercel.app'
  ],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting - Disabled in development mode
const limiter = process.env.NODE_ENV === 'production' 
  ? rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // 1000 requests per 15 minutes
      message: {
        error: 'Too many requests, please try again later',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
    })
  : (req, res, next) => next(); // No rate limiting in development

app.use('/api/', limiter);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/proctorly');

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

// More specific rate limiting for different endpoints - Disabled in development
const reportLimiter = process.env.NODE_ENV === 'production'
  ? rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 50, // 50 report downloads per 15 minutes
      message: {
        error: 'Too many report requests, please try again later',
        retryAfter: '15 minutes'
      }
    })
  : (req, res, next) => next(); // No rate limiting in development

const uploadLimiter = process.env.NODE_ENV === 'production'
  ? rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 20, // 20 uploads per 15 minutes
      message: {
        error: 'Too many upload requests, please try again later',
        retryAfter: '15 minutes'
      }
    })
  : (req, res, next) => next(); // No rate limiting in development

// Routes with specific rate limiting
app.use('/api/logs', limiter, require('./routes/logs'));
app.use('/api/reports', reportLimiter, require('./routes/reports'));
app.use('/api/candidates', limiter, require('./routes/candidates'));
app.use('/api/upload', uploadLimiter, require('./routes/upload'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Development endpoint to check rate limit status
app.get('/api/rate-limit-status', (req, res) => {
  res.json({ 
    environment: process.env.NODE_ENV,
    rateLimitingEnabled: process.env.NODE_ENV === 'production',
    message: process.env.NODE_ENV === 'development' 
      ? 'Rate limiting is disabled in development mode' 
      : 'Rate limiting is enabled in production mode'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
