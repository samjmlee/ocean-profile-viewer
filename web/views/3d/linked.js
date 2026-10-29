'use strict';
(() => {
 const colors=['#b95d16','#1676ad','#128361','#824eb0'];
 let pin=null,cacheKey='',series=[],boxes={},air=[];
 function nearestTime(t){let lo=0,hi=d.records.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(d.records[mid].t<t)lo=mid+1;else hi=mid}return lo>0&&t-d.records[lo-1].t<d.records[lo].t-t?lo-1:lo}
 function setIndex(i){playing=castPlaying=false;$('play').textContent='▶';$('castPlay').textContent='Replay selected cast';index=Math.max(0,Math.min(d.records.length-1,i));phase=0;updateSelection()}
 function setDepth(z){depth=Math.max(0,Math.min(d.maxDepth,z));$('depth').value=depth;$('depthNumber').value=depth.toFixed(2);updateSelection(false)}
 function trackIndex(r,z){const j=nearestLevel(r,z);if(j<0)return -1;const a=r.z[j],prev=j>0?r.z[j-1]:null,next=j+1<r.z.length?r.z[j+1]:null;let half=.2;if(isnum(prev)&&isnum(next))half=Math.min(a-prev,next-a)/2;else if(isnum(prev))half=(a-prev)/2;else if(isnum(next))half=(next-a)/2;return Math.abs(z-a)<=Math.max(.005,half)+.001?j:-1}
 window.getTrackIndex=trackIndex;
 function extent(values,fallback=[0,1]){let lo=Infinity,hi=-Infinity;for(const v of values)if(isnum(v)){lo=Math.min(lo,v);hi=Math.max(hi,v)}if(lo===Infinity)return fallback;let p=Math.max(.001,(hi-lo)*.08);return [lo-p,hi+p]}
 function setup(id){const c=$(id),w=c.clientWidth,h=c.clientHeight,ratio=Math.min(devicePixelRatio,2);c.width=Math.round(w*ratio);c.height=Math.round(h*ratio);const ctx=c.getContext('2d');ctx.scale(ratio,ratio);ctx.fillStyle='#ffffff';ctx.fillRect(0,0,w,h);ctx.font='11px system-ui';return {ctx,w,h,l:52,r:w-16,t:18,b:h-40}}
 function text(g,t,x,y,align='center',color='#526d7a'){g.fillStyle=color;g.textAlign=align;g.fillText(t,x,y)}
 function stroke(g,a,b,c,e,color='#dce6eb',dash=[]){g.beginPath();g.strokeStyle=color;g.lineWidth=1;g.setLineDash(dash);g.moveTo(a,b);g.lineTo(c,e);g.stroke();g.setLineDash([])}
 function clip(o,fn){o.ctx.save();o.ctx.beginPath();o.ctx.rect(o.l,o.t,o.r-o.l,o.b-o.t);o.ctx.clip();fn();o.ctx.restore()}
 function format(v,span){return v.toFixed(span<.1?3:span<3?2:span<30?1:0)}
 function profiles(){const current=d.records[index];$('profileStamp').textContent=date(current.t)+' UTC · source #'+current.id;
  for(let k=0;k<4;k++){const o=setup('profile'+k),{ctx:g,l,r,t,b,w,h}=o,shown=[current];if($('showPrevious').checked&&index>0)shown.push(d.records[index-1]);if(pin!==null)shown.push(d.records[pin]);
   const vals=shown.flatMap(rec=>rec.b[k].filter((v,j)=>rec.z[j]>=viewMin&&rec.z[j]<=viewMax));const range=$('profileAxes').value==='fixed'?extent(d.valueBounds[k]):extent(vals),[lo,hi]=range;
   const X=v=>l+(v-lo)/(hi-lo)*(r-l),Y=z=>t+(z-viewMin)/(viewMax-viewMin)*(b-t);boxes['profile'+k]={...o,Y};
   for(let j=0;j<=4;j++){const z=viewMin+(viewMax-viewMin)*j/4;stroke(g,l,Y(z),r,Y(z));text(g,z.toFixed(viewMax-viewMin<5?1:0),l-7,Y(z)+4,'right')}
   for(let j=0;j<=3;j++){const v=lo+(hi-lo)*j/3;stroke(g,X(v),t,X(v),b);text(g,format(v,hi-lo),X(v),b+20)}
   text(g,'Depth (m)',l,t-5,'left');text(g,units[k],(l+r)/2,h-5);
   function curve(rec,c,dash=[]){g.beginPath();g.strokeStyle=c;g.lineWidth=1.8;g.setLineDash(dash);let live=false;for(let j=0;j<rec.z.length;j++){const z=rec.z[j],v=rec.b[k][j];if(!isnum(z)||!isnum(v)){live=false;continue}if(live)g.lineTo(X(v),Y(z));else g.moveTo(X(v),Y(z));live=true}g.stroke();g.setLineDash([])}
   clip(o,()=>{if(pin!==null)curve(d.records[pin],'#263c48',[6,3]);if($('showPrevious').checked&&index>0)curve(d.records[index-1],'#6f8390',[3,4]);curve(current,colors[k]);stroke(g,l,Y(depth),r,Y(depth),'#087763',[3,3]);const j=trackIndex(current,depth);if(j>=0&&isnum(current.b[k][j])){g.fillStyle=colors[k];g.beginPath();g.arc(X(current.b[k][j]),Y(current.z[j]),4,0,Math.PI*2);g.fill()}});
   if(!vals.some(isnum))text(g,'No observations in this depth view',(l+r)/2,(t+b)/2);
  }
 }
 function bounds(){const n=$('seriesWindow').value;if(n==='all')return [d.records[0].t,d.records.at(-1).t];return [Math.max(d.records[0].t,d.records[index].t-Number(n)*86400000),Math.min(d.records.at(-1).t,d.records[index].t+Number(n)*86400000)]}
 function weatherCell(r){const lat=Math.floor(r.lat*4+.5)/4,lon=((Math.floor(r.lon*4+.5)/4+180)%360+360)%360-180;return lat.toFixed(2)+','+lon.toFixed(2)}
 function airAt(r){const cell=window.TOP_WEATHER?.cells?.[weatherCell(r)];return cell?.days?.[new Date(r.t).toISOString().slice(0,10)]??null}
 function rebuildSeries(){const key=d.key+':'+depth.toFixed(4);if(cacheKey===key)return;cacheKey=key;series=[[],[],[],[]];air=[];
  for(const r of d.records){const j=trackIndex(r,depth);for(let k=0;k<4;k++)series[k].push(j>=0?r.b[k][j]:null);air.push(airAt(r))}
 }
 function timePlot(id,values,color,ylabel){const o=setup(id),{ctx:g,l,r,t,b,h}=o,[a,z]=bounds(),indices=[];for(let i=0;i<d.records.length;i++)if(d.records[i].t>=a&&d.records[i].t<=z)indices.push(i);const [lo,hi]=extent(indices.map(i=>values[i]));const X=tm=>l+(tm-a)/Math.max(1,z-a)*(r-l),Y=v=>b-(v-lo)/(hi-lo)*(b-t);boxes[id]={...o,a,z};
  for(let j=0;j<=3;j++){const v=lo+(hi-lo)*j/3;stroke(g,l,Y(v),r,Y(v));text(g,format(v,hi-lo),l-6,Y(v)+4,'right')}
  for(let j=0;j<=3;j++){const tm=a+(z-a)*j/3;stroke(g,X(tm),t,X(tm),b);const label=new Date(tm).toISOString().slice(z-a<3*86400000?11:5,z-a<3*86400000?16:10);text(g,label,X(tm),b+19,j===0?'left':j===3?'right':'center')}
  text(g,ylabel,l,t-5,'left');text(g,'UTC',(l+r)/2,h-4);
  clip(o,()=>{g.beginPath();g.strokeStyle=color;g.lineWidth=1.4;let live=false,prev=-1;for(const i of indices){const v=values[i];if(!isnum(v)){live=false;prev=-1;continue}const x=X(d.records[i].t),y=Y(v);if(!live||prev!==i-1||!connected(prev))g.moveTo(x,y);else g.lineTo(x,y);live=true;prev=i}g.stroke();
   // Show isolated observations instead of losing them when neighboring values are missing.
   g.fillStyle=color;for(const i of indices)if(isnum(values[i])&&(i===0||i===values.length-1||!isnum(values[i-1])||!isnum(values[i+1])||!connected(i-1)||!connected(i))){g.beginPath();g.arc(X(d.records[i].t),Y(values[i]),1.8,0,Math.PI*2);g.fill()}
   stroke(g,X(d.records[index].t),t,X(d.records[index].t),b,'#263c48');if(isnum(values[index])){g.beginPath();g.fillStyle=color;g.arc(X(d.records[index].t),Y(values[index]),4,0,Math.PI*2);g.fill()}
  });if(!indices.some(i=>isnum(values[i])))text(g,'No available values in this window',(l+r)/2,(t+b)/2);
 }
 window.drawLinked=function(){if(!d.records)return;profiles();rebuildSeries();if(document.activeElement!==$('depthNumber'))$('depthNumber').value=depth.toFixed(2);$('seriesDepth').textContent=depth.toFixed(2)+' m';
  for(let k=0;k<4;k++)timePlot('series'+k,series[k],colors[k],units[k]);timePlot('airPlot',air,'#f2be75','°C');
  const r=d.records[index],v=air[index],cell=window.TOP_WEATHER?.cells?.[weatherCell(r)];$('airValue').textContent=isnum(v)?v.toFixed(1)+' °C':'Unavailable';$('airInfo').textContent=`${new Date(r.t).toISOString().slice(0,10)} UTC · profile location ${r.lat.toFixed(4)}°, ${r.lon.toFixed(4)}° · `+(cell?`ERA5 cell ${cell.lat.toFixed(2)}°, ${cell.lon.toFixed(2)}° · daily mean`:'ERA5 value has not been downloaded for this cell/day.');
  window.top3dLinkedState={dataset:d.key,index,time:r.t,depth,viewMin,viewMax,profilePoints:r.z.length,seriesCount:d.records.length,values:series.map(v=>v[index]),air:v,pin};
 };
 window.resetLinked=()=>{pin=null;cacheKey='';$('searchNotice').textContent='';$('seriesHover').textContent='';};
 function applyDepth(a,b){if(!Number.isFinite(a)||!Number.isFinite(b)||a<0||b>d.maxDepth+.001||b<=a){$('viewNotice').textContent=`Enter 0 ≤ From < To ≤ ${d.maxDepth.toFixed(3)} m.`;return}viewMin=a;viewMax=b;$('viewMin').value=a;$('viewMax').value=b;$('viewNotice').textContent=`Showing ${a.toFixed(2)}–${b.toFixed(2)} m of 0–${d.maxDepth.toFixed(2)} m.`;build(true);makeHeat();window.drawLinked()}
 $('applyDepth').onclick=()=>applyDepth(Number($('viewMin').value),Number($('viewMax').value));$('fullDepth').onclick=()=>applyDepth(0,d.maxDepth);$('upperDepth').onclick=()=>applyDepth(0,Math.min(30,d.maxDepth));
 $('depthNumber').onchange=()=>{const z=Number($('depthNumber').value);if(Number.isFinite(z))setDepth(z)};
 $('depthNumber').oninput=()=>{const value=$('depthNumber').value,z=Number(value);if(value!==''&&Number.isFinite(z)&&z>=0&&z<=d.maxDepth){depth=z;$('depth').value=z;updateSelection(false)}};
 $('go').onclick=()=>{const v=$('date').value.trim().replace(' ','T'),t=Date.parse(v+'Z');if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(v)||!Number.isFinite(t)||new Date(t).toISOString().slice(0,v.length)!==v){$('searchNotice').textContent='Enter a valid UTC date and time: YYYY-MM-DD HH:mm[:ss].';return}if(t<Math.floor(d.records[0].t/1000)*1000||t>d.records.at(-1).t){$('searchNotice').textContent=`Available: ${date(d.records[0].t)} to ${date(d.records.at(-1).t)} UTC.`;return}setIndex(nearestTime(t));$('searchNotice').textContent=`Nearest observed profile: ${new Date(d.records[index].t).toISOString()} · ${(Math.abs(d.records[index].t-t)/60e3).toFixed(2)} minutes from requested time. No synthetic profile is created.`};$('date').onkeydown=e=>{if(e.key==='Enter')$('go').click()};
 $('pinProfile').onclick=()=>{pin=index;$('searchNotice').textContent='Pinned reference: '+date(d.records[index].t)+' UTC';window.drawLinked()};$('clearPin').onclick=()=>{pin=null;$('searchNotice').textContent='Reference cleared.';window.drawLinked()};
 for(const id of ['showPrevious','profileAxes','seriesWindow'])$(id).onchange=window.drawLinked;
 for(let k=0;k<4;k++)$('profile'+k).onclick=e=>{const box=boxes['profile'+k],rect=e.target.getBoundingClientRect();if(box)setDepth(viewMin+(e.clientY-rect.top-box.t)/(box.b-box.t)*(viewMax-viewMin))};
 for(const id of ['series0','series1','series2','series3','airPlot']){function timeAt(e){const box=boxes[id],rect=e.target.getBoundingClientRect();return box.a+Math.max(0,Math.min(1,(e.clientX-rect.left-box.l)/(box.r-box.l)))*(box.z-box.a)}$(id).onclick=e=>setIndex(nearestTime(timeAt(e)));$(id).onmousemove=e=>{const i=nearestTime(timeAt(e)),r=d.records[i],v=id==='airPlot'?air[i]:series[Number(id.slice(-1))][i];$('seriesHover').textContent=`${date(r.t)} UTC · nearest observed profile · ${id==='airPlot'?'Daily mean air temperature':vars[Number(id.slice(-1))]+' at '+depth.toFixed(2)+' m'}: ${isnum(v)?v.toFixed(3):'no data'}`};}
})();
