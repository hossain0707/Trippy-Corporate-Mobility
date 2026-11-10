import {$,node,state,api,formatBdt} from '../../core/context.js';
export async function loadPasses(){const el=$('passList');el.replaceChildren();if(!state.user){el.append(node('div',{className:'empty-message'},'Please sign in first to see your verified seat passes.'));return}
  try{state.bookings=await api('/api/me/reservations',{auth:true});if(!state.bookings.length){el.append(node('div',{className:'empty-message'},'No bookings yet. Find a verified service and choose a seat to begin.'));return}
    for(const b of state.bookings){const card=node('article',{className:'pass-card'}),left=node('div');left.append(node('strong',{},`${b.code} · Seat ${b.seat_label}`),node('p',{},`${b.pickup_stop} ↔ ${b.dropoff_stop} · ${b.starts_on} to ${b.ends_before} · ${formatBdt(b.amount_bdt)}`));card.append(left,node('span',{className:'pill '+b.status},b.status.replace('_',' ')));
      if(b.status==='held'){
        const release=node('button',{className:'outline',type:'button'},'Release unpaid seat');
        release.onclick=async()=>{if(!confirm('Release this unpaid seat hold?'))return;
          release.disabled=true;try{await api('/api/reservations/'+b.id+'/release',{method:'POST',auth:true});loadPasses()}
          catch(e){release.textContent=e.message;release.disabled=false}};
        card.append(release);
      }
      el.append(card)}
  }catch(e){el.append(node('div',{className:'empty-message'},e.message))}
}
