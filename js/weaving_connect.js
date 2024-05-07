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
var scenarioString="Weaving"; // needed in road.changeLanes etc

var showCoords=true;  // show logical coords of nearest road to mouse pointer
                      // definition => showLogicalCoords(.) in canvas_gui.js
                      // application: here at drawSim (7):  


//#############################################################
// general debug settings (set=false for public deployment)
//#############################################################

drawRoadIDs=true; // override control_gui.js; 
drawVehIDs=true;  // override control_gui.js;
                  // need to call later road.drawVehIDs=drawVehIDs

var crashinfo=new CrashInfo(); // need to include debug.js in html
                               // use it in updateSim (5)
var debug=false;   // if true, then sim stops at crash (only for testing)


//#############################################################
// stochasticity settings (acceleration noise spec at top of models.js)
//#############################################################

// white acceleration noise [m^2/s^3] overrides default setting at models.js

QnoiseAccel=0;

// coeff of variation sddev/avg for the IDM/ACC model parameters
// desired speed v0 and acceleration a ("agility")
// need later override road setting by calling road.setDriverVariation(.); 

var driver_varcoeff=0.15;



//#############################################################
// global parameter settings/initialisations
// (partly override standard param settings in control_gui.js)
//#############################################################

fracTruckToleratedMismatch=1.0; // 1=100% allowed=>changes only by sources
speedInit=20;

density=0.0;         // nonzero value only sensible for ring or simple sims
fracTruck=0.1;
fracOff=0.32; 

qIn=2000./3600;      // main flow [veh/s] def and controlled by GUI
qOn=300./3600;    // ramp flow def and controlled by GUI

commaDigits=0;
setSlider(slider_qIn, slider_qInVal, 3600*qIn, commaDigits, "veh/h");
setSlider(slider_qOn, slider_qOnVal, 3600*qOn, commaDigits, "veh/h");
setSlider(slider_fracOff, slider_fracOffVal, 100*fracOff, 0, "%");


timewarp=2;         // time-lapse factor 
setSlider(slider_timewarp, slider_timewarpVal, timewarp, 1, " times");

IDM_a=1.2
setSlider(slider_IDM_a, slider_IDM_aVal, IDM_a, 1, " m/s<sup>2</sup>");



/*######################################################
 Global display settings

 refSizePhys  => reference size in m (generally smaller side of canvas)
 refSizePix   => reference size in pixel (generally smaller side of canvas)
                 (will be set by the simulation)
 scale = refSizePix/refSizePhys 
              => roads have full canvas regardless of canvas size

Notes:

  (1) refSizePix=Math.min(canvas.width, canvas.height) determined during run  

  (2) refSizePhys smaller => vehicles and road widths appear bigger

  (3) Unless refSizePhys is constant during sim,  
  updateDimensions needs to re-define  
  the complete infrastructure geometry at every change

  (4) canvas has strange initialization of width=300 in firefox 
  and DOS when try sizing in css (see there) only: 
  document.getElementById("contents").clientWidth; .clientHeight;
  always works!
######################################################*/

var refSizePhys=250;              // height screen in m

var simDivWindow=document.getElementById("contents");
var canvas = document.getElementById("canvas"); 
var ctx = canvas.getContext("2d"); // graphics context
canvas.width  = simDivWindow.clientWidth; 
canvas.height  = simDivWindow.clientHeight;

addTouchListeners(); // clicking can be replaced by tapping.
                     // dragging on touchscreens somehow does not work 


// init overall scaling 

var isSmartphone=mqSmartphone();  // from css; only influences text size


// these two must be updated in updateDimensions (aspectRatio != const)

var refSizePix=canvas.height;     // corresponds to pixel size of smaller side
var scale=refSizePix/refSizePhys; // global scale


var aspectRatio=canvas.width/canvas.height;

var hasChanged=true;              // window dimensions have changed



function updateDimensions(){ // if viewport->canvas changed

  // canvas always slightly landscape; only sliders etc change responsively
  
  refSizePix=canvas.height;     // corresponds to pixel size of smaller side
  scale=refSizePix/refSizePhys;
  
  if(true){
    console.log("updateDimensions: canvas.width=",canvas.width,
		" canvas.height=",canvas.height,
		" aspectRatio=",aspectRatio.toFixed(2),
		" isSmartphone=",isSmartphone,
		" ");
  }
}



//##################################################################
//<NETWORK> Specification of physical road network and vehicle geometry
//##################################################################


// specification of lane width and vehicle sizes

var laneWidth=5; 
var car_length=6;    // car length in m (all a bit oversize for visualisation)
var car_width=3;     // car width in m
var truck_length=11;
var truck_width=4; 


// road axis geometry and number of lanes
// xPhys=0: left, xPhys=refSizePhys*aspectRatio: right
// yPhys=0: top, yPhys=-refSizePhys: bottom


var xmin_main=0.01*refSizePhys*aspectRatio;   
var xmax_main=0.99*refSizePhys*aspectRatio;   
var xon=0.2*refSizePhys*aspectRatio;   
var xoff=0.8*refSizePhys*aspectRatio;
var len_weave=xoff-xon;  // mainroad horizontally straight
var y_main=-0.5*refSizePhys;
var radius=0.25*refSizePhys;

// road[0]: mainroad, before weaving section
// road[1]: mainroad, weaving section
// road[2]: mainroad, after weaving section
// road[3]: onramp before merge/weaving
// road[4]: offramp after merge/weaving


var len_road0=xon-xmin_main;
var len_road1=len_weave;
var len_road2=xmax_main-xoff;
var len_road3=len_road0;
var len_road4=len_road2;


var roadLen=[len_road0,len_road1,len_road2,len_road3,len_road4];

var nLanes=[2,3,2,1,1];



// def trajectories 
// !! cannot define diretly function trajNet_x[0](u){ .. } etc

function traj0_x(u){ // physical coordinates
  return xmin_main+u;
}
function traj0_y(u){ 
  return y_main;
}

function traj1_x(u){ // physical coordinates
  return xon+u;
}
function traj1_y(u){ 
  return y_main-0.5*laneWidth*(nLanes[1]-nLanes[0]);
}

function traj2_x(u){ // physical coordinates
  return xoff+u;
}
function traj2_y(u){ 
  return y_main;
}

function traj3_x(u){ 
  return xon+radius*Math.sin((u-roadLen[3])/radius);
}

function traj3_y(u){
  var yMerge=y_main-0.5*laneWidth*(nLanes[0]+nLanes[3]);
  return yMerge-radius*(1-Math.cos((u-roadLen[3])/radius));
}
  
function traj4_x(u){ 
  return xoff+radius*Math.sin(u/radius);
}

function traj4_y(u){
  var yDiverge=y_main-0.5*laneWidth*(nLanes[2]+nLanes[4]);
  return yDiverge-radius*(1-Math.cos(u/radius));
}
  

 
var trajNet=[[traj0_x,traj0_y], [traj1_x,traj1_y], [traj2_x,traj2_y],
	     [traj3_x,traj3_y], [traj4_x,traj4_y]];




//##################################################################
// Specification of logical road network and constructing the roads
//##################################################################


// road network (network declared in canvas_gui.js)

var isRing=false;

for(var ir=0; ir<nLanes.length; ir++){
  network[ir]=new road(ir,roadLen[ir], laneWidth, nLanes[ir],
		       trajNet[ir], density, speedInit, fracTruck, isRing);
}

// set tactical lane changes and decelerations for the connectors (nodes)
// where tactical behaviour and/or drawing tapers (this.drawTaperRampConnect)
// is required

// initConnect(targetRoads, uSources, offsetLanes, LCbiasIndices)

// offsetLane = laneIndexTarget-laneIndexSource for through lanes
// LCbiasIndex in {-1=left,0=neutral,1=right}
// for lanes to be closed, LCbias is set automatically if LCbiasIndex=0
// not all connectors need tactical info, e.g. not needed for network[11]

var duTactical=200; // anticipation distance for offramps

// preemptive LC to the right for route 014


network[0].duTactical=duTactical;
network[0].initConnect([network[4]],
		       [network[0].roadLen+network[1].roadLen],
		       [nLanes[4]-nLanes[0]],[1]); // offset=0 but general bias to right


// LC bias for the weaving (the offset info sets the bias automatically
// if LCbiasIndex=0

network[1].duTactical=duTactical;
network[1].initConnect([network[2],network[4]],
		       [network[1].roadLen,network[1].roadLen],
		       [0,nLanes[4]-nLanes[1]],[0,1]);

// routes

var route0_0=[0,1,2];  // mainroad straight ahead
var route0_1=[0,1,4];  // mainroad, diverge to road 2
var route3=[3,1,2];
var routes_source0=[route0_0,route0_1];
var routesFrac_source0=[1-fracOff,fracOff]; // must be of same length,
//!! must be updated at updateSim

function getRoute(routes, routesFrac){
  var rnd=Math.random();
  var routeIndex=0;
  var fracSum=routesFrac[0];
  while((rnd>fracSum)&&(routeIndex<routesFrac.length-1)){
    fracSum+=routesFrac[routeIndex];
    routeIndex++;
  }
  //console.log("getRoute: route=",routes[routeIndex]);
  return routes[routeIndex];
}


for(var ir=0; ir<network.length; ir++){
  network[ir].setDriverVariation(driver_varcoeff);
  network[ir].drawVehIDs=drawVehIDs;
}


// add standing virtual vehicles at the end of links and onramps
// where lanes are blocked for all routes 
// unshift: add elem at i=0; shift: remove at i=0; push: add at end

// ! now no longer needed, (!!! not even at onramp, why?)

/*
// vehicle(length, width, u, lane, speed, type)
network[0].veh.unshift(
  new vehicle(0.01,laneWidth,network[0].roadLen,nLanes[0]-1,0, "obstacle"));
network[3].veh.unshift(
  new vehicle(0.01,laneWidth,network[0].roadLen,nLanes[0]-1,0, "obstacle"));
network[3].veh.unshift(
  new vehicle(0.01,laneWidth,network[0].roadLen,0,0, "obstacle"));

for(var il=0; il<nLanes[9]; il++){
  network[9].veh.unshift(
    new vehicle(0.01,laneWidth,network[9].roadLen,il,0, "obstacle"));
}
*/


var detectors=[]; // stationaryDetector(road,uRel,integrInterval_s)
//detectors[0]=new stationaryDetector(network[0], 0.40*network[0].roadLen,10);


//</NETWORK>


//#########################################################
// model initialization
//#########################################################

// constructs/updates a series of standard models
// longModelCar,-Truck,LCModelCar,-Truck,-Mandatory
// as defined in control_gui.js, possibly with overridden model parameters
// if defined so in "global parameter settings/initialisations" above

updateModels(); 


//####################################################################
// Global graphics specification
//####################################################################


var drawBackground=true; // if false, default unicolor background
var drawRoad=true;       // if false, only vehicles are drawn
var vmin_col=0;          // for the speed-dependent color-coding of vehicles
var vmax_col=0.7*IDM_v0;


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

// init road images for 1 to 4 lanes

roadImg1Lane = []; // template road image with lane separating line
roadImg2Lane = []; // road without lane separating line

for (var i=0; i<7; i++){
    roadImg1Lane[i]=new Image();
    roadImg1Lane[i].src="figs/road"+(i+1)+"lanesCropWith.png"
    roadImg2Lane[i]=new Image();
    roadImg2Lane[i].src="figs/road"+(i+1)+"lanesCropWithout.png"
}

var roadImg1= []; // network road with lane separating line
var roadImg2= []; // network road w/o lane separating line

for(var ir=0; ir<network.length; ir++){
  roadImg1[ir] = new Image(); roadImg1[ir]=roadImg1Lane[nLanes[ir]-1];
  roadImg2[ir] = new Image(); roadImg2[ir]=roadImg2Lane[nLanes[ir]-1];
}


//############################################
// traffic objects and traffic-light control editor
//############################################

// TrafficObjects(canvas,nTL,nLimit,xRelDepot,yRelDepot,nRow,nCol)
var trafficObjs=new TrafficObjects(canvas,1,3,0.50,0.80,2,3);



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
  //console.log("entering updateSim: time=",time," hasChanged=",hasChanged);
  hasChanged=false;
  
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
  }
 
  // updateSim: Test code at the end, point (5)


  // (2) transfer effects from slider interaction and mandatory regions
  // to the vehicles and models
  // longModelCar etc defined in control_gui.js
  // also update user-dragged movable speed limits

  routesFrac_source0=[1-fracOff,fracOff]; // response to slider change fracOff
  
  for(var ir=0; ir<network.length; ir++){
    network[ir].updateTruckFrac(fracTruck, fracTruckToleratedMismatch);
    network[ir].updateModelsOfAllVehicles(longModelCar,longModelTruck,
					 LCModelCar,LCModelTruck,
					 LCModelMandatory);
    network[ir].updateSpeedlimits(trafficObjs);
  }

    // (2a) Without this zoomback cmd, everything works but depot vehicles
  // just stay where they have been dropped outside of a road
  // (here more responsive than in drawSim)

  if(userCanDropObjects&&(!isSmartphone)&&(!trafficObjPicked)){
    trafficObjs.zoomBack(); // here more responsive than in drawSim
  }



  // updateSim (3): do central simulation update of vehicles
  // one action at a time for all network elements for parallel update
  // first accelerations,
  // then networking (updateBCup, connect/mergeDiverge, updateBCdown),
  // then motions in x (speed, pos based on accel) and y (LC)
  // !! motions at the end because connect may override some accelerations


  // (3a) accelerations
  
  for(var ir=0; ir<network.length; ir++){network[ir].calcAccelerations();}

  

  // (3b) upstream/inflow BCup (getRoute:  routes according to OD matrix)

  var route0=getRoute(routes_source0, routesFrac_source0);
  // var route3=[3,1,2]; defined at the beginning outside of updateSim
  network[0].updateBCup(qIn,dt,route0); // qIn=qTot, route is optional arg
  network[3].updateBCup(qOn,dt,route3); 

  

  // (3c) connecting links ends
  // road.connect(target, uSource, uTarget, offsetLane, conflicts,
  //              opt_vmax, opt_targetPrio)

  network[0].connect(network[1],network[0].roadLen,0,0,[]);
  network[1].connect(network[2],network[1].roadLen,0,0,[]);
  network[1].connect(network[4],network[1].roadLen,0,nLanes[4]-nLanes[1],[]);
  network[3].connect(network[1],network[3].roadLen,0,nLanes[1]-nLanes[3],[]);


  // (3d) merges and diverges (none here)


  // (3e) downstream BC
  
  network[1].updateBCdown(); // remove erring vehicles
  network[2].updateBCdown(); 
  network[3].updateBCdown(); // remove erring vehicles
  network[4].updateBCdown(); 

  
  // (3f) actual motion (always at the end)

  for(var ir=0; ir<network.length; ir++){network[ir].updateLastLCtimes(dt);} 
  for(var ir=0; ir<network.length; ir++){network[ir].changeLanes();} 
  for(var ir=0; ir<network.length; ir++){network[ir].updateSpeedPositions();} 

   

    // updateSim (4): update detector readings

  for(var iDet=0; iDet<detectors.length; iDet++){
    detectors[iDet].update(time,dt);
  }

  
  // updateSim (5): test code/debug output

  if(true){
  //if((time>35)&&(time<38.0)){
    debugVeh(540,network);
  }

  
  if(debug){crashinfo.checkForCrashes(network);} //!! deact for production

  
  // template for dropping traffic lights: onramp.js
  // template for dropping speedL: test7_severalOnrampsOfframpsConnects.js
 
  // drop speed limits here
  
  if(false){

    // select two speedlimits from the trafficObjects
    
    var speedL1;
    var speedL2;
    for(var iobj=0; iobj<trafficObjs.trafficObj.length; iobj++){
      if(trafficObjs.trafficObj[iobj].id==150){// first speed limit
	speedL1=trafficObjs.trafficObj[iobj];
      }
      if(trafficObjs.trafficObj[iobj].id==151){// second speed limit
	speedL2=trafficObjs.trafficObj[iobj];
      }
    }

    // drop speed limit
    // values and graphics controlled by speedlBoxAttr in canvas_gui.js 
    // speedlBoxAttr.limits=[10,20,30,40,50,60,80,100,120,1000]
    
    if(itime==1){
      var udrop1=0.50*network[3].roadLen;
      var udrop2=0.80*network[3].roadLen;
      trafficObjs.setSpeedlimit(speedL1,20); // km/h, rounded to i*10 km/h
      trafficObjs.setSpeedlimit(speedL2,80); // km/h, rounded to i*10 km/h

      trafficObjs.dropObject(speedL1,network,
			     network[3].traj[0](udrop1),
			     network[3].traj[1](udrop1),
			     20,);
      trafficObjs.dropObject(speedL2,network,
			     network[3].traj[0](udrop2),
			     network[3].traj[1](udrop2),
			     20,);
    }
  }



}//updateSim




//##################################################
function drawSim() {
//##################################################

  var movingObserver=false; // relative motion works, only start offset
  var speedObs=2;
  var uObs=speedObs*time;

  // drawSim (1): adapt text size
 
  var relTextsize_vmin=(isSmartphone) ? 0.03 : 0.02;
  var textsize=relTextsize_vmin*Math.min(canvas.width,canvas.height);



  // drawSim (2): reset transform matrix and draw background
  // (only needed if changes, plus "reminders" for lazy browsers)
  // haschanged def/updated here,
  // mousedown/touchdown in canvas_gui objectsZoomBack in TrafficObjects
  
  ctx.setTransform(1,0,0,1,0,0);
  if(drawBackground){
    var objectsMoved=(mousedown ||touchdown ||objectsZoomBack);
    if(hasChanged||objectsMoved||(itime<=10) || (itime%50==0)
       || (!drawRoad) ||drawVehIDs|| movingObserver){
      ctx.drawImage(background,0,0,canvas.width,canvas.height);
    }
  }
  

  // drawSim (3): draw road network
  
   var changedGeometry=(itime<=1); // if no physical change of road lengths


  // purely optical: road.drawTaperRamp(roadImg,  laneIncr, atRight)
  // purely optical: road.drawTaper(roadImg,  laneShift, uStart, vStart)
  // purely optical: road.drawTaperConnect(roadImg, targetNetworkIndex)

  // not needed here because of continuous on-off lane
  // instead, it gives optical artifacts
  
  //network[0].drawTaperRamp(roadImg1[2], -1, true);
  //network[1].drawTaperRamp(roadImg1[0], 1, true);

  
  // road.draw(img1,img2,changedGeometry,
  //           umin,umax,movingObserver,uObs,center_xPhys,center_yPhys)
  //           second arg line optional, only for moving observer

  for(var ir=0; ir<network.length; ir++){ 
    network[ir].draw(roadImg1[ir],roadImg2[ir],changedGeometry);
  }


  // roadIDs drawn in updateSim in separate loop because Xing roads
  // may cover roads drawn before and I alsways want to see the IDs

  if(drawRoadIDs){
    for(var ir=0; ir<network.length; ir++){
      network[ir].drawRoadID();
    }
  }

  
  // drawSim (4): draw vehicles

  // road.drawVehicles(carImg,truckImg,obstImgs,vmin_col,vmax_col,
  //           umin,umax,movingObserver,uObs,center_xPhys,center_yPhys)
  //           second arg line optional, only for moving observer

  for(var ir=0; ir<network.length; ir++){ 
    network[ir].drawVehicles(carImg,truckImg,obstacleImgs,
			vmin_col,vmax_col);
  }


  
  // drawSim (5): draw changeable traffic objects 

  if(userCanDropObjects&&(!isSmartphone)){
    trafficObjs.draw();
  }

  // (5b) draw speedlimit-change select box
  
  ctx.setTransform(1,0,0,1,0,0); 
  drawSpeedlBox(); // draw speedlimit-change select box


  // drawSim (6): show simulation time and detector displays

  displayTime(time,textsize);
  for(var iDet=0; iDet<detectors.length; iDet++){
	detectors[iDet].display(textsize);
  }
  
  // drawSim (7): show logical coordinates if activated

  if(showCoords&&mouseInside){
    showLogicalCoords(xPixUser,yPixUser);
  }

  // drawSim (8): reset/revert variables for the next step

  hasChanged=false; // set true before next drawing if canvas changed
  ctx.setTransform(1,0,0,1,0,0);

} // drawSim

 



//##################################################
// Running function of the sim thread (triggered by setInterval)
//##################################################

function main_loop() {
    updateSim();
    drawSim();
}
 

 //############################################
// start the simulation thread
// THIS function does all the things; everything else 
// only functions/definitions
// triggers:
// (i)  automatically when loading the simulation
//      (all js are loaded/executed, setInterval(.) is last of all)
// (ii) when pressing the start button in *gui.js
//      ("myRun=setInterval(main_loop, 1000/fps);")
//############################################

console.log("first main execution");

var myRun=setInterval(main_loop, 1000/fps);

