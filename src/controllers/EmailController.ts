import { Request, Response } from 'express';
import { ElasticsearchService } from '../services/ElasticsearchService';
import { AIService } from '../services/AIService';
import { RAGService } from '../services/RAGService';
import { EmailSearchFilters, APIResponse, PaginatedResponse } from '../types';
import { validateRequest, emailSearchSchema } from '../utils/validation';
import { logger } from '../utils/logger';

export class EmailController {
  constructor(
    private elasticsearchService: ElasticsearchService,
    private aiService: AIService,
    private ragService: RAGService
  ) {}

  async searchEmails(req: Request, res: Response): Promise<void> {
    try {
      const validatedFilters = validateRequest(emailSearchSchema, req.query);
      
      // Convert page to offset if page is provided
      const filters: EmailSearchFilters = {
        ...validatedFilters,
        offset: validatedFilters.page ? (validatedFilters.page - 1) * (validatedFilters.limit || 20) : validatedFilters.offset
      };
      
      const result = await this.elasticsearchService.searchEmails(filters);
      
      const response: PaginatedResponse<any> = {
        success: true,
        data: result.data || [],
        pagination: result.pagination,
        message: `Found ${result.data?.length || 0} emails`
      };
      
      res.json(response);
    } catch (error) {
      logger.error('❌ Error searching emails:', error);
      const response: APIResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
      res.status(500).json(response);
    }
  }

  async getEmailById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const email = await this.elasticsearchService.findEmailById(id);
      
      if (!email) {
        const response: APIResponse = {
          success: false,
          error: 'Email not found'
        };
        res.status(404).json(response);
        return;
      }
      
      const response: APIResponse = {
        success: true,
        data: email
      };
      
      res.json(response);
    } catch (error) {
      logger.error('❌ Error getting email by ID:', error);
      const response: APIResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
      res.status(500).json(response);
    }
  }

  async updateEmail(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      await this.elasticsearchService.updateEmail(id, updates);
      
      const response: APIResponse = {
        success: true,
        message: 'Email updated successfully'
      };
      
      res.json(response);
    } catch (error) {
      logger.error('❌ Error updating email:', error);
      const response: APIResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
      res.status(500).json(response);
    }
  }

  async deleteEmail(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      await this.elasticsearchService.deleteEmail(id);
      
      const response: APIResponse = {
        success: true,
        message: 'Email deleted successfully'
      };
      
      res.json(response);
    } catch (error) {
      logger.error('❌ Error deleting email:', error);
      const response: APIResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
      res.status(500).json(response);
    }
  }

  async getEmailStats(req: Request, res: Response): Promise<void> {
    try {
      const { accountId } = req.query;
      
      // Simple health check that doesn't require external services
      const response: APIResponse = {
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          service: 'OneBox Email Aggregator',
          version: '1.0.0',
          message: 'Service is running successfully'
        }
      };
      
      res.json(response);
    } catch (error) {
      logger.error('❌ Error getting email stats:', error);
      const response: APIResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
      res.status(500).json(response);
    }
  }

  async categorizeEmail(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      console.log('🎯 EmailController: Categorizing email with ID:', id);
      
      const email = await this.elasticsearchService.findEmailById(id);
      
      if (!email) {
        const response: APIResponse = {
          success: false,
          error: 'Email not found'
        };
        res.status(404).json(response);
        return;
      }
      
      console.log('📧 EmailController: Found email:', {
        subject: email.subject,
        from: email.from,
        currentCategory: email.category,
        currentAiCategory: email.aiCategory
      });
      
      const aiCategory = await this.aiService.categorizeEmail(email);
      
      // Update the email with new category
      await this.elasticsearchService.updateEmail(id, {
        category: aiCategory.category,
        aiCategory: aiCategory.category,
        aiConfidence: aiCategory.confidence
      });
      
      const response: APIResponse = {
        success: true,
        data: {
          emailId: id,
          category: aiCategory.category,
          confidence: aiCategory.confidence,
          reasoning: aiCategory.reasoning
        }
      };
      
      res.json(response);
    } catch (error) {
      logger.error('❌ Error categorizing email:', error);
      const response: APIResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
      res.status(500).json(response);
    }
  }

  async recategorizeAllEmails(req: Request, res: Response): Promise<void> {
    try {
      console.log('🔄 Starting bulk re-categorization of all emails');
      
      // Get all emails from Elasticsearch
      const response = await this.elasticsearchService.searchEmails({
        query: '',
        offset: 0,
        limit: 1000 // Process in batches
      });

      if (!response.success || !response.data) {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch emails for re-categorization'
        });
        return;
      }

      const emails = response.data;
      let processed = 0;
      let updated = 0;

      for (const email of emails) {
        try {
          // Re-categorize the email
          const aiCategory = await this.aiService.categorizeEmail(email);
          
          // Update the email with new category
          await this.elasticsearchService.updateEmail(email.id, {
            category: aiCategory.category,
            aiCategory: aiCategory.category,
            aiConfidence: aiCategory.confidence
          });

          // Generate suggested reply for interested emails
          if (aiCategory.category === 'interested') {
            try {
              const suggestedReply = await this.ragService.generateContextualReply(email);
              await this.elasticsearchService.updateEmail(email.id, {
                suggestedReply: suggestedReply
              });
              console.log(`✅ Generated suggested reply for: ${email.subject}`);
            } catch (error) {
              console.error('❌ Error generating suggested reply:', error);
            }
          }

          updated++;
          processed++;
          
          if (processed % 10 === 0) {
            console.log(`📊 Processed ${processed}/${emails.length} emails`);
          }
        } catch (error) {
          console.error(`❌ Error processing email ${email.id}:`, error);
          processed++;
        }
      }

      const response_data: APIResponse = {
        success: true,
        data: {
          totalEmails: emails.length,
          processed,
          updated,
          message: `Successfully re-categorized ${updated} out of ${emails.length} emails`
        }
      };
      
      res.json(response_data);
    } catch (error) {
      logger.error('❌ Error in bulk re-categorization:', error);
      const response: APIResponse = {
        success: false,
        error: 'Failed to re-categorize emails'
      };
      res.status(500).json(response);
    }
  }

  async generateSuggestedReply(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const email = await this.elasticsearchService.findEmailById(id);
      
      if (!email) {
        const response: APIResponse = {
          success: false,
          error: 'Email not found'
        };
        res.status(404).json(response);
        return;
      }
      
      // Use RAG service for contextual reply generation
      const suggestedReply = await this.ragService.generateContextualReply(email);
      
      // Update the email with suggested reply
      await this.elasticsearchService.updateEmail(id, {
        suggestedReply: suggestedReply
      });
      
      const response: APIResponse = {
        success: true,
        data: {
          emailId: id,
          suggestedReply: suggestedReply,
          confidence: 0.9, // RAG-based replies have higher confidence
          reasoning: 'Generated using RAG (Retrieval-Augmented Generation) with product context'
        }
      };
      
      res.json(response);
    } catch (error) {
      logger.error('❌ Error generating suggested reply:', error);
      const response: APIResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
      res.status(500).json(response);
    }
  }

  async batchCategorizeEmails(req: Request, res: Response): Promise<void> {
    try {
      const { emailIds } = req.body;
      
      if (!Array.isArray(emailIds) || emailIds.length === 0) {
        const response: APIResponse = {
          success: false,
          error: 'emailIds must be a non-empty array'
        };
        res.status(400).json(response);
        return;
      }
      
      // Fetch emails
      const emails = await Promise.all(
        emailIds.map(id => this.elasticsearchService.findEmailByMessageId(id))
      );
      
      const validEmails = emails.filter(email => email !== null);
      
      if (validEmails.length === 0) {
        const response: APIResponse = {
          success: false,
          error: 'No valid emails found'
        };
        res.status(404).json(response);
        return;
      }
      
      const categories = await this.aiService.batchCategorizeEmails(validEmails);
      
      // Update emails with new categories
      const updatePromises = validEmails.map((email, index) => 
        this.elasticsearchService.updateEmail(email!.id, {
          category: categories[index].category,
          aiCategory: categories[index].category,
          aiConfidence: categories[index].confidence
        })
      );
      
      await Promise.all(updatePromises);
      
      const response: APIResponse = {
        success: true,
        data: {
          processed: validEmails.length,
          categories: categories.map((cat, index) => ({
            emailId: validEmails[index]!.id,
            category: cat.category,
            confidence: cat.confidence,
            reasoning: cat.reasoning
          }))
        }
      };
      
      res.json(response);
    } catch (error) {
      logger.error('❌ Error batch categorizing emails:', error);
      const response: APIResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
      res.status(500).json(response);
    }
  }

  async deleteAllEmails(req: Request, res: Response): Promise<void> {
    try {
      console.log('🗑️ Deleting all emails from Elasticsearch...');
      
      // Delete all emails from Elasticsearch
      await this.elasticsearchService.deleteAllEmails();
      
      const response: APIResponse = {
        success: true,
        message: 'All emails deleted successfully'
      };
      
      res.json(response);
    } catch (error) {
      logger.error('❌ Error deleting all emails:', error);
      const response: APIResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
      res.status(500).json(response);
    }
  }
}
