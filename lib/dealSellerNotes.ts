import type { DealSellerNote } from '../types.js';

function isValidNote(value: unknown): value is DealSellerNote {
  if (!value || typeof value !== 'object') return false;
  const note = value as DealSellerNote;
  return typeof note.id === 'string' && typeof note.text === 'string' && typeof note.createdAt === 'string';
}

/** Parse seller_notes column — supports JSON array or legacy plain text. */
export function parseSellerNotes(raw: unknown): DealSellerNote[] {
  if (raw == null) return [];

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) {
          return parsed.filter(isValidNote).map((note) => ({
            id: note.id,
            text: note.text.trim(),
            createdAt: note.createdAt,
          }));
        }
      } catch {
        /* fall through to legacy plain text */
      }
    }

    return [
      {
        id: 'note_legacy',
        text: trimmed,
        createdAt: new Date().toISOString(),
      },
    ];
  }

  return [];
}

export function normalizeSellerNotes(notes: DealSellerNote[]): DealSellerNote[] {
  return notes
    .map((note) => ({
      id: String(note.id || `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
      text: String(note.text || '').trim(),
      createdAt: note.createdAt || new Date().toISOString(),
    }))
    .filter((note) => note.text.length > 0);
}

export function serializeSellerNotes(notes: DealSellerNote[]): string {
  return JSON.stringify(normalizeSellerNotes(notes));
}

export function createSellerNote(text: string): DealSellerNote {
  return {
    id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };
}
