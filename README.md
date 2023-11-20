# traffic-simulation.de
Source code for the interactive Javascript simulation at  [traffic-simulation.de](https://traffic-simulation.de)

The simulations should be self-explaining and is also explained in the instruction boxes in most scenarios.

Besides simulating online, you can also use this simulator to generate vehicle trajectory files and virtual detector data files by using the blue download button (details further below).

Information on the used models and numerical integration schemes can be found in the links on the simulator page. In the following, I give some overview  about the implementation.

## Running the Simulation

This simulation uses JavaScript together with html5.

The master html file, for example onramp.html, starts the actual simulation by the canvas tag:
```
<canvas id="canvas_onramp" ... >some text for old browsers </canvas>
```
What to do with this canvas is specified in the ```init()``` procedure of onramp.js which starts the simulation and is assocoated with this canvas by the first command of the init procedure,

```
 canvas = document.getElementById("canvas_onramp");
```

(for _ring.html_, the ```init``` procedure of _ring.js_ would be associated with the canvas of that file, and so on). At the end of the initialization, ```init()``` starts the actual simulation thread by the command 

`return setInterval(main_loop, 1000/fps);`

The canvas dimensions are set/reset depending on the actual browser's
viewport size by additional controls in _canvasresize.js_ implementing a responsive design.

### Note on cached data

If the simulation does not run, sometimes the cause is old code in cached javascript or css files. So, the first thing to do is empty the cache

## Offline Usage

Just download all the html files and the js/, figs/, css/, and info/
directories and load, e.g., _index.html_ in your favourite browser. For
convenience and also to have access to the German version not
contained in the repository, you can
also download the zip file _offlineVersion.zip_ containing all
the ressources



## Program Files and Structure

The javascript code uses pseudo objects in appropriately named files, particularly

### \<scenario\>.js (ring.js, onramp.js etc)

the top-level simulation code for the corresponding scenario called in ring.html, onramp.html etc. Initializes the road network elements needed for the corresponding scenario (e.g. mainroad and onramp for the onramp scenario), starts/stops the simulation, controls the simulation updates in each time step depending on the scenario, draws everything, and implements the user controls defined in _ring_gui.js_, _onramp_gui.js_ etc.

### \<scenario_gui\>.js (ring_gui.js, etc.)

Defines the user control. Each simulation scenario (such as ring, onramp, roadworks) has both a top-level simulation javascript file \<scenario\>.js, and an associated gui \<scenario\>_gui.js (and of course an html file \<scenario\>.html).

### road.js

represents a directional logical road link as array element of the ```network``` variable defined in the top-level scenario files  and organizes the vehicles on it. Contains an array of vehicles and methods to get the neighboring vehicles for a given vehicle, to update all vehicles for one time step, and to interact with/get information of neighboring road network  elements.

* The longitudinal (arclength) coordinate u runs from u=0 to u=roadLen

* The lateral coordinate v increases to the right with v=0 at the road axis. The lane numbering also starts from the left.


It also has a unique `roadID` and provides methods to draw this network element and the vehicles on it. These drawing methods depend on the road geometry functions ```traj_x``` and ```traj_y``` giving the geo-located positions _(x,y)_ as a function of the arclength _u_ which are provided by the calling pseudoclasses \<scenario\>.js at construction time.
Further details for [road.js](#more-detailled-description-for-roadjs) and [how to connect it with other roads](#intersections-and-connecting-road-network-elements) are given further below.


### vehicle.js

each vehicle represents a vehicle-driver unit and has _(i)_ properties such as length, width, type, _(ii)_ dynamic variables such as position and speed, and _(iii_) a (deep copied) instance of the acceleration/lane changing methods from _models.js_. Optionally, a `vehicle` has also a _route_ as a sequence of `roadID`s to be traversed. This is only needed in scenarios with off-ramps or intersections.

Each vehicle also has a data element `driverfactor` set at construction time to model inter-driver variations (see below).

Besides regular vehicles, there are also special vehicle objects to be identified by their vehicle ID:

- `veh.id`=1:            ego vehicle (in future "ego-game" versions)
- `veh.id`=10..49:       vehicles that are clicked (and disturbed)
- `veh.id`=50..99:       user-moveable obstacles (desired speed zero, no stochasticity)
- `veh.id`=100..149      obstacles representing red traffic lights
- `veh.id` >=200:        normal vehicles and fixed obstacles


### models.js

a collection of pseudo-classes for the longitudinal models (presently, the IDM and an extension from it, the ACC model), and lane-changing decision models (presently, MOBIL), see the _references_ section for details. In addition to the pure models, following features are implemented.

* White acceleration noise of intensity `QnoiseAccel` that is also uncorrelated between vehicles. This leads to a random walk in speed with average speed difference sqrt(QnoiseAccel*dt). Since the longitudinal model is also used for lane changes (MOBIL) and decisions at intersections, a deterministic version of the acceleration is also provided.

* Inter-driver variations `driverfactor` with a uniform distribution around 1. Both the desired speed and the desired acceleration are multiplied by `driverfactor`. Since model parameters are often changed due to user interaction, speed limits, bottlenecks etc and the driverfactor should survive that, it is taken from the vehicle's driverfactor after each model change

* `speedlimit`s. These override all user-set desired speeds and also the driverfactor but not the acceleration noise

### How to implement new models

This is now described at the beginning of models.js. Basically, the steps are

* Define the constructor and implement all methods that are also present in the old models  (e.g., `ACC`) in `models.js`

* set the model templates to the new model; if needed, also introduce new gui-sliders in `control_gui.js` and the .html files

* redefine the slider interactions and model update in `control_gui.js` and `road.js`

To help in implementing, I defined the global flag `testNewModel` in `control_gui.js`. If set to true, a new skeleton "CACC" model will be used which is essentially the IDM. To check if this really works, I set the desired speed for the truck template to 3 m/s (you will see slow trucks if this works as intended). So you need just change all locations where `testNewModel` is used and you are done for all simulations.




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



## Download trajectory and virtual detector data

Besides just running the simulation interactively (should be self-explaining), you can also download the simulated trajectories and virtual detector readings

### Using the download functionality

Once your favourite simulation is running, you can start recording by clicking on the blue "Start download" button to the left of the language flags. One you have stored enough data, click the same button which now reads "Finish download" and, after allowing downloading (depending on the OS, some message pops up), you can find your downloaded files in your standard Downloads folder. Depending on the number of road segments of the simulation, you have one or more trajectory data named 

`road<n>_time<starttime>.txt`

and virtual detector data files named 

`Detector<name>_road<n>_x<pos>_time<starttime>.txt`

### Changing the sampling rates

The trajectory time interval is set by the variable `dt_export`; in gui.js (default value: 0.5 s). However, this does not give the realized timestep if the output time step is not a multiple of the simulation time interval dt_sim. Then, you will always get a varying multiple of dt_sim.

The simulation time interval, in turn, is dynamically set to realize fps=30, so we have dt_sim=timelapseFactor/fps. For the default time lapse of 6 (in most scenarios), we thus have a simulation time interval of 0.2 s.

To change the trajectory sampling time intervals, you need to do the following: 

* Set `dt_export` to your desired value dt_desired in `control_gui.js`

* In the simulation, use the sliders to set the time-lapse factor to a value below fps times dt_desired = 30/s times dt_desired

* Use the normal blue download button

To change the stationary detector sampling interval, change the constructor call in the corresponding simulation:

`...=new stationaryDetector(road,position,samplingInterval);`


## More detailled description for road.js

### The most important data elements

* road properties such as the `roadID`, the road length, number of lanes, lanewidth

* Topology: `isRing` or not

* If and how the road element is connected to neighboring network elements on its upstream and downstream boundaries

* If and how the road element is connected along its length by one or more off-ramps. If so, at which position and whether to the left or right. _Notice_: on-ramp info is not needed since, at link transitions, the upstream link always plays the master role

* Global or local influence factors on the driving behaviour such as overall iter-driver variation, minimum time interval between active and/or passive lane changes, and lane-changing bans. _Notice_:  Speed limits are controlled externally by the `TrafficObjects`

* An array of vehicles. This also includes 'special' vehicles such as the ego-vehicles, vehicles that are clicked on, and obstacles.

* An array of traffic lights. If set to red, a set of obstacles is created for every lane.

* Function pointers `traj` containing functions of the geo-referenced _x(u)_ and _y(u)_ coordinates as a function of the arclength u. _Notice_: This is used purely for graphical reasons.

### The most important `road` functions/methods

* The constructor setting the above attributes and populating the road with a given density and vehicle composition. For a detailled micro initialisation, there is the method `initializeMicro`. For only initializing/resetting the traffic without re-constructing the road or affecting the obstacles, there is the method `initRegularVehicles`

* `updateTruckFrac(frac)` Change _in situ_ the percentage of trucks by swapping cars for trucks and vice versa

* `updateDensity(density)` Change _in situ_ the density by dropping vehicles 'out of thin air' into the largest gaps or randomly removing regular vehicles
(the composition is controlled by the global variable `fracTruck` set by the user

* Add/subtract one lane

* Various searching methods:

  - `getNearestUof(otherRoad, u)`: get the longitudinal coordinate of `otherRoad` that is nearest to the coordinate u on the calling road

  - `findNearestVehTo(x,y)` find on this road the nearest vehicle to a physical (georeferenced) position (x,y)

  - `findNearestDistanceTo(x,y)` Map matching of a geolocated point (x,y) to the calling road. Returned is distance (|v|), u coordinate and v [lanes]

  - methods for finding the next leader/follower index or vehicle object for a given longitudinal coordinate u on a given or arbitrary lane _Notice_: The vehicles are always ordered according to decreasing u, regardless of the lane

* Methods influencing the local driving behaviour such as `setCFModelsInRange` (speed limits), `setLCModelsInRange` (overtaking bans or anticipation for entering an off-ramp), or `setLCMandatory` (before lane closings and on onramps)

### Central simulation `road` update methods called at each time step `dt`

Each of the following methods acts on all vehicles and is called for all links of the `network` before going to the next. As a result, the order of the vehicles or links does not play a role in the update (_parallel update_)

* `updateEnvironment()` Sorts the vehicles in decreasing longitudinal (`u`) order and updates, for each regular vehicle on the road, the local environment: indices of the leader and follower on the own lane and for the lead and lag vehicles on the both adjacent lanes. This is called whenever the vehicles may get disordered (update of the positions, effect of inflow/outflow at the road boundaries, ramp traffic, user dropped or lifted obstacles)

* `calcAccelerations()` calculates longitudinal accelerations for all vehicles and stores them in the `vehicle.acc` data element

* `updateSpeedPositions()` Updates speeds by the Euler method and positions by the ballistic method (see section _Numerical Integration_). 

* `changeLanes()` tests and executes lane changes first to the right, then to the left. Because of the waiting times after each active or passive lane change (state variables `vehicle.dt_afterLC`, `vehicle.dt_lastPassiveLC` and `road.waitTime`),  changes to the right are priorized and side effects are avoided  

* `mergeDiverge(otherRoad,...)` change to another network link from the calling element to `otherRoad` if this other element has a parallel section with the calling road (onramp or offramp). Parameters include the `offset` of the arc-length (u) coordinate new-old road, the region `uBegin` and `uEnd` of the ramp, whether it is a merge, whether it is to the right. _Notice_: Since the vehicle transfer is always from the calling road to the other road, it is, technically speaking, always a diverge. However, merges are always at the end of the calling road and have a standing virtual obstacle at its end. Moreover, merging affects all vehicles while diverging takes place only if the corresponding vehicle route have the new road as next element or (if `ignoreRoute` is true) for the vehicles on the adjacent lane.  Furthermore, some graphics aspects are different.

* `connect(..)` and `determineConflicts`: These methods will be considered in their [own section](#intersections-and-connecting-road-network-elements)

* `updateBCdown()` If the downstream end is not connected to another link and the road is not a ring road, vehicles just vanish if driving over the boundary

* `updateBCup(Qin,dt,route)` Insert a new vehicle at u=0 whenever the inflow buffer vehile count exceeds 1. 

  - The buffer is incremented by `Qin*dt` with some noise and decremented by 1 if a new vehicle enters or the maximum buffer size (at the present 2) is exceeded. 

  - The type is determined based on the present global `fractruck` variable and the inter-driver variation is set when constructing the vehicle.

  - The vehicle is set at the lane with the largest gap unless it is a truck. Then it is set preferably to the right

* `updateModelsOfAllVehicles` Each vehicle gets a new deep-copied set of acceleration/lane changing models depending on user interaction, arriving at a speed-limit zone, approaching an offramp to be used (the, the lane-changing model gets a strong bias towards the exit), and others. In all cases, the `driverfactor` characterizing the driving style unique for a given driver-vehicle unit  persists all these changes.

* `updateSpeedlimits(trafficObjects)` If the user dragged a speed limit to a new position, lifted one, or changed its value. _Notice_: Since dragging is cumbersome on touch devices, the scenarios `roadworks` where limits are crucial has also a slider for the speedlimit which is changed globally at `updateModelsOfAllVehicles`

* Some callbacks for user-dragged objects such as `dropObject`, `addTrafficLight`, `changeTrafficLight`, `removeTrafficLight`, and `removeObstacle`



### The order of the updates

Generally, each of the following actions  (if applicable) is executed for all roads and on all vehicles before going to the next action. So, a parallel update is ensured which is the only update type making sense in general networks without a natural order:

* respond to user interactions dragging objects and changing speed limits
* respond to user interactions by the sliders (and to vehicles entering new zones)
  - update the truck fraction
  - update the models
  - update the density (only for the ringroad scenario)

* calculate accelerations
* change lanes
* performing merging and diverging (special case of lane changing)
* update speeds and longitudinal positions
* update detector counts
* applying the upstream and downstream boundary conditions (if connected to a source/to nothing)
* performing the road connections to other links


## Intersections and connecting road network elements

This is realized by the method `road.connect(target, uSource, uTarget, offsetLane, conflicts, options)`. When connecting just two network elements end-to-end (for example to model lane closing or opening or other changes of the road properties or right tuens where the only thing to watch are the vehicles on the target road but no crossing streams), `conflicts=[]`. Otherwise, the conflicts are analyzed by `road.determineConflicts(..)`

### Connecting two roads end to end

* If this is just used to connect two roads with the same number of lanes but possibly different other properties, you just call
`sourceRoad.connect(targetRoad, source.roadLen,0,0,[]);`

* If you want to decrease or increase the number of the lanes by subtracting/adding them from/to the right, we still have `sourceRoad.connect(targetRoad, source.roadLen,0,0,[])` since lanes are counted from the left to the right (increasing `v` coordinate). The target road has just fewer or more lanes than the origin road

* If you want to decrease or increase the number of the lanes from/to the left, define offsetLane=-1 for closing and +1 for opening instead of zero.

* You could also simultaneously subtract a lane on the right and add one on the left by setting equal lane numbers for the source and target and `offsetLane=+1`. In all cases, vehicles change lanes to continue on the through lanes in advance (_Notice_ not yet perfect)

### Intersections for ODs with no conflicts

Example for a right-turn from the source road to the target road at the target coordinate uTurn:

`sourceRoad.connect(targetRoad, sourceRoad.roadLen, uTurn, nLanesTarget-nLanesSource, [], maxspeed, targetPrio);`
The difference to the above is only the target u coordinate, the lane offset (the rightmost lane of the source, index `nLanesSource-1` connects to the rightmost lane of the target, `nLanesTarget-1`, and the optional parameters `maxspeed` and `targetPrio`

Notice that, also with `conflicts=[]`, the vehicles on the target road are always considered. In effect, a right turn to another road (or a general turn without conflicts) is a `mergeDiverge` with a single merging decision point instead of a finite ramp length. Therefore, much anticipation heuristics is needed unless one mandates an entry with a stop (`maxspeed=0`).

_Notice_ not yet perfect

### Intersections for ODs with conflicts

In most cases, crossing or turning at intersections does not only involve looking out for the traffic on the target road (this is done outside of the `conflicts[]` specification) but determining and resolving conflicts with traffic on roads that are neither source nor target: Following is for a classical non-signalized four-way intersections with all ODs (except for U-turns) allowed. Since OD restrictions are implemented on the basis of the allowed vehicle `route`s, these need not to be considered here. Some conflicts just do not appear if there are turning restrictions. Things get simpler for a T-intersection.

* Right turns: None, not even when turning into a priority road (then, `targetPrio` is set to `true`)

* Crossing a mainroad straight-on: traffic on the two mainroad directions (=two separate directed link of the `road` type). The left-turners from the opposite road have to care for themselves, so there is no conflict potential 

* Crossing an equal-rank intersection (right priority) straight-on: traffic on the mainroad direction coming from the right, except right-turners because they are eventually on the target road. _Notice_: In order for that to work, the vehicles change to the new logical link ahead of the actual passing time of the physical boundaries.

* Crossing a secondary road straight-on: none.

* Left turn from a priority road: Straight-ahead OD of the opposite direction of the priority road (the left turning traffic from the opposite mainroad does not conflict for turning _the american way_, the right turning traffic has the same target as the subject and is therefore taken care of as a target-road vehicle).

* Left turn on an equal-rank intersection: As left turn from a priority road, additionally left turners from the right road 

* Left turn from a secondary road: As left turn on an equal-rank intersection, additionally left turners from the left (main) road. Plus `targetPrio=true`  at `sourceRoad.connect(...)`


All this is done by the method `road.determineConflicts(..)`
quite tricky, see the code.


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
