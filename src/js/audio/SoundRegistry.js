/**
 * SoundRegistry
 *
 * Responsibilities:
 * - Fetch sound records from Supabase `sounds` table
 * - Cache sound records in memory by key
 * - Provide init() and play(key)
 *
 * Record fields used: key, url, volume, loop
 */
class SoundRegistry {
    /**
     * @param {Object} deps
     * @param {import('@supabase/supabase-js').SupabaseClient} deps.supabase
     * @param {Object} deps.audioManager - Existing AudioManager instance
     * @param {string} [deps.tableName='sounds']
     */
    constructor({ supabase, audioManager, tableName = 'sounds' } = {}) {
        this.supabase = supabase || null;
        this.audioManager = audioManager || null;
        this.tableName = tableName;

        /** @type {Map<string, { key: string, url: string, volume: number|null, loop: boolean|null }>} */
        this.sounds = new Map();
        this.initialized = false;
        this._initPromise = null;
    }

    /**
     * Fetch and cache all enabled sounds from Supabase.
     * Safe to call multiple times.
     * @returns {Promise<Map<string, { key: string, url: string, volume: number|null, loop: boolean|null }>>}
     */
    async init() {
        if (this.initialized) return this.sounds;
        if (this._initPromise) return this._initPromise;

        this._initPromise = (async () => {
            if (!this.supabase) {
                throw new Error('[SoundRegistry] Missing supabase client');
            }

            const { data, error } = await this.supabase
                .from(this.tableName)
                .select('key,url,volume,loop,enabled')
                .eq('enabled', true);

            if (error) {
                throw new Error(`[SoundRegistry] Failed to load sounds: ${error.message}`);
            }

            this.sounds.clear();
            for (const row of data || []) {
                if (!row?.key || !row?.url) continue;
                this.sounds.set(row.key, {
                    key: row.key,
                    url: row.url,
                    volume: typeof row.volume === 'number' ? row.volume : null,
                    loop: typeof row.loop === 'boolean' ? row.loop : null
                });
            }

            this.initialized = true;
            return this.sounds;
        })();

        try {
            return await this._initPromise;
        } finally {
            this._initPromise = null;
        }
    }

    /**
     * Play a sound by key from cache (auto-initialize if needed).
     * - loop=true => AudioManager.playBgm(url, { loop: true })
     * - otherwise => AudioManager.playSfx(url)
     *
     * @param {string} key
     * @returns {Promise<boolean>} true if played, false if key not found or missing dependencies
     */
    async play(key) {
        if (!key || !this.audioManager) return false;

        if (!this.initialized) {
            await this.init();
        }

        const sound = this.sounds.get(key);
        if (!sound?.url) {
            console.warn('[SoundRegistry] Sound key not found:', key);
            return false;
        }

        if (sound.loop) {
            await this.audioManager.playBgm(sound.url, { loop: true });
            return true;
        }

        this.audioManager.playSfx(sound.url);
        return true;
    }
}

window.SoundRegistry = SoundRegistry;

export default SoundRegistry;
