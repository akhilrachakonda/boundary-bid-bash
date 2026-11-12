-- Future rooms use the original auction roster. Existing room rows keep their settings.
BEGIN;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS pool_rules text;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS pool_generation jsonb;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS legacy_original_catalogue boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_original_catalogue_player(p_name text, p_country text)
RETURNS boolean LANGUAGE sql IMMUTABLE STRICT SET search_path = public AS $catalogue$
  SELECT EXISTS (
    SELECT 1 FROM (VALUES
    ('Jos Buttler', 'England'),
    ('Rishabh Pant', 'India'),
    ('KL Rahul', 'India'),
    ('Quinton de Kock', 'South Africa'),
    ('Phil Salt', 'England'),
    ('Mohammad Rizwan', 'Pakistan'),
    ('Sanju Samson', 'India'),
    ('Devon Conway', 'New Zealand'),
    ('Ishan Kishan', 'India'),
    ('Rahmanullah Gurbaz', 'Afghanistan'),
    ('Josh Inglis', 'Australia'),
    ('Ryan Rickelton', 'South Africa'),
    ('Abishek Porel', 'India'),
    ('Heinrich Klaasen', 'South Africa'),
    ('Nicholas Pooran', 'West Indies'),
    ('Shai Hope', 'West Indies'),
    ('Dhruv Jurel', 'India'),
    ('Jamie Smith', 'England'),
    ('MS Dhoni', 'India'),
    ('Alex Carey', 'Australia'),
    ('Kusal Mendis', 'Sri Lanka'),
    ('Tom Latham', 'New Zealand'),
    ('Jitesh Sharma', 'India'),
    ('Dinesh Karthik', 'India'),
    ('Prabhsimran Singh', 'India'),
    ('Virat Kohli', 'India'),
    ('Rohit Sharma', 'India'),
    ('Travis Head', 'Australia'),
    ('Shubman Gill', 'India'),
    ('Yashasvi Jaiswal', 'India'),
    ('Babar Azam', 'Pakistan'),
    ('Kane Williamson', 'New Zealand'),
    ('Abhishek Sharma', 'India'),
    ('Ruturaj Gaikwad', 'India'),
    ('David Warner', 'Australia'),
    ('Sai Sudharsan', 'India'),
    ('Ben Duckett', 'England'),
    ('Pathum Nissanka', 'Sri Lanka'),
    ('Priyansh Arya', 'India'),
    ('Suryakumar Yadav', 'India'),
    ('Joe Root', 'England'),
    ('Harry Brook', 'England'),
    ('Steve Smith', 'Australia'),
    ('Shreyas Iyer', 'India'),
    ('Daryl Mitchell', 'New Zealand'),
    ('Aiden Markram', 'South Africa'),
    ('Tilak Varma', 'India'),
    ('Rassie van der Dussen', 'South Africa'),
    ('Rajat Patidar', 'India'),
    ('Charith Asalanka', 'Sri Lanka'),
    ('Ajinkya Rahane', 'India'),
    ('Nehal Wadhera', 'India'),
    ('David Miller', 'South Africa'),
    ('Tim David', 'Australia'),
    ('Rinku Singh', 'India'),
    ('Glenn Phillips', 'New Zealand'),
    ('Tristan Stubbs', 'South Africa'),
    ('Shimron Hetmyer', 'West Indies'),
    ('Rovman Powell', 'West Indies'),
    ('Dewald Brevis', 'South Africa'),
    ('Sherfane Rutherford', 'West Indies'),
    ('Shashank Singh', 'India'),
    ('Ashutosh Sharma', 'India'),
    ('Abdul Samad', 'India'),
    ('Ramandeep Singh', 'India'),
    ('Hardik Pandya', 'India'),
    ('Andre Russell', 'West Indies'),
    ('Cameron Green', 'Australia'),
    ('Sam Curran', 'England'),
    ('Mitchell Marsh', 'Australia'),
    ('Marcus Stoinis', 'Australia'),
    ('Shivam Dube', 'India'),
    ('Nitish Kumar Reddy', 'India'),
    ('Azmatullah Omarzai', 'Afghanistan'),
    ('Venkatesh Iyer', 'India'),
    ('Glenn Maxwell', 'Australia'),
    ('Rachin Ravindra', 'New Zealand'),
    ('Liam Livingstone', 'England'),
    ('Will Jacks', 'England'),
    ('Washington Sundar', 'India'),
    ('Sikandar Raza', 'Zimbabwe'),
    ('Riyan Parag', 'India'),
    ('Kamindu Mendis', 'Sri Lanka'),
    ('Mohammad Nabi', 'Afghanistan'),
    ('Rahul Tewatia', 'India'),
    ('Pat Cummins', 'Australia'),
    ('Marco Jansen', 'South Africa'),
    ('Chris Woakes', 'England'),
    ('Jason Holder', 'West Indies'),
    ('Deepak Chahar', 'India'),
    ('Harshal Patel', 'India'),
    ('Shardul Thakur', 'India'),
    ('Gerald Coetzee', 'South Africa'),
    ('Kyle Jamieson', 'New Zealand'),
    ('Aamer Jamal', 'Pakistan'),
    ('Rashid Khan', 'Afghanistan'),
    ('Ravindra Jadeja', 'India'),
    ('Sunil Narine', 'West Indies'),
    ('Axar Patel', 'India'),
    ('Wanindu Hasaranga', 'Sri Lanka'),
    ('Ravichandran Ashwin', 'India'),
    ('Mitchell Santner', 'New Zealand'),
    ('Shakib Al Hasan', 'Bangladesh'),
    ('Moeen Ali', 'England'),
    ('Krunal Pandya', 'India'),
    ('Jasprit Bumrah', 'India'),
    ('Mitchell Starc', 'Australia'),
    ('Kagiso Rabada', 'South Africa'),
    ('Mohammed Shami', 'India'),
    ('Josh Hazlewood', 'Australia'),
    ('Shaheen Afridi', 'Pakistan'),
    ('Trent Boult', 'New Zealand'),
    ('Jofra Archer', 'England'),
    ('Arshdeep Singh', 'India'),
    ('Mohammed Siraj', 'India'),
    ('Anrich Nortje', 'South Africa'),
    ('Mark Wood', 'England'),
    ('Lockie Ferguson', 'New Zealand'),
    ('Mayank Yadav', 'India'),
    ('Mohsin Khan', 'India'),
    ('Bhuvneshwar Kumar', 'India'),
    ('Matheesha Pathirana', 'Sri Lanka'),
    ('Mustafizur Rahman', 'Bangladesh'),
    ('Prasidh Krishna', 'India'),
    ('Nathan Ellis', 'Australia'),
    ('Fazalhaq Farooqi', 'Afghanistan'),
    ('T Natarajan', 'India'),
    ('Avesh Khan', 'India'),
    ('Naveen-ul-Haq', 'Afghanistan'),
    ('Harshit Rana', 'India'),
    ('Khaleel Ahmed', 'India'),
    ('Mukesh Kumar', 'India'),
    ('Yash Dayal', 'India'),
    ('Tushar Deshpande', 'India'),
    ('Vyshak Vijaykumar', 'India'),
    ('Kuldeep Yadav', 'India'),
    ('Varun Chakaravarthy', 'India'),
    ('Yuzvendra Chahal', 'India'),
    ('Adam Zampa', 'Australia'),
    ('Adil Rashid', 'England'),
    ('Ravi Bishnoi', 'India'),
    ('Keshav Maharaj', 'South Africa'),
    ('Noor Ahmad', 'Afghanistan'),
    ('Maheesh Theekshana', 'Sri Lanka'),
    ('Tabraiz Shamsi', 'South Africa'),
    ('Mujeeb Ur Rahman', 'Afghanistan'),
    ('Ish Sodhi', 'New Zealand'),
    ('Rahul Chahar', 'India'),
    ('Sai Kishore', 'India'),
    ('Suyash Sharma', 'India')
    ) AS original(name, country)
    WHERE original.name = p_name AND original.country = p_country
  );
$catalogue$;
REVOKE ALL ON FUNCTION public.is_original_catalogue_player(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_original_catalogue_player(text,text) TO authenticated, service_role;

DO $migration$
DECLARE
  definition text;
  marker constant text := 's := r.settings;';
BEGIN
  IF to_regprocedure('public._new_room_pool_rules()') IS NOT NULL THEN
    SELECT pg_get_functiondef('public._new_room_pool_rules()'::regprocedure) INTO definition;
    IF strpos(definition, 'NEW.pool_rules:=''random-80-20-v1'';') > 0 THEN
      definition := replace(definition, 'NEW.pool_rules:=''random-80-20-v1'';', 'NEW.pool_rules:=NULL; NEW.legacy_original_catalogue:=true;');
      EXECUTE definition;
    ELSIF strpos(definition, 'NEW.legacy_original_catalogue:=true;') = 0 THEN
      RAISE EXCEPTION 'Unexpected new-room trigger definition';
    END IF;
  ELSE
    EXECUTE 'CREATE FUNCTION public._new_room_pool_rules() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $b$ BEGIN NEW.pool_rules:=NULL; NEW.legacy_original_catalogue:=true; NEW.pool_generation:=NULL; RETURN NEW; END $b$';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_trigger WHERE tgrelid='public.rooms'::regclass AND tgname='new_room_pool_rules') THEN
    CREATE TRIGGER new_room_pool_rules BEFORE INSERT ON public.rooms FOR EACH ROW EXECUTE FUNCTION public._new_room_pool_rules();
  END IF;
  IF NOT EXISTS (SELECT FROM pg_trigger WHERE tgrelid='public.rooms'::regclass AND tgname='new_room_pool_rules' AND tgfoid='public._new_room_pool_rules()'::regprocedure AND tgenabled IN ('O','A')) THEN
    RAISE EXCEPTION 'New-room pool trigger is not active';
  END IF;
  SELECT pg_get_functiondef('public.set_pool(uuid,uuid[])'::regprocedure) INTO definition;
  IF strpos(definition, 'r.legacy_original_catalogue') = 0 THEN
    IF strpos(definition,marker)=0 THEN RAISE EXCEPTION 'Unexpected set_pool body'; END IF;
    definition := replace(definition, marker, $guard$
  IF r.legacy_original_catalogue THEN
    IF cardinality(p_player_ids) > 150 OR EXISTS (
      SELECT 1 FROM unnest(p_player_ids) chosen(id)
      LEFT JOIN public.players player ON player.id = chosen.id
      WHERE player.id IS NULL OR NOT public.is_original_catalogue_player(player.name, player.country)
    ) THEN
      RAISE EXCEPTION 'Choose players from the original 150-player catalogue';
    END IF;
  END IF;
  s := r.settings;$guard$);
    EXECUTE definition;
  END IF;
END;
$migration$;
COMMIT;

