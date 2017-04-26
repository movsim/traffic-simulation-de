
// type = "car" or "truck"

function vehicle(length, width, u, lane, speed, type){
    this.length=length; // car length[m]
    this.width=width;   // car width[m]
    this.u=u;           // long coordinate=arc length [m]
    this.lane=lane;     // integer-valued lane 0=leftmost
    this.v=lane;        // lane coordinate (lateral, units of lane width), not speed!!
    this.dvdt=0;     // vehicle angle to road axis (for drawing purposes)
    this.laneOld=lane;  // for logging and drawing vontinuous lat coords v
    this.speed=speed;
    this.type=type;
    this.id=Math.floor(100000*Math.random()+100); // ids 0-99 special purpose
    //console.log("vehicle cstr: this.id=",this.id);

    this.route=[]; // route=sequence of road IDs (optional)
    this.mandatoryLCahead=false;
    this.toRight=false; // set strong urge to toRight,!toRight IF mandatoryLCahead


    this.dt_lastLC=10;
    this.dt_lastPassiveLC=10;
    this.acc=0;
    this.iLead=-100;
    this.iLag=-100;
    //this.iLeadOld=-100; // necessary for update local environm after change
    //this.iLagOld=-100; // necessary for update local environm after change

    this.iLeadRight=-100;
    this.iLeadLeft=-100;
    this.iLagRight=-100;
    this.iLagLeft=-100;
    //this.iLeadRightOld=-100;
    //this.iLeadLeftOld=-100;
    //this.iLagRightOld=-100;
    //this.iLagLeftOld=-100;

    // just start values
    this.longModel=new ACC(20,1.3,2,1,2);//IDM_v0,IDM_T,IDM_s0,IDM_a,IDM_b);
    this.LCModel=new MOBIL(4,0.2,0.3); //MOBIL_bSafe, MOBIL_bThr, MOBIL_bBiasRight);



vehicle.prototype.setRoute=function(route){
  this.route=route;
}


}

