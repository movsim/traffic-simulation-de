//#############################################
// GUI: Only defines interface; actual start of sim thread in roadworks.js
//#############################################

//#############################################
// ACHTUNG BUG bei DYN_WEB.Event.domReady( function()..)
// Auch wenn diese Fkt nicht aufgerufen wird, produziert sie extrem
// boesartige Fehler, wenn die entspr html Elemeente
// (z.B. <div id="track_density"><div id="valueField_density">)
// nicht defiiert sind: Dann DOS bei allen im gui.js NACHFOLGENDEN Slidern
// deshalb separate gui fuer jedes html noetig
// das generelle "gui.js" bietet Sammlung fuer alles und ist Referenz
//#############################################

// geometry of sliders

var sliderWidth=151;


// controlled contents of sliders

var timewarpInit=8;
var timewarp=timewarpInit;
var timewarp_min=0.1;
var timewarp_max=20;

var scaleInit=2.4;  // pixel/m
var scale=scaleInit;
var scale_min=0.6;
var scale_max=5;

var truckFracInit=0.2;
var truckFrac=truckFracInit;
var truckFrac_min=0;
var truckFrac_max=0.5;

var qInInit=0.4; // total inflow [veh/s] 
var qIn=qInInit;
var qIn_min=0;
var qIn_max=0.7;

var speedLInit=80/3.6; // speed limit for all vehicles 
var speedL=speedLInit;
var speedL_min=80/3.6;
var speedL_max=160/3.6;


var IDM_v0Init=50; // max speed!
var IDM_v0=IDM_v0Init;
var IDM_v0_min=5;
var IDM_v0_max=50;


var IDM_TInit=1.5; 
var IDM_T=IDM_TInit;
var IDM_T_min=0.6;
var IDM_T_max=3;

var IDM_s0Init=2; 
var IDM_s0=IDM_s0Init;
var IDM_s0_min=0.5;
var IDM_s0_max=5;

var IDM_aInit=0.3; 
var IDM_a=IDM_aInit;
var IDM_a_min=0.3;
var IDM_a_max=3;

var IDM_bInit=3;
var IDM_b=IDM_bInit;
var IDM_b_min=0.5;
var IDM_b_max=5;

var speedL_truck=80/3.6
var factor_a_truck=1.0;
var factor_T_truck=1.0;

function updateModels(){
    var v0_truck=180/3.6;  // restricted by speedL_truck anyway; 
                           // set v0 > 80/3.6 to make them less sluggish
    var T_truck=factor_T_truck*IDM_T;
    var a_truck=factor_a_truck*IDM_a;

    //var longModelCar etc defined (w/o value) in roadworks.js 
    // var MOBIL_bBiasRight and other MOBIL params defined in roadworks.js 
    longModelCar=new ACC(IDM_v0,IDM_T,IDM_s0,IDM_a,IDM_b);
    longModelCar.speedlimit=speedL;
    longModelTruck=new ACC(v0_truck,T_truck,IDM_s0,a_truck,IDM_b);
    longModelTruck.speedlimit=Math.min(speedL, speedL_truck);
    LCModelCar=new MOBIL(MOBIL_bSafe, MOBIL_bSafeMax, 
			 MOBIL_bThr, MOBIL_bBiasRight_car);
    LCModelTruck=new MOBIL(MOBIL_bSafe, MOBIL_bSafeMax,
			   MOBIL_bThr, MOBIL_bBiasRight_truck);
}


// general info on threads:

// thread starts with "var myRun=init();" or "myRun=init();"
// in init() at end: setInterval(main_loop, 1000/fps);
// thread stops with "clearInterval(myRun);" 

//##################################################################################
// Start/Stop button (onclick callback "myStartStopFunction()" defined in html file)
//##################################################################################

// called when start button is pressed


// in any case need first to stop;
// otherwise multiple processes after clicking 2 times start
// define no "var myRun "; otherwise new local instance started
// whenever myRun is inited

var myRun;
var isStopped=false;

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




//#############################################
// Timewarp slider (names 'slider_timewarp' etc defined in html file)
// (also update sliders.css!)
//#############################################

DYN_WEB.Event.domReady( function() {
    var slider_timewarp 
        = new DYN_WEB.Slider('slider_timewarp', 'track_timewarp', 'h');
    slider_timewarp.on_move = function(x,y) {// function (x) OK
        change_timewarp(x);
        document.getElementById('valueField_timewarp').innerHTML
           =parseFloat(get_timewarp(),10).toFixed(1)+" times";
        };
    }
);


// timewarp_sliderWidth as in html:div#track_timewarp: width-height


// called when timewarp slider is moved
// slider x variable goes from 0 to pixel length of slider

function change_timewarp(xSlider){
    timewarp=timewarp_min
	+(timewarp_max-timewarp_min)*xSlider/sliderWidth; 
    dt=timewarp/fps;
}
function get_timewarp(){return timewarp;}

// inverse function of change_timewarp; 
// timewarp displayed on html at start of html page

function change_timewarpSliderPos(x){
    var xSlider=sliderWidth // how to use this var to externally set slider pos?
	*(x-timewarp_min)/(timewarp_max-timewarp_min);
    document.getElementById('valueField_timewarp').innerHTML
           =parseFloat(x,10).toFixed(1)+" times";
}




//#############################################
// truck fraction slider (also update sliders.css!)
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

function change_truckFrac(x){
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
// inflow slider (also update sliders.css!)
//#############################################

DYN_WEB.Event.domReady( function() {
    var slider_qIn 
        = new DYN_WEB.Slider('slider_qIn', 'track_qIn', 'h');
    slider_qIn.on_move = function(x,y) {
	//console.log("in slider_qIn.on_move(x,y), x="+x+" y="+y);
        change_qIn(x);
        document.getElementById('valueField_qIn').innerHTML
           =parseFloat(3600*get_qIn(),10).toFixed(0)+" veh/h";
        };
    }
);

function change_qIn(x){
    //console.log(" in change_qIn(x), x="+x);
    qIn=qIn_min
	+(qIn_max-qIn_min)*x/sliderWidth;
}

function get_qIn(){
    //console.log("in get_qIn()"); 
    return qIn;
}

function change_qInSliderPos(qIn){
    var x=sliderWidth
	*(qIn-qIn_min)/(qIn_max-qIn_min);
    //slider_qIn.on_move(x,0);
    //console.log("in change_qInSliderPos: qIn="+qIn+" x="+x);
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


function change_IDM_v0(x){
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


function change_IDM_T(x){
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


function change_IDM_s0(x){
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

function change_IDM_a(x){
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

function change_IDM_b(x){
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


