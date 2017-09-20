
import './modules/comm'
import autoprefix from './modules/autoprefix'
import drag from './modules/drag-mobile'
import InertiaAnime from './modules/inertia-anime'
import Animation from './modules/animation'

import Swipe from './swipe'

let transform = autoprefix('transform')[1]

export default class {
  constructor({
                eDrag, eMove,
                onChange=()=>{}
              }) {

    let swipeBase = new Swipe();
    let animation = this.animation = new Animation

    // let eDrag = document.querySelector('.slide-select')
    // let eMove = this.eMove = eDrag.querySelector('.s-move')
    this.eMove = eMove
    let eItems = this.eItems = eMove.children

    let inertiaAnime = new InertiaAnime({
      move: (v) => {
        this.currX = v
        this.elmMove(v)
      },
      complete: () => {
        this.recover(this.currX)
      }
    })

    this.currIndex=0
    this.currX = 0
    this.direction=0// 0 反方向(向左上)，1 正方向(向右下)

    let itemH = this.itemH = 30// 项高
    this.contH = itemH *  eItems.length
    this.mkH=120 //阴影高度
    this.onChange = onChange

    let startX
    let tempX

    drag({
      eDrag,
      onStart: (e) => {
        e.stopPropagation();

        inertiaAnime.stop()
        animation.stop()

        startX = e.touches[0].pageY

        tempX = this.currX

        swipeBase.start(startX)

      },
      onMove: (e) => {
        e.preventDefault();

        let moveX = e.touches[0].pageY

        let lenx = moveX - startX
        if(lenx>0){
          this.direction=1
        } else {
          this.direction=0
        }

        let currX = lenx + tempX

        swipeBase.move(moveX)

        this.elmMove(this.currX = currX)
      },
      onEnd: () => {
        swipeBase.end((r) => {
          let v = r * 60

          inertiaAnime.start((inertiaAnime.cur = this.currX) + v)
        }, () => {
          this.recover(this.currX)
        })
      }
    });
  }

  elmMove(y) {
    this.eMove.style[transform] = 'translate3d(0,' + y + 'px,0)'
  }

  // 选择结果
  result(y){
    let {itemH,mkH,eItems,currIndex} = this
    let index = (mkH + itemH-y)/itemH-1
    if(index!==currIndex ){
      this.onChange(this.currIndex = index)
    }

  }

  select(index){
    this.currIndex=index
    this.elmMove(this.currX = this.mkH-index*this.itemH)
  }

  recover(y) {

    let {animation, itemH: h, contH, mkH} = this
    let t

    // 最大最小限制
    let maxY = mkH
    let minY = mkH + h - contH
    if (y > maxY) {
      t = y - maxY
    } else if (y < minY) {
      t = -(mkH - y - contH + h)
    } else {
      t = y % h
      if(Math.abs(t)>h/2){
        t = h- Math.abs(t)
        if(y>0){
          t=-t
        }
      }
    }

    this.result(y - t)

    animation.start((p) => {
      this.elmMove(this.currX = y - t * p)
    }, 100)
  }
}
