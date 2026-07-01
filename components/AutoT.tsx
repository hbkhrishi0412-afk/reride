import React from 'react';
import { useAutoT } from '../hooks/useAutoT';
import type { TOptions } from 'i18next';

type AutoTProps = {
  i18nKey: string;
  options?: TOptions;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  children?: never;
};

/** Inline text that auto-translates from an i18n key into hi/te/ta. */
const AutoT: React.FC<AutoTProps> = ({ i18nKey, options, as: Tag = 'span', className }) => {
  const text = useAutoT(i18nKey, options);
  return React.createElement(Tag, { className, 'data-no-translate': true }, text);
};

export default AutoT;
