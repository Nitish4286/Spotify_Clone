'use strict';

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   Musify â€” YouTube Full Song Edition v3
   Search: iTunes API
   Video ID: Piped API â†’ Invidious â†’ CORS proxy (YouTube HTML)
   Audio: YouTube IFrame API (full length, no limit)
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

/* â”€â”€â”€ Timeout helper (works in all browsers) â”€â”€â”€ */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]);
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   VIDEO ID LOOKUP â€” 4 methods, most reliable first
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

/* Method 1: Piped API (open-source YT frontend, very reliable) */
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.tokhmi.xyz',
  'https://piped-api.garudalinux.org',
  'https://api.piped.yt',
  'https://watchapi.whatever.social',
];

async function searchPiped(query) {
  for (const base of PIPED_INSTANCES) {
    try {
      const res = await withTimeout(
        fetch(`${base}/search?q=${encodeURIComponent(query)}&filter=music_songs`),
        5000
      );
      if (!res.ok) continue;
      const data = await res.json();
      const items = data.items || [];
      for (const item of items) {
        const m = (item.url || '').match(/[?&]v=([a-zA-Z0-9_-]{11})/);
        if (m) return m[1];
      }
    } catch { continue; }
  }
  return null;
}

/* Method 2: Invidious API */
const INVIDIOUS_INSTANCES = [
  'https://invidious.snopyta.org',
  'https://invidious.kavin.rocks',
  'https://vid.puffyan.us',
  'https://y.com.sb',
  'https://invidious.tiekoetter.com',
  'https://inv.riverside.rocks',
];

async function searchInvidious(query) {
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const res = await withTimeout(
        fetch(`${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video&fields=videoId,title`),
        5000
      );
      if (!res.ok) continue;
      const arr = await res.json();
      if (Array.isArray(arr) && arr[0]?.videoId) return arr[0].videoId;
    } catch { continue; }
  }
  return null;
}

/* Method 3: Parse YouTube HTML via CORS proxies */
async function searchYouTubeProxy(query) {
  const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' full song')}`;
  const PROXIES = [
    async (u) => {
      const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(u)}`);
      const j = await r.json(); return j.contents || '';
    },
    async (u) => {
      const r = await fetch(`https://corsproxy.io/?${encodeURIComponent(u)}`);
      return r.text();
    },
    async (u) => {
      const r = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`);
      return r.text();
    },
  ];

  for (const proxyFn of PROXIES) {
    try {
      const html = await withTimeout(proxyFn(ytUrl), 8000);
      if (!html) continue;
      // Multiple patterns to find video IDs
      const patterns = [
        /"videoId":"([a-zA-Z0-9_-]{11})"/,
        /watch\?v=([a-zA-Z0-9_-]{11})/,
        /"url":"\/watch\?v=([a-zA-Z0-9_-]{11})"/,
      ];
      for (const pat of patterns) {
        const m = html.match(pat);
        if (m && m[1]) return m[1];
      }
    } catch { continue; }
  }
  return null;
}

/* Method 4: YouTube's internal API via proxy */
async function searchYouTubeInternal(query) {
  try {
    const body = JSON.stringify({
      context: { client: { clientName: 'WEB', clientVersion: '2.20240101.00.00' } },
      query: query + ' full song',
    });
    const proxyUrl = `https://api.allorigins.win/post?url=${encodeURIComponent('https://www.youtube.com/youtubei/v1/search?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8')}`;
    const res = await withTimeout(fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }), 8000);
    if (!res.ok) return null;
    const wrapper = await res.json();
    const data = JSON.parse(wrapper.contents || '{}');
    const items = data?.contents?.twoColumnSearchResultsRenderer
                   ?.primaryContents?.sectionListRenderer?.contents?.[0]
                   ?.itemSectionRenderer?.contents || [];
    for (const item of items) {
      const vid = item?.videoRenderer?.videoId;
      if (vid) return vid;
    }
  } catch { /* ignore */ }
  return null;
}

/* Master lookup â€” tries all 4 methods */
async function findVideoId(title, artist) {
  const query = `${title} ${artist}`;

  // Run Piped + Invidious in parallel first (fastest)
  const fast = await Promise.any([
    searchPiped(query),
    searchInvidious(query),
  ]).catch(() => null);
  if (fast) return fast;

  // Sequential slower fallbacks
  const proxy = await searchYouTubeProxy(query);
  if (proxy) return proxy;

  const internal = await searchYouTubeInternal(query);
  if (internal) return internal;

  return null;
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   YouTube IFrame Player
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
let ytPlayer  = null;
let ytReady   = false;
let ytPending = null;
let progressId = null;

window.onYouTubeIframeAPIReady = function () {
  ytPlayer = new YT.Player('yt-player', {
    height: '1', width: '1',
    playerVars: { autoplay: 0, controls: 0, rel: 0, playsinline: 1, enablejsapi: 1 },
    events: {
      onReady:       () => { ytReady = true; if (ytPending) { loadVideo(ytPending); ytPending = null; } },
      onStateChange: onYTState,
      onError:       onYTError,
    },
  });
};

function loadVideo(videoId) {
  if (!ytPlayer || !ytReady) { ytPending = videoId; return; }
  ytPlayer.loadVideoById(videoId);
  ytPlayer.setVolume(Math.round(state.volume * 100));
  if (state.isMuted) ytPlayer.mute(); else ytPlayer.unMute();
}

function onYTState(e) {
  const S = YT.PlayerState;
  if (e.data === S.PLAYING)  { state.isPlaying = true;  updatePlayPauseBtn(); startTick(); }
  if (e.data === S.PAUSED)   { state.isPlaying = false; updatePlayPauseBtn(); stopTick(); }
  if (e.data === S.ENDED)    { state.isPlaying = false; stopTick(); nextSong(); }
}

function onYTError(e) {
  console.warn('YT error:', e.data);
  // If video is unembeddable (code 101/150), try next song
  if (e.data === 101 || e.data === 150) {
    showToast('âš ï¸ Song blocked on this site. Trying nextâ€¦', 'error');
    setTimeout(() => nextSong(), 800);
  } else {
    showToast('âš ï¸ YouTube error. Trying nextâ€¦', 'error');
    setTimeout(() => nextSong(), 800);
  }
}

function startTick() {
  stopTick();
  progressId = setInterval(() => {
    if (!ytPlayer?.getCurrentTime) return;
    const cur   = ytPlayer.getCurrentTime() || 0;
    const total = ytPlayer.getDuration()    || 0;
    if (total > 0) {
      const pct = (cur / total) * 100;
      document.getElementById('progress-fill').style.width = pct + '%';
      document.getElementById('progress-thumb').style.left = pct + '%';
      document.getElementById('current-time').textContent  = fmtTime(cur);
      document.getElementById('total-time').textContent    = fmtTime(total);
    }
  }, 500);
}
function stopTick() { clearInterval(progressId); progressId = null; }

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   iTunes â€” search metadata & cover art
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
async function searchItunes(query, limit = 25) {
  try {
    const res  = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${limit}`);
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    return (data.results || []).map(t => ({
      id:       'it_' + t.trackId,
      title:    t.trackName      || 'Unknown',
      artist:   t.artistName     || 'Unknown',
      album:    t.collectionName || 'Unknown',
      cover:    (t.artworkUrl100 || '').replace('100x100', '400x400'),
      duration: Math.round((t.trackTimeMillis || 0) / 1000),
      preview:  t.previewUrl || '',
    }));
  } catch (e) { console.warn('iTunes:', e); return []; }
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   PLAYER STATE
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
const state = {
  currentSong: null, queue: [], currentIndex: 0,
  isPlaying: false, isShuffle: false, repeatMode: 0,
  volume: 0.8, isMuted: false, likedSongs: [],
};
try { state.likedSongs = JSON.parse(localStorage.getItem('liked_songs') || '[]'); } catch {}

/* â”€â”€â”€ Utils â”€â”€â”€ */
function fmtTime(s) {
  if (!s || isNaN(s)) return '0:00';
  return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
}
function greetingText() {
  const h = new Date().getHours();
  return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
}
function showToast(msg, type='') {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id='toast'; document.body.appendChild(t); }
  t.className = type ? `toast-${type}` : '';
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 3000);
}
function isLiked(id) { return state.likedSongs.some(s => s.id === id); }
function saveLiked() { try { localStorage.setItem('liked_songs', JSON.stringify(state.likedSongs)); } catch {} }
function setBadge(text, type) {
  const b = document.getElementById('quality-badge');
  if (b) { b.textContent = text; b.className = `quality-badge ${type}`; }
}

/* â”€â”€â”€ Views â”€â”€â”€ */
const vHome   = document.getElementById('view-home');
const vSearch = document.getElementById('view-search');
const vLiked  = document.getElementById('view-liked');

function switchView(name) {
  [vHome, vSearch, vLiked].forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  ({ home:vHome, search:vSearch, liked:vLiked })[name]?.classList.add('active');
  const btn = document.getElementById(`nav-${name}-btn`);
  if (btn) btn.classList.add('active');
  if (name === 'liked') renderLiked();
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   HOME
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
const HOME_SECTIONS = [
  { title:'ðŸ”¥ Trending Now',            query:'top hits 2024',          limit:10 },
  { title:'ðŸ’š Bollywood Blockbusters',   query:'bollywood hits 2024',    limit:10 },
  { title:'ðŸŽ¤ Hip-Hop & Rap',            query:'hip hop rap 2024',       limit:8  },
  { title:'ðŸŒŠ Pop Anthems',              query:'pop songs 2024',         limit:8  },
  { title:'ðŸŽ¬ Punjabi Hits',             query:'punjabi songs 2024',     limit:8  },
  { title:'âš¡ Electronic & Dance',       query:'electronic dance 2024',  limit:8  },
];

async function renderHome() {
  document.getElementById('greeting-text').textContent = greetingText();
  const box = document.getElementById('home-sections');
  box.innerHTML = `<div class="loading-hero"><div class="spinner"></div><p>Loading music...</p></div>`;

  const sections = [];
  for (const sec of HOME_SECTIONS) {
    const songs = await searchItunes(sec.query, sec.limit);
    if (songs.length) sections.push({ ...sec, songs });
  }

  box.innerHTML = '';
  sections.forEach(sec => {
    const block = document.createElement('div');
    block.className = 'section-block';
    block.innerHTML = `
      <div class="section-header">
        <h2>${sec.title}</h2>
        <button class="show-all-btn" data-q="${sec.query}">Show all</button>
      </div>
      <div class="cards-row"></div>`;
    block.querySelector('.show-all-btn').addEventListener('click', () => {
      globalSearch.value = sec.query; globalClearBtn.style.display='flex';
      switchView('search'); doSearch(sec.query);
    });
    const row = block.querySelector('.cards-row');
    sec.songs.forEach(song => row.appendChild(buildCard(song, sec.songs)));
    box.appendChild(block);
  });
}

function buildCard(song, queue) {
  const card = document.createElement('div');
  card.className = 'music-card';
  card.innerHTML = `
    <div class="card-art-wrap">
      <img src="${song.cover}" alt="${song.title}" loading="lazy" onerror="this.src='assets/cover1.png'"/>
      <div class="card-play-btn"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>
    </div>
    <div class="card-title">${song.title}</div>
    <div class="card-subtitle">${song.artist}</div>`;
  card.addEventListener('click', () => playSong(song, queue));
  return card;
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   SEARCH
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
const globalSearch   = document.getElementById('global-search');
const globalClearBtn = document.getElementById('global-clear-btn');
let searchTimeout = null, lastQuery = '';

globalSearch.addEventListener('input', () => {
  const q = globalSearch.value.trim();
  globalClearBtn.style.display = q ? 'flex' : 'none';
  clearTimeout(searchTimeout);
  if (!q) { switchView('home'); return; }
  switchView('search');
  searchTimeout = setTimeout(() => doSearch(q), 600);
});
globalSearch.addEventListener('keydown', e => {
  if (e.key==='Enter') { clearTimeout(searchTimeout); const q=globalSearch.value.trim(); if(q){switchView('search');doSearch(q);} }
});
globalClearBtn.addEventListener('click', () => {
  globalSearch.value=''; globalClearBtn.style.display='none';
  clearTimeout(searchTimeout); switchView('home'); globalSearch.focus();
});

async function doSearch(query) {
  if (!query) return;
  lastQuery = query;
  document.getElementById('search-state-idle').style.display = 'none';
  document.getElementById('search-loading').style.display    = 'flex';
  document.getElementById('search-results').style.display    = 'none';
  document.getElementById('search-loading-text').textContent = `Searching "${query}"â€¦`;

  const songs = await searchItunes(query, 30);
  if (query !== lastQuery) return;

  document.getElementById('search-loading').style.display = 'none';

  if (!songs.length) {
    const idle = document.getElementById('search-state-idle');
    idle.style.display='flex';
    idle.querySelector('h2').textContent = 'No results found';
    idle.querySelector('p').textContent  = `Nothing for "${query}". Try different keywords.`;
    return;
  }

  document.getElementById('results-title').textContent = `"${query}"`;
  document.getElementById('results-count').textContent = `${songs.length} songs Â· Full playback`;

  const list = document.getElementById('search-results-list');
  list.innerHTML = '';
  songs.forEach((song, i) => list.appendChild(buildRow(song, i+1, songs)));
  document.getElementById('search-results').style.display = 'block';
}

document.querySelectorAll('.genre-item').forEach(el => {
  el.addEventListener('click', () => {
    const q = el.dataset.q;
    globalSearch.value=q; globalClearBtn.style.display='flex';
    switchView('search'); doSearch(q);
  });
});

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   LIKED
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function renderLiked() {
  const list=document.getElementById('liked-list'), empty=document.getElementById('liked-empty');
  document.getElementById('liked-count-text').textContent=`${state.likedSongs.length} songs`;
  if (!state.likedSongs.length) { empty.style.display='flex'; list.style.display='none'; return; }
  empty.style.display='none'; list.style.display='block'; list.innerHTML='';
  state.likedSongs.forEach((s,i)=>list.appendChild(buildRow(s,i+1,state.likedSongs)));
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   TRACK ROW
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function buildRow(song, num, songList) {
  const active = state.currentSong?.id===song.id, liked=isLiked(song.id);
  const row = document.createElement('div');
  row.className = `track-row${active&&state.isPlaying?' playing':''}`;
  row.dataset.songId = song.id;
  row.innerHTML = `
    <div class="track-num">
      ${active&&state.isPlaying?`<div class="equalizer"><span></span><span></span><span></span></div>`:`<span>${num}</span>`}
      <div class="track-row-play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>
    </div>
    <div class="track-info">
      <img src="${song.cover}" alt="${song.title}" loading="lazy" onerror="this.src='assets/cover1.png'"/>
      <div class="track-meta">
        <div class="track-name">${song.title}</div>
        <div class="track-artist">${song.artist}</div>
      </div>
    </div>
    <div class="track-album">${song.album}</div>
    <div class="track-duration-wrap">
      <button class="like-row-btn${liked?' liked':''}" data-id="${song.id}">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
      </button>
      <span class="track-duration">${fmtTime(song.duration)}</span>
    </div>`;
  row.addEventListener('click', e => {
    if (e.target.closest('.like-row-btn')) { toggleLike(song); return; }
    playSong(song, songList);
  });
  return row;
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   PLAY SONG â€” finds YouTube video ID & plays full song
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
async function playSong(song, queue=[song]) {
  // If same song clicked again, just toggle play/pause
  if (state.currentSong?.id === song.id && ytPlayer && ytReady) {
    togglePlayPause();
    return;
  }

  state.currentSong  = song;
  state.queue        = [...queue];
  state.currentIndex = state.queue.findIndex(s => s.id === song.id);
  state.isPlaying    = true;

  updatePlayerUI(song);
  updateTrackHighlights();
  document.title = `${song.title} â€” ${song.artist}`;
  setBadge('â³ Loadingâ€¦', 'loading');
  updatePlayPauseBtn();

  const videoId = await findVideoId(song.title, song.artist);

  if (videoId) {
    loadVideo(videoId);
    setBadge('â–¶ Full Song', 'full');
    showToast(`â–¶ ${song.title} â€” ${song.artist}`);
  } else {
    // Absolute fallback: iTunes 30s preview
    state.isPlaying = false;
    updatePlayPauseBtn();
    setBadge('âš  Could not load', 'preview');
    showToast('âš ï¸ Song unavailable. Try another.', 'error');
  }
}

/* â”€â”€â”€ Controls â”€â”€â”€ */
function togglePlayPause() {
  if (!state.currentSong || !ytPlayer || !ytReady) return;
  if (state.isPlaying) { ytPlayer.pauseVideo(); state.isPlaying=false; }
  else                 { ytPlayer.playVideo();  state.isPlaying=true;  }
  updatePlayPauseBtn();
}

function nextSong() {
  if (!state.queue.length) return;
  const idx = state.isShuffle
    ? Math.floor(Math.random()*state.queue.length)
    : (state.currentIndex+1) % state.queue.length;
  playSong(state.queue[idx], state.queue);
}

function prevSong() {
  if (ytPlayer&&ytReady&&ytPlayer.getCurrentTime()>3) { ytPlayer.seekTo(0,true); return; }
  if (!state.queue.length) return;
  const idx = state.currentIndex===0?state.queue.length-1:state.currentIndex-1;
  playSong(state.queue[idx], state.queue);
}

function toggleShuffle() {
  state.isShuffle=!state.isShuffle;
  document.getElementById('btn-shuffle').classList.toggle('active',state.isShuffle);
  showToast(state.isShuffle?'ðŸ”€ Shuffle on':'ðŸ”€ Shuffle off');
}

function toggleRepeat() {
  state.repeatMode=(state.repeatMode+1)%3;
  document.getElementById('btn-repeat').classList.toggle('active',state.repeatMode>0);
  showToast(['Repeat off','ðŸ” Repeat all','ðŸ”‚ Repeat one'][state.repeatMode]);
}

function setVolume(pct) {
  state.volume=Math.max(0,Math.min(1,pct));
  if (ytPlayer&&ytReady) ytPlayer.setVolume(Math.round(state.volume*100));
  document.getElementById('volume-fill').style.width=(state.volume*100)+'%';
  document.getElementById('volume-thumb').style.left=(state.volume*100)+'%';
  state.isMuted=state.volume===0; showMuteIcon(state.isMuted);
}

function toggleMute() {
  state.isMuted=!state.isMuted;
  if (ytPlayer&&ytReady) state.isMuted?ytPlayer.mute():ytPlayer.unMute();
  showMuteIcon(state.isMuted);
  const p=state.isMuted?0:state.volume;
  document.getElementById('volume-fill').style.width=(p*100)+'%';
  document.getElementById('volume-thumb').style.left=(p*100)+'%';
}

function showMuteIcon(m) {
  document.getElementById('icon-volume').style.display=m?'none':'block';
  document.getElementById('icon-mute').style.display=m?'block':'none';
}

function toggleLike(song) {
  if (isLiked(song.id)) { state.likedSongs=state.likedSongs.filter(s=>s.id!==song.id); showToast('Removed from Liked Songs'); }
  else                  { state.likedSongs.unshift(song); showToast('ðŸ’š Saved to Liked Songs','success'); }
  saveLiked();
  const liked=isLiked(song.id);
  document.querySelectorAll(`.like-row-btn[data-id="${song.id}"]`).forEach(b=>b.classList.toggle('liked',liked));
  if (state.currentSong?.id===song.id) document.getElementById('player-like-btn').classList.toggle('liked',liked);
  if (vLiked.classList.contains('active')) renderLiked();
}

/* â”€â”€â”€ UI â”€â”€â”€ */
function updatePlayerUI(song) {
  const art=document.getElementById('player-art'), ph=document.getElementById('no-art-ph');
  if (song.cover){art.src=song.cover;art.style.display='block';ph.style.display='none';}
  else{art.style.display='none';ph.style.display='flex';}
  document.getElementById('player-song-name').textContent   = song.title;
  document.getElementById('player-artist-name').textContent = song.artist;
  document.getElementById('player-like-btn').classList.toggle('liked',isLiked(song.id));
  document.getElementById('current-time').textContent = '0:00';
  document.getElementById('total-time').textContent   = fmtTime(song.duration)||'â€“:â€“â€“';
}

function updatePlayPauseBtn() {
  document.getElementById('icon-play').style.display  = state.isPlaying?'none':'block';
  document.getElementById('icon-pause').style.display = state.isPlaying?'block':'none';
}

function updateTrackHighlights() {
  document.querySelectorAll('.track-row').forEach(row=>{
    const active=row.dataset.songId===state.currentSong?.id;
    row.classList.toggle('playing',active&&state.isPlaying);
    if (active&&state.isPlaying){
      const n=row.querySelector('.track-num');
      if(n)n.innerHTML=`<div class="equalizer"><span></span><span></span><span></span></div><div class="track-row-play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>`;
    }
  });
}

/* â”€â”€â”€ Seek bars â”€â”€â”€ */
function setupSeek(el, cb) {
  let drag=false;
  const pct=e=>Math.max(0,Math.min(1,(e.clientX-el.getBoundingClientRect().left)/el.offsetWidth));
  el.addEventListener('mousedown',e=>{drag=true;cb(pct(e));});
  document.addEventListener('mousemove',e=>{if(drag)cb(pct(e));});
  document.addEventListener('mouseup',()=>{drag=false;});
}
setupSeek(document.getElementById('progress-bar'),pct=>{
  if (ytPlayer&&ytReady&&ytPlayer.getDuration()) ytPlayer.seekTo(pct*ytPlayer.getDuration(),true);
});
setupSeek(document.getElementById('volume-bar'),pct=>setVolume(pct));

/* â”€â”€â”€ Keyboard â”€â”€â”€ */
document.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA'].includes(document.activeElement.tagName))return;
  if(e.code==='Space'){e.preventDefault();togglePlayPause();}
  if(e.code==='ArrowRight'){e.preventDefault();nextSong();}
  if(e.code==='ArrowLeft'){e.preventDefault();prevSong();}
  if(e.code==='KeyS')toggleShuffle();
  if(e.code==='KeyR')toggleRepeat();
  if(e.code==='KeyM')toggleMute();
  if(e.code==='KeyL'){if(state.currentSong)toggleLike(state.currentSong);}
  if(e.code==='KeyF'||e.code==='Slash'){e.preventDefault();globalSearch.focus();globalSearch.select();}
});

/* â”€â”€â”€ Controls â”€â”€â”€ */
document.getElementById('btn-play-pause').addEventListener('click',togglePlayPause);
document.getElementById('btn-next').addEventListener('click',nextSong);
document.getElementById('btn-prev').addEventListener('click',prevSong);
document.getElementById('btn-shuffle').addEventListener('click',toggleShuffle);
document.getElementById('btn-repeat').addEventListener('click',toggleRepeat);
document.getElementById('btn-mute').addEventListener('click',toggleMute);
document.getElementById('player-like-btn').addEventListener('click',()=>{if(state.currentSong)toggleLike(state.currentSong);});

/* â”€â”€â”€ Nav â”€â”€â”€ */
document.getElementById('nav-home-btn').addEventListener('click',()=>{switchView('home');globalSearch.value='';globalClearBtn.style.display='none';});
document.getElementById('nav-search-btn').addEventListener('click',()=>{switchView('search');globalSearch.focus();});
document.getElementById('nav-liked-btn').addEventListener('click',()=>switchView('liked'));
document.getElementById('nav-home').addEventListener('click',()=>{switchView('home');globalSearch.value='';globalClearBtn.style.display='none';});
document.querySelectorAll('.view-scroll').forEach(el=>el.addEventListener('scroll',()=>document.getElementById('topbar').classList.toggle('scrolled',el.scrollTop>60)));

/* â”€â”€â”€ Init â”€â”€â”€ */
document.getElementById('greeting-text').textContent = greetingText();
renderHome();

