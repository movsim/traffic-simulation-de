//#############################################
// GUI: Only defines interface; actual start of sim thread in onramp.js
// canvas-related callbacks (mouse, touch) in common canvas_gui.js
//#############################################

// constants

var speedlimit_truck=80/3.6
var factor_v0_truck=0.7;
var factor_a_truck=0.8;
var factor_T_truck=1.2;



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

    //!!!
    if(isStopped){
	isStopped=false;
	document.getElementById("startStop").src="figs/buttonStop3_small.png";
	myRun=setInterval(main_loop, 1000/fps);
    }
    else{
	document.getElementById("startStop").src="figs/buttonGo_small.png";
	isStopped=true;
    }
}



/*#########################################################
 info button callback
#########################################################

jquery needed to fill div with external html (script in header)
$("#infotext") equals document.getElementById("infotext")
but document.getElementById("infotext").load("info_ring.html"); does not work
*/

var infoLevel=0;
var nLevels=4;
function showInfo(){ 
    console.log("infoLevel=",infoLevel);
    //var infopanel=document.getElementById("infotext");
    if(infoLevel===0){$("#infotext").load("info_gui.html");}
    else if(infoLevel===1){$("#infotext").load("info_onramp.html");}
    else if(infoLevel===2){$("#infotext").load("info_IDM.html");}
    else if(infoLevel===3){$("#infotext").load("info_MOBIL.html");}
    infoLevel++; infoLevel=(infoLevel%nLevels);
}




//#############################################
// sliders
// names "slider_timewarp" etc defined in html file 
// and formatted in sliders.css
//#############################################


// timewarp slider

var timewarp=timewarpInit=5;
var slider_timewarp,slider_timewarpVal;
if(document.getElementById("slider_timewarp")==null)
    console.log("no timewarp slider");
else{
    slider_timewarp = document.getElementById("slider_timewarp");
    slider_timewarpVal = document.getElementById("slider_timewarpVal");
    slider_timewarpVal.innerHTML=timewarpInit;
    slider_timewarp.value=timewarpInit;

    slider_timewarp.oninput = function() {
        slider_timewarpVal.innerHTML = this.value;
        timewarp=parseFloat(this.value);
        dt=timewarp/fps;
    }
}

// scale slider

var scale=scaleInit=2.3;  // pixel/m
var slider_scale,slider_scaleVal;
if(document.getElementById("slider_scale")===null) 
    console.log("no scale slider");
else{
    slider_scale= document.getElementById("slider_scale");
    slider_scaleVal = document.getElementById("slider_scaleVal");
    slider_scale.value=scaleInit;
    slider_scaleVal.innerHTML=scaleInit+" pix/m";

    slider_scale.oninput = function() {
        slider_scaleVal.innerHTML = this.value+" pix/m";
        scale=parseFloat(this.value);
    }
}


// inflow slider

var qIn=qInInit=1.0;    // 1.0 total mainroad inflow [veh/s] 
var slider_qIn,slider_qInVal;
if(document.getElementById("slider_qIn")===null) 
    console.log("no qIn slider");
else{
    slider_qIn= document.getElementById("slider_qIn");
    slider_qInVal = document.getElementById("slider_qInVal");
    slider_qIn.value=3600*qInInit;
    slider_qInVal.innerHTML=3600*qInInit+" veh/h";

    slider_qIn.oninput = function() {
        slider_qInVal.innerHTML = this.value+" veh/h";
        qIn=parseFloat(this.value/3600.);
    }
}


// ramp flow slider

var qOn=qOnInit=0.2; //  0.2total onramp inflow [veh/s] 
var slider_qOn,slider_qOnVal;
if(document.getElementById("slider_qOn")===null) 
    console.log("no qOn slider");
else{
    slider_qOn= document.getElementById("slider_qOn");
    slider_qOnVal = document.getElementById("slider_qOnVal");
    slider_qOn.value=3600*qOnInit;
    slider_qOnVal.innerHTML=3600*qOnInit+" veh/h";

    slider_qOn.oninput = function() {
        slider_qOnVal.innerHTML = this.value+" veh/h";
        qOn=parseFloat(this.value/3600.);
    }
}



// truck fraction slider

var truckFrac=truckFracInit=0.04; // 0.04
var slider_truckFrac, slider_truckFracVal;
if(document.getElementById("slider_truckFrac")===null) 
    console.log("no truckFrac slider");
else{
    slider_truckFrac = document.getElementById("slider_truckFrac");
    slider_truckFracVal = document.getElementById("slider_truckFracVal");
    slider_truckFrac.value=100*truckFracInit;
    slider_truckFracVal.innerHTML=100*truckFracInit+"%";

    slider_truckFrac.oninput = function() {
        slider_truckFracVal.innerHTML = this.value+"%";
        truckFrac=parseFloat(this.value/100.);
    }
}


// density slider

var density=densityInit=0.04; // 0.04
var slider_density, slider_densityVal;
if(document.getElementById("slider_density")===null) 
    console.log("no density slider");
else{
    slider_density = document.getElementById("slider_density");
    slider_densityVal = document.getElementById("slider_densityVal");
    slider_density.value=1000*densityInit;
    slider_densityVal.innerHTML=1000*densityInit+"/km";

    slider_density.oninput = function() {
        slider_densityVal.innerHTML = this.value+"/km";
        density=parseFloat(this.value/1000.);
    }
}





//############################################################
// Slider for long Model parameters
//############################################################


// IDM_v0 slider

var IDM_v0=IDM_v0Init=30; 
var slider_IDM_v0,slider_IDM_v0Val;
if(document.getElementById("slider_IDM_v0")===null) 
    console.log("no IDM_v0 slider");
else{
   slider_IDM_v0 = document.getElementById("slider_IDM_v0");
   slider_IDM_v0Val = document.getElementById("slider_IDM_v0Val");
   slider_IDM_v0.value=3.6*IDM_v0Init;
   slider_IDM_v0Val.innerHTML=3.6*IDM_v0Init+" km/h";
   slider_IDM_v0.oninput = function() {
       slider_IDM_v0Val.innerHTML = this.value+" km/h";
       IDM_v0=parseFloat(this.value)/3.6;
       updateModels();
   }
}


// IDM_T slider

var IDM_T=IDM_TInit=1.5; 
var slider_IDM_T,slider_IDM_TVal;
if(document.getElementById("slider_IDM_T")===null) 
    console.log("no IDM_T slider");
else{
   slider_IDM_T = document.getElementById("slider_IDM_T");
   slider_IDM_TVal = document.getElementById("slider_IDM_TVal");
   slider_IDM_T.value=IDM_TInit;
   slider_IDM_TVal.innerHTML=IDM_TInit+" s";
   slider_IDM_T.oninput = function() {
       slider_IDM_TVal.innerHTML = this.value+" s";
       IDM_T=parseFloat(this.value);
       updateModels();
   }
}



// IDM_s0 slider

var IDM_s0=IDM_s0Init=2; 
var slider_IDM_s0,slider_IDM_s0Val;
if(document.getElementById("slider_IDM_s0")===null) 
    console.log("no IDM_s0 slider");
else{
   slider_IDM_s0 = document.getElementById("slider_IDM_s0");
   slider_IDM_s0Val = document.getElementById("slider_IDM_s0Val");
   slider_IDM_s0.value=IDM_s0Init;
   slider_IDM_s0Val.innerHTML=IDM_s0Init+" m";
   slider_IDM_s0.oninput = function() {
       slider_IDM_s0Val.innerHTML = this.value+" m";
       IDM_s0=parseFloat(this.value);
       updateModels();
   }
}



// IDM_a slider

var IDM_a=IDM_aInit=0.4; 
var slider_IDM_a,slider_IDM_aVal;
if(document.getElementById("slider_IDM_a")===null) 
    console.log("no  IDM_a slider");
else{
    slider_IDM_a = document.getElementById("slider_IDM_a");
    slider_IDM_aVal = document.getElementById("slider_IDM_aVal");
    slider_IDM_a.value=IDM_aInit;
    slider_IDM_aVal.innerHTML=IDM_aInit+" m/s<sup>2</sup>";

    slider_IDM_a.oninput = function() {
        slider_IDM_aVal.innerHTML = this.value+" m/s<sup>2</sup>";
        IDM_a=parseFloat(this.value);
        updateModels();
    }
}

// IDM_b slider

var IDM_b=IDM_bInit=0.4; 
var slider_IDM_b,slider_IDM_bVal;
if(document.getElementById("slider_IDM_b")===null) 
    console.log("no  IDM_b slider");
else{
    slider_IDM_b = document.getElementById("slider_IDM_b");
    slider_IDM_bVal = document.getElementById("slider_IDM_bVal");
    slider_IDM_b.value=IDM_bInit;
    slider_IDM_bVal.innerHTML=IDM_bInit+" m/s<sup>2</sup>";

    slider_IDM_b.oninput = function() {
        slider_IDM_bVal.innerHTML = this.value+" m/s<sup>2</sup>";
        IDM_b=parseFloat(this.value);
        updateModels();
    }
}



//############################################################
// Slider for MOBIL parameters
//############################################################

// MOBIL_bThr slider

var MOBIL_bThr=MOBIL_bThrInit=0.4; 
var slider_MOBIL_bThr,slider_MOBIL_bThrVal;
if(document.getElementById("slider_MOBIL_bThr")===null) 
    console.log("no  MOBIL_bThr slider");
else{
    slider_MOBIL_bThr = document.getElementById("slider_MOBIL_bThr");
    slider_MOBIL_bThrVal = document.getElementById("slider_MOBIL_bThrVal");
    slider_MOBIL_bThr.value=MOBIL_bThrInit;
    slider_MOBIL_bThrVal.innerHTML=MOBIL_bThrInit+" m/s<sup>2</sup>";

    slider_MOBIL_bThr.oninput = function() {
        slider_MOBIL_bThrVal.innerHTML = this.value+" m/s<sup>2</sup>";
        MOBIL_bThr=parseFloat(this.value);
        updateModels();
    }
}

// MOBIL_bBiasRight_car slider

var MOBIL_bBiasRight_car=MOBIL_bBiasRight_carInit=0.05; 
var slider_MOBIL_bBiasRight_car,slider_MOBIL_bBiasRight_carVal;
if(document.getElementById("slider_MOBIL_bBiasRight_car")===null) 
    console.log("no  MOBIL_bBiasRight_car slider");
else{
    slider_MOBIL_bBiasRight_car 
	= document.getElementById("slider_MOBIL_bBiasRight_car");
    slider_MOBIL_bBiasRight_carVal 
	= document.getElementById("slider_MOBIL_bBiasRight_carVal");
    slider_MOBIL_bBiasRight_car.value=MOBIL_bBiasRight_carInit;
    slider_MOBIL_bBiasRight_carVal.innerHTML
	=MOBIL_bBiasRight_carInit+" m/s<sup>2</sup>";

    slider_MOBIL_bBiasRight_car.oninput = function() {
        slider_MOBIL_bBiasRight_carVal.innerHTML = this.value+" m/s<sup>2</sup>";
        MOBIL_bBiasRight_car=parseFloat(this.value);
        updateModels();
    }
}

// MOBIL_bBiasRight_truck slider

var MOBIL_bBiasRight_truck=MOBIL_bBiasRight_truckInit=0.2; 
var slider_MOBIL_bBiasRight_truck,slider_MOBIL_bBiasRight_truckVal;
if(document.getElementById("slider_MOBIL_bBiasRight_truck")===null) 
    console.log("no  MOBIL_bBiasRight_truck slider");
else{
    slider_MOBIL_bBiasRight_truck 
	=document.getElementById("slider_MOBIL_bBiasRight_truck");
    slider_MOBIL_bBiasRight_truckVal
	=document.getElementById("slider_MOBIL_bBiasRight_truckVal");
    slider_MOBIL_bBiasRight_truck.value=MOBIL_bBiasRight_truckInit;
    slider_MOBIL_bBiasRight_truckVal.innerHTML
	=MOBIL_bBiasRight_truckInit+" m/s<sup>2</sup>";

    slider_MOBIL_bBiasRight_truck.oninput = function() {
        slider_MOBIL_bBiasRight_truckVal.innerHTML = this.value+" m/s<sup>2</sup>";
        MOBIL_bBiasRight_truck=parseFloat(this.value);
        updateModels();
    }
}




//#########################################################
// helper function
//#########################################################

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






// example for changing sliders from standard init setting in gui
/*
IDM_T=IDM_TInit=0.5; 
slider_IDM_T.value=IDM_TInit;
slider_IDM_TVal.innerHTML=IDM_TInit+" s";
*/