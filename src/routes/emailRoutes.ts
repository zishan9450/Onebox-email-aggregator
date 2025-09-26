import { Router } from 'express';
import { EmailController } from '../controllers/EmailController';
import { ElasticsearchService } from '../services/ElasticsearchService';
import { AIService } from '../services/AIService';
import { RAGService } from '../services/RAGService';

const router = Router();

// Initialize services and controller
const elasticsearchService = new ElasticsearchService();
const aiService = new AIService();
const ragService = new RAGService(aiService);
const emailController = new EmailController(elasticsearchService, aiService, ragService);

// Email routes - specific routes first
router.get('/search', (req, res) => emailController.searchEmails(req, res));
router.get('/stats', (req, res) => emailController.getEmailStats(req, res));
router.delete('/clear-all', (req, res) => emailController.deleteAllEmails(req, res));

// AI-powered routes - specific routes first
router.post('/batch-categorize', (req, res) => emailController.batchCategorizeEmails(req, res));
router.post('/recategorize-all', (req, res) => emailController.recategorizeAllEmails(req, res));

// Parameterized routes last
router.get('/:id', (req, res) => emailController.getEmailById(req, res));
router.put('/:id', (req, res) => emailController.updateEmail(req, res));
router.delete('/:id', (req, res) => emailController.deleteEmail(req, res));
router.post('/:id/categorize', (req, res) => emailController.categorizeEmail(req, res));
router.post('/:id/suggest-reply', (req, res) => emailController.generateSuggestedReply(req, res));

export default router;
