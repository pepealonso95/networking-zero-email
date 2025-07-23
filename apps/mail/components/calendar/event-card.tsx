'use client';

import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Video, MapPin, Users } from 'lucide-react';

interface EventCardProps {
  event: any;
  onClick: () => void;
  compact?: boolean;
}

export function EventCard({ event, onClick, compact = false }: EventCardProps) {
  const startTime = new Date(event.startTime);
  const endTime = new Date(event.endTime);
  
  // Determine event color based on source
  const getEventColor = (source: string) => {
    switch (source) {
      case 'google':
        return 'bg-blue-500 border-blue-600';
      case 'zero':
        return 'bg-green-500 border-green-600';
      case 'booking':
        return 'bg-purple-500 border-purple-600';
      default:
        return 'bg-gray-500 border-gray-600';
    }
  };

  const colorClass = getEventColor(event.source);

  return (
    <div
      className={cn(
        "rounded-md border-l-4 bg-card p-2 shadow-sm cursor-pointer hover:shadow-md transition-shadow",
        colorClass,
        compact && "p-1"
      )}
      onClick={onClick}
    >
      <div className="space-y-1">
        {/* Event title */}
        <div className={cn(
          "font-medium text-card-foreground line-clamp-2",
          compact ? "text-xs" : "text-sm"
        )}>
          {event.title}
        </div>
        
        {/* Time */}
        <div className={cn(
          "text-muted-foreground",
          compact ? "text-xs" : "text-xs"
        )}>
          {event.isAllDay ? (
            'All day'
          ) : (
            `${format(startTime, 'h:mm a')} - ${format(endTime, 'h:mm a')}`
          )}
        </div>
        
        {/* Additional details (only if not compact) */}
        {!compact && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {/* Meeting link indicator */}
            {event.meetingLink && (
              <div className="flex items-center gap-1">
                <Video className="h-3 w-3" />
              </div>
            )}
            
            {/* Location indicator */}
            {event.location && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
              </div>
            )}
            
            {/* Attendees indicator */}
            {event.attendees && event.attendees.length > 0 && (
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>{event.attendees.length}</span>
              </div>
            )}
            
            {/* Source badge */}
            <Badge variant="outline" className="text-xs">
              {event.source}
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}