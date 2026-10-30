const {chromium}=require('playwright');
const fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict');
let d={tilt_deg:0,tilt_warning:45,tilt_critical:75,imu_calibrated:true,pwm_warning:204,pwm_critical:242,movement_detected:true,sequence:1,uptime:10000,t1:28,t2:29,t1OK:true,t2OK:true,mpuOK:true,vib:.01,rot:1,ax:0,ay:0,az:1,sp1:150,sp2:100,m1:'FORWARD',m2:'STOP',r1:true,r2:false,critical:false,reason:'',warning:'Normal',tempWarning:31,tempCritical:34,vibWarning:.25,vibCritical:.7,rotWarning:30,rotCritical:90};let offline=false,frozen=false,commands=[];

let applyCommands=true;
const server=http.createServer((req,res)=>{
 if(req.url==='/api'){d.sequence++;d.uptime+=1000;res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(d));}
 if(req.url==='/cmd'){assert.equal(req.method,'POST');let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{const args=new URLSearchParams(body),c=args.get('c');commands.push(c);if(applyCommands){if(c==='M2F'){d.r2=true;d.m2='FORWARD';}if(c==='M2R'){d.r2=true;d.m2='REVERSE';}if(c==='M2S'){d.r2=false;d.m2='STOP';}}res.end('OK');});return;}
 if(req.url.startsWith('/three-part')){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type','text/html');res.end(fs.readFileSync('web/hardware.html'));
});
(async()=>{
 await new Promise(resolve=>server.listen(8099,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:8099');await page.waitForFunction(()=>online);
 await page.locator('#pickMotor2').click();
 for(const [c,direction] of [['M2F','FORWARD'],['M2R','REVERSE'],['M2S','STOP']]){
 await page.locator('[data-command="'+c+'"]').click();await page.waitForFunction(()=>!busy);
 assert.equal(commands.at(-1),c);assert.equal(d.m2,direction);assert.equal(d.m1,'FORWARD');
 }
 applyCommands=false;await page.locator('[data-command="M2F"]').click();await page.waitForFunction(()=>!busy);
 assert.match(await page.locator('#message').textContent(),/start not confirmed by ESP32/);
 assert.equal(await page.evaluate(()=>views[1].running),false);
 d.sp2=0;await page.evaluate(()=>update());const count=commands.length;
 await page.locator('[data-command="M2F"]').click();assert.match(await page.locator('#message').textContent(),/PWM is 0/);assert.equal(commands.length,count);
 console.log('PASS live hardware dashboard Motor 2 POST routing, independent output, unconfirmed-start error, zero-PWM start prevention');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
