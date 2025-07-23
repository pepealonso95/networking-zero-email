import {
  pgTableCreator,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  primaryKey,
  unique,
} from 'drizzle-orm/pg-core';
import { defaultUserSettings } from '../lib/schemas';

export const createTable = pgTableCreator((name) => `mail0_${name}`);

export const user = createTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  defaultConnectionId: text('default_connection_id'),
  customPrompt: text('custom_prompt'),
  phoneNumber: text('phone_number').unique(),
  phoneNumberVerified: boolean('phone_number_verified'),
});

export const session = createTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id),
});

export const account = createTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const userHotkeys = createTable('user_hotkeys', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id),
  shortcuts: jsonb('shortcuts').notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const verification = createTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
});

export const earlyAccess = createTable('early_access', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  isEarlyAccess: boolean('is_early_access').notNull().default(false),
  hasUsedTicket: text('has_used_ticket').default(''),
});

export const connection = createTable(
  'connection',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id),
    email: text('email').notNull(),
    name: text('name'),
    picture: text('picture'),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    scope: text('scope').notNull(),
    providerId: text('provider_id').$type<'google' | 'microsoft'>().notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (t) => [unique().on(t.userId, t.email)],
);

export const summary = createTable('summary', {
  messageId: text('message_id').primaryKey(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  connectionId: text('connection_id').notNull(),
  saved: boolean('saved').notNull().default(false),
  tags: text('tags'),
  suggestedReply: text('suggested_reply'),
});

// Testing
export const note = createTable('note', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  threadId: text('thread_id').notNull(),
  content: text('content').notNull(),
  color: text('color').notNull().default('default'),
  isPinned: boolean('is_pinned').default(false),
  order: integer('order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const userSettings = createTable('user_settings', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id)
    .unique(),
  settings: jsonb('settings').notNull().default(defaultUserSettings),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const writingStyleMatrix = createTable(
  'writing_style_matrix',
  {
    connectionId: text()
      .notNull()
      .references(() => connection.id, { onDelete: 'cascade' }),
    numMessages: integer().notNull(),
    // TODO: way too much pain to get this type to work,
    // revisit later
    style: jsonb().$type<unknown>().notNull(),
    updatedAt: timestamp()
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => {
    return [
      primaryKey({
        columns: [table.connectionId],
      }),
    ];
  },
);

// CRM Tables
export const contact = createTable('contact', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  fullName: text('full_name'),
  phone: text('phone'),
  company: text('company'),
  jobTitle: text('job_title'),
  linkedinUrl: text('linkedin_url'),
  twitterHandle: text('twitter_handle'),
  website: text('website'),
  notes: text('notes'),
  tags: text('tags'),
  priority: text('priority').$type<'high' | 'medium' | 'low'>().default('medium'),
  status: text('status').$type<'active' | 'inactive' | 'archived'>().default('active'),
  leadSource: text('lead_source'),
  lastContactedAt: timestamp('last_contacted_at'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  unique().on(t.userId, t.email),
]);

export const contactInteraction = createTable('contact_interaction', {
  id: text('id').primaryKey(),
  contactId: text('contact_id')
    .notNull()
    .references(() => contact.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  type: text('type').$type<'email' | 'phone' | 'meeting' | 'note' | 'other'>().notNull(),
  direction: text('direction').$type<'inbound' | 'outbound'>(),
  subject: text('subject'),
  content: text('content'),
  emailThreadId: text('email_thread_id'),
  scheduledAt: timestamp('scheduled_at'),
  completedAt: timestamp('completed_at'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const contactTag = createTable('contact_tag', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color').default('#6366f1'),
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  unique().on(t.userId, t.name),
]);

export const contactTagRelation = createTable('contact_tag_relation', {
  contactId: text('contact_id')
    .notNull()
    .references(() => contact.id, { onDelete: 'cascade' }),
  tagId: text('tag_id')
    .notNull()
    .references(() => contactTag.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.contactId, t.tagId] }),
]);

export const contactEmailSync = createTable('contact_email_sync', {
  id: text('id').primaryKey(),
  contactId: text('contact_id')
    .notNull()
    .references(() => contact.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  lastSyncAt: timestamp('last_sync_at').notNull(),
  lastInboxMessageId: text('last_inbox_message_id'), // Last processed message ID from inbox
  lastSentMessageId: text('last_sent_message_id'), // Last processed message ID from sent
  inboxSyncToken: text('inbox_sync_token'), // For Gmail sync tokens
  sentSyncToken: text('sent_sync_token'), // For Gmail sync tokens
  historicSyncCompleted: boolean('historic_sync_completed').default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  unique().on(t.contactId, t.userId),
]);

// Lead generation tables
export const lead = createTable('lead', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  email: text('email').notNull(), // Required - we only save leads with emails
  firstName: text('first_name'),
  lastName: text('last_name'),
  fullName: text('full_name'),
  company: text('company'),
  jobTitle: text('job_title'),
  linkedinUrl: text('linkedin_url'),
  phoneNumber: text('phone_number'),
  location: text('location'),
  source: text('source').$type<'hunter' | 'apollo' | 'snov' | 'pdl' | 'linkedin_official' | 'linkedin_sales_nav' | 'linkedin_scraping' | 'linkedin_alternative' | 'manual'>().notNull(),
  confidence: integer('confidence'), // 0-100 confidence score
  verified: boolean('verified').default(false),
  addedToCrm: boolean('added_to_crm').default(false),
  contactId: text('contact_id').references(() => contact.id, { onDelete: 'set null' }), // If converted to contact
  countryOfOrigin: text('country_of_origin'), // Inferred country of origin
  educationHistory: jsonb('education_history'), // Array of education records
  workHistory: jsonb('work_history'), // Array of work experience records
  inferredOrigin: jsonb('inferred_origin'), // Origin inference data with confidence
  metadata: jsonb('metadata'), // Store additional data from APIs
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  unique().on(t.userId, t.email),
]);

export const leadSearch = createTable('lead_search', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  originalPrompt: text('original_prompt').notNull(),
  processedCriteria: jsonb('processed_criteria'), // AI-processed search criteria
  resultsCount: integer('results_count').default(0),
  apiUsage: jsonb('api_usage'), // Track usage per service: {hunter: 5, apollo: 10}
  status: text('status').$type<'pending' | 'processing' | 'completed' | 'failed'>().default('pending'),
  error: text('error'), // Store error message if failed
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
});

// Calendar tables
export const calendarEvent = createTable('calendar_event', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  googleEventId: text('google_event_id'), // Google Calendar event ID for sync
  calendarId: text('calendar_id'), // Google Calendar ID
  title: text('title').notNull(),
  description: text('description'),
  location: text('location'),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  isAllDay: boolean('is_all_day').default(false),
  timeZone: text('time_zone').default('UTC'),
  source: text('source').$type<'google' | 'zero' | 'booking'>().notNull().default('zero'),
  meetingLink: text('meeting_link'), // Google Meet or other meeting links
  attendees: jsonb('attendees'), // Array of attendee objects {email, name, status}
  recurrence: jsonb('recurrence'), // Recurrence rules
  status: text('status').$type<'confirmed' | 'tentative' | 'cancelled'>().default('confirmed'),
  visibility: text('visibility').$type<'public' | 'private'>().default('private'),
  lastSyncAt: timestamp('last_sync_at'),
  metadata: jsonb('metadata'), // Additional Google Calendar metadata
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  unique().on(t.userId, t.googleEventId),
]);

export const availabilitySlot = createTable('availability_slot', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(), // e.g., "30-min Meeting", "Coffee Chat"
  description: text('description'),
  duration: integer('duration').notNull(), // Duration in minutes
  dayOfWeek: integer('day_of_week').notNull(), // 0-6 (Sunday-Saturday)
  startTime: text('start_time').notNull(), // Format: "HH:MM"
  endTime: text('end_time').notNull(), // Format: "HH:MM"
  timeZone: text('time_zone').notNull().default('UTC'),
  buffer: integer('buffer').default(0), // Buffer time between meetings in minutes
  maxBookings: integer('max_bookings').default(1), // Max bookings per slot
  isActive: boolean('is_active').default(true),
  allowWeekends: boolean('allow_weekends').default(false),
  bookingWindow: integer('booking_window').default(30), // Days in advance bookings allowed
  meetingType: text('meeting_type').$type<'google-meet' | 'phone' | 'in-person' | 'custom'>().default('google-meet'),
  questions: jsonb('questions'), // Array of custom questions for bookers
  autoConfirm: boolean('auto_confirm').default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const meetingRequest = createTable('meeting_request', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  availabilitySlotId: text('availability_slot_id')
    .notNull()
    .references(() => availabilitySlot.id, { onDelete: 'cascade' }),
  bookerName: text('booker_name').notNull(),
  bookerEmail: text('booker_email').notNull(),
  bookerPhone: text('booker_phone'),
  requestedTime: timestamp('requested_time').notNull(),
  duration: integer('duration').notNull(),
  timeZone: text('time_zone').notNull(),
  message: text('message'), // Optional message from booker
  responses: jsonb('responses'), // Answers to custom questions
  status: text('status').$type<'pending' | 'confirmed' | 'cancelled' | 'completed'>().default('pending'),
  eventId: text('event_id').references(() => calendarEvent.id, { onDelete: 'set null' }), // Created event after confirmation
  cancellationReason: text('cancellation_reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  confirmedAt: timestamp('confirmed_at'),
  cancelledAt: timestamp('cancelled_at'),
});

export const calendarSync = createTable('calendar_sync', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' })
    .unique(),
  googleCalendarId: text('google_calendar_id'), // Primary calendar ID
  syncToken: text('sync_token'), // Google Calendar sync token
  lastSyncAt: timestamp('last_sync_at'),
  lastFullSyncAt: timestamp('last_full_sync_at'),
  syncStatus: text('sync_status').$type<'active' | 'paused' | 'error'>().default('active'),
  syncError: text('sync_error'), // Last sync error message
  settings: jsonb('settings'), // User calendar sync preferences
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
