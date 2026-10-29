# SmartPredict — two motors, no relay

[Download demo.html](demo.html) for a self-contained demo. For real hardware upload **[SmartPredict_ESP32.ino](SmartPredict_ESP32/SmartPredict_ESP32.ino)**. Both use the same monitoring UI, motor models, independent controls, reports, alerts and charts. Demo scenarios and data are clearly simulated; demo never controls hardware.

## Upload and connect

1. Arduino IDE 2.x: install **esp32 by Espressif Systems 3.3.0**, **OneWire 2.3.8**, **DallasTemperature 4.0.5**. Board package URL: `https://espressif.github.io/arduino-esp32/package_esp32_index.json`.
2. Open the sketch inside its `SmartPredict_ESP32` folder. Select **ESP32 Dev Module** (classic WROOM) and correct USB port.
3. SSID `09` is configured. Set `WIFI_PASSWORD` locally; public GitHub code contains a placeholder. Never commit Wi-Fi passwords.
4. With motor power disconnected, Verify and Upload. Keep IMU still while its baseline is acquired.
5. Serial Monitor **115200 baud** prints `Dashboard IP: http://...` after joining your 2.4 GHz router/hotspot. Open that exact address on the same Wi-Fi. The IP may change after DHCP/reconnect. This firmware does not create its own access point.
6. Open `/api` at that address to check changing `sequence`, valid temperature/IMU flags and `imu_calibrated:true`. Check each sensor before powering motors. Motor start is manual.
7. If updating from an older version use Ctrl+Shift+R once. No public Internet is needed. Keep hotspot/client isolation off. Do not port-forward the device: controls are for a trusted LAN.

## Hardware wiring

| Item | ESP32 GPIO |
|---|---|
| Motor 1 DS18B20 DATA | 16 |
| Motor 2 DS18B20 DATA | 17 |
| Shared IMU SDA / SCL | 21 / 22 |
| L298N ENA / IN1 / IN2 | 25 / 26 / 27 |
| L298N ENB / IN3 / IN4 | 14 / 18 / 19 |
| Active buzzer control | 23 |
| Former relay pins | 32 / 33 unused |

No relay is used. Motor 1 connects to OUT1/OUT2; Motor 2 to OUT3/OUT4. Remove ENA/ENB jumpers before wiring PWM. PWM uses 1 kHz, 8-bit ESP32 core 3.x LEDC. Supply the driver from a fused supply rated for motor voltage and stall current. Use common logic grounds, an accessible physical cutoff and proper motor suppression. Do not power motors from ESP32 pins.

Each DS18B20 uses powered three-wire mode: 3.3V, GND, DATA with its own 4.7 kΩ pull-up to 3.3V. IMU address is 0x68 (AD0 low); WHO_AM_I 0x68 (MPU6050) and 0x70 (MPU6500) are supported. Sensor logic must be 3.3V compatible.

Use a transistor driver for a high-current active buzzer: GPIO23 through ~1 kΩ to NPN base, ~10 kΩ base-to-ground, emitter GND, collector buzzer negative, positive to its rated supply. Add a flyback diode for an inductive buzzer and verify transistor pinout. Buck output must be measured and compatible with the ESP32 board's permitted 5V input; never apply it to 3V3. Avoid conflicting USB/external supplies. Check your L298N regulator jumper instructions; do not join two regulator outputs.

## Updated thresholds

Search these constants near the top of the `.ino`, edit, Verify and upload:

| Constant | Default | Meaning |
|---|---:|---|
| `TEMP_WARNING_C` | 31°C | Temperature warning |
| `TEMP_CRITICAL_C` | 34°C | Stops both motors and latches |
| `TEMP_RESET_C` | 30°C | Reset requires both temperatures below this |
| `TILT_WARNING_DEG` | 45° | Shared tilt warning after 3 samples |
| `TILT_CRITICAL_DEG` | 75° | Shared tilt stops both motors after 4 samples |
| `PWM_WARNING` | 204 / 255 (80%) | Commanded-speed advisory warning |
| `PWM_CRITICAL` | 242 / 255 (~95%) | Commanded-speed critical advisory alert |
| `SERVICE_BUDGET_MINUTES` | 200 min | Maintenance budget |
| `MOTION_DETECT_G` / `MOTION_DETECT_DPS` | 0.18 g / 12°/s | Shared movement detector for animation |

Tilt is the angle between the low-pass filtered acceleration vector and the still reference acquired at boot (not yaw). Linear acceleration can influence this estimate; validate with a known angle at rest. Static tilt no longer feeds the acceleration-magnitude vibration alarm. The current protection policy uses temperature, tilt and sensor faults; vibration/gyro values remain monitoring and movement signals. The initial mount must be still. Recovery can collect a new reference only with both drivers off; fault reset remains manual.

PWM alerts are **not measured RPM** and do not independently shut down the motor. Use the speed slider to set each motor's command independently. Temperature/tilt/fault interlocks still override commands. 34°C is a low limit: warm ambient conditions may intentionally block operation.

## 3D and movement limits

Detailed 3D models follow reported direction and PWM only when the motor command is active AND the shared IMU detects movement. They pause on stop, zero PWM, fault, missing movement, stale telemetry or disconnect. An independent watchdog stops animation when no fresh sample arrives.

**One shared IMU cannot verify each motor shaft.** A smooth running motor may not exceed the movement threshold; vibration from the other motor or external shaking may trigger the detector. Real independent shaft confirmation/RPM requires an encoder or Hall sensor per motor. No actual RPM or individual vibration is fabricated.

If detailed 3D is still downloading, a basic animated motor remains visible. Hardware downloads the bundled Three.js in small independently retried parts, verifies complete content and caches it locally. Monitoring continues during loading. WebGL failure falls back to a basic model instead of a blank panel. Demo stays one offline HTML file. Cutaway requires the detailed renderer.

## Connection reliability and diagnosis

Only ESP32 AutoReconnect manages Wi-Fi reconnection; the old periodic `WiFi.reconnect()` call was removed because it could conflict with an in-progress connection. Serial logs include disconnect reason, boot/reset reason and transfer status. Browser requests are serialized, telemetry calls are coalesced, failed reads back off, and repeated/stale data never remains presented as live.

No software change can guarantee a weak hotspot, noisy motor power or brownout-free supply. If connectivity still drops, send Serial output including disconnect/reset reason and test with motor power disconnected. Repeated boot lines indicate resets rather than just browser polling. Keep the ESP32 supply stable and separate motor noise from logic power. Compare `/api` with the page and confirm the currently printed IP.

## Lifecycle, ranking and reports

Service lifecycle decreases from **200 minutes** of commanded operation (enabled driver, nonzero PWM, direction not STOP). It is not predicted failure life or proof of shaft rotation. Each motor has a separate counter, checkpointed in Preferences every minute. Existing recorded runtime is preserved; changing the budget does not reset counters. Sudden power loss may lose up to a checkpoint interval. Flash erase resets stored totals. Exhausting the service budget does not itself shut down motors.

Ranking is labelled **Cooler now**, based only on valid temperatures. Compare under equivalent loads/ambient conditions. Sensor faults, offline states and critical latches do not invent a best motor.

Motor 1/2 detail buttons, controls, individual CSV/PDF reports, fleet report, downloadable HTML report and Alerts are available. Reports include current fault/threshold evidence, selected-range min/max/mean, charts and sensor status. Physical root causes need inspection; the application does not diagnose bearing damage. History is bounded to 1800 readings and 100 session events. Shared motion is clearly labelled. Export before closing the tab.

## Verify on your hardware

- Warm only temperature sensor 1, verify only Motor 1 changes; repeat for sensor 2. Compare against a thermometer. Surface temperature is not internal winding temperature.
- With motors off, keep the IMU still during boot. Verify near-zero relative tilt; tilt to known angles to check 45° warning and 75° critical.
- At safe low power, start each motor separately, change PWM, stop it, and verify physical output. Dashboard commands do not replace independent rotation feedback.
- Disconnect a sensor and verify protection, buzzer and fault latch. Restore sensors, wait for calibration if necessary, reset only when safe, then start manually.
- Disconnect Wi-Fi: UI must stop showing live data/animation; local ESP32 protection continues. Reconnect does not automatically start motors.

## Developer workflow and tests

Sources are in `web/`; `python3 tools/build.py` generates `demo.html`, `web/hardware.html`, and the single upload `.ino`. Edit firmware defaults in `web/firmware.template.txt` before regenerating. Direct private edits in `.ino` are overwritten by regeneration.

Run `python3 tests/safety.py`, `python3 tests/runtime.py`, `python3 tests/transfer.py`, `node tests/delivery.cjs`, `node tests/demo.cjs`, `node tests/upgrade.cjs`. Browser tests need Playwright and `/usr/bin/chromium`. GitHub Actions compiles the actual ESP32 target and runs native protection tests. Hardware tests use simulated telemetry; physical RF, power, sensor calibration and wiring require device validation. Managed cloud blocks `file://`, so the demo is tested over HTTP with no external requests.

See [THIRD_PARTY.md](THIRD_PARTY.md) for the uploaded geometry and bundled Three.js attribution.
