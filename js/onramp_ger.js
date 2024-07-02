/* ######################################################################
Source code for the interactive Javascript simulation at traffic-simulation.de

    Copyright (C) 2024  Martin Treiber

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License Version 3
    as published by the Free Software Foundation.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.

    Martin Treiber
   
    mail@martin-treiber.de
#######################################################################*/


/* Creating reproducible versions for debugging purposes:

(1) include <script src="js/seedrandom.min.js"></script> in html file
    (from https://github.com/davidbau/seedrandom, copied locally)

(2) apply Math.seedrandom(42) or Math.seedrandom("hello") or similar
    in all files containing Math.random commands 
    => at present, only road.js

!! only use inside functions/methods, e.g., in road constructor;
  otherwise, DOS in some browsers at first, but not subsequent, calls (stop-start)

console.log(Math.random());          // Always 0.0016341939679719736 with 42
console.log(Math.random());          // Always 0.9364577392619949 with 42
 Math.seedrandom(42);                // undo side effects of console commands 
*/
 
//#############################################################
// constants
//#############################################################

const REFSIZE=250;
const REFSIZE_SMARTPHONE=150;

//#############################################################
// general ui settings
//#############################################################

const userCanDropObjects=true;
var showCoords=true;  // show logical coords of nearest road to mouse pointer
                      // definition => showLogicalCoords(.) in canvas_gui.js
                      // application: here at drawSim (7):  
//#############################################################
// general debug settings (set=false for public deployment)
//#############################################################

drawRoadIDs=true; // override control_gui.js; call later
                  // network[ir].drawRoadID();
drawVehIDs=false;  // override control_gui.js;
                   // need to call later road.drawVehIDs=drawVehIDs

var debug=false;   // if true, then sim stops at crash (only for testing)
var crashinfo=new CrashInfo(); // need to include debug.js in html
                               // use it in updateSim (5)


//#############################################################
// stochasticity settings (acceleration noise spec at top of models.js)
//#############################################################

QnoiseAccel=0.05;         //[m^2/s^3] override default setting at models.js
var driver_varcoeff=0.15; //v0 and a coeff of variation (of "agility")
                          // need later override road setting by
                          // calling road.setDriverVariation(.); 


//#############################################################
// adapt/override standard param settings from control_gui.js
//#############################################################



qIn=4600./3600; 
commaDigits=0;
setSlider(slider_qIn, slider_qInVal, 3600*qIn, commaDigits, "veh/h");


density=0.01; 

var nLanes_main=3;
var nLanes_rmp=1;


/*######################################################
 Global overall scenario settings and graphics objects

 refSizePhys  => reference size in m (generally smaller side of canvas)
 refSizePix   => reference size in pixel (generally smaller side of canvas)
 scale = refSizePix/refSizePhys 
       => roads have full canvas regardless of refSizePhys, refSizePix

 (1) refSizePix=Math.min(canvas.width, canvas.height) determined during run  

 (2) refSizePhys smaller  => all phys roadlengths smaller
  => vehicles and road widths appear bigger for a given screen size 
  => chose smaller for mobile, 

  NOTICE: Unless refSizePhys is constant during sim,  
  updateDimensions needs to re-define  
  the complete infrastructure geometry at every change



  Example: refSizePhys propto sqrt(refSizePix) => roads get more compact 
  and vehicles get smaller, both on a sqrt basis

  Or jump at trigger refSizePix<canvasSizeCrit propto clientSize 
  => css cntrl normal/mobile with 2 fixed settings

  NOTICE: canvas has strange initialization of width=300 in firefox 
  and DOS when try sizing in css (see there) only 
 
  document.getElementById("contents").clientWidth; .clientHeight;
  always works!

######################################################*
*/

// scenarioString needed in
// (1) showInfo (control_gui) if info panels are shown
// (2) road: handle some exceptional behavior in the "*BaWue*" scenarios
// otherwise not needed

var scenarioString="OnRamp"; 
console.log("\n\nstart main: scenarioString=",scenarioString);


var simDivWindow=document.getElementById("contents");
var canvas = document.getElementById("canvas"); 
var ctx = canvas.getContext("2d"); // graphics context
canvas.width  = simDivWindow.clientWidth; 
canvas.height  = simDivWindow.clientHeight;


console.log("before addTouchListeners()");
addTouchListeners();
console.log("after addTouchListeners()");


//##################################################################
// init overall scaling (critAspectRatio should be consistent with 
// width/height in css.#contents)
//##################################################################

var isSmartphone=mqSmartphone();

var refSizePhys=(isSmartphone) ? REFSIZE_SMARTPHONE : REFSIZE;

var critAspectRatio=120./95.; // from css file width/height of #contents
                              // the higher, the longer sim window
                         // must be the same as in css:
                         // max-aspect-ratio: 24/19 etc

var refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);
var scale=refSizePix/refSizePhys;


var hasChanged=true; // window or physical dimensions have changed

//<NETWORK>
//##################################################################
// init Specification of physical road network geometry
// If viewport or refSizePhys changes => updateDimensions();
//##################################################################

// all relative "Rel" settings with respect to refSizePhys, not refSizePix!

var center_xRel=0.43;
var center_yRel=-0.54;
var arcRadiusRel=0.35;
var rampLenRel=0.85;


// !!slight double-coding with updateDimensions unavoidable since
// updateDimensions needs roads (mainroad.roadLen ...) 
// which are not yet defined here

var center_xPhys=center_xRel*refSizePhys; //[m]
var center_yPhys=center_yRel*refSizePhys;

var arcRadius=arcRadiusRel*refSizePhys;
var arcLen=arcRadius*Math.PI;
var straightLen=refSizePhys*critAspectRatio-center_xPhys;
var mainroadLen=arcLen+2*straightLen;
var rampLen=rampLenRel*refSizePhys; 
var mergeLen=0.4*rampLen;
var mainRampOffset=mainroadLen-straightLen+mergeLen-rampLen;
//var taperLen=0.2*rampLen; //!!!
var rampRadius=4*arcRadius;

// !! slightdouble-coding necessary unless big changes, 
// I have checked this...

function updateDimensions(){ // if viewport or sizePhys changed
  console.log("in updateDimensions");
  refSizePhys=(isSmartphone) ? REFSIZE_SMARTPHONE : REFSIZE; 
  refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);
  scale=refSizePix/refSizePhys;
  
  center_xPhys=center_xRel*refSizePhys; //[m]
  center_yPhys=center_yRel*refSizePhys;

  arcRadius=arcRadiusRel*refSizePhys;
  arcLen=arcRadius*Math.PI;
  straightLen=refSizePhys*critAspectRatio-center_xPhys;
  mainroadLen=arcLen+2*straightLen;
  rampLen=rampLenRel*refSizePhys; 
  mergeLen=0.4*rampLen;
  mainRampOffset=mainroadLen-straightLen+mergeLen-rampLen;
//  taperLen=0.2*rampLen; //!!!
  rampRadius=4*arcRadius;

 
  if(true){
    console.log("updateDimensions: mainroadLen=",mainroadLen,
		" isSmartphone=",isSmartphone);
  }
}

// updates array variables if new geometry, changed viewport size etc

function updateRampGeometry(){

  // crucial: correct x/y attachment at begin of merge 
  // (assume heading=0 @ merge for the moment)

  xRamp[nArrRamp-1]=traj[0](mainRampOffset+rampLen-mergeLen)+mergeLen;
  yRamp[nArrRamp-1]=traj[1](mainRampOffset+rampLen-mergeLen)
    -0.5*laneWidth*(nLanes_main-nLanes_rmp);

  for(var i=nArrRamp-2; i>=0; i--){
    var u=drampLen*(i+0.5);
    xRamp[i]=xRamp[i+1]-drampLen*Math.cos(headingRamp(u));
    yRamp[i]=yRamp[i+1]-drampLen*Math.sin(headingRamp(u));
  }


}


/**
 general helper functions for tapering (i.e., first/last) 
 section of offramps/onramps.
 Gives (positive) lateral offset in direction of the road from/to which 
 this ramp diverges/merges 
 relative to the decisionpoint of last diverge/merge
@param u: arclength of the ramp
@param taperLen: length of the tapering section
@param laneWidth: width of the ramp (only single-lane assumed)
@param rampLen: total length of ramp (needed for onramps ony)
@return: lateral offset in [0,laneWidth]
*/

/*
function taperDiverge(u,taperLen,laneWidth){
  var res=
    (u<0.5*taperLen) ? laneWidth*(1-2*Math.pow(u/taperLen,2)) :
    (u<taperLen) ? 2*laneWidth*Math.pow((taperLen-u)/taperLen,2) : 0;
  return res;
}

function taperMerge(u,taperLen,laneWidth,rampLen){
  return taperDiverge(rampLen-u,taperLen,laneWidth);
}

*/

// def trajectories

function traj_x(u){ // physical coordinates
        var dxPhysFromCenter= // left side (median), phys coordinates
	    (u<straightLen) ? straightLen-u
	  : (u>straightLen+arcLen) ? u-mainroadLen+straightLen
	  : -arcRadius*Math.sin((u-straightLen)/arcRadius);
	return center_xPhys+dxPhysFromCenter;
}

function traj_y(u){ // physical coordinates
        var dyPhysFromCenter=
 	    (u<straightLen) ? arcRadius
	  : (u>straightLen+arcLen) ? -arcRadius
	  : arcRadius*Math.cos((u-straightLen)/arcRadius);
	return center_yPhys+dyPhysFromCenter;
}

var traj=[traj_x,traj_y];

// in defining dependent geometry watch out that master (here traj_xy)
// is defined. Do not refer to road.traj_xy, only directly to functions
// mainroad.nLanes => nLanes_main, ramp.nLanes=>nLanes_ramp1
// !! approximated dx=du => nearly horizontal ramp

function trajRamp_x(u){ // physical coordinates
	var xMergeBegin=traj_x(mainRampOffset+rampLen-mergeLen);
	var x=xMergeBegin+(u-(rampLen-mergeLen));
	return x;
}


function trajRamp_y(u){ // physical coordinates

  var yMergeBegin=traj_y(mainRampOffset+rampLen-mergeLen)
	-0.5*laneWidth*(nLanes_main+nLanes_rmp)-0.02*laneWidth;

  return (u<rampLen-mergeLen)
    ? yMergeBegin - 0.5*Math.pow(rampLen-mergeLen-u,2)/rampRadius
    : yMergeBegin;
}

var trajRamp=[trajRamp_x,trajRamp_y];

var trajNet=[];
trajNet[0]=traj;
trajNet[1]=trajRamp;


//###################################################
// specification of road width and vehicle sizes
// remains constant => road becomes more compact for smaller screens
//###################################################


var laneWidth=7; // remains constant => road becomes more compact for smaller
// var laneWidthRamp=5; // main lanewidth used


var car_length=7; // car length in m
var car_width=5; // car width in m
var truck_length=15; // trucks
var truck_width=7; 




//##################################################################
// Specification of logical road network
//##################################################################

var isRing=false;  // 0: false; 1: true
var roadIDmain=1;
var roadIDramp=2;

fracTruckToleratedMismatch=1.0; // 100% allowed=>changes only by sources

speedInit=20; // IC for speed

var mainroad=new road(roadIDmain,mainroadLen,laneWidth,nLanes_main,
		      traj,
		      density, speedInit,fracTruck, isRing);

var ramp=new road(roadIDramp,rampLen,laneWidth,nLanes_rmp,
		    trajRamp,
		  0*density, speedInit, fracTruck, isRing);

ramp.taperLen=30; // override constructor

// road network (network declared in canvas_gui.js)

network[0]=mainroad;
network[1]=ramp;


// roadIDs drawn in updateSim in separate loop because Xing roads
// may cover roads drawn before and I alsways want to see the IDs

for(var ir=0; ir<network.length; ir++){
  network[ir].setDriverVariation(driver_varcoeff);
  network[ir].drawVehIDs=drawVehIDs;
}

// add standing virtual vehicle at the end of ramp (1 lane)
// prepending=unshift (strange name)
// vehicle(length, width, u, lane, speed, type, //!!! omit later on
var virtualStandingVeh=new vehicle(2, laneWidth, ramp.roadLen-1, 0, 0, "obstacle");

ramp.veh.unshift(virtualStandingVeh);


var detectors=[];
detectors[0]=new stationaryDetector(mainroad,0.10*mainroadLen,10);
detectors[1]=new stationaryDetector(mainroad,0.60*mainroadLen,10);
detectors[2]=new stationaryDetector(mainroad,0.90*mainroadLen,10);

//</NETWORK>


//#########################################################
// model initialization (models and methods override control_gui.js)
//#########################################################
	
updateModels(); // defines longModelCar,-Truck,LCModelCar,-Truck,-Mandatory


//####################################################################
// Global graphics specification
//####################################################################


var drawBackground=true; // if false, default unicolor background
var drawRoad=true; // if false, only vehicles are drawn
var userCanvasManip; // true only if user-driven geometry changes

var drawColormap=false;
var vmin_col=0; // min speed for speed colormap (drawn in red)
var vmax_col=100/3.6; // max speed for speed colormap (drawn in blue-violet)


//####################################################################
// Images
//####################################################################


// init background image

var background = new Image();
background.src ='figs/backgroundGrass.jpg'; 
 

// init vehicle image(s)

carImg = new Image();
carImg.src = 'figs/blackCarCropped.gif';
truckImg = new Image();
truckImg.src = 'figs/truck1Small.png';


// init traffic light images

traffLightRedImg = new Image();
traffLightRedImg.src='figs/trafficLightRed_affine.png';
traffLightGreenImg = new Image();
traffLightGreenImg.src='figs/trafficLightGreen_affine.png';


//define obstacle image names

obstacleImgNames = []; // srcFiles[0]='figs/obstacleImg.png'
obstacleImgs = []; // srcFiles[0]='figs/obstacleImg.png'
for (var i=0; i<10; i++){
  obstacleImgs[i]=new Image();
  obstacleImgs[i].src = (i==0)
    ? "figs/obstacleImg.png"
    : "figs/constructionVeh"+(i)+".png";
  obstacleImgNames[i] = obstacleImgs[i].src;
}

// init road images

roadImgs1 = []; // road with lane separating line
roadImgs2 = []; // road without lane separating line

for (var i=0; i<4; i++){
    roadImgs1[i]=new Image();
    roadImgs1[i].src="figs/road"+(i+1)+"lanesCropWith.png"
    roadImgs2[i]=new Image();
    roadImgs2[i].src="figs/road"+(i+1)+"lanesCropWithout.png"
}

roadImg1 = new Image();
roadImg1=roadImgs1[nLanes_main-1];
roadImg2 = new Image();
roadImg2=roadImgs2[nLanes_main-1];

rampImg = new Image();
rampImg=roadImgs1[nLanes_rmp-1];


//############################################
// traffic objects and traffic-light control editor
//############################################

// need to define canvas prior to calling cstr: e.g.,
// TrafficObjects(canvas,nTL,nLimit,xRelDepot,yRelDepot,nRow,nCol)
//var trafficObjs=new TrafficObjects(canvas,1,3,0.60,0.50,3,2);
var trafficObjs=new TrafficObjects(canvas,2,2,0.40,0.50,3,2);

// also needed to just switch the traffic lights
// (then args xRelEditor,yRelEditor not relevant)
//var trafficLightControl=new TrafficLightControlEditor(trafficObjs,0.5,0.5);
var trafficLightControl=new TrafficLightControlEditor(trafficObjs,0.33,0.68);

trafficObjs.setSpeedLimit(2,30); // trafficObj[2].value=x km/h, 0=free


//############################################
// run-time specification and functions
//############################################

var time=0;
var itime=0;
var fps=30; // frames per second (unchanged during runtime)
var dt=timewarp/fps;


//#################################################################
function updateSim(){
//#################################################################

  // (1) update times and, if canvas change, 
  // scale and, if smartphone<->no-smartphone change, physical geometry

  time +=dt; // dt depends on timewarp slider (fps=const)
  itime++;

  if ((canvas.width!=simDivWindow.clientWidth)
      ||(canvas.height != simDivWindow.clientHeight)){
    hasChanged=true;
    canvas.width  = simDivWindow.clientWidth;
    canvas.height  = simDivWindow.clientHeight;

    if(isSmartphone!=mqSmartphone()){
      isSmartphone=mqSmartphone();
    }

    updateDimensions(); // updates refsizePhys, -Pix,  geometry
 
    trafficObjs.calcDepotPositions(canvas);
    if(true){
      console.log("updateSim: haschanged=true: new canvas dimension: ",
		  canvas.width," X ",canvas.height);
      console.log("window.innerWidth=",window.innerWidth,
		  " window.innerHeight=",window.innerHeight);
    }
  }

  // updAteSim: Test code at last point (5)


  
  // (2) transfer effects from slider interaction and mandatory regions
  // to the vehicles and models
  // longModelCar etc defined in control_gui.js
  // also update user-dragged movable speed limits

  for(var ir=0; ir<network.length; ir++){
    network[ir].updateTruckFrac(fracTruck, fracTruckToleratedMismatch);
    network[ir].updateModelsOfAllVehicles(longModelCar,longModelTruck,
					 LCModelCar,LCModelTruck,
					 LCModelMandatory);
    network[ir].updateSpeedlimits(trafficObjs);
  }

 
  // (2a) without this zoomback cmd, everything works but depot vehicles
  // just stay where they have been dropped outside of a road
  // (here more responsive than in drawSim)

  if(userCanDropObjects&&(!isSmartphone)&&(!trafficObjPicked)){
    trafficObjs.zoomBack();
 }

  // (2b) externally impose mandatory LC behaviour
  // all ramp vehicles must change lanes to the left (last arg=false)

  ramp.setLCMandatory(0, ramp.roadLen, false);


  
   // updateSim (3): do central simulation update of vehicles
  // one action at a time for all network elements for parallel update
  // first accelerations,
  // then networking (updateBCup, connect/mergeDiverge, updateBCdown),
  // then motions in x (speed, pos based on accel) and y (LC)
  // !! motions at the end because connect may override some accelerations

  // network[0]=mainroad,  network[1]=ramp

  //  (3a) accelerations
  
  for(var ir=0; ir<network.length; ir++){network[ir].calcAccelerations();} 

  // (3b) transitions between roads: templates:
  // sourceRoad.mergeDiverge(newRoad,offset,uStart,uEnd,
  //                         isMerge,vehMoveToRight,
  //                         opt_ignoreRoute, opt_prioOther, opt_prioOwn)
  // if vehicle has no route, it diverges whenever it is in the appropriate
  // lane => control diverges by giving all vehicles a route!


  // sourceRoad.connect(target, uSource, uTarget, offsetLane, conflicts)
  
  mainroad.updateBCup(qIn,dt); ramp.updateBCup(qOn,dt);
  ramp.mergeDiverge(mainroad,mainRampOffset,
			ramp.roadLen-mergeLen,ramp.roadLen,true,false);
  mainroad.updateBCdown();

  // (3c) actual motion (always at the end)
  // new vehicles introduced after acceleration calc (e.g. from .BCup)
  // have per default veh.acc=0 by veh constructor
  // !!! Still: Why not calc the acc directly before updateSpeedPositions?
  // Because by road.connect, the acceleration is overwritten and
  // must not be overwritten again when calculating accs here
  
  mainroad.updateLastLCtimes(dt);
  mainroad.changeLanes();
  for(var ir=0; ir<network.length; ir++){
    network[ir].updateSpeedPositions();
  } 


 
  // updateSim (4): update detector readings

  for(var iDet=0; iDet<detectors.length; iDet++){
	detectors[iDet].update(time,dt);
  }


  // updateSim (5): debug/test code

  if(debug){crashinfo.checkForCrashes(network);} //!! deact for production

  //if(time<38.5){
  if(false){
    debugVeh(211,network);
    debugVeh(212,network);
  }
  

  if(false){
    console.log("\n\nitime=",itime,": end of updateSim loop");


    if(true){
      console.log("mainroadLen=",formd(mainroadLen),
		" mainroad.roadLen=",formd(mainroad.roadLen),
		" ramp.roadLen=",formd(ramp.roadLen),
		" mainRampOffset=",formd(mainRampOffset));
      console.log("mergeDiverge(mainroad",
		",",formd(mainRampOffset),
		",",formd(ramp.roadLen-mergeLen),
		",",formd(ramp.roadLen),
		")");
    }


    if(false){
      console.log("\nmainroad vehicles:");
      mainroad.writeVehiclesSimple();
      ramp.writeVehiclesSimple();
    }
  
    if(true){
      onlyTL=true;
      trafficObjs.writeObjects(onlyTL); //the trafficObjs general TL objects
      onlyTL=true;
      mainroad.writeTrafficLights(); // the road's operational TL objects
      ramp.writeTrafficLights(); 
      mainroad.writeDepotVehObjects();
      ramp.writeDepotVehObjects();
    }
  }
  
  // 

  if(false){

  // template for dropping traffic lights: onramp.js
  // template for dropping speedL: test7_severalOnrampsOfframpsConnects.js
    
    // drop red traffic light

    //!! in different road operations (setSpeedlimit) order of
    // trafficObjs.trafficObj array changed in increasing u
    // can only select unique trafficObj at initialization or, as here,
    // when filtering for attributes

    // dropping of speed limits in test7*.js

    var TL;
    for(var iobj=0; iobj<trafficObjs.trafficObj.length; iobj++){
      if(trafficObjs.trafficObj[iobj].id==100){// first TL
	TL=trafficObjs.trafficObj[iobj];
      }
    }

    if(itime==1){
      var udrop=0.25*network[0].roadLen;
      trafficObjs.setTrafficLight(TL,"red");
      trafficObjs.dropObject(TL,network,
			     network[0].traj[0](udrop),
			     network[0].traj[1](udrop),
			     20,);
    }

    // switch TL to green

    if(itime==100){
      console.log("set first TL to green");
      trafficObjs.setTrafficLight(TL,"green");
    }
  }
    
   //if(time>1.2){clearInterval(myRun);}


}//updateSim




//##################################################
function drawSim() {
//##################################################

    //!! test relative motion isMoving

  var movingObserver=false;
  var uObs=0*time;

  // (1) adapt text size
 
  var relTextsize_vmin=(isSmartphone) ? 0.03 : 0.02;
  var textsize=relTextsize_vmin*Math.min(canvas.width,canvas.height);



  // (2) reset transform matrix and draw background
  // (only needed if changes, plus "reminders" for lazy browsers)

  ctx.setTransform(1,0,0,1,0,0);
  if(drawBackground){
    if(hasChanged||(itime<=10) || (itime%50==0) || userCanvasManip
      || (!drawRoad)||drawVehIDs){
      ctx.drawImage(background,0,0,canvas.width,canvas.height);

      if(false){
	console.log("itime=",itime,
		      " hasChanged=",hasChanged,
		      " userCanvasManip=",userCanvasManip,
		      " movingObserver=",movingObserver,
		      " before drawing background");
      }
    }
  }
  

  // (3) draw mainroad and ramp
  // (always drawn; changedGeometry only triggers making a new lookup table)

  //!! all args at and after umin,umax=0,ramp.roadLen are optional
  // here only example for complete args (only in coffeemeterGame relevant
  // !!! DOS in road.draw, OK in road.drawVehicles
  
  var changedGeometry=userCanvasManip || hasChanged||(itime<=1)||true; 

  
  ramp.draw(rampImg,rampImg,changedGeometry,
	    0,ramp.roadLen,
	    movingObserver,0,
	    center_xPhys-mainroad.traj[0](uObs)+ramp.traj[0](0),
	    center_yPhys-mainroad.traj[1](uObs)+ramp.traj[1](0));

  // only graphical: drawTaperRamp(roadImg1,  laneIncr, atRight)

  ramp.drawTaperRamp(rampImg,  -1, true);

  mainroad.draw(roadImg1,roadImg2,changedGeometry,
		0,mainroad.roadLen,
		movingObserver,uObs,center_xPhys,center_yPhys);

  if(drawRoadIDs){// separate loop because of visibility
    for(var ir=0; ir<network.length; ir++){
      network[ir].drawRoadID();
    }
  }

  // (4) draw vehicles
  //!! all args at and after umin,umax=0,ramp.roadLen are optional
  // here only example for complete args (only in coffeemeterGame relevant

  ramp.drawVehicles(carImg,truckImg,obstacleImgs,
		    vmin_col,vmax_col,
		    0,ramp.roadLen,
		    movingObserver,0,
		    center_xPhys-mainroad.traj[0](uObs)+ramp.traj[0](0),
		    center_yPhys-mainroad.traj[1](uObs)+ramp.traj[1](0));


  mainroad.drawVehicles(carImg,truckImg,obstacleImgs,
			vmin_col,vmax_col,
			0,mainroad.roadLen,
			movingObserver,uObs,center_xPhys,center_yPhys);

  // (5a) draw traffic objects 

  if(userCanDropObjects&&(!isSmartphone)){
    trafficObjs.draw();
  }

  // (5b) draw speedlimit-change select box

  ctx.setTransform(1,0,0,1,0,0); 
  drawSpeedlBox();


  // drawSim (6) show simulation time and detector displays

  displayTime(time,textsize);
  for(var iDet=0; iDet<detectors.length; iDet++){
	detectors[iDet].display(textsize);
  }

  // (6a) show scale info

  if(false){
    ctx.setTransform(1,0,0,1,0,0); 
    var textsize=0.02*Math.min(canvas.width,canvas.height); // 2vw;
    ctx.font=textsize+'px Arial';
    var scaleStr=" scale="+Math.round(10*scale)/10;
    var scaleStr_xlb=9*textsize;
    var scaleStr_ylb=timeStr_ylb;
    var scaleStr_width=5*textsize;
    var scaleStr_height=1.2*textsize;
    ctx.fillStyle="rgb(255,255,255)";
    ctx.fillRect(scaleStr_xlb,scaleStr_ylb-scaleStr_height,
		 scaleStr_width,scaleStr_height);
    ctx.fillStyle="rgb(0,0,0)";
    ctx.fillText(scaleStr, scaleStr_xlb+0.2*textsize, 
		 scaleStr_ylb-0.2*textsize);
  }

  // (6b) draw the speed colormap
  //!! Now always false; drawn statically by html file!

  if(drawColormap){
      displayColormap(0.22*refSizePix,
                   0.43*refSizePix,
                   0.1*refSizePix, 0.2*refSizePix,
		   vmin_col,vmax_col,0,100/3.6);
  }

  
  // drawSim (7): show logical coordinates if activated

  if(showCoords&&mouseInside){
    showLogicalCoords(xPixUser,yPixUser);
  }

  // drawSim (8): reset/revert variables for the next step

  
  // may be set to true in next step if changed canvas 
  // (updateDimensions) or if old sign should be wiped away 

  hasChanged=false;

  // revert to neutral transformation at the end!

  ctx.setTransform(1,0,0,1,0,0);


} // drawSim

 



//##################################################
// Running function of the sim thread (triggered by setInterval)
//##################################################

function main_loop() {
    updateSim();
    drawSim();
    userCanvasManip=false;
}
 

 //############################################
// start the simulation thread
// THIS function does all the things; everything else 
// only functions/definitions
// triggers:
// (i) automatically when loading the simulation 
// (ii) when pressing the start button in *gui.js
//  ("myRun=setInterval(main_loop, 1000/fps);")
//############################################

console.log("first main execution");

showInfo();//!!!! change to showInfoString() plus strings defined inline or as extra .js scripts to be included: works also locally. See golfCourse.js. Also the command "showInfoString should be placed in control_gui.js;


var myRun=setInterval(main_loop, 1000/fps);

