// server.js - Academia Pulse Sync Server with REAL MySQL saving
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Create MySQL connection pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',        // XAMPP default
  password: '',        // XAMPP default (empty)
  database: 'u610315472_ap_master', // Change this to your database name
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test database connection on startup
async function testDbConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Connected to MySQL database');
    
    // Create tables if they don't exist
    await createTables(connection);
    
    connection.release();
  } catch (error) {
    console.error('❌ MySQL connection failed:', error);
    console.log('📝 Make sure:');
    console.log('   1. XAMPP is running');
    console.log('   2. MySQL is started in XAMPP');
    console.log('   3. Database "academia_pulse" exists');
  }
}

// Create necessary tables
async function createTables(connection) {
  try {
    // Schools table (add this first since other tables reference it)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS schools (
        school_id VARCHAR(50) PRIMARY KEY,
        school_name VARCHAR(200),
        province VARCHAR(100),
        district VARCHAR(100),
        contact_email VARCHAR(100),
        phone VARCHAR(20),
        address TEXT,
        status VARCHAR(20) DEFAULT 'Active',
        subscription_type VARCHAR(50),
        created_at DATETIME,
        updated_at DATETIME,
        INDEX idx_province (province),
        INDEX idx_district (district)
      )
    `);

    // Pupils table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS pupils (
        id INT AUTO_INCREMENT PRIMARY KEY,
        learner_id VARCHAR(50) UNIQUE,
        school_id VARCHAR(50),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        gender VARCHAR(20),
        grade VARCHAR(20),
        class VARCHAR(10),
        parent_name VARCHAR(200),
        parent_phone VARCHAR(20),
        email VARCHAR(100),
        photo_url TEXT,
        status VARCHAR(20) DEFAULT 'Active',
        created_at DATETIME,
        updated_at DATETIME,
        INDEX idx_school (school_id),
        INDEX idx_grade (grade),
        FOREIGN KEY (school_id) REFERENCES schools(school_id) ON DELETE CASCADE
      )
    `);

    // Staff table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS staff (
        id INT AUTO_INCREMENT PRIMARY KEY,
        staff_id VARCHAR(50) UNIQUE,
        school_id VARCHAR(50),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        email VARCHAR(100),
        phone VARCHAR(20),
        staff_type VARCHAR(50),
        qualification VARCHAR(100),
        employment_type VARCHAR(50),
        photo_url TEXT,
        status VARCHAR(20) DEFAULT 'Active',
        created_at DATETIME,
        updated_at DATETIME,
        INDEX idx_school (school_id),
        INDEX idx_type (staff_type),
        FOREIGN KEY (school_id) REFERENCES schools(school_id) ON DELETE CASCADE
      )
    `);

    // Attendance table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS attendance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        learner_id VARCHAR(50),
        school_id VARCHAR(50),
        student_name VARCHAR(200),
        grade VARCHAR(20),
        class_id VARCHAR(20),
        date DATE,
        status VARCHAR(20),
        remarks TEXT,
        absence_reason VARCHAR(100),
        created_at DATETIME,
        INDEX idx_learner (learner_id),
        INDEX idx_date (date),
        INDEX idx_class (class_id),
        FOREIGN KEY (learner_id) REFERENCES pupils(learner_id) ON DELETE CASCADE,
        FOREIGN KEY (school_id) REFERENCES schools(school_id) ON DELETE CASCADE
      )
    `);

    // Marks table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS marks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        learner_id VARCHAR(50),
        school_id VARCHAR(50),
        subject_id INT,
        subject_name VARCHAR(100),
        category VARCHAR(50),
        score INT,
        max_score INT DEFAULT 100,
        awarded_date DATE,
        awarded_by VARCHAR(50),
        created_at DATETIME,
        INDEX idx_learner (learner_id),
        INDEX idx_subject (subject_id),
        INDEX idx_date (awarded_date),
        FOREIGN KEY (learner_id) REFERENCES pupils(learner_id) ON DELETE CASCADE,
        FOREIGN KEY (school_id) REFERENCES schools(school_id) ON DELETE CASCADE
      )
    `);

    console.log('✅ Tables created/verified');
  } catch (error) {
    console.error('❌ Error creating tables:', error);
  }
}

// Log all requests (for debugging) - FIXED VERSION
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.url}`);
  
  // Safely log request body
  if (req.body && Object.keys(req.body).length > 0) {
    try {
      const bodyStr = JSON.stringify(req.body);
      console.log('📦 Body:', bodyStr.substring(0, 200) + (bodyStr.length > 200 ? '...' : ''));
    } catch (e) {
      console.log('📦 Body: [Unable to stringify]');
    }
  } else {
    console.log('📦 Body: (empty)');
  }
  
  next();
});

// ============= SCHOOLS ENDPOINTS =============
app.post('/api/schools', async (req, res) => {
  try {
    console.log('📥 Saving school to MySQL:', req.body.school_id);
    
    // Check if school exists
    const [existing] = await pool.execute(
      'SELECT school_id FROM schools WHERE school_id = ?',
      [req.body.school_id]
    );

    if (existing.length > 0) {
      // Update existing
      await pool.execute(
        `UPDATE schools SET 
          school_name = ?, province = ?, district = ?,
          contact_email = ?, phone = ?, address = ?,
          status = ?, subscription_type = ?, updated_at = NOW()
         WHERE school_id = ?`,
        [
          req.body.school_name,
          req.body.province,
          req.body.district,
          req.body.contact_email,
          req.body.phone,
          req.body.address,
          req.body.status || 'Active',
          req.body.subscription_type || 'Trial',
          req.body.school_id
        ]
      );
    } else {
      // Insert new
      await pool.execute(
        `INSERT INTO schools (
          school_id, school_name, province, district,
          contact_email, phone, address, status,
          subscription_type, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          req.body.school_id,
          req.body.school_name,
          req.body.province,
          req.body.district,
          req.body.contact_email,
          req.body.phone,
          req.body.address,
          req.body.status || 'Active',
          req.body.subscription_type || 'Trial'
        ]
      );
    }

    console.log(`✅ School ${req.body.school_id} saved to MySQL`);
    res.json({ success: true, id: req.body.school_id });
  } catch (error) {
    console.error('❌ Error saving school:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============= PUPILS ENDPOINTS =============
app.post('/api/pupils', async (req, res) => {
  try {
    console.log('📥 Saving pupil to MySQL:', req.body.learner_id);
    
    const [result] = await pool.execute(
      `INSERT INTO pupils (
        learner_id, school_id, first_name, last_name, gender,
        grade, class, parent_name, parent_phone, email,
        photo_url, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        first_name = VALUES(first_name),
        last_name = VALUES(last_name),
        grade = VALUES(grade),
        class = VALUES(class),
        parent_name = VALUES(parent_name),
        parent_phone = VALUES(parent_phone),
        updated_at = NOW()`,
      [
        req.body.learner_id,
        req.body.school_id,
        req.body.first_name,
        req.body.last_name,
        req.body.gender,
        req.body.grade,
        req.body.class,
        req.body.parent_name,
        req.body.parent_phone,
        req.body.email,
        req.body.photo_url,
        req.body.status || 'Active'
      ]
    );

    console.log(`✅ Pupil ${req.body.learner_id} saved to MySQL`);
    res.json({ success: true, id: req.body.learner_id });
  } catch (error) {
    console.error('❌ Error saving pupil:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============= STAFF ENDPOINTS =============
app.post('/api/staff', async (req, res) => {
  try {
    console.log('📥 Saving staff to MySQL:', req.body.staff_id);
    
    const [result] = await pool.execute(
      `INSERT INTO staff (
        staff_id, school_id, first_name, last_name, email,
        phone, staff_type, qualification, employment_type,
        photo_url, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        first_name = VALUES(first_name),
        last_name = VALUES(last_name),
        email = VALUES(email),
        phone = VALUES(phone),
        staff_type = VALUES(staff_type),
        qualification = VALUES(qualification),
        updated_at = NOW()`,
      [
        req.body.staff_id,
        req.body.school_id,
        req.body.first_name,
        req.body.last_name,
        req.body.email,
        req.body.phone,
        req.body.staff_type,
        req.body.qualification,
        req.body.employment_type,
        req.body.photo_url,
        req.body.status || 'Active'
      ]
    );

    console.log(`✅ Staff ${req.body.staff_id} saved to MySQL`);
    res.json({ success: true, id: req.body.staff_id });
  } catch (error) {
    console.error('❌ Error saving staff:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============= ATTENDANCE ENDPOINTS =============
app.post('/api/attendance', async (req, res) => {
  try {
    console.log('📥 Saving attendance to MySQL:', req.body.learner_id, req.body.date);
    
    // Check if attendance already exists for this learner/date
    const [existing] = await pool.execute(
      'SELECT id FROM attendance WHERE learner_id = ? AND date = ?',
      [req.body.learner_id, req.body.date]
    );

    if (existing.length > 0) {
      // Update existing
      await pool.execute(
        `UPDATE attendance SET 
          status = ?, remarks = ?, absence_reason = ?
         WHERE learner_id = ? AND date = ?`,
        [
          req.body.status,
          req.body.remarks || '',
          req.body.absence_reason || null,
          req.body.learner_id,
          req.body.date
        ]
      );
    } else {
      // Insert new
      await pool.execute(
        `INSERT INTO attendance (
          learner_id, school_id, student_name, grade, class_id,
          date, status, remarks, absence_reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          req.body.learner_id,
          req.body.school_id,
          req.body.student_name,
          req.body.grade,
          req.body.class_id,
          req.body.date,
          req.body.status,
          req.body.remarks || '',
          req.body.absence_reason || null
        ]
      );
    }

    console.log(`✅ Attendance for ${req.body.learner_id} on ${req.body.date} saved`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error saving attendance:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============= MARKS ENDPOINTS =============
app.post('/api/marks', async (req, res) => {
  try {
    console.log('📥 Saving mark to MySQL:', req.body.learner_id, req.body.subject_name);
    
    const [result] = await pool.execute(
      `INSERT INTO marks (
        learner_id, school_id, subject_id, subject_name,
        category, score, max_score, awarded_date, awarded_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        req.body.learner_id,
        req.body.school_id,
        req.body.subject_id || 0,
        req.body.subject_name,
        req.body.category || 'Assessment',
        req.body.score,
        req.body.max_score || 100,
        req.body.awarded_date || new Date().toISOString().split('T')[0],
        req.body.awarded_by || 'system'
      ]
    );

    console.log(`✅ Mark for ${req.body.learner_id} saved`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error saving mark:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============= BATCH SYNC ENDPOINT =============
app.post('/api/sync', async (req, res) => {
  try {
    console.log('📥 Batch sync received for school:', req.body.schoolId);
    
    const { schoolId, data } = req.body;
    
    if (!schoolId) {
      return res.status(400).json({ error: 'schoolId is required' });
    }
    
    let syncResults = {
      schools: 0,
      pupils: 0,
      staff: 0,
      attendance: 0,
      marks: 0
    };
    
    // Process each data type if provided
    if (data) {
      // Save schools
      if (data.schools && Array.isArray(data.schools)) {
        for (const school of data.schools) {
          await pool.execute(
            `INSERT INTO schools (school_id, school_name, province, district, contact_email, phone, address, status, subscription_type, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
             ON DUPLICATE KEY UPDATE
               school_name = VALUES(school_name),
               province = VALUES(province),
               district = VALUES(district),
               updated_at = NOW()`,
            [school.school_id, school.school_name, school.province, school.district, 
             school.contact_email, school.phone, school.address, school.status, school.subscription_type]
          );
          syncResults.schools++;
        }
      }
      
      // Save pupils
      if (data.pupils && Array.isArray(data.pupils)) {
        for (const pupil of data.pupils) {
          await pool.execute(
            `INSERT INTO pupils (learner_id, school_id, first_name, last_name, gender, grade, class, parent_name, parent_phone, email, photo_url, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
             ON DUPLICATE KEY UPDATE
               first_name = VALUES(first_name),
               last_name = VALUES(last_name),
               grade = VALUES(grade),
               updated_at = NOW()`,
            [pupil.learner_id, pupil.school_id, pupil.first_name, pupil.last_name, pupil.gender,
             pupil.grade, pupil.class, pupil.parent_name, pupil.parent_phone, pupil.email,
             pupil.photo_url, pupil.status]
          );
          syncResults.pupils++;
        }
      }
      
      // Save marks
      if (data.marks && Array.isArray(data.marks)) {
        for (const mark of data.marks) {
          await pool.execute(
            `INSERT INTO marks (learner_id, school_id, subject_name, score, max_score, awarded_date, awarded_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
            [mark.learner_id, mark.school_id, mark.subject_name, mark.score, 
             mark.max_score || 100, mark.awarded_date, mark.awarded_by]
          );
          syncResults.marks++;
        }
      }
    }
    
    console.log('✅ Batch sync results:', syncResults);
    res.json({ success: true, synced: true, results: syncResults });
  } catch (error) {
    console.error('❌ Error in batch sync:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============= VIEW DATA ENDPOINTS (for checking) =============
app.get('/api/schools', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM schools');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/pupils', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM pupils');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/staff', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM staff');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/attendance', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM attendance');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/marks', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM marks');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= CLEAR DATA ENDPOINTS (for testing) =============
app.delete('/api/clear/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const allowedTables = ['schools', 'pupils', 'staff', 'attendance', 'marks'];
    
    if (!allowedTables.includes(table)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }
    
    await pool.execute(`DELETE FROM ${table}`);
    console.log(`🧹 Cleared table: ${table}`);
    res.json({ success: true, message: `Table ${table} cleared` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= ERROR HANDLER =============
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ 
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// ============= START SERVER =============
const PORT = 3000;
app.listen(PORT, async () => {
  console.log('\n=================================');
  console.log('🚀 ACADEMIA PULSE SYNC SERVER');
  console.log('=================================');
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
  
  await testDbConnection();
  
  console.log('=================================\n');
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down server...');
  await pool.end();
  process.exit(0);
});