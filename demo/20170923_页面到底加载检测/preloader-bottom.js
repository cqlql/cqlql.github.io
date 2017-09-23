/*
<div class="preloader-bottom" :class="{finish:isFinish}">
  <span class="preloader"></span>
  <span class="txt">正在加载...</span>
</div>
*/
import '../css-base/preloader.css'
import './preloader-bottom.css'
let preloaderBottom = {
  minHeight: 36,
  test () {
    if (this.bodyHeight - this.windowHeight - window.pageYOffset < this.minHeight) {
      return true
    }
  },
  update () {
    this.bodyHeight = document.body.clientHeight
    this.windowHeight = window.innerHeight
    console.log(this.bodyHeight, this.windowHeight)
  }
}

export default preloaderBottom
