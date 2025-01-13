import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const leads = sqliteTable('leads', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  createdAt: integer({ mode: 'timestamp' }).notNull(),
  leadName: text('leadName'),
  leadEmail: text('leadEmail'),
  leadPhone: text('leadPhone'),
  weddingVenue: text('weddingVenue'),
  inquiryDetails: text('inquiryDetails'),
});


