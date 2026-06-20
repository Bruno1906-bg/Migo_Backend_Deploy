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
    database: 'migo_db_VUE' // Nombre corregido según tu script
});

// ENDPOINTS

// Crear usuario
app.post('/api/usuarios', (req, res) => {
    const { nombre, apellido, correo, contrasena, telefono, direccion, id_colonia, rol } = req.body;

    // Validar si el correo ya existe
    const checkSql = "SELECT id_usuario FROM usuarios WHERE correo = ?";
    db.query(checkSql, [correo], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows.length > 0) {
            return res.status(400).json({ error: "El correo ya está registrado" });
        }

        // Insertar nuevo usuario
        const sql = `
            INSERT INTO usuarios (nombre, apellido, correo, contrasena, telefono, direccion, id_colonia, rol)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        db.query(sql, [nombre, apellido, correo, contrasena, telefono, direccion, id_colonia, rol], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Usuario registrado correctamente', id: result.insertId });
        });
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

        if (results.length > 0) {
            const usuario = results[0];
            if (usuario.rol !== 'usuario') {
                return res.status(403).json({ message: 'No tienes acceso como usuario' });
            }
            res.json(usuario);
        } else {
            res.status(401).json({ message: 'Credenciales incorrectas' });
        }
    });
});





// Colonias
app.get('/api/colonias', (req, res) => {
    // Corregido: la columna en tu BD es 'nombre'
    db.query('SELECT id_colonia, nombre FROM colonias', (err, results) => {
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

// Publicaciones (Listar con los JOINs correctos según tu nueva BD)
app.get('/api/publicaciones', (req, res) => {
    const sql = `
        SELECT p.id_publi, p.nombre_pet, p.descripcion, p.fecha_publi,
               u.nombre AS usuario, 
               c.nombre AS nombre_colonia, 
               e.nombre AS especie,
               t.nombre AS tipo, 
               est.nombre AS estado,
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
        res.json({ message: 'Publicación creada', id_publi: result.insertId });
    });
});

//Obtencion de tipos de publicacion
app.get('/api/tipos_publi', (req, res) => {
    db.query('SELECT id_tipo, nombre FROM tipos_publi', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Subir foto
app.post('/api/fotos/:id_publi', upload.single('foto'), (req, res) => {
    const id_publi = req.params.id_publi;
    if (!req.file) return res.status(400).json({ message: 'No se subió archivo' });

    const ruta = `/uploads/${req.file.filename}`;
    const sql = 'INSERT INTO fotos_publi (id_publi, ruta_imagen) VALUES (?, ?)';
    db.query(sql, [id_publi, ruta], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Foto subida', ruta_imagen: ruta });
    });
});


// Login de veterinario
app.post('/api/login-vet', (req, res) => {
    const { correo, contrasena } = req.body;

    const sql = `
        SELECT u.id_usuario, u.nombre, u.rol, v.id_vet 
        FROM usuarios u
        LEFT JOIN veterinarias v ON u.id_usuario = v.id_usuario
        WHERE u.correo = ? AND u.contrasena = ?
    `;
    db.query(sql, [correo, contrasena], (err, results) => {
        if (err) return res.status(500).json({ message: 'Error de servidor' });

        if (results.length > 0) {
            const usuario = results[0];
            if (usuario.rol !== 'veterinario') {
                return res.status(403).json({ message: 'No tienes acceso como veterinario' });
            }
            res.json({ success: true, usuario });
        } else {
            res.status(401).json({ message: 'Credenciales inválidas' });
        }
    });
});


// Registro de veterinario
app.post('/api/registro-vet', (req, res) => {
    const { nombre, apellido, correo, contrasena, id_colonia, nombre_establecimiento } = req.body;

    // Validar si el correo ya existe
    const checkSql = "SELECT id_usuario FROM usuarios WHERE correo = ?";
    db.query(checkSql, [correo], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows.length > 0) {
            return res.status(400).json({ error: "El correo ya está registrado" });
        }

        // 1. Iniciar transacción para asegurar que todo se guarde o nada se guarde
        db.beginTransaction((err) => {
            if (err) return res.status(500).json({ error: "Error de conexión" });

            // 2. Insertar en tabla usuarios
            const sqlUser = "INSERT INTO usuarios (nombre, apellido, correo, contrasena, id_colonia, rol) VALUES (?, ?, ?, ?, ?, 'veterinario')";
            db.query(sqlUser, [nombre, apellido, correo, contrasena, id_colonia], (err, result) => {
                if (err) return db.rollback(() => res.status(500).json({ error: err.message }));

                const id_usuario = result.insertId;

                // 3. Insertar en tabla veterinarias
                const sqlVet = "INSERT INTO veterinarias (id_usuario, nombre_establecimiento) VALUES (?, ?)";
                db.query(sqlVet, [id_usuario, nombre_establecimiento], (err) => {
                    if (err) return db.rollback(() => res.status(500).json({ error: err.message }));

                    db.commit((err) => {
                        if (err) return db.rollback(() => res.status(500).json({ error: "Error al guardar" }));
                        res.json({ message: 'Registro exitoso' });
                    });
                });
            });
        });
    });
});


app.listen(4000, () => console.log('Servidor corriendo en puerto 4000 🏃‍♂️'));