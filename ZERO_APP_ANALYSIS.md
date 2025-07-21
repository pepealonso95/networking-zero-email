# Zero Email App - Comprehensive Architecture Analysis

## Table of Contents
1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Directory Structure](#directory-structure)
4. [Frontend Architecture](#frontend-architecture)
5. [Backend Architecture](#backend-architecture)
6. [Database Schema](#database-schema)
7. [Authentication System](#authentication-system)
8. [State Management](#state-management)
9. [API Layer (tRPC)](#api-layer-trpc)
10. [UI Patterns & Components](#ui-patterns--components)
11. [Navigation & Routing](#navigation--routing)
12. [Internationalization](#internationalization)
13. [Business Model & Billing](#business-model--billing)
14. [Data Flow](#data-flow)
15. [CRM Implementation Guidance](#crm-implementation-guidance)

## Project Overview

Zero is a modern email application built with a monorepo structure using:
- **Frontend**: React Router v7 + Cloudflare Pages + TypeScript
- **Backend**: Hono.js + Cloudflare Workers + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Package Manager**: pnpm with workspaces
- **Authentication**: Better Auth
- **Billing**: Autumn.js

## Technology Stack

### Core Technologies
- **Frontend Framework**: React 19 + React Router v7
- **Backend Framework**: Hono.js (Cloudflare Workers)
- **Database**: PostgreSQL + Drizzle ORM
- **Type Safety**: TypeScript + tRPC
- **Styling**: Tailwind CSS + Shadcn/ui
- **State Management**: Jotai + TanStack Query
- **Authentication**: Better Auth with social providers
- **Billing**: Autumn.js
- **Deployment**: Cloudflare (Pages + Workers)

### Key Libraries
- **UI Components**: Radix UI + Shadcn/ui
- **Rich Text Editor**: TipTap/ProseMirror
- **Email Rendering**: React Email
- **Date Handling**: date-fns
- **Form Handling**: React Hook Form + Zod
- **Drag & Drop**: DND Kit
- **Virtualization**: Virtua
- **Hot Keys**: react-hotkeys-hook
- **Internationalization**: use-intl

## Directory Structure

```
Zero/
├── apps/
│   ├── mail/           # Frontend React application
│   └── server/         # Backend Hono.js API
├── packages/           # Shared packages (removed in recent refactor)
├── scripts/           # Development and deployment scripts
└── email-classifier/ # ML email classification service (deprecated)
```

### Frontend Structure (`apps/mail/`)
```
mail/
├── app/                    # React Router app directory
│   ├── (auth)/            # Authentication routes
│   ├── (full-width)/      # Marketing pages
│   ├── (routes)/          # Protected app routes
│   │   ├── mail/          # Email interface
│   │   └── settings/      # Settings pages
│   ├── globals.css        # Global styles
│   └── routes.ts          # Route configuration
├── components/            # React components
│   ├── ui/               # Base UI components
│   ├── mail/             # Email-specific components
│   ├── create/           # Compose/creation components
│   ├── settings/         # Settings components
│   └── context/          # React contexts
├── hooks/                # Custom React hooks
├── lib/                  # Utilities and configurations
├── locales/              # Internationalization files
├── providers/            # React providers
├── public/               # Static assets
└── store/                # Jotai atoms
```

### Backend Structure (`apps/server/`)
```
server/
├── src/
│   ├── db/               # Database schema and migrations
│   ├── lib/              # Utilities and services
│   │   ├── driver/       # Email provider drivers (Google, Microsoft)
│   │   └── auth.ts       # Authentication configuration
│   ├── routes/           # API route handlers
│   ├── services/         # Business logic services
│   ├── trpc/             # tRPC router configuration
│   │   └── routes/       # tRPC route definitions
│   └── main.ts           # Application entry point
└── drizzle.config.ts     # Database configuration
```

## Frontend Architecture

### Component Organization
- **Base UI Components** (`components/ui/`): Reusable, generic components
- **Feature Components** (`components/mail/`, `components/create/`): Domain-specific components
- **Layout Components**: Sidebar, navigation, settings layout
- **Provider Components**: Context providers, query providers

### Key Architectural Patterns
1. **Component Composition**: Heavy use of compound components and render props
2. **Custom Hooks**: Business logic encapsulated in custom hooks
3. **Context + Hooks**: State management with React Context and custom hooks
4. **Optimistic Updates**: Immediate UI updates with background sync
5. **Virtual Scrolling**: Performance optimization for large email lists

### State Management Strategy
- **Global State**: Jotai atoms for application-wide state
- **Server State**: TanStack Query for API data caching
- **Form State**: React Hook Form for complex forms
- **URL State**: nuqs for URL-synchronized state
- **Local State**: useState for component-specific state

## Backend Architecture

### Service Architecture
- **Hono.js Framework**: Lightweight, fast web framework
- **Driver Pattern**: Abstracted email providers (Google Gmail, Microsoft Outlook)
- **tRPC Layer**: Type-safe API with automatic client generation
- **Middleware Pattern**: Authentication, rate limiting, error handling

### Key Services
1. **Email Driver Service**: Unified interface for email providers
2. **Authentication Service**: Better Auth with social providers
3. **AI/Brain Service**: Email classification and AI features
4. **Writing Style Service**: User writing pattern analysis
5. **Notes Service**: Thread annotations and notes

### Email Provider Integration
- **Google Gmail API**: OAuth2 + REST API
- **Microsoft Graph API**: OAuth2 + REST API
- **Unified Driver Interface**: Consistent API across providers

## Database Schema

### Core Tables
```sql
-- Users and Authentication
mail0_user              # User accounts
mail0_session           # User sessions
mail0_account           # OAuth accounts
mail0_connection        # Email provider connections

-- Settings and Preferences
mail0_user_settings     # User preferences (JSON)
mail0_user_hotkeys      # Custom keyboard shortcuts

-- Email Features
mail0_summary           # AI-generated email summaries
mail0_note              # User notes on email threads
mail0_writing_style_matrix # AI writing style analysis

-- System
mail0_verification      # Email/phone verification
mail0_early_access      # Beta access management
```

### Key Relationships
- `user` → `connection` (1:many): Users can connect multiple email accounts
- `user` → `note` (1:many): Users can add notes to email threads
- `connection` → `summary` (1:many): AI summaries per email connection
- `connection` → `writing_style_matrix` (1:1): Writing analysis per connection

## Authentication System

### Better Auth Configuration
- **Providers**: Google OAuth2, Microsoft OAuth2
- **Features**: Email verification, phone verification, account linking
- **Security**: Session management, CSRF protection, rate limiting
- **Multi-Account**: Users can link multiple email providers

### Connection Management
- **OAuth Flow**: Standard OAuth2 with PKCE
- **Token Refresh**: Automatic token refresh handling
- **Connection Validation**: Health checks for email connections
- **Account Linking**: Multiple email accounts per user

## API Layer (tRPC)

### Router Structure
```typescript
appRouter = {
  ai: aiRouter,           # AI features (compose, search)
  brain: brainRouter,     # Email classification
  connections: connectionsRouter,  # Email account management
  drafts: draftsRouter,   # Draft management
  labels: labelsRouter,   # Email labeling
  mail: mailRouter,       # Core email operations
  notes: notesRouter,     # Thread notes
  settings: settingsRouter, # User preferences
  user: userRouter,       # User account operations
}
```

### Key API Patterns
1. **Type Safety**: Full TypeScript inference from server to client
2. **Input Validation**: Zod schemas for all inputs
3. **Rate Limiting**: Upstash Redis-based rate limiting
4. **Error Handling**: Structured error responses
5. **Optimistic Updates**: Client-side optimistic mutations

## UI Patterns & Components

### Design System
- **Base**: Shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens
- **Theming**: Dark/light mode with CSS variables
- **Icons**: Custom SVG icon set + Lucide React

### Key UI Patterns
1. **Resizable Panels**: react-resizable-panels for layout
2. **Virtual Scrolling**: Virtua for large lists
3. **Command Palette**: Global search and actions
4. **Toast Notifications**: Sonner for user feedback
5. **Dialog System**: Modal dialogs with proper accessibility
6. **Sidebar Navigation**: Collapsible sidebar with context-aware content

### Component Architecture
```typescript
// Example component structure
export function MailComponent() {
  // 1. Hooks for data fetching
  const { data, isLoading } = useQuery(...)
  
  // 2. Local state management
  const [state, setState] = useState(...)
  
  // 3. Event handlers
  const handleAction = useCallback(...)
  
  // 4. Render with composition
  return (
    <ComponentProvider>
      <ChildComponent />
    </ComponentProvider>
  )
}
```

## Navigation & Routing

### Route Structure
```typescript
// React Router v7 file-based routing
routes = [
  route('/mail/*', 'mail/layout.tsx', [
    index('inbox'),           # /mail → /mail/inbox
    route('/:folder'),        # /mail/sent, /mail/draft
    route('/compose'),        # Compose modal
  ]),
  route('/settings/*', 'settings/layout.tsx', [
    route('/general'),        # Settings pages
    route('/connections'),
    route('/labels'),
    // ...
  ])
]
```

### Navigation Configuration
- **Sidebar Navigation**: Context-aware sidebar with sections
- **Keyboard Shortcuts**: Global hotkey system
- **Breadcrumbs**: Automatic breadcrumb generation
- **Deep Linking**: URL state synchronization

## Internationalization

### i18n Strategy
- **Library**: use-intl with JSON translation files
- **Languages**: 20+ supported languages
- **Key Structure**: Hierarchical key organization
- **Type Safety**: TypeScript integration for translation keys
- **Fallbacks**: Graceful fallback to English

### Translation Organization
```json
{
  "common": {
    "actions": { "save": "Save", "cancel": "Cancel" },
    "navigation": { "inbox": "Inbox", "sent": "Sent" }
  },
  "mail": {
    "compose": { "subject": "Subject", "body": "Message" }
  }
}
```

## Business Model & Billing

### Autumn.js Integration
- **Features**: Usage-based billing with feature gates
- **Plans**: Free tier + Pro subscription
- **Features Tracked**: AI chat messages, email connections, auto-labeling

### Feature Gating
```typescript
// Example feature check
const { isPro, chatMessages } = useBilling()

if (!isPro && chatMessages.remaining <= 0) {
  // Show upgrade prompt
  return <UpgradeDialog />
}
```

## Data Flow

### Typical Email Operations Flow
```
User Action → Optimistic Update → API Call → Background Sync → UI Update
```

1. **User Interaction**: Click archive button
2. **Optimistic Update**: Immediately update UI
3. **API Call**: Send tRPC mutation
4. **Email Provider**: Call Gmail/Outlook API
5. **Database Update**: Sync operation results
6. **Cache Invalidation**: Update TanStack Query cache
7. **UI Sync**: Reflect final state

### Real-time Features
- **Party Kit**: Real-time synchronization between clients
- **Background Queue**: Async operations with status tracking
- **Optimistic Updates**: Immediate feedback with rollback capability

## CRM Implementation Guidance

Based on the analysis, here's how to implement a CRM section that fits the existing architecture:

### 1. Database Schema Extensions

Add CRM-specific tables following the existing naming convention:

```sql
-- Core CRM entities
mail0_crm_contact (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES mail0_user(id),
  email TEXT NOT NULL,
  name TEXT,
  company TEXT,
  phone TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  -- JSON field for flexible contact data
  metadata JSONB
);

mail0_crm_deal (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES mail0_user(id),
  contact_id TEXT REFERENCES mail0_crm_contact(id),
  title TEXT NOT NULL,
  value DECIMAL,
  stage TEXT,
  probability INTEGER,
  close_date DATE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

mail0_crm_interaction (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES mail0_user(id),
  contact_id TEXT REFERENCES mail0_crm_contact(id),
  thread_id TEXT, -- Link to email threads
  type TEXT, -- email, call, meeting, note
  content TEXT,
  created_at TIMESTAMP
);
```

### 2. tRPC Router Extension

Create new CRM routers following the existing pattern:

```typescript
// apps/server/src/trpc/routes/crm/
export const crmRouter = router({
  contacts: contactsRouter,
  deals: dealsRouter,
  interactions: interactionsRouter,
});

// Add to main router
export const appRouter = router({
  // ... existing routers
  crm: crmRouter,
});
```

### 3. Frontend Integration

#### Navigation Configuration
```typescript
// apps/mail/config/navigation.ts
export const navigationConfig = {
  // ... existing config
  crm: {
    path: '/crm',
    sections: [
      {
        title: 'CRM',
        items: [
          { title: 'Contacts', url: '/crm/contacts', icon: Users },
          { title: 'Deals', url: '/crm/deals', icon: DollarSign },
          { title: 'Pipeline', url: '/crm/pipeline', icon: BarChart },
        ]
      }
    ]
  }
}
```

#### Route Structure
```typescript
// apps/mail/app/routes.ts
layout('(routes)/layout.tsx', [
  // ... existing routes
  layout('(routes)/crm/layout.tsx', 
    prefix('/crm', [
      index('(routes)/crm/page.tsx'),
      route('/contacts', '(routes)/crm/contacts/page.tsx'),
      route('/contacts/:id', '(routes)/crm/contacts/[id]/page.tsx'),
      route('/deals', '(routes)/crm/deals/page.tsx'),
      route('/pipeline', '(routes)/crm/pipeline/page.tsx'),
    ])
  ),
])
```

#### Component Structure
```
components/
└── crm/
    ├── contacts/
    │   ├── contact-list.tsx
    │   ├── contact-detail.tsx
    │   └── contact-form.tsx
    ├── deals/
    │   ├── deal-list.tsx
    │   ├── deal-kanban.tsx
    │   └── deal-form.tsx
    └── shared/
        ├── crm-layout.tsx
        └── interaction-timeline.tsx
```

### 4. Email Integration Points

#### Automatic Contact Creation
```typescript
// Hook into existing email processing
const processEmailForCRM = async (emailData) => {
  // Extract contact info from email
  const contactData = extractContactFromEmail(emailData);
  
  // Auto-create or update contact
  await trpc.crm.contacts.upsert.mutate(contactData);
  
  // Create interaction record
  await trpc.crm.interactions.create.mutate({
    contactId: contact.id,
    threadId: emailData.threadId,
    type: 'email',
    content: emailData.subject,
  });
};
```

#### Email Thread Integration
```typescript
// Add CRM context to email threads
const ThreadDisplay = () => {
  const { data: thread } = useThread(threadId);
  const { data: relatedContact } = useCRMContact(thread?.fromEmail);
  
  return (
    <div>
      {/* Existing email display */}
      <EmailContent thread={thread} />
      
      {/* CRM integration panel */}
      {relatedContact && (
        <CRMContactSidebar contact={relatedContact} />
      )}
    </div>
  );
};
```

### 5. State Management Integration

#### Custom Hooks
```typescript
// apps/mail/hooks/use-crm-contacts.ts
export const useCRMContacts = () => {
  const trpc = useTRPC();
  
  return useInfiniteQuery(
    trpc.crm.contacts.list.infiniteQueryOptions(
      { limit: 50 },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        staleTime: 5 * 60 * 1000, // 5 minutes
      }
    )
  );
};

// apps/mail/hooks/use-crm-deals.ts
export const useCRMDeals = () => {
  // Similar pattern for deals
};
```

#### Jotai Atoms
```typescript
// apps/mail/store/crm.ts
export const selectedContactAtom = atom<Contact | null>(null);
export const crmFiltersAtom = atom({
  status: 'all',
  company: '',
  tags: [],
});
```

### 6. UI Components Following Existing Patterns

#### CRM Layout Component
```typescript
// apps/mail/components/crm/crm-layout.tsx
export function CRMLayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full md:py-1 dark:bg-card">
      <AppSidebar className="hidden lg:flex" />
      <div className="w-full flex-1">
        <div className="bg-card dark:bg-card h-dvh max-w-full flex-1 flex-col overflow-y-auto overflow-x-hidden border border shadow-inner md:mr-1 md:flex md:h-[calc(100dvh-(0.5rem))] md:rounded-2xl md:shadow-sm dark:border">
          <div className="sticky top-0 z-[15] flex items-center justify-between gap-1.5 border-b border p-2 px-[20px] transition-colors md:min-h-14 dark:border">
            <SidebarToggle className="h-fit px-2" />
            {/* CRM-specific header actions */}
          </div>
          <ScrollArea className="h-[calc(100dvh-51px)] overflow-hidden pt-0">
            <div className="p-4">{children}</div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
```

### 7. Business Logic Integration

#### Feature Gating
```typescript
// Integrate with existing billing system
const CRMFeature = () => {
  const { isPro } = useBilling();
  
  if (!isPro) {
    return <UpgradePrompt feature="CRM" />;
  }
  
  return <CRMDashboard />;
};
```

#### Permissions
```typescript
// Add CRM permissions to existing user settings
const defaultUserSettings = {
  // ... existing settings
  crm: {
    enabled: false,
    contactsLimit: 100,
    dealsLimit: 50,
  }
};
```

### 8. Search Integration

#### Extend Command Palette
```typescript
// Add CRM commands to existing command palette
const crmCommands = [
  {
    id: 'new-contact',
    title: 'New Contact',
    action: () => openContactModal(),
    group: 'crm',
  },
  {
    id: 'new-deal',
    title: 'New Deal',
    action: () => openDealModal(),
    group: 'crm',
  },
];
```

### 9. Internationalization Extension

```json
// apps/mail/locales/en.json
{
  "crm": {
    "contacts": {
      "title": "Contacts",
      "new": "New Contact",
      "edit": "Edit Contact",
      "delete": "Delete Contact"
    },
    "deals": {
      "title": "Deals",
      "pipeline": "Pipeline",
      "value": "Deal Value",
      "stage": "Stage"
    }
  }
}
```

### 10. Key Implementation Principles

1. **Follow Existing Patterns**: Use the same component structure, naming conventions, and architectural patterns
2. **Leverage Existing Infrastructure**: Reuse authentication, billing, UI components, and state management
3. **Maintain Type Safety**: Extend tRPC schemas and TypeScript types consistently
4. **Incremental Implementation**: Start with core entities (contacts) and gradually add features
5. **Email Integration**: Ensure tight integration with existing email workflows
6. **Performance**: Use existing optimization patterns (virtual scrolling, optimistic updates)
7. **Accessibility**: Follow existing accessibility patterns and testing
8. **Mobile Responsive**: Ensure mobile compatibility following existing responsive patterns

### Implementation Priority

1. **Phase 1**: Basic contact management with email integration
2. **Phase 2**: Deal tracking and pipeline visualization
3. **Phase 3**: Advanced features (tasks, notes, reporting)
4. **Phase 4**: Email automation and sequences

This CRM implementation would seamlessly integrate with the existing Zero email application while maintaining consistency with the established architecture and design patterns.