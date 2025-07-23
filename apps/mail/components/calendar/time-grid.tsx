'use client';

import { format } from 'date-fns';

interface TimeGridProps {
  timeSlots: Array<{ hour: number; minute: number }>;
}

export function TimeGrid({ timeSlots }: TimeGridProps) {
  return (
    <div className="w-16 flex-shrink-0 border-r bg-background/95">
      {timeSlots.map((slot, index) => {
        // Only show labels for the top of each hour
        const showLabel = slot.minute === 0;
        
        return (
          <div
            key={`${slot.hour}-${slot.minute}`}
            className="h-[30px] border-b border-border/50 relative flex items-start justify-end pr-2"
          >
            {showLabel && (
              <span className="text-xs text-muted-foreground -mt-2">
                {format(new Date().setHours(slot.hour, 0, 0, 0), 'ha')}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}