# traffic-simulation.de
Source code for the interactive Javascript simulation at  [traffic-simulation.de](https://traffic-simulation.de)

## Running the Simulation

This simulation uses JavaScript together with html5.

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

The initial canvas dimensions are overridden depending on the actual browser's
viewport size by additional controls in _canvasresize.js_ implementing a responsive design.


## Offline Usage

Just download all the html files and the js/, figs/, css/, and info/
directories and load, e.g., _index.html_ in your favourite browser. For
convenience and also to have access to the German version not
contained in the repository, you can
also download the zip file _offlineVersion.zip_ containing all
the ressources



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


### TrafficObjects.js

a set of traffic-related objects that can be dragged by the user 
from a "depot" to a network link (road) and back. 
The main data element of this class is an array `trafficObj` 
of the traffic objects. At present, any array element
`traffObj=trafficObj[i]` can 
represent one of three types of traffic objects:

* obstacles:        `traffObj.type=='obstacle'`
* traffic lights   `traffObj.type=='trafficLight'`
* speed limits     `traffObj.type=='speedLimit'`


Any object has one of two states at any time specified by the object's
data element `isActive`:

* `traffObj.isActive=true`: The object is on the road:
 
   - in case of obstacles or traffic lights, real or 
     virtual vehicle objects are added to the road at dropping time 
   - in case of speed limits, no new objects are generated but the vehicle's
     models are changed.
   - in all cases, the visual appearance changes at dropping time

* `traffObj.isActive=false`: the object is either in the "depot", or
  dragged, or zooming back to the depot


The traffic light and speed limit objects also have values:
  
  - `traffObj.value="red"` or `"green"` (if `traffObj.type==='trafficLight'`)
  - `traffObj.value=limit_kmh` (if `traffObj.type==='speedLimit'`)
  - `traffObj.value="null"` (if `traffObj.type==='obstacle'`)


The main unique component of the objects is its `traffObj.id`. 
  In case of active traffic light or obstacle objects, 
  the id of the generated vehicle objects on the road are the same
  as that of the `traffObj` and in the range 50-199 (all special
  vehicles have ids < 200). The complete list of traffObj and vehicle
  id ranges is 
  as follows: 

- `veh.id`=1:            ego vehicle
- `veh.id`=10..49:       vehicles that are disturbed by clicks
- `traffObj.id`=`veh.id=50..99:    objects and generated vehicles 
   of type obstacle
- `traffObj.id`=`veh.id=100..149   objects of type trafficLight and
   generated vehicles (one per lane) of type obstacle 
- `traffObj.id`=150..199     speed limits ( no generated virtual
  vehicles)
- `veh.id` >=200:             normal vehicles and fixed (non-depot) obstacles

### colormanip.js

Helper-class providing some speed and type-dependent color maps to draw the vehicles.


### redirect.js

callback (implementation) of the buttons for the different scenarios on the \<scenario\>.html simulation pages

## Numerical Integration

The underlying car-following model for the longitudinal dynamics
providing the accelerations (Intelligent-Driver Model, IDM, or
extensions thereof) is time-continuous, so a numerical update
scheme is necessary to get the speeds and positions of the vehicles as
approximate integrals over the accelerations. For our purposes, it
turned out that following _ballistic scheme_ is most efficient in
terms of computation load for a given precision. Its pseudo-code for
an update of the speeds _speed_ and positions _pos_ over a fixed time interval _dt_ reads

_speed(t+dt)=speed(t)+acc(t)*dt,_

_pos(t+dt)=pos(t)+speed(t)*dt+1/2*acc(t)*dt^2_,

where _acc(t)_ is the acceleration calculated by the car-following model
at the (old) time t.

Lane-changing is modelled by the discrete model MOBIL, so no
integration is needed there. In order to reuse the accelerations
needed by MOBIL (_Minimizing Obstructions By Intelligent
Lane-changes_") for calculating the lane-changing decisions, lane
changing is performed after evaluating _all_
accelerations. Furthermore, since MOBIL anticipates the future
situation, the actual speed and positional update is performed after
the lane changing. Hence the central update sequence performed for all
```road ``` instances of the simulated network is given by

```
  roadInstance.calcAccelerations();
  roadInstance.changeLanes();         
  roadInstance.updateSpeedPositions();
```
in the main simulation file of the given scenario (```ring.js```,
  ```onramp.js``` etc). The main method is either ```updateRing()``` (ring
  road), or ```updateU()``` (the other scenarios).

* Notice that the update is in parallel, i.e., updating _all_
 accelerations on a given road, then all lanes, all speeds, and all
 positions sequentially (if there are interdependencies between
 the road elements of the network, this sequentiality should also be
 traversed over all road 
 instances which, presently, is not done).

* The central update step is prepended by
  updating the model parameters as a
  response to user interaction, if vehicles reach special
  zones such as the uphill region, or if they reach mandatory lane-changing regions before lane closing and offramps.

* For closed links (ring road), the central update step is prepended by
  changing the vehicle population (overall density, truck
  percentage) as a response to user interaction.

* For open links, the central method is appended
   by applying the 
  boundary conditions ```roadInstance.updateBCdown``` and
  ```roadInstance.updateBCup``` for all non-closed network links. For
  further information on boundary conditions, see the info link
  _Boundary Conditions_ at ```traffic-simulation.de```.

* The implementation of the actual models is given in
  ```models.js```. Presently (as of November 2016), an extension of
  the Intelligent-Driver Model
  ("ACC model") is used as acceleration model, and MOBIL as the
  lane-changing model. We use the ACC model rather
  than the "original" IDM since the former is less sensitive to too
  low gaps which makes lane changing easier. For the same reason, we
  have modified MOBIL somewhat by making its ```bSafe``` parameter
  depending on the speed. Thus, we make lane changes more aggressive
  in congested situations.  For further information, see the scientific
  references below, or the info links below the heading _Traffic Flow
  Models_ at ```traffic-simulation.de```


 
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
    
[5] M. Treiber, and A. Kesting. An open-source microscopic traffic
simulator.     IEEE Intelligent Transportation Systems Magazine, 6-13
(2010). [Preprint](http://arxiv.org/abs/1012.4913)

[6] M. Treiber and V. Kanagaraj.
Comparing Numerical Integration Schemes for Time-Continuous Car-Following Models
Physica A: Statistical Mechanics and its Applications 419C, 183-195
DOI 10.1016/j.physa.2014.09.061 (2015).
[Preprint](http://arxiv.org/abs/1403.4881)
