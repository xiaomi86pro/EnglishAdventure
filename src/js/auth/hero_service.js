// src/js/auth/hero_service.js
/**
 * Service xử lý các tác vụ liên quan đến Hero
 */
export class HeroService {
    constructor(supabase) {
        this.supabase = supabase;
    }

    /**
     * Lấy danh sách heroes từ database
     */
    async fetchHeroes() {
        try {
            const { data: heroes, error } = await this.supabase
                .from('heroes')
                .select('*, stations(name, order_index, locations(name))');

            if (error) throw error;
            
            return heroes || [];
        } catch (err) {
            console.error("Lỗi fetchHeroes:", err.message);
            throw err;
        }
    }

    /**
     * Kiểm tra hero có bị khóa không
     */
    async isHeroLocked(heroId) {
        try {
            const { data: hero } = await this.supabase
                .from('heroes')
                .select('is_locked')
                .eq('id', heroId)
                .single();
            
            return hero?.is_locked || false;
        } catch (err) {
            console.error("Lỗi isHeroLocked:", err.message);
            return true; // Mặc định là locked nếu có lỗi
        }
    }

    /**
     * Lấy thông tin chi tiết của 1 hero
     */
    async getHeroById(heroId) {
        try {
            const { data, error } = await this.supabase
                .from('heroes')
                .select('*, stations(name, order_index, locations(name))')
                .eq('id', heroId)
                .single();

            if (error) throw error;
            
            return data;
        } catch (err) {
            console.error("Lỗi getHeroById:", err.message);
            throw err;
        }
    }
}