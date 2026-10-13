#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const escapeXml = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const toHex = p => '#' + p.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
const toRgb = h => h.slice(1).match(/../g).map(v => parseInt(v, 16));

function parse(args) {
  const opts = { size: 52, title: '宠物头像 · 手绘复杂版', background: 'auto', whiteThreshold: 240, fullLegend: false };
  const names = { '--size':'size', '--out':'out', '--title':'title', '--background':'background', '--white-threshold':'whiteThreshold' };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--full-legend') opts.fullLegend = true;
    else if (names[a]) {
      if (args[i + 1] === undefined || args[i + 1].startsWith('--')) throw Error('Missing value: ' + a);
      opts[names[a]] = args[++i];
    } else if (!a.startsWith('-') && !opts.input) opts.input = a;
    else throw Error('Unknown argument: ' + a);
  }
  opts.size = Number(opts.size); opts.whiteThreshold = Number(opts.whiteThreshold);
  if (!opts.input || !opts.out) throw Error('Usage: node scripts/generate.cjs INPUT --out PREFIX [--size 52] [--background auto|white|alpha|none] [--full-legend]');
  if (!Number.isInteger(opts.size) || opts.size < 4 || opts.size > 150) throw Error('size must be an integer 4–150');
  if (!Number.isInteger(opts.whiteThreshold) || opts.whiteThreshold < 0 || opts.whiteThreshold > 255) throw Error('white threshold must be an integer 0–255');
  if (!['auto','white','alpha','none'].includes(opts.background)) throw Error('Invalid background mode');
  return opts;
}

async function sample(input, {size:n, background='auto', whiteThreshold=240}) {
  const metadata = await sharp(input).metadata();
  let transparent = false;
  if (background === 'auto' && metadata.hasAlpha) {
    const original = await sharp(input).toColourspace('srgb').ensureAlpha().raw().toBuffer();
    for(let i=3;i<original.length;i+=4) if(original[i]<255) {transparent=true;break;}
  }
  const mode = background === 'auto' ? (transparent ? 'alpha' : 'white') : background;
  const {data} = await sharp(input).toColourspace('srgb').ensureAlpha()
    .resize(n, n, { fit:'contain', kernel:'nearest', background:{r:255,g:255,b:255,alpha:0} })
    .raw().toBuffer({resolveWithObject:true});
  const cells = Array.from({length:n*n}, (_, i) => Array.from(data.subarray(i*4, i*4+4)));
  const blanks = new Set(cells.map((p,i) => p[3] < 128 ? i : -1).filter(i => i >= 0));
  if (mode === 'white') {
    const nearWhite = i => cells[i][3] < 128 || Math.min(...cells[i].slice(0,3)) >= whiteThreshold;
    const queue = []; const reached = new Set();
    for (let i=0; i<n*n; i++) if ((i<n || i>=n*(n-1) || i%n===0 || i%n===n-1) && nearWhite(i)) {queue.push(i); reached.add(i);}
    for (let p=0; p<queue.length; p++) {
      const i=queue[p];
      const ns=[i%n>0?i-1:-1, i%n<n-1?i+1:-1, i>=n?i-n:-1, i<n*(n-1)?i+n:-1];
      for (const j of ns) if(j>=0 && !reached.has(j) && nearWhite(j)) {queue.push(j); reached.add(j);}
    }
    for (const i of reached) blanks.add(i);
  }
  const pixelData = cells.map((p,i) => blanks.has(i) ? null : toHex(p.slice(0,3)));
  const counts = new Map();
  for (const c of pixelData) if(c !== null) counts.set(c, (counts.get(c)||0)+1);
  const colors = [...counts].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0]))
    .map(([hex,count],i)=>({code:String(i+1),hex,rgb:toRgb(hex),count}));
  return {gridSize:n,colorSystem:'FREE_RGB',source:path.basename(input),sampling:'nearest',
    maxColors:null,background:null,backgroundMode:mode,alphaThreshold:128,whiteThreshold,pixelData,colors};
}

function boardSvg(d, title) {
  const n=d.gridSize, cell=30, margin=96, gy=145, gw=n*cell, width=gw+margin*2, height=gy+gw+150;
  const codes=new Map(d.colors.map(c=>[c.hex,c.code])), beads=d.colors.reduce((a,c)=>a+c.count,0);
  const s=[`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    '<rect width="100%" height="100%" fill="white"/>',
    `<rect width="${width}" height="92" fill="#202638"/>`,
    `<g font-family="PingFang SC, Noto Sans CJK SC, Arial, sans-serif"><text x="35" y="40" fill="white" font-size="24" font-weight="bold">${escapeXml(title)}</text>`,
    `<text x="35" y="71" fill="#BFDDCE" font-size="18">${n}×${n} · FREE RGB · ${d.colors.length} 色 · ${beads} 颗</text>`];
  for(let i=0;i<d.pixelData.length;i++) {
    const c=d.pixelData[i],x=margin+i%n*cell,y=gy+Math.floor(i/n)*cell;
    s.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${c||'#FFFFFF'}"/>`);
    if(c!==null) {
      const [r,g,b]=toRgb(c), fg=.299*r+.587*g+.114*b>148?'#161616':'#FFFFFF';
      const label=codes.get(c), font=label.length>3?8:10;
      s.push(`<text x="${x+15}" y="${y+19}" text-anchor="middle" font-size="${font}" font-weight="bold" fill="${fg}">${label}</text>`);
    }
  }
  for(let i=0;i<=n;i++) {
    const bold=i%5===0||i===n,stroke=bold?'#555555':'#D2D2D2';
    s.push(`<path d="M${margin+i*cell},${gy}v${gw} M${margin},${gy+i*cell}h${gw}" fill="none" stroke="${stroke}" stroke-width="${bold?1.5:.45}"/>`);
    if(i<n) {
      const x=margin+(i+.5)*cell, y=gy+(i+.5)*cell+4;
      s.push(`<g font-size="12" text-anchor="middle" fill="#333333"><text x="${x}" y="${gy-14}">${i+1}</text><text x="${x}" y="${gy+gw+25}">${i+1}</text><text x="${margin-24}" y="${y}">${i+1}</text><text x="${margin+gw+24}" y="${y}">${i+1}</text></g>`);
    }
  }
  s.push(`<g fill="#333333"><text x="35" y="${gy+gw+75}" font-size="20" font-weight="bold">${d.colors.length} 个自由 RGB 色值 · ${beads} 颗 · 每 5 格加重线</text>`,
    `<text x="35" y="${gy+gw+108}" font-size="16">数字是自定义颜色索引，非品牌豆色号；完整 HEX／RGB 与用量见配套 CSV。</text></g></g></svg>`);
  return s.join('');
}

function legendSvg(colors, page, pages) {
  const cols=4,cw=360,rh=42,width=1500,height=110+Math.ceil(colors.length/cols)*rh;
  const s=[`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="white"/>`,
    '<g font-family="PingFang SC, Noto Sans CJK SC, Arial, sans-serif" fill="#222222">',
    `<text x="30" y="40" font-size="24">自由 RGB 颜色图例 · ${page}/${pages}</text><text x="30" y="72" font-size="16">自定义编号 / HEX / 数量；不是品牌豆色号。</text>`];
  colors.forEach((c,i)=>{const x=30+i%cols*cw,y=96+Math.floor(i/cols)*rh;
    s.push(`<rect x="${x}" y="${y}" width="28" height="28" fill="${c.hex}" stroke="#AAAAAA"/><text x="${x+40}" y="${y+20}" font-size="17">${c.code} · ${c.hex} · ${c.count} 颗</text>`);
  });
  return s.join('')+'</g></svg>';
}

async function generate(o) {
  const d=await sample(o.input,o),prefix=path.resolve(o.out),n=d.gridSize;
  const names={data:prefix+'_像素数据.json',csv:prefix+'_编号颜色用量表.csv',import:prefix+`_${n}x${n}导入.png`,preview:prefix+'_像素预览.png',chart:prefix+'_施工图.png'};
  const pages=o.fullLegend?Math.ceil(d.colors.length/160):0;
  const legendFiles=Array.from({length:pages},(_,i)=>prefix+`_颜色图例_页${String(i+1).padStart(3,'0')}.png`);
  for(const f of [...Object.values(names),...legendFiles]) if(fs.existsSync(f)) throw Error('Refusing to overwrite: '+f);
  fs.mkdirSync(path.dirname(prefix),{recursive:true});
  const colors=d.colors,beads=colors.reduce((a,c)=>a+c.count,0);
  if(beads!==d.pixelData.filter(c=>c!==null).length || colors.length!==new Set(d.pixelData.filter(c=>c!==null)).size) throw Error('Color invariant failed');
  fs.writeFileSync(names.data,JSON.stringify(d,null,2),{flag:'wx'});
  fs.writeFileSync(names.csv,'\uFEFF格内编号,HEX,R,G,B,数量(颗)\n'+colors.map(c=>[c.code,c.hex,...c.rgb,c.count].join(',')).join('\n')+'\n',{flag:'wx'});
  const raw=Buffer.from(d.pixelData.flatMap(c=>toRgb(c||'#FFFFFF'))), spec={raw:{width:n,height:n,channels:3}};
  await sharp(raw,spec).png().toFile(names.import);
  await sharp(raw,spec).resize(n*20,n*20,{kernel:'nearest'}).png().toFile(names.preview);
  await sharp(Buffer.from(boardSvg(d,o.title))).png().toFile(names.chart);
  for(let i=0;i<pages;i++) await sharp(Buffer.from(legendSvg(colors.slice(i*160,(i+1)*160),i+1,pages))).png().toFile(legendFiles[i]);
  return {grid:`${n}x${n}`,colors:colors.length,beads,colorSystem:'FREE_RGB',maxColors:null,backgroundMode:d.backgroundMode,outputs:{...names,legends:legendFiles}};
}

module.exports={parse,sample,generate,boardSvg,legendSvg};
if(require.main===module) generate(parse(process.argv.slice(2))).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});
