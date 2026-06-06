BEGIN
  ORDS.DEFINE_MODULE(
    p_module_name    => 'tipos_publi_api',
    p_base_path      => '/tipos_publi/',
    p_items_per_page => 25
  );

  -- GET todos los tipos
  ORDS.DEFINE_TEMPLATE(p_module_name => 'tipos_publi_api', p_pattern => '/');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'tipos_publi_api',
    p_pattern     => '/',
    p_method      => 'GET',
    p_source_type => 'collection',
    p_source      => 'SELECT * FROM TIPOS_PUBLI'
  );

  -- POST crear tipo
  ORDS.DEFINE_HANDLER(
    p_module_name => 'tipos_publi_api',
    p_pattern     => '/',
    p_method      => 'POST',
    p_source_type => 'plsql',
    p_source      => 'INSERT INTO TIPOS_PUBLI (NOMBRE) VALUES (:NOMBRE)'
  );
END;
/
