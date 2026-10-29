import importlib.util,unittest
spec=importlib.util.spec_from_file_location('cricsheet','scripts/import-cricsheet.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class Aggregates(unittest.TestCase):
 def test_extras_and_dismissals(self):
  def d(ex,runs,w=[]):return dict(batter='Bat',bowler='Bowl',non_striker='Other',extras=ex,runs=dict(batter=runs,total=runs+sum(ex.values()),extras=sum(ex.values())),wickets=w)
  i=dict(overs=[dict(over=0,deliveries=[d({'wides':2},0),d({'noballs':1},4),d({'byes':2},0),d({'legbyes':1},0),d({},0,[dict(player_out='Other',kind='run out')]),d({},0,[dict(player_out='Bat',kind='caught',fielders=[dict(name='F')])])])])
  a=module.innings_aggregates(i,dict(match_type='T20',overs=20));self.assertEqual(a['Bat']['balls'],5);self.assertEqual(a['Bat']['runs'],4);self.assertEqual(a['Bowl']['legal_balls'],4);self.assertEqual(a['Bowl']['conceded'],7);self.assertEqual(a['Bowl']['wickets'],1);self.assertEqual(a['F']['catches'],1);self.assertEqual(a['Other']['dismissals'],1)
 def test_super_over_excluded(self):self.assertEqual(module.innings_aggregates(dict(super_over=True),dict(match_type='T20')), {})
 def test_not_out_average_unknown(self):self.assertIsNone(module.rates(module.empty())['average'])
 def test_non_overlapping_calendar_windows(self):
  from datetime import date
  self.assertEqual(module.month_before(date(2026,10,29),12),date(2025,10,29));self.assertEqual(module.month_before(date(2026,10,29),36),date(2023,10,29))
if __name__=='__main__':unittest.main()
