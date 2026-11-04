import React, { memo, useId, useState } from 'react';

export const HelpTooltip: React.FC<{ text: string }> = memo(({ text }) => {
    const tipId = useId();
    const [open, setOpen] = useState(false);

    return (
        <span
            className="relative ml-1 inline-flex"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
        >
            <button
                type="button"
                aria-label="Help"
                aria-describedby={open ? tipId : undefined}
                className="inline-flex p-0 m-0 border-0 bg-transparent cursor-help"
                onClick={(e) => {
                    e.preventDefault();
                    setOpen((v) => !v);
                }}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-reride-text-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </button>
            {open && (
                <span
                    id={tipId}
                    role="tooltip"
                    className="absolute top-full left-1/2 z-50 mt-1 w-48 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg"
                >
                    {text}
                </span>
            )}
        </span>
    );
});
