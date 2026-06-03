'use strict';

/* ══════════════════════════════════════════════════════
   1. COVER POOL (for auto-assigned art)
   ══════════════════════════════════════════════════════ */
const COVERS = [
  'assets/cover1.png','assets/cover2.png','assets/cover3.png',
  'assets/cover4.png','assets/cover5.png'
];
function randomCover() { return COVERS[Math.floor(Math.random() * COVERS.length)]; }

/* ══════════════════════════════════════════════════════
   2. DEFAULT SONGS (15 built-in tracks)
   ══════════════════════════════════════════════════════ */
const DEFAULT_SONGS = [
  { id:1,  title:'Neon Dreams',       artist:'The Synthwave Collective', album:'Electric Nights',  cover:COVERS[0], duration:372, src:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',  isLocal:false },
  { id:2,  title:'Midnight Run',      artist:'Luna Beats',               album:'Midnight Pulse',   cover:COVERS[1], duration:360, src:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',  isLocal:false },
  { id:3,  title:'Aqua Horizon',      artist:'Ocean Mind',               album:'Deep Blue',        cover:COVERS[2], duration:290, src:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',  isLocal:false },
  { id:4,  title:'Forest Walk',       artist:'Echo Verde',               album:'Nature Tones',     cover:COVERS[3], duration:310, src:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',  isLocal:false },
  { id:5,  title:'Crimson Petals',    artist:'Rose Canvas',              album:'Bloom',            cover:COVERS[4], duration:338, src:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',  isLocal:false },
  { id:6,  title:'Galactic Drift',    artist:'The Synthwave Collective', album:'Electric Nights',  cover:COVERS[0], duration:358, src:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',  isLocal:false },
  { id:7,  title:'Amber Glow',        artist:'Luna Beats',               album:'Midnight Pulse',   cover:COVERS[1], duration:337, src:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',  isLocal:false },
  { id:8,  title:'Crystal Cave',      artist:'Ocean Mind',               album:'Deep Blue',        cover:COVERS[2], duration:371, src:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',  isLocal:false },
  { id:9,  title:'Verdant Path',      artist:'Echo Verde',               album:'Nature Tones',     cover:COVERS[3], duration:267, src:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3',  isLocal:false },
  { id:10, title:'Velvet Twilight',   artist:'Rose Canvas',              album:'Bloom',            cover:COVERS[4], duration:279, src:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3', isLocal:false },
  { id:11, title:'Pulse & Static',    artist:'The Synthwave Collective', album:'Electric Nights',  cover:COVERS[0], duration:382, src:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3', isLocal:false },
  { id:12, title:'Solar Flare',       artist:'Luna Beats',               album:'Midnight Pulse',   cover:COVERS[1], duration:344, src:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3', isLocal:false },
  { id:13, title:'Tidal Wave',        artist:'Ocean Mind',               album:'Deep Blue',        cover:COVERS[2], duration:303, src:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3', isLocal:false },
  { id:14, title:'Mossy Stone',       artist:'Echo Verde',               album:'Nature Tones',     cover:COVERS[3], duration:268, src:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3', isLocal:false },
  { id:15, title:'Blossom Rain',      artist:'Rose Canvas',              album:'Bloom',            cover:COVERS[4], duration:322, src:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3', isLocal:false },
];

/* ══════════════════════════════════════════════════════
   3. DYNAMIC SONG LIBRARY (persisted in localStorage)
   ══════════════════════════════════════════════════════ */
let nextId = 100;

// Load user-added songs from localStorage (non-local-file ones only)
function loadSavedSongs() {
  try {
    const saved = JSON.parse(localStorage.getItem('spotify_user_songs') || '[]');
    // Filter out local blob URLs (they don't survive page refresh)
    return saved.filter(s => !s.isLocal && s.src);
  } catch { return []; }
}

function saveSongsToStorage() {
  const toSave = SONGS.filter(s => s.id >= 100 && !s.isLocal);
  try { localStorage.setItem('spotify_user_songs', JSON.stringify(toSave)); } catch {}
}

// Master song array = defaults + user saved
let SONGS = [...DEFAULT_SONGS, ...loadSavedSongs()];
nextId = Math.max(nextId, ...SONGS.map(s => s.id)) + 1;

// PLAYLISTS
let PLAYLISTS = [
  { id:'pl1', name:'Electric Nights',  cover:COVERS[0], desc:'Synthwave and neon vibes',     songs:[1,6,11,2,7]  },
  { id:'pl2', name:'Midnight Pulse',   cover:COVERS[1], desc:'Late night beats to vibe to',  songs:[2,7,12,3,8]  },
  { id:'pl3', name:'Deep Blue',        cover:COVERS[2], desc:'Underwater ambient chill',      songs:[3,8,13,4,9]  },
  { id:'pl4', name:'Nature Tones',     cover:COVERS[3], desc:'Earthy organic sounds',         songs:[4,9,14,5,10] },
  { id:'pl5', name:'Bloom',            cover:COVERS[4], desc:'Soft melodies and dream pop',   songs:[5,10,15,1,6] },
];

/* ══════════════════════════════════════════════════════
   4. PLAYER STATE
   ══════════════════════════════════════════════════════ */
const player = {
  currentSong: null,
  currentIndex: 0,
  queue: [],
  isPlaying: false,
  isShuffle: false,
  repeatMode: 0,
  volume: 0.7,
  isMuted: false,
  likedSongs: new Set(),
};

const audioEl = document.getElementById('audio-player');

/* ══════════════════════════════════════════════════════
   5. UTILITIES
   ══════════════════════════════════════════════════════ */
function fmtTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
function getSong(id) { return SONGS.find(s => s.id === id); }
function getPlaylist(id) { return PLAYLISTS.find(p => p.id === id); }
function greetingText() {
  const h = new Date().getHours();
  return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
}
function showToast(msg, type = 'info') {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.className = `toast-${type}`;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ══════════════════════════════════════════════════════
   6. ROUTER (SPA)
   ══════════════════════════════════════════════════════ */
const views = {
  home:     document.getElementById('view-home'),
  search:   document.getElementById('view-search'),
  library:  document.getElementById('view-library'),
  playlist: document.getElementById('view-playlist'),
};

function switchView(name, data = null) {
  Object.values(views).forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (views[name]) views[name].classList.add('active');
  const btn = document.getElementById(`nav-${name}-btn`);
  if (btn) btn.classList.add('active');
  if (name === 'home')     renderHome();
  if (name === 'search')   renderSearch();
  if (name === 'library')  renderLibrary();
  if (name === 'playlist' && data) renderPlaylist(data);
}

/* ══════════════════════════════════════════════════════
   7. HOME VIEW
   ══════════════════════════════════════════════════════ */
function renderHome() {
  document.getElementById('greeting-text').textContent = greetingText();
  document.getElementById('home-song-count').textContent = `${SONGS.length} SONGS`;

  // Quick picks
  const qpGrid = document.getElementById('quick-picks-grid');
  qpGrid.innerHTML = '';
  PLAYLISTS.slice(0, 6).forEach(pl => {
    const plSongs = pl.songs.map(id => getSong(id)).filter(Boolean);
    const el = document.createElement('div');
    el.className = 'quick-pick-item';
    el.innerHTML = `
      <img src="${pl.cover}" alt="${pl.name}" />
      <span>${pl.name}</span>
      <div class="quick-pick-play">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </div>`;
    el.querySelector('.quick-pick-play').addEventListener('click', e => {
      e.stopPropagation();
      if (plSongs.length) playSong(plSongs[0], plSongs);
    });
    el.addEventListener('click', () => switchView('playlist', pl));
    qpGrid.appendChild(el);
  });

  // Recently played (last 6 songs in reverse)
  const recent = [...SONGS].reverse().slice(0, 6);
  renderCardRow('recently-played-row', recent.map(s => ({ title: s.title, subtitle: s.artist, cover: s.cover, song: s })), SONGS);

  // All songs table
  renderSongTable('all-songs-list', SONGS);
}

function renderCardRow(containerId, items, queue) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
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
      <div class="card-subtitle">${item.subtitle}</div>`;
    card.addEventListener('click', () => {
      if (item.song) playSong(item.song, queue || SONGS);
      else if (item.playlist) {
        const s = item.playlist.songs.map(id => getSong(id)).filter(Boolean);
        if (s.length) playSong(s[0], s);
        switchView('playlist', item.playlist);
      }
    });
    el.appendChild(card);
  });
}

function renderSongTable(containerId, songs) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  if (!songs.length) {
    el.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="currentColor" width="48"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg><p>No songs yet. Add your first song!</p><button class="btn-primary" onclick="openAddSongModal()">Add Songs</button></div>`;
    return;
  }
  songs.forEach((song, idx) => {
    el.appendChild(buildTrackRow(song, idx + 1, songs));
  });
}

/* ══════════════════════════════════════════════════════
   8. SEARCH VIEW
   ══════════════════════════════════════════════════════ */
function renderSearch() {
  handleSearch(document.getElementById('search-input').value.trim());
}

const searchInput  = document.getElementById('search-input');
const clearBtn     = document.getElementById('clear-search-btn');
const resultsList  = document.getElementById('search-results-list');
const searchHeading = document.getElementById('search-heading');

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  clearBtn.style.display = q ? 'flex' : 'none';
  handleSearch(q);
});
clearBtn.addEventListener('click', () => {
  searchInput.value = '';
  clearBtn.style.display = 'none';
  handleSearch('');
});

function handleSearch(q) {
  const lower = q.toLowerCase();
  const results = lower
    ? SONGS.filter(s =>
        s.title.toLowerCase().includes(lower) ||
        s.artist.toLowerCase().includes(lower) ||
        s.album.toLowerCase().includes(lower)
      )
    : SONGS;

  searchHeading.textContent = lower ? `Results for "${q}" (${results.length})` : `All Songs (${SONGS.length})`;
  resultsList.innerHTML = '';

  if (!results.length) {
    resultsList.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="currentColor" width="48"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg><p>No songs match "<strong>${q}</strong>"</p></div>`;
    return;
  }
  results.forEach((song, idx) => resultsList.appendChild(buildTrackRow(song, idx + 1, results)));
}

/* ══════════════════════════════════════════════════════
   9. LIBRARY VIEW
   ══════════════════════════════════════════════════════ */
function renderLibrary() {
  const list = document.getElementById('library-list');
  const activeFilter = document.querySelector('.filter-chip.active')?.id;

  list.innerHTML = '';
  if (activeFilter === 'filter-songs') {
    // Show all songs as a table
    SONGS.forEach((song, idx) => list.appendChild(buildTrackRow(song, idx + 1, SONGS)));
  } else {
    // Show playlists
    PLAYLISTS.forEach(pl => {
      const el = document.createElement('div');
      el.className = 'library-item';
      el.innerHTML = `
        <img src="${pl.cover}" alt="${pl.name}" />
        <div class="library-item-info">
          <div class="library-item-name">${pl.name}</div>
          <div class="library-item-sub">Playlist • ${pl.songs.length} songs</div>
        </div>
        <button class="library-play-btn" title="Play">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </button>`;
      el.querySelector('.library-play-btn').addEventListener('click', e => {
        e.stopPropagation();
        const s = pl.songs.map(id => getSong(id)).filter(Boolean);
        if (s.length) playSong(s[0], s);
      });
      el.addEventListener('click', () => switchView('playlist', pl));
      list.appendChild(el);
    });
  }
}

document.getElementById('filter-playlists').addEventListener('click', function() {
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  this.classList.add('active');
  renderLibrary();
});
document.getElementById('filter-songs').addEventListener('click', function() {
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  this.classList.add('active');
  renderLibrary();
});

/* ══════════════════════════════════════════════════════
   10. PLAYLIST VIEW
   ══════════════════════════════════════════════════════ */
function renderPlaylist(pl) {
  const songs = pl.songs.map(id => getSong(id)).filter(Boolean);
  document.getElementById('playlist-hero-img').src = pl.cover;
  document.getElementById('playlist-hero-title').textContent = pl.name;
  document.getElementById('playlist-hero-desc').textContent = pl.desc;
  document.getElementById('playlist-meta-text').textContent = `Spotify • ${songs.length} songs`;
  document.getElementById('playlist-hero').style.background = 'linear-gradient(180deg, rgba(29,185,84,0.3) 0%, transparent 100%)';

  const trackList = document.getElementById('playlist-track-list');
  trackList.innerHTML = '';
  songs.forEach((song, idx) => trackList.appendChild(buildTrackRow(song, idx + 1, songs)));

  document.getElementById('play-all-btn').onclick = () => {
    if (songs.length) playSong(songs[0], songs);
  };
  highlightSidebarPlaylist(pl.id);
}

/* ══════════════════════════════════════════════════════
   11. SIDEBAR PLAYLISTS
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
      </div>`;
    li.addEventListener('click', () => switchView('playlist', pl));
    list.appendChild(li);
  });
}
function highlightSidebarPlaylist(id) {
  document.querySelectorAll('.playlist-item').forEach(el =>
    el.classList.toggle('active', el.dataset.plId === id));
}

/* ══════════════════════════════════════════════════════
   12. TRACK ROW BUILDER
   ══════════════════════════════════════════════════════ */
function buildTrackRow(song, num, songList) {
  const isPlaying = player.currentSong?.id === song.id && player.isPlaying;
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
    <div class="track-duration-wrap">
      ${song.id >= 100 ? `<button class="delete-song-btn" title="Remove song" data-id="${song.id}"><svg viewBox="0 0 24 24" fill="currentColor" width="14"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>` : ''}
      <span class="track-duration">${fmtTime(song.duration)}</span>
    </div>`;

  row.addEventListener('click', e => {
    if (e.target.closest('.delete-song-btn')) {
      deleteSong(song.id);
      return;
    }
    playSong(song, songList);
  });
  return row;
}

/* ══════════════════════════════════════════════════════
   13. PLAYER ENGINE
   ══════════════════════════════════════════════════════ */
function playSong(song, queue = SONGS) {
  player.currentSong = song;
  player.queue = [...queue];
  player.currentIndex = player.queue.findIndex(s => s.id === song.id);
  player.isPlaying = true;

  audioEl.pause();
  audioEl.src = song.src;
  audioEl.volume = player.volume;
  audioEl.muted = player.isMuted;

  const p = audioEl.play();
  if (p !== undefined) {
    p.catch(err => {
      console.warn('Playback failed:', err);
      showToast('⚠️ Could not play this song. Check the source.', 'error');
      player.isPlaying = false;
      updatePlayPauseBtn();
    });
  }

  updatePlayerUI();
  updateNowPlayingPanel();
  updateTrackHighlights();

  // Track recently played
  recentlyPlayed = [song.id, ...recentlyPlayed.filter(id => id !== song.id)].slice(0, 10);
}

let recentlyPlayed = [];

audioEl.addEventListener('ended', () => {
  if (player.repeatMode === 2) {
    playSong(player.currentSong, player.queue);
  } else if (player.repeatMode === 1 || player.currentIndex < player.queue.length - 1) {
    nextSong();
  } else {
    player.isPlaying = false;
    updatePlayPauseBtn();
  }
});

audioEl.addEventListener('timeupdate', () => {
  if (!isNaN(audioEl.duration) && audioEl.duration > 0) {
    updateProgress(audioEl.currentTime, audioEl.duration);
  }
});

audioEl.addEventListener('loadedmetadata', () => {
  document.getElementById('total-time').textContent = fmtTime(audioEl.duration);
  // Update the song's stored duration
  if (player.currentSong) {
    player.currentSong.duration = Math.floor(audioEl.duration);
    const s = SONGS.find(x => x.id === player.currentSong.id);
    if (s) s.duration = player.currentSong.duration;
  }
});

function updateProgress(cur, total) {
  const pct = total > 0 ? (cur / total) * 100 : 0;
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-thumb').style.left = pct + '%';
  document.getElementById('current-time').textContent = fmtTime(cur);
  document.getElementById('total-time').textContent = fmtTime(total);
}

function togglePlayPause() {
  if (!player.currentSong) {
    if (SONGS.length) playSong(SONGS[0], SONGS);
    return;
  }
  player.isPlaying = !player.isPlaying;
  if (player.isPlaying) {
    audioEl.play().catch(() => { player.isPlaying = false; updatePlayPauseBtn(); });
  } else {
    audioEl.pause();
  }
  updatePlayPauseBtn();
}

function nextSong() {
  if (!player.queue.length) return;
  const nextIdx = player.isShuffle
    ? Math.floor(Math.random() * player.queue.length)
    : (player.currentIndex + 1) % player.queue.length;
  playSong(player.queue[nextIdx], player.queue);
}

function prevSong() {
  if (audioEl.currentTime > 3) { audioEl.currentTime = 0; return; }
  if (!player.queue.length) return;
  const prevIdx = player.currentIndex === 0 ? player.queue.length - 1 : player.currentIndex - 1;
  playSong(player.queue[prevIdx], player.queue);
}

function toggleShuffle() {
  player.isShuffle = !player.isShuffle;
  document.getElementById('btn-shuffle').classList.toggle('active', player.isShuffle);
  showToast(player.isShuffle ? '🔀 Shuffle on' : '🔀 Shuffle off');
}

function toggleRepeat() {
  player.repeatMode = (player.repeatMode + 1) % 3;
  const btn = document.getElementById('btn-repeat');
  btn.classList.toggle('active', player.repeatMode > 0);
  const labels = ['Repeat off', 'Repeat all', 'Repeat one'];
  showToast('🔁 ' + labels[player.repeatMode]);
}

function setVolume(pct) {
  player.volume = Math.max(0, Math.min(1, pct));
  audioEl.volume = player.volume;
  document.getElementById('volume-fill').style.width = (player.volume * 100) + '%';
  document.getElementById('volume-thumb').style.left = (player.volume * 100) + '%';
  player.isMuted = player.volume === 0;
  showMuteIcon(player.isMuted);
}

function toggleMute() {
  player.isMuted = !player.isMuted;
  audioEl.muted = player.isMuted;
  showMuteIcon(player.isMuted);
  const pct = player.isMuted ? 0 : player.volume;
  document.getElementById('volume-fill').style.width = (pct * 100) + '%';
  document.getElementById('volume-thumb').style.left = (pct * 100) + '%';
}

function showMuteIcon(muted) {
  document.getElementById('icon-volume').style.display = muted ? 'none' : 'block';
  document.getElementById('icon-mute').style.display = muted ? 'block' : 'none';
}

function toggleLike() {
  if (!player.currentSong) return;
  const id = player.currentSong.id;
  if (player.likedSongs.has(id)) { player.likedSongs.delete(id); showToast('Removed from Liked Songs'); }
  else { player.likedSongs.add(id); showToast('💚 Saved to Liked Songs'); }
  document.getElementById('player-like-btn').classList.toggle('liked', player.likedSongs.has(id));
}

/* ══════════════════════════════════════════════════════
   14. PLAYER UI UPDATE
   ══════════════════════════════════════════════════════ */
function updatePlayerUI() {
  if (!player.currentSong) return;
  const song = player.currentSong;
  document.getElementById('player-art').src = song.cover;
  document.getElementById('player-song-name').textContent = song.title;
  document.getElementById('player-artist-name').textContent = song.artist;
  document.getElementById('player-like-btn').classList.toggle('liked', player.likedSongs.has(song.id));
  updatePlayPauseBtn();
  // Update page title
  document.title = `${song.title} • ${song.artist} — Spotify`;
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

  const queueList = document.getElementById('np-queue-list');
  queueList.innerHTML = '';
  const start = (player.currentIndex + 1) % (player.queue.length || 1);
  for (let i = 0; i < Math.min(6, player.queue.length - 1); i++) {
    const s = player.queue[(start + i) % player.queue.length];
    if (!s) continue;
    const li = document.createElement('li');
    li.className = 'queue-item';
    li.innerHTML = `<img src="${s.cover}" alt="${s.title}"/><div class="queue-item-info"><div class="queue-item-name">${s.title}</div><div class="queue-item-artist">${s.artist}</div></div>`;
    li.addEventListener('click', () => playSong(s, player.queue));
    queueList.appendChild(li);
  }
}

function updateTrackHighlights() {
  document.querySelectorAll('.track-row').forEach(row => {
    const active = Number(row.dataset.songId) === player.currentSong?.id;
    row.classList.toggle('playing', active);
    const numEl = row.querySelector('.track-num');
    if (numEl && active && player.isPlaying) {
      numEl.innerHTML = `<div class="equalizer"><span></span><span></span><span></span></div><div class="track-row-play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>`;
    }
  });
}

/* ══════════════════════════════════════════════════════
   15. SEEK BARS
   ══════════════════════════════════════════════════════ */
function setupSeekBar(el, onSeek) {
  let drag = false;
  const pct = e => Math.max(0, Math.min(1, (e.clientX - el.getBoundingClientRect().left) / el.offsetWidth));
  el.addEventListener('mousedown', e => { drag = true; onSeek(pct(e)); });
  document.addEventListener('mousemove', e => { if (drag) onSeek(pct(e)); });
  document.addEventListener('mouseup', () => { drag = false; });
  // Touch support
  el.addEventListener('touchstart', e => { drag = true; onSeek(pct(e.touches[0])); }, { passive:true });
  document.addEventListener('touchmove', e => { if (drag) onSeek(pct(e.touches[0])); }, { passive:true });
  document.addEventListener('touchend', () => { drag = false; });
}

setupSeekBar(document.getElementById('progress-bar'), pct => {
  if (player.currentSong && !isNaN(audioEl.duration) && audioEl.duration > 0) {
    audioEl.currentTime = pct * audioEl.duration;
  }
});

setupSeekBar(document.getElementById('volume-bar'), pct => setVolume(pct));

/* ══════════════════════════════════════════════════════
   16. NOW PLAYING PANEL
   ══════════════════════════════════════════════════════ */
let npOpen = false;
function toggleNowPlayingPanel() {
  npOpen = !npOpen;
  const panel = document.getElementById('now-playing-panel');
  const app   = document.getElementById('app');
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
   17. ADD SONG MODAL — complete dynamic song system
   ══════════════════════════════════════════════════════ */
const modal = document.getElementById('add-song-modal');
let pendingFiles = [];

function openAddSongModal(tab = 'upload') {
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  switchModalTab(tab === 'url' ? 'tab-url' : 'tab-upload');
  resetModal();
}
function closeAddSongModal() {
  modal.style.display = 'none';
  document.body.style.overflow = '';
  resetModal();
  // Revoke any pending blob URLs
  pendingFiles.forEach(f => { if (f.blobUrl) URL.revokeObjectURL(f.blobUrl); });
  pendingFiles = [];
}
function resetModal() {
  document.getElementById('file-details-form').style.display = 'none';
  document.getElementById('selected-files-list').innerHTML = '';
  document.getElementById('url-input').value = '';
  document.getElementById('url-title-input').value = '';
  document.getElementById('url-artist-input').value = '';
  document.getElementById('url-album-input').value = '';
  document.getElementById('file-input').value = '';
  pendingFiles = [];
}

// Tab switching
function switchModalTab(tabId) {
  document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  document.getElementById(tabId === 'tab-upload' ? 'upload-tab-content' : 'url-tab-content').classList.add('active');
}
document.getElementById('tab-upload').addEventListener('click', () => switchModalTab('tab-upload'));
document.getElementById('tab-url').addEventListener('click',    () => switchModalTab('tab-url'));

// Open/close listeners
document.getElementById('open-add-song-btn').addEventListener('click', () => openAddSongModal());
document.getElementById('open-add-song-sidebar').addEventListener('click', () => openAddSongModal());
document.getElementById('close-modal-btn').addEventListener('click', closeAddSongModal);
document.getElementById('cancel-upload-btn').addEventListener('click', closeAddSongModal);
document.getElementById('cancel-url-btn').addEventListener('click', closeAddSongModal);
modal.addEventListener('click', e => { if (e.target === modal) closeAddSongModal(); });

// ── FILE UPLOAD ──
const dropZone  = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');

document.getElementById('browse-files-btn').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => handleFiles(Array.from(e.target.files)));

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-active'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-active'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-active');
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/'));
  if (!files.length) { showToast('⚠️ Please drop audio files only', 'error'); return; }
  handleFiles(files);
});

function handleFiles(files) {
  if (!files.length) return;
  pendingFiles = files.map(file => {
    const blobUrl = URL.createObjectURL(file);
    // Guess title from filename (strip extension)
    const title = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return { file, blobUrl, title, artist: 'Unknown Artist', album: 'My Music' };
  });

  const listEl = document.getElementById('selected-files-list');
  listEl.innerHTML = '';
  pendingFiles.forEach((pf, i) => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `
      <div class="file-icon"><svg viewBox="0 0 24 24" fill="currentColor" width="24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg></div>
      <div class="file-fields">
        <input class="file-title-input" type="text" value="${pf.title}" placeholder="Song title" data-idx="${i}" />
        <div class="file-sub-row">
          <input class="file-artist-input" type="text" value="${pf.artist}" placeholder="Artist" data-idx="${i}" />
          <input class="file-album-input" type="text" value="${pf.album}" placeholder="Album" data-idx="${i}" />
        </div>
      </div>
      <button class="remove-file-btn" data-idx="${i}">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
      </button>`;
    listEl.appendChild(item);
  });

  // Sync inputs back to pendingFiles
  listEl.querySelectorAll('.file-title-input').forEach(inp => inp.addEventListener('input', e => {
    pendingFiles[+e.target.dataset.idx].title = e.target.value;
  }));
  listEl.querySelectorAll('.file-artist-input').forEach(inp => inp.addEventListener('input', e => {
    pendingFiles[+e.target.dataset.idx].artist = e.target.value;
  }));
  listEl.querySelectorAll('.file-album-input').forEach(inp => inp.addEventListener('input', e => {
    pendingFiles[+e.target.dataset.idx].album = e.target.value;
  }));
  listEl.querySelectorAll('.remove-file-btn').forEach(btn => btn.addEventListener('click', e => {
    const idx = +btn.dataset.idx;
    URL.revokeObjectURL(pendingFiles[idx].blobUrl);
    pendingFiles.splice(idx, 1);
    if (!pendingFiles.length) { document.getElementById('file-details-form').style.display = 'none'; return; }
    handleFiles(pendingFiles.map(p => p.file));
  }));

  document.getElementById('file-details-form').style.display = 'block';
}

document.getElementById('confirm-upload-btn').addEventListener('click', () => {
  if (!pendingFiles.length) return;
  const added = [];
  pendingFiles.forEach(pf => {
    const song = {
      id: nextId++,
      title: pf.title.trim() || pf.file.name,
      artist: pf.artist.trim() || 'Unknown Artist',
      album: pf.album.trim() || 'My Music',
      cover: randomCover(),
      duration: 0,
      src: pf.blobUrl,
      isLocal: true,
    };
    SONGS.push(song);
    added.push(song);
  });
  pendingFiles = []; // Don't revoke — they're now in use
  closeAddSongModal();
  refreshAllViews();
  showToast(`✅ Added ${added.length} song${added.length > 1 ? 's' : ''} to your library!`, 'success');
  if (added.length) playSong(added[0], SONGS);
});

// ── URL SONG ──
document.getElementById('confirm-url-btn').addEventListener('click', () => {
  const src   = document.getElementById('url-input').value.trim();
  const title = document.getElementById('url-title-input').value.trim();
  const artist = document.getElementById('url-artist-input').value.trim();
  const album  = document.getElementById('url-album-input').value.trim();

  if (!src) { showToast('⚠️ Please enter an audio URL', 'error'); return; }
  if (!title) { showToast('⚠️ Please enter a song title', 'error'); return; }

  const song = {
    id: nextId++,
    title,
    artist: artist || 'Unknown Artist',
    album: album || 'Added via URL',
    cover: randomCover(),
    duration: 0,
    src,
    isLocal: false,
  };
  SONGS.push(song);
  saveSongsToStorage();
  closeAddSongModal();
  refreshAllViews();
  showToast(`✅ "${title}" added to your library!`, 'success');
  playSong(song, SONGS);
});

/* ══════════════════════════════════════════════════════
   18. DELETE SONG
   ══════════════════════════════════════════════════════ */
function deleteSong(id) {
  const idx = SONGS.findIndex(s => s.id === id);
  if (idx === -1) return;
  const song = SONGS[idx];
  if (song.isLocal && song.src) URL.revokeObjectURL(song.src);
  // Stop if currently playing
  if (player.currentSong?.id === id) {
    audioEl.pause();
    player.currentSong = null;
    player.isPlaying = false;
    updatePlayPauseBtn();
  }
  SONGS.splice(idx, 1);
  // Remove from playlists
  PLAYLISTS.forEach(pl => { pl.songs = pl.songs.filter(sid => sid !== id); });
  saveSongsToStorage();
  refreshAllViews();
  showToast('🗑️ Song removed from library');
}

/* ══════════════════════════════════════════════════════
   19. REFRESH ALL VIEWS
   ══════════════════════════════════════════════════════ */
function refreshAllViews() {
  // Refresh whichever view is currently active
  if (views.home.classList.contains('active'))     renderHome();
  if (views.search.classList.contains('active'))   renderSearch();
  if (views.library.classList.contains('active'))  renderLibrary();
  renderSidebarPlaylists();
  updateTrackHighlights();
}

/* ══════════════════════════════════════════════════════
   20. TOPBAR SCROLL EFFECT
   ══════════════════════════════════════════════════════ */
document.querySelectorAll('.view-scroll').forEach(el => {
  el.addEventListener('scroll', () => {
    document.getElementById('topbar').classList.toggle('scrolled', el.scrollTop > 60);
  });
});

/* ══════════════════════════════════════════════════════
   21. PLAYER CONTROLS & KEYBOARD
   ══════════════════════════════════════════════════════ */
document.getElementById('btn-play-pause').addEventListener('click', togglePlayPause);
document.getElementById('btn-next').addEventListener('click', nextSong);
document.getElementById('btn-prev').addEventListener('click', prevSong);
document.getElementById('btn-shuffle').addEventListener('click', toggleShuffle);
document.getElementById('btn-repeat').addEventListener('click', toggleRepeat);
document.getElementById('btn-mute').addEventListener('click', toggleMute);
document.getElementById('player-like-btn').addEventListener('click', toggleLike);

document.addEventListener('keydown', e => {
  if (['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return;
  switch (e.code) {
    case 'Space':     e.preventDefault(); togglePlayPause(); break;
    case 'ArrowRight': e.preventDefault(); nextSong(); break;
    case 'ArrowLeft':  e.preventDefault(); prevSong(); break;
    case 'KeyS': toggleShuffle(); break;
    case 'KeyR': toggleRepeat(); break;
    case 'KeyM': toggleMute(); break;
    case 'KeyA': openAddSongModal(); break;
  }
});

/* ══════════════════════════════════════════════════════
   22. NAVIGATION
   ══════════════════════════════════════════════════════ */
document.getElementById('nav-home-btn').addEventListener('click', () => switchView('home'));
document.getElementById('nav-search-btn').addEventListener('click', () => switchView('search'));
document.getElementById('nav-library-btn').addEventListener('click', () => switchView('library'));
document.getElementById('nav-home').addEventListener('click', () => switchView('home'));
document.getElementById('go-back').addEventListener('click', () => history.back());
document.getElementById('go-forward').addEventListener('click', () => history.forward());

// Create playlist
document.getElementById('create-playlist-btn').addEventListener('click', createPlaylist);
document.getElementById('library-create-btn').addEventListener('click', createPlaylist);
let plCount = 0;
function createPlaylist() {
  plCount++;
  const allIds = SONGS.map(s => s.id);
  const newPl = {
    id: `custom-${plCount}`,
    name: `My Playlist #${plCount}`,
    cover: randomCover(),
    desc: 'Created by you',
    songs: allIds.slice(0, Math.min(5, allIds.length)),
  };
  PLAYLISTS.push(newPl);
  renderSidebarPlaylists();
  switchView('playlist', newPl);
  showToast(`✅ Created "${newPl.name}"`);
}

/* ══════════════════════════════════════════════════════
   23. INIT
   ══════════════════════════════════════════════════════ */
function init() {
  audioEl.volume = player.volume;
  renderSidebarPlaylists();
  switchView('home');
  document.getElementById('volume-fill').style.width = (player.volume * 100) + '%';
  document.getElementById('volume-thumb').style.left = (player.volume * 100) + '%';

  console.log('%c🎵 Spotify Clone — Dynamic Edition', 'color:#1DB954;font-size:16px;font-weight:bold');
  console.log('%cKeyboard: Space=Play | ←/→=Skip | S=Shuffle | R=Repeat | M=Mute | A=Add Song', 'color:#b3b3b3');
}

init();
