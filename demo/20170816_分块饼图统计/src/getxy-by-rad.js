

// 取坐标 by弧度
// 弧度末端坐标值
export default function getxyByRad(rad,r,ox,oy) {

  // 算偏移x
  let x = Math.cos(rad) * r + ox

  // 算偏移y
  let y = Math.sin(rad) * r + oy

  return {x,y}
}
