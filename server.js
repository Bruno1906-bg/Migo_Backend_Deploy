require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const cloudinary = require('cloudinary').v2;

const app = express();

const normalizeUrl = (value, fallback) => {
    if (!value) return fallback;
    if (/^https?:\/\//i.test(value)) return value.replace(/\/$/, '');
    return `https://${value.replace(/\/$/, '')}`;
};

const FRONTEND_URL = normalizeUrl(process.env.FRONTEND_URL || process.env.VERCEL_URL || process.env.PUBLIC_FRONTEND_URL, 'http://localhost:5173');
const BACKEND_URL = normalizeUrl(process.env.BACKEND_URL || process.env.RAILWAY_PUBLIC_DOMAIN || process.env.PUBLIC_BACKEND_URL, 'http://localhost:4000');

app.use(cors({
    origin: process.env.CORS_ORIGIN || FRONTEND_URL,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

cloudinary.config({
    cloud_name: process.env.CDN_NAME,
    api_key: process.env.CDN_KEY,
    api_secret: process.env.CDN_SECRET
});

const upload = multer({ dest: 'uploads/' });

// Configuración SMTP para Gmail (Requiere App Password de 16 caracteres)
const EMAIL_USER = process.env.EMAIL_USER || process.env.SMTP_USER;
const EMAIL_PASS = process.env.EMAIL_PASS || process.env.SMTP_PASS;

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
    }
});

async function enviarCorreoVerificacion(correoDestino, nombre, token) {
    if (!EMAIL_USER || !EMAIL_PASS) {
        throw new Error('Faltan las credenciales de correo en Railway (EMAIL_USER / EMAIL_PASS).');
    }

    const link = `${BACKEND_URL}/api/verificar-cuenta?token=${token}`;
    return await transporter.sendMail({
        from: `"MIGO - Comunidad de Mascotas" <${EMAIL_USER}>`,
        to: correoDestino,
        subject: 'Verifica tu cuenta en MIGO',
        html: `
            <div style="font-family: Arial, sans-serif; color: #223338; max-width: 500px;">
                <h2 style="color: #0f9d8e;">¡Hola ${nombre}!</h2>
                <p>Gracias por registrarte en MIGO. Haz clic aquí para activar tu cuenta:</p>
                <p style="text-align:center; margin: 24px 0;">
                    <a href="${link}" style="background:#0f9d8e; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold;">
                        Verificar mi cuenta
                    </a>
                </p>
                <p>Si el botón no funciona, usa este enlace: ${link}</p>
            </div>
        `
    });
}

// BD — conexión
const db = mysql.createConnection({
    host: process.env.MYSQLHOST || process.env.DB_HOST,
    user: process.env.MYSQLUSER || process.env.DB_USER,
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD,
    database: process.env.MYSQL_DATABASE || process.env.DB_NAME,
    port: parseInt(process.env.MYSQLPORT || process.env.DB_PORT) || 3306
});

function asegurarColumnasUbicacionVeterinaria() {
    const columnas = [
        "ALTER TABLE veterinarias ADD COLUMN latitud DECIMAL(10,7) DEFAULT NULL",
        "ALTER TABLE veterinarias ADD COLUMN longitud DECIMAL(10,7) DEFAULT NULL"
    ];

    columnas.forEach(sql => {
        db.query(sql, err => {
            if (err && err.code !== 'ER_DUP_FIELDNAME') {
                console.error('No se pudo asegurar la columna de ubicación:', err.message);
            }
        });
    });
}

db.connect(err => {
    if (err) {
        console.error('Error de conexión a la base de datos:', err.message);
        return;
    }

    asegurarColumnasUbicacionVeterinaria();
});

// Logs
function registrarLogLoginFallido(correo, detalle) {
    db.query("INSERT INTO logs (correo, accion, detalle) VALUES (?, 'LOGIN_FALLIDO', ?)", [correo, detalle], (err) => {
        if (err) console.error("Error guardando log:", err.message);
    });
}

// ═══════════════════════════════════════
//  USUARIOS (Optimizado)
// ═══════════════════════════════════════

const registrarUsuarioHandler = (req, res) => {
    const { nombre, apellido, correo, contrasena, telefono, direccion, id_colonia, rol } = req.body;

    const camposFaltantes = [];
    if (!nombre) camposFaltantes.push('nombre');
    if (!apellido) camposFaltantes.push('apellido');
    if (!correo) camposFaltantes.push('correo');
    if (!contrasena) camposFaltantes.push('contrasena');
    if (!telefono) camposFaltantes.push('telefono');
    if (!direccion) camposFaltantes.push('direccion');
    if (!id_colonia) camposFaltantes.push('id_colonia');
    if (!rol) camposFaltantes.push('rol');

    if (camposFaltantes.length > 0) {
        return res.status(400).json({
            error: 'Faltan campos obligatorios para registrar el usuario.',
            details: camposFaltantes.join(', ')
        });
    }

    const checkSql = "SELECT id_usuario FROM usuarios WHERE correo = ?";
    db.query(checkSql, [correo], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows.length > 0) return res.status(400).json({ error: "El correo ya está registrado" });

        const token = crypto.randomBytes(32).toString('hex');
        
        // Uso de placeholders y función NOW() de MySQL para mayor seguridad
        const sql = `INSERT INTO usuarios (nombre, apellido, correo, contrasena, telefono, direccion, id_colonia, rol, verificado, token_verificacion, token_expira) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))`;

        db.query(sql, [nombre, apellido, correo, contrasena, telefono, direccion, id_colonia, rol, token], async (err, result) => {
            if (err) return res.status(500).json({ error: err.message });

            try {
                // Esperamos el envío del correo de forma asíncrona
                await enviarCorreoVerificacion(correo, nombre, token);
                return res.status(201).json({
                    message: 'Usuario registrado correctamente. Revisa tu correo para verificar tu cuenta.',
                    id: result.insertId
                });
            } catch (mailErr) {
                console.error("ERROR EN ENVÍO DE CORREO:", mailErr);
                return res.status(201).json({ 
                    message: 'Usuario registrado correctamente, pero no se pudo enviar el correo de verificación.',
                    warning: mailErr.message,
                    id: result.insertId
                });
            }
        });
    });
};

app.post('/api/usuarios', registrarUsuarioHandler);
app.post('/api/usuarios/register', registrarUsuarioHandler);

app.get('/api/verificar-cuenta', (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).send('Token no proporcionado.');

    const sql = "SELECT id_usuario FROM usuarios WHERE token_verificacion = ? AND token_expira > NOW() AND verificado = 0";
    db.query(sql, [token], (err, rows) => {
        if (err) return res.status(500).send('Error de servidor.');
        if (rows.length === 0) return res.send('<h2>Enlace inválido o vencido</h2>');

        const id_usuario = rows[0].id_usuario;
        db.query("UPDATE usuarios SET verificado = 1, token_verificacion = NULL, token_expira = NULL WHERE id_usuario = ?", [id_usuario], (err) => {
            if (err) return res.status(500).send('Error al verificar la cuenta.');
            res.send('<h2>¡Cuenta verificada con éxito!</h2><a href="'+FRONTEND_URL+'/login">Ir a iniciar sesión</a>');
        });
    });
});

// ... (El resto de tus rutas siguen operativas igual)
app.get('/api/usuarios/:id', (req, res) => {
    db.query('SELECT u.*, c.nombre AS colonia FROM usuarios u LEFT JOIN colonias c ON u.id_colonia = c.id_colonia WHERE u.id_usuario = ?', [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results[0]);
    });
});

const loginHandler = (req, res) => {
    const { correo, contrasena } = req.body;
    db.query("SELECT id_usuario, nombre, rol, verificado FROM usuarios WHERE correo = ? AND contrasena = ?", [correo, contrasena], (err, results) => {
        if (err) return res.status(500).json({ message: 'Error de servidor' });
        if (results.length > 0) {
            const usuario = results[0];
            if (usuario.verificado === 0) return res.status(403).json({ message: 'Debes verificar tu cuenta antes de iniciar sesión.' });
            res.json(usuario);
        } else {
            registrarLogLoginFallido(correo, "Credenciales incorrectas");
            res.status(401).json({ message: 'Credenciales incorrectas' });
        }
    });
};

app.post('/api/login', loginHandler);
app.post('/api/usuarios/login', loginHandler);

app.get('/api/colonias', (req, res) => {
    db.query('SELECT id_colonia, nombre FROM colonias', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// ═══════════════════════════════════════
//  PUBLICACIONES
// ═══════════════════════════════════════

app.get('/api/publicaciones', (req, res) => {
    const sql = `
        SELECT
            p.id_publi,
            p.nombre_pet,
            p.descripcion,
            p.fecha_publi,
            p.id_colonia  AS id_colonia_raw,
            p.id_especie  AS id_especie_raw,
            p.id_tipo     AS id_tipo_raw,
            u.id_usuario,
            u.nombre      AS usuario,
            u.correo,
            u.telefono,
            c.nombre      AS nombre_colonia,
            e.nombre      AS especie,
            t.nombre      AS tipo,
            est.nombre    AS estado,
            f.ruta_imagen
        FROM publicaciones p
        JOIN usuarios u      ON p.id_usuario  = u.id_usuario
        JOIN colonias c      ON p.id_colonia  = c.id_colonia
        JOIN especies e      ON p.id_especie  = e.id_especie
        JOIN tipos_publi t   ON p.id_tipo     = t.id_tipo
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
// El trigger trg_publicaciones_estado_inicial asigna id_estado = 'Pendiente' automáticamente,
// por eso ya NO se envía id_estado desde el backend.
app.post('/api/publicaciones', (req, res) => {
    const { id_usuario, id_colonia, id_especie, id_tipo, nombre_pet, descripcion } = req.body;

    if (!id_usuario || !id_colonia || !id_especie || !id_tipo || !nombre_pet || !descripcion) {
        return res.status(400).json({ error: "Faltan datos obligatorios" });
    }

    const sql = `
        INSERT INTO publicaciones (id_usuario, id_colonia, id_especie, id_tipo, nombre_pet, descripcion, fecha_publi)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
    `;
    db.query(sql, [id_usuario, id_colonia, id_especie, id_tipo, nombre_pet, descripcion], (err, result) => {
        if (err) {
            console.error("Error al crear publicación:", err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Publicación creada', id_publi: result.insertId });
    });
});

// Editar publicación — verifica que sea el dueño antes de actualizar
app.put('/api/publicaciones/:id_publi', (req, res) => {
    const { id_publi } = req.params;
    const { id_usuario, id_colonia, id_especie, id_tipo, nombre_pet, descripcion } = req.body;

    const checkSql = "SELECT id_usuario FROM publicaciones WHERE id_publi = ?";
    db.query(checkSql, [id_publi], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows.length === 0) return res.status(404).json({ message: "Publicación no encontrada" });
        if (rows[0].id_usuario !== parseInt(id_usuario)) {
            return res.status(403).json({ message: "No tienes permiso para editar esta publicación" });
        }

        const sql = `
            UPDATE publicaciones
            SET id_colonia = ?, id_especie = ?, id_tipo = ?, nombre_pet = ?, descripcion = ?
            WHERE id_publi = ?
        `;
        db.query(sql, [id_colonia, id_especie, id_tipo, nombre_pet, descripcion, id_publi], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Publicación actualizada correctamente" });
        });
    });
});

app.delete('/api/publicaciones/:id_publi', (req, res) => {
    const { id_publi } = req.params;
    const { id_usuario } = req.body;

    const checkSql = "SELECT id_usuario FROM publicaciones WHERE id_publi = ?";
    db.query(checkSql, [id_publi], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows.length === 0) return res.status(404).json({ message: "Publicación no encontrada" });
        if (rows[0].id_usuario !== parseInt(id_usuario)) {
            return res.status(403).json({ message: "No tienes permiso para eliminar esta publicación" });
        }

        db.query("DELETE FROM fotos_publi WHERE id_publi = ?", [id_publi], () => {
            db.query("DELETE FROM comentarios WHERE id_publi = ?", [id_publi], () => {
                db.query("DELETE FROM publicaciones WHERE id_publi = ?", [id_publi], (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ message: "Publicación eliminada correctamente" });
                });
            });
        });
    });
});

// Tipos de publicación
app.get('/api/tipos_publi', (req, res) => {
    db.query('SELECT id_tipo, nombre FROM tipos_publi', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Subir foto de publicación (Cloudinary en vez de disco local)
app.post('/api/fotos/:id_publi', upload.single('foto'), async (req, res) => {
    const id_publi = req.params.id_publi;
    if (!req.file) return res.status(400).json({ message: 'No se subió archivo' });

    try {
        const result = await cloudinary.uploader.upload(req.file.path, { folder: 'migo/publicaciones' });
        db.query('INSERT INTO fotos_publi (id_publi, ruta_imagen) VALUES (?, ?)', [id_publi, result.secure_url], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Foto subida', ruta_imagen: result.secure_url });
        });
    } catch (err) {
        res.status(500).json({ error: 'Error al subir foto: ' + err.message });
    }
});


// ═══════════════════════════════════════
//  VETERINARIO
// ═══════════════════════════════════════

// Login de veterinario (requiere cuenta verificada)
app.post('/api/login-vet', (req, res) => {
    const { correo, contrasena } = req.body;

    const sql = `
        SELECT u.id_usuario, u.nombre, u.rol, u.verificado, v.id_vet
        FROM usuarios u
        LEFT JOIN veterinarias v ON u.id_usuario = v.id_usuario
        WHERE u.correo = ? AND u.contrasena = ?
    `;
    db.query(sql, [correo, contrasena], (err, results) => {
        if (err) return res.status(500).json({ message: 'Error de servidor' });

        if (results.length > 0) {
            const usuario = results[0];
            if (usuario.rol !== 'veterinario') {
                registrarLogLoginFallido(correo, "Intento de login como veterinario sin rol válido");
                return res.status(403).json({ message: 'No tienes acceso como veterinario' });
            }

            if (usuario.verificado === 0) {
                registrarLogLoginFallido(correo, "Intento de login de veterinario con cuenta no verificada");
                return res.status(403).json({ message: 'Debes verificar tu cuenta antes de iniciar sesión. Revisa tu correo.' });
            }

            delete usuario.verificado;
            res.json({ success: true, usuario });
        } else {
            registrarLogLoginFallido(correo, "Credenciales inválidas en login de veterinario");
            res.status(401).json({ message: 'Credenciales inválidas' });
        }
    });
});

// Registro de veterinario — también requiere verificar el correo
app.post('/api/registro-vet', (req, res) => {
    const { nombre, apellido, correo, contrasena, id_colonia, nombre_establecimiento, direccion, telefono } = req.body;

    const checkSql = "SELECT id_usuario FROM usuarios WHERE correo = ?";
    db.query(checkSql, [correo], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows.length > 0) return res.status(400).json({ error: "El correo ya está registrado" });

        const token = crypto.randomBytes(32).toString('hex');
        const tokenExpiraSql = "DATE_ADD(NOW(), INTERVAL 24 HOUR)";

        db.beginTransaction((err) => {
            if (err) return res.status(500).json({ error: "Error de conexión" });

            const sqlUser = `
                INSERT INTO usuarios
                    (nombre, apellido, direccion, telefono, correo, contrasena, id_colonia, rol, verificado, token_verificacion, token_expira)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'veterinario', 0, ?, ${tokenExpiraSql})
            `;
            db.query(sqlUser, [nombre, apellido, direccion, telefono, correo, contrasena, id_colonia, token], (err, result) => {
                if (err) return db.rollback(() => res.status(500).json({ error: err.message }));

                const id_usuario = result.insertId;
                const sqlVet = `INSERT INTO veterinarias (id_usuario, nombre_establecimiento, id_colonia) VALUES (?, ?, ?)`;
                db.query(sqlVet, [id_usuario, nombre_establecimiento, id_colonia], (err) => {
                    if (err) return db.rollback(() => res.status(500).json({ error: err.message }));

                    db.commit(async (err) => {
                        if (err) return db.rollback(() => res.status(500).json({ error: "Error al guardar" }));

                        try {
                            await enviarCorreoVerificacion(correo, nombre, token);
                        } catch (mailErr) {
                            console.error("Error al enviar correo de verificación (vet):", mailErr.message);
                            return res.json({
                                message: 'Negocio registrado, pero no se pudo enviar el correo de verificación. Contacta al administrador.'
                            });
                        }

                        res.json({ message: 'Registro exitoso. Revisa tu correo para verificar tu cuenta antes de iniciar sesión.' });
                    });
                });
            });
        });
    });
});

// Veterinarias (listado simple)
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

// ⚠️ IMPORTANTE: esta ruta debe ir ANTES de /api/veterinaria/:id para no chocar con el parámetro
// Veterinarias con horarios y servicios
app.get('/api/veterinarias/detallado', (req, res) => {
    const sql = `
        SELECT v.*, c.nombre AS nombre_colonia
        FROM veterinarias v
        LEFT JOIN colonias c ON v.id_colonia = c.id_colonia
    `;
    db.query(sql, (err, vets) => {
        if (err) return res.status(500).json({ error: err.message });
        if (vets.length === 0) return res.json([]);

        const promises = vets.map(vet => {
            return new Promise((resolve, reject) => {
                const sqlHorarios = `
                    SELECT h.id_dia, d.nombre AS dia, h.hora_apertura, h.hora_cierre, h.cerrado
                    FROM horarios_vet h
                    JOIN dias_semana d ON h.id_dia = d.id_dia
                    WHERE h.id_vet = ?
                    ORDER BY h.id_dia ASC
                `;
                db.query(sqlHorarios, [vet.id_vet], (err, horarios) => {
                    if (err) return reject(err);
                    vet.horarios = horarios;

                    const sqlServicios = `
                        SELECT s.id_servicio, s.nombre
                        FROM vet_servicios vs
                        JOIN servicios s ON vs.id_servicio = s.id_servicio
                        WHERE vs.id_vet = ?
                    `;
                    db.query(sqlServicios, [vet.id_vet], (err, servicios) => {
                        if (err) return reject(err);
                        vet.servicios = servicios;
                        resolve(vet);
                    });
                });
            });
        });

        Promise.all(promises)
            .then(result => res.json(result))
            .catch(error => res.status(500).json({ error: error.message }));
    });
});

// Veterinaria individual con horarios y servicios
app.get('/api/veterinaria/:id/detallado', (req, res) => {
    const { id } = req.params;
    const sqlVet = `
        SELECT v.*, c.nombre AS nombre_colonia
        FROM veterinarias v
        LEFT JOIN colonias c ON v.id_colonia = c.id_colonia
        WHERE v.id_vet = ?
    `;
    db.query(sqlVet, [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ message: "Veterinaria no encontrada" });

        const vet = results[0];
        const sqlHorarios = `
            SELECT h.id_dia, d.nombre AS dia, h.hora_apertura, h.hora_cierre, h.cerrado
            FROM horarios_vet h
            JOIN dias_semana d ON h.id_dia = d.id_dia
            WHERE h.id_vet = ?
            ORDER BY h.id_dia ASC
        `;
        db.query(sqlHorarios, [id], (err, horarios) => {
            if (err) return res.status(500).json({ error: err.message });
            vet.horarios = horarios;

            const sqlServicios = `
                SELECT s.id_servicio, s.nombre
                FROM vet_servicios vs
                JOIN servicios s ON vs.id_servicio = s.id_servicio
                WHERE vs.id_vet = ?
            `;
            db.query(sqlServicios, [id], (err, servicios) => {
                if (err) return res.status(500).json({ error: err.message });
                vet.servicios = servicios;
                res.json(vet);
            });
        });
    });
});

// Actualizar datos de una veterinaria
app.put('/api/veterinarias/:id', (req, res) => {
    const {
        nombre_establecimiento,
        descripcion,
        correo_negocio,
        telefono_local,
        id_colonia,
        imagen_logo,
        sitio_web,
        latitud,
        longitud
    } = req.body;
    const sql = `
        UPDATE veterinarias
        SET nombre_establecimiento = ?, descripcion = ?, correo_negocio = ?,
            telefono_local = ?, id_colonia = ?, imagen_logo = ?, sitio_web = ?, latitud = ?, longitud = ?
        WHERE id_vet = ?
    `;
    db.query(sql, [nombre_establecimiento, descripcion, correo_negocio, telefono_local, id_colonia, imagen_logo, sitio_web, latitud ?? null, longitud ?? null, req.params.id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ message: "Veterinaria no encontrada" });
        res.json({ message: "Veterinaria actualizada correctamente" });
    });
});

// Subir logo de veterinaria (Cloudinary)
app.post('/api/veterinarias/:id/logo', upload.single('logo'), async (req, res) => {
    const id_vet = req.params.id;
    if (!req.file) return res.status(400).json({ message: 'No se subió archivo' });

    try {
        const result = await cloudinary.uploader.upload(req.file.path, { folder: 'migo/logos' });
        db.query('UPDATE veterinarias SET imagen_logo = ? WHERE id_vet = ?', [result.secure_url, id_vet], (err, dbResult) => {
            if (err) return res.status(500).json({ error: err.message });
            if (dbResult.affectedRows === 0) return res.status(404).json({ message: "Veterinaria no encontrada" });
            res.json({ message: 'Logo actualizado correctamente', imagen_logo: result.secure_url });
        });
    } catch (err) {
        res.status(500).json({ error: 'Error al subir logo: ' + err.message });
    }
});

// Obtener horarios de una veterinaria
app.get('/api/horarios/:idVet', (req, res) => {
    const sql = `
        SELECT h.id_horario, h.id_vet, h.id_dia, d.nombre AS dia,
               h.hora_apertura, h.hora_cierre, h.cerrado
        FROM horarios_vet h
        JOIN dias_semana d ON h.id_dia = d.id_dia
        WHERE h.id_vet = ?
        ORDER BY h.id_dia ASC
    `;
    db.query(sql, [req.params.idVet], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Actualizar horarios de una veterinaria
// Requiere UNIQUE KEY (id_vet, id_dia) en horarios_vet para que el UPSERT funcione correctamente
app.put('/api/horarios/:idVet', (req, res) => {
    const { idVet } = req.params;
    const horarios = req.body;

    db.beginTransaction(err => {
        if (err) return res.status(500).json({ error: "Error de conexión" });

        const dias = Object.keys(horarios);
        dias.forEach(id_dia => {
            const { hora_apertura, hora_cierre, cerrado } = horarios[id_dia];
            const sql = `
                INSERT INTO horarios_vet (id_vet, id_dia, hora_apertura, hora_cierre, cerrado)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    hora_apertura = VALUES(hora_apertura),
                    hora_cierre = VALUES(hora_cierre),
                    cerrado = VALUES(cerrado)
            `;
            db.query(sql, [idVet, id_dia, hora_apertura || null, hora_cierre || null, cerrado ? 1 : 0], (err) => {
                if (err) return db.rollback(() => res.status(500).json({ error: err.message }));
            });
        });

        db.commit(err => {
            if (err) return db.rollback(() => res.status(500).json({ error: "Error al guardar horarios" }));
            res.json({ message: "Horarios actualizados correctamente" });
        });
    });
});

// Días de la semana
app.get('/api/dias-semana', (req, res) => {
    db.query("SELECT id_dia, nombre FROM dias_semana ORDER BY id_dia ASC", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Crear un nuevo servicio
app.post('/api/servicios', (req, res) => {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: "El nombre del servicio es obligatorio" });
    db.query("INSERT INTO servicios (nombre) VALUES (?)", [nombre], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Servicio creado correctamente", id_servicio: result.insertId });
    });
});

// Asociar servicios a una veterinaria
app.post('/api/vet-servicios/:idVet', (req, res) => {
    const { idVet } = req.params;
    const serviciosSeleccionados = req.body;

    if (!Array.isArray(serviciosSeleccionados)) {
        return res.status(400).json({ error: "Se requiere un array de servicios" });
    }

    db.beginTransaction(err => {
        if (err) return res.status(500).json({ error: "Error de conexión" });

        db.query("DELETE FROM vet_servicios WHERE id_vet = ?", [idVet], (err) => {
            if (err) return db.rollback(() => res.status(500).json({ error: err.message }));

            if (serviciosSeleccionados.length > 0) {
                const values = serviciosSeleccionados.map(id_servicio => [idVet, id_servicio]);
                db.query("INSERT INTO vet_servicios (id_vet, id_servicio) VALUES ?", [values], (err) => {
                    if (err) return db.rollback(() => res.status(500).json({ error: err.message }));
                    db.commit(err => {
                        if (err) return db.rollback(() => res.status(500).json({ error: "Error al guardar servicios" }));
                        res.json({ message: "Servicios asociados correctamente" });
                    });
                });
            } else {
                db.commit(err => {
                    if (err) return db.rollback(() => res.status(500).json({ error: "Error al guardar servicios" }));
                    res.json({ message: "Servicios eliminados correctamente" });
                });
            }
        });
    });
});

// Obtener todos los servicios
app.get('/api/servicios', (req, res) => {
    db.query("SELECT id_servicio, nombre FROM servicios ORDER BY nombre ASC", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Obtener servicios de una veterinaria
app.get('/api/vet-servicios/:idVet', (req, res) => {
    const sql = `
        SELECT s.id_servicio, s.nombre
        FROM vet_servicios vs
        JOIN servicios s ON vs.id_servicio = s.id_servicio
        WHERE vs.id_vet = ?
    `;
    db.query(sql, [req.params.idVet], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Obtener detalles de una veterinaria específica
app.get('/api/veterinaria/:id', (req, res) => {
    const sql = `
        SELECT v.*, c.nombre AS nombre_colonia
        FROM veterinarias v
        LEFT JOIN colonias c ON v.id_colonia = c.id_colonia
        WHERE v.id_vet = ?
    `;
    db.query(sql, [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ message: "No encontrada" });
        res.json(results[0]);
    });
});

// Obtener reseñas de una veterinaria
app.get('/api/resenas/:id', (req, res) => {
    const sql = `
        SELECT r.*, CONCAT(u.nombre, ' ', u.apellido) AS nombre_completo
        FROM resenas r
        JOIN usuarios u ON r.id_usuario = u.id_usuario
        WHERE r.id_vet = ?
    `;
    db.query(sql, [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Publicar reseña
// Incluye fecha_resena (NOT NULL en la tabla) y maneja el caso de reseña duplicada
// (resenas_index_1 es UNIQUE sobre id_usuario + id_vet: un usuario solo puede reseñar 1 vez por vet)
app.post('/api/resenas', (req, res) => {
    const { id_vet, id_usuario, comentario, calificacion } = req.body;

    if (!id_vet || !id_usuario) {
        return res.status(400).json({ message: "Faltan datos obligatorios" });
    }

    db.query(
        "INSERT INTO resenas (id_vet, id_usuario, comentario, calificacion, fecha_resena) VALUES (?, ?, ?, ?, NOW())",
        [id_vet, id_usuario, comentario, calificacion],
        (err) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ message: "Ya dejaste una reseña para esta veterinaria" });
                }
                console.error("Error al publicar reseña:", err);
                return res.status(500).json({ error: err.message });
            }
            res.json({ message: 'Reseña publicada con éxito' });
        }
    );
});

// Editar reseña
app.put('/api/resenas/:id', (req, res) => {
    const { comentario, calificacion } = req.body;
    db.query("UPDATE resenas SET comentario = ?, calificacion = ? WHERE id_resena = ?",
        [comentario, calificacion, req.params.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Reseña actualizada' });
        });
});

// Eliminar reseña
app.delete('/api/resenas/:id', (req, res) => {
    db.query("DELETE FROM resenas WHERE id_resena = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Reseña eliminada' });
    });
});

// Obtener comentarios de una publicación
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

// Publicar comentario
app.post('/api/comentarios', (req, res) => {
    const { id_publi, id_usuario, comentario } = req.body;
    db.query("INSERT INTO comentarios (id_publi, id_usuario, comentario) VALUES (?, ?, ?)",
        [id_publi, id_usuario, comentario], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Comentario publicado', id: result.insertId });
        });
});

// Eliminar comentario
app.delete('/api/comentarios/:id_comentario/:id_usuario', (req, res) => {
    const { id_comentario, id_usuario } = req.params;
    db.query("DELETE FROM comentarios WHERE id_comentario = ? AND id_usuario = ?",
        [id_comentario, id_usuario], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.affectedRows === 0) return res.status(403).json({ message: "No tienes permiso" });
            res.json({ message: 'Comentario eliminado' });
        });
});

// Editar comentario
app.put('/api/comentarios/:id_comentario', (req, res) => {
    const { comentario, id_usuario } = req.body;
    const { id_comentario } = req.params;
    db.query("UPDATE comentarios SET comentario = ? WHERE id_comentario = ? AND id_usuario = ?",
        [comentario, id_comentario, id_usuario], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.affectedRows === 0) return res.status(403).json({ message: "No tienes permiso para editar este comentario" });
            res.json({ message: 'Comentario actualizado' });
        });
});


// ═══════════════════════════════════════
//  ADMINISTRADOR
// ═══════════════════════════════════════

function verificarAdmin(id_admin, callback) {
    db.query("SELECT rol FROM usuarios WHERE id_usuario = ?", [id_admin], (err, rows) => {
        if (err) return callback(err, false);
        if (rows.length === 0 || rows[0].rol !== 'administrador') return callback(null, false);
        callback(null, true);
    });
}

// Eliminar cualquier publicación (sin validar dueño, solo que quien pide sea admin)
app.delete('/api/admin/publicaciones/:id_publi', (req, res) => {
    const { id_publi } = req.params;
    const { id_admin } = req.body;

    verificarAdmin(id_admin, (err, esAdmin) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!esAdmin) return res.status(403).json({ message: "No tienes permisos" });

        db.query("SELECT u.correo, u.nombre FROM usuarios u JOIN publicaciones p ON u.id_usuario = p.id_usuario WHERE p.id_publi = ?", [id_publi], (err, results) => {
            const usuario = results && results[0];

            db.query("DELETE FROM fotos_publi WHERE id_publi = ?", [id_publi], () => {
                db.query("DELETE FROM comentarios WHERE id_publi = ?", [id_publi], () => {
                    db.query("DELETE FROM publicaciones WHERE id_publi = ?", [id_publi], (err, result) => {
                        if (err) return res.status(500).json({ error: err.message });
                        if (result.affectedRows === 0) return res.status(404).json({ message: "No encontrada" });

                        if (usuario) {
                            enviarAvisoAdministrativo(usuario.correo, usuario.nombre, 'Incumplimiento de normas', true);
                        }
                        res.json({ message: "Publicación eliminada y usuario notificado" });
                    });
                });
            });
        });
    });
});

// Reportar a un usuario (queda registrado el motivo y se marca su estado)
app.post('/api/admin/reportar-usuario', (req, res) => {
    const { id_usuario_reportado, id_admin, motivo } = req.body;

    verificarAdmin(id_admin, (err, esAdmin) => {
        if (!esAdmin) return res.status(403).json({ message: "No tienes permisos" });

        db.query("SELECT correo, nombre FROM usuarios WHERE id_usuario = ?", [id_usuario_reportado], (err, results) => {
            const usuario = results && results[0];

            db.query("INSERT INTO reportes_usuario (id_usuario_reportado, id_admin, motivo) VALUES (?, ?, ?)", [id_usuario_reportado, id_admin, motivo], (err) => {
                db.query("UPDATE usuarios SET estado = 'reportado' WHERE id_usuario = ?", [id_usuario_reportado], (err) => {

                    if (usuario) {
                        enviarAvisoAdministrativo(usuario.correo, usuario.nombre, motivo, false);
                    }
                    res.json({ message: "Usuario reportado y notificado" });
                });
            });
        });
    });
});

// Listado de reportes hechos
app.get('/api/admin/reportes', (req, res) => {
    const sql = `
        SELECT r.id_reporte, r.motivo, r.fecha_reporte,
               CONCAT(u.nombre, ' ', u.apellido) AS usuario_reportado,
               u.correo AS correo_reportado,
               CONCAT(a.nombre, ' ', a.apellido) AS admin_reporto
        FROM reportes_usuario r
        JOIN usuarios u ON r.id_usuario_reportado = u.id_usuario
        JOIN usuarios a ON r.id_admin = a.id_usuario
        ORDER BY r.fecha_reporte DESC
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.get('/api/usuarios', (req, res) => {
    const sql = `
        SELECT id_usuario, nombre, correo, rol, telefono
        FROM usuarios
        WHERE rol != 'administrador'
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.delete('/api/usuarios/:id', async (req, res) => {
    const id = req.params.id;

    const executeQuery = (sql, params) => {
        return new Promise((resolve, reject) => {
            db.query(sql, params, (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });
    };

    try {
        // 1) Fotos de las publicaciones del usuario
        await executeQuery(
            "DELETE FROM fotos_publi WHERE id_publi IN (SELECT id_publi FROM publicaciones WHERE id_usuario = ?)",
            [id]
        );

        // 2) Comentarios hechos POR el usuario, y comentarios EN sus publicaciones
        await executeQuery("DELETE FROM comentarios WHERE id_usuario = ?", [id]);
        await executeQuery(
            "DELETE FROM comentarios WHERE id_publi IN (SELECT id_publi FROM publicaciones WHERE id_usuario = ?)",
            [id]
        );

        // 3) Reseñas hechas por el usuario
        await executeQuery("DELETE FROM resenas WHERE id_usuario = ?", [id]);

        // 4) Publicaciones del usuario
        await executeQuery("DELETE FROM publicaciones WHERE id_usuario = ?", [id]);

        // 5) Si el usuario es veterinario: reseñas a su vet, horarios, servicios y la veterinaria
        await executeQuery(
            "DELETE FROM resenas WHERE id_vet IN (SELECT id_vet FROM veterinarias WHERE id_usuario = ?)",
            [id]
        );
        await executeQuery(
            "DELETE FROM horarios_vet WHERE id_vet IN (SELECT id_vet FROM veterinarias WHERE id_usuario = ?)",
            [id]
        );
        await executeQuery(
            "DELETE FROM vet_servicios WHERE id_vet IN (SELECT id_vet FROM veterinarias WHERE id_usuario = ?)",
            [id]
        );
        await executeQuery("DELETE FROM veterinarias WHERE id_usuario = ?", [id]);

        // 6) Finalmente, el usuario
        const result = await executeQuery("DELETE FROM usuarios WHERE id_usuario = ?", [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        res.json({ message: "Usuario eliminado correctamente" });
    } catch (err) {
        console.error("Error al eliminar usuario:", err);
        res.status(500).json({ message: "Error: " + err.message });
    }
});


// ═══════════════════════════════════════
//  SERVIDOR
// ═══════════════════════════════════════

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => console.log(`Migo corriendo en el puerto ${PORT} 🏃‍♂️`));