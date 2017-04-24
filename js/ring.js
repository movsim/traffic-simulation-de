
// main simulation script; one separate script for each scenario;
// and one separate html page where only the respective sim script is loaded

//#############################################################
// Initial settings
//#############################################################


// graphical settings

var hasChanged=true; // window dimensions have changed (responsive design)

var drawBackground=true; // if false, default unicolor background
var drawRoad=true; // if false, only vehicles are drawn

var vmin=0; // min speed for speed colormap (drawn in red)
var vmax=100/3.6; // max speed for speed colormap (drawn in blue-violet)




// physical geometry settings

var sizePhys=290;    //responsive design  
var center_xPhys=139;
var center_yPhys=-150; // ypixel downwards=> physical center <0

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
var MOBIL_bSafeMax=17;
var MOBIL_bThr=0.4;
var MOBIL_bBiasRight_car=0.05; 
var MOBIL_bBiasRight_truck=0.2; 
var dt_LC=4; // duration of a lane change

// simulation initial conditions settings
//(initial values and range of user-ctrl var in gui.js)
// densityInit etc also in gui.js

var speedInit=20; // m/s
var speedInitPerturb=13;
var relPosPerturb=0.8;

// needed here for road cstr interface:
// need tolerance in open systems, otherwise sudden changes
var truckFracToleratedMismatch=0.02;



//####################################################################
// image file settings
//####################################################################


var car_srcFile='figs/blackCarCropped.gif';
var truck_srcFile='figs/truck1Small.png';
var obstacle_srcFile='figs/obstacleImg.png';
var road1lane_srcFile='figs/oneLaneRoadRealisticCropped.png';
var road2lanes_srcFile='figs/twoLanesRoadRealisticCropped.png';
var road3lanes_srcFile='figs/threeLanesRoadRealisticCropped.png';

// Notice: set drawBackground=false if no bg wanted
 var background_srcFile='figs/backgroundGrass.jpg'; 




//#################################
// Global graphics specification
//#################################

var canvas;
var ctx;  // graphics context
 
var background;
 


//###############################################################
// physical (m) road and vehicles  specification
//###############################################################

    // define road geometry as parametric functions of arclength u
    // (physical coordinates!)

function traj_x(u){
    return center_xPhys + roadRadius*Math.cos(u/roadRadius);
}

function traj_y(u){
    return center_yPhys + roadRadius*Math.sin(u/roadRadius);
}

var longModelCar;
var longModelTruck;
var LCModelCar;
var LCModelTruck; 
updateModels(); //  from ring_gui.js 

var isRing=1;  // 0: false; 1: true
var roadID=1;
var mainroad=new road(roadID,roadLen,laneWidth,nLanes,traj_x,traj_y,
		      densityInit,speedInit,truckFracInit,isRing);

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
var fps=30; // frames per second (unchanged during runtime)
var dt=timewarp/fps;


//############################################
function updateRing(){
//############################################

    // update times

    time +=dt; // dt depends on timewarp slider (fps=const)
    itime++;
    //console.log("does Math.tanh exist?");
    //console.log("Math.tanh(5)=",Math.tanh(5));

    // transfer effects from slider interaction to the vehicles and models: 
    // modelparam sliders (updateModelsOfAllVehicles), density, truckFrac sliders

    mainroad.updateTruckFrac(truckFrac, truckFracToleratedMismatch);
    mainroad.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				       LCModelCar,LCModelTruck);
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

        // update sliderWidth in *_gui.js; 

        var css_track_vmin=15; // take from sliders.css 
        sliderWidth=0.01*css_track_vmin*Math.min(canvas.width,canvas.height);

    }

    // (0) reposition physical x center coordinate as response
    // to viewport size (changes)

    var aspectRatio=canvas.width/canvas.height;
    //!!center_xPhys=0.5*sizePhys*Math.max(aspectRatio,1.);



    // (1) update heading of all vehicles rel. to road axis
    // (for some reason, strange rotations at beginning)

    mainroad.updateOrientation(); 


 
    // (2) reset transform matrix and draw background
    // (only needed if no explicit road drawn)
    // sloppy at first drawing. 
    // Remind running engine at increasing time spans...

    ctx.setTransform(1,0,0,1,0,0); 
    if(drawBackground){
	if(hasChanged||(itime<=1) || (itime==20) || (!drawRoad)){ 
            ctx.drawImage(background,0,0,canvas.width,canvas.height);
	}
    }

    // (3) draw ring road
    // (always drawn; changedGeometry only triggers building a new lookup table)

    var changedGeometry=hasChanged||(itime<=1);
    mainroad.draw(roadImg,scale,changedGeometry);


    // (4) draw vehicles

    mainroad.drawVehicles(carImg,truckImg,obstacleImg,scale,vmin,vmax);


    // draw some running-time vars

    ctx.setTransform(1,0,0,1,0,0); 
    var textsize=0.02*Math.min(canvas.width,canvas.height); // 2vw;

    ctx.font=textsize+'px Arial';

    var timeStr="Time="+Math.round(10*time)/10;
    var timeStr_xlb=textsize;
    var timeStr_ylb=2*textsize;
    var timeStr_width=7*textsize;
    var timeStr_height=1.2*textsize;
    ctx.fillStyle="rgb(255,255,255)";
    ctx.fillRect(timeStr_xlb,timeStr_ylb-timeStr_height,timeStr_width,timeStr_height);
    ctx.fillStyle="rgb(0,0,0)";
    ctx.fillText(timeStr, timeStr_xlb+0.2*textsize, timeStr_ylb-0.2*textsize);

    var scaleStr="scale="+Math.round(10*scale)/10;
    var scaleStr_xlb=9*textsize;
    var scaleStr_ylb=timeStr_ylb;;
    var scaleStr_width=7*textsize;
    var scaleStr_height=1.2*textsize;
    ctx.fillStyle="rgb(255,255,255)";
    ctx.fillRect(scaleStr_xlb,scaleStr_ylb-scaleStr_height,scaleStr_width,scaleStr_height);
    ctx.fillStyle="rgb(0,0,0)";
    ctx.fillText(scaleStr, scaleStr_xlb+0.2*textsize, scaleStr_ylb-0.2*textsize);
    
/*    
    var timewStr="timewarp="+Math.round(10*timewarp)/10;
    var timewStr_xlb=16*textsize;
    var timewStr_ylb=timeStr_ylb;;
    var timewStr_width=7*textsize;
    var timewStr_height=1.2*textsize;
    ctx.fillStyle="rgb(255,255,255)";
    ctx.fillRect(timewStr_xlb,timewStr_ylb-timewStr_height,timewStr_width,timewStr_height);
    ctx.fillStyle="rgb(0,0,0)";
    ctx.fillText(timewStr, timewStr_xlb+0.2*textsize, timewStr_ylb-0.2*textsize);
    
    var densStr="density="+Math.round(10000*density)/10;
    var densStr_xlb=24*textsize;
    var densStr_ylb=timeStr_ylb;
    var densStr_width=7*textsize;
    var densStr_height=1.2*textsize;
    ctx.fillStyle="rgb(255,255,255)";
    ctx.fillRect(densStr_xlb,densStr_ylb-densStr_height,densStr_width,densStr_height);
    ctx.fillStyle="rgb(0,0,0)";
    ctx.fillText(densStr, densStr_xlb+0.2*textsize, densStr_ylb-0.2*textsize);
    

    var genVarStr="truckFrac="+Math.round(100*truckFrac)+"\%";
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
    */

    // (6) draw the speed colormap

    drawColormap(scale*(center_xPhys-0.03*roadRadius), 
                -scale*(center_yPhys+0.50*roadRadius), 
		 scale*50, scale*50,
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

    // get overall dimensions from parent html page
    // "canvas_ring" defined in ring.html

    canvas = document.getElementById("canvas_ring"); 
    ctx = canvas.getContext("2d");

    width  = canvas.width;  // pixel coordinates
    height = canvas.height;


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


    // apply externally functions of mouseMove events  
    // to initialize sliders settings

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

