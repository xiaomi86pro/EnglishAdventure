// src/js/auth/user_service.js
/**
 * Service xử lý các tác vụ liên quan đến User/Profile
 */
export class UserService {
    constructor(supabase) {
        this.supabase = supabase;
    }

    /**
     * Lấy danh sách users từ Supabase (không dùng nữa - chỉ để backup)
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
     * Xác thực đăng nhập với username và password
     */
    async verifyLogin(username, password) {
        try {
            const { data, error } = await this.supabase
                .from('profiles')
                .select('*')
                .eq('display_name', username)
                .eq('password', password)
                .maybeSingle();

            if (error) {
                if (error.code === 'PGRST116') {
                    // Không tìm thấy user hoặc sai password
                    return { success: false, message: 'Tên hoặc mật khẩu không đúng!' };
                }
                throw error;
            }
            
            return { success: true, user: data };
        } catch (err) {
            console.error("Lỗi verifyLogin:", err.message);
            return { success: false, message: err.message };
        }
    }

    /**
     * Tạo user mới (thêm password)
     */
    async createUser(displayName, password, avatarKey) {
        try {
            // Kiểm tra xem tên đã tồn tại chưa
            const { data: existing } = await this.supabase
                .from('profiles')
                .select('id')
                .eq('display_name', displayName)
                .maybeSingle();

            if (existing) {
                throw new Error('Tên này đã được sử dụng!');
            }

            // Tạo user mới
            const { data, error } = await this.supabase
                .from('profiles')
                .insert([{ 
                    display_name: displayName,
                    password: password,
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
                .maybeSingle();

            if (error) throw error;
            
            return data;
        } catch (err) {
            console.error("Lỗi getUserWithHero:", err.message);
            throw err;
        }
    }

    /**
     * Lấy thông tin user theo tên
     */
    async getUserByName(displayName) {
        try {
            const { data, error } = await this.supabase
                .from('profiles')
                .select('*')
                .eq('display_name', displayName)
                .maybeSingle();

            if (error) throw error;
            
            return data;
        } catch (err) {
            console.error("Lỗi getUserByName:", err.message);
            throw err;
        }
    }
}