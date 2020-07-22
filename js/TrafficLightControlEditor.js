
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

@param trafficObjects: instance of TrafficObjects to get the active TLs
@param xRelEditor: relative x position of center of editor panel in the canvas
@param yRelEditor: relative y position (increasing if up)
*/

function TrafficLightControlEditor(trafficObjects,
				   xRelEditor,yRelEditor){


  this.xRelEditor=xRelEditor;
  this.yRelEditor=yRelEditor;
 
  // all graphical variables in .display apart from some vertical data
  // needed for several functions

  var sizeCanvas=Math.min(canvas.width, canvas.height);
  this.dyTopFirstSlider=0.15*wrel*sizeCanvas; // 0.15 panel width below top
  this.dySlider=0.10*wrel*sizeCanvas; // dist between sliders 0.1 panel width

  // create image repositories

  this.knobYellow = new Image();
  this.knobYellow.src="figs/knobYellow.png";
  this.buttonDone = new Image();
  this.buttonDone.src="figs/buttonDone.png";

  this.cycleTimes=[30,40,50,60,80,100,120];
  this.cycleTime=this.cycleTimes[30];


  this.doubleSliders=[]; // as many elements as active or passive TLs

  var iTL=0;
  for(var i=0; i<trafficObjects.trafficObj.length; i++){
    var trafficObj=trafficObjects.trafficObj[i];
    if(trafficObj.type==="trafficLight"){
      this.doubleSliders[iTL]={
	id: trafficObj.id, // same as corresponding trafficObject
        isDisplayed: false, // true only if trafficObject is TL on road
        isActive: false, // true only if added to control
        left:  {isActive: false, relValue: 0, xyPix: [0,0]},
        right: {isActive: false, relValue: 1, xyPix: [0,0]}
      };
      iTL++;
    }
  }

    
  // logging

  if(true){
    console.log("TrafficLightControlEditor Cstr: this.doubleSliders[0]=",
		this.doubleSliders[0]);
  }

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
  this.dyTopFirstSlider=0.15*wrel*sizeCanvas; // 0.15 panel width below top
  this.dySlider=0.10*wrel*sizeCanvas; // dist between sliders 0.1 panel width
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
// get pixel coordinates of the knobs of  the iDisplay'th displayed slider
// canvas as global var
// ###########################################################

TrafficLightControlEditor.prototype.get_xyPix=function(iDisplay, valRel){
  var sizeCanvas=Math.min(canvas.width, canvas.height);
  var wrel=0.4;  // width relative to minimum of canvas width,height 
  var xrelSelect=0.04; // position of activate/deactivate select button
  var xrelBeginSlider=0.08; // all relative to editor panel
  var xrelEndSlider=0.98;
  var xrel=xrelBeginSlider+valRel*(xrelEndSlider-xrelBeginSlider);
  var xPix=sizeCanvas*(this.xRelEditor+wrel*(xrel-0.5));


  var yPix=canvas.height*(1-this.yRelEditorxrelPick)
    + this.dyTopFirstSlider + iDisplay*this.dySlider;
  return [xPix, yPix];
}



/**
##########################################################
TrafficLightControlEditor: display the editor panel
##########################################################

@param trafficObjects: instance of TrafficObjects to get the active TLs
@param xRelEditor: relative x position of center of editor panel in the canvas
@param yRelEditor: relative y position (increasing if up)
@global: canvas
*/

TrafficLightControlEditor.prototype.display=function(){

}


