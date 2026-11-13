import type {TeamVote} from '@/lib/community';
import type {Participant} from '@/hooks/use-room';
export function TeamFeedback({votes,participants}:{votes:TeamVote[];participants:Map<string,Participant>}) {
 return <section className="space-y-3 border-t pt-3" aria-label="Ratings received">
  <h3 className="font-semibold">Ratings received <span className="text-muted-foreground">({votes.length})</span></h3>
  {!votes.length&&<p className="text-sm text-muted-foreground">No ratings received yet.</p>}
  {votes.map(v=>{const from=participants.get(v.rater??'');return <article key={v.rater} className="min-w-0 space-y-3 rounded-xl border bg-background/40 p-3">
   <p className="break-words text-sm"><span className="text-muted-foreground">From </span><strong>{from?.team_name??'Participant'}</strong>{from?.nickname&&<span className="text-muted-foreground"> · {from.nickname}</span>}</p>
   <dl className="grid grid-cols-3 gap-2">{[['Top order',v.top_order],['Middle / finishing',v.middle_finishing],['Bowling',v.bowling]].map(([label,score])=><div key={label}><dt className="text-[11px] leading-tight text-muted-foreground">{label}</dt><dd className="mt-1 font-display text-2xl font-bold">{score}<span className="text-sm text-muted-foreground">/10</span></dd></div>)}</dl>
   {v.comment?<p className="whitespace-pre-wrap break-words rounded-lg bg-secondary/40 p-3 text-sm [overflow-wrap:anywhere]">{v.comment}</p>:<p className="text-xs text-muted-foreground">No comment added.</p>}
  </article>;})}
 </section>;
}
