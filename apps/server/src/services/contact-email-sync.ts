import { contact, contactInteraction, contactEmailSync } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

interface ContactEmailSyncOptions {
  db: DrizzleD1Database;
  driver: any; // Driver from tRPC context
  userId: string;
  contactId?: string; // If provided, sync only this contact
  forceHistoric?: boolean; // Force historic search regardless of last sync
}

interface EmailParticipant {
  email: string;
  name?: string;
}

interface ParsedEmail {
  messageId: string;
  threadId: string;
  subject: string;
  sender: EmailParticipant;
  recipients: EmailParticipant[]; // to, cc, bcc combined
  timestamp: Date;
  folder: 'INBOX' | 'SENT';
}

export class ContactEmailSyncService {
  private db: DrizzleD1Database;
  private driver: any;
  private userId: string;

  constructor(options: ContactEmailSyncOptions) {
    this.db = options.db;
    this.driver = options.driver;
    this.userId = options.userId;
  }

  /**
   * Main sync method - orchestrates delta and historic syncing
   */
  async syncContactEmails(contactId?: string, forceHistoric = false): Promise<void> {
    const syncTimeout = 30000; // 30 second timeout
    
    const syncPromise = this.performSync(contactId, forceHistoric);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Email sync timed out')), syncTimeout)
    );

    try {
      await Promise.race([syncPromise, timeoutPromise]);
    } catch (error) {
      console.error('Failed to sync contact emails:', error);
      throw error;
    }
  }

  private async performSync(contactId?: string, forceHistoric = false): Promise<void> {
    try {
      // Get contacts to sync
      const contacts = contactId 
        ? await this.getContact(contactId)
        : await this.getAllActiveContacts();

      // Limit the number of contacts to sync at once
      const contactLimit = Math.min(contacts.length, 5);
      
      for (let i = 0; i < contactLimit; i++) {
        const contact = contacts[i];
        await this.syncSingleContact(contact, forceHistoric);
      }
    } catch (error) {
      console.error('Failed to perform sync:', error);
      throw error;
    }
  }

  /**
   * Sync emails for a single contact
   */
  private async syncSingleContact(contactRecord: any, forceHistoric: boolean): Promise<void> {
    const syncState = await this.getSyncState(contactRecord.id);
    
    // 1. Delta sync - check for new emails since last sync
    if (!forceHistoric && syncState && syncState.historicSyncCompleted) {
      await this.performDeltaSync(contactRecord, syncState);
    } else {
      // 2. Historic sync - search all emails for this contact
      await this.performHistoricSync(contactRecord);
    }

    // Update sync state
    await this.updateSyncState(contactRecord.id, {
      lastSyncAt: new Date(),
      historicSyncCompleted: true
    });
  }

  /**
   * Delta sync - check emails modified since last sync
   */
  private async performDeltaSync(contactRecord: any, syncState: any): Promise<void> {
    const since = Math.floor(syncState.lastSyncAt.getTime() / 1000);
    
    // Check INBOX for emails from this contact (newer than last inbox message)
    const inboxEmails = await this.searchEmails(
      `from:${contactRecord.email}`, 
      'INBOX', 
      since,
      syncState.lastInboxMessageId
    );
    
    // Check SENT for emails to this contact (newer than last sent message)
    const sentEmails = await this.searchEmails(
      `to:${contactRecord.email} OR cc:${contactRecord.email}`, 
      'SENT', 
      since,
      syncState.lastSentMessageId
    );
    
    // Process and store interactions
    const allEmails = [...inboxEmails, ...sentEmails];
    const { lastInboxId, lastSentId } = await this.processEmails(allEmails, contactRecord.id);
    
    // Update the last message IDs
    if (lastInboxId || lastSentId) {
      await this.updateSyncState(contactRecord.id, {
        lastInboxMessageId: lastInboxId || syncState.lastInboxMessageId,
        lastSentMessageId: lastSentId || syncState.lastSentMessageId,
      });
    }
  }

  /**
   * Historic sync - search all emails for this contact
   */
  private async performHistoricSync(contactRecord: any): Promise<void> {
    try {
      // Search INBOX for emails from this contact
      const inboxEmails = await this.searchEmails(`from:${contactRecord.email}`, 'INBOX');
      
      // Search SENT for emails to this contact (to, cc, bcc)
      const sentEmails = await this.searchEmails(
        `to:${contactRecord.email} OR cc:${contactRecord.email} OR bcc:${contactRecord.email}`, 
        'SENT'
      );
      
      // Process and store interactions
      const allEmails = [...inboxEmails, ...sentEmails];
      const { lastInboxId, lastSentId } = await this.processEmails(allEmails, contactRecord.id);
      
      // Update sync state with the latest message IDs found
      await this.updateSyncState(contactRecord.id, {
        lastInboxMessageId: lastInboxId,
        lastSentMessageId: lastSentId,
      });
      
    } catch (error) {
      console.error(`Historic sync failed for contact ${contactRecord.email}:`, error);
    }
  }

  /**
   * Search emails using Gmail/Outlook API
   */
  private async searchEmails(query: string, folder: 'INBOX' | 'SENT', since?: number, _lastMessageId?: string): Promise<ParsedEmail[]> {
    try {
      // Check if driver has the required methods
      if (!this.driver || typeof this.driver.list !== 'function' || typeof this.driver.get !== 'function') {
        console.warn('Driver does not support email search operations');
        return [];
      }

      // Use the driver's search functionality
      const searchQuery = since ? `${query} after:${since}` : query;
      const folderName = folder === 'INBOX' ? 'INBOX' : 'SENT';
      
      // Get threads matching the search
      const threads = await this.driver.list({
        folder: folderName,
        query: searchQuery,
        pageSize: 50 // Reduce page size for better performance
      });

      if (!threads || !threads.emails || threads.emails.length === 0) {
        return [];
      }

      const parsedEmails: ParsedEmail[] = [];

      // Process each thread (limit to prevent timeouts)
      const threadLimit = Math.min(threads.emails.length, 20);
      for (let i = 0; i < threadLimit; i++) {
        const thread = threads.emails[i];
        try {
          // Get full thread details
          const fullThread = await this.driver.get(thread.id);
          
          if (!fullThread) continue;
          
          // Parse each message in the thread
          const messages = fullThread.messages || [fullThread];
          const messageLimit = Math.min(messages.length, 10);
          
          for (let j = 0; j < messageLimit; j++) {
            const message = messages[j];
            const parsed = this.parseEmailMessage(message, folder);
            if (parsed) {
              parsedEmails.push(parsed);
            }
          }
        } catch (error) {
          console.error(`Failed to process thread ${thread.id}:`, error);
          // Continue with next thread instead of failing
        }
      }

      return parsedEmails;
    } catch (error) {
      console.error(`Email search failed for query "${query}" in ${folder}:`, error);
      return [];
    }
  }

  /**
   * Parse email message into standardized format
   */
  private parseEmailMessage(message: any, folder: 'INBOX' | 'SENT'): ParsedEmail | null {
    try {
      // Extract participants
      const sender = this.parseParticipant(message.sender);
      const recipients = [
        ...(message.to || []).map((p: any) => this.parseParticipant(p)),
        ...(message.cc || []).map((p: any) => this.parseParticipant(p)),
        ...(message.bcc || []).map((p: any) => this.parseParticipant(p)),
      ];

      return {
        messageId: message.messageId || message.id,
        threadId: message.threadId,
        subject: message.subject || '(No Subject)',
        sender,
        recipients,
        timestamp: new Date(message.receivedOn || message.date),
        folder,
      };
    } catch (error) {
      console.error('Failed to parse email message:', error);
      return null;
    }
  }

  /**
   * Parse participant (sender/recipient) data
   */
  private parseParticipant(participant: any): EmailParticipant {
    if (typeof participant === 'string') {
      return { email: participant };
    }
    
    return {
      email: participant.email || participant.address,
      name: participant.name || participant.displayName,
    };
  }

  /**
   * Process emails and create contact interactions
   */
  private async processEmails(emails: ParsedEmail[], contactId: string): Promise<{ lastInboxId?: string, lastSentId?: string }> {
    // Sort emails by timestamp to ensure we get the latest message IDs
    const sortedEmails = emails.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    let lastInboxId: string | undefined;
    let lastSentId: string | undefined;
    
    for (const email of sortedEmails) {
      try {
        // Track the latest message IDs
        if (email.folder === 'INBOX' && !lastInboxId) {
          lastInboxId = email.messageId;
        }
        if (email.folder === 'SENT' && !lastSentId) {
          lastSentId = email.messageId;
        }
        
        // Determine if this is inbound or outbound relative to the contact
        const direction = email.folder === 'INBOX' ? 'inbound' : 'outbound';
        
        // Check if we already have this interaction
        const existing = await this.db
          .select()
          .from(contactInteraction)
          .where(
            and(
              eq(contactInteraction.contactId, contactId),
              eq(contactInteraction.emailThreadId, email.threadId),
              sql`${contactInteraction.metadata}->>'messageId' = ${email.messageId}`
            )
          )
          .limit(1);

        if (existing.length > 0) {
          continue; // Skip if already exists
        }

        // Create interaction record
        await this.db.insert(contactInteraction).values({
          id: crypto.randomUUID(),
          contactId,
          userId: this.userId,
          type: 'email',
          direction,
          subject: email.subject,
          emailThreadId: email.threadId,
          completedAt: email.timestamp,
          metadata: {
            messageId: email.messageId,
            folder: email.folder,
            sender: email.sender,
            recipients: email.recipients,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Update contact's lastContactedAt
        await this.db
          .update(contact)
          .set({
            lastContactedAt: email.timestamp,
            updatedAt: new Date(),
          })
          .where(eq(contact.id, contactId));

      } catch (error) {
        console.error(`Failed to process email ${email.messageId}:`, error);
      }
    }
    
    return { lastInboxId, lastSentId };
  }

  /**
   * Get all active contacts for this user
   */
  private async getAllActiveContacts(): Promise<any[]> {
    return await this.db
      .select()
      .from(contact)
      .where(
        and(
          eq(contact.userId, this.userId),
          eq(contact.status, 'active')
        )
      );
  }

  /**
   * Get a specific contact
   */
  private async getContact(contactId: string): Promise<any[]> {
    const result = await this.db
      .select()
      .from(contact)
      .where(
        and(
          eq(contact.id, contactId),
          eq(contact.userId, this.userId)
        )
      )
      .limit(1);
    
    return result;
  }

  /**
   * Get sync state for a contact
   */
  private async getSyncState(contactId: string): Promise<any | null> {
    try {
      const result = await this.db
        .select()
        .from(contactEmailSync)
        .where(
          and(
            eq(contactEmailSync.contactId, contactId),
            eq(contactEmailSync.userId, this.userId)
          )
        )
        .limit(1);

      return result[0] || null;
    } catch (error) {
      console.error(`Failed to get sync state for contact ${contactId}:`, error);
      return null;
    }
  }

  /**
   * Update sync state for a contact
   */
  private async updateSyncState(contactId: string, updates: {
    lastSyncAt?: Date;
    lastInboxMessageId?: string;
    lastSentMessageId?: string;
    historicSyncCompleted?: boolean;
  }): Promise<void> {
    try {
      const existing = await this.getSyncState(contactId);
      
      if (existing) {
        // Update existing record
        await this.db
          .update(contactEmailSync)
          .set({
            ...updates,
            updatedAt: new Date(),
          })
          .where(eq(contactEmailSync.id, existing.id));
      } else {
        // Create new record
        await this.db.insert(contactEmailSync).values({
          id: crypto.randomUUID(),
          contactId,
          userId: this.userId,
          lastSyncAt: updates.lastSyncAt || new Date(),
          lastInboxMessageId: updates.lastInboxMessageId,
          lastSentMessageId: updates.lastSentMessageId,
          historicSyncCompleted: updates.historicSyncCompleted || false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    } catch (error) {
      console.error(`Failed to update sync state for contact ${contactId}:`, error);
    }
  }
}

/**
 * Factory function to create sync service
 */
export function createContactEmailSync(options: ContactEmailSyncOptions): ContactEmailSyncService {
  return new ContactEmailSyncService(options);
}