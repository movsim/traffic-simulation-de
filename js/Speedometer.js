/** ####################################################################
speedometer display. Uses an external image of a speedometer without needle
and draws the needle/pointer according to the speed parameter
for other speedometer background images, the first 4 lines of the draw 
method need to be adapted

@param speedoImg:  image of a speedometer without needle
@param speedMax:   maximum speed on that speedometer image [m/s] (!)
@param sizeSpeedo: display size [Pix]
@param xPixSpeedo: speedometer center relative to canvas (0=left)
@param yPixSpeedo: speedometer center relative to canvas (0=top)

@return: instance of a graphical speedometer
####################################################################
*/

function Speedometer(speedoImg,speedMax,sizeSpeedo,
		     xPixSpeedo,yPixSpeedo){
    this.backgroundImg=speedoImg;
    this.speedMax=speedMax; // max speed [m/s] for this particular speedoImg
    this.xPix=xPixSpeedo;
    this.yPix=yPixSpeedo;
    this.wPix=speedoImg.naturalWidth;
    this.hPix=speedoImg.naturalHeight;
    this.scale=sizeSpeedo/Math.max(this.wPix,this.hPix);
    this.w=this.scale*this.wPix;
    this.h=this.scale*this.hPix;
    if(false){
	console.log("speedoImg.naturalWidth=",speedoImg.naturalWidth,
		    "speedoImg.naturalHeight=",speedoImg.naturalHeight);
    }
}

Speedometer.prototype.draw=function(canvas,vLong){

    ctx = canvas.getContext("2d");

    // settings that need to be adapted to the specific image 

    var yPivot=this.yPix+0.3*this.h; // pivot of speedoometer pointer
    var xPivot=this.xPix;
    var r=0.45*this.w;               // length pointer from pivot to tip
    var angZero=1.075*Math.PI;       // angle of pointer for zero km/h
    var angRate=-2*(angZero-0.5*Math.PI)/this.speedMax; // [rad/m/s]
 

    // draw speedometer w/o needle

    ctx.setTransform(1,0,0,1,this.xPix,this.yPix);
    ctx.drawImage(this.backgroundImg,-0.5*this.w, -0.5*this.h,this.w,this.h);

    // the needle (=filled triangle pointing to the left by default, ang=0)

    var xPivot=this.xPix;          // pivotal point [pix] of speedometer needle 
    var ang=angZero+angRate*vLong;
    //ang=0; // test
    var cos_ang=Math.cos(ang);
    var sin_ang=Math.sin(ang);
    ctx.setTransform(cos_ang,-sin_ang,+sin_ang,cos_ang,xPivot,yPivot);


    // draw needle

    ctx.fillStyle = "rgb(255,20,0)";
    ctx.beginPath();
    ctx.moveTo(-0.1*r,-0.1*r);
    ctx.lineTo(-0.1*r,+0.1*r);
    ctx.lineTo(r,0);
    ctx.fill();
    ctx.closePath();

    // draw pivot as black filled circle

    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.arc(0,0,0.05*r,
	    0*Math.PI, 2*Math.PI,true);
    ctx.fill();
    ctx.closePath();

    if(false){
	console.log("\nin Speedometer.draw(vLong):",
		    " vLong=",vLong,
		    " egoVeh.aLong=",egoVeh.aLong,
		    " xPivot=",xPivot,
		    " yPivot=",yPivot,
		    " r=",r);
    }

} 



