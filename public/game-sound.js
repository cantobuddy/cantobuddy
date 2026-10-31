/* Canto Buddy — shared game sound helper
 * Loaded by the four new games as /game-sound.js.
 *
 * Everything is synthesised with the Web Audio API, so there are no binary
 * assets to deploy and nothing to 404 on a fresh build. SFX are on by default
 * (sound is part of the brief — "games have some sounds or music is good",
 * especially for older players who read state better with an audible cue), and a
 * mute choice is remembered across every game via localStorage. A separate,
 * gentle background loop can be switched on with the music toggle.
 *
 * The AudioContext is created lazily and resumed on the first user gesture,
 * because browsers block audio until a tap/click — so any sound() call also
 * pokes the context awake. That is also why every entry point routes through
 * one of the public methods: never call the oscillator helpers directly.
 */
(function () {
  'use strict';
  var KEY = 'cb_sound';

  var on = true;
  try { on = localStorage.getItem(KEY) !== 'off'; } catch (e) {}

  var ctx = null;
  function AC() {
    if (ctx) {
      if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
      return ctx;
    }
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try { ctx = new Ctor(); } catch (e) { ctx = null; }
    return ctx;
  }

  // One note. `notes` entries: [freq, offsetSec, durSec, type, vol]
  function blip(freq, start, dur, type, vol) {
    var c = AC(); if (!c) return;
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    var peak = vol || 0.18;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(c.destination);
    o.start(start); o.stop(start + dur + 0.03);
  }
  function play(notes) {
    if (!on) return;
    var c = AC(); if (!c) return;
    var t = c.currentTime;
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      blip(n[0], t + (n[1] || 0), n[2] || 0.12, n[3] || 'sine', n[4] == null ? 0.18 : n[4]);
    }
  }

  /* ---------------------------------------------------------- background music
   * A slow, soft loop. Off by default — constant music can be a lot for older
   * players, so it is opt-in via the music button. The melody is a simple
   * major-key arpeggio that repeats; a low note every four steps keeps it gentle
   * rather than bouncy.
   */
  var musicOn = false;
  var musicTimer = null;
  var musicStep = 0;
  var MELODY = [523, 587, 659, 784, 659, 587, 523, 440,
                523, 659, 784, 880, 784, 659, 587, 523];
  function scheduleMusic() {
    if (!musicOn) return;
    var c = AC();
    if (!c) { musicOn = false; return; }
    var t = c.currentTime + 0.04;
    var f = MELODY[musicStep % MELODY.length];
    blip(f, t, 0.55, 'sine', 0.05);
    if (musicStep % 4 === 0) blip(f / 2, t, 0.7, 'sine', 0.045);
    musicStep++;
    musicTimer = setTimeout(scheduleMusic, 540);
  }

  var api = {
    isOn: function () { return on; },
    setOn: function (v) {
      on = !!v;
      try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) {}
      if (!on) api.stopMusic();
    },
    toggle: function () { api.setOn(!on); return on; },

    /* ---- SFX ---- */
    click: function () { play([[440, 0, 0.05, 'square', 0.10]]); },
    flip: function () { play([[520, 0, 0.07, 'triangle', 0.16]]); },
    match: function () { play([[660, 0, 0.10, 'sine', 0.20], [880, 0.08, 0.14, 'sine', 0.20]]); },
    good: function () { play([[523, 0, 0.10, 'sine', 0.20], [659, 0.09, 0.10, 'sine', 0.20], [784, 0.18, 0.16, 'sine', 0.20]]); },
    bad: function () { play([[200, 0, 0.16, 'sawtooth', 0.14], [150, 0.07, 0.18, 'sawtooth', 0.11]]); },
    win: function () {
      if (!on) return;
      play([[523, 0, 0.16, 'sine', 0.22], [659, 0.13, 0.16, 'sine', 0.22],
            [784, 0.26, 0.16, 'sine', 0.22], [1047, 0.40, 0.32, 'sine', 0.24]]);
    },
    deal: function () { play([[330, 0, 0.05, 'triangle', 0.12], [440, 0.05, 0.05, 'triangle', 0.12]]); },
    call: function () { play([[700, 0, 0.13, 'square', 0.16]]); },
    bingo: function () {
      if (!on) return;
      play([[659, 0, 0.12, 'sine', 0.22], [784, 0.10, 0.12, 'sine', 0.22],
            [988, 0.20, 0.14, 'sine', 0.22], [1319, 0.34, 0.30, 'sine', 0.24]]);
    },
    tick: function () { play([[900, 0, 0.04, 'square', 0.08]]); },

    /* ---- music ---- */
    startMusic: function () {
      if (musicOn) return;
      musicOn = true;
      if (on) scheduleMusic();
    },
    stopMusic: function () {
      musicOn = false;
      if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
    },
    musicIsOn: function () { return musicOn; },
    // A single tap from the UI: flips the music on/off and returns the new state.
    toggleMusic: function () {
      if (musicOn) { api.stopMusic(); return false; }
      api.startMusic(); return musicOn;
    }
  };

  window.CBSound = api;
})();
