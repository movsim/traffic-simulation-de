
const userCanDropObjects=true;
//drawVehIDs=false; // override control_gui.js

//#############################################################
// adapt/override standard param settings from control_gui.js
//#############################################################

qIn=3500./3600; 
setSlider(slider_qIn, slider_qInVal, 3600*qIn, 0, "veh/h");

density=0.015;

fracTruck=0.15;
setSlider(slider_fracTruck, slider_fracTruckVal, 100*fracTruck, 0, "%");

IDM_a=0.7; // low to allow stopGo
setSlider(slider_IDM_a, slider_IDM_aVal, IDM_a, 1, "m/s<sup>2</sup>");

factor_a_truck=1; // to allow faster slowing down of the uphill trucks

MOBIL_mandat_bSafe=22; // standard 42
MOBIL_mandat_bThr=0;   
MOBIL_mandat_bias=22;


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

var scenarioString="RoadWorks";
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

var isSmartphone=mqSmartphone();

var refSizePhys=(isSmartphone) ? 150 : 250;  // constant


var critAspectRatio=120./95.; // from css file width/height of #contents

var refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);
var scale=refSizePix/refSizePhys;

//##################################################################
// Specification of physical road geometry and vehicle properties
// If refSizePhys changes, change them all => updateDimensions();
//##################################################################

// all relative "Rel" settings with respect to refSizePhys, not refSizePix!

var center_xRel=0; // manipulae relative viewport by traj_x
var center_yRel=-0.88;
var arcRadiusRel=0;

var center_xPhys=center_xRel*refSizePhys; //[m]
var center_yPhys=center_yRel*refSizePhys;

var arcRadius=arcRadiusRel*refSizePhys;
var arcLen=arcRadius*Math.PI;
var straightLen=refSizePhys*critAspectRatio-center_xPhys;
var mainroadLen=arcLen+2*straightLen;

// var offLen=offLenRel*refSizePhys; 
// var divergeLen=0.5*offLen;

// var mainRampOffset=mainroadLen-straightLen;
// var taperLen=0.2*offLen;
// var offRadius=3*arcRadius;


function updateDimensions(){ // if viewport or sizePhys changed
    center_xPhys=center_xRel*refSizePhys; //[m]
    center_yPhys=center_yRel*refSizePhys;

    arcRadius=arcRadiusRel*refSizePhys;
    arcLen=arcRadius*Math.PI;
    straightLen=refSizePhys*critAspectRatio-center_xPhys;
    mainroadLen=arcLen+2*straightLen;

    // offLen=offLenRel*refSizePhys; 
    // divergeLen=0.5*offLen;

    // mainRampOffset=mainroadLen-straightLen;
    // taperLen=0.2*offLen;
    // offRadius=3*arcRadius;

}



// the following remains constant 
// => road becomes more compact for smaller screens

var laneWidth=7; // remains constant => road becomes more compact for smaller
var nLanes_main=1;
var nLanes_road2=2;

var car_length=7; // car length in m
var car_width=5; // car width in m
var truck_length=15; // trucks
var truck_width=7; 


function traj_x(u){ // physical coordinates
  var dxPhysFromCenter = u * Math.cos(Math.PI / 4); // angle of 45 degrees
  return center_xPhys + dxPhysFromCenter;
}


function traj_y(u){ // physical coordinates
  var dyPhysFromCenter = u * Math.sin(Math.PI / 11); 
  return center_yPhys + dyPhysFromCenter;
}

function traj2_x(u){ // physical coordinates
  var dxPhysFromCenter = u * Math.cos(Math.PI / 4); // angle of 45 degrees
  return center_xPhys + dxPhysFromCenter - 40;
}


function traj2_y(u){ // physical coordinates
  var dyPhysFromCenter = u * Math.sin(Math.PI / 11); 
  //console.log(dyPhysFromCenter);
  return center_yPhys + dyPhysFromCenter;
}

function traj_rmew_x(u){ // physical coordinates
  var dxPhysFromCenter = -u * Math.cos(Math.PI / 6); // angle of 45 degrees
  return center_xPhys + dxPhysFromCenter + 500;
}


function traj_rmew_y(u){ // physical coordinates
  var dyPhysFromCenter = -u * Math.sin(Math.PI / 8.2); 
  return center_yPhys + dyPhysFromCenter + 250;
}

// function trajRamp_x(u){ // physical coordinates
// 	var xDivergeBegin=traj_x(mainRampOffset);
// 	return (u<divergeLen)
// 	    ? xDivergeBegin+u
// 	    : xDivergeBegin+divergeLen
// 	+offRadius*Math.sin((u-divergeLen)/offRadius);
// }


// function trajRamp_y(u){ // physical coordinates
//     	var yDivergeBegin=traj_y(mainRampOffset)
// 	    -0.5*laneWidth*(nLanes_main+nLanes_rmp)-0.02*laneWidth;
// 	return (u<taperLen)
//             ? yDivergeBegin+laneWidth-laneWidth*u/taperLen: (u<divergeLen)
// 	    ? yDivergeBegin
// 	    : yDivergeBegin -offRadius*(1-Math.cos((u-divergeLen)/offRadius));
// }

// var trajRamp=[trajRamp_x,trajRamp_y];



//##################################################################
// Specification of logical road network
//##################################################################

var isRing=false;  // 0: false; 1: true
var roadID=1;
var road2ID=2;
var road_main_east_west=3;
var ramp1=4;

var speedInit=20; // IC for speed
var fracTruckToleratedMismatch=1.0; // 100% allowed=>changes only by sources

duTactical=250;

var mainroad=new road(roadID,mainroadLen,laneWidth,nLanes_main,
		      [traj_x,traj_y],
		      density, speedInit,fracTruck, isRing);

// network declared in canvas_gui.js
var road2=new road(road2ID,mainroadLen,laneWidth,nLanes_road2,
  [traj2_x,traj2_y],
  density, speedInit,fracTruck, isRing);
var road_main_east_west=new road(road_main_east_west,mainroadLen,laneWidth,nLanes_road2,
  [traj_rmew_x,traj_rmew_y],
  density, speedInit,fracTruck, isRing);
// var ramp1=new road(2,offLen,laneWidth,nLanes_rmp,trajRamp,
//   0.1*density,speedInit,fracTruck,isRing);

network[0]=mainroad;  
network[0].drawVehIDs=drawVehIDs;
network[1]=road2;
network[1].drawVehIDs=drawVehIDs;
network[2]=road_main_east_west;
network[2].drawVehIDs=drawVehIDs;
// network[3]=ramp1;
// network[3].drawVehIDs=drawVehIDs;

// varofframpIDS=[2];
// var offrampLastExits=[mainRampOffset+divergeLen];
// var offrampToRight=[true];
// mainroad.setOfframpInfo(offrampIDs,offrampLastExits,offrampToRight);
mainroad.duTactical=duTactical;

var route1=[1];
var route2=[2];
var route3=[3];
// var route4=[1,3];
// for (var i=0; i<mainroad.veh.length; i++){
//   mainroad.veh[i].route=(Math.random()<fracOff) ? route2 : route1;
//   //console.log("mainroad.veh["+i+"].route="+mainroad.veh[i].route);
// }
	
updateModels(); // defines longModelCar,-Truck,LCModelCar,-Truck,-Mandatory


//####################################################################
// Global graphics specification 
//####################################################################


var hasChanged=true; // window dimensions have changed (responsive design)

var drawBackground=true; // if false, default unicolor background
var drawRoad=true; // if false, only vehicles are drawn
var userCanvasManip; // true only if used-driven geometry changes finished

var drawColormap=false; // now drawn as png from html 
var vmin_col=0; // min speed for speed colormap (drawn in red)
var vmax_col=100/3.6; // max speed for speed colormap (drawn in blue-violet)


//#########################################################
// The images
//#########################################################




// init background image

var background = new Image();
background.src ='figs/roadway-1.png'; 
 

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


// define obstacle image names

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
roadImg1=roadImgs1[nLanes_main-1];
roadImg2 = new Image();
roadImg2=roadImgs2[nLanes_main-1];




//speedlimit images (now as .svg images)


//############################################
// traffic objects
//############################################

// TrafficObjects(canvas,nTL,nLimit,xRelDepot,yRelDepot,nRow,nCol)
var trafficObjs=new TrafficObjects(canvas,0,3,0.60,0.50,3,2);
var trafficLightControl=new TrafficLightControlEditor(trafficObjs,0.5,0.5);

// initialize one speedlimit on road
// the selected trafficObj needs to be of type speedlimit! not checked!
// default/init values 60,80,100; select the second object trafficObj[1]

var speedl=trafficObjs.trafficObj[1]; 
//activate(trafficObject,road,u) or activate(trafficObject,road)
trafficObjs.activate(speedl,mainroad,30);
trafficObjs.active_drawTopSign=false; // false=>only bottom sign drawn

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


    // (1) update times

    time +=dt; // dt depends on timewarp slider (fps=const)
    itime++;
    isSmartphone=mqSmartphone();

    // (2) transfer effects from slider interaction and mandatory regions
    // to the vehicles and models

    mainroad.updateTruckFrac(fracTruck, fracTruckToleratedMismatch);
    mainroad.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				       LCModelCar,LCModelTruck,
				       LCModelMandatory);
    road2.updateTruckFrac(fracTruck, fracTruckToleratedMismatch);
    road2.updateModelsOfAllVehicles(longModelCar,longModelTruck,
               LCModelCar,LCModelTruck,
               LCModelMandatory);
    road_main_east_west.updateTruckFrac(fracTruck, fracTruckToleratedMismatch);
    road_main_east_west.updateModelsOfAllVehicles(longModelCar,longModelTruck,
               LCModelCar,LCModelTruck,
               LCModelMandatory);
    // ramp1.updateTruckFrac(fracTruck, fracTruckToleratedMismatch);
    // ramp1.updateModelsOfAllVehicles(longModelCar,longModelTruck,
    //            LCModelCar,LCModelTruck,
    //            LCModelMandatory);
  // (2a) update moveable speed limits

  for(var i=0; i<network.length; i++){
    network[i].updateSpeedlimits(trafficObjs);
  }


    // (2b) externally impose mandatory LC behaviour
    // all left-lane vehicles must change lanes to the right
    // starting at 0 up to the position uBeginRoadworks

    // mainroad.setLCMandatory(uStartLCMandatory, uBeginRoadworks, true);


    // do central simulation update of vehicles

    mainroad.updateLastLCtimes(dt);
    mainroad.calcAccelerations();  
    mainroad.changeLanes();         
    mainroad.updateSpeedPositions();
    mainroad.updateBCdown();
    mainroad.updateBCup(qIn,dt); // argument=total inflow
    road2.updateLastLCtimes(dt);
    road2.calcAccelerations();  
    road2.changeLanes();         
    road2.updateSpeedPositions();
    road2.updateBCdown();
    road2.updateBCup(qIn,dt); // argument=total inflow
    road_main_east_west.updateLastLCtimes(dt);
    road_main_east_west.calcAccelerations();  
    road_main_east_west.changeLanes();         
    road_main_east_west.updateSpeedPositions();
    road_main_east_west.updateBCdown();
    road_main_east_west.updateBCup(qIn,dt); // argument=total inflow
    // ramp1.updateLastLCtimes(dt); // needed since LC from main road!!
    // ramp1.calcAccelerations();  
    // ramp1.updateSpeedPositions();
    // ramp1.updateBCdown();

    // var u_antic=20;
    // mainroad.mergeDiverge(ramp,-mainRampOffset,
		// 	  mainRampOffset+taperLen,
		// 	  mainRampOffset+divergeLen-u_antic,
		// 	  false,true);

    if(userCanDropObjects&&(!isSmartphone)&&(!trafficObjPicked)){
      trafficObjs.zoomBack();
    }
  
  
    // debug output
  
    if(false){
      console.log("mainroadLen=",formd(mainroadLen), 
      " mainroad.roadLen=",formd(mainroad.roadLen),
      " mainroad.offrampLastExits=",
      formd(mainroad.offrampLastExits),
      " ramp.roadLen=",formd(ramp.roadLen),
      " mainRampOffset=",formd(mainRampOffset));
      console.log("mergeDiverge(ramp",
      ",",formd(-mainRampOffset),
      ",",formd(mainRampOffset+taperLen),
      ",",formd(mainRampOffset+divergeLen-u_antic),
      ")");
    }
  
  
  
  }//updateSim




//##################################################
function drawSim() {
//##################################################

    // (0) redefine graphical aspects of road (arc radius etc) using
    // responsive design if canvas has been resized 
    // isSmartphone defined in updateSim
 
    var relTextsize_vmin=(isSmartphone) ? 0.03 : 0.02; //xxx
    var textsize=relTextsize_vmin*Math.min(canvas.width,canvas.height);

    if(false){
        console.log(" new total inner window dimension: ",
		window.innerWidth," X ",window.innerHeight,
		" (full hd 16:9 e.g., 1120:630)",
		" canvas: ",canvas.width," X ",canvas.height);
    }


    if ((canvas.width!=simDivWindow.clientWidth)
	||(canvas.height != simDivWindow.clientHeight)){
	hasChanged=true;
	canvas.width  = simDivWindow.clientWidth;
        canvas.height  = simDivWindow.clientHeight;
	aspectRatio=canvas.width/canvas.height;
	refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);

	scale=refSizePix/refSizePhys; // refSizePhys=constant unless mobile

      updateDimensions();
      trafficObjs.calcDepotPositions(canvas); 

	if(true){
	    console.log("haschanged=true: new canvas dimension: ",
		        canvas.width," X ",canvas.height);
	}


    }


    // (1) update heading of all vehicles rel. to road axis
    // (for some reason, strange rotations at beginning)

    
  // (2) reset transform matrix and draw background
  // (only needed if changes, plus "reminders" for lazy browsers)

  ctx.setTransform(1,0,0,1,0,0);
  if(drawBackground){
    if(hasChanged||(itime<=10) || (itime%50==0) || userCanvasManip
      || (!drawRoad)){
      ctx.drawImage(background,0,0,canvas.width,canvas.height);
    }
  }



    // (3) draw mainroad and ramps (offramp "bridge" => draw last)
    // and vehicles (directly after frawing resp road or separately, depends)
    // (always drawn; changedGeometry only triggers building a new lookup table)

    var changedGeometry=userCanvasManip || hasChanged||(itime<=1); 
 
    mainroad.draw(roadImg1,roadImg2,scale,changedGeometry);
    road2.draw(roadImg1,roadImg2,scale,changedGeometry);
    road_main_east_west.draw(roadImg1,roadImg2,scale,changedGeometry);
    //ramp1.draw(rampImg,rampImg,scale,changedGeometry);

    // (4) draw vehicles

    mainroad.drawVehicles(carImg,truckImg,obstacleImgs,scale,vmin_col,vmax_col);
    road2.drawVehicles(carImg,truckImg,obstacleImgs,scale,vmin_col,vmax_col);
    road_main_east_west.drawVehicles(carImg,truckImg,obstacleImgs,scale,vmin_col,vmax_col);
    //ramp1.drawVehicles(carImg,truckImg,obstacleImgs,scale,vmin_col,vmax_col);

   // (5a) draw traffic objects 

  if(userCanDropObjects&&(!isSmartphone)){
    trafficObjs.draw(scale);
  }

  // (5b) draw speedlimit-change select box

  ctx.setTransform(1,0,0,1,0,0); 
  drawSpeedlBox();



    // (6) draw some running-time vars

    displayTime(time,textsize);


    // (7) draw the speed colormap

    if(drawColormap){ 
	displayColormap(0.22*refSizePix,
			0.43*refSizePix,
			0.1*refSizePix, 0.2*refSizePix,
			vmin_col,vmax_col,0,100/3.6);
    }

  // may be set to true in next step if changed canvas 
  // or old sign should be wiped away 
  hasChanged=false; 

    // revert to neutral transformation at the end!
    ctx.setTransform(1,0,0,1,0,0); 
 
} // drawSim
 

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



 
