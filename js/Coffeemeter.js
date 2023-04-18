//#################################################
/** coffeemeter to visualizations accelerations and jerks
represents oscillating coffee surface whose normal vector 
n=(x,y,sqrt(1-x^2-y^2)) (x in lateral and y in driving direction)
obeys the equations of motion of a mathematical, linear, twodimensional, 
damped, forced pendulum,

   ddot(x)+2/tau*dot(x)+omega_0^2*x=+ax/r
   ddot(y)+2/tau*dot(y)+omega_0^2*y=+ay/r

if the (approximate) angle angSurf=sqrt(x^2+y^2) exceeds angSurfSpill,
coffee is spilt over the rim at the nearest of nStains locations 
distributed uniformly along the rim. Simultaneously, the amplitude 
of the surface oscillations is reduced to angSurfSpill, and the angular
velocity is reduced accordingly

The amount of spilt coffee at each location is measured 
in terms of the cumulative excess angle angSurf-angSurfSpill

Once coffee is spilt at a given location, it evaporates at a constant rate 
evap=dot(angSurf), independently of the situation at the other locations

Notice that there is no mass conservation of the coffee volume
since the amount inside the cup remains constant and the source terms 
spilling and evaporating only cancel each other in the mean.

*/
//##############################################################




//##############################################################
/**
Coffeemeter constructor
the screen size of the Coffeemeter is proto diam*f/sdist
the viewing direction nShoot and the camera setting (f etc) 
is set internally; the viewing distance is a parameter of the 
Coffeemeter's draw function

@param cupImgBack:   image of back or complete cup
@param cupImgFront:  image of front part (to be drawn after surface)
@param diam:         diameter of cup [m]
@param dist:         observing distance driver-coffee cup [m]
@param xRelCoffee:   center of coffeemeter relative to canvas (frac right)
@param yRelCoffee:   center of coffeemeter relative to canvas (frac bottom)
@param tau:          damping time constant [s]
@param angSurfSpill: angle [rad] of coffee surface where spilling begins
@param evap:         evaporation rate of coffee stains [rad/s]

@return:             Coffeemeter instance (constructor)
*/
//##############################################################

 
function Coffeemeter(cupImgBack,cupImgFront,
		     diam,dist,xRelCoffee,yRelCoffee,
		     tau,angSurfSpill,evap){

    // quantities that possibly need to be tuned here
    // (more parameters to be finetuned in the prototype.draw method!) 

    this.stainVolMax=2.; // max spilled coffee [rad] to avoid complete pigsty

    this.cupImgBack=cupImgBack;
    this.cupImgFront=cupImgFront;
    this.diam=diam; 
    this.dist=dist; 
    this.xRelCoffee=xRelCoffee; 
    this.yRelCoffee=yRelCoffee; 
    this.tau=tau;
    this.angSurfSpill=angSurfSpill;
    this.evap=evap;
    this.stainVolMax=2.; // maximum spilled coffee to avoid 
                         // a complete pigsty
    this.g=9.81;
    this.omega0=Math.sqrt(this.g/diam);

    if(tau<1.01/this.omega0){
	this.tau=1.01/this.omega0;
	console.log("damping time constant too small for periodic motion");
        console.log("resetting to nearly aperiodic limiting case",
		    " tau=1.01/omega0=",tau);
	this.tau=Math.sqrt(this.g/diam);
    }


    this.x=0; // angle of surface normal [rad] in long (u) direction
    this.y=0; // .. in lateral (v) direction. start with zero angles
    this.dotx=0; // start with zero angular speeds
    this.doty=0; 

    // stains at nStains different fixed places at angles 
    // phi_i=iStain*2*pi/nStains; 
    // stains[i]=cumulative not evaporated spilt coffee in terms of 
    // cumulative excess angle over the rim at rim angle phi_i

    this.nStains=12;          
    this.stains=new Array(this.nStains); 
    this.stains.fill(0); // initially, no spilt coffee
}



//##############################################################
/**
update coffee surface as a function of the long and lat accelerations 
model the coffee surface as a 2d linear damped forced pendulum

     ddot(x)+2/tau*dot(x)+omega_0^2*x=+ax/r
     ddot(y)+2/tau*dot(y)+omega_0^2*y=+ay/r

use explicit exact solutions for piecewise constant accelerations since 
simple Euler/ballistic approaches are problematic for oscillatory motion

@param ax:  lateral acceleration [m/s^2]
@param ay:  longitudinal acceleration [m/s^2]
@param dt:  time increment [s]

@return:    none; changes states of this.x, y, dotx, doty, stains[]
            this.x=phi_x=surface normal in right lat direction
            this.y=phi_y=surface normal in positive long direction
*/
//##############################################################

Coffeemeter.prototype.updateSurface=function(ax,ay,dt){

    var omega=Math.sqrt(this.g/this.diam-1./Math.pow(tau,2));


    // update x component (angle in lateral direction)

    var Ax=this.x-ax/this.g;
    var Bx=this.dotx/omega + (this.x-ax/this.g)/(this.tau*omega);
    this.x=(Ax*Math.cos(omega*dt)+Bx*Math.sin(omega*dt))
        * Math.exp(-dt/this.tau) + ax/this.g;
    this.dotx= - (Ax*Math.cos(omega*dt)+Bx*Math.sin(omega*dt))
        * Math.exp(-dt/this.tau)/this.tau
	+ (Bx*Math.cos(omega*dt)-Ax*Math.sin(omega*dt))
        * omega * Math.exp(-dt/this.tau)


    // update y component (angle in driving direction)
 
    var Ay=this.y-ay/this.g;
    var By=this.doty/omega + (this.y-ay/this.g)/(this.tau*omega);
    this.y=(Ay*Math.cos(omega*dt)+By*Math.sin(omega*dt))
        * Math.exp(-dt/this.tau) + ay/this.g;
    this.doty= - (Ay*Math.cos(omega*dt)+By*Math.sin(omega*dt))
        * Math.exp(-dt/this.tau)/this.tau
	+ (By*Math.cos(omega*dt)-Ay*Math.sin(omega*dt))
        * omega * Math.exp(-dt/this.tau)


    // evaporate some coffee spilled in the past

    for(var istain=0; istain<this.nStains; istain++){ 
	this.stains[istain]=Math.max(0.,this.stains[istain]-evap*dt);
    }


    // check for new spills and, if applicable, add the newly spilt coffee
    // to the stain that is nearest of the rim location of the spilling

    if(true){
      console.log("Coffeemeter.updateSurface: before treating spills:",
		"\n lat right: x=phi_x=",this.x,
		"\n dotphi_x=",this.dotx,
		"\n long front: y=phi_y=",this.y,
		"\n dotphi_y=",this.doty
	       );
    }

    var angSurf=Math.sqrt(this.x*this.x+this.y*this.y);
    var excess=Math.max(angSurf-this.angSurfSpill, 0.);
    if(excess>0){

	var xSpill=-this.x; // location of spilled coffee opposite 
	var ySpill=-this.y; // to surface normal vector x and y components

        // calculating the angle via arctan is somewhat nontrivial!

	angle=(Math.abs(xSpill)>1e-6) 
	    ? Math.atan(ySpill/xSpill) :  0.5*Math.PI;
	if(xSpill<0){angle+=Math.PI;}
	if((xSpill>0)&&(ySpill<0)){angle+=2*Math.PI;}

        // add to nearest stain

	var iStain=Math.round(this.nStains*angle/(2*Math.PI)-0.5);
	this.stains[iStain] += excess;
	this.stains[iStain]=Math.min(this.stains[iStain],this.stainVolMax);
	if(true){
	    console.log(" Coffeemeter: spill event happened!",
			" excess=",parseFloat(excess).toFixed(2),
			" spill direction nx=",parseFloat(xSpill).toFixed(2),
			" ny=",parseFloat(ySpill).toFixed(2),
			" angle=",parseFloat(angle).toFixed(2),
			" iStain=",iStain
		       );
	}
    }


    // if coffee is spilt, reduce amplitude to just the rim
    // (no coffee mass conservation ;-) )

    if(excess>0){
        var reduceFact=this.angSurfSpill/angSurf;
	this.x*=reduceFact; 
	this.y*=reduceFact; 
	this.dotx*=reduceFact;
	this.doty*=reduceFact;
    }


    // some test/debugging output

    if(false&&(excess>0)){
      console.log("Coffeemeter.updateSurface: after treating spills",
		"\n phi_x=",this.x,
		"\n dotphi_x=",this.dotx,
		"\n phi_y=",this.y,
		"\n dotphi_y=",this.doty,
		"\n[excess,angle]=",[excess,angle]
	       );
    }
    if(false){
	for(var istain=0; istain<this.nStains; istain++){
	    //this.stains[istain]=0.1*(1+istain); //!!!
	    console.log(" stains[",istain,"]=",this.stains[istain]);
	}
    }

}//Coffeemeter.prototype.updateSurface



Coffeemeter.prototype.setLevelSurface=function(){
    this.x=0;
    this.y=0;
    this.dotx=0;
    this.doty=0;
    this.stains.fill(0); // fill stains array with zeros
}


//##############################################################
/**
draw the coffee cup including coffee surface and spilt coffee stains
into the graphics context ctx.
The screen size of the Coffeemeter is proto diam*f/sdist
the viewing direction nShoot and the camera setting (f etc) 
is set internally

@param canvas:       the canvas to draw to
@param dist:         the distance to the Coffeemeter

@return:             Coffeemeter instance (constructor)
*/
//##############################################################


Coffeemeter.prototype.draw=function(canvas){

 

    // finetune by changing the following values

    var diam=this.diam;     // to save typing
    var dist=this.dist;
    var angSurfSpill=this.angSurfSpill;

    var f=60;               // focal length for 24mm X 36mm film

    var xPixCoffee=canvas.width*this.xRelCoffee;
    var yPixCoffee=canvas.height*this.yRelCoffee;
    var wPixCoffee=canvas.width*diam/dist * (2.3*f/50); // rect background
    var hPixCoffee=0.6*wPixCoffee; //!! only valid for specific cup image
    var vertShiftCupPix=0.2*angSurfSpill*hPixCoffee; //cup rim - coffee surface

    if(false){
	console.log("Coffeemeter.draw: xPixCoffee=",xPixCoffee,
		    " yPixCoffee=",yPixCoffee,
		    " wPixCoffee=",wPixCoffee,
		    " hPixCoffee=",hPixCoffee);
    }


    // x=to right, y=forwards, z=to top
    // to connect coffeemeter to microsim coord system x=forwards, y=to right
    // swap x and y!!

    var nShoot=[0,1,-0.40]; // (match perspective of selected image!)
    var rotCamera=0;        // camera in landscape orientation
    var e1Horiz=[1,0,0];    // physical x direction (= 1-dir of level surface)
    var e2Horiz=[0,1,0];    // physical y direction (= 2-dir of level surface)
    var e1Cup=[1,0,0];      // physical 1-direction of the "cup billboard"
    var e2Cup=[0,0,-1];     // physical 2-direction; [2]<0 since yPix downwards

    var coffeeColor="rgb(120,30,30)";
    var coffeeStrokeColor="rgb(0,0,0)";
    var stainColor="rgba(120,30,30,0.5)";
    var stainStrokeColor="rgba(0,0,0,0.5)";


    // calculated quantities

    var wPixCup=this.cupImgBack.naturalWidth; // cupImgBack=complete cup image
    var hPixCupBack=this.cupImgBack.naturalHeight;
    var hPixCupFront=this.cupImgFront.naturalHeight;
    if(false){console.log("cupImgFront: wPix=",this.cupImgFront.naturalWidth,
		" hPix=",this.cupImgFront.naturalHeight,
		"\ncupImgBack: wPix=",this.cupImgBack.naturalWidth,
		" hPix=",this.cupImgBack.naturalHeight);
	     }

    var nShootNorm=Math.sqrt(nShoot[0]*nShoot[0]
			     +nShoot[1]*nShoot[1]+nShoot[2]*nShoot[2]);
    for (var i=0; i<3; i++){nShoot[i] /=nShootNorm;}
    var dr=[this.dist*nShoot[0],this.dist*nShoot[1],this.dist*nShoot[2]];

    // clear previous drawings

    // test with orange background (set if(false) after testing)

    ctx = canvas.getContext("2d");
    ctx.setTransform(1,0,0,1,0,0);

    if(false){
      ctx.fillStyle="rgb(255,240,200)";
      ctx.fillRect(0,0,canvas.width,canvas.height);
    }

    //console.log("wPixCoffee=",wPixCoffee," hPixCoffee=",hPixCoffee);

    if(false){
      ctx.setTransform(1,0,0,1,xPixCoffee,yPixCoffee);
      ctx.fillStyle="orange";
      ctx.fillRect(-0.5*wPixCoffee,-0.5*hPixCoffee,wPixCoffee,hPixCoffee);
    }


    // draw back part of empty cup

    var scaleCup=0.62*wPixCup/diam; // wPix=cup with saucer bigger than diam
    var e1Cup=[e1Horiz[0], e1Horiz[1], e1Horiz[2]]; // cup remains horizontal
    var e2Cup=[0,0,-1]; // since yPix downwards
    var affCup=affineTransformGraphics(dr, e1Cup, e2Cup, scaleCup, 
				    nShoot, rotCamera, f, canvas.width);
    if(affCup[6]){
	ctx.setTransform(affCup[0],affCup[1],affCup[2],affCup[3],
			 affCup[4]+xPixCoffee,
			 affCup[5]+yPixCoffee-vertShiftCupPix);

	ctx.drawImage(this.cupImgBack, 
		      -0.5*wPixCup,-hPixCupBack,
		      wPixCup,hPixCupBack);
    }
    else{
	console.log(" some problems with affine transform affCup");
	return;
    }


    // draw coffee surface

    var scale=200/diam; // so that radius of arc cmds=100 pixels
    var e1=[e1Horiz[0], e1Horiz[1], e1Horiz[2]-coffeemeter.x];
    var e2=[e2Horiz[0], e2Horiz[1], e2Horiz[2]-coffeemeter.y];
  var aff=affineTransformGraphics(dr, e1, e2, scale, nShoot, rotCamera, f, 
				 canvas.width);
    
    if(aff[6]){ // seventh element of return array is success flag
	ctx.setTransform(aff[0],aff[1],aff[2],aff[3],
			 aff[4]+xPixCoffee,aff[5]+yPixCoffee);

	ctx.beginPath();
	ctx.strokeStyle=coffeeStrokeColor;
	ctx.fillStyle=coffeeColor;
        // ctx.arc(xc,yc,r,sAngle,eAngle,counterclockwise)
	ctx.arc(0,0,100,0*Math.PI, 2*Math.PI,true);
	ctx.fill();                       // first fill, then stroke!
	ctx.stroke(); 
	ctx.closePath();
    }
    else{
	console.log(" some problems with affine transform aff");
	return;
    }


    // draw front part of empty cup

    ctx.setTransform(affCup[0],affCup[1],affCup[2],affCup[3],
		     affCup[4]+xPixCoffee,
		     affCup[5]+yPixCoffee-vertShiftCupPix);

    ctx.drawImage(this.cupImgFront, 
		  -0.5*wPixCup,0*hPixCupFront,
		  wPixCup,hPixCupFront);


    // draw coffee stains after spilling

    for(var istain=0; istain<this.nStains; istain++){
	var stainVol=coffeemeter.stains[istain];
	var phi=istain*2*Math.PI/this.nStains;
	if((stainVol>1e-6) && (Math.abs(phi-0.5*Math.PI)>1.1)){

            // draw stains on the saucer

	    var cosphi=Math.cos(phi);
	    var sinphi=Math.sin(phi);
	    var drStain=[dr[0]+0.7*diam*cosphi,
			 dr[1]+0.7*diam*sinphi,
			 dr[2]-0.4*diam];
	    var affStain= affineTransformGraphics(
	      drStain, e1Horiz, e2Horiz,  scale, nShoot, rotCamera, f, 
	      canvas.width);

	    ctx.setTransform(affStain[0], affStain[1], affStain[2],
			     affStain[3], affStain[4]+xPixCoffee,
			     affStain[5]+yPixCoffee);

	    ctx.beginPath();
	    ctx.strokeStyle=stainStrokeColor;
	    ctx.fillStyle=stainColor;
 	    ctx.arc(0,0,50*Math.sqrt(stainVol),0*Math.PI, 2*Math.PI,true);
	    ctx.fill();               // first fill, then stroke!
	    ctx.stroke();
	    ctx.closePath();

            // draw spilt coffee on outer side of cup 

	    if(Math.abs(phi-0.5*Math.PI)>1.6){
		var phiOverhang=0.2; // cup walls on average overhanging
		var cosOverh=Math.cos(phiOverhang);
		var sinOverh=Math.sin(phiOverhang);
		var drWall=[dr[0]+0.48*diam*cosphi, // drWall[2], "0.??*diam"
			    dr[1]+0.48*diam*sinphi, // related to
			    dr[2]+0.12*diam];      // vertShiftCupPix 
		var e1Wall=[-sinphi,cosphi,0];
		var e2Wall=[sinOverh*cosphi,sinOverh*sinphi,cosOverh]
		var affWall= affineTransformGraphics(
		  drWall, e1Wall, e2Wall, scale, nShoot, rotCamera, f, 
		    canvas.width);
                // elongate result vertically
		ctx.setTransform(0.6*affWall[0],0.6*affWall[1],1.6*affWall[2],
				 1.6*affWall[3], affWall[4]+xPixCoffee,
				 affWall[5]+yPixCoffee);
		ctx.beginPath();
 		ctx.arc(0,0,50*Math.sqrt(stainVol),1*Math.PI,2*Math.PI,false);
		ctx.fill();                // first fill, then stroke!
		ctx.stroke(); 
		ctx.closePath();
	    }

	} // stain istain exists
    } // loop over all this.nStains stains
}
