/**
 * SaveGameService.js
 * Xử lý lưu/load game từ cloud (Supabase)
 */

class SaveGameService {
    constructor(supabase) {
        this.supabase = supabase;
    }

    /**
     * Lưu game state lên cloud
     */
    async save(profileId, gameState) {
        try {
            const saveData = {
                profile_id: profileId,
                current_hp: gameState.hp_current,
                current_location_id: gameState.isEndlessMode ? null : gameState.location_id,  // ← NULL nếu endless
                current_station_id: gameState.isEndlessMode ? null : gameState.station_id,    // ← NULL nếu endless
                current_step: gameState.step,
                is_endless_mode: gameState.isEndlessMode || false,
                monster_id: gameState.monster?.id || null,
                monster_hp: gameState.monster?.hp || null,
                saved_at: new Date().toISOString()
            };

            const { data, error } = await this.supabase
                .from('save_games')
                .upsert(saveData, { onConflict: 'profile_id' })
                .select()
                .single();

            if (error) throw error;

            console.log('[SaveGameService] Game saved to cloud:', data);
            return { success: true, data };

        } catch (err) {
            console.error('[SaveGameService] Save error:', err);
            return { success: false, error: err.message };
        }
    }

    /**
     * Load game state từ cloud
     */
    async load(profileId) {
        try {
            const { data, error } = await this.supabase
                .from('save_games')
                .select('*')
                .eq('profile_id', profileId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // Không tìm thấy save game - trả về null
                    return { success: true, data: null };
                }
                throw error;
            }

            console.log('[SaveGameService] Game loaded from cloud:', data);
            return { success: true, data };

        } catch (err) {
            console.error('[SaveGameService] Load error:', err);
            return { success: false, error: err.message };
        }
    }

    /**
     * Xóa save game (khi hero chết)
     */
    async delete(profileId) {
        try {
            const { error } = await this.supabase
                .from('save_games')
                .delete()
                .eq('profile_id', profileId);

            if (error) throw error;

            console.log('[SaveGameService] Save game deleted');
            return { success: true };

        } catch (err) {
            console.error('[SaveGameService] Delete error:', err);
            return { success: false, error: err.message };
        }
    }

    /**
     * Check xem có save game không
     */
    async hasSaveGame(profileId) {
        const result = await this.load(profileId);
        return result.success && result.data !== null;
    }
}

// Expose
window.SaveGameService = SaveGameService;
export default SaveGameService;