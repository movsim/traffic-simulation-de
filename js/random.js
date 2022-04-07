/* various random variables and processes with and without memory */


// standard Gaussian (Box-Muller transform)

function rndNormal(){
  return Math.sqrt(-2 * Math.log(1 - Math.random()))
    * Math.cos(2 * Math.PI * Math.random());
}


// Wiener process (random walk) y \sim N(0, Qfluct*t)

function Wiener(Qfluct){
  this.y=0;
  this.Qfluct=Qfluct;
}

Wiener.prototype.update=function(dt){
  var r=rndNormal();
  this.y += r*Math.sqrt(this.Qfluct * dt);
}


// Ornstein Uhlenbeck process (discretized as a AR(1) process)
// with mean reversion to mu, stddev (mean amplitude) A, correlation time tau

// AR(1): Y_t=c+phi*Y_{t-1}+eps, eps \sim N(0,sigeps^2), 
// or     dY =c-(1-phi)Y+eps
//


// E(Y)=c/(1-phi)
// V(Y)=sigeps^2/(1-phi^2)
// tauCorr=-1/ln(phi)
//
// =>
// phi=exp(-1/tau) or exp(-dt/tau) if dt != 1
// c=mu*(1-phi)                    (from E(dY)=0, also for dt != 1)
// sigeps^2=V*(1-phi^2)=A^2(1-phi^2)  (also for dt != 1)


function OUProcess(mu,A,tau){
  this.mu=mu;
  this.A=A;
  this.tau=Math.max(1e-10,tau);
  this.y=0;
}

OUProcess.prototype.update=function(dt){
  var r=rndNormal();
  var phi=Math.exp(-dt/this.tau);
  var c=this.mu*(1-phi);
  var sigeps=this.A*Math.sqrt(1-Math.pow(phi,2));
  
  this.y += c-(1-phi)*this.y +r*sigeps;

}



