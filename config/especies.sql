BEGIN
  ORDS.DEFINE_MODULE(
    p_module_name    => 'especies_api',
    p_base_path      => '/especies/',
    p_items_per_page => 25
  );

  -- GET todas las especies
  ORDS.DEFINE_TEMPLATE(p_module_name => 'especies_api', p_pattern => '/');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'especies_api',
    p_pattern     => '/',
    p_method      => 'GET',
    p_source_type => 'collection',
    p_source      => 'SELECT * FROM ESPECIES'
  );

  -- POST crear especie
  ORDS.DEFINE_HANDLER(
    p_module_name => 'especies_api',
    p_pattern     => '/',
    p_method      => 'POST',
    p_source_type => 'plsql',
    p_source      => 'INSERT INTO ESPECIES (NOMBRE) VALUES (:NOMBRE)'
  );
END;
/
