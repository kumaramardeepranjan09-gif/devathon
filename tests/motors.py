"""Exercise the actual firmware motor output functions with captured GPIO/PWM writes."""
from pathlib import Path
import subprocess
import tempfile
source = Path('web/firmware.template.txt').read_text()
functions = source[source.index('void driver1(bool'):source.index('// =============== MPU6050 REGISTERS')]
prelude = r'''
#include <cassert>
#include <map>
#include <string>
#include <iostream>
using String = std::string;
constexpr int ENA=25, IN1=26, IN2=27, ENB=14, IN3=18, IN4=19, LOW=0, HIGH=1;
std::map<int,int> gpio, pwm;
bool driver1State=false,driver2State=false;
String motor1State="STOP",motor2State="STOP";
int speed1=150,speed2=175,deadTime=0;
void digitalWrite(int pin,int value){gpio[pin]=value;}
void ledcWrite(int pin,int value){pwm[pin]=value;}
void delay(int ms){assert(pwm[ENA]==0 || pwm[ENB]==0);deadTime+=ms;}
'''
cases = r'''
int main(){
stopAll();m1Forward();m2Forward();
assert(driver1State&&driver2State&&pwm[ENA]==150&&pwm[ENB]==175);
assert(gpio[IN1]==HIGH&&gpio[IN2]==LOW&&gpio[IN3]==HIGH&&gpio[IN4]==LOW);
m2Reverse();assert(deadTime==300&&gpio[IN3]==LOW&&gpio[IN4]==HIGH&&pwm[ENB]==175);
assert(motor1State=="FORWARD"&&pwm[ENA]==150);
stopM2();assert(!driver2State&&motor2State=="STOP"&&pwm[ENB]==0&&gpio[IN3]==LOW&&gpio[IN4]==LOW);
assert(driver1State&&motor1State=="FORWARD"&&pwm[ENA]==150);
speed2=0;m2Forward();assert(pwm[ENB]==0);
speed2=150;m2Forward();assert(driver2State&&pwm[ENB]==150);
stopAll();assert(!driver1State&&!driver2State&&pwm[ENA]==0&&pwm[ENB]==0);
std::cout<<"PASS: independent Motor 2 GPIO/PWM, reversal dead time, stop isolation, zero-PWM recovery, ALL STOP\n";
}
'''
with tempfile.TemporaryDirectory() as directory:
    path = Path(directory)
    (path/'motors.cpp').write_text(prelude+functions+cases)
    subprocess.run(['g++','-std=c++17','-Wall','-Wextra',str(path/'motors.cpp'),'-o',str(path/'test')],check=True)
    subprocess.run([str(path/'test')],check=True)
