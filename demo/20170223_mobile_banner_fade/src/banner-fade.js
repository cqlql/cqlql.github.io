
import ChangeBase from './change-base'

export default function ({el}) {

  let box =el
  let imgs = box.children
  let count = imgs.length

  if(count<2) return

  box.classList.add('animate')

  let changeBase = new ChangeBase({count:imgs.length})

  document.querySelector('.btn1').addEventListener('click',function (e) {
    let {target} = e
    if(target.classList.contains('r')){

      changeBase.goRight(function (prei,i) {

        imgs[prei].classList.remove('fade-in')
        imgs[i].classList.add('fade-in')

      })
    }
    else {
      changeBase.goLeft(function (prei,i) {

        imgs[prei].classList.remove('fade-in')
        imgs[i].classList.add('fade-in')

      })
    }
  })
}
