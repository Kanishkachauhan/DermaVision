// app.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { errorHandler, notFound } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';


const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));


app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'DermaVision API is running',
     timestamp: new Date() });
});
app.use('/api/auth', authRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;