import { Email, AICategory, AISuggestedReply, ProductContext } from '../types';
import { logger } from '../utils/logger';

export class LocalAIService {
  private productContext: ProductContext;

  constructor() {
    this.productContext = {
      product: "OneBox Email Aggregator - Backend Engineer Application",
      outreachAgenda: "I am applying for a Backend Engineer position at ReachInbox. I have built a comprehensive email aggregator system with real-time IMAP synchronization, AI-powered categorization, Elasticsearch search capabilities, and RAG-based reply suggestions. If the lead is interested, share the meeting booking link: https://cal.com/example",
      meetingLink: "https://cal.com/example",
      contactInfo: "You can reach me at [your-email] or schedule a meeting using the link above. I'm excited to discuss how my technical skills and this project demonstrate my ability to build scalable backend systems."
    };
  }

  async categorizeEmail(email: Partial<Email>): Promise<AICategory> {
    try {
      const emailText = `${email.subject || ''} ${email.body || ''}`.toLowerCase();
      const fromEmail = email.from?.toLowerCase() || '';

      console.log('🔍 LocalAI: Analyzing email:', {
        subject: email.subject,
        from: email.from,
        bodyPreview: email.body?.substring(0, 100) + '...',
        emailTextPreview: emailText.substring(0, 200) + '...'
      });

      // Rule-based categorization
      let category: 'interested' | 'meeting_booked' | 'not_interested' | 'out_of_office' | 'spam' = 'spam';
      let confidence = 0.5;
      let reasoning = '';

      // Check for interested indicators
      const interestedKeywords = [
        'interested', 'curious', 'tell me more', 'sounds interesting', 'would like to know',
        'questions', 'can you explain', 'more information', 'details', 'schedule a call',
        'meeting', 'discuss', 'opportunity', 'position', 'role', 'job', 'career'
      ];
      
      const interestedScore = interestedKeywords.filter(keyword => 
        emailText.includes(keyword)
      ).length;

      // Check for meeting indicators
      const meetingKeywords = [
        'meeting', 'call', 'schedule', 'calendar', 'appointment', 'booked', 'confirmed',
        'zoom', 'teams', 'google meet', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday',
        'am', 'pm', 'time', 'available', 'free'
      ];
      
      const meetingScore = meetingKeywords.filter(keyword => 
        emailText.includes(keyword)
      ).length;

      // Check for not interested indicators
      const notInterestedKeywords = [
        'not interested', 'no thank you', 'decline', 'pass', 'not looking', 'not available',
        'busy', 'no time', 'not right now', 'maybe later', 'not suitable'
      ];
      
      const notInterestedScore = notInterestedKeywords.filter(keyword => 
        emailText.includes(keyword)
      ).length;

      // Check for out of office indicators
      const oooKeywords = [
        'out of office', 'vacation', 'holiday', 'away', 'unavailable', 'auto-reply',
        'automatic reply', 'will be back', 'returning', 'temporarily unavailable'
      ];
      
      const oooScore = oooKeywords.filter(keyword => 
        emailText.includes(keyword)
      ).length;

      // Check for spam indicators (more specific to avoid false positives)
      const spamKeywords = [
        'promotion', 'offer', 'discount', 'sale', 'buy now', 'click here', 'unsubscribe',
        'advertisement', 'spam', 'viagra', 'lottery', 'winner', 'congratulations', 'free money',
        'act now', 'limited time', 'exclusive offer', 'guaranteed', 'no obligation'
      ];
      
      const spamScore = spamKeywords.filter(keyword => 
        emailText.includes(keyword)
      ).length;

      // Determine category based on scores
      const scores = {
        interested: interestedScore,
        meeting_booked: meetingScore,
        not_interested: notInterestedScore,
        out_of_office: oooScore,
        spam: spamScore
      };

      const maxScore = Math.max(...Object.values(scores));
      const maxCategory = Object.keys(scores).find(key => scores[key as keyof typeof scores] === maxScore) as 'interested' | 'meeting_booked' | 'not_interested' | 'out_of_office' | 'spam';

      console.log('📊 LocalAI: Keyword analysis results:', {
        scores,
        maxScore,
        maxCategory,
        emailText: emailText.substring(0, 300)
      });

      if (maxScore > 0) {
        category = maxCategory;
        confidence = Math.min(0.9, 0.5 + (maxScore * 0.1));
        reasoning = `Rule-based classification: found ${maxScore} matching keywords for ${category}`;
      } else {
        // Default to spam if no clear indicators
        category = 'spam';
        confidence = 0.6;
        reasoning = 'No clear indicators found, defaulting to spam';
      }

      // Special handling for known email types
      const isLinkedInEmail = fromEmail.includes('linkedin.com');
      const isMediumEmail = fromEmail.includes('medium.com');
      const isJobSiteEmail = fromEmail.includes('glassdoor.com') || fromEmail.includes('indeed.com') || fromEmail.includes('unstop.news');
      const isProfessionalDomain = ['gmail.com', 'outlook.com', 'yahoo.com', 'company.com'].some(domain => 
        fromEmail.includes(domain)
      );

      // Override categorization for known professional services
      if (isLinkedInEmail || isMediumEmail) {
        if (emailText.includes('job') || emailText.includes('career') || emailText.includes('opportunity')) {
          category = 'interested';
          confidence = 0.7;
          reasoning = 'Professional networking email with job/career content';
        } else {
          category = 'interested';
          confidence = 0.5;
          reasoning = 'Professional networking email from known platform';
        }
      } else if (isJobSiteEmail) {
        category = 'interested';
        confidence = 0.8;
        reasoning = 'Job-related email from job site';
      } else if (isProfessionalDomain && category === 'spam' && spamScore === 0) {
        category = 'interested';
        confidence = 0.4;
        reasoning = 'From professional domain with no spam indicators';
      }

      console.log('🎯 LocalAI: Final categorization result:', {
        category,
        confidence,
        reasoning,
        isProfessionalDomain,
        fromEmail
      });

      return {
        category,
        confidence,
        reasoning
      };

    } catch (error) {
      logger.error('❌ Error in local AI categorization:', error);
      
      return {
        category: 'spam',
        confidence: 0.5,
        reasoning: 'Error in local AI categorization, defaulting to spam'
      };
    }
  }

  async generateSuggestedReply(email: Partial<Email>): Promise<AISuggestedReply> {
    try {
      const category = await this.categorizeEmail(email);
      
      let reply = '';
      let confidence = 0.7;

      switch (category.category) {
        case 'interested':
          reply = `Hi ${email.from?.split('@')[0] || 'there'},

Thank you for your interest! I'm excited to share that I've built a comprehensive email aggregator system with real-time IMAP synchronization, AI-powered categorization, Elasticsearch search capabilities, and RAG-based reply suggestions.

${this.productContext.outreachAgenda}

${this.productContext.contactInfo}

Best regards,
[Your Name]`;
          confidence = 0.8;
          break;

        case 'meeting_booked':
          reply = `Hi ${email.from?.split('@')[0] || 'there'},

Thank you for scheduling the meeting! I'm looking forward to discussing the Backend Engineer position and demonstrating the technical capabilities I've built into this email aggregator system.

I'll prepare a brief demo of the system's features including:
- Real-time email synchronization
- AI-powered categorization
- Advanced search capabilities
- Automated reply suggestions

See you at the meeting!

Best regards,
[Your Name]`;
          confidence = 0.9;
          break;

        case 'not_interested':
          reply = `Hi ${email.from?.split('@')[0] || 'there'},

Thank you for taking the time to respond. I understand that this opportunity may not be the right fit at this time.

If your situation changes in the future, I'd be happy to discuss how my technical skills and this email aggregator project could benefit your team.

Best regards,
[Your Name]`;
          confidence = 0.8;
          break;

        case 'out_of_office':
          reply = `Hi ${email.from?.split('@')[0] || 'there'},

Thank you for your auto-reply. I understand you're currently unavailable.

I'll follow up when you return. In the meantime, feel free to check out the email aggregator system I've built - it demonstrates the technical capabilities I'd bring to the Backend Engineer role.

Best regards,
[Your Name]`;
          confidence = 0.7;
          break;

        default: // spam
          reply = `Hi,

Thank you for your email. I appreciate you taking the time to reach out.

${this.productContext.outreachAgenda}

${this.productContext.contactInfo}

Best regards,
[Your Name]`;
          confidence = 0.6;
          break;
      }

      return {
        reply,
        confidence,
        reasoning: `Generated template reply based on ${category.category} categorization`
      };

    } catch (error) {
      logger.error('❌ Error generating suggested reply:', error);
      
      return {
        reply: `Thank you for your email. I appreciate you taking the time to reach out. ${this.productContext.outreachAgenda}`,
        confidence: 0.3,
        reasoning: 'Error in reply generation, using fallback template'
      };
    }
  }

  async batchCategorizeEmails(emails: Partial<Email>[]): Promise<AICategory[]> {
    const results: AICategory[] = [];
    
    // Process all emails immediately (no rate limits for local processing)
    for (const email of emails) {
      try {
        const result = await this.categorizeEmail(email);
        results.push(result);
      } catch (error) {
        logger.error('❌ Error processing email:', error);
        results.push({
          category: 'spam',
          confidence: 0.5,
          reasoning: 'Error processing email, defaulting to spam'
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
