/**
 * Text shown to people, in every supported language. English is required;
 * a missing translation falls back to it.
 */
export interface Localized {
  en: string;
  zh?: string;
}
