import './index.css'
import Swipe from './swipe'
import drag from './modules/drag'
import Figure from './modules/figure'
import Animation from './modules/animation'
import InertiaAnime from './modules/inertia-anime'
import generateAnimeData from './modules/generate-anime-data'

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
    eDrag.style.top = startAnimeData[i] + 'px'
    i++
    if (i > firstIndex) {
      let s = startAnimeData[firstIndex]
      let len = end - s
      animation.start(function (p) {
        eDrag.style.top = s + len * p + 'px'
      }, 200)

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

