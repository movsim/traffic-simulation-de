/* Creating reproducible versions for debugging purposes:

(1) include <script src="js/seedrandom.min.js"></script> in html file
    (from https://github.com/davidbau/seedrandom, copied locally)

(2) apply Math.seedrandom(42) or Math.seedrandom("hello") or similar
    in all files containing Math.random commands 
    => at present, only road.js

!! only use inside functions/methods, e.g., in road constructor;
  otherwise, DOS in some browsers at first, but not subsequent, calls (stop-start)

console.log(Math.random());          // Always 0.0016341939679719736 with 42
console.log(Math.random());          // Always 0.9364577392619949 with 42
 Math.seedrandom(42);                // undo side effects of console commands 
*/


// ##########################################################################################

//const userCanDistortRoads=false; //legacy
const userCanDropObjects=true;
var scenarioString="Test5"; // needed in road.changeLanes etc

drawVehIDs=false; // override control_gui.js
//drawRoadIDs=false; // override control_gui.js
var showCoords=true;  // show logical coords of nearest road to mouse pointer



//#############################################################
// adapt/override standard param settings from control_gui.js
//#############################################################

qIn=10./3600; // inverse time headway
fracTruck=0;

timewarp=240;

IDM_v0=1;
IDM_a=0.05; // a*dt=a*timewarp/fps<=a*300/30=4a must be <v0/2=1;
IDM_b=0.1;
IDM_T=30;
IDM_s0=20;
speedVar=0.5;
density=0; 

// LCModelCar constructed in control_gui.js out of this and set as standard
// in mainroad.veh[i].LCModel for all cars (=all vehicles) by deep copy

var testLongModel=new ACC(IDM_v0,IDM_T,IDM_s0,IDM_a,IDM_b); // to get bmax
MOBIL_bBiasRight_car=2*testLongModel.bmax;
MOBIL_bSafe=2*IDM_a;
MOBIL_bSafeMax=20*IDM_a;
MOBIL_p=0;
MOBIL_bThr=0.1*IDM_a;

commaDigits=0;
setSlider(slider_qIn, slider_qInVal, 3600*qIn, commaDigits, "groups/h");
setSlider(slider_speedVar, slider_speedVarVal, speedVar, 1,
	  "(m/s)<sup>2</sup>");
setSlider(slider_timewarp, slider_timewarpVal, timewarp, 0, "times");

setSlider(slider_IDM_v0, slider_IDM_v0Val, 3.6*IDM_v0, 0, "km/h");
//setSlider(slider_IDM_T, slider_IDM_TVal, IDM_T, 0, "s");

//#########################################################
// random initialization: do not want dynamically add
// individual ouProcess to each vehicle, so just set up an array of 100
// and associate the same process to each vehicle with id%100 the same
//#########################################################

var ouProcess=[];
for (var i=0; i<100 ; i++){
  ouProcess[i]=new OUProcess(0,IDM_a,300); // accel mu, amplitude,corrtime
}



/*######################################################
 Global overall scenario settings and graphics objects

 refSizePhys  => reference size in m (generally smaller side of canvas)
 refSizePix   => reference size in pixel (generally smaller side of canvas)
 scale = refSizePix/refSizePhys 
       => roads have full canvas regardless of refSizePhys, refSizePix

 (1) refSizePix=Math.min(canvas.width, canvas.height) determined during run  

 (2) refSizePhys smaller  => all phys roadlengths smaller
  => vehicles and road widths appear bigger for a given screen size 
  => chose smaller for mobile, 

  Example: refSizePhys propto sqrt(refSizePix) => roads get more compact 
  and vehicles get smaller, both on a sqrt basis

  Or jump at trigger refSizePix<canvasSizeCrit propto clientSize 
  => css cntrl normal/mobile with 2 fixed settings

  NOTICE: canvas has strange initialization of width=300 in firefox 
  and DOS when try sizing in css (see there) only 
 
  document.getElementById("contents").clientWidth; .clientHeight;

  always works!

######################################################*
*/

// scenarioString needed in
// (1) showInfo (control_gui) if info panels are shown
// (2) road: handle some exceptional behavior in the "*BaWue*" scenarios
// otherwise not needed

var scenarioString="GolfCourse"; 
console.log("\n\nstart main: scenarioString=",scenarioString);


var simDivWindow=document.getElementById("contents");
var canvas = document.getElementById("canvas"); 
var ctx = canvas.getContext("2d"); // graphics context
canvas.width  = simDivWindow.clientWidth; 
canvas.height  = simDivWindow.clientHeight;


console.log("before addTouchListeners()");
addTouchListeners();
console.log("after addTouchListeners()");


//##################################################################
// init overall scaling (critAspectRatio should be consistent with 
// width/height in css.#contents)
//##################################################################

var isSmartphone=mqSmartphone();

var refSizePhys=(isSmartphone) ? 1200 : 1800; // also adapt in updateDimensions

var critAspectRatio=120./95.; // from css file width/height of #contents
                              // the higher, the longer sim window
                         // must be the same as in css:
                         // max-aspect-ratio: 24/19 etc

var refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);
var scale=refSizePix/refSizePhys;


var hasChanged=true; // window or physical dimensions have changed


//<NETWORK>
//##################################################################
// Specification of PHYSICAL road network geometry
// If viewport or refSizePhys changes => updateDimensions();
//##################################################################

var nLanes_main=2;

// all relative "Rel" settings with respect to refSizePhys, not refSizePix!

var center_xRel=0.43;
var center_yRel=-0.54;
var arcRadiusRel=0.35;

// all the following initialized/redefined in updateDimensions();

var center_xPhys;
var center_yPhys;

var arcRadius; 
var arcLen;
var hideFirst_m=100; 
var straightLen;
var mainroadLen;

// input for trajSpec=traj_precalc(x0,y0,phi0,du,curv)
// all defined/redefined in updateDimensions()

var x0;
var y0;
var phi0;
var du;
var curv;
var trajSpec;

// def trajectories

function traj_x(u){return trajFromSpec_x(u,trajSpec);}
function traj_y(u){return trajFromSpec_y(u,trajSpec);}

var traj=[traj_x,traj_y];

var trajNet=[];
trajNet[0]=traj;

// define/redefine geometry, trajectories

updateDimensions();

function updateDimensions(){ // if viewport or sizePhys changed
  console.log("in updateDimensions");
  refSizePhys=(isSmartphone) ? 1200 : 1800; // also adapt in definition above
  refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);
  scale=refSizePix/refSizePhys;
  
  center_xPhys=center_xRel*refSizePhys; //[m]
  center_yPhys=center_yRel*refSizePhys;

  // redefine basis of traj*_x, traj*_y or traj_x[], traj_y[]

  if(true){  // formerly hasChangedPhys
    arcRadius=arcRadiusRel*refSizePhys;
    arcLen=arcRadius*Math.PI;
    straightLen=refSizePhys*critAspectRatio-center_xPhys+hideFirst_m;

    x0=center_xPhys+straightLen;
    y0=center_yPhys+arcRadius;
    phi0=Math.PI;

    du=[0.20*straightLen,0.25*straightLen,0.50*straightLen,0.25*straightLen,
	Math.PI*arcRadius,0.46*straightLen,
	0.5*Math.PI*arcRadius,0.25*straightLen];
    curv=[0,1.8/arcRadius,-1.8/arcRadius,1.8/arcRadius,
	  1/arcRadius,0,1/arcRadius,0];
    trajSpec=traj_precalc(x0,y0,phi0,du,curv);

    mainroadLen=0;
    for(var i=0; i<du.length; i++){mainroadLen+=du[i];}
  }
  
  if(true){
    console.log("updateDimensions: mainroadLen=",mainroadLen,
		" isSmartphone=",isSmartphone);
  }
}



// specification of road width and vehicle sizes
// remains constant => road becomes more compact for smaller screens

var laneWidth=100;
var car_length=80; // car length in m
var car_width=100; // car width in m
var truck_length=90; // irrelevant but needed in road.js
var truck_width=30; // irrelevant but needed in road.js



//##################################################################
// Specification of LOGICAL road network
//##################################################################

var isRing=false;  // 0: false; 1: true
var roadIDmain=1;

speedInit=1; // IC for speed

var mainroad=new road(roadIDmain,mainroadLen,laneWidth,nLanes_main,
		      traj,
		      density, speedInit,fracTruck, isRing);
mainroad.nSegm=60;
// road network (network declared in canvas_gui.js)

network[0]=mainroad;  network[0].drawVehIDs=drawVehIDs;


//</NETWORK>


//#########################################################
// model initialization (models and methods override control_gui.js)
//#########################################################
	
updateModels(); // defines longModelCar,-Truck,LCModelCar,-Truck,-Mandatory
longModelCar.noiseAcc=0; // =0.3 m/s^2 in the other simulations

//####################################################################
// Global graphics specification
//####################################################################


var drawBackground=true; // if false, default unicolor background
var drawRoad=true; // if false, only vehicles are drawn
var userCanvasManip; // true only if user-driven geometry changes

var drawColormap=false;
var vmin_col=0; // min speed for speed colormap (drawn in red)
//var vmax_col=4/3.6; // max speed for speed colormap (drawn in blue-violet)
var vmax_col=0; // 0,0 => no semitransp speed indicator drawn


//####################################################################
// Images
//####################################################################


// init background image

var background = new Image();
background.src ='figs/backgroundGrass.jpg'; 
 

// init vehicle image(s)

carImg = new Image();
//carImg.src = 'figs/blackCarCropped.gif';
carImg.src = 'figs/golfer2.png';
truckImg = new Image();
truckImg.src = 'figs/truck1Small.png';


// init traffic light images

traffLightRedImg = new Image();
traffLightRedImg.src='figs/trafficLightRed_affine.png';
traffLightGreenImg = new Image();
traffLightGreenImg.src='figs/trafficLightGreen_affine.png';


//define obstacle image names

obstacleImgNames = []; // srcFiles[0]='figs/obstacleImg.png'
obstacleImgs = []; // srcFiles[0]='figs/obstacleImg.png'
for (var i=0; i<10; i++){
  obstacleImgs[i]=new Image();
  obstacleImgs[i].src = (i==0)
    ? "figs/obstacleImg.png"
    : "figs/constructionVeh"+(i)+".png";
  obstacleImgNames[i] = obstacleImgs[i].src;
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
//roadImg1=roadImgs1[nLanes_main-1];
roadImg1.src="figs/roadGolf1.png";
//roadImg1.src="figs/roadGolf2.png";
roadImg2 = new Image();
//roadImg2=roadImgs2[nLanes_main-1];
roadImg2.src="figs/roadGolf2.png";


//############################################
// traffic objects and traffic-light control editor
//############################################


//############################################
// run-time specification and functions
//############################################

var time=0;
var itime=0;
var fps=30; // frames per second (unchanged during runtime)
var dt=timewarp/fps;


//#################################################################
function updateSim(){
//#################################################################

  time +=dt; // dt depends on timewarp slider (fps=const)
  itime++;
  
  // (0) do some tests during development

  if(false){
  //if(itime==1){
    // tests u-shape with new generic algorithm

    var x0=1000;//center_xPhys+straightLen; // 1000;
    var y0=-200; //center_yPhys+arcRadius; //r
    var phi0=Math.PI;
    var du=[x0-200,Math.PI*200,x0-200]; 
    var curv=[0,1./200,0];

    var trajSpecTest=traj_precalc(x0,y0,phi0,du,curv);
    console.log("itime=",itime," time=",time," after traj_precalc:",
	       "\ntrajSpecTest=",trajSpecTest,
	       "");
    
    for(var i=0; i<20; i++){
      var u=200*i;
      console.log("u=",u," trajFromSpec(u,trajSpecTest)=",
		  trajFromSpec(u,trajSpecTest),
		  "\n  x=trajFromSpec_x(u,trajSpecTest)=",
		  trajFromSpec_x(u,trajSpecTest),
		  " y=trajFromSpec_y(u,trajSpecTest)=",
		  trajFromSpec_y(u,trajSpecTest),
		  "");
    }
  }

  

  
  //console.log("time=",time);
  if(false){// test random.js
  //if(itime==1){// test random.js
    var wiener=new Wiener(dt);
    var ou=new OUProcess(20,5,100); // mu, amplitude,corrtime
    for(var its=0; its<200; its++){
      console.log("t=",its*dt,
		  " wiener.y=",wiener.y,
		  " ou.y=",ou.y,
		  "");
      wiener.update(dt);
      ou.update(dt);      
    }
    alert("stop for test");
  }

  

  // (1) update scales

  if ((canvas.width!=simDivWindow.clientWidth)
      ||(canvas.height != simDivWindow.clientHeight)){
    hasChanged=true;
    canvas.width  = simDivWindow.clientWidth;
    canvas.height  = simDivWindow.clientHeight;

    if(isSmartphone!=mqSmartphone()){
      isSmartphone=mqSmartphone();
    }

    updateDimensions(); // updates refsizePhys, -Pix,  geometry
 
    if(true){
      console.log("updateSim: haschanged=true: new canvas dimension: ",
		  canvas.width," X ",canvas.height);
      console.log("window.innerWidth=",window.innerWidth,
		  " window.innerHeight=",window.innerHeight);
    }
  }
 

  // (2) transfer effects from slider interaction and mandatory regions
  // to the vehicles and models

  // because longModelCar is set to standard value  when changing
  // a parameter slider ("updateModels()") I have to revert to
  // zero setting used here
  // !!!! change concept, introduce explicitly in ACC model
  // and provide calcAccDet function for use in MOBIL
  
  longModelCar.noiseAcc=0; 
  mainroad.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				       LCModelCar,LCModelTruck,
				       LCModelMandatory);

  //console.log(" mainroadLen=",mainroadLen," mainroad.roadLen=",mainroad.roadLen);

   // (2a) update moveable speed limits
 
  //  (2b) without this zoomback cmd, everything works but depot vehicles
  // just stay where they have been dropped outside of a road
  // (here more responsive than in drawSim)


  
  // (2 golf special) allow overtaking for some cars/golf groups: 
  // test for attributes incepted in canvas_gui->handleClick_golfCourse
  //!!! BEFORE calcAccelerations because models reset every timestep

  var dtmax_overtakeGolf=300;  // after 600 s, overtaking ability revoked

  for(var i=0; i<mainroad.veh.length; i++){
    subject=mainroad.veh[i];

    if(subject.canOvertakeGolf){
      subject.dt_overtakeGolf+=dt; 
      if(subject.dt_overtakeGolf>dtmax_overtakeGolf){
	subject.canOvertakeGolf=false;
	subject.dt_overtakeGolf=0;
      }
    }
    
    subject.LCModel.bBiasRight=(subject.canOvertakeGolf)
      ? -10*MOBIL_bThr : MOBIL_bBiasRight_car;

    // longitudinally boost overtaking Golf group
    
    subject.longModel.a=(subject.canOvertakeGolf)
      ? 2*IDM_a : IDM_a;
    subject.longModel.v0=(subject.canOvertakeGolf)
      ? 1.5*IDM_v0 : IDM_v0;

    if(false){
      console.log(
	"vehicle ",subject.id,
	" t=",time,
	" canOvertakeGolf=",subject.canOvertakeGolf,
	" dt_overtakeGolf=",subject.dt_overtakeGolf,
	" LCModel.bBiasRight=",subject.LCModel.bBiasRight.toFixed(2));
    }
  }

  

    // (3) do central simulation update of vehicles

  mainroad.updateLastLCtimes(dt);
  mainroad.calcAccelerations();

  //console.log("After calcAcc:"); mainroad.writeVehicleLongModels();
  

  mainroad.changeLanes();

  // (3 golf special)
  // add accel fluctuations (Golf special) AFTER lane change because
  // otherwise fluctated acc is compared with
  // non-fluctuated acc for target acc

  for(var i=0; i<ouProcess.length; i++){
    ouProcess[i].update(dt);
  }
  
  for(var i=0; i<mainroad.veh.length; i++){
    if(mainroad.veh[i].isRegularVeh()){
      var ouIndex=(mainroad.veh[i].id)%100;
      var accFluct=ouProcess[ouIndex].y;
      if((accFluct>0)&&(mainroad.veh[i].speed>IDM_v0)){accFluct=0;}
      if(mainroad.veh[i].u>0.1*mainroad.roadLen){
        mainroad.veh[i].acc+=accFluct;
      }
    }
  }
  
  mainroad.updateSpeedPositions();
  mainroad.updateBCdown();
  mainroad.updateBCup(qIn,dt); // argument=total inflow
  // adapt LC time to new time frame of golf course
  for (var i=0; i<mainroad.veh.length; i++){
    mainroad.veh[i].dt_LC=120;
  }
  
  for (var i=0; i<mainroad.veh.length; i++){
	if(mainroad.veh[i].speed<0){
	    console.log(" speed "+mainroad.veh[i].speed
			    +" of mainroad vehicle "
			    +i+" is negative!");
	}
  }


  
  
    // (4) update detector readings



// (6) debug output

    //if((itime>=125)&&(itime<=128)){
  if(false){
    console.log("\ntime=",time," itime=",itime,": end of updateSim loop");


    if(true){
      console.log("\nmainroad vehicles:");
      mainroad.writeVehiclesSimple();
    }

  }




}//updateSim




//##################################################
function drawSim() {
//##################################################

    //!! test relative motion isMoving

  var movingObserver=false;
  var uObs=0*time;

  // (1) adapt text size
 
  var relTextsize_vmin=(isSmartphone) ? 0.03 : 0.02;
  var textsize=relTextsize_vmin*Math.min(canvas.width,canvas.height);



  // (2) reset transform matrix and draw background
  // (only needed if changes, plus "reminders" for lazy browsers)

  ctx.setTransform(1,0,0,1,0,0);
  if(drawBackground){
    if(hasChanged||(itime<=10) || (itime%50==0) || userCanvasManip
      || (!drawRoad)){
      ctx.drawImage(background,0,0,canvas.width,canvas.height);

      if(false){
	console.log("itime=",itime,
		      " hasChanged=",hasChanged,
		      " userCanvasManip=",userCanvasManip,
		      " movingObserver=",movingObserver,
		      " before drawing background");
      }
    }
  }
  

  // (3) draw mainroad
  // (always drawn; changedGeometry only triggers making a new lookup table)

  
  var changedGeometry=userCanvasManip || hasChanged||(itime<=1)||true; 


  mainroad.draw(roadImg1,roadImg2,changedGeometry,
		0,mainroad.roadLen,
		movingObserver,uObs,center_xPhys,center_yPhys);

  if(false){
    console.log("road.draw w/ full parameter set:",
		" mainroad.roadLen=",mainroad.roadLen,
		" movingObserver=",movingObserver,
		" uObs=",uObs,
		" center_xPhys=",center_xPhys,
 		" center_yPhys=",center_yPhys);
  }
 
  // (4) draw vehicles
  //!! all args at and after umax are optional
  // but if I want one such as "upright", I must give the others
  // (relevant in coffeemeterGame, only), too

  var upright=true; // golfers shout not be upside down
  mainroad.drawVehicles(carImg,truckImg,obstacleImgs,
			vmin_col,vmax_col,
			0,mainroad.roadLen,
			movingObserver,uObs,center_xPhys,center_yPhys,upright);

  // (5a) draw traffic objects 


  // (5b) draw speedlimit-change select box

  ctx.setTransform(1,0,0,1,0,0); 
  drawSpeedlBox();


  // (6) show simulation time and detector displays

  displayTime(time,textsize);


  // (6a) show scale info

  if(false){
    ctx.setTransform(1,0,0,1,0,0); 
    var textsize=0.02*Math.min(canvas.width,canvas.height); // 2vw;
    ctx.font=textsize+'px Arial';
    var scaleStr=" scale="+Math.round(10*scale)/10;
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
  }

      // (6b) draw the speed colormap
      //!! Now always false; drawn statically by html file!

  if(drawColormap){
      displayColormap(0.22*refSizePix,
                   0.43*refSizePix,
                   0.1*refSizePix, 0.2*refSizePix,
		   vmin_col,vmax_col,0,100/3.6);
  }

  
  // drawSim (7): show logical coordinates if activated

  if(showCoords&&mouseInside){
    showLogicalCoords(xPixUser,yPixUser);
  }


  // may be set to true in next step if changed canvas 
  // (updateDimensions) or if old sign should be wiped away 

  hasChanged=false;

  // revert to neutral transformation at the end!

  ctx.setTransform(1,0,0,1,0,0);


} // drawSim

 
//############################################
// dynamic infotext
// since jquery stuff does not work locally, fill directly
// strings with innerHTML
// newlines not allowed in infoString but can escape them\ for readability
//############################################

var infoString=[];
infoString[0]=
  "<h1>Golf Course</h1>\
<ul>\
<li>The light green area symbolizes an about 6000 m long Golf course (mouse position indicated)</li><br>\
<li>Groups of players (one symbol) start at an rate (groups per hour) adjustable by the top slider</li><br>\
<li>When not interrupted, the golfers advance at a maximum speed adjustable by the first \"Behaviour\" slider</li><br>\
<li>Some groups intermittently slow down or stop for reasons such as searching off-terrain Golf balls. This delay can be controlled with the second behavioural slide</li><br>\
<li> Depending on the traffic, other Golfers pile up</li><br>\
<li>Normally, Golfers are not allowed to overtake. However, by clicking on a team symbol waiting behind a sluggish team, you allow to override this rule!</li><br>\
</ul>"

function showInfoString(){
  document.getElementById("infotext").innerHTML=infoString[0];
}



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
// (ii) when pressing the start button in *gui.js
//  ("myRun=setInterval(main_loop, 1000/fps);")
//############################################

console.log("first main execution");

showInfoString();

var myRun=setInterval(main_loop, 1000/fps);



