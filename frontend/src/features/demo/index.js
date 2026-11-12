/** Guided demo checkout: indicative real fares, simulated payment, zero actual charge. */
import {$,node,state,api,showToast,showModal,closeModal,formatBdt,vehicleNames} from '../../core/context.js';
import {seatLayout} from '../booking/seatMap.js';
import {openLogin} from '../auth/index.js';

const paymentMethods = [
  ['bkash_demo','bKash','Mobile wallet · simulation'],
  ['nagad_demo','Nagad','Mobile wallet · simulation'],
  ['card_demo','Debit / credit card','Card checkout · simulation'],
  ['bank_demo','Bank transfer','Bank payment · simulation'],
];
export const paymentLabel = id => paymentMethods.find(([key])=>key===id)?.[1] || 'Not selected';

export function priceRows(container,fare) {
  const line=(label,value,cls='')=>{
    const item=node('div',{className:'demo-fare-line '+cls});
    item.append(node('span',{},label),node('strong',{},value));
    container.append(item);
  };
  line('Monthly example rate',formatBdt(fare.monthlyRateBdt));
  line('Base subscription price',formatBdt(fare.baseAmountBdt));
  line('Example discount ('+fare.discountPercent+'%)','− '+formatBdt(fare.discountAmountBdt));
  line('Illustrative fare after discount',formatBdt(fare.estimatedTotalBdt),'demo-fare-estimate');
  line('Amount actually charged','৳0','demo-fare-free');
  container.append(node('p',{className:'demo-disclaimer'},
    'Illustrative pricing only. Promotions and eligibility for actual bookings may differ. No payment is processed.'));
}

export function demoCard(service,getSearch) {
  const card=node('article',{className:'route-card demo-service-card'});
  const top=node('div',{className:'demo-service-card-top'});
  top.append(node('span',{className:'demo-service-badge'},'DEMO · NO REAL VEHICLE'),
    node('span',{className:'demo-scope'},'Anywhere in Dhaka'));
  card.append(top);
  card.append(node('h3',{},service.name));
  card.append(node('p',{className:'demo-description'},
    'Explore a realistic seat booking, price estimate and simulated checkout. No payment or transport is provided.'));
  const footer=node('div',{className:'demo-service-footer'});
  const info=node('div',{className:'demo-service-price'});
  info.append(node('strong',{},service.selectable_seats+' demo seats'),
    node('span',{},'Sample pricing · ৳0 actually charged'));
  footer.append(info);
  const action=node('button',{className:'primary demo-action',type:'button'},'Try the demo checkout');
  action.onclick=()=>openDemoSeats(service,getSearch);
  footer.append(action);
  card.append(footer);
  return card;
}

export async function openDemoSeats(service,getSearch){
  const q=getSearch();
  state.selectedSeat=null;
  const idempotencyKey=crypto.randomUUID();
  let selectedSeat=null;
  showModal('Practice a complete booking','DEMO ONLY · NO REAL TRANSPORT');
  const body=$('modalContent');
  body.replaceChildren(node('p',{className:'status-note'},'Loading demonstration seat availability and pricing…'));

  try{
    const availability=await api('/api/demo/services/'+encodeURIComponent(service.id)+'/seats?'
      +new URLSearchParams({startDate:q.startDate,months:String(q.months)}));
    const fare=availability.farePreview;
    if(!fare || !fare.isIllustrative)throw new Error('Demo price preview unavailable');
    body.replaceChildren();

    const notice=node('div',{className:'demo-modal-notice'});
    notice.append(node('strong',{},'Learning experience · no real booking or payment'),
      node('p',{},'This demo illustrates a real booking, including fares and payment-method selection. You will never be asked for a PIN, OTP or card number.'));
    body.append(notice);

    const stage=node('div',{className:'demo-progress','aria-label':'Booking steps'});
    stage.append(node('span',{className:'demo-progress-step active'},'1 · Select seat'),
      node('span',{className:'demo-progress-step'},'2 · Example checkout'),
      node('span',{className:'demo-progress-step'},'3 · Receipt'));
    body.append(stage);
    const first=stage.children[0],second=stage.children[1],third=stage.children[2];

    const seatStep=node('section',{className:'demo-seat-step'});
    const zoneFields=node('div',{className:'demo-zone-fields'});
    const zoneInput=(label,placeholder,value)=>{
      const wrap=node('label',{},label);
      const input=node('input',{type:'text',maxlength:'100',minlength:'2',required:'',placeholder,autocomplete:'off'});
      input.value=value;wrap.append(input);zoneFields.append(wrap);return input;
    };
    const pickup=zoneInput('Dhaka pickup area','e.g. Uttara Sector 7',q.pickup);
    const office=zoneInput('Dhaka destination','e.g. Banani',q.office);
    seatStep.append(zoneFields);
    seatStep.append(node('p',{className:'demo-date-line'},
      q.months+' month'+(q.months===1?'':'s')+' · Starts '+q.startDate+' · Example fares shown at checkout'));

    const hint=node('p',{className:'status-note'},'Select one available passenger seat.');
    const continueButton=node('button',{type:'button',className:'primary',disabled:true},'Choose a seat to continue');
    seatLayout(seatStep,{vehicle_class:service.vehicle_class},availability,seat=>{
      selectedSeat=seat;
      continueButton.disabled=false;
      continueButton.textContent='Continue with seat '+seat.label+' →';
      hint.textContent='Seat '+seat.label+' selected for this demonstration.';
    });
    seatStep.append(hint);
    const seatActions=node('div',{className:'modal-actions'});
    const cancel=node('button',{type:'button',className:'outline'},'Close demo');
    cancel.onclick=closeModal;
    seatActions.append(cancel,continueButton);
    seatStep.append(seatActions);
    body.append(seatStep);

    const checkoutStep=node('section',{className:'demo-checkout-step hidden'});
    body.append(checkoutStep);

    continueButton.onclick=()=>{
      if(!selectedSeat)return;
      const p=pickup.value.trim(),o=office.value.trim();
      if(p.length<2||o.length<2||p.toLocaleLowerCase()===o.toLocaleLowerCase()){
        showToast('Enter two different Dhaka areas for this example itinerary.');return;
      }
      first.classList.remove('active');second.classList.add('active');
      seatStep.classList.add('hidden');
      checkoutStep.classList.remove('hidden');
      checkoutStep.replaceChildren();

      checkoutStep.append(node('h3',{className:'demo-checkout-title'},'Review your demo checkout'));
      const itinerary=node('div',{className:'demo-itinerary'});
      itinerary.append(node('strong',{},service.name+' · Seat '+selectedSeat.label),
        node('p',{},p+' → '+o),
        node('p',{},q.startDate+' · '+q.months+'-month example subscription'));
      checkoutStep.append(itinerary);

      const priceCard=node('section',{className:'demo-fare-card'});
      priceCard.append(node('h4',{},'Example fare breakdown'));
      priceRows(priceCard,fare);
      checkoutStep.append(priceCard);

      checkoutStep.append(node('h4',{className:'demo-pay-title'},'Choose a simulated payment method'));
      checkoutStep.append(node('p',{className:'demo-disclaimer'},
        'These options illustrate checkout only. No real bKash, Nagad, bank or card connection will be opened.'));
      const methods=node('div',{className:'demo-payment-options',role:'radiogroup','aria-label':'Simulated payment method'});
      let selectedMethod=null;
      const actions=node('div',{className:'modal-actions'});
      const back=node('button',{type:'button',className:'outline'},'← Edit seat');
      const submit=node('button',{type:'button',className:'primary',disabled:true},'Complete simulated payment · ৳0');
      back.onclick=()=>{
        checkoutStep.classList.add('hidden');seatStep.classList.remove('hidden');
        second.classList.remove('active');first.classList.add('active');
      };
      const acknowledgement=node('label',{className:'demo-acknowledgement'});
      const agree=node('input',{type:'checkbox'});
      acknowledgement.append(agree,node('span',{},'I understand this is a simulation. No money is charged and no real seat is reserved.'));
      const update=()=>{submit.disabled=!(selectedMethod&&agree.checked)};
      agree.onchange=update;
      for(const [key,label,subtitle] of paymentMethods){
        const option=node('label',{className:'demo-payment-option'});
        const input=node('input',{type:'radio',name:'demo-payment-method',value:key});
        input.onchange=()=>{
          selectedMethod=key;
          methods.querySelectorAll('.demo-payment-option').forEach(x=>x.classList.remove('selected'));
          option.classList.add('selected');
          update();
        };
        option.append(input);
        const text=node('span');
        text.append(node('strong',{},label+' · DEMO'),node('small',{},subtitle));
        option.append(text);methods.append(option);
      }
      checkoutStep.append(methods,acknowledgement);
      actions.append(back,submit);
      checkoutStep.append(actions);

      submit.onclick=async()=>{
        if(!selectedMethod||!agree.checked||!selectedSeat)return;
        if(!state.user){
          showToast('Sign in to save the simulated booking. No payment will occur.');
          openLogin(()=>openDemoSeats(service,getSearch));
          return;
        }
        submit.disabled=true;submit.textContent='Saving your practice receipt…';
        try{
          const booking=await api('/api/demo/services/'+encodeURIComponent(service.id)+'/bookings',{
            method:'POST',auth:true,json:{
              seatId:selectedSeat.id,pickupZone:p,officeZone:o,startDate:q.startDate,months:q.months,
              idempotencyKey,paymentMethod:selectedMethod,
            },
          });
          checkoutStep.classList.add('hidden');
          second.classList.remove('active');third.classList.add('active');
          const receipt=node('section',{className:'demo-receipt'});
          receipt.append(node('span',{className:'demo-service-badge'},'DEMO BOOKED · SIMULATED PAYMENT'));
          receipt.append(node('h3',{},'Your practice booking is complete'));
          receipt.append(node('p',{className:'demo-disclaimer'},
            'This is not a real transport ticket or payment receipt. No money has been collected.'));
          const summary=node('div',{className:'demo-receipt-details'});
          const row=(label,value)=>{
            const el=node('div',{className:'demo-receipt-row'});
            el.append(node('span',{},label),node('strong',{},value));summary.append(el);
          };
          row('Demo reference','DEMO-'+String(booking.id).slice(0,8).toUpperCase());
          row('Route',p+' → '+o);
          row('Seat',selectedSeat.label);
          row('Period',q.startDate+' · '+q.months+' month'+(q.months===1?'':'s'));
          row('Example fare',formatBdt(booking.estimated_total_bdt));
          row('Payment method',paymentLabel(booking.payment_method)+' (simulated)');
          row('Payment status','Simulated — not paid');
          row('Amount charged','৳0');
          receipt.append(summary);
          const view=node('button',{type:'button',className:'primary'},'View in My passes');
          view.onclick=()=>{closeModal();document.querySelector('[data-page="passes"]')?.click()};
          receipt.append(view);
          body.append(receipt);
          showToast('Demo Booked. No real charge or journey was created.');
        }catch(e){
          showToast(e.message);
          submit.disabled=false;submit.textContent='Complete simulated payment · ৳0';
        }
      };
    };
  }catch(e){
    body.replaceChildren(node('p',{className:'error-note'},'Demo checkout unavailable: '+e.message));
  }
}
