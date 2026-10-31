import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/controls/OrbitControls.js';
const host=document.getElementById('scene3d');
const scene=new THREE.Scene();scene.background=new THREE.Color('#edf2ef');scene.fog=new THREE.Fog('#edf2ef',18,42);
const camera=new THREE.PerspectiveCamera(42,1,.1,100);camera.position.set(9,7.2,10.5);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;host.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.06;controls.minDistance=5;controls.maxDistance=24;controls.maxPolarAngle=Math.PI*.49;controls.autoRotate=true;controls.autoRotateSpeed=.55;
scene.add(new THREE.HemisphereLight(0xffffff,0x9aaba4,2.1));const key=new THREE.DirectionalLight(0xffffff,2.5);key.position.set(5,12,8);key.castShadow=true;key.shadow.mapSize.set(2048,2048);scene.add(key);
const mat=(color,roughness=.72,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const ground=new THREE.Mesh(new THREE.PlaneGeometry(80,80),mat('#e6ece8'));ground.rotation.x=-Math.PI/2;ground.position.y=-.08;ground.receiveShadow=true;scene.add(ground);
const grid=new THREE.GridHelper(30,30,'#c9d5ce','#d7e0db');grid.position.y=-.06;scene.add(grid);
const truck=new THREE.Group();scene.add(truck);
const shell=mat('#d5dfda'), dark=mat('#263d40'), glass=mat('#7fa8b2',.25,.15), orange=mat('#ee7951'), tire=mat('#202b2d'), hub=mat('#b6c2bd',.35,.55), floorMat=mat('#657a72');
function box(parent,w,h,d,material,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
const L=5.9,W=2.35,H=2.39;
// Cargo trailer: floor, front wall, side rails and roof rails keep the interior readable.
box(truck,L,.12,W,floorMat,0,.13,0);
box(truck,.09,H,W,shell,-L/2,.13+H/2,0);
for(const z of [-W/2,W/2]){box(truck,L,.07,.07,shell,0,.18,z);box(truck,L,.06,.06,shell,0,H+.13,z);}
for(const x of [-L/2,L/2])box(truck,.07,H,.07,shell,x,.13+H/2,-W/2);
// Reinforced rear/side frame: continuous upper side rails and visible vertical corner posts (closes the missing trailer outline).
for(const z of [-W/2,W/2]){box(truck,.075,H,.075,shell,L/2,.13+H/2,z);box(truck,.075,.075,.075,shell,-L/2,.13+H,z);}
box(truck,.07,.07,W,shell,L/2,.13+H,0);
box(truck,.055,.055,W,shell,-L/2,.13+H,0);
// Subtle floor rails.
for(let z=-.9;z<=.91;z+=.45)box(truck,L-.15,.018,.018,mat('#9aaca4'),0,.205,z);
// Tractor unit and windshield.
const cabX=L/2+1.05;box(truck,1.65,1.45,2.05,dark,cabX,.85,0);box(truck,.78,1.35,2.05,dark,cabX+1.02,.8,0);
box(truck,.06,.82,1.7,glass,cabX+1.42,1.12,0);
box(truck,.05,.32,1.72,orange,cabX+1.47,.42,0);
// Wheels along the near and far sides.
for(const x of [-1.9,1.8,cabX+.9])for(const z of [-1.12,1.12]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.22,32),tire);wheel.rotation.x=Math.PI/2;wheel.position.set(x,.42,z);wheel.castShadow=true;truck.add(wheel);const cap=new THREE.Mesh(new THREE.CylinderGeometry(.19,.19,.235,24),hub);cap.rotation.x=Math.PI/2;cap.position.set(x,.42,z);truck.add(cap);}
// Front bumper, headlights and branding plate.
box(truck,.18,.22,2.18,hub,cabX+1.88,.25,0);box(truck,.04,.35,.7,orange,cabX+1.03,1.35,0);
const cargoGroup=new THREE.Group();truck.add(cargoGroup);let current=[];let viewTop=false;let planSignature='';let shownCount=0;
function clearCargo(){while(cargoGroup.children.length){const o=cargoGroup.children[0];cargoGroup.remove(o);o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();}current=[];}
function addCarton(p,index){const color=p.fragile?'#e7b55f':p.weight>30?'#5f8f9b':['#ee7951','#d96845','#f08a63'][index%3];const material=mat(color,.78);const mesh=new THREE.Mesh(new THREE.BoxGeometry(p.l/100,p.h/100,p.w/100),material);mesh.position.set(-L/2+(p.x+p.l/2)/100,.2+(p.z+p.h/2)/100,-W/2+(p.y+p.w/2)/100);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData={target:mesh.position.clone(),start:new THREE.Vector3(mesh.position.x,4+Math.random()*1.2,mesh.position.z),delay:index*.025,elapsed:0};mesh.position.copy(mesh.userData.start);cargoGroup.add(mesh);const edges=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry),new THREE.LineBasicMaterial({color:'#fff4ed',transparent:true,opacity:.9}));edges.position.copy(mesh.position);edges.userData.parentCarton=mesh;cargoGroup.add(edges);current.push(mesh);}
function animateCargo(t){for(const m of current){const d=m.userData;d.elapsed+=t;const k=Math.max(0,Math.min(1,(d.elapsed-d.delay)/.65));const ease=1-Math.pow(1-k,3);m.position.lerpVectors(d.start,d.target,ease);for(const e of cargoGroup.children)if(e.userData.parentCarton===m)e.position.copy(m.position);}}
window.addEventListener('boxspace:render',e=>{const {placements=[],stepIndex=0,vehicle={L:590,W:235,H:239}}=e.detail||{};truck.scale.set((vehicle.L||590)/590,(vehicle.H||239)/239,(vehicle.W||235)/235);const sig=placements.map(p=>`${p.id}:${p.x},${p.y},${p.z},${p.l},${p.w},${p.h}`).join('|');if(sig!==planSignature){clearCargo();planSignature=sig;shownCount=0;}const target=Math.min(stepIndex,placements.length);if(target<shownCount){clearCargo();shownCount=0;}for(let i=shownCount;i<target;i++)addCarton(placements[i],i);shownCount=target;});
window.addEventListener('boxspace:camera',e=>{viewTop=!!e.detail?.top;if(viewTop){camera.position.set(0,13,.1);controls.target.set(0,1,0);controls.autoRotate=false;}else{camera.position.set(9,7.2,10.5);controls.target.set(.5,1,0);controls.autoRotate=true;}controls.update();});
window.addEventListener('boxspace:reset-camera',()=>{camera.position.set(9,7.2,10.5);controls.target.set(.5,1,0);controls.autoRotate=true;controls.update();});
controls.target.set(.5,1,0);
function resize(){const w=host.clientWidth||900,h=host.clientHeight||500;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}new ResizeObserver(resize).observe(host);resize();let last=0;function loop(now){requestAnimationFrame(loop);const dt=Math.min(.05,(now-last)/1000||0);last=now;animateCargo(dt);controls.update();renderer.render(scene,camera);}requestAnimationFrame(loop);
