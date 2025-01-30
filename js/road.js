

//####################################################################
// Creating reproducible versions for debugging purposes:
//(1) include <script src="js/seedrandom.min.js"></script> in html file
//    (from https://github.com/davidbau/seedrandom, copied locally)
//(2) set seedRandom=true; in control_gui.js
//####################################################################


//#############################################################
// road segment (link) incl physical vehicle dynamics
//#############################################################


/*
##########################################################
road segment (link) object constructor:
##########################################################

logic-geometrical properties (u,v):  
u=long coordinate [m] (increasing in driving direction
v=lateral coordinate[m] centered at road axis
lane=0 (left), ..., this.nLanes-1 (right)
vVeh=real-valued lane index
=> v=laneWidth*(this.veh[i].v-0.5*(nLanes-1));

connection to physical coordinates x (East), y (North) provided by
the functions traj_x, traj_y provided as cstr parameters

// id's defined mainly in vehicle.js and ObstacleTLDepot.js
// types: 0="car", 1="truck", 2="obstacle" (including red traffic lights)
// id<100:              special vehicles/road objects
// id=1:                ego vehicle
// id=10,11, ..49       disturbed vehicles 
// id=50..99            depot vehicles/obstacles (vehicle.isDepotObstacle())
// id=100..199          traffic lights (vehicle.isTrafficLight())
// id>=200:             normal vehicles and obstacles
// id>=200&&type!=="obstacle" regular vehicles (vehicle.isRegularVeh)
they are specially drawn and externally influenced from the main program
 
@param roadID:          integer-valued road ID
@param roadLen:         link length [m]
@param laneWidth:       lane width [m]
@param nLanes:          #lanes (replaced by roadWidth in mixed traffic)
@param traj:            [traj_x,traj_y] function arc length u -> (xPhys,yPhys)
@param densInitPerLane: initial linear density [veh/m/lane]
@param speedInit:       initial longitudinal speed [m/s]
@param fracTruck:   initial truck fraction [0-1]
@param isRing:          true if periodic BC, false if open BC

@return:                road segment instance

NOTICE all vehicles are constructed w/o specific models 
       (default longModel and LCModel defined for initialization), 
       so vehicles can be associated freely with models later on, e.g.
       to implement speed limits and other flow-cons bottlenecks

NOTICE2 (MT-2019-09): veh models individual copies if deepCopying=true
        (MT-2023-04): model shallow copies so heineous that 
                      I have eliminated them completely
*/


function road(roadID,roadLen,laneWidth,nLanes,trajIn,
	      densInitPerLane,speedInit,fracTruck,isRing,doGridding){

  if(seedRandom){Math.seedrandom(42);
		 console.log("in Math.seedrandom(42) road cstr");
  }
  
  //console.log("1. in road cstr: traj=",traj);
  this.roadID=roadID;
  this.roadLen=roadLen;
  this.taperLen=25; //!! purely graphical; only use in this.drawTaperRamp()

  this.laneWidth=laneWidth;
  this.boundaryStripWidth=0.3*this.laneWidth;

  this.nLanes=nLanes;
  this.exportString="";

  // driver v0 and a coeff of variation ("agility")

  this.driver_varcoeff=0.15; //!!! default; can be overridden
  
  // network related properties

  this.isRing=isRing;
  this.doGridding=(typeof doGridding === 'undefined') ? false : doGridding;

  this.isGame=((scenarioString==="RampMeteringGame")
	       ||(scenarioString==="RoutingGame"));

  //MT 2025-02: For inVehBufferInit=0, it takes long for the first inserts
  this.inVehBufferInit=0.8; 
  this.inVehBuffer=this.inVehBufferInit; // if>=1, updateBCup called
  this.iTargetFirst=0; // set by getTargetNeighbourhood: first veh in defined region

  // set by this.initMergeDiverge(..)
  // each array element is struct
  //{target: road, isMerge: true/false, uLast:u, toRight: true/false}
  
  this.mergeDivergeInfo=[];

  // set by this.initConnect()
  // each array element is struct
  //{targetID: id, targetNlanes: int, uSource: real, offsetLane: int,
  // toRight: true/false}

  this.connectInfo=[];     
 


  this.trafficLights=[]; // (jun17) introduce by this.addTrafficLight
                           // to model the traffic light->road operations.
                           // need separate array 
                           // since no virtual vehicles corresp. to green TL
                           // (all drawing is done by the 
                           // ObstacleTLDepot objects)


    // tactical and LC related global aspects

  this.waitTime=4;   // waiting time after passive LC to do an active LC
                       //similar value as default vehicle.dt_LC at cstr
  this.duTactical=150; // if >0 activate tactical changes 
                           // for mandat. LC
  this.uminLC=20;      // only allow lane changes for long coord u>uminLC 
  this.LCbanStart=1e6; // another LC ban (e.g. before intersections)
  this.LCbanEnd=1e6;   // anllow LC again (>uEndLC, after the intersection)

  this.setTrucksAlwaysRight=true; //!! relates to trucks at inflow
  this.padding=20;    // this.mergeDiverge: visibility extension
                        // for origin drivers to target vehs
                        // both sides of actual merge/diverge zone

  this.paddingLTC=20; // this.mergeDiverge if merge && prioOwn: visibility  
                        // extension for target drivers to origin vehs
                        // only upstream of merging zone
  this.drawAlternativeTrajectories=false;
  
    // drawing-related vatiables

  this.draw_scaleOld=0;
  this.nSegm=100;   //!! number of road segm=nSegm+1, not only drawing
  this.markVehsMerge=false; // for debugging
  this.drawVehIDs=false;// for debugging, activated in main program

  this.draw_x=[];  // arrays defined in the draw(..) method
  this.draw_y=[];
  this.draw_phi=[];
  this.draw_cosphi=[];
  this.draw_sinphi=[];

    // construct vehicle array
    // u=long logical coordinate; i=0: first vehicle=maximum u
    // =(n-1)/n*roadLen
    // lane or v is transversal coordinate

  this.veh=[];

  this.initRegularVehicles(densInitPerLane,fracTruck,fracScooter,speedInit);

    // formally define ego vehicle for external reference
    // if applicable, it will be attributed to one element of this.veh, 
    // in this.updateEgoVeh(externalEgoVeh), later on.


  this.egoVeh=new vehicle(0,0,0,0,0,"car"); // driver_varcoeff=0 per default


  this.traj=trajIn; 
  this.trajGrid=[];

  /*########################################################
   set of alternative trajectories including info
   each of the this.trajAlt[r] elements has the form
   {x: alternative trajectory_x, e.g., for turning vehicles,
    y: the same,
    roadID: filter vehicles containing this roadID in their routes,
    umin: minimum logical this.u coordinate for using this traj,
    umax: maximum logical this.u coordinate
   }
   if you want to use a trajectory function of another road at an offset
   use anonymous function such as 
   target.trajAlt=
   { x: function(u){return trajSource_x(u-uTarget+uSource);},
     y: function(u){return trajSource_x(u-uTarget+uSource);},
     roadID: sourceID
     umin: uTarget-duMerge,
     umax: uTarget
   }
  
   #########################################################*/
  
  this.trajAlt=[];
  

  this.randomValBCup=1; // for stochastic inflow timing

  this.xtab=[];    // only used if(this.doGridding) (user can distort roads)
  this.ytab=[];    // separate tables this.draw_x=[]; always defined/used
  this.xtabOld=[]; // tables before begin of user-change action
  this.ytabOld=[];



} // cstr


//######################################################################
// get vehicle type based on population structure
// fracTruck, fracOthers
//######################################################################

road.prototype.getAttributes=function(fracTruck, fracOthers){
  var others_frac=(typeof fracOthers==='undefined') ? 0 : fracOthers;
  var others_length=(typeof scooter_length==='undefined') ? 2.5 : scooter_length;
  var others_width=(typeof scooter_width==='undefined') ? 1.2 : scooter_width;
  var r=Math.random();
  var vehType=(r<fracTruck) ? "truck"
      : (r<fracTruck+others_frac) ? "others" : "car";
  var lengthOut=(vehType === "car") ? car_length
    :(vehType === "truck") ? truck_length:others_length;
  var widthOut=(vehType === "car") ? car_width
    :(vehType === "truck") ? truck_width:others_width;
  var attributes={type:vehType,
		  len: lengthOut,
		  width: widthOut
		 };
  if(false){
    console.log("road.getAttributes: r=",r," fracTruck=",fracTruck,
		" fracTruck+others_frac=",fracTruck+others_frac);
  }
  return attributes 
}





//######################################################################
// reset driver agility variation from default;
// need also to draw new realisations for all the regular vehicles
//######################################################################

road.prototype.setDriverVariation=function(driver_varcoeff){
  this.driver_varcoeff=driver_varcoeff;
  for(var i=0; i<this.veh.length; i++){
    if(this.veh[i].isRegularVeh()){
      this.veh[i].setDriverVariation(driver_varcoeff);
    }
  }
}

  
//######################################################################
// initialize road with prescribed density per lane and truck fraction
// all special vehicles (obstacles, traffic lights...) are retained, if
// they exist
//######################################################################

road.prototype.initRegularVehicles=function(densityPerLane,fracTruck,
					    fracScooter,
					    speedInit){
  if(seedRandom){Math.seedrandom(42);
		 console.log("in Math.seedrandom(42) road cstr");
  }


  var fracOthers=(typeof fracScooter === 'undefined') ? 0 : fracScooter;

  var nvehPlus=Math.floor(this.nLanes*this.roadLen*densityPerLane);
  var nVehOld=this.veh.length;
  var vehPlus=[];
  var iveh=0;
  var fracTruckRight=Math.min(this.nLanes*fracTruck,1);
  var fracTruckRest=(this.nLanes*fracTruck>1)
      ? ((this.nLanes*fracTruck-1)/(this.nLanes-1)) : 0;
  console.log("road.initRegularVehicles: fracTruckRight=",fracTruckRight," fracTruckRest=",fracTruckRest," this.nLanes=",this.nLanes);
  for(var i=0; i<nvehPlus; i++){

        // position trucks mainly on the right lane nLanes-1

    var u=(nvehPlus-i-1)*this.roadLen/(nvehPlus); //!!(nvehPlus+1)
    var lane=i%this.nLanes; // left: 0; right: nLanes-1

    var fracTruck=(lane===this.nLanes-1) ? fracTruckRight : fracTruckRest;

    // initRegularVehicles: vehTypes
    // vehAttr={type: vehType, len: length, width: width}
    var vehAttr=this.getAttributes(fracTruck, fracOthers);
    console.log("vehAttr=",vehAttr);
    var vehType=vehAttr.type;
    var vehLength=vehAttr.len;
    var vehWidth=vehAttr.width;

    var leaderInfo=this.findLeaderAtLane(u,lane);     // accesses this.veh
    var followerInfo=this.findFollowerAtLane(u,lane); // accesses this.veh
    var leader=(leaderInfo[0]) ? this.veh[leaderInfo[1]] : null;
    var follower=(followerInfo[0]) ? this.veh[followerInfo[1]] : null;
    var sLead=(leaderInfo[0]) ? leader.u-leader.len-u : 1000;
    var sFollow=(followerInfo[0]) ? u-vehLength-follower.u : 1000;

    // actually construct vehicles (this also defined id)
    // do not place new vehicles within obstacles, traffic lights etc

    if((sLead>2)&&(sFollow>2)){ 
      vehPlus[iveh]=new vehicle(vehLength, vehWidth,u,lane,
				0.8*speedInit,vehType,
				this.driver_varcoeff); // IC
     iveh++;
    }
  }

  // merge with already existing obstacles and other vehicle-like objects 
  // such as red traffic lights 

  for(var ivehplus=0; ivehplus<iveh; ivehplus++){
    this.veh[nVehOld+ivehplus]=vehPlus[ivehplus];
  }

  this.updateEnvironment(); // includes sorting
  this.writeVehicles();
}//initRegularVehicles





//######################################################################
// change number of lanes
//######################################################################

road.prototype.addOneLane=function(){
  this.nLanes++;  // initially empty

  // MT Bugfix  2018-04-23: obsolete? 

  /*
  for(var i=0; i<this.trafficLights.length; i++){
    var TL=this.trafficLights[i];
    if(TL.value=="red"){
      this.changeTrafficLight(TL.id,"green");
      this.changeTrafficLight(TL.id,"red");
    }
  }
*/
}


// need to eliminate vehicles on the to be deleted lane
// !! need to count backwards since array is changed in size during
// its traversal; otherwise, not all old this.veh.length vehs checked!

road.prototype.subtractOneLane=function(){

    for(var i=this.veh.length-1; i>=0; i--){ 
	console.log("road.subtractOneLane: old nLanes=",this.nLanes);
	if(this.veh[i].lane=== (this.nLanes-1)){
	    this.veh.splice(i,1); // !!!changeArray
	}
    }
    this.nLanes--; 
}






//######################################################################
// write/printVehicles/logVehicles display vehicle info
//######################################################################

road.prototype.writeVehicles=function(umin,umax) {
    console.log("\nin road.writeVehicles(): itime=",itime,
		" roadID=",this.roadID,
		" nVehicles=",this.veh.length,
		" roadLen=",this.roadLen);

    var uminLoc=(typeof umin!=='undefined') ? umin : 0;
    var umaxLoc=(typeof umax!=='undefined') ? umax : this.roadLen;

    for(var i=0; i<this.veh.length; i++){
	if((this.veh[i].u>=uminLoc)&&(this.veh[i].u<=umaxLoc)){
            console.log(" veh["+i+"].id="+this.veh[i].id
		   +"  type="+this.veh[i].type
		   +"  len="+this.veh[i].len
		   +"  u="+parseFloat(this.veh[i].u,10).toFixed(1)
		   +"  lane="+this.veh[i].lane
		   +"  v="+parseFloat(this.veh[i].v,10).toFixed(1)
		   +"  speed="+parseFloat(this.veh[i].speed,10).toFixed(1)
		   +"  acc="+parseFloat(this.veh[i].acc,10).toFixed(1)
		   +"  iLead="+this.veh[i].iLead
		   +"  iLag="+this.veh[i].iLag
		   +"  iLeadRight="+this.veh[i].iLeadRight
		   +"  iLagRight="+this.veh[i].iLagRight
		   +"  iLeadLeft="+this.veh[i].iLeadLeft
		   +"  iLagLeft="+this.veh[i].iLagLeft
		   +"");
	}
    }

} // writeVehicles


//######################################################################
// simple write vehicle info (umin,umax optional)
//######################################################################

road.prototype.writeVehiclesSimple=function(umin,umax) {
    console.log("\n\nIn road.writeVehiclesSimple(): roadID=",this.roadID,
		" nveh=",this.veh.length,
		" nLanes=",this.nLanes," itime=",itime,
		" time=",time.toFixed(2));

    var uminLoc=(typeof umin!=='undefined') ? umin : 0;
    var umaxLoc=(typeof umax!=='undefined') ? umax : this.roadLen;

    for(var i=0; i<this.veh.length; i++){
      if((this.veh[i].u>=uminLoc)&&(this.veh[i].u<=umaxLoc)){
	console.log(" veh["+i+"].type="+this.veh[i].type
		    +"  id="+this.veh[i].id
		    +"  u="+parseFloat(this.veh[i].u,10).toFixed(1)
		    +"  v="+parseFloat(this.veh[i].v,10).toFixed(1)
		    +"  lane="+this.veh[i].lane
		    +"  dvdt="+parseFloat(this.veh[i].dvdt,10).toFixed(2)
		    +"  speed="+parseFloat(this.veh[i].speed,10).toFixed(1)
		    +"  acc="+parseFloat(this.veh[i].acc,10).toFixed(1)
		    +"");
      }
  }
}


//######################################################################
// simple write vehicle info to file
//######################################################################


road.prototype.writeVehiclesSimpleToFile=function(filename) {

  console.log("\nin road.writeVehiclesSimpleToFile(): roadID=",this.roadID,
	      " filename=",filename);

  //console.log("road.exportString=\n",this.exportString);
  download(this.exportString, filename);  // download(.) in control_gui.js
  
}
 
//######################################################################
// update export string for writing vehicle data to file
// called in road.prototype.updateSpeedPositions
//######################################################################

road.prototype.updateExportString=function(){

  var rest=time/dt_export-Math.floor((time+0.0001)/dt_export);
  
  if(rest<dt-0.0001){
    for(var i=0; i<this.veh.length; i++){
      var heading=(this.veh[i].speed>1e-4)
	  ? this.veh[i].dvdt/this.veh[i].speed : 0;
      this.exportString=this.exportString+"\n"+time.toFixed(2)
        + "\t"+this.veh[i].id
        + "\t"+this.veh[i].u.toFixed(2)
        + "\t"+this.veh[i].v.toFixed(2)
        + "\t"+this.veh[i].speed.toFixed(2)
        + "\t\t"+heading.toFixed(2)
        + "\t"+this.veh[i].acc.toFixed(2)
        +"";
    }
  }
}
 


//######################################################################
// write simple speedlimit info
//######################################################################

road.prototype.writeSpeedlimits=function(umin,umax) {
  console.log("\nin road.writeSpeedlimits(): roadID=",this.roadID,
		" nveh=",this.veh.length,
		" nLanes=",this.nLanes," itime=",itime);

  var uminLoc=(typeof umin!=='undefined') ? umin : 0;
  var umaxLoc=(typeof umax!=='undefined') ? umax : this.roadLen;

    
  for(var i=0; i<this.veh.length; i++){
    if((this.veh[i].u>=uminLoc)&&(this.veh[i].u<=umaxLoc)){
      if(this.veh[i].isRegularVeh()){
	console.log(" veh["+i+"].type="+this.veh[i].type
		    +" id="+this.veh[i].id
		    +" type="+this.veh[i].type
		    +" u="+parseFloat(this.veh[i].u,10).toFixed(1)
		    +" speedlimit_kmh="
		    +formd0(3.6*this.veh[i].longModel.speedlimit)
		    +" speed="+formd(this.veh[i].speed)
		    +" v0="+formd(this.veh[i].longModel.v0)
		    +" acc="+parseFloat(this.veh[i].acc,10).toFixed(1)
		    +"");
      }
    }
  }
} // writeSpeedlimits


//######################################################################
// write very simple info for id range of vehicles
//######################################################################

road.prototype.writeVehiclesIDrange=function(idmin,idmax) {

    var uminLoc=(typeof umin!=='undefined') ? umin : 0;
    var umaxLoc=(typeof umax!=='undefined') ? umax : this.roadLen;

    for(var i=0; i<this.veh.length; i++){
	if((this.veh[i].id>=idmin)&&(this.veh[i].id<=idmax)){
	    var s=(i==0) ? 10000 : this.veh[i-1].u-this.veh[i-1].len-this.veh[i].u;
	    console.log("t=",parseFloat(dt*itime).toFixed(1),
			" veh",i,
			" type=",this.veh[i].type,
			" id=",this.veh[i].id,
			" roadID=",this.roadID,
			" u=",parseFloat(this.veh[i].u,10).toFixed(3),
			//" v=",parseFloat(this.veh[i].v,10).toFixed(1),
			//" lane=",this.veh[i].lane,
			//" dvdt=",parseFloat(this.veh[i].dvdt,10).toFixed(2),
			" s=",parseFloat(s).toFixed(3),
			" speed=",parseFloat(this.veh[i].speed,10).toFixed(3),
			" acc=",parseFloat(this.veh[i].acc,10).toFixed(3),
			"");
	}
    }
}


//######################################################################
// write the routes of the vehicles
//######################################################################

road.prototype.writeVehicleRoutes=function(umin,umax) {
    console.log("\nin road.writeVehicleRoutes: roadID=",this.roadID,
		" length=",parseFloat(this.roadLen).toFixed(1),
		" nveh=",this.veh.length,
		" itime=",itime, "\n",
		"  duTactical=",this.duTactical);

    var uminLoc=(typeof umin!=='undefined') ? umin : 0;
    var umaxLoc=(typeof umax!=='undefined') ? umax : this.roadLen;

    for(var i=0; i<this.veh.length; i++){
	var u=this.veh[i].u;
      if((u>uminLoc) && (u<umaxLoc)){ 
	  // &&(this.veh[i].route.length>0)){

	    console.log(" veh[",i,"].type=",this.veh[i].type,
		        "  id=",this.veh[i].id,
		        "  u=",parseFloat(this.veh[i].u,10).toFixed(1),
		        "  v=",parseFloat(this.veh[i].v,10).toFixed(1),
		        "  route=",this.veh[i].route,
			"  divergeAhead=",this.veh[i].divergeAhead,
		        "");
	}
    }
}

//######################################################################
// write all relevant veh-type obstacles derived from the depot vheicles
//######################################################################

road.prototype.writeDepotVehObjects=function(umin,umax){
  console.log("itime=",itime,
	      "in road.writeDepotVehObjects: roadID=",this.roadID,
	      " nveh=",this.veh.length);

  var uminLoc=(typeof umin!=='undefined') ? umin : 0;
  var umaxLoc=(typeof umax!=='undefined') ? umax : this.roadLen;

  for(var i=0; i<this.veh.length; i++){ 
    if((this.veh[i].isDepotObstacle()) || (this.veh[i].isTrafficLight())){
      var u=this.veh[i].u;
      if((u>uminLoc) && (u<umaxLoc) ){

        console.log("  veh["+i+"].type="+this.veh[i].type
		    +"  id="+this.veh[i].id
		    +"  u="+formd(this.veh[i].u)
		    +"  v="+formd(this.veh[i].v)
		    +"");
      }
    }
  }
}

//######################################################################
// write out the contents of this.trafficLights
//######################################################################

road.prototype.writeTrafficLights=function(umin,umax) {
  console.log("itime=",itime," in road.writeTrafficLights:",
	      " writing the road's operational TL objects",
	      " roadID=",this.roadID,
	      " nTL=",this.trafficLights.length);

  var uminLoc=(typeof umin!=='undefined') ? umin : -1000;
  var umaxLoc=(typeof umax!=='undefined') ? umax : this.roadLen;

  for(var i=0; i<this.trafficLights.length; i++){
    var u=this.trafficLights[i].u;
    if((u>uminLoc) && (u<umaxLoc) ){

      console.log("  i=",i,
		      "  id="+this.trafficLights[i].id,
		      "  u="+formd(this.trafficLights[i].u),
		      "  value="+this.trafficLights[i].value,
		        "");
    }
  }
}



//######################################################################
// write vehicle longmodel info
//######################################################################

road.prototype.writeVehicleLongModels=function(umin,umax) {
    console.log("\nin road.writeVehicleLongModels(): roadID=",this.roadID,
		" nveh=",this.veh.length,
		" itime="+itime);

    var uminLoc=(typeof umin!=='undefined') ? umin : 0;
    var umaxLoc=(typeof umax!=='undefined') ? umax : this.roadLen;

    for(var i=0; i<this.veh.length; i++){
      if((this.veh[i].u>=uminLoc)&&(this.veh[i].u<=umaxLoc)){
	//if(this.veh[i].id==210)
	console.log(" veh["+i+"].type="+this.veh[i].type
		    +"  id="+this.veh[i].id
		    +"  type="+this.veh[i].type
		    +"  u="+parseFloat(this.veh[i].u,10).toFixed(1)
		    +"  v="+parseFloat(this.veh[i].v,10).toFixed(1)
		    +"  speed="+parseFloat(this.veh[i].speed,10).toFixed(3)
		    +"  v0="+parseFloat(this.veh[i].longModel.v0).toFixed(3)
		   // +"  T="+parseFloat(this.veh[i].longModel.T).toFixed(1)
		   // +"  s0="+parseFloat(this.veh[i].longModel.s0).toFixed(3)
		  //  +"  a="+parseFloat(this.veh[i].longModel.a).toFixed(3)
		  //  +"  b="+parseFloat(this.veh[i].longModel.b).toFixed(3)
		    +"  QnoiseAccel="
		    +parseFloat(this.veh[i].longModel.QnoiseAccel).toFixed(3)
		    +"  vehicle-driverfactor="
		    +parseFloat(this.veh[i].driverfactor).toFixed(3)
		    +"  longmodel-driverfactor="
		    +parseFloat(this.veh[i].longModel.driverfactor).toFixed(3)
		   // +"  acc="+parseFloat(this.veh[i].acc).toFixed(3)
		    +"");
      }
  }
}



//######################################################################
// write vehicle LC model info
//######################################################################

road.prototype.writeVehicleLCModels=function() {
    console.log("\nin road.writeVehicleLCModels(): roadID=",this.roadID,
		" nveh=",this.veh.length,
		" itime="+itime);
    for(var i=0; i<this.veh.length; i++){
	console.log(" veh["+i+"].type="+this.veh[i].type
		    +" id="+this.veh[i].id
		    +" u="+parseFloat(this.veh[i].u,10).toFixed(1)
		    +" v="+parseFloat(this.veh[i].v,10).toFixed(1)
		    +" speed="+parseFloat(this.veh[i].speed,10).toFixed(1)
		    +" LCModel.bBiasRight="
		    +parseFloat(this.veh[i].LCModel.bBiasRight).toFixed(1));
                   // +" LCModel=",this.veh[i].LCModel); //DOS console
    }
}



//######################################################################
// write truck info including LC
//######################################################################

road.prototype.writeTrucksLC=function() {
    console.log("\nin road.writeTrucksLC(): nveh=",this.veh.length,
		" itime="+itime);
    for(var i=0; i<this.veh.length; i++){if(this.veh[i].type==="truck"){
	console.log(" veh["+i+"].type="+this.veh[i].type
		    +"  u="+parseFloat(this.veh[i].u,10).toFixed(1)
		    +"  v="+parseFloat(this.veh[i].v,10).toFixed(1)
		    +"  lane="+this.veh[i].lane
		    +"  speed="+parseFloat(this.veh[i].speed,10).toFixed(1)
		    +"  acc="+parseFloat(this.veh[i].acc,10).toFixed(1)
		    +"  LCModel.bBiasRight="
		    +parseFloat(this.veh[i].LCModel.bBiasRight).toFixed(1)
		    +"");
    }}
}



/**
#############################################################
(jun17) draw the traffic lights on the standard canvas "canvas"
#############################################################

@param imgRed,imgGreen: images of the complete red and green traffic light
*/




/*
#############################################################
(jun17) get nearest longitudinal coordinate of another road for a given 
longitudinal coordinate u of the road calling this method
#############################################################


@param  otherRoad: the road to get the nearest longitudinal coordinate from
@param  u: longitudinal coordinate of the calling road
@return the longitudinal coordinate of the other road nearest to u
*/

road.prototype.getNearestUof=function(otherRoad, u){
    var dist2_min=1e9;
    var xOwn=this.traj[0](u);
    var yOwn=this.traj[1](u);
    var uReturn=0;
    var duOther=otherRoad.roadLen/otherRoad.nSegm;
    for(var i=0; i<=otherRoad.nSegm; i++){
      var uOther=i*duOther;
      var dist2=Math.pow(xOwn-otherRoad.xtab[i],2)
	  + Math.pow(yOwn-otherRoad.ytab[i],2);
	if(dist2<dist2_min){
	    dist2_min=dist2;
	    uReturn=uOther;
	}
    }
    if(false){
	console.log("end road.getNearestUof: u=",u,
		    " this.roadLen=",this.roadLen,
		    " otherRoad.roadLen=",otherRoad.roadLen,
		    " xOwn=",xOwn, " yOwn=",yOwn,
		    " uReturn=",uReturn," dist=",Math.sqrt(dist2));
    }
    return uReturn;
}



/**
#############################################################
(jun17) get nearest vehicle to an external physical position
#############################################################


@param  xUser,yUser: the external physical position
@param  filterFun: (optional) restrict search to filterFun(veh)=true
        !! this.veh[i].filterFun() does not work!! need direct fun name!
@return [success flag, the nearest vehicle which is no obstacle, dist_min,i]

!! check if restriction to regular vehicles [vehicle.isRegularVeh()]
should be performed

*/
road.prototype.findNearestVehTo=function(xUser,yUser,filterFun){
    var dist2_min=1e9;
    var vehReturn;
    var success=false;
    var iReturn=-1;
    for(var i=0; i<this.veh.length; i++){
	var filterPassed=(typeof filterFun === 'undefined')
	   ? true : filterFun(this.veh[i]);

	//console.log("road.findNearestVehTo: i=",i,
	//	    " filterFun=",filterFun,
	//	    " filterFun(this.veh[i])=",filterFun(this.veh[i]));
	if(filterPassed){
	    var u=this.veh[i].u;
	    var dist2=Math.pow(xUser-this.traj[0](u),2)
	        + Math.pow(yUser-this.traj[1](u),2);
	    if(dist2<dist2_min){
	        success=true;
	        dist2_min=dist2;
	        vehReturn=this.veh[i];
		iReturn=i;
	    }
	}
    }
    if(false){
	console.log("end road.getNearestVehTo:",
		    " xUser=",xUser, " yUser=",yUser,
		    " i=",i,
                    " dist_min=",Math.sqrt(dist2_min)  );
    }
    return [success,vehReturn,Math.sqrt(dist2_min), iReturn];
}

/**
#############################################################
(jun17) get nearest distance of the road axis (center)
 to an external physical position
@return [distance in m, u in m, v in lanes]

Notice1: u discretized to width of road segments, typically about 10 m
see also this.get_xPix(u,v), this.get_yPix(u,v)

#############################################################
*/

road.prototype.findNearestDistanceTo=function(xUser,yUser){
    var dist2_min=1e9;
    var uReturn,dxReturn,dyReturn;
    for(var i=0; i<=this.nSegm; i++){
	var u=i*this.roadLen/this.nSegm;
	var dx=xUser-this.traj[0](u);
	var dy=yUser-this.traj[1](u);
	var dist2=dx*dx+dy*dy;
	if(dist2<dist2_min){
	    dist2_min=dist2;
	    uReturn=u;
	    dxReturn=dx;
	    dyReturn=dy;
	}
    }

    // determine sign of v: positive if (-cosphi,sinphi).dr>0

  var phiNorm=this.get_phi(uReturn,this.traj)
      -0.5*Math.PI; // angle in v direction
    var sign_v=(Math.cos(phiNorm)*dxReturn 
		+Math.sin(phiNorm)*dyReturn > 0) ? 1 : -1;
    var dist=Math.sqrt(dist2_min);
    var vPhys=sign_v*dist; // v parallel to distance vector
    var vLanes=vPhys/(this.laneWidth) +0.5*(this.nLanes-1);

    if(false){
	console.log("end road.findNearestDistanceTo:",
		    " roadID=",this.roadID,
		    " xUser=",xUser, " yUser=",yUser,
		    " dxReturn=",dxReturn,
		    " dyReturn=",dyReturn,
		    " dist=",dist,
		    " uReturn=",uReturn,
		    " phiNorm=",phiNorm,
		    " vPhys=",vPhys,
		    " vLanes=",vLanes
		   );
    }
    return [dist,uReturn,vLanes];
}




/*
#############################################################
find nearest regular leader or followers index at position u any lane
#############################################################

@param  longitudinal physical position
@return the nearest vehicle index to this position, regardless of lane 
        (index=-1 if none)
*/

road.prototype.findLeaderIndexAt=function(u){
    //console.log("in road.findLeaderIndexAt");

  var index=-1; // initialize for "no success"
  
  var i=0;
  while ((i<this.veh.length) && (this.veh[i].u>u)){
    if(this.veh[i].isRegularVeh()){
      index=i;
    }
    i++;
  }

  return index;
}

//################################################################
// nearest followers on any lane 
//################################################################

road.prototype.findFollowerIndexAt=function(u){
  var index=-1; // initialize for "no success"
  var i=this.veh.length-1;
  while ((i>=0) && (this.veh[i].u<u)){
    if(this.veh[i].isRegularVeh()){
      index=i;
    }
    i--;
  }
  return index;
}

/*
#############################################################
(aug17) find nearest regular leaders or followers 
at position u on a given lane
#############################################################

@param  longitudinal physical position
@return the nearest vehicle to this position, regardless of lane 
        (id=-1 if none)
*/

road.prototype.findLeaderAt=function(u){
    //console.log("in road.findLeaderAt");


    // initialize virt veh for "no success"

    var vehLead=new vehicle(0,0,0,0,0,"car"); // new necessary here![];
    vehLead.id=-1;


    // do the actual finding

    var i=0;
    while ((i<this.veh.length) && (this.veh[i].u>u)){
	if(this.veh[i].isRegularVeh()){
	    vehLead=this.veh[i];
	}
	i++; 
    }


    //if(vehLead.id==-1){
  if(false){
	console.log("road.findLeadersAt: warning: no leader found");
    }

    return vehLead;
}

//################################################################
// nearest followers on any lane (only use in stationary detectors)
//################################################################

road.prototype.findFollowerAt=function(u){

    //console.log("in road.findFollowerAt");


    // initialize virt veh for "no success"

    var vehFollow=new vehicle(0,0,0,0,0,"car"); // new necessary here!


    // do the actual finding

    var i=this.veh.length-1;
    while ((i>=0) && (this.veh[i].u<u)){
	if(this.veh[i].isRegularVeh()){
	    vehFollow=this.veh[i];
	}
	i--; 
    }

    if(vehFollow.id==-1){
      console.log("road.findFollowersAt: warning: no follower at position ",u,
		  " on any lane");
    }

    return vehFollow;
}



/*
#############################################################
(jun17) find nearest leader at position u on a given lane
#############################################################


@param  xUser,yUser: the external physical position
@return [success flag, index of nearest vehicle which is no obstacle]
        (index=-1 if no leader)
*/

road.prototype.findLeaderAtLane=function(u,lane){
    var success=false;
    var i=0;
    var iLead=-1;
    while ((i<this.veh.length) && (this.veh[i].u>u)){
	if(this.veh[i].lane===lane){
	    success=true;
	    iLead=i;
	}
	i++;
    }
   return [success,iLead];
}


/*
#############################################################
(sep19) find nearest follower at position u on a given lane
#############################################################


@param  xUser,yUser: the external physical position
@return [success flag, index of nearest vehicle which is no obstacle]
        (index=-1 if no follower)
*/

road.prototype.findFollowerAtLane=function(u,lane){
    var success=false;
    var i=this.veh.length-1;
    var iFollow=-1; 
    while ((i>=0) && (this.veh[i].u<u)){
	if(this.veh[i].lane===lane){
	    success=true;
	    iFollow=i;
	}
	i--;
    }
   return [success,iFollow];
}










 // detect the fucking NaN's 

road.prototype.testForNaN=function(){ // detect the fucking NaN's 
    for(var i=0; i<this.nSegm; i++){
	if(isNaN(this.xtab[i]) ||isNaN(this.ytab[i])){
	    console.log("!! i=",i," NaN's in xtab or ytab!!");
	}
    }
}



/**
#############################################################
micro-IC 
#############################################################

initialize the road (segment) with explicitely given single vehicles 
defined by arrays of the types, lengths etc that all need to have the
same number of elements (otherwise, an error is given)

@param types:   array of veh types (0="car", 1="truck", 2="obstacle")
@param lengths: array of veh lengths [m]
@param widths:  array of veh widths [m]
@param longPos: array of the init longitudinal positions of the veh front [m]
@param lanes:   array of the initial real-valued lanes (=v; 0=left, nLanes-1=right)
@param speeds:  array of the initial speeds [m/s]
@param iEgo:    (optional) index of the ego vehicle as defined in the arrays
@return:        void; (re-)defines the road's veh array
*/

road.prototype.initializeMicro=function(types,lengths,widths,
					longPos,lanesReal,speeds,iEgo){

    var nvehInit=types.length;
    if( (lengths.length!=nvehInit) || (widths.length!=nvehInit)
	|| (longPos.length!=nvehInit) || (lanesReal.length!=nvehInit)
	|| (speeds.length!=nvehInit)){
	console.log(
	    "road.initializeMicro: bad input: not all arrays have length",
	    nvehInit);
	return 0;
    }

    //empty vehicles array if not empty

    if(this.veh.length>0){this.veh.splice(0,this.veh.length);}

    // initializeMicro: add the new vehicles to the array

    for(var i=0; i<types.length; i++){

      // initializeMicro: vehTypes:
      // (no immediate intro of scooter/others needed)
        // !! later directly (if types internally = integer)
	var type=(types[i]===0) ? "car" :
	    (types[i]===1) ? "truck" : "obstacle";
	var lane=Math.round(lanesReal[i]);
        var vehNew=new vehicle(lengths[i],widths[i], 
			       longPos[i],lane, speeds[i],
			       type, this.driver_varcoeff); // ICsingle
	vehNew.v=lanesReal[i]; // since vehicle cstr initializes veh.v=veh.lane
	if(i===iEgo){
            vehNew.id=1;
	    this.egoVeh=vehNew;
	}

	this.veh.push(vehNew);
	//console.log("road.initializeMicro: vehNew.v=",vehNew.v);
    }

    // set up all neighborhood relations

    this.updateEnvironment(); // includes this.sortVehicles();

    // check

    if(false){
        console.log("road.initializeMicro: initialized with ", 
		    this.veh.length," vehicles");
	this.writeVehiclesSimple();
    }
}  //initializeMicro

//######################################################################
// update truck percentage by changing vehicle type of existing vehs
  // do not correct if minor mismatch 
  // since this can happen due to inflow/outflow
  // open roads: mismatchTolerated essentially any=1.0
  // ring: mismatchTolerated nonzero but small
//######################################################################

// global var longModelCar, -Truck taken from control_gui

road.prototype.updateTruckFrac=function(fracTruck, mismatchTolerated){
  if(this.veh.length>0){
    //console.log("road.updateTruckFrac: ID=",this.roadID," #vehs=",this.veh.length);
    this.updateEnvironment(); //needs veh[i].iLag etc, so actual environment needed
    var nActual=0;
    var nTruck=0;
    for (var i=0; i<this.veh.length; i++){
	if(this.veh[i].isRegularVeh()) nActual++;
	if(this.veh[i].type === "truck"){nTruck++;}
    }
    var nTruckDesired=Math.floor(nActual*fracTruck);
    var fracTruckReal=nTruck/nActual;  // int division gen. results in double: OK!

    // action if truck frac not as wanted; 
    // correct by one veh transformation per timestep

    if(Math.abs(fracTruckReal-fracTruck)>mismatchTolerated){
	var fracTruckTooLow=(nTruckDesired>nTruck);
	var newType=(fracTruckTooLow) ? "truck" : "car";
	var newLength=(fracTruckTooLow) ? truck_length : car_length;
	var newWidth=(fracTruckTooLow) ? truck_width : car_width;
	var newLongModel=(fracTruckTooLow) ? longModelTruck : longModelCar;
	var diffSpace=((fracTruckTooLow) ? -1 : 1)* (truck_length-car_length);
	var success=0; // false at beginning

        // find the candidate vehicle (truck or car) with the largest lag gap

	var candidateType=(fracTruckTooLow) ? "car" : "truck";
	var k=0;  // considered veh index

	if(fracTruckTooLow){// change cars->trucks on the right lane if possible
	  var maxSpace=0;
	  for(var lane=this.nLanes-1; lane>=0; lane--){if(!success){
	    for(var i=0; i<nActual; i++){
	      if( (this.veh[i].lane===lane)&&(this.veh[i].type === candidateType)){
	        var iLag= this.veh[i].iLag;
	        var s=this.veh[i].u-this.veh[iLag].u - this.veh[i].len;
	        if(iLag<i){s+=this.roadLen;}//periodic BC (OK for open BC as well)
		if(s>maxSpace){k=i; maxSpace=s;}
		success=(maxSpace>diffSpace);
	      }
	    }
	  }}
	}

	else{ // change trucks->cars: transform truck with smallest space 
	  var minSpace=10000;
	  for(var i=0; i<nActual; i++){
	    if(this.veh[i].type === candidateType){
	      success=1; // always true for trucks->cars if there is a truck
	      var iLag= this.veh[i].iLag;
	      var s=this.veh[i].u-this.veh[iLag].u - this.veh[i].len;
	      if( (iLag<i)&&(s<0) ){s+=this.roadLen;}//periodic BC (OK for open BC as well)
	      if(s<minSpace){k=i; minSpace=s;}
	    }
	  }
	}

        // actually do the transformation if no collision entails by it

	if(success){
	  this.veh[k].type=newType;
	  this.veh[k].len=newLength;
	  this.veh[k].width=newWidth;

	  this.veh[k].longModel.copy(newLongModel); // always deep copy!!

	  this.veh[k].longModel.driverfactor=this.veh[k].driverfactor; //!!
	}
    }
  }
}//updateTruckFrac



//######################################################################
// update vehicle density by adding vehicles into largest gaps
// or removing some randomly picked vehicles (one at a time)
//!only regular vehicles count, no special vehicles or obstacles!
//######################################################################

road.prototype.updateDensity=function(density){

  var fracOthers=(typeof fracScooter === 'undefined') ? 0 : fracScooter;

  var nDesired= Math.floor(this.nLanes*this.roadLen*density);
    var nActual=0;
    var nTotOld=this.veh.length;
    for (var i=0; i<this.veh.length; i++){
	if(this.veh[i].isRegularVeh()) nActual++;
    }

    if(nActual>nDesired){// too many vehicles, remove one per time step
        var r=Math.random();
        var k=Math.floor( this.veh.length*r);
	var rmCandidate=this.veh[k];
	if(rmCandidate.isRegularVeh()){
	  this.veh.splice(k,1); // !!!changeArray
	} 
    }

    // too few vehicles, generate one per time step in largest gap

    else if(nActual<nDesired){
	var maxSpace=0;
	var k=0; // considered veh index
	var success=false;
	var emptyLanes=false;

        // updateDensity: vehTypes initialize attributes of new vehicle 
        // (later overwritten in most cases)

	var laneNew=0;
        var uNew=0.5*this.roadLen
        var speedNew=0; // always overwritten

      // updateDensity: vehTypes
      // vehAttr={type: vehType, len: length, width: width}
      var vehAttr=this.getAttributes(fracTruck, fracOthers);
      var vehType=vehAttr.type;
      var vehLength=vehAttr.len;
      var vehWidth=vehAttr.width;


        // test if there are lanes w/o vehicles which will not be caught 
        // by main search for largest gap

	var nvehLane = []; 
	for (var il=0; il<this.nLanes; il++){nvehLane[il]=0;}
	for (var i=0; i<this.veh.length; i++){nvehLane[this.veh[i].lane]++;}
	//console.log("nveh="+this.veh.length);
	//for (var il=0; il<this.nLanes; il++){
	//    console.log("road.updateDensity: lane="+il+" #veh="+nvehLane[il]);
	//}
	for (var il=0; (il<this.nLanes)&&(!success); il++){
	    if(nvehLane[il]===0){
		success=true;
		emptyLanes=true;
		laneNew=il;
	    }
	}

        // if there are no empty lanes, search the largest gap

	if(!emptyLanes){
          for(var i=0; i<this.veh.length; i++){
	    var iLead= this.veh[i].iLead;
	    var s=this.veh[iLead].u - this.veh[iLead].len - this.veh[i].u;
	    if( (iLead>=i)&&(s<0) ){s+=this.roadLen;}// periodic BC
	    if(s>maxSpace){k=i; maxSpace=s;}
	  };
	  success=(maxSpace>car_length+2*this.veh[k].longModel.s0);
	}

        // actually add vehicles (no model adding needed)

	if(success){// otherwise, no veh added
	    if(!emptyLanes){
		uNew=this.veh[k].u+0.5*(car_length+maxSpace);
		if(uNew>this.roadLen){uNew -= this.roadLen;}  //periodic BC
		laneNew=this.veh[k].lane;
		speedNew=0.5*(this.veh[k].speed+this.veh[this.veh[k].iLead].speed);
	    }

	    var vehNew=new vehicle(vehLength,vehWidth,uNew,laneNew,
				   speedNew,vehType,
				   this.driver_varcoeff); //updateDensity

	  // add vehicle at position k  (k=0 ... n-1)
	  
	    if(emptyLanes){vehNew.speed=longModelTruck.v0;}
	    this.veh.splice(k,0,vehNew); //!!! changeArray
	}
    }
    // sort (re-sort) vehicles with respect to decreasing positions
    // and provide the updated local environment to each vehicle

    if(this.veh.length!=nTotOld){
	this.updateEnvironment(); // includes sorting
    }
} //updateDensity




//#####################################################
// sort vehicles into descending arc-length positions u 
//#####################################################

road.prototype.sortVehicles=function(){
    if(this.veh.length>1){
	this.veh.sort(function(a,b){
	    return b.u-a.u;
	})
    };
}




/*#####################################################
get info of location and kind of ramps inside a road
to be used for tactical acceleration and lane changing and drawing tapers
!!! see also updateModelsOfAllVehicles and adapt it
Tactical deceleration before diverges: 
updateModelsOfAllVehicles sets this.veh[i].longModel.alpha_v0 
LC: set this.veh[i].LCModel to some tactical predefined model
!!! check interaction with this.setLCModelsInRange(.))

@param targetRoads:    array of (references to) target links
@param isMerge:        boolean array of same length
@param uLast:          double array of last position to merge/diverge
@param toRight:        boolean array whether entering the road by LC to right
@return:   mergeDivergeInfo=array of structs set
//#####################################################
*/


road.prototype.initMergeDiverge=function(targetRoads,isMerge,
					 mergeDivergeLen, uLast, toRight){
  for(var ir=0; ir<targetRoads.length; ir++){
    
    this.mergeDivergeInfo[ir]={
      targetID: targetRoads[ir].roadID,
      targetNlanes: targetRoads[ir].nLanes,
      isMerge: isMerge[ir],
      mergeDivergeLen: mergeDivergeLen[ir],
      uLast:uLast[ir],
      toRight:toRight[ir]
    };
    if(false){
      console.log("\nin road.initMergeDiverge: this.mergeDivergeInfo["+ir
		  +"]=",this.mergeDivergeInfo[ir]);
    }
  }
}




/*#####################################################
get info of location and kind of connections (nodes) to other roads
to be used for tactical lane changing and drawing tapers
!!! see also updateModelsOfAllVehicles and adapt it

@param targetRoads:    array of (references to) target links
@param uSource:        array of the source positions (LC must be done there)
@param offsetLane:     laneIndex(target)-laneIndex(source) for same position
@param LCbias:         -1=toLeft, 0=neutral, 1=true
                       (-1/+1: always global bias;
                        neutral => bias on discontinuing lanes only)
@return:   connectInfo=array of structs
//#####################################################
*/

road.prototype.initConnect=function(targetRoads, uSource, 
				offsetLane, LCbias){
  for(var ir=0; ir<targetRoads.length; ir++){
    
    this.connectInfo[ir]={
      targetID: targetRoads[ir].roadID,
      targetNlanes: targetRoads[ir].nLanes,
      uSource:uSource[ir],
      offsetLane: offsetLane[ir],
      LCbias:LCbias[ir]
    };
    console.log("\nin road.initConnect: roadID="+this.roadID
		+", this.connectInfo["+ir+"]=",
		this.connectInfo[ir]);
  }
}




//#####################################################
// set vehicles in range to new CF models
// (useful for modeling flow-conserving bottlenecks)
//#####################################################

road.prototype.setCFModelsInRange=function(umin,umax,
					   longModelCar,longModelTruck){

  for(var i=0; i<this.veh.length; i++){
    var u=this.veh[i].u;
    if((u>umin)&&(u<umax)){

      // always deep copy //!!! for now, scooter models = car models
      if(this.veh[i].type==="car"){this.veh[i].longModel.copy(longModelCar);}
      if(this.veh[i].type==="others"){this.veh[i].longModel.copy(longModelCar);}
      if(this.veh[i].type==="truck"){
	this.veh[i].longModel.copy(longModelTruck);}


      this.veh[i].longModel.driverfactor=this.veh[i].driverfactor;//!!

    }
  }
}



//#####################################################
// set vehicles in range to new lane change models
// (useful for modeling local overtaking bans, 
// local necessity/desire to drive right etc)

// nextID is optional. If given, LC model changes only applied
// to vehicles whose routes contain this link ID
//#####################################################


road.prototype.setLCModelsInRange=function(umin,umax,
					   LCModelCar,LCModelTruck,nextID){
    
//  console.log("within road.setLCModelsInRange: nextID=",nextID," LCModelTruck=",LCModelTruck);
  for(var i=0; i<this.veh.length; i++){
    var routeOK=true; // default
    if(!(
      (typeof nextID === 'undefined')
	||(typeof this.veh[i].route === 'undefined'))){
      routeOK=this.veh[i].route.includes(nextID);
    }
    var u=this.veh[i].u;
    if(routeOK&&(u>umin)&&(u<umax)){
      if(this.veh[i].type==="car"){this.veh[i].LCModel.copy(LCModelCar);}
      if(this.veh[i].type==="others"){this.veh[i].LCModel.copy(LCModelCar);}
      if(this.veh[i].type==="truck"){this.veh[i].LCModel.copy(LCModelTruck);}
     // console.log("road"+this.roadID+".setLCModelsInRange:"
//		  +" nextID=",nextID," LCModelCar=",LCModelCar);
    }
  }
}


//#####################################################
// set vehicles in range to mandatory LC 
// (useful for non-routing related mandatory LC onramps (no offramps??!!!), e.g.
// onramps or before lane closings
// see also updateModelsOfAllVehicles
// see also setCFModelsInRange, setLCModelsInRange for uphill
//#####################################################

road.prototype.setLCMandatory=function(umin,umax,toRight){
  //console.log("in road.setLCMandatory");
  for(var i=0; i<this.veh.length; i++) if(this.veh[i].isRegularVeh()){
    var u=this.veh[i].u;
    if((u>umin)&&(u<umax)){
      this.veh[i].toRight=toRight;
      if(toRight){this.veh[i].LCModel.copy(this.LCModelMandatoryRight);}
      else{this.veh[i].LCModel.copy(this.LCModelMandatoryLeft);}
    }

    // !! do NOT reset to normal otherwise! 
    // side effects with other mandat regions!
    // updateModelsOfAllVehicles redefines the models at beg of each timestep 

  }
}





//#####################################################
/*
  functions for getting/updating the vehicle environment of a vehicle array 
  sorted into descending arc-length positions u (first veh has maximum u)

  vehicle indices iLead, iLag, iLeadLeft, iLeadRight, iLagLeft, iLagRight

  if i===0 (first vehicle) leader= last vehicle also for non-ring roads
  if i===nveh-1 (last vehicle) follower= first vehicle also for non-ring roads
  same for iLeadLeft, iLeadRight, iLagLeft, iLagRight
   !! should be caught by BC or by setting gap very large

  if only one vehicle on its lane, then iLead=iLag=i (vehicles identical)
  if no vehicle on right, left lanes, then iLeadRight=iLagRight=i, same left

  if no right lane for vehicle i, iLeadRight, iLagRight set to -10
  if no left lane for vehicle i, iLeadLeft, iLagLeft set to -10
 */
//#####################################################


  // get/update leader

road.prototype.update_iLead=function(i){
    var n=this.veh.length;
    var iLead=(i===0) ? n-1 : i-1;  //!! also for non periodic BC
    success=(this.veh[iLead].lane===this.veh[i].lane);
    while(!success){
	iLead=(iLead===0) ? n-1 : iLead-1;
	success=( (i===iLead) || (this.veh[iLead].lane===this.veh[i].lane));
    }
    this.veh[i].iLead = iLead;
}

     // get/update follower

road.prototype.update_iLag=function(i){
    var n=this.veh.length;
    var iLag=(i===n-1) ? 0 : i+1; //!! also for non periodic BC
    success=(this.veh[iLag].lane===this.veh[i].lane);
    while(!success){
	iLag=(iLag===n-1) ? 0 : iLag+1;
	success=( (i===iLag) || (this.veh[iLag].lane===this.veh[i].lane));
    }
    this.veh[i].iLag = iLag;
}


   // get leader to the right

road.prototype.update_iLeadRight=function(i){
    var n=this.veh.length;
    var iLeadRight;
    if(this.veh[i].lane<this.nLanes-1){
	iLeadRight=(i===0) ? n-1 : i-1;
	success=((i===iLeadRight) || (this.veh[iLeadRight].lane===this.veh[i].lane+1));
	while(!success){
	    iLeadRight=(iLeadRight===0) ? n-1 : iLeadRight-1;
	    success=( (i===iLeadRight) || (this.veh[iLeadRight].lane===this.veh[i].lane+1));
	}
    }
    else{iLeadRight=-10;}
    this.veh[i].iLeadRight = iLeadRight;
}

    // get follower to the right

road.prototype.update_iLagRight=function(i){
    var n=this.veh.length;
    var iLagRight;
    if(this.veh[i].lane<this.nLanes-1){
	iLagRight=(i===n-1) ? 0 : i+1;
	success=((i===iLagRight) || (this.veh[iLagRight].lane===this.veh[i].lane+1));
	while(!success){
	    iLagRight=(iLagRight===n-1) ? 0 : iLagRight+1;
	    success=( (i===iLagRight) || (this.veh[iLagRight].lane===this.veh[i].lane+1));
	}
    }
    else{iLagRight=-10;}
    this.veh[i].iLagRight = iLagRight;
}

    // get leader to the left

road.prototype.update_iLeadLeft=function(i){
    var n=this.veh.length;

    var iLeadLeft;
    if(this.veh[i].lane>0){
	iLeadLeft=(i===0) ? n-1 : i-1;
	success=((i===iLeadLeft) || (this.veh[iLeadLeft].lane===this.veh[i].lane-1));
	while(!success){
	    iLeadLeft=(iLeadLeft===0) ? n-1 : iLeadLeft-1;
	    success=( (i===iLeadLeft) || (this.veh[iLeadLeft].lane===this.veh[i].lane-1));
	}
    }
    else{iLeadLeft=-10;}
    this.veh[i].iLeadLeft=iLeadLeft;
}

    // get follower to the left

road.prototype.update_iLagLeft=function(i){
    var n=this.veh.length;
    var iLagLeft;

    if(this.veh[i].lane>0){
	iLagLeft=(i===n-1) ? 0 : i+1;
	success=((i===iLagLeft) || (this.veh[iLagLeft].lane===this.veh[i].lane-1));
	while(!success){
	    iLagLeft=(iLagLeft===n-1) ? 0 : iLagLeft+1;
	    success=( (i===iLagLeft) || (this.veh[iLagLeft].lane===this.veh[i].lane-1));
	}
    }
    else{iLagLeft=-10;}
    this.veh[i].iLagLeft=iLagLeft;
}


//#####################################################
// get/update environment iLead, iLag, iLeadLeft,... for all vehicles
//#####################################################
//!!!! (2022-01-07) bug if only one veh on lane, them iLead=i=iLag
road.prototype.updateEnvironment=function(){
  this.sortVehicles();
  for(var i=0; i<this.veh.length; i++){

        // get leader
	this.update_iLead(i);

        // get follower
	this.update_iLag(i);

        // get leader to the right (higher lane index)
	this.update_iLeadRight(i);

        // get follower to the right
	this.update_iLagRight(i);

        // get leader to the left (lower lane index)
	this.update_iLeadLeft(i);

        // get follower to the left
	this.update_iLagLeft(i);
  }
}




//######################################################################
// main calculation of accelerations 
// only vehicles with id>=100 <=> no externally controlled ego-vehicles 
//######################################################################

//!! TODO do a proper organisation when to apply this.updateEnvironment()
//!! TODO do a road.prototype.update combining several specific updates

road.prototype.calcAccelerations=function(){
    this.updateEnvironment(); //!! sometimes not initialized, just in case
    for(var i=0; i<this.veh.length; i++){
	var speed=this.veh[i].speed;
	var iLead= this.veh[i].iLead;
	if(iLead===-100){console.log("road.calcAccelerations: i=",i,
				    " iLead=",iLead," should not happen!! possibly this.updateEnvironment() missing!");}
	var s=this.veh[iLead].u - this.veh[iLead].len - this.veh[i].u;
	var speedLead=this.veh[iLead].speed;
	var accLead=this.veh[iLead].acc;
	if(iLead>=i){ // vehicle i is leader, for any BC iLead defined
	    if(this.isRing){s+=this.roadLen;} // periodic BC; accLead OK
	    else{s=10000;accLead=0;} // free outflow BC: virt veh 10km away
	}

	//if(this.roadID==10){console.log("i=",i," u=",this.veh[i].u," s=",s);}

        // obstacles: set acc=0 explicitely
        // (it may have truck model by this.updateModelsOfAllVehicles)
        // do not accelerate programmatically the ego vehicle(s)

	if(this.veh[i].id>1){ // no ego vehicles  
	    this.veh[i].acc =(this.veh[i].isRegularVeh()) // longit w/random
		? this.veh[i].longModel.calcAcc(s,speed,speedLead,accLead)
		: 0;
	}


        //!! ego vehicles: accelerations acc, lanes lane (for logic),
        // and lateral positions v (for drawing) 
        // imposed directly by road.updateEgoEgoVeh(externalEgoVeh) 
        // called in the top-level js; here only logging

	if(this.veh[i].id===1){
	    if(false){
		console.log("in road: ego vehicle: u=",this.veh[i].u,
			    " v=",this.veh[i].v,
			    " speed_u=",this.veh[i].speed,
			    "  acc_u=",this.veh[i].acc);
	    }
	}

    

      if(false){
      //if((this.veh[i].id==226)&&(itime==526)){
	//if(this.roadID==10){
	var veh=this.veh[i];
	console.log("after calcAccelerations: veh id=",veh.id,
		    "leader id=",this.veh[iLead].id,
		    "u="+veh.u.toFixed(1),
		    "lane="+veh.v,
		    "s="+s.toFixed(1),
		    "speed="+speed.toFixed(1),
		    "v0="+veh.longModel.v0.toFixed(1),
		    "speedLead="+speedLead.toFixed(1),
		    "acc="+this.veh[i].acc.toFixed(1),
		    "");
	}

    }
}


//#######################################################################
/** exchanges the information of an external control vehicle 
    (instance of EgoVeh in EgoVehControl.js) with the corresponding 
    vehicle of the road object and updates the kinematics of the ego vehicle
    since speed_v is no member variable, use dvdt/laneWidth for it 
    (speed===speed_u)

@param externalEgoVeh:  instance of the pseudo-class EgoVeh
@return: updates in the road.veh element with road.veh.id=1 in this order:
         - the longitudinal acceleration (directly)
         - the lateral acceleration as local variable (directly)
         - the physical longitudinal position u using the old long speed
         - the physical lat position v [unit laneWidth] 
           using the old lateral speed_v=dvdt*laneWidth
         - the lane (for logic),
         - the lane changing rate dvdt [lanes/s] and lat speed speed_v [m/s]
         - the long speed " speed" [m/s] using the new long acceleration
*/

road.prototype.updateEgoVeh=function(externalEgoVeh){

    // find the ego vehicle (its index changes all the time)

    var found=false;
    var iEgo=-1;
    for(var i=0; !found &&(i<this.veh.length); i++){
	if(this.veh[i].id===1){
	    iEgo=i;
	    found=true;
	}
    }
    if(iEgo===-1){
	console.log("warning: road.updateEgoVeh called"+
		    " although no ego vehicle exists; doing nothing");
	return;
    }

    this.egoVeh=this.veh[iEgo]; // for reference outside
    var ego=this.veh[iEgo];     // for saving typing

    // translate the road axis accelerations of the ego vehicle into 
    // logical accelerations au=acc and av of the controlled vehicle 
    // in the road.veh array by the road curvature

    var roadCurv=this.get_curv(ego.u);

    // following assumes road essentially to North
    // starting at x (East) coordinate x=0; 
    // get_phi=PI/2 if road to North and smaller if East component

    var xRoadAxis=this.traj[0](ego.u)-this.traj[0](0); 
    var dotxRoadAxis=(0.5*Math.PI-this.get_phi(ego.u,this.traj))*ego.speed; 


    // calculate logical accelerations
    // accLat=accel to logical increasing lane indices=acc to right
    // roadCurv>0 for left curves, therefore "+"
    //!! implement externalEgoVeh.latCtrlModel=1 and =0

    ego.acc=externalEgoVeh.aLong; // !! driveAngle |dvdt*laneWidth/speed|<<1
    var acc_v=(externalEgoVeh.aLat+roadCurv*ego.speed*ego.speed)
	/this.laneWidth; // [lanes/s^2]

    // calculate longitudinal dynamics directly by ballistic update 

    ego.u += Math.max(0,ego.speed*dt+0.5*ego.acc*dt*dt); // [m]
    ego.speed=Math.max(ego.speed+ego.acc*dt, 0.);        // =vu [m/s]

    // calculate lateral dynamics directly by ballistic update 
    // Watch out: coordinate v has unit laneWidth, not m! 

    if(externalEgoVeh.latCtrlModel===2){
        ego.v += ego.dvdt*dt+0.5*acc_v*dt*dt;        // [lanes] 
        ego.dvdt += acc_v*dt;
    }
    else{ // zero point at right lane = starting lane v=(nLanes-1)
        ego.v=(this.nLanes-1) + (externalEgoVeh.v-xRoadAxis)/this.laneWidth;
        ego.dvdt=(externalEgoVeh.vv-dotxRoadAxis)/this.laneWidth;
        //ego.dvdt=(externalEgoVeh.vv-0)/this.laneWidth;
	if(false){
	    console.log("road.updateEgoVeh: latCtrlModel=",
			externalEgoVeh.latCtrlModel,
			"ego.v=",ego.v,
			" ego.dvdt=",ego.dvdt);
	}
    }
    ego.lane=Math.round(ego.v);


    if(false){
	console.log("in road.updateEgoVeh:",
		    " time=",parseFloat(time).toFixed(2),
		    " dt=",parseFloat(dt).toFixed(2),
		    " laneWidth=",parseFloat(this.laneWidth).toFixed(1),
		    " acc=",parseFloat(ego.acc).toFixed(2),
		    " acc_v[m/s^2]=",parseFloat(acc_v).toFixed(2),
		    "\n         u=",parseFloat(ego.u).toFixed(2),
		    " v[laneWidth]=",parseFloat(ego.v).toFixed(2),
		    " lane=",ego.lane,
		    "\n         speedLong=",parseFloat(ego.speed).toFixed(2),
		    " vv=",parseFloat(vv).toFixed(2),
		    " dvdt=",parseFloat(ego.dvdt).toFixed(2)
		   );
	//this.writeVehiclesSimple();
    }
}// updateEgoVeh



//######################################################################
// main kinematic update (ballistic update scheme) for non-ego vehicles
// including ring closure if isRing
//######################################################################

// Notice on ego-vehicles: everything apart from ring closure 
// updated in this. updateEgoVeh


road.prototype.updateSpeedPositions=function(){

  // longitudinal and lateral position and speed update
  // for non-ego vehicles and non-obstacles

  for(var i=0; i<this.veh.length; i++){

    if( (this.veh[i].id!=1) && (this.veh[i].isRegularVeh())){



      // longitudinal positional with old speeds

      this.veh[i].u += Math.max(
	0,this.veh[i].speed*dt+0.5*this.veh[i].acc*dt*dt);

      // longitudinal speed update 

      this.veh[i].speed=Math.max(this.veh[i].speed+this.veh[i].acc*dt, 0);


    }


        // periodic BC closure

    if(this.isRing &&(this.veh[i].u>this.roadLen)){
      this.veh[i].u -= this.roadLen;
    }
  }

  this.updateEnvironment();// crucial!! includes this.sortVehicles();

  if(downloadActive){this.updateExportString();}
}



//######################################################################
// main lane changing routine (model MOBIL, now with politeness)
// toRight=true: tests/performs change to the right; otherwise to the left
// returns true if change took place
//######################################################################

road.prototype.changeLanes=function(allowRight, allowLeft){

  // (2023-04-14) the transitions between the roads
  // (BC, mergeDiverge, connect may have left some disorder  
  //this.updateEnvironment();//!!!!
  

  this.doChangesInDirection(1); // changes to right 
  this.doChangesInDirection(0); // changes to left 
}





road.prototype.doChangesInDirection=function(toRight){
  // this.updateEnvironment(); //!!!DOS, bisher auch n noetig
  var log=false;

  var testTime=(time>51.7)&&(time<52.3)&&(!toRight);//!!!
  //if((!toRight)&&testTime){this.writeVehiclesSimple(300,500);}//!!!

  
  //if(testTime){
  if(false){
    console.log("\nchangeLanes: before changes to the ",
		       ((toRight) ? "right" : "left"));
  }

  // outer loop over all vehicles of a road;
  // filter for regular vehicles and no LC bans

  for(var i=0; i<this.veh.length; i++){

    //!! (MT apr2023)
    // HEINEOUS ERROR: Defined MOBILOK twice; allowed LC w/o MOBIL
    // depending on history!!!
    // now for safety reset MOBILOK=false for each candidate anew
    
    
    var MOBILOK=false; 

    var beyondStart=(this.veh[i].u>this.uminLC);
    var outsideLCban=((this.veh[i].u<this.LCbanStart)
		      ||(this.veh[i].u>this.LCbanEnd));

    //if(this.roadID==2){
    if(false){
      console.log("roadID=",this.roadID,
		  " u=",this.veh[i].u.toFixed(2),
		  " roadLen=",this.roadLen.toFixed(2),
		  " LCbanStart=",this.LCbanStart,
		  " LCbanEnd=",this.LCbanEnd,
		  " beyondStart=",(beyondStart) ? "true" : "false",
		  " outsideLCban=",(outsideLCban) ? "true" : "false",
		  " regularVeh=",(this.veh[i].isRegularVeh())
		  ? "true" : "false",
		  "");
    }

    // MT 2023-04 optionally restrict LC by tactical considerations
    // to not change to a closed lane


    
    if(beyondStart && outsideLCban && (this.veh[i].isRegularVeh())
       &&(!(this.veh[i].LCbanRight&&toRight))
       &&(!(this.veh[i].LCbanLeft&&(!toRight))) )
    {
 
    //if(beyondStart && outsideLCban && (this.veh[i].isRegularVeh())){

      // test if there is a target lane 
      // and if last change is sufficiently long ago

      var newLane=(toRight) ? this.veh[i].lane+1 : this.veh[i].lane-1;
      var targetLaneExists=(newLane>=0)&&(newLane<this.nLanes);
      var lastChangeSufficTimeAgo=(this.veh[i].dt_afterLC>this.waitTime)
	  &&(this.veh[i].dt_lastPassiveLC>0.2*this.waitTime);

      if(false){ 
        console.log("road.doChangesInDirection: vehID= ",this.veh[i].id,
		 " time=",time," i=",i,
		  " targetLaneExists=",targetLaneExists,
		  " lastChangeSufficTimeAgo=",lastChangeSufficTimeAgo);
      }


      if(targetLaneExists && lastChangeSufficTimeAgo){

        var iLead=this.veh[i].iLead;
        var iLag=this.veh[i].iLag; // actually not used
        var iLeadNew=(toRight) ?this.veh[i].iLeadRight :this.veh[i].iLeadLeft;
        var iLagNew=(toRight) ? this.veh[i].iLagRight : this.veh[i].iLagLeft;

	// Somehow the vehicle order was not always clearly defined
	// (MT 2023-04) Cause found! Forgot this.updateEnvironment()
	// in mergeDiverge. Should now never happen.
	// left checking code just in case...
	
	if((typeof this.veh[iLead] === 'undefined')
	   ||(typeof this.veh[iLag] === 'undefined')
	   ||(typeof this.veh[iLeadNew] === 'undefined')
	   ||(typeof this.veh[iLagNew] === 'undefined')){
	  this.updateEnvironment();
          iLead=this.veh[i].iLead;
          iLag=this.veh[i].iLag; // actually not used
          iLeadNew=(toRight) ?this.veh[i].iLeadRight :this.veh[i].iLeadLeft;
          iLagNew=(toRight) ? this.veh[i].iLagRight : this.veh[i].iLagLeft;
	  console.log("in road.changeLanes: something went wrong, needed to reorder calling this.updateEnvironment(); check if forgot somewhere...");
	}

	// check if also the new leader/follower did not change recently

        if((this.veh[i].id!=1) // not an ego-vehicle
	 &&(iLeadNew>=0)       // target lane allowed (otherwise iLeadNew=-10)
	 &&(this.veh[iLeadNew].dt_afterLC>this.waitTime)  // lower time limit
	 &&(this.veh[iLagNew].dt_afterLC>this.waitTime)){ // for serial LC
      
         //console.log("changeLanes: i=",i," cond 2 passed");
          var acc=this.veh[i].acc;
          var accLead=this.veh[iLead].acc;
          var accLeadNew=this.veh[iLeadNew].acc; // leaders: exogen. for MOBIL
	  var speed=this.veh[i].speed;
	  var speedLeadNew=this.veh[iLeadNew].speed;
	  var sNew=this.veh[iLeadNew].u -this.veh[iLeadNew].len-this.veh[i].u;
	  var sLagNew= this.veh[i].u - this.veh[i].len - this.veh[iLagNew].u;
      
        // treat case that no leader/no veh at all on target lane
        // notice: if no target vehicle iLagNew=i set in updateEnvironment()
        //    => update_iLagLeft, update_iLagRight
      
	  if(iLeadNew>=i){ // if iLeadNew=i => laneNew is empty
	     if(this.isRing){sNew+=this.roadLen;} // periodic BC
	     else{sNew=10000;}
	  }
      
         // treat case that no follower/no veh at all on target lane

	  if(iLagNew<=i){// if iLagNew=i => laneNew is empty
	     if(this.isRing){sLagNew+=this.roadLen;} // periodic BC
	     else{sLagNew=10000;}
	  }
      
     
          // calculate MOBIL input

	  var vrel=this.veh[i].speed/this.veh[i].longModel.v0;
	  var accNew=this.veh[i].longModel.calcAccDet(
	    sNew,speed,speedLeadNew,accLeadNew);

          // reactions of new follower if LC performed
          // it assumes new acceleration of changing veh

	  var speedLagNew=this.veh[iLagNew].speed;
	 if(this.veh[iLagNew].longModel===undefined){
	    console.log("vehicle ",iLagNew,
		      " has no longModel! vehicle=",this.veh[iLagNew]);
	      this.writeNonregularVehicles(0,this.roadLen);
	 }
 	 var accLagNew 
	    =this.veh[iLagNew].longModel.calcAccDet(
	      sLagNew,speedLagNew,speed,accNew); 
      
         // final MOBIL incentive/safety test before actual lane change
         // (regular lane changes; for merges, see below)


	 //var log=(this.veh[i].type==="truck");
	  var log=false;
	 //var log=true;

	  MOBILOK=this.veh[i].LCModel.realizeLaneChange(
	    vrel,acc,accNew,accLagNew,toRight,log);
	  
 

          // only test output

	  if(false){
          // if(testTime&&(this.veh[i].id==257)){//!!!

	    console.log(
	      "!!!b time=",time.toFixed(2),
	      " this.veh.length=",this.veh.length,
	      " vehicle id",this.veh[i].id,
	    " u",this.veh[i].u,
	    " LCModel.realizeLaneChange:",
	    " acc=",acc.toFixed(3)," accNew=",accNew.toFixed(3),
	    " accLagNew=",accLagNew.toFixed(3)," toRight=",toRight,
	    " bThr=",this.veh[i].LCModel.bThr.toFixed(3),
	    " bBiasRight=",this.veh[i].LCModel.bBiasRight.toFixed(3),
	    " MOBILOK=",MOBILOK);

	    if(false){
	      var s=this.veh[iLead].u-this.veh[iLead].len-this.veh[i].u;
	      var accLead=this.veh[iLead].acc;
	      var speed=this.veh[i].speed;
	      var speedLead=this.veh[iLead].speed;
	      var accCalc=this.veh[i].longModel.calcAccDet( // within MOBIL
		 s,speed,speedLead,accLead);
	      console.log(
	         "details t=",time.toFixed(1),
	         " this.veh[i].longModel.noiseAcc=",
	         this.veh[i].longModel.noiseAcc.toFixed(3),
	         ":\n",
	         "  leadOld id: ",this.veh[iLead].id,
	         " leadNew:",this.veh[iLeadNew].id,
	         " lagNew:",this.veh[iLagNew].id,
		 "\n  u=",parseFloat(this.veh[i].u).toFixed(3),
		 "  s=",parseFloat(s).toFixed(3),
		 " speed=",parseFloat(speed).toFixed(3),
		 " speedLead=",parseFloat(speedLead).toFixed(3),
		 " accLead=",parseFloat(accLead).toFixed(3),
		 " acc=",parseFloat(this.veh[i].acc).toFixed(3),
		 " accNew=",parseFloat(accNew).toFixed(3),
		 //" accCalc=",parseFloat(accCalc).toFixed(3),
		 //"\n  longModel=",this.veh[i].longModel,
	         //"\n  veh[iLead]=",this.veh[iLead],
	         " MOBILOK=",MOBILOK,
		   ""
	      );
		//this.writeVehicles();
	    }
	  }
	}
    
    

	changeSuccessful=(this.veh[i].isRegularVeh())
	  &&(sNew>0)&&(sLagNew>0)&&MOBILOK;


        //!! MT 2019-09: prevent trucks to change to the left by force

	if((scenarioString=="OnRamp_BaWue")
	   ||(scenarioString=="roadworks_BaWue")){
	    if(changeSuccessful&&(this.veh[i].type==="truck")&&(!toRight)){
	      console.log("road.doChangesInDirection(): preventing truck by force to change to the left, check why this happens:\n vehicle=",this.veh[i]);
	      changeSuccessful=false;
	    }
	}


 	
	if(changeSuccessful){
	 
             // do lane change in the direction toRight (left if toRight=0)
	     //!! only regular lane changes within road; merging/diverging separately!

           this.veh[i].dt_afterLC=0;                // active LC
	   this.veh[iLagNew].dt_lastPassiveLC=0;   // passive LC
           this.veh[iLeadNew].dt_lastPassiveLC=0; 
	   this.veh[iLead].dt_lastPassiveLC=0; 
           this.veh[iLag].dt_lastLPassiveC=0; 

           this.veh[i].laneOld=this.veh[i].lane;
	   this.veh[i].lane=newLane;
	   this.veh[i].acc=accNew;
	   this.veh[iLagNew].acc=accLagNew;
 
 
           // update the local envionment implies 12 updates, 
           // better simply to update all ...
	 
	   this.updateEnvironment(); //includes this.sortVehicles();
	}
      }
    }
     
  }// outer iveh loop


}


//######################################################################
// functionality to connect two or more roads with optional conflicts 
//######################################################################

/*
* connectors only work with routes (set of road IDs) for each vehicle

* unlike mergings/divergings (segments connect in parallel),
  connectors connect segments pointwise/frontal. Often, but not
  always, end to beginning but generally from decision point
  uDecision to target point uTarget with no logical transition

* optically, the vehicles on the same logical road may have different
  trajectories selected by elements of the vehicle's route

* One road may have several connecting
  roads -> several connectors. The vehicle on the source road "picks"
  the right connector (1:1 relation) comparing the target id with its route
  If the route does not fit any target ID of any connector
  or if there is no
  route or no connector, the vehicle just vanishes (if BCdown() is called)
  or drives beyond the road trajectory (if not)

* Each lane of source connects to exactly one lane of target,
  e.g. 2->1 lanes, left lane closes: offsetLane=-1
  e.g. 2->1 lanes, right lane closes: offsetLane=0
  e.g. 1->2 lanes, new left lane: offsetLane=+1

* !!! Now only acceleration influenced if wrong lane. Lane changing 
  exclusively in the tactical lane change considerations at 
  road.updateModelsOfAllVehicles() before (here, accel. overridden)

* connectors may have one or more segments with conflicting traffic
  given in the argument as array [conflict0,conflict1,..]
  if there is no conflict, [] is passed and vehs need not to stop
  (they only watch the last vehs on each lane on 
  the target road), so a jam can pass the connector.

* If there is a possible conflict, vehicles stop at the stopping point
  !!! check if they can also decide earlier

* The conflict checks are first taken after having passed the decision
  point (a few meters upstream of the stopping point uSource) and, 
  if one check is negative, repeated in every timestep 
  until all checks are passed (inconsistent with above!!!)


@param targetRoad: where traffic flows to (source is the calling road)
                   only a single target for each connector
@param uSource:    Logical long coordinate where vehicles transit/exit to the
                   target road (often the downstream end)
@param uTarget:    connected coordinate of the target (often upstream end)
@param offsetLane: lanes are connected 1:1 offsetLane=-1 
                   if source lane 1 connected to target lane 0
                   (lane indices increase from left to right)
@param conflicts:  (optional) default none. 
                   [] (no conflict) or [conflict1,conflict2,...]
                   each conflict has the form described below
@param maxspeed:   (optional) the maxspeed at transition (default none)
@param targetPrio: (optional) if true, cautious and, if needed, stopping
                    (target vehs not influenced apart from conflicts) 
                    otherwise aggressive entering and target followers 
                    influenced

NOTE on prio: Not completely symmetric because own vehs have to decelerate
before entering C2 regardless of priority and target followers not
if they have priority. For complete symmetry, 
 - change origin and target of connect
 - if this leads to ending target, change road geometry to get 
   continuing target (e.g. double loop prio inner->outer loop: make outer loop
   continuous and inner loop "deviation")

NOTE2 on prio: With conflicts, only targetPrio=true makes sense

each conflict has the components
.roadConflict: the other road causing the potential conflict
.dest:       filters destinations for the external vehicles 
             possibly leading to a conflict. []=all, [0,3]: dest 0 and 3
.ucOther:    conflict point for the filtered external vehicles on other road
.ducExitOwn: difference to conflict point from entry in target-rd coords

 */



road.prototype.connect=function(targetRoad, uSource, uTarget,
				offsetLane, conflicts, maxspeed,
			       targetPrio){

	
  var duAntic=60;               // "approach braking zone"
  var uAntic=uSource-duAntic;   //  [uAntic,uDecide]

  var duDecide=10;              // "revertible decision zone"
  var uDecide=uSource-duDecide; //  [uDecide,uGo]
  
  var uGoFactor=1.2;            // "final decision zone" [uGo, uTransfer]
                                //  begins uGoFactor*s0 before uTransfer
 
  var duTransfer=dt*IDM_v0;     // to avoid vehicles leaving the  
                                // connect zone w/o connecting

  var bPrio=0.5;                // max braking decel of the prio target vehs
  var bSafe=4;                  // critical decel for reverting "go" decisions

  var time_maxGridlock=0.8;     // if LC-based gridlock, brutally force 
  var speed_gridlock=0.2;       // vehs out if these criteria apply


  var targetID=targetRoad.roadID;

  
  if(typeof conflicts === 'undefined'){conflicts=[];}
  var maxspeedImposed=(!(typeof maxspeed === 'undefined'));
  var targetHasPriority=(typeof targetPrio === 'undefined')
      ? false : targetPrio;

  
  if(false){
  //if(this.roadID==5){
    console.log("\n\nbegin road.connect: t="+time.toFixed(2),
	//	" first Veh=",((this.veh.length>0) ? this.veh[0].id : "none"),
		" this.roadLen="+this.roadLen.toFixed(1),
		" targetRoad.roadID="+targetRoad.roadID,
		" uSource="+uSource.toFixed(1),
		" uTarget="+uTarget.toFixed(1),
		" offsetLane="+offsetLane,
		" conflicts="+conflicts,
		" maxspeedImposed="+maxspeedImposed,
		" targetHasPriority="+targetHasPriority,
		"");
    if(false){this.writeVehiclesSimple();}
  }


  for(var iveh=0; iveh<this.veh.length; iveh++){// central vehicle loop

    //#########################################################
    // central debugging!!! also is copied to
    // "var log" in determineConflicts    
    //#########################################################

    //this.connectLog=false;
    this.connectLog=(this.veh[iveh].id==455);
    //this.connectLog=((this.veh[iveh].id==278)&&(time>75));
    //this.connectLog=(targetID==8);
    //this.connectLog=((this.veh[iveh].id==219)||(this.veh[iveh].id==224));
    //this.connectLog=((this.veh[iveh].id==228)&&true);
    //this.connectLog=(this.veh[iveh].id==225)||(this.veh[iveh].id==226);
    //this.connectLog=(this.veh[iveh].id==210)&&(targetID==3);
    //this.connectLog=((this.veh[iveh].id==230)||(this.veh[iveh].id==227));



    
    //#########################################################
    // (1) determine if vehicle is a candidate for this connection
    // and if so, determine some state variables
    //#########################################################


    // check if veh[iveh] is regular and in the influence region
    // of this connection (transfer at uSource, extend region by
    // duTransfer to control time discretisation granularity
    // !!! Heineous error: When first veh overtakes simultaneously
    // when exiting, order changed and next veh may be ignored in this
    // step (therefore, allow for 2 timesteps, 2*duTransfer, margin
    
    var inInfluenceRegion=((this.veh[iveh].isRegularVeh())
			   &&(this.veh[iveh].u>uAntic)
			   &&(this.veh[iveh].u<=uSource+2*duTransfer));

    // check if route fits to this connector (contains targetindex)
    // array.includes or (arrray.indexOf(targetID)>=0);
    
    var routeOK=(this.veh[iveh].route.includes(targetID));
     
    if(inInfluenceRegion && routeOK){

      // vehicle-related state variables
      
      var vehConnect=this.veh[iveh];
      var id=vehConnect.id;
      var u=vehConnect.u;
      var lane=vehConnect.lane;
      var v=vehConnect.v;
      var speed=vehConnect.speed;
      var s0=vehConnect.longModel.s0;

      // connect-related regions
      
      var sStop=uSource-u;      // should stop s0 upstream of uConnect
      var uGo=uSource-uGoFactor*s0;
      var C1=((u>uAntic)&&(u<=uDecide)); // braking zone
      var C2=((u>uDecide)&&(u<=uGo));    // reversible decision zone
      var C3=(u>uGo);                    // final go if conflicts resolved
      var C4=(u>uSource);                // signal to do the transition

      // decision-related variables (additionally vehConnect.tookGoDecision)
      
      var potentialConflictsExist=(conflicts.length>0);
      var conflictsExist=vehConnect.conflictsExist; // from previous step
      var laneContinues=((lane+offsetLane>=0)
			 &&(lane+offsetLane<targetRoad.nLanes));
      var gluedTogether=(laneContinues&&(!potentialConflictsExist)
			     &&(uTarget<0.0001));
      var noOwnLeader=(vehConnect.iLead>=iveh);
      


      // accelerations
      // (reduce accFree to reach limit maxspeed at uSource if applicable)
      
      var accOld=vehConnect.acc;
      var accStop=vehConnect.longModel.calcAccDet(sStop,speed,0,0);
      var accFree=vehConnect.longModel.calcAccDet(100000,speed,speed,0);
      if(maxspeedImposed){
	var ds=0.5*maxspeed*maxspeed/vehConnect.longModel.b;
	var s=(uSource-u)+ds;
	accFree=vehConnect.longModel.calcAccDet(s,speed,0,0);
      }
      var accConnect=accFree; // will be overwritten later if target leader
      var accTargetFlw=42; // implausible value for not really initialized

      if(this.connectLog){
	  var zoneStr=(C1) ? " in braking zone"
	      : (C2) ? " in reversible decision zone"
	      : (C3) ? " in final decision zone" : " about to transfer";
	  console.log("\nroad.connect: t="+time.toFixed(2),
		      "source="+this.roadID,
		      "target="+targetRoad.roadID,
		      "veh id="+id,
		     // "driverfactor=",vehConnect.driverfactor.toFixed(2),
		     // "IDM_v0=",IDM_v0.toFixed(1),
		     // "dt=",dt.toFixed(2),
		     // "duTransfer=",duTransfer.toFixed(1),
		      //" route="+vehConnect.route,
		      "in "+((C1) ? "C1" : (C2) ? "C2" : (C3) ? "C3" : "C4"),
		      "u="+u.toFixed(1),
		      "uAntic="+uAntic.toFixed(1),
		      "uDecide="+uDecide.toFixed(1),
		      "uGo="+uGo.toFixed(1),
		      "uSource="+uSource.toFixed(1),
		      "speed="+speed.toFixed(1),
		      "acc="+vehConnect.acc.toFixed(1),
		      //zoneStr,
		      //"\n              C1="+C1,
		      //"  C2="+C2," C3="+C3,
		      //" laneContinues="+laneContinues,
		      //" conflictsExist="+conflictsExist,
		      //" potentialConflictsExist="+potentialConflictsExist,
		      //" maxspeedImposed="+maxspeedImposed,
		      "");
      }

      
		    


      // ################################################################
      // (2) on a closing lane: decelerate to a stop while doing LC attempts
      // LC not controlled here but by road.updateModelsOfAllVehicles
      // except for forc-hacking out of a gridlock
      // ################################################################

      // [deleted all reverting wrong LC decisions because now implemented
      // in antic (if not working, old versions->revertDecisions)]
      

      if(!laneContinues){


	// !! (2a) resolve gridlock by force-hack
	// if vehicle is gridlocked for a sufficient time
	// move by force to the next link over the blocking vehicles

	if(speed<speed_gridlock){
	  vehConnect.dt_gridlock+=dt;

	  if(vehConnect.dt_gridlock>=time_maxGridlock){
	    console.log("==== veh"+vehConnect.id,
			"moved by force to new link"+targetRoad.roadID);
	    vehConnect.u=uSource+0.5*duTransfer; //!! influence
	    vehConnect.acc=accFree;              // !!influence
	    C4=true;
	    this.updateEnvironment();
	    vehConnect.dt_gridlock=0;
	  }
	}
	else{
	  vehConnect.dt_gridlock=0;
	}
      
	// (2b) do the regular action (LCbias and resetting acc
	// !!! test if LC related action needed; probably now done in
	// sourceroad.updateModelsOfAllVehicles()
	
	if(vehConnect.dt_gridlock<time_maxGridlock){

	  if(false){ 
	    var toRight=(lane+offsetLane<0);
	    var bBiasRight=((toRight) ? 1 : -1)*10;
	    vehConnect.LCModel.bBiasRight=bBiasRight;    // !! influence
	  }
      
	  vehConnect.acc=Math.min(accStop,accOld); // !! influence
	}
      }
      
  
      // ################################################################
      // (3) on a through lane, in any region
      // u in [uAntic, uSource+duTransfer] (may have own leader)
      // ################################################################

      if(laneContinues && noOwnLeader){

	// (3a) check if there are instantaneous leaders and followers 
	// on the target road if the source road were parallel to the target
	
	var uTargetInst=uTarget+u-uSource;  // instantaneous pos < uTarget
	var targetFlwInfo
	      = targetRoad.findFollowerAtLane(uTargetInst,lane+offsetLane);
	var targetFlwExists // no follower complication if road not left!
	      =targetFlwInfo[0]&&(this.roadID!=targetRoad.roadID)
	      &&(!(targetRoad.veh[targetFlwInfo[1]].type=="obstacle"));

	var iTargetFlw=targetFlwInfo[1];
	var uTargetFlw=(targetFlwExists)
	    ? targetRoad.veh[iTargetFlw].u: -1000000;
	var speedTargetFlw=(targetFlwExists) ?targetRoad.veh[iTargetFlw].speed : 0;
	var sTargetFlw=(targetFlwExists) 
	    ? uTargetInst-vehConnect.len-uTargetFlw : 1000000;

	var TargetLdrInfo
	        = targetRoad.findLeaderAtLane(uTargetInst,lane+offsetLane);
	var TargetLdrExists // same filter as follower
	      =TargetLdrInfo[0]&&(this.roadID!=targetRoad.roadID)
	      &&(!(targetRoad.veh[TargetLdrInfo[1]].type=="obstacle"));
	
	var iTargetLdr=TargetLdrInfo[1];
	var speedTargetLdr=(TargetLdrExists) ? targetRoad.veh[iTargetLdr].speed : 0;
	var uTargetLdr=(TargetLdrExists)
	      ? targetRoad.veh[iTargetLdr].u : +1000000;
	var lenTargetLdr=(TargetLdrExists)?targetRoad.veh[iTargetLdr].len : 0;
	var sTargetLdr=(TargetLdrExists)?uTargetLdr-lenTargetLdr-uTargetInst : 100000;

	if(this.connectLog){
	  console.log(
	    "   connect (3): through lane,",
	    "acc from calcAccelerations=", vehConnect.acc.toFixed(2),
	    "\n   connect (3a): TargetLdrID=",
	    ((TargetLdrExists) ? targetRoad.veh[iTargetLdr].id : "none"),
	    "sTargetLdr=",sTargetLdr.toFixed(1),
	    " followerID=",
	    ((targetFlwExists) ? targetRoad.veh[iTargetFlw].id : "none"),
	    "sTargetFlw=",sTargetFlw.toFixed(1),
	    "");
	}

	// (3b) //special case just glued together and no own leader
	// (no changed acceleration/action if there is own leader)

	if(gluedTogether){
	  if(TargetLdrExists){  // overwrite accConnect (preset with accFree)
	    accConnect=vehConnect.longModel.calcAccDet(
	      sTargetLdr,speed,speedTargetLdr,0); // with leader.acc !=0
	                                          // no par update possible);
	  }
	}
	
	  
        // (3c) in C1 and not gluedTogether:
	// possible stops ahead: decelerate
      
	if(C1 && (!gluedTogether)){
	  // nothing here
	  
	}


	
	// (3d) in C2||C3 and not gluedTogether:
	// determine entry condition and acceleration | no conflicts
	// make or revert the decision vehicle.tookGoDecision
	// with hysteresis
	//########################################################

	if((C2||C3) && (!gluedTogether)){

	  // (3d)(i) acceleration if target road is free 
	  // (accFree includes optional param speedmax if applicable)

	  if((!TargetLdrExists)&&(!targetFlwExists)){
	    vehConnect.tookGoDecision=true;
	    vehConnect.acc=accFree;//(should be already set)
	    if(this.connectLog){
	      console.log(
		"   connect (3d): in C2||C3, no leader or follower: acc=",
		vehConnect.acc.toFixed(2));
	    }
	  }

	  
	
	  // (3d)(ii) in C2||C3, true target follower at present
	  // update the most probable follower
	  // if subject speed< instantaneous follower speed
	
	  if(targetFlwExists&&(speed<speedTargetFlw)){
	
	    // determine entry time
	  
	    var tc=-speed/accFree
	      +Math.sqrt(Math.pow(speed/accFree,2)+2*(uSource-u)/accFree);

	    // recursively find anticipated follower assuming constant
	    // target-vehicle speeds

	    var anticipatedTargetFlwTheSame=(uTargetFlw+speedTargetFlw*tc<uTarget);
	    var newAnticipatedTargetFlw=(!anticipatedTargetFlwTheSame);

	    // no follower of actual target follower if iLag<=iTargetFlw
	    var iLag=targetRoad.veh[iTargetFlw].iLag;


	    //while(false){ // !omit anticipation of future leader/follower
	    while(newAnticipatedTargetFlw&&(iLag>iTargetFlw)){
	      iTargetFlw=targetRoad.veh[iTargetFlw].iLag; // recursion
	      uTargetFlw=targetRoad.veh[iTargetFlw].u; // new follower candidate
	      speedTargetFlw=targetRoad.veh[iTargetFlw].speed;
	      newAnticipatedTargetFlw=(uTargetFlw+speedTargetFlw*tc>uTarget);
	      iLag=targetRoad.veh[iTargetFlw].iLag;
	    }


	    if(!anticipatedTargetFlwTheSame){ // otherwise use initialisation
	      sTargetFlw=(uTarget-uTargetFlw) - (uSource-u) - vehConnect.len
		  - speedTargetFlw*tc; // !! antic
	    }

	    // If anticipated follower != actual follower then
	    // update sTargetFlw and update the leader data
	    // to that of the leader of new follower

	    if(!anticipatedTargetFlwTheSame){ // otherwise use initialisation
	      sTargetFlw=(uTarget-uTargetFlw) - (uSource-u) - vehConnect.len
		  - speedTargetFlw*tc; // !! antic
	      TargetLdrExists=true;
	      iTargetLdr=(targetRoad.veh[iTargetFlw].iLead);
	      uTargetLdr=targetRoad.veh[iTargetLdr].u;
	      speedTargetLdr=targetRoad.veh[iTargetLdr].speed;
	      lenTargetLdr=targetRoad.veh[iTargetLdr].len;
	      sTargetLdr=uTargetLdr-uTarget+(uSource-u)-lenTargetLdr+ speedTargetLdr*tc;
	    }
	    
	    if(this.connectLog){
	      console.log(
		"   connect (3d): in C2||C3 with follower and",
		"speed<speedFolloer: update leader/follower:",
		"\n   leaderID=",
		((TargetLdrExists) ? targetRoad.veh[iTargetLdr].id : "none"),
		"sTargetLdr=",sTargetLdr.toFixed(1),
		" targetFlwID=",
		((targetFlwExists) ? targetRoad.veh[iTargetFlw].id : "none"),
		"sTargetFlw=",sTargetFlw.toFixed(1));
	    }
	    
	  } // if(targetFlwExists)  in C2||C3 and not just glued togeter)

      	    
    
      

	  
	  // (3e) if target followers and/or leaders:
	  // make conditional hysteretic decideGo/decideRevert decision
	  // and from this make the actual vehConnect.tookGoDecision
	  
	  // Follower:
	  // 
	  // targetPrio decideGo                  revertGo
	  // yes        (accFl>-bPrio)            (accFl<-bIDM) &&      
	  //                                       (accStop>min(-bSafe,accFl))
	  // no         (accFl>-bIDM)             (accFl<min(-bSafe,accStop))
	  //
	  // Leader (independent of prio):
	  //
	  // (n.a.) &&(acc(subj,leader)>-bIDM)    ||(acc(subj,leader)<-bSafe)
	  //            
	  
	  
	  var decideGo=true; // conditional go if (!vehConnect.tookGoDecision)
	  var revertGo=false;// cond. revert if (vehConnect.tookGoDecision)

	
	  if(targetFlwExists){// then also in C2||C3, exclusive to (3b),(3c)
	    accTargetFlw=targetRoad.veh[iTargetFlw].longModel.calcAccDet(
	      sTargetFlw,speedTargetFlw,speed,accFree);
	    var IDMbTargetFlw=targetRoad.veh[iTargetFlw].longModel.b;

	    if(targetHasPriority){
	      decideGo=(accTargetFlw>=-bPrio);
	      revertGo=C2 && (accTargetFlw<-IDMbTargetFlw)
	        &&(accStop>Math.min(-bSafe, accTargetFlw));
	    }

	    else{ // own has prio but target cannot see => respect also here
	      //decideGo=(accTargetFlw>=-IDMbTargetFlw);
	      //revertGo=C2 && (accTargetFlw<-bSafe);
	      decideGo=true; //!!!
	      revertGo=false;
	    }
	  }

	  if(TargetLdrExists){ // here for !gluedTogether, slight double code
	    accConnect=vehConnect.longModel.calcAccDet(// overwrite accConnect
	      sTargetLdr,speed,speedTargetLdr,0);
	    decideGo=(decideGo && (accConnect>-vehConnect.longModel.b));
	    revertGo=revertGo || (C2&&(accConnect<-bSafe));
	  }

	  if(this.connectLog){
	    console.log(
	      "   connect (3e): in C2||C3:",
	      "decideGo=",decideGo," revertGo=",revertGo);
	  }




	  // ###############################################################
	  // (4) Handle conflicts (still (C2||C3) && (!gluedTogether))
	  // ###############################################################

	  if(potentialConflictsExist){// otherwise no action

	    // (4a) do not allow entering if target leader is too close
	    // to a conflict pt (even if vehConnect.tookGoDecision was true)
	    
	    var ducExitMax=0; // max dist between uTarget and conflict
	    for(var ic=0; ic<conflicts.length; ic++){
	      ducExitMax=Math.max(conflicts[ic].ducExitOwn,ducExitMax);
	    }
	    
	    if(uTargetLdr-lenTargetLdr-vehConnect.len-2*s0<ducExitMax){
	      vehConnect.tookGoDecision=false; // !! influence
	    }


	    //#################################################
	    vehConnect.conflictsExist  //!! influence
	      =this.determineConflicts(vehConnect,uSource,uTarget,
				       conflicts,targetRoad);
	    //#################################################
	  }

	
	  //##############################################################
	  // (5) make the actual decision based on the conditionals
	  // (C2||C3) && (!gluedTogether)
	  //##############################################################

	  // taking care of target traffic
	  
	  var goDecisionOld=vehConnect.tookGoDecision;
	  
	  if(goDecisionOld && revertGo){
	    vehConnect.tookGoDecision=false;
	  }
	  if((!goDecisionOld) &&decideGo){
	    vehConnect.tookGoDecision=true;
	  }

	  // taking care of conflicts

	  // final go can only become true, never again false
	  
	  vehConnect.finalGo=(vehConnect.finalGo
			      ||(C3 && (vehConnect.tookGoDecision)
				 && (!vehConnect.conflictsExist)));
	  
	  if(C2 && vehConnect.conflictsExist){// C2: revert positive decision
	    vehConnect.tookGoDecision=false;
	  }
	  if(C3 && (!vehConnect.finalGo)){
	    vehConnect.tookGoDecision=false;
	  }
	  
	  if(this.connectLog){
	    console.log(
	      "   connect (5) transforming conditionals to decision",
	      "goDecisionOld="+goDecisionOld,
	      "veh.tookDecision="+vehConnect.tookGoDecision);
	  }

	  
	}


	
      
	// ###############################################################
	// (6) determine accel (in laneContinues && noOwnLeader)
	// and, if (!targetHasPriority) also influence target vehs
	// regardless of veh.tookGoDecision is true
	// (after all, target has to wait)
	// ###############################################################
	
	/* checked: vehConnect.acc was on the rhs in laneContinues branch
	 => can assign it here for whole branch for clarity
        Note: if (!noOwnLeader), only own leader counts, nothing to do here

        number condition                                    acceleration
        ---------------------------------------------------------------
        (3b)   gluedTogether && TargetLdrExists             accConnect
        (3b)   gluedTogether && (!TargetLdrExists)          (includes accFree)
        (3c)   (!gluedTogether) && C1                       accStop
        (3d-4) (!gluedTogether) && (C2||C3)
               && veh.tookGoDecision                        accConnect
        (3d-4) (!gluedTogether) && (C2||C3)
               && (!veh.tookGoDecision)                     accStop
 	###############################################################*/


	if(gluedTogether){vehConnect.acc=accConnect;}
	if(!gluedTogether){
	  if(C1){vehConnect.acc=accStop;}
	  else{
	  //else if(C2||C3){
	    vehConnect.acc=(vehConnect.tookGoDecision)
	      ? accConnect
	      : accStop;
	  }
	}


	// then accTargetFlw defined
	
	if(targetFlwExists&&(!targetHasPriority)&&(C2||C3)){
	  targetRoad.veh[iTargetFlw].acc=accTargetFlw;    // !! influence
	  console.log("(6b): accTargetFlw="+accTargetFlw.toFixed(1));
	}
	

	
	if(this.connectLog){
	  console.log("   connect (6): final acceleration:",
		      "veh id="+vehConnect.id,
		      "laneContinues="+laneContinues,
		      //"route="+vehConnect.route," targetID="+targetID,
		      "uSource-u="+(uSource-u).toFixed(1),
		      "\n   speed="+vehConnect.speed.toFixed(1),
		      "accFree="+accFree.toFixed(1),
		      "accConnect="+accConnect.toFixed(1),
		      "accStop="+accStop.toFixed(1),
		      "final acc="+vehConnect.acc.toFixed(1),
		      "");
        }

      }// laneContinues==true


      // (7) Actual transfer (outside laneContinuous because
      // of forced hack to get rid of lane-route gridlock

      
      if((u>uSource)&&(this.roadID!=targetRoad.roadID)){
	if(this.connectLog){
	//if(vehConnect.id==210){
	  console.log("  connect (7): All previous actions drove the vehicle",
		      "over uSource => actual transfer");
	  }


	  // vehicleNeighborhood is deep copy=>do splice actions on original
	  // Array.splice(position, howManyItems, opt_addedItem1,...) 

	  if(false){
	    console.log("\nbefore splicing:"+
			" this.veh.length="+this.veh.length,
			" testVeh="+testVeh,
			" targetRoad.veh.length="+targetRoad.veh.length,
			"");
	    this.writeVehiclesSimple();
	    targetRoad.writeVehiclesSimple();
	  }


	 
	  // watch out that an array is returned by splice!
	  // splices away 1 vehicle at pos iveh (third arg would insert it)
	  var transferredVeh=(this.veh.splice(iveh,1))[0]; // !! changeArray
	  this.updateEnvironment();

          // transform state vars of transferred vehicle
	  transferredVeh.u=u+uTarget-uSource;
	  transferredVeh.lane=lane+offsetLane;
	  transferredVeh.laneOld+=offsetLane; // needed for lat dyn (paths.js)
	  transferredVeh.v=v+offsetLane;
	transferredVeh.tookGoDecision=true; // as initialization
	transferredVeh.finalGo=false; // as initialization
	
	  // following two settings to perform an immediate LC w/o past memory
          // if there is a single-lane target road
	  // (v changed in update_v_dvdt_optical in paths.js)
	  
	  if(targetRoad.nLanes==1){
	  //if(false){
	    transferredVeh.dt_afterLC=0; // otherwise, veh may change at once
	    transferredVeh.laneOld=transferredVeh.lane;
	  }

	  // "heal" vehicles besides the new road caused by forcing
	  // vehicle on this link to resolve gridlocks

	  var vehicleBesidesRoad=false;
	  if(transferredVeh.lane<0){
	    vehicleBesidesRoad=true;
	    transferredVeh.lane=0;
	  }
	  else if(transferredVeh.lane>=targetRoad.nLanes){
	    vehicleBesidesRoad=true;
	    transferredVeh.lane=targetRoad.nLanes-1;
	  }
	  if(vehicleBesidesRoad){
	    transferredVeh.laneOld=transferredVeh.lane;
	    transferredVeh.v=transferredVeh.lane; // needed for paths.js
	  }
	    
	  
	    
	  if(this.connectLog){
	  //if(true){
	    console.log(
	      "\n  ======================================================="+
	      "\n  t="+time.toFixed(2)," itime="+itime,
	      " transfer veh "+transferredVeh.id,
	      "from road "+this.roadID," u="+u.toFixed(1),
	      "lane="+lane," v="+v.toFixed(1),
	      "to road "+targetRoad.roadID,
	      "at u="+transferredVeh.u.toFixed(1),
	      "lane="+transferredVeh.lane,
	      "laneOld="+transferredVeh.laneOld,
	      "v="+transferredVeh.v.toFixed(1),
	      "\n  transferredVeh="+transferredVeh,
	      "\n  =======================================================");
	  }

	  //targetRoad.veh.unshift(transferredVeh); // add at beginning
	  //targetRoad.veh.push(transferredVeh); // add at end
	  
	  targetRoad.veh[targetRoad.veh.length]=transferredVeh;
	  targetRoad.updateEnvironment();
	  
	  
	  if(false){
	    targetRoad.writeVehiclesSimple();
	  }

	  
	}// if(u>uSource) => Action A5
	
	if(this.connectLog){
	  console.log("   exiting road.connect: itime="+itime,
		      "vehConnect.id="+vehConnect.id,
		      "speed="+vehConnect.speed.toFixed(1),
		      "acc="+vehConnect.acc.toFixed(1),
		      "");
	}

    }// in influence region and route OK and no own leader

  } // loop over all road vehicles

  } // end connect; end road.prototype.connect


/* #################################################################
 The actual determination of conflicts
 the vehConnect state vars are not changed (does calling routine)

@param vehConnect: vehicle to determine possible conflicts
@param uSource:    u where vehConnect leaves the origin road
@param uTarget:    Entry point on the target road (both u's needed 
                   for determining distance to conflict points)
@param conflicts:  see above "functionality to connect two or more roads"
                   and ../README_IntersectionsVarNetworks.txt
@param targetRoad: only needed for graphical debug to visualize own 
                   conflict point
 #################################################################
*/

road.prototype.determineConflicts=function(vehConnect, uSource, uTarget,
					   conflicts, targetRoad){

  // see also "connectLog=" above
  var log=this.connectLog;


  if(conflicts.length==0){return false;}

  var noConflictDetected=true; // each conflict makes this false
  var TTCdown=1.5; // min negative TTC for downstream conflict vehs
  var TTCup=4;   // min positive TTC for downstream conflict vehs
  var XTC=10;    // min bumper-to-bumper gap
  var smax=60;   // do not consider upstream veh further away

  var u=vehConnect.u;
  var speed=vehConnect.speed;

  if(log){
    console.log("\n====================================================="+
		"\nroad.determineConflicts for veh "+vehConnect.id,":"+
		"t="+time.toFixed(1));
  }

  for(var ic=0; (ic<conflicts.length)&&noConflictDetected; ic++){

    // remaining distance of the subject veh to collision point

    var ducExitOwn=conflicts[ic].ducExitOwn;
    var duOwn=(uSource-u) + ducExitOwn;//OK

    // expected time to reach collision point
    // calcAccDet since within road.connect

    var acc=vehConnect.longModel.calcAccDet(10000,speed,speed,0);
    var tc=-speed/acc+Math.sqrt(Math.pow(speed/acc,2)+2*duOwn/acc);

    // determine the existence of actual conflicts
    
    var xtc=-10000; //=gap s
    var vehsConflict=conflicts[ic].roadConflict.veh;
    var goOnCrit=(vehsConflict.length>0);

    if(log){
      console.log(
	"  check conflict"+ ic,"caused by road "+
	conflicts[ic].roadConflict.roadID,":"+
	"uSource-u="+ (uSource-u).toFixed(1),
	"ducExitOwn="+ ducExitOwn.toFixed(1),
	"duOwn="+duOwn.toFixed(1),
	"\n                                       speed="+
	speed.toFixed(1),
	"acc="+acc.toFixed(2),"tc="+tc.toFixed(1),
	"vehsConflict.length="+vehsConflict.length,
	"");
    }

     
    for (var iveh=0; goOnCrit; iveh++){
      var vehConflict=vehsConflict[iveh];


      var isCandidate=false;

      // check if route of candidate and
      // set of conflicting destinations have common index
      // NOTE that own OD is already filtered by network[ir].connect(..)
      // calling this
      
      if(vehConflict.isRegularVeh()){

	//all destinations of the conflicting road conflict
	
	if(conflicts[ic].dest.length==0){
	  isCandidate=true;
	  if(log){
	    console.log(
	    "  in conflicting veh loop: vehConflict.id="+
	    vehConflict.id,
	    "isCandidate="+isCandidate);
	  }
	}

	// only some conflicting road destinations conflict
        else{
	  
	  // find others destination 'D' by determining first the
	  //index of origin ('O') element of vehConflict (must exist)
	  
	  var indexOrigin
	      =vehConflict.route.indexOf(conflicts[ic].roadConflict.roadID);

	  // if no further tuern, origin=destination;
	  // otherwise, next route element
	  // !!!! will fail in larger networks if turn after this crossing
	  // here, common roads as road0 and road1 must not be allowed

	  var conflictDestID=(vehConflict.route.length==indexOrigin+1)
	      ? vehConflict.route[indexOrigin]
	      : vehConflict.route[indexOrigin+1];

	  if(conflicts[ic].dest.indexOf(conflictDestID)>=0){
	    isCandidate=true;
	  }

	  if(log){
	    console.log("  determineConflicts, checking candidates:"+
			"vehConflict.id="+vehConflict.id,
			"indexOrigin="+indexOrigin,
			"conflictDestID="+conflictDestID,
			"conflicts[ic].dest="+ conflicts[ic].dest,
			"isCandidate="+isCandidate);
	  }
	  
	}
      }

      
      if(isCandidate){
	var speedConflict=vehConflict.speed;
        var speedmax=Math.max(speed, speedConflict, 0.01);
	var ucOther=conflicts[ic].ucOther;
        var ducOtherVeh=ucOther-(vehConflict.u+speedConflict*tc);
	var subjIsLeader=(ducOtherVeh>0);
	xtc=(subjIsLeader)
	  ? ducOtherVeh-vehConnect.len  // >0 if no overlap
	  : ducOtherVeh+vehConflict.len; // <0 if no overlap
        var ttc=xtc/speedmax;
        noConflictDetected=(Math.abs(xtc)>XTC)&&((ttc>TTCup)||(ttc<-TTCdown));

        if(log){
	  console.log(
	  "      veh "+vehConnect.id,
	  ": conflicting veh ID:"+vehConflict.id,
	  " uOther="+vehConflict.u.toFixed(1),
	  " ucOther="+ucOther.toFixed(1),
	  " speedOther*tc="+(vehConflict.speed*tc).toFixed(1),
	  " ducOther_after_tc="+ducOtherVeh.toFixed(1),
	  "\n                                          xtc="+xtc.toFixed(1),
	  " ttc="+ttc.toFixed(1),
	  " noConflictDetected="+noConflictDetected,
	    " goOnCrit="+goOnCrit,
	    "");
	}
        if(log){
	  var xConflictOwn=targetRoad.traj[0](uTarget+ducExitOwn);
	  var yConflictOwn=targetRoad.traj[1](uTarget+ducExitOwn);
	  var xConflictOther=conflicts[ic].roadConflict.traj[0](ucOther);
	  var yConflictOther=conflicts[ic].roadConflict.traj[1](ucOther);
	  var dist2=Math.pow(xConflictOwn-xConflictOther,2)
	      +Math.pow(yConflictOwn-yConflictOther,2);
	  //if(targetRoad.roadID<2){
	  if(dist2>=16){
	    console.log(
	      "\nGraphics: vehConnect "+vehConnect.id,
	      "OD "+this.roadID,targetRoad.roadID,
	      "conflicts with road ID="+conflicts[ic].roadConflict.roadID,
	      "veh "+vehConflict.id,"having route="+vehConflict.route,
	      "\n    xConflictOwn (basic target traj)="+
	      xConflictOwn.toFixed(1),
	      "yConflictOwn="+yConflictOwn.toFixed(1),
	      "\n    xConflictOther                  ="+
	      xConflictOther.toFixed(1),
	      "yConflictOther="+yConflictOther.toFixed(1),
	      "duOwn(now)="+duOwn.toFixed(1),
	      "ducOtherVeh(now)="+(ucOther-vehConflict.u).toFixed(1),
	      "ducOther(tConflict)="+ducOtherVeh.toFixed(1),
	      "");
	  }
	}
	// nothing if the considered veh on conflicting road
	// has a nonconflicting route 	
	else{;}

      }// check if veh on conflicting road has a conflicting route 
	
      //!! must end loop at vehsConflict.length-1 since iveh++ in between!
      
      goOnCrit=((iveh<vehsConflict.length-1)&&(xtc<smax)
		&&(noConflictDetected));

    }// inner loop over vehs of conflicts[ic].roadConflict
  }// outer loop over the conflicts
  
  var conflictsExist=(!noConflictDetected);
  if(log){console.log("Leaving determineConflicts, conflictsExist="+
		      conflictsExist,
		      "\n=============================================\n\n");}
  return conflictsExist;

}//road.determineConflicts




//######################################################################
// functionality for merging and diverging to another road. 
//######################################################################
/*
In both cases, the road change is from the road calling this function
to the road in the argument list

Technically, there is not much 
difference between merge and diverge except for different flags,
that the target of diverge begins at diverge
that the source road ends at the end of merge 
while the source road of the diverge/target of merge  generally continues. 

Only the immediately neighboring lanes of the two roads 
interact at and very near to the merge/diverge zones:
specifically, the arrays originVehicles (only veh with veh.divergeAhead=true)
and targetVehicles interact

The rest is handled in the
strategic/tactical acceleration lane-change behaviour of the drivers set as
part of updateModelsOfAllVehicles() called in each timestep:
this sets 

 * veh.divergeAhead if the route of vehicles contains next off-ramp 
   in distance < duTactical

 * changes veh.LCModel to appropriate mandatory one if veh.divergeAhead

 * sets this.veh[i].longModel.alpha_v0 if veh.divergeAhead 
   (MT 2023-11) !!alpha_v0 just activated!

 * This is true for each lane => multi-lane diverges should be OK

If ignoreRoute=false, a diverge can only happen for vehicles with 
routes containing this offramp and not for other/undefined routes. 
Defaul: true for merging, false for diverging.
Set to true for 
interactive routing games ("routing by traffic lights" to be implemented).

If neither the changing vehicles have priority (prioOwn=false) 
nor the through-lane vehicles (prioOther=false), 
merging takes place depending on bSafe*

@param otherRoad: the road to which to merge or diverge
@param offset:  difference[m] in the arclength coordinate u 
                between new and old road
@param uBegin:  begin[m] of the merging/diverging zone in old-road coordinates
@param uEnd:    end[m] of the merging/diverging zone in old-road coordinates
                Notice: If merge, exclude virtual vehicle pos from u-range!
@param isMerge: if true, merge; otherwise diverge. 
@param toRight: direction of the merge/diverge.
@param ignoreRoute: (optional) if true, diverges take place 
                whenever MOBIL agrees (is always true for merge) 
@param prioOther: (optional) if true, respect the priority of the 
                target-lane (through-lane) vehicles (default: false)
@param prioOwn: (optional) if true, trespect the priority of the 
                own merging lane (default: false)

@return:        void. Both roads are affected!
*/


road.prototype.mergeDiverge=function(otherRoad,offset,uBegin,uEnd,
				     isMerge,toRight,ignoreRoute,
				     prioOther, prioOwn){

  // (0) parse parameters
  
  var loc_ignoreRoute=(typeof ignoreRoute==='undefined')
      ? false : ignoreRoute; // default: routes  matter at diverges
  if(isMerge) loc_ignoreRoute=true;  // merging must be always possible

  var loc_prioOther=(typeof prioOther==='undefined')
      ? false : prioOther;

  var loc_prioOwn=(typeof prioOwn==='undefined')
      ? false : prioOwn;
  
  if(loc_prioOwn&&loc_prioOther){
	console.log("road.mergeDiverge: Warning: prioOther and prioOwn"+
		    " cannot be true simultaneously; setting prioOwn=false");
	loc_prioOwn=false;
  }


  var log=false;
  //var log=(this.roadID==0);    
  //var log=(this.roadID==0)&&isMerge;    
  //var log=((this.roadID===10)&&(this.veh.length>0)&&(!isMerge));

  // visibility extension for orig drivers looking towards target vehs
  var padding=this.padding; 

  // visibility extension for target drivers towards orig vehs for LTC
  var paddingLTC=(isMerge&&loc_prioOwn) ? this.paddingLTC : 0;




    // (1) get neighbourhood
    // getTargetNeighbourhood also sets [this|otherRoad].iTargetFirst

  var uNewBegin=uBegin+offset;
  var uNewEnd=uEnd+offset;
  var originLane=(toRight) ? this.nLanes-1 : 0;
  var targetLane=(toRight) ? 0 : otherRoad.nLanes-1;

  var originVehicles=this.getTargetNeighbourhood(
	uBegin-paddingLTC, uEnd, originLane); // padding only for LT coupling!

  var targetVehicles=otherRoad.getTargetNeighbourhood(
	uNewBegin-padding, uNewEnd+padding, targetLane);

  var iMerge=0; // candidate of the originVehicles neighbourhood
  var uTarget;  // long. coordinate of this vehicle on the orig road


    // debug: color-code interacting vehicles 
    // and their different roles (to be specified later in this method)
    // !! notice: all markings need to be reverted in each simulation step of 
    // top-level routine by calling road.revertVehMarkings() for all roads

  if(this.markVehsMerge && isMerge){

    // mark both potentially interacting vehicles with color 1
    
    for(var i=0; i<originVehicles.length; i++){
      originVehicles[i].colorStyle=1;
    }
    for(var i=0; i<targetVehicles.length; i++){
      targetVehicles[i].colorStyle=1;
    }
  }

  if(log){
	console.log("\n\nin road.mergeDiverge: itime="+itime,
		    " ID="+this.roadID,
		    " targetVehicles.length="+targetVehicles.length,
		    " originVehicles.length="+originVehicles.length);
  }


  
  // (2) Both for merge and diverge: select changing vehicle (if any): 
  // only one at each calling; the first vehicle has priority!


  // (2a) immediate success if no target vehicles in neighbourhood
  // and at least one (real) origin vehicle: the first one changes

  var success=( (targetVehicles.length===0)&&(originVehicles.length>0)
		&& originVehicles[0].isRegularVeh()
		&& (originVehicles[0].u>=uBegin) // otherwise only LT coupl
		&& (loc_ignoreRoute
		    ||originVehicles[0].route.includes(otherRoad.roadID))
		&& originVehicles[0].divergeAhead);

  if(success){iMerge=0; uTarget=originVehicles[0].u+offset;}
  if(success||((originVehicles.length>0)
	       && originVehicles[0].isRegularVeh()
	       &&(originVehicles[0].id==540)
	      )){
    console.log("\nmergeDiverge (2a): testing origin veh id="
		+originVehicles[0].id +" success="+success);
  }

  

    // (2b) otherwise select the first suitable candidate of originVehicles

  else if(originVehicles.length>0){ 

        // initializing of interacting partners with virtual vehicles
        // having no interaction because of their positions
        // default models also initialized in the constructor

    var duLeader=1000; // initially big distances w/o interaction
    var duFollower=-1000;
    var leaderNew=new vehicle(0,0,uNewBegin+10000,targetLane,0,"car");
    var followerNew=new vehicle(0,0,uNewBegin-10000,targetLane,0,"car");


    if(log){console.log(" entering origVeh loop");}

    // loop over originVehicles for merging veh candidates

    for(var i=0;(i<originVehicles.length)&&(!success);i++){

      if(log){
		console.log(" i="+i,
			    " isRegularVeh="+originVehicles[i].isRegularVeh(),
			    " loc_ignoreRoute="+loc_ignoreRoute,
			    " originVehicles[i].divergeAhead="+
			    originVehicles[i].divergeAhead);
      }


      if(originVehicles[i].isRegularVeh()
	 && (originVehicles[0].u>=uBegin) // otherwise only LT coupl
	 &&(loc_ignoreRoute
	    ||originVehicles[0].route.includes(otherRoad.roadID)
	    ||originVehicles[i].divergeAhead) ){


	uTarget=originVehicles[i].u+offset;

              // inner loop over targetVehicles: search prospective 
              // new leader leaderNew and follower followerNew and get the gaps
              // notice: even if there are >0 target vehicles 
              // (that is guaranteed because of the inner-loop conditions),
              //  none may be eligible
              // therefore check for jTarget==-1

	var jTarget=-1;
	for(var j=0; j<targetVehicles.length; j++){
	  var du=targetVehicles[j].u-uTarget;
	  if( (du>0)&&(du<duLeader)){
		    duLeader=du; leaderNew=targetVehicles[j];
	  }
	  if( (du<0)&&(du>duFollower)){
		    jTarget=j; duFollower=du; followerNew=targetVehicles[j];
	  }
	  if(log){
		    console.log(" i="+i," j="+j," jTarget="+jTarget,
				" du="+du," duLeader="+duLeader,
				" duFollower="+duFollower);
	  }
	}


              // get input variables for MOBIL
              // qualifiers for state var s,acc: 
              // [nothing] own vehicle before LC
              // vehicles: leaderNew, followerNew
              // subscripts/qualifiers:
              //   New=own vehicle after LC
              //   LeadNew= new leader (not affected by LC but acc needed)
              //   Lag new lag vehicle before LC (only relevant for accLag)
              //   LagNew=new lag vehicle after LC (for accLagNew)

	var sNew=duLeader-leaderNew.len;
	var sLagNew=-duFollower-originVehicles[i].len;
	var speedLeadNew=leaderNew.speed;
	var accLeadNew=leaderNew.acc; // leaders=exogen. to MOBIL
	var speedLagNew=followerNew.speed;
	var speed=originVehicles[i].speed;

	var LCModel=(toRight) ? this.LCModelMandatoryRight
	    : this.LCModelMandatoryLeft;

	var vrel=originVehicles[i].speed/originVehicles[i].longModel.v0;

	var acc=originVehicles[i].acc;
	var accNew=originVehicles[i].longModel.calcAccDet( //MOBIL
	  sNew,speed,speedLeadNew,accLeadNew);
	var accLag=followerNew.acc;
	var accLagNew =originVehicles[i].longModel.calcAccDet(
	  sLagNew,speedLagNew,speed,accNew);


 

              // MOBIL and other discrete criteria for LC decisions
      
	var prio_OK=(!loc_prioOther)||loc_prioOwn
	    ||(!LCModel.respectPriority(accLag,accLagNew));

	var routeOK=
	MOBILOK=LCModel.realizeLaneChange(
		  vrel,acc,accNew,accLagNew,toRight,false);

	success=prio_OK && MOBILOK
		  && (originVehicles[i].isRegularVeh())
		  && (sNew>0) && (sLagNew>0);
	  
	if(success){iMerge=i;}

              // test: should only list reg vehicles with mergeAhead=true; 
              // check its number if suspicious happens with this var !!

	//if(success&&log){
	if(success||(originVehicles[i].id==540)){
	//if(success){
	      //if(true){
	  console.log("\nmergeDiverge (2b): testing origin veh id="
		      +originVehicles[i].id+" uTarget="+uTarget
		      +" divergeAhead="+originVehicles[i].divergeAhead);
	  //console.log("  sNew="+sNew+" sLagNew="+sLagNew);
	  //console.log("  speed="+speed +" speedLagNew="+speedLagNew);
	  //console.log("  acc="+acc
	//	      +" accNew="+accNew+" accLagNew="+accLagNew);
	  console.log("  duLeader="+duLeader+"  duFollower="+duFollower
		      +" sLagNew="+sLagNew
		      +" MOBILOK="+MOBILOK+" success="+success);
	}
	
      } // !obstacle
    }// merging veh loop
  }// else branch (there are target vehicles)


    //(3) only merge: realize longitudinal-transversal coupling (LTC)
    // exerted onto target vehicles if merge and loc_prioOwn


  if(isMerge && loc_prioOwn){

    if(this.markVehsMerge){
      for(var i=0; i<originVehicles.length; i++){
	originVehicles[i].colorStyle=2;
      }
    }
	
    // (3a) determine stop line such that there cannot be a grid lock for any
    // merging vehicle, particularly the longest vehicle
    

    var vehLenMax=9;
    var stopLinePosNew=uNewEnd-vehLenMax-2;
    var bSafe=4;

	// (3b) all target vehs stop at stop line if at least one origin veh
	// is follower and 
	// the deceleration to do so is less than bSafe
	// if the last orig vehicle is a leader and interacting decel is less,
	// use it
	// calcAccDet since within road.connect

    for(var j=0; j<targetVehicles.length; j++){
      // gap to stop for target veh
      var sStop=stopLinePosNew-targetVehicles[j].u; 
      var speedTarget=targetVehicles[j].speed;
      var accTargetStop
	  =targetVehicles[j].longModel.calcAccDet(sStop,speedTarget,0,0);
      var allOrigVehsAreLeaders=true;


      var iLast=-1;
      for(var i=originVehicles.length-1; (i>=0)&&(iLast==-1); i--){
	        if(originVehicles[i].isRegularVeh()){iLast=i;}
      }

      if((iLast>-1)&& targetVehicles[j].isRegularVeh()){
	var du=originVehicles[iLast].u+offset-targetVehicles[j].u;
	var lastOrigIsLeader=(du>0);
	if(lastOrigIsLeader){
	  var s=du-originVehicles[iLast].len;
	  var speedOrig=originVehicles[iLast].speed;
	  var accLTC
	      =targetVehicles[j].longModel.calcAccDet(s,speedTarget,
						      speedOrig,0);
	  var accTarget=Math.min(targetVehicles[j].acc,
				 Math.max(accLTC, accTargetStop));
	  if(accTarget>-bSafe){
	    targetVehicles[j].acc=accTarget;
	    if(this.markVehsMerge){targetVehicles[j].colorStyle=3;}
	  }
	}

	// if last orig not leading, stop always if it can be done safely
	
	else{ 
	  if(accTargetStop>-bSafe){
	    var accTarget=Math.min(targetVehicles[j].acc,accTargetStop);
	    targetVehicles[j].acc=accTarget;
	    if(this.markVehsMerge){targetVehicles[j].colorStyle=3;}
	  }
	}
		//if(this.roadID==7){
	if(false){
	  console.log("target id="+targetVehicles[j].id,
		      " iLast id="+originVehicles[iLast].id,
		      " lastOrigIsLeader="+lastOrigIsLeader,
		      " sStop="+parseFloat(sStop).toFixed(1),
		      " accTargetStop="+parseFloat(accTargetStop).toFixed(1),
		      " acc="+parseFloat(targetVehicles[j].acc).toFixed(1)
		     );
	}
      }

    }
  } // isMerge && loc_prioOwn

  //(4) if success, do the actual merging!

  if(success){// do the actual merging 
  //if(success&&routeOK){// DAS IST ES. Warum nicht gefiltert??!!!!

        //originVehicles[iMerge]=veh[iMerge+this.iTargetFirst] 

	var iOrig=iMerge+this.iTargetFirst;
	//if(false){
	if(true){
	  console.log(
	    "\n=========================================\n",
	    "mergeDiverge (4) Actual merging vehicle id "+this.veh[iOrig].id
		      //	+" of type "+this.veh[iOrig].type
	      +" from road "+this.roadID
	      +" to road ",+otherRoad.roadID
	//	+" from origin position "+this.veh[iOrig].u
	      //+" and origin lane"+originLane
	      //+" to target position "+uTarget
	    //+" and target lane"+targetLane
	  );
	  console.log(
	    " this.veh[iOrig].divergeAhead)="
	      +this.veh[iOrig].divergeAhead
	      +" routeOK="+
	      (this.veh[iOrig].route.includes(otherRoad.roadID))
	  );

	}

        var changingVeh=this.veh[iOrig]; //originVehicles[iMerge];
	var vOld=(toRight) ? targetLane-1 : targetLane+1; // rel. to NEW road
	changingVeh.u += offset;
	changingVeh.lane =targetLane;
	changingVeh.laneOld =vOld; // following for  drawing purposes
	changingVeh.v =vOld;  // real lane position (graphical)
	changingVeh.colorStyle=0;
	changingVeh.dt_afterLC=0;             // just changed
	changingVeh.divergeAhead=false; // reset mandatory LC behaviour

    // !!!changeArray
    
//####################################################################
    this.veh.splice(iOrig,1);// removes 1 chg veh from i=iOrig.
    otherRoad.veh.push(changingVeh); // appends changingVeh at last pos;
//####################################################################


    this.updateEnvironment();     // MT 2023-04: Forgot this;
                                  // => subtle errors later on in lane changes
    otherRoad.updateEnvironment();// includes otherRoad.sortVehicles()

  }// end do the actual merging
}// end mergeDiverge





//######################################################################
// get the number of regular vehicles (for a trigger to end games)
//######################################################################

road.prototype.nRegularVehs=function(){
    var nReg=0;
    for(var i=this.veh.length-1; i>=0; i--){
	if(this.veh[i].isRegularVeh()){nReg++;}
    }
    return nReg;
}


//######################################################################
// empty road of all regular vehicles
//######################################################################

road.prototype.removeRegularVehs=function(){
    for(var i=this.veh.length-1; i>=0; i--){
	if(this.veh[i].isRegularVeh()){this.veh.splice(i,1);}
    }
    //console.log("remaining number of special vehicles: "+this.veh.length);
}



//######################################################################
// downstream BC: drop at most one vehicle at a time (no action needed if isRing)
//######################################################################


road.prototype.updateBCdown=function(){
  if( (!this.isRing) &&(this.veh.length>0)){
    if(this.veh[0].u>this.roadLen){
      this.veh.splice(0,1);     // !!!changeArray
      this.updateEnvironment();
    }
  }
}

//######################################################################
// upstream BC: insert vehicles at total inflow Qin
// (only applicable if !isRing)
// route is optional parameter (default: route=[])
//######################################################################



road.prototype.updateBCup=function(Qin,dt,route){

  var fracOthers=(typeof fracScooter === 'undefined') ? 0 : fracScooter;

  // get deterministic dynamics not only for testing but also for games
  // after restart.
  // for some reason, this does not work at control_gui.myRestartFunction


  if((itime<=1)&&(this.isGame||seedRandom)){Math.seedrandom(42);
    console.log("road.updateBCup: itime=",itime," roadID=",this.roadID,
		" resetting this.randomValBCup",
		" scenarioString=",scenarioString);
    
					    this.randomValBCup=1;
  }
  
  var r1=Math.random();
  var r2=Math.random();

  if(false){
    console.log("in road.updateBCup: itime=",itime,
		" this.roadID=",this.roadID,
		" this.inVehBuffer=",this.inVehBuffer.toFixed(3),
		" this.randomValBCup=",this.randomValBCup.toFixed(3),
		" r1=",r1.toFixed(5)," r2=",r2.toFixed(5));
  }


  
  // select false for games
  var emptyOverfullBuffer=!this.isGame;
  var randomAmplitude=0.2; //!!this.randomValBCup in 1 +/-randomAmplitude


  this.route=(typeof route === 'undefined') ? [] : route; // handle opt. args

   //console.log("in road.updateBCup: inVehBuffer="+this.inVehBuffer);

  var v0_truck=Math.min(IDM_v0, speedL_truck);
  var T_truck=factor_T_truck*IDM_T;
  var smin=0.7*v0_truck*T_truck; // only inflow if largest gap at least smin
  var success=false; // false initially
  if(!this.isRing){
      this.inVehBuffer+=Qin*dt;
  }

  // no buffer >2 apart for games (then  emptyOverfullBuffer=false)

  if((emptyOverfullBuffer)&&(this.inVehBuffer>2)){this.inVehBuffer--;}

		    
  
  if(this.inVehBuffer>=this.randomValBCup){
    this.randomValBCup=1+randomAmplitude*(2*r1-1);

    if(false){
      console.log("  BCup: itime=",itime,
		  " this.roadID=",this.roadID," r1=",r1," r2=",r2,
		  "trying to insert vehicle: this.inVehBuffer=",
		  this.inVehBuffer.toFixed(3));
    }

    // updateBCup: vehTypes: get new vehicle characteristics
    // vehAttr={type: vehType, len: length, width: width}
    var vehAttr=this.getAttributes(fracTruck, fracOthers);
    var vehType=vehAttr.type;
    var vehLength=vehAttr.len;
    var vehWidth=vehAttr.width;

    var space=0; //available bumper-to-bumper space gap
    var lane=this.nLanes-1; // start with right lane
    if(this.veh.length===0){success=true; space=this.roadLen;}

    // if new veh is a truck, try to insert it at the rightmost lane "lane"
    // for some strange reason bug if "while(iLead>=0)": 
    // first truck stands if it is the first to enter right
      
    if((!success)&&(vehType==="truck")){
      var iLead=this.veh.length-1;
      while( (iLead>0)&&(this.veh[iLead].lane!=lane)){iLead--;}
      if(iLead==-1){success=true;}
      else{
	space=this.veh[iLead].u-this.veh[iLead].len;
	success=(space>smin);
      }
    }

    // MT jun19: proceed further depending on one of two strategies
    // this.setTrucksAlwaysRight=true
    //   => no other veh can enter of truck has no space on right
    // this.setTrucksAlwaysRight=false
    //   => trucks are tried to set to the right but not forcibly so
      


    // if((!success) && setTrucksAlwaysRight && (vehType==="truck"))
    // then success is terminally =false in this step
    // do not need to do any further attempts
      
    // version1 (new): set trucks forcedly on right lane(s),
    // otherwise block 
      
    if((!success) &&((!this.setTrucksAlwaysRight)||(vehType!="truck"))){
      var spaceMax=0;
      for(var candLane=this.nLanes-1; candLane>=0; candLane--){
	var iLead=this.veh.length-1;
	while( (iLead>=0)&&(this.veh[iLead].lane!=candLane)){
	  iLead--;
	}
	space=(iLead>=0)
	          ? this.veh[iLead].u-this.veh[iLead].len
		  : this.roadLen+candLane;
	if(space>spaceMax){
	          lane=candLane;
	          spaceMax=space;
	}
      }
      success=(space>=smin);
    }
 


    if(success){
      var longModelNew=(vehType==="truck") ? longModelTruck : longModelCar;
      var LCModelNew=(vehType==="truck") ? LCModelTruck : LCModelCar;
      var uNew=0;

      //!! MT 2019-09 hack since otherwise veh enter too fast 

      var v0New=0.9*Math.min(longModelNew.v0, longModelTruck.v0);
      var speedNew=Math.min(v0New, longModelNew.speedlimit,
				space/longModelNew.T);
      var vehNew=new vehicle(vehLength,vehWidth,uNew,lane,speedNew,vehType,
			    this.driver_varcoeff); //updateBCup

      vehNew.longModel=new ACC(); vehNew.longModel.copy(longModelNew);

      if(testNewModel){
	vehNew.longModel=new CACC(); vehNew.longModel.copy(longModelNew);
      }
      vehNew.LCModel=new MOBIL(); vehNew.LCModel.copy(LCModelNew);

      
      vehNew.longModel.driverfactor=vehNew.driverfactor; //!!

      vehNew.route=this.route;
      //console.log("road.updateBCup: vehNew.route="+vehNew.route);


      //!! define ego vehicles for testing purposes

      if(false){
	      var percEgo=5;
	      if(vehNew.id%100<percEgo){vehNew.id=1;}
      }

      // add vehicle after pos nveh-1
      this.veh.push(vehNew);  // !!!changeArray
      this.updateEnvironment();
      this.inVehBuffer -=1;
      if(false){
	console.log("  BCup: itime=",itime," roadID=",this.roadID,
		    " successfully inserted ",vehType,
		    " this.inVehBuffer=",
		    this.inVehBuffer);
      }
		   
    }
  }
}

//######################################################################
// get target vehicle neighbourhood/context for merging of other roads
// returns targetVehicles, an array of all vehicles on the target lane 
// inside the arclength range [umin, umax].
// !! Also sets iTargetFirst, the first vehicle (smallest i) within range
// does not take care of specialities of ring roads
// => set "stitch" of ring road far away from merges
//######################################################################

road.prototype.getTargetNeighbourhood=function(umin,umax,targetLane){
    var targetVehicles=[];
    var iTarget=0;
    var firstTime=true;
    //console.log("getTargetNeighbourhood:");
    for (var i=0; i<this.veh.length; i++){
	//console.log("i="+i," nveh="+this.veh.length," u="+this.veh[i].u);
	if( (this.veh[i].lane===targetLane)&&(this.veh[i].u>=umin)&&(this.veh[i].u<=umax)){
	    if(firstTime===true){this.iTargetFirst=i;firstTime=false;}
	    targetVehicles[iTarget]=this.veh[i];
	    iTarget++;
	}
    }
    if(false){
        console.log("in road.getTargetNeighbourhood(umin="+umin+"+ umax="+umax
		  +"+ targetLane="+targetLane+")");
	for(iTarget=0; iTarget<targetVehicles.length; iTarget++){
	    console.log("targetVehicles["+iTarget+"].u="+targetVehicles[iTarget].u);
	}
    }
    return targetVehicles;
}


/*####################################################
 distribute model parameters updated from  GUI to all vehicles

  * LCModelMandatory and longModelCar/Truck defined in control_gui.js

  * LCModelMandatory and LCModelTactical will be divided into ...Right 
    and ...Left her and all derived (deep-copy) from LCModelMandatory.
    The same with longModelTacticalCar/Truck

  * Mandatory models apply to all vehicles in a certain range, tactical
    models only for the vehicles with corresponding routes in a certain range

  * Here, the appropriate models  will be deep-copied to the vehicles

  * tactical accelerations (decelerations) for diverging near the offramp
    sets this.veh[i].longModel.alpha_v0 to increasingly low vals near the 
    last diverge possibility (not to zero -> vehicles can miss the diverge)
    (MT 2023-11) !!alpha_v0 just activated!

  * tactical lane changes for onramps (only relevant for multilane)
    and offramps (always relevant). 
    set this.veh[i].LCModel to some tactical predefined model
    !! Unconditional LCbias for the appropriate routing, may be less than
    optimal for multilane diverges. If so, use laneInfo=[] as in the
    tactical connect preparation

  * With the new tactical model setting in preparation to connect
    virtual standing vehs at the lane ends no longer needed

  * if updateModelsOfAllVehicles does not work for certain situations, 
    override it by calling
    road.setLCMandatory(.) or road.setLCModelsInRange(.) 
    in the main program after this

//####################################################
*/

road.prototype.updateModelsOfAllVehicles=function(longModelCar,longModelTruck,
						  LCModelCar,LCModelTruck,
						  LCModelMandatory){

  
  this.longModelTacticalCar=new ACC(longModelCar.v0,longModelCar.T,
				      longModelCar.s0,longModelCar.a,
				      longModelCar.b);
  this.longModelTacticalTruck=new ACC(longModelTruck.v0,longModelTruck.T,
				      longModelTruck.s0,longModelTruck.a,
				      longModelTruck.b);

  if(testNewModel){
    this.longModelTacticalCar=new CACC(longModelCar.v0,longModelCar.T,
				      longModelCar.s0,longModelCar.a,
				       longModelCar.b, 1, 0.1);
    this.longModelTacticalTruck=new CACC(longModelTruck.v0,longModelTruck.T,
				      longModelTruck.s0,longModelTruck.a,
					 longModelTruck.b, 1, 0.1);
  }
    

  
  // reference issues nasty!!! (??LCModel.copy works??)
  
  var LCModelMandatoryLoc 
	=new MOBIL(LCModelMandatory.bSafe, LCModelMandatory.bSafeMax,
		   LCModelMandatory.p,
		   LCModelMandatory.bThr, LCModelMandatory.bBiasRight);

  
    this.LCModelMandatoryRight
	=new MOBIL(LCModelMandatoryLoc.bSafe, LCModelMandatoryLoc.bSafeMax,
		   LCModelMandatoryLoc.p,
		   LCModelMandatoryLoc.bThr, LCModelMandatoryLoc.bBiasRight);
    this.LCModelMandatoryLeft
	=new MOBIL(LCModelMandatoryLoc.bSafe, LCModelMandatoryLoc.bSafeMax,
		   LCModelMandatoryLoc.p,
		   LCModelMandatoryLoc.bThr, -LCModelMandatoryLoc.bBiasRight);

    this.LCModelTacticalRight
	=new MOBIL(LCModelMandatoryLoc.bSafe, LCModelMandatoryLoc.bSafeMax,
		   LCModelMandatoryLoc.p,
		   LCModelMandatoryLoc.bThr, LCModelMandatoryLoc.bBiasRight);
    this.LCModelTacticalLeft
	=new MOBIL(LCModelMandatoryLoc.bSafe, LCModelMandatoryLoc.bSafeMax,
		   LCModelMandatoryLoc.p,
		   LCModelMandatoryLoc.bThr, -LCModelMandatoryLoc.bBiasRight);


  // normal acc and LC: 
  // distributed to the vehicles depending on car/truck here
  // !!! new scooters have for now car models

  for(var i=0; i<this.veh.length; i++){
    if(this.veh[i].isRegularVeh()){
      this.veh[i].longModel.copy((this.veh[i].type === "truck")
				   ? longModelTruck : longModelCar);
      this.veh[i].LCModel.copy((this.veh[i].type === "truck")
				 ? LCModelTruck : LCModelCar);

      this.veh[i].longModel.driverfactor=this.veh[i].driverfactor;
    
      
      if(false){
        console.log("updateModelsOfAllVehicles: type="+this.veh[i].type,
		  " speedl="+this.veh[i].longModel.speedlimit,
		  " longModelTruck.speedlimit="+longModelTruck.speedlimit);
      }
    }
  }


  
  //##########################################################
  // Tactical acceleration/LC for diverging and multi-lane Merging
  // !! unconditional lane bias! not optimal for multi-lane merges/diverges

  for(var ir=0; ir<this.mergeDivergeInfo.length; ir++){
    var targetID=this.mergeDivergeInfo[ir].targetID;
    var isMerge=this.mergeDivergeInfo[ir].isMerge;
    var uLast=this.mergeDivergeInfo[ir].uLast;
    var toRight=this.mergeDivergeInfo[ir].toRight;

    if(false){
      console.log(
	"road.updateModelsOfAllVehicles: new: apply tacticalLC to Veh");
      console.log(""
		  +" mergeDivergeID="+targetID
		  +" isMerge="+isMerge
		  +" toRight="+toRight
		  +" uLast="+parseFloat(uLast).toFixed(1));
    }

    for(var i=0; i<this.veh.length; i++){
      if( (this.veh[i].isRegularVeh())
	  &&(this.veh[i].route.includes(targetID))){

      // test if the next on- or off-ramp is nearby (dist< duTactical)

	if((this.veh[i].u<uLast)&&(this.veh[i].u>uLast-this.duTactical)){


          // if so, change lanes in the direction of the diverge 
          // and, if offramp coming very near to "last exit", reduce speed
 
	  this.veh[i].LCModel=(toRight) ? this.LCModelTacticalRight
	          : this.LCModelTacticalLeft; //LCModelTactical new cstr

	  //!! Tactical deceleration if near mandatory diverge
	  // (in road.connect, tactical deceleration
	  // is set directly by setting vehConnect.acc)
	  if(!isMerge){
	    this.veh[i].divergeAhead=true; //only if true LC performed
	    this.veh[i].longModel.alpha_v0
	      =Math.max(0.5, (uLast-this.veh[i].u)/this.duTactical);
	  }

	  if(false){
	    console.log(
	      "road.updateModelsOfAllVehicles: apply tacticalLC to Veh"
		+" id="+this.veh[i].id
		+" route="+this.veh[i].route
		+" mergeDivergeID="+targetID
		+" toRight="+toRight
		+" u="+parseFloat(this.veh[i].u).toFixed(1)
		+" uLast="+parseFloat(uLast).toFixed(1)
		+" bBiasRight="+this.veh[i].LCModel.bBiasRight
	    );
	  }
	}

      } // nextOfframpNearby

      else{ // also for missed diverges
	this.veh[i].divergeAhead=false;
      }
    }
  } // end new tactical accel and LC for diverges/multilane merges

  
  //##########################################################
  // Tactical acceleration/LC for connections with lane closings
  // dependent on the route
  //!!!! (MT 2023-09-26) WHY vehicles merge too late even if target lane free
  // explanation must be here!


  // reset tactical LC bans
  
  for(var i=0; i<this.veh.length; i++){
    if(this.veh[i].isRegularVeh()){
      this.veh[i].LCbanLeft=false;
      this.veh[i].LCbanRight=false;
    }
  }
  
  for(var ir=0; ir<this.connectInfo.length; ir++){ //!!!!
  //for(var ir=0; ir<0; ir++){
    var targetID=this.connectInfo[ir].targetID;
    var uConnect=this.connectInfo[ir].uSource; //!!!restrict uConnect=roadLen?
    var offset=this.connectInfo[ir].offsetLane;
    var targetNlanes=this.connectInfo[ir].targetNlanes;
    
    // for each lane: 1=closing but open to right, 0=through,
    // -1=closing, open to left
    
    var laneInfo=[];
    for(var il=0; il<this.nLanes; il++){
      var ilNew=il+offset;
      laneInfo[il]=(ilNew<0) ? 1 : (ilNew>=targetNlanes) ? -1 : 0;
    }
    if(false){ //!!!
      console.log(
	"road.updateModelsOfAllVehicles: new: apply tactical connectInfo");
      console.log("itime=",itime,
		  "targetID="+targetID,
		  "uConnect="+uConnect.toFixed(1),
		  "laneInfo=",laneInfo);
    }

    for(var i=0; i<this.veh.length; i++){
      if( (this.veh[i].isRegularVeh())
	  &&(this.veh[i].route.includes(targetID))){

	var lane=this.veh[i].lane;
	
	// test if the veh is on a through lane for the target roadID and,
	// if not, is inside the tactical range (dist< duTactical)

	if((this.veh[i].u<uConnect)
	   &&(this.veh[i].u>uConnect-this.duTactical)){


          // if so, change lanes in the direction of the diverge 
          // and, if offramp coming very near to "last exit", reduce speed

	  if(laneInfo[lane]==-1){
	    this.veh[i].LCModel=this.LCModelTacticalLeft;}
	  if(laneInfo[lane]==+1){
	    this.veh[i].LCModel =this.LCModelTacticalRight;}
	  if((lane<this.nLanes-1)&&(laneInfo[lane+1]==-1)){
	    this.veh[i].LCbanRight=true;}
	  if((lane>0)&&(laneInfo[lane-1]==+1)){
	    this.veh[i].LCbanLeft=true;}
	}
 
	if(false){
	//if(this.veh[i].id==302){
	  console.log(
	    "road.updateModelsOfAllVehicles: apply connectInfo to Veh id",
	    this.veh[i].id,
	    "route="+this.veh[i].route,
	    "u="+parseFloat(this.veh[i].u).toFixed(1),
	    "uConnect="+uConnect.toFixed(1),
	    "duTactical=",this.duTactical.toFixed(1),
	    "lane=",lane,
	    "laneInfo=",laneInfo,
	    "bBiasRight="+this.veh[i].LCModel.bBiasRight,
	    "");
	}
	
      }

    } // iveh loop for tactical connectinfo

  }// end new tactical accel and LC as preparation for connects


  

}//updateModelsOfAllVehicles

//######################################################################
// update times since last change for all vehicles (min time between changes)
//######################################################################

road.prototype.updateLastLCtimes=function(dt){
    for(var i=0; i<this.veh.length; i++){
      this.veh[i].dt_afterLC +=dt;
      this.veh[i].dt_lastPassiveLC +=dt;
    }
}



//######################################################################
// get direction of road at arclength u
//######################################################################
/*
@param u:             actual arclength for which to get direction
@param traj: used trajectories traj_x=traj[0], traj_y=traj[1]
                      (use this.traj for the default)
@return direction (heading) of the road in [0,2*pi] (0=East, pi/2=North etc)
*/

road.prototype.get_phi=function(u,traj){

    var smallVal=0.0000001;

    var du=0.1;
    var uLoc=Math.max(du, Math.min(this.roadLen-du,u));
    var dx=traj[0](uLoc+du)-traj[0](uLoc-du);
    var dy=traj[1](uLoc+du)-traj[1](uLoc-du);
    if((Math.abs(dx)<smallVal)&&(Math.abs(dy)<smallVal)){
      console.log("road.get_phi: id="+this.roadID,
		  " uLoc+du="+uLoc+du," uLoc-du="+uLoc-du,
		  " traj[0](uLoc+du)="+traj[0](uLoc+du),
		  " traj[0](uLoc-du)="+traj[0](uLoc-du),
      " error: cannot determine heading of two identical points"); 
      return 0;
    }
    var phi=(Math.abs(dx)<smallVal) ? 0.5*Math.PI : Math.atan(dy/dx);
    if( (dx<0) || ((Math.abs(dx)<smallVal)&&(dy<0))){phi+=Math.PI;}

    return phi;
}


//######################################################################
// get local curvature  of road at arclength u
//######################################################################
/**
@param u=actual arclength for which to get curvature
@return curvature of the road (positive for left curves)
*/

road.prototype.get_curv=function(u){

    var du=0.1;
    var phiPlus=this.get_phi(u+du,this.traj);
    var phiMinus=this.get_phi(u-du,this.traj);
    return 0.5*(phiPlus-phiMinus)/du;

}

//######################################################################
// get x pixel coordinate of logical long coord u and transv v (pos if right)
//######################################################################
/**
@param u=logical longitudinal coordinate [m] (zero at beginning)
@param v=logical transversal coordinate [m] (zero at road center, towards right)
@param scale translates physical road coordinbates into pixel:[scale]=pixels/m
@return x pixel coordinate

see also this.findNearestDistanceTo(xUser,yUser)=>[dist,uReturn,vLanes]

*/

road.prototype.get_xPix=function(u,v){
  var phi=this.get_phi(u,this.traj);
  return scale*(this.traj[0](u)+v*Math.sin(phi));
}

//######################################################################
// get yPix coordinate from logical coordinates (yPix increasing downwards)
//######################################################################
/**
@param u=logical longitudinal coordinate (zero at beginning)
@param v=logical transversal coordinate (zero at road center, towards right)
@param scale translates physical road coordinbates into pixel:[scale]=pixels/m
@return y pixel coordinate

see also this.findNearestDistanceTo(xUser,yUser)=>[dist,uReturn,vLanes]

*/

road.prototype.get_yPix=function(u,v){
    var phi=this.get_phi(u,this.traj);
    return -scale*(this.traj[1](u)-v*Math.cos(phi));
}





//######################################################################
// draw road (w/o vehicles; for latter -> drawVehicles(...)
//######################################################################

/*
@param roadImg1:  image of a (small, straight) road element w/o middle lines
@param roadImg2:  image of a (small, straight) road element with middle lines
@param scale:     physical road coordinbates => pixels, [scale]=pixels/m
@param changed geometry: true if a resize event took place in parent
@param umin,umax: (optional) only part is drawn (useful for bridges etc)
@param movingObs: (optional) whether observer is moving, default=false 
@param uObs:      (optional) location uObs,vObs=0 is drawn at the physical
@param xObs,yObs: position (xObs,yObs)=>xPix=scale*xObs, yPix=-scale*yObs,
                  all other positions relative to it
                  !Need to define (xObs,yObs) separately since other links
                  such as onramps may be drawn relatively to the position
                  of the actual link (e.g. mainroad)

@return draw into graphics context ctx (defined in calling routine)
*/

road.prototype.draw=function(roadImg1,roadImg2,changedGeometry,
			     umin,umax,
			     movingObs,uObs,xObs,yObs){

  var lSegm=this.roadLen/this.nSegm;

  //console.log("road.draw: lSegm="+lSegm);

  var noRestriction=(typeof umin === 'undefined');
  var movingObserver=(typeof movingObs === 'undefined')
    ? false : movingObs;
  var uRef=(movingObserver) ? uObs : 0;
  var xRef=(movingObserver) ? xObs : this.traj[0](0);
  var yRef=(movingObserver) ? yObs : this.traj[1](0);



  var draw_curvMax=0.04; // curvature radius 25 m
  var factor=Math.min(1.5, // " stitch factor" for drawing
		      1+this.nLanes*this.laneWidth*draw_curvMax); 
  
  // lookup table only at beginning or after rescaling => 
  // now condition in calling program

  if(changedGeometry){
    //if(true){
    this.draw_scaleOld=scale;
    for (var iSegm=0; iSegm<this.nSegm; iSegm++){
      var u=this.roadLen*(iSegm+0.5)/this.nSegm;
      this.draw_x[iSegm]=this.traj[0](u);
      this.draw_y[iSegm]=this.traj[1](u);
      this.draw_phi[iSegm]=this.get_phi(u,this.traj);
      this.draw_cosphi[iSegm]=Math.cos(this.draw_phi[iSegm]);
      this.draw_sinphi[iSegm]=Math.sin(this.draw_phi[iSegm]);
    }
  }

    // actual drawing routine

  var duLine=15; // distance between two middle-lane lines
  var nSegmLine=2*Math.round(0.5*duLine/(this.roadLen/this.nSegm)); // 0,2,4...
  nSegmLine=Math.max(2, nSegmLine);

  //console.log("road.draw: ID="+this.roadID," nSegm="+this.nSegm,
//	      " noRestriction="+noRestriction);

  var lSegmPix=scale*factor*lSegm;
  var wSegmPix=scale*(this.nLanes*this.laneWidth+this.boundaryStripWidth);
  
  for (var iSegm=0; iSegm<this.nSegm; iSegm++){
    var u=this.roadLen*(iSegm+0.5)/this.nSegm;
    var filterPassed=noRestriction // default: noRestriction=true
      || ((u>=umin)&&(u<=umax));
    if(filterPassed){
      var cosphi=this.draw_cosphi[iSegm];
      var sinphi=this.draw_sinphi[iSegm];

      var xCenterPix= scale*(this.draw_x[iSegm]-this.traj[0](uRef)+xRef);
      var yCenterPix=-scale*(this.draw_y[iSegm]-this.traj[1](uRef)+yRef);


      ctx.setTransform(cosphi, -sinphi, +sinphi, cosphi, xCenterPix,yCenterPix);
      var roadImg=(iSegm%nSegmLine<nSegmLine/2) ? roadImg1 : roadImg2;
      ctx.drawImage(roadImg, -0.5*lSegmPix, -0.5* wSegmPix,lSegmPix,wSegmPix);

      if(false){
      //if(itime==1){
      //if((this.roadID==2)&&(iSegm==this.nSegm-4)){
        console.log(
	  "road.draw: ID="+this.roadID," iSegm="+iSegm,
	  " this.draw_y[iSegm]="+formd(this.draw_y[iSegm]),
	  " this.traj[1](this.roadLen-50)="+formd(this.traj[1](this.roadLen-50)),
	  " lSegmPix="+formd(lSegmPix)," wSegmPix="+formd(wSegmPix),
	  " xCenterPix="+formd(xCenterPix),
	  " yCenterPix="+formd(yCenterPix)
	);
      }
    }
  }

  /* road.draw: draw special trajectories (turnings etc) if 
    (i) alternative trajectories defined (this.trajAlt.length>0)
    (ii) stationary observer
    (iii) this.drawAlternativeTrajectories=true (false by default)
     Of course, route filtering (this.getTraj(veh)) only for vehicles
*/

  
  if((!movingObserver)&&this.drawAlternativeTrajectories){
    for(var iTraj=0; iTraj<this.trajAlt.length; iTraj++){
      var nSegmAlt=(this.trajAlt[iTraj].umax-this.trajAlt[iTraj].umin)/lSegm;
      var trajAlt=[this.trajAlt[iTraj].x,this.trajAlt[iTraj].y];
      var laneMin=(typeof this.trajAlt[iTraj].laneMin === undefined)
	  ? 0 : this.trajAlt[iTraj].laneMin;
      var laneMax=(typeof this.trajAlt[iTraj].laneMax === undefined)
	  ? this.nLanes : this.trajAlt[iTraj].laneMax;

      
      var wSegmPix=scale*(laneMax-laneMin+1)
	  *this.laneWidth+this.boundaryStripWidth;
    
      var vCenterPhys=this.laneWidth*0.5*(laneMin+laneMax+1-this.nLanes);
      for (var iSegm=0; iSegm<nSegmAlt; iSegm++){
        var u=this.trajAlt[iTraj].umin+(iSegm+0.5)*lSegm;
        var phi=this.get_phi(u,trajAlt);
        var cosphi=Math.cos(phi);
        var sinphi=Math.sin(phi);
        var x=trajAlt[0](u)+vCenterPhys*sinphi;
        var y=trajAlt[1](u)-vCenterPhys*cosphi;

        var xCenterPix= scale*x;
        var yCenterPix=-scale*y;

        ctx.setTransform(cosphi,-sinphi,sinphi,cosphi,xCenterPix,yCenterPix);
        var roadImg=(iSegm%nSegmLine<nSegmLine/2) ? roadImg1 : roadImg2;
        ctx.drawImage(roadImg,-0.5*lSegmPix,-0.5*wSegmPix,lSegmPix,wSegmPix);
      }
    }
  }

// draw road ID separately by its own command .draw(imgRed,imgGreen)
// draw traffic lights separately by its own command .draw(imgRed,imgGreen)

}// draw road



//######################################################################
// helper functions for draw() drawing the taper sections 
//######################################################################

 /*
s-shaped small segment that can be used for drawing tapers
always starts at v=0 for u=0 and ends at v=laneIncr*this.laneWidth

@param u:         virtual coordinate in [0, this.taperLen]
@param laneIncr: v coordiate changes by laneIncr*this.laneWidth
@return:          lateral offset with v(0)=0
*/

road.prototype.sShape_v=function(u, laneIncr){
  var res=(u<0.5*this.taperLen)
      ? 2*Math.pow(u/this.taperLen,2)
      : (1-2*Math.pow((this.taperLen-u)/this.taperLen,2));
  //if(itime==1){console.log("taperMerge_v: u=",u," res=",res);}
  return laneIncr*this.laneWidth*res;
}



// relative heading of s-shaped segment with respect to road axis
// !! since v>0 if to right we have phi=-gradient

road.prototype.sShape_phi=function(u, laneIncr){
  var du=1;
  return(-0.5*(this.sShape_v(u+0.5*du,laneIncr)
	       -this.sShape_v(u-0.5*du,laneIncr)));
}
  


/* ###################################################################
 draw tapers for general purposes, ramps, and connects
onramps (u>=roadLen) and offramps (u<0)
 no influence on traffic flow dynamics!
@param laneIncr: lane number increment
 !! not implemented for moving observers
 !! approximate merge angles << 1, so arclength=road axis length
 ###################################################################
*/

road.prototype.drawTaperRamp=function(roadImg1,  laneIncr, atRight){
  //console.log("\nitime=",itime,"in .drawTaperRamp");
  var isMerge=(laneIncr<0);
  var uStart=(isMerge) ? this.roadLen : -this.taperLen;
  var vStart=this.laneWidth*((atRight) ? 1 : -1) * 0.5*(this.nLanes-1);
  if(laneIncr>0){vStart-=laneIncr*((atRight) ? 1 : -1) * this.laneWidth;}
  var laneShift=(atRight) ? laneIncr : -laneIncr;
  this.drawTaper(roadImg1,  laneShift, uStart, vStart);
}


road.prototype.drawTaperConnect=function(roadImg1,  targetID){

  //var debug=((itime==2)&&(this.roadID==2));
  var debug=false;
  var ir=-1; // target road index
  for(var i=0; i<this.connectInfo.length; i++){
    if(this.connectInfo[i].targetID==targetID){ir=i;}
  }

  if(debug){
	console.log("road.drawTaperConnect: roadID=",this.roadID,
		    "targetID=",targetID," ir=",ir,
		    "this.connectInfo[ir]=",this.connectInfo[0]);
  }
  
  if(ir>-1){
    var uSource=this.connectInfo[ir].uSource;
    var incrLeft=this.connectInfo[ir].offsetLane;
    var incrRight=-incrLeft
	+this.connectInfo[ir].targetNlanes-this.nLanes;
    
    if(Math.abs(incrRight)>0){
      var laneShift=incrRight;
      var uStart=(incrRight>0) ? uSource-this.taperLen : uSource;
      var vStart=this.laneWidth*0.5*(this.nLanes-1);
      this.drawTaper(roadImg1,laneShift,uStart,vStart);
      
      if(debug){
	console.log("road.drawTaperConnect: roadID=",this.roadID,
		    "incrRight=",incrRight,
		    "laneShift=",laneShift,
		    "uStart=",uStart.toFixed(2),
		    "vStart=",vStart.toFixed(2),
		    "");
      }
      
    }
    if(Math.abs(incrLeft)>0){
      var laneShift=-incrLeft;
      var uStart=(incrLeft>0) ? uSource-this.taperLen : uSource;
      var vStart=-this.laneWidth*0.5*(this.nLanes-1);
      this.drawTaper(roadImg1,laneShift,uStart,vStart);
      if(debug){
	console.log("road.drawTaperConnect: roadID=",this.roadID,
		    "incrLeft=",incrLeft,
		    "laneShift=",laneShift,
		    "uStart=",uStart.toFixed(2),
		    "vStart=",vStart.toFixed(2),
		    "");
      }
    }
  }
}


// @param laneShift: lane index increment during the S-shape
// beginning at uStart,vStart
// taper width =|laneShift|*laneWidth+boundaryStripWidth

road.prototype.drawTaper=function(roadImg1,  laneShift, uStart, vStart){

  //var debug=((itime==1)&&(this.roadID==0));
  var debug=false;
  if(debug){console.log("road.drawTaper: laneShift=",laneShift,
			"uStart=",uStart,"vStart=",vStart);}
  var lSegm=this.roadLen/this.nSegm;
  var abs_shiftv=Math.abs(laneShift)*this.laneWidth;

  // " stitch factor" for drawing, curvature radius >=25 m
  
  var draw_curvMax=0.04;
  var factor=Math.min(1.5, 1+abs_shiftv*draw_curvMax); 


    // actual drawing routine

  var nSegmTaper=Math.floor(this.taperLen/lSegm);

  var lSegmPix=scale*factor*lSegm;
  var wSegmPix=scale*(abs_shiftv+this.boundaryStripWidth);
  
  for (var iSegm=0; iSegm<nSegmTaper; iSegm++){
    var du=this.taperLen*(iSegm+0.5)/nSegmTaper;
    var u=uStart+du-0.10*this.taperLen; //!! to make taper look shorter

    //if(this.roadID==10){console.log("u=",u," du=",du);}
    var dv=this.sShape_v(du,laneShift);
    
    var dphi=this.sShape_phi(du,laneShift)
    var phi=this.get_phi(u,this.traj)+dphi;
    
    var cosphi=Math.cos(phi);
    var sinphi=Math.sin(phi);
    var xCenterPix=this.get_xPix(u,vStart)+scale*sinphi*dv;
    var yCenterPix=this.get_yPix(u,vStart)+scale*cosphi*dv; // (-1)*(-1)


    ctx.setTransform(cosphi, +sinphi, -sinphi, cosphi, xCenterPix,yCenterPix);
    ctx.drawImage(roadImg1, -0.5*lSegmPix, -0.5* wSegmPix,lSegmPix,wSegmPix);

 
    if(debug){
    //if(false){
      console.log(
	"road.drawTaper: roadID="+this.roadID," iSegm="+iSegm,
	//" lSegmPix="+formd(lSegmPix)," wSegmPix="+formd(wSegmPix),
	"u=",u.toFixed(2),
	"vStart=",vStart.toFixed(2),
	//"this.get_xPix(u,vStart)=",this.get_xPix(u,vStart),
	"du=",du.toFixed(2),
	"dv=",dv.toFixed(2),
	"dphi=",dphi.toFixed(2),
	"phi=",phi.toFixed(2),
//	"scale=",scale.toFixed(2),
	"xCenterPix=",xCenterPix.toFixed(0),
	"yCenterPix=",yCenterPix.toFixed(0),
	""
      );
    }
  }
}


// separately because otherwise later roads overwrite road ID

road.prototype.drawRoadID=function(){
    var xCenterPix= scale*this.traj[0](0.5*this.roadLen);
    var yCenterPix=-scale*this.traj[1](0.5*this.roadLen);
    var textsize=0.022*Math.min(canvas.width,canvas.height);
    var lPix=3.5*textsize;
    var hPix=1.5*textsize;

    ctx.font=textsize+'px Arial';
    ctx.setTransform(1,0,0,1,xCenterPix,yCenterPix);
    ctx.fillStyle="rgb(202,202,202)";
    ctx.fillRect(-0.5*lPix, -0.5*hPix, lPix, hPix);
    ctx.fillStyle="rgb(0,0,0)";
    ctx.fillText("road " +this.roadID, -0.45*lPix, 0.20*hPix);
}


//######################################################################
// draw vehicles
//######################################################################

/*

draws vehicle images into graphics context ctx (defined in calling routine)
normal vehicles (except the black obstacles) are color-coded
 
special vehicles (id defined mainly in veh cstr)
have special appearance according to

// types: 0="car"+ 1="truck"+ 2="obstacle" (including red traffic lights)
// id's defined mainly in vehicle.js and ObstacleTLDepot.js
// id<100:              special vehicles/road objects
// id=1:                ego vehicle
// id=10,11, ..49       disturbed vehicles 
// id=50..99            depot vehicles/obstacles (vehicle.isDepotObstacle())
// id=100..199          traffic lights (vehicle.isTrafficLight())
// id>=200:             normal vehicles and obstacles
// id>=200&&type!=="obstacle" regular vehicles (vehicle.isRegularVeh)


@param carImg, truckImg: one veh image per type
@param obstacleImgs: array [standard black bar, construction vehs]
@param scale: translates physical coordinbates into pixel:[scale]=pixels/m
@param speedmin,speedmax: speed range [m/s] for the colormap 
       (red=slow,blue=fast)
@param umin,umax: (optional) restriction of the long drawing range 
       (useful when drawing veh only when fully entered, under bridges 
       => routing scenario or re-drawing merging veh)
@param movingObs: (optional) whether observer is moving, default=false 
@param uObs:      (optional) location uObs is drawn at the physical
@param xObs,yObs: (optional) position (xObs,yObs), 
                  all other positions relative to it
                  !Need to define (xObs,yObs) separately since other links
                  such as onramps may be drawn relatively to the position
                  of the actual link (e.g. mainroad)
@param upright:   (optional) if image moves to the left, turned by PI

@return draw into graphics context ctx (defined in calling routine)
*/




road.prototype.drawVehicles=function(carImg, truckImg, obstacleImg, 
				     speedmin,speedmax,umin,umax,
				     movingObs, uObs, xObs, yObs,
				     upright){

  // select trajectories (non-default only if turning left or right or
  // in roundabout)


  if(false){console.log("road.drawVehicles: traj init:"+
				 " this.traj[0]="+this.traj[0]);}

    
  

  var noRestriction=(typeof umin === 'undefined');
  var movingObserver=(typeof movingObs === 'undefined')
      ? false : movingObs;
  var uRef=(movingObserver) ? uObs : 0;
  var xRef=(movingObserver) ? xObs : this.traj[0](0);
  var yRef=(movingObserver) ? yObs : this.traj[1](0);
  var xOffset=this.traj[0](uRef)-xRef; // =0 for !movingObserver
  var yOffset=this.traj[1](uRef)-yRef;


  for(var i=0; i<this.veh.length; i++){

    // do not draw vehicles outside limits
    // or if it is a virtual traffic-light vehicle (if TL is red)
    // unless debugging switch this.drawVehIDs is on

    var filterPassed=(true)  // for debugging thisif also TL IDs are shown
    var filterPassed=((!this.veh[i].isTrafficLight())||this.drawVehIDs)
	&& (noRestriction // default: noRestriction=true
	    || ((this.veh[i].u>=umin)&&(this.veh[i].u<=umax)));

    if(filterPassed){

      
      // check if alternate trajectories be used for some routes
      // (turning, merging etc, purely optical)

      var usedTraj=this.getTraj(this.veh[i]); 
      this.drawVehicle(i,carImg, truckImg, obstacleImg, 
			 speedmin,speedmax,usedTraj,
			 xOffset,yOffset,upright);

      if(false){
	//if(this.veh[i].id==209){
	  console.log(
	    "drawVehicle after getTraj: roadID="+this.roadID,
	    " time="+time," vehid="+this.veh[i].id,
	    "usedTraj="+usedTraj);
      }

    }
  }

}





//###############################################################
// draw a single vehicle into the graphics context
//###############################################################

/*
@param i:           Vehicle index to be drawn
@param carImg, etc: see above at drawVehicles
@class level:      If attribute this.drawVehIDs==true, 
                   draw veh IDs to the right of the vehicle
*/


road.prototype.drawVehicle=function(i,carImg, truckImg, obstacleImg, 
				    speedmin,speedmax,traj,
				    xOffset,yOffset,upright){

  var drawID=(typeof(displayIDs)==='undefined') ? false : displayIDs; 
  var phiVehRelMax=0.3;          // !! avoid vehicles turning too much
  var vehSizeShrinkFactor=0.85;  // to avoid overlapping in inner curves

 
    // (1) determine uCenter, vCenter in logical long/lat coordinates
    // v increasing from left to right, 0 @ road center
    // !! update_v ... in paths.js  Influences veh[i].v
  
  update_v_dvdt_optical(this.veh[i]);

  var type=this.veh[i].type;
  var vehLenPix=vehSizeShrinkFactor*scale*this.veh[i].len;
  var vehWidthPix=scale*this.veh[i].width;

  var uCenterPhys=this.veh[i].u-0.5*this.veh[i].len;
  var vCenterPhys=this.laneWidth*(this.veh[i].v-0.5*(this.nLanes-1)); 


  // (2) determine vehicle orientation

  var phiRoad=this.get_phi(uCenterPhys,traj);
  var phiVehRel=(this.veh[i].speed<0.1)
	? 0
	: -Math.atan(this.veh[i].dvdt*this.laneWidth/this.veh[i].speed);
    
  phiVehRel=Math.max(-phiVehRelMax,
		       Math.min(phiVehRelMax,phiVehRel));

  var phiVeh=phiRoad + phiVehRel;

  // special corrections for special (depot) obstacles 
  // normal obstacles are drawn with obstacleImgs[0]=black box
  // !! special index 50-> obstacleImgs[1] etc 

  var obstacleImgIndex=(this.veh[i].isSpecialVeh())
    ? (this.veh[i].id-49) % obstacleImgs.length : 0;
    
  if((type==="obstacle")||(upright==true)){
	    if((phiRoad>0.5*Math.PI)&&(phiRoad<1.5*Math.PI)){
		  phiVeh-=Math.PI;}
	    if(obstacleImgIndex!=0){ // index 0: black bar for ramp ends, OK
		  phiVeh -=0.2;
		  vCenterPhys -=0.1*this.laneWidth;
	    }
  }

  
  // (3) determine vehicle center xCenterPix, yCenterPix
  // in pixel coordinates

  
    var cphiRoad=Math.cos(phiRoad);
    var sphiRoad=Math.sin(phiRoad);
    var cphiVeh=Math.cos(phiVeh);
    var sphiVeh=Math.sin(phiVeh);


    // xOffset=0 (two terms cancel out) for normal fixed viewpoint 
    // (movingObserver=false)

    var xCenterPix= scale*(traj[0](uCenterPhys) + vCenterPhys*sphiRoad
			   -xOffset); // -xOffset=-trajLoc[0](uRef)+xRef)
    var yCenterPix=-scale*(traj[1](uCenterPhys) - vCenterPhys*cphiRoad
			   -yOffset);


    // (4) draw vehicle as image

  var obstacleImg;
  if(type==="obstacle"){
	      obstacleImg=obstacleImgs[obstacleImgIndex];
  }
				
  vehImg=((type==="car")||(type=="others"))
	      ? carImg : (type==="truck")
	      ? truckImg : obstacleImg;
  ctx.setTransform(cphiVeh, -sphiVeh, +sphiVeh, cphiVeh, 
		   xCenterPix, yCenterPix);
  if(upright&&(phiRoad>0.5*Math.PI)&&(phiRoad<1.5*Math.PI)){
    ctx.setTransform(-cphiVeh, +sphiVeh, +sphiVeh, cphiVeh,
		     xCenterPix, yCenterPix);
  }
    
  ctx.drawImage(vehImg, -0.5*vehLenPix, -0.5*vehWidthPix,
		vehLenPix,vehWidthPix);


    // (5) draw semi-transp box of speed-dependent color 
    //     over the images
    //     (different size of box because of mirrors of veh images)

  if((type!="obstacle")&&(speedmax>1e-10)){ // no box if speedmin=speedmax=0
        var effLenPix=(type==="truck") ? 0.90*vehLenPix : 1.00*vehLenPix;
        var effWPix=(type==="truck") ? 0.80*vehWidthPix : 0.60*vehWidthPix;
        var speed=this.veh[i].speed;
	var isEgo=(this.veh[i].id===1);
        ctx.fillStyle=(this.veh[i].colorStyle==0)
	    ? colormapSpeed(speed,speedmin,speedmax,type, isEgo,time)
	    : (this.veh[i].colorStyle==1) ? "rgba(0,0,255,0.5)"
	    : (this.veh[i].colorStyle==2) ? "rgba(255,255,0,0.5)"
	    : "rgba(255,0,0,0.5)";
	ctx.fillRect(-0.5*effLenPix, -0.5*effWPix, effLenPix, effWPix);
	if(isEgo||this.veh[i].isPerturbed()||(this.veh[i].colorStyle>0)){
		  ctx.strokeStyle="rgb(0,0,0)";
		  ctx.strokeRect(-0.50*effLenPix, -0.50*effWPix, 
			       1.0*effLenPix, 1.0*effWPix);
		  ctx.strokeRect(-0.55*effLenPix, -0.55*effWPix, 
			       1.1*effLenPix, 1.1*effWPix);
		  ctx.strokeRect(-0.60*effLenPix, -0.60*effWPix, 
			       1.2*effLenPix, 1.2*effWPix);
	}
    }

    //(6) optionally draw vehicle ID near the vehicle

    //if(this.drawVehIDs&&(this.veh[i].isRegularVeh())){
    if(this.drawVehIDs){
	var textsize=0.014*Math.min(canvas.width,canvas.height);
        var lPix=2.8*textsize;
        var hPix=1.1*textsize;
        var xOffset=0.7*lPix;
        var yOffset=-0.7*hPix;

	ctx.font=textsize+'px Arial';
	ctx.setTransform(1,0,0,1,xCenterPix+xOffset,yCenterPix+yOffset);
	ctx.fillStyle="rgb(255,255,255)";
	ctx.fillRect(-0.5*lPix, -0.5*hPix, lPix, hPix);
	ctx.fillStyle="rgb(0,0,0)";
	ctx.fillText(this.veh[i].id, -0.45*lPix, 0.40*hPix);
    }


    ctx.fillStyle="rgb(0,0,0)";

	
    if(false){
	  //if(this.veh[i].v>2){
	      console.log("in road.drawVehicle: itime="+itime,
			  +" u="+this.veh[i].u
			  +" v="+this.veh[i].v
			  +" xCenterPix="+xCenterPix
			  +" yCenterPix="+yCenterPix
			 );
    }


  
}// road.drawVehicle  (a single vehicle)


road.prototype.revertVehMarkings=function(){
    for(var i=0; i<this.veh.length; i++){
	this.veh[i].colorStyle=0;
    }
}




/* #####################################################
 MT 2019-09: implement effect of user-draggable speed limits 
from the traffic objects:

 distribute speed limits to the regular vehicle's longmodels
 (free sign=>value=200./3.6=>effectively no influence)
 need to order the speedlimit positions first 

 NOTICE: In top-level sim, all speedlimits should be set to 1000 or something
 to take care of the effect of removing limits

//#####################################################*/

road.prototype.updateSpeedlimits=function(trafficObjects){

  // sort trafficObj array by decreasing u values (mixing of different roads
  // and object types OK since filtered in loop)
  // !! but side effect: trafficObjects.trafficObj[i] not static!

  trafficObjects.trafficObj.sort(function(a,b){ 
	    return a.u - b.u;
  })

  // implement (all speedlimits should be set to 1000 prior to this action)

  var duAntic=20; // !! anticipation distance for  obeying the speed limit
  var success=false;
  var bBrake=3;
  for(var i=0; i<trafficObjects.trafficObj.length; i++){
    var obj=trafficObjects.trafficObj[i];
    if((obj.type==='speedLimit')&&(obj.isActive) 
       && (obj.road.roadID==this.roadID)){
      success=true;
      var speedL=obj.value/3.6;  // in m/s
      if(false){
	console.log("road.updateSpeedlimits: speed limit "+
		    formd(speedL)," starting at "+
		    formd(obj.u));
      }


      for(var iveh=0; iveh<this.veh.length; iveh++){
	var targetVeh=this.veh[iveh];
	var sLimit=obj.u-targetVeh.u;
	var speed=targetVeh.speed;
	var neededDecel=(sLimit<0)
	    ? 0 : 0.5*(speed+speedL)*(speed-speedL)/sLimit;
	if((sLimit<duAntic)||(neededDecel>bBrake)){
	//if(sLimit<duAntic){
	  if(targetVeh.isRegularVeh()){
	    targetVeh.longModel.speedlimit=(targetVeh.type==="truck")
	      ? Math.min(speedL,speedL_truck) : speedL;
	  }
	}
      }

      
      
      //if(iveh==this.veh.length){return;} // otherwise risk of range excess

    }
  }

 // test

  if(false){
    for(var iveh=0; iveh<this.veh.length; iveh++){
      var veh=this.veh[iveh];
      if(veh.isRegularVeh()){
	console.log("end updateSpeedlimits: u="+veh.u,
		    "speedlimit="+veh.longModel.speedlimit);
      }
    }
  }

  
  if(!success){
    //console.log(" no active limits");
  }

}





road.prototype.dropObject=function(trafficObj){
  var u=trafficObj.u;
  var lane=trafficObj.lane;
  if(false){
    console.log("itime="+itime,
	        " in road.dropObject: trafficObj.u="+u,
	        " trafficObj.lane="+lane," this.nLanes="+this.nLanes);
  }


  // construct normal road vehicle/obstacle from depot object
  // if id=50...99

  if(trafficObj.type==='obstacle'){
    var roadVehicle=new vehicle(trafficObj.len,
				trafficObj.width,
				u, lane, 0, 
				"obstacle"); //=trafficObj.type

    //(dec17) need longModel for LC as lagVeh (standing virtual veh)!!
    roadVehicle.longModel=new IDM(0,1,2,0,1);

      //!! id ctrls veh image: 50=black obstacle,
      // 51=constructionVeh1.png etc. Attribute veh.imgNumber defined only
      // for vehicles in depot!
      
    roadVehicle.id=trafficObj.id;

    // insert vehicle (array position does not matter since sorted anyway)

    this.veh.push(roadVehicle); // !!!changeArray
    this.updateEnvironment(); // possibly crucial !! includes sorting
    console.log("  end road.dropObject: dropped obstacle at uDrop="+u,
		" lane="+lane," id="+roadVehicle.id,
		" imgNumber="+roadVehicle.imgNumber);
  }

  // position a traffic light if depot object id=100 ... 199
  // NOTICE: traffic light has its sorting/pushing/splicing methods


  else if(trafficObj.type==='trafficLight'){
    this.addTrafficLight(trafficObj);
    console.log("  end road.dropObject: added traffic light");
  }

  else {
    ; // speedlimit signs are taken care of automatically in update step
    // setting isActive=true in TrafficObjects.activate is enough
  }
}// dropObject




/**
#############################################################
(jun17) introduce traffic lights
#############################################################

@param depotObject=a TL-type depot object

@return adds a traffic-light object to this.trafficLights[] serving 
purely for the road operations of the traffic light. 
All drawing is controlled by the depotObjects (elements of the obstTL[])
*/

road.prototype.addTrafficLight=function(depotObject) {
  var trafficLight={id: depotObject.id,
		    u: depotObject.u,
		    value: depotObject.value, // "red" or "green"
		   };
  this.trafficLights.push(trafficLight);
  this.changeTrafficLight(depotObject.id,depotObject.value);

  if(true){
    console.log("itime="+itime," road.addTrafficLight: roadID="+this.roadID,
	      " added traffic light id="+depotObject.id,
		" at u="+formd(depotObject.u)," value="+depotObject.value);
  }
  
}




/**
#############################################################
(jun17) programmatically change state (=value) of traffic light
and implement effects
#############################################################

@param id:     unique id in [100,199]
@param value:  (optional) "red"+ or "green". 
               If not given, the value is toggled
@return:       if a traffic light of this id is found, 
               its state is changed accordingly
*/

road.prototype.changeTrafficLight=function(id,value){

  // change state of one of the road's trafficLights objects selected by id

  var success=false;
  var pickedTL;
  for(var i=0; (!success)&&(i<this.trafficLights.length); i++){
    if(id===this.trafficLights[i].id){
      success=true;
      pickedTL=this.trafficLights[i];

      if(typeof(value) === "undefined"){ // just toggle if no value given
	pickedTL.value=(pickedTL.value==="red")
	  ? "green" : "red";
	console.log("road.changeTrafficLight: id="+id, "no TL state given:"+
		    " new value=opposite of old value="+pickedTL.value);
      }
      else{pickedTL.value=value;}
    }
  }

  if(!success){
    console.log("road.changeTrafficLight: no TL of id "+id," found!");
    return;
  }

  // implement effect to traffic by adding/removing virtual obstacles
  // (1) new TL value green
  // !!!changeArray
  
  if(pickedTL.value==="green"){
    for(var i=0; i<this.veh.length; i++){ //!!! is this.veh.length updated?
      if(this.veh[i].id===id){
	this.veh.splice(i, this.nLanes); // nLanes red TL removed
      }
    }
  }

  // (2) new TL value red

  //!! heineous bug: only generate new virt vehicles if none of this id
  // there. Otherwise unbounded growth of virt veh if several 
  // commands changeTrafficLight(id,"red") without (id,"green") given!

  else{
    var virtVehAlreadyExist=false; // one or more
    for(var i=0; i<this.veh.length; i++){
      if(this.veh[i].id===id){virtVehAlreadyExist=true;}
    }

    if(!virtVehAlreadyExist){
      for(var il=0; il<this.nLanes; il++){
        var virtVeh=new vehicle(1,this.laneWidth,
			        pickedTL.u, il, 0, "obstacle");
        virtVeh.longModel=new IDM(0,1,2,0,1); // needed for MOBIL
        virtVeh.id=id;
        this.veh.push(virtVeh); // !!!changeArray
      }
    }
  }
  this.updateEnvironment(); // includes sorting
} // changeTrafficLight



/**
#############################################################
(jun17) remove traffic light
#############################################################

@param id:     unique id in [100,199]

@return:       removes the traffic light of this id from road.trafficLights 
               if this id is found.  
               If last value was red, also removes the virtual
               vehicles associated with it
*/

road.prototype.removeTrafficLight=function(id) {
    // change value of trafficLight object

  console.log("in road.removeTrafficLight: id="+id,"this.trafficLights.length="+this.trafficLights.length);
  var success=false;
  var iDel=-1;
  for(var i=0; (!success)&&(i<this.trafficLights.length); i++){
    if(this.trafficLights[i].id===id){
      success=true;
      console.log("  succes! i="+i," trafficLight="+this.trafficLights[i]);
      iDel=i;
      this.changeTrafficLight(id,"green"); // to remove virt vehicles
    }
  }
  if(iDel===-1) console.log("road.removeTrafficLight: no id "+id," found!");
  else this.trafficLights.splice(iDel,1);
}

/*
#############################################################
(sep19) remove obstacle object with given id
#############################################################

@param id:     unique id in [50,99]

@return:       removes the obstacle if id is found in road.veh
*/
road.prototype.removeObstacle=function(id) {
    // change value of trafficLight object

  console.log("in road.removeObstacle: id="+id);
  var success=false;
  var iDel=-1;
  for(var i=0; (!success)&&(i<this.veh.length); i++){
    if(this.veh[i].id===id){
      success=true;
      iDel=i;
    }
  }
  if(iDel===-1) console.log("road.removeObstacle: no id "+id," found!");
  else this.veh.splice(iDel,1); // !!!changeArray
}


// ####################################################################
// helper function finding the appropriate trajectory
// for vehicles. If alternative trajectories exist and the veh route
// contains the roadID element of one of the alternative traj, use it
// ####################################################################

road.prototype.getTraj=function(veh){
  var usedTraj=this.traj; // default
  if(this.trajAlt.length>0){
        var iTraj=-1;
        var routefits=false;
        for(var itr=0; (itr<this.trajAlt.length)&&(!routefits); itr++){
	  if(veh.route.indexOf(this.trajAlt[itr].roadID)>=0){
	    iTraj=itr;
	    routefits=true;
	  }
        }
	var success=routefits && (veh.u>=this.trajAlt[iTraj].umin)
	    && (veh.u<=this.trajAlt[iTraj].umax);
	if(success){
	  usedTraj=[this.trajAlt[iTraj].x, this.trajAlt[iTraj].y];
	  if(false){console.log("time="+time," iTraj="+iTraj);}
	}
  }

  return usedTraj;

}



//##################################################################
// from various.js; copied here to save adding this to all the html's
//##################################################################

function arraysEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length !== b.length) return false;

  // If you don't care about the order of the elements inside
  // the array, you should sort both arrays here.
  // Please note that calling sort on an array will modify that array.
  // you might want to clone your array first.

  for (var i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}



/* ############################################################
finding the (last) argument u*=fun^{-1}(val)
 of a 1d function fun(u) for the value val, fun(u*)=val,
 and, if this does not exist, the u value for the global minimum distance
@param fun:   function(u),
@param val:   the given value
@param umin:  smalles argument
@param umax:  largest argument
@return [ustar,dist]
################################################################*/

function findArg(fun,val,umin,umax){
  var n=1000.;
  var dist=1e10;
  var ustar=umin;
  for(var i=0; i<=n; i++){
    var u=umin+i/n*(umax-umin);
    var d=Math.abs(fun(u)-val);
    if (d<dist){
      ustar=u;
      dist=d;
    }
  }
  return[ustar,dist];
}

