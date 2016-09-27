
// main simulation script; one separate script for each scenario;
// and one separate html page where only the respective sim script is loaded

//#############################################################
// Initial settings
//#############################################################

// global appearance settings

// !!! HEINEOUS slowdown bug 
// if size of background != size of background image (800x800)
// everything slower by factor of 2-3 and jerky !!!
// define canvas size in html file;
// take everything from canvas at init*() time !!!

// also see "slowdown" keyword(s) below 


// graphical settings

var hasChanged=true; // window dimensions have changed (responsive design)

var drawBackground=true; // if false, default unicolor background
var drawRoad=true; // if false, only vehicles are drawn

var vmin=0; // min speed for speed colormap (drawn in red)
var vmax=100/3.6; // max speed for speed colormap (drawn in blue-violet)




// physical geometry settings

var sizePhys=290;    //responsive design  
var center_xPhys=145;
var center_yPhys=-155; // ypixel downwards=> physical center <0

var roadRadius=120; // 90 change scaleInit in gui.js correspondingly
var roadLen=roadRadius*2*Math.PI;
var nLanes=3;
var laneWidth=10;

// specification of vehicle and traffic  properties

var car_length=7; // car length in m
var car_width=6; // car width in m
var truck_length=15; // trucks
var truck_width=7; 

// initial parameter settings (!! transfer def to GUI if variable in sliders!)

var MOBIL_bSafe=4;
var MOBIL_bThr=0.4;
var MOBIL_bBiasRight_car=0.05; 
var MOBIL_bBiasRight_truck=0.2; 
var dt_LC=4; // duration of a lane change

// simulation initial conditions settings
//(initial values and range of user-ctrl var in gui.js)

var speedInit=20; // m/s
var speedInitPerturb=13;
var relPosPerturb=0.8;
// densityInit etc in gui.js


var truckFracToleratedMismatch=0.02; // open system: need tolerance, otherwise sudden changes

// simulation initial conditions settings
//(initial values and range of user-ctrl var in gui.js)

// densityInit in gui.js



//####################################################################
// image file settings
//####################################################################



//var car_srcFile='figs/carSmall2.png'; // ringNewOrig.js
var car_srcFile='figs/blackCarCropped.gif';
var truck_srcFile='figs/truck1Small.png';
var obstacle_srcFile='figs/obstacleImg.png';
var road1lane_srcFile='figs/oneLaneRoadRealisticCropped.png';
var road2lanes_srcFile='figs/twoLanesRoadRealisticCropped.png';
var road3lanes_srcFile='figs/threeLanesRoadRealisticCropped.png';

// Notice: set drawBackground=false if no bg wanted
 var background_srcFile='figs/backgroundGrass.jpg'; 


var scaleFactorImg=roadRadius/280; // [Pixel/m]



//#################################
// Global graphics specification
//#################################

var canvas;
var ctx;  // graphics context
 
var background;
 


//###############################################################
// physical (m) road and vehicles  specification
//###############################################################


var longModelCar;
var longModelTruck;
var LCModelCar;
var LCModelTruck; 
updateModels(); 

var isRing=1;  // 0: false; 1: true
var roadID=1;
var mainroad=new road(roadID, roadLen, nLanes, densityInit, speedInit, 
		      truckFracInit, isRing);

var veh=mainroad.veh;  // should be not needed in final stage=>onramp.js

// initial perturbation of the vehicles 
// first actual action apart from constructors 
// (can be seen as extension of the constructor)

var iveh=Math.floor(relPosPerturb*mainroad.veh.length);
iveh=Math.max(0, Math.min(iveh,mainroad.veh.length)); 
mainroad.veh[iveh].speed=speedInitPerturb;


//############################################
// run-time specification and functions
//############################################

var time=0;
var itime=0;
var fps=30; // frames per second
var dt=timewarp/fps;


//############################################
function updateRing(){
//############################################

    // update times

    time +=dt; // dt depends on timewarp slider (fps=const)
    itime++;

    // transfer effects from slider interaction to the vehicles and models: 
    // modelparam sliders (updateModelsOfAllVehicles), density, truckFrac sliders

    mainroad.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				       LCModelCar,LCModelTruck);
    mainroad.updateTruckFrac(truckFrac, truckFracToleratedMismatch);
    mainroad.updateDensity(density);



    // do central simulation update of vehicles

    mainroad.updateLastLCtimes(dt);
    mainroad.calcAccelerations();  
    mainroad.changeLanes();         
    mainroad.updateSpeedPositions();
    //mainroad.writeVehicles();
}








//##################################################
function drawRing() {
//##################################################

    // resize drawing region if browser's dim has changed (responsive design)
    // canvas_resize(canvas,aspectRatio)
    hasChanged=canvas_resize(canvas,0.96); 
    if(hasChanged){
        console.log(" new canvas size ",canvas.width,"x",canvas.height);
    }


    // (1) define road geometry as parametric functions of arclength u
    // (physical coordinates!)

    function traj_x(u){
        return center_xPhys + roadRadius*Math.cos(u/roadRadius);
    }

    function traj_y(u){
        return center_yPhys + roadRadius*Math.sin(u/roadRadius);
    }

    // update heading of all vehicles rel. to road axis
    // (for some reason, strange rotations at beginning)

    mainroad.updateOrientation(); 


 
    // (2) reset transform matrix and draw background
    // (only needed if no explicit road drawn)
    // sloppy at first drawing. 
    // Remind running engine at increasing time spans...

    ctx.setTransform(1,0,0,1,0,0); 
    if(drawBackground){
	if(hasChanged||(itime<=1) || false || (!drawRoad)){ 
            ctx.drawImage(background,0,0,canvas.width,canvas.height);
	}
    }

    // (3) draw ring road

    mainroad.draw(roadImg,scale,traj_x,traj_y,laneWidth);

    // (4) draw vehicles

    mainroad.drawVehicles(carImg,truckImg,obstacleImg,scale,traj_x,traj_y,
			  laneWidth, vmin, vmax);


    // draw some running-time vars

    ctx.setTransform(1,0,0,1,0,0); 
    var textsize=14;
    //var textsize=scale*20;
    ctx.font=textsize+'px Arial';

    var timeStr="Zeit="+Math.round(10*time)/10;
    var timeStr_xlb=textsize;
    var timeStr_ylb=2*textsize;
    var timeStr_width=5*textsize;
    var timeStr_height=1.2*textsize;
    ctx.fillStyle="rgb(255,255,255)";
    ctx.fillRect(timeStr_xlb,timeStr_ylb-timeStr_height,timeStr_width,timeStr_height);
    ctx.fillStyle="rgb(0,0,0)";
    ctx.fillText(timeStr, timeStr_xlb+0.2*textsize, timeStr_ylb-0.2*textsize);

    
    var timewStr="Zeitraffer="+Math.round(10*timewarp)/10;
    var timewStr_xlb=8*textsize;
    var timewStr_ylb=2*textsize;
    var timewStr_width=7*textsize;
    var timewStr_height=1.2*textsize;
    ctx.fillStyle="rgb(255,255,255)";
    ctx.fillRect(timewStr_xlb,timewStr_ylb-timewStr_height,timewStr_width,timewStr_height);
    ctx.fillStyle="rgb(0,0,0)";
    ctx.fillText(timewStr, timewStr_xlb+0.2*textsize, timewStr_ylb-0.2*textsize);
    
    var densStr="Dichte="+Math.round(10000*density)/10;
    var densStr_xlb=16*textsize;
    var densStr_ylb=2*textsize;
    var densStr_width=7*textsize;
    var densStr_height=1.2*textsize;
    ctx.fillStyle="rgb(255,255,255)";
    ctx.fillRect(densStr_xlb,densStr_ylb-densStr_height,densStr_width,densStr_height);
    ctx.fillStyle="rgb(0,0,0)";
    ctx.fillText(densStr, densStr_xlb+0.2*textsize, densStr_ylb-0.2*textsize);
    
    var scaleStr="Skala="+Math.round(10*scale)/10;
    var scaleStr_xlb=24*textsize;
    var scaleStr_ylb=2*textsize;
    var scaleStr_width=7*textsize;
    var scaleStr_height=1.2*textsize;
    ctx.fillStyle="rgb(255,255,255)";
    ctx.fillRect(scaleStr_xlb,scaleStr_ylb-scaleStr_height,scaleStr_width,scaleStr_height);
    ctx.fillStyle="rgb(0,0,0)";
    ctx.fillText(scaleStr, scaleStr_xlb+0.2*textsize, scaleStr_ylb-0.2*textsize);
    

    var genVarStr="LKW-Anteil="+Math.round(100*truckFrac)+"\%";
    var genVarStr_xlb=32*textsize;
    var genVarStr_ylb=2*textsize;
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
 

//############################################
// initialization function of the simulation thread
// THIS function does all the things; everything else only functions
// ultimately called by init()
// activation of init: 
// (i) automatically when loading the simulation ("var myRun=init();" below) 
// (ii) when pressing the start button defined in onramp_gui.js ("myRun=init();")
// "var ..." Actually does something; 
// function keyword [function fname(..)] defines only
//############################################

// in init() definition no "var" (otherwise local to init())
// "init()" since first scenario=onramp. 
// Called at the end of this script and in *_gui.js (corresp. sim button)

function init() {
    canvas = document.getElementById("canvas_ring"); // "canvas_ring" defined in ring.html
    ctx = canvas.getContext("2d");


    // init background image 
    // and width and height of the sim window
    // and centering of the road image

    // !! although background.naturalWidth etc gives correct real width, 
    // setting this dimension as width does NOT resolve slowdown bug.
    // direct setting  (width=800 ...) does not resolve it as well.
    // ONLY heritage from html (width = canvas.width ...) does it!!!


    background = new Image();
    background.src =background_srcFile;
    //background.onload = function() {
    //  console.log("image size of background:"+this.width +'x'+ this.height);
    //}

    //console.log("image size of background:"+background.naturalWidth); 

    width = canvas.width;
    height = canvas.height;
    //width = background.naturalWidth
    //height = background.naturalHeight
    //width=800;
    //height=800;

    center_x=0.50*width*scaleFactorImg;
    center_y=0.48*height*scaleFactorImg;


	// init background image

    background = new Image();
    background.src =background_srcFile;
 
	// init vehicle image(s)

    carImg = new Image();
    carImg.src = car_srcFile;
    truckImg = new Image();
    truckImg.src = truck_srcFile;
    obstacleImg = new Image();  // only pro forma (no obstacles here)
    obstacleImg.src = obstacle_srcFile;

	// init road image(s)

    roadImg = new Image();
    roadImg.src=(nLanes==1)
	? road1lane_srcFile
	: (nLanes==2) ? road2lanes_srcFile
	: road3lanes_srcFile;


    // apply externally functions of mouseMove events  to initialize sliders settings

    change_timewarpSliderPos(timewarp);
    change_densitySliderPos(density);
    //change_scaleSliderPos(scale);
    change_truckFracSliderPos(truckFrac);

    change_IDM_v0SliderPos(IDM_v0);
    change_IDM_TSliderPos(IDM_T);
    change_IDM_s0SliderPos(IDM_s0);
    change_IDM_aSliderPos(IDM_a);
    change_IDM_bSliderPos(IDM_b);


    // starts simulation thread "main_loop" (defined below) 
    // with update time interval 1000/fps milliseconds
    // thread starts with "var myRun=init();" or "myRun=init();" (below)
    // thread stops with "clearInterval(myRun);" 

    return setInterval(main_loop, 1000/fps); 
} // end init()


//##################################################
// Running function of the sim thread (triggered by setInterval)
//##################################################

function main_loop() {
    drawRing();
    updateRing();
    //mainroad.writeVehicles(); // for debugging
}


//##################################################
// Actual start of the simulation thread
// (also started from gui.js "Ring Road" button) 
// everything w/o function keyword [function f(..)]" actually does something, not only def
//##################################################
// init() ends with return setInterval(main_loop,1000/fps);

 
 var myRun=init(); //if start with ring road: init, starts thread "main_loop" 
// var myRun; // starts with empty canvas; can be started with "start" button
// init(); //[w/o var]: starts as well but not controllable by start/stop button (no ref)
// myRun=init(); // selber Effekt wie "var myRun=init();" 
// (aber einmal "var"=guter Stil, geht aber implizit auch ohne: Def erstes Mal, dann ref) 

