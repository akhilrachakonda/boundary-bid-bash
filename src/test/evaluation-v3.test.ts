import { describe, expect, it } from 'vitest';
import { evaluateV3, rankV3, type V3Player } from '@/lib/evaluation-v3';

const p = (id: string, role: string, bat?: number, bowl?: number, sub = role === 'BOWL' ? 'Pace' : 'Top order'): V3Player => ({
  id, name: id, role, sub_role: sub, nationality_type: 'Indian', format: 'IPL',
  measure: { bat, bowl, status: bat === undefined && bowl === undefined ? 'unknown' : 'measured', group: 'performance' },
});
const squad = (): V3Player[] => [
  p('wk', 'WK', 80), p('b1', 'BAT', 90), p('b2', 'BAT', 70), p('b3', 'BAT', 60), p('b4', 'BAT', 50),
  p('ar1', 'AR', 60, 60, 'Bowling AR (spin)'), p('ar2', 'AR', 40, 70, 'Bowling AR (pace)'),
  p('w1', 'BOWL', undefined, 90), p('w2', 'BOWL', undefined, 80, 'Spin'), p('w3', 'BOWL', undefined, 70), p('w4', 'BOWL', undefined, 60),
  p('bench', 'BAT', 99),
];

describe('V3 descriptive XI evaluation', () => {
  it('same squad gives identical results (reproducible)', () => {
    expect(evaluateV3(squad(), 'IPL', 4)).toEqual(evaluateV3([...squad()].reverse(), 'IPL', 4));
  });
  it('T20 overs are capped at 4 per bowler and total 20', () => {
    const r = evaluateV3(squad(), 'IPL', 4);
    expect(r.oversCovered).toBe(20);
    expect(Math.max(...r.contributions.map((c) => c.overs))).toBe(4);
  });
  it('ODI needs 50 overs at most 10 each', () => {
    const r = evaluateV3(squad(), 'ODI', 4);
    expect(r.oversRequired).toBe(50);
    expect(Math.max(...r.contributions.map((c) => c.overs))).toBe(10);
  });
  it('an all-rounder is counted once: one batting slot and real overs, no extra bonus', () => {
    const r = evaluateV3(squad(), 'IPL', 4);
    expect(r.contributions.filter((c) => c.id === 'ar1')).toHaveLength(1);
  });
  it('bench players add nothing to the score', () => {
    const base = evaluateV3(squad().filter((x) => x.id !== 'bench'), 'IPL', 4, ['wk','b1','b2','b3','b4','ar1','ar2','w1','w2','w3','w4']);
    const withBench = evaluateV3(squad(), 'IPL', 4, ['wk','b1','b2','b3','b4','ar1','ar2','w1','w2','w3','w4']);
    expect(withBench.combined).toBe(base.combined);
    expect(withBench.bench).toEqual(['bench']);
  });
  it('unknown players are not scored as a measured 50', () => {
    const s = squad(); s[1] = p('b1', 'BAT');
    const r = evaluateV3(s, 'IPL', 4, ['wk','b1','b2','b3','b4','ar1','ar2','w1','w2','w3','w4']);
    expect(r.contributions.find((c) => c.id === 'b1')!.bat).toBeNull();
    expect(r.battingCoverage).toBeLessThan(1);
  });
  it('an XI without a keeper is ineligible and ranked after eligible XIs', () => {
    const noKeeper = evaluateV3(squad().filter((x) => x.id !== 'wk'), 'IPL', 4);
    expect(noKeeper.eligible).toBe(false);
    const ranked = rankV3([{ id: 'a', score: noKeeper }, { id: 'b', score: evaluateV3(squad(), 'IPL', 4) }]);
    expect(ranked[0]!.id).toBe('b');
  });
  it('fewer than five bowling options leaves overs uncovered', () => {
    const s = squad().filter((x) => !['w3', 'w4', 'ar2'].includes(x.id));
    expect(evaluateV3(s, 'IPL', 4).oversCovered).toBeLessThan(20);
  });
});
