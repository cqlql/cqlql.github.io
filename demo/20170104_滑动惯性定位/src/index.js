import './index.css'
import Swipe from './swipe'
import drag from './modules/drag'
import Figure from './modules/figure'
import Animation from './modules/animation'
import InertiaAnime from './modules/inertia-anime'

let swipeBase = new Swipe();
let animation = new Animation
let figure = new Figure
animation.easing = function (x, t, b, c, d) {
  return c * ((t = t / d - 1) * t * t + 1) + b;
};
let eDrag = document.getElementById('app')

let x = 0, y = 0, tpx, tpy;
let startX = 0
let startY = 0

let animeData = []
let inertiaAnime = new InertiaAnime(function (v) {
  eDrag.style.left=v+'px'
  animeData.push(v)
},.2)

inertiaAnime.complete=function () {
  console.log(animeData)
}

drag({
  eDrag,
  onDown(e) {
    e.stopPropagation();

    startX = e.pageX

    swipeBase.start(startX)

  },
  onMove(e) {
    let moveX = e.pageX

    let lenx = moveX - startX

    x = lenx + tpx
    swipeBase.move(moveX)
    eDrag.style.left = x + 'px'
    e.preventDefault();
  },

  onUp(e) {
    swipeBase.end(function (r) {
      inertiaAnime.start(inertiaAnime.cur + r*160)

    })
  }
});
