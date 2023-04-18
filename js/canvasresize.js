//############################################
// resize canvas to fit client dimension on initialization 
// or whenever client size changed (e.g. rotating on smartphones)
// responsive design
// aspect ratio (width/heigh denotes limits where width or height 
// is limit to increase scale
// returns if canvas size has changed
//############################################

function canvas_resize(canvas,limAspectRatio){
    var hasChanged=false;

    var simDivWindow=document.getElementById("contents");

    // access frames:  window=simwindow with frames
    // just window (obviously standard name?) w/o frames => window!

    //var simwindow = parent.sim;        // only frames
    //var navwindow = parent.navigation; // only frames


    if (canvas.width!=simDivWindow.clientWidth){
	hasChanged=true;
	canvas.width  = simDivWindow.clientWidth;
    }

    if (canvas.height != simDivWindow.clientHeight){
	hasChanged=true;
        canvas.height  = simDivWindow.clientHeight;
    }

    if(false){
       console.log("document.body.offsetWidth=",document.body.offsetWidth,
		  "document.body.offsetHeight=",document.body.offsetHeight,
		  " window.innerWidth=",window.innerWidth,
		  " window.innerHeight=",window.innerHeight,
		  " simDivWindow.clientWidth=",simDivWindow.clientWidth,
		   " simDivWindow.clientHeight=",simDivWindow.clientHeight,
		   " canvas.width=",canvas.width,
		  " canvas.height=",canvas.height
	       );


    }	


  /* refDim is relevant canvas dimension (pixels) for determining the scale
     factor (pixels/m) by comparing refDim 
     with reference physical size refSizePhys: refDim is canvas height 
     if actual aspect ratio is  greater than limit aspect ratio, 
     otherwise width/limAspectRatio
  */ 

    if(hasChanged){
	//var refDim=Math.min(canvas.width,canvas.height*limAspectRatio);
	var refDim=Math.min(canvas.height,canvas.width/limAspectRatio);
	scale=refDim/refSizePhys;  
	console.log(" canvasresize: width=",canvas.width,
		    " height=",canvas.height," refDim=",
		    refDim," refSizePhys=",refSizePhys," scale=",);
    }
    return hasChanged;
}

