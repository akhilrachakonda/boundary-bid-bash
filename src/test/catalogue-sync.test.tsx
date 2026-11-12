import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SourceStats } from '@/components/auction/SourceStats';
import { celebrationTrack } from '@/lib/sound';
import { mergeLiveProjection } from '@/lib/live-projection';
import { DEFAULT_SETTINGS, generateBalancedPool, type Player } from '@/lib/auction-rules';
import catalogue from '@/data/crickauction/import.json';
import type { Room, RoomPlayer } from '@/hooks/use-room';

afterEach(cleanup);

describe('imported IPL catalogue and presentation', () => {
  const players = catalogue.map(({player,source}) => ({...player,id:source.id})) as Player[];
  it('includes every identity in all-player mode and retains custom ten-team pools', () => {
    expect(new Set(players.map(p=>p.name)).size).toBe(273);
    const all = generateBalancedPool(players,{...DEFAULT_SETTINGS,pool_size:'all'},123);
    expect(all.players).toHaveLength(273);
    const settings = {...DEFAULT_SETTINGS,max_teams:10,pool_size:150};
    const first = generateBalancedPool(players,settings,123);
    const second = generateBalancedPool(players,settings,456);
    expect(first.feasible).toBe(true);
    expect(second.feasible).toBe(true);
    expect(new Set(first.players.map(p=>p.id)).size).toBe(first.players.length);
    expect(first.players.map(p=>p.id)).not.toEqual(second.players.map(p=>p.id));
  });
  it('shows explicit zero statistics and source provenance', () => {
    const player = {...players[0]!,source_stats:{matches:0,runs:0},stats_imported:'2026-11-12'};
    render(<SourceStats player={player}/>);
    expect(screen.getByText('Matches')).toBeInTheDocument();
    expect(screen.getAllByText('0')).toHaveLength(2);
    expect(screen.getByText(/source cutoff unspecified/)).toBeInTheDocument();
  });
  it('uses franchise tracks for matching teams and a generic hammer for custom teams', () => {
    expect(celebrationTrack('sold','Chennai Super Kings')).toBe('/audio/crickauction/CSK.mp3');
    expect(celebrationTrack('sold','MI')).toBe('/audio/crickauction/MI.mp3');
    expect(celebrationTrack('sold','My custom XI')).toBeNull();
    expect(celebrationTrack('unsold')).toBe('/audio/crickauction/unsold1.mpeg');
  });
});

describe('atomic live replies', () => {
  const room={id:'room-a',evaluation_snapshot:'snapshot'} as Room;
  const pool=[{id:'lot',status:'live',player:{name:'Player'}}] as RoomPlayer[];
  it('rejects older revisions, another room, and incomplete pool state', () => {
    expect(mergeLiveProjection(room,pool,{room,states:[{id:'lot',status:'sold'}],revision:5},6)).toBeNull();
    expect(mergeLiveProjection(room,pool,{room:{...room,id:'room-b'},states:[{id:'lot'}],revision:7},6)).toBeNull();
    expect(mergeLiveProjection(room,pool,{room,states:[],revision:7},6)).toBeNull();
  });
  it('preserves player references and applies only changed lot state', () => {
    const same=mergeLiveProjection(room,pool,{room,states:[{id:'lot',status:'live'}],revision:7},6)!;
    expect(same[0]).toBe(pool[0]);
    const sold=mergeLiveProjection(room,pool,{room,states:[{id:'lot',status:'sold'}],revision:8},7)!;
    expect(sold[0]!.status).toBe('sold');
    expect(sold[0]!.player).toBe(pool[0]!.player);
  });
});
