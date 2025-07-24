# Claude Development Memory for Zero Email Project

## Important Development Notes

### Database Schema Changes
- **CRITICAL**: To apply any database schema changes, always run `pnpm db:push`
- This command pushes schema changes to the database
- Required after any modifications to `/apps/server/src/db/schema.ts`
- **NEVER** use `pnpm db:generate` or `drizzle-kit generate` - always use `pnpm db:push`

### Current Project Structure
- **Backend**: `/apps/server/src/`
  - Database schema: `db/schema.ts`
  - tRPC routes: `trpc/routes/`
  - Services: `services/`
  - Libraries: `lib/`

- **Frontend**: `/apps/mail/`
  - Pages: `app/(routes)/`
  - Components: `components/`
  - UI Components: `components/ui/`

### AI Integration
- Currently uses OpenAI models via `@ai-sdk/openai`
- Environment variable: `OPENAI_API_KEY`
- Switch from gpt-4o to o3-mini: `openai('o3-mini')`

### User Settings Pattern
- User settings stored in `userSettings` table
- Schema defined in `lib/schemas.ts`
- Managed via `trpc/routes/settings.ts`
- Encrypted sensitive data (like API keys)

### Recent Work
- Implemented CRM with smart suggestions using vector embeddings
- Added Zero Email credit link to sidebar
- Vector database: Cloudflare Vectorize for email embeddings

### Development Startup
- remember, the code should one be started with ./scripts/dev-clean.sh

## Lead Generation Feature Implementation
- Goal: User-controlled lead generation with o3-mini AI processing
- Free APIs: Hunter.io, Apollo.io, Snov.io, PDL (user provides keys)
- LinkedIn Integration: Sales Navigator, ScrapIn alternative providers
- **IMPORTANT**: Only leads with valid email addresses are saved/returned
- **SEARCH METHOD**: Uses AI-powered PDL search when PDL API key available (bypasses structured criteria for better prompt variety)
- **Issue Fixed**: Different prompts now generate different results instead of same person from PDL
- Integration: Seamless CRM integration for adding leads to contacts

### Lead Generation Data Sources Priority
1. **LinkedIn** (Primary) - Best data coverage, especially for education/professional history
2. **PDL** (AI-powered search) - Direct natural language queries for varied results
   - **NOTE**: PDL free tier may only return metadata (no actual emails)
   - **Solution**: Automatic fallback to Hunter/Apollo/Snov when PDL has no PII access
3. **Apollo/Hunter/Snov** (Structured search) - Email verification and additional data