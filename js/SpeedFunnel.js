
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
  this.wPix=42; // only init
  this.hPix=42; // only init

  // create imgs of speed-limit signs

  this.speedlImgRepo = []; // srcFiles[0]='figs/obstacleImg.png'
  for (var i_img=0; i_img<13; i_img++){
    this.speedlImgRepo[i_img]=new Image();
    this.speedlImgRepo[i_img].src = (i_img==0)
      ? 'figs/sign_free_282_small.png'
      : "figs/Tempo"+(i_img)+"0.png";
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
 
    this.speedl[i]={speedIndex: speedInd,
		    image: this.speedlImgRepo[speedInd],
		    value: speedLimit,
		    isActive: false,
		    xPixDepot: 42, // only init
		    yPixDepot: 42, // only init
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

    // test pick

    console.log("this.pickInDepot(526,246,42)=",this.pickInDepot(526,246,42));
  }


} // end SpeedFunnel Cstr






//######################################################################
// calculate depot positions (call at init and after each resize)
//######################################################################

SpeedFunnel.prototype.calcDepotPositions=function(canvas){

  var sRel=0.01; // relative spacing
  var sizeRel=0.06; // relative size of speed-limit sign
  var sizeCanvas=Math.min(canvas.width, canvas.height);
  var sPix=sRel*sizeCanvas; // spacing in pixels
  var xPixDepotCenter=canvas.width*this.xRelDepot; 
  var yPixDepotCenter=canvas.height*(1-this.yRelDepot);

  this.wPix=sizeRel*sizeCanvas; // diameter of speed-limit signs in pixels
  this.hPix=this.wPix;

  for (var i=0; i<this.n; i++){
    var icol=i%this.nCol;
    var irow=Math.floor(i/this.nCol);
    this.speedl[i].xPixDepot=xPixDepotCenter 
      + (this.wPix+sPix)*(icol-0.5*(this.nCol-1));
    this.speedl[i].yPixDepot=yPixDepotCenter 
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

  for (var i=0; i<this.speedl.length; i++){
    var speedlimit=this.speedl[i];
    if(!this.speedl.isActive){ // draw passive limits into depot
      ctx.setTransform(1,0,0,1, speedlimit.xPixDepot,speedlimit.yPixDepot);
      ctx.drawImage(speedlimit.image,-0.5*wPix,-0.5*hPix,wPix,hPix);

      if(false){
	console.log(
	  "in SpeedFunnel.draw: i=",i,
	  " fname=",speedlimit.image.src,
	  " xPix=",formd(speedlimit.xPixDepot),
	  " yPix=",formd(speedlimit.yPixDepot),
	  " wPix=",formd(wPix),
	  " hPix=",formd(wPix));
      }
    }
  }
} // draw



//######################################################################
// pick speed-limit sign in depot (state: passive) by user action
//######################################################################


/**
@param  xUser,yUser: the external pixel position
@param  distCrit:    only if the distance to the nearest veh in the depot
                     is less than distCrit [Pix], the operation is successful
@return [successFlag, thePickedVeh]
*/


SpeedFunnel.prototype.pickInDepot=function(xPixUser,yPixUser,distCrit){
  var dist2_min=1e9;
  var dist2_crit=distCrit*distCrit;
  var speedlReturn=null;
  var success=false;
  for(var i=0; i<this.speedl.length; i++){
    if(!this.speedl[i].isActive){
      var dist2=Math.pow(xPixUser-this.speedl[i].xPixDepot,2)
	+ Math.pow(yPixUser-this.speedl[i].yPixDepot,2);
      if( (dist2<dist2_crit) && (dist2<dist2_min)){
	success=true;
	dist2_min=dist2;
	speedlReturn=this.speedl[i];
      }
      //console.log("i=",i," dist2=",dist2," success=",success);
    }
  }

  if(true){
    console.log("SpeedFunnel.pickInDepot: ",
		( (success) ? "successfully picked speedlimit "+formd(3.6*speedlReturn.value) : "no sign picked"));
  }

  return[success,speedlReturn];
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
