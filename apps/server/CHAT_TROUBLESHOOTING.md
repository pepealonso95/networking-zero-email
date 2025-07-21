# Chat Troubleshooting Guide

This guide helps you diagnose and fix issues with the Zero AI chat functionality.

## Quick Diagnosis

Run the OpenAI test to check if your API key is working:

```bash
cd apps/server
pnpm test:openai
```

## Common Issues and Solutions

### 1. "An error occurred" in Chat

**Symptoms:**
- Chat shows "An error occurred" message
- Error in browser console: `Error in useChat Error: An error occurred.`

**Diagnosis:**
Check the server logs for specific error messages. Common causes:

#### A. OpenAI API Quota Exceeded
**Error Message:** `OpenAI API quota exceeded`

**Solution:**
1. Go to [OpenAI Billing](https://platform.openai.com/account/billing)
2. Add credits to your account
3. Or use a different API key with available credits

#### B. Invalid API Key
**Error Message:** `OpenAI API authentication failed`

**Solution:**
1. Check your API key in `apps/server/.dev.vars`
2. Verify the key at [OpenAI API Keys](https://platform.openai.com/account/api-keys)
3. Ensure the key starts with `sk-` and is properly formatted

#### C. Rate Limit Exceeded
**Error Message:** `OpenAI API rate limit exceeded`

**Solution:**
1. Wait a few minutes before trying again
2. Consider upgrading your OpenAI plan for higher rate limits

### 2. Chat Not Loading

**Symptoms:**
- Chat sidebar doesn't appear
- No connection to chat agent

**Diagnosis:**
1. Check browser console for connection errors
2. Verify the server is running on `http://localhost:8787`
3. Check if the ZeroAgent is properly initialized

**Solution:**
1. Restart the development server: `pnpm dev`
2. Clear browser cache and reload
3. Check network tab for failed requests

### 3. Authentication Issues

**Symptoms:**
- "Unauthorized no driver or connectionId" errors
- Chat fails to connect to email account

**Diagnosis:**
Check server logs for authentication flow:

```
[ZeroAgent] setupAuth - Starting authentication setup
[ZeroAgent] setupAuth - Name found: [user-id]
[ZeroAgent] setupAuth - Connection found: [connection-id]
```

**Solution:**
1. Ensure you're logged in to the application
2. Verify your email connection is properly set up
3. Check database connection in `.dev.vars`

## Testing Your Setup

### 1. Test OpenAI Connection

```bash
cd apps/server
OPENAI_API_KEY="your-key-here" npx jiti src/test-openai.ts
```

### 2. Check Server Logs

When testing chat, watch the server logs for detailed error information:

```bash
cd apps/server
pnpm dev
```

Look for logs starting with `[ZeroAgent]` to trace the chat flow.

### 3. Test Chat Flow

1. Open the application in your browser
2. Open browser developer tools (F12)
3. Open the AI chat sidebar
4. Send a test message
5. Check both browser console and server logs for errors

## Environment Variables

Ensure these variables are set in `apps/server/.dev.vars`:

```bash
OPENAI_API_KEY="sk-your-openai-key"
DATABASE_URL="your-database-connection-string"
HYPERDRIVE="your-hyperdrive-config"
```

## API Key Requirements

Your OpenAI API key must:
- Start with `sk-`
- Have sufficient credits/quota
- Have access to the models being used (gpt-4o, gpt-o4-mini)
- Be from a valid OpenAI account

## Model Configuration

The chat uses these OpenAI models:
- Primary: `gpt-4` (for main chat)
- Fallback: `gpt-4` (for tools)

If you're having quota issues, you can modify the model in `apps/server/src/routes/chat.ts`:

```typescript
const result = streamText({
  model: openai('gpt-o4-mini'), // Use cheaper model
  // ... rest of config
});
```

## Getting Help

If you're still having issues:

1. Check the [OpenAI Status Page](https://status.openai.com/)
2. Verify your OpenAI account status
3. Review the full error logs in both browser and server
4. Test with a minimal example using the test script

## Logs to Collect

When reporting issues, include:

1. Output from `pnpm test:openai`
2. Browser console errors
3. Server logs with `[ZeroAgent]` prefix
4. Your OpenAI account status (credits, rate limits)
5. The exact error message from the chat interface 