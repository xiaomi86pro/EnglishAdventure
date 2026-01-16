// src/js/auth/hero_service.js
/**
 * Service xử lý các tác vụ liên quan đến Hero
 */
export class HeroService {
    constructor(supabase) {
        this.supabase = supabase;
    }

    /**
 * Lấy danh sách heroes từ database với unlock status của user
 * @param {string} userId - ID của user hiện tại
 */
async fetchHeroes(userId) {
    try {
        if (!userId) {
            throw new Error('userId is required');
        }

        // 1. Lấy tất cả heroes
        const { data: heroes, error } = await this.supabase
            .from('heroes')
            .select('*, stations(name, order_index, locations(name))')
            .order('id', { ascending: true });

        if (error) throw error;

        // 2. Lấy danh sách heroes đã unlock của user này
        const { data: unlockedHeroes } = await this.supabase
            .from('unlocked_heroes')
            .select('hero_id')
            .eq('profile_id', userId);

        const unlockedIds = new Set(
            (unlockedHeroes || []).map(u => u.hero_id)
        );

        // 3. Merge data: đánh dấu is_locked dựa trên unlocked_heroes
        const heroesWithStatus = heroes.map(hero => ({
            ...hero,
            is_locked: !unlockedIds.has(hero.id) && hero.is_locked // Locked nếu chưa unlock VÀ hero config là locked
        }));

        return heroesWithStatus;

    } catch (err) {
        console.error("Lỗi fetchHeroes:", err.message);
        throw err;
    }
}

/**
 * Kiểm tra hero có bị khóa không (theo user)
 * @param {string} heroId 
 * @param {string} userId 
 */
async isHeroLocked(heroId, userId) {
    try {
        if (!userId) return true;

        // Kiểm tra trong unlocked_heroes
        const { data: unlocked } = await this.supabase
            .from('unlocked_heroes')
            .select('id')
            .eq('profile_id', userId)
            .eq('hero_id', heroId)
            .single();

        // Nếu có record trong unlocked_heroes → unlocked
        if (unlocked) return false;

        // Nếu không có → check config mặc định của hero
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
 * Kiểm tra hero có bị khóa đối với một user cụ thể không
 * @param {string} heroId 
 * @param {string} userId - ID của người chơi (MỚI)
 */
async isHeroLocked(heroId, userId) {
    try {
        // 1. Lấy thông tin gốc của Hero xem có phải hero mặc định không
        const { data: hero } = await this.supabase
            .from('heroes')
            .select('is_locked')
            .eq('id', heroId)
            .single();

        // Nếu hero này mặc định không khóa (is_locked = false trong bảng heroes), thì trả về false luôn
        if (!hero || !hero.is_locked) return false;

        // 2. Nếu hero bị khóa gốc, kiểm tra xem user này đã mở khóa chưa
        if (!userId) return true; // Chưa đăng nhập thì coi như khóa

        const { data: userUnlock } = await this.supabase
            .from('unlocked_heroes')
            .select('*')
            .eq('hero_id', heroId)
            .eq('profile_id', userId)
            .maybeSingle(); // Dùng maybeSingle để không lỗi nếu không tìm thấy

        // Nếu tìm thấy record trong unlocked_heroes, nghĩa là ĐÃ MỞ KHÓA -> return false (không bị khóa)
        if (userUnlock) return false;

        return true; // Vẫn bị khóa
    } catch (err) {
        console.error("Lỗi isHeroLocked:", err.message);
        return true; 
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