
// helper function

function formd(x){return parseFloat(x).toFixed(2);}
function formd0(x){return parseFloat(x).toFixed(0);}


/** #############################################################
Represents a set of local speed limits as a measure for traffic control 

Each speed limit has a value (60,80,100,120 km/h, free) 
and can be active (=on the road) or passive (in the "depot") 

The images of the speed limits  are given by the array speedLimitImgs 
at construction time


#############################################################*/


/**
##########################################################
SpeedFunnel object constructor
##########################################################
@param canvas:  needed to position the speed-limit signs
@param nRow:    number of rows of the depot of speed-limit signs
@param nCol:    number of columns (nRow*nCol speed-limit objects)
@param xDepot:  center x position[m] of depot (0=left)
@param yDepot:  center y position[m] of depot (0=top, <0 in canvas)

*/



function SpeedFunnel(canvas,nRow,nCol,xRelDepot,yRelDepot){

  //console.log("SpeedFunnel cstr: xDepot=",xDepot," yDepot=",yDepot);

  // parse args

  this.nRow=nRow; // generally nRow*nCol != imageArray.length
  this.nCol=nCol; 
  this.n=nRow*nCol;
  this.xRelDepot=xRelDepot; // 0=left, 1=right
  this.yRelDepot=yRelDepot; // 0=bottom, 1=top


  this.sizeCanvas=Math.min(canvas.width, canvas.height);

  this.wPix=42; // only init
  this.hPix=42; // only init

  // create imgs of speed-limit signs

  this.speedlImgRepo = []; 
  for (var i_img=0; i_img<13; i_img++){
    this.speedlImgRepo[i_img]=new Image();
    this.speedlImgRepo[i_img].src = "figs/Tempo"+(i_img)+"0svg.svg";
  }

 
 

  // create all instances of speedlimit objects

  this.speedl=[];
  for (var i=0; i<this.n; i++){

  // initial association with speed limit 80,100,120,60,free
  // index={0=free,1=10 km/h, ..., 12=120 km/h}
 
    var j=i%5;
    var speedInd=
      (j==0) ? 8 :
      (j==1) ? 10 : 
      (j==2) ? 12 : 
      (j==3) ? 6 : 0;

    speedlImg=this.speedlImgRepo[speedInd];
    speedLimit=(speedInd>0) ? 10.*speedInd/3.6 : 200./3.6;

    //#################################################################
    // central object
    // speed limit effective: isActive=true, u>=0,inDepot=isDragged=false 
    // speed limit sign dragged: isDragged=true, isActive=false=inDepot=false
    // speed limit sign dropped on road => speed limit effective
    // speed limit sign dropped outside of road and notyet zoomed back =>
    // isDragged=isActive=inDepot=false
    //#################################################################
    
    this.speedl[i]={speedIndex: speedInd,
		    image: this.speedlImgRepo[speedInd],
		    value: speedLimit,
		    isActive: false, 
		    inDepot: true, 
		    isDragged: false,
		    u: -1, // physical long position [m] (only init,
		           // >=0 if isActive, <0 if !isActive)
		    xPix: 42, // pixel position of center (only init)
		    yPix: 42,
		    xPixDepot: 42, // xPix=xPixDepot if !isActive and 
		    yPixDepot: 42 // graphics zoomed back to depot
		   };
  } // loop over elements

  console.log("this.speedl[0].speedIndex=",this.speedl[0].speedIndex);
  this.calcDepotPositions(canvas); // sets pixel sizes, positions

    
  // logging


  if(true){
    for(var i=0; i<this.n; i++){
      console.log("SpeedFunnel cstr: i=",i,
		  " speedIndex=",this.speedl[i].speedIndex,
		  " speedLimit_kmh=",formd(3.6*this.speedl[i].value),
		  " imgfile=",this.speedl[i].image.src,
		  " isActive=",this.speedl[i].isActive);
    }
  
  }


} // end SpeedFunnel Cstr






//######################################################################
// calculate depot positions (call at init and after each resize)
//######################################################################

SpeedFunnel.prototype.calcDepotPositions=function(canvas){

  var sRel=0.01; // relative spacing
  var sizeRel=0.10; // relative size of speed-limit sign
  this.sizeCanvas=Math.min(canvas.width, canvas.height);
  var sPix=sRel*this.sizeCanvas; // spacing in pixels
  var xPixDepotCenter=canvas.width*this.xRelDepot; 
  var yPixDepotCenter=canvas.height*(1-this.yRelDepot);

  this.wPix=sizeRel*this.sizeCanvas; // diameter of speed-limit signs in pixels
  this.hPix=this.wPix;

  for (var i=0; i<this.n; i++){
    var icol=i%this.nCol;
    var irow=Math.floor(i/this.nCol);
    this.speedl[i].xPixDepot=xPixDepotCenter 
      + (this.wPix+sPix)*(icol-0.5*(this.nCol-1));
    this.speedl[i].yPixDepot=yPixDepotCenter 
      + (this.hPix+sPix)*(irow-0.5*(this.nRow-1));
    if(this.speedl[i].inDepot){
      this.speedl[i].xPix=this.speedl[i].xPixDepot;
      this.speedl[i].yPix=this.speedl[i].yPixDepot;
    }
  }
}


//######################################################################
// draw active and passive speedlimit signs
// active: on road
// passive: zooming back or stationary in depot
//######################################################################


/**
@return draw into graphics context ctx (defined by canvas)
*/


SpeedFunnel.prototype.draw=function(canvas,road,scale){

  var active_drawTwoSigns=true; // if false, only sign above road drawn
  var active_scaleFact=0.7; // size active/size passive signs
  var crossingLineWidth=1; // line to indicate begin of speedlimit region [m]
  ctx = canvas.getContext("2d");
  var wPixPassive=this.wPix;
  var hPixPassive=this.hPix;
  var wPixActive=active_scaleFact*wPixPassive;
  var hPixActive=active_scaleFact*hPixPassive;

  for (var i=0; i<this.speedl.length; i++){
    var SL=this.speedl[i];
 

    // draw active objects (two signs+line on road)
    
    if(SL.isActive){

      // the marker line between active sign(s)

      var crossingLineLength=road.nLanes*road.laneWidth;

      var xCenterPix=  scale*road.traj_x(SL.u);
      var yCenterPix= -scale*road.traj_y(SL.u); // minus!!
      var wPix=scale*crossingLineWidth;
      var lPix=scale*crossingLineLength;
      var phi=road.get_phi(SL.u);
      var cphi=Math.cos(phi);
      var sphi=Math.sin(phi);

      ctx.setTransform(cphi,-sphi,sphi,cphi,xCenterPix,yCenterPix);
      ctx.fillStyle="rgb(255,255,255)";
      ctx.fillRect(-0.5*wPix, -0.5*lPix, wPix, lPix);

      // the speedlimit sign(s)

      // left if cphi>0, right otherwise, so that sign always above road
      // nice side-effect if both signs drawn: nearer sign drawn later
      // =>correct occlusion effect
      
      var distCenter=0.5*crossingLineLength+0.6*road.laneWidth;
      var v=(cphi>0) ? -distCenter : distCenter; // [m]
      var xPix=xCenterPix+scale*v*sphi;  // + left if cphi>0
      var yPix=yCenterPix+scale*v*cphi;  // -*-=+
      ctx.setTransform(1,0,0,1,xPix,yPix);
      ctx.drawImage(SL.image,-0.5*wPixActive,
		    -hPixActive,wPixActive, hPixActive);

      if(active_drawTwoSigns){ // draw signs on both sides
	v*=-1;
        xPix=xCenterPix+scale*v*sphi;  // + left if cphi>0
        yPix=yCenterPix+scale*v*cphi;  // -*-=+
        ctx.setTransform(1,0,0,1,xPix,yPix);
        ctx.drawImage(SL.image,-0.5*wPixActive,
		      -hPixActive,wPixActive, hPixActive);
      }

	
      if(false){
	console.log("SpeedFunnel.draw active signs: i=",i,
		    " SL.u=",SL.u,
		    " xPix=",xPix,
		    " yPix=",yPix);
      }

 
    }
    
    // draw passive objects (in depot or zooming back)

    else{
      ctx.setTransform(1,0,0,1, SL.xPix,SL.yPix);
      ctx.drawImage(SL.image,-0.5*wPixPassive,-0.5*hPixPassive,
		    wPixPassive,hPixPassive);

      if(false){
	console.log(
	  "in SpeedFunnel.draw: i=",i,
	  " fname=",SL.image.src,
	  " xPix=",formd(SL.xPix),
	  " yPix=",formd(SL.yPix),
	  " wPixPassive=",formd(wPixPassive),
	  " hPixPassive=",formd(wPix));
      }
    }
  }
} // draw


//######################################################################
// pick speed-limit sign in depot or on the road by user action
//######################################################################


/**
@param  xPixUser,yPixUser: the external pixel position
@param  distCrit:    only if the distance to the nearest sign
                     is less than distCrit [Pix], the operation is successful
@return [successFlag, thePickedSign]
@sidefeffect: thePickedSign.isActive is set to false
*/


SpeedFunnel.prototype.pickObject=function(xPixUser,yPixUser,distCrit){
  var dist2_min=1e9;
  var dist2_crit=distCrit*distCrit;
  var speedlReturn=null;
  var success=false;
  for(var i=0; i<this.speedl.length; i++){
    var dist2=Math.pow(xPixUser-this.speedl[i].xPix,2)
      + Math.pow(yPixUser-this.speedl[i].yPix,2);
    if( (dist2<dist2_crit) && (dist2<dist2_min)){
      success=true;
      dist2_min=dist2;
      speedlReturn=this.speedl[i];
    }
    if(true){
      console.log("SpeedFunnel: i=",i,
		  " kmh=",formd0(3.6*this.speedl[i].value),
		  " u=",formd0(this.speedl[i].u),
		  " uNearest=",formd0(mainroad.findNearestDistanceTo(xPixUser/scale,-yPixUser/scale)[1]),
		  " xPix=",formd0(this.speedl[i].xPix),
		  " xPixUser=", formd0(xPixUser),
		  " yPix=",formd0(this.speedl[i].yPix),
		  " yPixUser=", formd0(yPixUser),
		  " dist2=",formd0(dist2),
		  " dist2_crit=",formd0(dist2_crit),
		  " success=",success);
    }
  }

  if(true){
    var msg=(success)
      ? "successfully picked speedlimit "+formd(3.6*speedlReturn.value)
      : "no sign picked";
    console.log("SpeedFunnel.pickObject: ",msg);
  }

  // deactivate in case the picked sign was on the road

  if(success){speedlReturn.isActive=false;} 
 
  return[success,speedlReturn];
}
 

/*####################################################################
bring back all dragged speedlimit objects back to the depot 
if dropped too far from a road (object.isActive=false, obj.inDepot=false)
automatic action at every timestep w/o GUI interaction 
####################################################################*/


SpeedFunnel.prototype.zoomBack=function(){
  var relDisplacementPerCall=0.02; // zooms back as attached to a rubber band
  var pixelsPerCall=relDisplacementPerCall*this.sizeCanvas;
  for(var i=0; i<this.speedl.length; i++){
    var speedlObj=this.speedl[i];
    if((!speedlObj.isActive)&&(!speedlObj.inDepot)){
      userCanvasManip=true; 
      var dx=speedlObj.xPixDepot-speedlObj.xPix;
      var dy=speedlObj.yPixDepot-speedlObj.yPix;
      var dist=Math.sqrt(dx*dx+dy*dy);

      if(dist<pixelsPerCall){
	speedlObj.xPix=speedlObj.xPixDepot;
	speedlObj.yPix=speedlObj.yPixDepot;
	speedlObj.inDepot=true;
      }
      else{
	speedlObj.xPix += pixelsPerCall*dx/dist;
	speedlObj.yPix += pixelsPerCall*dy/dist;
      }
      if(false){
        console.log("SpeedFunnel.zoomBack: i=",i,
		    " speedlObj.xPix=",speedlObj.xPix,
		    " speedlObj.xPix=",speedlObj.xPix,
		    " this.speedl[i].xPix=",this.speedl[i].xPix);
      }
    }
  }
}


SpeedFunnel.prototype.drag=function(xPixUser,yPixUser){
  console.log("in SpeedFunnel.drag");
}
