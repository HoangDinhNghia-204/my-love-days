const yourDate = new Date("2022-09-23T00:00:00");

const firebaseConfig = {
  apiKey: "AIzaSyD9Fgwg91o9OYyL-Z8P-xtYF48myYD5R38",
  authDomain: "our-journey-app-1dd5c.firebaseapp.com",
  projectId: "our-journey-app-1dd5c",
  storageBucket: "our-journey-app-1dd5c.appspot.com",
  messagingSenderId: "871849387043",
  appId: "1:871849387043:web:d0569ad9fd66ac92693d96",
  measurementId: "G-2QN1TNLMWE"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const milestonesCollection = db.collection('milestones');
const streakRef = db.collection('streaks').doc('main');
const STREAK_START_DATE = '2022-09-23';
const REQUIRED_DAILY_SIGNALS = 2;

document.addEventListener('DOMContentLoaded', function() {
    const rootTime = document.querySelector("time");
    const anniElement = document.querySelector("anni");
    const dateElement = document.querySelector("date");
    const timelineUl = document.querySelector('.timeline');
    const milestoneForm = document.getElementById('milestone-form');
    const addMilestoneModal = new bootstrap.Modal(document.getElementById('addMilestoneModal'));
    const managerLoginModal = new bootstrap.Modal(document.getElementById('managerLoginModal'));
    const managerAuthButton = document.getElementById('manager-auth-button');
    const managerLoginForm = document.getElementById('manager-login-form');
    const managerLoginError = document.getElementById('manager-login-error');
    const dailyCheckinButton = document.getElementById('daily-checkin-button');
    const repairStreakButton = document.getElementById('repair-streak-button');
    const streakCountElement = document.getElementById('streak-count');
    const streakStatusElement = document.getElementById('streak-status');
    const streakUserElement = document.getElementById('streak-user');
    const streakPartnersElement = document.getElementById('streak-partners');
    const streakPanel = document.querySelector('.streak-panel');
    let currentlyEditingId = null;
    let allMilestones = [];
    let currentUser = null;
    let unsubscribeMilestones = null;
    let unsubscribeStreak = null;
    let streakData = null;
    let lastRenderedBrokenSince = null;

    anniElement.textContent = `${yourDate.getDate().toString().padStart(2, '0')}-${(yourDate.getMonth() + 1).toString().padStart(2, '0')}-${yourDate.getFullYear()}`;

    function updateTime() {
        const now = new Date();
        const diff = now - yourDate;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        dateElement.textContent = `${days} DAYS`;
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        rootTime.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    updateTime();
    setInterval(updateTime, 1000);

    function getBangkokDateString(date = new Date()) {
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Bangkok',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).formatToParts(date);
        const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
        return `${values.year}-${values.month}-${values.day}`;
    }

    function addDays(dateString, amount) {
        const [year, month, day] = dateString.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, day + amount));
        return date.toISOString().slice(0, 10);
    }

    function daysBetween(startDate, endDate) {
        const start = new Date(`${startDate}T00:00:00Z`);
        const end = new Date(`${endDate}T00:00:00Z`);
        return Math.round((end - start) / 86400000);
    }

    function getStreakLengthThrough(dateString) {
        return Math.max(0, daysBetween(STREAK_START_DATE, dateString));
    }

    function formatDisplayDate(dateString) {
        const [year, month, day] = dateString.split('-');
        return `${day}-${month}-${year}`;
    }

    function getUserKey(user = currentUser) {
        return user?.email?.toLowerCase().replace(/[.#$[\]/]/g, '_') || null;
    }

    function buildInitialStreakData(today) {
        const yesterday = addDays(today, -1);
        return {
            startDate: STREAK_START_DATE,
            currentStreak: getStreakLengthThrough(yesterday),
            lastCompletedDate: yesterday,
            brokenSince: null,
            participants: {},
            checkins: {},
            repairs: {},
            repairMission: null
        };
    }

    function getDailySignals(data, dateString) {
        return Object.keys(data?.checkins?.[dateString] || {}).length;
    }

    function getRepairSignals(data, dateString) {
        return Object.keys(data?.repairs?.[dateString] || {}).length;
    }

    function normalizeStreakForToday(data, today) {
        const normalized = data || buildInitialStreakData(today);
        const yesterday = addDays(today, -1);

        if (normalized.lastCompletedDate) {
            normalized.currentStreak = getStreakLengthThrough(normalized.lastCompletedDate);
        }

        if (!normalized.brokenSince && normalized.lastCompletedDate && normalized.lastCompletedDate < yesterday) {
            normalized.brokenSince = addDays(normalized.lastCompletedDate, 1);
            normalized.repairMission = 'Cả hai cùng viết 3 điều biết ơn nhau hôm nay rồi bấm hoàn thành nhiệm vụ.';
        }

        return normalized;
    }

    function triggerStreakEffect(type) {
        if (!streakPanel) return;

        streakPanel.classList.remove('streak-effect-success', 'streak-effect-fail', 'streak-effect-restore');
        void streakPanel.offsetWidth;
        streakPanel.classList.add(`streak-effect-${type}`);

        window.setTimeout(() => {
            streakPanel.classList.remove(`streak-effect-${type}`);
        }, 1200);
    }

    function renderStreak() {
        const today = getBangkokDateString();
        const data = normalizeStreakForToday(streakData, today);
        const userKey = getUserKey();
        const todaySignals = getDailySignals(data, today);
        const repairSignals = getRepairSignals(data, today);
        const hasCheckedToday = Boolean(userKey && data.checkins?.[today]?.[userKey]);
        const hasRepairedToday = Boolean(userKey && data.repairs?.[today]?.[userKey]);
        const previousBrokenSince = lastRenderedBrokenSince;
        const currentBrokenSince = data.brokenSince || null;

        document.body.classList.toggle('streak-broken', Boolean(data.brokenSince));
        streakCountElement.textContent = data.currentStreak || 0;
        streakUserElement.textContent = currentUser?.email || 'Chưa đăng nhập';
        streakPartnersElement.textContent = data.brokenSince
            ? `${repairSignals}/${REQUIRED_DAILY_SIGNALS} nhiệm vụ khôi phục`
            : `${todaySignals}/${REQUIRED_DAILY_SIGNALS} tín hiệu hôm nay`;

        if (currentBrokenSince && currentBrokenSince !== previousBrokenSince) {
            triggerStreakEffect('fail');
        } else if (!currentBrokenSince && previousBrokenSince) {
            triggerStreakEffect('restore');
        }
        lastRenderedBrokenSince = currentBrokenSince;

        if (!isManager()) {
            streakStatusElement.textContent = 'Đăng nhập tài khoản của hai bạn để gửi tín hiệu mỗi ngày.';
            dailyCheckinButton.disabled = false;
            dailyCheckinButton.textContent = 'Đăng nhập để gửi tín hiệu';
            repairStreakButton.disabled = true;
            return;
        }

        if (data.brokenSince) {
            streakStatusElement.textContent = `Chuỗi bị đứt từ ${formatDisplayDate(data.brokenSince)}. Nhiệm vụ: ${data.repairMission}`;
            dailyCheckinButton.disabled = true;
            dailyCheckinButton.textContent = 'Đang cần khôi phục chuỗi';
            repairStreakButton.disabled = hasRepairedToday;
            repairStreakButton.textContent = hasRepairedToday ? 'Bạn đã hoàn thành nhiệm vụ' : 'Hoàn thành nhiệm vụ khôi phục';
            return;
        }

        if (todaySignals >= REQUIRED_DAILY_SIGNALS) {
            streakStatusElement.textContent = 'Hôm nay hai bạn đã hoàn thành chuỗi. Một ngày nữa được giữ lại trong thiên hà.';
            dailyCheckinButton.disabled = true;
            dailyCheckinButton.textContent = 'Hôm nay đã hoàn thành';
            repairStreakButton.disabled = true;
            return;
        }

        if (hasCheckedToday) {
            streakStatusElement.textContent = 'Bạn đã gửi tín hiệu hôm nay. Đang chờ người còn lại vào xác nhận.';
            dailyCheckinButton.disabled = true;
            dailyCheckinButton.textContent = 'Đã gửi tín hiệu';
            return;
        }

        streakStatusElement.textContent = 'Mỗi ngày cả hai cùng gửi tín hiệu để giữ chuỗi không bị đứt.';
        dailyCheckinButton.disabled = false;
        dailyCheckinButton.textContent = 'Gửi tín hiệu hôm nay';
    }
    
    function renderTimeline(milestones) {
        timelineUl.innerHTML = '';

        if (milestones.length === 0) {
            timelineUl.innerHTML = '<p class="text-center text-muted">Chưa có kỷ niệm nào. Hãy thêm một dấu mốc mới nhé!</p>';
            return;
        }

        milestones.sort((a, b) => new Date(a.date) - new Date(b.date));
        allMilestones = milestones;

        milestones.forEach(item => {
            const date = new Date(item.date);
            const formattedDate = `${date.getDate().toString().padStart(2, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getFullYear()}`;
            
            const li = document.createElement('li');
            li.className = 'timeline-item';
            li.dataset.id = item.id;
            li.innerHTML = `
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                    <h3 data-field="title"></h3>
                    <p></p>
                    <span data-field="description"></span>
                </div>
                <div class="timeline-actions">
                    <button class="btn-edit" title="Sửa kỷ niệm" aria-label="Sửa kỷ niệm">✎</button>
                    <button class="btn-delete" title="Xóa kỷ niệm" aria-label="Xóa kỷ niệm">×</button>
                </div>
            `;
            li.querySelector('[data-field="title"]').textContent = item.title || 'Kỷ niệm';
            li.querySelector('.timeline-content p').textContent = formattedDate;
            li.querySelector('[data-field="description"]').textContent = item.description || '';
            timelineUl.appendChild(li);
        });

        observeTimelineItems();
    }

    function isManager(user = currentUser) {
        return Boolean(user && !user.isAnonymous && user.providerData.some(provider => provider.providerId === 'password'));
    }

    function updateManagerUi() {
        const manager = isManager();
        document.body.classList.toggle('is-manager', manager);
        managerAuthButton.textContent = manager ? 'Thoát tài khoản' : 'Đăng nhập tài khoản';
        renderStreak();
    }

    function getAuthHint(error) {
        if (error.code === 'auth/operation-not-allowed') {
            return 'Chưa bật Anonymous Auth trong Firebase.';
        }

        if (error.code === 'auth/unauthorized-domain') {
            return 'Domain này chưa được thêm vào Firebase Authorized domains. Khi test local, hãy chạy bằng localhost thay vì mở file trực tiếp.';
        }

        return `Chưa thể kết nối database (${error.code || 'unknown'}).`;
    }

    function ensureAnonymousSession() {
        if (!auth.currentUser) {
            auth.signInAnonymously().catch(error => {
                console.error("Lỗi đăng nhập Firebase: ", error);
                timelineUl.innerHTML = `<p class="text-center text-muted">${getAuthHint(error)}</p>`;
            });
        }
    }

    function startMilestonesSync() {
        if (unsubscribeMilestones) return;

        unsubscribeMilestones = milestonesCollection.onSnapshot(snapshot => {
            const milestones = [];
            snapshot.forEach(doc => {
                milestones.push({ id: doc.id, ...doc.data() });
            });
            renderTimeline(milestones);
        }, error => {
            console.error("Lỗi tải kỷ niệm: ", error);
            timelineUl.innerHTML = '<p class="text-center text-muted">Chưa thể tải kỷ niệm. Vui lòng kiểm tra quyền đọc Firestore.</p>';
        });
    }

    function startStreakSync() {
        if (unsubscribeStreak) return;

        unsubscribeStreak = streakRef.onSnapshot(snapshot => {
            streakData = snapshot.exists ? snapshot.data() : buildInitialStreakData(getBangkokDateString());
            renderStreak();
        }, error => {
            console.error("Lỗi tải chuỗi: ", error);
            streakStatusElement.textContent = 'Chưa thể tải chuỗi. Hãy kiểm tra Firestore Rules.';
        });
    }

    auth.onAuthStateChanged(user => {
        currentUser = user;
        updateManagerUi();

        if (user) {
            startMilestonesSync();
            startStreakSync();
        } else {
            ensureAnonymousSession();
        }
    });

    ensureAnonymousSession();

    dailyCheckinButton.addEventListener('click', function() {
        if (!isManager()) {
            managerLoginError.textContent = '';
            managerLoginForm.reset();
            managerLoginModal.show();
            return;
        }

        const today = getBangkokDateString();
        const userKey = getUserKey();

        db.runTransaction(async transaction => {
            const snapshot = await transaction.get(streakRef);
            const baseData = snapshot.exists ? snapshot.data() : buildInitialStreakData(today);
            const data = normalizeStreakForToday(baseData, today);

            if (data.brokenSince) {
                throw new Error('streak-broken');
            }

            const participants = {
                ...(data.participants || {}),
                [userKey]: currentUser.email
            };
            const checkins = { ...(data.checkins || {}) };
            const todayCheckins = {
                ...(checkins[today] || {}),
                [userKey]: true
            };
            checkins[today] = todayCheckins;

            const nextData = {
                ...data,
                participants,
                checkins,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (Object.keys(todayCheckins).length >= REQUIRED_DAILY_SIGNALS && data.lastCompletedDate !== today) {
                nextData.lastCompletedDate = today;
                nextData.currentStreak = (data.currentStreak || 0) + 1;
                nextData.lastCompletionAt = firebase.firestore.FieldValue.serverTimestamp();
            }

            transaction.set(streakRef, nextData);
            return Object.keys(todayCheckins).length >= REQUIRED_DAILY_SIGNALS ? 'success' : 'signal';
        }).then(() => {
            triggerStreakEffect('success');
        }).catch(error => {
            if (error.message === 'streak-broken') {
                triggerStreakEffect('fail');
                alert('Chuỗi đang bị đứt. Hai bạn cần hoàn thành nhiệm vụ khôi phục trước.');
                return;
            }
            triggerStreakEffect('fail');
            handleFirebaseError(error);
        });
    });

    repairStreakButton.addEventListener('click', function() {
        if (!isManager()) {
            managerLoginModal.show();
            return;
        }

        const today = getBangkokDateString();
        const userKey = getUserKey();

        db.runTransaction(async transaction => {
            const snapshot = await transaction.get(streakRef);
            const baseData = snapshot.exists ? snapshot.data() : buildInitialStreakData(today);
            const data = normalizeStreakForToday(baseData, today);

            if (!data.brokenSince) {
                return 'success';
            }

            const participants = {
                ...(data.participants || {}),
                [userKey]: currentUser.email
            };
            const repairs = { ...(data.repairs || {}) };
            const todayRepairs = {
                ...(repairs[today] || {}),
                [userKey]: true
            };
            repairs[today] = todayRepairs;

            const nextData = {
                ...data,
                participants,
                repairs,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (Object.keys(todayRepairs).length >= REQUIRED_DAILY_SIGNALS) {
                const checkins = { ...(data.checkins || {}) };
                checkins[today] = {
                    ...(checkins[today] || {}),
                    ...todayRepairs
                };

                nextData.checkins = checkins;
                nextData.brokenSince = null;
                nextData.repairMission = null;
                nextData.lastCompletedDate = today;
                nextData.currentStreak = Math.max(data.currentStreak || 0, getStreakLengthThrough(today));
                nextData.lastRestoredAt = firebase.firestore.FieldValue.serverTimestamp();
            }

            transaction.set(streakRef, nextData);
            return Object.keys(todayRepairs).length >= REQUIRED_DAILY_SIGNALS ? 'restore' : 'signal';
        }).then(result => {
            triggerStreakEffect(result === 'restore' ? 'restore' : 'success');
        }).catch(error => {
            triggerStreakEffect('fail');
            handleFirebaseError(error);
        });
    });

    managerAuthButton.addEventListener('click', function() {
        if (isManager()) {
            auth.signOut().then(ensureAnonymousSession).catch(handleFirebaseError);
            return;
        }

        managerLoginError.textContent = '';
        managerLoginForm.reset();
        managerLoginModal.show();
    });

    managerLoginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        managerLoginError.textContent = '';

        const email = document.getElementById('manager-email').value.trim();
        const password = document.getElementById('manager-password').value;

        auth.signInWithEmailAndPassword(email, password)
            .then(() => {
                managerLoginModal.hide();
                managerLoginForm.reset();
            })
            .catch(error => {
                console.error("Lỗi đăng nhập quản lý: ", error);
                managerLoginError.textContent = 'Email hoặc mật khẩu chưa đúng.';
            });
    });
    
    milestoneForm.addEventListener('submit', function(e) {
        e.preventDefault();
        if (!isManager()) {
            alert('Bạn cần đăng nhập quản lý để lưu kỷ niệm.');
            return;
        }

        const milestoneData = {
            date: document.getElementById('milestone-date').value,
            title: document.getElementById('milestone-title').value,
            description: document.getElementById('milestone-description').value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (currentlyEditingId) {
            milestonesCollection.doc(currentlyEditingId).update(milestoneData)
                .then(() => {
                    console.log("Kỷ niệm đã được cập nhật!");
                    resetFormAndModal();
                })
                .catch(handleFirebaseError);
        } else {
            milestoneData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            milestonesCollection.add(milestoneData)
                .then(() => {
                    console.log("Kỷ niệm đã được lưu!");
                    resetFormAndModal();
                })
                .catch(handleFirebaseError);
        }
    });

    function handleFirebaseError(error) {
        console.error("Lỗi Firebase: ", error);
        const message = error.code === 'permission-denied'
            ? 'Bạn chưa có quyền ghi Firestore. Hãy kiểm tra Firestore Rules hoặc đăng nhập tài khoản quản lý.'
            : `Đã có lỗi xảy ra: ${error.code || error.message || 'unknown'}`;
        alert(message);
    }
    
    function resetFormAndModal() {
        milestoneForm.reset();
        addMilestoneModal.hide();
        currentlyEditingId = null;
        document.getElementById('addMilestoneModalLabel').textContent = 'Thêm kỷ niệm mới';
    }

    timelineUl.addEventListener('click', function(e) {
        const itemElement = e.target.closest('.timeline-item');
        if (!itemElement) return;
        const docId = itemElement.dataset.id;

        if (e.target.classList.contains('btn-delete')) {
            if (!isManager()) {
                alert('Bạn cần đăng nhập quản lý để xóa kỷ niệm.');
                return;
            }

            if (confirm('Bạn có chắc chắn muốn xóa kỷ niệm này không?')) {
                milestonesCollection.doc(docId).delete().catch(handleFirebaseError);
            }
        }
        
        if (e.target.classList.contains('btn-edit')) {
            if (!isManager()) {
                alert('Bạn cần đăng nhập quản lý để sửa kỷ niệm.');
                return;
            }

            const milestoneToEdit = allMilestones.find(m => m.id === docId);
            if (milestoneToEdit) {
                document.getElementById('milestone-date').value = milestoneToEdit.date;
                document.getElementById('milestone-title').value = milestoneToEdit.title;
                document.getElementById('milestone-description').value = milestoneToEdit.description;
                document.getElementById('addMilestoneModalLabel').textContent = 'Sửa kỷ niệm';
                currentlyEditingId = docId;
                addMilestoneModal.show();
            }
        }
    });

    document.getElementById('addMilestoneModal').addEventListener('hidden.bs.modal', function () {
        if (currentlyEditingId) {
            resetFormAndModal();
        }
    });
    
    function observeTimelineItems() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                }
            });
        }, {
            threshold: 0.1
        });

        const items = document.querySelectorAll('.timeline-item');
        items.forEach(item => {
            observer.observe(item);
        });
    }

    const h1 = document.querySelector('h1');
    if (h1) {
        h1.innerHTML = '';
        new TypeIt(h1, {
            strings: "Our Journey",
            speed: 82,
            lifeLike: true,
            cursor: true,
            cursorSpeed: 300,
            waitUntilVisible: true,
            afterComplete: (instance) => { instance.destroy(); }
        }).go();
    }

    class Stage {
        constructor() {
            this.render = this.render.bind(this);
            this.onResize = this.onResize.bind(this);
            this.onMouseMove = this.onMouseMove.bind(this);
            this.init();
            this.createMesh();
            this.handleEvents();
            this.render();
        }

        init() {
            const container = document.getElementById('canvas-container');
            this.scene = new THREE.Scene();
            this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1200);
            this.camera.position.z = 90;
            this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            this.renderer.setClearColor(0x040611, 1);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            container.appendChild(this.renderer.domElement);
        }

        createStarTexture() {
            const canvas = document.createElement('canvas');
            const size = 96;
            const center = size / 2;
            canvas.width = size;
            canvas.height = size;

            const ctx = canvas.getContext('2d');
            const glow = ctx.createRadialGradient(center, center, 2, center, center, 46);
            glow.addColorStop(0, 'rgba(255, 255, 255, 1)');
            glow.addColorStop(0.26, 'rgba(147, 236, 255, 0.95)');
            glow.addColorStop(0.55, 'rgba(185, 137, 255, 0.36)');
            glow.addColorStop(1, 'rgba(185, 137, 255, 0)');
            ctx.fillStyle = glow;
            ctx.fillRect(0, 0, size, size);

            ctx.save();
            ctx.translate(center, center);
            ctx.beginPath();
            for (let i = 0; i < 10; i++) {
                const radius = i % 2 === 0 ? 25 : 10;
                const angle = -Math.PI / 2 + i * Math.PI / 5;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.closePath();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
            ctx.shadowColor = 'rgba(83, 230, 255, 0.95)';
            ctx.shadowBlur = 14;
            ctx.fill();
            ctx.restore();

            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            return texture;
        }

        createStarField(count, radius, color, size, opacity) {
            const geometry = new THREE.BufferGeometry();
            const vertices = [];

            for (let i = 0; i < count; i++) {
                const r = radius * Math.cbrt(Math.random());
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos((Math.random() * 2) - 1);
                const spiral = Math.sin(theta * 3) * 18;

                vertices.push(
                    r * Math.sin(phi) * Math.cos(theta) + spiral,
                    r * Math.sin(phi) * Math.sin(theta) * 0.58,
                    r * Math.cos(phi)
                );
            }

            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

            const material = new THREE.PointsMaterial({
                color,
                size,
                map: this.starTexture,
                transparent: true,
                opacity,
                alphaTest: 0.08,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });

            const points = new THREE.Points(geometry, material);
            this.scene.add(points);
            return points;
        }

        createMesh() {
            this.starTexture = this.createStarTexture();
            this.starLayers = [
                this.createStarField(1050, 190, 0x8feaff, 1.35, 0.82),
                this.createStarField(560, 150, 0xb989ff, 1.9, 0.48),
                this.createStarField(220, 110, 0xff7cad, 2.35, 0.34)
            ];
        }

        handleEvents() {
            window.addEventListener('resize', this.onResize);
            document.addEventListener('mousemove', this.onMouseMove);
        }

        onResize() {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }

        onMouseMove(event) {
            const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
            const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
            gsap.to(this.scene.rotation, {
                duration: 1.4,
                x: mouseY * 0.14,
                y: mouseX * 0.18,
                ease: "power2.out"
            });
        }

        render() {
            requestAnimationFrame(this.render);
            this.starLayers.forEach((layer, index) => {
                layer.rotation.y += 0.00025 + index * 0.00012;
                layer.rotation.z += 0.00008;
            });
            this.renderer.render(this.scene, this.camera);
        }
    }

    new Stage();
});
