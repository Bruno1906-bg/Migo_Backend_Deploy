BEGIN
  ORDS.DEFINE_MODULE(
    p_module_name    => 'fotos_publi_api',
    p_base_path      => '/fotos/',
    p_items_per_page => 25
  );

  -- GET fotos por publicación
  ORDS.DEFINE_TEMPLATE(p_module_name => 'fotos_publi_api', p_pattern => '/publicaciones/{id}/fotos');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'fotos_publi_api',
    p_pattern     => '/publicaciones/{id}/fotos',
    p_method      => 'GET',
    p_source_type => 'collection',
    p_source      => 'SELECT * FROM FOTOS_PUBLI WHERE ID_PUBLI=:id'
  );

  -- POST subir foto
  ORDS.DEFINE_HANDLER(
    p_module_name => 'fotos_publi_api',
    p_pattern     => '/publicaciones/{id}/fotos',
    p_method      => 'POST',
    p_source_type => 'plsql',
    p_source      => 'INSERT INTO FOTOS_PUBLI (ID_PUBLI, RUTA_IMAGEN) VALUES (:id, :RUTA_IMAGEN)'
  );

  -- GET detalle de foto
  ORDS.DEFINE_TEMPLATE(p_module_name => 'fotos_publi_api', p_pattern => '{id}');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'fotos_publi_api',
    p_pattern     => '{id}',
    p_method      => 'GET',
    p_source_type => 'item',
    p_source      => 'SELECT * FROM FOTOS_PUBLI WHERE ID_FOTO=:id'
  );

  -- DELETE foto
  ORDS.DEFINE_HANDLER(
    p_module_name => 'fotos_publi_api',
    p_pattern     => '{id}',
    p_method      => 'DELETE',
    p_source_type => 'plsql',
    p_source      => 'DELETE FROM FOTOS_PUBLI WHERE ID_FOTO=:id'
  );
END;
/
