# Proctorly Backend

AI-powered video proctoring system backend API.

## Environment Variables

- `PORT`: Server port (default: 5000)
- `MONGODB_URI`: MongoDB connection string
- `NODE_ENV`: Environment (development/production)

## API Endpoints

- `GET /api/health` - Health check
- `POST /api/candidates` - Create candidate
- `GET /api/reports/:candidateId` - Generate report
- `POST /api/logs` - Log detection events

## Deployment

This backend is designed to be deployed on Render.com with the following configuration:

- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Node Version**: 18+

## Features

- Real-time detection logging
- PDF report generation
- Video upload handling
- Rate limiting (production)
- CORS configuration
