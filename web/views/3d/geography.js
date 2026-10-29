'use strict';
// Approximate cartographic label anchors; not boundaries or reverse-geocoding.
const placeSource='https://www.naturalearthdata.com/downloads/10m-physical-vectors/';
const basinSource='https://pubs.usgs.gov/of/2014/1040/data/undersea_features.html';
const places=[
 ['Arctic Ocean','Ocean',88,0],['North Atlantic Ocean','Ocean',50,-35],['North Pacific Ocean','Ocean',40,-160],
 ['Beaufort Sea','Sea',72,-138],['Chukchi Sea','Sea',69,-170],['East Siberian Sea','Sea',73,158],['Laptev Sea','Sea',75,125],['Kara Sea','Sea',75,75],['Barents Sea','Sea',73,35],['Greenland Sea','Sea',76,-5],['Norwegian Sea','Sea',67,0],['Baffin Bay','Sea',73,-65],
 ['Canada Basin','Basin',78,-140,basinSource],['Makarov Basin','Basin',86,170,basinSource],['Amundsen Basin','Basin',87,60,basinSource],['Nansen Basin','Basin',83,45,basinSource],
 ['North America','Continent',57,-108],['Europe','Continent',56,20],['Asia','Continent',59,100],['Greenland','Island',73,-42]
];
let referenceLabels=[],showPlaces=true;
function clearReferenceLabels(){referenceLabels=[];$('maplabels').replaceChildren();$('axislabels').replaceChildren();$('geography').hidden=mode==='local';}
function referenceLabel(text,p,place=null){
 const el=document.createElement(place?'button':'span');el.textContent=text;
 if(place){el.type='button';el.title=place[0]+' · '+place[1];el.onclick=()=>{const info=$('placeInfo');info.replaceChildren();const a=document.createElement('a');a.href=place[4]||placeSource;a.target='_blank';a.rel='noopener';a.textContent=place[4]?'USGS geographic reference':'Natural Earth geographic reference';info.append(`${place[0]} · ${place[1]} · approximate label anchor ${place[2]}°, ${place[3]}°. `,a,'. This identifies the label, not the containing region of an observation.');};}
 $(place?'maplabels':'axislabels').append(el);referenceLabels.push({el,p,place});
}
function buildGeographicLabels(){for(const place of places)referenceLabel('• '+place[0],sphere(place[2],place[3],100.3),place);$('coordinateInfo').textContent='Globe coordinates: WGS84 latitude / longitude. Geographic labels are selected high-level regions; no Google Earth imagery or service is used.';}
function buildAxes(){
 const box=new THREE.Box3();for(const r of d.records){box.expandByPoint(position(r,viewMin));box.expandByPoint(position(r,viewMax));}
 const pad=Math.max(2,box.getSize(new THREE.Vector3()).length()*.055);box.min.x-=pad;box.max.x+=pad;box.min.z-=pad;box.max.z+=pad;
 const a=box.min,b=box.max,V=(x,y,z)=>new THREE.Vector3(x,y,z);
 for(const x of [a.x,b.x])for(const z of [a.z,b.z])world.add(line([V(x,a.y,z),V(x,b.y,z)],0xa1b7c3));
 for(const y of [a.y,b.y]){for(const z of [a.z,b.z])world.add(line([V(a.x,y,z),V(b.x,y,z)],0xa1b7c3));for(const x of [a.x,b.x])world.add(line([V(x,y,a.z),V(x,y,b.z)],0xa1b7c3));}
 for(let i=0;i<=4;i++){const f=i/4,x=a.x+(b.x-a.x)*f,z=a.z+(b.z-a.z)*f,y=a.y+(b.y-a.y)*f;
 world.add(line([V(x,a.y,a.z),V(x,a.y,b.z)],0xdce5e9));world.add(line([V(a.x,a.y,z),V(b.x,a.y,z)],0xdce5e9));
 referenceLabel((x/localScale).toFixed(1),V(x,b.y,b.z));referenceLabel((-z/localScale).toFixed(1),V(a.x,b.y,z));referenceLabel((-y/localScale/ex*1000).toFixed(1),V(a.x,y,b.z));}
 referenceLabel('X · East (km)',V((a.x+b.x)/2,b.y,b.z+pad*2));referenceLabel('Y · North (km)',V(a.x-pad*2,b.y,(a.z+b.z)/2));referenceLabel('Z · Depth (m, positive down)',V(a.x-pad*2,a.y-pad,b.z));
 $('coordinateInfo').textContent=`XYZ: X = eastward distance (km), Y = northward distance (km) from ${centerLat.toFixed(3)}°, ${centerLon.toFixed(3)}°; Z = TEOS-10 depth (m), positive downward. Local equirectangular approximation, not a geodesic distance; distortion increases across large tracks and near the pole. Vertical exaggeration ${Math.round(ex)}×. Tick labels show physical units.`;
}
function updateReferenceLabels(){
 const w=$('scene').clientWidth,h=$('scene').clientHeight,occupied=[];
 for(const {el,p,place} of referenceLabels){const q=p.clone().project(camera);let visible=q.z>-1&&q.z<1&&Math.abs(q.x)<.97&&Math.abs(q.y)<.95;
 if(place)visible=visible&&showPlaces&&($('placeCategory').value==='all'||$('placeCategory').value===place[1])&&p.dot(camera.position.clone().sub(p))>0;
 const x=(q.x+1)*w/2,y=(1-q.y)*h/2;
 if(place&&visible){const width=el.offsetWidth||130;const rect={x:x-width/2,y:y-12,w:width,h:24};if(occupied.some(r=>rect.x<r.x+r.w&&rect.x+rect.w>r.x&&rect.y<r.y+r.h&&rect.y+rect.h>r.y))visible=false;else occupied.push(rect);}
 el.style.display=visible?'block':'none';el.style.left=x+'px';el.style.top=y+'px';
 }
}
