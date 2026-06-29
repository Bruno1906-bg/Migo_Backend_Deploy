require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const app = express();
const upload = multer({ dest: 'uploads/' });

// CORS para producción
app.use(cors({
    origin: 'https://migo-vue.vercel.app',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Cloudinary
cloudinary.config({
    cloud_name: process.env.CDN_NAME,
    api_key: process.env.CDN_KEY,
    api_secret: process.env.CDN_SECRET
});

// BD
const db = mysql.createConnection({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: parseInt(process.env.MYSQLPORT) || 3306
});

db.connect((err) => {
    if (err) console.error('Error al conectar a la BD:', err.message);
    else console.log('Conectado exitosamente a la base de datos 🚀');
});

// Logs
function registrarLogLoginFallido(correo, detalle) {
    db.query("INSERT INTO logs (correo, accion, detalle) VALUES (?, 'LOGIN_FALLIDO', ?)", [correo, detalle], (err) => {
        if (err) console.error("Error guardando log:", err.message);
    });
}


// ═══════════════════════════════════════
//  USUARIOS
// ═══════════════════════════════════════

app.post('/api/usuarios', (req, res) => {
    const { nombre, apellido, correo, contrasena, telefono, direccion, id_colonia, rol } = req.body;
    db.query("SELECT id_usuario FROM usuarios WHERE correo = ?", [correo], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows.length > 0) return res.status(400).json({ error: "El correo ya está registrado" });
        db.query(
            "INSERT INTO usuarios (nombre, apellido, correo, contrasena, telefono, direccion, id_colonia, rol) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [nombre, apellido, correo, contrasena, telefono, direccion, id_colonia, rol],
            (err, result) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Usuario registrado correctamente', id: result.insertId });
            }
        );
    });
});

app.get('/api/usuarios/:id', (req, res) => {
    const sql = `
        SELECT u.id_usuario, u.nombre, u.apellido, u.correo, u.telefono, u.direccion,
               u.id_colonia, c.nombre AS colonia, u.fecha_registro
        FROM usuarios u
        LEFT JOIN colonias c ON u.id_colonia = c.id_colonia
        WHERE u.id_usuario = ?
    `;
    db.query(sql, [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ message: "Usuario no encontrado" });
        res.json(results[0]);
    });
});

app.post('/api/login', (req, res) => {
    const { correo, contrasena } = req.body;
    db.query("SELECT id_usuario, nombre, rol FROM usuarios WHERE correo = ? AND contrasena = ?", [correo, contrasena], (err, results) => {
        if (err) return res.status(500).json({ message: 'Error de servidor' });
        if (results.length > 0) {
            if (results[0].rol !== 'usuario') {
                registrarLogLoginFallido(correo, "Intento de login sin rol válido");
                return res.status(403).json({ message: 'No tienes acceso como usuario' });
            }
            res.json(results[0]);
        } else {
            registrarLogLoginFallido(correo, "Credenciales incorrectas");
            res.status(401).json({ message: 'Credenciales incorrectas' });
        }
    });
});

app.put('/api/usuarios/:id_usuario', (req, res) => {
    const { nombre, apellido, correo, telefono, direccion, id_colonia } = req.body;
    db.query(
        "UPDATE usuarios SET nombre=?, apellido=?, correo=?, telefono=?, direccion=?, id_colonia=? WHERE id_usuario=?",
        [nombre, apellido, correo, telefono, direccion, id_colonia, req.params.id_usuario],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Perfil actualizado correctamente" });
        }
    );
});


// ═══════════════════════════════════════
//  CATÁLOGOS
// ═══════════════════════════════════════

app.get('/api/colonias', (req, res) => {
    db.query('SELECT id_colonia, nombre FROM colonias', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.get('/api/especies', (req, res) => {
    db.query('SELECT * FROM especies', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.get('/api/tipos_publi', (req, res) => {
    db.query('SELECT id_tipo, nombre FROM tipos_publi', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.get('/api/dias-semana', (req, res) => {
    db.query("SELECT id_dia, nombre FROM dias_semana ORDER BY id_dia ASC", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});


// ═══════════════════════════════════════
//  PUBLICACIONES
// ═══════════════════════════════════════

app.get('/api/publicaciones', (req, res) => {
    const sql = `
        SELECT p.id_publi, p.nombre_pet, p.descripcion, p.fecha_publi,
               p.id_colonia  AS id_colonia_raw,
               p.id_especie  AS id_especie_raw,
               p.id_tipo     AS id_tipo_raw,
               u.id_usuario, u.nombre AS usuario, u.correo, u.telefono,
               c.nombre AS nombre_colonia,
               e.nombre AS especie,
               t.nombre AS tipo,
               est.nombre AS estado,
               f.ruta_imagen
        FROM publicaciones p
        JOIN usuarios u        ON p.id_usuario = u.id_usuario
        JOIN colonias c        ON p.id_colonia = c.id_colonia
        JOIN especies e        ON p.id_especie = e.id_especie
        JOIN tipos_publi t     ON p.id_tipo    = t.id_tipo
        JOIN estados_publi est ON p.id_estado  = est.id_estado
        LEFT JOIN fotos_publi f ON p.id_publi  = f.id_publi
        ORDER BY p.fecha_publi DESC
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/publicaciones', (req, res) => {
    const { id_usuario, id_colonia, id_especie, id_tipo, id_estado, nombre_pet, descripcion } = req.body;
    db.query(
        "INSERT INTO publicaciones (id_usuario, id_colonia, id_especie, id_tipo, id_estado, nombre_pet, descripcion) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [id_usuario, id_colonia, id_especie, id_tipo, id_estado, nombre_pet, descripcion],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Publicación creada', id_publi: result.insertId });
        }
    );
});

app.put('/api/publicaciones/:id_publi', (req, res) => {
    const { id_usuario, id_colonia, id_especie, id_tipo, nombre_pet, descripcion } = req.body;
    db.query("SELECT id_usuario FROM publicaciones WHERE id_publi = ?", [req.params.id_publi], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows.length === 0) return res.status(404).json({ message: "Publicación no encontrada" });
        if (rows[0].id_usuario !== parseInt(id_usuario)) return res.status(403).json({ message: "Sin permiso" });
        db.query(
            "UPDATE publicaciones SET id_colonia=?, id_especie=?, id_tipo=?, nombre_pet=?, descripcion=? WHERE id_publi=?",
            [id_colonia, id_especie, id_tipo, nombre_pet, descripcion, req.params.id_publi],
            (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: "Publicación actualizada correctamente" });
            }
        );
    });
});

app.delete('/api/publicaciones/:id_publi', (req, res) => {
    const { id_usuario } = req.body;
    db.query("SELECT id_usuario FROM publicaciones WHERE id_publi = ?", [req.params.id_publi], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows.length === 0) return res.status(404).json({ message: "No encontrada" });
        if (rows[0].id_usuario !== parseInt(id_usuario)) return res.status(403).json({ message: "Sin permiso" });
        // Eliminar en cascada: comentarios → fotos → publicación
        db.query("DELETE FROM comentarios WHERE id_publi = ?", [req.params.id_publi], () => {
            db.query("DELETE FROM fotos_publi WHERE id_publi = ?", [req.params.id_publi], () => {
                db.query("DELETE FROM publicaciones WHERE id_publi = ?", [req.params.id_publi], (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ message: "Publicación eliminada" });
                });
            });
        });
    });
});

// Subir foto con Cloudinary
app.post('/api/fotos/:id_publi', upload.single('foto'), async (req, res) => {
    try {
        const result = await cloudinary.uploader.upload(req.file.path, { folder: 'migo/publicaciones' });
        db.query(
            "INSERT INTO fotos_publi (id_publi, ruta_imagen) VALUES (?, ?)",
            [req.params.id_publi, result.secure_url],
            (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Foto subida', ruta_imagen: result.secure_url });
            }
        );
    } catch (err) {
        res.status(500).json({ error: 'Error al subir foto: ' + err.message });
    }
});


// ═══════════════════════════════════════
//  COMENTARIOS
// ═══════════════════════════════════════

app.get('/api/comentarios/:id_publi', (req, res) => {
    const sql = `
        SELECT c.*, CONCAT(u.nombre, ' ', u.apellido) AS nombre_completo
        FROM comentarios c
        JOIN usuarios u ON c.id_usuario = u.id_usuario
        WHERE c.id_publi = ?
        ORDER BY c.fecha ASC
    `;
    db.query(sql, [req.params.id_publi], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/comentarios', (req, res) => {
    const { id_publi, id_usuario, comentario } = req.body;
    db.query(
        "INSERT INTO comentarios (id_publi, id_usuario, comentario) VALUES (?, ?, ?)",
        [id_publi, id_usuario, comentario],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Comentario publicado', id: result.insertId });
        }
    );
});

app.put('/api/comentarios/:id_comentario', (req, res) => {
    const { comentario, id_usuario } = req.body;
    db.query(
        "UPDATE comentarios SET comentario = ? WHERE id_comentario = ? AND id_usuario = ?",
        [comentario, req.params.id_comentario, id_usuario],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.affectedRows === 0) return res.status(403).json({ message: "Sin permiso" });
            res.json({ message: 'Comentario actualizado' });
        }
    );
});

app.delete('/api/comentarios/:id_comentario/:id_usuario', (req, res) => {
    db.query(
        "DELETE FROM comentarios WHERE id_comentario = ? AND id_usuario = ?",
        [req.params.id_comentario, req.params.id_usuario],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.affectedRows === 0) return res.status(403).json({ message: "Sin permiso" });
            res.json({ message: 'Comentario eliminado' });
        }
    );
});


// ═══════════════════════════════════════
//  VETERINARIOS — LOGIN Y REGISTRO
// ═══════════════════════════════════════

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
        if (results.length === 0 || results[0].rol !== 'veterinario') {
            registrarLogLoginFallido(correo, "Acceso denegado en login veterinario");
            return res.status(401).json({ message: 'Acceso denegado' });
        }
        res.json({ success: true, usuario: results[0] });
    });
});

app.post('/api/registro-vet', (req, res) => {
    const { nombre, apellido, correo, contrasena, id_colonia, nombre_establecimiento, direccion, telefono } = req.body;

    db.query("SELECT id_usuario FROM usuarios WHERE correo = ?", [correo], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows.length > 0) return res.status(400).json({ error: "El correo ya está registrado" });

        db.beginTransaction((err) => {
            if (err) return res.status(500).json({ error: "Error de conexión" });
            db.query(
                "INSERT INTO usuarios (nombre, apellido, direccion, telefono, correo, contrasena, id_colonia, rol) VALUES (?,?,?,?,?,?,?,'veterinario')",
                [nombre, apellido, direccion, telefono, correo, contrasena, id_colonia],
                (err, result) => {
                    if (err) return db.rollback(() => res.status(500).json({ error: err.message }));
                    db.query(
                        "INSERT INTO veterinarias (id_usuario, nombre_establecimiento, id_colonia) VALUES (?, ?, ?)",
                        [result.insertId, nombre_establecimiento, id_colonia],
                        (err) => {
                            if (err) return db.rollback(() => res.status(500).json({ error: err.message }));
                            db.commit((err) => {
                                if (err) return db.rollback(() => res.status(500).json({ error: "Error al guardar" }));
                                res.json({ message: 'Registro exitoso' });
                            });
                        }
                    );
                }
            );
        });
    });
});


// ═══════════════════════════════════════
//  VETERINARIAS — CRUD
// ═══════════════════════════════════════

// Listado simple
app.get('/api/veterinarias', (req, res) => {
    const sql = `
        SELECT v.*, c.nombre AS nombre_colonia
        FROM veterinarias v
        LEFT JOIN colonias c ON v.id_colonia = c.id_colonia
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// ⚠️ IMPORTANTE: esta ruta debe ir ANTES de /api/veterinarias/:id
// Listado detallado con horarios y servicios
app.get('/api/veterinarias/detallado', (req, res) => {
    const sql = `
        SELECT v.*, c.nombre AS nombre_colonia
        FROM veterinarias v
        LEFT JOIN colonias c ON v.id_colonia = c.id_colonia
    `;
    db.query(sql, (err, vets) => {
        if (err) return res.status(500).json({ error: err.message });
        if (vets.length === 0) return res.json([]);

        const promises = vets.map(vet => new Promise((resolve, reject) => {
            db.query(
                `SELECT h.id_dia, d.nombre AS dia, h.hora_apertura, h.hora_cierre, h.cerrado
                 FROM horarios_vet h JOIN dias_semana d ON h.id_dia = d.id_dia
                 WHERE h.id_vet = ? ORDER BY h.id_dia ASC`,
                [vet.id_vet],
                (err, horarios) => {
                    if (err) return reject(err);
                    vet.horarios = horarios;
                    db.query(
                        `SELECT s.id_servicio, s.nombre FROM vet_servicios vs
                         JOIN servicios s ON vs.id_servicio = s.id_servicio WHERE vs.id_vet = ?`,
                        [vet.id_vet],
                        (err, servicios) => {
                            if (err) return reject(err);
                            vet.servicios = servicios;
                            resolve(vet);
                        }
                    );
                }
            );
        }));

        Promise.all(promises)
            .then(result => res.json(result))
            .catch(err => res.status(500).json({ error: err.message }));
    });
});

// Detalle de una veterinaria con horarios y servicios
app.get('/api/veterinaria/:id/detallado', (req, res) => {
    const { id } = req.params;
    db.query(
        `SELECT v.*, c.nombre AS nombre_colonia FROM veterinarias v
         LEFT JOIN colonias c ON v.id_colonia = c.id_colonia WHERE v.id_vet = ?`,
        [id],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            if (results.length === 0) return res.status(404).json({ message: "No encontrada" });
            const vet = results[0];

            db.query(
                `SELECT h.id_dia, d.nombre AS dia, h.hora_apertura, h.hora_cierre, h.cerrado
                 FROM horarios_vet h JOIN dias_semana d ON h.id_dia = d.id_dia
                 WHERE h.id_vet = ? ORDER BY h.id_dia ASC`,
                [id],
                (err, horarios) => {
                    if (err) return res.status(500).json({ error: err.message });
                    vet.horarios = horarios;
                    db.query(
                        `SELECT s.id_servicio, s.nombre FROM vet_servicios vs
                         JOIN servicios s ON vs.id_servicio = s.id_servicio WHERE vs.id_vet = ?`,
                        [id],
                        (err, servicios) => {
                            if (err) return res.status(500).json({ error: err.message });
                            vet.servicios = servicios;
                            res.json(vet);
                        }
                    );
                }
            );
        }
    );
});

// Detalle simple de una veterinaria
app.get('/api/veterinaria/:id', (req, res) => {
    db.query(
        `SELECT v.*, c.nombre AS nombre_colonia FROM veterinarias v
         LEFT JOIN colonias c ON v.id_colonia = c.id_colonia WHERE v.id_vet = ?`,
        [req.params.id],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            if (results.length === 0) return res.status(404).json({ message: "No encontrada" });
            res.json(results[0]);
        }
    );
});

// Actualizar datos de veterinaria
app.put('/api/veterinarias/:id', (req, res) => {
    const { nombre_establecimiento, descripcion, correo_negocio, telefono_local, id_colonia, imagen_logo, sitio_web } = req.body;
    db.query(
        `UPDATE veterinarias SET nombre_establecimiento=?, descripcion=?, correo_negocio=?,
         telefono_local=?, id_colonia=?, imagen_logo=?, sitio_web=? WHERE id_vet=?`,
        [nombre_establecimiento, descripcion, correo_negocio, telefono_local, id_colonia, imagen_logo, sitio_web, req.params.id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.affectedRows === 0) return res.status(404).json({ message: "No encontrada" });
            res.json({ message: "Veterinaria actualizada correctamente" });
        }
    );
});

// Subir logo con Cloudinary
app.post('/api/veterinarias/:id/logo', upload.single('logo'), async (req, res) => {
    try {
        const result = await cloudinary.uploader.upload(req.file.path, { folder: 'migo/logos' });
        db.query(
            "UPDATE veterinarias SET imagen_logo = ? WHERE id_vet = ?",
            [result.secure_url, req.params.id],
            (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Logo actualizado', imagen_logo: result.secure_url });
            }
        );
    } catch (err) {
        res.status(500).json({ error: 'Error al subir logo: ' + err.message });
    }
});


// ═══════════════════════════════════════
//  HORARIOS
// ═══════════════════════════════════════

app.get('/api/horarios/:idVet', (req, res) => {
    db.query(
        `SELECT h.id_horario, h.id_vet, h.id_dia, d.nombre AS dia, h.hora_apertura, h.hora_cierre, h.cerrado
         FROM horarios_vet h JOIN dias_semana d ON h.id_dia = d.id_dia
         WHERE h.id_vet = ? ORDER BY h.id_dia ASC`,
        [req.params.idVet],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

// ✅ Guardar horarios — usa INSERT ... ON DUPLICATE KEY UPDATE para upsert
app.put('/api/horarios/:idVet', (req, res) => {
    const horarios = req.body; // { "1": { hora_apertura, hora_cierre, cerrado }, "2": {...}, ... }
    const dias = Object.keys(horarios);

    if (dias.length === 0) return res.status(400).json({ error: "No se enviaron horarios" });

    const queries = dias.map(id_dia => {
        const { hora_apertura, hora_cierre, cerrado } = horarios[id_dia];
        return new Promise((resolve, reject) => {
            db.query(
                `INSERT INTO horarios_vet (id_vet, id_dia, hora_apertura, hora_cierre, cerrado)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                     hora_apertura = VALUES(hora_apertura),
                     hora_cierre   = VALUES(hora_cierre),
                     cerrado       = VALUES(cerrado)`,
                [req.params.idVet, id_dia, hora_apertura || null, hora_cierre || null, cerrado ? 1 : 0],
                (err) => err ? reject(err) : resolve()
            );
        });
    });

    Promise.all(queries)
        .then(() => res.json({ message: "Horarios guardados correctamente" }))
        .catch(err => res.status(500).json({ error: err.message }));
});


// ═══════════════════════════════════════
//  SERVICIOS
// ═══════════════════════════════════════

app.get('/api/servicios', (req, res) => {
    db.query("SELECT id_servicio, nombre FROM servicios ORDER BY nombre ASC", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/servicios', (req, res) => {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: "Nombre requerido" });
    db.query("INSERT INTO servicios (nombre) VALUES (?)", [nombre], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Servicio creado", id_servicio: result.insertId });
    });
});

app.get('/api/vet-servicios/:idVet', (req, res) => {
    db.query(
        `SELECT s.id_servicio, s.nombre FROM vet_servicios vs
         JOIN servicios s ON vs.id_servicio = s.id_servicio WHERE vs.id_vet = ?`,
        [req.params.idVet],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

// ✅ Asociar servicios — borra los anteriores y reinserta
app.post('/api/vet-servicios/:idVet', (req, res) => {
    const servicios = req.body;
    if (!Array.isArray(servicios)) return res.status(400).json({ error: "Se requiere un array" });

    db.query("DELETE FROM vet_servicios WHERE id_vet = ?", [req.params.idVet], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        if (servicios.length === 0) return res.json({ message: "Servicios eliminados" });

        const values = servicios.map(id_servicio => [req.params.idVet, id_servicio]);
        db.query("INSERT INTO vet_servicios (id_vet, id_servicio) VALUES ?", [values], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Servicios guardados correctamente" });
        });
    });
});


// ═══════════════════════════════════════
//  RESEÑAS
// ═══════════════════════════════════════

app.get('/api/resenas/:id', (req, res) => {
    db.query(
        `SELECT r.*, CONCAT(u.nombre, ' ', u.apellido) AS nombre_completo
         FROM resenas r JOIN usuarios u ON r.id_usuario = u.id_usuario WHERE r.id_vet = ?`,
        [req.params.id],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(results);
        }
    );
});

app.post('/api/resenas', (req, res) => {
    const { id_vet, id_usuario, comentario, calificacion } = req.body;
    if (!id_vet || !id_usuario) return res.status(400).json({ message: "Faltan datos obligatorios" });
    db.query(
        "INSERT INTO resenas (id_vet, id_usuario, comentario, calificacion) VALUES (?, ?, ?, ?)",
        [id_vet, id_usuario, comentario, calificacion],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Reseña publicada con éxito' });
        }
    );
});

app.put('/api/resenas/:id', (req, res) => {
    const { comentario, calificacion } = req.body;
    db.query(
        "UPDATE resenas SET comentario=?, calificacion=? WHERE id_resena=?",
        [comentario, calificacion, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Reseña actualizada' });
        }
    );
});

app.delete('/api/resenas/:id', (req, res) => {
    db.query("DELETE FROM resenas WHERE id_resena=?", [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Reseña eliminada' });
    });
});


// ═══════════════════════════════════════
//  SERVIDOR
// ═══════════════════════════════════════

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor en puerto ${PORT} 🚀`));