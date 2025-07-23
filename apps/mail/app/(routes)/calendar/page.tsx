'use client';

import { CalendarView } from '@/components/calendar/calendar-view';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { CreateEventDialog } from '@/components/calendar/create-event-dialog';
import { useState, useEffect } from 'react';

export default function CalendarPage() {
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader
          title="Calendar"
          description="Manage your schedule and availability"
          actions={
            <Button disabled className="gap-2">
              <Plus className="h-4 w-4" />
              New Event
            </Button>
          }
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">Loading calendar...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Calendar"
        description="Manage your schedule and availability"
        actions={
          <Button onClick={() => setShowCreateEvent(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Event
          </Button>
        }
      />
      
      <div className="flex-1 overflow-hidden">
        <CalendarView />
      </div>

      <CreateEventDialog 
        open={showCreateEvent} 
        onOpenChange={setShowCreateEvent}
      />
    </div>
  );
}