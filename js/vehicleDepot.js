
/*#############################################################
depot of vehicle or obstacle images to be dragged to/from a road
 and converted in vehicles and back at dropping/lifting time. 

The images of the depot vehicles are given by the array obstacleImgs 
at construction time

The depot vehicle element has the same id 
in the range 50..99 as the generated vehicle. It is related to the
obstacle image number by 
Img-number=max(1,vehID%obstacleImgs.length)


special vehicles:
// types: 0="car", 1="truck", 2="obstacle" (including red traffic lights)
// id's defined mainly in vehicle.js and vehicleDepot.js
// id<100:              special vehicles/road objects
// id=1:                ego vehicle
// id=10,11, ..49       disturbed vehicles 
// id=50..99            depot vehicles/obstacles
// id=100..199          traffic lights
// id>=200:             normal vehicles and obstacles

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



function vehicleDepot(nImgs,nveh,xDepot,yDepot,lVeh,wVeh,
		      alignedHoriz, containsObstacles){
    this.nveh=nveh; // generally not imageArray.length

    this.xDepot=xDepot;
    this.yDepot=yDepot;
    this.lVeh=lVeh;
    this.wVeh=wVeh;
    this.alignedHoriz=alignedHoriz;
    this.containsObstacles=containsObstacles;
    this.gapRel=-0.1; // lateral gap [veh width] between the vehicles in the depot

    // determine vehicle id and image number

    if(nImgs<2){console.log("vehicleDepot cstr: warning: useful is",
		    " an image array of length>=2"); }
    this.veh=[];
    var idmin=50; // see top of this file
    var idminTL=100; // see top of this file
    while(idmin%nImgs!=0){idmin++;}
    for(var i=0; i<nveh; i++){
	var imgNmbr=(nImgs===1) ? 0 : Math.max(1,i%nImgs);
	var latDistVeh=this.lVeh*(1+this.gapRel);
	var xVehDepot=this.xDepot+latDistVeh*(i+0.5*(1-this.nveh));
	var yVehDepot=this.yDepot;
	if(!this.alignedHoriz){ // veh aligned vertically
	    xVehDepot=this.xDepot;
	    yVehDepot=this.yDepot+latDistVeh*(i+0.5*(1-this.nveh));
	}
	this.veh[i]={id:        idmin+i, 
		     imgNumber: imgNmbr,
		     type:      (containsObstacles) ? "obstacle" : "car",
		     lVeh:      this.lVeh,
		     wVeh:      this.wVeh,
		     inDepot:   true,
		     x:         xVehDepot, 
		     y:         yVehDepot, 
		     xDepot:    xVehDepot, 
		     yDepot:    yVehDepot
		    };

        // ad hoc introduce 2 TL at the beginning (quick hack!!!)
	if(i<2){this.veh[i].id=100+i;}
    }

}// end cstr



//######################################################################
// draw depot into canvas
//######################################################################


/**
@param obstacleImgs: array of obstacle/construction/normal images to be drawn
@param scale: drPix/drPhys  [Pix/m]
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
		"in vehicleDepot.draw: i=",i,"imgNr=",nr,
		" img=",obstacleImgs[nr],
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



//######################################################################
// pick depot vehicles by user action
//######################################################################


/**
@param  xUser,yUser: the external physical position
@param  distCrit:    only if the distance to the nearest veh in the depot
                     is less than distCrit, the operation is successful
@return [successFlag, thePickedVeh]
*/


vehicleDepot.prototype.pickVehicle=function(xUser,yUser,distCrit){
    var dist2_min=1e9;
    var dist2_crit=distCrit*distCrit;
    var vehReturn
    var success=false;
    for(var i=0; i<this.veh.length; i++){
	if(this.veh[i].inDepot){
	    var dist2=Math.pow(xUser-this.veh[i].x,2)
		+ Math.pow(yUser-this.veh[i].y,2);
	    if( (dist2<dist2_crit) && (dist2<dist2_min)){
		success=true;
		dist2_min=dist2;
		vehReturn=this.veh[i];
	    }
	}
    }

    return[success,vehReturn]
}
 

/*####################################################################
bring back dragged vehicle to depot if dropped too far from a road
####################################################################*/


vehicleDepot.prototype.zoomBackVehicle=function(){
    var isActive=false;
    var displacementPerCall=10; // zooms back as attached to a rubber band
    for(var i=0; i<this.veh.length; i++){
	if(this.veh[i].inDepot){
	    var dx=this.veh[i].xDepot-this.veh[i].x;
	    var dy=this.veh[i].yDepot-this.veh[i].y;
	    var dist=Math.sqrt(dx*dx+dy*dy);
	    if(dist<displacementPerCall){
		this.veh[i].x=this.veh[i].xDepot;
		this.veh[i].y=this.veh[i].yDepot;
	    }
	    else{
		isActive=true; // need to zoom further back in next call
		this.veh[i].x += displacementPerCall*dx/dist;
		this.veh[i].y += displacementPerCall*dy/dist;
	    }
	}
    }
    return(isActive);
}