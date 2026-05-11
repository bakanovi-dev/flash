const { useState, useRef, useEffect } = React;

const BATCH_SIZE = 15;
const PRELOAD_AT = 5;
const REPEAT_WINDOW = 100;
const CURRENT_USER_ID = '1';

function SpeakBtn({ text }) {
  const [speaking, setSpeaking] = useState(false);

  const toggle = (e) => {
    e.stopPropagation();
    if (!window.speechSynthesis) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    } else {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US'; u.rate = 0.88;
      u.onend   = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
      setSpeaking(true);
    }
  };

  return (
    <button
      className="speak-btn"
      aria-label={speaking ? 'Остановить' : 'Произнести'}
      onPointerDown={e => e.stopPropagation()}
      onClick={toggle}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '0 0 8px 0', display: 'block', lineHeight: 1,
        color: speaking ? 'var(--accent)' : 'var(--muted)',
        opacity: speaking ? 1 : 0.5,
        alignSelf: 'flex-start',
        transition: 'color 150ms, opacity 150ms',
      }}
    >
      {speaking ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <rect x="5" y="5" width="14" height="14" rx="2"/>
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
        </svg>
      )}
    </button>
  );
}

function QuoteCardFaces({ card }) {
  const epLabel = card.show && card.season != null
    ? `${card.show} · S${String(card.season).padStart(2,'0')}E${String(card.episode).padStart(2,'0')}`
    : card.show || null;

  return (
    <>
      <div className="face front" style={{ justifyContent: 'center', gap: 20 }}>
        <div className="reel-meta">
          {epLabel && <span className="reel-meta-show">{epLabel}</span>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SpeakBtn text={card.quote_en} />
          <div className="reel-quote">{card.quote_en}</div>
          {card.context && (
            <div className="reel-context">{card.context}</div>
          )}
        </div>
      </div>
      <div className="face back" style={{ justifyContent: 'flex-start', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div className="back-inner">
          <div className="reel-quote-ru">{card.quote_ru}</div>
          <div className="reel-expressions">
            {card.expressions.map((expr, i) => (
              <div key={i} className="reel-expr">
                <div className="reel-expr-header">
                  <span className="reel-expr-phrase">{expr.phrase}</span>
                </div>
                <div className="reel-expr-literal">{expr.literal}</div>
                <div className="reel-expr-explanation">{expr.explanation}</div>
              </div>
            ))}
          </div>
          {card.words && card.words.length > 0 && (
            <div className="reel-words">
              {card.words.map((w, i) => (
                <div key={i} className="reel-word-chip">
                  <span className={"reel-level reel-level-" + w.level}>{w.level}</span>
                  <span className="reel-word-text">{w.word}</span>
                  <span className="reel-word-tr">{w.translation}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function reelKey(card) { return 'reel::' + card.id; }

function fireEvent(cardId, event) {
  const base = window.API_BASE || '';
  fetch(`${base}/api/v1/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ card_id: cardId, event, user_id: CURRENT_USER_ID }),
  }).catch(() => {});
}

function ReelCards({ onBack }) {
  const [deck,         setDeck]         = useState([]);
  const [index,        setIndex]        = useState(0);
  const [loading,      setLoading]      = useState(false);
  const [flipped,      setFlipped]      = useState(false);
  const [dy,           setDy]           = useState(0);
  const [dragging,     setDragging]     = useState(false);
  const [exitDir,      setExitDir]      = useState(null);
  const [pendingIndex, setPendingIndex] = useState(null);
  const [likes,        setLikes]        = useState(() => new Set());
  const [dislikes,     setDislikes]     = useState(() => new Set());
  const [saves,        setSaves]        = useState(() => new Set());
  const [menuOpen,     setMenuOpen]     = useState(false);

  const dragRef      = useRef({ id: null, startY: 0, startTime: 0, moved: false });
  const dyRef        = useRef(0);
  const indexRef     = useRef(0);
  const transRef     = useRef(false);
  const deckRef      = useRef([]);
  const cursorRef    = useRef(null);
  const resumeRef    = useRef(false);
  const hasMoreRef   = useRef(true);
  const fetchingRef  = useRef(false);
  const flippedRef    = useRef(false);
  const wasFlippedRef = useRef(false);
  const menuOpenRef   = useRef(false);

  indexRef.current   = index;
  deckRef.current    = deck;
  menuOpenRef.current = menuOpen;

  const fetchBatch = () => {
    if (fetchingRef.current) return;
    if (!hasMoreRef.current && deckRef.current.length > 0) return;
    fetchingRef.current = true;
    setLoading(true);

    const params = new URLSearchParams({
      limit: String(BATCH_SIZE),
      lang: 'ru',
      user_id: CURRENT_USER_ID,
    });
    if (cursorRef.current !== null) params.set('cursor', cursorRef.current);
    if (resumeRef.current) { params.set('resume', '1'); resumeRef.current = false; }

    const base = window.API_BASE || '';
    fetch(`${base}/api/v1/feed?${params}`)
      .then(r => r.json())
      .then(data => {
        fetchingRef.current = false;
        setLoading(false);
        hasMoreRef.current = !!data.has_more;
        cursorRef.current = data.next_cursor ?? cursorRef.current;

        if (data.items && data.items.length > 0) {
          const cards = data.items.map(c => ({ ...c, quote_ru: c.quote_translated }));
          setSaves(prev => {
            const s = new Set(prev);
            cards.forEach(c => { if (c.saved) s.add(reelKey(c)); });
            return s;
          });
          setLikes(prev => {
            const s = new Set(prev);
            cards.forEach(c => { if (c.liked) s.add(reelKey(c)); });
            return s;
          });
          setDeck(prev => {
            const seen = new Set(prev.map(c => c.id));
            const updated = [...prev, ...cards.filter(c => !seen.has(c.id))];
            deckRef.current = updated;
            return updated;
          });
        }
      })
      .catch(e => {
        console.error('Feed fetch error:', e);
        fetchingRef.current = false;
        setLoading(false);
      });
  };

  useEffect(() => {
    const base = window.API_BASE || '';
    fetch(`${base}/api/v1/feed/state?user_id=${CURRENT_USER_ID}`)
      .then(r => r.json())
      .then(data => { if (data.cursor !== null) { cursorRef.current = data.cursor; resumeRef.current = true; } })
      .catch(() => {})
      .finally(() => fetchBatch());
  }, []);

  useEffect(() => {
    if (deck.length === 0) return;
    if (deckRef.current.length - index <= PRELOAD_AT) {
      fetchBatch();
    }
  }, [index, deck.length]);

  const doFlip = () => {
    if (menuOpenRef.current) return;
    const next = !flippedRef.current;
    flippedRef.current = next;
    setFlipped(next);
    if (next && !wasFlippedRef.current) {
      wasFlippedRef.current = true;
      const curCard = deckRef.current[indexRef.current];
      if (curCard) {
        fireEvent(curCard.id, 'flip');
        const base = window.API_BASE || '';
        fetch(`${base}/api/v1/feed/position?user_id=${CURRENT_USER_ID}&prev_rand=${curCard.rand}`, { method: 'POST' }).catch(() => {});
      }
    }
  };

  const navigate = (dir) => {
    if (menuOpenRef.current) { setMenuOpen(false); return; }
    if (transRef.current) return;
    const curIdx  = indexRef.current;
    const nextIdx = curIdx + (dir === 'up' ? 1 : -1);
    if (nextIdx < 0 || nextIdx >= deckRef.current.length) { dyRef.current = 0; setDy(0); return; }

    if (dir === 'up') {
      const curCard = deckRef.current[curIdx];
      if (curCard && !wasFlippedRef.current) fireEvent(curCard.id, 'skip');
    }

    transRef.current = true;
    setExitDir(dir);
    setPendingIndex(nextIdx);
    dyRef.current = 0; setDy(0);
    setTimeout(() => {
      setIndex(nextIdx);
      setFlipped(false); flippedRef.current = false;
      wasFlippedRef.current = false;
      setExitDir(null); setPendingIndex(null);
      transRef.current = false;
      const nextCard = deckRef.current[nextIdx];
      if (nextCard) {
        const base = window.API_BASE || '';
        fetch(`${base}/api/v1/feed/position?user_id=${CURRENT_USER_ID}&prev_rand=${nextCard.rand}`, { method: 'POST' }).catch(() => {});
      }
    }, 340);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === ' ')              { e.preventDefault(); doFlip(); }
      else if (e.key === 'ArrowUp')   navigate('up');
      else if (e.key === 'ArrowDown') navigate('down');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onPointerDown = (e) => {
    if (menuOpen) return;
    if (e.target.closest('.reel-card-actions') || e.target.closest('.speak-btn')) return;
    if (transRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id: e.pointerId, startY: e.clientY, startTime: Date.now(), moved: false };
    setDragging(false);
  };

  const onPointerMove = (e) => {
    const ds = dragRef.current;
    if (ds.id !== e.pointerId) return;
    const dY = e.clientY - ds.startY;
    if (!ds.moved && Math.abs(dY) > 8) { ds.moved = true; setDragging(true); }
    if (ds.moved) { dyRef.current = dY; setDy(dY); }
  };

  const onPointerUp = (e) => {
    const ds = dragRef.current;
    if (ds.id !== e.pointerId) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    const wasMoved = ds.moved;
    const elapsed  = Date.now() - ds.startTime;
    dragRef.current = { id: null, startY: 0, startTime: 0, moved: false };
    setDragging(false);
    if (!wasMoved) { doFlip(); return; }
    const cur  = dyRef.current;
    const vel  = Math.abs(cur) / Math.max(elapsed, 1);
    const fast = vel > 0.3 && Math.abs(cur) > 30;
    if      (cur < -80 || (fast && cur < 0)) navigate('up');
    else if (cur >  80 || (fast && cur > 0)) navigate('down');
    else { dyRef.current = 0; setDy(0); }
  };

  const card       = deck[index];
  const currentKey = card ? reelKey(card) : null;
  const isLiked    = !!(currentKey && likes.has(currentKey));
  const isDisliked = !!(currentKey && dislikes.has(currentKey));
  const isSaved    = !!(currentKey && saves.has(currentKey));

  const toggleLike = (e) => {
    e.stopPropagation();
    if (!currentKey || !card) return;
    const wasLiked = likes.has(currentKey);
    setLikes(prev => {
      const s = new Set(prev);
      if (wasLiked) { s.delete(currentKey); } else { s.add(currentKey); }
      return s;
    });
    const base = window.API_BASE || '';
    fetch(`${base}/api/v1/likes/${card.id}?user_id=${CURRENT_USER_ID}`, { method: 'POST' })
      .then(r => r.json())
      .then(data => setLikes(prev => {
        const s = new Set(prev);
        if (data.liked) { s.add(currentKey); } else { s.delete(currentKey); }
        return s;
      }))
      .catch(() => setLikes(prev => {
        const s = new Set(prev);
        if (wasLiked) { s.add(currentKey); } else { s.delete(currentKey); }
        return s;
      }));
  };

  const toggleSave = (e) => {
    e.stopPropagation();
    if (!currentKey || !card) return;
    const wasSaved = saves.has(currentKey);
    setSaves(prev => {
      const s = new Set(prev);
      if (wasSaved) { s.delete(currentKey); } else { s.add(currentKey); }
      return s;
    });
    const base = window.API_BASE || '';
    fetch(`${base}/api/v1/saves/${card.id}?user_id=${CURRENT_USER_ID}`, { method: 'POST' })
      .then(r => r.json())
      .then(data => setSaves(prev => {
        const s = new Set(prev);
        if (data.saved) { s.add(currentKey); } else { s.delete(currentKey); }
        return s;
      }))
      .catch(() => setSaves(prev => {
        const s = new Set(prev);
        if (wasSaved) { s.add(currentKey); } else { s.delete(currentKey); }
        return s;
      }));
  };

  const toggleDislike = (e) => {
    e.stopPropagation();
    if (!currentKey || !card) return;
    setDislikes(prev => {
      const s = new Set(prev);
      if (s.has(currentKey)) {
        s.delete(currentKey);
      } else {
        s.add(currentKey);
        fireEvent(card.id, 'dislike');
        setLikes(l => { const nl = new Set(l); nl.delete(currentKey); return nl; });
      }
      return s;
    });
  };

  const rotY              = flipped ? 180 : 0;
  const exitTy            = exitDir === 'up' ? '-110vh' : exitDir === 'down' ? '110vh' : `${dy}px`;
  const currentTransform  = `translateY(${exitTy}) rotateY(${rotY}deg)`;
  const currentTransition = dragging ? 'none' : 'transform 340ms cubic-bezier(.25,.7,.3,1)';

  if (!card) return (
    <div className="reel-app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <button className="reel-back-btn" onClick={onBack} style={{ position: 'absolute', top: 20, left: 20 }} aria-label="Назад">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
      </button>
      {loading
        ? <div style={{ color: 'var(--muted)', fontSize: 15 }}>Загружаем карточки...</div>
        : <div style={{ color: 'var(--muted)', fontSize: 15 }}>Нет карточек</div>
      }
    </div>
  );

  return (
    <div className="reel-app">
      <div className={"reel-content" + (menuOpen ? " menu-open" : "")}>
        <div
          className="reel-scene"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {pendingIndex !== null && (
            <div
              key={'p' + pendingIndex}
              className={"reel-card " + (exitDir === 'up' ? 'enter-bottom' : 'enter-top')}
            >
              <QuoteCardFaces card={deck[pendingIndex]} />
            </div>
          )}

          <div
            key={'c' + index}
            className={"reel-card current" + (dragging ? ' dragging' : '')}
            style={{ transform: currentTransform, transition: currentTransition }}
          >
            <QuoteCardFaces card={card} />
          </div>

          <div className="reel-card-actions">
            <button
              className={"reel-btn" + (isSaved ? " saved" : "")}
              onClick={toggleSave}
              aria-label="Сохранить"
            >
              <svg width="22" height="22" viewBox="0 0 24 24"
                fill={isSaved ? "currentColor" : "none"}
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
            <button
              className={"reel-btn" + (isLiked ? " liked" : "")}
              onClick={toggleLike}
              aria-label="Нравится"
            >
              <svg width="22" height="22" viewBox="0 0 24 24"
                fill={isLiked ? "currentColor" : "none"}
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
                <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
              </svg>
            </button>
            <button
              className={"reel-btn" + (isDisliked ? " disliked" : "")}
              onClick={toggleDislike}
              aria-label="Не нравится"
            >
              <svg width="22" height="22" viewBox="0 0 24 24"
                fill={isDisliked ? "currentColor" : "none"}
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/>
                <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div className="reel-menu-backdrop" onClick={() => setMenuOpen(false)} />
      )}

      {!flipped && (
        <button
          className={"reel-burger" + (menuOpen ? " is-open" : "")}
          onPointerDown={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
          aria-label="Меню"
        >
          <span /><span /><span />
        </button>
      )}

      <div className={"reel-menu" + (menuOpen ? " is-open" : "")}>
        <div className="reel-menu-head">
          <span>Меню</span>
        </div>
        <nav className="reel-menu-nav">
          <button className="reel-menu-item" onClick={() => { setMenuOpen(false); onBack(); }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            На главную
          </button>
          <button className="reel-menu-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
            Сохранённые
            {saves.size > 0 && <span className="reel-menu-badge">{saves.size}</span>}
          </button>
        </nav>
      </div>
    </div>
  );
}

window.ReelCards = ReelCards;
