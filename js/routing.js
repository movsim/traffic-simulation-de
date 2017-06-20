
// general comments: ring.js, offramp.js (responsive design)



//#############################################################
// Initial settings
//#############################################################

var scenarioString="Deviation";

// graphical settings

var hasChanged=true; // window dimensions have changed (responsive design)

var drawBackground=true; // if false, default unicolor background
var drawRoad=true; // if false, only vehicles are drawn

var vmin=0; // min speed for speed colormap (drawn in red)
var vmax=100/3.6; // max speed for speed colormap (drawn in blue-violet)



// physical geometry settings [m]

var sizePhys=350;   
var center_xPhys=135; // !! only IC!
var center_yPhys=-180; // !! only IC! ypixel downwards=> physical center <0

var mainroadLen=1200;
var nLanes=3;
var laneWidth=7;
var laneWidthRamp=5;

var straightLen=0.35*mainroadLen;      // straight segments of U
var arcLen=mainroadLen-2*straightLen; // length of half-circe arc of U
var arcRadius=arcLen/Math.PI;


// geometry of deviation road

var umainDiverge=0.4*straightLen; // main coord where diverge zone ends
var rDev=30;                       // radius of curves on deviation route
var alpha=0.2*Math.PI;             // heading change of first right-curve
var lrampDev=150;            // length of off/onramp section of deviation
var lTaper=15;                    // for both merge/diverge parts
var lParallel=60;                // length parallel to mainroad before merg.

// length of deviation
var lDev=2*(lrampDev+arcRadius)+laneWidth*(nLanes+1)+lParallel
    +rDev*(4*alpha+Math.PI+2-4*Math.cos(alpha)); 

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
var laneRoadwork=nLanes-1;  // 0=left, nLanes-1=righyt
var lenRoadworkElement=10;


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

var MOBIL_mandat_bSafe=15;
var MOBIL_mandat_bThr=0;
var MOBIL_mandat_bias=15;

var dt_LC=4; // duration of a lane change

// simulation initial conditions settings
//(initial values and range of user-ctrl var in gui.js)

var speedInit=20; // m/s
var densityInit=0.001;
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
//var background_srcFile='figs/backgroundGrass.jpg'; //800 x 800
var background_srcFile='figs/backgroundGrass.jpg'; //1100 x 700
var scaleFactorImg=mainroadLen/1740; // [pixels/m]


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

function trajDeviation_x(u){ // physical coordinates
    var calpha=Math.cos(alpha);
    var salpha=Math.sin(alpha);

    var u1=lrampDev; // end of diverg. section
    var x1=traj_x(u1+umainDiverge);
    var y1=traj_y(u1)+0.5*laneWidth*(nLanes+1); // nLanes: main; nLanesDev=1

    var u2=u1+rDev*alpha;  //  end first right-curve, begin left curve
    var x2=x1-rDev*salpha;
    var y2=y1+rDev*(1-calpha);

    var u3=u2+rDev*(0.5*Math.PI+alpha); // begin first straight sect perp main
    var x3=x2-rDev*(1+salpha);
    var y3=y2-rDev*calpha;


    var u4=u3+2*(arcRadius+y3-y1)+laneWidth*(nLanes+1); // end 1st straight
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
    var y1=traj_y(u1)+0.5*laneWidth*(nLanes+1); // nLanes: main; nLanesDev=1

    var u2=u1+rDev*alpha;  //  end first right-curve, begin left curve
    var y2=y1+rDev*(1-calpha);

    var u3=u2+rDev*(0.5*Math.PI+alpha); // begin first straight sect perp main
    var y3=y2-rDev*calpha;

    var u4=u3+2*(arcRadius+y3-y1)+laneWidth*(nLanes+1); // end 1st straight
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


    return (u<lTaper) ? y1-0.6*laneWidth*(1-u/lTaper)
        : (u<u1) ? y1
	: (u<u2) ? y1+rDev*(1-Math.cos((u-u1)/rDev))
	: (u<u3) ? y3+rDev*Math.sin((u3-u)/rDev)
	: (u<u4) ? y3-(u-u3)
	: (u<u5) ? y4-rDev*Math.sin((u-u4)/rDev)
	: (u<u6) ? y5
	: (u<u7) ? y6 + rDev*(1-Math.cos((u-u6)/rDev))
	: (u<u8) ? y8 - rDev*(1-Math.cos((u8-u)/rDev))
        : (u<u8+lrampDev-lTaper) ? y8 
	: y8+0.6*laneWidth*((u-u8-lrampDev+lTaper)/lTaper)
}

// IDM_v0 etc and updateModels() with actions  "longModelCar=new ACC(..)" etc
// defined in gui.js

var longModelCar;
var longModelTruck;
var LCModelCar;
var LCModelTruck;
var LCModelMandatoryRight=new MOBIL(MOBIL_mandat_bSafe,MOBIL_mandat_bSafe, 
				    MOBIL_mandat_bThr, MOBIL_mandat_bias);
var LCModelMandatoryLeft=new MOBIL(MOBIL_mandat_bSafe,MOBIL_mandat_bSafe, 
				    MOBIL_mandat_bThr, -MOBIL_mandat_bias);

// behavior during bottlenecks (car and trucks)

var longModelBottl=new ACC(0.4*IDM_v0,8*IDM_T,1*IDM_s0,2*IDM_a,0.5*IDM_b); 
updateModels(); 

// construct network

var isRing=0;  // 0: false; 1: true
duTactical=150; // anticipation distance for applying mandatory LC rules

var mainroad=new road(1,mainroadLen,laneWidth,nLanes,traj_x,traj_y,
		      densityInit,speedInit,truckFracInit,isRing);
var deviation=new road(2,lDev,laneWidthRamp,1,trajDeviation_x,trajDeviation_y,
		       0.1*densityInit,speedInit,truckFracInit,isRing);

var offrampIDs=[2];
var offrampLastExits=[umainDiverge+lrampDev];
var offrampToRight=[true];
mainroad.setOfframpInfo(offrampIDs,offrampLastExits,offrampToRight);
mainroad.duTactical=duTactical;

// set unique mandatory LC models for use whenever mandatory situationarises

mainroad.LCModelMandatoryRight=LCModelMandatoryRight;
mainroad.LCModelMandatoryLeft=LCModelMandatoryLeft;
deviation.LCModelMandatoryRight=LCModelMandatoryRight;
deviation.LCModelMandatoryLeft=LCModelMandatoryLeft;


//#########################################################
// add standing virtual vehicle at the end of onramp (1 lane)
//#########################################################

var virtualStandingVeh=new vehicle(2, laneWidth, lDev-0.6*lTaper, 0, 0, "obstacle");
var longModelObstacle=new ACC(0,IDM_T,IDM_s0,0,IDM_b);
var LCModelObstacle=new MOBIL(MOBIL_bSafe,MOBIL_bSafe,1000,MOBIL_bBiasRight_car);
virtualStandingVeh.longModel=longModelObstacle;
virtualStandingVeh.LCModel=LCModelObstacle;
deviation.veh.unshift(virtualStandingVeh); // prepending=unshift (strange name)


//#########################################################
// add standing virtual vehicles at position of road works 
//#########################################################

// number of virtual "roadwork" vehicles
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



//############################################
// define routes
//############################################

var route1=[1];  // stays on mainroad
var route2=[1,2]; // takes deviation
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



   // implement strong urge to change lanes before roadworks (umin,umax,toRight)
    mainroad.setLCMandatory(uBeginRoadworks-0.5*arcLen, uBeginRoadworks, 
			    false);


    deviation.updateTruckFrac(truckFrac, truckFracToleratedMismatch);
    deviation.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				      LCModelCar,LCModelTruck);


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


    //template: mergeDiverge(newRoad,offset,uStart,uEnd,isMerge,toRight)

    var du_antic=20; //shift anticipation decision point upstream by du_antic

    mainroad.mergeDiverge(deviation,-umainDiverge,
			  umainDiverge+lTaper,
			  umainDiverge+lrampDev-du_antic,
			  false,true);
    deviation.mergeDiverge(mainroad, umainMerge-(lDev-lrampDev),
			   lDev-lrampDev, 
			   lDev-lTaper, 
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

      // update geometric properties of deviation; 
      // see "geometry of deviation road" for explanation 
	umainDiverge=0.65*straightLen-0.15*arcLen;
      //umainDiverge=0.55*straightLen+0.2*arcLen;// main coord where diverge zone ends
      lDev=2*(lrampDev+arcRadius)+laneWidth*(nLanes+1)+lParallel
        + rDev*(4*alpha+Math.PI+2-4*Math.cos(alpha)); // length of deviation
      dumainDivergeMerge=arcLen-lrampDev
        + lParallel+ 2*(straightLen-umainDiverge);
      umainMerge=umainDiverge+dumainDivergeMerge;
      udevBottlBeg=lDev-lrampDev-2*rDev*alpha-lParallel;
      udevBottlEnd=udevBottlBeg+1.0*lParallel;

      // update position of roadworks
 
      uBeginRoadworks=straightLen+0.9*arcLen;
      uEndRoadworks=uBeginRoadworks+0.2*arcLen;


      center_xPhys=1.2*arcRadius;
      center_yPhys=-1.30*arcRadius; // ypixel downwards=> physical center <0

      scale=refSizePix/sizePhys; 

      // !!!!
      // update gridded road trajectories (revert any user-dragged shifts)
      // inside if(hasChanged) block


      mainroad.roadLen=mainroadLen;
      deviation.roadLen=lDev;
      mainroad.gridTrajectories(traj_x,traj_y);
      deviation.gridTrajectories(trajDeviation_x,trajDeviation_y);

      if(true){
	console.log("canvas has been resized: new dim ",
		    canvas.width,"X",canvas.height," refSizePix=",
		    refSizePix," sizePhys=",sizePhys," scale=",scale,
		    " lDev=",lDev);
      }
    }
/*
  // resize drawing region if browser's dim has changed (responsive design)
  // canvas_resize(canvas,aspectRatio)
  hasChanged=canvas_resize(canvas,1.65); 
  if(hasChanged){
      console.log(" new canvas size ",canvas.width,"x",canvas.height,
		  " hasChanged=",hasChanged);
  }
*/



    if(false){
	for (var i=0; i<40; i++){
	    var u=i*20;
            console.log("u="+u+" trajDeviation_x(u)="+ trajDeviation_x(u)
			+"  trajDeviation_y(u)="+ trajDeviation_y(u));
	}
    }

 
    mainroad.updateOrientation(); // update heading of all vehicles rel. to road axis
                                  // (for some reason, strange rotations at beginning)



    // (2) reset transform matrix and draw background
    // (only needed if no explicit road drawn)
    // "%20-or condition"
    //  because some older firefoxes do not start up properly?

    ctx.setTransform(1,0,0,1,0,0); 
    if(drawBackground){
	if(hasChanged||(itime<=1) || (itime==20) || false || (!drawRoad)){ 
	  ctx.drawImage(background,0,0,canvas.width,canvas.height);
      }
    }


    // (3) draw mainroad and ramps (deviation "bridge" => draw last)
    // and vehicles (directly after frawing resp road or separately, depends)
    // (always drawn; changedGeometry only triggers building a new lookup table)
    //!!! sometimes road elements are moved as though they were vehicles
    // check/debug with omitting drawing of the road (changedGeometry=false)!
    
    var changedGeometry=hasChanged||(itime<=1); 
    //var changedGeometry=false; 

    deviation.draw(rampImg,scale,changedGeometry);
    deviation.drawVehicles(carImg,truckImg,obstacleImg,scale,vmin,vmax);

    mainroad.draw(roadImg,scale,changedGeometry);
    mainroad.drawVehicles(carImg,truckImg,obstacleImg,scale,vmin,vmax);

    // redraw first/last deviation vehicles obscured by mainroad drawing
    deviation.drawVehicles(carImg,truckImg,obstacleImg,scale,vmin,vmax,
			   0,lrampDev);
    deviation.drawVehicles(carImg,truckImg,obstacleImg,scale,vmin,vmax,
			   lDev-lrampDev, lDev);


    // (4) draw some running-time vars
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
                   0.50*refSizePix,
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
// (ii) when pressing the start button defined in deviation_gui.js ("myRun=init();")
// "var ..." Actually does something; 
// function keyword [function fname(..)] defines only
//############################################

function init() {
    canvas = document.getElementById("canvas_routing"); // defined in deviation.html
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
	var xUserMain=mainroad.traj_x(0.4*mainroad.roadLen)+0;
	var yUserMain=mainroad.traj_y(0.4*mainroad.roadLen)-0;
	var xUserDev=deviation.traj_x(0.5*deviation.roadLen)+70;
	var yUserDev=deviation.traj_y(0.5*deviation.roadLen)-0;
	mainroad.testCRG(xUserMain,yUserMain);
	mainroad.doCRG(xUserMain,yUserMain);
	mainroad.finishCRG();
	deviation.testCRG(xUserDev,yUserDev);
	deviation.doCRG(xUserDev,yUserDev);
	deviation.finishCRG();
	var xUserDev=deviation.traj_x(0.7*deviation.roadLen)-70;
	var yUserDev=deviation.traj_y(0.7*deviation.roadLen)-0;
	deviation.testCRG(xUserDev,yUserDev);
	deviation.doCRG(xUserDev,yUserDev);
	deviation.finishCRG();
        // since road not redrawn generally, this here necessary
	ctx.drawImage(background,0,0,canvas.width,canvas.height);
        deviation.draw(rampImg,scale,true);
	mainroad.draw(roadImg,scale,true); 
    }

    drawU();
    updateU();
    //mainroad.writeVehicles(); // for debugging
}
 

//##################################################
// Actual start of the simulation thread
// (also started from gui.js "Deviation" button) 
// everything w/o function keyword [function f(..)]" actually does something, not only def
//##################################################

 
 var myRun=init();

