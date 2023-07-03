

//#############################################################
// general ui settings
//#############################################################

const userCanDropObjects=true;
var scenarioString="Test4"; // needed in road.changeLanes etc

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

var driver_varcoeff=0.20;



//#############################################################
// global parameter settings/initialisations
// (partly override standard param settings in control_gui.js)
//#############################################################

density=0.001; // defined in control_gui.js
setSlider(slider_density, slider_densityVal, 1000*density, 0, "veh/km");

qIn=1500./3600;
setSlider(slider_qIn, slider_qInVal, 3600*qIn, 0, "veh/h");

fracOff=0.5; /// 0.25
setSlider(slider_fracOff, slider_fracOffVal, 100*fracOff, 0, "%");

fracTruck=0.1; // no slider

// priority settings
var priorityIndex=0; // {0=inner ring has prio, 1=outer ring has prio}
setCombobox("prioritySelect",priorityIndex);
handleChangedPriority(priorityIndex); // sets respectRingPrio=innerRingPrio

timewarp=4;         // time-lapse factor 
commaDigits=1;
setSlider(slider_timewarp, slider_timewarpVal, timewarp, 1, " times");

IDM_a=1.2
setSlider(slider_IDM_a, slider_IDM_aVal, IDM_a, 1, " m/s<sup>2</sup>");

IDM_v0=60/3.6
setSlider(slider_IDM_v0, slider_IDM_v0Val, 3.6*IDM_v0, 0, " km/h");

lenMergeDiverge=100; // if implementation of nodes by merges/diverges



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

var refSizePhys=200;              // reference size in m

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

var laneWidth=4;   // road cstr: boundaryStripWidth=0.3*laneWidth
var car_length=6;    // car length in m (all a bit oversize for visualisation)
var car_width=2.5;     // car width in m
var truck_length=11;
var truck_width=3.5; 


// road axis geometry and number of lanes

var nLanes=[1,1];

var center_xRel=0.36;   // 0: left, 1: right
var center_yRel=-0.5;  // -1: bottom; 0: top
var center_xPhys=center_xRel*refSizePhys*aspectRatio; //[m]
var center_yPhys=center_yRel*refSizePhys;

var radius=0.35*refSizePhys;
var lenStraight=0.20*refSizePhys;
var lenMerge=Math.sqrt(2*radius*laneWidth*(nLanes[1]+0.3));

var lenRing=2*Math.PI*radius;
var lenHalfRing=Math.PI*radius+2*lenStraight;

var roadLen=[lenRing,lenHalfRing];




// def trajectories 
// !! cannot define diretly function trajNet_x[0](u){ .. } etc


// The seven sections of the first main road

function traj0_x(u){ // physical coordinates, stitch at left side
  return center_xPhys+radius*Math.cos(Math.PI+u/radius);
}

function traj0_y(u){ // physical coordinates
  return center_yPhys+radius*Math.sin(Math.PI+u/radius);
}


function traj1_x(u){ 
  return (u<lenStraight)
    ? center_xPhys+u : (u<lenHalfRing-lenStraight)
    ? center_xPhys+lenStraight
    +radius*Math.cos(1.5*Math.PI+(u-lenStraight)/radius)
    : center_xPhys+lenHalfRing-u;
}

function traj1_y(u){ 
  return (u<lenStraight)
    ? center_yPhys-radius : (u<lenHalfRing-lenStraight)
    ? center_yPhys+radius*Math.sin(1.5*Math.PI+(u-lenStraight)/radius)
    : center_yPhys+radius;
}



var trajNet=[[traj0_x,traj0_y], [traj1_x,traj1_y]];


//##################################################################
// Specification of logical road network and constructing the roads
//##################################################################


var duTactical=100; // anticipation distance for offramps

// road network (network declared in canvas_gui.js)

// !! set isRing=false (last arg of new road(..)
// also in ring road because ramps interfere with density control

network[0]=new road(0, roadLen[0], laneWidth, nLanes[0], trajNet[0],
		      density,IDM_v0,fracTruck, false); //!!!
network[1]=new road(1, roadLen[1], laneWidth, nLanes[1], trajNet[1],
		    0,IDM_v0,fracTruck,false);

var useConnect=true;  //!!! if false, nodes implemented via merges/diverges

//!!! needed for lane change (why not in test7? probably needed there as well)

if(!useConnect){
  network[1].veh.unshift(
    new vehicle(0.5,laneWidth,network[1].roadLen-5,nLanes[0]-1,0,
		"obstacle"));
}


// define routes and set them to the roads
// (a more general stochastic selection
// in test7_severalOnrampsOfframpsConnects)

var route0=[0];      // just around the ring
var route1=[0,1,0];  // use also the second ring segment
var routes=[route0,route1];

function getRoute(routes,fracOff){
  var rnd=Math.random();
  return (rnd<1-fracOff) ? routes[0] : routes[1];
}

for(var ir=0; ir<network.length; ir++){
  for(var i=0; i<network[ir].veh.length; i++){
    if(network[ir].veh[i].isRegularVeh()){
      network[ir].veh[i].route=getRoute(routes,fracOff);
    }
  }
}

// set other road and driver attributes not set at constructor

for(var ir=0; ir<network.length; ir++){
  network[ir].setDriverVariation(driver_varcoeff);
  network[ir].drawVehIDs=drawVehIDs;
}

// add special trajectories for turns/merges etc
// then corresponding road drawn if road.drawAlternativeTrajectories=true
// and corresponding vehicles if their route contains the trajAlt roadID elem

network[0].trajAlt[0]={x: function(u){
  return traj1_x(u-0.75*network[0].roadLen+network[1].roadLen);},
		       y: function(u){
  return traj1_y(u-0.75*network[0].roadLen+network[1].roadLen);},
		       roadID: 1,
		       umin: 0.75*roadLen[0]-lenMerge,
		       umax:0.75*roadLen[0]
		      };

// test implementation of the nodes by merges and diverges
// road.initMergeDiverge([targetRoads],[isMerge],
//                       [mergeDivergeLen], [uLast], [toRight]);

network[0].duTactical=duTactical;
network[0].initMergeDiverge([network[1]], [false],[lenMergeDiverge],
			    [0.25*roadLen[0]+lenMergeDiverge], [true]);

// test implementation of the nodes by connectors

// initConnect(targetRoads, uSource, offsetLane, LCbiasIndex)
// LCbiasIndex in {-1=left,0=neutral,1=right}
// for lanes to be closed, LCbias is set automatically if LCbiasIndex=0
// not all connectors need tactical info, e.g. not needed for network[11]

network[0].initConnect([network[1]],[0.25*roadLen[0]],[0], [0]);
network[1].initConnect([network[0]],[roadLen[1]-lenMerge],[0], [0]);

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
var trafficObjs=new TrafficObjects(canvas,2,3,0.40,0.50,3,2);



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

  for(var ir=0; ir<network.length; ir++){
    network[ir].updateTruckFrac(fracTruck, fracTruckToleratedMismatch);
    network[ir].updateModelsOfAllVehicles(longModelCar,longModelTruck,
					 LCModelCar,LCModelTruck,
					 LCModelMandatory);
    network[ir].updateSpeedlimits(trafficObjs);
  }

  //!!! DO NOT USE with several roads
  // nasty effects by interacting merges/diverges and density corr.

  //network[0].updateDensity(density); 
  
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

  

  // (3b) upstream/inflow BC BCup
  
  network[0].updateBCup(qIn,dt,getRoute(routes,fracOff)); 

  
  // (3c) connecting links ends
  // road.connect(target, uSource, uTarget, offsetLane, conflicts,
  //              opt_vmax, opt_targetPrio)


  if(useConnect){
    network[0].connect(network[1],
		       0.25*network[0].roadLen, 0, 0, []);
    network[1].connect(network[0], // road after roadLen-lenMerge just optical
		       network[1].roadLen-lenMerge,
		       0.75*network[0].roadLen-lenMerge, 0, [],
		       0.8*IDM_v0, respectRingPrio);
  }

  
  // (3d) merges and diverges
  // road.mergeDiverge(newRoad,offset,uStart,uEnd,isMerge,toRight,
  //                   opt_ignoreRoute, opt_prioOther, opt_prioOwn)
  
  if(!useConnect){
  
    network[0].mergeDiverge(network[1],
			    -0.25*network[0].roadLen,0.25*network[0].roadLen,
			    0.25*network[0].roadLen+lenMergeDiverge,
			    false, true);
    network[1].mergeDiverge(network[0],
			    0.75*network[0].roadLen-network[1].roadLen,
			    network[1].roadLen-lenMergeDiverge,
			    network[1].roadLen,
			    true, false,
			    true,respectRingPrio,!respectRingPrio);
  }
 
  // (3e) downstream BC

  network[0].updateBCdown();

  
  // (3f) actual motion (always at the end)

  for(var ir=0; ir<network.length; ir++){network[ir].updateLastLCtimes(dt);} 
  for(var ir=0; ir<network.length; ir++){network[ir].changeLanes();} 
  for(var ir=0; ir<network.length; ir++){network[ir].updateSpeedPositions();} 

   

    // updateSim (4): update detector readings

  for(var iDet=0; iDet<detectors.length; iDet++){
    detectors[iDet].update(time,dt);
  }

  
  // updateSim (5): test code/debug output

  if(false){
    console.log(
      "radius=",radius.toFixed(2),
      "lenStraight=",lenStraight.toFixed(2),
      "lenHalfRing=",lenHalfRing.toFixed(2),
      "traj1_x(0)=",traj1_x(0).toFixed(2),
      "traj1_x(0.5*lenHalfRing)=",traj1_x(0.5*lenHalfRing).toFixed(2),
      "traj1_x(lenHalfRing)=",traj1_x(lenHalfRing).toFixed(2),
      "");
  }

  if(false){
    network[0].writeVehicleRoutes();
    network[1].writeVehicleRoutes();
  }
  
  
 //if(false){
  if((time>85)&&(time<96)){
    debugVeh(216,network);
   // debugVeh(205,network);
  }

  
  if(debug){crashinfo.checkForCrashes(network);} //!! deact for production

  
  // template for dropping traffic lights: onramp.js
  // template for dropping speedL: test7_severalOnrampsOfframpsConnects.js



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

 
  // road.draw(img1,img2,changedGeometry,
  //           umin,umax,movingObserver,uObs,center_xPhys,center_yPhys)
  //           second arg line optional, only for moving observer

  for(var ir=0; ir<network.length; ir++){ 
    network[ir].draw(roadImg1[ir],roadImg2[ir],changedGeometry);
  }

  // roadIDs drawn in updateSim in separate loop because Xing roads
  // may cover roads drawn before and I always want to see the IDs

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

