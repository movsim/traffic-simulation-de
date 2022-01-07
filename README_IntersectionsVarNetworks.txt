
General-purpose new method for connecting roads to form a network
(ultimately, also the road.mergeDiverge method will be included):
road.connect

The network is then built by connectors rd[i].connect(rd[j], ...)
and by the sources (sinks are just road ends without connectors)

see figs/connect.fig:

##################################################################
road.connect(targetRoad, uSource, uTarget, offsetLane, uAntic, conflicts)
##################################################################

- connect to target at the long coordinate uSource to uTarget
   (or a little bit before uDecision to uTarget-(uSource-uDecision))
   
- lane numbers may be offset

- certain anticipation zone upstream of uSource to observe last
  vehicles on target road, change lanes/stop in case of lane closings,
  stop/decide in case of conflicts

##################################################################




* lane counts from left to right l=0,1,2,...

* road segment "road" can have one or more lanes, but fixed number

* connectors only work with routes (set of road IDs) for each vehicle

* unlike mergings/divergings (segments connect in parallel),
  connectors connect segments pointwise/frontal. Often, but not
  always, end to beginning but generally from decision point
  uDecision to target point uTarget with no logical transition

* optically, the vehicles on the same logical road may have different
  trajectories selected by elements of the vehicle's route

  Example: rd1 horiz right, rd2 vertical up,
  rd 1 has trajectories traj=traj11,addtl_traj=[{roadID=id, traj=traj_id},...]
  - if the addtl trajectories are [{2,traj2_1}], then vehs with route
  [1] drive on traj1 and with route [2,1]  (or [3,7,2,1,4]) on traj2_1
  (default addtl_traj=[], all vehicles have same optical traj)

* One road may have several connecting
  roads -> several connectors. The vehicle on the source road "picks"
  the right connector (1:1 relation) comparing the target id with its route
  If the route does not fit any target ID of any connector
  or if there is no
  route or no connector, the vehicle just vanishes ("sink")

* Each lane of source connects to exactly one lane of target,
  e.g. 2->1 lanes, left lane closes: offsetLane=-1
  e.g. 2->1 lanes, right lane closes: offsetLane=0
  e.g. 1->2 lanes, new left lane: offsetLane=+1

* If a lane ends, e.g. nLanes=2, target.nLanes=1, offsetLane=-1, orig
  lane 0 (any lane for which lane+offsetLane<0 or >=target.nLanes),
  laneChangeBias in the anticipation zone:
  - pos bias (to right) and obstacle at the end if lane+offsetLane<0
  - neg bias and obstacle at the end if lane+offsetLane>=target.nLanes

* connectors may have one or more segments with conflicting traffic
  given in the argument as array [conflict0,conflict1,..]
  if there is no conflict, [] is passed and vehs need not to stop
  (they only watch the last vehs on each lane on 
  the target road), so a jam can pass the connector.

* If there is a possible conflict, vehicles stop at the stopping point
  (virtual obstacle) unless all conflict checks are passed which lifts
  the virtual obstacle and instantaneously transfers the veh to the
  new segment

* The conflict checks are first taken after having passed the decision
  point (a few 
  meters upstream 
  of the stopping point uSource) and, if one check is negative, repeated in
  every timestep 
  until all checks are passed

* each conflict has the form

  {roadConflict:certain_road,
   uConflict:conflicting_coord_on_conflicting_road (may be > roadLen)
   uOwnConflict: conflict_coord_on_target_road}

* The checks assume ballistic/constant-speed heuristics:

  - distance uc to conflict point (uTarget=long coord at connection point)
    uc=uOwnConflict-uTarget+(uSource-u)=actual distance to conflict point

  - time tc (w/resp to present) by ballistic approx:
    uc=v*tc+0.5*a*tc**2 
    
    => tc=-v/a+sqrt(v^2/a^2+2*uc/a)

  - TTC (per def) constant speed approximation: veh in neighbourhood
    of uOtherConflict at decision time:

    TTC=(uOtherConflict-uVeh)/vVeh-tc, xTC=TTC*vVeh


  - test passed if

    ((TTC<-TTCdown) || (TTC>TTCup)) && ((xTC<-xTCdown)&&(..up))
    
    TTCdown=1s
    TTCup=4s
    xTCdown=xTCup=10m  (needed if conflicting vehs are very slow)
    possibly add addtl safety for broad roads (not at the beginning)

  - conflict check passed if test passed for all vehs in influence
    zone (road must be longer) 
    [uOtherConflict-uAntic, uOtherConflict+xTCdown]

  - if conflict checks passed for all conflicts, the virtual obstacle
    (for this vehicle) vanishes and the transition to the
    new road at the target coordinate uTarget-(uSource-u) is performed
    instantly 
  







(old, probably 2019)


The network in the different scenarios is predefined. The reason is that this is no fully fledged network simulator but a pedagocical one that shoud run just by starting it without the need of configuring a network which is, both from the programmer's and user's point of view, nontrivial. Nevertheless, in the next version, I will provide methods for the `road` pseudoclass allowing to create your own network (in the source code, not graphically). Basically, this is decribed in https://github.com/movsim/traffic-simulation-de/blob/master/README_joinRoads.txt

Moreover, there is not any implementation for intersections (if this is what you mean with "cross-roads"), only merges, diverges and roundabouts. In https://github.com/movsim/traffic-simulation-de/blob/master/README_intersections, I give some hints how to implement intersections

Finally, it is straightforward to programmatically change the traffic light state: you need just to access the element trafficObj[i].value which can be "red" or "green". Here trafficObj[i] is a traffic object of type "trafficLight" which is defined in TrafficObjects.js, see the revised README.md at https://github.com/movsim/traffic-simulation-de/blob/master/README.md. An example is given in the ramp metering scenario https://traffic-simulation.de/onramp_BaWue_ger.html .

