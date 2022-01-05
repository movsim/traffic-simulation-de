
General-purpose new method for connecting roads to form a network
(ultimately, also the road.mergeDiverge method will be included):
road.connect

The network is then built by connectors rd[i].connect(rd[j], ...)
and by the sources (sinks are just road ends without connectors)

see figs/connect.fig

* lane counts from left to right l=0,1,2,...

* road segment "road" can have one or more lanes, but fixed number

* connectors need routes, so one road end can have several connecting
  roads. The vehicle on the source road "picks" the right connector
  (1:1 relation)
  The one with the target road index in the route segments of this
  vehicle. If the route does not fit any target index of any connector
  or there is no
  route or no connector, the vehicle just vanishes ("sink")

* unlike mergings/divergings (segments connect in parallel),
  connectors connect segments pointwise, often, but not always, frontal end to
  beginning

* Each lane of source connects to exactly one lane of target,
  e.g. 2->1 lanes, left lane closes: offsetLane=-1
  e.g. 2->1 lanes, right lane closes: offsetLane=0
  e.g. 1->2 lanes, new left lane: offsetLane=+1

* If a lane ends, e.g. nLanes=2, target.nLanes=1, offsetLane=-1, orig
  lane 0 (any lane for which lane+offsetLane<0 or >=target.nLanes),
  laneChangeBias in the anticipation zone:
  - pos bias (to right) if lane+offsetLane<0
  - neg bias (to left) if lane+offsetLane>=target.nLanes

* connectors may have one or more segments with conflicting traffic
  given in the argument as array [conflict0,conflict1,..]
  if there is no conflict, [] is passed and vehs need not to stop at
  the decision point (typically a few
  meters before the source road ends but can be in the
  middle). Otherwise, they stop 

* each conflict has the form
  {roadConflict:certain_road,
   uOtherConflict:conflicting_coord_on_conflicting_road (may be > roadLen)
   uOwnConflict: conflict_coord_on_target_road}

* each conflict is checked first at the "decision point" with ballistic/constant-speed
  approximation and the checks are repeated each time step if not passed

  - time tc (w/resp to decision time) by ballistic approx:
    uOwnConflict=v*tc+0.5*a*tc**2
    
    => tc=-v/a+sqrt(v^2/a^2+2*uOwnConflict/a)

  - TTC (per def) constant speed approximation: veh in neighbourhood
    of uOtherConflict at decision time: TTC=(uOtherConflict-uVeh)/vVeh
                                        xTC=TTC*vVeh
    passed if

    ((TTC<-TTCdown) || (TTC>TTCup)) && ((xTC<-xTCdown)&&(..up))
    
    TTCdown=1s
    TTCup=4s
    xTCdown=xTCup=10m  (needed if conflicting vehs are very slow)
    possibly add addtl safety for broad roads (not at the beginning)

  - test performed for all vehs in influence zone (road must be longer)
    [uOtherConflict-uAntic, uOtherConflict+xTCdown]

  - if test passed for all vehicles in all influence zones, check passed
  



road.connect(targetRoad, uDecision, uTarget, offsetLane, conflicts)



fixed constant: anticipation zone for stopping (if possible
conflicts), lane changing (if the lane ends at the connector) or
checking target traffic (if not) 

(old, probably 2019)


The network in the different scenarios is predefined. The reason is that this is no fully fledged network simulator but a pedagocical one that shoud run just by starting it without the need of configuring a network which is, both from the programmer's and user's point of view, nontrivial. Nevertheless, in the next version, I will provide methods for the `road` pseudoclass allowing to create your own network (in the source code, not graphically). Basically, this is decribed in https://github.com/movsim/traffic-simulation-de/blob/master/README_joinRoads.txt

Moreover, there is not any implementation for intersections (if this is what you mean with "cross-roads"), only merges, diverges and roundabouts. In https://github.com/movsim/traffic-simulation-de/blob/master/README_intersections, I give some hints how to implement intersections

Finally, it is straightforward to programmatically change the traffic light state: you need just to access the element trafficObj[i].value which can be "red" or "green". Here trafficObj[i] is a traffic object of type "trafficLight" which is defined in TrafficObjects.js, see the revised README.md at https://github.com/movsim/traffic-simulation-de/blob/master/README.md. An example is given in the ramp metering scenario https://traffic-simulation.de/onramp_BaWue_ger.html .

