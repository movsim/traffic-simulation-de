
// adapt settings from control_gui.js

density=0.02; 

const userCanDropObjects=true;


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


var scenarioString="OnRamp";
console.log("\n\nstart main: scenarioString=",scenarioString);


var outerContainer=document.getElementById("container"); 
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
// If refSizePhys changes, change them all => updateDimensions();
//##################################################################

// all relative "Rel" settings with respect to refSizePhys, not refSizePix!

var center_xRel=0.43;
var center_yRel=-0.54;
var arcRadiusRel=0.35;
var rampLenRel=0.9;

var center_xPhys=center_xRel*refSizePhys; //[m]
var center_yPhys=center_yRel*refSizePhys;


var arcRadius=arcRadiusRel*refSizePhys;
var arcLen=arcRadius*Math.PI;
var straightLen=refSizePhys*critAspectRatio-center_xPhys;
var mainroadLen=arcLen+2*straightLen;
var rampLen=rampLenRel*refSizePhys; 
var mergeLen=0.5*rampLen;
var mainRampOffset=mainroadLen-straightLen+mergeLen-rampLen;
var taperLen=0.2*rampLen;
var rampRadius=4*arcRadius;



function updateDimensions(){ // if viewport or sizePhys changed
    center_xPhys=center_xRel*refSizePhys; //[m]
    center_yPhys=center_yRel*refSizePhys;

    arcRadius=arcRadiusRel*refSizePhys;
    arcLen=arcRadius*Math.PI;
    straightLen=refSizePhys*critAspectRatio-center_xPhys;
    mainroadLen=arcLen+2*straightLen;
    rampLen=rampLenRel*refSizePhys; 
    mergeLen=0.5*rampLen;
    mainRampOffset=mainroadLen-straightLen+mergeLen-rampLen;
    taperLen=0.2*rampLen;
    rampRadius=4*arcRadius;
}


// the following remains constant 
// => road becomes more compact for smaller screens

var laneWidth=7; // remains constant => road becomes more compact for smaller
var nLanes_main=3;
var nLanes_rmp=1;


var car_length=7; // car length in m
var car_width=5; // car width in m
var truck_length=15; // trucks
var truck_width=7; 


// on constructing road, road elements are gridded and interna
// road.traj_xy(u) are generated. The, traj_xy*(u) obsolete

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


function trajRamp_x(u){ // physical coordinates
	//var xMergeBegin=traj_x(mainroadLen-straightLen);
	var xMergeBegin=traj_x(mainRampOffset+rampLen-mergeLen);
	var xPrelim=xMergeBegin+(u-(rampLen-mergeLen));
	return (u<rampLen-taperLen) 
	    ? xPrelim : xPrelim-0.05*(u-rampLen+taperLen);
}


// indefining dependent geometry,
//  do not refer to mainroad or onramp!! may not be defined: 
// mainroad.nLanes => nLanes_main, ramp.nLanes=>nLanes_ramp1!!

function trajRamp_y(u){ // physical coordinates

    var yMergeBegin=traj_y(mainRampOffset+rampLen-mergeLen)
	-0.5*laneWidth*(nLanes_main+nLanes_rmp)-0.02*laneWidth;

    var yMergeEnd=yMergeBegin+laneWidth;
    return (u<rampLen-mergeLen)
	? yMergeBegin - 0.5*Math.pow(rampLen-mergeLen-u,2)/rampRadius
	: (u<rampLen-taperLen) ? yMergeBegin
	: (u<rampLen-0.5*taperLen) 
        ? yMergeBegin+2*laneWidth*Math.pow((u-rampLen+taperLen)/taperLen,2)
	: yMergeEnd - 2*laneWidth*Math.pow((u-rampLen)/taperLen,2);
}



//##################################################################
// Specification of logical road 
//##################################################################

var isRing=false;  // 0: false; 1: true
var roadIDmain=1;
var roadIDramp=2;

fracTruckToleratedMismatch=1.0; // open system: need tolerance, otherwise
                      // sudden changes with new incoming/outgoing vehicles

speedInit=20; // IC for speed

// last arg = doGridding (true: user can change road geometry)

var mainroad=new road(roadIDmain,mainroadLen,laneWidth,nLanes_main,
		      [traj_x,traj_y],
		      density, speedInit,fracTruck, isRing);

var ramp=new road(roadIDramp,rampLen,laneWidth,nLanes_rmp,
		    [trajRamp_x,trajRamp_y],
		  0*density, speedInit, fracTruck, isRing);


// add standing virtual vehicle at the end of ramp (1 lane)
// prepending=unshift (strange name)

var virtualStandingVeh=new vehicle(2, laneWidth, ramp.roadLen-0.6*taperLen, 0, 0, "obstacle");

ramp.veh.unshift(virtualStandingVeh);

// introduce stationary detectors 


var detectors=[];
detectors[0]=new stationaryDetector(mainroad,0.10*mainroadLen,30);
detectors[1]=new stationaryDetector(mainroad,0.58*mainroadLen,30);
detectors[2]=new stationaryDetector(mainroad,0.90*mainroadLen,30);


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


// init obstacle images

obstacleImgs = []; // srcFiles[0]='figs/obstacleImg.png'
for (var i=0; i<10; i++){
    obstacleImgs[i]=new Image();
    obstacleImgs[i].src = (i==0)
	? 'figs/obstacleImg.png'
	: "figs/constructionVeh"+i+".png";
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



//####################################################################
//!!! ObstacleTLDepot(nImgs,nRow,nCol,xDepot,yDepot,lVeh,wVeh,containsObstacles)
//####################################################################

var smallerDimPix=Math.min(canvas.width,canvas.height);
var depot=new ObstacleTLDepot(obstacleImgs.length, 2,2,
			   0.7*smallerDimPix/
			   -0.5*smallerDimPix/
			   30,30,true);




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

    // update times

    time +=dt; // dt depends on timewarp slider (fps=const)
    itime++;
    isSmartphone=mqSmartphone();

    // transfer effects from slider interaction 
    // and changed mandatory states to the vehicles and models 

    mainroad.updateTruckFrac(fracTruck, fracTruckToleratedMismatch);
    mainroad.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				       LCModelCar,LCModelTruck,
				       LCModelMandatory);

    ramp.updateTruckFrac(fracTruck, fracTruckToleratedMismatch);
    ramp.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				       LCModelCar,LCModelTruck,
				       LCModelMandatory);

    // externally impose mandatory LC behaviour
    // all ramp vehicles must change lanes to the left (last arg=false)

    ramp.setLCMandatory(0, ramp.roadLen, false);


    // do central simulation update of vehicles

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


    for(var iDet=0; iDet<detectors.length; iDet++){
	detectors[iDet].update(time,dt);
    }


    //!!!  without this zoomback cmd, everything works but depot vehicles
    // just stay where they have been dropped outside of a road

    if(trafficObjZoomBack){
	var res=depot.zoomBackVehicle();
	trafficObjZoomBack=res;
	userCanvasManip=true;
    }

    // write vehicle positions of mainroad and onramp to console for external use

    if(false){
	console.log("\nmainroad vehicles, simulation time=",time,":");
	mainroad.writeVehiclesSimple();
	console.log("\nonramp vehicles, simulation time=",time,":");
	ramp.writeVehiclesSimple();
    }

}//updateSim




//##################################################
function drawSim() {
//##################################################

    //!! test relative motion isMoving

    var movingObserver=false;
    var uObs=0*time;

    // (0) redefine graphical aspects of road (arc radius etc) using
    // responsive design if canvas has been resized 
    // isSmartphone defined in updateSim
 
    var relTextsize_vmin=(isSmartphone) ? 0.03 : 0.02; //xxx
    var textsize=relTextsize_vmin*Math.min(canvas.width,canvas.height);


    var hasChanged=false;


    if ((canvas.width!=simDivWindow.clientWidth)
	||(canvas.height != simDivWindow.clientHeight)){
	hasChanged=true;
	canvas.width  = simDivWindow.clientWidth;
        canvas.height  = simDivWindow.clientHeight;
	aspectRatio=canvas.width/canvas.height;
	refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);

	scale=refSizePix/refSizePhys; // refSizePhys=constant unless mobile

	updateDimensions();

	if(true){
	    console.log("haschanged=true: new canvas dimension: ",
		        canvas.width," X ",canvas.height);
	}


    }

 


    // (1) update heading of all vehicles rel. to road axis
    // (for some reason, strange rotations at beginning)

    


    // (2) reset transform matrix and draw background
    // (only needed if no explicit road drawn)

    ctx.setTransform(1,0,0,1,0,0); 
    if(drawBackground){
	if(hasChanged||(itime<=2) || (itime===20) || userCanvasManip 
	   || movingObserver || (!drawRoad)){
        ctx.drawImage(background,0,0,canvas.width,canvas.height);
      }
    }

    // (3) draw mainroad and ramp
    // (always drawn; changedGeometry only triggers building a new lookup table)

    var changedGeometry=userCanvasManip || hasChanged||(itime<=1)||true; 
    ramp.draw(rampImg,rampImg,changedGeometry,
		movingObserver,0, 
		center_xPhys-mainroad.traj_x(uObs)+ramp.traj_x(0),
		center_yPhys-mainroad.traj_y(uObs)+ramp.traj_y(0)); 
    ramp.drawTrafficLights(traffLightRedImg,traffLightGreenImg);//!!!

    mainroad.draw(roadImg1,roadImg2,changedGeometry,
		  movingObserver,uObs,center_xPhys,center_yPhys); 
    mainroad.drawTrafficLights(traffLightRedImg,traffLightGreenImg);//!!!


 
    // (4) draw vehicles

    ramp.drawVehicles(carImg,truckImg,obstacleImgs,
			vmin_col,vmax_col,0,ramp.roadLen,
			movingObserver,0,
			center_xPhys-mainroad.traj_x(uObs)+ramp.traj_x(0),
			center_yPhys-mainroad.traj_y(uObs)+ramp.traj_y(0));


    mainroad.drawVehicles(carImg,truckImg,obstacleImgs,
			  vmin_col,vmax_col,0,mainroad.roadLen,
			  movingObserver,uObs,center_xPhys,center_yPhys);

    // (5) !!! draw depot vehicles

   if(userCanDropObjects&&(!isSmartphone)){
	depot.draw(obstacleImgs,canvas);
    }


    // (6) show simulation time and detector displays

  displayTime(time,textsize);
    for(var iDet=0; iDet<detectors.length; iDet++){
	detectors[iDet].display(textsize);
    }

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

