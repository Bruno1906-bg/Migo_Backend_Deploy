
-- Migo Backend - SQL Inserts Importantes para el funcionamiento de la aplicación

USE migo_db_VUE;

-- 🔹 Colonias
INSERT INTO colonias (nombre) VALUES
('Balamtun'),
('Bellavista'),
('Bosque de Cristo Rey'),
('Bosque Real'),
('Brisas'),
('Calica'),
('Cataluña'),
('Ejidal'),
('El Cantil'),
('El Pedregal'),
('El Petén'),
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
('Las Palmas'),,
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
('Paraíso del Carmen'),
('Playa Azul'),
('Playacar Fase I'),
('Playacar Fase II'),
('Playa del Carmen Centro'),
('Quintas del Carmen'),
('Real Ibiza'),
('Residencial Bambú'),
('Residencial La Escondida'),
('Residencial Real del Sol'),
('Palma Nova'),
('Selvamar'),
('Vela Mar'),
('Villas del Carmen'),
('Villas del Sol "Plus"'),
('Villas Maya'),
('Villas Riviera'),
('Zazil Ha');



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


