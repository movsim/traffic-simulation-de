
/**
Note on implementing new models 
(example for longitudinal models; for lane-changing models in analogy)

(1) Define the constructor and implement all methods here

 - constructor such as function IDM(v0,T,s0,a,b)
   (can have other number and/or names of params as args)
 - .copy method (deep copy, needed when updating the model params)
 - .calcAcc(s,v,vl,al)  (fixed interface)
 - .calcAccGiveWay(sNew, v, vPrio) (fixed interface) 
   (is not yet used, so can be omitted at the moment).

(2) Define/update the initial model parameters such as IDM_v0 
and the template models longModelCar, longModelTruck, longModelTruckUphill
in control_gui.js. 
If new parameters should be user-controlled, new sliders can also be 
implemented here, and defined in the corresponding .html files. 
(Sliders no longer needed can simply be commented out in the html files)


(3) Step 2 is the default for all scenarios. 
In scenarios requiring different initial values, this can be changed 
in the corresponding scenario file (such as ring.js) by changing the 
init values and setting the slider accordingly, ew.g., IDM_a=0.9;
setSlider(slider_IDM_a, slider_IDM_aVal, IDM_a, 1, "m/s<sup>2</sup>");

If the new model does not have different parameters, this step is not needed.

(4) transfer slider interactions to the template models by redefining all "new ACC" instances in control_gui.js

(5) Bring the new model into action and distribute the updated 
template models to all the vehicles 
by redefining road.prototype.updateModelsOfAllVehicles(..). 
This is the central model update. 
Search for all instances of "new ACC" and change accordingly. 
(All instances of "new IDM" in any source file only refer to obstacles 
or needed initial definitions and can be left as is.)

*/



//#################################
// longitudinal models
//#################################

// white acceleration noise to avoid artifacts.
// sqrt(QnoiseAccel/dt) = random accel noise in each step

var QnoiseAccel=0.05; //[m^2/s^3]

// note: correlated noise by inter-driver variation directly in model
// ACC.driverfactor or IDM.driverfactor
// inherited from this.veh[i].driverfactor in road.js
// which is calculated from top-level driver_varcoeff
// via road.setDriverVariation(driver_varcoeff)


/**
longModel-IDM constructor

INFO: javascript does not know overloading!! cannot define
default, explicit, and copy constructors simultaneously
need methods for that such as IDM.copy(longModel).
pseudo-default cstr works by passing no args 
(these are then, of course, undefined at init):

explicit cstr: longModel=new IDM(30,1.3,2,1,2);  //v0,T,s0,a,b);
trivial Cstr: longModel=new IDM();
reference copy: longModel2=longModel
deep copy: longModel2=new IDM(); longModel2.copy(longModel)


@param v:     desired speed [m/s]
@param T:     desired time gap [s]
@param s0:    minimum gap [m]
@param a:     maximum acceleration [m/s^2]
@param b:     comfortable deceleration [m/s^2]

@return:      IDM instance (constructor)
*/

// generally ACC is used; check for "new ACC" and "new IDM" in road.js

function IDM(v0,T,s0,a,b){ 

  
  this.QnoiseAccel=QnoiseAccel; //m^2/s^3

  this.driverfactor=1; // if no transfer of driver individuality from master veh
  this.v0=v0;
  this.T=T;
  this.s0=s0;
  this.a=a;
  this.b=b;
  this.alpha_v0=1; // multiplicator for temporary reduction

  
  // possible restrictions (value 1000 => initially no restriction)

  this.speedlimit=1000; // if effective speed limits, speedlimit<v0  
  this.speedmax=1000; // if engine restricts speed, speedmax<speedlimit, v0
  this.bmax=18; //(2022) was=16
}

/**
longModel IDM deep-copy-function (no cstr possible, see INFO above)
used to define models individually rather than by reference. 
Only then, speed limits etc can be implemented "on the fly" w/o 
reference-side effects

@param already defined longModel (at the moment, IDM or ACC)
@return:      IDM instance (constructor)

usage: IDM2=new IDM(); IDM2.copy(IDM1);

*/

IDM.prototype.copy=function(longModel){
  this.QnoiseAccel=longModel.QnoiseAccel;
  
  this.v0=longModel.v0;  // driverfactor not copied; from master vehicle
  this.T=longModel.T;
  this.s0=longModel.s0;
  this.a=longModel.a;
  this.b=longModel.b;

  this.alpha_v0=longModel.alpha_v0; // multiplicator for temporary reduction

  this.speedlimit=longModel.speedlimit; 
  this.speedmax=longModel.speedmax; // if engine restricts speed, speedmax<speedlimit, v0
  this.bmax=longModel.bmax;
}



/**
IDM acceleration function

@param s:     actual gap [m]
@param v:     actual speed [m/s]
@param vl:    leading speed [m/s]
@param al:    leading accel [m/s^2] (only for common interface; ignored)

@return:  acceleration [m/s^2]
*/

IDM.prototype.calcAcc=function(s,v,vl,al){ 
    // sig_speedFluct=noiseAccel*sqrt(t*dt/12)

  var accRnd=(s<this.s0) ? 0
      : Math.sqrt(this.QnoiseAccel/dt)*(Math.random()-0.5);
  return accRnd+this.calcAccDet(s,v,vl,al);
}


IDM.prototype.calcAccDet=function(s,v,vl,al){ 

  
  // determine valid local v0eff and accel parameter aeff
  // this.driverfactor from master vehicle;
  // speedlimit overrides driver variability
  
  //var v0eff=this.v0*this.driverfactor;
  var v0eff=this.v0*this.driverfactor*this.alpha_v0; //(MT 2023-11)
  v0eff=Math.min(v0eff, this.speedlimit, this.speedmax);
  var aeff=this.a*this.driverfactor;

        // actual acceleration model

  var accFree=(v<v0eff) ? aeff*(1-Math.pow(v/v0eff,4))
      : aeff*(1-v/v0eff);

  // Gipps formula
  // var accFree=2.5*aeff*(1-v/v0eff)*sqrt{0.025+v/v0eff);

  var sstar=this.s0
	+Math.max(0.,v*this.T+0.5*v*(v-vl)/Math.sqrt(aeff*this.b));
  var accInt=-aeff*Math.pow(sstar/Math.max(s,this.s0),2); //!!! also for s<0?
  var accInt_IDMplus=accInt+aeff;

        // return original IDM

  return (v0eff<0.00001) ? 0 
	: Math.max(-this.bmax, accFree + accInt);

        // return IDM+

	//return (v0eff<0.00001) ? 0
        // : Math.max(-this.bmax, Math.min(accFree, accInt_IDMplus) + accRnd);

}//IDM.prototype.calcAcc



/**
IDM "give way" function for passive merges (the merging vehicle has priority) 
It returns the "longitudinal-transversal coupling" 
acceleration as though the priority vehicle has already merged/changed
if this does not include an emergency braking (decel<2*b)

For the interface and further explanations see ACC.prototype.calcAcc
*/

// deterministic acc for all forced situations

IDM.prototype.calcAccGiveWay=function(sNew, v, vPrio){
    var accNew=this.calcAccDet(sNew, v, vPrio, 0);
    return (accNew>-2*this.b) ? accNew : acc;
}





/**
MT 2016: longitudinal model ACC: Has same parameters as IDM 
but exactly triangular steady state and "cooler" reactions if gap too small

INFO on (no) overloading: see longModel-IDM constructor

@param v:     desired speed [m/s]
@param T:     desired time gap [s]
@param s0:    minimum gap [m]
@param a:     maximum acceleration [m/s^2]
@param b:     comfortable deceleration [m/s^2]

@return:      ACC instance (constructor)
*/



//!! Chromium does not know Math.tanh(!!)

function myTanh(x){
    return (x>50) ? 1 : (x<-50) ? -1 : (Math.exp(2*x)-1)/(Math.exp(2*x)+1);
}

//###################################################################
// generally ACC is used; for implementing new models, see the instructions
// at the beginning
//###################################################################

function ACC(v0,T,s0,a,b){

  // white acceleration noise to avoid artifacts.
  // sqrt(QnoiseAccel/dt) = random accel noise in each step
  // for uncorrelated random effects

  this.QnoiseAccel=QnoiseAccel; //m^2/s^3
  this.driverfactor=1; // if no transfer of driver individuality from master veh
  this.v0=v0; 
  this.T=T;
  this.s0=s0;
  this.a=a;
  this.b=b;

  this.cool=0.90; // !!also apply to copy constructor

  this.alpha_v0=1; // multiplicator for temporary reduction
    
  // possible restrictions (value 1000 => initially no restriction)

  this.speedlimit=1000; // if effective speed limits, speedlimit<v0  
  this.speedmax=1000; // if vehicle restricts speed, speedmax<speedlimit, v0
  this.bmax=10; //!!! (jan2022) was =18

  //console.log("in ACC cstr: this.v0=",this.v0);
}

/**
ACC deep-copy-function (no cstr possible, see INFO above)
used to define models individually rather than by reference. 
Only then, speed limits etc can be implemented "on the fly" w/o 
reference-side effects

Since models often are deep copied from a template and I want persistent
stochasticity of model parameter variations, model gets its 
persistent stochasticity from the vehicle because models are often created
new during sim -> all persistency destroyed

@param already defined longModel (at the moment, IDM or ACC)
@return:      IDM instance (constructor)

usage: ACC2=new ACC(); ACC2.copy(ACC1);

*/

ACC.prototype.copy=function(longModel){
  this.QnoiseAccel=longModel.QnoiseAccel;

  this.v0=longModel.v0; // driverfactor not copied; from master vehicle
  this.T=longModel.T;
  this.s0=longModel.s0;
  this.a=longModel.a;
  this.b=longModel.b;
  this.cool=(!(typeof longModel.cool === 'undefined')) ? longModel.cool : 0.8;

  this.alpha_v0=longModel.alpha_v0; // multiplicator for temporary reduction

  // possible restrictions (value 1000 => initially no restriction)
  
  this.speedlimit=longModel.speedlimit; 
  this.speedmax=longModel.speedmax; // if engine restricts speed, speedmax<speedlimit, v0
  this.bmax=longModel.bmax;
}




/**
ACC acceleration function

@param s:     actual gap [m]
@param v:     actual speed [m/s]
@param vl:    leading speed [m/s]
@param al:    leading acceleration [m/s^2] (optional; al=0 if 3 args)

@return:  acceleration [m/s^2]
*/

ACC.prototype.calcAcc=function(s,v,vl,al){ // this works as well
    // sig_speedFluct=noiseAccel*sqrt(t*dt/12)

  var accRnd=(s<this.s0) ? 0
      : Math.sqrt(this.QnoiseAccel/dt)*(Math.random()-0.5);
  return accRnd+this.calcAccDet(s,v,vl,al);
}

ACC.prototype.calcAccDet=function(s,v,vl,al){ // this works as well

  // special simple case for s<s0 particularly for s<0
  // (IDM does not need this)
  
  if(s<this.s0){
    return Math.max(-this.bmax,
		    -(this.b+(this.bmax-this.b)*(this.s0-s)/this.s0)
		   );}


  // determine valid local v0eff and accel parameter aeff
  // this.driverfactor from master vehicle;
  // speedlimit overrides driver variability
  
  //var v0eff=this.v0*this.driverfactor;
  var v0eff=this.v0*this.driverfactor*this.alpha_v0; //(MT 2023-11)
  v0eff=Math.min(v0eff, this.speedlimit, this.speedmax);
  var aeff=this.a*this.driverfactor;
  
  // actual acceleration model

  // !!! no strong response for v>v0
  //var accFree=(v<v0eff) ? aeff*(1-Math.pow(v/v0eff,4))
  //  : aeff*(1-v/v0eff); 

  // !!! strong response wanted for baWue application (dec19)
  var accFree=aeff*(1-Math.pow(v/v0eff,4));

  // Gipps formula
  // var accFree=2.5*aeff*(1-v/v0eff)*sqrt{0.025+v/v0eff);

  var sstar=this.s0
    +Math.max(0, v*this.T+0.5*v*(v-vl)/Math.sqrt(aeff*this.b));
  var accInt=-aeff*Math.pow(sstar/Math.max(s,this.s0),2);

  //var accIDM=accFree+accInt; //!!! normal IDM
  var accIDM=Math.min(accFree, aeff+accInt); //!!! IDM+

  var accCAH=(vl*(v-vl) < -2*s*al)
    ? v*v*al/(vl*vl -2*s*al)
    : al - Math.pow(v-vl,2)/(2*Math.max(s,0.01)) * ((v>vl) ? 1 : 0);
  accCAH=Math.min(accCAH,aeff);

  var accMix=(accIDM>accCAH)
	    ? accIDM
	    : accCAH+this.b*myTanh((accIDM-accCAH)/this.b);
  var arg=(accIDM-accCAH)/this.b;

  var accACC=this.cool*accMix +(1-this.cool)*accIDM;

  var accReturn=(v0eff<0.00001) ? 0 : Math.max(-this.bmax, accACC);

        // log and return

	//if(this.alpha_v0<0.6){ // !! alpha not yet used

  //if(time<1.3){
  //if(s<2){
  if(false){
    console.log("ACC.calcAcc:"
		+" s="+parseFloat(s).toFixed(3)
		      +" v="+parseFloat(v).toFixed(3)
		      +" vl="+parseFloat(vl).toFixed(3)
		      +" al="+parseFloat(al).toFixed(3)
		      +" accFree="+parseFloat(accFree).toFixed(3)
		      +" accIDM="+parseFloat(accIDM).toFixed(3)
		      +" accCAH="+parseFloat(accCAH).toFixed(3)
		      +" accACC="+parseFloat(accACC).toFixed(3)
		      +" accReturn="+parseFloat(accReturn).toFixed(3)
		     );
  }
  return accReturn;

}//ACC.prototype.calcAcc




/**
ACC "give way" function for passive merges (the merging vehicle has priority) 
It returns the "longitudinal-transversal coupling" 
acceleration as though the priority vehicle has already merged/changed
if this does not include an emergency braking (decel<2*b)

Notice 1: The caller must ensure that this function 
is only called for the first vehicle behind a merging vehicle 
having priority. 

Notice 2: No actual lane change is involved. The lane change of the merging vehicle
is just favoured in the next steps by this longitudinal-transversal coupling


@param sYield: distance [m] to yield point 
               (stop if merging veh present)
@param sPrio:  gap vehicle of other road to merge begin
@param v:      speed of subject vehicle [m/s]
@param vPrio:  speed of the priority vehicle [m/s]
@param accOld: acceleration before LT coupling

@return:  acceleration response [m/s^2] to the merging veh with priority
*/



ACC.prototype.calcAccGiveWay=function(sYield, sPrio, v, vPrio, accOld){
    var accPrioNoYield=this.calcAccDet(sPrio, vPrio, 0, 0);
    var accYield=this.calcAccDet(sYield, v, 0, 0);
    var priorityRelevant=((accPrioNoYield<-0.2*this.b)
			  &&(accYield<-0.2*this.b));
    var accGiveWay=priorityRelevant ? accYield : accOld;
    if(false){
        console.log("ACC.calcAccGiveWay: sYield=",sYield,
		    " sPrio=",sPrio," v=",v," vPrio=",vPrio,
		    "\n accPrioNoYield=",accPrioNoYield,
		    " accYield=",accYield,
		    " accOld=",accOld,
		    " accGiveWay=",accGiveWay);
    }
    return accGiveWay;
    //return -4;
}


//###################################################################
// test new model "CACC"; for implementing new models, see the instructions
// at the beginning of this file
//###################################################################

function CACC(v0, T, s0, a, b, delta, alpha) {
  this.QnoiseAccel = QnoiseAccel; // m^2/s^3
  this.driverfactor = 1; // if no transfer of driver individuality from master veh
  this.v0 = v0;
  this.T = T;
  this.s0 = s0;
  this.a = a;
  this.b = b;
  this.delta = delta;
  this.alpha = alpha;
  this.alpha_v0 = 1; // multiplicator for temporary reduction

  // possible restrictions (value 1000 => initially no restriction)
  this.speedlimit = 1000; // if effective speed limits, speedlimit<v0
  this.speedmax = 1000; // if engine restricts speed, speedmax<speedlimit, v0
  this.bmax = 18; // (2022) was=16
}


/**
CACC acceleration function

@param s: actual gap [m]
@param v: actual speed [m/s]
@param vl: leading speed [m/s]
@param al: leading acceleration [m/s^2] (only for common interface; ignored)
@return: acceleration [m/s^2]
*/

CACC.prototype.calcAcc = function (s, v, vl, al) {
  var accRnd = s < this.s0 ? 0
      : Math.sqrt(this.QnoiseAccel / dt) * (Math.random() - 0.5);
  return accRnd + this.calcAccDet(s, v, vl, al);
};


CACC.prototype.calcAccDet = function (s, v, vl, al) {
  var v0eff = this.v0 * this.driverfactor * this.alpha_v0; // (MT 2023-11)
  v0eff = Math.min(v0eff, this.speedlimit, this.speedmax);
  var aeff = this.a * this.driverfactor;

  var accFree = v < v0eff
      ? aeff * (1 - Math.pow(v / v0eff, 4))
      : aeff * (1 - v / v0eff);

  // Gipps formula
  // var accFree=2.5*aeff*(1-v/v0eff)*sqrt{0.025+v/v0eff);
  
  
  var sstar = this.s0
      + Math.max(0, v * this.T
		 + 0.5 * v * (v - vl) / Math.sqrt(aeff * this.b));
  
  var accInt = -aeff * Math.pow(sstar / Math.max(s, this.s0), 2);

  return v0eff < 0.00001 ? 0 : Math.max(-this.bmax, accFree + accInt);
};

// Example Usage:
// var caccModel = new CACC(30, 1.5, 2, 2, 1, 1, 0.1);
// var acceleration = caccModel.calcAcc(s, v, vl, al);

CACC.prototype.copy=function(longModel){
  this.QnoiseAccel=longModel.QnoiseAccel;

  this.v0=longModel.v0; // driverfactor not copied; from master vehicle
  this.T=longModel.T;
  this.s0=longModel.s0;
  this.a=longModel.a;
  this.b=longModel.b;
  this.delta=longModel.delta;
  this.alpha=longModel.alpha;
  
  this.alpha_v0=longModel.alpha_v0; // multiplicator for temporary reduction

  // possible restrictions (value 1000 => initially no restriction)
  
  this.speedlimit=longModel.speedlimit; 
  this.speedmax=longModel.speedmax; // if engine restricts speed, speedmax<speedlimit, v0
  this.bmax=longModel.bmax;
}



//#############################################################
// lane-changing models; for implementing new models, see the instructions
// at the beginning of this file
//#############################################################

/**
generalized lane-changing model MOBIL:
at present no politeness but speed dependent safe deceleration 

@param bSafe:          safe deceleration [m/s^2] at maximum speed v=v0
@param bSafeMax:       safe deceleration [m/s^2]  at speed zero (gen. higher)
@param p:              politeness factor (0=egoistic driving)
@param bThr:           lane-changing threshold [m/s^2] 
@param bBiasRight:     bias [m/s^2] to the right
@param targetLanePrio: vehicles on target lane have priority
@return:               MOBIL instance (constructor)
*/

function MOBIL(bSafe, bSafeMax, p, bThr, bBiasRight){

    this.bSafe=bSafe;
    this.bSafeMax=bSafeMax; 
    this.p=p;
    this.bThr=bThr;
    this.bBiasRight=bBiasRight;
}


/*
generalized MOBIL lane chaning decision
with bSafe increasing with decrease vrel=v/v0
but at present w/o politeness

@param vrel:            v/v0; increase bSave with decreasing vrel
@param acc:             own acceleration at old lane
@param accNew:          prospective own acceleration at new lane
@param accLagNew:       prospective accel of new leader
@param toRight:         1 if true, 0 if not
@return: whether an immediate lane change is safe and desired
*/

MOBIL.prototype.realizeLaneChange=function(vrel,acc,accNew,accLagNew,
					   toRight,log){

  var signRight=(toRight) ? 1 : -1;

  // safety criterion

  var bSafeActual=vrel*this.bSafe+(1-vrel)*this.bSafeMax;

  if(signRight*this.bBiasRight>40){
      //console.log("forced LC!"); 
      return true;
  }
  
  if(accLagNew<Math.min(-bSafeActual,-Math.abs(this.bBiasRight))){
    return false;
  }//!!!
    

  // incentive criterion true if acc balance dacc>0

  var dacc=accNew-acc+this.p*accLagNew //!! new
      + this.bBiasRight*signRight - this.bThr;

  // hard-prohibit LC against bias if |bias|>9 m/s^2
    
  if(this.bBiasRight*signRight<-9){dacc=-1;}

    // debug before return

  if(false){
    //if((dacc>0)&&(!toRight)){
	console.log(
		"!!!!! positive left MOBIL LC decision!",
		"\n vrel=",parseFloat(vrel).toFixed(2),
		" bSafeActual=",parseFloat(bSafeActual).toFixed(2),
		" acc=",parseFloat(acc).toFixed(2),
		" accNew=",parseFloat(accNew).toFixed(2),
		" bBiasRight=",parseFloat(this.bBiasRight).toFixed(2),
		" bThr=",parseFloat(this.bThr).toFixed(2)
	);
  }

  return (dacc>0);
}



// to be used in connection with new, e.g., at inflow:
// LCModel2=new MOBIL(); LCModel2.copy(LCModel1)

MOBIL.prototype.copy=function(LCModel){
  this.bSafe=LCModel.bSafe;
  this.bSafeMax=LCModel.bSafeMax; 
  this.p=LCModel.p;
  this.bThr=LCModel.bThr;
  this.bBiasRight=LCModel.bBiasRight;
}

/*
check first for priority if merging to a priority lane.
In contrast to the safety criterion (critical deceleration), 
the criterion here is a rather small critical acceleration *change*

@param accLag:    actual acceleration of the target lag vehicle
@param accLagNew: acceleration of this vehicle after a prospective change

@return:          true if the mainroad (target lane) vehicle would be obstructed by
                  the changing by more than a very small amount
*/

MOBIL.prototype.respectPriority=function(accLag,accLagNew){

    if(this.targetLanePrio){
	return(accLag-accLagNew>0.1);
    }
}
