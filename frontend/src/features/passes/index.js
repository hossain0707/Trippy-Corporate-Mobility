import {$,node,state,api,formatBdt} from '../../core/context.js';

export async function loadPasses(){
  const el=$('passList');
  el.replaceChildren();
  if(!state.user){
    el.append(node('div',{className:'empty-message'},'Sign in to view your bookings.'));
    return;
  }
  const [realResult,demoResult]=await Promise.allSettled([
    api('/api/me/reservations',{auth:true}),
    api('/api/demo/me/bookings',{auth:true}),
  ]);
  if(realResult.status==='fulfilled'){
    state.bookings=realResult.value;
    if(state.bookings.length)el.append(node('h3',{className:'pass-group-title'},'Ride bookings'));
    for(const b of state.bookings){
      const card=node('article',{className:'pass-card'}),left=node('div');
      left.append(node('strong',{},b.code+' · Seat '+b.seat_label),
        node('p',{},b.pickup_stop+' ↔ '+b.dropoff_stop+' · '+b.starts_on+' to '+b.ends_before+' · '+formatBdt(b.amount_bdt)));
      card.append(left,node('span',{className:'pill '+b.status},({confirmed:'Confirmed',held:'Payment pending',released:'Released',cancelled:'Cancelled'}[b.status]||b.status.replace('_',' '))));
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
    el.append(node('div',{className:'error-note'},'Your ride bookings are unavailable right now. Please try again.'));
  }
  if(demoResult.status==='fulfilled'){
    const items=demoResult.value;
    if(items.length){
      const label=node('div',{className:'demo-search-label'});
      label.append(node('strong',{},'Demo bookings'),
        node('span',{},'For demonstration only · No real ticket or payment'));
      el.append(label);
    }
    for(const b of items){
      const card=node('article',{className:'pass-card demo-pass-card'}),left=node('div');
      left.append(node('strong',{},b.service_name+' · Seat '+b.seat_label),
        node('p',{},b.pickup_zone+' → '+b.office_zone+' · '+b.starts_on+' to '+b.ends_before+' · ৳0'));
      const paymentNames={bkash_demo:'bKash',nagad_demo:'Nagad',card_demo:'Debit / credit card',bank_demo:'Bank transfer'};
      const estimated=Number(b.estimated_total_bdt||0);
      const discount=Number(b.discount_percent||0);
      const base=Number(b.estimated_base_amount_bdt||0);
      left.append(node('p',{className:'demo-pass-payment'},
        'Demo reference: DEMO-'+String(b.id).slice(0,8).toUpperCase()));
      if(b.payment_status==='simulated'){
        left.append(node('p',{className:'demo-pass-pricing'},
          'Plan '+formatBdt(base)+' · '+discount+'% sample discount · Estimated '+formatBdt(estimated)));
        left.append(node('p',{className:'demo-pass-payment'},
          'Payment method: '+(paymentNames[b.payment_method]||'Demo')+
          ' · Payment: Demo only · Charged: ৳0'));
      }else{
        left.append(node('p',{className:'demo-pass-payment'},
          'Earlier demo booking · No payment processed · Charged: ৳0'));
      }
      left.append(node('small',{},'Demo only. Not valid for travel or as proof of payment.'));
      if(b.archived)left.append(node('small',{},'This demo is no longer available for new bookings.'));
      card.append(left,node('span',{className:'demo-service-badge'},'DEMO BOOKED'));
      el.append(card);
    }
    if(!items.length&&!state.bookings.length&&realResult.status==='fulfilled'){
      el.append(node('div',{className:'empty-message'},'No bookings yet. Find a ride or explore the demo.'));
    }
  }else{
    el.append(node('p',{className:'error-note'},'Demo bookings are temporarily unavailable. Please try again.'));
  }
}
