import {getSearch} from '../search/index.js';
import {$,node,state,api,showToast,showModal,closeModal} from '../../core/context.js';
import {openLogin} from '../auth/index.js';

function formField(labelText,name,type='text',required=false,value=''){
  const label=node('label',{},labelText);
  const input=node('input',{name,type,...(type==='text'?{maxlength:'100'}:{})});
  input.required=required;
  input.value=value;
  label.append(input);
  return {label,input};
}
$('demandBtn').onclick=()=>{
  if(!state.user)return openLogin(showForm);
  showForm();
};

function showForm(){
    showModal('Tell us where you commute','REQUEST A ROUTE OR STOP');
    const body=$('modalContent');
    body.append(node('p',{className:'status-note'},
      'Already have a route in mind? Tell us where you travel and when. TRIPPY reviews requests before adding stops or arranging a new service.'));
    const form=node('form',{className:'form-stack demand-request-form'});
    const values=getSearch();
    const pickup=formField('Pickup area','homeZone','text',true,values.pickup);
    const drop=formField('Destination','officeZone','text',true,values.office);
    const purpose=node('label',{},'What do you need?');
    const kind=node('select',{name:'requestKind'});
    for(const [v,label] of [
      ['new_route','Request a new route'],
      ['new_stop','Request an additional stop'],
      ['more_seats','More seats on an existing route'],
    ])kind.append(node('option',{value:v},label));
    purpose.append(kind);
    const car=node('label',{},'Preferred vehicle');
    const klass=node('select',{name:'vehicleClass'});
    for(const [v,label] of [['','No preference'],['bus','Bus'],['hiace','Hiace'],['car','Shared car']])
      klass.append(node('option',{value:v},label));
    car.append(klass);
    const times=node('div',{className:'demand-time-grid'});
    const morning=formField('Preferred morning time','preferredMorningTime','time',false);
    const evening=formField('Preferred return time','preferredEveningTime','time',false);
    times.append(morning.label,evening.label);
    const notes=node('label',{},'Other details (optional)');
    const details=node('textarea',{name:'notes',maxlength:'500',rows:'3',
      placeholder:'Nearby landmark, preferred days or accessibility needs'});
    notes.append(details);
    const explanation=node('p',{className:'demand-hint'},
      'Requests help us plan demand. They do not guarantee a vehicle, stop, route or pickup time.');
    const submit=node('button',{type:'submit',className:'primary'},'Send commute request');
    form.append(purpose,pickup.label,drop.label,car,times,notes,explanation,submit);
    form.onsubmit=async e=>{
      e.preventDefault();
      const home=pickup.input.value.trim(),office=drop.input.value.trim();
      if(home.toLocaleLowerCase()===office.toLocaleLowerCase()){
        return showToast('Choose different pickup and destination areas.');
      }
      submit.disabled=true;
      try{
        const result=await api('/api/demand',{
          method:'POST',auth:true,
          json:{
            homeZone:home,officeZone:office,requestKind:kind.value,
            ...(klass.value?{vehicleClass:klass.value}:{}),
            ...(morning.input.value?{preferredMorningTime:morning.input.value}:{}),
            ...(evening.input.value?{preferredEveningTime:evening.input.value}:{}),
            ...(details.value.trim()?{notes:details.value.trim()}:{}),
          },
        });
        body.replaceChildren();
        const success=node('section',{className:'demand-success'});
        success.append(node('span',{className:'demand-success-check'},'✓'),
          node('h3',{},'Request received'),
          node('p',{},'We’ve received your commute details. TRIPPY Operations will review the request as we plan our service network.'),
          node('p',{className:'demand-reference'},'Reference · '+String(result.id).slice(0,8).toUpperCase()));
        const close=node('button',{type:'button',className:'primary'},'Done');
        close.onclick=closeModal;
        success.append(close);body.append(success);
        showToast('Commute request received.');
      }catch(error){showToast(error.message);submit.disabled=false}
    };
    body.append(form);
  };
}
