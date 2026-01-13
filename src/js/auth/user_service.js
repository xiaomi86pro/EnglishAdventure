// src/js/auth/user_service.js
/**
 * Service xử lý các tác vụ liên quan đến User/Profile
 */
export class UserService {
    constructor(supabase) {
        this.supabase = supabase;
    }

    /**
     * Lấy danh sách users từ Supabase
     */
    async fetchUsers() {
        try {
            const { data, error } = await this.supabase
                .from('profiles')
                .select('*')
                .limit(4);

            if (error) throw error;
            
            return data || [];
        } catch (err) {
            console.error("Lỗi fetchUsers:", err.message);
            throw err;
        }
    }

    /**
     * Tạo user mới
     */
    async createUser(displayName, avatarKey) {
        try {
            const { data, error } = await this.supabase
                .from('profiles')
                .insert([{ 
                    display_name: displayName, 
                    avatar_key: avatarKey,
                    level: 1,
                    exp: 0,
                    hp_current: 0
                }])
                .select();

            if (error) throw error;
            
            return data[0];
        } catch (err) {
            console.error("Lỗi createUser:", err.message);
            throw err;
        }
    }

    /**
     * Cập nhật hero đã chọn cho user
     */
    async updateSelectedHero(userId, heroId) {
        try {
            const { error } = await this.supabase
                .from('profiles')
                .update({ selected_hero_id: heroId })
                .eq('id', userId);

            if (error) throw error;
            
            return true;
        } catch (err) {
            console.error("Lỗi updateSelectedHero:", err.message);
            throw err;
        }
    }

    /**
     * Lấy thông tin user kèm hero
     */
    async getUserWithHero(userId) {
        try {
            const { data, error } = await this.supabase
                .from('profiles')
                .select('*, heroes(*)')
                .eq('id', userId)
                .single();

            if (error) throw error;
            
            return data;
        } catch (err) {
            console.error("Lỗi getUserWithHero:", err.message);
            throw err;
        }
    }
}