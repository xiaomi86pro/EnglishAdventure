// admin.js - Main entry point
import { createClient } from '@supabase/supabase-js'
//import * as XLSX from 'xlsx'
import "@/css/admin.css";

// Import các managers
import { VocabManager } from './vocab_manager.js';
import { AssetManager } from './asset_manager.js';
import { TestQuestionManager } from './test_question_manager.js';
import { GrammarManager } from './grammar_manager.js';


// Khởi tạo Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseAnonKey)
window.supabase = supabase;

// Khởi tạo Auth nếu có
if (window.AuthComponent) {
    AuthComponent.init(supabase);
}

// ===== KHỞI TẠO CÁC MANAGERS =====
const vocabManager = new VocabManager(supabase);
const assetManager = new AssetManager(supabase);
const testQuestionManager = new TestQuestionManager(supabase);
const grammarManager = new GrammarManager(supabase);

// Expose ra window để có thể gọi từ HTML onclick
window.vocabManager = vocabManager;
window.assetManager = assetManager;
window.testQuestionManager = testQuestionManager;
window.grammarManager = new GrammarManager(supabase);


// ===== XỬ LÝ UPLOAD EXCEL =====
const fileInput = document.getElementById('excel-file');
const uploadBtn = document.getElementById('upload-btn');

if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', async () => {
        const file = fileInput.files[0];
        if (!file) {
            alert("Vui lòng chọn một file Excel trước!");
            return;
        }

        try {
            await vocabManager.uploadExcel(file);
        } catch (err) {
            console.error('Lỗi upload:', err);
        }
    });
}

// ===== TAB SWITCHING =====
window.switchTab = function(tabName) {
    // Danh sách tất cả các tab
    const tabs = ['vocab', 'grammar', 'assets', 'questions', 'locations', 'stations', 'steps', 'profiles'];
    
    // Ẩn tất cả tab
    tabs.forEach(tab => {
        const tabEl = document.getElementById(`tab-${tab}`);
        const btnEl = document.getElementById(`btn-tab-${tab}`);
        
        if (tabEl) tabEl.classList.add('hidden');
        if (btnEl) {
            btnEl.classList.remove('tab-active');
            btnEl.classList.add('tab-inactive');
        }
    });
    
    // Hiện tab được chọn
    const selectedTab = document.getElementById(`tab-${tabName}`);
    const selectedBtn = document.getElementById(`btn-tab-${tabName}`);
    
    if (selectedTab) selectedTab.classList.remove('hidden');
    if (selectedBtn) {
        selectedBtn.classList.remove('tab-inactive');
        selectedBtn.classList.add('tab-active');
    }
    
    // Load data tương ứng
    switch(tabName) {
        case 'vocab':
            vocabManager.init();
            break;
        
        case 'grammar':
            grammarManager.init();
            break;

        case 'assets':
            assetManager.loadHeroes();
            break;
            
        case 'questions':
            testQuestionManager.loadQuestionTypes();
            break;
            
        case 'locations':
            if (window.LocationManager) window.LocationManager.load();
            break;
            
        case 'stations':
            if (window.StationManager) window.StationManager.load();
            break;
            
        case 'steps':
            if (window.StepManager) window.StepManager.load();
            break;

        case 'profiles':
            if (window.ProfileManager) {
                window.ProfileManager.init();
                window.ProfileManager.load();
            }
            break;
    }
};

// ===== KHỞI ĐỘNG HỆ THỐNG =====
async function startAdminSystem() {
    console.log('🚀 Admin system starting...');
    
    // Khởi tạo tab Vocabulary (tab mặc định)
    vocabManager.init();
    
    // Khởi tạo Asset Manager
    assetManager.init();
    
    // Khởi tạo Test Question Manager
    testQuestionManager.init();
    
    console.log('✅ Admin system ready!');
    
    // Log các managers có sẵn
    if (window.LocationManager) console.log('✓ LocationManager ready');
    if (window.StationManager) console.log('✓ StationManager ready');
    if (window.StepManager) console.log('✓ StepManager ready');
}

// Đảm bảo các Manager được load
window.addEventListener('DOMContentLoaded', () => {
    startAdminSystem();
});

// Khởi động ngay nếu DOM đã ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startAdminSystem);
} else {
    startAdminSystem();
}