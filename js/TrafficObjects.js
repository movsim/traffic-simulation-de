
/*#############################################################
a set of traffic-related objects that can be dragged by the user 
from a "depot" to a network link (road) and back. 
Main component of this class is an array trafficObject[] 
of the traffic objects (traffObj=trafficObject[i]) 

* At present, there are three types of objects:

- obstacles        (traffObj.type=='obstacle')
- traffic lights   (traffObj.type=='trafficLight')
- speed limits     (traffObj.type=='speedLimit')


* Any object has two states:

- active: On the road; 
 
   - in case of obstacles or traffic lights (TLs), real or 
     virtual vehicle objects are added to the road at dropping time 

   - in case of speed limits, no new objects are generated but the vehicle's
     models are changed. In contrast to above, 
     this is timestep-, not event-oriented

   - in all cases, the visual appearance changes at dropping time: 
     a TL and a speed-limit sign become 2 TLs/signs on either road side
     plus a white line on the road, the obstacles are 
     aligned in the direction of the road axis

- passive: in the depot or dragged or zooming back


* The TL and speed limit objects also have values:
  
  - traffObj.value="red" or "green" (if traffObj.type==='trafficLight')
  - traffObj.value=limit_kmh !!! (if traffObj.type==='speedLimit')
  - traffObj.value="null" (if traffObj.type==='obstacle')


* The main unique component of the objects is its id. 
  In case of active TL or obstacle objects, 
  the id of the generated vehicle objects on the road are the same
  as that of the traffObj and in the range 50-199:

  special vehicles: id<200:
// id=1:                ego vehicle
// id=10,11, ..49       disturbed vehicles 
// id=50..99            special obstacles => generated veh.type="obstacle"
// id=100..149          traffic lights => generated veh.type="obstacle"
                        if >1 lane and TL red, 
                        several obstacles with the same id
// id=150..199          moveable speed limits (just formally, no virt vehs)
// id>=200:             normal vehicles and fixed (non-depot) obstacles


* The image files of the traffic objects should have canonical names 
  figs/<type>_<value>.png for objects with variable state, or 
  figs/<type>_<id>.png for fixed objects (obstacles)

  - trafficLight_red.png, trafficLight_green.png
  - speedLimit_00.svg (=no limit), speedLimit_10.png, speedLimit_20.png, ...
  - obstacle_50.png, obstacle_51.png, ...

  all image files should be in <htmlDir>/figs/
 
#############################################################
*/




/**
##########################################################
TrafficObjects object constructor
at the beginning, all objects are in the depot, i.e., outside of the roads
WATCH OUT: no overloading exists. For example of copy constructors, 
look for ".copy" in other js files
##########################################################

@param canvas:    needed to position the objects if outside the roads
@param nTL:       how many traffic lights 
@param nLimit:    how many speed limits (the rest nRow*nCol-nTL are obstacles)
@param xRelDepot: relative center x position[m] of depot (0=left, 1=right)
@param yRelDepot: relative center y position[m] of depot (0=bottom, 1=top)
@param nRow:      number of rows
@param nCol:      number of cols (nRow*nCol=#objects should be >=nTL+nLimit)
*/


function TrafficObjects(canvas, nTL,nLimit, xRelDepot,yRelDepot, nRow,nCol){

  this.nRow=nRow;
  this.nCol=nCol; 
  this.n=nRow*nCol;
  this.xRelDepot=xRelDepot;
  this.yRelDepot=yRelDepot;
  this.nTL=Math.min(nTL,this.n);
  this.nLimit=Math.min(nLimit, this.n-this.nTL);
  this.nObst=Math.max(0, this.n-nTL-nLimit); // nTL,nLimit, not this,nTL,...

  this.nObstMax=10;

  // fixed size variables

  this.gapRel=0.01;          // relative spacing (sizeCanvas)
  this.sizeRel=0.10;         // relative size of passive graphical objects
  this.active_scaleFact=1.0; // pixel size factor active/passive objects
                             // other than obstacles (phys length relevant)
  this.lenPhysObst=25;       // physical length[m] of active obstacles
                             // (drawn by the road.draw methods)
  this.wPhysObst=10;         // 1..1.5 times road.lanewidth

  
  // variable size variables (updated in this.calcDepotPositions)
  
  this.sizeCanvas=Math.min(canvas.width, canvas.height);
  this.wPix=this.sizeRel*this.sizeCanvas; // pixel size in depot 
  this.hPix=this.wPix;


  // create image repositories

  this.imgTLgreen = new Image();
  this.imgTLgreen.src="figs/trafficLight_green.png";
  this.imgTLred = new Image();
  this.imgTLred.src="figs/trafficLight_red.png";
  this.imgTyellow = new Image();
  this.imgTyellow.src="figs/trafficLight_yellow.png";

  this.imgSpeedlRepo = []; 
  for (var i_img=0; i_img<13; i_img++){
    this.imgSpeedlRepo[i_img]=new Image();
    this.imgSpeedlRepo[i_img].src = "figs/speedLimit"+(i_img)+"0svg.svg";
  }

  this.imgObstRepo = []; 
  for (var i=0; i<Math.min(this.nObst, this.nObstMax); i++){
    this.imgObstRepo[i].src = "obstacle_"+(50+i)+".png";
  }


  
  // create all instances of trafficObject[]

  this.trafficObject=[];
  var initSpeedInd={6,8,10,0,12,3,4,5,1,2}; // speed 60 km/h,80,100,free..
  for(var i=0; i<this.n; i++){

    var isTL=(i<this.nTL);
    var isSpeedl=(!isTL)&&(i<this.nTL+nLimit);
    var isObst=!(isTL||isSpeedl);

    var iSpeed=i-this.nTL;
    var iObst=i-this.nTL-this.nSpeedl;
    
 

    //#################################################################
    // central object this.obstTL[i]
    // obstacle/TL on road: isActive=true, u>=0,inDepot=isPicked=false 
    // object picked/dragged: isPicked=true, isActive=false=inDepot=false
    // object dropped on road => becomes active
    // object  dropped outside of road and not yet completely zoomed back =>
    // isPicked=isActive=inDepot=false
    //#################################################################

    this.trafficObject[i]={
      id:    (isTL) ? 100+i : (isSpeedl) ? 150+iSpeed : 50+iObst,
      type:  (isTL) ? "trafficLight" : (isSpeedl) ? "speedLimit" : "obstacle",
      image: (isTL) ? this.imgTLred : (isSpeedl)
	? imgSpeedlRepo[initSpeedInd[iSpeed]] : imgObstRepo[iObst],
      value: (isTL) ? "red" : (isObst) ? "null" : 10*initSpeedInd[iSpeed],
      isActive: false,
      inDepot:  true,
      isPicked: false,
      road: 'undefined', // only defined if isActive=true
      u: -1,             // physical long position [m] (<0 if !isActive)
      lane: -1,          // isActive: 0 to road.nLanes, !isActive: -1
      len: this.lenPhys, //[m], for drawing of active obj of type "obstacle"
      width: this.wPhys, //[m], about 1-1.5*road.lanewidth 
      xPix: 42,          // pixel positions to be calculated later
      yPix: 42,          // in calcDepotPositions
      xPixLight1: 42,    // pixel pos of more distant active TL/speedl img
      yPixLight1: 42,    // defined in draw(...)
      xPixLight2: 42,    // pixel pos of nearer active TL/speedl img
      yPixLight2: 42,
      xPixDepot: 42,     // xPix=xPixDepot if !isActive and 
      yPixDepot: 42      // graphics zoomed back to depot
    };

    if((trafficObject[i].type=="speedLimit") &&(trafficObject[i].value==0)){
      trafficObject[i].value=300; // no speedlimit if index 0->00 km/h
    }

    
  } // loop over elements

  this.calcDepotPositions(canvas); // sets pixel sizes, positions

    
  // logging


  if(true){
    console.log("TrafficObjects Cstr: this.nTL=",this.nTL);
    for(var i=0; i<this.n; i++){
      console.log("TrafficObjects cstr: i=",i,
		  " value=",this.obstTL[i].value,
		  " type=",this.obstTL[i].type,
		  " id=",this.obstTL[i].id,
		  " imgfile=",this.obstTL[i].image.src,
		  " isActive=",this.obstTL[i].isActive);
    }
    //a=giesskanne;

  }

} // end TrafficObjects Cstr


//######################################################################
// calculate depot positions (call at init and after each resize)
//######################################################################

TrafficObjects.prototype.calcDepotPositions=function(canvas){

  this.sizeCanvas=Math.min(canvas.width, canvas.height);
  this.wPix=this.sizeRel*this.sizeCanvas; // diameter [pix] of obstTL signs
  this.hPix=this.wPix;

  var gapPix=this.gapRel*this.sizeCanvas; // spacing in pixels
  var xPixDepotCenter=canvas.width*this.xRelDepot; 
  var yPixDepotCenter=canvas.height*(1-this.yRelDepot);


  for (var i=0; i<this.n; i++){
    var icol=i%this.nCol;
    var irow=Math.floor(i/this.nCol);
    this.obstTL[i].xPixDepot=xPixDepotCenter 
      + (this.wPix+gapPix)*(icol-0.5*(this.nCol-1));
    this.obstTL[i].yPixDepot=yPixDepotCenter 
      + (this.hPix+gapPix)*(irow-0.5*(this.nRow-1));
    if(this.obstTL[i].inDepot){
      this.obstTL[i].xPix=this.obstTL[i].xPixDepot;
      this.obstTL[i].yPix=this.obstTL[i].yPixDepot;
    }
  }
}


//######################################################################
// draw active and passive obstTLimit signs
// active: on road
// passive: zooming back or stationary in depot
//######################################################################


/**
@return draw into graphics context
*/


TrafficObjects.prototype.draw=function(){

  var active_drawTwoImgs=true; // if false, only one TL above road drawn
                             // (in any case, only one obstacle 
                             // on the dropped lane)
  var crossingLineWidth=1;   // stopping line of TL
  var wPixPassive=this.wPix;
  var hPixPassive=this.hPix;
  var wPixActive=this.active_scaleFact*wPixPassive;
  var hPixActive=this.active_scaleFact*hPixPassive;

  for (var i=0; i<this.obstTL.length; i++){
 


    // draw active traffic lights //!!! filter road, NO LONGER pass as arg!!
    // ===========================

    if((this.obstTL[i].isActive)&&(this.obstTL[i].type==="trafficLight")){

      var TL=this.obstTL[i];
      TL.image=(TL.value==="red") ? this.imgRepo[0] : this.imgRepo[1];
      var road=TL.road;

      // draw the stopping line 

      var crossingLineLength=road.nLanes*road.laneWidth;

      var xCenterPix=  scale*road.traj_x(TL.u);
      var yCenterPix= -scale*road.traj_y(TL.u); // minus!!
      var wPix=scale*crossingLineWidth;
      var lPix=scale*crossingLineLength;
      var phi=road.get_phi(TL.u);
      var cphi=Math.cos(phi);
      var sphi=Math.sin(phi);

      ctx.setTransform(cphi,-sphi,sphi,cphi,xCenterPix,yCenterPix);
      ctx.fillStyle="rgb(255,255,255)";
      ctx.fillRect(-0.5*wPix, -0.5*lPix, wPix, lPix);

      // draw the traffic light (pair) itself

      // left if cphi>0, right otherwise, so that sign always above road
      // nice side-effect if both signs drawn: nearer sign drawn later
      // =>correct occlusion effect
      
      var distCenter=0.5*crossingLineLength+0.6*road.laneWidth;
      var v=(cphi>0) ? -distCenter : distCenter; // [m]
      xPix=xCenterPix+scale*v*sphi;  // + left if cphi>0
      yPix=yCenterPix+scale*v*cphi;  // -*-=+
      ctx.setTransform(1,0,0,1,xPix,yPix);
      ctx.drawImage(TL.image,-0.5*wPixActive,
		    -hPixActive,wPixActive, hPixActive);
      TL.xPixLight1=xPix;                // save pixel positions 
      TL.yPixLight1=yPix-0.8*hPixActive; // of light centers for later picking
                                     

      if(active_drawTwoImgs){ // draw signs on both sides
	v*=-1;
        xPix=xCenterPix+scale*v*sphi;  // + left if cphi>0
        yPix=yCenterPix+scale*v*cphi;  // -*-=+
        ctx.setTransform(1,0,0,1,xPix,yPix);
        ctx.drawImage(TL.image,-0.5*wPixActive,
		      -hPixActive,wPixActive, hPixActive);
	TL.xPixLight2=xPix;         
	TL.yPixLight2=yPix-0.8*hPixActive;
      }

	
      if(false){
	console.log("TrafficObjects.draw active TL: i=",i,
		    " TL.u=",TL.u,
		    " TL.xPixLight1=",TL.xPixLight1,
		    " TL.yPixLight1=",TL.yPixLight1);
      }

    }// end draw active TL
    

    // draw active obstacles
    // ======================

    // =>!!! DONE by road.drawVehicle since active obstacles are road objects


    if((this.obstTL[i].isActive)&&(this.obstTL[i].type==="obstacle")){
      if(true){
        console.log("ObstacleDepot.draw:",
		    "  active obstacles drawn by the drawVehicle method of",
		    " road with ID", this.obstTL[i].road.roadID);
      }
    }


    // draw passive objects (in depot or zooming back)
    // ===============================================

    if(!this.obstTL[i].isActive){


      var obj=this.obstTL[i];

      if(false){
	console.log(
	  "in TrafficObjects.draw: i=",i,
	  " fname=",obj.image.src,
	  " xPix=",formd(obj.xPix),
	  " yPix=",formd(obj.yPix),
	  " wPixPassive=",formd(wPixPassive),
	  " hPixPassive=",formd(hPixPassive));
      }
      ctx.setTransform(1,0,0,1, obj.xPix,obj.yPix);
      ctx.drawImage(obj.image,-0.5*wPixPassive,-0.5*hPixPassive,
		    wPixPassive,hPixPassive);

   }
  }
} // draw


//######################################################################
// pick obstacleTL object in depot or on the road by user action
//######################################################################


/**
@param  xPixUser,yPixUser: the external pixel position
@param  distCrit:    only if the distance to the nearest sign
                     is less than distCrit [Pix], the operation is successful
@return [successFlag, thePickedSign]
*/


TrafficObjects.prototype.pickObject=function(xPixUser,yPixUser,distCritPix){
  var dist2_min=1e9;
  var dist2_crit=distCritPix*distCritPix;
  var i_opt=-1;
  for(var i=0; i<this.obstTL.length; i++){
    var dist2=Math.pow(xPixUser-this.obstTL[i].xPix,2)
      + Math.pow(yPixUser-this.obstTL[i].yPix,2);
    if(dist2<dist2_min){
      dist2_min=dist2;
      i_opt=i;
    }
  }

  var success=(dist2_min<dist2_crit);
  var obstTLreturn=(success) ? this.obstTL[i_opt] : 'null';
  if(true){
    console.log("\n\nTrafficObjects.pickObject:");
    if(success){
      console.log("  successfully picked object of type ",obstTLreturn.type,
		  " isActive=",obstTLreturn.isActive,
		  " xPixUser=",formd0(xPixUser)," yPixUser=",formd0(yPixUser),
		  " xPix=",formd0(this.obstTL[i_opt].xPix),
		  " yPix=",formd0(this.obstTL[i_opt].yPix),
		  "\n\n");
    }
    else{
      console.log("  no success", 
		  " nearest object has type", this.obstTL[i_opt].type,
		  " xPixUser=",formd0(xPixUser)," yPixUser=",formd0(yPixUser),
		  " xPix=",formd0(this.obstTL[i_opt].xPix),
		  " yPix=",formd0(this.obstTL[i_opt].yPix),
		  "\n\n");
    }
  }

  // deactivate in case the obstacleTL object was on the road

  if(success){obstTLreturn.isActive=false;} 

  
  return[success,obstTLreturn];
}
 

/**
#############################################################
(sep19) user-driven change of the state of traffic light by click on canvas
@return: success flag
#############################################################
*/

TrafficObjects.prototype.changeTrafficLightByUser=function(xPixUser, yPixUser){
    
  if(false){
    console.log("in TrafficObjects.changeTrafficLightByUser:",
		" xPixUser=",xPixUser," yPixUser=",yPixUser);
  }

  var refSizePix=Math.min(canvas.height,canvas.width);
  var distPixCrit=0.03*refSizePix;
  var success=false;
  var TL;
  for(var i=0; (!success)&&(i<this.obstTL.length); i++){
    if(this.obstTL[i].type==='trafficLight'){
      TL=this.obstTL[i];
      var dxPix1=xPixUser-TL.xPixLight1;
      var dyPix1=yPixUser-TL.yPixLight1;
      var dxPix2=xPixUser-TL.xPixLight2;
      var dyPix2=yPixUser-TL.yPixLight2;
      var distPix1=Math.sqrt(dxPix1*dxPix1+dyPix1*dyPix1);
      var distPix2=Math.sqrt(dxPix2*dxPix2+dyPix2*dyPix2);
      if(Math.min(distPix1,distPix2)<=distPixCrit){
	TL.value=(TL.value==='red') ? 'green' : 'red'; // toggle
	TL.road.changeTrafficLight(TL.id, TL.value); // transfer to road obj
	TL.image=(TL.value==='red') ? this.imgRepo[0] : this.imgRepo[1];
        success=true;
      }
      if(false){
        console.log(" i_obstTL=",i," TL=",TL,
		  " TL.xPixLight1=",TL.xPixLight1,
		  " distPix1=",distPix1,
		  " distPix2=",distPix2,
		  " distPixCrit=",distPixCrit,
		  " success=",success);
      }
    }
  }


  if(true){
    if(success){
      console.log("road.changeTrafficLightByUser: changed traffic light",
		  " to ",TL.value,
		  " at u=",TL.u," on road ID ",TL.road.roadID);
      TL.road.writeTrafficLights();
    }
    else{console.log("road.changeTrafficLightByUser: no success");}
  }
  return success;
}




/*####################################################################
bring back all dragged obstTL objects back to the depot 
if dropped too far from a road (object.isActive=false, obj.inDepot=false)
automatic action at every timestep w/o GUI interaction 
####################################################################*/


TrafficObjects.prototype.zoomBack=function(){
  var relDisplacementPerCall=0.02; // zooms back as attached to a rubber band
  var pixelsPerCall=relDisplacementPerCall*this.sizeCanvas;
  for(var i=0; i<this.obstTL.length; i++){
    var obj=this.obstTL[i];
    if((!obj.isActive)&&(!obj.inDepot)){
      userCanvasManip=true; 
      var dx=obj.xPixDepot-obj.xPix;
      var dy=obj.yPixDepot-obj.yPix;
      var dist=Math.sqrt(dx*dx+dy*dy);

      if(dist<pixelsPerCall){
	obj.xPix=obj.xPixDepot;
	obj.yPix=obj.yPixDepot;
	obj.inDepot=true;
      }
      else{
	obj.xPix += pixelsPerCall*dx/dist;
	obj.yPix += pixelsPerCall*dy/dist;
      }
      if(false){
        console.log("TrafficObjects.zoomBack: i=",i,
		    " obj.xPix=",obj.xPix,
		    " obj.xPix=",obj.xPix,
		    " this.obstTL[i].xPix=",this.obstTL[i].xPix);
      }
    }
  }
}


TrafficObjects.prototype.drag=function(xPixUser,yPixUser){
  console.log("in TrafficObjects.drag");
}


//################################################
// OLD BELOW

//######################################################################
// pick depot vehicles by user action
//######################################################################


/**
@param  xUser,yUser: the external physical position
@param  distCrit:    only if the distance to the nearest veh in the depot
                     is less than distCrit, the operation is successful
@return [successFlag, thePickedVeh]
*/


TrafficObjects.prototype.pickVehicleOld=function(xUser,yUser,distCrit){
    var dist2_min=1e9;
    var dist2_crit=distCrit*distCrit;
    var vehReturn
    var success=false;
    for(var i=0; i<this.obstTL.length; i++){
	if(this.obstTL[i].inDepot){
	    var dist2=Math.pow(xUser-this.obstTL[i].x,2)
		+ Math.pow(yUser-this.obstTL[i].y,2);
	    if( (dist2<dist2_crit) && (dist2<dist2_min)){
		success=true;
		dist2_min=dist2;
		vehReturn=this.obstTL[i];
	    }
	}
    }

    return[success,vehReturn]
}
 

/*####################################################################
bring back dragged vehicle to depot if dropped too far from a road
####################################################################*/


TrafficObjects.prototype.zoomBackVehicleOld=function(){
    var isActive=false;
    var displacementPerCall=10; // zooms back as attached to a rubber band
    for(var i=0; i<this.obstTL.length; i++){
	if(this.obstTL[i].inDepot){
	    var dx=this.obstTL[i].xDepot-this.obstTL[i].x;
	    var dy=this.obstTL[i].yDepot-this.obstTL[i].y;
	    var dist=Math.sqrt(dx*dx+dy*dy);
	    if(dist<displacementPerCall){
		this.obstTL[i].x=this.obstTL[i].xDepot;
		this.obstTL[i].y=this.obstTL[i].yDepot;
	    }
	    else{
		isActive=true; // need to zoom further back in next call
		this.obstTL[i].x += displacementPerCall*dx/dist;
		this.obstTL[i].y += displacementPerCall*dy/dist;
	    }
	}
    }
    return(isActive);
}


/**
#############################################################
(sep19) write out all objects 
if onlyTL exists and is true, write out only the TL objects
#############################################################
*/

TrafficObjects.prototype.writeObjects=function(onlyTL){
  var justTL=false;
  if(!(typeof onlyTL === 'undefined')){
    justTL=onlyTL;
  }

  console.log("in TrafficObjects.writeObjects, justTL=",justTL,":");
  for(var i=0; i<this.obstTL.length; i++){
    if((!justTL) || (this.obstTL[i].type==='trafficLight')){
      var obj=this.obstTL[i];
      console.log("  i=",i," roadID=",obj.road.roadID,
		  " u=", formd(obj.u),
		  " type=", obj.type,
		  " value=",obj.value,
		  " xPix=",formd0(obj.xPix),
		  " yPix=",formd0(obj.yPix),
		  " isActive=",obj.isActive,
		  " inDepot=",obj.inDepot,
		  " isPicked=",obj.isPicked
		 );
    }
  }
}

//######################################################################
// programmatically place/shift a traffic light onto a road
//######################################################################

/**
@param i: obstTL object to be activated = obstTL[i] (at time of calling)
@param targetRoad: road onto which the speed limit is positioned
@param u: longitudinal logical coordinate of this road

@return put the obstTL object onto road targetRoad at position u


*/

TrafficObjects.prototype.activateTrafficLight=function(i, targetRoad, u){
  if (i>=this.obstTL.length){
    console.log("error: cannot position an obstTLimit object with index",
		i," greater than the length ",this.obstTL.length,
		" of the obstTL[] array");
    return;
  }
  var TL=this.obstTL[i];
  if(!(TL.type==='trafficLight')){
    console.log("error: can only activate a depot object of type trafficLight");
    return;
  }
  TL.isActive=true;
  TL.road=targetRoad;
  TL.u=u;
  TL.inDepot=false;; 
  TL.isPicked=false;
  TL.isDragged=false;
  TL.xPix=targetRoad.get_xPix(u,0,scale); // scale global var
  TL.yPix=targetRoad.get_yPix(u,0,scale); 

  // propagate effect to vehicles: dropDepotObject(TL,u,v,img_red,img_green)

  targetRoad.dropDepotObject(TL,u,0,traffLightRedImg,traffLightGreenImg);

  if(true){
    console.log("programmatically set the traffic light ",i,
		" value ",TL.value," onto road ",TL.road.roadID,
	      " at position u=",TL.u);
  }
}

