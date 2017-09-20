/**
 * 速度衔接方案
 * */
import './index.css'
import Swipe from './swipe'
import drag from './modules/drag'
// import drag from './modules/drag-mobile'
import Figure from './modules/figure'
import Animation from './modules/animation'
import InertiaAnime from './modules/inertia-anime'
import generateAnimeData from './modules/generate-anime-data'
import autoprefix from './modules/autoprefix'

var transform = autoprefix('transform')[1]

let swipeBase = new Swipe();
let animation = new Animation
let figure = new Figure
animation.easing = function (x, t, b, c, d) {
  return -c * (t /= d) * (t - 2) + b;
};
let eDrag = document.getElementById('app')

let x = 0, y = 0, tpx, tpy;
let startX = 0
let startY = 0

let animeData = []
let inertiaAnime = new InertiaAnime(function (v) {
  // eDrag.style.left=v+'px'
  animeData.push(v)
}, .2)

inertiaAnime.complete = function () {

  let startAnimeData = animeData

  let aData = generateAnimeData(startAnimeData)
  let {firstIndex, end} = aData
  let i = 0

// firstIndex=startAnimeData.length-1
  function run() {
    // eDrag.style.top = startAnimeData[i] + 'px'
    eDrag.style[transform] = 'translate3d(0,'+startAnimeData[i]+'px,0)'
    i++
    if (i > firstIndex) {
      let s = startAnimeData[firstIndex]
      let len = end - s

      return
    }
    requestAnimationFrame(run, 20);
  }

  run()

}

drag({
  eDrag,
  onDown(e) {
    e.stopPropagation();

    startX = e.pageY
    animeData=[]
    swipeBase.start(startX)

  },
  onMove(e) {
    let moveX = e.pageY

    let lenx = moveX - startX

    x = lenx + tpx
    swipeBase.move(moveX)
    eDrag.style.top = x + 'px'
    e.preventDefault();
  },

  onUp(e) {
    swipeBase.end(function (r) {
      inertiaAnime.start(inertiaAnime.cur + r * 160)

    })
  }
});

/*
drag({
  eDrag,
  onStart(e) {
    e.stopPropagation();

    startX = e.touches[0].pageY
    animeData=[]
    swipeBase.start(startX)

  },
  onMove(e) {
    let moveX = e.touches[0].pageY

    let lenx = moveX - startX

    x = lenx + tpx
    swipeBase.move(moveX)
    eDrag.style.top = x + 'px'
    e.preventDefault();
  },

  onEnd(e) {
    swipeBase.end(function (r) {
      inertiaAnime.start(inertiaAnime.cur + r * 160)

    })
  }
});
*/

