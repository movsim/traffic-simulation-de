//#################################
// longitudinal models
//#################################


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

 
function IDM(v0,T,s0,a,b){
    this.v0=v0; 
    this.T=T;
    this.s0=s0;
    this.a=a;
    this.b=b;
    this.alpha_v0=1; // multiplicator for temporary reduction

    // possible restrictions (value 1000 => initially no restriction)

    this.speedlimit=1000; // if effective speed limits, speedlimit<v0  
    this.speedmax=1000; // if engine restricts speed, speedmax<speedlimit, v0
    this.bmax=16;
}

/**
longModel IDM deep-copy-function (no cstr possible, see INFO above)
used to define models individually rather than by reference. 
Only then, speed limits etc can be implemented "on the fly" w/o 
reference-side effects

@param already defined longModel (at the moment, IDM or ACC)
@return:      IDM instance (constructor)

*/

IDM.prototype.copy=function(longModel){
  this.v0=longModel.v0; 
  this.T=longModel.T;
  this.s0=longModel.s0;
  this.a=longModel.a;
  this.b=longModel.b;

  this.alpha_v0=1; // multiplicator for temporary reduction

    // possible restrictions (value 1000 => initially no restriction)

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

        //MT 2016: noise to avoid some artifacts

    var noiseAcc=0.3; // sig_speedFluct=noiseAcc*sqrt(t*dt/12)
    var accRnd=noiseAcc*(Math.random()-0.5); //if acceleration noise

        // determine valid local v0

    var v0eff=Math.min(this.v0, this.speedlimit, this.speedmax);
    v0eff*=this.alpha_v0;

        // actual acceleration model

    var accFree=(v<v0eff) ? this.a*(1-Math.pow(v/v0eff,4))
	: this.a*(1-v/v0eff);
    var sstar=this.s0
	+Math.max(0.,v*this.T+0.5*v*(v-vl)/Math.sqrt(this.a*this.b));
    var accInt=-this.a*Math.pow(sstar/Math.max(s,this.s0),2);
    var accInt_IDMplus=accInt+this.a;

        // return original IDM

    return (v0eff<0.00001) ? 0 
	: Math.max(-this.bmax, accFree + accInt + accRnd);

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

IDM.prototype.calcAccGiveWay=function(sNew, v, vPrio){
    var accNew=this.calcAcc(sNew, v, vPrio, 0);
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


function ACC(v0,T,s0,a,b){
  this.v0=v0; 
  this.T=T;
  this.s0=s0;
  this.a=a;
  this.b=b;

  this.cool=0.99;
  this.alpha_v0=1; // multiplicator for temporary reduction

  this.speedlimit=1000; // if effective speed limits, speedlimit<v0  
  this.speedmax=1000; // if vehicle restricts speed, speedmax<speedlimit, v0
  this.bmax=18;

  //console.log("in ACC cstr: this.v0=",this.v0);
}

/**
ACC deep-copy-function (no cstr possible, see INFO above)
used to define models individually rather than by reference. 
Only then, speed limits etc can be implemented "on the fly" w/o 
reference-side effects

@param already defined longModel (at the moment, IDM or ACC)
@return:      IDM instance (constructor)

*/

ACC.prototype.copy=function(longModel){
  this.v0=longModel.v0; 
  this.T=longModel.T;
  this.s0=longModel.s0;
  this.a=longModel.a;
  this.b=longModel.b;

  this.cool=0.99;
  this.alpha_v0=1; // multiplicator for temporary reduction

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

  if(s<0.001){return -this.bmax;}// particularly for s<0

    // !!! acceleration noise to avoid some artifacts (no noise if s<s0)
    // sig_speedFluct=noiseAcc*sqrt(t*dt/12)

  var noiseAcc=(s<this.s0) ? 0 : 0.3;    // ? 0 : 0.3; 
  var accRnd= noiseAcc*(Math.random()-0.5);

        // determine valid local v0

  var v0eff=Math.min(this.v0, this.speedlimit, this.speedmax);
  v0eff*=this.alpha_v0;

        // actual acceleration model

  // !!! no strong response for v>v0
  //var accFree=(v<v0eff) ? this.a*(1-Math.pow(v/v0eff,4))
  //  : this.a*(1-v/v0eff); 

  // !!! strong response wanted for baWue application (dec19)
  var accFree=this.a*(1-Math.pow(v/v0eff,4));

  var sstar=this.s0
    +Math.max(0, v*this.T+0.5*v*(v-vl)/Math.sqrt(this.a*this.b));
  var accInt=-this.a*Math.pow(sstar/Math.max(s,this.s0),2);

  //var accIDM=accFree+accInt; //!!! normal IDM
  var accIDM=Math.min(accFree, this.a+accInt); //!!! IDM+

  var accCAH=(vl*(v-vl) < -2*s*al)
    ? v*v*al/(vl*vl -2*s*al)
    : al - Math.pow(v-vl,2)/(2*Math.max(s,0.01)) * ((v>vl) ? 1 : 0);
  accCAH=Math.min(accCAH,this.a);

  var accMix=(accIDM>accCAH)
	    ? accIDM
	    : accCAH+this.b*myTanh((accIDM-accCAH)/this.b);
  var arg=(accIDM-accCAH)/this.b;

  var accACC=this.cool*accMix +(1-this.cool)*accIDM;

  var accReturn=(v0eff<0.00001) ? 0 : Math.max(-this.bmax, accACC + accRnd);

        // log and return

	//if(this.alpha_v0<0.6){ // alpha not yet used

  if(false){
    //if(s<2){
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

Notice 3: For active merges to priority roads 
(the mainroad vehicles have priority) 
use MOBIL.respectPriority to determine if the merge is OK


@param sYield: distance [m] to yield point 
               (stop if merging veh present)
@param sPrio:  gap vehicle of other road to merge begin
@param v:      speed of subject vehicle [m/s]
@param vPrio:  speed of the priority vehicle [m/s]
@param accOld: acceleration before LT coupling

@return:  acceleration response [m/s^2] to the merging veh with priority
*/

    // !! 0.1*this.b consistent with MOBIL.prototype.respectPriority
    // !! 2*this.b consistent with MOBIL.bSafe

ACC.prototype.calcAccGiveWay=function(sYield, sPrio, v, vPrio, accOld){
    var accPrioNoYield=this.calcAcc(sPrio, vPrio, 0, 0);
    var accYield=this.calcAcc(sYield, v, 0, 0);
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

//#################################
// lane-changing models
//#################################

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
    //if(accLagNew<-bSafeActual){return false;} //!! <jun19
    //if((accLagNew<-bSafeActual)&&(signRight*this.bBiasRight<41)){return false;}//!!! override safety criterion to really enforce overtaking ban OPTIMIZE
    if(signRight*this.bBiasRight>40){
      //console.log("forced LC!"); 
      return true;
    }
    if(accLagNew<Math.min(-bSafeActual,-Math.abs(this.bBiasRight))){return false;}//!!!
    

    // incentive criterion

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



/**
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
