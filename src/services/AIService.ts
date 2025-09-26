import OpenAI from 'openai';
import { Email, AICategory, AISuggestedReply, ProductContext } from '../types';
import { logger } from '../utils/logger';
import { HuggingFaceService } from './HuggingFaceService';
import { LocalAIService } from './LocalAIService';

export class AIService {
  public openai: OpenAI; // Made public for RAG service access
  private productContext: ProductContext;
  private huggingFaceService: HuggingFaceService;
  private localAIService: LocalAIService;
  private currentProvider: 'openai' | 'huggingface' | 'local';

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    this.huggingFaceService = new HuggingFaceService();
    this.localAIService = new LocalAIService();
    
    // Determine which provider to use based on environment variables
    this.currentProvider = this.determineProvider();

    this.productContext = {
      product: "OneBox Email Aggregator - Backend Engineer Application",
      outreachAgenda: "I am applying for a Backend Engineer position at ReachInbox. I have built a comprehensive email aggregator system with real-time IMAP synchronization, AI-powered categorization, Elasticsearch search capabilities, and RAG-based reply suggestions. If the lead is interested, share the meeting booking link: https://cal.com/example",
      meetingLink: "https://cal.com/example",
      contactInfo: "You can reach me at [your-email] or schedule a meeting using the link above. I'm excited to discuss how my technical skills and this project demonstrate my ability to build scalable backend systems."
    };
  }

  private determineProvider(): 'openai' | 'huggingface' | 'local' {
    // Check environment variables to determine which provider to use
    if (process.env.AI_PROVIDER === 'huggingface' && process.env.HUGGINGFACE_API_KEY) {
      return 'huggingface';
    } else if (process.env.AI_PROVIDER === 'local') {
      return 'local';
    } else if (process.env.OPENAI_API_KEY) {
      return 'openai';
    } else {
      // Default to local if no API keys are available
      logger.warn('⚠️ No AI API keys found, defaulting to local rule-based AI');
      return 'local';
    }
  }

  private async categorizeWithProvider(email: Partial<Email>): Promise<AICategory> {
    switch (this.currentProvider) {
      case 'openai':
        return this.categorizeWithOpenAI(email);
      case 'huggingface':
        return this.huggingFaceService.categorizeEmail(email);
      case 'local':
        return this.localAIService.categorizeEmail(email);
      default:
        return this.localAIService.categorizeEmail(email);
    }
  }

  private async generateReplyWithProvider(email: Partial<Email>): Promise<AISuggestedReply> {
    switch (this.currentProvider) {
      case 'openai':
        return this.generateReplyWithOpenAI(email);
      case 'huggingface':
        return this.huggingFaceService.generateSuggestedReply(email);
      case 'local':
        return this.localAIService.generateSuggestedReply(email);
      default:
        return this.localAIService.generateSuggestedReply(email);
    }
  }

  private async categorizeWithOpenAI(email: Partial<Email>): Promise<AICategory> {
    try {
      const prompt = `
Analyze the following email and categorize it into one of these categories:
- interested: Shows genuine interest, asks questions, wants to know more
- meeting_booked: Confirms a meeting, provides meeting details, or schedules something
- not_interested: Declines, says no, or shows clear disinterest
- spam: Unwanted promotional content, irrelevant messages
- out_of_office: Auto-replies, vacation messages, or unavailability notices

Email Details:
From: ${email.from}
Subject: ${email.subject}
Body: ${email.body?.substring(0, 1000)}...

Respond with a JSON object containing:
{
  "category": "one of the categories above",
  "confidence": "number between 0 and 1",
  "reasoning": "brief explanation of why this category was chosen"
}
`;

      const response = await this.openai.chat.completions.create({
        model: process.env.AI_MODEL || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert email categorization AI. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 200
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const result = JSON.parse(content);
      
      return {
        category: result.category as any,
        confidence: Math.max(0, Math.min(1, result.confidence)),
        reasoning: result.reasoning
      };
    } catch (error) {
      logger.error('❌ Error categorizing email with OpenAI:', error);
      
      // Fallback categorization
      return {
        category: 'spam',
        confidence: 0.5,
        reasoning: 'Error in OpenAI categorization, defaulting to spam'
      };
    }
  }

  private async generateReplyWithOpenAI(email: Partial<Email>): Promise<AISuggestedReply> {
    try {
      const prompt = `
You are helping with email outreach for a job application. Based on the following email and the product context, generate a professional and personalized reply.

Product Context:
- Product: ${this.productContext.product}
- Outreach Agenda: ${this.productContext.outreachAgenda}
- Meeting Link: ${this.productContext.meetingLink}

Email to Reply To:
From: ${email.from}
Subject: ${email.subject}
Body: ${email.body?.substring(0, 1500)}...

Generate a professional reply that:
1. Acknowledges the sender's message
2. Is relevant to their specific email content
3. Incorporates the outreach agenda naturally
4. Includes the meeting link if appropriate
5. Maintains a professional tone

Respond with a JSON object containing:
{
  "reply": "the suggested reply text",
  "confidence": "number between 0 and 1 indicating how confident you are in this reply",
  "reasoning": "brief explanation of why this reply was suggested"
}
`;

      const response = await this.openai.chat.completions.create({
        model: process.env.AI_MODEL || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert email communication assistant. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const result = JSON.parse(content);
      
      return {
        reply: result.reply,
        confidence: Math.max(0, Math.min(1, result.confidence)),
        reasoning: result.reasoning
      };
    } catch (error) {
      logger.error('❌ Error generating suggested reply with OpenAI:', error);
      
      // Fallback reply
      return {
        reply: `Thank you for your email. I appreciate you taking the time to reach out. ${this.productContext.outreachAgenda}`,
        confidence: 0.3,
        reasoning: 'Error in OpenAI reply generation, using fallback template'
      };
    }
  }

  async categorizeEmail(email: Partial<Email>): Promise<AICategory> {
    try {
      console.log(`🤖 AIService: Categorizing email using ${this.currentProvider} provider`);
      logger.info(`🤖 Categorizing email using ${this.currentProvider} provider`);
      const result = await this.categorizeWithProvider(email);
      console.log(`✅ AIService: Categorization result:`, result);
      return result;
    } catch (error) {
      console.error('❌ AIService: Error categorizing email:', error);
      logger.error('❌ Error categorizing email:', error);
      
      // Fallback categorization
      return {
        category: 'spam',
        confidence: 0.5,
        reasoning: 'Error in AI categorization, defaulting to spam'
      };
    }
  }

  async generateSuggestedReply(email: Partial<Email>): Promise<AISuggestedReply> {
    try {
      logger.info(`🤖 Generating reply using ${this.currentProvider} provider`);
      return await this.generateReplyWithProvider(email);
    } catch (error) {
      logger.error('❌ Error generating suggested reply:', error);
      
      // Fallback reply
      return {
        reply: `Thank you for your email. I appreciate you taking the time to reach out. ${this.productContext.outreachAgenda}`,
        confidence: 0.3,
        reasoning: 'Error in AI reply generation, using fallback template'
      };
    }
  }

  async batchCategorizeEmails(emails: Partial<Email>[]): Promise<AICategory[]> {
    const results: AICategory[] = [];
    
    // Process emails in batches to avoid rate limits
    const batchSize = this.currentProvider === 'local' ? 10 : 5;
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const batchPromises = batch.map(email => this.categorizeEmail(email));
      
      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Add delay between batches to respect rate limits
        if (i + batchSize < emails.length) {
          const delay = this.currentProvider === 'local' ? 100 : 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        logger.error(`❌ Error processing batch ${i}-${i + batchSize}:`, error);
        // Add fallback categories for failed batch
        batch.forEach(() => {
          results.push({
            category: 'spam',
            confidence: 0.5,
            reasoning: 'Batch processing error, defaulting to spam'
          });
        });
      }
    }
    
    return results;
  }

  updateProductContext(newContext: Partial<ProductContext>): void {
    this.productContext = { ...this.productContext, ...newContext };
    logger.info('✅ Product context updated:', this.productContext);
  }

  getProductContext(): ProductContext {
    return this.productContext;
  }

  getCurrentProvider(): string {
    return this.currentProvider;
  }

  switchProvider(provider: 'openai' | 'huggingface' | 'local'): void {
    this.currentProvider = provider;
    logger.info(`🔄 Switched AI provider to: ${provider}`);
  }
}