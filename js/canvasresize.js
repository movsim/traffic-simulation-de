//############################################
// resize canvas to fit client dimension on initialization 
// or whenever client size changed (e.g. rotating on smartphones)
// responsive design
// aspect ratio (width/heigh denotes limits where width or height 
// is limit to increase scale
// returns if canvas size has changed
//############################################

function canvas_resize(canvas,aspectRatio){
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

