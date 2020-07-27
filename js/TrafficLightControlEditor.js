
/*#############################################################
* implements a fixed-time traffic light control 

  - all traffic lights (TLs) dragged onto a road segment are eligible

  - an active TL can be included into the control or not. If so, the 
    relative duration and phase of the green period 
    can be set in the editor panel

  - info of active TLs is obtained from TrafficObjects

  - as callback of an html button "controlTrafficLights()", 
    an editor panel opens (trafficLightControl.openEditPanel()

  - as callback of the close button in the editor panel, 
    the new information is transferred to TrafficObjects 
    which does the actual control 



#############################################################
*/




/**
##########################################################
TrafficLightControlEditor object constructor
##########################################################

@param trafficObjects: instance of TrafficObjects to get the active TLs
@param xRelEditor: relative x position of center of editor panel in the canvas
@param yRelEditor: relative y position (increasing if up)
*/

function TrafficLightControlEditor(trafficObjects,
				   xRelEditor,yRelEditor){


  this.active=false;


  // create image repositories

  this.knobYellow = new Image();
  this.knobYellow.src="figs/knobYellow.png";
  this.buttonDone = new Image();
  this.buttonDone.src="figs/buttonDone.png";

  this.cycleTimes=[30,40,50,60,80,100,120];
  this.cycleTimeIndex=3;
  this.cycleTime=this.cycleTimes[this.cycleTimeIndex];


  this.doubleSliders=[]; // as many elements as active or passive TLs

  var iTL=0;
  for(var i=0; i<trafficObjects.trafficObj.length; i++){
    var trafficObj=trafficObjects.trafficObj[i];
    if(trafficObj.type==="trafficLight"){
      this.doubleSliders[iTL]={
	id: trafficObj.id, // same as corresponding trafficObject
        isDisplayed: false, // true only if trafficObject is TL on road
        isActive: ((iTL<2) ? true : false), // true if added to control !!!
        left:  {isActive: false, relValue: 0.2+iTL*0.3, xyPix: [0,0]},//!!!
        right: {isActive: false, relValue: 0.6-iTL*0.3, xyPix: [0,0]}//!!!
      };
      console.log("TrafficLightControlEditor Cstr: iTL=",iTL,
		  " this.doubleSliders[iTL]=",this.doubleSliders[iTL]);
      this.doubleSliders[iTL].left.relValue=Math.max(0, Math.min(1,this.doubleSliders[iTL].left.relValue)); //!!!
      this.doubleSliders[iTL].right.relValue=Math.max(0, Math.min(1,this.doubleSliders[iTL].right.relValue));//!!!

      iTL++;//!!!
    }
  }
  this.nTL=iTL;

  // basic graphics properties

  this.xRelEditor=xRelEditor;
  this.yRelEditor=yRelEditor;
  this.wrel=0.7;  // width relative to minimum of canvas width,height 
  this.hrel=this.wrel*(0.2+0.08*this.nTL);

    
} // end TrafficLightControlEditor Cstr


//#########################################################
// find the slider by its id
//#########################################################

TrafficLightControlEditor.prototype.getSlider=function(id){
  for(var iTL=0; iTL<this.doubleSliders.length; iTL++){
    if(this.doubleSliders[iTL].id===id){
      return this.doubleSliders[iTL];
    }
  }
  console.log("TrafficLightControlEditor.getSlider: no slider found",
	      " with id",id);
  return null;
}

// ##############################################################
// resize relevant variables if display port has been resized
// ##############################################################

TrafficLightControlEditor.prototype.resize=function(canvas){
  var sizeCanvas=Math.min(canvas.width, canvas.height);
  this.dyTopFirstSlider=0.15*this.wrel*sizeCanvas; // 0.15 panel width below top
  this.dySlider=0.10*this.wrel*sizeCanvas; // dist between sliders 0.1 panel width
}

/**
##########################################################
TrafficLightControlEditor: update info from TrafficObjects
##########################################################

@param trafficObjects: instance of TrafficObjects 
to get the status of all TLs of trafficObjects 
*/

TrafficLightControlEditor.prototype.update=function(trafficObjects){
  var iDisplay=0;
  for(var i=0; i<trafficObjects.trafficObj.length; i++){
    var trafficObj=trafficObjects.trafficObj[i];
    if(trafficObj.type==="trafficLight"){
      var slider=this.getSlider(trafficObj.id);
      if(trafficObj.isActive){
	slider.isDisplayed=true;  // slider.isActive, left.value ... by GUI
	slider.left.xyPix=this.get_xyPix(iDisplay,slider.left.relValue);
	slider.right.xyPix=this.get_xyPix(iDisplay,slider.right.relValue);
	iDisplay++;
      }
      else{ // reset slider if dragged from road
	slider.isDisplayed=false;
	slider.left.isActive=false;
	slider.left.relValue=0;
	slider.right.isActive=false;
	slider.right.relValue=1;
      }
    }
  }
}

// ###########################################################
// get pixel coordinates of the editor panel as f(xrel, yrel)
// ###########################################################

TrafficLightControlEditor.prototype.get_xyPix=function(xrel,yrel){
  var sizeCanvas=Math.min(canvas.width, canvas.height);
  var xPix=canvas.width*this.xRelEditor + sizeCanvas*this.wrel*(xrel-0.5);
  var yPix=canvas.height*(1-this.yRelEditor)-sizeCanvas*this.hrel*(yrel-0.5);
  return [xPix, yPix];
}

TrafficLightControlEditor.prototype.get_xPix=function(xrel){
  var sizeCanvas=Math.min(canvas.width, canvas.height);
  var xPix=canvas.width*this.xRelEditor + sizeCanvas*this.wrel*(xrel-0.5);
  return xPix;
}

TrafficLightControlEditor.prototype.get_yPix=function(yrel){
  var sizeCanvas=Math.min(canvas.width, canvas.height);
  var yPix=canvas.height*(1-this.yRelEditor)-sizeCanvas*this.hrel*(yrel-0.5);
  return yPix;
}


// ###########################################################
// get pixel coordinates of the knobs of  the iDisplay'th displayed slider
// canvas as global var
// ###########################################################

TrafficLightControlEditor.prototype.get_xyPixSlider=function(iDisplay, valRel){
  var sizeCanvas=Math.min(canvas.width, canvas.height);
  var xrelBeginSlider=0.20; // all relative to editor panel
  var xrelEndSlider=0.97;
  var xrel=xrelBeginSlider+valRel*(xrelEndSlider-xrelBeginSlider);
  var xPix=this.get_xPix(xrel);
  var yrelTop=1-this.wrel/this.hrel*0.2;
  var yPix=this.get_yPix(yrelTop*(1-iDisplay/this.nTL));
  return [xPix, yPix];
}



/**
##########################################################
TrafficLightControlEditor: display the editor panel
##########################################################

@global: canvas
*/

TrafficLightControlEditor.prototype.showEditPanel=function(){
  console.log("in TrafficLightControlEditor.showEditPanel");

  var sizeCanvas=Math.min(canvas.width, canvas.height);
  var textsize=0.02*sizeCanvas;
  ctx.font=textsize+'px Arial';

  var colRed="rgb(255,0,0)";
  var colGreen="rgb(0,255,0)";
  var colAmber="rgb(255,180,0)";
  var colBg="rgb(220,220,220)";
  var colDeactivate="rgba(220,220,220,0.85)";

  var hSlider=0.6*(this.get_xyPixSlider(1,0)[1]-this.get_xyPixSlider(0,0)[1]);
  var wSlider=this.get_xyPixSlider(0,1)[0]-this.get_xyPixSlider(0,0)[0];

  // draw editor panel background 

  var leftUpper=this.get_xyPix(0,1);
  var rightLower=this.get_xyPix(1,0);
  var w=rightLower[0]-leftUpper[0];
  var h=rightLower[1]-leftUpper[1];
  ctx.fillStyle=colBg;
  ctx.fillRect(leftUpper[0], leftUpper[1], w, h);
  if(false){
    console.log("canvas.width=",canvas.width,
		" canvas.height=",canvas.height,
		"\nthis.wrel=",this.wrel,
		" this.hrel=",this.hrel,
		"\nthis.get_xyPix(1,1)=",this.get_xyPix(1,1),
		"\nleftUpper=",leftUpper,
		"\nrightLower=",rightLower,
		"\nw=",w," h=",h);
  }


  // draw selector circles for the common cycle time

  ctx.fillStyle="rgb(0,0,0)";
  var xyPix=this.get_xyPix(0.03,0.90);
  ctx.fillText("Common cycle time:", xyPix[0], xyPix[1]);
  var str_cycTime=["30 s", "40 s", "50 s", "60 s", "80 s", "100 s", "120 s"];
  var radius=0.012*sizeCanvas;
  for(var i=0; i<str_cycTime.length; i++){
    xyPix=this.get_xyPix(0.37+i*0.09,0.93);
    ctx.beginPath();
    ctx.arc(xyPix[0], xyPix[1],radius, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.fillText(str_cycTime[i], xyPix[0]-1.5*radius, xyPix[1]+3*radius);
  }

  xyPix=this.get_xyPix(0.37+this.cycleTimeIndex*0.09,0.93);
  ctx.beginPath();
  ctx.arc(xyPix[0], xyPix[1],radius, 0, 2 * Math.PI);
  ctx.fill();


  // draw "activate" heading

  var xPix=this.get_xPix(0.03);
  var yPix=this.get_xyPixSlider(-1,0)[1];
  ctx.fillText("Activate", xPix, yPix);

  // draw timescale

  var nTicks=5;

  yPix=this.get_xyPixSlider(-0.5,0)[1];
  for(var i=0; i<=nTicks; i++){
    var t=Math.round(i*this.cycleTime/nTicks);
    xPix=this.get_xyPixSlider(-1,t/this.cycleTime)[0]-1.5*textsize;
    if(i==0){xPix+=textsize;}
    ctx.fillText(t+ " s", xPix, yPix);
  }


  // draw the actual phase control double sliders

  for(var i=0; i<this.nTL; i++){

    var xyPixBeginSlider=this.get_xyPixSlider(i,0);
    var xyPixEndSlider=this.get_xyPixSlider(i,1);

    // draw "activate" circles

    var xPix=this.get_xPix(0.08);
    var yPix=xyPixBeginSlider[1];
    ctx.beginPath();
    ctx.arc(xPix, yPix,radius, 0, 2 * Math.PI);
    if(this.doubleSliders[i].isActive){ ctx.fill(); }
    else{ ctx.stroke();}

    // draw double slider colors

    var valLeft=this.doubleSliders[i].left.relValue;
    var valRight=this.doubleSliders[i].right.relValue;
    var middleIsRed=(valLeft>valRight);
    var valLower=Math.min(valLeft,valRight);
    var valHigher=Math.max(valLeft,valRight);

    var xPixLeftArr=[xyPixBeginSlider[0],
		     xyPixBeginSlider[0]+wSlider*valLower,
		     xyPixBeginSlider[0]+wSlider*valHigher];
    var colArr=(middleIsRed) ? [colGreen,colRed,colGreen]
      : [colRed,colGreen,colRed];
    var wArr=[wSlider*valLower,
	      wSlider*(valHigher-valLower), 
	      wSlider*(1-valHigher)];
    var yPixUpper=xyPixBeginSlider[1]-0.5*hSlider;
    for(var is=0; is<3; is++){
      ctx.fillStyle=colArr[is];
      ctx.fillRect(xPixLeftArr[is], yPixUpper, wArr[is], hSlider);
    }

    // draw double slider slit 

    ctx.fillStyle="rgb(0,0,0)";
    ctx.strokeStyle="rgb(0,0,0)";
    xPixLeft=xyPixBeginSlider[0];
    yPixUpper=xyPixBeginSlider[1]-0.5*hSlider;
    var dw=0.08*hSlider;
    ctx.strokeRect(xPixLeft,yPixUpper,wSlider,hSlider);
    ctx.strokeRect(xPixLeft,yPixUpper+0.5*dw,wSlider,hSlider-dw);
    ctx.strokeRect(xPixLeft,yPixUpper+dw,wSlider,hSlider-2*dw);

    // draw double slider knobs

    xPix=xyPixBeginSlider[0]+wSlider*valLower-0.4*hSlider;
    yPix=xyPixBeginSlider[1]-0.85*hSlider;
    ctx.drawImage(this.knobYellow, xPix,yPix, 0.8*hSlider,1.6*hSlider);

    xPix=xyPixBeginSlider[0]+wSlider*valHigher-0.4*hSlider;
    ctx.drawImage(this.knobYellow, xPix,yPix, 0.8*hSlider,1.6*hSlider);


    // put gray veil over sliders if deactivated

    if(!this.doubleSliders[i].isActive){
    var dw=0.25*hSlider;
      ctx.fillStyle=colDeactivate;
      ctx.fillRect(xPixLeft-2*dw,yPixUpper-dw,wSlider+4*dw,hSlider+2*dw);
    }

    // revert colors

    ctx.fillStyle="rgb(0,0,0)"
    ctx.strokeStyle="rgb(0,0,0)"

  }

}


