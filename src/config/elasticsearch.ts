import { Client } from '@elastic/elasticsearch';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
});

export const elasticsearchClient = client;

// Wait for Elasticsearch to be ready
export const waitForElasticsearch = async (maxRetries = 30, delay = 2000): Promise<boolean> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await client.ping();
      console.log('✅ Elasticsearch is ready');
      return true;
    } catch (error) {
      console.log(`⏳ Waiting for Elasticsearch... (attempt ${i + 1}/${maxRetries})`);
      if (i === maxRetries - 1) {
        throw new Error('Elasticsearch failed to start after maximum retries');
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return false; // This should never be reached, but satisfies TypeScript
};

export const EMAIL_INDEX = process.env.ELASTICSEARCH_INDEX || 'emails';

export const createEmailIndex = async () => {
  try {
    const exists = await client.indices.exists({ index: EMAIL_INDEX });
    
    if (!exists) {
      await client.indices.create({
        index: EMAIL_INDEX,
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              accountId: { type: 'keyword' },
              messageId: { type: 'keyword' },
              subject: { 
                type: 'text',
                analyzer: 'standard',
                fields: {
                  keyword: { type: 'keyword' }
                }
              },
              from: { 
                type: 'text',
                analyzer: 'standard',
                fields: {
                  keyword: { type: 'keyword' }
                }
              },
              to: { 
                type: 'text',
                analyzer: 'standard',
                fields: {
                  keyword: { type: 'keyword' }
                }
              },
              cc: { 
                type: 'text',
                analyzer: 'standard',
                fields: {
                  keyword: { type: 'keyword' }
                }
              },
              body: { 
                type: 'text',
                analyzer: 'standard'
              },
              htmlBody: { 
                type: 'text',
                analyzer: 'standard'
              },
              folder: { type: 'keyword' },
              isRead: { type: 'boolean' },
              isFlagged: { type: 'boolean' },
              category: { type: 'keyword' },
              aiCategory: { type: 'keyword' },
              aiConfidence: { type: 'float' },
              suggestedReply: { type: 'text' },
              date: { type: 'date' },
              createdAt: { type: 'date' },
              updatedAt: { type: 'date' }
            }
          },
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
            analysis: {
              analyzer: {
                email_analyzer: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: ['lowercase', 'stop', 'snowball']
                }
              }
            }
          }
        }
      });
      
      console.log(`✅ Elasticsearch index '${EMAIL_INDEX}' created successfully`);
    } else {
      console.log(`ℹ️  Elasticsearch index '${EMAIL_INDEX}' already exists`);
    }
  } catch (error) {
    console.error('❌ Error creating Elasticsearch index:', error);
    throw error;
  }
};

export default client;
