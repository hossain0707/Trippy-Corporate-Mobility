import {$,node,state,api,formatBdt} from '../../core/context.js';

export async function loadPasses(){
  const el=$('passList');
  el.replaceChildren();
  if(!state.user){
    el.append(node('div',{className:'empty-message'},'Please sign in first to view real passes and demo bookings.'));
    return;
  }
  const [realResult,demoResult]=await Promise.allSettled([
    api('/api/me/reservations',{auth:true}),
    api('/api/demo/me/bookings',{auth:true}),
  ]);
  if(realResult.status==='fulfilled'){
    state.bookings=realResult.value;
    if(state.bookings.length)el.append(node('h3',{className:'pass-group-title'},'Real reservations'));
    for(const b of state.bookings){
      const card=node('article',{className:'pass-card'}),left=node('div');
      left.append(node('strong',{},b.code+' · Seat '+b.seat_label),
        node('p',{},b.pickup_stop+' ↔ '+b.dropoff_stop+' · '+b.starts_on+' to '+b.ends_before+' · '+formatBdt(b.amount_bdt)));
      card.append(left,node('span',{className:'pill '+b.status},b.status.replace('_',' ')));
      if(b.status==='held'){
        const release=node('button',{className:'outline',type:'button'},'Release unpaid seat');
        release.onclick=async()=>{
          if(!confirm('Release this unpaid seat hold?'))return;
          release.disabled=true;
          try{await api('/api/reservations/'+b.id+'/release',{method:'POST',auth:true});loadPasses()}
          catch(e){release.textContent=e.message;release.disabled=false}
        };
        card.append(release);
      }
      el.append(card);
    }
  }else{
    el.append(node('div',{className:'error-note'},'Real passes unavailable: '+realResult.reason.message));
  }
  if(demoResult.status==='fulfilled'){
    const items=demoResult.value;
    if(items.length){
      const label=node('div',{className:'demo-search-label'});
      label.append(node('strong',{},'Demonstration bookings'),
        node('span',{},'Practice only · no payment, travel service or real boarding pass'));
      el.append(label);
    }
    for(const b of items){
      const card=node('article',{className:'pass-card demo-pass-card'}),left=node('div');
      left.append(node('strong',{},b.service_name+' · Seat '+b.seat_label),
        node('p',{},b.pickup_zone+' → '+b.office_zone+' · '+b.starts_on+' to '+b.ends_before+' · ৳0'));
      if(b.archived)left.append(node('small',{},'This demonstration service has been removed by an administrator.'));
      card.append(left,node('span',{className:'demo-service-badge'},'DEMO BOOKED'));
      el.append(card);
    }
    if(!items.length&&!state.bookings.length&&realResult.status==='fulfilled'){
      el.append(node('div',{className:'empty-message'},'No bookings yet. Search for a verified route or try the clearly labelled demo bus.'));
    }
  }else{
    el.append(node('p',{className:'error-note'},'Demo booking history is temporarily unavailable.'));
  }
}
