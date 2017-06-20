
// general comments: ring.js, offramp.js (responsive design)


//#############################################################
// Initial settings
//#############################################################

// graphical settings

var hasChanged=true; // window dimensions have changed (responsive design)

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

var mainroadLen=770;
var nLanes=2;
var laneWidth=7;

var uBeginRoadworks=450;
var uEndRoadworks=550;
var laneRoadwork=0;  // 0=left
var lenRoadworkElement=10;

var straightLen=0.34*mainroadLen;      // straight segments of U
var arcLen=mainroadLen-2*straightLen; // length of half-circe arc of U
var arcRadius=arcLen/Math.PI;
var center_xPhys=95; //!! only IC
var center_yPhys=-105; // !! only IC ypixel downwards=> physical center <0

var sizePhys=200;  // typical physical linear dimension for scaling 


// specification of vehicle and traffic  properties

var car_length=7; // car length in m
var car_width=5; // car width in m
var truck_length=12; // trucks
var truck_width=7; 

// initial parameter settings (!! transfer def to GUI if variable in sliders!)

var MOBIL_bSafe=8; // was 12
var MOBIL_bSafeMax=16;
var MOBIL_bThr=0.1;
var MOBIL_bBiasRight_car=0.2; // four times for trucks (roadworks_gui.js)
var MOBIL_bBiasRight_truck=0.5; // four times for trucks (roadworks_gui.js)

var MOBIL_mandat_bSafe=6;
var MOBIL_mandat_bSafeMax=20;
var MOBIL_mandat_bThr=0;
var MOBIL_mandat_bias=2;

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
var obstacle_srcFile='figs/obstacleImg.png';
var road1lane_srcFile='figs/oneLaneRoadRealisticCropped.png';
var road2lanes_srcFile='figs/twoLanesRoadRealisticCropped.png';
var road3lanes_srcFile='figs/threeLanesRoadRealisticCropped.png';
var ramp_srcFile='figs/oneLaneRoadRealisticCropped.png';

// Notice: set drawBackground=false if no bg wanted
var background_srcFile='figs/backgroundGrass.jpg'; 

// !!! speedlimit signs
var srcFileIndexOld=8;
var srcFileIndex=8;
var sign_free_srcFile='figs/sign_free_282_small.png'; 
var sign_speedlimit_srcFiles = [];
for (var i=0; i<13; i++){
    sign_speedlimit_srcFiles[i]="figs/Tempo"+i+"0.png";
}
sign_speedlimit_srcFiles[13]=sign_free_srcFile;


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
var LCModelMandatoryRight=new MOBIL(MOBIL_mandat_bSafe, MOBIL_mandat_bSafeMax,
				    MOBIL_mandat_bThr, MOBIL_mandat_bias);
var LCModelMandatoryLeft=new MOBIL(MOBIL_mandat_bSafe, MOBIL_mandat_bSafeMax,
				   MOBIL_mandat_bThr, -MOBIL_mandat_bias);

updateModels(); 
				      // LCModelCar,LCModelTruck);

var isRing=0;  // 0: false; 1: true
var roadID=1;
var mainroad=new road(roadID,mainroadLen,laneWidth,nLanes,traj_x,traj_y,
		      densityInit, speedInit,truckFracInit, isRing);

mainroad.LCModelMandatoryRight=LCModelMandatoryRight; //unique mandat LC model
mainroad.LCModelMandatoryLeft=LCModelMandatoryLeft; //unique mandat LC model



//#########################################################
// add standing virtual vehicles at position of road works 
//#########################################################

// number of virtual "roadwork" vehicles

var longModelObstacle=new ACC(0,IDM_T,IDM_s0,0,IDM_b);
var LCModelObstacle=new MOBIL(MOBIL_bSafe,MOBIL_bSafe,1000,MOBIL_bBiasRight_car);
var nr=Math.round((uEndRoadworks-uBeginRoadworks)/lenRoadworkElement);

for (var ir=0; ir<nr; ir++){
    var u=uBeginRoadworks+(ir+0.5)*lenRoadworkElement;
    var virtualStandingVeh=new vehicle(lenRoadworkElement, laneWidth, 
					u,laneRoadwork, 0, "obstacle");
     virtualStandingVeh.longModel=longModelObstacle;
     virtualStandingVeh.LCModel=LCModelObstacle;
     mainroad.veh.push(virtualStandingVeh); // append; prepend=unshift
}

// put roadwork obstacles at right place and let vehicles get context of them 

mainroad.sortVehicles();
mainroad.updateEnvironment();


     if(false){
        console.log("\nmainroad.nveh="+mainroad.nveh);
	for(var i=0; i<mainroad.veh.length; i++){
	    console.log("i="+i
			+" mainroad.veh[i].type="+mainroad.veh[i].type
			+" mainroad.veh[i].u="+mainroad.veh[i].u
			+" mainroad.veh[i].v="+mainroad.veh[i].v
			+" mainroad.veh[i].lane="+mainroad.veh[i].lane
			+" mainroad.veh[i].laneOld="+mainroad.veh[i].laneOld);
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

    // transfer effects from slider interaction => updateModels() in *_gui.js 
    // to the vehicles and their models (all cars and trucks share
    // the same model) 

    if(true){
	console.log("longModelCar.speedlimit="+longModelCar.speedlimit
		    +" longModelCar.v0="+longModelCar.v0
		    +" longModelTruck.speedlimit="+longModelTruck.speedlimit
		    +" longModelTruck.v0="+longModelTruck.v0);
    }
    mainroad.updateTruckFrac(truckFrac, truckFracToleratedMismatch);
    mainroad.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				       LCModelCar,LCModelTruck);

    // externally impose mandatory LC behaviour
    // all left-lane vehicles must change lanes to the right
    // starting at 0 up to the position uBeginRoadworks

    mainroad.setLCMandatory(0, uBeginRoadworks, true);


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
	    if(mainroad.veh[i].type != "obstacle"){
	      console.log("i="+i+" mainroad.veh[i].u="+mainroad.veh[i].u
			+" type="+mainroad.veh[i].type
			+" speedlimit="+mainroad.veh[i].longModel.speedlimit
			+" speed="+mainroad.veh[i].speed);
	    }
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
	if(hasChanged||(itime<=1) || false || (!drawRoad)){ 
          ctx.drawImage(background,0,0,canvas.width,canvas.height);
      }
    }


    // (3) draw mainroad
    // (always drawn; changedGeometry only triggers building a new lookup table)

    
     var changedGeometry=hasChanged||(itime<=1); 
     mainroad.draw(roadImg,scale,changedGeometry);


 
    // (4) draw vehicles

    mainroad.drawVehicles(carImg,truckImg,obstacleImg,scale,vmin, vmax);

    // (4a) !!! implement varying speed-limit signs! -> uphill as template

    var speedlimit_kmh=10*Math.round(3.6*longModelCar.speedlimit/10.);
    var srcFileIndex=Math.min(speedlimit_kmh/10,13);
    if( (srcFileIndex !=srcFileIndexOld)||hasChanged||(itime<=1) ){
	srcFileIndexOld=srcFileIndex;
	speedlimitImg.src=sign_speedlimit_srcFiles[srcFileIndex];
	console.log("speedlimitImg.src=",speedlimitImg.src);

	var sizeSignPix=0.12*refSizePix;
	var vOffset=-1.8*nLanes*laneWidth; // in v direction, pos if right

	var xPix=mainroad.get_xPix(0.16*mainroadLen,vOffset,scale);
	var yPix=mainroad.get_yPix(0.16*mainroadLen,vOffset,scale);
	xPix -= 0.5*sizeSignPix; // center of sign
	yPix -= 0.5*sizeSignPix;
	ctx.setTransform(1,0,0,1,0,0); 
	ctx.drawImage(speedlimitImg,xPix,yPix,sizeSignPix,sizeSignPix);
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

    drawColormap(0.22*refSizePix,
                 0.43*refSizePix,
                 0.1*refSizePix, 0.2*refSizePix,
		 vmin,vmax,0,100/3.6);


    // revert to neutral transformation at the end!
    ctx.setTransform(1,0,0,1,0,0); 
  }
}
 

function init() {

    // "canvas_roadworks" defined in roadworks.html
    canvas = document.getElementById("canvas_roadworks");
    ctx = canvas.getContext("2d");

    background = new Image();
    background.src =background_srcFile;


    // init vehicle image(s)

    carImg = new Image();
    carImg.src = car_srcFile;
    truckImg = new Image();
    truckImg.src = truck_srcFile;
    obstacleImg = new Image();
    obstacleImg.src = obstacle_srcFile;

    signFreeImg = new Image();
    signFreeImg.src = sign_free_srcFile;
    speedlimitImg = new Image();
    speedlimitImg.src=sign_speedlimit_srcFiles[srcFileIndexOld]; // speed 80

	// init road image(s)

    roadImg = new Image();
    roadImg.src=(nLanes==1)
	? road1lane_srcFile
	: (nLanes==2) ? road2lanes_srcFile
	: road3lanes_srcFile;
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

    //!!! distortion

    //if(false){
    if(itime==10){ //!!! test with zero distortion, just gridding
	var xUserMain=mainroad.traj_x(0.50*mainroad.roadLen)+110;
	var yUserMain=mainroad.traj_y(0.50*mainroad.roadLen)-20;
	mainroad.testCRG(xUserMain,yUserMain);
	mainroad.doCRG(xUserMain,yUserMain);
	mainroad.finishCRG();
        // since road not redrawn generally, this here necessary
	ctx.drawImage(background,0,0,canvas.width,canvas.height);
	mainroad.draw(roadImg,scale,true); 
    }


    drawU();
    updateU();
    //mainroad.writeVehicles(); // for debugging
}
 

//##################################################
// Actual start of the simulation thread
// (also started from gui.js "Onramp" button) 
// everything w/o function keyword [function f(..)]" actually does something, not only def
//##################################################

 
 var myRun=init(); //if start with roadworks: init, starts thread "main_loop" 
// var myRun; // starts with empty canvas; can be started with " start" button
// init(); //[w/o var]: starts as well but not controllable by start/stop button (no ref)
// myRun=init(); // selber Effekt wie "var myRun=init();" 
// (aber einmal "var"=guter Stil, geht aber implizit auch ohne: Def erstes Mal, dann ref) 


