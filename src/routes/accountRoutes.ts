import { Router } from 'express';
import { AccountController } from '../controllers/AccountController';
import { IMAPService } from '../services/IMAPService';
import { AIService } from '../services/AIService';
import { ElasticsearchService } from '../services/ElasticsearchService';
import { NotificationService } from '../services/NotificationService';
import { RAGService } from '../services/RAGService';

const router = Router();

// Initialize services and controller
const aiService = new AIService();
const elasticsearchService = new ElasticsearchService();
const notificationService = new NotificationService();
const ragService = new RAGService(aiService);
const imapService = new IMAPService(aiService, elasticsearchService, notificationService, ragService);
const accountController = new AccountController(imapService);

// Account routes
router.post('/', (req, res) => accountController.createAccount(req, res));
router.get('/', (req, res) => accountController.getAccounts(req, res));
router.get('/:id', (req, res) => accountController.getAccountById(req, res));
router.put('/:id', (req, res) => accountController.updateAccount(req, res));
router.delete('/:id', (req, res) => accountController.deleteAccount(req, res));

// Account management routes
router.post('/:id/test-connection', (req, res) => accountController.testConnection(req, res));
router.post('/:id/sync', (req, res) => accountController.syncEmails(req, res));
router.get('/:id/stats', (req, res) => accountController.getAccountStats(req, res));

export default router;
