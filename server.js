const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
const db = new Database('worktracker.db');
db.pragma('journal_mode = WAL');

// Create tables
const initDB = () => {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('owner', 'editor', 'viewer')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Projects table
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      location TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'on-hold')),
      start_date DATE,
      end_date DATE,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // Tasks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in-progress', 'completed')),
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
      assigned_to INTEGER,
      due_date DATE,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_to) REFERENCES users(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // Create default admin user if no users exist
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', hashedPassword, 'owner');
    console.log('Default admin user created (username: admin, password: admin123)');
  }
};

initDB();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'kap-survey-secret-key-' + Math.random().toString(36),
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Serve static files
app.use(express.static('public'));

// Auth middleware
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'غير مصرح' });
  }
  next();
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'غير مصرح' });
    }
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.session.userId);
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ error: 'ليس لديك صلاحية' });
    }
    next();
  };
};

// ===== AUTH ROUTES =====
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }
    
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    
    res.json({
      id: user.id,
      username: user.username,
      role: user.role
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'خطأ في تسجيل الدخول' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'تم تسجيل الخروج بنجاح' });
});

app.get('/api/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(req.session.userId);
  res.json(user);
});

// ===== USER ROUTES =====
app.get('/api/users', requireAuth, (req, res) => {
  try {
    const users = db.prepare('SELECT id, username, role, created_at FROM users').all();
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'خطأ في جلب المستخدمين' });
  }
});

app.post('/api/users', requireRole('owner'), (req, res) => {
  const { username, password, role } = req.body;
  
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
  }
  
  if (!['owner', 'editor', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'الدور غير صحيح' });
  }
  
  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(username, hashedPassword, role);
    res.json({ id: result.lastInsertRowid, username, role });
  } catch (error) {
    console.error('Create user error:', error);
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'اسم المستخدم موجود بالفعل' });
    } else {
      res.status(500).json({ error: 'خطأ في إنشاء المستخدم' });
    }
  }
});

app.delete('/api/users/:id', requireRole('owner'), (req, res) => {
  const { id } = req.params;
  
  if (parseInt(id) === req.session.userId) {
    return res.status(400).json({ error: 'لا يمكنك حذف حسابك الخاص' });
  }
  
  try {
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ message: 'تم حذف المستخدم بنجاح' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'خطأ في حذف المستخدم' });
  }
});

// ===== PROJECT ROUTES =====
app.get('/api/projects', requireAuth, (req, res) => {
  try {
    const projects = db.prepare(`
      SELECT p.*, u.username as created_by_name
      FROM projects p
      LEFT JOIN users u ON p.created_by = u.id
      ORDER BY p.created_at DESC
    `).all();
    res.json(projects);
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'خطأ في جلب المشاريع' });
  }
});

app.get('/api/projects/:id', requireAuth, (req, res) => {
  try {
    const project = db.prepare(`
      SELECT p.*, u.username as created_by_name
      FROM projects p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = ?
    `).get(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'المشروع غير موجود' });
    }
    
    res.json(project);
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'خطأ في جلب المشروع' });
  }
});

app.post('/api/projects', requireRole('owner', 'editor'), (req, res) => {
  const { name, description, location, start_date, end_date, status } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'اسم المشروع مطلوب' });
  }
  
  try {
    const result = db.prepare(`
      INSERT INTO projects (name, description, location, start_date, end_date, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, description || null, location || null, start_date || null, end_date || null, status || 'active', req.session.userId);
    
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
    res.json(project);
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'خطأ في إنشاء المشروع' });
  }
});

app.put('/api/projects/:id', requireRole('owner', 'editor'), (req, res) => {
  const { id } = req.params;
  const { name, description, location, start_date, end_date, status } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'اسم المشروع مطلوب' });
  }
  
  try {
    db.prepare(`
      UPDATE projects
      SET name = ?, description = ?, location = ?, start_date = ?, end_date = ?, status = ?
      WHERE id = ?
    `).run(name, description || null, location || null, start_date || null, end_date || null, status || 'active', id);
    
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    res.json(project);
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'خطأ في تحديث المشروع' });
  }
});

app.delete('/api/projects/:id', requireRole('owner'), (req, res) => {
  try {
    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    res.json({ message: 'تم حذف المشروع بنجاح' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'خطأ في حذف المشروع' });
  }
});

// ===== TASK ROUTES =====
app.get('/api/tasks', requireAuth, (req, res) => {
  const { project_id } = req.query;
  
  try {
    let query = `
      SELECT t.*, 
             p.name as project_name,
             u1.username as assigned_to_name,
             u2.username as created_by_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.created_by = u2.id
    `;
    
    if (project_id) {
      query += ' WHERE t.project_id = ?';
      const tasks = db.prepare(query + ' ORDER BY t.created_at DESC').all(project_id);
      res.json(tasks);
    } else {
      const tasks = db.prepare(query + ' ORDER BY t.created_at DESC').all();
      res.json(tasks);
    }
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'خطأ في جلب المهام' });
  }
});

app.post('/api/tasks', requireRole('owner', 'editor'), (req, res) => {
  const { project_id, title, description, status, priority, assigned_to, due_date } = req.body;
  
  if (!project_id || !title) {
    return res.status(400).json({ error: 'معرف المشروع وعنوان المهمة مطلوبان' });
  }
  
  try {
    const result = db.prepare(`
      INSERT INTO tasks (project_id, title, description, status, priority, assigned_to, due_date, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      project_id, 
      title, 
      description || null, 
      status || 'pending', 
      priority || 'medium', 
      assigned_to || null, 
      due_date || null, 
      req.session.userId
    );
    
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
    res.json(task);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'خطأ في إنشاء المهمة' });
  }
});

app.put('/api/tasks/:id', requireRole('owner', 'editor'), (req, res) => {
  const { id } = req.params;
  const { title, description, status, priority, assigned_to, due_date } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: 'عنوان المهمة مطلوب' });
  }
  
  try {
    db.prepare(`
      UPDATE tasks
      SET title = ?, description = ?, status = ?, priority = ?, assigned_to = ?, due_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(title, description || null, status || 'pending', priority || 'medium', assigned_to || null, due_date || null, id);
    
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    res.json(task);
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'خطأ في تحديث المهمة' });
  }
});

app.delete('/api/tasks/:id', requireRole('owner', 'editor'), (req, res) => {
  try {
    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    res.json({ message: 'تم حذف المهمة بنجاح' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'خطأ في حذف المهمة' });
  }
});

// ===== STATISTICS ROUTES =====
app.get('/api/stats', requireAuth, (req, res) => {
  try {
    const projectCount = db.prepare('SELECT COUNT(*) as count FROM projects').get().count;
    const taskCount = db.prepare('SELECT COUNT(*) as count FROM tasks').get().count;
    const completedTasks = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE status = ?').get('completed').count;
    const pendingTasks = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE status = ?').get('pending').count;
    const inProgressTasks = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE status = ?').get('in-progress').count;
    
    res.json({
      projectCount,
      taskCount,
      completedTasks,
      pendingTasks,
      inProgressTasks
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'خطأ في جلب الإحصائيات' });
  }
});

// Root route - serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const getLocalIP = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
};

app.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log('='.repeat(60));
  console.log('🚀 تطبيق متابعة الأعمال يعمل الآن!');
  console.log('='.repeat(60));
  console.log(`\n📍 الوصول المحلي: http://localhost:${PORT}`);
  console.log(`📍 الوصول من الشبكة: http://${localIP}:${PORT}`);
  console.log(`\n👤 المستخدم الافتراضي:`);
  console.log(`   اسم المستخدم: admin`);
  console.log(`   كلمة المرور: admin123`);
  console.log('\n' + '='.repeat(60));
  console.log('💡 لإيقاف التطبيق اضغط Ctrl+C');
  console.log('='.repeat(60) + '\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nجاري إيقاف التطبيق...');
  db.close();
  process.exit(0);
});
