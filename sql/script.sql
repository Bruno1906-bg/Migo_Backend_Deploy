-- Crear base de datos
CREATE DATABASE IF NOT EXISTS migo_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE migo_db;

-- Tabla colonias
CREATE TABLE colonias (
    id_colonia INT AUTO_INCREMENT PRIMARY KEY,
    nombre_colonia VARCHAR(100) NOT NULL
);

-- Tabla especies
CREATE TABLE especies (
    id_especie INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL
);

-- Tabla tipos_publi
CREATE TABLE tipos_publi (
    id_tipo INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL
);

-- Tabla estados_publi
CREATE TABLE estados_publi (
    id_estado INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL
);

-- Tabla usuarios
CREATE TABLE usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    correo VARCHAR(255) NOT NULL UNIQUE,
    contrasena VARCHAR(255) NOT NULL,
    telefono VARCHAR(20),
    direccion VARCHAR(255),
    id_colonia INT NOT NULL,
    rol ENUM('usuario','veterinario') NOT NULL,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_colonia) REFERENCES colonias(id_colonia)
);

-- Tabla publicaciones
CREATE TABLE publicaciones (
    id_publi INT AUTO_INCREMENT PRIMARY KEY,
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

-- Tabla fotos_publi
CREATE TABLE fotos_publi (
    id_foto INT AUTO_INCREMENT PRIMARY KEY,
    id_publi INT NOT NULL,
    ruta_imagen TEXT NOT NULL, -- se usa TEXT para almacenar base64 o URLs largas
    fecha_carga DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_publi) REFERENCES publicaciones(id_publi)
);
