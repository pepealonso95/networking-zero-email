import { calendar } from '@googleapis/calendar';
import { OAuth2Client, GoogleAuth } from 'google-auth-library';
import type { calendar_v3 } from '@googleapis/calendar';
import { env } from 'cloudflare:workers';

export interface GoogleCalendarEvent {
  id?: string;
  calendarId?: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: 'accepted' | 'declined' | 'tentative' | 'needsAction';
  }>;
  recurrence?: string[];
  conferenceData?: {
    createRequest?: {
      requestId: string;
      conferenceSolutionKey: {
        type: 'hangoutsMeet';
      };
    };
    entryPoints?: Array<{
      entryPointType: string;
      uri: string;
    }>;
  };
  status?: 'confirmed' | 'tentative' | 'cancelled';
  visibility?: 'default' | 'public' | 'private';
}

export interface CalendarListEntry {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  accessRole: string;
  timeZone?: string;
  backgroundColor?: string;
  foregroundColor?: string;
}

export interface SyncOptions {
  syncToken?: string;
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
}

export class GoogleCalendarService {
  private calendarApi: calendar_v3.Calendar;
  private oauth2Client: OAuth2Client;

  constructor(accessToken: string, refreshToken?: string, expiryDate?: Date, scope?: string) {
    // Try without redirect URI first - might be causing issues
    this.oauth2Client = new OAuth2Client(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET
    );
    
    // Set credentials - let OAuth2Client handle access token automatically
    if (refreshToken && scope) {
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken,
        scope: scope,
      });
    } else {
      const credentials = {
        access_token: accessToken,
        token_type: 'Bearer',
      };
      
      if (refreshToken) {
        credentials.refresh_token = refreshToken;
      }
      
      if (expiryDate) {
        credentials.expiry_date = expiryDate.getTime();
      }
      
      if (scope) {
        credentials.scope = scope;
      }
      
      this.oauth2Client.setCredentials(credentials);
    }

    // Set up automatic token refresh
    this.oauth2Client.on('tokens', (tokens) => {
      const updatedCredentials = {
        ...this.oauth2Client.credentials,
        token_type: 'Bearer',
        // Don't override scope - preserve what OAuth granted
      };
      
      if (tokens.refresh_token) {
        updatedCredentials.refresh_token = tokens.refresh_token;
      }
      if (tokens.access_token) {
        updatedCredentials.access_token = tokens.access_token;
      }
      if (tokens.expiry_date) {
        updatedCredentials.expiry_date = tokens.expiry_date;
      }
      
      this.oauth2Client.setCredentials(updatedCredentials);
    });

    // Initialize calendar API - will be re-initialized after credentials are set
    this.calendarApi = calendar({
      version: 'v3',
      auth: this.oauth2Client,
    });
  }

  private async ensureValidCredentials(): Promise<void> {
    try {
      // Check if we need to refresh the token
      const { credentials } = this.oauth2Client;

      // If no access token, try to refresh using refresh_token
      if (!credentials.access_token && credentials.refresh_token) {
        try {
          const { credentials: newCredentials } = await this.oauth2Client.refreshAccessToken();
          
          // Ensure we maintain token_type and scope after refresh
          const fullCredentials = {
            ...newCredentials,
            token_type: 'Bearer',
            scope: credentials.scope // Preserve original scope
          };
          
          this.oauth2Client.setCredentials(fullCredentials);
          
          // Reinitialize calendar API with refreshed credentials
          this.calendarApi = calendar({
            version: 'v3',
            auth: this.oauth2Client,
          });
        } catch (refreshError) {
          console.error('❌ Failed to refresh token:', refreshError);
          throw new Error('Failed to refresh access token - please reconnect your Google account');
        }
      } else if (!credentials.access_token) {
        console.error('❌ Missing access token and refresh token');
        throw new Error('No access token available - please reconnect your Google account');
      } else {
        // Check if token is expired and refresh if needed
        const now = Date.now();
        const expiryDate = credentials.expiry_date;
        const shouldRefresh = expiryDate && expiryDate <= now + (5 * 60 * 1000);
        
        if (shouldRefresh) {
          try {
            const { credentials: newCredentials } = await this.oauth2Client.refreshAccessToken();
            
            const fullCredentials = {
              ...newCredentials,
              token_type: 'Bearer',
              scope: credentials.scope
            };
            
            this.oauth2Client.setCredentials(fullCredentials);
            
            // Reinitialize calendar API with refreshed credentials
            this.calendarApi = calendar({
              version: 'v3',
              auth: this.oauth2Client,
            });
          } catch (refreshError) {
            console.error('❌ Failed to refresh token:', refreshError);
            throw new Error('Failed to refresh access token - please reconnect your Google account');
          }
        } 
      }
    } catch (error) {
      console.error('❌ Error ensuring valid credentials:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Authentication failed - please reconnect your Google account');
    }
  }

  async getCalendarList(): Promise<CalendarListEntry[]> {
    try {
      await this.ensureValidCredentials();
      const response = await this.calendarApi.calendarList.list();
      return response.data.items?.map(item => ({
        id: item.id!,
        summary: item.summary!,
        description: item.description || undefined,
        primary: item.primary || undefined,
        accessRole: item.accessRole!,
        timeZone: item.timeZone || undefined,
        backgroundColor: item.backgroundColor || undefined,
        foregroundColor: item.foregroundColor || undefined,
      })) || [];
    } catch (error) {
      console.error('Error fetching calendar list:', error);
      throw new Error('Failed to fetch calendar list');
    }
  }

  async getEvents(calendarId: string = 'primary', options: SyncOptions = {}): Promise<{
    events: GoogleCalendarEvent[];
    nextSyncToken?: string;
  }> {
    try {
      // Ensure we have valid credentials before making the request
      await this.ensureValidCredentials();
      
      // Test what Authorization header will be sent and manually verify token
      try {
        const authHeader = await this.oauth2Client.getAccessToken();
        
        
        // Test token directly with a simple API call
        const testResponse = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + encodeURIComponent(authHeader.token));
        if (testResponse.ok) {
          const tokenInfo = await testResponse.json();
          
          const directCalendarTest = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1', {
            headers: {
              'Authorization': `Bearer ${authHeader.token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (directCalendarTest.ok) {
            const directResult = await directCalendarTest.json();
            
          } else {
            const errorData = await directCalendarTest.json().catch(() => ({}));
        
          }
        } else {
          console.error('❌ Token validation failed:', {
            status: testResponse.status,
            statusText: testResponse.statusText
          });
        }
      } catch (authError) {
        console.error('❌ Failed to get auth token:', authError);
      }

      const params: any = {
        calendarId,
        singleEvents: true,
        orderBy: 'startTime',
        ...options,
      };
      
      // Force reinitialize calendar API with current credentials
      this.calendarApi = calendar({
        version: 'v3',
        auth: this.oauth2Client,
      });
      
      // Use direct fetch since googleapis library is broken
      const authHeader = await this.oauth2Client.getAccessToken();
      
      const timeMinParam = encodeURIComponent(params.timeMin || '');
      const timeMaxParam = encodeURIComponent(params.timeMax || '');
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?singleEvents=true&orderBy=startTime&timeMin=${timeMinParam}&timeMax=${timeMaxParam}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${authHeader.token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Direct fetch failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(`Calendar API call failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      
      
      const events = data.items?.map(this.transformGoogleEvent) || [];
      
      return {
        events,
        nextSyncToken: data.nextSyncToken,
      };
    } catch (error) {
      console.error('Error fetching events:', error);
      throw new Error('Failed to fetch events');
    }
  }

  async createEvent(
    calendarId: string = 'primary',
    event: GoogleCalendarEvent,
    withMeet: boolean = false
  ): Promise<GoogleCalendarEvent> {
    try {
      await this.ensureValidCredentials();
      
      // Use direct fetch since googleapis library is broken
      const authHeader = await this.oauth2Client.getAccessToken();
      
      const eventData: any = {
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: event.start,
        end: event.end,
        attendees: event.attendees,
        recurrence: event.recurrence,
        status: event.status,
        visibility: event.visibility,
      };

      if (withMeet) {
        eventData.conferenceData = {
          createRequest: {
            requestId: `meet-${Date.now()}`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet',
            },
          },
        };
      }

      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
      const queryParams = new URLSearchParams();
      if (withMeet) queryParams.append('conferenceDataVersion', '1');
      queryParams.append('sendUpdates', 'all');
      
      const fullUrl = `${url}?${queryParams.toString()}`;
      
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authHeader.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Direct fetch failed:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const responseData = await response.json();

      return this.transformGoogleEvent(responseData);
    } catch (error) {
      console.error('Error creating event:', error);
      throw new Error('Failed to create event');
    }
  }

  async updateEvent(
    calendarId: string = 'primary',
    eventId: string,
    event: Partial<GoogleCalendarEvent>,
    withMeet: boolean = false
  ): Promise<GoogleCalendarEvent> {
    try {
      await this.ensureValidCredentials();
      
      // Use direct fetch since googleapis library is broken
      const authHeader = await this.oauth2Client.getAccessToken();
      
      const eventData: any = {
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: event.start,
        end: event.end,
        attendees: event.attendees,
        recurrence: event.recurrence,
        status: event.status,
        visibility: event.visibility,
      };

      if (withMeet && !event.conferenceData) {
        eventData.conferenceData = {
          createRequest: {
            requestId: `meet-${Date.now()}`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet',
            },
          },
        };
      }

      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
      const queryParams = new URLSearchParams();
      if (withMeet) queryParams.append('conferenceDataVersion', '1');
      queryParams.append('sendUpdates', 'all');
      
      const fullUrl = `${url}?${queryParams.toString()}`;
      
      const response = await fetch(fullUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authHeader.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Direct fetch failed:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const responseData = await response.json();

      return this.transformGoogleEvent(responseData);
    } catch (error) {
      console.error('Error updating event:', error);
      throw new Error('Failed to update event');
    }
  }

  async deleteEvent(
    calendarId: string = 'primary',
    eventId: string
  ): Promise<void> {
    try {
      await this.ensureValidCredentials();
      
      // Use direct fetch since googleapis library is broken
      const authHeader = await this.oauth2Client.getAccessToken();
      
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
      const queryParams = new URLSearchParams();
      queryParams.append('sendUpdates', 'all');
      
      const fullUrl = `${url}?${queryParams.toString()}`;
      
      const response = await fetch(fullUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authHeader.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Direct fetch failed:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

    } catch (error) {
      console.error('Error deleting event:', error);
      throw new Error('Failed to delete event');
    }
  }

  async getEvent(
    calendarId: string = 'primary',
    eventId: string
  ): Promise<GoogleCalendarEvent> {
    try {
      await this.ensureValidCredentials();
      
      // Use direct fetch since googleapis library is broken  
      const authHeader = await this.oauth2Client.getAccessToken();
      
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${authHeader.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Direct fetch failed:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const eventData = await response.json();


      return this.transformGoogleEvent(eventData);
    } catch (error) {
      console.error('Error fetching event:', error);
      throw new Error('Failed to fetch event');
    }
  }

  async syncCalendarEvents(
    calendarId: string = 'primary',
    syncToken?: string,
    timeMin?: string,
    timeMax?: string
  ): Promise<{
    events: GoogleCalendarEvent[];
    nextSyncToken?: string;
    deleted?: string[];
  }> {
    try {
      await this.ensureValidCredentials();
      const params: any = {
        calendarId,
        singleEvents: true,
        showDeleted: true,
      };

      if (syncToken) {
        params.syncToken = syncToken;
      } else {
        params.timeMin = timeMin || new Date().toISOString();
        if (timeMax) {
          params.timeMax = timeMax;
        }
      }

      const response = await this.calendarApi.events.list(params);
      
      const events: GoogleCalendarEvent[] = [];
      const deleted: string[] = [];

      response.data.items?.forEach(item => {
        if (item.status === 'cancelled') {
          if (item.id) deleted.push(item.id);
        } else {
          events.push(this.transformGoogleEvent(item));
        }
      });

      return {
        events,
        nextSyncToken: response.data.nextSyncToken,
        deleted,
      };
    } catch (error) {
      console.error('Error syncing calendar events:', error);
      throw new Error('Failed to sync calendar events');
    }
  }

  private transformGoogleEvent(googleEvent: calendar_v3.Schema$Event): GoogleCalendarEvent {
    return {
      id: googleEvent.id,
      summary: googleEvent.summary || 'Untitled Event',
      description: googleEvent.description || undefined,
      location: googleEvent.location || undefined,
      start: {
        dateTime: googleEvent.start?.dateTime || undefined,
        date: googleEvent.start?.date || undefined,
        timeZone: googleEvent.start?.timeZone || undefined,
      },
      end: {
        dateTime: googleEvent.end?.dateTime || undefined,
        date: googleEvent.end?.date || undefined,
        timeZone: googleEvent.end?.timeZone || undefined,
      },
      attendees: googleEvent.attendees?.map(attendee => ({
        email: attendee.email!,
        displayName: attendee.displayName || undefined,
        responseStatus: attendee.responseStatus as any,
      })),
      recurrence: googleEvent.recurrence || undefined,
      conferenceData: googleEvent.conferenceData as any,
      status: googleEvent.status as any,
      visibility: googleEvent.visibility as any,
    };
  }
}