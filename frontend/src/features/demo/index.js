/** Independently branded, zero-payment demo journey simulation. */
import {$,node,state,api,showToast,showModal,closeModal} from '../../core/context.js';
import {seatLayout} from '../booking/seatMap.js';
import {openLogin} from '../auth/index.js';

export function demoCard(service,getSearch) {
  const card=node('article',{className:'route-card demo-service-card'});
  const top=node('div',{className:'demo-service-card-top'});
  top.append(node('span',{className:'demo-service-badge'},'DEMO · NO REAL VEHICLE'),
             node('span',{className:'demo-scope'},'Anywhere in Dhaka'));
  card.append(top);
  const title=node('h3',{},service.name);
  const description=node('p',{className:'demo-description'},'Try booking a numbered seat for any Dhaka pickup and destination. This is a simulation — no transport, payment or travel pass is provided.');
  const footer=node('div',{className:'demo-service-footer'});
  footer.append(node('span',{},service.selectable_seats+' demonstration seats · ৳0'));
  const action=node('button',{className:'primary demo-action',type:'button'},'Try demo booking');
  action.onclick=()=>openDemoSeats(service,getSearch);
  footer.append(action);
  card.append(title,description,footer);
  return card;
}

export async function openDemoSeats(service,getSearch){
  const q=getSearch();
  state.selectedSeat=null;
  showModal('Reserve a demo seat','DEMO ONLY · NO REAL TRANSPORT');
  const body=$('modalContent');
  body.replaceChildren(node('p',{className:'status-note'},'Loading shared demonstration seats…'));
  try {
    const availability=await api('/api/demo/services/'+encodeURIComponent(service.id)+'/seats?'+new URLSearchParams({
      startDate:q.startDate,months:String(q.months)
    }));
    body.replaceChildren();
    const notice=node('div',{className:'demo-modal-notice'});
    notice.append(node('strong',{},'Simulation only — no real transport or charge'),
       node('p',{},'Select a seat to experience TRIPPY booking. Demo seats are tracked separately from real reservations and can be removed by the administrator.'));
    body.append(notice);
    const zoneFields=node('div',{className:'demo-zone-fields'});
    const zoneInput=(label,placeholder,value)=>{
      const wrap=node('label',{},label);
      const input=node('input',{type:'text',maxlength:'100',minlength:'2',required:'',placeholder,autocomplete:'off'});
      input.value=value;
      wrap.append(input);
      zoneFields.append(wrap);
      return input;
    };
    const pickup=zoneInput('Dhaka pickup area','e.g. Uttara Sector 7',q.pickup);
    const office=zoneInput('Dhaka destination','e.g. Banani',q.office);
    body.append(zoneFields);
    const dateLine=node('p',{className:'demo-date-line'},q.months+'-month example starting '+q.startDate+' · ৳0');
    body.append(dateLine);
    const summary={vehicle_class:service.vehicle_class};
    const hint=node('p',{className:'status-note'},'Choose one green demo seat.');
    const confirmButton=node('button',{type:'button',className:'primary',disabled:true},'Choose a demo seat');
    seatLayout(body,summary,availability,seat=>{
      confirmButton.disabled=false;
      confirmButton.textContent='Confirm '+seat.label+' demo booking · ৳0';
      hint.textContent='Demo seat '+seat.label+' selected.';
    });
    body.append(hint);
    const actions=node('div',{className:'modal-actions'});
    const cancel=node('button',{type:'button',className:'outline'},'Cancel');
    cancel.onclick=closeModal;
    confirmButton.onclick=async()=>{
      if(!state.selectedSeat)return;
      if(!state.user)return openLogin(()=>openDemoSeats(service,getSearch));
      const p=pickup.value.trim(),o=office.value.trim();
      if(p.length<2||o.length<2||p.toLocaleLowerCase()===o.toLocaleLowerCase()){
        showToast('Choose different pickup and destination areas within Dhaka.');return;
      }
      confirmButton.disabled=true;
      confirmButton.textContent='Saving demo booking…';
      try{
        const booking=await api('/api/demo/services/'+encodeURIComponent(service.id)+'/bookings',{
          method:'POST',auth:true,json:{
            seatId:state.selectedSeat.id,pickupZone:p,officeZone:o,startDate:q.startDate,months:q.months,
            idempotencyKey:crypto.randomUUID()
          }
        });
        body.replaceChildren();
        const confirmation=node('section',{className:'demo-confirmation'});
        confirmation.append(node('span',{className:'demo-service-badge'},'DEMO BOOKED · NO PAYMENT'),
          node('h3',{},'Demo seat reserved'),
          node('p',{},'Your practice booking is saved. It does not reserve a real vehicle, create a boarding right or collect a payment.'),
          node('p',{},p+' → '+o+' · Seat '+state.selectedSeat.label));
        const view=node('button',{type:'button',className:'primary'},'View in My passes');
        view.onclick=()=>{closeModal();document.querySelector('[data-page="passes"]')?.click()};
        confirmation.append(view);
        body.append(confirmation);
        showToast('Demo Booked — no payment and no real journey.');
      }catch(e){showToast(e.message);confirmButton.disabled=false;confirmButton.textContent='Try demo booking again'}
    };
    actions.append(cancel,confirmButton);
    body.append(actions);
  }catch(e){
    body.replaceChildren(node('p',{className:'error-note'},'Demo seats are unavailable: '+e.message));
  }
}
