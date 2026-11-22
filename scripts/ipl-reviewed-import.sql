-- IPL innings and appearances through 31 May 2026: Cricsheet, ODC-By 1.0.
-- Reviewed against the official 2025 and 2026 IPL auction registers; player IDs stay stable.
BEGIN;
DO $import$
DECLARE
  base constant text := 'ipl-classics-2026-11-19';
  edition constant text := 'ipl-reviewed-2026-11-21';
  corrections constant jsonb := $facts${
  "Brydon Carse": {
    "stats_cutoff": "2026-05-31",
    "stats_reference": "https://cricsheet.org/downloads/#ipl_male",
    "stats_status": "no_appearances",
    "stats_source": "Cricsheet IPL match sheets",
    "source_stats": {}
  },
  "Ajay Mandal": {
    "stats_cutoff": "2026-05-31",
    "stats_reference": "https://cricsheet.org/downloads/#ipl_male",
    "stats_status": "no_appearances",
    "stats_source": "Cricsheet IPL match sheets",
    "source_stats": {}
  },
  "Harnoor Singh": {
    "stats_cutoff": "2026-05-31",
    "stats_reference": "https://cricsheet.org/downloads/#ipl_male",
    "stats_status": "no_appearances",
    "stats_source": "Cricsheet IPL match sheets",
    "source_stats": {}
  },
  "Pyla Avinash": {
    "stats_cutoff": "2026-05-31",
    "stats_reference": "https://cricsheet.org/downloads/#ipl_male",
    "stats_status": "no_appearances",
    "stats_source": "Cricsheet IPL match sheets",
    "source_stats": {}
  },
  "Ben Duckett": {
    "stats_cutoff": "2026-05-31",
    "stats_reference": "https://cricsheet.org/downloads/#ipl_male",
    "stats_status": "no_appearances",
    "stats_source": "Cricsheet IPL match sheets",
    "source_stats": {}
  },
  "Tejasvi Singh": {
    "stats_cutoff": "2026-05-31",
    "stats_reference": "https://cricsheet.org/downloads/#ipl_male",
    "stats_status": "verified",
    "stats_source": "Cricsheet IPL match sheets",
    "source_stats": {
      "matches": 2,
      "runs": 12,
      "wickets": 0,
      "sr": 80.0
    }
  },
  "Naman Tiwari": {
    "stats_cutoff": "2026-05-31",
    "stats_reference": "https://cricsheet.org/downloads/#ipl_male",
    "stats_status": "no_appearances",
    "stats_source": "Cricsheet IPL match sheets",
    "source_stats": {}
  },
  "Karn Sharma": {
    "stats_cutoff": "2026-05-31",
    "stats_reference": "https://cricsheet.org/downloads/#ipl_male",
    "stats_status": "verified",
    "stats_source": "Cricsheet IPL match sheets",
    "source_stats": {
      "matches": 90,
      "runs": 352,
      "wickets": 83,
      "econ": 8.38,
      "sr": 119.32
    }
  },
  "Kumar Kartikeya Singh": {
    "stats_cutoff": "2026-05-31",
    "stats_reference": "https://cricsheet.org/downloads/#ipl_male",
    "stats_status": "verified",
    "stats_source": "Cricsheet IPL match sheets",
    "source_stats": {
      "matches": 16,
      "runs": 12,
      "wickets": 12,
      "econ": 8.66,
      "sr": 70.59
    }
  },
  "Dasun Shanaka": {
    "stats_cutoff": "2026-05-31",
    "stats_reference": "https://cricsheet.org/downloads/#ipl_male",
    "stats_status": "verified",
    "stats_source": "Cricsheet IPL match sheets",
    "source_stats": {
      "matches": 10,
      "runs": 89,
      "wickets": 1,
      "econ": 10.0,
      "sr": 123.61
    }
  },
  "Zak Foulkes": {
    "stats_cutoff": "2026-05-31",
    "stats_reference": "https://cricsheet.org/downloads/#ipl_male",
    "stats_status": "no_appearances",
    "stats_source": "Cricsheet IPL match sheets",
    "source_stats": {}
  },
  "Jordan Cox": {
    "stats_cutoff": "2026-05-31",
    "stats_reference": "https://cricsheet.org/downloads/#ipl_male",
    "stats_status": "no_appearances",
    "stats_source": "Cricsheet IPL match sheets",
    "source_stats": {}
  },
  "Aman Khan": {
    "stats_cutoff": "2026-05-31",
    "stats_reference": "https://cricsheet.org/downloads/#ipl_male",
    "stats_status": "verified",
    "stats_source": "Cricsheet IPL match sheets",
    "source_stats": {
      "matches": 12,
      "runs": 115,
      "wickets": 0,
      "econ": 13.0,
      "sr": 110.58
    }
  },
  "Satvik Deswal": {
    "stats_cutoff": "2026-05-31",
    "stats_reference": "https://cricsheet.org/downloads/#ipl_male",
    "stats_status": "no_appearances",
    "stats_source": "Cricsheet IPL match sheets",
    "source_stats": {}
  },
  "Vicky Ostwal": {
    "stats_cutoff": "2026-05-31",
    "stats_reference": "https://cricsheet.org/downloads/#ipl_male",
    "stats_status": "no_appearances",
    "stats_source": "Cricsheet IPL match sheets",
    "source_stats": {}
  },
  "Yashvardhan Dalal": {
    "stats_cutoff": "2026-05-31",
    "stats_reference": "https://cricsheet.org/downloads/#ipl_male",
    "stats_status": "no_appearances",
    "stats_source": "Cricsheet IPL match sheets",
    "source_stats": {}
  },
  "Mohammed Izhar": {
    "stats_cutoff": "2026-05-31",
    "stats_reference": "https://cricsheet.org/downloads/#ipl_male",
    "stats_status": "no_appearances",
    "stats_source": "Cricsheet IPL match sheets",
    "source_stats": {}
  },
  "Onkar Tarmale": {
    "stats_cutoff": "2026-05-31",
    "stats_reference": "https://cricsheet.org/downloads/#ipl_male",
    "stats_status": "no_appearances",
    "stats_source": "Cricsheet IPL match sheets",
    "source_stats": {}
  },
  "Yarra Prithviraj": {
    "stats_cutoff": "2026-05-31",
    "stats_reference": "https://cricsheet.org/downloads/#ipl_male",
    "stats_status": "verified",
    "stats_source": "Cricsheet IPL match sheets",
    "source_stats": {
      "matches": 2,
      "runs": 0,
      "wickets": 1,
      "econ": 11.4,
      "sr": 0.0
    }
  },
  "Vijay Kumar": {
    "stats_cutoff": "2026-05-31",
    "stats_reference": "https://cricsheet.org/downloads/#ipl_male",
    "stats_status": "no_appearances",
    "stats_source": "Cricsheet IPL match sheets",
    "source_stats": {}
  },
  "Dian Forrester": {
    "stats_cutoff": "2026-05-31",
    "stats_reference": "https://cricsheet.org/downloads/#ipl_male",
    "stats_status": "no_appearances",
    "stats_source": "Cricsheet IPL match sheets",
    "source_stats": {}
  },
  "Rehan Ahmed": {
    "stats_cutoff": "2026-05-31",
    "stats_reference": "https://cricsheet.org/downloads/#ipl_male",
    "stats_status": "no_appearances",
    "stats_source": "Cricsheet IPL match sheets",
    "source_stats": {}
  },
  "Saurabh Dubey": {
    "stats_cutoff": "2026-05-31",
    "stats_reference": "https://cricsheet.org/downloads/#ipl_male",
    "stats_status": "verified",
    "stats_source": "Cricsheet IPL match sheets",
    "source_stats": {
      "matches": 4,
      "runs": 4,
      "wickets": 5,
      "econ": 8.26,
      "sr": 200.0
    }
  },
  "Luvnith Sisodia": {
    "stats_cutoff": "2026-05-31",
    "stats_reference": "https://cricsheet.org/downloads/#ipl_male",
    "stats_status": "no_appearances",
    "stats_source": "Cricsheet IPL match sheets",
    "source_stats": {}
  },
  "Vihaan Malhotra": {
    "stats_cutoff": "2026-05-31",
    "stats_reference": "https://cricsheet.org/downloads/#ipl_male",
    "stats_status": "no_appearances",
    "stats_source": "Cricsheet IPL match sheets",
    "source_stats": {}
  },
  "Kanishk Chouhan": {
    "stats_cutoff": "2026-05-31",
    "stats_reference": "https://cricsheet.org/downloads/#ipl_male",
    "stats_status": "no_appearances",
    "stats_source": "Cricsheet IPL match sheets",
    "source_stats": {}
  },
  "Jack Edwards": {
    "stats_cutoff": "2026-05-31",
    "stats_reference": "https://cricsheet.org/downloads/#ipl_male",
    "stats_status": "no_appearances",
    "stats_source": "Cricsheet IPL match sheets",
    "source_stats": {}
  },
  "Akeal Hosein": {
    "bowling_style": "Left-arm slow orthodox",
    "sub_role": "Spin",
    "bowling_reference": "https://www.iplt20.com/cms/files/jot2qw8s50z1/6I7aEzrceYYpeUVi2qZm3/ce1814c9d6d5b2a8e112f45202804884/TATA-IPL-2026-Auction-List-8.12.25.pdf"
  },
  "Akash Deep": {
    "bowling_style": "Right-arm fast",
    "sub_role": "Pace",
    "bowling_reference": "https://www.iplt20.com/cms/files/jot2qw8s50z1/6I7aEzrceYYpeUVi2qZm3/ce1814c9d6d5b2a8e112f45202804884/TATA-IPL-2026-Auction-List-8.12.25.pdf"
  },
  "Umran Malik": {
    "bowling_style": "Right-arm fast",
    "sub_role": "Pace",
    "bowling_reference": "https://documents.iplt20.com/bcci/documents/1731674068078_TATA%20IPL%202025-%20Auction%20List%20-15.11.24.pdf"
  },
  "Yash Thakur": {
    "bowling_style": "Right-arm fast medium",
    "sub_role": "Pace",
    "bowling_reference": "https://documents.iplt20.com/bcci/documents/1731674068078_TATA%20IPL%202025-%20Auction%20List%20-15.11.24.pdf"
  },
  "Jacob Duffy": {
    "bowling_style": "Right-arm fast medium",
    "sub_role": "Pace",
    "bowling_reference": "https://www.iplt20.com/cms/files/jot2qw8s50z1/6I7aEzrceYYpeUVi2qZm3/ce1814c9d6d5b2a8e112f45202804884/TATA-IPL-2026-Auction-List-8.12.25.pdf"
  },
  "Mayank Markande": {
    "bowling_style": "Right-arm leg spin",
    "sub_role": "Spin",
    "bowling_reference": "https://documents.iplt20.com/bcci/documents/1731674068078_TATA%20IPL%202025-%20Auction%20List%20-15.11.24.pdf"
  },
  "Ishant Sharma": {
    "bowling_style": "Right-arm fast",
    "sub_role": "Pace",
    "bowling_reference": "https://documents.iplt20.com/bcci/documents/1731674068078_TATA%20IPL%202025-%20Auction%20List%20-15.11.24.pdf"
  },
  "Abhinandan Singh": {
    "bowling_style": "Right-arm fast medium",
    "sub_role": "Pace",
    "bowling_reference": "https://documents.iplt20.com/bcci/documents/1731674068078_TATA%20IPL%202025-%20Auction%20List%20-15.11.24.pdf"
  },
  "Akash Singh": {
    "bowling_style": "Left-arm fast",
    "sub_role": "Pace",
    "bowling_reference": "https://documents.iplt20.com/bcci/documents/1731674068078_TATA%20IPL%202025-%20Auction%20List%20-15.11.24.pdf"
  },
  "Eshan Malinga": {
    "bowling_style": "Right-arm fast",
    "sub_role": "Pace",
    "bowling_reference": "https://documents.iplt20.com/bcci/documents/1731674068078_TATA%20IPL%202025-%20Auction%20List%20-15.11.24.pdf"
  },
  "Gurjapneet Singh": {
    "bowling_style": "Left-arm fast medium",
    "sub_role": "Pace",
    "bowling_reference": "https://documents.iplt20.com/bcci/documents/1731674068078_TATA%20IPL%202025-%20Auction%20List%20-15.11.24.pdf"
  },
  "Gurnoor Brar": {
    "bowling_style": "Right-arm fast",
    "sub_role": "Pace",
    "bowling_reference": "https://documents.iplt20.com/bcci/documents/1731674068078_TATA%20IPL%202025-%20Auction%20List%20-15.11.24.pdf"
  },
  "Harsh Dubey": {
    "bowling_style": "Left-arm slow orthodox",
    "sub_role": "Spin",
    "bowling_reference": "https://documents.iplt20.com/bcci/documents/1731674068078_TATA%20IPL%202025-%20Auction%20List%20-15.11.24.pdf"
  },
  "Manimaran Siddharth": {
    "bowling_style": "Left-arm slow orthodox",
    "sub_role": "Spin",
    "bowling_reference": "https://documents.iplt20.com/bcci/documents/1731674068078_TATA%20IPL%202025-%20Auction%20List%20-15.11.24.pdf"
  },
  "Arshad Khan": {
    "bowling_style": "Left-arm fast medium",
    "sub_role": "Pace",
    "bowling_reference": "https://documents.iplt20.com/bcci/documents/1731674068078_TATA%20IPL%202025-%20Auction%20List%20-15.11.24.pdf"
  },
  "Mukesh Choudhary": {
    "bowling_style": "Left-arm fast",
    "sub_role": "Pace",
    "bowling_reference": "https://documents.iplt20.com/bcci/documents/1731674068078_TATA%20IPL%202025-%20Auction%20List%20-15.11.24.pdf"
  },
  "Prince Yadav": {
    "bowling_style": "Right-arm fast",
    "sub_role": "Pace",
    "bowling_reference": "https://documents.iplt20.com/bcci/documents/1731674068078_TATA%20IPL%202025-%20Auction%20List%20-15.11.24.pdf"
  },
  "Raghu Sharma": {
    "bowling_style": "Right-arm leg spin",
    "sub_role": "Spin",
    "bowling_reference": "https://www.iplt20.com/news/article/mumbai-indians-sign-raghu-sharma-as-a-replacement-for-the-injured-vignesh-puthur"
  },
  "Zeeshan Ansari": {
    "bowling_style": "Right-arm leg spin",
    "sub_role": "Spin",
    "bowling_reference": "https://documents.iplt20.com/bcci/documents/1731674068078_TATA%20IPL%202025-%20Auction%20List%20-15.11.24.pdf"
  }
}$facts$;
  fingerprint text;
BEGIN
  SELECT md5(content_hash || corrections::text) INTO STRICT fingerprint FROM public.player_catalogues WHERE version=base;
  INSERT INTO public.player_catalogues VALUES (edition,'https://cricsheet.org/downloads/',edition,'2026-11-21',fingerprint,291)
  ON CONFLICT (version) DO NOTHING;
  IF NOT FOUND THEN
    IF NOT EXISTS(SELECT FROM public.player_catalogues WHERE version=edition AND content_hash=fingerprint) THEN RAISE EXCEPTION 'Unexpected reviewed catalogue'; END IF;
    RETURN;
  END IF;
  IF (SELECT count(*) FROM public.player_catalogue_entries WHERE version=base AND corrections ? (player_facts->>'name'))<>46 THEN
    RAISE EXCEPTION 'Reviewed players missing from original catalogue';
  END IF;
  INSERT INTO public.player_catalogue_entries
  SELECT edition,player_id,source_id,player_facts || coalesce(corrections->(player_facts->>'name'),'{}') || jsonb_build_object('catalogue_version',edition)
  FROM public.player_catalogue_entries WHERE version=base;
  IF (SELECT count(*) FROM public.player_catalogue_entries WHERE version=edition)<>291 THEN RAISE EXCEPTION 'Incomplete reviewed catalogue'; END IF;
END $import$;
COMMIT;
