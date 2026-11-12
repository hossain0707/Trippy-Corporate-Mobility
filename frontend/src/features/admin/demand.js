import {node,api,showToast,formatTime} from '../../core/context.js';

const kinds={
  new_route:'New corridor',
  new_stop:'Additional stop',
  more_seats:'More seats',
};
const states={
  open:'Open',contacted:'Contacted',offered:'Service offered',closed:'Closed',
};
export function renderDemandConsole(container,requests,summary,reload){
  container.replaceChildren();
  const intro=node('p',{className:'ops-muted'},
    'Review demand across Dhaka and decide which verified stops, routes or vehicles to add. Requests do not publish services automatically.');
  container.append(intro);
  if(summary.length){
    const head=node('div',{className:'ops-demand-head'});
    head.append(node('h4',{},'Popular requested corridors'),
      node('span',{},'Grouped by pickup and destination'));
    container.append(head);
    const groups=node('div',{className:'ops-demand-groups'});
    for(const group of summary.slice(0,8)){
      const item=node('article',{className:'ops-demand-group'});
      item.append(node('strong',{},group.pickup+' → '+group.destination),
        node('span',{className:'ops-demand-count'},
          group.open_requests+' open · '+group.total_requests+' requests'),
        node('small',{},(kinds[group.request_kind]||'Commute request')+
          ' · '+group.interested_riders+' interested riders'));
      groups.append(item);
    }
    container.append(groups);
  }
  container.append(node('h4',{className:'ops-queue-heading'},'Passenger requests'));
  if(!requests.length){
    container.append(node('div',{className:'empty-message'},
      'No requests yet. New customer requests will appear here.'));
    return;
  }
  for(const request of requests.slice(0,100)){
    const item=node('article',{className:'ops-request-card'});
    const heading=node('div',{className:'ops-request-head'});
    heading.append(node('strong',{},request.home_zone+' → '+request.office_zone),
      node('span',{className:'ops-status'+(request.status==='open'?'':' ops-status-active')},
        states[request.status]||request.status));
    item.append(heading);
    const meta=[
      kinds[request.request_kind]||'New route',
      request.preferred_class||'Any vehicle',
      request.preferred_morning_time?'Morning '+formatTime(request.preferred_morning_time):null,
      request.preferred_evening_time?'Return '+formatTime(request.preferred_evening_time):null,
    ].filter(Boolean).join(' · ');
    item.append(node('p',{className:'ops-muted'},meta));
    if(request.notes)item.append(node('p',{className:'ops-request-note'},request.notes));
    const action=node('div',{className:'ops-request-actions'});
    const status=node('select',{title:'Update request status','aria-label':'Request review status'});
    for(const [value,label] of Object.entries(states)){
      const opt=node('option',{value},label);
      opt.selected=request.status===value;status.append(opt);
    }
    const note=node('input',{type:'text',maxlength:'500',
      placeholder:'Internal review note (optional)','aria-label':'Review note'});
    note.value=request.resolution_note||'';
    const button=node('button',{type:'button',className:'primary'},'Save review');
    button.onclick=async()=>{
      button.disabled=true;
      try{
        await api('/api/admin/demand/'+request.id,{
          method:'PATCH',auth:true,json:{
            status:status.value,
            ...(note.value.trim()?{resolutionNote:note.value.trim()}:{resolutionNote:null}),
          },
        });
        showToast('Demand review updated.');
        reload();
      }catch(error){showToast(error.message);button.disabled=false}
    };
    action.append(status,note,button);
    item.append(action);container.append(item);
  }
}
