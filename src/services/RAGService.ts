import { Client } from '@elastic/elasticsearch';
import { elasticsearchClient, EMAIL_INDEX } from '../config/elasticsearch';
import { AIService } from './AIService';
import { Email, ProductContext } from '../types';
import { logger } from '../utils/logger';

export class RAGService {
  private vectorIndex = 'product_context';
  private aiService: AIService;

  constructor(aiService: AIService) {
    this.aiService = aiService;
    this.initializeVectorIndex();
  }

  private async initializeVectorIndex(): Promise<void> {
    try {
      const exists = await elasticsearchClient.indices.exists({ index: this.vectorIndex });
      
      if (!exists) {
        await elasticsearchClient.indices.create({
          index: this.vectorIndex,
          body: {
            mappings: {
              properties: {
                id: { type: 'keyword' },
                content: { 
                  type: 'text',
                  analyzer: 'standard'
                },
                context: { type: 'keyword' },
                embedding: {
                  type: 'dense_vector',
                  dims: 1536, // OpenAI ada-002 embedding dimension
                  index: true,
                  similarity: 'cosine'
                },
                createdAt: { type: 'date' }
              }
            }
          }
        });
        
        logger.info(`✅ Vector index '${this.vectorIndex}' created successfully`);
      }
    } catch (error) {
      logger.error('❌ Error creating vector index:', error);
    }
  }

  async storeProductContext(context: ProductContext): Promise<void> {
    try {
      const content = `${context.product} - ${context.outreachAgenda} ${context.contactInfo || ''}`;
      
      // Generate embedding for the content
      const embedding = await this.generateEmbedding(content);
      
      const document = {
        id: 'product_context',
        content,
        context: 'product_info',
        embedding,
        createdAt: new Date().toISOString()
      };

      await elasticsearchClient.index({
        index: this.vectorIndex,
        id: 'product_context',
        body: document
      });

      logger.info('✅ Product context stored in vector database');
    } catch (error) {
      logger.error('❌ Error storing product context:', error);
      throw error;
    }
  }

  async retrieveRelevantContext(query: string, limit: number = 3): Promise<string[]> {
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);
      
      const response = await elasticsearchClient.search({
        index: this.vectorIndex,
        body: {
          query: {
            script_score: {
              query: { match_all: {} },
              script: {
                source: "cosineSimilarity(params.query_vector, 'embedding') + 1.0",
                params: { query_vector: queryEmbedding }
              }
            }
          },
          size: limit
        }
      });

      const contexts = response.hits.hits.map((hit: any) => hit._source.content);
      return contexts;
    } catch (error) {
      logger.error('❌ Error retrieving relevant context:', error);
      return [];
    }
  }

  async generateContextualReply(email: Partial<Email>): Promise<string> {
    try {
      // Create a query from the email content
      const query = `${email.subject} ${email.body}`.substring(0, 1000);
      
      // Retrieve relevant context
      const relevantContexts = await this.retrieveRelevantContext(query);
      
      // Get current product context
      const productContext = this.aiService.getProductContext();
      
      // Combine all context
      const combinedContext = [
        productContext.outreachAgenda,
        ...relevantContexts
      ].join('\n\n');

      const prompt = `
You are helping with email outreach for a job application. Based on the following email and the product context, generate a professional and personalized reply.

Product Context:
${combinedContext}

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
6. Uses the retrieved context to provide more relevant information

Respond with a JSON object containing:
{
  "reply": "the suggested reply text",
  "confidence": "number between 0 and 1 indicating how confident you are in this reply",
  "reasoning": "brief explanation of why this reply was suggested and what context was used"
}
`;

      // Use the AI service's generateSuggestedReply method instead of direct OpenAI call
      const aiReply = await this.aiService.generateSuggestedReply(email);
      
      // For local AI, we get a simple reply, so we'll enhance it with context
      if (this.aiService['currentProvider'] === 'local') {
        return this.enhanceLocalReply(aiReply.reply, combinedContext, email);
      }
      
      // For other AI providers, return the reply as-is
      return aiReply.reply;
    } catch (error) {
      logger.error('❌ Error generating contextual reply:', error);
      throw error;
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Check if we're using local AI (no embeddings support)
      if (this.aiService['currentProvider'] === 'local') {
        // For local AI, return a simple hash-based embedding
        return this.generateSimpleEmbedding(text);
      }

      const response = await this.aiService['openai'].embeddings.create({
        model: 'text-embedding-ada-002',
        input: text
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error('❌ Error generating embedding:', error);
      throw error;
    }
  }

  private generateSimpleEmbedding(text: string): number[] {
    // Generate a simple hash-based embedding for local AI
    // This is a basic implementation that creates a consistent vector
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(1536).fill(0); // Same size as OpenAI embeddings
    
    words.forEach(word => {
      const hash = this.simpleHash(word);
      const index = hash % embedding.length;
      embedding[index] += 1;
    });
    
    // Normalize the embedding
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => magnitude > 0 ? val / magnitude : 0);
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private enhanceLocalReply(baseReply: string, context: string, email: Partial<Email>): string {
    // Enhance the local AI reply with contextual information
    const enhancedReply = `
${baseReply}

---
Contextual Information:
${context}

This reply was generated using local AI with contextual information about the OneBox Email Aggregator project. The system analyzed the email content and provided relevant context to generate this response.
    `.trim();
    
    return enhancedReply;
  }

  async updateProductContext(newContext: ProductContext): Promise<void> {
    try {
      // Update the AI service context
      this.aiService.updateProductContext(newContext);
      
      // Update the vector database
      await this.storeProductContext(newContext);
      
      logger.info('✅ Product context updated in both AI service and vector database');
    } catch (error) {
      logger.error('❌ Error updating product context:', error);
      throw error;
    }
  }

  async searchSimilarEmails(email: Partial<Email>, limit: number = 5): Promise<Email[]> {
    try {
      const query = `${email.subject} ${email.body}`.substring(0, 1000);
      const queryEmbedding = await this.generateEmbedding(query);
      
      const response = await elasticsearchClient.search({
        index: EMAIL_INDEX,
        body: {
          query: {
            bool: {
              must: [
                {
                  script_score: {
                    query: { match_all: {} },
                    script: {
                      source: "cosineSimilarity(params.query_vector, 'embedding') + 1.0",
                      params: { query_vector: queryEmbedding }
                    }
                  }
                }
              ],
              must_not: [
                { term: { id: email.id } } // Exclude the current email
              ]
            }
          },
          size: limit
        }
      });

      return response.hits.hits.map((hit: any) => ({
        ...(hit._source || {}),
        id: hit._id || ''
      })) as Email[];
    } catch (error) {
      logger.error('❌ Error searching similar emails:', error);
      return [];
    }
  }

  async addEmailEmbedding(email: Email): Promise<void> {
    try {
      const content = `${email.subject} ${email.body}`.substring(0, 1000);
      const embedding = await this.generateEmbedding(content);
      
      await elasticsearchClient.update({
        index: EMAIL_INDEX,
        id: email.id,
        body: {
          doc: {
            embedding
          }
        }
      });
      
      logger.info(`✅ Added embedding for email: ${email.id}`);
    } catch (error) {
      logger.error('❌ Error adding email embedding:', error);
    }
  }
}
