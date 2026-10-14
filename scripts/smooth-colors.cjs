'use strict';
// Shared by the CLI and Izzie豆作. No fixed palette-size cap and no dithering.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.smoothBeadColors=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const rgb=h=>h.slice(1).match(/../g).map(v=>parseInt(v,16));
 const hex=v=>'#'+v.map(x=>Math.round(Math.max(0,Math.min(255,x))).toString(16).padStart(2,'0')).join('');
 function lab(v){const [r,g,b]=v.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});const f=t=>t>.008856?Math.cbrt(t):7.787*t+16/116;const x=f((.4124564*r+.3575761*g+.1804375*b)/.95047),y=f(.2126729*r+.7151522*g+.072175*b),z=f((.0193339*r+.119192*g+.9503041*b)/1.08883);return [116*y-16,500*(x-y),200*(y-z)];}
 const distance=(a,b)=>a.reduce((s,v,i)=>s+(v-b[i])**2,0);
 return function smoothBeadColors(input,w,h,{tolerance=10}={}){
  if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||input.length!==w*h)throw Error('Invalid bead grid');
  if(!Number.isFinite(tolerance)||tolerance<=0||tolerance>30)throw Error('Invalid color tolerance');
  if(input.some(c=>c!==null&&!/^#[0-9a-f]{6}$/i.test(c)))throw Error('Invalid color');
  const values=input.map(c=>c===null?null:rgb(c)),labs=values.map(c=>c===null?null:lab(c));
  const adjacent=i=>[i%w?i-1:-1,i%w<w-1?i+1:-1,i>=w?i-w:-1,i<w*(h-1)?i+w:-1].filter(j=>j>=0);
  // Protect very dark facial marks, bright catchlights and thin high-contrast detail.
  const protect=labs.map((c,i)=>c!==null&&(c[0]<25||c[0]>93||adjacent(i).some(j=>labs[j]!==null&&distance(c,labs[j])>900)));
  const softened=values.map((v,i)=>{
   if(v===null||protect[i])return v;const sum=v.slice();let weight=1;const x=i%w,y=Math.floor(i/w);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    if(!(dx||dy)||x+dx<0||x+dx>=w||y+dy<0||y+dy>=h)continue;
    const j=i+dy*w+dx;if(values[j]===null||protect[j])continue;
    const d=distance(labs[i],labs[j]);if(d>225)continue;
    const z=Math.exp(-d/128)*(dx&&dy?.65:1);weight+=z;for(let a=0;a<3;a++)sum[a]+=z*values[j][a];
   }return sum.map(v=>v/weight);
  });
  const frequencies=new Map();softened.forEach(c=>{if(c!==null){const k=hex(c);frequencies.set(k,(frequencies.get(k)||0)+1);}});
  const points=[...frequencies].map(([color,count])=>({color,count,rgb:rgb(color),lab:lab(rgb(color))})).sort((a,b)=>b.count-a.count||a.color.localeCompare(b.color));
  if(!points.length)return input.slice();
  const centers=[points[0].lab],minDistances=points.map(p=>distance(p.lab,centers[0]));
  // Cover distinct color regions within perceptual tolerance; color count follows content.
  while(true){let best=0;for(let i=1;i<points.length;i++)if(minDistances[i]>minDistances[best])best=i;
   if(minDistances[best]<=tolerance*tolerance)break;
   const c=points[best].lab;centers.push(c);for(let i=0;i<points.length;i++)minDistances[i]=Math.min(minDistances[i],distance(points[i].lab,c));
  }
  const nearest=l=>{let best=0,d=Infinity;centers.forEach((c,i)=>{const z=distance(l,c);if(z<d){d=z;best=i;}});return best;};
  const groups=centers.map(()=>[]);points.forEach(p=>groups[nearest(p.lab)].push(p));
  // Use sampled colors as representatives, so a low-color source remains unchanged.
  const palette=groups.map((g,i)=>{const n=g.reduce((s,p)=>s+p.count,0);const mean=[0,1,2].map(a=>g.reduce((s,p)=>s+p.lab[a]*p.count,0)/n);return g.reduce((a,b)=>distance(a.lab,mean)<distance(b.lab,mean)?a:b).color;});
  const mapping=new Map(points.map(p=>[p.color,palette[nearest(p.lab)]]));
  const pixels=softened.map(v=>v===null?null:mapping.get(hex(v)));
  const old=pixels.slice(),seen=new Set();
  for(let i=0;i<old.length;i++){
   if(old[i]===null||seen.has(i))continue;const group=[i];seen.add(i);
   for(let p=0;p<group.length;p++)for(const j of adjacent(group[p]))if(!seen.has(j)&&old[j]===old[i]){seen.add(j);group.push(j);}
   if(group.length>2||group.some(j=>protect[j]))continue;
   const counts=new Map();group.forEach(j=>adjacent(j).forEach(k=>{if(old[k]!==null&&old[k]!==old[i])counts.set(old[k],(counts.get(old[k])||0)+1);}));
   const eligible=[...counts].filter(([c])=>distance(lab(rgb(c)),lab(rgb(old[i])))<100).sort((a,b)=>b[1]-a[1]);
   if(eligible.length)group.forEach(j=>pixels[j]=eligible[0][0]);
  }
  return pixels;
 };
});
