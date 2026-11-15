"use strict";
import {$,node,state,api,showToast,showModal,closeModal} from '../../core/context.js';
import {openLogin} from '../auth/index.js';

$('supportBtn').onclick=()=>{
  if(!state.user)return openLogin(()=>$('supportBtn').click());
  showModal('Report an issue','PASSENGER SUPPORT');
  const body=$('modalContent');
  body.append(node('p',{className:'notice'},'Not an emergency hotline. If you are in immediate danger, contact local emergency services directly.'));
  const form=node('form',{className:'form-stack'});
  const category=node('select',{name:'category','aria-label':'Issue type'});
  for(const [value,label] of [['safety','Passenger safety'],['driver','Driver conduct'],['payment','Billing'],['route','Route problem'],['accessibility','Accessibility'],['other','Other']]){
    category.append(node('option',{value},label));
  }
  const details=node('textarea',{name:'message',rows:'5',required:'','aria-label':'Describe concern',placeholder:'Describe what happened, when, and the route involved.'});
  details.maxLength=2000;details.minLength=10;
  const send=node('button',{className:'primary',type:'submit'},'Send report');
  form.append(node('label',{},'Issue type'),category,node('label',{},'What happened?'),details,send);
  form.onsubmit=async e=>{e.preventDefault();send.disabled=true;
    try{const ticket=await api('/api/support/tickets',{method:'POST',auth:true,json:{category:category.value,message:details.value}});
      showToast('Report received: '+String(ticket.id).slice(0,8));closeModal();
    }catch(err){showToast(err.message);send.disabled=false}
  };
  body.append(form);
};
