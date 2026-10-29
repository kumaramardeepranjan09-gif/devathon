"""Exercise actual firmware safety functions on host; not an ESP32 build."""
from pathlib import Path
import subprocess,tempfile
src=Path('SmartPredict_ESP32/SmartPredict_ESP32.ino').read_text()
safety=src[src.index('void criticalShutdown('):src.index('// =============== WEB COMMANDS')]
pre=r'''
#include <string>
#include <cassert>
#include <iostream>
using String=std::string;
unsigned long clockMs=10000,lastGoodTemp=10000;
unsigned long millis(){return clockMs;}
const int HIGH=1,LOW=0,BUZZER_PIN=23;
bool buzzer=false,stopped=false,r1=true,r2=true;
void digitalWrite(int,int v){buzzer=v;}
void stopAll(){stopped=true;}
void driver1(bool b){r1=b;} void driver2(bool b){r2=b;}
void logEvent(String){}
float t1=28,t2=28,vibration=0,rotation=0;
bool t1OK=true,t2OK=true,mpuOK=true,criticalLock=false;
String criticalReason,statusText,warningText;
int warningMotionSamples=0,criticalMotionSamples=0;
const float TEMP_WARNING_C=32,TEMP_CRITICAL_C=36,VIB_WARNING=.25,VIB_CRITICAL=.7,ROT_WARNING=30,ROT_CRITICAL=90;
void clean(){t1=t2=28;vibration=rotation=0;t1OK=t2OK=mpuOK=true;criticalLock=false;criticalReason="";warningMotionSamples=criticalMotionSamples=0;stopped=buzzer=false;r1=r2=true;lastGoodTemp=clockMs;}
'''
tests=r'''
int main(){
clean();evaluateSafety();assert(statusText=="NORMAL");
t1=32;evaluateSafety();assert(statusText=="WARNING" && warningText.find("Motor 1")!=String::npos && !criticalLock);
t1=28;t2=36;evaluateSafety();assert(criticalLock && stopped && !r1 && !r2 && buzzer);assert(criticalReason.find("Motor 2")!=String::npos);
t2=28;evaluateSafety();assert(criticalLock && buzzer);
clean();t1OK=false;evaluateSafety();assert(criticalLock && stopped && criticalReason.find("Motor 1")!=String::npos);
clean();mpuOK=false;evaluateSafety();assert(criticalLock && !r1 && !r2);
clean();vibration=.8;for(int i=0;i<3;i++)evaluateSafety();assert(!criticalLock);evaluateSafety();assert(criticalLock);
clean();rotation=35;for(int i=0;i<3;i++)evaluateSafety();assert(statusText=="WARNING" && !criticalLock);
clean();lastGoodTemp=0;evaluateSafety();assert(criticalLock);
std::cout<<"PASS: actual firmware temperature boundaries, motor attribution, critical stop/latch/buzzer, missing sensors, stale temperatures, motion persistence\n";
}
'''
with tempfile.TemporaryDirectory() as d:
    p=Path(d);(p/'test.cpp').write_text(pre+safety+tests)
    subprocess.run(['g++','-std=c++17','-Wall','-Wextra',str(p/'test.cpp'),'-o',str(p/'test')],check=True)
    subprocess.run([str(p/'test')],check=True)
