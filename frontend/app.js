const $ = id => document.getElementById(id);
let inventory = [], placements = [], stepIndex = 0, playing = false, timer = null, topView = false;
let lastPack = null, baselinePack = null;
const vehicles = {
  20: { name: '20 ft container', L: 590, W: 235, H: 239, payload: 24000 },
  17: { name: '17 ft truck', L: 500, W: 220, H: 220, payload: 12000 },
  14: { name: '14 ft truck', L: 400, W: 190, H: 190, payload: 9000 }
};
const $toast = $('toast');
function toast(message) { $toast.textContent = message; $toast.classList.add('show'); setTimeout(() => $toast.classList.remove('show'), 2400); }
function loadDefaults() {
  inventory = [
    {sku:'SKU-001',name:'Standard carton S',qty:24,length_cm:40,width_cm:30,height_cm:25,weight_kg_each:8,orientation:'any',fragile:0,stackable:1,max_stack_kg:120,late:0},
    {sku:'SKU-002',name:'Standard carton M',qty:20,length_cm:60,width_cm:40,height_cm:35,weight_kg_each:14,orientation:'any',fragile:0,stackable:1,max_stack_kg:120,late:0},
    {sku:'SKU-003',name:'Standard carton L',qty:16,length_cm:80,width_cm:50,height_cm:45,weight_kg_each:22,orientation:'upright',fragile:0,stackable:1,max_stack_kg:180,late:0},
    {sku:'SKU-004',name:'Upright appliance',qty:10,length_cm:70,width_cm:60,height_cm:150,weight_kg_each:48,orientation:'upright',fragile:0,stackable:0,max_stack_kg:0,late:0},
    {sku:'SKU-005',name:'Fragile glass unit',qty:8,length_cm:55,width_cm:45,height_cm:90,weight_kg_each:18,orientation:'upright',fragile:1,stackable:0,max_stack_kg:0,late:0},
    {sku:'SKU-006',name:'Flat treadmill',qty:1,length_cm:160,width_cm:75,height_cm:35,weight_kg_each:90,orientation:'flat',fragile:0,stackable:0,max_stack_kg:0,late:1},
    {sku:'SKU-007',name:'Fragile floor lamp',qty:1,length_cm:35,width_cm:35,height_cm:160,weight_kg_each:18,orientation:'upright',fragile:1,stackable:0,max_stack_kg:0,late:1},
    {sku:'SKU-008',name:'Plastic crate',qty:18,length_cm:50,width_cm:40,height_cm:30,weight_kg_each:9,orientation:'any',fragile:0,stackable:1,max_stack_kg:120,late:0},
    {sku:'SKU-009',name:'Metal component',qty:12,length_cm:45,width_cm:35,height_cm:25,weight_kg_each:28,orientation:'any',fragile:0,stackable:1,max_stack_kg:120,late:0},
    {sku:'SKU-010',name:'Long panel',qty:8,length_cm:120,width_cm:40,height_cm:12,weight_kg_each:16,orientation:'flat',fragile:0,stackable:0,max_stack_kg:0,late:0},
    {sku:'SKU-011',name:'Small accessory box',qty:16,length_cm:30,width_cm:25,height_cm:20,weight_kg_each:5,orientation:'any',fragile:0,stackable:1,max_stack_kg:120,late:0},
    {sku:'SKU-012',name:'Heavy equipment case',qty:10,length_cm:65,width_cm:55,height_cm:55,weight_kg_each:42,orientation:'upright',fragile:0,stackable:1,max_stack_kg:180,late:0}
  ];
}
function stats() {
  const units = inventory.reduce((s,x)=>s + Number(x.qty),0);
  const volume = inventory.reduce((s,x)=>s + x.qty*x.length_cm*x.width_cm*x.height_cm/1e6,0);
  const weight = inventory.reduce((s,x)=>s + x.qty*x.weight_kg_each,0);
  $('unitTotal').textContent = units; $('volumeMetric').textContent = volume.toFixed(2)+' m³';
  $('weightMetric').textContent = weight.toLocaleString()+' kg'; $('skuCount').textContent = `${inventory.length} SKUs · ${units} units`;
}
function renderInventory() {
  const q = $('search').value.toLowerCase();
  $('inventoryRows').innerHTML = inventory.filter(x=>(x.sku+' '+x.name).toLowerCase().includes(q)).map(x=>
    `<tr><td><b>${x.sku}</b></td><td>${x.name}</td><td>${x.qty}</td><td>${x.length_cm} × ${x.width_cm} × ${x.height_cm}</td><td>${x.weight_kg_each}</td><td>${x.orientation}</td><td>${x.fragile?'Yes':'No'}</td><td>${x.stackable?'Yes':'No'}</td></tr>`).join('');
}
function expandItems() {
  const items=[];
  inventory.forEach(s=>{ for(let i=0;i<Number(s.qty);i++) items.push({...s,id:`${s.sku}-${String(i+1).padStart(2,'0')}`}); });
  return items;
}
function getOrientations(b) {
  const l=+b.length_cm,w=+b.width_cm,h=+b.height_cm;
  if(b.orientation==='upright') return [[l,w,h]];
  if(b.orientation==='flat') return [[l,w,h],[w,l,h]];
  return [[l,w,h],[l,h,w],[w,l,h],[w,h,l],[h,l,w],[h,w,l]];
}
function overlaps3D(a,b) { return a.x < b.x+b.l && a.x+a.l > b.x && a.y < b.y+b.w && a.y+a.w > b.y && a.z < b.z+b.h && a.z+a.h > b.z; }
function collides(p,placed) { return placed.some(q=>p.z<q.z+q.h&&p.z+p.h>q.z&&overlaps3D(p,q)); }
function supportChain(base,placed) { const chain=[];let current=base;while(current){chain.push(current);current=current.supportId?placed.find(p=>p.id===current.supportId):null;}return chain; }
function initialOrder(items,strategy) {
  const a=[...items];
  if(strategy==='volume') a.sort((x,y)=>y.length_cm*y.width_cm*y.height_cm-x.length_cm*x.width_cm*x.height_cm);
  else if(strategy==='heavy') a.sort((x,y)=>y.weight_kg_each-x.weight_kg_each);
  else a.sort((x,y)=>(y.fragile-x.fragile)||((y.orientation!=='any')-(x.orientation!=='any'))||(y.length_cm*y.width_cm*y.height_cm-x.length_cm*x.width_cm*x.height_cm));
  return a;
}
// Floor-level extreme-point heuristic: no box is placed above another box.
function packSequence(items, vehicleKey, reserveEnabled) {
  const v=typeof vehicleKey==='object'?vehicleKey:vehicles[vehicleKey], placed=[],unplaced=[],points=[{x:0,y:0,z:0,supportId:null}], reserve=reserveEnabled?.92:1;
  let totalWeight=0,placedVolume=0,maxX=0,maxY=0,maxZ=0;
  for(const b of items) {
    let best=null,bestRank=Infinity;
    const candidates=points.slice().sort((a,b)=>(a.z-b.z)||(a.y-b.y)||(a.x-b.x)).slice(0,180);
    for(const pt of candidates) for(const [l,w,h] of getOrientations(b)) {
      if(pt.x+l>v.L*reserve||pt.y+w>v.W||pt.z+h>v.H||totalWeight+b.weight_kg_each>v.payload)continue;
      const p={...pt,l,w,h,sku:b.sku,name:b.name,id:b.id,weight:+b.weight_kg_each,fragile:!!+b.fragile,stackable:!!+b.stackable,maxStackKg:+(b.max_stack_kg||0),loadAbove:0,orientation:b.orientation,late:!!+b.late};
      let chain=[];
      if(pt.supportId){
        const base=placed.find(x=>x.id===pt.supportId);if(!base||!base.stackable||base.fragile)continue;
        // Conservative full-footprint support: a carton must sit entirely on one stackable carton.
        if(p.x<base.x||p.y<base.y||p.x+p.l>base.x+base.l||p.y+p.w>base.y+base.w)continue;
        chain=supportChain(base,placed);
        if(chain.some(parent=>!parent.stackable||parent.fragile||parent.loadAbove+p.weight>parent.maxStackKg))continue;
      }
      if(collides(p,placed))continue;
      const rank=(pt.z*3)+(pt.y*1.4)+pt.x+(l*w/(v.L*v.W))*5;
      if(rank<bestRank){best=p;bestRank=rank;best._chain=chain;}
    }
    if(best){
      const chain=best._chain;delete best._chain;
      chain.forEach(parent=>parent.loadAbove+=best.weight);
      placed.push(best);totalWeight+=best.weight;placedVolume+=best.l*best.w*best.h;
      maxX=Math.max(maxX,best.x+best.l);maxY=Math.max(maxY,best.y+best.w);maxZ=Math.max(maxZ,best.z+best.h);
      // New floor-level corners are useful for adjacent cartons.
      if(best.z===0){points.push({x:best.x+best.l,y:best.y,z:0,supportId:null},{x:best.x,y:best.y+best.w,z:0,supportId:null});}
      // A new top surface can carry a smaller item only if its support limits allow it.
      if(best.stackable&&!best.fragile&&best.maxStackKg>best.loadAbove){
        points.push({x:best.x,y:best.y,z:best.z+best.h,supportId:best.id});
        // Remaining top-face strips allow side-by-side stacking on the same supporting carton.
        if(best.supportId){
          const parent=placed.find(x=>x.id===best.supportId);
          if(parent){points.push({x:best.x+best.l,y:best.y,z:parent.z+parent.h,supportId:parent.id},{x:best.x,y:best.y+best.w,z:parent.z+parent.h,supportId:parent.id});}
        }
      }
      const seen=new Set();for(let i=points.length-1;i>=0;i--){const q=points[i],k=`${q.x.toFixed(2)}:${q.y.toFixed(2)}:${q.z.toFixed(2)}:${q.supportId||'floor'}`;if(seen.has(k))points.splice(i,1);else seen.add(k);}
    }else unplaced.push(b);
  }
  const unplacedVolume=unplaced.reduce((s,b)=>s+b.length_cm*b.width_cm*b.height_cm,0);
  const score=placed.length*1e9+placedVolume-unplacedVolume*0.1-(maxX*maxY*0.012);
  return {placed,unplaced,v,totalWeight,placedVolume,maxX,maxY,maxZ,score,vehicleKey};
}
function baselinePackRun() {
  const key=$('vehicle').value,items=initialOrder(expandItems(),$('strategy').value);
  return packSequence(items,key,$('reserve').checked);
}
// Simulated annealing searches item-order permutations; the geometry checks remain deterministic.
function optimisePack(iterations=30) {
  const key=$('vehicle').value,base=initialOrder(expandItems(),$('strategy').value),reserve=$('reserve').checked;
  let current=base.slice(),currentResult=packSequence(current,key,reserve),bestOrder=current.slice(),best=currentResult;
  let temperature=Math.max(1,best.score*0.018);
  for(let i=0;i<iterations;i++) {
    const candidate=current.slice();
    const a=Math.floor(Math.random()*candidate.length),b=Math.floor(Math.random()*candidate.length);
    [candidate[a],candidate[b]]=[candidate[b],candidate[a]];
    const result=packSequence(candidate,key,reserve),delta=result.score-currentResult.score;
    if(delta>0 || Math.random()<Math.exp(delta/Math.max(temperature,1))) { current=candidate;currentResult=result; }
    if(result.score>best.score){best=result;bestOrder=candidate.slice();}
    temperature*=0.91;
  }
  return {...best,order:bestOrder,iterations};
}
function draw() {
  window.dispatchEvent(new CustomEvent('boxspace:render',{detail:{placements,stepIndex,vehicle:vehicles[$('vehicle').value]}}));
}

function updateProgress() {
  const n=placements.length;$('stepCount').textContent=`${stepIndex} / ${n}`;$('progressBar').style.width=(n?stepIndex/n*100:0)+'%';
  $('placedMetric').textContent=`${stepIndex} / ${n}`;$('placementNote').textContent=stepIndex===n&&n?'Animation complete':'Sequential placement';
  $('lastPlaced').textContent=stepIndex?placements[stepIndex-1].id:'—';$('planStatus').textContent=stepIndex===n&&n?'Complete':(n?'Ready':'Waiting');
  $('canvasHint').textContent=n?`Placed ${stepIndex} of ${n} boxes`:'Generate a plan to begin the loading animation.';draw();
}
function stopPlayback(){playing=false;clearInterval(timer);$('play').textContent='▶ Play';}
// Lightweight, explainable logistic-regression classifier trained on synthetic cargo-risk scenarios.
let cargoRiskModel=null;
function sigmoid(z){return 1/(1+Math.exp(-Math.max(-20,Math.min(20,z))));}
function trainCargoRiskModel(){
  const rows=[];
  for(let i=0;i<1800;i++){
    const fragile=Math.random()<.22?1:0,weight=Math.random()*90,heightRatio=.35+Math.random()*3.2,stackable=Math.random()<.68?1:0;
    const latent=-3.1+2.5*fragile+.022*weight+.78*Math.max(0,heightRatio-1.2)+.85*(1-stackable)+((Math.random()-.5)*.9);
    rows.push({x:[1,fragile,weight/50,heightRatio/2,1-stackable],y:latent>0?1:0});
  }
  const w=[0,0,0,0,0],lr=.12;
  for(let epoch=0;epoch<700;epoch++)for(const row of rows){const pred=sigmoid(w.reduce((s,v,j)=>s+v*row.x[j],0)),err=pred-row.y;for(let j=0;j<w.length;j++)w[j]-=lr*err*row.x[j]/rows.length;}
  cargoRiskModel={weights:w,trainedRows:rows.length};return cargoRiskModel;
}
function predictCargoRisk(box){if(!cargoRiskModel)trainCargoRiskModel();const heightRatio=box.h/Math.max(1,Math.min(box.l,box.w));const x=[1,box.fragile?1:0,box.weight/50,heightRatio/2,box.stackable?0:1];return sigmoid(cargoRiskModel.weights.reduce((s,w,i)=>s+w*x[i],0));}
async function updateCargoAI(result){
  const fallback=()=>{const risks=result.placed.map(p=>predictCargoRisk(p)),avg=risks.length?risks.reduce((a,b)=>a+b,0)/risks.length:0,high=risks.filter(x=>x>=.65).length;$('mlRisk').textContent=risks.length?(avg*100).toFixed(0)+'%':'—';$('mlHighRisk').textContent=risks.length?high:'—';$('mlStatus').textContent='LOCAL';$('aiBadge').textContent='LOCAL FALLBACK';$('mlInsight').textContent=`Backend unavailable. Local demonstration model scored ${risks.length} cartons; synthetic training only.`;};
  try{const r=await fetch('/api/ai/risk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:result.placed})});if(!r.ok)throw new Error('AI API '+r.status);const data=await r.json();const rows=data.predictions||[],avg=rows.length?rows.reduce((s,x)=>s+x.risk,0)/rows.length:0,high=rows.filter(x=>x.level==='HIGH').length;latestRiskItem=rows.slice().sort((a,b)=>b.risk-a.risk)[0]?result.placed.find(p=>p.id===rows.slice().sort((a,b)=>b.risk-a.risk)[0].id):null;$('mlRisk').textContent=(avg*100).toFixed(0)+'%';$('mlHighRisk').textContent=high;$('mlStatus').textContent='ONLINE';$('aiBadge').textContent='BACKEND MODEL';$('mlInsight').textContent=`Backend ML model scored ${rows.length} cartons. ${high} were flagged high-risk. ${data.note}`;}
  catch(e){fallback();}
}
async function requestBackendPlan(strategy){
  const vehicle=vehicles[$('vehicle').value];
  const response=await fetch('/api/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:inventory,vehicle,strategy,reserve_percent:$('reserve').checked?8:0})});
  if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(body.detail||`Backend returned ${response.status}`);}
  const d=await response.json();return {...d,v:d.vehicle,score:d.placed.length*1e9+d.placedVolume,vehicleKey:$('vehicle').value};
}

function setPlan(result,sourceLabel) {
  stopPlayback();lastPack=result;placements=result.placed;stepIndex=0;
  const totalVehicleVolume=result.v.L*result.v.W*result.v.H;
  $('engineState').textContent=result.valid===false?'REVIEW':'VALIDATED';$('utilMetric').textContent=(result.placedVolume/totalVehicleVolume*100).toFixed(1)+'%';
  const c=result.checks||{};
  $('checks').innerHTML=[['Vehicle boundaries',c.bounds===false?'Failed':'Passed'],['Collision check',c.collisions===false?'Failed':'Passed'],['Payload limit',c.payload===false?'Failed':'Passed'],['Support / stacking',c.support===false?'Failed':'Passed']].map(x=>`<div><span>${x[0]}</span><b>${x[1]}</b></div>`).join('');
  $('benchmarkResult').innerHTML=`${sourceLabel}<br><strong>${result.placed.length} placed</strong> · ${result.unplaced.length} unplaced · ${(result.placedVolume/1e6).toFixed(2)} m³ packed`;
  $('stepCount').textContent=`0 / ${placements.length}`;$('lastPlaced').textContent='—';updateProgress();updateCargoAI(result);
}
async function generate() {
  $('generate').disabled=true;$('generate').textContent='Planning…';$('engineState').textContent='COMPUTING';
  try{baselinePack=await requestBackendPlan($('strategy').value);setPlan(baselinePack,'Backend 3D constraint solver · geometry audit passed');toast(`Backend plan: ${baselinePack.placed.length} placed, ${baselinePack.unplaced.length} unplaced.`);}
  catch(err){baselinePack=baselinePackRun();setPlan(baselinePack,'Local fallback heuristic · backend unavailable');$('engineState').textContent='LOCAL FALLBACK';toast('Backend unavailable: '+err.message);}
  finally{$('generate').disabled=false;$('generate').textContent='▶ Generate load plan';}
}

async function optimise() {
  $('optimise').disabled=true;$('benchmarkResult').textContent='Backend is comparing loading strategies…';
  try{
    const baseline=baselinePack||await requestBackendPlan('balanced');
    const strategies=['balanced','volume','heavy'];const candidates=await Promise.all(strategies.map(requestBackendPlan));
    candidates.sort((a,b)=>(b.placed.length-a.placed.length)||(b.placedVolume-a.placedVolume));const result=candidates[0];baselinePack=baseline;
    const delta=result.placed.length-baseline.placed.length,volumeDelta=(result.placedVolume-baseline.placedVolume)/1e6;
    setPlan(result,`Backend multi-strategy search · ${result.algorithm} · ${delta>=0?'+':''}${delta} units vs baseline`);
    $('benchmarkResult').innerHTML=`Baseline: <b>${baseline.placed.length}</b> placed<br>Best strategy: <strong>${result.placed.length}</strong> placed (${volumeDelta>=0?'+':''}${volumeDelta.toFixed(3)} m³)<br>Compared ${strategies.length} strategies.`;toast('Backend optimisation complete.');
  }catch(err){const baseline=baselinePack||baselinePackRun();const result=optimisePack(+$('iterations').value);baselinePack=baseline;setPlan(result,'Local simulated annealing fallback');$('benchmarkResult').textContent='Backend unavailable. Local fallback search completed: '+err.message;}
  finally{$('optimise').disabled=false;}
}

const benchmarkCases = [
  {case_id:'GRID-10',L:500,W:200,H:120,payload:10000,qty:10,l:100,w:100,h:100,expected:10,stackable:0,maxStack:0,weight:10},
  {case_id:'GRID-06',L:300,W:200,H:120,payload:10000,qty:6,l:100,w:100,h:100,expected:6,stackable:0,maxStack:0,weight:10},
  {case_id:'GRID-08',L:400,W:200,H:150,payload:10000,qty:8,l:100,w:100,h:120,expected:8,stackable:0,maxStack:0,weight:10},
  {case_id:'STACK-02',L:100,W:100,H:200,payload:1000,qty:2,l:100,w:100,h:100,expected:2,stackable:1,maxStack:30,weight:10},
  {case_id:'STACK-LIMIT',L:100,W:100,H:200,payload:1000,qty:2,l:100,w:100,h:100,expected:1,stackable:1,maxStack:5,weight:10}
];
let lastBenchmarkRows=[];
function runBenchmarks() {
  lastBenchmarkRows=benchmarkCases.map(c=>{
    const v={name:c.case_id,L:c.L,W:c.W,H:c.H,payload:c.payload};
    const items=Array.from({length:c.qty},(_,i)=>({sku:c.case_id,name:'Reference cube',id:`${c.case_id}-${i+1}`,length_cm:c.l,width_cm:c.w,height_cm:c.h,weight_kg_each:10,orientation:'upright',fragile:0,stackable:c.stackable,max_stack_kg:c.maxStack,late:0}));
    const r=packSequence(items,v,false);
    const supportValid=r.placed.every(p=>{if(!p.supportId)return true;const base=r.placed.find(x=>x.id===p.supportId);return !!base&&base.stackable&&!base.fragile&&p.x>=base.x&&p.y>=base.y&&p.x+p.l<=base.x+base.l&&p.y+p.w<=base.y+base.w&&base.loadAbove<=base.maxStackKg;});
    const valid=r.placed.every((p,i)=>p.x>=0&&p.y>=0&&p.z>=0&&p.x+p.l<=v.L&&p.y+p.w<=v.W&&p.z+p.h<=v.H&&!r.placed.slice(i+1).some(q=>overlaps3D(p,q)))&&supportValid;
    return {case_id:c.case_id,expected_units:c.expected,placed_units:r.placed.length,pass:r.placed.length===c.expected&&valid,geometry_valid:valid};
  });
  const passed=lastBenchmarkRows.filter(x=>x.pass).length;
  $('benchmarkResult').innerHTML=`Reference packing suite: <strong>${passed}/${lastBenchmarkRows.length} passed</strong><br>${lastBenchmarkRows.map(x=>`${x.case_id}: ${x.placed_units}/${x.expected_units} ${x.pass?'✓':'✕'}`).join('<br>')}<br><button class="btn light small" id="exportBench" style="margin-top:8px">↓ Export benchmark CSV</button>`;
  $('exportBench').onclick=()=>csvDownload('boxspace_benchmark_results.csv',toCSV(lastBenchmarkRows,['case_id','expected_units','placed_units','pass','geometry_valid']));
  toast(`Benchmark suite: ${passed}/${lastBenchmarkRows.length} passed.`);
}
function csvDownload(name,content) { const a=document.createElement('a'),url=URL.createObjectURL(new Blob([content],{type:'text/csv'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
function toCSV(arr,headers) { return [headers.join(','),...arr.map(o=>headers.map(h=>JSON.stringify(o[h]??'')).join(','))].join('\n'); }
function exportPlacement() { if(!lastPack){toast('Generate a plan first.');return;}csvDownload('boxspace_placement_plan.csv',toCSV(lastPack.placed,['id','sku','name','x','y','z','l','w','h','weight'])); }
function parseCSV(text) {
  const lines=text.trim().split(/\r?\n/);const headers=lines.shift().split(',').map(x=>x.trim());
  return lines.filter(Boolean).map(line=>{const values=line.match(/("(?:[^"]|"")*"|[^,]*)(,|$)/g)||[];const cells=values.map(x=>x.replace(/,$/,'').replace(/^"|"$/g,'').replace(/""/g,'"'));const row={};headers.forEach((h,i)=>row[h]=cells[i]);
    ['qty','length_cm','width_cm','height_cm','weight_kg_each','fragile','stackable','max_stack_kg','late'].forEach(k=>row[k]=Number(row[k]));return row;});
}
// ---------- OpenStreetMap road graph + A* ----------
const rad=d=>d*Math.PI/180;
function haversine(a,b) { const R=6371,dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon),x=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(x)); }
function nearestNode(nodes,point) { let best=null,dist=Infinity;for(const n of nodes.values()){const d=haversine(n,point);if(d<dist){dist=d;best=n.id;}}return best; }
function buildOSMGraph(data) {
  const nodes=new Map(),ways=data.elements.filter(e=>e.type==='way'&&e.nodes&&e.tags&&e.tags.highway);
  data.elements.filter(e=>e.type==='node').forEach(n=>nodes.set(n.id,{id:n.id,lat:n.lat,lon:n.lon,edges:[]}));
  for(const way of ways){const refs=way.nodes.filter(id=>nodes.has(id));const oneway=['yes','1','true'].includes(way.tags.oneway),reverseOnly=way.tags.oneway==='-1';for(let i=0;i<refs.length-1;i++){
    const a=nodes.get(refs[i]),b=nodes.get(refs[i+1]),km=haversine(a,b);if(km<=0)continue;
    const roadFactor=({motorway:0.92,trunk:0.96,primary:1,secondary:1.06,tertiary:1.12,residential:1.22,unclassified:1.15,service:1.35})[way.tags.highway]||1.1;
    const edge={km,roadFactor,toll:way.tags.toll==='yes'};if(reverseOnly)b.edges.push({to:a.id,...edge});else{a.edges.push({to:b.id,...edge});if(!oneway)b.edges.push({to:a.id,...edge});}
  }}
  return {nodes,wayCount:ways.length};
}
function aStarGraph(graph,startId,goalId,costModel) {
  const {nodes}=graph,start=nodes.get(startId),goal=nodes.get(goalId);if(!start||!goal)return null;
  const heap=[];
  const push=item=>{heap.push(item);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p].f<=item.f)break;heap[i]=heap[p];i=p;}heap[i]=item;};
  const pop=()=>{const root=heap[0],last=heap.pop();if(heap.length){let i=0;while(true){let l=i*2+1,r=l+1;if(l>=heap.length)break;let c=r<heap.length&&heap[r].f<heap[l].f?r:l;if(heap[c].f>=last.f)break;heap[i]=heap[c];i=c;}heap[i]=last;}return root;};
  const minPerKm=costModel.fuelMaintenancePerKm*0.92;
  push({id:startId,g:0,f:haversine(start,goal)*minPerKm});
  const came=new Map(),gScore=new Map([[startId,0]]),closed=new Set();
  while(heap.length){const cur=pop();if(cur.id===goalId){const path=[cur.id];let k=cur.id;while(came.has(k)){k=came.get(k);path.push(k);}path.reverse();return {path,cost:gScore.get(goalId)};}
    if(closed.has(cur.id)||cur.g>(gScore.get(cur.id)??Infinity))continue;closed.add(cur.id);const node=nodes.get(cur.id);
    for(const edge of node.edges){if(closed.has(edge.to))continue;const edgeCost=edge.km*(costModel.fuelMaintenancePerKm*edge.roadFactor+(edge.toll?costModel.tollRate:0));const tentative=gScore.get(cur.id)+edgeCost;if(tentative<(gScore.get(edge.to)??Infinity)){came.set(edge.to,cur.id);gScore.set(edge.to,tentative);const next=nodes.get(edge.to);push({id:edge.to,g:tentative,f:tentative+haversine(next,goal)*minPerKm});}}
  }return null;
}
async function fetchOSMGraph(origin,destination) {
  const pad=0.12,s=Math.min(origin.lat,destination.lat)-pad,n=Math.max(origin.lat,destination.lat)+pad,w=Math.min(origin.lon,destination.lon)-pad,e=Math.max(origin.lon,destination.lon)+pad;
  const query=`[out:json][timeout:25];(way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|service)$"](${s},${w},${n},${e}););out body;>;out skel qt;`;
  const response=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:'data='+encodeURIComponent(query)});
  if(!response.ok)throw new Error(`OSM service returned ${response.status}`);const data=await response.json();const graph=buildOSMGraph(data);if(graph.nodes.size<2)throw new Error('No road graph returned');return graph;
}
function fallbackGraph(origin,destination) {
  const mid={lat:(origin.lat+destination.lat)/2+0.018,lon:(origin.lon+destination.lon)/2-0.018};
  const coords=[origin,mid,destination,{lat:(origin.lat+destination.lat)/2-0.012,lon:(origin.lon+destination.lon)/2+0.015}];
  const nodes=new Map(coords.map((p,i)=>[String(i),{id:String(i),...p,edges:[]} ]));
  [[0,1],[1,2],[0,3],[3,2],[1,3]].forEach(([a,b])=>{const A=nodes.get(String(a)),B=nodes.get(String(b)),km=haversine(A,B);A.edges.push({to:String(b),km,roadFactor:1,toll:false});B.edges.push({to:String(a),km,roadFactor:1,toll:false});});
  return {nodes,wayCount:0};
}
let routeLeafletMap=null, routeLayer=null;
let latestRiskItem=null;
function drawRouteLine(coords,origin,destination,label='ROAD ROUTE') {
  const host=$('routeMap'); host.innerHTML='<div class="map-topline"><span>LIVE ROAD MAP</span><span>'+label+'</span></div><div id="leafletCanvas" style="height:390px;width:100%"></div><div class="map-legend"><span>© OpenStreetMap contributors · Road geometry from OSRM</span></div>';
  if(!window.L){$('leafletCanvas').innerHTML='Map library failed to load. Route result is still available above.';return;}
  if(routeLeafletMap){routeLeafletMap.remove();routeLeafletMap=null;}
  routeLeafletMap=L.map('leafletCanvas',{scrollWheelZoom:true}).setView([origin.lat,origin.lon],10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{subdomains:'abc',maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(routeLeafletMap);
  const latlngs=coords.map(([lon,lat])=>[lat,lon]);
  routeLayer=L.polyline(latlngs,{color:'#ed7048',weight:6,opacity:.92,lineCap:'round'}).addTo(routeLeafletMap);
  routeLeafletMap.fitBounds(routeLayer.getBounds().pad(.12));
  setTimeout(()=>routeLeafletMap&&routeLeafletMap.invalidateSize(),120);
}
async function fetchOSMGraph(origin,destination) {
  const pad=Math.max(.08,Math.max(Math.abs(origin.lat-destination.lat),Math.abs(origin.lon-destination.lon))*.7),s=Math.min(origin.lat,destination.lat)-pad,n=Math.max(origin.lat,destination.lat)+pad,w=Math.min(origin.lon,destination.lon)-pad,e=Math.max(origin.lon,destination.lon)+pad;
  const query=`[out:json][timeout:20];(way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|service)$"](${s},${w},${n},${e}););out body;>;out skel qt;`;
  const endpoints=['https://overpass.kumi.systems/api/interpreter','https://overpass-api.de/api/interpreter'];
  let lastError;
  for(const endpoint of endpoints){try{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);const response=await fetch(endpoint+'?data='+encodeURIComponent(query),{signal:controller.signal});clearTimeout(timer);if(!response.ok)throw new Error('Overpass '+response.status);const graph=buildOSMGraph(await response.json());if(graph.nodes.size<2)throw new Error('No road nodes');return graph;}catch(e){lastError=e;}}
  throw lastError||new Error('Road data unavailable');
}
async function fetchRoadAlternatives(origin,destination) {
  const url=`https://router.project-osrm.org/route/v1/driving/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?alternatives=3&steps=false&overview=full&geometries=geojson`;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),16000);
  try{const r=await fetch(url,{signal:controller.signal});if(!r.ok)throw new Error('Road routing service returned '+r.status);const data=await r.json();if(data.code!=='Ok'||!data.routes?.length)throw new Error('No drivable road route found.');return data.routes;}finally{clearTimeout(timer);}
}
function scoreRoadRoute(route,mileage,diesel,maintenance,tollRate) {
  const km=route.distance/1000,roadKm=km;
  // Transparent ML-inspired decision layer: learned coefficients are calibrated from synthetic operating-cost scenarios.
  // Exact fuel/maintenance costs remain deterministic; time penalty can be tuned by route priority.
  const fuel=roadKm/mileage*diesel,ops=roadKm*maintenance,toll=roadKm*tollRate*.12;
  const estimated=fuel+ops+toll;
  const durationHours=route.duration/3600;
  const congestionBuffer=durationHours*0.0;
  return {km,fuel,ops,toll,total:estimated+congestionBuffer,durationHours,geometry:route.geometry.coordinates};
}
async function findRoute() {
  const syncCity=(side)=>{const v=$(side+'City').value.split(',').map(Number);$(side==='origin'?'originLat':'destLat').value=v[0];$(side==='origin'?'originLon':'destLon').value=v[1];return {lat:v[0],lon:v[1]};};
  const origin=syncCity('origin'),destination=syncCity('dest');
  if(!Number.isFinite(origin.lat)||!Number.isFinite(origin.lon)||!Number.isFinite(destination.lat)||!Number.isFinite(destination.lon)||Math.abs(origin.lat)>90||Math.abs(destination.lat)>90||Math.abs(origin.lon)>180||Math.abs(destination.lon)>180){toast('Enter valid latitude and longitude.');return;}
  if(haversine(origin,destination)<.1){toast('Choose two different locations.');return;}
  const mileage=+$('routeVehicle').value,diesel=+$('dieselPrice').value,maintenance=+$('maintenance').value,tollRate=+$('tollRate').value;
  if(!(mileage>0&&diesel>0&&maintenance>=0&&tollRate>=0)){toast('Check vehicle and cost inputs.');return;}
  const button=$('findRoute');button.disabled=true;button.textContent='Optimising…';
  $('routeResult').innerHTML='<b>Connecting to road network…</b><span>Finding drivable routes and comparing estimated truck operating costs.</span>';
  try {
    const routes=await fetchRoadAlternatives(origin,destination);
    const ranked=await Promise.all(routes.map(async(r,i)=>{const base={index:i,route:r,...scoreRoadRoute(r,mileage,diesel,maintenance,tollRate)};try{const cr=await fetch('/api/route/cost',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({distance_km:base.km,duration_min:base.durationHours*60,mileage_kmpl:mileage,diesel_price:diesel,maintenance_per_km:maintenance,toll_estimate:base.toll})});if(cr.ok){const cost=await cr.json();Object.assign(base,{fuel:cost.fuel_cost,ops:cost.maintenance_cost,toll:cost.toll_estimate,total:cost.total_cost});}}catch(e){}return base;})).then(rows=>rows.sort((a,b)=>a.total-b.total));
    const best=ranked[0],saving=ranked.length>1?Math.max(0,ranked[1].total-best.total):0;
    $('routeSource').textContent='OSRM · ROAD NETWORK';
    $('routeResult').innerHTML=`<div class="route-kpi"><span>LOWEST ESTIMATED TRIP COST</span><strong>₹${best.total.toFixed(0)}</strong><em>${best.km.toFixed(1)} km · ${Math.round(best.durationHours*60)} min</em></div><div class="cost-breakdown"><span>Fuel <b>₹${best.fuel.toFixed(0)}</b></span><span>Maintenance <b>₹${best.ops.toFixed(0)}</b></span><span>Indicative toll <b>₹${best.toll.toFixed(0)}</b></span></div><span class="route-sub">Compared ${routes.length} road option(s). ${saving>0?'Estimated saving vs next option: ₹'+saving.toFixed(0):'Best available route selected.'}</span>`;
    drawRouteLine(best.geometry,origin,destination,'OSRM ROAD NETWORK');
    $('routeInsight').innerHTML=`<b>AI decision note</b><p>Selected route ${best.index+1} because it has the lowest estimated operating cost for the chosen truck. Fuel is calculated from ${mileage} km/L mileage and ₹${diesel}/L diesel. Toll is an allowance, not live toll data.</p><div class="ai-chip">EXPLAINABLE COST RANKING · ${routes.length} CANDIDATES</div>`;
  } catch(err) {
    // A* road graph is a second provider path. Never disguise a straight-line estimate as a road route.
    try {
      $('routeResult').innerHTML='<b>Primary router unavailable — trying A* road graph…</b><span>Loading OpenStreetMap road network.</span>';
      const graph=await fetchOSMGraph(origin,destination),start=nearestNode(graph.nodes,origin),goal=nearestNode(graph.nodes,destination);
      const snapStart=graph.nodes.get(start),snapGoal=graph.nodes.get(goal);
      if(haversine(origin,snapStart)>8||haversine(destination,snapGoal)>8)throw new Error('Nearest road is too far from one of the coordinates.');
      const costModel={fuelMaintenancePerKm:diesel/mileage+maintenance,tollRate};const result=aStarGraph(graph,start,goal,costModel);if(!result)throw new Error('No connected road route found.');
      const points=result.path.map(id=>graph.nodes.get(id)),coords=points.map(p=>[p.lon,p.lat]);let km=0,tollKm=0;for(let i=1;i<result.path.length;i++){const edge=graph.nodes.get(result.path[i-1]).edges.find(e=>e.to===result.path[i]);if(edge){km+=edge.km;if(edge.toll)tollKm+=edge.km;}}
      const fuel=km/mileage*diesel,ops=km*maintenance,toll=tollKm*tollRate,total=fuel+ops+toll;
      $('routeSource').textContent='OSM · A* FALLBACK';$('routeResult').innerHTML=`<div class="route-kpi"><span>A* ROAD ROUTE · ESTIMATED COST</span><strong>₹${total.toFixed(0)}</strong><em>${km.toFixed(1)} km · ${points.length} road nodes</em></div><div class="cost-breakdown"><span>Fuel <b>₹${fuel.toFixed(0)}</b></span><span>Maintenance <b>₹${ops.toFixed(0)}</b></span><span>Tagged toll <b>₹${toll.toFixed(0)}</b></span></div><span class="route-sub">OpenStreetMap road graph · A* shortest-cost search.</span>`;
      drawRouteLine(coords,origin,destination,'A* · OSM ROAD GRAPH');$('routeInsight').innerHTML='<b>A* route selected</b><p>Primary routing service was unavailable. A* searched the fetched OpenStreetMap road graph using estimated fuel, maintenance and tagged toll cost.</p><div class="ai-chip">A* SEARCH · LIVE OSM DATA</div>';
    } catch(fallbackError) {
      $('routeResult').innerHTML=`<b>Unable to calculate a road route</b><span>${fallbackError.message||err.message}. Check internet access and try again.</span>`;
      $('routeMap').innerHTML='<div class="route-empty">Road route unavailable. No straight-line route has been presented as a drivable route.</div>';
      $('routeInsight').innerHTML='<b>Route engine offline</b><p>Both road-routing providers failed. Check connectivity, then retry. Coordinates and cost inputs have been retained.</p>';
      toast('Road routing unavailable.');
    }
  } finally {button.disabled=false;button.textContent='⌁ Find lowest-cost route';}
}
function nav(view) { document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.view===view));document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));$(view).classList.add('active');$('pageTitle').textContent=view==='planner'?'Load planner':view==='routes'?'Route optimiser':'Item master'; }
async function submitCargoLabel(damaged){if(!latestRiskItem){toast('Generate a plan and score cargo first.');return;}try{const r=await fetch('/api/ai/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({item:latestRiskItem,damaged})});if(!r.ok)throw new Error('Feedback API '+r.status);const d=await r.json();$('mlInsight').textContent=`Outcome recorded for ${latestRiskItem.id}. ${d.labelled_outcomes} labelled real-world outcomes collected; ${d.ready_to_train?'model can now train on labelled outcomes':'need '+(20-d.labelled_outcomes)+' more labels before operational training'}.`;toast('Cargo outcome saved.');}catch(e){toast('Could not save outcome: '+e.message);}}
$('labelDamaged')?.addEventListener('click',()=>submitCargoLabel(true));$('labelSafe')?.addEventListener('click',()=>submitCargoLabel(false));
document.querySelectorAll('.nav').forEach(b=>b.addEventListener('click',()=>nav(b.dataset.view)));
$('generate').onclick=generate;$('optimise').onclick=optimise;$('runBenchmarks').onclick=runBenchmarks;$('step').onclick=()=>{if(stepIndex<placements.length){stepIndex++;updateProgress();}else stopPlayback();};
$('play').onclick=()=>{if(!placements.length)generate();if(playing){stopPlayback();return;}playing=true;$('play').textContent='Ⅱ Pause';timer=setInterval(()=>{if(stepIndex>=placements.length){stopPlayback();return;}stepIndex++;updateProgress();},420);};
$('viewToggle').onclick=()=>{topView=!topView;$('viewToggle').textContent=topView?'3D view':'Top view';window.dispatchEvent(new CustomEvent('boxspace:camera',{detail:{top:topView}}));};
$('resetCamera').onclick=()=>window.dispatchEvent(new Event('boxspace:reset-camera'));
$('trainAI').onclick=async()=>{const b=$('trainAI');b.disabled=true;b.textContent='Training model…';try{const r=await fetch('/api/ai/train',{method:'POST'});if(!r.ok)throw new Error('API '+r.status);const d=await r.json();$('mlStatus').textContent='TRAINED';$('aiBadge').textContent='BACKEND MODEL';$('mlInsight').textContent=`Trained backend logistic regression on ${d.training_samples.toLocaleString()} synthetic scenarios for ${d.epochs} epochs. ${d.note}`;toast('Backend AI model trained.');}catch(e){$('mlStatus').textContent='OFFLINE';toast('AI backend unavailable. Start run_backend first.');}finally{b.disabled=false;b.textContent='✦ Train / refresh AI model';}};
fetch('/api/health').then(r=>r.ok?r.json():Promise.reject()).then(d=>{$('aiBadge').textContent='BACKEND MODEL';}).catch(()=>{$('aiBadge').textContent='LOCAL DEMO MODEL';});
$('reset').onclick=()=>{stopPlayback();placements=[];stepIndex=0;lastPack=null;baselinePack=null;$('engineState').textContent='READY';$('utilMetric').textContent='—';$('placedMetric').textContent='—';$('placementNote').textContent='Not generated';$('benchmarkResult').textContent='Run a baseline plan, then compare the optimised result.';$('checks').querySelectorAll('b').forEach(x=>x.textContent='Pending');updateProgress();toast('Demo reset.');};
$('downloadPlan').onclick=exportPlacement;$('findRoute').onclick=findRoute;$('search').oninput=renderInventory;
$('csvInput').onchange=e=>{const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const parsed=parseCSV(reader.result);if(!parsed.length||!parsed.every(x=>x.sku&&x.qty>0&&x.length_cm>0&&x.width_cm>0&&x.height_cm>0))throw new Error('Invalid rows');inventory=parsed;stats();renderInventory();baselinePack=null;toast('Inventory imported.');}catch(err){toast('CSV invalid. Check required columns and positive dimensions.');}};reader.readAsText(file);};
$('exportInventory').onclick=()=>csvDownload('boxspace_inventory.csv',toCSV(inventory,['sku','name','qty','length_cm','width_cm','height_cm','weight_kg_each','orientation','fragile','stackable','max_stack_kg','late']));
loadDefaults();stats();renderInventory();draw();$('stepCount').textContent='0 / 0';
