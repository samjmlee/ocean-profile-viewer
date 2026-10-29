'use strict';
const $=id=>document.getElementById(id), datasets=[{key:"local",label:parent.OceanWorkspace.make2D().name}];
const vars=['Temperature','Practical salinity','T − freezing temperature','Potential density anomaly'];
const units=['°C','PSS-78','°C','kg/m³'];
const stops=['#283580','#218dba','#4ec5a8','#e5df77','#f59650','#b8324b'].map(x=>new THREE.Color(x));
let d=datasets[0],index=0,variable=2,mode='focus',ex=10000,depth=10,playing=false,castPlaying=false,phase=0;
let viewMin=0,viewMax=30,busy=false,gapPrefix=[];
let scene,camera,renderer,world,curtain,marker,probe,selected,ray=new THREE.Raycaster(),mouse=new THREE.Vector2();
let labels=[],heatBase,centerLat=80,centerLon=0,localScale=1,triangles=[],lastFrame=0,lastAdvance=0;
let orbit={theta:0,phi:.7,distance:45,target:new THREE.Vector3()},down=null,dragged=false;
const nearHemisphere=new THREE.Plane(new THREE.Vector3(0,1,0),0);
const date=t=>new Date(t).toISOString().slice(0,16).replace('T',' ');
const isnum=v=>typeof v==='number'&&Number.isFinite(v);
function color(v){const [lo,hi]=d.ranges[variable],u=Math.max(0,Math.min(1,(v-lo)/(hi-lo)))*(stops.length-1),i=Math.min(stops.length-2,Math.floor(u));return stops[i].clone().lerp(stops[i+1],u-i)}
function sphere(lat,lon,r=100){const a=lat*Math.PI/180,b=lon*Math.PI/180;return new THREE.Vector3(r*Math.cos(a)*Math.sin(b),r*Math.sin(a),r*Math.cos(a)*Math.cos(b))}
function position(r,z=0){if(mode!=='local')return sphere(r.lat,r.lon,100-z/6371000*100*ex);let dl=((r.lon-centerLon+540)%360)-180;return new THREE.Vector3(dl*Math.PI/180*6371*Math.cos(centerLat*Math.PI/180)*localScale,-z/1000*localScale*ex,(centerLat-r.lat)*Math.PI/180*6371*localScale)}
function connected(i){return i>=0&&i<d.records.length-1&&!d.records[i].breakAfter&&d.records[i+1].t-d.records[i].t<=d.gapMs&&d.records[i+1].t>d.records[i].t}
function connectedSpan(i,k){return k>i&&gapPrefix[k]===gapPrefix[i]}
function disposeGroup(g){g.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose()}});scene.remove(g)}
function line(points,c,opacity=1){const g=new THREE.BufferGeometry().setFromPoints(points);return new THREE.Line(g,new THREE.LineBasicMaterial({color:c,transparent:opacity<1,opacity,depthWrite:false}))}
function background(){
 if(mode==='local'){buildAxes();return}
 const surface=new THREE.Mesh(new THREE.SphereGeometry(100,64,32),new THREE.MeshBasicMaterial({color:0x2d7188,transparent:true,opacity:.055,depthWrite:false,side:THREE.DoubleSide}));world.add(surface);
 function add(p,c,o){const l=line(p,c,o);l.material.clippingPlanes=[nearHemisphere];world.add(l)}
 for(let lat=-60;lat<=80;lat+=20){let p=[];for(let lon=-180;lon<=180;lon+=2)p.push(sphere(lat,lon));add(p,0x426576,.22)}
 for(let lon=-180;lon<180;lon+=30){let p=[];for(let lat=-90;lat<=90;lat+=2)p.push(sphere(lat,lon));add(p,0x426576,.22)}
 for(const f of TOP_LAND.features){const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;for(const poly of polys)for(const ring of poly){add(ring.map(([lon,lat])=>sphere(lat,lon,100.02)),0x487080,.60)}}
}
function defaults(){
 if(mode==='globe')orbit={theta:0,phi:.40,distance:330,target:new THREE.Vector3()};
 else if(mode==='local'){const box=new THREE.Box3();for(const r of d.records){box.expandByPoint(position(r,viewMin));box.expandByPoint(position(r,viewMax))}const bounds=box.getBoundingSphere(new THREE.Sphere());orbit={theta:.35,phi:1.15,distance:bounds.radius/Math.sin(Math.PI/9)*1.1,target:bounds.center};}
 else {const p=sphere(centerLat,centerLon,98);orbit={theta:Math.atan2(p.x,p.z)+.35,phi:.8,distance:Math.max(12,Math.min(65,d.extent*2.1+8)),target:p}}
 updateCamera();
}
function updateCamera(){const s=Math.sin(orbit.phi);camera.position.set(orbit.target.x+orbit.distance*s*Math.sin(orbit.theta),orbit.target.y+orbit.distance*Math.cos(orbit.phi),orbit.target.z+orbit.distance*s*Math.cos(orbit.theta));camera.lookAt(orbit.target);camera.updateMatrixWorld();nearHemisphere.normal.copy(camera.position).normalize()}
function build(reset=false){
 $('depthlabels').hidden=mode==='globe'||mode==='local';
 clearReferenceLabels();if(world)disposeGroup(world);world=new THREE.Group();scene.add(world);background();if(mode!=='local')buildGeographicLabels();triangles=[];
 const rs=d.records,n=rs.length,start=$('window').value==='all'?0:Math.max(0,index-Number($('window').value)+1),end=$('window').value==='all'?n-1:index;
 let track=[];for(let i=0;i<n-1;i++)if(connected(i))track.push(position(rs[i]),position(rs[i+1]));world.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(track),new THREE.LineBasicMaterial({color:0x46697b,transparent:true,opacity:.8})));
 const xyz=[],rgb=[];
 function tri(a,b,c,col,info){for(const v of [a,b,c]){xyz.push(v.x,v.y,v.z);rgb.push(col.r,col.g,col.b)}triangles.push(info)}
 const tstep=Math.max(1,Math.ceil((end-start)/900));
 for(let i=start;i<end;i+=tstep){
  const next=Math.min(end,i+tstep);if(!connectedSpan(i,next))continue;const a=rs[i],b=rs[next],vstep=Math.max(1,Math.ceil(a.z.filter(z=>isnum(z)&&z>=viewMin&&z<=viewMax).length/180));
  for(let j=0;j<Math.min(a.z.length,b.z.length)-1;j+=vstep){
   const jj=Math.min(Math.min(a.z.length,b.z.length)-1,j+vstep);
   const zz=[a.z[j],a.z[jj],b.z[j],b.z[jj]],vv=[a.b[variable][j],a.b[variable][jj],b.b[variable][j],b.b[variable][jj]];
   if(!zz.every(isnum)||!vv.every(isnum)||zz[1]<=zz[0]||zz[3]<=zz[2])continue;
   if(Math.max(zz[0],zz[2])>viewMax||Math.min(zz[1],zz[3])<viewMin)continue;
   let valid=true;for(let h=j;h<=jj;h++)if(!isnum(a.b[variable][h])||!isnum(b.b[variable][h])){valid=false;break}if(!valid)continue;
   for(let h=i+1;h<next;h++)if(!isnum(rs[h].b[variable][j])||!isnum(rs[h].b[variable][jj])){valid=false;break}if(!valid)continue;
   for(let h=0;h<4;h++)zz[h]=Math.max(viewMin,Math.min(viewMax,zz[h]));
   const col=color(vv.reduce((s,v)=>s+v,0)/4),p=[position(a,zz[0]),position(a,zz[1]),position(b,zz[2]),position(b,zz[3])];
   tri(p[0],p[1],p[2],col,{i,j});tri(p[2],p[1],p[3],col,{i,j});
  }
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(xyz,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(rgb,3));geo.computeBoundingSphere();
 curtain=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));world.add(curtain);
 marker=new THREE.Mesh(new THREE.SphereGeometry(mode==='globe'?.7:.20,12,8),new THREE.MeshBasicMaterial({color:0x087763}));world.add(marker);
 probe=new THREE.Mesh(new THREE.SphereGeometry(mode==='local'?.65:.22,12,8),new THREE.MeshBasicMaterial({color:0xffb75b,depthTest:false}));probe.renderOrder=10;world.add(probe);
 selected=line([new THREE.Vector3(),new THREE.Vector3()],0x087763);selected.material.depthTest=false;selected.renderOrder=9;world.add(selected);
 labels=[];$('depthlabels').replaceChildren();for(let j=0;j<5;j++){const z=viewMin+(viewMax-viewMin)*j/4,el=document.createElement('span');el.textContent=z.toFixed(1)+' m';$('depthlabels').append(el);labels.push({el,z})}
 if(reset)defaults();updateSelection(false);window.top3dState={dataset:d.key,count:n,triangles:triangles.length,index,mode,viewMin,viewMax,maxDepth:d.maxDepth,time:rs[index].t};
}
function nearestLevel(r,z){let best=-1,dist=Infinity;for(let j=0;j<r.z.length;j++)if(isnum(r.z[j])&&Math.abs(r.z[j]-z)<dist){best=j;dist=Math.abs(r.z[j]-z)}return best}
function updateSelection(rebuild=true){
 const r=d.records[index];parent.OceanWorkspace.setTime(r.t);$('cursor').value=index;$('stamp').textContent=date(r.t)+' UTC';if(document.activeElement!==$('date'))$('date').value=new Date(r.t).toISOString().slice(0,19);
 $('position').textContent=`${r.lat.toFixed(4)}° N / ${r.lon.toFixed(4)}° E · profile ${index+1} / ${d.records.length} · source #${r.id}`;
 $('depthValue').textContent=depth.toFixed(1)+' m';const k=window.getTrackIndex?window.getTrackIndex(r,depth):nearestLevel(r,depth),actual=k<0?null:r.z[k];
 $('metrics').innerHTML=vars.map((name,j)=>`<article><small>${['Temperature','Salinity','T − Tf','σ₀'][j]}</small><b>${k>=0&&isnum(r.b[j][k])?r.b[j][k].toFixed(3):'—'}</b><small>${units[j]}</small></article>`).join('');
 $('status').textContent=`${actual===null?'No depth sample':`Nearest displayed bin: ${actual.toFixed(2)} m`}${r.flags?' · '+r.flags:''}`;
 if(r.sampleStart)$('status').textContent+=` · Shallow sampling ${date(r.sampleStart)}–${date(r.sampleEnd)} UTC`;
 $('castPlay').disabled=!r.cast;$('castPhase').disabled=!r.cast;
 if(rebuild&&$('window').value!=='all'){build();return}
 marker.position.copy(position(r,0));selected.geometry.dispose();selected.geometry=new THREE.BufferGeometry().setFromPoints([position(r,viewMin),position(r,viewMax)]);
 updateProbe();drawHeat();window.drawLinked?.();if(window.top3dState){window.top3dState.index=index;window.top3dState.time=r.t}
}
function updateProbe(){
 const r=d.records[index],cast=r.cast;let z=depth;
 if(cast?.length){const t=cast[0][0]+phase*(cast.at(-1)[0]-cast[0][0]);let j=1;while(j<cast.length-1&&cast[j][0]<t)j++;const a=cast[Math.max(0,j-1)],b=cast[Math.min(j,cast.length-1)],f=b[0]===a[0]?0:(t-a[0])/(b[0]-a[0]);z=a[1]+f*(b[1]-a[1]);$('castInfo').textContent=`${date(t)} UTC · ${z.toFixed(2)} m · ${cast.length} retained samples${z>d.maxDepth?' · below colored section':''}`}
 else $('castInfo').textContent='Amber marker shows inspected depth. This is not a replay of native sensor motion.';
 probe.position.copy(position(r,z));$('castPhase').value=Math.round(phase*1000);
}
function makeHeat(){
 const c=$('heat'),w=Math.max(300,Math.floor(c.clientWidth*devicePixelRatio)),h=Math.floor(130*devicePixelRatio);c.width=w;c.height=h;
 heatBase=document.createElement('canvas');heatBase.width=w;heatBase.height=h;const ctx=heatBase.getContext('2d');ctx.fillStyle='#f3f7f9';ctx.fillRect(0,0,w,h);
 const rs=d.records,t0=rs[0].t,span=Math.max(1,rs.at(-1).t-t0),left=35*devicePixelRatio,ww=w-left;
 const step=Math.max(1,Math.ceil(rs.length/(w/devicePixelRatio)));
 for(let i=0;i<rs.length;i+=step){const r=rs[i],x=left+(r.t-t0)/span*ww,k=Math.min(rs.length-1,i+step),next=connectedSpan(i,k)?rs[k].t:r.t+Math.min(d.gapMs/1.75,span/rs.length),dx=Math.max(1,(next-r.t)/span*ww);
  for(let j=0;j<r.z.length-1;j++)if(isnum(r.z[j])&&isnum(r.z[j+1])&&isnum(r.b[variable][j])&&r.z[j+1]>r.z[j]&&r.z[j+1]>=viewMin&&r.z[j]<=viewMax){const a=Math.max(viewMin,r.z[j]),b=Math.min(viewMax,r.z[j+1]);ctx.fillStyle='#'+color(r.b[variable][j]).getHexString();ctx.fillRect(x,(a-viewMin)/(viewMax-viewMin)*h,dx,Math.max(1,(b-a)/(viewMax-viewMin)*h))}
 }
 ctx.fillStyle='#385969';ctx.font=`${10*devicePixelRatio}px system-ui`;for(const f of [0,.5,1])ctx.fillText((viewMin+(viewMax-viewMin)*f).toFixed(0)+' m',0,Math.max(11*devicePixelRatio,Math.min(h-3,h*f)));drawHeat();
}
function drawHeat(){if(!heatBase)return;const c=$('heat'),ctx=c.getContext('2d');ctx.drawImage(heatBase,0,0);const x=35*devicePixelRatio+(d.records[index].t-d.records[0].t)/Math.max(1,d.records.at(-1).t-d.records[0].t)*(c.width-35*devicePixelRatio);ctx.strokeStyle='#193846';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,c.height);ctx.stroke()}
async function load(){
 if(busy)return;busy=true;window.top3dReady=false;playing=castPlaying=false;$('dataset').disabled=true;$('loading').style.display='flex';$('loading').textContent='Loading full-depth observations…';
 try{
 d=parent.OceanWorkspace.make3D();
 $('play').textContent='▶';$('castPlay').textContent='Replay selected cast';phase=0;index=d.records.reduce((best,r,i)=>Math.abs(r.t-parent.OceanWorkspace.time)<Math.abs(d.records[best].t-parent.OceanWorkspace.time)?i:best,0);gapPrefix=[0];for(let i=0;i<d.records.length-1;i++)gapPrefix.push(gapPrefix.at(-1)+(connected(i)?0:1));
 viewMin=0;viewMax=d.maxDepth;$('viewMin').value=0;$('viewMax').value=d.maxDepth;$('viewMin').max=d.maxDepth;$('viewMax').max=d.maxDepth;$('depthNumber').max=d.maxDepth;$('viewNotice').textContent=`Available: 0–${d.maxDepth.toFixed(2)} m. All depths loaded; mesh/overview reduced for display only.`;
 centerLat=d.records.reduce((s,r)=>s+r.lat,0)/d.records.length;centerLon=Math.atan2(d.records.reduce((s,r)=>s+Math.sin(r.lon*Math.PI/180),0),d.records.reduce((s,r)=>s+Math.cos(r.lon*Math.PI/180),0))*180/Math.PI;
 const mid=sphere(centerLat,centerLon);d.extent=Math.max(...d.records.map(r=>sphere(r.lat,r.lon).distanceTo(mid)));localScale=70/Math.max(1,d.extent/100*6371);
 // A useful initial depth scale, with the actual multiplier always shown.
 d.motionMax=Math.max(d.maxDepth,...d.records.map(r=>r.cast?Math.max(...r.cast.map(p=>p[1])):0));
 const cap=Math.min(1e5,.85*6371000/d.motionMax);$('exaggeration').max=Math.log10(cap);
 ex=Math.min(cap,Math.max(1,12*6371000/100/d.maxDepth));$('exaggeration').value=Math.log10(ex);$('exValue').textContent=Math.round(ex).toLocaleString()+'×';
 $('depth').max=d.maxDepth;depth=Math.min(depth,d.maxDepth);$('depth').value=depth;$('cursor').max=d.records.length-1;
 $('sceneTitle').textContent=d.name+' / '+'selected phase';$('sceneSubtitle').textContent=`${d.product} · 0–${d.maxDepth.toFixed(0)} m · ${d.source}`;
 $('coverage').textContent=`${d.records.length.toLocaleString()} displayed / ${d.total.toLocaleString()} positioned profiles. ${d.validTotal?d.validTotal.toLocaleString()+' contain valid CTD. ':''}Selected phase only; ${d.binWidth} dbar display bins.`;
 $('method').textContent=`Current source: ${d.source}. ${$('coverage').textContent} This view uses ${d.binWidth} dbar median display bins for the selected phase. The 2D view retains native imported samples. A curtain joins different observation times; it is not a simultaneous ocean field.`;
 $('start').textContent=date(d.records[0].t)+' UTC';$('end').textContent=date(d.records.at(-1).t)+' UTC';$('date').min=new Date(d.records[0].t).toISOString().slice(0,19);$('date').max=new Date(d.records.at(-1).t).toISOString().slice(0,19);
 window.resetLinked?.();legend();build(true);resize();window.top3dReady=true;$('loading').style.display='none';
 }catch(e){$('loading').textContent='Unable to load observations: '+e.message;console.error(e)}finally{busy=false;$('dataset').disabled=false}
}
function legend(){$('legendName').textContent=vars[variable]+' / '+units[variable];$('scale').innerHTML=d.ranges[variable].map(v=>`<span>${v.toFixed(3)}</span>`).join('')}
function resize(){const e=$('scene');renderer.setSize(e.clientWidth,e.clientHeight);camera.aspect=e.clientWidth/e.clientHeight;camera.updateProjectionMatrix();if(d.records){makeHeat();window.drawLinked?.()}}
function pick(e){const box=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-box.left)/box.width*2-1,-(e.clientY-box.top)/box.height*2+1);ray.setFromCamera(mouse,camera);const hit=ray.intersectObject(curtain)[0];return hit?triangles[hit.faceIndex]:null}
function frame(t){requestAnimationFrame(frame);if(busy||!d.records){lastFrame=t;return}if(playing&&t-lastAdvance>1000/Number($('speed').value)){if(index===d.records.length-1){playing=false;$('play').textContent='▶'}else{index++;phase=0;updateSelection()}lastAdvance=t}if(castPlaying){phase=Math.min(1,phase+(t-lastFrame)/12000);updateProbe();if(phase===1){castPlaying=false;$('castPlay').textContent='Replay selected cast'}}lastFrame=t;updateCamera();renderer.render(scene,camera);updateReferenceLabels();for(const {el,z}of labels){const p=position(d.records[index],z).project(camera);el.style.display=p.z<1&&Math.abs(p.x)<1&&Math.abs(p.y)<1?'block':'none';el.style.left=((p.x+1)/2*$('scene').clientWidth+9)+'px';el.style.top=((-p.y+1)/2*$('scene').clientHeight-6)+'px'}}
function init(){
 scene=new THREE.Scene();scene.background=new THREE.Color(0xffffff);camera=new THREE.PerspectiveCamera(40,1,.01,1500);renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.localClippingEnabled=true;renderer.setPixelRatio(Math.min(devicePixelRatio,2));$('scene').prepend(renderer.domElement);
 for(const item of datasets){const option=document.createElement('option');option.value=item.key;option.textContent=item.label;$('dataset').append(option)}
 for(const file of []){const detail=document.createElement('details'),summary=document.createElement('summary');summary.textContent=`${file.file} · ${file.variables.length} variables`;detail.append(summary);for(const v of file.variables){const p=document.createElement('p'),code=document.createElement('code');code.textContent=`${v.name} [${v.shape.join(' × ')}] ${v.attrs.units||''}`;p.append(code);detail.append(p)}$('inventory').append(detail)}
 $('dataset').onchange=load;$('variable').onchange=()=>{variable=+$('variable').value;legend();build();makeHeat()};$('window').onchange=()=>build();
 $('exaggeration').oninput=()=>{ex=10**Number($('exaggeration').value);$('exValue').textContent=Math.round(ex).toLocaleString()+'×';build()};
 $('cursor').oninput=()=>{index=+$('cursor').value;phase=0;castPlaying=false;updateSelection()};$('depth').oninput=()=>{depth=+$('depth').value;updateSelection(false)};
 $('prev').onclick=()=>{index=Math.max(0,index-1);phase=0;updateSelection()};$('next').onclick=()=>{index=Math.min(d.records.length-1,index+1);phase=0;updateSelection()};$('play').onclick=()=>{playing=!playing;if(playing&&index===d.records.length-1)index=0;$('play').textContent=playing?'Ⅱ':'▶'};
 $('castPlay').onclick=()=>{castPlaying=!castPlaying;if(phase===1)phase=0;playing=false;$('play').textContent='▶';if(castPlaying){const r=d.records[index],a=position(r),b=position(r,Math.max(...r.cast.map(p=>p[1])));orbit.target.copy(a).add(b).multiplyScalar(.5);orbit.distance=Math.max(10,a.distanceTo(b)*1.8);}$('castPlay').textContent=castPlaying?'Pause cast':'Replay selected cast'};$('castPhase').oninput=()=>{phase=+$('castPhase').value/1000;castPlaying=false;$('castPlay').textContent='Replay selected cast';updateProbe()};
 for(const m of ['globe','focus','local'])$(m).onclick=()=>{const wasLocal=mode==='local';mode=m;if(mode==='local'||wasLocal){ex=Math.min(10**Number($('exaggeration').max),Math.max(1,mode==='local'?55*1000/(localScale*d.maxDepth):12*6371000/100/d.maxDepth));$('exaggeration').value=Math.log10(ex);$('exValue').textContent=Math.round(ex).toLocaleString()+'×'}for(const x of ['globe','focus','local'])$(x).classList.toggle('active',x===m);build(true)};$('reset').onclick=defaults;$('geography').onclick=()=>{showPlaces=!showPlaces;$('geography').setAttribute('aria-pressed',String(showPlaces));};
 $('heat').onclick=e=>{const b=$('heat').getBoundingClientRect(),u=Math.max(0,Math.min(1,(e.clientX-b.left-35)/(b.width-35))),t=d.records[0].t+u*(d.records.at(-1).t-d.records[0].t);index=d.records.reduce((best,r,i)=>Math.abs(r.t-t)<Math.abs(d.records[best].t-t)?i:best,0);depth=Math.max(viewMin,Math.min(viewMax,viewMin+(e.clientY-b.top)/b.height*(viewMax-viewMin)));$('depth').value=depth;phase=0;updateSelection()};
 const c=renderer.domElement;c.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};dragged=false;c.setPointerCapture(e.pointerId)});c.addEventListener('pointermove',e=>{if(down){const dx=e.clientX-down.x,dy=e.clientY-down.y;if(Math.abs(dx)+Math.abs(dy)>2)dragged=true;if(e.shiftKey){const right=new THREE.Vector3().setFromMatrixColumn(camera.matrix,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrix,1);orbit.target.addScaledVector(right,-dx*orbit.distance/700).addScaledVector(up,dy*orbit.distance/700)}else{orbit.theta-=dx*.006;orbit.phi=Math.max(.04,Math.min(Math.PI-.04,orbit.phi-dy*.006))}down={x:e.clientX,y:e.clientY};$('hover').style.display='none'}else{const h=pick(e);$('hover').style.display=h?'block':'none';if(h){const r=d.records[h.i],box=$('scene').getBoundingClientRect();$('hover').style.left=Math.min(e.clientX-box.left+15,box.width-245)+'px';$('hover').style.top=Math.max(5,e.clientY-box.top-60)+'px';$('hover').textContent=`${date(r.t)} UTC\n${r.z[h.j].toFixed(2)} m · ${r.b[variable][h.j]?.toFixed(3)} ${units[variable]}\nClick to select (cell spans adjacent profiles)`}}});c.addEventListener('pointerup',e=>{if(!dragged){const h=pick(e);if(h){index=h.i;depth=d.records[index].z[h.j];$('depth').value=depth;updateSelection()}}down=null});c.addEventListener('pointercancel',()=>down=null);c.addEventListener('wheel',e=>{e.preventDefault();orbit.distance=Math.max(.2,Math.min(800,orbit.distance*Math.exp(e.deltaY*.001)))},{passive:false});c.addEventListener('pointerleave',()=>$('hover').style.display='none');
 load();window.addEventListener('resize',resize);requestAnimationFrame(frame);
}
try{init()}catch(e){$('loading').textContent='Unable to open 3D view: '+e.message;console.error(e)}
