/**
 * LeaderboardWidget.js
 * Widget hiển thị Top 10 ở sidebar bên trái (luôn hiện)
 */

import DOMUtil from '@/js/utils/DOMUtil.js';

export class LeaderboardWidget {
    constructor(supabase) {
        this.supabase = supabase;
    }

    /**
     * Lấy top 10 players
     */
    async fetchTopPlayers() {
        try {
            const { data, error } = await this.supabase
                .from('profiles')
                .select('display_name, avatar_key, level, coin')
                .order('level', { ascending: false })
                .order('coin', { ascending: false })
                .limit(10);

            if (error) throw error;
            return data || [];

        } catch (err) {
            console.error('[LeaderboardWidget] Error:', err);
            return [];
        }
    }

    /**
     * Render widget vào userUI
     */
    async render() {
        const listContainer = DOMUtil.getById('leaderboard-list');
        if (!listContainer) {
            console.warn('[LeaderboardWidget] leaderboard-list not found');
            return;
        }
    
        // Hiển thị loading
        listContainer.innerHTML = '<p class="text-white/50 text-xs text-center">Đang tải...</p>';
    
        // Fetch data
        const topPlayers = await this.fetchTopPlayers();
    
        // Render list
        this._renderList(topPlayers);
    }
    
    /**
     * Render danh sách players
     * @private
     */
    _renderList(players) {
        const list = DOMUtil.getById('leaderboard-list');
        if (!list) return;

        if (players.length === 0) {
            list.innerHTML = '<p class="text-white/50 text-xs text-center">Chưa có dữ liệu</p>';
            return;
        }

        list.innerHTML = players.map((player, index) => {
            const rank = index + 1;
            let medalEmoji = '';
            let bgClass = 'bg-white/10';
            
            if (rank === 1) {
                medalEmoji = '🥇';
                bgClass = 'bg-yellow-400/30 border border-yellow-400';
            } else if (rank === 2) {
                medalEmoji = '🥈';
                bgClass = 'bg-gray-300/30 border border-gray-400';
            } else if (rank === 3) {
                medalEmoji = '🥉';
                bgClass = 'bg-orange-400/30 border border-orange-400';
            }

            return `
                <div class="${bgClass} rounded-xl p-2 flex items-center gap-2">
                    <div class="w-6 text-center font-bold text-white text-sm">
                        ${medalEmoji || rank}
                    </div>
                    <div class="text-xl">${player.avatar_key || '👤'}</div>
                    <div class="flex-1 min-w-0">
                        <p class="text-black font-bold text-xs truncate">${player.display_name}</p>
                        <div class="flex items-center gap-2 text-[10px]">
                            <span class="text-blue-300">⚡${player.level}</span>
                            <span class="text-yellow-300">💰${player.coin || 0}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Refresh data (gọi lại khi cần update)
     */
    async refresh() {
        const topPlayers = await this.fetchTopPlayers();
        this._renderList(topPlayers);
    }
}

// Expose ra window
//window.LeaderboardWidget = LeaderboardWidget;

// Export
export default LeaderboardWidget;