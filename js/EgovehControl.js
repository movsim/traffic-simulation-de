
//#######################################################################
/** definition of ego vehicle as generic object function as road.js
 with interactive accelerating/steering aLong along the vehicle axis, aLat perp
to the right of vehicle  (not road!) axis: vLong=vAbs, vLat=0 if no sliding!
Notice that EgoVeh does *not* include logical coordinates, i.e., 
the accel and velocity components along (au,vu) and perpendicular to (vu,vv)
 the local road axis. This is all calculated in 
road.updateEgoVeh(externalEgoVeh) where externalEgoVeh is a member 
of this class

@param vLongInit: initial longitudinal speed (the ego vehicle is driving straight ahead)
@return: instance of an ego-vehicle
*/
//#######################################################################

function EgoVeh(vLongInit){
    this.vLong= vLongInit; // speed along vehicle axis 
    this.vLat=0;           // vLat always=0 if not sliding!
    this.aLong=0;  // acceleration along vehicle axis
    this.aLat=0;  // acceleration perp to veh axis (right=positive)

    this.driveAngle=0;  // =atan(vLat/vLong) only !=0 if isSliding=true
    this.isSliding=false; //driveAngle, sliding only relev. if latCtrlModel==2

    this.speed_v=0; // only relevant if this.latCtrlModel==0 or 1
    this.v=0;       // lateral pos only relev. if this.latCtrlModel==0 or 1

    // following are parameters of simplified ego model

    this.latCtrlModel=2; // 0=direct pos control, 1=speed ctrl; 2=steering
    this.vmax=190/3.6;   // maximum speed of ego vehicle
    this.bmax=9;  // max absolute acc (limit where sliding/ESP begins)
    this.amax=4;  // max long acceleration (if ego.vLong=0)

    this.sensLat0=0.2; // lat displacement sensitivity [1](latCtrlModel==0)
                       //  sensLat0=1 => vehicle follows lateral mouse 1:1
    this.sensLat1=20;  // max lateral speed [m/s] (latCtrlModel==1) 
                       // if mouse pointer at the boundaries of canvas
    this.vc=10;  // steering sensitivity [m/s] (latCtrlModel==2) 
                       // (the lower vc, the higher): 
                       // @vc, max steering (mouse pointer at canvas  
                       // boundaries) leads to |accLat|>bmax
}


// sets only speed (but not accelerations, for this use a new cstr

EgoVeh.prototype.setSpeedLong=function(vLong){this.vLong=vLong;}


//#######################################################################
/** updates long acceleration aLong [m/s^2] along veh axis,
            lateral acceleration perp to vehicle axis to the right, and
            driveAngle.

trajectory curvature [1/m] (=road + (u,v) curvature) propto steering angle

@param canvas: defines external framework: 
               no ctrl if mouse pointer outside canvas
@param scale: pixels/m
@param egoCtrlRegion: defines "bullet point" of zero acceleration/steering
@param isOutside: whether mouse pointer is outside of canvas 
                  (defined by myMouseOutHandler in the toplevel js)
@param xMouseCanvas:  mouse pointer pos relative to canvas, 0=left
@param yMouseCanvas:  mouse pointer pos relative to canvas, 0=top
@return: updates this.aLong, this.aLat, this.driveAngle
*/ 
//#######################################################################



EgoVeh.prototype.update=function(canvas,scale,egoCtrlRegion,isOutside,
				 xMouseCanvas,yMouseCanvas){

    // standard settings if mouse pointer outside of "control box"

    var xPixZero=egoCtrlRegion.xRelZero*canvas.width;
    var yPixZero=egoCtrlRegion.yRelZero*canvas.height;
    this.aLong=0;
    this.aLat=0;
 
    if(!isOutside){

    // longitudinal accelerations/decelerations along vehicle (not road!) axis!
    
        var isBraking=(yMouseCanvas-yPixZero>0);
        this.aLong=(isBraking)
	    ? - this.bmax*(yMouseCanvas-yPixZero) /(canvas.height-yPixZero)
	    : this.amax*(1-this.vLong/this.vmax) *(yPixZero-yMouseCanvas)/yPixZero;

        // latCtrlModel==0: lateral control by direct positioning

	if(this.latCtrlModel==0){
	    this.v=this.sensLat0*(xMouseCanvas-xPixZero)/scale;
            // !!! calculate speed_v, acc_v=aLat here
	}

        // latCtrlModel==1: lateral control by direct speed control

	if(this.latCtrlModel==1){
	    this.speed_v=this.sensLat1*(xMouseCanvas-xPixZero)
		/(canvas.width-xPixZero);
            // !!! calculate acc_v=aLat here
	}


        // latCtrlModel==2: lateral control by steering
        // lateral/steering accelerations perp to vehicle (not road!) axis:
	// curvature is controlled; 

	if(this.latCtrlModel==2){
	    var curv=this.bmax/Math.pow(this.vc,2)*(xMouseCanvas-xPixZero)
		/(canvas.width-xPixZero);
	    this.aLat=0.5*this.vLong*this.vLong*curv;
	}
    }

    // "ESP like" restrictions on accelerations 

    var accAbs=Math.sqrt(this.aLat*this.aLat+this.aLong*this.aLong);
    var factor=accAbs/this.bmax;
    if(factor>1){
	console.log("myMouseMoveHandler: vehicle is sliding!");
	curv /= factor; 
	this.aLong /=factor; 
	this.aLat /=factor; 
    }
 

    // update driving angle atan(vv/vu)
    // and speed components vu, vv in logical coordinates
    
    this.vLong+=this.aLong*dt; // in veh axis! (vLat always =0 w/o sliding)
    this.driveAngle=0; //!! sliding not yet implemented

    // don't drive backwards; further braking just keeps vehicle stopped

    if(this.vLong<0){ 
	this.vLong=0;
	this.aLong=0;
    }
 
    if(false){
      console.log("\n5:updateCoffeemeter:",
		" t=",parseFloat(time).toFixed(2),
		" this.aLat=",parseFloat(this.aLat).toFixed(2),
		" this.aLong=",parseFloat(this.aLong).toFixed(2),
		"\n this.driveAngle=",parseFloat(this.driveAngle).toFixed(2),
		" this.vLong=",parseFloat(this.vLong).toFixed(2)
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




