import { Router } from 'express';
import { NotificationController } from '../controllers/NotificationController';

const router = Router();
const notificationController = new NotificationController();

// Test endpoints
router.get('/test-slack', (req, res) => notificationController.testSlackConnection(req, res));
router.get('/test-webhook', (req, res) => notificationController.testWebhookConnection(req, res));
router.post('/test-slack', (req, res) => notificationController.sendTestSlackNotification(req, res));
router.post('/test-webhook', (req, res) => notificationController.sendTestWebhook(req, res));
router.post('/test-interested', (req, res) => notificationController.sendInterestedEmailNotification(req, res));

export default router;
