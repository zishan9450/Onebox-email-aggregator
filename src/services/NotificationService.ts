import { WebClient } from '@slack/web-api';
import axios from 'axios';
import { SlackNotification, WebhookPayload } from '../types';
import { logger } from '../utils/logger';

export class NotificationService {
  private slackClient: WebClient;
  private webhookUrl: string;

  constructor() {
    this.slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
    this.webhookUrl = process.env.WEBHOOK_URL || 'https://webhook.site/your-unique-url';
  }

  async sendSlackNotification(notification: SlackNotification): Promise<void> {
    try {
      if (!process.env.SLACK_BOT_TOKEN) {
        logger.warn('⚠️ Slack bot token not configured, skipping notification');
        return;
      }

      const result = await this.slackClient.chat.postMessage({
        channel: notification.channel,
        text: notification.text,
        attachments: notification.attachments,
        username: 'OneBox Email Bot',
        icon_emoji: ':email:'
      });

      if (result.ok) {
        logger.info(`✅ Slack notification sent to ${notification.channel}`);
      } else {
        logger.error(`❌ Failed to send Slack notification: ${result.error}`);
      }
    } catch (error) {
      logger.error('❌ Error sending Slack notification:', error);
    }
  }

  async sendWebhook(payload: WebhookPayload): Promise<void> {
    try {
      if (!this.webhookUrl || this.webhookUrl.includes('your-unique-url')) {
        logger.warn('⚠️ Webhook URL not configured, skipping webhook');
        return;
      }

      const response = await axios.post(this.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'OneBox-Email-Aggregator/1.0'
        },
        timeout: 10000
      });

      if (response.status >= 200 && response.status < 300) {
        logger.info(`✅ Webhook sent successfully: ${payload.event}`);
      } else {
        logger.error(`❌ Webhook failed with status: ${response.status}`);
      }
    } catch (error) {
      logger.error('❌ Error sending webhook:', error);
    }
  }

  async sendBulkSlackNotifications(notifications: SlackNotification[]): Promise<void> {
    const promises = notifications.map(notification => 
      this.sendSlackNotification(notification).catch(error => {
        logger.error(`❌ Failed to send notification to ${notification.channel}:`, error);
      })
    );

    await Promise.all(promises);
    logger.info(`✅ Sent ${notifications.length} Slack notifications`);
  }

  async sendBulkWebhooks(payloads: WebhookPayload[]): Promise<void> {
    const promises = payloads.map(payload => 
      this.sendWebhook(payload).catch(error => {
        logger.error(`❌ Failed to send webhook for ${payload.event}:`, error);
      })
    );

    await Promise.all(promises);
    logger.info(`✅ Sent ${payloads.length} webhooks`);
  }

  async testSlackConnection(): Promise<boolean> {
    try {
      if (!process.env.SLACK_BOT_TOKEN) {
        return false;
      }

      const result = await this.slackClient.auth.test();
      return result.ok || false;
    } catch (error) {
      logger.error('❌ Slack connection test failed:', error);
      return false;
    }
  }

  async testWebhookConnection(): Promise<boolean> {
    try {
      if (!this.webhookUrl || this.webhookUrl.includes('your-unique-url')) {
        return false;
      }

      const testPayload: WebhookPayload = {
        event: 'test',
        data: { message: 'OneBox connection test' },
        timestamp: new Date()
      };

      const response = await axios.post(this.webhookUrl, testPayload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'OneBox-Email-Aggregator/1.0'
        },
        timeout: 5000
      });

      return response.status >= 200 && response.status < 300;
    } catch (error) {
      logger.error('❌ Webhook connection test failed:', error);
      return false;
    }
  }

  async sendEmailSummary(accountId: string, summary: any): Promise<void> {
    const notification: SlackNotification = {
      channel: process.env.SLACK_CHANNEL_ID || '#general',
      text: `📊 Daily Email Summary for Account ${accountId}`,
      attachments: [{
        color: 'good',
        fields: [
          { title: 'Total Emails', value: summary.total.toString(), short: true },
          { title: 'New Emails', value: summary.new.toString(), short: true },
          { title: 'Interested', value: summary.interested.toString(), short: true },
          { title: 'Unread', value: summary.unread.toString(), short: true }
        ]
      }]
    };

    await this.sendSlackNotification(notification);
  }

  async sendErrorAlert(error: string, context?: any): Promise<void> {
    const notification: SlackNotification = {
      channel: process.env.SLACK_CHANNEL_ID || '#general',
      text: `🚨 OneBox Error Alert`,
      attachments: [{
        color: 'danger',
        fields: [
          { title: 'Error', value: error, short: false },
          { title: 'Context', value: JSON.stringify(context, null, 2), short: false },
          { title: 'Timestamp', value: new Date().toISOString(), short: true }
        ]
      }]
    };

    await this.sendSlackNotification(notification);
  }
}
