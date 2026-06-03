'use strict';

/* ══════════════════════════════════════════════════════
   SPOTIFY CLONE — YouTube Full Song Edition
   Audio: YouTube IFrame API  (full songs, no limit)
   Search/Meta: iTunes API    (title, art, duration)
   Video ID lookup: Invidious (open-source YT frontend)
   ══════════════════════════════════════════════════════ */

/* ─── INVIDIOUS INSTANCES (fallback chain) ─── */
const INV = [
  'https://invidious.snopyta.org',
  'https://invidious.kavin.rocks',
  'https://vid.puffyan.us',
  'https://invidious.nerdvpn.de',
  'https://y.com.sb',
  'https://invidious.tiekoetter.com',
];

/* ─── YouTube IFrame player ─── */
let ytPlayer   = null;
let ytReady    = false;
let ytPending  = null;   // { videoId, startSec }
let progressId = null;

window.onYouTubeIframeAPIReady = function () {
  ytPlayer = new YT.Player('yt-player', {
    height: '1', width: '1',
    playerVars: {
      autoplay: 0, controls: 0, rel: 0,
      playsinline: 1, enablejsapi: 1,
      origin: location.origin || 'http://localhost',
    },
    events: {
      onReady:       onYTReady,
      onStateChange: onYTState,
      onError:       onYTError,
    },
  });
};

function onYTReady() {
  ytReady = true;
  if (ytPending) { doLoadVideo(ytPending.videoId, ytPending.startSec); ytPending = null; }
}

function onYTState(e) {
  const S = YT.PlayerState;
  if (e.data === S.PLAYING) {
    state.isPlaying = true;
    updatePlayPauseBtn();
    startProgressTick();
  }
  if (e.data === S.PAUSED) {
    state.isPlaying = false;
    updatePlayPauseBtn();
    stopProgressTick();
  }
  if (e.data === S.ENDED) {
    stopProgressTick();
    state.isPlaying = false;
    nextSong();
  }
  if (e.data === S.BUFFERING) {
    /* optional spinner */
  }
}

function onYTError(e) {
  console.warn('YT error code:', e.data);
  showToast('⚠️ YouTube blocked this video. Trying next…', 'error');
  setTimeout(() => nextSong(), 800);
}

function doLoadVideo(videoId, startSec = 0) {
  if (!ytPlayer || !ytReady) { ytPending = { videoId, startSec }; return; }
  ytPlayer.loadVideoById({ videoId, startSeconds: startSec });
  ytPlayer.setVolume(Math.round(state.volume * 100));
  if (state.isMuted) ytPlayer.mute(); else ytPlayer.unMute();
}

function startProgressTick() {
  stopProgressTick();
  progressId = setInterval(() => {
    if (!ytPlayer || !ytPlayer.getCurrentTime) return;
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
function stopProgressTick() { clearInterval(progressId); progressId = null; }

/* ─── Find YouTube video ID via Invidious ─── */
async function findVideoId(title, artist) {
  const query = `${title} ${artist} official audio`;
  for (const base of INV) {
    try {
      const url = `${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video&fields=videoId,title,author,lengthSeconds`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const arr = await res.json();
      if (Array.isArray(arr) && arr.length) {
        // Pick best match — prefer official / audio results
        const best = arr.find(v => /official|audio|full/i.test(v.title)) || arr[0];
        return best.videoId;
      }
    } catch { continue; }
  }

  // Last fallback: parse YouTube HTML via CORS proxy
  try {
    const ytUrl    = `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' full song')}`;
    const proxy    = `https://api.allorigins.win/get?url=${encodeURIComponent(ytUrl)}`;
    const res      = await fetch(proxy, { signal: AbortSignal.timeout(8000) });
    const wrapper  = await res.json();
    const html     = wrapper.contents || '';
    const match    = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
    if (match) return match[1];
  } catch { /* ignore */ }

  return null;
}

/* ══════════════════════════════════════════════════════
   iTunes — metadata + cover art
   ══════════════════════════════════════════════════════ */
async function searchItunes(query, limit = 25) {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${limit}`;
    const res = await fetch(url);
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
  } catch (e) {
    console.warn('iTunes search error:', e);
    return [];
  }
}

/* ══════════════════════════════════════════════════════
   PLAYER STATE
   ══════════════════════════════════════════════════════ */
const state = {
  currentSong:  null,
  queue:        [],
  currentIndex: 0,
  isPlaying:    false,
  isShuffle:    false,
  repeatMode:   0,
  volume:       0.8,
  isMuted:      false,
  likedSongs:   [],
};
try { state.likedSongs = JSON.parse(localStorage.getItem('liked_songs') || '[]'); } catch {}

/* ─── Utilities ─── */
function fmtTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  return `${Math.floor(sec/60)}:${String(Math.floor(sec%60)).padStart(2,'0')}`;
}
function greetingText() {
  const h = new Date().getHours();
  return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
}
function showToast(msg, type = '') {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id='toast'; document.body.appendChild(t); }
  t.className = type ? `toast-${type}` : '';
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2800);
}
function isLiked(id) { return state.likedSongs.some(s => s.id === id); }
function saveLiked() { try { localStorage.setItem('liked_songs', JSON.stringify(state.likedSongs)); } catch {} }

/* ─── Views ─── */
const vHome   = document.getElementById('view-home');
const vSearch = document.getElementById('view-search');
const vLiked  = document.getElementById('view-liked');

function switchView(name) {
  [vHome, vSearch, vLiked].forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  ({ home: vHome, search: vSearch, liked: vLiked })[name]?.classList.add('active');
  const btn = document.getElementById(`nav-${name}-btn`);
  if (btn) btn.classList.add('active');
  if (name === 'liked') renderLiked();
}

/* ══════════════════════════════════════════════════════
   HOME
   ══════════════════════════════════════════════════════ */
const HOME_SECTIONS = [
  { title: '🔥 Trending Now',           query: 'top hits 2024',           limit: 10 },
  { title: '💚 Bollywood Blockbusters',  query: 'bollywood hits 2024',     limit: 10 },
  { title: '🎤 Hip-Hop & Rap',           query: 'hip hop rap 2024',        limit: 8  },
  { title: '🌊 Pop Anthems',             query: 'pop songs 2024',          limit: 8  },
  { title: '🎬 Punjabi Hits',            query: 'punjabi songs 2024',      limit: 8  },
  { title: '⚡ Electronic & Dance',      query: 'electronic dance 2024',   limit: 8  },
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
      <div class="card-play-btn">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </div>
    </div>
    <div class="card-title">${song.title}</div>
    <div class="card-subtitle">${song.artist}</div>`;
  card.addEventListener('click', () => playSong(song, queue));
  return card;
}

/* ══════════════════════════════════════════════════════
   SEARCH
   ══════════════════════════════════════════════════════ */
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
  if (e.key === 'Enter') { clearTimeout(searchTimeout); const q = globalSearch.value.trim(); if(q){ switchView('search'); doSearch(q); } }
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
  document.getElementById('search-loading-text').textContent = `Searching "${query}"…`;

  const songs = await searchItunes(query, 30);
  if (query !== lastQuery) return;

  document.getElementById('search-loading').style.display = 'none';

  if (!songs.length) {
    const idle = document.getElementById('search-state-idle');
    idle.style.display = 'flex';
    idle.querySelector('h2').textContent = 'No results found';
    idle.querySelector('p').textContent  = `Nothing for "${query}". Try different keywords.`;
    return;
  }

  document.getElementById('results-title').textContent = `"${query}"`;
  document.getElementById('results-count').textContent = `${songs.length} songs · Full playback via YouTube`;

  const list = document.getElementById('search-results-list');
  list.innerHTML = '';
  songs.forEach((song, i) => list.appendChild(buildRow(song, i+1, songs)));
  document.getElementById('search-results').style.display = 'block';
}

/* ─── Genre items ─── */
document.querySelectorAll('.genre-item').forEach(el => {
  el.addEventListener('click', () => {
    const q = el.dataset.q;
    globalSearch.value = q; globalClearBtn.style.display='flex';
    switchView('search'); doSearch(q);
  });
});

/* ══════════════════════════════════════════════════════
   LIKED SONGS
   ══════════════════════════════════════════════════════ */
function renderLiked() {
  const list  = document.getElementById('liked-list');
  const empty = document.getElementById('liked-empty');
  document.getElementById('liked-count-text').textContent = `${state.likedSongs.length} songs`;
  if (!state.likedSongs.length) { empty.style.display='flex'; list.style.display='none'; return; }
  empty.style.display='none'; list.style.display='block';
  list.innerHTML='';
  state.likedSongs.forEach((s,i)=>list.appendChild(buildRow(s,i+1,state.likedSongs)));
}

/* ══════════════════════════════════════════════════════
   TRACK ROW
   ══════════════════════════════════════════════════════ */
function buildRow(song, num, songList) {
  const active = state.currentSong?.id === song.id;
  const liked  = isLiked(song.id);
  const row    = document.createElement('div');
  row.className = `track-row${active && state.isPlaying ? ' playing' : ''}`;
  row.dataset.songId = song.id;
  row.innerHTML = `
    <div class="track-num">
      ${active && state.isPlaying
        ? `<div class="equalizer"><span></span><span></span><span></span></div>`
        : `<span>${num}</span>`}
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

/* ══════════════════════════════════════════════════════
   PLAY SONG — via YouTube (full length!)
   ══════════════════════════════════════════════════════ */
async function playSong(song, queue = [song]) {
  state.currentSong  = song;
  state.queue        = [...queue];
  state.currentIndex = state.queue.findIndex(s => s.id === song.id);
  state.isPlaying    = true;

  updatePlayerUI(song, true); // true = loading state
  updateTrackHighlights();
  document.title = `${song.title} — ${song.artist}`;

  // Set badge to loading
  setBadge('⏳ Loading full song…', 'loading');

  // Look up YouTube video ID
  const videoId = await findVideoId(song.title, song.artist);

  if (videoId) {
    doLoadVideo(videoId);
    setBadge('▶ Full Song (YouTube)', 'full');
    showToast(`▶ Playing: ${song.title}`);
  } else {
    // Absolute last resort: play iTunes 30s preview if available
    setBadge('⏱ Preview only', 'preview');
    showToast('⚠️ Full song unavailable. Playing preview.', 'error');
    if (song.preview) {
      const audio = document.createElement('audio');
      audio.src = song.preview;
      audio.volume = state.volume;
      audio.play().catch(()=>{});
      audio.onended = () => nextSong();
      state._fallbackAudio = audio;
    }
  }
}

function setBadge(text, type) {
  const b = document.getElementById('quality-badge');
  if (!b) return;
  b.textContent = text;
  b.className   = `quality-badge ${type}`;
}

/* ─── Controls ─── */
function togglePlayPause() {
  if (!state.currentSong) return;
  if (!ytPlayer || !ytReady) return;
  state.isPlaying ? ytPlayer.pauseVideo() : ytPlayer.playVideo();
  state.isPlaying = !state.isPlaying;
  updatePlayPauseBtn();
}

function nextSong() {
  if (!state.queue.length) return;
  const idx = state.isShuffle
    ? Math.floor(Math.random() * state.queue.length)
    : (state.currentIndex + 1) % state.queue.length;
  playSong(state.queue[idx], state.queue);
}

function prevSong() {
  if (ytPlayer && ytReady && ytPlayer.getCurrentTime() > 3) { ytPlayer.seekTo(0); return; }
  if (!state.queue.length) return;
  const idx = state.currentIndex === 0 ? state.queue.length - 1 : state.currentIndex - 1;
  playSong(state.queue[idx], state.queue);
}

function toggleShuffle() {
  state.isShuffle = !state.isShuffle;
  document.getElementById('btn-shuffle').classList.toggle('active', state.isShuffle);
  showToast(state.isShuffle ? '🔀 Shuffle on' : '🔀 Shuffle off');
}

function toggleRepeat() {
  state.repeatMode = (state.repeatMode + 1) % 3;
  document.getElementById('btn-repeat').classList.toggle('active', state.repeatMode > 0);
  showToast(['Repeat off','🔁 Repeat all','🔂 Repeat one'][state.repeatMode]);
}

function setVolume(pct) {
  state.volume = Math.max(0, Math.min(1, pct));
  if (ytPlayer && ytReady) ytPlayer.setVolume(Math.round(state.volume * 100));
  document.getElementById('volume-fill').style.width = (state.volume*100)+'%';
  document.getElementById('volume-thumb').style.left = (state.volume*100)+'%';
  state.isMuted = state.volume === 0; showMuteIcon(state.isMuted);
}

function toggleMute() {
  state.isMuted = !state.isMuted;
  if (ytPlayer && ytReady) state.isMuted ? ytPlayer.mute() : ytPlayer.unMute();
  showMuteIcon(state.isMuted);
  const p = state.isMuted ? 0 : state.volume;
  document.getElementById('volume-fill').style.width = (p*100)+'%';
  document.getElementById('volume-thumb').style.left = (p*100)+'%';
}

function showMuteIcon(m) {
  document.getElementById('icon-volume').style.display = m ? 'none'  : 'block';
  document.getElementById('icon-mute').style.display   = m ? 'block' : 'none';
}

/* ─── Like ─── */
function toggleLike(song) {
  if (isLiked(song.id)) {
    state.likedSongs = state.likedSongs.filter(s => s.id !== song.id);
    showToast('Removed from Liked Songs');
  } else {
    state.likedSongs.unshift(song);
    showToast('💚 Saved to Liked Songs', 'success');
  }
  saveLiked();
  const liked = isLiked(song.id);
  document.querySelectorAll(`.like-row-btn[data-id="${song.id}"]`).forEach(b=>b.classList.toggle('liked',liked));
  if (state.currentSong?.id===song.id) document.getElementById('player-like-btn').classList.toggle('liked',liked);
  if (vLiked.classList.contains('active')) renderLiked();
}

/* ─── Player UI ─── */
function updatePlayerUI(song, loading=false) {
  const art = document.getElementById('player-art');
  const ph  = document.getElementById('no-art-ph');
  if (song.cover) { art.src=song.cover; art.style.display='block'; ph.style.display='none'; }
  else            { art.style.display='none'; ph.style.display='flex'; }
  document.getElementById('player-song-name').textContent   = song.title;
  document.getElementById('player-artist-name').textContent = song.artist;
  document.getElementById('player-like-btn').classList.toggle('liked', isLiked(song.id));
  if (loading) {
    document.getElementById('current-time').textContent = '0:00';
    document.getElementById('total-time').textContent   = fmtTime(song.duration) || '–:––';
  }
  updatePlayPauseBtn();
}

function updatePlayPauseBtn() {
  document.getElementById('icon-play').style.display  = state.isPlaying ? 'none'  : 'block';
  document.getElementById('icon-pause').style.display = state.isPlaying ? 'block' : 'none';
}

function updateTrackHighlights() {
  document.querySelectorAll('.track-row').forEach(row => {
    const active = row.dataset.songId === state.currentSong?.id;
    row.classList.toggle('playing', active && state.isPlaying);
    if (active && state.isPlaying) {
      const n = row.querySelector('.track-num');
      if (n) n.innerHTML=`<div class="equalizer"><span></span><span></span><span></span></div><div class="track-row-play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>`;
    }
  });
}

/* ─── Seek bars ─── */
function setupSeek(el, cb) {
  let drag = false;
  const pct = e => Math.max(0,Math.min(1,(e.clientX-el.getBoundingClientRect().left)/el.offsetWidth));
  el.addEventListener('mousedown', e => { drag=true; cb(pct(e)); });
  document.addEventListener('mousemove', e => { if(drag) cb(pct(e)); });
  document.addEventListener('mouseup', () => { drag=false; });
}
setupSeek(document.getElementById('progress-bar'), pct => {
  if (ytPlayer && ytReady && ytPlayer.getDuration()) ytPlayer.seekTo(pct * ytPlayer.getDuration(), true);
});
setupSeek(document.getElementById('volume-bar'), pct => setVolume(pct));

/* ─── Keyboard shortcuts ─── */
document.addEventListener('keydown', e => {
  if (['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return;
  if (e.code==='Space')      { e.preventDefault(); togglePlayPause(); }
  if (e.code==='ArrowRight') { e.preventDefault(); nextSong(); }
  if (e.code==='ArrowLeft')  { e.preventDefault(); prevSong(); }
  if (e.code==='KeyS') toggleShuffle();
  if (e.code==='KeyR') toggleRepeat();
  if (e.code==='KeyM') toggleMute();
  if (e.code==='KeyL') { if(state.currentSong) toggleLike(state.currentSong); }
  if (e.code==='KeyF'||e.code==='Slash') { e.preventDefault(); globalSearch.focus(); globalSearch.select(); }
});

/* ─── Buttons ─── */
document.getElementById('btn-play-pause').addEventListener('click', togglePlayPause);
document.getElementById('btn-next').addEventListener('click', nextSong);
document.getElementById('btn-prev').addEventListener('click', prevSong);
document.getElementById('btn-shuffle').addEventListener('click', toggleShuffle);
document.getElementById('btn-repeat').addEventListener('click', toggleRepeat);
document.getElementById('btn-mute').addEventListener('click', toggleMute);
document.getElementById('player-like-btn').addEventListener('click', () => { if(state.currentSong) toggleLike(state.currentSong); });

/* ─── Nav ─── */
document.getElementById('nav-home-btn').addEventListener('click',  () => { switchView('home');  globalSearch.value=''; globalClearBtn.style.display='none'; });
document.getElementById('nav-search-btn').addEventListener('click',() => { switchView('search'); globalSearch.focus(); });
document.getElementById('nav-liked-btn').addEventListener('click', () => switchView('liked'));
document.getElementById('nav-home').addEventListener('click',      () => { switchView('home');  globalSearch.value=''; globalClearBtn.style.display='none'; });
document.querySelectorAll('.view-scroll').forEach(el => el.addEventListener('scroll', () => document.getElementById('topbar').classList.toggle('scrolled', el.scrollTop>60)));

/* ─── Init ─── */
document.getElementById('greeting-text').textContent = greetingText();
renderHome();
