DO $$ DECLARE d text; o text; BEGIN
 d:=pg_get_functiondef('public.generate_pool(uuid,integer)'::regprocedure); o:=d;
 d:=replace(d,'    SELECT id,grp INTO pick FROM _pool_cand WHERE NOT picked AND CASE c.k WHEN ''spin'' THEN spin WHEN ''pace'' THEN pace WHEN ''indian'' THEN indian ELSE role=c.k END
      AND ((grp=''performance'' AND est_left>0) OR (grp=''emerging'' AND em_left>0)) ORDER BY random() LIMIT 1;',
 '    -- Choose the group in proportion to its remaining quota, then a uniform player within it.
    SELECT id,grp INTO pick FROM _pool_cand WHERE NOT picked AND CASE c.k WHEN ''spin'' THEN spin WHEN ''pace'' THEN pace WHEN ''indian'' THEN indian ELSE role=c.k END
      AND ((grp=''performance'' AND est_left>0) OR (grp=''emerging'' AND em_left>0))
      ORDER BY (grp=CASE WHEN random()*(est_left+em_left)<est_left THEN ''performance'' ELSE ''emerging'' END) DESC, random() LIMIT 1;');
 d:=replace(d,'FOR attempt IN 1..40 LOOP','FOR attempt IN 1..200 LOOP');
 IF d=o OR position('remaining quota' in d)=0 OR position('1..200' in d)=0 THEN RAISE EXCEPTION 'generate_pool prerequisite not found'; END IF;
 EXECUTE d;
END $$;