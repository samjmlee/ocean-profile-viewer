const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.VIEWER_URL||'http://127.0.0.1:8767/');await page.click('#demo');
  let frame=()=>page.frames().find(f=>f.url().includes('/views/'));
  await page.waitForFunction(()=>document.querySelector('iframe')?.contentWindow.explorerReady);
  assert.match(await page.locator('#summary').innerText(),/SYNTHETIC/);
  await frame().click('#next');await page.waitForFunction(()=>viewerState().time===1704088800000);
  await frame().click('#pauseOnly');await frame().click('#autoPressure');
  await frame().waitForFunction(()=>explorerState.pressureAuto&&explorerState.pHigh-explorerState.pLow<.1);
  await page.click('#view3d');await page.waitForFunction(()=>document.querySelector('iframe')?.contentWindow.top3dReady,null,{timeout:60000});
  assert.equal(await frame().evaluate(()=>top3dState.time),1704088800000);
  assert.ok(await frame().evaluate(()=>top3dState.triangles>0));
  await frame().click('#next');const time=await frame().evaluate(()=>top3dState.time);
  await page.click('#view2d');await page.waitForFunction(()=>document.querySelector('iframe')?.contentWindow.explorerReady);
  assert.equal(await frame().evaluate(()=>explorerState.time),time);
  await page.locator('#phase').selectOption('pause');await page.waitForFunction(()=>document.querySelector('iframe')?.contentWindow.explorerState?.phases.join()==='pause');
  await page.locator('#files').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"schema":"wrong"}')});await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('Expected ocean-profile'));assert.match(await page.locator('#notice').innerText(),/Expected ocean-profile/);
  if(process.env.TEST_IMPORT){await page.locator('#files').setInputFiles(process.env.TEST_IMPORT);await page.waitForFunction(()=>viewerState().count===2);await page.waitForFunction(()=>document.querySelector('iframe')?.contentWindow.explorerReady);await page.click('#view3d');await page.waitForFunction(()=>document.querySelector('iframe')?.contentWindow.top3dReady,null,{timeout:60000})}
  fs.mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/workspace.png'});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);console.log('PASS: local import, validation, native phase fit, synchronized 2D/3D time, 3D mesh, mobile width');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
