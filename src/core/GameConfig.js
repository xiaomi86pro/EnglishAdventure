/**
 * GameConfig.js
 * Chứa tất cả constants, settings, và configuration cho game
 */

const GameConfig = {
    // Gameplay constants
    TOTAL_STEPS_PER_STATION: 10,
    
    // HP restore khi đánh bại monster
    HP_RESTORE: {
        normal: 0,
        elite: 20,
        boss: 50,
        'final boss': 50
    },
    
    // CSS size classes cho từng loại monster
    MONSTER_SIZE_CLASSES: {
        normal: 'size-normal',
        elite: 'size-elite',
        boss: 'size-boss',
        'final boss': 'size-fboss'
    },
    
    // BGM theo loại monster
    MONSTER_BGM: {
        boss: './sounds/Boss_Battle.mp3',
        'final boss': './sounds/Final_Boss.mp3'
    },
    
    // Default question type theo monster type
    DEFAULT_QUESTION_TYPES: {
        normal: 1,
        elite: 2,
        boss: 3,
        'final boss': 4
    },
    
    // Sound effects paths
    SOUNDS: {
        attack: './sounds/Slicing_flesh.mp3',
        hit: './sounds/Punch.mp3',
        heal: './sounds/Heal.mp3',
        death: './sounds/Game_Over.mp3',
        startGame: './sounds/StartGame.mp3'
    },
    
    // Animation timings (ms)
    TIMINGS: {
        attackAnimation: 400,
        damageDelay: 200,
        shakeEffect: 400,
        starEffect: 700,
        healEffect: 1500,
        monsterDefeatDelay: 1500,
        heroDefeatDelay: 1000,
        battleRoundDelay: 200
    },
    
    // UI Colors
    COLORS: {
        hpLow: '#ef4444',
        hpNormal: '#22c55e',
        hpBar: '#22c55e'
    },
    
    // Default monster (fallback khi không có config)
    DEFAULT_MONSTER: {
        name: "??? (Chưa config)",
        hp: 50,
        max_hp: 50,
        atk: 5,
        type: "normal",
        state: 'idle',
        isDead: false,
        sprite_url: "https://via.placeholder.com/64",
        questionType: 1
    },
    
    // Debug mode
    DEBUG: false,
    
    // Helper method: Lấy question type mặc định
    getDefaultQuestionType(monsterType) {
        return this.DEFAULT_QUESTION_TYPES[monsterType] || 1;
    },
    
    // Helper method: Lấy HP restore amount
    getHPRestore(monsterType) {
        return this.HP_RESTORE[monsterType] || 0;
    },
    
    // Helper method: Lấy size class
    getMonsterSizeClass(monsterType) {
        return this.MONSTER_SIZE_CLASSES[monsterType] || 'size-normal';
    },
    
    // Helper method: Lấy BGM path
    getMonsterBGM(monsterType) {
        return this.MONSTER_BGM[monsterType] || null;
    }
};

// ⭐ Expose ra window TRƯỚC KHI export
window.GameConfig = GameConfig;

// Export để các module khác import
export default GameConfig;