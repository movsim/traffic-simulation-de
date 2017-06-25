//#############################################
// GUI: Only defines interface; actual start of sim thread in onramp.js
//#############################################

// controlled contents of sliders

var timewarpInit=8;
var timewarp=timewarpInit;

var scaleInit=2.3;  // pixel/m
var scale=scaleInit;


var densityInit=0.038;  // vehicles/m/lane
var density=densityInit;

var truckFracInit=0.04;
var truckFrac=truckFracInit;


var IDM_v0Init=30; 
var IDM_v0=IDM_v0Init;

var IDM_TInit=1.5; 
var IDM_T=IDM_TInit;

var IDM_s0Init=2; 
var IDM_s0=IDM_s0Init;

var IDM_aInit=0.3; 
var IDM_a=IDM_aInit;

var IDM_bInit=3;
var IDM_b=IDM_bInit;

//!!! new sliders

var MOBIL_bThrInit=0.4;
var MOBIL_bThr=MOBIL_bThrInit;

var MOBIL_bBiasRight_carInit=0.05;
var MOBIL_bBiasRight_car=MOBIL_bBiasRight_carInit;

var MOBIL_bBiasRight_truckInit=0.2;
var MOBIL_bBiasRight_truck=MOBIL_bBiasRight_truckInit;


// fixed

var speedlimit_truck=80/3.6
var factor_v0_truck=0.7;
var factor_a_truck=0.8;
var factor_T_truck=1.2;


function updateModels(){
    var v0_truck=Math.min(factor_v0_truck*IDM_v0, speedlimit_truck);
    var T_truck=factor_T_truck*IDM_T;
    var a_truck=factor_a_truck*IDM_a;

    //var longModelCar etc defined (w/o value) in onramp.js 
    // var MOBIL_bBiasRight and other MOBIL params defined in onramp.js 
    longModelCar=new ACC(IDM_v0,IDM_T,IDM_s0,IDM_a,IDM_b);
    longModelTruck=new ACC(v0_truck,T_truck,IDM_s0,a_truck,IDM_b);
    LCModelCar=new MOBIL(MOBIL_bSafe, MOBIL_bSafeMax,
			 MOBIL_bThr, MOBIL_bBiasRight_car);
    LCModelTruck=new MOBIL(MOBIL_bSafe, MOBIL_bSafeMax,
			   MOBIL_bThr, MOBIL_bBiasRight_truck);
}


//#########################################################
// Disturb button (triggered by "onclick" callback in html file)
//#########################################################

function disturbOneVehicle(relLocation,speedReduce){
    mainroad.disturbOneVehicle(relLocation,speedReduce);
}



//#########################################################
// Start/Stop button (triggered by "onclick" callback in html file)
//#########################################################


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
	//document.getElementById('startStop').innerHTML="Stop";
	document.getElementById('startStop').src="figs/buttonStop3_small.png";
	myRun=setInterval(main_loop, 1000/fps);
    }
    else{
	//document.getElementById('startStop').innerHTML="Resume";
	document.getElementById('startStop').src="figs/buttonGo_small.png";
	isStopped=true;
    }
    
}


//#############################################
// sliders
// names 'slider_timewarp' etc defined in html file 
// and formatted in sliders.css
//#############################################


// timewarp slider

var slider_timewarp = document.getElementById('slider_timewarp');
var slider_timewarpVal = document.getElementById("slider_timewarpVal");
slider_timewarp.value=timewarpInit;
slider_timewarpVal.innerHTML=timewarpInit;

slider_timewarp.oninput = function() {
    slider_timewarpVal.innerHTML = this.value;
    timewarp=parseFloat(this.value);
    dt=timewarp/fps;
}

// scale slider

/*
var slider_scale = document.getElementById('slider_scale');
var slider_scaleVal = document.getElementById("slider_scaleVal");
slider_scale.value=3600*scaleInit;
slider_scaleVal.innerHTML=3600*scaleInit;

slider_scale.oninput = function() {
    slider_scaleVal.innerHTML = this.value;
    scale=parseFloat(this.value/3600.);
}
*/


// density slider

var slider_density = document.getElementById('slider_density');
var slider_densityVal = document.getElementById("slider_densityVal");
slider_density.value=1000*densityInit;
slider_densityVal.innerHTML=1000*densityInit+"/km";

slider_density.oninput = function() {
    slider_densityVal.innerHTML = this.value+"/km";
    density=parseFloat(this.value/1000.);
}


// truck fraction slider

var slider_truckFrac = document.getElementById('slider_truckFrac');
var slider_truckFracVal = document.getElementById("slider_truckFracVal");
slider_truckFrac.value=100*truckFracInit;
slider_truckFracVal.innerHTML=100*truckFracInit+"%";

slider_truckFrac.oninput = function() {
    slider_truckFracVal.innerHTML = this.value+"%";
    truckFrac=parseFloat(this.value/100.);
}




//#############################################
// Slider for long Model parameters (also update sliders.css!)
//#############################################

// IDM_v0 slider

var slider_IDM_v0 = document.getElementById('slider_IDM_v0');
var slider_IDM_v0Val = document.getElementById("slider_IDM_v0Val");
slider_IDM_v0.value=3.6*IDM_v0Init;
slider_IDM_v0Val.innerHTML=3.6*IDM_v0Init+ " km/h";

slider_IDM_v0.oninput = function() {
    slider_IDM_v0Val.innerHTML = this.value+ " km/h";
    IDM_v0=parseFloat(this.value)/3.6;
    updateModels();
}

// IDM_T slider

var slider_IDM_T = document.getElementById('slider_IDM_T');
var slider_IDM_TVal = document.getElementById("slider_IDM_TVal");
slider_IDM_T.value=IDM_TInit;
slider_IDM_TVal.innerHTML=IDM_TInit+" s";

slider_IDM_T.oninput = function() {
    slider_IDM_TVal.innerHTML = this.value+" s";
    IDM_T=parseFloat(this.value);
    updateModels();
}

// IDM_s0 slider

var slider_IDM_s0 = document.getElementById('slider_IDM_s0');
var slider_IDM_s0Val = document.getElementById("slider_IDM_s0Val");
slider_IDM_s0.value=IDM_s0Init;
slider_IDM_s0Val.innerHTML=IDM_s0Init+" m";

slider_IDM_s0.oninput = function() {
    slider_IDM_s0Val.innerHTML = this.value+" m";
    IDM_s0=parseFloat(this.value);
    updateModels();
}


// IDM_a slider

var slider_IDM_a = document.getElementById('slider_IDM_a');
var slider_IDM_aVal = document.getElementById("slider_IDM_aVal");
slider_IDM_a.value=IDM_aInit;
slider_IDM_aVal.innerHTML=IDM_aInit+" m/s<sup>2</sup>";

slider_IDM_a.oninput = function() {
    slider_IDM_aVal.innerHTML = this.value+" m/s<sup>2</sup>";
    IDM_a=parseFloat(this.value);
    updateModels();
}

// IDM_b slider

var slider_IDM_b = document.getElementById('slider_IDM_b');
var slider_IDM_bVal = document.getElementById("slider_IDM_bVal");
slider_IDM_b.value=IDM_bInit;
slider_IDM_bVal.innerHTML=IDM_bInit+" m/s<sup>2</sup>";

slider_IDM_b.oninput = function() {
    slider_IDM_bVal.innerHTML = this.value+" m/s<sup>2</sup>";
    IDM_b=parseFloat(this.value);
    updateModels();
}



// MOBIL_bThr slider

var slider_MOBIL_bThr = document.getElementById('slider_MOBIL_bThr');
var slider_MOBIL_bThrVal = document.getElementById("slider_MOBIL_bThrVal");
slider_MOBIL_bThr.value=MOBIL_bThrInit;
slider_MOBIL_bThrVal.innerHTML=MOBIL_bThrInit+" m/s<sup>2</sup>";

slider_MOBIL_bThr.oninput = function() {
    slider_MOBIL_bThrVal.innerHTML = this.value+" m/s<sup>2</sup>";
    MOBIL_bThr=parseFloat(this.value);
    updateModels();
}


// MOBIL_bBiasRight_car slider

var slider_MOBIL_bBiasRight_car = document.getElementById('slider_MOBIL_bBiasRight_car');
var slider_MOBIL_bBiasRight_carVal = document.getElementById("slider_MOBIL_bBiasRight_carVal");
slider_MOBIL_bBiasRight_car.value=MOBIL_bBiasRight_carInit;
slider_MOBIL_bBiasRight_carVal.innerHTML=MOBIL_bBiasRight_carInit+" m/s<sup>2</sup>";

slider_MOBIL_bBiasRight_car.oninput = function() {
    slider_MOBIL_bBiasRight_carVal.innerHTML = this.value+" m/s<sup>2</sup>";
    MOBIL_bBiasRight_car=parseFloat(this.value);
    updateModels();
}



// MOBIL_bBiasRight_truck slider

var slider_MOBIL_bBiasRight_truck = document.getElementById('slider_MOBIL_bBiasRight_truck');
var slider_MOBIL_bBiasRight_truckVal = document.getElementById("slider_MOBIL_bBiasRight_truckVal");
slider_MOBIL_bBiasRight_truck.value=MOBIL_bBiasRight_truckInit;
slider_MOBIL_bBiasRight_truckVal.innerHTML=MOBIL_bBiasRight_truckInit+" m/s<sup>2</sup>";

slider_MOBIL_bBiasRight_truck.oninput = function() {
    slider_MOBIL_bBiasRight_truckVal.innerHTML = this.value+" m/s<sup>2</sup>";
    MOBIL_bBiasRight_truck=parseFloat(this.value);
    updateModels();
}


