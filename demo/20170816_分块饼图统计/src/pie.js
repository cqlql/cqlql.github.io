import getxyByRad from './getxy-by-rad'
import arc from './arc'

/**
 * 返回 d 属性值
 * */
export default function ({
                           // 圆心
                           ox, oy,
                           // 半径
                           r,
                           // 起始弧度
                           sRad,

                           // 弧度大小
                           rad,

                           oft
                         }) {

  // 新圆心，新起点，根据偏移值
  let halfRad = rad/2
  oft = oft / Math.sin(halfRad) // 真实偏移值
  let {x: rox, y: roy} = getxyByRad(halfRad + sRad, oft, ox, oy)
  ox = rox
  oy = roy
  r = r - oft// 新半径

  // 起始弧度点
  let {x: sx, y: sy} = getxyByRad(sRad, r, ox, oy)

  let A = arc({sRad, rad, r, ox, oy})

  let d = `M${ox.toFixed(3)} ${oy.toFixed(3)} L${sx.toFixed(3)} ${sy.toFixed(3)} ${A} Z`

  return d
}
