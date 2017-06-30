
//#############################################################
// adapt standard param settings from control_gui.js
//#############################################################

qIn=4000./3600; 
slider_qIn.value=3600*qIn;
slider_qInVal.innerHTML=3600*qIn+" veh/h";


truckFrac=0.15;
slider_truckFrac.value=100*truckFrac;
slider_truckFracVal.innerHTML=100*truckFrac+"%";

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
var offLen=offLenRel*refSizePhys; 
var divergeLen=0.5*offLen;

var mainRampOffset=mainroadLen-straightLen;
var taperLen=0.2*offLen;
var offRadius=3*arcRadius;


function updatePhysicalDimensions(){ // only if sizePhys changed
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


function trajOff_x(u){ // physical coordinates
	var xDivergeBegin=traj_x(mainRampOffset);
	return (u<divergeLen)
	    ? xDivergeBegin+u
	    : xDivergeBegin+divergeLen
	+offRadius*Math.sin((u-divergeLen)/offRadius);
}


function trajOff_y(u){ // physical coordinates
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

var truckFracToleratedMismatch=0.2; // open system: updateU:  need tolerance,
             // otherwise sudden changes with new incoming/outgoing vehicles

var speedInit=20; // IC for speed

duTactical=150; // anticipation distance for applying mandatory LC rules

var mainroad=new road(1,mainroadLen,laneWidth, nLanes_main,traj_x,traj_y,
		      densityInit, speedInit,truckFracInit, isRing);

var offramp=new road(2,offLen,laneWidthRamp,nLanes_rmp,trajOff_x,trajOff_y,
		     0.1*densityInit,speedInit,truckFracInit,isRing);

var offrampIDs=[2];
var offrampLastExits=[mainRampOffset+divergeLen];
var offrampToRight=[true];
mainroad.setOfframpInfo(offrampIDs,offrampLastExits,offrampToRight);
mainroad.duTactical=duTactical;


//console.log("mainroad.offrampLastExits[0]=",mainroad.offrampLastExits[0]);
//console.log("fracOff="+fracOff);
var route1=[1];  // stays on mainroad
var route2=[1,2]; // takes offramp
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
}

var obstacle_srcFile='figs/obstacleImg.png';
var road1lanes_srcFile='figs/road1lanesCrop.png';
var road2lanesWith_srcFile='figs/road2lanesCropWith.png';
var road3lanesWith_srcFile='figs/road3lanesCropWith.png';
var road4lanesWith_srcFile='figs/road4lanesCropWith.png';
var road2lanesWithout_srcFile='figs/road2lanesCropWithout.png';
var road3lanesWithout_srcFile='figs/road3lanesCropWithout.png';
var road4lanesWithout_srcFile='figs/road4lanesCropWithout.png';
var ramp_srcFile='figs/road1lanesCrop.png';

//#########################################################
// The images
//#########################################################

// background image

background = new Image();
background.src =background_srcFile;

// vehicle image(s)

carImg = new Image();
carImg.src = car_srcFile;
truckImg = new Image();
truckImg.src = truck_srcFile;

// special objects images

traffLightRedImg = new Image();
traffLightRedImg.src=traffLightRed_srcFile;
traffLightGreenImg = new Image();
traffLightGreenImg.src=traffLightGreen_srcFile;

obstacleImgs = []; // srcFiles[0]='figs/obstacleImg.png'
for (var i=0; i<obstacle_srcFiles.length; i++){
    obstacleImgs[i]=new Image();
    obstacleImgs[i].src = obstacle_srcFiles[i];
}


// road image(s)

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



//####################################################################
//!!! vehicleDepot(nImgs,nRow,nCol,xDepot,yDepot,lVeh,wVeh,containsObstacles)
//####################################################################

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
var fps=30; // frames per second
var dt=timewarp/fps;


//#################################################################
function updateU(){
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
    offramp.updateTruckFrac(truckFrac, truckFracToleratedMismatch);
    offramp.updateModelsOfAllVehicles(longModelCar,longModelTruck,
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

    offramp.updateLastLCtimes(dt); // needed since LC from main road!!
    offramp.calcAccelerations();  
    offramp.updateSpeedPositions();
    offramp.updateBCdown();


    //template: mergeDiverge(newRoad,offset,uStart,uEnd,isMerge,toRight)

    var u_antic=20;
    mainroad.mergeDiverge(offramp,-mainRampOffset,
			  mainRampOffset+taperLen,
			  mainRampOffset+divergeLen-u_antic,
			  false,true);
 
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
    offramp.draw(rampImg,rampImg,scale,changedGeometry);
    offramp.drawTrafficLights(traffLightRedImg,traffLightGreenImg);//!!!
    mainroad.draw(roadImg1,roadImg2,scale,changedGeometry);
    mainroad.drawTrafficLights(traffLightRedImg,traffLightGreenImg);//!!!

    // (4) draw vehicles

    offramp.drawVehicles(carImg,truckImg,obstacleImgs,scale,vmin_col,vmax_col);
    mainroad.drawVehicles(carImg,truckImg,obstacleImgs,scale,vmin_col,vmax_col);

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
    }

    // (6) draw the speed colormap

    if(drawColormap){ 
	displayColormap(0.22*refSizePix,
			0.43*refSizePix,
			0.1*refSizePix, 0.2*refSizePix,
			vmin_col,vmax_col,0,100/3.6);
    }


    // revert to neutral transformation at the end!
    ctx.setTransform(1,0,0,1,0,0); 
 
} // drawU
 

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

