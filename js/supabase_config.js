import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Khởi tạo Supabase Client từ các biến môi trường
// Lưu ý: Đảm bảo bạn đang sử dụng công cụ build như Vite để đọc được import.meta.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Gán vào window để các file script không phải module (như AuthComponent) có thể truy cập
window.supabase = supabase;