
const userCanDropObjects=true;
var scenarioString="Test1"; // needed in road.changeLanes etc


//#############################################################
// general debug settings (set=false for public deployment)
//#############################################################

drawRoadIDs=true; // override control_gui.js; 
drawVehIDs=false;  // override control_gui.js;
                   // need to call later road.drawVehIDs=drawVehIDs



//#############################################################
// adapt/override standard param settings from control_gui.js
//#############################################################

var nLanes_main=2;

density=0;

qIn=2000./3600; 
commaDigits=0;
setSlider(slider_qIn, slider_qInVal, 3600*qIn, commaDigits, "veh/h");

timewarp=2;
setSlider(slider_timewarp, slider_timewarpVal, timewarp, 1, " times");

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


// def trajectories (do not include doGridding, only for few main scenarios)
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
  return center_yPhys+0.0*u;
}

var trajNet=[[traj0_x,traj0_y], [traj1_x,traj1_y] ]; 


// specification of road width and vehicle sizes

var laneWidth=5; 
var car_length=6;    // car length in m (all a bit oversize for visualisation)
var car_width=3;     // car width in m
var truck_length=11;
var truck_width=4; 



//##################################################################
// Specification of logical road network: constructing the roads
//##################################################################


fracTruckToleratedMismatch=1.0; // 1=100% allowed=>changes only by sources
speedInit=20;

// roads
// last opt arg "doGridding" left out (true:user can change road geometry)


var isRing=false;
var road0=new road(0,road0Len,laneWidth,nLanes_main,
		   trajNet[0],
		   density, speedInit,fracTruck, isRing);

var road1=new road(42,road1Len,laneWidth,nLanes_main,
		   trajNet[1],
		   density, speedInit,fracTruck, isRing);

var route1=[road0.roadID, road1.roadID];


// road network (network declared in canvas_gui.js)

network=[road0,road1];
for(var ir=0; ir<network.length; ir++){
  network[ir].drawVehIDs=drawVehIDs;
  network[ir].drawRoadIDs=drawRoadIDs;
}


// add standing virtual vehicles at the end of some road elements
// prepending=unshift (strange name)

//var virtualStandingVeh=new vehicle(2, laneWidth, ramp.roadLen-0.9*taperLen, 0, 0, "obstacle");

//ramp.veh.unshift(virtualStandingVeh);


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

    updateDimensions(); // updates refsizePhys, -Pix,  geometry
 
    trafficObjs.calcDepotPositions(canvas);
  }
 

  // updateSim (2): integrate all the GUI actions (sliders, TrafficObjects)
  // as long as not done independently (clicks on vehicles)
  // check that global var deepCopying=true (in road.js)
  // (needed for updateModelsOfAllVehicles)


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
  // new accel only calculated, vehicles moved with it at the end
  // because some special-case accel changes are performed in the next steps

  for(var ir=0; ir<network.length; ir++){
    network[ir].calcAccelerations();
  }


  // updateSim (4): do all the network actions
  // (inflow, outflow, merging and connecting)
  
  network[0].updateBCup(qIn,dt,route1); // route is optional arg

  // do all the mergeDiverge actions here
  // do all the connecting stuff here

    // road.connect(target, uSource, uTarget, offsetLane, conflicts)
  network[0].connect(network[1],network[0].roadLen,0,0,[]);

  for(var ir=0; ir<network.length; ir++){

    
    network[ir].updateBCdown();
  }

  
  // updateSim (5): move the vehicles longitudinally and laterally
  // at the end because some special-case changes of calculated
  // accelerations and lane changing model parameters were done before
  
  for(var ir=0; ir<network.length; ir++){ // simult. update pos at the end
    network[ir].updateSpeedPositions();
  }
  for(var ir=0; ir<network.length; ir++){
    network[ir].changeLanes();         
    network[ir].updateLastLCtimes(dt);
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

  
  // drawSim (4): draw vehicles

  // road.drawVehicles(carImg,truckImg,obstImgs,vmin_col,vmax_col,
  //           umin,umax,movingObserver,uObs,center_xPhys,center_yPhys)
  // second arg line optional, only for moving observer

  for(var ir=0; ir<network.length; ir++){ 
    network[ir].drawRoadID();
    network[ir].drawVehicles(carImg,truckImg,obstacleImgs,
			vmin_col,vmax_col);
  }


  
  // drawSim (5): redraw changeable traffic objects 

  if(userCanDropObjects&&(!isSmartphone)){
    trafficObjs.draw();
  }

  ctx.setTransform(1,0,0,1,0,0); 
  drawSpeedlBox(); // draw speedlimit-change select box


  // drawSim (6): show simulation time and detector displays

  displayTime(time,textsize);
  for(var iDet=0; iDet<detectors.length; iDet++){
	detectors[iDet].display(textsize);
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

