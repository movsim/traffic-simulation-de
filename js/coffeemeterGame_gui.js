//#############################################
// fixed settings which are GUI-sliders in the "normal" scenarios
//#############################################

var timewarp=2;
var scale=2.3;   // pixel/m probably overridden (check!)
var qIn=0;       // no additional vehicles

var IDM_v0=30;
var IDM_T=1.5; 
var IDM_s0=2; 
var IDM_a=1.0; 
var IDM_b=2;
var IDMtruck_v0=22.23;
var IDMtruck_T=2;
var IDMtruck_a=0.6;

var MOBIL_bSafe=4;    // bSafe if v to v0
var MOBIL_bSafeMax=17; // bSafe if v to 0
var MOBIL_bThr=0.1;
var MOBIL_bBiasRight_car=0.2;
var MOBIL_bBiasRight_truck=0.5;

var MOBIL_mandat_bSafe=6;
var MOBIL_mandat_bSafeMax=20;
var MOBIL_mandat_bThr=0;
var MOBIL_mandat_biasRight=20;

var longModelCar=new ACC(IDM_v0,IDM_T,IDM_s0,IDM_a,IDM_b);
var longModelTruck=new ACC(IDMtruck_v0,IDMtruck_T,IDM_s0,IDMtruck_a,IDM_b);
var LCModelCar=new MOBIL(MOBIL_bSafe, MOBIL_bSafeMax, 
                         MOBIL_bThr, MOBIL_bBiasRight_car);
var LCModelTruck=new MOBIL(MOBIL_bSafe, MOBIL_bSafeMax, 
			   MOBIL_bThr, MOBIL_bBiasRight_truck);
var LCModelMandatoryRight=new MOBIL(MOBIL_mandat_bSafe, MOBIL_mandat_bSafeMax, 
				    MOBIL_mandat_bThr, MOBIL_mandat_biasRight);
var LCModelMandatoryLeft=new MOBIL(MOBIL_mandat_bSafe, MOBIL_mandat_bSafeMax, 
				    MOBIL_mandat_bThr, -MOBIL_mandat_biasRight);



// general info on threads:

// thread starts with "var myRun=init();" or "myRun=init();"
// in init() at end: setInterval(main_loop, 1000/fps);
// thread stops with "clearInterval(myRun);" 


//################################################################
// Start/Stop button action (triggered by "onclick" callback in html file)
//#################################################################

// in any case need first to stop;
// otherwise multiple processes after clicking 2 times start
// define no "var myRun "; otherwise new local instance started
// whenever myRun is inited

var isStopped=false; // only initialization

function myStartStopFunction(){ 

    clearInterval(myRun);
    console.log("in myStartStopFunction: isStopped=",isStopped);

    if(isStopped){
	isStopped=false;
	document.getElementById('startStop').innerHTML="Stop";
	myRun=init();
    }
    else{
	document.getElementById('startStop').innerHTML="Resume";
	isStopped=true;
    }
}

