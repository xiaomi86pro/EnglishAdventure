class SoundManagerClass {
    constructor() {
        this.bucketName = 'Sounds';
        this.tableName = 'sounds';
    }

    get supabase() {
        return window.supabase;
    }

    init() {
        this.bindEvents();
        this.load();
    }

    bindEvents() {
        const uploadBtn = document.getElementById('upload-sound-btn');
        if (!uploadBtn || uploadBtn.dataset.bound === 'true') return;

        uploadBtn.addEventListener('click', () => this.uploadSound());
        uploadBtn.dataset.bound = 'true';
    }

    setStatus(message, isError = false) {
        const statusEl = document.getElementById('sound-status');
        if (!statusEl) return;
        statusEl.textContent = message;
        statusEl.className = `mt-4 text-sm italic ${isError ? 'text-red-600' : 'text-gray-600'}`;
    }

    async uploadSound() {
        if (!this.supabase) {
            this.setStatus('Supabase chưa được khởi tạo.', true);
            return;
        }

        const key = document.getElementById('sound-key')?.value?.trim();
        const category = document.getElementById('sound-category')?.value?.trim();
        const file = document.getElementById('sound-file')?.files?.[0];

        if (!key || !category || !file) {
            this.setStatus('Vui lòng nhập key, category và chọn file sound.', true);
            return;
        }

        const durationInput = document.getElementById('sound-duration')?.value;
        const volumeInput = document.getElementById('sound-volume')?.value;
        const loop = !!document.getElementById('sound-loop')?.checked;
        const enabled = !!document.getElementById('sound-enabled')?.checked;

        try {
            this.setStatus('Đang upload file lên Supabase Storage...');

            const ext = file.name.includes('.') ? file.name.split('.').pop() : 'mp3';
            const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
            const filePath = `${category}/${safeKey}-${Date.now()}.${ext}`;

            const { error: uploadError } = await this.supabase.storage
                .from(this.bucketName)
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = this.supabase.storage
                .from(this.bucketName)
                .getPublicUrl(filePath);

            const durationMs = durationInput ? Number(durationInput) : null;
            const volume = volumeInput ? Number(volumeInput) : 1;

            const payload = {
                key,
                category,
                url: publicUrlData.publicUrl,
                duration_ms: Number.isFinite(durationMs) ? durationMs : null,
                volume: Number.isFinite(volume) ? volume : 1,
                loop,
                enabled,
            };

            const { error: dbError } = await this.supabase
                .from(this.tableName)
                .upsert(payload, { onConflict: 'key' });

            if (dbError) throw dbError;

            this.setStatus('✅ Upload sound thành công và đã lưu vào bảng sounds.');
            this.resetForm();
            await this.load();
        } catch (error) {
            console.error('Upload sound failed:', error);
            this.setStatus(`❌ Upload thất bại: ${error.message}`, true);
        }
    }

    resetForm() {
        const fileEl = document.getElementById('sound-file');
        if (fileEl) fileEl.value = '';
        const keyEl = document.getElementById('sound-key');
        if (keyEl) keyEl.value = '';
    }

    async load() {
        if (!this.supabase) return;

        try {
            const { data, error } = await this.supabase
                .from(this.tableName)
                .select('key, category, duration_ms, volume, loop, enabled, created_at')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;
            this.renderList(data || []);
        } catch (error) {
            console.error('Load sounds failed:', error);
            this.setStatus(`Không thể tải danh sách sounds: ${error.message}`, true);
        }
    }

    renderList(items) {
        const tbody = document.getElementById('sounds-list');
        if (!tbody) return;

        if (!items.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="px-3 py-4 text-center text-gray-500">Chưa có sound nào.</td></tr>';
            return;
        }

        tbody.innerHTML = items.map((item) => `
            <tr class="border-t border-gray-100">
                <td class="px-3 py-2 font-semibold">${item.key}</td>
                <td class="px-3 py-2">${item.category}</td>
                <td class="px-3 py-2">${item.duration_ms ?? ''}</td>
                <td class="px-3 py-2">${item.volume ?? 1}</td>
                <td class="px-3 py-2">${item.loop ? '✅' : '—'}</td>
                <td class="px-3 py-2">${item.enabled ? '✅' : '❌'}</td>
            </tr>
        `).join('');
    }
}

window.SoundManager = new SoundManagerClass();
