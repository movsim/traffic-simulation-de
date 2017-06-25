
/*#############################################################
depot of vehicle or obstacle images to be dragged to/from a road
 and converted in vehicles and back at dropping/lifting time. 

The images of the depot vehicles are given by the array obstacleImgs 
at construction time

The depot vehicle element has the same id 
in the range 50..99 as the generated vehicle. It is related to the
obstacle image number by 
Img-number=max(1,vehID%obstacleImgs.length)


// types: 0="car", 1="truck", 2="obstacle"
// id<100:              special vehicles
// id=1:                ego vehicle
// id=10,11, ..49       disturbed vehicles 
// id=50..99            depot vehicles/obstacles
// id>=100:             normal vehicles and obstacles

#############################################################*/


/**
##########################################################
vehicleDepot object constructor
##########################################################
@param nImgs:   how many images in draw cmd to assign 
                immutable image index at construction time
                (>=2 images for distinguishing virt veh from depot veh)
@param nveh:    number of depot vehicles (including that underway)
@param xDepot:  center x position[m] of depot (0=left)
@param yDepot:  center y position[m] of depot (0=top, <0 in canvas)

@param lVeh:    vehicle length[m]
@param wVeh:    vehicle width[m]
@param alignedHoriz: true if the vehicles are aligned horizontally
                     (i.e., vertically oriented)
*/



function vehicleDepot(nImgs,nveh,xDepot,yDepot,lVeh,wVeh,alignedHoriz){
    this.nveh=nveh; // generally not imageArray.length

    this.xDepot=xDepot;
    this.yDepot=yDepot;
    this.lVeh=lVeh;
    this.wVeh=wVeh;
    this.alignedHoriz=alignedHoriz;

    this.gapRel=-0.1; // lateral gap [veh width] between the vehicles in the depot

    // determine vehicle id and image number

    if(nImgs<2){console.log("vehicleDepot cstr: warning: useful is",
		    " an image array of length>=2"); }
    this.veh=[];
    var idmin=50; // see top of this file
    while(idmin%nImgs!=0){idmin++;}
    for(var i=0; i<nveh; i++){
	var imgNmbr=(nImgs==1) ? 0 : Math.max(1,i%nImgs);
	var latDistVeh=this.lVeh*(1+this.gapRel);
	var xVehDepot=this.xDepot+latDistVeh*(i+0.5*(1-this.nveh));
	var yVehDepot=this.yDepot;
	if(!this.alignedHoriz){ // veh aligned vertically
	    xVehDepot=this.xDepot;
	    yVehDepot=this.yDepot+latDistVeh*(i+0.5*(1-this.nveh));
	}
	this.veh[i]={id:        idmin+i, 
		     imgNumber: imgNmbr,
		     inDepot:   true,
		     x:         xVehDepot, 
		     y:         yVehDepot, 
		     xDepot:    xVehDepot, 
		     yDepot:    yVehDepot
		    };
	console.log("in vehicleDepot cstr: i=",i,
		    "\n   this.veh[i]=",this.veh[i]);
    }

}// end cstr


// update physical positions after resizing etc

/*vehicleDepot.prototype.setDepotPositions=function(canvas){
    this.xPixDepot=this.xDepot*canvas.width; // center of depot
    this.yPixDepot=(1-this.yDepot)*canvas.height;
    var smallerDim=Math.min(canvas.width,canvas.height);
    this.dxPix=(this.wVeh*(1+this.gapRel))*smallerDim;
    this.dyPix=this.dxPix;
    this.lPix=this.lVeh*smallerDim; // vehicle length in pixels
    this.wPix=this.wVeh*smallerDim;
}
*/


//######################################################################
// draw depot into canvas
//######################################################################

/**

@return draw into graphics context ctx (defined by canvas)
*/


vehicleDepot.prototype.draw=function(obstacleImgs,scale,canvas){
    ctx = canvas.getContext("2d");

    var lPix=scale*this.lVeh; // vehicle length in pixels
    var wPix=scale*this.wVeh;

    for (var i=0; i<this.nveh; i++){
	//console.log("i=",i," this.veh[i].inDepot=",this.veh[i].inDepot);
	if(this.veh[i].inDepot){
	    var nr=this.veh[i].imgNumber;
	    var xPixVeh=scale*this.veh[i].x;
	    var yPixVeh=-scale*this.veh[i].y;
	    ctx.setTransform(1,0,0,1,xPixVeh,yPixVeh);
	    if(false){console.log(
		"in vehicleDepot.draw: i=",i,
		" xPixVeh=",xPixVeh,
		" yPixVeh=",yPixVeh,
		" wPix=",lPix,
		" hPix=",wPix);
	    }
	    
	    ctx.drawImage(obstacleImgs[nr],-0.5*wPix, -0.5*lPix,
			  wPix, lPix);
	}
    }
}




