import { elasticsearchClient, EMAIL_INDEX } from '../config/elasticsearch';
import { Email, EmailSearchFilters, PaginatedResponse } from '../types';
import { logger } from '../utils/logger';

export class ElasticsearchService {
  async indexEmail(email: Partial<Email>): Promise<void> {
    try {
      await elasticsearchClient.index({
        index: EMAIL_INDEX,
        id: email.id,
        body: {
          ...email,
          // Ensure dates are properly formatted
          date: email.date?.toISOString(),
          createdAt: email.createdAt?.toISOString(),
          updatedAt: email.updatedAt?.toISOString(),
        }
      });
      
      logger.info(`✅ Indexed email: ${email.subject}`);
    } catch (error) {
      logger.error('❌ Error indexing email:', error);
      throw error;
    }
  }

  async searchEmails(filters: EmailSearchFilters): Promise<PaginatedResponse<Email>> {
    try {
      const {
        accountId,
        folder,
        category,
        dateFrom,
        dateTo,
        isRead,
        query,
        limit = 20,
        offset = 0
      } = filters;

      const mustQueries: any[] = [];
      const shouldQueries: any[] = [];

      // Account filter
      if (accountId) {
        mustQueries.push({ term: { accountId } });
      }

      // Folder filter
      if (folder) {
        mustQueries.push({ term: { folder } });
      }

      // Category filter
      if (category) {
        mustQueries.push({ term: { category } });
      }

      // Date range filter
      if (dateFrom || dateTo) {
        const dateRange: any = {};
        if (dateFrom) {
          const fromDate = typeof dateFrom === 'string' ? new Date(dateFrom) : dateFrom;
          dateRange.gte = fromDate.toISOString();
          console.log('📅 Date filter FROM:', dateFrom, '->', fromDate.toISOString());
        }
        if (dateTo) {
          const toDate = typeof dateTo === 'string' ? new Date(dateTo) : dateTo;
          dateRange.lte = toDate.toISOString();
          console.log('📅 Date filter TO:', dateTo, '->', toDate.toISOString());
        }
        console.log('📅 Final date range filter:', dateRange);
        mustQueries.push({ range: { date: dateRange } });
      }

      // Read status filter
      if (typeof isRead === 'boolean') {
        mustQueries.push({ term: { isRead } });
      }

      // Text search
      if (query) {
        shouldQueries.push(
          { match: { subject: { query, boost: 2 } } },
          { match: { body: query } },
          { match: { from: { query, boost: 1.5 } } },
          { match: { to: query } }
        );
      }

      const searchBody: any = {
        query: {
          bool: {
            must: mustQueries,
            should: shouldQueries,
            minimum_should_match: shouldQueries.length > 0 ? 1 : 0
          }
        },
        sort: [
          { date: { order: 'desc' } }
        ],
        from: offset,
        size: limit
      };

      const response = await elasticsearchClient.search({
        index: EMAIL_INDEX,
        body: searchBody
      });

      const emails = response.hits.hits.map((hit: any) => ({
        ...(hit._source || {}),
        id: hit._id || ''
      }));

      const total = typeof response.hits.total === 'number' ? response.hits.total : response.hits.total?.value || 0;

      return {
        success: true,
        data: emails,
        pagination: {
          total,
          page: Math.floor(offset / limit) + 1,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('❌ Error searching emails:', error);
      throw error;
    }
  }

  async findEmailByMessageId(messageId: string): Promise<Email | null> {
    try {
      const response = await elasticsearchClient.search({
        index: EMAIL_INDEX,
        body: {
          query: {
            term: { messageId }
          }
        }
      });

      if (response.hits.hits.length > 0) {
        const hit = response.hits.hits[0];
        return {
          ...(hit._source || {}),
          id: hit._id || ''
        } as Email;
      }

      return null;
    } catch (error) {
      logger.error('❌ Error finding email by message ID:', error);
      return null;
    }
  }

  async findEmailById(id: string): Promise<Email | null> {
    try {
      const response = await elasticsearchClient.get({
        index: EMAIL_INDEX,
        id: id
      });

      if (response._source) {
        return {
          ...(response._source || {}),
          id: response._id || ''
        } as Email;
      }

      return null;
    } catch (error: any) {
      // If document not found, return null instead of throwing
      if (error.statusCode === 404) {
        return null;
      }
      logger.error('❌ Error finding email by ID:', error);
      return null;
    }
  }

  async updateEmail(id: string, updates: Partial<Email>): Promise<void> {
    try {
      await elasticsearchClient.update({
        index: EMAIL_INDEX,
        id,
        body: {
          doc: {
            ...updates,
            updatedAt: new Date().toISOString()
          }
        }
      });
      
      logger.info(`✅ Updated email: ${id}`);
    } catch (error) {
      logger.error('❌ Error updating email:', error);
      throw error;
    }
  }

  async deleteEmail(id: string): Promise<void> {
    try {
      await elasticsearchClient.delete({
        index: EMAIL_INDEX,
        id
      });
      
      logger.info(`✅ Deleted email: ${id}`);
    } catch (error) {
      logger.error('❌ Error deleting email:', error);
      throw error;
    }
  }

  async deleteAllEmails(): Promise<void> {
    try {
      // Delete all documents from the emails index
      await elasticsearchClient.deleteByQuery({
        index: EMAIL_INDEX,
        body: {
          query: {
            match_all: {}
          }
        }
      });
      
      logger.info('✅ Deleted all emails from Elasticsearch');
    } catch (error) {
      logger.error('❌ Error deleting all emails:', error);
      throw error;
    }
  }

  async getEmailStats(accountId?: string): Promise<any> {
    try {
      const mustQueries: any[] = [];
      
      if (accountId) {
        mustQueries.push({ term: { accountId } });
      }

      const response = await elasticsearchClient.search({
        index: EMAIL_INDEX,
        body: {
          query: {
            bool: {
              must: mustQueries
            }
          },
          aggs: {
            total_emails: {
              value_count: {
                field: 'id'
              }
            },
            by_category: {
              terms: {
                field: 'category',
                size: 10
              }
            },
            by_folder: {
              terms: {
                field: 'folder',
                size: 10
              }
            },
            by_account: {
              terms: {
                field: 'accountId',
                size: 10
              }
            },
            unread_count: {
              filter: {
                term: { isRead: false }
              }
            },
            recent_emails: {
              filter: {
                range: {
                  date: {
                    gte: 'now-7d'
                  }
                }
              }
            }
          },
          size: 0
        }
      });

      const aggs = response.aggregations as any;
      return {
        total: aggs?.total_emails?.value || 0,
        byCategory: aggs?.by_category?.buckets || [],
        byFolder: aggs?.by_folder?.buckets || [],
        byAccount: aggs?.by_account?.buckets || [],
        unreadCount: aggs?.unread_count?.doc_count || 0,
        recentCount: aggs?.recent_emails?.doc_count || 0
      };
    } catch (error) {
      logger.error('❌ Error getting email stats:', error);
      throw error;
    }
  }

  async bulkIndexEmails(emails: Partial<Email>[]): Promise<void> {
    try {
      const body: any[] = [];
      
      emails.forEach(email => {
        body.push({
          index: {
            _index: EMAIL_INDEX,
            _id: email.id
          }
        });
        
        body.push({
          ...email,
          date: email.date?.toISOString(),
          createdAt: email.createdAt?.toISOString(),
          updatedAt: email.updatedAt?.toISOString(),
        });
      });

      const response = await elasticsearchClient.bulk({ body });
      
      if (response.errors) {
        logger.error('❌ Some emails failed to index:', response.items);
      } else {
        logger.info(`✅ Bulk indexed ${emails.length} emails`);
      }
    } catch (error) {
      logger.error('❌ Error bulk indexing emails:', error);
      throw error;
    }
  }

  async refreshIndex(): Promise<void> {
    try {
      await elasticsearchClient.indices.refresh({ index: EMAIL_INDEX });
      logger.info('✅ Refreshed Elasticsearch index');
    } catch (error) {
      logger.error('❌ Error refreshing index:', error);
      throw error;
    }
  }
}
