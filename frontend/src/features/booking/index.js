import {t,localText} from '../../core/locale.js';
import {$,node,state,api,formatBdt,vehicleNames,durationLabels,showToast,showModal,closeModal,formatTime} from '../../core/context.js';
import {getSearch} from '../search/index.js';
import {openLogin} from '../auth/index.js';
import {seatLayout} from './seatMap.js';
function selectOptions(select,items,preferred){select.replaceChildren();for(const item of items){const o=node('option',{value:item.id},item.name);if(item.id===preferred)o.selected=true;select.append(o)}}
function nearestOption(stops,position){let best=null;for(const s of stops){if(s.latitude==null||s.longitude==null)continue;const rad=n=>n*Math.PI/180;const dLat=rad(Number(s.latitude)-position.coords.latitude),dLon=rad(Number(s.longitude)-position.coords.longitude),lat1=rad(position.coords.latitude),lat2=rad(Number(s.latitude));const a=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;const dist=6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));if(!best||best.distance>dist)best={id:s.id,distance:dist}}return best}
export async function openSeats(summary){
  const {startDate,months}=getSearch();
  if(!startDate)return showToast('Choose your subscription start date first.');
  let holdRequest;
  let generation=0;
  showModal('Choose your journey & seat','CORRIDOR BOOKING · MORNING + RETURN');
  const body=$('modalContent');
  body.append(node('p',{className:'status-note'},'Loading approved stops and seat availability…'));
  try{
    const details=await api('/api/services/'+encodeURIComponent(summary.id));
    state.selectedService=details;
    state.selectedSeat=null;
    body.replaceChildren();
    const morning=details.stops.filter(s=>s.direction==='morning')
      .sort((a,b)=>a.stop_order-b.stop_order);
    const evening=details.stops.filter(s=>s.direction==='evening')
      .sort((a,b)=>a.stop_order-b.stop_order);
    const eveningById=new Map(evening.map(s=>[s.id,s]));
    const availableStops=morning.filter(s=>eveningById.has(s.id));
    if(availableStops.length<2){
      body.append(node('p',{className:'error-note'},
        'This route is being prepared. Its approved boarding stops are not yet available.'));
      return;
    }
    const pairIsValid=(pickupId,dropId)=>{
      const a=morning.find(s=>s.id===pickupId);
      const b=morning.find(s=>s.id===dropId);
      const ea=eveningById.get(pickupId),eb=eveningById.get(dropId);
      return Boolean(a&&b&&ea&&eb&&a.stop_order<b.stop_order&&eb.stop_order<ea.stop_order);
    };
    const initialPickup=summary.pickup_stop_id || availableStops[0].id;
    const initialDrop=summary.dropoff_stop_id || availableStops[availableStops.length-1].id;
    const initialValid=pairIsValid(initialPickup,initialDrop);
    const summaryBox=node('div',{className:'summary-box journey-summary'});
    summaryBox.append(node('span',{className:'journey-overline'},'YOUR CORRIDOR'));
    summaryBox.append(node('h3',{},details.route_name||summary.home_zone+' → '+summary.office_zone));
    summaryBox.append(node('p',{},
      vehicleNames[summary.vehicle_class]+' · '+durationLabels[months]+
      ' · Morning service & evening return'));
    body.append(summaryBox);

    const stepBar=node('div',{className:'booking-progress'});
    for(const [n,label] of [['01','Choose stops'],['02','Select seat'],['03','Secure checkout']]){
      const item=node('span',{className:'booking-progress-item'+(n==='01'?' active':'')});
      item.append(node('b',{},n),label);stepBar.append(item);
    }
    body.append(stepBar);

    const pickupSelect=node('select',{id:'pickupStop','aria-label':'Morning pickup stop'}),
      dropSelect=node('select',{id:'dropStop','aria-label':'Office drop-off stop'});
    selectOptions(pickupSelect,availableStops,initialValid?initialPickup:availableStops[0].id);
    selectOptions(dropSelect,availableStops,
      initialValid?initialDrop:availableStops[availableStops.length-1].id);
    const stopFields=node('div',{className:'stop-fields'}),
      pickLabel=node('label',{},'MORNING BOARDING · EVENING DROP-OFF'),
      dropLabel=node('label',{},'MORNING DROP-OFF · EVENING BOARDING');
    pickLabel.append(pickupSelect);dropLabel.append(dropSelect);
    stopFields.append(pickLabel,dropLabel);body.append(stopFields);
    const journeyInfo=node('div',{className:'corridor-journey-info',role:'status','aria-live':'polite'});
    body.append(journeyInfo);
    const suggest=node('button',{className:'outline nearest-stop',type:'button'},
      '⌖ Find closest approved stop');
    suggest.onclick=()=>{
      if(!navigator.geolocation)return showToast('Location access is not supported in this browser.');
      navigator.geolocation.getCurrentPosition(pos=>{
        const nearest=nearestOption(availableStops,pos);
        if(nearest){pickupSelect.value=nearest.id;refreshSeats();
          showToast('Nearest listed stop: approximately '+Math.round(nearest.distance*1000)+' m straight-line distance.');}
        else showToast('No verified stop coordinates are available yet.');
      },()=>showToast('Location access was not granted.'),{timeout:7000,enableHighAccuracy:false});
    };
    body.append(suggest);
    const seatHolder=node('div',{className:'corridor-seat-holder'});
    body.append(seatHolder);
    const chosenText=node('p',{className:'status-note'},'Select your boarding stops to see available seats.');
    body.append(chosenText);
    const isFirst=!state.user||!state.user.welcome_redeemed_at;
    const discounts={1:isFirst?20:0,3:25,6:30,12:35};
    const base={bus:5000,hiace:6500,car:8000}[summary.vehicle_class]*months;
    const discount=discounts[months];
    const fare=node('div',{className:'fare-breakdown'});
    const line=(label,value,cls='fare-line')=>{
      const row=node('div',{className:cls});
      row.append(node('span',{},label),node('strong',{},value));return row;
    };
    fare.append(line('Plan price',formatBdt(base)),
      line('Estimated savings ('+discount+'%)','− '+formatBdt(base*discount/100)),
      line('Estimated total',formatBdt(base*(100-discount)/100),'fare-line total'));
    body.append(fare);
    const actions=node('div',{className:'modal-actions'}),
      cancel=node('button',{className:'outline',type:'button'},'Cancel'),
      submit=node('button',{className:'primary',type:'button',disabled:true},'Select a seat to continue');
    cancel.onclick=closeModal;
    actions.append(cancel,submit);body.append(actions);

    const refreshSeats=async()=>{
      const request=++generation;
      state.selectedSeat=null;
      submit.disabled=true;
      submit.textContent='Select a seat to continue';
      const mp=morning.find(s=>s.id===pickupSelect.value),
        md=morning.find(s=>s.id===dropSelect.value),
        ep=eveningById.get(pickupSelect.value),
        ed=eveningById.get(dropSelect.value);
      seatHolder.replaceChildren();
      if(!pairIsValid(pickupSelect.value,dropSelect.value)){
        journeyInfo.textContent='Choose a drop-off stop after your pickup along the morning corridor. The return journey follows the reverse route.';
        chosenText.textContent='Change your stops to continue.';
        return;
      }
      const timeText=s=>s?.planned_arrival?formatTime(s.planned_arrival):'Schedule pending';
      journeyInfo.replaceChildren(
        node('strong',{},mp.name+' → '+md.name),
        node('p',{},'Morning: '+timeText(mp)+' → '+timeText(md)+
          ' · Evening return: '+timeText(ed)+' → '+timeText(ep)),
        node('small',{},'Seat availability is calculated only for the route sections you travel.'));
      seatHolder.append(node('p',{className:'status-note'},'Checking seats for these stops…'));
      try{
        const params=new URLSearchParams({startDate,months:String(months),
          pickupStopId:pickupSelect.value,dropoffStopId:dropSelect.value});
        const availability=await api('/api/services/'+encodeURIComponent(details.id)+
          '/seats?'+params.toString());
        if(request!==generation)return;
        seatHolder.replaceChildren();
        seatLayout(seatHolder,details,availability,seat=>{
          chosenText.textContent='Seat '+seat.label+' selected for both journeys.';
          submit.disabled=false;
          submit.textContent='Continue with seat '+seat.label+' ↗';
        });
        chosenText.textContent='Choose an available seat for your selected route section.';
      }catch(e){
        if(request!==generation)return;
        seatHolder.replaceChildren(node('p',{className:'error-note'},e.message));
        chosenText.textContent='Seat availability could not be loaded.';
      }
    };
    pickupSelect.onchange=refreshSeats;
    dropSelect.onchange=refreshSeats;
    submit.onclick=async()=>{
      if(!state.selectedSeat)return;
      if(!pairIsValid(pickupSelect.value,dropSelect.value))
        return showToast('Choose your approved pickup and drop-off in travel order.');
      if(!state.user)return openLogin(()=>openSeats(summary));
      submit.disabled=true;
      submit.textContent=t('Reserving your seat temporarily…');
      try{
        const selected=state.selectedSeat;
        const payload={
          serviceId:details.id,seatId:selected.id,startDate,months,
          pickupStopId:pickupSelect.value,dropoffStopId:dropSelect.value,
        };
        const fingerprint=JSON.stringify(payload);
        if(holdRequest?.fingerprint!==fingerprint)
          holdRequest={fingerprint,key:crypto.randomUUID()};
        const reservation=await api('/api/reservations/hold',{
          method:'POST',auth:true,json:{...payload,idempotencyKey:holdRequest.key},
        });
        showCheckout(reservation,selected.label,summary);
      }catch(e){
        showToast(e.message);
        submit.disabled=false;
        submit.textContent=t('Try holding seat again');
      }
    };
    await refreshSeats();
  }catch(e){
    body.replaceChildren(node('p',{className:'error-note'},e.message));
  }
}
async function showCheckout(held,seatLabel,summary){showModal('Seat reserved temporarily · Complete payment','SECURE CHECKOUT');const body=$('modalContent');const box=node('div',{className:'summary-box'});
  box.append(node('h3',{},`${summary.code} · Seat ${seatLabel}`),node('p',{},`Subscription: ${held.months} month(s). Seat held until ${new Date(held.holdExpiresAt).toLocaleString('en-BD',{timeZone:'Asia/Dhaka'})} Dhaka time.`));body.append(box);
  const line=(a,b)=>{const r=node('div',{className:'fare-line'});r.append(node('span',{},a),node('strong',{},b));return r};
  body.append(line('Plan price',formatBdt(held.baseAmountBdt)),line(`Savings (${held.discountPercent}%)`,formatBdt(held.baseAmountBdt-held.amountBdt)));
  const total=line('Total to pay',formatBdt(held.amountBdt));total.classList.add('total');body.append(total);
  body.append(node('p',{className:'notice'},'Your booking is confirmed only after successful payment verification. Unpaid seat holds expire automatically.'));
  const actions=node('div',{className:'modal-actions'}),back=node('button',{className:'outline',type:'button'},'Close'),pay=node('button',{className:'primary',type:'button'},'Proceed to secure payment ↗');
  back.onclick=closeModal;pay.onclick=async()=>{pay.disabled=true;pay.textContent=t('Connecting to payment provider…');try{const result=await api(`/api/reservations/${held.id}/checkout`,{method:'POST',auth:true});window.location.assign(result.checkoutUrl)}catch(e){showToast(e.message);pay.disabled=false;pay.textContent=t('Try opening payment')}};
  actions.append(back,pay);body.append(actions);
}
