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


var userCanDistortRoads=false;
var userCanDropObjects=true;


// override standard dettings control_gui.js or introduce non-slider vars

density=0.02; 
qSecondary=0.2; // qIn and qOn controlled by control_gui.js (!!could use qOn)
var nLanes_main=3;
var nLanes_rmp=1;

/*
fracTruck=0.4; 
slider_fracTruck.value=100*fracTruck;
slider_fracTruck.innerHTML=100*fracTruck+"%";

timewarp=2;
slider_timewarp.value=timewarp;
slider_timewarpVal.innerHTML=timewarp +" times";
*/

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


var scenarioString="Gridlock"; // needed in handleDependencies in canvas_gui
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

var refSizePhys=(isSmartphone) ? 200 : 350; // also adapt in updateDimensions

var critAspectRatio=120./95.; // from css file width/height of #contents

var refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);
var scale=refSizePix/refSizePhys;

//xxxnew [position]
var hasChanged=true; // window or physical dimensions have changed
var hasChangedPhys=true; // physical road dimensions have changed 
                          // in last updateDimensions
                          // (only true when switching from/to mobile version)


//xxxnew
//<NETWORK>
//##################################################################
// init Specification of physical road network geometry
// If viewport or refSizePhys changes => updateDimensions();
//##################################################################

// all relative "Rel" settings with respect to refSizePhys, not refSizePix!

var center_xRel=0.43;
var center_yRel=-0.64;
var arcRadiusRel=0.28;
var rampRadiusRel=0.12;
var mergeLenMainRel=0.45;
var mergeLenSecRel=0.25;


// xxxnew
// !!slight double-coding with updateDimensions unavoidable since
// updateDimensions needs roads (mainroad.roadLen ...) 
// which are not yet defined here

var center_xPhys=center_xRel*refSizePhys; //[m]
var center_yPhys=center_yRel*refSizePhys;

var arcRadius=arcRadiusRel*refSizePhys;
var arcLen=arcRadius*Math.PI;
var straightLen=refSizePhys*critAspectRatio-center_xPhys;
var mainroadLen=arcLen+2*straightLen;

var rampRadius=rampRadiusRel*refSizePhys;
var mergeLenMain=mergeLenMainRel*refSizePhys; 
var mergeLenSec=mergeLenSecRel*refSizePhys; 
var rampLen=mergeLenMain+mergeLenSec+(1.5*Math.PI+1)*rampRadius;
var secondaryLen=2.5*arcRadius+4*rampRadius; //!!! reuse

var mainOnOffset=mainroadLen-straightLen+mergeLenMain-rampLen;
var taperLen=0.15*refSizePhys;


// !! slightdouble-coding necessary unless big changes, 
// I have checked this...

function updateDimensions(){ // if viewport or sizePhys changed
  console.log("in updateDimensions");
  refSizePhys=(isSmartphone) ? 200 : 350; // also adapt in definition above
  refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);
  scale=refSizePix/refSizePhys;
  
  center_xPhys=center_xRel*refSizePhys; //[m]
  center_yPhys=center_yRel*refSizePhys;

  //xxxnew
  // redefine basis of traj*_x, traj*_y or traj_x[], traj_y[]
  // if hasChangedPhys=true


  if(hasChangedPhys){
    arcRadius=arcRadiusRel*refSizePhys;
    arcLen=arcRadius*Math.PI;
    straightLen=refSizePhys*critAspectRatio-center_xPhys;
    mainroadLen=arcLen+2*straightLen;

    rampRadius=rampRadiusRel*refSizePhys;
    mergeLenMain=mergeLenMainRel*refSizePhys; 
    mergeLenSec=mergeLenSecRel*refSizePhys; 
    rampLen=mergeLenMain+mergeLenSec+(1.5*Math.PI+1)*rampRadius;

    mainOnOffset=mainroadLen-straightLen+mergeLenMain-rampLen;
    taperLen=0.2*rampLen;

    // xxxnew bring traj to roads 
    // not needed if doGridding is false since then external traj reference
  
    if(userCanDistortRoads){
      for(var i=0; i<network.length; i++){
	network[i].gridTrajectories(trajNet_x[i], trajNet_y[i]);
      }
    }
  
    // update positions of fixed obstacles to new road lengths/geometry
    // (e.g. onramp: ramp via the ref virtualStandingVeh)
    // see "Specification of logical road network" below

    virtualStandingVeh.u=ramp.roadLen-0.9*taperLen; //xxxnew
  }
  
  if(true){
    console.log("updateDimensions: mainroadLen=",mainroadLen,
		" isSmartphone=",isSmartphone, 
		" hasChangedPhys=",hasChangedPhys);
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

function taperDiverge(u,taperLen,laneWidth){
  var res=
    (u<0.5*taperLen) ? laneWidth*(1-2*Math.pow(u/taperLen,2)) :
    (u<taperLen) ? 2*laneWidth*Math.pow((taperLen-u)/taperLen,2) : 0;
  return res;
}

function taperMerge(u,taperLen,laneWidth,rampLen){
  return taperDiverge(rampLen-u,taperLen,laneWidth);
}


// def trajectories
// if(doGridding=true on constructing road, 
// road elements are gridded and internal
// road.traj_xy(u) are generated. Then, outer traj_xy*(u) obsolete
// and network[i].gridTrajectories(trajNet_x[i], trajNet_y[i]) called
// after a physical change

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

// !! in defining dependent geometry,
// do not refer to mainroad or onramp!! may not be defined: 
// mainroad.nLanes => nLanes_main, ramp.nLanes=>nLanes_ramp1


var u1Onramp=mergeLenSec;
var u2Onramp=mergeLenSec+1.5*Math.PI*rampRadius;



function trajOnramp_x(u){ // physical coordinates
  var xMergeBegin=traj_x(mainroadLen-straightLen);
  var xcArc=xMergeBegin-rampRadius;
  var res=
    (u<taperLen) ? xMergeBegin + taperDiverge(u,taperLen,laneWidth) :
    (u<u1Onramp) ? xMergeBegin :
    (u<u2Onramp) ? xcArc + rampRadius*Math.cos((u-u1Onramp)/rampRadius) 
    : xMergeBegin-rampRadius+(u-u2Onramp);
  return res;
}

function trajOnramp_y(u){ // physical coordinates
  var yMergeBegin=traj_y(mainroadLen-straightLen)
    -0.5*laneWidth*(nLanes_main+nLanes_rmp)-0.02*laneWidth;
  var yMergeEnd=yMergeBegin+laneWidth;
  var ycArc=yMergeBegin-rampRadius;
  var res=
    (u<u1Onramp) ? ycArc+u1Onramp-u : 
    (u<u2Onramp) ? ycArc - rampRadius*Math.sin((u-u1Onramp)/rampRadius) :
    (u<rampLen-taperLen) ? yMergeBegin
    : yMergeBegin+taperMerge(u,taperLen,laneWidth,rampLen);
  return res;
}

function trajOfframp_x(u){
  return trajOnramp_x(rampLen-u); // symmetrical to center_yPhys=const axis
}

function trajOfframp_y(u){ 
  return 2*center_yPhys-trajOnramp_y(rampLen-u);
}

function trajSecondary_x(u){
  return traj_x(straightLen-laneWidth);
}

function trajSecondary_y(u){
  return center_yPhys+0.5*secondaryLen-u;
}




var trajNet_x=[]; // xxxnew 
var trajNet_y=[];
trajNet_x[0]=traj_x;
trajNet_y[0]=traj_y;

trajNet_x[1]=trajOnramp_x;
trajNet_y[1]=trajOnramp_y;

trajNet_x[2]=trajOfframp_x;
trajNet_y[2]=trajOfframp_y;

trajNet_x[3]=trajSecondary_x;
trajNet_y[3]=trajSecondary_y;


//xxxnew [comment, separated veh from road properties]
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
var roadIDonramp=2;
var roadIDofframp=3;
var roadIDsecondary=4;

var fracTruckToleratedMismatch=1.0; // 100% allowed=>changes only by sources

var speedInit=20; // IC for speed

// last arg = doGridding (true: user can change road geometry)

  //userCanDistortRoads=true; //!! test  
var mainroad=new road(roadIDmain,mainroadLen,laneWidth,nLanes_main,
		      traj_x,traj_y,
		      density, speedInit,fracTruck, isRing,
		      userCanDistortRoads);

var onramp=new road(roadIDonramp,rampLen,laneWidth,nLanes_rmp,
		    trajOnramp_x,trajOnramp_y,
		    0*density, speedInit, fracTruck, isRing,
		    userCanDistortRoads);

var offramp=new road(roadIDofframp,rampLen,laneWidth,nLanes_rmp,
		    trajOfframp_x,trajOfframp_y,
		    0*density, speedInit, fracTruck, isRing,
		    userCanDistortRoads);

var secondaryroad=new road(roadIDsecondary,secondaryLen,laneWidth,nLanes_rmp,
		    trajSecondary_x,trajSecondary_y,
		    0*density, speedInit, fracTruck, isRing,
		    userCanDistortRoads);

// road network 

network[0]=mainroad;  // network declared in canvas_gui.js
network[1]=onramp;
network[2]=offramp;
network[3]=secondaryroad;

//############################################################
// define routes (fracOff default defined in control_gui.js)
// only needed for diverges, no options at merge
//############################################################

var route1=[1];  // stays on mainroad
var route2=[1,3]; // goes via offramp 3 from mainroad 1 to secondary road 4
var route3=[4,2]; // goes via onramp 2 from secondary road 4 to mainroad 1
// !!!check if routes [1,3,4] and [4,2,1] work as well
// !!! define preparations for diverging for secondaryroad
// and give routes to inflow, then it should work completely!!!
//!! WHOW! traffic lights work perfectly on all links!

for (var i=0; i<mainroad.veh.length; i++){
    mainroad.veh[i].route=(Math.random()<fracOff) ? route2 : route1;
    //console.log("mainroad.veh["+i+"].route="+mainroad.veh[i].route);
}

//!!! define routes 3

//############################################
// define preparations for diverging 
// (!! physical connections via sourceRoad.mergeDiverge 
// and other operations during updateSim)
//############################################

// (1) diverge mainroad 1 -> offramp 3 controlled by mainroad
// !!! check if transition to smartphone dimensions

var duTactical=200; // anticipation distance for applying mandatory LC rules
var offrampIDs=[offramp.roadID];
var offrampLastExits=[straightLen];
var offrampToRight=[true];
mainroad.setOfframpInfo(offrampIDs,offrampLastExits,offrampToRight);
mainroad.duTactical=duTactical;


// add standing virtual vehicle at the end of onramp (1 lane)
// prepending=unshift (strange name)

var virtualStandingVeh=new vehicle(2, laneWidth, onramp.roadLen-0.9*taperLen, 0, 0, "obstacle");

onramp.veh.unshift(virtualStandingVeh);

var nDet=3;
var detectors=[];
detectors[0]=new stationaryDetector(mainroad,0.10*mainroadLen,10);
detectors[1]=new stationaryDetector(mainroad,0.60*mainroadLen,10);
detectors[2]=new stationaryDetector(mainroad,0.90*mainroadLen,10);

//</NETWORK>


//#########################################################
// model initialization (models and methods defined in control_gui.js)
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
// traffic objects
//############################################

// TrafficObjects(canvas,nTL,nLimit,xRelDepot,yRelDepot,nRow,nCol)
var trafficObjs=new TrafficObjects(canvas,2,3,0.60,0.50,1,5);
var trafficLightControl=new TrafficLightControlEditor(trafficObjs,0.5,0.5);



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

  //xxxnew
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
      hasChangedPhys=true;
    }

    updateDimensions(); // updates refsizePhys, -Pix, scale, geometry
 
    trafficObjs.calcDepotPositions(canvas);
    if(true){
      console.log("updateSim: haschanged=true: new canvas dimension: ",
		  canvas.width," X ",canvas.height);
      console.log("window.innerWidth=",window.innerWidth,
		  " window.innerHeight=",window.innerHeight);
    }
  }
 

  // (2) transfer effects from slider interaction and mandatory regions
  // to the vehicles and models

  for(var i=0; i<network.length; i++){
    network[i].updateTruckFrac(fracTruck, fracTruckToleratedMismatch);
    network[i].updateModelsOfAllVehicles(longModelCar,longModelTruck,
				       LCModelCar,LCModelTruck,
				       LCModelMandatory);
  }

  //console.log(" mainroadLen=",mainroadLen," mainroad.roadLen=",mainroad.roadLen);

   // (2a) update moveable speed limits

  for(var i=0; i<network.length; i++){
    network[i].updateSpeedlimits(trafficObjs);
  }


    // (2b) externally impose mandatory LC behaviour for merging links:
    // all ramp vehicles must change lanes to the left (last arg=false)

  onramp.setLCMandatory(onramp.roadLen-mergeLenMain, onramp.roadLen, false);
  offramp.setLCMandatory(offramp.roadLen-mergeLenSec, offramp.roadLen, false);


  // (3) do central simulation update of vehicles

  for(var i=0; i<network.length; i++){ // still no link-link interaction
    network[i].updateLastLCtimes(dt);
    network[i].calcAccelerations(); 
  }

  for(var i=0; i<network.length; i++){ 
    network[i].updateSpeedPositions();
    network[i].updateBCdown(); // just removes veh (!=ringroad) if u>roadLen 
  }

  mainroad.changeLanes();  // only needed for multi-lane links,

  mainroad.updateBCup(qIn,dt); // only two links have sources (arg=qTot)
  secondaryroad.updateBCup(qSecondary,dt);


// template: sourceRoad.mergeDiverge(targetRoad,
//    offsetTarget-Source,
//    source_uBegin, source_uEnd, 
//    isMerge, toRight,
//    ignoreRoute[opt], prioOther[opt], prioOwn[opt])

  mainroad.mergeDiverge(offramp,
			-straightLen+mergeLenMain,
			straightLen-mergeLenMain+0.5*taperLen, straightLen,
			false,true);

  // !!! consolidate ad-hoc "30" at offsetTarget-Source
  offramp.mergeDiverge(secondaryroad,
		       0.5*secondaryLen-arcRadius+30-offramp.roadLen,
		       offramp.roadLen-mergeLenSec,offramp.roadLen,
		       true,false);

  secondaryroad.mergeDiverge(onramp,
			     -0.5*secondaryLen-arcRadius,
			     0.5*secondaryLen+arcRadius,
			     0.5*secondaryLen+arcRadius+mergeLenSec,
			     false,true);

  onramp.mergeDiverge(mainroad,mainOnOffset,
		      onramp.roadLen-mergeLenMain,onramp.roadLen,
		      true,false);



    // (4) update detector readings

  for(var iDet=0; iDet<nDet; iDet++){
    detectors[iDet].update(time,dt);
  }


  //  (5) without this zoomback cmd, everything works but depot vehicles
  // just stay where they have been dropped outside of a road

  if(userCanDropObjects&&(!isSmartphone)&&(!trafficObjPicked)){
    trafficObjs.zoomBack();
 }


// (6) debug output

  if(itime<2){
  //if(false){
    console.log("\n\nitime=",itime,": end of updateSim loop");


    if(false){
      console.log("mainroadLen=",formd(mainroadLen),
		" mainroad.roadLen=",formd(mainroad.roadLen),
		" onramp.roadLen=",formd(onramp.roadLen),
		" mainOnOffset=",formd(mainOnOffset));
      console.log("mergeDiverge(mainroad",
		",",formd(mainOnOffset),
		",",formd(onramp.roadLen-mergeLenMain),
		",",formd(onramp.roadLen),
		")");
    }


    if(true){
      for(var i=0; i<=40; i++){
	var u=offramp.roadLen*i/40.;

	console.log(
	  "  u=",formd(u),
	  " onramp.traj_x=",formd(onramp.traj_x(u)),
	 // " onramp.traj_y=",formd(onramp.traj_y(u)),
	  " offramp.traj_x=",formd(offramp.traj_x(u)),
	  " trajOnramp_x(u-rampLen)=",formd(trajOnramp_x(u-rampLen)),
	 // " offramp.traj_y=",formd(offramp.traj_y(u)),
	  "");
      }
    }

    if(false){
      console.log("\nmainroad vehicles:");
      mainroad.writeVehiclesSimple();
      onramp.writeVehiclesSimple();
    }

    if(false){
      onlyTL=true;
      trafficObjs.writeObjects(onlyTL); //the trafficObjs general TL objects
      onlyTL=true;
      mainroad.writeTrafficLights(); // the road's operational TL objects
      onramp.writeTrafficLights(); 
      mainroad.writeDepotVehObjects();
      onramp.writeDepotVehObjects();
    }
    //if(time>1.2){clearInterval(myRun);}
  }




}//updateSim




//##################################################
function drawSim() {
//##################################################

    //!! test relative motion isMoving

  var movingObserver=false;
  var uObs=0*time;

  //xxxnew [vieles nach updateSim]
  // (1) adapt text size
 
  var relTextsize_vmin=(isSmartphone) ? 0.03 : 0.02;
  var textsize=relTextsize_vmin*Math.min(canvas.width,canvas.height);



    // (2) reset transform matrix and draw background
    // (only needed if no explicit road drawn)

  ctx.setTransform(1,0,0,1,0,0);
  if(drawBackground){
    if(hasChanged||(itime<=2) || (itime==10) || (itime==20) || userCanvasManip
       || movingObserver || (!drawRoad)){
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
  

  // (3)(4) draw network and vehicles in growing z order
  // (always drawn; changedGeometry only triggers making a new lookup table)

  var changedGeometry=userCanvasManip || hasChanged||(itime<=1)||true; 

  onramp.draw(rampImg,rampImg,scale,changedGeometry,
	      onramp.roadLen-taperLen,onramp.roadLen); 
  offramp.draw(rampImg,rampImg,scale,changedGeometry,
	       0,taperLen); 

  mainroad.draw(roadImg1,roadImg2,scale,changedGeometry,
		0,mainroad.roadLen);
  onramp.draw(rampImg,rampImg,scale,changedGeometry,
	      0.5*onramp.roadLen,onramp.roadLen-taperLen); 
  offramp.draw(rampImg,rampImg,scale,changedGeometry,
	       taperLen,0.5*offramp.roadLen); 


  mainroad.drawVehicles(carImg,truckImg,obstacleImgs,scale,
			vmin_col,vmax_col,
			0,mainroad.roadLen);
  onramp.drawVehicles(carImg,truckImg,obstacleImgs,scale,
		      vmin_col,vmax_col,
		      0.5*onramp.roadLen,onramp.roadLen);
  offramp.drawVehicles(carImg,truckImg,obstacleImgs,scale,
		      vmin_col,vmax_col,
		      0,0.5*onramp.roadLen);


  onramp.draw(rampImg,rampImg,scale,changedGeometry,
	      0,0.5*onramp.roadLen); 
  offramp.draw(rampImg,rampImg,scale,changedGeometry,
	       0.5*offramp.roadLen,offramp.roadLen); 
  secondaryroad.draw(rampImg,rampImg,scale,changedGeometry);


  onramp.drawVehicles(carImg,truckImg,obstacleImgs,scale,
		      vmin_col,vmax_col,
		      0,0.5*onramp.roadLen);
  offramp.drawVehicles(carImg,truckImg,obstacleImgs,scale,
		       vmin_col,vmax_col,
		       0.5*onramp.roadLen,offramp.roadLen);
  secondaryroad.drawVehicles(carImg,truckImg,obstacleImgs,scale,
			     vmin_col,vmax_col);


  // (5a) draw traffic objects 

  if(userCanDropObjects&&(!isSmartphone)){
    trafficObjs.draw(scale);
  }

  // (5b) draw speedlimit-change select box

  ctx.setTransform(1,0,0,1,0,0); 
  drawSpeedlBox();


  // (6) show simulation time and detector displays

  displayTime(time,textsize);
  for(var iDet=0; iDet<nDet; iDet++){
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

      // (7) draw the speed colormap
      //!! Now always false; drawn statically by html file!

  if(drawColormap){
      displayColormap(0.22*refSizePix,
                   0.43*refSizePix,
                   0.1*refSizePix, 0.2*refSizePix,
		   vmin_col,vmax_col,0,100/3.6);
  }
  
  // may be set to true in next step if changed canvas 
  // (updateDimensions) or if old sign should be wiped away 

  hasChanged=false;
  hasChangedPhys=false; //xxxnew

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
showInfo();

var myRun=setInterval(main_loop, 1000/fps);

