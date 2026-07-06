const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();


const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'bruno19benitez@gmail.com',
        pass: 'pncs nwnn aaup jnng'
    }
});

// URL base del frontend, usada para armar el link de verificación
const FRONTEND_URL = 'http://localhost:5173';

function enviarCorreoVerificacion(correoDestino, nombre, token) {
    const link = `http://localhost:4000/api/verificar-cuenta?token=${token}`;
    return transporter.sendMail({
        from: '"MIGO - Comunidad de Mascotas" <bruno19benitez@gmail.com>',
        to: correoDestino,
        subject: 'Verifica tu cuenta en MIGO',
        html: `
            <div style="font-family: Arial, sans-serif; color: #223338; max-width: 500px;">
                <h2 style="color: #0f9d8e;">¡Hola ${nombre}!</h2>
                <p>Gracias por registrarte en MIGO. Para activar tu cuenta, confirma tu correo haciendo clic en el siguiente botón:</p>
                <p style="text-align:center; margin: 24px 0;">
                    <a href="${link}" style="background:#0f9d8e; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold;">
                        Verificar mi cuenta
                    </a>
                </p>
                <p style="font-size:13px; color:#7c8a8f;">Si el botón no funciona, copia y pega este enlace en tu navegador:<br>${link}</p>
                <p style="font-size:13px; color:#7c8a8f;">Este enlace vence en 24 horas.</p>
            </div>
        `
    });
}

// ✅ Multer configurado para conservar la extensión del archivo original
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname); // .jpg, .png, etc.
        const nombreUnico = Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
        cb(null, nombreUnico);
    }
});

const upload = multer({ storage });

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Conexión a la BD
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'migo_db_VUE'
});

///////Función para registrar logs////////
function registrarLogLoginFallido(correo, detalle) {
  console.log("Registrando log fallido:", correo, detalle);
  const sql = "INSERT INTO logs (correo, accion, detalle) VALUES (?, 'LOGIN_FALLIDO', ?)";
  db.query(sql, [correo, detalle], (err) => {
    if (err) {
      console.error("Error guardando log:", err.message);
    } else {
      console.log("Log guardado correctamente");
    }
  });
}


// ENDPOINTS


///////USUARIO////////

// ✅ Crear usuario — genera token de verificación y envía correo
app.post('/api/usuarios', (req, res) => {
    const { nombre, apellido, correo, contrasena, telefono, direccion, id_colonia, rol } = req.body;

    const checkSql = "SELECT id_usuario FROM usuarios WHERE correo = ?";
    db.query(checkSql, [correo], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows.length > 0) {
            return res.status(400).json({ error: "El correo ya está registrado" });
        }

        const token = crypto.randomBytes(32).toString('hex');
        // El token vence en 24 horas
        const tokenExpiraSql = "DATE_ADD(NOW(), INTERVAL 24 HOUR)";

        const sql = `
            INSERT INTO usuarios 
                (nombre, apellido, correo, contrasena, telefono, direccion, id_colonia, rol, verificado, token_verificacion, token_expira)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ${tokenExpiraSql})
        `;
        db.query(sql, [nombre, apellido, correo, contrasena, telefono, direccion, id_colonia, rol, token], async (err, result) => {
            if (err) return res.status(500).json({ error: err.message });

            try {
                await enviarCorreoVerificacion(correo, nombre, token);
            } catch (mailErr) {
                console.error("Error al enviar correo de verificación:", mailErr.message);
                // No tumbamos el registro si falla el correo, pero avisamos en la respuesta
                return res.json({
                    message: 'Usuario registrado, pero no se pudo enviar el correo de verificación. Contacta al administrador.',
                    id: result.insertId
                });
            }

            res.json({
                message: 'Usuario registrado correctamente. Revisa tu correo para verificar tu cuenta.',
                id: result.insertId
            });
        });
    });
});

// ✅ Verificar cuenta a través del link enviado por correo
app.get('/api/verificar-cuenta', (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).send('Token no proporcionado.');

    const sql = `
        SELECT id_usuario FROM usuarios 
        WHERE token_verificacion = ? AND token_expira > NOW() AND verificado = 0
    `;
    db.query(sql, [token], (err, rows) => {
        if (err) return res.status(500).send('Error de servidor.');

        if (rows.length === 0) {
            return res.send(`
                <div style="font-family: Arial, sans-serif; text-align:center; margin-top:60px;">
                    <h2 style="color:#b23a3a;">Enlace inválido o vencido</h2>
                    <p>Solicita un nuevo correo de verificación o contacta a soporte.</p>
                </div>
            `);
        }

        const id_usuario = rows[0].id_usuario;
        db.query(
            "UPDATE usuarios SET verificado = 1, token_verificacion = NULL, token_expira = NULL WHERE id_usuario = ?",
            [id_usuario],
            (err) => {
                if (err) return res.status(500).send('Error al verificar la cuenta.');

                res.send(`
                    <div style="font-family: Arial, sans-serif; text-align:center; margin-top:60px;">
                        <h2 style="color:#0f9d8e;">¡Cuenta verificada con éxito!</h2>
                        <p>Ya puedes iniciar sesión en MIGO.</p>
                        <a href="${FRONTEND_URL}/login" style="display:inline-block; margin-top:16px; background:#0f9d8e; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold;">
                            Ir a iniciar sesión
                        </a>
                    </div>
                `);
            }
        );
    });
});

// Obtener perfil de usuario
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

// ✅ Login de usuario (acepta rol 'usuario' y 'administrador', requiere cuenta verificada)
app.post('/api/login', (req, res) => {
  const { correo, contrasena } = req.body;

  const sql = `
      SELECT id_usuario, nombre, rol, verificado 
      FROM usuarios 
      WHERE correo = ? AND contrasena = ?
  `;
  db.query(sql, [correo, contrasena], (err, results) => {
    if (err) return res.status(500).json({ message: 'Error de servidor' });

    if (results.length > 0) {
      const usuario = results[0];

      if (usuario.rol !== 'usuario' && usuario.rol !== 'administrador') {
        registrarLogLoginFallido(correo, "Intento de login con rol no permitido en este formulario: " + usuario.rol);
        return res.status(403).json({
          message: 'Este correo pertenece a un veterinario, no a un usuario.',
          rol: usuario.rol
        });
      }

      if (usuario.verificado === 0) {
        registrarLogLoginFallido(correo, "Intento de login con cuenta no verificada");
        return res.status(403).json({
          message: 'Debes verificar tu cuenta antes de iniciar sesión. Revisa tu correo.'
        });
      }

      delete usuario.verificado;
      res.json(usuario);
    } else {
      registrarLogLoginFallido(correo, "Credenciales incorrectas en login de usuario");
      res.status(401).json({ message: 'Credenciales incorrectas' });
    }
  });
});

// Actualizar perfil de usuario
app.put('/api/usuarios/:id_usuario', (req, res) => {
    const { id_usuario } = req.params;
    const { nombre, apellido, correo, telefono, direccion, id_colonia } = req.body;

    const sql = `
        UPDATE usuarios 
        SET nombre = ?, apellido = ?, correo = ?, telefono = ?, direccion = ?, id_colonia = ?
        WHERE id_usuario = ?
    `;
    db.query(sql, [nombre, apellido, correo, telefono, direccion, id_colonia, id_usuario], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ message: "Usuario no encontrado" });
        res.json({ message: "Perfil actualizado correctamente" });
    });
});

// Colonias
app.get('/api/colonias', (req, res) => {
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


////////Publicaciones////////

// GET publicaciones — incluye IDs raw para poder editar desde el frontend
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

// ✅ Crear nueva publicación
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

// Subir foto de publicación
app.post('/api/fotos/:id_publi', upload.single('foto'), (req, res) => {
    const id_publi = req.params.id_publi;
    if (!req.file) return res.status(400).json({ message: 'No se subió archivo' });

    const ruta = `/uploads/${req.file.filename}`;
    const sql = 'INSERT INTO fotos_publi (id_publi, ruta_imagen) VALUES (?, ?)';
    db.query(sql, [id_publi, ruta], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Foto subida', ruta_imagen: ruta });
    });
});


////////VETERINARIO////////

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

// ✅ Registro de veterinario — ahora también requiere verificar el correo
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
    const { nombre_establecimiento, descripcion, correo_negocio, telefono_local, id_colonia, imagen_logo, sitio_web } = req.body;
    const sql = `
        UPDATE veterinarias 
        SET nombre_establecimiento = ?, descripcion = ?, correo_negocio = ?, 
            telefono_local = ?, id_colonia = ?, imagen_logo = ?, sitio_web = ?
        WHERE id_vet = ?
    `;
    db.query(sql, [nombre_establecimiento, descripcion, correo_negocio, telefono_local, id_colonia, imagen_logo, sitio_web, req.params.id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ message: "Veterinaria no encontrada" });
        res.json({ message: "Veterinaria actualizada correctamente" });
    });
});

// Subir logo de veterinaria
app.post('/api/veterinarias/:id/logo', upload.single('logo'), (req, res) => {
    const id_vet = req.params.id;
    if (!req.file) return res.status(400).json({ message: 'No se subió archivo' });

    const ruta = `/uploads/${req.file.filename}`;
    db.query('UPDATE veterinarias SET imagen_logo = ? WHERE id_vet = ?', [ruta, id_vet], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ message: "Veterinaria no encontrada" });
        res.json({ message: 'Logo actualizado correctamente', imagen_logo: ruta });
    });
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

// ✅ Publicar reseña
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

////////ADMINISTRADOR////////

function verificarAdmin(id_admin, callback) {
    db.query("SELECT rol FROM usuarios WHERE id_usuario = ?", [id_admin], (err, rows) => {
        if (err) return callback(err, false);
        if (rows.length === 0 || rows[0].rol !== 'administrador') return callback(null, false);
        callback(null, true);
    });
}

function enviarAvisoAdministrativo(correoDestino, nombreUsuario, motivo, esEliminacion) {
    const asunto = esEliminacion ? 'Aviso importante: Publicación eliminada' : 'Advertencia de MIGO';
    const titulo = esEliminacion ? 'Publicación eliminada por incumplimiento' : 'Aviso de advertencia';
    const mensaje = esEliminacion 
        ? `Lamentamos informarte que tu publicación ha sido eliminada debido a: <strong>${motivo}</strong>.`
        : `Hemos recibido un reporte sobre tu comportamiento en la plataforma. Motivo: <strong>${motivo}</strong>.`;

    transporter.sendMail({
        from: '"MIGO - Administración" <bruno19benitez@gmail.com>',
        to: correoDestino,
        subject: asunto,
        html: `<div style="font-family: Arial, sans-serif; color: #223338;">
                <h2 style="color: #d35400;">${titulo}</h2>
                <p>Hola <strong>${nombreUsuario}</strong>,</p>
                <p>${mensaje}</p>
               </div>`
    }).catch(err => console.error("Error enviando correo:", err)); // Agregamos catch para que no detenga el servidor
}

// Eliminar cualquier publicación (sin validar dueño, solo que quien pide sea admin)
app.delete('/api/admin/publicaciones/:id_publi', (req, res) => {
    const { id_publi } = req.params;
    const { id_admin } = req.body;

    verificarAdmin(id_admin, (err, esAdmin) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!esAdmin) return res.status(403).json({ message: "No tienes permisos" });

        // 1. Obtener datos del usuario ANTES de borrar
        db.query("SELECT u.correo, u.nombre FROM usuarios u JOIN publicaciones p ON u.id_usuario = p.id_usuario WHERE p.id_publi = ?", [id_publi], (err, results) => {
            const usuario = results[0];

            db.query("DELETE FROM fotos_publi WHERE id_publi = ?", [id_publi], () => {
                db.query("DELETE FROM comentarios WHERE id_publi = ?", [id_publi], () => {
                    db.query("DELETE FROM publicaciones WHERE id_publi = ?", [id_publi], (err, result) => {
                        if (err) return res.status(500).json({ error: err.message });
                        if (result.affectedRows === 0) return res.status(404).json({ message: "No encontrada" });

                        // 2. Enviar correo si encontramos al usuario
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

        // 1. Obtener datos del usuario a reportar
        db.query("SELECT correo, nombre FROM usuarios WHERE id_usuario = ?", [id_usuario_reportado], (err, results) => {
            const usuario = results[0];

            db.query("INSERT INTO reportes_usuario (id_usuario_reportado, id_admin, motivo) VALUES (?, ?, ?)", [id_usuario_reportado, id_admin, motivo], (err) => {
                db.query("UPDATE usuarios SET estado = 'reportado' WHERE id_usuario = ?", [id_usuario_reportado], (err) => {
                    
                    // 2. Enviar correo de advertencia
                    if (usuario) {
                        enviarAvisoAdministrativo(usuario.correo, usuario.nombre, motivo, false);
                    }
                    res.json({ message: "Usuario reportado y notificado" });
                });
            });
        });
    });
});

// Listado de reportes hechos (opcional, útil para un historial en el panel)
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
    // Ajusta 'admin' al valor exacto que usas en tu base de datos para identificar al administrador
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
        // 1) Fotos de las publicaciones del usuario (hijo de publicaciones)
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

        // 3) Reseñas hechas por el usuario (a veterinarias)
        await executeQuery("DELETE FROM resenas WHERE id_usuario = ?", [id]);

        // 4) Ahora sí, las publicaciones del usuario
        await executeQuery("DELETE FROM publicaciones WHERE id_usuario = ?", [id]);

        // 5) Si el usuario es veterinario: reseñas A su vet, horarios, servicios y la veterinaria
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

app.listen(4000, () => console.log('Migo corriendo  🏃‍♂️'));