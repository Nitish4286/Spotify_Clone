'use strict';

/* ══════════════════════════════════════════════════════
   SPOTIFY CLONE — Full Song Edition
   Uses JioSaavn API for FULL songs (no 30s limit)
   iTunes used only as fallback
   ══════════════════════════════════════════════════════ */

/* ─── API ENDPOINTS ─── */
const SAAVN_SEARCH = 'https://saavn.dev/api/search/songs';
const ITUNES_API   = 'https://itunes.apple.com/search';

/* ══════════════════════════════════════════════════════
   SAAVN — Full length songs
   ══════════════════════════════════════════════════════ */
async function searchSaavn(query, limit = 20) {
  try {
    const res  = await fetch(`${SAAVN_SEARCH}?query=${encodeURIComponent(query)}&limit=${limit}`);
    if (!res.ok) throw new Error('Saavn HTTP ' + res.status);
    const data = await res.json();
    const list = data?.data?.results || [];
    return list.map(saavnToSong).filter(s => s.src);
  } catch (e) {
    console.warn('Saavn failed:', e.message);
    return [];
  }
}

function saavnToSong(t) {
  const urls  = Array.isArray(t.downloadUrl) ? t.downloadUrl : [];
  const best  = urls.find(u => u.quality === '320kbps')
             || urls.find(u => u.quality === '160kbps')
             || urls.find(u => u.quality === '96kbps')
             || urls[urls.length - 1]
             || null;

  const imgs  = Array.isArray(t.image) ? t.image : [];
  const img   = imgs.find(i => i.quality === '500x500')
             || imgs.find(i => i.quality === '150x150')
             || imgs[imgs.length - 1]
             || null;

  const artists = (t.artists?.primary || []).map(a => a.name).join(', ')
               || t.artists?.all?.[0]?.name
               || 'Unknown Artist';

  return {
    id:        'sv_' + t.id,
    title:     t.name         || 'Unknown',
    artist:    artists,
    album:     t.album?.name  || 'Unknown Album',
    cover:     img?.url       || '',
    duration:  t.duration     || 0,
    src:       best?.url      || '',
    quality:   best?.quality  || '',
    source:    'saavn',
    isPreview: false,
  };
}

/* ══════════════════════════════════════════════════════
   iTunes — fallback (30-sec previews)
   ══════════════════════════════════════════════════════ */
async function searchItunes(query, limit = 20) {
  try {
    const res  = await fetch(`${ITUNES_API}?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${limit}`);
    if (!res.ok) throw new Error('iTunes ' + res.status);
    const data = await res.json();
    return (data.results || []).filter(t => t.previewUrl).map(itunesTrackToSong);
  } catch (e) {
    console.warn('iTunes failed:', e.message);
    return [];
  }
}

function itunesTrackToSong(t) {
  return {
    id:        'it_' + t.trackId,
    title:     t.trackName      || 'Unknown',
    artist:    t.artistName     || 'Unknown',
    album:     t.collectionName || 'Unknown',
    cover:     (t.artworkUrl100 || '').replace('100x100','400x400'),
    duration:  Math.round((t.trackTimeMillis || 30000) / 1000),
    src:       t.previewUrl,
    source:    'itunes',
    isPreview: true,
  };
}

/* ══════════════════════════════════════════════════════
   UNIFIED SEARCH — JioSaavn first, iTunes fallback
   ══════════════════════════════════════════════════════ */
async function universalSearch(query, limit = 25) {
  const [saavn, itunes] = await Promise.all([
    searchSaavn(query, limit),
    searchItunes(query, limit),
  ]);

  if (saavn.length) {
    // Prefer Saavn full songs; append any iTunes-only extras
    const seen = new Set(saavn.map(s => s.title.toLowerCase()));
    const extra = itunes.filter(s => !seen.has(s.title.toLowerCase()));
    return [...saavn, ...extra];
  }
  return itunes; // pure iTunes fallback
}

/* ══════════════════════════════════════════════════════
   PLAYER STATE
   ══════════════════════════════════════════════════════ */
const player = {
  currentSong: null, queue: [], currentIndex: 0,
  isPlaying: false, isShuffle: false, repeatMode: 0,
  volume: 0.8, isMuted: false, likedSongs: [],
};
try { player.likedSongs = JSON.parse(localStorage.getItem('liked_songs') || '[]'); } catch {}

const audioEl = document.getElementById('audio-player');
audioEl.volume = player.volume;

/* ─── Utils ─── */
function fmtTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  return `${Math.floor(sec/60)}:${String(Math.floor(sec%60)).padStart(2,'0')}`;
}
function greetingText() {
  const h = new Date().getHours();
  return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
}
function showToast(msg, type='') {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.className = type ? `toast-${type}` : '';
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2800);
}
function isLiked(id) { return player.likedSongs.some(s => s.id === id); }
function saveLiked() { try { localStorage.setItem('liked_songs', JSON.stringify(player.likedSongs)); } catch {} }

/* ─── Views ─── */
const views = {
  home:   document.getElementById('view-home'),
  search: document.getElementById('view-search'),
  liked:  document.getElementById('view-liked'),
};

function switchView(name) {
  Object.values(views).forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  views[name]?.classList.add('active');
  const btn = document.getElementById(`nav-${name}-btn`);
  if (btn) btn.classList.add('active');
  if (name === 'liked') renderLiked();
}

/* ══════════════════════════════════════════════════════
   HOME — Featured Sections
   ══════════════════════════════════════════════════════ */
const HOME_SECTIONS = [
  { title:'🔥 Trending Now',          query:'top hits 2024',         limit:10 },
  { title:'💚 Bollywood Blockbusters', query:'bollywood 2024',        limit:10 },
  { title:'🎤 Hip-Hop & Rap',          query:'hip hop rap 2024',      limit:8  },
  { title:'🌊 Pop Anthems',            query:'pop songs 2024',        limit:8  },
  { title:'🎬 Punjabi Hits',           query:'punjabi 2024',          limit:8  },
  { title:'⚡ Electronic & Dance',     query:'electronic dance 2024', limit:8  },
];

async function renderHome() {
  document.getElementById('greeting-text').textContent = greetingText();
  const container = document.getElementById('home-sections');
  container.innerHTML = `<div class="loading-hero"><div class="spinner"></div><p>Loading music...</p></div>`;

  const sections = [];
  for (const sec of HOME_SECTIONS) {
    const songs = await universalSearch(sec.query, sec.limit);
    if (songs.length) sections.push({ ...sec, songs });
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
      <div class="cards-row"></div>`;
    block.querySelector('.show-all-btn').addEventListener('click', () => {
      globalSearch.value = sec.query; globalClearBtn.style.display = 'flex';
      switchView('search'); doSearch(sec.query);
    });
    const row = block.querySelector('.cards-row');
    sec.songs.forEach(song => row.appendChild(buildSongCard(song, sec.songs)));
    container.appendChild(block);
  });
}

function buildSongCard(song, queue) {
  const card = document.createElement('div');
  card.className = 'music-card';
  card.innerHTML = `
    <div class="card-art-wrap">
      <img src="${song.cover}" alt="${song.title}" loading="lazy" onerror="this.src='assets/cover1.png'"/>
      <div class="card-play-btn">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </div>
      ${song.isPreview ? '<div class="preview-tag">Preview</div>' : '<div class="full-tag">Full</div>'}
    </div>
    <div class="card-title">${song.title}</div>
    <div class="card-subtitle">${song.artist}</div>`;
  card.addEventListener('click', () => playSong(song, queue));
  return card;
}

/* ══════════════════════════════════════════════════════
   GLOBAL SEARCH
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
  if (e.key === 'Enter') { clearTimeout(searchTimeout); const q = globalSearch.value.trim(); if (q) { switchView('search'); doSearch(q); } }
});
globalClearBtn.addEventListener('click', () => {
  globalSearch.value = ''; globalClearBtn.style.display = 'none';
  clearTimeout(searchTimeout); switchView('home'); globalSearch.focus();
});

async function doSearch(query) {
  if (!query) return;
  lastQuery = query;

  document.getElementById('search-state-idle').style.display = 'none';
  document.getElementById('search-loading').style.display = 'flex';
  document.getElementById('search-results').style.display = 'none';
  document.getElementById('search-loading-text').textContent = `Searching for "${query}"...`;

  const songs = await universalSearch(query, 30);
  if (query !== lastQuery) return;

  document.getElementById('search-loading').style.display = 'none';

  if (!songs.length) {
    const idle = document.getElementById('search-state-idle');
    idle.style.display = 'flex';
    idle.querySelector('h2').textContent = 'No results found';
    idle.querySelector('p').textContent  = `Nothing found for "${query}". Try different keywords.`;
    return;
  }

  const full    = songs.filter(s => !s.isPreview).length;
  const preview = songs.filter(s =>  s.isPreview).length;
  const badge   = full && !preview ? '🎵 All Full Songs'
                : full && preview  ? `🎵 ${full} Full · ${preview} Preview`
                : `⏱ ${preview} Preview only`;

  document.getElementById('results-title').textContent = `"${query}"`;
  document.getElementById('results-count').textContent = `${songs.length} songs — ${badge}`;

  const list = document.getElementById('search-results-list');
  list.innerHTML = '';
  songs.forEach((song, idx) => list.appendChild(buildTrackRow(song, idx + 1, songs)));
  document.getElementById('search-results').style.display = 'block';
}

/* ─── Genre sidebar ─── */
document.querySelectorAll('.genre-item').forEach(el => {
  el.addEventListener('click', () => {
    const q = el.dataset.q;
    globalSearch.value = q; globalClearBtn.style.display = 'flex';
    switchView('search'); doSearch(q);
  });
});

/* ══════════════════════════════════════════════════════
   LIKED SONGS
   ══════════════════════════════════════════════════════ */
function renderLiked() {
  const list = document.getElementById('liked-list');
  const empty = document.getElementById('liked-empty');
  document.getElementById('liked-count-text').textContent = `${player.likedSongs.length} songs`;
  if (!player.likedSongs.length) {
    empty.style.display = 'flex'; list.style.display = 'none'; return;
  }
  empty.style.display = 'none'; list.style.display = 'block';
  list.innerHTML = '';
  player.likedSongs.forEach((song, i) => list.appendChild(buildTrackRow(song, i + 1, player.likedSongs)));
}

/* ══════════════════════════════════════════════════════
   TRACK ROW BUILDER
   ══════════════════════════════════════════════════════ */
function buildTrackRow(song, num, songList) {
  const active = player.currentSong?.id === song.id;
  const liked  = isLiked(song.id);
  const row    = document.createElement('div');
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
      <div class="track-thumb-wrap">
        <img src="${song.cover}" alt="${song.title}" loading="lazy" onerror="this.src='assets/cover1.png'"/>
        ${song.isPreview
          ? `<span class="src-dot preview-dot" title="30-sec preview">P</span>`
          : `<span class="src-dot full-dot"    title="Full song">F</span>`}
      </div>
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
  player.currentSong  = song;
  player.queue        = [...queue];
  player.currentIndex = player.queue.findIndex(s => s.id === song.id);
  player.isPlaying    = true;

  audioEl.pause();
  audioEl.src    = song.src;
  audioEl.volume = player.volume;
  audioEl.muted  = player.isMuted;
  audioEl.load();

  audioEl.play().catch(err => {
    console.warn('Playback error:', err);
    showToast('⚠️ Could not play. Trying next song...', 'error');
    player.isPlaying = false;
    updatePlayPauseBtn();
    setTimeout(() => nextSong(), 1200);
  });

  updatePlayerUI(song);
  updateTrackHighlights();
  document.title = `${song.title} — ${song.artist}`;
}

audioEl.addEventListener('ended', () => {
  if (player.repeatMode === 2) { playSong(player.currentSong, player.queue); return; }
  if (player.repeatMode === 1 || player.currentIndex < player.queue.length - 1) { nextSong(); return; }
  player.isPlaying = false; updatePlayPauseBtn();
});

audioEl.addEventListener('timeupdate', () => {
  if (!audioEl.duration || isNaN(audioEl.duration)) return;
  const pct = (audioEl.currentTime / audioEl.duration) * 100;
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-thumb').style.left = pct + '%';
  document.getElementById('current-time').textContent  = fmtTime(audioEl.currentTime);
  document.getElementById('total-time').textContent    = fmtTime(audioEl.duration);
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
  player.isMuted = player.volume === 0; showMuteIcon(player.isMuted);
}
function toggleMute() {
  player.isMuted = !player.isMuted; audioEl.muted = player.isMuted;
  showMuteIcon(player.isMuted);
  const p = player.isMuted ? 0 : player.volume;
  document.getElementById('volume-fill').style.width = (p*100)+'%';
  document.getElementById('volume-thumb').style.left = (p*100)+'%';
}
function showMuteIcon(m) {
  document.getElementById('icon-volume').style.display = m ? 'none'  : 'block';
  document.getElementById('icon-mute').style.display   = m ? 'block' : 'none';
}

/* ─── Like ─── */
function toggleLikeSong(song) {
  if (isLiked(song.id)) {
    player.likedSongs = player.likedSongs.filter(s => s.id !== song.id);
    showToast('Removed from Liked Songs');
  } else {
    player.likedSongs.unshift(song);
    showToast('💚 Saved to Liked Songs', 'success');
  }
  saveLiked();
  const liked = isLiked(song.id);
  document.querySelectorAll(`.like-row-btn[data-id="${song.id}"]`).forEach(b => b.classList.toggle('liked', liked));
  if (player.currentSong?.id === song.id) document.getElementById('player-like-btn').classList.toggle('liked', liked);
  if (views.liked.classList.contains('active')) renderLiked();
}
function toggleCurrentLike() { if (player.currentSong) toggleLikeSong(player.currentSong); }

/* ─── Player UI ─── */
function updatePlayerUI(song) {
  const art = document.getElementById('player-art');
  const ph  = document.getElementById('no-art-placeholder');
  if (song.cover) { art.src = song.cover; art.style.display = 'block'; ph.style.display = 'none'; }
  else            { art.style.display = 'none'; ph.style.display = 'flex'; }
  document.getElementById('player-song-name').textContent   = song.title;
  document.getElementById('player-artist-name').textContent = song.artist;
  document.getElementById('player-like-btn').classList.toggle('liked', isLiked(song.id));

  // Quality / source badge
  const badge = document.getElementById('quality-badge');
  if (badge) {
    if (song.isPreview) { badge.textContent = '⏱ 30s Preview'; badge.className = 'quality-badge preview'; }
    else                { badge.textContent = `🎵 ${song.quality || 'Full Song'}`; badge.className = 'quality-badge full'; }
  }
  updatePlayPauseBtn();
}

function updatePlayPauseBtn() {
  document.getElementById('icon-play').style.display  = player.isPlaying ? 'none'  : 'block';
  document.getElementById('icon-pause').style.display = player.isPlaying ? 'block' : 'none';
}

function updateTrackHighlights() {
  document.querySelectorAll('.track-row').forEach(row => {
    const active = row.dataset.songId === player.currentSong?.id;
    row.classList.toggle('playing', active && player.isPlaying);
    if (active && player.isPlaying) {
      const n = row.querySelector('.track-num');
      if (n) n.innerHTML = `<div class="equalizer"><span></span><span></span><span></span></div><div class="track-row-play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>`;
    }
  });
}

/* ─── Seek bars ─── */
function setupSeek(el, cb) {
  let drag = false;
  const pct = e => Math.max(0, Math.min(1, (e.clientX - el.getBoundingClientRect().left) / el.offsetWidth));
  el.addEventListener('mousedown', e => { drag = true; cb(pct(e)); });
  document.addEventListener('mousemove', e => { if (drag) cb(pct(e)); });
  document.addEventListener('mouseup', () => { drag = false; });
}
setupSeek(document.getElementById('progress-bar'), pct => {
  if (!isNaN(audioEl.duration) && audioEl.duration > 0) audioEl.currentTime = pct * audioEl.duration;
});
setupSeek(document.getElementById('volume-bar'), pct => setVolume(pct));

/* ─── Controls ─── */
document.getElementById('btn-play-pause').addEventListener('click', togglePlayPause);
document.getElementById('btn-next').addEventListener('click', nextSong);
document.getElementById('btn-prev').addEventListener('click', prevSong);
document.getElementById('btn-shuffle').addEventListener('click', toggleShuffle);
document.getElementById('btn-repeat').addEventListener('click', toggleRepeat);
document.getElementById('btn-mute').addEventListener('click', toggleMute);
document.getElementById('player-like-btn').addEventListener('click', toggleCurrentLike);

document.addEventListener('keydown', e => {
  if (['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return;
  if (e.code==='Space')      { e.preventDefault(); togglePlayPause(); }
  if (e.code==='ArrowRight') { e.preventDefault(); nextSong(); }
  if (e.code==='ArrowLeft')  { e.preventDefault(); prevSong(); }
  if (e.code==='KeyS') toggleShuffle();
  if (e.code==='KeyR') toggleRepeat();
  if (e.code==='KeyM') toggleMute();
  if (e.code==='KeyL') toggleCurrentLike();
  if (e.code==='KeyF'||e.code==='Slash') { e.preventDefault(); globalSearch.focus(); globalSearch.select(); }
});

/* ─── Nav ─── */
document.getElementById('nav-home-btn').addEventListener('click',  () => { switchView('home');  globalSearch.value=''; globalClearBtn.style.display='none'; });
document.getElementById('nav-search-btn').addEventListener('click',() => { switchView('search'); globalSearch.focus(); });
document.getElementById('nav-liked-btn').addEventListener('click', () => switchView('liked'));
document.getElementById('nav-home').addEventListener('click',      () => { switchView('home');  globalSearch.value=''; globalClearBtn.style.display='none'; });
document.querySelectorAll('.view-scroll').forEach(el => el.addEventListener('scroll', () => document.getElementById('topbar').classList.toggle('scrolled', el.scrollTop>60)));

/* ─── Init ─── */
document.getElementById('greeting-text').textContent = greetingText();
renderHome();
