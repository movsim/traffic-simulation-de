
//################################################################
// GUI: Start/Stop button callback (triggered by "onclick" in html file)
//#################################################################

// in any case need first to stop;
// otherwise multiple processes after clicking 2 times start
// define no "var myRun "; otherwise new local instance started
// whenever myRun is inited

var isStopped=false; // only initialization

function myStartStopFunction(){

    clearInterval(myRun);
    console.log("in myStartStopFunction: isStopped=",isStopped);

    if(isStopped){
        isStopped=false;
        document.getElementById('startStop').innerHTML="Stop";
        myRun=init();
    }
    else{
        document.getElementById('startStop').innerHTML="Resume";
        isStopped=true;
    }
}



//#############################################
// fixed model settings (these are GUI-sliders in the "normal" scenarios)
//#############################################

var timewarp=2;
var scale=2.3;   // pixel/m probably overridden (check!)
var qIn=0;       // no additional vehicles

var IDM_v0=30;
var IDM_T=1.5;
var IDM_s0=2;
var IDM_a=1.0;
var IDM_b=2;
var IDMtruck_v0=22.23;
var IDMtruck_T=2;
var IDMtruck_a=0.6;

var MOBIL_bSafe=4;    // bSafe if v to v0
var MOBIL_bSafeMax=17; // bSafe if v to 0
var MOBIL_bThr=0.2;
var MOBIL_bBiasRight_car=-0.2;
var MOBIL_bBiasRight_truck=0.1;

var MOBIL_mandat_bSafe=6;
var MOBIL_mandat_bSafeMax=20;
var MOBIL_mandat_bThr=0;
var MOBIL_mandat_biasRight=20;

var dt_LC=4; // duration of a lane change


// derived objects

var longModelCar=new ACC(IDM_v0,IDM_T,IDM_s0,IDM_a,IDM_b);
var longModelTruck=new ACC(IDMtruck_v0,IDMtruck_T,IDM_s0,IDMtruck_a,IDM_b);
var LCModelCar=new MOBIL(MOBIL_bSafe, MOBIL_bSafeMax,
                         MOBIL_bThr, MOBIL_bBiasRight_car);
var LCModelTruck=new MOBIL(MOBIL_bSafe, MOBIL_bSafeMax,
                           MOBIL_bThr, MOBIL_bBiasRight_truck);
var LCModelMandatoryRight=new MOBIL(MOBIL_mandat_bSafe, MOBIL_mandat_bSafeMax,
                                    MOBIL_mandat_bThr, MOBIL_mandat_biasRight);
var LCModelMandatoryLeft=new MOBIL(MOBIL_mandat_bSafe, MOBIL_mandat_bSafeMax,
                                    MOBIL_mandat_bThr, -MOBIL_mandat_biasRight);


 

//#############################################################
// graphical settings/variables
//#############################################################

var hasChanged=true; // whether window dimensions has changed (resp. design)

var drawBackground=true; // if false, default unicolor background
var drawRoad=true; // if false, only vehicles are drawn

var vmin=0; // min speed for speed colormap (drawn in red)
var vmax=100/3.6; // max speed for speed colormap (drawn in blue-violet)



//#############################################################
// physical geometry settings [m]
//#############################################################

var sizePhys=200;  // visible road section [m] (scale=canvas.height/sizePhys)

// 'S'-shaped mainroad

var lenStraightBegin=150;
var lenCurve=200; // each of the left and right curve making up the 'S'
var lenStraightEnd=250;
var maxAngleLeft=0.3; // maximum angle of the S bend (if <0, mirrored 'S')

// for optical purposes both lanes and cars bigger than in reality

var nLanes=3;
var laneWidth=7;
var car_length=7; // car length in m
var car_width=5; // car width in m
var truck_length=15; // trucks
var truck_width=7; 

// derived quantities and functions

var lenMainroad=lenStraightBegin+lenCurves+lenStraightEnd;
var arcCurv=2*maxAngleLeft/lenCurves;

var yPhysBegin=-sizePhys; // road from -sizePhys to about lenMainroad-sizePhys
var xPhysBegin=0.3*sizePhys; // portrait with aspect ratio 6:10 
                             // change later on when calling draw() 
var yPhysCurveBegin=yPhysBegin+lenStraightBegin;
var yPhysCurveCenter=yPhysBegin+lenStraightBegin;


// road geometry in physical coordinates 
// (norcmal CS, x=>toRght, y=>toTop )

    function traj_x(u){ 
        var dxPhysFromCenter= // left side (median), phys coordinates
	    (u<straightLen) ? straightLen-u
	  : (u>straightLen+arcLen) ? u-mainroadLen+straightLen
	  : -arcRadius*Math.sin((u-straightLen)/arcRadius);
	return center_xPhys+dxPhysFromCenter;
    }

    function traj_y(u){ // physical coordinates
        var dyPhysFromCenter=
 	    (u<straightLen) ? sizePhys
	  : (u>straightLen+arcLen) ? -arcRadius
	  : arcRadius*Math.cos((u-straightLen)/arcRadius);
	return center_yPhys+dyPhysFromCenter;
    }





//############################################################################
// image file settings
//############################################################################


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
// physical (m) road, vehicle and model specification
//###############################################################

// IDM_v0 etc and updateModels() with actions  "longModelCar=new ACC(..)" etc
// defined in gui.js


// initialize road with zero density as macroscopic initial condition 

var isRing=0;  // 0: false; 1: true
var roadIDmain=1;
var densityInit=0;
var speedInit=0; // not relevant since initially no vehicles
var truckFracInit=0; // not relevant since initially no vehicles

var mainroad=new road(roadIDmain, mainroadLen, nLanes, densityInit, speedInit, 
		      truckFracInit, isRing);

// specify microscopic init conditions (direct/deterministic
// control possibility crucial for game!)


var types  =[0,    0,    1,    0];
var lengths=[8,    5,    14,   7];
var widths =[4.5,  4,    6,  4.5];
var longPos=[50,   60,   70,  80];
var lanes  =[0,    1,    2,    0];
var speeds =[25,   25,   0,   30];
mainroad.initializeMicro(types,lengths,widths,longPos,lanes,speeds);







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

    //console.log("\nbefore mainroad.writeVehicles:"); mainroad.writeVehicles();
    mainroad.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				       LCModelCar,LCModelTruck); //!! test if needed

 
    // do central simulation update of vehicles

    mainroad.updateLastLCtimes(dt);
    //console.log("1: mainroad.nveh=",mainroad.veh.length);
    mainroad.calcAccelerations();  
    mainroad.changeLanes();         
    //console.log("3: mainroad.nveh=",mainroad.veh.length);
    mainroad.updateSpeedPositions();
    mainroad.updateBCdown();
    //console.log("5: mainroad.nveh=",mainroad.veh.length);
    mainroad.updateBCup(qIn,dt); // argument=total inflow
    //console.log("6: mainroad.nveh=",mainroad.veh.length);

    if(true){
	for (var i=0; i<mainroad.nveh; i++){
	    if(mainroad.veh[i].speed<0){
		console.log("speed "+mainroad.veh[i].speed
			    +" of mainroad vehicle "
			    +i+" is negative!");
	    }
	}
    }


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

    //!!! test relative motion
    var relObserver=true;
    var uObs=20*time;

    /* (0) redefine graphical aspects of road (arc radius etc) using
     responsive design if canvas has been resized 
     (=actions of canvasresize.js for the ring-road scenario,
     here not usable ecause of side effects with sizePhys)
     */

    var critAspectRatio=1.15;
    var hasChanged=false;
    var simDivWindow=document.getElementById("contents");

    if (canvas.width!=simDivWindow.clientWidth){
	hasChanged=true;
	canvas.width  = simDivWindow.clientWidth;
    }
    if (canvas.height != simDivWindow.clientHeight){
	hasChanged=true;
        canvas.height  = simDivWindow.clientHeight;
    }
    var aspectRatio=canvas.width/canvas.height;
    var refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);

    if(hasChanged){

      // update sliderWidth in *_gui.js; 

      var css_track_vmin=15; // take from sliders.css 
      sliderWidth=0.01*css_track_vmin*Math.min(canvas.width,canvas.height);

      // update geometric properties

      arcRadius=0.14*mainroadLen*Math.min(critAspectRatio/aspectRatio,1.);
      sizePhys=2.3*arcRadius + 2*nLanes*laneWidth;
      arcLen=arcRadius*Math.PI;
      straightLen=0.5*(mainroadLen-arcLen);  // one straight segment
 
      center_xPhys=1.2*arcRadius;
      center_yPhys=-1.30*arcRadius; // ypixel downwards=> physical center <0

      scale=canvas.height/sizePhys; 
      if(true){
	console.log("canvas has been resized: new dim ",
		    canvas.width,"X",canvas.height," refSizePix=",
		    refSizePix," sizePhys=",sizePhys," scale=",scale);
      }
    }






    // update heading of all vehicles rel. to road axis
    // (for some reason, strange rotations at beginning)

    mainroad.updateOrientation(); 



    // (2) reset transform matrix and draw background
    // (only needed if no explicit road drawn)
    //!! canvas dimensions kein DOS
    ctx.setTransform(1,0,0,1,0,0); 
    if(drawBackground){
	if(hasChanged||(itime<=2) || (itime==20) || relObserver 
	   || (!drawRoad)){
        ctx.drawImage(background,0,0,canvas.width,canvas.height);
      }
    }


    // (3) draw mainroad
    // (always drawn; changedGeometry only triggers building a new lookup table)

    var changedGeometry=hasChanged||(itime<=1)||true; 

    mainroad.draw(roadImg,scale,traj_x,traj_y,laneWidth,changedGeometry,
		  relObserver,uObs,center_xPhys,center_yPhys); //!!

// center_xPhys, center_yPhys
 
    // (4) draw vehicles

 

    mainroad.drawVehicles(carImg,truckImg,obstacleImg,scale,traj_x,traj_y,
			  laneWidth, vmin, vmax,
                        0,mainroadLen,relObserver,uObs,center_xPhys,center_yPhys);



    // (5) draw some running-time vars

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

    
    var scaleStr="scale="+Math.round(10*scale)/10;
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
    
  
    // (6) draw the speed colormap

      drawColormap(0.86*canvas.width,
                   0.88*canvas.height,
                   0.1*canvas.width, 0.2*canvas.height,
		   vmin,vmax,0,100/3.6);

    // revert to neutral transformation at the end!
    ctx.setTransform(1,0,0,1,0,0); 
  }
}
 




function init() {

    // get overall dimensions from parent html page
    // "canvas_onramp" defined in onramp.html

    canvas = document.getElementById("canvas_coffeeGame"); 
    ctx = canvas.getContext("2d");
 
    width  = canvas.width;   // pixel coordinates (DOS)
    height = canvas.height;  // DOS


    // init background image

    background = new Image();
    background.src =background_srcFile;

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

