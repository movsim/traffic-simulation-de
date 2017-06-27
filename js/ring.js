
// main simulation script; one separate script for each scenario;
// and one separate html page where only the respective sim script is loaded

//#############################################################
// Initial settings
//#############################################################


var scenarioString="Ring";



// graphical settings

var hasChanged=true; // window dimensions have changed (responsive design)

var drawBackground=true; // if false, default unicolor background
var drawRoad=true; // if false, only vehicles are drawn
var userCanvasManip; //!!! true only if user-driven geometry changes

var drawColormap=false;
var vmin=0; // min speed for speed colormap (drawn in red)
var vmax=100/3.6; // max speed for speed colormap (drawn in blue-violet)




// physical geometry settings [m]

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

//var MOBIL_bThr=0.4;    => now in sliders, gui
//var MOBIL_bBiasRight_car=0.05; 
//var MOBIL_bBiasRight_truck=0.2; 
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





//###############################################################
// physical road and vehicles  specification
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

//####################################################################
// Global graphics specification and image file settings
//####################################################################

var canvas = document.getElementById("canvas_ring"); 
var ctx = canvas.getContext("2d"); // graphics context


// Notice: set drawBackground=false if no bg wanted
var background_srcFile='figs/backgroundGrass.jpg'; 

var car_srcFile='figs/blackCarCropped.gif';
var truck_srcFile='figs/truck1Small.png';
var traffLightGreen_srcFile='figs/trafficLightGreen_affine.png';
var traffLightRed_srcFile='figs/trafficLightRed_affine.png';

var obstacle_srcFiles = [];
obstacle_srcFiles[0]='figs/obstacleImg.png'; // standard black bar or nothing
for (var i=1; i<10; i++){ //!!!
    obstacle_srcFiles[i]="figs/constructionVeh"+i+".png";
    console.log("i=",i," obstacle_srcFiles[i]=", obstacle_srcFiles[i]);
}

var road1lanes_srcFile='figs/road1lanesCrop.png';
var road2lanesWith_srcFile='figs/road2lanesCropWith.png';
var road3lanesWith_srcFile='figs/road3lanesCropWith.png';
var road4lanesWith_srcFile='figs/road4lanesCropWith.png';
var road2lanesWithout_srcFile='figs/road2lanesCropWithout.png';
var road3lanesWithout_srcFile='figs/road3lanesCropWithout.png';
var road4lanesWithout_srcFile='figs/road4lanesCropWithout.png';



// init background image

var background = new Image();
background.src =background_srcFile;
 

// init vehicle image(s)

carImg = new Image();
carImg.src = car_srcFile;
truckImg = new Image();
truckImg.src = truck_srcFile;

// init special objects images

traffLightRedImg = new Image();
traffLightRedImg.src=traffLightRed_srcFile;
traffLightGreenImg = new Image();
traffLightGreenImg.src=traffLightGreen_srcFile;

obstacleImgs = []; // srcFiles[0]='figs/obstacleImg.png'
for (var i=0; i<obstacle_srcFiles.length; i++){
    obstacleImgs[i]=new Image();
    obstacleImgs[i].src = obstacle_srcFiles[i];
}


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

//!!! vehicleDepot(nImgs,nveh,xDepot,yDepot,lVeh,wVeh,
// alignedHoriz,containsObstacles)

var depot=new vehicleDepot(obstacleImgs.length,10,
			   center_xPhys+1.5*roadRadius,-roadRadius,
			   20,20,false,true);

//!!! test: add traffic lights

//mainroad.addTrafficLight(101,60,"green");
//mainroad.addTrafficLight(102,240,"red");


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

    if(false){//!!!
    //if(itime%50===0){//!!!
	var newstate=(itime%100===0) ? "green" : "red";
	console.log("in mainroad.changeTrafficLight: newstate=",newstate);
	mainroad.changeTrafficLight(101);
	mainroad.changeTrafficLight(102);
    }
					  

    //!!!
    if(depotVehZoomBack){
	console.log("ring: depotVehZoomBack=true!!! ");
	var res=depot.zoomBackVehicle();
	depotVehZoomBack=res;
	userCanvasManip=true;
    }


}  // updateRing








//##################################################
function drawRing() {
//##################################################

    // resize drawing region if browser's dim has changed (responsive design)
    // canvas_resize(canvas,aspectRatio)

    hasChanged=canvas_resize(canvas,0.96); 
    //hasChanged=true; //!!
    if(hasChanged){
        console.log(" new canvas size ",canvas.width,"x",canvas.height);
	//depot.setDepotPositions(canvas);
 
    }

    // (0) reposition physical x center coordinate as response
    // to viewport size (changes)

    var aspectRatio=canvas.width/canvas.height;


    // (1) update heading of all vehicles rel. to road axis
    // (for some reason, strange rotations at beginning)

    mainroad.updateOrientation(); 


 
    // (2) reset transform matrix and draw background
    // (only needed if no explicit road drawn)
    // sloppy at first drawing. 
    // Remind running engine at increasing time spans...

    ctx.setTransform(1,0,0,1,0,0); 
    if(drawBackground){
	if(hasChanged||(itime<=1) || (itime===20) || userCanvasManip 
	   || (!drawRoad)){
            ctx.drawImage(background,0,0,canvas.width,canvas.height);
	}
    }

    // (3) draw road and possibly traffic lights afterwards (before vehs)
 
    var changedGeometry=userCanvasManip || hasChanged||(itime<=1);
    mainroad.draw(roadImg1,roadImg2,scale,changedGeometry);
    mainroad.drawTrafficLights(traffLightRedImg,traffLightGreenImg);//!!!

    // (4) draw vehicles

    mainroad.drawVehicles(carImg,truckImg,obstacleImgs,scale,vmin,vmax);

    // (5) draw depot vehicles

    depot.draw(obstacleImgs,scale,canvas);


    // (6) draw some running-time vars

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

/*    
    var scaleStr=" scale="+Math.round(10*scale)/10;
    var scaleStr_xlb=9*textsize;
    var scaleStr_ylb=timeStr_ylb;;
    var scaleStr_width=7*textsize;
    var scaleStr_height=1.2*textsize;
    ctx.fillStyle="rgb(255,255,255)";
    ctx.fillRect(scaleStr_xlb,scaleStr_ylb-scaleStr_height,scaleStr_width,scaleStr_height);
    ctx.fillStyle="rgb(0,0,0)";
    ctx.fillText(scaleStr, scaleStr_xlb+0.2*textsize, scaleStr_ylb-0.2*textsize);
    
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

    // (6) draw the speed colormap (text size propto widthPix

    if(drawColormap){
        displayColormap(scale*(center_xPhys-0.03*roadRadius), 
                    -scale*(center_yPhys+0.50*roadRadius), 
		    scale*35, scale*45,
		    vmin,vmax,0,100/3.6);
    }

    // revert to neutral transformation at the end!
    ctx.setTransform(1,0,0,1,0,0); 

}
 



//##################################################
// Running function of the sim thread (triggered by setInterval)
//##################################################

function main_loop() {

    updateRing();
    drawRing();
    userCanvasManip=false;
   //console.log("mainroad.veh.length=",mainroad.veh.length);
   //mainroad.writeVehicles(); // for debugging
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

