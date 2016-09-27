# traffic-simulation-de
Source code for javascript simulation of  [www.traffic-simulation.de](http://www.traffic-simulation.de)

## Running the Simulation

This simulation uses JavaScript/html5.

The master html file, for example onramp.html, starts the actual simulation by the canvas tag:
```
<canvas id="canvas_onramp" width="800" height="600">some text for old browsers </canvas>
```
What to do with this canvas is specified in the _init()_ procedure of onramp.js which starts the simulation and is assocoated with this canvas by the first command of the init procedure,

```
 canvas = document.getElementById("canvas_onramp");
```

(for ring.html, the init procedure of ring.js would be associated with the canvas of that file, and so on). At the end of the initialization, _init()_ starts the actual simulation thread by the command 

`return setInterval(main_loop, 1000/fps);`

In future versions, an additional control file _canvasresize.js_ will implement a responsive design.

## Programm Files and Structure

The javascript code uses pseudo objects in appropriately named files, particularly

### \<scenario\>.js (ring.js, onramp.js etc)

the top-level simulation code for the corresponding scenario called in ring.html, onramp.html etc. Initializes the road network elements needed for the corresponding scenario (e.g. mainroad and onramp for the onramp scenario), starts/stops the simulation, controls the simulation updates in each time step depending on the scenario, draws everything, and implements the user controls defined in ring_gui.js, onramp_gui.js etc.

### \<scenario_gui\>.js (ring_gui.js, etc.)

Defines the user control. Each simulation scenario (such as ring, onramp, roadworks) has both a top-level simulation javascript file \<scenario\>.js, and an associated gui \<scenario\>_gui.js (and of course an html file \<scenario\>.html).

### road.js

represents a road network element (road link) and organizes the vehicles on it. Contains an array of vehicles and methods to get the neighboring vehicles for a given vehicle, to update all vehicles for one time step, to interact with/get information of neighboring road network  elements.

It also provides methods to draw this network element and the vehicles on it. These drawing methods depend on the road geometry functions ```traj_x``` and ```traj_y``` to be provided by the calling pseudoclasses \<scenario\>.js

### vehicle.js

each vehicle has _(i)_ properties such as length, width, type, _(ii)_ dynamic variables such as position and speed, and _(iii_) instances of the acceleration/lane changing methods from models.js.

### models.js

a collection of pseudo-classes for the longitudinal models (presently, the IDM), and lane-changing decision models (presently, MOBIL).

### colormanip.js

Helper-class providing some speed and type-dependent color maps to draw the vehicles.

### dw_slider.js

external open library to implement sliders. Has some drawbacks (no docu of how to change sliders programmatically, initialize them to arbitrary values). In future versions, I plan to replace them with generic html5 sliders (range element).

### redirect.js

callback (implementation) of the buttons for the different scenarios on the \<scenario\>.html simulation pages

## Graphics

The drawing is essentially based on images:

* The background is just a jpeg image.

* Each road network element is composed of typically 50-100 small road segments. Each   road segment  (a small png file) represents typically 10m-20m of the road length with all the lanes. By transforming this image (translation, rotation,scaling) and drawing it multiple times, realistically looking roads can be drawn.

* The vehicles are drawn first as b/w. images (again translated, rotated, and scaled accordingly) to which an (appropriately transformed) semi-transparent rectangle is added to display the color-coding of the speeds.


## References 

[1] M. Treiber, A. Hennecke, and D. Helbing. _Congested traffic states in empirical observations and microscopic simulations._ Physical review E 62 1805-1824 (2000). [Link](http://journals.aps.org/pre/pdf/10.1103/PhysRevE.62.1805), [Preprint](http://arxiv.org/abs/cond-mat/0002177)

[2] M. Treiber and A. Kesting. [_Traffic Flow Dynamics, Data, Models and Simulation_](http://www.traffic-flow-dynamics.org). Springer 2013. [Link](http://www.springer.com/physics/complexity/book/978-3-642-32459-8)

[3] A. Kesting, M. Treiber, and D. Helbing. _General lane-changing model MOBIL for car-following models_.   Transportation Research Record, 86-94 (2007). [Paper](http://www.akesting.de/download/MOBIL_TRR_2007.pdf)
    
[4] A. Kesting, M. Treiber, and D. Helbing. _Enhanced intelligent driver model to access the impact of driving strategies on traffic capacity_. Philosophical Transactions of the Royal Society A, 4585-4605 (2010). [Preprint](http://arxiv.org/abs/0912.3613)
    
[5] M. Treiber, and A. Kesting. An open-source microscopic traffic simulator.     IEEE Intelligent Transportation Systems Magazine, 6-13 (2010). [Preprint](http://arxiv.org/abs/1012.4913)
