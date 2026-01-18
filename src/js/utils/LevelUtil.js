/**
 * LevelUtil.js
 * Tính toán EXP và Level
 */

class LevelUtil {
    /**
     * Tính exp cần để lên level tiếp theo
     * Formula: 100 + (level - 1) * 50
     * Level 1 -> 2: 100 exp
     * Level 2 -> 3: 150 exp
     * Level 3 -> 4: 200 exp
     * @param {number} currentLevel 
     * @returns {number}
     */
    static getExpForNextLevel(currentLevel) {
        return 100 + (currentLevel - 1) * 50;
    }

    /**
     * Tính tổng exp cần từ level 1 đến level X
     * @param {number} targetLevel 
     * @returns {number}
     */
    static getTotalExpForLevel(targetLevel) {
        let total = 0;
        for (let i = 1; i < targetLevel; i++) {
            total += this.getExpForNextLevel(i);
        }
        return total;
    }

    /**
     * Kiểm tra có level up không
     * @param {number} currentExp 
     * @param {number} currentLevel 
     * @returns {Object} - { leveledUp: boolean, newLevel: number, remainingExp: number }
     */
    static checkLevelUp(currentExp, currentLevel) {
        let exp = currentExp;
        let level = currentLevel;
        let leveledUp = false;

        while (exp >= this.getExpForNextLevel(level)) {
            exp -= this.getExpForNextLevel(level);
            level++;
            leveledUp = true;
        }

        return {
            leveledUp,
            newLevel: level,
            remainingExp: exp
        };
    }

    /**
     * Tính % progress đến level tiếp theo
     * @param {number} currentExp 
     * @param {number} currentLevel 
     * @returns {number} - 0-100
     */
    static getLevelProgress(currentExp, currentLevel) {
        const expNeeded = this.getExpForNextLevel(currentLevel);
        return Math.min(100, (currentExp / expNeeded) * 100);
    }
}

// Expose ra window
window.LevelUtil = LevelUtil;

// Export
export default LevelUtil;