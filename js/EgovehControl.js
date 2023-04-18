
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

    this.latCtrlModel=1; // 0=direct pos control, 1=speed ctrl; 2=steering

    // data members that are only relevant if this.latCtrlModel===2
    // curves in the road are considered in handling by road.js

    this.vLong=vLongInit; // speed along vehicle axis 
    this.vLat=0;           // vLat always=0 if not sliding!
    this.aLong=0;  // acceleration along vehicle axis
    this.aLat=0;  // acceleration perp to veh axis (right=positive)
    this.driveAngle=0;  // =atan(vLat/vLong) only !=0 if isSliding=true
    this.isSliding=false; //driveAngle, sliding only relev. if latCtrlModel===2

    // data memers that are only relevant if this.latCtrlModel===0 or 1 
    // only implemented if road has small curves (y approx u, |x|<<y)
    // => y(u,v)=u, x(u,v)=v+traj_x(u), control is w/respect to x,y

    //!! Watch OUT: Here, v and vv have physical units, in road: lane units

    this.vu=vLongInit; // speed along road axis [m/s]
    this.vv=0;         // speed perp to road axis [m/s], right=positive
    this.v=0;          // lateral pos [m] = distance to road axis

    this.vuOld=this.vu;
    this.vvOld=this.vv;
    this.vOld=this.v;

    // following are parameters of simplified ego model

    this.vmax_col=190/3.6;   // maximum speed of ego vehicle
    this.bmax=9;  // max absolute acc (limit where sliding/ESP begins)
    this.amax=4;  // max long acceleration (if ego.vLong=0)

    this.sensLat0=0.4; // lat displacement sensitivity [1](latCtrlModel===0)
                       //  sensLat0=1 => vehicle follows lateral mouse 1:1
    this.sensLat1=20;  // max lateral speed [m/s] (latCtrlModel===1) 
                       // if mouse pointer at the boundaries of canvas
    this.vc=10;        // steering sensitivity [m/s] (latCtrlModel===2) 
                       // (the lower vc, the higher): 
                       // @vc, max steering (mouse pointer at canvas  
                       // boundaries) leads to |accLat|>bmax
    this.tau_v=0.8;    // time scale exponential smoothing if latCtrlModel===0
    this.tau_vv=0.5;   // time scale exponential smoothing if latCtrlModel===1
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



EgoVeh.prototype.update=function(canvas,egoCtrlRegion,isOutside,
				 xMouseCanvas,yMouseCanvas,dt){

    // determine pixel bullet point relative to canvas

    var xPixZero=egoCtrlRegion.get_xPixZero(canvas);
    var yPixZero=egoCtrlRegion.get_yPixZero(canvas);

    // standard settings if mouse pointer outside of "control box"

    this.aLong=0;
    this.aLat=0;
 
    if(!isOutside){

       // longitudinal accelerations/decelerations along vehicle 
       // (not road!) axis. For all control models the same
    
        var isBraking=(yMouseCanvas-yPixZero>0);
        this.aLong=(isBraking)
	    ? - this.bmax*(yMouseCanvas-yPixZero) /(canvas.height-yPixZero)
	    : this.amax*(1-this.vLong/this.vmax_col)
	      * (yPixZero-yMouseCanvas)/yPixZero;

        // latCtrlModel===0: lateral control by direct positioning
        // zero value=center of left lane (lane 0)
        // exponential smoothing time constant tau_v

        // (if dt=const guarantieed, weighting value could be 
        // calculated at construction time)

	if(this.latCtrlModel===0){
	    var beta_v=1-Math.exp(-dt/this.tau_v); // weighting new v value
	    var vInst=this.sensLat0*(xMouseCanvas-xPixZero)/scale;
	    this.v=beta_v*vInst+(1-beta_v)*this.vOld;
	    this.vv=(this.v-this.vOld)/dt;
	    this.aLat=(this.vv-this.vvOld)/dt; // no road curves!
	    this.vOld=this.v;
	    this.vvOld=this.vv;
	}

        // latCtrlModel===1: lateral control by direct speed control
        // exponential smoothing time constant tau_vv

	if(this.latCtrlModel===1){
	    var beta_vv=1-Math.exp(-dt/this.tau_vv); // weighting new vv value
	    var vvInst=this.sensLat1*(xMouseCanvas-xPixZero)
		/(canvas.width-xPixZero);
	    this.vv=beta_vv*vvInst+(1-beta_vv)*this.vvOld;
	    this.aLat=(this.vv-this.vvOld)/dt; // no road curves!
	    this.v=this.vOld+.5*(this.vv+this.vvOld)*dt;
	    this.vOld=this.v;
	    this.vvOld=this.vv;
	}


        // latCtrlModel===2: lateral control by steering
        // lateral/steering accelerations perp to vehicle (not road!) axis:
	// curvature is controlled; 

	if(this.latCtrlModel===2){
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
	console.log("\nEgoVeh.update:",
		" t=",parseFloat(time).toFixed(2),
		" aLat=",parseFloat(this.aLat).toFixed(2),
		" aLong=",parseFloat(this.aLong).toFixed(2),
		" vLong=",parseFloat(this.vLong).toFixed(2)
		); 
	if(this.latCtrlModel<2){
	    console.log("               vv=",parseFloat(this.vv).toFixed(2),
			" vvOld=",parseFloat(this.vvOld).toFixed(2),
			" v=",parseFloat(this.v).toFixed(2),
			" vOld=",parseFloat(this.vOld).toFixed(2)
		       );
	}
    }
}



//####################################################################
// control region for accel/steering  as generic object function as road.js

// position of "bullet point" = mouse pos for zero x,y acc of ego vehicle:
// bulletPointFixed=true => rel pos (xRelZero,yRelZero)
// bulletPointFixed=false => bullet point at ego vehicle
//####################################################################

function EgoControlRegion(bulletPointFixed,xRelZero,yRelZero,ego_yRel){
    this.bulletPointFixed=bulletPointFixed;
    this.xRelZero=xRelZero; // fixed: mouse pos for zero steering (0=left,1=right)
    this.yRelZero=yRelZero; // fixed: mouse position for zero accel (0=bot,1=top)
    this.ego_yRel=ego_yRel; // rel position of ego vehicle 
}

EgoControlRegion.prototype.get_xPixZero=function(canvas){
    return (this.bulletPointFixed) ? this.xRelZero*canvas.width
	: this.xRelZero*canvas.width; // !!! not yet done for not fixed!
}

EgoControlRegion.prototype.get_yPixZero=function(canvas){
    return (this.bulletPointFixed) 
	? (1-this.yRelZero)*canvas.height
	: (1-this.ego_yRel)*canvas.height;
}



EgoControlRegion.prototype.draw=function(canvas){
    var xPixZero=this.get_xPixZero(canvas);
    var yPixZero=this.get_yPixZero(canvas);

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




