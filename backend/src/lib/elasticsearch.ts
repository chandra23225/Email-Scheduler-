import { Client } from '@elastic/elasticsearch';
import { logger } from './logger';

const ES_URL = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';

export const esClient = new Client({
  node: ES_URL,
  auth:
    process.env.ELASTICSEARCH_USERNAME
      ? {
          username: process.env.ELASTICSEARCH_USERNAME,
          password: process.env.ELASTICSEARCH_PASSWORD || '',
        }
      : undefined,
});

export const EMAIL_INDEX = 'email_jobs';

export interface EmailDocument {
  id: string;
  userId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt?: string | null;
  batchId?: string | null;
  createdAt: string;
}

/**
 * Ensure the index and mapping exist.
 */
export async function ensureEmailIndex(): Promise<void> {
  try {
    const exists = await esClient.indices.exists({ index: EMAIL_INDEX });
    if (!exists) {
      await esClient.indices.create({
        index: EMAIL_INDEX,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            userId: { type: 'keyword' },
            senderEmail: { type: 'keyword' },
            recipientEmail: { type: 'keyword' },
            subject: { type: 'text', analyzer: 'standard' },
            body: { type: 'text', analyzer: 'standard' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
            batchId: { type: 'keyword' },
            createdAt: { type: 'date' },
          },
        },
      });
      logger.info(`Elasticsearch index "${EMAIL_INDEX}" created`);
    }
  } catch (err) {
    logger.error('Failed to ensure Elasticsearch index', { err });
  }
}

/**
 * Index (upsert) a single email document.
 */
export async function indexEmail(doc: EmailDocument): Promise<void> {
  try {
    await esClient.index({
      index: EMAIL_INDEX,
      id: doc.id,
      document: doc,
    });
  } catch (err) {
    logger.error('Failed to index email in Elasticsearch', { err, id: doc.id });
  }
}

/**
 * Update the status (and optional sentAt) of an existing document.
 */
export async function updateEmailStatus(
  id: string,
  status: string,
  sentAt?: string | null
): Promise<void> {
  try {
    await esClient.update({
      index: EMAIL_INDEX,
      id,
      doc: { status, ...(sentAt !== undefined ? { sentAt } : {}) },
    });
  } catch (err) {
    logger.error('Failed to update email status in Elasticsearch', { err, id });
  }
}

/**
 * Full-text search across subject, body, sender, recipient.
 */
export async function searchEmails(
  userId: string,
  query: string,
  status?: string,
  from = 0,
  size = 20
): Promise<{ hits: EmailDocument[]; total: number; available: boolean }> {
  try {
    const must: object[] = [{ term: { userId } }];

    if (query) {
      must.push({
        multi_match: {
          query,
          fields: ['subject', 'body', 'senderEmail', 'recipientEmail'],
        },
      });
    }

    if (status) {
      must.push({ term: { status } });
    }

    const result = await esClient.search<EmailDocument>({
      index: EMAIL_INDEX,
      from,
      size,
      query: { bool: { must } },
      sort: [{ scheduledAt: { order: 'desc' } }],
    });

    const hits = result.hits.hits
      .map((h) => h._source)
      .filter(Boolean) as EmailDocument[];

    const total =
      typeof result.hits.total === 'number'
        ? result.hits.total
        : result.hits.total?.value ?? 0;

    return { hits, total, available: true };
  } catch (err) {
    logger.error('Elasticsearch search failed', { err });
    return { hits: [], total: 0, available: false };
  }
}
