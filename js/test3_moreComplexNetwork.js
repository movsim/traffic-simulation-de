

//#############################################################
// general ui settings
//#############################################################

const userCanDropObjects=true;
var scenarioString="Test3"; // needed in road.changeLanes etc

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

density=0.0;         // nonzero value only sensible for ring or simple sims
fracTruck=0.1;

qIn=2000./3600;      // main flow [veh/h] controlled by GUI
var qOn=500./3600;    // inflow to link 9 (onramp)
var q2=1000./3600;  // inflow to link 11 (second mainroad)

commaDigits=0;
setSlider(slider_qIn, slider_qInVal, 3600*qIn, commaDigits, "veh/h");
setSlider(slider_qOn, slider_qInVal, 3600*qOn, commaDigits, "veh/h");
setSlider(slider_q2, slider_qInVal, 3600*q2, commaDigits, "veh/h");

timewarp=4;         // time-lapse factor 
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

var refSizePhys=420;              // reference size in m

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

var center_xRel=0.5;   // 0: left, 1: right
var center_yRel=-0.65;  // -1: bottom; 0: top
var center_xPhys=center_xRel*refSizePhys*aspectRatio; //[m]
var center_yPhys=center_yRel*refSizePhys;

var radius=0.1*refSizePhys;
var radiusBig=0.2*refSizePhys;
var lenStraight=0.50*refSizePhys*aspectRatio-1.5*radius;

var lenOnramp=1.00*lenStraight;
var lenOfframp=0.70*lenStraight;

var roadLen=[lenStraight,lenStraight,Math.PI*radius,
	     lenStraight,lenStraight,Math.PI*radius,
	     1.5*lenStraight, 0.5*lenStraight, 0.5*lenStraight,
	     lenOnramp, lenOfframp, 0.5*lenStraight];

var nLanes=[3,3,3,5,3,4,6,3,3,1,1,2];



// def trajectories 
// !! cannot define diretly function trajNet_x[0](u){ .. } etc


// The seven sections of the first main road

function traj0_x(u){ // physical coordinates
  return center_xPhys+u-lenStraight;
}

function traj0_y(u){ 
  return center_yPhys-2*radius;
}

function traj1_x(u){ 
  return center_xPhys+u;
}

function traj1_y(u){ 
  return center_yPhys-2*radius+laneWidth; // +laneWidth because offsetLane=+1
}

function traj2_x(u){ 
  return traj1_x(roadLen[1])+radius*Math.sin(u/radius);
}
function traj2_y(u){ 
  return traj1_y(roadLen[1])+radius*(1-Math.cos(u/radius));
}

function traj3_x(u){ 
  return traj1_x(roadLen[1]-u);
}
function traj3_y(u){ 
  return traj1_y(roadLen[1])+2*radius;
}

function traj4_x(u){ 
  return traj0_x(roadLen[0]-u);
}
function traj4_y(u){ 
  return traj3_y(roadLen[3]);
}

function traj5_x(u){ 
  return traj4_x(roadLen[4])-radius*Math.sin(u/radius);
}
function traj5_y(u){ 
  return traj4_y(roadLen[4])+0.5*laneWidth+radius*(1-Math.cos(u/radius));
}

function traj6_x(u){ 
  return traj5_x(roadLen[5])+u;
}
function traj6_y(u){ 
  return traj5_y(roadLen[5])+0.5*laneWidth*(nLanes[6]-nLanes[5]);
}

// final diverging down

function traj7_x(u){ 
  return traj6_x(roadLen[6])+radiusBig*Math.sin(u/radiusBig);
}
function traj7_y(u){ 
  return traj6_y(roadLen[6])-0.25*laneWidth*nLanes[6]
    -radiusBig*(1-Math.cos(u/radiusBig));
}

// final diverging up

function traj8_x(u){ 
  return traj7_x(u);
}
function traj8_y(u){ 
  return traj6_y(roadLen[6])+0.25*laneWidth*nLanes[6]
    +radiusBig*(1-Math.cos(u/radiusBig));
}

// 1-lane onramp to road 6 from above
// and 1-lane offramp from road 6 to below

var lenMergeDiverge=0.2*roadLen[6];
var u6_beginMerge=0.4*roadLen[6];   // begin merging at target coord
var u6_beginDiverge=0.5*roadLen[6]; // begin diverging at source road
var u9_beginMerge=roadLen[9]-lenMergeDiverge; 
var x9_beginMerge=traj6_x(u6_beginMerge);
var y9_beginMerge=traj6_y(u6_beginMerge)+0.5*(nLanes[6]+nLanes[9])*laneWidth;
var x10_beginDiverge=traj6_x(u6_beginDiverge);
var y10_beginDiverge=traj6_y(u6_beginDiverge)
    -0.5*(nLanes[6]+nLanes[10])*laneWidth;

function traj9_x(u){
  return (u>u9_beginMerge)
    ? x9_beginMerge+u-u9_beginMerge
    : x9_beginMerge+radiusBig*Math.sin((u-u9_beginMerge)/radiusBig);
}
function traj9_y(u){
  return (u>u9_beginMerge)
    ? y9_beginMerge
    : y9_beginMerge+radiusBig*(1-Math.cos((u-u9_beginMerge)/radiusBig));
}

function traj10_x(u){
  return (u<lenMergeDiverge)
    ? x10_beginDiverge+u
    : x10_beginDiverge+lenMergeDiverge
    +radiusBig*Math.sin((u-lenMergeDiverge)/radiusBig);
}
function traj10_y(u){
  return (u<lenMergeDiverge)
    ? y10_beginDiverge
    : y10_beginDiverge-radiusBig*(1-Math.cos((u-lenMergeDiverge)/radiusBig));
}

// second mainroad

function traj11_x(u){ 
  return traj6_x(0)+u-roadLen[11];
}
function traj11_y(u){ 
  return traj6_y(10)+0.5*laneWidth*(nLanes[6]-nLanes[11]);
}


var trajNet=[[traj0_x,traj0_y], [traj1_x,traj1_y], [traj2_x,traj2_y],
	     [traj3_x,traj3_y], [traj4_x,traj4_y], [traj5_x,traj5_y],
	     [traj6_x,traj6_y], [traj7_x,traj7_y], [traj8_x,traj8_y],
	     [traj9_x,traj9_y], [traj10_x,traj10_y], [traj11_x,traj11_y]
	    ]; 



//##################################################################
// Specification of logical road network and constructing the roads
//##################################################################

// 7 mainroad links ir=0..6, 2 diverge links at the end ir=7,8
// onramp from above ir=9, offramp to below ir=10, second mainroad ir=11

// connections from road 0 to road 7 laneindex(ir-1)->laneindex(ir)
var offsetLane=[0,1,0,1,-1,0,2,-3]; // laneindex(ir+1)-laneindex(ir)
fracTruckToleratedMismatch=1.0; // 1=100% allowed=>changes only by sources
speedInit=20;

var duTactical=200; // anticipation distance for offramps

// road network (network declared in canvas_gui.js)

var isRing=false;

for(var ir=0; ir<nLanes.length; ir++){
  network[ir]=new road(ir,roadLen[ir],laneWidth,nLanes[ir],
		       trajNet[ir], density, speedInit,fracTruck, isRing);
}

// set tactical information for the ramps
// to implement tactical behaviour and/or drawing tapers
// (this.drawTaperRamp)
// road.initMergeDiverge([targetRoads],[isMerge],
//                       [mergeDivergeLen], [uLast], [toRight]);

network[6].duTactical=duTactical;
network[6].initMergeDiverge([network[10]], [false],[lenMergeDiverge],
			    [u6_beginDiverge+lenMergeDiverge], [true]);


// set tactical lane changes and decelerations for the connectors (nodes)
// where tactical behaviour and/or drawing tapers (this.drawTaperRampConnect)
// is required
// initConnect(targetRoads, uSource, offsetLane, LCbiasIndex)
// LCbiasIndex in {-1=left,0=neutral,1=right}
// for lanes to be closed, LCbias is set automatically if LCbiasIndex=0
// not all connectors need tactical info, e.g. not needed for network[11]

network[0].initConnect([network[1]],[network[0].roadLen],[offsetLane[1]],[0]);
network[2].initConnect([network[3]],[network[2].roadLen],[offsetLane[3]],[0]);
network[3].initConnect([network[4]],[network[3].roadLen],[offsetLane[4]],[0]);
network[4].initConnect([network[5]],[network[4].roadLen],[offsetLane[5]],[0]);
network[6].initConnect([network[7],network[8]],
		       [network[6].roadLen, network[6].roadLen],
		       [offsetLane[7],0], [0,0]);



// routes

var route0_0=[0,1,2,3,4,5,6,7];  // mainroad, diverge down at the end
var route0_1=[0,1,2,3,4,5,6,8];  // mainroad, diverge up at the end
var route0_2=[0,1,2,3,4,5,6,10]; // mainroad, then offramp 10
var route9_0=[9,6,8];            // onramp, up at the end
var route9_1=[9,6,7];            // onramp, down at the end
var route11_0=[11,6,8];          // second mainroad, up at the end
var route11_1=[11,6,7];          // second mainroad, down at the end
var routes_source0=[route0_0,route0_1,route0_2];
var routes_source9=[route9_0,route9_1];
var routes_source11=[route11_0,route11_1];
var routesFrac_source0=[0.4,0.4,0.3]; // must be of same length

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
  var route9=getRoute(routes_source9, [0.9,0.1]);  // [fracUp,fracDown]
  var route11=getRoute(routes_source11, [0.5,0.5]);  // [fracUp,fracDown]
  network[0].updateBCup(qIn,dt,route0); // qIn=qTot, route is optional arg
  network[9].updateBCup(qOn,dt,route9); 
  network[11].updateBCup(q2,dt,route11);

  
  // (3c) connecting links ends
  // road.connect(target, uSource, uTarget, offsetLane, conflicts,
  //              opt_vmax, opt_targetPrio)

  // mainroad 1 linear
  for(var ir=0; ir<6; ir++){
    network[ir].connect(network[ir+1],network[ir].roadLen,0,
			offsetLane[ir+1],[]);
  }
  // mainroad 1 fork
  network[6].connect(network[7],network[6].roadLen,0,offsetLane[7],[]);
  network[6].connect(network[8],network[6].roadLen,0,0,[]); // offsetLane=0

  // connect mainroad 2 -> mainroad 1
  network[11].connect(network[6],network[11].roadLen,0,0,[]);
  

  
  // (3d) merges and diverges
  // road.mergeDiverge(newRoad,offset,uStart,uEnd,isMerge,toRight,
  //                   opt_ignoreRoute, opt_prioOther, opt_prioOwn)
  
  // onramp (for multilane-onramp set tactical lane changes via
  // source.setLCModelsInRange(.))
  
  network[9].mergeDiverge(
    network[6], u6_beginMerge-u9_beginMerge,
    network[9].roadLen-lenMergeDiverge, network[9].roadLen, true, true);

  // offramp (tactical LCs are set in road.updateModelsOfAllVehicles

  network[6].mergeDiverge(
    network[10], 0-u6_beginDiverge,
    u6_beginDiverge,u6_beginDiverge+lenMergeDiverge, false, true);

  
  // (3e) downstream BC
  
  network[6].updateBCdown(); // remove erring vehicles
  network[7].updateBCdown(); 
  network[8].updateBCdown(); 
  network[10].updateBCdown(); 

  
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
  //if((time>35)&&(time<38.0)){
    debugVeh(204,network);
    debugVeh(205,network);
  }

  
  if(debug){crashinfo.checkForCrashes(network);} //!! deact for production

  
  // template for dropping traffic lights: onramp.js
  // template for dropping speedL: test7_severalOnrampsOfframpsConnects.js
 
  // drop speed limits here
  
  if(true){

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

  network[9].drawTaperRamp(roadImg1[9], -1, false);
  network[10].drawTaperRamp(roadImg1[10], 1, true);

  network[0].drawTaperConnect(roadImg1[10], 1);
  network[2].drawTaperConnect(roadImg1[10], 3);
  network[3].drawTaperConnect(roadImg1[10], 4);
  network[4].drawTaperConnect(roadImg1[10], 5);

  
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

