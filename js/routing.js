

//#############################################################
// adapt standard param settings from control_gui.js
//#############################################################

qIn=3500./3600; 
slider_qIn.value=3600*qIn;
slider_qInVal.innerHTML=3600*qIn+" veh/h";


truckFrac=0.15;
slider_truckFrac.value=100*truckFrac;
slider_truckFracVal.innerHTML=100*truckFrac+"%";

IDM_a=0.9; // low to allow stopGo
slider_IDM_a.value=IDM_a;
slider_IDM_aVal.innerHTML=IDM_a+" m/s<sup>2</sup>";
factor_a_truck=1; // to allow faster slowing down of the uphill trucks


MOBIL_mandat_bSafe=15; // standard 42
MOBIL_mandat_bThr=0;   
MOBIL_mandat_bias=10;

// behavior during bottlenecks (car and trucks)

var longModelBottl=new ACC(0.4*IDM_v0,8*IDM_T,1*IDM_s0,2*IDM_a,0.5*IDM_b); 
updateModels(); 


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

var scenarioString="Deviation";
console.log("\n\nstart main: scenarioString=",scenarioString);

var simDivWindow=document.getElementById("contents");
var canvas = document.getElementById("canvas"); 
var ctx = canvas.getContext("2d"); // graphics context
canvas.width  = simDivWindow.clientWidth; 
canvas.height  = simDivWindow.clientHeight;
var aspectRatio=canvas.width/canvas.height;


//##################################################################
// overall scaling (critAspectRatio should be consistent with 
// width/height in css.#contents)
//##################################################################

var refSizePhys=350;  // constants => all objects scale with refSizePix

var critAspectRatio=120./95.; // from css file width/height of #contents

var refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);
var scale=refSizePix/refSizePhys;


//##################################################################
// Specification of physical road geometry and vehicle properties
// If refSizePhys changes, change them all => updatePhysicalDimensions();
//##################################################################

// all relative "Rel" settings with respect to refSizePhys, not refSizePix!

var center_xRel=0.43;
var center_yRel=-0.5;
var arcRadiusRel=0.35;
var offLenRel=0.9;

var center_xPhys=center_xRel*refSizePhys; //[m]
var center_yPhys=center_yRel*refSizePhys;

var arcRadius=arcRadiusRel*refSizePhys;
var arcLen=arcRadius*Math.PI;
var straightLen=refSizePhys*critAspectRatio-center_xPhys;
var mainroadLen=arcLen+2*straightLen;


// geometry of deviation road

var laneWidth=7;  // needed to define deviation geometry 
var laneWidthRamp=5;
var nLanes_main=3;

var umainDiverge=0.65*straightLen-0.15*arcLen; // main coord where diverge zone ends
var rDev=0.1*refSizePhys;        // radius of curves on deviation route
var alpha=0.2*Math.PI;           // heading change of first right-curve
var lrampDev=0.5*refSizePhys;    // length of off/onramp section of deviation
var taperLen=0.05*refSizePhys;   // for both merge/diverge parts
var lParallel=0.2*refSizePhys;   // length parallel to mainroad before merg.

// length of deviation

var lDev=2*(lrampDev+arcRadius)+laneWidth*(nLanes_main+1)+lParallel
    +rDev*(4*alpha+Math.PI+2-4*Math.cos(alpha)); 
console.log("lDev=",lDev);

// difference between first diverge and first merge point in mainroad coords

var dumainDivergeMerge=arcLen-lrampDev
    +lParallel+ 2*(straightLen-umainDiverge);

// first merging point in mainroad coordinates

var umainMerge=umainDiverge+dumainDivergeMerge;

// region of flow-conserving bottleneck to create jams on deviations 

var udevBottlBeg=lDev-lrampDev-2*rDev*alpha-lParallel;
var udevBottlEnd=udevBottlBeg+1.0*lParallel;


console.log(" deviation properties: length lDev="+lDev
	    +" dumainDivergeMerge="+dumainDivergeMerge
	    +" umainDiverge="+umainDiverge
	    +" umainMerge="+umainMerge
	   );

// roadworks properties (mainroad coordinates)

var uBeginRoadworks=straightLen+0.9*arcLen;
var uEndRoadworks=uBeginRoadworks+0.2*arcLen;



function updatePhysicalDimensions(){ // only if sizePhys changed (mobile)
    center_xPhys=center_xRel*refSizePhys;
    center_yPhys=center_yRel*refSizePhys;

    arcRadius=arcRadiusRel*refSizePhys;
    arcLen=arcRadius*Math.PI;
    straightLen=refSizePhys*critAspectRatio-center_xPhys;
    mainroadLen=arcLen+2*straightLen;

    umainDiverge=0.65*straightLen-0.15*arcLen; 
    rDev=0.1*refSizePhys;        // radius of curves on deviation route
    alpha=0.2*Math.PI;           // heading change of first right-curve
    lrampDev=0.5*refSizePhys;    // length of off/onramp section of deviation
    taperLen=0.05*refSizePhys;   // for both merge/diverge parts
    lParallel=0.2*refSizePhys;   // length parallel to mainroad before merg.

    lDev=2*(lrampDev+arcRadius)+laneWidth*(nLanes_main+1)+lParallel
    +rDev*(4*alpha+Math.PI+2-4*Math.cos(alpha)); 

    dumainDivergeMerge=arcLen-lrampDev
    +lParallel+ 2*(straightLen-umainDiverge);
    umainMerge=umainDiverge+dumainDivergeMerge;

    udevBottlBeg=lDev-lrampDev-2*rDev*alpha-lParallel;
    udevBottlEnd=udevBottlBeg+1.0*lParallel;

    uBeginRoadworks=straightLen+0.9*arcLen;
    uEndRoadworks=uBeginRoadworks+0.2*arcLen;
}



// the following remains constant 
// => road becomes more compact for smaller screens

var car_length=7; // car length in m
var car_width=5; // car width in m
var truck_length=15; // trucks
var truck_width=7; 
var laneRoadwork=nLanes_main-1;  // 0=left, nLanes_main-1=righyt
var lenRoadworkElement=10;




//###############################################################
// physical (m) road
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

function trajDeviation_x(u){ // physical coordinates
    var calpha=Math.cos(alpha);
    var salpha=Math.sin(alpha);

    var u1=lrampDev; // end of diverg. section
    var x1=traj_x(u1+umainDiverge);
    var y1=traj_y(u1)+0.5*laneWidth*(nLanes_main+1); // nLanes_main: main; nLanes_mainDev=1

    var u2=u1+rDev*alpha;  //  end first right-curve, begin left curve
    var x2=x1-rDev*salpha;
    var y2=y1+rDev*(1-calpha);

    var u3=u2+rDev*(0.5*Math.PI+alpha); // begin first straight sect perp main
    var x3=x2-rDev*(1+salpha);
    var y3=y2-rDev*calpha;


    var u4=u3+2*(arcRadius+y3-y1)+laneWidth*(nLanes_main+1); // end 1st straight
    var x4=x3;

    var u5=u4+rDev*0.5*Math.PI; // begin second straight sect parall main
    var x5=x4+rDev;

    var u6=u5+lParallel; // end second straight sect parall main
    var x6=x5+lParallel;

    var u7=u6+rDev*alpha; // end last left curve-begin last right curve
    var x7=x6+rDev*salpha;

    var u8=u7+rDev*alpha; // begin merge
    var x8=2*x7-x6;

    var u9=u8+lrampDev; // end merge=end deviation
    var x9=x8+lrampDev;

    return (u<u1) ? x1+u1-u
	: (u<u2) ? x1-rDev*Math.sin((u-u1)/rDev)
	: (u<u3) ? x3+rDev*(1-Math.cos((u3-u)/rDev))
	: (u<u4) ? x3 
	: (u<u5) ? x4+rDev*(1-Math.cos((u-u4)/rDev))
	: (u<u6) ? x5+(u-u5)
	: (u<u7) ? x6 + rDev*Math.sin((u-u6)/rDev)
	: (u<u8) ? x8 - rDev*Math.sin((u8-u)/rDev) : x8+(u-u8);
}


function trajDeviation_y(u){ // physical coordinates
    var calpha=Math.cos(alpha);
    var salpha=Math.sin(alpha);

    var u1=lrampDev; // end of diverg. section
    var y1=traj_y(u1)+0.5*laneWidth*(nLanes_main+1); // nLanes_main: main; nLanes_mainDev=1

    var u2=u1+rDev*alpha;  //  end first right-curve, begin left curve
    var y2=y1+rDev*(1-calpha);

    var u3=u2+rDev*(0.5*Math.PI+alpha); // begin first straight sect perp main
    var y3=y2-rDev*calpha;

    var u4=u3+2*(arcRadius+y3-y1)+laneWidth*(nLanes_main+1); // end 1st straight
    var y4=y3+u3-u4;

    var u5=u4+rDev*0.5*Math.PI; // begin second straight sect parall main
    var y5=y4-rDev;

    var u6=u5+lParallel; // end second straight sect parall main
    var y6=y5;

    var u7=u6+rDev*alpha; // end last left curve-begin last right curve
    var y7=y6+rDev*(1-calpha);

    var u8=u7+rDev*alpha; // begin merge
    var y8=2*y7-y6;

    var u9=u8+lrampDev; // end merge=end deviation
    var y9=y8;


    return (u<taperLen) ? y1-0.6*laneWidth*(1-u/taperLen)
        : (u<u1) ? y1
	: (u<u2) ? y1+rDev*(1-Math.cos((u-u1)/rDev))
	: (u<u3) ? y3+rDev*Math.sin((u3-u)/rDev)
	: (u<u4) ? y3-(u-u3)
	: (u<u5) ? y4-rDev*Math.sin((u-u4)/rDev)
	: (u<u6) ? y5
	: (u<u7) ? y6 + rDev*(1-Math.cos((u-u6)/rDev))
	: (u<u8) ? y8 - rDev*(1-Math.cos((u8-u)/rDev))
        : (u<u8+lrampDev-taperLen) ? y8 
	: y8+0.6*laneWidth*((u-u8-lrampDev+taperLen)/taperLen)
}




//##################################################################
// Specification of logical road network
//##################################################################


var speedInit=20; // m/s
var densityInit=0.001;
var truckFracToleratedMismatch=0.2; 

var isRing=false; 
duTactical=300; // anticipation distance for applying mandatory LC rules

var mainroad=new road(1,mainroadLen,laneWidth,nLanes_main,traj_x,traj_y,
		      densityInit,speedInit,truckFracInit,isRing);
var deviation=new road(2,lDev,laneWidthRamp,1,trajDeviation_x,trajDeviation_y,
		       0.1*densityInit,speedInit,truckFracInit,isRing);

var offrampIDs=[2];
var offrampLastExits=[umainDiverge+lrampDev];
var offrampToRight=[true];
mainroad.setOfframpInfo(offrampIDs,offrampLastExits,offrampToRight);
mainroad.duTactical=duTactical;


//############################################
// define routes
//############################################

var route1=[1];  // stays on mainroad
var route2=[1,2]; // takes deviation
for (var i=0; i<mainroad.veh.length; i++){
    mainroad.veh[i].route=(Math.random()<fracOff) ? route2 : route1;
    //console.log("mainroad.veh["+i+"].route="+mainroad.veh[i].route);
}


// add standing virtual vehicle at the end of onramp (1 lane)

var virtualStandingVeh=new vehicle(2, laneWidth, lDev-0.6*taperLen, 0, 0, "obstacle");
var longModelObstacle=new ACC(0,IDM_T,IDM_s0,0,IDM_b);
var LCModelObstacle=new MOBIL(MOBIL_bSafe,MOBIL_bSafe,1000,MOBIL_bBiasRight_car);
virtualStandingVeh.longModel=longModelObstacle;
virtualStandingVeh.LCModel=LCModelObstacle;
deviation.veh.unshift(virtualStandingVeh); // prepending=unshift

// add standing virtual vehicles at position of road works 
// (nr=number of virtual "roadwork" vehicles)

var nr=Math.round((uEndRoadworks-uBeginRoadworks)/lenRoadworkElement);

for (var ir=0; ir<nr; ir++){
    var u=uBeginRoadworks+(ir+0.5)*lenRoadworkElement;
    var virtualStandingVehRoadw=new vehicle(lenRoadworkElement, laneWidth, 
					u,laneRoadwork, 0, "obstacle");
     virtualStandingVehRoadw.longModel=longModelObstacle;
     virtualStandingVehRoadw.LCModel=LCModelObstacle;
     mainroad.veh.push(virtualStandingVehRoadw); // append; prepend=unshift
}

// put roadwork obstacles at right place and let vehicles get context of them 

mainroad.sortVehicles();
mainroad.updateEnvironment();




//#########################################################
// model specifications (ALL) parameters in control_gui.js)
//#########################################################

var longModelCar;
var longModelTruck;
var LCModelCar;
var LCModelTruck;
var LCModelMandatory; // left right disting in road.updateModelsOfAllVehicles
	
updateModels(); //  from control_gui.js  => define the 5 above models

//####################################################################
// Global graphics specification and image file settings
//####################################################################

var hasChanged=true; // window dimensions have changed (responsive design)

var drawBackground=true; // if false, default unicolor background
var drawRoad=true; // if false, only vehicles are drawn
var userCanvasManip; // true only if user-driven geometry changes

var drawColormap=false;
var vmin_col=0; // min speed for speed colormap (drawn in red)
var vmax_col=100/3.6; // max speed for speed colormap (drawn in blue-violet)


//#########################################################
// The images
//#########################################################


// background image

background = new Image();
background.src='figs/backgroundGrass.jpg'; 


// vehicle image(s)

carImg = new Image();
carImg.src='figs/blackCarCropped.gif';
truckImg = new Image();
truckImg.src='figs/truck1Small.png';


// obstacle (TL,caterpillar etc images srcfiles

var obstacle_srcFiles = [];
obstacle_srcFiles[0]='figs/obstacleImg.png'; // standard black bar or nothing
for (var i=1; i<10; i++){ 
    obstacle_srcFiles[i]="figs/constructionVeh"+i+".png";
    console.log("i=",i," obstacle_srcFiles[i]=", obstacle_srcFiles[i]);
}

obstacleImgs = []; // srcFiles[0]='figs/obstacleImg.png'
for (var i=0; i<obstacle_srcFiles.length; i++){
    obstacleImgs[i]=new Image();
    obstacleImgs[i].src = obstacle_srcFiles[i];
}

// Traffic light images

traffLightRedImg = new Image();
traffLightRedImg.src='figs/trafficLightRed_affine.png';
traffLightGreenImg = new Image();
traffLightGreenImg.src='figs/trafficLightGreen_affine.png';



// road section images 

var road1lanes_srcFile='figs/road1lanesCrop.png';
var road2lanesWith_srcFile='figs/road2lanesCropWith.png';
var road3lanesWith_srcFile='figs/road3lanesCropWith.png';
var road4lanesWith_srcFile='figs/road4lanesCropWith.png';
var road2lanesWithout_srcFile='figs/road2lanesCropWithout.png';
var road3lanesWithout_srcFile='figs/road3lanesCropWithout.png';
var road4lanesWithout_srcFile='figs/road4lanesCropWithout.png';

roadImg1 = new Image();
roadImg1.src=(nLanes_main===1)
	? road1lanes_srcFile
	: (nLanes_main===2) ? road2lanesWith_srcFile
	: (nLanes_main===3) ? road3lanesWith_srcFile
	: road4lanesWith_srcFile;

roadImg2 = new Image();
roadImg2.src=(nLanes_main===1)
	? road1lanes_srcFile
	: (nLanes_main===2) ? road2lanesWithout_srcFile
	: (nLanes_main===3) ? road3lanesWithout_srcFile
	: road4lanesWithout_srcFile;

rampImg = new Image();
rampImg.src='figs/road1lanesCrop.png';


//####################################################################
// vehicleDepot(nImgs,nRow,nCol,xDepot,yDepot,lVeh,wVeh,containsObstacles)
//####################################################################

var smallerDimPix=Math.min(canvas.width,canvas.height);
var depot=new vehicleDepot(obstacleImgs.length, 3,3,
			   0.7*smallerDimPix/scale,
			   -0.5*smallerDimPix/scale,
			   20,20,true);


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

    //console.log("\n(0)");
    //mainroad.writeVehicleRoutes(umainDiverge+lrampDev-1.2*duTactical,umainDiverge+lrampDev);//!!!

    // updateModelsOfAllVehicles also selectively sets LCModelMandatory
    // to offramp vehs based on their routes!

    mainroad.updateTruckFrac(truckFrac, truckFracToleratedMismatch);
    mainroad.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				       LCModelCar,LCModelTruck,
				       LCModelMandatory);


    // implement strong urge to change lanes before roadworks
    // (umin,umax,toRight) !for all vehs in contrast to route based offramp
 
   mainroad.setLCMandatory(uBeginRoadworks-0.5*arcLen, uBeginRoadworks, 
			    false);

    deviation.updateTruckFrac(truckFrac, truckFracToleratedMismatch);
    deviation.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				      LCModelCar,LCModelTruck,
				       LCModelMandatory);


    // implement flow-conserving bottleneck 
    // arg list: (umin,umax, CFModelCar,CFModelTruck)
    deviation.setCFModelsInRange(udevBottlBeg,udevBottlEnd,
				 longModelBottl,longModelBottl);

    // externally impose mandatory LC behaviour
    // all deviation vehicles must change lanes to the left (last arg=false)
    deviation.setLCMandatory(lDev-lrampDev, lDev, false);



    // do central simulation update of vehicles

    mainroad.updateLastLCtimes(dt);
    mainroad.calcAccelerations();  
    mainroad.changeLanes();         
    mainroad.updateSpeedPositions();
    mainroad.updateBCdown();
    var route=(Math.random()<fracOff) ? route2 : route1;
    mainroad.updateBCup(qIn,dt,route); // qIn=total inflow, route opt. arg.


    deviation.updateLastLCtimes(dt); // needed since LC from main road!!
    deviation.calcAccelerations();  
    deviation.updateSpeedPositions();
    deviation.updateBCdown();

    var du_antic=20; //shift anticipation decision point upstream by du_antic

    // umainDiverge, umainMerge updated in canvas_gui.handleDependencies
    //template: mergeDiverge(newRoad,offset,uStart,uEnd,isMerge,toRight)


    mainroad.mergeDiverge(deviation,-umainDiverge,
			  umainDiverge+taperLen,
			  umainDiverge+lrampDev-du_antic,
			  false,true);
    deviation.mergeDiverge(mainroad, umainMerge-(deviation.roadLen-lrampDev),
			   deviation.roadLen-lrampDev, 
			   deviation.roadLen-taperLen, 
			   true,false);
 


    //logging

    //deviation.writeVehiclesSimple();

    if(false){
        console.log("\nafter updateU: itime="+itime+" deviation.nveh="+deviation.nveh);
	for(var i=0; i<deviation.veh.length; i++){
	    console.log("i="+i+" deviation.veh[i].u="+deviation.veh[i].u
			+" deviation.veh[i].v="+deviation.veh[i].v
			+" deviation.veh[i].lane="+deviation.veh[i].lane
			+" deviation.veh[i].laneOld="+deviation.veh[i].laneOld);
	}
 	console.log("\n");
    }

}//updateU




//##################################################
function drawU() {
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


    if ((canvas.width!=simDivWindow.clientWidth)
	||(canvas.height != simDivWindow.clientHeight)){
	hasChanged=true;
	canvas.width  = simDivWindow.clientWidth;
        canvas.height  = simDivWindow.clientHeight;
	aspectRatio=canvas.width/canvas.height;
	refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);

	scale=refSizePix/refSizePhys; // refSizePhys=constant unless mobile

	updatePhysicalDimensions();
        mainroad.gridTrajectories(traj_x,traj_y); //!!! necessary? check others!
        deviation.gridTrajectories(trajDeviation_x,trajDeviation_y);
    }

 
    // (1) update heading of all vehicles rel. to road axis
    // (for some reason, strange rotations at beginning)

    mainroad.updateOrientation(); 


    // (2) reset transform matrix and draw background
    // (only needed if no explicit road drawn)
    // "%20-or condition"
    //  because some older firefoxes do not start up properly?

    ctx.setTransform(1,0,0,1,0,0); 
    if(drawBackground){
	if(userCanvasManip ||hasChanged
	   ||(itime<=1) || (itime===20) || false || (!drawRoad)){
	  ctx.drawImage(background,0,0,canvas.width,canvas.height);
      }
    }


    // (3) draw mainroad and ramps (deviation "bridge" => draw last)
    // and vehicles (directly after frawing resp road or separately, depends)
    // (always drawn; changedGeometry only triggers building a new lookup table)
    //!!! sometimes road elements are moved as though they were vehicles
    // check/debug with omitting drawing of the road (changedGeometry=false)!
    
    var changedGeometry=userCanvasManip || hasChanged||(itime<=1); 
    //var changedGeometry=false; 

    deviation.draw(rampImg,rampImg,scale,changedGeometry);
    deviation.drawVehicles(carImg,truckImg,obstacleImgs,scale,vmin_col,vmax_col);

    mainroad.draw(roadImg1,roadImg2,scale,changedGeometry);
    mainroad.drawVehicles(carImg,truckImg,obstacleImgs,scale,vmin_col,vmax_col);

    // redraw first/last deviation vehicles obscured by mainroad drawing
 
    deviation.drawVehicles(carImg,truckImg,obstacleImgs,scale,
			  vmin_col,vmax_col,0,lrampDev);
    deviation.drawVehicles(carImg,truckImg,obstacleImgs,scale,
			   vmin_col,vmax_col,lDev-lrampDev, lDev);

    // (5) !!! draw depot vehicles

    depot.draw(obstacleImgs,scale,canvas);


    // (6) draw simulated time

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
    }

     // (6) draw the speed colormap

    if(drawColormap){ 
	displayColormap(0.22*refSizePix,
			0.43*refSizePix,
			0.1*refSizePix, 0.2*refSizePix,
			vmin_col,vmax_col,0,100/3.6);
    }


    // revert to neutral transformation at the end!
    ctx.setTransform(1,0,0,1,0,0); 
}// drawU
 

 //##################################################
// Running function of the sim thread (triggered by setInterval)
//##################################################

function main_loop() {
    updateU();
    drawU();
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



 

 

