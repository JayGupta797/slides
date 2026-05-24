/* render.js — turns parsed survey JSON into editorial cards.
   Each question picks a layout based on its shape:
     - 2 options              → split-bar (binary)
     - 3-6 options short list → horizontal bars
     - long list              → ranked 2-col
     - stats                  → stat-grid
   Plus special-case treatments for politics, income, hours, etc.
*/

const COLS = { auto: 'col-6', binary: 'col-3', few: 'col-6', many: 'col-12', stats: 'col-6' };

const fmt = (n) => `${n.toFixed(n % 1 === 0 ? 0 : 2).replace(/\.?0+$/, '')}%`;
const round = (n) => Math.round(n);
const sortDesc = (rows) => rows.slice().sort((a,b) => b.pct - a.pct);

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

// ——— Layout: split-bar for binary — clean, no copy ———
function renderBinary(q) {
  const yesRow = q.rows.find(r => /^yes$/i.test(r.label)) || q.rows[0];
  const noRow  = q.rows.find(r => /^no$/i.test(r.label)) || q.rows[1];
  const card = el('div', 'q-card');
  card.appendChild(qHead(q));

  const wrap = el('div', 'binary');
  wrap.innerHTML = `
    <div class="bar">
      <div class="seg a" style="flex:${yesRow.pct}"></div>
      <div class="seg b" style="flex:${noRow.pct}"></div>
    </div>
    <div class="legend">
      <div class="item">
        <span class="sw a"></span>
        <span class="lbl">${yesRow.label}</span>
        <span class="pct">${fmt(yesRow.pct)}</span>
      </div>
      <div class="item">
        <span class="sw b"></span>
        <span class="lbl">${noRow.label}</span>
        <span class="pct">${fmt(noRow.pct)}</span>
      </div>
    </div>
  `;
  card.appendChild(wrap);
  return card;
}

// ——— Layout: bars (3-8 options) ———
function renderBars(q, opts = {}) {
  const colCls = opts.col || 'col-6';
  const card = el('div', `q-card ${colCls}`);
  card.appendChild(qHead(q));
  const bars = el('div', 'bars');
  const rows = sortDesc(q.rows);
  for (const r of rows) {
    const row = el('div', 'bar-row');
    row.innerHTML = `
      <div class="lbl-pct">
        <span class="lbl">${r.label}</span>
        <span class="pct">${fmt(r.pct)}</span>
      </div>
      <div class="bar-track"><div class="bar-fill" style="width:${r.pct.toFixed(1)}%"></div></div>
    `;
    bars.appendChild(row);
  }
  card.appendChild(bars);
  return card;
}

// ——— Layout: ranked compact list ———
function renderRanked(q, opts = {}) {
  const card = el('div', `q-card ${opts.col || 'col-6'}`);
  card.appendChild(qHead(q));
  const rows = sortDesc(q.rows);
  const list = el('div', 'bars compact');
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const row = el('div', 'bar-row with-rank');
    row.innerHTML = `
      <div class="lbl-pct">
        <span class="rk">${String(i+1).padStart(2,'0')}</span>
        <span class="lbl">${r.label}</span>
        <span class="pct">${fmt(r.pct)}</span>
      </div>
      <div class="bar-track"><div class="bar-fill" style="width:${r.pct.toFixed(1)}%"></div></div>
    `;
    list.appendChild(row);
  }
  card.appendChild(list);
  return card;
}

// ——— Layout: stat grid (e.g. SAT scores) ———
function renderStats(q) {
  const card = el('div', 'q-card col-6');
  card.appendChild(qHead(q));
  const grid = el('div', 'stat-grid');
  for (const s of q.stats) {
    const it = el('div', 'item');
    it.innerHTML = `<div class="v">${s.val}</div><div class="l">${s.lbl}</div>`;
    grid.appendChild(it);
  }
  card.appendChild(grid);
  return card;
}

// ——— Layout: histogram (vertical columns) ———
function renderHisto(q, opts = {}) {
  const card = el('div', `q-card ${opts.col || 'col-6'}`);
  card.appendChild(qHead(q));
  const rows = opts.order ? opts.order.map(lbl => q.rows.find(r => r.label === lbl)).filter(Boolean) : q.rows;
  const max = Math.max(...rows.map(r => r.pct));
  const wrap = el('div', 'histo');
  wrap.style.marginTop = 'auto';
  const cols = el('div', 'cols');
  cols.style.gridTemplateColumns = `repeat(${rows.length}, 1fr)`;
  for (const r of rows) {
    const h = (r.pct / max * 100);
    const col = el('div', 'col' + (h < 18 ? ' outside' : ''));
    col.style.height = `${h}%`;
    col.innerHTML = `<span class="pct">${fmt(r.pct)}</span>`;
    cols.appendChild(col);
  }
  const labels = el('div', 'labels');
  labels.style.gridTemplateColumns = `repeat(${rows.length}, 1fr)`;
  for (const r of rows) labels.appendChild(el('span', '', r.label));
  wrap.appendChild(cols);
  wrap.appendChild(labels);
  card.appendChild(wrap);
  return card;
}

// ——— Layout: political spectrum (horizontal stacked) ———
function renderSpectrum(q, opts = {}) {
  const card = el('div', `q-card ${opts.col || 'col-12'}`);
  card.appendChild(qHead(q));
  const order = ['Very left-leaning', 'Somewhat left-leaning', 'Moderate', 'Somewhat right-leaning', 'Very right-leaning'];
  const rows = order.map(lbl => q.rows.find(r => r.label === lbl)).filter(Boolean);
  const colors = ['#8C1515', '#B23232', '#A09A92', '#3A3530', '#1A1814'];
  const short = ['Very left', 'Somewhat left', 'Moderate', 'Somewhat right', 'Very right'];

  const right = el('div');
  const wrap = el('div', 'pol-stack');
  // Labels above (hide for very small segments)
  const top = el('div', 'pol-top');
  rows.forEach((r, i) => {
    const cell = el('div', 'cell');
    cell.style.flex = r.pct;
    if (r.pct >= 5) {
      cell.innerHTML = `<div class="pct" style="color:${colors[i]}">${fmt(r.pct)}</div>`;
    }
    top.appendChild(cell);
  });
  // Bar
  const bar = el('div', 'pol-bar');
  rows.forEach((r, i) => {
    const seg = el('div', 'seg');
    seg.style.flex = r.pct;
    seg.style.background = colors[i];
    bar.appendChild(seg);
  });
  // Labels below — only for major segments, with explicit tail for small ones
  const bot = el('div', 'pol-bot');
  rows.forEach((r, i) => {
    const cell = el('div', 'cell');
    cell.style.flex = r.pct;
    if (r.pct >= 5) {
      cell.innerHTML = `<div class="lbl">${short[i]}</div>`;
    }
    bot.appendChild(cell);
  });
  wrap.appendChild(top);
  wrap.appendChild(bar);
  wrap.appendChild(bot);
  right.appendChild(wrap);

  // Axis caption + small-segment annotations
  const small = rows.filter(r => r.pct < 5).map((r) => {
    const idx = rows.indexOf(r);
    return `<span style="color:${colors[idx]}; font-weight:600">${short[idx]} ${fmt(r.pct)}</span>`;
  }).join(' · ');
  const axis = el('div', 'pol-axis');
  axis.innerHTML = `
    <span class="left">← LEFT</span>
    <span class="mid">${small || ''}</span>
    <span class="right">RIGHT →</span>
  `;
  right.appendChild(axis);

  const otherRow = q.rows.find(r => r.label === 'Other');
  if (otherRow) {
    const cap = el('div');
    cap.innerHTML = `<span class="eyebrow" style="display:block; margin-top:14px;">Other: ${fmt(otherRow.pct)} (not shown)</span>`;
    right.appendChild(cap);
  }
  card.appendChild(right);
  return card;
}

// ——— Layout: big number callout ———
function renderBigNum(q, opts = {}) {
  const card = el('div', `q-card ${opts.col || 'col-3'}`);
  card.appendChild(qHead(q));
  const yesRow = q.rows.find(r => /^yes$/i.test(r.label)) || q.rows[0];
  const big = el('div', 'bignum');
  big.innerHTML = `
    <div class="v">${round(yesRow.pct)}<span style="font-size:0.5em">%</span></div>
    <div class="l">said <em style="font-family:var(--serif); font-style:italic; color:var(--cardinal);">${yesRow.label.toLowerCase()}</em></div>
  `;
  card.appendChild(big);
  return card;
}

// ——— Common header ———
function qHead(q) {
  const head = el('div', 'q-head');
  head.innerHTML = `
    <div class="q-text">${q.text}</div>
    <div class="q-n">N=${q.n}</div>
  `;
  return head;
}

// ——— Decide layout for a question ———
function renderQuestion(q, sectionId) {
  // explicit special cases by text match
  const t = q.text.toLowerCase();
  if (q.type === 'stats') return renderStats(q);

  // Politics → spectrum
  if (t === 'what is your political affiliation?') return renderSpectrum(q);

  // Income → histogram
  if (t.includes('household income')) {
    return renderHisto(q, {
      col: 'col-12',
      order: [
        'Less than $25,000', '$25,000–$49,999', '$50,000–$99,999',
        '$100,000–$199,999', '$200,000–$299,999', '$300,000–$499,999',
        'More than $500,000'
      ]
    });
  }
  // Study hours, sleep hours, AP, children → ordered histogram
  if (t.includes('hours did you spend studying')) {
    return renderHisto(q, { col: 'col-6', order: ['Less than 1 hour','1–2 hours','2–3 hours','3–4 hours','4–5 hours','5+ hours'] });
  }
  if (t.includes('hours did you sleep')) {
    return renderHisto(q, { col: 'col-6', order: ['5–6 hours','6–7 hours','7–8 hours','8–9 hours','9+ hours'] });
  }
  if (t.includes('ap, ib, or advanced')) {
    return renderHisto(q, { col: 'col-6', order: ['0','1–2','3–5','6–8','9–12','13+'] });
  }
  if (t.includes('how many children')) {
    return renderHisto(q, { col: 'col-6', order: ['1 or 2','3 or 4','5 or 6','7+'] });
  }

  // States, careers, school applications, activities — long lists
  if (t.includes('which state')) return renderRanked(q, { col: 'col-6' });
  if (t.includes('also apply') || t.includes('also accepted') || t.includes('career interests') || t.includes('activities did you do') || t.includes('free time') || t.includes('not your top choice')) {
    return renderRanked(q, { col: 'col-6' });
  }

  // Peer influence questions — render as small bars, 2-up
  if (t.startsWith('to what extent will your peers')) {
    return renderBars(q, { col: 'col-6' });
  }

  // Binary
  if (q.rows.length === 2) {
    return renderBinary(q);
  }

  // Default to bars
  return renderBars(q, { col: 'col-6' });
}

// ——— Build the whole page ———
async function build() {
  const inlineEl = document.getElementById('survey-data');
  const data = inlineEl
    ? JSON.parse(inlineEl.textContent)
    : await fetch('data.json').then(r => r.json());
  const sectionsEl = document.getElementById('sections');

  const sectionMeta = {
    demographics: {
      num: '01',
      headline: 'Who they <em>are</em>.',
      blurb: 'A snapshot of the class — where they come from, who they identify as, and what they bring with them to The Farm.',
    },
    academics: {
      num: '02',
      headline: 'How they <em>got here</em>.',
      blurb: 'The admissions story: where else they applied, the schools that almost won, the tests, the rankings, the consultants.',
    },
    lifestyle: {
      num: '03',
      headline: 'How they <em>live</em>.',
      blurb: 'Career interests, sleep, study habits, and a more candid look at relationships, substances, and the social scene.',
    },
    values: {
      num: '04',
      headline: 'What they <em>believe</em>.',
      blurb: 'Politics, religion, family ambitions, and the quiet pressures of peer influence — the soft data.',
    },
  };

  for (const sec of data) {
    const meta = sectionMeta[sec.id] || { num: '', headline: sec.title, blurb: '' };
    const section = el('section', 'section');
    section.id = sec.id;
    section.innerHTML = `
      <div class="wrap">
        <div class="section-opener">
          <div class="left">
            <div class="num">${meta.num}</div>
            <div class="num-lbl">Chapter ${meta.num} · ${sec.title}</div>
          </div>
          <div class="right">
            <h2>${meta.headline}</h2>
            <div class="blurb">${meta.blurb}</div>
          </div>
        </div>
        <div class="q-grid"></div>
      </div>
    `;
    const grid = section.querySelector('.q-grid');
    for (const q of sec.questions) {
      grid.appendChild(renderQuestion(q, sec.id));
    }
    sectionsEl.appendChild(section);
  }
}

build();
