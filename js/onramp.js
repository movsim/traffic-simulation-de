
// adapt settings from control_gui.js

densityInit=0.02; 



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

console.log("start main: canvas.width=",canvas.width,
	    " simDivWindow.clientWidth=",simDivWindow.clientWidth);

console.log("window.innerWidth=",window.innerWidth,
	    " window.innerHeight=",window.innerHeight);

console.log("$(window).width()=",$(window).width(), // nearly the same
	    " $(window).height()=",$(window).height());


console.log("after adaptation: canvas.width=",canvas.width,
	    " simDivWindow.clientWidth=",simDivWindow.clientWidth);


//##################################################################
// overall scaling (critAspectRatio should be consistent with 
// width/height in css.#contents)
//##################################################################

var refSizePhys=250;  // constants => all objects scale with refSizePix

var critAspectRatio=120./95.; // from css file width/height of #contents

var refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);
var scale=refSizePix/refSizePhys;



//##################################################################
// Specification of physical road geometry and vehicle properties
// If refSizePhys changes, change them all => updatePhysicalDimensions();
//##################################################################

// all relative "Rel" settings with respect to refSizePhys, not refSizePix!

var center_xRel=0.43;
var center_yRel=-0.5;
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



function updatePhysicalDimensions(){ // only if sizePhys changed
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
var laneWidthRamp=5;
var nLanes_main=3;
var nLanes_rmp=1;


var car_length=7; // car length in m
var car_width=5; // car width in m
var truck_length=15; // trucks
var truck_width=7; 


// on constructing road, road elements are gridded and interna
// road.traj_xy(u) are generated. The, traj_xy*Init(u) obsolete

function traj_xInit(u){ // physical coordinates
        var dxPhysFromCenter= // left side (median), phys coordinates
	    (u<straightLen) ? straightLen-u
	  : (u>straightLen+arcLen) ? u-mainroadLen+straightLen
	  : -arcRadius*Math.sin((u-straightLen)/arcRadius);
	return center_xPhys+dxPhysFromCenter;
}

function traj_yInit(u){ // physical coordinates
        var dyPhysFromCenter=
 	    (u<straightLen) ? arcRadius
	  : (u>straightLen+arcLen) ? -arcRadius
	  : arcRadius*Math.cos((u-straightLen)/arcRadius);
	return center_yPhys+dyPhysFromCenter;
}


function trajRamp_xInit(u){ // physical coordinates
	//var xMergeBegin=traj_xInit(mainroadLen-straightLen);
	var xMergeBegin=traj_xInit(mainRampOffset+rampLen-mergeLen);
	var xPrelim=xMergeBegin+(u-(rampLen-mergeLen));
	return (u<rampLen-taperLen) 
	    ? xPrelim : xPrelim-0.05*(u-rampLen+taperLen);
}


// indefining dependent geometry,
//  do not refer to mainroad or onramp!! may not be defined: 
// mainroad.nLanes => nLanes_main, onramp.nLanes=>nLanes_onramp1!!

function trajRamp_yInit(u){ // physical coordinates

    var yMergeBegin=traj_yInit(mainRampOffset+rampLen-mergeLen)
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

var truckFracToleratedMismatch=0.2; // open system: need tolerance, otherwise
                      // sudden changes with new incoming/outgoing vehicles

var speedInit=20; // IC for speed

var mainroad=new road(roadIDmain,mainroadLen,laneWidth,nLanes_main,
		      traj_xInit,traj_yInit,
		      densityInit, speedInit,truckFracInit, isRing);

var onramp=new road(roadIDramp,rampLen,laneWidth,nLanes_rmp,
		    trajRamp_xInit,trajRamp_yInit,
		    0*densityInit, speedInit, truckFracInit, isRing);


// add standing virtual vehicle at the end of onramp (1 lane)
// prepending=unshift (strange name)

var virtualStandingVeh=new vehicle(2, laneWidth, onramp.roadLen-0.6*taperLen, 0, 0, "obstacle");

onramp.veh.unshift(virtualStandingVeh);



//#########################################################
// model specifications (ALL) parameters in control_gui.js)
//#########################################################

var longModelCar;
var longModelTruck;
var LCModelCar;
var LCModelTruck;
var LCModelMandatoryRight;
var LCModelMandatoryLeft;
	
updateModels(); //  from control_gui.js  => define the 6 above models



//####################################################################
// Global graphics specification and image file settings
//####################################################################

var hasChanged=true; // window dimensions have changed (responsive design)

var drawBackground=true; // if false, default unicolor background
var drawRoad=true; // if false, only vehicles are drawn
var userCanvasManip; // true only if user-driven geometry changes

var drawColormap=false;
var vmin_col=0; // min speed for speed colormap (drawn in red)
var vmax_col=100/3.6; // max speed for speed colormap (drawn in blue-violet)


// image source files

var background_srcFile='figs/backgroundGrass.jpg'; 

var car_srcFile='figs/blackCarCropped.gif';
var truck_srcFile='figs/truck1Small.png';
var traffLightGreen_srcFile='figs/trafficLightGreen_affine.png';
var traffLightRed_srcFile='figs/trafficLightRed_affine.png';

var obstacle_srcFiles = [];
obstacle_srcFiles[0]='figs/obstacleImg.png'; // standard black bar or nothing
for (var i=1; i<10; i++){ 
    obstacle_srcFiles[i]="figs/constructionVeh"+i+".png";
    //console.log("i=",i," obstacle_srcFiles[i]=", obstacle_srcFiles[i]);
}

var road1lanes_srcFile='figs/road1lanesCrop.png';
var road2lanesWith_srcFile='figs/road2lanesCropWith.png';
var road3lanesWith_srcFile='figs/road3lanesCropWith.png';
var road4lanesWith_srcFile='figs/road4lanesCropWith.png';
var road2lanesWithout_srcFile='figs/road2lanesCropWithout.png';
var road3lanesWithout_srcFile='figs/road3lanesCropWithout.png';
var road4lanesWithout_srcFile='figs/road4lanesCropWithout.png';
var ramp_srcFile='figs/road1lanesCrop.png';


// init background image

background = new Image();
background.src =background_srcFile;

// init vehicle image(s)

carImg = new Image();
carImg.src = car_srcFile;
truckImg = new Image();
truckImg.src = truck_srcFile;

// init special objects images

traffLightRedImg = new Image();
traffLightRedImg.src=traffLightRed_srcFile;
traffLightGreenImg = new Image();
traffLightGreenImg.src=traffLightGreen_srcFile;

obstacleImgs = []; // srcFiles[0]='figs/obstacleImg.png'
for (var i=0; i<obstacle_srcFiles.length; i++){
    obstacleImgs[i]=new Image();
    obstacleImgs[i].src = obstacle_srcFiles[i];
}


// init road image(s)

roadImg1 = new Image();
roadImg1.src=(nLanes_main===1)
	? road1lanes_srcFile
	: (nLanes_main===2) ? road2lanesWith_srcFile
	: (nLanes_main===3) ? road3lanesWith_srcFile
	: road4lanesWith_srcFile;

roadImg2 = new Image();
roadImg2.src=(nLanes_main===1)
	? road1lanes_srcFile
	: (nLanes_main===2) ? road2lanesWithout_srcFile
	: (nLanes_main===3) ? road3lanesWithout_srcFile
	: road4lanesWithout_srcFile;

rampImg = new Image();
rampImg.src=ramp_srcFile;



//!!! vehicleDepot(nImgs,nRow,nCol,xDepot,yDepot,lVeh,wVeh,containsObstacles)

var smallerDimPix=Math.min(canvas.width,canvas.height);
var depot=new vehicleDepot(obstacleImgs.length, 3,3,
			   0.7*smallerDimPix/scale,
			   -0.5*smallerDimPix/scale,
			   20,20,true);




//############################################
// run-time specification and functions
//############################################

var time=0;
var itime=0;
var fps=30; // frames per second (unchanged during runtime)
var dt=timewarp/fps;


//#################################################################
function updateU(){
//#################################################################

    // update times

    time +=dt; // dt depends on timewarp slider (fps=const)
    itime++;

    // transfer effects from slider interaction 
    // and changed mandatory states to the vehicles and models 

    mainroad.updateTruckFrac(truckFrac, truckFracToleratedMismatch);
    mainroad.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				       LCModelCar,LCModelTruck);

    onramp.updateTruckFrac(truckFrac, truckFracToleratedMismatch);
    onramp.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				       LCModelCar,LCModelTruck);

    // externally impose mandatory LC behaviour
    // all onramp vehicles must change lanes to the left (last arg=false)

    onramp.setLCMandatory(0, onramp.roadLen, false);


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


    onramp.calcAccelerations();  
    onramp.updateSpeedPositions();
    onramp.updateBCdown();
    onramp.updateBCup(qOn,dt); // argument=total inflow

    //template: mergeDiverge(newRoad,offset,uStart,uEnd,isMerge,toRight)

    onramp.mergeDiverge(mainroad,mainRampOffset,
			onramp.roadLen-mergeLen,onramp.roadLen,true,false);


    //!!!
    if(depotVehZoomBack){
	var res=depot.zoomBackVehicle();
	depotVehZoomBack=res;
	userCanvasManip=true;
    }


}//updateU




//##################################################
function drawU() {
//##################################################

    //!! test relative motion isMoving

    var movingObserver=false;
    var uObs=0*time;

    /* (0) redefine graphical aspects of road (arc radius etc) using
     responsive design if canvas has been resized 
     */

    var hasChanged=false;

    console.log(" new total inner window dimension: ",
		window.innerWidth," X ",window.innerHeight,
		" (full hd 16:9 e.g., 1120:630)",
		" canvas: ",canvas.width," X ",canvas.height);


    if ((canvas.width!=simDivWindow.clientWidth)
	||(canvas.height != simDivWindow.clientHeight)){
	hasChanged=true;
	canvas.width  = simDivWindow.clientWidth;
        canvas.height  = simDivWindow.clientHeight;
	aspectRatio=canvas.width/canvas.height;
	refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);

	scale=refSizePix/refSizePhys; // refSizePhys=constant unless mobile

	updatePhysicalDimensions();

	if(true){
	    console.log("haschanged=true: new canvas dimension: ",
		        canvas.width," X ",canvas.height);
	}


    }

 


    // (1) update heading of all vehicles rel. to road axis
    // (for some reason, strange rotations at beginning)

    mainroad.updateOrientation(); 



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
    onramp.draw(rampImg,rampImg,scale,changedGeometry,
		movingObserver,0, 
		center_xPhys-mainroad.traj_x(uObs)+onramp.traj_x(0),
		center_yPhys-mainroad.traj_y(uObs)+onramp.traj_y(0)); 
    onramp.drawTrafficLights(traffLightRedImg,traffLightGreenImg);//!!!

    mainroad.draw(roadImg1,roadImg2,scale,changedGeometry,
		  movingObserver,uObs,center_xPhys,center_yPhys); 
    mainroad.drawTrafficLights(traffLightRedImg,traffLightGreenImg);//!!!


 
    // (4) draw vehicles

    onramp.drawVehicles(carImg,truckImg,obstacleImgs,scale,
			vmin_col,vmax_col,0,onramp.roadLen,
			movingObserver,0,
			center_xPhys-mainroad.traj_x(uObs)+onramp.traj_x(0),
			center_yPhys-mainroad.traj_y(uObs)+onramp.traj_y(0));


    mainroad.drawVehicles(carImg,truckImg,obstacleImgs,scale,
			  vmin_col,vmax_col,0,mainroad.roadLen,
			  movingObserver,uObs,center_xPhys,center_yPhys);

    // (5) !!! draw depot vehicles

    depot.draw(obstacleImgs,scale,canvas);


    // (6) draw some running-time vars

  if(true){
    ctx.setTransform(1,0,0,1,0,0); 
    var textsize=0.02*Math.min(canvas.width,canvas.height); // 2vw;
    ctx.font=textsize+'px Arial';

    var timeStr="Time="+Math.round(10*time)/10;
    var timeStr_xlb=textsize;

    var timeStr_ylb=1.8*textsize;
    var timeStr_width=6*textsize;
    var timeStr_height=1.2*textsize;

    ctx.fillStyle="rgb(255,255,255)";
    ctx.fillRect(timeStr_xlb,timeStr_ylb-timeStr_height,
		 timeStr_width,timeStr_height);
    ctx.fillStyle="rgb(0,0,0)";
    ctx.fillText(timeStr, timeStr_xlb+0.2*textsize,
		 timeStr_ylb-0.2*textsize);

    /*
    var scaleStr=" scale="+Math.round(10*scale)/10;
    var scaleStr_xlb=9*textsize;
    var scaleStr_ylb=timeStr_ylb;
    var scaleStr_width=5*textsize;
    var scaleStr_height=1.2*textsize;
    ctx.fillStyle="rgb(255,255,255)";
    ctx.fillRect(scaleStr_xlb,scaleStr_ylb-scaleStr_height,
		 scaleStr_width,scaleStr_height);
    ctx.fillStyle="rgb(0,0,0)";
    ctx.fillText(scaleStr, scaleStr_xlb+0.2*textsize, 
		 scaleStr_ylb-0.2*textsize);
    */


    // (6) draw the speed colormap

    if(drawColormap){
      displayColormap(0.22*refSizePix,
                   0.43*refSizePix,
                   0.1*refSizePix, 0.2*refSizePix,
		   vmin_col,vmax_col,0,100/3.6);
    }
    // revert to neutral transformation at the end!
    ctx.setTransform(1,0,0,1,0,0); 
  }
}
 



//##################################################
// Running function of the sim thread (triggered by setInterval)
//##################################################

function main_loop() {
    updateU();
    drawU();
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

