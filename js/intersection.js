
var userCanDistortRoads=false;
var userCanDropObjects=true;

//#############################################################
// adapt standard slider settings from control_gui.js
// (sliders with default inits need not to be reassigned here)
// and define variables w/o sliders in this scenario
//#############################################################

// following flags defined in control_gui.js
// controlled by html select elements

//{0:"signalized",1:"priority",2:"4wayStop",3:"prioRight"};
var intersectionIndex=1; // callback: control_gui - handleIntersectionType
document.getElementById("changePrioritySelect").selectedIndex
  =intersectionIndex;

// debugging switches

var markVehsMerge=false; // for debugging road.mergeDiverge
var drawVehIDs=false;    // for debugging road.mergeDiverge
var useSsimpleOD_debug=false;
var drawRingDirect=false; // draw ring vehicles directly instead gen Traj

// merging fine tuning
//!! fiddle to optimize de-facto anticipation of merging vehs 
// and last stopping in order to prevent crashes while waiting

var padding=30;         // merge: visib. extension for target by origin vehs
var paddingLTC=20;      // merge: visib. extension for origin by target vehs
var fracArmBegin=0.87; // merge begin at fracArmBegin of arm length
var fracArmEnd=0.92; // merge end at fracArmEnd of arm length

// vehicle and traffic properties

fracTruck=0.2; // overrides control_gui 0.15
factor_v0_truck=0.9; // truck v0 always slower than car v0 by this factor
                     // (incorporated/updated in sim by updateModels) 
IDM_b=1;

MOBIL_mandat_bSafe=4; // >b, <physical limit
MOBIL_mandat_bThr=0;  
MOBIL_mandat_bias=2; // normal: bias=0.1, rFirst: bias=42
MOBIL_mandat_p=0;  // normal: p=0.2, rFirst: p=0;


// define non-standard slider initialisations

qIn=2000./3600;
slider_qIn.value=3600*qIn;
slider_qInVal.innerHTML=3600*qIn+" veh/h";

mainFrac=1.0;
slider_mainFrac.value=100*mainFrac;
slider_mainFracVal.innerHTML=100*mainFrac+"%";

leftTurnBias=0;
//slider_leftTurnBias.value=leftTurnBias;
//slider_leftTurnBiasVal.innerHTML=leftTurnBias;

focusFrac=1;
//slider_focusFrac.value=100*focusFrac;
//slider_focusFracVal.innerHTML=100*focusFrac+"%";

timewarp=8;
slider_timewarp.value=timewarp;
slider_timewarpVal.innerHTML=timewarp +"times";

IDM_v0=50./3.6;
slider_IDM_v0.value=3.6*IDM_v0;
slider_IDM_v0Val.innerHTML=3.6*IDM_v0+" km/h";

IDM_a=0.9; 
slider_IDM_a.value=IDM_a;
slider_IDM_aVal.innerHTML=IDM_a+" m/s<sup>2</sup>";
factor_a_truck=1; // to allow faster slowing down of the uphill trucks

//IDM_T=0.6; // overrides standard settings in control_gui.js
//slider_IDM_T.value=IDM_T;
//slider_IDM_TVal.innerHTML=IDM_T+" s";

// no LC sliders for roundabout



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

var scenarioString="Roundabout";
console.log("\n\nstart main: scenarioString=",scenarioString);

var simDivWindow=document.getElementById("contents");
var canvas = document.getElementById("canvas"); 
var ctx = canvas.getContext("2d"); // graphics context
canvas.width  = simDivWindow.clientWidth; 
canvas.height  = simDivWindow.clientHeight;
var aspectRatio=canvas.width/canvas.height;


console.log("before addTouchListeners()");
addTouchListeners();
console.log("after addTouchListeners()");


//##################################################################
// overall scaling (critAspectRatio should be consistent with 
// width/height in css.#contents)
//##################################################################

//!! also change "isSmartphone=" in updateSim!!

var isSmartphone=mqSmartphone();

var refSizePhys=(isSmartphone) ? 90 : 110;  // const; all objects scale with refSizePix


var critAspectRatio=120./95.; // from css file width/height of #contents

var refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);
var scale=refSizePix/refSizePhys;


//##################################################################
// Specification of physical road geometry and vehicle properties
// If refSizePhys changes, change them all => updateDimensions();
//##################################################################

// the following remains constant 
// => road becomes more compact for smaller screens

var car_length=4.5; // car length in m
var car_width=2.5; // car width in m
var truck_length=8; // trucks
var truck_width=3; 
var laneWidth=4; 


// all relative "Rel" settings with respect to refSizePhys, not refSizePix!

var center_xRel=0.63;
var center_yRel=-0.55;
var lArmRel=0.6; // arm size w/resp to refSizePhys

// geom specification ring

var xcPhys=center_xRel*refSizePhys; //[m]
var ycPhys=center_yRel*refSizePhys;
//var rRing=rRingRel*refSizePhys; // roundabout radius [m]

// geom specification arms

var nLanes=1;
var lArm=lArmRel*refSizePhys;
var uStop=lArm-(nLanes+0.5)*laneWidth; // stop 0.5*laneWidth before inters



//###############################################################
// physical (m) roads
//###############################################################


//var nLanes_ring=1;


// central ring (all in physical coordinates)
// stitchAngleOffset brings stitch of ring as far upstream of merge as possible 


// arms 0 and 1 (ingoing/outgoing east arms)

function traj0_x(u){return xcPhys+lArm-u;}
function traj0_y(u){return ycPhys+0.5*laneWidth;}

function traj1_x(u){return xcPhys+u;}
function traj1_y(u){return ycPhys-0.5*laneWidth;}


// arms 2 and 3 (ingoing/outgoing south arms)

function traj2_x(u){return xcPhys+0.5*laneWidth;}
function traj2_y(u){return ycPhys-(lArm-u);}

function traj3_x(u){return xcPhys-0.5*laneWidth;}
function traj3_y(u){return ycPhys-u;}


// arms 4 and 5 (ingoing/outgoing west arms)

function traj4_x(u){return xcPhys-(lArm-u);}
function traj4_y(u){return ycPhys-0.5*laneWidth;}

function traj5_x(u){return xcPhys-u;}
function traj5_y(u){return ycPhys+0.5*laneWidth;}


// arms 6 and 7 (ingoing/outgoing north arms)

function traj6_x(u){return xcPhys-0.5*laneWidth;}
function traj6_y(u){return ycPhys+(lArm-u);}

function traj7_x(u){return xcPhys+0.5*laneWidth;}
function traj7_y(u){return ycPhys+u;}



//##################################################################
// Specification of logical road network
// template new road(ID,length,laneWidth,nLanes,traj_x,traj_y,
//		     density,speedInit,fracTruck,isRing,doGridding[opt]);
// road with inflow/outflow: just add updateBCup/down at simulation time
// road with passive merge/diverge: nothing needs to be added
// road with active merge (ramp): road.mergeDiverge at sim time
// road with active diverge (more generally when routes are relevant): 
//   road.setOfframpInfo at init time and road.mergeDiverge at sim time

//##################################################################


var speedInit=20; // m/s



// odd roadIDs are outbound !!
//new road(ID,length,laneWidth,nLanes,traj_x,traj_y,
//		       density,speedInit,fracTruck,isRing,doGridding[opt]);

var arm=[]; 
arm[0]=new road(0,lArm,laneWidth,nLanes,traj0_x,traj0_y,0,0,0,false);
arm[1]=new road(1,lArm,laneWidth,nLanes,traj1_x,traj1_y,0,0,0,false);
arm[2]=new road(2,lArm,laneWidth,nLanes,traj2_x,traj2_y,0,0,0,false);
arm[3]=new road(3,lArm,laneWidth,nLanes,traj3_x,traj3_y,0,0,0,false);
arm[4]=new road(4,lArm,laneWidth,nLanes,traj4_x,traj4_y,0,0,0,false);
arm[5]=new road(5,lArm,laneWidth,nLanes,traj5_x,traj5_y,0,0,0,false);
arm[6]=new road(6,lArm,laneWidth,nLanes,traj6_x,traj6_y,0,0,0,false);
arm[7]=new road(7,lArm,laneWidth,nLanes,traj7_x,traj7_y,0,0,0,false);

for (var i=0; i<arm.length; i++){
  network[i]=arm[i];  // network declared in canvas_gui.js
}


for (var i=0; i<arm.length; i++){
    //arm[i].padding=padding;
    //arm[i].paddingLTC=paddingLTC;
    //if(markVehsMerge){arm[i].markVehsMerge=true;}
    if(drawVehIDs){arm[i].drawVehIDs=true;}
}

//################################################################
// define routes
// 0=E-arm, ingoing, 2=S-arm, ingoing,  4=W-arm, ingoing, 6=N-arm, ingoing
// 1=E-arm, outgoing, 3=S-arm, outgoing,  5=W-arm, outgoing, 7=N-arm, outgoing
//################################################################

var route0L=[0,3];  // inflow E-arm, left turn
var route0C=[0,5];  // inflow E-arm, straight ahead
var route0R=[0,7];  // inflow E-arm, right turn
var route0U=[0,1];  // inflow E-arm, U-tern
var route2L=[2,5];  // inflow S-arm, left turn
var route2C=[2,7];  // inflow S-arm, straight ahead
var route2R=[2,1];  // inflow S-arm, right turn
var route4L=[4,7];  // inflow W-arm, left turn
var route4C=[4,1];  // inflow W-arm, straight ahead
var route4R=[4,3];  // inflow W-arm, right turn
var route6L=[6,1];  // inflow N-arm, left turn
var route6C=[6,3];  // inflow N-arm, straight ahead
var route6R=[6,5];  // inflow N-arm, right turn



//############################################################
// add standing virtual vehicle at the end of the merging arms
// new vehicle (length, width, u, lane, speed, type)
// prepending=unshift; 
//############################################################

for(var i=0; i<8; i+=2){
    arm[i].veh.unshift(new vehicle(0.0, laneWidth, uStop, 0, 0, "obstacle"));//!!!
}


//#########################################################
// model initialization (models and methods defined in control_gui.js)
//#########################################################
	
updateModels(); // defines longModelCar,-Truck,LCModelCar,-Truck,-Mandatory


//####################################################################
// Global graphics specification and image file settings
//####################################################################

var hasChanged=true; // window dimensions have changed (responsive design)

var drawBackground=true; // if false, default unicolor background
var drawRoad=true; // if false, only vehicles are drawn
var userCanvasManip; // true only if user-driven geometry changes

var drawColormap=false;
var vmin_col=0; // min speed for speed colormap (drawn in red)
var vmax_col=70/3.6; // max speed for speed colormap (drawn in blue-violet)


//#########################################################
// The images
//#########################################################


// init background image

var background = new Image();
background.src ='figs/backgroundGrass.jpg'; 
 

// init vehicle image(s)

carImg = new Image();
carImg.src = 'figs/blackCarCropped.gif';
truckImg = new Image();
truckImg.src = 'figs/truck1Small.png';


// init traffic light images

traffLightRedImg = new Image();
traffLightRedImg.src='figs/trafficLightRed_affine.png';
traffLightGreenImg = new Image();
traffLightGreenImg.src='figs/trafficLightGreen_affine.png';


// define obstacle images

obstacleImgNames = []; // srcFiles[0]='figs/obstacleImg.png'
obstacleImgs = []; // srcFiles[0]='figs/obstacleImg.png'
for (var i=0; i<10; i++){
  obstacleImgs[i]=new Image();
  obstacleImgs[i].src = (i==0)
    ? "figs/obstacleImg.png"
    : "figs/constructionVeh"+(i)+".png";
  obstacleImgNames[i] = obstacleImgs[i].src;
}


// general images: init road images with 1 to 4 lanes

roadImgs1 = []; // road with lane separating line
roadImgs2 = []; // road without lane separating line

for (var i=0; i<4; i++){
    roadImgs1[i]=new Image();
    roadImgs1[i].src="figs/road"+(i+1)+"lanesCropWith.png"
    roadImgs2[i]=new Image();
    roadImgs2[i].src="figs/road"+(i+1)+"lanesCropWithout.png"
}

// associating the images to the arms

armImg1 = new Image();
armImg1=roadImgs1[nLanes-1];

armImg2 = new Image();
armImg2=roadImgs2[nLanes-1];




//############################################
// traffic objects
//############################################

// TrafficObjects(canvas,nTL,nLimit,xRelDepot,yRelDepot,nRow,nCol)
var trafficObjs=new TrafficObjects(canvas,4,0,0.80,0.25,2,2);
var trafficLightControl=new TrafficLightControlEditor(trafficObjs,0.33,0.68);



//############################################
// run-time specification and functions
//############################################

var time=0;
var itime=0;
var fps=30; // frames per second
var dt=timewarp/fps;




//#################################################################
function updateSim(){
//#################################################################


  
    // (0) update times and revert vehicle markings if applicable

  time +=dt; // dt depends on timewarp slider (fps=const)
    itime++;
    isSmartphone=mqSmartphone(); // defined in media.js

  if(markVehsMerge){
	for (var i=0; i<arm.length; i++){arm[i].revertVehMarkings();}
  }

 
 

    //##############################################################
    // (1) transfer effects from slider interaction and mandatory regions
    // to the vehicles and models:
    // also initialize models for new cars entering at inflow points
    //##############################################################

 
    // updateModelsOfAllVehicles also selectively sets LCModelMandatory
    // to offramp vehs based on their routes!
    // !! needed even for single-lane roads to trigger diverge actions!

  for(var i=0; i<arm.length; i++){
        arm[i].updateModelsOfAllVehicles(longModelCar,longModelTruck,
					 LCModelCar,LCModelTruck,
					 LCModelMandatory);
  }



    //##############################################################
    // (2) do central simulation update of vehicles
    //##############################################################


    //acceleration (no interaction between roads at this point)
    // !! (motion at the end!)

    for(var i=0; i<arm.length; i++){
      arm[i].calcAccelerations(); 
      //arm[i].updateSpeedPositions();
    } 


    // inflow BC

    // route fractions depend on slider-controlled 
    // mainFrac, focusFrac  and leftTurnBias
    // main routes: route0C (=[0,5], inflow E-arm, straight ahead) 
    //              route4C (=[4,1], inflow W-arm, opposite direction)
    // road label 1=inflow E-arm
    // road label 2=outflow E-arm
    // road label 3=inflow S-arm etc

    var q0=0.5*mainFrac*qIn;
    var q4=q0;
    var q2=0.5*(1-mainFrac)*qIn;
    var q6=q2;

    var cFrac=1/3. + 2./3*focusFrac - focusFrac*Math.abs(leftTurnBias);
    var lFrac=(1-cFrac)/2.*(1+leftTurnBias);
    var rFrac=(1-cFrac)/2.*(1-leftTurnBias);
    var clFrac=cFrac+lFrac;

    //console.log("roundabout:updateSim: cFrac=",cFrac," lFrac=",lFrac," rFrac=",rFrac);

    var ran=Math.random();


    var route0In=(ran<cFrac) ? route0C : (ran<clFrac) ? route0L : route0R;
    var route2In=(ran<cFrac) ? route2C : (ran<clFrac) ? route2L : route2R;
    var route4In=(ran<cFrac) ? route4C : (ran<clFrac) ? route4L : route4R;
    var route6In=(ran<cFrac) ? route6C : (ran<clFrac) ? route6L : route6R;

    // override for debugging

    if(useSsimpleOD_debug){
        q0=0.2*qIn; q6=0.5*qIn; q4=q2=0;
        route0In=route0C;route6In=route6C;
    }

    arm[0].updateBCup(q0,dt,route0In);
    arm[2].updateBCup(q2,dt,route2In);
    arm[4].updateBCup(q4,dt,route4In);
    arm[6].updateBCup(q6,dt,route6In);

    // outflow BC

  for(var i=1; i<8; i+=2){
	arm[i].updateBCdown();
  }


    //##############################################################
    // merges into the roundabout ring (respecting prio)
    // template: road.mergeDiverge(newRoad,offset,uStart,uEnd,isMerge,
    //                             toRight,[ignoreRoute,
    //                             respectPrioOther,respectPrioOwn])
    //##############################################################

  // !!!! first example: right turns
  // override divergeAhead decisions usually done by the routes

  //!!!! Filter uStart,uEnd does work for diverge
  // !! understand how merge and diverge are different
  //!!!! without routes, diverge and merge are identical??
  
  for(var i=0; i<8; i+=2){
    for(var iveh=0; iveh<arm[i].veh.length; iveh++){
      if( (arm[i].veh[iveh].isRegularVeh())
	  &&(arm[i].veh[iveh].u>uStop-10)){
	arm[i].veh[iveh].divergeAhead=true;
      }
    }
  }
  arm[0].mergeDiverge(arm[7], -uStop+12, uStop-10, uStop, true, false);
  arm[2].mergeDiverge(arm[1], -uStop+12, uStop-10, uStop, false, true);
  arm[4].mergeDiverge(arm[3], -uStop+12, uStop-3, uStop, false, false);
  arm[6].mergeDiverge(arm[4], -uStop+12, uStop-3, uStop, false, true);

  //!!!! toRight=false sets veh[iveh].laneStart=1, toRight=true to -1. Why?
  // set veh[iveh].dt_afterLC=9999 to suppress smooth LV
  // (otherwise increment veh[iveh].dt_afterLC)
  
  for(var i=1; i<9; i+=2){
    for(var iveh=0; iveh<arm[i].veh.length; iveh++){
      if(arm[i].veh[iveh].isRegularVeh()){
	arm[i].veh[iveh].dt_afterLC=9999; //!!!! no smooth LC, just to target lane
      }
    }
  }



     // !! motion at the end

    for(var i=0; i<arm.length; i++){
      arm[i].updateSpeedPositions();

      // !!! forcibly move vehicles behind virtual obstacle vehicle 0
      // if they cross it (may happen for very low a, T, high timewarp)
      // to avoid bugs (otherwise, the vehicle will orbit perpetually
      // on (traj_x,traj_y) instead of merging)
      // also at least partially undo swapping of vehicle properties
      // in roadsection.update routines veh<->obstacle
      // by at least resetting veh[0] as obstacle of length 0
      // the true veh may be lost but this is an extremely unrealistic
      // situation with many crashes anyway
      // (swap only as consequence of crash) => see roundabout_debug.js,-html

      if(true){
	if(arm[i].veh.length>=2){
	  if(arm[i].veh[1].u>arm[i].veh[0].u-0.5){
	    //console.log("veh.id=", arm[i].veh[1].id,
	//		"veh.u=", arm[i].veh[1].u.toFixed(2),
	//		"veh[0].type=", arm[i].veh[0].type,
	//		"veh[0].u=", arm[i].veh[0].u.toFixed(2));
	    arm[i].veh[1].u=arm[i].veh[0].u-0.5;
	    arm[i].veh[0].type="obstacle"; // for some f... reason swap
	    arm[i].veh[0].length=0;
	    console.log("forcibly moved veh ",arm[i].veh[1].id,
			" behind obstacle",
			"veh.u=", arm[i].veh[1].u.toFixed(2),
			"veh[0].u=", arm[i].veh[0].u.toFixed(2));
			
	  }
	}
      }
    } 

  if(userCanDropObjects&&(!isSmartphone)&&(!trafficObjPicked)){
    trafficObjs.zoomBack();
  }


    //##############################################################
    // debug output
    //##############################################################

    if(false){
      var idTest=812;
      for(var iArm=0; iArm<8; iArm++){
	for(var iveh=0; iveh<arm[iArm].veh.length; iveh++){
	    if(arm[iArm].veh[iveh].id==idTest){
		console.log("time=",time," itime=",itime, " vehID=",idTest,
			    " road=arm",iArm, "iveh=",iveh,
			    " u=",arm[iArm].veh[iveh].u,
			    " veh0.u=",arm[iArm].veh[0].u
			   );
	    }
	}
      }


      //if((itime>=165)&&(itime<=168)){
      if(false){
	console.log("\nDebug updateSim: Simulation time=",time,
		    " itime=",itime);
	arm[6].writeVehiclesSimple();
	arm[7].writeVehiclesSimple();
      }
    }//debug


  //console.log("\nend updateSim:");
  //arm[7].writeVehiclesSimple();


  
}//updateSim




//##################################################
function drawSim() {
//##################################################


    // (0) redefine graphical aspects of road (arc radius etc) using
    // responsive design if canvas has been resized 
    // isSmartphone defined in updateSim
 
    var relTextsize_vmin=(isSmartphone) ? 0.03 : 0.02; //xxx
    var textsize=relTextsize_vmin*Math.min(window.innerWidth,window.innerHeight);


    if(false){
        console.log(" new total inner window dimension: ",
		window.innerWidth," X ",window.innerHeight,
		" (full hd 16:9 e.g., 1120:630)",
		    " canvas: ",canvas.width," X ",canvas.height);
	console.log("isSmartphone=",isSmartphone);

    }


    // (1) define global properties;
    // gridTrajectories only needed if roads can be distorted by mouse

    if ((canvas.width!=simDivWindow.clientWidth)
	||(canvas.height != simDivWindow.clientHeight)){
	hasChanged=true; // only pixel; physical changes in updateSim
	canvas.width  = simDivWindow.clientWidth;
        canvas.height  = simDivWindow.clientHeight;
	aspectRatio=canvas.width/canvas.height;
	refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);

	scale=refSizePix/refSizePhys; // refSizePhys=constant unless mobile
        //updateDimensions(); // not defined for roundabout

      trafficObjs.calcDepotPositions(canvas);
      if(true){
        console.log("haschanged=true: new canvas dimension: ",
		    canvas.width," X ",canvas.height);
      }
 
    }

  // (2) reset transform matrix and draw background
  // (only needed if changes, plus "reminders" for lazy browsers)

  ctx.setTransform(1,0,0,1,0,0);
  if(drawBackground){
    if(hasChanged||(itime<=10) || (itime%50==0) || userCanvasManip
      || (!drawRoad)){
      ctx.drawImage(background,0,0,canvas.width,canvas.height);
    }
  }

 

  // (3) draw roads

    
  var changedGeometry=userCanvasManip || hasChanged||(itime<=1); 
  for(var i=0; i<arm.length; i++){
    //console.log("draw: i=",i," arm[i].roadLen=",arm[i].roadLen);
    arm[i].draw(armImg1,armImg2,scale,changedGeometry);
  }

  //console.log("\nbefore draw vehicles:");
  //arm[7].writeVehiclesSimple();

    
  // (4) draw vehicles !! degree of smooth changing: fracLaneOptical

  for(var i=0; i<arm.length; i++){
    arm[i].drawVehicles(carImg,truckImg,obstacleImgs,scale,
			vmin_col,vmax_col);
  }

  //console.log("\nafter draw vehicles:");
  //arm[7].writeVehiclesSimple();

  // (5a) draw traffic objects 

  if(userCanDropObjects&&(!isSmartphone)){
    trafficObjs.draw(scale);
  }

  // (5b) draw speedlimit-change select box

  ctx.setTransform(1,0,0,1,0,0); 
  drawSpeedlBox();
 
    // (6) draw simulated time

  displayTime(time,textsize);
    //displayMediaProperties(canvas,Math.max(10,textsize));

     // (7) draw the speed colormap

  if(drawColormap){
	displayColormap(0.22*refSizePix,
			0.43*refSizePix,
			0.1*refSizePix, 0.2*refSizePix,
			vmin_col,vmax_col,0,100/3.6);
  }


  // (8) xxxNew draw TL editor panel

  if(trafficLightControl.isActive){
    trafficLightControl.showEditPanel();
  }

  // may be set to true in next step if changed canvas 
  // or old sign should be wiped away 
  hasChanged=false;

  // revert to neutral transformation at the end!
  ctx.setTransform(1,0,0,1,0,0); 

}// drawSim
 

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
// (ii) when pressing the start button 
//  ("myRun=setInterval(main_loop, 1000/fps);")
//############################################

console.log("first main execution");
showInfo();


var myRun=setInterval(main_loop, 1000/fps);



 

 

