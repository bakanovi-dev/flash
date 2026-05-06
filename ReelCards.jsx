const { useState, useRef, useMemo, useEffect } = React;

function ReelCards({ onBack, deckId = 'b1b2' }) {
  const cards = useMemo(() => {
    const deckMap = {
      seg1:    window.SEGMENT1_DECK,
      phrasal: window.PHRASAL_DECK,
      idioms:  window.IDIOM_DECK,
    };
    if (deckMap[deckId]) return [...deckMap[deckId]];
    const shuffle = (arr) => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    return shuffle([...window.WORD_DECK]);
  }, [deckId]);

  const [index,        setIndex]        = useState(0);
  const [flipped,      setFlipped]      = useState(false);
  const [dy,           setDy]           = useState(0);
  const [dragging,     setDragging]     = useState(false);
  const [exitDir,      setExitDir]      = useState(null); // 'up' | 'down' | null
  const [pendingIndex, setPendingIndex] = useState(null);
  const [likes,        setLikes]        = useState(() => new Set());
  const [dislikes,     setDislikes]     = useState(() => new Set());

  const dragRef  = useRef({ id: null, startY: 0, startTime: 0, moved: false });
  const dyRef    = useRef(0);
  const indexRef = useRef(0);
  const transRef = useRef(false);

  indexRef.current = index;

  const total = cards.length;
  const card  = cards[index];

  const navigate = (dir) => { // 'up' = следующая, 'down' = предыдущая
    if (transRef.current) return;
    const nextIdx = indexRef.current + (dir === 'up' ? 1 : -1);
    if (nextIdx < 0 || nextIdx >= total) {
      dyRef.current = 0; setDy(0); return;
    }
    transRef.current = true;
    setExitDir(dir);
    setPendingIndex(nextIdx);
    dyRef.current = 0;
    setDy(0);
    setTimeout(() => {
      setIndex(nextIdx);
      setFlipped(false);
      setExitDir(null);
      setPendingIndex(null);
      transRef.current = false;
    }, 340);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === ' ')              { e.preventDefault(); setFlipped(f => !f); }
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
    if (!wasMoved) { setFlipped(f => !f); return; }
    const cur  = dyRef.current;
    const vel  = Math.abs(cur) / Math.max(elapsed, 1);
    const fast = vel > 0.3 && Math.abs(cur) > 30;
    if      (cur < -80 || (fast && cur < 0)) navigate('up');
    else if (cur >  80 || (fast && cur > 0)) navigate('down');
    else { dyRef.current = 0; setDy(0); }
  };

  const currentKey = card ? window.cardKey(card) : null;
  const isLiked    = !!(currentKey && likes.has(currentKey));
  const isDisliked = !!(currentKey && dislikes.has(currentKey));

  const toggleLike = (e) => {
    e.stopPropagation();
    if (!currentKey) return;
    setLikes(prev => {
      const s = new Set(prev);
      if (s.has(currentKey)) s.delete(currentKey);
      else { s.add(currentKey); setDislikes(d => { const nd = new Set(d); nd.delete(currentKey); return nd; }); }
      return s;
    });
  };

  const toggleDislike = (e) => {
    e.stopPropagation();
    if (!currentKey) return;
    setDislikes(prev => {
      const s = new Set(prev);
      if (s.has(currentKey)) s.delete(currentKey);
      else { s.add(currentKey); setLikes(l => { const nl = new Set(l); nl.delete(currentKey); return nl; }); }
      return s;
    });
  };

  const rotY            = flipped ? 180 : 0;
  // текущая карточка: летит ВВЕРХ при свайпе вверх, ВНИЗ при свайпе вниз
  const exitTy          = exitDir === 'up' ? '-110vh' : exitDir === 'down' ? '110vh' : `${dy}px`;
  const currentTransform  = `translateY(${exitTy}) rotateY(${rotY}deg)`;
  const currentTransition = dragging ? 'none' : 'transform 340ms cubic-bezier(.25,.7,.3,1)';

  const renderFaces = (c) => c.type
    ? <window.PhrasalCardFaces card={c} />
    : <window.CardFaces card={c} />;

  if (!card) return (
    <div className="reel-app">
      <button className="reel-back-btn" onClick={onBack} aria-label="Назад">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
      </button>
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
        {/* новая карточка едет снизу (при свайпе вверх) или сверху (при свайпе вниз) */}
        {pendingIndex !== null && (
          <div
            key={'p' + pendingIndex}
            className={"reel-card " + (exitDir === 'up' ? 'enter-bottom' : 'enter-top')}
          >
            {renderFaces(cards[pendingIndex])}
          </div>
        )}

        {/* текущая карточка — летит в направлении свайпа */}
        <div
          key={'c' + index}
          className={"reel-card current" + (dragging ? ' dragging' : '')}
          style={{ transform: currentTransform, transition: currentTransition }}
        >
          {renderFaces(card)}
        </div>

        {/* лайки — поверх карточки, внутри scene, вне 3D-слоя */}
        <div className="reel-card-actions">
          <button
            className={"reel-btn" + (isLiked ? " liked" : "")}
            onClick={toggleLike}
            aria-label="Нравится"
          >
            <svg width="26" height="26" viewBox="0 0 24 24"
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
            <svg width="26" height="26" viewBox="0 0 24 24"
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
