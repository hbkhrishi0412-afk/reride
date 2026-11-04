import React from 'react';

/** Quiet section title for a wizard step. */
export const FormFieldset: React.FC<{
    title: string;
    children: React.ReactNode;
    icon?: React.ReactNode;
    description?: string;
    step?: number;
    defaultOpen?: boolean;
    actions?: React.ReactNode;
}> = ({ title, children, description, actions }) => (
    <section className="space-y-4">
        <header className="flex items-start justify-between gap-3">
            <div className="min-w-0">
                <h3
                    className="text-lg font-semibold tracking-tight text-stone-900"
                    style={{ fontFamily: "'Nunito Sans', Poppins, sans-serif", letterSpacing: '-0.03em' }}
                >
                    {title}
                </h3>
                {description ? <p className="mt-0.5 max-w-xl text-sm leading-snug text-stone-600">{description}</p> : null}
            </div>
            {actions ? <div className="flex-shrink-0">{actions}</div> : null}
        </header>
        {children}
    </section>
);

/** Labeled field cluster inside a step — keeps dense forms scannable. */
export const FieldGroup: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="space-y-2.5">
        <h4 className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-700">{title}</h4>
        {children}
    </div>
);
