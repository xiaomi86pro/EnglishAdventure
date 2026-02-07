// src/js/auth/auth_component.js
import { AuthState } from './auth_state.js';
import { AuthUI } from './auth_ui.js';
import { UserService } from './user_service.js';
import { HeroService } from './hero_service.js';
import LeaderboardWidget from '@/js/LeaderboardWidget.js';
import SaveGameService from '../services/SaveGameService.js'; 

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
        this.saveGameService = null;
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
        this.saveGameService = new SaveGameService(window.supabase);

        // ✅ Khởi tạo và render LeaderboardWidget
        if (!window.LeaderboardWidget) {
            window.LeaderboardWidget = new LeaderboardWidget(window.supabase);
        }
        window.LeaderboardWidget.render();

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
        
            // ✅ Kiểm tra có game đã lưu trên CLOUD không
            const savedGameResult = await this.saveGameService.load(result.user.id);
            
            if (savedGameResult.success && savedGameResult.data) {
                // Có save game → Hiện menu Continue/New
                // Format lại data để khớp với UI
                const formattedSave = {
                    player: {
                        id: result.user.id,
                        display_name: result.user.display_name,
                        avatar_key: result.user.avatar_key,
                        sprite: result.user.avatar_key,
                        level: result.user.level || 1
                    },
                    currentStationName: 'Saved Game',  // Có thể load tên station nếu cần
                    currentStep: savedGameResult.data.current_step || 1
                };
                
                this.ui.displayContinueOrNewMenu(formattedSave);
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
    async continueGame() {
        const userId = this.state.getSelectedUserId();
     
        try {
            // 1. Load saved game từ cloud
            const saveResult = await this.saveGameService.load(userId);
            
            if (!saveResult.success || !saveResult.data) {
                alert('Không tìm thấy game đã lưu!');
                this.displayLoginMenu();
                return;
            }
            
            const cloudSave = saveResult.data;
            
            // 2. Load full user data từ profiles
            const userData = await this.userService.getUserWithHero(userId);
            
            // 3. Load hero data
            const { data: heroData } = await window.supabase
                .from('heroes')
                .select('*')
                .eq('id', userData.selected_hero_id)
                .single();
            
            // 4. Tính stats với level bonus
            const playerLevel = userData.level || 1;
            const hpBonus = userData.hp_bonus || 0;  // ✅ Từ profiles
            const atkBonus = userData.base_atk || 0;
            const defBonus = userData.base_def || 0;

            // ✅ max_hp = hero_base_hp + hp_bonus (KHÔNG tính lại từ level)
            const maxHP = heroData.base_hp + hpBonus;
            
            // 5. Format savedGame object theo cấu trúc GameEngine.restoreGameState() cần
            const formattedSave = {
                player: {
                    id: userData.id,
                    display_name: userData.display_name,
                    avatar_key: userData.avatar_key,
                    level: playerLevel,
                    exp: userData.exp || 0,
                    coin: userData.coin || 0,
                    role: userData.role,

                    base_hp: heroData.base_hp,
                    hp_bonus: userData.hp_bonus || 0,  // ✅ THÊM DÒNG NÀY
                    max_hp: heroData.base_hp + (userData.hp_bonus || 0),  // ✅ SỬA
                    hp_current: cloudSave.current_hp,
                    
                    // ATK
                    base_atk: heroData.base_atk,
                    atk: atkBonus + (userData.base_atk || 0),
                    hero_base_atk: heroData.base_atk,
                    
                    // DEF
                    base_def: heroData.base_def || 0,
                    def: defBonus + (userData.base_def || 0),
                    hero_base_def: heroData.base_def || 0,
                    
                    sprite_url: heroData.image_url,
                    selected_hero_id: userData.selected_hero_id,
                    equipped_weapon: userData.equipped_weapon,
                    equipped_armor: userData.equipped_armor,
                    password: userData.password
                },
                currentLocationId: cloudSave.current_location_id,
                currentStationId: cloudSave.current_station_id,
                currentStep: cloudSave.current_step,
                isEndlessMode: cloudSave.is_endless_mode || false,
                monster: cloudSave.monster_id ? {
                    id: cloudSave.monster_id,
                    hp: cloudSave.monster_hp,
                    questionType: cloudSave.monster_question_type || null
                } : null
            };
            
            // 6. Restore game
            if (window.GameEngine) {
                await window.GameEngine.restoreGameState(formattedSave);
            }

               // Nếu endless mode → Ẩn progress bar, hiện text "Luyện Tập"
            if (window.GameEngine?.isEndlessMode) {
                // Ẩn progress bar
                const progressBar = document.getElementById('progress-bar');
                if (progressBar) progressBar.style.display = 'none';
                
                // Hiện text "Luyện Tập"
                const stationName = document.getElementById('station-name');
                if (stationName) stationName.textContent = '⚔️ LUYỆN TẬP';
            }
            
        } catch (err) {
            console.error('Lỗi continueGame:', err);
            alert('Lỗi khi tiếp tục game: ' + err.message);
            this.displayLoginMenu();
        }
    }

    /**
     * Bắt đầu game mới (xóa save cũ)
     */
    async startNewGame() {
        if (!confirm('Bạn có chắc muốn chơi lại từ đầu? Game cũ sẽ bị xóa!')) return;
        
        const userId = this.state.getSelectedUserId();
        
        // Xóa save trên cloud
        await this.saveGameService.delete(userId);
        
        // Xóa localStorage (backup)
        this.state.clearSavedGame(userId);
        
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
        const userId = this.state.getSelectedUserId();
        
        // ✅ Truyền userId vào
        const heroes = await this.heroService.fetchHeroes(userId);
        
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
    const userId = this.state.getSelectedUserId();
    
    // ✅ Truyền userId vào
    const isLocked = await this.heroService.isHeroLocked(heroId, userId);
    
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