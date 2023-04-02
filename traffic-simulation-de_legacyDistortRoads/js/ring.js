
//var userCanDistortRoads=false;
var userCanDistortRoads=true;
var userCanDropObjects=true;

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

// override standard dettings control_gui.js

density=0.03;  // default 0.03
setSlider(slider_density, slider_densityVal, 1000*density, 0, "veh/km");

fracTruck=0.1; // default 0.1 
setSlider(slider_fracTruck, slider_fracTruckVal, 100*fracTruck, 0, "%");


// Global overall scenario settings and graphics objects


var scenarioString="Ring";
console.log("\n\nstart main: scenarioString=",scenarioString);

var simDivWindow=document.getElementById("contents");
   // following cmd defines also mouse listeners from html 
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

var refSizePhys=(isSmartphone) ? 200 : 300;  // constant

var critAspectRatio=120./95.; // from css file width/height of #contents

var refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);
var scale=refSizePix/refSizePhys;



//##################################################################
// Specification of physical road geometry and vehicle properties
// If refSizePhys changes, change them all => updateDimensions();
//##################################################################

// all relative "Rel" settings with respect to refSizePhys, not refSizePix!


var center_xRel=0.5;
var center_yRel=-0.54;
var roadRadiusRel=0.42;


// physical geometry settings [m]

var center_xPhys=center_xRel*refSizePhys; //[m]
var center_yPhys=center_yRel*refSizePhys;
var roadRadius=roadRadiusRel*refSizePhys;
var mainroadLen=roadRadius*2*Math.PI;

function updateDimensions(){ // if viewport or sizePhys changed
    center_xPhys=center_xRel*refSizePhys; //[m]
    center_yPhys=center_yRel*refSizePhys;
    roadRadius=roadRadiusRel*refSizePhys;
    mainroadLen=roadRadius*2*Math.PI;
}


// the following remains constant 
// => road becomes more compact for smaller screens

var laneWidth=8; // remains constant => road becomes more compact for smaller
var nLanes_main=3;

var car_length=7; // car length in m
var car_width=6; // car width in m
var truck_length=15; // trucks
var truck_width=7; 


// on constructing road, road elements are gridded and interna
// road.traj_xy(u) are generated. The, traj_xy*Init(u) obsolete

function traj_x(u){
    return center_xPhys + roadRadius*Math.cos(u/roadRadius);
}

function traj_y(u){
    return center_yPhys + roadRadius*Math.sin(u/roadRadius);
}


//##################################################################
// Specification of logical road 
//##################################################################

var isRing=true;  // 0: false; 1: true
var roadID=1;
var speedInit=20; // IC for speed
var fracTruckToleratedMismatch=0.02; // avoid sudden changes in open systems

var mainroad=new road(roadID,mainroadLen,laneWidth,nLanes_main,traj_x,traj_y,
		      density,speedInit,fracTruck,isRing,userCanDistortRoads);
network[0]=mainroad;  // network declared in canvas_gui.js



//  introduce stationary detectors

var detectors=[];
for(var idet=0; idet<4; idet++){
  detectors[idet]=new stationaryDetector(mainroad,
					  (0.125+idet*0.25)*mainroadLen,10);
}



//#########################################################
// model initialization (models and methods defined in control_gui.js)
//#########################################################
	
updateModels(); // defines longModelCar,-Truck,LCModelCar,-Truck,-Mandatory


//####################################################################
// Global graphics specification
//####################################################################


// graphical settings

var hasChanged=true; // window dimensions have changed (responsive design)

var drawBackground=true; // if false, default unicolor background
var drawRoad=true; // if false, only vehicles are drawn
var userCanvasManip=false; //!!! true only if user-driven geometry changes

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
var trafficObjs=new TrafficObjects(canvas,2,2,0.40,0.50,3,2);

// xxxNew
var trafficLightControl=new TrafficLightControlEditor(trafficObjs,0.33,0.68);


//############################################
// run-time specification and functions
//############################################

var time=0;
var itime=0;
var fps=30; // frames per second (unchanged during runtime)
var dt=timewarp/fps;


//############################################
function updateSim(){
//############################################

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
    mainroad.updateDensity(density);

  // (2a) update moveable speed limits

  mainroad.updateSpeedlimits(trafficObjs); 


    // do central simulation update of vehicles

    mainroad.updateLastLCtimes(dt);
    mainroad.calcAccelerations();  
    mainroad.changeLanes();         
    mainroad.updateSpeedPositions();

    //if(itime<2){mainroad.writeVehicleLongModels();}
    //if(itime<2){mainroad.writeVehicleLCModels();}

    for(var iDet=0; iDet<detectors.length; iDet++){
	detectors[iDet].update(time,dt);
    }

  
  if(userCanDropObjects&&(!isSmartphone)&&(!trafficObjPicked)){
    trafficObjs.zoomBack();
  }


  // (6) debug output
  
  if(false){
    mainroad.writeTrucksLC();
    //mainroad.writeVehicleLCModels();

  }

}  // updateSim








//##################################################
function drawSim() {
//##################################################




    // (0) reposition physical x center coordinate as response
    // to viewport size (changes)
    // isSmartphone defined in updateSim
 

 
    var relTextsize_vmin=(isSmartphone) ? 0.03 : 0.02;
    var textsize=relTextsize_vmin*Math.min(canvas.width,canvas.height);
    //console.log("isSmartphone=",isSmartphone);

    if(false){console.log(" new total inner window dimension: ",
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
      trafficObjs.calcDepotPositions(canvas); 

    }

 

  // (1) update heading of all vehicles rel. to road axis
  // (for some reason, strange rotations at beginning)

    

 
  // (2) reset transform matrix and draw background
  // (only needed if changes, plus "reminders" for lazy browsers)

  ctx.setTransform(1,0,0,1,0,0);
  if(drawBackground){
    if(hasChanged||(itime<=10) || (itime%50==0) || userCanvasManip
      || (!drawRoad)){
      ctx.drawImage(background,0,0,canvas.width,canvas.height);
    }
  }

  // (3) draw road and possibly traffic lights afterwards (before vehs)
 
  var changedGeometry=userCanvasManip || hasChanged||(itime<=1);
  mainroad.draw(roadImg1,roadImg2,scale,changedGeometry);

    // (4) draw vehicles

  mainroad.drawVehicles(carImg,truckImg,obstacleImgs,scale,vmin_col,vmax_col);

  // (5a) draw traffic objects 

  if(userCanDropObjects&&(!isSmartphone)){
    trafficObjs.draw(scale);
  }

  // (5b) draw speedlimit-change select box

  ctx.setTransform(1,0,0,1,0,0); 
  drawSpeedlBox();
 

    // (6) draw simulated time and detector displays

  displayTime(time,textsize);
  for(var iDet=0; iDet<detectors.length; iDet++){
	detectors[iDet].display(textsize);
  }



  // (7) draw the speed colormap (text size propto widthPix

  if(drawColormap){
    displayColormap(scale*(center_xPhys-0.03*roadRadius),
                    -scale*(center_yPhys+0.50*roadRadius), 
		    scale*35, scale*45,
		    vmin_col,vmax_col,0,100/3.6);
  }

  // (8) xxxNew draw TL editor panel

  if(trafficLightControl.isActive){
    trafficLightControl.showEditPanel();
  }

  // may be set to true in next step if changed canvas 
  // or old sign should be wiped away 
  hasChanged=false; 

    // revert to neutral transformation at the end!
  ctx.setTransform(1,0,0,1,0,0); 

} //drawSim
 



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
// (ii) when pressing the start button defined in onramp_gui.js
//  ("myRun=setInterval(main_loop, 1000/fps);")
//############################################

console.log("first main execution");
showInfo();
var myRun=setInterval(main_loop, 1000/fps); 

