
// type = "car" or "truck"

function vehicle(length, width, u, lane, speed, type){
    this.length=length; // car length in pixel units (!!later phys units)
    this.width=width; // car width in pixel units (!!later phys units)
    this.u=u;  // arc length in pixel units (!!later dynamic and in phys units)
    this.lane=lane;
    this.speed=speed;
    this.type=type;

    this.route=[]; // route=sequence of road IDs (optional)
    this.mandatoryLCahead=false;
    this.toRight=false; // set strong urge to toRight IF mandatoryLCahead


    this.v=lane;  // v = lane coordinate, not speed!!
    this.dvdu=lane;
    this.laneOld=lane;
    this.dt_lastLC=10;
    this.dt_lastPassiveLC=10;
    this.acc=-100;
    this.iLead=-100;
    this.iLag=-100;
    this.iLeadOld=-100; // necessary for update local environm after change
    this.iLagOld=-100; // necessary for update local environm after change

    this.iLeadRight=-100;
    this.iLeadLeft=-100;
    this.iLagRight=-100;
    this.iLagLeft=-100;
    this.iLeadRightOld=-100;
    this.iLeadLeftOld=-100;
    this.iLagRightOld=-100;
    this.iLagLeftOld=-100;
    // just start values
    this.longModel=new IDM(20,1.3,2,1,2);//IDM_v0,IDM_T,IDM_s0,IDM_a,IDM_b);
    this.LCModel=new MOBIL(4,0.2,0.3); //MOBIL_bSafe, MOBIL_bThr, MOBIL_bBiasRight);



vehicle.prototype.setRoute=function(route){
  this.route=route;
}


}

