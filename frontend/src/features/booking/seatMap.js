import {node,state} from '../../core/context.js';
export function seatLayout(container,service,seatData,onSelected){
  const cabin=node('section',{className:'cabin-section'}),head=node('div',{className:'cabin-heading'});
  head.append(node('span',{},'Your exact seat'),node('small',{},`${seatData.availableCount} of ${seatData.seats.length} seats available`));
  const vehicle=node('div',{className:'vehicle-outline '+service.vehicle_class}),front=node('div',{className:'vehicle-front'});
  front.append(node('span',{},'FRONT / WINDSCREEN'),node('b',{},'◎ DRIVER'));
  vehicle.append(front);const grid=node('div',{className:'vehicle-grid'});
  const maxCol=Math.max(...seatData.seats.map(s=>s.col_no),service.vehicle_class==='bus'?4:3),maxRow=Math.max(...seatData.seats.map(s=>s.row_no));
  grid.style.gridTemplateColumns=`repeat(${maxCol+1},minmax(0,1fr))`;
  const map=new Map(seatData.seats.map(s=>[`${s.row_no}:${s.col_no}`,s]));
  for(let r=0;r<=maxRow;r++)for(let c=0;c<=maxCol;c++){
    const seat=map.get(`${r}:${c}`);
    if(!seat){grid.append(node('span',{className:'cabin-empty','aria-hidden':'true'},service.vehicle_class==='car'&&r===0&&c===0?'DRIVER':'·'));continue}
    const button=node('button',{className:'seat',type:'button','aria-pressed':'false','aria-label':`Seat ${seat.label}, ${seat.occupied?'occupied':'available'}`,disabled:seat.occupied},seat.label);
    button.onclick=()=>{state.selectedSeat=seat;grid.querySelectorAll('.seat').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));onSelected(seat)};
    grid.append(button);
  }
  vehicle.append(grid);const legend=node('div',{className:'legend'});legend.innerHTML='<span><i></i>Available</span><span><i class="occupied"></i>Occupied</span><span><i class="selected"></i>Selected</span>';
  cabin.append(head,vehicle,legend,node('p',{className:'notice'},'Driver seat and non-passenger positions are not bookable. Every vehicle map must be checked against its actual licensed seating arrangement before activation.'));
  container.append(cabin);
}
