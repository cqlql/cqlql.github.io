
export default class {
  init (cb) {
    let html = `
<div class="popup-buttom">
  <div class="fgp-bg"></div>
  <div class="fgp-bd">
    <div class="fgp-cont"><!--内容--></div>
  </div>
</div>`
    let elm = document.createElement('div')
    elm.innerHTML = html

    let elRoot = this.elRoot = elm.children[0]
    let elChild = elRoot.children

    let elBg = this.elBg = elChild[0]
    this.elCont = elChild[1]

    elBg.addEventListener('click', () => {
      this.close()
    })

    document.body.appendChild(elRoot)
  }

  show () {
    this.elRoot.classList.add('show')
  }

  close () {
    this.elRoot.classList.remove('show')
  }
  setCont (body) {
    let {elCont} = this

    // if (typeof body === 'string'){
    elCont.innerHTML = body
    // } else{
    //   elCont.innerHTML = ''
    //   elCont.appendChild(body)
    // }
  }
}
