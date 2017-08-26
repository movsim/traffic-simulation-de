

//#############################################################
// adapt standard param settings from control_gui.js
//#############################################################

MOBIL_mandat_bSafe=18;
MOBIL_mandat_bThr=0.5;   // >0
MOBIL_mandat_bias=1.5;

MOBIL_bSafe=5;
MOBIL_bSafeMax=17;

densityInit=0;

qIn=qInInit=1600./3600; 
slider_qIn.value=3600*qIn;
slider_qInVal.innerHTML=3600*qIn+" veh/h";

speedL=speedLInit=80./3.6
slider_speedL.value=3.6*speedL;
slider_speedLVal.innerHTML=3.6*speedL+" veh/h";

truckFrac=0.30;
slider_truckFrac.value=100*truckFrac;
slider_truckFracVal.innerHTML=100*truckFrac+"%";


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

var scenarioString="RoadWorks";
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
var offLenRel=0.9;

var center_xPhys=center_xRel*refSizePhys; //[m]
var center_yPhys=center_yRel*refSizePhys;

var arcRadius=arcRadiusRel*refSizePhys;
var arcLen=arcRadius*Math.PI;
var straightLen=refSizePhys*critAspectRatio-center_xPhys;
var mainroadLen=arcLen+2*straightLen;

var uBeginRoadworks=straightLen+0.8*arcLen;
var uEndRoadworks=straightLen+1.1*arcLen;
var uStartLCMandatory=0.1*uBeginRoadworks; // uStart>u>uBeginR => mandat LC


function updatePhysicalDimensions(){ // only if sizePhys changed
    center_xPhys=center_xRel*refSizePhys; //[m]
    center_yPhys=center_yRel*refSizePhys;

    arcRadius=arcRadiusRel*refSizePhys;
    arcLen=arcRadius*Math.PI;
    straightLen=refSizePhys*critAspectRatio-center_xPhys;
    mainroadLen=arcLen+2*straightLen;

    uBeginRoadworks=straightLen+0.8*arcLen;
    uEndRoadworks=straightLen+1.1*arcLen;
    uStartLCMandatory=0.1*uBeginRoadworks;

}



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




//##################################################################
// Specification of logical road network
//##################################################################

var isRing=false;  // 0: false; 1: true
var roadID=1;
var speedInit=20; // IC for speed
var truckFracToleratedMismatch=0.2; // open system: updateSim:  need tolerance,
             // otherwise sudden changes with new incoming/outgoing vehicles

var mainroad=new road(roadID,mainroadLen,laneWidth,nLanes_main,traj_x,traj_y,
		      densityInit, speedInit,truckFracInit, isRing);


//#########################################################
// add standing virtual vehicles at position of road works 
//#########################################################

// number of virtual "roadwork" vehicles

var longModelObstacle=new ACC(0,IDM_T,IDM_s0,0,IDM_b); // needed for lagVeh!
//var LCModelObstacle=new MOBIL(MOBIL_bSafe,MOBIL_bSafe,1000,MOBIL_bBiasRight_car);
var nr=Math.round((uEndRoadworks-uBeginRoadworks)/lenRoadworkElement);

for (var ir=0; ir<nr; ir++){
    var u=uBeginRoadworks+(ir+0.5)*lenRoadworkElement;
    var virtualVeh=new vehicle(lenRoadworkElement, wRoadworkElement, 
					u,laneRoadwork, 0, "obstacle");

    mainroad.veh.push(virtualVeh); // append; prepend=unshift
}

// put roadwork obstacles at right place and let vehicles get context of them 

mainroad.sortVehicles();
mainroad.updateEnvironment();


// !! introduce stationary detectors (aug17)

var nDet=3;
var mainDetectors=[];
mainDetectors[0]=new stationaryDetector(mainroad,0.25*mainroadLen,30);
mainDetectors[1]=new stationaryDetector(mainroad,0.60*mainroadLen,30);
mainDetectors[2]=new stationaryDetector(mainroad,0.75*mainroadLen,30);


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




//speedlimit images 

var speedL_srcFileIndexOld=8; //  start with index8 = 80 km/h
var speedL_srcFileIndex=8;
var speedL_srcFiles = [];
for (var i=0; i<13; i++){
    speedL_srcFiles[i]="figs/Tempo"+i+"0.png";
}
speedL_srcFiles[13]='figs/sign_free_282_small.png'; 
var speedlimitImgs = [];
for (var i=0; i<=13; i++){
    speedlimitImgs[i]=new Image();
    speedlimitImgs[i].src=speedL_srcFiles[i];
}
var speedlimitImg=speedlimitImgs[speedL_srcFileIndex];


//####################################################################
//!!! vehicleDepot(nImgs,nRow,nCol,xDepot,yDepot,lVeh,wVeh,containsObstacles)
//####################################################################

var smallerDimPix=Math.min(canvas.width,canvas.height);
var depot=new vehicleDepot(obstacleImgs.length, 3,3,
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

    // transfer effects from slider interaction and mandatory regions
    // to the vehicles and models

    mainroad.updateTruckFrac(truckFrac, truckFracToleratedMismatch);
    mainroad.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				       LCModelCar,LCModelTruck,
				       LCModelMandatory);

    // externally impose mandatory LC behaviour
    // all left-lane vehicles must change lanes to the right
    // starting at 0 up to the position uBeginRoadworks

    mainroad.setLCMandatory(uStartLCMandatory, uBeginRoadworks, true);


    // do central simulation update of vehicles

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


    for(var iDet=0; iDet<nDet; iDet++){
	mainDetectors[iDet].update(time,dt);
    }


    // see onramp.js why this is necessary

    if(depotVehZoomBack){
	var res=depot.zoomBackVehicle();
	depotVehZoomBack=res;
	userCanvasManip=true;
    }


}//updateSim




//##################################################
function drawSim() {
//##################################################

    /* (0) redefine graphical aspects of road (arc radius etc) using
     responsive design if canvas has been resized 
     */

    var hasChanged=false;

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
    // "%20-or condition"
    //  because some older firefoxes do not start up properly?

    ctx.setTransform(1,0,0,1,0,0); 
    if(drawBackground){
	if(hasChanged||(itime<=1) || userCanvasManip || (!drawRoad)){ 
          ctx.drawImage(background,0,0,canvas.width,canvas.height);
      }
    }


    // (3) draw mainroad
    // (always drawn; but changedGeometry=true necessary
    // if changed (it triggers building a new lookup table). 
    // Otherwise, road drawn at old position

    
    var changedGeometry=userCanvasManip || hasChanged||(itime<=1); 
    mainroad.draw(roadImg1,roadImg2,scale,changedGeometry);
    mainroad.drawTrafficLights(traffLightRedImg,traffLightGreenImg);//!!!


 
    // (4) draw vehicles

    mainroad.drawVehicles(carImg,truckImg,obstacleImgs,scale,
			  vmin_col, vmax_col);
    
    // (4a) implement varying speed-limit signs! -> uphill as template

    var speedlimit_kmh=10*Math.round(3.6*longModelCar.speedlimit/10.);
    var speedL_srcFileIndex=Math.min(speedlimit_kmh/10,13);
    if( (speedL_srcFileIndex !=speedL_srcFileIndexOld)||hasChanged
	||userCanvasManip || (itime<=1) ){

	speedL_srcFileIndexOld=speedL_srcFileIndex;
	speedlimitImg=speedlimitImgs[speedL_srcFileIndex];
	console.log("speedlimitImg.src=",speedlimitImg.src);

	var sizeSignPix=0.12*refSizePix;
	var vOffset=-1.8*nLanes_main*laneWidth; // in v direction, pos if right

	var xPix=mainroad.get_xPix(0.16*mainroadLen,vOffset,scale);
	var yPix=mainroad.get_yPix(0.16*mainroadLen,vOffset,scale);
	xPix -= 0.5*sizeSignPix; // center of sign
	yPix -= 0.5*sizeSignPix;
	ctx.setTransform(1,0,0,1,0,0); 
	console.log("roadworks.draw: before drawing speedlimitImg");
	ctx.drawImage(speedlimitImg,xPix,yPix,sizeSignPix,sizeSignPix);
    }

    // (5) !!! draw depot vehicles

    depot.draw(obstacleImgs,scale,canvas);

    // (6) show simulation time and detector displays

    displayTime(time);
    for(var iDet=0; iDet<nDet; iDet++){
	mainDetectors[iDet].display();
    }


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
// (ii) when pressing the start button 
//  ("myRun=setInterval(main_loop, 1000/fps);")
//############################################

console.log("first main execution");
showInfo();
var myRun=setInterval(main_loop, 1000/fps);



 