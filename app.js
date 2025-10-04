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
const db = firebase.firestore();
const milestonesCollection = db.collection('milestones');

document.addEventListener('DOMContentLoaded', function() {
    const rootTime = document.querySelector("time");
    const anniElement = document.querySelector("anni");
    const dateElement = document.querySelector("date");
    const timelineUl = document.querySelector('.timeline');
    const milestoneForm = document.getElementById('milestone-form');
    const addMilestoneModal = new bootstrap.Modal(document.getElementById('addMilestoneModal'));
    let currentlyEditingId = null;
    let allMilestones = [];

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
    
    function renderTimeline(milestones) {
        timelineUl.innerHTML = '';
        if (milestones.length === 0) {
            timelineUl.innerHTML = '<p class="text-center text-muted">Chưa có kỷ niệm nào. Hãy thêm một cái nhé!</p>';
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
                    <h3 data-field="title">${item.title}</h3>
                    <p>${formattedDate}</p>
                    <span data-field="description">${item.description}</span>
                </div>
                <div class="timeline-actions">
                    <button class="btn-edit" title="Sửa kỷ niệm">✏️</button>
                    <button class="btn-delete" title="Xóa kỷ niệm">🗑️</button>
                </div>
            `;
            timelineUl.appendChild(li);
        });
        observeTimelineItems();
    }

    milestonesCollection.onSnapshot(snapshot => {
        const milestones = [];
        snapshot.forEach(doc => {
            milestones.push({ id: doc.id, ...doc.data() });
        });
        renderTimeline(milestones);
    });
    
    milestoneForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const milestoneData = {
            date: document.getElementById('milestone-date').value,
            title: document.getElementById('milestone-title').value,
            description: document.getElementById('milestone-description').value
        };

        if (currentlyEditingId) {
            milestonesCollection.doc(currentlyEditingId).update(milestoneData)
                .then(() => {
                    console.log("Kỷ niệm đã được cập nhật!");
                    resetFormAndModal();
                })
                .catch(handleFirebaseError);
        } else {
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
        alert("Đã có lỗi xảy ra. Vui lòng thử lại.");
    }
    
    function resetFormAndModal() {
        milestoneForm.reset();
        addMilestoneModal.hide();
        currentlyEditingId = null;
        document.getElementById('addMilestoneModalLabel').textContent = 'Thêm Kỷ Niệm Mới';
    }

    timelineUl.addEventListener('click', function(e) {
        const itemElement = e.target.closest('.timeline-item');
        if (!itemElement) return;
        const docId = itemElement.dataset.id;

        if (e.target.classList.contains('btn-delete')) {
            if (confirm('Bạn có chắc chắn muốn xóa kỷ niệm này không?')) {
                milestonesCollection.doc(docId).delete().catch(handleFirebaseError);
            }
        }
        
        if (e.target.classList.contains('btn-edit')) {
            const milestoneToEdit = allMilestones.find(m => m.id === docId);
            if (milestoneToEdit) {
                document.getElementById('milestone-date').value = milestoneToEdit.date;
                document.getElementById('milestone-title').value = milestoneToEdit.title;
                document.getElementById('milestone-description').value = milestoneToEdit.description;
                document.getElementById('addMilestoneModalLabel').textContent = 'Sửa Kỷ Niệm';
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
            strings: "Our Journey", speed: 100, lifeLike: true, cursor: true,
            cursorSpeed: 300, waitUntilVisible: true,
            afterComplete: (instance) => { instance.destroy(); }
        }).go();
    }

    class Stage {
        constructor() { this.render = this.render.bind(this); this.init(); this.createMesh(); this.handleEvents(); this.render(); }
        init() { const container = document.getElementById('canvas-container'); this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000); this.camera.position.z = 80; this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); this.renderer.setSize(window.innerWidth, window.innerHeight); this.renderer.setPixelRatio(window.devicePixelRatio); container.appendChild(this.renderer.domElement); }
        createMesh() { const geometry = new THREE.BufferGeometry(); const vertices = []; const numParticles = 1000; for (let i = 0; i < numParticles; i++) { vertices.push(Math.random() * 200 - 100, Math.random() * 200 - 100, Math.random() * 200 - 100); } geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); const material = new THREE.PointsMaterial({ color: 0x888888, size: 0.5, transparent: true, opacity: 0.8 }); this.points = new THREE.Points(geometry, material); this.scene.add(this.points); }
        handleEvents() { window.addEventListener('resize', this.onResize.bind(this)); document.addEventListener('mousemove', this.onMouseMove.bind(this)); }
        onResize() { this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(window.innerWidth, window.innerHeight); }
        onMouseMove(event) { const mouseX = (event.clientX / window.innerWidth) * 2 - 1; const mouseY = -(event.clientY / window.innerHeight) * 2 + 1; gsap.to(this.scene.rotation, { duration: 1.5, x: mouseY * 0.2, y: mouseX * 0.2, ease: "power2.out" }); }
        render() { requestAnimationFrame(this.render); this.points.rotation.y += 0.0005; this.renderer.render(this.scene, this.camera); }
    }
    new Stage();
});