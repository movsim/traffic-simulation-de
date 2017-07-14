//#############################################
// common GUI callbacks for the general control (buttons and sliders);
// actual start of sim thread in the main
// scenario file like ring.js, onramp.js
// common canvas-related callbacks (mouse, touch) in canvas_gui.js
//#############################################


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
 game callbacks 
#########################################################

at present only routing game for routing.js
*/

var nick="Voldemort";
function playRoutingGame(){
    isGame=true;
    time=0;
    itime=0;
    var nregular=mainroad.nRegularVehs();
    mainroad.removeRegularVehs();
    ramp.removeRegularVehs();
    $("#infotext").load("info/info_routingGame.html");
    nick = prompt("Please enter your nick", "Voldemort");
}

function updateRoutingGame(time){
    qIn=(time<30) ? 3600/3600 : 
	(time<50) ? 1800/3600 : 
	(time<60) ? 3600/3600 :
	(time<90) ? 2400/3600 : 0;
    slider_qIn.value=3600*qIn;
    slider_qInVal.innerHTML=3600*qIn+" veh/h";
}

function finishRoutingGame(){
    isGame=false;
    qIn=qInInit;
    var roundedTime=parseFloat(time).toFixed(1);
    var messageText=updateHighscores(nick,roundedTime,
				     "routingGame_Highscores");
    document.getElementById("infotext").innerHTML=messageText;
    console.log("Game finished in ",time," seconds!");
    myStartStopFunction(); // reset game
}


/*#########################################################
 implement highscore list
#########################################################

enabled by html5 localStorage functionality
*/



function updateHighscores(nickName,newScore,storageName){

    // test if functionality is available at all

    if (typeof(Storage) === "undefined") {
	console.log("html5 localStorage is not available on your device");
	return;
    }

    // test if there are already data in this localStorage 
    // and get them, if applicable 

    var scores =[];
    if(localStorage.storageName){
	scores = JSON.parse(localStorage.storageName);
    }

    // add new entry to scores array

    var date=new Date();
    var year=date.getFullYear();
    var month=date.getMonth(); if(month<10){month="0"+month;}
    var day=date.getDate(); if(day<10){day="0"+day;}
    var hours=date.getHours(); if(hours<10){hours="0"+hours;}
    var minutes=date.getMinutes(); if(minutes<10){minutes="0"+minutes;}
    var seconds=date.getSeconds(); if(seconds<10){seconds="0"+seconds;}

    var dateStr=year+"-"+month+"-"+day
	+" "+hours+":"+minutes+":"+seconds;

    scores.push({name:nickName,
		 score:newScore,
		 date:dateStr
		});

    scores.sort(function(a,b){return a.score < b.score});

    // save the updated highscore list and return string for html display 

    localStorage.storageName = JSON.stringify(scores);
 

    var str_highScores="<h1> Game Finished!</h1> Your time is "
	+newScore+" Seconds"
	+"<h2>Highscore list:</h2>"
	+"<table border=\"0\" cellspacing=\"1\" cellpadding=\"3\">"
	+"<tr><th> name</th><th>score [s]</th><th>time</th></tr>";

    for(var i=0; i<scores.length; i++){
	console.log("name:",scores[i].name,
		    " score:",scores[i].score,
		    " date:",scores[i].date);
	str_highScores += "<tr><td>"+scores[i].name+"</td>"
	    + "<td>"+scores[i].score+"</td>"
	    + "<td>"+scores[i].date+"</td></tr>"
    }
    str_highScores += "</table>";

    return str_highScores;
}


// manually delete highscores from disk; comment out in routing.js if online!

function deleteHighscores(storageName){
    if (typeof(Storage) === "undefined") {
	console.log("html5 localStorage is not available on your device");
	return;
    }
    var scores =[];
    if(localStorage.storageName){
	localStorage.storageName = JSON.stringify(scores);
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
var nLevels=5;
function showInfo(){ 
    var scenarioFile="info/info_"+scenarioString+".html";
    console.log("scenarioFile=",scenarioFile);
    //console.log("infoLevel=",infoLevel);

    if(infoLevel===0){$("#infotext").load("info/info_gui.html");}
    else if(infoLevel===1){$("#infotext").load(scenarioFile);}
    else if(infoLevel===2){$("#infotext").load("info/info_IDM.html");}
    else if(infoLevel===3){$("#infotext").load("info/info_MOBIL.html");}
    else if(infoLevel===4){$("#infotext").load("info/info_BC.html");}
    infoLevel++; infoLevel=(infoLevel%nLevels);
}


// w/o scrollTo, the page is not shown at top, even with html#name mechanism!

function showHTMLfile(htmlfile){
    $("#infotext").load(htmlfile);$("#infotext").scrollTop(0);
}

/*#########################################################
 lane add/subtract callbacks
#########################################################*/

var nLanesMin=1;
var nLanesMax=4; 

function addOneLane(){ 
    if(mainroad.nLanes<nLanesMax){
	userCanvasManip=true; // causes drawing background, resampling road
	mainroad.addOneLane();     // changes mainroad.nLanes
	nLanes_main++;             // needed for defining geometry
	roadImg1=roadImgs1[mainroad.nLanes-1];
	roadImg2=roadImgs2[mainroad.nLanes-1];

        // only ramp adapts to nLanes
	if(typeof ramp!=="undefined"){// ramp!==undefined => DOS!
	    ramp.gridTrajectories(trajRamp_x,trajRamp_y);
	}
	updateSim();
    }

    else{console.log("addOneLane(): maximum of ",nLanesMax,
		     " lanes reached!");}

    console.log("addOneLane: mainroad.nLanes=",mainroad.nLanes);
    if(mainroad.nLanes===nLanesMax){
	document.getElementById("lanePlusDiv").style.visibility="hidden";
    }
    if(mainroad.nLanes>nLanesMin){
        document.getElementById("laneMinusDiv").style.visibility="visible";
    }
}



function subtractOneLane(){ 
    if(mainroad.nLanes>nLanesMin){
	userCanvasManip=true;  // causes drawing background, resampling road
	mainroad.subtractOneLane(); // changes mainroad.nLanes
	nLanes_main--;             // needed for defining geometry
	roadImg1=roadImgs1[mainroad.nLanes-1];
	roadImg2=roadImgs2[mainroad.nLanes-1];

        // only ramp adapts to nLanes
	if(typeof ramp!=="undefined"){   // ramp!==undefined => DOS!
	    ramp.gridTrajectories(trajRamp_x,trajRamp_y);
	}
	updateSim();
    }

    else{console.log("subtractOneLane(): minimum of ",nLanesMax,
		     " lanes reached!");}

    console.log("subtractOneLane: mainroad.nLanes=",mainroad.nLanes);

    if(mainroad.nLanes===nLanesMin){
	document.getElementById("laneMinusDiv").style.visibility="hidden";
    }
    if(mainroad.nLanes<nLanesMax){
	console.log("in setting lanePlus visible!!!");
        document.getElementById("lanePlusDiv").style.visibility="visible";
    }

}



//#############################################
// callback of "enforce Overtaking Ban" button
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
// sliders
// names "slider_timewarp" etc defined in html file 
// and formatted in sliders.css
//#############################################


// timewarp slider

var timewarp=timewarpInit=8;
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

var qIn=qInInit=4/3.6;    // 1.0 total mainroad inflow [veh/s] 
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

var qOn=qOnInit=0.25; //  0.2total onramp inflow [veh/s] 
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

var truckFrac=truckFracInit=0.10; // 0.10
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

var density=densityInit=0.03; // 0.10
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



// offramp use fraction  slider

var fracOff=fracOffInit=0.25; 
var slider_fracOff, slider_fracOffVal;
if(document.getElementById("slider_fracOff")===null) 
    console.log("no fracOff slider");
else{
    slider_fracOff = document.getElementById("slider_fracOff");
    slider_fracOffVal = document.getElementById("slider_fracOffVal");
    slider_fracOff.value=100*fracOffInit;
    slider_fracOffVal.innerHTML=100*fracOffInit+"%";

    slider_fracOff.oninput = function() {
        slider_fracOffVal.innerHTML = this.value+"%";
        fracOff=parseFloat(this.value/100.);
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

var IDM_T=IDM_TInit=1.2; 
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

var IDM_a=IDM_aInit=0.3; 
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

var IDM_b=IDM_bInit=3; 
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


// speedlimit slider
// per default no speed limit (speedL used in updateModels())

var speedL=speedLInit=1000/3.6; 
var slider_speedL, slider_speedLVal;
if(document.getElementById("slider_speedL")===null) 
    console.log("no  speedL slider");
else{
    slider_speedL = document.getElementById("slider_speedL");
    slider_speedLVal = document.getElementById("slider_speedLVal");
    slider_speedL.value=3.6*speedLInit;
    slider_speedLVal.innerHTML=3.6*speedLInit+ " km/h";

    slider_speedL.oninput = function() {
        slider_speedLVal.innerHTML = this.value+" km/h";
        speedL=parseFloat(this.value/3.6);
        updateModels();
    }
}



// truck uphill steady-state maxSpeed slider

var IDM_v0Up=IDM_v0UpInit=1000/3.6; 
var slider_IDM_v0Up, slider_IDM_v0UpVal;
if(document.getElementById("slider_IDM_v0Up")===null) 
    console.log("no  IDM_v0Up slider");
else{
    slider_IDM_v0Up = document.getElementById("slider_IDM_v0Up");
    slider_IDM_v0UpVal = document.getElementById("slider_IDM_v0UpVal");
    slider_IDM_v0Up.value=3.6*IDM_v0UpInit;
    slider_IDM_v0UpVal.innerHTML=3.6*IDM_v0UpInit+ " km/h";

    slider_IDM_v0Up.oninput = function() {
        slider_IDM_v0UpVal.innerHTML = this.value+" km/h";
        IDM_v0Up=parseFloat(this.value/3.6);
        updateModels();
        updateModelsUphill();
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


// constant parameters and parameter-related constants

// speeL=car-speeL default set to infinity, ctrl by slider if applicable

speedL=1000/3.6; // already defined in the sliders above
var speedL_truck=80/3.6;  

var MOBIL_bSafe=4;     // bSafe if v to v0  (threshold, bias in sliders)
var MOBIL_bSafeMax=17; // bSafe if v to 0 //!! use it

var MOBIL_mandat_bSafe=42; // *mandat for addtl LCModelMandatoryRight/Left
var MOBIL_mandat_bThr=0;   // to be specified below
var MOBIL_mandat_bias=42;

// var dt_LC=4; // global duration dt_LC of a lane change now in paths.js


var factor_v0_truck=0.7;
var factor_a_truck=0.8;
var factor_T_truck=1.2;


function updateModels(){
    var v0_truck=Math.min(factor_v0_truck*IDM_v0, speedL_truck);
    var T_truck=factor_T_truck*IDM_T;
    var a_truck=factor_a_truck*IDM_a;

    //var longModelCar etc defined (w/o value) in onramp.js 
    // var MOBIL_bBiasRight and other MOBIL params defined in onramp.js 
    longModelCar=new ACC(IDM_v0,IDM_T,IDM_s0,IDM_a,IDM_b);
    longModelCar.speedlimit=speedL;
    longModelTruck=new ACC(v0_truck,T_truck,IDM_s0,a_truck,IDM_b);
    longModelTruck.speedlimit=Math.min(speedL, speedL_truck);
    LCModelCar=new MOBIL(MOBIL_bSafe, MOBIL_bSafeMax, 
                         MOBIL_bThr, MOBIL_bBiasRight_car);
    LCModelTruck=new MOBIL(MOBIL_bSafe, MOBIL_bSafeMax, 
			   MOBIL_bThr, MOBIL_bBiasRight_truck);
    LCModelMandatory=new MOBIL(MOBIL_mandat_bSafe, MOBIL_mandat_bSafe,
			       MOBIL_mandat_bThr, MOBIL_mandat_bias);

    console.log("control_gui.updateModels: LCModelMandatory=",LCModelMandatory," MOBIL_mandat_bias=",MOBIL_mandat_bias);


    //!!! check if better formulated w/o  explicit variants below
    // and discriminate in road. updateModelsOfAllVehicles

    //LCModelMandatoryRight=LCModelMandatory;
    //LCModelMandatoryLeft=new MOBIL(MOBIL_mandat_bSafe, MOBIL_mandat_bSafe, 
//				    MOBIL_mandat_bThr, -MOBIL_mandat_bias);

}



function updateModelsUphill(){

    // uphill section (no overtaking ban by default)

    var T_truck=factor_T_truck*IDM_T;
    var a_truck=factor_a_truck*IDM_a;

    longModelCarUphill=longModelCar;
    longModelTruckUphill=new ACC(IDM_v0Up,T_truck,IDM_s0,a_truck,IDM_b);
    LCModelCarUphill=LCModelCar;
    LCModelTruckUphill=LCModelTruck;
    LCModelTruckLCban=LCModelMandatory;
}

// example for changing sliders from standard init setting in gui
/*
IDM_T=IDM_TInit=0.5; 
slider_IDM_T.value=IDM_TInit;
slider_IDM_TVal.innerHTML=IDM_TInit+" s";
*/