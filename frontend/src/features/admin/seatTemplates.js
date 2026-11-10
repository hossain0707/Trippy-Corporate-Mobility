export function seatPositions(kind,n){const rows=[];
  for(let i=0;i<n;i++){
    if(kind==='bus'){const row=Math.floor(i/4)+1,c=i%4;rows.push({label:`B${String(i+1).padStart(2,'0')}`,rowNo:row,colNo:c<2?c:c+1})}
    else if(kind==='hiace'){const row=Math.floor(i/3)+1,c=i%3;rows.push({label:`H${String(i+1).padStart(2,'0')}`,rowNo:row,colNo:c===0?0:c+1})}
    else {const pos=[[0,3],[1,0],[1,3],[1,1]][i];if(!pos)throw new Error('Unsupported shared-car seating');rows.push({label:`C${i+1}`,rowNo:pos[0],colNo:pos[1]})}
  }return rows;
}
