import { Router } from 'express';
import emailRoutes from './emailRoutes';
import accountRoutes from './accountRoutes';
import notificationRoutes from './notificationRoutes';

const router = Router();

// API routes
router.use('/emails', emailRoutes);
router.use('/accounts', accountRoutes);
router.use('/notifications', notificationRoutes);

// Health check route
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'OneBox Email Aggregator API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

export default router;
