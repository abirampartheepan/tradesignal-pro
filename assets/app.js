/* ═══════════════════════════════════════════════════
   TradeSignal Pro — Shared Application Logic
   ═══════════════════════════════════════════════════ */

'use strict';

// ── CONFIG ─────────────────────────────────────────
const REFRESH_SEC   = 60;
const AUD_FALLBACK  = 1.57;

// FMP (Financial Modeling Prep) — free tier, 250 requests/day
// Get your free key at: https://site.financialmodelingprep.com/ (no credit card needed)
const FMP_KEY = 'ZQD2SdTNsOBRTLuNlq5EU9BDpZteY3bm';

const US_SYMS = ['NVDA','AAPL','MSFT','AMZN','META','GOOGL','TSLA','AMD','JPM','V','NFLX','DIS','COIN','PLTR','SOFI'];
const ASX_SYMS = ['BHP.AX','CBA.AX','CSL.AX','ANZ.AX','WBC.AX','NAB.AX','WES.AX','MQG.AX','RIO.AX','TLS.AX','FMG.AX','WOW.AX','GMG.AX','REA.AX','XRO.AX'];

const STOCK_NAMES = {
  NVDA:'NVIDIA Corp',AAPL:'Apple Inc',MSFT:'Microsoft',AMZN:'Amazon',META:'Meta Platforms',
  GOOGL:'Alphabet (Google)',TSLA:'Tesla',AMD:'Advanced Micro Devices',JPM:'JPMorgan Chase',V:'Visa Inc',
  NFLX:'Netflix',DIS:'Walt Disney',COIN:'Coinbase',PLTR:'Palantir',SOFI:'SoFi Technologies',
  'BHP.AX':'BHP Group','CBA.AX':'Commonwealth Bank','CSL.AX':'CSL Limited','ANZ.AX':'ANZ Bank',
  'WBC.AX':'Westpac Banking','NAB.AX':'National Aust. Bank','WES.AX':'Wesfarmers','MQG.AX':'Macquarie Group',
  'RIO.AX':'Rio Tinto','TLS.AX':'Telstra','FMG.AX':'Fortescue','WOW.AX':'Woolworths Group',
  'GMG.AX':'Goodman Group','REA.AX':'REA Group','XRO.AX':'Xero',
};

const CHART_COLORS = ['#3b82c4','#2a9d5c','#c0392b','#c49a2e','#8b5cf6','#e97316','#06b6d4','#ec4899','#84cc16','#f43f5e','#a855f7','#14b8a6','#fb923c','#a3e635','#e879f9'];

// ── WATCHLIST ────────────────────────────────────────
function watchKey()        { const s=getSession(); return s?`tsp_watch_${s.username}`:'tsp_watch_guest'; }
function getWatchlist()    { try{return JSON.parse(localStorage.getItem(watchKey())||'[]');}catch{return[];} }
function saveWatchlistData(l){ localStorage.setItem(watchKey(),JSON.stringify(l)); }
function isWatched(sym)    { return getWatchlist().includes(sym); }
function toggleWatchlist(sym){
  let list = getWatchlist();
  const adding = !list.includes(sym);
  list = adding ? [...list,sym] : list.filter(s=>s!==sym);
  saveWatchlistData(list);
  document.querySelectorAll(`.star-btn[data-sym]`).forEach(btn=>{
    if(btn.dataset.sym===sym){ btn.classList.toggle('active',adding); btn.title=adding?'Remove from watchlist':'Add to watchlist'; }
  });
  showToast('INFO', adding?'★ Added to Watchlist':'☆ Removed from Watchlist', sym);
}

// ── SIGNAL LOG ───────────────────────────────────────
function sigLogKey()   { const s=getSession(); return s?`tsp_siglog_${s.username}`:'tsp_siglog_guest'; }
function getSignalLog(){ try{return JSON.parse(localStorage.getItem(sigLogKey())||'[]');}catch{return[];} }
function appendSignalLog(entry){
  const log=getSignalLog(); log.unshift(entry);
  if(log.length>300) log.pop();
  localStorage.setItem(sigLogKey(),JSON.stringify(log));
}
function clearSignalLog(){ localStorage.removeItem(sigLogKey()); }

// ── CUSTOM SYMBOLS ───────────────────────────────────
function customSymKey(market) {
  const s = getSession();
  return `tsp_custom_${market}_${s?.username || 'guest'}`;
}
function getCustomSyms(market) {
  try { return JSON.parse(localStorage.getItem(customSymKey(market)) || '[]'); } catch { return []; }
}
function saveCustomSyms(market, list) { localStorage.setItem(customSymKey(market), JSON.stringify(list)); }
function addCustomSym(market, sym) {
  const list = getCustomSyms(market);
  if (!list.includes(sym)) saveCustomSyms(market, [...list, sym]);
}
function removeCustomSym(market, sym) { saveCustomSyms(market, getCustomSyms(market).filter(s => s !== sym)); }

function openAddSymModal(market) {
  document.getElementById('addSymModal')?.remove();
  const existing = getCustomSyms(market);
  const label = market === 'us' ? 'US Stock' : market === 'asx' ? 'ASX Stock' : 'Cryptocurrency';
  const ph    = market === 'crypto' ? 'e.g. solana, chainlink, polkadot' : market === 'us' ? 'e.g. AMGN, BA, GS' : 'e.g. MIN.AX, PLS.AX';
  const m = document.createElement('div');
  m.className = 'modal-backdrop'; m.id = 'addSymModal';
  m.onclick = e => { if (e.target === m) m.remove(); };
  m.innerHTML = `
    <div class="modal" style="max-width:480px;width:90%">
      <div class="modal-head">
        <div>
          <div class="modal-title">Add ${label}</div>
          <div class="modal-sub">Search and add a custom symbol to the live table</div>
        </div>
        <button class="modal-close" onclick="document.getElementById('addSymModal').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <input id="addSymInput" class="settings-input" placeholder="${ph}" style="flex:1;margin:0"
            onkeydown="if(event.key==='Enter')searchAddSym('${market}')">
          <button class="settings-btn" style="margin:0;padding:0 16px" onclick="searchAddSym('${market}')">Search</button>
        </div>
        <div id="addSymResult" style="min-height:52px;margin-bottom:${existing.length ? 16 : 0}px"></div>
        ${existing.length ? `
          <div style="font-size:11px;color:var(--text3);margin-bottom:8px;letter-spacing:.05em">YOUR CUSTOM SYMBOLS</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${existing.map(s => `<span class="custom-sym-tag">${s}<button onclick="removeAndRefresh('${market}','${s}')" title="Remove">✕</button></span>`).join('')}
          </div>` : ''}
      </div>
    </div>`;
  document.body.appendChild(m);
}

async function searchAddSym(market) {
  const inp = document.getElementById('addSymInput');
  const res = document.getElementById('addSymResult');
  if (!inp || !res) return;
  const raw = inp.value.trim();
  if (!raw) return;
  res.innerHTML = '<div class="loading" style="justify-content:flex-start;gap:8px;padding:0;min-height:0"><div class="spinner"></div> Searching…</div>';

  if (market === 'crypto') {
    try {
      const r = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(raw)}`, { signal: mkTimeout(8000) });
      const d = await r.json();
      const coin = d?.coins?.[0];
      if (!coin) { res.innerHTML = '<div style="color:var(--red);font-size:12px">No coin found — try the full name.</div>'; return; }
      res.innerHTML = `<div class="add-sym-result">
        <div><div style="font-weight:700">${coin.name} <span style="color:var(--text3);font-weight:400">${coin.symbol.toUpperCase()}</span></div>
        <div style="font-size:11px;color:var(--text3)">Rank #${coin.market_cap_rank || '?'}</div></div>
        <button class="settings-btn" style="margin:0;padding:0 14px" onclick="confirmAddSym('crypto','${coin.id}','${coin.name}')">+ Add</button></div>`;
    } catch { res.innerHTML = '<div style="color:var(--red);font-size:12px">Search failed — try again.</div>'; }
    return;
  }

  const sym = (market === 'asx' && !raw.toUpperCase().includes('.')) ? raw.toUpperCase() + '.AX' : raw.toUpperCase();
  const data = await lookupSingleStock(sym);
  if (!data) {
    res.innerHTML = `<div style="color:var(--red);font-size:12px">Symbol not found. ${market === 'asx' ? 'Use format: MIN.AX' : 'Check the ticker is correct.'}</div>`;
    return;
  }
  res.innerHTML = `<div class="add-sym-result">
    <div><div style="font-weight:700">${data.shortName} <span style="color:var(--text3);font-weight:400">${data.symbol}</span></div>
    <div style="font-size:11px;color:var(--text3)">$${fPrice(data.regularMarketPrice)} · ${data.regularMarketChangePercent >= 0 ? '+' : ''}${f2(data.regularMarketChangePercent)}%</div></div>
    <button class="settings-btn" style="margin:0;padding:0 14px" onclick="confirmAddSym('${market}','${data.symbol}','${data.shortName}')">+ Add</button></div>`;
}

function confirmAddSym(market, sym, name) {
  if (getCustomSyms(market).includes(sym)) {
    showToast('INFO', 'Already added', `${name} is already in your list`);
    document.getElementById('addSymModal')?.remove();
    return;
  }
  addCustomSym(market, sym);
  showToast('INFO', '✅ Added', `${name} added`);
  document.getElementById('addSymModal')?.remove();
  if (market === 'us')     fetchUSCustom();
  if (market === 'asx')    fetchASXCustom();
  if (market === 'crypto') fetchCustomCrypto();
}

function removeAndRefresh(market, sym) {
  removeCustomSym(market, sym);
  document.getElementById('addSymModal')?.remove();
  if (market === 'us') {
    TSP.usCustomData = TSP.usCustomData.filter(s => s.symbol !== sym);
    if (typeof renderStocks === 'function') renderStocks('us', TSP.usCustomData, 'usCustomTable');
    const panel = document.getElementById('usCustomPanel');
    if (panel && !TSP.usCustomData.length) panel.style.display = 'none';
  }
  if (market === 'asx') {
    TSP.asxCustomData = TSP.asxCustomData.filter(s => s.symbol !== sym);
    if (typeof renderStocks === 'function') renderStocks('asx', TSP.asxCustomData, 'asxCustomTable');
    const panel = document.getElementById('asxCustomPanel');
    if (panel && !TSP.asxCustomData.length) panel.style.display = 'none';
  }
  if (market === 'crypto') {
    TSP.cryptoData = TSP.cryptoData.filter(c => c.id !== sym);
    if (typeof renderCrypto === 'function') renderCrypto();
  }
  showToast('INFO', 'Removed', `${sym} removed`);
}

// ── GLOBAL STATE ────────────────────────────────────
window.TSP = window.TSP || {
  cryptoData: [],
  usData: [],
  asxData: [],
  usCustomData: [],
  asxCustomData: [],
  audRate: AUD_FALLBACK,
  notifOn: false,
  countdown: REFRESH_SEC,
  prevSigs: {},
  pieChart: null,
  portRowId: 0,
  portfolioCalculated: false,
  _portLoading: false,
  filters: { crypto:'all', us:'all', asx:'all' },
};

// ── FORMAT HELPERS ──────────────────────────────────
function f2(n, d=2) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-AU', { minimumFractionDigits:d, maximumFractionDigits:d });
}

function fPrice(n) {
  if (!n) return '—';
  if (n >= 1000)  return f2(n, 2);
  if (n >= 1)     return f2(n, 3);
  if (n >= 0.01)  return f2(n, 4);
  return f2(n, 6);
}

function fBig(n) {
  if (!n) return '—';
  if (n >= 1e12) return '$' + f2(n/1e12, 2) + 'T';
  if (n >= 1e9)  return '$' + f2(n/1e9,  2) + 'B';
  if (n >= 1e6)  return '$' + f2(n/1e6,  2) + 'M';
  return '$' + f2(n, 0);
}

function gc(v)  { return v >= 0 ? 'g' : 'r'; }
function gs(v)  { return v >= 0 ? '+' : ''; }
function cl(v, a, b) { return Math.max(a, Math.min(b, v)); }

function chgBadge(v) {
  const cls = v > 0.05 ? 'up' : v < -0.05 ? 'down' : 'flat';
  return `<span class="chg ${cls}">${gs(v)}${f2(v)}%</span>`;
}

// ── SPARKLINE SVG ───────────────────────────────────
function sparklineSVG(prices, width=120, height=32) {
  if (!prices || prices.length < 2) return '<svg width="'+width+'" height="'+height+'"></svg>';
  // Downsample to ~60 points for performance
  const step = Math.max(1, Math.floor(prices.length / 60));
  const pts = prices.filter((_, i) => i % step === 0 || i === prices.length - 1);
  const min = Math.min(...pts), max = Math.max(...pts);
  const range = max - min || 1;
  const pad = 2;
  const w = width - pad * 2, h = height - pad * 2;
  const d = pts.map((p, i) => {
    const x = pad + (i / (pts.length - 1)) * w;
    const y = pad + h - ((p - min) / range) * h;
    return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
  const color = pts[pts.length - 1] >= pts[0] ? 'var(--green,#22c55e)' : 'var(--red,#ef4444)';
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block"><path d="${d}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

// ── RSI CALCULATION ─────────────────────────────────
function calcRSI(prices, period=14) {
  if (!prices || prices.length < period+1) return null;
  let g=0, l=0;
  for (let i=1; i<=period; i++) {
    const d = prices[i]-prices[i-1];
    d >= 0 ? g+=d : l-=d;
  }
  let ag=g/period, al=l/period;
  for (let i=period+1; i<prices.length; i++) {
    const d = prices[i]-prices[i-1];
    ag = (ag*(period-1) + Math.max(d,0)) / period;
    al = (al*(period-1) + Math.max(-d,0)) / period;
  }
  return al===0 ? 100 : 100-(100/(1+ag/al));
}

// ── SIGNAL ENGINE ───────────────────────────────────
function getSignal(rsi, c24, c7) {
  const r = rsi ?? 50, c = c24 ?? 0, c7v = c7 ?? 0;
  if (r <= 25)             return { s:'BUY',  why:'RSI Deeply Oversold',       str:3 };
  if (r >= 75)             return { s:'SELL', why:'RSI Deeply Overbought',     str:3 };
  if (r <= 32 && c < -4)  return { s:'BUY',  why:'Oversold + Price Dip',      str:2 };
  if (r >= 68 && c > 4)   return { s:'SELL', why:'Overbought + Price Spike',  str:2 };
  if (r < 40 && c7v < -8) return { s:'BUY',  why:'Weekly Dip Opportunity',    str:2 };
  if (r > 62 && c7v > 10) return { s:'SELL', why:'Weekly Overextension',      str:2 };
  if (r < 45 && c > 1)    return { s:'BUY',  why:'Bouncing from Support',     str:1 };
  if (r > 55 && c < -1)   return { s:'SELL', why:'Fading from Resistance',    str:1 };
  return                         { s:'HOLD', why:'Neutral — No Clear Signal', str:0 };
}

// ── AI SIGNAL ANALYSIS GENERATOR ────────────────────
function generateAnalysis(asset) {
  const { name, type, rsi, c24, c7, signal, price, high52, low52, audPrice } = asset;
  const rangePct = (high52 && low52 && high52 > low52)
    ? ((price - low52) / (high52 - low52) * 100).toFixed(0)
    : null;

  const rsiDesc = rsi < 25 ? 'deeply oversold (below 25)'
    : rsi < 35 ? 'oversold (below 35)'
    : rsi < 45 ? 'approaching oversold territory'
    : rsi > 75 ? 'deeply overbought (above 75)'
    : rsi > 65 ? 'overbought (above 65)'
    : rsi > 55 ? 'elevated, approaching overbought'
    : 'within a neutral range';

  const paragraphs = [];

  if (signal === 'BUY') {
    paragraphs.push(
      `<b>Technical Basis:</b> ${name} is currently exhibiting a ${rsi ? `14-period RSI of ${f2(rsi, 1)}, which is considered ${rsiDesc}.` : 'weakened momentum indicators.'} This level has historically been associated with mean-reversion opportunities, where selling pressure begins to exhaust.`
    );

    if (c24 !== null) {
      if (c24 < -5)
        paragraphs.push(`The ${Math.abs(f2(c24))}% single-session decline may represent a capitulation event — sharp short-term sell-offs in ${type} markets have historically preceded technical bounces, particularly when RSI diverges from price action.`);
      else if (c24 < -2)
        paragraphs.push(`The ${Math.abs(f2(c24))}% pullback, while modest, compounds an already oversold RSI reading. This combination often signals that near-term selling pressure is abating.`);
      else if (c24 > 0)
        paragraphs.push(`Despite a ${f2(c24)}% intraday gain, the RSI remains below key oversold thresholds — suggesting that buying pressure is emerging but the asset has not yet become overbought. This can indicate early-stage recovery momentum.`);
    }

    if (rangePct !== null)
      paragraphs.push(`${name} is currently trading at ${rangePct}% of its 52-week range ($${fPrice(low52)} – $${fPrice(high52)}), positioning it ${rangePct < 30 ? 'near annual lows, which may present an asymmetric risk/reward entry' : rangePct < 50 ? 'in the lower half of its annual range, suggesting room for recovery' : 'in the mid-range, where technical support has historically held'}.`);

    paragraphs.push(`<b>⚠ Risk Factors:</b> Oversold indicators can remain depressed during sustained downtrends. This signal is based on technical analysis only and does not incorporate fundamental data, earnings, or macroeconomic conditions. Always define your stop-loss level before entering any position, and consider position sizing relative to your total portfolio.`);

  } else if (signal === 'SELL') {
    paragraphs.push(
      `<b>Technical Basis:</b> ${name} is currently exhibiting a ${rsi ? `14-period RSI of ${f2(rsi, 1)}, which is ${rsiDesc}.` : 'extended momentum indicators.'} Historically, sustained readings at these levels often precede price consolidation or reversal as profit-taking activity increases.`
    );

    if (c24 !== null && c24 > 3)
      paragraphs.push(`The ${f2(c24)}% single-session advance is notable. Rapid short-term gains of this magnitude in ${type} markets frequently precede a consolidation phase — institutional traders often reduce exposure into strength to lock in returns.`);

    if (c7 !== null && c7 > 8)
      paragraphs.push(`A ${f2(c7)}% advance over the past 7 days indicates an extended rally. Multi-week runs of this scale without meaningful retracement can leave assets vulnerable to sharper corrections once momentum traders begin exiting positions.`);

    if (rangePct !== null)
      paragraphs.push(`Trading at ${rangePct}% of its 52-week range ($${fPrice(low52)} – $${fPrice(high52)}), ${name} is ${rangePct > 80 ? 'approaching annual highs — a zone of historically significant resistance where supply tends to outpace demand' : 'in the upper portion of its annual range, where risk/reward becomes less favourable for new long positions'}.`);

    paragraphs.push(`<b>⚠ Risk Factors:</b> Strong momentum can persist well beyond overbought RSI levels — particularly in trending markets. This signal reflects technical conditions only. A partial reduction in existing positions may be more prudent than a full exit. Consider the broader market trend and your original investment thesis before acting.`);

  } else {
    // HOLD
    paragraphs.push(
      `<b>Technical Basis:</b> ${name} is currently exhibiting a ${rsi ? `14-period RSI of ${f2(rsi, 1)}, which is ${rsiDesc}.` : 'balanced momentum indicators.'} Neither overbought nor oversold conditions are present, suggesting the market has not yet reached a decisive inflection point in either direction.`
    );

    if (c24 !== null) {
      if (Math.abs(c24) < 1)
        paragraphs.push(`The negligible ${f2(c24)}% daily move reinforces the neutral reading — low intraday volatility alongside a mid-range RSI typically indicates a period of consolidation or accumulation before the next directional move.`);
      else if (c24 > 0)
        paragraphs.push(`The ${f2(c24)}% intraday gain adds mild positive bias, but RSI has not yet crossed into buy signal territory. This may be an early sign of building momentum — worth monitoring for confirmation over subsequent sessions.`);
      else
        paragraphs.push(`The ${Math.abs(f2(c24))}% intraday decline adds mild negative bias, though RSI has not reached oversold levels. Sustained weakness without a corresponding RSI dip may indicate gradual distribution rather than capitulation.`);
    }

    if (rangePct !== null)
      paragraphs.push(`${name} is trading at ${rangePct}% of its 52-week range ($${fPrice(low52)} – $${fPrice(high52)}), placing it ${rangePct < 40 ? 'in the lower half of its annual range — closer to support than resistance' : rangePct > 60 ? 'in the upper half of its annual range — approaching areas of historical supply' : 'near the midpoint of its annual range, where neither bulls nor bears have a structural advantage'}.`);

    paragraphs.push(`<b>ℹ️ What to Watch:</b> HOLD signals indicate no strong technical edge at current levels. Key triggers to monitor include an RSI break below 35 (potential BUY setup) or above 65 (potential SELL setup), a meaningful change in daily momentum, or a breakout/breakdown from the current price range. This analysis is based on technical indicators only and does not constitute financial advice.`);
  }

  return paragraphs;
}

// ── FETCH AUD RATE ──────────────────────────────────
async function fetchAUD() {
  try {
    const r = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    const d = await r.json();
    TSP.audRate = d.rates.AUD || AUD_FALLBACK;
  } catch { TSP.audRate = AUD_FALLBACK; }
}

// ── FETCH CRYPTO ────────────────────────────────────
async function fetchCrypto() {
  try {
    const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=15&page=1&sparkline=true&price_change_percentage=24h%2C7d';
    const r = await fetch(url);
    if (!r.ok) throw new Error(r.status);
    TSP.cryptoData = await r.json();
    if (typeof renderCrypto === 'function') renderCrypto();
    if (typeof updateStats === 'function') updateStats();
    if (typeof refreshPortfolioPrices === 'function') refreshPortfolioPrices();
    fetchCustomCrypto(); // load any user-added coins in background
  } catch(e) {
    const el = document.getElementById('cryptoTable');
    if (el) el.innerHTML = '<div class="loading" style="color:var(--red)">⚠ CoinGecko rate limited — retrying on next refresh</div>';
  }
}

async function fetchCustomCrypto() {
  const ids = getCustomSyms('crypto');
  if (!ids.length) return;
  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids.join(',')}&sparkline=true&price_change_percentage=24h%2C7d`,
      { signal: mkTimeout(10000) }
    );
    if (!r.ok) return;
    const coins = await r.json();
    if (!coins?.length) return;
    const newIds = new Set(coins.map(c => c.id));
    TSP.cryptoData = [...TSP.cryptoData.filter(c => !newIds.has(c.id)), ...coins];
    if (typeof renderCrypto === 'function') renderCrypto();
  } catch {}
}

// ── STOCK DATA FETCH LAYER ──────────────────────────
// Primary: FMP (Financial Modeling Prep) — direct CORS, no proxy needed
// Fallback: Yahoo Finance via CORS proxies + Stooq CSV
// Strategy:
//   1. Show cached data instantly (sessionStorage 5 min, localStorage forever)
//   2. FMP batch for all symbols — direct fetch, fast and reliable
//   3. If FMP fails or no key: Yahoo batch → individual gap-fill → Stooq CSV
//   4. Save whatever we get to both caches

function mkTimeout(ms) {
  try { return AbortSignal.timeout(ms); } catch {
    const c = new AbortController();
    setTimeout(() => c.abort(), ms);
    return c.signal;
  }
}

// Normalise into our internal shape (works for FMP, Yahoo, or Stooq data)
function normaliseStock(sym, d) {
  const p = d.price || d.regularMarketPrice;
  if (!p || p <= 0) return null;
  return {
    symbol:                    sym,
    shortName:                 STOCK_NAMES[sym] || d.name || d.shortName || sym,
    regularMarketPrice:        p,
    regularMarketChangePercent: d.changesPercentage ?? d.regularMarketChangePercent ?? 0,
    fiftyTwoWeekHigh:          d.yearHigh  || d.fiftyTwoWeekHigh || p * 1.2,
    fiftyTwoWeekLow:           d.yearLow   || d.fiftyTwoWeekLow  || p * 0.8,
    marketCap:                 d.marketCap || null,
    regularMarketVolume:       d.volume    || d.regularMarketVolume || null,
  };
}

// ── FMP (PRIMARY) ──────────────────────────────────
async function fmpBatch(syms) {
  if (!FMP_KEY) return [];
  const url = `https://financialmodelingprep.com/api/v3/quote/${syms.join(',')}?apikey=${FMP_KEY}`;
  try {
    const r = await fetch(url, { signal: mkTimeout(15000) });
    if (!r.ok) throw new Error(r.status);
    const arr = await r.json();
    if (!Array.isArray(arr) || !arr.length) return [];
    return arr.map(s => normaliseStock(s.symbol, s)).filter(Boolean);
  } catch { return []; }
}

async function fmpSingle(sym) {
  if (!FMP_KEY) return null;
  try {
    const r = await fetch(`https://financialmodelingprep.com/api/v3/quote/${sym}?apikey=${FMP_KEY}`, { signal: mkTimeout(12000) });
    if (!r.ok) return null;
    const arr = await r.json();
    if (!arr?.[0]?.price) return null;
    return normaliseStock(sym, arr[0]);
  } catch { return null; }
}

// ── YAHOO FINANCE (FALLBACK) ───────────────────────
function yhProxies(url) {
  const u2 = url.replace('query1.finance', 'query2.finance');
  return [url, u2].flatMap(u => {
    const e = encodeURIComponent(u);
    return [
      `https://api.allorigins.win/raw?url=${e}`,
      `https://corsproxy.io/?${e}`,
      `https://api.codetabs.com/v1/proxy?quest=${e}`,
      `https://corsproxy.org/?${e}`,
    ];
  });
}
function proxyParse(proxy, response) {
  if (proxy.includes('allorigins.win/get')) return response.json().then(j => JSON.parse(j.contents));
  return response.json();
}

async function yhBatch(syms) {
  const fields = 'regularMarketPrice,regularMarketChangePercent,fiftyTwoWeekHigh,fiftyTwoWeekLow,marketCap,regularMarketVolume,shortName';
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${syms.join(',')}&fields=${fields}`;
  const attempt = async p => {
    const r = await fetch(p, { signal: mkTimeout(15000) });
    if (!r.ok) throw new Error(r.status);
    const d = await proxyParse(p, r);
    const res = d?.quoteResponse?.result;
    if (!res?.length) throw new Error('empty');
    return res.map(s => normaliseStock(s.symbol, { ...s, price: s.regularMarketPrice })).filter(Boolean);
  };
  try { return await Promise.any(yhProxies(url).map(attempt)); } catch { return []; }
}

async function yhSingle(sym) {
  const url7 = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${sym}`;
  const attempt7 = async p => {
    const r = await fetch(p, { signal: mkTimeout(12000) });
    if (!r.ok) throw new Error(r.status);
    const d = await proxyParse(p, r);
    const s = d?.quoteResponse?.result?.[0];
    if (!(s?.regularMarketPrice > 0)) throw new Error('no price');
    return normaliseStock(sym, { ...s, price: s.regularMarketPrice });
  };
  try { return await Promise.any(yhProxies(url7).map(attempt7)); } catch { return null; }
}

// ── STOOQ CSV (FALLBACK) ───────────────────────────
function toStooqSym(sym, market) {
  if (market === 'us')  return sym.toLowerCase() + '.us';
  if (market === 'asx') return sym.toLowerCase().replace('.ax', '.au');
  return sym.toLowerCase();
}
function fromStooqSym(stooqSym, market) {
  const s = stooqSym.trim().toUpperCase();
  if (market === 'us')  return s.replace(/\.US$/, '');
  if (market === 'asx') return s.replace(/\.AU$/, '.AX');
  return s;
}
async function stooqBatch(syms, market) {
  if (!syms.length) return [];
  const ss  = syms.map(s => toStooqSym(s, market)).join(',');
  const url = `https://stooq.com/q/l/?s=${ss}&f=sd2t2ohlcv&h&e=csv`;
  const enc = encodeURIComponent(url);
  const proxies = [
    `https://api.allorigins.win/raw?url=${enc}`,
    `https://corsproxy.io/?${enc}`,
    `https://api.codetabs.com/v1/proxy?quest=${enc}`,
    `https://corsproxy.org/?${enc}`,
  ];
  const attempt = async p => {
    const r = await fetch(p, { signal: mkTimeout(10000) });
    if (!r.ok) throw new Error(r.status);
    const text = await r.text();
    if (!text || text.length < 30) throw new Error('empty');
    const lines = text.trim().split('\n').slice(1);
    return lines.map(line => {
      const cols = line.trim().split(',');
      if (cols.length < 7) return null;
      const [rawSym,,, open,,, close, vol] = cols;
      const price = parseFloat(close), openP = parseFloat(open);
      if (!price || price <= 0 || isNaN(price) || close.trim() === 'N/A') return null;
      const origSym = fromStooqSym(rawSym, market);
      return normaliseStock(origSym, {
        price, regularMarketChangePercent: openP > 0 ? (price - openP) / openP * 100 : 0,
        fiftyTwoWeekHigh: null, fiftyTwoWeekLow: null,
        volume: parseInt(vol) || null,
      });
    }).filter(Boolean);
  };
  try { return await Promise.any(proxies.map(attempt)); } catch { return []; }
}

// ── UNIFIED FETCH: FMP → Yahoo → Stooq ────────────
async function fetchStockData(syms, market) {
  // 1. Try FMP first (direct, fast, reliable)
  let data = await fmpBatch(syms);
  if (data.length >= syms.length * 0.8) return data;

  // 2. Gap-fill with Yahoo for anything FMP missed
  const got1 = new Set(data.map(s => s.symbol));
  const missing1 = syms.filter(s => !got1.has(s));
  if (missing1.length) {
    const yhData = await yhBatch(missing1);
    data = [...data, ...yhData];
  }

  // 3. Individual Yahoo fetch for still-missing symbols
  const got2 = new Set(data.map(s => s.symbol));
  const missing2 = syms.filter(s => !got2.has(s));
  if (missing2.length) {
    const fills = await Promise.all(missing2.map(s => fmpSingle(s) || yhSingle(s)));
    data = [...data, ...fills.filter(Boolean)];
  }

  // 4. Stooq CSV as final fallback
  if (market) {
    const got3 = new Set(data.map(s => s.symbol));
    const missing3 = syms.filter(s => !got3.has(s));
    if (missing3.length) {
      const stooq = await stooqBatch(missing3, market);
      data = [...data, ...stooq];
    }
  }

  return data;
}

// Single stock lookup (for "Add Stock" search) — tries FMP then Yahoo
async function lookupSingleStock(sym) {
  const fmp = await fmpSingle(sym);
  if (fmp) return fmp;
  return await yhSingle(sym);
}

// Helper: save to both caches and render
function yhCommit(dataKey, tableType, tableId, cacheKey, storeKey, data) {
  TSP[dataKey] = data;
  const payload = JSON.stringify({ data, ts: Date.now() });
  try { sessionStorage.setItem(cacheKey, payload); } catch {}
  try { localStorage.setItem(storeKey, payload); } catch {}
  if (typeof renderStocks === 'function') renderStocks(tableType, data, tableId);
  if (typeof updateAlerts === 'function') updateAlerts();
  if (typeof refreshPortfolioPrices === 'function') refreshPortfolioPrices();
}

// ── US STOCKS ────────────────────────────────────────
const US_CACHE_KEY = 'tsp_us_cache';  const US_CACHE_TTL = 5  * 60 * 1000;
const US_STORE_KEY = 'tsp_us_store';  const US_STORE_TTL = 30 * 60 * 1000;

async function fetchUS() {
  try {
    const { data, ts } = JSON.parse(sessionStorage.getItem(US_CACHE_KEY) || '{}');
    if (Date.now() - ts < US_CACHE_TTL && data?.length) {
      yhCommit('usData', 'us', 'usTable', US_CACHE_KEY, US_STORE_KEY, data);
      fetchUSFresh(); fetchUSCustom(); return;
    }
  } catch {}
  try {
    const { data } = JSON.parse(localStorage.getItem(US_STORE_KEY) || '{}');
    if (data?.length) {
      yhCommit('usData', 'us', 'usTable', US_CACHE_KEY, US_STORE_KEY, data);
      fetchUSFresh(); fetchUSCustom(); return;
    }
  } catch {}
  const el = document.getElementById('usTable');
  if (el) el.innerHTML = '<div class="loading"><div class="spinner"></div> Fetching US stock data…</div>';
  await fetchUSFresh(true);
  fetchUSCustom();
}

async function fetchUSFresh(showErrors) {
  const data = await fetchStockData(US_SYMS, 'us');
  if (data.length) {
    yhCommit('usData', 'us', 'usTable', US_CACHE_KEY, US_STORE_KEY, data);
  } else if (showErrors && !TSP.usData.length) {
    const el = document.getElementById('usTable');
    if (el) el.innerHTML = `<div class="loading" style="flex-direction:column;gap:6px;color:var(--amber)">
      <div>⚠ US data unavailable — data sources unavailable. Will retry on next refresh.</div></div>`;
  }
}

async function fetchUSCustom() {
  const syms = getCustomSyms('us');
  const panel = document.getElementById('usCustomPanel');
  if (!syms.length) { if (panel) panel.style.display = 'none'; return; }
  if (panel) panel.style.display = '';
  const cacheKey = 'tsp_us_custom_cache';
  const storeKey = `tsp_us_custom_store_${getSession()?.username||'guest'}`;
  // Show cached data immediately
  const _render = (data) => {
    TSP.usCustomData = data;
    if (panel) panel.style.display = data.length ? '' : 'none';
    if (data.length && typeof renderStocks === 'function') renderStocks('us', data, 'usCustomTable');
  };
  try {
    const { data, ts } = JSON.parse(sessionStorage.getItem(cacheKey) || '{}');
    if (Date.now() - ts < 5*60*1000 && data?.length) { _render(data); fetchUSCustomFresh(syms, cacheKey, storeKey, _render); return; }
  } catch {}
  try {
    const { data } = JSON.parse(localStorage.getItem(storeKey) || '{}');
    if (data?.length) { _render(data); fetchUSCustomFresh(syms, cacheKey, storeKey, _render); return; }
  } catch {}
  const el = document.getElementById('usCustomTable');
  if (el) el.innerHTML = '<div class="loading"><div class="spinner"></div> Loading your stocks…</div>';
  await fetchUSCustomFresh(syms, cacheKey, storeKey, _render);
}
async function fetchUSCustomFresh(syms, cacheKey, storeKey, _render) {
  const data = await fetchStockData(syms, 'us');
  if (!data.length) return;
  const payload = JSON.stringify({ data, ts: Date.now() });
  try { sessionStorage.setItem(cacheKey, payload); } catch {}
  try { localStorage.setItem(storeKey, payload); } catch {}
  _render(data);
}

const fetchAllStocks = fetchUS; // alias for all pages that call fetchAllStocks

// ── ASX STOCKS ───────────────────────────────────────
const ASX_CACHE_KEY = 'tsp_asx_cache';  const ASX_CACHE_TTL = 5  * 60 * 1000;
const ASX_STORE_KEY = 'tsp_asx_store';  const ASX_STORE_TTL = 30 * 60 * 1000;

async function fetchASX() {
  try {
    const { data, ts } = JSON.parse(sessionStorage.getItem(ASX_CACHE_KEY) || '{}');
    if (Date.now() - ts < ASX_CACHE_TTL && data?.length) {
      yhCommit('asxData', 'asx', 'asxTable', ASX_CACHE_KEY, ASX_STORE_KEY, data);
      fetchASXFresh(); fetchASXCustom(); return;
    }
  } catch {}
  try {
    const { data } = JSON.parse(localStorage.getItem(ASX_STORE_KEY) || '{}');
    if (data?.length) {
      yhCommit('asxData', 'asx', 'asxTable', ASX_CACHE_KEY, ASX_STORE_KEY, data);
      fetchASXFresh(); fetchASXCustom(); return;
    }
  } catch {}
  const el = document.getElementById('asxTable');
  if (el) el.innerHTML = '<div class="loading"><div class="spinner"></div> Fetching ASX data…</div>';
  await fetchASXFresh(true);
  fetchASXCustom();
}

async function fetchASXCustom() {
  const syms = getCustomSyms('asx');
  const panel = document.getElementById('asxCustomPanel');
  if (!syms.length) { if (panel) panel.style.display = 'none'; return; }
  if (panel) panel.style.display = '';
  const cacheKey = 'tsp_asx_custom_cache';
  const storeKey = `tsp_asx_custom_store_${getSession()?.username||'guest'}`;
  const _render = (data) => {
    TSP.asxCustomData = data;
    if (panel) panel.style.display = data.length ? '' : 'none';
    if (data.length && typeof renderStocks === 'function') renderStocks('asx', data, 'asxCustomTable');
  };
  try {
    const { data, ts } = JSON.parse(sessionStorage.getItem(cacheKey) || '{}');
    if (Date.now() - ts < 5*60*1000 && data?.length) { _render(data); fetchASXCustomFresh(syms, cacheKey, storeKey, _render); return; }
  } catch {}
  try {
    const { data } = JSON.parse(localStorage.getItem(storeKey) || '{}');
    if (data?.length) { _render(data); fetchASXCustomFresh(syms, cacheKey, storeKey, _render); return; }
  } catch {}
  const el = document.getElementById('asxCustomTable');
  if (el) el.innerHTML = '<div class="loading"><div class="spinner"></div> Loading your stocks…</div>';
  await fetchASXCustomFresh(syms, cacheKey, storeKey, _render);
}
async function fetchASXCustomFresh(syms, cacheKey, storeKey, _render) {
  const data = await fetchStockData(syms, 'asx');
  if (!data.length) return;
  const payload = JSON.stringify({ data, ts: Date.now() });
  try { sessionStorage.setItem(cacheKey, payload); } catch {}
  try { localStorage.setItem(storeKey, payload); } catch {}
  _render(data);
}

async function fetchASXFresh(showErrors) {
  const data = await fetchStockData(ASX_SYMS, 'asx');
  if (data.length) {
    yhCommit('asxData', 'asx', 'asxTable', ASX_CACHE_KEY, ASX_STORE_KEY, data);
  } else if (showErrors && !TSP.asxData.length) {
    const el = document.getElementById('asxTable');
    if (el) el.innerHTML = `<div class="loading" style="flex-direction:column;gap:6px;color:var(--amber)">
      <div>⚠ ASX data unavailable — data sources unavailable. Will retry on next refresh.</div></div>`;
  }
}

// ── RENDER STOCKS (shared between pages) ─────────────
function renderStocks(type, data, elId) {
  if (!data.length) return;

  // Compute all rows first (needed for detectChanges even if no table on this page)
  const allRows = data.map(s => {
    const c24 = s.regularMarketChangePercent || 0;
    const hi = s.fiftyTwoWeekHigh || s.regularMarketPrice;
    const lo = s.fiftyTwoWeekLow  || s.regularMarketPrice;
    const pr = s.regularMarketPrice || 0;
    const range = hi - lo;
    const pos = range > 0 ? ((pr - lo) / range) * 100 : 50;
    const rsi = cl(pos * 0.7 + (c24 > 0 ? 10 : -10) + 15, 5, 95);
    const sig = getSignal(rsi, c24, null);
    const audP = type === 'us' ? pr * TSP.audRate : pr;
    return { ...s, c24, rsi, sig, audP };
  });
  detectChanges(allRows, type); // always run — works on signal history page too

  const el = document.getElementById(elId);
  if (!el) return;

  const filter = TSP.filters[type];
  let rows = allRows;
  if (filter === 'buy')  rows = rows.filter(r => r.sig.s === 'BUY');
  if (filter === 'sell') rows = rows.filter(r => r.sig.s === 'SELL');

  el.innerHTML = `
  <table class="data-tbl">
    <thead><tr>
      <th>Company</th>
      <th class="r">Price</th>
      ${type==='us' ? '<th class="r">AUD</th>' : ''}
      <th class="r">24h</th>
      <th>52-Week Range</th>
      <th>Trend RSI</th>
      <th class="r">Mkt Cap</th>
      <th>Signal</th>
    </tr></thead>
    <tbody>${rows.map(s => {
      const rsiColor = s.rsi < 35 ? 'var(--green)' : s.rsi > 65 ? 'var(--red)' : 'var(--amber)';
      const rangePct = s.fiftyTwoWeekHigh > s.fiftyTwoWeekLow
        ? ((s.regularMarketPrice - s.fiftyTwoWeekLow) / (s.fiftyTwoWeekHigh - s.fiftyTwoWeekLow) * 100).toFixed(0)
        : 50;
      const assetData = {
        name: s.shortName || s.symbol, type: type === 'us' ? 'US Stock' : 'ASX Stock',
        rsi: s.rsi, c24: s.c24, c7: null, signal: s.sig.s, str: s.sig.str,
        price: s.regularMarketPrice, high52: s.fiftyTwoWeekHigh, low52: s.fiftyTwoWeekLow,
        audPrice: s.audP,
      };
      return `<tr onclick="openModal(${JSON.stringify(assetData).replace(/"/g,'&quot;')})">
        <td>
          <div style="display:flex;align-items:center;gap:7px">
            <button class="star-btn ${isWatched(s.symbol)?'active':''}" data-sym="${s.symbol}" onclick="event.stopPropagation();toggleWatchlist('${s.symbol}')" title="${isWatched(s.symbol)?'Remove from watchlist':'Add to watchlist'}">★</button>
            <div><div class="asset-name">${s.shortName || s.symbol}</div><div class="asset-sub">${s.symbol}</div></div>
          </div>
        </td>
        <td class="r mono">$${fPrice(s.regularMarketPrice)}</td>
        ${type==='us' ? `<td class="r mono" style="color:var(--text2)">A$${fPrice(s.audP)}</td>` : ''}
        <td class="r">${chgBadge(s.c24)}</td>
        <td>
          <div style="font-size:10px;color:var(--text3)">${rangePct}% of annual range</div>
          <div style="font-size:10px;color:var(--text3)">$${fPrice(s.fiftyTwoWeekLow)} – $${fPrice(s.fiftyTwoWeekHigh)}</div>
        </td>
        <td>
          <div class="rsi-wrap">
            <span class="rsi-val" style="color:${rsiColor}">${f2(s.rsi,1)}</span>
            <div class="rsi-bar"><div class="rsi-fill" style="width:${cl(s.rsi,0,100)}%;background:${rsiColor}"></div></div>
          </div>
        </td>
        <td class="r mono">${fBig(s.marketCap)}</td>
        <td>
          <span class="signal-badge ${s.sig.s}" onclick="event.stopPropagation();openModal(${JSON.stringify(assetData).replace(/"/g,'&quot;')})">
            ${s.sig.s==='BUY'?'▲':s.sig.s==='SELL'?'▼':'●'} ${s.sig.s}
          </span>
          <div style="font-size:10px;color:var(--text3);margin-top:3px">${s.sig.why}</div>
        </td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}

// ── SIGNAL ANALYSIS MODAL ───────────────────────────
function openModal(asset) {
  const existing = document.getElementById('signalModal');
  if (existing) existing.remove();

  const paragraphs = generateAnalysis(asset);
  const rangePct = (asset.high52 && asset.low52 && asset.high52 > asset.low52)
    ? ((asset.price - asset.low52) / (asset.high52 - asset.low52) * 100).toFixed(0)
    : null;

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.id = 'signalModal';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  modal.innerHTML = `
    <div class="modal">
      <div class="modal-head">
        <div>
          <div class="modal-title">${asset.name}</div>
          <div class="modal-sub">${asset.type} · Technical Signal Analysis</div>
        </div>
        <button class="modal-close" onclick="document.getElementById('signalModal').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div class="signal-header ${asset.signal}">
          <div>
            <div class="sig-type ${asset.signal === 'BUY' ? 'g' : asset.signal === 'SELL' ? 'r' : ''}" style="${asset.signal === 'HOLD' ? 'color:var(--amber)' : ''}">${asset.signal === 'BUY' ? '▲ BUY SIGNAL' : asset.signal === 'SELL' ? '▼ SELL SIGNAL' : '● HOLD — NEUTRAL'}</div>
            <div class="sig-price">$${fPrice(asset.price)}${asset.audPrice && asset.type !== 'ASX Stock' ? ` <span style="font-size:14px;color:var(--text2)">/ A$${fPrice(asset.audPrice)}</span>` : ''}</div>
            <div class="sig-meta">${asset.c24 != null ? `24h: ${chgBadge(asset.c24)}` : ''} ${asset.c7 != null ? `&nbsp;7d: ${chgBadge(asset.c7)}` : ''}</div>
          </div>
        </div>

        <div class="analysis-grid">
          <div class="analysis-stat">
            <div class="as-lbl">RSI (14)</div>
            <div class="as-val" style="color:${asset.rsi < 35 ? 'var(--green)' : asset.rsi > 65 ? 'var(--red)' : 'var(--amber)'}">${asset.rsi ? f2(asset.rsi,1) : '—'}</div>
          </div>
          <div class="analysis-stat">
            <div class="as-lbl">52W Position</div>
            <div class="as-val">${rangePct != null ? rangePct+'%' : '—'}</div>
          </div>
          <div class="analysis-stat">
            <div class="as-lbl">Signal Strength</div>
            <div class="as-val" style="color:${asset.signal==='BUY'?'var(--green)':asset.signal==='SELL'?'var(--red)':'var(--amber)'}">
              ${asset.signal === 'HOLD' ? 'Neutral' : asset.str === 3 ? 'Strong' : asset.str === 2 ? 'Moderate' : 'Weak'}
            </div>
          </div>
        </div>

        <div class="analysis-section">
          <div class="analysis-label">Analysis</div>
          <div class="analysis-text">
            ${paragraphs.slice(0,-1).map(p => `<p>${p}</p>`).join('')}
          </div>
        </div>

        <div class="risk-box" style="${asset.signal==='HOLD'?'border-color:var(--amber);background:rgba(245,158,11,0.08)':''}">
          ${paragraphs[paragraphs.length-1]}
        </div>
      </div>
    </div>`;

  document.body.appendChild(modal);
}

// ── NOTIFICATIONS ────────────────────────────────────
function saveNotifPref(on) {
  const session = getSession();
  if (session) {
    const users = getUsers();
    if (users[session.username]) { users[session.username].notifOn = on; saveUsers(users); }
  }
  localStorage.setItem('tsp_notif', on ? '1' : '0');
}

async function toggleNotifications() {
  const btn = document.getElementById('notifBtn');
  if (!TSP.notifOn) {
    const p = await Notification.requestPermission();
    TSP.notifOn = p === 'granted';
    if (btn) { btn.textContent = TSP.notifOn ? '🔔 Alerts On' : '⚠ Denied'; btn.classList.toggle('active', TSP.notifOn); }
    showToast(TSP.notifOn ? 'INFO' : 'INFO', TSP.notifOn ? '✅ Alerts enabled' : '⚠ Permission denied', TSP.notifOn ? 'Push notifications active' : 'Enable in browser settings');
    saveNotifPref(TSP.notifOn);
  } else {
    TSP.notifOn = false;
    if (btn) { btn.textContent = '🔔 Alerts'; btn.classList.remove('active'); }
    showToast('INFO','Alerts disabled','Push notifications turned off');
    saveNotifPref(false);
  }
}

function detectChanges(rows, market) {
  rows.forEach(r => {
    const key = `${market}-${r.id||r.symbol}`;
    const nw = r.sig?.s || r.s?.s;
    const old = TSP.prevSigs[key];
    if (old && old !== nw && (nw === 'BUY' || nw === 'SELL')) {
      const name = r.name || r.shortName || r.symbol;
      const price = r.current_price || r.regularMarketPrice;
      const why = r.sig?.why || r.s?.why || '';
      showToast(nw, `${nw==='BUY'?'▲ BUY':'▼ SELL'}: ${name}`, `Signal changed · $${fPrice(price)} · ${why}`);
      if (TSP.notifOn && Notification.permission === 'granted')
        new Notification(`${nw}: ${name}`, { body: `$${fPrice(price)} · ${why}` });
      appendSignalLog({ ts: Date.now(), sym: r.symbol||r.id, name, market: market.toUpperCase(), signal: nw, price: price||0, why });
    }
    if (nw) TSP.prevSigs[key] = nw;
  });
}

// ── TOASTS ───────────────────────────────────────────
function showToast(type, title, msg) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<div><div class="toast-title">${title}</div><div class="toast-msg">${msg}</div></div>`;
  const container = document.getElementById('toasts');
  if (container) { container.prepend(el); setTimeout(() => el.remove(), 5500); }
}

// ── TAB SWITCHING ────────────────────────────────────
function switchTab(market, filter, el) {
  TSP.filters[market] = filter;
  el.closest('.tab-group').querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  if (market === 'crypto' && typeof renderCrypto === 'function') renderCrypto();
  else if (market === 'us')  renderStocks('us',  TSP.usData,  'usTable');
  else if (market === 'asx') renderStocks('asx', TSP.asxData, 'asxTable');
}

// ── AUTH ─────────────────────────────────────────────
const DB_KEY = 'tsp_users';
const SES_KEY = 'tsp_session';

async function hashPass(p) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(p));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function getUsers()   { return JSON.parse(localStorage.getItem(DB_KEY) || '{}'); }
function saveUsers(u) { localStorage.setItem(DB_KEY, JSON.stringify(u)); }
function getSession() { return JSON.parse(sessionStorage.getItem(SES_KEY) || 'null'); }
function setSession(u){ sessionStorage.setItem(SES_KEY, JSON.stringify(u)); }

function switchAuthTab(tab) {
  ['login','signup'].forEach(t => {
    document.getElementById(`form_${t}`).style.display = t===tab ? '' : 'none';
    document.getElementById(`tab_${t}`).classList.toggle('active', t===tab);
  });
  ['authErr','authOk'].forEach(id => { const el=document.getElementById(id); if(el){el.style.display='none';} });
}

function showAuthMsg(id, msg) {
  ['authErr','authOk'].forEach(i => { const el=document.getElementById(i); if(el) el.style.display='none'; });
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

async function doSignup() {
  const user = document.getElementById('sUser')?.value.trim().toLowerCase();
  const pass = document.getElementById('sPass')?.value;
  if (!user || user.length < 3) return showAuthMsg('authErr','Username must be at least 3 characters');
  if (!pass || pass.length < 6) return showAuthMsg('authErr','Password must be at least 6 characters');
  const users = getUsers();
  if (users[user]) return showAuthMsg('authErr','Username already taken — sign in instead');
  users[user] = { hash: await hashPass(pass), notifOn: false };
  saveUsers(users);
  showAuthMsg('authOk','Account created — signing you in…');
  setTimeout(() => loginUser(user), 700);
}

async function doLogin() {
  const user = document.getElementById('lUser')?.value.trim().toLowerCase();
  const pass = document.getElementById('lPass')?.value;
  if (!user || !pass) return showAuthMsg('authErr','Enter your username and password');
  const users = getUsers();
  if (!users[user]) return showAuthMsg('authErr','Account not found — create one first');
  if (await hashPass(pass) !== users[user].hash) return showAuthMsg('authErr','Incorrect password');
  loginUser(user);
}

function loginUser(username) {
  setSession({ username });
  localStorage.setItem('tsp_current_user', username);
  const overlay = document.getElementById('loginScreen');
  if (overlay) overlay.style.display = 'none';

  const initials = username.slice(0,2).toUpperCase();
  document.querySelectorAll('.user-avatar').forEach(el => el.textContent = initials);
  document.querySelectorAll('.user-name').forEach(el => el.textContent = username);

  // Restore saved notification preference for this user
  const users = getUsers();
  const userData = users[username];
  const savedNotif = userData?.notifOn ?? (localStorage.getItem('tsp_notif') === '1');
  if (savedNotif && Notification.permission === 'granted') {
    TSP.notifOn = true;
    const btn = document.getElementById('notifBtn');
    if (btn) { btn.textContent = '🔔 Alerts On'; btn.classList.add('active'); }
  }

  if (typeof bootDashboard === 'function') bootDashboard();
}

function doLogout() {
  sessionStorage.removeItem(SES_KEY);
  localStorage.removeItem('tsp_current_user');
  const overlay = document.getElementById('loginScreen');
  if (overlay) overlay.style.display = 'flex';
  ['lUser','lPass'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
}

function initAuth() {
  const session = getSession();
  if (session) {
    const users = getUsers();
    const userData = users[session.username];
    if (userData) { loginUser(session.username); return; }
  }
  const overlay = document.getElementById('loginScreen');
  if (overlay) overlay.style.display = 'flex';
}

// ── SHARED LOGIN HTML ────────────────────────────────
function renderLoginScreen() {
  return `
  <div class="login-screen" id="loginScreen" style="display:none">
    <div class="login-panel">
      <div class="login-mark">TradeSignal<span>Pro</span></div>
      <div class="login-tagline">Professional Market Signal Dashboard · AUS · US · Crypto</div>

      <div class="login-tabs">
        <div class="login-tab active" id="tab_login" onclick="switchAuthTab('login')">Sign In</div>
        <div class="login-tab" id="tab_signup" onclick="switchAuthTab('signup')">Create Account</div>
      </div>

      <div class="auth-msg err" id="authErr"></div>
      <div class="auth-msg ok" id="authOk"></div>

      <div id="form_login">
        <div class="field">
          <label>Username</label>
          <input type="text" id="lUser" placeholder="Your username" autocomplete="username">
        </div>
        <div class="field">
          <label>Password</label>
          <input type="password" id="lPass" placeholder="Your password" autocomplete="current-password" onkeydown="if(event.key==='Enter')doLogin()">
        </div>
        <button class="login-submit" onclick="doLogin()">Sign In</button>
      </div>

      <div id="form_signup" style="display:none">
        <div class="field">
          <label>Username</label>
          <input type="text" id="sUser" placeholder="Choose a username (min 3 chars)">
        </div>
        <div class="field">
          <label>Password</label>
          <input type="password" id="sPass" placeholder="Choose a password (min 6 chars)">
        </div>
        <button class="login-submit" onclick="doSignup()">Create Account</button>
      </div>

      <div class="login-footer">🔒 All data stored locally in your browser · Nothing leaves your device</div>
    </div>
  </div>`;
}

// ── SHARED SIDEBAR HTML ──────────────────────────────
function renderSidebar(activePage) {
  const sections = [
    { label:'Markets', pages:[
      { href:'index.html',     icon:'◈', label:'Overview' },
      { href:'crypto.html',    icon:'₿', label:'Cryptocurrency' },
      { href:'us.html',        icon:'$', label:'US Stocks' },
      { href:'asx.html',       icon:'A', label:'ASX Stocks' },
    ]},
    { label:'Tools', pages:[
      { href:'watchlist.html', icon:'★', label:'Watchlist' },
      { href:'portfolio.html', icon:'◎', label:'Portfolio' },
      { href:'signals.html',   icon:'◉', label:'Signal History' },
      { href:'news.html',      icon:'◫', label:'News Feed' },
    ]},
    { label:'Account', pages:[
      { href:'settings.html',  icon:'⚙', label:'Settings' },
    ]},
  ];
  const nav = sections.map(sec=>`
    <div class="sidebar-section">
      <div class="sidebar-section-label">${sec.label}</div>
      ${sec.pages.map(p=>`
        <a href="${p.href}" class="nav-item ${activePage===p.href?'active':''}">
          <span class="nav-icon">${p.icon}</span>${p.label}
        </a>`).join('')}
    </div>`).join('');
  return `
  <aside class="sidebar">
    <div class="sidebar-logo">
      <div class="sidebar-logo-mark">TradeSignal<span>Pro</span></div>
      <div class="sidebar-logo-sub">Market Signal Dashboard</div>
    </div>
    ${nav}
    <div class="sidebar-bottom">
      <div class="user-item">
        <div class="user-avatar">--</div>
        <div>
          <div class="user-name">—</div>
          <div class="user-role">Trader</div>
        </div>
      </div>
      <button class="theme-toggle" onclick="toggleTheme()" style="width:calc(100% - 36px);margin:0 18px 8px;border-radius:4px;justify-content:flex-start;gap:10px" title="Toggle light/dark">
        <div class="theme-toggle-track"><div class="theme-toggle-thumb"></div></div>
        <span class="theme-label">${(localStorage.getItem('tsp_theme')||'dark') === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
      </button>
      <button class="logout-btn" onclick="doLogout()">Sign Out</button>
    </div>
  </aside>`;
}

// ── THEME TOGGLE ─────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('tsp_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('tsp_theme', next);
  // Update all toggle button labels
  document.querySelectorAll('.theme-label').forEach(el => {
    el.textContent = next === 'dark' ? 'Dark' : 'Light';
  });
}

// Run immediately so there's no flash of wrong theme
initTheme();

// ── SHARED TOPBAR HTML ───────────────────────────────
function renderTopbar(title) {
  return `
  <div class="topbar">
    <div class="topbar-left">
      <div class="page-title">${title}</div>
      <div class="market-status"><div class="status-dot"></div> Live Data</div>
    </div>
    <div class="topbar-right">
      <button class="theme-toggle" onclick="toggleTheme()" title="Toggle light/dark mode">
        <div class="theme-toggle-track"><div class="theme-toggle-thumb"></div></div>
        <span class="theme-label">${(localStorage.getItem('tsp_theme')||'dark') === 'dark' ? 'Dark' : 'Light'}</span>
      </button>
      <button class="topbar-btn" id="notifBtn" onclick="toggleNotifications()">🔔 Alerts</button>
      <button class="topbar-btn" onclick="refreshPage()" id="refreshBtn">⟳ Refresh</button>
      <span class="countdown" id="countdown">60s</span>
    </div>
  </div>`;
}
