
//###############################################################
// canvas onmousemove callback
//###############################################################
/*
          onmousemove="getCoordinatesDoDragging(event)"
          onmouseout="cancelActivities(event)"
          onclick="canvasClickCallback(event)"
          onmousedown="pickRoadOrVehicle()" 
          onmouseup="finishDistortionOrDropVehicle()"
*/

var xPixLeft, yPixTop;
var xPixMouse, yPixMouse;
var xMouse, yMouse;
var mousedown=false; // true if onmousedown event fired, but not yet onmouseup
var vehDragging=false; // true if mousedown and a depot vehicle is nearest
var roadDragging=false; // true if mousedown and a road is nearest

var draggedVehicle;
var draggedRoad; 


//#####################################################
// canvas onmousemove callback
//#####################################################

function getCoordinatesDoDragging(event){

    //console.log("onmousemove: in getCoordinatesDoDragging: mousedown=",mousedown);

    // mouse position in client window pixel coordinates

    var rect = canvas.getBoundingClientRect();
    xPixLeft=rect.left;
    yPixTop=rect.top;
    xPixMouse = event.clientX-xPixLeft; 
    yPixMouse = event.clientY-yPixTop; 
    xMouse=xPixMouse/scale;   //scale from main js onramp.js etc
    yMouse=-yPixMouse/scale;   //scale from main js onramp.js etc

    //showPhysicalCoords(xMouse,yMouse);

   // do actions
   // booleans mousedown, vehDragging, roadDragging 
   // controlled by onmousedown and onmouseup or corr touch events

    if(mousedown){ // boolean mousedown, vehDragging, roadDragging  and 
	if(vehDragging){
	    dragVehicle(xMouse,yMouse);
	}
	if(roadDragging){
	    dragRoad(xMouse,yMouse);
	}
    }
}

function showPhysicalCoords(xMouse,yMouse){
    //console.log("in showPhysicalCoords: xMouse=",xMouse," yMouse=",yMouse);
    //console.log("in showPhysicalCoords");
}

function dragVehicle(xMouse,yMouse){
    //console.log("in dragVehicle: xMouse=",xMouse," yMouse=",yMouse);
    //console.log("in dragVehicle");
}

function dragRoad(xMouse,yMouse){
    console.log("in canvas_gui: dragRoad, scenarioString=",scenarioString);

    changedRoadGeometry=true; // if true, new backgr, new road drawn

    // "one-road" scenarios

    if((scenarioString=="Ring") || (scenarioString=="RoadWorks")
       || (scenarioString=="Uphill")){ 
	draggedRoad.doCRG(xMouse,yMouse);
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

	draggedRoad.doCRG(xMouse,yMouse,otherRoad,uBegin,mergeLen);
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

	draggedRoad.doCRG(xMouse,yMouse,otherRoad,uBegin,divergeLen);


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
	    draggedRoad.doCRG(xMouse,yMouse,otherRoad,uBeginDiverge,lrampDev);
	}
	else{
	    draggedRoad.doCRG(xMouse,yMouse,otherRoad,uBeginMerge,lrampDev);
	}

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

function bringVehBackToDepot(){
    //console.log("in bringVehBackToDepot");
}

function cancelLastRoadAction(){
    //console.log("in cancelLastRoadAction");
}


//#####################################################
// canvas onclick callback
//#####################################################

function canvasClickCallback(event){
    //console.log("in canvasClickCallback");
}


//#####################################################
// canvas onmousedown callback
//#####################################################

function pickRoadOrVehicle(event){
    //console.log("onmousedown: in pickRoadOrVehicle");

    mousedown=true;

    // test whether a road is picked for dragging
    // road.testCRG returns [success, dist_min, dist_x, dist_y]

    // for all scenarios mainroad is defined
    // for "OnRamp", "OffRamp", "Deviation" alse second road may be draggedRoad=
    // otherwise, no second road and default testSecond reflects this

    var testMain=mainroad.testCRG(xMouse, yMouse); 
    var testSecond=[false,1e6,1e6,1e6];

    if(scenarioString=="OnRamp"){
	testSecond=onramp.testCRG(xMouse, yMouse);
    }
    if(scenarioString=="OffRamp"){
	testSecond=offramp.testCRG(xMouse, yMouse);
    }
    if(scenarioString=="Deviation"){
	testSecond=deviation.testCRG(xMouse, yMouse);
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
	console.log("implement picking a depot obstacle");
    }
    console.log("end pick: mousedown=",mousedown);
}

//#####################################################
// canvas onmouseup callback
//#####################################################

function finishDistortOrDropVehicle(){
    //console.log("onmouseup: in finishDistortOrDropVehicle:",
//		" roadDragging=",roadDragging,
//		" vehDragging=",vehDragging);
    mousedown=false;
 
    if(roadDragging){
        changedRoadGeometry=true; // if true, new backgr, new road drawn
	roadDragging=false;
	//console.log(" before draggedRoad.finishCRG()");
	draggedRoad.finishCRG();

	handleDependencies();
    }
    if(vehDragging){
	vehDragging=false;
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