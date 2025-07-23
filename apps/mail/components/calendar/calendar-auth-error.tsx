'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, AlertCircle, Settings, ExternalLink } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { toast } from 'sonner';

interface CalendarAuthErrorProps {
  error?: Error | null;
  onRetry?: () => void;
}

export function CalendarAuthError({ error, onRetry }: CalendarAuthErrorProps) {
  const [showReconnectDialog, setShowReconnectDialog] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const isUnauthorizedError = error?.message?.includes('Please sign in') ||
                             error?.message?.includes('Google Calendar not connected') ||
                             error?.message?.includes('Google Calendar access expired') ||
                             error?.message?.includes('Please reconnect your Google account');

  const handleReconnectGoogle = async () => {
    setIsReconnecting(true);
    try {
      await authClient.linkSocial({
        provider: 'google',
        callbackURL: `${window.location.origin}/calendar`,
      });
      // The page will refresh automatically after redirect
    } catch (error) {
      console.error('Error reconnecting Google account:', error);
      toast.error('Failed to reconnect Google account. Please try again.');
      setIsReconnecting(false);
      setShowReconnectDialog(false);
    }
  };

  const handleOpenSettings = () => {
    window.open('/settings/connections', '_blank');
  };

  if (!error) return null;

  if (isUnauthorizedError) {
    return (
      <>
        <Card className="mx-auto max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
              <AlertCircle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <CardTitle>Calendar Access Required</CardTitle>
            <CardDescription>
              {error?.message?.includes('expired') || error?.message?.includes('reconnect') 
                ? 'Your Google Calendar access has expired'
                : 'Connect your Google account to access calendar features'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground text-center">
              {error?.message?.includes('expired') || error?.message?.includes('reconnect')
                ? 'Please reconnect your Google account to restore calendar access.'
                : 'Your Google account needs calendar permissions to sync events and create meetings.'
              }
            </div>
            <div className="flex flex-col gap-2">
              <Button 
                onClick={() => setShowReconnectDialog(true)}
                className="w-full"
              >
                <Calendar className="mr-2 h-4 w-4" />
                {error?.message?.includes('expired') || error?.message?.includes('reconnect')
                  ? 'Reconnect Google Calendar'
                  : 'Connect Google Calendar'
                }
              </Button>
              <Button 
                variant="outline" 
                onClick={handleOpenSettings}
                className="w-full"
              >
                <Settings className="mr-2 h-4 w-4" />
                Manage Connections
                <ExternalLink className="ml-2 h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Dialog open={showReconnectDialog} onOpenChange={setShowReconnectDialog}>
          <DialogContent showOverlay>
            <DialogHeader>
              <DialogTitle>
                {error?.message?.includes('expired') || error?.message?.includes('reconnect')
                  ? 'Reconnect Google Calendar'
                  : 'Connect Google Calendar'
                }
              </DialogTitle>
              <DialogDescription>
                {error?.message?.includes('expired') || error?.message?.includes('reconnect')
                  ? "Your calendar access has expired. You'll be redirected to Google to restore permissions."
                  : "You'll be redirected to Google to grant calendar permissions. This allows Zero Email to:"
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
                <div className="text-sm">
                  <div className="font-medium">View and manage your calendar events</div>
                  <div className="text-muted-foreground">See, edit, share, and permanently delete all calendars you can access</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-green-500" />
                <div className="text-sm">
                  <div className="font-medium">Create and manage events</div>
                  <div className="text-muted-foreground">Add new events and meeting requests to your calendar</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-purple-500" />
                <div className="text-sm">
                  <div className="font-medium">Generate Google Meet links</div>
                  <div className="text-muted-foreground">Automatically create video conference links for your meetings</div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setShowReconnectDialog(false)}
                disabled={isReconnecting}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleReconnectGoogle}
                disabled={isReconnecting}
              >
                {isReconnecting 
                  ? 'Connecting...' 
                  : error?.message?.includes('expired') || error?.message?.includes('reconnect')
                    ? 'Reconnect Google Calendar'
                    : 'Connect Google Calendar'
                }
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // For other errors, show a generic error state
  return (
    <Card className="mx-auto max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
          <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
        </div>
        <CardTitle>Calendar Error</CardTitle>
        <CardDescription>
          Something went wrong with your calendar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground text-center">
          {error.message || 'An unexpected error occurred while loading your calendar.'}
        </div>
        <div className="flex flex-col gap-2">
          {onRetry && (
            <Button onClick={onRetry} className="w-full">
              Try Again
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={handleOpenSettings}
            className="w-full"
          >
            <Settings className="mr-2 h-4 w-4" />
            Check Settings
            <ExternalLink className="ml-2 h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}