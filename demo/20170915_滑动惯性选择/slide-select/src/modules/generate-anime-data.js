/*

最终目标

*/
/* eslint-disable */
let itemH = 38

/*easeOutQuad*/
function ease(x, t, b, c, d) {
  return -c * (t /= d) * (t - 2) + b;
}

let interval = 20 // 帧间隔
let t = 400 / interval // 总次数

export default function (animeData) {

  let count = animeData.length
  if (count < 2) {
    return
  }

  let ld = animeData[count - 1]
  let lastLen = itemH - ld % itemH

  // if(ld-animeData[0]>0){
  //   lastLen = itemH - ld % itemH
  // } else{
  //   lastLen = itemH + ld % itemH
  // }
  let end = lastLen + ld
  let firstIndex
  for (let i = count - 1, d, lsp; i--;) {
    d = animeData[i]
    lsp = d - animeData[i - 1]

    // if((lsp>0&&ease( null,1,0,ld-d+lastLen,t)<lsp)||ease( null,1,0,ld-d+lastLen,t)>lsp){
    if (ease(null, 1, 0, ld - d + lastLen, count) < lsp) {
      firstIndex = i
      // let s = animeData[i+1]
      // s+ld-s
      break
    }
  }
  console.log(count)

  return {firstIndex, end}
}
