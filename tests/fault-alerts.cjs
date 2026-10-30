const {chromium}=require('playwright');
const fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict');
const server=http.createServer((req,res)=>res.end(fs.readFileSync('demo.html')));
(async()=>{
 await new Promise(resolve=>server.listen(8100,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8100');await page.waitForFunction(()=>online);
 await page.locator('#pickMotor2').click();
 for(const n of [1,2]){assert.equal(await page.locator('#speed'+n).isVisible(),false);assert.equal(await page.locator('#numericSpeed'+n).isVisible(),false);}
 await page.evaluate(async()=>{scenario('hot2');await update();});
 await page.locator('[data-page="alerts"]').click();
 assert.match(await page.locator('#workspaceEventRows').textContent(),/Reason: Motor 2 temperature 37.00 °C reached the critical limit 34 °C/);
 await page.evaluate(async()=>{scenario('healthy');await update();});
 assert.match(await page.locator('#workspaceEventRows').textContent(),/Reason: Motor 2 temperature 37.00 °C/);
 await page.evaluate(async()=>{scenario('sensor');await update();});
 assert.match(await page.locator('#workspaceEventRows').textContent(),/Reason: Motor 1 temperature sensor reading is invalid or unavailable/);
 await page.evaluate(async()=>{scenario('healthy');await update();sim.critical=true;sim.reason='Temperature samples stale';sim.m1=sim.m2='STOP';sim.r1=sim.r2=false;await update();});
 assert.match(await page.locator('#workspaceEventRows').textContent(),/Reason: Safety latch: Temperature samples stale/);
 await page.locator('#workspaceBell').click();
 assert.match(await page.locator('#alertList').textContent(),/Reason: Safety latch: Temperature samples stale/);
 await page.locator('#closeAlerts').click();
 await page.evaluate(async()=>{scenario('healthy');await update();sim.tilt_deg=80;await update();});
 assert.match(await page.locator('#workspaceEventRows').textContent(),/Reason: Shared tilt 80.00° reached the critical limit 75°/);
 await page.evaluate(async()=>{scenario('offline');await update();});
 assert.match(await page.locator('#workspaceEventRows').textContent(),/Reason: Simulated disconnect/);
 assert.deepEqual(errors,[]);
 console.log('PASS hidden PWM controls; temperature, sensor, latch, tilt and connection reasons; historical evidence and notification parity');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
