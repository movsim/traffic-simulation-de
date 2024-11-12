
// yr 0 (bottom), 1 (top), opposite to pixel coordinates

function displayText(str_text,textsize, xr, yr){
  ctx.setTransform(1,0,0,1,0,0); 

  ctx.font=textsize+'px Arial';

  var str_width=0.55*str_text.length*textsize;
  var str_height=1.2*textsize;
  var str_xlb=xr*canvas.width-0.5*str_width;
  var str_ylt=(1-yr)*canvas.height-0.5*str_height; 
  ctx.fillStyle="rgb(255,255,255)";
  ctx.fillRect(str_xlb,str_ylt,str_width,str_height);
  ctx.fillStyle="rgb(0,0,0)";
  ctx.fillText(str_text, str_xlb+0.2*textsize, str_ylt+0.95*textsize);
}
