const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');


const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Conexión a la BD
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'migo_db'
});

// ENDPOINTS

// Crear usuario
app.post('/api/usuarios', (req, res) => {
    const { nombre, apellido, correo, contrasena, telefono, direccion, id_colonia, rol } = req.body;
    const sql = `
        INSERT INTO usuarios (nombre, apellido, correo, contrasena, telefono, direccion, id_colonia, rol)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.query(sql, [nombre, apellido, correo, contrasena, telefono, direccion, id_colonia, rol], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Usuario registrado correctamente', id: result.insertId });
    });
});


// Login de usuario
app.post('/api/login', (req, res) => {
    const { correo, contrasena } = req.body;
    const sql = `
        SELECT id_usuario, nombre, rol 
        FROM usuarios 
        WHERE correo = ? AND contrasena = ?
    `;
    db.query(sql, [correo, contrasena], (err, results) => {
        if (err) return res.status(500).json({ message: 'Error de servidor' });
        if (results.length > 0) res.json(results[0]);
        else res.status(401).json({ message: 'Credenciales incorrectas' });
    });
});

// Colonias
app.get('/api/colonias', (req, res) => {
    db.query('SELECT * FROM colonias', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Especies
app.get('/api/especies', (req, res) => {
    db.query('SELECT * FROM especies', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Tipos de publicación
app.get('/api/tipos_publi', (req, res) => {
    db.query('SELECT * FROM tipos_publi', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Estados de publicación
app.get('/api/estados_publi', (req, res) => {
    db.query('SELECT * FROM estados_publi', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Publicaciones (listar todas con datos relacionados)
app.get('/api/publicaciones', (req, res) => {
    const sql = `
        SELECT p.id_publi, p.nombre_pet, p.descripcion, p.fecha_publi,
               u.nombre AS usuario, c.nombre_colonia, e.nombre AS especie,
               t.nombre AS tipo, est.nombre AS estado,
               f.ruta_imagen
        FROM publicaciones p
        JOIN usuarios u ON p.id_usuario = u.id_usuario
        JOIN colonias c ON p.id_colonia = c.id_colonia
        JOIN especies e ON p.id_especie = e.id_especie
        JOIN tipos_publi t ON p.id_tipo = t.id_tipo
        JOIN estados_publi est ON p.id_estado = est.id_estado
        LEFT JOIN fotos_publi f ON p.id_publi = f.id_publi
        ORDER BY p.fecha_publi DESC
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ message: 'Error en BD: ' + err.sqlMessage });
        res.json(results);
    });
});

// Crear nueva publicación
app.post('/api/publicaciones', (req, res) => {
    const { id_usuario, id_colonia, id_especie, id_tipo, id_estado, nombre_pet, descripcion } = req.body;
    const sql = `
        INSERT INTO publicaciones (id_usuario, id_colonia, id_especie, id_tipo, id_estado, nombre_pet, descripcion)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    db.query(sql, [id_usuario, id_colonia, id_especie, id_tipo, id_estado, nombre_pet, descripcion], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Publicación creada', id: result.insertId });
    });
});

// Subir foto asociada a publicación
app.post('/api/fotos/:id_publi', upload.single('foto'), (req, res) => {
    const id_publi = req.params.id_publi;
    const ruta = `/uploads/${req.file.filename}`;
    const sql = 'INSERT INTO fotos_publi (id_publi, ruta_imagen) VALUES (?, ?)';
    db.query(sql, [id_publi, ruta], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Foto subida', ruta_imagen: ruta });
    });
});

// =======================
// INICIO DEL SERVIDOR
// =======================
app.listen(4000, () => console.log('Servidor corriendo en http://localhost:4000'));
