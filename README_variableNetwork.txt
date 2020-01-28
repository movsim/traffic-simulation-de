
The network in the different scenarios is predefined. The reason is that this is no fully fledged network simulator but a pedagocical one that shoud run just by starting it without the need of configuring a network which is, both from the programmer's and user's point of view, nontrivial. Nevertheless, in the next version, I will provide methods for the `road` pseudoclass allowing to create your own network (in the source code, not graphically). Basically, this is decribed in https://github.com/movsim/traffic-simulation-de/blob/master/README_joinRoads.txt

Moreover, there is not any implementation for intersections (if this is what you mean with "cross-roads"), only merges, diverges and roundabouts. In https://github.com/movsim/traffic-simulation-de/blob/master/README_intersections, I give some hints how to implement intersections

Finally, it is straightforward to programmatically change the traffic light state: you need just to access the element trafficObj[i].value which can be "red" or "green". Here trafficObj[i] is a traffic object of type "trafficLight" which is defined in TrafficObjects.js, see the revised README.md at https://github.com/movsim/traffic-simulation-de/blob/master/README.md. An example is given in the ramp metering scenario https://traffic-simulation.de/onramp_BaWue_ger.html .

