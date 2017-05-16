//#############################################################
// Physical dynamics of the vehicles on a road section
//#############################################################

//!!! => plan: see README_routing


/**
##########################################################
road segment (link) object constructor:
##########################################################

logic-geometrical properties (u,v):  
u=long coordinate [m] (increasing in driving direction
v=lateral coordinate [lanewidth units] (real-valued; left: 0; right: nLanes-1)

connection to physical coordinates x (East), y (North) provided by
the functions traj_x, traj_y provided as cstr parameters

special vehicles are defined according to
veh.id<100:              special vehicles
veh.id=1:                ego vehicle
veh.id=10,11, (max 99):  disturbed vehicles 
veh.id>=100:             normal vehicles
they are specially drawn and externally influenced from the main program
 
@param roadID:          integer-valued road ID
@param roadLen:         link length [m]
@param laneWidth:       lane width [m]
@param nLanes:          #lanes (replaced by roadWidth in mixed traffic)
@param traj_x:          function arc length u -> phys x coordinate (East)
@param traj_y:          function arc length u -> phys y coordinate (North)
@param densInitPerLane: initial linear density [veh/m/lane]
@param speedInit:       initial longitudinal speed [m/s]
@param truckFracInit:   initial truck fraction [0-1]
@param isRing:          true if periodic BC, false if open BC

@return:                road segment instance
*/


function road(roadID,roadLen,laneWidth,nLanes,traj_x,traj_y,
	      densInitPerLane,speedInit,truckFracInit,isRing){
    this.roadID=roadID;
    this.roadLen=roadLen;
    this.laneWidth=laneWidth;
    this.nLanes=nLanes;
    this.traj_x=traj_x;
    this.traj_y=traj_y;

    var nveh=Math.floor(this.nLanes*this.roadLen*densInitPerLane);

    // network related properties

    this.isRing=isRing;
    this.inVehBuffer=0; // number of waiting vehicles; if>=1, updateBCup called
    this.iOffset=0; // set by getTargetNeighbourhood: first veh in defined region

    this.offrampIDs=[]; // which offramps are attached to this road?
    this.offrampLastExits=[]; // locations? (increasing u)
    this.offrampToRight=[]; // offramp attached to the right?

    this.duTactical=-1e-6; // if duAntic>0 activate tactical changes for mandat. LC

    // model parameters

    this.MOBIL_bSafeMandat=4; // mandat LC and merging for v=v0
    this.MOBIL_bSafeMax=17; //!!! mandat LC and merging for v=0

    // default LC models for mandatory lane changes 
    // MOBIL(bSafe,bThr,bias)
    //!! only for preparing diverges! Actual merging with separate function!!

    this.LCModelMandatoryRight=new MOBIL(this.MOBIL_bSafeMandat,
					 this.MOBIL_bSafeMax,
					 0,0.5*this.MOBIL_bSafeMax); 
    this.LCModelMandatoryLeft=new MOBIL(this.MOBIL_bSafeMandat,
					 this.MOBIL_bSafeMandat,
					0,-0.5*this.MOBIL_bSafeMax);

    this.dt_LC=4;         // 4 duration of a lane change
    this.waitTime=this.dt_LC;  // waiting time after passive LC to do an active LC


    // drawing-related vatiables

    this.draw_scaleOld=0;
    this.draw_nSegm=100;
    this.draw_curvMax=0.01; // maximum assmued curvature

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

    for(var i=0; i<nveh; i++){

        // position trucks mainly on the right lane nLanes-1

	var u=(nveh-i-1)*this.roadLen/(nveh); //!!(nveh+1)
	var lane=i%this.nLanes; // left: 0; right: nLanes-1
	var truckFracRight=Math.min(this.nLanes*truckFracInit,1);
	var truckFracRest=(this.nLanes*truckFracInit>1)
	    ? ((this.nLanes*truckFracInit-1)/(this.nLanes-1)) : 0;
	var truckFrac=(lane==this.nLanes-1) ? truckFracRight : truckFracRest;
	var vehType=(Math.random()<truckFrac) ? "truck" : "car";
	var vehLength=(vehType == "car") ? car_length:truck_length;
	var vehWidth=(vehType == "car") ? car_width:truck_width;

        // actually construct vehicles

	this.veh[i]=new vehicle(vehLength, vehWidth,u,lane, 
				0.8*speedInit,vehType);



    }

    // formally define ego vehicle for external reference
    // if applicable, it will be attributed to one element of this.veh, 
    // in this.updateEgoVeh(externalEgoVeh), later on.


    this.egoVeh=new vehicle(0,0,0,0,0,"car");

    //this.writeVehicles();
}





//######################################################################
// write vehicle info
//######################################################################

road.prototype.writeVehicles= function() {
    console.log("\nin road.writeVehicles(): nveh=",this.veh.length,
		" roadLen="+this.roadLen);
    for(var i=0; i<this.veh.length; i++){
      console.log(" veh["+i+"].id="+this.veh[i].id
		   +"  type="+this.veh[i].type
		   +"  len="+this.veh[i].length
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
} // road cstr


//######################################################################
// simple write vehicle info
//######################################################################

road.prototype.writeVehiclesSimple= function() {
    console.log("\nin road.writeVehiclesSimple(): nveh=",this.veh.length,
		" itime="+itime);
    for(var i=0; i<this.veh.length; i++){
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


//######################################################################
// write vehicle model info
//######################################################################

road.prototype.writeVehicleModels= function() {
    console.log("\nin road.writeVehicleModels(): nveh=",this.veh.length,
		" itime="+itime);
    for(var i=0; i<this.veh.length; i++){
	console.log(" veh["+i+"].type="+this.veh[i].type
		    +"  id="+this.veh[i].id
		    +"  u="+parseFloat(this.veh[i].u,10).toFixed(1)
		    +"  v="+parseFloat(this.veh[i].v,10).toFixed(1)
		    +"  speed="+parseFloat(this.veh[i].speed,10).toFixed(1)
		    +"  v0="+parseFloat(this.veh[i].longModel.v0).toFixed(1)
		    +"  T="+parseFloat(this.veh[i].longModel.T).toFixed(1)
		    +"  a="+parseFloat(this.veh[i].longModel.a).toFixed(1)
		    +"");
  }
}


//######################################################################
// write truck info including LC
//######################################################################

road.prototype.writeTrucksLC= function() {
    console.log("\nin road.writeVehiclesSimple(): nveh=",this.veh.length,
		" itime="+itime);
    for(var i=0; i<this.veh.length; i++){if(this.veh[i].type=="truck"){
	console.log(" veh["+i+"].type="+this.veh[i].type
		    +"  u="+parseFloat(this.veh[i].u,10).toFixed(1)
		    +"  v="+parseFloat(this.veh[i].v,10).toFixed(1)
		    +"  lane="+this.veh[i].lane
		    +"  speed="+parseFloat(this.veh[i].speed,10).toFixed(1)
		    +"  acc="+parseFloat(this.veh[i].acc,10).toFixed(1)
		    +"  LCmodel.bBiasRight="
		    +parseFloat(this.veh[i].LCModel.bBiasRight).toFixed(1)
		    +"");
    }}
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

    // add the new vehicles to the array

    for(var i=0; i<types.length; i++){

        // !! later on directly (if types internally = integer)
	var type=(types[i]==0) ? "car" :
	    (types[i]==1) ? "truck" : "obstacle";
	var lane=Math.round(lanesReal[i]);
        var vehNew=new vehicle(lengths[i],widths[i], 
			       longPos[i],lane, speeds[i], type);
	vehNew.v=lanesReal[i]; // since vehicle cstr initializes veh.v=veh.lane
	if(i==iEgo){
            vehNew.id=1;
	    this.egoVeh=vehNew;
	}

	this.veh.push(vehNew);
	//console.log("road.initializeMicro: vehNew.v=",vehNew.v);
    }

    // set up all neighborhood relations

    this.sortVehicles();
    this.updateEnvironment();

    // check

    if(false){
        console.log("road.initializeMicro: initialized with ", 
		    this.veh.length," vehicles");
	this.writeVehicles();
    }
}  //initializeMicro



//#####################################################
// get network info of offramps attached to this road (for routing)
// see also updateModelsOfAllVehicles
//#####################################################

road.prototype.setOfframpInfo
 =function(offrampIDs,offrampLastExits,offrampToRight){
     this.offrampIDs=offrampIDs;  
     this.offrampLastExits=offrampLastExits; // road.u at begin of diverge
     this.offrampToRight=offrampToRight; // whether offramp is to the right
 }



//#####################################################
// sort vehicles into descending arc-length positions u 
//#####################################################

road.prototype.sortVehicles=function(){
    if(this.veh.length>2){
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

    // this.offrampLastExits[iOff] increasing with iOff
    for(var iOff=0; (!success)&&(iOff<this.offrampIDs.length); iOff++){
	success=(this.offrampLastExits[iOff]>u);
	if(success){index=iOff;}
    }
    return index;
      
}


//#####################################################
// set vehicles in range to new CF models
// (useful for modeling flow-conserving bottlenecks)
//#####################################################

road.prototype.setCFModelsInRange
    =function(umin,umax,longModelCar,longModelTruck){

    for(var i=0; i<this.veh.length; i++){
	var u=this.veh[i].u;
	if((u>umin)&&(u<umax)){
	    if(this.veh[i].type=="car"){this.veh[i].longModel=longModelCar;}
	    if(this.veh[i].type=="truck"){this.veh[i].longModel=longModelTruck;}
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

    for(var i=0; i<this.veh.length; i++){
	var u=this.veh[i].u;
	if((u>umin)&&(u<umax)){
	    if(this.veh[i].type=="car"){this.veh[i].LCModel=LCModelCar;}
	    if(this.veh[i].type=="truck"){this.veh[i].LCModel=LCModelTruck;}
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
    for(var i=0; i<this.veh.length; i++){
	var u=this.veh[i].u;
	if((u>umin)&&(u<umax)){
	    this.veh[i].mandatoryLCahead=true;
	    this.veh[i].toRight=toRight;
	    this.veh[i].LCModel=(toRight) 
		? this.LCModelMandatoryRight : this.LCModelMandatoryLeft;
	}
    }
}




//#####################################################
/**
  functions for getting/updating the vehicle environment of a vehicle array 
  sorted into descending arc-length positions u (first veh has maximum u)

  vehicle indices iLead, iLag, iLeadLeft, iLeadRight, iLagLeft, iLagRight

  if i==0 (first vehicle) leader= last vehicle also for non-ring roads
  if i==nveh-1 (last vehicle) follower= first vehicle also for non-ring roads
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
    var iLead=(i==0) ? n-1 : i-1;  //!! also for non periodic BC
    success=(this.veh[iLead].lane==this.veh[i].lane);
    while(!success){
	iLead=(iLead==0) ? n-1 : iLead-1;
	success=( (i==iLead) || (this.veh[iLead].lane==this.veh[i].lane));
    }
    this.veh[i].iLead = iLead;
}

     // get/update follower

road.prototype.update_iLag=function(i){
    var n=this.veh.length;
    var iLag=(i==n-1) ? 0 : i+1;
    success=(this.veh[iLag].lane==this.veh[i].lane);
    while(!success){
	iLag=(iLag==n-1) ? 0 : iLag+1;
	success=( (i==iLag) || (this.veh[iLag].lane==this.veh[i].lane));
    }
    this.veh[i].iLag = iLag;
}


   // get leader to the right

road.prototype.update_iLeadRight=function(i){
    var n=this.veh.length;
    var iLeadRight;
    if(this.veh[i].lane<this.nLanes-1){
	iLeadRight=(i==0) ? n-1 : i-1;
	success=((i==iLeadRight) || (this.veh[iLeadRight].lane==this.veh[i].lane+1));
	while(!success){
	    iLeadRight=(iLeadRight==0) ? n-1 : iLeadRight-1;
	    success=( (i==iLeadRight) || (this.veh[iLeadRight].lane==this.veh[i].lane+1));
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
	iLagRight=(i==n-1) ? 0 : i+1;
	success=((i==iLagRight) || (this.veh[iLagRight].lane==this.veh[i].lane+1));
	while(!success){
	    iLagRight=(iLagRight==n-1) ? 0 : iLagRight+1;
	    success=( (i==iLagRight) || (this.veh[iLagRight].lane==this.veh[i].lane+1));
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
	iLeadLeft=(i==0) ? n-1 : i-1;
	success=((i==iLeadLeft) || (this.veh[iLeadLeft].lane==this.veh[i].lane-1));
	while(!success){
	    iLeadLeft=(iLeadLeft==0) ? n-1 : iLeadLeft-1;
	    success=( (i==iLeadLeft) || (this.veh[iLeadLeft].lane==this.veh[i].lane-1));
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
	iLagLeft=(i==n-1) ? 0 : i+1;
	success=((i==iLagLeft) || (this.veh[iLagLeft].lane==this.veh[i].lane-1));
	while(!success){
	    iLagLeft=(iLagLeft==n-1) ? 0 : iLagLeft+1;
	    success=( (i==iLagLeft) || (this.veh[iLagLeft].lane==this.veh[i].lane-1));
	}
    }
    else{iLagLeft=-10;}
    this.veh[i].iLagLeft=iLagLeft;
}


//#####################################################
// get/update environment iLead, iLag, iLeadLeft,... for all vehicles
//#####################################################

road.prototype.updateEnvironment=function(){
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


road.prototype.calcAccelerations=function(){
    for(var i=0; i<this.veh.length; i++){
	var speed=this.veh[i].speed;
	var iLead= this.veh[i].iLead;
	if(iLead==-100){console.log("should not happen!! nveh=",this.veh.length," iLead=",iLead);}
	var s=this.veh[iLead].u - this.veh[iLead].length - this.veh[i].u;
	var speedLead=this.veh[iLead].speed;;
	var accLead=this.veh[iLead].acc;
	if(iLead>=i){ // vehicle i is leader, for any BC iLead defined
	    if(this.isRing){s+=this.roadLen;} // periodic BC; accLead OK
	    else{s=10000;accLead=0;} // free outflow BC: virt veh 10km away
	}

        // obstacles: set acc=0 explicitely
        // (it may have truck model by this.updateModelsOfAllVehicles)
        // do not accelerate programmatically the ego vehicle(s)

	if(this.veh[i].id>1){
	    this.veh[i].acc =(this.veh[i].type != "obstacle") 
		? this.veh[i].longModel.calcAcc(s,speed,speedLead,accLead)
		: 0;
	}


        //!! ego vehicles: accelerations acc, lanes lane (for logic),
        // and lateral positions v (for drawing) 
        // imposed directly by road.updateEgoEgoVeh(externalEgoVeh) 
        // called in the top-level js; here only logging

	if(this.veh[i].id==1){
	    if(false){
		console.log("in road: ego vehicle: u=",this.veh[i].u,
			    " v=",this.veh[i].v,
			    " speed_u=",this.veh[i].speed,
			    "  acc_u=",this.veh[i].acc);
	    }
	}



	//if(false){
	//if(this.veh[i].mandatoryLCahead){
	//if(speed>1.05*this.veh[i].longModel.v0){
	if(false){
	    console.log("after calcAccelerations: i="+i+" iLead="+iLead
			+" pos="+this.veh[i].u
			+" lane="+this.veh[i].v
			+" s="+s
			+" speed="+speed
			+" v0="+this.veh[i].longModel.v0
			+" speedLead="+speedLead
			+" acc="+this.veh[i].acc
			//+" mandatoryLCahead="+this.veh[i].mandatoryLCahead
			//+" alpha_v0="+this.veh[i].longModel.alpha_v0
		       );
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
         - the long speed "speed" [m/s] using the new long acceleration
*/

road.prototype.updateEgoVeh=function(externalEgoVeh){

    // find the ego vehicle (its index changes all the time)

    var found=false;
    var iEgo=-1;
    for(var i=0; !found &&(i<this.veh.length); i++){
	if(this.veh[i].id==1){
	    iEgo=i;
	    found=true;
	}
    }
    if(iEgo==-1){
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

    var xRoadAxis=this.traj_x(ego.u)-this.traj_x(0); 
    var dotxRoadAxis=(0.5*Math.PI-this.get_phi(ego.u))*ego.speed; 


    // calculate logical accelerations
    // accLat=accel to logical increasing lane indices=acc to right
    // roadCurv>0 for left curves, therefore "+"
    //!!! implement externalEgoVeh.latCtrlModel=1 and =0

    ego.acc=externalEgoVeh.aLong; // !! driveAngle |dvdt*laneWidth/speed|<<1
    var acc_v=(externalEgoVeh.aLat+roadCurv*ego.speed*ego.speed)
	/this.laneWidth; // [lanes/s^2]

    // calculate longitudinal dynamics directly by ballistic update 

    ego.u += Math.max(0,ego.speed*dt+0.5*ego.acc*dt*dt); // [m]
    ego.speed=Math.max(ego.speed+ego.acc*dt, 0.);        // =vu [m/s]

    // calculate lateral dynamics directly by ballistic update 
    // Watch out: coordinate v has unit laneWidth, not m! 

    if(externalEgoVeh.latCtrlModel==2){
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
	if( (this.veh[i].id!=1) && (this.veh[i].type != "obstacle")){

            // longitudinal positional with old speeds

	    this.veh[i].u += Math.max(
		0,this.veh[i].speed*dt+0.5*this.veh[i].acc*dt*dt);

            // longitudinal speed update 

	    this.veh[i].speed 
		= Math.max(this.veh[i].speed+this.veh[i].acc*dt, 0);

            // lateral positional update (v=fractional lane)

	    this.veh[i].v=get_v(this.veh[i].dt_lastLC,this.dt_LC,
				this.veh[i].laneOld,this.veh[i].lane);
	}

        // periodic BC closure

	if(this.isRing &&(this.veh[i].u>this.roadLen)){
	    this.veh[i].u -= this.roadLen;
	}
    }

    this.updateOrientation(); // drawing: get heading relative to road
    this.sortVehicles(); // positional update may have disturbed sorting (if passing)
    this.updateEnvironment();
}



//######################################################################
// get heading (relative to road)
// using get_dvdt from paths.js
//######################################################################

road.prototype.updateOrientation=function(){
    for(var i=0; i<this.veh.length; i++){
	//console.log("iveh=",i," this.veh.length=",this.veh.length);

        // ego vehicles are updated separately, obstacles not at all
	if( (this.veh[i].id!=1) && (this.veh[i].type != "obstacle")){
            this.veh[i].dvdt=get_dvdt(this.veh[i].dt_lastLC,this.dt_LC,
				      this.veh[i].laneOld,
				      this.veh[i].lane,this.veh[i].speed);
	}
    }
}




//######################################################################
// main lane changing routine (model MOBIL without politeness)
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
  var log=false;
  //changeSuccessful=0; //return value; initially false

  if(log&&toRight){console.log("changeLanes: before changes to the right");}
  if(log&&(!toRight)){console.log("changeLanes: before changes to the left");}

  for(var i=0; i<this.veh.length; i++){

    // test if there is a target lane and if last change is sufficiently long ago
      //console.log("changeLanes: i=",i," outer loop");
  var newLane=(toRight) ? this.veh[i].lane+1 : this.veh[i].lane-1;
  if( (newLane>=0)&&(newLane<this.nLanes)
      &&(this.veh[i].dt_lastLC>this.waitTime)
      &&(this.veh[i].dt_lastPassiveLC>0.2*this.waitTime) //!! fact 0.2 ad hoc
    ){


      var iLead=this.veh[i].iLead;
      var iLag=this.veh[i].iLag; // actually not used
      var iLeadNew=(toRight) ? this.veh[i].iLeadRight : this.veh[i].iLeadLeft;
      var iLagNew=(toRight) ? this.veh[i].iLagRight : this.veh[i].iLagLeft;;

      // check if also the new leader/follower did not change recently

	//console.log("iLeadNew=",iLeadNew," dt_lastLC_iLeadNew=",this.veh[iLeadNew].dt_lastLC," dt_lastLC_iLagNew=",this.veh[iLag].dt_lastLC); 

      if((this.veh[i].id!=1) // not an ego-vehicle
	 &&(iLeadNew>=0)       // target lane allowed (otherwise iLeadNew=-10)
	 &&(this.veh[iLeadNew].dt_lastLC>this.waitTime)  // lower time limit
	 &&(this.veh[iLagNew].dt_lastLC>this.waitTime)){ // for serial LC
      
         //console.log("changeLanes: i=",i," cond 2 passed");
         var acc=this.veh[i].acc;
         var accLead=this.veh[iLead].acc;
         var accLeadNew=this.veh[iLeadNew].acc; // leaders: exogen. for MOBIL
	 var speed=this.veh[i].speed;
	 var speedLeadNew=this.veh[iLeadNew].speed;
	 var sNew=this.veh[iLeadNew].u - this.veh[iLeadNew].length - this.veh[i].u;
	 var sLagNew= this.veh[i].u - this.veh[i].length - this.veh[iLagNew].u;
      
         // treat case that no leader/no veh at all on target lane
         // notice: if no target vehicle iLagNew=i set in updateEnvironment()
         //    => update_iLagLeft, update_iLagRight
      
	 if(iLeadNew>=i){ // if iLeadNew=i => laneNew is empty
	     if(this.isRing){sNew+=this.roadLen;} // periodic BC
	     else{sNew=10000;}
	 }
      
         // treat case that no follower/no veh at all on target lane

	 if(iLagNew<=i){ // if iLagNew=i => laneNew is empty
	     if(this.isRing){sLagNew+=this.roadLen;} // periodic BC
	     else{sLagNew=10000;}
	 }
      
      
         // calculate MOBIL input

	 var vrel=this.veh[i].speed/this.veh[i].longModel.v0;
	 var accNew=this.veh[i].longModel.calcAcc(sNew,speed,speedLeadNew,accLeadNew);

         // reactions of new follower if LC performed
         // it assumes new acceleration of changing veh

	 var speedLagNew=this.veh[iLagNew].speed;
 	 var accLagNew 
	      =this.veh[iLagNew].longModel.calcAcc(sLagNew,speedLagNew,speed,accNew); 
      
         // final MOBIL incentive/safety test before actual lane change
         // (regular lane changes; for merges, see below)


	 //var log=(this.veh[i].type=="truck");
	 var log=false;
	//var log=true;

	 var MOBILOK=this.veh[i].LCModel.realizeLaneChange(vrel,acc,accNew,accLagNew,toRight,log);
    

         // only test output

         if(MOBILOK&&(this.veh[i].id==107)){//!!
	     var s=this.veh[iLead].u-this.veh[iLead].length-this.veh[i].u;
	     var accLead=this.veh[iLead].acc;
	     var speed=this.veh[i].speed;
	     var speedLead=this.veh[iLead].speed;
	     var accCalc=this.veh[i].longModel.calcAcc(
		 s,speed,speedLead,accLead);
	     console.log(
		 "MOBILOK!change successfully initiated!",
		 "\n  vehicle id",this.veh[i].id,
		 " type ",this.veh[i].type,
		 " from lane ",this.veh[i].lane,
		 " to lane",newLane,
		 "\n  u=",parseFloat(this.veh[i].u).toFixed(1),
		 " s=",parseFloat(s).toFixed(1),
		 " speed=",parseFloat(speed).toFixed(1),
		 " speedLead=",parseFloat(speedLead).toFixed(1),
		 " accLead=",parseFloat(accLead).toFixed(1),
		 " acc=",parseFloat(this.veh[i].acc).toFixed(1),
		 " accNew=",parseFloat(accNew).toFixed(1),
		 //" accCalc=",parseFloat(accCalc).toFixed(1),
		 "\n  longModel=",this.veh[i].longModel,
		 "\n  veh[iLead]=",this.veh[iLead],
		 ""
	     );
	     this.writeVehicles();

	 }
    
    

	 changeSuccessful=(this.veh[i].type != "obstacle")
	      &&(sNew>0)&&(sLagNew>0)&&MOBILOK;
	 if(changeSuccessful){
	 
             // do lane change in the direction toRight (left if toRight=0)
	     //!! only regular lane changes within road; merging/diverging separately!

           this.veh[i].dt_lastLC=0;                // active LC
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
	 
	   this.updateEnvironment();
	 }
      }
    }
  }
  //return changeSuccessful;
}

//END NEW 25.06.2016

//######################################################################
// functionality for merging and diverging to another road. 
//######################################################################
/**
In both cases, the road change is from the actual road 
to the road in the argument list. Only the immediately neighboring 
lanes of the two roads interact. The rest must be handled in the
strategic/tactical lane-change behaviour of the drivers

@param newRoad: the road to which to merge or diverge
@param offset:  difference[m] in the arclength coordinate u 
                between new and old road
@param ustart:  start[m] of the merging/diverging zone in old-road coordinates
@param uend:    end[m] of the merging/diverging zone in old-road coordinates
                Notice: If merge, exclude virtual vehicle pos from u-range!
@param isMerge: if true, merge; otherwise diverge. 
@param toRight: direction of the merge/diverge. 

@return:        void. Both roads are affected!
*/

road.prototype.mergeDiverge=function(newRoad,offset,uStart,uEnd,isMerge,toRight){

    var log=false;
    if(log){console.log("\n\nitime="+itime+": in road.mergeDiverge");}

    // (1) get neighbourhood

    var uNewStart=uStart+offset;
    var uNewEnd=uEnd+offset;
    var padding=50; // additional visibility  on target road before/after
    var originLane=(toRight) ? this.nLanes-1 : 0;
    var targetLane=(toRight) ? 0 : newRoad.nLanes-1;

     // getTargetNeighbourhood also sets this.iOffset, newRoad.iOffset
    var originVehicles=this.getTargetNeighbourhood(uStart, uEnd, originLane);

    var targetVehicles=newRoad.getTargetNeighbourhood(
	uNewStart-padding, uNewEnd+padding, targetLane);

    var iMerge=0; // candidate 
    var uTarget; // arc-length coordinate of the successfully changing veh(if any)


    // (2) select changing vehicle (if any): 
    // only one at each calling; the first vehicle has priority!


    // immediate success if no target vehicles in neighbourhood
    // and at least one (real) origin vehicle: the first one changes

    var success=( (targetVehicles.length==0)&&(originVehicles.length>0)
		  &&(originVehicles[0].type != "obstacle")
		  &&(originVehicles[0].mandatoryLCahead) );
    if(success){iMerge=0; uTarget=originVehicles[0].u+offset;}

    // else select the first suitable candidate on the origin lane (if any)

    else if(originVehicles.length>0){  // or >1 necessary? !!
	var duLeader=1000; // initially big distances w/o interaction
	var duFollower=-1000;
	var leaderNew=new vehicle(0,0,uNewStart+10000,targetLane,0,"car");
	var followerNew=new vehicle(0,0,uNewStart-10000,targetLane,0,"car");
	if(log){console.log("entering origVeh loop");}
        for(var i=0;(i<originVehicles.length)&&(!success);i++){// merging veh loop
	  if((originVehicles[i].type != "obstacle")&&(originVehicles[i].mandatoryLCahead)){
	      uTarget=originVehicles[i].u+offset;
	      if(log){console.log(" i="+i);}
	      for(var j=0; j<targetVehicles.length; j++){
		var du=targetVehicles[j].u-uTarget;
		if( (du>0)&&(du<duLeader)){
		    duLeader=du; leaderNew=targetVehicles[j];
		}
		if( (du<0)&&(du>duFollower)){
		    duFollower=du; followerNew=targetVehicles[j];
		}
		if(log){
		    console.log("  du="+du+" duLeader="+duLeader
				+" duFollower="+duFollower);

		}

	      }

              // get input variables for MOBIL

	      var sNew=duLeader-leaderNew.length;
	      var sLagNew=-duFollower-originVehicles[i].length;
	      var speedLeadNew=leaderNew.speed;
	      var accLeadNew=leaderNew.acc; // leaders=exogen. to MOBIL
	      var speedLagNew=followerNew.speed;
	      var speed=originVehicles[i].speed;

	      var bSafeMergeMin=this.MOBIL_bSafeMandat; 
	      var bSafeMergeMax=this.MOBIL_bSafeMax; 
	      var bBiasMerge=(toRight) ? 0.5*bSafeMergeMax 
		  : -0.5*bSafeMergeMax; // strong urge to change
	      var longModel=originVehicles[i].longModel;

              //!!! this alt: LCModel with locally defined bSafe params 6 and 17
	      var LCModel=new MOBIL(bSafeMergeMin,bSafeMergeMax,0,bBiasMerge);

              //!!! this alt: LCModel* overwritten from top-level routines! bSafe=42
	      //var LCModel=(toRight) ? this.LCModelMandatoryRight 
		 // : this.LCModelMandatoryLeft; 

	      var vrel=originVehicles[i].speed/originVehicles[i].longModel.v0;
	      var acc=originVehicles[i].acc;
	      var accNew=longModel.calcAcc(sNew,speed,speedLeadNew,accLeadNew);
              //!! assuming changing with accNew
	      var accLagNew =longModel.calcAcc(sLagNew,speedLagNew,speed,accNew);

              // lane changing to merge on new road (regular LC above)
	      var MOBILOK=LCModel.realizeLaneChange(vrel,acc,accNew,accLagNew,toRight,false);

	      success=MOBILOK &&(originVehicles[i].type != "obstacle")
		  &&(sNew>0)&&(sLagNew>0)
		  &&(originVehicles[i].mandatoryLCahead);

	      if(log&&(this.roadID==2)){
		  console.log("in road.mergeDiverge: roadID="+this.roadID
			      +" LCModel.bSafeMax="+LCModel.bSafeMax);
	      }
	      if(success){iMerge=i;}


	      if(success&&log){
		console.log("testing origin veh "+i +" type="
			    +originVehicles[i].type+" uTarget="+uTarget);
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


    //(3) if success, do the actual merging!

    if(success){// do the actual merging 

        //originVehicles[iMerge]=veh[iMerge+this.iOffset] 

	var iOrig=iMerge+this.iOffset;
	if(log){
	//if(true){
	    console.log("Actual merging: merging origin vehicle "+iOrig
			+" of type "+this.veh[iOrig].type
			+" from origin position "+this.veh[iOrig].u
			+" and origin lane"+originLane
			+" to target position "+uTarget
			+" and target lane"+targetLane); 
	    console.log(" this.veh[iOrig].mandatoryLCahead)="
			+this.veh[iOrig].mandatoryLCahead);

	}

        var changingVeh=this.veh[iOrig]; //originVehicles[iMerge];
	var vOld=(toRight) ? targetLane-1 : targetLane+1; // rel. to NEW road
	changingVeh.u += offset;
	changingVeh.lane =targetLane;
	changingVeh.laneOld =vOld; // following for  drawing purposes
	changingVeh.v =vOld;  // real lane position (graphical)

	changingVeh.dt_lastLC=0;             // just changed
	changingVeh.mandatoryLCahead=false; // reset mandatory LC behaviour

//!!! get index of this.veh and splice this; otherwise probably no effect 
//####################################################################
	this.veh.splice(iOrig,1);// removes chg veh from orig.
        newRoad.veh.push(changingVeh); // appends changingVeh at last pos;
//####################################################################

	//newRoad.nveh=newRoad.veh.length;
	newRoad.sortVehicles();       // move the mergingVeh at correct position
	newRoad.updateEnvironment(); // and provide updated neighbors

    }// end do the actual merging

}// end mergeDiverge





//######################################################################
// update truck percentage by changing vehicle type of existing vehs
  // do not correct if minor mismatch 
  // since this can happen due to inflow/outflow
  // open roads: mismatchTolerated about 0.2; ring: mismatchTolerated=0
//######################################################################

road.prototype.updateTruckFrac=function(truckFrac, mismatchTolerated){
  if(this.veh.length>0){
    this.updateEnvironment(); // needs veh[i].iLag etc, so actual environment needed
    var n=this.veh.length;
    var nTruckDesired=Math.floor(n*truckFrac);
    var nTruck=0;
    for(var i=0; i<n; i++){
	if(this.veh[i].type == "truck"){nTruck++;}
    }
    var truckFracReal=nTruck/n;  // integer division results generally in double: OK!

    // action if truck frac not as wanted; 
    // correct by one veh transformation per timestep

    if(Math.abs(truckFracReal-truckFrac)>mismatchTolerated){
	var truckFracTooLow=(nTruckDesired>nTruck);
	var newType=(truckFracTooLow) ? "truck" : "car";
	var newLength=(truckFracTooLow) ? truck_length : car_length;
	var newWidth=(truckFracTooLow) ? truck_width : car_width;
	var newLongModel=(truckFracTooLow) ? longModelTruck : longModelCar;
	var diffSpace=((truckFracTooLow) ? -1 : 1)* (truck_length-car_length);
	var success=0; // false at beginning

        // find the candidate vehicle (truck or car) with the largest lag gap

	var candidateType=(truckFracTooLow) ? "car" : "truck";
	var k=0;  // considered veh index

	if(truckFracTooLow){// change cars->trucks on the right lane if possible
	  var maxSpace=0;
	  for(var lane=this.nLanes-1; lane>=0; lane--){if(!success){
	    for(var i=0; i<n; i++){
	      if( (this.veh[i].lane==lane)&&(this.veh[i].type == candidateType)){
	        var iLag= this.veh[i].iLag;
	        var s=this.veh[i].u-this.veh[iLag].u - this.veh[i].length;
	        if(iLag<i){s+=this.roadLen;}//periodic BC (OK for open BC as well)
		if(s>maxSpace){k=i; maxSpace=s;}
		success=(maxSpace>diffSpace);
	      }
	    }
	  }}
	}

	else{ // change trucks->cars: transform truck with smallest space 
	  var minSpace=10000;
	  for(var i=0; i<n; i++){
	    if(this.veh[i].type == candidateType){
	      success=1; // always true for trucks->cars if there is a truck
	      var iLag= this.veh[i].iLag;
	      var s=this.veh[i].u-this.veh[iLag].u - this.veh[i].length;
	      if( (iLag<i)&&(s<0) ){s+=this.roadLen;}//periodic BC (OK for open BC as well)
	      if(s<minSpace){k=i; minSpace=s;}
	    }
	  }
	}

        // actually do the transformation if no collision entails by it

	if(success){
	    this.veh[k].type=newType;
	    this.veh[k].length=newLength;
	    this.veh[k].width=newWidth;
	    this.veh[k].longModel=newLongModel;
	}
    }
  }
}




//######################################################################
// update vehicle density by adding vehicles into largest gaps
// or removing some randomly picked vehicles (one at a time)
//######################################################################

road.prototype.updateDensity=function(density){
    var nDesired= Math.floor(this.nLanes*this.roadLen*density);
    var nveh_old=this.veh.length;
    if(this.veh.length>nDesired){// too many vehicles, remove one per time step
        var r=Math.random();
        var k=Math.floor( this.veh.length*r);
	this.veh.splice(k,1); // remove vehicle at random position k  (k=0 ... n-1)
    }
    else if(this.veh.length<nDesired){// too few vehicles, generate one per time step in largest gap
	var maxSpace=0;
	var k=0; // considered veh index
	var success=false;
	var emptyLanes=false;

        // initialize attributes of new vehicle 
        // (later overwritten in most cases)

	var laneNew=0;
	var uNew=0.5*this.roadLen
	var vehType=(Math.random()<truckFrac) ? "truck" : "car";
	var vehLength=(vehType=="car") ? car_length:truck_length;
	var vehWidth=(vehType=="car") ? car_width:truck_width;
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
	    if(nvehLane[il]==0){
		success=true;
		emptyLanes=true;
		laneNew=il;
	    }
	}

        // if there are no empty lanes, search the largest gap

	if(!emptyLanes){
          for(var i=0; i<this.veh.length; i++){
	    var iLead= this.veh[i].iLead;
	    var s=this.veh[iLead].u - this.veh[iLead].length - this.veh[i].u;
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
				    speedNew,vehType);

	    if(emptyLanes){vehNew.speed=longModelTruck.v0;}
	    this.veh.splice(k,0,vehNew); // add vehicle at position k  (k=0 ... n-1)
	}
    }
    // sort (re-sort) vehicles with respect to decreasing positions
    // and provide the updated local environment to each vehicle

    if(this.veh.length!=nveh_old){
	this.sortVehicles();
	this.updateEnvironment();
    }
} //updateDensity


//######################################################################
// downstream BC: drop at most one vehicle at a time (no action needed if isRing)
//######################################################################

road.prototype.updateBCdown=function(){
  var nvehOld=this.veh.length;
  if( (!this.isRing) &&(this.veh.length>0)){
      if(this.veh[0].u>this.roadLen){
	  //console.log("road.updateBCdown: nveh="+this.veh.length+" removing one vehicle);
	  this.veh.splice(0,1);
      }
      if(this.veh.length<nvehOld){this.updateEnvironment();}
  }
}

//######################################################################
// upstream BC: insert vehicles at total flow Qin (only applicable if !isRing)
// route is optional parameter (default: route=[])
//######################################################################

road.prototype.updateBCup=function(Qin,dt,route){

  this.route=(typeof route === 'undefined') ? [0] : route; // handle opt. args

  var log=false;
  //if(log){console.log("in road.updateBCup: inVehBuffer="+this.inVehBuffer);}

  var smin=15; // only inflow if largest gap is at least smin
  var success=0; // false initially
  if(!this.isRing){
      this.inVehBuffer+=Qin*dt;
  }

  if(this.inVehBuffer>=1){
    // get new vehicle characteristics
      var vehType=(Math.random()<truckFrac) ? "truck" : "car";
      var vehLength=(vehType=="car") ? car_length:truck_length;
      var vehWidth=(vehType=="car") ? car_width:truck_width;
      var space=0; // available bumper-to-bumper space gap

      // try to set trucks at the right lane

      var lane=this.nLanes-1; // start with right lane
      if(this.veh.length==0){success=true; space=this.roadLen;}

      else if(vehType=="truck"){
	  var iLead=this.veh.length-1;
	  while( (iLead>0)&&(this.veh[iLead].lane!=lane)){iLead--;}
	  space=this.veh[iLead].u-this.veh[iLead].length;
	  success=(iLead<0) || (space>smin);
      }

      // if road not empty or a truck could not be placed on the right lane 
      // try, as well as for cars, if there is any lane with enough space

      if(!success){
        var spaceMax=0;
        for(var candLane=this.nLanes-1; candLane>=0; candLane--){
	  var iLead=this.veh.length-1;
	  while( (iLead>=0)&&(this.veh[iLead].lane!=candLane)){iLead--;}
	  space=(iLead>=0) // "minus candLine" implements right-driving 
	      ? this.veh[iLead].u-this.veh[iLead].length : this.roadLen+candLane;
	  if(space>spaceMax){
	      lane=candLane;
	      spaceMax=space;
	  }
        }
	success=(space>=smin);
      }

      // actually insert new vehicle

      if(success){
	  var longModelNew=(vehType=="car") ? longModelCar : longModelTruck;
	  var uNew=0;
	  var speedNew=Math.min(longModelNew.v0, longModelNew.speedlimit, 
				space/longModelNew.T);
	  var vehNew=new vehicle(vehLength,vehWidth,uNew,lane,speedNew,vehType);
	  //vehNew.longModel=longModelNew;
	  vehNew.route=this.route;

          //!!! define ego vehicles for testing purposes
	  if(false){
	      var percEgo=5;
	      if(vehNew.id%100<percEgo){vehNew.id=1;}
	  }

	  this.veh.push(vehNew); // add vehicle after pos nveh-1
	  this.inVehBuffer -=1;
	  if(false){
	      console.log("road.updateBCup: new vehicle at pos u=0, lane "+lane
			  +", type "+vehType+", s="+space+", speed="+speedNew);
	      console.log(this.veh.length); 
	      for(var i=0; i<this.veh.length; i++){
	        console.log("i="+i+" this.veh[i].u="+this.veh[i].u
+" this.veh[i].route="+this.veh[i].route);
	      }
	  }
	  //if(this.route.length>0){console.log("new veh entered: route="+this.veh[this.veh.length-1].route);}//!!
      }
  }

}

//######################################################################
// get target vehicle neighbourhood/context for merging of other roads
// returns targetVehicles, an array of all vehicles on the target lane 
// inside the arclength range [umin, umax].
// Also sets iOffset, the first vehicle (smallest i) within range
//######################################################################

road.prototype.getTargetNeighbourhood=function(umin,umax,targetLane){
    var targetVehicles=[];
    var iTarget=0;
    var firstTime=true;
    //console.log("getTargetNeighbourhood:");
    for (var i=0; i<this.veh.length; i++){
	//console.log("i=",i," nveh=",this.veh.length," u=",this.veh[i].u);
	if( (this.veh[i].lane==targetLane)&&(this.veh[i].u>=umin)&&(this.veh[i].u<=umax)){
	    if(firstTime==true){this.iOffset=i;firstTime=false;}
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


//####################################################
// distribute model parameters updated from  GUI to all vehicles
// at least tactical part really necessary; keep also first part as
// future central update before calc any accelerations although
// at present obviously not necessary (2017-03-23)
//####################################################

road.prototype.updateModelsOfAllVehicles=function(longModelCar,longModelTruck,
						  LCModelCar,LCModelTruck){

  for(var i=0; i<this.veh.length; i++){
      if(this.veh[i].type != "obstacle"){// then do nothing
        this.veh[i].longModel=(this.veh[i].type == "car")
	  ? longModelCar : longModelTruck;
        this.veh[i].LCModel=(this.veh[i].type == "car")
	  ? LCModelCar : LCModelTruck;
      }
  }


  // update tactical info for mandatory lane changes upstream of offramps

  if(this.duTactical>0) for(var i=0; i<this.veh.length; i++){
      var iNextOff=this.getNextOffIndex(this.veh[i].u); //-1 if nothing
      var uLastExit=this.offrampLastExits[iNextOff];

      if((this.veh[i].type != "obstacle")
	 && (iNextOff>-1)
	 && (uLastExit-this.veh[i].u<this.duTactical)){
          if(false){console.log("in road.updateModels... iveh="+i
		      +" iNextOff="+iNextOff
		      +" u="+this.veh[i].u
		      +" uLastExit="+uLastExit);
		   }
	  var offID=this.offrampIDs[iNextOff];
	  var route=this.veh[i].route;
	  var mandatoryLC=false;
	  for(var ir=0; ir<route.length; ir++){
	      if(offID==route[ir]){mandatoryLC=true;}
	  }
	  if(mandatoryLC){
	      this.veh[i].mandatoryLCahead=true;
	      var toRight=this.offrampToRight[iNextOff];
	      this.veh[i].longModel.alpha_v0=1;// reduce speed before diverging

	      this.veh[i].LCModel=(toRight) ? this.LCModelMandatoryRight
	          : this.LCModelMandatoryLeft;
	      if(false){console.log("apply mandatoryLC to Vehicle "+i+"!"
			  +"route="+this.veh[i].route
			  +" offID="+offID
			  +" uLastExit="+uLastExit
			  +" u="+this.veh[i].u
			  +" alpha_v0="+this.veh[i].longModel.alpha_v0
			  +" bBiasRight="+this.veh[i].LCModel.bBiasRight
				   );
		       }

	  }

      }
      else{ //no mandatory LC because obstacle, no offramps, mainroad route
            // (no need to reset LC models since this is done above)
	  this.veh[i].longModel.alpha_v0 =1; 
      //!!! works as links for all car longmodels or 
      // truck longmodels of a road!! 
      // DOS if reset here, all slow if not
       // => logging of road.calcAccelerations 
      // README set accel models individually (new?)
      }

  }

}

//######################################################################
// update times since last change for all vehicles (min time between changes)
//######################################################################

road.prototype.updateLastLCtimes=function(dt){
    for(var i=0; i<this.veh.length; i++){
      this.veh[i].dt_lastLC +=dt;
      this.veh[i].dt_lastPassiveLC +=dt;
    }
}


//######################################################################
// disturb externally a vehicle
//######################################################################
/**
reduces the speed of the normal vehicle that is nearest 
(in the upstream direction) to the location relLocation*roadLen 
by an amount of speedReduce.
Notice that the same vehicle may be disturbed several times (if not wished,
change "this.veh[i].id>=10" to "this.veh[i].id>=100" below)

// id<100:              special vehicles
// id=1:                ego vehicle
// id=10,11, (max 99):  disturbed vehicles 
// id>=100:             normal vehicles if type != "obstacle"

@param relLocation: picks vehicle nearest to arclength u=relLocation*roadLen
@param speedReduce: speed reduction [m/s]

@return this.veh[iPicked].speed reduced
*/

road.prototype.disturbOneVehicle=function(relLocation,speedReduce){
    if(false){
	console.log("in road.disturbOneVehicle\n");
    }

    // select veh to be perturbed (must not be an ego vehicle)
    // give up as a bad job if veh.id=1 two times in a row
    // (may be because the only mainroad vehicle is an ego vehicle)
    var success=false;
    var uPick=relLocation*this.roadLen;
    var iPick=-1;
    for (var i=0; (i<this.veh.length)&&(!success); i++){
        if((this.veh[i].u<=uPick) && (this.veh[i].id>=10)
	   && (this.veh[i].type != "obstacle")){
	       iPick=i;
	       success=true;
	}
    }
    if(!success){
	console.log("road.disturbOneVehicle: found no suitable"+
		    " normal vehicle upstream of u="+uPick+" to disturb");
    }
    else{
	this.veh[iPick].id=10;
	this.veh[iPick].speed=Math.max(0.,this.veh[iPick].speed-speedReduce);
     
    }
}// disturbOneVehicle


//######################################################################
// get direction of road at arclength u
//######################################################################
/**
@param u=actual arclength for which to get direction
@return direction (heading) of the road (0=East, pi/2=North etc)
*/

road.prototype.get_phi=function(u){

    var smallVal=0.0000001;

    var du=0.1;
    var dx=this.traj_x(u+du)-this.traj_x(u-du);
    var dy=this.traj_y(u+du)-this.traj_y(u-du);
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
    var phiPlus=this.get_phi(u+du);
    var phiMinus=this.get_phi(u-du);
    return 0.5*(phiPlus-phiMinus)/du;

}

//######################################################################
// get x pixel coordinate of logical long coord u and transv v (pos if right)
//######################################################################
/**
@param u=logical longitudinal coordinate (zero at beginning)
@param v=logical transversal coordinate (zero at road center, towards right)
@param scale translates physical road coordinbates into pixel:[scale]=pixels/m
@return x pixel coordinate
*/

road.prototype.get_xPix=function(u,v,scale){
    var phi=this.get_phi(u);
    return scale*(this.traj_x(u)+v*Math.sin(phi));
}

//######################################################################
// get yPix coordinate from logical coordinates (yPix increasing downwards)
//######################################################################
/**
@param u=logical longitudinal coordinate (zero at beginning)
@param v=logical transversal coordinate (zero at road center, towards right)
@param scale translates physical road coordinbates into pixel:[scale]=pixels/m
@return y pixel coordinate
*/

road.prototype.get_yPix=function(u,v,scale){
    var phi=this.get_phi(u);
    return -scale*(this.traj_y(u)-v*Math.cos(phi));
}

 

//######################################################################
// draw road (w/o vehicles; for latter -> drawVehicles(...)
//######################################################################

/**
@param scale:     physical road coordinbates => pixels, [scale]=pixels/m
@param roadImg:   image of a (small, straight) road element
@param changed geometry: true if a resize event took place in parent
@param movingObs: (optional) whether observer is moving, default=false 
@param uObs:      (optional) location uObs,vObs=0 is drawn at the physical
@param xObs,yObs: position (xObs,yObs)=>xPix=scale*xObs, yPix=-scale*yObs,
                  all other positions relative to it
                  !Need to define (xObs,yObs) separately since other links
                  such as onramps may be drawn relatively to the position
                  of the actual link (e.g. mainroad)

@return draw into graphics context ctx (defined in calling routine)
*/

road.prototype.draw=function(roadImg,scale,changedGeometry,
			     movingObs,uObs,xObs,yObs){

    var movingObserver=(typeof movingObs === 'undefined')
	? false : movingObs;
    var uRef=(movingObserver) ? uObs : 0;
    var xRef=(movingObserver) ? xObs : this.traj_x(0);
    var yRef=(movingObserver) ? yObs : this.traj_y(0);

    //console.log("road.draw: uRef=",uRef, " xRef=",xRef, " yRef=",yRef);

    var smallVal=0.0000001;
    var boundaryStripWidth=0.3*this.laneWidth;

    var factor=1+this.nLanes*this.laneWidth*this.draw_curvMax; // "stitch factor"
    var lSegm=this.roadLen/this.draw_nSegm;

    // lookup table only at beginning or after rescaling => 
    // now condition in calling program

    if(changedGeometry){
    //if(Math.abs(scale-this.draw_scaleOld)>smallVal){
	this.draw_scaleOld=scale;
        for (var iSegm=0; iSegm<this.draw_nSegm; iSegm++){
	  var u=this.roadLen*(iSegm+0.5)/this.draw_nSegm;
	  this.draw_x[iSegm]=this.traj_x(u); 
	  this.draw_y[iSegm]=this.traj_y(u);
	  this.draw_phi[iSegm]=this.get_phi(u);
	  this.draw_cosphi[iSegm]=Math.cos(this.draw_phi[iSegm]);
	  this.draw_sinphi[iSegm]=Math.sin(this.draw_phi[iSegm]);

	  if(false){
	    console.log("road.draw: iSegm="+iSegm+" u="+u
	  	   +" xPhys="+this.draw_x[iSegm]
                   +" yPhys="+this.draw_y[iSegm]
                   +" phi="+this.draw_phi[iSegm]);
	  }
	}
    }

    // actual drawing routine

    for (var iSegm=0; iSegm<this.draw_nSegm; iSegm++){
	var cosphi=this.draw_cosphi[iSegm];
	var sinphi=this.draw_sinphi[iSegm];
	var lSegmPix=scale*factor*lSegm;
	var wSegmPix=scale*(this.nLanes*this.laneWidth+boundaryStripWidth);

	var xCenterPix= scale*(this.draw_x[iSegm]-this.traj_x(uRef)+xRef); 
	var yCenterPix=-scale*(this.draw_y[iSegm]-this.traj_y(uRef)+yRef);


	ctx.setTransform(cosphi, -sinphi, +sinphi, cosphi, xCenterPix,yCenterPix);
	ctx.drawImage(roadImg, -0.5*lSegmPix, -0.5* wSegmPix,lSegmPix,wSegmPix);
	if(false){
	  console.log("road.draw: iSegm="+iSegm+
		      " cosphi="+cosphi+" factor="+factor+
		      " lSegmPix="+lSegmPix+" wSegmPix="+wSegmPix+
		      " xCenterPix="+xCenterPix+" yCenterPix="+yCenterPix);
	}
    }
}// draw road




//######################################################################
// draw vehicles
//######################################################################

/**

draws vehicle images into graphics context ctx (defined in calling routine)
normal vehicles (except the black obstacles) are color-coded 
special vehicles have special appearance according to

veh.id<100:              special vehicles
veh.id=1:                ego vehicle
veh.id=10,11, (max 99):  disturbed vehicles 
veh.id>=100:             normal vehicles

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

@return draw into graphics context ctx (defined in calling routine)
*/

road.prototype.drawVehicles=function(carImg, truckImg, obstacleImg, scale,
				     speedmin,speedmax,umin,umax,
				     movingObs, uObs, xObs, yObs){
    if(false){
	console.log("in road.drawVehicles:");
	//this.writeVehiclesSimple();
	this.writeTrucksLC();
    }
    var noRestriction=(typeof umin === 'undefined'); 
    var movingObserver=(typeof movingObs === 'undefined')
	? false : movingObs;
    var uRef=(movingObserver) ? uObs : 0;
    var xRef=(movingObserver) ? xObs : this.traj_x(0);
    var yRef=(movingObserver) ? yObs : this.traj_y(0);

    for(var i=0; i<this.veh.length; i++){
      if(noRestriction || ((this.veh[i].u>=umin)&&(this.veh[i].u<=umax))){
          var type=this.veh[i].type;
          var vehLenPix=scale*this.veh[i].length;
          var vehWidthPix=scale*this.veh[i].width;
          var uCenterPhys=this.veh[i].u-0.5*this.veh[i].length;

          // v increasing from left to right, 0 @ road center

          var vCenterPhys=this.laneWidth*(this.veh[i].v-0.5*(this.nLanes-1)); 

          var phiRoad=this.get_phi(uCenterPhys);
          var phiVehRel=(this.veh[i].speed<0.001) 
	      ? 0
	      : -Math.atan(this.veh[i].dvdt*this.laneWidth/this.veh[i].speed);
          var phiVeh=phiRoad + phiVehRel;
          var cphiRoad=Math.cos(phiRoad);
          var sphiRoad=Math.sin(phiRoad);
          var cphiVeh=Math.cos(phiVeh);
          var sphiVeh=Math.sin(phiVeh);
          var xCenterPix= scale*(this.traj_x(uCenterPhys) + vCenterPhys*sphiRoad
				 -this.traj_x(uRef)+xRef);
          var yCenterPix=-scale*(this.traj_y(uCenterPhys) - vCenterPhys*cphiRoad
				 -this.traj_y(uRef)+yRef);

          // (1) draw vehicles as images

          vehImg=(type=="car") ? carImg : (type=="truck") ? truckImg : obstacleImg;
          ctx.setTransform(cphiVeh, -sphiVeh, +sphiVeh, cphiVeh, xCenterPix, yCenterPix);
          ctx.drawImage(vehImg, -0.5*vehLenPix, -0.5*vehWidthPix,
			vehLenPix,vehWidthPix);

          // (2) draw semi-transp boxes of speed-dependent color 
          //     over the images
          //     (different size of box because of mirrors of veh images)

	  if(type!="obstacle"){
              var effLenPix=(type=="car") ? 0.95*vehLenPix : 0.90*vehLenPix;
              var effWPix=(type=="car") ? 0.55*vehWidthPix : 0.70*vehWidthPix;
              var speed=this.veh[i].speed;
	      var isEgo=(this.veh[i].id==1);
	      var isPerturbed=(this.veh[i].id==10);
              ctx.fillStyle=colormapSpeed(speed,speedmin,speedmax,type,
					  isEgo,time);
	      ctx.fillRect(-0.5*effLenPix, -0.5*effWPix, effLenPix, effWPix);
	      if((isEgo)||(isPerturbed)){
		  ctx.strokeStyle="rgb(0,0,0)";
		  ctx.strokeRect(-0.55*effLenPix, -0.55*effWPix, 
			       1.1*effLenPix, 1.1*effWPix);
		  ctx.strokeRect(-0.6*effLenPix, -0.6*effWPix, 
			       1.2*effLenPix, 1.2*effWPix);
		  ctx.strokeRect(-0.65*effLenPix, -0.65*effWPix, 
			       1.3*effLenPix, 1.3*effWPix);
		  ctx.strokeRect(-0.7*effLenPix, -0.7*effWPix, 
			       1.4*effLenPix, 1.4*effWPix);
	      }
	  }
          ctx.fillStyle="rgb(0,0,0)";


	  if(false){
	  //if(this.veh[i].v>2){
	      console.log("in road.drawVehicles: itime=",itime,
			  +" u="+this.veh[i].u
			  +" v="+this.veh[i].v
			  +" xCenterPix="+xCenterPix
			  +" yCenterPix="+yCenterPix
			 );
	  }
      }
    }
}
