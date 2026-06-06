Perfecto Bryan 🙌, aquí tienes el archivo **`api_endpoints.md`** actualizado y completo con todos los módulos y rutas que definimos. Lo puedes copiar directamente en tu carpeta `/docs` para reemplazar el anterior:

```markdown
# Documentación de Endpoints - MIGO Backend

Base URL:  
`https://ga6f1d821261f2a-migodb.adb.mx-queretaro-1.oraclecloudapps.com/ords/migo_user/`

---

## Usuarios
- **GET** → `/usuarios/` → Lista todos los usuarios  
- **GET** → `/usuarios/{id}` → Obtiene un usuario específico  
- **POST** → `/usuarios/` → Crea un nuevo usuario  
- **PUT** → `/usuarios/{id}` → Actualiza un usuario existente  
- **DELETE** → `/usuarios/{id}` → Elimina un usuario  

---

## Colonias
- **GET** → `/colonias/` → Lista todas las colonias  
- **GET** → `/colonias/{id}` → Obtiene una colonia específica  
- **POST** → `/colonias/` → Crea una nueva colonia  

---

## Publicaciones
- **GET** → `/publicaciones/` → Lista todas las publicaciones  
- **GET** → `/publicaciones/{id}` → Obtiene una publicación específica  
- **POST** → `/publicaciones/` → Crea una nueva publicación  
- **PUT** → `/publicaciones/{id}` → Actualiza una publicación existente  
- **DELETE** → `/publicaciones/{id}` → Elimina una publicación  

---

## Fotos de Publicaciones
- **GET** → `/publicaciones/{id}/fotos` → Lista todas las fotos de una publicación  
- **POST** → `/publicaciones/{id}/fotos` → Sube una nueva foto asociada a una publicación  
- **GET** → `/fotos/{id}` → Obtiene detalle de una foto específica  
- **DELETE** → `/fotos/{id}` → Elimina una foto  

---

## Catálogos
- **GET** → `/especies/` → Lista todas las especies  
- **POST** → `/especies/` → Crea una nueva especie  
- **GET** → `/tipos_publi/` → Lista todos los tipos de publicación  
- **POST** → `/tipos_publi/` → Crea un nuevo tipo de publicación  
- **GET** → `/estados_publi/` → Lista todos los estados de publicación  
- **POST** → `/estados_publi/` → Crea un nuevo estado de publicación  

---

## Login
- **POST** → `/login/`  

**Body ejemplo:**
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
  "rol": "usuario",
  "estado_cuenta": "activo"
}
```

**Respuesta error:**
```json
{
  "status": "error",
  "message": "Credenciales inválidas"
}
```

---

## Notas
- Todos los endpoints requieren **Content-Type: application/json** en el header.  
- Los IDs se pasan en la URL como parámetro (`{id}`).  
```