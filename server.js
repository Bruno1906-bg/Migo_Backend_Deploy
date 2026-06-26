// 1. Configuración inicial
require('dotenv').config();

const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors({
    origin: 'https://comforting-capybara-8c1237.netlify.app',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// 2. Conexión a la BD
const db = mysql.createConnection({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: parseInt(process.env.MYSQLPORT) || 3306
});

console.log("Intentando conectar a:", process.env.MYSQLHOST);
console.log("Usuario:", process.env.MYSQLUSER);

db.connect((err) => {
    if (err) {
        console.error('Error al conectar a la base de datos:', err.message);
        return;
    }
    console.log('Conectado exitosamente a la base de datos 🚀');
});

db.on('error', (err) => {
    console.error('Error en la base de datos:', err);
    if(err.code === 'PROTOCOL_CONNECTION_LOST') console.log('Reconectando...');
});

// 3. ENDPOINTS

// USUARIOS
app.post('/api/usuarios', (req, res) => {
    const { nombre, apellido, correo, contrasena, telefono, direccion, id_colonia, rol } = req.body;
    db.query("SELECT id_usuario FROM usuarios WHERE correo = ?", [correo], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows.length > 0) return res.status(400).json({ error: "El correo ya está registrado" });
        const sql = "INSERT INTO usuarios (nombre, apellido, correo, contrasena, telefono, direccion, id_colonia, rol) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        db.query(sql, [nombre, apellido, correo, contrasena, telefono, direccion, id_colonia, rol], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Usuario registrado', id: result.insertId });
        });
    });
});

// COLONIAS
app.get('/api/colonias', (req, res) => {
    db.query("SELECT id_colonia, nombre FROM colonias ORDER BY nombre ASC", (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.get('/api/usuarios/:id', (req, res) => {
    const sql = "SELECT u.*, c.nombre AS colonia FROM usuarios u LEFT JOIN colonias c ON u.id_colonia = c.id_colonia WHERE u.id_usuario = ?";
    db.query(sql, [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ message: "No encontrado" });
        res.json(results[0]);
    });
});

app.post('/api/login', (req, res) => {
    const { correo, contrasena } = req.body;
    db.query("SELECT id_usuario, nombre, rol FROM usuarios WHERE correo = ? AND contrasena = ?", [correo, contrasena], (err, results) => {
        if (err) return res.status(500).json({ message: 'Error de servidor' });
        if (results.length > 0 && results[0].rol === 'usuario') res.json(results[0]);
        else res.status(401).json({ message: 'Credenciales incorrectas o sin acceso' });
    });
});

// PUBLICACIONES
app.get('/api/publicaciones', (req, res) => {
    const sql = `SELECT p.*, u.nombre AS usuario, c.nombre AS nombre_colonia, e.nombre AS especie, t.nombre AS tipo, est.nombre AS estado, f.ruta_imagen
                 FROM publicaciones p
                 JOIN usuarios u ON p.id_usuario = u.id_usuario
                 JOIN colonias c ON p.id_colonia = c.id_colonia
                 JOIN especies e ON p.id_especie = e.id_especie
                 JOIN tipos_publi t ON p.id_tipo = t.id_tipo
                 JOIN estados_publi est ON p.id_estado = est.id_estado
                 LEFT JOIN fotos_publi f ON p.id_publi = f.id_publi
                 ORDER BY p.fecha_publi DESC`;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/publicaciones', (req, res) => {
    const { id_usuario, id_colonia, id_especie, id_tipo, id_estado, nombre_pet, descripcion } = req.body;
    db.query("INSERT INTO publicaciones (id_usuario, id_colonia, id_especie, id_tipo, id_estado, nombre_pet, descripcion) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [id_usuario, id_colonia, id_especie, id_tipo, id_estado, nombre_pet, descripcion], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Publicación creada', id_publi: result.insertId });
        });
});

// VETERINARIOS
app.post('/api/login-vet', (req, res) => {
    const { correo, contrasena } = req.body;
    db.query("SELECT u.id_usuario, u.nombre, u.rol, v.id_vet FROM usuarios u LEFT JOIN veterinarias v ON u.id_usuario = v.id_usuario WHERE u.correo = ? AND u.contrasena = ?", [correo, contrasena], (err, results) => {
        if (err || results.length === 0 || results[0].rol !== 'veterinario') return res.status(401).json({ message: 'Acceso denegado' });
        res.json({ success: true, usuario: results[0] });
    });
});

// REGISTRO VETERINARIA
app.post('/api/registro-vet', (req, res) => {
    const { nombre, apellido, correo, contrasena, telefono, direccion, id_colonia, nombre_establecimiento, descripcion, sitio_web, correo_negocio, telefono_local } = req.body;

    // Primero verificar si el correo ya existe
    db.query("SELECT id_usuario FROM usuarios WHERE correo = ?", [correo], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows.length > 0) return res.status(400).json({ error: "El correo ya está registrado" });

        // Insertar usuario con rol veterinario
        const sqlUsuario = "INSERT INTO usuarios (nombre, apellido, correo, contrasena, telefono, direccion, id_colonia, rol) VALUES (?, ?, ?, ?, ?, ?, ?, 'veterinario')";
        db.query(sqlUsuario, [nombre, apellido, correo, contrasena, telefono, direccion, id_colonia], (err, resultUsuario) => {
            if (err) return res.status(500).json({ error: err.message });

            const id_usuario = resultUsuario.insertId;

            // Insertar veterinaria vinculada al usuario
            const sqlVet = "INSERT INTO veterinarias (id_usuario, nombre_establecimiento, descripcion, sitio_web, id_colonia, correo_negocio, telefono_local) VALUES (?, ?, ?, ?, ?, ?, ?)";
            db.query(sqlVet, [id_usuario, nombre_establecimiento, descripcion, sitio_web, id_colonia, correo_negocio, telefono_local], (err, resultVet) => {
                if (err) return res.status(500).json({ error: err.message });

                res.json({ 
                    message: 'Veterinaria registrada exitosamente', 
                    id_usuario,
                    id_vet: resultVet.insertId 
                });
            });
        });
    });
});

// COMENTARIOS Y RESEÑAS (Simplificado para brevedad)
app.get('/api/comentarios/:id_publi', (req, res) => {
    db.query("SELECT c.*, CONCAT(u.nombre, ' ', u.apellido) AS nombre_completo FROM comentarios c JOIN usuarios u ON c.id_usuario = u.id_usuario WHERE c.id_publi = ? ORDER BY c.fecha ASC", [req.params.id_publi], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// POST: Crear comentario
app.post('/api/comentarios', (req, res) => {
    const { id_publi, id_usuario, comentario } = req.body;
    const sql = "INSERT INTO comentarios (id_publi, id_usuario, comentario) VALUES (?, ?, ?)";
    db.query(sql, [id_publi, id_usuario, comentario], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Comentario publicado', id_comentario: result.insertId });
    });
});

// PUT: Editar comentario
app.put('/api/comentarios/:id', (req, res) => {
    const { comentario, id_usuario } = req.body;
    const sql = "UPDATE comentarios SET comentario = ? WHERE id_comentario = ? AND id_usuario = ?";
    db.query(sql, [comentario, req.params.id, id_usuario], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(403).json({ error: "No autorizado o no existe" });
        res.json({ message: 'Comentario actualizado' });
    });
});

// DELETE: Eliminar comentario
app.delete('/api/comentarios/:id/:id_usuario', (req, res) => {
    const sql = "DELETE FROM comentarios WHERE id_comentario = ? AND id_usuario = ?";
    db.query(sql, [req.params.id, req.params.id_usuario], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Comentario eliminado' });
    });
});

// ESPECIES
app.get('/api/especies', (req, res) => {
    db.query("SELECT id_especie, nombre FROM especies ORDER BY nombre ASC", (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// TIPOS DE PUBLICACIÓN
app.get('/api/tipos_publi', (req, res) => {
    db.query("SELECT id_tipo, nombre FROM tipos_publi ORDER BY nombre ASC", (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// ESTADOS DE PUBLICACIÓN
app.get('/api/estados_publi', (req, res) => {
    db.query("SELECT id_estado, nombre FROM estados_publi", (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// SERVICIOS
app.get('/api/servicios', (req, res) => {
    db.query("SELECT id_servicio, nombre FROM servicios", (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// DÍAS DE LA SEMANA
app.get('/api/dias_semana', (req, res) => {
    db.query("SELECT id_dia, nombre FROM dias_semana", (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// 4. Inicio del servidor
const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor corriendo en puerto ${PORT} 🏃‍♂️`));