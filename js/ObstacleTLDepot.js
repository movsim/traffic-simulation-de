
/*#############################################################
depot of obstacle (or vehicle) images or traffic lights 
 to be dragged to/from a road
 and converted in vehicles and back at dropping/lifting time. 

The images of the depot vehicles are given by the array obstacleImgs 
at construction time

The depot vehicle element has the same id 
in the range 50..99 as the generated vehicle. It is related to the
obstacle image number by 
Img-number=max(1,vehID%obstacleImgs.length)


special vehicles: id<200:
// types: 0="car", 1="truck", 2="obstacle" (including red traffic lights)
// id's defined mainly in vehicle.js and ObstacleTLDepot.js
// id<100:              special vehicles/road objects
// id=1:                ego vehicle
// id=10,11, ..49       disturbed vehicles 
// id=50..99            depot vehicles/obstacles
// id=100..199          traffic lights
// id>=200:             normal vehicles and obstacles

#############################################################*/


/**
##########################################################
ObstacleTLDepot object constructor
at the beginning, all objects are in the depot, i.e., outside of the roads
WATCH OUT: no overloading exists. For example of copy constructors, 
look for ".copy" in othe rjs files
##########################################################

@param canvas:    needed to position the objects if outside the roads
@param nTL:       how many traffic lights 
                  (the rest nRow*nCol-nTL are obstacles)
@param nRow:      number of rows
@param nCol:      number of columns (nRow*nCol objects, generally !=nImgs
@param xRelDepot: relative center x position[m] of depot (0=left, 1=right)
@param yRelDepot: relative center y position[m] of depot (0=bottom, 1=top)
@param obstImgNames: string array of obstacle image file names 
                     (without path; all images should be in figs/)
                     (all obstacles behave the same, regardless of image)
*/


function ObstacleTLDepot(canvas,nRow,nCol,xRelDepot,yRelDepot,
			 nTL,obstImgNames){
//(nImgs,nRow,nCol,xDepot,yDepot,lVeh,wVeh,containsObstacles){

  this.nRow=nRow; // generally nRow*nCol != imageArray.length
  this.nCol=nCol; 
  this.n=nRow*nCol;
  this.xRelDepot=xRelDepot;
  this.yRelDepot=yRelDepot;
  this.nTL=nTL;

  // calculate pixel size variables (updated in this.calcDepotPositions)

  this.gapRel=0.01; // relative spacing (sizeCanvas)
  this.sizeRel=0.10; // relative size of passive graphical objects
  this.lenPhys=10; // [m] determines size of active graphical objects
  this.wPhys=7; // [m] 1..1.5 times road.lanewidth
  this.sizeCanvas=Math.min(canvas.width, canvas.height);
  this.wPix=this.sizeRel*this.sizeCanvas; // pixel size in depot 
  this.hPix=this.wPix;
  this.active_scaleFact=0.7; // pixel size factor active objects (on road) 


  // create image repository of traffic lights and obstacles
  // {red TL, green TL, obstacles}

  this.imgRepo = []; 
  var nameTLred="figs/trafficLightRed_affine.png";
  var nameTLgreen="figs/trafficLightGreen_affine.png";
  for (var i_img=0; i_img<2+obstImgNames.length; i_img++){
    this.imgRepo[i_img]=new Image();
  }

  this.imgRepo[0].src=nameTLred;
  this.imgRepo[1].src=nameTLgreen;
  for (var i_obst=0; i_obst<obstImgNames.length; i_obst++){
    this.imgRepo[2+i_obst].src = obstImgNames[i_obst];
  }


  // create all instances of TL and obstacle objects

  this.obstTL=[];
  var idmin=50;    // depotVeh/obstacle ids: 50-99, see top of this file
  var idminTL=100; // TL ids 100-199, see top of this file

  for(var i=0; i<this.n; i++){
    var jObst=i-this.nTL;

    // w/o black obstacle imgInd=0,1,3,4,..., ID=100,101,51,52,...

    var imgInd=(i<this.nTL) ? 0 : 3 + ((i-this.nTL)%obstImgNames.length);
    var ID=(i<this.nTL) ? idminTL+i : idmin+i+1-this.nTL;

    // with black obstacle imgInd=0,1,2,3,... ID=100,101,50,51,...
    // var imgInd=(i<this.nTL) ? 0 : 2 + ((i-this.nTL)%obstImgNames.length);
    // var ID=(i<this.nTL) ? idminTL+i : idmin+i-this.nTL;


    //#################################################################
    // central object this.obstTL[i]
    // obstacle/TL on road: isActive=true, u>=0,inDepot=isDragged=false 
    // object dragged: isDragged=true, isActive=false=inDepot=false
    // object dropped on road => becomes active
    // object  dropped outside of road and not yet completely zoomed back =>
    // isDragged=isActive=inDepot=false
    //#################################################################

    this.obstTL[i]={id:       ID,
		    image:    this.imgRepo[imgInd],
		    value:    (i<this.nTL) ? "red" : "n.a.",
		    type:     (i<this.nTL) ? "trafficLight" : "obstacle",
		    isActive: false,
		    inDepot:  true,
		    isDragged: false,
		    u: -1, // physical long position [m] (only init,
		           // >=0 if isActive, <0 if !isActive)
		    lane: -1, // isActive: 0 to road.nLanes, !isActive: -1
		    len: this.lenPhys,  //[m], for drawing of active obj.
		    width: this.wPhys, //[m], about 1-1.5*road.lanewidth 
		    xPix: 42, // pixel position of center (only init)
		    yPix: 42, // defined in calcDepotPositions
		    xPixDepot: 42, // xPix=xPixDepot if !isActive and 
		    yPixDepot: 42 // graphics zoomed back to depot
		   };
  } // loop over elements

  this.calcDepotPositions(canvas); // sets pixel sizes, positions

    
  // logging


  if(true){
    console.log("ObstacleTLDepot Cstr: this.nTL=",this.nTL);
    for(var i=0; i<this.n; i++){
      console.log("ObstacleTLDepot cstr: i=",i,
		  " value=",this.obstTL[i].value,
		  " type=",this.obstTL[i].type,
		  " id=",this.obstTL[i].id,
		  " imgfile=",this.obstTL[i].image.src,
		  " isActive=",this.obstTL[i].isActive);
    }
    //a=giesskanne;

  }

} // end ObstacleTLDepot Cstr


//######################################################################
// calculate depot positions (call at init and after each resize)
//######################################################################

ObstacleTLDepot.prototype.calcDepotPositions=function(canvas){

  this.sizeCanvas=Math.min(canvas.width, canvas.height);
  var gapPix=this.gapRel*this.sizeCanvas; // spacing in pixels
  var xPixDepotCenter=canvas.width*this.xRelDepot; 
  var yPixDepotCenter=canvas.height*(1-this.yRelDepot);

  this.wPix=this.sizeRel*this.sizeCanvas; // diameter [pix] of obstTL signs
  this.hPix=this.wPix;

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
@return draw into graphics context ctx (defined by canvas)
*/


ObstacleTLDepot.prototype.draw=function(canvas,road,scale){

  var active_drawTwoTL=true; // if false, only one TL above road drawn
                             // (in any case, only one obstacle 
                             // on the dropped lane)
  var crossingLineWidth=1;   // stopping line of TL
  ctx = canvas.getContext("2d");
  var wPixPassive=this.wPix;
  var hPixPassive=this.hPix;
  var wPixActive=this.active_scaleFact*wPixPassive;
  var hPixActive=this.active_scaleFact*hPixPassive;

  for (var i=0; i<this.obstTL.length; i++){
 

    // draw active traffic lights
    // ===========================

    if((this.obstTL[i].isActive)&&(this.obstTL[i].type==="trafficLight")){

      var TL=this.obstTL[i];
      TL.image=(TL.value==="red") ? this.imgRepo[0] : this.imgRepo[1];

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
      var xPix=xCenterPix+scale*v*sphi;  // + left if cphi>0
      var yPix=yCenterPix+scale*v*cphi;  // -*-=+
      ctx.setTransform(1,0,0,1,xPix,yPix);
      ctx.drawImage(TL.image,-0.5*wPixActive,
		    -hPixActive,wPixActive, hPixActive);

      if(active_drawTwoSigns){ // draw signs on both sides
	v*=-1;
        xPix=xCenterPix+scale*v*sphi;  // + left if cphi>0
        yPix=yCenterPix+scale*v*cphi;  // -*-=+
        ctx.setTransform(1,0,0,1,xPix,yPix);
        ctx.drawImage(TL.image,-0.5*wPixActive,
		      -hPixActive,wPixActive, hPixActive);
      }

	
      if(false){
	console.log("ObstacleTLDepot.draw active TL: i=",i,
		    " TL.u=",TL.u,
		    " xPix=",xPix,
		    " yPix=",yPix);
      }

    }// end draw active TL
    

    // draw active obstacles
    // ======================

    // =>!!! DONE by road.drawVehicle since active obstacles are road objects


    if((this.obstTL[i].isActive)&&(this.obstTL[i].type==="obstacle")){
      if(true){
        console.log("ObstacleDepot.draw:",
		    "  active obstacles drawn by road.drawVehicle");
      }
    }


    // draw passive objects (in depot or zooming back)
    // ===============================================

    if(!this.obstTL[i].isActive){


      var obj=this.obstTL[i];

      if(false){
	console.log(
	  "in ObstacleTLDepot.draw: i=",i,
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
@sidefeffect: thePickedSign.isActive is set to false
*/


ObstacleTLDepot.prototype.pickObject=function(xPixUser,yPixUser,distCrit){
  var dist2_min=1e9;
  var dist2_crit=distCrit*distCrit;
  var obstTLreturn=null;
  var success=false;
  for(var i=0; i<this.obstTL.length; i++){
    var dist2=Math.pow(xPixUser-this.obstTL[i].xPix,2)
      + Math.pow(yPixUser-this.obstTL[i].yPix,2);
    if( (dist2<dist2_crit) && (dist2<dist2_min)){
      success=true;
      dist2_min=dist2;
      obstTLreturn=this.obstTL[i];
    }
    if(false){
      console.log("ObstacleTLDepot: i=",i,
		  " kmh=",formd0(3.6*this.obstTL[i].value),
		  " u=",formd0(this.obstTL[i].u),
		  " uNearest=",formd0(mainroad.findNearestDistanceTo(xPixUser/scale,-yPixUser/scale)[1]),
		  " xPix=",formd0(this.obstTL[i].xPix),
		  " xPixUser=", formd0(xPixUser),
		  " yPix=",formd0(this.obstTL[i].yPix),
		  " yPixUser=", formd0(yPixUser),
		  " dist2=",formd0(dist2),
		  " dist2_crit=",formd0(dist2_crit),
		  " success=",success);
    }
  }

  if(true){
    var msg=(success)
      ? "successfully picked obstacleTLDepot obj id= "+obstTLreturn.id
      : "no sign picked";
    console.log("ObstacleTLDepot.pickObject: ",msg);
  }

  // deactivate in case the picked sign was on the road

  if(success){obstTLreturn.isActive=false;} 
 
  return[success,obstTLreturn];
}
 

/*####################################################################
bring back all dragged obstTL objects back to the depot 
if dropped too far from a road (object.isActive=false, obj.inDepot=false)
automatic action at every timestep w/o GUI interaction 
####################################################################*/


ObstacleTLDepot.prototype.zoomBack=function(){
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
        console.log("ObstacleTLDepot.zoomBack: i=",i,
		    " obj.xPix=",obj.xPix,
		    " obj.xPix=",obj.xPix,
		    " this.obstTL[i].xPix=",this.obstTL[i].xPix);
      }
    }
  }
}


ObstacleTLDepot.prototype.drag=function(xPixUser,yPixUser){
  console.log("in ObstacleTLDepot.drag");
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


ObstacleTLDepot.prototype.pickVehicleOld=function(xUser,yUser,distCrit){
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


ObstacleTLDepot.prototype.zoomBackVehicleOld=function(){
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
