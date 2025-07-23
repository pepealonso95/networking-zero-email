'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Calendar, Clock } from 'lucide-react';

interface CalendarSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CalendarSettings({ open, onOpenChange }: CalendarSettingsProps) {
  const [settings, setSettings] = useState({
    syncGoogleCalendar: true,
    showWeekends: true,
    defaultView: 'week',
    startWeekOn: 'sunday',
    workingHours: {
      start: '09:00',
      end: '17:00',
    },
    notifications: {
      email: true,
      desktop: false,
    },
  });

  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      // TODO: Implement Google Calendar sync
      console.log('Syncing with Google Calendar...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" showOverlay>
        <DialogHeader>
          <DialogTitle>Calendar Settings</DialogTitle>
          <DialogDescription>
            Configure your calendar preferences
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Google Calendar Integration */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Google Calendar</h3>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Sync with Google Calendar</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically sync events with your Google Calendar
                </p>
              </div>
              <Switch
                checked={settings.syncGoogleCalendar}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, syncGoogleCalendar: checked })
                }
              />
            </div>

            {settings.syncGoogleCalendar && (
              <Button
                variant="outline"
                onClick={handleSync}
                disabled={isSyncing}
                className="w-full gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </Button>
            )}
          </div>

          <Separator />

          {/* View Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">View Settings</h3>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show weekends</Label>
                <p className="text-xs text-muted-foreground">
                  Display Saturday and Sunday in calendar views
                </p>
              </div>
              <Switch
                checked={settings.showWeekends}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, showWeekends: checked })
                }
              />
            </div>
          </div>

          <Separator />

          {/* Working Hours */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Working Hours
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-time">Start</Label>
                <input
                  id="start-time"
                  type="time"
                  value={settings.workingHours.start}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      workingHours: { ...settings.workingHours, start: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-input rounded-md text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-time">End</Label>
                <input
                  id="end-time"
                  type="time"
                  value={settings.workingHours.end}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      workingHours: { ...settings.workingHours, end: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-input rounded-md text-sm"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Notifications */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Notifications</h3>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Email notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Receive email reminders for upcoming events
                </p>
              </div>
              <Switch
                checked={settings.notifications.email}
                onCheckedChange={(checked) =>
                  setSettings({
                    ...settings,
                    notifications: { ...settings.notifications, email: checked },
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Desktop notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Show browser notifications for events
                </p>
              </div>
              <Switch
                checked={settings.notifications.desktop}
                onCheckedChange={(checked) =>
                  setSettings({
                    ...settings,
                    notifications: { ...settings.notifications, desktop: checked },
                  })
                }
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}