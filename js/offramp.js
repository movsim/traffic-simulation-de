
var userCanDistortRoads=true;
var userCanDropObstaclesAndTL=true;

//#############################################################
// adapt standard param settings from control_gui.js
//#############################################################

qIn=3500./3600; 
slider_qIn.value=3600*qIn;
slider_qInVal.innerHTML=3600*qIn+" veh/h";

densityInit=0.015;

truckFrac=0.15;
slider_truckFrac.value=100*truckFrac;
slider_truckFracVal.innerHTML=100*truckFrac+"%";

IDM_a=0.7; // low to allow stopGo
slider_IDM_a.value=IDM_a;
slider_IDM_aVal.innerHTML=IDM_a+" m/s<sup>2</sup>";
factor_a_truck=1; // to allow faster slowing down of the uphill trucks

MOBIL_mandat_bSafe=22; // standard 42
MOBIL_mandat_bThr=0;   
MOBIL_mandat_bias=22;

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

var scenarioString="OffRamp";
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
// width/height in css.#contents)
//##################################################################

const mqSmartphoneLandscape //xxx
      = window.matchMedia( "(min-aspect-ratio: 6/5) and (max-height: 500px)" );
const mqSmartphonePortrait
      = window.matchMedia( "(max-aspect-ratio: 6/5) and (max-width: 500px)" );
var isSmartphone=mqSmartphone();

var refSizePhys=(isSmartphone) ? 150 : 250;  // constant

var critAspectRatio=120./95.; // from css file width/height of #contents

var refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);
var scale=refSizePix/refSizePhys;


//##################################################################
// Specification of physical road geometry and vehicle properties
// If refSizePhys changes, change them all => updatePhysicalDimensions();
//##################################################################

// all relative "Rel" settings with respect to refSizePhys, not refSizePix!

var center_xRel=0.43;
var center_yRel=-0.53;
var arcRadiusRel=0.35;
var offLenRel=0.9;

var center_xPhys=center_xRel*refSizePhys; //[m]
var center_yPhys=center_yRel*refSizePhys;

var arcRadius=arcRadiusRel*refSizePhys;
var arcLen=arcRadius*Math.PI;
var straightLen=refSizePhys*critAspectRatio-center_xPhys;
var mainroadLen=arcLen+2*straightLen;

var offLen=offLenRel*refSizePhys; 
var divergeLen=0.5*offLen;

var mainRampOffset=mainroadLen-straightLen;
var taperLen=0.2*offLen;
var offRadius=3*arcRadius;


function updatePhysicalDimensions(){ // only if sizePhys changed (mobile)
    center_xPhys=center_xRel*refSizePhys; //[m]
    center_yPhys=center_yRel*refSizePhys;

    arcRadius=arcRadiusRel*refSizePhys;
    arcLen=arcRadius*Math.PI;
    straightLen=refSizePhys*critAspectRatio-center_xPhys;
    mainroadLen=arcLen+2*straightLen;
    offLen=offLenRel*refSizePhys; 
    divergeLen=0.5*offLen;

    mainRampOffset=mainroadLen-straightLen;
    taperLen=0.2*offLen;
    offRadius=3*arcRadius;
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
// road.traj_xy(u) are generated. Then, main.traj_xy*(u) obsolete


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
	var xDivergeBegin=traj_x(mainRampOffset);
	return (u<divergeLen)
	    ? xDivergeBegin+u
	    : xDivergeBegin+divergeLen
	+offRadius*Math.sin((u-divergeLen)/offRadius);
}


function trajRamp_y(u){ // physical coordinates
    	var yDivergeBegin=traj_y(mainRampOffset)
	    -0.5*laneWidth*(nLanes_main+nLanes_rmp)-0.02*laneWidth;
	return (u<taperLen)
            ? yDivergeBegin+laneWidth-laneWidth*u/taperLen: (u<divergeLen)
	    ? yDivergeBegin
	    : yDivergeBegin -offRadius*(1-Math.cos((u-divergeLen)/offRadius));
}




//##################################################################
// Specification of logical road network
//##################################################################

var isRing=false;  // 0: false; 1: true
var roadIDmain=1;
var roadIDramp=2;

var truckFracToleratedMismatch=0.2; // open system: updateSim:  need tolerance,
             // otherwise sudden changes with new incoming/outgoing vehicles

var speedInit=20; // IC for speed

duTactical=250; // anticipation distance for applying mandatory LC rules

var mainroad=new road(1,mainroadLen,laneWidth, nLanes_main,traj_x,traj_y,
		      densityInit, speedInit,truckFracInit, isRing,userCanDistortRoads);

var ramp=new road(2,offLen,laneWidthRamp,nLanes_rmp,trajRamp_x,trajRamp_y,
		     0.1*densityInit,speedInit,truckFracInit,isRing,false);

var offrampIDs=[2];
var offrampLastExits=[mainRampOffset+divergeLen];
var offrampToRight=[true];
mainroad.setOfframpInfo(offrampIDs,offrampLastExits,offrampToRight);
mainroad.duTactical=duTactical;


//console.log("mainroad.offrampLastExits[0]=",mainroad.offrampLastExits[0]);
//console.log("fracOff="+fracOff);
var route1=[1];  // stays on mainroad
var route2=[1,2]; // takes ramp
for (var i=0; i<mainroad.veh.length; i++){
    mainroad.veh[i].route=(Math.random()<fracOff) ? route2 : route1;
    //console.log("mainroad.veh["+i+"].route="+mainroad.veh[i].route);
}



//#########################################################
// model specifications (ALL) parameters in control_gui.js)
//#########################################################

var longModelCar;
var longModelTruck;
var LCModelCar;
var LCModelTruck;
var LCModelMandatory; // left right disting in road.updateModelsOfAllVehicles
	
updateModels(); //  from control_gui.js  => define the 5 above models


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

console.log("roadImg1=",roadImg1," rampImg=",rampImg);

//####################################################################
//!!! vehicleDepot(nImgs,nRow,nCol,xDepot,yDepot,lVeh,wVeh,containsObstacles)
//####################################################################

var smallerDimPix=Math.min(canvas.width,canvas.height);
var depot=new vehicleDepot(obstacleImgs.length, 2,3,
			   0.7*smallerDimPix/scale,
			   -0.5*smallerDimPix/scale,
			   30,30,true);


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

    // update times

    time +=dt; // dt depends on timewarp slider (fps=const)
    itime++;
    isSmartphone=mqSmartphone();

    // transfer effects from slider interaction and mandatory regions
    // to the vehicles and models


    mainroad.updateTruckFrac(truckFrac, truckFracToleratedMismatch);
    mainroad.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				       LCModelCar,LCModelTruck,
				       LCModelMandatory);
    ramp.updateTruckFrac(truckFrac, truckFracToleratedMismatch);
    ramp.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				      LCModelCar,LCModelTruck,
				       LCModelMandatory);


    // do central simulation update of vehicles

    mainroad.updateLastLCtimes(dt);
    mainroad.calcAccelerations();  
    mainroad.changeLanes();         
    mainroad.updateSpeedPositions();
    mainroad.updateBCdown();
    var route=(Math.random()<fracOff) ? route2 : route1;
    mainroad.updateBCup(qIn,dt,route); // qIn=total inflow, route opt. arg.
    //mainroad.writeVehicleRoutes(0.5*mainroad.roadLen,mainroad.roadLen);//!!!

    ramp.updateLastLCtimes(dt); // needed since LC from main road!!
    ramp.calcAccelerations();  
    ramp.updateSpeedPositions();
    ramp.updateBCdown();


    //template: mergeDiverge(newRoad,offset,uStart,uEnd,isMerge,toRight)

    var u_antic=20;
    mainroad.mergeDiverge(ramp,-mainRampOffset,
			  mainRampOffset+taperLen,
			  mainRampOffset+divergeLen-u_antic,
			  false,true);
     if(userCanDropObstaclesAndTL&&(!isSmartphone)){
	if(depotVehZoomBack){
	    var res=depot.zoomBackVehicle();
	    depotVehZoomBack=res;
	    userCanvasManip=true;
	}
    }

 

}//updateSim




//##################################################
function drawSim() {
//##################################################

    // (0) redefine graphical aspects of road (arc radius etc) using
    // responsive design if canvas has been resized 
    // isSmartphone defined in updateSim
 
    var relTextsize_vmin=(isSmartphone) ? 0.03 : 0.02; //xxx
    var textsize=relTextsize_vmin*Math.min(canvas.width,canvas.height);

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

    

    // (2) reset transform matrix and draw background
    // (only needed if no explicit road drawn)
    // "%20-or condition"
    //  because some older firefoxes do not start up properly?

    ctx.setTransform(1,0,0,1,0,0); 
    if(drawBackground){
	if(userCanvasManip||hasChanged||(itime<=1) 
	   || (itime===20) || false || (!drawRoad)){

         ctx.drawImage(background,0,0,canvas.width,canvas.height);
      }
    }


    // (3) draw mainroad and ramps (offramp "bridge" => draw last)
    // and vehicles (directly after frawing resp road or separately, depends)
    // (always drawn; changedGeometry only triggers building a new lookup table)

    var changedGeometry=userCanvasManip || hasChanged||(itime<=1); 
    ramp.draw(rampImg,rampImg,scale,changedGeometry);
    ramp.drawTrafficLights(traffLightRedImg,traffLightGreenImg);//!!!
    mainroad.draw(roadImg1,roadImg2,scale,changedGeometry);
    mainroad.drawTrafficLights(traffLightRedImg,traffLightGreenImg);//!!!

    // (4) draw vehicles

    ramp.drawVehicles(carImg,truckImg,obstacleImgs,scale,vmin_col,vmax_col);
    mainroad.drawVehicles(carImg,truckImg,obstacleImgs,scale,vmin_col,vmax_col);

    // (5) !!! draw depot vehicles

    if(userCanDropObstaclesAndTL&&(!isSmartphone)){
	depot.draw(obstacleImgs,scale,canvas);
    }
 

    // (6) draw some running-time vars

    displayTime(time,textsize);


    // (7) draw the speed colormap

    if(drawColormap){ 
	displayColormap(0.22*refSizePix,
			0.43*refSizePix,
			0.1*refSizePix, 0.2*refSizePix,
			vmin_col,vmax_col,0,100/3.6);
    }


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
// (ii) when pressing the start button defined in onramp_gui.js
//  ("myRun=setInterval(main_loop, 1000/fps);")
//############################################

console.log("first main execution");
showInfo();
var myRun=setInterval(main_loop, 1000/fps);

