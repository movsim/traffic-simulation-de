
//###############################################################
// mouse and touch event callbacks
//###############################################################
/*
          onmouseenter="defineSecondaryRoad(event)"
          onmousemove="getCoordinatesDoDragging(event)"
          onmouseout="cancelActivities(event)"
          onclick="canvasClickCallback(event)"
          onmousedown="pickRoadOrVehicle()" 
          onmouseup="finishDistortionOrDropVehicle()"
*/


// special vehicles:
// types: 0="car", 1="truck", 2="obstacle" (including red traffic lights)
// id's defined mainly in vehicle.js and vehicleDepot.js
// id<100:              special vehicles/road objects
// id=1:                ego vehicle
// id=10,11, ..49       disturbed vehicles 
// id=50..99            depot vehicles/obstacles
// id=100..199          traffic lights
// id>=200:             normal vehicles and obstacles
// they are specially drawn and externally influenced from the main program


var xPixLeft, yPixTop;
var xPixMouse, yPixMouse;
var xUser, yUser;
var xUserDown, yUserDown; // physical coordinates at (first) mousedown event
var mousedown=false; //true if onmousedown event fired, but not yet onmouseup

var depotObjDragged=false; //true if a depot object is <distmin at mousedown
var roadVehSelected=false; // NOW NOT USED true if none of the above and 
                           // nearest normal vehicle has distDrag<crit " " 
var roadDragged=false; // true if none of the above and distRoad<crit   " "


var depotVehZoomBack=false; // =true after unsuccessful drop

var depotObject;    // element depot.veh[i]; among others phys. Pos x,y
var specialRoadObject; // element road.veh[i]: obstacles, TL, user-driven vehs
var distDragCrit=0.8;  // drag function if dragged more [m]; otherwise click
var distDrag=0; // physical distance[m] of the dragging


// secondaryRoad='undefined' in ring,roadworks,uphill scenarios,
// =oramp/offramp/deviation in the three "network" scenarios

var isNetworkScenario; // scenarios with two or more roads
var draggedRoad;       // defined in onmousedown callback
var secondaryRoad;     // defined in onmouseenter callback
                       // (mainroad always exists in main js under this name)


//#####################################################
// canvas onmouseenter callback
//#####################################################

function defineSecondaryRoad(event){
    isNetworkScenario=true;
    if(scenarioString=="OnRamp"){secondaryRoad=onramp;}
    else if(scenarioString=="OffRamp"){secondaryRoad=offramp;}
    else if(scenarioString=="Deviation"){secondaryRoad=deviation;}
    else {
	isNetworkScenario=false;
	secondaryRoad='undefined';
    }
    console.log("onmouseenter: isNetworkScenario=",isNetworkScenario,
		" secondaryRoad=",secondaryRoad);
}


//#####################################################
// canvas onmousedown callback
//#####################################################

/* priorities (at most one action initiated at a given time):

(1) pick/drag a special road vehicle. If success=>depotObject=>(2)
(2) pick/drag depot vehicle: depotObjDragged=true
(3) drag on road less than crit and then mouse up: roadVehSelected=true
(4) drag on road more than crit: roadDragged=true

*/

//!!! change order to match priorities! introduce roadVehSelected!!

function pickRoadOrVehicle(event){
    console.log("\nonmousedown: entering pickRoadOrVehicle");
    console.log(" depotObjDragged=",depotObjDragged,
		" roadVehSelected=",roadVehSelected,
		" roadDragged=",roadDragged);

    mousedown=true;
    xUserDown=xUser;
    yUserDown=yUser;


    // (1) pick/drag special road object
    // road.pickSpecialVehicle returns [success, thePickedRoadVeh, dist]
    // !!!TODO: do it also on secondary road in network scenarios! =>(4)
    // !!!TODO: convert the road object to a depot vehicle

    console.log("  (2) test for special road object");
    pickResults=mainroad.pickSpecialVehicle(xUser,yUser); // distCrit by road
    if(pickResults[0]){
	console.log("  (2) picked a special road object");
	specialRoadObject=pickResults[1];
	transformToDepotObject(specialRoadObject,mainroad,depot);

	depotObjDragged=true;
	//specRoadObjDragged=true;
	roadVehSelected=false;
	roadDragged=false;
	return;
    }


    // (2) pick/drag depot vehicle: test for depotObjDragged
    // depot.pickVehicle returns [successFlag, thePickedDepotVeh]
 
    console.log("  (1) test for depot vehicle");
    var distCrit=10;
    var pickResults=depot.pickVehicle(xUser, yUser, distCrit);
    if(pickResults[0]){
	console.log("  (1) picked a depot vehicle");
	depotObject=pickResults[1];
	depotObjDragged=true;
	roadVehSelected=false;
	roadDragged=false;
	return;
    }


    // (3) pick normal road vehicle to slowing it down: 
    // handled onclick (=onmouseup) by this.influenceVehNearestTo(event)
    // only if distDrag<distDragCrit at this time

    console.log("  (3) pick normal road vehicle later at onclick",
		" if distDrag<distDragCrit");


    // (4) pick a road section to change road geometry (CRG) by dragging it
    // road.testCRG returns [success,Deltax,Deltay]
    // handled in onmousemove+onmousedown and onmouseup events only if 
    // distDrag>distDragCrit at this time

    console.log("  (4) test for a road section nearby");

    var pickResults1=mainroad.testCRG(xUser, yUser); // distCrit def by road
    var pickResults2=[false,1e6,1e6,1e6];
    if(isNetworkScenario){
	pickResults2=secondaryRoad.testCRG(xUser, yUser);
    }
    var success=(pickResults1[0] || pickResults2[0]); 
    if(success){
        console.log("  (4) picked a road section for dragging",
		    " as soon as distDrag>distDragCrit");

	draggedRoad=(pickResults1[1]<pickResults2[1])
	    ? mainroad : secondaryRoad;
	depotObjDragged=false;
	roadVehSelected=false;
	roadDragged=true;
    }

} // canvas onmousedown: pickRoadOrVehicle



//#####################################################
// canvas onmousemove callback
//#####################################################

function getCoordinatesDoDragging(event){


    // always update user client-pixel and physical coordinates

    var rect = canvas.getBoundingClientRect();
    xPixLeft=rect.left;
    yPixTop=rect.top;
    xPixMouse = event.clientX-xPixLeft; 
    yPixMouse = event.clientY-yPixTop; 
    xUser=xPixMouse/scale;   //scale from main js onramp.js etc
    yUser=-yPixMouse/scale;   //scale from main js onramp.js etc

    if(false){
	console.log("mousemove: xUser=",xUser," yUser=",yUser,
		    " mousedown=",mousedown);
    }


    // do drag actions if onmousemove&&mousedown
    // which action(s) (depotObjDragged,roadDragged) 
    // is determined by onmousedown callback

    if(mousedown){ // boolean mousedown, depotObjDragged, roadDragged
        userCanvasManip=true; // if true, new backgr, new road drawn

	distDrag=Math.sqrt(Math.pow(xUser-xUserDown,2)
			   + Math.pow(yUser-yUserDown,2));

	if(false){
	    console.log("mousemove && mousedown: roadDragged=",roadDragged,
		    " depotObjDragged=",depotObjDragged,
		    " xUser=",xUser,"xUserDown=",xUserDown,
		    " distDrag=",distDrag,
		    " distDragCrit=",distDragCrit);
	}

	if(distDrag>distDragCrit){ // do no dragging actions if only click
	    if(depotObjDragged){
	        dragVehicle(xUser,yUser);
	    }
	    if(roadDragged){
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

function finishDistortOrDropVehicle(){
    console.log("onmouseup: in finishDistortOrDropVehicle:",
    		" roadDragged=",roadDragged,
    		" depotObjDragged=",depotObjDragged);

    mousedown=false;
 
    if(roadDragged&&(distDrag>distDragCrit)){
        userCanvasManip=true; // if true, new backgr, new road drawn
	roadDragged=false;
	//console.log(" before draggedRoad.finishCRG()");
	draggedRoad.finishCRG();

	handleDependencies();
    }


    if(depotObjDragged){
	console.log("in canvas_gui.onmouseup: drop vehicle: WARNING: only mainroad handled until now!");

        userCanvasManip=true; // if true, new backgr, new road drawn
	depotObjDragged=false;

        // [dist,uReturn,vLanes]
	var dropInfo=mainroad.findNearestDistanceTo(xUser, yUser);
	console.log("in canvas_gui.onmouseup: dropInfo=",dropInfo);

        // unsuccessful drop: initiate zoom back to depot
        // depotVehZoomBack is true if further zooms are needed
        // (called also in main.update)

	var distCrit=0.6*(mainroad.nLanes * mainroad.laneWidth);

	if(dropInfo[0]>distCrit){ 
	    console.log(" drop failed! dist=",dropInfo[0],
			" distCrit=",distCrit," initiate zoom back... ");
	    depotVehZoomBack=depot.zoomBackVehicle();
	}

       // successful drop: integrate depotObject to the road vehicles
	else{
	    depotVehZoomBack=false;
	    depotObject.inDepot=false;
	    console.log("in dropping of depot vehicle");
	    mainroad.dropDepotVehicle(depotObject, dropInfo[1], 
				      dropInfo[2],
				      traffLightRedImg,traffLightGreenImg);
	}
    }
}



//#####################################################
// canvas onclick callback
//#####################################################

function influenceClickedVeh(event){
    console.log("onclick: in influenceClickedVeh");

    // only do click action (=onmouseup after onmousedown) if 
    // only insignificant drag; otherwise, do drag action instead
    // distDrag,xUser,yUser already from onmousedown,-move,-up ops known

    if(distDrag<distDragCrit){ 
	slowdownChangeTLNearestTo(xUser,yUser);
//!!! Separate slow down and change TL (TL: road search, slDown: veh search)
    }

    distDrag=0; // reset drag distance recorder
}



//#####################################################
// canvas onmouseout callback
//#####################################################

function cancelActivities(event){
    //console.log("in cancelActivities");
    mousedown=false;
    depotObjDragged=false;
    roadVehSelected=false;
    roadDragged=false;
    depotVehZoomBack=true;
}








//#####################################################
// helper functions
//#####################################################




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
// helper function for transforming a selected special road vehicle/object
//#####################################################

/* eliminates this vehicle from the road, 
and reverts "inDepot property of corresp depot vehicle 
*/
function transformToDepotObject(specialRoadObject,road,depot){

   // search for this vehicle in depot 
   // and integrate it by setting .inDepot=true

    var success=false;
    for(var i=0; (!success)&&(i<depot.veh.length); i++){
	success=(specialRoadObject.id==depot.veh[i].id);
	if(success){
	    console.log("canvas.transformToDepotObject: found fitting depot vehicle!");
	    depot.veh[i].inDepot=true;
	}
    }
    if(!success){
	console.log("canvas.transformToDepotObject: no depot veh found!");
    }


    // eliminate vehicle-object from road

    success=false;
    for(var i=0; (!success)&&(i<road.veh.length); i++){
	success=(specialRoadObject.id==road.veh[i].id);
	if(success){
	    road.veh.splice(i,1);
	}
    }

    if(!success){
	console.log("canvas.transformToDepotObject: no road veh found!");
    }
}


//##############################################################
// helper function for drag (onmousemove if onmousedown) events
//##############################################################

function dragVehicle(xUser,yUser){
    //console.log("in dragVehicle: xUser=",xUser," yUser=",yUser);
    depotObject.x=xUser;
    depotObject.y=yUser;
}

function dragRoad(xUser,yUser){
    console.log("in canvas_gui: dragRoad, scenarioString=",scenarioString);

    userCanvasManip=true; // if true, new backgr, new road drawn

    // "one-road" scenarios

    if(!isNetworkScenario){ 
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



//#####################################################
// helper function for onclick and touched(?) events
//#####################################################

function slowdownChangeTLNearestTo(xUser,yUser){

    var speedReduce=10;

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
	console.log("influenceVehNearestTo: no suitable vehicle found!");
	return;
    }

    // findResults=[successFlag, pickedVeh, minDist]

    var vehPerturbed=(!success1) ? findResults2[1]
	: (!success2) ? findResults1[1]
	: (findResults1[2]<findResults2[2]) ? findResults1[1] 
	: findResults2[1];
    var id=vehPerturbed.id;

    // if target object is traffic light, change its state

    var isTrafficLight=(id>=100)&&(id<200);
    if(isTrafficLight){
	var targetRoad=(findResults1[2]<findResults2[2])
	    ? mainroad : secondaryRoad;
	targetRoad.changeLights(id);
    }

    // otherwise, slow down target (no effect if obstacle)

    else{
	vehPerturbed.id=10;  // to distinguish it by color
	vehPerturbed.speed=Math.max(0.,vehPerturbed.speed-speedReduce);
    }
}



function showPhysicalCoords(xUser,yUser){
    //console.log("in showPhysicalCoords: xUser=",xUser," yUser=",yUser);
    //console.log("in showPhysicalCoords");
}



