BEGIN
  ORDS.DEFINE_MODULE(
    p_module_name    => 'usuarios_api',
    p_base_path      => '/usuarios/',
    p_items_per_page => 25
  );

  -- GET todos los usuarios
  ORDS.DEFINE_TEMPLATE(p_module_name => 'usuarios_api', p_pattern => '/');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'usuarios_api',
    p_pattern     => '/',
    p_method      => 'GET',
    p_source_type => 'collection',
    p_source      => 'SELECT * FROM USUARIOS'
  );

  -- GET usuario por ID
  ORDS.DEFINE_TEMPLATE(p_module_name => 'usuarios_api', p_pattern => '{id}');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'usuarios_api',
    p_pattern     => '{id}',
    p_method      => 'GET',
    p_source_type => 'item',
    p_source      => 'SELECT * FROM USUARIOS WHERE ID_USUARIO=:id'
  );

  -- POST crear usuario
  ORDS.DEFINE_HANDLER(
    p_module_name => 'usuarios_api',
    p_pattern     => '/',
    p_method      => 'POST',
    p_source_type => 'plsql',
    p_source      => q'[
      INSERT INTO USUARIOS (NOMBRE, APELLIDO, CORREO, CONTRASENA, TELEFONO, DIRECCION, ID_COLONIA, ROL, ESTADO_CUENTA)
      VALUES (:NOMBRE, :APELLIDO, :CORREO, :CONTRASENA, :TELEFONO, :DIRECCION, :ID_COLONIA, :ROL, :ESTADO_CUENTA);
    ]'
  );

  -- PUT actualizar usuario
  ORDS.DEFINE_HANDLER(
    p_module_name => 'usuarios_api',
    p_pattern     => '{id}',
    p_method      => 'PUT',
    p_source_type => 'plsql',
    p_source      => q'[
      UPDATE USUARIOS
      SET NOMBRE=:NOMBRE, APELLIDO=:APELLIDO, CORREO=:CORREO, CONTRASENA=:CONTRASENA,
          TELEFONO=:TELEFONO, DIRECCION=:DIRECCION, ID_COLONIA=:ID_COLONIA, ROL=:ROL, ESTADO_CUENTA=:ESTADO_CUENTA
      WHERE ID_USUARIO=:id;
    ]'
  );

  -- DELETE eliminar usuario
  ORDS.DEFINE_HANDLER(
    p_module_name => 'usuarios_api',
    p_pattern     => '{id}',
    p_method      => 'DELETE',
    p_source_type => 'plsql',
    p_source      => 'DELETE FROM USUARIOS WHERE ID_USUARIO=:id'
  );
END;
/
