
//###############################################################
// mouse and touch event callbacks
//###############################################################
/*
          onmousemove="getCoordinatesDoDragging(event)"
          onmouseout="cancelActivities(event)"
          onclick="canvasClickCallback(event)"
          onmousedown="pickRoadOrVehicle()" 
          onmouseup="finishDistortionOrDropVehicle()"
*/

// types: 0="car", 1="truck", 2="obstacle"
// id<100:              special vehicles
// id=1:                ego vehicle
// id=10,11, ..49       disturbed vehicles 
// id=50..99            depot vehicles/obstacles
// id>=100:             normal vehicles and obstacles



var xPixLeft, yPixTop;
var xPixMouse, yPixMouse;
var xUser, yUser;
var xUserDown, yUserDown; // physical coordinates at (first) mousedown event
var mousedown=false; // true if onmousedown event fired, but not yet onmouseup
var vehDragging=false; // true if mousedown and a depot vehicle is nearest
var roadDragging=false; // true if mousedown and a road is nearest
var depotVehZoomBack=false; // =true after unsuccessful drop

var draggedVehicle; // from vehicleDepot; among others phys. Pos x,y
var draggedRoad; 
var distminDrag=0.8;  // drag function if dragged more [m]; otherwise click
var distDrag=0; // physical distance[m] of the dragging

//#####################################################
// canvas onmousemove callback
//#####################################################

function getCoordinatesDoDragging(event){

    //console.log("onmousemove: in getCoordinatesDoDragging: mousedown=",mousedown);

    // mouse position in client window pixel and physical coordinates

    var rect = canvas.getBoundingClientRect();
    xPixLeft=rect.left;
    yPixTop=rect.top;
    xPixMouse = event.clientX-xPixLeft; 
    yPixMouse = event.clientY-yPixTop; 
    xUser=xPixMouse/scale;   //scale from main js onramp.js etc
    yUser=-yPixMouse/scale;   //scale from main js onramp.js etc

    //showPhysicalCoords(xUser,yUser);

   // do actions
   // booleans mousedown, vehDragging, roadDragging 
   // controlled by onmousedown and onmouseup or corr touch events

    if(mousedown){ // boolean mousedown, vehDragging, roadDragging

        userCanvasManip=true; // if true, new backgr, new road drawn

	distDrag=Math.sqrt(Math.pow(xUser-xUserDown,2)
			   + Math.pow(yUser-yUserDown,2));

	if(distDrag>distminDrag){ // do no dragging actions if only click
	    if(vehDragging){
	        dragVehicle(xUser,yUser);
	    }
	    if(roadDragging){
	        dragRoad(xUser,yUser);
	    }
	}
    }
    else{distDrag=0;} // if mouse is up, nothing is dragged
}

function showPhysicalCoords(xUser,yUser){
    //console.log("in showPhysicalCoords: xUser=",xUser," yUser=",yUser);
    //console.log("in showPhysicalCoords");
}

function dragVehicle(xUser,yUser){
    //console.log("in dragVehicle: xUser=",xUser," yUser=",yUser);
    draggedVehicle.x=xUser;
    draggedVehicle.y=yUser;
}

function dragRoad(xUser,yUser){
    console.log("in canvas_gui: dragRoad, scenarioString=",scenarioString);

    userCanvasManip=true; // if true, new backgr, new road drawn

    // "one-road" scenarios

    if((scenarioString=="Ring") || (scenarioString=="RoadWorks")
       || (scenarioString=="Uphill")){ 
	draggedRoad.doCRG(xUser,yUser);
    }
      
    // "network scenarios

    else if(scenarioString=="OnRamp"){

	var otherRoad=(draggedRoad==mainroad) ? onramp : mainroad;

        // uBeginRamp always fixed since mergeLen fixed 
        // and merge always at the end of the onramp
 
	var uBeginRamp=onramp.roadLen-mergeLen; 
	var uBeginMain=onramp.getNearestUof(mainroad,uBeginRamp); 
	var uBegin=(draggedRoad==mainroad) ? uBeginMain : uBeginRamp;
	console.log(
	    "canvas.dragRoad: draggedRoad=",
	    ((draggedRoad==mainroad) ? "mainroad" : "onramp"),
	    "\n  uBeginRamp=",uBeginRamp," rampLen=",onramp.roadLen,
	    "\n   uBeginMain=",uBeginMain," mainLen=",mainroad.roadLen,
	    "\n   uBegin=",uBegin);

        // draggedRoad.doCRG(xUser,yUser,otherRoad,uBegin,commonLen)

	draggedRoad.doCRG(xUser,yUser,otherRoad,uBegin,mergeLen);
    }

    else if(scenarioString=="OffRamp"){ // divergeLen constant

	var otherRoad=(draggedRoad==mainroad) ? offramp : mainroad;

	var uBeginRamp=0; // begin diverge=>ramp.u=0
	var uBeginMain=offramp.getNearestUof(mainroad,divergeLen)-divergeLen; 
	var uBegin=(draggedRoad==mainroad) ? uBeginMain : uBeginRamp;
	console.log(
	    "canvas.dragRoad: draggedRoad=",
	    ((draggedRoad==mainroad) ? "mainroad" : "offramp"),
	    "\n   uBeginRamp=",uBeginRamp," rampLen=",offramp.roadLen,
	    "\n   uBeginMain=",uBeginMain," mainLen=",mainroad.roadLen,
	    "\n   uBegin=",uBegin);

        // draggedRoad.doCRG(xUser,yUser,otherRoad,uBegin,commonLen)

	draggedRoad.doCRG(xUser,yUser,otherRoad,uBegin,divergeLen);


    }

    else if(scenarioString=="Deviation"){

	var otherRoad=(draggedRoad==mainroad) ? deviation : mainroad;

	var uBeginDivergeRamp=0; // begin diverge=>ramp.u=0
	var uBeginDivergeMain
	    =deviation.getNearestUof(mainroad,lrampDev)-lrampDev;
	var uBeginDiverge=(draggedRoad==mainroad)
	    ? uBeginDivergeMain : uBeginDivergeRamp;

	var uBeginMergeRamp=deviation.roadLen-lrampDev;
	var uBeginMergeMain
	    =deviation.getNearestUof(mainroad,deviation.roadLen-lrampDev);
	var uBeginMerge=(draggedRoad==mainroad)
	    ? uBeginMergeMain : uBeginMergeRamp;

	var iPivot=draggedRoad.iPivot;
	var uDragged=draggedRoad.roadLen*iPivot/draggedRoad.nSegm;
	var uOther=draggedRoad.getNearestUof(otherRoad,uDragged);
	var isNearDiverge=(uDragged<0.5*draggedRoad.roadLen);

	if(false){
	console.log(
	    "canvas.dragRoad: draggedRoad=",
	    ((draggedRoad==mainroad) ? "mainroad" : "deviation"),
	    "\n   uBeginDivergeRamp=",uBeginDivergeRamp,
	    " rampLen=",deviation.roadLen,
	    "\n   uBeginDivergeMain=",uBeginDivergeMain,
	    " mainLen=",mainroad.roadLen,
	    "\n   uBeginDiverge=",uBeginDiverge,
	    "\n   uBeginMergeRamp=",uBeginMergeRamp,
	    " rampLen=",deviation.roadLen,
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


function bringVehBackToDepot(){
    //console.log("in bringVehBackToDepot");
}

function cancelLastRoadAction(){
    //console.log("in cancelLastRoadAction");
}


//#####################################################
// canvas onclick callback
//#####################################################

function slowDownClickedVeh(event){

    // mouse position in client window pixel and physical coordinates

    var rect = canvas.getBoundingClientRect();
    xPixLeft=rect.left;
    yPixTop=rect.top;
    xPixMouse = event.clientX-xPixLeft; 
    yPixMouse = event.clientY-yPixTop; 
    xUser=xPixMouse/scale;   //scale from main js onramp.js etc
    yUser=-yPixMouse/scale;   //scale from main js onramp.js etc


    if(distDrag<distminDrag){
	slowDownVehNearestTo(xUser,yUser);
    }
}


//#####################################################
// helper function for onclick and touched(?) events
//#####################################################

function slowDownVehNearestTo(xUser,yUser){

    var speedReduce=10;

    // find nearest vehicle of the nearest road of the simulation

    var isNetworkScenario=((scenarioString=="OnRamp")
			   ||(scenarioString=="OffRamp")||
			   (scenarioString=="Deviation"));

    // all scenarios have a mainroad

    var findResults1=mainroad.findNearestVehTo(xUser,yUser);
    var success1=findResults1[0];

    // default for road2 (not defined)

    var findResults2;
    var success2=false;

    if(isNetworkScenario){
        var road2=(scenarioString=="OnRamp") ? onramp
 	    :(scenarioString=="OffRamp") ? offramp
	    : deviation;
	findResults2=road2.findNearestVehTo(xUser,yUser);
	success2=findResults2[0];
    }

    if((!success1)&&(!success2)){
	console.log("slowDownClickedVeh: no suitable vehicle found!");
	return;
    }

    // findResults=[successFlag, pickedVeh, minDist]

    var vehPerturbed=(!success1) ? findResults2[1]
	: (!success2) ? findResults1[1]
	: (findResults1[2]<findResults2[2]) ? findResults1[1] 
	: findResults2[1];

    vehPerturbed.id=10;  // to distinguish it by color
    vehPerturbed.speed=Math.max(0.,vehPerturbed.speed-speedReduce);
}



//#####################################################
// canvas onmousedown callback
//#####################################################

function pickRoadOrVehicle(event){
    //console.log("onmousedown: in pickRoadOrVehicle");

    mousedown=true;
    var rect = canvas.getBoundingClientRect();
    xPixLeft=rect.left;
    yPixTop=rect.top;
    xPixMouse = event.clientX-xPixLeft; 
    yPixMouse = event.clientY-yPixTop; 
    xUserDown=xPixMouse/scale;   //scale from main js onramp.js etc
    yUserDown=-yPixMouse/scale;   //scale from main js onramp.js etc

    // test whether a road is picked for dragging
    // road.testCRG returns [success, dist_min, dist_x, dist_y]

    // for all scenarios mainroad is defined
    // for "OnRamp", "OffRamp", "Deviation" alse second road may be draggedRoad=
    // otherwise, no second road and default testSecond reflects this

    var testMain=mainroad.testCRG(xUser, yUser); 
    var testSecond=[false,1e6,1e6,1e6];

    if(scenarioString=="OnRamp"){
	testSecond=onramp.testCRG(xUser, yUser);
    }
    if(scenarioString=="OffRamp"){
	testSecond=offramp.testCRG(xUser, yUser);
    }
    if(scenarioString=="Deviation"){
	testSecond=deviation.testCRG(xUser, yUser);
    }
    var success=(testMain[0] || testSecond[0]); 
    if(success){
	vehDragging=false;
	roadDragging=true;
	draggedRoad=(testMain[1]<testSecond[1]) ? mainroad 
	    : (scenarioString=="OnRamp") ? onramp 
	    : (scenarioString=="OffRamp") ? offramp 
	    : deviation;
    }

    // otherwise, test whether a vehicle (obstacle) is picked from the depot

    else{ 
	roadDragging=false;
	var pickResults=depot.pickVehicle(xUser, yUser, 10);
	if(pickResults[0]){
	    draggedVehicle=pickResults[1];
	    vehDragging=true;
	    console.log("picked depot vehicle ",draggedVehicle);
	}
    }
    console.log("end pick: mousedown=",mousedown);

// independently from roadDragging or vehDragging state do 
// not zoom back if mouse is pressed 
}




//#####################################################
// canvas onmouseup callback
//#####################################################

function finishDistortOrDropVehicle(){
    //console.log("onmouseup: in finishDistortOrDropVehicle:",
//		" roadDragging=",roadDragging,
//		" vehDragging=",vehDragging);
    mousedown=false;
 
    if(roadDragging&&(distDrag>distminDrag)){
        userCanvasManip=true; // if true, new backgr, new road drawn
	roadDragging=false;
	//console.log(" before draggedRoad.finishCRG()");
	draggedRoad.finishCRG();

	handleDependencies();
    }
    if(vehDragging){
        userCanvasManip=true; // if true, new backgr, new road drawn
	vehDragging=false;
        // [dist,uReturn,vLanes]
	var dropResults=mainroad.findNearestDistanceTo(xUser, yUser);

        // unsuccessful drop: initiate zoom back to depot
        // depotVehZoomBack is true if further zooms are needed
        // (called also in main.update)

	if(dropResults[0]>10){ 
	    console.log("canvas_gui.onmouseup: drop failed; initiated zoom back!!! ");
	    depotVehZoomBack=depot.zoomBackVehicle();
	}

       // successful drop: integrate draggedVehicle to the road vehicles
	else{
	    depotVehZoomBack=false;
	    console.log("implement dropping of depot vehicle");
	}
    }
}

// the dragging changes road lengths and ramp merging positions
// => the "network" scenarios "OnRamp", "OffRamp", and "Deviation"
// need corresponding network corrections

function handleDependencies(){
    console.log("handleDependencies: scenarioString=",scenarioString);

    if(scenarioString=="OnRamp"){

        // update end-ramp obstacle and ramp->main offset

	onramp.veh[0].u=onramp.roadLen-0.6*taperLen; // shift end-obstacle

        // search mainroad u-point nearest to merging point of onramp

	var uMainNearest=onramp.getNearestUof(mainroad, 
					      onramp.roadLen-mergeLen);
	mainRampOffset=uMainNearest-(onramp.roadLen-mergeLen);

    }

    else if(scenarioString=="OffRamp"){

        // search mainroad u-point nearest to diverging point of onramp
        // and update offrampInfo

	var uMainNearest=offramp.getNearestUof(mainroad,divergeLen);
	mainOffOffset=uMainNearest-divergeLen;
	offrampLastExits=[mainOffOffset+divergeLen];
	mainroad.setOfframpInfo(offrampIDs,offrampLastExits,offrampToRight);

    }

    else if(scenarioString=="Deviation"){
	console.log("before canvas_gui.handleDependencies for \"Deviation\"",
		    "\n   umainMerge=",umainMerge,
		    "\n   umainDiverge=",umainDiverge
		   );

       // update (i)  the two offsets, (ii) offrampinfo (see routing.js), 
       // (iii) end-deviation obstacle at onramp 
       // described by umainDiverge,umainMerge

	umainDiverge=deviation.getNearestUof(mainroad,lrampDev)-lrampDev;
	umainMerge=deviation.getNearestUof(mainroad,
					   deviation.roadLen-lrampDev);
	offrampLastExits=[umainDiverge+lrampDev];
	mainroad.setOfframpInfo(offrampIDs,offrampLastExits,offrampToRight);

	deviation.veh[0].u=deviation.roadLen-0.6*taperLen;

	console.log("after canvas_gui.handleDependencies for \"Deviation\"",
		    "\n   umainMerge=",umainMerge,
		    "\n   umainDiverge=",umainDiverge
		   );
    }

}



//#####################################################
// canvas onmouseout callback
//#####################################################

function cancelActivities(event){
    //console.log("in cancelActivities");
    mousedown=false;
    if(vehDragging){
	vehDragging=false;
	bringVehBackToDepot();
    }
    if(roadDragging){
	roadDragging=false;
	cancelLastRoadAction();
    }
}



