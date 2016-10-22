//#################################
// longitudinal model
//#################################

function IDM(v0,T,s0,a,b){
    this.v0=v0; 
    this.T=T;
    this.s0=s0;
    this.a=a;
    this.b=b;
    this.alpha_v0=1; // multiplicator for temporary reduction

    // possible restrictions (value 1000 => initially no restriction)
    this.speedlimit=1000; // if effective speed limits, speedlimit<v0  
    this.speedmax=1000; // if vehicle restricts speed, speedmax<speedlimit, v0
    this.bmax=16;

    // last arg optional if called with 3 args ignored
    //this.calcAcc=function(s,v,vl,al){ // this works as well

    IDM.prototype.calcAcc=function(s,v,vl,al){ // this works as well

        //MT 2016: noise to avoid some artifacts

	var noiseAcc=0.3; // sig_speedFluct=noiseAcc*sqrt(t*dt/12)
        var accRnd=noiseAcc*(Math.random()-0.5); //if acceleration noise

        // determine valid local v0

	var v0eff=Math.min(this.v0, this.speedlimit, this.speedmax);
	v0eff*=this.alpha_v0;

        // actual acceleration model

       	var accFree=(v<v0eff) ? this.a*(1-Math.pow(v/v0eff,4))
	    : this.a*(1-v/v0eff);
	var sstar=this.s0+v*this.T+0.5*v*(v-vl)/Math.sqrt(this.a*this.b);
	var accInt=-this.a*Math.pow(sstar/Math.max(s,this.s0),2);
	var accInt_IDMplus=accInt+this.a;

        // log and return

	if(this.alpha_v0<0.6){
          console.log("IDM.calcAcc:"
	    +" speedlimit="+this.speedlimit
	    +" speed="+v
	    +" accFree="+accFree
	    +" acc="+Math.max(-this.bmax, accFree + accInt + accRnd));
	}
	return (v0eff<0.00001) ? 0 : Math.max(-this.bmax, accFree + accInt + accRnd);//IDM
	//return (v0eff<0.00001) ? 0 : Math.max(-this.bmax, accFree + accInt_IDMplus + accRnd);//IDMplus

    }//IDM.prototype.calcAcc
}


// MT 2016: ACC model

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

    ACC.prototype.calcAcc=function(s,v,vl,al){ // this works as well

	if(s<0.0001){return -this.bmax;}

        // noise to avoid some artifacts

	var noiseAcc=0.3; // sig_speedFluct=noiseAcc*sqrt(t*dt/12)
        var accRnd=noiseAcc*(Math.random()-0.5); //if acceleration noise

        // determine valid local v0

	var v0eff=Math.min(this.v0, this.speedlimit, this.speedmax);
	v0eff*=this.alpha_v0;

        // actual acceleration model

       	var accFree=(v<v0eff) ? this.a*(1-Math.pow(v/v0eff,4))
	    : this.a*(1-v/v0eff);
	var sstar=this.s0+v*this.T+0.5*v*(v-vl)/Math.sqrt(this.a*this.b);
	var accInt=-this.a*Math.pow(sstar/Math.max(s,this.s0),2);
	var accIDM=accFree+accInt;

	var accCAH=(vl*(v-vl) < -2*s*al)
	    ? v*v*al/(vl*vl -2*s*al) 
	    : al - Math.pow(v-vl,2)/(2*Math.max(s,0.01)) * ((v>vl) ? 1 : 0);
	accCAH=Math.min(accCAH,this.a);

	var accMix=(accIDM>accCAH) 
	    ? accIDM
	    : accCAH+this.b*Math.tanh((accIDM-accCAH)/this.b);

	var accACC=this.cool*accMix +(1-this.cool)*accIDM;

	var accReturn=(v0eff<0.00001) 
	    ? 0 : Math.max(-this.bmax, accACC + accRnd);

        // log and return

	//if(this.alpha_v0<0.6){ // alpha not yet used
	//if(v>this.v0){
	if(false){
          console.log("ACC.calcAcc:"
		      +" speedlimit="+this.speedlimit // no u,v!
		      +" s="+s
		      +" v="+v
		      +" vl="+vl
		      +" al="+al
		      +" accFree="+accFree
		      +" accIDM="+accIDM
		      +" accCAH="+accCAH
		      +" accACC="+accACC
		      +" accReturn="+accReturn)
	}
	return accReturn;

    }//ACC.prototype.calcAcc
}


//#################################
// lane-changing models
//#################################

/**
generalized lane-changing model MOBIL:
at present no politeness but speed dependent safe deceleration 

@param bSafe:      safe deceleration [m/s^2] at maximum speed v=v0
@param bSafeMax:   safe deceleration [m/s^2]  at speed zero (gen. higher)
@param bThr:       lane-changing threshold [m/s^2] 
@param bBiasRight: bias [m/s^2] to the right
@return:           MOBIL instance (constructor)
*/

function MOBIL(bSafe, bSafeMax, bThr, bBiasRight){
    this.bSafe=bSafe;
    this.bThr=bThr;
    this.bBiasRight=bBiasRight;
    this.bSafeMax=bSafeMax; //!!! transfer into arg list of cstr later on
    //this.p=p; 



    /**
    generalized MOBIL lane chaning decision
    with bSafe increasing with decrease vrel=v/v0
    but at present w/o poliuteness

    @param vrel:            v/v0; increase bSave with decreasing vrel
    @param acc:             own acceleration at old lane
    @param accNew:          prospective own acceleration at new lane
    @param accLagTargetNew: prospective accel of new leader
    @param toRight:         1 if true, 0 if not
    @return: whether an immediate lane change is safe and desired
    */

    MOBIL.prototype.realizeLaneChange=function(vrel,acc,accNew,accLagTargetNew,toRight,log){

 	if(log|| (this.bSafe>24)){
          console.log("\nIn MOBIL.realizeLaneChange");
	  console.log("  vrel="+vrel
	              +" acc="+acc+" accNew="+accNew
		      +" accLagTargetNew="+accLagTargetNew);
	  console.log("  toRight="+toRight);
	  console.log("  this.bSafe="+this.bSafe+" this.bThr="+this.bThr
		      +" this.bBiasRight="+this.bBiasRight);
	}

	var bSafeActual=vrel*this.bSafe+(1-vrel)*this.bSafeMax;

	if(accLagTargetNew<-bSafeActual){return false;}
	var dacc=accNew-acc + this.bBiasRight*((toRight) ? 1 : -1)- this.bThr;

	if(log || (this.bSafe>24)){
	  console.log("...dacc="+dacc);
	  if(dacc>0){console.log("  positive MOBIL LC decision!");}
	}	
	return (dacc>0);
    }
}
