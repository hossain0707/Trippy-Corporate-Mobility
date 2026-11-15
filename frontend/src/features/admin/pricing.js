import {api, formatBdt, node, showToast} from '../../core/context.js';
import {subscriptionQuote} from '../../core/pricing.js';
import {renderPlans} from '../theam/index.js';

export async function renderPricingEditor(root) {
  const status = node('p', {role:'status'}, 'Loading subscription pricing…');
  root.replaceChildren(status);
  const config = await api('/api/admin/pricing', {auth:true});
  const form = node('form');
  const fields = {};
  const preview = node('div', {'aria-live':'polite'});
  const save = node('button', {type:'submit', className:'primary'}, 'Save pricing');
  form.append(node('h4', {}, 'Subscription pricing'),
    node('p', {}, 'Saved prices apply to new bookings. Existing reservations keep their quoted price.'));
  for (const [key,label,min,max,value] of [
    ['bus','Bus monthly fare (BDT)',1,1000000,config.monthly.bus],
    ['hiace','Hiace monthly fare (BDT)',1,1000000,config.monthly.hiace],
    ['car','Shared car monthly fare (BDT)',1,1000000,config.monthly.car],
    ['firstMonth','New-rider welcome discount (%)',0,99,config.discounts.firstMonth],
    ['threeMonths','3-month discount (%)',0,99,config.discounts.threeMonths],
    ['sixMonths','6-month discount (%)',0,99,config.discounts.sixMonths],
    ['twelveMonths','12-month discount (%)',0,99,config.discounts.twelveMonths],
  ]) {
    const input = node('input', {type:'number', min, max, step:1, required:''});
    input.value = value;
    const field = node('label', {}, label);
    field.append(input);
    form.append(field);
    fields[key] = input;
  }
  const values = keys => Object.fromEntries(keys.map(key=>[key,fields[key].valueAsNumber]));
  const draft = () => ({
    monthly: values(Object.keys(config.monthly)),
    discounts: values(Object.keys(config.discounts)),
    revision: config.revision,
  });
  const updatePreview = () => {
    preview.replaceChildren();
    if (Object.values(fields).some(input=>!input.validity.valid)) return;
    preview.append(node('h4', {}, 'Hiace price preview'));
    for (const months of [1,3,6,12]) {
      const {monthly,total} = subscriptionQuote(draft(),'hiace',months,true);
      preview.append(node('p', {}, (months===1?'1 month (eligible new rider)':months+' months')
        +' · '+formatBdt(monthly)+' per month · '+formatBdt(total)+' total'));
    }
  };
  form.addEventListener('input', updatePreview);
  form.onsubmit = async event => {
    event.preventDefault();
    save.disabled = true;
    status.textContent = '';
    try {
      const current = await api('/api/admin/pricing',{method:'PUT',auth:true,json:draft()});
      config.revision = current.revision;
      await renderPlans(current);
      showToast('Subscription pricing saved');
    } catch (error) {
      status.textContent = error.message;
    } finally {
      save.disabled = false;
    }
  };
  status.textContent = '';
  form.append(preview,status,save);
  root.replaceChildren(form);
  updatePreview();
}
