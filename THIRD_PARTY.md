# Sources and attribution

The motor geometry in `web/motor-view.js` is adapted from the user's uploaded `motor-models-1-2-3-source.zip` (`MotorScene.tsx`). It retains the finned housing, end plates, bearing rings, shaft, rotor bars, fan, coupling, terminal box and mounting base. The React geometry was ported to vanilla Three.js so the demo remains one HTML file. Only two motors are rendered. The supplied simulator's RPM, current, load and mm/s values are not real measurements for this hardware and were not imported.

`web/vendor/three.min.js` is the vendored Three.js library from the user's `kumaramardeepranjan09-gif/dashboard` repository. Its original copyright/license header is preserved. The dashboard repository's offline assets and distinction between commanded animation and real RPM informed this implementation. Its three-motor telemetry schema was not reused.

Three.js — MIT License
Copyright © 2010–2021 Three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
