const { useState, useEffect, useRef, useMemo, useCallback } = React;

function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = 0.88;
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

function autoFit(el, max, min) {
  if (!el) return;
  const parent = el.parentElement;
  if (!parent) return;
  let s = max;
  el.style.fontSize = s + 'px';
  while (s > min && el.scrollWidth > parent.clientWidth) {
    s -= 2;
    el.style.fontSize = s + 'px';
  }
}

function CardFaces({ card }) {
  const wordRef  = useRef(null);
  const formsRef = useRef(null);

  useEffect(() => {
    const fit = () => {
      if (wordRef.current) {
        const max = parseFloat(getComputedStyle(wordRef.current).fontSize);
        autoFit(wordRef.current, max, Math.max(24, max * 0.5));
      }
      if (formsRef.current) {
        const max = parseFloat(getComputedStyle(formsRef.current).fontSize);
        autoFit(formsRef.current, max, Math.max(18, max * 0.5));
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (wordRef.current?.parentElement) ro.observe(wordRef.current.parentElement);
    return () => ro.disconnect();
  }, [card.forms]);

  const [v1, v2, v3] = card.forms;
  const formIndex = card.formUsed.startsWith('V1') ? 0 : card.formUsed.startsWith('V2') ? 1 : 2;
  const formValue = card.forms[formIndex];
  const allSame   = v1 === v2 && v2 === v3;
  const v2v3Same  = !allSame && v2 === v3;
  const v1v2Same  = !allSame && v1 === v2;
  const v1v3Same  = !allSame && v1 === v3;
  const allDiff   = v1 !== v2 && v2 !== v3 && v1 !== v3;

  return (
    <>
      <div className="face front">
        <SpeakBtn text={formValue} />
        <div className="word" ref={wordRef}>{formValue}</div>
        <div className="rule" />
        <div className="example">{card.example}</div>
      </div>
      <div className="face back">
        <div className="back-inner">
          <div className="forms" ref={formsRef}>
            <span className={formIndex === 0 ? 'active' : ''}>{v1}</span>
            <span className="dash">–</span>
            <span className={formIndex === 1 ? 'active' : ''}>{v2}</span>
            <span className="dash">–</span>
            <span className={formIndex === 2 ? 'active' : ''}>{v3}</span>
          </div>
          {(allSame || v2v3Same || v1v2Same || v1v3Same || allDiff) && (
            <div className="all-same">
              <span className="dot" />
              {allSame  && 'все три формы одинаковые'}
              {v2v3Same && 'V2 и V3 одинаковые'}
              {v1v2Same && 'V1 и V2 одинаковые'}
              {v1v3Same && 'V1 и V3 одинаковые'}
              {allDiff  && 'все три формы разные'}
            </div>
          )}
          <dl className="meta">
            <dd className="form-used">{card.formUsed}</dd>
            <dt>фраза</dt>
            <dd className="example-back">{card.example}</dd>
            <dt>значение</dt>
            <dd className="ru-meaning">{card.ru}</dd>
            <dt>фильм</dt>
            <dd>{card.film}</dd>
            {card.character && <dt>персонаж</dt>}
            {card.character && <dd>{card.character}</dd>}
          </dl>
        </div>
      </div>
    </>
  );
}

// ── localStorage helpers ──────────────────────────────────────────────────
function cardKey(card) {
  return card.type
    ? `${card.type}::${card.phrase}`
    : `word::${(card.forms || [''])[0]}::${(card.example || '').slice(0, 30)}`;
}
function loadKnownSet(deckId) {
  try { return new Set(JSON.parse(localStorage.getItem('fc_known::' + deckId) || '[]')); }
  catch { return new Set(); }
}
function saveKnown(deckId, set) {
  localStorage.setItem('fc_known::' + deckId, JSON.stringify([...set]));
}

const STACK_DEPTH = 3;

function PhrasalCardFaces({ card }) {
  const isVocab = card.type === 'vocab';
  const typeLabel = { phrasal: 'фразовый', idiom: 'идиома', vocab: card.level || 'слово' }[card.type] || '';
  return (
    <>
      <div className="face front">
        <div style={{ fontSize: 11, fontFamily: "'Geist Mono', monospace", letterSpacing: '0.14em',
          textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>{typeLabel}</div>
        <SpeakBtn text={card.phrase} />
        <div className="word" style={{ fontSize: 'clamp(24px, 5.5vw, 46px)' }}>{card.phrase}</div>
        <div className="rule" />
        <div className="example">{card.context}</div>
      </div>
      <div className="face back" style={{ justifyContent: 'flex-start' }}>
        <div className="back-inner">
          <div className="forms" style={{ flexWrap: 'wrap' }}>{card.translation}</div>
          <dl className="meta">
            <dt>пример</dt>
            <dd className="example-back">{card.context}</dd>
            {card.contextTranslation && (
              <React.Fragment>
                <dt>по-русски</dt>
                <dd className="ru-meaning">{card.contextTranslation}</dd>
              </React.Fragment>
            )}
            {!isVocab && card.literalTranslation && (
              <React.Fragment>
                <dt>буквально</dt>
                <dd>{card.literalTranslation}</dd>
              </React.Fragment>
            )}
            {!isVocab && card.history && (
              <React.Fragment>
                <dt>история</dt>
                <dd style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{card.history}</dd>
              </React.Fragment>
            )}
          </dl>
        </div>
      </div>
    </>
  );
}

function Flashcards({ onBack, deckId = 'b1b2' }) {
  const [sessionKey, setSessionKey] = useState(0);
  const knownSetRef = useRef(null);

  const cards = useMemo(() => {
    const knownSet = loadKnownSet(deckId);
    knownSetRef.current = knownSet;

    const shuffle = (arr) => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    const deckMap = {
      seg1:    window.SEGMENT1_DECK,
      phrasal: window.PHRASAL_DECK,
      idioms:  window.IDIOM_DECK,
    };

    if (deckMap[deckId]) {
      const deck = deckMap[deckId].filter(c => !knownSet.has(cardKey(c)));
      return deckId === 'seg1' ? [...deck] : shuffle(deck);
    }

    // Word decks: group by verb (V1 form), interleave
    const source = window.WORD_DECK.filter(c => !knownSet.has(cardKey(c)));
    const groups = {};
    for (const card of source) {
      const key = card.forms[0];
      if (!groups[key]) groups[key] = [];
      groups[key].push(card);
    }
    const queues = shuffle(Object.values(groups).map(g => shuffle(g)));

    const result = [];
    while (queues.some(q => q.length > 0)) {
      for (const queue of queues) {
        if (queue.length > 0) result.push(queue.shift());
      }
    }
    return result;
  }, [deckId, sessionKey]);

  const [index,    setIndex]    = useState(0);
  const [flipped,  setFlipped]  = useState(false);
  const [drag,     setDrag]     = useState(0);
  const [dragging, setDragging] = useState(false);
  const [flicking, setFlicking] = useState(null); // null | { dir: 1 | -1 }
  const [known,    setKnown]    = useState(0);
  const [learning, setLearning] = useState(0);

  const histRef     = useRef([]);
  const dragState   = useRef({ id: null, startX: 0, moved: false });

  const total  = cards.length;
  const isDone = index >= total;

  const flipTop = useCallback(() => {
    if (dragging || Math.abs(drag) > 4) return;
    setFlipped(f => !f);
  }, [dragging, drag]);

  const advance = useCallback((action) => {
    histRef.current.push({ index, action });
    if (action === 'know') {
      setKnown(k => k + 1);
      const key = cardKey(cards[index]);
      knownSetRef.current.add(key);
      saveKnown(deckId, knownSetRef.current);
    } else {
      setLearning(l => l + 1);
    }
    setIndex(i => i + 1);
    setFlipped(false);
    setDrag(0);
    setFlicking(null);
  }, [index, cards, deckId]);

  const doFlick = useCallback((action) => {
    if (flicking || isDone) return;
    const dir = action === 'know' ? 1 : -1;
    setFlicking({ dir });
    setTimeout(() => advance(action), 320);
  }, [flicking, isDone, advance]);

  const handleUndo = useCallback(() => {
    if (!histRef.current.length) return;
    const last = histRef.current.pop();
    if (last.action === 'know') {
      setKnown(k => Math.max(0, k - 1));
      const key = cardKey(cards[last.index]);
      knownSetRef.current.delete(key);
      saveKnown(deckId, knownSetRef.current);
    } else {
      setLearning(l => Math.max(0, l - 1));
    }
    setIndex(last.index);
    setFlipped(false);
    setDrag(0);
    setFlicking(null);
  }, [cards, deckId]);

  const reset = useCallback(() => {
    histRef.current = [];
    setIndex(0); setKnown(0); setLearning(0);
    setFlipped(false); setDrag(0); setFlicking(null);
    setSessionKey(k => k + 1);
  }, []);

  const clearKnown = useCallback(() => {
    localStorage.removeItem('fc_known::' + deckId);
    histRef.current = [];
    setIndex(0); setKnown(0); setLearning(0);
    setFlipped(false); setDrag(0); setFlicking(null);
    setSessionKey(k => k + 1);
  }, [deckId]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === ' ')               { e.preventDefault(); flipTop(); }
      else if (e.key === 'ArrowLeft')  doFlick('dontknow');
      else if (e.key === 'ArrowRight') doFlick('know');
      else if (e.key === 'z' || e.key === 'Z') handleUndo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flipTop, doFlick, handleUndo]);

  const onPointerDown = (e) => {
    if (e.target.closest('.action-btn') || e.target.closest('.speak-btn')) return;
    if (flicking) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = { id: e.pointerId, startX: e.clientX, moved: false };
    setDragging(false);
    setDrag(0);
  };
  const onPointerMove = (e) => {
    const ds = dragState.current;
    if (ds.id !== e.pointerId) return;
    const dx = e.clientX - ds.startX;
    if (!ds.moved && Math.abs(dx) > 6) { ds.moved = true; setDragging(true); }
    if (ds.moved) setDrag(dx);
  };
  const onPointerUp = (e) => {
    const ds = dragState.current;
    if (ds.id !== e.pointerId) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    const wasMoved = ds.moved;
    dragState.current = { id: null, startX: 0, moved: false };
    if (!wasMoved) { flipTop(); setDragging(false); return; }
    setDragging(false);
    if (Math.abs(drag) > 110) doFlick(drag > 0 ? 'know' : 'dontknow');
    else setDrag(0);
  };

  // wash
  const washX       = flicking ? flicking.dir * 200 : drag;
  const washOpacity = Math.min(Math.abs(washX) / 60, 1) * 0.95;
  const washColor   = washX > 0 ? 'var(--know-wash)' : 'var(--learn-wash)';

  // swipe counters
  const learnI = Math.min(Math.max(-washX, 0) / 110, 1);
  const knowI  = Math.min(Math.max( washX, 0) / 110, 1);

  // stack
  const stackIndices = [];
  for (let k = STACK_DEPTH - 1; k >= 0; k--) {
    if (index + k < total) stackIndices.push(index + k);
  }

  const posCur = String(Math.min(index + 1, total)).padStart(2, '0');

  return (
    <>
      <div className="swipe-wash" style={{ opacity: washOpacity, background: washColor }} />
      <div className="app">
        <div className="header">
          <button
            className="icon-btn"
            aria-label="Отменить"
            disabled={histRef.current.length === 0 || isDone}
            onClick={handleUndo}
          >
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
              <path d="M5.5 6.5L2.5 9l3 2.5M2.5 9h7.5a4 4 0 010 8h-2"
                stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className="pos"><b>{posCur}</b> / {total}</div>
          <div style={{ width: 28, height: 28 }} />
        </div>

        <div className="card-area">
          <div className="stack">
            {!isDone && stackIndices.map((cardIdx) => {
              const k     = cardIdx - index;
              const isTop = k === 0;

              let tx = 0, ty = k * 12, rot = 0, rotY = 0;
              const sc      = 1 - k * 0.04;
              const opacity = k === 0 ? 1 : Math.max(0, 1 - k * 0.3);

              if (isTop) {
                if (flicking) { tx = flicking.dir * 600; rot = flicking.dir * 12; }
                else          { tx = drag; rot = drag * 0.018; }
                rotY = flipped ? 180 : 0;
              }

              const transform =
                `translateX(${tx}px) translateY(${ty}px) ` +
                `rotate(${rot}deg) scale(${sc}) rotateY(${rotY}deg)`;

              const cls = [
                'card',
                isTop ? 'top' : 'behind',
                isTop && dragging ? 'dragging' : '',
                isTop && flicking ? 'flicking' : '',
                isTop && flipped  ? 'flipped'  : '',
              ].filter(Boolean).join(' ');

              return (
                <div
                  key={cardIdx}
                  className={cls}
                  style={{ transform, opacity, zIndex: 100 - k,
                    boxShadow: `0 ${4 + k * 4}px ${12 + k * 8}px rgba(0,0,0,${0.06 + k * 0.02})` }}
                  onPointerDown={isTop ? onPointerDown : undefined}
                  onPointerMove={isTop ? onPointerMove : undefined}
                  onPointerUp={isTop ? onPointerUp : undefined}
                  onPointerCancel={isTop ? onPointerUp : undefined}
                >
                  {cards[cardIdx].type
                    ? <PhrasalCardFaces card={cards[cardIdx]} />
                    : <CardFaces card={cards[cardIdx]} />
                  }
                </div>
              );
            })}

            {isDone && (
              <div className="done">
                <div className="label">complete</div>
                <h2>Готово.</h2>
                <div className="stats">
                  <div className="know-num"><span>{known}</span>знаю</div>
                  <div className="learn-num"><span>{learning}</span>учу</div>
                </div>
                {(() => {
                  const totalSaved = loadKnownSet(deckId).size;
                  return totalSaved > 0 && (
                    <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                      {totalSaved} карточек сохранено — не покажу снова
                    </div>
                  );
                })()}
                <button className="reset" onClick={reset} style={{ marginTop: 16 }}>заново</button>
                {loadKnownSet(deckId).size > 0 && (
                  <button className="reset" onClick={clearKnown}
                    style={{ marginTop: 8, opacity: 0.55, fontSize: 13 }}>
                    сбросить прогресс · показать все
                  </button>
                )}
              </div>
            )}
          </div>

          {!isDone && (
            <div className="swipe-counters" aria-hidden="true">
              <div className="swipe-count learn" style={{
                opacity: learnI,
                transform: `scale(${0.85 + learnI * 0.25})`,
              }}>
                <span className="lbl">учу</span>
                <span>{learning + (learnI > 0.6 ? 1 : 0)}</span>
              </div>
              <div className="swipe-count know" style={{
                opacity: knowI,
                transform: `scale(${0.85 + knowI * 0.25})`,
              }}>
                <span>{known + (knowI > 0.6 ? 1 : 0)}</span>
                <span className="lbl">знаю</span>
              </div>
            </div>
          )}

          <div className="actions">
            <button className="action-btn learn" disabled={isDone}
              onClick={e => { e.stopPropagation(); doFlick('dontknow'); }}>
              <span className="arrow">←</span>
              <span>учу</span>
            </button>
            <button className="action-btn know" disabled={isDone}
              onClick={e => { e.stopPropagation(); doFlick('know'); }}>
              <span>знаю</span>
              <span className="arrow">→</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

window.Flashcards = Flashcards;
