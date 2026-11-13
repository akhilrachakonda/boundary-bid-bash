import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {IplTeamPicker} from '@/components/IplTeamPicker';
import {TeamFeedback} from '@/components/room/TeamFeedback';
import {IPL_TEAMS} from '@/lib/ipl-teams';
import {celebrationTrack} from '@/lib/sound';
afterEach(cleanup);
it('allows available teams, disables other reservations, and keeps your own selection usable',()=>{
 const change=vi.fn();render(<IplTeamPicker value="CSK" taken={['CSK','MI']} onChange={change}/>);
 const mi=screen.getByRole('button',{name:/MI Mumbai Indians/});expect(mi).toBeDisabled();fireEvent.click(mi);expect(change).not.toHaveBeenCalled();
 expect(screen.getByRole('button',{name:/CSK Chennai Super Kings/})).toBeEnabled();
 fireEvent.click(screen.getByRole('button',{name:/RR Rajasthan Royals/}));expect(change).toHaveBeenCalledWith('RR');
});
it('maps all selectable canonical names to their matching sold audio assets',()=>{
 for(const team of IPL_TEAMS)expect(celebrationTrack('sold',team.name)).toBe(`/audio/crickauction/${team.code}.mp3`);
});
it('shows the author, all category scores and a literal optional reason',()=>{
 const vote={rater:'rater',target:'me',top_order:8,middle_finishing:6,bowling:9,comment:'<script>reason</script>'};
 const {container}=render(<TeamFeedback votes={[vote]} participants={new Map([['rater',{team_name:'Mumbai Indians',nickname:'Friend'} as never]])}/>);
 expect(screen.getByText('Mumbai Indians')).toBeInTheDocument();expect(screen.getByText(/Friend/)).toBeInTheDocument();expect(screen.getByText('<script>reason</script>')).toBeInTheDocument();expect(container.querySelector('script')).toBeNull();
 expect(screen.getByText('Top order')).toBeInTheDocument();expect(screen.getByText('Middle / finishing')).toBeInTheDocument();expect(screen.getByText('Bowling')).toBeInTheDocument();
});
