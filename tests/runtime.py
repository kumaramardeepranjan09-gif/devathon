from pathlib import Path
import subprocess,tempfile
s=Path('web/firmware.template.txt').read_text();body=s[s.index('void accountRuntime()'):s.index('void maintainWiFi()')]
pre='''#include <cstdint>
#include <string>
#include <cassert>
#include <iostream>
unsigned long nowMs=0; unsigned long millis(){return nowMs;}
unsigned long runtimeTick=0,runtimeSaved=0;uint64_t runtimeMs1=0,runtimeMs2=0;bool driver1State=true,driver2State=false,runtimePersistent=true;int speed1=150,speed2=150;std::string motor1State="FORWARD",motor2State="STOP";
struct Store{int writes=0;bool fail=false;size_t putULong64(const char*,uint64_t){writes++;return fail?0:8;}} runtimeStore;
'''
main='''int main(){nowMs=1000;accountRuntime();assert(runtimeMs1==1000&&runtimeMs2==0);driver2State=true;motor2State="REVERSE";speed1=0;nowMs=2000;accountRuntime();assert(runtimeMs1==1000&&runtimeMs2==1000);driver2State=false;nowMs=60000;accountRuntime();assert(runtimeMs2==1000&&runtimeStore.writes==2);runtimeStore.fail=true;nowMs=120000;accountRuntime();assert(!runtimePersistent);std::cout<<"PASS: independent commanded runtime, stopped/PWM-zero exclusion, periodic checkpoint and persistence failure\\n";}'''
with tempfile.TemporaryDirectory() as d:
 p=Path(d);(p/'runtime.cpp').write_text(pre+body+main);subprocess.run(['g++','-std=c++17',str(p/'runtime.cpp'),'-o',str(p/'test')],check=True);subprocess.run([str(p/'test')],check=True)
