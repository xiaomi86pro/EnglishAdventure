class SoundManagerClass {
    constructor() {
        this.bucketName = 'Sounds';
        this.tableName = 'sounds';
        this.dirtyRows = new Set();
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
        if (uploadBtn && uploadBtn.dataset.bound !== 'true') {
            uploadBtn.addEventListener('click', () => this.uploadSound());
            uploadBtn.dataset.bound = 'true';
        }

        const saveAllBtn = document.getElementById('save-all-sounds-btn');
        if (saveAllBtn && saveAllBtn.dataset.bound !== 'true') {
            saveAllBtn.addEventListener('click', () => this.saveAll());
            saveAllBtn.dataset.bound = 'true';
        }

        const tbody = document.getElementById('sounds-list');
        if (tbody && tbody.dataset.bound !== 'true') {
            tbody.addEventListener('input', (e) => {
                const row = e.target.closest('tr[data-id]');
                if (!row) return;
                this.markDirty(row.dataset.id);
            });

            tbody.addEventListener('change', (e) => {
                const row = e.target.closest('tr[data-id]');
                if (!row) return;
                this.markDirty(row.dataset.id);
            });

            tbody.addEventListener('click', (e) => {
                const btn = e.target.closest('button[data-action]');
                if (!btn) return;

                const row = btn.closest('tr[data-id]');
                if (!row) return;
                const id = row.dataset.id;

                if (btn.dataset.action === 'edit') {
                    this.enableRowEdit(row);
                }
                if (btn.dataset.action === 'delete') {
                    this.deleteRow(id);
                }
            });

            tbody.dataset.bound = 'true';
        }
    }

    setStatus(message, isError = false) {
        const statusEl = document.getElementById('sound-status');
        if (!statusEl) return;
        statusEl.textContent = message;
        statusEl.className = `mt-4 text-sm italic ${isError ? 'text-red-600' : 'text-gray-600'}`;
    }

    markDirty(id) {
        this.dirtyRows.add(id);
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (!row) return;
        row.classList.add('bg-yellow-50');
    }

    enableRowEdit(row) {
        row.querySelectorAll('[data-editable="true"]').forEach((el) => {
            el.disabled = false;
            el.classList.remove('bg-gray-100');
        });
        this.markDirty(row.dataset.id);
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
                .select('id, key, category, duration_ms, volume, loop, enabled, url, created_at')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;
            this.dirtyRows.clear();
            this.renderList(data || []);
        } catch (error) {
            console.error('Load sounds failed:', error);
            this.setStatus(`Không thể tải danh sách sounds: ${error.message}`, true);
        }
    }

    getRowPayload(row) {
        const id = row.dataset.id;
        const key = row.querySelector('[data-field="key"]')?.value?.trim();
        const category = row.querySelector('[data-field="category"]')?.value?.trim();
        const durationRaw = row.querySelector('[data-field="duration_ms"]')?.value;
        const volumeRaw = row.querySelector('[data-field="volume"]')?.value;
        const loop = !!row.querySelector('[data-field="loop"]')?.checked;
        const enabled = !!row.querySelector('[data-field="enabled"]')?.checked;

        if (!id || !key || !category) return null;

        return {
            id,
            key,
            category,
            duration_ms: durationRaw === '' ? null : Number(durationRaw),
            volume: volumeRaw === '' ? 1 : Number(volumeRaw),
            loop,
            enabled,
        };
    }

    async saveAll() {
        if (!this.supabase) return;

        if (!this.dirtyRows.size) {
            this.setStatus('Không có thay đổi nào để lưu.');
            return;
        }

        try {
            this.setStatus(`Đang lưu ${this.dirtyRows.size} bản ghi...`);
            const dirtyIds = Array.from(this.dirtyRows);

            for (const id of dirtyIds) {
                const row = document.querySelector(`tr[data-id="${id}"]`);
                if (!row) continue;
                const payload = this.getRowPayload(row);
                if (!payload) continue;

                const { id: soundId, ...updateData } = payload;
                const { error } = await this.supabase
                    .from(this.tableName)
                    .update(updateData)
                    .eq('id', soundId);

                if (error) throw error;
            }

            this.setStatus('✅ Đã lưu tất cả thay đổi.');
            await this.load();
        } catch (error) {
            console.error('Save all failed:', error);
            this.setStatus(`❌ Save all thất bại: ${error.message}`, true);
        }
    }

    async deleteRow(id) {
        if (!this.supabase) return;
        if (!id) return;

        const ok = window.confirm('Bạn có chắc muốn xoá sound này?');
        if (!ok) return;

        try {
            const { error } = await this.supabase
                .from(this.tableName)
                .delete()
                .eq('id', id);

            if (error) throw error;
            this.setStatus('✅ Đã xoá sound thành công.');
            await this.load();
        } catch (error) {
            console.error('Delete sound failed:', error);
            this.setStatus(`❌ Xoá thất bại: ${error.message}`, true);
        }
    }

    renderList(items) {
        const tbody = document.getElementById('sounds-list');
        if (!tbody) return;

        if (!items.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="px-3 py-4 text-center text-gray-500">Chưa có sound nào.</td></tr>';
            return;
        }

        tbody.innerHTML = items.map((item) => `
            <tr class="border-t border-gray-100" data-id="${item.id}">
                <td class="px-3 py-2">
                    <input data-field="key" value="${item.key}" class="w-full border rounded px-2 py-1 bg-gray-100" disabled data-editable="true" />
                </td>
                <td class="px-3 py-2">
                    <input data-field="category" value="${item.category}" class="w-full border rounded px-2 py-1 bg-gray-100" disabled data-editable="true" />
                </td>
                <td class="px-3 py-2">
                    <input type="number" data-field="duration_ms" value="${item.duration_ms ?? ''}" class="w-28 border rounded px-2 py-1 bg-gray-100" disabled data-editable="true" />
                </td>
                <td class="px-3 py-2">
                    <input type="number" min="0" max="1" step="0.1" data-field="volume" value="${item.volume ?? 1}" class="w-24 border rounded px-2 py-1 bg-gray-100" disabled data-editable="true" />
                </td>
                <td class="px-3 py-2">
                    <input type="checkbox" data-field="loop" ${item.loop ? 'checked' : ''} disabled data-editable="true" />
                </td>
                <td class="px-3 py-2">
                    <input type="checkbox" data-field="enabled" ${item.enabled ? 'checked' : ''} disabled data-editable="true" />
                </td>
                <td class="px-3 py-2">
                    <div class="flex gap-2">
                        <button data-action="edit" class="px-3 py-1 bg-amber-500 text-white rounded hover:bg-amber-600">Sửa</button>
                        <button data-action="delete" class="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600">Xoá</button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
}

window.SoundManager = new SoundManagerClass();
