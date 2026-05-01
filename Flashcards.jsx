const { useState, useRef, useEffect } = React;

function Flashcards({ onBack }) {
  const cards = window.WORD_DECK;

  const [idx, setIdx]           = useState(0);
  const [known, setKnown]       = useState(0);
  const [learning, setLearning] = useState(0);
  const [hist, setHist]         = useState([]);

  const innerRef   = useRef(null);
  const washRef    = useRef(null);
  const wordRef    = useRef(null);
  const ruRef      = useRef(null);
  const flippedRef = useRef(false);
  const idxRef     = useRef(0);
  const drag       = useRef({ on: false, startX: 0, x: 0, pid: null });

  const isDone = idx >= cards.length;
  const card   = cards[idx];

  useEffect(() => { idxRef.current = idx; }, [idx]);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    flippedRef.current = false;
    el.classList.remove('flipped', 'dragging');
    el.style.cssText = '';
    if (washRef.current) washRef.current.style.opacity = '0';
    requestAnimationFrame(() => { autoFit(wordRef.current); autoFit(ruRef.current); });
  }, [idx]);

  function autoFit(el) {
    if (!el?.parentElement) return;
    const s0  = parseFloat(getComputedStyle(el).fontSize);
    const min = Math.max(22, s0 * 0.5);
    let s = s0;
    el.style.fontSize = s + 'px';
    while (s > min && el.scrollWidth > el.parentElement.clientWidth) {
      s -= 2;
      el.style.fontSize = s + 'px';
    }
  }

  function applyTransform(x, instant) {
    const el = innerRef.current;
    if (!el) return;
    el.classList.toggle('dragging', instant);
    const ry = flippedRef.current ? 180 : 0;
    el.style.transform = `translateX(${x}px) rotate(${x * 0.018}deg) rotateY(${ry}deg)`;
    if (washRef.current) {
      const i = Math.min(Math.abs(x) / 60, 1);
      washRef.current.style.opacity = String(i * 0.95);
      washRef.current.style.background = x > 0 ? 'var(--know-wash)' : 'var(--learn-wash)';
    }
  }

  function flip() {
    flippedRef.current = !flippedRef.current;
    innerRef.current?.classList.toggle('flipped', flippedRef.current);
    applyTransform(0, false);
  }

  function advance(action) {
    const i = idxRef.current;
    if (action === 'know') setKnown(k => k + 1); else setLearning(l => l + 1);
    setHist(h => [...h, { idx: i, action }]);
    setIdx(i + 1);
  }

  function flick(action) {
    const el = innerRef.current;
    if (!el) return;
    const dir = action === 'know' ? 1 : -1;
    applyTransform(dir * 60, true);
    requestAnimationFrame(() => {
      el.classList.remove('dragging');
      el.style.transition = 'transform 360ms cubic-bezier(.4,.2,.4,1)';
      const ry = flippedRef.current ? 180 : 0;
      el.style.transform = `translateX(${dir * 600}px) rotate(${dir * 12}deg) rotateY(${ry}deg)`;
      setTimeout(() => { el.style.transition = ''; advance(action); }, 320);
    });
  }

  function handleUndo() {
    setHist(h => {
      if (!h.length) return h;
      const last = h[h.length - 1];
      if (last.action === 'know') setKnown(k => k - 1); else setLearning(l => l - 1);
      setIdx(last.idx);
      return h.slice(0, -1);
    });
  }

  function onPointerDown(e) {
    if (e.target.closest('.action-btn')) return;
    drag.current = { on: false, startX: e.clientX, x: 0, pid: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e) {
    const d = drag.current;
    if (d.pid == null) return;
    const dx = e.clientX - d.startX;
    if (!d.on && Math.abs(dx) > 6) d.on = true;
    if (d.on) { d.x = dx; applyTransform(dx, true); }
  }
  function onPointerUp(e) {
    const d = drag.current;
    if (d.pid == null) return;
    const was = d.on;
    e.currentTarget.releasePointerCapture(d.pid);
    d.pid = null;
    if (!was) { flip(); return; }
    if (Math.abs(d.x) > 110) flick(d.x > 0 ? 'know' : 'dontknow');
    else { d.x = 0; applyTransform(0, false); }
    d.on = false;
  }
  function onPointerCancel() {
    drag.current = { on: false, startX: 0, x: 0, pid: null };
    applyTransform(0, false);
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === ' ')               { e.preventDefault(); flip(); }
      else if (e.key === 'ArrowLeft')  flick('dontknow');
      else if (e.key === 'ArrowRight') flick('know');
      else if (e.key === 'z' || e.key === 'Z') handleUndo();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const posCur = String(Math.min(idx + 1, cards.length)).padStart(2, '0');

  return (
    <>
      <div className="swipe-wash" ref={washRef} />
      <div className="app">
        <div className="header">
          <button className="icon-btn" onClick={onBack} aria-label="На главную">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7h10M7 2L2 7l5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className="pos"><b>{posCur}</b> / {cards.length}</div>
          <div style={{width: 28, height: 28}} />
        </div>

        <div className="card-area">
          <div className="card-outer"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          >
            <div className="card-inner" ref={innerRef}>
              <div className="face front">
                <div className="word" ref={wordRef}>{card?.en}</div>
                <div className="rule" />
                <div className="example">{card?.example}</div>
              </div>
              <div className="face back">
                <div className="ru" ref={ruRef}>{card?.ru}</div>
                <div className="rule-back" />
                <div className="ru-ex">«{card?.exampleRu}»</div>
              </div>
            </div>
          </div>

          <div className="actions">
            <button className="action-btn learn" onClick={e => { e.stopPropagation(); flick('dontknow'); }}>
              <span className="arrow">←</span>
              <span>учу</span>
              <span className="count">{learning}</span>
            </button>
            <button className="action-btn know" onClick={e => { e.stopPropagation(); flick('know'); }}>
              <span className="count">{known}</span>
              <span>знаю</span>
              <span className="arrow">→</span>
            </button>
          </div>

          {isDone && (
            <div className="done">
              <div className="label">complete</div>
              <h2>Готово.</h2>
              <div className="stats">
                <div className="know-num"><span>{known}</span>знаю</div>
                <div className="learn-num"><span>{learning}</span>учу</div>
              </div>
              <button className="reset" onClick={() => { setIdx(0); setKnown(0); setLearning(0); setHist([]); }}>заново</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

window.Flashcards = Flashcards;
