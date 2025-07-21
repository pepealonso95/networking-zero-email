# CRM Database Schema Design

Based on the existing Zero app database patterns, here's the proposed CRM schema:

## Schema Design Principles

Following the existing patterns:
- Using `createTable` with `mail0_` prefix
- Text IDs as primary keys (UUIDs)
- Standard `createdAt`/`updatedAt` timestamps
- Proper foreign key relationships with cascading deletes
- JSONB for flexible metadata
- Consistent naming conventions

## Core CRM Tables

### 1. Contact Table
```typescript
export const contact = createTable('contact', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  fullName: text('full_name'), // computed/display name
  phone: text('phone'),
  company: text('company'),
  jobTitle: text('job_title'),
  linkedinUrl: text('linkedin_url'),
  twitterHandle: text('twitter_handle'),
  website: text('website'),
  notes: text('notes'), // general notes
  tags: text('tags'), // comma-separated tags for quick filtering
  priority: text('priority').$type<'high' | 'medium' | 'low'>().default('medium'),
  status: text('status').$type<'active' | 'inactive' | 'archived'>().default('active'),
  leadSource: text('lead_source'), // how we found them
  lastContactedAt: timestamp('last_contacted_at'),
  metadata: jsonb('metadata'), // flexible additional data
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  unique().on(t.userId, t.email), // one contact per email per user
]);
```

### 2. Contact Interaction Table
```typescript
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
  subject: text('subject'), // email subject or meeting title
  content: text('content'), // interaction details/notes
  emailThreadId: text('email_thread_id'), // link to email thread if applicable
  scheduledAt: timestamp('scheduled_at'), // for planned interactions
  completedAt: timestamp('completed_at'), // when interaction was completed
  metadata: jsonb('metadata'), // additional context (email IDs, meeting links, etc.)
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

### 3. Contact Company Table (Optional - could be part of contact)
```typescript
export const contactCompany = createTable('contact_company', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  website: text('website'),
  industry: text('industry'),
  size: text('size').$type<'1-10' | '11-50' | '51-200' | '201-1000' | '1000+'>(),
  location: text('location'),
  description: text('description'),
  linkedinUrl: text('linkedin_url'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  unique().on(t.userId, t.name), // one company per name per user
]);
```

### 4. Contact Tags Table (For organized tagging)
```typescript
export const contactTag = createTable('contact_tag', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color').default('#6366f1'), // hex color for UI
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  unique().on(t.userId, t.name), // unique tag names per user
]);
```

### 5. Contact Tag Relations (Many-to-Many)
```typescript
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
```

## Key Features Supported

1. **Contact Management**: Full contact profiles with flexible metadata
2. **Interaction Tracking**: Track all touchpoints with timestamps
3. **Company Information**: Optional company association
4. **Tagging System**: Flexible labeling and categorization
5. **Email Integration**: Links to email threads and automatic interaction creation
6. **Priority & Status**: Contact prioritization and lifecycle management
7. **Search & Filtering**: Optimized for querying by tags, company, last contact, etc.
8. **Data Ownership**: All data scoped to user with proper cascade deletes

## Integration Points

1. **Email Threads**: `contactInteraction.emailThreadId` links to existing email system
2. **User System**: All tables reference existing `user.id`
3. **Automatic Contact Creation**: New email senders can auto-create contacts
4. **Interaction Auto-tracking**: Email sends/receives create interaction records
5. **Search Integration**: Contacts can be searched via existing command palette

## Migration Strategy

1. Add tables incrementally
2. Start with basic `contact` table
3. Add `contactInteraction` for tracking
4. Extend with tagging system
5. Integrate with email workflows