CREATE OR REPLACE FUNCTION public._new_room_v3() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF NEW.pool_rules IS NOT NULL THEN NEW.evaluation_version:='v3.0'; END IF; RETURN NEW; END $$;
CREATE TRIGGER zz_new_room_v3 BEFORE INSERT ON public.rooms FOR EACH ROW EXECUTE FUNCTION public._new_room_v3();
REVOKE EXECUTE ON FUNCTION public._new_room_v3() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE d text; o text; BEGIN
 d:=pg_get_functiondef('public._freeze_evaluation_inputs()'::regprocedure); o:=d;
 d:=replace(d,'NEW.evaluation_version IN (''v2.0'',''v2.1'')','NEW.evaluation_version IN (''v2.0'',''v2.1'',''v3.0'')');
 d:=replace(d,'jsonb_build_object(''weights'',CASE WHEN NEW.evaluation_version=''v2.1'' THEN','jsonb_build_object(''weights'',CASE WHEN NEW.evaluation_version=''v3.0'' THEN ''{"batting":50,"bowling":50,"descriptive":true}''::jsonb WHEN NEW.evaluation_version=''v2.1'' THEN');
 d:=replace(d,'CASE WHEN NEW.evaluation_version=''v2.1'' THEN jsonb_build_object(''leadership''','CASE WHEN NEW.evaluation_version IN (''v2.1'',''v3.0'') THEN jsonb_build_object(''leadership''');
 IF d=o OR position('v3.0'' THEN ''{"batting"' in d)=0 OR position('IN (''v2.1'',''v3.0'') THEN jsonb_build_object(''leadership''' in d)=0 THEN RAISE EXCEPTION 'freeze prerequisite not found'; END IF; EXECUTE d;
 d:=pg_get_functiondef('public.commit_room_evaluation(uuid,uuid,text,jsonb)'::regprocedure); o:=d;
 d:=replace(d,'r.evaluation_version NOT IN (''v2.0'',''v2.1'')','r.evaluation_version NOT IN (''v2.0'',''v2.1'',''v3.0'')');
 IF d=o THEN RAISE EXCEPTION 'commit prerequisite not found'; END IF; EXECUTE d;
 d:=pg_get_functiondef('public.evaluation_holdings_hash(uuid)'::regprocedure); o:=d;
 d:=replace(d,'IF v=''v2.1'' THEN','IF v IN (''v2.1'',''v3.0'') THEN');
 IF d=o THEN RAISE EXCEPTION 'hash prerequisite not found'; END IF; EXECUTE d;
 d:=pg_get_functiondef('public.submit_evaluation_lineup(uuid,uuid[],uuid,uuid,boolean)'::regprocedure); o:=d;
 d:=replace(d,'r.evaluation_version<>''v2.1''','r.evaluation_version NOT IN (''v2.1'',''v3.0'')');
 IF d=o THEN RAISE EXCEPTION 'lineup prerequisite not found'; END IF; EXECUTE d;
END $$;