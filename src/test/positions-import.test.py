import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('position_import',Path(__file__).parents[2]/'scripts/import-positions.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class PositionTests(unittest.TestCase):
 def test_openers_grouped_and_arrival_not_squad_order(self):
  innings={'overs':[{'over':0,'deliveries':[{'batter':'B','non_striker':'A'},{'batter':'C','non_striker':'A'}]}]}
  self.assertEqual(module.positions(innings),{'A':'opening','B':'opening','C':'top'})
 def test_missing_opening_and_discontinuous_overs_unknown(self):
  self.assertEqual(module.positions({'overs':[{'over':2,'deliveries':[{'batter':'B','non_striker':'A'}]}]}),{})
  self.assertEqual(module.positions({'overs':[{'over':0,'deliveries':[{'batter':'B','non_striker':'A'}]},{'over':2,'deliveries':[]}]}),{})
 def test_ambiguous_double_arrivals_and_super_over_excluded(self):
  self.assertEqual(module.positions({'overs':[{'over':0,'deliveries':[{'batter':'B','non_striker':'A'},{'batter':'C','non_striker':'D'}]}]}),{})
  self.assertEqual(module.positions({'super_over':True,'overs':[]}),{})
if __name__=='__main__':unittest.main()