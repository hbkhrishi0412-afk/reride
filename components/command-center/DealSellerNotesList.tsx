import React, { useState } from 'react';
import type { DealSellerNote } from '../../types.js';
import { createSellerNote } from '../../lib/dealSellerNotes.js';

export interface DealSellerNotesListProps {
  notes: DealSellerNote[];
  saving?: boolean;
  onChange: (notes: DealSellerNote[]) => void;
}

export const DealSellerNotesList: React.FC<DealSellerNotesListProps> = ({
  notes,
  saving = false,
  onChange,
}) => {
  const [draft, setDraft] = useState('');

  const addNote = () => {
    const text = draft.trim();
    if (!text || saving) return;
    onChange([...notes, createSellerNote(text)]);
    setDraft('');
  };

  const removeNote = (id: string) => {
    if (saving) return;
    onChange(notes.filter((note) => note.id !== id));
  };

  return (
    <div className="space-y-3">
      {notes.length === 0 ? (
        <p className="text-xs text-slate-500">No notes yet. Add your first note below.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li
              key={note.id}
              className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-2"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-900 whitespace-pre-wrap break-words">{note.text}</p>
                <p className="text-[10px] text-slate-400 mt-1">
                  {new Date(note.createdAt).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => removeNote(note.id)}
                className="shrink-0 text-[11px] font-semibold text-red-600 hover:text-red-700 disabled:opacity-50 px-1"
                aria-label="Remove note"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addNote();
            }
          }}
          placeholder="Add a note…"
          className="flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-white disabled:opacity-50"
        />
        <button
          type="button"
          disabled={saving || !draft.trim()}
          onClick={addNote}
          className="shrink-0 px-3 py-2 text-xs font-bold rounded-lg bg-slate-900 text-white disabled:opacity-50 active:scale-95"
        >
          {saving ? '…' : '+ Add'}
        </button>
      </div>
    </div>
  );
};

export default DealSellerNotesList;
