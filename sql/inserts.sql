
-- Migo Backend - SQL Inserts Importantes para el funcionamiento de la aplicación

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


