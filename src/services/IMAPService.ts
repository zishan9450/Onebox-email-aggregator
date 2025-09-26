import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { EventEmitter } from 'events';
import { EmailAccount, Email, EmailCategory } from '../types';
import { logger } from '../utils/logger';
import { AIService } from './AIService';
import { ElasticsearchService } from './ElasticsearchService';
import { NotificationService } from './NotificationService';
import { RAGService } from './RAGService';

export class IMAPService extends EventEmitter {
  private connections: Map<string, Imap> = new Map();
  private idleTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private isIdle: Map<string, boolean> = new Map();

  constructor(
    private aiService: AIService,
    private elasticsearchService: ElasticsearchService,
    private notificationService: NotificationService,
    private ragService: RAGService
  ) {
    super();
  }

  async connectToAccount(account: EmailAccount): Promise<void> {
    try {
      const imap = new Imap({
        user: account.email,
        password: account.password,
        host: account.imapHost,
        port: account.imapPort,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        keepalive: {
          interval: 10000,
          idleInterval: 300000,
          forceNoop: true
        },
        connTimeout: 60000, // 60 seconds connection timeout
        authTimeout: 30000 // 30 seconds authentication timeout
      });

      imap.once('ready', () => {
        logger.info(`✅ Connected to IMAP for account: ${account.email}`);
        this.connections.set(account.id, imap);
        
        // Fetch recent emails immediately after connection
        this.fetchNewEmails(account.id, 730); // Fetch last 2 years of emails to include 2024 emails
        
        // Start IDLE mode for real-time updates
        setTimeout(() => {
          this.startIdleMode(account.id);
        }, 2000); // Wait 2 seconds for initial fetch to complete
        
        this.emit('connected', account.id);
      });

      imap.once('error', (err: Error) => {
        logger.error(`❌ IMAP connection error for ${account.email}:`, err);
        this.emit('error', account.id, err);
      });

      imap.once('end', () => {
        logger.info(`🔌 IMAP connection ended for account: ${account.email}`);
        this.connections.delete(account.id);
        this.emit('disconnected', account.id);
      });

      imap.on('mail', () => {
        logger.info(`📧 New mail detected for account: ${account.email}`);
        this.handleNewMail(account.id);
      });

      imap.on('expunge', (seqno: number) => {
        logger.info(`🗑️ Email expunged for account: ${account.email}, seqno: ${seqno}`);
        this.emit('expunge', account.id, seqno);
      });

      imap.connect();
    } catch (error) {
      logger.error(`❌ Failed to connect to IMAP for ${account.email}:`, error);
      throw error;
    }
  }

  private startIdleMode(accountId: string): void {
    const imap = this.connections.get(accountId);
    if (!imap) return;

    try {
      imap.openBox('INBOX', true, (err: Error | null, box: any) => {
        if (err) {
          logger.error(`❌ Error opening INBOX for account ${accountId}:`, err);
          return;
        }

        logger.info(`📂 Opened INBOX for account ${accountId}, ${box.messages.total} messages`);
        
        // Start IDLE mode (if available)
        if (typeof (imap as any).idle === 'function') {
          (imap as any).idle();
          this.isIdle.set(accountId, true);
        } else {
          logger.warn(`IDLE mode not supported for account ${accountId}, using polling instead`);
          this.isIdle.set(accountId, false);
          
          // Set up polling for new emails every 30 seconds
          const pollTimeout = setTimeout(() => {
            this.pollForNewEmails(accountId);
          }, 30000);
          this.idleTimeouts.set(accountId, pollTimeout);
          return;
        }
        
        // Set up IDLE timeout to refresh connection
        const timeout = setTimeout(() => {
          this.refreshIdleMode(accountId);
        }, 300000); // 5 minutes
        
        this.idleTimeouts.set(accountId, timeout);
      });
    } catch (error) {
      logger.error(`❌ Error starting IDLE mode for account ${accountId}:`, error);
    }
  }

  private refreshIdleMode(accountId: string): void {
    const imap = this.connections.get(accountId);
    if (!imap || !this.isIdle.get(accountId)) return;

    try {
      imap.end();
      this.isIdle.set(accountId, false);
      
      // Reconnect after a short delay
      setTimeout(() => {
        this.reconnectAccount(accountId);
      }, 5000);
    } catch (error) {
      logger.error(`❌ Error refreshing IDLE mode for account ${accountId}:`, error);
    }
  }

  private async reconnectAccount(accountId: string): Promise<void> {
    // This would need the account details - in a real implementation,
    // you'd fetch this from the database
    logger.info(`🔄 Reconnecting account: ${accountId}`);
    // Implementation would fetch account and call connectToAccount
  }

  private async getAccountById(accountId: string): Promise<any> {
    try {
      const { EmailAccount } = await import('../models');
      const account = await EmailAccount.findByPk(accountId);
      return account;
    } catch (error) {
      logger.error(`❌ Error fetching account by ID:`, error);
      return null;
    }
  }

  private async pollForNewEmails(accountId: string, days: number = 7): Promise<void> {
    try {
      logger.info(`🔄 Polling for new emails for account ${accountId} (last ${days} days)`);
      
      // Create a new connection for polling
      const account = await this.getAccountById(accountId);
      if (!account) {
        logger.error(`❌ Account not found for polling: ${accountId}`);
        return;
      }

      // Create a temporary connection for fetching emails
      const tempImap = new Imap({
        user: account.email,
        password: account.password,
        host: account.imapHost,
        port: account.imapPort,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        connTimeout: 60000, // 60 seconds connection timeout
        authTimeout: 30000 // 30 seconds authentication timeout
      });

      await Promise.race([
        new Promise<void>((resolve, reject) => {
        tempImap.once('ready', () => {
          tempImap.openBox('INBOX', false, (err: Error | null, box: any) => {
            if (err) {
              logger.error(`❌ Error opening INBOX for polling:`, err);
              tempImap.end();
              reject(err);
              return;
            }

            logger.info(`📂 Opened INBOX for polling, ${box.messages.total} total messages`);

            // Get recent emails (last N days) for polling
            const sinceDate = new Date();
            sinceDate.setDate(sinceDate.getDate() - days);
            const dateString = sinceDate.toISOString().split('T')[0];
            const searchCriteria = ['ALL'];
            logger.info(`📅 Polling for all emails (will filter for last ${days} days)`);
            
            tempImap.search(searchCriteria, (err: Error | null, results: number[]) => {
              if (err) {
                logger.error(`❌ Error searching emails during polling:`, err);
                tempImap.end();
                reject(err);
                return;
              }

              if (!results || results.length === 0) {
                logger.info(`📭 No emails found during polling for account ${accountId}`);
                tempImap.end();
                resolve();
                return;
              }

              logger.info(`📧 Found ${results.length} emails during polling for account ${accountId}`);

              // Process emails in very small batches to prevent memory issues
              const emailsToProcess = results.slice(0, 10); // Process only 10 emails at a time
              const fetch = tempImap.fetch(emailsToProcess, { bodies: '', struct: true });
              let processedCount = 0;
              
              fetch.on('message', async (msg, seqno) => {
                let buffer = '';
                
                msg.on('body', (stream) => {
                  stream.on('data', (chunk) => {
                    buffer += chunk.toString('utf8');
                  });
                });

                msg.once('end', async () => {
                  try {
                    const parsed = await simpleParser(buffer);
                    await this.processEmail(accountId, parsed, days);
                    processedCount++;
                    logger.info(`✅ Processed email ${processedCount}/${emailsToProcess.length}: ${parsed.subject}`);
                  } catch (error) {
                    logger.error(`❌ Error parsing email during polling:`, error);
                  }
                });
              });

              fetch.once('error', (err: Error) => {
                logger.error(`❌ Error fetching emails during polling:`, err);
                tempImap.end();
                reject(err);
              });

              fetch.once('end', () => {
                logger.info(`✅ Finished polling emails for account ${accountId}, processed ${processedCount} emails`);
                tempImap.end();
                resolve();
              });
            });
          });
        });

        tempImap.once('error', (err: Error) => {
          logger.error(`❌ IMAP connection error during polling:`, err);
          reject(err);
        });

        tempImap.connect();
        }),
        new Promise<void>((_, reject) => {
          setTimeout(() => {
            reject(new Error('IMAP polling timeout after 60 seconds'));
          }, 60000); // 60 second timeout
        })
      ]);
      
      // Set up next poll
      const timeout = setTimeout(() => {
        this.pollForNewEmails(accountId, days);
      }, 60000); // Poll every 60 seconds
      
      this.idleTimeouts.set(accountId, timeout);
    } catch (error) {
      logger.error(`❌ Error polling for new emails for account ${accountId}:`, error);
      
      // Retry after a longer delay on error
      const timeout = setTimeout(() => {
        this.pollForNewEmails(accountId, days);
      }, 120000); // Retry every 2 minutes on error
      
      this.idleTimeouts.set(accountId, timeout);
    }
  }

  private async handleNewMail(accountId: string): Promise<void> {
    const imap = this.connections.get(accountId);
    if (!imap) return;

    try {
      // End IDLE mode to perform operations
      imap.end();
      this.isIdle.set(accountId, false);

      // Reconnect and fetch new emails
      await this.fetchNewEmails(accountId);
      
      // Restart IDLE mode
      setTimeout(() => {
        this.startIdleMode(accountId);
      }, 1000);
    } catch (error) {
      logger.error(`❌ Error handling new mail for account ${accountId}:`, error);
    }
  }

  async fetchNewEmails(accountId: string, days: number = 7): Promise<void> {
    const imap = this.connections.get(accountId);
    if (!imap) {
      logger.warn(`❌ No IMAP connection found for account ${accountId}`);
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        imap.openBox('INBOX', false, (err: Error | null, box: any) => {
          if (err) {
            logger.error(`❌ Error opening INBOX for fetching emails:`, err);
            reject(err);
            return;
          }

          logger.info(`📂 Opened INBOX for account ${accountId}, ${box.messages.total} total messages`);

            // Calculate date range for recent emails
            const sinceDate = new Date();
            sinceDate.setDate(sinceDate.getDate() - days);
            const dateString = sinceDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD
            
            // Use ALL search to avoid IMAP SINCE issues, we'll filter by date later
            const searchCriteria = ['ALL'];
            logger.info(`📅 Fetching all emails (will filter for last ${days} days)`);
          
          imap.search(searchCriteria, (err: Error | null, results: number[]) => {
            if (err) {
              logger.error(`❌ Error searching emails:`, err);
              reject(err);
              return;
            }

            if (!results || results.length === 0) {
              logger.info(`📭 No new emails found for account ${accountId} since ${dateString}`);
              resolve();
              return;
            }

            logger.info(`📧 Found ${results.length} emails for account ${accountId}`);

            // Process emails in very small batches to prevent memory issues
            const emailsToProcess = results.slice(0, 10); // Process only 10 emails at a time
            const fetch = imap.fetch(emailsToProcess, { bodies: '', struct: true });
            let processedCount = 0;
            
            fetch.on('message', (msg, seqno) => {
              let buffer = '';
              
              msg.on('body', (stream) => {
                stream.on('data', (chunk) => {
                  buffer += chunk.toString('utf8');
                });
              });

              msg.once('end', () => {
                // Process email with proper error handling
                simpleParser(buffer)
                  .then(async (parsed) => {
                    try {
                      await this.processEmail(accountId, parsed, days);
                      processedCount++;
                      logger.info(`✅ Processed email ${processedCount}/${emailsToProcess.length}: ${parsed.subject}`);
                      
                      // Force garbage collection every 5 emails to prevent memory buildup
                      if (processedCount % 5 === 0) {
                        if (global.gc) {
                          global.gc();
                        }
                      }
                    } catch (error) {
                      logger.error(`❌ Error processing email:`, error);
                      processedCount++;
                    }
                  })
                  .catch((error) => {
                    logger.error(`❌ Error parsing email:`, error);
                    processedCount++;
                  });
              });
            });

            fetch.once('error', (err: Error) => {
              logger.error(`❌ Error fetching emails:`, err);
              reject(err);
            });

            fetch.once('end', () => {
              logger.info(`✅ Finished fetching emails for account ${accountId}, processed ${processedCount} emails`);
              resolve();
            });
          });
        });
      } catch (error) {
        logger.error(`❌ Error in fetchNewEmails for account ${accountId}:`, error);
        reject(error);
      }
    });
  }

  private async processEmail(accountId: string, parsedEmail: any, days: number = 30): Promise<void> {
    try {
      // Check if email already exists
      const existingEmail = await this.elasticsearchService.findEmailByMessageId(parsedEmail.messageId);
      if (existingEmail) {
        logger.info(`📧 Email already exists: ${parsedEmail.messageId}`);
        return;
      }

      // Filter emails by date - process emails from the last 2 years to include 2024 emails
      const emailDate = new Date(parsedEmail.date);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 730); // 2 years = 730 days
      
      if (emailDate < cutoffDate) {
        logger.info(`📧 Email too old (${emailDate.toISOString()}), skipping: ${parsedEmail.subject}`);
        return;
      }

      logger.info(`📧 Processing email: ${parsedEmail.subject} (${parsedEmail.date})`);

      // Create email object
      const emailData: any = {
        accountId,
        messageId: parsedEmail.messageId,
        subject: parsedEmail.subject || 'No Subject',
        from: parsedEmail.from?.text || '',
        to: parsedEmail.to?.text ? [parsedEmail.to.text] : [],
        cc: parsedEmail.cc?.text ? [parsedEmail.cc.text] : undefined,
        bcc: parsedEmail.bcc?.text ? [parsedEmail.bcc.text] : undefined,
        date: parsedEmail.date || new Date(),
        body: parsedEmail.text || '',
        htmlBody: parsedEmail.html,
        folder: 'INBOX',
        isRead: false,
        isFlagged: false,
      };

      // AI categorization
      const aiCategory = await this.aiService.categorizeEmail(emailData);
      emailData.category = aiCategory.category;
      emailData.aiCategory = aiCategory.category;
      emailData.aiConfidence = aiCategory.confidence;

      // Generate suggested reply for interested emails
      if (aiCategory.category === 'interested') {
        try {
          const suggestedReply = await this.ragService.generateContextualReply(emailData);
          emailData.suggestedReply = suggestedReply;
          logger.info(`✅ Generated suggested reply for email: ${emailData.subject}`);
        } catch (error) {
          logger.error('❌ Error generating suggested reply during email processing:', error);
        }
      }

      // Store in database and Elasticsearch
      await this.elasticsearchService.indexEmail(emailData);

      // Send notifications for interested emails
      if (aiCategory.category === 'interested') {
        await this.notificationService.sendSlackNotification({
          channel: process.env.SLACK_CHANNEL_ID || '#general',
          text: `🎯 New interested email from ${emailData.from}: ${emailData.subject}`,
          attachments: [{
            color: 'good',
            fields: [
              { title: 'From', value: emailData.from, short: true },
              { title: 'Subject', value: emailData.subject, short: true },
              { title: 'Confidence', value: `${(aiCategory.confidence * 100).toFixed(1)}%`, short: true }
            ]
          }]
        });

        await this.notificationService.sendWebhook({
          event: 'email.interested',
          data: {
            email: emailData,
            aiCategory,
            timestamp: new Date()
          },
          timestamp: new Date()
        });
      }

      this.emit('newEmail', emailData);
      logger.info(`✅ Processed new email: ${emailData.subject}`);
    } catch (error) {
      logger.error(`❌ Error processing email:`, error);
    }
  }

  async disconnectAccount(accountId: string): Promise<void> {
    const imap = this.connections.get(accountId);
    if (imap) {
      imap.end();
      this.connections.delete(accountId);
    }

    const timeout = this.idleTimeouts.get(accountId);
    if (timeout) {
      clearTimeout(timeout);
      this.idleTimeouts.delete(accountId);
    }

    this.isIdle.delete(accountId);
    logger.info(`🔌 Disconnected IMAP for account: ${accountId}`);
  }

  async disconnectAll(): Promise<void> {
    for (const accountId of this.connections.keys()) {
      await this.disconnectAccount(accountId);
    }
  }

  getConnectionStatus(accountId: string): { connected: boolean; idle: boolean } {
    return {
      connected: this.connections.has(accountId),
      idle: this.isIdle.get(accountId) || false
    };
  }

  async forceEmailSync(accountId: string, days: number = 7): Promise<void> {
    logger.info(`🔄 Force syncing emails for account ${accountId} (last ${days} days)`);
    
    try {
      // Get account details
      const account = await this.getAccountById(accountId);
      if (!account) {
        throw new Error(`Account not found: ${accountId}`);
      }

      // Create a temporary connection for syncing
      const tempImap = new Imap({
        user: account.email,
        password: account.password,
        host: account.imapHost,
        port: account.imapPort,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        connTimeout: 60000, // 60 seconds connection timeout
        authTimeout: 30000 // 30 seconds authentication timeout
      });

      await new Promise<void>((resolve, reject) => {
        tempImap.once('ready', () => {
          tempImap.openBox('INBOX', false, (err: Error | null, box: any) => {
            if (err) {
              logger.error(`❌ Error opening INBOX for force sync:`, err);
              tempImap.end();
              reject(err);
              return;
            }

            logger.info(`📂 Opened INBOX for force sync, ${box.messages.total} total messages`);

            // Calculate date range for recent emails
            const sinceDate = new Date();
            sinceDate.setDate(sinceDate.getDate() - days);
            const dateString = sinceDate.toISOString().split('T')[0];
            const searchCriteria = ['ALL'];
            logger.info(`📅 Force syncing all emails (will filter for last ${days} days)`);
            
            tempImap.search(searchCriteria, (err: Error | null, results: number[]) => {
              if (err) {
                logger.error(`❌ Error searching emails during force sync:`, err);
                tempImap.end();
                reject(err);
                return;
              }

              if (!results || results.length === 0) {
                logger.info(`📭 No emails found during force sync for account ${accountId}`);
                tempImap.end();
                resolve();
                return;
              }

              logger.info(`📧 Found ${results.length} emails during force sync for account ${accountId}`);

              // Process emails in very small batches to prevent memory issues
              const emailsToProcess = results.slice(0, 10); // Process only 10 emails at a time
              const fetch = tempImap.fetch(emailsToProcess, { bodies: '', struct: true });
              let processedCount = 0;
              
              fetch.on('message', (msg, seqno) => {
                let buffer = '';
                
                msg.on('body', (stream) => {
                  stream.on('data', (chunk) => {
                    buffer += chunk.toString('utf8');
                  });
                });

                msg.once('end', () => {
                  // Process email with proper error handling
                  simpleParser(buffer)
                  .then(async (parsed) => {
                    try {
                      await this.processEmail(accountId, parsed, days);
                      processedCount++;
                      logger.info(`✅ Force sync processed email ${processedCount}/${emailsToProcess.length}: ${parsed.subject}`);
                      
                      // Force garbage collection every 5 emails to prevent memory buildup
                      if (processedCount % 5 === 0) {
                        if (global.gc) {
                          global.gc();
                        }
                      }
                    } catch (error) {
                      logger.error(`❌ Error processing email during force sync:`, error);
                      processedCount++;
                    }
                  })
                    .catch((error) => {
                      logger.error(`❌ Error parsing email during force sync:`, error);
                      processedCount++;
                    });
                });
              });

              fetch.once('error', (err: Error) => {
                logger.error(`❌ Error fetching emails during force sync:`, err);
                tempImap.end();
                reject(err);
              });

              fetch.once('end', () => {
                logger.info(`✅ Force sync completed for account ${accountId}, processed ${processedCount} emails`);
                tempImap.end();
                resolve();
              });
            });
          });
        });

        tempImap.once('error', (err: Error) => {
          logger.error(`❌ IMAP connection error during force sync:`, err);
          reject(err);
        });

        tempImap.connect();
      });
      
      // Update last sync time
      try {
        const { EmailAccount } = await import('../models');
        await EmailAccount.update(
          { lastSync: new Date() },
          { where: { id: accountId } }
        );
        logger.info(`✅ Updated last sync time for account ${accountId}`);
      } catch (error) {
        logger.error(`❌ Error updating last sync time:`, error);
      }
    } catch (error) {
      logger.error(`❌ Error in force sync for account ${accountId}:`, error);
      throw error;
    }
  }
}
