import React from 'react';

interface ChatMessageVoiceProps {
  src: string;
  durationSeconds?: number;
  /** Extra classes for the wrapper (e.g. light-on-blue bubble). */
  className?: string;
}

export const ChatMessageVoice: React.FC<ChatMessageVoiceProps> = ({
  src,
  durationSeconds,
  className = '',
}) => {
  return (
    <div className={`flex flex-col gap-1 min-w-[200px] max-w-full ${className}`}>
      <audio src={src} controls className="h-9 w-full max-w-[280px]" preload="metadata" />
      {typeof durationSeconds === 'number' && durationSeconds > 0 && (
        <span className="text-[11px] tabular-nums opacity-80">{durationSeconds}s</span>
      )}
    </div>
  );
};
