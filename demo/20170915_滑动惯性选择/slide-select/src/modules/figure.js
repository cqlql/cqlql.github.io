/**
 * 计算坐标
 * 点与点相加
 * */
/* eslint-disable */
export default function Figure() {
  this.start = function (x, y) {
    this.prevX = x;
    this.prevY = y;
  };

  this.move = function (x, y, fn) {
    fn(x - this.prevX, y - this.prevY);

    this.prevX = x;
    this.prevY = y;
  };
}
