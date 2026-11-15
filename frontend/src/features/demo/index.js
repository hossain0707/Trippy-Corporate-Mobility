/** Guided demo checkout: indicative real fares, simulated payment, zero actual charge. */
import {$,node,state,api,showToast,showModal,closeModal,formatBdt,vehicleNames} from '../../core/context.js';
import {seatLayout} from '../booking/seatMap.js';
import {openLogin} from '../auth/index.js';

const paymentMethods = [
  ['bkash_demo','bKash','Mobile wallet · demo'],
  ['nagad_demo','Nagad','Mobile wallet · simulation'],
  ['card_demo','Debit / credit card','Card checkout · demo'],
  ['bank_demo','Bank transfer','Bank transfer · demo'],
];
export const paymentLabel = id => paymentMethods.find(([key])=>key===id)?.[1] || 'Not selected';

export function priceRows(container,fare) {
  const line=(label,value,cls='')=>{
    const item=node('div',{className:'demo-fare-line '+cls});
    item.append(node('span',{},label),node('strong',{},value));
    container.append(item);
  };
  line('Monthly fare',formatBdt(fare.monthlyRateBdt));
  line('Plan subtotal',formatBdt(fare.baseAmountBdt));
  line('Sample discount ('+fare.discountPercent+'%)','− '+formatBdt(fare.discountAmountBdt));
  line('Estimated total',formatBdt(fare.estimatedTotalBdt),'demo-fare-estimate');
  line('Charged in demo','৳0','demo-fare-free');
  container.append(node('p',{className:'demo-disclaimer'},
    'Sample fares only. Real discounts and eligibility may differ. No payment is collected.'));
}

export function demoCard(service,getSearch) {
  const card=node('article',{className:'route-card demo-service-card'});
  const top=node('div',{className:'demo-service-card-top'});
  top.append(node('span',{className:'demo-service-badge'},'DEMO · NOT A REAL TRIP'),
    node('span',{className:'demo-scope'},'Try any Dhaka route'));
  card.append(top);
  card.append(node('h3',{},service.name));
  card.append(node('p',{className:'demo-description'},
    'Try choosing a seat, reviewing the fare and checking out. No real trip or payment.'));
  const footer=node('div',{className:'demo-service-footer'});
  const info=node('div',{className:'demo-service-price'});
  info.append(node('strong',{},service.selectable_seats+' demo seats'),
    node('span',{},'Sample fare · No payment'));
  footer.append(info);
  const action=node('button',{className:'primary demo-action',type:'button'},'Try demo booking');
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
  showModal('Demo booking','DEMO · NO REAL TRIP');
  const body=$('modalContent');
  body.replaceChildren(node('p',{className:'status-note'},'Loading demo seats and fares…'));

  try{
    const availability=await api('/api/demo/services/'+encodeURIComponent(service.id)+'/seats?'
      +new URLSearchParams({startDate:q.startDate,months:String(q.months)}));
    const fare=availability.farePreview;
    if(!fare || !fare.isIllustrative)throw new Error('Demo price preview unavailable');
    body.replaceChildren();

    const notice=node('div',{className:'demo-modal-notice'});
    notice.append(node('strong',{},'Demo booking · No payment'),
      node('p',{},'Explore the checkout process safely. No real trip is booked, and no payment details are needed.'));
    body.append(notice);

    const stage=node('div',{className:'demo-progress','aria-label':'Booking steps'});
    stage.append(node('span',{className:'demo-progress-step active'},'1 · Choose seat'),
      node('span',{className:'demo-progress-step'},'2 · Checkout'),
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
    const pickup=zoneInput('Pickup area','e.g. Uttara Sector 7',q.pickup);
    const office=zoneInput('Destination','e.g. Banani',q.office);
    seatStep.append(zoneFields);
    seatStep.append(node('p',{className:'demo-date-line'},
      q.months+' month'+(q.months===1?'':'s')+' · Starts '+q.startDate+' · Fare shown next'));

    const hint=node('p',{className:'status-note'},'Select an available seat.');
    const continueButton=node('button',{type:'button',className:'primary',disabled:true},'Select a seat to continue');
    seatLayout(seatStep,{vehicle_class:service.vehicle_class},availability,seat=>{
      selectedSeat=seat;
      continueButton.disabled=false;
      continueButton.textContent='Continue with seat '+seat.label+' →';
      hint.textContent='Seat '+seat.label+' selected.';
    });
    seatStep.append(hint);
    const seatActions=node('div',{className:'modal-actions'});
    const cancel=node('button',{type:'button',className:'outline'},'Close');
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
        showToast('Choose different pickup and destination areas.');return;
      }
      first.classList.remove('active');second.classList.add('active');
      seatStep.classList.add('hidden');
      checkoutStep.classList.remove('hidden');
      checkoutStep.replaceChildren();

      checkoutStep.append(node('h3',{className:'demo-checkout-title'},'Review demo booking'));
      const itinerary=node('div',{className:'demo-itinerary'});
      itinerary.append(node('strong',{},service.name+' · Seat '+selectedSeat.label),
        node('p',{},p+' → '+o),
        node('p',{},q.startDate+' · '+q.months+'-month plan'));
      checkoutStep.append(itinerary);

      const priceCard=node('section',{className:'demo-fare-card'});
      priceCard.append(node('h4',{},'Fare summary'));
      priceRows(priceCard,fare);
      checkoutStep.append(priceCard);

      checkoutStep.append(node('h4',{className:'demo-pay-title'},'Payment method (demo)'));
      checkoutStep.append(node('p',{className:'demo-disclaimer'},
        'Choose a method to preview checkout. No payment provider will open.'));
      const methods=node('div',{className:'demo-payment-options',role:'radiogroup','aria-label':'Simulated payment method'});
      let selectedMethod=null;
      const actions=node('div',{className:'modal-actions'});
      const back=node('button',{type:'button',className:'outline'},'← Edit seat');
      const submit=node('button',{type:'button',className:'primary',disabled:true},'Complete demo booking · ৳0');
      back.onclick=()=>{
        checkoutStep.classList.add('hidden');seatStep.classList.remove('hidden');
        second.classList.remove('active');first.classList.add('active');
      };
      const acknowledgement=node('label',{className:'demo-acknowledgement'});
      const agree=node('input',{type:'checkbox'});
      acknowledgement.append(agree,node('span',{},'I understand this is a demo. No money is charged or real trip booked.'));
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
        submit.disabled=true;submit.textContent='Saving demo booking…';
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
          receipt.append(node('span',{className:'demo-service-badge'},'DEMO BOOKED · NO PAYMENT'));
          receipt.append(node('h3',{},'Demo booking confirmed'));
          receipt.append(node('p',{className:'demo-disclaimer'},
            'Demo only. Not valid for travel or as proof of payment. Charged: ৳0.'));
          const summary=node('div',{className:'demo-receipt-details'});
          const row=(label,value)=>{
            const el=node('div',{className:'demo-receipt-row'});
            el.append(node('span',{},label),node('strong',{},value));summary.append(el);
          };
          row('Demo reference','DEMO-'+String(booking.id).slice(0,8).toUpperCase());
          row('Route',p+' → '+o);
          row('Seat',selectedSeat.label);
          row('Period',q.startDate+' · '+q.months+' month'+(q.months===1?'':'s'));
          row('Sample fare',formatBdt(booking.estimated_total_bdt));
          row('Payment method',paymentLabel(booking.payment_method)+' (simulated)');
          row('Payment status','Demo only · Not paid');
          row('Amount charged','৳0');
          receipt.append(summary);
          const view=node('button',{type:'button',className:'primary'},'View in My passes');
          view.onclick=()=>{closeModal();document.querySelector('[data-page="passes"]')?.click()};
          receipt.append(view);
          body.append(receipt);
          showToast('Demo booking saved. No payment was made.');
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
