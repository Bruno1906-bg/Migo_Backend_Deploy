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
    database: 'migo_db_VUE'
});



// ENDPOINTS


///////USUARIO////////

// Crear usuario
app.post('/api/usuarios', (req, res) => {
    const { nombre, apellido, correo, contrasena, telefono, direccion, id_colonia, rol } = req.body;

    const checkSql = "SELECT id_usuario FROM usuarios WHERE correo = ?";
    db.query(checkSql, [correo], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows.length > 0) {
            return res.status(400).json({ error: "El correo ya está registrado" });
        }

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

// Actualizar perfil de usuario
app.put('/api/usuarios/:id_usuario', (req, res) => {
    const { id_usuario } = req.params;
    const { nombre, apellido, correo, telefono, direccion, id_colonia } = req.body;

    const sql = `
        UPDATE usuarios 
        SET nombre = ?, apellido = ?, correo = ?, telefono = ?, direccion = ?, id_colonia = ?
        WHERE id_usuario = ?
    `;

    const params = [nombre, apellido, correo, telefono, direccion, id_colonia, id_usuario];

    db.query(sql, params, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

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

// Publicaciones (Listar con los JOINs para obtener los nombres de usuario, colonia, especie, tipo y estado)
app.get('/api/publicaciones', (req, res) => {
    const sql = `
        SELECT p.id_publi, p.nombre_pet, p.descripcion, p.fecha_publi,
               u.id_usuario, u.nombre AS usuario, u.correo, u.telefono,
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


////////VETERINARIO////////

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
    const {
        nombre,
        apellido,
        correo,
        contrasena,
        id_colonia,
        nombre_establecimiento,
        direccion,
        telefono
    } = req.body;

    const checkSql = "SELECT id_usuario FROM usuarios WHERE correo = ?";
    db.query(checkSql, [correo], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows.length > 0) {
            return res.status(400).json({ error: "El correo ya está registrado" });
        }

        db.beginTransaction((err) => {
            if (err) return res.status(500).json({ error: "Error de conexión" });

            // ✅ Inserta datos del usuario con dirección y teléfono
            const sqlUser = `
                INSERT INTO usuarios (nombre, apellido, direccion, telefono, correo, contrasena, id_colonia, rol)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'veterinario')
            `;
            db.query(sqlUser, [nombre, apellido, direccion, telefono, correo, contrasena, id_colonia], (err, result) => {
                if (err) return db.rollback(() => res.status(500).json({ error: err.message }));

                const id_usuario = result.insertId;
                const sqlVet = `
                    INSERT INTO veterinarias (id_usuario, nombre_establecimiento, id_colonia)
                    VALUES (?, ?, ?)
                `;
                db.query(sqlVet, [id_usuario, nombre_establecimiento, id_colonia], (err) => {
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


// Veterinarias
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

// Actualizar datos de una veterinaria
app.put('/api/veterinarias/:id', (req, res) => {
    const {
        nombre_establecimiento,
        descripcion,
        correo_negocio,
        telefono_local,
        id_colonia,
        imagen_logo,
        sitio_web
    } = req.body;

    const sql = `
        UPDATE veterinarias 
        SET nombre_establecimiento = ?, 
            descripcion = ?, 
            correo_negocio = ?, 
            telefono_local = ?, 
            id_colonia = ?, 
            imagen_logo = ?, 
            sitio_web = ?
        WHERE id_vet = ?
    `;

    db.query(sql, [
        nombre_establecimiento,
        descripcion,
        correo_negocio,
        telefono_local,
        id_colonia,
        imagen_logo,
        sitio_web,
        req.params.id
    ], (err, result) => {
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
    const sql = 'UPDATE veterinarias SET imagen_logo = ? WHERE id_vet = ?';

    db.query(sql, [ruta, id_vet], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ message: "Veterinaria no encontrada" });
        res.json({ message: 'Logo actualizado correctamente', imagen_logo: ruta });
    });
});

//Obtener detalles de una veterinaria específica
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

//Obtener reseñas de una veterinaria
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

//Publicar Resenas
app.post('/api/resenas', (req, res) => {
    console.log("Datos recibidos en el servidor:", req.body); // <--- MIRA LA CONSOLA DEL SERVIDOR (NODE)

    const { id_vet, id_usuario, comentario, calificacion } = req.body;

    // Si alguno es undefined, aquí veremos qué falta
    if (!id_vet || !id_usuario) {
        return res.status(400).json({ message: "Faltan datos obligatorios" });
    }

    const sql = "INSERT INTO resenas (id_vet, id_usuario, comentario, calificacion) VALUES (?, ?, ?, ?)";
    db.query(sql, [id_vet, id_usuario, comentario, calificacion], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Reseña publicada con éxito' });
    });
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

//  Obtener comentarios
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

//  Publicar comentario
app.post('/api/comentarios', (req, res) => {
    const { id_publi, id_usuario, comentario } = req.body;
    const sql = "INSERT INTO comentarios (id_publi, id_usuario, comentario) VALUES (?, ?, ?)";
    db.query(sql, [id_publi, id_usuario, comentario], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Comentario publicado', id: result.insertId });
    });
});

//  Eliminar comentario 
app.delete('/api/comentarios/:id_comentario/:id_usuario', (req, res) => {
    const { id_comentario, id_usuario } = req.params;

    const sql = "DELETE FROM comentarios WHERE id_comentario = ? AND id_usuario = ?";
    db.query(sql, [id_comentario, id_usuario], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(403).json({ message: "No tienes permiso" });
        res.json({ message: 'Comentario eliminado' });
    });
});

// Editar comentario
app.put('/api/comentarios/:id_comentario', (req, res) => {
    const { comentario, id_usuario } = req.body;
    const { id_comentario } = req.params;

    const sql = "UPDATE comentarios SET comentario = ? WHERE id_comentario = ? AND id_usuario = ?";

    db.query(sql, [comentario, id_comentario, id_usuario], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) {
            return res.status(403).json({ message: "No tienes permiso para editar este comentario" });
        }
        res.json({ message: 'Comentario actualizado' });
    });
});

app.listen(4000, () => console.log('Servidor corriendo en puerto 4000 🏃‍♂️'));