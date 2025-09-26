import { Request, Response } from 'express';
import EmailAccount from '../models/EmailAccount';
import { IMAPService } from '../services/IMAPService';
import { validateRequest, emailAccountSchema } from '../utils/validation';
import { APIResponse } from '../types';
import { logger } from '../utils/logger';

export class AccountController {
  constructor(private imapService: IMAPService) {}

  async createAccount(req: Request, res: Response): Promise<void> {
    try {
      const accountData = validateRequest(emailAccountSchema, req.body);
      
      const account = await EmailAccount.create(accountData);
      
      // Start IMAP connection for the new account
      await this.imapService.connectToAccount(account);
      
      // Force sync emails immediately after connection
      setTimeout(async () => {
        try {
          await this.imapService.forceEmailSync(account.id, 730); // Use 2 years to match processEmail filter
          logger.info(`✅ Initial email sync completed for account: ${account.email}`);
        } catch (error) {
          logger.error(`❌ Error in initial email sync for account ${account.email}:`, error);
        }
      }, 3000); // Wait 3 seconds for connection to establish
      
      const response: APIResponse = {
        success: true,
        data: account,
        message: 'Email account created and connected successfully. Emails are being fetched...'
      };
      
      res.status(201).json(response);
    } catch (error) {
      logger.error('❌ Error creating email account:', error);
      const response: APIResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
      res.status(500).json(response);
    }
  }

  async getAccounts(req: Request, res: Response): Promise<void> {
    try {
      const accounts = await EmailAccount.findAll({
        attributes: { exclude: ['password'] }, // Don't return passwords
        order: [['createdAt', 'DESC']]
      });
      
      const response: APIResponse = {
        success: true,
        data: accounts
      };
      
      res.json(response);
    } catch (error) {
      logger.error('❌ Error getting email accounts:', error);
      const response: APIResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
      res.status(500).json(response);
    }
  }

  async getAccountById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const account = await EmailAccount.findByPk(id, {
        attributes: { exclude: ['password'] }
      });
      
      if (!account) {
        const response: APIResponse = {
          success: false,
          error: 'Email account not found'
        };
        res.status(404).json(response);
        return;
      }
      
      // Get connection status
      const connectionStatus = this.imapService.getConnectionStatus(id);
      
      const response: APIResponse = {
        success: true,
        data: {
          ...account.toJSON(),
          connectionStatus
        }
      };
      
      res.json(response);
    } catch (error) {
      logger.error('❌ Error getting email account by ID:', error);
      const response: APIResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
      res.status(500).json(response);
    }
  }

  async updateAccount(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const account = await EmailAccount.findByPk(id);
      
      if (!account) {
        const response: APIResponse = {
          success: false,
          error: 'Email account not found'
        };
        res.status(404).json(response);
        return;
      }
      
      // Disconnect if account is being deactivated
      if (updates.isActive === false && account.isActive) {
        await this.imapService.disconnectAccount(id);
      }
      
      await account.update(updates);
      
      // Reconnect if account is being activated
      if (updates.isActive === true && !account.isActive) {
        await this.imapService.connectToAccount(account);
      }
      
      const response: APIResponse = {
        success: true,
        data: account,
        message: 'Email account updated successfully'
      };
      
      res.json(response);
    } catch (error) {
      logger.error('❌ Error updating email account:', error);
      const response: APIResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
      res.status(500).json(response);
    }
  }

  async deleteAccount(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const account = await EmailAccount.findByPk(id);
      
      if (!account) {
        const response: APIResponse = {
          success: false,
          error: 'Email account not found'
        };
        res.status(404).json(response);
        return;
      }
      
      // Disconnect IMAP connection
      await this.imapService.disconnectAccount(id);
      
      // Delete the account
      await account.destroy();
      
      const response: APIResponse = {
        success: true,
        message: 'Email account deleted successfully'
      };
      
      res.json(response);
    } catch (error) {
      logger.error('❌ Error deleting email account:', error);
      const response: APIResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
      res.status(500).json(response);
    }
  }

  async testConnection(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const account = await EmailAccount.findByPk(id);
      
      if (!account) {
        const response: APIResponse = {
          success: false,
          error: 'Email account not found'
        };
        res.status(404).json(response);
        return;
      }
      
      // Test IMAP connection
      try {
        await this.imapService.connectToAccount(account);
        
        const response: APIResponse = {
          success: true,
          message: 'Connection test successful'
        };
        
        res.json(response);
      } catch (connectionError) {
        const response: APIResponse = {
          success: false,
          error: `Connection test failed: ${connectionError instanceof Error ? connectionError.message : 'Unknown error'}`
        };
        
        res.status(400).json(response);
      }
    } catch (error) {
      logger.error('❌ Error testing connection:', error);
      const response: APIResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
      res.status(500).json(response);
    }
  }

  async syncAccount(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { days = 7 } = req.query;
      
      const account = await EmailAccount.findByPk(id);
      
      if (!account) {
        const response: APIResponse = {
          success: false,
          error: 'Email account not found'
        };
        res.status(404).json(response);
        return;
      }
      
      // Trigger manual sync using the new polling method
      await this.imapService.forceEmailSync(id, Number(days));
      
      // Update last sync time
      await account.update({ lastSync: new Date() });
      
      const response: APIResponse = {
        success: true,
        message: `Sync initiated for account ${account.email} (last ${days} days)`
      };
      
      res.json(response);
    } catch (error) {
      logger.error('❌ Error syncing account:', error);
      const response: APIResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
      res.status(500).json(response);
    }
  }

  async getAccountStats(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const account = await EmailAccount.findByPk(id);
      
      if (!account) {
        const response: APIResponse = {
          success: false,
          error: 'Email account not found'
        };
        res.status(404).json(response);
        return;
      }
      
      const connectionStatus = this.imapService.getConnectionStatus(id);
      
      const stats = {
        account: {
          id: account.id,
          email: account.email,
          isActive: account.isActive,
          lastSync: account.lastSync,
          createdAt: account.createdAt
        },
        connection: connectionStatus
      };
      
      const response: APIResponse = {
        success: true,
        data: stats
      };
      
      res.json(response);
    } catch (error) {
      logger.error('❌ Error getting account stats:', error);
      const response: APIResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
      res.status(500).json(response);
    }
  }

  async syncEmails(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { days = 730 } = req.body; // Default to 2 years to match processEmail filter
      
      const account = await EmailAccount.findByPk(id);
      if (!account) {
        const response: APIResponse = {
          success: false,
          error: 'Account not found'
        };
        res.status(404).json(response);
        return;
      }
      
      // Force sync emails for the account
      await this.imapService.forceEmailSync(id, days);
      
      const response: APIResponse = {
        success: true,
        message: `Emails synced successfully for account ${account.email} (last ${days} days)`
      };
      
      res.json(response);
    } catch (error) {
      logger.error('❌ Error syncing emails:', error);
      const response: APIResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
      res.status(500).json(response);
    }
  }
}
