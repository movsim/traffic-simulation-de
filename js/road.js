
//!!! make/check v and lane consistent: v=laneWidth*(v-0.5*(nLanes-1))
// !! debugging: making simulations reproducible (see docu at onramp.js)

//Math.seedrandom(42); 
//console.log(Math.random());          // Always 0.0016341939679719736 with 42
//console.log(Math.random());          //s Always 0.9364577392619949 with 42
Math.seedrandom(44); // !! re-start reproducibly (undo console logs)





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
*/

var deepCopying=true;

function road(roadID,roadLen,laneWidth,nLanes,trajIn,
	      densInitPerLane,speedInit,fracTruck,isRing,doGridding){



  //console.log("1. in road cstr: traj=",traj);
  this.roadID=roadID;
  this.roadLen=roadLen;
  this.laneWidth=laneWidth;
  this.nLanes=nLanes;
  this.exportString="";

  
  // network related properties

  this.isRing=isRing;
  this.doGridding=(typeof doGridding === 'undefined') ? false : doGridding;
  this.inVehBuffer=0.9; // number of waiting vehicles; if>=1, updateBCup called
  this.iTargetFirst=0; // set by getTargetNeighbourhood: first veh in defined region

  this.offrampIDs=[]; // which offramps are attached to this road?
  this.offrampLastExits=[]; // locations? (increasing u)
  this.offrampToRight=[]; // offramp attached to the right?

  this.trafficLights=[]; // (jun17) introduce by this.addTrafficLight
                           // to model the traffic light->road operations.
                           // need separate array 
                           // since no virtual vehicles corresp. to green TL
                           // (all drawing is done by the 
                           // ObstacleTLDepot objects)


    // tactical and LC related global aspects

  this.waitTime=4;   // waiting time after passive LC to do an active LC
                       //similar value as default vehicle.dt_LC at cstr
  this.duTactical=-1e-6; // if duAntic>0 activate tactical changes 
                           // for mandat. LC
  this.uminLC=20;     // only allow lane changes for long coord u>uminLC 
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
  this.initRegularVehicles(densInitPerLane,fracTruck);

    // formally define ego vehicle for external reference
    // if applicable, it will be attributed to one element of this.veh, 
    // in this.updateEgoVeh(externalEgoVeh), later on.


  this.egoVeh=new vehicle(0,0,0,0,0,"car");


  this.traj=trajIn; 
  this.trajGrid=[];

  /*########################################################
   set of alternative trajectories including info
   each of the this.trajAlt[r] elements has the form
   {x: alternative trajectory_x, e.g., for turning vehicles,
    y: the same,
    roadID: filter vehicles with that neighboring roadID in their routes,
    umin: minimum logical this.u coordinate for using this traj,
    umax: maximum logical this.u coordinate
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
// initialize road with prescribed density per lane and truck fraction
// all special vehicles (obstacles, traffic lights...) are retained, if
// they exist
//######################################################################

road.prototype.initRegularVehicles=function(densityPerLane,fracTruck){

  var nvehPlus=Math.floor(this.nLanes*this.roadLen*densityPerLane);
  var nVehOld=this.veh.length;
  var vehPlus=[];
  var iveh=0;
  for(var i=0; i<nvehPlus; i++){

        // position trucks mainly on the right lane nLanes-1

    var u=(nvehPlus-i-1)*this.roadLen/(nvehPlus); //!!(nvehPlus+1)
    var lane=i%this.nLanes; // left: 0; right: nLanes-1
    var fracTruckRight=Math.min(this.nLanes*fracTruck,1);
    var fracTruckRest=(this.nLanes*fracTruck>1)
      ? ((this.nLanes*fracTruck-1)/(this.nLanes-1)) : 0;
    var fracTruck=(lane===this.nLanes-1) ? fracTruckRight : fracTruckRest;
    var vehType=(Math.random()<fracTruck) ? "truck" : "car";
    var vehLength=(vehType === "car") ? car_length:truck_length;
    var vehWidth=(vehType === "car") ? car_width:truck_width;

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
			    0.8*speedInit,vehType); // IC
      iveh++;
    }
  }

  // merge with already existing obstacles and other vehicle-like objects 
  // such as red traffic lights 

  for(var ivehplus=0; ivehplus<iveh; ivehplus++){
    this.veh[nVehOld+ivehplus]=vehPlus[ivehplus];
  }

  this.updateEnvironment(); // includes sorting

}//initRegularVehicles





//######################################################################
// change number of lanes
//######################################################################

road.prototype.addOneLane = function(){
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

road.prototype.subtractOneLane = function(){

    for(var i=this.veh.length-1; i>=0; i--){ 
	console.log("road.subtractOneLane: old nLanes=",this.nLanes);
	if(this.veh[i].lane=== (this.nLanes-1)){
	    this.veh.splice(i,1);
	}
    }
    this.nLanes--; 
}







//######################################################################
// write/print/display vehicle info
//######################################################################

road.prototype.writeVehicles= function(umin,umax) {
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

road.prototype.writeVehiclesSimple= function(umin,umax) {
    console.log("  in road.writeVehiclesSimple(): roadID=",this.roadID,
		" nveh=",this.veh.length,
		" nLanes=",this.nLanes," itime=",itime);

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


road.prototype.writeVehiclesSimpleToFile= function(filename) {

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

road.prototype.writeSpeedlimits= function(umin,umax) {
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

road.prototype.writeVehiclesIDrange= function(idmin,idmax) {

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

road.prototype.writeVehicleRoutes= function(umin,umax) {
    console.log("\nin road.writeVehicleRoutes: ID=",this.roadID,
		" length=",parseFloat(this.roadLen).toFixed(1),
		" nveh=",this.veh.length,
		" itime=",itime, "\n",
		"  duTactical=",this.duTactical,
		"  offrampIDs=",this.offrampIDs,
		"  lastExits=",this.offrampLastExits);

    var uminLoc=(typeof umin!=='undefined') ? umin : 0;
    var umaxLoc=(typeof umax!=='undefined') ? umax : this.roadLen;

    for(var i=0; i<this.veh.length; i++){
	var u=this.veh[i].u;
	if((u>uminLoc) && (u<umaxLoc) 
	   &&(this.veh[i].route.length>0)){

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

road.prototype.writeDepotVehObjects= function(umin,umax){
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

road.prototype.writeTrafficLights= function(umin,umax) {
  console.log("itime=",itime," in road.writeTrafficLights:",
	      " writing the road's operational TL objects",
	      " roaroadID=",this.roadID,
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

road.prototype.writeVehicleLongModels= function(umin,umax) {
    console.log("\nin road.writeVehicleLongModels(): ID=",this.roadID,
		" nveh=",this.veh.length,
		" itime="+itime);

    var uminLoc=(typeof umin!=='undefined') ? umin : 0;
    var umaxLoc=(typeof umax!=='undefined') ? umax : this.roadLen;

    for(var i=0; i<this.veh.length; i++){
      if((this.veh[i].u>=uminLoc)&&(this.veh[i].u<=umaxLoc)){
	console.log(" veh["+i+"].type="+this.veh[i].type
		    +"  id="+this.veh[i].id
		    +"  u="+parseFloat(this.veh[i].u,10).toFixed(1)
		    +"  v="+parseFloat(this.veh[i].v,10).toFixed(1)
		    +"  speed="+parseFloat(this.veh[i].speed,10).toFixed(3)
		    +"  v0="+parseFloat(this.veh[i].longModel.v0).toFixed(3)
		    +"  T="+parseFloat(this.veh[i].longModel.T).toFixed(1)
		    +"  s0="+parseFloat(this.veh[i].longModel.s0).toFixed(3)
		    +"  a="+parseFloat(this.veh[i].longModel.a).toFixed(3)
		    +"  b="+parseFloat(this.veh[i].longModel.b).toFixed(3)
		    +"  noiseAcc="
		    +parseFloat(this.veh[i].longModel.noiseAcc).toFixed(3)
		    +"  acc="+parseFloat(this.veh[i].acc).toFixed(3)
		    +"");
      }
  }
}



//######################################################################
// write vehicle LC model info
//######################################################################

road.prototype.writeVehicleLCModels= function() {
    console.log("\nin road.writeVehicleLCModels(): ID=",this.roadID,
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

road.prototype.writeTrucksLC= function() {
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


    // initialize for "no success"

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


    // initialize for "no success"

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





/**
#############################################################
(jun17) get nearest distance of the road axis (center)
 to an external physical position
@return [distance in m, u in m, v in lanes]

Notice1: u discretized to width of road segments, typically about 10 m
see also this.get_xPix(u,v,scale), this.get_yPix(u,v,scale)

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


/**
#############################################################
(jun17) test whether user initiated a change of road geometry (CRG)
#############################################################

triggered by a mousedown or touchdown (first touch)
event with corresp phys coordinates 
at or near a road element 

@param   xUser,yUser: phys. coordinates corresp to mousedown/touchdown event
@return  array [success,Deltax,Deltay]
         Deltax/y gives distance vecto trigger point - nearest road element,
         dist_min=sqrt(Deltax^2+Deltay^2)
@internally set: iPivot=index of this element, xPivot=xUser, yPivot=yUser
*/

road.prototype.testCRG=function(xUser,yUser){
    var distCrit=0.8*this.nLanes*this.laneWidth; // 0.5 => only inside road
    var dist2_min=1e9;
    for(var i=0; i<=this.nSegm; i++){
	var dist2=Math.pow(xUser-this.xtab[i],2) + Math.pow(yUser-this.ytab[i],2);
	if(dist2<dist2_min){
	    dist2_min=dist2;
	    this.iPivot=i;
	    this.xPivot=xUser;
	    this.yPivot=yUser;
	}
    }
    var dist_min=Math.sqrt(dist2_min);
    var success=(dist_min<=distCrit);

    //console.log("road.testCRG: dist_min=",dist_min," distCrit=",distCrit);

    if(success){
	console.log("road.testCRG: new CRG event initiated!",
		    " dist_min=",Math.round(dist_min),
		    " iPivot=",this.iPivot,
		    " xPivot=",Math.round(this.xPivot),
		    " yPivot=",Math.round(this.yPivot)
		   )
    }
    return[success,dist_min,
	   this.xPivot-this.xtab[this.iPivot],
	   this.yPivot-this.ytab[this.iPivot]];
}



/**
#############################################################
(jun17) "drag" road at pivot according to user interaction
#############################################################

called as long as mouse is down/screen touched and this.testCRG(..)[1]=true
width of the affected region=>this.kernelWidth

if called with 5 parameters, a change of road geometry near the common 
section of the other road "otherRoad" 
(where it is parallel for merging/diverging) 
is only possible parallel to the "otherRoad"

@param  xUser,yUser: phys. coordinates corresp 
        to mousedown/touchdown event
@param  otherRoad (optional):  other road with common merge/diverge
@param  uBegin (optional): position (own road) of beginning merge or diverge 
        before the change
@param  commonLen: length of common merge/diverge section 
@return void; road segments are moved acording to changes in xtab, ytab
*/

road.prototype.doCRG=function(xUser,yUser,otherRoad,uBegin,commonLen){

    var considerMergeRoad=!(typeof otherRoad === 'undefined');

    var iPiv=this.iPivot; // making code easier to read/write
    var ic=this.icKernel; 
    var imin=(this.isRing) ? iPiv-ic : Math.max(iPiv-ic, 0);
    var imax=(this.isRing) ? iPiv+ic : Math.min(iPiv+ic, this.nSegm);
    var deltaXmax=xUser-this.xtabOld[iPiv];
    var deltaYmax=yUser-this.ytabOld[iPiv];
    var deltaX=[];
    var deltaY=[];
    for (var i=imin; i<=imax; i++){ 
	deltaX[i]=deltaXmax*this.kernel[i-iPiv+ic];
	deltaY[i]=deltaYmax*this.kernel[i-iPiv+ic];
    }


    // block for considering otherRoad (never ring road)

    var inflLen=40; // max distance from merge for influence

    if(considerMergeRoad){

	for (var i=imin; i<=imax; i++){

	    var u=i*this.roadLen/this.nSegm;

            // test for influence and influence acordingly

	    if((u>uBegin-inflLen)&&(u<uBegin+commonLen+inflLen)){
		var urelBeg=(uBegin-u)/inflLen;
		var urelEnd=(u-uBegin-commonLen)/inflLen;
		var approachFact=(u<uBegin)
		    ? Math.pow(Math.sin(0.5*Math.PI*urelBeg),2)
		    : (u>uBegin+commonLen)
		    ? Math.pow(Math.sin(0.5*Math.PI*urelEnd),2) : 0;

                // find nearest target point and determine 
                // tangential and normal unit vectors

		var uOther=this.getNearestUof(otherRoad,u);
		var phiOther=otherRoad.get_phi(uOther,this.traj);
		var e=[]; // tangential target unit vector
		e[0]=Math.cos(phiOther); 
		e[1]=Math.sin(phiOther); 

		var deltaXold=deltaX[i];
		var deltaYold=deltaY[i];

                // correction deltaR_corr=approachFact*deltaR
                // +(1-approachFact)*(deltaR.e)*e

		var deltaR_dot_e=deltaXold*e[0]+deltaYold*e[1];
		deltaX[i] = approachFact * deltaXold
		       +(1-approachFact) * deltaR_dot_e * e[0];
		deltaY[i] = approachFact * deltaYold
		       +(1-approachFact) * deltaR_dot_e * e[1];
	    }
	}
    }

    // special case if the influence region is near the end => onramp
    // shift merging region

    if(considerMergeRoad&&(this.nSegm-imax<0.05*this.nSegm)){
	console.log("doCRG: in special case !");
	var iminOn=Math.round(this.nSegm*uBegin/this.roadLen);
	imin=Math.min(imin, iminOn);
	imax=this.nSegm;
	for (var i=iminOn; i<=this.nSegm; i++){

	    var u=i*this.roadLen/this.nSegm;
	    var uOther=this.getNearestUof(otherRoad,u);
	    var phiOther=otherRoad.get_phi(uOther,this.traj);
	    var e=[];
	    e[0]=Math.cos(phiOther);
	    e[1]=Math.sin(phiOther);
	    var deltaR_dot_e=deltaXmax*e[0]+deltaYmax*e[1];
	    deltaX[i] =deltaR_dot_e * e[0];
	    deltaY[i] =deltaR_dot_e * e[1];
	}
    }


    for (var i=imin; i<=imax; i++){
	var itab=i;
	if(isRing){
	    if(i<0){itab+=this.nSegm+1;}
	    if(i>this.nSegm){itab-=(this.nSegm+1);}
	}

	//console.log("end of road.doCRG: i=",i," itab=",itab,
	//	    " imax=",imax," nSegm=",this.nSegm,
	//	    " deltaX[i]=",deltaX[i]," deltaY[i]=",deltaY[i]);
	this.xtab[itab]=this.xtabOld[itab]+deltaX[i];
	this.ytab[itab]=this.ytabOld[itab]+deltaY[i];
    }

  if(false){
    console.log("\nend doCRG: this.xtab.length=",this.xtab.length);
    for(var j=0; j<20; j++){
      var u=j*this.roadLen/20;
      console.log("u=",u,
		  " this.traj[0](u)=",this.traj[0](u),
		  " this.trajGrid_x(u)=",this.trajGrid_x(u),
		  " this.trajGrid_y(u)=",this.trajGrid_y(u)
		 );
    }
  }
} // end doCRG





 // detect the fucking NaN's 

road.prototype.testForNaN=function(){ // detect the fucking NaN's 
    for(var i=0; i<this.nSegm; i++){
	if(isNaN(this.xtab[i]) ||isNaN(this.ytab[i])){
	    console.log("!! i=",i," NaN's in xtab or ytab!!");
	}
    }
}


// helper function for the kernel

road.prototype.createKernel=function(){
    var dphi=0.5*Math.PI/this.icKernel;
    this.kernel[this.icKernel]=1;
    for (var di=1; di<=this.icKernel; di++){
	this.kernel[this.icKernel+di]=Math.pow(Math.cos(di*dphi),4);//!!
	this.kernel[this.icKernel-di]=this.kernel[this.icKernel+di];
    }
}

/**
#############################################################
(jun17) do final cleanup after dragging interaction has finished
#############################################################

by doCRG,  xtab[], ytab[] are changed according to user action
but no longer equidistant => scale is distorted and traj_xy(u) no longer 
correct. finishCRG resamples the tabs to make them equidistant and also
changes the number of segments if new curvature is added/removed
*/

road.prototype.finishCRG=function(){
    console.log("in finishCRG()");

    // first smooth locally since afterwards (after resampling)
    // this.iPivot no longer valid



    // calculate new road length and changed u-coordinate waypoints
    // based on present xtab[],ytab[]

    var chdUPoints=[];
    chdUPoints[0]=0;
    for (var i=1; i<=this.nSegm; i++){
	chdUPoints[i]=chdUPoints[i-1]
	    + Math.sqrt(
		Math.pow(this.xtab[i]-this.xtab[i-1],2)
		    + Math.pow(this.ytab[i]-this.ytab[i-1],2)
	    );
    }
    this.roadLen=chdUPoints[this.nSegm];


    // re-segmentate the road to equal-length road segments
    // (no in-line change of xtab,ytab since traj_xy depends on them)
 
    var xtabNew=[];
    var ytabNew=[];
    var iUpper=1;

    // first and last point: iNew=i

    xtabNew[0]=this.xtab[0];
    ytabNew[0]=this.ytab[0];
    xtabNew[this.nSegm]=this.xtab[this.nSegm];
    ytabNew[this.nSegm]=this.ytab[this.nSegm];

    for (var inew=1; inew<this.nSegm; inew++){
	var unew=inew*this.roadLen/this.nSegm;
	while(chdUPoints[iUpper]<unew){iUpper++;}
	var du=chdUPoints[iUpper]-chdUPoints[iUpper-1];
	var rest=(unew-chdUPoints[iUpper-1])/du; // in [0,1]
	xtabNew[inew]=(1-rest)*this.xtab[iUpper-1]+rest*this.xtab[iUpper];
	ytabNew[inew]=(1-rest)*this.ytab[iUpper-1]+rest*this.ytab[iUpper];

 	if(false){
	    var drnew=Math.sqrt(Math.pow(xtabNew[inew]-xtabNew[inew-1],2)
				+ Math.pow(ytabNew[inew]-ytabNew[inew-1],2));
	    console.log("inew=",inew," iUpper=",iUpper,
			" rest=",rest,
			" xtabNew[inew]=",xtabNew[inew],
			" ytabNew[inew]=",ytabNew[inew],
			" \nTest: drnew=dunew=sqrt(...)=",drnew
		       )
	}
    }

    // transfer to xtab,ytab => local functions this.traj_xy redefined

    for (var i=0; i<=this.nSegm; i++){

	this.xtab[i]=xtabNew[i];
	this.ytab[i]=ytabNew[i];
	this.xtabOld[i]=xtabNew[i];
	this.ytabOld[i]=ytabNew[i];
    }

    // change number of segments and re-sample again 
    // (this also makes road smoother)

    this.update_nSegm_tabxy(); // needs updated this.xytab for traj_xy!! 

  //this.traj=[this.trajGrid_x,this.trajGrid_y];
    // test output

    if(false){
	console.log("in road.finishCRG() before resetting xytab, xytabOld:");
	console.log(" xytabOld: before drag")
	console.log(" xytab: after dragging action, distorted");
	console.log(" xytabnew: after dragging action, corrected");
	console.log("new roadLen=this.roadLen=",this.roadLen);
	for (var i=0; i<=this.nSegm; i++){
	    console.log("i=",i,
			" xytabOld=",Math.round(this.xtabOld[i]),
			"",Math.round(this.ytabOld[i]),
			" xytab=",Math.round(this.xtab[i]),
			"",Math.round(this.ytab[i]),
			" xytabNew=",Math.round(xtabNew[i]),
			"",Math.round(ytabNew[i]),
			" du=",parseFloat(chdUPoints[i]-chdUPoints[Math.max(i-1,0)]).toFixed(2),
			" duNew=",parseFloat(this.roadLen/this.nSegm).toFixed(2)
		       );
	}
    }


} // road.prototype.finishCRG


/**
#############################################################
(jun17) locally smooth road
#############################################################
needed when user brought in too much sharp/abrupt curves
smoothes with maxiumum half-width iWidth 
(total number of points 2*iWidth+1) centered at index iCenter
*/

road.prototype.smoothLocally=function(iCenter, iWidth){
    //console.log("in road.smoothLocally: iCenter=",iCenter," iWidth=",iWidth);
    var xtabNew=[];
    var ytabNew=[];
    for (var i=0; i<=this.nSegm; i++){
	xtabNew[i]=0;
	ytabNew[i]=0;
    }

    var imin=Math.max(1, iCenter-iWidth);
    var imax=Math.min(this.nSegm-1, iCenter+iWidth);
    var iw=Math.min(iCenter-imin, imax-iCenter); // <=iWidth

    // apply smoothing to xytabNew

    for (var i=iCenter-iw; i<=iCenter+iw; i++){
	var distCenter=Math.abs((i-iCenter));

        //var iwLoc=Math.max(0, iw-distCenter);
	var iwLoc=iw;

	var iwLimit=Math.min(i, this.nSegm-i);
	iwLoc=Math.min(iwLoc, iwLimit);

        // smooth with moving averages

	var nSmooth=2*iwLoc+1;
	//console.log("smoothLocally: i=",i," iCenter=",iCenter," iWidth=",iWidth,
	//	    " iw=",iw," iwLoc=",iwLoc," nSmooth=",nSmooth);


        // generate triang kernel

	var kern=[];
	var norm=0;
	for(var j=0; j<=2*iwLoc; j++){
	    norm += 1 - Math.abs(j+0.-iwLoc)/iwLoc;
	}
	for(var j=0; j<=2*iwLoc; j++){
	    kern[j]=(1-Math.abs(j+0.-iwLoc)/iwLoc)/norm;
	}
	if(iwLoc===0){
	    xtabNew[i]=this.xtab[i];
	    ytabNew[i]=this.ytab[i];
	}
	else{
	    for(var j=-iwLoc; j<=iwLoc; j++){
	        xtabNew[i] += this.xtab[i+j] * kern[iwLoc+j];
	        ytabNew[i] += this.ytab[i+j] * kern[iwLoc+j];
	    }
	}
	if(false){console.log("smoothLocally: i=",i,
		    " xtabNew[i]=",xtabNew[i],
		    " this.xtab[i]=",this.xtab[i]);
		 }
    }

    // test if successful

    for (var i=iCenter-iw; i<=iCenter+iw; i++){
	if(isNaN(xtabNew[i]) || isNaN(ytabNew[i])){
	    console.log("road.SmoothLocally: i=",i," iCenter=",iCenter, 
			"iw=",iw,": xtabNew[i] or ytabNew[i] are NaN's!"
			+"\ndoing nothing");
	    return;
	}
    }


    // copy to this.xytab

    for (var i=iCenter-iw; i<=iCenter+iw; i++){
	this.xtab[i]=xtabNew[i];
	this.ytab[i]=ytabNew[i];
    }

} // road.smoothLocally


/**
#############################################################
(jun17) Smooth road
#############################################################
needed when user brought in too much sharp/abrupt curves
*/

road.prototype.smooth=function(){
    var n=this.nSegm;
    var xtabNew=[];
    var ytabNew=[];
    for (var i=0; i<=n; i++){
	xtabNew[i]=0;
	ytabNew[i]=0;
    }


    // middle points: full kernel

    var ic=this.icKernel;
    var norm=0;
    for (var j=-(ic-1); j<ic-1; j++){
	norm += this.kernel[ic+j];
    }
    //console.log("center smoothing: ic=",ic," norm=",norm);

    for(var i=ic-1; i<=n-(ic-1); i++){
	for(var j=-(ic-1); j<ic-1; j++){
	    xtabNew[i]+=this.kernel[ic+j]/norm * this.xtab[i+j];
	    ytabNew[i]+=this.kernel[ic+j]/norm * this.ytab[i+j];
	}
    }


    // boundary points: only center part of kernel

    for(var i=0; i<ic-1; i++){
	norm=0;
	for (var j=-i; j<=i; j++){norm+= this.kernel[ic+j];}
	//console.log("boundary points: i=",i," norm=",norm);
	for (var j=-i; j<=i; j++){
	    xtabNew[i]+=this.kernel[ic+j]/norm * this.xtab[i+j];
	    xtabNew[n-i]+=this.kernel[ic+j]/norm * this.xtab[n-i+j];
	    ytabNew[i]+=this.kernel[ic+j]/norm * this.ytab[i+j];
	    ytabNew[n-i]+=this.kernel[ic+j]/norm * this.ytab[n-i+j];

	}
    }

    // bring smoothed info into xytab
    if(false){
        console.log("leaving road.smooth: n=this.nSegm=",n);
        for(var i=0; i<=n; i++){
	    console.log("i=",i," xtabOld=",this.xtab[i]," xtabNew=",xtabNew[i]);
	}
    }


    for (var i=0; i<n; i++){
	this.xtab[i]=xtabNew[i];
	this.ytab[i]=ytabNew[i];
    }

} // road.smooth()

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

    // add the new vehicles to the array

    for(var i=0; i<types.length; i++){

        // !! later on directly (if types internally = integer)
	var type=(types[i]===0) ? "car" :
	    (types[i]===1) ? "truck" : "obstacle";
	var lane=Math.round(lanesReal[i]);
        var vehNew=new vehicle(lengths[i],widths[i], 
			       longPos[i],lane, speeds[i], type);
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

	  if(deepCopying){
	    this.veh[k].longModel.copy(newLongModel);
	  }

	  else{
	    this.veh[k].longModel=newLongModel;
	  }

	}
    }
  }
}//updateTruckFrac


//#####################################################
// get network info of offramps attached to this road (for routing)
// see also updateModelsOfAllVehicles
//#####################################################

road.prototype.setOfframpInfo
 =function(offrampIDs,offrampLastExits,offrampToRight){
     this.offrampIDs=offrampIDs;  
     this.offrampLastExits=offrampLastExits; // road.u at end of diverge
     this.offrampToRight=offrampToRight; // whether offramp is to the right
     console.log("\nin road.setOfframpInfo: ID=",this.roadID,
		 "  offrampIDs=",offrampIDs,
		 "  this.offrampIDs=",this.offrampIDs);

 }



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




//##################################################################
// get next offramp index for a given longitudinal position u (routing)
//##################################################################

road.prototype.getNextOffIndex=function(u){
    var index=-1;
    var success=false;
    var duNearest=this.roadLen;

    // this.offrampLastExits[iOff] increasing with iOff
    for(var iOff=0; iOff<this.offrampIDs.length; iOff++){
	var uExit=this.offrampLastExits[iOff];
	var du=(uExit>u) ? uExit-u : 10000*this.roadLen;
	if((this.isRing)&&(uExit<u)){du=uExit-u+this.roadLen;}
	if(du<duNearest){index=iOff; duNearest=du;}
    }
    return index;
      
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

      if(deepCopying){
        if(this.veh[i].type==="car"){this.veh[i].longModel.copy(longModelCar);}
        if(this.veh[i].type==="truck"){this.veh[i].longModel.copy(longModelTruck);}
      }

      else{
        if(this.veh[i].type==="car"){this.veh[i].longModel=longModelCar;}
        if(this.veh[i].type==="truck"){this.veh[i].longModel=longModelTruck;}
      }

    }
  }
}



//#####################################################
// set vehicles in range to new lane change models
// (useful for modeling local overtaking bans, 
// local necessity/desire to drive right etc)
//#####################################################


road.prototype.setLCModelsInRange
    =function(umin,umax,LCModelCar,LCModelTruck){
	//console.log("within road.setLCModelsInRange: LCModelTruck=",LCModelTruck);
    for(var i=0; i<this.veh.length; i++){
	var u=this.veh[i].u;
	if((u>umin)&&(u<umax)){
	    if(this.veh[i].type==="car"){this.veh[i].LCModel=LCModelCar;}
	    if(this.veh[i].type==="truck"){this.veh[i].LCModel=LCModelTruck;
					   //console.log("u=",u," veh[i].LCModel=",this.veh[i].LCModel);
					  }
	}
    }
}


//#####################################################
// set vehicles in range to mandatory LC 
// (useful for non-routing related mandatory LC onramps (no offramps), e.g.
// onramps or before lane closings
// see also updateModelsOfAllVehicles
//#####################################################

road.prototype.setLCMandatory=function(umin,umax,toRight){
    for(var i=0; i<this.veh.length; i++) if(this.veh[i].isRegularVeh()){
	var u=this.veh[i].u;
	if((u>umin)&&(u<umax)){
	    this.veh[i].toRight=toRight;
	    this.veh[i].LCModel=(toRight) 
		? this.LCModelMandatoryRight : this.LCModelMandatoryLeft;
            //console.log("in road.setLCMandatory: this.veh[i].LCModel=",
	//		this.veh[i].LCModel);
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
    var iLag=(i===n-1) ? 0 : i+1;
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
	    this.veh[i].acc =(this.veh[i].isRegularVeh()) 
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

      // MT 2019-09: quick hack since left vehicles always a bit
      // faster than right ones: "push on right

      if((this.veh[i].lane==this.nLanes-1)&&(this.veh[i].speed>1.5)){
	this.veh[i].speed+=0.05*dt;
      }

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

road.prototype.changeLanes=function(){
    if(false){ //!!
	this.writeVehicles();
	var testLongTruck=new ACC(IDMtruck_v0,IDMtruck_T,IDM_s0,IDMtruck_a,IDM_b);
	var testLongTruckIDM=new IDM(IDMtruck_v0,IDMtruck_T,IDM_s0,IDMtruck_a,IDM_b);
	s= 85.7;  speed= 18.7;  speedLead= 15.7;  accLead= 0.7;
	var testACC=testLongTruck.calcAcc(s,speed,speedLead,accLead);
	var testIDM=testLongTruckIDM.calcAcc(s,speed,speedLead);
	console.log("testLongTruck=",testLongTruck," testACC=",testACC);
	console.log("testLongTruckIDM=",testLongTruck," testIDM=",testIDM);

    }

    this.doChangesInDirection(1); // changes to right 
    this.doChangesInDirection(0); // changes to left 
}





road.prototype.doChangesInDirection=function(toRight){
  // this.updateEnvironment(); //!!!DOS, bisher auch n noetig
  var log=false;


  if(false){console.log("\nchangeLanes: before changes to the ",
		       ((toRight) ? "right" : "left"));
	  }

// outer loop over all vehicles of a road; filter for regular vehicles

  for(var i=0; i<this.veh.length; i++)
  if((this.veh[i].u>this.uminLC)&&(this.veh[i].isRegularVeh())){



    // test if there is a target lane 
    // and if last change is sufficiently long ago

    var newLane=(toRight) ? this.veh[i].lane+1 : this.veh[i].lane-1;
    var targetLaneExists=(newLane>=0)&&(newLane<this.nLanes);
    var lastChangeSufficTimeAgo=(this.veh[i].dt_afterLC>this.waitTime)
	&&(this.veh[i].dt_lastPassiveLC>0.2*this.waitTime);

    if(false){ //!!!
    //if(itime==100){
    //if(this.veh[i].id==207){
      console.log("road.doChangesInDirection: vehID= ",this.veh[i].id,
		 " time=",time," i=",i,
		  " targetLaneExists=",targetLaneExists,
		  " lastChangeSufficTimeAgo=",lastChangeSufficTimeAgo);
    }


    if(targetLaneExists && lastChangeSufficTimeAgo){

      var iLead=this.veh[i].iLead;
      var iLag=this.veh[i].iLag; // actually not used
      var iLeadNew=(toRight) ? this.veh[i].iLeadRight : this.veh[i].iLeadLeft;
      var iLagNew=(toRight) ? this.veh[i].iLagRight : this.veh[i].iLagLeft;

      // check if also the new leader/follower did not change recently

	//console.log("iLeadNew=",iLeadNew," dt_afterLC_iLeadNew=",this.veh[iLeadNew].dt_afterLC," dt_afterLC_iLagNew=",this.veh[iLag].dt_afterLC); 

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
	var sNew=this.veh[iLeadNew].u - this.veh[iLeadNew].len - this.veh[i].u;
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
	var accNew=this.veh[i].longModel.calcAcc(
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
	    =this.veh[iLagNew].longModel.calcAcc(
	      sLagNew,speedLagNew,speed,accNew); 
      
         // final MOBIL incentive/safety test before actual lane change
         // (regular lane changes; for merges, see below)


	 //var log=(this.veh[i].type==="truck");
	 var log=false;
	//var log=true;

	var MOBILOK=this.veh[i].LCModel.realizeLaneChange(
	  vrel,acc,accNew,accLagNew,toRight,log);
    

         // only test output

         //if(MOBILOK&&(this.veh[i].id===107)){
        //if(true){
	if(false){
        //if(MOBILOK){
        //if(this.veh[i].id==206){

	  console.log(
	    "vehicle id",this.veh[i].id,
	    " LCModel.realizeLaneChange:",
	    " acc=",acc.toFixed(3)," accNew=",accNew.toFixed(3),
	    " accLagNew=",accLagNew.toFixed(3)," toRight=",toRight,
	    " bThr=",this.veh[i].LCModel.bThr.toFixed(3),
	    " bBiasRight=",this.veh[i].LCModel.bBiasRight.toFixed(3),
	    " MOBILOK=",MOBILOK);

	  if(true){
	     var s=this.veh[iLead].u-this.veh[iLead].len-this.veh[i].u;
	     var accLead=this.veh[iLead].acc;
	     var speed=this.veh[i].speed;
	     var speedLead=this.veh[iLead].speed;
	     var accCalc=this.veh[i].longModel.calcAcc(
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
    
    

	 changeSuccessful=(this.veh[i].isRegularVeh())
	      &&(sNew>0)&&(sLagNew>0)&&MOBILOK;

        //!!! MT 2019-09: prevent trucks to change to the left by force

	if(!(typeof scenarioString === 'undefined')){
	  if((scenarioString=="OnRamp_BaWue")
	     ||(scenarioString=="roadworks_BaWue")){
	    if(changeSuccessful&&(this.veh[i].type==="truck")&&(!toRight)){
	      console.log("road.doChangesInDirection(): preventing truck by force to change to the left, check why this happens:\n vehicle=",this.veh[i]);
	      changeSuccessful=false;
	    }
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
  }
  //return changeSuccessful;
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

* The conflict checks are first taken after having passed the decision
  point (a few meters upstream of the stopping point uSource) and, 
  if one check is negative, repeated in every timestep 
  until all checks are passed


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
@param speed:      (optional) the maxspeed at transition (default none)
@param targetPrio: (optional) if true, cautious, 
                         otherwise aggressive entering regarding the target
                         back vehicles (bsafe)

each conflict has the components
.roadConflict: the (external) road causing the potential conflict
.dest:         filters destinations for the external vehicles 
               possibly leading to a conflict. []=all, [0,3]: dest 0 and 3
.ucOther:    conflict point for the filtered external vehicles on ext road
.ducExitOwn: difference to conflict point from the exit of subject's old road

 */



road.prototype.connect=function(targetRoad, uSource, uTarget,
				offsetLane, conflicts, maxspeed,
			       targetPrio){

  if(typeof conflicts === 'undefined'){conflicts=[];}
  var maxspeedImposed=(!(typeof maxspeed === 'undefined'));
  var targetHasPiority=(typeof targetPrio === 'undefined')
      ? false : targetPrio;
  var bsafe=(targetHasPiority) ? 2.5 : 15; //!!! longModel.bmax=10


  if(false){
    console.log("\n\nbegin road.connect: t=",time.toFixed(2),
		" this.roadLen=",this.roadLen.toFixed(1),
		" targetRoad.roadID=",targetRoad.roadID,
		" uSource=",uSource.toFixed(1),
		" uTarget=",uTarget.toFixed(1),
		" offsetLane=",offsetLane,
		" conflicts=",conflicts,
		" maxspeedImposed=",maxspeedImposed,
		"");
    if(false){this.writeVehiclesSimple();}
  }
  
  var duAntic=60;
  var duDecision=10;
  // uGo defined later once longModel.s0 is known

  var uAntic=uSource-duAntic;
  var uDecide=uSource-duDecision;

  var targetID=targetRoad.roadID;
  var potentialConflictsExist=(conflicts.length>0);

  // check if there are candidates and, if so, influence them

  for(var iveh=0; iveh<this.veh.length; iveh++){

    //#########################################################
    // central debugging!!! also is copied to
    // "var log" in determineConflicts    
    //#########################################################

    connectLog=false;
    //this.connectLog=(this.veh[iveh].id==213);
    //this.connectLog=((this.veh[iveh].id==209)&&(time>20)&&(time<25));
    //this.connectLog=(this.veh[iveh].id==225)||(this.veh[iveh].id==226);
    //this.connectLog=(this.veh[iveh].id==210)&&(targetID==3);
    //this.connectLog=((this.veh[iveh].id==230)||(this.veh[iveh].id==227));
    
    var ringKO=(this.isRing)
	&&(this.veh[iveh].u>uSource+1.5*dt*this.veh[iveh].longModel.v0);
    // veh is candidate if in anticipation regime and regular veh
    if((this.veh[iveh].isRegularVeh())&&(!ringKO)
       &&(this.veh[iveh].u>uSource-duAntic)){
 

      //oder arraysEqual((this.trajAlt[itr].route, this.veh[i].route))// !

      // check if route is consistent with targetID
      // Array.indexOf(a) gives index of the first element==a, and-1 if none
      
      var connecting=(this.veh[iveh].route.indexOf(targetID)>=0);
 
      /* 
       only further treatment if veh regular, in influence range,
       and route fits to this connector

       If through-lane,
	 test if there are potential conflicts.

	 if through-lane and potential conflicts, do one of three actions
	 depending on five conditions;

       virtual road lines:
         uAntic =uSource-duAntic                 "braking zone"
         uDecide=uSource-duDecision              "unconditional decision zone"
	 uGo    =uSource-max(1.2*s0, 0.2*duDecision)  "final go if conflicts"
            (should be <uSource-s0, otherw too timid approaching, but works)

       conditions (C1-C3 disjunct and complete, u<uAntic treated above):
         C1: ((u>uAntic)&&(u<=uDecide))       "braking zone"
         C2: ((u>uDecide)&&(u<=uGo))          "unconditional decision zone"
         C3: (u>uGo)                          "final go if conflicts resolved"

         C4: laneContinues
         C5: conflictsExist                   "conflicts in previous step"
             (saved from vehConnect.conflicts in previous time step)
         C6: potentialConflictsExist

       actions:
         A1: try to change lanes possibly changing C4 in the next step
             (cannot use possible changes at once since lane changing later)
         A2: decide possibly changing C5
         A3: decelerate (IDM) to a virtual veh at uSource (stop @ gap s0) 
         A4: go ahead taking care of traffic on the target road

       connect actions with conditions (in this order)
         if( !C4 )                     then A1 -> C4
         if( C4 && (C2||(C3&&C5)) )    then A2 -> C5 (cannot use updated C4)
         if( (!C4) || C1 || C5 )       then A3       (can use updated C5)
         if( (!C6) || (!C5) && C4 && (C2||C3) ) then A4

       =>
         if( !C4 )                  then A1 -> C4
         else{
           if( !C6 )                then A4
           else{
             if ( C2 || (C3&&C5) )  then A2 -> C5
             if ( (!C5)&&(C2||C3) ) then A4    (use updated C5)
             else A3
           }
         }

 
*/

      
      
      if(connecting){
	//console.log(" veh ",this.veh[iveh].id," is connecting");

	var vehConnect=this.veh[iveh];
	var id=vehConnect.id;
	var u=vehConnect.u;
	var lane=vehConnect.lane;
	var v=vehConnect.v;
	var speed=vehConnect.speed;
	var s0=vehConnect.longModel.s0;
	var uGo=uSource-Math.max(1.2*s0,0.2*duDecision);
	//var uGo=uSource;
	var sStop=uSource-u; // should stop s0 upstream of uConnect
	var accSlowdown=vehConnect.longModel.calcAcc(sStop,speed,0,0);

	// state variables

	var conflictsExist=vehConnect.conflictsExist; // from previous step
	var laneContinues=((lane+offsetLane>=0)
			   &&(lane+offsetLane<targetRoad.nLanes));
	var C1=((u>uAntic)&&(u<=uDecide));  // braking zone
        var C2=((u>uDecide)&&(u<=uGo));     // unconditional decision zone
        var C3=(u>uGo);                     // final go if conflicts resolved


	if(this.connectLog){
	  console.log("\n\nroad.connect: t=",time.toFixed(2),
		      " veh id=",id,
		      " route=",this.veh[iveh].route,
		      " u=",u.toFixed(1),
		      " speed=",speed.toFixed(1),
		      " acc=",vehConnect.acc.toFixed(1),
		      " uAntic=",uAntic.toFixed(1),
		      " uDecide=",uDecide.toFixed(1),
		      " uGo=",uGo.toFixed(1),
		      " uSource=",uSource.toFixed(1),
		      "\n              C1=",C1,
		      "  C2=",C2," C3=",C3,
		      " laneContinues=",laneContinues,
		      " conflictsExist=",conflictsExist,
		      " potentialConflictsExist=",potentialConflictsExist,
		      " maxspeedImposed=",maxspeedImposed,
		      "");
	}
		    

        // Decide and do actions


        // Action A1: impose bias to change lanes if no through lane
	// (actual lane-changing action done at a later stage)
	// (check if I can do the decel action A2 here as well,
	// i.e., without an
	// additional virtual standing obstacle on the closing lane)

	if(!laneContinues){//!! need forbidding changing back to the
	                   // closing lane?
	  var toRight=(lane+offsetLane<0);
	  var bBiasRight=((toRight) ? 1 : -1)*10;
	  var accOld=vehConnect.acc;
	  vehConnect.LCModel.bBiasRight=bBiasRight;     // !! influence
	  vehConnect.acc=Math.min(accOld, accSlowdown); // !! influence
	  if(this.connectLog){
	    console.log("  Action A1:",
			" setting LC bias of ",bBiasRight, " to veh ",id,
			"\n  Action A3: decelerate with accel ",
			accSlowdown.toFixed(1));
	  }
	}
      

	// Decisions/Actions A2-A4:
	// take decision if laneContinues and in decision zone
	// if in zone C2, allow reverting decision later
        // see ../README_IntersectionsVarNetworks.txt
	// (vehConnect.conflictsExist from previous time step)

	if(laneContinues){ 

	  // Prepare Action A4 assuming at the moment no conflicts
	  // determine if, in this case, the target road can be entered
	  // follower need not brake more than bsafe)
	  // and if so, at which acceleration accGo
	  
	  //targetLeaderInfo and targetFollowerInfo=[success,index]
	  // if no success, index=-1
	  // !! since TL is always obstacle
	  // (type=="obstacle" lowercase, no function!!),
	  // check for TL not needed
	  var followerInfo
	      = targetRoad.findFollowerAtLane(uTarget,lane+offsetLane);
	  var followerExists // no follower complication if road not left!
	      =followerInfo[0]&&(this.roadID!=targetRoad.roadID)
	      &&(!(targetRoad.veh[followerInfo[1]].type=="obstacle"));
	  //&&(!(targetRoad.veh[followerInfo[1]].isTrafficLight()));
	  if(this.connectLog){console.log("\n\nFollowerExists=",followerExists,"\n\n\n");}
	  var iFollow=followerInfo[1];
	  var uFollow=(followerExists)
	      ? targetRoad.veh[iFollow].u : -1000000;
	  var speedFollow=(followerExists)
	      ? targetRoad.veh[iFollow].speed : 0;
	  var sFollow=(followerExists)
	      ? uTarget-(uSource-u)-vehConnect.len - uFollow : 1000000;
	  var leaderInfo
	      = targetRoad.findLeaderAtLane(uTarget,lane+offsetLane);
	  var leaderExists // same filter as follower
	      =leaderInfo[0]&&(this.roadID!=targetRoad.roadID)
	      &&(!(targetRoad.veh[leaderInfo[1]].type=="obstacle"));
	  var iLead=leaderInfo[1];
	  var uLead=(leaderExists)
	      ? targetRoad.veh[iLead].u : +1000000;
	  var speedLead=(leaderExists)
	      ? targetRoad.veh[iLead].speed : 0;
	  var lenLead=(leaderExists)?targetRoad.veh[iLead].len : 0;
	  var sLead=(leaderExists) 
	      ? uLead-uTarget+(uSource-u)-lenLead : 100000;

	  if(this.connectLog){
	    console.log("  Preparation (i): id=",vehConnect.id,
			" uTarget=",uTarget.toFixed(1),
		        " lane+offsetLane=",lane+offsetLane,
		        " target-leaderExists=",leaderExists,
			" targetfollowerExists=",followerExists);
	    if(leaderExists){console.log("  leader id==",
					 targetRoad.veh[iLead].id,
					 "sLead=",sLead);}
	    if(followerExists){console.log("  follower id=",
					   targetRoad.veh[iFollow].id,
					   "sFollow=",sFollow);}
	    //targetRoad.writeVehiclesSimple();
	  }

	  
	  // analyse target road in detail if near to it
	  // and possibly switch leaders/followers to anticipated vehs
	  
          // !! assume for target-road investigation free acceleration; may be overridden by checking the conflicts (own assumed acceleration for calculating time tc at conflict/collision point) and also by previous vehicles, only for calculating tc for the scenario "final go" ,=> the relevant target-road anticipated leaders and followers



	  if(C2||C3){
	    var du=uSource-u;
	    var accFree=vehConnect.longModel.calcAcc(100000,speed,speed,0);
	    var tc=-speed/accFree
		+Math.sqrt(Math.pow(speed/accFree,2)+2*du/accFree);

	    // use anticipated instead of instantaneous follower
	    
	    if(followerExists){ // true follower at uTarget at present
	      var anticipatedFollowerExists=(uFollow+speedFollow*tc<uTarget);

	      // see comments at "update_iLead" no follower if iLag<=iFollow
	      var iLag=targetRoad.veh[iFollow].iLag;

	      if(this.connectLog){
		console.log(
	      "  (1a): in C2||C3 and target follower exists: before checking",
		"anticipated follower: old idFollow=",
		targetRoad.veh[iFollow].id,
		  "\n       tc=expected dt @u Source->uTarget=",tc.toFixed(1),
		  " uFollow+speedFollow*tc=",
		  (uFollow+speedFollow*tc).toFixed(1),
		  "uTarget=",uTarget.toFixed(1),
		  " anticipatedFollowerExists=",
		  anticipatedFollowerExists,
		"");
	      }

	      //while(false){ // !omit anticipation of future leader/follower
	      //!!influence
	      while((!anticipatedFollowerExists)&&(iLag>iFollow)){
		iFollow=targetRoad.veh[iFollow].iLag; //!! recursively!!
		uFollow=targetRoad.veh[iFollow].u; // new follower candidate
		speedFollow=targetRoad.veh[iFollow].speed;
		anticipatedFollowerExists=(uFollow+speedFollow*tc<uTarget);
		iLag=targetRoad.veh[iFollow].iLag;
		if(this.connectLog)console.log("iFollow=",iFollow,
			    " idFollow=",targetRoad.veh[iFollow].id);
	      }
	      if(this.connectLog){
		console.log(
		  "  (1b): in C2||C3 and target follower exists:",
		  "after checking",
		  " anticipatedFollowerExists=",
		  anticipatedFollowerExists,
		  "idFollow=",targetRoad.veh[iFollow].id);
	      }
	    }

	    // anticipated leader: just the veh ahead of anticipated follower
            // none if veh[iFollow].iLead>=iFollow

	    // !! Because anticipation is complicated in full generality,
	    // sometimes anticipatedFollowerExists although not the case
	    // then uFollow=-100000 is the clue
	    if(uFollow<-100000){ anticipatedFollowerExists=false;}

	    if(anticipatedFollowerExists){ // otherwise use initialisation
	      sFollow=(uTarget-uFollow) + (uSource-u) - vehConnect.len
		- speedFollow*tc; // !! antic


	      if(false){
		console.log("before crash: veh id=",vehConnect.id,
			    " sFollow=",sFollow,
			    " uFollow=",uFollow,
			    " targetRoad.veh[iFollow]=",
			    targetRoad.veh[iFollow]);
	      }


	      //!!influence
	      leaderExists=(targetRoad.veh[iFollow].iLead<iFollow);
	      
	      if(leaderExists){//!!influence
		iLead=(targetRoad.veh[iFollow].iLead);//!! recursive
		uLead=targetRoad.veh[iLead].u;
		speedLead=targetRoad.veh[iLead].speed;
		lenLead=targetRoad.veh[iLead].len;
		sLead=uLead-uTarget+(uSource-u)-lenLead
		+ speedLead*tc; // !! antic
	      }
	      if(this.connectLog){
		console.log(
		  "  (1c): in C2||C3,",
		  "new anticipated follower != present follower exists!",
		  "\n    new follower id=",targetRoad.veh[iFollow].id,
		  "anticipated sFollow=",sFollow.toFixed(1));
		if(leaderExists){
		  console.log(
		    "    new leader id=",targetRoad.veh[iLead].id,
		    " sLead="+sLead.toFixed(1));
		}
	      }
	      
	    }
	  } // if(C2||C3)
	  
	  
	  //########################################################
	  // determine target road entrance conditions | no conflicts
	  //########################################################

	  
          // (ii) default if not any limitations except a possible maxspeed

	  // if maxspeed imposed, set virtual obstacle
	  // the braking distance v^2/(2*b) after transition point

	  var targetCanBeEntered=true; //!! influence
	  var s=1000000;
	  if(maxspeedImposed){
	    var ds=0.5*maxspeed*maxspeed/vehConnect.longModel.b
	    s=(uSource-u)+ds;
	    //console.log("    ds=",ds," s=",s);
	  }
	  var accDefault=vehConnect.longModel.calcAcc(s,speed,0,0);
	  var accGo=accDefault;
	  if(this.connectLog){
	    console.log("  Preparation (ii): Potential acceleration if",
			"neither conflicts nor target restrictions:",
			"accDefault=accGo=",accDefault);
	  }


	  // (iii) allow entrance always if farther away and determine
	  // accelerations: IDM accel to leader if no follower
	  // otherwise accStop

	  if(leaderExists){
	    //var lenLead=targetRoad.veh[iLead].len;
	    //var s=uLead-lenLead-uTarget+(uSource-u);
	    var accLead=targetRoad.veh[iLead].acc;

	    accGo=Math.min(accDefault, vehConnect.longModel.calcAcc(
	      sLead,speed,speedLead,accLead)); // !! influence
	    if(this.connectLog){
	      console.log("  Preparation (iiia): leaderExists: leader id=",
			  targetRoad.veh[iLead].id," s=",s," accGo=",
			  accGo," = min(free acc, target leader acc)");}


	    // do not enter if targetroad vehicles do not allow to pass
	    // the conflict point uTarget+ducExitOwn of any relevant conflicts
	    // (avoid congestion gridlock)
	    
	    if(potentialConflictsExist){ // only reference to conflicts here
	      var ducExitMax=0; // max dist between uTarget and conflict
	      for(var ic=0; ic<conflicts.length; ic++){
		ducExitMax=Math.max(conflicts[ic].ducExitOwn,ducExitMax);
		if(this.connectLog){
		  console.log("  Preparation (iiib): ic=",ic,
			      "conflicts[ic]=",
			      conflicts[ic]);
		}
	      }
	      if(uLead-lenLead-vehConnect.len-2*s0<ducExitMax){
		targetCanBeEntered=false; // !! influence
	      }
	      
	      if(this.connectLog){
		console.log("  Preparation (iiib): leader and",
			    "potential conflicts exist:",
			    "targetCanBeEntered=",targetCanBeEntered,
			    "s to target leader s=",s.toFixed(1),
			    "speedLead=",speedLead.toFixed(1),
			    "accLead=",accLead.toFixed(1),
			    "accGo=",accGo.toFixed(1));
		if(true){
		  console.log("    uLead=",uLead,
			      "lenLead=",lenLead,
			      "vehConnect.len=",vehConnect.len,
			      "2*s0=",2*s0,
			      "uSource=",uSource,
			      "ducExitMax=",ducExitMax,
			      "targetCanBeEntered=",targetCanBeEntered);
			 }
	      }
	      
	    }
	  }
	  else if(this.connectLog){
	    console.log("  Preparation (iii): no target leader exists");
	  }


	  // (iii) calculation whether it is safe to merge in
	  // front of followers
	  // only sensible if near to target road, i.e., (C2||C3)

	  
	  if(followerExists){
	    if(C2||C3){ // then always braking in region C1
	      //already calc, possibly antic
	      //var sFollow=uTarget-(uSource-u)-vehConnect.len - uFollow;
	      var accLead=vehConnect.acc;
	      var accFollow=targetRoad.veh[iFollow].longModel.calcAcc
	      (sFollow,speedFollow,speed,vehConnect.acc);
	      if(accFollow<-bsafe){
	        targetCanBeEntered=false; // !! influence
		accGo=-vehConnect.longModel.bmax; //!!
	      }
	      if(this.connectLog){
	        console.log(
		  "  Preparation (iv): (C2||C3) and target follower exists:",
		  "targetCanBeEntered=",targetCanBeEntered,
		  "id=",vehConnect.id,
		  "idFollow=",targetRoad.veh[iFollow].id,
		 // "u-uGo=",(u-uGo).toFixed(1),
		 // "u-uSource=",(u-uSource).toFixed(1),
		  // "uFollow=",uFollow.toFixed(1),
		  "targetRoad.veh[iFollow].longModel.cool=",targetRoad.veh[iFollow].longModel.cool,
		  "sFollow=",sFollow.toFixed(1),
		  "speedFollow=",speedFollow.toFixed(1),
		  "speed=",vehConnect.speed.toFixed(1),
		  "accFollow=accACC(sFollow,speedFollow,speed)=",
		  accFollow.toFixed(1),
		  "bsafe=",bsafe.toFixed(1),
		  "accGo=",accGo);
	      }
	    }
	    


	    // slow down if leaders and not in (C2||C3),
	    // even w/o conflicts or conflicts cleared
	    
	    else{
	      accGo=accSlowdown; // !! influence
	      if(this.connectLog){
	        console.log(
		  "  Preparation (iv): outside (C2||C3) and target follower",
		  "exists: accGo=",accGo);
	      }
	    }

	  }

	    

	  
	  if(this.connectLog){
	    console.log("  Prepare Action A4 assuming no conflicts",
			" and check entrance to target",
			" id=",vehConnect.id,
			"nvehTarget=",targetRoad.veh.length,
			" leaderExists=",leaderExists,
			" followerExists=",followerExists,
			"\n    targetCanBeEntered=",targetCanBeEntered,
			" accGo=",accGo.toFixed(2));
	  }
	 


	  // Decision A2 without potential conflicts: Directly go ahead
	  
	  if(!potentialConflictsExist){
	    vehConnect.conflictsExist=false;
	  }

	  // Action A2 with potential conflicts
	  // neeed first to determine if traffic on target road allows
	  // a transition and, if so, at which potential acceleration accGo 
	  // before evaluating the conflicts

	  // check even if targetCanBeEntered=false because, while
	  // !targetCanBeEntered, the vehicle can move to the "go" zone
	  // where a revision to a positive conflict can no more be done
	  // so, when targetCanBeEntered becomes true, conflicts are not
	  // updated
	  
	  else if (C2||(C3&&conflictsExist)){ 
	  //else if (targetCanBeEntered && (C2||(C3&&conflictsExist)) ){ 
	    if(this.connectLog){
	      console.log("  Action A2: potential conflicts possible",
			  //" C2=",C2," C3=",C3,
			  //" conflictsExist=",conflictsExist,
			  " calling determineConflicts(..)");
	    }

	    //#################################################
	    conflictsExist  //!! influence
	      =this.determineConflicts(vehConnect,uSource,uTarget,
				       conflicts,targetRoad);
	    //#################################################
	    
	    vehConnect.conflictsExist=conflictsExist; //!! influence
	  }


	  var accOld=vehConnect.acc;
	  var conflictsAllowPassing
	      =((!potentialConflictsExist) || ((!conflictsExist)&&(C2||C3)));

	  // Action A3: laneContinues but conflicts exist
	  // and/or in zone C2 and/or !targetCanBeEntered

	  if (!(conflictsAllowPassing&&targetCanBeEntered)){
	    vehConnect.acc=Math.min(accOld, accSlowdown); // !! influence
	    if(this.connectLog){
	      console.log("  Action 3: decelerating to stop",
			  " accOld=",accOld.toFixed(1),
			  " accSlowdown=",accSlowdown.toFixed(1),
			  "");
	    }
	  }


	  // Action A4: Go ahead but consider vehicles on target road
	  // for jam propagation

	  else{
	    vehConnect.acc=Math.min(accOld,accGo); // !!influence
	    
	    if(this.connectLog){
	      console.log("  Action 4: ready to go",
			  " veh id=",vehConnect.id,
		          " route=",vehConnect.route," targetID=",targetID,
		          " uSource-u=",(uSource-u).toFixed(1),
		          " speed=",vehConnect.speed.toFixed(1),
		          " accOld=",accOld.toFixed(1),
		          " accGo=",accGo.toFixed(1),
		          " acc=",vehConnect.acc.toFixed(1),
		          "");
            }
	    

	  }

	  
	} // laneContinues==true



	// Action A5: actual transfer!!

      
	if((u>uSource)&&(this.roadID!=targetRoad.roadID)){
	  if(this.connectLog){
	  //if(this.veh[iveh].id==210){
	    console.log("  Action 5: All previous actions drove the vehicle",
			"over uSource => actual transfer");
	  }


	  // vehicleNeighborhood is deep copy=>do splice actions on original
	  // Array.splice(position, howManyItems, opt_addedItem1,...) 

	  if(false){
	    console.log("\nbefore splicing:",
			" this.veh.length=",this.veh.length,
			" testVeh=",testVeh,
			" targetRoad.veh.length=",targetRoad.veh.length,
			"");
	    this.writeVehiclesSimple();
	    targetRoad.writeVehiclesSimple();
	  }


	  // watch out that an array is returned by splice!
	  var transferredVeh=(this.veh.splice(iveh,1))[0];
	  this.updateEnvironment();

          // transform state vars of transferred vehicle
	  transferredVeh.u=uTarget+u-uSource;
	  transferredVeh.lane=lane+offsetLane;
	  //transferredVeh.v=transferredVeh.lane;

	  // following two settings to perform an immediate LC w/o past memory
          // if there is a single-lane target road
	  // (v changed in update_v_dvdt_optical in paths.js)
	  
	  if(targetRoad.nLanes==1){
	  //if(false){
	    transferredVeh.dt_afterLC=0; // otherwise, veh may change at once
	    transferredVeh.laneOld=transferredVeh.lane;
	  }
	  if(this.connectLog){
	  //if(true){
	    console.log(
	    "  \n=========================================================",
	      "\nt=",time.toFixed(2)," itime=",itime,
	      " transfer veh ",transferredVeh.id,
	    "from road ",this.roadID," u=",u.toFixed(1),
	    "lane=",lane," v=",v.toFixed(1),
	    "to road ",targetRoad.roadID,
	    "at u=",transferredVeh.u.toFixed(1),
	      "lane=",transferredVeh.lane,
	      "laneOld=",transferredVeh.laneOld,
	      "v=",transferredVeh.v.toFixed(1),
	    "\ntransferredVeh=",transferredVeh,
	      "\n=========================================================");
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
	  console.log("exiting road.connect: itime=",itime,
		      "vehConnect.id=",vehConnect.id,
		      "speed=",vehConnect.speed.toFixed(1),
		      "acc=",vehConnect.acc.toFixed(1),
		      "");
	}
      } // if(connecting)
    } // veh in anticipation regime and regular veh


    
  } // loop over all road vehicles
  
} // road.prototype.connect


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
    console.log("\n=====================================================",
		"\nroad.determineConflicts for veh ",vehConnect.id,":",
		"t=",time.toFixed(1));
  }

  for(var ic=0; (ic<conflicts.length)&&noConflictDetected; ic++){

    // remaining distance of the subject veh to collision point

    var ducExitOwn=conflicts[ic].ducExitOwn;
    var duOwn=(uSource-u) + ducExitOwn;//OK

    // expected time to reach collision point
    
    var acc=vehConnect.longModel.calcAcc(10000,speed,speed,0);
    var tc=-speed/acc+Math.sqrt(Math.pow(speed/acc,2)+2*duOwn/acc);

    // determine the existence of actual conflicts
    
    var xtc=-10000; //=gap s
    var vehsConflict=conflicts[ic].roadConflict.veh;
    var goOnCrit=(vehsConflict.length>0);

    if(log){
      console.log(
	"  check conflict", ic,"caused by road ",
	conflicts[ic].roadConflict.roadID,":",
	"uSource-u=", (uSource-u).toFixed(1),
	"ducExitOwn=", ducExitOwn.toFixed(1),
	"duOwn=",duOwn.toFixed(1),
	"\n                                       speed=",
	speed.toFixed(1),
	"acc=",acc.toFixed(2),"tc=",tc.toFixed(1),
	"vehsConflict.length=",vehsConflict.length,
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
	    "  in conflicting veh loop: vehConflict.id=",
	    vehConflict.id,
	    "isCandidate=",isCandidate);
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
	    console.log("  determineConflicts, checking candidates:",
			"vehConflict.id=",vehConflict.id,
			"indexOrigin=",indexOrigin,
			"conflictDestID=",conflictDestID,
			"conflicts[ic].dest=", conflicts[ic].dest,
			"isCandidate=",isCandidate);
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
	  "      veh ",vehConnect.id,
	  ": conflicting veh ID:",vehConflict.id,
	  " uOther=",vehConflict.u.toFixed(1),
	  " ucOther=",ucOther.toFixed(1),
	  " speedOther*tc=",(vehConflict.speed*tc).toFixed(1),
	  " ducOther_after_tc=",ducOtherVeh.toFixed(1),
	  "\n                                          xtc=",xtc.toFixed(1),
	  " ttc=",ttc.toFixed(1),
	  " noConflictDetected=",noConflictDetected,
	    " goOnCrit=",goOnCrit,
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
	      "\nGraphics: vehConnect ",vehConnect.id,
	      "OD ",this.roadID,targetRoad.roadID,
	      "conflicts with road ID=",conflicts[ic].roadConflict.roadID,
	      "veh ",vehConflict.id,"having route=",vehConflict.route,
	      "\n    xConflictOwn (basic target traj)=",
	      xConflictOwn.toFixed(1),
	      "yConflictOwn=",yConflictOwn.toFixed(1),
	      "\n    xConflictOther                  =",
	      xConflictOther.toFixed(1),
	      "yConflictOther=",yConflictOther.toFixed(1),
	      "duOwn(now)=",duOwn.toFixed(1),
	      "ducOtherVeh(now)=",(ucOther-vehConflict.u).toFixed(1),
	      "ducOther(tConflict)=",ducOtherVeh.toFixed(1),
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
  if(log){console.log("Leaving determineConflicts, conflictsExist=",
		      conflictsExist,
		      "\n=============================================\n\n");}
  return conflictsExist;

}//road.determineConflicts




//######################################################################
// functionality for merging and diverging to another road. 
//######################################################################
/*
In both cases, the road change is from the road calling this function
to the road in the argument list. Only the immediately neighboring 
lanes of the two roads interact. The rest must be handled in the
strategic/tactical lane-change behaviour of the drivers: 
long models set to longModelTactical* and LC models to LCModelTactical*
if the route of vehicles contains next off-ramp in distance < duTactcal ahead

!!Note1: if ignoreRoute=false, a diverge can only happen for vehicles with 
routes containing this offramp and not for other/undefined routes. The default is ignoreRoute=true. This is favourable for 
interactive routing games ("routing by traffic lights"). Also in this case, 
the probability for vehicles to diverge is greater if on the route because of
the route-specific tactical LC behaviour 
(at the moment, feature, not bug because of routing games/playing with TL)

Note2: If neither the changing vehicles have priority (prioOwn=false) 
nor the through-lane vehicles (prioOther=false), 
discretionary or forced merging takes place depending on bSafe*

@param newRoad: the road to which to merge or diverge
@param offset:  difference[m] in the arclength coordinate u 
                between new and old road
@param uBegin:  begin[m] of the merging/diverging zone in old-road coordinates
@param uEnd:    end[m] of the merging/diverging zone in old-road coordinates
                Notice: If merge, exclude virtual vehicle pos from u-range!
@param isMerge: if true, merge; otherwise diverge. 
@param toRight: direction of the merge/diverge.
@param ignoreRoute: (optional) if true, diverges take place 
                whenever MOBIL agrees 
                (default: false for diverging, true for merging)
@param prioOther: (optional) if true, respect the priority of the 
                target-lane (through-lane) vehicles (default: false)
@param prioOwn: (optional) if true, trespect the priority of the 
                own merging lane (default: false)

@return:        void. Both roads are affected!
*/

//!!!!
road.prototype.mergeDiverge=function(newRoad,offset,uBegin,uEnd,
				     isMerge,toRight,ignoreRoute,
				     prioOther, prioOwn){

    var log=false;
    //var log=(this.roadID==0);    
    //var log=(this.roadID==0)&&isMerge;    
    //var log=((this.roadID===10)&&(this.veh.length>0)&&(!isMerge));


    var padding=this.padding; // visib. extension for orig drivers to target vehs
    var paddingLTC=           // visib. extension for target drivers to orig vehs
    (isMerge&&prioOwn) ? this.paddingLTC : 0;

    var loc_ignoreRoute=(typeof ignoreRoute==='undefined')
	? false : ignoreRoute; // default: routes  matter at diverges
    if(isMerge) loc_ignoreRoute=true;  // merging must be always possible

    var loc_prioOther=(typeof prioOther==='undefined')
	? false : prioOther;

    var loc_prioOwn=(typeof prioOwn==='undefined')
	? false : prioOwn;
    if(loc_prioOwn&&loc_prioOther){
	console.log("road.mergeDiverge: Warning: prioOther and prioOwn",
		    " cannot be true simultaneously; setting prioOwn=false");
	loc_prioOwn=false;
    }




    // (1) get neighbourhood
    // getTargetNeighbourhood also sets [this|newRoad].iTargetFirst

    var uNewBegin=uBegin+offset;
    var uNewEnd=uEnd+offset;
    var originLane=(toRight) ? this.nLanes-1 : 0;
    var targetLane=(toRight) ? 0 : newRoad.nLanes-1;

    var originVehicles=this.getTargetNeighbourhood(
	uBegin-paddingLTC, uEnd, originLane); // padding only for LT coupling!

    var targetVehicles=newRoad.getTargetNeighbourhood(
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
	console.log("\n\nin road.mergeDiverge: itime=",itime,
		    " ID=",this.roadID,
		    " targetVehicles.length=",targetVehicles.length,
		    " originVehicles.length=",originVehicles.length);
  }

  // (2) Both for merge and diverge: select changing vehicle (if any): 
  // only one at each calling; the first vehicle has priority!


  // (2a) immediate success if no target vehicles in neighbourhood
  // and at least one (real) origin vehicle: the first one changes

  var success=( (targetVehicles.length===0)&&(originVehicles.length>0)
		&& originVehicles[0].isRegularVeh()
		&& (originVehicles[0].u>=uBegin) // otherwise only LT coupl
		&& (loc_ignoreRoute||originVehicles[0].divergeAhead));
  if(log){console.log(" road.mergeDiverge: 2a:  success=",success);}
  if(success){iMerge=0; uTarget=originVehicles[0].u+offset;}

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
		console.log(" i=",i,
			    " isRegularVeh=",originVehicles[i].isRegularVeh(),
			    " loc_ignoreRoute=",loc_ignoreRoute,
			    " originVehicles[i].divergeAhead=",
			    originVehicles[i].divergeAhead);
      }

      if(originVehicles[i].isRegularVeh()
	 &&(loc_ignoreRoute||originVehicles[i].divergeAhead) ){

              //inChangeRegion can be false for LTC since then paddingLTC>0
	      var inChangeRegion=(originVehicles[i].u>uBegin); 

	      uTarget=originVehicles[i].u+offset;

              // inner loop over targetVehicles: search prospective 
              // new leader leaderNew and follower followerNew and get the gaps
              // notice: even if there are >0 target vehicles 
              // (that is guaranteed because of the inner-loop conditions),
              //  none may be eligible
              // therefore check for jTarget==-1

	      var jTarget=-1;;
	      for(var j=0; j<targetVehicles.length; j++){
		var du=targetVehicles[j].u-uTarget;
		if( (du>0)&&(du<duLeader)){
		    duLeader=du; leaderNew=targetVehicles[j];
		}
		if( (du<0)&&(du>duFollower)){
		    jTarget=j; duFollower=du; followerNew=targetVehicles[j];
		}
		if(log){
		    console.log(" i=",i," j=",j," jTarget=",jTarget,
				" du=",du," duLeader=",duLeader,
				" duFollower=",duFollower);

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
	      var accNew=originVehicles[i].longModel.calcAcc(
		  sNew,speed,speedLeadNew,accLeadNew);
	      var accLag=followerNew.acc;
	      var accLagNew =originVehicles[i].longModel.calcAcc(
		  sLagNew,speedLagNew,speed,accNew);


 

              // MOBIL decisions

	      var prio_OK=(!loc_prioOther)||loc_prioOwn
		  ||(!LCModel.respectPriority(accLag,accLagNew));

	      var MOBILOK=LCModel.realizeLaneChange(
		  vrel,acc,accNew,accLagNew,toRight,false);

	      success=prio_OK && inChangeRegion && MOBILOK 
		  && (originVehicles[i].isRegularVeh())
		  && (sNew>0) && (sLagNew>0);
	  
	      if(log&&(this.roadID===10)){
		  console.log("in road.mergeDiverge: roadID="+this.roadID
			      +" LCModel.bSafeMax="+LCModel.bSafeMax);
	      }
	      if(success){iMerge=i;}

              // test: should only list reg vehicles with mergeAhead=true; 
              // check its number if suspicious happens with this var !!

	if(success&&log){
	      //if(true){
		console.log("testing origin veh "+i +" type="
			    +originVehicles[i].type+" uTarget="+uTarget);
		console.log("divergeAhead=",originVehicles[i].divergeAhead);
	        console.log("  sNew="+sNew+" sLagNew="+sLagNew);
	        console.log("  speed="+speed +" speedLagNew="+speedLagNew);
	        console.log("  acc="+acc+" accNew="+accNew+" accLagNew="+accLagNew);
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

	for(var j=0; j<targetVehicles.length; j++){
	    var sStop=stopLinePosNew-targetVehicles[j].u; // gap to stop for target veh
	    var speedTarget=targetVehicles[j].speed;
	    var accTargetStop=targetVehicles[j].longModel.calcAcc(sStop,speedTarget,0,0);
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
			=targetVehicles[j].longModel.calcAcc(s,speedTarget,speedOrig,0); 
		    var accTarget=Math.min(targetVehicles[j].acc,
					   Math.max(accLTC, accTargetStop));
		    if(accTarget>-bSafe){
			targetVehicles[j].acc=accTarget;
			if(this.markVehsMerge){targetVehicles[j].colorStyle=3;}
		    }
		}
		else{ // if last orig not leading, stop always if it can be done safely
		    if(accTargetStop>-bSafe){
			var accTarget=Math.min(targetVehicles[j].acc,accTargetStop);
			targetVehicles[j].acc=accTarget;
			if(this.markVehsMerge){targetVehicles[j].colorStyle=3;}
		    }
		}
		//if(this.roadID==7){
		if(false){
		    console.log("target id=",targetVehicles[j].id,
				" iLast id=",originVehicles[iLast].id,
				" lastOrigIsLeader=",lastOrigIsLeader,
				" sStop=",parseFloat(sStop).toFixed(1),
				" accTargetStop=",parseFloat(accTargetStop).toFixed(1),
				" acc=",parseFloat(targetVehicles[j].acc).toFixed(1)
			       );
		}
	    }

	}
    }

    /*
		  if((itime*dt>12)&&(this.roadID==7)&&(jTarget>-1)){
		      console.log("in road.mergeDiverge, ",
				  " LT coupling to acc other road",
				  " id=",this.roadID,
				  " t=",parseFloat(itime*dt).toFixed(2),
				  " iOrigin=",i,
				  " jTarget=",jTarget,
				  " target follower: ID=",followerNew.id,
				  " u befure update=",
				  parseFloat(followerNew.u).toFixed(2),
				  " speed before=",
				  parseFloat(followerNew.speed).toFixed(2),
				  " acc=",
				  parseFloat(accLagYield).toFixed(2)
		  );
		  }
	      }
*/
    

    //(4) if success, do the actual merging!

    if(success){// do the actual merging 

        //originVehicles[iMerge]=veh[iMerge+this.iTargetFirst] 

	var iOrig=iMerge+this.iTargetFirst;
	if(false){
	//if(true){
	    console.log("Actual merging: merging origin vehicle "+iOrig
			+" of type "+this.veh[iOrig].type
			+" from origin position "+this.veh[iOrig].u
			+" and origin lane"+originLane
			+" to target position "+uTarget
			+" and target lane"+targetLane); 
	    console.log(" this.veh[iOrig].divergeAhead)="
			+this.veh[iOrig].divergeAhead);

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

//####################################################################
	this.veh.splice(iOrig,1);// removes chg veh from orig.
        newRoad.veh.push(changingVeh); // appends changingVeh at last pos;
//####################################################################


	newRoad.updateEnvironment(); //  //includes newRoad.sortVehicles()

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
    //console.log("remaining number of special vehicles: ",this.veh.length);
}


//######################################################################
// update vehicle density by adding vehicles into largest gaps
// or removing some randomly picked vehicles (one at a time)
//!only regular vehicles count, no special vehicles or obstacles!
//######################################################################

road.prototype.updateDensity=function(density){
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
	    this.veh.splice(k,1); // remove vehicle at random position k
	} // if it is, do not try a second time; wait to the next round
    }

    // too few vehicles, generate one per time step in largest gap

    else if(nActual<nDesired){
	var maxSpace=0;
	var k=0; // considered veh index
	var success=false;
	var emptyLanes=false;

        // initialize attributes of new vehicle 
        // (later overwritten in most cases)

	var laneNew=0;
	var uNew=0.5*this.roadLen
	var vehType=(Math.random()<fracTruck) ? "truck" : "car";
	var vehLength=(vehType==="car") ? car_length:truck_length;
	var vehWidth=(vehType==="car") ? car_width:truck_width;
	var speedNew=0; // always overwritten

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
				    speedNew,vehType); //updateDensity

	    if(emptyLanes){vehNew.speed=longModelTruck.v0;}
	    this.veh.splice(k,0,vehNew); // add vehicle at position k  (k=0 ... n-1)
	}
    }
    // sort (re-sort) vehicles with respect to decreasing positions
    // and provide the updated local environment to each vehicle

    if(this.veh.length!=nTotOld){
	this.updateEnvironment(); // includes sorting
    }
} //updateDensity


//######################################################################
// downstream BC: drop at most one vehicle at a time (no action needed if isRing)
//######################################################################

road.prototype.updateBCdown=function(){
  if( (!this.isRing) &&(this.veh.length>0)){
    if(this.veh[0].u>this.roadLen){
      this.veh.splice(0,1);
      this.updateEnvironment();
    }
  }
}

//######################################################################
// upstream BC: insert vehicles at total inflow Qin
// (only applicable if !isRing)
// route is optional parameter (default: route=[])
//######################################################################


this.randomValBCup=1;
road.prototype.updateBCup=function(Qin,dt,route){

  var emptyOverfullBuffer=true; //!!
  var randomAmplitude=0.2; //this.randomValBCup between 1 +/-randomAmplitude


  this.route=(typeof route === 'undefined') ? [] : route; // handle opt. args

   //console.log("in road.updateBCup: inVehBuffer="+this.inVehBuffer);

  var smin=15; // only inflow if largest gap is at least smin
  var success=0; // false initially
  if(!this.isRing){
      this.inVehBuffer+=Qin*dt;
  }

  if((emptyOverfullBuffer)&&(this.inVehBuffer>2)){this.inVehBuffer--;}

		    
  
  if(this.inVehBuffer>=this.randomValBCup){
    this.randomValBCup=1+2*randomAmplitude*(Math.random()-0.5);
    // get new vehicle characteristics
    var vehType=(Math.random()<fracTruck) ? "truck" : "car";
    var vehLength=(vehType==="car") ? car_length:truck_length;
    var vehWidth=(vehType==="car") ? car_width:truck_width;
    var space=0; //available bumper-to-bumper space gap
    var lane=this.nLanes-1; // start with right lane
    if(this.veh.length===0){success=true; space=this.roadLen;}

    // if new veh is a truck, try to insert it at the rightmost lane
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
      
    if((!success) &&((!this.setTrucksAlwaysRight)||(vehType=="car"))){
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
 

    // actually insert new vehicle //IC

    if(success){
      var longModelNew=(vehType==="car") ? longModelCar : longModelTruck;
      var LCModelNew=(vehType==="car") ? LCModelCar : LCModelTruck;
      var uNew=0;

      //!!! MT 2019-09 hack since otherwise veh enter too fast 

      var v0New=0.9*Math.min(longModelNew.v0, longModelTruck.v0);
      var speedNew=Math.min(v0New, longModelNew.speedlimit,
				space/longModelNew.T);
      var vehNew=new vehicle(vehLength,vehWidth,uNew,lane,speedNew,vehType);
 
      if(deepCopying){
        vehNew.longModel=new ACC(); vehNew.longModel.copy(longModelNew);
        vehNew.LCModel=new MOBIL(); vehNew.LCModel.copy(LCModelNew);
      }
      else{vehNew.longModel=longModelNew;}

      vehNew.route=this.route;

      //!! define ego vehicles for testing purposes

      if(false){
	      var percEgo=5;
	      if(vehNew.id%100<percEgo){vehNew.id=1;}
      }

      this.veh.push(vehNew); // add vehicle after pos nveh-1
      this.updateEnvironment();
      this.inVehBuffer -=1;

      //if((lane!=this.nLanes-1)&&(vehType==="truck")){
      if(false){
	console.log("road.updateBCup: ID=",this.roadID,
			  " new vehicle at pos u=0, lane=",lane,
			  " type=",vehType," s=",space," speed=",speedNew);
	console.log(this.veh.length);
      }
      if(false){
	console.log("road.updateBCup: road",this.roadID,
		    "veh ",vehNew.id,"route ",vehNew.route);
      }
		   
    }
  }

}

//######################################################################
// get target vehicle neighbourhood/context for merging of other roads
// returns targetVehicles, an array of all vehicles on the target lane 
// inside the arclength range [umin, umax].
// Also sets iTargetFirst, the first vehicle (smallest i) within range
//!!! does not take care of specialities of ring roads
// => set "stitch" of ring road far away from merges
//######################################################################

road.prototype.getTargetNeighbourhood=function(umin,umax,targetLane){
    var targetVehicles=[];
    var iTarget=0;
    var firstTime=true;
    //console.log("getTargetNeighbourhood:");
    for (var i=0; i<this.veh.length; i++){
	//console.log("i=",i," nveh=",this.veh.length," u=",this.veh[i].u);
	if( (this.veh[i].lane===targetLane)&&(this.veh[i].u>=umin)&&(this.veh[i].u<=umax)){
	    if(firstTime===true){this.iTargetFirst=i;firstTime=false;}
	    targetVehicles[iTarget]=this.veh[i];
	    iTarget++;
	}
    }
    if(false){
        console.log("in road.getTargetNeighbourhood(umin="+umin+", umax="+umax
		  +", targetLane="+targetLane+")");
	for(iTarget=0; iTarget<targetVehicles.length; iTarget++){
	    console.log("targetVehicles["+iTarget+"].u="+targetVehicles[iTarget].u);
	}
    }
    return targetVehicles;
}


/*####################################################
 distribute model parameters updated from  GUI to all vehicles

  * LCModelMandatory will be divided into ...Right and ...Left inside

  * For preparing offramp diverges, a pair of new tactical models 
    LCModelTactical and longModelTacticalCar/Truck  
    will be constructed from the mandatory LC models and the longModels
    with the "new" operator. Necessary because otherwise v0 reduction
    of tactical models will be "copied" to all models since references!

  * Mandatory models apply to all vehicles in a certain range, tactical
    models only for the vehicles with corresponding routes in a certain range

//####################################################
*/

road.prototype.updateModelsOfAllVehicles=function(longModelCar,longModelTruck,
						  LCModelCar,LCModelTruck,
						  LCModelMandatory){

 //console.log("road.updateModelsOfAllVehicles: LCModelMandatory=",
  //		LCModelMandatory);


  // mandatory LC: distributed to the vehicles e.g. in setLCMandatory

    this.longModelTacticalCar=new ACC(longModelCar.v0,longModelCar.T,
				      longModelCar.s0,longModelCar.a,
				      longModelCar.b);
    this.longModelTacticalTruck=new ACC(longModelTruck.v0,longModelTruck.T,
				      longModelTruck.s0,longModelTruck.a,
				      longModelTruck.b);
 
    this.LCModelMandatoryRight
	=new MOBIL(LCModelMandatory.bSafe, LCModelMandatory.bSafeMax,
		   LCModelMandatory.p,
		   LCModelMandatory.bThr, LCModelMandatory.bBiasRight);
    this.LCModelMandatoryLeft
	=new MOBIL(LCModelMandatory.bSafe, LCModelMandatory.bSafeMax,
		   LCModelMandatory.p,
		   LCModelMandatory.bThr, -LCModelMandatory.bBiasRight);
    //console.log("road.LCModelMandatoryLeft=",this.LCModelMandatoryLeft);
    this.LCModelTacticalRight
	=new MOBIL(LCModelMandatory.bSafe, LCModelMandatory.bSafeMax,
		   LCModelMandatory.p,
		   LCModelMandatory.bThr, LCModelMandatory.bBiasRight);
    this.LCModelTacticalLeft
	=new MOBIL(LCModelMandatory.bSafe, LCModelMandatory.bSafeMax,
		   LCModelMandatory.p,
		   LCModelMandatory.bThr, -LCModelMandatory.bBiasRight);



  // normal acc and LC: 
  // distributed to the vehicles depending on car/truck here

  if(deepCopying){
    for(var i=0; i<this.veh.length; i++){
      if(this.veh[i].isRegularVeh()){
        this.veh[i].longModel.copy((this.veh[i].type === "car")
				   ? longModelCar : longModelTruck);
        this.veh[i].LCModel.copy((this.veh[i].type === "car")
				 ? LCModelCar : LCModelTruck);
      }
      if(false){
        console.log("updateModelsOfAllVehicles: type=",this.veh[i].type,
		  " speedl=",this.veh[i].longModel.speedlimit,
		  " longModelTruck.speedlimit=",longModelTruck.speedlimit);
      }
    }
  }

  else{
    for(var i=0; i<this.veh.length; i++){
      if(this.veh[i].isRegularVeh()){
        this.veh[i].longModel=(this.veh[i].type === "car")
	  ? longModelCar : longModelTruck;
        this.veh[i].LCModel=(this.veh[i].type === "car")
	  ? LCModelCar : LCModelTruck;
      }
    }
  }


  // check if on this road the driver should possibly prepare for diverging

  if(this.duTactical>0) for(var i=0; i<this.veh.length; i++){
  if(this.veh[i].isRegularVeh()){

      // get next offramp, whether on route or not (index=-1 if nothing)

      var iNextOff=this.getNextOffIndex(this.veh[i].u);
      var uLastExit=this.offrampLastExits[iNextOff];

      // test if the next off-ramp is nearby (dist< duTactical)

      var nextOfframpNearby=(this.veh[i].isRegularVeh())
	  && (iNextOff>-1)
	  && (uLastExit-this.veh[i].u<this.duTactical);


      if(nextOfframpNearby){
          if(false){console.log("in road.updateModels... iveh="+i
		      +" iNextOff="+iNextOff
		      +" u="+this.veh[i].u
		      +" uLastExit="+uLastExit);
		   }

        // test if the vehicle's route contains this off-ramp
	// !! Only here route is active

	  var offID=this.offrampIDs[iNextOff];
	  var route=this.veh[i].route;
	  var tacticalLC=false;
	  for(var ir=0; ir<route.length; ir++){
	      if(offID===route[ir]){tacticalLC=true;}
	  }

          // if so, change lanes in the direction of the diverge 
          // and reduce speed if coming very near to "last exit"
 
	  if(tacticalLC){
	    var thisVeh=this.veh[i];
	    var toRight=this.offrampToRight[iNextOff];
	    var duRemaining=uLastExit-thisVeh.u;
	    thisVeh.divergeAhead=true; //!!
	    if(deepCopying){
	      thisVeh.longModel.alpha_v0
		  =Math.max(0.1, 0.5*duRemaining/this.duTactical);
	    }
	    else{
	      thisVeh.longModel=(thisVeh.type==="truck")
		? this.longModelTacticalTruck : this.longModelTacticalCar;
	    }
	    thisVeh.LCModel=(toRight) ? this.LCModelTacticalRight
	          : this.LCModelTacticalLeft;

	    if(false){
		  console.log(
		  "road.updateModelsOfAllVehicles: apply tacticalLC to Veh "+i
	              +"!"
		      +" id="+thisVeh.id
		      + " route="+thisVeh.route
		      +" offID="+offID
		      +" u="+parseFloat(thisVeh.u).toFixed(1)
		      +" uLastExit="+parseFloat(uLastExit).toFixed(1)
		      +" bBiasRight="+thisVeh.LCModel.bBiasRight);
	    }
	  }

      } // nextOfframpNearby

      else{ // also for missed diverges
	  this.veh[i].divergeAhead=false;
      }

  }} // tactical accel and LC for diverges

}

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
      console.log("road.get_phi: id=",this.roadID,
		  " uLoc+du=",uLoc+du," uLoc-du=",uLoc-du,
		  " traj[0](uLoc+du)=",traj[0](uLoc+du),
		  " traj[0](uLoc-du)=",traj[0](uLoc-du),
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

    var smallVal=0.0000001;

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

road.prototype.get_xPix=function(u,v,scale){
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

road.prototype.get_yPix=function(u,v,scale){
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

road.prototype.draw=function(roadImg1,roadImg2,scale,changedGeometry,
			     umin,umax,
			     movingObs,uObs,xObs,yObs){

  var lSegm=this.roadLen/this.nSegm;

  //console.log("road.draw: lSegm=",lSegm);

  var noRestriction=(typeof umin === 'undefined');
  var movingObserver=(typeof movingObs === 'undefined')
    ? false : movingObs;
  var uRef=(movingObserver) ? uObs : 0;
  var xRef=(movingObserver) ? xObs : this.traj[0](0);
  var yRef=(movingObserver) ? yObs : this.traj[1](0);


  var smallVal=0.0000001;
  var boundaryStripWidth=0.3*this.laneWidth;

  var draw_curvMax=0.04; // curvature radius 25 m
  var factor=Math.min(1.5, // " stitch factor" for drawing
		      1+this.nLanes*this.laneWidth*draw_curvMax); 
  
  // lookup table only at beginning or after rescaling => 
  // now condition in calling program

  if(changedGeometry){
    //if(true){
    //if(Math.abs(scale-this.draw_scaleOld)>smallVal){
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

  //console.log("road.draw: ID=",this.roadID," nSegm=",this.nSegm,
//	      " noRestriction=",noRestriction);

  var lSegmPix=scale*factor*lSegm;
  var wSegmPix=scale*(this.nLanes*this.laneWidth+boundaryStripWidth);
  
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
	  "road.draw: ID=",this.roadID," iSegm=",iSegm,
	  " this.draw_y[iSegm]=",formd(this.draw_y[iSegm]),
	  " this.traj[1](this.roadLen-50)=",formd(this.traj[1](this.roadLen-50)),
	  " lSegmPix=",formd(lSegmPix)," wSegmPix=",formd(wSegmPix),
	  " xCenterPix=",formd(xCenterPix),
	  " yCenterPix=",formd(yCenterPix)
	);
      }
    }
  }

  // draw special trajectories (turnings etc) only stationary observer
  // and if drawAlternativeTrajectories (=false by default)
  
  if((!movingObserver)&&this.drawAlternativeTrajectories){
    for(var iTraj=0; iTraj<this.trajAlt.length; iTraj++){
      var nSegmAlt=(this.trajAlt[iTraj].umax-this.trajAlt[iTraj].umin)/lSegm;
      var trajAlt=[this.trajAlt[iTraj].x,this.trajAlt[iTraj].y];
      var laneMin=(typeof this.trajAlt[iTraj].laneMin === undefined)
	  ? 0 : this.trajAlt[iTraj].laneMin;
      var laneMax=(typeof this.trajAlt[iTraj].laneMax === undefined)
	  ? this.nLanes : this.trajAlt[iTraj].laneMax;

      
      var wSegmPix=scale*(laneMax-laneMin+1)
	  *this.laneWidth+boundaryStripWidth;
    
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



// separately because otherwise later roads overwrite road ID

road.prototype.drawRoadID=function(scale){
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

// types: 0="car", 1="truck", 2="obstacle" (including red traffic lights)
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




road.prototype.drawVehicles=function(carImg, truckImg, obstacleImg, scale,
				     speedmin,speedmax,umin,umax,
				     movingObs, uObs, xObs, yObs,
				     upright){

  // select trajectories (non-default only if turning left or right or
  // in roundabout)

  this.usedTraj_x=this.traj[0]; // default
  this.usedTraj_y=this.traj[1]; // default

  if(false){console.log("road.drawVehicles: traj init:",
				 " this.usedTraj_x=",this.usedTraj_x);}

    
  

  var noRestriction=(typeof umin === 'undefined');
  var movingObserver=(typeof movingObs === 'undefined')
      ? false : movingObs;
  var uRef=(movingObserver) ? uObs : 0;
  var xRef=(movingObserver) ? xObs : this.usedTraj_x(0);
  var yRef=(movingObserver) ? yObs : this.usedTraj_y(0);
  var xOffset=this.usedTraj_x(uRef)-xRef; // =0 for !movingObserver
  var yOffset=this.usedTraj_y(uRef)-yRef;


  for(var i=0; i<this.veh.length; i++){

    // do not draw vehicles outside limits
    // or if it is a virtual traffic-light vehicle (if TL is red)
    // unless debugging switch this.drawVehIDs is on

    var filterPassed=(true)  // for debugging thisif also TL IDs are shown
    var filterPassed=((!this.veh[i].isTrafficLight())||this.drawVehIDs)
	&& (noRestriction // default: noRestriction=true
	    || ((this.veh[i].u>=umin)&&(this.veh[i].u<=umax)));

    if(filterPassed){

      
      //!!! use side effect on this.usedTraj_xy, not testTraj
      // this only used for checkForCrashes and here for testing

      var testTraj=this.getTraj(this.veh[i]); 
      this.drawVehicle(i,carImg, truckImg, obstacleImg, scale,
			 speedmin,speedmax,[this.usedTraj_x,this.usedTraj_y],
			 xOffset,yOffset,upright);

      if(false){
	//if(this.veh[i].id==209){
	  console.log(
	    "drawVehicle after getTraj: roadID=",this.roadID,
	    " time=",time," vehid=",this.veh[i].id,
	    "testTraj=",testTraj);
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

//!!!! finally get rid of uOffset; only used in drawVehiclesGenTraj called only in the roundabout scenarios

road.prototype.drawVehicle=function(i,carImg, truckImg, obstacleImg, scale,
				    speedmin,speedmax,traj,
				    xOffset,yOffset,upright){

  var drawID=(typeof(displayIDs)==='undefined') ? false : displayIDs; 
  var phiVehRelMax=0.3;          // !! avoid vehicles turning too much
  var vehSizeShrinkFactor=0.85;  // to avoid overlapping in inner curves

 
    // (1) determine uCenter, vCenter in logical long/lat coordinates
    // v increasing from left to right, 0 @ road center
    // !!! update_v ... in paths.js  Influences veh[i].v
  
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
  // !!! special index 50-> obstacleImgs[1] etc 

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
				
  vehImg=(type==="car")
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
        var effLenPix=(type==="car") ? 0.95*vehLenPix : 0.90*vehLenPix;
        var effWPix=(type==="car") ? 0.55*vehWidthPix : 0.70*vehWidthPix;
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
	var textsize=0.018*Math.min(canvas.width,canvas.height);
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
	      console.log("in road.drawVehicle: itime=",itime,
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

  trafficObjects.trafficObj.sort(function(a,b){
	    return a.u - b.u;
  })

  // implement (all speedlimits should be set to 1000 prior to this action)

  var duAntic=50; // anticipation distance for  obeying the speed limit
  var success=false;
  for(var i=0; i<trafficObjects.trafficObj.length; i++){
    var obj=trafficObjects.trafficObj[i];
    if((obj.type==='speedLimit')&&(obj.isActive) 
       && (obj.road.roadID==this.roadID)){
      success=true;
      var speedL=obj.value/3.6;  // in m/s
      if(false){
	console.log("road.updateSpeedlimits: speed limit ",
		    formd(speedL)," starting at ",
		    formd(obj.u));
      }

      var iveh=0;
      while((iveh<this.veh.length)&&(this.veh[iveh].u>obj.u-duAntic)){
	var targetVeh=this.veh[iveh];
	if(targetVeh.isRegularVeh()){
	  targetVeh.longModel.speedlimit=(targetVeh.type==="truck")
	    ? Math.min(speedL,speedL_truck) : speedL;
	}
	if(false){
	  console.log("iveh=",iveh," u=",formd(targetVeh.u),
		      " obj.u=",formd(obj.u),
		      " isRegVeh=",targetVeh.isRegularVeh(),
		      " speedlimit_kmh=",
		      formd0(3.6*targetVeh.longModel.speedlimit));
	}

	iveh++;
      }
      //if(iveh==this.veh.length){return;} // otherwise risk of range excess

    }
  }

 // test

  if(false){
    for(var iveh=0; iveh<this.veh.length; iveh++){
      var veh=this.veh[iveh];
      if(veh.isRegularVeh()){
	console.log("end updateSpeedlimits: u=",veh.u,
		    "speedlimit=",veh.longModel.speedlimit);
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
  console.log("itime=",itime,
	      " in road.dropObject: trafficObj.u=",u,
	      " trafficObj.lane=",lane," this.nLanes=",this.nLanes);


  // construct normal road vehicle/obstacle from depot object
  // if id=50...99

  if(trafficObj.type==='obstacle'){
    var roadVehicle=new vehicle(trafficObj.len,
				trafficObj.width,
				u, lane, 0, 
				"obstacle"); //=trafficObj.type

    //(dec17) need longModel for LC as lagVeh!! 
    roadVehicle.longModel=new ACC(0,IDM_T,IDM_s0,0,IDM_b);

      //!! id ctrls veh image: 50=black obstacle,
      // 51=constructionVeh1.png etc. Attribute veh.imgNumber defined only
      // for vehicles in depot!
      
    roadVehicle.id=trafficObj.id;

    // insert vehicle (array position does not matter since sorted anyway)

    this.veh.push(roadVehicle);
    this.updateEnvironment(); // possibly crucial !! includes sorting
    console.log("  end road.dropObject: dropped obstacle at uDrop=",u,
		" lane=",lane," id=",roadVehicle.id,
		" imgNumber=",roadVehicle.imgNumber);
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

road.prototype.addTrafficLight= function(depotObject) {
  var trafficLight={id: depotObject.id,
		    u: depotObject.u,
		    value: depotObject.value, // "red" or "green"
		   };
  this.trafficLights.push(trafficLight);
  this.changeTrafficLight(depotObject.id,depotObject.value);

  if(true){
    console.log("itime=",itime," road.addTrafficLight: roadID=",this.roadID,
	      " added traffic light id=",depotObject.id,
		" at u=",formd(depotObject.u)," value=",depotObject.value);
  }
  
}




/**
#############################################################
(jun17) programmatically change state (=value) of traffic light
and implement effects
#############################################################

@param id:     unique id in [100,199]
@param value:  (optional) "red", or "green". 
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
	console.log("road.changeTrafficLight: id=",id, "no TL state given:",
		    " new value=opposite of old value=",pickedTL.value);
      }
      else{pickedTL.value=value;}
    }
  }

  if(!success){
    console.log("road.changeTrafficLight: no TL of id ",id," found!");
    return;
  }

    // implement effect to traffic by adding/removing virtual obstacles
    // (1) new TL value green

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
        virtVeh.longModel=new ACC(0,IDM_T,IDM_s0,0,IDM_b); // needed for MOBIL
        virtVeh.id=id;
        this.veh.push(virtVeh);
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

road.prototype.removeTrafficLight= function(id) {
    // change value of trafficLight object

  console.log("in road.removeTrafficLight: id=",id,"this.trafficLights.length=",this.trafficLights.length);
  var success=false;
  var iDel=-1;
  for(var i=0; (!success)&&(i<this.trafficLights.length); i++){
    if(this.trafficLights[i].id===id){
      success=true;
      console.log("  succes! i=",i," trafficLight=",this.trafficLights[i]);
      iDel=i;
      this.changeTrafficLight(id,"green"); // to remove virt vehicles
    }
  }
  if(iDel===-1) console.log("road.removeTrafficLight: no id ",id," found!");
  else this.trafficLights.splice(iDel,1);
}

/*
#############################################################
(sep19) remove obstacle object with given id
#############################################################

@param id:     unique id in [50,99]

@return:       removes the obstacle if id is found in road.veh
*/
road.prototype.removeObstacle= function(id) {
    // change value of trafficLight object

  console.log("in road.removeObstacle: id=",id);
  var success=false;
  var iDel=-1;
  for(var i=0; (!success)&&(i<this.veh.length); i++){
    if(this.veh[i].id===id){
      success=true;
      iDel=i;
    }
  }
  if(iDel===-1) console.log("road.removeObstacle: no id ",id," found!");
  else this.veh.splice(iDel,1);
}


// ####################################################################
// helper function finding the appropriate trajectory
// check if alternative trajectories apply (turning etc)
// i.e., the vehicle route is equal to one of the list of routes
// for using alternative trajectories
// F...ing bugs if  use arrays or return values; unresolvable!!!!
// in order to use this function in collision detection, just addtl return it
// ####################################################################

road.prototype.getTraj=function(veh){
  this.usedTraj_x=this.traj[0];
  this.usedTraj_y=this.traj[1];
  
  if(this.trajAlt.length>0){
        var iTraj=-1;
        var routefits=false;
        for(var itr=0; (itr<this.trajAlt.length)&&(!routefits); itr++){
	  if(veh.route.indexOf(this.trajAlt[itr].roadID)>=0){
	  //if(arraysEqual(this.trajAlt[itr].route, veh.route)){
	    iTraj=itr;
	    routefits=true;
	  }
        }
	var success=routefits && (veh.u>=this.trajAlt[iTraj].umin)
	    && (veh.u<=this.trajAlt[iTraj].umax);
	if(success){
	  this.usedTraj_x=this.trajAlt[iTraj].x;
	  this.usedTraj_y=this.trajAlt[iTraj].y;
	  
	  if(false){console.log("time=",time," iTraj=",iTraj);}
	}
  }

  return [this.usedTraj_x,this.usedTraj_y];

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

