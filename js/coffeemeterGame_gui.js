
//####################################################################
// gui
//####################################################################

var isStopped=true; // only initialization
var isOutside=true; // mouse pointer outside of sim canvas (only init)
var coordsText="";

function myRestartStopFunction(){
    console.log("Begin myRestartStopFunction: isStopped=",isStopped);
    clearInterval(myRun);
    init();
    if(false){
	isStopped=false;
	document.getElementById('startStopButton').innerHTML="Neues Spiel";
	myRun=setInterval(main_step, 1000/fps);
    }
    else{
	document.getElementById('startStopButton').innerHTML="";
	document.getElementById('mouseMoveDisplay').innerHTML
	    ="Gehen Sie mit der Maus zum schwarzen Punkt<br>"
	    +" und starten Sie mit Mausklick oder Tastendruck";
	isStopped=true;
	main_step();
    }
    console.log("end of myResumeStopFunction: isStopped=",isStopped);

}

    
function myResumeStopFunction(){ 

    clearInterval(myRun);
    if(isStopped){
	isStopped=false;
	document.getElementById('startStopButton').innerHTML="Neues Spiel";
	myRun=setInterval(main_step, 1000/fps);
    }
    else{
	document.getElementById('startStopButton').innerHTML="Neues Spiel";
	document.getElementById('mouseMoveDisplay').innerHTML
	    =coordsText+"<br>Weiter mit Mausklick oder Tastendruck";
	isStopped=true;
    }
    console.log("end of myResumeStopFunction: isStopped=",isStopped);

}

/* all the following DOS; luckily the global window.addEventListener works
document.getElementById("myCanvas").addEventListener("keyup",myCheckKeyUpC, true);
canvas.addEventListener("keyup",myCheckKeyUpC, true);
console.log("canvas=",canvas);

function myCheckKeyUpC(e) {
    console.log("key released over canvas: keyCode=",e.keyCode);
}
*/

window.addEventListener("keydown", checkKeyPressed, true);
window.addEventListener("keyup", myKeyUpHandler, true);
 
function checkKeyPressed(e) {
    console.log("key pressed: keyCode=",e.keyCode);
}

function myKeyUpHandler(e) {
    console.log("key released: keyCode=",e.keyCode);
    myResumeStopFunction();
}

// autom. called if mouse is moved inside canvas, 
// triggered by html attribute onmousemove
// !! even with header and canvas beginning at 100, we have
// canvas.offsetTop=0
// canvas.offsetY=undefined
// e.clientY=100+e.offsetY
// e.offsetY=canvas_y_coord
// => use e.offsetX/Y !!

function myMouseMoveHandler(e){ 
    isOutside=false;
    //xMouseCanvas=e.clientX - canvas.offsetLeft;
    //yMouseCanvas=e.clientY - canvas.offsetTop;
    xMouseCanvas=e.offsetX;
    yMouseCanvas=e.offsetY;
    if(false){
	console.log("xMouseCanvas,yMouseCanvas=(",
		    xMouseCanvas,",",yMouseCanvas,")",
		    " canvas.offsetTop=",canvas.offsetTop,
		    " canvas.offsetY=",canvas.offsetY,
		    " e.offsetY=",e.offsetY);
    }
}

// autom. called if mouse is moved outside of canvas, 
// triggered by html attribute onmouseout

function myMouseOutHandler(){ 
    isOutside=true;
}

function myClickHandler() {
    console.log("mouse clicked");
    myResumeStopFunction();
}


// displays dynamic variables in html DOM element "mouseMoveDisplay"

function displayEgoVehInfo(){

    coordsText="Zeit: "+parseFloat(time).toFixed(1)+" s"
	+" a<sub>long</sub>="+parseFloat(egoVeh.aLong).toFixed(1)+" m/s<sup>2</sup>"
	+" a<sub>lat</sub>="+parseFloat(egoVeh.aLat).toFixed(2)+" m/s<sup>2</sup>"
 	+" Richtung="+parseFloat(180/Math.PI*egoVeh.driveAngle).toFixed(0)+" Grad.";
    var displayText=coordsText;
    if(isStopped){displayText += "Weiter mit Mausklick oder Tastendruck";}
    else{displayText += "<br>Stop mit Mausklick oder Tastendruck";}
    if((!isStopped)&&isOutside){
	displayText="Ihre Maus ist au&szlig;erhalb der Simulation!";
    }
    if(itime<2){
	displayText="Gehen Sie mit der Maus zum schwarzen Punkt<br>"
	    +"und starten Sie mit Mausklick oder Tastendruck.<br>"
	    +" Beschleunigen, Bremsen und Lenken mit der Maus";
    }
    //console.log("after displayEgoVehInfo(): displayText=",displayText);
    document.getElementById("mouseMoveDisplay").innerHTML=displayText;
}


//#################################################################
// html5 sliders callback routines
//#################################################################

// html5 sliders initialized in html file by "value" field of html5 input tag
// oninput fires whenever value changed
// onchange fires whenever value changed and mouse drag button released
// slider*.value gives actual value (e.g. for use in html and sim js)


// sizePhys (=) slider

var slider_sizePhys = document.getElementById("slider_sizePhys");
var slider_sizePhysVal = document.getElementById("slider_sizePhysVal");
slider_sizePhys.oninput = function() {
    //console.log("in slider_sizePhys.oninput: this.value="
//		+ slider_sizePhys.value);
    slider_sizePhysVal.innerHTML = this.value;
    sizePhys=this.value;
    resize();
}

slider_sizePhysVal.innerHTML=slider_sizePhys.value;

