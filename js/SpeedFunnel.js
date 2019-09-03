
// helper function

function formd(x){return parseFloat(x).toFixed(2);}



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

  // create imgs of speed-limit signs

  this.speedlImgRepo = []; // srcFiles[0]='figs/obstacleImg.png'
  for (var i_img=0; i_img<13; i_img++){
    this.speedlImgRepo[i_img]=new Image();
    this.speedlImgRepo[i_img].src = (i_img==0)
      ? 'figs/sign_free_282_small.png'
      : "figs/Tempo"+(i_img)+"0.png";
  }

  // initial association with speed limit 80,100,120,60,free
  // index={0=free,1=10 km/h, ..., 12=120 km/h}

  this.speedIndex=[];
  this.speedlImg=[];
  this.speedLimit=[];
  for (var i=0; i<this.n; i++){
    var j=i%5;
    var k=
      (j==0) ? 8 :
      (j==1) ? 10 : 
      (j==2) ? 12 : 
      (j==3) ? 6 : 0;

    this.speedIndex[i]=k;
    this.speedlImg[i]=this.speedlImgRepo[k];
    this.speedLimit[i]=(k>0) ? 10.*k/3.6 : 200./3.6;
  }

  // initial states: all speed limits are passive

  this.isActive=[];
  for (var i=0; i<this.n; i++){
    this.isActive[i]=false;
  }


  // init depot positions

  this.wPix=42; // only init
  this.hPix=42; // only init
  this.xPixDepot=[];
  this.yPixDepot=[];
  this.calcDepotPositions(canvas);

  // log

  if(true){
    for(var i=0; i<this.n; i++){
      console.log("SpeedFunnel cstr: i=",i,
		  " speedIndex=",this.speedIndex[i],
		  " speedLimit_kmh=",formd(3.6*this.speedLimit[i]),
		  " imgfile=",this.speedlImg[i].src,
		  " isActive=",this.isActive[i]);
    }
  }
} // end cstr




//######################################################################
// calculate depot positions (call at init and after each resize)
//######################################################################

SpeedFunnel.prototype.calcDepotPositions=function(canvas){

  var sRel=0.01; //. relative spacing
  var sizeCanvas=Math.min(canvas.width, canvas.height);
  this.wPix=sizeRel*sizeCanvas; // diameter of image in pixels
  this.hPix=wPix;
  var sPix=sRel*sizeCanvas; // spacing in pixels
  var xPixDepotCenter=canvas.width*this.xRelDepot; 
  var yPixDepotCenter=canvas.height*(1-this.yRelDepot);

  for (var i=0; i<this.n; i++){
    var icol=i%this.nCol;
    var irow=Math.floor(i/this.nCol);
    this.xPixDepot[i]=xPixDepotCenter 
      + (this.wPix+sPix)*(icol-0.5*(this.nCol-1));
    this.yPixDepot[i]=yPixDepotCenter 
      + (this.hPix+sPix)*(irow-0.5*(this.nRow-1));
  }
}


//######################################################################
// draw into canvas
//######################################################################


/**
@return draw into graphics context ctx (defined by canvas)
*/


SpeedFunnel.prototype.draw=function(canvas){

  ctx = canvas.getContext("2d");
  var wPix=this.wPix;
  var hPix=this.hPix;

  for (var i=0; i<this.n; i++){

    if(!this.isActive[i]){ // draw passive limits into depot
      ctx.setTransform(1,0,0,1,xPixDepot[i],yPixDepot[i]);
      ctx.drawImage(this.speedlImg[i],-0.5*wPix,-0.5*hPix,wPix,hPix);

      if(true){
	console.log(
	  "in SpeedFunnel.draw: i=",i,
	  " fname=",this.speedlImg[i].src,
	  " icol=",formd(icol)," irow=",formd(irow),
	  " xPix=",formd(xPix),
	  " yPix=",formd(yPix),
	  " wPix=",formd(wPix),
	  " hPix=",formd(wPix));
      }
    }
  }
} // draw



//######################################################################
// pick speed-limit sign in depot by user action
//######################################################################


/**
@param  xUser,yUser: the external physical position
@param  distCrit:    only if the distance to the nearest veh in the depot
                     is less than distCrit, the operation is successful
@return [successFlag, thePickedVeh]
*/


SpeedFunnel.prototype.pickVehicle=function(xUser,yUser,distCrit){
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


SpeedFunnel.prototype.zoomBackVehicle=function(){
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
