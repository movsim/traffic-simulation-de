
const userCanDropObjects=true;
var drawVehIDs=true; // debug: draw veh IDs for selected roads
var drawRoadIDs=true; // debug: draw veh IDs for selected roads
var showCoords=true;  // show logical coords of nearest road to mouse pointer
                  // definition => showLogicalCoords(.) in canvas_gui.js




//#############################################################
// adapt/override standard param settings from control_gui.js
//#############################################################

// slider-controlled vars definined in control_gui.js

qIn=300./3600; // inflow to both directional main roads
q2=0./3600;   // inflow to secondary (subordinate) roads
fracRight=1.; // fracRight [0-1] of drivers on road 2 turn right
fracLeft=0.; // rest of q2-drivers cross straight ahead

IDM_v0=15;
IDM_a=2.0;
timewarp=1.5;
var mainroadLen=200;              // reference size in m
var nLanes_main=3;
var nLanes_sec=2;

commaDigits=0;

setSlider(slider_qIn, slider_qInVal, 3600*qIn, commaDigits, "veh/h");
setSlider(slider_q2, slider_q2Val, 3600*q2, commaDigits, "veh/h");
setSlider(slider_IDM_v0, slider_IDM_v0Val, 3.6*IDM_v0, 0, "km/h");
setSlider(slider_IDM_a, slider_IDM_aVal, IDM_a, 1, "m/s<sup>2</sup>");
setSlider(slider_timewarp, slider_timewarpVal, timewarp, 1, " times");
setSlider(slider_fracRight, slider_fracRightVal, 100*fracRight, 0, " %");
setSlider(slider_fracLeft, slider_fracLeftVal, 100*fracLeft, 0, " %");

fracTruck=0.;

/*######################################################
 Global overall scenario settings and graphics objects
  NOTICE: canvas has strange initialization of width=300 in firefox 
  and DOS when try sizing in css (see there) only => always works following:
  document.getElementById("contents").clientWidth; .clientHeight;
######################################################*/


console.log("\n\nstart main: test1_straight");

var simDivWindow=document.getElementById("contents");
var canvas = document.getElementById("canvas"); 
var ctx = canvas.getContext("2d"); // graphics context
canvas.width  = simDivWindow.clientWidth; 
canvas.height  = simDivWindow.clientHeight;

console.log("before addTouchListeners()");
addTouchListeners();
console.log("after addTouchListeners()");


// init overall scaling 

var refSizePhys=1.05*mainroadLen*canvas.height/canvas.width;
var isSmartphone=mqSmartphone();  // from css; only influences text size


// these two must be updated in updateDimensions (aspectRatio != const)

var refSizePix=canvas.height;     // corresponds to pixel size of smaller side
var scale=refSizePix/refSizePhys; // global scale


var aspectRatio=canvas.width/canvas.height;

var hasChanged=true;              // window dimensions have changed

// (hasChangedPhys=true only legacy for main scenarios)


function updateDimensions(){ // if viewport->canvas or sizePhys changed

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

roadImgWith_lane = []; // road with lane separating line
roadImgWithout_lane = []; // road without lane separating line

for (var i=0; i<4; i++){
  roadImgWith_lane[i]=new Image();
  roadImgWith_lane[i].src="figs/road"+(i+1)+"lanesCropWith.png";
  roadImgWithout_lane[i]=new Image();
  roadImgWithout_lane[i].src="figs/road"+(i+1)+"lanesCropWithout.png";
}



//##################################################################
//<NETWORK>
// Specification of physical road network and vehicle geometry
// If viewport or refSizePhys changes => updateDimensions();
//##################################################################

// all relative "Rel" settings with respect to refSizePhys, not refSizePix!


var center_xRel=0.50;   // 0: left, 1: right
var center_yRel=-0.50;  // -1: bottom; 0: top
var center_xPhys=center_xRel*refSizePhys*aspectRatio; //[m]
var center_yPhys=center_yRel*refSizePhys;

// specification of lane width and vehicle sizes

var laneWidth=3.5; 
var car_length=5;    // car length in m (all a bit oversize for visualisation)
var car_width=2.5;     // car width in m
var truck_length=10;
var truck_width=3; 

//#########################################################
// geometry
// (mainroadLen and refSizePhys=smaller edge define global scale)
var turningRadius=2.5*laneWidth;
var offsetMain=0.5*laneWidth*nLanes_main;
var offsetSec=0.5*laneWidth*nLanes_sec;
var offset20Target=(nLanes_main-0.5)*laneWidth;
var offset20Source=(nLanes_sec-0.5)*laneWidth;
var road0Len=mainroadLen; 
var road2Len=0.48*refSizePhys-offset20Target-turningRadius;
var road3Len=0.48*refSizePhys+offset20Target+turningRadius;
var road20len=0.5*Math.PI*turningRadius; // for all right-turn special traj
var u20Source=1.0*road2Len;
var u20Target=0.5*mainroadLen+offset20Source+(1-0.5*Math.PI)*turningRadius;
var u13Source=0.5*mainroadLen-offset20Source-turningRadius;
var u13Target=2*(offset20Target+turningRadius)-road20len;

var road1Len=mainroadLen;
var road4Len=road2Len;
var road5Len=road3Len;
var u41Source=u20Source;
var u41Target=u20Target;
var u05Source=u13Source;
var u05Target=u13Target;

//#########################################################


//#########################################################
// def main trajectories 
//#########################################################

function traj0_x(u){ // physical coordinates
  return center_xPhys+u-0.5*road0Len;
}
function traj0_y(u){ 
  return center_yPhys-offsetMain;
}



function traj1_x(u){ // physical coordinates
  return center_xPhys-(u-0.5*road0Len);
}
function traj1_y(u){ 
  return center_yPhys+offsetMain;
}


function traj2_x(u){ 
  return center_xPhys+offsetSec;
}
function traj2_y(u){ 
  return center_yPhys-offset20Target-turningRadius-road2Len+u;
}


function traj3_x(u){ 
  return center_xPhys+offsetSec;
}
function traj3_y(u){ 
  return center_yPhys-offset20Target-turningRadius+u;
}


function traj4_x(u){ 
  return center_xPhys-offsetSec;
}
function traj4_y(u){ 
  return center_yPhys+offset20Target+turningRadius+road4Len-u;
}


function traj5_x(u){ 
  return center_xPhys-offsetSec;
}
function traj5_y(u){ 
  return center_yPhys+offset20Target+turningRadius-u;
}


var traj=[ [traj0_x,traj0_y], [traj1_x,traj1_y], [traj2_x,traj2_y],
	   [traj3_x,traj3_y], [traj4_x,traj4_y], [traj5_x,traj5_y] ];

//#################################################################
// special trajectories for the right turns on the target roads 0,1,3,5
// routes 20,41,13,05
//#################################################################

function traj0_20x(u){return trajRight_x(u,offset20Target-offsetMain);}


// dr=difference between target road center and center of target lane
// since traj always with resp to road center but I want r with resp to
// single-lane right turn (target since special lane atatched to target)

function trajRight_x(u,dr){ // special coordinate for the route 20 for road 0
  var urel=u-u20Target; // long coord target relative to start of transition

  // center of the arc for the right turn from right to right lane
  
  var x0=center_xPhys+offset20Source+turningRadius;
  var y0=center_yPhys-offset20Target-turningRadius;

  // distance of right target lane to target road axis

  //var dr=offset20Target-offsetMain;

  // case distinction since for veh rotation u-vehLen/2 relevant)

  var x=(urel<0)
      ? x0-(turningRadius+dr)
      : x0-(turningRadius+dr)*Math.cos(urel/turningRadius);

  if(false){
    console.log("traj0_20x: t=",time.toFixed(2),
	      " umin=",road0.trajAlt[0].umin.toFixed(1),
	      " umax=",road0.trajAlt[0].umax.toFixed(1),
	      " u=",u.toFixed(1),
		" urel=",urel," x0=",x0," traj2_x(0)=",traj2_x(0));
  }
  return x;
}

function traj0_20y(u){return trajRight_y(u,offset20Target-offsetMain);}

function trajRight_y(u,dr){ // special coordinate for the route 20 for road 0
  var urel=u-u20Target;
  var y0=center_yPhys-offset20Target-turningRadius;
  var y=(urel<0)
      ? y0+urel
      : y0+(turningRadius+dr)*Math.sin(urel/turningRadius);
  return y;
}
  
function traj1_41x(u){return 2*center_xPhys-traj0_20x(u);}
function traj1_41y(u){return 2*center_yPhys-traj0_20y(u);}

var len20=0.5*Math.PI*turningRadius;

function traj3_13x(u){
  return trajRight_x(len20-u+u20Target+u13Target,offset20Source-offsetSec);
}
function traj3_13y(u){
  return 2*center_yPhys
    -trajRight_y(len20-u+u20Target+u13Target,offset20Source-offsetSec);
}

function traj5_05x(u){return 2*center_xPhys-traj3_13x(u);}
function traj5_05y(u){return 2*center_yPhys-traj3_13y(u);}




// #############################################################3
// road images for the trajectories; 2 images per road/network element
// #############################################################3


// general

var roadImages=[];
for(var ir=0; ir<traj.length; ir++){
  roadImages[ir]=[];
  for(var j=0; j<2; j++){roadImages[ir][j]=new Image();}
}

// specific

var nLanes=[nLanes_main,nLanes_main,
	    nLanes_sec,nLanes_sec,nLanes_sec,nLanes_sec];  

// network not yet defined here!!

for(var ir=0; ir<traj.length; ir++){
  roadImages[ir][0]=roadImgWith_lane[nLanes[ir]-1];
  roadImages[ir][1]=roadImgWithout_lane[nLanes[ir]-1];
}



//##################################################################
// Specification of logical road network: constructing the roads
//##################################################################


var fracTruckToleratedMismatch=1.0; // 1=100% allowed=>changes only by sources
var speedInit=20;
density=0;
var isRing=false;
var roadIDs=[0,1,2,3,4,5];

var route00=[roadIDs[0]];                // mainE-straight
var route05=[roadIDs[0], roadIDs[5]]; // mainE-right
var route03=[roadIDs[0], roadIDs[3]]; // mainE-left
var route11=[roadIDs[1]];                // mainW-straight
var route13=[roadIDs[1], roadIDs[3]]; // mainW-right
var route15=[roadIDs[1], roadIDs[5]]; // mainW-left
var route20=[roadIDs[2], roadIDs[0]];
var route21=[roadIDs[2], roadIDs[1]];
var route23=[roadIDs[2], roadIDs[3]];
var route40=[roadIDs[4], roadIDs[0]];
var route41=[roadIDs[4], roadIDs[1]];
var route45=[roadIDs[4], roadIDs[5]];




// roads
// last opt arg "doGridding" left out (true:user can change road geometry)

var road0=new road(roadIDs[0],road0Len,laneWidth,nLanes_main,
		   traj[0],
		   density, speedInit,fracTruck, isRing);

var road1=new road(roadIDs[1],road1Len,laneWidth,nLanes_main,
		   traj[1],
		   density, speedInit,fracTruck, isRing);

var road2=new road(roadIDs[2],road2Len,laneWidth,nLanes_sec,
		   traj[2],
		   density, speedInit,fracTruck, isRing);

var road3=new road(roadIDs[3],road3Len,laneWidth,nLanes_sec,
		   traj[3],
		   density, speedInit,fracTruck, isRing);

var road4=new road(roadIDs[4],road4Len,laneWidth,nLanes_sec,
		   traj[4],
		   density, speedInit,fracTruck, isRing);

var road5=new road(roadIDs[5],road5Len,laneWidth,nLanes_sec,
		   traj[5],
		   density, speedInit,fracTruck, isRing);


// adding the alternative trajectories ([0]=right turn, [1]=left turn)

road0.trajAlt[0]={x: traj0_20x,
		  y: traj0_20y,
		  route: route20,
		  umin:u20Target,
		  umax:u20Target+len20
		 };
  
road1.trajAlt[0]={x: traj1_41x,
		  y: traj1_41y,
		  route: route41,
		  umin:u41Target,
		  umax:u41Target+len20
		 };
  

road3.trajAlt[0]={x: traj3_13x,
		  y: traj3_13y,
		  route: route41,
		  umin:u13Target,
		  umax:u13Target+len20
		 };
  
road5.trajAlt[0]={x: traj5_05x,
		  y: traj5_05y,
		  route: route05,
		  umin:u05Target,
		  umax:u05Target+len20
		 };
  


// road network (network declared in canvas_gui.js)

network=[road0,road1,road2,road3,road4,road5];

// draw veh IDs on selected links

for(var ir=0; ir<network.length; ir++){
  network[ir].drawVehIDs=drawVehIDs;
  network[ir].drawRoadIDs=drawVehIDs;
}

var conflict0up={roadConflict:network[0], // conflicts by road0 for Northbound
		 uConflict: 0.5*network[0].roadLen+offsetSec,
		 uOwnConflict: turningRadius+offset20Target-offsetMain};
var conflict0down={roadConflict:network[0],
		   uConflict: 0.5*network[0].roadLen-offsetSec,
		   uOwnConflict: turningRadius+offset20Target+offsetMain};
var conflict1up={roadConflict:network[1],
		 uConflict: 0.5*network[0].roadLen-offsetSec,
		 uOwnConflict: turningRadius+offset20Target+offsetMain};
var conflict1down={roadConflict:network[1],
		   uConflict: 0.5*network[0].roadLen+offsetSec,
		   uOwnConflict: turningRadius+offset20Target-offsetMain};

var conflicts05=[];
var conflicts03=[conflict1up];  //!!! change
var conflicts13=[];
var conflicts15=[conflict0down];  //!!! change

var conflicts20=[];
var conflicts21=[conflict0up];
var conflicts23=[conflict0up,conflict1up];

var conflicts40=[conflict1down];
var conflicts41=[];
var conflicts45=[conflict0down,conflict1down];



// add standing virtual vehicles at the end of some road elements
// prepending=unshift (strange name)
// vehicle(length, width, u, lane, speed, type)

//var virtualStandingVeh
//    =new vehicle(2, laneWidth, road0.roadLen-0.5*laneWidth, 1, 0, "obstacle");

//road0.veh.unshift(virtualStandingVeh);


var detectors=[]; // stationaryDetector(road,uRel,integrInterval_s)
//detectors[0]=new stationaryDetector(road0,0.20*road0Len,10);
//detectors[1]=new stationaryDetector(road0,0.80*road0Len,10);



//</NETWORK>


//#########################################################
// model initialization (models and methods defined in control_gui.js)
//#########################################################
	
updateModels(); // defines longModelCar,-Truck,LCModelCar,-Truck,-Mandatory




//############################################
// traffic objects and traffic-light control editor
//############################################

// TrafficObjects(canvas,nTL,nLimit,xRelDepot,yRelDepot,nRow,nCol)
var trafficObjs=new TrafficObjects(canvas,1,3,0.20,0.20,3,2);

// !! Editor not yet finished
// (then args xRelEditor,yRelEditor not relevant unless editor shown)
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

  //console.log("time=",time.toFixed(2));
  //if((time>76)&&(time<76.2)){alert("crash at 81 s!");}

  if(true){
    for(var ir=0; ir<network.length; ir++){
      for(var i=0; i<network[ir].veh.length; i++){
        if(network[ir].veh[i].id==207){
	  var veh=network[ir].veh[i];
          console.log("time=",time.toFixed(2),
		    "test7 start updateSim: status of veh id=",veh.id,
		      " lane=",veh.lane," v=",veh.v.toFixed(2));
	}
      }
    }
  }

  // updateSim (1): update times and, if canvas change, 
  // scale and update smartphone property

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

    updateDimensions(); // updates refsizePhys, -Pix, scale, geometry
 
    trafficObjs.calcDepotPositions(canvas);
  }
 

  // updateSim (2): integrate all the GUI actions (sliders, TrafficObjects)
  // as long as not done independently (clicks on vehicles)
  // check that global var deepCopying=true (in road.js)
  // (needed for updateModelsOfAllVehicles)

  // LCModelMandatory in control_gui.js;
  // road.updateM... makes road.LCModelMandatoryLeft, -Right out of this


  for(var ir=0; ir<network.length; ir++){
    network[ir].updateTruckFrac(fracTruck, fracTruckToleratedMismatch);
    network[ir].updateModelsOfAllVehicles(longModelCar,longModelTruck,
					 LCModelCar,LCModelTruck,
					 LCModelMandatory);
    network[ir].updateSpeedlimits(trafficObjs);
  }
  
  if(userCanDropObjects&&(!isSmartphone)&&(!trafficObjPicked)){
    trafficObjs.zoomBack(); // here more responsive than in drawSim
  }



  // updateSim (3): do central simulation update of vehicles

  for(var ir=0; ir<network.length; ir++){
    network[ir].calcAccelerations();
  }


  // updateSim (4): !!! do all the network actions
  // (inflow, outflow, merging and connecting)

  var qEastbound=0.95*qIn;
  var qWestbound=1.05*qIn;
  var qNorthbound=0.95*q2;
  var qSouthbound=1.05*q2;

  // direction={0: straight, 1: right, 2: left}
  var r=Math.random();
  var direction=(r<=fracRight) ? 1 : (r<fracRight+fracLeft) ? 2 : 0;

  var routes0=[route00,route05,route03]; // E-bound - straight-right-left
  var routes1=[route11,route13,route15]; // W - straight-right-left
  var routes2=[route23,route20,route21]; // N - straight-right-left
  var routes4=[route45,route41,route40]; // S - straight-right-left

  network[0].updateBCup(qEastbound,dt,routes0[direction]);
  
  r=Math.random(); direction=(r<=fracRight) ?1:(r<fracRight+fracLeft) ?2:0;
  network[1].updateBCup(qWestbound,dt,routes1[direction]);
			
  r=Math.random(); direction=(r<=fracRight) ?1:(r<fracRight+fracLeft) ?2:0;
  network[2].updateBCup(qNorthbound,dt,routes2[direction]);
			
  r=Math.random(); direction=(r<=fracRight) ?1:(r<fracRight+fracLeft) ?2:0;
  network[4].updateBCup(qSouthbound,dt,routes4[direction]);

  
  // do all the mergeDiverge actions here
  // do all the connecting stuff here


  // connectors selected by the route of the vehicles

  var maxspeed_turn=7;
  
  // connect(targetRoad,uSource,uTarget,offsetLane,conflicts(opt),speed(opt))

  // straight  ahead
  
  network[2].connect(network[3], network[2].roadLen,
		     0, 0, conflicts23);
  
  network[4].connect(network[5], network[4].roadLen,
		     0, 0, conflicts45);

  // turn right

  network[0].connect(network[5], u05Source, u05Target,
		     nLanes_sec-nLanes_main, conflicts05, maxspeed_turn);

  network[1].connect(network[3], u13Source, u13Target,
		     nLanes_sec-nLanes_main, conflicts13, maxspeed_turn);

  network[2].connect(network[0], u20Source, u20Target,
		     nLanes_main-nLanes_sec, conflicts20, maxspeed_turn);
  
  network[4].connect(network[1], u41Source, u41Target, 
		     nLanes_main-nLanes_sec, conflicts41, maxspeed_turn);

  // turn left

  network[0].connect(network[3],
		     0.5*network[0].roadLen-0.5*nLanes_main*laneWidth,
		     nLanes_main*laneWidth, 0,
		     conflicts03, maxspeed_turn);

  network[1].connect(network[5],
		     0.5*network[0].roadLen-0.5*nLanes_main*laneWidth,
		     nLanes_main*laneWidth, 0,
		     conflicts15, maxspeed_turn);
 
  network[2].connect(network[1], network[2].roadLen,
		     0.5*network[1].roadLen-nLanes_main*laneWidth,0,
		     conflicts21, maxspeed_turn);
  
  network[4].connect(network[0], network[4].roadLen,
		     0.5*network[0].roadLen-nLanes_main*laneWidth,0,
		     conflicts40, maxspeed_turn);

  for(var ir=0; ir<network.length; ir++){
    network[ir].updateBCdown();
  }

  
  
  // updateSim (5): move the vehicles longitudinally and laterally
  // at the end because some special-case changes of calculated
  // accelerations and lane changing model parameters were done before

  // restrict LC for inflowing road2-vehicles for route 20

  for(var i=0; i<network[0].veh.length; i++){
    if(arraysEqual(network[0].veh[i].route, [0,5])){
      network[0].veh[i].LCModel=network[0].LCModelMandatoryRight;
    }
  }

  for(var i=0; i<network[1].veh.length; i++){
    if(arraysEqual(network[1].veh[i].route, [1,3])){
      network[1].veh[i].LCModel=network[1].LCModelMandatoryRight;
    }
  }

  for(var i=0; i<network[2].veh.length; i++){
    if(arraysEqual(network[2].veh[i].route, [2,0])){
      network[2].veh[i].LCModel=network[2].LCModelMandatoryRight;
      //console.log("set mandatory LC: network[2].veh[i]=",network[2].veh[i]);
    }
  }

  for(var i=0; i<network[4].veh.length; i++){
    if(arraysEqual(network[4].veh[i].route, [4,1])){
      network[4].veh[i].LCModel=network[4].LCModelMandatoryRight;
    }
  }
      
  for(var ir=0; ir<network.length; ir++){
    network[ir].changeLanes();         
    network[ir].updateLastLCtimes(dt);
  }


  for(var ir=0; ir<network.length; ir++){ // simult. update pos at the end
    network[ir].updateSpeedPositions();
  }


    // updateSim (6): update detector readings

  for(var iDet=0; iDet<detectors.length; iDet++){
    detectors[iDet].update(time,dt);
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
       || (!drawRoad) || movingObserver||drawVehIDs){
      ctx.drawImage(background,0,0,canvas.width,canvas.height);
    }
  }
  

  // drawSim (3): draw road network
  
  //var changedGeometry=hasChanged||(itime<=1); 
  var changedGeometry=(itime<=1); // if no physical change of road lengths

  // road.draw(img1,img2,scale,changedGeometry,
  //           umin,umax,movingObserver,uObs,center_xPhys,center_yPhys)
  // second arg line optional, only for moving observer

  for(var ir=network.length-1; ir>=0; ir--){ // draw second. roads first
    network[ir].draw(roadImages[ir][0],roadImages[ir][1],
		     scale,changedGeometry);
  }

  
  // drawSim (4): draw vehicles

  // road.drawVehicles(carImg,truckImg,obstImgs,scale,vmin_col,vmax_col,
  //           umin,umax,movingObserver,uObs,center_xPhys,center_yPhys)
  // second arg line optional, only for moving observer

  for(var ir=0; ir<network.length; ir++){ 
    network[ir].drawVehicles(carImg,truckImg,obstacleImgs,scale,
			vmin_col,vmax_col);
  }



  // drawSim (5): redraw changeable traffic objects 

  if(userCanDropObjects&&(!isSmartphone)){
    trafficObjs.draw(scale);
  }

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
// (i) automatically when loading the simulation 
// (ii) when pressing the start button in *gui.js
//  ("myRun=setInterval(main_loop, 1000/fps);")
//############################################

console.log("first main execution");

var myRun=setInterval(main_loop, 1000/fps);

