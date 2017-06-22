
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
    //console.log("in dragRoad");

    changedRoadGeometry=true; // if true, new backgr, new road drawn

    if(scenarioString=="Ring"){
	draggedRoad.doCRG(xMouse,yMouse);
    }


    else if(scenarioString=="OnRamp"){

        // uMergeRamp always fixed since mergeLen fixed 
        // and merge always at the end of the onramp
 
	var uMergeRamp=onramp.roadLen-mergeLen; 
	var uMergeMain=onramp.getNearestUof(mainroad,uMergeRamp); 
	var otherRoad=(draggedRoad==mainroad) ? onramp : mainroad;
	var uMerge=(draggedRoad==mainroad) ? uMergeMain : uMergeRamp;
	console.log("canvas.dragRoad: draggedRoad=",
		    ((draggedRoad==mainroad) ? "mainroad" : "onramp"),
		    " uMergeRamp=",uMergeRamp,
		    " uMergeMain=",uMergeMain,
		    " uMerge=",uMerge);

	//draggedRoad.doCRG(xMouse,yMouse);
	draggedRoad.doCRG(xMouse,yMouse,otherRoad,uMerge,mergeLen);
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


    var testMain=mainroad.testCRG(xMouse, yMouse);
    var testSecond=[false,1e6,1e6,1e6];// testSecond[0] => not selected (eg ring)
    if(scenarioString=="OnRamp"){
	testSecond=onramp.testCRG(xMouse, yMouse);
    }
    if(scenarioString=="OffRamp"){
	testSecond=offramp.testCRG(xMouse, yMouse);
    }
    if(scenarioString=="Routing"){
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

function handleDependencies(){
    if(scenarioString=="OnRamp"){

        // update end-ramp obstacle and ramp->main offset

        console.log("handleDependencies: scenarioString=",scenarioString);
	onramp.veh[0].u=onramp.roadLen-0.6*taperLen; // shift end-obstacle

        // search mainroad u-point nearest to end of onramp

	var uMainNearest=onramp.getNearestUof(mainroad, 0.9*onramp.roadLen);
	mainRampOffset=uMainNearest-0.9*onramp.roadLen;
	//mainRampOffset=mainroad.roadLen-straightLen+mergeLen-onramp.roadLen;

        //!!! need to handle dependencies when changed road AFTER onramp

    }
}