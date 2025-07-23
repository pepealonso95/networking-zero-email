'use client';

import { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface MonthViewProps {
  currentDate: Date;
  events: any[];
  onEventSelect: (eventId: string) => void;
  onDateSelect: (date: Date) => void;
}

export function MonthView({ currentDate, events, onEventSelect, onDateSelect }: MonthViewProps) {
  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days = [];
    let currentDay = startDate;

    while (currentDay <= endDate) {
      days.push(new Date(currentDay));
      currentDay = addDays(currentDay, 1);
    }

    return days;
  }, [currentDate]);

  // Group events by day
  const eventsByDay = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    
    events.forEach(event => {
      const eventDate = new Date(event.startTime);
      const dayKey = format(eventDate, 'yyyy-MM-dd');
      
      if (!grouped[dayKey]) {
        grouped[dayKey] = [];
      }
      grouped[dayKey].push(event);
    });
    
    return grouped;
  }, [events]);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="flex flex-col h-full">
      {/* Month header */}
      <div className="grid grid-cols-7 border-b">
        {weekDays.map((day) => (
          <div
            key={day}
            className="p-3 text-center text-sm font-medium text-muted-foreground border-r last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr">
        {calendarDays.map((day) => {
          const dayKey = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDay[dayKey] || [];
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isSelected = isSameDay(day, currentDate);
          const isDayToday = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "border-r border-b last:border-r-0 p-2 cursor-pointer hover:bg-muted/20 transition-colors min-h-[120px]",
                !isCurrentMonth && "bg-muted/10 text-muted-foreground"
              )}
              onClick={() => onDateSelect(day)}
            >
              {/* Day number */}
              <div className="flex justify-between items-start mb-2">
                <span
                  className={cn(
                    "text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full",
                    isDayToday && "bg-primary text-primary-foreground",
                    isSelected && !isDayToday && "bg-muted"
                  )}
                >
                  {format(day, 'd')}
                </span>
              </div>

              {/* Events */}
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event) => (
                  <div
                    key={event.id}
                    className="text-xs p-1 rounded bg-primary/10 text-primary truncate cursor-pointer hover:bg-primary/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventSelect(event.id);
                    }}
                  >
                    {event.isAllDay ? (
                      event.title
                    ) : (
                      `${format(new Date(event.startTime), 'h:mm a')} ${event.title}`
                    )}
                  </div>
                ))}
                
                {/* Show overflow indicator */}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-muted-foreground">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}