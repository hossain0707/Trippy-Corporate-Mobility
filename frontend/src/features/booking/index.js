import {$,node,state,api,formatBdt,vehicleNames,durationLabels,showToast,showModal,closeModal,formatTime} from '../../core/context.js';
import {getSearch} from '../search/index.js';
import {openLogin} from '../auth/index.js';
import {seatLayout} from './seatMap.js';
function selectOptions(select,items,preferred){select.replaceChildren();for(const item of items){const o=node('option',{value:item.id},item.name);if(item.id===preferred)o.selected=true;select.append(o)}}
function nearestOption(stops,position){let best=null;for(const s of stops){if(s.latitude==null||s.longitude==null)continue;const rad=n=>n*Math.PI/180;const dLat=rad(Number(s.latitude)-position.coords.latitude),dLon=rad(Number(s.longitude)-position.coords.longitude),lat1=rad(position.coords.latitude),lat2=rad(Number(s.latitude));const a=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;const dist=6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));if(!best||best.distance>dist)best={id:s.id,distance:dist}}return best}
export async function openSeats(summary){
  const {startDate,months}=getSearch();if(!startDate)return showToast('Choose your subscription start date first.');
  showModal('Choose your exact seat');const body=$('modalContent');body.append(node('p',{className:'status-note'},'Loading verified seat inventory for your full subscription…'));
  try{
    const [details,availability]=await Promise.all([api(`/api/services/${summary.id}`),api(`/api/services/${summary.id}/seats?startDate=${encodeURIComponent(startDate)}&months=${months}`)]);
    state.selectedService=details;state.selectedSeat=null;body.replaceChildren();
    const summaryBox=node('div',{className:'summary-box'});summaryBox.append(node('h3',{},`${summary.home_zone} → ${summary.office_zone}`),node('p',{},`${vehicleNames[summary.vehicle_class]} · ${formatTime(summary.morning_departure)} pickup · ${formatTime(summary.evening_departure)} return · ${durationLabels[months]}`));body.append(summaryBox);
    const morning=details.stops.filter(s=>s.direction==='morning');
    const evening=details.stops.filter(s=>s.direction==='evening');
    const eligibleHome=morning.filter(s=>evening.some(e=>e.id===s.id));
    const eligibleOffice=morning.filter(s=>evening.some(e=>e.id===s.id));
    if(eligibleHome.length<2||eligibleOffice.length<2){body.append(node('p',{className:'error-note'},'Route stops must be verified for morning and evening journeys before reservations can begin.'));return}
    const pickupSelect=node('select',{id:'pickupStop','aria-label':'Morning pickup stop'}),dropSelect=node('select',{id:'dropStop','aria-label':'Office drop-off stop'});
    selectOptions(pickupSelect,eligibleHome,eligibleHome[0].id);selectOptions(dropSelect,eligibleOffice,eligibleOffice[eligibleOffice.length-1].id);
    const stopFields=node('div',{className:'stop-fields'}),pickLabel=node('label',{},'MORNING PICKUP / EVENING DROP-OFF'),dropLabel=node('label',{},'OFFICE DROP-OFF / EVENING PICKUP');pickLabel.append(pickupSelect);dropLabel.append(dropSelect);stopFields.append(pickLabel,dropLabel);body.append(stopFields);
    const suggest=node('button',{className:'outline',type:'button'},'⌖ Suggest nearest approved pickup stop');suggest.style.marginBottom='15px';
    suggest.onclick=()=>{
      if(!navigator.geolocation)return showToast('Geolocation is unavailable in this browser');
      navigator.geolocation.getCurrentPosition(pos=>{const best=nearestOption(eligibleHome,pos);if(best){pickupSelect.value=best.id;showToast(`Nearest listed stop: about ${(best.distance*1000).toFixed(0)} m away as the crow flies`)}else showToast('Stops do not have location coordinates yet')},()=>showToast('Location permission was not granted'),{enableHighAccuracy:false,timeout:7000});
    };body.append(suggest);
    const chosenText=node('p',{className:'status-note'},'Please select an available green passenger seat.');
    seatLayout(body,details,availability,seat=>{chosenText.textContent=`Seat ${seat.label} selected for both morning and evening trips.`;submit.disabled=false;submit.textContent=`Hold seat ${seat.label} ↗`});
    body.append(chosenText);
    const isFirst=!state.user||!state.user.welcome_redeemed_at;
    const discounts={1:isFirst?20:0,3:25,6:30,12:35};
    const base={bus:5000,hiace:6500,car:8000}[summary.vehicle_class]*months;const discount=discounts[months];
    // This is indicative client UX only. The final price is re-quoted on the SERVER.
    const fare=node('div',{className:'fare-breakdown'});
    const line=(label,value,cls='fare-line')=>{const row=node('div',{className:cls});row.append(node('span',{},label),node('strong',{},value));return row};
    fare.append(line('Regular plan price',formatBdt(base)),line(`Estimated discount (${discount}%)`,'− '+formatBdt(base*discount/100)),line('Indicative total',formatBdt(base*(100-discount)/100),'fare-line total'));body.append(fare);
    const actions=node('div',{className:'modal-actions'}),cancel=node('button',{className:'outline',type:'button'},'Cancel'),submit=node('button',{className:'primary',type:'button',disabled:true},'Choose a seat first');cancel.onclick=closeModal;actions.append(cancel,submit);body.append(actions);
    submit.onclick=async()=>{
      if(!state.user)return openLogin(()=>openSeats(summary));
      if(!state.selectedSeat)return;
      const mp=morning.find(s=>s.id===pickupSelect.value),md=morning.find(s=>s.id===dropSelect.value),ep=evening.find(s=>s.id===pickupSelect.value),ed=evening.find(s=>s.id===dropSelect.value);
      if(!mp||!md||!ep||!ed||!(mp.stop_order<md.stop_order)||!(ed.stop_order<ep.stop_order))return showToast('Pickup must be before office in the morning and reversed in the evening');
      submit.disabled=true;submit.textContent='Holding your chosen seat…';
      try{
        const reservation=await api('/api/reservations/hold',{method:'POST',auth:true,json:{serviceId:details.id,seatId:state.selectedSeat.id,startDate,months,pickupStopId:mp.id,dropoffStopId:md.id,idempotencyKey:crypto.randomUUID()}});
        showCheckout(reservation,state.selectedSeat.label,summary);
      }catch(e){showToast(e.message);submit.disabled=false;submit.textContent='Try holding seat again'}
    };
  }catch(e){body.replaceChildren(node('p',{className:'error-note'},e.message))}
}
async function showCheckout(held,seatLabel,summary){showModal('Seat held — complete payment','SECURE CHECKOUT');const body=$('modalContent');const box=node('div',{className:'summary-box'});
  box.append(node('h3',{},`${summary.code} · Seat ${seatLabel}`),node('p',{},`Subscription: ${held.months} month(s). Seat held until ${new Date(held.holdExpiresAt).toLocaleString('en-BD',{timeZone:'Asia/Dhaka'})} Dhaka time.`));body.append(box);
  const line=(a,b)=>{const r=node('div',{className:'fare-line'});r.append(node('span',{},a),node('strong',{},b));return r};
  body.append(line('Plan price',formatBdt(held.baseAmountBdt)),line(`Savings (${held.discountPercent}%)`,formatBdt(held.baseAmountBdt-held.amountBdt)));
  const total=line('Total to pay',formatBdt(held.amountBdt));total.classList.add('total');body.append(total);
  body.append(node('p',{className:'notice'},'The seat becomes valid only after the payment gateway verifies payment. An expired hold or suspicious transaction is never automatically confirmed.'));
  const actions=node('div',{className:'modal-actions'}),back=node('button',{className:'outline',type:'button'},'Close'),pay=node('button',{className:'primary',type:'button'},'Proceed to secure payment ↗');
  back.onclick=closeModal;pay.onclick=async()=>{pay.disabled=true;pay.textContent='Connecting to payment provider…';try{const result=await api(`/api/reservations/${held.id}/checkout`,{method:'POST',auth:true});window.location.assign(result.checkoutUrl)}catch(e){showToast(e.message);pay.disabled=false;pay.textContent='Try opening payment'}};
  actions.append(back,pay);body.append(actions);
}
