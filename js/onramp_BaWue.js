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

// following in control_gui.js; call bash/eng2ger.bash to propagate it to ger
//function formd0(x){return parseFloat(x).toFixed(0);}
//function formd(x){return parseFloat(x).toFixed(2);}

const userCanDropObjects=true;

nLanesMin=1;
nLanesMax=4; 

//#############################################################
// adapt standard IDM and MOBIL model parameters from control_gui.js
// since no sliders for that.
// Values are distributed in updateModels() => truck model derivatives
// and (as deep copies) in road.updateModelsOfAllVehicles
//#############################################################



IDM_T=1.4;
IDM_a=1;
IDM_b=2.5; // low for more anticipation
IDM_s0=2;
speedL=1000/3.6; 
speedL_truck=80/3.6;

MOBIL_bBiasRigh_car=0.1;
MOBIL_bBiasRight_truck=8;
MOBIL_mandat_bSafe=18;
MOBIL_mandat_bThr=0.5;   // >0
MOBIL_mandat_bias=1.5;

MOBIL_bSafe=5;
MOBIL_bSafeMax=17;

//#############################################################
// initialize sliders differently from standard
//  (qIn etc override control_gui.js)
//#############################################################

density=0.02; // density per lane (0.02)

IDM_v0=140./3.6;
// setSlider here not defined
slider_IDM_v0.value=3.6*IDM_v0;
slider_IDM_v0Val.innerHTML=3.6*IDM_v0+" km/h";

qIn=4400/3600.; // inflow 4400./3600; 
slider_qIn.value=3600*qIn;
slider_qInVal.innerHTML=formd0(3600*qIn)+" Fz/h";

fracTruck=0.06;
slider_fracTruck.value=100*fracTruck;
slider_fracTruckVal.innerHTML=100*fracTruck+"%";

qIn=4800/3600.; // inflow 4400./3600; 
slider_qIn.value=3600*qIn;
slider_qInVal.innerHTML=formd0(3600*qIn)+" Fz/h";

qOn=1000/3600.; //total onramp flow of onramp scenario
if(!(typeof uOffset === 'undefined')){
  slider_qOn.value=3600*qOn;
  slider_qOnVal.innerHTML=formd0(3600*qOn)+" Fz/h";
}

function externalOnrampDemand(time){
  qOnMax=1400./3600.;
  cycleTime=120;
  if(!(typeof uOffset === 'undefined')){
    slider_qOn.value=3600*qOn;
    slider_qOnVal.innerHTML=formd0(3600*qOn)+" Fz/h";
  }
  var returnVal=qOnMax*Math.pow(Math.sin(1*Math.PI*time/cycleTime), 4);
  //console.log("externalOnrampDemand: time=",time," demand=",returnVal);
  return qOnMax*Math.pow(Math.sin(1*Math.PI*time/cycleTime), 4);
}

//#############################################################
// programmatic traffic light control
//#############################################################

/** switches the active traffic-light object TL (element of depot.obstTL[])
 as a function of time.

@param TL:        TrafficObjects traffic object of type trafficLight
                  which must be active (on a road)
@param qRoad:     traffic flow on this link. 
                  if !isFixed, the green phase duration depends on it
@param time:      simulation time [s]
@param cycleTime: fixed time for a complete TL cycle
@param greenTime: (optional) green phase; used if isFixed=true
@param isFixed:   (optional) if true, the green phase=greenTime is fixed
*/

function switchingSchemeTL(TL,qRoad,time,cycleTime,greenTime,isFixed){

  if(!(TL.type==='trafficLight')){ 
    console.log("switchingSchemeTL: error:",
		" can only switch active traffic light objects");
    return;
  }
  
  var qmax=IDM_v0/(IDM_v0*IDM_T+car_length);  // upper limit, only cars 

  var fracGreen=Math.min(qRoad/qmax, 1.);
  if(!(typeof isFixed === 'undefined')){fracGreen=greenTime/cycleTime;}
  var nCycle=Math.floor(time/cycleTime);
  var fracCycle=time/cycleTime-nCycle;
  var isGreen=(fracCycle<fracGreen);

  // do the action

  var newState=(isGreen) ? "green" : "red";
  trafficObjs.setTrafficLight(TL, newState); 

  if(false){
    console.log("switchingSchemeTLup: time=",time,
		" fracGreen=",fracGreen," nCycle=",nCycle,
		" fracCycle=",fracCycle," isGreen=",isGreen);
  }
}


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


var scenarioString="OnRamp_BaWue";
console.log("\n\nstart main: scenarioString=",scenarioString);


var simDivWindow=document.getElementById("contents");
var canvas = document.getElementById("canvas"); 
var ctx = canvas.getContext("2d"); // graphics context
canvas.width  = simDivWindow.clientWidth; 
canvas.height  = simDivWindow.clientHeight;
var aspectRatio=canvas.width/canvas.height;


console.log("before addTouchListeners()");
addTouchListeners();
console.log("after addTouchListeners()");


//##################################################################
// overall scaling (critAspectRatio should be consistent with 
// width/height in css.#contents)
//##################################################################

var isSmartphone=false;
var critAspectRatio=16./9.; // optimized for 16:9 corresp. css.#contents
var refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);


//##################################################################
// Specification of physical road geometry and vehicle properties
// If refSizePhys changes, change them all => updateDimensions();
//##################################################################

var mainroadLen=1000; //!!


// all relative "Rel" settings with respect to refSizePhys, not refSizePix!

var center_xRel=0.47;
var center_yRel=-0.505;
var arcRadiusRel=0.36;
var rampLenRel=1.80;


// constant  refSizePhys calculated by requirement fixed mainroadLen!!

var refSizePhys=mainroadLen/(Math.PI*arcRadiusRel
			     +2*(critAspectRatio-center_xRel));
var scale=refSizePix/refSizePhys;

var center_xPhys, center_yPhys;
var arcRadius, arcLen, straightLen;
var rampLen, mergeLen, mainRampOffset, taperLen, rampRadius;

updateDimensions();

// the following remains constant 
// => road becomes more compact for smaller screens

var laneWidth=7; // remains constant => road becomes more compact for smaller
var nLanes_main=3;
var nLanes_rmp=1;


var car_length=7; // car length in m
var car_width=5; // car width in m
var truck_length=15; // trucks
var truck_width=7; 


function updateDimensions(){ // if viewport or sizePhys changed
  center_xPhys=center_xRel*refSizePhys; //[m]
  center_yPhys=center_yRel*refSizePhys;

  arcRadius=arcRadiusRel*refSizePhys;
  arcLen=arcRadius*Math.PI;
  straightLen=refSizePhys*critAspectRatio-center_xPhys;
 
  rampLen=rampLenRel*refSizePhys; 
  mergeLen=0.4*rampLen;
  mainRampOffset=mainroadLen-straightLen+mergeLen-rampLen+0.4*straightLen;
  taperLen=50;
  rampRadius=4*arcRadius;
  console.log("calculated mainroadLen=",arcLen+2*straightLen);
}



// on constructing road, road elements are gridded and internal
// road.traj_xy(u) are generated if doGridding=true (here false). If true, 
// traj_xy*(u) obsolete ??!!!

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


// heading of onramp (0: towards positive x, pi/2 = towards positive y)
// in logical onramp longitudinal coordinates
// linear change of heading between the pivot points

// NOTICE: in defining dependent geometry,
// do not refer to mainroad or onramp!! may not be defined: 
// mainroad.nLanes => nLanes_main, ramp.nLanes=>nLanes_ramp1!!

function headingRamp(u){

  var um1=0; var headingm1=0.2; // heading at ramp begin
  var u0=0.3*(rampLen-mergeLen); var heading0=0; 
  var u1=0.4*(rampLen-mergeLen); var heading1=0;
  var u2=0.5*(rampLen-mergeLen); var heading2=0.0; // 0.2;
  var u3=0.55*(rampLen-mergeLen); var heading3=0;
  var u4=0.6*(rampLen-mergeLen); var heading4=0;
  var u5=0.8*(rampLen-mergeLen); var heading5=0.25;
  var u6=1.0*rampLen-mergeLen; var heading6=0;
  var u7=rampLen-taperLen; var heading7=0;
  var u8=rampLen-0.5*taperLen; var heading8=2*nLanes_rmp*laneWidth/taperLen;
  var u9=rampLen; var heading9=0;
  var heading= (u<u0) ? headingm1 + (u-um1)/(u0-um1)*(heading0-headingm1) :
    (u<u1) ? heading0 + (u-u0)/(u1-u0)*(heading1-heading0) :
    (u<u2) ? heading1 + (u-u1)/(u2-u1)*(heading2-heading1) :
    (u<u3) ? heading2 + (u-u2)/(u3-u2)*(heading3-heading2) :
    (u<u4) ? heading3 + (u-u3)/(u4-u3)*(heading4-heading3) :
    (u<u5) ? heading4 + (u-u4)/(u5-u4)*(heading5-heading4) :
    (u<u6) ? heading5 + (u-u5)/(u6-u5)*(heading6-heading5) :
    (u<u7) ? heading6 + (u-u6)/(u7-u6)*(heading7-heading6) :
    (u<u8) ? heading7 + (u-u7)/(u8-u7)*(heading8-heading7)
    : heading8 + (u-u8)/(u9-u8)*(heading9-heading8);
  return heading;
}

// construct ramp x/y arrays in physical space
//!!! assuming for the moment mainroad heading=0 @ merge!

var nArrRamp=100;
var drampLen=rampLen/(nArrRamp-1);
var xRamp=[];
var yRamp=[];

// defines array input for analytic onramp geometry

function defineRampGeometry(){

  // crucial: correct x/y attachment at begin of merge 
  // (assume heading=0 @ merge for the moment)

  xRamp[nArrRamp-1]=traj_x(mainRampOffset+rampLen-mergeLen)+mergeLen;
  yRamp[nArrRamp-1]=traj_y(mainRampOffset+rampLen-mergeLen)
    -0.5*laneWidth*(nLanes_main-nLanes_rmp);

  for(var i=nArrRamp-2; i>=0; i--){
    var u=drampLen*(i+0.5);
    xRamp[i]=xRamp[i+1]-drampLen*Math.cos(headingRamp(u));
    yRamp[i]=yRamp[i+1]-drampLen*Math.sin(headingRamp(u));
  }


}


function trajRamp_x(u){ // physical coordinates
  var idouble=u/drampLen;
  var il=Math.max(0,Math.floor(idouble));
  var iu=Math.min(nArrRamp-1,il+1);
  return xRamp[il]+(idouble-il)*(xRamp[iu]-xRamp[il]);
}

function trajRamp_y(u){ // physical coordinates
  var idouble=u/drampLen;
  var il=Math.max(0,Math.floor(idouble));
  var iu=Math.min(nArrRamp-1,il+1);
  return yRamp[il]+(idouble-il)*(yRamp[iu]-yRamp[il]);
}


//##################################################################
// Specification of logical road 
//##################################################################

var isRing=false;  // 0: false; 1: true
var roadIDmain=1;
var roadIDramp=2;

fracTruckToleratedMismatch=1.0; // 100% allowed=>changes only by sources

speedInit=20; // IC for speed

// last arg = doGridding (true: user can change road geometry)

var mainroad=new road(roadIDmain,mainroadLen,laneWidth,nLanes_main,
		      [traj_x,traj_y],
		      density,speedInit,fracTruck,isRing,false);

var ramp=new road(roadIDramp,rampLen,laneWidth,nLanes_rmp,
		    [trajRamp_x,trajRamp_y],
		  density, speedInit, fracTruck,isRing,false);
network[0]=mainroad;  // network declared in canvas_gui.js
network[1]=ramp;

defineRampGeometry(); //!! needed since ramp geometry depends on mainroad

// add standing virtual vehicle at the end of ramp (1 lane)
// prepending=unshift (strange name)

var virtualStandingVeh=new vehicle(2, laneWidth, ramp.roadLen-0.9*taperLen, 0, 0, "obstacle");

ramp.veh.unshift(virtualStandingVeh);

// introduce stationary detectors


var detectors=[];
detectors[0]=new stationaryDetector(mainroad,0.05*mainroadLen,10);
detectors[1]=new stationaryDetector(mainroad,0.60*mainroadLen,10);
detectors[2]=new stationaryDetector(mainroad,0.95*mainroadLen,10);


//#########################################################
// model initialization (models and methods override control_gui.js)
//#########################################################
	
updateModels(); // defines longModelCar,-Truck,LCModelCar,-Truck,-Mandatory


//####################################################################
// Global graphics specification
//####################################################################

var hasChanged=true; // window dimensions have changed (responsive design)

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


// define obstacle image names

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
var trafficObjs=new TrafficObjects(canvas,2,3,0.50,0.72,1,6);
var trafficLightControl=new TrafficLightControlEditor(trafficObjs,0.5,0.5);

var rampMeterLight=trafficObjs.trafficObj[0]; 
//activate(trafficObject,road,u) or activate(trafficObject,road)
trafficObjs.activate(rampMeterLight,ramp,rampLen-mergeLen-80);


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

    // (1) update times

  time +=dt; // dt depends on timewarp slider (fps=const)
  itime++;

    // (2) transfer effects from slider interaction and mandatory regions
    // to the vehicles and models

  mainroad.updateTruckFrac(fracTruck, fracTruckToleratedMismatch);
  mainroad.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				       LCModelCar,LCModelTruck,
				       LCModelMandatory);

  ramp.updateTruckFrac(fracTruck, fracTruckToleratedMismatch);
  ramp.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				       LCModelCar,LCModelTruck,
				       LCModelMandatory);
 

  // (2a) update moveable speed limits

  for(var i=0; i<network.length; i++){
    network[i].updateSpeedlimits(trafficObjs);
  }

  // (2b) programmatic control upstream secondary network  

  //switchingSchemeTLup(depot.obstTL[0],qOn,time); // with explicit TL 
  qOn=externalOnrampDemand(time);                  // implicit flow control


  // (2c) programmatic control downstream ramp meter TL 

  //template switchingSchemeTL(TL,qRoad,time,cycleTime,greenTime,isFixed)
  switchingSchemeTL(rampMeterLight,qOn,time,7,3,true); //!!! (1) das macht Fuck!! for debug off 
  // debug output end of updateSim


  // (2d) externally impose mandatory LC behaviour
  // all ramp vehicles must change lanes to the left (last arg=false)

  ramp.setLCMandatory(0, ramp.roadLen, false);


    // (3) do central simulation update of vehicles


    mainroad.updateLastLCtimes(dt);
    mainroad.calcAccelerations();  
    mainroad.changeLanes();         
    mainroad.updateSpeedPositions();
    mainroad.updateBCdown();
    mainroad.updateBCup(qIn,dt); // argument=total inflow

    for (var i=0; i<mainroad.nveh; i++){
	if(mainroad.veh[i].speed<0){
	    console.log(" speed "+mainroad.veh[i].speed
			    +" of mainroad vehicle "
			    +i+" is negative!");
	}
    }


    ramp.calcAccelerations();  
    ramp.updateSpeedPositions();
    //ramp.updateBCdown();
    ramp.updateBCup(qOn,dt); // argument=total inflow

    //template: road.mergeDiverge(newRoad,offset,uStart,uEnd,isMerge,toRight)

    ramp.mergeDiverge(mainroad,mainRampOffset,
			ramp.roadLen-mergeLen,ramp.roadLen,true,false);

    // (4) update detector readings


    for(var iDet=0; iDet<detectors.length; iDet++){
	detectors[iDet].update(time,dt);
    }
 

  //  (5) without this zoomback cmd, everything works but depot vehicles
  // just stay where they have been dropped outside of a road

  if(userCanDropObjects&&(!isSmartphone)&&(!trafficObjPicked)){//xxxnew
    trafficObjs.zoomBack();
 }


// (6) debug output

    //if((itime>=125)&&(itime<=128)){
  if(false){
    console.log("\n\nitime=",itime,": end of updateSim loop");

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
    //if(time>1.2){clearInterval(myRun);}
  }


}//updateSim




//##################################################
function drawSim() {
//##################################################

    //!! test relative motion isMoving


  var movingObserver=false;
  var uObs=0*time;

    // (1) redefine graphical aspects of road (arc radius etc) using
    // responsive design if canvas has been resized 
    // isSmartphone defined in updateSim
 
  var relTextsize_vmin=(isSmartphone) ? 0.03 : 0.02; 
  var textsize=relTextsize_vmin*Math.min(canvas.width,canvas.height);



  if ((canvas.width!=simDivWindow.clientWidth)
      ||(canvas.height != simDivWindow.clientHeight)){
    hasChanged=true;
    canvas.width  = simDivWindow.clientWidth;
    canvas.height  = simDivWindow.clientHeight;
    aspectRatio=canvas.width/canvas.height;
    refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);

    scale=refSizePix/refSizePhys; // refSizePhys=constant unless mobile

    updateDimensions();
    trafficObjs.calcDepotPositions(canvas);

    if(true){
	    console.log("haschanged=true: new canvas dimension: ",
		        canvas.width," X ",canvas.height);
    }
  }

 


  // (2) reset transform matrix and draw background
  // (only needed if no explicit road drawn)

  ctx.setTransform(1,0,0,1,0,0);
  if(drawBackground){
	if(hasChanged||(itime<=15) || (itime===20) || userCanvasManip 
	   || movingObserver || (!drawRoad)){
        ctx.drawImage(background,0,0,canvas.width,canvas.height);
      }
  }


  // (3) draw mainroad
  // (always drawn; but changedGeometry=true necessary
  // if changed (it triggers building a new lookup table). 
  // Otherwise, road drawn at old position

    var changedGeometry=userCanvasManip || hasChanged||(itime<=1)||true; 
  ramp.draw(rampImg,rampImg,changedGeometry);
	//	movingObserver,0, 
	//	center_xPhys-mainroad.traj_x(uObs)+ramp.traj_x(0),
	//	center_yPhys-mainroad.traj_y(uObs)+ramp.traj_y(0)); 

    mainroad.draw(roadImg1,roadImg2,changedGeometry); 


 
    // (4) draw vehicles

    ramp.drawVehicles(carImg,truckImg,obstacleImgs,
			vmin_col,vmax_col,0,ramp.roadLen,
			movingObserver,0,
			center_xPhys-mainroad.traj[0](uObs)+ramp.traj[0](0),
			center_yPhys-mainroad.traj[1](uObs)+ramp.traj[1](0));


    mainroad.drawVehicles(carImg,truckImg,obstacleImgs,
			  vmin_col,vmax_col,0,mainroad.roadLen,
			  movingObserver,uObs,center_xPhys,center_yPhys);


   // (5a) draw traffic objects 

  if(userCanDropObjects&&(!isSmartphone)){
    trafficObjs.draw();
  }

  // (5b) draw speedlimit-change select box

  ctx.setTransform(1,0,0,1,0,0); 
  drawSpeedlBox();



    // (6) show simulation time and detector displays

  displayTime(time,textsize);
  for(var iDet=0; iDet<detectors.length; iDet++){
    detectors[iDet].display(textsize);
  }

  // (7) draw the speed colormap 
  // MT 2019: drawColormap=false if drawn statically by html file!

  if(drawColormap){ 
    displayColormap(0.22*refSizePix,
			0.43*refSizePix,
			0.1*refSizePix, 0.2*refSizePix,
			vmin_col,vmax_col,0,100/3.6);
  }

  // may be set to true in next step if changed canvas 
  // or old sign should be wiped away 

  hasChanged=false;

  // revert to neutral transformation at the end!

  ctx.setTransform(1,0,0,1,0,0); 
 }
 



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

