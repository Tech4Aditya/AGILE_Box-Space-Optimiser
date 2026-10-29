/* BoxSpaceOptimiser demo prototype. Runs locally with no build step. */
(() => {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const VEHICLES = [
    {id:'T1', name:'14 ft truck', short:'14 FT', l:400, w:195, h:200, payload:3500, capacity:15.60},
    {id:'T2', name:'17 ft truck', short:'17 FT', l:500, w:220, h:214, payload:5000, capacity:23.50},
    {id:'T3', name:'20 ft container', short:'20 FT', l:600, w:250, h:242, payload:7500, capacity:36.30}
  ];
  const TARGET_VOLUME = 24.6, TARGET_WEIGHT = 2495;
  let skus = [], selectedVehicle = 'T3', currentPlan = null, history = [], lateItems = [], runCounter = 0;
  let toastTimer;
  let layoutView = '3d', hitRegions = [];
  let selectedPlacementId = null;
  // Camera state affects only rendering; the packing algorithm and coordinates remain unchanged.
  let cameraAzimuth = 35, cameraElevation = 25, cameraZoom = 1;
  let pointerDrag = null, suppressNextCanvasClick = false;

  function makeSeedData() {
    const raw = [];
    for (let i=0;i<36;i++) {
      const l = 39 + ((i*17+9)%43);
      const w = 32 + ((i*13+5)%37);
      const h = 38 + ((i*19+11)%47);
      raw.push({l,w,h,rawVol:l*w*h});
    }
    const rawTotal = raw.reduce((s,x)=>s+x.rawVol*4,0);
    const scale = Math.cbrt((TARGET_VOLUME*1e6)/rawTotal);
    const qtys = Array(36).fill(4);
    const rows = raw.map((d,i) => {
      const L = Math.max(20,Math.round(d.l*scale)), W = Math.max(20,Math.round(d.w*scale)), H = Math.max(20,Math.round(d.h*scale));
      const upright = i < 14;
      const fragile = i >= 4 && i < 10;
      const flat = i >= 30 && i < 33;
      return {sku:`H-${String(i+1).padStart(3,'0')}`,name: ['Pantry carton','Storage box','Floor lamp','Kitchen appliance','Glass set','Decor piece','Office chair','Tool case','Textile pack','Display stand','Book carton','Small cabinet'][i%12] + ` ${String(i+1).padStart(2,'0')}`,qty:qtys[i],l:L,w:W,h:H,weight:0,orientation:upright?'Upright only':flat?'Flat only':'Any',fragile,stackable:!(i>=33),late:i>=34};
    });
    // Scale dimensions to match the source case volume while preserving integer centimetres.
    let vol = rows.reduce((s,r)=>s+r.l*r.w*r.h*r.qty/1e6,0);
    const correction = Math.cbrt(TARGET_VOLUME/vol);
    rows.forEach(r=>{r.l=Math.max(15,Math.round(r.l*correction));r.w=Math.max(15,Math.round(r.w*correction));r.h=Math.max(15,Math.round(r.h*correction));});
    vol = rows.reduce((s,r)=>s+r.l*r.w*r.h*r.qty/1e6,0);
    // Keep the demo headline tied to the case brief; SKU-level geometry is explicitly illustrative.
    const totalRawWeight = rows.reduce((s,r)=>s+(r.l*r.w*r.h/1e6)*101.422*r.qty,0);
    rows.forEach((r,i)=>{r.weight=Math.max(1,Math.round((r.l*r.w*r.h/1e6)*101.422*TARGET_WEIGHT/totalRawWeight*10)/10);});
    // Distribute rounding remainder across the first SKU so total weight is exactly the case value.
    let wsum=rows.reduce((s,r)=>s+r.weight*r.qty,0);
    rows[0].weight=Math.round((rows[0].weight+(TARGET_WEIGHT-wsum)/rows[0].qty)*10)/10;
    // Last two SKU groups represent the eight late-arriving units in this scenario.
    rows.forEach((r,i)=>{r.late=i>=34;});
    return rows;
  }
  function fmt(n, digits=1){return Number(n).toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});}
  function fmtInt(n){return Math.round(n).toLocaleString('en-US');}
  function volumeOf(s){return s.l*s.w*s.h*s.qty/1e6;}
  function totals(items=skus){return items.reduce((a,s)=>{a.units+=s.qty;a.volume+=volumeOf(s);a.weight+=s.weight*s.qty;return a;},{units:0,volume:0,weight:0});}
  function getVehicle(id=selectedVehicle){return VEHICLES.find(v=>v.id===id)||VEHICLES[2];}
  function showToast(message){const t=$('#toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2600);}

  function renderMetrics(){
    const t=totals(); const v=getVehicle();
    $('#metricVolume').innerHTML=`${fmt(t.volume,2)} <small>m³</small>`;
    $('#metricWeight').innerHTML=`${fmtInt(t.weight)} <small>kg</small>`;
    $('#metricVehicle').innerHTML=`${v.short.toLowerCase()} <small>${v.id==='T3'?'container':'truck'}</small>`;
    $('#metricLate').innerHTML=`${lateItems.length ? lateItems.reduce((s,x)=>s+x.qty,0) : 8} <small>units</small>`;
    $('#volumeFoot').textContent=`${fmt(t.volume/v.capacity*100,1)}% of selected`;
    $('#weightFoot').textContent=`${fmt(t.weight/v.payload*100,1)}% used`;
    $('.mini-bar b').style.width=`${Math.min(100,t.volume/v.capacity*100)}%`;
  }
  function renderVehicles(){
    const t=totals();
    $('#vehicleGrid').innerHTML=VEHICLES.map(v=>{
      const vp=t.volume/v.capacity*100, wp=t.weight/v.payload*100, feasible=vp<=100&&wp<=100;
      return `<article class="vehicle-card ${selectedVehicle===v.id?'selected':''}" data-vehicle="${v.id}"><div class="vehicle-top"><div class="vehicle-icon">▰</div><div><div class="vehicle-name">${v.name}</div><div class="vehicle-dims">${v.l} × ${v.w} × ${v.h} cm · ${fmt(v.capacity,1)} m³ nominal</div></div><span class="vehicle-number">${v.id}</span></div><div class="vehicle-stats"><span>Volume required <strong>${fmt(vp,1)}%</strong></span><span>Payload <strong>${fmt(wp,1)}%</strong></span></div><div class="capacity-bar"><span class="${vp>100?'over':''}" style="width:${Math.min(100,vp)}%"></span></div><div class="vehicle-footer"><span class="vehicle-status ${feasible?'ok':'bad'}">${feasible?'● VOLUME / PAYLOAD PASS':'● CAPACITY FAIL'}</span><span class="vehicle-reason">${vp>100?'Volume overflow':wp>100?'Payload overflow':'Screening pass'}</span></div></article>`;
    }).join('');
    $$('.vehicle-card').forEach(el=>el.addEventListener('click',()=>{selectedVehicle=el.dataset.vehicle;selectedPlacementId=null;renderVehicles();renderMetrics();$('#layoutVehicle').textContent=getVehicle().name;if(currentPlan){currentPlan=null;clearPlanDisplay();}showToast(`${getVehicle().name} selected. Generate a new plan.`);}));
  }
  function renderSkuSelect(){const old=$('#lateSku').value;$('#lateSku').innerHTML=skus.map(s=>`<option value="${s.sku}">${s.sku} — ${s.name}</option>`).join('');if(skus.some(s=>s.sku===old))$('#lateSku').value=old;}
  function renderInventory(){
    const q=($('#skuSearch')?.value||'').toLowerCase();
    const shown=skus.filter(s=>s.sku.toLowerCase().includes(q)||s.name.toLowerCase().includes(q));
    $('#inventoryCount').textContent=`${shown.length} SKUs · ${fmtInt(shown.reduce((a,s)=>a+s.qty,0))} units`;
    $('#inventoryBody').innerHTML=shown.map(s=>`<tr data-sku="${s.sku}"><td><span class="sku-code">${s.sku}</span><span class="sku-name">${s.name}</span></td><td><span class="editable" data-field="qty">${s.qty}</span></td><td><span class="editable" data-field="l">${s.l}</span> × <span class="editable" data-field="w">${s.w}</span> × <span class="editable" data-field="h">${s.h}</span></td><td><span class="editable" data-field="weight">${s.weight.toFixed(1)}</span></td><td><span class="rule-chip ${s.orientation==='Upright only'?'upright':''}">${s.orientation}</span></td><td><span class="rule-chip ${s.fragile?'fragile':''}">${s.fragile?'Yes':'No'}</span></td><td><span class="rule-chip">${s.stackable?'Yes':'No'}</span></td></tr>`).join('');
    $$('.editable').forEach(el=>el.addEventListener('dblclick',()=>editCell(el)));
  }
  function editCell(el){
    if(el.querySelector('input'))return;
    const row=el.closest('tr'),sku=skus.find(s=>s.sku===row.dataset.sku),field=el.dataset.field,old=sku[field];
    const input=document.createElement('input');input.type='number';input.min=field==='qty'?'1':'0.1';input.step=field==='weight'?'0.1':'1';input.value=old;input.style.width='58px';input.style.padding='4px';input.style.border='1px solid #ed7a35';
    el.textContent='';el.appendChild(input);input.focus();input.select();
    const save=()=>{let val=Number(input.value);if(!Number.isFinite(val)||val<=0){val=old;}if(field==='qty')val=Math.max(1,Math.round(val));if(['l','w','h'].includes(field))val=Math.max(1,Math.round(val));sku[field]=val;renderInventory();renderMetrics();renderVehicles();showToast(`${sku.sku} updated. Regenerate the plan to apply changes.`);};
    input.addEventListener('keydown',e=>{if(e.key==='Enter')save();if(e.key==='Escape')renderInventory();});input.addEventListener('blur',save,{once:true});
  }
  function permutations(s){
    const d=[s.l,s.w,s.h];
    let p;
    if(s.orientation==='Upright only')p=[[d[0],d[1],d[2]],[d[1],d[0],d[2]]];
    else if(s.orientation==='Flat only') {const h=Math.min(...d),base=d.filter(x=>x!==h); if(base.length<2)p=[[d[0],d[1],d[2]]];else p=[[base[0],base[1],h],[base[1],base[0],h]];}
    else p=[[d[0],d[1],d[2]],[d[0],d[2],d[1]],[d[1],d[0],d[2]],[d[1],d[2],d[0]],[d[2],d[0],d[1]],[d[2],d[1],d[0]]];
    const seen=new Set();return p.filter(a=>{const k=a.join(',');if(seen.has(k))return false;seen.add(k);return true;});
  }
  function expandUnits(source, includeLate=true){
    const out=[];
    source.forEach(s=>{for(let i=0;i<s.qty;i++){
      const late=!!s.late && i>=Math.max(0,s.qty-4);
      if(!includeLate&&late)continue;
      out.push({id:`${s.sku}-${String(i+1).padStart(2,'0')}`,sku:s.sku,name:s.name,l:s.l,w:s.w,h:s.h,weight:s.weight,orientation:s.orientation,fragile:s.fragile,stackable:s.stackable,late,volume:s.l*s.w*s.h/1e6});
    }});
    return out;
  }
  function overlap(a,b){return a.x < b.x+b.l-0.01 && a.x+a.l > b.x+0.01 && a.y < b.y+b.w-0.01 && a.y+a.w > b.y+0.01 && a.z < b.z+b.h-0.01 && a.z+a.h > b.z+0.01;}
  function supportRatio(c,placed){
    if(c.z<=0.01)return 1;
    let area=0;
    for(const p of placed){if(Math.abs(p.z+p.h-c.z)<0.5&&p.stackable&&!p.fragile){const dx=Math.max(0,Math.min(c.x+c.l,p.x+p.l)-Math.max(c.x,p.x));const dy=Math.max(0,Math.min(c.y+c.w,p.y+p.w)-Math.max(c.y,p.y));area+=dx*dy;}}
    return Math.min(1,area/(c.l*c.w));
  }
  function canPlace(c,v,placed){
    if(c.x<-.01||c.y<-.01||c.z<-.01||c.x+c.l>v.l+.01||c.y+c.w>v.w+.01||c.z+c.h>v.h+.01)return false;
    for(const p of placed)if(overlap(c,p))return false;
    if(c.z>0.01&&supportRatio(c,placed)<0.8)return false;
    // Do not place anything on top of a fragile or non-stackable support.
    if(c.z>0.01){for(const p of placed){if(Math.abs(p.z+p.h-c.z)<0.5){const dx=Math.max(0,Math.min(c.x+c.l,p.x+p.l)-Math.max(c.x,p.x));const dy=Math.max(0,Math.min(c.y+c.w,p.y+p.w)-Math.max(c.y,p.y));if(dx*dy>0&&(!p.stackable||p.fragile))return false;}}}
    return true;
  }
  function pack(source, vehicleId, bufferPct=0){
    const v=VEHICLES.find(x=>x.id===vehicleId), original=expandUnits(source,true), total=original.reduce((s,x)=>s+x.volume,0), totalWeight=original.reduce((s,x)=>s+x.weight,0);
    const effectiveCap=v.capacity*(1-bufferPct/100);const volumePass=total<=effectiveCap+0.0001, payloadPass=totalWeight<=v.payload;
    // Prioritize stable base items first; fragile/no-stack items are deliberately considered later.
    original.sort((a,b)=>{
      const pa=(a.fragile||!a.stackable?1:0)+(a.orientation==='Upright only'?0.1:0),pb=(b.fragile||!b.stackable?1:0)+(b.orientation==='Upright only'?0.1:0);
      return pa-pb || b.volume-a.volume || b.weight-a.weight;
    });
    const placed=[], unplaced=[], points=[{x:0,y:0,z:0}], pointKeys=new Set(['0|0|0']);
    const addPoint=(x,y,z)=>{if(x<0||y<0||z<0||x>v.l||y>v.w||z>v.h)return;const key=`${Math.round(x*10)/10}|${Math.round(y*10)/10}|${Math.round(z*10)/10}`;if(!pointKeys.has(key)){pointKeys.add(key);points.push({x,y,z});}};
    for(let index=0;index<original.length;index++){
      const item=original[index];let chosen=null;
      points.sort((a,b)=>a.z-b.z||a.y-b.y||a.x-b.x);
      const orientations=permutations(item);
      outer: for(const pt of points){for(const dims of orientations){const c={...item,x:pt.x,y:pt.y,z:pt.z,l:dims[0],w:dims[1],h:dims[2]};if(canPlace(c,v,placed)){chosen=c;break outer;}}}
      if(chosen){chosen.sequence=placed.length+1;placed.push(chosen);addPoint(chosen.x+chosen.l,chosen.y,chosen.z);addPoint(chosen.x,chosen.y+chosen.w,chosen.z);addPoint(chosen.x,chosen.y,chosen.z+chosen.h);addPoint(chosen.x+chosen.l,chosen.y+chosen.w,chosen.z);addPoint(chosen.x+chosen.l,chosen.y,chosen.z+chosen.h);addPoint(chosen.x,chosen.y+chosen.w,chosen.z+chosen.h);addPoint(chosen.x+chosen.l,chosen.y+chosen.w,chosen.z+chosen.h);}
      else unplaced.push(item);
      // Keep the candidate frontier bounded on unusually difficult inputs.
      if(points.length>2200){points.sort((a,b)=>a.z-b.z||a.y-b.y||a.x-b.x);points.length=1800;pointKeys.clear();points.forEach(p=>pointKeys.add(`${Math.round(p.x*10)/10}|${Math.round(p.y*10)/10}|${Math.round(p.z*10)/10}`));}
    }
    const placedVol=placed.reduce((s,x)=>s+x.volume,0), placedWeight=placed.reduce((s,x)=>s+x.weight,0);
    return {vehicle:v,placed,unplaced,totalUnits:original.length,placedUnits:placed.length,totalVolume:total,placedVolume:placedVol,totalWeight,placedWeight,volumePass,payloadPass,effectiveCap,bufferPct,complete:unplaced.length===0&&volumePass&&payloadPass,createdAt:new Date()};
  }
  function clearPlanDisplay(){
    $('#canvasOverlay').style.display='flex';$('#placedCount').textContent='—';$('#packingStatus').textContent='Not generated';$('#packingStatus').className='status-text';$('#planSummary').innerHTML='<div><span class="summary-icon">↳</span><span>Generate a plan to see the placement summary.</span></div>';
    drawEmptyCanvas();renderChecks(null);$('#boxInspector').innerHTML='<span class="inspector-kicker">BOX INSPECTOR</span><strong>No box selected</strong><span>Generate a plan, then click any visible box to see its SKU, dimensions and coordinates.</span>';hitRegions=[];
  }
  function drawEmptyCanvas(){const c=$('#layoutCanvas'),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#f7f9f9';ctx.fillRect(0,0,c.width,c.height);}
  function drawTopPlan(plan){
    const canvas=$('#layoutCanvas'),ctx=canvas.getContext('2d'),v=plan.vehicle;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#f7f9f9';ctx.fillRect(0,0,canvas.width,canvas.height);
    const margin={x:52,y:42},availW=canvas.width-100,availH=canvas.height-95,scale=Math.min(availW/v.l,availH/v.w),floorW=v.l*scale,floorH=v.w*scale,x0=(canvas.width-floorW)/2,y0=(canvas.height-floorH)/2+8;
    ctx.fillStyle='#edf2f3';ctx.fillRect(x0-7,y0-7,floorW+14,floorH+14);ctx.fillStyle='#e1e9eb';ctx.fillRect(x0,y0,floorW,floorH);ctx.strokeStyle='#b8c8cd';ctx.lineWidth=1.5;ctx.strokeRect(x0,y0,floorW,floorH);
    ctx.save();ctx.beginPath();ctx.rect(x0,y0,floorW,floorH);ctx.clip();
    const ordered=[...plan.placed].sort((a,b)=>a.z-b.z||a.sequence-b.sequence);
    for(const p of ordered){const x=x0+p.x*scale,y=y0+p.y*scale,w=p.l*scale,h=p.w*scale;let color=p.late?'#a69bd5':p.fragile?'#ed9b63':p.orientation==='Upright only'?'#83b59f':'#79aabe';ctx.globalAlpha=p.z>0.1?0.82:0.95;ctx.fillStyle=color;ctx.fillRect(x+0.5,y+0.5,Math.max(1,w-1),Math.max(1,h-1));ctx.strokeStyle='#ffffff';ctx.lineWidth=1;ctx.strokeRect(x+0.5,y+0.5,Math.max(1,w-1),Math.max(1,h-1));if(w>22&&h>14){ctx.fillStyle='#17313a';ctx.font='9px DM Mono, monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(p.sequence).padStart(2,'0'),x+w/2,y+h/2);}}
    ctx.restore();ctx.fillStyle='#77888e';ctx.font='10px DM Mono, monospace';ctx.textAlign='center';ctx.fillText(`${v.l} cm`,x0+floorW/2,y0+floorH+27);ctx.save();ctx.translate(x0-26,y0+floorH/2);ctx.rotate(-Math.PI/2);ctx.fillText(`${v.w} cm`,0,0);ctx.restore();
    ctx.fillStyle='#a1adb1';ctx.font='9px DM Mono, monospace';ctx.textAlign='left';ctx.fillText('FRONT / DOOR',x0,y0-17);ctx.textAlign='right';ctx.fillText(`${plan.placed.length} PLACED`,x0+floorW,y0-17);
    $('#canvasOverlay').style.display='none';
  }
  function drawPlan(plan){
    $('#topViewBtn').classList.toggle('active',layoutView==='top');
    $('#threeDViewBtn').classList.toggle('active',layoutView==='3d');
    $('#legendNote').textContent=layoutView==='3d'?'3D view · click a box to inspect it':'Top view · labels show loading sequence';
    if(layoutView==='top'){drawTopPlan(plan);return;}
    draw3DPlan(plan);
  }
  function hexShade(hex,amount){
    const raw=hex.replace('#','');const n=parseInt(raw,16);let r=(n>>16)&255,g=(n>>8)&255,b=n&255;
    r=Math.max(0,Math.min(255,Math.round(r+255*amount)));g=Math.max(0,Math.min(255,Math.round(g+255*amount)));b=Math.max(0,Math.min(255,Math.round(b+255*amount)));
    return `rgb(${r},${g},${b})`;
  }
  function polygon(ctx,pts,fill,stroke='#ffffff'){
    ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();
  }
  function pointInPolygon(point,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const xi=poly[i].x,yi=poly[i].y,xj=poly[j].x,yj=poly[j].y;
    const intersect=((yi>point.y)!==(yj>point.y))&&(point.x<(xj-xi)*(point.y-yi)/(yj-yi+1e-9)+xi);if(intersect)inside=!inside;
  }return inside;}
  function draw3DPlan(plan){
    const canvas=$('#layoutCanvas'),ctx=canvas.getContext('2d'),v=plan.vehicle;
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#f7f9f9';ctx.fillRect(0,0,canvas.width,canvas.height);hitRegions=[];

    const theta=cameraAzimuth*Math.PI/180, elev=cameraElevation*Math.PI/180;
    const ct=Math.cos(theta), st=Math.sin(theta), ce=Math.cos(elev), se=Math.sin(elev);
    // Orthographic orbit camera: rotate the world around the vertical axis, then tilt it.
    const cameraPoint=(x,y,z)=>({u:x*ct-y*st, depth:(x*st+y*ct)*ce+z*se, v:(x*st+y*ct)*se-z*ce});
    const corners=[];
    for(const x of [0,v.l])for(const y of [0,v.w])for(const z of [0,v.h])corners.push(cameraPoint(x,y,z));
    const minU=Math.min(...corners.map(p=>p.u)),maxU=Math.max(...corners.map(p=>p.u));
    const minV=Math.min(...corners.map(p=>p.v)),maxV=Math.max(...corners.map(p=>p.v));
    const padX=65,padY=54;
    const scale=Math.max(.01,Math.min((canvas.width-padX*2)/(maxU-minU),(canvas.height-padY*2)/(maxV-minV))*cameraZoom);
    const drawW=(maxU-minU)*scale,drawH=(maxV-minV)*scale;
    const offX=(canvas.width-drawW)/2,offY=(canvas.height-drawH)/2;
    const P=(x,y,z)=>{const q=cameraPoint(x,y,z);return {x:offX+(q.u-minU)*scale,y:offY+(q.v-minV)*scale,depth:q.depth};};

    // Floor plane.
    const floor=[P(0,0,0),P(v.l,0,0),P(v.l,v.w,0),P(0,v.w,0)];
    polygon(ctx,floor,'#e8eff0','#c7d5d9');

    // Draw visible container edges as a light wireframe.
    ctx.save();ctx.strokeStyle='#b9cbd0';ctx.lineWidth=1.15;ctx.setLineDash([5,4]);
    const edges=[];
    for(const x of [0,v.l])for(const y of [0,v.w])edges.push([P(x,y,0),P(x,y,v.h)]);
    for(const z of [0,v.h]){edges.push([P(0,0,z),P(v.l,0,z)],[P(0,v.w,z),P(v.l,v.w,z)],[P(0,0,z),P(0,v.w,z)],[P(v.l,0,z),P(v.l,v.w,z)]);}
    for(const [a,b] of edges){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}ctx.restore();

    // Build only the faces visible from the current orbit direction, then depth-sort them.
    const faces=[];
    const xSide=st>=0?'max':'min';
    const ySide=ct>=0?'max':'min';
    for(const b of plan.placed){
      const x0=b.x,x1=b.x+b.l,y0=b.y,y1=b.y+b.w,z0=b.z,z1=b.z+b.h;
      const top=[P(x0,y0,z1),P(x1,y0,z1),P(x1,y1,z1),P(x0,y1,z1)];
      faces.push({placement:b,poly:top,depth:top.reduce((a,p)=>a+p.depth,0)/4,type:'top',base:b.late?'#a69bd5':b.fragile?'#ed9b63':b.orientation==='Upright only'?'#83b59f':'#79aabe'});
      const x=xSide==='max'?x1:x0;
      const xFace=[P(x,y0,z0),P(x,y1,z0),P(x,y1,z1),P(x,y0,z1)];
      faces.push({placement:b,poly:xFace,depth:xFace.reduce((a,p)=>a+p.depth,0)/4,type:'sideA',base:b.late?'#a69bd5':b.fragile?'#ed9b63':b.orientation==='Upright only'?'#83b59f':'#79aabe'});
      const y=ySide==='max'?y1:y0;
      const yFace=[P(x0,y,z0),P(x1,y,z0),P(x1,y,z1),P(x0,y,z1)];
      faces.push({placement:b,poly:yFace,depth:yFace.reduce((a,p)=>a+p.depth,0)/4,type:'sideB',base:b.late?'#a69bd5':b.fragile?'#ed9b63':b.orientation==='Upright only'?'#83b59f':'#79aabe'});
    }
    faces.sort((a,b)=>a.depth-b.depth);
    for(const f of faces){
      const shade=f.type==='top'?0:f.type==='sideA'?-0.11:-0.20;
      polygon(ctx,f.poly,hexShade(f.base,shade),selectedPlacementId===f.placement.id?'#d87536':'#ffffff');
      // Register every visible face so side faces remain selectable at steep orbit angles.
      hitRegions.push({placement:f.placement,poly:f.poly,depth:f.depth});
      if(f.type==='top'){
        const c=f.poly.reduce((a,p)=>({x:a.x+p.x/4,y:a.y+p.y/4}),{x:0,y:0});
        const faceW=Math.min(Math.hypot(f.poly[1].x-f.poly[0].x,f.poly[1].y-f.poly[0].y),Math.hypot(f.poly[2].x-f.poly[1].x,f.poly[2].y-f.poly[1].y));
        if(faceW>18){ctx.fillStyle='#17313a';ctx.font=faceW>34?'10px DM Mono, monospace':'8px DM Mono, monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(f.placement.sequence).padStart(2,'0'),c.x,c.y);}
      }
    }

    // Dimension hints and orientation marker.
    ctx.fillStyle='#77888e';ctx.font='10px DM Mono, monospace';ctx.textAlign='left';ctx.textBaseline='alphabetic';
    ctx.fillText(`ORBIT ${String(Math.round(cameraAzimuth)).padStart(3,'0')}°`,18,22);
    ctx.fillText(`L ${v.l} cm · W ${v.w} cm · H ${v.h} cm`,18,38);
    ctx.textAlign='right';ctx.fillText(`${plan.placed.length}/${plan.totalUnits} PLACED`,canvas.width-18,22);
    ctx.textAlign='left';ctx.fillStyle='#a1adb1';ctx.fillText('FRONT / DOOR',18,canvas.height-15);
    $('#canvasOverlay').style.display='none';
    const selected=plan.placed.find(p=>p.id===selectedPlacementId);
    if(selected)showBoxInspector(selected);else $('#boxInspector').innerHTML='<span class="inspector-kicker">BOX INSPECTOR</span><strong>Select a box in the 3D view</strong><span>Click a visible box face to reveal its SKU, dimensions, coordinates and handling rules.</span>';
    updateCameraReadouts();
  }
  function updateCameraReadouts(){
    const a=$('#cameraAngleValue'),e=$('#cameraElevationValue'),as=$('#cameraAngle'),es=$('#cameraElevation');
    if(a)a.textContent=`${String(Math.round(cameraAzimuth)).padStart(3,'0')}°`;
    if(e)e.textContent=`${Math.round(cameraElevation)}°`;
    if(as)as.value=String(Math.round(cameraAzimuth));if(es)es.value=String(Math.round(cameraElevation));
  }
  function setCameraAngle(value){cameraAzimuth=((Number(value)%351)+351)%351;updateCameraReadouts();if(currentPlan&&layoutView==='3d')draw3DPlan(currentPlan);}
  function setCameraElevation(value){cameraElevation=Math.max(8,Math.min(65,Number(value)||25));updateCameraReadouts();if(currentPlan&&layoutView==='3d')draw3DPlan(currentPlan);}
  function showBoxInspector(b){
    $('#boxInspector').innerHTML=`<span class="inspector-kicker">BOX INSPECTOR · LOAD #${String(b.sequence).padStart(3,'0')}</span><strong>${b.id} · ${b.name}</strong><span>SKU ${b.sku} · Size ${b.l} × ${b.w} × ${b.h} cm · ${fmt(b.weight,1)} kg · Position X ${fmt(b.x,1)}, Y ${fmt(b.y,1)}, Z ${fmt(b.z,1)} cm</span><span>Rules: ${b.orientation} · ${b.fragile?'FRAGILE':'non-fragile'} · ${b.stackable?'stackable':'do not stack on'}${b.late?' · LATE ORDER':''}</span>`;
  }
  function selectBoxAt(event){
    if(suppressNextCanvasClick){suppressNextCanvasClick=false;return;}
    if(!currentPlan||layoutView!=='3d')return;const canvas=$('#layoutCanvas'),rect=canvas.getBoundingClientRect();const point={x:(event.clientX-rect.left)*canvas.width/rect.width,y:(event.clientY-rect.top)*canvas.height/rect.height};
    // Reverse draw order so the visually uppermost box gets priority.
    for(let i=hitRegions.length-1;i>=0;i--){if(pointInPolygon(point,hitRegions[i].poly)){selectedPlacementId=hitRegions[i].placement.id;draw3DPlan(currentPlan);return;}}
    $('#boxInspector').innerHTML='<span class="inspector-kicker">BOX INSPECTOR</span><strong>No box at that point</strong><span>Click the top face of a visible box. Some boxes may be partly hidden by items above them.</span>';
  }
  function renderChecks(plan){
    const checks=plan?[
      ['Vehicle boundaries',plan.placed.every(p=>p.x>=0&&p.y>=0&&p.z>=0&&p.x+p.l<=plan.vehicle.l+0.1&&p.y+p.w<=plan.vehicle.w+0.1&&p.z+p.h<=plan.vehicle.h+0.1),`${plan.placed.length} placements checked`],
      ['Orientation rules',true,'Allowed orientation used by packer'],
      ['Stacking / support',plan.placed.every(p=>p.z<0.1||supportRatio(p,plan.placed.filter(x=>x.sequence<p.sequence))>=0.8),'≥80% support rule applied to stacked items'],
      ['Payload limit',plan.totalWeight<=plan.vehicle.payload,`${fmt(plan.totalWeight/plan.vehicle.payload*100,1)}% of payload capacity`]
    ]:[['Vehicle boundaries',null,'Run the packer to validate placements'],['Orientation rules',null,'Waiting for plan'],['Stacking / support',null,'Waiting for plan'],['Payload limit',null,'Waiting for plan']];
    $('#checksGrid').innerHTML=checks.map(c=>`<div class="check-item ${c[1]===null?'pending':c[1]?'pass':'fail'}"><span>${c[1]===null?'○':c[1]?'✓':'×'}</span><div><strong>${c[0]}</strong><small>${c[2]}</small></div></div>`).join('');
  }
  function addHistory(title,description,status){history.unshift({n:++runCounter,title,description,status,time:new Date()});renderHistory();}
  function renderHistory(){const el=$('#historyList');if(!history.length){el.innerHTML='<div class="empty-history"><div>↻</div><strong>No runs yet</strong><span>Generate a plan to record the first run.</span></div>';return;}el.innerHTML=history.map(h=>`<div class="history-row"><div class="history-num">${String(h.n).padStart(2,'0')}</div><div><strong>${h.title}</strong><p>${h.description} · <b style="color:${h.status==='PASS'?'#27856e':h.status==='FAIL'?'#bd534a':'#bd7b38'}">${h.status}</b></p></div><div class="history-time">${h.time.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}<br>${h.time.toLocaleDateString()}</div></div>`).join('');}
  function generatePlan(){
    const buffer=Number($('#bufferSlider').value);const start=performance.now();
    const plan=pack(skus,selectedVehicle,buffer);currentPlan=plan;selectedPlacementId=plan.placed[0]?.id||null;renderMetrics();renderVehicles();drawPlan(plan);
    $('#layoutVehicle').textContent=plan.vehicle.name;$('#placedCount').textContent=`${plan.placed.length} / ${plan.totalUnits}`;
    const status=plan.complete?'COMPLETE':plan.volumePass&&plan.payloadPass?'PARTIAL PACK':'SCREEN FAIL';$('#packingStatus').textContent=status;$('#packingStatus').className='status-text '+(plan.complete?'':'');
    $('#planSummary').innerHTML=`<div><span class="summary-icon">↳</span><span><b>${plan.placed.length}/${plan.totalUnits} units placed.</b> ${fmt(plan.placedVolume,2)} m³ placed of ${fmt(plan.totalVolume,2)} m³ requested. ${plan.unplaced.length?`${plan.unplaced.length} items could not be placed by this heuristic.`:'All units found a placement in this run.'} Runtime ${Math.round(performance.now()-start)} ms. <br><span style="color:#9aa5a9">This is a heuristic layout; validate stability, loading access and real vehicle dimensions before operational use.</span></span></div>`;
    renderChecks(plan);addHistory('Loading plan generated',`${plan.vehicle.name} · ${plan.placed.length}/${plan.totalUnits} placed · ${fmt(plan.totalVolume,2)} m³`,plan.complete?'PASS':plan.volumePass&&plan.payloadPass?'PARTIAL':'FAIL');
    if(!plan.volumePass)showToast('Screen failed: load volume exceeds effective vehicle capacity.');else if(!plan.payloadPass)showToast('Screen failed: payload limit exceeded.');else if(!plan.complete)showToast(`${plan.unplaced.length} item(s) could not be placed. Review the heuristic layout.`);else showToast('Plan generated. Review constraints before presenting.');
  }
  function testLateOrder(){
    if(!currentPlan){showToast('Generate a base plan first.');return;}
    const sku=skus.find(s=>s.sku===$('#lateSku').value);if(!sku)return;const qty=Math.max(1,Math.min(20,Math.round(Number($('#lateQty').value)||1)));const urgency=$('#lateUrgency').value;
    const extra={...sku,qty,sku:`RUSH-${sku.sku}`,name:`${sku.name} (late)`,late:true};const combined=[...skus,extra];const result=pack(combined,selectedVehicle,Number($('#bufferSlider').value));
    const passed=result.complete;const box=$('#lateResult');box.className=`late-result ${passed?'success':'failure'}`;box.innerHTML=`<div class="result-icon">${passed?'✓':'!'}</div><div><strong>${passed?'Late order accommodated':result.volumePass&&result.payloadPass?'Re-plan incomplete':'Late order rejected by capacity screen'}</strong><p>${qty} × ${sku.sku} · ${urgency}. ${result.placed.length}/${result.totalUnits} units placed after re-plan. ${result.unplaced.length?`${result.unplaced.length} item(s) remain unplaced.`:'All items passed the heuristic placement run.'} ${result.totalVolume>result.effectiveCap?`Load volume ${fmt(result.totalVolume,2)} m³ exceeds buffered capacity ${fmt(result.effectiveCap,2)} m³.`:''}</p></div>`;
    lateItems.push({sku:sku.sku,qty,urgency});$('#metricLate').innerHTML=`${lateItems.reduce((s,x)=>s+x.qty,0)} <small>tested units</small>`;
    addHistory('Late-order stress test',`${qty} × ${sku.sku} · ${result.placed.length}/${result.totalUnits} placed`,passed?'PASS':'FAIL');showToast(passed?'Late order fit in the re-planned load.':'Stress test exposed a capacity or packing issue.');
  }
  function csvEscape(v){const s=String(v??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
  function download(filename,text,type='text/plain'){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);}
  function exportCsv(){const headers=['sku','name','qty','length_cm','width_cm','height_cm','weight_kg_each','orientation','fragile','stackable','late'];const lines=[headers.join(','),...skus.map(s=>[s.sku,s.name,s.qty,s.l,s.w,s.h,s.weight,s.orientation,s.fragile,s.stackable,s.late].map(csvEscape).join(','))];download('boxspace-item-master.csv',lines.join('\n'),'text/csv');}
  function importCsv(file){const reader=new FileReader();reader.onload=()=>{try{const lines=String(reader.result).trim().split(/\r?\n/);if(lines.length<2)throw Error('CSV has no rows');const heads=lines.shift().split(',').map(x=>x.trim().toLowerCase());const idx=(...names)=>heads.findIndex(h=>names.includes(h));const parseLine=line=>{const cells=[];let cur='',quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'&&line[i+1]==='"'&&quoted){cur+='"';i++;}else if(ch==='"')quoted=!quoted;else if(ch===','&&!quoted){cells.push(cur);cur='';}else cur+=ch;}cells.push(cur);return cells;};const next=lines.map(line=>{const c=parseLine(line),get=(...n)=>c[idx(...n)]??'';return {sku:get('sku'),name:get('name')||get('item'),qty:Number(get('qty','quantity')),l:Number(get('length_cm','length','l')),w:Number(get('width_cm','width','w')),h:Number(get('height_cm','height','h')),weight:Number(get('weight_kg_each','weight','kg_per_unit')),orientation:get('orientation')||'Any',fragile:/^(true|yes|1)$/i.test(get('fragile')),stackable:!/^(false|no|0)$/i.test(get('stackable')),late:/^(true|yes|1)$/i.test(get('late'))};});if(next.some(s=>!s.sku||![s.qty,s.l,s.w,s.h,s.weight].every(Number.isFinite)||s.qty<1||s.l<=0||s.w<=0||s.h<=0||s.weight<=0))throw Error('Rows need sku, qty, dimensions and positive weight values');skus=next;currentPlan=null;renderAll();clearPlanDisplay();showToast(`Imported ${skus.length} SKUs.`);}catch(e){showToast(`CSV import failed: ${e.message}`);}};reader.readAsText(file);}
  function exportPlan(){if(!currentPlan){showToast('Generate a plan before exporting.');return;}const p=currentPlan;const payload={generated_at:p.createdAt.toISOString(),vehicle:{name:p.vehicle.name,dimensions_cm:[p.vehicle.l,p.vehicle.w,p.vehicle.h],payload_kg:p.vehicle.payload},summary:{requested_units:p.totalUnits,placed_units:p.placed.length,unplaced_units:p.unplaced.length,requested_volume_m3:Number(p.totalVolume.toFixed(3)),placed_volume_m3:Number(p.placedVolume.toFixed(3)),weight_kg:Number(p.totalWeight.toFixed(1)),buffer_percent:p.bufferPct,complete:p.complete},placements:p.placed.map(x=>({sequence:x.sequence,unit_id:x.id,sku:x.sku,x_cm:+x.x.toFixed(1),y_cm:+x.y.toFixed(1),z_cm:+x.z.toFixed(1),length_cm:x.l,width_cm:x.w,height_cm:x.h,weight_kg:x.weight,fragile:x.fragile,orientation:x.orientation,late:x.late})),unplaced:p.unplaced.map(x=>({unit_id:x.id,sku:x.sku,reason:'No valid position found by current heuristic'})),disclaimer:'Heuristic prototype output. Not a certified load plan; validate real dimensions, stability, axle limits, restraint, loading access and handling rules.'};download('boxspace-loading-plan.json',JSON.stringify(payload,null,2),'application/json');}
  function renderAll(){renderMetrics();renderVehicles();renderSkuSelect();renderInventory();renderHistory();$('#layoutVehicle').textContent=getVehicle().name;}
  function setView(view){$$('.view').forEach(v=>v.classList.remove('active'));$(`#${view}View`).classList.add('active');$$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===view));$('#headerView').textContent=view==='planner'?'Overview':view==='inventory'?'Item master':'Run history';}
  function resetDemo(){skus=makeSeedData();selectedVehicle='T3';currentPlan=null;selectedPlacementId=null;lateItems=[];history=[];runCounter=0;$('#bufferSlider').value=8;$('#bufferValue').textContent='8%';$('#lateQty').value=2;$('#lateResult').className='late-result';$('#lateResult').innerHTML='<div class="result-icon">↗</div><div><strong>Ready to stress-test</strong><p>Generate a base plan, then test an incoming item.</p></div>';renderAll();clearPlanDisplay();showToast('Demo data reset.');}
  function init(){skus=makeSeedData();renderAll();clearPlanDisplay();
    $$('.nav-item').forEach(n=>n.addEventListener('click',()=>setView(n.dataset.view)));
    const brandHome=$('.brand-home');if(brandHome)brandHome.addEventListener('click',e=>{e.preventDefault();setView('planner');window.scrollTo({top:0,behavior:'smooth'});});
    const canvas=$('#layoutCanvas');
    canvas.addEventListener('click',selectBoxAt);
    canvas.addEventListener('pointerdown',e=>{if(layoutView!=='3d'||!currentPlan)return;pointerDrag={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};canvas.setPointerCapture?.(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{if(!pointerDrag||pointerDrag.id!==e.pointerId)return;const dx=e.clientX-pointerDrag.lastX,dy=e.clientY-pointerDrag.lastY;if(Math.abs(e.clientX-pointerDrag.x)+Math.abs(e.clientY-pointerDrag.y)>4)pointerDrag.moved=true;if(pointerDrag.moved){suppressNextCanvasClick=true;cameraAzimuth=((cameraAzimuth+dx*0.55)%351+351)%351;cameraElevation=Math.max(8,Math.min(65,cameraElevation+dy*0.28));updateCameraReadouts();if(currentPlan&&layoutView==='3d')draw3DPlan(currentPlan);}pointerDrag.lastX=e.clientX;pointerDrag.lastY=e.clientY;});
    const endDrag=e=>{if(pointerDrag&&pointerDrag.id===e.pointerId){if(pointerDrag.moved){suppressNextCanvasClick=true;setTimeout(()=>{suppressNextCanvasClick=false;},0);}pointerDrag=null;}};
    canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);canvas.addEventListener('lostpointercapture',()=>{pointerDrag=null;});
    canvas.addEventListener('wheel',e=>{if(layoutView!=='3d'||!currentPlan)return;e.preventDefault();cameraZoom=Math.max(0.72,Math.min(1.65,cameraZoom+(e.deltaY<0?0.06:-0.06)));draw3DPlan(currentPlan);},{passive:false});
    $('#cameraAngle').addEventListener('input',e=>setCameraAngle(e.target.value));
    $('#cameraElevation').addEventListener('input',e=>setCameraElevation(e.target.value));
    $('#resetCameraBtn').addEventListener('click',()=>{cameraAzimuth=35;cameraElevation=25;cameraZoom=1;updateCameraReadouts();if(currentPlan&&layoutView==='3d')draw3DPlan(currentPlan);showToast('3D camera reset.');});
    updateCameraReadouts();
    $('#topViewBtn').addEventListener('click',()=>{layoutView='top';if(currentPlan)drawPlan(currentPlan);else drawEmptyCanvas();});
    $('#threeDViewBtn').addEventListener('click',()=>{layoutView='3d';if(currentPlan)drawPlan(currentPlan);else drawEmptyCanvas();});
    $('#runTopBtn').addEventListener('click',generatePlan);$('#resetBtn').addEventListener('click',resetDemo);$('#testLateBtn').addEventListener('click',testLateOrder);$('#exportPlanBtn').addEventListener('click',exportPlan);$('#downloadCsvBtn').addEventListener('click',exportCsv);$('#uploadCsv').addEventListener('change',e=>{if(e.target.files[0])importCsv(e.target.files[0]);e.target.value='';});$('#skuSearch').addEventListener('input',renderInventory);$('#bufferSlider').addEventListener('input',e=>{$('#bufferValue').textContent=`${e.target.value}%`;});$('#clearHistoryBtn').addEventListener('click',()=>{history=[];renderHistory();showToast('Run history cleared.');});
  }
  init();
})();
