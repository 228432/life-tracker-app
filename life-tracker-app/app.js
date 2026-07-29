/* ============================================
   生活工作台 - App 核心逻辑
   ============================================ */

// ==================== 数据存储层 ====================
const Store = {
    KEYS: {
        weight: 'lt_weight_records',
        weightGoal: 'lt_weight_goal',
        mood: 'lt_mood_records',
        money: 'lt_money_records',
    },

    get(key) {
        try {
            return JSON.parse(localStorage.getItem(key)) || [];
        } catch {
            return [];
        }
    },

    set(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    },

    getObj(key) {
        try {
            return JSON.parse(localStorage.getItem(key)) || {};
        } catch {
            return {};
        }
    },

    setObj(key, obj) {
        localStorage.setItem(key, JSON.stringify(obj));
    },

    // 权重记录
    getWeights() { return this.get(this.KEYS.weight); },
    setWeights(d) { this.set(this.KEYS.weight, d); },

    getWeightGoal() {
        return this.getObj(this.KEYS.weightGoal);
    },
    setWeightGoal(g) { this.setObj(this.KEYS.weightGoal, g); },

    // 心情记录
    getMoods() { return this.get(this.KEYS.mood); },
    setMoods(d) { this.set(this.KEYS.mood, d); },

    // 财务记录
    getMoney() { return this.get(this.KEYS.money); },
    setMoney(d) { this.set(this.KEYS.money, d); },
};

// ==================== 工具函数 ====================
const Utils = {
    todayStr() {
        const d = new Date();
        return this.dateStr(d);
    },

    dateStr(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    },

    formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return `${d.getMonth() + 1}月${d.getDate()}日`;
    },

    formatDateFull(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    },

    formatMoney(n) {
        return '¥' + Number(n).toFixed(2);
    },

    sortByDateDesc(arr) {
        return [...arr].sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    uid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    },

    daysBetween(d1, d2) {
        return Math.round((new Date(d2) - new Date(d1)) / 86400000);
    },
};

// ==================== Toast 提示 ====================
function showToast(msg, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast show ' + type;
    setTimeout(() => {
        toast.className = 'toast ' + type;
    }, 2200);
}

// ==================== 确认弹窗 ====================
function showModal(title, message, onConfirm, extraHTML = '') {
    const modal = document.getElementById('modal');
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = message;
    document.getElementById('modalBody').innerHTML = extraHTML;
    modal.style.display = 'flex';

    const confirmBtn = document.getElementById('modalConfirm');
    const cancelBtn = document.getElementById('modalCancel');

    const cleanup = () => {
        modal.style.display = 'none';
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
    };

    confirmBtn.onclick = () => {
        cleanup();
        if (onConfirm) onConfirm();
    };
    cancelBtn.onclick = cleanup;
}

// ==================== Tab 切换 ====================
function initTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(target + '-tab').classList.add('active');

            // 切换 Tab 后重新渲染 Canvas 图表（display:none 时 canvas 宽度为 0）
            requestAnimationFrame(() => {
                if (target === 'weight') WeightModule.renderChart();
                if (target === 'mood') MoodModule.renderChart();
                if (target === 'money') MoneyModule.renderChart();
                if (target === 'dashboard') renderDashboard();
            });
        });
    });
}

// ==================== 减肥记录模块 ====================
const WeightModule = {
    selectedMood: null,

    init() {
        // 设置默认日期
        document.getElementById('weightDateInput').value = Utils.todayStr();

        // 如果没有目标，设置默认目标
        if (!Store.getWeightGoal().target) {
            Store.setWeightGoal({ start: null, target: null });
        }

        document.getElementById('addWeightBtn').addEventListener('click', () => this.addRecord());
        document.getElementById('editWeightGoal').addEventListener('click', () => this.editGoal());
        document.getElementById('clearWeightBtn').addEventListener('click', () => this.clearAll());

        this.render();
    },

    addRecord() {
        const rawWeight = parseFloat(document.getElementById('weightInput').value);
        const weight = Math.round(rawWeight * 10) / 10; // 保留1位小数，避免浮点精度
        const date = document.getElementById('weightDateInput').value;
        const note = document.getElementById('weightNoteInput').value.trim();

        if (!weight || weight <= 0) {
            showToast('请输入有效体重', 'error');
            return;
        }
        if (!date) {
            showToast('请选择日期', 'error');
            return;
        }

        const records = Store.getWeights();

        // 检查是否已有同日记录
        const existIdx = records.findIndex(r => r.date === date);
        if (existIdx >= 0) {
            showModal('更新记录', `该日期已有记录（${records[existIdx].weight}kg），是否更新为 ${weight}kg？`, () => {
                records[existIdx] = { ...records[existIdx], weight, note, updated: Date.now() };
                Store.setWeights(records);
                this.render();
                showToast('记录已更新', 'success');
            });
            return;
        }

        records.push({
            id: Utils.uid(),
            weight,
            date,
            note,
            created: Date.now(),
        });

        Store.setWeights(records);

        // 如果是第一条记录，自动设为起始体重
        const goal = Store.getWeightGoal();
        if (!goal.start) {
            goal.start = weight;
            Store.setWeightGoal(goal);
        }

        // 清空输入
        document.getElementById('weightInput').value = '';
        document.getElementById('weightNoteInput').value = '';

        this.render();
        showToast('记录成功！', 'success');
    },

    editGoal() {
        const goal = Store.getWeightGoal();
        const html = `
            <input type="number" class="modal-input" id="goalStart" placeholder="起始体重 (kg)" step="0.1" value="${goal.start || ''}">
            <input type="number" class="modal-input" id="goalTarget" placeholder="目标体重 (kg)" step="0.1" value="${goal.target || ''}">
        `;
        showModal('设置减肥目标', '请输入起始体重和目标体重', () => {
            const start = parseFloat(document.getElementById('goalStart').value);
            const target = parseFloat(document.getElementById('goalTarget').value);
            if (!start || !target || start <= 0 || target <= 0) {
                showToast('请输入有效数值', 'error');
                return;
            }
            Store.setWeightGoal({ start, target });
            this.render();
            showToast('目标已设置', 'success');
        }, html);
    },

    deleteRecord(id) {
        showModal('删除记录', '确定删除这条体重记录吗？', () => {
            const records = Store.getWeights().filter(r => r.id !== id);
            Store.setWeights(records);
            this.render();
            showToast('已删除', 'success');
        });
    },

    clearAll() {
        const records = Store.getWeights();
        if (records.length === 0) {
            showToast('暂无记录可清空', '');
            return;
        }
        showModal('清空记录', `确定清空全部 ${records.length} 条体重记录吗？此操作不可撤销。`, () => {
            Store.setWeights([]);
            Store.setWeightGoal({ start: null, target: null });
            this.render();
            showToast('已清空', 'success');
        });
    },

    render() {
        this.renderGoal();
        this.renderChart();
        this.renderList();
    },

    renderGoal() {
        const goal = Store.getWeightGoal();
        const records = Utils.sortByDateDesc(Store.getWeights());
        const current = records.length > 0 ? records[0].weight : null;
        const display = document.getElementById('weightGoalDisplay');

        if (!goal.start && !goal.target) {
            display.innerHTML = `
                <div class="goal-item"><div class="goal-num">--</div><div class="goal-label">起始 (kg)</div></div>
                <div class="goal-item"><div class="goal-num">--</div><div class="goal-label">当前 (kg)</div></div>
                <div class="goal-item"><div class="goal-num">--</div><div class="goal-label">目标 (kg)</div></div>
            `;
            document.getElementById('weightProgressBar').style.width = '0%';
            document.getElementById('weightProgressText').textContent = '点击"编辑"设置你的减肥目标';
            return;
        }

        const start = goal.start || current || 0;
        const target = goal.target || 0;
        let progress = 0;
        let diff = 0;

        if (current && start && target && start !== target) {
            progress = ((start - current) / (start - target)) * 100;
            progress = Math.max(0, Math.min(100, progress));
            diff = (current - target).toFixed(1);
        }

        display.innerHTML = `
            <div class="goal-item"><div class="goal-num">${start || '--'}</div><div class="goal-label">起始 (kg)</div></div>
            <div class="goal-item"><div class="goal-num">${current || '--'}</div><div class="goal-label">当前 (kg)</div></div>
            <div class="goal-item"><div class="goal-num">${target || '--'}</div><div class="goal-label">目标 (kg)</div></div>
        `;

        document.getElementById('weightProgressBar').style.width = progress.toFixed(1) + '%';

        let text = '';
        if (current && target) {
            if (current <= target) {
                text = `🎉 已达成目标！`;
            } else {
                text = `距离目标还差 ${diff} kg，进度 ${progress.toFixed(0)}%`;
            }
        } else {
            text = '记录体重后查看进度';
        }
        document.getElementById('weightProgressText').textContent = text;
    },

    renderChart() {
        const canvas = document.getElementById('weightChart');
        const ctx = canvas.getContext('2d');
        const records = Store.getWeights().sort((a, b) => new Date(a.date) - new Date(b.date));

        // 设置 canvas 高分辨率
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = 200 * dpr;
        ctx.scale(dpr, dpr);
        const W = rect.width;
        const H = 200;

        ctx.clearRect(0, 0, W, H);

        if (records.length === 0) {
            ctx.fillStyle = '#B2BEC3';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('暂无数据，快记录第一条吧~', W / 2, H / 2);
            return;
        }

        const weights = records.map(r => r.weight);
        const minW = Math.min(...weights) - 1;
        const maxW = Math.max(...weights) + 1;
        const range = maxW - minW || 1;

        const padL = 40, padR = 16, padT = 20, padB = 30;
        const chartW = W - padL - padR;
        const chartH = H - padT - padB;

        // 绘制 Y 轴刻度
        ctx.strokeStyle = '#E3E3E8';
        ctx.fillStyle = '#B2BEC3';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'right';
        const ySteps = 4;
        for (let i = 0; i <= ySteps; i++) {
            const y = padT + (chartH / ySteps) * i;
            const val = maxW - (range / ySteps) * i;
            ctx.beginPath();
            ctx.moveTo(padL, y);
            ctx.lineTo(W - padR, y);
            ctx.stroke();
            ctx.fillText(val.toFixed(1), padL - 6, y + 4);
        }

        // 绘制目标线
        const goal = Store.getWeightGoal();
        if (goal.target) {
            const ty = padT + chartH * (1 - (goal.target - minW) / range);
            ctx.strokeStyle = '#00B894';
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(padL, ty);
            ctx.lineTo(W - padR, ty);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#00B894';
            ctx.textAlign = 'left';
            ctx.fillText('目标', W - padR - 30, ty - 6);
        }

        // 绘制折线和数据点
        const points = records.map((r, i) => {
            const x = padL + (records.length === 1 ? chartW / 2 : (chartW / (records.length - 1)) * i);
            const y = padT + chartH * (1 - (r.weight - minW) / range);
            return { x, y, r };
        });

        // 渐变填充
        if (points.length > 1) {
            const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
            grad.addColorStop(0, 'rgba(108, 92, 231, 0.2)');
            grad.addColorStop(1, 'rgba(108, 92, 231, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(points[0].x, padT + chartH);
            points.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.lineTo(points[points.length - 1].x, padT + chartH);
            ctx.closePath();
            ctx.fill();
        }

        // 折线
        ctx.strokeStyle = '#6C5CE7';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        points.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();

        // 数据点
        points.forEach(p => {
            ctx.fillStyle = '#6C5CE7';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
            ctx.fill();
        });

        // X 轴日期标签（最多 5 个）
        ctx.fillStyle = '#B2BEC3';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        const maxLabels = Math.min(records.length, 5);
        const step = Math.ceil(records.length / maxLabels);
        points.forEach((p, i) => {
            if (i % step === 0 || i === points.length - 1) {
                ctx.fillText(Utils.formatDate(p.r.date), p.x, H - 10);
            }
        });
    },

    renderList() {
        const records = Utils.sortByDateDesc(Store.getWeights());
        const list = document.getElementById('weightList');

        if (records.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚖️</div>
                    <div class="empty-text">还没有记录，开始记录第一条吧！</div>
                </div>`;
            return;
        }

        // 计算变化趋势
        let prevWeight = null;
        const sortedAsc = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));

        list.innerHTML = records.map(r => {
            // 找到前一条记录
            const idx = sortedAsc.findIndex(x => x.id === r.id);
            const prev = idx > 0 ? sortedAsc[idx - 1] : null;
            let trend = '';
            if (prev) {
                const diff = (r.weight - prev.weight).toFixed(1);
                if (diff < 0) trend = ` <span style="color:#00B894;font-size:0.75rem">↓${Math.abs(diff)}kg</span>`;
                else if (diff > 0) trend = ` <span style="color:#FF7675;font-size:0.75rem">↑${diff}kg</span>`;
                else trend = ` <span style="color:#B2BEC3;font-size:0.75rem">→持平</span>`;
            }

            return `
                <div class="record-item">
                    <div class="record-left">
                        <div class="record-emoji">⚖️</div>
                        <div class="record-info">
                            <div class="record-title">${r.weight} kg ${trend}</div>
                            <div class="record-meta">${Utils.formatDateFull(r.date)}${r.note ? ' · ' + r.note : ''}</div>
                        </div>
                    </div>
                    <div class="record-right">
                        <button class="delete-btn" onclick="WeightModule.deleteRecord('${r.id}')">🗑️</button>
                    </div>
                </div>`;
        }).join('');
    },
};

// ==================== 心情记录模块 ====================
const MoodModule = {
    moods: {
        5: { emoji: '😄', label: '超棒', color: '#00B894' },
        4: { emoji: '🙂', label: '不错', color: '#55EFC4' },
        3: { emoji: '😐', label: '一般', color: '#FDCB6E' },
        2: { emoji: '😕', label: '不太好', color: '#FAB1A0' },
        1: { emoji: '😢', label: '很差', color: '#FF7675' },
    },

    selectedMood: null,

    init() {
        document.getElementById('moodDateInput').value = Utils.todayStr();

        // 心情选择按钮
        document.querySelectorAll('.mood-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.mood-btn').forEach(b => {
                    b.classList.remove('selected');
                    // 移除标签文字
                    const label = b.querySelector('.mood-label-text');
                    if (label) label.remove();
                });
                btn.classList.add('selected');
                this.selectedMood = parseInt(btn.dataset.mood);
                // 添加标签文字
                const label = document.createElement('span');
                label.className = 'mood-label-text';
                label.textContent = btn.dataset.label;
                btn.appendChild(label);
            });
        });

        document.getElementById('addMoodBtn').addEventListener('click', () => this.addRecord());

        this.render();
    },

    addRecord() {
        if (!this.selectedMood) {
            showToast('请先选择今天的心情', 'error');
            return;
        }

        const date = document.getElementById('moodDateInput').value;
        const note = document.getElementById('moodNoteInput').value.trim();

        if (!date) {
            showToast('请选择日期', 'error');
            return;
        }

        const records = Store.getMoods();

        // 检查是否已有同日记录
        const existIdx = records.findIndex(r => r.date === date);
        if (existIdx >= 0) {
            showModal('更新记录', '该日期已有心情记录，是否覆盖更新？', () => {
                records[existIdx] = {
                    ...records[existIdx],
                    mood: this.selectedMood,
                    note,
                    updated: Date.now(),
                };
                Store.setMoods(records);
                this.resetForm();
                this.render();
                showToast('心情已更新', 'success');
            });
            return;
        }

        records.push({
            id: Utils.uid(),
            mood: this.selectedMood,
            date,
            note,
            created: Date.now(),
        });

        Store.setMoods(records);
        this.resetForm();
        this.render();
        showToast('心情已记录 😊', 'success');
    },

    resetForm() {
        this.selectedMood = null;
        document.getElementById('moodNoteInput').value = '';
        document.querySelectorAll('.mood-btn').forEach(b => {
            b.classList.remove('selected');
            const label = b.querySelector('.mood-label-text');
            if (label) label.remove();
        });
    },

    deleteRecord(id) {
        showModal('删除记录', '确定删除这条心情记录吗？', () => {
            const records = Store.getMoods().filter(r => r.id !== id);
            Store.setMoods(records);
            this.render();
            showToast('已删除', 'success');
        });
    },

    render() {
        this.renderStats();
        this.renderChart();
        this.renderCalendar();
        this.renderList();
    },

    renderStats() {
        const records = Store.getMoods();
        const stats = document.getElementById('moodStats');

        if (records.length === 0) {
            stats.innerHTML = `
                <div class="mood-stat-item">
                    <div class="mood-stat-num">--</div>
                    <div class="mood-stat-label">总记录</div>
                </div>
                <div class="mood-stat-item">
                    <div class="mood-stat-num">--</div>
                    <div class="mood-stat-label">平均心情</div>
                </div>
                <div class="mood-stat-item">
                    <div class="mood-stat-num">--</div>
                    <div class="mood-stat-label">本月记录</div>
                </div>`;
            return;
        }

        const avg = records.reduce((s, r) => s + r.mood, 0) / records.length;
        const now = new Date();
        const monthRecords = records.filter(r => {
            const d = new Date(r.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).length;

        const avgMood = this.moods[Math.round(avg)];

        stats.innerHTML = `
            <div class="mood-stat-item">
                <div class="mood-stat-num">${records.length}</div>
                <div class="mood-stat-label">总记录</div>
            </div>
            <div class="mood-stat-item">
                <div class="mood-stat-num">${avgMood.emoji}</div>
                <div class="mood-stat-label">平均 ${avg.toFixed(1)}</div>
            </div>
            <div class="mood-stat-item">
                <div class="mood-stat-num">${monthRecords}</div>
                <div class="mood-stat-label">本月记录</div>
            </div>`;
    },

    renderChart() {
        const canvas = document.getElementById('moodChart');
        const ctx = canvas.getContext('2d');
        const records = Store.getMoods();

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = 180 * dpr;
        ctx.scale(dpr, dpr);
        const W = rect.width;
        const H = 180;

        ctx.clearRect(0, 0, W, H);

        // 统计各心情数量
        const counts = [0, 0, 0, 0, 0]; // index 0 = mood 1
        records.forEach(r => { counts[r.mood - 1]++; });
        const maxCount = Math.max(...counts, 1);

        const barW = (W - 40) / 5;
        const barMaxH = H - 50;
        const padL = 20;

        // 绘制柱状图
        for (let i = 0; i < 5; i++) {
            const mood = i + 1;
            const m = this.moods[mood];
            const h = (counts[i] / maxCount) * barMaxH;
            const x = padL + i * barW + barW * 0.15;
            const y = H - 30 - h;
            const w = barW * 0.7;

            // 柱子
            const grad = ctx.createLinearGradient(0, y, 0, H - 30);
            grad.addColorStop(0, m.color);
            grad.addColorStop(1, m.color + '60');
            ctx.fillStyle = grad;
            const radius = 6;
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + w - radius, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
            ctx.lineTo(x + w, H - 30);
            ctx.lineTo(x, H - 30);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
            ctx.fill();

            // 数量
            if (counts[i] > 0) {
                ctx.fillStyle = '#2D3436';
                ctx.font = 'bold 13px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(counts[i], x + w / 2, y - 6);
            }

            // 表情
            ctx.font = '18px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(m.emoji, x + w / 2, H - 10);
        }

        if (records.length === 0) {
            ctx.fillStyle = '#B2BEC3';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('暂无数据', W / 2, H / 2);
        }
    },

    renderCalendar() {
        const container = document.getElementById('moodCalendar');
        const records = Store.getMoods();
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startWeekday = firstDay.getDay();
        const daysInMonth = lastDay.getDate();

        // 构建心情映射
        const moodMap = {};
        records.forEach(r => {
            const d = new Date(r.date);
            if (d.getMonth() === month && d.getFullYear() === year) {
                moodMap[d.getDate()] = r.mood;
            }
        });

        const monthNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
        let html = `<div style="grid-column:span 7;text-align:center;font-weight:600;margin-bottom:4px;color:var(--text)">${year}年 ${monthNames[month]}</div>`;

        // 星期头
        ['日','一','二','三','四','五','六'].forEach(d => {
            html += `<div class="cal-header">${d}</div>`;
        });

        // 空白填充
        for (let i = 0; i < startWeekday; i++) {
            html += '<div class="cal-day"></div>';
        }

        // 日期
        const today = now.getDate();
        for (let d = 1; d <= daysInMonth; d++) {
            const mood = moodMap[d];
            if (mood) {
                const m = this.moods[mood];
                html += `<div class="cal-day has-mood" style="background:${m.color}" title="${d}日: ${m.label}">${d}</div>`;
            } else {
                const isToday = d === today;
                html += `<div class="cal-day" style="${isToday ? 'border:2px solid var(--primary);color:var(--primary);font-weight:700' : ''}">${d}</div>`;
            }
        }

        container.innerHTML = html;
    },

    renderList() {
        const records = Utils.sortByDateDesc(Store.getMoods());
        const list = document.getElementById('moodList');

        if (records.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">😊</div>
                    <div class="empty-text">还没有心情记录，记录今天的心情吧！</div>
                </div>`;
            return;
        }

        list.innerHTML = records.map(r => {
            const m = this.moods[r.mood];
            return `
                <div class="record-item" style="border-left-color:${m.color}">
                    <div class="record-left">
                        <div class="record-emoji">${m.emoji}</div>
                        <div class="record-info">
                            <div class="record-title">${m.label}</div>
                            <div class="record-meta">${Utils.formatDateFull(r.date)}${r.note ? ' · ' + r.note : ''}</div>
                        </div>
                    </div>
                    <div class="record-right">
                        <button class="delete-btn" onclick="MoodModule.deleteRecord('${r.id}')">🗑️</button>
                    </div>
                </div>`;
        }).join('');
    },
};

// ==================== 攒钱 + 花费记录模块 ====================
const MoneyModule = {
    categories: {
        income: [
            { emoji: '💵', label: '工资' },
            { emoji: '🧧', label: '红包' },
            { emoji: '💰', label: '存款' },
            { emoji: '📈', label: '理财' },
            { emoji: '🎁', label: '其他收入' },
            { emoji: '🏪', label: '副业' },
            { emoji: '↩️', label: '退款' },
            { emoji: '✨', label: '额外' },
        ],
        expense: [
            { emoji: '🍜', label: '餐饮' },
            { emoji: '🛒', label: '购物' },
            { emoji: '🚌', label: '交通' },
            { emoji: '🏠', label: '住房' },
            { emoji: '🎬', label: '娱乐' },
            { emoji: '💊', label: '医疗' },
            { emoji: '📚', label: '学习' },
            { emoji: '📦', label: '其他' },
        ],
    },

    currentType: 'income',
    selectedCategory: null,

    init() {
        document.getElementById('moneyDateInput').value = Utils.todayStr();

        // 类型切换
        document.querySelectorAll('.type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentType = btn.dataset.type;
                this.selectedCategory = null;
                this.renderCategories();
            });
        });

        document.getElementById('addMoneyBtn').addEventListener('click', () => this.addRecord());
        document.getElementById('clearMoneyBtn').addEventListener('click', () => this.clearAll());

        this.renderCategories();
        this.render();
    },

    renderCategories() {
        const grid = document.getElementById('moneyCategoryGrid');
        const cats = this.categories[this.currentType];
        grid.innerHTML = cats.map((c, i) => `
            <button class="cat-btn" data-idx="${i}">
                ${c.emoji}
                <span class="cat-label">${c.label}</span>
            </button>
        `).join('');

        grid.querySelectorAll('.cat-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                grid.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.selectedCategory = parseInt(btn.dataset.idx);
            });
        });
    },

    addRecord() {
        const rawAmount = parseFloat(document.getElementById('moneyAmount').value);
        const amount = Math.round(rawAmount * 100) / 100; // 保留2位小数，避免浮点精度
        const date = document.getElementById('moneyDateInput').value;
        const note = document.getElementById('moneyNoteInput').value.trim();

        if (!amount || amount <= 0) {
            showToast('请输入有效金额', 'error');
            return;
        }
        if (!date) {
            showToast('请选择日期', 'error');
            return;
        }

        const cat = this.selectedCategory !== null
            ? this.categories[this.currentType][this.selectedCategory]
            : { emoji: this.currentType === 'income' ? '✨' : '📦', label: '其他' };

        const records = Store.getMoney();
        records.push({
            id: Utils.uid(),
            type: this.currentType,
            amount,
            date,
            note,
            category: cat,
            created: Date.now(),
        });

        Store.setMoney(records);

        // 清空
        document.getElementById('moneyAmount').value = '';
        document.getElementById('moneyNoteInput').value = '';
        this.selectedCategory = null;
        this.renderCategories();

        this.render();
        showToast(this.currentType === 'income' ? '攒钱成功！💰' : '已记录花费 💸', 'success');
    },

    deleteRecord(id) {
        showModal('删除记录', '确定删除这条记录吗？', () => {
            const records = Store.getMoney().filter(r => r.id !== id);
            Store.setMoney(records);
            this.render();
            showToast('已删除', 'success');
        });
    },

    clearAll() {
        const records = Store.getMoney();
        if (records.length === 0) {
            showToast('暂无记录可清空', '');
            return;
        }
        showModal('清空记录', `确定清空全部 ${records.length} 条账单记录吗？此操作不可撤销。`, () => {
            Store.setMoney([]);
            this.render();
            showToast('已清空', 'success');
        });
    },

    render() {
        this.renderBalance();
        this.renderChart();
        this.renderList();
    },

    renderBalance() {
        const records = Store.getMoney();
        const income = records.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
        const expense = records.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
        const balance = income - expense;

        document.getElementById('balanceAmount').textContent = Utils.formatMoney(balance);
        document.getElementById('totalIncome').textContent = Utils.formatMoney(income);
        document.getElementById('totalExpense').textContent = Utils.formatMoney(expense);
    },

    renderChart() {
        const canvas = document.getElementById('moneyChart');
        const ctx = canvas.getContext('2d');
        const records = Store.getMoney();

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = 200 * dpr;
        ctx.scale(dpr, dpr);
        const W = rect.width;
        const H = 200;

        ctx.clearRect(0, 0, W, H);

        if (records.length === 0) {
            ctx.fillStyle = '#B2BEC3';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('暂无数据，快记一笔吧~', W / 2, H / 2);
            return;
        }

        // 按最近 7 天或最近 N 条分组（取最近 7 个有记录的日期）
        const byDate = {};
        records.forEach(r => {
            if (!byDate[r.date]) byDate[r.date] = { income: 0, expense: 0 };
            byDate[r.date][r.type] += r.amount;
        });

        const dates = Object.keys(byDate).sort((a, b) => new Date(a) - new Date(b));
        const recentDates = dates.slice(-7);

        const maxVal = Math.max(
            ...recentDates.map(d => Math.max(byDate[d].income, byDate[d].expense)),
            1
        );

        const padL = 50, padR = 16, padT = 20, padB = 30;
        const chartW = W - padL - padR;
        const chartH = H - padT - padB;
        const groupW = chartW / recentDates.length;
        const barW = groupW * 0.3;
        const gap = groupW * 0.05;

        // Y 轴
        ctx.strokeStyle = '#E3E3E8';
        ctx.fillStyle = '#B2BEC3';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'right';
        const ySteps = 4;
        for (let i = 0; i <= ySteps; i++) {
            const y = padT + (chartH / ySteps) * i;
            const val = maxVal - (maxVal / ySteps) * i;
            ctx.beginPath();
            ctx.moveTo(padL, y);
            ctx.lineTo(W - padR, y);
            ctx.stroke();
            ctx.fillText(val >= 100 ? Math.round(val) : val.toFixed(0), padL - 6, y + 4);
        }

        // 柱子
        recentDates.forEach((d, i) => {
            const data = byDate[d];
            const cx = padL + groupW * i + groupW / 2;

            // 收入柱
            if (data.income > 0) {
                const h = (data.income / maxVal) * chartH;
                const x = cx - barW - gap / 2;
                const y = padT + chartH - h;
                const grad = ctx.createLinearGradient(0, y, 0, padT + chartH);
                grad.addColorStop(0, '#00B894');
                grad.addColorStop(1, '#00B89460');
                ctx.fillStyle = grad;
                this.roundRect(ctx, x, y, barW, h, 4);
                ctx.fill();
            }

            // 支出柱
            if (data.expense > 0) {
                const h = (data.expense / maxVal) * chartH;
                const x = cx + gap / 2;
                const y = padT + chartH - h;
                const grad = ctx.createLinearGradient(0, y, 0, padT + chartH);
                grad.addColorStop(0, '#FF7675');
                grad.addColorStop(1, '#FF767560');
                ctx.fillStyle = grad;
                this.roundRect(ctx, x, y, barW, h, 4);
                ctx.fill();
            }

            // 日期标签
            ctx.fillStyle = '#B2BEC3';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(Utils.formatDate(d), cx, H - 10);
        });

        // 图例
        ctx.textAlign = 'left';
        ctx.font = '11px sans-serif';
        ctx.fillStyle = '#00B894';
        ctx.fillRect(padL, 4, 12, 12);
        ctx.fillStyle = '#2D3436';
        ctx.fillText('攒入', padL + 16, 14);
        ctx.fillStyle = '#FF7675';
        ctx.fillRect(padL + 60, 4, 12, 12);
        ctx.fillStyle = '#2D3436';
        ctx.fillText('支出', padL + 76, 14);
    },

    roundRect(ctx, x, y, w, h, r) {
        if (h < r) r = h / 2;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x, y + h);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    },

    renderList() {
        const records = Utils.sortByDateDesc(Store.getMoney());
        const list = document.getElementById('moneyList');

        if (records.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">💰</div>
                    <div class="empty-text">还没有账单记录，记一笔吧！</div>
                </div>`;
            return;
        }

        list.innerHTML = records.map(r => {
            const isIncome = r.type === 'income';
            return `
                <div class="record-item" style="border-left-color:${isIncome ? '#00B894' : '#FF7675'}">
                    <div class="record-left">
                        <div class="record-emoji">${r.category.emoji}</div>
                        <div class="record-info">
                            <div class="record-title">${r.category.label}</div>
                            <div class="record-meta">${Utils.formatDateFull(r.date)}${r.note ? ' · ' + r.note : ''}</div>
                        </div>
                    </div>
                    <div class="record-right">
                        <div class="record-value ${isIncome ? 'income' : 'expense'}">
                            ${isIncome ? '+' : '-'}${Utils.formatMoney(r.amount)}
                        </div>
                        <button class="delete-btn" onclick="MoneyModule.deleteRecord('${r.id}')">🗑️</button>
                    </div>
                </div>`;
        }).join('');
    },
};

// ==================== 总览仪表盘 ====================
function renderDashboard() {
    const weights = Store.getWeights();
    const moods = Store.getMoods();
    const money = Store.getMoney();

    const sortedWeights = Utils.sortByDateDesc(weights);
    const currentWeight = sortedWeights.length > 0 ? sortedWeights[0].weight : '--';
    const goal = Store.getWeightGoal();
    const weightDiff = (sortedWeights.length > 0 && goal.start)
        ? (currentWeight - goal.start).toFixed(1)
        : '--';

    const avgMood = moods.length > 0
        ? (moods.reduce((s, r) => s + r.mood, 0) / moods.length).toFixed(1)
        : '--';

    const totalIncome = money.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
    const totalExpense = money.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
    const balance = totalIncome - totalExpense;

    const totalRecords = weights.length + moods.length + money.length;

    document.getElementById('dashboardGrid').innerHTML = `
        <div class="dashboard-item dash-weight">
            <div class="dash-icon">⚖️</div>
            <div class="dash-value">${currentWeight}${currentWeight !== '--' ? ' kg' : ''}</div>
            <div class="dash-label">当前体重${weightDiff !== '--' ? ` (${weightDiff > 0 ? '+' : ''}${weightDiff})` : ''}</div>
        </div>
        <div class="dashboard-item dash-mood">
            <div class="dash-icon">${moods.length > 0 ? MoodModule.moods[Math.round(avgMood)].emoji : '😊'}</div>
            <div class="dash-value">${avgMood}</div>
            <div class="dash-label">平均心情</div>
        </div>
        <div class="dashboard-item dash-income">
            <div class="dash-icon">📥</div>
            <div class="dash-value" style="font-size:1rem">${Utils.formatMoney(totalIncome)}</div>
            <div class="dash-label">总攒入</div>
        </div>
        <div class="dashboard-item dash-expense">
            <div class="dash-icon">📤</div>
            <div class="dash-value" style="font-size:1rem">${Utils.formatMoney(totalExpense)}</div>
            <div class="dash-label">总支出</div>
        </div>
        <div class="dashboard-item dash-balance">
            <div class="dash-icon">🏦</div>
            <div class="dash-value">${Utils.formatMoney(balance)}</div>
            <div class="dash-label">小金库余额</div>
        </div>
        <div class="dashboard-item dash-records">
            <div class="dash-icon">📋</div>
            <div class="dash-value">${totalRecords} 条</div>
            <div class="dash-label">总记录数（体重 ${weights.length} · 心情 ${moods.length} · 账单 ${money.length}）</div>
        </div>
    `;
}

// ==================== 数据管理 ====================
function initDataManagement() {
    // 导出
    document.getElementById('exportDataBtn').addEventListener('click', () => {
        const data = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            weight: Store.getWeights(),
            weightGoal: Store.getWeightGoal(),
            mood: Store.getMoods(),
            money: Store.getMoney(),
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `生活工作台_备份_${Utils.todayStr()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('数据已导出', 'success');
    });

    // 导入
    document.getElementById('importDataBtn').addEventListener('click', () => {
        document.getElementById('importFileInput').click();
    });

    document.getElementById('importFileInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                showModal('导入数据', '导入将覆盖当前所有数据，确定继续吗？', () => {
                    if (data.weight) Store.setWeights(data.weight);
                    if (data.weightGoal) Store.setWeightGoal(data.weightGoal);
                    if (data.mood) Store.setMoods(data.mood);
                    if (data.money) Store.setMoney(data.money);
                    WeightModule.render();
                    MoodModule.render();
                    MoneyModule.render();
                    renderDashboard();
                    showToast('导入成功', 'success');
                });
            } catch {
                showToast('文件格式错误', 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });

    // 清空所有
    document.getElementById('clearAllBtn').addEventListener('click', () => {
        const total = Store.getWeights().length + Store.getMoods().length + Store.getMoney().length;
        if (total === 0) {
            showToast('暂无数据可清空', '');
            return;
        }
        showModal('清空所有数据', `确定清空全部 ${total} 条记录吗？此操作不可撤销，建议先导出备份。`, () => {
            Store.setWeights([]);
            Store.setWeightGoal({ start: null, target: null });
            Store.setMoods([]);
            Store.setMoney([]);
            WeightModule.render();
            MoodModule.render();
            MoneyModule.render();
            renderDashboard();
            showToast('所有数据已清空', 'success');
        });
    });
}

// ==================== PWA Service Worker 注册 ====================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {
            // 离线环境下注册可能失败，静默处理
        });
    });
}

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    WeightModule.init();
    MoodModule.init();
    MoneyModule.init();
    initDataManagement();

    // PWA 安装提示
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        // 延迟显示安装提示
        setTimeout(() => {
            if (deferredPrompt) {
                showToast('💡 点击浏览器菜单"添加到主屏幕"即可安装 App', '');
            }
        }, 3000);
    });
});
