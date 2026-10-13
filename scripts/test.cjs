'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const sharp=require('sharp');
const {sample,generate,parse,boardSvg}=require('./generate.cjs');

async function main() {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-portrait-beads-test-'));
  let checks=0;
  const ok=(a,b)=>{assert.deepEqual(a,b);checks++;};
  const n=52, pixels=Buffer.alloc(n*n*4,255), input=path.join(dir,'fixture.png');
  // Opaque white background with a colored enclosure and an occupied white eye.
  for(let y=10;y<42;y++) for(let x=10;x<42;x++) {
    const i=(y*n+x)*4; pixels[i]=50+x;pixels[i+1]=90+y;pixels[i+2]=130;pixels[i+3]=255;
  }
  pixels.set([255,255,255,255],(20*n+20)*4);
  pixels.set([0,0,0,255],(20*n+21)*4);
  await sharp(pixels,{raw:{width:n,height:n,channels:4}}).png().toFile(input);
  const d=await sample(input,{size:n,background:'auto',whiteThreshold:240});
  ok(d.pixelData.length,2704);ok(d.pixelData[0],null);ok(d.pixelData[20*n+20],'#FFFFFF');ok(d.pixelData[20*n+21],'#000000');
  ok(d.colors.length,1024);ok(d.maxColors,null);ok(d.backgroundMode,'white');
  ok(d.pixelData[12*n+15],'#416682');
  const rgbInput=path.join(dir,'rgb.png');
  await sharp(input).removeAlpha().png().toFile(rgbInput);
  const rgbSample=await sample(rgbInput,{size:n,background:'auto',whiteThreshold:240});
  ok(rgbSample.backgroundMode,'white');ok(rgbSample.pixelData,d.pixelData);
  const result=await generate({input,out:path.join(dir,'result'),size:n,background:'auto',whiteThreshold:240,title:'猫咪 & <test>',fullLegend:true});
  ok(result.beads,1024);ok(result.colors,1024);ok(result.outputs.legends.length,7);
  const json=JSON.parse(fs.readFileSync(result.outputs.data,'utf8'));
  ok(json.source,'fixture.png');ok(json.pixelData,d.pixelData);
  const csv=fs.readFileSync(result.outputs.csv,'utf8').trim().split('\n').slice(1);
  ok(csv.length,1024);ok(csv.reduce((a,l)=>a+Number(l.split(',')[5]),0),1024);
  ok(csv[0].split(',')[0],json.colors[0].code);
  const m=await sharp(result.outputs.import).metadata();ok([m.width,m.height],[52,52]);
  const data=await sharp(result.outputs.import).removeAlpha().raw().toBuffer();
  ok([...data.subarray((12*n+15)*3,(12*n+15)*3+3)],[65,102,130]);
  assert(boardSvg(d,'cat & <test>').includes('cat &amp; &lt;test&gt;'));checks++;
  await assert.rejects(()=>generate({input,out:path.join(dir,'result'),size:n,background:'auto',whiteThreshold:240,title:'cat'}),/Refusing to overwrite/);checks++;
  // Alpha mode retains opaque white even on the canvas boundary.
  const rgba=Buffer.alloc(n*n*4);rgba.set([255,255,255,255],0);rgba.set([14,26,39,255],(25*n+25)*4);
  const alphaInput=path.join(dir,'alpha.png');
  await sharp(rgba,{raw:{width:n,height:n,channels:4}}).png().toFile(alphaInput);
  const a=await sample(alphaInput,{size:n,background:'auto',whiteThreshold:240});
  ok(a.backgroundMode,'alpha');ok(a.pixelData[0],'#FFFFFF');ok(a.pixelData[1],null);ok(a.pixelData[25*n+25],'#0E1A27');
  const none=await sample(input,{size:n,background:'none',whiteThreshold:240});ok(none.pixelData[0],'#FFFFFF');
  // Non-square opaque image: padding remains empty rather than white beads.
  const narrow=path.join(dir,'narrow.png');
  await sharp({create:{width:26,height:52,channels:3,background:'#123456'}}).png().toFile(narrow);
  const fit=await sample(narrow,{size:n,background:'none',whiteThreshold:240});
  ok(fit.pixelData.filter(c=>c!==null).length,26*52);ok(fit.colors.length,1);
  assert.throws(()=>parse([input,'--out','p','--size','0']));checks++;
  assert.throws(()=>parse([input,'--out','p','--background','bad']));checks++;
  assert.throws(()=>parse([input,'--out','p','--size']));checks++;
  console.log(JSON.stringify({passed:true,checks,temporaryArtifacts:dir},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
