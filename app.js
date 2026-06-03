'use strict';

/* ══════════════════════════════════════════════════════
   SPOTIFY CLONE — iTunes API Edition
   Search and play any song in the world (30s previews)
   ══════════════════════════════════════════════════════ */

/* ─── iTunes Search API ─── */
const ITUNES_API = 'https://itunes.apple.com/search';
const CORS_PROXY = 'https://api.allorigins.win/get?url=';

async function searchItunes(query, limit = 25) {
  const url = `${ITUNES_API}?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${limit}&explicit=No`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Network response not ok');
    const data = await res.json();
    return (data.results || []).filter(t => t.previewUrl);
  } catch (err) {
    console.warn('iTunes API error, trying proxy:', err);
    try {
      const proxyUrl = CORS_PROXY + encodeURIComponent(url);
      const res2 = await fetch(proxyUrl);
      const wrapper = await res2.json();
      const data = JSON.parse(wrapper.contents);
      return (data.results || []).filter(t => t.previewUrl);
    } catch (err2) {
      console.error('All fetch attempts failed:', err2);
      return [];
    }
  }
}

function itunesTrackToSong(track) {
  return {
    id: track.trackId,
    title: track.trackName || 'Unknown Title',
    artist: track.artistName || 'Unknown Artist',
    album: track.collectionName || 'Unknown Album',
    cover: (track.artworkUrl100 || '').replace('100x100', '400x400'),
    duration: Math.round((track.trackTimeMillis || 30000) / 1000),
    src: track.previewUrl,
    genre: track.primaryGenreName || '',
    releaseYear: track.releaseDate ? track.releaseDate.slice(0, 4) : '',
  };
}

/* ─── Player State ─── */
const player = {
  currentSong: null,
  queue: [],
  currentIndex: 0,
  isPlaying: false,
  isShuffle: false,
  repeatMode: 0,
  volume: 0.8,
  isMuted: false,
  likedSongs: [],
};

// Load liked songs from localStorage
try { player.likedSongs = JSON.parse(localStorage.getItem('liked_songs') || '[]'); } catch {}

const audioEl = document.getElementById('audio-player');
audioEl.volume = player.volume;

/* ─── Utilities ─── */
function fmtTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
}

function greetingText() {
  const h = new Date().getHours();
  return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
}

function showToast(msg, type = '') {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.className = type ? `toast-${type}` : '';
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 2800);
}

function saveLiked() {
  try { localStorage.setItem('liked_songs', JSON.stringify(player.likedSongs)); } catch {}
}

function isLiked(id) { return player.likedSongs.some(s => s.id === id); }

/* ─── Views ─── */
const viewHome   = document.getElementById('view-home');
const viewSearch = document.getElementById('view-search');
const viewLiked  = document.getElementById('view-liked');

function switchView(name) {
  [viewHome, viewSearch, viewLiked].forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (name === 'home')   { viewHome.classList.add('active');   document.getElementById('nav-home-btn').classList.add('active'); }
  if (name === 'search') { viewSearch.classList.add('active'); document.getElementById('nav-search-btn').classList.add('active'); }
  if (name === 'liked')  { viewLiked.classList.add('active');  document.getElementById('nav-liked-btn').classList.add('active'); renderLiked(); }
}

/* ══════════════════════════════════════════════════════
   HOME VIEW — Featured sections from iTunes
   ══════════════════════════════════════════════════════ */
const HOME_SECTIONS = [
  { title: '🔥 Trending Now',          query: 'top hits 2024',          limit: 10 },
  { title: '💚 Bollywood Hits',         query: 'bollywood 2024',         limit: 8  },
  { title: '🎤 Hip-Hop & Rap',          query: 'hip hop rap 2024',       limit: 8  },
  { title: '🌊 Pop Anthems',            query: 'pop songs 2024',         limit: 8  },
  { title: '⚡ Electronic & Dance',     query: 'electronic dance 2024',  limit: 8  },
  { title: '🎸 Rock Classics',          query: 'rock hits classic',      limit: 8  },
];

async function renderHome() {
  document.getElementById('greeting-text').textContent = greetingText();
  const container = document.getElementById('home-sections');
  container.innerHTML = `<div class="loading-hero"><div class="spinner"></div><p>Loading music from around the world...</p></div>`;

  const sections = [];
  for (const sec of HOME_SECTIONS) {
    const tracks = await searchItunes(sec.query, sec.limit);
    if (tracks.length) sections.push({ ...sec, songs: tracks.map(itunesTrackToSong) });
  }

  container.innerHTML = '';
  sections.forEach(sec => {
    const block = document.createElement('div');
    block.className = 'section-block';
    block.innerHTML = `
      <div class="section-header">
        <h2>${sec.title}</h2>
        <button class="show-all-btn" data-q="${sec.query}">Show all</button>
      </div>
      <div class="cards-row" id="row-${sec.query.replace(/\s+/g, '-')}"></div>`;
    container.appendChild(block);

    block.querySelector('.show-all-btn').addEventListener('click', () => {
      document.getElementById('global-search').value = sec.query;
      doSearch(sec.query);
      switchView('search');
    });

    const row = block.querySelector('.cards-row');
    sec.songs.forEach(song => row.appendChild(buildSongCard(song, sec.songs)));
  });
}

function buildSongCard(song, queue) {
  const card = document.createElement('div');
  card.className = 'music-card';
  const liked = isLiked(song.id);
  card.innerHTML = `
    <div class="card-art-wrap">
      <img src="${song.cover || ''}" alt="${song.title}" loading="lazy" onerror="this.src='assets/cover1.png'" />
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
   GLOBAL SEARCH — Real-time iTunes API
   ══════════════════════════════════════════════════════ */
const globalSearch  = document.getElementById('global-search');
const globalClearBtn = document.getElementById('global-clear-btn');
let searchTimeout = null;
let lastQuery = '';

globalSearch.addEventListener('input', () => {
  const q = globalSearch.value.trim();
  globalClearBtn.style.display = q ? 'flex' : 'none';
  clearTimeout(searchTimeout);
  if (!q) {
    switchView('home');
    return;
  }
  switchView('search');
  // Debounce 500ms so we don't spam the API
  searchTimeout = setTimeout(() => doSearch(q), 500);
});

globalSearch.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    clearTimeout(searchTimeout);
    const q = globalSearch.value.trim();
    if (q) { switchView('search'); doSearch(q); }
  }
});

globalClearBtn.addEventListener('click', () => {
  globalSearch.value = '';
  globalClearBtn.style.display = 'none';
  clearTimeout(searchTimeout);
  switchView('home');
  globalSearch.focus();
});

async function doSearch(query) {
  if (!query) return;
  lastQuery = query;

  const idle    = document.getElementById('search-state-idle');
  const loading = document.getElementById('search-loading');
  const results = document.getElementById('search-results');
  const list    = document.getElementById('search-results-list');

  idle.style.display = 'none';
  loading.style.display = 'flex';
  results.style.display = 'none';
  document.getElementById('search-loading-text').textContent = `Searching for "${query}"...`;

  const tracks = await searchItunes(query, 30);
  if (query !== lastQuery) return; // stale result, discard

  loading.style.display = 'none';

  if (!tracks.length) {
    idle.style.display = 'flex';
    idle.querySelector('h2').textContent = 'No results found';
    idle.querySelector('p').textContent = `We couldn't find anything for "${query}". Try a different search.`;
    return;
  }

  const songs = tracks.map(itunesTrackToSong);
  document.getElementById('results-title').textContent = `Results for "${query}"`;
  document.getElementById('results-count').textContent = `${songs.length} songs`;
  list.innerHTML = '';
  songs.forEach((song, idx) => list.appendChild(buildTrackRow(song, idx + 1, songs)));

  results.style.display = 'block';
}

/* ─── Genre sidebar clicks ─── */
document.querySelectorAll('.genre-item').forEach(item => {
  item.addEventListener('click', () => {
    const q = item.dataset.q;
    globalSearch.value = q;
    globalClearBtn.style.display = 'flex';
    switchView('search');
    doSearch(q);
  });
});

/* ══════════════════════════════════════════════════════
   LIKED SONGS VIEW
   ══════════════════════════════════════════════════════ */
function renderLiked() {
  const list  = document.getElementById('liked-list');
  const empty = document.getElementById('liked-empty');
  document.getElementById('liked-count-text').textContent = `${player.likedSongs.length} songs`;

  if (!player.likedSongs.length) {
    empty.style.display = 'flex';
    list.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  list.style.display = 'block';
  list.innerHTML = '';
  player.likedSongs.forEach((song, idx) => list.appendChild(buildTrackRow(song, idx + 1, player.likedSongs)));
}

/* ══════════════════════════════════════════════════════
   TRACK ROW BUILDER
   ══════════════════════════════════════════════════════ */
function buildTrackRow(song, num, songList) {
  const active = player.currentSong?.id === song.id;
  const liked  = isLiked(song.id);
  const row = document.createElement('div');
  row.className = `track-row${active && player.isPlaying ? ' playing' : ''}`;
  row.dataset.songId = song.id;
  row.innerHTML = `
    <div class="track-num">
      ${active && player.isPlaying
        ? `<div class="equalizer"><span></span><span></span><span></span></div>`
        : `<span>${num}</span>`}
      <div class="track-row-play">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </div>
    </div>
    <div class="track-info">
      <img src="${song.cover || ''}" alt="${song.title}" loading="lazy" onerror="this.src='assets/cover1.png'" />
      <div class="track-meta">
        <div class="track-name">${song.title}</div>
        <div class="track-artist">${song.artist}</div>
      </div>
    </div>
    <div class="track-album">${song.album}</div>
    <div class="track-duration-wrap">
      <button class="like-row-btn ${liked ? 'liked' : ''}" data-id="${song.id}" title="Like">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
      </button>
      <span class="track-duration">${fmtTime(song.duration)}</span>
    </div>`;

  row.addEventListener('click', e => {
    if (e.target.closest('.like-row-btn')) { toggleLikeSong(song); return; }
    playSong(song, songList);
  });
  return row;
}

/* ══════════════════════════════════════════════════════
   PLAYER ENGINE
   ══════════════════════════════════════════════════════ */
function playSong(song, queue = [song]) {
  player.currentSong = song;
  player.queue = [...queue];
  player.currentIndex = player.queue.findIndex(s => s.id === song.id);
  player.isPlaying = true;

  audioEl.pause();
  audioEl.src = song.src;
  audioEl.volume = player.volume;
  audioEl.muted = player.isMuted;

  audioEl.play().catch(err => {
    console.warn('Playback error:', err);
    showToast('⚠️ Could not play this track', 'error');
    player.isPlaying = false;
    updatePlayPauseBtn();
  });

  updatePlayerUI(song);
  updateTrackHighlights();
  document.title = `${song.title} — ${song.artist}`;
}

audioEl.addEventListener('ended', () => {
  if (player.repeatMode === 2) { playSong(player.currentSong, player.queue); return; }
  if (player.repeatMode === 1 || player.currentIndex < player.queue.length - 1) { nextSong(); return; }
  player.isPlaying = false;
  updatePlayPauseBtn();
});

audioEl.addEventListener('timeupdate', () => {
  if (isNaN(audioEl.duration) || !audioEl.duration) return;
  const pct = (audioEl.currentTime / audioEl.duration) * 100;
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-thumb').style.left = pct + '%';
  document.getElementById('current-time').textContent = fmtTime(audioEl.currentTime);
  document.getElementById('total-time').textContent = fmtTime(audioEl.duration);
});

function togglePlayPause() {
  if (!player.currentSong) return;
  player.isPlaying = !player.isPlaying;
  player.isPlaying
    ? audioEl.play().catch(() => { player.isPlaying = false; updatePlayPauseBtn(); })
    : audioEl.pause();
  updatePlayPauseBtn();
}

function nextSong() {
  if (!player.queue.length) return;
  const idx = player.isShuffle
    ? Math.floor(Math.random() * player.queue.length)
    : (player.currentIndex + 1) % player.queue.length;
  playSong(player.queue[idx], player.queue);
}

function prevSong() {
  if (audioEl.currentTime > 3) { audioEl.currentTime = 0; return; }
  if (!player.queue.length) return;
  const idx = player.currentIndex === 0 ? player.queue.length - 1 : player.currentIndex - 1;
  playSong(player.queue[idx], player.queue);
}

function toggleShuffle() {
  player.isShuffle = !player.isShuffle;
  document.getElementById('btn-shuffle').classList.toggle('active', player.isShuffle);
  showToast(player.isShuffle ? '🔀 Shuffle on' : '🔀 Shuffle off');
}

function toggleRepeat() {
  player.repeatMode = (player.repeatMode + 1) % 3;
  document.getElementById('btn-repeat').classList.toggle('active', player.repeatMode > 0);
  showToast(['Repeat off', '🔁 Repeat all', '🔂 Repeat one'][player.repeatMode]);
}

function setVolume(pct) {
  player.volume = Math.max(0, Math.min(1, pct));
  audioEl.volume = player.volume;
  document.getElementById('volume-fill').style.width = (player.volume * 100) + '%';
  document.getElementById('volume-thumb').style.left = (player.volume * 100) + '%';
  if (player.volume === 0) { player.isMuted = true; showMuteIcon(true); }
  else { player.isMuted = false; showMuteIcon(false); }
}

function toggleMute() {
  player.isMuted = !player.isMuted;
  audioEl.muted = player.isMuted;
  showMuteIcon(player.isMuted);
  const pct = player.isMuted ? 0 : player.volume;
  document.getElementById('volume-fill').style.width = (pct * 100) + '%';
  document.getElementById('volume-thumb').style.left = (pct * 100) + '%';
}

function showMuteIcon(m) {
  document.getElementById('icon-volume').style.display = m ? 'none' : 'block';
  document.getElementById('icon-mute').style.display = m ? 'block' : 'none';
}

/* ─── Like a song ─── */
function toggleLikeSong(song) {
  if (isLiked(song.id)) {
    player.likedSongs = player.likedSongs.filter(s => s.id !== song.id);
    showToast('Removed from Liked Songs');
  } else {
    player.likedSongs.unshift(song);
    showToast('💚 Added to Liked Songs', 'success');
  }
  saveLiked();
  updateLikeButtons(song.id);
  if (viewLiked.classList.contains('active')) renderLiked();
}

function toggleCurrentLike() {
  if (!player.currentSong) return;
  toggleLikeSong(player.currentSong);
}

function updateLikeButtons(songId) {
  const liked = isLiked(songId);
  document.querySelectorAll(`.like-row-btn[data-id="${songId}"]`).forEach(btn => btn.classList.toggle('liked', liked));
  if (player.currentSong?.id === songId) {
    document.getElementById('player-like-btn').classList.toggle('liked', liked);
  }
}

/* ─── Player UI ─── */
function updatePlayerUI(song) {
  const artEl = document.getElementById('player-art');
  const placeholder = document.getElementById('no-art-placeholder');
  if (song.cover) {
    artEl.src = song.cover;
    artEl.style.display = 'block';
    placeholder.style.display = 'none';
  } else {
    artEl.style.display = 'none';
    placeholder.style.display = 'flex';
  }
  document.getElementById('player-song-name').textContent = song.title;
  document.getElementById('player-artist-name').textContent = song.artist;
  document.getElementById('player-like-btn').classList.toggle('liked', isLiked(song.id));
  updatePlayPauseBtn();
}

function updatePlayPauseBtn() {
  document.getElementById('icon-play').style.display  = player.isPlaying ? 'none'  : 'block';
  document.getElementById('icon-pause').style.display = player.isPlaying ? 'block' : 'none';
}

function updateTrackHighlights() {
  document.querySelectorAll('.track-row').forEach(row => {
    const active = Number(row.dataset.songId) === player.currentSong?.id;
    row.classList.toggle('playing', active && player.isPlaying);
    const numEl = row.querySelector('.track-num');
    if (numEl && active && player.isPlaying) {
      numEl.innerHTML = `<div class="equalizer"><span></span><span></span><span></span></div><div class="track-row-play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>`;
    }
  });
}

/* ─── Seek bar ─── */
function setupSeek(el, cb) {
  let drag = false;
  const pct = e => Math.max(0, Math.min(1, (e.clientX - el.getBoundingClientRect().left) / el.offsetWidth));
  el.addEventListener('mousedown', e => { drag = true; cb(pct(e)); });
  document.addEventListener('mousemove', e => { if (drag) cb(pct(e)); });
  document.addEventListener('mouseup', () => { drag = false; });
}
setupSeek(document.getElementById('progress-bar'), pct => {
  if (player.currentSong && !isNaN(audioEl.duration)) audioEl.currentTime = pct * audioEl.duration;
});
setupSeek(document.getElementById('volume-bar'), pct => setVolume(pct));

/* ─── Keyboard shortcuts ─── */
document.addEventListener('keydown', e => {
  const tag = document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (e.code === 'Space') { e.preventDefault(); togglePlayPause(); }
  if (e.code === 'ArrowRight') { e.preventDefault(); nextSong(); }
  if (e.code === 'ArrowLeft')  { e.preventDefault(); prevSong(); }
  if (e.code === 'KeyS') toggleShuffle();
  if (e.code === 'KeyR') toggleRepeat();
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'KeyL') toggleCurrentLike();
  if (e.code === 'Slash' || e.code === 'KeyF') {
    e.preventDefault();
    globalSearch.focus();
    globalSearch.select();
  }
});

/* ─── Player controls ─── */
document.getElementById('btn-play-pause').addEventListener('click', togglePlayPause);
document.getElementById('btn-next').addEventListener('click', nextSong);
document.getElementById('btn-prev').addEventListener('click', prevSong);
document.getElementById('btn-shuffle').addEventListener('click', toggleShuffle);
document.getElementById('btn-repeat').addEventListener('click', toggleRepeat);
document.getElementById('btn-mute').addEventListener('click', toggleMute);
document.getElementById('player-like-btn').addEventListener('click', toggleCurrentLike);

/* ─── Nav ─── */
document.getElementById('nav-home-btn').addEventListener('click', () => { switchView('home'); globalSearch.value = ''; globalClearBtn.style.display = 'none'; });
document.getElementById('nav-search-btn').addEventListener('click', () => { switchView('search'); globalSearch.focus(); });
document.getElementById('nav-liked-btn').addEventListener('click', () => switchView('liked'));
document.getElementById('nav-home').addEventListener('click', () => { switchView('home'); globalSearch.value = ''; globalClearBtn.style.display = 'none'; });

/* ─── Scroll effect ─── */
document.querySelectorAll('.view-scroll').forEach(el => {
  el.addEventListener('scroll', () => document.getElementById('topbar').classList.toggle('scrolled', el.scrollTop > 60));
});

/* ══════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════ */
function init() {
  document.getElementById('greeting-text').textContent = greetingText();
  renderHome();
  console.log('%c🎵 Spotify Clone — iTunes API Edition', 'color:#1DB954;font-size:16px;font-weight:bold');
  console.log('%cSearch any song in the world! Keyboard: Space=Play | ←/→=Skip | L=Like | /=Focus Search', 'color:#b3b3b3');
}

init();
