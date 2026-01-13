// src/js/auth/auth_component.js
import { AuthState } from './auth_state.js';
import { AuthUI } from './auth_ui.js';
import { UserService } from './user_service.js';
import { HeroService } from './hero_service.js';

/**
 * Component xử lý giao diện chọn User đầu game
 * Kết nối trực tiếp với Supabase qua biến toàn cục window.supabase
 */
class AuthComponent {
    constructor() {
        this.state = new AuthState();
        this.ui = new AuthUI(this.state.containerId);
        this.userService = null;
        this.heroService = null;
    }

    /**
     * Khởi tạo component
     */
    init() {
        // Đợi Supabase client sẵn sàng
        if (!window.supabase) {
            console.warn("AuthComponent: Đang chờ Supabase client...");
            setTimeout(() => this.init(), 500);
            return;
        }

        // Khởi tạo services
        this.userService = new UserService(window.supabase);
        this.heroService = new HeroService(window.supabase);

        // Load local users và hiển thị menu
        const localUsers = this.state.getLocalUsers();
        this.state.setLocalUsers(localUsers);
        console.log("Danh sách Local Users:", localUsers);  
        this.displayLoginMenu();
    }

    /**
     * Hiển thị menu login
     */
    displayLoginMenu() {
        this.state.reset();
        const localUsers = this.state.getLocalUsers();
        this.ui.displayLoginMenu(localUsers);
    }

    /**
     * Chọn local user (điền tên vào form)
     */
    selectLocalUser(userId, displayName) {
        this.ui.highlightSelectedLocalUser(userId);
        this.ui.fillLoginUsername(displayName);
    }

    /**
     * Xóa user khỏi local users
     */
    removeLocalUser(userId) {
        if (!confirm('Xóa người chơi này khỏi danh sách?')) return;
        
        this.state.removeLocalUser(userId);
        this.displayLoginMenu();
    }

    /**
     * Hiển thị form đăng ký
     */
    displayRegisterForm() {
        const avatars = this.state.getAvailableAvatars();
        this.state.setTempAvatar(avatars[0]);
        this.ui.displayRegisterForm(avatars);
    }

    /**
     * Chọn avatar khi đăng ký
     */
    selectAvatar(emoji) {
        this.state.setTempAvatar(emoji);
    }

    /**
     * Xử lý đăng ký user mới
     */
    async handleRegister() {
        const usernameInput = document.getElementById('register-username');
        const passwordInput = document.getElementById('register-password');
        
        if (!usernameInput || !passwordInput) return;
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        
        if (!username) {
            alert('Vui lòng nhập tên!');
            return;
        }
        
        if (!password) {
            alert('Vui lòng nhập mật khẩu!');
            return;
        }

        if (password.length < 4) {
            alert('Mật khẩu phải có ít nhất 4 ký tự!');
            return;
        }

        this.ui.updateButtonState('btn-confirm-register', 'Đang tạo...', true);

        try {
            const newUser = await this.userService.createUser(
                username, 
                password, 
                this.state.tempAvatar
            );
            
            console.log("Đăng ký thành công:", newUser);
            
            // Lưu vào local users
            this.state.saveLocalUser(newUser);
            
            alert('✅ Đăng ký thành công! Bây giờ bạn có thể đăng nhập.');
            
            // Quay về màn hình login
            this.displayLoginMenu();
            
        } catch (err) {
            console.error("Lỗi handleRegister:", err);
            alert(`Lỗi: ${err.message}`);
            this.ui.updateButtonState('btn-confirm-register', 'Tạo tài khoản', false);
        }
    }

    /**
     * Xử lý đăng nhập
     */
    async handleLogin() {
        const usernameInput = document.getElementById('login-username');
        const passwordInput = document.getElementById('login-password');
        
        if (!usernameInput || !passwordInput) return;
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        
        if (!username || !password) {
            alert('Vui lòng nhập đầy đủ tên và mật khẩu!');
            return;
        }

        // Hiển thị loading
        const btnLogin = document.querySelector('button[onclick="AuthComponent.handleLogin()"]');
        if (btnLogin) {
            btnLogin.innerText = 'Đang đăng nhập...';
            btnLogin.disabled = true;
        }

        try {
            const result = await this.userService.verifyLogin(username, password);
            
            if (!result.success) {
                alert(result.message);
                if (btnLogin) {
                    btnLogin.innerText = '🚀 Đăng nhập';
                    btnLogin.disabled = false;
                }
                return;
            }

            console.log("Đăng nhập thành công:", result.user);
            
            // Lưu user vào localStorage
            this.state.saveLocalUser(result.user);
            this.state.setSelectedUserId(result.user.id);

            // Kiểm tra có game đã lưu không
            const savedGame = this.state.checkSavedGame(result.user.id);
            
            if (savedGame) {
                // Có game đã lưu → Hiện menu Continue/New
                this.ui.displayContinueOrNewMenu(savedGame);
            } else {
                // Chưa có game → Chọn hero
                this.ui.displayHeroSelection();
                this.loadHeroList();
            }
            
        } catch (err) {
            console.error("Lỗi handleLogin:", err);
            alert(`Lỗi: ${err.message}`);
            if (btnLogin) {
                btnLogin.innerText = '🚀 Đăng nhập';
                btnLogin.disabled = false;
            }
        }
    }

    /**
     * Continue game đã lưu
     */
    continueGame() {
        const savedGame = this.state.checkSavedGame(this.state.getSelectedUserId());
        if (!savedGame) {
            alert('Không tìm thấy game đã lưu!');
            this.displayLoginMenu();
            return;
        }
        if (window.GameEngine) {
            window.GameEngine.restoreGameState(savedGame);
        }
    }

    /**
     * Bắt đầu game mới (xóa save cũ)
     */
    startNewGame() {
        if (!confirm('Bạn có chắc muốn chơi lại từ đầu? Game cũ sẽ bị xóa!')) return;
        
        this.state.clearSavedGame(this.state.getSelectedUserId());
        
        // Hiển thị màn hình chọn hero
        this.ui.displayHeroSelection();
        this.loadHeroList();
    }

    /**
     * Load danh sách heroes
     */
    async loadHeroList() {
        this.ui.showHeroListLoading();

        try {
            const heroes = await this.heroService.fetchHeroes();
            this.ui.displayHeroList(heroes);
        } catch (err) {
            console.error("Lỗi loadHeroList:", err);
            const heroListContainer = document.getElementById('hero-list');
            if (heroListContainer) {
                heroListContainer.innerHTML = "<p class='text-red-500 text-xs'>Lỗi tải Hero</p>";
            }
        }
    }

    /**
     * Chọn hero
     */
    async pickHero(heroId) {
        // Kiểm tra hero có bị khóa không
        const isLocked = await this.heroService.isHeroLocked(heroId);
        if (isLocked) {
            alert('Hero này đang bị khóa! Hãy hoàn thành nhiệm vụ để mở khóa.');
            return;
        }

        this.ui.highlightSelectedHero(heroId);
        this.state.setSelectedHeroId(heroId);
        this.ui.enableStartButton();
    }

    /**
     * Bắt đầu game
     */
    async startGame() {
        // Kiểm tra xem đã chọn đầy đủ chưa
        if (!this.state.getSelectedUserId() || !this.state.getSelectedHeroId()) {
            alert("Vui lòng chọn hiệp sĩ!");
            return;
        }

        // Phát âm thanh intro
        try {
            const introSound = new Audio('https://xiaomi86pro.github.io/EnglishAdventure/sounds/StartGame.mp3');
            introSound.currentTime = 0;
            introSound.play().catch(e => console.log('Không thể phát âm thanh:', e));
        } catch (e) {
            console.log('Lỗi audio:', e);
        }

        this.ui.updateButtonState('btn-start', 'Đang chuẩn bị...', true);

        try {
            // 1. Lưu selected_hero_id vào profiles
            await this.userService.updateSelectedHero(
                this.state.getSelectedUserId(), 
                this.state.getSelectedHeroId()
            );

            // 2. Lấy thông tin đầy đủ user kèm hero
            const userData = await this.userService.getUserWithHero(this.state.getSelectedUserId());
            userData.selected_hero_id = this.state.getSelectedHeroId();

            // 3. Khởi động GameEngine
            if (window.GameEngine) {
                window.GameEngine.start(userData);
            } else {
                throw new Error('GameEngine chưa sẵn sàng');
            }

        } catch (err) {
            console.error("Lỗi startGame:", err);
            alert(`Lỗi: ${err.message}`);
            this.ui.updateButtonState('btn-start', 'Vào Trận!', false);
        }
    }
}

// Tạo instance và expose ra window
const authComponent = new AuthComponent();
window.AuthComponent = authComponent;

export default authComponent;