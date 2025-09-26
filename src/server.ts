import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import routes from './routes';
import { logger } from './utils/logger';
import { sequelize } from './config/database';
import { createEmailIndex, waitForElasticsearch } from './config/elasticsearch';
import { EmailAccount } from './models';
import { IMAPService } from './services/IMAPService';
import { AIService } from './services/AIService';
import { ElasticsearchService } from './services/ElasticsearchService';
import { NotificationService } from './services/NotificationService';
import { RAGService } from './services/RAGService';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Initialize services
const aiService = new AIService();
const elasticsearchService = new ElasticsearchService();
const notificationService = new NotificationService();
const ragService = new RAGService(aiService);
const imapService = new IMAPService(aiService, elasticsearchService, notificationService, ragService);

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// API routes
app.use('/api', routes);

// Serve static files (for frontend)
app.use(express.static('public'));

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`🔌 Client connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    logger.info(`🔌 Client disconnected: ${socket.id}`);
  });
  
  // Join room for real-time email updates
  socket.on('join-account', (accountId: string) => {
    socket.join(`account-${accountId}`);
    logger.info(`📧 Client ${socket.id} joined account room: ${accountId}`);
  });
  
  socket.on('leave-account', (accountId: string) => {
    socket.leave(`account-${accountId}`);
    logger.info(`📧 Client ${socket.id} left account room: ${accountId}`);
  });
});

// Make socket.io available to services
imapService.on('newEmail', (email) => {
  io.to(`account-${email.accountId}`).emit('newEmail', email);
  io.emit('emailUpdate', { type: 'new', email });
});

imapService.on('connected', (accountId) => {
  io.emit('accountStatus', { accountId, status: 'connected' });
});

imapService.on('disconnected', (accountId) => {
  io.emit('accountStatus', { accountId, status: 'disconnected' });
});

imapService.on('error', (accountId, error) => {
  io.emit('accountError', { accountId, error: error.message });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('❌ Unhandled error:', err);
  
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Initialize database and services
async function initializeApp() {
  try {
    // Try to connect to database (optional in production)
    try {
      await sequelize.authenticate();
      logger.info('✅ Database connection established successfully');
      
      // Sync database models
      await sequelize.sync({ alter: true });
      logger.info('✅ Database models synchronized');
    } catch (dbError) {
      logger.warn('⚠️ Database connection failed, continuing without database:', dbError);
    }
    
    // Try to connect to Elasticsearch (optional in production)
    try {
      await waitForElasticsearch();
      await createEmailIndex();
      await elasticsearchService.refreshIndex();
      logger.info('✅ Elasticsearch connection established successfully');
    } catch (esError) {
      logger.warn('⚠️ Elasticsearch connection failed, continuing without search:', esError);
    }
    
    // Test notification services (optional)
    try {
      const slackConnected = await notificationService.testSlackConnection();
      const webhookConnected = await notificationService.testWebhookConnection();
      
      logger.info(`📱 Slack connection: ${slackConnected ? '✅' : '❌'}`);
      logger.info(`🔗 Webhook connection: ${webhookConnected ? '✅' : '❌'}`);
    } catch (notifError) {
      logger.warn('⚠️ Notification services not available:', notifError);
    }
    
    // Try to connect to existing email accounts (optional)
    try {
      const accounts = await EmailAccount.findAll({ where: { isActive: true } });
      logger.info(`📧 Found ${accounts.length} active email accounts`);
      
      for (const account of accounts) {
        try {
          await imapService.connectToAccount(account);
          logger.info(`✅ Connected to account: ${account.email}`);
        } catch (error) {
          logger.error(`❌ Failed to connect to account ${account.email}:`, error);
        }
      }
    } catch (accountError) {
      logger.warn('⚠️ Could not load email accounts:', accountError);
    }
    
    // Start server
    server.listen(PORT, () => {
      logger.info(`🚀 OneBox Email Aggregator server running on port ${PORT}`);
      logger.info(`📊 API available at: http://localhost:${PORT}/api`);
      logger.info(`🔌 WebSocket server running`);
    });
    
  } catch (error) {
    logger.error('❌ Failed to initialize application:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('🛑 SIGTERM received, shutting down gracefully');
  
  await imapService.disconnectAll();
  await sequelize.close();
  
  server.close(() => {
    logger.info('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('🛑 SIGINT received, shutting down gracefully');
  
  await imapService.disconnectAll();
  await sequelize.close();
  
  server.close(() => {
    logger.info('✅ Server closed');
    process.exit(0);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Initialize the application
initializeApp();
