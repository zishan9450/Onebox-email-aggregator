import { Email, AICategory, AISuggestedReply, ProductContext } from '../types';
import { logger } from '../utils/logger';

export class HuggingFaceService {
  private apiKey: string;
  private productContext: ProductContext;

  constructor() {
    this.apiKey = process.env.HUGGINGFACE_API_KEY || '';
    
    this.productContext = {
      product: "OneBox Email Aggregator - Backend Engineer Application",
      outreachAgenda: "I am applying for a Backend Engineer position at ReachInbox. I have built a comprehensive email aggregator system with real-time IMAP synchronization, AI-powered categorization, Elasticsearch search capabilities, and RAG-based reply suggestions. If the lead is interested, share the meeting booking link: https://cal.com/example",
      meetingLink: "https://cal.com/example",
      contactInfo: "You can reach me at [your-email] or schedule a meeting using the link above. I'm excited to discuss how my technical skills and this project demonstrate my ability to build scalable backend systems."
    };
  }

  async categorizeEmail(email: Partial<Email>): Promise<AICategory> {
    try {
      if (!this.apiKey) {
        throw new Error('Hugging Face API key not configured');
      }

      // Prepare the text for classification
      const emailText = `
        From: ${email.from}
        Subject: ${email.subject}
        Body: ${email.body?.substring(0, 1000)}
      `;

      // Use Hugging Face's text classification model
      const response = await fetch(
        "https://api-inference.huggingface.co/models/facebook/bart-large-mnli",
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          method: "POST",
          body: JSON.stringify({
            inputs: emailText,
            parameters: {
              candidate_labels: [
                "interested - shows genuine interest, asks questions, wants to know more",
                "meeting_booked - confirms a meeting, provides meeting details, or schedules something",
                "not_interested - declines, says no, or shows clear disinterest", 
                "spam - unwanted promotional content, irrelevant messages",
                "out_of_office - auto-replies, vacation messages, or unavailability notices"
              ]
            }
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Hugging Face API error: ${response.status}`);
      }

      const result = await response.json() as any;
      
      if (!result || !result.labels || !result.scores) {
        throw new Error('Invalid response from Hugging Face API');
      }

      // Find the highest scoring label
      const maxScoreIndex = result.scores.indexOf(Math.max(...result.scores));
      const bestLabel = result.labels[maxScoreIndex];
      const confidence = result.scores[maxScoreIndex];

      // Extract category from the label
      const category = bestLabel.split(' - ')[0] as any;
      
      return {
        category,
        confidence: Math.max(0, Math.min(1, confidence)),
        reasoning: `Classified as ${category} with ${(confidence * 100).toFixed(1)}% confidence using Hugging Face`
      };

    } catch (error) {
      logger.error('❌ Error categorizing email with Hugging Face:', error);
      
      // Fallback categorization
      return {
        category: 'spam',
        confidence: 0.5,
        reasoning: 'Error in Hugging Face categorization, defaulting to spam'
      };
    }
  }

  async generateSuggestedReply(email: Partial<Email>): Promise<AISuggestedReply> {
    try {
      if (!this.apiKey) {
        throw new Error('Hugging Face API key not configured');
      }

      // Use Hugging Face's text generation model
      const prompt = `
        You are helping with email outreach for a job application. Based on the following email, generate a professional reply.
        
        Product Context: ${this.productContext.product}
        Outreach Agenda: ${this.productContext.outreachAgenda}
        Meeting Link: ${this.productContext.meetingLink}
        
        Email to Reply To:
        From: ${email.from}
        Subject: ${email.subject}
        Body: ${email.body?.substring(0, 1000)}
        
        Generate a professional reply that acknowledges the sender's message and incorporates the outreach agenda naturally.
      `;

      const response = await fetch(
        "https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium",
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          method: "POST",
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              max_length: 200,
              temperature: 0.7,
              do_sample: true
            }
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Hugging Face API error: ${response.status}`);
      }

      const result = await response.json() as any;
      
      if (!result || !result.generated_text) {
        throw new Error('Invalid response from Hugging Face API');
      }

      // Extract the reply from the generated text
      const reply = result.generated_text.replace(prompt, '').trim();
      
      return {
        reply: reply || `Thank you for your email. I appreciate you taking the time to reach out. ${this.productContext.outreachAgenda}`,
        confidence: 0.7,
        reasoning: 'Generated using Hugging Face text generation model'
      };

    } catch (error) {
      logger.error('❌ Error generating suggested reply with Hugging Face:', error);
      
      // Fallback reply
      return {
        reply: `Thank you for your email. I appreciate you taking the time to reach out. ${this.productContext.outreachAgenda}`,
        confidence: 0.3,
        reasoning: 'Error in Hugging Face reply generation, using fallback template'
      };
    }
  }

  async batchCategorizeEmails(emails: Partial<Email>[]): Promise<AICategory[]> {
    const results: AICategory[] = [];
    
    // Process emails in smaller batches for Hugging Face
    const batchSize = 3; // Smaller batch size for free tier
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const batchPromises = batch.map(email => this.categorizeEmail(email));
      
      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Add delay between batches to respect rate limits
        if (i + batchSize < emails.length) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Longer delay for free tier
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
}
