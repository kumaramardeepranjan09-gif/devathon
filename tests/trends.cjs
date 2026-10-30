const {chromium}=require('playwright'),fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict');
const server=http.createServer((q,r)=>r.end(fs.readFileSync('demo.html')));
(async()=>{
 await new Promise(r=>server.listen(8101,'127.0.0.1',r));const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const p=await b.newPage({viewport:{width:1440,height:1100}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:8101');await p.waitForFunction(()=>online);
 await p.evaluate(()=>{const now=Date.now();history=Array.from({length:300},(_,i)=>({...data,time:new Date(now-(299-i)*1000).toISOString(),t1:27+Math.sin(i/30)*1.5,t2:29+Math.cos(i/35)*1.2,vib:.02+Math.abs(Math.sin(i/25))*.06,tilt_deg:8+Math.sin(i/25)*3,t1OK:!(i>120&&i<140)}));drawTrends();});
 await p.screenshot({path:'/tmp/trends-overview.png',fullPage:true});
 await p.locator('[data-page="trends"]').click();await p.waitForTimeout(400);
 assert.equal(await p.locator('#temperatureTrend').evaluate(e=>e._trend.unit),'°C');assert.equal(await p.locator('#rotationTrend').evaluate(e=>e._trend.unit),'°');
 assert.ok(await p.locator('#temperatureTrend').evaluate(e=>e.width>=e.clientWidth));
 await p.locator('#temperatureTrend').focus();await p.keyboard.press('Home');assert.match(await p.locator('#temperatureTrend + .chart-tip').textContent(),/Motor 1:.*°C/);
 await p.keyboard.press('End');await p.keyboard.press('ArrowLeft');assert.ok(await p.locator('#temperatureTrend').evaluate(e=>e._sampleIndex<e._trend.rows.length-1));await p.keyboard.press('Escape');
 await p.locator('#range').selectOption('60');assert.ok(await p.locator('#temperatureTrend').evaluate(e=>e._trend.rows.length<=61));
 await p.locator('#range').selectOption('0');await p.screenshot({path:'/tmp/trends-desktop.png',fullPage:true});
 assert.equal(await p.evaluate(()=>{history=[];drawTrends();return $('temperatureTrend')._trend.validCount;}),0);
 assert.equal(await p.evaluate(()=>{history=[{...data,time:new Date().toISOString(),t1OK:false,t2OK:false}];drawTrends();return $('temperatureTrend')._trend.validCount;}),0);
 await p.evaluate(()=>{history=[{...data,time:new Date().toISOString(),t1:-12,t2:-8}];drawTrends();});assert.ok(await p.locator('#temperatureTrend').evaluate(e=>e._trend.lo<-12));
 await p.setViewportSize({width:390,height:844});await p.waitForTimeout(400);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:'/tmp/trends-mobile.png',fullPage:true});
 await p.evaluate(async()=>{scenario('offline');await update();});assert.match(await p.locator('#trendReadings').textContent(),/Offline/);
 assert.deepEqual(errors,[]);console.log('PASS plot units, high-DPI rendering, keyboard samples, time range, empty/invalid/negative values, mobile width and offline state');
 }finally{await b.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
