
var userCanDistortRoads=false;
var userCanDropObjects=true;

//#############################################################
// adapt standard slider settings from control_gui.js
// and define variables w/o sliders in this scenario
//#############################################################

// sliders with default inits need not to be reassigned here

respectRingPrio=true; // controlled by a html select element
respectRightPrio=false; // callback: control_gui-handleChangedPriority

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



qIn=2000./3600;
slider_qIn.value=3600*qIn;
slider_qInVal.innerHTML=3600*qIn+" veh/h";

mainFrac=0.8;
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
slider_timewarpVal.innerHTML=timewarp +" times";

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
var rRingRel=0.14; // ring size w/resp to refSizePhys
var lArmRel=0.6;

// geom specification ring

var center_xPhys=center_xRel*refSizePhys; //[m]
var center_yPhys=center_yRel*refSizePhys;
var rRing=rRingRel*refSizePhys; // roundabout radius [m]

// geom specification arms

var lArm=lArmRel*refSizePhys;
var r1=(rRing/Math.sqrt(2)-0.5*laneWidth)/(1-0.5*Math.sqrt(2));
var uc1=lArm-0.25*Math.PI*r1;   
var xc1=(rRing+r1)/Math.sqrt(2)
var yc1=(rRing+r1)/Math.sqrt(2)
var x01=xc1+uc1



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


// arms 0 and 1 (ingoing/outgoing east arms)



function traj0_x(u){ 
    var dxPhysFromCenter=(u<uc1) ? x01-u : xc1-r1*Math.sin((u-uc1)/r1);
    return center_xPhys+dxPhysFromCenter;
}

function traj0_y(u){ 
    var dyPhysFromCenter=(u<uc1) ? 0.5*laneWidth : yc1-r1*Math.cos((u-uc1)/r1);
    return center_yPhys+dyPhysFromCenter;
}

function traj1_x(u){ 
    return traj0_x(lArm-u);
}

function traj1_y(u){ 
    return -traj0_y(lArm-u)+2*center_yPhys;
}


// arms 2 and 3 (ingoing/outgoing south arms)

function traj2_x(u){ 
    return traj0_y(u)-center_yPhys+center_xPhys;
}

function traj2_y(u){ 
    return -traj0_x(u)+center_xPhys+center_yPhys;
}

function traj3_x(u){ 
    return traj1_y(u)-center_yPhys+center_xPhys;
}

function traj3_y(u){ 
    return -traj1_x(u)+center_xPhys+center_yPhys;
}


// arms 4 and 5 (ingoing/outgoing west arms)

function traj4_x(u){ 
    return -traj0_x(u)+2*center_xPhys;;
}

function traj4_y(u){ 
    return -traj0_y(u)+2*center_yPhys;
}

function traj5_x(u){ 
    return -traj1_x(u)+2*center_xPhys;;
}

function traj5_y(u){ 
    return -traj1_y(u)+2*center_yPhys;
}

// arms 6 and 7 (ingoing/outgoing north arms)

function traj6_x(u){ 
    return -traj2_x(u)+2*center_xPhys;;
}

function traj6_y(u){ 
    return -traj2_y(u)+2*center_yPhys;
}

function traj7_x(u){ 
    return -traj3_x(u)+2*center_xPhys;;
}

function traj7_y(u){ 
    return -traj3_y(u)+2*center_yPhys;
}



var mergeBegin=fracArmBegin*lArm; // logical merges
var mergeEnd=fracArmEnd*lArm;



//##################################################################
// Specification of logical road network
// template new road(ID,length,laneWidth,nLanes,traj_x,traj_y,
//		     density,speedInit,fracTruck,isRing,doGridding[opt]);
// road with inflow/outflow: just add updateBCup/down at simulation time
// road with passive merge/diverge: nothing needs to be added
// road with active merge (ramp): road.mergeDiverge at sim time
// road with active diverge (mainroad, more generally when routes are relevant): 
//   road.setOfframpInfo at init time and road.mergeDiverge at sim time

//##################################################################


var speedInit=20; // m/s
var density=0.00;

//new road(ID,length,laneWidth,nLanes,traj_x,traj_y,
//		       density,speedInit,fracTruck,isRing,doGridding[opt]);

// need addtl. road.setOfframpInfo for roads with diverges, nothing for merges


var mainroad=new road(10,2*Math.PI*rRing,laneWidth,nLanes_ring,
		  trajRing_x,trajRing_y,0,0,0,true);

mainroad.padding=padding; mainroad.paddingLTC=paddingLTC;
if(markVehsMerge){mainroad.markVehsMerge=true;}
if(drawVehIDs){mainroad.drawVehIDs=true;}

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


// !! odd roadIDs are offramps!!
mainroad.setOfframpInfo([1,3,5,7], uLastExits, [true,true,true,true]);
console.log("mainroad.offrampIDs=",mainroad.offrampIDs);
console.log("mainroad.offrampLastExits=",mainroad.offrampLastExits);
mainroad.duTactical=divLen;


var arm=[]; 
arm[0]=new road(0,lArm,laneWidth,nLanes_arm,traj0_x,traj0_y,0,0,0,false);
arm[1]=new road(1,lArm,laneWidth,nLanes_arm,traj1_x,traj1_y,0,0,0,false);
arm[2]=new road(2,lArm,laneWidth,nLanes_arm,traj2_x,traj2_y,0,0,0,false);
arm[3]=new road(3,lArm,laneWidth,nLanes_arm,traj3_x,traj3_y,0,0,0,false);
arm[4]=new road(4,lArm,laneWidth,nLanes_arm,traj4_x,traj4_y,0,0,0,false);
arm[5]=new road(5,lArm,laneWidth,nLanes_arm,traj5_x,traj5_y,0,0,0,false);
arm[6]=new road(6,lArm,laneWidth,nLanes_arm,traj6_x,traj6_y,0,0,0,false);
arm[7]=new road(7,lArm,laneWidth,nLanes_arm,traj7_x,traj7_y,0,0,0,false);

network[0]=mainroad;  // network declared in canvas_gui.js
for (var i=0; i<arm.length; i++){
  network[i+1]=arm[i];
}


for (var i=0; i<arm.length; i++){
    arm[i].padding=padding;
    arm[i].paddingLTC=paddingLTC;
    if(markVehsMerge){arm[i].markVehsMerge=true;}
    if(drawVehIDs){arm[i].drawVehIDs=true;}
}

//################################################################
// define routes
// 1=E-arm, ingoing, 3=S-arm, ingoing,  5=W-arm, ingoing, 7=N-arm, ingoing
// 2=E-arm, outgoing, 4=S-arm, outgoing,  6=W-arm, outgoing, 8=N-arm, outgoing
//################################################################

var route1L=[0,10,3];  // inflow E-arm, left turn
var route1C=[0,10,5];  // inflow E-arm, straight ahead
var route1R=[0,10,7];  // inflow E-arm, right turn
var route1U=[0,10,1];  // inflow E-arm, U-tern
var route3L=[2,10,5];  // inflow S-arm, left turn
var route3C=[2,10,7];  // inflow S-arm, straight ahead
var route3R=[2,10,1];  // inflow S-arm, right turn
var route5L=[4,10,7];  // inflow W-arm, left turn
var route5C=[4,10,1];  // inflow W-arm, straight ahead
var route5R=[4,10,3];  // inflow W-arm, right turn
var route7L=[6,10,1];  // inflow N-arm, left turn
var route7C=[6,10,3];  // inflow N-arm, straight ahead
var route7R=[6,10,5];  // inflow N-arm, right turn



//############################################################
// add standing virtual vehicle at the end of the merging arms
// new vehicle (length, width, u, lane, speed, type)
// prepending=unshift; 
//############################################################

for(var i=0; i<8; i+=2){
    arm[i].veh.unshift(new vehicle(0.0, laneWidth, mergeEnd, 0, 0, "obstacle"));//!!!
}


//#########################################################
// model initialization (models and methods defined in control_gui.js)
//#########################################################
	
updateModels(); // defines longModelCar,-Truck,LCModelCar,-Truck,-Mandatory


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
	mainroad.revertVehMarkings();
    }

 
 

    //##############################################################
    // (1) transfer effects from slider interaction and mandatory regions
    // to the vehicles and models:
    // also initialize models for new cars entering at inflow points
    //##############################################################

 
    // updateModelsOfAllVehicles also selectively sets LCModelMandatory
    // to offramp vehs based on their routes!
    // !! needed even for single-lane roads to trigger diverge actions!

    mainroad.updateModelsOfAllVehicles(longModelCar,longModelTruck,
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
    // !! (motion at the end!)

    mainroad.calcAccelerations();
    //mainroad.updateSpeedPositions();
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

    // override for debugging

    if(useSsimpleOD_debug){
        q1=0.2*qIn; q7=0.5*qIn; q5=q3=0;
        route1In=route1C;route7In=route7C;
    }

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

    mainroad.updateLastLCtimes(dt); // needed on target road for graphical merging
    //mainroad.changeLanes(); // only if multilane;  not needed for diverge


    arm[0].mergeDiverge(mainroad, (0.25*Math.PI-stitchAngleOffset)*rRing-lArm, 
			mergeBegin, mergeEnd, true, false, false, 
			respectRingPrio, respectRightPrio);

    arm[2].mergeDiverge(mainroad, (1.75*Math.PI-stitchAngleOffset)*rRing-lArm, 
			mergeBegin, mergeEnd, true, false, false, 
			respectRingPrio, respectRightPrio);

    arm[6].mergeDiverge(mainroad, (0.75*Math.PI-stitchAngleOffset)*rRing-lArm, 
			mergeBegin, mergeEnd, true, false, false, 
			respectRingPrio, respectRightPrio);

    arm[4].mergeDiverge(mainroad, (1.25*Math.PI-stitchAngleOffset)*rRing-lArm, 
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

 

    mainroad.mergeDiverge(arm[1], -uLastExits[0]+divLen, 
		      uLastExits[0]-divLen, uLastExits[0], false, true);
    mainroad.mergeDiverge(arm[3], -uLastExits[1]+divLen, 
		      uLastExits[1]-divLen, uLastExits[1], false, true);
    mainroad.mergeDiverge(arm[5], -uLastExits[2]+divLen, 
		      uLastExits[2]-divLen, uLastExits[2], false, true);
    mainroad.mergeDiverge(arm[7], -uLastExits[3]+divLen, 
		      uLastExits[3]-divLen, uLastExits[3], false, true);


     // !! motion at the end

    mainroad.updateSpeedPositions();
    for(var i=0; i<arm.length; i++){
        arm[i].updateSpeedPositions();

        // !!! forcibly move vehicles behind virtual obstacle vehicle 0
        // if they cross it (may happen for very low a, T)
        // to avoid bugs (otherwise, the vehicle will orbit perpetually
        // on (traj_x,traj_y) instead of merging)

	if(arm[i].veh.length>=2){
	  if(arm[i].veh[1].u>arm[i].veh[0].u-0.1){
	      arm[i].veh[1].u=arm[i].veh[0].u-0.1;
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
      for(var iveh=0; iveh<mainroad.veh.length; iveh++){
	if(mainroad.veh[iveh].id==idTest){
		console.log("time=",time," itime=",itime, " vehID=",idTest,
			    " road=mainroad, iveh=",iveh,
			    " u=",mainroad.veh[iveh].u
			   );
	}
      }



      //if((itime>=165)&&(itime<=168)){
      if(false){
	console.log("\nDebug updateSim: Simulation time=",time,
		    " itime=",itime);
	mainroad.writeVehiclesSimple();
	//console.log("\nonramp vehicles, simulation time=",time,":");
	arm[6].writeVehiclesSimple();
	arm[7].writeVehiclesSimple();
      }
    }//debug


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
 
/*
	mainroad.gridTrajectories(trajRing_x,trajRing_y);
        arm[0].gridTrajectories(traj0_x,traj0_y);
        arm[1].gridTrajectories(traj1_x,traj1_y);
        arm[2].gridTrajectories(traj2_x,traj2_y);
        arm[3].gridTrajectories(traj3_x,traj3_y);
        arm[4].gridTrajectories(traj4_x,traj4_y);
        arm[5].gridTrajectories(traj5_x,traj5_y);
        arm[6].gridTrajectories(traj6_x,traj6_y);
        arm[7].gridTrajectories(traj7_x,traj7_y);
*/
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

 

    // (3) draw mainroad and arms 

    
    var changedGeometry=userCanvasManip || hasChanged||(itime<=1); 
    for(var i=0; i<arm.length; i++){
	//console.log("draw: i=",i," arm[i].roadLen=",arm[i].roadLen);
	arm[i].draw(armImg1,armImg2,scale,changedGeometry);
    }
    mainroad.draw(ringImg1,ringImg2,scale,changedGeometry);

    
    // (4) draw vehicles !! degree of smooth changing: fracLaneOptical

    for(var iveh=0; iveh<mainroad.veh.length; iveh++){
	mainroad.veh[iveh].fracLaneOptical=0; // lower than default 1 [lane]
	mainroad.veh[iveh].dt_LC=10; // sufftly long for special traj road.drawVehGen
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

 
    if(drawRingDirect){
	mainroad.drawVehicles(carImg,truckImg,obstacleImgs,scale,
			  vmin_col,vmax_col);
    }

    else{

       // draw ring vehicles in 8 sectors: 
       // sectors 0,2,4,6: merging vehs on otherRoad=arm[sector]
       // sectors 1,3,5,7: no mergings (otherRoad=actualRoad=ring
       // end arm 0 attached at 0.25*Math.PI*rRing

	var uOffset0_merge=lArm-(0.25*Math.PI-stitchAngleOffset)*rRing; 
	var du=-stitchAngleOffset*rRing;

    mainroad.drawVehiclesGenTraj(carImg,truckImg,obstacleImgs,scale,vmin_col,vmax_col,
			     0, 1./8*mainroad.roadLen+du, // between stitch
			     arm[0], uOffset0_merge);
    mainroad.drawVehiclesGenTraj(carImg,truckImg,obstacleImgs,scale,vmin_col,vmax_col,
			     du+mainroad.roadLen, mainroad.roadLen, // between stitch
			     arm[0], uOffset0_merge);
    mainroad.drawVehicles(carImg,truckImg,obstacleImgs,scale,vmin_col,vmax_col,
			     1./8*mainroad.roadLen+du, 2./8*mainroad.roadLen+du);

    mainroad.drawVehiclesGenTraj(carImg,truckImg,obstacleImgs,scale,vmin_col,vmax_col,
			     2./8*mainroad.roadLen+du, 3./8*mainroad.roadLen+du,
			     arm[6], uOffset0_merge-0.25*mainroad.roadLen);
    mainroad.drawVehicles(carImg,truckImg,obstacleImgs,scale,vmin_col,vmax_col,
			     3./8*mainroad.roadLen+du, 4./8*mainroad.roadLen+du);

    mainroad.drawVehiclesGenTraj(carImg,truckImg,obstacleImgs,scale,vmin_col,vmax_col,
			     4./8*mainroad.roadLen+du, 5./8*mainroad.roadLen+du,
			     arm[4], uOffset0_merge-0.50*mainroad.roadLen);
    mainroad.drawVehicles(carImg,truckImg,obstacleImgs,scale,vmin_col,vmax_col,
			     5./8*mainroad.roadLen+du, 6./8*mainroad.roadLen+du);

    mainroad.drawVehiclesGenTraj(carImg,truckImg,obstacleImgs,scale,vmin_col,vmax_col,
			     6./8*mainroad.roadLen+du, 7./8*mainroad.roadLen+du,
			     arm[2], uOffset0_merge-0.75*mainroad.roadLen);
    mainroad.drawVehicles(carImg,truckImg,obstacleImgs,scale,vmin_col,vmax_col,
			     7./8*mainroad.roadLen+du, 8./8*mainroad.roadLen+du);
    }

    if(false){
        mainroad.writeVehiclesIDrange(1610, 1630);
        for(var i=0; i<arm.length; i++){
  	    arm[i].writeVehiclesIDrange(1610, 1630);
	}
    }
    
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



 

 

