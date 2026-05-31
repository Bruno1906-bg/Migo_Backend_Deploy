# MIGO Backend

Backend académico desarrollado con **Oracle Autonomous Database** y **Oracle REST Data Services (ORDS)**.  
Este proyecto implementa un **API REST** para la gestión de usuarios y colonias, incluyendo operaciones CRUD y un servicio de login funcional.

## Tecnologías utilizadas
- Oracle Autonomous Database
- Oracle REST Data Services (ORDS)
- SQL (definición de tablas y consultas)
- JSON (formato de intercambio de datos)

## Endpoints principales
### Usuarios
- `GET /usuarios/` → Lista todos los usuarios
- `GET /usuarios/:id` → Obtiene un usuario específico
- `POST /usuarios/` → Crea un nuevo usuario
- `PUT /usuarios/:id` → Actualiza un usuario existente
- `DELETE /usuarios/:id` → Elimina un usuario

### Colonias
- `GET /colonias/` → Lista todas las colonias
- `GET /colonias/:id` → Obtiene una colonia específica

### Login
- `POST /usuarios_api/login/`  
  **Body (JSON):**
  ```json
  {
    "correo": "usuario@example.com",
    "contrasena": "ClaveSegura123"
  }
  ```

  **Respuesta exitosa:**
  ```json
  {
    "status": "success",
    "id_usuario": 1,
    "nombre": "Bryan",
    "rol": "ciudadano",
    "estado_cuenta": "activo"
  }
  ```

## Documentación
- Scripts SQL para creación de tablas y datos de prueba en `/sql`
- Colección de Postman para pruebas en `/docs`
- Ejemplos de consumo en PHP y JavaScript en `/examples`

---