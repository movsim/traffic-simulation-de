

// general comments: ring.js, offramp.js (responsive design)


//#############################################################
// Initial settings
//#############################################################

var scenarioString="OffRamp";

// graphical settings


var hasChanged=true; // window dimensions have changed (responsive design)

var drawBackground=true; // if false, default unicolor background
var drawRoad=true; // if false, only vehicles are drawn
var changedRoadGeometry; //!!! true only if user-driven geometry changes

var drawColormap=false;
var vmin=0; // min speed for speed colormap (drawn in red)
var vmax=100/3.6; // max speed for speed colormap (drawn in blue-violet)


// physical geometry settings [m]

var mainroadLen=700;
var nLanes_main=3;
var nLanes_rmp=1;
var laneWidth=7;
var laneWidthRamp=5;

var offLen=250;
var divergeLen=100;
var taperLen=40;



// variable depending on aspect ratio: only relevant for graphics

var straightLen=0.34*mainroadLen;      // straight segments of U
var mainOffOffset=mainroadLen-straightLen;
var arcLen=mainroadLen-2*straightLen; // length of half-circe arc of U
var arcRadius=arcLen/Math.PI;
var center_xPhys=95; // only IC!!
var center_yPhys=-105; // only IC!! ypixel downwards

var offRadius=2.6*arcRadius;

var sizePhys=200; // typical physical linear dimension for scaling 




// specification of vehicle and traffic  properties

var car_length=7; // car length in m
var car_width=5; // car width in m
var truck_length=15; // trucks
var truck_width=7; 

// initial parameter settings (!! transfer def to GUI if variable in sliders!)

var MOBIL_bSafe=4;
var MOBIL_bSafeMax=17;
var MOBIL_bThr=0.2;
var MOBIL_bBiasRight_car=-0.01; 
var MOBIL_bBiasRight_truck=0.1; 

var MOBIL_mandat_bSafe=25;
var MOBIL_mandat_bThr=0;
var MOBIL_mandat_bias=25;

var dt_LC=4; // duration of a lane change

// simulation initial conditions settings
//(initial values and range of user-ctrl var in gui.js)

var speedInit=20; // m/s
var densityInit=0.01;
var speedInitPerturb=13;
var relPosPerturb=0.8;
var truckFracToleratedMismatch=0.2; // open system: need tolerance, otherwise sudden changes


//############################################################################
// image file settings
//############################################################################

var car_srcFile='figs/blackCarCropped.gif';
var truck_srcFile='figs/truck1Small.png';
var obstacle_srcFile='figs/obstacleImg.png';
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



function trajOff_x(u){ // physical coordinates
	var xDivergeBegin=traj_x(mainOffOffset);
	return (u<divergeLen)
	    ? xDivergeBegin+u
	    : xDivergeBegin+divergeLen+offRadius*Math.sin((u-divergeLen)/offRadius);
}

function trajOff_y(u){ // physical coordinates
    	var yDivergeBegin=traj_y(mainOffOffset)
	    -0.5*laneWidth*(nLanes_main+nLanes_rmp)-0.02*laneWidth;
	return (u<taperLen)
            ? yDivergeBegin+laneWidth-laneWidth*u/taperLen: (u<divergeLen)
	    ? yDivergeBegin
	    : yDivergeBegin -offRadius*(1-Math.cos((u-divergeLen)/offRadius));
}

// IDM_v0 etc and updateModels() with actions  "longModelCar=new ACC(..)" etc
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

// construct network

var isRing=0;  // 0: false; 1: true
duTactical=150; // anticipation distance for applying mandatory LC rules

var mainroad=new road(1,mainroadLen,laneWidth, nLanes_main,traj_x,traj_y,
		      densityInit, speedInit,truckFracInit, isRing);
var offramp=new road(2,offLen,laneWidthRamp,nLanes_rmp,trajOff_x,trajOff_y,
		     0.1*densityInit,speedInit,truckFracInit,isRing);

var offrampIDs=[2];
var offrampLastExits=[mainOffOffset+divergeLen];
var offrampToRight=[true];
mainroad.setOfframpInfo(offrampIDs,offrampLastExits,offrampToRight);
mainroad.duTactical=duTactical;
mainroad.LCModelMandatoryRight=LCModelMandatoryRight; //unique mandat LC model
mainroad.LCModelMandatoryLeft=LCModelMandatoryLeft; //unique mandat LC model

//console.log("mainroad.offrampLastExits[0]=",mainroad.offrampLastExits[0]);
//console.log("fracOff="+fracOff);
var route1=[1];  // stays on mainroad
var route2=[1,2]; // takes offramp
for (var i=0; i<mainroad.veh.length; i++){
    mainroad.veh[i].route=(Math.random()<fracOff) ? route2 : route1;
    //console.log("mainroad.veh["+i+"].route="+mainroad.veh[i].route);
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

    // transfer effects from slider interaction and mandatory regions
    // to the vehicles and models: 


    mainroad.updateTruckFrac(truckFrac, truckFracToleratedMismatch);
    mainroad.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				       LCModelCar,LCModelTruck);
				      // LCModelMandatoryRight,
				      // LCModelMandatoryLeft);
    offramp.updateTruckFrac(truckFrac, truckFracToleratedMismatch);
    offramp.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				      LCModelCar,LCModelTruck);
				      // LCModelMandatoryRight,
				      // LCModelMandatoryLeft);


    // if applicable, impose
    // externally mandatory LC behaviour in merging regions of on-ramps




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
    mainroad.mergeDiverge(offramp,-mainOffOffset,
			  mainOffOffset+taperLen,mainOffOffset+divergeLen-u_antic,
			  false,true);
 
    //logging

    //offramp.writeVehiclesSimple();

    if(false){
        console.log("\nafter updateU: itime="+itime+" mainroad.nveh="+mainroad.nveh);
	for(var i=0; i<mainroad.veh.length; i++){
	    console.log("i="+i+" mainroad.veh[i].u="+mainroad.veh[i].u
			+" mainroad.veh[i].v="+mainroad.veh[i].v
			+" mainroad.veh[i].lane="+mainroad.veh[i].lane
			+" mainroad.veh[i].laneOld="+mainroad.veh[i].laneOld);
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
     because mainOffOffset slightly influenced, but No visible effect 
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
      sizePhys=2.3*arcRadius + 2*nLanes_main*laneWidth;
      arcLen=arcRadius*Math.PI;
      straightLen=0.5*(mainroadLen-arcLen);  // one straight segment

      //!!!  hasChanged revert any user-dragged shifts!
      mainOffOffset=mainroadLen-straightLen;

      center_xPhys=1.2*arcRadius;
      center_yPhys=-1.35*arcRadius; // ypixel downwards=> physical center <0
      scale=refSizePix/sizePhys; 
 
      mainroad.roadLen=mainroadLen;
      offramp.roadLen=offLen;
      mainroad.gridTrajectories(traj_x,traj_y);
      offramp.gridTrajectories(trajOff_x,trajOff_y);


      if(true){
	console.log("canvas has been resized: new dim ",
		    canvas.width,"X",canvas.height," refSizePix=",
		    refSizePix," sizePhys=",sizePhys," scale=",scale,
		    " straightLen=",straightLen,
		    " mainOffOffset=",mainOffOffset);
      }
    }



    if(hasChanged){
	console.log("mainOffOffset=",mainOffOffset,
		    " traj_x(mainOffOffset)=",traj_x(mainOffOffset),
		    " traj_x(mainroadLen)=",traj_x(mainroadLen));
    }

    mainroad.updateOrientation(); // update heading of all vehicles rel. to road axis
                                  // (for some reason, strange rotations at beginning)



    // (2) reset transform matrix and draw background
    // (only needed if no explicit road drawn)
    // "%20-or condition"
    //  because some older firefoxes do not start up properly?

    ctx.setTransform(1,0,0,1,0,0); 
    if(drawBackground){
	if(changedRoadGeometry||hasChanged||(itime<=1) 
	   || (itime==20) || false || (!drawRoad)){

         ctx.drawImage(background,0,0,canvas.width,canvas.height);
      }
    }


    // (3) draw mainroad and ramps (offramp "bridge" => draw last)
    // and vehicles (directly after frawing resp road or separately, depends)
    // (always drawn; changedGeometry only triggers building a new lookup table)

    var changedGeometry=changedRoadGeometry || hasChanged||(itime<=1); 
    offramp.draw(rampImg,rampImg,scale,changedGeometry);
    mainroad.draw(roadImg1,roadImg2,scale,changedGeometry);

    offramp.drawVehicles(carImg,truckImg,obstacleImg,scale,vmin,vmax);
    mainroad.drawVehicles(carImg,truckImg,obstacleImg,scale,vmin,vmax);



    // (4)(5) draw some running-time vars

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
    */


    // (6) draw the speed colormap

    if(drawColormap) displayColormap(0.22*refSizePix,
                 0.43*refSizePix,
                 0.1*refSizePix, 0.2*refSizePix,
		 vmin,vmax,0,100/3.6);


    // revert to neutral transformation at the end!
    ctx.setTransform(1,0,0,1,0,0); 
  }
}
 


//############################################
// initialization function of the simulation thread
// THIS function does all the things; everything else only functions
// ultimately called by init()
// activation of init: 
// (i) automatically when loading the simulation ("var myRun=init();" below) 
// (ii) when pressing the start button defined in offramp_gui.js ("myRun=init();")
// "var ..." Actually does something; 
// function keyword [function fname(..)] defines only
//############################################

function init() {
    canvas = document.getElementById("canvas_offramp"); // "canvas_offramp" defined in offramp.html
    ctx = canvas.getContext("2d");


    background = new Image();
    background.src =background_srcFile;
    //console.log("image size of background:"+background.naturalWidth); 



    // init vehicle image(s)

    carImg = new Image();
    carImg.src = car_srcFile;
    truckImg = new Image();
    truckImg.src = truck_srcFile;
    obstacleImg = new Image();
    obstacleImg.src = obstacle_srcFile;

	// init road image(s)

    roadImg1 = new Image();
    roadImg1.src=(nLanes_main==1)
	? road1lanes_srcFile
	: (nLanes_main==2) ? road2lanesWith_srcFile
	: (nLanes_main==3) ? road3lanesWith_srcFile
	: road4lanesWith_srcFile;

    roadImg2 = new Image();
    roadImg2.src=(nLanes_main==1)
	? road1lanes_srcFile
	: (nLanes_main==2) ? road2lanesWithout_srcFile
	: (nLanes_main==3) ? road3lanesWithout_srcFile
	: road4lanesWithout_srcFile;

    rampImg = new Image();
    rampImg.src=ramp_srcFile;


    // apply externally functions of mouseMove events  to initialize sliders settings

    console.log("timewarp=",timewarp);
 

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

    if(false){
    //if(itime==10){ //!!! test with zero distortion, just gridding
	var xUserMain=mainroad.traj_x(0.4*mainroad.roadLen)+0;
	var yUserMain=mainroad.traj_y(0.4*mainroad.roadLen)-30;
	var xUserOff=offramp.traj_x(0.4*offramp.roadLen)+0;
	var yUserOff=offramp.traj_y(0.4*offramp.roadLen)-30;
	mainroad.testCRG(xUserMain,yUserMain);
	mainroad.doCRG(xUserMain,yUserMain);
	mainroad.finishCRG();
	offramp.testCRG(xUserOff,yUserOff);
	offramp.doCRG(xUserOff,yUserOff);
	offramp.finishCRG();
        // since road not redrawn generally, this here necessary
	ctx.drawImage(background,0,0,canvas.width,canvas.height);
        offramp.draw(rampImg,rampImg,scale,true);
	mainroad.draw(roadImg1,roadImg2,scale,true); 
    }
    drawU();
    updateU();
    changedRoadGeometry=false;
    //mainroad.writeVehicles(); // for debugging
}
 

//##################################################
// Actual start of the simulation thread
// (also started from gui.js "Offramp" button) 
// everything w/o function keyword [function f(..)]" actually does something, not only def
//##################################################

 
 var myRun=init();

