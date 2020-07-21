
/*#############################################################
* implements a fixed-time traffic light control 

  - all traffic lights (TLs) dragged onto a road segment are eligible

  - an active TL can be included into the control or not. If so, the 
    relative duration and phase of the green period 
    can be set in the editor panel

  - info of active TLs is obtained from TrafficObjects

  - as callback of an html button "controlTrafficLights()", 
    an editor panel opens (this.openEditPanel()

  - as callback of the close button in the editor panel, 
    the new information is transferred to TrafficObjects 
    which does the actual control 



#############################################################
*/




/**
##########################################################
TrafficLightControlEditor object constructor
##########################################################

@param canvas: canvas to draw to
@param trafficObjects: instance of TrafficObjects to get the active TLs
@param xRelEditor: relative x position of center of editor panel in the canvas
@param yRelEditor: relative y position (increasing if up)
*/

function TrafficLightControlEditor(canvas,trafficObjects,
				   xRelEditor,yRelEditor){


  this.xRelEditor=xRelEditor;
  this.yRelEditor=yRelEditor;
 
  this.wrel=0.4;  // width relative to minimum of canvas width,height 
  this.dyTopCycle=0.05; // hight of cycle length selector select buttons
  this.xrelPick=0.04; // 
  // general graphical variables


  // create image repositories

  this.knobYellow = new Image();
  this.knobYellow.src="figs/knobYellow.png";
  this.buttonDone = new Image();
  this.buttonDone.src="figs/buttonDone.png";

  this.cycleTimes=[30,40,50,60,80,100,120];
  this.cycleTime=this.cycleTimes[30];

  this.doubleSliders=[]; // as many elements as active TLs, initialized with 
  this.nSliders=3; // just an initial value; will be overridden when 
                   // activation called
// this.doubleSliders[i]={isActive: false, 
//                        left:  {isActive=false, relValue=0, xyPix=[0,0]},
//                        right: {isActive=false, relValue=0, xyPix=[0,0]} }

  this.calcGeometry(canvas,this.nSliders); // sets pixel sizes, positions

    
  // logging

  if(true){
    console.log("TrafficLightControlEditor Cstr:");
  }

} // end TrafficObjects Cstr



//######################################################################
// calculate depot positions (call at init and after each resize)
//######################################################################

TrafficObjects.prototype.calcGeometry=function(canvas,nSliders){

  this.sizeCanvas=Math.min(canvas.width, canvas.height);

  this.hSlider=0.04*this.sizeCanvas;  // height of slider itself
  this.dySlider=0.06*this.sizeCanvas; // y difference between sliders
  this.wSlider=0.04*this.sizeCanvas;


  this.hPixSlider=0.05*


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

      // draw the traffic light (pair) itself

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

TrafficObjects.prototype.dropObject=function(obj, network, 
				    xPixUser, yPixUser, distCritPix, scale){

  console.log("itime=",itime
	      ," in TrafficObjects.dropObject: obj.id=",obj.id,
	      " obj.xPix=",obj.xPix,
	      " network[0].roadID=",network[0].roadID);
  // transform pointer to physical coordinates since road geometry
  // defined in these coordinates
  
  var xUser=xPixUser/scale;
  var yUser=-yPixUser/scale;

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
// programmatic setting of a traffic light
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
  var relDisplacementPerCall=0.02; // zooms back as attached to a rubber band
  var pixelsPerCall=relDisplacementPerCall*this.sizeCanvas;
  for(var i=0; i<this.trafficObj.length; i++){
    var obj=this.trafficObj[i];
    if((!obj.isActive)&&(!obj.inDepot)&&(!obj.isDragged)&&(!obj.isPicked)){
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

