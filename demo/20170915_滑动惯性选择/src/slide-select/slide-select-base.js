import '../modules/comm'
import autoprefix from '../modules/autoprefix'
import drag from '../modules/drag-mobile'
import InertiaAnime from '../modules/inertia-anime'
import Animation from '../modules/animation'

import Swipe from '../modules/swipe'

let transform = autoprefix('transform')[1]

export default class {
  constructor({
                eDrag, eMove,
                onChange=()=>{}
              } = {}) {


    // let eDrag = this.eDrag = document.querySelector('.slide-select')
    // let eMove = this.eMove = eDrag.querySelector('.s-move')
    this.eDrag=eDrag
    this.eMove=eMove

    let itemH = this.itemH = 30// 项高
    // let eItems = eMove.children
    let contH = itemH * eMove.children.length
    this.minH = itemH - contH

    this.currIndex = 0
    this.currX = 0
    this.direction = 0// 0 反方向(向左上)，1 正方向(向右下)

    this.onChange = onChange

    this.init()
  }

  init() {
    let {eDrag, eMove} = this

    let swipeBase = new Swipe();
    let animation = this.animation = new Animation

    let inertiaAnime = new InertiaAnime({
      move: (v) => {
        this.currX = v
        this.elmMove(v)
      },
      complete: () => {
        this.recover(this.currX)
      }
    })

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
        if (lenx > 0) {
          this.direction = 1
        } else {
          this.direction = 0
        }

        let currX = lenx + tempX

        swipeBase.move(moveX)

        this.elmMove(this.currX = currX)
      },
      onEnd: () => {
        swipeBase.end((r) => {
          let v = r * 60
          let currX = inertiaAnime.cur = this.currX
          inertiaAnime.start(currX + v)
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
  result(y) {
    let {itemH, mkH, eItems, currIndex} = this
    let index = (-y+'') / itemH
    if (index !== currIndex) {
      this.onChange(this.currIndex = index)
    }
  }

  select(index) {
    this.currIndex = index
    this.elmMove(this.currX = -index * this.itemH)
  }

  recover(y) {
    let {minH, itemH: h} = this
    let t
    if (y > 0) {
      t = 0
    } else if (y < minH) {
      t = minH
    } else {
      t = y
      t = y % h
      if (t < -h / 2) {
        t = t - (h + t) + (y - t)
      } else {
        t = y - t
      }
    }

    this.result(t)

    this.animation.start((p) => {
      let currX = this.currX = y + (t - y) * p
      this.elmMove(currX)
    }, 100)

  }
}
