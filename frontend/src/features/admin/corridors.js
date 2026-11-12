import {node,api,showToast} from '../../core/context.js';

function selectControl(label,items){
  const wrap=node('label',{},label),select=node('select');
  for(const [value,name] of items)select.append(node('option',{value},name));
  wrap.append(select);
  return {wrap,select};
}
function textField(label,placeholder=''){
  const wrap=node('label',{},label);
  const input=node('input',{type:'text',placeholder,required:''});
  wrap.append(input);return {wrap,input};
}
export function renderRouteRevision(root,{routes,stops},reload){
  const approved=stops.filter(s=>s.approved&&s.active);
  const form=node('form',{className:'ops-corridor-editor'});
  form.append(node('h4',{},'Plan a revised corridor'));
  form.append(node('p',{className:'ops-help'},
    'Make a new route version when you add or reorder stops. Existing scheduled services and passenger bookings remain unchanged until you explicitly assign a new service.'));
  const source=selectControl('Copy an existing route',[['','Choose a corridor'],...routes.map(r=>[r.id,r.name])]);
  const name=textField('New route name','Abdullahpur → Motijheel · revised');
  const from=textField('Start area','Abdullahpur');
  const to=textField('Final destination','Motijheel');
  const add=selectControl('Approved stop to add',approved.map(s=>[s.id,s.name+' · '+s.zone]));
  const addButton=node('button',{type:'button',className:'outline'},'+ Add stop');
  const list=node('div',{className:'stop-order-list'});
  const submit=node('button',{type:'submit',className:'primary'},'Create revised route');
  let order=[];
  const render=()=>{
    list.replaceChildren();
    for(let i=0;i<order.length;i++){
      const stop=stops.find(s=>s.id===order[i]);
      const row=node('div',{className:'stop-order-row'});
      row.append(node('span',{},(i+1)+'. '+(stop?.name||'Approved stop')));
      const up=node('button',{type:'button'},'↑');
      const down=node('button',{type:'button'},'↓');
      const remove=node('button',{type:'button'},'×');
      up.disabled=i===0;down.disabled=i===order.length-1;
      up.onclick=()=>{[order[i-1],order[i]]=[order[i],order[i-1]];render()};
      down.onclick=()=>{[order[i+1],order[i]]=[order[i],order[i+1]];render()};
      remove.onclick=()=>{order.splice(i,1);render()};
      row.append(up,down,remove);list.append(row);
    }
    if(!order.length)list.append(node('p',{className:'ops-muted'},
      'Load a corridor to edit its stops, or start a new list.'));
  };
  source.select.onchange=async()=>{
    if(!source.select.value){order=[];render();return}
    try{
      const loaded=await api('/api/admin/routes/'+source.select.value+'/stops',{auth:true});
      order=loaded.stops.filter(s=>s.direction==='morning')
        .sort((a,b)=>a.stop_order-b.stop_order).map(s=>s.stop_id);
      name.input.value=loaded.route.name+' · updated';
      from.input.value=loaded.route.home_zone;
      to.input.value=loaded.route.office_zone;
      render();
    }catch(error){showToast(error.message)}
  };
  addButton.onclick=()=>{
    const id=add.select.value;
    if(!id||order.includes(id)){showToast('Select a different approved stop.');return}
    order.push(id);render();
  };
  form.onsubmit=async e=>{
    e.preventDefault();
    if(order.length<2)return showToast('Choose at least two ordered stops.');
    submit.disabled=true;
    try{
      await api('/api/admin/routes',{
        method:'POST',auth:true,json:{
          name:name.input.value.trim(),homeZone:from.input.value.trim(),
          officeZone:to.input.value.trim(),morningStops:order,
          eveningStops:[...order].reverse(),
        },
      });
      showToast('New route version created. Schedule and verify a vehicle before publishing.');
      reload();
    }catch(error){showToast(error.message);submit.disabled=false}
  };
  form.append(source.wrap,name.wrap,from.wrap,to.wrap,add.wrap,addButton,list,submit);
  root.append(form);
  render();
}

export function renderTimetableEditor(root,{allServices},reload){
  const panel=node('section',{className:'ops-corridor-editor'});
  panel.append(node('h4',{},'Planned times at every stop'));
  panel.append(node('p',{className:'ops-help'},
    'Every scheduled vehicle needs a time at each approved stop for both directions. The first time must match the service departure. Active or booked timetables cannot be edited.'));
  const service=selectControl('Scheduled service',[['','Choose a vehicle schedule'],
    ...allServices.map(s=>[s.id,s.code+(s.active?' · active':' · draft')])]);
  panel.append(service.wrap);
  const times=node('div',{className:'ops-stop-times'});
  panel.append(times);
  const save=node('button',{type:'button',className:'primary'},'Save complete timetable');
  save.disabled=true;
  panel.append(save);
  let schedule=null;
  service.select.onchange=async()=>{
    times.replaceChildren();schedule=null;save.disabled=true;
    if(!service.select.value)return;
    try{
      const result=await api('/api/admin/services/'+service.select.value+'/timetable',{auth:true});
      schedule=result;
      if(result.service.active){
        times.append(node('p',{className:'ops-muted'},
          'This service is active. Create a revised corridor and new scheduled service to change its times.'));
        return;
      }
      for(const direction of ['morning','evening']){
        times.append(node('h5',{},direction==='morning'?'Morning journey':'Evening return'));
        const stops=result.stops.filter(s=>s.direction===direction)
          .sort((a,b)=>a.stop_order-b.stop_order);
        for(const [index,stop] of stops.entries()){
          const line=node('label',{className:'ops-timetable-row'});
          line.append(node('span',{},(index+1)+'. '+stop.name));
          const input=node('input',{type:'time',required:'',
            'aria-label':direction+' arrival at '+stop.name});
          input.value=stop.planned_arrival?.slice(0,5) ||
            (index===0?(direction==='morning'
              ?result.service.morning_departure:result.service.evening_departure).slice(0,5):'');
          input.dataset.direction=direction;
          input.dataset.stopId=stop.stop_id;
          line.append(input);times.append(line);
        }
      }
      save.disabled=false;
    }catch(error){times.append(node('p',{className:'error-note'},error.message))}
  };
  save.onclick=async()=>{
    if(!schedule)return;
    const inputs=[...times.querySelectorAll('input[type="time"]')];
    if(inputs.some(input=>!input.value))return showToast('Enter a time for every stop.');
    save.disabled=true;
    try{
      await api('/api/admin/services/'+schedule.service.id+'/timetable',{
        method:'PUT',auth:true,json:{
          stops:inputs.map(input=>({
            stopId:input.dataset.stopId,direction:input.dataset.direction,
            plannedArrival:input.value,
          })),
        },
      });
      showToast('Timetable saved. Review drivers, documents and route before activation.');
      reload();
    }catch(error){showToast(error.message);save.disabled=false}
  };
  root.append(panel);
}
