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

//#############################################################
// general ui settings
//#############################################################

const userCanDropObjects=true;
var showCoords=true;  // show logical coords of nearest road to mouse pointer
                      // definition => showLogicalCoords(.) in canvas_gui.js


//#############################################################
// general debug settings (set=false for public deployment)
//#############################################################

drawVehIDs=false;  // override control_gui.js
drawRoadIDs=false; // override control_gui.js
var debug=false;   // if true, then sim stops at crash (only for testing)
var crashinfo=new CrashInfo(); // need to include debug.js in html



//#############################################################
// stochasticity settings (acceleration noise spec at top of models.js)
//#############################################################

var driver_varcoeff=0.05; //0.15 v0 and a coeff of variation (of "agility")
                          // need later override road setting by
                          // calling road.setDriverVariation(.); 


//#############################################################
// adapt/override standard param settings from control_gui.js
//#############################################################

fracOff=0.25; /// 0.25
setSlider(slider_fracOff, slider_fracOffVal, 100*fracOff, 0, "%");



qIn=4000./3600; 
setSlider(slider_qIn, slider_qInVal, 3600*qIn, 0, "veh/h");


fracTruck=0.15;
setSlider(slider_fracTruck, slider_fracTruckVal, 100*fracTruck, 0, "%");


IDM_a=0.7; // low to allow stopGo
setSlider(slider_IDM_a, slider_IDM_aVal, IDM_a, 1, "m/s<sup>2</sup>");

factor_a_truck=1; // to allow faster slowing down of the uphill trucks

density=0.015; // IC

MOBIL_mandat_bSafe=22; // standard 42
MOBIL_mandat_bThr=0;   
MOBIL_mandat_bias=22;

/*######################################################
 Global overall scenario settings and graphics objects
 see onramp.js for more details

 refSizePhys  => reference size in m (generally smaller side of canvas)
 refSizePix   => reference size in pixel (generally smaller side of canvas)
 scale = refSizePix/refSizePhys 
       => roads have full canvas regardless of refSizePhys, refSizePix

 (1) refSizePix=Math.min(canvas.width, canvas.height) determined during run  

 (2) refSizePhys smaller  => all phys roadlengths smaller
  => vehicles and road widths appear bigger for a given screen size 
  => chose smaller for mobile, 

######################################################*
*/

var scenarioString="OffRamp";
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

var isSmartphone=mqSmartphone();

var refSizePhys=(isSmartphone) ? 150 : 250;  // constant

var critAspectRatio=120./95.; // from css file width/height of #contents

var refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);
var scale=refSizePix/refSizePhys;


//##################################################################
// Specification of physical road geometry and vehicle properties
//##################################################################

// all relative "Rel" settings with respect to refSizePhys, not refSizePix!

var center_xRel=0.43;
var center_yRel=-0.53;
var arcRadiusRel=0.35;
var offLenRel=0.9;

var center_xPhys=center_xRel*refSizePhys; //[m]
var center_yPhys=center_yRel*refSizePhys;

var arcRadius=arcRadiusRel*refSizePhys;
var arcLen=arcRadius*Math.PI;
var straightLen=refSizePhys*critAspectRatio-center_xPhys;
var mainroadLen=arcLen+2*straightLen;

var offLen=offLenRel*refSizePhys; 
var divergeLen=0.4*offLen;

var mainRampOffset=mainroadLen-0.9*straightLen;
var offRadius=3*arcRadius;




// the following remains constant 
// => road becomes more compact for smaller screens

var laneWidth=7; // remains constant => road becomes more compact for smaller
// var laneWidthRamp=5; // main lanewidth used
var nLanes_main=3;
var nLanes_rmp=1;

var car_length=7; // car length in m
var car_width=5; // car width in m
var truck_length=15; // trucks
var truck_width=7; 




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


function trajRamp_x(u){ // physical coordinates
	var xDivergeBegin=traj_x(mainRampOffset);
	return (u<divergeLen)
	    ? xDivergeBegin+u
	    : xDivergeBegin+divergeLen
	+offRadius*Math.sin((u-divergeLen)/offRadius);
}


function trajRamp_y(u){ // physical coordinates
    	var yDivergeBegin=traj_y(mainRampOffset)
	    -0.5*laneWidth*(nLanes_main+nLanes_rmp)-0.02*laneWidth;
	return (u<divergeLen)
	    ? yDivergeBegin
	    : yDivergeBegin -offRadius*(1-Math.cos((u-divergeLen)/offRadius));
}

var trajRamp=[trajRamp_x,trajRamp_y];


//##################################################################
// Specification of logical road network
//##################################################################

var isRing=false;  // 0: false; 1: true
var roadIDmain=1;
var roadIDramp=2;

fracTruckToleratedMismatch=1.0; // 100% allowed=>changes only by sources

speedInit=20; // IC for speed

var duTactical=260; // anticipation distance for applying mandatory LC rules

var mainroad=new road(1,mainroadLen,laneWidth, nLanes_main,traj,
		      density, speedInit,fracTruck, isRing);

var ramp=new road(2,offLen,laneWidth,nLanes_rmp,trajRamp,
		     0.1*density,speedInit,fracTruck,isRing);

// road network (network declared in canvas_gui.js)

network[0]=mainroad;
network[1]=ramp;

for(var ir=0; ir<network.length; ir++){
  network[ir].setDriverVariation(driver_varcoeff);//!!
  network[ir].drawVehIDs=drawVehIDs;
}

mainroad.duTactical=duTactical;

var targetRoads=[ramp];  // ! watch out: array with one element 
var uLast=[mainRampOffset+divergeLen];
var offrampToRight=[true];
var isMerge=[false];
var mergeDivergeLen=[divergeLen];
mainroad.initMergeDiverge(targetRoads,isMerge,
			  mergeDivergeLen,uLast,offrampToRight);


var route1=[1];  // stays on mainroad
var route2=[1,2]; // takes ramp
for (var i=0; i<mainroad.veh.length; i++){
    mainroad.veh[i].route=(Math.random()<fracOff) ? route2 : route1;
    //console.log("mainroad.veh["+i+"].route="+mainroad.veh[i].route);
}



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

console.log("roadImg1=",roadImg1," rampImg=",rampImg);

//############################################
// traffic objects
//############################################

// TrafficObjects(canvas,nTL,nLimit,xRelDepot,yRelDepot,nRow,nCol)
var trafficObjs=new TrafficObjects(canvas,1,2,0.60,0.50,2,2);
var trafficLightControl=new TrafficLightControlEditor(trafficObjs,0.5,0.5);


//############################################
// run-time specification and functions
//############################################

var time=0;
var itime=0;
var fps=30; // frames per second
var dt=timewarp/fps;


//#################################################################
function updateSim(){
//#################################################################

    // (1) update times

    time +=dt; // dt depends on timewarp slider (fps=const)
    itime++;
    isSmartphone=mqSmartphone();

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


  // updateSim (2a): update moveable speed limits

  for(var i=0; i<network.length; i++){
    network[i].updateSpeedlimits(trafficObjs);
  }

  // (2b) without this zoomback cmd, everything works but depot vehicles
  // just stay where they have been dropped outside of a road
  // (here more responsive than in drawSim)

  if(userCanDropObjects&&(!isSmartphone)&&(!trafficObjPicked)){
    trafficObjs.zoomBack();
 }

 

  // updateSim (3): do central simulation update of vehicles


  mainroad.updateLastLCtimes(dt);
  mainroad.calcAccelerations();  
  mainroad.changeLanes();         
  mainroad.updateSpeedPositions();
  mainroad.updateBCdown();
  var route=(Math.random()<fracOff) ? route2 : route1;
  mainroad.updateBCup(qIn,dt,route); // qIn=total inflow, route opt. arg.

  ramp.updateLastLCtimes(dt); // needed since LC from main road!!
  ramp.calcAccelerations();  
  ramp.updateSpeedPositions();
  ramp.updateBCdown();


  //template: mergeDiverge(newRoad,offset,uStart,uEnd,isMerge,toRight)

  var u_antic=20;
  mainroad.mergeDiverge(ramp,-mainRampOffset,
			  mainRampOffset,
			  mainRampOffset+divergeLen-u_antic,
			  false,true);

  // updateSim (4): update detector readings

  //( none)


  // updateSim (5): debug output

  if(debug){crashinfo.checkForCrashes(network);} //!! deact for production
  
  if(false){
    console.log("mainroadLen=",formd(mainroadLen),
		" mainroad.roadLen=",formd(mainroad.roadLen),
		" mainroad.offrampLastExits=",
		formd(mainroad.offrampLastExits),
		" ramp.roadLen=",formd(ramp.roadLen),
		" mainRampOffset=",formd(mainRampOffset));
    console.log("mergeDiverge(ramp",
		",",formd(-mainRampOffset),
		",",formd(mainRampOffset),
		",",formd(mainRampOffset+divergeLen-u_antic),
		")");
  }



}//updateSim




//##################################################
function drawSim() {
//##################################################

    // (0) redefine graphical aspects of road (arc radius etc) using
    // responsive design if canvas has been resized 
    // isSmartphone defined in updateSim
 
  var relTextsize_vmin=(isSmartphone) ? 0.03 : 0.02; //xxx
  var textsize=relTextsize_vmin*Math.min(canvas.width,canvas.height);

  if(false){
    console.log(" new total inner window dimension: ",
		window.innerWidth," X ",window.innerHeight,
		" (full hd 16:9 e.g., 1120:630)",
		" canvas: ",canvas.width," X ",canvas.height);
  }

  //updateDimensions();
    if ((canvas.width!=simDivWindow.clientWidth)
	||(canvas.height != simDivWindow.clientHeight)){
	hasChanged=true;
	canvas.width  = simDivWindow.clientWidth;
        canvas.height  = simDivWindow.clientHeight;
	aspectRatio=canvas.width/canvas.height;
	refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);

	scale=refSizePix/refSizePhys; // refSizePhys=constant unless mobile


      //updateDimensions();
      trafficObjs.calcDepotPositions(canvas); 

	if(true){
	    console.log("haschanged=true: new canvas dimension: ",
		        canvas.width," X ",canvas.height);
	}


    }


  // (2) reset transform matrix and draw background
  // (only needed if changes, plus "reminders" for lazy browsers)

  ctx.setTransform(1,0,0,1,0,0);
  if(drawBackground){
    if(hasChanged||(itime<=10) || (itime%50==0) || userCanvasManip
      || (!drawRoad) || drawVehIDs){
      ctx.drawImage(background,0,0,canvas.width,canvas.height);
    }
  }



  // (3) draw mainroad and ramps (offramp "bridge" => draw last)
  // and vehicles (directly after frawing resp road or separately, depends)
  // changedGeometry=true builds new pixel lookup table
  // drawTaperRamp (roadImg1,  laneIncr, atRight)
  // has purely graphical purposes

  var changedGeometry=userCanvasManip || hasChanged||(itime<=1); 
  ramp.draw(rampImg,rampImg,changedGeometry);
  ramp.drawTaperRamp(rampImg,1,true);
  //mainroad.drawTaperRamp(rampImg,1,true);
  mainroad.draw(roadImg1,roadImg2,changedGeometry);

    // (4) draw vehicles

    ramp.drawVehicles(carImg,truckImg,obstacleImgs,vmin_col,vmax_col);
    mainroad.drawVehicles(carImg,truckImg,obstacleImgs,vmin_col,vmax_col);

   // (5a) draw traffic objects 

  if(userCanDropObjects&&(!isSmartphone)){
    trafficObjs.draw();
  }

  // (5b) draw speedlimit-change select box

  ctx.setTransform(1,0,0,1,0,0); 
  drawSpeedlBox();



  // drawSim (6) draw some running-time vars

  displayTime(time,textsize);

  
  // drawSim (7): show logical coordinates if activated

  if(showCoords&&mouseInside){
    showLogicalCoords(xPixUser,yPixUser);
  }
  
  // drawSim (8): reset/revert variables for the next step

  // may be set to true in next step if changed canvas 
  // or old sign should be wiped away 
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
// (ii) when pressing the start button defined in onramp_gui.js
//  ("myRun=setInterval(main_loop, 1000/fps);")
//############################################

console.log("first main execution");
showInfo();
var myRun=setInterval(main_loop, 1000/fps);

