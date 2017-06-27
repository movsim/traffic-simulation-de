
// general comments: ring.js, offramp.js (responsive design)


//#############################################################
// Initial settings
//#############################################################

var scenarioString="Uphill";

// graphical settings

var hasChanged=true; // window dimensions have changed (responsive design)


var drawBackground=true; // if false, default unicolor background
var drawRoad=true; // if false, only vehicles are drawn
var userCanvasManip; //!!! true only if user-driven geometry changes

var drawColormap=true;
var vmin=0; // min speed for speed colormap (drawn in red)
var vmax=100/3.6; // max speed for speed colormap (drawn in blue-violet)

// sim settings

var time=0;
var itime=0;
var fps=20; // frames per second (unchanged during runtime)
var dt=0.5; // only initialization


// physical geometry settings [m]

var mainroadLen=770;
var uBeginBan=200; // truck overtaking ban if clicked active
var uBeginUp=450;
var uEndUp=600;
var nLanes=2;
var laneWidth=7;

var straightLen=0.34*mainroadLen;      // straight segments of U
var arcLen=mainroadLen-2*straightLen; // length of half-circe arc of U
var arcRadius=arcLen/Math.PI;
var center_xPhys=95; // !! only IC
var center_yPhys=-105; // !! only IC! ypixel downwards=> physical center <0

var sizePhys=200;  // typical physical linear dimension for scaling 


// specification of vehicle and traffic  properties

var car_length=7; // car length in m
var car_width=5; // car width in m
var truck_length=12; // trucks
var truck_width=7; 


var dt_LC=4; // duration of a lane change

// simulation initial conditions settings
//(initial values and range of user-ctrl var in gui.js)

var speedInit=20; // m/s
var densityInit=0.;
var speedInitPerturb=13;
var relPosPerturb=0.8;
var truckFracToleratedMismatch=0.2; // open system: need tolerance, otherwise sudden changes


//############################################################################
// image file settings
//############################################################################

var car_srcFile='figs/blackCarCropped.gif';
var truck_srcFile='figs/truck1Small.png';
//var obstacle_srcFile='figs/obstacleImg.png';
var road1lanes_srcFile='figs/road1lanesCrop.png';
var road2lanesWith_srcFile='figs/road2lanesCropWith.png';
var road3lanesWith_srcFile='figs/road3lanesCropWith.png';
var road4lanesWith_srcFile='figs/road4lanesCropWith.png';
var road2lanesWithout_srcFile='figs/road2lanesCropWithout.png';
var road3lanesWithout_srcFile='figs/road3lanesCropWithout.png';
var road4lanesWithout_srcFile='figs/road4lanesCropWithout.png';
var ramp_srcFile='figs/road1lanesCrop.png';

// Notice: set drawBackground=false if no bg wanted
var background_srcFile='figs/backgroundGrass.jpg'; 
//var sign_uphill_srcFile='figs/uphill12_small.gif'; 
var sign_uphill_srcFile='figs/Zeichen_Steigung4.svg'; 
var sign_free_srcFile='figs/sign_free_282_small.png'; 
var sign_truckOvertakingBan_srcFile='figs/truckOvertakingBan_small.gif'; 



//#################################
// Global graphics specification
//#################################

var canvas;
var ctx;  // graphics context
 
var background;
 



//###############################################################
// physical (m) road, vehicle and model specification
//###############################################################


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



// IDM_v0 etc and updateModels() with actions  "longModelCar=new ACC(..)" etc
// defined in gui.js

var longModelCar;
var longModelTruck;
var LCModelCar;
var LCModelTruck;

var longModelCarUphill;
var longModelTruckUphill;
var LCModelCarUphill;
var LCModelTruckUphill;

// truck if overtaking ban active

var LCModelTruckLCban;

updateModels(); // initial update
				      // LCModelCar,LCModelTruck);

var isRing=0;  // 0: false; 1: true
var roadID=1;
var mainroad=new road(roadID,mainroadLen,laneWidth,nLanes,traj_x,traj_y,
		      densityInit, speedInit,truckFracInit, isRing);

//mainroad.LCModelMandatoryRight=LCModelMandatoryRight; //unique mandat LC model
//mainroad.LCModelMandatoryLeft=LCModelMandatoryLeft; //unique mandat LC model





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

    // transfer effects from slider interaction => updateModels() in *_gui.js 
    // to the vehicles and their models.
    // All cars and trucks (in a certain region) share the same model) 

    if(false){
	console.log("longModelCar.speedlimit="+longModelCar.speedlimit
		    +" longModelCar.v0="+longModelCar.v0
		    +" longModelTruck.speedlimit="+longModelTruck.speedlimit
		    +" longModelTruck.v0="+longModelTruck.v0);
    }

    mainroad.updateTruckFrac(truckFrac, truckFracToleratedMismatch);
    mainroad.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				       LCModelCar,LCModelTruck);
    mainroad.setCFModelsInRange(uBeginUp,uEndUp,
				 longModelCarUphill,longModelTruckUphill);
    mainroad.setLCModelsInRange(uBeginBan,uEndUp,
				 LCModelCarUphill,LCModelTruckUphill);

//!!! here new mainroad method: model update in restricted region

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


 
    //logging

    if(false){
        console.log("\nafter updateU: itime="+itime+" mainroad.nveh="+mainroad.nveh);
	for(var i=0; i<mainroad.veh.length; i++){
	      console.log("i="+i+" mainroad.veh[i].u="+mainroad.veh[i].u
			+" type="+mainroad.veh[i].type
			+" speedlimit="+mainroad.veh[i].longModel.speedlimit
			+" speed="+mainroad.veh[i].speed);
	}
	console.log("\n");
    }

}//updateU




//##################################################
function drawU() {
//##################################################

    /* (1) redefine graphical aspects of road (arc radius etc) using
     responsive design if canvas has been resized 
     (=actions of canvasresize.js for the ring-road scenario,
     here not usable ecause of side effects with sizePhys)
     NOTICE: resizing also brings some small traffic effects 
     because mainRampOffset slightly influenced, but No visible effect 
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

      scale=refSizePix/sizePhys; 

      // !!!!
      // update gridded road trajectories (revert any user-dragged shifts)
      // inside if(hasChanged) block

      mainroad.roadLen=mainroadLen;
      mainroad.gridTrajectories(traj_x,traj_y);


      if(true){
	console.log("canvas has been resized: new dim ",
		    canvas.width,"X",canvas.height," refSizePix=",
		    refSizePix," sizePhys=",sizePhys," scale=",scale);
      }
    }


 

    //mainroad.updateOrientation(); // update heading of all vehicles rel. to road axis
                                  // (for some reason, strange rotations at beginning)



    // (2) reset transform matrix and draw background
    // (only needed if no explicit road drawn)
    // "%20-or condition"
    //  because some older firefoxes do not start up properly?

    ctx.setTransform(1,0,0,1,0,0); 
    if(drawBackground){
	if(userCanvasManip||hasChanged||banButtonClicked
	   ||(itime<=1) || (itime===20) || false || (!drawRoad)){
          ctx.drawImage(background,0,0,canvas.width,canvas.height);
      }
    }


    // (3) draw mainroad
    // (always drawn; changedGeometry only triggers building a new lookup table)

    
     var changedGeometry=userCanvasManip || hasChanged||(itime<=1); 
     mainroad.draw(roadImg1,roadImg2,scale,changedGeometry);


 
    // (4) draw vehicles (obstacleImg here empty, only needed for interface)

    mainroad.drawVehicles(carImg,truckImg,obstacleImgs,scale,vmin, vmax);

    // (4a) draw traffic signs
	//console.log("banButtonClicked=",banButtonClicked," banIsActive=",banIsActive);

    if(userCanvasManip||hasChanged||banButtonClicked
       ||(itime<=1) || (itime===20) ){

	banButtonClicked=false;
	var sizeSignPix=0.1*refSizePix;
	var vOffset=1.4*nLanes*laneWidth; // in v direction, pos if right

	var xPixUp=mainroad.get_xPix(uBeginUp,vOffset,scale);
	var yPixUp=mainroad.get_yPix(uBeginUp,vOffset,scale);
	var xPixEnd=mainroad.get_xPix(uEndUp,vOffset,scale);
	var yPixEnd=mainroad.get_yPix(uEndUp,vOffset,scale);
	var xPixBan=mainroad.get_xPix(uBeginBan,-0.5*vOffset,scale);
	var yPixBan=mainroad.get_yPix(uBeginBan,-0.5*vOffset,scale);

        // center sign (the drawing coords denote the left upper corner)

	xPixUp -= 0.5*sizeSignPix;
	yPixUp -= 0.5*sizeSignPix;
	xPixEnd -= 0.5*sizeSignPix;
	yPixEnd -= 0.5*sizeSignPix;

	ctx.setTransform(1,0,0,1,0,0); 
	ctx.drawImage(signUphillImg,xPixUp,yPixUp,sizeSignPix,sizeSignPix);
	ctx.drawImage(signFreeImg,xPixEnd,yPixEnd,sizeSignPix,sizeSignPix);
	if(banIsActive){// defined/changed in uphill_gui.js
	  ctx.drawImage(signTruckOvertakingBan,xPixBan,yPixBan,
			sizeSignPix,sizeSignPix);
	}

    }


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

    
    
    var scaleStr=" scale="+Math.round(10*scale)/10;
    var scaleStr_xlb=8*textsize;
    var scaleStr_ylb=timeStr_ylb;
    var scaleStr_width=5*textsize;
    var scaleStr_height=1.2*textsize;
    ctx.fillStyle="rgb(255,255,255)";
    ctx.fillRect(scaleStr_xlb,scaleStr_ylb-scaleStr_height,
		 scaleStr_width,scaleStr_height);
    ctx.fillStyle="rgb(0,0,0)";
    ctx.fillText(scaleStr, scaleStr_xlb+0.2*textsize, 
		 scaleStr_ylb-0.2*textsize);
    
/*

    var timewStr="timewarp="+Math.round(10*timewarp)/10;
    var timewStr_xlb=16*textsize;
    var timewStr_ylb=timeStr_ylb;
    var timewStr_width=7*textsize;
    var timewStr_height=1.2*textsize;
    ctx.fillStyle="rgb(255,255,255)";
    ctx.fillRect(timewStr_xlb,timewStr_ylb-timewStr_height,
		 timewStr_width,timewStr_height);
    ctx.fillStyle="rgb(0,0,0)";
    ctx.fillText(timewStr, timewStr_xlb+0.2*textsize,
		 timewStr_ylb-0.2*textsize);
    

    var genVarStr="truckFrac="+Math.round(100*truckFrac)+"\%";
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
    

    var genVarStr="qIn="+Math.round(3600*qIn)+"veh/h";
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

    if(drawColormap){
      displayColormap(0.22*refSizePix,
                 0.43*refSizePix,
                 0.1*refSizePix, 0.2*refSizePix,
		 vmin,vmax,0,100/3.6);
      } 

    // revert to neutral transformation at the end!
    ctx.setTransform(1,0,0,1,0,0); 
  }
}
 

function init() {

    // "canvas_uphill" defined in uphill.html
    canvas = document.getElementById("canvas_uphill");
    ctx = canvas.getContext("2d");

    background = new Image();
    background.src =background_srcFile;


    // init vehicle image(s)

    carImg = new Image();
    carImg.src = car_srcFile;
    truckImg = new Image();
    truckImg.src = truck_srcFile;
    obstacleImgs=[];
    obstacleImgs[0] = new Image();
    //obstacleImg[0].src = obstacle_srcFile;

    signUphillImg = new Image();
    signUphillImg.src = sign_uphill_srcFile;

    signFreeImg = new Image();
    signFreeImg.src = sign_free_srcFile;

    signTruckOvertakingBan = new Image();
    signTruckOvertakingBan.src = sign_truckOvertakingBan_srcFile;

	// init road image(s)

    roadImg1 = new Image();
    roadImg1.src=(nLanes===1)
	? road1lanes_srcFile
	: (nLanes===2) ? road2lanesWith_srcFile
	: (nLanes===3) ? road3lanesWith_srcFile
	: road4lanesWith_srcFile;

    roadImg2 = new Image();
    roadImg2.src=(nLanes===1)
	? road1lanes_srcFile
	: (nLanes===2) ? road2lanesWithout_srcFile
	: (nLanes===3) ? road3lanesWithout_srcFile
	: road4lanesWithout_srcFile;


    rampImg = new Image();
    rampImg.src=ramp_srcFile;


 

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
    drawU();
    updateU();
    userCanvasManip=false;

    //mainroad.writeVehicles(); // for debugging
}
 

//##################################################
// Actual start of the simulation thread
// (also started from gui.js "Onramp" button) 
// everything w/o function keyword [function f(..)]" actually does something, not only def
//##################################################

 
 var myRun=init(); //if start with uphill: init, starts thread "main_loop" 
// var myRun; // starts with empty canvas; can be started with " start" button
// init(); //[w/o var]: starts as well but not controllable by start/stop button (no ref)
// myRun=init(); // selber Effekt wie "var myRun=init();" 
// (aber einmal "var"=guter Stil, geht aber implizit auch ohne: Def erstes Mal, dann ref) 


