// src/js/auth/auth_state.js
/**
 * Quản lý state của authentication
 */
export class AuthState {
    constructor() {
        this.selectedUserId = null;
        this.selectedHeroId = null;
        this.tempAvatar = null;
        this.tempPassword = null;
        this.users = [];
        this.role = null;
        this.localUsers = []; // Users đã login trên máy này
        this.containerId = 'questionarea';
        this.availableAvatars = ["🧑‍🚀", "👸", "🤖", "🧸", "❄️", "⛄", "🦊", "🦁"];
    }

    // ===== LOCAL STORAGE - LOCAL USERS =====
    
    /**
     * Lưu user vào danh sách local users (đã login trên máy này)
     */
    saveLocalUser(user) {
        try {
            let localUsers = this.getLocalUsers();
            
            // Kiểm tra xem user đã tồn tại chưa
            const existingIndex = localUsers.findIndex(u => u.id === user.id);
            
            if (existingIndex >= 0) {
                // Cập nhật thông tin user
                localUsers[existingIndex] = {
                    id: user.id,
                    display_name: user.display_name,
                    avatar_key: user.avatar_key,
                    last_login: new Date().toISOString()
                };
            } else {
                // Thêm user mới
                localUsers.push({
                    id: user.id,
                    display_name: user.display_name,
                    avatar_key: user.avatar_key,
                    last_login: new Date().toISOString()
                });
            }
            
            localStorage.setItem('localUsers', JSON.stringify(localUsers));
            this.localUsers = localUsers;
            return true;
        } catch (error) {
            console.error('Lỗi lưu local user:', error);
            return false;
        }
    }

    /**
     * Lấy danh sách local users
     */
    getLocalUsers() {
        try {
            const saved = localStorage.getItem('localUsers');
            if (!saved) return [];
            
            const users = JSON.parse(saved);
            // Sắp xếp theo last_login mới nhất
            return users.sort((a, b) => 
                new Date(b.last_login) - new Date(a.last_login)
            );
        } catch (error) {
            console.error('Lỗi load local users:', error);
            return [];
        }
    }

    /**
     * Xóa user khỏi local users
     */
    removeLocalUser(userId) {
        try {
            let localUsers = this.getLocalUsers();
            localUsers = localUsers.filter(u => u.id !== userId);
            localStorage.setItem('localUsers', JSON.stringify(localUsers));
            this.localUsers = localUsers;
            return true;
        } catch (error) {
            console.error('Lỗi xóa local user:', error);
            return false;
        }
    }

    // ===== LOCAL STORAGE - GAME STATE =====
    
    /**
     * Lưu game state vào localStorage
     */
    saveGameState(userId, gameState) {
        try {
            localStorage.setItem(`gameState-${userId}`, JSON.stringify(gameState));
            return true;
        } catch (error) {
            console.error('Lỗi lưu game state:', error);
            return false;
        }
    }

    /**
     * Kiểm tra xem có game đã lưu không
     */
    checkSavedGame(userId) {
        const saved = localStorage.getItem(`gameState-${userId}`);
        if (!saved) return null;
        try {
            return JSON.parse(saved);
        } catch (e) {
            console.error('Lỗi load game:', e);
            return null;
        }
    }

    /**
     * Xóa game đã lưu
     */
    clearSavedGame(userId) {
        localStorage.removeItem(`gameState-${userId}`);
    }

    // ===== STATE MANAGEMENT =====
    
    /**
     * Reset state
     */
    reset() {
        this.selectedUserId = null;
        this.selectedHeroId = null;
        this.tempAvatar = null;
        this.tempPassword = null;
    }

    // ===== GETTERS =====
    
    getSelectedUserId() {
        return this.selectedUserId;
    }

    getSelectedHeroId() {
        return this.selectedHeroId;
    }

    getUsers() {
        return this.users;
    }

    getLocalUsersFromState() {
        if (!this.localUsers || this.localUsers.length === 0) {
            this.localUsers = this.loadLocalUsersFromStorage();
        }
        return this.localUsers;
    }

    loadLocalUsersFromStorage() {
        try {
            const saved = localStorage.getItem('localUsers');
            if (!saved) return [];
            
            const users = JSON.parse(saved);
            // Sắp xếp theo last_login mới nhất
            return users.sort((a, b) => 
                new Date(b.last_login) - new Date(a.last_login)
            );
        } catch (error) {
            console.error('Lỗi load local users:', error);
            return [];
        }
    }

    getAvailableAvatars() {
        return this.availableAvatars;
    }

    getTempPassword() {
        return this.tempPassword;
    }

    // ===== SETTERS =====
    
    setSelectedUserId(id) {
        this.selectedUserId = id;
    }

    setSelectedHeroId(id) {
        this.selectedHeroId = id;
    }

    setTempAvatar(avatar) {
        this.tempAvatar = avatar;
    }

    setTempPassword(password) {
        this.tempPassword = password;
    }

    setUsers(users) {
        this.users = users;
    }

    setLocalUsers(users) {
        this.localUsers = users;
    }
}