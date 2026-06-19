USE migo_db_VUE;

-- 🔹 Colonias
INSERT INTO colonias (nombre) VALUES
('Aviación'),
('Balamtun'),
('Bali'),
('Bellavista'),
('Bosque de Cristo Rey'),
('Bosque Real'),
('Brisas'),
('Calica'),
('Campestre'),
('Cataluña'),
('Corales'),
('Cruz de Servicios'),
('Dunas'),
('Ejidal'),
('El Bambú'),
('El Cantil'),
('El Cielo'),
('El Pedregal'),
('El Petén'),
('El Tigrillo'),
('Forjadores'),
('Fundadores'),
('Galaxia del Carmen I'),
('Galaxia del Carmen II'),
('Gonzalo Guerrero'),
('INFONAVIT Colosio'),
('INFONAVIT Gaviotas'),
('In House'),
('La Ceiba'),
('La Guadalupana'),
('La Joya'),
('La Joya Xamanha'),
('Las Flores'),
('Las Palmas'),
('La Toscana'),
('Lolkaatun'),
('Loltun'),
('Los Arrecifes'),
('Los Olivos'),
('Luis Donaldo Colosio'),
('Miramar'),
('Misión del Carmen'),
('Misión Las Flores'),
('Misión Villamar I'),
('Misión Villamar II'),
('Mundo Habitat'),
('Nicte-ha'),
('Nueva Creación'),
('Nuevo Centro Urbano'),
('Paraíso del Carmen'),
('Parque Residencial'),
('Playa Azul'),
('Playa Car Fase I'),
('Playa Car Fase II'),
('Playa del Carmen'),
('Playa del Carmen Centro'),
('Playa Magna'),
('Playa Oasis'),
('Playa Sol'),
('Privanza del Mar'),
('Punta Estrella'),
('Quintas del Carmen'),
('Real Ibiza'),
('Residencial Bambú'),
('Residencial La Escondida'),
('Residencial Real del Sol'),
('Sacpacal'),
('Santa Fe del Carmen'),
('Selvamar'),
('Supermanzana 52'),
('Tohoku'),
('Vela Mar'),
('Villas del Carmen'),
('Villas del Sol "Plus"'),
('Villas Maya'),
('Villas Riviera'),
('Xamanha'),
('Zazil Ha'),
('Zona Industrial');



-- 🔹 Tipos de publicación
INSERT INTO tipos_publi (nombre) VALUES
('Se busca'),
('Adopción');

-- 🔹 Estados de publicación
INSERT INTO estados_publi (nombre) VALUES
('Activo'),
('Cerrado');

-- 🔹 Especies
INSERT INTO especies (nombre) VALUES
('Perro'),
('Gato'),
('Ave'),
('Otro');


-- 🔹 Días de la semana
INSERT INTO dias_semana (nombre) VALUES
('Lunes'),
('Martes'),
('Miércoles'),
('Jueves'),
('Viernes'),
('Sábado'),
('Domingo');



---------------------------------
--Ejemplos--
---------------------------------

-- 🔹 Servicios
INSERT INTO servicios (nombre) VALUES
('Consulta general'),
('Vacunación'),
('Cirugía'),
('Estética animal');

-- 🔹 Usuarios
INSERT INTO usuarios (nombre, apellido, correo, contrasena, telefono, direccion, id_colonia, rol)
VALUES
('Juan', 'Pérez', 'juan@example.com', '1234', '555-1111', 'Calle 1', 1, 'usuario'),
('María', 'López', 'maria@example.com', '1234', '555-2222', 'Calle 2', 2, 'usuario'),
('Carlos', 'Ramírez', 'carlos@example.com', '1234', '555-3333', 'Calle 3', 3, 'veterinario');

-- 🔹 Veterinarias
INSERT INTO veterinarias (id_usuario, nombre_establecimiento, descripcion, imagen_logo, sitio_web)
VALUES
(3, 'VetCare', 'Clínica veterinaria integral', 'logo_vetcare.png', 'http://vetcare.com');



-- 🔹 Publicaciones
INSERT INTO publicaciones (id_usuario, id_colonia, id_especie, id_tipo, id_estado, nombre_pet, descripcion)
VALUES
(1, 1, 1, 1, 1, 'Firulais', 'Se busca perro perdido en Las Palmas'),
(2, 2, 2, 2, 1, 'Mishi', 'Gatita en adopción en Centro');


-- 🔹 Fotos de publicaciones
INSERT INTO fotos_publi (id_publi, ruta_imagen)
VALUES
(1, '/uploads/firulais.jpg'),
(2, '/uploads/mishi.jpg');

-- 🔹 Reseñas
INSERT INTO resenas (id_usuario, id_vet, calificacion, comentario)
VALUES
(1, 1, 5, 'Excelente atención y trato'),
(2, 1, 4, 'Muy buena clínica, aunque algo cara');


-- 🔹 Horarios de veterinarias
INSERT INTO horarios_vet (id_vet, id_dia, hora_apertura, hora_cierre, cerrado)
VALUES
(1, 1, '09:00:00', '18:00:00', 0),
(1, 7, NULL, NULL, 1);

-- 🔹 Veterinaria - Servicios (Many-to-Many)
INSERT INTO vet_servicios (id_vet, id_servicio)
VALUES
(1, 1),
(1, 2),
(1, 3);

-- 🔹 Veterinaria - Especies (Many-to-Many)
INSERT INTO vet_especies (id_vet, id_especie)
VALUES
(1, 1),
(1, 2);