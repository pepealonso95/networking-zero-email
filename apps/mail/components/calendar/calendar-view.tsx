'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Settings, Clock } from 'lucide-react';
import { WeekView, type WeekViewRef } from './week-view';
import { MonthView } from './month-view';
import { EventSidebar } from './event-sidebar';
import { CalendarSettings } from './calendar-settings';
import { CalendarAuthError } from './calendar-auth-error';
import { useTRPC } from '@/providers/query-provider';
import { useQuery } from '@tanstack/react-query';
import { format, addWeeks, subWeeks, startOfWeek, endOfWeek, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';

type ViewType = 'week' | 'month';

export function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<ViewType>('week');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const weekViewRef = useRef<WeekViewRef>(null);
  const trpc = useTRPC();

  // Calculate date range based on view type
  const getDateRange = () => {
    if (viewType === 'week') {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 0 }),
        end: endOfWeek(currentDate, { weekStartsOn: 0 }),
      };
    } else {
      return {
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate),
      };
    }
  };

  // Calculate date range for query
  const { start, end } = getDateRange();

  // Check Google Calendar connection status
  const { data: connectionStatus } = useQuery({
    ...trpc.calendar.getConnectionStatus.queryOptions(),
  });

  // Fetch events for current date range
  const { data: events = [], isLoading, error, refetch: refetchEvents } = useQuery({
    ...trpc.calendar.getEvents.queryOptions({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      includeGoogleEvents: true,
    }),
    enabled: connectionStatus?.hasGoogleConnection === true, // Only fetch if connected
  });

  // Navigation functions
  const navigatePrevious = () => {
    if (viewType === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const navigateNext = () => {
    if (viewType === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const navigateToday = () => {
    setCurrentDate(new Date());
  };

  const scrollToNow = () => {
    if (weekViewRef.current) {
      weekViewRef.current.scrollToCurrentTime();
    }
  };

  // Format header title based on view type
  const getHeaderTitle = () => {
    if (viewType === 'week') {
      const { start, end } = getDateRange();
      if (start.getMonth() === end.getMonth()) {
        return format(start, 'MMMM yyyy');
      }
      return `${format(start, 'MMM')} - ${format(end, 'MMM yyyy')}`;
    } else {
      return format(currentDate, 'MMMM yyyy');
    }
  };

  return (
    <div className="flex h-full bg-background p-6">
      {/* Main calendar content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Calendar header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {/* Navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={navigatePrevious}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={navigateNext}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={navigateToday}
                className="h-8"
              >
                Today
              </Button>
              {viewType === 'week' && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={scrollToNow}
                  className="h-8 w-8"
                  title="Scroll to current time"
                >
                  <Clock className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Title */}
            <h2 className="text-lg font-semibold">{getHeaderTitle()}</h2>
          </div>

          {/* View controls and mini calendar */}
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border">
              <Button
                variant={viewType === 'week' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewType('week')}
                className="rounded-r-none"
              >
                Week
              </Button>
              <Button
                variant={viewType === 'month' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewType('month')}
                className="rounded-l-none"
              >
                Month
              </Button>
            </div>

            {/* Mini Calendar Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                >
                  <CalendarIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={currentDate}
                  onSelect={(date) => date && setCurrentDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowSettings(true)}
              className="h-8 w-8"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Calendar content */}
        <div className="flex-1 overflow-hidden rounded-lg border bg-card">
          {connectionStatus && !connectionStatus.hasGoogleConnection ? (
            <div className="flex items-center justify-center h-full p-6">
              <CalendarAuthError 
                error={new Error('Google Calendar not connected. Please connect your Google account to sync calendar events.')} 
                onRetry={refetchEvents}
              />
            </div>
          ) : connectionStatus && !connectionStatus.hasValidToken ? (
            <div className="flex items-center justify-center h-full p-6">
              <CalendarAuthError 
                error={new Error('Google Calendar access expired. Please reconnect your Google account.')} 
                onRetry={refetchEvents}
              />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full p-6">
              <CalendarAuthError 
                error={error} 
                onRetry={refetchEvents}
              />
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarIcon className="h-4 w-4 animate-pulse" />
                Loading calendar...
              </div>
            </div>
          ) : viewType === 'week' ? (
            <WeekView
              ref={weekViewRef}
              currentDate={currentDate}
              events={events}
              onEventSelect={setSelectedEventId}
              onEventUpdate={refetchEvents}
            />
          ) : (
            <MonthView
              currentDate={currentDate}
              events={events}
              onEventSelect={setSelectedEventId}
              onDateSelect={setCurrentDate}
            />
          )}
        </div>
      </div>

      {/* Event sidebar */}
      {selectedEventId && (
        <div className="ml-6">
          <EventSidebar
            eventId={selectedEventId}
            onClose={() => setSelectedEventId(null)}
            onEventUpdate={refetchEvents}
          />
        </div>
      )}

      {/* Settings dialog */}
      <CalendarSettings
        open={showSettings}
        onOpenChange={setShowSettings}
      />
    </div>
  );
}