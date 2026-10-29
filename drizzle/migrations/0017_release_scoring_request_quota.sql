CREATE FUNCTION public.allow_evaluation(p_room uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN PERFORM public._me(p_room); RETURN public._release_limit('evaluation',20,60); END $$;
REVOKE EXECUTE ON FUNCTION public.allow_evaluation(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.allow_evaluation(uuid) TO authenticated;