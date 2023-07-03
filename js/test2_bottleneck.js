

//#############################################################
// general ui settings
//#############################################################

const userCanDropObjects=true;
var scenarioString="Test2"; // needed in road.changeLanes etc

var showCoords=true;  // show logical coords of nearest road to mouse pointer
                      // definition => showLogicalCoords(.) in canvas_gui.js
                      // application: here at drawSim (7):  
//#############################################################
// general debug settings (set=false for public deployment)
//#############################################################

drawRoadIDs=true; // override control_gui.js; 
drawVehIDs=true;  // override control_gui.js;
                   // need to call later road.drawVehIDs=drawVehIDs

var debug=false;   // if true, then sim stops at crash (only for testing)
var crashinfo=new CrashInfo(); // need to include debug.js in html
                               // use it in updateSim (5)
//#############################################################
// stochasticity settings (acceleration noise spec at top of models.js)
//#############################################################

QnoiseAccel=0;            //[m^2/s^3] override default setting at models.js
var driver_varcoeff=0.15; //v0 and a coeff of variation (of "agility")
                          // need later override road setting by
                          // calling road.setDriverVariation(.); 


//#############################################################
// adapt/override standard param settings from control_gui.js
//#############################################################

density=0;

qIn=2000./3600; 
commaDigits=0;
setSlider(slider_qIn, slider_qInVal, 3600*qIn, commaDigits, "veh/h");

timewarp=2;
setSlider(slider_timewarp, slider_timewarpVal, timewarp, 1, " times");

IDM_a=1.2
setSlider(slider_IDM_a, slider_IDM_aVal, IDM_a, 1, " m/s<sup>2</sup>");

fracTruck=0.2;

/*######################################################
 Global overall scenario settings and graphics objects

 refSizePhys  => reference size in m (generally smaller side of canvas)
 refSizePix   => reference size in pixel (generally smaller side of canvas)
 scale = refSizePix/refSizePhys 
       => roads have full canvas regardless of refSizePhys, refSizePix

 (1) refSizePix=Math.min(canvas.width, canvas.height) determined during run  

 (2) refSizePhys smaller  => all phys roadlengths smaller
  => vehicles and road widths appear bigger for a given screen size 
  NOTICE: Unless refSizePhys is constant during sim,  
  updateDimensions needs to re-define  
  the complete infrastructure geometry at every change

  Example: refSizePhys propto sqrt(refSizePix) => roads get more compact 
  and vehicles get smaller, both on a sqrt basis

  NOTICE: canvas has strange initialization of width=300 in firefox 
  and DOS when try sizing in css (see there) only 
 
  document.getElementById("contents").clientWidth; .clientHeight;
  always works!
######################################################*/


var simDivWindow=document.getElementById("contents");
var canvas = document.getElementById("canvas"); 
var ctx = canvas.getContext("2d"); // graphics context
canvas.width  = simDivWindow.clientWidth; 
canvas.height  = simDivWindow.clientHeight;

console.log("before addTouchListeners()");
addTouchListeners();
console.log("after addTouchListeners()");


// init overall scaling 

var isSmartphone=mqSmartphone();  // from css; only influences text size

var refSizePhys=150;              // reference size in m

// these two must be updated in updateDimensions (aspectRatio != const)

var refSizePix=canvas.height;     // corresponds to pixel size of smaller side
var scale=refSizePix/refSizePhys; // global scale


var aspectRatio=canvas.width/canvas.height;

var hasChanged=true;              // window dimensions have changed



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



//##################################################################
//<NETWORK>
// Specification of physical road network and vehicle geometry
// If viewport or refSizePhys changes => updateDimensions();
//##################################################################

// all relative "Rel" settings with respect to refSizePhys, not refSizePix!


var center_xRel=0.5;   // 0: left, 1: right
var center_yRel=-0.65;  // -1: bottom; 0: top
var center_xPhys=center_xRel*refSizePhys*aspectRatio; //[m]
var center_yPhys=center_yRel*refSizePhys;

var road0Len=0.47*refSizePhys*aspectRatio;
var road1Len=0.47*refSizePhys*aspectRatio;


// specification of road width and vehicle sizes

var laneWidth=5; 
var car_length=6;    // car length in m (all a bit oversize for visualisation)
var car_width=3;     // car width in m
var truck_length=11;
var truck_width=4; 


// def trajectories 
// !! cannot define diretly function trajNet_x[0](u){ .. } etc

function traj0_x(u){ // physical coordinates
  return center_xPhys+u-road0Len;
}

function traj0_y(u){ 
  return center_yPhys;
}

function traj1_x(u){ 
  return center_xPhys+u;
}

function traj1_y(u){ 
  return center_yPhys+laneWidth; // offsetLane=+1, see road.connect(...)
}

var trajNet=[[traj0_x,traj0_y], [traj1_x,traj1_y] ]; 



//##################################################################
// Specification of logical road network: constructing the roads
//##################################################################


var nLanes_main=3;

fracTruckToleratedMismatch=1.0; // 1=100% allowed=>changes only by sources
speedInit=20;

// roads
// last opt arg "doGridding" left out (true:user can change road geometry)


var isRing=false;
var road0=new road(0,road0Len,laneWidth,nLanes_main,
		   trajNet[0],
		   density, speedInit,fracTruck, isRing);

var road1=new road(1,road1Len,laneWidth,nLanes_main,
		   trajNet[1],
		   density, speedInit,fracTruck, isRing);

var route1=[road0.roadID, road1.roadID];


// road network (network declared in canvas_gui.js)

network[0]=road0; 
network[1]=road1;

// roadIDs drawn in updateSim in separate loop because Xing roads
// may cover roads drawn before and I alsways want to see the IDs

for(var ir=0; ir<network.length; ir++){
  network[ir].setDriverVariation(driver_varcoeff);
  network[ir].drawVehIDs=drawVehIDs;
}


// add standing virtual vehicles at the end of links
// where lanes are blocked for all routes 
// unshift: add elem at i=0; shift: remove at i=0; push: add at end


// vehicle(length, width, u, lane, speed, type)
var virtualStandingVeh
    =new vehicle(0.01, laneWidth, road0.roadLen, nLanes_main-1, 0, "obstacle");

road0.veh.unshift(virtualStandingVeh); //!!!!


var detectors=[]; // stationaryDetector(road,uRel,integrInterval_s)
detectors[0]=new stationaryDetector(road0,0.30*road0Len,10);
detectors[1]=new stationaryDetector(road1,0.80*road1Len,10);

//</NETWORK>


//#########################################################
// model initialization (models and methods override control_gui.js)
//#########################################################
	
updateModels(); // defines longModelCar,-Truck,LCModelCar,-Truck,-Mandatory


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


//############################################
// traffic objects and traffic-light control editor
//############################################

// TrafficObjects(canvas,nTL,nLimit,xRelDepot,yRelDepot,nRow,nCol)
var trafficObjs=new TrafficObjects(canvas,1,3,0.50,0.70,2,3);

// !! Editor not yet finished
// (then args xRelEditor,yRelEditor not relevant unless editor shown)
//var trafficLightControl=new TrafficLightControlEditor(trafficObjs,0.5,0.5);



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
 
  // (1a) Test code

  //if(time<38.5){
  if(false){
    for(var ir=0; ir<network.length; ir++){
      for(var i=0; i<network[ir].veh.length; i++){
        if (network[ir].veh[i].id==219){
	  var testveh=network[ir].veh[i];
	  console.log("time=",time," ir=",ir," veh id=",testveh.id,
		      " bBiasRight=",testveh.LCModel.bBiasRight,
		      "");
	}
      }
    }
  }
	

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

  
  // (3b) transitions between roads: templates:
  //      road.mergeDiverge(newRoad,offset,uStart,uEnd,isMerge,toRight)  
  //      road.connect(target, uSource, uTarget, offsetLane, conflicts)
  
  network[0].updateBCup(qIn,dt,route1); // qIn=qTot, route is optional arg
  network[0].connect(network[1],network[0].roadLen,0,1,[]);
  network[1].updateBCdown(); 

  
  // (3c) actual motion (always at the end)

  for(var ir=0; ir<network.length; ir++){network[ir].updateLastLCtimes(dt);} 
  for(var ir=0; ir<network.length; ir++){network[ir].changeLanes();} 
  for(var ir=0; ir<network.length; ir++){network[ir].updateSpeedPositions();} 

   

    // updateSim (4): update detector readings

  for(var iDet=0; iDet<detectors.length; iDet++){
    detectors[iDet].update(time,dt);
  }

  
  // updateSim (5): debug output

  if(debug){crashinfo.checkForCrashes(network);} //!! deact for production

  if(true){
    debugVeh(459,network);
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
       || (!drawRoad) || movingObserver){
      ctx.drawImage(background,0,0,canvas.width,canvas.height);
    }
  }
  

  // drawSim (3): draw road network
  
  //var changedGeometry=hasChanged||(itime<=1); 
  var changedGeometry=(itime<=1); // if no physical change of road lengths

  // road.draw(img1,img2,changedGeometry,
  //           umin,umax,movingObserver,uObs,center_xPhys,center_yPhys)
  // second arg line optional, only for moving observer

  for(var ir=0; ir<network.length; ir++){ 
    network[ir].draw(roadImg1,roadImg2,changedGeometry);
  }

  if(drawRoadIDs){// separate loop because of visibility
    for(var ir=0; ir<network.length; ir++){
      network[ir].drawRoadID();
    }
  }

  
  // drawSim (4): draw vehicles

  // road.drawVehicles(carImg,truckImg,obstImgs,vmin_col,vmax_col,
  //           umin,umax,movingObserver,uObs,center_xPhys,center_yPhys)
  // second arg line optional, only for moving observer

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
// (i) automatically when loading the simulation 
// (ii) when pressing the start button in *gui.js
//  ("myRun=setInterval(main_loop, 1000/fps);")
//############################################

console.log("first main execution");

var myRun=setInterval(main_loop, 1000/fps);

