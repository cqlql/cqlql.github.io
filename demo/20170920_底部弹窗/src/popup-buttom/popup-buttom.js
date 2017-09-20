export default class {
  constructor() {

  }

  init(cb){
    this.init = function (cb) { cb() }

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
    let elCont = this.elCont = elChild[1]

    elBg.addEventListener('click', () => {
      this.close()
    })

    document.body.appendChild(elRoot)

    // 解决初始动画问题
    setTimeout(cb,1)
  }

  show({
         body,
    before=()=>{}
       }) {
    this.init(() => {
      let {elCont}=this

      // if (typeof body === 'string'){
        elCont.innerHTML = body
      // } else{
      //   elCont.innerHTML = ''
      //   elCont.appendChild(body)
      // }

      before(elCont)


      this.elRoot.classList.add('show')
    })
  }

  close(){
    this.elRoot.classList.remove('show')
  }
}
