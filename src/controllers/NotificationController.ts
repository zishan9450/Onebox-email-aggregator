import { Request, Response } from 'express';
import { NotificationService } from '../services/NotificationService';
import { APIResponse } from '../types';
import { logger } from '../utils/logger';

export class NotificationController {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  async testSlackConnection(req: Request, res: Response): Promise<void> {
    try {
      const isConnected = await this.notificationService.testSlackConnection();
      
      const response: APIResponse = {
        success: isConnected,
        message: isConnected ? 'Slack connection successful' : 'Slack connection failed',
        data: { connected: isConnected }
      };
      
      res.json(response);
    } catch (error) {
      logger.error('❌ Error testing Slack connection:', error);
      const response: APIResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
      res.status(500).json(response);
    }
  }

  async testWebhookConnection(req: Request, res: Response): Promise<void> {
    try {
      const isConnected = await this.notificationService.testWebhookConnection();
      
      const response: APIResponse = {
        success: isConnected,
        message: isConnected ? 'Webhook connection successful' : 'Webhook connection failed',
        data: { connected: isConnected }
      };
      
      res.json(response);
    } catch (error) {
      logger.error('❌ Error testing webhook connection:', error);
      const response: APIResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
      res.status(500).json(response);
    }
  }

  async sendTestSlackNotification(req: Request, res: Response): Promise<void> {
    try {
      await this.notificationService.sendSlackNotification({
        channel: process.env.SLACK_CHANNEL_ID || '#general',
        text: '🧪 Test notification from OneBox Email Aggregator',
        attachments: [{
          color: 'good',
          fields: [
            { title: 'Test', value: 'This is a test notification', short: true },
            { title: 'Timestamp', value: new Date().toISOString(), short: true }
          ]
        }]
      });
      
      const response: APIResponse = {
        success: true,
        message: 'Test Slack notification sent successfully'
      };
      
      res.json(response);
    } catch (error) {
      logger.error('❌ Error sending test Slack notification:', error);
      const response: APIResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
      res.status(500).json(response);
    }
  }

  async sendTestWebhook(req: Request, res: Response): Promise<void> {
    try {
      await this.notificationService.sendWebhook({
        event: 'test',
        data: { 
          message: 'Test webhook from OneBox Email Aggregator',
          timestamp: new Date().toISOString()
        },
        timestamp: new Date()
      });
      
      const response: APIResponse = {
        success: true,
        message: 'Test webhook sent successfully'
      };
      
      res.json(response);
    } catch (error) {
      logger.error('❌ Error sending test webhook:', error);
      const response: APIResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
      res.status(500).json(response);
    }
  }

  async sendInterestedEmailNotification(req: Request, res: Response): Promise<void> {
    try {
      // Simulate an interested email notification
      await this.notificationService.sendSlackNotification({
        channel: process.env.SLACK_CHANNEL_ID || '#general',
        text: '🎯 New interested email from test@example.com: Test Subject',
        attachments: [{
          color: 'good',
          fields: [
            { title: 'From', value: 'test@example.com', short: true },
            { title: 'Subject', value: 'Test Subject', short: true },
            { title: 'Category', value: 'interested', short: true },
            { title: 'Timestamp', value: new Date().toISOString(), short: true }
          ]
        }]
      });

      await this.notificationService.sendWebhook({
        event: 'email.interested',
        data: {
          emailId: 'test-email-id',
          from: 'test@example.com',
          subject: 'Test Subject',
          category: 'interested',
          timestamp: new Date().toISOString()
        },
        timestamp: new Date()
      });
      
      const response: APIResponse = {
        success: true,
        message: 'Interested email notification sent successfully'
      };
      
      res.json(response);
    } catch (error) {
      logger.error('❌ Error sending interested email notification:', error);
      const response: APIResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
      res.status(500).json(response);
    }
  }
}
