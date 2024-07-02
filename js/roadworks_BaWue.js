
const userCanDropObjects=true;

nLanesMin=2;
nLanesMax=4; 

//#############################################################
// stochasticity settings (acceleration noise spec at top of models.js)
//#############################################################

var driver_varcoeff=0.01; //!!! v0 and a coeff of variation (of "agility")
                          // need later call road.setDriverVariation(.); 

//#############################################################
// adapt standard IDM and MOBIL model parameters from control_gui.js
// since no sliders for that.
// Values are distributed in updateModels() => truck model derivatives
// and (as deep copies) in road.updateModelsOfAllVehicles
//#############################################################


IDM_T=1.4;
IDM_a=1.2;
IDM_b=2.0; // low for more anticipation
IDM_s0=2;
speedL=1000/3.6; 
speedL_truck=80/3.6;

MOBIL_bBiasRigh_car=0.5;
MOBIL_bBiasRight_truck=8;
MOBIL_mandat_bSafe=18;
MOBIL_mandat_bThr=0.5;   // >0
MOBIL_mandat_bias=1.5;

MOBIL_bSafe=5;
MOBIL_bSafeMax=17;

//#############################################################
// initialize sliders (qIn etc override control_gui.js)
//#############################################################

density=0;

IDM_v0=140./3.6;
slider_IDM_v0.value=3.6*IDM_v0;
slider_IDM_v0Val.innerHTML=3.6*IDM_v0+" km/h";

qIn=1680./3600; // inflow 1550./3600; 
slider_qIn.value=3600*qIn;
slider_qInVal.innerHTML=formd0(3600*qIn)+" Fz/h";

fracTruck=0.25;
slider_fracTruck.value=100*fracTruck;
slider_fracTruckVal.innerHTML=100*fracTruck+"%";

timewarp=5;
slider_timewarpVal.innerHTML=timewarp +"times";
slider_timewarp.value=timewarp;


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

var scenarioString="RoadWorks_BaWue";
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
// width/height in css.#contents optimized for 16:9)
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

var center_xRel=0.43; // manipulae relative viewport by traj_x
var center_yRel=-0.55;
var arcRadiusRel=0.405;



// constant  refSizePhys calculated by requirement fixed mainroadLen!!

var refSizePhys=mainroadLen/(Math.PI*arcRadiusRel
			     +2*(critAspectRatio-center_xRel));
var scale=refSizePix/refSizePhys;

var center_xPhys, center_yPhys;
var arcRadius, arcLen, straightLen;
var uBeginRoadworks, uEndRoadworks, uStartLCMandatory;
 
updateDimensions();

// the following remains constant 
// => road becomes more compact for smaller screens

var laneWidth=7; // remains constant => road becomes more compact for smaller
var nLanes_main=2;

var car_length=7; // car length in m
var car_width=5; // car width in m
var truck_length=15; // trucks
var truck_width=7; 

var laneRoadwork=0;  // 0=left
var lenRoadworkElement=7;
var wRoadworkElement=7;


function updateDimensions(){ // only at init and if sizePhys changed
  center_xPhys=center_xRel*refSizePhys; //[m]
  center_yPhys=center_yRel*refSizePhys;

  arcRadius=arcRadiusRel*refSizePhys;
  arcLen=arcRadius*Math.PI;
  straightLen=refSizePhys*critAspectRatio-center_xPhys;

  uBeginRoadworks=straightLen+0.8*arcLen;
  uEndRoadworks=straightLen+1.1*arcLen;
  uStartLCMandatory=0.1*uBeginRoadworks;
  console.log("calculated mainroadLen=",arcLen+2*straightLen);

}




// on constructing road, road elements are gridded and interna
// road.traj_xy(u) are generated. Then, main.traj_xy*(u) obsolete


function traj_x(u){ // physical coordinates
        var dxPhysFromCenter= // left side (median), phys coordinates
	    (u<straightLen) ? straightLen-u
	  : (u>straightLen+arcLen) ? u-mainroadLen+straightLen
	  : -arcRadius*Math.sin((u-straightLen)/arcRadius);
	return center_xPhys+dxPhysFromCenter+6; //!!! quick hack
}

function traj_y(u){ // physical coordinates
        var dyPhysFromCenter=
 	    (u<straightLen) ? arcRadius
	  : (u>straightLen+arcLen) ? -arcRadius
	  : arcRadius*Math.cos((u-straightLen)/arcRadius);
	return center_yPhys+dyPhysFromCenter;
}




//##################################################################
// Specification of logical road network
//##################################################################

var isRing=false;  // 0: false; 1: true
var roadID=1;
speedInit=20; // IC for speed
fracTruckToleratedMismatch=1.0; // 100% allowed=>changes only by sources

var mainroad=new road(roadID,mainroadLen,laneWidth,nLanes_main,
		      [traj_x,traj_y],
		      density, speedInit,fracTruck, isRing);
network[0]=mainroad;  // network declared in canvas_gui.js

mainroad.uminLC=0; // allow lane changing right at the beginning
mainroad.setTrucksAlwaysRight=false;



//#########################################################
// add standing virtual vehicles at position of road works 
//#########################################################

// number of virtual "roadwork" Fzicles

var nr=Math.round((uEndRoadworks-uBeginRoadworks)/lenRoadworkElement);

for (var ir=0; ir<nr; ir++){
    var u=uBeginRoadworks+(ir+0.5)*lenRoadworkElement;
    var virtualVeh=new vehicle(lenRoadworkElement, wRoadworkElement, 
					u,laneRoadwork, 0, "obstacle");
    //virtualVeh.longModel=longModelObstacle;
    mainroad.veh.push(virtualVeh); // append; prepend=unshift
}

// put roadwork obstacles at right place and let vehicles get context of them 

mainroad.sortVehicles();
mainroad.updateEnvironment();


//  introduce stationary detectors


var detectors=[];
detectors[0]=new stationaryDetector(mainroad,0.25*mainroadLen,10);
detectors[1]=new stationaryDetector(mainroad,0.50*mainroadLen,10);
detectors[2]=new stationaryDetector(mainroad,0.75*mainroadLen,10);


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
var userCanvasManip; // true only if used-driven geometry changes finished

var drawColormap=false; // now drawn as png from html 
var vmin_col=0; // min speed for speed colormap (drawn in red)
var vmax_col=100/3.6; // max speed for speed colormap (drawn in blue-violet)


//#########################################################
// The images
//#########################################################




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


// init obstacle images

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





//############################################
// traffic objects
//############################################

// TrafficObjects(canvas,nTL,nLimit,xRelDepot,yRelDepot,nRow,nCol)
var trafficObjs=new TrafficObjects(canvas,0,4,0.60,0.65,1,5);
var trafficLightControl=new TrafficLightControlEditor(trafficObjs,0.5,0.5);

// initialize the 80 sign at the beginning to start with a working
// speed funnel (1 sign)
var speedl=trafficObjs.trafficObj[1]; 
trafficObjs.activate(speedl,mainroad,30);


//####################################################################
// external draggable objects
//####################################################################


//var speedfunnel=new SpeedFunnel(canvas,1,4,0.60,0.70);
//speedfunnel.activateLimit(1, mainroad, 30); // index, road, u


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
 
  // (2) transfer effects from slider interaction and mandatory regions
  // to the vehicles and models

  mainroad.updateTruckFrac(fracTruck, fracTruckToleratedMismatch);
  mainroad.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				       LCModelCar,LCModelTruck,
				       LCModelMandatory);


  // (2a) update moveable speed limits

  for(var i=0; i<network.length; i++){
    network[i].updateSpeedlimits(trafficObjs);
  }



    // (2b) externally impose mandatory LC behaviour
    // all left-lane vehicles must change lanes to the right
    // starting at 0 up to the position uBeginRoadworks

    mainroad.setLCMandatory(uStartLCMandatory, uBeginRoadworks, true);


    // (3) do central simulation update of vehicles

    mainroad.updateLastLCtimes(dt);
    mainroad.calcAccelerations();  
    mainroad.changeLanes(); 

    mainroad.updateSpeedPositions();
    mainroad.updateBCdown();
    mainroad.updateBCup(qIn,dt); // argument=total inflow

    if(true){
	for (var i=0; i<mainroad.nveh; i++){
	    if(mainroad.veh[i].speed<0){
		console.log(" speed "+mainroad.veh[i].speed
			    +" of mainroad vehicle "
			    +i+" is negative!");
	    }
	}
    }

    // (4) update detector readings

    for(var iDet=0; iDet<detectors.length; iDet++){
	detectors[iDet].update(time,dt);
    }


  //!!  (5) without this zoomback cmd, everything works but depot vehicles
  // just stay where they have been dropped outside of a road

  //console.log("itime=",itime," userCanDropObjects=",userCanDropObjects," isSmartphone=",isSmartphone," trafficObjPicked=",trafficObjPicked);

  if(userCanDropObjects&&(!isSmartphone)&&(!trafficObjPicked)){
    trafficObjs.zoomBack();
  }



// (6) debug output

  //trafficObjs.writeObjects();
  
}//updateSim




//##################################################
function drawSim() {
//##################################################

    // (1) redefine graphical aspects of road (arc radius etc) using
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


    if ((canvas.width!=simDivWindow.clientWidth)
	||(canvas.height != simDivWindow.clientHeight)){
	hasChanged=true;
	canvas.width  = simDivWindow.clientWidth;
        canvas.height  = simDivWindow.clientHeight;
	aspectRatio=canvas.width/canvas.height;
	refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);

	scale=refSizePix/refSizePhys; // refSizePhys=constant unless mobile

	updateDimensions();
      speedfunnel.calcDepotPositions(canvas);
      //depot.calcDepotPositions(canvas);

	if(true){
	    console.log("haschanged=true: new canvas dimension: ",
		        canvas.width," X ",canvas.height);
	}


    }


  


    // (2) reset transform matrix and draw background
    // (only needed if no explicit road drawn)
    // "%20-or condition"
    //  because some older firefoxes do not start up properly?


  //console.log("userCanvasManip=",userCanvasManip);

    ctx.setTransform(1,0,0,1,0,0); 
    if(drawBackground){
	if(hasChanged||(itime<=20) || userCanvasManip || (!drawRoad)){ 
          ctx.drawImage(background,0,0,canvas.width,canvas.height);
      }
    }


  // (3) draw mainroad
  // (always drawn; but changedGeometry=true necessary
  // if changed (it triggers building a new lookup table). 
  // Otherwise, road drawn at old position

    
    var changedGeometry=userCanvasManip || hasChanged||(itime<=1); 
    mainroad.draw(roadImg1,roadImg2,changedGeometry);


 
    // (4) draw vehicles

    mainroad.drawVehicles(carImg,truckImg,obstacleImgs,
			  vmin_col, vmax_col);
    
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
// (ii) when pressing the start button 
//  ("myRun=setInterval(main_loop, 1000/fps);")
//############################################

console.log("first main execution");
showInfo();
var myRun=setInterval(main_loop, 1000/fps);



 
