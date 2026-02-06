export default class AudioManager {
    constructor(options = {}) {
      this.sfxPoolSize = options.sfxPoolSize || 6;
      this.sfxPool = [];
      this.bgm = null;
      this.bgmSrc = null;
      this.unlocked = false;
      this.muted = false;
      this.volume = typeof options.volume === 'number' ? options.volume : 1;
      this._initPool();
      this._attachUnlockListener();
    }
    
    _createAudio(src = '') {
      const audio = new Audio(src);
      audio.preload = 'auto';
      audio.volume = this.volume;
      audio.muted = this.muted;
      return audio;
    }

    _initPool() {
      for (let i = 0; i < this.sfxPoolSize; i++) {
        const audioEl = new Audio();
        audioEl.preload = 'auto';
        audioEl.volume = this.volume;
        this.sfxPool.push(audioEl);
      }
    }
  
    _attachUnlockListener() {
      const unlock = async () => {
        try {
          // Try to play a tiny silent buffer to unlock audio on mobile/Chrome
          const a = this._createAudio();
          a.src = 'data:audio/mp3;base64,//uQZAAAAAAAAAAAAAAAAAAAAAA=='; // tiny silent clip
          a.volume = 0;
          await a.play().catch(()=>{});
          a.pause();
        } catch(e) {}
        this.unlocked = true;
        document.removeEventListener('click', unlock);
        document.removeEventListener('touchstart', unlock);
      };
      document.addEventListener('click', unlock, { once: true });
      document.addEventListener('touchstart', unlock, { once: true });
    }
  
    setVolume(v) {
      this.volume = Math.max(0, Math.min(1, v));
      if (this.bgm) this.bgm.volume = this.volume;
      this.sfxPool.forEach(a => a.volume = this.volume);
    }
  
    mute() {
      this.muted = true;
      if (this.bgm) this.bgm.muted = true;
      this.sfxPool.forEach(a => a.muted = true);
    }
  
    unmute() {
      this.muted = false;
      if (this.bgm) this.bgm.muted = false;
      this.sfxPool.forEach(a => a.muted = false);
    }

    _normalizeSrc(src) {
      if (!src || typeof src !== 'string') return src;
      if (src.startsWith('./public/')) return `./${src.slice('./public/'.length)}`;
      if (src.startsWith('/public/')) return `/${src.slice('/public/'.length)}`;
      return src;
    }
  
    _getFreeSfx() {
      const free = this.sfxPool.find(a => a.paused || a.ended);
      if (free) return free;
      // nếu không có free, clone một instance tạm để tránh chặn
      return this._createAudio();
    }
  
    playSfx(src) {
      if (!src || this.muted) return;
      const normalizedSrc = this._normalizeSrc(src);
      const a = this._getFreeSfx();
      try {
        if (a.src !== normalizedSrc) a.src = normalizedSrc;
        a.currentTime = 0;
        a.volume = this.volume;
        a.play().catch(err => {
          // play bị block thường do chưa có tương tác người dùng
          console.warn('SFX play blocked', err);
        });
      } catch (e) {
        console.warn('SFX play error', e);
      }
    }
  
    async playBgm(src, { loop = true, fadeInMs = 0 } = {}) {
      if (!src) return;
      const normalizedSrc = this._normalizeSrc(src);
      if (this.bgm && this.bgmSrc === normalizedSrc) {
        // nếu cùng src, resume nếu paused
        try { await this.bgm.play().catch(()=>{}); } catch(e){}
        return;
      }
      this.stopBgm();
      this.bgm = this._createAudio();
      this.bgm.loop = !!loop;
      this.bgm.volume = 0; // để fade in an toàn
      this.bgmSrc = normalizedSrc;
      this.bgm.src = normalizedSrc;
      try {
        await this.bgm.play().catch(err => {
          console.warn('BGM play failed', { src: normalizedSrc, err });
        });        
        if (fadeInMs > 0) this._fadeVolume(this.bgm, 0, this.volume, fadeInMs);
        else this.bgm.volume = this.volume;
        if (this.muted) this.bgm.muted = true;
      } catch (e) {
        console.warn('BGM error', e);
      }
    }
  
    stopBgm({ fadeOutMs = 0 } = {}) {
      if (!this.bgm) return;
      if (fadeOutMs > 0) {
        this._fadeVolume(this.bgm, this.bgm.volume, 0, fadeOutMs).then(() => {
          try { this.bgm.pause(); this.bgm.src = ''; } catch(e){}
          this.bgm = null; this.bgmSrc = null;
        });
      } else {
        try { this.bgm.pause(); this.bgm.src = ''; } catch(e){}
        this.bgm = null; this.bgmSrc = null;
      }
    }
  
    _fadeVolume(audioEl, from, to, ms) {
      return new Promise(resolve => {
        const start = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - start) / ms);
          const v = from + (to - from) * t;
          try { audioEl.volume = v; } catch(e){}
          if (t < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });
    }
  
    async preload(src) {
      if (!src) return;
      const normalizedSrc = this._normalizeSrc(src);
      const a = this._createAudio(normalizedSrc);
      // try to load by playing briefly then pausing to ensure buffer
      try {
        await a.play().catch(()=>{});
        a.pause();
        a.currentTime = 0;
      } catch(e) {
        // ignore
      }
      return a;
    }
  
    async preloadDeath(src) {
      try {
        if (!src) return;
        const normalizedSrc = this._normalizeSrc(src);
        // preload into a dedicated element for reliable play
        this._deathAudio = this._createAudio(normalizedSrc);
        // try to load
        await this._deathAudio.play().catch(()=>{});
        this._deathAudio.pause();
        this._deathAudio.currentTime = 0;
      } catch(e) {
        console.warn('preloadDeath failed', e);
      }
    }
  
    playDeath(src) {
      if (this.muted) return;
      const normalizedSrc = this._normalizeSrc(src);
      const a = this._deathAudio && (!normalizedSrc || this._deathAudio.src === normalizedSrc)
        ? this._deathAudio
        : this._createAudio(normalizedSrc);
      try {
        a.currentTime = 0;
        a.volume = this.volume;
        a.play().catch(err => console.warn('death play blocked', err));
      } catch(e) {
        console.warn('death play error', e);
      }
    }
  
    stopAll() {
      try {
        if (this.bgm) { this.bgm.pause(); this.bgm.src = ''; this.bgm = null; }
        this.sfxPool.forEach(a => { try { a.pause(); a.src = ''; } catch(e){} });
        if (this._deathAudio) { try { this._deathAudio.pause(); this._deathAudio.src = ''; } catch(e){} this._deathAudio = null; }
      } catch(e) { console.warn('stopAll error', e); }
    }
  
    destroy() {
      this.stopAll();
      this.sfxPool.length = 0;
      this.bgm = null;
      this.bgmSrc = null;
      this.unlocked = false;
    }
  }
  
  window.AudioManager = AudioManager;