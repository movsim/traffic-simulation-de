//############################################
// resize canvas to fit client dimension on initialization 
// or whenever client size changed (e.g. rotating on smartphones)
// responsive design
// aspect ratio (width/heigh denotes limits where width or height 
// is limit to increase scale
// needs document.getElementById("mainTable")
// returns if canvas size has changed
//############################################

function canvas_resize(canvas,aspectRatio){
    var hasChanged=false;

// get dimensions/position of the main table above the canvas 
// relative to the global document.body element <body>...</body>

    var tab=document.getElementById("mainTable");

    // access frames:  window=simwindow with frames
    // just window (obviously standard name?) w/o frames => window!
/*
    var simwindow = parent.sim;
    var navwindow = parent.navigation;

    console.log("document.body.offsetWidth=",document.body.offsetWidth,
		"document.body.offsetHeight=",document.body.offsetHeight,
		" window.innerWidth=",window.innerWidth,
		" window.innerHeight=",window.innerHeight,
		" simwindow.innerWidth=",simwindow.innerWidth,
		" simwindow.innerHeight=",simwindow.innerHeight,
		" navwindow.innerWidth=",navwindow.innerWidth,
		" navwindow.innerHeight=",navwindow.innerHeight);
*/


   // height of actual simulation; 
    // restrict upper navig eleents to 30% of total height! set it to at 
    var yPixCanvasTop=tab.getBoundingClientRect().bottom
    yPixCanvasTop=Math.min(yPixCanvasTop,0.3*window.innerHeight);

    // document.body.offsetWidth smaller than window.innerWidth
    // cannot use window.innerWidth because of scrollbars

    var newWidth=Math.round(document.body.offsetWidth); 
    var newHeight=Math.round(window.innerHeight-yPixCanvasTop); 

    //console.log("yPixCanvasTop=",yPixCanvasTop,
//		" window.innerHeight=",window.innerHeight);

    if (canvas.width!=newWidth){
	hasChanged=true;
	canvas.width  = newWidth;
    }

    if (canvas.height != newHeight){
	hasChanged=true;
        canvas.height  = newHeight;
    }

    if(false){
      console.log(" canvas.width=",canvas.width);
      console.log(" canvas.height=",window.innerHeight);

      console.log("document.body.offsetWidth=",document.body.offsetWidth);
      console.log("document.body.offsetHeight=",document.body.offsetHeight);
    }	


    if(hasChanged){
        center_x=0.50*canvas.width; // pixel coordinates
        center_y=0.48*canvas.height;
	var refDim=Math.min(canvas.width,canvas.height*aspectRatio);

        // global scale pixel/m;
	scale=refDim/sizePhys;  
	//console.log("scale=",scale," hasChanged=",hasChanged);
    }
    return hasChanged;
}

