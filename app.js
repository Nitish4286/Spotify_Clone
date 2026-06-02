/* ================================================================
   SPOTIFY CLONE — app.js
   Full SPA Logic: Data, Player, Router, UI
   ================================================================ */

'use strict';

/* ══════════════════════════════════════════════════════
   1. DATA STORE
   ══════════════════════════════════════════════════════ */
const COVERS = {
  c1: 'assets/cover1.png',
  c2: 'assets/cover2.png',
  c3: 'assets/cover3.png',
  c4: 'assets/cover4.png',
  c5: 'assets/cover5.png',
};

const SONGS = [
  { id: 1,  title: 'Neon Dreams',         artist: 'The Synthwave Collective', album: 'Electric Nights',    cover: COVERS.c1, duration: 214, src: null },
  { id: 2,  title: 'Midnight Run',         artist: 'Luna Beats',               album: 'Midnight Pulse',     cover: COVERS.c2, duration: 187, src: null },
  { id: 3,  title: 'Aqua Horizon',         artist: 'Ocean Mind',               album: 'Deep Blue',          cover: COVERS.c3, duration: 242, src: null },
  { id: 4,  title: 'Forest Walk',          artist: 'Echo Verde',               album: 'Nature Tones',       cover: COVERS.c4, duration: 198, src: null },
  { id: 5,  title: 'Crimson Petals',       artist: 'Rose Canvas',              album: 'Bloom',              cover: COVERS.c5, duration: 223, src: null },
  { id: 6,  title: 'Galactic Drift',       artist: 'The Synthwave Collective', album: 'Electric Nights',    cover: COVERS.c1, duration: 259, src: null },
  { id: 7,  title: 'Amber Glow',           artist: 'Luna Beats',               album: 'Midnight Pulse',     cover: COVERS.c2, duration: 175, src: null },
  { id: 8,  title: 'Crystal Cave',         artist: 'Ocean Mind',               album: 'Deep Blue',          cover: COVERS.c3, duration: 310, src: null },
  { id: 9,  title: 'Verdant Path',         artist: 'Echo Verde',               album: 'Nature Tones',       cover: COVERS.c4, duration: 207, src: null },
  { id: 10, title: 'Velvet Twilight',      artist: 'Rose Canvas',              album: 'Bloom',              cover: COVERS.c5, duration: 230, src: null },
  { id: 11, title: 'Pulse & Static',       artist: 'The Synthwave Collective', album: 'Electric Nights',    cover: COVERS.c1, duration: 195, src: null },
  { id: 12, title: 'Solar Flare',          artist: 'Luna Beats',               album: 'Midnight Pulse',     cover: COVERS.c2, duration: 268, src: null },
  { id: 13, title: 'Tidal Wave',           artist: 'Ocean Mind',               album: 'Deep Blue',          cover: COVERS.c3, duration: 184, src: null },
  { id: 14, title: 'Mossy Stone',          artist: 'Echo Verde',               album: 'Nature Tones',       cover: COVERS.c4, duration: 215, src: null },
  { id: 15, title: 'Blossom Rain',         artist: 'Rose Canvas',              album: 'Bloom',              cover: COVERS.c5, duration: 190, src: null },
];

const PLAYLISTS = [
  { id: 'pl1', name: 'Electric Nights',    cover: COVERS.c1, desc: 'Synthwave and neon vibes',       songs: [1,6,11,2,7] },
  { id: 'pl2', name: 'Midnight Pulse',     cover: COVERS.c2, desc: 'Late night beats to vibe to',   songs: [2,7,12,3,8] },
  { id: 'pl3', name: 'Deep Blue',          cover: COVERS.c3, desc: 'Underwater ambient chill',       songs: [3,8,13,4,9] },
  { id: 'pl4', name: 'Nature Tones',       cover: COVERS.c4, desc: 'Earthy organic sounds',          songs: [4,9,14,5,10] },
  { id: 'pl5', name: 'Bloom',              cover: COVERS.c5, desc: 'Soft melodies and dream pop',    songs: [5,10,15,1,6] },
];

const CATEGORIES = [
  { name: 'Pop',        color: '#e91e63' },
  { name: 'Hip-Hop',    color: '#9c27b0' },
  { name: 'Electronic', color: '#3f51b5' },
  { name: 'Rock',       color: '#f44336' },
  { name: 'Jazz',       color: '#ff9800' },
  { name: 'R&B',        color: '#009688' },
  { name: 'Classical',  color: '#795548' },
  { name: 'Country',    color: '#8bc34a' },
  { name: 'Podcasts',   color: '#00bcd4' },
  { name: 'Chill',      color: '#607d8b' },
  { name: 'Party',      color: '#ff5722' },
  { name: 'Workout',    color: '#cddc39' },
];

/* ══════════════════════════════════════════════════════
   2. PLAYER STATE
   ══════════════════════════════════════════════════════ */
const player = {
  currentSong: SONGS[0],
  currentIndex: 0,
  queue: [...SONGS],
  isPlaying: false,
  isShuffle: false,
  repeatMode: 0, // 0=off 1=all 2=one
  volume: 0.7,
  isMuted: false,
  likedSongs: new Set(),
  currentPlaylistId: null,
};

const audioEl = document.getElementById('audio-player');
let progressInterval = null;

/* ══════════════════════════════════════════════════════
   3. UTILITY HELPERS
   ══════════════════════════════════════════════════════ */
function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function getSong(id) {
  return SONGS.find(s => s.id === id);
}

function getPlaylist(id) {
  return PLAYLISTS.find(p => p.id === id);
}

function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2200);
}

function greetingText() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

/* ══════════════════════════════════════════════════════
   4. ROUTER (SPA)
   ══════════════════════════════════════════════════════ */
const views = {
  home:     document.getElementById('view-home'),
  search:   document.getElementById('view-search'),
  library:  document.getElementById('view-library'),
  playlist: document.getElementById('view-playlist'),
};

const navBtns = document.querySelectorAll('.nav-btn');
let currentView = 'home';

function switchView(name, data = null) {
  // Hide all views
  Object.values(views).forEach(v => v.classList.remove('active'));
  navBtns.forEach(b => b.classList.remove('active'));

  // Show selected view
  if (views[name]) {
    views[name].classList.add('active');
    currentView = name;
  }

  // Highlight sidebar button
  const btn = document.getElementById(`nav-${name}-btn`);
  if (btn) btn.classList.add('active');

  // Render content for the view
  if (name === 'home')     renderHome();
  if (name === 'search')   renderSearch();
  if (name === 'library')  renderLibrary();
  if (name === 'playlist' && data) renderPlaylist(data);

  // Update topbar gradient for playlist
  updateTopbarForView(name);
}

function updateTopbarForView(name) {
  const topbar = document.getElementById('topbar');
  topbar.style.background = 'transparent';
}

/* ══════════════════════════════════════════════════════
   5. HOME VIEW
   ══════════════════════════════════════════════════════ */
function renderHome() {
  // Greeting
  document.getElementById('greeting-text').textContent = greetingText();

  // Quick picks (first 6 playlists / songs)
  const qpGrid = document.getElementById('quick-picks-grid');
  qpGrid.innerHTML = '';
  PLAYLISTS.slice(0, 6).forEach(pl => {
    const item = document.createElement('div');
    item.className = 'quick-pick-item';
    item.innerHTML = `
      <img src="${pl.cover}" alt="${pl.name}" />
      <span>${pl.name}</span>
      <div class="quick-pick-play">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </div>
    `;
    item.addEventListener('click', () => switchView('playlist', pl));
    qpGrid.appendChild(item);
  });

  // Recently Played
  renderCardRow('recently-played-row', SONGS.slice(0, 6).map(s => ({
    title: s.title, subtitle: s.artist, cover: s.cover, song: s
  })));

  // Top Mixes
  renderCardRow('top-mixes-row', PLAYLISTS.map(pl => ({
    title: pl.name, subtitle: pl.desc, cover: pl.cover, playlist: pl
  })));

  // Featured Charts
  renderCardRow('featured-charts-row', SONGS.slice(5, 11).map(s => ({
    title: s.title, subtitle: s.artist, cover: s.cover, song: s
  })));
}

function renderCardRow(containerId, items) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'music-card';
    card.innerHTML = `
      <div class="card-art-wrap">
        <img src="${item.cover}" alt="${item.title}" loading="lazy" />
        <div class="card-play-btn">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </div>
      </div>
      <div class="card-title">${item.title}</div>
      <div class="card-subtitle">${item.subtitle}</div>
    `;
    card.addEventListener('click', (e) => {
      if (item.playlist) {
        switchView('playlist', item.playlist);
      } else if (item.song) {
        playSong(item.song, SONGS);
      }
    });
    container.appendChild(card);
  });
}

/* ══════════════════════════════════════════════════════
   6. SEARCH VIEW
   ══════════════════════════════════════════════════════ */
function renderSearch() {
  // Categories
  const grid = document.getElementById('category-grid');
  if (grid && !grid.children.length) {
    CATEGORIES.forEach(cat => {
      const card = document.createElement('div');
      card.className = 'category-card';
      card.style.background = `linear-gradient(135deg, ${cat.color}dd, ${cat.color}88)`;
      card.innerHTML = `<span>${cat.name}</span>`;
      card.addEventListener('click', () => {
        document.getElementById('search-input').value = cat.name;
        handleSearch(cat.name);
      });
      grid.appendChild(card);
    });
  }
}

const searchInput = document.getElementById('search-input');
const clearBtn = document.getElementById('clear-search-btn');
const resultsSection = document.getElementById('search-results-section');
const browseSection = document.getElementById('browse-categories-section');
const resultsList = document.getElementById('search-results-list');

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  clearBtn.style.display = q ? 'flex' : 'none';
  handleSearch(q);
});

clearBtn.addEventListener('click', () => {
  searchInput.value = '';
  clearBtn.style.display = 'none';
  resultsSection.style.display = 'none';
  browseSection.style.display = '';
});

function handleSearch(q) {
  if (!q) {
    resultsSection.style.display = 'none';
    browseSection.style.display = '';
    return;
  }
  const lower = q.toLowerCase();
  const results = SONGS.filter(s =>
    s.title.toLowerCase().includes(lower) ||
    s.artist.toLowerCase().includes(lower) ||
    s.album.toLowerCase().includes(lower)
  );

  resultsSection.style.display = '';
  browseSection.style.display = 'none';
  resultsList.innerHTML = '';

  if (!results.length) {
    resultsList.innerHTML = `<p style="color:var(--text-subdued);padding:16px 0;">No results for "${q}"</p>`;
    return;
  }

  results.forEach((song, idx) => {
    const row = buildTrackRow(song, idx + 1, SONGS);
    resultsList.appendChild(row);
  });
}

/* ══════════════════════════════════════════════════════
   7. LIBRARY VIEW
   ══════════════════════════════════════════════════════ */
function renderLibrary() {
  const list = document.getElementById('library-list');
  list.innerHTML = '';
  PLAYLISTS.forEach(pl => {
    const item = document.createElement('div');
    item.className = 'library-item';
    item.innerHTML = `
      <img src="${pl.cover}" alt="${pl.name}" />
      <div class="library-item-info">
        <div class="library-item-name">${pl.name}</div>
        <div class="library-item-sub">Playlist • ${pl.songs.length} songs</div>
      </div>
    `;
    item.addEventListener('click', () => switchView('playlist', pl));
    list.appendChild(item);
  });
}

/* ══════════════════════════════════════════════════════
   8. PLAYLIST VIEW
   ══════════════════════════════════════════════════════ */
function renderPlaylist(pl) {
  player.currentPlaylistId = pl.id;
  const songs = pl.songs.map(id => getSong(id)).filter(Boolean);

  document.getElementById('playlist-hero-img').src = pl.cover;
  document.getElementById('playlist-hero-title').textContent = pl.name;
  document.getElementById('playlist-hero-desc').textContent = pl.desc;
  document.getElementById('playlist-meta-text').textContent =
    `Spotify • ${songs.length} songs`;

  // Color the hero gradient based on cover (random tint)
  const heroDiv = document.getElementById('playlist-hero');
  heroDiv.style.background = `linear-gradient(180deg, rgba(29,185,84,0.3) 0%, transparent 100%)`;

  // Track list
  const trackList = document.getElementById('playlist-track-list');
  trackList.innerHTML = '';
  songs.forEach((song, idx) => {
    const row = buildTrackRow(song, idx + 1, songs);
    trackList.appendChild(row);
  });

  // Play all button
  document.getElementById('play-all-btn').onclick = () => {
    playSong(songs[0], songs);
  };

  // Sidebar highlight
  highlightSidebarPlaylist(pl.id);
}

function buildTrackRow(song, num, songList) {
  const isPlaying = player.currentSong && player.currentSong.id === song.id && player.isPlaying;
  const row = document.createElement('div');
  row.className = `track-row${isPlaying ? ' playing' : ''}`;
  row.dataset.songId = song.id;

  row.innerHTML = `
    <div class="track-num">
      ${isPlaying
        ? `<div class="equalizer"><span></span><span></span><span></span></div>`
        : `<span>${num}</span>`}
      <div class="track-row-play">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </div>
    </div>
    <div class="track-info">
      <img src="${song.cover}" alt="${song.title}" loading="lazy" />
      <div class="track-meta">
        <div class="track-name">${song.title}</div>
        <div class="track-artist">${song.artist}</div>
      </div>
    </div>
    <div class="track-album">${song.album}</div>
    <div class="track-duration">${fmtTime(song.duration)}</div>
  `;

  row.addEventListener('click', () => playSong(song, songList));
  return row;
}

/* ══════════════════════════════════════════════════════
   9. SIDEBAR PLAYLIST LIST
   ══════════════════════════════════════════════════════ */
function renderSidebarPlaylists() {
  const list = document.getElementById('sidebar-playlist-list');
  list.innerHTML = '';
  PLAYLISTS.forEach(pl => {
    const li = document.createElement('li');
    li.className = 'playlist-item';
    li.dataset.plId = pl.id;
    li.innerHTML = `
      <img src="${pl.cover}" alt="${pl.name}" />
      <div class="playlist-item-info">
        <div class="playlist-item-name">${pl.name}</div>
        <div class="playlist-item-sub">Playlist</div>
      </div>
    `;
    li.addEventListener('click', () => switchView('playlist', pl));
    list.appendChild(li);
  });
}

function highlightSidebarPlaylist(id) {
  document.querySelectorAll('.playlist-item').forEach(el => {
    el.classList.toggle('active', el.dataset.plId === id);
  });
}

/* ══════════════════════════════════════════════════════
   10. PLAYER ENGINE
   ══════════════════════════════════════════════════════ */
function playSong(song, queue = SONGS) {
  player.currentSong = song;
  player.queue = [...queue];
  player.currentIndex = player.queue.findIndex(s => s.id === song.id);
  player.isPlaying = true;

  // Update audio source
  if (song.src) {
    audioEl.src = song.src;
    audioEl.play().catch(() => {});
  } else {
    // No real audio — simulate playback with a timer
    audioEl.src = '';
    simulatePlayback(song.duration);
  }

  updatePlayerUI();
  updateNowPlayingPanel();
  updateTrackHighlights();
  startProgressInterval();
}

let simStart = null;
let simDuration = 0;
let simPaused = false;
let simElapsed = 0;

function simulatePlayback(duration) {
  clearInterval(progressInterval);
  simDuration = duration;
  simStart = Date.now();
  simElapsed = 0;
  simPaused = false;

  progressInterval = setInterval(() => {
    if (simPaused) return;
    simElapsed = (Date.now() - simStart) / 1000;
    if (simElapsed >= simDuration) {
      simElapsed = simDuration;
      clearInterval(progressInterval);
      onSongEnd();
      return;
    }
    updateProgress(simElapsed, simDuration);
  }, 500);
}

function startProgressInterval() {
  clearInterval(progressInterval);
  if (audioEl.src && audioEl.src !== window.location.href) {
    progressInterval = setInterval(() => {
      if (!isNaN(audioEl.duration)) {
        updateProgress(audioEl.currentTime, audioEl.duration);
      }
    }, 500);
  }
}

function updateProgress(cur, total) {
  const pct = total > 0 ? (cur / total) * 100 : 0;
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-thumb').style.left = pct + '%';
  document.getElementById('current-time').textContent = fmtTime(cur);
  document.getElementById('total-time').textContent = fmtTime(total);
}

function onSongEnd() {
  if (player.repeatMode === 2) {
    // Repeat one
    playSong(player.currentSong, player.queue);
  } else if (player.repeatMode === 1 || player.currentIndex < player.queue.length - 1) {
    nextSong();
  } else {
    player.isPlaying = false;
    updatePlayPauseBtn();
  }
}

audioEl.addEventListener('ended', onSongEnd);
audioEl.addEventListener('timeupdate', () => {
  if (!isNaN(audioEl.duration)) {
    updateProgress(audioEl.currentTime, audioEl.duration);
  }
});

function togglePlayPause() {
  if (!player.currentSong) return;
  player.isPlaying = !player.isPlaying;

  if (player.currentSong.src && audioEl.src) {
    player.isPlaying ? audioEl.play() : audioEl.pause();
  } else {
    // Simulated
    if (player.isPlaying) {
      simStart = Date.now() - simElapsed * 1000;
      simPaused = false;
    } else {
      simPaused = true;
    }
  }
  updatePlayPauseBtn();
}

function nextSong() {
  let nextIdx;
  if (player.isShuffle) {
    nextIdx = Math.floor(Math.random() * player.queue.length);
  } else {
    nextIdx = (player.currentIndex + 1) % player.queue.length;
  }
  playSong(player.queue[nextIdx], player.queue);
}

function prevSong() {
  // If more than 3 sec in, restart; else go prev
  const elapsed = simElapsed || audioEl.currentTime || 0;
  if (elapsed > 3) {
    if (audioEl.src) audioEl.currentTime = 0;
    simStart = Date.now();
    simElapsed = 0;
    updateProgress(0, player.currentSong.duration);
    return;
  }
  const prevIdx = player.currentIndex === 0
    ? player.queue.length - 1
    : player.currentIndex - 1;
  playSong(player.queue[prevIdx], player.queue);
}

function toggleShuffle() {
  player.isShuffle = !player.isShuffle;
  document.getElementById('btn-shuffle').classList.toggle('active', player.isShuffle);
  showToast(player.isShuffle ? 'Shuffle on' : 'Shuffle off');
}

function toggleRepeat() {
  player.repeatMode = (player.repeatMode + 1) % 3;
  const btn = document.getElementById('btn-repeat');
  btn.classList.toggle('active', player.repeatMode > 0);
  const labels = ['Repeat off', 'Repeat all', 'Repeat one'];
  showToast(labels[player.repeatMode]);
}

function setVolume(pct) {
  player.volume = Math.max(0, Math.min(1, pct));
  audioEl.volume = player.volume;
  document.getElementById('volume-fill').style.width = (player.volume * 100) + '%';
  document.getElementById('volume-thumb').style.left = (player.volume * 100) + '%';
  if (player.volume === 0) {
    player.isMuted = true;
    showMuteIcon(true);
  } else {
    player.isMuted = false;
    showMuteIcon(false);
  }
}

function toggleMute() {
  player.isMuted = !player.isMuted;
  audioEl.muted = player.isMuted;
  showMuteIcon(player.isMuted);
  if (!player.isMuted) {
    document.getElementById('volume-fill').style.width = (player.volume * 100) + '%';
    document.getElementById('volume-thumb').style.left = (player.volume * 100) + '%';
  } else {
    document.getElementById('volume-fill').style.width = '0%';
    document.getElementById('volume-thumb').style.left = '0%';
  }
}

function showMuteIcon(muted) {
  document.getElementById('icon-volume').style.display = muted ? 'none' : 'block';
  document.getElementById('icon-mute').style.display = muted ? 'block' : 'none';
}

function toggleLike(songId) {
  const id = songId || (player.currentSong && player.currentSong.id);
  if (!id) return;
  if (player.likedSongs.has(id)) {
    player.likedSongs.delete(id);
    showToast('Removed from Liked Songs');
  } else {
    player.likedSongs.add(id);
    showToast('Saved to Liked Songs');
  }
  const isLiked = player.likedSongs.has(id);
  document.getElementById('player-like-btn').classList.toggle('liked', isLiked);
}

/* ══════════════════════════════════════════════════════
   11. PLAYER UI UPDATE
   ══════════════════════════════════════════════════════ */
function updatePlayerUI() {
  if (!player.currentSong) return;
  const song = player.currentSong;
  document.getElementById('player-art').src = song.cover;
  document.getElementById('player-song-name').textContent = song.title;
  document.getElementById('player-artist-name').textContent = song.artist;
  document.getElementById('total-time').textContent = fmtTime(song.duration);
  document.getElementById('player-like-btn').classList.toggle(
    'liked', player.likedSongs.has(song.id)
  );
  updatePlayPauseBtn();
}

function updatePlayPauseBtn() {
  document.getElementById('icon-play').style.display = player.isPlaying ? 'none' : 'block';
  document.getElementById('icon-pause').style.display = player.isPlaying ? 'block' : 'none';
}

function updateNowPlayingPanel() {
  if (!player.currentSong) return;
  const song = player.currentSong;
  document.getElementById('np-large-art').src = song.cover;
  document.getElementById('np-song-title').textContent = song.title;
  document.getElementById('np-artist').textContent = song.artist;

  // Queue list
  const queueList = document.getElementById('np-queue-list');
  queueList.innerHTML = '';
  const start = (player.currentIndex + 1) % player.queue.length;
  const nextSongs = [];
  for (let i = 0; i < Math.min(5, player.queue.length - 1); i++) {
    nextSongs.push(player.queue[(start + i) % player.queue.length]);
  }
  nextSongs.forEach(s => {
    const li = document.createElement('li');
    li.className = 'queue-item';
    li.innerHTML = `
      <img src="${s.cover}" alt="${s.title}" />
      <div class="queue-item-info">
        <div class="queue-item-name">${s.title}</div>
        <div class="queue-item-artist">${s.artist}</div>
      </div>
    `;
    li.addEventListener('click', () => playSong(s, player.queue));
    queueList.appendChild(li);
  });
}

function updateTrackHighlights() {
  document.querySelectorAll('.track-row').forEach(row => {
    const isActive = Number(row.dataset.songId) === player.currentSong?.id;
    row.classList.toggle('playing', isActive);
    const numEl = row.querySelector('.track-num');
    if (numEl) {
      if (isActive && player.isPlaying) {
        numEl.innerHTML = `<div class="equalizer"><span></span><span></span><span></span></div><div class="track-row-play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>`;
      }
    }
  });
}

/* ══════════════════════════════════════════════════════
   12. SEEK BAR
   ══════════════════════════════════════════════════════ */
function setupSeekBar(barEl, onSeek) {
  let dragging = false;

  function getPercent(e) {
    const rect = barEl.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  }

  barEl.addEventListener('mousedown', e => {
    dragging = true;
    onSeek(getPercent(e));
  });
  document.addEventListener('mousemove', e => {
    if (dragging) onSeek(getPercent(e));
  });
  document.addEventListener('mouseup', () => { dragging = false; });
}

setupSeekBar(document.getElementById('progress-bar'), pct => {
  if (!player.currentSong) return;
  const total = player.currentSong.duration;
  const newTime = pct * total;
  if (audioEl.src && !isNaN(audioEl.duration)) {
    audioEl.currentTime = newTime;
  } else {
    simElapsed = newTime;
    simStart = Date.now() - newTime * 1000;
  }
  updateProgress(newTime, total);
});

setupSeekBar(document.getElementById('volume-bar'), pct => {
  setVolume(pct);
});

/* ══════════════════════════════════════════════════════
   13. NOW PLAYING PANEL TOGGLE
   ══════════════════════════════════════════════════════ */
let npOpen = false;

function toggleNowPlayingPanel() {
  npOpen = !npOpen;
  const panel = document.getElementById('now-playing-panel');
  const app = document.getElementById('app');
  if (npOpen) {
    panel.classList.remove('hidden');
    panel.classList.add('open');
    app.classList.add('np-open');
    updateNowPlayingPanel();
  } else {
    panel.classList.remove('open');
    app.classList.remove('np-open');
    setTimeout(() => { if (!npOpen) panel.classList.add('hidden'); }, 300);
  }
  document.getElementById('btn-fullscreen').classList.toggle('active', npOpen);
}

document.getElementById('btn-fullscreen').addEventListener('click', toggleNowPlayingPanel);
document.getElementById('close-np-btn').addEventListener('click', toggleNowPlayingPanel);
document.getElementById('btn-queue').addEventListener('click', toggleNowPlayingPanel);

/* ══════════════════════════════════════════════════════
   14. TOP BAR SCROLL EFFECT
   ══════════════════════════════════════════════════════ */
document.querySelectorAll('.view-scroll').forEach(scroll => {
  scroll.addEventListener('scroll', () => {
    const topbar = document.getElementById('topbar');
    topbar.classList.toggle('scrolled', scroll.scrollTop > 60);
  });
});

/* ══════════════════════════════════════════════════════
   15. EVENT LISTENERS — PLAYER CONTROLS
   ══════════════════════════════════════════════════════ */
document.getElementById('btn-play-pause').addEventListener('click', togglePlayPause);
document.getElementById('btn-next').addEventListener('click', nextSong);
document.getElementById('btn-prev').addEventListener('click', prevSong);
document.getElementById('btn-shuffle').addEventListener('click', toggleShuffle);
document.getElementById('btn-repeat').addEventListener('click', toggleRepeat);
document.getElementById('btn-mute').addEventListener('click', toggleMute);
document.getElementById('player-like-btn').addEventListener('click', () => toggleLike());

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  const tag = document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  switch (e.code) {
    case 'Space':
      e.preventDefault();
      togglePlayPause();
      break;
    case 'ArrowRight':
      e.preventDefault();
      nextSong();
      break;
    case 'ArrowLeft':
      e.preventDefault();
      prevSong();
      break;
    case 'KeyS':
      toggleShuffle();
      break;
    case 'KeyR':
      toggleRepeat();
      break;
    case 'KeyM':
      toggleMute();
      break;
  }
});

/* ══════════════════════════════════════════════════════
   16. NAVIGATION EVENT LISTENERS
   ══════════════════════════════════════════════════════ */
document.getElementById('nav-home-btn').addEventListener('click', () => switchView('home'));
document.getElementById('nav-search-btn').addEventListener('click', () => switchView('search'));
document.getElementById('nav-library-btn').addEventListener('click', () => switchView('library'));

// Logo click
document.getElementById('nav-home').addEventListener('click', () => switchView('home'));

// Create playlist (adds a new playlist to store)
let createdCount = 0;
function createPlaylist() {
  createdCount++;
  const names = ['My Playlist', 'New Mix', 'Favorite Tracks', 'Late Night Jams', 'Morning Energy'];
  const covers = Object.values(COVERS);
  const newPl = {
    id: `custom-${createdCount}`,
    name: `${names[createdCount % names.length]} #${createdCount}`,
    cover: covers[createdCount % covers.length],
    desc: 'Created by you',
    songs: SONGS.slice(createdCount * 2, createdCount * 2 + 5).map(s => s.id),
  };
  PLAYLISTS.push(newPl);
  renderSidebarPlaylists();
  switchView('library');
  showToast(`Created "${newPl.name}"`);
}

document.getElementById('create-playlist-btn').addEventListener('click', createPlaylist);
document.getElementById('library-create-btn').addEventListener('click', createPlaylist);

// Back / Forward navigation (simple history)
const navHistory = ['home'];
let navPos = 0;

document.getElementById('go-back').addEventListener('click', () => {
  if (navPos > 0) {
    navPos--;
    switchView(navHistory[navPos]);
  }
});
document.getElementById('go-forward').addEventListener('click', () => {
  if (navPos < navHistory.length - 1) {
    navPos++;
    switchView(navHistory[navPos]);
  }
});

// Filter chips in library
document.querySelectorAll('.filter-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
  });
});

/* ══════════════════════════════════════════════════════
   17. INIT
   ══════════════════════════════════════════════════════ */
function init() {
  // Set initial volume
  audioEl.volume = player.volume;

  // Render sidebar playlists
  renderSidebarPlaylists();

  // Start on home view
  switchView('home');

  // Load first song info into player bar (not playing)
  updatePlayerUI();

  // Init volume display
  document.getElementById('volume-fill').style.width = (player.volume * 100) + '%';
  document.getElementById('volume-thumb').style.left = (player.volume * 100) + '%';

  console.log('%c🎵 Spotify Clone Ready!', 'color:#1DB954;font-size:16px;font-weight:bold;');
  console.log('%cKeyboard Shortcuts: Space=Play/Pause | ←/→=Prev/Next | S=Shuffle | R=Repeat | M=Mute', 'color:#b3b3b3;');
}

init();
