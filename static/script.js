// ==========================================
// 1. MODULE GAME VIEWS CỦA MENU CHÍNH
// ==========================================
function showView(viewId) {
    document.querySelectorAll('.game-view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

let currentMapIndex = 0;

function startGame(mapIndex) {
    showView('view-simulation');
    currentMapIndex = mapIndex;
    const mapInfo = PRESET_MAPS[mapIndex];
    document.getElementById('current-level-title').innerText = mapInfo.name;
    loadMap(mapIndex);
}

// ==========================================
// 2. BOARD LOGIC & PATHFINDING
// ==========================================
const ROWS = 21;
const COLS = 42;

let START_NODE_ROW = 10;
let START_NODE_COL = 6;
let END_NODE_ROW = 10;
let END_NODE_COL = 35;

// Các thuật toán xây dựng sơ đồ Hầm Ngục phức tạp
function buildZigZag() {
    let w = [];
    for(let r=3; r<ROWS-3; r+=4) { for(let c=0; c<COLS-5; c++) w.push([r, c]); }
    for(let r=5; r<ROWS-1; r+=4) { for(let c=5; c<COLS; c++) w.push([r, c]); }
    return w;
}

function buildSpiral() {
    let w = [];
    for (let c=2; c<COLS-2; c++) { w.push([2, c]); w.push([18, c]); }
    for (let r=2; r<=18; r++) { w.push([r, 2]); w.push([r, COLS-3]); }
    for (let c=5; c<COLS-5; c++) { w.push([6, c]); w.push([14, c]); }
    for (let r=6; r<=14; r++) { w.push([r, 5]); w.push([r, COLS-6]); }
    for (let c=8; c<COLS-8; c++) { w.push([10, c]); }
    
    return w.filter(pos => {
        let [r, c] = pos;
        if (r===2 && c===4) return false;
        if (r===18 && c===COLS-5) return false;
        if (r===6 && c===COLS-8) return false;
        if (r===14 && c===8) return false;
        return true;
    });
}

function buildScattered() {
    let w = [];
    for(let r=1; r<ROWS-1; r++) {
        for(let c=4; c<COLS-4; c++) {
            if ((r % 3 === 0) && (c % 4 !== 0)) w.push([r, c]);
            if ((r % 3 !== 0) && (c % 4 === 0)) w.push([r, c]);
        }
    }
    return w;
}

function buildRooms() {
    let w = [];
    [7, 14].forEach(r => { for(let c=0; c<COLS; c++) { if (c!==6 && c!==20 && c!==35) w.push([r, c]); } });
    [10, 20, 30].forEach(c => { for(let r=0; r<ROWS; r++) { if (r!==3 && r!==11 && r!==18) w.push([r, c]); } });
    return w;
}

function buildThrone() {
    let w = [];
    for(let r=6; r<=14; r++) { w.push([r, 15]); w.push([r, 26]); }
    for(let c=15; c<=26; c++) { w.push([6, c]); w.push([14, c]); }
    for(let r=3; r<=17; r++) { w.push([r, 8]); w.push([r, 33]); }
    for(let c=8; c<=33; c++) { w.push([3, c]); w.push([17, c]); }
    
    return w.filter(p => !([
        [6,20],[6,21],[14,20],[14,21], 
        [10,8],[11,8],[10,33],[11,33], 
    ].some(d => d[0]===p[0] && d[1]===p[1])));
}

const PRESET_MAPS = [
    { name: "Màn 1: Cửa Đi Khởi Đầu", monsterClass: "level-normal", start: [1, 1], end: [19, 39], walls: buildZigZag() },
    { name: "Màn 2: Mê Cung Vô Tận", monsterClass: "level-golem", start: [4, 4], end: [9, 20], walls: buildSpiral() },
    { name: "Màn 3: Bãi Đá Chông Nhọn", monsterClass: "level-elite", start: [10, 1], end: [10, 40], walls: buildScattered() },
    { name: "Màn 4: Pháo Đài Giam Cầm", monsterClass: "level-necromancer", start: [3, 2], end: [18, 38], walls: buildRooms() },
    { name: "Màn 5: Lãnh Địa Boss Cuối", monsterClass: "level-boss", start: [10, 20], end: [2, 38], walls: buildThrone() },
    { name: "✨ Chế Độ Sáng Tạo (Sandbox)", monsterClass: "level-normal", start: [10, 5], end: [10, 35], walls: [] }
];

const gridElement = document.getElementById('grid');
let grid = [];
let isDrawingWall = false;
let isErasingWall = false;
let isMovingStart = false;
let isMovingEnd = false;
let isAlgorithmRunning = false;

function initGrid() {
    gridElement.style.gridTemplateColumns = `repeat(${COLS}, auto)`;
    gridElement.innerHTML = '';
    grid = [];
    
    for (let r = 0; r < ROWS; r++) {
        let currentRow = [];
        for (let c = 0; c < COLS; c++) {
            const node = document.createElement('div');
            node.className = 'node';
            node.id = `node-${r}-${c}`;
            if (r === START_NODE_ROW && c === START_NODE_COL) node.classList.add('start-node');
            else if (r === END_NODE_ROW && c === END_NODE_COL) node.classList.add('end-node');
            
            node.addEventListener('mousedown', (e) => handleMouseDown(e, r, c));
            node.addEventListener('mouseenter', () => handleMouseEnter(r, c));
            node.addEventListener('mouseup', handleMouseUp);
            
            gridElement.appendChild(node);
            currentRow.push(node);
        }
        grid.push(currentRow);
    }
}

function handleMouseDown(e, r, c) {
    if (isAlgorithmRunning) return;
    e.preventDefault(); 
    const node = grid[r][c];
    if (node.classList.contains('start-node')) isMovingStart = true;
    else if (node.classList.contains('end-node')) isMovingEnd = true;
    else if (node.classList.contains('wall-node')) { isErasingWall = true; node.classList.remove('wall-node'); }
    else { isDrawingWall = true; node.classList.add('wall-node'); node.classList.remove('visited-dfs', 'visited-bfs', 'path'); }
}

function handleMouseEnter(r, c) {
    if (isAlgorithmRunning) return;
    if (isMovingStart) { moveSpecialNode('start-node', r, c); START_NODE_ROW = r; START_NODE_COL = c; }
    else if (isMovingEnd) { moveSpecialNode('end-node', r, c); END_NODE_ROW = r; END_NODE_COL = c; }
    else if (isDrawingWall) {
        const node = grid[r][c];
        if (!node.classList.contains('start-node') && !node.classList.contains('end-node')) {
            node.classList.add('wall-node');
            node.classList.remove('visited-dfs', 'visited-bfs', 'path');
        }
    } else if (isErasingWall) { grid[r][c].classList.remove('wall-node'); }
}

function handleMouseUp() { isDrawingWall = false; isErasingWall = false; isMovingStart = false; isMovingEnd = false; }
document.body.addEventListener('mouseup', handleMouseUp);
document.body.addEventListener('mouseleave', handleMouseUp);

function moveSpecialNode(className, r, c) {
    const node = grid[r][c];
    if (node.classList.contains('wall-node')) return; 
    const prevNode = document.querySelector(`.${className}:not(.legend-node)`);
    if (prevNode) prevNode.classList.remove(className);
    node.classList.add(className);
}

function softReset() {
    document.getElementById('metrics-dashboard').classList.remove('show');
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            grid[r][c].classList.remove('visited-dfs', 'visited-bfs', 'path', 'death-slash', 'spawn-altar', 'start-node', 'end-node');
        }
    }
    document.querySelectorAll('.doom-skill').forEach(d => d.remove());
    document.body.classList.remove('doom-shake', 'screen-shake');
    
    // Đặt lại vị trí xuất phát nếu nó bị ghi đè các Animation lớp trên
    grid[START_NODE_ROW][START_NODE_COL].classList.add('start-node');
    grid[END_NODE_ROW][END_NODE_COL].classList.add('end-node');
}

// Thay đổi tạo hình NPC 
window.changeNPC = function(npcClass) {
    if (isAlgorithmRunning) return;
    gridElement.classList.remove('level-normal', 'level-golem', 'level-elite', 'level-necromancer', 'level-boss');
    gridElement.classList.add(npcClass);
};

// Full reset board
window.loadMap = function(index) {
    if (isAlgorithmRunning) return;
    const map = PRESET_MAPS[index];
    START_NODE_ROW = map.start[0]; START_NODE_COL = map.start[1];
    END_NODE_ROW = map.end[0]; END_NODE_COL = map.end[1];
    
    initGrid();
    gridElement.classList.remove('level-normal', 'level-golem', 'level-elite', 'level-necromancer', 'level-boss');
    gridElement.classList.add(map.monsterClass);

    for (const [r, c] of map.walls) {
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) grid[r][c].classList.add('wall-node');
    }
};
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ================= HỆ THỐNG ÂM THANH 8-BIT =====================
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playSound(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'scan') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(600 + Math.random()*200, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.015, audioCtx.currentTime); // Cực nhỏ, đỡ chói tai
        osc.start();
        osc.stop(audioCtx.currentTime + 0.02);
    } else if (type === 'step') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(250, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'doom' || type === 'coffin') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 3);
        gainNode.gain.setValueAtTime(0.25, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 3);
    } else if (type === 'hit') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.25);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
    } else if (type === 'overload') {
        osc.type = 'square';
        for(let i=0; i<10; i++){
            osc.frequency.setValueAtTime(Math.random()*800 + 200, audioCtx.currentTime + i*0.1);
        }
        gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 1);
    }
}

const MAP_LORE = {
    0: { 
         name: "Hài Cốt Bộ Binh", img: "url('/images/normal.png')",
         hero: "Cửa ải đầu tiên... Tên lính gác vô tri kia có vẻ ngu ngốc, nhưng không được bất cẩn!",
         dfs: "Khúc xương... Của ta... Khám xét từng ngóc ngách! (Truy vết DFS)",
         bfs: "Dễ... Xơi... Hợp binh dàn ngang truy kích!! (Sóng ngầm BFS)",
         doom: "Tường rào lỏng lẻo này cản đường lối của ta ư? QUÁ TRẺ CON! CHẾT ĐI!"
    },
    1: {
         name: "Ma Tượng Golem", img: "url('/images/golem.png')",
         hero: "Mê cung xoắn ốc chóng mặt quá... Bóng đen khổng lồ đằng kia là thứ gì vậy?",
         dfs: "ĐÁNH THỨC... LỒI LÕM... QUÉT SẠCH KẺ ĐỨNG BÊN DƯỚI! (Quét DFS)",
         bfs: "RUNG CHẤN TÂM... TRUYỀN PHÁT... NGHIỀN NÁT... (Thắp sáng BFS)",
         doom: "ĐỊA HÌNH KÍN CŨNG KHÔNG THỂ NGĂN BƯỚC CHÂN TA! NGHIỀN NÁT!!"
    },
    2: {
         name: "Sát Thủ Huyết Nguyệt", img: "url('/images/elite.png')",
         hero: "Chướng ngại vật lởm chởm quá khó lách qua... Có sát khí rình rập ở đằng sau...",
         dfs: "Chạy đi đâu? Con dao này đâm mạnh hơn bóng đen gấp vạn lần! (Ám Sát DFS)",
         bfs: "Nồng nặc mùi máu thật sự! Sóng xung kích của ta chăng khắp ngõ ngách! (Lưới BFS)",
         doom: "Chạy trốn trong góc tối đó hở? Nếm lấy cái chết đi!"
    },
    3: {
         name: "Tà Sư Trấn Ngục", img: "url('/images/necromancer.png')",
         hero: "Hắn tha hóa cả không gian thành từng buồng kín! Ai chà, rắc rối to đây...",
         dfs: "Lạc trôi trong hầm mộ vĩnh hằng! Linh hồn đã đi lạc! (Trù ếm DFS)",
         bfs: "Sự phân rã len lỏi qua từng căn phòng nhỏ nhoi... Kết cục định sẵn! (Sóng BFS)",
         doom: "Trận pháp này của ta! Ở trong góc phòng đó thì ôm xác mà CHẾT!"
    },
    4: {
         name: "Minotaur Ma Vương", img: "url('/images/boss.png')",
         hero: "Tuyệt đối không đùa được... Sức ép ở căn phòng lớn này khiến nghẹt thở!!",
         dfs: "TÊN TÉP RIU NÀO DÁM PHÁ VỠ GIẤC MỘNG NGÀN NĂM CỦA TA ? LÙNG SỤC! (DFS)",
         bfs: "HÚT LẤY... SINH LỰC! ĐẤU TRƯỜNG THỰC CÔNG MỞ MÀN NAY QUY QUYẾN! (BFS)",
         doom: "ĐÁNH BOSS MÀ DÙNG CHÚT ĐÁ ĐIÊU KHẮC HÈN MỌN?? CẢN ĐƯỢC CHÚC TỂ SAO! DIỆT!!"
    },
    5: { // Sandbox
         name: "Tác Tử Vô Danh", img: "url('/images/normal.png')", // Mặc định
         hero: "Không gian Trắng... Đây thế giới khởi nguyên. Mình có thể làm bức cứ thứ gì...",
         dfs: "ĐỊNH TUYẾN DFS LUYỆN TẬP KHỞI ĐỘNG...",
         bfs: "RẢI SÓNG BFS ĐỂ TÌM TIẾN TRÌNH LUYỆN TẬP...",
         doom: "LỖI LẬP TRÌNH: TRỰC QUAN ĐỊA HÌNH KÍN... KÍCH HOẠT HỦY DIỆT!!"
    }
};

function getMonsterData(mapIndex) {
    let data = { ...MAP_LORE[mapIndex] };
    if (gridElement.classList.contains('level-normal')) { data.img = "url('/images/normal.png')"; data.name = "Bộ Xương Thực Mạng"; }
    else if (gridElement.classList.contains('level-golem')) { data.img = "url('/images/golem.png')"; data.name = "Ma Tượng Golem"; }
    else if (gridElement.classList.contains('level-elite')) { data.img = "url('/images/elite.png')"; data.name = "Sát Thủ Ám Dạ"; }
    else if (gridElement.classList.contains('level-necromancer')) { data.img = "url('/images/necromancer.png')"; data.name = "Tà Sư Quản Ngục"; }
    else if (gridElement.classList.contains('level-boss')) { data.img = "url('/images/boss.png')"; data.name = "MINOTAUR TỐI THƯỢNG"; }
    
    // Nếu Map hiện tại không phải Sandbox thì Cốt truyện Text giữ nguyên theo map, Dù ng chơi có đổi Avatar Monster
    return data;
}

async function playDialogueSequence(algo) {
    const container = document.getElementById('dialogue-container');
    const avatar = document.getElementById('dialogue-avatar');
    const nameEl = document.getElementById('dialogue-name');
    const textEl = document.getElementById('dialogue-text');

    const curLore = MAP_LORE[currentMapIndex];

    // Mở màn: Hero
    avatar.style.backgroundImage = "url('/images/hero.png')";
    nameEl.innerText = "Hiệp Sĩ Quả Cảm";
    nameEl.style.color = "#34d399";
    textEl.innerText = curLore.hero;
    
    container.classList.remove('hidden'); container.classList.add('show');
    await sleep(2600);

    container.classList.remove('show'); container.classList.add('hidden');
    await sleep(300);

    // Kẻ địch đáp trả
    const mData = getMonsterData(currentMapIndex);
    
    avatar.style.backgroundImage = mData.img;
    nameEl.innerText = mData.name;
    nameEl.style.color = "#ef4444";
    textEl.innerText = (algo === 'dfs') ? curLore.dfs : curLore.bfs;

    container.classList.remove('hidden'); container.classList.add('show');
    await sleep(3800);

    container.classList.remove('show'); container.classList.add('hidden');
    await sleep(400); // Wait for transition
}

async function playDespairDialogue() {
    const container = document.getElementById('dialogue-container');
    const avatar = document.getElementById('dialogue-avatar');
    const nameEl = document.getElementById('dialogue-name');
    const textEl = document.getElementById('dialogue-text');

    const mData = getMonsterData(currentMapIndex);
    const curLore = MAP_LORE[currentMapIndex];

    avatar.style.backgroundImage = mData.img;
    nameEl.innerText = mData.name;
    nameEl.style.color = "#b91c1c";
    textEl.innerText = curLore.doom;

    container.classList.remove('hidden'); container.classList.add('show');
    await sleep(4500);

    container.classList.remove('show'); container.classList.add('hidden');
    await sleep(300);
}

// ================= EASTER EGGS =====================
window.showTrollHints = async function() {
    if (isAlgorithmRunning) return;
    
    const container = document.getElementById('dialogue-container');
    const avatar = document.getElementById('dialogue-avatar');
    const nameEl = document.getElementById('dialogue-name');
    const textEl = document.getElementById('dialogue-text');

    avatar.style.backgroundImage = "url('/images/hero.png')"; 
    avatar.style.filter = "invert(1) hue-rotate(180deg)"; // Nhìn kinh dị luôn
    nameEl.innerText = "Linh Hồn Dev Game";
    nameEl.style.color = "#fbbf24";
    
    const hints = [
        "Aha... Nhìn mặt là biết cay cú vì chết quá nhiều rồi đúng không gà cưng?",
        "Gợi Ý 1 (Gan lỳ): Bọn hèn nhát luôn thích bỏ chạy ra thật xa... nhưng nếu kéo Đích cắm mặt vào ngay Mồm Quỷ lúc nó xuất phát... biết đâu lại là chân lý?",
        "Gợi Ý 2 (Đê Hèn): Tại sao cứ phải chặn 1 bức tường đứng xa nhìn nó khóc? Có ngon thì đắp luôn 4 BỨC TƯỜNG bao kín 4 mặt quanh cái ghế nó đang ngự đi?",
        "Gợi Ý 3 (Não To): Quỷ méo có tiền đình đâu! Vào Chế độ Mở, xây cho nó 1 con Rắn Lộ Trình ngoằn ngoèo dài như Hà Nội tới Cà Mau (Dài hơn 100 bước), trổ tài đi cưng!"
    ];

    container.classList.remove('hidden'); container.classList.add('show');
    for(let i=0; i<hints.length; i++) {
        textEl.innerText = hints[i];
        await sleep(i===0 ? 3000 : 5000); 
    }
    
    container.classList.remove('show'); container.classList.add('hidden');
    avatar.style.filter = ""; // Trả lại bình thường
};

async function playEasterEggDialogue(type) {
    const container = document.getElementById('dialogue-container');
    const avatar = document.getElementById('dialogue-avatar');
    const nameEl = document.getElementById('dialogue-name');
    const textEl = document.getElementById('dialogue-text');

    const mData = getMonsterData(currentMapIndex);
    avatar.style.backgroundImage = mData.img;
    nameEl.innerText = mData.name;
    nameEl.style.color = "#a855f7";
    
    if (type === 'assassinate') {
        textEl.innerText = "Ơ khoan... Tại sao nộp mạng ngay miệng thế mà lại dám rút kiếm rút kiếmmmm.. Ácccc!!";
    } else if (type === 'coffin') {
        textEl.innerText = "Không thể nào... Thằng Hiệp Sĩ mất dạy đi đổ Bê tông 4 vách kín mít chôn sống ta à?? Ặccccc!! Ngộp thở...";
    } else if (type === 'overload') {
        textEl.innerText = "Mê... Mê Cung lộ trình quá dài... Lão tử đi đến sùi bọt mép tiền đình dồiiiiii... Óiiii...";
    }

    container.classList.remove('hidden'); container.classList.add('show');
    await sleep(4000);
    container.classList.remove('show'); container.classList.add('hidden');
    await sleep(300);
}
// ====================================================

async function solvePathfinding(algo) {
    initAudio();
    if (isAlgorithmRunning) return;
    softReset(); // Khôi phục vết chạy AI nhưng GIỮ NGUYÊN các khối tường nham thạch người chơi đã vẽ
    isAlgorithmRunning = true;
    
    const btnDfs = document.getElementById('btn-dfs');
    const btnBfs = document.getElementById('btn-bfs');
    const killOverlay = document.getElementById('kill-overlay');
    
    try {
        btnDfs.disabled = true; btnBfs.disabled = true;

        // ----- KÍCH HOẠT HỘI THOẠI -----
        await playDialogueSequence(algo);
        // -------------------------------

        let gridData = [];
        for (let r = 0; r < ROWS; r++) {
            let row = [];
            for (let c = 0; c < COLS; c++) {
                row.push(grid[r][c].classList.contains('wall-node') ? 'wall' : 'empty');
            }
            gridData.push(row);
        }
        const payload = { grid: gridData, start: [START_NODE_ROW, START_NODE_COL], end: [END_NODE_ROW, END_NODE_COL], algo: algo };

        const response = await fetch('/solve', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error("API Lỗi!");
        const data = await response.json();
        
        btnDfs.disabled = false; btnBfs.disabled = false;

        // --- HIỂN THỊ DASHBOARD BÁO CÁO TÁC TỬ ---
        document.getElementById('met-algo').innerText = algo.toUpperCase();
        document.getElementById('met-time').innerText = data.time_ms + " ms";
        document.getElementById('met-steps').innerText = data.steps.length + " ô";
        document.getElementById('met-path').innerText = data.path.length > 0 ? (data.path.length + " ô") : "0 (Lạc đường)";
        document.getElementById('metrics-dashboard').classList.add('show');

        // VẼ ĐƯỜNG VẾT
        const delay = (algo === 'dfs') ? 10 : 8; 
        let scanCounter = 0;
        for (const step of data.steps) {
            const node = grid[step[0]][step[1]];
            if (algo === 'dfs') node.classList.add('visited-dfs');
            else node.classList.add('visited-bfs');
            
            if (scanCounter++ % 4 === 0) playSound('scan');
            await sleep(delay);
        }

        // ĐIỀU KIỆN EASTER EGGS / CƠ CHẾ THẮNG ẨN
        let isAdjacent = (Math.abs(START_NODE_ROW - END_NODE_ROW) + Math.abs(START_NODE_COL - END_NODE_COL) === 1);
        
        let isBuriedAlive = true;
        const dirs = [[0,1], [0,-1], [1,0], [-1,0]];
        for (let d of dirs) {
            let nr = START_NODE_ROW + d[0], nc = START_NODE_COL + d[1];
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
                if (!grid[nr][nc].classList.contains('wall-node')) isBuriedAlive = false;
            }
        } // Đủ 4 bề (cả mép bản đồ) là tường -> Bị chôn.

        // XỬ LÝ LỘ TRÌNH VÀ CHIẾN THẮNG ẨN
        if (isAdjacent) {
            // EGG 1: KẺ ĐI SĂN TRỞ THÀNH CON MỒI
            await playEasterEggDialogue('assassinate');
            playSound('hit');
            grid[START_NODE_ROW][START_NODE_COL].classList.add('death-slash');
            document.body.classList.add('screen-shake');
            setTimeout(() => document.body.classList.remove('screen-shake'), 400);

            killOverlay.innerHTML = `
                <div class="glitch-text" data-text="VICTORY!" style="font-size:clamp(60px, 10vw, 130px); color:#fbbf24;">VICTORY!</div>
                <div class="sub-kill" style="color:#34d399;">TIÊN HẠ THỦ VI CƯỜNG! BẠN VỪA ÁM SÁT BOSS!</div>
            `;
            killOverlay.classList.add('show');
            setTimeout(() => { killOverlay.classList.remove('show'); killOverlay.innerHTML = ""; }, 5500);

        } else if (isBuriedAlive && data.path.length === 0) {
            // EGG 2: ĐÓNG NẮP QUAN TÀI
            await playEasterEggDialogue('coffin');
            playSound('coffin');
            grid[START_NODE_ROW][START_NODE_COL].classList.remove('start-node'); // Boss tự tan biến
            document.body.classList.add('doom-shake');
            setTimeout(() => document.body.classList.remove('doom-shake'), 400);

            killOverlay.innerHTML = `
                <div class="glitch-text" data-text="VICTORY" style="font-size:clamp(60px, 10vw, 130px); color:#fbbf24;">VICTORY</div>
                <div class="sub-kill" style="color:#d946ef;">CHÚA TỂ BỊ BẠN ĐỔ BÊ TÔNG CHÔN SỐNG TRONG QUAN TÀI 1X1!</div>
            `;
            killOverlay.classList.add('show');
            setTimeout(() => { killOverlay.classList.remove('show'); killOverlay.innerHTML = ""; }, 5500);

        } else if (currentMapIndex === 5 && data.path.length > 95) {
            // EGG 3: LỖI TIỀN ĐÌNH AI (Chỉ áp dụng ở Sandbox khi đường rắn trên 95 ô)
            await playEasterEggDialogue('overload');
            playSound('overload');
            killOverlay.innerHTML = `
                <div class="glitch-text" data-text="VICTORY" style="font-size:clamp(60px, 10vw, 130px); color:#fbbf24;">VICTORY</div>
                <div class="sub-kill" style="color:#38bdf8;">ĐI HOÀI KHÔNG TỚI, AI BỊ RỐI LOẠN TIỀN ĐÌNH NÊN VỠ MẠCH TỰ HỦY!</div>
            `;
            killOverlay.classList.add('show');
            setTimeout(() => { killOverlay.classList.remove('show'); killOverlay.innerHTML = ""; }, 5500);
            
        } else if (data.path.length > 0) {
            // Đặt Tế đàn làm mốc
            grid[START_NODE_ROW][START_NODE_COL].classList.remove('start-node');
            grid[START_NODE_ROW][START_NODE_COL].classList.add('spawn-altar');

            for (let i = 0; i < data.path.length; i++) {
                const p = data.path[i];
                
                // Tô đường vàng vệt sáng
                if (!(p[0] === END_NODE_ROW && p[1] === END_NODE_COL) && !(p[0] === START_NODE_ROW && p[1] === START_NODE_COL)) {
                    grid[p[0]][p[1]].classList.add('path');
                }
                
                // Di chuyển quái vật
                grid[p[0]][p[1]].classList.add('start-node');
                playSound('step');
                
                // Xóa ảnh quái ở ô trước (nếu không phải là Tế đàn ban đầu)
                if (i > 0) {
                    const prev = data.path[i-1];
                    grid[prev[0]][prev[1]].classList.remove('start-node');
                } else {
                    // Xóa ảnh quái ở Tế đàn, chỉ để lại ánh sáng
                    grid[START_NODE_ROW][START_NODE_COL].classList.remove('start-node');
                }
                
                // Rung màn hình khi kết liễu
                if (p[0] === END_NODE_ROW && p[1] === END_NODE_COL) {
                    playSound('hit');
                    grid[END_NODE_ROW][END_NODE_COL].classList.remove('end-node');
                    grid[END_NODE_ROW][END_NODE_COL].classList.add('death-slash');
                    
                    document.body.classList.add('screen-shake');
                    setTimeout(() => document.body.classList.remove('screen-shake'), 400);

                    killOverlay.innerHTML = `
                        <div class="glitch-text" data-text="GAME OVER" style="font-size:clamp(60px, 10vw, 130px); color:#ef4444;">GAME OVER</div>
                    `;
                    
                    killOverlay.classList.add('show');
                    setTimeout(() => killOverlay.classList.remove('show'), 2000);
                }

                await sleep(50); // Tốc độ lướt di chuyển
            }
        } else {
            // ----- NGƯỜI CHƠI BAO BỌC TƯỜNG (KHÔNG CÓ ĐƯỜNG ĐI) -----
            // Kích hoạt Cơ chế TUYỆT VỌNG
            await playDespairDialogue();
            playSound('doom');

            const endNode = grid[END_NODE_ROW][END_NODE_COL];
            endNode.classList.remove('end-node'); // Xóa Player
            
            // Tung Kỹ năng ẩn: Huyết Trận Pentagram
            const doomElement = document.createElement('div');
            doomElement.className = 'doom-skill';
            document.body.appendChild(doomElement);
            
            const rect = endNode.getBoundingClientRect();
            doomElement.style.left = (rect.left + rect.width / 2) + 'px';
            doomElement.style.top = (rect.top + rect.height / 2) + 'px';

            document.body.classList.add('doom-shake');
            
            killOverlay.innerHTML = `
                <div class="glitch-text" data-text="TUYỆT VỌNG TỘT CÙNG" style="font-size:clamp(50px, 8vw, 110px); color:#991b1b;">TUYỆT VỌNG TỘT CÙNG</div>
                <div class="sub-kill">BAO BỌC BẰNG TƯỜNG CŨNG CHỈ LÀ SỰ VÙNG VẪY VÔ ÍCH...</div>
            `;
            killOverlay.classList.add('show');
            
            // Xoay màu nguyên map để tăng kích thích kinh dị
            document.getElementById('grid').style.transition = "filter 0.5s";
            document.getElementById('grid').style.filter = "hue-rotate(180deg) invert(0.85) contrast(1.5)";

            setTimeout(() => {
                killOverlay.classList.remove('show');
                doomElement.remove();
                document.body.classList.remove('doom-shake');
                killOverlay.innerHTML = ""; // Reset font
                document.getElementById('grid').style.filter = ""; // Trả lại bảng đồ màu cũ
            }, 5500);
        }

    } catch(err) {
        console.error(err);
        alert('Có lỗi, bạn thử refresh lại trình duyệt!');
        btnDfs.disabled = false; btnBfs.disabled = false;
    }
    isAlgorithmRunning = false;
}

document.getElementById('btn-dfs').addEventListener('click', () => solvePathfinding('dfs'));
document.getElementById('btn-bfs').addEventListener('click', () => solvePathfinding('bfs'));
document.getElementById('btn-clear-path').addEventListener('click', () => { if (!isAlgorithmRunning) softReset(); });

// Khi khởi động, nạp Màn 1
loadMap(0);
