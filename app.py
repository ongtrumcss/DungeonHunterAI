from flask import Flask, render_template, request, jsonify, send_from_directory
from collections import deque
import time
import os

app = Flask(__name__)

# Dùng thư mục static/images thay vì đường dẫn cứng Windows
IMG_DIR = os.path.join(os.path.dirname(__file__), 'static', 'images')

@app.route('/images/<path:filename>')
def serve_image(filename):
    return send_from_directory(IMG_DIR, filename)

def get_neighbors(r, c, grid):
    neighbors = []
    rows = len(grid)
    cols = len(grid[0]) if rows > 0 else 0
    # Ưu tiên các hướng: Xuống, Phải, Lên, Trái
    dirs = [(1, 0), (0, 1), (-1, 0), (0, -1)]
    for dr, dc in dirs:
        nr, nc = r + dr, c + dc
        if 0 <= nr < rows and 0 <= nc < cols:
            if grid[nr][nc] != 'wall':
                neighbors.append((nr, nc))
    return neighbors

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/solve', methods=['POST'])
def solve():
    # Nhận dữ liệu trạng thái Sa bàn từ Web
    data = request.json
    grid = data['grid'] 
    start = tuple(data['start']) 
    end = tuple(data['end'])
    algo = data['algo']
    
    steps = []
    came_from = {}
    path = []
    
    t0 = time.time()
    
    if algo == 'dfs':
        # Thuật toán DFS bằng Stack
        stack = [start]
        visited = set([start])
        
        while stack:
            curr = stack.pop()
            if curr != start and curr != end:
                steps.append(curr)
                
            if curr == end:
                curr_path = end
                while curr_path in came_from:
                    path.append(curr_path)
                    curr_path = came_from[curr_path]
                path.reverse()
                break
                
            neighbors = get_neighbors(curr[0], curr[1], grid)
            # Dùng reversed để xử lý đúng với DFS (đi sâu nhất có thể xuống dưới và sang phải)
            for n in reversed(neighbors):
                if n not in visited:
                    visited.add(n)
                    came_from[n] = curr
                    stack.append(n)
                    
    elif algo == 'bfs':
        # Thuật toán BFS bằng Hàng đợi (Queue)
        queue = deque([start])
        visited = set([start])
        
        while queue:
            curr = queue.popleft()
            if curr != start and curr != end:
                steps.append(curr)
                
            if curr == end:
                curr_path = end
                while curr_path in came_from:
                    path.append(curr_path)
                    curr_path = came_from[curr_path]
                path.reverse()
                break
                
            neighbors = get_neighbors(curr[0], curr[1], grid)
            for n in neighbors:
                if n not in visited:
                    visited.add(n)
                    came_from[n] = curr
                    queue.append(n)
                    
    t1 = time.time()
    time_ms = round((t1 - t0) * 1000, 2)
                    
    # Trả list các bước duyệt và mảng đường đi tốt nhất lại cho phía Client (Javascript) để render màu sắc.
    return jsonify({
        'steps': steps,
        'path': path,
        'time_ms': time_ms
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('RENDER') is None  # Tắt debug khi chạy trên Render
    print("🤖 CleanBot-X Server đang khởi động...")
    print(f"👉 Hãy mở http://127.0.0.1:{port} trên trình duyệt!")
    app.run(debug=debug, host='0.0.0.0', port=port)
