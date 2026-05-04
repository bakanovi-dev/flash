const { useState, useEffect, useRef, useMemo, useCallback } = React;

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
  }, [card.en, card.forms]);

  const [v1, v2, v3] = card.forms;
  const formIndex = card.formUsed.startsWith('V1') ? 0 : card.formUsed.startsWith('V2') ? 1 : 2;
  const formValue = card.forms[formIndex];

  return (
    <>
      <div className="face front">
        <div className="word" ref={wordRef}>{card.en}</div>
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
          {card.allSame && (
            <div className="all-same">
              <span className="dot" />
              все три формы одинаковые
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

const STACK_DEPTH = 3;

function Flashcards() {
  const cards = useMemo(() => window.WORD_DECK, []);

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
    if (action === 'know') setKnown(k => k + 1); else setLearning(l => l + 1);
    setIndex(i => i + 1);
    setFlipped(false);
    setDrag(0);
    setFlicking(null);
  }, [index]);

  const doFlick = useCallback((action) => {
    if (flicking || isDone) return;
    const dir = action === 'know' ? 1 : -1;
    setFlicking({ dir });
    setTimeout(() => advance(action), 320);
  }, [flicking, isDone, advance]);

  const handleUndo = useCallback(() => {
    if (!histRef.current.length) return;
    const last = histRef.current.pop();
    if (last.action === 'know') setKnown(k => Math.max(0, k - 1));
    else setLearning(l => Math.max(0, l - 1));
    setIndex(last.index);
    setFlipped(false);
    setDrag(0);
    setFlicking(null);
  }, []);

  const reset = useCallback(() => {
    histRef.current = [];
    setIndex(0); setKnown(0); setLearning(0);
    setFlipped(false); setDrag(0); setFlicking(null);
  }, []);

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
    if (e.target.closest('.action-btn')) return;
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
                  <CardFaces card={cards[cardIdx]} />
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
                <button className="reset" onClick={reset}>заново</button>
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
