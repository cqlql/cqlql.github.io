import './index.css'

function addCssText(txt) {
  let eStyle = document.createElement('style');

  if ('textContent' in eStyle) {
    eStyle.textContent = txt;
    document.head.appendChild(eStyle);
  }
  else {
    // ie678
    eStyle.setAttribute("type", "text/css");
    eStyle.styleSheet.cssText = txt;
    document.body.appendChild(eStyle);
  }
}

function handle1() {


  let boxH = 245
  let count = 20
  let maxCount = parseInt(boxH / (12 * 1.6))
  if (count > maxCount) {
    count = maxCount
  }

  let rh = boxH / count
  let lineHeight = 1.46
  let fontSize = rh / lineHeight


  addCssText(`
.box li{
height:${rh}px;
font-size:${fontSize}px
}
`)

}

function handle2() {
  let boxH = 245
  let count = 15
  let rootHeight = 35
  let rootContHeight = count*rootHeight
  let scale =boxH/rootContHeight

  addCssText(`.box ul{
transform: scale(${scale}) translateY(${-(rootContHeight-boxH)/2/scale}px);
-webkit-transform: scale(${scale}) translateY(${-(rootContHeight-boxH)/2/scale}px);
}`)

}

handle2();
// handle1();



