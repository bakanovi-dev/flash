window.DECKS = [
  { id: "b1b2",    level: "B1 — B2",      title: "Слова · средний",       count: 24, known: 7, active: true },
  { id: "c1c2",    level: "C1 — C2",      title: "Слова · продвинутый",   count: 18, known: 0, active: false },
  { id: "phrasal", level: "Phrasal",      title: "Фразовые глаголы",      count: 12, known: 0, active: false },
  { id: "colloc",  level: "Collocations", title: "Устойчивые выражения",  count: 9,  known: 0, active: false },
  { id: "idioms",  level: "Idioms",       title: "Идиомы",                count: 6,  known: 0, active: false },
];

// Структура карточки:
//   front:  en (V1), example
//   back:   forms [V1,V2,V3], allSame, formUsed ("V1"|"V2"|"V3"), ru, film, character
window.WORD_DECK = [
  {
    en: "put",
    example: "Put some pressure on him.",
    forms: ["put", "put", "put"],
    allSame: true,
    formUsed: "V1 (Present / Base)",
    ru: "Надави на него",
    film: "The Godfather",
    character: "Майкл Корлеоне",
  },
  {
    en: "put",
    example: "You put me in a difficult position.",
    forms: ["put", "put", "put"],
    allSame: true,
    formUsed: "V2 (Past)",
    ru: "Ты поставил меня в сложное положение",
    film: "The Dark Knight",
    character: "Джокер",
  },
  {
    en: "put",
    example: "The plan is put on hold.",
    forms: ["put", "put", "put"],
    allSame: true,
    formUsed: "V3 (состояние)",
    ru: "План находится на паузе",
    film: "Mission: Impossible",
    character: "",
  },
  {
    en: "put",
    example: "I have put a lot of thought into this.",
    forms: ["put", "put", "put"],
    allSame: true,
    formUsed: "V3 (Perfect)",
    ru: "Я хорошо это обдумал",
    film: "Inception",
    character: "Кобб",
  },
  {
    en: "put",
    example: "The put conditions were unacceptable.",
    forms: ["put", "put", "put"],
    allSame: true,
    formUsed: "V3 (определение состояния)",
    ru: "Установленные условия были неприемлемы",
    film: "The Godfather",
    character: "",
  },
];
