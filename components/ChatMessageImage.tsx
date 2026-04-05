import React from 'react';

/** Shared image bubble for chat (mobile inbox, inline chat, floating widget). */
export function ChatMessageImage({ src, className = '' }: { src: string; className?: string }) {
  if (!src?.trim()) return null;
  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      className={`block rounded-xl overflow-hidden max-w-[min(100%,280px)] ${className}`}
    >
      <img
        src={src}
        alt="Shared photo"
        className="w-full max-h-60 object-cover bg-black/5"
        loading="lazy"
        decoding="async"
      />
    </a>
  );
}
