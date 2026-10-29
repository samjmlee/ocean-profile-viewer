'use strict';
const el=id=>document.getElementById(id),phases=['up','pause','down','unknown'];
const phaseLabels={up:'Upward',pause:'Near-ice pause',down:'Downward',unknown:'Unclassified / supplied profile'};
const library=[],finite=Number.isFinite;let current=null,mode='2d',selectedTime=null;
const median=a=>{if(!a.length)return null;a.sort((a,b)=>a-b);const n=a.length>>1;return a.length%2?a[n]:(a[n-1]+a[n])/2};
function validate(d){
 if(d?.schema!=='ocean-profile-viewer/1'||!Array.isArray(d.records)||!d.records.length)throw Error('Expected ocean-profile-viewer/1 with at least one record. Convert NetCDF/CSV first.');
 if(typeof d.name!=='string'||d.name.length>200||!d.provenance||typeof d.provenance!=='object')throw Error('Dataset name and provenance are required.');
 if(d.records.length>100000)throw Error('Split datasets larger than 100,000 profiles into time windows.');
 let count=0,previous=-Infinity;
 for(const r of d.records){
  if(!finite(r.t)||!finite(new Date(r.t).getTime())||r.t<previous||!finite(r.lat)||Math.abs(r.lat)>90||!finite(r.lon)||Math.abs(r.lon)>180)throw Error('Profiles require ordered UTC epoch milliseconds and valid latitude/longitude.');
  previous=r.t;if(!['string','number'].includes(typeof r.id))throw Error('Profile ID is required.');
  if(!Array.isArray(r.bounds)||r.bounds.length!==4||!r.bounds.every(x=>x===null||finite(x)))throw Error('Four nullable motor boundaries are required.');
  for(const key of phases){const q=r.segments?.[key];if(!q||!Array.isArray(q.p)||!Array.isArray(q.z)||!Array.isArray(q.raw)||q.raw.length!==4||q.z.length!==q.p.length||!q.raw.every(a=>Array.isArray(a)&&a.length===q.p.length))throw Error('Each phase needs aligned p, z and four raw variable arrays.');
   let last=-Infinity;for(let j=0;j<q.p.length;j++){const p=q.p[j],z=q.z[j];if(!finite(p)||p<0||p>12000||p<last||!finite(z)||z<0||z>13000||q.raw.some(a=>a[j]!==null&&!finite(a[j])))throw Error('Invalid, unsorted or misaligned observation arrays.');last=p}
   q.pmin=q.p.length?q.p[0]:null;q.pmax=q.p.length?q.p.at(-1):null;count+=q.p.length;
  }
  const available=phases.map(k=>r.segments[k]).filter(q=>q.p.length);r.pmin=available.length?Math.min(...available.map(q=>q.pmin)):null;r.pmax=available.length?Math.max(...available.map(q=>q.pmax)):null;
 }
 if(!count)throw Error('No observations in this dataset.');
 d.maxPressure=Math.max(...d.records.map(r=>r.pmax||0));if(d.maxPressure<=0)throw Error('A positive pressure extent is required.');
 d.gapMs=finite(d.gapMs)&&d.gapMs>0?d.gapMs:6*3600000;return d;
}
function phaseOptions(){el('phase').replaceChildren();for(const key of phases)if(current.records.some(r=>r.segments[key].p.length)){const o=new Option(phaseLabels[key],key);el('phase').append(o)}if([...el('phase').options].some(o=>o.value==='up'))el('phase').value='up'}
function selectDataset(i){current=library[i];selectedTime=current.records[0].t;phaseOptions();const samples=current.records.reduce((s,r)=>s+phases.reduce((a,k)=>a+r.segments[k].p.length,0),0);el('summary').textContent=`${current.name} · ${current.level||'unspecified level'} / ${current.product||'unspecified product'} · sample Δp ${finite(current.sampling?.median_positive_pressure_spacing_dbar)?current.sampling.median_positive_pressure_spacing_dbar.toFixed(3)+' dbar':'not reported'} · ${current.records.length.toLocaleString()} profiles · ${samples.toLocaleString()} samples · ${current.synthetic?'SYNTHETIC DEMONSTRATION — NOT OBSERVATIONS':'Local observations'}`;el('metadata').textContent=JSON.stringify(current.provenance,null,2);showView()}
function addDataset(d){validate(d);library.push(d);el('dataset').append(new Option(d.name+(d.synthetic?' · synthetic demo':''),library.length-1));el('dataset').value=library.length-1;selectDataset(library.length-1)}
function showView(){if(!current)return;el('notice').textContent=mode==='3d'?'3D uses '+el('binWidth').value+' dbar median display bins; empty bins are not interpolated. Native samples remain in 2D. Phase: '+phaseLabels[el('phase').value]:'';el('view2d').classList.toggle('active',mode==='2d');el('view3d').classList.toggle('active',mode==='3d');for(const m of ['2d','3d'])el('view'+m).setAttribute('aria-pressed',String(mode===m));const frame=document.createElement('iframe');frame.title=mode==='2d'?'Native profile explorer':'Three-dimensional drift explorer';frame.src=`views/${mode}/index.html`;el('viewerHost').replaceChildren(frame)}
window.OceanWorkspace={
 get phase(){return el('phase').value},get time(){return selectedTime},
 setTime(t){if(finite(t)){selectedTime=t;el('selectedTime').textContent=new Date(t).toISOString().replace('T',' ').replace('.000Z',' UTC')}},
 make2D(){const d=current;return {name:d.name,year:new Date(d.records[0].t).getUTCFullYear(),records:d.records,pressure:[],depths:[2,3,5,10,20,30,50,100,200,500].filter(p=>p<=d.maxPressure),maxPressure:d.maxPressure,gapMs:d.gapMs,source:d.provenance.source||'Local input',level:d.level}},
 make3D(){
  const phase=el('phase').value,rs=current.records.filter(r=>r.segments[phase].p.length),step=Number(el('binWidth').value);
  const bounds=rs.map(r=>r.segments[phase]).filter(q=>q.p.length);if(!bounds.length)throw Error('No samples for this phase.');
  const min=Math.floor(Math.min(...bounds.map(q=>q.pmin))/step)*step,max=Math.max(...bounds.map(q=>q.pmax)),nb=Math.max(1,Math.floor((max-min)/step)+1);if(rs.length*nb>5000000)throw Error("3D grid exceeds 5 million cells; select larger display bins or import a shorter time window.");
  const records=rs.map(r=>{const q=r.segments[phase],b=Array.from({length:4},()=>Array(nb).fill(null)),z=Array(nb).fill(null);let j=0;for(let k=0;k<nb;k++){const start=j;while(j<q.p.length&&q.p[j]<min+(k+1)*step)j++;if(j>start){z[k]=median(q.z.slice(start,j));for(let v=0;v<4;v++)b[v][k]=median(q.raw[v].slice(start,j).filter(finite))}}return {id:r.id,t:r.t,lat:r.lat,lon:r.lon,z,b,flags:'',breakAfter:false}});
  const ranges=[],valueBounds=[];for(let k=0;k<4;k++){let lo=Infinity,hi=-Infinity;const sample=[];for(const r of records)for(const v of r.b[k])if(finite(v)){lo=Math.min(lo,v);hi=Math.max(hi,v);if(sample.length<50000)sample.push(v)}sample.sort((a,b)=>a-b);ranges.push(sample.length?[sample[Math.floor(sample.length*.02)],Math.max(sample[Math.floor(sample.length*.98)],sample[0]+.001)]:[0,1]);valueBounds.push(lo===Infinity?[0,1]:[lo,hi])}
  const maxDepth=Math.max(.01,...bounds.map(q=>q.z.reduce((a,b)=>Math.max(a,b),0)));
  const gaps=records.slice(1).map((r,i)=>r.t-records[i].t).filter(v=>v>0);const gapMs=gaps.length?median(gaps)*1.75:current.gapMs;
  return {binWidth:step,key:'local',name:current.name,label:current.name,product:`${current.level||'Unspecified'} · ${phaseLabels[phase]}`,source:current.provenance.source||'Local input',records,gapMs,total:records.length,stride:1,verticalStride:1,ranges,valueBounds,maxDepth};
 }
};
async function readFile(file){if(file.size>256*1024*1024)throw Error('File exceeds 256 MiB. Convert a smaller date window.');let stream=file.stream();if(file.name.endsWith('.gz'))stream=stream.pipeThrough(new DecompressionStream('gzip'));const reader=stream.getReader(),chunks=[];let size=0;try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>512*1024*1024){await reader.cancel();throw Error('Expanded dataset exceeds 512 MiB. Split it into date windows.')}chunks.push(value)}}finally{reader.releaseLock()}return JSON.parse(await new Blob(chunks).text())}
el('files').onchange=async e=>{for(const file of e.target.files){try{el('notice').textContent='Reading '+file.name+' locally…';addDataset(await readFile(file))}catch(error){el('notice').textContent=file.name+': '+error.message}}e.target.value=''};
el('demo').onclick=async()=>{try{const r=await fetch('demo/synthetic.json');if(!r.ok)throw Error('Demo could not load. Start the local server.');addDataset(await r.json())}catch(e){el('notice').textContent=e.message}};
el('binWidth').onchange=()=>{if(mode==='3d')showView()};el('dataset').onchange=e=>selectDataset(Number(e.target.value));el('phase').onchange=showView;
el('view2d').onclick=()=>{mode='2d';showView()};el('view3d').onclick=()=>{mode='3d';showView()};
el('export').onclick=()=>{if(!current){el('notice').textContent='Load a dataset first.';return}const url=URL.createObjectURL(new Blob([JSON.stringify(current)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=current.name.replace(/[^a-z0-9_-]/gi,'_')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
window.viewerState=()=>({mode,name:current?.name,time:selectedTime,phase:el('phase').value,count:library.length});
