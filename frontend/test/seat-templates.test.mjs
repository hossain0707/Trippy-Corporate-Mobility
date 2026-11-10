import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seatPositions} from '../src/features/admin/seatTemplates.js';

for(const [kind,n,cols] of [['bus',28,[0,1,3,4]],['hiace',12,[0,2,3]],['car',3,[0,1,3]]]){
  test(`${kind} template makes ${n} unique physical passenger seats`,()=>{
    const seats=seatPositions(kind,n);
    assert.equal(seats.length,n);
    assert.equal(new Set(seats.map(s=>s.label)).size,n);
    assert.equal(new Set(seats.map(s=>s.rowNo+':'+s.colNo)).size,n);
    assert.ok(seats.every(s=>cols.includes(s.colNo)));
  });
}
test('shared car disallows impossible passenger positions',()=>assert.throws(()=>seatPositions('car',5)));

test('car 3-passenger map includes front passenger and rear outer seats',()=>{
  const pos=seatPositions('car',3).map(s=>[s.rowNo,s.colNo]);
  assert.deepEqual(pos,[[0,3],[1,0],[1,3]]);
});
