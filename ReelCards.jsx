const { useState, useRef, useEffect } = React;

const BATCH_SIZE = 15;
const PRELOAD_AT = 5;
const REPEAT_WINDOW = 100;
const CURRENT_USER_ID = '1';

function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US'; u.rate = 0.88;
  window.speechSynthesis.speak(u);
}

function SpeakBtn({ text }) {
  return (
    <button
      className="speak-btn"
      aria-label="Произнести"
      onPointerDown={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); speak(text); }}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '0 0 8px 0', display: 'block',
        color: 'var(--muted)', lineHeight: 1, opacity: 0.5,
        alignSelf: 'flex-start',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
      </svg>
    </button>
  );
}

function QuoteCardFaces({ card }) {
  const epLabel = card.show
    ? `${card.show} · S${String(card.season).padStart(2,'0')}E${String(card.episode).padStart(2,'0')}`
    : null;

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

  const dragRef      = useRef({ id: null, startY: 0, startTime: 0, moved: false });
  const dyRef        = useRef(0);
  const indexRef     = useRef(0);
  const transRef     = useRef(false);
  const deckRef      = useRef([]);
  const cursorRef    = useRef(null);
  const freshCursorRef = useRef(null);
  const hasMoreRef   = useRef(true);
  const fetchingRef  = useRef(false);
  const flippedRef   = useRef(false);
  const wasFlippedRef = useRef(false);

  indexRef.current = index;
  deckRef.current  = deck;

  const fetchBatch = () => {
    if (fetchingRef.current) return;
    if (!hasMoreRef.current && deckRef.current.length > 0) return;
    fetchingRef.current = true;
    setLoading(true);

    const params = new URLSearchParams({
      limit: String(BATCH_SIZE),
      lang: 'ru',
      domain: 'entertainment.humor',
      user_id: CURRENT_USER_ID,
    });
    if (cursorRef.current !== null) params.set('cursor', cursorRef.current);
    if (freshCursorRef.current !== null) params.set('fresh_cursor', freshCursorRef.current);

    const base = window.API_BASE || '';
    fetch(`${base}/api/v1/feed?${params}`)
      .then(r => r.json())
      .then(data => {
        fetchingRef.current = false;
        setLoading(false);
        hasMoreRef.current = !!data.has_more;
        cursorRef.current = data.next_cursor ?? cursorRef.current;
        freshCursorRef.current = data.next_fresh_cursor ?? freshCursorRef.current;

        if (data.items && data.items.length > 0) {
          const cards = data.items.map(c => ({ ...c, quote_ru: c.quote_translated }));
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

  useEffect(() => { fetchBatch(); }, []);

  useEffect(() => {
    if (deckRef.current.length - index <= PRELOAD_AT) {
      fetchBatch();
    }
  }, [index, deck.length]);

  const doFlip = () => {
    const next = !flippedRef.current;
    flippedRef.current = next;
    setFlipped(next);
    if (next && !wasFlippedRef.current) {
      wasFlippedRef.current = true;
      const curCard = deckRef.current[indexRef.current];
      if (curCard) fireEvent(curCard.id, 'flip');
    }
  };

  const navigate = (dir) => {
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

  const toggleLike = (e) => {
    e.stopPropagation();
    if (!currentKey || !card) return;
    setLikes(prev => {
      const s = new Set(prev);
      if (s.has(currentKey)) {
        s.delete(currentKey);
      } else {
        s.add(currentKey);
        fireEvent(card.id, 'like');
        setDislikes(d => { const nd = new Set(d); nd.delete(currentKey); return nd; });
      }
      return s;
    });
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
            {likes.size > 0 && <span className="reel-btn-count">{likes.size}</span>}
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
            {dislikes.size > 0 && <span className="reel-btn-count">{dislikes.size}</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

window.ReelCards = ReelCards;
