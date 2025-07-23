'use client';

import { useState, useMemo, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { format, startOfWeek, addDays, isSameDay, isToday, differenceInMinutes, addMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import { EventCard } from './event-card';
import { TimeGrid } from './time-grid';
import { CreateEventDialog } from './create-event-dialog';

interface WeekViewProps {
  currentDate: Date;
  events: any[];
  onEventSelect: (eventId: string) => void;
  onEventUpdate: () => void;
}

export interface WeekViewRef {
  scrollToCurrentTime: () => void;
}

interface DragState {
  isDragging: boolean;
  startTime: Date | null;
  endTime: Date | null;
  startY: number;
  currentY: number;
}

export const WeekView = forwardRef<WeekViewRef, WeekViewProps>(({ currentDate, events, onEventSelect, onEventUpdate }, ref) => {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    startTime: null,
    endTime: null,
    startY: 0,
    currentY: 0,
  });
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [hasUserScrolled, setHasUserScrolled] = useState(false);
  const [dialogStartTime, setDialogStartTime] = useState<Date | null>(null);
  const [dialogEndTime, setDialogEndTime] = useState<Date | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Generate week days
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  // Generate time slots (24 hours in 30-minute increments)
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        slots.push({ hour, minute });
      }
    }
    return slots;
  }, []);

  // Group events by day
  const eventsByDay = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    
    weekDays.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      grouped[dayKey] = events.filter(event => {
        const eventStart = new Date(event.startTime);
        return isSameDay(eventStart, day);
      });
    });
    
    return grouped;
  }, [events, weekDays]);

  // Calculate event positioning
  const getEventStyle = (event: any) => {
    const startTime = new Date(event.startTime);
    const endTime = new Date(event.endTime);
    
    // Calculate position from top (in minutes from midnight)
    const startMinutes = startTime.getHours() * 60 + startTime.getMinutes();
    const duration = differenceInMinutes(endTime, startTime);
    
    // Each slot is 30px high, representing 30 minutes
    const top = (startMinutes / 30) * 30;
    const height = Math.max((duration / 30) * 30, 20); // Minimum 20px height
    
    return { top, height };
  };

  // Convert Y position to time
  const yToTime = useCallback((y: number, day: Date) => {
    const slotHeight = 30; // Each 30-minute slot is 30px high
    const slotIndex = Math.floor(y / slotHeight);
    const minutes = slotIndex * 30;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    const time = new Date(day);
    time.setHours(hours, mins, 0, 0);
    return time;
  }, []);

  // Handle mouse down for drag start
  const handleMouseDown = useCallback((e: React.MouseEvent, day: Date) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const startTime = yToTime(y, day);
    
    setDragState({
      isDragging: true,
      startTime,
      endTime: addMinutes(startTime, 30), // Default 30-minute duration
      startY: y,
      currentY: y,
    });
    setSelectedDay(day);
  }, [yToTime]);

  // Handle mouse move for drag
  const handleMouseMove = useCallback((e: React.MouseEvent, day: Date) => {
    if (!dragState.isDragging || !dragState.startTime || !isSameDay(day, selectedDay!)) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const endTime = yToTime(Math.max(y, dragState.startY + 30), day); // Min 30 minutes
    
    setDragState(prev => ({
      ...prev,
      endTime,
      currentY: y,
    }));
  }, [dragState.isDragging, dragState.startTime, dragState.startY, selectedDay, yToTime]);

  // Handle mouse up for drag end
  const handleMouseUp = useCallback(() => {
    if (dragState.isDragging && dragState.startTime && dragState.endTime) {
      setDialogStartTime(dragState.startTime);
      setDialogEndTime(dragState.endTime);
      setShowCreateDialog(true);
    }
    
    setDragState({
      isDragging: false,
      startTime: null,
      endTime: null,
      startY: 0,
      currentY: 0,
    });
  }, [dragState]);

  // Handle time slot click for event creation
  const handleTimeSlotClick = (day: Date, timeSlot: { hour: number; minute: number }) => {
    const clickTime = new Date(day);
    clickTime.setHours(timeSlot.hour, timeSlot.minute, 0, 0);
    const endTime = addMinutes(clickTime, 60); // Default 1-hour duration
    
    setDialogStartTime(clickTime);
    setDialogEndTime(endTime);
    setSelectedDay(day);
    setShowCreateDialog(true);
  };

  // Handle user scroll to prevent auto-scroll interference
  const handleScroll = useCallback(() => {
    setHasUserScrolled(true);
  }, []);

  // Auto-scroll to current hour on mount and when date changes
  useEffect(() => {
    const scrollToCurrentHour = () => {
      if (!scrollContainerRef.current || hasUserScrolled) return;
      
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinutes = now.getMinutes();
      
      // Calculate the position (each 30-minute slot is 30px high)
      const totalMinutesFromMidnight = currentHour * 60 + currentMinutes;
      const scrollPosition = (totalMinutesFromMidnight / 30) * 30;
      
      // Center the current time in the viewport
      const containerHeight = scrollContainerRef.current.clientHeight;
      const centeredPosition = scrollPosition - (containerHeight / 2);
      
      scrollContainerRef.current.scrollTo({
        top: Math.max(0, centeredPosition),
        behavior: 'smooth'
      });
    };

    // Reset user scroll state when date changes
    setHasUserScrolled(false);
    
    // Small delay to ensure the component is fully rendered
    const timeoutId = setTimeout(scrollToCurrentHour, 200);
    return () => clearTimeout(timeoutId);
  }, [currentDate, hasUserScrolled]);

  // Expose scrollToCurrentTime method via ref
  useImperativeHandle(ref, () => ({
    scrollToCurrentTime: () => {
      if (!scrollContainerRef.current) return;
      
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinutes = now.getMinutes();
      
      // Calculate the position (each 30-minute slot is 30px high)
      const totalMinutesFromMidnight = currentHour * 60 + currentMinutes;
      const scrollPosition = (totalMinutesFromMidnight / 30) * 30;
      
      // Center the current time in the viewport
      const containerHeight = scrollContainerRef.current.clientHeight;
      const centeredPosition = scrollPosition - (containerHeight / 2);
      
      scrollContainerRef.current.scrollTo({
        top: Math.max(0, centeredPosition),
        behavior: 'smooth'
      });
      
      // Reset user scroll state so auto-scroll works again
      setHasUserScrolled(false);
    }
  }), []);

  return (
    <div className="flex flex-col h-full">
      {/* Week header */}
      <div className="flex border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        {/* Time column header */}
        <div className="w-16 flex-shrink-0 border-r p-2"></div>
        
        {/* Day headers */}
        {weekDays.map((day) => {
          const isCurrentDay = isToday(day);
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "flex-1 p-2 text-center border-r last:border-r-0 transition-colors",
                isCurrentDay && "bg-primary/5"
              )}
            >
              <div className="space-y-1">
                <div className={cn(
                  "text-xs font-medium uppercase",
                  isCurrentDay ? "text-primary font-semibold" : "text-muted-foreground"
                )}>
                  {format(day, 'EEE')}
                </div>
                <div
                  className={cn(
                    "text-sm font-semibold w-8 h-8 rounded-full flex items-center justify-center mx-auto transition-colors",
                    isCurrentDay 
                      ? "bg-primary text-primary-foreground shadow-sm" 
                      : "hover:bg-muted"
                  )}
                >
                  {format(day, 'd')}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Week content */}
      <div className="flex-1 overflow-auto" ref={scrollContainerRef} onScroll={handleScroll}>
        <div className="relative flex">
          {/* Time grid */}
          <TimeGrid timeSlots={timeSlots} />
          
          {/* Day columns */}
          {weekDays.map((day) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const dayEvents = eventsByDay[dayKey] || [];
            const isCurrentDay = isToday(day);
            
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "flex-1 relative border-r last:border-r-0 select-none",
                  isCurrentDay && "bg-primary/5"
                )}
                style={{ minHeight: timeSlots.length * 30 }}
                onMouseDown={(e) => handleMouseDown(e, day)}
                onMouseMove={(e) => handleMouseMove(e, day)}
                onMouseUp={handleMouseUp}
              >
                {/* Time slot overlay for clicking */}
                {timeSlots.map((timeSlot, index) => (
                  <div
                    key={`${timeSlot.hour}-${timeSlot.minute}`}
                    className="absolute w-full h-[30px] border-b border-border/50 hover:bg-muted/20 cursor-pointer"
                    style={{ top: index * 30 }}
                    onClick={() => handleTimeSlotClick(day, timeSlot)}
                  />
                ))}
                
                {/* Drag preview */}
                {dragState.isDragging && 
                 dragState.startTime && 
                 dragState.endTime && 
                 selectedDay && 
                 isSameDay(day, selectedDay) && (
                  <div
                    className="absolute left-1 right-1 z-20 bg-primary/20 border-2 border-primary border-dashed rounded-md flex items-center justify-center text-xs text-primary font-medium"
                    style={{
                      top: Math.min(dragState.startY, dragState.currentY),
                      height: Math.abs(dragState.currentY - dragState.startY) || 30,
                    }}
                  >
                    New Event
                  </div>
                )}
                
                {/* Events */}
                {dayEvents.map((event) => {
                  const { top, height } = getEventStyle(event);
                  return (
                    <div
                      key={event.id}
                      className="absolute left-1 right-1 z-10"
                      style={{ top, height }}
                    >
                      <EventCard
                        event={event}
                        onClick={() => onEventSelect(event.id)}
                        compact={height < 40}
                      />
                    </div>
                  );
                })}
                
                {/* Current time indicator */}
                {isCurrentDay && (
                  <CurrentTimeIndicator />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Create Event Dialog */}
      <CreateEventDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        initialStartTime={dialogStartTime || undefined}
        initialEndTime={dialogEndTime || undefined}
        onEventCreated={onEventUpdate}
      />
    </div>
  );
});

WeekView.displayName = 'WeekView';

// Current time indicator component
function CurrentTimeIndicator() {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const top = (currentMinutes / 30) * 30;
  
  return (
    <div
      className="absolute left-0 right-0 z-30 flex items-center pointer-events-none"
      style={{ top }}
    >
      <div className="w-3 h-3 bg-red-500 rounded-full -ml-1.5 shadow-sm border-2 border-white"></div>
      <div className="flex-1 h-0.5 bg-red-500 shadow-sm"></div>
      <div className="absolute -top-3 left-2 text-xs font-medium text-red-500 bg-white px-1 rounded shadow-sm">
        {format(now, 'HH:mm')}
      </div>
    </div>
  );
}