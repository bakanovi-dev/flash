function DeckRow({ deck, onNavigate }) {
  const pct = deck.count ? (deck.known / deck.count) * 100 : 0;
  return (
    <div
      className={"deck-row" + (deck.active ? " active" : "")}
      onClick={deck.active ? () => onNavigate(deck.id) : undefined}
    >
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
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </div>
  );
}

function Home({ onNavigate }) {
  return (
    <div className="page">
      <div className="topbar">
        <button className="nav-back">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M7.5 2.5L4 6l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
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
        {window.DECKS.map((d) => <DeckRow key={d.id} deck={d} onNavigate={onNavigate} />)}
      </div>
    </div>
  );
}

window.Home = Home;
