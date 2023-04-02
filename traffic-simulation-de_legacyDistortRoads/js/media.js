/**
handles the media queries which should be the same as in the css file
!!! There is NO way to get the physical dimensions of the viewer, the best
one can do is to read the navigator.userAgent to determine if it is a mobile device
possibly also detectable with  window.devicePixelRatio>1

window=reserved word

*/

//!! make following var defs consistent with ../css/styleTrafficSimulationDe.css

var aspectRatioCrit=4./3.; // 1./1. or 6./5. or 4./3./
var windowSizeCrit=420; // my smartphone: min-width : 320px true
                        // min-width : 480px false
                        // my ipad: min-width : 480px true

function mqLandscape(){
    //return window.matchMedia( "(min-aspect-ratio: 6/5)").matches; // unreliable
    return window.innerWidth>aspectRatioCrit*window.innerHeight;
}

function mqMobile(){ 
    return (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent.toLowerCase()) );
}

function mqTablet(){
    return (/iPad|Tab/i.test(navigator.userAgent.toLowerCase()) );
}

function mqSmartphone(){
    //return mqMobile()&&(!mqTablet()); 
    return mqMobile()
	|| (window.innerWidth<windowSizeCrit) || (window.innerHeight<windowSizeCrit);
}

/*
no distinction tablet/mobile phone: 
  (i) both may have Android, 
  (ii) my Samsung J7 in portrait mode has 980X1677, my iPad 980X1170
*/



function displayMediaProperties(canvas,textsize){
    var ratio = window.devicePixelRatio || 1;
    // the window.matchMedia .. methods unrealible/not working although css works
    // use window.devicePixelRatio instead: ratio>1 corresp to min-resolution: 97dpi
    var ge96dpi=window.matchMedia("min-resolution: 96dpi").matches  //DOS
    var ge144dpi=window.matchMedia("min-resolution: 144dpi").matches // although 
    var ge192dpi=window.matchMedia("min-resolution: 192dpi").matches // css works

    ctx.setTransform(1,0,0,1,0,0); 

    ctx.font=textsize+'px Arial';

    var displayStr1="Canvas "+canvas.width+"X"+canvas.height;
    var displayStr2="Window "+window.innerWidth+"X"+window.innerHeight;
    //var displayStr3="maxw500:"+window.matchMedia( "(max-width: 500px)").matches;
    var displayStr3=mqLandscape() ? "Landscape" : "Portrait";
    var displayStr4="devicePixelRatio="+ratio;
    // window.resolution obscure, window.density not defined
    var displayStr5="ge96dpi="+ge96dpi+" ge144dpi="+ge144dpi+" ge192dpi="+ge192dpi;
    var displayStr6=(mqSmartphone()) ? "Smartphone" : (mqMobile()) ? "Tablet":"Desktop";
    var displayStr7=navigator.userAgent;

    var display_xlb=textsize;
    var display_ylb=9*textsize;
    var display_width=22*textsize;
    var display_height=7.2*textsize;
    ctx.fillStyle="rgb(255,255,255)";
    ctx.fillRect(display_xlb,display_ylb-display_height,display_width,display_height);
    ctx.fillStyle="rgb(0,0,0)";
    ctx.fillText(displayStr1, display_xlb+0.2*textsize, display_ylb-6.2*textsize);
    ctx.fillText(displayStr2, display_xlb+0.2*textsize, display_ylb-5.2*textsize);
    ctx.fillText(displayStr3, display_xlb+0.2*textsize, display_ylb-4.2*textsize);
    ctx.fillText(displayStr4, display_xlb+0.2*textsize, display_ylb-3.2*textsize);
    ctx.fillText(displayStr5, display_xlb+0.2*textsize, display_ylb-2.2*textsize);
    ctx.fillText(displayStr6, display_xlb+0.2*textsize, display_ylb-1.2*textsize);
    ctx.fillText(displayStr7, display_xlb+0.2*textsize, display_ylb-0.2*textsize);
    console.log("pixels per inch: getPPI()");
}
