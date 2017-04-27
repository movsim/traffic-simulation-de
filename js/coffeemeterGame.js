


//#############################################
// model specifications and fixed settings 
// (these are GUI-sliders in the "normal" scenarios)
//#############################################

// space and time

var sizePhys=120;  // visible road section [m] 
                   // (scale=min(canvas.width,height/sizePhys))
var timewarp=1;
var scale;        // pixel/m defined in draw() by min(canvas.width,height)/sizePhys
var scaleBg;      // pixel bg Img/m defined in draw()
var fps=20; // frames per second (unchanged during runtime)
var dt=timewarp/fps;
var time=0;
var itime=0;

// ego vehicle

var relObserver=true;
var ego_speedInit=80./3.6;
var ego_uInit=240;  // initial arclength position
var ego_laneInit=2; // 0=leftmost
var ego_yRelPosition=0.3; // fraction of canvas height where ego vehicle
                          // is drawn (e.g., 0.3 => 30% of canvas height for
                          // back traffic)
var uObs=0; // to be defined in init()



// traffic flow

var qIn=0;       // no additional inflowing vehicles; all done by initializeMicro

// model parameters (or better: restraints) of ego vehicle 

var bmax=9;// maximum absolue acceleration (limit where sliding/ESP begins)
var amax=4;// max acceleration (if vLong=0)
var vmax=190/3.6; // maximum speed of ego-vehicle @ full throttle
var vc=25; // if vLong>vc, then steering can lead to accLat>bmax



// model parameters of surrounding traffic

var IDM_v0=30;  // overridden by initialization
var IDM_T=1.5;  // overridden by initialization
var IDM_s0=2;   // all the rest used by initialization
var IDM_a=1.0;
var IDM_b=2;
var IDMtruck_v0=80./3.6;
var IDMtruck_T=2;
var IDMtruck_a=0.8;

var MOBIL_bSafe=4;    // bSafe if v to v0
var MOBIL_bSafeMax=17; // bSafe if v to 0
var MOBIL_bThr=0.2;
var MOBIL_bBiasRight_car=0.2;
var MOBIL_bBiasRight_truck=0.4;

var MOBIL_mandat_bSafe=6;
var MOBIL_mandat_bSafeMax=20;
var MOBIL_mandat_bThr=0;
var MOBIL_mandat_biasRight=20;


// models (longModels attributed individually at initialization)

//var longModelCar=new ACC(IDM_v0,IDM_T,IDM_s0,IDM_a,IDM_b);
//var longModelTruck=new ACC(IDMtruck_v0,IDMtruck_T,IDM_s0,IDMtruck_a,IDM_b);
var LCModelCar=new MOBIL(MOBIL_bSafe, MOBIL_bSafeMax,
                         MOBIL_bThr, MOBIL_bBiasRight_car);
var LCModelTruck=new MOBIL(MOBIL_bSafe, MOBIL_bSafeMax,
                           MOBIL_bThr, MOBIL_bBiasRight_truck);
var LCModelMandatoryRight=new MOBIL(MOBIL_mandat_bSafe, MOBIL_mandat_bSafeMax,
                                    MOBIL_mandat_bThr, MOBIL_mandat_biasRight);
var LCModelMandatoryLeft=new MOBIL(MOBIL_mandat_bSafe, MOBIL_mandat_bSafeMax,
                                    MOBIL_mandat_bThr, -MOBIL_mandat_biasRight);


 

//#############################################################
// graphical settings/variables
//#############################################################

// get overall dimensions from parent html page => canvas.width,canvas.height
// and graphics context

var simDivWindow=document.getElementById("contents");
var canvas = document.getElementById("canvas_coffeeGame");
var ctx = canvas.getContext("2d"); // graphics contextdefines canvas.width,canvas.height
 

var hasChanged=true; // whether window dimensions has changed (resp. design)

var drawBackground=true; // if false, default unicolor background
var drawRoad=true; // if false, only vehicles are drawn

var vmin=0; // min speed for speed colormap (drawn in red)
var vmax=140/3.6; // max speed for speed colormap (drawn in blue-violet)



// actual mouse position (calculated in myMouseMoveHandler(e))

var xMouseCanvas; 
var yMouseCanvas;


//#############################################################
// physical geometry settings [m]
//#############################################################

var sizeBgPhys=1.2*sizePhys;  // physical length [m] of the (square) bg image

// 'S'-shaped mainroad

var lenStraightBegin=150;
var lenCurve=200; // each of the left and right curve making up the 'S'
var lenStraightEnd=2050;
var maxAng=0.; // maximum angle of the S bend (if <0, mirrored 'S')

// for optical purposes both lanes and cars bigger than in reality

var nLanes=3;
var laneWidth=5;
var car_length=5; // car length in m (all dimensions overridden by ICmicro)
var car_width=3; // car width in m
var truck_length=15; // trucks
var truck_width=3; 

// derived quantities and functions

var noCurves=(Math.abs(maxAng)<0.001);
var lenMainroad=lenStraightBegin+2*lenCurve+lenStraightEnd;
var curvature=maxAng/lenCurve; // positive if first curve is left curve


// road geometry in physical coordinates 
// (norcmal CS, x=>toRght, y=>toTop )

var u1=lenStraightBegin;
var u2=lenStraightBegin+lenCurve;
var u3=lenStraightBegin+2*lenCurve;

// phys coords start road

var xBegin=0.7*sizePhys; // portrait with aspect ratio 6:10 
var yBegin=-sizePhys;    // road from -sizePhys to about lenMainroad-sizePhys

// phys coords begin first curve

var x1=xBegin;
var y1=yBegin+lenStraightBegin;

// phys coords center of 'S'

var x2=(noCurves) ? x1 : x1-(1-Math.cos(maxAng))/curvature;
var y2=(noCurves) ? y1+lenCurve : y1+Math.sin(maxAng)/curvature;

// phys coords end of 'S'

var x3=2*x2-x1; 
var y3=2*y2-y1;

function traj_x(u){ 
    var x=(noCurves||(u<u1)) 
	? xBegin : (u<u2)
	? x1-(1-Math.cos(maxAng*(u-u1)/(u2-u1)))/curvature : (u<u3)
	? x3+(1-Math.cos(maxAng*(u3-u)/(u3-u2)))/curvature : x3;
    return x;
}

function traj_y(u){ 

    var y=(noCurves||(u<u1))
	? yBegin + u : (u<u2)
	? y1+Math.sin(maxAng*(u-u1)/(u2-u1))/curvature : (u<u3)
	? y3-Math.sin(maxAng*(u3-u)/(u3-u2))/curvature : y3+u-u3;
    return y;
}
 






//#################################
// Background, road and vehicle images specification
//#################################

 
var background = new Image();
var carImg = new Image();
var truckImg = new Image();
var obstacleImg = new Image();
var roadImg = new Image();

//background.src ='figs/backgroundGrassTest.jpg';
background.src ='figs/backgroundGrass.jpg';

carImg.src='figs/blackCarCropped.gif';
truckImg.src='figs/truck1Small.png';
obstacleImg.src='figs/obstacleImg.png';

roadImg.src=
    (nLanes==1) ? 'figs/oneLaneRoadRealisticCropped.png' :
    (nLanes==2) ? 'figs/twoLanesRoadRealisticCropped.png' :
    'figs/threeLanesRoadRealisticCropped.png';



//###############################################################
// physical (m) road  specification and sim initialization
//###############################################################

// IDM_v0 etc and updateModels() with actions  "longModelCar=new ACC(..)" etc
// defined in gui.js


// initialize road with zero density as macroscopic initial condition 

var isRing=0;  // 0: false; 1: true
var roadIDmain=1;
var densityInit=0;
var speedInit=0; // not relevant since initially no vehicles
var truckFracInit=0; // not relevant since initially no vehicles

var mainroad=new road(roadIDmain,lenMainroad,laneWidth,nLanes,traj_x,traj_y, 
		      densityInit, speedInit,truckFracInit, isRing);
console.log("mainroad.egoVeh=",mainroad.egoVeh);



//#######################################################################
// create/generate/make coffeemeter 
//#######################################################################

// size of coffeemeter propto diam/dist*f 
// (f, shooting angle etc set internally)
// Note: pixel widths and heighs with shell cmd
// identify -verbose <imgfile> | grep Geometry 
// or in js with cupImgBack.naturalWidth,-Height

var cupImgBack = new Image(); // back part of coffeecup (drawn before surface)
var cupImgFront = new Image(); // front part of coffeecup (drawn after)
//cupImgBack.src='figs/emptycupOrig.jpg';
cupImgBack.src='figs/emptycupBack.jpg';
cupImgFront.src='figs/emptycupFront.png';

var xRelCoffee=0.18; // right position of cup center relative to canvas.width
var yRelCoffee=0.8;  // bottom position of cup center relative to canvas.height
var diam=0.18;       // cup and approx coffee surface diameter
var dist=1.5;        // viewing distance to coffeemeter 

var tau=3;             // relaxation time [s] of coffee surface oscillations
var angSurfSpill=0.2;  // angle [rad] where spilling begins
var evap=0.2;          // evap rate [rad/s] with rad=angle of spilled coffee
var coffeemeter=new Coffeemeter(cupImgBack,cupImgFront,
				diam,dist,xRelCoffee,yRelCoffee,
				tau,angSurfSpill,evap);


//#######################################################################
// create/generate/make control region for accelerating/steering 
// the ego vehicleby mouse movements
//#######################################################################

// myMouseMoveHandler(e):
// mouse pos for zero x,y acc of ego vehicle  relative to canvas 
// = e.offsetX/Y=e.clientX/Y-upper screen coord of canvas
// x=toRight (aLat),y=ahead (aLong)
     
var xRelZero=0.5; // zero steering at fraction xRelZero of canvas width
var yRelZero=0.5; // zero acceleration at frac yRelZero of canvas height
var xMouseCanvas; // calculated in myMouseMoveHandler(e)
var yMouseCanvas;
var egoControlRegion=new EgoControlRegion(xRelZero,yRelZero);

//#######################################################################
// create ego vehicle and associated coffeemeter dynamics
//#######################################################################

var egoVeh=new EgoVeh(ego_speedInit);



//#######################################################################
// create/generate/make speedometer
//#######################################################################

var speedoImg = new Image(); // speedometer w/o needle
speedoImg.src='figs/speedometer.jpg';

var xRelSpeedo=0.18;     // center of speedometer in units of canvas width
var yRelSpeedo=0.60;    // and height, respectively
var sizeRelSpeedo=0.24;  // in terms of min(canvas width,height)
var vmaxSpeedo=160/3.6; // max speed [m/s] for this particular speedoImg

var speedometer=new Speedometer(speedoImg,vmaxSpeedo,sizeRelSpeedo,
				xRelSpeedo,yRelSpeedo);




//##############################################################
// initialize simulation without completely new loading 
// (this would be window.location.href = "./coffeemeterGame.html";)
// thus saving all past global interactions such as changed parameters
//##############################################################

function init(){  
    time=0;
    itime=0;

    // specify surrounding traffic by 
    // microscopic init conditions (direct/deterministic
    // control possibility crucial for game!)
    // types: 0 translated into "car", 1 into "truck", 2 into "obstacle"

    var types  =[0,     1,    0,    0,    0,    0];
    var lengths=[6,    14,    5,    4,    5,    5];
    var widths =[2.5, 4.5,    3,  2.5,    3,    3];
    var longPos=[350, 300,  250,  230,  150,    0];
    var lanesReal=[1,   2,  1.1,    0,    0,    0];
    var speeds =[28,   22,   28,   44,   44,   44];

    // add obstacles (can extend arrays just by defining out-of-bounds
    // elements)

    var lenObstacles=[ 5.5,  5.5, 51,  5.5,  5.5];
    var wObstacles=  [   2,    3,    4,    3,    2];
    var uObstacles=  [ 595,  600,  650,  655,  660];
    var vObstacles=  [-0.3, -0.2, -0.1, -0.2, -0.3];

    var obstacleShift=200;
    for (var i=0; i<uObstacles.length; i++){uObstacles[i]+=obstacleShift;}



    var nveh=types.length;
    for (var i=0; i<uObstacles.length; i++){
	types[nveh+i]=2;
	lengths[nveh+i]=lenObstacles[i];
	widths[nveh+i]=wObstacles[i];
	longPos[nveh+i]=uObstacles[i];
	lanesReal[nveh+i]=vObstacles[i];
	speeds[nveh+i]=0;
    }



    // add ego vehicle (can extend arrays just by defining out-of-bounds
    // elements) 

    var iEgo=types.length;
    types[iEgo]=0;   //{car,truck,obstacle}
    lengths[iEgo]=car_length;
    widths[iEgo]=car_width;
    longPos[iEgo]=ego_uInit;
    lanesReal[iEgo]=ego_laneInit;
    speeds[iEgo]=ego_speedInit;


    // introduces external traffic and ego vehicle to the road's veh array 
    // and also provides the ego vehicle  as external reference

    mainroad.initializeMicro(types,lengths,widths,
			     longPos,lanesReal,speeds,iEgo);

    // add models to non-obstacles and non-ego vehicles:
    // common LC models for trucks,cars and individual CF models 

    var v0Left=160./3.6;
    var v0Middle=100./3.6;
    var v0Right=80./3.6;

    var TLeft=1.0
    var TMiddle=1.2;
    var TRight=1.8;

    for(var i=0; i<mainroad.veh.length; i++){
        if((mainroad.veh[i].type != "obstacle")
	   &&(mainroad.veh[i].id != 1)){// otherwise no models defined

            mainroad.veh[i].LCModel=(mainroad.veh[i].type == "car")
	        ? LCModelCar : LCModelTruck;
	    var v0=(mainroad.veh[i].lane==0) ? v0Left : 
		(mainroad.veh[i].lane==1) ? v0Middle : v0Right;
	    var T=(mainroad.veh[i].lane==0) ? TLeft : 
		(mainroad.veh[i].lane==1) ? TMiddle : TRight;
	    mainroad.veh[i].longModel=(mainroad.veh[i].type=="truck")
		? new ACC(IDMtruck_v0,IDMtruck_T,IDM_s0,IDMtruck_a,IDM_b)
		: new ACC(v0,T,IDM_s0,IDM_a,IDM_b);
        }

    }


    // defines interface to user and speedometer incl special model
    // ("new" is necessary), and  initializes/resets coffeemeter 

    egoVeh=new EgoVeh(ego_speedInit); 
    coffeemeter.setLevelSurface();

    // initializes/resets observer: road arc length uObs 
    // drawn at pixel coords (scale*xBegin, -scale*yBegin)

    uObs=mainroad.egoVeh.u-ego_yRelPosition*sizePhys; 

    //mainroad.writeVehiclesSimple();

}




//##################################################
function drawMovingBackground(uObs){
//##################################################

    var iLowerTile=Math.floor( (traj_y(uObs)-yBegin)/sizeBgPhys);
    var iLeftTile=Math.floor( (traj_x(uObs)-xBegin)/sizeBgPhys);

    var xLeftPix= scale*(iLeftTile*sizeBgPhys  + xBegin-traj_x(uObs));
    var yTopPix =-scale*(iLowerTile*sizeBgPhys + yBegin-traj_y(uObs));

    if(drawBackground&&(hasChanged||(itime<=2) || (itime==20) || relObserver 
			|| (!drawRoad))){

	var sizeScreenImg=scale*sizeBgPhys;
	
        // lower left tile
	ctx.setTransform(1,0,0,1,xLeftPix,yTopPix);
        ctx.drawImage(background,0,0,sizeScreenImg,sizeScreenImg);

        // upper left tile
	ctx.setTransform(1,0,0,1,xLeftPix,yTopPix-scale*sizeBgPhys);
        ctx.drawImage(background,0,0,sizeScreenImg,sizeScreenImg);

 
       // lower right tile
	ctx.setTransform(1,0,0,1,xLeftPix+scale*sizeBgPhys,yTopPix);
        ctx.drawImage(background,0,0,sizeScreenImg,sizeScreenImg);
 

        // upper right tile
	ctx.setTransform(1,0,0,1,xLeftPix+scale*sizeBgPhys,yTopPix-scale*sizeBgPhys);
        ctx.drawImage(background,0,0,sizeScreenImg,sizeScreenImg);
 
    }
    if(false){
	console.log(
	    "drawing moving background: traj_x(uObs)=",traj_x(uObs),
	    " traj_y(uObs)=",traj_y(uObs),
	    "\n  sizeBgPhys=",sizeBgPhys,
	    "\n  lower tile: j=",iLowerTile," yTopPix=",yTopPix,
	    "yTopPhys=",yTopPix/scale,
	    "\n  upper tile: j=",iLowerTile-1," yTopPix=",yTopPix-scale*sizeBgPhys,
	    "yTopPhys=",yTopPix/scale-sizeBgPhys
	   // "\nleft tile: i=",iLeftTile," xLeftPix=",xLeftPix,
	   // "\nright tile:      xLeftPix=",xLeftPix+scale*sizeBgPhys
	);
    }
}


//##################################################
function drawRuntimeVars(){
//##################################################

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

    
    var scaleStr="scale="+Math.round(10*scale)/10;
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
    
  
    // (6) draw the speed colormap

      drawColormap(0.86*canvas.width,
                   0.88*canvas.height,
                   0.1*canvas.width, 0.2*canvas.height,
		   vmin,vmax,0,100/3.6);

    // revert to neutral transformation at the end!
    ctx.setTransform(1,0,0,1,0,0); 
}


//##################################################
function respondToWindowChanges(){
//##################################################

    hasChanged=false;

    if (canvas.width!=simDivWindow.clientWidth){
	hasChanged=true;
	canvas.width  = simDivWindow.clientWidth;
    }
    if (canvas.height != simDivWindow.clientHeight){
	hasChanged=true;
        canvas.height  = simDivWindow.clientHeight;
    }

    if(hasChanged){
	scale=Math.min(canvas.height,canvas.width)/sizePhys;
	//scaleBg=scale*sizePhys/sizeBgPhys;
        if(true){
	  console.log("canvas has been resized: new dim ",
		      canvas.width,"X",canvas.height,
		      " sizePhys=",sizePhys," scale=",scale);
	}
    }
}




//#################################################################
function update(){
//#################################################################


    // update times

    time +=dt; // dt depends on timewarp slider (fps=const)
    itime++;
    uObs=mainroad.egoVeh.u-ego_yRelPosition*sizePhys;


    // !! update models =>mainroad.updateModelsOfAllVehicles 
    // replaced by direct individual specification at initialization

    //mainroad.updateModelsOfAllVehicles(longModelCar,longModelTruck,
//				       LCModelCar,LCModelTruck);

 
    // do central simulation update of vehicles

    mainroad.updateLastLCtimes(dt);
    mainroad.calcAccelerations(); 
    mainroad.updateEgoVeh(egoVeh); // egoVeh: updates aLong and all lat. stuff
    mainroad.changeLanes();         
    mainroad.updateSpeedPositions();
    mainroad.updateBCdown();
    mainroad.updateBCup(qIn,dt); // argument=total inflow


    // logging
    
    if(false){
	for (var iveh=0; iveh<mainroad.veh.length; iveh++){
	    if(mainroad.veh[iveh].type=="truck"){
		console.log("iveh=",iveh,
			    " LCmodel=",mainroad.veh[iveh].LCModel);
	    }
	}
    }

    if(true){
	for (var i=0; i<mainroad.nveh; i++){
	    if(mainroad.veh[i].speed<0){
		console.log("speed "+mainroad.veh[i].speed
			    +" of mainroad vehicle "
			    +i+" is negative!");
	    }
	}
    }

    egoVeh.update(canvas,egoControlRegion,isOutside,xMouseCanvas,yMouseCanvas);
    coffeemeter.updateSurface(egoVeh.aLat,egoVeh.aLong,dt);
    

}//update




//##################################################
function draw() {
//##################################################
    
    respondToWindowChanges();
    
    drawMovingBackground(uObs);

    var changedGeometry=hasChanged||(itime<=1)||true; 
    mainroad.draw(roadImg,scale,changedGeometry,
		  relObserver,uObs,xBegin,yBegin); //!!

    mainroad.updateOrientation(); //(for some reason, strange rotations at beginning)
    mainroad.drawVehicles(carImg,truckImg,obstacleImg,scale,
			  vmin, vmax,
                          0,lenMainroad,relObserver,uObs,xBegin,yBegin);
    displayEgoVehInfo();
    coffeemeter.draw(canvas);
    egoControlRegion.draw(canvas);
    speedometer.draw(canvas,egoVeh.vLong);

    drawRuntimeVars();
 
}




//##################################################
// Running function of the sim thread (triggered by setInterval)
//##################################################

function main_step() {
    draw();
    update();
}
 

//##################################################
// Actual start of the simulation thread 
// Notice: init() and setInterval(...) are the only top-level calls of the simulation
// top-level: called by "onload" event of js in webpage
//##################################################

init();
var myRun;
main_step();
//var myRun=setInterval(main_step, 1000/fps);

