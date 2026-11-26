// 受付マスコット 取扱説明書 — the notebook you read by scrolling.
// PC: a fixed 1440×900 stage scaled to the window. Scrolling never moves the stage:
// the scroll position picks the current page, steps through what happens on it, then turns it like a notebook page.
// Phone: no page turning — the six 390×844 pages sit one under another on one long sheet and scroll normally.

const $ = s => document.querySelector(s);
const W = 1440, H = 900;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- two notebooks: PC (1440×900, bound on the left, pages turn sideways)
   and phone (390×844 pages stacked, a normal scroll). Portrait windows get the phone one. ---------- */
const MODES = {
  pc: { stage: $('#stage'), w: W, h: H, shade: $('#shade'),
        ids: ['cover', 'nafuda', 'sheet', 'flow', 'play', 'end'],
        turn: d => `perspective(7000px) rotateY(${(-d).toFixed(2)}deg)` },
  sp: { stage: $('#spStage'), w: 390, h: 844, scroll: true,
        ids: ['spCover', 'spNafuda', 'spSheet', 'spFlow', 'spPlay', 'spEnd'] },
};
for (const m of Object.values(MODES)) {
  m.pages = m.ids.map(id => document.getElementById(id));
  m.pageState = m.pages.map(() => ({ show: null, deg: null, z: null }));
  m.lastShade = -1;
}
let mode = null;
function pickMode() {
  const next = innerWidth < innerHeight ? MODES.sp : MODES.pc;
  if (next === mode) return;
  mode = next;
  document.body.classList.toggle('sp', mode === MODES.sp);
}

/* ---------- fit the stage to the window ---------- */
let scale = 1;
function fit() {
  const { stage, w, h } = mode;
  if (mode.scroll) {
    // phone: the stacked pages are drawn at the design size and scaled to the screen's width; the page
    // is as tall as the scaled stack, so the browser scrolls it normally
    scale = innerWidth / w;
    stage.style.width = w + 'px';
    stage.style.transform = `scale(${scale})`;
    const stackH = stackSP();
    stage.style.height = stackH + 'px';
    $('#viewport').style.height = stackH * scale + 'px';
    return;
  }
  // PC: the design box always fits; the stage itself takes the window's shape so the paper fills it (minus a thin border)
  $('#viewport').style.height = '';
  scale = Math.min(innerWidth / w, innerHeight / h);
  const sw = innerWidth / scale, sh = innerHeight / scale;
  stage.style.width = sw + 'px'; stage.style.height = sh + 'px';
  stage.style.setProperty('--ox', (sw - w) / 2 + 'px');
  stage.style.setProperty('--oy', (sh - h) / 2 + 'px');
  stage.style.setProperty('--oxn', (sw - w) / 2);   // same as --ox, as a plain number (for scale())
  stage.style.transform = `translate(${-innerWidth / 2}px, ${-innerHeight / 2}px) scale(${scale})`;
}
// phone: each page is trimmed to what's drawn on it, and every page sits the same distance from the next
// (SP_GAP design px), with a dashed divider and the page number in the middle of the gap
const SP_GAP = 140, SP_END = 60;            // gap between pages; space under the last page
const SP_PIN = 1100, SP_PIN_TOP = 160, SP_PIN_H = 575;   // ④: extra scroll its step block stays put for; the block's place and height
function stackSP() {
  const pages = MODES.sp.pages;
  $('#spFlow .slider').style.transform = '';   // measure the flow block where it starts
  MODES.sp.stage.classList.add('measuring');   // stickers that haven't stuck on yet count at their full size
  let total = 0;
  pages.forEach((p, i) => {
    const root = p.querySelector('.spRoot'), rr = root.getBoundingClientRect(), k = rr.height / MODES.sp.h;
    // how far the page's content really reaches (some boxes are drawn smaller/bigger than their layout box)
    let top = Infinity, bot = -Infinity;
    for (const e of root.querySelectorAll('*')) {
      const r = e.getBoundingClientRect();
      if (!r.height) continue;
      top = Math.min(top, (r.top - rr.top) / k); bot = Math.max(bot, (r.bottom - rr.top) / k);
    }
    // the cover keeps its designed top (under the rings); the others start half a gap below the divider
    const shift = i === 0 ? 0 : top - SP_GAP / 2;
    // the flow page is longer by the stretch its step block stays put for
    const h = bot - shift + (i === pages.length - 1 ? SP_END : SP_GAP / 2) + (p.id === 'spFlow' ? SP_PIN : 0);
    root.style.top = -shift + 'px';
    p.style.height = h + 'px';
    total += h;
    if (i > 0 && !p.querySelector('.spDivider')) {
      const d = document.createElement('div');
      d.className = 'spDivider'; d.setAttribute('aria-hidden', 'true');
      d.innerHTML = `<i></i><span>${String(i + 1).padStart(2, '0')}</span><i></i>`;
      p.prepend(d);
    }
  });
  MODES.sp.stage.classList.remove('measuring');
  return total;
}
addEventListener('resize', () => { pickMode(); fit(); layoutTrack(); render(); });
document.fonts.ready.then(() => { if (mode.scroll) { fit(); render(); } });   // text heights settle once the web fonts arrive
pickMode();
fit();

/* ---------- ③ キャラクターシート: the four dino stickers stick onto the page one by one, in this order, each time it opens.
   Returns a switch (true: stick them on, false: peel them off again, out of sight). ---------- */
function stickers(page, sels) {
  if (reduced) return () => {};
  sels.map(s => page.querySelector(s)).filter(Boolean).forEach((el, k) => {
    el.classList.add('stick');
    el.style.setProperty('--d', (k * 0.28).toFixed(2) + 's');
  });
  page.classList.add('stickers');
  let now = null;
  return on => { if (on !== now) { now = on; page.classList.toggle('stuck', on); } };
}
const stickPC = stickers($('#sheet'), ['.sh9', '.sh12', '.sh22', '.sh29']);
const stickSP = stickers($('#spSheet'), ['.m3-main', '.m3-t1 .stk', '.m3-t2 .stk', '.m3-t3 .stk']);
// phone: they stick on as soon as the sheet starts coming onto the screen, and peel off once it has left it
new IntersectionObserver(([e]) => {
  if (e.intersectionRatio >= 0.12) stickSP(true);
  else if (!e.isIntersecting) stickSP(false);
}, { threshold: [0, 0.12] }).observe($('#spSheet'));

/* ---------- ⑥ さいご: the whole date memo pops up onto the page.
   Returns a switch like stickers() (false: back to the start, out of sight). ---------- */
function endScene(page) {
  if (reduced) return () => {};
  page.classList.add('memoAnim');
  let now = null;
  return on => { if (on !== now) { now = on; page.classList.toggle('on', on); } };
}
const endPC = endScene($('#end'));
const endSP = endScene($('#spEnd'));
// phone: it starts once the memo part of the page is on screen
new IntersectionObserver(([e]) => {
  if (e.intersectionRatio >= 0.45) endSP(true);
  else if (!e.isIntersecting) endSP(false);
}, { threshold: [0, 0.45] }).observe($('#spEnd'));

/* ---------- scenes: how much scrolling each page gets (in screen heights) ---------- */
const scenes = [
  { id: 'cover', len: 0.9 },
  { id: 'nafuda', len: 3.6, update: t => mode.story?.(t) },
  { id: 'sheet', len: 1.0 },
  { id: 'flow', len: 3.2, update: t => mode.flow?.(t) },
  { id: 'play', len: 1.4 },
  { id: 'end', len: 1.0 },
];
const FLIP = 3.0;                         // how much scrolling one page turn takes
const total = scenes.reduce((a, s) => a + s.len, 0) + FLIP * (scenes.length - 1);
// (the phone scrolls its own stacked pages, so the track is hidden there — see sp.css)
function layoutTrack() { $('#track').style.height = (total + 1) * innerHeight + 'px'; }
layoutTrack();

const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
let current = -1;

// the page follows the scroll position smoothly instead of jumping with every wheel tick,
// so page turns and reveals play out slowly even when someone scrolls fast
let shown = 0;
const FOLLOW = reduced ? 1 : 0.08;       // how quickly the page catches up with the scroll (higher = snappier)
(function follow() {
  const target = scrollY;
  if (Math.abs(target - shown) > 0.5) { shown += (target - shown) * FOLLOW; render(); }
  else if (shown !== target) { shown = target; render(); }
  requestAnimationFrame(follow);
})();
function onScroll() { if (mode.scroll) renderSP(); else if (reduced) { shown = scrollY; render(); } }

function render() {
  if (mode.scroll) return renderSP();
  let u = shown / innerHeight;
  let i = 0, local = 0, flip = -1;
  for (i = 0; i < scenes.length; i++) {
    if (u <= scenes[i].len || i === scenes.length - 1) { local = Math.min(1, Math.max(0, u / scenes[i].len)); break; }
    u -= scenes[i].len;
    if (u < FLIP) { local = 1; flip = u / FLIP; break; }
    u -= FLIP;
  }
  // only the current page and the next one are drawn (the next one stays ready underneath, so a turn never
  // has to paint it mid-flip). The turning page carries its own gentle perspective. Only changed values are written.
  mode.pages.forEach((p, k) => {
    const show = k === i || k === i + 1;
    const deg = k === i && flip >= 0 ? 180 * ease(flip) : 0;
    const z = k === i ? 20 : 19;
    const st = mode.pageState[k];
    if (st.show !== show) { st.show = show; p.classList.toggle('show', show); }
    if (st.deg !== deg) { st.deg = deg; p.style.transform = deg ? mode.turn(deg) : ''; }
    if (st.z !== z) { st.z = z; p.style.zIndex = z; }
  });
  // the page underneath is a little darker while the page above is still covering it
  const shadeOn = flip >= 0 ? +(0.22 * (1 - ease(flip))).toFixed(3) : 0;
  if (shadeOn !== mode.lastShade) { mode.lastShade = shadeOn; mode.shade.style.opacity = shadeOn; }
  if (scenes[i].update) scenes[i].update(local);
  if (flip >= 0 && scenes[i + 1].update) scenes[i + 1].update(0);
  if (current !== i) { current = i; document.body.dataset.page = scenes[i].id; }
  // the sheet's stickers start once the turning 名札 page has gone past upright: from then on the whole sheet is in view
  stickPC(scenes[i].id === 'sheet' || (scenes[i + 1]?.id === 'sheet' && flip >= 0.5));
  endPC(scenes[i].id === 'end' || (scenes[i + 1]?.id === 'end' && flip >= 0.5));   // same moment for the last page
}
addEventListener('scroll', onScroll, { passive: true });

/* ---------- ② 名札: the paragraph being read is dark ---------- */
function storyFor(storyEl, bar) {
  const paras = [...storyEl.querySelectorAll('p')];
  let storyN = -1;
  return t => {
    const n = Math.min(paras.length - 1, Math.floor(t * paras.length * 0.999));
    if (n === storyN) return;            // nothing changed: skip the layout work
    storyN = n;
    paras.forEach((p, k) => p.classList.toggle('now', k === n));
    storyEl.classList.toggle('end', n === paras.length - 1);
    const p = paras[n], top = storyEl.offsetTop + p.offsetTop;
    bar.style.top = top + 'px';
    bar.style.height = p.offsetHeight + 'px';
  };
}
MODES.pc.story = storyFor($('#nafuda .story'), $('#storyBar'));
MODES.sp.story = storyFor($('#spNafuda .m2-story'), $('#spStoryBar'));

/* ---------- ④ 受付の流れ: scrolling down slides the step cards sideways and fills the path below
   (phone: he walks that path too; PC has no walker or cue) ---------- */
const POSES = ['point_right', 'think', 'thumbs_up', 'wave'], TILTS = [-1.5, 1, -1, 1.5];
function sliderFor(root, step) {             // step: card width + gap (design px)
  const track = root.querySelector('.slTrack'), cards = [...track.children], no = root.querySelector('.slNo');
  const walked = root.querySelector('.slWalked'), stops = [...root.querySelectorAll('.slPath span')];
  const path = root.querySelector('.slPath'), dino = root.querySelector('.slDino'), cue = root.querySelector('.slCue');
  let last = -1, pose = 0;
  return t => {
    const p = Math.min(1, Math.max(0, (t - 0.06) / 0.88));   // a little hold on the first and last card
    if (p === last) return;
    last = p;
    const f = p * (cards.length - 1), i = Math.round(f);
    track.style.transform = `translateX(${(-f * step).toFixed(1)}px)`;
    cards.forEach((c, k) => {
      const d = Math.min(1, Math.abs(f - k));
      c.style.opacity = (1 - d * 0.55).toFixed(3);
      c.style.transform = d ? `scale(${(1 - d * 0.07).toFixed(3)}) rotate(${(TILTS[k] * d).toFixed(2)}deg)` : '';
    });
    no.textContent = i + 1;
    no.classList.toggle('last', i === cards.length - 1);
    walked.style.width = p * 100 + '%';
    stops.forEach((s, k) => s.classList.toggle('on', k <= f + 0.01));
    if (dino) {
      dino.style.left = path.offsetLeft + p * path.offsetWidth - dino.offsetWidth / 2 + 'px';
      if (pose !== i) { pose = i; dino.src = `assets/dino/${POSES[i]}.webp`; }
    }
    cue?.classList.toggle('gone', p > 0.02);
  };
}
MODES.pc.flow = sliderFor($('#flow .slider'), 630);
MODES.sp.flow = sliderFor($('#spFlow .slider'), 320);
POSES.forEach(n => { new Image().src = `assets/dino/${n}.webp`; });

/* ---------- phone: reveals follow where things are on screen as you scroll ---------- */
const spStory = $('#spNafuda .m2-story'), spPin = $('#spFlow .slider');
function renderSP() {
  const vh = innerHeight;
  // ② the paragraph crossing the upper-middle of the screen is the one being read
  const r = spStory.getBoundingClientRect();
  MODES.sp.story(Math.min(1, Math.max(0, (vh * 0.6 - r.top) / r.height)));
  // ④ the step block stops in the middle of the screen while the cards slide; then it scrolls on
  const base = spPin.parentElement.getBoundingClientRect().top + SP_PIN_TOP * scale;
  const hold = Math.max(0, (vh - SP_PIN_H * scale) / 2);
  const off = Math.min(SP_PIN, Math.max(0, (hold - base) / scale));
  spPin.style.transform = off ? `translateY(${off.toFixed(1)}px)` : '';
  MODES.sp.flow(off / SP_PIN);
}

/* ---------- ⑤ あそぶ: 足りないピースは どれ？ ---------- */
const PICS = ['assets/img/p1.jpg', 'assets/img/p2.jpg', 'assets/img/p3.jpg'];
const ROUNDS = [   // the missing cell, and three choices [picture, cell]; ok = index of the right one
  { name: '森', hole: [2, 0], opts: [[0, [1, 0]], [0, [2, 0]], [2, [2, 0]]], ok: 1 },
  { name: '湖', hole: [1, 1], opts: [[1, [1, 1]], [1, [2, 1]], [0, [1, 1]]], ok: 0 },
  { name: '夕やけ', hole: [2, 1], opts: [[2, [1, 1]], [1, [2, 1]], [2, [2, 1]]], ok: 2 },
];
// one game, drawn on both boards (PC and phone), so progress carries over if the screen turns
const game = { pic: 0, solved: [false, false, false] };
// cell: one puzzle square on the picture; piece: one answer piece; confetti: gap between confetti strips (all design px)
const views = [
  { pre: '', cell: 150, piece: 150, confetti: [40, 95] },
  { pre: 'sp', cell: 81.5, piece: 92, confetti: [22, 52] },
].map(v => {
  const get = id => document.getElementById(v.pre ? v.pre + id[0].toUpperCase() + id.slice(1) : id);
  return { ...v, thumbs: get('thumbs'), opts: get('opts'), pic: get('pic'), hole: get('hole'), next: get('next'),
    stamps: get('stamps'), done: get('doneText'), say: get('say'), watcher: get('watcher'), confetti: get('confetti'), cuts: get('cuts') };
});

// jigsaw cut lines with a knob in the middle of every edge (drawn in a 600×450 viewBox on both boards)
let cuts = '';
for (let x = 150; x < 600; x += 150) for (let y = 0; y < 450; y += 150) { const f = (x / 150 + y / 150) % 2; cuts += `M${x} ${y}L${x} ${y + 55}A20 20 0 1 ${f} ${x} ${y + 95}L${x} ${y + 150}`; }
for (let y = 150; y < 450; y += 150) for (let x = 0; x < 600; x += 150) { const f = (x / 150 + y / 150) % 2; cuts += `M${x} ${y}L${x + 55} ${y}A20 20 0 1 ${f} ${x + 95} ${y}L${x + 150} ${y}`; }
views.forEach(v => v.cuts.setAttribute('d', cuts));

function say(text, pose) {
  for (const v of views) {
    v.say.textContent = text;
    v.say.classList.remove('pop'); void v.say.offsetWidth; v.say.classList.add('pop');
    v.watcher.src = `assets/dino/${pose}.webp`;
  }
}

function renderGame() {
  const r = ROUNDS[game.pic], solved = game.solved[game.pic];
  const done = game.solved.filter(Boolean).length;
  for (const v of views) {
    v.pic.style.backgroundImage = `url(${PICS[game.pic]})`;
    v.hole.style.left = r.hole[0] * v.cell + 'px'; v.hole.style.top = r.hole[1] * v.cell + 'px';
    v.hole.classList.toggle('filled', solved);
    v.confetti.innerHTML = solved ? ['#F2895A', '#F5BC3C', '#55B95B', '#FF9AA6', '#8FD3FF', '#F5BC3C'].map((c, k) => `<i style="left:${v.confetti[0] + k * v.confetti[1]}px;background:${c};animation-delay:${(k * .37) % 1.2}s"></i>`).join('') : '';
    v.thumbs.innerHTML = ROUNDS.map((x, k) => `<label><button type="button" class="thumb" data-pic="${k}" aria-pressed="${k === game.pic}" aria-label="${x.name}の しゃしん" style="background-image:url(${PICS[k]})"></button>${x.name}${game.solved[k] ? ' ✓' : ''}</label>`).join('');
    v.opts.innerHTML = r.opts.map(([p, c], k) => `<div class="opt"><span class="badge">${'ABC'[k]}</span><button type="button" class="piece${solved && k === r.ok ? ' used' : ''}" data-opt="${k}" aria-label="ピース ${'ABC'[k]}" style="background-image:url(${PICS[p]});background-position:-${c[0] * v.piece}px -${c[1] * v.piece}px"></button></div>`).join('');
    v.stamps.innerHTML = game.solved.map(s => `<span class="stamp${s ? ' on' : ''}">${s ? '✓' : ''}</span>`).join('');
    v.done.textContent = `クリア ${done} / 3`;
    v.next.hidden = !solved;
    v.next.textContent = done === 3 ? 'もういちど あそぶ' : 'つぎの しゃしんへ →';
  }
}

function choose(k, pieceEl) {
  const r = ROUNDS[game.pic];
  if (game.solved[game.pic]) return;
  if (k === r.ok) {
    game.solved[game.pic] = true;
    renderGame();
    const done = game.solved.filter(Boolean).length;
    say(done === 3 ? 'ぜんぶクリア！すごい！' : 'やったー！ぴったり！', 'cheer');
  } else {
    pieceEl.classList.remove('shake'); void pieceEl.offsetWidth; pieceEl.classList.add('shake');
    say('おしい！もういっかい！', 'surprised_open');
  }
}

for (const v of views) {
  v.thumbs.addEventListener('click', e => {
    const b = e.target.closest('.thumb'); if (!b) return;
    game.pic = +b.dataset.pic; renderGame(); say(game.solved[game.pic] ? 'これは もうクリア！' : 'どれかな？', game.solved[game.pic] ? 'cheer' : 'think');
  });
  v.next.addEventListener('click', () => {
    const done = game.solved.filter(Boolean).length;
    if (done === 3) { game.solved = [false, false, false]; game.pic = 0; }
    else game.pic = game.solved.findIndex(s => !s);
    renderGame(); say('どれかな？', 'think');
  });

  // pieces: click/tap to try, or drag into the hole. The dragged copy is the hole's size on screen.
  let drag = null;
  const overHole = e => { const r = v.hole.getBoundingClientRect(); return e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom; };
  const endDrag = () => {
    document.querySelectorAll('.dragGhost').forEach(g => g.remove());
    drag = null; v.hole.classList.remove('hot');
  };
  v.opts.addEventListener('pointerdown', e => {
    const piece = e.target.closest('.piece'); if (!piece || !e.isPrimary || e.button !== 0) return;
    endDrag();
    drag = { piece, k: +piece.dataset.opt, x0: e.clientX, y0: e.clientY, ghost: null };
    piece.setPointerCapture(e.pointerId);
  });
  v.opts.addEventListener('lostpointercapture', () => { if (drag) endDrag(); });
  addEventListener('pointerup', () => { if (drag) endDrag(); });
  addEventListener('blur', endDrag);
  addEventListener('scroll', () => { if (drag?.ghost) endDrag(); }, { passive: true });
  v.opts.addEventListener('pointermove', e => {
    if (!drag) return;
    const size = v.hole.getBoundingClientRect().width;   // the hole as drawn on screen (pages may be shrunk)
    if (!drag.ghost && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 6) {
      const g = document.createElement('div'), c = ROUNDS[game.pic].opts[drag.k][1];
      g.className = 'dragGhost';
      g.style.cssText = `width:${size}px;height:${size}px;background-image:${drag.piece.style.backgroundImage};background-size:${4 * size}px ${3 * size}px;background-position:${-c[0] * size}px ${-c[1] * size}px`;
      document.body.append(g); drag.ghost = g;
    }
    if (drag.ghost) {
      drag.ghost.style.left = e.clientX - size / 2 + 'px'; drag.ghost.style.top = e.clientY - size / 2 + 'px';
      v.hole.classList.toggle('hot', overHole(e));
    }
  });
  v.opts.addEventListener('pointerup', e => {
    if (!drag) return;
    const d = drag; endDrag();
    if (!d.ghost || overHole(e)) choose(d.k, d.piece);
  });
  v.opts.addEventListener('pointercancel', endDrag);
  v.opts.addEventListener('keydown', e => { const p = e.target.closest('.piece'); if (p && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); choose(+p.dataset.opt, p); } });
}
renderGame();

/* ---------- opening: loader → card opens on the sketch → colour paints in ----------
   It only plays when the reader is on the cover (the key visual); someone who reloads further down
   the site just sees the loader and stays where they were. */
async function opening(atCover) {
  document.body.classList.add('loading');
  const m = mode, cover = m.pages[0], rings = m.stage.querySelector('.rings');
  const play = atCover && !reduced;
  if (play) {
    if (m.scroll) {
      // phone: the opening covers just the cover section at the top of the long sheet
      const h = cover.offsetHeight + 'px';
      m.stage.append($('#openBg'), $('#sketchCard'));
      $('#openBg').style.height = h; $('#sketchCard').style.height = h;
    }
    // build the sketch: a line-drawing copy of the cover (plus the rings, which live outside the pages)
    $('#sketch').innerHTML = cover.innerHTML + rings.outerHTML;
  }
  const imgs = [...document.images];
  let loaded = 0;
  const minLoad = wait(reduced ? 0 : 2200);
  const tick = () => { loaded++; $('#loadBar').style.width = Math.round(loaded / (imgs.length + 1) * 90) + '%'; };
  // wait for pictures and fonts, but never longer than 8 s (slow Wi-Fi must not trap people on the loader)
  await Promise.race([
    Promise.all([
      ...imgs.map(im => (im.complete ? Promise.resolve() : new Promise(ok => { im.addEventListener('load', ok); im.addEventListener('error', ok); })).then(tick)),
      document.fonts.ready.then(tick),
    ]),
    wait(8000),
  ]);
  await minLoad;                             // even on fast Wi-Fi, let the loader be seen
  $('#loadBar').style.width = '100%';
  await wait(reduced ? 0 : 900);
  $('#loader').classList.add('gone');
  const card = $('#sketchCard');
  if (!play) { card.classList.add('hidden'); $('#openBg').classList.add('hidden'); document.body.classList.remove('loading'); return; }
  await wait(700);                          // let the loader finish fading first
  // 1) the small card appears and starts opening right away (ease-out: it moves from the first frame)
  card.style.opacity = 1;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  await animate(1700, t => {
    const v = 1 - easeOut(t);
    card.style.clipPath = `inset(${41 * v}% ${43 * v}% ${41 * v}% ${43 * v}% round ${18 * v}px)`;
  });
  await wait(400);
  $('#openBg').classList.add('hidden');      // the card now covers everything; the real page waits underneath
  // 2) the colour paints in: the real cover is lifted above the sketch and revealed by a crisp, growing circle
  // (PC: green behind the turning-page paper; phone: the cover section gets its own grid paper while it paints in)
  const typeTitle = titleTyper(cover.querySelector('h1'));   // the title is blank in colour until it types itself (step 3)
  cover.style.zIndex = 42; cover.style.clipPath = 'circle(0% at 46% 46%)';
  if (m.scroll) cover.classList.add('painting'); else cover.style.background = 'var(--green)';
  rings.style.zIndex = 43;                    // the yellow rings sit on the real cover while it paints in
  // 3) 誰が出るだろう？ types itself out as soon as the colour circle has reached the title (not after the whole paint-in)
  let typing = false;
  await animate(2400, t => {
    cover.style.clipPath = `circle(${(easeOut(t) * 120).toFixed(2)}% at 46% 46%)`;
    if (!typing && t >= 0.18) { typing = true; typeTitle?.(); }
  });
  card.classList.add('hidden');
  cover.style.clipPath = ''; cover.style.zIndex = ''; cover.style.background = ''; rings.style.zIndex = '';
  cover.classList.remove('painting');
  m.pageState.forEach(st => { st.show = null; st.z = null; st.deg = null; }); render();   // put every page's layer order back
  card.classList.add('hidden');
  document.body.classList.remove('loading');
}

/* ---------- cover title: 誰が出るだろう？ is typed out letter by letter (Typed.js), keeping its colours.
   Returns the function that starts the typing, or null when Typed.js didn't load (the title then just stays). ---------- */
function titleTyper(h1) {
  if (!h1 || !window.Typed) return null;
  const html = h1.innerHTML;
  h1.setAttribute('aria-label', h1.textContent);   // screen readers get the whole title at once
  h1.innerHTML = '<span aria-hidden="true"></span>';
  return () => new window.Typed(h1.firstChild, {
    strings: [html], contentType: 'html',
    typeSpeed: 45, startDelay: 0,
    showCursor: false,
  });
}
const wait = ms => new Promise(ok => setTimeout(ok, ms));
const animate = (ms, fn) => new Promise(ok => {
  const t0 = performance.now();
  (function f(now) { const t = Math.min(1, (now - t0) / ms); fn(t); t < 1 ? requestAnimationFrame(f) : ok(); })(t0);
});

/* ---------- wide windows: spread each page's content across the wider paper ----------
   Every item moves outward in proportion to how far it sits from the centre (centre: stays, edges: move the most),
   so the extra width goes into the gaps instead of blank strips at the sides. Full-width drawings stretch instead. */
function markSpread(box, dx = 0) {
  const items = [];
  for (const el of box.children) {
    // SVG drawings have no offset* sizes: read their CSS position and their width/height attributes instead
    const svg = el instanceof SVGSVGElement, cs = svg && getComputedStyle(el);
    const x = dx + (svg ? parseFloat(cs.left) || 0 : el.offsetLeft), y = svg ? parseFloat(cs.top) || 0 : el.offsetTop;
    const w = svg ? el.width.baseVal.value : el.offsetWidth, h = svg ? el.height.baseVal.value : el.offsetHeight;
    if (!w) continue;
    if (w >= 1200) {
      if (el instanceof SVGElement) el.classList.add('spreadWide');
      else markSpread(el, x);                    // a full-width holder: spread what's inside it instead
      continue;
    }
    items.push({ el, x, y, w, h, f: ((x + w / 2) - W / 2) / (W / 2) });
  }
  // things sitting on a bigger box (a strip, a card) move together with that box
  for (const it of items) {
    const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
    const holder = items.filter(o => o !== it && o.w * o.h > it.w * it.h * 1.5 && cx > o.x && cx < o.x + o.w && cy > o.y && cy < o.y + o.h)
                        .sort((a, b) => b.w * b.h - a.w * a.h)[0];
    it.el.style.setProperty('--f', (holder ? holder.f : it.f).toFixed(3));
    it.el.classList.add('spread');
  }
}
// it measures the PC pages, so it waits until the PC notebook is showing (a phone held upright never needs it)
function spreadPC() {
  if (mode !== MODES.pc || MODES.pc.spreadDone) return;
  MODES.pc.spreadDone = true;
  document.querySelectorAll('.pgRoot, .playRoot').forEach(box => markSpread(box));
}
addEventListener('resize', spreadPC);
spreadPC();

/* ---------- a reload keeps the reader's place (per browser tab), on the same notebook (PC/phone) ---------- */
history.scrollRestoration = 'manual';
const POS_KEY = 'uketsuke-pos', modeName = () => (mode === MODES.sp ? 'sp' : 'pc');
function savePos() { try { sessionStorage.setItem(POS_KEY, JSON.stringify({ mode: modeName(), y: scrollY })); } catch {} }
addEventListener('pagehide', savePos);
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') savePos(); });
function savedPos() {
  try { const p = JSON.parse(sessionStorage.getItem(POS_KEY)); if (p && p.mode === modeName()) return +p.y || 0; } catch {}
  return 0;
}
// "on the cover": PC — still within the cover's scroll; phone — the cover section fills most of the screen
const onCover = y => mode.scroll ? y < MODES.sp.pages[0].offsetHeight * scale / 2 : y / innerHeight < scenes[0].len;
const startY = savedPos(), atCover = onCover(startY);
scrollTo(0, atCover ? 0 : startY);
shown = scrollY;                             // jump straight there (no fast-forward through the pages)
render();
opening(atCover);
