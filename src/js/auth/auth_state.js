// src/js/auth/auth_state.js
/**
 * Quản lý state của authentication
 */
export class AuthState {
    constructor() {
        this.selectedUserId = null;
        this.selectedHeroId = null;
        this.tempAvatar = null;
        this.users = [];
        this.containerId = 'questionarea';
        this.availableAvatars = ["🧑‍🚀", "👸", "🤖", "🧸", "🱠", "🶠", "🦊", "🦁"];
    }

    // Lưu game state vào localStorage
    saveGameState(userId, gameState) {
        try {
            localStorage.setItem(`gameState-${userId}`, JSON.stringify(gameState));
            return true;
        } catch (error) {
            console.error('Lỗi lưu game state:', error);
            return false;
        }
    }

    // Kiểm tra xem có game đã lưu không
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

    // Xóa game đã lưu
    clearSavedGame(userId) {
        localStorage.removeItem(`gameState-${userId}`);
    }

    // Reset state
    reset() {
        this.selectedUserId = null;
        this.selectedHeroId = null;
        this.tempAvatar = null;
    }

    // Getters
    getSelectedUserId() {
        return this.selectedUserId;
    }

    getSelectedHeroId() {
        return this.selectedHeroId;
    }

    getUsers() {
        return this.users;
    }

    getAvailableAvatars() {
        return this.availableAvatars;
    }

    // Setters
    setSelectedUserId(id) {
        this.selectedUserId = id;
    }

    setSelectedHeroId(id) {
        this.selectedHeroId = id;
    }

    setTempAvatar(avatar) {
        this.tempAvatar = avatar;
    }

    setUsers(users) {
        this.users = users;
    }
}