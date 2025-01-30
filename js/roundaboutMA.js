const PI=Math.PI;

//#############################################################
// general ui settings
//#############################################################

const userCanDropObjects=true;
var showCoords=true;  // show logical coords of nearest road to mouse pointer
                      // definition => showLogicalCoords(.) in canvas_gui.js

//#############################################################
// general debug settings (set=false for public deployment)
//#############################################################

drawVehIDs=false; // override control_gui.js
drawRoadIDs=true; // override control_gui.js
var debug=false;
var crashinfo=new CrashInfo();


//#############################################################
// MA: Here is the section to do own changes
//#############################################################

// if automaticBreakdownTest, then total flow starts at small value,
// increases program-driven and simulation ends if breakdown is detected
// if it is false, the total flow is user-controlled by the slider as usual
// ODs can be determined in a restricted way by GUI
// (if (!useExplicitODs) below) or all 16 ODs explicitly

var automaticBreakdownTest=true;

// program-driven inflow profile if automaticBreakdownTest is true
// change if needed. Called in updateSim if automaticBreakdownTest

function updateInflow(time){ 
  qIn=(600.+10*time)/3600.
  slider_qIn.value=3600*qIn;
  slider_qInVal.innerHTML=Math.round(3600*qIn)+" veh/h";
}

// jam detection function looping over all roads of the network.
// Notice that two or three stopped vehicles do not
// imply that there is already congested traffic
// Called in updateSim if automaticBreakdownTest

function detectCongestion(network){
  var nCongested=0; // counter
  var nCongestedCrit=7; // minimum congested vehicle for oversaturation
  var speedCrit=2; // [m/s] congested means speed <= speedCrit
  
  for(var ir=0; ir<network.length; ir++){
    var vehicles=network[ir].veh;
    for(var i=0; i<vehicles.length; i++){
      if(vehicles[i].isRegularVeh()){ // no obstacle, traffic light
	if(vehicles[i].speed<speedCrit){
	  nCongested++;
	}
      }
    }
  }
  return (nCongested>=nCongestedCrit);
}


// useExplicitODs activates the complete programmatic control
// of the relative OD flows if the GUI control is not sufficient.
// Overrides the GUI controls. Can be used with or without
// automaticBreakdownTest

var useExplicitODs=true;


// the relative OD flows. No need to check if all flows add to 1
// because it is normalized before starting the simulation
// qEN: relative flow from the East arm to the North arm (right turn)
// qEW: relative flow from the East arm to the West arm (straight on)
// qES: relative flow from the East arm to the South arm (left turn)
// qEE: relative flow from the East arm round turn
// qSE: relative flow from the South arm to the East arm (right turn)
// etc
// will only be used if(useExplicitODs)

qEN=0.00; qEW=0.00; qES=0.00; qEE=0.50;
qSE=0.00; qSN=0.00; qSW=0.50; qSS=0.00;
qWS=0.00; qWE=0.50; qWN=0.00; qWW=0.00;
qNW=0.50; qNS=0.50; qNE=0.00; qNN=0.00;



//#############################################################
// end MA: end of section to do own changes
//#############################################################

var qE=qEN+qEW+qES+qEE;
var qS=qSE+qSN+qSW+qSS;
var qW=qWS+qWE+qWN+qWW;
var qN=qNW+qNS+qNE+qNN;

var qref=qE+qS+qW+qN;  // =1 if input properly specified

console.log("qE=",qE," qN=",qN);

function finishSimulation(){
  myStartStopFunction(); // reset simulation (look for it to set conditions)
}


// non-slider vehicle and traffic properties

fracTruck=0.2; // overrides control_gui 0.15 (w/o providing slider)

IDM_b=1;
factor_a_truck=1; // factor_T_truck from default in control_gui.js
                  // v0_truck defined by speedlimits for trucks

MOBIL_mandat_bSafe=4; // >b, <physical limit
MOBIL_mandat_bThr=0;  
MOBIL_mandat_bias=2; // normal: bias=0.1, rFirst: bias=42
MOBIL_mandat_p=0;  // normal: p=0.2, rFirst: p=0;

// priority settings

var priorityIndex=0; // {0=ring has prio, 1=arms have prio}
setCombobox("prioritySelect",priorityIndex);
handleChangedPriority(priorityIndex); // callback priority (not really needed)

// OD settings

// callback handleChangedOD only active if (!explicitODs)

// all 9 ODs equal: leftTurnBias=focusFrac=0,mainFrac=1
// only left: leftTurnBias=focusFrac=1 
// only center: leftTurnBias=0, focusFrac=1
// with |leftTurnBias|>2/3, focusFrac becomes counterintuitive
// index={0=straight ahead, right, left, all directions}
// defaultSelectedIndex in control_gui.js

setCombobox("ODSelect",defaultSelectedIndex);
handleChangedOD(defaultSelectedIndex,useExplicitODs); // (not really needed)

// define MA and other non-standard slider initialisations
// (no s0,LC sliders for roundabout)

qIn=(automaticBreakdownTest) ? 500./3600 : 2600./3600;
setSlider(slider_qIn,slider_qInVal,3600*qIn,0," veh/h");

mainFrac=(useExplicitODs) ? (qE+qW)/qref : 0.6;
setSlider(slider_mainFrac,slider_mainFracVal,100*mainFrac,0," %");

timewarp=5;
setSlider(slider_timewarp,slider_timewarpVal,timewarp,1," times");

IDM_v0=50./3.6;
setSlider(slider_IDM_v0,slider_IDM_v0Val,3.6*IDM_v0,0," km/h");

IDM_a=1.5; 
setSlider(slider_IDM_a,slider_IDM_aVal,IDM_a,1," m/s<sup>2</sup>");

// merging fine tuning

var duMergeRel=0.40; // merge begins mergeBeginRel*rRing before arm ends



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
isSmartphone=mqSmartphone(); // defined in media.js


console.log("before addTouchListeners()");
addTouchListeners();
console.log("after addTouchListeners()");


//##################################################################
// overall scaling (critAspectRatio should be consistent with 
// width/height in css.#contents)
//##################################################################

var isSmartphone=mqSmartphone();// also change  in updateSim!!

var refSizePhys=(isSmartphone) ? 90 : 110;  // const; all objects scale with refSizePix

// css/styleTrafficSimulationDe.css: canvas width:  112vmin; height: 100vmin;

var critAspectRatio=120./95.; // css file: width/height of portrait #contents

var refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);
var scale=refSizePix/refSizePhys;



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
// Images
//####################################################################


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

// init road images for 1 to 4 lanes

roadImgWith_lane = []; // road with lane separating line
roadImgWithout_lane = []; // road without lane separating line

for (var i=0; i<4; i++){
  roadImgWith_lane[i]=new Image();
  roadImgWith_lane[i].src="figs/road"+(i+1)+"lanesCropWith.png";
  roadImgWithout_lane[i]=new Image();
  roadImgWithout_lane[i].src="figs/road"+(i+1)+"lanesCropWithout.png";
}



//############################################
// traffic objects
//############################################

// TrafficObjects(canvas,nTL,nLimit,xRelDepot,yRelDepot,nRow,nCol)
//var trafficObjs=new TrafficObjects(canvas,1,3,0.20,0.20,3,2);
var trafficObjs=new TrafficObjects(canvas,4,1,0.80,0.25,2,3);
var trafficLightControl=new TrafficLightControlEditor(trafficObjs,0.33,0.68);






//##################################################################
//<NETWORK>
// Specification of physical road geometry and vehicle properties
// If refSizePhys changes, change them all => updateDimensions();
//##################################################################

// the following remains constant 
// => road becomes more compact for smaller screens

var car_length=4.5; // car length in m
var car_width=2.5; // car width in m
var truck_length=8; // trucks
var truck_width=3; 
var laneWidth=3.8; 


// all relative "Rel" settings with respect to refSizePhys

var center_xRel=0.63; // ring center relative to canvas
                      // (>0.5 is centered because refSizePhys smaller edge)
var center_yRel=-0.55;
var rRingRel=0.15; // ring radius w/resp to refSizePhys
var lArmRel=0.55;   // minimum arm length approx 0.55;
                   // longer arms only make straight sec longer

// geom specification ring

var center_xPhys=center_xRel*refSizePhys; //[m]
var center_yPhys=center_yRel*refSizePhys;
var rRing=rRingRel*refSizePhys; // roundabout radius [m]

// geom specification arms

var lArm=lArmRel*refSizePhys;
var r1=(rRing/Math.sqrt(2)-0.5*laneWidth)/(1-0.5*Math.sqrt(2));
var uc1=lArm-0.25*PI*r1;  // begin of r1 arc 
var xc1=(rRing+r1)/Math.sqrt(2) // r1 center. > r1 since connect to
var yc1=(rRing+r1)/Math.sqrt(2) // directional road center, not median
var x01=xc1+uc1



//###############################################################
// physical (m) roads
//###############################################################


var nLanes_arm=1;  // geometry fits only for 1/1 lanes

var nLanes_ring=1;


// central ring (all in physical coordinates)
// stitchAngleOffset brings stitch of ring
// as far upstream of merge as possible 

var stitchAngleOffset=-0.15*PI; 
var uMerge=lArm-duMergeRel*rRing; // logical merges to ring

function trajRing_x(u){ 
    var dxPhysFromCenter=rRing*Math.cos(u/rRing+stitchAngleOffset);
    return center_xPhys+dxPhysFromCenter;
}

function trajRing_y(u){ 
    var dyPhysFromCenter=rRing*Math.sin(u/rRing+stitchAngleOffset);
    return center_yPhys+dyPhysFromCenter;
}


// arms 0 and 1 (ingoing/outgoing east arms)

// lArm ends exactly at stitchAngleOffset+0.25*PI, +0.75*PI, ... of the ring
// but traj def is valid also for u>lArm

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

// arms 6 and 7 (ingoing/outgoing south arms)

function traj6_x(u){ 
  return traj0_y(u)-center_yPhys+center_xPhys;
}

function traj6_y(u){ 
    return -traj0_x(u)+center_xPhys+center_yPhys;
}

function traj7_x(u){ 
    return traj1_y(u)-center_yPhys+center_xPhys;
}

function traj7_y(u){ 
    return -traj1_x(u)+center_xPhys+center_yPhys;
}


// arms 2 and 3 (ingoing/outgoing south arms)

function traj2_x(u){ 
    return -traj6_x(u)+2*center_xPhys;;
}

function traj2_y(u){ 
    return -traj6_y(u)+2*center_yPhys;
}

function traj3_x(u){ 
    return -traj7_x(u)+2*center_xPhys;;
}

function traj3_y(u){ 
    return -traj7_y(u)+2*center_yPhys;
}


// special trajectories for entering (physical entering ahead of PI/4*r etc)

var ringArmOffset=lArm+rRing*stitchAngleOffset; // stitchangle=eg.-0.15*PI

function trajRing_0x(u){return traj0_x(u-rRing*0.25*PI +ringArmOffset);}
function trajRing_0y(u){return traj0_y(u-rRing*0.25*PI +ringArmOffset);}

function trajRing_2x(u){return traj2_x(u-rRing*0.75*PI +ringArmOffset);}
function trajRing_2y(u){return traj2_y(u-rRing*0.75*PI +ringArmOffset);}

function trajRing_4x(u){return traj4_x(u-rRing*1.25*PI +ringArmOffset);}
function trajRing_4y(u){return traj4_y(u-rRing*1.25*PI +ringArmOffset);}

function trajRing_6x(u){return traj6_x(u-rRing*1.75*PI +ringArmOffset);}
function trajRing_6y(u){return traj6_y(u-rRing*1.75*PI +ringArmOffset);}



// #############################################################3
// road images for the trajectories; 2 images per road/network element
// #############################################################3

// network not yet defined

var nLanes=[nLanes_ring,1,1,1,1,1,1,1,1]; // nLanes_arm=1

// general

var roadImages=[];
for(var ir=0; ir<nLanes.length; ir++){
  roadImages[ir]=[];
  for(var j=0; j<2; j++){roadImages[ir][j]=new Image();}
}

// specific


for(var ir=0; ir<nLanes.length; ir++){
  roadImages[ir][0]=roadImgWith_lane[nLanes[ir]-1];
  roadImages[ir][1]=roadImgWithout_lane[nLanes[ir]-1];
}




//##################################################################
// Specification of logical road network

// road with inflow/outflow: just add updateBCup/down at simulation time
// road with passive merge/diverge: nothing needs to be added
// road with active merge (ramp): road.mergeDiverge at sim time
// road with active diverge (mainroad, when routes are relevant): 
// road.initMergeDiverge at init time and road.mergeDiverge at sim time

//##################################################################


speedInit=20; // m/s
var density=0.00;

//new road(ID,length,laneWidth,nLanes,traj_x,traj_y,
//		       density,speedInit,fracTruck,isRing);


var mainroad=new road(8,2*PI*rRing-0,laneWidth,nLanes_ring,
		  [trajRing_x,trajRing_y],0,0,0,true);

var arm=[]; 
arm[0]=new road(0,lArm,laneWidth,nLanes_arm,[traj0_x,traj0_y],0,0,0,false);
arm[1]=new road(1,lArm,laneWidth,nLanes_arm,[traj1_x,traj1_y],0,0,0,false);
arm[2]=new road(2,lArm,laneWidth,nLanes_arm,[traj2_x,traj2_y],0,0,0,false);
arm[3]=new road(3,lArm,laneWidth,nLanes_arm,[traj3_x,traj3_y],0,0,0,false);
arm[4]=new road(4,lArm,laneWidth,nLanes_arm,[traj4_x,traj4_y],0,0,0,false);
arm[5]=new road(5,lArm,laneWidth,nLanes_arm,[traj5_x,traj5_y],0,0,0,false);
arm[6]=new road(6,lArm,laneWidth,nLanes_arm,[traj6_x,traj6_y],0,0,0,false);
arm[7]=new road(7,lArm,laneWidth,nLanes_arm,[traj7_x,traj7_y],0,0,0,false);


for (var ir=0; ir<arm.length; ir++){
  network[ir]=arm[ir]; // network declared in canvas_gui.js
}
network[8]=mainroad;  

// draw veh IDs on selected links if set true;
// also draw alternative trajectories if wanted (not needed for roundabout)

for(var ir=0; ir<network.length; ir++){
  network[ir].drawVehIDs=drawVehIDs;
  network[ir].drawAlternativeTrajectories=false; // default=false; to remember
}




//################################################################
// define routes
// 0=E-arm, ingoing,  2=N-arm, ingoing,  4=W-arm, ingoing,  6=S-arm, ingoing
// 1=E-arm, outgoing, 3=N-arm, outgoing, 5=W-arm, outgoing, 7=S-arm, outgoing
//################################################################

var routeER=[0,8,3];  // inflow E-arm, right turn
var routeEC=[0,8,5];  // inflow E-arm, straight ahead
var routeEL=[0,8,7];  // inflow E-arm, left turn
var routeEU=[0,8,1];  // inflow E-arm, U-tern
var routeNR=[2,8,5];  // inflow N-arm, right turn
var routeNC=[2,8,7];  // inflow N-arm, straight ahead
var routeNL=[2,8,1];  // inflow N-arm, left turn
var routeNU=[2,8,3];  // inflow N-arm, U-tern
var routeWR=[4,8,7];  // inflow W-arm, right turn
var routeWC=[4,8,1];  // inflow W-arm, straight ahead
var routeWL=[4,8,3];  // inflow W-arm, left turn
var routeWU=[4,8,5];  // inflow W-arm, U-tern
var routeSR=[6,8,1];  // inflow S-arm, right turn
var routeSC=[6,8,3];  // inflow S-arm, straight ahead
var routeSL=[6,8,5];  // inflow S-arm, left turn
var routeSU=[6,8,7];  // inflow S-arm, U-tern

// add the special trajectories depending on the roadID of the route link
// neighboring to the ring (roadID=8)
// then corresponding road drawn if road.drawAlternativeTrajectories=true
// and corresponding vehicles if their route contains the trajAlt roadID elem

var altOffset=-rRing*stitchAngleOffset;

mainroad.trajAlt[0]={x: trajRing_0x,
		     y: trajRing_0y,
		     roadID: 0,
		     umin:0+altOffset,
		     umax:rRing*0.25*PI+altOffset
		    };
mainroad.trajAlt[1]={x: trajRing_2x,
		     y: trajRing_2y,
		     roadID: 2,
		     umin:rRing*0.50*PI+altOffset,
		     umax:rRing*0.75*PI+altOffset
		    };
mainroad.trajAlt[2]={x: trajRing_4x,
		     y: trajRing_4y,
		     roadID: 4,
		     umin:rRing*1.00*PI+altOffset,
		     umax:rRing*1.25*PI+altOffset
		    };
mainroad.trajAlt[3]={x: trajRing_6x,
		     y: trajRing_6y,
		     roadID: 6,
		     umin:rRing*1.50*PI+altOffset,
		     umax:rRing*1.75*PI+altOffset
		    };



//#########################################################
// model initialization (models and methods override control_gui.js)
//#########################################################
	
// ok 2021. Defines longModelCar,-Truck,LCModelCar,-Truck,-Mandatory
updateModels(); 



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

  // (1) update time and MA actions on inflow
  // (Ma actions for useExplicitOD in Section (4a))

  time +=dt; // dt depends on timewarp slider (fps=const)
  itime++;

  if(automaticBreakdownTest){
    updateInflow(time);
    if(detectCongestion(network)||(time>2400)){
      finishSimulation();
    }
  }


  
  // (1b) update global geometry, and traffic objects

  isSmartphone=mqSmartphone(); // defined outside loop
  hasChanged=false;
  if ((canvas.width!=simDivWindow.clientWidth)
      ||(canvas.height != simDivWindow.clientHeight)){
    hasChanged=true; // only pixel; physical changes in updateSim
    canvas.width  = simDivWindow.clientWidth;
    canvas.height  = simDivWindow.clientHeight;
    aspectRatio=canvas.width/canvas.height;
    refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);;

    scale=refSizePix/refSizePhys; // refSizePhys=constant unless mobile
        //updateDimensions(); // not defined for roundabout

    trafficObjs.calcDepotPositions(canvas);
    if(true){
        console.log("haschanged=true: new canvas dimension: ",
		    canvas.width," X ",canvas.height);
    }
  }

   if(userCanDropObjects&&(!isSmartphone)&&(!trafficObjPicked)){
    trafficObjs.zoomBack(); // here more responsive than in drawSim
  }



  // updateSim (2): integrate all the GUI actions (sliders, TrafficObjects)
  // as long as not done independently (clicks on vehicles)
  // check that global var deepCopying=true (in road.js)
  // (needed for updateModelsOfAllVehicles)
 
  // LCModelMandatory in control_gui.js;
  // road.updateM... makes road.LCModelMandatoryLeft, -Right out of this


  for(var ir=0; ir<network.length; ir++){
    network[ir].updateModelsOfAllVehicles(longModelCar,longModelTruck,
					 LCModelCar,LCModelTruck,
					 LCModelMandatory);
    network[ir].updateSpeedlimits(trafficObjs); // if some exist
  }



  // updateSim (3): do central acc calculation of vehicles
  // (may be later overridden by special actions before speed and pos update)
  
  for(var ir=0; ir<network.length; ir++){
    network[ir].calcAccelerations(); 
  }

  
  // updateSim (4): !!! do all the network actions
  // (inflow, outflow, merging and connecting)

  
  // (4a) inflow BC

  // main routes: routeEC (=[0,8,5], inflow E-arm, straight ahead->W) 
  //              routeWC (=[4,8,1], inflow W-arm, opposite direction->E)
  // road label 0=inflow E-arm
  // road label 1=outflow E-arm
  // road label 2=inflow S-arm etc


  // initialize routes to straight ahead
  
  var routeEIn=routeEC;
  var routeSIn=routeSC;
  var routeWIn=routeWC;
  var routeNIn=routeNC;
  
  if(useExplicitODs){ // use the relative ODs defined in the MA section

    // override any user actions on the mainFrac slider for clarity

    if(useExplicitODs){
      mainFrac= (qE+qW)/qref;
      setSlider(slider_mainFrac,slider_mainFracVal,100*mainFrac,0," %");
    }

    // multiply relative ODs with qIn to get absolute ODs
    
    var q0=qE/qref*qIn;  // road index 0: Inflowing East arm
    var q2=qN/qref*qIn;  // road index 2: Inflowing North arm
    var q4=qW/qref*qIn;  // road index 4: Inflowing West arm
    var q6=qS/qref*qIn;  // road index 6: Inflowing South arm
    
    var r=Math.random();
    routeEIn=(r<qEN/qE)? routeER : (r<(qEN+qEW)/qE) ? routeEC
      : (r<1-qEE/qE) ? routeEL : routeEU;
    routeSIn=(r<qSE/qS)? routeSR : (r<(qSE+qSN)/qS) ? routeSC
      : (r<1-qSS/qS) ? routeSL : routeSU;
    routeWIn=(r<qWS/qW)? routeWR : (r<(qWS+qWE)/qW) ? routeWC
      : (r<1-qWW/qW) ? routeWL : routeWU;
    routeNIn=(r<qNW/qN)? routeNR : (r<(qNW+qNS)/qN) ? routeNC
      : (r<1-qNN/qN) ? routeNL : routeNU;
    //console.log("r=",r," qWS/qW=",qWS/qW,
//		" (qWS+qWE)/qW=",(qWS+qWE)/qW);
    //console.log(" routeWIn=",routeWIn," routeNIn=",routeNIn);
  }

  else{   //do not use explicit ODs but GUI to control ODs
    var q0=0.5*mainFrac*qIn;     // road index 0: Inflowing East arm
    var q2=0.5*(1-mainFrac)*qIn; // road index 2: Inflowing North arm
    var q4=q0;                   // road index 4: Inflowing West arm
    var q6=q2;                   // road index 6: Inflowing South arm

    var cFrac=1/3. + 2./3*focusFrac - focusFrac*Math.abs(leftTurnBias);
    var lFrac=(1-cFrac)/2.*(1+leftTurnBias);
    var rFrac=(1-cFrac)/2.*(1-leftTurnBias); // cFrac+lFrac+rFrac=1
    var clFrac=cFrac+lFrac;

    var r=Math.random();

    routeEIn=(r<cFrac) ? routeEC : (r<clFrac) ? routeEL : routeER;
    routeSIn=(r<cFrac) ? routeSC : (r<clFrac) ? routeSL : routeSR;
    routeWIn=(r<cFrac) ? routeWC : (r<clFrac) ? routeWL : routeWR;
    routeNIn=(r<cFrac) ? routeNC : (r<clFrac) ? routeNL : routeNR;
  }

  // inflow update for both cases
				       
  arm[0].updateBCup(q0,dt,routeEIn); // reference to network[1]
  arm[2].updateBCup(q2,dt,routeNIn);
  arm[4].updateBCup(q4,dt,routeWIn);
  arm[6].updateBCup(q6,dt,routeSIn);
  
  

  for(var ir=0; ir<network.length; ir++){
    network[ir].updateBCdown();
  }

  for(var ir=0; ir<network.length; ir++){
    network[ir].changeLanes();         
    network[ir].updateLastLCtimes(dt);
  }


  // updateSim (4b) mergeDiverge actions

  
  // updateSim (4c): direct connecting stuff
  // connectors selected by the route of the vehicles

  var maxspeed_turn=7;

  var duMerge=network[1].roadLen-uMerge; // merge du before the end of the arm
  var mergeOffset  =-rRing*stitchAngleOffset - duMerge;
  var divergeOffset=-rRing*stitchAngleOffset + 0;
  
  
  // merge: arms to ring
  // respectRingPrio set by html choice element
  
  // connect(targetRoad,uSource,uTarget,offsetLane,
  // conflicts(opt),speed(opt), targetPrio (opt))

  
  network[0].connect(network[8], uMerge, // E arm
		     0.25*PI*rRing+mergeOffset, 0, [], maxspeed_turn,
		     respectRingPrio);
 
  network[2].connect(network[8], uMerge, // N arm
		     0.75*PI*rRing+mergeOffset, 0, [], maxspeed_turn,
		     respectRingPrio);

  network[4].connect(network[8], uMerge, // W arm
		     1.25*PI*rRing+mergeOffset, 0, [], maxspeed_turn,
		     respectRingPrio);

  network[6].connect(network[8], uMerge, // S arm
		     1.75*PI*rRing+mergeOffset, 0, [], maxspeed_turn,
		     respectRingPrio);


  
  // diverge:
  // ring to arms (vehicles know by their routes on which arm to leave)

  // connect(targetRoad,uSource,uTarget,offsetLane,conflicts(opt),speed(opt))
  network[8].connect(network[3], 0.25*PI*rRing+divergeOffset, // E arm
		     0, 0, []);

  network[8].connect(network[5], 0.75*PI*rRing+divergeOffset, // N arm
		     0, 0, []);

  network[8].connect(network[7], 1.25*PI*rRing+divergeOffset, // W arm
		     0, 0, []);

  network[8].connect(network[1], 1.75*PI*rRing+divergeOffset, // S arm
		     0, 0, []);

  
  // updateSim (4d): outflow BC (if not relevant, updateBCdown does nothing)

  for(var ir=0; ir<network.length; ir++){
    network[ir].updateBCdown();
  }

  

  // updateSim (5): move the vehicles longitudinally and laterally
  // synchronously at the end because some special-case changes of calculated
  // accelerations and lane changing model parameters were done before

  for(var ir=0; ir<network.length; ir++){
    network[ir].updateSpeedPositions();
  }



  //##############################################################
  // debug output
  //##############################################################

  if(false){
    debugVeh(211,network);
    debugVeh(212,network);
  }
  
  if(debug){crashinfo.checkForCrashes(network);} //!! deact for production

}
//updateSim




//##################################################
function drawSim() {
//##################################################


    // (0) redefine graphical aspects of road (arc radius etc) using
    // responsive design if canvas has been resized 
    // isSmartphone defined in updateSim
 
  var relTextsize_vmin=(isSmartphone) ? 0.03 : 0.02; //xxx
  var textsize=relTextsize_vmin
      *Math.min(window.innerWidth,window.innerHeight);



  // (2) reset transform matrix and draw background
  // (only needed if changes, plus "reminders" for lazy browsers)

  ctx.setTransform(1,0,0,1,0,0);
  if(drawBackground){
    if(hasChanged||(itime<=10) || (itime%50==0) || userCanvasManip
      || (!drawRoad) || drawVehIDs){
      ctx.drawImage(background,0,0,canvas.width,canvas.height);
    }
  }

 

    // (3) draw mainroad and arms (arms before mainroad)

  var changedGeometry=userCanvasManip || hasChanged||(itime<=1);
  for(var ir=0; ir<network.length; ir++){
    network[ir].draw(roadImages[ir][0],roadImages[ir][1],
		    changedGeometry);
  }

  if(drawRoadIDs){  
    for(var ir=0; ir<network.length; ir++){
      network[ir].drawRoadID();
    }
  }

   
  // (4) draw vehicles !! degree of smooth changing: fracLaneOptical

  // road.drawVehicles(carImg,truckImg,obstImgs,vmin_col,vmax_col,
  //           umin,umax,movingObserver,uObs,center_xPhys,center_yPhys)
  // second arg line optional, only for moving observer

  for(var ir=0; ir<network.length; ir++){
    network[ir].drawVehicles(carImg,truckImg,obstacleImgs,
			    vmin_col,vmax_col);
  }

    
  // drawSim (5): redraw changeable traffic objects 
  // (zoomback is better in sim!)

  if(userCanDropObjects&&(!isSmartphone)){
    trafficObjs.draw();
  }

  ctx.setTransform(1,0,0,1,0,0); // speedlimit-change select box
  drawSpeedlBox();

  
  // drawSim (6): show simulation time and detector displays

  displayTime(time,textsize);
    //displayMediaProperties(canvas,Math.max(10,textsize));

  // drawSim (7): show logical coordinates if activated

  if(showCoords&&mouseInside){
    showLogicalCoords(xPixUser,yPixUser);
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



 

 

