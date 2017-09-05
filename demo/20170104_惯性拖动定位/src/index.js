import Swipe from './swipe'
import drag from './modules/drag'
import Figure from './modules/figure'
import Animation from './modules/animation'

let swipeBase = new Swipe();
let animation = new Animation
let figure = new Figure
animation.easing = function (x, t, b, c, d) {
  return c*((t=t/d-1)*t*t + 1) + b;
};
let eDrag = document.getElementById('app')

let x = 0,y=0,tpx,tpy;
let startX = 0
let startY=0


drag({
  eDrag,
  onMove(e) {
    let moveX = e.pageX
    let moveY = e.pageY

    let lenx=moveX - startX

    // let rad = Math.atan(leny/lenx)

    x = lenx + tpx
    swipeBase.move(moveX)
    eDrag.style.left= x+'px'
    e.preventDefault();
  },
  onDown(e) {
    e.stopPropagation();

    startX = e.pageX
    startY = e.pageY

    figure.start(startX, startY);
    tpx = x
    swipeBase.start(startX)

  },
  onUp(e) {
    swipeBase.end(function (r) {
      console.log(r)



      let len=r*160


      let time =Math.abs(len) /2+400
      console.log(len,time)
      animation.start(function (p) {

        eDrag.style.left=x+p*len+'px'

      },time,function () {
        x+=len
      })


    })
  }
});
