
// notice: activate caterpillars, trafficLights etc: 
// uncomment the 3 lines/blocks  with "depot" 
// a defined depot also needed for canvas_gui.dragRoad
// for dragging also canvas_gui.dragRoad needs to be extended to case roundabout, 
// and gridTrajectories needs to be called (only if significant changes in length)
// => geometry change

//#############################################################
// adapt standard slider settings from control_gui.js
// and define variables w/o sliders in this scenario
//#############################################################

// sliders with default inits need not to be reassigned here

var respectRingPrio=false; // !!! put into a GUI switch
var respectRightPrio=true; // !!! put into a GUI switch

truckFrac=0.15; // overrides control_gui
factor_v0_truck=0.9; // truck v0 always slower than car v0 by this factor
                     // (incorporated/updated in sim by updateModels) 
IDM_b=1;

MOBIL_mandat_bSafe=4; // >b, <physical limit
MOBIL_mandat_bThr=0;  
MOBIL_mandat_bias=2; // normal: bias=0.1, rFirst: bias=42
MOBIL_mandat_p=0;  // normal: p=0.2, rFirst: p=0;

//!!! Switch "ring priority,<=>right priority not yet implemented

//MOBIL_mandat_bSafe=42; // normal: bSafe=1, rFirst: bSafe=42
//MOBIL_mandat_bThr=0;  
//MOBIL_mandat_bias=42; // normal: bias=0.1, rFirst: bias=42
//MOBIL_mandat_p=0;  // normal: p=0.2, rFirst: p=0;


qIn=qInInit=2000./3600;
slider_qIn.value=3600*qIn;
slider_qInVal.innerHTML=3600*qIn+" veh/h";

mainFrac=mainFracInit=0.8;
slider_mainFrac.value=100*mainFrac;
slider_mainFracVal.innerHTML=100*mainFrac+"%";

leftTurnBias=leftTurnBiasInit=0;
slider_leftTurnBias.value=leftTurnBias;
slider_leftTurnBiasVal.innerHTML=leftTurnBias;

focusFrac=focusFracInit=0.25;
slider_focusFrac.value=100*focusFrac;
slider_focusFracVal.innerHTML=100*focusFrac+"%";

timewarp=timewarpInit=5;
slider_timewarp.value=timewarpInit;
slider_timewarpVal.innerHTML=timewarpInit +" times";

IDM_v0=IDM_v0Init=50./3.6;
slider_IDM_v0.value=3.6*IDM_v0Init;
slider_IDM_v0Val.innerHTML=3.6*IDM_v0Init+" km/h";

IDM_a=0.9; // low to allow stopGo; 
slider_IDM_a.value=IDM_a;
slider_IDM_aVal.innerHTML=IDM_a+" m/s<sup>2</sup>";
factor_a_truck=1; // to allow faster slowing down of the uphill trucks

//!!! LC sliders not yet implemented

MOBIL_bBiasRight_car=0.0
slider_MOBIL_bBiasRight_car.value=MOBIL_bBiasRight_car;
slider_MOBIL_bBiasRight_carVal.innerHTML
	=MOBIL_bBiasRight_car+" m/s<sup>2</sup>";

MOBIL_bBiasRight_truck=0.0
slider_MOBIL_bBiasRight_truck.value=MOBIL_bBiasRight_truck;
slider_MOBIL_bBiasRight_truckVal.innerHTML
	=MOBIL_bBiasRight_truck+" m/s<sup>2</sup>";

MOBIL_bThr=0.0
slider_MOBIL_bThr.value=MOBIL_bThr;
slider_MOBIL_bThrVal.innerHTML=MOBIL_bThr+" m/s<sup>2</sup>";



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

var refSizePhys=110;  // constants => all objects scale with refSizePix

var critAspectRatio=120./95.; // from css file width/height of #contents

var refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);
var scale=refSizePix/refSizePhys;


//##################################################################
// Specification of physical road geometry and vehicle properties
// If refSizePhys changes, change them all => updatePhysicalDimensions();
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

var center_xPhys=center_xRel*refSizePhys; //[m]
var center_yPhys=center_yRel*refSizePhys;
var rRing=0.15*refSizePhys; // roundabout radius [m]
var r1=(rRing/Math.sqrt(2)-0.5*laneWidth)/(1-0.5*Math.sqrt(2));
var lArm=4*rRing;
var uc1=lArm-0.25*Math.PI*r1;   

function updatePhysicalDimensions(){ // only if sizePhys changed (mobile)
    center_xPhys=center_xRel*refSizePhys;
    center_yPhys=center_yRel*refSizePhys;
    rRing=0.15*refSizePhys; 
    r1=(rRing/Math.sqrt(2)-0.5*laneWidth)/(1-0.5*Math.sqrt(2));
    lArm=4*rRing;
    uc1=lArm-0.25*Math.PI*r1;
}






//###############################################################
// physical (m) roads
//###############################################################


var nLanes_arm=1;
var nLanes_ring=1;






// central ring (all in physical coordinates)
// stitchAngleOffset brings stitch of ring as far upstream of merge as possible 

var stitchAngleOffset=-0.20*Math.PI; 

function trajRing_x(u){ 
    var dxPhysFromCenter=rRing*Math.cos(u/rRing+stitchAngleOffset);
    return center_xPhys+dxPhysFromCenter;
}

function trajRing_y(u){ 
    var dyPhysFromCenter=rRing*Math.sin(u/rRing+stitchAngleOffset);
    return center_yPhys+dyPhysFromCenter;
}


// arms 1 and 2 (ingoing/outgoing east arms)

var xc1=(rRing+r1)/Math.sqrt(2)
var yc1=(rRing+r1)/Math.sqrt(2)
var x01=xc1+uc1


function traj1_x(u){ 
    var dxPhysFromCenter=(u<uc1) ? x01-u : xc1-r1*Math.sin((u-uc1)/r1);
    return center_xPhys+dxPhysFromCenter;
}

function traj1_y(u){ 
    var dyPhysFromCenter=(u<uc1) ? 0.5*laneWidth : yc1-r1*Math.cos((u-uc1)/r1);
    return center_yPhys+dyPhysFromCenter;
}

function traj2_x(u){ 
    return traj1_x(lArm-u);
}

function traj2_y(u){ 
    return -traj1_y(lArm-u)+2*center_yPhys;
}


// arms 3 and 4 (ingoing/outgoing south arms)

function traj3_x(u){ 
    return traj1_y(u)-center_yPhys+center_xPhys;
}

function traj3_y(u){ 
    return -traj1_x(u)+center_xPhys+center_yPhys;
}

function traj4_x(u){ 
    return traj2_y(u)-center_yPhys+center_xPhys;
}

function traj4_y(u){ 
    return -traj2_x(u)+center_xPhys+center_yPhys;
}


// arms 5 and 6 (ingoing/outgoing west arms)

function traj5_x(u){ 
    return -traj1_x(u)+2*center_xPhys;;
}

function traj5_y(u){ 
    return -traj1_y(u)+2*center_yPhys;
}

function traj6_x(u){ 
    return -traj2_x(u)+2*center_xPhys;;
}

function traj6_y(u){ 
    return -traj2_y(u)+2*center_yPhys;
}

// arms 7 and 8 (ingoing/outgoing north arms)

function traj7_x(u){ 
    return -traj3_x(u)+2*center_xPhys;;
}

function traj7_y(u){ 
    return -traj3_y(u)+2*center_yPhys;
}

function traj8_x(u){ 
    return -traj4_x(u)+2*center_xPhys;;
}

function traj8_y(u){ 
    return -traj4_y(u)+2*center_yPhys;
}


//!! fiddle to optimize de-facto anticipation of merging vehs 
// and last stopping in order to prevent crashes while waiting

var mergeBegin=lArm-0.25*Math.PI*rRing; // logical merges
var mergeEnd=lArm-0.12*Math.PI*rRing;   



//##################################################################
// Specification of logical road network
// template new road(ID,length,laneWidth,nLanes,traj_x,traj_y,
//		     densityInit,speedInit,truckFracInit,isRing,doGridding[opt]);
// road with inflow/outflow: just add updateBCup/down at simulation time
// road with passive merge/diverge: nothing needs to be added
// road with active merge (ramp): road.mergeDiverge at sim time
// road with active diverge (mainroad, more generally when routes are relevant): 
//   road.setOfframpInfo at init time and road.mergeDiverge at sim time

//##################################################################


var speedInit=20; // m/s
var densityInit=0.00;

//new road(ID,length,laneWidth,nLanes,traj_x,traj_y,
//		       densityInit,speedInit,truckFracInit,isRing,doGridding[opt]);

// need addtl. road.setOfframpInfo for roads with diverges, nothing for merges


var ring=new road(10,2*Math.PI*rRing,laneWidth,nLanes_ring,trajRing_x,trajRing_y,
		  0,0,0,true);

// diverge length: 
// anything above 0.15*Pi*rRing and 1/4 ring length=0.5*Pi*rRing works

var divLen=0.25*Math.PI*rRing; 

// uLastExits[i] such that FIRST exit at rRing*1.75*PI, rRing*1.25*PI etc
// (+stitchAngleOffset) for optical reasons


uLastExits=[];

uLastExits[0]=rRing*(1.75*Math.PI-stitchAngleOffset)+divLen; 
uLastExits[1]=rRing*(1.25*Math.PI-stitchAngleOffset)+divLen;
uLastExits[2]=rRing*(0.75*Math.PI-stitchAngleOffset)+divLen;
uLastExits[3]=rRing*(0.25*Math.PI-stitchAngleOffset)+divLen;



ring.setOfframpInfo([2,4,6,8], uLastExits, [true,true,true,true]);
console.log("ring.offrampIDs=",ring.offrampIDs);
console.log("ring.offrampLastExits=",ring.offrampLastExits);
ring.duTactical=divLen;


var arm=[]; 
arm[0]=new road(1,lArm,laneWidth,nLanes_arm,traj1_x,traj1_y,0,0,0,false);
arm[1]=new road(2,lArm,laneWidth,nLanes_arm,traj2_x,traj2_y,0,0,0,false);
arm[2]=new road(3,lArm,laneWidth,nLanes_arm,traj3_x,traj3_y,0,0,0,false);
arm[3]=new road(4,lArm,laneWidth,nLanes_arm,traj4_x,traj4_y,0,0,0,false);
arm[4]=new road(5,lArm,laneWidth,nLanes_arm,traj5_x,traj5_y,0,0,0,false);
arm[5]=new road(6,lArm,laneWidth,nLanes_arm,traj6_x,traj6_y,0,0,0,false);
arm[6]=new road(7,lArm,laneWidth,nLanes_arm,traj7_x,traj7_y,0,0,0,false);
arm[7]=new road(8,lArm,laneWidth,nLanes_arm,traj8_x,traj8_y,0,0,0,false);



//################################################################
// define routes
// 1=E-arm, ingoing, 3=S-arm, ingoing,  5=W-arm, ingoing, 7=N-arm, ingoing
// 2=E-arm, outgoing, 4=S-arm, outgoing,  6=W-arm, outgoing, 8=N-arm, outgoing
//################################################################

var route1L=[1,10,4];  // inflow E-arm, left turn
var route1C=[1,10,6];  // inflow E-arm, straight ahead
var route1R=[1,10,8];  // inflow E-arm, right turn
var route1U=[1,10,2];  // inflow E-arm, U-tern
var route3L=[3,10,6];  // inflow S-arm, left turn
var route3C=[3,10,8];  // inflow S-arm, straight ahead
var route3R=[3,10,2];  // inflow S-arm, right turn
var route5L=[5,10,8];  // inflow W-arm, left turn
var route5C=[5,10,2];  // inflow W-arm, straight ahead
var route5R=[5,10,4];  // inflow W-arm, right turn
var route7L=[7,10,2];  // inflow N-arm, left turn
var route7C=[7,10,4];  // inflow N-arm, straight ahead
var route7R=[7,10,6];  // inflow N-arm, right turn



//############################################################
// add standing virtual vehicle at the end of the merging arms
// new vehicle (length, width, u, lane, speed, type)
// prepending=unshift; 
//############################################################

for(var i=0; i<8; i+=2){
    arm[i].veh.unshift(new vehicle(0, laneWidth, mergeEnd, 0, 0, "obstacle"));
}




//#########################################################
// model specifications (ALL default parameters set in control_gui.js)
//#########################################################

var longModelCar;
var longModelTruck;
var LCModelCar;
var LCModelTruck;
var LCModelMandatory; // parameterisation in road.updateModelsOfAllVehicles
updateModels(); //  from control_gui.js  => define the 5 standard  models

// behavior if driving through ring and merge/diverges (car and trucks)
// |lateral accel| <= comf deceleration b

//!!! not yet implemented
var v0CarRing=Math.min(IDM_v0, Math.sqrt(longModelCar.b*rRing));
var v0TruckRing=Math.min(factor_v0_truck*IDM_v0, Math.sqrt(longModelTruck.b*rRing));
var longModelCarRing=new ACC(v0CarRing,IDM_T,IDM_s0,IDM_a,IDM_b); 
var longModelTruckRing=new ACC(v0TruckRing,factor_T_truck*IDM_T,
			       IDM_s0,factor_a_truck*IDM_a,IDM_b); 

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


// init obstacle images

obstacleImgs = []; // srcFiles[0]='figs/obstacleImg.png'
for (var i=0; i<10; i++){
    obstacleImgs[i]=new Image();
    obstacleImgs[i].src = (i==0)
	? 'figs/obstacleImg.png'
	: "figs/constructionVeh"+i+".png";
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

ringImg1 = new Image();
ringImg1=roadImgs1[nLanes_ring-1];
ringImg2 = new Image();
ringImg2=roadImgs2[nLanes_ring-1];

armImg1 = new Image();
armImg1=roadImgs1[nLanes_arm-1];

armImg2 = new Image();
armImg2=roadImgs2[nLanes_arm-1];



//####################################################################
// vehicleDepot(nImgs,nRow,nCol,xDepot,yDepot,lVeh,wVeh,containsObstacles)
//####################################################################

/*
var smallerDimPix=Math.min(canvas.width,canvas.height);
var depot=new vehicleDepot(obstacleImgs.length, 3,3,
			   0.7*smallerDimPix/scale,
			   -0.5*smallerDimPix/scale,
			   20,20,true);
*/

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

    // update times

    time +=dt; // dt depends on timewarp slider (fps=const)
    itime++;

    //##############################################################
    // (1) transfer effects from slider interaction and mandatory regions
    // to the vehicles and models:
    // also initialize models for new cars entering at inflow points
    //##############################################################

 
    // updateModelsOfAllVehicles also selectively sets LCModelMandatory
    // to offramp vehs based on their routes!
    // !! needed even for single-lane roads to trigger diverge actions!

    ring.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				       LCModelCar,LCModelTruck,
				       LCModelMandatory);
    for(var i=0; i<arm.length; i++){
        arm[i].updateModelsOfAllVehicles(longModelCar,longModelTruck,
					 LCModelCar,LCModelTruck,
					 LCModelMandatory);
    }



    //##############################################################
    // (2) do central simulation update of vehicles
    //##############################################################


    //acceleration (no interaction between roads at this point)
    // !!! (motion at the end?)

    ring.calcAccelerations();
    //ring.updateSpeedPositions();
    for(var i=0; i<arm.length; i++){
      arm[i].calcAccelerations(); 
      //arm[i].updateSpeedPositions();
    } 


    // inflow BC

    // route fractions depend on slider-controlled 
    // mainFrac, focusFrac  and leftTurnBias
    // main routes: route1C (=[1,10,6], inflow E-arm, straight ahead) 
    //              route5C (=[5,10,2], inflow W-arm, opposite direction)
    // road label 1=inflow E-arm
    // road label 2=outflow E-arm
    // road label 3=inflow S-arm etc

    var q1=0.5*mainFrac*qIn;
    var q5=q1;
    var q3=0.5*(1-mainFrac)*qIn;
    var q7=q3;

    var cFrac=1/3. + 2./3*focusFrac - focusFrac*Math.abs(leftTurnBias);
    var lFrac=(1-cFrac)/2.*(1+leftTurnBias);
    var rFrac=(1-cFrac)/2.*(1-leftTurnBias);
    var clFrac=cFrac+lFrac;

    //console.log("roundabout:updateSim: cFrac=",cFrac," lFrac=",lFrac," rFrac=",rFrac);

    var ran=Math.random();


    var route1In=(ran<cFrac) ? route1C : (ran<clFrac) ? route1L : route1R;
    var route3In=(ran<cFrac) ? route3C : (ran<clFrac) ? route3L : route3R;
    var route5In=(ran<cFrac) ? route5C : (ran<clFrac) ? route5L : route5R;
    var route7In=(ran<cFrac) ? route7C : (ran<clFrac) ? route7L : route7R;

    // following 2 lines debug

    q1=0.2*qIn; q7=0.5*qIn; q5=q3=0;
    route1In=route1C;route7In=route7C;


    arm[0].updateBCup(q1,dt,route1In);
    arm[2].updateBCup(q3,dt,route3In);
    arm[4].updateBCup(q5,dt,route5In);
    arm[6].updateBCup(q7,dt,route7In);

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

    ring.updateLastLCtimes(dt); // needed on target road for graphical merging
    //ring.changeLanes(); // only if multilane;  not needed for diverge


    arm[0].mergeDiverge(ring, (0.25*Math.PI-stitchAngleOffset)*rRing-lArm, 
			mergeBegin, mergeEnd, true, false, false, 
			respectRingPrio, respectRightPrio);
    arm[2].mergeDiverge(ring, (1.75*Math.PI-stitchAngleOffset)*rRing-lArm, 
			mergeBegin, mergeEnd, true, false, false, 
			respectRingPrio, respectRightPrio);
    arm[4].mergeDiverge(ring, (1.25*Math.PI-stitchAngleOffset)*rRing-lArm, 
			mergeBegin, mergeEnd, true, false, false, 
			respectRingPrio, respectRightPrio);
    arm[6].mergeDiverge(ring, (0.75*Math.PI-stitchAngleOffset)*rRing-lArm, 
			mergeBegin, mergeEnd, true, false, false, 
			respectRingPrio, respectRightPrio);


    //##############################################################
    // diverges out of the  roundabout ring
    // template: road.mergeDiverge(newRoad,offset,uStart,uEnd,isMerge,
    //                             toRight,[ignoreRoute,respectPrio])
    //##############################################################

    // Besides targetRoad.updateLastLCtimes(dt) as in merge case, 
    // addtl provisions necessary:

    // (1) origRoad.setOfframpInfo(...) needs to be added, 
    //     best at road cstr time. Iincludes setting origRoad.duTactical>0!
    // (2) origRoad.updateModelsOfAllVehicles(...) needed to trigger diverge, 
    //     even for single lane

    for(var i=1; i<8; i+=2){arm[i].updateLastLCtimes(dt);} // needed for graph LC

 

    ring.mergeDiverge(arm[1], -uLastExits[0]+divLen, 
		      uLastExits[0]-divLen, uLastExits[0], false, true);
    ring.mergeDiverge(arm[3], -uLastExits[1]+divLen, 
		      uLastExits[1]-divLen, uLastExits[1], false, true);
    ring.mergeDiverge(arm[5], -uLastExits[2]+divLen, 
		      uLastExits[2]-divLen, uLastExits[2], false, true);
    ring.mergeDiverge(arm[7], -uLastExits[3]+divLen, 
		      uLastExits[3]-divLen, uLastExits[3], false, true);


     // motion at the end?!!!

    ring.updateSpeedPositions();
    for(var i=0; i<arm.length; i++){
        arm[i].updateSpeedPositions();//!!!
    } 

    //ring.writeVehiclesSimple(0,ring.roadLen);

     //!!!
/*
    if(depotVehZoomBack){
	var res=depot.zoomBackVehicle();
	depotVehZoomBack=res;
	userCanvasManip=true;
    }
*/


}//updateSim




//##################################################
function drawSim() {
//##################################################


    /* (0) redefine graphical aspects of road (arc radius etc) using
     responsive design if canvas has been resized 
     */

    var hasChanged=false;

    if(false){
        console.log(" new total inner window dimension: ",
		window.innerWidth," X ",window.innerHeight,
		" (full hd 16:9 e.g., 1120:630)",
		" canvas: ",canvas.width," X ",canvas.height);
    }


    // (1) define global properties;
    // gridTrajectories only needed if roads can be distorted by mouse

    if ((canvas.width!=simDivWindow.clientWidth)
	||(canvas.height != simDivWindow.clientHeight)){
	hasChanged=true;
	canvas.width  = simDivWindow.clientWidth;
        canvas.height  = simDivWindow.clientHeight;
	aspectRatio=canvas.width/canvas.height;
	refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);

	scale=refSizePix/refSizePhys; // refSizePhys=constant unless mobile

	updatePhysicalDimensions();

	ring.gridTrajectories(trajRing_x,trajRing_y);
        arm[0].gridTrajectories(traj1_x,traj1_y);
        arm[1].gridTrajectories(traj2_x,traj2_y);
        arm[2].gridTrajectories(traj3_x,traj3_y);
        arm[3].gridTrajectories(traj4_x,traj4_y);
        arm[4].gridTrajectories(traj5_x,traj5_y);
        arm[5].gridTrajectories(traj6_x,traj6_y);
        arm[6].gridTrajectories(traj7_x,traj7_y);
        arm[7].gridTrajectories(traj8_x,traj8_y);
    }


    // (2) reset transform matrix and draw background
    // (only needed if no explicit road drawn)

    // "%20-or condition"
    //  because some older firefoxes do not start up properly?

    ctx.setTransform(1,0,0,1,0,0); 
    if(drawBackground){
	if(userCanvasManip ||hasChanged
	   ||(itime<=1) || (itime%20===0) || false || (!drawRoad)){
	  ctx.drawImage(background,0,0,canvas.width,canvas.height);
      }
    }


    // (3) draw mainroad and arms 

    
    var changedGeometry=userCanvasManip || hasChanged||(itime<=1); 
    for(var i=0; i<arm.length; i++){
	//console.log("draw: i=",i," arm[i].roadLen=",arm[i].roadLen);
	arm[i].draw(armImg1,armImg2,scale,changedGeometry);
    }
    ring.draw(ringImg1,ringImg2,scale,changedGeometry);


    // (4) draw vehicles !! degree of smooth changing: fracLaneOptical

    for(var iveh=0; iveh<ring.veh.length; iveh++){
	ring.veh[iveh].fracLaneOptical=1; // lower than default 1 [lane]
	ring.veh[iveh].dt_LC=10; // sufftly long for special traj road.drawVehGen
    }

    for(var i=1; i<arm.length; i+=2){
	for(var iveh=0; iveh<arm[i].veh.length; iveh++){
	    arm[i].veh[iveh].fracLaneOptical=0;
	    arm[i].veh[iveh].dt_LC=2;
	}
    }

    // actual drawing

    for(var i=0; i<arm.length; i++){
        arm[i].drawVehicles(carImg,truckImg,obstacleImgs,scale,vmin_col,vmax_col);
    }

    // end arm 0 attached at 0.25*Math.PI*rRing

    var uOffset0_merge=lArm-(0.25*Math.PI-stitchAngleOffset)*rRing; 

    // draw ring vehicles in 8 sectors: 
    // sectors 0,2,4,6: merging vehs on otherRoad=arm[sector]
    // sectors 1,3,5,7: no mergings (otherRoad=actualRoad=ring

//ring.drawVehicles(carImg,truckImg,obstacleImgs,scale,vmin_col,vmax_col);

var du=-stitchAngleOffset*rRing

    ring.drawVehiclesGenTraj(carImg,truckImg,obstacleImgs,scale,vmin_col,vmax_col,
			     0, 1./8*ring.roadLen+du, // between stitch
			     arm[0], uOffset0_merge);
    ring.drawVehiclesGenTraj(carImg,truckImg,obstacleImgs,scale,vmin_col,vmax_col,
			     du+ring.roadLen, ring.roadLen, // between stitch
			     arm[0], uOffset0_merge);
    ring.drawVehicles(carImg,truckImg,obstacleImgs,scale,vmin_col,vmax_col,
			     1./8*ring.roadLen+du, 2./8*ring.roadLen+du);

    ring.drawVehiclesGenTraj(carImg,truckImg,obstacleImgs,scale,vmin_col,vmax_col,
			     2./8*ring.roadLen+du, 3./8*ring.roadLen+du,
			     arm[6], uOffset0_merge-0.25*ring.roadLen);
    ring.drawVehicles(carImg,truckImg,obstacleImgs,scale,vmin_col,vmax_col,
			     3./8*ring.roadLen+du, 4./8*ring.roadLen+du);

    ring.drawVehiclesGenTraj(carImg,truckImg,obstacleImgs,scale,vmin_col,vmax_col,
			     4./8*ring.roadLen+du, 5./8*ring.roadLen+du,
			     arm[4], uOffset0_merge-0.50*ring.roadLen);
    ring.drawVehicles(carImg,truckImg,obstacleImgs,scale,vmin_col,vmax_col,
			     5./8*ring.roadLen+du, 6./8*ring.roadLen+du);

    ring.drawVehiclesGenTraj(carImg,truckImg,obstacleImgs,scale,vmin_col,vmax_col,
			     6./8*ring.roadLen+du, 7./8*ring.roadLen+du,
			     arm[2], uOffset0_merge-0.75*ring.roadLen);
    ring.drawVehicles(carImg,truckImg,obstacleImgs,scale,vmin_col,vmax_col,
			     7./8*ring.roadLen+du, 8./8*ring.roadLen+du);



    
    // (5) !!! draw depot vehicles

    //depot.draw(obstacleImgs,scale,canvas);

    // (6) draw simulated time

    displayTime(time);


     // (7) draw the speed colormap

    if(drawColormap){ 
	displayColormap(0.22*refSizePix,
			0.43*refSizePix,
			0.1*refSizePix, 0.2*refSizePix,
			vmin_col,vmax_col,0,100/3.6);
    }


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



 

 

