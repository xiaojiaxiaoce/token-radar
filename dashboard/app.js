// Token Radar — the dashboard. It reads the dataset the program writes beside this page
// (window.RADAR in ../data.js) and renders a sortable, filterable, hash-addressed radar of
// pre-token protocols. No network, no framework, no external resource: every byte shown is in
// data.js. A detail view's factor breakdown reads the three multipliers the model already stored
// on the row (base_multiple, growth_multiplier, maturity_multiplier) — the page never recomputes
// the score with its own formula.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA || !DATA.rows) return;
  var app = document.getElementById('board');
  var WATCH = new Set(DATA.watchlist || []);
  var CATEGORIES = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
  var CHAINS = Array.from(new Set(DATA.rows.reduce(function (a, r) { return a.concat(r.chains || []); }, []))).sort();

  var state = {
    q: '', category: 'all', chain: 'all', watchlist: false, tvlmin: '', tvlmax: '',
    sort: 'implied', dir: -1, view: 'board', selected: null
  };

  // ---------------------------------------------------------------- formatting
  function usd(n) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    var a = Math.abs(n);
    if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function pct(n) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function age(d) {
    if (d === null || d === undefined) return 'unknown';
    if (d >= 365) return (d / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(d)) + 'd';
  }
  // A model factor, kept at its stored precision (data.js rounds to 4 decimals).
  function fnum(n) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    return String(Math.round(n * 10000) / 10000);
  }

  // ---------------------------------------------------------------- DOM
  function el(tag, attrs) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined) return;
        if (k === 'class') n.className = v;
        else if (k === 'text') n.textContent = v;
        else if (k === 'html') n.innerHTML = v;
        else if (k === 'value') n.value = v;
        else if (k === 'checked') n.checked = !!v;
        else if (k === 'selected') n.selected = !!v;
        else if (k === 'style') n.style.cssText = v;
        else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
        else n.setAttribute(k, v);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x) n.appendChild(x); });
      else if (typeof c === 'string' || typeof c === 'number') n.appendChild(document.createTextNode(String(c)));
      else n.appendChild(c);
    }
    return n;
  }

  // ---------------------------------------------------------------- hash state
  function readHash() {
    var h = window.location.hash.replace(/^#/, '');
    if (!h) return;
    var p = new URLSearchParams(h);
    if (p.get('q') !== null) state.q = p.get('q');
    if (p.get('category')) state.category = p.get('category');
    if (p.get('chain')) state.chain = p.get('chain');
    state.watchlist = p.get('watch') === '1';
    if (p.get('tvlmin') !== null) state.tvlmin = p.get('tvlmin');
    if (p.get('tvlmax') !== null) state.tvlmax = p.get('tvlmax');
    if (p.get('sort')) state.sort = p.get('sort');
    state.dir = p.get('dir') === '1' ? 1 : -1;
    if (p.get('view') === 'live') state.view = 'live';
    if (p.get('p')) state.selected = p.get('p');
  }
  function writeHash() {
    var p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.category !== 'all') p.set('category', state.category);
    if (state.chain !== 'all') p.set('chain', state.chain);
    if (state.watchlist) p.set('watch', '1');
    if (state.tvlmin !== '') p.set('tvlmin', state.tvlmin);
    if (state.tvlmax !== '') p.set('tvlmax', state.tvlmax);
    if (state.sort !== 'implied') p.set('sort', state.sort);
    if (state.dir !== -1) p.set('dir', '1');
    if (state.view === 'live') p.set('view', 'live');
    if (state.selected) p.set('p', state.selected);
    var s = p.toString();
    if (s) window.history.replaceState(null, '', '#' + s);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  // ---------------------------------------------------------------- filtering + sorting
  function tvlMin() { var v = parseFloat(state.tvlmin); return isFinite(v) && v >= 0 ? v * 1e6 : null; }
  function tvlMax() { var v = parseFloat(state.tvlmax); return isFinite(v) && v >= 0 ? v * 1e6 : null; }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var tmin = tvlMin(), tmax = tvlMax();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (state.watchlist && !WATCH.has(r.slug)) return false;
      if (tmin !== null && r.tvl_usd < tmin) return false;
      if (tmax !== null && r.tvl_usd > tmax) return false;
      if (q) {
        var hay = [r.name, r.slug, r.category || '', (r.chains || []).join(' ')].join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }
  function keyOf(r, key) {
    switch (key) {
      case 'rank': return r.rank;
      case 'name': return r.name.toLowerCase();
      case 'category': return (r.category || '').toLowerCase();
      case 'chains': return (r.chains || []).length;
      case 'tvl': return r.tvl_usd;
      case 'change': return r.change_7d === null ? -Infinity : r.change_7d;
      case 'multiple': return r.tvl_usd ? r.implied_value_usd / r.tvl_usd : 0;
      case 'age': return r.age_days === null ? -1 : r.age_days;
      default: return r.implied_value_usd;
    }
  }
  function sorted(list) {
    var key = state.sort, dir = state.dir;
    return list.slice().sort(function (a, b) {
      var av = keyOf(a, key), bv = keyOf(b, key);
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }
  function sortBy(key) {
    if (state.sort === key) state.dir = -state.dir;
    else { state.sort = key; state.dir = (key === 'name' || key === 'category') ? 1 : -1; }
    writeHash();
    render();
  }

  // ---------------------------------------------------------------- header + hero + controls
  function topbar() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' },
        el('span', { class: 'mark', 'aria-hidden': 'true' }),
        el('div', null,
          el('span', { class: 'brand-name', text: 'TOKEN RADAR' }),
          el('span', { class: 'brand-sub', text: 'pre-token protocols ranked by implied value' })
        )
      ),
      el('div', { class: 'top-meta' },
        el('span', { class: 'stamp', text: 'as of ' }, el('strong', { text: DATA.as_of })),
        el('span', { class: 'stamp', text: DATA.model_version + ' model' }),
        el('span', { class: 'stamp', text: 'DefiLlama snapshot' })
      )
    );
  }
  function fact(label, value) {
    return el('div', { class: 'fact' }, el('span', { text: label }), el('b', { text: value }));
  }
  function hero() {
    return el('section', { class: 'hero' },
      el('div', null,
        el('h1', { text: DATA.board_size + ' pre-token protocols on the radar' }),
        el('p', { class: 'lead', text: 'Ranked by implied value from the snapshot\u2019s own TVL, 7-day growth and age. All ' + DATA.watchlist_size + ' watchlist protocols are covered, plus ' + DATA.early_size + ' more pre-token protocols. Implied value is a model, not a promise.' })
      ),
      el('div', { class: 'facts' },
        fact('Watchlist covered', DATA.watchlist_size + ' / ' + DATA.watchlist_size),
        fact('Rows scored', String(DATA.board_size)),
        fact('Beyond the watchlist', String(DATA.early_size)),
        fact('Already trading, set aside', String(DATA.live_size))
      )
    );
  }
  function controls() {
    var list = filtered();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, slug, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var catSel = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories', selected: state.category === 'all' }),
      CATEGORIES.map(function (c) { return el('option', { value: c, text: c, selected: state.category === c }); })
    );
    catSel.addEventListener('change', function () { state.category = catSel.value; writeHash(); render(); });
    var chainSel = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains', selected: state.chain === 'all' }),
      CHAINS.map(function (c) { return el('option', { value: c, text: c, selected: state.chain === c }); })
    );
    chainSel.addEventListener('change', function () { state.chain = chainSel.value; writeHash(); render(); });
    var tmin = el('input', { type: 'number', min: '0', step: '1', placeholder: 'min', value: state.tvlmin, 'aria-label': 'Minimum TVL in millions of USD' });
    tmin.addEventListener('input', function () { state.tvlmin = tmin.value; writeHash(); render(); });
    var tmax = el('input', { type: 'number', min: '0', step: '1', placeholder: 'max', value: state.tvlmax, 'aria-label': 'Maximum TVL in millions of USD' });
    tmax.addEventListener('input', function () { state.tvlmax = tmax.value; writeHash(); render(); });
    var watch = el('button', { type: 'button', class: 'toggle' + (state.watchlist ? ' on' : ''), 'aria-pressed': state.watchlist ? 'true' : 'false', text: 'Watchlist only', onclick: function () { state.watchlist = !state.watchlist; writeHash(); render(); } });
    var tabs = el('div', { class: 'tabs' },
      el('button', { type: 'button', 'aria-pressed': state.view === 'board' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.view = 'board'; writeHash(); render(); } }),
      el('button', { type: 'button', 'aria-pressed': state.view === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.view = 'live'; writeHash(); render(); } })
    );
    var reset = el('button', { type: 'button', class: 'reset', text: 'Reset', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.watchlist = false; state.tvlmin = ''; state.tvlmax = ''; writeHash(); render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field grow' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), catSel),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSel),
      el('div', { class: 'field' }, el('label', { text: 'TVL range ($M)' }), el('div', { class: 'range' }, tmin, el('span', { text: '\u2013' }), tmax)),
      el('div', { class: 'field' }, el('label', { text: 'Scope' }), watch),
      el('div', { class: 'field' }, el('label', { text: 'View' }), tabs),
      el('span', { class: 'count' }, state.view === 'board'
        ? el('span', null, el('b', { text: String(list.length) }), ' of ', DATA.board_size, ' shown')
        : el('span', null, el('b', { text: String(DATA.live.length) }), ' live-token protocols')),
      reset
    );
  }

  // ---------------------------------------------------------------- table
  function th(key, label) {
    var active = state.sort === key;
    return el('th', { scope: 'col', class: active ? 'sorted' : '' },
      el('button', { type: 'button', 'aria-label': 'Sort by ' + label, onclick: function () { sortBy(key); } },
        label,
        el('span', { class: 'arrow', 'aria-hidden': 'true', text: active ? (state.dir < 0 ? '\u25be' : '\u25b4') : '' })
      )
    );
  }
  function chainText(chains) {
    if (!chains || !chains.length) return '\u2014';
    var t = chains.slice(0, 2).join(', ');
    return chains.length > 2 ? t + ' +' + (chains.length - 2) : t;
  }
  function openDetail(slug) {
    state.selected = slug;
    writeHash();
    render();
    window.scrollTo(0, 0);
  }
  function boardTable() {
    var list = sorted(filtered());
    if (list.length === 0) return emptyState();
    var maxV = 1;
    for (var mi = 0; mi < list.length; mi++) if (list[mi].implied_value_usd > maxV) maxV = list[mi].implied_value_usd;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var chg = r.change_7d === null ? '—' : pct(r.change_7d);
      var chgCls = r.change_7d === null ? '' : (r.change_7d >= 0 ? 'pos' : 'neg');
      var m = r.tvl_usd ? r.implied_value_usd / r.tvl_usd : 0;
      tbody.appendChild(el('tr', {
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num rank', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: r.slug }))),
        el('td', null, el('span', { class: 'cat', text: r.category || 'Other' })),
        el('td', { class: 'chains', title: (r.chains || []).join(', '), text: chainText(r.chains) }),
        el('td', { class: 'num', text: usd(r.tvl_usd) }),
        el('td', { class: 'num ' + chgCls, text: chg }),
        el('td', { class: 'num' }, el('span', { class: 'implied' }, el('span', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round(r.implied_value_usd / maxV * 100)) + '%' })), el('span', { text: usd(r.implied_value_usd) }))),
        el('td', { class: 'num', text: '\u00d7' + m.toFixed(2) }),
        el('td', { class: 'num', text: age(r.age_days) })
      ));
    });
    var thead = el('thead', null, el('tr', null,
      th('rank', 'Rank'), th('name', 'Protocol'), th('category', 'Category'), th('chains', 'Chains'),
      th('tvl', 'TVL'), th('change', '7d'), th('implied', 'Implied value'), th('multiple', 'Implied/TVL'), th('age', 'Age')
    ));
    return el('div', { class: 'panel board' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
          thead, tbody
        )
      )
    );
  }
  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      var chg = r.change_7d === null ? '—' : pct(r.change_7d);
      var chgCls = r.change_7d === null ? '' : (r.change_7d >= 0 ? 'pos' : 'neg');
      tbody.appendChild(el('tr', null,
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: r.slug }))),
        el('td', null, el('span', { class: 'cat', text: r.category || 'Other' })),
        el('td', { class: 'chains', title: (r.chains || []).join(', '), text: chainText(r.chains) }),
        el('td', { class: 'num', text: usd(r.tvl_usd) }),
        el('td', { class: 'num ' + chgCls, text: chg }),
        el('td', { class: 'num', text: usd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'badge live', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel board' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. Set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', text: 'Chains' }),
            el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }
  function emptyState() {
    return el('div', { class: 'panel empty' },
      el('h2', { text: 'No protocol matches' }),
      el('p', { text: 'Clear a filter or the search to see the board again.' }),
      el('button', { class: 'reset', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.watchlist = false; state.tvlmin = ''; state.tvlmax = ''; writeHash(); render(); } })
    );
  }

  // ---------------------------------------------------------------- model panel
  function modelPanel() {
    var m = DATA.model;
    var gLo = (1 + m.growth_floor_pct / 100 * m.growth_weight).toFixed(3);
    var gHi = (1 + m.growth_cap_pct / 100 * m.growth_weight).toFixed(3);
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How this radar ranks' }),
      el('p', { class: 'sub', text: 'One stated model scores every pre-token protocol from the snapshot\u2019s own figures. No protocol name is special-cased, and no row is hand-picked.' }),
      el('ol', { class: 'model-steps' },
        el('li', null, el('b', { text: 'Anchor on TVL. ' }), 'Each row starts from its TVL, times the median market-cap/TVL of the snapshot\u2019s tokenised protocols in its category (shrunk toward the grand median, capped at \u00d7' + fnum(DATA.mult_cap) + ').'),
        el('li', null, el('b', { text: 'Adjust for 7-day growth. ' }), 'change_7d is clamped to [' + m.growth_floor_pct + '%, +' + m.growth_cap_pct + '%] and weighted by ' + m.growth_weight + ', moving the value between \u00d7' + gLo + ' and \u00d7' + gHi + '.'),
        el('li', null, el('b', { text: 'Adjust for maturity. ' }), 'A hat curve over days since listed_at: \u00d7' + m.maturity_young + ' at launch, peaking at \u00d7' + m.maturity_peak + ' from ' + m.maturity_ramp_days + ' to ' + m.maturity_peak_end_days + ' days, easing to \u00d7' + m.maturity_old + ' by ' + m.maturity_old_days + ' days (unknown age \u00d7' + m.unknown_age_mult + ').'),
        el('li', null, el('b', { text: 'Multiply and rank. ' }), 'implied = round(TVL \u00d7 base \u00d7 growth \u00d7 maturity), ranked 1\u2026' + DATA.board_size + ' descending. Every row carries its three multipliers so the detail view shows why.')
      ),
      el('p', { class: 'sub', text: 'The board is every watchlist protocol (' + DATA.watchlist_size + ') plus the strongest other pre-token protocols (' + DATA.early_size + '). ' + DATA.live_size + ' already-trading protocols are set aside with their market caps shown.' })
    );
  }

  // ---------------------------------------------------------------- detail view
  function stat(label, value, cls) {
    return el('div', { class: 'stat' + (cls ? ' ' + cls : '') },
      el('span', { class: 'stat-label', text: label }),
      el('b', { class: 'stat-value', text: value })
    );
  }
  function factorRow(label, value, cls) {
    return el('div', { class: 'factor-row' + (cls ? ' ' + cls : '') },
      el('span', { class: 'factor-label', text: label }),
      el('b', { class: 'factor-value', text: value })
    );
  }
  function factorPanel(r) {
    return el('section', { class: 'panel factor' },
      el('h2', { text: 'Why this rank' }),
      el('p', { class: 'sub', text: 'The three multipliers below are the values the model stored on this row (base_multiple, growth_multiplier, maturity_multiplier). This page reads them \u2014 it does not recompute the score.' }),
      el('div', { class: 'factor-rows' },
        factorRow('TVL \u2014 the anchor', usd(r.tvl_usd)),
        factorRow('Base multiple \u2014 category mcap/TVL norm', '\u00d7' + fnum(r.base_multiple)),
        factorRow('Growth multiplier \u2014 7-day change', '\u00d7' + fnum(r.growth_multiplier)),
        factorRow('Maturity multiplier \u2014 age', '\u00d7' + fnum(r.maturity_multiplier)),
        factorRow('Implied value', usd(r.implied_value_usd), 'accent')
      ),
      el('div', { class: 'equation' },
        el('span', { text: usd(r.tvl_usd) }), el('span', { class: 'op', text: '\u00d7' }),
        el('span', { text: fnum(r.base_multiple) }), el('span', { class: 'op', text: '\u00d7' }),
        el('span', { text: fnum(r.growth_multiplier) }), el('span', { class: 'op', text: '\u00d7' }),
        el('span', { text: fnum(r.maturity_multiplier) }), el('span', { class: 'op', text: '=' }),
        el('span', { class: 'accent', text: usd(r.implied_value_usd) })
      ),
      el('p', { class: 'sub', text: 'implied = round(TVL \u00d7 base \u00d7 growth \u00d7 maturity), rounded to whole dollars. An estimate, not a price.' })
    );
  }
  function farmPanel(r) {
    var steps = farmPlan(r);
    return el('section', { class: 'farm' },
      el('h2', { text: 'Farm plan' }),
      el('p', { class: 'sub', text: steps.length + ' steps for ' + r.name + ', sized from its category, chains and TVL tier.' }),
      el('ol', { class: 'steps' }, steps.map(function (s, i) {
        return el('li', null,
          el('div', { class: 'step-num', text: String(i + 1) }),
          el('div', { class: 'step-body' },
            el('p', { text: s.action }),
            el('div', { class: 'chips' },
              el('span', { class: 'chip cost', text: s.cost }),
              el('span', { class: 'chip time', text: s.time })
            )
          )
        );
      }))
    );
  }
  function detailView(r) {
    var m = r.tvl_usd ? r.implied_value_usd / r.tvl_usd : 0;
    var chgCls = r.change_7d === null ? '' : (r.change_7d >= 0 ? 'pos' : 'neg');
    return el('div', { class: 'detail' },
      el('button', { class: 'back', type: 'button', text: '\u2190 Back to board', onclick: function () { state.selected = null; writeHash(); render(); window.scrollTo(0, 0); } }),
      el('header', { class: 'detail-head' },
        el('div', { class: 'kicker' },
          el('span', { text: 'Rank ' + r.rank + ' of ' + DATA.board_size }),
          el('span', { class: 'badge', text: 'pre-token' })
        ),
        el('h1', { text: r.name }),
        el('p', { class: 'sub', text: (r.category || 'Other') + ' \u00b7 ' + (r.chains && r.chains.length ? r.chains.join(', ') : 'no chain on record') })
      ),
      el('section', { class: 'stats' },
        stat('TVL', usd(r.tvl_usd)),
        stat('7-day change', pct(r.change_7d), chgCls),
        stat('Age with no token', age(r.age_days)),
        stat('Listed', r.listed_at || 'unknown'),
        stat('Implied value', usd(r.implied_value_usd), 'accent'),
        stat('Implied/TVL', '\u00d7' + m.toFixed(2))
      ),
      factorPanel(r),
      farmPanel(r)
    );
  }

  // ---------------------------------------------------------------- farm plan (concrete, category-driven)
  function step(action, cost, time) { return { action: action, cost: cost, time: time }; }
  function capitalFor(tvl) {
    if (tvl >= 1e9) return 500;
    if (tvl >= 2e8) return 250;
    if (tvl >= 5e7) return 100;
    if (tvl >= 2e7) return 50;
    return 25;
  }
  function holdWeeks(d) {
    if (d === null || d === undefined) return 6;
    if (d < 90) return 8;
    if (d < 270) return 6;
    if (d < 730) return 5;
    return 4;
  }
  function slugVariant(slug) {
    var h = 0;
    for (var i = 0; i < slug.length; i++) h = (h + slug.charCodeAt(i)) % 3;
    return h;
  }
  function walletStep(chain, gas, v) {
    var note = [
      'keep its seed phrase offline and fund it with only the capital you plan to farm',
      'write the seed on paper, not in any app, and move in only the farming capital',
      'keep the seed in cold storage and fund only the farming amount'
    ][v];
    return step('Create a fresh wallet on ' + chain + ' and ' + note + '.', 'about $' + gas + ' of ' + chain + ' gas for the first transaction', '10 minutes');
  }
  function playbook(cat, r, cap, gas, chain, chain2, v) {
    var name = r.name, capS = '$' + cap;
    var pair = ['its main quoted asset', 'its most liquid pair', 'a stable pair'][v];
    var collat = ['USDC', 'the chain native asset', 'a supported collateral'][v];
    var leg = ['a BTC/USD perpetual', 'an ETH/USD perpetual', 'a short-dated rate position'][v];
    var lev = ['about 2x', 'about 1.5x', 'about 2.5x'][v];
    if (cat.indexOf('dex') >= 0) return [
      step('Swap ' + capS + ' of USDC for ' + name + "'s main quoted asset on its own interface on " + chain + '.', 'about $' + gas + ' of ' + chain + ' gas', '15 minutes'),
      step('Provide ' + capS + ' of two-sided liquidity to ' + pair + " in " + name + "'s pools on " + chain + ' and leave it in range.', capS + ' of capital plus about $' + gas + ' of gas', '20 minutes')
    ];
    if (cat.indexOf('lend') >= 0 || cat.indexOf('cdp') >= 0 || cat.indexOf('collateral') >= 0) return [
      step('Supply ' + capS + ' of ' + collat + ' as collateral to ' + name + ' on ' + chain + ' and keep it open.', capS + ' of capital plus about $' + gas + ' of gas', '15 minutes'),
      step('Borrow about 35% of the collateral value and hold it with the health factor above 1.5.', 'about $3 of gas', '10 minutes')
    ];
    if (cat.indexOf('perpetual') >= 0 || cat.indexOf('derivative') >= 0 || cat.indexOf('option') >= 0) return [
      step('Deposit ' + capS + ' of USDC as margin on ' + name + ' on ' + chain + ' and leave most of it unallocated.', capS + ' of capital plus about $' + gas + ' of gas', '15 minutes'),
      step('Open ' + leg + ' with at most 20% of the margin and a stop set.', 'about $3 of gas', '15 minutes')
    ];
    if (cat.indexOf('basis') >= 0) return [
      step('Deposit ' + capS + ' of collateral into ' + name + ' on ' + chain + ' for a basis position.', capS + ' of capital plus about $' + gas + ' of gas', '15 minutes'),
      step('Open a cash-and-carry position (spot long plus a short perpetual) on ' + name + "'s own pairs and keep it delta-neutral.", 'about $3 of gas', '20 minutes')
    ];
    if (cat.indexOf('bridge') >= 0) return [
      step('Bridge ' + capS + ' of USDC from ' + chain + ' to ' + chain2 + ' through ' + name + ' and keep the receipt.', capS + ' of capital plus the bridge fee and about $' + gas + ' of gas', '20 minutes'),
      step('Use the bridged funds in one application on ' + chain2 + ' so the route shows real usage.', 'about $3 of gas on the far chain', '20 minutes')
    ];
    if (cat.indexOf('leveraged farm') >= 0) return [
      step('Deposit ' + capS + ' into ' + name + ' on ' + chain + ' and lever the position to ' + lev + '.', capS + ' of capital plus about $' + gas + ' of gas', '20 minutes'),
      step('Watch the leverage ratio weekly and repay a little if it drifts near the limit.', 'about $3 of gas when you adjust', '10 minutes a week')
    ];
    if (cat.indexOf('yield aggregator') >= 0 || cat.indexOf('liquidity manager') >= 0) return [
      step('Deposit ' + capS + ' into ' + name + "'s managed strategy on " + chain + ' and record the share price.', capS + ' of capital plus about $' + gas + ' of gas', '15 minutes'),
      step("Check the strategy's weekly report and let it rebalance without manual churn.", 'no cost to check', '10 minutes a week')
    ];
    if (cat.indexOf('yield') >= 0 || cat.indexOf('farm') >= 0) return [
      step('Deposit ' + capS + ' into ' + name + "'s main vault or pool on " + chain + ' and keep the receipt.', capS + ' of capital plus about $' + gas + ' of gas', '15 minutes'),
      step('Leave it to compound and claim the yield at the protocol\u2019s own cadence.', 'about $2 of gas per claim', '5 minutes per claim')
    ];
    if (cat.indexOf('restak') >= 0 || cat.indexOf('staking') >= 0 || cat.indexOf('anchor btc') >= 0 || cat.indexOf('decentralized btc') >= 0) return [
      step('Stake ' + capS + ' of the underlying asset through ' + name + ' on ' + chain + ' and keep the receipt token.', capS + ' of capital plus about $' + gas + ' of gas', '15 minutes'),
      step("Hold the receipt through the epochs and note each epoch's rewards or points.", 'no cost to hold', '5 minutes an epoch')
    ];
    if (cat.indexOf('rwa') >= 0) return [
      step('Mint or deposit ' + capS + ' into ' + name + "'s RWA vault on " + chain + ', completing any required KYC first.', capS + ' of capital plus about $' + gas + ' of gas', '20 minutes plus KYC'),
      step("Hold the yield token and track the underlying asset's reported yield.", 'no cost to hold', '5 minutes a week')
    ];
    if (cat.indexOf('curator') >= 0) return [
      step('Deposit ' + capS + ' into a vault curated by ' + name + ' on ' + chain + ' and keep the receipt.', capS + ' of capital plus about $' + gas + ' of gas', '15 minutes'),
      step('Split the position across two of ' + name + "'s curated pools to diversify.", 'about $3 of gas for the second entry', '15 minutes')
    ];
    if (cat.indexOf('allocator') >= 0) return [
      step('Deposit ' + capS + ' into ' + name + "'s allocator vault on " + chain + ' and record the entry value.', capS + ' of capital plus about $' + gas + ' of gas', '15 minutes'),
      step('Choose the default or a single conservative strategy, then review the weekly report.', 'no cost to check', '10 minutes a week')
    ];
    if (cat.indexOf('chain') >= 0) return [
      step('Buy or bridge ' + capS + ' of the gas asset and use ' + name + "'s core application on " + chain + '.', capS + ' of capital plus about $' + gas + ' of gas', '20 minutes'),
      step("Use one of the chain's key applications once a week to build an on-chain history.", 'about $2 of gas a week', '10 minutes a week')
    ];
    if (cat.indexOf('prediction') >= 0) return [
      step('Fund ' + capS + ' of USDC into ' + name + ' on ' + chain + ' and keep most of it unplaced.', capS + ' of capital plus about $' + gas + ' of gas', '15 minutes'),
      step('Place one small position in a market that resolves within a few weeks, sized to an affordable loss.', 'about $3 of gas', '10 minutes')
    ];
    if (cat.indexOf('stable') >= 0) return [
      step('Mint or deposit ' + capS + ' of the stable asset through ' + name + ' on ' + chain + '.', capS + ' of capital plus about $' + gas + ' of gas', '15 minutes'),
      step('Put the stable to work in one yield venue while keeping the position liquid.', 'about $3 of gas', '15 minutes')
    ];
    if (cat.indexOf('insurance') >= 0) return [
      step('Buy ' + capS + ' of cover from ' + name + ' on ' + chain + ' for a position you actually hold.', 'the premium plus about $' + gas + ' of gas', '15 minutes'),
      step('Keep the policy active and renew it if it lapses before the window closes.', 'the premium on renewal', '5 minutes a week')
    ];
    if (cat.indexOf('payment') >= 0) return [
      step('Open a channel or account on ' + name + ' on ' + chain + ' funded with ' + capS + '.', capS + ' of capital plus about $' + gas + ' of gas', '20 minutes'),
      step('Route one real payment or invoice through it each week.', 'about $1 of routing or gas a week', '10 minutes a week')
    ];
    if (cat.indexOf('governance') >= 0) return [
      step('Stake or deposit ' + capS + ' through ' + name + ' on ' + chain + ' to earn the incentive.', capS + ' of capital plus about $' + gas + ' of gas', '15 minutes'),
      step('Delegate the voting power and vote on one live proposal.', 'about $2 of gas', '10 minutes')
    ];
    if (cat.indexOf('index') >= 0) return [
      step('Swap ' + capS + ' into ' + name + "'s index token on " + chain + '.', capS + ' of capital plus about $' + gas + ' of gas', '15 minutes'),
      step('Hold the index and reinvest any distributions it pays.', 'about $2 of gas per reinvest', '5 minutes when it pays')
    ];
    if (cat.indexOf('cedefi') >= 0) return [
      step('Deposit ' + capS + ' into ' + name + "'s CeDeFi vault on " + chain + ' (the on-chain leg).', capS + ' of capital plus about $' + gas + ' of gas', '15 minutes'),
      step('Reconcile the yield the protocol reports against your balance each week.', 'no cost to check', '10 minutes a week')
    ];
    if (cat.indexOf('card') >= 0) return [
      step('Deposit ' + capS + ' through ' + name + ' to issue or fund the card on ' + chain + '.', capS + ' of capital plus about $' + gas + ' of gas', '20 minutes'),
      step('Make one small card purchase and repay it on time.', 'the purchase amount', '5 minutes')
    ];
    if (cat.indexOf('otc') >= 0) return [
      step('Deposit ' + capS + ' and place one limit order on ' + name + "'s OTC venue on " + chain + '.', capS + ' of capital plus about $' + gas + ' of gas', '20 minutes'),
      step('Settle a trade, record the price, then place a second order to stay active.', 'about $3 of gas per order', '15 minutes')
    ];
    return [
      step('Deposit ' + capS + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.', capS + ' of capital plus about $' + gas + ' of gas', '15 minutes'),
      step('Make one qualifying action (a swap, borrow, vote or stake) to build a history.', 'about $2 of gas a week', '10 minutes a week')
    ];
  }
  function farmPlan(r) {
    var chain = (r.chains && r.chains[0]) || 'its main chain';
    var chain2 = (r.chains && r.chains[1]) || 'a second chain it supports';
    var cap = capitalFor(r.tvl_usd);
    var gas = cap >= 250 ? 8 : cap >= 100 ? 5 : 3;
    var weeks = holdWeeks(r.age_days);
    var v = slugVariant(r.slug);
    var cat = (r.category || '').toLowerCase();
    var out = [walletStep(chain, gas, v)];
    out = out.concat(playbook(cat, r, cap, gas, chain, chain2, v));
    out.push(step('Make one qualifying action each week (a swap, a borrow, a repayment, a vote or a stake) for ' + weeks + ' weeks so the activity is recorded across snapshots on ' + chain + '.', 'about $2 of gas a week', '10 minutes a week'));
    out.push(step('Hold the position for at least ' + weeks + ' weeks so it is counted in more than one snapshot.', 'the $' + cap + ' stays in the position', weeks + ' weeks'));
    out.push(step("Before unwinding, claim any points or rewards only from " + r.name + "'s own page, then log the wallet, the dates and every transaction.", 'no fee to check, never pay to claim', '10 minutes'));
    return out;
  }

  // ---------------------------------------------------------------- render
  function findRow(slug) {
    for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === slug) return DATA.rows[i];
    return null;
  }
  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(topbar());
    var sel = state.selected ? findRow(state.selected) : null;
    if (sel) {
      shell.appendChild(detailView(sel));
    } else {
      shell.appendChild(hero());
      shell.appendChild(controls());
      shell.appendChild(state.view === 'live' ? liveTable() : boardTable());
      if (state.view === 'board') shell.appendChild(modelPanel());
    }
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
  }

  readHash();
  render();
  window.addEventListener('hashchange', function () { readHash(); render(); });
})();
