/**
 * ProgressionManager.js
 * Quản lý tiến trình game: location -> station -> step
 */

class ProgressionManager {
    constructor(supabase, monsterHandler) {
        this.supabase = supabase;
        this.monsterHandler = monsterHandler;
    }

    /**
     * Load location đầu tiên và station đầu tiên
     * @returns {Object} - { location, station }
     */
    async loadFirstLocation() {
        try {
            // 1. Lấy location đầu tiên (order_index = 1)
            const { data: location, error: locError } = await this.supabase
                .from('locations')
                .select('*')
                .order('order_index', { ascending: true })
                .limit(1)
                .maybeSingle();

            if (locError) throw locError;

            // 2. Lấy station đầu tiên của location này
            const { data: station, error: stError } = await this.supabase
                .from('stations')
                .select('*')
                .eq('location_id', location.id)
                .order('order_index', { ascending: true })
                .limit(1)
                .maybeSingle();

            if (stError) throw stError;

            console.log('[ProgressionManager] Loaded:', location.name, '>', station.name);

            return {
                location,
                station
            };

        } catch (err) {
            console.error('[ProgressionManager] Lỗi load first location:', err);
            throw err;
        }
    }

    /**
     * Load station tiếp theo trong cùng location
     * @param {Object} currentLocation 
     * @param {Object} currentStation 
     * @returns {Object|null} - { station } hoặc null nếu hết station
     */
    async loadNextStation(currentLocation, currentStation) {
        try {
            // Lấy station tiếp theo
            const { data: nextStation, error } = await this.supabase
                .from('stations')
                .select('*')
                .eq('location_id', currentLocation.id)
                .gt('order_index', currentStation.order_index)
                .order('order_index', { ascending: true })
                .limit(1)
                .maybeSingle();

            if (error || !nextStation) {
                console.log('[ProgressionManager] Hết station trong location này');
                return null; // Hết station -> cần load location mới
            }

            console.log('[ProgressionManager] Next station:', nextStation.name);
            
            return {
                station: nextStation
            };

        } catch (err) {
            console.error('[ProgressionManager] Lỗi load next station:', err);
            return null;
        }
    }

    /**
     * Load location tiếp theo
     * @param {Object} currentLocation 
     * @returns {Object|null} - { location, station } hoặc null nếu hết game
     */
    async loadNextLocation(currentLocation) {
        try {
            // Lấy location tiếp theo
            const { data: nextLocation, error: locError } = await this.supabase
                .from('locations')
                .select('*')
                .gt('order_index', currentLocation.order_index)
                .order('order_index', { ascending: true })
                .limit(1)
                .maybeSingle();

            if (locError || !nextLocation) {
                console.log('[ProgressionManager] Hết game - không còn location');
                return null; // Hết game
            }

            // Load station đầu tiên của location mới
            const { data: firstStation, error: stError } = await this.supabase
                .from('stations')
                .select('*')
                .eq('location_id', nextLocation.id)
                .order('order_index', { ascending: true })
                .limit(1)
                .maybeSingle();

            if (stError) throw stError;

            console.log('[ProgressionManager] Next location:', nextLocation.name, '>', firstStation.name);

            return {
                location: nextLocation,
                station: firstStation
            };

        } catch (err) {
            console.error('[ProgressionManager] Lỗi load next location:', err);
            return null;
        }
    }

    /**
     * Xử lý progression sau khi đánh bại monster
     * @param {Object} currentLocation 
     * @param {Object} currentStation 
     * @param {number} currentStep 
     * @param {number} totalStepsPerStation 
     * @returns {Object} - { needsNewMonster, location, station, step, gameComplete }
     */
    async advanceAfterMonsterDefeat(currentLocation, currentStation, currentStep, totalStepsPerStation) {
        try {
            const nextStep = currentStep + 1;

            // Case 1: Vẫn còn step trong station hiện tại
            if (nextStep <= totalStepsPerStation) {
                console.log(`[ProgressionManager] Advance to step ${nextStep}/${totalStepsPerStation}`);
                
                return {
                    needsNewMonster: true,
                    location: currentLocation,
                    station: currentStation,
                    step: nextStep,
                    gameComplete: false
                };
            }

            // Case 2: Hết step -> cần station mới
            const nextStationResult = await this.loadNextStation(currentLocation, currentStation);

            if (nextStationResult) {
                console.log('[ProgressionManager] Advance to next station');
                
                return {
                    needsNewMonster: true,
                    location: currentLocation,
                    station: nextStationResult.station,
                    step: 1,
                    gameComplete: false
                };
            }

            // Case 3: Hết station -> cần location mới
            const nextLocationResult = await this.loadNextLocation(currentLocation);

            if (nextLocationResult) {
                console.log('[ProgressionManager] Advance to next location');
                
                return {
                    needsNewMonster: true,
                    location: nextLocationResult.location,
                    station: nextLocationResult.station,
                    step: 1,
                    gameComplete: false
                };
            }

            // Case 4: Hết game
            console.log('[ProgressionManager] 🎉 Game complete!');
            
            return {
                needsNewMonster: false,
                location: currentLocation,
                station: currentStation,
                step: currentStep,
                gameComplete: true
            };

        } catch (err) {
            console.error('[ProgressionManager] Lỗi advance progression:', err);
            throw err;
        }
    }

    /**
     * Lấy thông tin hiển thị của progression
     * @param {Object} location 
     * @param {Object} station 
     * @param {number} step 
     * @param {number} totalSteps 
     * @returns {Object}
     */
    getDisplayInfo(location, station, step, totalSteps) {
        return {
            locationName: location?.name || '...',
            stationName: station?.name || '...',
            currentStep: step || 1,
            totalSteps: totalSteps || 10,
            progress: `${step}/${totalSteps}`,
            progressPercent: ((step / totalSteps) * 100).toFixed(0)
        };
    }

    /**
     * Kiểm tra xem có phải step cuối của station không
     * @param {number} currentStep 
     * @param {number} totalSteps 
     * @returns {boolean}
     */
    isLastStepOfStation(currentStep, totalSteps) {
        return currentStep >= totalSteps;
    }

    /**
     * Lấy tất cả locations (để hiển thị map/progress)
     * @returns {Array}
     */
    async getAllLocations() {
        try {
            const { data, error } = await this.supabase
                .from('locations')
                .select('*')
                .order('order_index', { ascending: true });

            if (error) throw error;

            return data || [];

        } catch (err) {
            console.error('[ProgressionManager] Lỗi get all locations:', err);
            return [];
        }
    }

    /**
     * Lấy tất cả stations của một location
     * @param {number} locationId 
     * @returns {Array}
     */
    async getStationsByLocation(locationId) {
        try {
            const { data, error } = await this.supabase
                .from('stations')
                .select('*')
                .eq('location_id', locationId)
                .order('order_index', { ascending: true });

            if (error) throw error;

            return data || [];

        } catch (err) {
            console.error('[ProgressionManager] Lỗi get stations:', err);
            return [];
        }
    }

    /**
     * Validate progression data
     * @param {Object} location 
     * @param {Object} station 
     * @param {number} step 
     * @returns {boolean}
     */
    validate(location, station, step) {
        if (!location || !location.id) return false;
        if (!station || !station.id) return false;
        if (typeof step !== 'number' || step < 1) return false;
        
        return true;
    }
}

// Expose ra window
window.ProgressionManager = ProgressionManager;

// Export
export default ProgressionManager;