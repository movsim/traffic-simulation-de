/** ####################################################################
speedometer display. Uses an external image of a speedometer without needle
and draws the needle/pointer according to the speed parameter
for other speedometer background images, the first 4 lines of the draw 
method after " settings that need to be adapted..." need to be changed

Positions and size relative to canvas.width, canvas.height, and
min(canvas.width, canvas.height), respectively. Since canvas not properly
defined at cstr time, the draw method gets the canvas and updates geoemtry

@param speedoImg:   image of a speedometer without needle
@param speedMax:    maximum speed on that speedometer image [m/s] (!)
@param sizeRel: rel display size in terms of min(canvas.width, canvas.height)
@param xRel:    speedometer center relative to canvas (0=left)
@param yRel:    speedometer center relative to canvas (0=top)

@return: instance of a graphical speedometer
####################################################################
*/

function Speedometer(speedoImg,speedMax,sizeRel,
		     xRel,yRel){
    this.backgroundImg=speedoImg;
    this.speedMax=speedMax; // max speed [m/s] for this particular speedoImg
    this.sizeRel=sizeRel;
    this.xRel=xRel;
    this.yRel=yRel;
    this.aspectImg=speedoImg.naturalWidth/speedoImg.naturalHeight;
    if(false){
	console.log(" speedoImg.naturalWidth=",speedoImg.naturalWidth,
		    " speedoImg.naturalHeight=",speedoImg.naturalHeight);
    }
}

//Speedometer.prototype.setSpeed(vLong){
Speedometer.prototype.draw=function(canvas,vLong){

    // scale speedometer such that the larger of the 
    // relations image edge/canvas edge = sizeRel

    var aspectCanvas=canvas.width/canvas.height;
    var ratio=this.aspectImg/aspectCanvas;

    // update geometry (relevant for first drawing and also after resizing)

    var xPix=this.xRel*canvas.width; // coordinates of speedo center
    var yPix=this.yRel*canvas.height;
    var wPix=Math.min(1.,ratio)* this.sizeRel * canvas.width;
    var hPix=wPix/this.aspectImg;

    if(false){
	console.log("Speedometer.draw: after update of geometry:");
	console.log(" xPix=",xPix," yPix=",yPix,
		    " wPix=",wPix," hPix=",hPix);
    }

    // settings that need to be adapted to the specific image 

    var xPivot=xPix;                 // pivot of speedoometer pointer
    var yPivot=yPix+0.3*hPix;
    var rPix=0.45*wPix;              // length pointer from pivot to tip
    var angZero=1.075*Math.PI;       // angle of pointer for zero km/h
    var angRate=-2*(angZero-0.5*Math.PI)/this.speedMax; // [rad/m/s]
 

    // draw speedometer w/o needle

    ctx = canvas.getContext("2d");

    ctx.setTransform(1,0,0,1,xPix,yPix);
    ctx.drawImage(this.backgroundImg,-0.5*wPix, -0.5*hPix,wPix,hPix);


    // the needle (=filled triangle pointing to the left by default, ang=0)

    var ang=angZero+angRate*vLong;
    var cos_ang=Math.cos(ang);
    var sin_ang=Math.sin(ang);
    ctx.setTransform(cos_ang,-sin_ang,+sin_ang,cos_ang,xPivot,yPivot);


    // draw needle

    ctx.fillStyle = "rgb(255,20,0)";
    ctx.beginPath();
    ctx.moveTo(-0.1*rPix,-0.1*rPix);
    ctx.lineTo(-0.1*rPix,+0.1*rPix);
    ctx.lineTo(rPix,0);
    ctx.fill();
    ctx.closePath();

    // draw pivot as black filled circle

    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.arc(0,0,0.05*rPix,
	    0*Math.PI, 2*Math.PI,true);
    ctx.fill();
    ctx.closePath();

    if(false){
	console.log("\nin Speedometer.draw(vLong):",
		    " vLong=",vLong,
		    " egoVeh.aLong=",egoVeh.aLong,
		    " xPivot=",xPivot,
		    " yPivot=",yPivot,
		    " rPix=",rPix);
    }

} 



