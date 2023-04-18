
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

var roadPicked=false; 
var trafficObjPicked=false; 
var trafficObjZoomBack=false; // =true after unsuccessful drop

var specialRoadObject; // element road.veh[i]: obstacles, TL, user-driven vehs
var distDragCrit=10;   // drag function if dragged more [m]; otherwise click
var distDrag=0;        // physical distance[m] of the dragging
var idPerturbed=10;    // id=10 is that of first perturbed veh; then incr

var draggedRoad;       // defined in onmousedown callback

var network=[];  // to be defined in the toplevel files, e.g. [mainroad,ramp]

//#####################################################
// register touch listeners (does not seem to work directly in html
// as for the mouse listeners), called in the main.js files after defining canvas
//#####################################################

function addTouchListeners() {
    //console.log("in gui.addTouchListeners()");
    canvas.addEventListener("touchstart", handleTouchStart, false);
    canvas.addEventListener("touchmove", handleTouchMove, false);
    canvas.addEventListener("touchend", handleTouchEnd, false);
    canvas.addEventListener("touchcancel", cancelActivities, false);
    //console.log("addTouchListeners(): initialized some touch listeners");
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
//touchcancel => cancelActivities(event) at the end of mouse section
// (at moment, do nothing)
//#####################################################






//#####################################################
// canvas onmouseenter callback
//#####################################################

var mouseInside=false;

function handleMouseEnter(event){
  mouseInside=true;
  //console.log("itime=",itime," in handleMouseEnter: scenarioString=",
//	      scenarioString," nothing to do");
}

//#####################################################
// canvas onmousemove callback
//#####################################################

// [xy]UserDown from touchinit/mousedown

function handleMouseMove(event){
  //console.log("in handleMouseMove(evt): mousedown=",mousedown);
  getMouseCoordinates(event); //=> xUser,yUser;
  doDragging(xUser,yUser,xUserDown,yUserDown);
  drawSim(); // to be able to move objects during stopped simulation
}



//#####################################################
// canvas onmousedown callback
//#####################################################

function handleMouseDown(event){
    mousedown=true;
    getMouseCoordinates(event); //=> xUser, yUser, xPixUser, yPixUser
    xUserDown=xUser; // memorize starting point of mouse drag
    yUserDown=yUser;
    pickRoadOrObject(xUser,yUser);
}

function handleMouseDown_golfCourse(event){
  ; //nothing; but needed since click does not work, otherwise}
}

// get physical and pixel coordinates for all mouse events
// for touch events: getTouchCoordinates(event)


function getMouseCoordinates(event){// called if mouse moved or down

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

// get roadID and logical u,v coordinates of nearest road
// at the mouse pointer if showCoord is true

function showLogicalCoords(xPixUser,yPixUser){

  var distanceMin=1e9;
  var irMin=-1;
  var uvMin=[1000,1000];
  for(var ir=0; ir<network.length; ir++){

    //returns [dist,uReturn,vLanes]
    var findResults=network[ir].findNearestDistanceTo(xUser,yUser);
    if (findResults[0]<distanceMin){
      distanceMin=findResults[0];
      uLaneMin=[findResults[1],findResults[2]];
      irMin=ir;
    }
  }

  var roadID=network[irMin].roadID;
  var u=uLaneMin[0];
  var lane=uLaneMin[1];

  var coordsStr="Road "+roadID+": u="+u.toFixed(1)+", lane="+lane.toFixed(0);
  //console.log("coordsStr=",coordsStr);
  var textsize=0.02*Math.min(canvas.width,canvas.height); // 2vw;
  var coordsStr_width=12*textsize;
  var coordsStr_height=1.2*textsize;
  var coordsStr_xlb=0.88*canvas.width-0.5*coordsStr_width;
  var coordsStr_ylb=0.90*canvas.height;

  ctx.setTransform(1,0,0,1,0,0);
  ctx.font=textsize+'px Arial';
  ctx.fillStyle="rgb(255,255,255)";
  ctx.fillRect(coordsStr_xlb,coordsStr_ylb-coordsStr_height,
		 coordsStr_width,coordsStr_height);
  ctx.fillStyle="rgb(0,0,0)";
  ctx.fillText(coordsStr, coordsStr_xlb+0.2*textsize, 
		 coordsStr_ylb-0.2*textsize);

} //showLogicalCoords


// activate display in simulator "log coords u= ..., v= ..."

function activateCoordDisplay(event){
  getMouseCoordinates(event); // => xPixUser, xPixUser, xUser, yUser
  showMouseCoords=true; // => road.showLogicalCoords
}


// called in html file whenever onmouseout=true

function deactivateCoordDisplay(event){
  mouseInside=false;
}





// #########################################################
// do the action 1: pick
// network defined in the main sim files
// #########################################################

function pickRoadOrObject(xUser,yUser){


  //console.log("itime=",itime," in pickRoadOrObject(canvas_gui):");
  
  /* priorities (at most one action initiated at a given time):

    (1) pick/drag trafficObject on a road or to the depot. 

    later stages not here but at onmousemove or onmouseup (onclick) callbacks
    (3) drag on road less than crit and then mouse up => click: slow down road
    (4) drag on road more than crit: roadPicked=true

  */

  if(true){
    console.log("itime=",itime," in pickRoadOrObject: xUser=",
		formd0(xUser),
		" yUser=",formd0(yUser));
  }

  //==============================================================
  // (1) pick/select an active or passive trafficObject
  // trafficObjs.pickObject returns [successFlag, thePickedObj]
  //==============================================================

  if(!(typeof trafficObjs === 'undefined')){ // just check for scenarios w/o
    var distCrit_m=20; //[m] !! make it rather larger  
    var pickResults=trafficObjs.pickObject(xPixUser, yPixUser, 
				      distCrit_m*scale);
    console.log("  pickRoadOrObject (1): test for object to be picked: pickResults=",pickResults);
   if(pickResults[0]){
      trafficObject=pickResults[1];
      trafficObjPicked=true;
      roadPicked=false;
      if(false){
        console.log("  end pickRoadOrObject: success! picked trafficObject id=",
		    trafficObject.id," type ",
		    trafficObject.type,
		    " isActive=",trafficObject.isActive,
		    " inDepot=",trafficObject.inDepot," end");
      }
      return;
    }
    //else console.log("  pickRoadOrObject (1): no trafficObject found");
  }



} // canvas onmousedown or touchStart: pickRoadOrObject





// do drag actions if onmousemove&&mousedown or if touchdown=true
// which action(s) (drag road or trafficObject)
//is determined by onmousedown/touchStart  callback


function doDragging(xUser,yUser,xUserDown,yUserDown){

    if(mousedown||touchdown){ 
        userCanvasManip=true; // if true, new backgr, new road drawn

	distDrag=Math.sqrt(Math.pow(xUser-xUserDown,2)
			   + Math.pow(yUser-yUserDown,2));

	if(false){
	    console.log("mousemove && mousedown: roadPicked=",roadPicked,
		    " xUser=",xUser,"xUserDown=",xUserDown,
		    " distDrag=",distDrag,
		    " distDragCrit=",distDragCrit);
	}

	if(distDrag>distDragCrit){ // !! do no dragging actions if only click
	    if(trafficObjPicked){// dragged an object 
	      if(trafficObject.isActive){
		trafficObjs.deactivate(trafficObject); // detach obj from road
	      }

	      trafficObject.isDragged=true;
	      trafficObject.xPix=xPixUser;
	      trafficObject.yPix=yPixUser;
	    }

	}
    }


    // reset dragged distance to zero if mouse is up

    else{distDrag=0;} 
}



//#####################################################
// touchend event callback
// !! since no "touch click" also onclick callbacks!
//#####################################################


function handleTouchEnd(evt) {
  //console.log("in handleTouchEnd(evt)");
  evt.preventDefault();

  getTouchCoordinates(evt); // xUser, yUser

  // do the action (=> see mouse section) !! also add actions to mouse sect

  finishDistortOrDropObject(xUser, yUser); 
  influenceClickedVehOrTL(xUser,yUser);
  //!! do not allow change of speedlimits if touch device

  drawSim();

}
 

//#####################################################
// canvas onmouseup callback
// see also handleTouchEnd
//#####################################################


function handleMouseUp(evt) {
  if(false){console.log("\n\nitime=",itime," in handleMouseUp(evt):",
			" speedlBoxActive=",speedlBoxActive);}

  getMouseCoordinates(evt); // => xUser, yUser, xPixUser, yPixUser
  finishDistortOrDropObject(xUser, yUser); 

  drawSim();
  if(false){console.log("  end handleMouseUp(evt):",
			" speedlBoxActive=",speedlBoxActive);}

}


// #########################################################
// do the action 2: drop=finalize dragging action 
// Notice: klicking action influenceClickedVehOrTL(..) is separately below 
// while both called in handleTouchEnd(evt)
// #########################################################

function finishDistortOrDropObject(xUser, yUser){
  if(false){
    console.log("itime=",itime," in finishDistortOrDropObject (canvas_gui):",
    		" trafficObjPicked=",trafficObjPicked,
   		" roadPicked=",roadPicked,
  		"");
  }

  mousedown=false;
  touchdown=false;
  
  if(distDrag<distDragCrit){
    //console.log("  end finishDistortOrDropObject: dragging crit",
//		" distDrag =",distDrag,"< distDragCrit=",distDragCrit,
//		" not satisfied (only click) => do nothing)");
    return;
  }


  if(roadPicked){
    userCanvasManip=true; // if true, new backgr, new road drawn
    roadPicked=false;
    //console.log(" before draggedRoad.finishCRG()");
    draggedRoad.finishCRG();
    console.log("  end finishDistortOrDropObject: distorted road");
  }


  if(trafficObjPicked){

    var distCrit_m=20;  // optimize!!
    var distCritPix=distCrit_m*scale;
    trafficObjs.dropObject(trafficObject, network, 
			   xUser, yUser, distCritPix, );
    trafficObjPicked=false;
    console.log("  end finishDistortOrDropObject: dropped object!");
  }

  
} // handleMouseUp -> finishDistortOrDropObject



//#####################################################
// canvas onclick and part of touchEnd callback
// do at most one of the following actions
// (1) traffic light editor (not yet operative as of 2021-11)
// (2) change speed limits
// (3) switch traffic lights
// (4) slow down vehicles
// (2)-(4) only if isDragged=false (real click)
//#####################################################

function handleClick(event){
  getMouseCoordinates(event); //=> xPixUser, yPixUser, xUser, yUser;
  var isDragged=(distDrag>distDragCrit);

  if(true){
    console.log("\n\nitime=",itime," in handleClick: xPixUser=",
		formd0(xPixUser)," yPixUser=",formd0(yPixUser),
		" xUser=",formd(xUser),
		" yUser=",formd(yUser)," distDrag=",formd(distDrag));
    console.log(" isDragged=",isDragged,
		" speedlBoxActive=",speedlBoxActive);
  }


  //################################################
  // (1) MT 2020-07: editor panel (not yet functional)
  // overrides all other click actions
  //################################################

  if(!(typeof trafficLightControl === 'undefined')){
    if((trafficLightControl.isActive)
       && trafficLightControl.mouseIsInside(xPixUser, yPixUser)){
      console.log("handleClick: in trafficLightControl part");
      trafficLightControl.selectCycleTime([xPixUser, yPixUser]);

      return;
    }
  }


  // only if clicked w/o drag:
  // deal with either speedlimit changes, TL, or slow vehicles
  // (drop vehicles/drag them away etc only if isDragged)

  if(!isDragged){
    
    // (2) speedlimit changes if applicable
    
    var changingSpeedl=false; 

    // change speedlimit if speeldBoxActive
    
    if(speedlBoxActive){
      changingSpeedl=true;
      changeSpeedl(xPixUser,yPixUser); 
    }

    // check if click should activate speedlimit box for manip at next click 

    else{ 
      changingSpeedl=activateSpeedlBox(xPixUser,yPixUser);
    }

    // (3) if no speedlimit-changing related action, 
    // change TL if applicable or otherwise slow down vehicle if applicable
    
    if(!changingSpeedl){
      console.log("change TL or slow down vehicles");
      influenceClickedVehOrTL(xUser,yUser);
    }
  }

}//handleClick


//##################################################
// handleClick in golfCourse scenario
//##################################################

function handleClick_golfCourse(event){
  
  var distMax=0.10*refSizePhys; // 0.05*smaller side in meters
  
  getMouseCoordinates(event); //=> xPixUser, yPixUser, xUser, yUser;

  if(true){
    console.log("\n\nitime=",itime," in handleClick_golfCourse: xPixUser=",
		formd0(xPixUser)," yPixUser=",formd0(yPixUser),
		" xUser=",formd(xUser),
		" yUser=",formd(yUser));
  }

  // [success, vehReturn, distMin_m, ivehReturn]
  var findResults=mainroad.findNearestVehTo(xUser,yUser); 
  if(findResults[0]){
    if(findResults[2]<distMax){
      vehPerturbed=findResults[1];
      vehPerturbed.canOvertakeGolf=!(vehPerturbed.canOvertakeGolf); // toggle
      vehPerturbed.dt_overtakeGolf=0;
      console.log("golfer group id ",vehPerturbed.id,
		  ((vehPerturbed.canOvertakeGolf) ? "can" : "cannot"),
		  " overtake");
    }
  }
}


//##################################################
// onclick callback: change lights if a traffic light is nearby,
// otherwise slowdown veh if one is nearby
//##################################################

function influenceClickedVehOrTL(xUser,yUser){
  //console.log("\n\nitime=",itime," onclick: in influenceClickedVehOrTL");
  //console.log("yUser=",yUser," yPixUser=",yPixUser);
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



//##################################################
// onclick callback: open a select box for changing speedlimit vals
//##################################################

/** annoyingly, there is no ststematic way to do it programmatically
    using html5 select boxes, even less with variable locations of the box
    and dynamical popup => need to do it graphically by hand!
    (1) activateSpeedlBox: activates the select box event-oriented
    (2) changeSpeedl: selects box element, changes trafficObject,
    (if successful), and deactivates box afterwards (in any case)
    (3) drawSpeedlBox: draw it in the canvas if activated

  global vars: speedlBoxActive, speedlBoxAttr 
               (trafficObject is inside speedlBoxAttr)

*/

var speedlBoxActive=false;

var speedlBoxAttr={
  obj: "null",
  limits: [10,20,30,40,50,60,80,100,120,1000],
  sizePix: 42,
  xPixLeft: 42,
  yPixTop: 42,
  wPix: 42,
  hPix: 42,
  textsize: 42,
  hBoxPix: 42
}


// if applicable, sets speedlBoxActive=true; and updates speedlBoxAttr

function activateSpeedlBox(xPixUser,yPixUser){

  var sizePix=Math.min(canvas.width, canvas.height);


  speedlBoxActive=false;

  var relWidth=0.10;  // rel size and position of the graphical select box
  var relHeight=0.025*speedlBoxAttr.limits.length; // rel to the smaller dim
  var relDistx=0.10;  // center-center
  var relDisty=0.00;
  var relTextsize_vmin=(isSmartphone) ? 0.03 : 0.02;

  var results=trafficObjs.selectSignOrTL(xPixUser,yPixUser);
  var obj=results[1];
  console.log("\n\nitime=",itime," in activateSpeedlBox (canvas_gui)",
	      " results=",results," type=",obj.type);

  if(results[0]){
    if(obj.type==='speedLimit'){
      speedlBoxAttr.obj=obj;
      speedlBoxActive=true; // then, drawSpeedlSelectBox drawn

      speedlBoxAttr.sizePix=sizePix;
      speedlBoxAttr.xPixLeft=xPixUser+sizePix*(relDistx-0.5*relWidth);
      speedlBoxAttr.yPixTop=yPixUser+sizePix*(relDisty-0.5*relHeight);
      if(xPixUser>0.8*canvas.width){
	speedlBoxAttr.xPixLeft -=2*sizePix*relDistx;
      }
      if(yPixUser>0.8*canvas.height){
	speedlBoxAttr.yPixTop -=0.5*sizePix*relHeight;
      }
      if(yPixUser<0.2*canvas.height){
	speedlBoxAttr.yPixTop +=0.5*sizePix*relHeight;
      }
      speedlBoxAttr.wPix=sizePix*relWidth;
      speedlBoxAttr.hPix=sizePix*relHeight;
      speedlBoxAttr.hBoxPix=speedlBoxAttr.hPix/speedlBoxAttr.limits.length;

      var nLimit=speedlBoxAttr.limits.length;
      var hPix=speedlBoxAttr.hPix;
      var yPixTop=speedlBoxAttr.yPixTop;

      speedlBoxAttr.textsize=relTextsize_vmin*sizePix;
    }
  }
  var returnVal=results[0]&&(obj.type==='speedLimit');
  console.log("  end activateSpeedlBox: speedlBoxActive=",speedlBoxActive,
	      " returnVal=",returnVal);
  return returnVal;
}


function changeSpeedl(xPixUser,yPixUser){

  // free: >=130, image filename figs/speedLimit_00.svg

  console.log("\n\nitime=",itime," in changeSpeedl (canvas_gui):",
	      " speedlBoxActive=",speedlBoxActive);
  if(speedlBoxActive){
 
    if( (xPixUser>speedlBoxAttr.xPixLeft)
	&& (xPixUser<speedlBoxAttr.xPixLeft+speedlBoxAttr.wPix)
	&& (yPixUser>speedlBoxAttr.yPixTop)
	&& (yPixUser<speedlBoxAttr.yPixTop+speedlBoxAttr.hPix)){
     
      console.log("  speedlBoxActive and clicked inside box!");
 
      var obj=speedlBoxAttr.obj;
      var nLimit=speedlBoxAttr.limits.length;

      var iSelect=Math.floor(nLimit*(yPixUser-speedlBoxAttr.yPixTop)/
			     speedlBoxAttr.hPix);
      obj.value=speedlBoxAttr.limits[iSelect];
      var fileIndex=(0.1*obj.value<13)
	? Math.round(0.1*obj.value) : 0;
      obj.image.src = "figs/speedLimit_"+(fileIndex)+"0.svg";
      console.log("  traffic object of id=",obj.id,
		  " has new speed limit ",obj.value);
    }
  }
  speedlBoxActive=false; // apply only once
  hasChanged=true;  // to draw the green background the next timestep
  console.log("  end changeSpeedl: traffic object of id=",
	      speedlBoxAttr.obj.id,
	      " type=",speedlBoxAttr.obj.type,
	      " has new speed limit ",speedlBoxAttr.obj.value,
	      " using image file ",speedlBoxAttr.obj.image.src);
 // a=gieskanne;
}


function drawSpeedlBox(){
  if(speedlBoxActive){
    //console.log("itime=",itime," in drawSpeedlBox (canvas)");
    //console.log("yUser=",yUser," yPixUser=",yPixUser);

    var sizePix=speedlBoxAttr.sizePix;

    var xPixLeft=speedlBoxAttr.xPixLeft;
    var yPixTop=speedlBoxAttr.yPixTop;
    var wPix=speedlBoxAttr.wPix;
    var hPix=speedlBoxAttr.hPix;

    // (1) draw the white rectangular background box

    ctx.setTransform(1,0,0,1,0,0); 
    ctx.fillStyle="rgb(255,255,255)";
    ctx.fillRect(xPixLeft,yPixTop,wPix,hPix);

   // (2) draw the speedlimit options

    ctx.fillStyle="rgb(0,0,0)";
    ctx.font=speedlBoxAttr.textsize+'px Arial';
    var limits=speedlBoxAttr.limits;

    for(var i=0; i<limits.length; i++){
      var textStr=(limits[i]<200) ? limits[i]+" km/h" : "free";
      ctx.fillText(textStr,xPixLeft+0.01*sizePix,
  		   yPixTop+(i+0.7)*hPix/limits.length);
    }
  }
}




//#####################################################
// canvas onmouseout/ callback
//#####################################################

function cancelActivities(event){
    //console.log("in cancelActivities");
    mousedown=false;
    touchdown=false;
    roadPicked=false;
    trafficObjZoomBack=true;
}








//#####################################################
// helper functions
//#####################################################



//##############################################################
// helper function for drag (onmousemove if onmousedown) events
//##############################################################


function dragDepotObject(xPixUser,yPixUser){ 
  //console.log("in dragDepotObject: xPixUser=",xPixUser," yPixUser=",yPixUser);
  depotObject.xPix=xPixUser;
  depotObject.yPix=yPixUser;
}




//#####################################################
// helper function for onclick and touched(?) events
//#####################################################

function slowdownVehNearestTo(xUser,yUser,distCrit_m){

  var speedReduceFactor=0.5;
  var vehPerturbed;

  var distMin_m=1e6;
  var iRoad=-1;
  for (var i=0; i<network.length; i++){

    // [success, vehReturn, distMin_m, ivehReturn];
    var findResults=network[i].findNearestVehTo(xUser,yUser);

    if(findResults[0]){
      if(findResults[2]<distMin_m){
	iRoad=i;
	distMin_m=findResults[2];
	vehPerturbed=findResults[1];
      }
    }

    if(false){
      console.log("in slowdownVehNearestTo: i=",i," findResults[2]=",
		  findResults[2]," success=",findResults[0]);
    }

  }

  if((iRoad==-1)||(distMin_m>distCrit_m)){ // no success
    console.log("influenceVehNearestTo: no suitable vehicle found!");
    return;
  }
       

  if(vehPerturbed.isRegularVeh()){  // neither TL nor obstacle
    vehPerturbed.id=idPerturbed;  // to distinguish it by color
    vehPerturbed.speed *= speedReduceFactor;
    idPerturbed++; if(idPerturbed===50){idPerturbed=10;}
  }
}



function showPhysicalCoords(xUser,yUser){
    //console.log("in showPhysicalCoords: xUser=",xUser," yUser=",yUser);
    //console.log("in showPhysicalCoords");
}



