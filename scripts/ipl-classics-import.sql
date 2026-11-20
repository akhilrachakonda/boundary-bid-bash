-- Apply after crickauction-import.sql. Existing rooms keep their pinned catalogue.
BEGIN;
DO $import$
DECLARE
 base constant text := 'crickauction-ddb56cc-2026-11-12';
 edition constant text := 'ipl-classics-2026-11-19';
 roster constant jsonb := '[
  ["Sachin Tendulkar","India","BAT","Top order","Right"],
  ["Virender Sehwag","India","BAT","Top order","Right"],
  ["Suresh Raina","India","BAT","Middle order","Left"],
  ["Rahul Dravid","India","BAT","Top order","Right"],
  ["Gautam Gambhir","India","BAT","Top order","Left"],
  ["Chris Gayle","West Indies","BAT","Top order","Left"],
  ["AB de Villiers","South Africa","BAT","Middle order","Right"],
  ["Adam Gilchrist","Australia","WK","WK-Batter","Left"],
  ["Kumar Sangakkara","Sri Lanka","WK","WK-Batter","Left"],
  ["Shane Watson","Australia","AR","Batting AR (pace)","Right"],
  ["Dwayne Bravo","West Indies","AR","Bowling AR (pace)","Right"],
  ["Kieron Pollard","West Indies","AR","Batting AR (pace)","Right"],
  ["Yusuf Pathan","India","AR","Batting AR (spin)","Right"],
  ["Daniel Vettori","New Zealand","AR","Bowling AR (spin)","Left"],
  ["Shane Warne","Australia","BOWL","Spin","Right"],
  ["Lasith Malinga","Sri Lanka","BOWL","Pace","Right"],
  ["Harbhajan Singh","India","BOWL","Spin","Right"],
  ["Zaheer Khan","India","BOWL","Pace","Right"]
 ]';
 source constant text := 'https://www.iplt20.com/news/article/teams-announce-squads-for-ipl-2013';
 fingerprint text; entry jsonb; facts jsonb; pid uuid;
BEGIN
 SELECT md5(content_hash || roster::text || edition) INTO STRICT fingerprint FROM public.player_catalogues WHERE version=base;
 INSERT INTO public.player_catalogues VALUES (edition,source,edition,'2026-11-19',fingerprint,291)
 ON CONFLICT (version) DO NOTHING;
 IF NOT FOUND THEN
  IF NOT EXISTS (SELECT FROM public.player_catalogues WHERE version=edition AND content_hash=fingerprint) THEN RAISE EXCEPTION 'Conflicting classic catalogue'; END IF;
  RETURN;
 END IF;
 INSERT INTO public.player_catalogue_entries
 SELECT edition,player_id,source_id,player_facts || jsonb_build_object('catalogue_version',edition)
 FROM public.player_catalogue_entries WHERE version=base;
 FOR entry IN SELECT value FROM jsonb_array_elements(roster) LOOP
  -- Rating, tier and base price are game settings. No professional statistics are estimated.
  facts := jsonb_build_object('name',entry->>0,'country',entry->>1,'format','IPL','role',entry->>2,
   'sub_role',entry->>3,'batting_hand',entry->>4,'bowling_style','Unknown',
   'rating',85,'base_price',2,'tier','A','age_group','Classic',
   'nationality_type',CASE WHEN entry->>1='India' THEN 'Indian' ELSE 'Overseas' END);
  INSERT INTO public.players(name,country,format,role,sub_role,batting_hand,bowling_style,rating,base_price,tier,age_group,nationality_type)
   SELECT name,country,format,role,sub_role,batting_hand,bowling_style,rating,base_price,tier,age_group,nationality_type
   FROM jsonb_populate_record(NULL::public.players,facts) ON CONFLICT (name,format) DO NOTHING;
  SELECT id INTO STRICT pid FROM public.players WHERE name=entry->>0 AND format='IPL' AND country=entry->>1;
  INSERT INTO public.player_catalogue_entries VALUES
   (edition,pid,'classic-'||lower(replace(entry->>0,' ','-')),facts||jsonb_build_object('id',pid,'catalogue_version',edition));
 END LOOP;
 IF (SELECT count(*) FROM public.player_catalogue_entries WHERE version=edition)<>291 THEN RAISE EXCEPTION 'Incomplete classic catalogue'; END IF;
END $import$;
COMMIT;
