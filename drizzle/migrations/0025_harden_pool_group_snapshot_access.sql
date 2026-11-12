-- Scope pool-group reads to the same authenticated snapshot access as evidence.
-- Remove inherited write privileges: RLS does not protect TRUNCATE.
REVOKE ALL PRIVILEGES ON TABLE public.pool_groups FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.pool_groups TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.pool_groups TO service_role;
ALTER POLICY "Signed-in players read pool groups" ON public.pool_groups
  TO authenticated USING (public.can_read_snapshot(snapshot_id));

-- Fail closed if inherited role or PUBLIC privileges defeat the intended ACL.
DO $$
DECLARE role_name text; privilege_name text;
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.pool_groups'::regclass) THEN
    RAISE EXCEPTION 'pool_groups must retain RLS';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
    WHERE c.oid='public.pool_groups'::regclass AND a.grantee=0
  ) THEN
    RAISE EXCEPTION 'pool_groups must not grant PUBLIC privileges';
  END IF;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    FOREACH privilege_name IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
      IF has_table_privilege(role_name,'public.pool_groups',privilege_name)
         IS DISTINCT FROM (role_name='authenticated' AND privilege_name='SELECT') THEN
        RAISE EXCEPTION 'Unexpected effective pool_groups privilege: % %',role_name,privilege_name;
      END IF;
    END LOOP;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
    WHERE c.oid='public.pool_groups'::regclass
      AND a.grantee IN ('anon'::regrole,'authenticated'::regrole)
      AND (a.privilege_type<>'SELECT' OR a.is_grantable)
  ) THEN
    RAISE EXCEPTION 'Unexpected direct or grantable pool_groups privilege';
  END IF;
  IF NOT has_table_privilege('service_role','public.pool_groups','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
    RAISE EXCEPTION 'Missing service pool_groups privileges';
  END IF;
  IF (SELECT count(*) FROM pg_policy WHERE polrelid='public.pool_groups'::regclass) <> 1
     OR NOT EXISTS (
       SELECT 1 FROM pg_policy WHERE polrelid='public.pool_groups'::regclass
         AND polcmd='r' AND polroles=ARRAY['authenticated'::regrole::oid]
         AND pg_get_expr(polqual,polrelid)='can_read_snapshot(snapshot_id)'
     ) THEN
    RAISE EXCEPTION 'Unexpected pool_groups read policy';
  END IF;
END $$;
