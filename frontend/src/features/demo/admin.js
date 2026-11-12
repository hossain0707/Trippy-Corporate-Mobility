/** Separate admin lifecycle for public, simulated demo services. */
import {node,api,showToast} from '../../core/context.js';

export async function loadDemoManagement(container,vehicles,reload){
  container.replaceChildren();
  container.append(node('h3',{},'Dhaka-wide demo services'));
  container.append(node('p',{className:'helper-copy'},
    'Publish a clearly labelled practice bus anywhere in Dhaka. Demo bookings cost ৳0, never enter payment or real reservations, and remain in history after a demo is removed.'));
  const list=await api('/api/admin/demo/services',{auth:true});
  const current=list.filter(s=>!s.removed_at);
  const registry=node('div',{className:'ops-demo-list'});
  if(!current.length)registry.append(node('div',{className:'empty-message'},'No demonstration services published. Publish the existing DEMO-BUS-001 below.'));
  for(const s of current){
    const card=node('article',{className:'ops-demo-row'});
    const details=node('div');
    details.append(node('strong',{},s.name),
      node('p',{},s.registration_no+' · Dhaka-wide · '+s.licensed_passenger_capacity+' seats · '+s.bookings_count+' demo bookings'));
    const state=node('span',{className:'demo-service-badge'},s.is_published?'PUBLISHED DEMO':'HIDDEN DEMO');
    details.append(state);
    const actions=node('div',{className:'ops-demo-actions'});
    const toggle=node('button',{type:'button',className:'outline'},s.is_published?'Hide from customers':'Publish demo');
    toggle.onclick=async()=>{
      toggle.disabled=true;
      try{
        await api('/api/admin/demo/services/'+s.id,{method:'PATCH',auth:true,json:{published:!s.is_published}});
        showToast(s.is_published?'Demo hidden from customers.':'Demo visible to Dhaka visitors.');
        reload();
      }catch(e){showToast(e.message);toggle.disabled=false}
    };
    const remove=node('button',{type:'button',className:'outline ops-demo-remove'},'Remove demo');
    remove.onclick=async()=>{
      if(!confirm('Remove '+s.name+' from customer searches? This will NOT erase previous demo booking history.'))return;
      remove.disabled=true;
      try{
        await api('/api/admin/demo/services/'+s.id,{method:'DELETE',auth:true});
        showToast('Demo removed from the customer website; booking history retained.');
        reload();
      }catch(e){showToast(e.message);remove.disabled=false}
    };
    actions.append(toggle,remove);
    card.append(details,actions);
    registry.append(card);
  }
  container.append(registry);
  const eligible=vehicles.filter(v=>v.registration_no.toUpperCase().startsWith('DEMO-')
    && !v.active && !v.documents_verified && !v.seat_map_verified
    && v.mapped_seats===v.licensed_passenger_capacity
    && !current.some(s=>s.vehicle_id===v.id));
  if(eligible.length){
    const form=node('form',{className:'ops-demo-publish'});
    form.append(node('h4',{},'Publish an inactive demo vehicle'));
    const vehicleLabel=node('label',{},'Demo fleet vehicle');
    const select=node('select',{name:'demoVehicleId'});
    for(const v of eligible)select.append(node('option',{value:v.id},
      v.registration_no+' · '+v.class+' · '+v.mapped_seats+' seats'));
    vehicleLabel.append(select);
    const nameLabel=node('label',{},'Visible demo service name');
    const name=node('input',{name:'demoName',required:'',minlength:'4',maxlength:'80',value:'Demo Bus'});
    nameLabel.append(name);
    const submit=node('button',{type:'submit',className:'primary'},'Publish demo across Dhaka');
    form.append(vehicleLabel,nameLabel,submit,
      node('p',{className:'ops-help'},'Never certify this fictional vehicle as a real licensed operator. Publishing this simulation does not require real documents.'));
    form.onsubmit=async e=>{
      e.preventDefault();submit.disabled=true;
      try{
        await api('/api/admin/demo/services',{method:'POST',auth:true,json:{vehicleId:select.value,name:name.value.trim()}});
        showToast('Demo published to Dhaka search results. No real journey or payment enabled.');
        reload();
      }catch(error){showToast(error.message);submit.disabled=false}
    };
    container.append(form);
  }
}
