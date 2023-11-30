// types: "car", "truck", "others", "obstacle" (including red traffic lights)
// id's defined mainly in vehicle.js and ObstacleTLDepot.js
// id<200:              special vehicles/road objects
// id=1:                ego vehicle
// id=10,11, ..49       disturbed vehicles 
// id=50..99            depot vehicles/obstacles (vehicle.isDepotObstacle())
// id=100..199          traffic lights (vehicle.isTrafficLight())
// id>=200:             normal vehicles and obstacles
// id>=200&&type!=="obstacle" regular vehicles (vehicle.isRegularVeh)

// MT 2023-04: driver_varcoeff=speed coefficient of variation
// need to introduce here instead of model because models often overridden
// during sim (v0 changes from outside, speed limits,...)

// (driver_varcoeff optional parameter)

var ivehCount=0;

function vehicle(length, width, u, lane, speed, type, driver_varcoeff){
  this.len=length; // car length[m]
  this.width=width;   // car width[m]
  this.u=u;           // long coordinate=arc length [m]
  this.lane=lane;     // integer-valued lane 0=leftmost
  this.v=lane;        // lane coordinate (lateral, units of lane width), not speed!!
  this.dvdt=0;     // vehicle angle to road axis (for drawing purposes)
  this.laneOld=lane;  // for logging and drawing vontinuous lat coords v
  this.speed=speed;
  this.type=type; //{"car", "truck", "others", "obstacle"

  ivehCount++;
  this.id=199+ivehCount; // ids 0-199 special purpose
    //this.id=Math.floor(100000*Math.random()+200); // ids 0-199 special purpose
 

  this.route=[]; // route=sequence of road IDs (optional)
  this.divergeAhead=false; // if true, the next diverge can/must be used
  this.toRight=false; // set strong urge to toRight,!toRight IF divergeAhead

  this.fracLaneOptical=1; // slow optical LC over fracLaneOptical lanes
  this.colorStyle=0;  // {hue as f(speed), thick-red, thick-green}

  this.dt_LC=4;       // fixed vehicle property
  this.dt_afterLC=10; // dynamical variable incremented and reset at LC
  this.dt_lastPassiveLC=10; // dyn var
  this.dt_gridlock=0; // only used/incremented in connect if vehicle is stuck 
  this.acc=0;
  this.LCbanLeft=false;  // MT 2023-04: tactical: no changes to left allowed
  this.LCbanRight=false;  // MT 2023-04: tactical: no changes to left allowed

  this.tookGoDecision=true; // only relev for road.connect; reversible go
  this.finalGo=false;       // only relev for road.connect; irreversible go


  // only for golfCourse simulation (cannot incept new attribute from outside)
  // if it will be needed for more applications (such as this.dt_LC etc)
  // generalize it to
  // this.stateActive=[]; (this.canOvertakeGolf would be this.stateActive[0])
  // this.dt_stateActive=[]; (active time can be triggered to reset it)
  // of course, other events (e.g., reaching a certain lain)
  // can also be used to revert
  
  this.canOvertakeGolf=false; // only for golfCourse simulation
  this.dt_overtakeGolf=0;     // cannot incept new attribute from outside

  this.conflictsExist=false; // for intersections: road.connect
  this.iLead=-100;
  this.iLag=-100;
    //this.iLeadOld=-100; // necessary for update local environm after change
    //this.iLagOld=-100; // necessary for update local environm after change

  this.iLeadRight=-100;
  this.iLeadLeft=-100;
  this.iLagRight=-100;
  this.iLagLeft=-100;
    //this.iLeadRightOld=-100;
    //this.iLeadLeftOld=-100;
    //this.iLagRightOld=-100;
    //this.iLagLeftOld=-100;

  // just start values used for virtual vehicles (need not to be updated
  // if new model implemented) !!
  this.longModel=new IDM(20,1.3,2,1,2);//IDM_v0,IDM_T,IDM_s0,IDM_a,IDM_b);
  this.LCModel=new MOBIL(4,20,0.1,0.2,0.3); //bSafe, bSafeMax, p, bThr, biasRight)

  this.driver_varcoeff=(!(typeof driver_varcoeff === 'undefined')) ? driver_varcoeff : 0;
  this.driverfactor=1+Math.sqrt(12)*this.driver_varcoeff*(Math.random()-0.5);
  //console.log("vehicle cstr: id=",this.id," driverfactor=",this.driverfactor);
}

//######################################################################
// reset driver agility variation and draw new driver realisation
//######################################################################

vehicle.prototype.setDriverVariation=function(driver_varcoeff){
  this.driver_varcoeff=driver_varcoeff
  this.driverfactor=1+Math.sqrt(12)*this.driver_varcoeff*(Math.random()-0.5);
  //console.log("vehicle.setDriverVariation: this.driverfactor=",this.driverfactor);
}

//######################################################################
// implement route info (not yet used?)
//######################################################################

vehicle.prototype.setRoute=function(route){
  this.route=route;
}



//######################################################################
// check if vehicle vehObject is a traffic light
//######################################################################

vehicle.prototype.isTrafficLight=function(){
    return (this.id>=100)&&(this.id<200);
} 

//######################################################################
// check if vehicle vehObject is a depot vehicle but no traffic light
//######################################################################

vehicle.prototype.isDepotObstacle=function(){
    return (this.id>=50)&&(this.id<100);
} 

//######################################################################
// check if vehicle vehObject has been externally perturbed (slowed down)
//######################################################################

vehicle.prototype.isPerturbed=function(){
    return (this.id>=10)&&(this.id<50);
} 


//######################################################################
// check if vehicle vehObject is a special object (depot veh or traffic light)
//######################################################################

vehicle.prototype.isSpecialVeh=function(){
    return (this.id>=50)&&(this.id<200);
} 

//######################################################################
// check if vehicle vehObject is a regular/normal vehicle (car or truck)
//######################################################################

vehicle.prototype.isRegularVeh=function(){
    return (this.isPerturbed()||(this.id>=200))&&(this.type !== "obstacle");
} 


