import type { Note } from '@/types';
import React from 'react';

export const NOTE_COLORS = [
  {
    value: 'default',
    label: 'Default',
    class: 'border-l-gray-400',
    bgClass: 'hover:bg-gray-50 dark:hover:bg-gray-950/20',
  },
  {
    value: 'blue',
    label: 'Blue',
    class: 'border-l-blue-500',
    bgClass: 'hover:bg-blue-50 dark:hover:bg-blue-950/20',
  },
  {
    value: 'lightblue',
    label: 'Light Blue',
    class: 'border-l-sky-500',
    bgClass: 'hover:bg-sky-50 dark:hover:bg-sky-950/20',
  },
  {
    value: 'red',
    label: 'Red',
    class: 'border-l-red-500',
    bgClass: 'hover:bg-red-50 dark:hover:bg-red-950/20',
  },
  {
    value: 'green',
    label: 'Green',
    class: 'border-l-green-500',
    bgClass: 'hover:bg-green-50 dark:hover:bg-green-950/20',
  },
  {
    value: 'purple',
    label: 'Purple',
    class: 'border-l-purple-500',
    bgClass: 'hover:bg-purple-50 dark:hover:bg-purple-950/20',
  },
  {
    value: 'indigo',
    label: 'Indigo',
    class: 'border-l-indigo-500',
    bgClass: 'hover:bg-indigo-50 dark:hover:bg-indigo-950/20',
  },
  {
    value: 'pink',
    label: 'Pink',
    class: 'border-l-pink-500',
    bgClass: 'hover:bg-pink-50 dark:hover:bg-pink-950/20',
  },
] as const;

export const NOTE_COLOR_TRANSLATION_KEYS: Record<string, string> = {
  default: 'common.notes.colors.default',
  blue: 'common.notes.colors.blue',
  lightblue: 'common.notes.colors.lightblue',
  red: 'common.notes.colors.red',
  green: 'common.notes.colors.green',
  purple: 'common.notes.colors.purple',
  indigo: 'common.notes.colors.indigo',
  pink: 'common.notes.colors.pink',
};

export function getNoteColorTranslationKey(colorValue: string): string {
  return NOTE_COLOR_TRANSLATION_KEYS[colorValue] || colorValue;
}

export function getNoteColorClass(color: string): string {
  const colorInfo = NOTE_COLORS.find((c) => c.value === color);
  return colorInfo?.class || 'border-l-gray-400';
}



export function borderToBackgroundColorClass(borderClass: string): string {
  const colorMap: Record<string, string> = {
    'border-l-gray-400': 'bg-gray-400',
    'border-l-blue-500': 'bg-blue-500',
    'border-l-sky-500': 'bg-sky-500',
    'border-l-red-500': 'bg-red-500',
    'border-l-green-500': 'bg-green-500',
    'border-l-purple-500': 'bg-purple-500',
    'border-l-indigo-500': 'bg-indigo-500',
    'border-l-pink-500': 'bg-pink-500',
  };

  return colorMap[borderClass] || 'bg-gray-400';
}

export function formatRelativeTime(dateInput: string | Date, formatter?: any): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (formatter) {
    return formatter.relativeTime(date, {
      now,
      style: 'long',
    });
  }

  if (diffInSeconds < 60) {
    return 'just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  } else {
    return formatDate(date);
  }
}

export function formatDate(dateInput: string | Date, formatter?: any): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;

  if (formatter) {
    return formatter.dateTime(date, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function sortNotes(notes: Note[]): Note[] {
  const pinnedNotes = notes.filter((note) => note.isPinned);
  const unpinnedNotes = notes.filter((note) => !note.isPinned);

  const sortedPinnedNotes = sortNotesByOrder(pinnedNotes);
  const sortedUnpinnedNotes = sortNotesByOrder(unpinnedNotes);

  return [...sortedPinnedNotes, ...sortedUnpinnedNotes];
}

export function sortNotesByOrder(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    if (typeof a.order === 'number' && typeof b.order === 'number') {
      return a.order - b.order;
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function assignOrdersAfterPinnedReorder(notes: Note[]): Note[] {
  return notes.map((note, index) => ({
    ...note,
    order: index,
  }));
}

export function assignOrdersAfterUnpinnedReorder(notes: Note[], pinnedNotesCount: number): Note[] {
  return notes.map((note, index) => ({
    ...note,
    order: pinnedNotesCount + index,
  }));
}

export function updateNotesWithNewOrders(
  notes: Note[],
  updatedOrders: { id: string; order: number; isPinned?: boolean }[],
): Note[] {
  const updatedNotes = notes.map((note) => {
    const update = updatedOrders.find((update) => update.id === note.id);

    if (!update) {
      return note;
    }

    return {
      id: note.id,
      userId: note.userId,
      threadId: note.threadId,
      content: note.content,
      color: note.color,
      isPinned: update.isPinned !== undefined ? update.isPinned : note.isPinned,
      order: update.order,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    };
  });

  return sortNotes(updatedNotes);
}
