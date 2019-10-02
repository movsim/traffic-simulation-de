
//###############################################################
// mouse and touch event callbacks
//###############################################################
/*
          onmouseenter="handleMouseEnter(event)"
          onmousedown="handleMouseDown(event)"
          onmousemove="handleMouseMove(event)"
          onmouseup="handleMouseUp(event)" 
          onclick="handleClick(event)" <!-- only for slowing down vehs-->
          onmouseout="cancelActivities(event)"
*/


// special vehicles:
// types: 0="car", 1="truck", 2="obstacle" (including red traffic lights)
// id's defined mainly in vehicle.js and ObstacleTLDepot.js
// id<100:              special vehicles/road objects
// id=1:                ego vehicle
// id=10,11, ..49       disturbed vehicles 
// id=50..99            depot vehicles/obstacles
// id=100..199          traffic lights
// id>=200:             normal vehicles and obstacles
// they are specially drawn and externally influenced from the main program


console.log("reading canvas_gui.js");

var xUser, yUser;       // physical coordinates 
var xUserDown, yUserDown; // physical coordinates at mousedown/touchStart evt
var mousedown=false; //true if onmousedown event fired, but not yet onmouseup
var touchdown=false; //true if touchstart event fired, but not yet touchend

//var depotObjPicked=false; //true if a depot obj < distmin @ last mousedown
//var funnelObjPicked=false; //same for a SpeedFunnel object
var roadPicked=false; // true if none of the above and distRoad<crit   " "
var trafficObjPicked=false; // xxxNew

//var depotVehZoomBack=false; // =true after unsuccessful drop

//var depotObject;       // element depot.obstTL[i] of global var depot
//var funnelObject;      // element speedl[i] of global var speedfunne
var trafficObject;     // xxxNew one traffic light, speed limit, or obstacle
var specialRoadObject; // element road.veh[i]: obstacles, TL, user-driven vehs
var distDragCrit=10;   // drag function if dragged more [m]; otherwise click
var distDrag=0;        // physical distance[m] of the dragging
var idPerturbed=10;    // id=10 is that of first perturbed veh; then incr

// secondaryRoad='undefined' in ring,roadworks,uphill scenarios,
// =oramp/offramp/deviation in the three "network" scenarios

var isNetworkScenario; // scenarios with two or more roads
var draggedRoad;       // defined in onmousedown callback
var secondaryRoad;     // defined in onmouseenter callback
                       // (mainroad always exists in main js under this name)



//#####################################################
// register touch listeners (does not seem to work directly in html
// as for the mouse listeners), called in the main.js files after defining canvas
//#####################################################

function addTouchListeners() {
    console.log("in gui.addTouchListeners()");
    canvas.addEventListener("touchstart", handleTouchStart, false);
    canvas.addEventListener("touchmove", handleTouchMove, false);
    canvas.addEventListener("touchend", handleTouchEnd, false);
    canvas.addEventListener("touchcancel", cancelActivities, false);
    console.log("addTouchListeners(): initialized some touch listeners");
}


//#####################################################
// touchstart event callback
//#####################################################

function handleTouchStart(evt) {
    //console.log("in handleTouchStart(evt)");
    evt.preventDefault();

    getTouchCoordinates(evt);  // xUser, yUser

    // memorize starting touch point (vars also used for mousedown event)

    touchdown=true;
    xUserDown=xUser;
    yUserDown=yUser;

    // do the actual action (=> mouse section)
 
    defineSzenarioBasedVariables(scenarioString);
    pickRoadOrObject(xUser, yUser); 

    // test

    if(true){
        ctx.beginPath();
        ctx.arc(scale*xUser,-scale*yUser,
	    4, 0, 2 * Math.PI, false);  // a circle at the start
        ctx.fillStyle = "rgb(0,255,0)";
        ctx.fill();
    }

}


// gets physical coordinates for all touch events
// for mouse events: getMouseCoordinates((event)

function getTouchCoordinates(event){
    var touch = event.changedTouches[0]; // multitouch: several components

    var rect = canvas.getBoundingClientRect();
    var xPixLeft=rect.left; // left-upper corner of the canvas 
    var yPixTop=rect.top;   // in browser reference system
    xPixUser= touch.clientX-xPixLeft; //pixel coords in canvas reference
    yPixUser= touch.clientY-yPixTop; 
    xUser=xPixUser/scale;   //scale from main js onramp.js etc
    yUser=-yPixUser/scale;   //scale from main js onramp.js etc

    if(false){
	console.log("getTouchCoordinates: xUser=",xUser," yUser=",yUser);
    }

}



//#####################################################
// touchmove event callback
//#####################################################

function handleTouchMove(evt) {
    //console.log("in handleTouchMove(evt)");
    evt.preventDefault();

    getTouchCoordinates(evt); // xUser, yUser

    // do the actual action (=> mouse section)
    // [xy]UserDown from handleTouchStart

    doDragging(xUser,yUser,xUserDown,yUserDown);

    // test
    if(false){
        ctx.beginPath();
        ctx.arc(scale*xUser,-scale*yUser,
	    4, 0, 2 * Math.PI, false);  // a circle at the start
        ctx.fillStyle = "rgb(0,0,255)";
        ctx.fill();
    }

}


//#####################################################
// touchend event callback
//#####################################################


function handleTouchEnd(evt) {
    //console.log("in handleTouchEnd(evt)");
    evt.preventDefault();

    getTouchCoordinates(evt); // xUser, yUser

    // do the action (=> see mouse section)

    finishDistortOrDropObject(xUser, yUser); 
    influenceClickedVehOrTL(xUser,yUser);

    // test

    if(false){
        // test (a square at the end)
        //ctx.beginPath();
        ctx.fillStyle = "rgb(255,0,0)";
        ctx.fillRect(scale*xUser - 4,-scale*yUser - 4, 8, 8); 
    }
}
 

//#####################################################
//touchcancel => cancelActivities(event) at the end of mouse section
// (at moment, do nothing)
//#####################################################






//#####################################################
// canvas onmouseenter callback
//#####################################################

function handleMouseEnter(event){
    defineSzenarioBasedVariables(scenarioString);
}


// define some global scenario-related network variables

function defineSzenarioBasedVariables(scenarioString){
    isNetworkScenario=true;
    if((scenarioString==="OnRamp")||(scenarioString==="OffRamp")
       || (scenarioString==="Deviation")){
	   secondaryRoad=ramp;
    }
    else {
	isNetworkScenario=false;
	secondaryRoad='undefined';
    }
}



//#####################################################
// canvas onmousedown callback
//#####################################################

function handleMouseDown(event){
    mousedown=true;
    getMouseCoordinates(event); //=> xUser,yUser;
    //console.log("\n\nafter getMouseCoordinates: xUser=",xUser);
    xUserDown=xUser; // memorize starting point of mouse drag
    yUserDown=yUser;
    pickRoadOrObject(xUser,yUser);
}


// get physical coordinates for all mouse events
// for touch events: getTouchCoordinates(event)


function getMouseCoordinates(event){

    // always use canvas-related pixel and physical coordinates

    var rect = canvas.getBoundingClientRect();
    var xPixLeft=rect.left; // left-upper corner of the canvas 
    var yPixTop=rect.top;   // in browser reference system
    xPixUser= event.clientX-xPixLeft; //pixel coords in canvas reference
    yPixUser= event.clientY-yPixTop; 
    xUser=xPixUser/scale;   //scale from main js onramp.js etc
    yUser=-yPixUser/scale;   //scale from main js onramp.js etc (! factor -1)

    if(false){
	console.log("getMouseCoordinates: xUser=",xUser," yUser=",yUser);
    }
}


// #########################################################
// do the action 1: pick
// var mainroad=new road(...), ramp=new road(...),
// var trafficObject=new TrafficObject(..) defined in the main sim files
// #########################################################

function pickRoadOrObject(xUser,yUser){

  console.log("itime=",itime," in pickRoadOrObject(canvas_gui):");
  
  /* priorities (at most one action initiated at a given time):

    (1) pick/drag trafficObject on a road or in the depot. 
    (2) test for a road section nearby

    later stages not here but at onmousemove or onmouseup (onclick) callbacks
    (3) drag on road less than crit and then mouse up => click: slow down road
    (4) drag on road more than crit: roadPicked=true

  */




 //==============================================================
  // (1) pick/select an active or passive trafficObject
  // trafficObjs.pickObject returns [successFlag, thePickedObj]
  //==============================================================

  if(!(typeof trafficObjs === 'undefined')){
    var distCrit_m=20; //[m] !! make it rather larger  
    var pickResults=trafficObjs.pickObject(xPixUser, yPixUser, 
				      distCrit_m*scale);
    if(pickResults[0]){
      trafficObject=pickResults[1];
      trafficObjPicked=true;
      roadPicked=false;
      console.log("  end pickRoadOrObject: success! picked trafficObject id=",
		  trafficObject.id," type ",
		  trafficObject.type,
		  " isActive=",trafficObject.isActive,
		  " inDepot=",trafficObject.inDepot," end");
       return;
    }
    else console.log("  pickRoadOrObject (1): no trafficObject found");
  }

  // (2) test for a road section nearby //!!! modify for ref to network
// road.testCRG returns [success,distmin_m,dx_m, dy_m]

  if(userCanDistortRoads){
    var pickResults1=mainroad.testCRG(xUser, yUser); // distCrit def by road
    var pickResults2=[false,1e6,1e6,1e6];
    if(isNetworkScenario){
	pickResults2=secondaryRoad.testCRG(xUser, yUser);
    }
    var success=(pickResults1[0] || pickResults2[0]);
    if(success){
      console.log("  pickRoadOrObject (2): success!",
		  " picked a road section for dragging",
		" as soon as distDrag>distDragCrit");

      draggedRoad=(pickResults1[1]<pickResults2[1])
	      ? mainroad : secondaryRoad;
      depotObjPicked=false;
      funnelObjPicked=false;
      roadPicked=true;
    }
    else{
      console.log("  pickRoadOrObject (2): no nearby road found",
		" pickResults1[2]=",pickResults1[2]);
    }
  }
  else{
    console.log("  pickRoadOrObject (2): user cannot distort roads, so n.a.");
  }

 // (4) pick normal road vehicle to slowing it down: onclick callback: 
 // handled onclick (=onmouseup) by 
 // this.influenceClickedVehOrTL(xUser,yUser)
 // but only if distDrag<distDragCrit at this time

 // (5) pick a road section to change road geometry (CRG) by dragging it
 // road.testCRG returns [success,Deltax,Deltay]
 // handled in onmousemove+onmousedown and onmouseup events only if 
 // distDrag>distDragCrit at this time

  console.log("  end pickRoadOrObject: found no suitable action!",
	      " [notice: clicking callback is separate from this]");


} // canvas onmousedown or touchStart: pickRoadOrObject



//#####################################################
// canvas onmousemove callback
//#####################################################

// [xy]UserDown from touchinit/mousedown

function handleMouseMove(event){
  //console.log("in handleMouseMove(evt): mousedown=",mousedown);
  getMouseCoordinates(event); //=> xUser,yUser;
  doDragging(xUser,yUser,xUserDown,yUserDown);

  // !! draw moved objects also outside of sim thread 
  // to be able to move objects before starting/during stopped simulation

  drawSim();
}




// do drag actions if onmousemove&&mousedown or if touchdown=true
//which action(s) (booleans depotObjPicked, funnelObjPicked,roadPicked) 
//is determined by onmousedown/touchStart  callback


function doDragging(xUser,yUser,xUserDown,yUserDown){

    if(mousedown||touchdown){ 
        userCanvasManip=true; // if true, new backgr, new road drawn

	distDrag=Math.sqrt(Math.pow(xUser-xUserDown,2)
			   + Math.pow(yUser-yUserDown,2));

	if(false){
	    console.log("mousemove && mousedown: roadPicked=",roadPicked,
		    " depotObjPicked=",depotObjPicked,
		    " funnelObjPicked=",funnelObjPicked,
		    " xUser=",xUser,"xUserDown=",xUserDown,
		    " distDrag=",distDrag,
		    " distDragCrit=",distDragCrit);
	}

	if(distDrag>distDragCrit){ // !!! do no dragging actions if only click
	    if(trafficObjPicked){//xxxNew !!! change isPicked, isDragged, deactivate if isActive
	      trafficObject.isDragged=true;
	      trafficObject.xPix=xPixUser;
	      trafficObject.yPix=yPixUser;
	    }
	    if(roadPicked){
	        dragRoad(xUser,yUser);
	    }

	}
    }


    // reset dragged distance to zero if mouse is up

    else{distDrag=0;} 
}




//#####################################################
// canvas onmouseup callback
//#####################################################


function handleMouseUp(evt) {
  //console.log("in handleMouseUp(evt)");

  getMouseCoordinates(evt); // => xUser, yUser
  finishDistortOrDropObject(xUser, yUser); 
  drawSim();

}


// #########################################################
// do the action 2: drop=finalize dragging action 
// Notice: klicking action influenceClickedVehOrTL(..) is separately below 
// while both called in handleTouchEnd(evt)
// #########################################################

function finishDistortOrDropObject(xUser, yUser){
  if(true){
    console.log("itime=",itime," in finishDistortOrDropObject (canvas_gui):",
    		" trafficObjPicked=",trafficObjPicked,
   		" roadPicked=",roadPicked,
  		"");
  }

  mousedown=false;
  touchdown=false;
  
  if(distDrag<distDragCrit){
    console.log("  end finishDistortOrDropObject: dragging crit",
		" distDrag =",distDrag,"< distDragCrit=",distDragCrit,
		" not satisfied (only click) => do nothing)");
    return;
  }


  if(roadPicked){
    userCanvasManip=true; // if true, new backgr, new road drawn
    roadPicked=false;
    //console.log(" before draggedRoad.finishCRG()");
    draggedRoad.finishCRG();
    handleDependencies();
    console.log("  end finishDistortOrDropObject: distorted road");
  }


  if(trafficObjPicked){//xxxNew

    var network=[];
    network[0]=mainroad;
    if(isNetworkScenario){
      network[1]=secondaryRoad; //xxxNew !!! define top-level at beg of file
    }
    var distCrit_m=20;  // optimize!!!
    var distCritPix=distCrit_m*scale;
    trafficObjs.dropObject(trafficObject, network, 
			   xPixUser, yPixUser, distCritPix, scale);
    console.log("  end finishDistortOrDropObject: dropped object");
  }

  
} // handleMouseUp -> finishDistortOrDropObject



//#####################################################
// canvas onclick and part of touchEnd callback
//#####################################################

function handleClick(event){
  getMouseCoordinates(event); //=> xPixUser, yPixUser, xUser, yUser;
  if(false){
    console.log("in handleClick(event): xPixUser=",xPixUser,
		" yPixUser=",yPixUser, " xUser=",xUser," yUser=",yUser);
  }
  influenceClickedVehOrTL(xUser,yUser);
}


//##################################################
// onclick callback: change lights if a traffic light is nearby,
// otherwise slowdown veh if one is nearby
//##################################################

function influenceClickedVehOrTL(xUser,yUser){
  console.log("\n\nitime=",itime," onclick: in influenceClickedVehOrTL");

  if(distDrag<distDragCrit){ // only do actions if click, no drag

 
    var success=trafficObjs.changeTrafficLightByUser(xPixUser,yPixUser);

    // only slowdown clicked vehicles if 
    // (i) TL switch no success, (ii) only insignificant drag ;  
    // (iii) nearest selected vehicle is nearer than distDragCrit 
    // distDragCrit controls both (ii) and (iii)
    // Note: dragging actions with converse filter by onmousedown,-move,-up ops

    if(!success){
      slowdownVehNearestTo(xUser,yUser,distDragCrit);

      
      console.log("  end influenceClickedVehOrTL: called",
		  " slowdownVehNearestTo");

    }

  }


  // reset drag distance recorder

  distDrag=0;

} // influenceClickedVehOrTL



//#####################################################
// canvas onmouseout/ callback
//#####################################################

function cancelActivities(event){
    //console.log("in cancelActivities");
    mousedown=false;
    touchdown=false;
    depotObjPicked=false;
    funnelObjPicked=false;
    roadPicked=false;
    depotVehZoomBack=true;
}








//#####################################################
// helper functions
//#####################################################




// the dragging changes road lengths and ramp merging positions
// => the "network" scenarios "OnRamp", "OffRamp", and "Deviation"
// need corresponding network corrections

function handleDependencies(){
    //console.log("handleDependencies: scenarioString=",scenarioString);

    if(scenarioString==="OnRamp"){

        // update end-ramp obstacle and ramp->main offset

	ramp.veh[0].u=ramp.roadLen-0.6*taperLen; // shift end-obstacle

        // search mainroad u-point nearest to merging point of onramp

	var uMainNearest=ramp.getNearestUof(mainroad, 
					      ramp.roadLen-mergeLen);
	mainRampOffset=uMainNearest-(ramp.roadLen-mergeLen);

    }

    else if(scenarioString==="OffRamp"){

        // search mainroad u-point nearest to diverging point of onramp
        // and update offrampInfo

	var uMainNearest=ramp.getNearestUof(mainroad,divergeLen);
	mainOffOffset=uMainNearest-divergeLen;
	rampLastExits=[mainOffOffset+divergeLen];
	mainroad.setOfframpInfo(offrampIDs,offrampLastExits,offrampToRight);

    }

    else if(scenarioString==="Deviation"){
	if(false){
	  console.log("before canvas_gui.handleDependencies for \"Deviation\"",
		    "\n   umainMerge=",umainMerge,
		    "\n   umainDiverge=",umainDiverge
		   );
	}

       // update (i)  the two offsets, (ii) offrampinfo (see routing.js), 
       // (iii) end-deviation obstacle at onramp 
       // described by umainDiverge,umainMerge

	umainDiverge=ramp.getNearestUof(mainroad,lrampDev)-lrampDev;
	umainMerge=ramp.getNearestUof(mainroad,
					   ramp.roadLen-lrampDev);
	offrampLastExits=[umainDiverge+lrampDev];
	mainroad.setOfframpInfo(offrampIDs,offrampLastExits,offrampToRight);

	ramp.veh[0].u=ramp.roadLen-0.6*taperLen;

	if(false){
	console.log("after canvas_gui.handleDependencies for \"Deviation\"",
		    "\n   umainMerge=",umainMerge,
		    "\n   umainDiverge=",umainDiverge
		   );
	}
    }

}




//##############################################################
// helper function for drag (onmousemove if onmousedown) events
//##############################################################


function dragDepotObject(xPixUser,yPixUser){ 
  //console.log("in dragDepotObject: xPixUser=",xPixUser," yPixUser=",yPixUser);
  depotObject.xPix=xPixUser;
  depotObject.yPix=yPixUser;
}

function dragFunnelObject(xPixUser,yPixUser){
  //console.log("in dragFunnelObject: xPixUser=",xPixUser," yPixUser=",yPixUser);
  funnelObject.xPix=xPixUser;
  funnelObject.yPix=yPixUser;
}

function dragRoad(xUser,yUser){
    //console.log("in canvas_gui: dragRoad, scenarioString=",scenarioString);

    userCanvasManip=true; // if true, new backgr, new road drawn

    // "one-road" scenarios

    if(!isNetworkScenario){ 
	draggedRoad.doCRG(xUser,yUser);
    }
      
    // "network scenarios

    else if(scenarioString==="OnRamp"){

	var otherRoad=(draggedRoad===mainroad) ? ramp : mainroad;

        // uBeginRamp always fixed since mergeLen fixed 
        // and merge always at the end of the ramp
 
	var uBeginRamp=ramp.roadLen-mergeLen; 
	var uBeginMain=ramp.getNearestUof(mainroad,uBeginRamp); 
	var uBegin=(draggedRoad===mainroad) ? uBeginMain : uBeginRamp;
	if(false){
	    console.log(
	    "canvas.dragRoad: draggedRoad=",
	    ((draggedRoad===mainroad) ? "mainroad" : "ramp"),
	    "\n  uBeginRamp=",uBeginRamp," rampLen=",ramp.roadLen,
	    "\n   uBeginMain=",uBeginMain," mainLen=",mainroad.roadLen,
	    "\n   uBegin=",uBegin);
	}

	draggedRoad.doCRG(xUser,yUser,otherRoad,uBegin,mergeLen);
    }

    else if(scenarioString==="OffRamp"){ // divergeLen constant

	var otherRoad=(draggedRoad===mainroad) ? ramp : mainroad;

	var uBeginRamp=0; // begin diverge=>ramp.u=0
	var uBeginMain=ramp.getNearestUof(mainroad,divergeLen)-divergeLen; 
	var uBegin=(draggedRoad===mainroad) ? uBeginMain : uBeginRamp;
	if(false){
	    console.log(
	    "canvas.dragRoad: draggedRoad=",
	    ((draggedRoad===mainroad) ? "mainroad" : "offramp"),
	    "\n   uBeginRamp=",uBeginRamp," rampLen=",ramp.roadLen,
	    "\n   uBeginMain=",uBeginMain," mainLen=",mainroad.roadLen,
	    "\n   uBegin=",uBegin);
	}

        // draggedRoad.doCRG(xUser,yUser,otherRoad,uBegin,commonLen)

	draggedRoad.doCRG(xUser,yUser,otherRoad,uBegin,divergeLen);


    }

    else if(scenarioString==="Deviation"){

	var otherRoad=(draggedRoad===mainroad) ? ramp : mainroad;

	var uBeginDivergeRamp=0; // begin diverge=>ramp.u=0
	var uBeginDivergeMain
	    =ramp.getNearestUof(mainroad,lrampDev)-lrampDev;
	var uBeginDiverge=(draggedRoad===mainroad)
	    ? uBeginDivergeMain : uBeginDivergeRamp;

	var uBeginMergeRamp=ramp.roadLen-lrampDev;
	var uBeginMergeMain
	    =ramp.getNearestUof(mainroad,ramp.roadLen-lrampDev);
	var uBeginMerge=(draggedRoad===mainroad)
	    ? uBeginMergeMain : uBeginMergeRamp;

	var iPivot=draggedRoad.iPivot;
	var uDragged=draggedRoad.roadLen*iPivot/draggedRoad.nSegm;
	var uOther=draggedRoad.getNearestUof(otherRoad,uDragged);
	var isNearDiverge=(uDragged<0.5*draggedRoad.roadLen);

	if(false){
	console.log(
	    "canvas.dragRoad: draggedRoad=",
	    ((draggedRoad===mainroad) ? "mainroad" : "deviation"),
	    "\n   uBeginDivergeRamp=",uBeginDivergeRamp,
	    " rampLen=",ramp.roadLen,
	    "\n   uBeginDivergeMain=",uBeginDivergeMain,
	    " mainLen=",mainroad.roadLen,
	    "\n   uBeginDiverge=",uBeginDiverge,
	    "\n   uBeginMergeRamp=",uBeginMergeRamp,
	    " rampLen=",ramp.roadLen,
	    "\n   uBeginMergeMain=",uBeginMergeMain,
	    " mainLen=",mainroad.roadLen,
	    "\n   uBeginMerge=",uBeginMerge,
	    "\n   iPivot=",iPivot," isNearDiverge=",isNearDiverge,
	    "\n   uDragged=",uDragged," uOther=",uOther
	);
	}

        // do the actual action


	var iPivot=draggedRoad.iPivot;
	var isNearDiverge=(iPivot<0.5*draggedRoad.nSegm);

       // draggedRoad.doCRG(xUser,yUser,otherRoad,uBegin,commonLen)

	if(isNearDiverge){
	    draggedRoad.doCRG(xUser,yUser,otherRoad,uBeginDiverge,lrampDev);
	}
	else{
	    draggedRoad.doCRG(xUser,yUser,otherRoad,uBeginMerge,lrampDev);
	}

    }

}



//#####################################################
// helper function for onclick and touched(?) events
//#####################################################

function slowdownVehNearestTo(xUser,yUser,distCrit){

    var speedReduceFactor=0.5;

    // all scenarios have a mainroad (road.find(...) called w/o filter fun)

    var findResults1=mainroad.findNearestVehTo(xUser,yUser);

    var success1=findResults1[0];

    // default for road2 (not defined)

    var findResults2;
    var success2=false;

    if(isNetworkScenario){ 
	findResults2=secondaryRoad.findNearestVehTo(xUser,yUser);
	success2=findResults2[0];
    }

    if((!success1)&&(!success2)){
	//console.log("influenceVehNearestTo: no suitable vehicle found!");
	return;
    }

    // findResults=[successFlag, pickedVeh, minDist]

    var vehPerturbed=findResults1[1];
    var targetRoad=mainroad;
    var distMin=findResults1[2];
    if(isNetworkScenario&&success2){
	if(findResults2[2]<distMin){
	    vehPerturbed=findResults2[1];
	    targetRoad=secondaryRoad;
	    distMin=findResults2[2];
	}
    }

    if(distMin<=distCrit){

        //console.log("canvas slowdownVehNearestTo: vehPerturbed=",
	//	    vehPerturbed);

        // only slow down+change its id if target object is 
        // neither a traffic light nor a depot vehicle nor an obstacle
        // NOTICE: change state of TL by other function since
        //(i) a red TL is crowded by waiting veh,
        // (ii) and a green TL has no virtual vehicles to be selected

        if(vehPerturbed.isRegularVeh()){
	    vehPerturbed.id=idPerturbed;  // to distinguish it by color
	    //vehPerturbed.speed=Math.max(0.,vehPerturbed.speed-speedReduce);
	    vehPerturbed.speed *= speedReduceFactor;
	    idPerturbed++; if(idPerturbed===50){idPerturbed=10;}
	}
    }
}



function showPhysicalCoords(xUser,yUser){
    //console.log("in showPhysicalCoords: xUser=",xUser," yUser=",yUser);
    //console.log("in showPhysicalCoords");
}



