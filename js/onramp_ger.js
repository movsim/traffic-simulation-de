
// general comments: ring.js, offramp.js (responsive design)

//#############################################################
// Initial settings
//#############################################################

// graphical settings

var hasChanged=true; // window dimensions have changed (responsive design)

var width;  // taken from html canvas tag in init()
var height; // taken from html canvas tag in init()
var center_x; // defined in init() after value of width is known
var center_y; // defined in init() after value of height is known


var drawBackground=true; // if false, default unicolor background
var drawRoad=true; // if false, only vehicles are drawn

var vmin=0; // min speed for speed colormap (drawn in red)
var vmax=100/3.6; // max speed for speed colormap (drawn in blue-violet)

// sim settings

var time=0;
var itime=0;
var fps=20; // frames per second (unchanged during runtime)
var dt=0.5; // only initialization


// physical geometry settings [m]

var sizePhys=355;    //responsive design  
var mainroadLen=770;
var nLanes=3;
var laneWidth=7;
var laneWidthRamp=5;

var straightLen=0.34*mainroadLen;      // straight segments of U
var arcLen=mainroadLen-2*straightLen; // length of half-circe arc of U
var arcRadius=arcLen/Math.PI;
var center_xPhys=95;
var center_yPhys=-105; // ypixel downwards=> physical center <0

var rampLen=240;
var mergeLen=120;
var taperLen=60;
var rampRadius=2*arcRadius;

var mainRampOffset=mainroadLen-straightLen+mergeLen-rampLen;



// specification of vehicle and traffic  properties

var car_length=7; // car length in m
var car_width=5; // car width in m
var truck_length=15; // trucks
var truck_width=7; 

// initial parameter settings (!! transfer def to GUI if variable in sliders!)
//!!! clarify mandatory changes:
// (i) here: var MOBIL_mandat_bSafe=42 ...
// (ia) here: var LCModelMandatoryLeft=new MOBIL(MOBIL_mandat_bSafe,...)
// (1b) here: onramp.LCModelMandatoryLeft=LCModelMandatoryLeft
// (ii) road.js: road.mandat_bSafe=17
// (iia) road.js: this.LCModelMandatoryLeft=new MOBIL(17,0,-17/2) for diverges
//       (formulated with road.mandat_bSafe)
// (iii) function road.prototype.mergeDiverge: local variable merge_bSafe=road.mandat_bSafe
// (iv) longitudinal deceleration IDM.bmax=16

var MOBIL_bSafe=4;     // bSafe if v to v0
var MOBIL_bSafeMax=17; // bSafe if v to 0 //!!! use it
var MOBIL_bThr=0.4;
var MOBIL_bBiasRight_car=-0.4; // four times for trucks (onramp_gui.js)
var MOBIL_bBiasRight_truck=0.1; // four times for trucks (onramp_gui.js)

var MOBIL_mandat_bSafe=42;
var MOBIL_mandat_bThr=0;
var MOBIL_mandat_bias=42;

var dt_LC=4; // duration of a lane change

// simulation initial conditions settings
//(initial values and range of user-ctrl var in gui.js)

var speedInit=20; // m/s
var densityInit=0.02;
var speedInitPerturb=13;
var relPosPerturb=0.8;
var truckFracToleratedMismatch=0.2; // open system: need tolerance, otherwise sudden changes


//var qIn=1.0;
//var qOn=0.15;

//############################################################################
// image file settings
//############################################################################



var car_srcFile='figs/blackCarCropped.gif';
var truck_srcFile='figs/truck1Small.png';
var obstacle_srcFile='figs/obstacleImg.png';
var road1lane_srcFile='figs/oneLaneRoadRealisticCropped.png';
var road2lanes_srcFile='figs/twoLanesRoadRealisticCropped.png';
var road3lanes_srcFile='figs/threeLanesRoadRealisticCropped.png';
var ramp_srcFile='figs/oneLaneRoadRealisticCropped.png';

// Notice: set drawBackground=false if no bg wanted
var background_srcFile='figs/backgroundGrass.jpg'; 

var scaleFactorImg=mainroadLen/1700; //[Pixel/m]



//#################################
// Global graphics specification
//#################################

var canvas;
var ctx;  // graphics context
 
var background;
 



//###############################################################
// physical (m) road, vehicle and model specification
//###############################################################

// IDM_v0 etc and updateModels() with actions  "longModelCar=new IDM(..)" etc
// defined in gui.js

var longModelCar;
var longModelTruck;
var LCModelCar;
var LCModelTruck;
var LCModelMandatoryRight=new MOBIL(MOBIL_mandat_bSafe, MOBIL_mandat_bSafe, 
				    MOBIL_mandat_bThr, MOBIL_mandat_bias);
var LCModelMandatoryLeft=new MOBIL(MOBIL_mandat_bSafe, MOBIL_mandat_bSafe, 
				    MOBIL_mandat_bThr, -MOBIL_mandat_bias);

updateModels(); 
    //mainroad.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				      // LCModelCar,LCModelTruck);

var isRing=0;  // 0: false; 1: true
var roadIDmain=1;
var roadIDramp=2;
var mainroad=new road(roadIDmain, mainroadLen, nLanes, 0.1*densityInit, speedInit, 
		      truckFracInit, isRing);
var onramp=new road(roadIDramp, rampLen, 1, densityInit, speedInit, truckFracInit, isRing);
onramp.LCModelMandatoryRight=LCModelMandatoryRight; //unique mandat LC model
onramp.LCModelMandatoryLeft=LCModelMandatoryLeft; //unique mandat LC model


// add standing virtual vehicle at the end of onramp (1 lane)
// prepending=unshift (strange name)

var virtualStandingVeh=new vehicle(2, laneWidth, rampLen-0.6*taperLen, 0, 0, "obstacle");
var longModelObstacle=new IDM(0,IDM_T,IDM_s0,0,IDM_b);
var LCModelObstacle=new MOBIL(MOBIL_bSafe, MOBIL_bSafe,1000,MOBIL_bBiasRight_car);
virtualStandingVeh.longModel=longModelObstacle;
virtualStandingVeh.LCModel=LCModelObstacle;
onramp.veh.unshift(virtualStandingVeh);
if(false){
        console.log("\nonramp.nveh="+onramp.nveh);
	for(var i=0; i<onramp.veh.length; i++){
	    console.log("i="+i
			+" onramp.veh[i].type="+onramp.veh[i].type
			+" onramp.veh[i].u="+onramp.veh[i].u
			+" onramp.veh[i].v="+onramp.veh[i].v
			+" onramp.veh[i].lane="+onramp.veh[i].lane
			+" onramp.veh[i].laneOld="+onramp.veh[i].laneOld);
	}
	console.log("\n");
}




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

    // transfer effects from slider interaction 
    // and changed mandatory states to the vehicles and models 


    mainroad.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				       LCModelCar,LCModelTruck);
    mainroad.updateTruckFrac(truckFrac, truckFracToleratedMismatch);
    onramp.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				       LCModelCar,LCModelTruck);
    onramp.updateTruckFrac(truckFrac, truckFracToleratedMismatch);

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

    if(true){
	for (var i=0; i<mainroad.nveh; i++){
	    if(mainroad.veh[i].speed<0){
		console.log("speed "+mainroad.veh[i].speed
			    +" of mainroad vehicle "
			    +i+" is negative!");
	    }
	}
    }

    onramp.calcAccelerations();  
    onramp.updateSpeedPositions();
    onramp.updateBCdown();
    onramp.updateBCup(qOn,dt); // argument=total inflow

    //template: mergeDiverge(newRoad,offset,uStart,uEnd,isMerge,toRight)

    onramp.mergeDiverge(mainroad,mainRampOffset,
			rampLen-mergeLen,rampLen,true,false);
 
    //logging

    if(false){
        console.log("\nafter updateU: itime="+itime+" mainroad.nveh="+mainroad.nveh);
	for(var i=0; i<mainroad.veh.length; i++){
	    console.log("i="+i+" mainroad.veh[i].u="+mainroad.veh[i].u
			+" mainroad.veh[i].v="+mainroad.veh[i].v
			+" mainroad.veh[i].lane="+mainroad.veh[i].lane
			+" mainroad.veh[i].laneOld="+mainroad.veh[i].laneOld);
	}
        console.log("\nonramp.nveh="+onramp.nveh);
	for(var i=0; i<onramp.veh.length; i++){
	    console.log("i="+i
			+" onramp.veh[i].type="+onramp.veh[i].type
			+" onramp.veh[i].u="+onramp.veh[i].u
			+" onramp.veh[i].v="+onramp.veh[i].v
			+" onramp.veh[i].speed="+onramp.veh[i].speed);
	}
	console.log("\n");
    }

}//updateU




//##################################################
function drawU() {
//##################################################

    // resize drawing region if browser's dim has changed (responsive design)
    // canvas_resize(canvas,aspectRatio)
    hasChanged=canvas_resize(canvas,1.65); 
    if(hasChanged){
        console.log(" new canvas size ",canvas.width,"x",canvas.height);
    }


    // (1) define road geometry as parametric functions of arclength u
    // (physical coordinates!)

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
	var xMergeBegin=traj_x(mainroadLen-straightLen);
	var xPrelim=xMergeBegin+(u-(rampLen-mergeLen));
	return (u<rampLen-taperLen) 
	    ? xPrelim : xPrelim-0.05*(u-rampLen+taperLen);
    }

    function trajRamp_y(u){ // physical coordinates
	var yMergeBegin=center_yPhys-arcRadius
	    -0.5*laneWidth*(mainroad.nLanes+onramp.nLanes)-0.02*laneWidth;
	var yMergeEnd=yMergeBegin+laneWidth;
	return (u<rampLen-mergeLen) 
	    ? yMergeBegin - 0.5*Math.pow(rampLen-mergeLen-u,2)/rampRadius
	    : (u<rampLen-taperLen) ? yMergeBegin
	    : (u<rampLen-0.5*taperLen) 
            ? yMergeBegin+2*laneWidth*Math.pow((u-rampLen+taperLen)/taperLen,2)
	    : yMergeEnd - 2*laneWidth*Math.pow((u-rampLen)/taperLen,2);
    }


    // update heading of all vehicles rel. to road axis
    // (for some reason, strange rotations at beginning)

    mainroad.updateOrientation(); 



    // (2) reset transform matrix and draw background
    // (only needed if no explicit road drawn)

    ctx.setTransform(1,0,0,1,0,0); 
    if(drawBackground){
	if(hasChanged||(itime<=2) || false || (!drawRoad)){ 
        ctx.drawImage(background,0,0,canvas.width,canvas.height);
      }
    }


    // (3) draw mainroad and ramp

    onramp.draw(rampImg,scale,trajRamp_x,trajRamp_y,laneWidthRamp);
    mainroad.draw(roadImg,scale,traj_x,traj_y,laneWidth);


 
    // (4) draw vehicles

    onramp.drawVehicles(carImg,truckImg,obstacleImg,scale,trajRamp_x,trajRamp_y,
			laneWidth, vmin, vmax);
    mainroad.drawVehicles(carImg,truckImg,obstacleImg,scale,traj_x,traj_y,
			  laneWidth, vmin, vmax);



    // (5) draw some running-time vars
  if(true){
    ctx.setTransform(1,0,0,1,0,0); 
    var textsize=14;
    //var textsize=scale*20;
    ctx.font=textsize+'px Arial';

    var timeStr="Zeit="+Math.round(10*time)/10;
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

    
    var timewStr="Zeitraffer="+Math.round(10*timewarp)/10;
    var timewStr_xlb=8*textsize;
    var timewStr_ylb=timeStr_ylb;
    var timewStr_width=7*textsize;
    var timewStr_height=1.2*textsize;
    ctx.fillStyle="rgb(255,255,255)";
    ctx.fillRect(timewStr_xlb,timewStr_ylb-timewStr_height,
		 timewStr_width,timewStr_height);
    ctx.fillStyle="rgb(0,0,0)";
    ctx.fillText(timewStr, timewStr_xlb+0.2*textsize,
		 timewStr_ylb-0.2*textsize);
    
    
    var scaleStr="Skala="+Math.round(10*scale)/10;
    var scaleStr_xlb=16*textsize;
    var scaleStr_ylb=timeStr_ylb;
    var scaleStr_width=5*textsize;
    var scaleStr_height=1.2*textsize;
    ctx.fillStyle="rgb(255,255,255)";
    ctx.fillRect(scaleStr_xlb,scaleStr_ylb-scaleStr_height,
		 scaleStr_width,scaleStr_height);
    ctx.fillStyle="rgb(0,0,0)";
    ctx.fillText(scaleStr, scaleStr_xlb+0.2*textsize, 
		 scaleStr_ylb-0.2*textsize);
    

    var genVarStr="LKW-Anteil="+Math.round(100*truckFrac)+"\%";
    var genVarStr_xlb=24*textsize;
    var genVarStr_ylb=timeStr_ylb;
    var genVarStr_width=7.2*textsize;
    var genVarStr_height=1.2*textsize;
    ctx.fillStyle="rgb(255,255,255)";
    ctx.fillRect(genVarStr_xlb,genVarStr_ylb-genVarStr_height,
		 genVarStr_width,genVarStr_height);
    ctx.fillStyle="rgb(0,0,0)";
    ctx.fillText(genVarStr, genVarStr_xlb+0.2*textsize, 
		 genVarStr_ylb-0.2*textsize);
    

    var genVarStr="qIn="+Math.round(3600*qIn)+"Fz/h";
    var genVarStr_xlb=32*textsize;
    var genVarStr_ylb=timeStr_ylb;
    var genVarStr_width=7.2*textsize;
    var genVarStr_height=1.2*textsize;
    ctx.fillStyle="rgb(255,255,255)";
    ctx.fillRect(genVarStr_xlb,genVarStr_ylb-genVarStr_height,
		 genVarStr_width,genVarStr_height);
    ctx.fillStyle="rgb(0,0,0)";
    ctx.fillText(genVarStr, genVarStr_xlb+0.2*textsize, 
		 genVarStr_ylb-0.2*textsize);

    // (6) draw the speed colormap

    drawColormap(scale*center_xPhys, -scale*center_yPhys, scale*50, scale*50,
		 vmin,vmax,0,100/3.6);

    // revert to neutral transformation at the end!
    ctx.setTransform(1,0,0,1,0,0); 
  }
}
 




function init() {
    // "canvas_onramp" defined in onramp.html
    canvas = document.getElementById("canvas_onramp"); 
    ctx = canvas.getContext("2d");
 
    background = new Image();
    background.src =background_srcFile;

    //console.log("image size of background:"+background.naturalWidth); 

    width = canvas.width;   // pixel coordinates
    height = canvas.height;

    center_x=0.50*width*scaleFactorImg; // pixel coordinates
    center_y=0.48*height*scaleFactorImg;

    // init vehicle image(s)

    carImg = new Image();
    carImg.src = car_srcFile;
    truckImg = new Image();
    truckImg.src = truck_srcFile;
    obstacleImg = new Image();
    obstacleImg.src = obstacle_srcFile;

	// init road image(s)

    roadImg = new Image();
    roadImg.src=(nLanes==1)
	? road1lane_srcFile
	: (nLanes==2) ? road2lanes_srcFile
	: road3lanes_srcFile;
    rampImg = new Image();
    rampImg.src=ramp_srcFile;


    // apply externally functions of mouseMove events 
    // to initialize sliders settings

    change_timewarpSliderPos(timewarp);
    //change_scaleSliderPos(scale);
    change_truckFracSliderPos(truckFrac);
    change_qInSliderPos(qInInit);
    change_qOnSliderPos(qOnInit);

    change_IDM_v0SliderPos(IDM_v0);
    change_IDM_TSliderPos(IDM_T);
    change_IDM_s0SliderPos(IDM_s0);
    change_IDM_aSliderPos(IDM_a);
    change_IDM_bSliderPos(IDM_b);


    // starts simulation thread "main_loop" (defined below) 
    // with update time interval 1000/fps milliseconds

    return setInterval(main_loop, 1000/fps); 
} // end init()


//##################################################
// Running function of the sim thread (triggered by setInterval)
//##################################################

function main_loop() {
    drawU();
    updateU();
}
 

//##################################################
// Actual start of the simulation thread
// (also started from gui.js "Onramp" button) 
//##################################################

 
 var myRun=init(); //if start with onramp: init, starts thread "main_loop" 

