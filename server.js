require('dotenv').config();

const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const app = express();
const upload = multer({ dest: 'uploads/' });

cloudinary.config({
    cloud_name: process.env.CDN_NAME,
    api_key: process.env.CDN_KEY,
    api_secret: process.env.CDN_SECRET
});

// MODIFICADO: CORS configurado para aceptar tu nueva URL de Vercel
app.use(cors({
    origin: 'https://migo-vue.vercel.app',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// --- CONFIGURACIÓN DE BASE DE DATOS CON RECONEXIÓN ---
let db;

function handleDisconnect() {
    db = mysql.createConnection({
        host: process.env.MYSQLHOST,
        user: process.env.MYSQLUSER,
        password: process.env.MYSQLPASSWORD,
        database: process.env.MYSQL_DATABASE,
        port: parseInt(process.env.MYSQLPORT) || 3306
    });

    db.connect((err) => {
        if (err) {
            console.error('Error al conectar a la BD:', err.message);
            setTimeout(handleDisconnect, 2000);
        } else {
            console.log('Conectado exitosamente a la base de datos 🚀');
        }
    });

    db.on('error', (err) => {
        console.error('Error en la base de datos:', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            console.log('Conexión perdida. Intentando reconectar...');
            handleDisconnect();
        } else {
            throw err;
        }
    });
}

handleDisconnect();
// -----------------------------------------------------

// COLONIAS
app.get('/api/colonias', (req, res) => {
    db.query("SELECT id_colonia, nombre FROM colonias ORDER BY nombre ASC", (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// USUARIOS
app.post('/api/usuarios', (req, res) => {
    const { nombre, apellido, correo, contrasena, telefono, direccion, id_colonia, rol } = req.body;
    db.query("SELECT id_usuario FROM usuarios WHERE correo = ?", [correo], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows.length > 0) return res.status(400).json({ error: "El correo ya está registrado" });
        db.query("INSERT INTO usuarios (nombre, apellido, correo, contrasena, telefono, direccion, id_colonia, rol) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [nombre, apellido, correo, contrasena, telefono, direccion, id_colonia, rol], (err, result) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Usuario registrado', id: result.insertId });
            });
    });
});

app.get('/api/usuarios/:id', (req, res) => {
    db.query("SELECT u.*, c.nombre AS colonia FROM usuarios u LEFT JOIN colonias c ON u.id_colonia = c.id_colonia WHERE u.id_usuario = ?",
        [req.params.id], (err, results) => {
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
    const sql = `SELECT p.*, u.nombre AS usuario, c.nombre AS nombre_colonia, e.nombre AS especie, 
                 t.nombre AS tipo, est.nombre AS estado, f.ruta_imagen
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

// FOTOS PUBLICACIONES con Cloudinary
app.post('/api/fotos', upload.single('imagen'), async (req, res) => {
    try {
        const result = await cloudinary.uploader.upload(req.file.path, { folder: 'migo/publicaciones' });
        const { id_publi } = req.body;
        db.query("INSERT INTO fotos_publi (id_publi, ruta_imagen) VALUES (?, ?)",
            [id_publi, result.secure_url], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ url: result.secure_url });
            });
    } catch (err) {
        res.status(500).json({ error: 'Error al subir foto' });
    }
});

app.post('/api/publicaciones-con-foto', upload.single('imagen'), async (req, res) => {
    const { id_usuario, id_colonia, id_especie, id_tipo, id_estado, nombre_pet, descripcion } = req.body;
    try {
        const sql = "INSERT INTO publicaciones (id_usuario, id_colonia, id_especie, id_tipo, id_estado, nombre_pet, descripcion) VALUES (?, ?, ?, ?, ?, ?, ?)";
        const [result] = await db.promise().query(sql, [id_usuario, id_colonia, id_especie, id_tipo, id_estado, nombre_pet, descripcion]);
        const id_publi = result.insertId;
        if (req.file) {
            const resultCloud = await cloudinary.uploader.upload(req.file.path, { folder: 'migo/publicaciones' });
            await db.promise().query("INSERT INTO fotos_publi (id_publi, ruta_imagen) VALUES (?, ?)", [id_publi, resultCloud.secure_url]);
        }
        res.json({ message: 'Publicación exitosa', id_publi });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// VETERINARIAS
app.get('/api/veterinarias', (req, res) => {
    db.query(`SELECT v.*, c.nombre AS nombre_colonia FROM veterinarias v LEFT JOIN colonias c ON v.id_colonia = c.id_colonia ORDER BY v.nombre_establecimiento ASC`,
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(results);
        });
});

app.get('/api/veterinaria/:id_vet', (req, res) => {
    db.query(`SELECT v.*, c.nombre AS nombre_colonia FROM veterinarias v LEFT JOIN colonias c ON v.id_colonia = c.id_colonia WHERE v.id_vet = ?`,
        [req.params.id_vet], (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            if (results.length === 0) return res.status(404).json({ message: "No encontrada" });
            res.json(results[0]);
        });
});

app.post('/api/registro-vet', (req, res) => {
    const { nombre, apellido, correo, contrasena, telefono, direccion, id_colonia, nombre_establecimiento, descripcion, sitio_web, correo_negocio, telefono_local } = req.body;
    db.query("SELECT id_usuario FROM usuarios WHERE correo = ?", [correo], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows.length > 0) return res.status(400).json({ error: "El correo ya está registrado" });
        db.query("INSERT INTO usuarios (nombre, apellido, correo, contrasena, telefono, direccion, id_colonia, rol) VALUES (?, ?, ?, ?, ?, ?, ?, 'veterinario')",
            [nombre, apellido, correo, contrasena, telefono, direccion, id_colonia], (err, resultUsuario) => {
                if (err) return res.status(500).json({ error: err.message });
                db.query("INSERT INTO veterinarias (id_usuario, nombre_establecimiento, descripcion, sitio_web, id_colonia, correo_negocio, telefono_local) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    [resultUsuario.insertId, nombre_establecimiento, descripcion, sitio_web, id_colonia, correo_negocio, telefono_local], (err, resultVet) => {
                        if (err) return res.status(500).json({ error: err.message });
                        res.json({ message: 'Veterinaria registrada', id_usuario: resultUsuario.insertId, id_vet: resultVet.insertId });
                    });
            });
    });
});

app.put('/api/veterinarias/:id_vet', (req, res) => {
    const { nombre_establecimiento, descripcion, id_colonia, correo_negocio, telefono_local, sitio_web } = req.body;
    db.query("UPDATE veterinarias SET nombre_establecimiento=?, descripcion=?, id_colonia=?, correo_negocio=?, telefono_local=?, sitio_web=? WHERE id_vet=?",
        [nombre_establecimiento, descripcion, id_colonia, correo_negocio, telefono_local, sitio_web, req.params.id_vet], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Veterinaria actualizada' });
        });
});

app.post('/api/veterinarias/:id_vet/logo', upload.single('logo'), async (req, res) => {
    try {
        const result = await cloudinary.uploader.upload(req.file.path, { folder: 'migo/logos' });
        db.query("UPDATE veterinarias SET imagen_logo = ? WHERE id_vet = ?",
            [result.secure_url, req.params.id_vet], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ imagen_logo: result.secure_url });
            });
    } catch (err) {
        res.status(500).json({ error: 'Error al subir logo' });
    }
});

app.post('/api/login-vet', (req, res) => {
    const { correo, contrasena } = req.body;
    db.query("SELECT u.id_usuario, u.nombre, u.rol, v.id_vet FROM usuarios u LEFT JOIN veterinarias v ON u.id_usuario = v.id_usuario WHERE u.correo = ? AND u.contrasena = ?",
        [correo, contrasena], (err, results) => {
            if (err || results.length === 0 || results[0].rol !== 'veterinario') return res.status(401).json({ message: 'Acceso denegado' });
            res.json({ success: true, usuario: results[0] });
        });
});

// COMENTARIOS Y RESEÑAS
app.get('/api/comentarios/:id_publi', (req, res) => {
    db.query("SELECT c.*, CONCAT(u.nombre, ' ', u.apellido) AS nombre_completo FROM comentarios c JOIN usuarios u ON c.id_usuario = u.id_usuario WHERE c.id_publi = ? ORDER BY c.fecha ASC",
        [req.params.id_publi], (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(results);
        });
});

app.post('/api/comentarios', (req, res) => {
    const { id_publi, id_usuario, comentario } = req.body;
    db.query("INSERT INTO comentarios (id_publi, id_usuario, comentario) VALUES (?, ?, ?)",
        [id_publi, id_usuario, comentario], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Comentario publicado', id_comentario: result.insertId });
        });
});

app.get('/api/resenas/:id_vet', (req, res) => {
    db.query(`SELECT r.*, CONCAT(u.nombre, ' ', u.apellido) AS nombre_usuario FROM resenas r JOIN usuarios u ON r.id_usuario = u.id_usuario WHERE r.id_vet = ? ORDER BY r.fecha_resena DESC`,
        [req.params.id_vet], (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(results);
        });
});

app.post('/api/resenas', (req, res) => {
    const { id_usuario, id_vet, calificacion, comentario } = req.body;
    db.query("INSERT INTO resenas (id_usuario, id_vet, calificacion, comentario) VALUES (?, ?, ?, ?)",
        [id_usuario, id_vet, calificacion, comentario], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Reseña publicada', id_resena: result.insertId });
        });
});

// CATÁLOGOS
app.get('/api/especies', (req, res) => {
    db.query("SELECT id_especie, nombre FROM especies ORDER BY nombre ASC", (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.get('/api/tipos_publi', (req, res) => {
    db.query("SELECT id_tipo, nombre FROM tipos_publi ORDER BY nombre ASC", (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor corriendo en puerto ${PORT} 🏃‍♂️`));