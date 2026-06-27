CREATE DATABASE IF NOT EXISTS migo_db_VUE;
USE migo_db_VUE;

-- Tablas maestras (sin dependencias)
CREATE TABLE IF NOT EXISTS colonias (
    id_colonia INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS tipos_publi (
    id_tipo INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS estados_publi (
    id_estado INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS especies (
    id_especie INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS servicios (
    id_servicio INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS dias_semana (
    id_dia INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(20) NOT NULL
);

-- Tablas con dependencias iniciales
CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    correo VARCHAR(255) NOT NULL,
    contrasena VARCHAR(255) NOT NULL,
    telefono VARCHAR(20),
    direccion VARCHAR(255),
    id_colonia INT,
    rol VARCHAR(20) NOT NULL,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_colonia) REFERENCES colonias(id_colonia)
);

CREATE TABLE IF NOT EXISTS veterinarias (
    id_vet INT PRIMARY KEY AUTO_INCREMENT,
    id_usuario INT NOT NULL,
    nombre_establecimiento VARCHAR(150) NOT NULL,
    descripcion TEXT,
    imagen_logo VARCHAR(255),
    sitio_web VARCHAR(255),
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
);

-- Tablas de publicaciones y relaciones
CREATE TABLE IF NOT EXISTS publicaciones (
    id_publi INT PRIMARY KEY AUTO_INCREMENT,
    id_usuario INT NOT NULL,
    id_colonia INT NOT NULL,
    id_especie INT NOT NULL,
    id_tipo INT NOT NULL,
    id_estado INT NOT NULL,
    nombre_pet VARCHAR(100) NOT NULL,
    descripcion TEXT NOT NULL,
    fecha_publi DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
    FOREIGN KEY (id_colonia) REFERENCES colonias(id_colonia),
    FOREIGN KEY (id_especie) REFERENCES especies(id_especie),
    FOREIGN KEY (id_tipo) REFERENCES tipos_publi(id_tipo),
    FOREIGN KEY (id_estado) REFERENCES estados_publi(id_estado)
);

CREATE TABLE IF NOT EXISTS fotos_publi (
    id_foto INT PRIMARY KEY AUTO_INCREMENT,
    id_publi INT NOT NULL,
    ruta_imagen VARCHAR(255) NOT NULL,
    fecha_carga DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_publi) REFERENCES publicaciones(id_publi)
);

CREATE TABLE IF NOT EXISTS resenas (
    id_resena INT PRIMARY KEY AUTO_INCREMENT,
    id_usuario INT NOT NULL,
    id_vet INT NOT NULL,
    calificacion TINYINT NOT NULL,
    comentario TEXT,
    fecha_resena DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
    FOREIGN KEY (id_vet) REFERENCES veterinarias(id_vet)
);

CREATE TABLE IF NOT EXISTS horarios_vet (
    id_horario INT PRIMARY KEY AUTO_INCREMENT,
    id_vet INT NOT NULL,
    id_dia INT NOT NULL,
    hora_apertura TIME,
    hora_cierre TIME,
    cerrado TINYINT(1) DEFAULT 0,
    FOREIGN KEY (id_vet) REFERENCES veterinarias(id_vet),
    FOREIGN KEY (id_dia) REFERENCES dias_semana(id_dia)
);

-- Tablas intermedias (Many-to-Many)
CREATE TABLE IF NOT EXISTS vet_servicios (
    id_vet INT NOT NULL,
    id_servicio INT NOT NULL,
    PRIMARY KEY (id_vet, id_servicio),
    FOREIGN KEY (id_vet) REFERENCES veterinarias(id_vet),
    FOREIGN KEY (id_servicio) REFERENCES servicios(id_servicio)
);

-------------------------------
--Cambios o modificaciones DB--
-------------------------------

--Modificaciones importantes para tabla de usuarios
ALTER TABLE usuarios ADD UNIQUE (correo);

--Mas modificaciones
ALTER TABLE veterinarias ADD COLUMN id_colonia INT;

ALTER TABLE veterinarias 
ADD CONSTRAINT fk_vet_colonia 
FOREIGN KEY (id_colonia) REFERENCES colonias(id_colonia);

-- Cambios tabla  VETERINARIAS 
ALTER TABLE veterinarias 
ADD COLUMN correo_negocio VARCHAR(255),
ADD COLUMN telefono_local VARCHAR(20);

--TABLA DE COMENTARIOS PARA PUBLICACIONES
CREATE TABLE comentarios (
    id_comentario INT AUTO_INCREMENT PRIMARY KEY,
    id_publi INT NOT NULL,
    id_usuario INT NOT NULL,
    comentario TEXT NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_publi) REFERENCES publicaciones(id_publi) ON DELETE CASCADE,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
);

--TABLA DE LOGS PARA REGISTRO DE ACCIONES
CREATE TABLE logs (
  id_log INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NULL,
  accion VARCHAR(100) NOT NULL,
  detalle TEXT,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- Cambios importantes tabla horarios
ALTER TABLE horarios_vet 
ADD CONSTRAINT unique_vet_dia UNIQUE (id_vet, id_dia);