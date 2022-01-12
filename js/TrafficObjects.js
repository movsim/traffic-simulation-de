
/*#############################################################
a set of traffic-related objects that can be dragged by the user 
from a "depot" to a network link (road) and back. 
Main component of this class is an array trafficObj[] 
of the traffic objects (traffObj=trafficObj[i]) 

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

- passive: in the "depot" or dragged or zooming back


* The TL and speed limit objects also have values:
  
  - traffObj.value="red" or "green" (if traffObj.type==='trafficLight')
  - traffObj.value=limit_kmh (if traffObj.type==='speedLimit')
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

var objectsZoomBack=false;

function TrafficObjects(canvas,nTL,nLimit,xRelDepot,yRelDepot,nRow,nCol){

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
  this.sizeRel=0.08;         // relative size of passive graphical objects
  this.active_scaleFact=1.0; // pixel size factor active/passive objects
                             // other than obstacles (phys length relevant)
  this.lenPhys=25;       // physical length[m] of active obstacles
                             // (drawn by the road.draw methods)
  this.wPhys=10;         // 1..1.5 times road.lanewidth

  
  // variable size variables (updated in this.calcDepotPositions)
  
  this.sizeCanvas=Math.min(canvas.width, canvas.height);

  // general graph variables

  this.active_drawTopSign=true; // if true, a TL/sign above road is drawn
                             // if active (in any case, only one obstacle 
                             // on the dropped lane)
  this.active_drawBotSign=true; // if true, a TL/sign below road is drawn
                             // if active

  // create image repositories

  this.imgTLgreen = new Image();
  this.imgTLgreen.src="figs/trafficLight_green.png";
  this.imgTLred = new Image();
  this.imgTLred.src="figs/trafficLight_red.png";
  this.imgTyellow = new Image();
  this.imgTyellow.src="figs/trafficLight_yellow.png";

  this.imgSpeedlRepo = []; 
  for (var i=0; i<13; i++){
    this.imgSpeedlRepo[i]=new Image();
    this.imgSpeedlRepo[i].src = "figs/speedLimit_"+(i)+"0.svg";
  }

  this.imgObstRepo = []; 
  for (var i=0; i<Math.min(this.nObst, this.nObstMax); i++){
    this.imgObstRepo[i]=new Image();
    this.imgObstRepo[i].src = "figs/obstacle_"+(50+i)+".png";
    console.log("i=",i," this.imgObstRepo[i].src=",this.imgObstRepo[i].src);
  }


  
  // create all instances of trafficObj[]

  this.trafficObj=[];
  var initSpeedInd=[6,8,10,0,12,3,4,5,1,2]; // speed 60 km/h,80,100,free..
  for(var i=0; i<this.n; i++){

    var isTL=(i<this.nTL);
    var isSpeedl=(!isTL)&&(i<this.nTL+nLimit);
    var isObst=!(isTL||isSpeedl);

    var iSpeed=i-this.nTL;
    var iObst=i-this.nTL-this.nLimit;
    
    var img=(isTL) ? this.imgTLred : (isSpeedl)
      ? this.imgSpeedlRepo[initSpeedInd[iSpeed]] : this.imgObstRepo[iObst];
    if(true){
      console.log("TrafficObjects cstr: i=",i,
		  " img=",img," iObst=",iObst);
    }

    //#################################################################
    // xxx central object this.trafficObj[i]
    // object on road: isActive=true, u>=0,inDepot=isDragged=false 
    // object picked: isPicked=true, inDepot=false, isDragged and isActive
    //         can have both values 
    //         (isActive=true only if (!isDragged)&&(isActive in past)) 
    // object dragged: isDragged=true, isPicked=inDepot=isActive=false
    // object dropped on road => isActive=true, 
    //          isDragged=isPicked=inDepot=false
    // object dropped outside of road and not yet completely zoomed back =>
    //          isPicked=isDragged=isActive=inDepot=false
    //#################################################################

    this.trafficObj[i]={
      id:    (isTL) ? 100+i : (isSpeedl) ? 150+iSpeed : 50+iObst,
      type:  (isTL) ? "trafficLight" : (isSpeedl) ? "speedLimit" : "obstacle",
      image: (isTL) ? this.imgTLred : (isSpeedl)
	? this.imgSpeedlRepo[initSpeedInd[iSpeed]] : this.imgObstRepo[iObst],
      value: (isTL) ? "red" : (isObst) ? "null" : 10*initSpeedInd[iSpeed],
                                                 // speedlimit in km/h!!
      isActive: false, 
      inDepot:  true,
      isPicked: false,   // !! controlled by pickRoadOrObject (canvas_gui)
                         // ->this.pickObject
      isDragged: false,  // !! controlled by doDragging (canvas_gui)
                         // -> direct setting in canvas_gui
      road: 'void',      // only defined if isActive=true
      u: -1,             // physical long position [m] (<0 if !isActive)
                         // for graph focus, advanced by du=this.lenPhys/2 
                         // if obstacle 
      lane: -1,          // =round(v); isActive: 0 to road.nLanes-1,
                         // !isActive: -1
      len: this.lenPhys, //[m], for drawing of active obj of type "obstacle"
      width: this.wPhys, //[m], about 1-1.5*road.lanewidth 
      xPix: 42,          // actual pixel position (to be calculated later
      yPix: 42,          // in calcDepotPositions
      xPixSign1: 42,    // pixel pos of more distant active TL/speedl img
      yPixSign1: 42,    // to be calculated in draw(...)
      xPixSign2: 42,    // pixel pos of nearer active TL/speedl img
      yPixSign2: 42,
      xPixDepot: 42,     // xPix=xPixDepot if !isActive and 
      yPixDepot: 42      // graphics zoomed back to depot
    };

    if((this.trafficObj[i].type=="speedLimit") 
       &&(this.trafficObj[i].value==0)){
      this.trafficObj[i].value=300; // no speedlimit if index 0->00 km/h
    }

    
  } // loop over elements


  this.calcDepotPositions(canvas); // sets pixel sizes, positions

    
  // logging

  if(false){
    console.log("TrafficObjects Cstr: this.nTL=",this.nTL);
    for(var i=0; i<this.trafficObj.length; i++){
      console.log("TrafficObjects cstr: i=",i,
		  " value=",this.trafficObj[i].value,
		  " type=",this.trafficObj[i].type,
		  " id=",this.trafficObj[i].id,
		  " imgfile=",this.trafficObj[i].image.src,
		  " isActive=",this.trafficObj[i].isActive);
    }
  }

} // end TrafficObjects Cstr



//######################################################################
// calculate depot positions (call at init and after each resize)
//######################################################################

TrafficObjects.prototype.calcDepotPositions=function(canvas){

  this.sizeCanvas=Math.min(canvas.width, canvas.height);
  this.wPix=this.sizeRel*this.sizeCanvas; // diameter [pix] of traffObj signs
  this.hPix=this.wPix;

  var gapPix=this.gapRel*this.sizeCanvas; // spacing in pixels
  var xPixDepotCenter=canvas.width*this.xRelDepot; 
  var yPixDepotCenter=canvas.height*(1-this.yRelDepot);


  for (var i=0; i<this.n; i++){
    var icol=i%this.nCol;
    var irow=Math.floor(i/this.nCol);
    this.trafficObj[i].xPixDepot=xPixDepotCenter 
      + (this.wPix+gapPix)*(icol-0.5*(this.nCol-1));
    this.trafficObj[i].yPixDepot=yPixDepotCenter 
      + (this.hPix+gapPix)*(irow-0.5*(this.nRow-1));
    if(this.trafficObj[i].inDepot){
      this.trafficObj[i].xPix=this.trafficObj[i].xPixDepot;
      this.trafficObj[i].yPix=this.trafficObj[i].yPixDepot;
    }
  }
}


//######################################################################
// draw active and passive trafficObjimit signs
// active: on road
// passive: zooming back or stationary in depot
//######################################################################


/**
@return drawing into graphics context
*/


TrafficObjects.prototype.draw=function(){

  //console.log("in TrafficObjects.draw");
  var crossingLineWidth=1;   // width[m] of white line at sign/TL


  for (var i=0; i<this.trafficObj.length; i++){
 

    var obj=this.trafficObj[i];
    //  such that speedlimit signs are round on chrome 
    var wPixPassive=this.wPix*((obj.type==='speedLimit') ? 0.9:1);
    var hPixPassive=this.hPix*((obj.type==='speedLimit') ? 1.2:1);
    var wPixActive=this.active_scaleFact*wPixPassive;
    var hPixActive=this.active_scaleFact*hPixPassive;

    // (1) draw active traffic lights or speed limits
    // (active obstacles drawn by road) 
    // ==============================================

    if((obj.isActive)
       &&((obj.type==="trafficLight")||(obj.type==="speedLimit"))){

      var obj=this.trafficObj[i];
      var road=obj.road;

      // draw the stopping line 

      var crossingLineLength=road.nLanes*road.laneWidth;

      var xCenterPix=  scale*road.traj_x(obj.u);
      var yCenterPix= -scale*road.traj_y(obj.u); // minus!!
      var wPix=scale*crossingLineWidth;
      var lPix=scale*crossingLineLength;
      var phi=road.get_phi(obj.u);
      var cphi=Math.cos(phi);
      var sphi=Math.sin(phi);

      ctx.setTransform(cphi,-sphi,sphi,cphi,xCenterPix,yCenterPix);
      ctx.fillStyle="rgb(255,255,255)";
      ctx.fillRect(-0.5*wPix, -0.5*lPix, wPix, lPix);

      // draw the traffic light/speed-limit sign (pair) itself

      // left if cphi>0, right otherwise, so that sign always above road
      // nice side-effect if both signs drawn: nearer sign drawn later
      // =>correct occlusion effect
      
      var distCenter=0.5*crossingLineLength+0.6*road.laneWidth;
      var v=(cphi>0) ? -distCenter : distCenter; // [m]

      if(this.active_drawTopSign){ // draw active sign above the road
        xPix=xCenterPix+scale*v*sphi;  // + left if cphi>0
        yPix=yCenterPix+scale*v*cphi;  // -*-=+
        ctx.setTransform(1,0,0,1,xPix,yPix);
        ctx.drawImage(obj.image,-0.5*wPixActive,
		    -hPixActive,wPixActive, hPixActive);
        obj.xPixSign1=xPix;                // save pixel positions of 
        obj.yPixSign1=yPix-0.8*hPixActive; // light centers for later picking
      }     

      if(this.active_drawBotSign){ // draw active sign below the road
	v*=-1;
        xPix=xCenterPix+scale*v*sphi;  // + left if cphi>0
        yPix=yCenterPix+scale*v*cphi;  // -*-=+
        ctx.setTransform(1,0,0,1,xPix,yPix);
        ctx.drawImage(obj.image,-0.5*wPixActive,
		      -hPixActive,wPixActive, hPixActive);
	obj.xPixSign2=xPix;         
	obj.yPixSign2=yPix-0.8*hPixActive;
      }

	
      if(false){
	console.log("TrafficObjects.draw active obj: i=",i,
		    " type=",obj.type,
		    " obj.u=",obj.u,
		    " obj.xPixSign1=",obj.xPixSign1,
		    " obj.yPixSign1=",obj.yPixSign1);
      }

    }// end draw active TL or speedlimit
    

 

    // (3) draw all passive objects (in depot or zooming back)
    // ===============================================

    if(!obj.isActive){

      ctx.setTransform(1,0,0,1, obj.xPix,obj.yPix);
      ctx.drawImage(obj.image,-0.5*wPixPassive,-0.5*hPixPassive,
		    wPixPassive,hPixPassive);

      if(false){
      //if(obj.value==60){
	console.log(
	  "time=",time," in TrafficObjects.draw: passive objects: id=",obj.id,
	  " value=",obj.value,
	  //" fname=",obj.image.src,
	  //" xPix=",formd(obj.xPix),
	  //" yPix=",formd(obj.yPix),
	  //" wPixPassive=",formd(wPixPassive),
	  //" hPixPassive=",formd(hPixPassive),
	  "");
      }
 
    }
    
  } // objects loop
} // draw



//######################################################################
// object selection method 1: Graphically by user
//######################################################################

/**
@param  xPixUser,yPixUser: the external pixel position
@param  distCrit:    only if the distance to the nearest sign
                     is less than distCrit [Pix], the operation is successful
@return [successFlag, the selected object]
*/


// !! only used via pickObject
TrafficObjects.prototype.selectByUser=function(xPixUser,yPixUser,distCritPix){

  //console.log("\n\nitime=",itime," in TrafficObjects.selectByUser:");

  var dist2_min=1e9;
  var dist2_crit=distCritPix*distCritPix;
  var i_opt=-1;
  for(var i=0; i<this.trafficObj.length; i++){
    var dist2=Math.pow(xPixUser-this.trafficObj[i].xPix,2)
      + Math.pow(yPixUser-this.trafficObj[i].yPix,2);
    if(dist2<dist2_min){
      dist2_min=dist2;
      i_opt=i;
    }
  }

  var success=(dist2_min<dist2_crit);
  var trafficObjreturn=(success) ? this.trafficObj[i_opt] : 'null';

  if(false){
    if(success){
      console.log("  success! type=", trafficObjreturn.type,
		  " isActive=",trafficObjreturn.isActive,
		  " xPixUser=",formd0(xPixUser),
		  " yPixUser=",formd0(yPixUser),
		  " xPix=",formd0(this.trafficObj[i_opt].xPix),
		  " yPix=",formd0(this.trafficObj[i_opt].yPix),
		  "end");
    }
    else{
      console.log("  no success",
		  " nearest object has type", this.trafficObj[i_opt].type,
		  " xPixUser=",formd0(xPixUser),
		  " yPixUser=",formd0(yPixUser),
		  " xPix=",formd0(this.trafficObj[i_opt].xPix),
		  " yPix=",formd0(this.trafficObj[i_opt].yPix),
		  "end");
    }
  }
  
  return[success,trafficObjreturn];
}
 

//######################################################################
// object selection method 2: by id
//######################################################################

/**
@param  id: the object's id to be looked for
@return [successFlag, the selected object] 

*/


// !! as of 2021-11, not used
TrafficObjects.prototype.selectById=function(id){
  success=false;
  var i_success=-1;
  for(var i=0; (i<this.trafficObj.length)&&(!success); i++){
    if(this.trafficObj[i].id==id){
      success=true;
      i_success=i;
    }
  }
  var trafficObjreturn=(success) ? this.trafficObj[i_success] : "null";
  return[success,trafficObjreturn];
}


//######################################################################
// activate an object
//######################################################################

/** implement traffic effects of a trafficObject 
by creating one or more virtual vehicle-objects on the target road 
(obstacle or TL), or adding the new speedlimit 
to the road;s list of speed limits

@param obj: the trafficObject to be activated
@param road: target road for activation
@param u: optional long coordinate if not set previously
@return: changed road data to reflect activation

Notice: obj.u, lane, inDepot,isDragged,isPicked defined by this.dropObject(.)
(not road.dropObject) if called inside TrafficObjects. 
If called at top-level for initialisation,
the optional arg u may be given; then also other attributes are updated to
active state (otherwise, this.dropObject does this)
*/


TrafficObjects.prototype.activate=function(obj, road, u){
  obj.road=road;
  obj.isActive=true; 
  if(!(typeof u === 'undefined')){ // external setting; must take care of all
    obj.u=u;
    //obj.lane=0.5*road.nLanes; // center, v=0
    obj.lane=0; // !!! 
    obj.xPix=road.get_xPix(u,0,scale);
    obj.yPix=road.get_yPix(u,0,scale);
    obj.inDepot=false;
    obj.isPicked=false;
    obj.isDragged=false;
  }
  hasChanged=true;
  road.dropObject(obj); // !! AFTER external setting; otherwise heineous bug
                        // since then local road.trafficLights[i].u undefined

}


//######################################################################
// deactivate an object and its road effects
//######################################################################

TrafficObjects.prototype.deactivate=function(obj){
  var road=obj.road;
  if(obj.isActive){
    if(obj.type==='trafficLight'){console.log("TrafficObjects.deactivate");road.removeTrafficLight(obj.id);}
    if(obj.type==='obstacle'){road.removeObstacle(obj.id);}
    // no action needed for speedLimit
    obj.road="null";
    obj.isActive=false; // for safety last cmd
  }
}



//######################################################################
// pick an object
//######################################################################

/** 

  * find nearest object to pointer coordinates
  * if this object is nearer than distCritPix, select it, otherwise do nothing
  * if selected object is active, make it passive 
    and deactivate road effects

@param xPixUser:    users pixel coordinates ((0,0)=left top)
@param yPixUser:
@param distCritPix: pick successful if distPix to neares road<distCritPix
*/


TrafficObjects.prototype.pickObject=function(xPixUser, yPixUser, distCritPix){

  var results=this.selectByUser(xPixUser, yPixUser, distCritPix);
  //[success,trafficObjreturn]

  var success=results[0];
  var obj=results[1];
  if(success){
    obj.isPicked=true;
    obj.inDepot=false;
    obj.isDragged=false;
  }
  return [success,obj];
}



//######################################################################
// drop an object
//######################################################################

/** 

  * drop the selected object. 
  * If the global var isDragged=false, restore the state before picking

@param obj:         the object to be dropped
@param network:     an array of road objects as candidates for dropping
@param xPixUser:    users pixel coordinates ((0,0)=left top)
@param yPixUser:
@param distCritPix: drop on a road successful if distPix to nearest 
                    road less than distCritPix
*/

// needs global physical coordinates xUser yUser
TrafficObjects.prototype.dropObject=function(obj, network, 
				    xUser, yUser, distCritPix, scale){

  console.log("itime=",itime
	      ," in TrafficObjects.dropObject: obj.id=",obj.id,
	      " obj.xPix=",obj.xPix,
	      " network[0].roadID=",network[0].roadID);
  // transform pointer to physical coordinates since road geometry
  // defined in these coordinates
  
  // find really nearest road, not just sufficiently near one

  var iroadNearest=-1;
  var dropInfoNearest;
  var distMin=100000;
  for(var iroad=0; iroad<network.length; iroad++){

    var dropInfo=network[iroad].findNearestDistanceTo(xUser,yUser);
    // => [distance in m, u in m, v in lanes]
    //console.log("  TrafficObjects.dropObject: iroad=",iroad,
//		" dropInfoNearest=",dropInfoNearest," distMin=",distMin);
    if(dropInfo[0]<distMin){
      dropInfoNearest=dropInfo;
      distMin=dropInfoNearest[0];
      iroadNearest=iroad;
    }
    //console.log("  end iroad loop cmds: iroadNearest=",iroadNearest);
  }

  // check success

  var success=(scale*distMin<=distCritPix);
  var road=(success) ? network[iroadNearest] : 'void';

  // update trafficObject state depending on success

  obj.road=road;
  // obj.isActive set later by this.activate()
  obj.inDepot=false;
  obj.isPicked=false;
  obj.isDragged=false;

  obj.u=(success) ? dropInfoNearest[1] : -1;
  obj.lane=(success) ? 0 : -1; // do not use v from mouse pointer/touch
                               // unless obstacle (see below)

  // obstacles: focus should be on object center, 
  // not front => move obstacles forward
  
  var du=(obj.type==='obstacle') ? 0.5*obj.len : 0;  
  
  if(success && obj.type==='obstacle'){
    obj.u+=du;
    obj.lane=Math.round(
      Math.max(0, Math.min(road.nLanes-1,dropInfoNearest[2])));
  }

  // update pixel coordinates to "snapped" objects for later picking
  // pick obstacles at center => at position u-du

  if(success){
    console.log("  success! roadID=",obj.road.roadID,
		" obj.u=",obj.u," obj.lane=",obj.lane);
    obj.xPix=road.get_xPix(obj.u-du, obj.lane, scale);
    obj.yPix=road.get_yPix(obj.u-du, obj.lane, scale);
  }


  // implement traffic effects on road if successful drop

  if(success){
    this.activate(obj, road);
  }


  if(true){
    console.log("  end TrafficObjects.dropObject: success=",success,
		" nearest roadID=",road.roadID,
	        " road.roadLen=",formd(road.roadLen),
	        " obj.id=",obj.id,
	        " obj.u=",formd(obj.u),
	        " obj.xPix=",formd0(obj.xPix),
		"");
  }

} // dropObject




//#############################################################
/** select single active/passive signs or traffic lights by click on canvas
intended usage:
 - interactively change limits (pop up choicebox) in canvas_gui.js
 - apply changeTrafficLightByUser(..)

 - disambiguation from drag (no change): only change light if isDragged=false
 - Difference to selectByUser: 
   
   - only active signs (since no disambiguation whether mouseup from 
   - selectSignOrTL: select obj by center of one of two signs/traffic lights
   - selectByUser: generically select obj by its center
 - 
@return: success flag and relevant trafficObject */
//#############################################################

TrafficObjects.prototype.selectSignOrTL=function(xPixUser,yPixUser){
    
  if(false){
    console.log("in TrafficObjects.selectSignOrTL:",
		" xPixUser=",xPixUser," yPixUser=",yPixUser);
  }

  var refSizePix=Math.min(canvas.height,canvas.width);
  var distPixCrit=0.03*refSizePix;
  var success=false;
  var objFound='void';
  for(var i=0; (!success)&&(i<this.trafficObj.length); i++){
    var obj=this.trafficObj[i];
    if((!obj.isDragged) 
       &&((obj.type==='trafficLight')||(obj.type==='speedLimit'))){
      var dxPix=xPixUser-obj.xPix;
      var dyPix=yPixUser-obj.yPix;
      var dxPix1=xPixUser-obj.xPixSign1;
      var dyPix1=yPixUser-obj.yPixSign1;
      var dxPix2=xPixUser-obj.xPixSign2;
      var dyPix2=yPixUser-obj.yPixSign2;
      var distPix=Math.sqrt(dxPix*dxPix+dyPix*dyPix);
      var distPix1=Math.sqrt(dxPix1*dxPix1+dyPix1*dyPix1);
      var distPix2=Math.sqrt(dxPix2*dxPix2+dyPix2*dyPix2);
      if(Math.min(distPix,distPix1,distPix2)<=distPixCrit){
        success=true;
	objFound=obj;
      }
      if(false){
        console.log("selectSignOrobj: obj.id=",obj.id,
		    " obj.xPix=",formd0(obj.xPix),
		    " obj.yPix=",formd0(obj.yPix),
		    " obj.xPixSign1=",formd0(obj.xPixSign1),
		    " obj.xPixSign2=",formd0(obj.xPixSign2),
		    " distPix=",formd0(distPix),
		    " distPix1=",formd0(distPix1),
		    " distPix2=",formd0(distPix2),
		    " distPixCrit=",formd0(distPixCrit),
		    " success=",success);
      }
    }
  }

  return [success,objFound];
}

//#############################################################
// programmatic setting of a traffic light (only BaWue as of 2021-11)
//#############################################################

/** 
@param obj:    a TrafficObjects object of type "trafficLight"
@param value:  the new value, "red" or "green"
@return:       changed state, if active, also changed road influence
*/

TrafficObjects.prototype.setTrafficLight=function(obj, value){

  if(!(obj.type==='trafficLight')){
    console.log("TrafficObjects.setTrafficLight: error:",
		" object not of type trafficLight");
    return;
  }
  obj.value=value;
  obj.image=(obj.value==='red') ? this.imgTLred : this.imgTLgreen;
  if(obj.isActive){ // then, obj has a road reference
    obj.road.changeTrafficLight(obj.id, obj.value); //(3) das macht den Fuck
  }

  if(false){
    if(obj.isActive){
      console.log("setTrafficLight:  id=",obj.id," road ID=",obj.road.roadID);
      obj.road.writeTrafficLights();
    }
  }

  
}
  

//#############################################################
// user-driven change of the state of traffic light
//#############################################################

/** user-driven change of the state of traffic light by click on canvas
should also be called if clicked but not dragged
@return: success flag and changed state, if success 
*/

  TrafficObjects.prototype.changeTrafficLightByUser=function(xPixUser,yPixUser){

  console.log("itime=",itime," in TrafficObjects.changeTrafficLightByUser");
  var results=this.selectSignOrTL(xPixUser,yPixUser);
  console.log("  selectSignOrTL results=",results);
  var success=false; // successfully picked AND is traffic light
  if(results[0]){
    var obj=results[1];
    if(obj.type==='trafficLight'){
      success=true;
      obj.value=(obj.value==='red') ? 'green' : 'red'; // toggle
      if(obj.isActive){
        obj.road.changeTrafficLight(obj.id, obj.value); // => to road obj
      }
      obj.image=(obj.value==='red') ? this.imgTLred : this.imgTLgreen;

      if(false){
	console.log("end TrafficObjects.changeTrafficLightByUser: ",
		    " changed traffic light",
		    " to ",obj.value,
		    " at u=",obj.u);
	if(obj.isActive){
	  console.log("  on road ID ",obj.road.roadID);
	  obj.road.writeTrafficLights();
	}
      }

    }
  }

  if(true){
    if(!success){
      console.log("end TrafficObjects.changeTrafficLightByUser: no success");
    }
  }

  return success;

}

/*####################################################################
bring back all dragged trafficObj objects back to the depot 
if dropped too far from a road (object.isActive=false, obj.inDepot=false)
automatic action at every timestep w/o GUI interaction 
####################################################################*/


TrafficObjects.prototype.zoomBack=function(){
  objectsZoomBack=false;
  var relDisplacementPerCall=0.02; // zooms back as attached to a rubber band
  var pixelsPerCall=relDisplacementPerCall*this.sizeCanvas;
  for(var i=0; i<this.trafficObj.length; i++){
    var obj=this.trafficObj[i];
    if((!obj.isActive)&&(!obj.inDepot)&&(!obj.isDragged)&&(!obj.isPicked)){
      userCanvasManip=true;
      objectsZoomBack=true;
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
      if(true){
        console.log("TrafficObjects.zoomBack: i=",i,
		    " obj.xPix=",obj.xPix,
		    " obj.xPix=",obj.xPix,
		    " this.trafficObj[i].xPix=",this.trafficObj[i].xPix);
      }
    }
  }
}


TrafficObjects.prototype.drag=function(xPixUser,yPixUser){
  console.log("in TrafficObjects.drag");
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

  console.log("itime=",itime," in TrafficObjects.writeObjects:",
	      " justTL=",justTL,":");
  for(var i=0; i<this.trafficObj.length; i++){
    if((!justTL) || (this.trafficObj[i].type==='trafficLight')){
      var obj=this.trafficObj[i];
      console.log("  id=",obj.id,
		  " type=", obj.type,
		  " roadID=",obj.road.roadID,
		  " u=", formd(obj.u),
		  " lane=", formd(obj.lane),
		  " value=",obj.value,
		  //" xPix=",formd0(obj.xPix),
		 // " yPix=",formd0(obj.yPix),
		 // " image=",obj.image,
		  " isActive=",obj.isActive,
		 // " inDepot=",obj.inDepot,
		 // " isPicked=",obj.isPicked,
		 // " isDragged=",obj.isDragged,
		  "");
		 
    }
  }
}

