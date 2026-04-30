// Episode hub — single responsive page. List of vocabulary decks for one episode.
// One layout, scales via CSS max-width breakpoints.

const DECKS = [
  { id: "b1b2",    level: "B1 — B2",      title: "Слова · средний",         count: 24, known: 7, active: true },
  { id: "c1c2",    level: "C1 — C2",      title: "Слова · продвинутый",     count: 18, known: 0, active: false },
  { id: "phrasal", level: "Phrasal",      title: "Фразовые глаголы",        count: 12, known: 0, active: false },
  { id: "colloc",  level: "Collocations", title: "Устойчивые выражения",     count: 9,  known: 0, active: false },
  { id: "idioms",  level: "Idioms",       title: "Идиомы",                   count: 6,  known: 0, active: false },
];

function DeckRow({ deck }) {
  const pct = deck.count ? (deck.known / deck.count) * 100 : 0;
  const Tag = deck.active ? "a" : "div";
  const props = deck.active ? { href: "Flashcards.html" } : {};
  return (
    <Tag {...props} className={"deck-row" + (deck.active ? " active" : "")}>
      <div className="deck-main">
        <div className="deck-level">{deck.level}</div>
        <div className="deck-title">{deck.title}</div>
        <div className="deck-meta">
          {deck.active
            ? <React.Fragment><b>{deck.known}</b> / {deck.count}</React.Fragment>
            : <React.Fragment>{deck.count} карточек · скоро</React.Fragment>}
        </div>
      </div>
      <div className="deck-right">
        {deck.active && (
          <div className="progress">
            <div className="progress-fill" style={{width: pct + "%"}} />
          </div>
        )}
        <div className="arrow">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      </div>
    </Tag>
  );
}

function Home() {
  return (
    <div className="page">
      <div className="topbar">
        <button className="back">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5L4 6l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span>сезон 1</span>
        </button>
        <div className="show-code"><b>S01</b> · E01</div>
      </div>

      <div className="hero">
        <h1>Your Friends<br/><span className="amp">&amp;</span> Neighbors</h1>
        <div className="hero-meta">
          <span>Эпизод 01</span>
          <span className="dot" />
          <span>This Is What Happens</span>
        </div>
      </div>

      <div className="section-label">
        <span className="t">Что учим</span>
        <span className="line" />
      </div>

      <div className="deck-list">
        {DECKS.map((d) => <DeckRow key={d.id} deck={d} />)}
      </div>
    </div>
  );
}

window.Home = Home;
