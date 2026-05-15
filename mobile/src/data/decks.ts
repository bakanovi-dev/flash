export interface WordCard {
  forms: [string, string, string];
  formUsed: string;
  example: string;
  ru: string;
  film: string;
  character?: string;
}

export interface PhrasalCard {
  type: 'phrasal' | 'idiom' | 'vocab';
  phrase: string;
  translation: string;
  context: string;
  contextTranslation?: string;
  literalTranslation?: string;
  history?: string;
  level?: string;
}

export interface DeckMeta {
  id: string;
  level: string;
  title: string;
  count: number;
  known: number;
  active: boolean;
}

// Static word cards — populate with your data
export const WORD_DECK: WordCard[] = [];

// Static phrasal verb cards — populate with your data
export const PHRASAL_DECK: PhrasalCard[] = [];

// Static idiom cards — populate with your data
export const IDIOM_DECK: PhrasalCard[] = [];

// Ordered segment deck — populate with your data
export const SEGMENT1_DECK: PhrasalCard[] = [];

export const DECKS: DeckMeta[] = [
  { id: 'b1b2', level: 'B1–B2', title: 'Неправильные глаголы', count: 0, known: 0, active: false },
  { id: 'seg1', level: 'S01E01', title: 'Your Friends & Neighbors', count: 0, known: 0, active: false },
  { id: 'phrasal', level: 'B2', title: 'Фразовые глаголы', count: 0, known: 0, active: false },
  { id: 'idioms', level: 'B2–C1', title: 'Идиомы', count: 0, known: 0, active: false },
];
