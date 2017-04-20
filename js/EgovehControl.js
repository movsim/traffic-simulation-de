
//#######################################################################
/** definition of ego vehicle as generic object function as road.js
 with interactive accelerating/steering aLong along the vehicle axis, aLat perp
to the right of vehicle  (not road!) axis: vLong=vAbs, vLat=0 if no sliding!
vu=velocity component along road (not vehicle!) axis
vv=velocity component to the right of road (not vehicle!) axis
driveAngle=angle between vehicle and road axis 
(positive if to right,otherwise too many sign confusione later on)
user interaction issues curv and aLong (curv>0 if to the right)
Notice that the x,y,u,v coordinates itself, incl init values, 
are provided by the simulation (also the speeds are only needed for the 
speedometer and for some sliding control)

@param vLongInit: initial longitudinal speed (the ego vehicle is driving straight ahead)
@return: instance of an ego-vehicle
*/
//#######################################################################

function EgoVeh(vLongInit){
    this.vLong= vLongInit; // speed along vehicle axis
    this.vu=vLongInit; // speed along road axis
    this.vv=0;  // speed transversal road axis (positive=toRight)
    this.aLong=0;  // acceleration along vehicle axis
    this.aLat=0;  // acceleration perp to veh axis (right=positive)
    this.driveAngle=0;  // =atan(vv/vu) if !isSliding
    this.vmax=190/3.6; // maximum speed of ego vehicle
    this.bmax=9;  // max absolute acc (limit where sliding/ESP begins)
    this.amax=4;  // max long acceleration (if ego.vLong=0)
    this.vc=25; // if vLong>vc, then steering can lead to accLat>bmax
    this.isSliding=false;
}




//#######################################################################
/** updates long acceleration aLong [m/s^2] along veh axis,
            lateral acceleration perp to vehicle axis to the right, and
            driveAngle.

trajectory curvature [1/m] (=road + (u,v) curvature) propto steering angle

@param egoCtrlRegion: defines "bullet point" of zero acceleration/steering
@param isOutside: whether mouse pointer is outside of canvas 
                  (defined by myMouseOutHandler in the toplevel js)
@param xMouseCanvas:  mouse pointer pos relative to canvas, 0=left
@param yMouseCanvas:  mouse pointer pos relative to canvas, 0=top
@return: updates this.aLong, this.aLat, this.vu, this.vv, this.driveAngle
*/ 
//#######################################################################



EgoVeh.prototype.update=function(canvas,egoCtrlRegion,isOutside,
				 xMouseCanvas,yMouseCanvas){

    // standard settings if mouse pointer outside of "control box"

    var xPixZero=egoCtrlRegion.xRelZero*canvas.width;
    var yPixZero=egoCtrlRegion.yRelZero*canvas.height;
    this.aLong=0;
    var curv=0; 
 
    if(!isOutside){

    // longitudinal accelerations/decelerations along vehicle (not road!) axis!
    
        var isBraking=(yMouseCanvas-yPixZero>0);
        this.aLong=(isBraking)
	    ? - this.bmax*(yMouseCanvas-yPixZero) /(canvas.height-yPixZero)
	    : this.amax*(1-this.vLong/this.vmax) *(yPixZero-yMouseCanvas)/yPixZero;

        // lateral/steering accelerations perp to vehicle (not road!) axis:
	// curvature is controlled; normalized such that
	// aLat=bmax at this.vLong=vc and maximum mouse distance xMouseCanvas=canvas.width

	curv=this.bmax/Math.pow(this.vc,2)*(xMouseCanvas-xPixZero)
	    /(canvas.width-xPixZero);
    }

    this.aLat=0.5*this.vLong*this.vLong*curv; // unrestr lateral (veh axis) acceleration
    var accAbs=Math.sqrt(this.aLat*this.aLat+this.aLong*this.aLong);
    var factor=accAbs/this.bmax;
    if(factor>1){
	console.log("myMouseMoveHandler: vehicle is sliding!");
	curv /= factor; // both lateral and long acceleration reduced "ESP like"
	this.aLong /=factor; 
	this.aLat /=factor; 
    }
 
    // update driving angle atan(vv/vu)
    // and speed components vu, vv in logical coordinates
    
    this.vLong+=this.aLong*dt; // in vehicle axis! (vLat always =0 w/o sliding)
    if(this.vLong<0){ // don't drive backwards; further braking just keeps stopped
	this.vLong=0;
	this.aLong=0;
    }
    this.driveAngle+=curv*this.vLong*dt;
    this.vu=this.vLong*Math.cos(this.driveAngle); // component along road axis
    this.vv=-this.vLong*Math.sin(this.driveAngle); // component perp to the right
 
    if(false){
      console.log("\n5:updateCoffeemeter:",
		" t=",parseFloat(time).toFixed(2),
		" this.aLat=",parseFloat(this.aLat).toFixed(2),
		" this.aLong=",parseFloat(this.aLong).toFixed(2),
		"\n this.driveAngle=",parseFloat(this.driveAngle).toFixed(2),
		" this.vLong=",parseFloat(this.vLong).toFixed(2),
		" this.vu=",parseFloat(this.vu).toFixed(2),
		" this.vv=",parseFloat(this.vv).toFixed(2)
		); 
    }
}



//####################################################################
// control region for accel/steering  as generic object function as road.js
//####################################################################

function EgoControlRegion(xRelZero,yRelZero){
    this.xRelZero=xRelZero; // mouse position for zero steering [canvas.width]
    this.yRelZero=yRelZero; // mouse position for zero acceleration [c.height]
}

EgoControlRegion.prototype.draw=function(canvas){

    var xPixZero=this.xRelZero*canvas.width;
    var yPixZero=this.yRelZero*canvas.height;
    ctx = canvas.getContext("2d");

    ctx.setTransform(1,0,0,1,0,0);
    ctx.beginPath();
    ctx.fillStyle="black";
    ctx.arc(xPixZero,yPixZero,0.01*canvas.width,
	    0*Math.PI, 2*Math.PI,true);
    ctx.fill();   
    ctx.closePath();
    ctx.font="15px Verdana";
    ctx.strokeStyle="red";
    ctx.strokeText( "accel zero at bullet point",
		    xPixZero+0.012*canvas.width, 
		    yPixZero+0.006*canvas.width);
}




