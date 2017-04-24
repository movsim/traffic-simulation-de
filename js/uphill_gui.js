//#############################################
// GUI: Only defines interface; actual start of sim thread in uphill.js
//#############################################

//#############################################
// ACHTUNG BUG bei DYN_WEB.Event.domReady( function()..)
// Auch wenn diese Fkt nicht aufgerufen wird, produziert sie extrem
// boesartige Fehler, wenn die entspr html Elemeente
// (z.B. <div id="track_density"><div id="valueField_density">)
// nicht defiiert sind: Dann DOS bei allen im gui.js NACHFOLGENDEN Slidern
// deshalb separate gui fuer jedes html noetig
// das generelle "gui.js" bietet Sammlung fuer alles und ist Referenz
// ACHTUNG weiterer BUG: die sliderWidth wird zwar optisch dem responsive
// design angepasst, der Knopf laesst sich aber immer bis zur anfaengl. Weite 
// bewegen, also nicht zum Ende bei Vergroesserung, 
// darueber hinaus bei Verkleinerung 
//#############################################


// geometry of sliders; only nonzero initialization; 
// will be overridden in update method of main js file if hasChanged=true

var sliderWidth=100; // max value reached if slider at sliderWidth


// controlled contents of sliders

var timewarpInit=8;
var timewarp=timewarpInit;
var timewarp_min=0.1;
var timewarp_max=20;


var truckFracInit=0.4;
var truckFrac=truckFracInit;
var truckFrac_min=0;
var truckFrac_max=0.5;

var qInInit=1900/3600; // total inflow [veh/s] 
var qIn=qInInit;
var qIn_min=0;
var qIn_max=3000/3600;

// car speedlimit (the same in normal and uphill sections)

var speedLInit=120/3.6; // speed limit for all vehicles 
var speedL=speedLInit;
var speedL_min=80/3.6;
var speedL_max=160/3.6;

// car desired speed (the same in normal and uphill sections)

var IDM_v0Init=130/3.6;
var IDM_v0=IDM_v0Init;
var IDM_v0_min=60/3.6;
var IDM_v0_max=180/3.6;

// truck maxSpeed uphill (formulate by v0, not speedlimit!)

var IDM_v0UpInit=25/3.6 
var IDM_v0Up=IDM_v0UpInit;
var IDM_v0Up_min=10./3.6
var IDM_v0Up_max=80./3.6

// whether truck overtaking ban active (button to be implemented) 

var overtakingBanInit=false;
var overtakingBan=overtakingBanInit;

var IDM_TInit=1.5; 
var IDM_T=IDM_TInit;
var IDM_T_min=0.6;
var IDM_T_max=3;

var IDM_aInit=1.5; 
var IDM_a=IDM_aInit;
var IDM_a_min=0.3;
var IDM_a_max=3;

// fixed values

var scale=2.4; // only initialization; controlled by responsive design
var IDM_s0=2;  // cars and trucks
var IDM_b=2;   // cars and trucks

var IDM_v0_truck=110/3.6; // higher than speedlimit: faster approach maxSpeed
var speedL_truck=80/3.6

var factor_a_truck=1.0; // not used actually; a_truck fixed
var factor_T_truck=1.2;

var MOBIL_bSafe=8; // was 12
var MOBIL_bSafeMax=16;
var MOBIL_bThr=0.1;
var MOBIL_bBiasRight_car=0.2; 
var MOBIL_bBiasRight_truck=0.5; 

var MOBIL_mandat_bSafe=6;
var MOBIL_mandat_bSafeMax=20;
var MOBIL_mandat_bThr=0;
var MOBIL_mandat_biasRight=20;



function updateModels(){

    // a_truck>=0.8 because otherwise no complete decelerarion in uphill

    var T_truck=factor_T_truck*IDM_T;
    var a_truck=1.1; 

    // var longModelCar etc defined (w/o value) in uphill.js 

    longModelCar=new ACC(IDM_v0,IDM_T,IDM_s0,IDM_a,IDM_b);
    longModelCar.speedlimit=speedL;
    longModelTruck=new ACC(IDM_v0_truck,T_truck,IDM_s0,a_truck,IDM_b);
    longModelTruck.speedlimit=speedL_truck;

    LCModelCar=new MOBIL(MOBIL_bSafe, MOBIL_bSafeMax, 
			 MOBIL_bThr, MOBIL_bBiasRight_car);
    LCModelTruck=new MOBIL(MOBIL_bSafe, MOBIL_bSafeMax,
			   MOBIL_bThr, MOBIL_bBiasRight_truck);

    // uphill section (no overtaking ban by default)

    longModelCarUphill=longModelCar;
    longModelTruckUphill=new ACC(IDM_v0Up,T_truck,IDM_s0,a_truck,IDM_b);
    LCModelCarUphill=LCModelCar;
    LCModelTruckUphill=LCModelTruck;
    LCModelTruckLCban=new MOBIL(MOBIL_mandat_bSafe, MOBIL_mandat_bSafeMax,
				MOBIL_mandat_bThr, MOBIL_mandat_biasRight);

}


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


//#########################################################
// Disturb button (triggered by "onclick" callback in html file)
//#########################################################

function disturbOneVehicle(relLocation,speedReduce){
    mainroad.disturbOneVehicle(relLocation,speedReduce);
}




//#############################################
// callback of "enforce Overtaking Ban"button
//#############################################

var banIsActive=false; // only initialization
var banButtonClicked=false; // only initialization

function toggleTruckOvertakingBan(){
    banButtonClicked=true; // everything needs to be redrawn
    if(banIsActive){
	banIsActive=false;
	document.getElementById('overtakingBan').innerHTML
	    ="Enforce Truck Overtaking Ban";
	LCModelTruckUphill=LCModelTruck;
    }
    else{
	banIsActive=true;
	document.getElementById('overtakingBan').innerHTML
	    ="Lift Truck Overtaking Ban";
	LCModelTruckUphill=LCModelTruckLCban;
    }
}




//#############################################
// Timewarp slider 
// names 'slider_timewarp' etc defined in html file 
// and formatted in sliders.css
//#############################################

DYN_WEB.Event.domReady( function() {
    var slider_timewarp 
        = new DYN_WEB.Slider('slider_timewarp', 'track_timewarp', 'h');

    // callback
    slider_timewarp.on_move = function(x,y) {// function (x) OK
        change_timewarp(x);
        document.getElementById('valueField_timewarp').innerHTML
           =parseFloat(get_timewarp(),10).toFixed(1)+" times";
        };
    }
);


// called when timewarp slider is moved
// xSlider goes from 0 to pixel length of slider

function change_timewarp(xSlider){
    timewarp=timewarp_min
	+(timewarp_max-timewarp_min)*xSlider/sliderWidth; 
    dt=timewarp/fps;
}
function get_timewarp(){return timewarp;}

// inverse function of change_timewarp; 
// timewarp displayed on html at start of html page

function change_timewarpSliderPos(x){ // callback action of slider movement
    var xSlider=sliderWidth 
	*(x-timewarp_min)/(timewarp_max-timewarp_min);
    document.getElementById('valueField_timewarp').innerHTML
           =parseFloat(x,10).toFixed(1)+" times";
}




//#############################################
// truck fraction slider
//#############################################

DYN_WEB.Event.domReady( function() {
    var slider_truckFrac 
        = new DYN_WEB.Slider('slider_truckFrac', 'track_truckFrac', 'h');
    slider_truckFrac.on_move = function(x,y) {
        change_truckFrac(x);
        document.getElementById('valueField_truckFrac').innerHTML
           =parseFloat(100*get_truckFrac(),10).toFixed(0)+" %";
        };
    }
);

function change_truckFrac(x){ // callback action of slider movement
    truckFrac=truckFrac_min
	+(truckFrac_max-truckFrac_min)*x/sliderWidth;
}

function get_truckFrac(){return truckFrac;}

function change_truckFracSliderPos(truckFrac){
    var x=sliderWidth
	*(truckFrac-truckFrac_min)/(truckFrac_max-truckFrac_min);
    document.getElementById('valueField_truckFrac').innerHTML
        =parseFloat(100*get_truckFrac(),10).toFixed(0)+" %";
}


//#############################################
// inflow slider (also check/update sliders.css!)
//#############################################

DYN_WEB.Event.domReady( function() {
    var slider_qIn 
        = new DYN_WEB.Slider('slider_qIn', 'track_qIn', 'h');
    slider_qIn.on_move = function(x,y) {
        change_qIn(x);
        document.getElementById('valueField_qIn').innerHTML
           =parseFloat(3600*get_qIn(),10).toFixed(0)+" veh/h";
        };
    }
);

function change_qIn(x){ // callback action of slider movement
    qIn=qIn_min +(qIn_max-qIn_min)*x/sliderWidth;
}

function get_qIn(){
    return qIn;
}

function change_qInSliderPos(qIn){
    var x=sliderWidth
	*(qIn-qIn_min)/(qIn_max-qIn_min);
    document.getElementById('valueField_qIn').innerHTML
        =parseFloat(3600*get_qIn(),10).toFixed(0)+" veh/h";
}


//#############################################
// speedlimit slider (also update sliders.css!)
//#############################################

DYN_WEB.Event.domReady( function() {
    var slider_speedL 
        = new DYN_WEB.Slider('slider_speedL', 'track_speedL', 'h');
    slider_speedL.on_move = function(x,y) {
        change_speedL(x);
        document.getElementById('valueField_speedL').innerHTML
           =parseFloat(3.6*get_speedL(),10).toFixed(0)+" km/h";
        };
    }
);

function change_speedL(x){ // callback action of slider movement
    speedL=speedL_min
	+(speedL_max-speedL_min)*x/sliderWidth;
    updateModels();

}

function get_speedL(){return speedL;}

function change_speedLSliderPos(speedL){
    var x=sliderWidth
	*(speedL-speedL_min)/(speedL_max-speedL_min);
    document.getElementById('valueField_speedL').innerHTML
        =parseFloat(3.6*get_speedL(),10).toFixed(0)+" km/h";
}



//#############################################
// truck uphill maxSpeed slider  (also update sliders.css!)
//#############################################

DYN_WEB.Event.domReady( function() {
    var slider_IDM_v0Up 
        = new DYN_WEB.Slider('slider_IDM_v0Up', 'track_IDM_v0Up', 'h');
    slider_IDM_v0Up.on_move = function(x,y) {
        change_IDM_v0Up(x);
        document.getElementById('valueField_IDM_v0Up').innerHTML
           =parseFloat(3.6*get_IDM_v0Up(),10).toFixed(0)+" km/h";
        };
    }
);

function change_IDM_v0Up(x){ // callback action of slider movement
    IDM_v0Up=IDM_v0Up_min
	+(IDM_v0Up_max-IDM_v0Up_min)*x/sliderWidth;
    updateModels();

}

function get_IDM_v0Up(){return IDM_v0Up;}

function change_IDM_v0UpSliderPos(IDM_v0Up){
    var x=sliderWidth
	*(IDM_v0Up-IDM_v0Up_min)/(IDM_v0Up_max-IDM_v0Up_min);
    document.getElementById('valueField_IDM_v0Up').innerHTML
        =parseFloat(3.6*get_IDM_v0Up(),10).toFixed(0)+" km/h";
}



//#############################################
// Slider for long Model parameters (also update sliders.css!)
//#############################################


DYN_WEB.Event.domReady( function() {
    var slider_IDM_v0 
        = new DYN_WEB.Slider('slider_IDM_v0', 'track_IDM_v0', 'h');
    slider_IDM_v0.on_move = function(x,y) {
        change_IDM_v0(x);
        document.getElementById('valueField_IDM_v0').innerHTML
           =parseFloat(3.6*get_IDM_v0(),10).toFixed(0)+" km/h";
        };
    }
);


function change_IDM_v0(x){ // callback action of slider movement
    IDM_v0=IDM_v0_min +(IDM_v0_max-IDM_v0_min)*x/sliderWidth; 
    updateModels();

}

function get_IDM_v0(){return IDM_v0;}

function change_IDM_v0SliderPos(IDM_v0){
    var x=sliderWidth
	*(IDM_v0-IDM_v0_min)/(IDM_v0_max-IDM_v0_min);
    document.getElementById('valueField_IDM_v0').innerHTML
           =parseFloat(3.6*IDM_v0,10).toFixed(0)+" km/h";
}


//#############################################
// Slider for IDM_T (also update sliders.css!)
//#############################################


DYN_WEB.Event.domReady( function() {
    var slider_IDM_T 
        = new DYN_WEB.Slider('slider_IDM_T', 'track_IDM_T', 'h');
    slider_IDM_T.on_move = function(x,y) {
        change_IDM_T(x);
        document.getElementById('valueField_IDM_T').innerHTML
           =parseFloat(get_IDM_T(),10).toFixed(1)+" s";
        };
    }
);


function change_IDM_T(x){ // callback action of slider movement
    IDM_T=IDM_T_min
	+(IDM_T_max-IDM_T_min)*x/sliderWidth; 
    updateModels();
}

function get_IDM_T(){return IDM_T;}

function change_IDM_TSliderPos(IDM_T){
    var x=sliderWidth
	*(IDM_T-IDM_T_min)/(IDM_T_max-IDM_T_min);
    document.getElementById('valueField_IDM_T').innerHTML
           =parseFloat(IDM_T,10).toFixed(1)+" s";
}

//#############################################
// Slider for IDM_s0 (also update sliders.css!)
//#############################################

/*
DYN_WEB.Event.domReady( function() {
    var slider_IDM_s0 
        = new DYN_WEB.Slider('slider_IDM_s0', 'track_IDM_s0', 'h');
    slider_IDM_s0.on_move = function(x,y) {
        change_IDM_s0(x);
        document.getElementById('valueField_IDM_s0').innerHTML
           =parseFloat(get_IDM_s0(),10).toFixed(1)+" m";
        };
    }
);


function change_IDM_s0(x){ // callback action of slider movement
    IDM_s0=IDM_s0_min
	+(IDM_s0_max-IDM_s0_min)*x/sliderWidth; 
    updateModels();
}

function get_IDM_s0(){return IDM_s0;}

function change_IDM_s0SliderPos(IDM_s0){
    var x=sliderWidth
	*(IDM_s0-IDM_s0_min)/(IDM_s0_max-IDM_s0_min);
    document.getElementById('valueField_IDM_s0').innerHTML
           =parseFloat(IDM_s0,10).toFixed(1)+" m";
}
*/

//#############################################
// Slider for IDM_a (also update sliders.css!)
//#############################################


DYN_WEB.Event.domReady( function() {
    var slider_IDM_a 
        = new DYN_WEB.Slider('slider_IDM_a', 'track_IDM_a', 'h');
    slider_IDM_a.on_move = function(x,y) {
        change_IDM_a(x);
        document.getElementById('valueField_IDM_a').innerHTML
           =parseFloat(get_IDM_a(),10).toFixed(1)+" m/s<sup>2</sup>";
        };
    }
);

function change_IDM_a(x){ // callback action of slider movement
    IDM_a=IDM_a_min
	+(IDM_a_max-IDM_a_min)*x/sliderWidth; 
    updateModels();
}

function get_IDM_a(){return IDM_a;}

function change_IDM_aSliderPos(IDM_a){
    var x=sliderWidth
	*(IDM_a-IDM_a_min)/(IDM_a_max-IDM_a_min);
    document.getElementById('valueField_IDM_a').innerHTML
           =parseFloat(IDM_a,10).toFixed(1)+" m/s<sup>2</sup>";
}


//#############################################
// Slider for IDM_b (also update sliders.css!)
//#############################################

/*
DYN_WEB.Event.domReady( function() {
    var slider_IDM_b 
        = new DYN_WEB.Slider('slider_IDM_b', 'track_IDM_b', 'h');
    slider_IDM_b.on_move = function(x,y) {
        change_IDM_b(x);
        document.getElementById('valueField_IDM_b').innerHTML
           =parseFloat(get_IDM_b(),10).toFixed(1)+" m/s<sup>2</sup>";
        };
    }
);

function change_IDM_b(x){ // callback action of slider movement
    IDM_b=IDM_b_min
	+(IDM_b_max-IDM_b_min)*x/sliderWidth; 
    updateModels();
}

function get_IDM_b(){return IDM_b;}

function change_IDM_bSliderPos(IDM_b){
    var x=sliderWidth
	*(IDM_b-IDM_b_min)/(IDM_b_max-IDM_b_min);
    document.getElementById('valueField_IDM_b').innerHTML
           =parseFloat(IDM_b,10).toFixed(1)+" m/s<sup>2</sup>";
}

*/

