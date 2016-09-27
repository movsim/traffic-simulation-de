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

    this.calcAcc=function(s,v,vl){
    //IDM.prototype.calcAcc=function(s,v,vl){ // this works as well but less intuitive

	//if(s<0.1){console.log("IDM.calcAcc: s="+s+" < approx 0!<br>");}

        //MT 2016: noise 
	var noiseAcc=0.3; // sig_speedFluct=noiseAcc*sqrt(t*dt/12)
        var accRnd=noiseAcc*(Math.random()-0.5); //if acceleration noise

	var v0eff=Math.min(this.v0, this.speedlimit, this.speedmax);
	v0eff*=this.alpha_v0;
       	var accFree=(v<v0eff) ? this.a*(1-Math.pow(v/v0eff,4))
	    : this.a*(1-v/v0eff);
	var sstar=this.s0+v*this.T+0.5*v*(v-vl)/Math.sqrt(this.a*this.b);
	//var sstar=this.s0+v*this.T+0.7*Math.pow(v,0.5)*(v-vl)*Math.pow(Math.abs(v-vl),0.3)/Math.sqrt(this.a*this.b);
	var accInt=-this.a*Math.pow(sstar/Math.max(s,this.s0),2);
	var accInt_IDMplus=accInt+this.a;
	//if(false){
	//if(this.speedlimit<23){
	if(this.alpha_v0<0.6){
          console.log("IDM.calcAcc:"
	    +" speedlimit="+this.speedlimit
	    +" speed="+v
	    +" accFree="+accFree
	    +" acc="+Math.max(-20, accFree + accInt + accRnd));
	}
	return (v0eff<0.00001) ? 0 : Math.max(-20, accFree + accInt + accRnd);//IDM
	//return Math.max(-20, Math.min(accFree, accInt_IDMplus));//IDMplus
    }
}

//#################################
// lane-changing model
//#################################

function MOBIL(bSafe, bThr, bBiasRight){
    this.bSafe=bSafe;
    this.bThr=bThr;
    this.bBiasRight=bBiasRight;
    //this.p=p; 

    // lane chaning decision w/o politeness

    MOBIL.prototype.realizeLaneChange=function(acc,accNew,accLagTargetNew,toRight,log){
    //this.realizeLaneChange=function(acc,accNew,accLagTargetNew,toRight,log){
	if(log){
          console.log("\nIn MOBIL.realizeLaneChange");
	  console.log("  acc="+acc+" accNew="+accNew
		      +" accLagTargetNew="+accLagTargetNew);
	  console.log("  toRight="+toRight);
	  console.log("  this.bSafe="+this.bSafe+" this.bThr="+this.bThr
		      +" this.bBiasRight="+this.bBiasRight);
	}

	if(accLagTargetNew<-this.bSafe){return false;}
	var dacc=accNew-acc + this.bBiasRight*((toRight) ? 1 : -1)- this.bThr;

	if(log){
	  console.log("...dacc="+dacc);
	  if(dacc>0){console.log("  positive MOBIL LC decision!");}
	}	
	return (dacc>0);
    }
}
