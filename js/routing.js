
// general comments: ring.js, offramp.js (responsive design)



//#############################################################
// Initial settings
//#############################################################

// graphical settings

var width;  // taken from html canvas tag in init()
var height; // taken from html canvas tag in init()
var center_x; // defined in init() after value of width is known
var center_y; // defined in init() after value of height is known

var hasChanged=true; // window dimensions have changed (responsive design)

var drawBackground=true; // if false, default unicolor background
var drawRoad=true; // if false, only vehicles are drawn

var vmin=0; // min speed for speed colormap (drawn in red)
var vmax=100/3.6; // max speed for speed colormap (drawn in blue-violet)



// physical geometry settings [m]

var sizePhys=550;   
var center_xPhys=135;
var center_yPhys=-180; // ypixel downwards=> physical center <0

var lMain=1200;
var nLanes=3;
var laneWidth=7;
var laneWidthRamp=5;

var lStraightMain=0.35*lMain;      // straight segments of U
var lArcMain=lMain-2*lStraightMain; // length of half-circe arc of U
var rMain=lArcMain/Math.PI;


// geometry of deviation road



var umainDiverge=0.4*lStraightMain; // main coord where diverge zone ends
var rDev=30;                       // radius of curves on deviation route
var alpha=0.2*Math.PI;             // heading change of first right-curve
var lrampDev=150;            // length of off/onramp section of deviation
var lTaper=15;                    // for both merge/diverge parts
var lParallel=60;                // length parallel to mainroad before merg.

// length of deviation
var lDev=2*(lrampDev+rMain)+laneWidth*(nLanes+1)+lParallel
    +rDev*(4*alpha+Math.PI+2-4*Math.cos(alpha)); 

// difference between first diverge and first merge point in mainroad coords
var dumainDivergeMerge=rMain*Math.PI-lrampDev
    +lParallel+ 2*(lStraightMain-umainDiverge);

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

var uBeginRoadworks=lStraightMain+0.9*lArcMain;
var uEndRoadworks=uBeginRoadworks+0.2*lArcMain;
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
var scaleFactorImg=lMain/1740; // [pixels/m]


//#################################
// Global graphics specification
//#################################

var canvas;
var ctx;  // graphics context
 
var background;
 



//###############################################################
// physical (m) road, vehicle and model specification
//###############################################################

// IDM_v0 etc and updateModels() with actions  "longModelCar=new IDM(..)" etc
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

var longModelBottl=new IDM(0.4*IDM_v0,8*IDM_T,1*IDM_s0,2*IDM_a,0.5*IDM_b); 
updateModels(); 

// construct network

var isRing=0;  // 0: false; 1: true
duTactical=150; // anticipation distance for applying mandatory LC rules

var mainroad=new road(1, lMain, nLanes, densityInit, speedInit, 
		      truckFracInit, isRing);
var deviation=new road(2, lDev, 1, 0.1*densityInit, speedInit, truckFracInit, isRing);

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
var longModelObstacle=new IDM(0,IDM_T,IDM_s0,0,IDM_b);
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


    mainroad.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				       LCModelCar,LCModelTruck);

    mainroad.updateTruckFrac(truckFrac, truckFracToleratedMismatch);


   // implement strong urge to change lanes before roadworks (umin,umax,toRight)
    mainroad.setLCMandatory(uBeginRoadworks-0.5*lArcMain, uBeginRoadworks, 
			    false);


    deviation.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				      LCModelCar,LCModelTruck);

    deviation.updateTruckFrac(truckFrac, truckFracToleratedMismatch);

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

  // resize drawing region if browser's dim has changed (responsive design)
  // canvas_resize(canvas,aspectRatio)
  hasChanged=canvas_resize(canvas,1.65); 
  if(hasChanged){
      console.log(" new canvas size ",canvas.width,"x",canvas.height,
		  " hasChanged=",hasChanged);
  }

   // (1) define geometry of "U" (road center) as parameterized function of 
   // the arc length u

  function traj_x(u){ // physical coordinates
        var dxPhysFromCenter= // left side (median), phys coordinates
	    (u<lStraightMain) ? lStraightMain-u
	  : (u>lStraightMain+lArcMain) ? u-lMain+lStraightMain
	  : -rMain*Math.sin((u-lStraightMain)/rMain);
	return center_xPhys+dxPhysFromCenter;
  }

  function traj_y(u){ // physical coordinates
        var dyPhysFromCenter=
 	    (u<lStraightMain) ? rMain
	  : (u>lStraightMain+lArcMain) ? -rMain
	  : rMain*Math.cos((u-lStraightMain)/rMain);
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


    var u4=u3+2*(rMain+y3-y1)+laneWidth*(nLanes+1); // end 1st straight
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

    var u4=u3+2*(rMain+y3-y1)+laneWidth*(nLanes+1); // end 1st straight
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
	: y8+0.6*laneWidth*((u-u8-lrampDev+lTaper)/lTaper);
  }

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
	if(hasChanged||(itime<=1) || false || (!drawRoad)){ 
	  ctx.drawImage(background,0,0,canvas.width,canvas.height);
      }
    }


    // (3) draw mainroad and ramps (deviation "bridge" => draw last)
    // and vehicles (directly after frawing resp road or separately, depends)

    deviation.draw(rampImg,scale,trajDeviation_x,trajDeviation_y,laneWidthRamp);

    deviation.drawVehicles(carImg,truckImg,obstacleImg,scale,
			 trajDeviation_x,trajDeviation_y,laneWidth,vmin,vmax);


    mainroad.draw(roadImg,scale,traj_x,traj_y,laneWidth);

    mainroad.drawVehicles(carImg,truckImg,obstacleImg,scale,
			  traj_x,traj_y,laneWidth,vmin,vmax);

    // redraw first/last deviation vehicles obscured by mainroad drawing
    deviation.drawVehicles(carImg,truckImg,obstacleImg,scale,
			   trajDeviation_x,trajDeviation_y,laneWidth,vmin,vmax,
			   0,lrampDev);
    deviation.drawVehicles(carImg,truckImg,obstacleImg,scale,
			   trajDeviation_x,trajDeviation_y,laneWidth,vmin,vmax,
			   lDev-lrampDev, lDev);


    // (4) draw some running-time vars
  if(true){
    ctx.setTransform(1,0,0,1,0,0); 
    var textsize=14;
    //var textsize=scale*20;
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

    
    var timewStr="timewarp="+Math.round(10*timewarp)/10;
    var timewStr_xlb=8*textsize;
    var timewStr_ylb=timeStr_ylb;
    var timewStr_width=7*textsize;
    var timewStr_height=1.2*textsize;
    ctx.fillStyle="rgb(255,255,255)";
    ctx.fillRect(timewStr_xlb,timewStr_ylb-timewStr_height,
		 timewStr_width,timewStr_height);
    ctx.fillStyle="rgb(0,0,0)";
    ctx.fillText(timewStr, timewStr_xlb+0.2*textsize,
		 timewStr_ylb-0.2*textsize);
    
    
    var scaleStr="scale="+Math.round(10*scale)/10;
    var scaleStr_xlb=16*textsize;
    var scaleStr_ylb=timeStr_ylb;
    var scaleStr_width=5*textsize;
    var scaleStr_height=1.2*textsize;
    ctx.fillStyle="rgb(255,255,255)";
    ctx.fillRect(scaleStr_xlb,scaleStr_ylb-scaleStr_height,
		 scaleStr_width,scaleStr_height);
    ctx.fillStyle="rgb(0,0,0)";
    ctx.fillText(scaleStr, scaleStr_xlb+0.2*textsize, 
		 scaleStr_ylb-0.2*textsize);
    

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

    // (6) draw the speed colormap

    drawColormap(scale*(center_xPhys+rMain), 
		 -scale*center_yPhys, scale*80, scale*80,
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
    canvas = document.getElementById("canvas_simulation"); // defined in deviation.html
    ctx = canvas.getContext("2d");
 

    background = new Image();
    background.src =background_srcFile;
    //console.log("image size of background:"+background.naturalWidth); 

    width = canvas.width;
    height = canvas.height;

    center_x=0.50*width*scaleFactorImg; // pixel coordinates
    center_y=0.48*height*scaleFactorImg;

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


    // apply externally functions of mouseMove events  to initialize sliders settings

    change_timewarpSliderPos(timewarp);
    //change_scaleSliderPos(scale);
    change_truckFracSliderPos(truckFrac);
    change_qInSliderPos(qInInit);
    change_fracOffSliderPos(fracOffInit);

    change_IDM_v0SliderPos(IDM_v0);
    change_IDM_TSliderPos(IDM_T);
    change_IDM_s0SliderPos(IDM_s0);
    change_IDM_aSliderPos(IDM_a);
    change_IDM_bSliderPos(IDM_b);


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

