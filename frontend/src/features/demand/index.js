import {getSearch} from '../search/index.js';
import {$,node,state,api,showToast,showModal,closeModal} from '../../core/context.js';
import {openLogin} from '../auth/index.js';
$('demandBtn').onclick=()=>{if(!state.user)return openLogin(()=>$('demandBtn').click());showModal('Request a route','ROUTE REQUEST');const body=$('modalContent');body.append(node('p',{className:'status-note'},'Tell us where you travel. We’ll review your request, but availability isn’t guaranteed.'));
  const form=node('form',{className:'form-stack'});const fields=[['Home pickup zone','homeZone'],['Office drop-off zone','officeZone']];const values=getSearch();
  for(const [label,key] of fields){const wrap=node('label',{},label),input=node('input',{name:key,required:'',maxlength:'100'});input.value=key==='homeZone'?values.pickup:values.office;wrap.append(input);form.append(wrap)}
  const wrap=node('label',{},'Preferred vehicle'),sel=node('select',{name:'vehicleClass'});for(const [v,n] of Object.entries({all:'Any available ride',bus:'Bus',hiace:'Hiace',car:'Shared private car'}))sel.append(node('option',{value:v},n));wrap.append(sel);form.append(wrap);
  const submit=node('button',{className:'primary',type:'submit'},'Send request');form.append(submit);form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;const formdata=new FormData(form);const klass=formdata.get('vehicleClass');
    try{await api('/api/demand',{method:'POST',auth:true,json:{homeZone:formdata.get('homeZone'),officeZone:formdata.get('officeZone'),...(klass==='all'?{}:{vehicleClass:klass})}});closeModal();showToast('Your route demand was sent to dispatch for review.')}
    catch(e){showToast(e.message);submit.disabled=false}};body.append(form)
};
