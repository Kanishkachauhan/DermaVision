// app.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { errorHandler, notFound } from './middleware/errorHandler.js';
import authRoutes    from './routes/authRoutes.js';
import analysisRoutes from './routes/analysisRoutes.js';
import doctorRoutes  from './routes/doctorRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import productRoutes from './routes/productRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import recommendationRoutes from './routes/recommendationRoutes.js';
import routineRoutes from './routes/routineRoutes.js';



const app = express();

app.use(helmet());
app.use(cors({
  origin: [
    process.env.CLIENT_URL || 'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
  ],
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));


app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'DermaVision API is running',
     timestamp: new Date() });
});
app.use('/api/auth',     authRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/doctors',  doctorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/products', productRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/routines', routineRoutes);


app.use(notFound);
app.use(errorHandler);

export default app;